// qa337-prepare: issue a FRESH (full 10-minute) ephemeral table session so the
// 1366×768 walk can tour the whole guest family live — menu, customizer, cart,
// place order, track. Prints the URLs the walk needs.
import { createClient } from '@supabase/supabase-js';

const db = createClient('https://gehjsxopcowmotgrrcgc.supabase.co', 'sb_publishable_igzjkrzX7PLfNI4hlI8p4g_FeqvHI32');
const { error: eAuth } = await db.auth.signInWithPassword({ email: 'admin@tsos.dev', password: 'admin123456' });
if (eAuth) { console.error('AUTH refused:', eAuth.message); process.exit(2); }

const { data: tenantRow } = await db.from('tenants').select('slug').limit(1);
const slug = tenantRow?.[0]?.slug;
if (!slug) { console.error('no tenant slug'); process.exit(3); }

const { data: tables, error: eT } = await db
  .from('dining_tables')
  .select('id, table_number, qr_token')
  .order('table_number', { ascending: true })
  .limit(5);
if (eT) { console.error('TABLES refused:', eT.message); process.exit(4); }
const t = (tables ?? [])[0];
if (!t?.qr_token) { console.error('no table with qr_token'); process.exit(5); }

const { data: issued, error: eIss } = await db.rpc('issue_ephemeral_table_session', {
  p_tenant_slug: slug,
  p_table_number: String(t.table_number),
  p_permanent_token: t.qr_token,
});
if (eIss) { console.error('ISSUE refused:', eIss.message); process.exit(6); }
if (!issued?.session_token) { console.error('ISSUE verdict:', JSON.stringify(issued)); process.exit(7); }

console.log('ARMED fresh session for table', t.table_number, '(10-min window)');
console.log('MENU_URL:', `http://127.0.0.1:3000/menu/${encodeURIComponent(t.qr_token)}`);
console.log('SESSION_TOKEN:', issued.session_token);
