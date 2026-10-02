// Task 52 — apply migration 021 (cash drawer movements) to the cloud DB.
// Run: node scripts/apply-021.mjs
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
  const sql = readFileSync('supabase/migrations/021_cash_movements.sql', 'utf8');
  await c.query(sql);
  console.log('APPLIED 021_cash_movements');

  // sentinel — same discipline as previous rounds
  await c.query(
    `INSERT INTO schema_migrations (name) VALUES ('021_cash_movements')
     ON CONFLICT (name) DO NOTHING`,
  ).catch(async (e) => {
    const t = await c.query(`SELECT to_regclass('public.schema_migrations') AS t`);
    if (t.rows[0].t) throw e;
    console.log('SENTINEL SKIPPED (no schema_migrations table)');
  });
  console.log('SENTINEL OK');

  // proof
  const t = await c.query(
    `SELECT relrowsecurity AS rls FROM pg_class WHERE oid = 'public.cash_drawer_movements'::regclass`,
  );
  console.log('TABLE RLS:', t.rows[0]?.rls);
  const p = await c.query(
    `SELECT policyname FROM pg_policies WHERE tablename='cash_drawer_movements' ORDER BY policyname`,
  );
  for (const r of p.rows) console.log('POLICY:', r.policyname);
  const rt = await c.query(
    `SELECT count(*) AS on_pub FROM pg_publication_tables
     WHERE pubname='supabase_realtime' AND tablename='cash_drawer_movements'`,
  );
  console.log('REALTIME:', Number(rt.rows[0].on_pub) === 1);
  const g = await c.query(
    `SELECT has_function_privilege('anon', 'sp_record_drawer_movement(UUID,TEXT,NUMERIC,TEXT)', 'EXECUTE') AS anon_move,
            has_function_privilege('authenticated', 'sp_record_drawer_movement(UUID,TEXT,NUMERIC,TEXT)', 'EXECUTE') AS auth_move`,
  );
  console.log('GRANTS anon/auth movement:', g.rows[0].anon_move, g.rows[0].auth_move);
  const body = await c.query(
    `SELECT position('cash_drawer_movements' in prosrc) > 0 AS nets_out FROM pg_proc
     WHERE proname='sp_close_drawer' AND pronamespace='public'::regnamespace`,
  );
  console.log('sp_close_drawer nets movements:', body.rows[0].nets_out);
  console.log('EXISTING MOVEMENT ROWS:', (await c.query(`SELECT count(*) AS n FROM cash_drawer_movements`)).rows[0].n);
} catch (e) {
  console.error('APPLY FAILED:', e.message);
  process.exitCode = 1;
} finally {
  await c.end();
}
