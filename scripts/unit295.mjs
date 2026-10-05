/**
 * unit295 — v5.256.0 "the bill hears the verdict".
 *
 * The guest's verdict (stars + word) lived in the order_feedback ledger and
 * was read only in aggregates — the dashboard's guest-love card, Reports'
 * quotes ledger. The operator looking at THAT bill never heard THIS guest.
 * This round the counter's bill detail panel grows the verdict row:
 *   1. THE READER EXISTS — fetchOrderFeedback reads ONE row (UNIQUE
 *      (order_id) → maybeSingle, never a list), fail-soft to null.
 *   2. THE READ RIDES THE SELECTION — the effect keys on selectedId, starts
 *      from honest absence, and a failed read renders as no row (never an
 *      error banner).
 *   3. THE ROW SITS AFTER THE KITCHEN NOTE — the words-family seat order on
 *      the detail panel.
 *   4. THE VERDICT IS NEVER CUT — the comment renders VERBATIM (trimmed),
 *      break-words, no truncate and no line-clamp in the block; the footer
 *      names the guest when the ticket carried an identity.
 *   5. THE TONE LAW IS THE DASHBOARD'S LAW — verdictTone passes a single
 *      rating through the SAME thresholds and the SAME words as the
 *      GuestLoveCard (≥4.5 loved green, ≥3.5 good gold, below listen-up
 *      red). One voice, never a fork — pinned against the dashboard's own
 *      source text AND executed live.
 *   6. THE ABSENCE IS HONEST — no verdict, no row; the gate is the render.
 *   7. THE VERSION LAW, the agreement shape — version.ts's live word and
 *      sw.js's cache name agree (the rider moves, the law does not).
 *
 * Run: bunx vite-node scripts/unit295.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { verdictTone } from '../src/lib/verdict.ts';

let n = 0;
const ok = (s) => { n++; console.log(`  ok ${n} — ${s}`); };

const api = readFileSync('src/lib/api.ts', 'utf8');
const bills = readFileSync('src/components/bills/BillsScreen.tsx', 'utf8');
const dashboard = readFileSync('src/components/dashboard/DashboardScreen.tsx', 'utf8');
const versionTs = readFileSync('src/version.ts', 'utf8');
const swJs = readFileSync('public/sw.js', 'utf8');

/* 1 — the reader exists: one row, fail-soft. */
{
  const idx = api.indexOf('export async function fetchOrderFeedback');
  assert.ok(idx > 0, 'fetchOrderFeedback is in the api lib');
  const fn = api.slice(idx, idx + 1400);
  assert.ok(fn.includes(".eq('order_id', orderId)"), 'the read is keyed to the order');
  assert.ok(fn.includes('.maybeSingle()'), 'ONE row per order — maybeSingle, never a list (UNIQUE(order_id))');
  assert.ok(fn.includes('if (error || !data) return null;'), 'an error or an empty read honestly returns null');
  assert.ok(fn.includes('catch') && fn.includes('return null;'), 'the read fails soft — never throws');
  ok('the ledger reader exists: one row, fail-soft, RLS-scoped');
}

/* 2 — the read rides the selection. */
{
  const idx = bills.indexOf('const [verdict, setVerdict] = useState<OrderVerdict | null>(null);');
  assert.ok(idx > 0, 'the verdict state lives on the bills screen');
  const block = bills.slice(idx, idx + 1000);
  assert.ok(block.includes('setVerdict(null); // honest absence until the read lands'), 'the selection starts from honest absence');
  assert.ok(block.includes('fetchOrderFeedback(selectedId)'), 'the read is keyed to the selected order');
  assert.ok(block.includes('}, [selectedId]);'), 'the effect re-reads when the selection moves');
  assert.ok(block.includes('live = false;'), 'a stale selection cannot answer a newer one (the live-flag cleanup)');
  ok('the read rides the selection: fresh absence, keyed read, stale-proof');
}

/* 3 — the row sits after the kitchen note. */
{
  const noteIdx = bills.indexOf('Kitchen note');
  const verdictIdx = bills.indexOf('Guest verdict');
  assert.ok(noteIdx > 0 && verdictIdx > noteIdx, 'the verdict row takes the seat after the kitchen note (the words-family order)');
  ok('the words-family seat order holds: kitchen note, then the verdict');
}

/* 4 — the verdict is never cut, and names the guest. */
{
  const rowIdx = bills.indexOf('{verdict && (');
  assert.ok(rowIdx > 0, 'the render is gated on the verdict itself');
  const block = bills.slice(rowIdx, rowIdx + 2400);
  assert.ok(block.includes('break-words'), 'the comment wraps — never overflows');
  assert.ok(!block.includes('truncate'), 'truncate is GONE from the verdict block (the 294 law)');
  assert.ok(!block.includes('line-clamp'), 'no line-clamp in the verdict block — the word reads whole');
  assert.ok(block.includes('{verdict.comment.trim()}'), 'the word is spoken VERBATIM (trimmed)');
  assert.ok(block.includes("verdict.comment.trim().length > 0"), 'the word is gated on non-blank — no empty quotes row');
  assert.ok(block.includes('selected.customer_name'), 'the footer names the guest when the ticket carried an identity');
  ok('the verdict is never cut, in the gold family, with the guest named');
}

/* 5 — the tone law is the dashboard's law (pinned AND executed). */
{
  const words = [
    { threshold: '4.5', color: '#2E7D32', bg: '#2E7D3214', word: 'guests love it' },
    { threshold: '3.5', color: '#8A5A00', bg: '#8A5A0014', word: 'good — keep going' },
    { threshold: null, color: '#B3261E', bg: '#B3261E14', word: 'listen up — guests are not happy' },
  ];
  for (const w of words) {
    assert.ok(dashboard.includes(`word: '${w.word}'`), `the dashboard speaks '${w.word}' (the law's home)`);
    assert.ok(dashboard.includes(`'${w.color}'`) && dashboard.includes(`'${w.bg}'`), `the dashboard's ink for '${w.word}' is ${w.color}`);
    assert.ok(dashboard.includes(`>= ${w.threshold}`) === (w.threshold !== null), `the dashboard's threshold for '${w.word}'`);
  }
  assert.ok(verdictTone(5).word === 'guests love it', 'executed: 5 stars → guests love it');
  assert.ok(verdictTone(4).word === 'good — keep going', 'executed: 4 stars → good — keep going');
  assert.ok(verdictTone(3).word === 'listen up — guests are not happy', 'executed: 3 stars → listen up');
  assert.ok(verdictTone(4.5).word === 'guests love it' && verdictTone(3.5).word === 'good — keep going', 'executed: the boundaries agree with the dashboard (>=)');
  assert.deepStrictEqual(verdictTone(4), { color: '#8A5A00', bg: '#8A5A0014', word: 'good — keep going' }, 'executed: the ink rides the word');
  ok("the tone law is the dashboard's own law — same thresholds, same words, same ink (pinned + executed)");
}

/* 6 — the absence is honest. */
{
  assert.ok(bills.includes('{verdict && ('), 'no verdict → no row (the gate is the render)');
  assert.ok(!bills.includes("verdict !== undefined"), 'absence is null, not undefined-pedantry');
  ok('an unrated or failed read renders nothing — honest absence, never a banner');
}

/* 7 — the version law, the agreement shape. */
{
  const v = versionTs.match(/APP_VERSION = '([^']+)'/)?.[1] ?? '';
  assert.ok(v.length > 0, 'APP_VERSION is present');
  assert.ok(swJs.includes(`const VERSION = "servepoint-v${v}-r1";`), `the SW cache name is servepoint-v${v}-r1 (old shells re-fetch)`);
  ok(`the version law holds: version.ts and sw.js agree on ${v}`);
}

/* 8 — the thanks that stayed (the round's bug, found live, fixed client-side). */
{
  const guest = readFileSync('src/components/guest/GuestPages.tsx', 'utf8');
  assert.ok(guest.includes('rated = order.feedback_rating ?? tab?.rating ?? null;'), 'server truth first, the tab\'s own accepted act second');
  assert.ok(guest.includes('readGuestTabFeedback(order.id)'), 'the tab act is read at mount (the reload keeps the thanks)');
  assert.ok(guest.includes('writeGuestTabFeedback(order.id, picked, word)'), 'the accepted act is written at submit');
  assert.ok(guest.includes('`sp.guest.fb.${orderId}`'), 'keyed by ORDER ID — the ticket\'s own deed, not the session\'s');
  assert.ok(guest.includes('Number.isInteger(rating) || rating < 1 || rating > 5'), 'an unreadable/corrupt act is rejected — the form asks honestly');
  ok('the thanks that stayed: the poll can no longer ask the guest to rate twice');
}

/* 9 — the guest hears their own word back. */
{
  const guest = readFileSync('src/components/guest/GuestPages.tsx', 'utf8');
  const idx = guest.indexOf('{tab?.comment && (');
  assert.ok(idx > 0, 'the thanks card echoes the tab\'s word');
  const echo = guest.slice(idx, idx + 300);
  assert.ok(echo.includes('break-words'), 'the echo wraps — never overflows');
  assert.ok(!echo.includes('truncate') && !echo.includes('line-clamp'), 'the echo is never cut (the 294 law)');
  assert.ok(echo.includes('{tab.comment}'), 'the word is spoken VERBATIM');
  ok('the thank-you speaks the guest\'s own word back, verbatim, uncut');
}

/* 10 — migration 039 sits ready (the server half, owner-word gated). */
{
  const mig = readFileSync('supabase/migrations/039_track_payload_whole.sql', 'utf8');
  assert.ok(mig.includes('PREPARED, NOT YET APPLIED'), 'the file says its own status honestly — no applied-claim without a run');
  for (const field of ['feedback_rating', 'offer_title', 'discount_amount', 'fssai_number']) {
    assert.ok(mig.includes(`'${field}'`), `the merged payload carries ${field}`);
    assert.ok(mig.includes(`039 verification failed: sp_get_public_order missing ${field}`), `the migration verifies ${field} at run time (025 shipped without a guard — never again)`);
  }
  assert.ok(mig.includes('GRANT EXECUTE ON FUNCTION public.sp_get_public_order(uuid) TO anon, authenticated;'), 'the guest door stays open (anon EXECUTE)');
  ok('migration 039: the FULL merge (017 + 019 + 025 + 037), ready for the owner word');
}

/* 11 — ALREADY is acceptance, not failure (the round's second live find). */
{
  const guest = readFileSync('src/components/guest/GuestPages.tsx', 'utf8');
  assert.ok(guest.includes("res.is_valid || res.error === 'ALREADY'"), 'the submit accepts the replay word — ALREADY means the counter heard the guest');
  assert.ok(!/if \(res\.is_valid\) \{\n\s*const word/.test(guest), 'the old bare is_valid gate (which accused the guest of failure) is extinct');
  const mig = readFileSync('supabase/migrations/039_track_payload_whole.sql', 'utf8');
  assert.ok(mig.includes("'replayed', true"), "039's replay returns the stored word with a replayed marker — the contract's truth");
  assert.ok(mig.includes('039 verification failed: the submit replay still speaks ALREADY-failure'), '039 verifies its own replay contract at run time');
  ok("ALREADY is acceptance: no replayed rating is ever called a failure again");
}

console.log(`\nunit295 — ${n} checks, all green.`);
