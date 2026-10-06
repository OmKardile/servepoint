// qa341-probe: which tables hold tickets on PAST days (IST)? The drill's
// new "Earlier at this table" block speaks those days — the walk needs a
// table whose history crosses midnight.
import { createClient } from '@supabase/supabase-js';

const db = createClient('https://gehjsxopcowmotgrrcgc.supabase.co', 'sb_publishable_igzjkrzX7PLfNI4hlI8p4g_FeqvHI32');
const { error: eAuth } = await db.auth.signInWithPassword({ email: 'admin@tsos.dev', password: 'admin123456' });
if (eAuth) { console.error('AUTH refused:', eAuth.message); process.exit(2); }

const { data: orders, error } = await db
  .from('orders')
  .select('id, order_number, table_id, status, payment_status, total, created_at, dining_tables(table_number)')
  .order('created_at', { ascending: false })
  .limit(200);
if (error) { console.error('ORDERS refused:', error.message); process.exit(3); }

const byDayTable = new Map();
for (const o of orders ?? []) {
  if (o.status === 'cancelled' || !o.table_id) continue;
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(o.created_at));
  const label = o.dining_tables?.table_number ?? '?';
  const key = `${label}/${day}`;
  byDayTable.set(key, (byDayTable.get(key) ?? 0) + 1);
}
console.log('table/day census (newest 200 tickets):');
for (const [k, v] of [...byDayTable.entries()].sort()) console.log(' ', k, '→', v, 'tickets');
