// Task 79 recon — inventory stocks/reorder points, notification count, publication state.
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

const inv = await c.query(
  `SELECT id, name, unit, current_stock, reorder_point FROM inventory_items
    WHERE tenant_id = $1 ORDER BY name`, [T]);
console.log('inventory:');
for (const r of inv.rows) console.log(`  ${r.name} — ${r.current_stock} ${r.unit}, reorder @ ${r.reorder_point}`);

const n = await c.query(`SELECT count(*)::int AS n FROM notifications WHERE tenant_id = $1`, [T]);
console.log(`notifications rows: ${n.rows[0].n}`);

const pub = await c.query(
  `SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime' ORDER BY tablename`);
console.log('realtime publication:', pub.rows.map(r => r.tablename).join(', '));

const fb = await c.query(`SELECT count(*)::int AS n FROM order_feedback WHERE tenant_id = $1`, [T]);
console.log(`order_feedback rows: ${fb.rows[0].n}`);

// a paid order id without feedback (for the rollback probe)
const ord = await c.query(
  `SELECT o.id, o.order_number FROM orders o
    WHERE o.tenant_id = $1 AND o.status = 'completed' AND o.payment_status = 'paid'
      AND NOT EXISTS (SELECT 1 FROM order_feedback f WHERE f.order_id = o.id)
    ORDER BY o.created_at DESC LIMIT 1`, [T]);
console.log('probe order:', ord.rows[0] ? `${ord.rows[0].order_number} (${ord.rows[0].id})` : 'NONE');

const res = await c.query(
  `SELECT id, guest_name, party_size, status, slot_at FROM reservations WHERE tenant_id = $1`, [T]);
console.log(`reservations: ${res.rowCount}`);
for (const r of res.rows) console.log(`  ${r.guest_name} ×${r.party_size} ${r.status} slot ${r.slot_at}`);
await c.end();
