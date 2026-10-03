// Task 101 — read-only probe: what does the ledger already know about
// phones (leftover active orders + CRM rows + stats view)? NO writes.
import { createClient } from '@supabase/supabase-js';

const db = createClient('https://gehjsxopcowmotgrrcgc.supabase.co', 'sb_publishable_igzjkrzX7PLfNI4hlI8p4g_FeqvHI32');
const { data: auth, error: authErr } = await db.auth.signInWithPassword({
  email: 'admin@tsos.dev',
  password: 'admin123456',
});
if (authErr) {
  console.log('auth FAIL:', authErr.message);
  process.exit(1);
}
console.log('auth ok');

const T = 'd207be19-e86f-4780-befb-3968831a38fe';

const { data: act, error: aErr } = await db
  .from('orders')
  .select('order_number, status, payment_status, customer_name, customer_phone, total')
  .eq('tenant_id', T)
  .in('order_number', [67, 68, 69, 96])
  .order('order_number');
if (aErr) console.log('active read FAIL:', aErr.message);
console.log('--- leftover active orders ---');
for (const o of act ?? []) console.log(`  #${o.order_number} [${o.status}/${o.payment_status}] "${o.customer_name || '-'}" phone=${o.customer_phone || 'NONE'} ₹${o.total}`);

const { data: crm, error: cErr } = await db
  .from('customers')
  .select('name, phone, notes, created_at')
  .eq('tenant_id', T)
  .order('created_at', { ascending: false })
  .limit(10);
if (cErr) console.log('crm read FAIL:', cErr.message);
console.log('--- CRM rows (latest 10) ---');
for (const c of crm ?? []) console.log(`  "${c.name}" ${c.phone} notes=${(c.notes || '').slice(0, 30) || '-'}`);

const { data: stats, error: sErr } = await db
  .from('v_customer_stats')
  .select('phone, orders_placed, visits, total_spent, last_visit_at')
  .eq('tenant_id', T)
  .order('visits', { ascending: false })
  .limit(8);
if (sErr) console.log('stats read FAIL:', sErr.message);
console.log('--- v_customer_stats (top by visits) ---');
for (const s of stats ?? []) console.log(`  ${s.phone} placed=${s.orders_placed} visits=${s.visits} ₹${s.total_spent} last=${s.last_visit_at ? s.last_visit_at.slice(0, 10) : '-'}`);
console.log('done');
