// qa122-floor-day2: hand-compute 2 Oct IST floor rounds (QR Flow Cafe tenant-scoped like the app).
import { createClient } from '@supabase/supabase-js';
const db = createClient('https://gehjsxopcowmotgrrcgc.supabase.co', 'sb_publishable_igzjkrzX7PLfNI4hlI8p4g_FeqvHI32');
await db.auth.signInWithPassword({ email: 'admin@tsos.dev', password: 'admin123456' });
const { data: tenants } = await db.from('tenants').select('id, name').eq('name', 'QR Flow Cafe');
const tid = tenants[0].id;
const startIso = '2026-10-01T18:30:00+00:00', endIso = '2026-10-02T18:30:00+00:00';
const { data: orders } = await db.from('orders')
  .select('id, order_number, status, total, table_id, dining_tables(table_number)')
  .eq('tenant_id', tid)
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
console.log(`2OCT FLOOR-DAY: rounds=${rounds.length} rupees=${rupees.toFixed(2)} busiest=${busiest ? `${busiest.label} · ${busiest.rounds} rounds · ₹${busiest.rupees.toFixed(2)}` : 'none'}`);
console.log('ROUNDS:', rounds.map(o => `#${o.order_number}:${o.status}/tbl=${o.dining_tables?.table_number}/₹${o.total}`).join(' · '));
const { data: rs } = await db.from('reservations').select('guest_name, slot_at, status').eq('tenant_id', tid).gte('slot_at', startIso).lt('slot_at', endIso);
console.log(`2OCT NO-SHOWS: ${(rs || []).filter(r => r.status === 'no_show').length}`, (rs || []).map(r => `${r.guest_name}:${r.status}`).join(' · ') || '(no bookings)');
