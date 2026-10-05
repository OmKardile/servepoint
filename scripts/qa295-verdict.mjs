// qa295-verdict — the round's real-execution proof, two halves:
//   A. the guest half ALREADY ran live (agent-browser walked the track page
//      for #130, picked 4 stars, typed the word, sent it — thanks card shown
//      from server truth). This script verifies what LANDED.
//   B. the counter half: read the verdict back through the same shape the
//      bill detail panel uses (one row, keyed by order id), execute the
//      tone law on the real rating, and prove the absence law on #131
//      (an unrated ticket reads as null — no row, honestly).
import { createClient } from '@supabase/supabase-js';
import { verdictTone } from '../src/lib/verdict.ts';

const db = createClient('https://gehjsxopcowmotgrrcgc.supabase.co', 'sb_publishable_igzjkrzX7PLfNI4hlI8p4g_FeqvHI32');
const { error: eAuth } = await db.auth.signInWithPassword({ email: 'admin@tsos.dev', password: 'admin123456' });
if (eAuth) { console.error('AUTH refused:', eAuth.message); process.exit(2); }

const ORDER_130 = 'df6d3c15-14f3-46f0-acf1-2c5952afc557';
const ORDER_131 = '27e2db55-b053-4784-9c4f-28797c69a34c';

let fails = 0;
const check = (cond, label) => {
  console.log(`${cond ? 'PASS' : 'FAIL'} — ${label}`);
  if (!cond) fails++;
};

// A — what landed.
const { data: rows, error } = await db
  .from('order_feedback')
  .select('order_id, rating, comment, created_at')
  .eq('order_id', ORDER_130)
  .maybeSingle();
if (error) { console.error('READ refused:', error.message); process.exit(3); }
check(rows != null, 'the guest\'s verdict LANDED in the order_feedback ledger (one row for #130)');
check(rows?.rating === 4, `the stars are server truth: rating ${rows?.rating} (the guest picked 4)`);
const WORD = 'Loved the paneer tikka — the masala chai could be hotter though.';
check(rows?.comment === WORD, 'the word came home VERBATIM');

// B — the tone law on the real rating.
const tone = verdictTone(rows?.rating ?? 0);
check(tone.word === 'good — keep going', `the bill's tone chip speaks the dashboard's law: '${tone.word}' (${rows?.rating}/5)`);

// C — the absence law on an unrated ticket.
const { data: none } = await db
  .from('order_feedback')
  .select('order_id, rating, comment, created_at')
  .eq('order_id', ORDER_131)
  .maybeSingle();
check(none == null, '#131 (unrated) reads as null — the bill renders no verdict row, honestly');

console.log(fails === 0 ? '\nqa295 — all green.' : `\nqa295 — ${fails} FAILED`);
process.exit(fails === 0 ? 0 : 1);
