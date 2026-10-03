// qa123-probe: 038 DDL probe + census + recipe/cost coverage for the menu-margin candidate.
import { createClient } from '@supabase/supabase-js';
const db = createClient('https://gehjsxopcowmotgrrcgc.supabase.co', 'sb_publishable_igzjkrzX7PLfNI4hlI8p4g_FeqvHI32');
const { error: eAuth } = await db.auth.signInWithPassword({ email: 'admin@tsos.dev', password: 'admin123456' });
if (eAuth) { console.error('AUTH refused:', eAuth.message); process.exit(2); }

// 038 probe: birthday_md on customers
const { data: cust, error: e038 } = await db.from('customers').select('id, birthday_md').limit(1);
console.log('038 birthday_md:', e038 ? `ABSENT (${e038.code})` : 'PRESENT');

// Census
const [o, p, t, c] = await Promise.all([
  db.from('orders').select('id', { count: 'exact', head: true }),
  db.from('payments').select('id', { count: 'exact', head: true }),
  db.from('order_items').select('id', { count: 'exact', head: true }),
  db.from('customers').select('id', { count: 'exact', head: true }),
]);
console.log(`CENSUS: orders=${o.count} payments=${p.count} order_items=${t.count} customers=${c.count}`);

// ── The menu-margin candidate: recipe × cost coverage ──
const [mi, rl, ii] = await Promise.all([
  db.from('menu_items').select('id', { count: 'exact', head: true }),
  db.from('recipe_lines').select('id', { count: 'exact', head: true }),
  db.from('inventory_items').select('id', { count: 'exact', head: true }),
]);
console.log(`SCHEMA: menu_items=${mi.count} recipe_lines=${rl.count} inventory_items=${ii.count}`);

// Recipe coverage: how many distinct menu items carry at least one recipe line?
const { data: rlines } = await db.from('recipe_lines').select('menu_item_id, inventory_item_id, qty_per_serve').limit(500);
const itemsWithRecipes = new Set((rlines || []).map(r => r.menu_item_id));
console.log(`RECIPE COVERAGE: ${itemsWithRecipes.size} distinct menu items have recipes (${(rlines || []).length} lines total)`);

// Cost coverage: how many inventory items carry cost_per_unit?
const { data: inv } = await db.from('inventory_items').select('id, name, unit, cost_per_unit').limit(500);
const withCost = (inv || []).filter(i => i.cost_per_unit != null && i.cost_per_unit > 0);
console.log(`COST COVERAGE: ${withCost.length}/${(inv || []).length} inventory items have cost_per_unit`);
const invIds = new Set((inv || []).map(i => i.id));
const dangling = (rlines || []).filter(r => !invIds.has(r.inventory_item_id)).length;
console.log(`DANGLING RECIPE LINES (inventory item missing): ${dangling}`);

// Costed-item estimate: menu items whose recipe lines ALL point at costed inventory
const costIds = new Set(withCost.map(i => i.id));
const perItem = new Map();
for (const r of (rlines || [])) {
  if (!perItem.has(r.menu_item_id)) perItem.set(r.menu_item_id, { total: 0, costed: 0 });
  const e = perItem.get(r.menu_item_id); e.total++;
  if (costIds.has(r.inventory_item_id)) e.costed++;
}
let full = 0, partial = 0, uncosted = 0;
for (const [, e] of perItem) { if (e.costed === e.total) full++; else if (e.costed > 0) partial++; else uncosted++; }
console.log(`COSTED ESTIMATE: fully-costed=${full} partial=${partial} recipes-all-uncosted=${uncosted}`);

// Sample dish economics (top 8 by recipe size) — sanity for the rupee math
const { data: mitems } = await db.from('menu_items').select('id, name, price').limit(100);
const nameOf = new Map((mitems || []).map(m => [m.id, m.name]));
const priceOf = new Map((mitems || []).map(m => [m.id, m.price]));
const costOf = new Map(withCost.map(i => [i.id, i.cost_per_unit]));
const sample = [];
for (const [mid, e] of perItem) {
  if (e.costed === 0) continue;
  const cogs = (rlines || []).filter(r => r.menu_item_id === mid && costIds.has(r.inventory_item_id))
    .reduce((s, r) => s + r.qty_per_serve * costOf.get(r.inventory_item_id), 0);
  sample.push({ name: nameOf.get(mid), price: priceOf.get(mid), cogs: Math.round(cogs * 100) / 100 });
}
sample.sort((a, b) => (b.price - b.cogs) - (a.price - a.cogs));
console.log('SAMPLE DISH ECONOMICS (top 8 by margin):');
for (const s of sample.slice(0, 8)) console.log(`  ${s.name}: price ₹${s.price} · cogs ₹${s.cogs} · margin ₹${Math.round((s.price - s.cogs) * 100) / 100}`);

// Reservations book health (floor orientation)
const [rb, rt] = await Promise.all([
  db.from('reservations').select('id', { count: 'exact', head: true }),
  db.from('table_sessions').select('id', { count: 'exact', head: true }),
]);
console.log(`BOOK/SESSIONS: reservations=${rb.count} table_sessions=${rt.count}`);
