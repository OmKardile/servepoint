/**
 * unit290 — v5.251.0 "the ending-soon word reaches the cart".
 *
 * The round's laws, pinned:
 *   1. ONE WARM THRESHOLD — WARM_WINDOW_MS lives in lib/appday beside
 *      formatWindowLeft (the window-arithmetic module); the page imports it;
 *      the ribbon no longer carries a private `180` (one window arithmetic,
 *      never two — for the BANDS as well as the clock).
 *   2. THE WARM VERDICT DERIVES ON THE PAGE — windowWarmMs (the narrowing
 *      carrier: msLeft inside the band, null outside) + windowWarm derive
 *      from the SAME msLeft the ribbon renders; the ribbon receives the
 *      verdicts and computes nothing (5.250.0's purity, completed).
 *   3. THE WARM WORD IN THE DRAWER — same straggler ink as the ended note
 *      (border-l-[#B45309] on bg-[#FBF6EA], one waiting language), the word
 *      in a role="status" span and the LIVE countdown OUTSIDE it — an
 *      aria-live region must never inherit a 1s ticker.
 *   4. THE FAB SPEAKS IT SOFTLY — the gold pulse dot (the stepper's energy,
 *      5.248's pager chip language) aria-hidden + the word in the
 *      aria-label; the money stays calm (teal), never a recolor.
 *   5. A WARM WINDOW IS NOT A LOCK — addLine and the customizer gate on
 *      windowEnded ONLY (byte-true); the warm note is the nudge, the
 *      server's checkout word stays the hard stop.
 *   6. THE THREE-LANGUAGE PROMISE — windowWarmNote + windowWarmFab in EN,
 *      HI and KN.
 *   7. THE VERSION LAW in the agreement shape.
 *
 * Run: bunx vite-node scripts/unit290.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

let n = 0;
const ok = (name) => console.log(`  ok ${++n} - ${name}`);
const strip = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');

const pages = strip('../src/components/guest/GuestPages.tsx');
const i18n = strip('../src/lib/guest-i18n.ts');
const appday = strip('../src/lib/appday.ts');
const versionTs = strip('../src/version.ts');
const swJs = strip('../public/sw.js');

/* 1 — one warm threshold; it lives in appday beside formatWindowLeft. */
{
  assert.ok(appday.includes('export const WARM_WINDOW_MS = 180_000;'), 'the band is ONE exported constant in appday (the window-arithmetic module)');
  assert.ok(appday.indexOf('WARM_WINDOW_MS') < appday.indexOf('export function formatWindowLeft'), 'the constant sits beside formatWindowLeft');
  assert.ok(pages.includes("import { appTimezone, formatWindowLeft, WARM_WINDOW_MS } from '../../lib/appday';"), 'the page imports the constant (no private copy)');
  const ribbonIdx = pages.indexOf('function SessionRibbon(');
  const ribbonBody = pages.slice(ribbonIdx, pages.indexOf('function DishPhoto('));
  assert.ok(!ribbonBody.includes('180'), 'the ribbon carries NO private threshold — the band rides the page\u0027s verdict');
  assert.ok(!ribbonBody.includes('totalSec'), 'the ribbon computes NOTHING — no internal totalSec, it renders what it is handed (5.250\u0027s purity, completed)');
  ok('one warm threshold: appday owns the number, the ribbon carries no copy');
}

/* 2 — the warm verdict derives on the page, from the SAME msLeft. */
{
  assert.ok(
    pages.includes('const windowWarmMs = msLeft !== null && msLeft > 0 && msLeft < WARM_WINDOW_MS ? msLeft : null;'),
    'windowWarmMs derives at the page (the narrowing carrier: msLeft in-band, null out)',
  );
  assert.ok(pages.includes('const windowWarm = windowWarmMs !== null;'), 'windowWarm is the boolean verdict over the carrier');
  const endedIdx = pages.indexOf('const windowEnded = msLeft !== null && msLeft <= 0;');
  const warmIdx = pages.indexOf('const windowWarmMs =');
  assert.ok(endedIdx > 0 && warmIdx > endedIdx, 'the warm band derives beside the ended band (one verdict family)');
  assert.ok(
    pages.includes('{sessionToken && <SessionRibbon session={sessionToken} msLeft={msLeft} ended={windowEnded} warm={windowWarm} />}'),
    'the ribbon receives the verdicts it renders (clock AND bands from the page)',
  );
  ok('the warm verdict derives on the page, same msLeft, one arithmetic');
}

/* 3 — the drawer's warm note: the straggler ink, the word inside role=status,
 *     the live countdown OUTSIDE it. */
{
  const noteIdx = pages.indexOf('{windowWarmMs !== null && (');
  assert.ok(noteIdx > 0, 'the warm note exists in the drawer');
  const noteBody = pages.slice(noteIdx, pages.indexOf('{windowEnded && (', noteIdx));
  assert.ok(noteBody.includes('border-l-[#B45309]'), 'the warm note wears the straggler ink\u0027s left edge (one waiting language)');
  assert.ok(noteBody.includes('bg-[#FBF6EA]'), 'the warm note wears the straggler ink\u0027s floor');
  assert.ok(noteBody.includes('text-[#8A5A00]'), 'the warm note wears the straggler ink\u0027s words');
  assert.ok(noteBody.includes("<span role=\"status\">{t('windowWarmNote')}</span>"), 'the WORD is the role=status span (announced once on arrival)');
  const statusIdx = noteBody.indexOf('role="status"');
  const clockIdx = noteBody.indexOf('formatWindowLeft(windowWarmMs)');
  assert.ok(clockIdx > statusIdx, 'the LIVE countdown sits OUTSIDE the role=status span — an aria-live region never inherits a 1s ticker');
  assert.ok(!noteBody.slice(0, noteBody.indexOf('</span>')).includes('formatWindowLeft'), 'the word span carries no clock');
  assert.ok(noteIdx < pages.indexOf('{windowEnded && (\n                  <p role="status"'), 'the warm note stands BEFORE the ended note (the handoff reads top-down: closing soon → ended)');
  ok('the drawer\u0027s warm note: straggler ink, announced word, silent clock');
}

/* 4 — the FAB speaks it softly: dot + aria word, money stays calm. */
{
  const fabIdx = pages.indexOf("{windowWarm && (\n                <span\n                  aria-hidden\n                  className=\"h-1.5 w-1.5 animate-pulse rounded-full\"\n                  style={{ background: brand.gold }}\n                />\n              )}");
  assert.ok(fabIdx > 0, 'the gold pulse dot rides the FAB, aria-hidden (the stepper\u0027s energy, 5.248\u0027s chip language)');
  assert.ok(pages.includes("${windowWarm ? `, ${t('windowWarmFab')}` : ''}"), 'the FAB\u0027s aria-label speaks the warm word');
  const fabBtnIdx = pages.indexOf('onClick={() => setDrawerOpen(true)}');
  const fabSlice = pages.slice(fabBtnIdx, fabBtnIdx + 2000);
  assert.ok(fabSlice.includes("style={{ background: brand.teal, height: 52 }}"), 'the FAB\u0027s money voice stays calm — teal, never a warm recolor');
  ok('the FAB: a dot and a word, the price never shouts');
}

/* 5 — a warm window is NOT a lock: the gates stay byte-true on windowEnded. */
{
  assert.ok(
    pages.includes("if (phase !== 'ready' || windowEnded) return; // locked windows accept nothing (v5.24.0); dead windows neither (5.250.0)"),
    'addLine gates on windowEnded ONLY — a warm window accepts orders (the nudge, not a lock)',
  );
  const lockIdx = pages.indexOf('locked={phase !== \u0027ready\u0027 || windowEnded}');
  assert.ok(lockIdx > 0, 'the customizer\u0027s lock byte-true on windowEnded');
  const lockSlice = pages.slice(lockIdx, lockIdx + 80);
  assert.ok(!lockSlice.includes('windowWarm'), 'warm appears in NO lock verdict — the server\u0027s checkout word stays the only hard stop');
  ok('warm is a nudge, never a lock: the gates stay byte-true');
}

/* 6 — the three-language promise. */
{
  for (const key of ['windowWarmNote', 'windowWarmFab']) {
    const en = i18n.includes(`  ${key}: '`);
    const hi = i18n.includes(`  ${key}: '`) && (i18n.match(new RegExp(`${key}:`, 'g')) || []).length >= 3;
    assert.ok(en && hi, `${key} speaks in EN, HI and KN (three dictionaries)`);
  }
  assert.ok(i18n.includes("windowWarmNote: 'The ordering window closes soon — place your order while it is open. Your cart is kept.'"), 'the EN word promises what sessionStorage makes true (the cart is kept)');
  ok('three languages carry the warm word');
}

/* 7 — the version law, the agreement shape. */
{
  assert.ok(versionTs.includes("export const APP_VERSION = '5.251.0';"), 'APP_VERSION is 5.251.0');
  assert.ok(swJs.includes('const VERSION = "servepoint-v5.251.0-r1";'), 'the SW cache name is servepoint-v5.251.0-r1 (old shells re-fetch)');
  ok('the version law holds: 5.251.0 / servepoint-v5.251.0-r1');
}

console.log(`\nunit290 — ${n} checks, all green.`);
