// Task 81 — DB truth for the bell's door round. Honest end state:
// 3 true bells (2 from round 79 + 1 from this round's config crossing),
// all read, all with doors; config restored; zero probe residue.
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

// T1 — exactly 3 bells, all read, all with the right door
const bells = await c.query(
  `SELECT category, title, link_to, is_read FROM notifications WHERE tenant_id=$1 ORDER BY created_at`, [T]);
const rows = bells.rows;
ok(rows.length === 3, `T1: exactly 3 bells on record (${rows.length})`);
ok(rows.every(r => r.is_read === true), 'T2: every bell is read (honest end state)');
ok(rows.filter(r => r.category === 'system').every(r => r.link_to === 'inventory') &&
   rows.filter(r => r.category === 'reminder').every(r => r.link_to === 'floor'),
   'T3: every door points at its true source (system→inventory, reminder→floor)');

// T4 — no blind bells anywhere
const blind = await c.query(
  `SELECT count(*)::int AS n FROM notifications
    WHERE category IN ('system','feedback','reminder') AND link_to IS NULL`);
ok(blind.rows[0].n === 0, 'T4: zero blind bells');

// T5 — config restored, no stock drift
const item = await c.query(
  `SELECT current_stock, reorder_point FROM inventory_items
    WHERE tenant_id=$1 AND name='Coffee beans'`, [T]);
ok(Number(item.rows[0].reorder_point) === 500 && Number(item.rows[0].current_stock) === 4880,
  `T5: Coffee beans stock=${item.rows[0].current_stock} line=${item.rows[0].reorder_point} — restored`);

// T6 — the generators carry the door
const fns = await c.query(
  `SELECT count(*)::int AS n FROM pg_proc
    WHERE proname IN ('fn_notify_low_stock','fn_notify_low_rating','fn_notify_today_booking')
      AND prosrc LIKE '%link_to%'`);
ok(fns.rows[0].n === 3, 'T6: all three generators stamp link_to');

// T7 — zero probe residue
const probe = await c.query(
  `SELECT
     (SELECT count(*)::int FROM notifications WHERE tenant_id=$1 AND title LIKE '%Probe Guest%') AS pb,
     (SELECT count(*)::int FROM reservations WHERE tenant_id=$1 AND guest_name='Probe Guest') AS pr`, [T]);
ok(probe.rows[0].pb === 0 && probe.rows[0].pr === 0,
  `T7: zero probe residue (bells=${probe.rows[0].pb} books=${probe.rows[0].pr})`);

// T8 — column exists, publication intact
const col = await c.query(
  `SELECT 1 FROM information_schema.columns WHERE table_schema='public'
    AND table_name='notifications' AND column_name='link_to'`);
const pub = await c.query(
  `SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='notifications'`);
ok(col.rowCount === 1 && pub.rowCount === 1, 'T8: link_to column + realtime publication intact');

console.log(fails === 0 ? '\nALL TRUTH GREEN' : `\n${fails} CHECK(S) FAILED`);
await c.end();
process.exit(fails === 0 ? 0 : 1);
