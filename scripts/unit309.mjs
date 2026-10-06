/* unit309 — v5.270.0 "the cart learns to count" (agreement shape)
 * The census finding: the guest drawer's line had exactly one verb — remove.
 * To take one plate off a triple the guest tore the whole line out and
 * re-customized it from scratch, and "the same plate twice" became two lines
 * that agreed by luck. The staff cart has COUNTED since always
 * (src/store/cart.ts increment/decrement); the guest drawer is the one cart
 * that never learned. The round teaches it — with the cart's OWN laws:
 * minus walks the staff decrement verbatim (qty − 1, filter the zero), plus
 * rides mergeLines' own 50, the labels carry the dish's name, the count
 * holds still while the money moves, and a sold-out line can shrink but
 * never grow (the house does not substitute — 308's law, one drawer later).
 * And the dish speaks its WHOLE description in the customizer — the row
 * keeps its truncate; the open card is the dish's own room.
 * THE LAWS PINNED HERE:
 *   1. THE MINUS IS THE STAFF DECREMENT'S SHAPE: both files pinned — the
 *      drawer's map(qty − 1).filter(qty > 0) and src/store/cart.ts's own;
 *   2. THE PLUS RIDES 50: Math.min(50, …) — mergeLines' own constant, the
 *      customizer's own ceiling;
 *   3. THE LABELS CARRY THE NAME: qtyDec / qtyInc composed with the dish's
 *      name, the keys existing in en/hi/kn (6 dictionary lines);
 *   4. THE STALE LINE CANNOT GROW: disabled={stale} sits on the PLUS (after
 *      the count, before remove) — the minus and the remove stay live;
 *   5. THE COUNT HOLDS STILL: tabular-nums + aria-live="polite";
 *   6. THE WHOLE DESCRIPTION: the customizer carries the full paragraph;
 *      the row keeps its one-line truncate;
 *   7. ONE GRAMMAR UNTOUCHED: mergeLines byte-kept (the ONE arithmetic —
 *      add, reorder and now count all speak it);
 *   8. THE VERSION LAW: APP_VERSION and sw.js agree. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const guest = readFileSync('/home/z/my-project/src/components/guest/GuestPages.tsx', 'utf8');
const cartStore = readFileSync('/home/z/my-project/src/store/cart.ts', 'utf8');
const i18n = readFileSync('/home/z/my-project/src/lib/guest-i18n.ts', 'utf8');
const versionTs = readFileSync('/home/z/my-project/src/version.ts', 'utf8');
const swJs = readFileSync('/home/z/my-project/public/sw.js', 'utf8');

let passed = 0;
const check = (name, fn) => {
  fn();
  passed += 1;
  console.log(`  ok ${passed} — ${name}`);
};

/* the drawer's line block — from the lines.map to its close */
const drawerBlock = guest.match(/\{lines\.map\(\(l\) => \{[\s\S]*?\n              \}\)\}/);
assert.ok(drawerBlock, 'the drawer lines block found');

/* ── 1. the minus is the staff decrement's shape ─────────────────────── */
check('the drawer minus walks the staff cart decrement verbatim (one less, the zero filtered)', () => {
  assert.ok(
    drawerBlock[0].includes('.map((x) => (x.key === l.key ? { ...x, qty: x.qty - 1 } : x))'),
    'the drawer minus walks one less',
  );
  assert.ok(drawerBlock[0].includes('.filter((x) => x.qty > 0)'), 'the drawer minus filters the zero');
  // the staff cart's own law — the same shape, the same file that has always spoken it
  const dec = cartStore.match(/decrement: \(key\) =>[\s\S]*?\}\),/);
  assert.ok(dec, 'the staff decrement found');
  assert.ok(dec[0].includes('{ ...l, qty: l.qty - 1 }'), 'the staff decrement walks one less');
  assert.ok(dec[0].includes('.filter((l) => l.qty > 0)'), 'the staff decrement filters the zero');
  assert.ok(drawerBlock[0].includes('src/store/cart.ts'), 'the drawer names the law it walks');
});

/* ── 2. the plus rides 50 ────────────────────────────────────────────── */
check('the drawer plus rides the guest cap (50) — mergeLines\u2019 own number', () => {
  assert.ok(drawerBlock[0].includes('Math.min(50, x.qty + 1)'), 'the plus is capped at 50');
  const merge = guest.match(/const mergeLines = [\s\S]*?\n\};/);
  assert.ok(merge && merge[0].includes('Math.min(50,'), 'mergeLines carries the same cap — one number');
});

/* ── 3. the labels carry the name, in three tongues ──────────────────── */
check('the stepper labels compose the dish\u2019s name; the keys speak in en, hi and kn', () => {
  assert.ok(drawerBlock[0].includes("t('qtyDec', { name: l.item.name })"), 'the minus label carries the dish');
  assert.ok(drawerBlock[0].includes("t('qtyInc', { name: l.item.name })"), 'the plus label carries the dish');
  for (const key of ['qtyDec', 'qtyInc']) {
    const hits = i18n.match(new RegExp(`^\\s*${key}: ['"]`, 'gm')) ?? [];
    assert.equal(hits.length, 3, `${key} speaks in all three dictionaries`);
  }
  assert.ok(i18n.includes("qtyDec: 'Reduce {name}'"), 'the en minus word is the staff cart\u2019s own word');
  assert.ok(i18n.includes("qtyInc: 'Add one more {name}'"), 'the en plus word is the staff cart\u2019s own word');
  assert.ok(i18n.includes("qtyDec: '{name} कम करें'"), 'the hi minus word carries the name');
  assert.ok(i18n.includes("qtyInc: 'ಇನ್ನೊಂದು {name} ಸೇರಿಸಿ'"), 'the kn plus word carries the name');
});

/* ── 4. the stale line cannot grow ───────────────────────────────────── */
check('the sold-out line\u2019s plus is dead; its minus and remove stay live', () => {
  const liveAt = drawerBlock[0].indexOf('aria-live="polite"');
  const removeAt = drawerBlock[0].indexOf("t('remove')");
  const disabledAt = drawerBlock[0].indexOf('disabled={stale}');
  assert.ok(liveAt >= 0 && removeAt > liveAt, 'the drawer block order sane');
  assert.ok(disabledAt > liveAt && disabledAt < removeAt, 'disabled={stale} sits on the PLUS — between the count and remove');
  // v5.271.0 — TWO dead buttons now: the plus (a sold-out line cannot grow)
  // AND the edit (a sold-out line cannot be re-said — 308's law, one verb
  // later). The minus and the remove stay live: the line can still shrink
  // and it can still leave.
  assert.equal((drawerBlock[0].match(/disabled=\{stale\}/g) ?? []).length, 2, 'exactly two dead buttons — the plus and the edit, never the minus');
  assert.ok(drawerBlock[0].includes('cursor-not-allowed'), 'the dead button says so under the thumb');
  assert.ok(/the house does not\s+substitute/.test(drawerBlock[0]), 'the law word stands in the drawer');
});

/* ── 5. the count holds still ────────────────────────────────────────── */
check('the count is tabular-nums with aria-live — the number holds while the money moves', () => {
  const pill = drawerBlock[0].match(/<span className="min-w-6[^"]*"[^>]*>/);
  assert.ok(pill, 'the count pill found');
  assert.ok(pill[0].includes('tabular-nums'), 'the digits hold their width');
  assert.ok(pill[0].includes('aria-live="polite"'), 'the ears hear the count change');
});

/* ── 6. the whole description ────────────────────────────────────────── */
check('the customizer speaks the WHOLE description; the row keeps its truncate', () => {
  const customizer = guest.match(/function Customizer\([\s\S]*?\n\nfunction /);
  assert.ok(customizer, 'the customizer body found');
  assert.ok(
    customizer[0].includes('{item.description && (\n        <p className="mb-3 text-[12.5px] leading-relaxed text-[#6B6B6B]">{item.description}</p>\n      )}'),
    'the whole word lives in the dish\u2019s own room',
  );
  assert.ok(customizer[0].includes('v5.270.0'), 'the paragraph names its round');
  // the row stays scannable — its one-line truncate is byte-kept
  assert.ok(guest.includes('block truncate text-[12.5px] text-[#6B6B6B]">{item.description}'), 'the row keeps its truncate');
  // the drawer line speaks only the name now — the count lives in the pill
  assert.ok(drawerBlock[0].includes('{l.item.name}'), 'the drawer line speaks the name');
  assert.ok(!drawerBlock[0].includes('{l.qty} ×'), 'the drawer line\u2019s old count prefix is gone — the pill owns the number');
});

/* ── 7. one grammar untouched ────────────────────────────────────────── */
check('mergeLines byte-kept — add, reorder and count speak ONE arithmetic', () => {
  assert.ok(guest.includes('const mergeLines = (prev: CartLine[], incoming: CartLine[]): CartLine[] => {'), 'mergeLines extracted');
  assert.ok(guest.includes('setLines((prev) => mergeLines(prev, [{ ...l, key }]));'), 'addLine rides the shared grammar');
  assert.ok(guest.includes('setLines((prev) => mergeLines(prev, matched));'), 'the reorder landing rides the shared grammar');
  assert.equal((guest.match(/Math\.min\(50,/g) ?? []).length, 4, 'the 50 speaks four times: merge, customizer, reorder clamp, drawer — one number');
});

/* ── 8. the version law ──────────────────────────────────────────────── */
check('APP_VERSION and sw.js agree (the literal belongs to the current round\u2019s unit)', () => {
  const v = versionTs.match(/APP_VERSION = '([^']+)'/)?.[1] ?? '';
  assert.ok(v.length > 0, 'APP_VERSION is present');
  assert.ok(swJs.includes(`const VERSION = "servepoint-v${v}-r1";`), `sw.js carries the same word (${v})`);
});

console.log(`\nunit309 — PASS ${passed}/${passed} (all checks green)`);
