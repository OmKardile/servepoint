import { createClient } from '@supabase/supabase-js';
const db = createClient('https://gehjsxopcowmotgrrcgc.supabase.co', 'sb_publishable_igzjkrzX7PLfNI4hlI8p4g_FeqvHI32');
await db.auth.signInWithPassword({ email: 'admin@tsos.dev', password: 'admin123456' });
const T = 'd207be19-e86f-4780-befb-3968831a38fe';
const { data: os } = await db.from('orders').select('id, order_number, status, order_type').eq('tenant_id', T).neq('status', 'cancelled');
const ids = (os || []).map(o => o.id);
const { data: h } = await db.from('order_status_history').select('order_id, from_status, to_status, created_at').in('order_id', ids).order('created_at', { ascending: true });
const byOrder = {};
for (const r of h || []) (byOrder[r.order_id] ||= []).push(r);
for (const o of os || []) {
  const chain = (byOrder[o.id] || []).map(r => `${r.from_status}>${r.to_status}`).join(' | ');
  if (chain) console.log(`#${o.order_number} (${o.order_type}, ${o.status}): ${chain}`);
}
