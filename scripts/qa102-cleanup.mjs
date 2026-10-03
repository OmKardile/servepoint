// Task 102 — surgical cleanup after the split-bill E2E. The fixture ticket
// was settled in TWO parts (cash + upi) by the real UI; revenue from a QA
// fixture must not pollute today's EOD/reports, so the round returns the
// cloud to its pre-round shape:
//   1. DELETE the ticket's payments rows (guarded to this order_id only)
//   2. flip payment_status completed → pending (guarded .eq on completed)
//   3. advance the ticket to 'cancelled' via the guarded sp_advance_order
//      RPC (legal transition map + append-only history trigger), the same
//      honest cancellation every QA-era leftover row carries.
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

const num = Number(process.argv[2]);
if (!num) {
  console.log('usage: node scripts/qa102-cleanup.mjs <orderNumber>');
  process.exit(1);
}

const { data: o } = await db
  .from('orders')
  .select('id, order_number, status, payment_status, payment_method, total')
  .eq('tenant_id', T)
  .eq('order_number', num)
  .maybeSingle();
if (!o) {
  console.log(`order #${num}: NOT FOUND — nothing to clean`);
  process.exit(0);
}
console.log('before:', JSON.stringify(o));

// 1 — delete this ticket's ledger rows (guarded: order_id + tenant)
const del = await db
  .from('payments')
  .delete()
  .eq('tenant_id', T)
  .eq('order_id', o.id);
console.log('payments delete:', del.error ? `FAIL ${del.error.message}` : 'ok');

// 2 — flip payment status ONLY if the row still reads completed
const flip = await db
  .from('orders')
  .update({ payment_status: 'pending', payment_method: null, updated_at: new Date().toISOString() })
  .eq('id', o.id)
  .eq('tenant_id', T)
  .eq('payment_status', 'completed');
console.log('status flip:', flip.error ? `FAIL ${flip.error.message}` : 'ok');

// 3 — cancel through the guarded engine RPC (writes honest history)
const adv = await db.rpc('sp_advance_order', {
  p_order_id: o.id,
  p_to_status: 'cancelled',
});
console.log('advance cancelled:', adv.error ? `FAIL ${adv.error.message}` : 'ok');

const { data: after } = await db
  .from('orders')
  .select('status, payment_status, payment_method')
  .eq('id', o.id)
  .single();
const { data: rows } = await db
  .from('payments')
  .select('id')
  .eq('order_id', o.id);
console.log('after:', JSON.stringify(after), '| ledger rows left:', (rows || []).length);
console.log('clean:', !del.error && !flip.error && !adv.error && after?.status === 'cancelled' && (rows || []).length === 0 ? 'YES' : 'CHECK ABOVE');
await db.auth.signOut();
