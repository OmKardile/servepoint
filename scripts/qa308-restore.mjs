// qa308-restore: the walk is over — the ticket returns to its fresh state
// (the qa106/qa109 cleanup precedent: QA leaves the cloud as it found it).
import { createClient } from '@supabase/supabase-js';

const ORDER_131 = '27e2db55-b053-4784-9c4f-28797c69a34c';
const db = createClient(
  'https://gehjsxopcowmotgrrcgc.supabase.co',
  'sb_publishable_igzjkrzX7PLfNI4hlI8p4g_FeqvHI32'
);
const { error: eAuth } = await db.auth.signInWithPassword({ email: 'admin@tsos.dev', password: 'admin123456' });
if (eAuth) { console.error('AUTH refused:', eAuth.message); process.exit(2); }

const { error: eUpd } = await db
  .from('orders')
  .update({ status: 'new', updated_at: new Date().toISOString() })
  .eq('id', ORDER_131)
  .eq('status', 'completed'); // idempotence guard: only the completed state reverts
if (eUpd) { console.error('RESTORE refused:', eUpd.message); process.exit(4); }

const { data: after } = await db.from('orders').select('status').eq('id', ORDER_131).single();
console.log('restored:', after?.status);
