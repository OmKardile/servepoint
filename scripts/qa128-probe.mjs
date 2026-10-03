// Task 128 probe: 038 birthday_md check + census + offers/customers/settings tables shape
import { createClient } from '@supabase/supabase-js';

// Same credentials the app itself uses (src/lib/supabase.ts hardcoded fallbacks)
const url = 'https://gehjsxopcowmotgrrcgc.supabase.co';
const key = 'sb_publishable_igzjkrzX7PLfNI4hlI8p4g_FeqvHI32';
const sb = createClient(url, key);

// RLS requires an authenticated operator — anon key sees only permissive tables (orders/order_items)
const { error: eAuth } = await sb.auth.signInWithPassword({ email: 'admin@tsos.dev', password: 'admin123456' });
if (eAuth) { console.error('AUTH refused:', eAuth.message); process.exit(2); }

async function probe(label, fn) {
  try {
    const r = await fn();
    if (r.error) console.log(label, 'ERR', r.error.code, r.error.message.slice(0, 90));
    else console.log(label, 'OK', r.count !== null && r.count !== undefined ? `count=${r.count}` : JSON.stringify(r.data).slice(0, 240));
  } catch (e) {
    console.log(label, 'THROW', String(e).slice(0, 120));
  }
}

const todayKey = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

await probe('038-birthday', () =>
  sb.from('customers').select('id,birthday_md').limit(1));
await probe('census-orders', () =>
  sb.from('orders').select('id', { count: 'exact', head: true }));
await probe('census-payments', () =>
  sb.from('payments').select('id', { count: 'exact', head: true }));
await probe('census-order_items', () =>
  sb.from('order_items').select('id', { count: 'exact', head: true }));
await probe('census-customers', () =>
  sb.from('customers').select('id', { count: 'exact', head: true }));
await probe('offers-shape', () =>
  sb.from('offers').select('*').limit(2));
await probe('offers-count', () =>
  sb.from('offers').select('id', { count: 'exact', head: true }));
await probe('customers-full', () =>
  sb.from('customers').select('id,name,phone,email,notes,created_at').order('created_at').limit(10));
await probe('book-today', () =>
  sb.from('reservations').select('id,guest_name,party_size,slot_at,status,phone,table_id')
    .gte('slot_at', `${todayKey}T00:00:00`)
    .order('slot_at').limit(20));
await probe('offers-real', () =>
  sb.from('offers').select('id,title,active').limit(10));
await probe('customers-real', () =>
  sb.from('customers').select('id,name,phone,email').limit(10));
await probe('settings-tables', () =>
  sb.from('information_schema.tables', { head: false }).select('table_name').limit(1));
