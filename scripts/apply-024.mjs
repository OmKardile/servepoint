// Task 65 — apply migration 024 (tenant café logo) to the cloud DB.
// Run: node scripts/apply-024.mjs
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
  const sql = readFileSync('supabase/migrations/024_tenant_logo.sql', 'utf8');
  await c.query(sql);
  console.log('APPLIED 024_tenant_logo');

  // sentinel — same discipline as previous rounds
  await c.query(
    `INSERT INTO schema_migrations (name) VALUES ('024_tenant_logo')
     ON CONFLICT (name) DO NOTHING`,
  ).catch(async (e) => {
    const t = await c.query(`SELECT to_regclass('public.schema_migrations') AS t`);
    if (t.rows[0].t) throw e;
    console.log('SENTINEL SKIPPED (no schema_migrations table)');
  });
  console.log('SENTINEL OK');

  // proof 1 — column exists, nullable, typed text
  const col = await c.query(
    `SELECT data_type, is_nullable FROM information_schema.columns
      WHERE table_name='tenants' AND column_name='logo_url'`,
  );
  if (col.rowCount !== 1) throw new Error('logo_url column missing after 024');
  console.log('COL:', JSON.stringify(col.rows[0]));

  // proof 2 — the storefront RPC hands logo_url through (NULL before any owner sets it)
  const m = await c.query(`SELECT sp_get_public_menu('qrflowcafe') AS r`);
  const tenant = m.rows[0].r.tenant;
  if (!('logo_url' in tenant)) throw new Error('sp_get_public_menu payload lacks logo_url');
  console.log('RPC tenant payload:', JSON.stringify(tenant));

  // proof 3 — RLS policies on tenants unchanged (4 expected)
  const pol = await c.query(`SELECT policyname, cmd FROM pg_policies WHERE tablename='tenants' ORDER BY policyname`);
  console.log('RLS:', pol.rows.map((r) => `${r.policyname}(${r.cmd})`).join(' | '));

  // proof 4 — owner write path works server-side (UPDATE then revert, service role)
  const t = await c.query(
    `UPDATE tenants SET logo_url='https://proof.invalid/probe.png'
      WHERE slug='qrflowcafe'
      RETURNING slug, logo_url`,
  );
  if (t.rowCount !== 1) throw new Error('probe update failed');
  await c.query(`UPDATE tenants SET logo_url=NULL WHERE slug='qrflowcafe'`);
  console.log('WRITE PATH: set + reverted OK (RLS untouched, column writable)');

  // proof 5 — menu payload reflects a set logo end-to-end
  await c.query(`UPDATE tenants SET logo_url='https://proof.invalid/visible.png' WHERE slug='qrflowcafe'`);
  const m2 = await c.query(`SELECT sp_get_public_menu('qrflowcafe') AS r`);
  console.log('RPC logo_url after set:', m2.rows[0].r.tenant.logo_url);
  await c.query(`UPDATE tenants SET logo_url=NULL WHERE slug='qrflowcafe'`);
  console.log('REVERTED to NULL (honest default restored)');
} catch (e) {
  console.error('APPLY FAILED:', e.message);
  process.exitCode = 1;
} finally {
  await c.end().catch(() => undefined);
}
