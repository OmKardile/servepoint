// qa309-probe: read-only orientation for Task 309 — who are the CheeseBurg
// staff accounts, and what does the data look like on the surfaces a staff
// round would touch? (the qa308-prepare precedent: publishable client +
// admin@tsos.dev; SELECT-only, mutates nothing)
import { createClient } from '@supabase/supabase-js';

const db = createClient(
  'https://gehjsxopcowmotgrrcgc.supabase.co',
  'sb_publishable_igzjkrzX7PLfNI4hlI8p4g_FeqvHI32'
);
const { error: eAuth } = await db.auth.signInWithPassword({ email: 'admin@tsos.dev', password: 'admin123456' });
if (eAuth) { console.error('AUTH refused:', eAuth.message); process.exit(2); }

const probe = async (label, sel) => {
  const { data, error } = await sel;
  if (error) { console.log(label, 'REFUSED:', error.message); return null; }
  console.log(label, JSON.stringify(data, null, 1).slice(0, 1200));
  return data;
};

await probe('TENANTS:', db.from('tenants').select('id, name, slug, status').limit(5));
await probe('STAFF:', db.from('staff').select('id, tenant_id, name, email, role, is_active').limit(10));
await probe('USERS:', db.from('users').select('id, tenant_id, email, role').limit(10));
await probe('TABLES:', db.from('dining_tables').select('id, table_number, status, qr_token').order('table_number').limit(8));
await probe('SESSIONS:', db.from('table_sessions').select('id, status, started_at, expires_at').order('started_at', { ascending: false }).limit(5));
await probe('ORDERS:', db.from('orders').select('id, order_number, status, payment_status, total_amount, created_at').order('created_at', { ascending: false }).limit(6));
await probe('MENU:', db.from('menu_items').select('id, name, price, is_available').limit(8));
await probe('RESERVATIONS:', db.from('reservations').select('id, guest_name, reservation_time, status').order('reservation_time', { ascending: false }).limit(5));
await probe('INVENTORY:', db.from('inventory_items').select('id, name, current_stock, min_stock, unit').limit(8));
await probe('OFFERS:', db.from('offers').select('id, title, discount_type, discount_value, is_active').limit(5));
process.exit(0);
