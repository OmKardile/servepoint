// qa117-movers: hand math for the shortlist — paid lines, last 7 days,
// grouped per menu item. THE reference the rail must match exactly.
import { createClient } from '@supabase/supabase-js';
const db = createClient('https://gehjsxopcowmotgrrcgc.supabase.co', 'sb_publishable_igzjkrzX7PLfNI4hlI8p4g_FeqvHI32');
const { error: eAuth } = await db.auth.signInWithPassword({ email: 'admin@tsos.dev', password: 'admin123456' });
if (eAuth) { console.error('AUTH refused:', eAuth.message); process.exit(2); }

const sinceIso = new Date(Date.now() - 7 * 86400000).toISOString();
const { data: lines, error } = await db
  .from('order_items')
  .select('order_id, menu_item_id, name, qty, unit_price, orders!inner(status, payment_status, created_at)')
  .neq('orders.status', 'cancelled')
  .eq('orders.payment_status', 'completed')
  .gte('orders.created_at', sinceIso);
if (error) { console.error('FETCH refused:', error.code, error.message); process.exit(3); }

const agg = new Map();
for (const r of lines || []) {
  if (!r.menu_item_id) continue;
  const cur = agg.get(r.menu_item_id) || { name: r.name, units: 0, tickets: new Set(), rupees: 0 };
  cur.units += Number(r.qty);
  cur.tickets.add(r.order_id);
  cur.rupees += Number(r.qty) * Number(r.unit_price);
  agg.set(r.menu_item_id, cur);
}
const top = [...agg.entries()]
  .map(([id, v]) => ({ id, ...v }))
  .sort((a, b) => b.units - a.units || b.tickets.size - a.tickets.size || b.rupees - a.rupees || a.name.localeCompare(b.name))
  .slice(0, 5);
console.log(`EXPECTED TOP ${top.length} (paid, since ${sinceIso.slice(0, 10)}):`);
for (const [i, t] of top.entries()) {
  console.log(`${i + 1}. ${t.name} — ×${t.units} · ${t.tickets.size} tickets · ₹${t.rupees.toFixed(2)}`);
}
