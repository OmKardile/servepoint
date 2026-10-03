// qa111-truth2: discriminate reset-vs-RLS; inventory the ledgers Reports reads.
import { createClient } from '@supabase/supabase-js';
const db = createClient('https://gehjsxopcowmotgrrcgc.supabase.co', 'sb_publishable_igzjkrzX7PLfNI4hlI8p4g_FeqvHI32');

const count = async (t) => {
  const { count: c, error } = await db.from(t).select('*', { count: 'exact', head: true });
  return error ? `${t}: ERR ${error.code}` : `${t}: ${c}`;
};

const tables = ['customers', 'offers', 'offer_redemptions', 'feedback', 'notifications', 'inventory_items', 'unit_costs', 'dining_tables', 'table_sessions', 'order_items', 'reservations'];
for (const t of tables) console.log(await count(t));

// feedback body check (count=null oddity)
const { data: f, error: fe } = await db.from('feedback').select('id, rating, comment').limit(3);
console.log('feedback body:', fe ? `ERR ${fe.code} ${fe.message}` : (f?.length ? JSON.stringify(f) : 'EMPTY'));

// what does the highest-id order look like (created_at tells WHEN the reseed happened)
const { data: o } = await db.from('orders').select('order_number, status, created_at').order('id', { ascending: false }).limit(1);
console.log('newest-id order:', JSON.stringify(o));

// offer rows: did Task 110's fixture offer vanish? do the 2 standing offers exist?
const { data: of } = await db.from('offers').select('title, active').limit(5);
console.log('offers:', JSON.stringify(of));
