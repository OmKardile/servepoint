// qa309-prepare: arm the count walk (v5.270.0).
// — give Classic Sandbich a word about itself (the customizer's whole-
//   description paragraph needs a description to speak; the live row's is
//   null — the qa308 prepare/restore precedent: the walk's own state change,
//   guarded and restored by qa309-restore.mjs)
// — re-arm the t1 session window (+600s, qa300's dial) so the walk has a
//   live cart to stand in
// — print the URL the browser walk needs; restore nothing here.
import { createClient } from '@supabase/supabase-js';

const ITEM = '7314dc1a-b810-413e-ae01-866191890882'; // Classic Sandbich (CheeseBurg)
const QA_DESC = 'QA walk word — this line was written by qa309-prepare and restored to null after the walk.';
const db = createClient(
  'https://gehjsxopcowmotgrrcgc.supabase.co',
  'sb_publishable_igzjkrzX7PLfNI4hlI8p4g_FeqvHI32'
);
const { error: eAuth } = await db.auth.signInWithPassword({ email: 'admin@tsos.dev', password: 'admin123456' });
if (eAuth) { console.error('AUTH refused:', eAuth.message); process.exit(2); }

// 1. the dish's word, for the walk only
const { data: before, error: eRead } = await db
  .from('menu_items')
  .select('id, name, description')
  .eq('id', ITEM)
  .single();
if (eRead) { console.error('READ refused:', eRead.message); process.exit(3); }
console.log('before:', before.name, 'description =', JSON.stringify(before.description));

const { error: eUpd } = await db
  .from('menu_items')
  .update({ description: QA_DESC, updated_at: new Date().toISOString() })
  .eq('id', ITEM);
if (eUpd) { console.error('UPDATE refused:', eUpd.message); process.exit(4); }
console.log('description armed for the walk');

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

console.log('MENU_URL:', `http://127.0.0.1:3000/menu/${encodeURIComponent(t.qr_token)}`);
