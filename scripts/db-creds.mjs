// Shared Supabase cloud-DB credential loader for the one-shot apply/seed/probe
// scripts (v5.27.1 daily-hardening). Same discipline scripts/db-setup.mjs has
// always documented — the password is NEVER committed:
//
//   SUPABASE_DB_PASSWORD='<db-password>' node scripts/<script>.mjs
//
// Host / user / database are configuration, not secrets (the project ref is
// public in the app's own Supabase URL). Only the password is sensitive.

const HOST = 'aws-0-ap-northeast-2.pooler.supabase.com';
const PORT = 5432;
const USER = 'postgres.gehjsxopcowmotgrrcgc';
const DATABASE = 'postgres';

/** DB password from the environment — loud failure, never a fallback value. */
export function dbPassword() {
  const password = process.env.SUPABASE_DB_PASSWORD;
  if (!password) {
    console.error('Set SUPABASE_DB_PASSWORD env var (see docs/CREDENTIALS.md).');
    process.exit(1);
  }
  return password;
}

/** Ready-to-spread pg.Client config for the cloud pooler. */
export function dbConfig() {
  return {
    host: HOST,
    port: PORT,
    user: USER,
    password: dbPassword(),
    database: DATABASE,
    ssl: { rejectUnauthorized: false },
  };
}
