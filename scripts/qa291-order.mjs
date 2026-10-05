// qa291-order: pick a recent real order id for the guest track-page walk.
import { createClient } from '@supabase/supabase-js';
const db = createClient('https://gehjsxopcowmotgrrcgc.supabase.co', 'sb_publishable_igzjkrzX7PLfNI4hlI8p4g_FeqvHI32');
const { error: eAuth } = await db.auth.signInWithPassword({ email: 'admin@tsos.dev', password: 'admin123456' });
if (eAuth) { console.error('AUTH refused:', eAuth.message); process.exit(2); }

const { data: orders, error } = await db
  .from('orders')
  .select('id, order_number, status, payment_status, order_type, created_at')
  .order('created_at', { ascending: false })
  .limit(5);
if (error) { console.error('ORDERS refused:', error.message); process.exit(3); }
console.log('orders:', JSON.stringify(orders, null, 1));
const pick = orders.find((o) => o.status !== 'cancelled');
if (pick) console.log('TRACK_URL:', `http://127.0.0.1:3000/track/${pick.id}`);
