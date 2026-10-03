// Task 96 — read-only availability check: is_available of every menu item.
// NO writes — the E2E flip must go through the real UI, this only watches.
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

const names = await c.query(
  `SELECT name, is_available, updated_at FROM menu_items WHERE tenant_id=$1 ORDER BY name LIMIT 30`, [T]);
for (const r of names.rows) console.log(`  · ${r.name} — avail:${r.is_available} updated:${r.updated_at?.toISOString?.() || r.updated_at}`);

await c.end();
