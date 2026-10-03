// qa119-menu-movers: DB hand math for the menu's rank medallions —
// same window/filter/sort as computeTopMovers, computed BEFORE rendering.
import { createClient } from '@supabase/supabase-js';
const db = createClient('https://gehjsxopcowmotgrrcgc.supabase.co', 'sb_publishable_igzjkrzX7PLfNI4hlI8p4g_FeqvHI32');
const { error: eAuth } = await db.auth.signInWithPassword({ email: 'admin@tsos.dev', password: 'admin123456' });
if (eAuth) { console.error('AUTH refused:', eAuth.message); process.exit(2); }

const days = 7;
const sinceIso = new Date(Date.now() - days * 86400000).toISOString();
const { data, error } = await db
  .from('order_items')
  .select('order_id, menu_item_id, name, qty, unit_price, orders!inner(status, payment_status, created_at)')
  .neq('orders.status', 'cancelled')
  .eq('orders.payment_status', 'completed')
  .gte('orders.created_at', sinceIso);
if (error) { console.error('FETCH error:', error.message); process.exit(1); }

const agg = new Map();
for (const r of data || []) {
  if (!r.menu_item_id) continue;
  const cur = agg.get(r.menu_item_id) || { name: r.name, units: 0, tickets: new Set(), rupees: 0 };
  cur.units += Number(r.qty) || 0;
  cur.tickets.add(r.order_id);
  cur.rupees += (Number(r.qty) || 0) * (Number(r.unit_price) || 0);
  agg.set(r.menu_item_id, cur);
}
const ranked = [...agg.entries()]
  .map(([id, v]) => ({ id, name: v.name, units: v.units, tickets: v.tickets.size, rupees: v.rupees }))
  .sort((a, b) => b.units - a.units || b.tickets - a.tickets || b.rupees - a.rupees || a.name.localeCompare(b.name))
  .slice(0, 5);

console.log('EXPECTED MEDALLIONS (top 5 of the week, paid ledger):');
ranked.forEach((m, i) =>
  console.log(`  No.${i + 1} ${m.name} — ${m.units} units · ${m.tickets} tickets · ₹${m.rupees.toFixed(2)}`),
);
