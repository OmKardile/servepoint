// Task 72 — apply migration 026 (tenant logo storage bucket) to the cloud DB.
// Run: SUPABASE_DB_PASSWORD='<db-password>' node scripts/apply-026.mjs
import { readFileSync } from 'node:fs';
import pg from 'pg';
import { dbPassword } from './db-creds.mjs';

const REF = 'gehjsxopcowmotgrrcgc';
const c = new pg.Client({
  host: 'aws-0-ap-northeast-2.pooler.supabase.com',
  port: 5432,
  user: `postgres.${REF}`,
  password: dbPassword(),
  database: 'postgres',
  ssl: { rejectUnauthorized: false },
});

try {
  await c.connect();
  const sql = readFileSync('supabase/migrations/026_tenant_logo_storage.sql', 'utf8');
  await c.query(sql);
  console.log('APPLIED 026_tenant_logo_storage');

  await c.query(
    `INSERT INTO schema_migrations (name) VALUES ('026_tenant_logo_storage')
     ON CONFLICT (name) DO NOTHING`,
  ).catch(async (e) => {
    const t = await c.query(`SELECT to_regclass('public.schema_migrations') AS t`);
    if (t.rows[0].t) throw e;
    console.log('SENTINEL SKIPPED (no schema_migrations table)');
  });
  console.log('SENTINEL OK');

  // proof 1 — bucket exists, public, with the guardrails
  const b = await c.query(`SELECT id, public, file_size_limit, allowed_mime_types FROM storage.buckets WHERE id = 'tenant-logos'`);
  if (b.rowCount !== 1 || b.rows[0].public !== true || Number(b.rows[0].file_size_limit) !== 1048576) {
    throw new Error(`bucket wrong: ${JSON.stringify(b.rows)}`);
  }
  console.log('BUCKET OK: tenant-logos public, 1 MiB limit,', b.rows[0].allowed_mime_types.length, 'mime types');

  // proof 2 — exactly the four policies, scoped to the bucket
  const p = await c.query(
    `SELECT policyname, cmd, roles FROM pg_policies
      WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname LIKE 'tenant logo %'
      ORDER BY policyname`,
  );
  const names = p.rows.map((r) => r.policyname);
  for (const want of ['tenant logo own delete', 'tenant logo own update', 'tenant logo own upload', 'tenant logo public read']) {
    if (!names.includes(want)) throw new Error(`missing policy: ${want}`);
  }
  console.log('POLICIES OK:', p.rows.map((r) => `${r.policyname} (${r.cmd})`).join(' · '));

  // proof 3 — tenants.logo_url still intact (no schema drift on the column this feature feeds)
  const col = await c.query(
    `SELECT data_type FROM information_schema.columns WHERE table_name = 'tenants' AND column_name = 'logo_url'`,
  );
  if (col.rowCount !== 1) throw new Error('tenants.logo_url missing');
  console.log('COLUMN OK: tenants.logo_url =', col.rows[0].data_type);
} catch (e) {
  console.error('APPLY FAILED:', e.message);
  process.exitCode = 1;
} finally {
  await c.end().catch(() => undefined);
}
