// Task 51 — apply migration 020 (cash drawer sessions) to the cloud DB.
// Run: node scripts/apply-020.mjs
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
  const sql = readFileSync('supabase/migrations/020_cash_drawer.sql', 'utf8');
  await c.query(sql);
  console.log('APPLIED 020_cash_drawer');

  // sentinel — same discipline as 013/015/016/017/018/019 rounds
  await c.query(
    `INSERT INTO schema_migrations (name) VALUES ('020_cash_drawer')
     ON CONFLICT (name) DO NOTHING`,
  ).catch(async (e) => {
    const t = await c.query(`SELECT to_regclass('public.schema_migrations') AS t`);
    if (t.rows[0].t) throw e;
    console.log('SENTINEL SKIPPED (no schema_migrations table)');
  });
  console.log('SENTINEL OK');

  // proof: table exists + RLS + policies + realtime + grants + index
  const t = await c.query(
    `SELECT relrowsecurity AS rls, relforcerowsecurity AS force FROM pg_class WHERE oid = 'public.cash_drawer_sessions'::regclass`,
  );
  console.log('TABLE RLS:', t.rows[0]?.rls, 'FORCED:', t.rows[0]?.force);
  const p = await c.query(
    `SELECT policyname FROM pg_policies WHERE tablename='cash_drawer_sessions' ORDER BY policyname`,
  );
  for (const r of p.rows) console.log('POLICY:', r.policyname);
  const rt = await c.query(
    `SELECT count(*) AS on_pub FROM pg_publication_tables
     WHERE pubname='supabase_realtime' AND tablename='cash_drawer_sessions'`,
  );
  console.log('REALTIME:', Number(rt.rows[0].on_pub) === 1);
  const g = await c.query(
    `SELECT has_function_privilege('anon', 'sp_open_drawer(NUMERIC)', 'EXECUTE') AS anon_open,
            has_function_privilege('anon', 'sp_close_drawer(UUID,NUMERIC,TEXT)', 'EXECUTE') AS anon_close,
            has_function_privilege('authenticated', 'sp_open_drawer(NUMERIC)', 'EXECUTE') AS auth_open,
            has_function_privilege('authenticated', 'sp_close_drawer(UUID,NUMERIC,TEXT)', 'EXECUTE') AS auth_close`,
  );
  console.log('GRANTS anon open/close:', g.rows[0].anon_open, g.rows[0].anon_close,
              '| authenticated open/close:', g.rows[0].auth_open, g.rows[0].auth_close);
  const ix = await c.query(
    `SELECT indexdef FROM pg_indexes WHERE indexname='uq_cash_drawer_one_open'`,
  );
  console.log('INDEX:', ix.rows[0]?.indexdef);
  console.log('EXISTING ROWS:', (await c.query(`SELECT count(*) AS n FROM cash_drawer_sessions`)).rows[0].n);
} catch (e) {
  console.error('APPLY FAILED:', e.message);
  process.exitCode = 1;
} finally {
  await c.end();
}
