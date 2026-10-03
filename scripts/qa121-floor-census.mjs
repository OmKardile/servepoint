// qa121-floor-census: floor census with CORRECT schema columns (table_number/capacity/section/status).
import { createClient } from '@supabase/supabase-js';
const db = createClient('https://gehjsxopcowmotgrrcgc.supabase.co', 'sb_publishable_igzjkrzX7PLfNI4hlI8p4g_FeqvHI32');
await db.auth.signInWithPassword({ email: 'admin@tsos.dev', password: 'admin123456' });
const { data: tables } = await db.from('dining_tables').select('id, table_number, capacity, section, status, active_order_id').order('table_number');
console.log('TABLES:', JSON.stringify(tables, null, 1));
const { data: sessions } = await db.from('table_sessions').select('id, status, opened_at').order('opened_at', { ascending: false }).limit(5);
console.log('SESSIONS:', sessions?.length ? JSON.stringify(sessions) : 'none');
const { data: floorOrders } = await db.from('orders').select('order_number, table_id, status, payment_status').not('table_id', 'is', null).order('order_number', { ascending: false }).limit(8);
console.log('TABLE-ORDERS:', floorOrders?.map(r => `#${r.order_number}:tbl=${r.table_id?.slice(0, 8)}:${r.status}/${r.payment_status}`).join(' · ') || 'none');
