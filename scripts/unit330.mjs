/* unit330 — v5.291.0 "the shelf learns the hunt" (agreement shape)
 * The hunt family's third room. The walk (fresh eyes, the 375 portrait
 * axis — a lens no round had taken) found the guest family clean, and the
 * shelf audit found the menu management room carrying the exact disease
 * the audit room (v5.288.0) and the businesses room (v5.289.0) already
 * cured: a search that filters but reports dishonestly (N polite shrugs
 * where one honest word would do, no census voice, no chip narrowing).
 * THE FIX (the hunt, shelf edition): the shelf's own category census —
 * every named category with its dish count, loudest first, ties
 * alphabetical, zero-item rooms speaking count 0 — as a chip row speaking
 * the Platform console's EXACT grammar, carried as byte-twins (HUNT_CHIP_
 * IDLE / HUNT_CHIP_ACTIVE in MenuScreen, pinned EQUAL to PlatformScreen's
 * own), "All" owning the null chip, the second tap standing a chip down,
 * aria-pressed speaking every chip's state. THE COMPOSITION: the chip
 * narrows beside the search (the orphan shelf reachable through All). THE
 * VOICE: "N of M items on the shelf." when the hunt is on (role=status),
 * the whole count staying in the h1's subline when not. THE CARD: one
 * no-match card naming the prey (chip, needle, or both) instead of the N
 * empty sections. */

import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const read = (p) => readFileSync(`/home/z/my-project/${p}`, 'utf8');

const menu = read('src/components/menu/MenuScreen.tsx');
const platform = read('src/components/platform/PlatformScreen.tsx');
const version = read('src/version.ts');
const sw = read('public/sw.js');

const count = (hay, needle) => hay.split(needle).length - 1;

test('unit330 · the census and the composing filter — the shelf reads itself', () => {
  // the hunt state: one chip seat, null = All
  assert.match(menu, /const \[shelfCat, setShelfCat\] = useState<string \| null>\(null\);/);
  // the census: counts read from the shelf's own rows, loudest first, ties alphabetical
  assert.match(menu, /const shelfCats = useMemo\(\(\) => \{/);
  assert.match(menu, /const counts = new Map<string, number>\(\);/);
  assert.match(menu, /\.sort\(\(a, b\) => b\.count - a\.count \|\| a\.name\.localeCompare\(b\.name\)\);/);
  assert.match(menu, /\}, \[categories, items\]\);/);
  // zero-item rooms speak too — an honest count of 0, not an invented drop
  assert.match(menu, /count: counts\.get\(c\.id\) \|\| 0/);
  // the composing filter: the chip narrows beside the search, not instead of it
  assert.match(menu, /\.filter\(\(c\) => shelfCat === null \|\| c\.id === shelfCat\)/);
  assert.match(menu, /if \(orphan\.length > 0 && shelfCat === null\) grouped\.push\(\{ category: null, list: orphan \}\);/);
  assert.match(menu, /if \(!q && shelfCat === null\) return grouped;/);
  assert.match(menu, /\}, \[categories, items, q, shelfCat\]\);/);
  // the filtered voice's inputs: the hunt flag, the hit count, the prey's words
  assert.match(menu, /const shelfFiltering = shelfCat !== null \|\| q !== '';/);
  assert.match(menu, /catsWithItems\.reduce\(\(n, g\) => n \+ g\.list\.length, 0\)/);
  // the memo's own dependency seat (re-pinned to the actual shape: the
  // reduce closes above, the deps array sits on its own line)
  assert.match(menu, /\n    \[catsWithItems\],/);
});

test('unit330 · ONE hunt grammar — the byte-twins never drift', () => {
  // the twins exist in the menu room, one definition each
  assert.equal(count(menu, 'const HUNT_CHIP_IDLE ='), 1, 'the menu twin is one');
  assert.equal(count(menu, 'const HUNT_CHIP_ACTIVE ='), 1, 'the menu twin is one');
  // and they are BYTE-EQUAL to the Platform console's own — one grammar, three rooms
  const menuIdle = menu.match(/const HUNT_CHIP_IDLE =\n  '([^']+)';/);
  const menuActive = menu.match(/const HUNT_CHIP_ACTIVE =\n  '([^']+)';/);
  const platformIdle = platform.match(/const HUNT_CHIP_IDLE =\n  '([^']+)';/);
  const platformActive = platform.match(/const HUNT_CHIP_ACTIVE =\n  '([^']+)';/);
  assert.ok(menuIdle && menuActive, 'the menu twins must both be defined');
  assert.ok(platformIdle && platformActive, 'the platform twins must both be defined');
  assert.equal(menuIdle[1], platformIdle[1], 'the idle voice must never drift');
  assert.equal(menuActive[1], platformActive[1], 'the active voice must never drift');
  // the twins' comment names the law
  assert.match(menu, /byte-twins of the Platform/);
  assert.match(menu, /unit330 pins the twins EQUAL/);
});

test('unit330 · the chips speak — aria-pressed, the toggle, the tabular counts', () => {
  // every chip speaks its state (All + census chip). The room's third
  // speaker is the add-on link toggles' own aria-pressed={on} (pre-existing,
  // re-pinned per the read-the-actual-shape law: 2 hunt + 1 add-on = 3).
  assert.equal(count(menu, 'aria-pressed='), 3, '2 hunt chips + the add-on toggles\' own speaker');
  assert.match(menu, /aria-pressed=\{shelfCat === null\}/);
  assert.match(menu, /aria-pressed=\{shelfCat === c\.id\}/);
  // All owns the null chip; the second tap stands a chip down
  assert.match(menu, /onClick=\{\(\) => setShelfCat\(null\)\}/);
  assert.match(menu, /onClick=\{\(\) => setShelfCat\(shelfCat === c\.id \? null : c\.id\)\}/);
  // the row speaks its purpose to the ear
  assert.match(menu, /role="group" aria-label="Filter the shelf by category"/);
  // the voices ride the twins
  assert.match(menu, /className=\{shelfCat === null \? HUNT_CHIP_ACTIVE : HUNT_CHIP_IDLE\}/);
  assert.match(menu, /className=\{shelfCat === c\.id \? HUNT_CHIP_ACTIVE : HUNT_CHIP_IDLE\}/);
  // the counts hold still inside the chips (the v5.282 law, chip edition)
  assert.equal(count(menu, '"ml-1.5 text-[11px] opacity-70 tabular-nums"'), 2, 'All + census chip counts');
});

test('unit330 · the census voice — N of M when the hunt is on', () => {
  // the voice speaks only when hunting, as a status the ear can find
  assert.match(menu, /\{shelfFiltering && \(/);
  assert.match(menu, /role="status">/);
  assert.match(menu, /\{shelfHits\} of \{totalItems\} item\{totalItems === 1 \? '' : 's'\} on the shelf\./);
  // the row only exists when the shelf has rooms to name
  assert.match(menu, /\{categories\.length > 0 && \(/);
});

test('unit330 · the no-match card — one honest word, the prey named', () => {
  // the branch: only when the hunt is on AND no section survived it
  assert.match(menu, /\) : shelfFiltering && catsWithItems\.length === 0 \? \(/);
  // the card wears the shelf's own section grammar (not a forked card law)
  assert.match(menu, /rounded-3xl border border-\[#E3E7E0\] bg-white p-2 shadow-sm/);
  // the ear's picture and the honest words
  assert.match(menu, /<Search size=\{38\} strokeWidth=\{1\.8\} aria-hidden \/>/);
  assert.match(menu, /No matches<\/h3>/);
  assert.match(menu, /No dishes match \$\{shelfHuntWords\}\. Try a name, a description or a category\./);
  // the prey's words: chip, needle, or both — the same hunt-words shape
  assert.match(menu, /the category “\$\{categories\.find\(\(c\) => c\.id === shelfCat\)\?\.name \?\? ''\}”/);
  assert.match(menu, /query\.trim\(\) \? `“\$\{query\.trim\(\)\}”` : ''/);
  assert.match(menu, /\.filter\(Boolean\)\.join\(' and '\)/);
});

test('unit330 · the old shelves stand byte-still — the prune law', () => {
  // the truly-empty card keeps its own words and its own door
  assert.match(menu, /Your menu is empty/);
  assert.match(menu, /Add your first category/);
  // the per-section line keeps its honest shrug for partial hunts
  assert.match(menu, /No items here\{q \? ' matching your search' : ''\} yet\./);
  // the two search doors stay one state (the v5.116 law)
  assert.equal(count(menu, "placeholder: 'Search items…'"), 1, 'the header door');
  assert.equal(count(menu, 'placeholder="Search items…"'), 1, 'the screen door');
  // the v5.290 doors stand: the stick twins, the foot prop, the duplicate door
  assert.equal(count(menu, 'const OVERLAY_FOOT_STICK ='), 1);
  assert.equal(count(menu, 'foot={'), 2);
  assert.match(menu, /const catDuplicate = useMemo\(/);
  // the toolbar's own verbs byte-still
  assert.match(menu, /aria-label="Copy the menu as text"/);
  assert.match(menu, /aria-label="Share the menu on WhatsApp"/);
  assert.match(menu, /idleWord="Catalog CSV"/);
  assert.match(menu, /<Plus size=\{15\} aria-hidden \/> Add item/);
});

test('unit330 · the platform rooms stand byte-still — the family law', () => {
  // the audit room and the businesses room keep their own chips untouched
  assert.equal(count(platform, 'const HUNT_CHIP_IDLE ='), 1, 'one definition in the console');
  assert.equal(count(platform, 'const HUNT_CHIP_ACTIVE ='), 1, 'one definition in the console');
  assert.equal(count(platform, 'aria-pressed='), 4, 'audit All+verb, businesses All+status');
  assert.match(platform, /No events match \$\{huntWords\}/);
  assert.match(platform, /No businesses match \$\{businessHuntWords\}/);
});

test('unit330 · the version law — version.ts and sw.js carry the same word', () => {
  const v = version.match(/export const APP_VERSION = '([^']+)';/);
  const s = sw.match(/const VERSION = "servepoint-v([^-]+)-r(\d+)"/);
  assert.ok(v, 'version.ts must speak APP_VERSION');
  assert.ok(s, 'sw.js must bake the cache word');
  assert.equal(v[1], s[1], 'the two words must agree');
  /* v5.292.0 — the version literal relaxed to the agreement shape per the
   * unit308 precedent (the 320→…→331 chain): the battery's own unit331
   * pins the current word; this suite pins only the agreement. */
});
