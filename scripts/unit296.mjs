/**
 * unit296 — v5.257.0 "the CRM hears the voice".
 *
 * The ledger knew WHO since 5.70.0 (the recover list names the callback),
 * but the guest's own CRM profile never spoke their words — an owner
 * investigating a guest read their tickets, their redemptions, their
 * usual… and not one rating they left. This round the CRM's detail drawer
 * grows THEIR WORDS:
 *   1. THE READER EXISTS — fetchCustomerFeedback reads the guest's verdict
 *      rows through the PHONE join (orders!inner keyed on customer_phone —
 *      the CRM's identity key, the book join's own law), tenant-scoped,
 *      newest first, capped.
 *   2. THE READ RIDES THE DRAWER'S OPEN — keyed on the customer's phone,
 *      honest absence first, fail-soft to silence.
 *   3. THE SUMMARY WEARS THE ONE TONE LAW — guestVoice (lib/verdict) turns
 *      the history into count + average + the dashboard's own tone word;
 *      the same thresholds and words as the GuestLoveCard and the bill's
 *      row. Pinned against the dashboard's source AND executed.
 *   4. THE WORDS ARE NEVER CUT — every quote renders VERBATIM (trimmed),
 *      break-words, no truncate/line-clamp in the block.
 *   5. THE SILENCE IS HONEST — unread (null) and empty ([]) both render
 *      nothing; a quote-less history shows the summary without an empty
 *      quotes list.
 *   6. THE SEAT — the block sits after THE USUAL's fallbacks, before the
 *      GIVEN AWAY ledger (the drawer's fact order).
 *   7. THE VERSION LAW, the agreement shape.
 *
 * Run: bunx vite-node scripts/unit296.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { guestVoice, verdictTone } from '../src/lib/verdict.ts';

let n = 0;
const ok = (s) => { n++; console.log(`  ok ${n} — ${s}`); };

const api = readFileSync('src/lib/api.ts', 'utf8');
const crm = readFileSync('src/components/customers/CustomersScreen.tsx', 'utf8');
const dashboard = readFileSync('src/components/dashboard/DashboardScreen.tsx', 'utf8');
const versionTs = readFileSync('src/version.ts', 'utf8');
const swJs = readFileSync('public/sw.js', 'utf8');

/* 1 — the reader exists: the phone join, scoped, capped. */
{
  const idx = api.indexOf('export async function fetchCustomerFeedback');
  assert.ok(idx > 0, 'fetchCustomerFeedback is in the api lib');
  const fn = api.slice(idx, idx + 1300);
  assert.ok(fn.includes(".select('rating, comment, created_at, orders!inner(order_number, customer_phone, customer_name)')"), 'the read joins orders!inner and asks the identity columns');
  assert.ok(fn.includes(".eq('orders.customer_phone', phone)"), 'the join is the PHONE — the CRM identity key, never a guess');
  assert.ok(fn.includes(".eq('tenant_id', tenantId)"), 'the read is tenant-scoped (RLS alongside)');
  assert.ok(fn.includes(".order('created_at', { ascending: false })"), 'newest first — the freshest word leads');
  assert.ok(fn.includes('limit = 20'), 'the drawer read is capped — a decade of visits stays bounded');
  ok('the guest verdict reader exists: phone join, scoped, newest-first, capped');
}

/* 2 — the read rides the drawer's open. */
{
  const idx = crm.indexOf('const [verdicts, setVerdicts] = useState<FeedbackRow[] | null>(null);');
  assert.ok(idx > 0, 'the verdict state lives on the CRM drawer');
  const block = crm.slice(idx, idx + 1700);
  assert.ok(block.includes('setVerdicts(null); // honest absence until the read lands'), 'the open starts from honest absence');
  assert.ok(block.includes('fetchCustomerFeedback(tenantId, customer.phone)'), 'the read is keyed to the drawer guest (tenant + phone)');
  assert.ok(block.includes(".catch(() => {\n        if (alive) setVerdicts(null);\n      })"), 'a failed read lands as silence — never an error, never a spin');
  assert.ok(block.includes('alive = false;'), 'a stale drawer cannot answer a newer one (the live-flag cleanup)');
  ok('the read rides the drawer open: fresh absence, keyed read, fail-soft, stale-proof');
}

/* 3 — the summary wears the ONE tone law (pinned AND executed). */
{
  assert.ok(crm.includes("import { guestVoice } from '../../lib/verdict';"), 'the drawer asks lib/verdict — the shared law, never a fork');
  const words = [
    { threshold: '4.5', color: '#2E7D32', bg: '#2E7D3214', word: 'guests love it' },
    { threshold: '3.5', color: '#8A5A00', bg: '#8A5A0014', word: 'good — keep going' },
    { threshold: null, color: '#B3261E', bg: '#B3261E14', word: 'listen up — guests are not happy' },
  ];
  for (const w of words) {
    assert.ok(dashboard.includes(`word: '${w.word}'`), `the dashboard speaks '${w.word}' (the law's home)`);
    assert.ok(dashboard.includes(`'${w.color}'`) && dashboard.includes(`'${w.bg}'`), `the dashboard's ink for '${w.word}' is ${w.color}`);
  }
  assert.ok(guestVoice([]) === null, 'executed: empty history → null (silence, not a fabricated zero)');
  assert.ok(guestVoice(null) === null && guestVoice(undefined) === null, 'executed: unread ledger → null (the GIVEN AWAY rule, applied to words)');
  const one = guestVoice([{ rating: 4 }]);
  assert.ok(one && one.count === 1 && one.avg === 4 && one.tone.word === 'good — keep going', 'executed: one 4★ verdict → good — keep going');
  const two = guestVoice([{ rating: 5 }, { rating: 2 }]);
  assert.ok(two && two.avg === 3.5 && two.tone.word === 'good — keep going', 'executed: 5★+2★ averages 3.5 — the boundary belongs to gold');
  assert.deepStrictEqual(guestVoice([{ rating: 2 }])?.tone, verdictTone(2), 'executed: the tone rides the SAME verdictTone the bill row uses');
  ok("the summary wears the ONE tone law — same thresholds, same words, same ink (pinned + executed)");
}

/* 4 — the words are never cut. */
{
  const idx = crm.indexOf("THEIR WORDS, the guest's verdict history");
  assert.ok(idx > 0, 'the block is this round\'s');
  const block = crm.slice(idx, idx + 3400);
  assert.ok(block.includes('break-words'), 'the quote wraps — never overflows');
  assert.ok(!block.includes('truncate'), 'truncate is GONE from the words block (the 294 law)');
  assert.ok(!block.includes('line-clamp'), 'no line-clamp in the words block — the word reads whole');
  assert.ok(block.includes('{v.comment.trim()}'), 'the word is spoken VERBATIM (trimmed)');
  assert.ok(block.includes('v.comment.trim().length > 0'), 'the quotes list is gated on non-blank words — no empty quotes row');
  ok('their words are never cut, in the reports family\'s gold-quote styling');
}

/* 5 — the silence is honest. */
{
  const idx = crm.indexOf('verdicts !== null && verdicts.length > 0');
  assert.ok(idx > 0, 'the render gates on a read that LANDED and a history that EXISTS');
  ok('unread or empty → no block — an invented verdict is a lie the CRM cannot undo');
}

/* 6 — the seat: after THE USUAL's fallbacks, before GIVEN AWAY. */
{
  const noUsual = crm.indexOf("No usual yet — their first paid ticket will name it.");
  const words = crm.indexOf("THEIR WORDS, the guest's verdict history");
  const given = crm.indexOf('GIVEN AWAY, the guest\'s side of the ledger');
  assert.ok(noUsual > 0 && words > noUsual, 'their words take the seat after the usual\'s fallbacks');
  assert.ok(given > words, 'the GIVEN AWAY ledger keeps its seat after the words');
  ok('the drawer\'s fact order holds: usual → their words → given away');
}

/* 7 — the version law, the agreement shape. */
{
  const v = versionTs.match(/APP_VERSION = '([^']+)'/)?.[1] ?? '';
  assert.ok(v.length > 0, 'APP_VERSION is present');
  assert.ok(swJs.includes(`const VERSION = "servepoint-v${v}-r1";`), `the SW cache name is servepoint-v${v}-r1 (old shells re-fetch)`);
  ok(`the version law holds: version.ts and sw.js agree on ${v}`);
}

console.log(`\nunit296 — ${n} checks, all green.`);
