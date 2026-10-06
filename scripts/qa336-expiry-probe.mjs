// qa336-expiry-probe: arm a SHORT-lived table session (default +70s) so the
// browser walk can watch the ordering window die MID-CART and observe the
// guest's edge honestly: banner, place-order behavior, cart survival.
// Usage: node scripts/qa336-expiry-probe.mjs [seconds]
import { createClient } from '@supabase/supabase-js';

const SECONDS = Number(process.argv[2] ?? 70);
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

// Now drag the session's expires_at to NOW + SECONDS — the probe window.
const expires = new Date(Date.now() + SECONDS * 1000).toISOString();
const { error: eUpd } = await db
  .from('table_sessions')
  .update({ expires_at: expires })
  .eq('session_token', issued.session_token);
if (eUpd) { console.error('UPDATE refused:', eUpd.message); process.exit(8); }

console.log('ARMED short session for table', t.table_number, 'expires in', SECONDS, 's →', expires);
console.log('MENU_URL:', `http://127.0.0.1:3000/menu/${encodeURIComponent(t.qr_token)}`);
