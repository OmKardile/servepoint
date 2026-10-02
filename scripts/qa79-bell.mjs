// Task 79 — DB truth of the bell round. Read-only.
// Expect: exactly 2 notification rows (system low-stock + reminder booking),
// both marked read; Coffee beans 4,880 g with the reorder line RESTORED to
// 500; two new diary rows (spoiled −10, delivery +10, QA-tagged); the Dev
// Patil booking cancelled; order_feedback still 3 (the 2★ probe rolled back).
import pg from 'pg';
import { dbPassword } from './db-creds.mjs';
const c = new pg.Client({
  host: 'aws-0-ap-northeast-2.pooler.supabase.com', port: 5432,
  user: 'postgres.gehjsxopcowmotgrrcgc', password: dbPassword(),
  database: 'postgres', ssl: { rejectUnauthorized: false },
});
await c.connect();
const T = 'd207be19-e86f-4780-befb-3968831a38fe';
let fails = 0;
const ok = (cond, label) => { console.log(`${cond ? '✓' : '✗'} ${label}`); if (!cond) fails++; };

const notifs = await c.query(
  `SELECT category, title, body, is_read, created_at FROM notifications
    WHERE tenant_id = $1 ORDER BY created_at ASC`, [T]);
ok(notifs.rowCount === 2, `notifications: exactly 2 rows (${notifs.rowCount})`);
const sys = notifs.rows.find(n => n.category === 'system');
const rem = notifs.rows.find(n => n.category === 'reminder');
ok(!!sys && sys.title === 'Low stock: Coffee beans' &&
   sys.body.includes('4870 g') && sys.body.includes('4875 g'),
  `system row: "${sys?.title}" — honest body`);
ok(!!rem && rem.title === 'Booking today: Dev Patil ×2' &&
   rem.body.includes('7:30 pm') && rem.body.includes('T1') && rem.body.includes('97660 11223'),
  `reminder row: "${rem?.title}" — table, hour, phone on record`);
ok(notifs.rows.every(n => n.is_read), 'both rows marked read (mark-all-read E2E)');

const inv = await c.query(
  `SELECT current_stock, reorder_point FROM inventory_items
    WHERE tenant_id=$1 AND name='Coffee beans'`, [T]);
ok(Number(inv.rows[0].current_stock) === 4880 && Number(inv.rows[0].reorder_point) === 500,
  `Coffee beans: ${inv.rows[0].current_stock} g, line restored to ${inv.rows[0].reorder_point}`);

const adj = await c.query(
  `SELECT qty, reason, note, created_at FROM stock_adjustments
    WHERE tenant_id=$1 AND created_at > now() - interval '1 hour'
    ORDER BY created_at ASC`, [T]);
const spoil = adj.rows.find(r => Number(r.qty) === -10 && r.reason === 'spoilage');
const deliv = adj.rows.find(r => Number(r.qty) === 10 && r.reason === 'delivery');
ok(!!spoil && !!deliv && (spoil.note || '').includes('QA round 79'),
  `diary: spoilage −10 (noted "QA round 79") + delivery +10 (restock writes no note by design) — net zero`);

const resv = await c.query(
  `SELECT guest_name, status FROM reservations WHERE tenant_id=$1 AND guest_name='Dev Patil'`, [T]);
ok(resv.rowCount === 1 && resv.rows[0].status === 'cancelled',
  `booking: Dev Patil ${resv.rows[0]?.status} (cancelled — book clean, reminder stays as history)`);

const fb = await c.query(`SELECT count(*)::int AS n FROM order_feedback WHERE tenant_id=$1`, [T]);
ok(fb.rows[0].n === 3, `order_feedback: still 3 (rating probe rolled back, no guest fiction)`);

const probe = await c.query(
  `SELECT count(*)::int AS n FROM reservations WHERE tenant_id=$1 AND guest_name LIKE 'Probe%'`, [T]);
ok(probe.rows[0].n === 0, 'no probe residue anywhere');

console.log(fails === 0 ? '\nALL GREEN' : `\n${fails} CHECK(S) FAILED`);
await c.end();
process.exit(fails === 0 ? 0 : 1);
