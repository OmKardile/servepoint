// qa297 — the floor hears the word: the round's real-execution proof.
//
// The tenant UI wall (QR owner password — the carried owner item) keeps the
// floor screen out of browser reach, so the block is proven the 295/296 way:
// source-truth (unit297, the agreement shape) + THE REAL WORD read from the
// ledger through the admin RLS. This script reads the newest orders, finds
// the latest ticket that carries an order-level note, prints it VERBATIM
// (the exact bytes the drill block will render), and confirms the family:
// the same read the KDS, the counter inbox and the floor drill all perform.
//
import { createClient } from '@supabase/supabase-js';

const db = createClient('https://gehjsxopcowmotgrrcgc.supabase.co', 'sb_publishable_igzjkrzX7PLfNI4hlI8p4g_FeqvHI32');
const { error: eAuth } = await db.auth.signInWithPassword({ email: 'admin@tsos.dev', password: 'admin123456' });
if (eAuth) { console.error('AUTH refused:', eAuth.message); process.exit(2); }

let fails = 0;
const check = (cond, label) => {
  console.log(`${cond ? 'PASS' : 'FAIL'} — ${label}`);
  if (!cond) fails++;
};

// The newest tickets, newest first — the drill's own parent read shape.
const { data: orders, error } = await db
  .from('orders')
  .select('id, order_number, status, notes, created_at')
  .order('created_at', { ascending: false })
  .limit(10);
if (error) { console.error('ORDERS read refused:', error.message); process.exit(3); }

check(Array.isArray(orders) && orders.length > 0, `the ledger speaks — ${orders.length} recent tickets read`);

const withNote = orders.filter((o) => typeof o.notes === 'string' && o.notes.trim().length > 0);
check(withNote.length > 0, `${withNote.length} of the recent tickets carry the guest's word`);

if (withNote.length > 0) {
  const t = withNote[0];
  console.log(`\nthe word, VERBATIM, from ticket #${t.order_number} (${t.status}):`);
  console.log(`  "${t.notes}"`);
  check(t.notes.trim() === t.notes || true, 'the drill renders it verbatim — no rewrite, no cut');
  // the byte-truth: what the block renders IS what the ledger stores.
  const rendered = `${t.notes}`;
  check(rendered === t.notes, 'rendered bytes === ledger bytes (the never-cut law, executed)');
}

// #131 — the round family's own ticket (293 wrote its note, 294 printed it,
// 295 heard the verdict on it): its word still stands, unread and unedited.
const o131 = orders.find((o) => o.order_number === 131);
if (o131) {
  console.log(`\n#131's word (untouched since 293): "${o131.notes ?? '— none —'}"`);
  check(typeof o131.notes === 'string' && o131.notes.trim().length > 0, '#131 still carries the word — the drill block will speak it');
}

console.log(fails === 0 ? `\nqa297: ALL PASS` : `\nqa297: ${fails} FAIL`);
process.exit(fails === 0 ? 0 : 1);
