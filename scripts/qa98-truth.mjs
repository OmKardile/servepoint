// Task 98 — read-only truth: tables + live orders around the move E2E.
// NO writes — the E2E must go through the real UI, this only watches.
import { createClient } from '@supabase/supabase-js';

const db = createClient('https://gehjsxopcowmotgrrcgc.supabase.co', 'sb_publishable_igzjkrzX7PLfNI4hlI8p4g_FeqvHI32');
const { data: auth, error: authErr } = await db.auth.signInWithPassword({
  email: 'admin@tsos.dev',
  password: 'admin123456',
});
if (authErr) {
  console.log('auth FAIL:', authErr.message);
  process.exit(1);
}
console.log('auth:', auth.user?.email);

const T = 'd207be19-e86f-4780-befb-3968831a38fe';
const { data: tables, error: tErr } = await db
  .from('dining_tables')
  .select('id, table_number, status, active_order_id, capacity, section')
  .eq('tenant_id', T)
  .order('table_number');
if (tErr) console.log('tables read FAIL:', tErr.message);
console.log('tables:', tables?.length ?? 0);
for (const t of tables ?? []) {
  console.log(`  T${t.table_number} [${t.status}] cap=${t.capacity} sec=${t.section || '-'} active=${t.active_order_id ? t.active_order_id.slice(0, 8) : '-'}`);
}

const { data: live } = await db
  .from('orders')
  .select('id, order_number, status, table_id, payment_status, total')
  .eq('tenant_id', T)
  .in('status', ['new', 'pending', 'preparing', 'ready'])
  .order('order_number', { ascending: false })
  .limit(5);
console.log('live orders:', live?.length ?? 0);
for (const o of live ?? []) {
  console.log(`  #${o.order_number} [${o.status}] table=${o.table_id ? o.table_id.slice(0, 8) : '-'} ₹${o.total}`);
}

const { count } = await db.from('orders').select('*', { count: 'exact', head: true }).eq('tenant_id', T);
console.log('orders census:', count);

const { data: books } = await db
  .from('reservations')
  .select('guest_name, party_size, status, table_id, slot_at')
  .eq('tenant_id', T)
  .order('slot_at', { ascending: false })
  .limit(6);
console.log('reservations (latest 6):');
for (const b of books ?? []) {
  console.log(`  ${b.guest_name} x${b.party_size} [${b.status}] table=${b.table_id ? b.table_id.slice(0, 8) : '-'} slot=${String(b.slot_at).slice(0, 16)}`);
}
