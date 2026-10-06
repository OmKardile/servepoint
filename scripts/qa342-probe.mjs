// qa342-probe: does the ledger hold tickets on TWO consecutive days so the
// EOD's new "day vs the day before" strip will speak? The strip needs the
// browsed day AND the day before it to hold live (non-cancelled) tickets.
import { createClient } from '@supabase/supabase-js';

const db = createClient('https://gehjsxopcowmotgrrcgc.supabase.co', 'sb_publishable_igzjkrzX7PLfNI4hlI8p4g_FeqvHI32');
const { error: eAuth } = await db.auth.signInWithPassword({ email: 'admin@tsos.dev', password: 'admin123456' });
if (eAuth) { console.error('AUTH refused:', eAuth.message); process.exit(2); }

const { data: tenantRows, error: eTen } = await db.from('tenants').select('id, name').limit(5);
if (eTen) { console.error('TENANTS refused:', eTen.message); process.exit(3); }
const tenantId = tenantRows?.[0]?.id;
console.log('tenant:', tenantRows?.[0]?.name);

const { data: orders, error } = await db
  .from('orders')
  .select('status, total, created_at')
  .eq('tenant_id', tenantId)
  .gte('created_at', new Date(Date.now() - 14 * 86400000).toISOString())
  .order('created_at', { ascending: false });
if (error) { console.error('ORDERS refused:', error.message); process.exit(4); }

const ist = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' });
const byDay = new Map();
for (const o of orders ?? []) {
  if (o.status === 'cancelled') continue;
  const day = ist.format(new Date(o.created_at));
  const cur = byDay.get(day) || { count: 0, gross: 0 };
  cur.count += 1;
  cur.gross += Number(o.total || 0);
  byDay.set(day, cur);
}
console.log('live-ticket census by IST day (last 14 days):');
for (const [day, v] of [...byDay.entries()].sort().reverse()) {
  console.log(' ', day, '→', v.count, 'tickets · gross ₹' + v.gross.toFixed(2));
}
const days = [...byDay.keys()].sort().reverse();
if (days.length >= 2) {
  const [a, b] = days;
  console.log(`STRIPE WILL SPEAK for browsed day ${a}: the day before (${b}) holds ${byDay.get(b).count} live tickets, gross ₹${byDay.get(b).gross.toFixed(2)}`);
} else {
  console.log('NO CONSECUTIVE DAYS — the strip stays silent on every day (honest absence)');
}
