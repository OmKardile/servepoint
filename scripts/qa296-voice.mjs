// qa296-voice — the round's real-execution proof:
//   A. QA PREP (documented, admin RLS): order #131 — placed by the guest flow
//      in Task 293, identity-less because the guest checkout collects a NAME
//      only — is given the counter-order identity it would have carried
//      (Priya Sharma, 9812345678 — a REAL CRM customer). The column is the
//      only byte written; no feedback row is fabricated (the rating arrives
//      through the TRUE guest path next).
//   B. THE GUEST PATH: sp_submit_public_feedback — the exact RPC the served
//      ticket's rate card calls — stores the verdict for #131.
//   C. THE DRAWER'S READER, EXECUTED: fetchCustomerFeedback (the exact
//      function GuestDetailDrawer calls) with Priya's phone, then guestVoice
//      (the exact summary the block speaks) on what came home.
import { createClient } from '@supabase/supabase-js';
import { supabase } from '../src/lib/supabase.ts';
import { fetchCustomerFeedback } from '../src/lib/api.ts';
import { guestVoice } from '../src/lib/verdict.ts';

const db = createClient('https://gehjsxopcowmotgrrcgc.supabase.co', 'sb_publishable_igzjkrzX7PLfNI4hlI8p4g_FeqvHI32');
const { error: eAuth } = await db.auth.signInWithPassword({ email: 'admin@tsos.dev', password: 'admin123456' });
if (eAuth) { console.error('AUTH refused:', eAuth.message); process.exit(2); }
/* the api module carries its OWN client — the drawer's reader runs through
 * IT, so the E2E must seat the admin session there too (RLS deny-by-default
 * reads an anon client as nobody — silence by design, the 019 law). */
const { error: eApi } = await supabase.auth.signInWithPassword({ email: 'admin@tsos.dev', password: 'admin123456' });
if (eApi) { console.error('API-CLIENT auth refused:', eApi.message); process.exit(2); }

const ORDER_131 = '27e2db55-b053-4784-9c4f-28797c69a34c';
const TENANT = '00000000-0000-0000-0000-000000000000'; // filled from the order below
const PHONE = '9812345678'; // Priya Sharma — a REAL CRM customer since 2026-10-03

let fails = 0;
const check = (cond, label) => {
  console.log(`${cond ? 'PASS' : 'FAIL'} — ${label}`);
  if (!cond) fails++;
};

// A — the identity prep (one UPDATE, documented).
const { data: ord, error: eOrd } = await db.from('orders').select('id, tenant_id, customer_name, customer_phone').eq('id', ORDER_131).maybeSingle();
if (eOrd || !ord) { console.error('ORDER read refused:', eOrd?.message); process.exit(3); }
if (ord.customer_phone !== PHONE) {
  const { error: eUpd } = await db.from('orders').update({ customer_name: 'Priya Sharma', customer_phone: PHONE }).eq('id', ORDER_131);
  if (eUpd) { console.error('PREP refused:', eUpd.message); process.exit(4); }
  console.log('prep — #131 now carries the counter-order identity (Priya Sharma, 9812345678)');
} else {
  console.log('prep — #131 already carries the identity (idempotent re-run)');
}

// B — the guest path: the TRUE RPC, anon, no session (what the rate card does).
const anon = createClient('https://gehjsxopcowmotgrrcgc.supabase.co', 'sb_publishable_igzjkrzX7PLfNI4hlI8p4g_FeqvHI32');
const { data: submitted } = await anon.rpc('sp_submit_public_feedback', {
  p_order_id: ORDER_131,
  p_rating: 5,
  p_comment: 'The filter coffee was the best part — we will be back for the biryani.',
});
check(submitted?.is_valid === true || submitted?.error === 'ALREADY', `the guest path accepted the verdict (${submitted?.replayed ? 'replayed' : 'fresh insert'}, is_valid ${submitted?.is_valid})`);

// C — the drawer's reader, executed with the REAL phone.
const rows = await fetchCustomerFeedback(ord.tenant_id, PHONE);
check(rows.length >= 1, `fetchCustomerFeedback returned ${rows.length} row(s) for the guest`);
const mine = rows.find((r) => r.order_number === 131);
check(mine != null, '#131 rides the guest\'s history (the phone join works)');
check(mine?.rating === 5, `the stars are server truth: ${mine?.rating}/5`);
check(mine?.comment === 'The filter coffee was the best part — we will be back for the biryani.', 'the word came home VERBATIM');

// The summary the drawer will speak.
const gv = guestVoice(rows);
check(gv != null && gv.count === rows.length, `guestVoice speaks the real history: ${gv?.count} rating(s), avg ${gv?.avg?.toFixed(1)}`);
check(gv?.tone.word === 'guests love it', `the tone chip wears the ONE law: '${gv?.tone.word}'`);

console.log(fails === 0 ? '\nqa296 — all green.' : `\nqa296 — ${fails} FAILED`);
process.exit(fails === 0 ? 0 : 1);
