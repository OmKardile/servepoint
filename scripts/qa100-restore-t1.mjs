// Task 100 — surgical restore: TT1 was flipped to 'billing' by an E2E
// mis-aim (the DOM traversal clicked T1's Ask-for-bill instead of T6's).
// TT1 is an owner-decision table holding leftover #68 — this returns it to
// EXACTLY its pre-round state (occupied, active_order_id d00a805e…, no other
// column touched). Read-verify only otherwise.
import { createClient } from '@supabase/supabase-js';

const db = createClient('https://gehjsxopcowmotgrrcgc.supabase.co', 'sb_publishable_igzjkrzX7PLfNI4hlI8p4g_FeqvHI32');
const { data: auth, error: authErr } = await db.auth.signInWithPassword({
  email: 'admin@tsos.dev',
  password: 'admin123456',
});
if (authErr) {
  console.log('auth FAIL:', authErr.message);
  process.exit(1);
}
const T = 'd207be19-e86f-4780-befb-3968831a38fe';

const { data: before } = await db
  .from('dining_tables')
  .select('id, table_number, status, active_order_id')
  .eq('tenant_id', T)
  .eq('table_number', 'T1')
  .single();
console.log('before:', before?.table_number, before?.status, before?.active_order_id?.slice(0, 8));

const { error } = await db
  .from('dining_tables')
  .update({ status: 'occupied', updated_at: new Date().toISOString() })
  .eq('id', before.id)
  .eq('tenant_id', T)
  .eq('active_order_id', before.active_order_id); // only if still holding the same ticket
if (error) {
  console.log('restore FAIL:', error.message);
  process.exit(1);
}

const { data: after } = await db
  .from('dining_tables')
  .select('table_number, status, active_order_id')
  .eq('id', before.id)
  .single();
console.log('after:', after?.table_number, after?.status, after?.active_order_id?.slice(0, 8));
console.log('restored to pre-round state' && `restored: ${after?.status}`);
