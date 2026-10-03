import { createClient } from '@supabase/supabase-js';
const db = createClient('https://gehjsxopcowmotgrrcgc.supabase.co', 'sb_publishable_igzjkrzX7PLfNI4hlI8p4g_FeqvHI32');
await db.auth.signInWithPassword({ email: 'admin@tsos.dev', password: 'admin123456' });
const { data: t1 } = await db.from('dining_tables').select('table_number, status, active_order_id').eq('table_number', 'T1').maybeSingle();
console.log('T1 ROW:', JSON.stringify(t1));
const [o, p, t, c] = await Promise.all([
  db.from('orders').select('id', { count: 'exact', head: true }),
  db.from('payments').select('id', { count: 'exact', head: true }),
  db.from('order_items').select('id', { count: 'exact', head: true }),
  db.from('customers').select('id', { count: 'exact', head: true }),
]);
console.log(`CENSUS: orders=${o.count} payments=${p.count} order_items=${t.count} customers=${c.count}`);
