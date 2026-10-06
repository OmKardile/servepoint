// qa337-note-check: read order #133's payload — did the cart-drawer cook note ride?
import { createClient } from '@supabase/supabase-js';
const db = createClient('https://gehjsxopcowmotgrrcgc.supabase.co', 'sb_publishable_igzjkrzX7PLfNI4hlI8p4g_FeqvHI32');
await db.auth.signInWithPassword({ email: 'admin@tsos.dev', password: 'admin123456' });
const { data: ords, error } = await db
  .from('orders')
  .select('id, order_number, status, notes, created_at')
  .order('created_at', { ascending: false })
  .limit(3);
if (error) { console.error('read refused:', error.message); process.exit(1); }
for (const o of ords ?? []) {
  console.log('---', o.order_number, o.status, o.created_at);
  console.log('notes col:', JSON.stringify(o.notes));
  console.log('notes col:', JSON.stringify(o.notes));
}
