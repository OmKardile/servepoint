/* Task 233 — v5.194.0 unit suite: the settings remember the book.
 * 5.193.0 amended the camping clock to TWO provable sources (the round's
 * placed-at; the book's seated stamp), but the Floor & service section
 * still preached "provable tickets only" — a stale doctrine lie the walk
 * caught this round. The copy now speaks the amended doctrine as ONE
 * exported sentence (CLOCK_LEDGER_WORDS) the suite owns. And the
 * new-version card (v5.144.0) finally names WHICH release is waiting:
 * sw.js registers at a FIXED url with updateViaCache: 'none', so while a
 * worker waits, the bytes at /sw.js are the waiting worker's own —
 * parseSwVersion reads the VERSION literal out of those bytes and
 * updateCardBody speaks the body line; null keeps the v5.144 words
 * byte-identical (absent-field doctrine — never an unverified version).
 * Asserted: parseSwVersion on the REAL public/sw.js bytes (release
 * shape + non-null); a known-bytes fixture parses exact; the silences
 * (garbage, empty, single-quoted, unterminated, no-const → null);
 * updateCardBody(null) byte-identical to the v5.144 words; the version
 * path names the release and keeps the quiet words; CLOCK_LEDGER_WORDS
 * carries "two provable ledgers", "placed-at", "seated stamp", and
 * ends on "neither, silence."; THE ROUND GUARD — "provable tickets
 * only" absent from SettingsScreen's LIVE copy (comment lines stripped:
 * a docstring may quote the lie it amends, a literal may not); the
 * card's JSX wires updateCardBody(waitingVersion).
 * Run: bunx vite-node scripts/unit233.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const pwa = await import('/src/components/shell/PwaLayer.tsx');
const { parseSwVersion, updateCardBody } = pwa;
const settingsM = await import('/src/components/settings/SettingsScreen.tsx');
const { CLOCK_LEDGER_WORDS } = settingsM;

let n = 0;
const ok = (name) => console.log(`  ok ${++n} - ${name}`);

/* 1 — the extractor reads the REAL bytes on disk: the file the browser
 *     itself parses to install the waiting worker. */
const swText = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');
const realV = parseSwVersion(swText);
assert.ok(realV, 'parseSwVersion must read the real sw.js bytes');
assert.match(realV, /^servepoint-v\d+\.\d+\.\d+-r\d+$/, 'the real bytes parse to a release name');
ok('parseSwVersion reads the real public/sw.js bytes → ' + realV);

/* 2 — a known-bytes fixture parses exact. */
assert.equal(
  parseSwVersion('const VERSION = "servepoint-v9.9.9-r3";\nconst SHELL_CACHE = `${VERSION}-shell`;'),
  'servepoint-v9.9.9-r3',
);
ok('a known-bytes fixture parses exact');

/* 3 — the silences: garbage, empty, single-quoted, unterminated,
 *     no-const. Null, never an invented version. */
assert.equal(parseSwVersion(''), null);
assert.equal(parseSwVersion('nothing here at all'), null);
assert.equal(parseSwVersion("const VERSION = 'servepoint-v1.0.0-r1';"), null);
assert.equal(parseSwVersion('const VERSION = "servepoint-v1.0.0-r1;'), null);
assert.equal(parseSwVersion('const CACHE = "servepoint-v1.0.0-r1";'), null);
ok('the silences — garbage/empty/single-quoted/unterminated/no-const → null');

/* 4 — updateCardBody(null): the v5.144 words byte-identical. The card
 *     never claims an unverified version. */
assert.equal(
  updateCardBody(null),
  'A newer ServePoint is ready — refresh when the counter is quiet; nothing will be lost.',
);
ok('updateCardBody(null) keeps the v5.144 words byte-identical');

/* 5 — the version path names the release and keeps the quiet words. */
const body = updateCardBody('servepoint-v5.194.0-r1');
assert.ok(body.includes('servepoint-v5.194.0-r1'), 'the body names the waiting release');
assert.ok(
  body.includes('refresh when the counter is quiet; nothing will be lost.'),
  'the body keeps the quiet words',
);
ok('updateCardBody(version) names the release, keeps the quiet words');

/* 6 — the settings' ledger sentence carries the amended doctrine. */
assert.ok(CLOCK_LEDGER_WORDS.includes('two provable ledgers'));
assert.ok(CLOCK_LEDGER_WORDS.includes("placed-at"));
assert.ok(CLOCK_LEDGER_WORDS.includes('seated stamp'));
assert.ok(CLOCK_LEDGER_WORDS.endsWith('neither, silence.'));
ok('CLOCK_LEDGER_WORDS speaks the two-ledger doctrine, ends on silence');

/* 7 — THE ROUND GUARD: the old lie is gone from the settings' LIVE copy.
 *     Comment lines are stripped first — a docstring may QUOTE the lie
 *     it amends (history-telling is doctrine), but no rendered literal
 *     may speak it. */
const settingsSrc = readFileSync(
  new URL('../src/components/settings/SettingsScreen.tsx', import.meta.url),
  'utf8',
);
const liveCopy = settingsSrc
  .split('\n')
  .filter((l) => !/^\s*(\*|\/\*|\/\/)/.test(l))
  .join('\n');
assert.ok(
  !liveCopy.includes('provable tickets only'),
  'the stale one-ledger lie must be gone from SettingsScreen live copy',
);
assert.ok(
  !CLOCK_LEDGER_WORDS.includes('provable tickets only'),
  'the live ledger sentence itself must not speak the old lie',
);
ok('the round guard — "provable tickets only" absent from live copy (comments may quote history)');

/* 8 — the card's JSX wires the tested words (no orphaned copy). */
const pwaSrc = readFileSync(
  new URL('../src/components/shell/PwaLayer.tsx', import.meta.url),
  'utf8',
);
assert.ok(pwaSrc.includes('{updateCardBody(waitingVersion)}'));
ok("the card's JSX calls updateCardBody(waitingVersion)");

console.log(`\nunit233: ${n} asserts — the settings remember the book, the card names its version.`);
