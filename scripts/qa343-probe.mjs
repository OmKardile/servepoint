// qa343-probe: does the subscriptions ledger hold a trialing row with a real
// trial_end so the dashboard's new clock-sentence will speak? The hint needs
// (status='trialing'|'trial') + trial_end + the tenant's name to compose
// "name · N days left · date". Also proves the LIVE-vs-PASSED selection:
// a passed window must not outrank a live one.
import { createClient } from '@supabase/supabase-js';

const db = createClient('https://gehjsxopcowmotgrrcgc.supabase.co', 'sb_publishable_igzjkrzX7PLfNI4hlI8p4g_FeqvHI32');
const { error: eAuth } = await db.auth.signInWithPassword({ email: 'admin@tsos.dev', password: 'admin123456' });
if (eAuth) { console.error('AUTH refused:', eAuth.message); process.exit(2); }

const { data: subs, error } = await db
  .from('subscriptions')
  .select('tenant_id, status, trial_end, next_billing_at')
  .order('trial_end', { ascending: true });
if (error) { console.error('SUBS refused:', error.message); process.exit(3); }

const { data: tenants } = await db.from('tenants').select('id, name, status');
const nameOf = new Map((tenants ?? []).map((t) => [t.id, t.name]));

const ist = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' });
const today = ist.format(new Date());
const dayNum = (k) => { const [y, m, d] = k.split('-').map(Number); return Date.UTC(y, m - 1, d); };
const todayNum = dayNum(today);

console.log('today (IST):', today);
console.log('subscription census:');
const clocks = [];
for (const s of subs ?? []) {
  const label = `${nameOf.get(s.tenant_id) || '?'} · status=${s.status} · trial_end=${s.trial_end || '—'} · next=${s.next_billing_at || '—'}`;
  console.log(' ', label);
  if ((s.status === 'trialing' || s.status === 'trial') && s.trial_end) {
    const d = Math.round((dayNum(ist.format(new Date(s.trial_end))) - todayNum) / 86400000);
    clocks.push({ name: nameOf.get(s.tenant_id) || '?', end: s.trial_end, d });
  }
}
const live = clocks.filter((c) => c.d >= 0).sort((a, b) => a.end.localeCompare(b.end));
const passed = clocks.filter((c) => c.d < 0).sort((a, b) => b.end.localeCompare(a.end));
const nearest = live[0] ?? passed[0];
if (nearest) {
  const rel = nearest.d === 0 ? 'ends today' : nearest.d === 1 ? '1 day left' : nearest.d > 1 ? `${nearest.d} days left` : 'window passed';
  console.log(`THE HINT WILL SPEAK: ${nearest.name} · ${rel} · ${new Date(nearest.end).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })}`);
  console.log(`URGENCY: bucket=${nearest.d <= 3 ? 'last (urgent ink)' : nearest.d <= 7 ? 'soon' : 'calm (grey voice)'}`);
} else {
  console.log('NO TRIAL CLOCKS — the hint stays silent (honest absence)');
}
