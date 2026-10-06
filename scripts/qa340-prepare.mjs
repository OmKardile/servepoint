// qa340-prepare: v5.301.0 E2E — place a SIBLING order at table t1 from a
// DIFFERENT guest (the script), so the menu's new "Live at this table"
// panel can prove it speaks the TABLE's tickets, not just the tab's own.
// Prints the sibling's order number + id for the walk.
import { createClient } from '@supabase/supabase-js';

const db = createClient('https://gehjsxopcowmotgrrcgc.supabase.co', 'sb_publishable_igzjkrzX7PLfNI4hlI8p4g_FeqvHI32');
const { error: eAuth } = await db.auth.signInWithPassword({ email: 'admin@tsos.dev', password: 'admin123456' });
if (eAuth) { console.error('AUTH refused:', eAuth.message); process.exit(2); }

const { data: tenantRow } = await db.from('tenants').select('slug').limit(1);
const slug = tenantRow?.[0]?.slug;
if (!slug) { console.error('no tenant slug'); process.exit(3); }

const { data: tables, error: eT } = await db
  .from('dining_tables')
  .select('id, table_number, qr_token')
  .order('table_number', { ascending: true })
  .limit(5);
if (eT) { console.error('TABLES refused:', eT.message); process.exit(4); }
const t = (tables ?? [])[0];
if (!t?.qr_token) { console.error('no table with qr_token'); process.exit(5); }

// today's menu — the sibling orders the house's own dish
const menu = await db.rpc('sp_get_public_menu', { p_slug: slug });
if (menu.error || !menu.data?.is_valid) { console.error('MENU refused:', menu.error?.message || JSON.stringify(menu.data)); process.exit(6); }
const dish = (menu.data.categories ?? []).flatMap((c) => c.items ?? [])[0];
if (!dish?.id) { console.error('no dish on the menu'); process.exit(7); }

const placed = await db.rpc('sp_create_public_order', {
  p_qr_token: t.qr_token,
  p_table_number: String(t.table_number),
  p_items: [{ menu_item_id: dish.id, qty: 2 }],
  p_order_type: 'dine_in',
  p_customer_name: 'Table mate',
  p_notes: 'sibling proof — placed by the qa340 script',
  p_client_operation_id: `qa340-sibling-${Date.now()}`,
  p_offer_id: null,
  p_session_token: null,
});
if (placed.error) { console.error('PLACE refused:', placed.error.message); process.exit(8); }
const v = placed.data;
if (!v?.is_valid || !v?.order) { console.error('PLACE verdict:', JSON.stringify(v)); process.exit(9); }

console.log('SIBLING PLACED at table', t.table_number);
console.log('SIBLING_ORDER:', `#${v.order.order_number}`, v.order.id);
console.log('TOTAL:', v.order.total, 'STATUS:', v.order.status);
