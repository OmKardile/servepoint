// Task 79 — apply migration 030_notification_bells.sql with proofs.
// Proofs:
//   P1  three bell triggers exist on their tables
//   P2  notifications joined the realtime publication
//   P3  ROLLBACK probe — stock crossing rings the low-stock bell (zero residue)
//   P4  ROLLBACK probe — a 2★ rating rings the feedback bell (zero residue)
//   P5  ROLLBACK probe — a today-booking rings the reminder bell (zero residue)
//   P6  a booking for TOMORROW stays silent (scope guard)
// Every probe runs inside a transaction that is rolled back — the probe
// proves the wire without committing a single row.
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
let fails = 0;
const ok = (cond, label) => {
  console.log(`${cond ? '✓' : '✗'} ${label}`);
  if (!cond) fails++;
};

const sql = (await import('node:fs/promises')).readFile(
  new URL('../supabase/migrations/030_notification_bells.sql', import.meta.url), 'utf8');
await c.query(await sql);

// P1 — triggers exist
const trigs = await c.query(
  `SELECT trigger_name, event_object_table FROM information_schema.triggers
    WHERE trigger_schema = 'public'
      AND trigger_name IN ('trg_inventory_low_stock','trg_feedback_low_rating','trg_reservation_today_reminder')
    ORDER BY trigger_name`);
const expectTables = {
  trg_feedback_low_rating: 'order_feedback',
  trg_inventory_low_stock: 'inventory_items',
  trg_reservation_today_reminder: 'reservations',
};
ok(trigs.rowCount === 3 &&
   trigs.rows.every(r => expectTables[r.trigger_name] === r.event_object_table),
  `P1: 3 bell triggers on duty (${trigs.rows.map(r => r.trigger_name + '@' + r.event_object_table).join(', ')})`);

// P2 — realtime publication
const pub = await c.query(
  `SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='notifications'`);
ok(pub.rowCount === 1, 'P2: notifications in supabase_realtime');

// P3 — crossing probe (rolled back): raise the line above stock, drop stock under.
await c.query('BEGIN');
const bean = await c.query(
  `SELECT id, current_stock FROM inventory_items
    WHERE tenant_id=$1 AND name='Coffee beans' FOR UPDATE`, [T]);
const stock0 = Number(bean.rows[0].current_stock);
await c.query(`UPDATE inventory_items SET reorder_point = $2 WHERE id = $1`,
  [bean.rows[0].id, stock0 - 5]); // line just under the shelf
await c.query(`UPDATE inventory_items SET current_stock = $2 WHERE id = $1`,
  [bean.rows[0].id, stock0 - 10]); // cross: 4880 > 4875, 4870 <= 4875
const p3 = await c.query(
  `SELECT title, body FROM notifications WHERE tenant_id=$1 AND category='system'`, [T]);
ok(p3.rowCount === 1 && p3.rows[0].title === 'Low stock: Coffee beans',
  `P3: crossing rang the bell — "${p3.rows[0]?.title ?? 'SILENT'}" / "${p3.rows[0]?.body ?? ''}"`);
await c.query('ROLLBACK');

// P4 — low-rating probe (rolled back): temporarily lift the UNIQUE(order_id)
// gate by removing an existing feedback row, insert a fresh 2★, hear the bell.
await c.query('BEGIN');
const fb = await c.query(
  `SELECT order_id FROM order_feedback WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT 1`, [T]);
await c.query(`DELETE FROM order_feedback WHERE order_id = $1`, [fb.rows[0].order_id]);
const ordNo = await c.query(`SELECT order_number FROM orders WHERE id = $1`, [fb.rows[0].order_id]);
await c.query(
  `INSERT INTO order_feedback (tenant_id, order_id, rating, comment) VALUES ($1,$2,2,'probe — too bitter')`,
  [T, fb.rows[0].order_id]);
const p4 = await c.query(
  `SELECT title, body FROM notifications WHERE tenant_id=$1 AND category='feedback'`, [T]);
ok(p4.rowCount === 1 &&
   p4.rows[0].body.includes(String(ordNo.rows[0].order_number)) &&
   p4.rows[0].body.includes('too bitter'),
  `P4: 2★ rang the bell — "${p4.rows[0]?.title ?? 'SILENT'}" / "${p4.rows[0]?.body ?? ''}"`);
await c.query('ROLLBACK');

// P5 — today-booking probe (rolled back). slot_at: 7:30 pm IST today,
// composed as IST wall-clock (Asia/Kolkata) so the reminder's IST-date check
// sees the same "today" the floor sees.
await c.query('BEGIN');
await c.query(
  `INSERT INTO reservations (tenant_id, guest_name, phone, party_size, slot_at, note)
    VALUES ($1,'Probe Guest','90000 00000',3,
      (date_trunc('day', now() AT TIME ZONE 'Asia/Kolkata') + interval '19 hours 30 minutes')
        AT TIME ZONE 'Asia/Kolkata', 'apply-030 probe')`, [T]);
const p5 = await c.query(
  `SELECT title, body FROM notifications WHERE tenant_id=$1 AND category='reminder'`, [T]);
ok(p5.rowCount === 1 && p5.rows[0].title === 'Booking today: Probe Guest ×3' &&
   p5.rows[0].body.includes('7:30 pm'),
  `P5: today-booking rang the bell — "${p5.rows[0]?.title ?? 'SILENT'}" / "${p5.rows[0]?.body ?? ''}"`);
await c.query('ROLLBACK');

// P6 — tomorrow-booking stays silent (rolled back)
await c.query('BEGIN');
await c.query(
  `INSERT INTO reservations (tenant_id, guest_name, phone, party_size, slot_at, note)
    VALUES ($1,'Probe Tomorrow','90000 00000',2,
      (date_trunc('day', now() AT TIME ZONE 'Asia/Kolkata') + interval '1 day 19 hours 30 minutes')
        AT TIME ZONE 'Asia/Kolkata', 'apply-030 probe')`, [T]);
const p6 = await c.query(
  `SELECT count(*)::int AS n FROM notifications WHERE tenant_id=$1 AND category='reminder'`, [T]);
ok(p6.rows[0].n === 0, 'P6: tomorrow-booking stayed silent (scope guard)');
await c.query('ROLLBACK');

// Residue check — the probes committed nothing
const residue = await c.query(
  `SELECT
     (SELECT count(*)::int FROM notifications WHERE tenant_id=$1) AS notifs,
     (SELECT count(*)::int FROM reservations WHERE tenant_id=$1 AND guest_name LIKE 'Probe%') AS probes,
     (SELECT count(*)::int FROM order_feedback WHERE tenant_id=$1) AS fb,
     (SELECT current_stock FROM inventory_items WHERE tenant_id=$1 AND name='Coffee beans') AS beans,
     (SELECT reorder_point FROM inventory_items WHERE tenant_id=$1 AND name='Coffee beans') AS line`,
  [T]);
const r = residue.rows[0];
ok(r.notifs === 0 && r.probes === 0 && Number(r.fb) === 3 &&
   Number(r.beans) === stock0 && Number(r.line) === 500,
  `Residue: notifs=${r.notifs} probes=${r.probes} fb=${r.fb} beans=${r.beans} line=${r.line} — all clean`);

console.log(fails === 0 ? '\nALL PROOFS GREEN' : `\n${fails} PROOF(S) FAILED`);
await c.end();
process.exit(fails === 0 ? 0 : 1);
