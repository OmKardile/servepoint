// qa114-recipe-check: read recipe_lines truth for every menu item (authenticated).
// Rationale: keyboard-driven editor navigation may have saved a stray line onto
// a seed item — verify before proceeding with the data round.
import { createClient } from '@supabase/supabase-js';
const db = createClient('https://gehjsxopcowmotgrrcgc.supabase.co', 'sb_publishable_igzjkrzX7PLfNI4hlI8p4g_FeqvHI32');

const { data: sess, error: eAuth } = await db.auth.signInWithPassword({
  email: 'admin@tsos.dev',
  password: 'admin123456',
});
if (eAuth) { console.error('AUTH refused:', eAuth.message); process.exit(2); }
console.log('AUTH ok');

const { data: items, error: e1 } = await db.from('menu_items').select('id, name, price').order('name');
if (e1) { console.error('items:', e1.message); process.exit(2); }

const { data: ings, error: e2 } = await db.from('inventory_items').select('id, name, cost_per_unit, unit').order('name');
if (e2) { console.error('ingredients:', e2.message); process.exit(2); }
const ingById = new Map((ings || []).map((i) => [i.id, i]));

const { data: lines, error: e3 } = await db.from('recipe_lines').select('menu_item_id, inventory_item_id, qty_per_serve');
if (e3) { console.error('recipe_lines:', e3.message); process.exit(2); }

for (const it of items || []) {
  const mine = (lines || []).filter((l) => l.menu_item_id === it.id);
  if (mine.length === 0) { console.log(`${it.name} (₹${it.price}): NO RECIPE`); continue; }
  let cost = 0;
  const parts = mine.map((l) => {
    const ing = ingById.get(l.inventory_item_id);
    const c = Number(l.qty_per_serve) * Number(ing?.cost_per_unit ?? 0);
    cost += c;
    return `${l.qty_per_serve}${ing?.unit ?? ''} ${ing?.name} @${ing?.cost_per_unit} = ₹${c.toFixed(2)}`;
  });
  const kept = Number(it.price) - cost;
  console.log(`${it.name} (₹${it.price}): ${parts.join(' + ')} → cost ₹${cost.toFixed(2)} · kept ₹${kept.toFixed(2)} (${Math.round((kept / Number(it.price)) * 100)}%)`);
}
process.exit(0);
