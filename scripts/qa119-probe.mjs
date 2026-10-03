// qa117-probe: 038 birthday_md DDL probe + authenticated census (RLS template).
import { createClient } from '@supabase/supabase-js';
const db = createClient('https://gehjsxopcowmotgrrcgc.supabase.co', 'sb_publishable_igzjkrzX7PLfNI4hlI8p4g_FeqvHI32');
const { error: eAuth } = await db.auth.signInWithPassword({ email: 'admin@tsos.dev', password: 'admin123456' });
if (eAuth) { console.error('AUTH refused:', eAuth.message); process.exit(2); }

// 038 probe: birthday_md on customers
const { data: cust, error: e038 } = await db.from('customers').select('id, birthday_md').limit(1);
console.log('038 birthday_md:', e038 ? `ABSENT (${e038.code})` : 'PRESENT');
if (e038) console.log('  detail:', e038.message);

// Census
const [o, p, t, c] = await Promise.all([
  db.from('orders').select('id', { count: 'exact', head: true }),
  db.from('payments').select('id', { count: 'exact', head: true }),
  db.from('order_items').select('id', { count: 'exact', head: true }),
  db.from('customers').select('id', { count: 'exact', head: true }),
]);
console.log(`CENSUS: orders=${o.count} payments=${p.count} order_items=${t.count} customers=${c.count}`);

// What's on the board right now (live status mix) — helps QA orientation
const { data: live } = await db.from('orders').select('order_number, status, payment_status')
  .in('status', ['new', 'pending', 'preparing', 'ready', 'served', 'completed']).order('order_number', { ascending: false }).limit(12);
console.log('LIVE tickets:', live?.map(r => `#${r.order_number}:${r.status}/${r.payment_status}`).join(' · ') || 'none');
