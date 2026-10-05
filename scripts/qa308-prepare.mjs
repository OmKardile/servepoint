// qa308-prepare: arm the reorder walk (v5.269.0).
// — flip order #131 to 'completed' (the feedback + reorder CTA's own gate;
//   the qa109 precedent for status updates via the publishable client)
// — re-arm the table session (qa300's own precedent: the session row is the
//   QA window, expires_at is its dial)
// — print the URLs the browser walk needs, and restore nothing (the walk's
//   own cleanup step flips #131 back to 'pending' afterwards).
import { createClient } from '@supabase/supabase-js';

const ORDER_131 = '27e2db55-b053-4784-9c4f-28797c69a34c';
const db = createClient(
  'https://gehjsxopcowmotgrrcgc.supabase.co',
  'sb_publishable_igzjkrzX7PLfNI4hlI8p4g_FeqvHI32'
);
const { error: eAuth } = await db.auth.signInWithPassword({ email: 'admin@tsos.dev', password: 'admin123456' });
if (eAuth) { console.error('AUTH refused:', eAuth.message); process.exit(2); }

// 1. the ticket completes its meal — the CTA's own gate
const { data: before, error: eRead } = await db
  .from('orders')
  .select('id, order_number, status, payment_status')
  .eq('id', ORDER_131)
  .single();
if (eRead) { console.error('READ refused:', eRead.message); process.exit(3); }
console.log('before:', before.order_number, before.status, before.payment_status);

const { error: eUpd } = await db
  .from('orders')
  .update({ status: 'completed', updated_at: new Date().toISOString() })
  .eq('id', ORDER_131)
  .eq('status', 'new'); // idempotence guard: only a fresh ticket flips
if (eUpd) { console.error('UPDATE refused:', eUpd.message); process.exit(4); }

const { data: after } = await db
  .from('orders')
  .select('status')
  .eq('id', ORDER_131)
  .single();
console.log('after:', after?.status);

// 2. the session window re-armed (+600s), qa300's dial
const { data: tables, error: eT } = await db
  .from('dining_tables')
  .select('id, table_number, qr_token')
  .order('table_number', { ascending: true })
  .limit(5);
if (eT) { console.error('TABLES refused:', eT.message); process.exit(7); }
const t = (tables ?? [])[0];
if (!t?.qr_token) { console.error('no dining_tables row with qr_token'); process.exit(7); }

const { data: tenantRow } = await db.from('tenants').select('slug').limit(1);
const slug = tenantRow?.[0]?.slug;
const { data: issued, error: eIss } = await db.rpc('issue_ephemeral_table_session', {
  p_tenant_slug: slug,
  p_table_number: String(t.table_number),
  p_permanent_token: t.qr_token,
});
if (eIss) { console.error('ISSUE refused:', eIss.message); process.exit(8); }
console.log('session re-armed for table', t.table_number, '(expires', issued?.expires_at ?? 'n/a', ')');

console.log('TRACK_URL:', `http://127.0.0.1:3000/track/${before.id}`);
console.log('MENU_URL:', `http://127.0.0.1:3000/menu/${encodeURIComponent(t.qr_token)}`);
