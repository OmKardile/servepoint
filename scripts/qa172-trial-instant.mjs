import { createClient } from '@supabase/supabase-js';
const db = createClient('https://gehjsxopcowmotgrrcgc.supabase.co', 'sb_publishable_igzjkrzX7PLfNI4hlI8p4g_FeqvHI32');
await db.auth.signInWithPassword({ email: 'admin@tsos.dev', password: 'admin123456' });
const { data } = await db.from('subscriptions').select('tenant_id, plan_id, status, trial_end, next_billing_at');
console.log(JSON.stringify(data, null, 1));
