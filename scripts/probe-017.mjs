// Task 46 — probe pg_proc for sp_create_public_order overloads.
import pg from 'pg';
const c = new pg.Client({
  host: 'aws-0-ap-northeast-2.pooler.supabase.com',
  port: 5432,
  user: 'postgres.gehjsxopcowmotgrrcgc',
  password: 'gen.narumii@protonmail.comA1',
  database: 'postgres',
  ssl: { rejectUnauthorized: false },
});
try {
  await c.connect();
  const r = await c.query(
    `SELECT oid::regprocedure AS fn, proargnames FROM pg_proc
     WHERE pronamespace='public'::regnamespace AND proname='sp_create_public_order'`,
  );
  console.log(JSON.stringify(r.rows, null, 1));
} catch (e) {
  console.error('FAIL', e.message);
} finally {
  await c.end();
}
