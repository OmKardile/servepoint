/* unit329 — v5.290.0 "the overlays learn the stick" (agreement shape)
 * The round's lens: the family the last round named and parked. The
 * source-shape proof found the disease was WORSE than parked: the
 * MenuScreen Overlay family carries the wizard's exact disease (verb rows
 * scroll away inside the 86vh panel), the floor's AddTableDialog carries
 * it WORSE (the panel had NO scroll law at all — at a squat viewport the
 * whole card overflows BOTH edges: header and verbs alike unreachable),
 * and the BookingDialog's verbs live at the content's end. THE FIX (the
 * stick, family-wide): every dialog's verbs hold the panel's own bottom
 * edge — the wizard's v5.289.0 grammar byte-adapted to the p-5 house,
 * carried as byte-twins (OVERLAY_FOOT_STICK / FLOOR_FOOT_STICK, pinned
 * EQUAL), the verbs passed as Overlay's own `foot` prop so a body can
 * never carry verbs again. THE CENSUS: the section field learns the
 * board's own words (a datalist read from the tables — never invented);
 * the category door learns the shelf's own census (a duplicate is stopped
 * with an honest word, case-insensitive, before the write). THE PRUNE:
 * the VariantsModal and the TableDrill drawer stand PROVEN CLEAN by the
 * same walk — one has no verbs at all (a live-edit modal), the other
 * already holds the healthy drawer pattern (fixed footer outside the
 * scroll body) — honest pruning per the read-the-actual-shape law. */

import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const read = (p) => readFileSync(`/home/z/my-project/${p}`, 'utf8');

const menu = read('src/components/menu/MenuScreen.tsx');
const floor = read('src/components/floor/FloorScreen.tsx');
const wizard = read('src/components/platform/ProvisioningWizard.tsx');
const version = read('src/version.ts');
const sw = read('public/sw.js');

const count = (hay, needle) => hay.split(needle).length - 1;

const STICK_P5 = 'sticky bottom-0 -mx-5 -mb-5 rounded-b-3xl border-t border-[#E3E7E0] bg-white px-5 pb-4 pt-2.5';

test('unit329 · the twins — one grammar, two files, byte-equal, the wizard stands', () => {
  // each twin exists, defined exactly once, with the same bytes
  assert.equal(count(menu, 'const OVERLAY_FOOT_STICK ='), 1, 'the menu twin is one');
  assert.equal(count(floor, 'const FLOOR_FOOT_STICK ='), 1, 'the floor twin is one');
  assert.match(menu, /const OVERLAY_FOOT_STICK =\n  'sticky bottom-0 -mx-5 -mb-5 rounded-b-3xl border-t border-\[#E3E7E0\] bg-white px-5 pb-4 pt-2\.5';/);
  assert.match(floor, /const FLOOR_FOOT_STICK =\n  'sticky bottom-0 -mx-5 -mb-5 rounded-b-3xl border-t border-\[#E3E7E0\] bg-white px-5 pb-4 pt-2\.5';/);
  // the twins agree — extracted from both sources, compared
  const menuStick = menu.match(/const OVERLAY_FOOT_STICK =\n  '([^']+)';/);
  const floorStick = floor.match(/const FLOOR_FOOT_STICK =\n  '([^']+)';/);
  assert.ok(menuStick && floorStick);
  assert.equal(menuStick[1], floorStick[1], 'the twins must never drift');
  assert.equal(menuStick[1], STICK_P5, 'the p-5 house grammar, exact');
  // the wizard's own p-6 grammar stands byte-still (the original teacher)
  assert.match(
    wizard,
    /'sticky bottom-0 -mx-6 -mb-6 rounded-b-3xl border-t border-\[#E3E7E0\] bg-white px-6 pb-5 pt-3'/
  );
});

test('unit329 · the Overlay learns the foot — verbs ride the stick, bodies hold fields', () => {
  // the prop exists and renders through the stick, exactly once
  assert.match(menu, /foot\?: React\.ReactNode;/);
  assert.equal(
    count(menu, '`mt-3 flex justify-end gap-2 ${OVERLAY_FOOT_STICK}`'),
    1,
    'the stick renders in ONE place — inside Overlay'
  );
  // the two verb-carrying modals pass the foot; the live-edit modal passes none
  assert.equal(count(menu, 'foot={'), 2, 'ItemModal + category modal, no more');
  assert.match(menu, /<Overlay\n      title=\{initial \? 'Edit item' : 'New menu item'\}\n      onClose=\{onClose\}\n      foot=\{/);
  assert.match(menu, /title="New category"\n          onClose=\{\(\) => setCatModalOpen\(false\)\}\n          foot=\{/);
  // the OLD in-flow footer shapes are fully retired
  assert.equal(count(menu, 'justify-end gap-2 pt-1"'), 0, "the item modal's old footer is gone");
  assert.equal(count(menu, '<div className="flex justify-end gap-2">'), 0, "the category modal's old footer is gone");
  // the verbs keep their words
  assert.match(menu, /\{initial \? 'Save changes' : 'Add item'\}/);
  assert.match(menu, /Add category/);
  assert.equal(count(menu, 'Cancel'), 4, 'two modal footers + the inline rename row + the law\'s own comment');
});

test('unit329 · the floor learns the scroll law AND the stick — the worst case first', () => {
  // the panel's NEW scroll law (the old shape had none)
  assert.match(floor, /max-h-\[92vh\] max-w-\[420px\] -translate-y-1\/2 overflow-y-auto rounded-3xl bg-white p-5/);
  // the stick rides both dialogs, as a direct panel child, exactly twice
  assert.equal(count(floor, '`mt-3 flex justify-end gap-2 ${FLOOR_FOOT_STICK}`'), 2, 'table + booking dialogs');
  // the OLD in-flow footer shapes are fully retired
  assert.equal(count(floor, 'justify-end gap-2 pt-1"'), 0, 'both old footers are gone');
  // the verbs keep their words
  assert.match(floor, /\{initial \? 'Save changes' : 'Add table'\}/);
  assert.match(floor, /Write it in the book/);
  // the doors stand (v5.110 — Escape stands down while busy)
  assert.match(floor, /if \(!busy\) onClose\(\);/);
  assert.equal(count(floor, 'aria-label="Close dialog"'), 2, 'both dialogs keep their close doors');
  assert.equal(count(floor, 'aria-label="Close"'), 3, 'the two dialog headers + the drill drawer keep their X');
});

test('unit329 · the section census — the datalist speaks the board\'s own words', () => {
  // the census reads the tables (never invented), alphabetically, whole house
  assert.match(
    floor,
    /\[\.\.\.new Set\(\(tables \|\| \[\]\)\.map\(\(t\) => t\.section \|\| 'Main Floor'\)\)\]\.sort\(\(a, b\) => a\.localeCompare\(b\)\)/
  );
  assert.match(floor, /\}, \[tables\]\);/, 'the census re-reads only the tables');
  // the field wears it; the suggestions render from it
  assert.match(floor, /list="ft-sections"/);
  assert.match(floor, /<datalist id="ft-sections">/);
  assert.match(floor, /\{knownSections\.map\(\(s\) => \(/);
  assert.match(floor, /<option key=\{s\} value=\{s\} \/>/);
  // both call sites pass the same census
  assert.equal(count(floor, 'knownSections={knownSections}'), 2, 'add + edit dialogs');
  // the prop is typed and carried into the component
  assert.match(floor, /knownSections: string\[\];/);
  assert.match(floor, /  initial,\n  knownSections,\n\}: \{/);
});

test('unit329 · the duplicate door — the shelf\'s census speaks before the write', () => {
  // the derived census: case-insensitive, trimmed, reading the shelf itself
  assert.match(
    menu,
    /categories\.some\(\(c\) => c\.name\.trim\(\)\.toLowerCase\(\) === catName\.trim\(\)\.toLowerCase\(\)\)/
  );
  assert.match(menu, /\[categories, catName\]/);
  // the door: the verb stays down while the twin stands
  assert.match(menu, /disabled=\{!catName\.trim\(\) \|\| catDuplicate \|\| busy\}/);
  // the honest word, as an alert
  assert.match(menu, /A category named “\{catName\.trim\(\)\}” is already on the shelf — pick a different name\./);
  assert.match(menu, /\{catDuplicate && \(/);
  // the memory keeps its home (the modal region, beside the write)
  assert.match(menu, /v5\.290\.0 — the duplicate door/);
});

test('unit329 · the prune stands — the healthy shapes stay untouched', () => {
  // the VariantsModal: a live-edit modal with NO verbs to stick — byte-still
  assert.match(menu, /<Overlay title=\{\`Options — \$\{itemName\}\`\} onClose=\{onClose\} wide>/);
  // the Overlay's scroll law and door byte-still
  assert.match(menu, /max-h-\[86vh\] overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl outline-none/);
  assert.match(menu, /v5\.110\.0 — the overlay holds the door/);
  // the booking panel keeps its own law byte-still (it had one; it needed the stick only)
  assert.match(floor, /max-h-\[92vh\] max-w-\[460px\] -translate-y-1\/2 overflow-y-auto rounded-3xl bg-white p-5/);
  // the drawer's healthy pattern byte-still (fixed footer OUTSIDE the scroll body)
  assert.match(floor, /\{\/\* body \*\/\}/);
  assert.match(floor, /className="flex-1 space-y-3 overflow-y-auto p-4"/);
  assert.match(floor, /\{\/\* footer \*\/\}/);
  assert.match(floor, /className="border-t border-\[#E3E7E0\] bg-white px-4 py-3"/);
});

test('unit329 · the doctrine — the hunt, the census, the belts, all byte-still', () => {
  // the menu family's own older laws
  assert.match(menu, /sp-input h-11 w-full px-3 text-\[13\.5px\]/);
  assert.match(menu, /role="alert"/);
  // the floor's board laws
  assert.match(floor, /\[\.\.\.map\.entries\(\)\]\.sort\(\(a, b\) => a\[0\]\.localeCompare\(b\[0\]\)\)/);
  assert.match(floor, /Search tables or sections…/);
  // the twins' comment words name the law
  assert.match(menu, /unit329 pins the twins EQUAL/);
  assert.match(floor, /unit329 pins the twins EQUAL/);
});

test('unit329 · the version law — version.ts and sw.js carry the same word', () => {
  const v = version.match(/export const APP_VERSION = '([^']+)';/);
  const s = sw.match(/const VERSION = "servepoint-v([^-]+)-r(\d+)"/);
  assert.ok(v, 'version.ts must speak APP_VERSION');
  assert.ok(s, 'sw.js must bake the cache word');
  assert.equal(v[1], s[1], 'the two words must agree');
  assert.equal(v[1], '5.290.0');
});
