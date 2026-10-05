// qa287-order-id: pick ONE order uuid for the track-page E2E (newest, with a
// status the pager can render), then prove the RPC returns created_at for it.
import { createClient } from '@supabase/supabase-js';
const db = createClient('https://gehjsxopcowmotgrrcgc.supabase.co', 'sb_publishable_igzjkrzX7PLfNI4hlI8p4g_FeqvHI32');
const { error: eAuth } = await db.auth.signInWithPassword({ email: 'admin@tsos.dev', password: 'admin123456' });
if (eAuth) { console.error('AUTH refused:', eAuth.message); process.exit(2); }

const { data: rows, error } = await db
  .from('orders')
  .select('id, order_number, status, payment_status, created_at')
  .order('created_at', { ascending: false })
  .limit(5);
if (error) { console.error('ORDERS refused:', error.message); process.exit(3); }
console.log('newest 5:', JSON.stringify(rows, null, 1));

const pick = rows.find((r) => r.status && r.status !== 'cancelled') || rows[0];
if (!pick) { console.error('no orders at all'); process.exit(4); }

// the exact read the guest pager makes — anonymous (signed OUT), the RPC is
// the guest's capability: no session, only the uuid.
const anon = createClient('https://gehjsxopcowmotgrrcgc.supabase.co', 'sb_publishable_igzjkrzX7PLfNI4hlI8p4g_FeqvHI32');
const { data: pub, error: pubErr } = await anon.rpc('sp_get_public_order', { p_order_id: pick.id });
console.log('PICK:', pick.id, `#${pick.order_number}`, pick.status, pick.created_at);
console.log('anon RPC:', pubErr ? `REFUSED: ${pubErr.message}` : pub?.is_valid ? `VALID — created_at=${pub.order?.created_at} status=${pub.order?.status}` : `invalid: ${pub?.error}`);
console.log('TRACK_URL:', `http://127.0.0.1:3000/track/${pick.id}`);
