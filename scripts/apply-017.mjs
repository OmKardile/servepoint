// Task 46 — apply migration 017 (guest offer checkout) to the cloud DB.
// Run: node scripts/apply-017.mjs
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
  const sql = readFileSync('supabase/migrations/017_guest_offer_checkout.sql', 'utf8');
  await c.query(sql);
  console.log('APPLIED 017_guest_offer_checkout');

  // sentinel — same discipline as 013/015/016 rounds
  await c.query(
    `INSERT INTO schema_migrations (name) VALUES ('017_guest_offer_checkout')
     ON CONFLICT (name) DO NOTHING`,
  ).catch(async (e) => {
    // table may not exist → probe
    const t = await c.query(
      `SELECT to_regclass('public.schema_migrations') AS t`,
    );
    if (t.rows[0].t) throw e;
    console.log('SENTINEL SKIPPED (no schema_migrations table)');
  });
  console.log('SENTINEL OK');

  // proof: signature + grants
  const sig = await c.query(
    `SELECT proargnames FROM pg_proc
     WHERE pronamespace='public'::regnamespace AND proname='sp_create_public_order'`,
  );
  console.log('PARAMS:', JSON.stringify(sig.rows[0].proargnames));
  const grants = await c.query(
    `SELECT has_function_privilege('anon', 'sp_create_public_order(TEXT,TEXT,JSONB,TEXT,TEXT,TEXT,TEXT,UUID)', 'EXECUTE') AS create_anon,
            has_function_privilege('anon', 'sp_get_public_order(UUID)', 'EXECUTE') AS track_anon`,
  );
  console.log('GRANTS:', JSON.stringify(grants.rows[0]));
} catch (e) {
  console.error('FAILED:', e.message);
  process.exitCode = 1;
} finally {
  await c.end();
}
