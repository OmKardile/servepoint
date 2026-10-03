import { createClient } from '@supabase/supabase-js';
const db = createClient('https://gehjsxopcowmotgrrcgc.supabase.co', 'sb_publishable_igzjkrzX7PLfNI4hlI8p4g_FeqvHI32');
await db.auth.signInWithPassword({ email: 'admin@tsos.dev', password: 'admin123456' });
const { data: me } = await db.auth.getUser();
const { data: prof } = await db.from('profiles').select('id, tenant_id, role').eq('id', me.user.id).maybeSingle();
console.log('ADMIN PROFILE:', JSON.stringify(prof));
const { data: tenants } = await db.from('tenants').select('id, name, status');
console.log('TENANTS:', tenants?.map(t => `${t.name}(${t.id.slice(0,8)},${t.status})`).join(' · '));
const { data: tables } = await db.from('dining_tables').select('table_number, tenant_id, location_id, status').order('table_number');
for (const t of tables || []) {
  const tn = tenants?.find(x => x.id === t.tenant_id);
  console.log(`TABLE ${t.table_number}: tenant=${tn ? tn.name : 'UNKNOWN!'}(${t.tenant_id?.slice(0,8)}) status=${t.status}`);
}
