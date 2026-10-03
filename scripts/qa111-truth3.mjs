// qa111-truth3: corrected names — which 011+ schema objects survived the rebuild?
import { createClient } from '@supabase/supabase-js';
const db = createClient('https://gehjsxopcowmotgrrcgc.supabase.co', 'sb_publishable_igzjkrzX7PLfNI4hlI8p4g_FeqvHI32');

const probe = async (label, table, cols = '*') => {
  const { count, error, data } = await db.from(table).select(cols).limit(1);
  if (error) return console.log(`${label}: ${error.code} ${(error.message || '').slice(0, 70)}`);
  console.log(`${label}: OK (count~${count ?? 'n/a'}, rows≤1: ${data?.length})`);
};

// core seeds the app needs to function at all
await probe('menu_items', 'menu_items');
await probe('menu_items.checked_at', 'menu_items', 'image_url');
await probe('categories', 'categories');
await probe('menu_variants', 'menu_variants');
await probe('order_items.checked_at(029)', 'order_items', 'checked_at');
await probe('orders.checked_at(029)', 'orders', 'checked_at');

// 011+ objects
await probe('v_customer_stats(016)', 'v_customer_stats');
await probe('v_order_cogs(018)', 'v_order_cogs');
await probe('v_item_unit_cost(018)', 'v_item_unit_cost');
await probe('order_feedback(019→001)', 'order_feedback');
await probe('stock_deductions', 'stock_deductions');
await probe('staff_presence(035)', 'staff_presence');

// RPC existence: bad-args POST — PGRST202=function missing, 22P02/P0002=function exists+arg error
const rpcProbe = async (label, fn, args) => {
  const { error } = await db.rpc(fn, args);
  const code = error?.code ?? 'OK';
  const msg = (error?.message || 'no error').slice(0, 70);
  console.log(`rpc ${label}: ${code} ${msg}`);
};
await rpcProbe('sp_advance_order', 'sp_advance_order', { p_order_id: '00000000-0000-0000-0000-000000000000', p_to_status: 'cancelled' });
await rpcProbe('sp_get_public_order', 'sp_get_public_order', { p_order_id: '00000000-0000-0000-0000-000000000000' });
await rpcProbe('sp_submit_public_feedback', 'sp_submit_public_feedback', { p_order_id: '00000000-0000-0000-0000-000000000000', p_rating: 5 });
