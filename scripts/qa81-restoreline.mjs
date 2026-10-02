// Task 81 — restore Coffee beans' reorder line to 500 after the E2E.
// Restoring DOWNWARD cannot cross (stock 4,880 < old line), so it stays
// silent by design — proven live in the 5.40.0 round.
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

const item = (await c.query(
  `SELECT id, name, current_stock, reorder_point FROM inventory_items
    WHERE tenant_id=$1 AND name='Coffee beans'`, [T])).rows[0];
await c.query(`UPDATE inventory_items SET reorder_point=500 WHERE id=$1`, [item.id]);
const after = (await c.query(
  `SELECT current_stock, reorder_point FROM inventory_items WHERE id=$1`, [item.id])).rows[0];
const bells = (await c.query(
  `SELECT count(*)::int AS n FROM notifications
    WHERE tenant_id=$1 AND created_at > now() - interval '1 minute'`, [T])).rows[0];
console.log(`restored: stock=${after.current_stock} line=${after.reorder_point} (was ${item.reorder_point})`);
console.log(`bells in the last minute: ${bells.n} (expected 0 — downward restore is silent)`);
await c.end();
process.exit(Number(after.reorder_point) === 500 && bells.n === 0 ? 0 : 1);
