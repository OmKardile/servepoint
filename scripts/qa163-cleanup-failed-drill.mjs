#!/usr/bin/env node.mjs
/* Task 163 — pooler cleanup for the FAILED drill provision (city 23502).
 * Residue: auth user drill.owner@recoverydrill.in (best-effort signUp ran
 * even though the tenants insert failed). No tenant/tenant_users rows exist
 * (REST-verified). Browser-local registry rows are wiped separately. */
import pg from 'pg';

const url = process.env.SUPABASE_DB_PASSWORD
  ? null
  : process.env.DATABASE_URL;

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await client.connect();

const EMAIL = 'drill.owner@recoverydrill.in';
const found = await client.query('SELECT id, email, created_at FROM auth.users WHERE email = $1', [EMAIL]);
if (found.rows.length === 0) {
  console.log('auth user: absent (already clean)');
} else {
  const uid = found.rows[0].id;
  const del = await client.query('DELETE FROM auth.users WHERE id = $1', [uid]);
  console.log('auth user deleted:', EMAIL, uid.slice(0, 8), 'rowCount=', del.rowCount);
}

const tenantCheck = await client.query("SELECT count(*) AS n FROM tenants WHERE slug LIKE 'recovery%' OR slug = 'pune'");
console.log('drill tenant rows:', tenantCheck.rows[0].n);
await client.end();
