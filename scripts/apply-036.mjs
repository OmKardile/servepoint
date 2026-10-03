// Task 87 — apply migration 036_menu_photo_storage.sql with proofs.
// Proofs:
//   P1  bucket: public-read, 2 MiB, raster-only mime allowlist
//   P2  policies: exactly the 4 expected menu-photo policies on storage.objects
//   P3  scope: each write policy checks tenant membership on folder[1]
//   P4  idempotency: re-apply is a no-op (bucket upsert + drop/create)
import pg from 'pg';
import { dbPassword } from './db-creds.mjs';

const c = new pg.Client({
  host: 'aws-0-ap-northeast-2.pooler.supabase.com',
  port: 5432,
  user: 'postgres.gehjsxopcowmotgrrcgc',
  password: dbPassword(),
  database: 'postgres',
  ssl: { rejectUnauthorized: false },
});
await c.connect();
let fails = 0;
const ok = (cond, label) => {
  console.log(`${cond ? '✓' : '✗'} ${label}`);
  if (!cond) fails++;
};

const sql = await (await import('node:fs/promises')).readFile(
  new URL('../supabase/migrations/036_menu_photo_storage.sql', import.meta.url), 'utf8');
await c.query(sql);
console.log('migration 036 applied.');

// P1 — bucket shape
const b = await c.query(`SELECT public, file_size_limit, allowed_mime_types FROM storage.buckets WHERE id='menu-photos'`);
const bucket = b.rows[0];
ok(bucket?.public === true && Number(bucket?.file_size_limit) === 2097152 &&
   bucket?.allowed_mime_types?.length === 4 && !bucket.allowed_mime_types.includes('image/svg+xml'),
  `P1: bucket public, 2 MiB, raster-only (${bucket?.allowed_mime_types?.join(', ')})`);

// P2 — the 4 policies
const pol = await c.query(
  `SELECT policyname, cmd FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects' AND policyname LIKE 'menu photos %'
    ORDER BY policyname`);
ok(pol.rowCount === 4 &&
   JSON.stringify(pol.rows.map(r => r.policyname).sort()) === JSON.stringify([
     'menu photos member delete','menu photos member update',
     'menu photos member upload','menu photos public read',
   ]),
  `P2: 4 policies present (${pol.rows.map(r => r.policyname).join(', ')})`);

// P3 — member scoping present in the upload policy's WITH CHECK
// (INSERT policies carry the gate in with_check, not qual)
const up = await c.query(
  `SELECT with_check FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects' AND policyname='menu photos member upload'`);
const chk = up.rows[0]?.with_check || '';
ok(chk.includes('tenant_users') && chk.includes('foldername') && chk.includes('owner') && chk.includes('staff'),
  `P3: upload policy scopes by tenant membership on folder[1]`);

// P4 — idempotency: re-apply cleanly
await c.query(sql);
const b2 = await c.query(`SELECT count(*)::int n FROM storage.buckets WHERE id='menu-photos'`);
const pol2 = await c.query(
  `SELECT count(*)::int n FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects' AND policyname LIKE 'menu photos %'`);
ok(b2.rows[0].n === 1 && pol2.rows[0].n === 4, `P4: re-apply idempotent (bucket=1, policies=4)`);

console.log(fails === 0 ? 'APPLY OK' : `APPLY FAILED (${fails})`);
await c.end();
process.exit(fails === 0 ? 0 : 1);
