// qa295-feedback-state: read the order_feedback ledger as the admin (superadmin
// RLS) — the same read the counter's verdict row will perform per order.
import { createClient } from '@supabase/supabase-js';
const db = createClient('https://gehjsxopcowmotgrrcgc.supabase.co', 'sb_publishable_igzjkrzX7PLfNI4hlI8p4g_FeqvHI32');
const { error: eAuth } = await db.auth.signInWithPassword({ email: 'admin@tsos.dev', password: 'admin123456' });
if (eAuth) { console.error('AUTH refused:', eAuth.message); process.exit(2); }

const { data: fb, error } = await db
  .from('order_feedback')
  .select('order_id, rating, comment, created_at, orders(order_number)')
  .order('created_at', { ascending: false })
  .limit(10);
if (error) { console.error('FEEDBACK refused:', error.message); process.exit(3); }
console.log('feedback rows:', JSON.stringify(fb, null, 1));
console.log('count:', (fb || []).length);
