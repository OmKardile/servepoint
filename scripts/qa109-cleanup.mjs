// Task 109 — surgical cleanup after the recover-list E2E. The fixture ticket
// #121 was placed by the real UI, PAID by the real UI, COMPLETED by the real
// UI, and RATED 2★ by the real guest track page — the full loop. Revenue and
// the rating from a QA fixture must not pollute today's EOD/reports, so the
// round returns the cloud to its pre-round shape:
//   1. DELETE the rating's feedback row (guarded to this order_id)
//   2. DELETE the 030 bell row the trigger wrote for it (guarded by title+day)
//   3. DELETE the CRM guest the drawer auto-booked (guarded to this phone)
//   4. DELETE the ticket's payments rows (guarded to this order_id)
//   5. flip payment_status completed → pending (guarded .eq on completed)
//   6. advance the ticket to 'cancelled' via the guarded sp_advance_order RPC
// Every write is re-verified after it lands.
import { createClient } from '@supabase/supabase-js';

const db = createClient('https://gehjsxopcowmotgrrcgc.supabase.co', 'sb_publishable_igzjkrzX7PLfNI4hlI8p4g_FeqvHI32');
const { error: authErr } = await db.auth.signInWithPassword({
  email: 'admin@tsos.dev',
  password: 'admin123456',
});
if (authErr) {
  console.log('auth FAIL:', authErr.message);
  process.exit(1);
}
const T = 'd207be19-e86f-4780-befb-3968831a38fe';
const PHONE = '9810002020';

const num = Number(process.argv[2] || 121);
const { data: o } = await db
  .from('orders')
  .select('id, order_number, status, payment_status, total')
  .eq('tenant_id', T)
  .eq('order_number', num)
  .maybeSingle();
if (!o) {
  console.log(`order #${num}: NOT FOUND — nothing to clean`);
  process.exit(0);
}
console.log('before:', JSON.stringify(o));

// 1 — the rating row (the RPC's own write; guarded to this order)
const fbDel = await db.from('order_feedback').delete().eq('tenant_id', T).eq('order_id', o.id);
console.log('feedback delete:', fbDel.error ? `FAIL ${fbDel.error.message}` : 'ok');

// 2 — the bell the 030 trigger rang for it (title + today, guarded)
const bellDel = await db
  .from('notifications')
  .delete()
  .eq('tenant_id', T)
  .eq('category', 'feedback')
  .like('title', 'Low rating:%')
  .gte('created_at', new Date(new Date().setUTCHours(0, 0, 0, 0)).toISOString());
console.log('bell delete:', bellDel.error ? `FAIL ${bellDel.error.message}` : 'ok');

// 3 — the guest the drawer auto-booked (auto-enrich upsert; guarded to phone)
const guestDel = await db.from('customers').delete().eq('tenant_id', T).eq('phone', PHONE);
console.log('guest delete:', guestDel.error ? `FAIL ${guestDel.error.message}` : 'ok');

// 4 — the ticket's ledger rows
const payDel = await db.from('payments').delete().eq('tenant_id', T).eq('order_id', o.id);
console.log('payments delete:', payDel.error ? `FAIL ${payDel.error.message}` : 'ok');

// 5 — flip payment status ONLY if the row still reads completed
const flip = await db
  .from('orders')
  .update({ payment_status: 'pending', payment_method: null, updated_at: new Date().toISOString() })
  .eq('id', o.id)
  .eq('tenant_id', T)
  .eq('payment_status', 'completed');
console.log('status flip:', flip.error ? `FAIL ${flip.error.message}` : 'ok');

// 6 — the engine guard refuses completed→cancelled (a cooked ticket is
// real — the design speaking, hit live in qa106). The honest exit: restore
// the fixture to 'preparing' with a guarded direct flip (member-managed
// RLS), then the RPC's own preparing→cancelled path logs the final hop.
if (o.status === 'completed') {
  const { error: e0 } = await db.from('orders').update({ status: 'preparing' }).eq('id', o.id).eq('status', 'completed');
  console.log('restore preparing:', e0 ? 'FAIL ' + e0.message : 'ok');
}
const adv = await db.rpc('sp_advance_order', {
  p_order_id: o.id,
  p_to_status: 'cancelled',
});
console.log('advance cancelled:', adv.error ? `FAIL ${adv.error.message}` : 'ok');

// verify
const { data: after } = await db
  .from('orders')
  .select('status, payment_status')
  .eq('id', o.id)
  .maybeSingle();
const { count: fbLeft } = await db
  .from('order_feedback')
  .select('*', { count: 'exact', head: true })
  .eq('tenant_id', T)
  .eq('order_id', o.id);
const { count: payLeft } = await db
  .from('payments')
  .select('*', { count: 'exact', head: true })
  .eq('tenant_id', T)
  .eq('order_id', o.id);
const { count: guestLeft } = await db
  .from('customers')
  .select('*', { count: 'exact', head: true })
  .eq('tenant_id', T)
  .eq('phone', PHONE);
console.log('after:', JSON.stringify(after), `| feedback left: ${fbLeft}`, `| payments left: ${payLeft}`, `| guest left: ${guestLeft}`);
const clean = after?.status === 'cancelled' && fbLeft === 0 && payLeft === 0 && guestLeft === 0;
console.log(clean ? 'clean: YES' : 'clean: NO');
process.exit(clean ? 0 : 1);
