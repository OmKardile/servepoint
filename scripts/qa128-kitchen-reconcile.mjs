// Task 128: reconcile Dashboard "IN THE KITCHEN 3 / LATE PREP 2" vs kitchen rail (Preparing 1)
import { createClient } from '@supabase/supabase-js';
const db = createClient('https://gehjsxopcowmotgrrcgc.supabase.co', 'sb_publishable_igzjkrzX7PLfNI4hlI8p4g_FeqvHI32');
await db.auth.signInWithPassword({ email: 'admin@tsos.dev', password: 'admin123456' });
const { data, error } = await db.from('orders')
  .select('id,order_number,status,kitchen_status,order_type,created_at')
  .gte('created_at', '2026-10-03T00:00:00+00:00').order('created_at');
if (error) { console.log('SELECT ERR:', error.code, error.message.slice(0, 120)); process.exit(1); }
const counts = {};
for (const o of data) { const k = `${o.status}/${o.kitchen_status || '-'}`; counts[k] = (counts[k] || 0) + 1; }
console.log('today rows:', data.length);
console.log('status/kitchen combos:', JSON.stringify(counts, null, 0));
const byNum = data.map(o => `#${o.order_number}:${o.status}:${o.kitchen_status || '-'}`).join(' ');
console.log('per-order:', byNum);
