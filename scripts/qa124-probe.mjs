// qa124-probe: 038 DDL probe + census + book state (promise clock reality check).
import { createClient } from '@supabase/supabase-js';
const db = createClient('https://gehjsxopcowmotgrrcgc.supabase.co', 'sb_publishable_igzjkrzX7PLfNI4hlI8p4g_FeqvHI32');
const { error: eAuth } = await db.auth.signInWithPassword({ email: 'admin@tsos.dev', password: 'admin123456' });
if (eAuth) { console.error('AUTH refused:', eAuth.message); process.exit(2); }

const { data: cust, error: e038 } = await db.from('customers').select('id, birthday_md').limit(1);
console.log('038 birthday_md:', e038 ? `ABSENT (${e038.code})` : 'PRESENT');

const [o, p, t, c] = await Promise.all([
  db.from('orders').select('id', { count: 'exact', head: true }),
  db.from('payments').select('id', { count: 'exact', head: true }),
  db.from('order_items').select('id', { count: 'exact', head: true }),
  db.from('customers').select('id', { count: 'exact', head: true }),
]);
console.log(`CENSUS: orders=${o.count} payments=${p.count} order_items=${t.count} customers=${c.count}`);

const { data: rows } = await db.from('reservations').select('guest_name, slot_at, status, table_id').order('slot_at');
const tables = await db.from('dining_tables').select('id, table_number, status').eq('tenant_id', 'd207be19-e86f-4780-befb-3968831a38fe');
const tName = new Map((tables.data || []).map(t => [t.id, `${t.table_number}(${t.status})`]));
console.log('BOOK:', (rows || []).map(r => `${r.guest_name}:${r.status}@${r.slot_at}${r.table_id ? '@' + (tName.get(r.table_id) || '??') : ''}`).join(' · '));
console.log('IST now:', new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }));
console.log('TABLES:', (tables.data || []).map(t => `${t.table_number}(${t.status})`).join(' · '));
