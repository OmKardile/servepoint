// Task 102 — read-only truth probe for the split-bill round.
// Census (orders/payments), the fixture ticket's state, its ledger rows.
// Usage: node scripts/qa102-truth.mjs [orderNumber]
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
const T = 'd207be19-e86f-4780-befb-3968831a38fe';

const num = process.argv[2] ? Number(process.argv[2]) : null;

const { count: census } = await db
  .from('orders')
  .select('id', { count: 'exact', head: true })
  .eq('tenant_id', T);
const { count: payRows } = await db
  .from('payments')
  .select('id', { count: 'exact', head: true })
  .eq('tenant_id', T);
console.log(`census: orders=${census} payments=${payRows}`);

if (num) {
  const { data: o, error: oErr } = await db
    .from('orders')
    .select('id, order_number, status, payment_status, payment_method, total, order_type')
    .eq('tenant_id', T)
    .eq('order_number', num)
    .maybeSingle();
  if (oErr) console.log(`order #${num} read ERROR:`, oErr.code, oErr.message);
  if (!o) {
    console.log(`order #${num}: NOT FOUND`);
  } else {
    console.log(`order #${num}:`, JSON.stringify(o));
    const { data: rows } = await db
      .from('payments')
      .select('method, amount, status, confirmed_by_email, created_at')
      .eq('order_id', o.id)
      .order('created_at', { ascending: true });
    console.log(`ledger rows: ${(rows || []).length}`);
    for (const r of rows || []) {
      console.log(`  - ${r.method} ₹${r.amount} [${r.status}] by ${r.confirmedByEmail} @ ${r.created_at}`);
    }
  }
}
await db.auth.signOut();
