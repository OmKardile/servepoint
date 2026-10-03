// qa123-book-probe: reservations detail + tenant/tables for the board-keeps-book feature.
import { createClient } from '@supabase/supabase-js';
const db = createClient('https://gehjsxopcowmotgrrcgc.supabase.co', 'sb_publishable_igzjkrzX7PLfNI4hlI8p4g_FeqvHI32');
const { error: eAuth } = await db.auth.signInWithPassword({ email: 'admin@tsos.dev', password: 'admin123456' });
if (eAuth) { console.error('AUTH refused:', eAuth.message); process.exit(2); }

const { data: rows } = await db.from('reservations').select('*').order('slot_at', { ascending: false }).limit(20);
console.log(`RESERVATIONS: ${(rows || []).length}`);
for (const r of (rows || [])) {
  console.log(`  ${r.slot_at} ${r.status} · ${r.guest_name} · ${r.party_size}p · table=${r.table_id ?? 'null'} · note="${r.note}"`);
}
const { data: tenants } = await db.from('tenants').select('id, name, slug').limit(5);
console.log('TENANTS:', tenants?.map(t => `${t.slug}=${t.id}`).join(' · '));
const { data: tables } = await db.from('dining_tables').select('id, table_number, status, tenant_id').order('table_number').limit(10);
console.log('TABLES:', tables?.map(t => `${t.table_number}(${t.status},${t.tenant_id.slice(0, 8)})`).join(' · '));
// location check (reservations carry location_id)
const { data: locs } = await db.from('locations').select('id, name, tenant_id').limit(6);
console.log('LOCATIONS:', locs?.map(l => `${l.name}=${l.id.slice(0, 8)}(${l.tenant_id.slice(0, 8)})`).join(' · '));
// what statuses exist on booked rows with tables for TODAY IST?
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const start = new Date(`${today}T00:00:00+05:30`).getTime();
const end = start + 24 * 3600 * 1000;
const todays = (rows || []).filter(r => { const t = new Date(r.slot_at).getTime(); return t >= start && t < end; });
console.log(`TODAY-IST rows: ${todays.length}; booked-with-table TODAY: ${todays.filter(r => r.status === 'booked' && r.table_id).length}`);
console.log('IST now:', new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }));
