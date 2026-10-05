// qa288-token: pick a live dining table's qr_token for the guest gate/menu walk.
import { createClient } from '@supabase/supabase-js';
const db = createClient('https://gehjsxopcowmotgrrcgc.supabase.co', 'sb_publishable_igzjkrzX7PLfNI4hlI8p4g_FeqvHI32');
const { error: eAuth } = await db.auth.signInWithPassword({ email: 'admin@tsos.dev', password: 'admin123456' });
if (eAuth) { console.error('AUTH refused:', eAuth.message); process.exit(2); }

const { data: tables, error } = await db
  .from('dining_tables')
  .select('id, table_number, qr_token')
  .order('table_number', { ascending: true })
  .limit(8);
if (error) { console.error('TABLES refused:', error.message); process.exit(3); }
console.log('tables:', JSON.stringify(tables, null, 1));
const pick = tables.find((t) => t.qr_token);
if (pick) console.log('MENU_URL:', `http://127.0.0.1:3000/menu/${pick.qr_token}`);
