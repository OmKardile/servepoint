// qa347-cleanup — remove the E2E-converted Convert Proof Cafe so the cloud
// census returns to its pre-round truth (2 businesses: QR Flow Cafe trial,
// CheeseBurg active). The auth.users row (convert.owner@convertproof.in) has
// NO PostgREST deletion path without a pooler password — recorded as an owner
// action item (same discipline as the drill-owner and promise-owner orphans).
import { createClient } from '@supabase/supabase-js';

const db = createClient('https://gehjsxopcowmotgrrcgc.supabase.co', 'sb_publishable_igzjkrzX7PLfNI4hlI8p4g_FeqvHI32');
const { error: eAuth } = await db.auth.signInWithPassword({ email: 'admin@tsos.dev', password: 'admin123456' });
if (eAuth) { console.error('AUTH refused:', eAuth.message); process.exit(2); }

const EMAIL = 'convert.owner@convertproof.in';
const { data: tenants } = await db.from('tenants').select('id, name, slug').eq('slug', 'convert-proof-cafe');
const t = (tenants ?? [])[0];
if (!t) { console.log('TENANT ALREADY GONE — nothing to clean'); process.exit(0); }
console.log('cleaning tenant:', t.name, t.id);

// Child rows first (FK discipline), census before each delete.
const childTables = [
  'conversations',
  'subscriptions',
  'platform_audit_logs',
  'tenant_users',
  'notifications',
  'menu_categories',
  'menu_items',
  'locations',
  'dining_tables',
  'orders',
];
for (const table of childTables) {
  const { data: found, error: eSel } = await db.from(table).select('*').eq('tenant_id', t.id).limit(50);
  if (eSel) { console.log(`  ${table}: skip (${eSel.message.slice(0, 60)})`); continue; }
  if (!found?.length) { console.log(`  ${table}: 0 rows`); continue; }
  const { error: eDel } = await db.from(table).delete().eq('tenant_id', t.id);
  console.log(`  ${table}: ${found.length} row(s) ${eDel ? 'DELETE FAILED: ' + eDel.message : 'deleted'}`);
}

// tenant_users may key by email rather than tenant_id — sweep both.
const { data: tuByTenant } = await db.from('tenant_users').select('*').eq('tenant_id', t.id).limit(20);
if (tuByTenant?.length) {
  const { error } = await db.from('tenant_users').delete().eq('tenant_id', t.id);
  console.log(`  tenant_users(by tenant): ${tuByTenant.length} deleted`, error?.message || '');
}
const { data: tuByEmail } = await db.from('tenant_users').select('*').eq('email', EMAIL).limit(20);
if (tuByEmail?.length) {
  const { error } = await db.from('tenant_users').delete().eq('email', EMAIL);
  console.log(`  tenant_users(by email): ${tuByEmail.length} deleted`, error?.message || '');
}

// The tenant row itself — the census's own word.
const { error: eTenant } = await db.from('tenants').delete().eq('id', t.id);
console.log('tenants row:', eTenant ? 'DELETE FAILED: ' + eTenant.message : 'deleted');

// Post-state census.
const { data: after } = await db.from('tenants').select('id, name, status');
const { data: subsAfter } = await db.from('subscriptions').select('tenant_id, status, monthly_price, final_monthly_rate');
console.log('post-cleanup census:', JSON.stringify((after ?? []).map((x) => x.name)));
console.log('post-cleanup subs:', JSON.stringify((subsAfter ?? []).map((s) => ({ status: s.status, rate: s.final_monthly_rate }))));
