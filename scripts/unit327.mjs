/* unit327 — v5.288.0 "the audit log learns the hunt" (agreement shape)
 * The round's lens: the guest family at the tablet axis (768 portrait —
 * menu, customizer, cart drawer, track, 404, showcase, help: every surface
 * CLEAN, no overflow, console clean) plus the Platform console at 1280 as
 * the content lens. No bug spoke anywhere, so the round went to the
 * feature the walk itself pointed at: the audit log is the one console
 * room that speaks NO tools — businesses has search + copy + expand,
 * subscriptions has its MRR register, dashboard has its census; the log
 * had a bare list. THE HUNT: (1) a search field riding the businesses
 * room's own search grammar byte-for-byte, hunting case-insensitively
 * across action, actor and details; (2) verb chips — the hunt's census
 * read from the ledger itself (distinct actions with counts, loudest
 * first), "All" owning the null chip, a verb chip toggling itself off on
 * the second tap, aria-pressed speaking the state; (3) a copy verb on
 * every row — CopyValueButton (the ONE breath, useCopyAck) in the quiet
 * flex pair beside the action, carrying the WHOLE event line for the
 * support ticket; and (4) the census learning the filtered voice
 * ("N of M events on record") with the no-match card naming the hunt. */

import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const read = (p) => readFileSync(`/home/z/my-project/${p}`, 'utf8');

const platform = read('src/components/platform/PlatformScreen.tsx');
const version = read('src/version.ts');
const sw = read('public/sw.js');

const count = (hay, needle) => hay.split(needle).length - 1;

test('unit327 · the hunt lives — state, the verbs census, and the composing filter', () => {
  // the room's own state (the verb chip's null is "All")
  assert.match(platform, /const \[auditQuery, setAuditQuery\] = useState\(''\);/);
  assert.match(platform, /const \[auditVerb, setAuditVerb\] = useState<string \| null>\(null\);/);
  // the census is read from the ledger itself — distinct actions with counts,
  // loudest first, ties alphabetical
  assert.match(platform, /const auditVerbs = useMemo\(\(\) => \{/, 'the verbs census must live');
  assert.match(
    platform,
    /\.sort\(\(a, b\) => b\.count - a\.count \|\| a\.verb\.localeCompare\(b\.verb\)\);/,
    'loudest first, ties alphabetical'
  );
  // the filter composes BOTH: the chip's verb (exact) AND the query (case-insensitive)
  assert.match(platform, /if \(auditVerb !== null && log\.action !== auditVerb\) return false;/);
  assert.match(platform, /log\.action\.toLowerCase\(\)\.includes\(q\) \|\|/);
  assert.match(platform, /\(log\.actor_email \|\| ''\)\.toLowerCase\(\)\.includes\(q\) \|\|/);
  assert.match(platform, /log\.details\.toLowerCase\(\)\.includes\(q\)/);
  assert.match(platform, /\}, \[logs, auditQuery, auditVerb\]\);/, 'the filter listens to all three');
});

test('unit327 · ONE search grammar — the audit field is a byte-sibling of the businesses field', () => {
  // the businesses room's own search input shape, reused verbatim
  assert.match(platform, /placeholder="Search verb, actor, business"/);
  assert.match(platform, /aria-label="Search the audit log by verb, actor or business"/);
  // the shared input byte: the same class spellings the businesses field wears
  assert.equal(
    count(platform, 'className="sp-input h-11 w-full pl-10 pr-4 text-sm sm:w-72"'),
    2,
    'both search fields must wear the same input bytes'
  );
  assert.equal(count(platform, 'style={{ borderRadius: 9999 }}'), 2, 'both pills ride the same shape');
  // the icon grammar rides the same relative wrapper
  assert.equal(
    count(
      platform,
      'className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#969696]"'
    ),
    2,
    'both fields speak the same Search icon bytes'
  );
});

test('unit327 · the verb chips speak their state — aria-pressed, the toggle, the two voices', () => {
  // aria-pressed on every chip (the All chip + one per verb chip)
  assert.equal(count(platform, 'aria-pressed='), 2, 'both chip sites must speak aria-pressed');
  // the All chip owns the null
  assert.match(platform, /onClick=\{\(\) => setAuditVerb\(null\)\}/);
  assert.match(platform, /aria-pressed=\{auditVerb === null\}/);
  // a verb chip toggles itself off on the second tap
  assert.match(platform, /onClick=\{\(\) => setAuditVerb\(auditVerb === verb \? null : verb\)\}/);
  assert.match(platform, /aria-pressed=\{auditVerb === verb\}/);
  // the two voices: the rail's strong teal when active, the card's quiet border when idle
  assert.match(platform, /const HUNT_CHIP_ACTIVE =/);
  assert.match(platform, /const HUNT_CHIP_IDLE =/);
  assert.match(platform, /bg-\[#0F3D3E\] px-3 text-xs font-semibold text-white shadow-sm/);
  assert.match(platform, /border border-\[#E3E7E0\] bg-white px-3 text-xs font-medium text-\[#6B6B6B\]/);
  // the house's gold ring in BOTH voices, offset to the room's own floor
  assert.equal(
    count(platform, 'focus-visible:ring-2 focus-visible:ring-[#B88E2F]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#F6F5F2]'),
    2,
    'both chip voices carry the house ring'
  );
  // the chips' census counts are visible and tabular
  assert.match(platform, /className="ml-1\.5 text-\[11px\] opacity-70 tabular-nums"\>/);
  // the group answers to assistive tech
  assert.match(platform, /aria-label="Filter the log by verb"/);
});

test('unit327 · the census learns the filtered voice — "N of M" while hunting, the old line byte-still', () => {
  // the filtered census: N of M events on record
  assert.match(
    platform,
    /\$\{filteredLogs\.length\} of \$\{logs\.length\} \$\{logs\.length === 1 \? 'event' : 'events'\} on record/
  );
  // the unfiltered census keeps its exact 5.246.0 voice
  assert.match(
    platform,
    /\$\{logs\.length\} \$\{logs\.length === 1 \? 'event' : 'events'\} on record/
  );
  // the hunt's own words for the no-match card
  assert.match(platform, /const huntWords = \[/);
  assert.match(platform, /\.filter\(Boolean\)\s*\n\s*\.join\(' and '\);/);
});

test('unit327 · the row learned to leave — the copy verb rides the ONE breath', () => {
  // the quiet flex pair beside the action
  assert.match(platform, /<div className="flex items-start gap-1\.5">/);
  assert.match(
    platform,
    /<p className="min-w-0 break-words text-sm font-semibold text-\[#1A1A1A\]">\{log\.action\}<\/p>/,
    'the action keeps its wrap bounds'
  );
  assert.match(
    platform,
    /<CopyValueButton value=\{auditLineFor\(log\)\} label="event line" \/>/,
    'the verb carries the whole event line'
  );
  // the line: verb · details · actor(System fallback) · stamp, the house's separator
  assert.match(platform, /function auditLineFor\(log: AuditLogEntry\): string \{/);
  assert.match(platform, /log\.actor_email \|\| 'System',/);
  assert.match(platform, /dayTime\(log\.timestamp, appTimezone\(\)\),/);
  assert.match(platform, /\.join\(' · '\);/);
  // the ONE breath law: no hand-rolled clipboard in the screen
  assert.equal(
    count(platform, 'navigator.clipboard'),
    0,
    'the screen must never touch the clipboard directly'
  );
});

test('unit327 · the no-match card names the hunt — the businesses room\'s own grammar', () => {
  // the branch sits between the zero-ledger state and the list
  assert.match(platform, /: filteredLogs\.length === 0 \? \(/);
  assert.match(platform, /title="No matches"/);
  assert.match(platform, /body=\{`No events match \$\{huntWords\}\. Try a verb, an actor or a business\.`\}/);
  // the list reads the FILTERED rows
  assert.match(platform, /\{filteredLogs\.map\(\(log\) => \(/);
});

test('unit327 · the doctrine stands — the siblings untouched, the grammar home still read', () => {
  // the businesses search keeps its own words
  assert.match(platform, /placeholder="Search name, slug, city"/);
  assert.match(platform, /aria-label="Search businesses by name, slug or city"/);
  // the dashboard's recent-activity slice is byte-still
  assert.match(platform, /const recentLogs = useMemo\(\(\) => \(logs \?\? \[\]\)\.slice\(0, 10\), \[logs\]\);/);
  // the ONE address law still rides the grammar home
  assert.match(platform, /platformTabFromPath,/);
  assert.match(platform, /platformPathForTab,/);
  // the audit room's skeleton and empty states are byte-still
  assert.match(platform, /<RowSkeletons rows=\{6\} \/>/);
  assert.match(platform, /title="No activity yet"/);
  assert.match(platform, /body="Platform actions will be recorded here as they happen\."/);
  // the count-asserted chip constants appear exactly once each
  assert.equal(count(platform, 'HUNT_CHIP_ACTIVE'), 3, 'one definition, two reads (ternary + import-free)');
  assert.equal(count(platform, 'HUNT_CHIP_IDLE'), 3, 'one definition, two reads');
});

test('unit327 · the version law — version.ts and sw.js carry the same word', () => {
  const v = version.match(/export const APP_VERSION = '([^']+)';/);
  const s = sw.match(/const VERSION = "servepoint-v([^-]+)-r(\d+)"/);
  assert.ok(v, 'version.ts must speak APP_VERSION');
  assert.ok(s, 'sw.js must bake the cache word');
  assert.equal(v[1], s[1], 'the two words must agree');
  assert.equal(v[1], '5.288.0');
});
