// Task 81 — raise Coffee beans' reorder line ABOVE current stock so the
// crossing rings a fresh, unread low-stock bell (config-only: no stock
// moves, no diary rows — the 5.40.0 round already proved the waste path).
// Restore with qa81-restoreline.mjs after the E2E.
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
  `SELECT id, name, current_stock, unit, reorder_point FROM inventory_items
    WHERE tenant_id=$1 AND name='Coffee beans'`, [T])).rows[0];
if (!item) { console.error('✗ Coffee beans not found'); process.exit(1); }
console.log(`before: ${item.name} stock=${item.current_stock} line=${item.reorder_point}`);

// Raise the line 5 above stock → the UPDATE itself is the crossing
// (OLD stock > OLD line, NEW stock <= NEW line) — one bell, unread.
const NEW_LINE = Number(item.current_stock) + 5;
await c.query(`UPDATE inventory_items SET reorder_point=$1 WHERE id=$2`, [NEW_LINE, item.id]);

const after = (await c.query(
  `SELECT current_stock, reorder_point FROM inventory_items WHERE id=$1`, [item.id])).rows[0];
const bell = (await c.query(
  `SELECT title, body, link_to, is_read FROM notifications
    WHERE tenant_id=$1 AND category='system' ORDER BY created_at DESC LIMIT 1`, [T])).rows[0];
console.log(`after:  stock=${after.current_stock} line=${after.reorder_point}`);
console.log(`bell:   "${bell?.title}" door=${bell?.link_to} unread=${!bell?.is_read}`);
console.log(`        body: ${bell?.body}`);
console.log(Number(after.reorder_point) === NEW_LINE && bell?.link_to === 'inventory' && !bell.is_read
  ? 'SETLINE OK' : 'SETLINE FAILED');
await c.end();
process.exit(Number(after.reorder_point) === NEW_LINE && bell?.link_to === 'inventory' && !bell.is_read ? 0 : 1);
