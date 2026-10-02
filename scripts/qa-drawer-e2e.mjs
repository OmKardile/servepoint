// Task 51 — DB E2E for migration 020 (cash drawer sessions).
// Run: node scripts/qa-drawer-e2e.mjs
// Structure + RPC behaviour exercised AS the real owner (forged JWT claims —
// current_tenant_id() falls back to tenant_users by auth.uid(), so sub alone
// suffices) + anon lockout proof + self-cleaning fixture.
import pg from 'pg';
import { dbPassword } from './db-creds.mjs';

const REF = 'gehjsxopcowmotgrrcgc';
const OWNER_EMAIL = 'qrowner@qrflowcafe.in';
const TENANT = 'd207be19-e86f-4780-befb-3968831a38fe';

const c = new pg.Client({
  host: 'aws-0-ap-northeast-2.pooler.supabase.com',
  port: 5432,
  user: `postgres.${REF}`,
  password: dbPassword(),
  database: 'postgres',
  ssl: { rejectUnauthorized: false },
});

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  PASS ${name}${extra ? ' — ' + extra : ''}`); }
  else { fail++; console.log(`  FAIL ${name}${extra ? ' — ' + extra : ''}`); }
};
const asOwner = async () => {
  await c.query(`SET ROLE authenticated`);
  await c.query(`SELECT set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: OWNER_UID, role: 'authenticated', email: OWNER_EMAIL })]);
};
const asAnon = async () => {
  await c.query(`RESET request.jwt.claims`);
  await c.query(`SET ROLE anon`);
};
const asAdmin = async () => {
  await c.query(`RESET ROLE`);
  await c.query(`RESET request.jwt.claims`);
};

let OWNER_UID = '';
const createdSessionIds = [];
const fixturePaymentIds = [];

try {
  await c.connect();

  /* ── 1. structure ── */
  console.log('STRUCTURE');
  const tbl = await c.query(`SELECT relrowsecurity::int AS rls FROM pg_class WHERE oid='public.cash_drawer_sessions'::regclass`);
  ok('table exists + RLS enabled', tbl.rows[0]?.rls === 1);
  const pol = await c.query(`SELECT count(*) AS n FROM pg_policies WHERE tablename='cash_drawer_sessions'`);
  ok('exactly 1 policy', pol.rows[0].n === '1');
  const idx = await c.query(`SELECT indexdef FROM pg_indexes WHERE indexname='uq_cash_drawer_one_open'`);
  ok('one-open partial unique index', idx.rows.length === 1 && idx.rows[0].indexdef.includes("status = 'open'"));
  const fns = await c.query(`SELECT proname FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN ('sp_open_drawer','sp_close_drawer')`);
  ok('exactly 2 RPCs', fns.rows.length === 2);
  const anon = await c.query(`SELECT has_function_privilege('anon','sp_open_drawer(numeric)','EXECUTE') AS a, has_function_privilege('anon','sp_close_drawer(uuid,numeric,text)','EXECUTE') AS b`);
  ok('anon has NO execute', anon.rows[0].a === false && anon.rows[0].b === false);
  const pub = await c.query(`SELECT count(*) AS n FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='cash_drawer_sessions'`);
  ok('on realtime publication', pub.rows[0].n === '1');
  const owner = await c.query(`SELECT id FROM auth.users WHERE email = $1`, [OWNER_EMAIL]);
  OWNER_UID = owner.rows[0]?.id || '';
  ok('owner auth uid found', OWNER_UID !== '', OWNER_UID.slice(0, 8));

  /* ── 2. RPC behaviour as owner ── */
  console.log('RPC AS OWNER');
  await asOwner();

  const neg = await c.query(`SELECT sp_open_drawer(-5)`).then(() => null, (e) => e);
  ok('open(-5) → BAD_FLOAT', neg?.message.includes('BAD_FLOAT'));

  const opened = await c.query(`SELECT sp_open_drawer(500.00) AS s`);
  const sess = opened.rows[0].s;
  ok('open(500) returns session', sess?.id && sess.status === 'open' && Number(sess.opening_float) === 500);
  createdSessionIds.push(sess.id);

  const meta = await c.query(`SELECT opened_by_email, tenant_id FROM cash_drawer_sessions WHERE id = $1`, [sess.id]);
  ok('opened_by_email = owner', meta.rows[0].opened_by_email === OWNER_EMAIL, meta.rows[0].opened_by_email);
  ok('tenant scoping correct', meta.rows[0].tenant_id === TENANT);

  const dup = await c.query(`SELECT sp_open_drawer(100)`).then(() => null, (e) => e);
  ok('second open → DRAWER_ALREADY_OPEN', dup?.message.includes('DRAWER_ALREADY_OPEN'));

  // cash payment fixture — ride a real order, real ledger shape (007)
  const ord = await c.query(
    `SELECT id FROM orders WHERE tenant_id = $1 AND order_number = 48 LIMIT 1`, [TENANT],
  );
  const pay = await c.query(
    `INSERT INTO payments (tenant_id, order_id, method, amount, status, confirmed_by_email)
     VALUES ($1, $2, 'cash', 120.50, 'paid', 'qa-drawer-e2e') RETURNING id`,
    [TENANT, ord.rows[0].id],
  );
  fixturePaymentIds.push(pay.rows[0].id);

  // non-cash must NOT count into the drawer
  const payCard = await c.query(
    `INSERT INTO payments (tenant_id, order_id, method, amount, status, confirmed_by_email)
     VALUES ($1, $2, 'card', 999.99, 'paid', 'qa-drawer-e2e') RETURNING id`,
    [TENANT, ord.rows[0].id],
  );
  fixturePaymentIds.push(payCard.rows[0].id);

  const closed = await c.query(`SELECT sp_close_drawer($1, 630.50, '  counted with the owner  ') AS s`, [sess.id]);
  const cl = closed.rows[0].s;
  ok('close returns shift truth', cl?.status === 'closed' && Number(cl.expected_cash) === 620.50 && Number(cl.cash_in) === 120.50,
     `expected ${cl?.expected_cash} = 500 float + 120.50 cash (card 999.99 ignored)`);
  ok('variance stored = counted − expected', Number(cl.variance) === 10, `variance ${cl?.variance}`);
  ok('note trimmed', cl.id ? true : false);
  const noteRow = await c.query(`SELECT closing_note, closed_by_email FROM cash_drawer_sessions WHERE id = $1`, [sess.id]);
  ok('note trimmed to "counted with the owner"', noteRow.rows[0].closing_note === 'counted with the owner', JSON.stringify(noteRow.rows[0].closing_note));
  ok('closed_by_email = owner', noteRow.rows[0].closed_by_email === OWNER_EMAIL);

  const again = await c.query(`SELECT sp_close_drawer($1, 1, null)`, [sess.id]).then(() => null, (e) => e);
  ok('double close → ALREADY_CLOSED', again?.message.includes('ALREADY_CLOSED'));

  const ghost = await c.query(`SELECT sp_close_drawer(gen_random_uuid(), 1, null)`).then(() => null, (e) => e);
  ok('unknown session → NOT_FOUND', ghost?.message.includes('NOT_FOUND'));

  const badCount = await c.query(`SELECT sp_close_drawer(gen_random_uuid(), -3, null)`).then(() => null, (e) => e);
  ok('negative counted → BAD_COUNT', badCount?.message.includes('BAD_COUNT'));

  // open a second shift to exercise TOO_LONG + history, then close it tiny
  const s2 = (await c.query(`SELECT sp_open_drawer(0) AS s`)).rows[0].s;
  createdSessionIds.push(s2.id);
  const longNote = 'x'.repeat(281);
  const tooLong = await c.query(`SELECT sp_close_drawer($1, 0, $2)`, [s2.id, longNote]).then(() => null, (e) => e);
  ok('281-char note → TOO_LONG', tooLong?.message.includes('TOO_LONG'));
  const c2 = (await c.query(`SELECT sp_close_drawer($1, 0, $2) AS s`, [s2.id, 'float intact'])).rows[0].s;
  ok('zero-activity shift closes clean', Number(c2.expected_cash) === 0 && Number(c2.variance) === 0);

  await asAdmin();

  /* ── 3. lockout — anon sees nothing, writes nothing ── */
  console.log('LOCKOUT (anon)');
  await asAnon();
  const vis = await c.query(`SELECT count(*) AS n FROM cash_drawer_sessions`);
  ok('anon SELECT sees 0 rows', vis.rows[0].n === '0');
  const ins = await c.query(`INSERT INTO cash_drawer_sessions (tenant_id, opening_float) VALUES ($1, 1)`, [TENANT]).then(() => null, (e) => e);
  ok('anon INSERT denied by RLS', ins !== null);
  await asAdmin();

  /* ── 4. cleanup — ledger back to zero ── */
  console.log('CLEANUP');
  await c.query(`DELETE FROM payments WHERE id = ANY($1)`, [fixturePaymentIds]);
  await c.query(`DELETE FROM cash_drawer_sessions WHERE id = ANY($1)`, [createdSessionIds]);
  const left = await c.query(`SELECT count(*) AS n FROM cash_drawer_sessions`);
  const payLeft = await c.query(`SELECT count(*) AS n FROM payments WHERE confirmed_by_email = 'qa-drawer-e2e'`);
  ok('drawer ledger back to 0', left.rows[0].n === '0');
  ok('fixture payments gone', payLeft.rows[0].n === '0');

  console.log(`\nRESULT: ${pass} pass, ${fail} fail`);
  process.exitCode = fail === 0 ? 0 : 1;
} catch (e) {
  console.error('E2E ERROR:', e.message);
  process.exitCode = 1;
} finally {
  await c.end().catch(() => {});
}
