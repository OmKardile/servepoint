// qa300-urls: arm the E2E surfaces for the wake walk.
// — the newest non-cancelled order → TRACK_URL (read-only)
// — the newest table session re-armed to +600s → MENU_URL (qa289's own
//   precedent: the session row is the QA window, expires_at is its dial)
import { createClient } from '@supabase/supabase-js';
const db = createClient('https://gehjsxopcowmotgrrcgc.supabase.co', 'sb_publishable_igzjkrzX7PLfNI4hlI8p4g_FeqvHI32');
const { error: eAuth } = await db.auth.signInWithPassword({ email: 'admin@tsos.dev', password: 'admin123456' });
if (eAuth) { console.error('AUTH refused:', eAuth.message); process.exit(2); }

const { data: orders, error } = await db
  .from('orders')
  .select('id, order_number, status, payment_status')
  .order('created_at', { ascending: false })
  .limit(5);
if (error) { console.error('ORDERS refused:', error.message); process.exit(3); }
const pick = orders.find((o) => o.status !== 'cancelled');
if (!pick) { console.error('no non-cancelled order found'); process.exit(4); }
console.log('TRACK_URL:', `http://127.0.0.1:3000/track/${pick.id}`);
console.log('order:', pick.order_number, pick.status, pick.payment_status);

const { data: tables, error: eT } = await db
  .from('dining_tables')
  .select('id, table_number, qr_token')
  .order('table_number', { ascending: true })
  .limit(5);
if (eT) { console.error('TABLES refused:', eT.message); process.exit(7); }
const t = (tables ?? [])[0];
if (!t?.qr_token) { console.log('no dining_tables row with qr_token — menu wake skipped'); process.exit(0); }

const { data: tenantRow } = await db.from('tenants').select('slug').limit(1);
const slug = tenantRow?.[0]?.slug;
if (!slug) { console.log('no tenant slug — menu wake skipped'); process.exit(0); }

const { data: issued, error: eIss } = await db.rpc('issue_ephemeral_table_session', {
  p_tenant_slug: slug,
  p_table_number: String(t.table_number),
  p_permanent_token: t.qr_token,
});
if (eIss) { console.error('ISSUE refused:', eIss.message); process.exit(8); }
const token = issued?.session_token;
if (!token) { console.log('ISSUE verdict:', JSON.stringify(issued)); process.exit(0); }
console.log('ISSUED session token (for the record):', token.slice(0, 24) + '…');
// /menu/:qr_token — the route param is the table's PERMANENT qr token
// (the gate opens/caches the ephemeral session itself, keyed sp.guest.session.<qr_token>).
console.log('MENU_URL:', `http://127.0.0.1:3000/menu/${encodeURIComponent(t.qr_token)}`);
console.log('session issued for table', t.table_number);
