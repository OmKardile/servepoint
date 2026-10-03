import { createClient } from '@supabase/supabase-js';
const db = createClient('https://gehjsxopcowmotgrrcgc.supabase.co', 'sb_publishable_igzjkrzX7PLfNI4hlI8p4g_FeqvHI32');
await db.auth.signInWithPassword({ email: 'admin@tsos.dev', password: 'admin123456' });
const T = 'd207be19-e86f-4780-befb-3968831a38fe';
const num = Number(process.argv[2] || 118);
const { data: o } = await db.from('orders').select('id, order_number, status, order_type').eq('tenant_id', T).eq('order_number', num).maybeSingle();
if (!o) { console.log(`#${num}: NOT FOUND`); process.exit(0); }
const { data: h } = await db.from('order_status_history').select('from_status, to_status, created_at').eq('order_id', o.id).order('created_at', { ascending: true });
console.log(`#${num} (${o.order_type}, ${o.status}):`);
for (const r of h || []) console.log(`   ${r.from_status}>${r.to_status} @ ${r.created_at}`);
const fired = (h || []).find(r => r.to_status === 'preparing');
const ready = (h || []).find(r => r.to_status === 'ready' || r.to_status === 'completed');
if (fired && ready) {
  const mins = (new Date(ready.created_at) - new Date(fired.created_at)) / 60000;
  console.log(`   timed: ${mins.toFixed(1)} min`);
} else console.log('   timed: NO (missing endpoint)');
