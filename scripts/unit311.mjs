/* unit311 — v5.272.0 "the counter's line learns to be re-said" (agreement shape)
 * The census finding: 5.271 taught the GUEST drawer's third verb, but the
 * STAFF order drawer (Food & Drinks) was still frozen at add time — a line
 * sold "extra cheese / Large" could never become "no onion / Regular"
 * without being torn out and re-customized from scratch. The staff cart's
 * only edit affordances were the qty steppers and the inline NOTE editor
 * (5.76.0); the variant/add-on choices were frozen. The round teaches the
 * counter's line to be RE-SAID: the dish's own modal reopens PRE-FILLED
 * with the line's own answers (resolved by name against the live menu),
 * the amber banner says which room the cashier is in, the CTA speaks
 * Update · {amt} with the whole money live, the update walks the ONE merge
 * grammar (the store's own add arithmetic — a key collision grows ONE row),
 * the kitchen note SURVIVES the re-saying (unless a sibling already holds
 * its own word — the earlier voice wins), a stale line (pulled or vanished
 * dish) can shrink or leave but never be re-said, and the pull section
 * rests while a line is being re-said (this room is not for pulling).
 * THE LAWS PINNED HERE:
 *   1. THE FOURTH VERB: the drawer line carries Edit (Pencil, deep-green
 *      ink) beside the note pencil — the dish's name in the aria;
 *   2. THE STALE LAW EXTENDS: the verb reads the LIVE menu and is dead for
 *      a pulled or vanished dish — shrink or leave, never re-said;
 *   3. THE ROOM REMEMBERS: the modal pre-fills qty / add-ons / variant
 *      through the useState initializers, by name against the live dish;
 *   4. THE REMOUNT LAW: the render site's key carries edit-<line key> vs
 *      add-<dish id> — Edit never inherits half-choices;
 *   5. THE UPDATE LAW: the old key leaves, the new choices arrive through
 *      the store's ONE merge grammar; the note survives the re-saying
 *      unless a sibling holds its own word; Add stays byte-kept;
 *   6. THE ROOM ANNOUNCES ITSELF: the amber banner (role=status, Pencil,
 *      Cancel one tap away), the CTA says Update · {amt}, and the pull
 *      section rests while editing;
 *   7. THE ONE KEY GRAMMAR: lineKey is exported from the store — one
 *      speaker, no second builder;
 *   8. THE VERSION LAW: APP_VERSION and sw.js agree at 5.272.0. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const staff = readFileSync('/home/z/my-project/src/components/food/FoodDrinksScreen.tsx', 'utf8');
const modal = readFileSync('/home/z/my-project/src/components/food/ItemDetailModal.tsx', 'utf8');
const cart = readFileSync('/home/z/my-project/src/store/cart.ts', 'utf8');
const versionTs = readFileSync('/home/z/my-project/src/version.ts', 'utf8');
const swJs = readFileSync('/home/z/my-project/public/sw.js', 'utf8');

let passed = 0;
const check = (name, fn) => {
  fn();
  passed += 1;
  console.log(`  ok ${passed} — ${name}`);
};

/* the drawer's line block — from the lines.map to its close */
const drawerBlock = staff.match(/\{cart\.lines\.map\(\(l\) => \{[\s\S]*?\n                \}\)\}/);
assert.ok(drawerBlock, 'the drawer lines block found');

/* the modal's body */
const modalBody = modal;
const updateFn = modal.match(/const handleUpdate = \(\) => \{[\s\S]*?\n  \};/);
assert.ok(updateFn, 'handleUpdate found');

/* ── 1. the fourth verb ──────────────────────────────────────────────── */
check('the drawer line carries Edit — Pencil, deep-green ink, the dish\u2019s name in the aria, beside the note pencil', () => {
  const noteAt = drawerBlock[0].indexOf('commitNote()');
  assert.ok(noteAt > 0, 'the note pencil found (the first pencil)');
  const editAt = drawerBlock[0].indexOf('onEditLine(l, lineItem)');
  assert.ok(editAt > noteAt, 'Edit sits beside the note pencil — the second pencil');
  assert.ok(drawerBlock[0].includes('<Pencil size={15} aria-hidden />'), 'the pencil marks the verb');
  assert.ok(drawerBlock[0].includes('`Edit ${l.name} — change options or quantity`'), 'the aria carries the dish');
  assert.ok(drawerBlock[0].includes('text-[#0F3D3E] hover:bg-[#F1F5F4]'), 'the deep-green ink reads make-it-right');
  assert.ok(drawerBlock[0].includes('mx-0.5 h-6 w-px bg-[#E3E7E0]'), 'the divider keeps the verbs apart');
  assert.ok(staff.includes("onEditLine={(line, item) => {"), 'the parent hands down the front door');
});

/* ── 2. the stale law extends ────────────────────────────────────────── */
check('the edit reads the LIVE menu and is dead for a stale line — shrink or leave, never re-said', () => {
  assert.ok(drawerBlock[0].includes('const lineItem = items.find((m) => m.id === l.menuItemId) || null;'), 'the verb reads the live menu');
  assert.ok(drawerBlock[0].includes('const stale = !lineItem || lineItem.is_available === false;'), 'pulled or vanished = stale');
  const deadCount = (drawerBlock[0].match(/(?<!aria-)disabled=\{stale\}/g) ?? []).length;
  assert.equal(deadCount, 1, 'exactly ONE dead button — the edit (the staff minus has no guest cap)');
  const editDisabled = drawerBlock[0].indexOf('disabled={stale}', drawerBlock[0].indexOf('onEditLine(l, lineItem)') - 300);
  assert.ok(editDisabled > 0, 'the edit carries its own disabled={stale}');
  assert.ok(drawerBlock[0].includes('cursor-not-allowed'), 'the dead verb says so under the thumb');
  assert.ok(drawerBlock[0].includes('can shrink or leave, but not be re-said'), 'the aria names the law');
  assert.ok(drawerBlock[0].includes("two\n                     verbs later"), 'the drawer names the law it extends');
});

/* ── 3. the room remembers ───────────────────────────────────────────── */
check('the modal pre-fills the line\u2019s own choices — qty, add-ons and variant, by name', () => {
  assert.ok(modalBody.includes('useState(() => editing?.qty ?? 1)'), 'the quantity remembers');
  assert.ok(modalBody.includes('editing.addonNames.forEach((n) => {'), 'the extras are counted back in');
  assert.ok(modalBody.includes('if (lineCounts[a.name]) init[a.id] = lineCounts[a.name];'), 'by NAME — the live menu\u2019s ids are the keys');
  assert.ok(modalBody.includes("if (!editing?.variantName) return null;"), 'the variant remembers (null = as served)');
  assert.ok(modalBody.includes("(item.variants || []).find((v) => v.name === editing.variantName)?.id ?? null"), 'the chip re-presses by name');
  const site = staff.match(/editing=\{\s*editingLine[\s\S]*?\n          \}/);
  assert.ok(site, 'the render site hands the line\u2019s answers');
  assert.ok(site[0].includes('variantName: editingLine.variantName ?? null'), 'the site hands the variant name');
  assert.ok(site[0].includes('addonNames: editingLine.addonNames'), 'the site hands the extra names');
  assert.ok(site[0].includes('qty: editingLine.qty'), 'the site hands the quantity');
});

/* ── 4. the remount law ──────────────────────────────────────────────── */
check('the room\u2019s key carries the editing line\u2019s key — Edit never inherits half-choices', () => {
  assert.ok(staff.includes("key={editingLine ? `edit-${editingLine.key}` : `add-${detailItem.id}`}"), 'the key flips between the add room and the edit room');
  assert.ok(modalBody.includes('useState initializers only'), 'the modal says why the key exists');
  // every fresh-add path clears the tenant — no stale pre-fill can ride along
  const clears = (staff.match(/setEditingLine\(null\)/g) ?? []).length;
  assert.ok(clears >= 5, `every fresh way in clears the room (${clears} clears: grid add, mover tap, select, usual chip, close)`);
});

/* ── 5. the update law ───────────────────────────────────────────────── */
check('the update walks the ONE merge grammar — the old key leaves, the new arrives; the note survives', () => {
  assert.ok(updateFn[0].includes('c.remove(editing.key);'), 'the old key LEAVES first');
  assert.ok(updateFn[0].includes('c.add(item, qty, selected,'), 'the new choices arrive through the store\u2019s own add (the ONE merge grammar)');
  assert.ok(updateFn[0].includes('const siblingHolds = c.lines.some((l) => l.key === newKey && l.key !== editing.key);'), 'the room asks whether a sibling holds the new key');
  assert.ok(updateFn[0].includes('const oldNote = c.lines.find((l) => l.key === editing.key)?.note;'), 'the word is read before the line leaves');
  assert.ok(updateFn[0].includes('if (!siblingHolds && oldNote) useCart.getState().setLineNote(newKey, oldNote);'), 'the note survives the re-saying unless a sibling holds its own word');
  assert.ok(modalBody.includes('THE WORD SURVIVES THE RE-SAYING'), 'the comment names the decision');
  assert.ok(modalBody.includes('onUpdated?.();'), 'the parent hears the update (the toast)');
  // the fresh path is byte-kept
  assert.ok(modalBody.includes('onClick={handleAdd} className="sp-cta h-12 w-full text-[15px]">\n              Add to Order'), 'the fresh room byte-keeps Add to Order');
  // add()'s merge clause stands untouched — the first voice wins
  assert.ok(cart.includes('merges keep the earlier note'), 'the store\u2019s own merge clause stands');
});

/* ── 6. the room announces itself ────────────────────────────────────── */
check('the edit room wears the amber banner with Cancel, the CTA says Update · {amt}, and the pull section rests', () => {
  assert.ok(modalBody.includes('Editing this line from the order'), 'the banner says which room the cashier is in');
  assert.ok(modalBody.includes('role="status"'), 'the banner is a status, not a decoration');
  assert.ok(modalBody.includes('bg-[#FDF9F0]') && modalBody.includes('text-[#8A5A16]'), 'the amber register — the house\u2019s own family');
  assert.ok(modalBody.includes('<Pencil size={12} aria-hidden className="shrink-0" />'), 'the pencil marks the room');
  assert.ok(modalBody.includes('Update · {formatMoney(round2(runningUnit * qty))}'), 'the CTA speaks Update with the whole money live');
  assert.ok(modalBody.includes('!unavailable && onToggleAvailability && !isEdit'), 'the pull section rests while a line is being re-said');
  // the add CTA keeps its own icon-less room; the edit banner owns the pencil
  assert.ok(!modalBody.includes("editing ? 'Update"), 'no ternary blur — the two CTAs are separate rooms');
});

/* ── 7. the one key grammar ──────────────────────────────────────────── */
check('lineKey is exported from the store — ONE key grammar, one speaker', () => {
  assert.ok(cart.includes('export const lineKey ='), 'the store owns the key grammar, now readably');
  assert.ok(cart.includes('ONE key grammar,\n *  one speaker'), 'the export names the law');
  assert.ok(modalBody.includes("import { lineKey, useCart } from '../../store/cart';"), 'the modal imports the grammar — it builds no second one');
  assert.ok(!/(const|function|let)\s+lineKey\s*[=(]/.test(modalBody.replace("import { lineKey, useCart } from '../../store/cart';", '')), 'no second builder lives in the modal');
});

/* ── 8. the version law ──────────────────────────────────────────────── */
check('APP_VERSION and sw.js agree at 5.272.0', () => {
  const v = versionTs.match(/APP_VERSION = '([^']+)'/)?.[1] ?? '';
  assert.equal(v, '5.272.0', 'the version word is this round\u2019s');
  assert.ok(swJs.includes(`const VERSION = "servepoint-v${v}-r1";`), `sw.js carries the same word (${v})`);
});

console.log(`\nunit311 — PASS ${passed}/${passed} (all checks green)`);
