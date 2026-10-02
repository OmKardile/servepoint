// Task 47 — apply migration 018 (COGS/margin views) to the cloud DB.
// Run: node scripts/apply-018.mjs
import { readFileSync } from 'node:fs';
import pg from 'pg';

const REF = 'gehjsxopcowmotgrrcgc';
const c = new pg.Client({
  host: 'aws-0-ap-northeast-2.pooler.supabase.com',
  port: 5432,
  user: `postgres.${REF}`,
  password: 'gen.narumii@protonmail.comA1',
  database: 'postgres',
  ssl: { rejectUnauthorized: false },
});

try {
  await c.connect();
  const sql = readFileSync('supabase/migrations/018_cogs_margin.sql', 'utf8');
  await c.query(sql);
  console.log('APPLIED 018_cogs_margin');

  // sentinel — same discipline as 013/015/016/017 rounds
  await c.query(
    `INSERT INTO schema_migrations (name) VALUES ('018_cogs_margin')
     ON CONFLICT (name) DO NOTHING`,
  ).catch(async (e) => {
    const t = await c.query(`SELECT to_regclass('public.schema_migrations') AS t`);
    if (t.rows[0].t) throw e;
    console.log('SENTINEL SKIPPED (no schema_migrations table)');
  });
  console.log('SENTINEL OK');

  // proof: both views exist, security_invoker, and select-able
  const v = await c.query(
    `SELECT viewname, reloptions FROM pg_views v
     JOIN pg_class c ON c.relname = v.viewname AND c.relnamespace = 'public'::regnamespace
     WHERE v.schemaname='public' AND v.viewname IN ('v_order_cogs','v_item_unit_cost')
     ORDER BY viewname`,
  );
  for (const r of v.rows) console.log('VIEW:', r.viewname, JSON.stringify(r.reloptions));
  const g = await c.query(
    `SELECT has_table_privilege('authenticated', 'v_order_cogs', 'SELECT') AS auth_order,
            has_table_privilege('authenticated', 'v_item_unit_cost', 'SELECT') AS auth_item`,
  );
  console.log('GRANTS:', JSON.stringify(g.rows[0]));
} catch (e) {
  console.error('FAILED:', e.message);
  process.exitCode = 1;
} finally {
  await c.end().catch(() => {});
}
