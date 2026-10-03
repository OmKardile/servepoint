// Task 108 — read-only truth probe for the check-clock round.
// The fixture ticket's hops (fire/ready) + every item line's checked_at,
// so the UI's own-clock spans can be verified seconds-true.
// Usage: node scripts/qa108-truth.mjs [orderNumber]
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
const T = 'd207be19-e86f-4780-befb-3968831a38fe';

const num = process.argv[2] ? Number(process.argv[2]) : null;

// census first
const { count: ordersCount } = await db.from('orders').select('*', { count: 'exact', head: true }).eq('tenant_id', T);
const { count: paymentsCount } = await db.from('payments').select('*', { count: 'exact', head: true }).eq('tenant_id', T);
console.log(`census: orders=${ordersCount} payments=${paymentsCount}`);

if (!num) {
  console.log('(no order number given — census only)');
  process.exit(0);
}

const { data: ord, error: oErr } = await db
  .from('orders')
  .select('id, order_number, status, payment_status, created_at, total')
  .eq('tenant_id', T)
  .eq('order_number', num)
  .maybeSingle();
if (oErr || !ord) {
  console.log('order lookup FAIL:', oErr?.message || `#${num} not found`);
  process.exit(1);
}
console.log(`order #${ord.order_number}: status=${ord.status} payment=${ord.payment_status} total=${ord.total}`);

const { data: items } = await db
  .from('order_items')
  .select('id, name, variant_name, qty, checked_at')
  .eq('order_id', ord.id)
  .order('name');
console.log('items:');
for (const it of items || []) {
  console.log(`  - ${it.name}${it.variant_name ? ` · ${it.variant_name}` : ''} ×${it.qty} checked_at=${it.checked_at ?? 'NULL'}`);
}

const { data: hops, error: hErr } = await db
  .from('order_status_history')
  .select('from_status, to_status, created_at')
  .eq('order_id', ord.id)
  .order('created_at', { ascending: true });
if (hErr) console.log('hops read FAIL:', hErr.message);
const fire = (hops || []).find((h) => h.to_status === 'preparing');
const ready = (hops || []).find((h) => h.to_status === 'ready' || h.to_status === 'completed');
console.log('hops:');
for (const h of hops || []) console.log(`  ${h.from_status} > ${h.to_status} @ ${h.created_at}`);
if (fire) {
  const fMs = new Date(fire.created_at).getTime();
  console.log(`fired: ${fire.created_at}`);
  if (ready) console.log(`ready: ${ready.created_at} (ticket span ${(new Date(ready.created_at).getTime() - fMs) / 1000}s)`);
  for (const it of items || []) {
    if (it.checked_at) {
      const cMs = new Date(it.checked_at).getTime();
      const sec = Math.round((cMs - fMs) / 1000);
      console.log(`own clock ${it.name}${it.variant_name ? ` · ${it.variant_name}` : ''}: ${sec}s after fire`);
    } else {
      console.log(`own clock ${it.name}: UNTICKED`);
    }
  }
} else {
  console.log('no preparing hop — ticket never fired');
}
