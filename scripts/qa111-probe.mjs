// qa111-probe: (1) is migration 038 applied? (2) post-5.71.0 census truth.
import { createClient } from '@supabase/supabase-js';
const db = createClient('https://gehjsxopcowmotgrrcgc.supabase.co', 'sb_publishable_igzjkrzX7PLfNI4hlI8p4g_FeqvHI32');

// P1: birthday_md column presence (PostgREST errors PGRST204 on unknown column)
let applied = false;
{
  const { error } = await db.from('customers').select('birthday_md').limit(1);
  if (!error) { applied = true; console.log('P1 birthday_md: PRESENT — 038 APPLIED by owner'); }
  else console.log('P1 birthday_md:', error.code ?? '', (error.message ?? '').slice(0, 90), '→ 038 still PENDING');
}

// P2: census
const [orders, payments, feedback] = await Promise.all([
  db.from('orders').select('id', { count: 'exact', head: true }),
  db.from('payments').select('id', { count: 'exact', head: true }),
  db.from('feedback').select('id', { count: 'exact', head: true }),
]);
console.log(`P2 census: orders ${orders.count} · payments ${payments.count} · feedback ${feedback.count}`);

// P3: cancelled leftovers (honest QA rows)
const { data: cx } = await db.from('orders').select('order_number').eq('status', 'cancelled').order('id', { ascending: false }).limit(3);
console.log('P3 recent cancelled:', cx?.map(r => r.order_number).join(', ') ?? 'none');

process.exit(applied ? 0 : 3);
