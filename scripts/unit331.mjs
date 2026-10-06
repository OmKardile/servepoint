/* unit331 — v5.292.0 "the board learns the hunt" (agreement shape)
 * The hunt family's fourth room (327 audit → 328 businesses → 330 menu →
 * 331 board). The fresh-eyes walk (1024×768 tablet landscape — a lens no
 * round had taken) found the guest family clean, and the source-shape
 * audit found the floor board carrying TWO diseases: the polite shrug
 * the family exists to cure (a status-filter miss rendered the dashed
 * "Nothing occupied right now" card AND the miss card — the floor spoke
 * its miss TWICE), and the family's own absence (the board narrowed by
 * the search and the status tiles, never by its own ROOMS). THE FIX: the
 * redundant shrug card retired — the miss card is the floor's ONE miss
 * voice. THE CHIPS: the board's own section census (every distinct
 * section word with its table count, loudest first, ties alphabetical,
 * counts whole-house) as a chip row speaking the Platform console's
 * EXACT grammar, carried as byte-twins (HUNT_CHIP_IDLE / HUNT_CHIP_
 * ACTIVE in FloorScreen, pinned EQUAL to PlatformScreen's own), "All"
 * owning the null chip, the second tap standing a chip down, aria-
 * pressed speaking every chip. THE COMPOSITION: chip AND tile AND
 * needle — three doors narrow together, the family's deepest. THE
 * VOICE: the board's Showing line grew doors ("Showing N of M tables ·
 * Patio only · occupied only · matching "t1""), role=status, speaking
 * for ANY door standing. THE MISS: the prey named door by door, "any"
 * replacing "either" — three doors make either a lie. */

import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const read = (p) => readFileSync(`/home/z/my-project/${p}`, 'utf8');

const floor = read('src/components/floor/FloorScreen.tsx');
const platform = read('src/components/platform/PlatformScreen.tsx');
const menu = read('src/components/menu/MenuScreen.tsx');
const version = read('src/version.ts');
const sw = read('public/sw.js');

const count = (hay, needle) => hay.split(needle).length - 1;

test('unit331 · the census and the composing filter — the board reads its rooms', () => {
  // the hunt state: one chip seat, null = All
  assert.match(floor, /const \[sectionChip, setSectionChip\] = useState<string \| null>\(null\);/);
  // the census: counts read from the board's own rows, loudest first, ties alphabetical
  assert.match(floor, /const sectionCats = useMemo\(\(\) => \{/);
  assert.match(floor, /const counts = new Map<string, number>\(\);/);
  assert.match(floor, /counts\.set\(key, \(counts\.get\(key\) \|\| 0\) \+ 1\);/);
  assert.match(floor, /\.sort\(\(a, b\) => b\.count - a\.count \|\| a\.section\.localeCompare\(b\.section\)\);/);
  assert.match(floor, /\}, \[tables\]\);/);
  // the composing filter: the chip narrows beside the tile AND the needle
  assert.match(floor, /if \(sectionChip !== null && key !== sectionChip\) return;/);
  assert.match(floor, /if \(filter && t\.status !== filter\) return;/);
  assert.match(floor, /if \(q && !key\.toLowerCase\(\)\.includes\(q\) && !String\(t\.table_number\)\.toLowerCase\(\)\.includes\(q\)\) return;/);
  assert.match(floor, /\}, \[tables, filter, q, sectionChip\]\);/);
});

test('unit331 · ONE hunt grammar — the byte-twins never drift', () => {
  // the twins exist in the floor room, one definition each
  assert.equal(count(floor, 'const HUNT_CHIP_IDLE ='), 1, 'the floor twin is one');
  assert.equal(count(floor, 'const HUNT_CHIP_ACTIVE ='), 1, 'the floor twin is one');
  // and they are BYTE-EQUAL to the Platform console's own — one grammar, four rooms
  const floorIdle = floor.match(/const HUNT_CHIP_IDLE =\n  '([^']+)';/);
  const floorActive = floor.match(/const HUNT_CHIP_ACTIVE =\n  '([^']+)';/);
  const platformIdle = platform.match(/const HUNT_CHIP_IDLE =\n  '([^']+)';/);
  const platformActive = platform.match(/const HUNT_CHIP_ACTIVE =\n  '([^']+)';/);
  assert.ok(floorIdle && floorActive, 'the floor twins must both be defined');
  assert.ok(platformIdle && platformActive, 'the platform twins must both be defined');
  assert.equal(floorIdle[1], platformIdle[1], 'the idle voice must never drift');
  assert.equal(floorActive[1], platformActive[1], 'the active voice must never drift');
  // the twins' comment names the law
  assert.match(floor, /byte-twins of the Platform/);
  assert.match(floor, /unit331 pins the twins EQUAL/);
});

test('unit331 · the chips speak — aria-pressed, the toggle, the tabular counts', () => {
  // every chip speaks its state. The room's other speakers re-read from
  // the actual shape (the read-the-actual-shape law): the stat tiles' one
  // map line + the showPast toggle + the rhythm mode + 2 hunt chips = 5.
  assert.equal(count(floor, 'aria-pressed='), 5, 'tiles map + showPast + rhythm + 2 hunt chips');
  assert.match(floor, /aria-pressed=\{sectionChip === null\}/);
  assert.match(floor, /aria-pressed=\{sectionChip === c\.section\}/);
  // All owns the null chip; the second tap stands a chip down
  assert.match(floor, /onClick=\{\(\) => setSectionChip\(null\)\}/);
  assert.match(floor, /onClick=\{\(\) => setSectionChip\(sectionChip === c\.section \? null : c\.section\)\}/);
  // the row speaks its purpose to the ear, and only when the board has rooms
  assert.match(floor, /role="group" aria-label="Filter the board by section"/);
  assert.match(floor, /\{\(tables \|\| \[\]\)\.length > 0 && sectionCats\.length > 0 && \(/);
  // the voices ride the twins
  assert.match(floor, /className=\{sectionChip === null \? HUNT_CHIP_ACTIVE : HUNT_CHIP_IDLE\}/);
  assert.match(floor, /className=\{sectionChip === c\.section \? HUNT_CHIP_ACTIVE : HUNT_CHIP_IDLE\}/);
  // the counts hold still inside the chips (the v5.282 law, chip edition)
  assert.equal(count(floor, '"ml-1.5 text-[11px] opacity-70 tabular-nums"'), 2, 'All + census chip counts');
});

test('unit331 · the census voice — the Showing line grew doors', () => {
  // the door words: every open door names itself, in play order
  assert.match(floor, /sectionChip !== null \? `\$\{sectionChip\} only` : ''/);
  assert.match(floor, /filter \? `\$\{STATUS_META\[filter\]\.label\.toLowerCase\(\)\} only` : ''/);
  assert.match(floor, /missQ \? `matching “\$\{missQ\}”` : ''/);
  assert.match(floor, /\]\.filter\(Boolean\);/);
  // the voice speaks for ANY door standing, as a status the ear can find
  assert.match(floor, /\{huntDoors\.length > 0 && \(/);
  assert.match(floor, /role="status">/);
  // the narrowed count rides matchedCount — never the whole-house count
  assert.match(floor, /Showing <span className="font-bold text-\[#0F3D3E\]">\{matchedCount\}<\/span> of \{\(tables \|\| \[\]\)\.length\} tables/);
  // the way out clears every door, not just one
  assert.match(floor, /setQuery\(''\);\n              setSectionChip\(null\);\n              setFilter\(null\);/);
});

test('unit331 · the miss card names every door — one honest miss voice', () => {
  // the doors speak: tile, chip — and "any" replaces "either" (three doors)
  assert.match(floor, /\{filterLabel && <> The \{filterLabel\} tile is also in play — any can miss\.<\/>\}/);
  assert.match(floor, /\{sectionChip !== null && <> The “\{sectionChip\}” chip is also in play — any can miss\.<\/>\}/);
  // a chip-only miss speaks the room's own count, honestly
  assert.match(floor, /“\{sectionChip\}” holds \{sectionCats\.find\(\(c\) => c\.section === sectionChip\)\?\.count \?\? 0\} tables/);
  // the way out's word names the doors it clears
  assert.match(floor, /const missDoorCount = \(missQ \? 1 : 0\) \+ \(filterLabel \? 1 : 0\) \+ \(sectionChip !== null \? 1 : 0\);/);
  assert.match(floor, /missDoorCount >= 3 \? 'Clear all three' : missQ && filterLabel \? 'Clear both' : missQ \? 'Clear search' : 'Show all tables'/);
  // the card's way out clears the chip's seat too
  assert.match(floor, /setQuery\(''\);\n                  setSectionChip\(null\);\n                  if \(filterLabel\) setFilter\(null\);/);
});

test('unit331 · the prune law — the shrug retired, the old voices byte-still', () => {
  // the redundant shrug card is GONE — the miss card is the one voice
  assert.equal(count(floor, 'Nothing {STATUS_META[filter].label.toLowerCase()} right now'), 0, 'the polite shrug retired');
  assert.equal(count(floor, 'The board refreshes itself the moment an order lands'), 0, 'the shrug\'s body gone with it');
  // the old whole-house showing count is gone with its only reader
  assert.equal(count(floor, 'visibleCount'), 0, 'the orphan derived pruned');
  // the truth state keeps its own sentence (an empty floor is not a miss)
  assert.match(floor, /No tables yet/);
  assert.match(floor, /Add your first table/);
  // the board's own renderers stand: sections map, the glints, the badges
  assert.match(floor, /\{sections\.map\(\(\[section, list\]\) => \(/);
  assert.match(floor, /<MarkHit text=\{section\} query=\{query\} \/>/);
  assert.match(floor, /const matchedCount = useMemo\(\(\) => sections\.reduce\(\(n, \[, list\]\) => n \+ list\.length, 0\), \[sections\]\);/);
  // the v5.290 datalist stands byte-still — two honest voices, two purposes
  assert.match(floor, /const knownSections = useMemo\(/);
  assert.match(floor, /\[\.\.\.new Set\(\(tables \|\| \[\]\)\.map\(\(t\) => t\.section \|\| 'Main Floor'\)\)\]\.sort\(\(a, b\) => a\.localeCompare\(b\)\)/);
  assert.match(floor, /<datalist id="ft-sections">/);
  // the stat tiles keep their own census (the tiles are the status census)
  assert.match(floor, /aria-pressed=\{active\}/);
  assert.match(floor, /aria-pressed=\{showPast\}/);
  assert.match(floor, /aria-pressed=\{rhythmMode === mode\}/);
  // the stick twins and the drill's doors stand (unit329's own pins — the
  // scroll law re-pinned to its actual class order per the read-the-
  // actual-shape law: the translate sits mid-chain)
  assert.equal(count(floor, 'const FLOOR_FOOT_STICK ='), 1);
  assert.match(floor, /max-h-\[92vh\] max-w-\[420px\] -translate-y-1\/2 overflow-y-auto/);
});

test('unit331 · the family law — the other three rooms stand byte-still', () => {
  // the Platform console keeps its own chips untouched
  assert.equal(count(platform, 'const HUNT_CHIP_IDLE ='), 1, 'one definition in the console');
  assert.equal(count(platform, 'const HUNT_CHIP_ACTIVE ='), 1, 'one definition in the console');
  assert.equal(count(platform, 'aria-pressed='), 4, 'audit All+verb, businesses All+status');
  assert.match(platform, /No events match \$\{huntWords\}/);
  assert.match(platform, /No businesses match \$\{businessHuntWords\}/);
  // the menu shelf keeps its own chips untouched
  assert.equal(count(menu, 'const HUNT_CHIP_IDLE ='), 1, 'one definition on the shelf');
  assert.equal(count(menu, 'const HUNT_CHIP_ACTIVE ='), 1, 'one definition on the shelf');
  assert.equal(count(menu, 'aria-pressed='), 3, "2 hunt chips + the add-on toggles' own speaker");
  assert.match(menu, /No dishes match \$\{shelfHuntWords\}/);
});

test('unit331 · the version law — version.ts and sw.js carry the same word', () => {
  const v = version.match(/export const APP_VERSION = '([^']+)';/);
  const s = sw.match(/const VERSION = "servepoint-v([^-]+)-r(\d+)"/);
  assert.ok(v, 'version.ts must speak APP_VERSION');
  assert.ok(s, 'sw.js must bake the cache word');
  assert.equal(v[1], s[1], 'the two words must agree');
});
