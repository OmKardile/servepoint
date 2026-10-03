// qa123-seed-book: two `booked` reservations for TODAY (IST) so the board's
// promise chips can be E2E-proven: one due-soon on occupied T2, one
// comfortable-hour on available T1. Fully self-labelling in `note`.
import { createClient } from '@supabase/supabase-js';
const db = createClient('https://gehjsxopcowmotgrrcgc.supabase.co', 'sb_publishable_igzjkrzX7PLfNI4hlI8p4g_FeqvHI32');
const { error: eAuth } = await db.auth.signInWithPassword({ email: 'admin@tsos.dev', password: 'admin123456' });
if (eAuth) { console.error('AUTH refused:', eAuth.message); process.exit(2); }

const TENANT = 'd207be19-e86f-4780-befb-3968831a38fe'; // qrflowcafe
const { data: locs } = await db.from('locations').select('id').eq('tenant_id', TENANT).limit(1);
const LOCATION = locs?.[0]?.id;
const { data: tables } = await db.from('dining_tables').select('id, table_number, status').eq('tenant_id', TENANT).order('table_number');
const t1 = tables?.find((t) => t.table_number === 'T1');
const t2 = tables?.find((t) => t.table_number === 'T2');
console.log('LOCATION:', LOCATION, '· T1:', t1?.id, t1?.status, '· T2:', t2?.id, t2?.status);
if (!LOCATION || !t1 || !t2) { console.error('Missing fixtures'); process.exit(2); }

const istWall = (minsAhead) => {
  const d = new Date(Date.now() + minsAhead * 60000);
  // compose IST wall-clock +05:30 (the createReservation grammar)
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(d).reduce((a, p) => (a[p.type] = p.value, a), {});
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:00+05:30`;
};

const rows = [
  {
    tenant_id: TENANT, location_id: LOCATION,
    guest_name: 'Aditi Kulkarni', phone: '9845012345', party_size: 4,
    table_id: t2.id, slot_at: istWall(35), status: 'booked',
    note: 'seeded — board-keeps-book QA (due-soon, occupied table)',
    created_by_email: 'admin@tsos.dev',
  },
  {
    tenant_id: TENANT, location_id: LOCATION,
    guest_name: 'Rohan Mehta', phone: '9900112233', party_size: 2,
    table_id: t1.id, slot_at: istWall(190), status: 'booked',
    note: 'seeded — board-keeps-book QA (comfortable hour)',
    created_by_email: 'admin@tsos.dev',
  },
];

const { data, error } = await db.from('reservations').insert(rows).select('id, guest_name, slot_at, status, table_id');
if (error) { console.error('INSERT failed:', error.message); process.exit(1); }
for (const r of (data || [])) console.log(`SEEDED: ${r.guest_name} ${r.slot_at} ${r.status} table=${r.table_id.slice(0, 8)}`);
const { count } = await db.from('reservations').select('id', { count: 'exact', head: true });
console.log('BOOK TOTAL:', count);
