// QA133 probe — today's live order items vs the Trending card (login first: RLS).
// Login-first rule (Task 128): anon reads of payments/customers return real 0s.
import { createClient } from '@supabase/supabase-js';

const URL = 'https://gehjsxopcowmotgrrcgc.supabase.co';
const KEY = 'sb_publishable_igzjkrzX7PLfNI4hlI8p4g_FeqvHI32';

const supabase = createClient(URL, KEY);

const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({
  email: 'admin@tsos.dev',
  password: 'admin123456',
});
if (authErr || !auth?.user) {
  console.log(JSON.stringify({ auth: 'FAILED', err: authErr?.message }));
  process.exit(1);
}
const tenantId = auth.user.user_metadata?.tenant_id ?? auth.user.user_metadata?.current_tenant_id;
console.log(JSON.stringify({ auth: 'ok', tenantId }));

// today per the app's own grammar: IST calendar day (en-CA) on created_at
const todayKeyIst = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

const { data: orders, error: oErr } = await supabase
  .from('orders')
  .select('id, order_number, status, payment_status, total, created_at')
  .order('created_at', { ascending: true });
if (oErr) {
  console.log(JSON.stringify({ orders: 'ERR', err: oErr.message }));
  process.exit(1);
}
const todayOrders = (orders || []).filter(
  (o) => new Date(o.created_at).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }) === todayKeyIst
);
const live = todayOrders.filter((o) => o.status !== 'cancelled');
console.log(JSON.stringify({
  allOrders: (orders || []).length,
  todayOrders: todayOrders.length,
  liveToday: live.map((o) => ({ n: o.order_number, s: o.status, total: o.total })),
}));

const liveIds = live.map((o) => o.id);
if (liveIds.length === 0) {
  console.log(JSON.stringify({ items: [] }));
  process.exit(0);
}
const { data: items } = await supabase
  .from('order_items')
  .select('name, qty, order_id')
  .in('order_id', liveIds);
const counts = {};
(items || []).forEach((it) => {
  counts[it.name] = (counts[it.name] || 0) + (Number(it.qty) || 1);
});
console.log(JSON.stringify({ liveItemsToday: counts }, null, 1));
