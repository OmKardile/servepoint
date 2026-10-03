// qa120-shelf-answer: DB hand math for the shelf's answer —
// movers × recipe_lines × current_stock, the thinnest SKU decides.
// Computed BEFORE rendering so the live section must match row-for-row.
import { createClient } from '@supabase/supabase-js';
const db = createClient('https://gehjsxopcowmotgrrcgc.supabase.co', 'sb_publishable_igzjkrzX7PLfNI4hlI8p4g_FeqvHI32');
const { error: eAuth } = await db.auth.signInWithPassword({ email: 'admin@tsos.dev', password: 'admin123456' });
if (eAuth) { console.error('AUTH refused:', eAuth.message); process.exit(2); }

const days = 7;
const sinceIso = new Date(Date.now() - days * 86400000).toISOString();
const { data: lines, error: e1 } = await db
  .from('order_items')
  .select('order_id, menu_item_id, name, qty, unit_price, orders!inner(status, payment_status, created_at)')
  .neq('orders.status', 'cancelled')
  .eq('orders.payment_status', 'completed')
  .gte('orders.created_at', sinceIso);
if (e1) { console.error('movers fetch:', e1.message); process.exit(1); }

const agg = new Map();
for (const r of lines || []) {
  if (!r.menu_item_id) continue;
  const cur = agg.get(r.menu_item_id) || { name: r.name, units: 0, tickets: new Set(), rupees: 0 };
  cur.units += Number(r.qty) || 0;
  cur.tickets.add(r.order_id);
  cur.rupees = (cur.rupees || 0) + (Number(r.qty) || 0) * (Number(r.unit_price) || 0);
  agg.set(r.menu_item_id, cur);
}
const movers = [...agg.entries()]
  .map(([id, v]) => ({ id, name: v.name, units: v.units, tickets: v.tickets.size, rupees: v.rupees || 0 }))
  .sort((a, b) => b.units - a.units || b.tickets - a.tickets || b.rupees - a.rupees || a.name.localeCompare(b.name))
  .slice(0, 5);

const [inv, recipes, menu] = await Promise.all([
  db.from('inventory_items').select('id, name, unit, current_stock'),
  db.from('recipe_lines').select('menu_item_id, inventory_item_id, qty_per_serve'),
  db.from('menu_items').select('id, name'),
]);
const shelf = new Map((inv.data || []).map((i) => [i.id, i]));
const live = new Set((menu.data || []).map((m) => m.id));
const rl = recipes.data || [];

console.log('EXPECTED SHELF ANSWER (top movers × recipes × shelf):');
for (const [idx, mv] of movers.entries()) {
  if (!live.has(mv.id)) { console.log(`  (dropped — dish left the live menu) ${mv.name}`); continue; }
  const dishLines = rl.filter((r) => r.menu_item_id === mv.id);
  if (dishLines.length === 0) { console.log(`  No.${idx + 1} ${mv.name} (${mv.units} sold) → no recipe on file`); continue; }
  let best = Infinity, thin = null, unknown = false;
  for (const r of dishLines) {
    const it = shelf.get(r.inventory_item_id);
    if (!it) { unknown = true; break; }
    const per = Number(r.qty_per_serve);
    if (!(per > 0)) continue;
    const serves = Math.floor(Number(it.current_stock) / per);
    if (serves < best) { best = serves; thin = it; }
  }
  if (unknown) console.log(`  No.${idx + 1} ${mv.name} (${mv.units} sold) → recipe SKU off the shelf — coverage unknown`);
  else if (thin === null) console.log(`  No.${idx + 1} ${mv.name} (${mv.units} sold) → no valid per-serve lines`);
  else console.log(`  No.${idx + 1} ${mv.name} (${mv.units} sold) → ~${Math.max(0, best)} more · thinnest: ${thin.name} (${thin.unit})`);
}
