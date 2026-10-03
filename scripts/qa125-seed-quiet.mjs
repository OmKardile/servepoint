// qa125-seed-quiet: two `booked` reservations whose IST slots have already
// passed (self-labelled) so the v5.86 "went quiet" grammar can be E2E-proven:
// one on available T1 (full action set), one on occupied T2 (call + no-show).
import { createClient } from '@supabase/supabase-js';
const db = createClient('https://gehjsxopcowmotgrrcgc.supabase.co', 'sb_publishable_igzjkrzX7PLfNI4hlI8p4g_FeqvHI32');
const { error: eAuth } = await db.auth.signInWithPassword({ email: 'admin@tsos.dev', password: 'admin123456' });
if (eAuth) { console.error('AUTH refused:', eAuth.message); process.exit(2); }

const TENANT = 'd207be19-e86f-4780-befb-3968831a38fe';
const LOCATION = '5dd11592-2c9e-4bcf-b589-585d3270ab16';
const T1 = '2550d42e-ab95-4a91-ae61-50d377176d33';
const T2 = '7d88108f-0f6b-42ba-abf6-669805fb6bd2';

const istWall = (minsAgo) => {
  const d = new Date(Date.now() - minsAgo * 60000);
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(d).reduce((a, x) => (a[x.type] = x.value, a), {});
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:00+05:30`;
};

const rows = [
  { tenant_id: TENANT, location_id: LOCATION, guest_name: 'Nikhil Shah', phone: '9820034567', party_size: 3, table_id: T1, slot_at: istWall(30), status: 'booked', note: 'seeded — went-quiet QA (available table, full actions)', created_by_email: 'admin@tsos.dev' },
  { tenant_id: TENANT, location_id: LOCATION, guest_name: 'Vikram Rao', phone: '9867543210', party_size: 2, table_id: T2, slot_at: istWall(50), status: 'booked', note: 'seeded — went-quiet QA (occupied table, call + no-show only)', created_by_email: 'admin@tsos.dev' },
];
const { data, error } = await db.from('reservations').insert(rows).select('id, guest_name, slot_at, status');
if (error) { console.error('INSERT failed:', error.message); process.exit(1); }
for (const r of (data || [])) console.log(`SEEDED: ${r.guest_name} ${r.slot_at} ${r.status}`);
const { count } = await db.from('reservations').select('id', { count: 'exact', head: true });
console.log('BOOK TOTAL:', count);
