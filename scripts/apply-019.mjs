// Task 50 — apply migration 019 (guest feedback) to the cloud DB.
// Run: node scripts/apply-019.mjs
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
  const sql = readFileSync('supabase/migrations/019_guest_feedback.sql', 'utf8');
  await c.query(sql);
  console.log('APPLIED 019_guest_feedback');

  // sentinel — same discipline as 013/015/016/017/018 rounds
  await c.query(
    `INSERT INTO schema_migrations (name) VALUES ('019_guest_feedback')
     ON CONFLICT (name) DO NOTHING`,
  ).catch(async (e) => {
    const t = await c.query(`SELECT to_regclass('public.schema_migrations') AS t`);
    if (t.rows[0].t) throw e;
    console.log('SENTINEL SKIPPED (no schema_migrations table)');
  });
  console.log('SENTINEL OK');

  // proof: table exists + RLS + policies + realtime + grants
  const t = await c.query(
    `SELECT relrowsecurity AS rls FROM pg_class WHERE oid = 'public.order_feedback'::regclass`,
  );
  console.log('TABLE RLS:', t.rows[0]?.rls);
  const p = await c.query(
    `SELECT policyname FROM pg_policies WHERE tablename='order_feedback' ORDER BY policyname`,
  );
  for (const r of p.rows) console.log('POLICY:', r.policyname);
  const rt = await c.query(
    `SELECT count(*) AS on_pub FROM pg_publication_tables
     WHERE pubname='supabase_realtime' AND tablename='order_feedback'`,
  );
  console.log('REALTIME:', rt.rows[0].on_pub === 1);
  const g = await c.query(
    `SELECT has_function_privilege('anon', 'sp_submit_public_feedback(UUID,INTEGER,TEXT)', 'EXECUTE') AS anon_exec,
            has_function_privilege('anon', 'sp_get_public_order(UUID)', 'EXECUTE') AS pager_exec`,
  );
  console.log('GRANTS:', JSON.stringify(g.rows[0]));
} catch (e) {
  console.error('FAILED:', e.message);
  process.exitCode = 1;
} finally {
  await c.end().catch(() => {});
}
