// qa294-track: fetch order #131's id for the guest ticket walk.
import { createClient } from '@supabase/supabase-js';
const db = createClient('https://gehjsxopcowmotgrrcgc.supabase.co', 'sb_publishable_igzjkrzX7PLfNI4hlI8p4g_FeqvHI32');
await db.auth.signInWithPassword({ email: 'admin@tsos.dev', password: 'admin123456' });
const { data } = await db.from('orders').select('id,order_number,notes,payment_status').eq('order_number', 131).maybeSingle();
console.log(JSON.stringify(data));
