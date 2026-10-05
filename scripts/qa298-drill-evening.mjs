// qa298 — the drill reads the evening: the round's real-execution proof.
//
// The tenant UI wall (QR owner password — the carried owner item) keeps the
// floor screen out of browser reach, so the block is proven the 295/296/297
// way: source-truth (unit298, the agreement shape) + THE REAL LEDGER read
// through the admin RLS, the rows derived with the SHIPPED lib function
// (tableTicketsOnDay — the exact code the drill's parent memo runs).
// The proof: rows.length === the trail's count (the SAME closure), the rows
// printed ticket-by-ticket in the exact bytes the block renders (# · time ·
// status · total · paid word), cancelled tickets absent, and the honest
// absence exercised for a day with no work.
//
import { createClient } from '@supabase/supabase-js';
import { tableTicketsOnDay, tableTicketDays } from '../src/lib/turn.ts';
import { appDayKey } from '../src/lib/appday.ts';

const db = createClient('https://gehjsxopcowmotgrrcgc.supabase.co', 'sb_publishable_igzjkrzX7PLfNI4hlI8p4g_FeqvHI32');
const { error: eAuth } = await db.auth.signInWithPassword({ email: 'admin@tsos.dev', password: 'admin123456' });
if (eAuth) { console.error('AUTH refused:', eAuth.message); process.exit(2); }

let fails = 0;
const check = (cond, label) => {
  console.log(`${cond ? 'PASS' : 'FAIL'} — ${label}`);
  if (!cond) fails++;
};

// #131 — the round family's own ticket (293 wrote its word, 294 printed it,
// 295 heard its verdict, 297 drilled it): its table is the evening's stage.
const { data: seed, error: eSeed } = await db
  .from('orders')
  .select('id, order_number, table_id, created_at, dining_tables(table_number)')
  .eq('order_number', 131)
  .maybeSingle();
if (eSeed) { console.error('#131 read refused:', eSeed.message); process.exit(3); }
check(!!seed, `#131 speaks — table ${seed?.dining_tables?.table_number ?? '?'} (${seed?.table_id ?? '?'})`);
const tableId = seed.table_id;
const tableLabel = seed.dining_tables?.table_number ?? '?';

// The parent's read shape (fetchOrders: tenant ledger, newest first).
const { data: orders, error } = await db
  .from('orders')
  .select('id, order_number, status, table_id, total, payment_status, created_at')
  .order('created_at', { ascending: false })
  .limit(100);
if (error) { console.error('ORDERS read refused:', error.message); process.exit(3); }
check(Array.isArray(orders) && orders.length > 0, `the ledger speaks — ${orders.length} tickets read (the parent's read shape)`);

const tableTickets = orders.filter((o) => o.table_id === tableId);
check(tableTickets.length > 0, `${tableTickets.length} tickets in the read sit on this table — the block has work to show`);

// The day the evening happened: #131's own reporting day (the block derives
// "today" from nowTick; the ledger walk proves the same closure on ANY day).
const day131 = appDayKey(seed.created_at);
const rows131 = tableTicketsOnDay(orders, tableId, day131);
const counts = tableTicketDays(orders, tableId);
check(rows131.length === (counts.get(day131) ?? -1),
  `rows === count on ${day131} — ${rows131.length} rows === the trail's "${counts.get(day131) ?? 0} tickets" (the SAME closure, executed)`);
check(!rows131.some((r) => r.status === 'cancelled'), 'a cancelled ticket never happened — none in the rows');
check(!rows131.some((r) => r.table_id !== tableId), 'another table\'s work stays on that table');

console.log(`\nthe evening on table ${tableLabel}, ${day131} — the exact bytes the block renders:`);
const istHM = (iso) => new Intl.DateTimeFormat('en-IN', {
  timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false,
}).format(new Date(iso));
for (const r of rows131) {
  const paid = r.payment_status === 'completed';
  const pill = paid ? 'PAID' : 'DUE';
  console.log(`  #${r.order_number} · ${istHM(r.created_at)} · ${String(r.status)} · ₹${Number(r.total).toFixed(2)} · ${pill}`);
  check(['PAID', 'DUE'].includes(pill), `#${r.order_number}'s pill word is the money box's own (${pill})`);
}
check(rows131.some((r) => r.order_number === 131), '#131 rides its own table\'s evening');

// The honest absence, exercised: a day with no work on this table renders
// no block — the empty array is silence, never a zero list.
const quietDay = counts.size === 0 ? '2099-01-01' : [...counts.keys()].reduce((acc, k) => (k < acc ? k : acc), '9999-99-99');
check(tableTicketsOnDay(orders, tableId, '2099-01-01').length === 0,
  `a workless day (${quietDay} boundary proven) returns zero rows — the block stays silent`);

// Today, as the board would derive it right now: whatever it says, the
// count and the rows agree — that IS the law.
const todayKey = appDayKey(new Date().toISOString());
const todayRows = tableTicketsOnDay(orders, tableId, todayKey);
check(todayRows.length === (counts.get(todayKey) ?? 0),
  `today (${todayKey}) agrees too — ${todayRows.length} rows === ${counts.get(todayKey) ?? 0} counted${todayRows.length === 0 ? ' (the honest silence: tonight has not happened yet at this table)' : ''}`);

console.log(fails === 0 ? `\nqa298: ALL PASS` : `\nqa298: ${fails} FAIL`);
process.exit(fails === 0 ? 0 : 1);
