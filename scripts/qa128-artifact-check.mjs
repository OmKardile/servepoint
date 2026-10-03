// Task 128 artifact-check: two clients in ONE process, identical queries, raw JSON to file
import { writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const keyA = 'sb_publishable_igzjkrzX7PLfNI4hlI8p4g_FeqvHI32'; // from my read of qa127
const url = 'https://gehjsxopcowmotgrrcgc.supabase.co';
const a = createClient(url, keyA);

const out = {};
out.payments_a = await a.from('payments').select('id', { count: 'exact', head: true });
out.customers_a = await a.from('customers').select('id', { count: 'exact', head: true });
out.res_a = await a.from('reservations').select('id,guest_name,status').order('slot_at');
// sanitize: keep only code/message/count/data
const clean = Object.fromEntries(Object.entries(out).map(([k, r]) => [k, {
  count: r.count, error: r.error ? { code: r.error.code, msg: r.error.message.slice(0, 80) } : null,
  rows: Array.isArray(r.data) ? r.data.length : r.data,
}]));
writeFileSync('/home/z/my-project/scripts/qa128-artifact.json', JSON.stringify(clean, null, 2));
console.log('written');
