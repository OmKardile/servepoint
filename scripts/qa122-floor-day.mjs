// qa122-floor-day: hand-compute the day's floor rounds BEFORE rendering (IST day = 3 Oct).
import { createClient } from '@supabase/supabase-js';
const db = createClient('https://gehjsxopcowmotgrrcgc.supabase.co', 'sb_publishable_igzjkrzX7PLfNI4hlI8p4g_FeqvHI32');
await db.auth.signInWithPassword({ email: 'admin@tsos.dev', password: 'admin123456' });
// IST day bounds for 2026-10-03 (IST = UTC+5:30): 2026-10-02T18:30:00Z → 2026-10-03T18:30:00Z
const startIso = '2026-10-02T18:30:00+00:00', endIso = '2026-10-03T18:30:00+00:00';
const { data: orders } = await db.from('orders')
  .select('id, order_number, status, total, table_id, created_at, dining_tables(table_number)')
  .gte('created_at', startIso).lt('created_at', endIso)
  .order('created_at');
const rounds = (orders || []).filter(o => o.table_id && o.status !== 'cancelled');
let rupees = 0;
const byTable = new Map();
for (const o of rounds) {
  const amt = Number(o.total || 0);
  rupees += amt;
  const label = o.dining_tables?.table_number || 'Table';
  const cur = byTable.get(o.table_id) || { label, rupees: 0, rounds: 0 };
  cur.rupees += amt; cur.rounds += 1;
  byTable.set(o.table_id, cur);
}
const busiest = [...byTable.values()].sort((a, b) => b.rupees - a.rupees || b.rounds - a.rounds || a.label.localeCompare(b.label))[0] || null;
console.log('TODAY-ORDERS:', (orders || []).map(o => `#${o.order_number}:${o.status}/tbl=${o.dining_tables?.table_number || '-'}/₹${o.total}`).join(' · '));
console.log(`FLOOR-DAY: rounds=${rounds.length} rupees=${rupees.toFixed(2)} busiest=${busiest ? `${busiest.label} · ${busiest.rounds} rounds · ₹${busiest.rupees.toFixed(2)}` : 'none'}`);
const { data: rs } = await db.from('reservations').select('guest_name, slot_at, status').gte('slot_at', startIso).lt('slot_at', endIso);
console.log('BOOK-TODAY:', (rs || []).map(r => `${r.guest_name}:${r.status}@${r.slot_at.slice(11,16)}`).join(' · ') || 'none');
console.log(`NO-SHOWS-TODAY: ${(rs || []).filter(r => r.status === 'no_show').length}`);
