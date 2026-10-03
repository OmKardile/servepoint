// qa126-probe: 038 DDL probe + census + book/board state after the 5.86 quiet arc.
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

// Inventory shape (roadmap: auto-deduction was named but needs DDL — check what's really there)
const inv = await db.from('inventory_items').select('id, name, qty, unit', { count: 'exact' }).limit(8);
console.log(`INVENTORY: count=${inv.count} sample=${(inv.data || []).map(i => `${i.name}:${i.qty}${i.unit}`).join(' · ')}`);
const rec = await db.from('recipe_lines').select('id', { count: 'exact', head: true });
console.log('recipe_lines:', rec.count);
