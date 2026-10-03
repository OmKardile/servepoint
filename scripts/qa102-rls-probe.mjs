// Task 102 probe — why does the browser's payments INSERT hit RLS?
// Sign in as admin@tsos.dev via supabase-js and attempt a minimal insert
// (₹0.01) on order #113; delete it immediately if it lands. Also print
// auth.uid() / membership from the session's point of view.
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
console.log('auth.uid:', auth.user.id);

const { data: who } = await db.rpc('sp_tenant_member', { p_tenant_id: T });
console.log('sp_tenant_member →', who);

const { data: o } = await db
  .from('orders')
  .select('id, order_number')
  .eq('tenant_id', T)
  .eq('order_number', 113)
  .maybeSingle();
if (!o) {
  console.log('order #113 not found');
  process.exit(1);
}

const ins = await db.from('payments').insert({
  tenant_id: T,
  order_id: o.id,
  method: 'cash',
  amount: 0.01,
  status: 'paid',
  confirmed_by_email: 'admin@tsos.dev',
});
if (ins.error) {
  console.log('insert FAIL:', ins.error.code, ins.error.message);
} else {
  console.log('insert OK — cleaning the probe row');
  const del = await db
    .from('payments')
    .delete()
    .eq('tenant_id', T)
    .eq('order_id', o.id)
    .eq('amount', 0.01);
  console.log('probe delete:', del.error ? `FAIL ${del.error.message}` : 'ok');
}
await db.auth.signOut();
