// qa111-truth: investigate census anomalies (payments 0? new order?)
import { createClient } from '@supabase/supabase-js';
const db = createClient('https://gehjsxopcowmotgrrcgc.supabase.co', 'sb_publishable_igzjkrzX7PLfNI4hlI8p4g_FeqvHI32');

// A: newest 5 orders with status
const { data: fresh, error: e1 } = await db.from('orders').select('id, order_number, status, total, created_at').order('id', { ascending: false }).limit(5);
console.log('A newest orders:', e1 ? `ERR ${e1.message}` : JSON.stringify(fresh?.map(r => `#${r.order_number} ${r.status} ₹${r.total}`)));

// B: payments — explicit error surface
const { count: pc, error: e2 } = await db.from('payments').select('id', { count: 'exact', head: true });
console.log('B payments:', `count=${pc}`, e2 ? `ERR ${e2.code} ${e2.message}` : '(no error)');

// C: sample payments rows (maybe count/head quirk)
const { data: prow, error: e3 } = await db.from('payments').select('id, order_id, amount, status').order('id', { ascending: false }).limit(3);
console.log('C payments sample:', e3 ? `ERR ${e3.code} ${e3.message}` : (prow?.length ? JSON.stringify(prow) : 'EMPTY — table truly empty'));

// D: feedback table explicit
const { count: fc, error: e4 } = await db.from('feedback').select('id', { count: 'exact', head: true });
console.log('D feedback:', `count=${fc}`, e4 ? `ERR ${e4.code} ${e4.message}` : '(no error)');

// E: order_status_history tail (what happened recently)
const { data: hist, error: e5 } = await db.from('order_status_history').select('order_id, to_status, created_at').order('created_at', { ascending: false }).limit(6);
console.log('E recent hops:', e5 ? `ERR ${e5.code} ${e5.message}` : JSON.stringify(hist));
