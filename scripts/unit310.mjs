/* unit310 — v5.271.0 "the line remembers its choices" (agreement shape)
 * The census finding: the drawer line's choices were FROZEN at add time.
 * "extra cheese" could never become "no onion", a variant could never be
 * re-said — the only way to change a line was to tear it out and
 * re-customize it from scratch, re-answering questions the line already
 * knew. The staff cart has had an inline note editor since 5.76.0, but the
 * VARIANT/ADD-ON choices were frozen on BOTH carts. The round teaches the
 * guest line to be RE-SAID: Edit reopens the dish's own customizer
 * pre-filled with the line's own variant, add-ons, note and quantity; the
 * update walks the ONE merge grammar (5.269's own arithmetic); a sold-out
 * line cannot be re-said (308's law, one verb later); the room announces
 * itself in the amber register; and the CTA speaks Update, never Add.
 * THE LAWS PINNED HERE:
 *   1. THE THIRD VERB: the drawer line carries Edit (Pencil + editLine,
 *      teal ink) beside Remove's red — with the dish's name in the aria;
 *   2. THE STALE LAW EXTENDS: a sold-out line's edit is dead — the line
 *      may shrink or leave, never grow, never be re-said;
 *   3. THE ROOM REMEMBERS: `initial` pre-fills variant/addons/note/qty
 *      through the useState initializers — the guest never re-answers;
 *   4. THE REMOUNT LAW: the room's key carries the editing line's key —
 *      Edit never meets a room that kept someone else's half-choices;
 *   5. THE UPDATE LAW: the old key leaves, the new choices arrive through
 *      the ONE merge grammar (filter-then-mergeLines — a key collision
 *      grows one row, never a duplicate); the stale clause is deliberately
 *      absent; the window law holds;
 *   6. THE ROOM ANNOUNCES ITSELF: the amber banner (role=status, Pencil,
 *      Cancel one tap away) and the CTA says Update · {amt} — Add stays
 *      byte-kept for the fresh path;
 *   7. THREE TONGUES: the five new words speak in en, hi and kn (15
 *      dictionary lines);
 *   8. THE VERSION LAW: APP_VERSION and sw.js agree. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const guest = readFileSync('/home/z/my-project/src/components/guest/GuestPages.tsx', 'utf8');
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

/* the customizer's body */
const customizer = guest.match(/function Customizer\([\s\S]*?\n\nfunction /);
assert.ok(customizer, 'the customizer body found');

/* ── 1. the third verb ───────────────────────────────────────────────── */
check('the drawer line carries Edit — Pencil, teal ink, the dish\u2019s name in the aria, beside Remove\u2019s red', () => {
  const editAt = drawerBlock[0].indexOf('beginEdit(l)');
  const removeAt = drawerBlock[0].indexOf("t('remove')");
  assert.ok(editAt > 0 && removeAt > editAt, 'Edit sits before Remove — make-it-right, then make-it-gone');
  assert.ok(drawerBlock[0].includes('beginEdit(l)'), 'the tap hands the line to the front door');
  assert.ok(drawerBlock[0].includes("t('editLineAria', { name: l.item.name })"), 'the aria carries the dish');
  assert.ok(drawerBlock[0].includes("t('editLine')"), 'the label is the i18n word');
  assert.ok(drawerBlock[0].includes('<Pencil size={11} aria-hidden />'), 'the pencil marks the verb');
  assert.ok(drawerBlock[0].includes("text-[#0F3D3E] hover:underline"), 'the teal ink reads make-it-right beside the red');
  assert.ok(drawerBlock[0].includes('text-[#B4483C]'), 'Remove keeps its red');
});

/* ── 2. the stale law extends ────────────────────────────────────────── */
check('a sold-out line cannot be re-said — its edit is dead; the minus and remove stay live', () => {
  assert.equal((drawerBlock[0].match(/disabled=\{stale\}/g) ?? []).length, 2, 'exactly two dead buttons — the plus and the edit');
  const editDisabled = drawerBlock[0].indexOf('disabled={stale}', drawerBlock[0].indexOf('beginEdit(l)') - 400);
  assert.ok(editDisabled > 0, 'the edit carries its own disabled={stale}');
  assert.ok(drawerBlock[0].includes('disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:no-underline'), 'the dead edit says so under the thumb — the 309 grammar');
  assert.ok(drawerBlock[0].includes('one verb later'), 'the drawer names the law it extends');
});

/* ── 3. the room remembers ───────────────────────────────────────────── */
check('the customizer pre-fills the line\u2019s own choices — variant, add-ons, note, quantity', () => {
  assert.ok(customizer[0].includes('initial?.variantId ?? null'), 'the variant remembers');
  assert.ok(customizer[0].includes('initial?.addonIds ?? []'), 'the add-ons remember');
  assert.ok(customizer[0].includes('initial?.qty ?? 1'), 'the quantity remembers');
  assert.ok(customizer[0].includes("initial?.notes ?? ''"), 'the note remembers');
  const site = guest.match(/<Customizer[\s\S]*?\/>/);
  assert.ok(site, 'the render site found');
  assert.ok(site[0].includes('variantId: editing!.variant?.id ?? null'), 'the site hands the line\u2019s variant');
  assert.ok(site[0].includes('addonIds: editing!.addons.map((a) => a.id)'), 'the site hands the line\u2019s add-ons');
  assert.ok(site[0].includes('notes: editing!.notes'), 'the site hands the line\u2019s note');
  assert.ok(site[0].includes('qty: editing!.qty'), 'the site hands the line\u2019s quantity');
});

/* ── 4. the remount law ──────────────────────────────────────────────── */
check('the room\u2019s key carries the editing line\u2019s key — Edit never inherits half-choices', () => {
  const site = guest.match(/<Customizer[\s\S]*?\/>/);
  assert.ok(site[0].includes("key={editingHere ? `edit-${editing!.key}` : 'add'}"), 'the key flips between the add room and the edit room');
  assert.ok(customizer[0].includes('useState initializers only'), 'the room says why the key exists');
});

/* ── 5. the update law ───────────────────────────────────────────────── */
check('the update walks the ONE merge grammar — the old key leaves, the new arrives, no duplicate', () => {
  const update = guest.match(/const updateLine = useCallback\([\s\S]*?\n  \);/);
  assert.ok(update, 'updateLine found');
  assert.ok(update[0].includes('const rest = prev.filter((x) => x.key !== oldKey);'), 'the old key leaves first');
  assert.ok(update[0].includes('return mergeLines(rest, [{ ...l, key }]);'), 'the new choices arrive through the ONE grammar');
  assert.ok(update[0].includes("if (phase !== 'ready' || windowEnded) return;"), 'the window law holds — a dead window updates nothing');
  assert.ok(guest.includes('deliberately ABSENT'), 'the missing stale clause is a decision, not an oversight');
  assert.ok(!update[0].includes('setStaleIds'), 'no stale mark is cleared by an update — a live line needs none');
  // addLine keeps its own clause — the two doors are honest about why they differ
  const add = guest.match(/const addLine = useCallback\([\s\S]*?\n  \);/);
  assert.ok(add[0].includes('setStaleIds'), 'the add door keeps its stale-clearing');
  assert.ok(guest.includes('setLines((prev) => mergeLines(prev, [{ ...l, key }]));'), 'add still rides the shared grammar');
});

/* ── 6. the room announces itself ────────────────────────────────────── */
check('the edit room wears the amber banner with Cancel, and the CTA says Update — Add stays byte-kept', () => {
  assert.ok(customizer[0].includes("t('editingLine')"), 'the banner says which room the guest is in');
  assert.ok(customizer[0].includes("t('cancelEdit')"), 'Cancel is one tap away');
  assert.ok(customizer[0].includes('role="status"'), 'the banner is a status, not a decoration');
  assert.ok(customizer[0].includes('bg-[#FDF9F0]') && customizer[0].includes('text-[#8A5A16]'), 'the amber register — the house\u2019s own family');
  assert.ok(customizer[0].includes("editing ? t('updateLine', { amt: money(unit * qty) }) : t('addToOrder', { amt: money(unit * qty) })"), 'the CTA speaks Update in edit mode, Add in fresh mode — one composer');
  assert.ok(customizer[0].includes('{editing ? <Pencil size={15} aria-hidden /> : <Plus size={15} aria-hidden />}'), 'the icon matches the verb');
  assert.ok(customizer[0].includes("if (editing && onUpdate) {"), 'the submit hands the payload to the update door');
  // the add path still resets its own room — the fresh room starts clean
  assert.ok(customizer[0].includes('setQty(1);'), 'the fresh room resets the quantity');
});

/* ── 7. three tongues ────────────────────────────────────────────────── */
check('the five new words speak in en, hi and kn — 15 dictionary lines', () => {
  for (const key of ['editLine', 'editLineAria', 'editingLine', 'cancelEdit', 'updateLine']) {
    const hits = i18n.match(new RegExp(`^\\s*${key}: ['"]`, 'gm')) ?? [];
    assert.equal(hits.length, 3, `${key} speaks in all three dictionaries`);
  }
  assert.ok(i18n.includes("editLine: 'Edit'"), 'the en verb is Edit');
  assert.ok(i18n.includes("editLineAria: 'Edit {name} — change options, note, or quantity'"), 'the en aria carries the dish and the promise');
  assert.ok(i18n.includes("editingLine: 'Editing this line from your order'"), 'the en banner word');
  assert.ok(i18n.includes("updateLine: 'Update · {amt}'"), 'the en CTA word');
  assert.ok(i18n.includes("editLine: 'संपादित करें'"), 'the hi verb');
  assert.ok(i18n.includes("editingLine: 'आपके ऑर्डर की यह लाइन संपादित हो रही है'"), 'the hi banner word');
  assert.ok(i18n.includes("editLine: 'ಸಂಪಾದಿಸಿ'"), 'the kn verb');
  assert.ok(i18n.includes("updateLine: 'ಅಪ್‌ಡೇಟ್ · {amt}'"), 'the kn CTA word');
});

/* ── 8. the version law (relaxed to the agreement shape, per unit308's own
 *       precedent — the literal belongs to the current round's unit) ───── */
check('APP_VERSION and sw.js agree (the same word, wherever it now stands)', () => {
  const v = versionTs.match(/APP_VERSION = '([^']+)'/)?.[1] ?? '';
  assert.ok(/^5\.\d+\.\d+$/.test(v), 'the version word is a semver word');
  assert.ok(swJs.includes(`const VERSION = "servepoint-v${v}-r1";`), `sw.js carries the same word (${v})`);
});

console.log(`\nunit310 — PASS ${passed}/${passed} (all checks green)`);
