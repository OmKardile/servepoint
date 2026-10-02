// Task 79 E2E setup — temporarily raise Coffee beans' reorder line just
// under the shelf (4,875 vs 4,880) so a real 10 g waste via the UI crosses
// it. Restored to 500 by qa79-bell.mjs at the end. This is config, not
// ledger — the diary rows that follow are the honest record.
import pg from 'pg';
import { dbPassword } from './db-creds.mjs';
const c = new pg.Client({
  host: 'aws-0-ap-northeast-2.pooler.supabase.com', port: 5432,
  user: 'postgres.gehjsxopcowmotgrrcgc', password: dbPassword(),
  database: 'postgres', ssl: { rejectUnauthorized: false },
});
await c.connect();
const T = 'd207be19-e86f-4780-befb-3968831a38fe';
const r = await c.query(
  `UPDATE inventory_items SET reorder_point = 4875
    WHERE tenant_id=$1 AND name='Coffee beans' RETURNING name, current_stock, reorder_point`, [T]);
console.log('line set:', r.rows[0]);
await c.end();
