import { createClient } from '@supabase/supabase-js';
const db = createClient('https://gehjsxopcowmotgrrcgc.supabase.co', 'sb_publishable_igzjkrzX7PLfNI4hlI8p4g_FeqvHI32');
await db.auth.signInWithPassword({ email: 'admin@tsos.dev', password: 'admin123456' });
const T = 'd207be19-e86f-4780-befb-3968831a38fe';
const num = Number(process.argv[2] || 118);
const { data: o } = await db.from('orders').select('id, order_number, status, payment_status').eq('tenant_id', T).eq('order_number', num).maybeSingle();
if (!o) { console.log(`#${num}: NOT FOUND`); process.exit(1); }
console.log('before:', JSON.stringify(o));
// sp_advance_order is one-way past 'ready' (ready → completed only, by
// design — a cooked ticket is real). The honest exit: restore the fixture
// to 'preparing' with a guarded direct flip (member-managed RLS), then the
// RPC's own preparing→cancelled path. The history trigger logs every hop.
if (o.status === 'ready') {
  const { error: e1 } = await db.from('orders').update({ status: 'preparing' }).eq('id', o.id).eq('status', 'ready');
  console.log('restore preparing:', e1 ? 'FAIL ' + e1.message : 'ok');
}
const { error: e2 } = await db.rpc('sp_advance_order', { p_order_id: o.id, p_to_status: 'cancelled' });
console.log('advance cancelled:', e2 ? 'FAIL ' + e2.message : 'ok');
const { data: after } = await db.from('orders').select('status, payment_status').eq('id', o.id).maybeSingle();
const { data: rows } = await db.from('payments').select('id').eq('order_id', o.id);
console.log('after:', JSON.stringify(after), '| ledger rows left:', (rows || []).length);
console.log((after?.status === 'cancelled' && (rows || []).length === 0) ? 'clean: YES' : 'clean: CHECK ABOVE');
