// Task 128: DB truth for dashboard "in kitchen" vs KDS rail
import { createClient } from '@supabase/supabase-js';
const db = createClient('https://gehjsxopcowmotgrrcgc.supabase.co', 'sb_publishable_igzjkrzX7PLfNI4hlI8p4g_FeqvHI32');
await db.auth.signInWithPassword({ email: 'admin@tsos.dev', password: 'admin123456' });

const { data: ord, error } = await db.from('orders')
  .select('id,order_number,status,payment_status,order_type,created_at')
  .in('status', ['pending', 'preparing', 'new'])
  .order('created_at');
if (error) { console.log('ERR', error.code, error.message.slice(0, 100)); process.exit(1); }
console.log('non-cancelled open orders (any day):', ord.length);
for (const o of ord) console.log(`  #${o.order_number} ${o.status} pay=${o.payment_status} ${o.created_at}`);

// item ticks for those orders — what the KDS rail derives from
const ids = ord.map(o => o.id);
if (ids.length) {
  const { data: items } = await db.from('order_items').select('order_id,name,qty,checked_at').in('order_id', ids);
  const per = {};
  for (const it of items || []) {
    per[it.order_id] = per[it.order_id] || { fired: 0, waiting: 0 };
    if (it.checked_at) per[it.order_id].fired += it.qty; else per[it.order_id].waiting += it.qty;
  }
  console.log('item ticks:', JSON.stringify(per));
}
