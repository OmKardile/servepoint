// qa111-unpriced: which seed menu items have recipe pricing vs not (read-only)
import { createClient } from '@supabase/supabase-js';
const db = createClient('https://gehjsxopcowmotgrrcgc.supabase.co', 'sb_publishable_igzjkrzX7PLfNI4hlI8p4g_FeqvHI32');

const { data: items } = await db.from('menu_items').select('id, name, price, active').limit(50);
const { data: costs } = await db.from('v_item_unit_cost').select('menu_item_id, unit_cost');
const priced = new Set((costs ?? []).map((r) => r.menu_item_id));
console.log('priced menu items:', (costs ?? []).length);
for (const it of items ?? []) {
  console.log(`${priced.has(it.id) ? 'PRICED ' : 'UNPRICED'} ${it.name} ₹${it.price} active=${it.active}`);
}
