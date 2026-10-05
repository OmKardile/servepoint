// qa296-identity: which real orders carry customer identity (for the CRM verdict read)
import { createClient } from '@supabase/supabase-js';
const db = createClient('https://gehjsxopcowmotgrrcgc.supabase.co', 'sb_publishable_igzjkrzX7PLfNI4hlI8p4g_FeqvHI32');
const { error: eAuth } = await db.auth.signInWithPassword({ email: 'admin@tsos.dev', password: 'admin123456' });
if (eAuth) { console.error('AUTH refused:', eAuth.message); process.exit(2); }

const { data: rows, error } = await db
  .from('order_feedback')
  .select('rating, comment, created_at, orders(order_number, customer_name, customer_phone, order_type)')
  .order('created_at', { ascending: false })
  .limit(5);
if (error) { console.error('READ refused:', error.message); process.exit(3); }
console.log(JSON.stringify(rows, null, 1));
