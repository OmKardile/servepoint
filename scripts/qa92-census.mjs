// Task 92 — read-only pre-flight census: how many live menu items carry
// is_veg true/false, and which dining table tokens exist for the guest-menu
// E2E. NO writes — this script only reads.
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
const T = 'd207be19-e86f-4780-befb-3968831a38fe';

const veg = await c.query(
  `SELECT is_veg, count(*)::int n FROM menu_items WHERE tenant_id=$1 GROUP BY is_veg ORDER BY is_veg`, [T]);
console.log('menu is_veg census:', JSON.stringify(veg.rows));

const names = await c.query(
  `SELECT name, is_veg, is_available FROM menu_items WHERE tenant_id=$1 ORDER BY name LIMIT 30`, [T]);
for (const r of names.rows) console.log(`  · ${r.name} — veg:${r.is_veg} avail:${r.is_available}`);

const tables = await c.query(
  `SELECT table_number, qr_token IS NOT NULL AS has_tok FROM dining_tables WHERE tenant_id=$1 ORDER BY table_number`, [T]);
console.log('tables:', JSON.stringify(tables.rows));

await c.end();
