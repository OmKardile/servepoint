// qa112-probe: (1) 038 applied? (2) census stability vs Task 111 close-out. Authenticated.
import { createClient } from '@supabase/supabase-js';
const db = createClient('https://gehjsxopcowmotgrrcgc.supabase.co', 'sb_publishable_igzjkrzX7PLfNI4hlI8p4g_FeqvHI32');
const { error: eAuth } = await db.auth.signInWithPassword({ email: 'admin@tsos.dev', password: 'admin123456' });
if (eAuth) { console.error('AUTH refused:', eAuth.message); process.exit(2); }

let applied = false;
{
  const { error } = await db.from('customers').select('birthday_md').limit(1);
  if (!error) { applied = true; console.log('P1 birthday_md: PRESENT — 038 APPLIED, birthdays UI unblocked'); }
  else console.log('P1 birthday_md:', error.code, (error.message ?? '').slice(0, 70), '→ 038 still PENDING');
}

const [orders, payments] = await Promise.all([
  db.from('orders').select('id', { count: 'exact', head: true }),
  db.from('payments').select('id', { count: 'exact', head: true }),
]);
console.log(`P2 census (auth): orders ${orders.count} · payments ${payments.count}`);

const { data: cx } = await db.from('orders').select('order_number, status').eq('status', 'cancelled').order('id', { ascending: false }).limit(3);
console.log('P3 top cancelled:', cx?.map(r => `#${r.order_number}`).join(', ') ?? 'none');

const { data: fb } = await db.from('order_feedback').select('id', { count: 'exact', head: true });
const { data: cust } = await db.from('customers').select('id', { count: 'exact', head: true });
console.log(`P4 ledgers: feedback ${fb?.length === 0 ? 0 : 'n/a'} · customers visible rows: ${(cust ?? []).length}`);
process.exit(applied ? 0 : 3);
