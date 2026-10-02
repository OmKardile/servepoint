// Supabase provisioning script: applies ServePoint migrations 001-010 to the live
// Supabase project via the Supavisor session pooler (IPv4 path — direct
// db.<ref>.supabase.co:5432 is IPv6-only on current projects), then verifies.
// NOT part of the app bundle.
//
// USAGE (password never committed):
//   SUPABASE_DB_PASSWORD='<db-password>' bun scripts/db-setup.mjs
import { readFileSync } from 'node:fs';
import pg from 'pg';

const REF = 'gehjsxopcowmotgrrcgc';
const HOST = 'aws-0-ap-northeast-2.pooler.supabase.com';
const PASSWORD = process.env.SUPABASE_DB_PASSWORD;
if (!PASSWORD) {
  console.error('Set SUPABASE_DB_PASSWORD env var (see docs/CREDENTIALS.md).');
  process.exit(1);
}

const client = new pg.Client({
  host: HOST,
  port: 5432,
  user: `postgres.${REF}`,
  password: PASSWORD,
  database: 'postgres',
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 12000,
});

async function scalar(sql) {
  const { rows } = await client.query(sql);
  return rows[0] ? Object.values(rows[0])[0] : null;
}

async function tableExists(name) {
  const v = await scalar(
    `SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='${name}'`
  );
  return Number(v) > 0;
}

async function functionExists(name) {
  const v = await scalar(
    `SELECT to_regprocedure('public.${name}(uuid)') IS NOT NULL`
  );
  return v === true;
}

async function applyFile(label, path, alreadyApplied) {
  if (alreadyApplied) {
    console.log(`SKIP  ${label} (already applied)`);
    return;
  }
  const sql = readFileSync(path, 'utf8');
  try {
    await client.query(sql);
    console.log(`APPLY ${label} ✓`);
  } catch (err) {
    console.error(`FAIL  ${label}: ${err.message}`);
    throw err;
  }
}

try {
  await client.connect();
  console.log(`CONNECTED ${HOST} as postgres.${REF}`);

  // 003 sentinel: role CHECK widened to the three-role model
  let threeRole = false;
  {
    const { rows } = await client.query(
      `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint
        WHERE conname='tenant_users_role_check'
          AND conrelid = to_regclass('public.tenant_users')`
    );
    threeRole = rows.length > 0 && String(rows[0].def).includes("'staff'");
  }

  await applyFile('001_multi_tenant_saas', 'supabase/migrations/001_multi_tenant_saas.sql', await tableExists('tenants'));
  await applyFile('002_ephemeral_table_sessions', 'supabase/migrations/002_ephemeral_table_sessions.sql', await tableExists('table_sessions'));
  await applyFile('003_role_model_staff_merge', 'supabase/migrations/003_role_model_staff_merge.sql', threeRole);
  await applyFile('004_notifications_messages', 'supabase/migrations/004_notifications_messages.sql', await tableExists('notifications'));
  await applyFile('005_production_baseline_hardening', 'supabase/migrations/005_production_baseline_hardening.sql', false);
  // 006 sentinel: RLS recursion fix helper in place
  await applyFile('006_fix_rls_recursion', 'supabase/migrations/006_fix_rls_recursion.sql', await functionExists('sp_tenant_member'));
  // 007 sentinel: order-engine payments ledger in place
  await applyFile('007_order_engine_payments_history', 'supabase/migrations/007_order_engine_payments_history.sql', await tableExists('payments'));
  // 008 sentinel: double-payment guard present inside sp_record_payment
  const payGuard = async () => {
    const { rows } = await client.query(
      `SELECT pg_get_functiondef('public.sp_record_payment(uuid,text,numeric)'::regprocedure) AS def`
    );
    return String(rows[0]?.def ?? '').includes('already been paid');
  };
  await applyFile('008_payment_guards', 'supabase/migrations/008_payment_guards.sql', await payGuard());
  // 009 sentinel: owner-membership self-claim function in place
  await applyFile(
    '009_owner_membership',
    'supabase/migrations/009_owner_membership.sql',
    await functionExists('sp_claim_tenant_memberships')
  );
  // 010 sentinel: both KDS tables streaming on the realtime publication
  const realtimeCount = async () =>
    Number(
      await scalar(
        `SELECT count(*) FROM pg_publication_tables
          WHERE pubname='supabase_realtime' AND schemaname='public'
            AND tablename IN ('orders','order_items')`
      )
    );
  await applyFile('010_realtime_kds', 'supabase/migrations/010_realtime_kds.sql', (await realtimeCount()) === 2);
  // 011 sentinel: floor tables streaming + lifecycle trigger + both fixed policies
  const floorReady = async () => {
    const pub = Number(
      await scalar(
        `SELECT count(*) FROM pg_publication_tables
          WHERE pubname='supabase_realtime' AND schemaname='public'
            AND tablename IN ('dining_tables','table_sessions')`
      )
    );
    const trg = Number(
      await scalar(
        `SELECT count(*) FROM pg_trigger
          WHERE tgname='trg_orders_sync_table' AND tgrelid='orders'::regclass AND NOT tgisinternal`
      )
    );
    const pol = Number(
      await scalar(
        `SELECT count(*) FROM pg_policies
          WHERE schemaname='public'
            AND ((tablename='dining_tables' AND policyname='Public guest verify dining table by token')
              OR (tablename='table_sessions' AND policyname='Diners view own session by token header'))`
      )
    );
    return pub === 2 && trg === 1 && pol === 2;
  };
  await applyFile('011_floor_security_realtime', 'supabase/migrations/011_floor_security_realtime.sql', await floorReady());
  // 012 sentinel: menu-depth tables + guest RPCs + idempotency column/index
  const guestReady = async () => {
    const tables = Number(
      await scalar(
        `SELECT count(*) FROM information_schema.tables
          WHERE table_schema='public'
            AND table_name IN ('menu_variants','addons','menu_item_addons','order_item_addons')`
      )
    );
    const fns = Number(
      await scalar(
        `SELECT count(*) FROM pg_proc
          WHERE pronamespace='public'::regnamespace
            AND proname IN ('sp_resolve_table_qr','sp_get_public_menu','sp_create_public_order','sp_get_public_order')`
      )
    );
    const col = Number(
      await scalar(
        `SELECT count(*) FROM information_schema.columns
          WHERE table_schema='public' AND table_name='orders' AND column_name='client_operation_id'`
      )
    );
    const idx = Number(
      await scalar(`SELECT count(*) FROM pg_indexes WHERE schemaname='public' AND indexname='uq_orders_client_operation'`)
    );
    return tables === 4 && fns === 4 && col === 1 && idx === 1;
  };
  await applyFile('012_menu_variants_guest_qr', 'supabase/migrations/012_menu_variants_guest_qr.sql', await guestReady());
  // 013 sentinel: counter-gate engine — inbox-Ok ladder (new→pending) + money-in-hand auto-advance
  const counterGateReady = async () => {
    const adv = String(
      await scalar(`SELECT pg_get_functiondef('sp_advance_order(UUID,TEXT)'::regprocedure)`)
    );
    const pay = String(
      await scalar(`SELECT pg_get_functiondef('sp_record_payment(UUID,TEXT,NUMERIC)'::regprocedure)`)
    );
    const okLadder = adv.includes("v_status = 'new' AND p_to_status IN ('pending'");
    const autoAdvance = pay.includes("IF v_status IN ('new', 'pending') THEN");
    return okLadder && autoAdvance;
  };
  await applyFile('013_counter_gate', 'supabase/migrations/013_counter_gate.sql', await counterGateReady());

  // 015 sentinel: inventory ENGINE (recipe_lines + deduction ledger + preparing-time
  // trigger + realtime). inventory_items itself was applied out-of-band by a
  // parallel round (014 is theirs, no file) — this engine ADOPTS it as canonical.
  const inventoryEngineReady = async () => {
    const tables = Number(
      await scalar(
        `SELECT count(*) FROM information_schema.tables WHERE table_schema='public'
          AND table_name IN ('recipe_lines','stock_deductions')`
      )
    );
    const trg = Number(
      await scalar(
        `SELECT count(*) FROM pg_trigger WHERE tgname='trg_orders_deduct_stock' AND NOT tgisinternal`
      )
    );
    const pub = Number(
      await scalar(
        `SELECT count(*) FROM pg_publication_tables WHERE pubname='supabase_realtime'
          AND tablename IN ('inventory_items','stock_deductions')`
      )
    );
    return tables === 2 && trg === 1 && pub === 2;
  };
  await applyFile('015_inventory_engine', 'supabase/migrations/015_inventory_engine.sql', await inventoryEngineReady());

  // 016 sentinel: CRM — customers/offers/offer_redemptions + stats view +
  // auto-enrich + usage-bump triggers + public-offers RPC + realtime.
  const crmReady = async () => {
    const tables = Number(
      await scalar(
        `SELECT count(*) FROM information_schema.tables WHERE table_schema='public'
          AND table_name IN ('customers','offers','offer_redemptions')`
      )
    );
    const view = Number(
      await scalar(
        `SELECT count(*) FROM information_schema.views WHERE table_schema='public'
          AND table_name='v_customer_stats'`
      )
    );
    const trg = Number(
      await scalar(
        `SELECT count(*) FROM pg_trigger WHERE tgname IN
          ('trg_orders_touch_customer','trg_offer_redemptions_usage') AND NOT tgisinternal`
      )
    );
    const rpc = await scalar(`SELECT to_regprocedure('public.sp_public_offers(text)') IS NOT NULL`);
    const pub = Number(
      await scalar(
        `SELECT count(*) FROM pg_publication_tables WHERE pubname='supabase_realtime'
          AND tablename IN ('customers','offers')`
      )
    );
    return tables === 3 && view === 1 && trg === 2 && rpc === true && pub === 2;
  };
  await applyFile('016_customers_offers', 'supabase/migrations/016_customers_offers.sql', await crmReady());

  // ── Verification ──────────────────────────────────────────────────────────
  const tables = await client.query(
    `SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name`
  );
  console.log('PUBLIC TABLES:', tables.rows.map((r) => r.table_name).join(', '));

  const policies = await client.query(
    `SELECT tablename, count(*) AS n FROM pg_policies WHERE schemaname='public'
      AND tablename IN ('tenants','subscriptions','platform_audit_logs')
      GROUP BY tablename ORDER BY tablename`
  );
  console.log('PLATFORM POLICIES:', JSON.stringify(policies.rows));

  const auditCols = await client.query(
    `SELECT column_name FROM information_schema.columns
      WHERE table_schema='public' AND table_name='platform_audit_logs' ORDER BY ordinal_position`
  );
  console.log('AUDIT COLUMNS:', auditCols.rows.map((r) => r.column_name).join(', '));

  const op = await client.query(
    `SELECT email, raw_user_meta_data->>'role' AS role, (email_confirmed_at IS NOT NULL) AS confirmed
       FROM auth.users WHERE email='admin@tsos.dev'`
  );
  console.log('BOOTSTRAP OPERATOR:', JSON.stringify(op.rows));

  const tu = await client.query(
    `SELECT email, role, is_active, (tenant_id IS NULL) AS tenant_free
       FROM tenant_users WHERE email='admin@tsos.dev'`
  );
  console.log('TENANT_USERS ROW:', JSON.stringify(tu.rows));

  const tenantsCount = await scalar('SELECT count(*)::text FROM public.tenants');
  const auditCount = await scalar('SELECT count(*)::text FROM public.platform_audit_logs');
  console.log('ROW COUNTS tenants/audit_logs:', `${tenantsCount}/${auditCount}`);

  console.log('SETUP COMPLETE ✓');
} catch (err) {
  console.error('SETUP-FAILED:', err.message);
  process.exit(1);
} finally {
  await client.end().catch(() => {});
}
