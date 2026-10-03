// qa120-roundtrip: bin-safe alarm round-trip —
// correction-adjust Coffee beans to zero, print the stock, restore exactly.
// Reason 'correction' never feeds the bin (5.77 counts spoilage/spillage/damage only).
import { createClient } from '@supabase/supabase-js';
const db = createClient('https://gehjsxopcowmotgrrcgc.supabase.co', 'sb_publishable_igzjkrzX7PLfNI4hlI8p4g_FeqvHI32');
const { error: eAuth } = await db.auth.signInWithPassword({ email: 'admin@tsos.dev', password: 'admin123456' });
if (eAuth) { console.error('AUTH refused:', eAuth.message); process.exit(2); }

const step = process.argv[2] || 'down';
const { data: rows, error: e } = await db
  .from('inventory_items')
  .select('id, name, current_stock')
  .ilike('name', 'Coffee beans');
if (e || !rows?.length) { console.error('fetch:', e?.message || 'not found'); process.exit(1); }
const it = rows[0];
const stock = Number(it.current_stock);

if (step === 'down') {
  const { error: e2 } = await db.rpc('sp_adjust_stock', {
    p_inventory_item_id: it.id, p_qty: -stock, p_reason: 'correction', p_note: 'QA120 coverage round-trip — shelf to zero',
  });
  if (e2) { console.error('adjust:', e2.message); process.exit(1); }
  console.log(`DOWN: ${it.name} ${stock}g -> 0 (correction, bin-safe)`);
} else {
  const { data: up } = await db.rpc('sp_adjust_stock', {
    p_inventory_item_id: it.id, p_qty: stock, p_reason: 'correction', p_note: 'QA120 coverage round-trip — shelf restored',
  });
  if (up === undefined) { console.error('restore rpc failed'); process.exit(1); }
  const { data: after } = await db.from('inventory_items').select('current_stock').eq('id', it.id).single();
  console.log(`UP: ${it.name} restored -> ${Number(after?.current_stock)}g (was ${stock}g before round-trip)`);
}
