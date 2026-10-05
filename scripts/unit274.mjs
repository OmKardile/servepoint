/* Task 274 — v5.235.0 unit suite: the address follows you.
 *
 * The Task 274 walk (the POS revenue path — Food & Drinks → cart bar →
 * drawer — healthy; the 5.233 offer voice correct at ₹22.00 on ₹220)
 * turned to the parked list and took the oldest UX debt: URL write-back.
 * Since 5.32.0 the app READS deep links (/bills boots into Bills) but
 * never WROTE them back — in-app navigation kept the URL stale, so a
 * mid-shift refresh landed the operator back on Dashboard and the
 * address lied about where you were.
 *
 * v5.235.0: the write-back rides the navigation act ITSELF — goSection
 * in store/session claims the address (replaceState: the address tells
 * where you ARE; no history pile, no popstate choreography, the POS's
 * Back keeps its device-level meaning) — so a mid-shift refresh lands
 * the operator where they were (the v5.32.0 deep-link reader restores
 * the room on boot). Being an ACTION, not an effect, goSection is
 * immune to StrictMode's effect echo — the shell-effect design tried
 * first this round double-fired under StrictMode and wrote /dashboard
 * at a plain boot; the E2E caught it, the design moved. Honest skips,
 * all structural: a plain boot calls no goSection at all, so the bare
 * root keeps its throne ("/") until a choice names a room; a path that
 * already names the running room keeps its own word (a spoken alias
 * /close-out, a pinned-wall /cafe/bills — v5.93's law). The slug rules
 * AND the segment→section derivation live in lib/sectionPath.ts as ONE
 * home — the 404 door, the boot deep-link and the write-back all ask
 * the same closure (5.196: one grammar, never a fork); the guest
 * capability-token splits are a different grammar and stay. And the
 * shell gains the version voice: the sidebar footer speaks the build
 * word from src/version.ts — the ONE word the service worker bakes too
 * (unit274 pins the two files agree, so a forgotten bump fails the gate).
 *
 * Asserted: the path grammar BY BEHAVIOR (plain id; two-segment
 * pinned-wall form reads the second segment; spoken alias; bare root
 * names nothing; unknown names nothing; trailing slash; empty string);
 * the ONE-derivation law (App.tsx calls it at exactly TWO sites — 404
 * door + boot deep-link; the inline fork is EXTINCT; the writer lives
 * in session.ts's goSection with its already-named skip and canonical
 * replaceState; pushState/popstate ABSENT everywhere); the SECTION_IDS
 * drift guard (every Section union member in session.ts appears in the
 * lib's list — a new section that skips the array fails the gate, not
 * the deep link); the version one-word law (version.ts ===
 * public/sw.js, each the only occurrence); the sidebar's build word
 * rendered exactly once.
 * Run: bunx vite-node scripts/unit274.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sectionFromPath, SECTION_SLUGS, SECTION_IDS } from '/src/lib/sectionPath.ts';
import { APP_VERSION } from '/src/version.ts';

let n = 0;
const ok = (name) => console.log(`  ok ${++n} - ${name}`);
const strip = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const appSrc = strip('../src/App.tsx');
const sessionSrc = strip('../src/store/session.ts');
const libSrc = strip('../src/lib/sectionPath.ts');
const sidebarSrc = strip('../src/components/shell/Sidebar.tsx');
const swSrc = strip('../public/sw.js');

/* ── 1–7: the path grammar, by behavior (synthetic slugs) ── */

const slugs = {
  bills: 'bills',
  eod: 'eod',
  customers: 'customers',
  'close-out': 'eod',
  guests: 'customers',
};

assert.equal(sectionFromPath(slugs, '/bills'), 'bills');
ok("plain id: '/bills' → bills");

assert.equal(sectionFromPath(slugs, '/cafe/bills'), 'bills');
ok("pinned-wall form: '/cafe/bills' → bills (second segment wins)");

assert.equal(sectionFromPath(slugs, '/close-out'), 'eod');
assert.equal(sectionFromPath(slugs, '/guests'), 'customers');
ok("spoken aliases: '/close-out' → eod, '/guests' → customers");

assert.equal(sectionFromPath(slugs, '/'), undefined);
ok("bare root names nothing: '/' → undefined");

assert.equal(sectionFromPath(slugs, '/xyz'), undefined);
ok("unknown word names nothing: '/xyz' → undefined");

assert.equal(sectionFromPath(slugs, '/bills/'), 'bills');
ok("trailing slash harmless: '/bills/' → bills");

assert.equal(sectionFromPath(slugs, ''), undefined);
ok('empty string names nothing');

/* ── 8: the real slug record carries the aliases ── */

assert.equal(SECTION_SLUGS['close-out'], 'eod');
assert.equal(SECTION_SLUGS['guests'], 'customers');
assert.equal(SECTION_SLUGS['bills'], 'bills');
assert.equal(SECTION_SLUGS['dashboard'], 'dashboard');
ok('the shipped SECTION_SLUGS resolves plain ids and spoken aliases alike');

/* ── 9–11: the ONE-derivation law ── */

assert.ok(
  appSrc.includes("import { SECTION_SLUGS, sectionFromPath } from './lib/sectionPath';"),
  'App imports the one path grammar'
);
assert.equal(
  appSrc.includes('.length >= 2 ? parts[1] : parts[0]'),
  false,
  'the inline segment-derivation fork is extinct'
);
assert.equal(
  appSrc.includes('.length >= 2 ? dlParts[1] : dlParts[0]'),
  false,
  "the 404 door\u2019s old inline fork is extinct too"
);
ok('ONE derivation: no inline fork may remain in App.tsx');

/* App.tsx: exactly two readers — the 404 door and the boot deep-link. */
const appSites = appSrc.split('sectionFromPath(SECTION_SLUGS').length - 1;
assert.equal(appSites, 2, `door + boot only, found ${appSites}`);
assert.ok(appSrc.includes('sectionFromPath(SECTION_SLUGS, window.location.pathname)'));
assert.ok(appSrc.includes('sectionFromPath(SECTION_SLUGS, pathname) !== undefined'));
ok('two readers in App.tsx: the 404 door, the boot deep-link');

/* The writer lives in goSection (the navigation act) — session.ts. */
assert.ok(sessionSrc.includes("import { SECTION_SLUGS, sectionFromPath } from '../lib/sectionPath';"));
assert.ok(sessionSrc.includes('sectionFromPath(SECTION_SLUGS, path) !== section'));
assert.ok(sessionSrc.includes("history.replaceState(null, '', `/${section}`)"));
ok('the write-back rides goSection itself — the navigation act claims the address');

/* No history pile, no back-button choreography — anywhere. The absence
 * pins read CALL SHAPES, not bare words (5.272: prose says "popstate"). */
assert.equal(appSrc.includes('history.pushState('), false);
assert.equal(appSrc.includes("addEventListener('popstate'"), false);
assert.equal(sessionSrc.includes('history.pushState('), false);
assert.equal(sessionSrc.includes("addEventListener('popstate'"), false);
ok('replaceState only: no history pile, no popstate — in App or the store');

/* The boot's address is honored structurally: the shell's title effect
 * carries NO writer (a plain boot never rewrites the address), and the
 * writer sits in the action, where StrictMode's echo cannot reach. */
const titleEffect = appSrc.slice(
  appSrc.indexOf('document.title = `${SECTION_LABELS[section]'),
  appSrc.indexOf('}, [section]);')
);
assert.ok(titleEffect.includes('document.title'));
assert.equal(titleEffect.includes('history.replaceState'), false);
assert.ok(sessionSrc.includes('goSection: (section, breadcrumb, hint) => {'));
ok('two clocks, two honest jobs: the title rides state, the address rides the choice');

/* The already-named skip keeps the human's word (alias / two-segment). */
assert.ok(sessionSrc.includes('if (sectionFromPath(SECTION_SLUGS, path) !== section) {'));
ok('already-named skip: a spoken alias or pinned-wall path keeps its own word');

/* ── 12: the SECTION_IDS drift guard ── */

/* Every member of the Section union in session.ts must appear in the
 * lib's SECTION_IDS — a new section that skips the array would silently
 * lose its deep link AND its write-back; here it fails the gate. */
const unionBlock = sessionSrc.slice(
  sessionSrc.indexOf('export type Section ='),
  sessionSrc.indexOf('interface UiState')
);
const unionMembers = [...unionBlock.matchAll(/'([a-z-]+)'/g)].map((m) => m[1]);
assert.ok(unionMembers.length >= 14, `the union should name 14 sections, found ${unionMembers.length}`);
for (const member of unionMembers) {
  assert.ok(
    SECTION_IDS.includes(member),
    `Section '${member}' is missing from SECTION_IDS — deep link + write-back would miss it`
  );
}
ok(`drift guard: all ${unionMembers.length} Section union members ride SECTION_IDS`);

/* The aliases keep their home in the lib; App.tsx carries no slug literals. */
assert.ok(libSrc.includes("['close-out', 'eod']"));
assert.ok(libSrc.includes("['guests', 'customers']"));
assert.equal(appSrc.includes("['close-out', 'eod']"), false);
ok('slug rules live in the lib — the spoken aliases keep one home');

/* ── 13–16: the version voice — one word, every surface ── */

assert.ok(APP_VERSION.length > 0);
assert.ok(
  swSrc.includes(`servepoint-v${APP_VERSION}-r1`),
  'the service worker bakes the SAME word version.ts speaks'
);
ok(`one word: version.ts and sw.js agree on ${APP_VERSION}`);

const swHits = swSrc.split('servepoint-v').length - 1;
assert.equal(swHits, 1, `sw.js bakes the word once, found ${swHits}`);
const tsHits = strip('../src/version.ts').split("APP_VERSION = '").length - 1;
assert.equal(tsHits, 1, `version.ts declares the word once, found ${tsHits}`);
ok('the bump is one line in each file — no second copy to drift');

assert.ok(sidebarSrc.includes("import { APP_VERSION } from '../../version';"));
const vHits = sidebarSrc.split('v{APP_VERSION}').length - 1;
assert.equal(vHits, 1, `sidebar renders the word once, found ${vHits}`);
ok('sidebar version voice: the rail answers "which build?" once');

assert.ok(sidebarSrc.includes('Build servepoint-v${APP_VERSION}-r1'));
ok("the title carries the full build name ('Build servepoint-v…-r1')");

console.log(`\nunit274 — ${n} checks green`);
