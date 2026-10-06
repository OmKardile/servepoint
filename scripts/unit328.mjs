/* unit328 — v5.289.0 "the verbs learn to stick" (agreement shape)
 * The round's lens: the Platform console at the HEIGHT axis (1280×600 —
 * a squat viewport no round had walked). THE FINDING, on the first modal
 * it opened: the Add Business wizard's verb rows lived at the content's
 * end — at 600px the primary Continue sat 54px past the fold (panel
 * scrollHeight 604 vs clientHeight 550, measured) with NO affordance
 * naming the scroll. THE FIX (the stick): every step's footer sticks to
 * the panel's own bottom edge — sticky bottom-0, full-bleed through the
 * panel's own p-6, the house's hairline above, the rounded corners kept —
 * one shared constant so the three steps can never drift, the panel's own
 * scroll law byte-still. THE WORD: the step indicator's current li speaks
 * aria-current="step". THE JOIN: the businesses room's status census
 * speaks the SAME chip grammar the audit room learned at v5.288.0 (the
 * same constants, zero drift), composing with the room's own search, the
 * header count learning the filtered voice, the no-match card naming the
 * hunt. */

import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const read = (p) => readFileSync(`/home/z/my-project/${p}`, 'utf8');

const platform = read('src/components/platform/PlatformScreen.tsx');
const wizard = read('src/components/platform/ProvisioningWizard.tsx');
const version = read('src/version.ts');
const sw = read('public/sw.js');

const count = (hay, needle) => hay.split(needle).length - 1;

test('unit328 · the stick — one constant, three readers, the old shapes retired', () => {
  // the constant exists, defined exactly once
  assert.match(wizard, /const WIZARD_FOOT_STICK =/);
  assert.equal(count(wizard, 'const WIZARD_FOOT_STICK ='), 1);
  // read by every step's footer
  assert.equal(
    count(wizard, '${WIZARD_FOOT_STICK}'),
    3,
    'all three step footers must read the one stick grammar'
  );
  // the geometry: full-bleed through the panel's own p-6, hairline, corners kept
  assert.match(
    wizard,
    /'sticky bottom-0 -mx-6 -mb-6 rounded-b-3xl border-t border-\[#E3E7E0\] bg-white px-6 pb-5 pt-3'/
  );
  // the old in-flow footer shapes are fully retired
  assert.equal(count(wizard, 'justify-end gap-3 pt-2"'), 0, 'step 1\'s old footer is gone');
  assert.equal(count(wizard, 'justify-between gap-3 pt-2"'), 0, 'step 2\'s old footer is gone');
  assert.equal(count(wizard, 'justify-between gap-3 pt-1"'), 0, 'step 3\'s old footer is gone');
});

test('unit328 · the scroll law stands — the stick rides the scroller, never replaces it', () => {
  // the panel keeps its own bytes: it still scrolls, the footers just stick in it
  assert.match(wizard, /max-h-\[92vh\] w-full max-w-lg overflow-y-auto rounded-3xl/);
  assert.match(wizard, /bg-white p-6 shadow-xl/);
  // the door law byte-still (v5.110 — Escape stands down while submitting)
  assert.match(wizard, /v5\.110\.0 — the wizard holds the door/);
  assert.match(wizard, /if \(!submitting\) onClose\(\);/);
  // the primary verbs stay put, byte-still
  assert.equal(count(wizard, 'Continue'), 3, 'Continue on every step');
  assert.equal(count(wizard, 'Provision business'), 1);
  assert.equal(count(wizard, 'sp-cta'), 4, 'three primaries + the wizard\'s own CTA register');
});

test('unit328 · the word — the step indicator speaks aria-current="step"', () => {
  assert.match(wizard, /aria-current=\{current \? 'step' : undefined\}/);
  // the visual voice it rides beside is byte-still
  assert.match(wizard, /ring-4 ring-\[#F3E8CF\]/);
});

test('unit328 · the join — the businesses census reads the tenants themselves', () => {
  // the state (null = All) + the census (loudest first, ties alphabetical)
  assert.match(platform, /const \[businessStatus, setBusinessStatus\] = useState<string \| null>\(null\);/);
  assert.match(platform, /const businessStatuses = useMemo\(\(\) => \{/);
  assert.match(
    platform,
    /\.sort\(\(a, b\) => b\.count - a\.count \|\| a\.status\.localeCompare\(b\.status\)\);/,
    'the census law: loudest first, ties alphabetical'
  );
  // the filter composes: the chip's status (exact) AND the query
  assert.match(platform, /\(businessStatus === null \|\| t\.status === businessStatus\) &&/);
  assert.match(platform, /\}, \[tenants, businessQuery, businessStatus\]\);/);
});

test('unit328 · the join speaks — aria-pressed, the toggle, the census count', () => {
  // the chips group answers to assistive tech
  assert.match(platform, /aria-label="Filter the businesses by status"/);
  // All owns the null; a chip toggles itself off on the second tap
  assert.match(platform, /onClick=\{\(\) => setBusinessStatus\(null\)\}/);
  assert.match(platform, /onClick=\{\(\) => setBusinessStatus\(businessStatus === status \? null : status\)\}/);
  assert.match(platform, /aria-pressed=\{businessStatus === null\}/);
  assert.match(platform, /aria-pressed=\{businessStatus === status\}/);
  // the SAME constants the audit room reads — one definition, zero drift
  assert.equal(count(platform, 'HUNT_CHIP_ACTIVE'), 5, '1 definition + 2 audit reads + 2 businesses reads');
  assert.equal(count(platform, 'HUNT_CHIP_IDLE'), 5, '1 definition + 2 audit reads + 2 businesses reads');
  // the header count learns the filtered voice
  assert.match(platform, /\{filtering \? `\$\{filteredTenants\.length\} of \$\{tenants\.length\}` : tenants\.length\}/);
});

test('unit328 · the no-match card names the hunt — status, query, or both', () => {
  assert.match(platform, /const businessHuntWords = \[/);
  assert.match(platform, /businessStatus !== null \? `the status “\$\{businessStatus\}”` : '',/);
  assert.match(
    platform,
    /body=\{`No businesses match \$\{businessHuntWords\}\. Try a different name, slug or city\.`\}/
  );
  // the businesses no-match keeps its branch position (after the zero-tenants state)
  assert.match(platform, /: filteredTenants\.length === 0 \? \(/);
});

test('unit328 · the doctrine stands — the audit room and the businesses search byte-still', () => {
  // the audit room's own chips keep their words
  assert.match(platform, /aria-label="Filter the log by verb"/);
  assert.match(platform, /onClick=\{\(\) => setAuditVerb\(auditVerb === verb \? null : verb\)\}/);
  // the businesses search keeps its grammar (and the wizard adds no search)
  assert.match(platform, /placeholder="Search name, slug, city"/);
  assert.equal(
    count(platform, 'className="sp-input h-11 w-full pl-10 pr-4 text-sm sm:w-72"'),
    2,
    'exactly two search fields — the console speaks ONE search'
  );
  // the audit room's whole-ledger + filtered mapping laws stand
  assert.match(platform, /\{filteredLogs\.map\(\(log\) => \(/);
  assert.match(platform, /\{filteredTenants\.map\(\(t\) => \{/);
  // the belt bytes from 5.287.0 stand
  assert.equal(count(platform, 'overflow-x-auto [scrollbar-width:thin]'), 2, 'both tables keep their belts');
});

test('unit328 · the version law — version.ts and sw.js carry the same word', () => {
  const v = version.match(/export const APP_VERSION = '([^']+)';/);
  const s = sw.match(/const VERSION = "servepoint-v([^-]+)-r(\d+)"/);
  assert.ok(v, 'version.ts must speak APP_VERSION');
  assert.ok(s, 'sw.js must bake the cache word');
  assert.equal(v[1], s[1], 'the two words must agree');
  /* the agreement shape (the unit308 precedent): the literal relaxes each
   * round — 320 → … → 328 → 329 — the chain carries forward; the WORD
   * itself is unit329's law now. */
  assert.equal(v[1], '5.290.0');
});
