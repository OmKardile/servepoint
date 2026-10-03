// qa115-cleanup: cancel the notes-test ticket #125 (honest cancelled row).
// Authenticated template (RLS hardening). Payments/feedback must stay 0.
import { createClient } from '@supabase/supabase-js';
const db = createClient('https://gehjsxopcowmotgrrcgc.supabase.co', 'sb_publishable_igzjkrzX7PLfNI4hlI8p4g_FeqvHI32');
const { error: eAuth } = await db.auth.signInWithPassword({ email: 'admin@tsos.dev', password: 'admin123456' });
if (eAuth) { console.error('AUTH refused:', eAuth.message); process.exit(2); }

const { data: ord } = await db.from('orders').select('id, order_number, status, payment_status').eq('order_number', 125).maybeSingle();
if (!ord) { console.error('order 125 not found'); process.exit(1); }
console.log(`P0 #125: status=${ord.status} payment=${ord.payment_status}`);

if (ord.status !== 'cancelled') {
  const { data: hop, error: e1 } = await db.rpc('sp_advance_order', { p_order_id: ord.id, p_to_status: 'cancelled' });
  if (e1) { console.error('P1 advance→cancelled REFUSED:', e1.code, e1.message); process.exit(3); }
  console.log('P1 advance→cancelled:', JSON.stringify(hop));
} else {
  console.log('P1 already cancelled — no-op');
}

const { data: after } = await db.from('orders').select('status, payment_status').eq('id', ord.id).maybeSingle();
console.log(`P2 after: status=${after?.status} payment=${after?.payment_status}`);

const { count: pay } = await db.from('payments').select('id', { count: 'exact', head: true }).eq('order_id', ord.id);
const { count: fb } = await db.from('order_feedback').select('id', { count: 'exact', head: true }).eq('order_id', ord.id);
console.log(`P3 orphans: payments=${pay} feedback=${fb}`);

const [o, p] = await Promise.all([
  db.from('orders').select('id', { count: 'exact', head: true }),
  db.from('payments').select('id', { count: 'exact', head: true }),
]);
console.log(`P4 census(auth): orders ${o.count} · payments ${p.count}`);
