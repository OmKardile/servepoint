// qa121-floor-drift: locate the floor's stale-hold mechanism.
import { createClient } from '@supabase/supabase-js';
const db = createClient('https://gehjsxopcowmotgrrcgc.supabase.co', 'sb_publishable_igzjkrzX7PLfNI4hlI8p4g_FeqvHI32');
await db.auth.signInWithPassword({ email: 'admin@tsos.dev', password: 'admin123456' });
const { data: locs } = await db.from('locations').select('id, name');
console.log('LOCATIONS:', locs?.map(l => `${l.name}=${l.id.slice(0,8)}`).join(' · '));
const { data: tables } = await db.from('dining_tables').select('table_number, location_id, status, active_order_id').order('table_number');
for (const t of tables || []) {
  const loc = locs?.find(l => l.id === t.location_id);
  console.log(`TABLE ${t.table_number}: loc=${loc ? loc.name : 'UNKNOWN!'}(${t.location_id?.slice(0,8)}) status=${t.status} active=${t.active_order_id?.slice(0,8)}`);
}
// What orders do the active_order_ids point to?
const { data: acts } = await db.from('orders').select('id, order_number, status, payment_status').in('id', tables.filter(t => t.active_order_id).map(t => t.active_order_id));
console.log('ACTIVE-ORDER-TARGETS:', acts?.map(r => `${r.id.slice(0,8)}=#${r.order_number}:${r.status}/${r.payment_status}`).join(' · '));
// Any order still holding a table while completed+paid?
const { data: holds } = await db.from('orders').select('order_number, table_id, status, payment_status, total').eq('status', 'completed').not('table_id', 'is', null).order('order_number', { ascending: false }).limit(5);
console.log('RECENT-COMPLETED-TABLE-ORDERS:', holds?.map(r => `#${r.order_number}:${r.payment_status}`).join(' · '));
