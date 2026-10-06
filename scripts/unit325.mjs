/* unit325 — v5.286.0 "the platform learns its address" (agreement shape)
 * The round's lens: the Platform console itself — the SuperAdmin's own
 * chrome, reachable with the bootstrap operator, no owner password needed
 * — a surface no recent round had walked. The guest surfaces came back
 * clean on their NEW axis (landscape/short viewports; a keyboard walk),
 * and the console walk FOUND its finding: the rail's four nav pills spoke
 * PURE STATE — /businesses fell to the honest 404 door, a bookmark was
 * impossible, a mid-session refresh threw the operator back to Dashboard.
 * THE FIX rides the house's ONE address law (v5.93: the rail's spoken
 * names are the URLs; v5.235: reader and writer share one grammar home,
 * replaceState, no history pile): lib/sectionPath carries the platform's
 * own words BESIDE the staff's untouched SECTION_SLUGS ('businesses' is
 * not a staff Section — unit274's pin stands), the door admits them, the
 * boot reads them, and the ONE writer claims them. Dashboard keeps the
 * bare root's throne; a path that already names the running room keeps
 * its own word (/audit is not silently rewritten to /audit-log). */

import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const read = (p) => readFileSync(`/home/z/my-project/${p}`, 'utf8');

const grammar = read('src/lib/sectionPath.ts');
const app = read('src/App.tsx');
const platform = read('src/components/platform/PlatformScreen.tsx');
const session = read('src/store/session.ts');
const version = read('src/version.ts');
const sw = read('public/sw.js');

test('unit325 · the grammar home carries the platform\u2019s own words \u2014 PLATFORM_SLUGS beside the staff slugs', () => {
  // the union lives in the ONE grammar home — slugs and tab words cannot drift
  assert.match(
    grammar,
    /export type PlatformTab = 'dashboard' \| 'businesses' \| 'subscriptions' \| 'audit';/,
    'the tab union must be spelled beside the slugs it names'
  );
  // the rail's spoken name resolves: "Audit log" → /audit-log
  assert.match(grammar, /\['audit-log', 'audit'\],/);
  // the plain id keeps working
  assert.match(grammar, /\['audit', 'audit'\],/);
  // the other two rooms
  assert.match(grammar, /\['businesses', 'businesses'\],/);
  assert.match(grammar, /\['subscriptions', 'subscriptions'\],/);
  // Dashboard is deliberately absent — the bare root names it
  assert.ok(!/\['dashboard',/.test(grammar), 'the bare root must keep its throne — no /dashboard slug');
  // the writer's target: dashboard → '/', every other room → its rail slug
  assert.match(
    grammar,
    /export const platformPathForTab = \(tab: PlatformTab\): string =>\s*\n\s*tab === 'dashboard' \? '\/' :/,
    'dashboard writes the bare root, never /dashboard'
  );
});

test('unit325 · the reader asks the FIRST segment \u2014 the console has no pinned-wall form', () => {
  // the platform reader reads parts[0] only (contrast: sectionFromPath
  // reads the SECOND segment of a two-segment pinned-wall path)
  assert.match(
    grammar,
    /export const platformTabFromPath = \(path: string\): PlatformTab \| undefined => \{\s*\n\s*const seg = path\.split\('\/'\)\.filter\(Boolean\)\[0\];/,
    'the platform reader must read the FIRST segment'
  );
  // ...while the staff reader keeps its own two-segment law
  assert.match(grammar, /const parts = path\.split\('\/'\)\.filter\(Boolean\);\s*\n\s*const seg = parts\.length >= 2 \? parts\[1\] : parts\[0\];/);
});

test('unit325 · the door answers the platform\u2019s words \u2014 the three-way knownDoor', () => {
  assert.match(
    app,
    /const knownDoor =\s*\n\s*pathname === '\/' \|\|\s*\n\s*sectionFromPath\(SECTION_SLUGS, pathname\) !== undefined \|\|\s*\n\s*platformTabFromPath\(pathname\) !== undefined;/,
    'the 404 door must admit the platform slugs beside the staff slugs'
  );
  assert.match(app, /import \{ SECTION_SLUGS, sectionFromPath, platformTabFromPath \} from '\.\/lib\/sectionPath';/);
});

test('unit325 · the boot reads the address \u2014 a deep link lands in the room the path names', () => {
  assert.match(
    platform,
    /const \[tab, setTabState\] = useState<PlatformTab>\(\s*\n\s*\(\) => platformTabFromPath\(window\.location\.pathname\) \?\? 'dashboard'\s*\n\s*\);/,
    'the boot must read the address, Dashboard keeping the throne'
  );
  // the union now arrives from the grammar home, not the component
  assert.match(platform, /import \{\s*\n\s*platformTabFromPath,\s*\n\s*platformPathForTab,\s*\n\s*PLATFORM_SLUGS,\s*\n\s*type PlatformTab,\s*\n\s*\} from '\.\.\/\.\.\/lib\/sectionPath';/);
  assert.ok(!/type PlatformTab = 'dashboard'/.test(platform), 'the union must have ONE home — the component must not re-spell it');
});

test('unit325 · the ONE writer \u2014 replaceState, the bare root\u2019s throne, the keeps-its-own-word clause', () => {
  assert.match(
    platform,
    /const setTab = useCallback\(\(next: PlatformTab\) => \{\s*\n\s*setTabState\(next\);\s*\n\s*if \(typeof window !== 'undefined' && typeof history !== 'undefined'\) \{\s*\n\s*const path = window\.location\.pathname;\s*\n\s*const seg = path\.split\('\/'\)\.filter\(Boolean\)\[0\];\s*\n\s*const alreadyNamesRoom = seg \? PLATFORM_SLUGS\[seg\] === next : next === 'dashboard';\s*\n\s*if \(!alreadyNamesRoom\) \{\s*\n\s*history\.replaceState\(null, '', platformPathForTab\(next\)\);\s*\n\s*\}\s*\n\s*\}\s*\n\s*\}, \[\]\);/,
    'the ONE writer: setTabState + the replaceState claim, guarded by the keeps-its-own-word clause'
  );
  // v5.235.0's doctrine byte-for-byte: replaceState, never pushState
  assert.ok(!/pushState/.test(platform), 'no history pile — the Back key keeps its device-level meaning');
  // the rail and the View all verbs all ride the ONE writer
  const clicks = platform.match(/onClick=\{\(\) => setTab\([^)]*\)\}/g) || [];
  assert.ok(clicks.length >= 3, `the rail + View all must ride the ONE writer (found ${clicks.length})`);
  assert.ok(!/setTabState\('/.test(platform), 'no call site may bypass the writer to set a literal tab');
});

test('unit325 · the staff grammar stands untouched \u2014 platform words never entered it', () => {
  // SECTION_IDS stays the fourteen staff sections; no platform word inside
  const ids = grammar.match(/export const SECTION_IDS: readonly Section\[\] = Object\.freeze\(\[[\s\S]*?\]\);/);
  assert.ok(ids, 'the staff id list must stand');
  assert.ok(!/businesses|subscriptions|audit/.test(ids[0]), 'the staff list must not carry platform words');
  // the two spoken aliases keep their posts
  assert.match(grammar, /\['close-out', 'eod'\],/);
  assert.match(grammar, /\['guests', 'customers'\],/);
});

test('unit325 · the doctrine stands \u2014 goSection\u2019s address law byte-still', () => {
  // the staff writer keeps its shape: the navigation act claims the URL
  assert.match(
    session,
    /if \(typeof window !== 'undefined' && typeof history !== 'undefined'\) \{\s*\n\s*const path = window\.location\.pathname;\s*\n\s*if \(sectionFromPath\(SECTION_SLUGS, path\) !== section\) \{\s*\n\s*history\.replaceState\(null, '', `\/\$\{section\}`\);\s*\n\s*\}\s*\n\s*\}/,
    'goSection keeps its replaceState law — the platform writer rides the SAME doctrine'
  );
  assert.ok(!/pushState/.test(session), 'no history pile in the staff law either');
  // the platform rail keeps its a11y register: aria-current=page on the pills
  assert.match(platform, /aria-current=\{active \? 'page' : undefined\}/);
  // the rail's spoken words keep their posts
  assert.match(platform, /label: 'Audit log'/);
  assert.match(platform, /aria-label="Platform sections"/);
  /* v5.286.0's styling register: the platform rail learns the staff rail's
   * own pill grammar — the hover ease AND the full keyboard ring (the walk
   * found the staff Sidebar speaking transition + four focus-visible bytes
   * the platform pills never wore; a keyboard operator saw no ring). */
  assert.match(
    platform,
    /className=\{`sp-nav-pill relative flex h-11 w-full items-center justify-center gap-3 rounded-xl px-0 text-\[13\.5px\] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-\[#B88E2F\]\/70 focus-visible:ring-offset-2 focus-visible:ring-offset-\[#0B2E2F\] md:justify-start md:px-4/,
    'the platform rail pills must wear the staff rail\u2019s own transition + focus-ring grammar'
  );
  const staffRail = read('src/components/shell/Sidebar.tsx');
  assert.match(
    staffRail,
    /focus-visible:ring-\[#B88E2F\]\/70 focus-visible:ring-offset-2 focus-visible:ring-offset-\[#0B2E2F\]/,
    'the ring the platform learned must be the staff rail\u2019s own byte'
  );
});

test('unit325 · the version law — version.ts and sw.js carry the same word', () => {
  const v = version.match(/export const APP_VERSION = '([^']+)';/);
  const s = sw.match(/const VERSION = "servepoint-v([^-]+)-r(\d+)"/);
  assert.ok(v, 'version.ts must speak APP_VERSION');
  assert.ok(s, 'sw.js must bake the cache word');
  assert.equal(v[1], s[1], 'the two words must agree');
  assert.equal(v[1], '5.286.0');
});
