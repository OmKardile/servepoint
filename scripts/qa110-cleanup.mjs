// Task 110 — surgical cleanup after the offer-scorecard E2E. The fixture
// offer was created by the real UI, applied by the real drawer, and rode
// ticket #122; the redemption ledger row and the usage_count bump are real
// writes that must not pollute the season. Return the cloud to pre-round:
//   1. DELETE the fixture offer (its redemption row CASCADEs away)
//   2. the ticket never fired and never took money: advance new→cancelled
//      via the guarded engine RPC (a legal hop — writes honest history)
// Every write is re-verified after it lands.
import { createClient } from '@supabase/supabase-js';

const db = createClient('https://gehjsxopcowmotgrrcgc.supabase.co', 'sb_publishable_igzjkrzX7PLfNI4hlI8p4g_FeqvHI32');
const { error: authErr } = await db.auth.signInWithPassword({
  email: 'admin@tsos.dev',
  password: 'admin123456',
});
if (authErr) {
  console.log('auth FAIL:', authErr.message);
  process.exit(1);
}
const T = 'd207be19-e86f-4780-befb-3968831a38fe';
const TITLE = 'Blue hour muffin — flat 30 off';
const NUM = Number(process.argv[2] || 122);

// 1 — the fixture offer (redemption CASCADEs; usage_count dies with the row)
const offDel = await db.from('offers').delete().eq('tenant_id', T).eq('title', TITLE);
console.log('offer delete:', offDel.error ? `FAIL ${offDel.error.message}` : 'ok');

// 2 — the ticket: new→cancelled through the guarded engine RPC
const { data: o } = await db
  .from('orders')
  .select('id, order_number, status, payment_status')
  .eq('tenant_id', T)
  .eq('order_number', NUM)
  .maybeSingle();
if (!o) {
  console.log(`order #${NUM}: NOT FOUND — nothing else to clean`);
} else {
  console.log('before:', JSON.stringify(o));
  if (o.status === 'new' || o.status === 'pending') {
    const adv = await db.rpc('sp_advance_order', { p_order_id: o.id, p_to_status: 'cancelled' });
    console.log('advance cancelled:', adv.error ? `FAIL ${adv.error.message}` : 'ok');
  } else {
    console.log(`order status is ${o.status} — unexpected for this fixture, NOT touching it`);
  }
}

// verify
const { count: offerLeft } = await db
  .from('offers')
  .select('*', { count: 'exact', head: true })
  .eq('tenant_id', T)
  .eq('title', TITLE);
const { data: after } = await db
  .from('orders')
  .select('status, payment_status')
  .eq('order_number', NUM)
  .maybeSingle();
const { count: redLeft } = await db
  .from('offer_redemptions')
  .select('*', { count: 'exact', head: true })
  .eq('tenant_id', T)
  .eq('order_id', o?.id ?? '00000000-0000-0000-0000-000000000000');
console.log('after:', JSON.stringify(after), `| fixture offers left: ${offerLeft}`, `| redemptions left: ${redLeft}`);
const clean = offerLeft === 0 && after?.status === 'cancelled' && redLeft === 0;
console.log(clean ? 'clean: YES' : 'clean: NO');
process.exit(clean ? 0 : 1);
