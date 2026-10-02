// restore Coffee beans reorder line to 500 (config rollback after E2E)
import pg from 'pg';
import { dbPassword } from './db-creds.mjs';
const c = new pg.Client({
  host: 'aws-0-ap-northeast-2.pooler.supabase.com', port: 5432,
  user: 'postgres.gehjsxopcowmotgrrcgc', password: dbPassword(),
  database: 'postgres', ssl: { rejectUnauthorized: false },
});
await c.connect();
const r = await c.query(
  `UPDATE inventory_items SET reorder_point = 500
    WHERE tenant_id='d207be19-e86f-4780-befb-3968831a38fe' AND name='Coffee beans'
    RETURNING current_stock, reorder_point`);
console.log('line restored:', r.rows[0]);
await c.end();
