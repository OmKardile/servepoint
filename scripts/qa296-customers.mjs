// qa296-customers: list recent CRM customers (E2E prep for the drawer verdict read)
import { createClient } from '@supabase/supabase-js';
const db = createClient('https://gehjsxopcowmotgrrcgc.supabase.co', 'sb_publishable_igzjkrzX7PLfNI4hlI8p4g_FeqvHI32');
await db.auth.signInWithPassword({ email: 'admin@tsos.dev', password: 'admin123456' });
const { data, error } = await db.from('customers').select('id, name, phone, created_at').order('created_at', { ascending: false }).limit(5);
if (error) { console.error('READ refused:', error.message); process.exit(3); }
console.log(JSON.stringify(data, null, 1));
