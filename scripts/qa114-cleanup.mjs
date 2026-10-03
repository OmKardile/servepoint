// qa114-cleanup: cancel #124 via the guarded engine RPC AS AN AUTHENTICATED OPERATOR
// (qa111-cleanup template). #124 = the drift-chip data-round order (1× Truffle
// Parmesan Fries). The Fries MENU ITEM + RECIPE STAY — honest residue, documented.
import { createClient } from '@supabase/supabase-js';
const db = createClient('https://gehjsxopcowmotgrrcgc.supabase.co', 'sb_publishable_igzjkrzX7PLfNI4hlI8p4g_FeqvHI32');

const { data: sess, error: eAuth } = await db.auth.signInWithPassword({
  email: 'admin@tsos.dev',
  password: 'admin123456',
});
if (eAuth) { console.error('AUTH refused:', eAuth.message); process.exit(2); }
console.log('AUTH ok: operator signed in');

const { data: ord, error: e0 } = await db.from('orders').select('id, order_number, status, payment_status, total').eq('order_number', 124).maybeSingle();
if (e0 || !ord) { console.error('P0 find #124:', e0?.message ?? 'not found'); process.exit(2); }
console.log(`P0 #124: status=${ord.status} payment=${ord.payment_status} total=₹${ord.total}`);

if (ord.status !== 'cancelled') {
  const { data: hop, error: e1 } = await db.rpc('sp_advance_order', { p_order_id: ord.id, p_to_status: 'cancelled' });
  if (e1) { console.error('P1 advance→cancelled REFUSED:', e1.code, e1.message); process.exit(3); }
  console.log('P1 advance→cancelled:', JSON.stringify(hop));
}

const { data: after } = await db.from('orders').select('status, payment_status').eq('id', ord.id).maybeSingle();
console.log(`P2 after: status=${after?.status} payment=${after?.payment_status}`);

const { count: pay } = await db.from('payments').select('id', { count: 'exact', head: true }).eq('order_id', ord.id);
const { count: fb } = await db.from('order_feedback').select('id', { count: 'exact', head: true }).eq('order_id', ord.id);
console.log(`P3 clean: payments=${pay} feedback=${fb}`);

const { count: ocensus } = await db.from('orders').select('id', { count: 'exact', head: true });
console.log(`P4 census (authenticated): orders=${ocensus}`);

const { data: items } = await db.from('menu_items').select('name, price, is_available').eq('name', 'Truffle Parmesan Fries').maybeSingle();
console.log(`P5 fries item stays: ${JSON.stringify(items)}`);
process.exit(0);
