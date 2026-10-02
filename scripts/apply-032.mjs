// Task 81 — apply migration 032_notification_links.sql with proofs.
// Proofs:
//   P1  link_to column exists (TEXT, nullable)
//   P2  all three trigger generators carry the door (prosrc contains link_to)
//   P3  the three triggers are still on duty after the function replace
//   P4  backfill — every bell row (system/feedback/reminder) has its door
//   P5  ROLLBACK probe — a live low-stock crossing rings WITH link_to='inventory',
//       a live booking rings WITH link_to='floor' — zero residue after rollback
//   P6  realtime publication intact
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

const sql = await (await import('node:fs/promises')).readFile(
  new URL('../supabase/migrations/032_notification_links.sql', import.meta.url), 'utf8');
await c.query(sql);

// P1 — the column
const col = await c.query(
  `SELECT data_type, is_nullable FROM information_schema.columns
    WHERE table_schema='public' AND table_name='notifications' AND column_name='link_to'`);
ok(col.rowCount === 1 && col.rows[0].data_type === 'text' && col.rows[0].is_nullable === 'YES',
  `P1: notifications.link_to ${col.rows[0]?.data_type}, nullable=${col.rows[0]?.is_nullable}`);

// P2 — all three functions stamp the door
const fns = await c.query(
  `SELECT proname FROM pg_proc
    WHERE proname IN ('fn_notify_low_stock','fn_notify_low_rating','fn_notify_today_booking')
      AND prosrc LIKE '%link_to%'`);
ok(fns.rowCount === 3, `P2: generators carry link_to (${fns.rows.map(r => r.proname).join(', ')})`);

// P3 — triggers still bound after CREATE OR REPLACE FUNCTION
const trig = await c.query(
  `SELECT trigger_name FROM information_schema.triggers
    WHERE trigger_schema='public'
      AND trigger_name IN ('trg_inventory_low_stock','trg_feedback_low_rating','trg_reservation_today_reminder')
    ORDER BY trigger_name`);
ok(trig.rowCount === 3, `P3: triggers on duty (${trig.rows.map(r => r.trigger_name).join(', ')})`);

// P4 — no blind bells: every system/feedback/reminder row has its door
const blind = await c.query(
  `SELECT category, link_to, count(*)::int AS n FROM notifications
    WHERE tenant_id=$1 GROUP BY category, link_to ORDER BY category`, [T]);
const rows = blind.rows;
const systemOk = rows.filter(r => r.category === 'system').every(r => r.link_to === 'inventory');
const reminderOk = rows.filter(r => r.category === 'reminder').every(r => r.link_to === 'floor');
const bellBlind = await c.query(
  `SELECT count(*)::int AS n FROM notifications
    WHERE category IN ('system','feedback','reminder') AND link_to IS NULL`);
ok(systemOk && reminderOk && bellBlind.rows[0].n === 0,
  `P4: no blind bells (${rows.map(r => `${r.category}→${r.link_to || '∅'}×${r.n}`).join(', ')})`);

// P5 — rollback probe: crossing + booking ring WITH doors, then vanish
await c.query('BEGIN');
// 5a — low stock crossing: find an inventory item, force it under a fresh line
const item = (await c.query(
  `SELECT id, name, current_stock, unit FROM inventory_items
    WHERE tenant_id=$1 ORDER BY name LIMIT 1`, [T])).rows[0];
await c.query(`UPDATE inventory_items SET reorder_point = current_stock + 5 WHERE id=$1`, [item.id]);
await c.query(`UPDATE inventory_items SET current_stock = current_stock - 1 WHERE id=$1`, [item.id]);
const stockBell = await c.query(
  `SELECT title, link_to FROM notifications
    WHERE tenant_id=$1 AND category='system' ORDER BY created_at DESC LIMIT 1`, [T]);
ok(stockBell.rowCount === 1 && stockBell.rows[0].link_to === 'inventory' &&
   stockBell.rows[0].title.startsWith('Low stock: '),
  `P5a: crossing rang with door — "${stockBell.rows[0]?.title}" → ${stockBell.rows[0]?.link_to}`);
// 5b — today's booking
const t1 = (await c.query(
  `SELECT id FROM dining_tables WHERE tenant_id=$1 ORDER BY table_number LIMIT 1`, [T])).rows[0];
await c.query(
  `INSERT INTO reservations (tenant_id, guest_name, phone, party_size, table_id, slot_at, status)
    VALUES ($1,'Probe Guest','99999 00000',2,$2,
            (date_trunc('day', now() AT TIME ZONE 'Asia/Kolkata') + interval '19 hours 30 minutes')
              AT TIME ZONE 'Asia/Kolkata',
            'booked')`, [T, t1.id]);
const bookBell = await c.query(
  `SELECT title, link_to FROM notifications
    WHERE tenant_id=$1 AND category='reminder' ORDER BY created_at DESC LIMIT 1`, [T]);
ok(bookBell.rowCount === 1 && bookBell.rows[0].link_to === 'floor' &&
   bookBell.rows[0].title.startsWith('Booking today: Probe Guest'),
  `P5b: booking rang with door — "${bookBell.rows[0]?.title}" → ${bookBell.rows[0]?.link_to}`);
await c.query('ROLLBACK');

// Residue check — rollback erased the probe bells AND restored the shelf
const residue = await c.query(
  `SELECT
     (SELECT count(*)::int FROM notifications
       WHERE tenant_id=$1 AND (body LIKE '%Probe Guest%' OR title LIKE '%Probe Guest%')) AS probe_bells,
     (SELECT reorder_point FROM inventory_items WHERE id=$2) AS line,
     (SELECT current_stock FROM inventory_items WHERE id=$2) AS stock,
     (SELECT count(*)::int FROM reservations WHERE tenant_id=$1 AND guest_name='Probe Guest') AS probe_books`,
  [T, item.id]);
ok(residue.rows[0].probe_bells === 0 && residue.rows[0].probe_books === 0 &&
   Number(residue.rows[0].line) < 5000 && Number(residue.rows[0].stock) === Number(item.current_stock),
  `Residue: probe_bells=${residue.rows[0].probe_bells} probe_books=${residue.rows[0].probe_books} line=${residue.rows[0].line} stock=${residue.rows[0].stock} — all clean`);

// P6 — realtime intact
const pub = await c.query(
  `SELECT tablename FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='notifications'`);
ok(pub.rowCount === 1, 'P6: notifications still in realtime publication');

console.log(fails === 0 ? '\nALL PROOFS GREEN' : `\n${fails} PROOF(S) FAILED`);
await c.end();
process.exit(fails === 0 ? 0 : 1);
