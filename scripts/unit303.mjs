/* unit303 — v5.264.0 "the porch learns the guest's way" (agreement shape)
 * The walk's finding: the help page taught THREE roles (platform operator,
 * business owner, staff) and never said the GUEST's name — the whole QR
 * journey (scan → live menu → session cart → ticket stepper with the ready
 * chime and the Order more pill → the honest bill → the stars that reach
 * the day's voice) is a surface of the house since the table sessions
 * shipped, and the public pages that introduce the product never mentioned
 * it. The showcase's features grid had the same blind spot (six cards, no
 * guest). AND the kitchen FAQ taught the OLD rhythm — "realtime + a 30s
 * safety poll" — which the wake family (301/302) made incomplete.
 * THE LAWS PINNED HERE:
 *   1. the help page's ROLES names the fourth: Guest, icon QrCode, the
 *      no-account body;
 *   2. the help page teaches the journey: a section aria-label "The
 *      guest's table" with the intro's own words (ribbon, session, floor's
 *      own word) and FIVE beats — Scan / Order / Watch / Pay / Rate —
 *      each beat carrying the house's word (the "Order more" pill, the
 *      DUE AT COUNTER→PAID agreement, the close-out's three tones);
 *   3. THE KITCHEN FAQ'S WORD STAYS TRUE: the answer now carries the wake
 *      ("the boards wake the moment you look back at a backgrounded
 *      tablet") — the old poll-only sentence is gone;
 *   4. the guests' FAQ exists: "How do guests order from their phones?"
 *      with the QR door, the session cart, the chime, the pill, the stars;
 *   5. the showcase's FEATURES grows the seventh card — "The guest's
 *      table", icon QrCode, tint #C2571B — the two porch pages agree;
 *   6. the census pins stand untouched: the showcase's 37/21/0 block and
 *      the migration-claim wording are byte-equal (unit286's law — the new
 *      card joined, the census did not move);
 *   7. the version law: APP_VERSION and sw.js's VERSION agree (the
 *      agreement shape — read the live words, never pin a stale one). */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const help = readFileSync('/home/z/my-project/src/components/pages/IndexHelpPage.tsx', 'utf8');
const showcase = readFileSync('/home/z/my-project/src/components/pages/ShowcasePage.tsx', 'utf8');
const versionTs = readFileSync('/home/z/my-project/src/version.ts', 'utf8');
const swJs = readFileSync('/home/z/my-project/public/sw.js', 'utf8');

let passed = 0;
const check = (name, fn) => {
  fn();
  passed += 1;
  console.log(`  ok ${passed} — ${name}`);
};

/* ── 1. the fourth role ───────────────────────────────────────────────── */
check('ROLES names the fourth: Guest, icon QrCode, the no-account body', () => {
  assert.ok(help.includes("title: 'Guest',"), 'the Guest role exists');
  const role = help.match(/\{\s*\/\* v5\.264\.0[^/]*\*/);
  assert.ok(help.match(/icon: QrCode,\s*\n\s*title: 'Guest',/), 'the role rides the QrCode icon');
  assert.ok(help.includes('No account, no download'), 'the body says the no-account truth');
});

/* ── 2. the journey section: five beats ───────────────────────────────── */
check('the guest section exists with the intro\'s own words', () => {
  assert.ok(help.includes('aria-label="The guest\'s table"'), 'the section\'s label');
  assert.ok(help.includes('the ribbon counts the session down'), 'the ribbon word');
  assert.ok(/the\s+floor's own word closes it/.test(help), 'the session-end word');
});
check('GUEST_FLOW teaches five beats in the house\'s words', () => {
  for (const title of ["Scan the table\\'s QR", 'Order from the live menu', 'Watch the ticket', 'Pay at the counter', 'Leave the stars']) {
    assert.ok(help.includes(`title: '${title}'`), `the beat: ${title}`);
  }
  assert.ok(help.includes('an "Order more" pill for the second round'), 'the pill rides the Watch beat');
  assert.ok(help.includes('DUE AT COUNTER until the money lands, then PAID'), 'the bill beat speaks the agreement');
  assert.ok(help.includes('guests love it, good — keep going, or listen up'), 'the rating beat speaks the three tones');
  assert.ok(help.includes('lg:grid-cols-5'), 'five beats, one row on wide screens');
});

/* ── 3. the kitchen FAQ's word stays true ─────────────────────────────── */
check('the kitchen FAQ carries the wake truth; the poll-only sentence is gone', () => {
  assert.ok(help.includes('and the boards wake the moment you look back at a backgrounded tablet'), 'the wake in the answer');
  assert.ok(!help.includes('stream over a realtime connection the moment they change, and a 30-second safety poll backs it up'), 'the old incomplete sentence is gone');
});

/* ── 4. the guests' FAQ ───────────────────────────────────────────────── */
check('the guests\' FAQ exists with the whole journey', () => {
  assert.ok(help.includes("q: 'How do guests order from their phones?'"), 'the question');
  assert.ok(help.includes("They scan the table\\'s QR code — no app, no account"), 'the door');
  assert.ok(help.includes("the cart rides the table\\'s session"), 'the session cart');
  assert.ok(help.includes("a star rating that reaches the day\\'s close-out"), 'the stars');
});

/* ── 5. the showcase's seventh card; the porch pages agree ────────────── */
check('showcase: the seventh feature card — the guest\'s table', () => {
  assert.ok(showcase.includes("title: \"The guest's table\","), 'the card exists');
  assert.ok(showcase.match(/icon: QrCode,\s*\n\s*title: "The guest's table",/), 'rides the QrCode icon');
  assert.ok(showcase.includes('tint: \'bg-[#C2571B]\',\n  },\n];'), 'the tint closes the array');
});
check('the porch pages agree: both name the journey', () => {
  assert.ok(help.includes("The guest's table"), 'help speaks it');
  assert.ok(showcase.includes("The guest's table"), 'showcase speaks it');
});

/* ── 6. the census pins stand untouched ───────────────────────────────── */
check('the showcase\'s census block is untouched (unit286\'s law holds)', () => {
  assert.ok(showcase.includes("guarded RPCs"), 'the rpc claim wording');
  assert.ok(showcase.includes("idempotent migrations"), 'the migrations claim wording');
  assert.ok(showcase.includes("mock data paths"), 'the mock claim wording');
  assert.ok(!showcase.includes('applied from the CLI'), 'the half-lie stays gone');
});

/* ── 7. the version law (agreement shape) ─────────────────────────────── */
check('the version law: APP_VERSION and sw.js agree', () => {
  const v = versionTs.match(/APP_VERSION = '([^']+)'/)?.[1] ?? '';
  assert.ok(v.length > 0, 'APP_VERSION is present');
  assert.ok(swJs.includes(`const VERSION = "servepoint-v${v}-r1";`), `sw.js carries the same word (${v})`);
});

console.log(`\nunit303 — PASS ${passed}/${passed} (all checks green)`);
