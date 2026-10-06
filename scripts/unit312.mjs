/* unit312 — v5.273.0 "the drawer finds its way out" (agreement shape)
 * The census finding: cart.clear() had exactly ONE caller in the whole
 * house — the place flow's own reset. An ABANDONED order (the walk-in who
 * leaves, the wrong table, the misbuilt cart) could only be undone by
 * decrementing every line by hand, one tap per plate. And 311's census
 * left one verb ungated: the staff drawer's PLUS still grew a pulled
 * dish's line — the stale law (308/309/311) had reached every verb on
 * both carts EXCEPT that one. THE ROUND COMPLETES BOTH:
 *   1. THE WAY OUT: the drawer's footer carries Clear — a quiet
 *      destructive verb in the house's red register, rendered only while
 *      lines exist and nothing is in flight;
 *   2. THE TWO-TAP LAW: a verb that cannot be undone earns a second word
 *      — the first tap arms (solid red, "Tap again — this cannot be
 *      undone"), the second acts; four seconds alone or the drawer
 *      closing disarms;
 *   3. THE FULL RESET: clear() is the place flow's own reset — the lines
 *      leave, the note editor's draft dies, the drawer closes, and the
 *      TABLE BINDING releases with them (the store's own clause);
 *   4. THE STALE LAW COMPLETES: the plus joins the edit — exactly TWO
 *      dead buttons on a stale line; the line SAYS WHY with the dish's
 *      own SOLD OUT vocabulary (one tone: grid card, modal strip, drawer
 *      row);
 *   5. THE MINUS STAYS LIVE: shrink and leave are never gated;
 *   6. THE PLACE FLOW BYTE-KEPT: placeOrder still clears after success —
 *      the store now has exactly two callers, both named;
 *   7. THE VERSION LAW: APP_VERSION and sw.js agree at 5.273.0. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const staff = readFileSync('/home/z/my-project/src/components/food/FoodDrinksScreen.tsx', 'utf8');
const cart = readFileSync('/home/z/my-project/src/store/cart.ts', 'utf8');
const versionTs = readFileSync('/home/z/my-project/src/version.ts', 'utf8');
const swJs = readFileSync('/home/z/my-project/public/sw.js', 'utf8');

let passed = 0;
const check = (name, fn) => {
  fn();
  passed += 1;
  console.log(`  ok ${passed} — ${name}`);
};

/* the drawer's line block */
const drawerBlock = staff.match(/\{cart\.lines\.map\(\(l\) => \{[\s\S]*?\n                \}\)\}/);
assert.ok(drawerBlock, 'the drawer lines block found');

/* the footer's clear door */
const clearDoor = staff.match(/\{cart\.lines\.length > 0 && !submitting && \([\s\S]*?\n          \)\}/);
assert.ok(clearDoor, 'the clear door found');

/* ── 1. the way out ──────────────────────────────────────────────────── */
check('the drawer\u2019s footer carries Clear — quiet, red, only while lines exist', () => {
  assert.ok(clearDoor[0].includes('<Trash2 size={14} aria-hidden />'), 'the bin marks the verb');
  assert.ok(clearDoor[0].includes("'Clear order'"), 'the resting word');
  assert.ok(clearDoor[0].includes('text-[#B4483C] hover:bg-[#FDF3F2]'), 'the red-ghost register — the house\u2019s danger family, quiet until armed');
  assert.ok(clearDoor[0].includes('cart.lines.length > 0 && !submitting'), 'no lines, no door; nothing in flight, no door');
  assert.ok(staff.includes("the drawer's way out"), 'the door names what it is');
});

/* ── 2. the two-tap law ──────────────────────────────────────────────── */
check('a verb that cannot be undone earns a second word — arm, act, disarm', () => {
  assert.ok(clearDoor[0].includes("clearArmed ? 'Tap again — this cannot be undone' : 'Clear order'"), 'the armed word names the cost');
  assert.ok(clearDoor[0].includes("clearArmed\n                  ? 'Tap again — clearing the order cannot be undone'\n                  : 'Clear the whole order'"), 'the aria speaks both stages');
  assert.ok(clearDoor[0].includes("clearArmed\n                  ? 'border-[#B4483C] bg-[#B4483C] text-white hover:bg-[#9E3F35]'\n                  : 'border-transparent bg-transparent text-[#B4483C] hover:bg-[#FDF3F2]'"), 'armed turns solid red — the verb changes its clothes');
  const arm = staff.match(/const \[clearArmed, setClearArmed\] = useState\(false\);[\s\S]*?\n  \}, \[open\]\);/);
  assert.ok(arm, 'the arm state and its disarms found');
  assert.ok(arm[0].includes('window.setTimeout(() => setClearArmed(false), 4000)'), 'four seconds alone disarm');
  assert.ok(arm[0].includes('if (!open) setClearArmed(false);'), 'the drawer closing disarms');
});

/* ── 3. the full reset ───────────────────────────────────────────────── */
check('the clear resets the WHOLE drawer — lines, the note draft, the table binding', () => {
  assert.ok(clearDoor[0].includes('useCart.getState().clear();'), 'the clear walks the store\u2019s own reset');
  assert.ok(clearDoor[0].includes('setNoteKey(null);'), 'the note editor\u2019s key dies');
  assert.ok(clearDoor[0].includes("setNoteDraft('');"), 'the note editor\u2019s draft dies');
  assert.ok(clearDoor[0].includes('setClearArmed(false);'), 'the arm dies with the act');
  assert.ok(clearDoor[0].includes('onClose();'), 'the drawer closes — the task is done');
  assert.ok(cart.includes('a placed ticket is a finished story'), 'the store\u2019s own clause stands byte-kept');
  assert.ok(cart.includes('The TABLE binding\n  // releases too'), 'the table binding releases with the lines — the store says so');
});

/* ── 4. the stale law completes ──────────────────────────────────────── */
check('the plus joins the edit — two dead buttons, and the line says WHY', () => {
  const deadCount = (drawerBlock[0].match(/(?<!aria-)disabled=\{stale\}/g) ?? []).length;
  assert.equal(deadCount, 2, 'exactly two dead buttons — the plus and the edit');
  const plusDisabled = drawerBlock[0].indexOf('disabled={stale}', drawerBlock[0].indexOf('cart.increment(l.key)') - 60);
  assert.ok(plusDisabled > 0, 'the plus carries its own disabled={stale}');
  assert.ok(drawerBlock[0].includes('can shrink or leave, but not grow'), 'the plus\u2019s aria names the law');
  assert.ok(drawerBlock[0].includes('stale ? \u0027cursor-not-allowed opacity-40\u0027 : \u0027\u0027'), 'the dead plus says so under the thumb');
  // the whisper — one vocabulary, three surfaces
  assert.ok(drawerBlock[0].includes('bg-[#FDF3F2] px-1.5 py-px text-[9.5px] font-bold uppercase tracking-[0.08em] text-[#B4483C]'), 'the SOLD OUT whisper in the house\u2019s own tone');
  assert.ok(drawerBlock[0].includes('<CircleOff size={9} aria-hidden />'), 'the circle-off ear rides the whisper');
  assert.ok(drawerBlock[0].includes('Sold out'), 'the word is the dish\u2019s own');
  assert.ok(drawerBlock[0].includes('the line says WHY its verbs are dead'), 'the row names the law it speaks');
});

/* ── 5. the minus stays live ─────────────────────────────────────────── */
check('shrink and leave are never gated — the minus has no stale guard', () => {
  const minusAt = drawerBlock[0].indexOf('cart.decrement(l.key)');
  assert.ok(minusAt > 0, 'the minus found');
  const minusBtn = drawerBlock[0].slice(Math.max(0, minusAt - 400), minusAt);
  assert.ok(!minusBtn.includes('disabled={stale}'), 'no stale gate before the minus');
  assert.ok(cart.includes('filter((l) => l.qty > 0)'), 'the store\u2019s own zero-filter stands — at one the line leaves');
});

/* ── 6. the place flow byte-kept ─────────────────────────────────────── */
check('placeOrder still clears after success — the store has exactly two callers, both named', () => {
  const place = staff.match(/useCart\.getState\(\)\.clear\(\);\n      setNoteKey\(null\);\n      setNoteDraft\(''\);\n      onPlaced\(order\.order_number\);/);
  assert.ok(place, 'the place flow\u2019s own clear stands untouched');
  const callers = (staff.match(/useCart\.getState\(\)\.clear\(\)/g) ?? []).length;
  assert.equal(callers, 2, 'exactly two clear callers — the place flow and the way out');
});

/* ── 7. the version law ──────────────────────────────────────────────── */
check('APP_VERSION and sw.js agree at 5.273.0', () => {
  const v = versionTs.match(/APP_VERSION = '([^']+)'/)?.[1] ?? '';
  assert.equal(v, '5.273.0', 'the version word is this round\u2019s');
  assert.ok(swJs.includes(`const VERSION = "servepoint-v${v}-r1";`), `sw.js carries the same word (${v})`);
});

console.log(`\nunit312 — PASS ${passed}/${passed} (all checks green)`);
