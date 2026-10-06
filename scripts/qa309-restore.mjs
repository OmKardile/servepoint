// qa309-restore: the walk's cleanup — the description returns to what it was
// (null, the live row's own state) — the qa308-restore precedent.
import { createClient } from '@supabase/supabase-js';

const ITEM = '7314dc1a-b810-413e-ae01-866191890882'; // Classic Sandbich (CheeseBurg)
const db = createClient(
  'https://gehjsxopcowmotgrrcgc.supabase.co',
  'sb_publishable_igzjkrzX7PLfNI4hlI8p4g_FeqvHI32'
);
const { error: eAuth } = await db.auth.signInWithPassword({ email: 'admin@tsos.dev', password: 'admin123456' });
if (eAuth) { console.error('AUTH refused:', eAuth.message); process.exit(2); }

const { data, error } = await db
  .from('menu_items')
  .update({ description: null, updated_at: new Date().toISOString() })
  .eq('id', ITEM)
  .select('id, name, description')
  .single();
if (error) { console.error('RESTORE refused:', error.message); process.exit(3); }
console.log('restored:', data.name, 'description =', JSON.stringify(data.description));
