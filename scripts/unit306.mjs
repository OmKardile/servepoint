/* unit306 — v5.267.0 "the guest hears the blip" (agreement shape)
 * The census finding: the showcase promises the house is "ready when the
 * Wi-Fi blips" — and the wake family (5.261) made the DATA true (visibility
 * and network each refetch on return). But the blip ITSELF was silent on
 * the guest side: the guest on flaky café Wi-Fi kept reading a page that
 * looked alive while nothing moved — no word anywhere. The staff shell has
 * spoken its offline banner since 5.134 (PwaLayer's episode grammar); the
 * guest — the one person on the house's flakiest network — heard nothing.
 * THE LAWS PINNED HERE:
 *   1. the band exists: GuestNetBand in the guest module, self-contained;
 *   2. THE EPISODE GRAMMAR IS THE SHELL'S: a wasOffline ref, the 2.6s
 *      recovery whisper with cleanup, each episode announced once — the
 *      same shape PwaLayer speaks (one house, one grammar);
 *   3. THE BAND MOVES NO DATA: its effect bodies contain no fetch and no
 *      void load — the pages' own wakes keep their fetch jobs (one-path);
 *   4. THE CLEANUP IS PINNED: both listeners and the timer leave with the
 *      effects;
 *   5. THE WORDS ARE THE GUESTS': netOffline / netBack / netBandTitle exist
 *      in ALL THREE guest dictionaries (en / hi / kn — 9 keys, the census
 *      counts), and the band renders them through t() (the language
 *      switcher's word follows the band);
 *   6. BOTH GUEST SURFACES HEAR IT: GuestNetBand renders on the menu page
 *      and the track page — as each main's first child;
 *   7. THE FAMILY STANDS: the track's visibility+online wake and the
 *      menu's visibility wake are byte-kept (the band added a voice, never
 *      touched a data path);
 *   7b. ONE VOICE PER BLIP: the shell's PwaLayer — which spoke its English
 *      banner + whisper on EVERY surface since it mounted at the app root —
 *      yields on guest surfaces (mode !== 'guest' gates both voices); the
 *      guest's own three-language band speaks where the guest's language lives;
 *   8. the version law: APP_VERSION and sw.js's VERSION agree (read the
 *      live words, never pin a stale one). */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const guest = readFileSync('/home/z/my-project/src/components/guest/GuestPages.tsx', 'utf8');
const i18n = readFileSync('/home/z/my-project/src/lib/guest-i18n.ts', 'utf8');
const versionTs = readFileSync('/home/z/my-project/src/version.ts', 'utf8');
const swJs = readFileSync('/home/z/my-project/public/sw.js', 'utf8');

let passed = 0;
const check = (name, fn) => {
  fn();
  passed += 1;
  console.log(`  ok ${passed} — ${name}`);
};

/* ── 1. the band exists ──────────────────────────────────────────────── */
check('the band exists in the guest module, self-contained', () => {
  assert.ok(guest.includes('function GuestNetBand(): React.ReactElement | null'), 'GuestNetBand is defined');
  assert.ok(guest.match(/\/\* ═+\s*the guest hears the blip \(v5\.267\.0\)/), 'the founding word rides the definition');
});

/* ── 2. the episode grammar is the shell's ───────────────────────────── */
check('the episode grammar: wasOffline ref, 2.6s whisper, announced once', () => {
  const band = guest.match(/function GuestNetBand\(\)[\s\S]*?\n\}/);
  assert.ok(band, 'the band body found');
  assert.ok(band[0].includes('wasOffline.current = true'), 'falling offline arms the memory');
  assert.ok(band[0].includes('if (wasOffline.current) {') && band[0].includes('wasOffline.current = false;'), 'the episode announces ONCE');
  assert.ok(band[0].includes('setJustBack(true)'), 'the recovery whisper arms');
  assert.ok(band[0].includes('setJustBack(false), 2600'), '2.6s — the shell whisper duration');
  assert.ok(band[0].includes("window.addEventListener('offline', down)"), 'the offline ear exists');
  assert.ok(band[0].includes("window.addEventListener('online', up)"), 'the online ear exists');
});

/* ── 3. the band moves no data ───────────────────────────────────────── */
check('THE BAND MOVES NO DATA: no fetch, no load, in its effects', () => {
  const band = guest.match(/function GuestNetBand\(\)[\s\S]*?\n\}/)[0];
  assert.ok(!/\bfetch\b/.test(band), 'no fetch in the band body — words only');
  assert.ok(!/void load|void runTick|void refetch|verify\(/.test(band), 'no data path rides the band');
});

/* ── 4. the cleanup is pinned ────────────────────────────────────────── */
check('the cleanup is pinned: listeners and timer leave with the effects', () => {
  const band = guest.match(/function GuestNetBand\(\)[\s\S]*?\n\}/)[0];
  assert.ok(
    band.match(/window\.removeEventListener\('online', up\);\s*\n\s*window\.removeEventListener\('offline', down\);/),
    'both ears leave with the effect'
  );
  assert.ok(
    band.match(/const t2 = window\.setTimeout\(\(\) => setJustBack\(false\), 2600\);\s*\n\s*return \(\) => window\.clearTimeout\(t2\);/),
    'the whisper timer cleans up'
  );
});

/* ── 5. the words are the guests' — all three languages ──────────────── */
check('the words exist in en, hi and kn — 3 keys × 3 dicts', () => {
  for (const key of ['netOffline', 'netBack', 'netBandTitle']) {
    const hits = i18n.match(new RegExp(`^\\s*${key}: '`, 'gm')) ?? [];
    assert.equal(hits.length, 3, `${key} speaks in all three dictionaries`);
  }
  assert.ok(i18n.includes('the guest hears the blip (v5.267.0)'), 'the keys carry the round word');
});

/* ── 6. both guest surfaces hear it ──────────────────────────────────── */
check('the band renders on the menu page and the track page', () => {
  const renders = guest.match(/<GuestNetBand \/>/g) ?? [];
  assert.equal(renders.length, 2, 'exactly two render sites — menu + track');
  assert.ok(
    guest.match(/<main className="mx-auto w-full max-w-xl flex-1 px-4 pb-10 pt-5">\s*\n\s*<GuestNetBand \/>/),
    'the track page: first child of main'
  );
  assert.ok(
    guest.match(/<main className="mx-auto w-full max-w-xl flex-1 px-4 pb-36 pt-4">\s*\n\s*<GuestNetBand \/>/),
    'the menu page: first child of main'
  );
  assert.ok(guest.includes("role=\"status\""), 'role=status — the ears hear it');
  assert.ok(guest.includes("style={{ animation: 'spFadeIn 0.35s ease' }}"), 'the house fade (reduced-motion holds it)');
  assert.ok(guest.includes("{offline ? t('netOffline') : t('netBack')}"), 'the words render through t()');
});

/* ── 7. the family stands ────────────────────────────────────────────── */
check('the wakes keep their jobs: track tick + menu verify byte-kept', () => {
  assert.ok(
    guest.match(/document\.addEventListener\('visibilitychange', wake\);\s*\n\s*window\.addEventListener\('online', wake\);/),
    'the track wake still rides visibility + online'
  );
  assert.ok(
    guest.match(/document\.addEventListener\('visibilitychange', wake\);\s*\n\s*return \(\) => \{\s*\n\s*window\.clearInterval\(iv\);\s*\n\s*document\.removeEventListener\('visibilitychange', wake\);/),
    'the menu verify wake still rides visibility (its own cleanup)'
  );
  assert.ok(guest.includes('void runTick();'), 'the track tick keeps its fetch');
  assert.ok(guest.includes('verify();'), 'the menu verify keeps its read');
});

/* ── 7b. ONE VOICE PER BLIP ──────────────────────────────────────────── */
check('the shell yields on guest surfaces: one voice per blip', () => {
  const pwa = readFileSync('/home/z/my-project/src/components/shell/PwaLayer.tsx', 'utf8');
  assert.ok(
    pwa.includes("const showOffline = !online && !bannerGone && mode !== 'guest';"),
    'the shell banner holds its silence on guest surfaces'
  );
  assert.ok(
    pwa.includes("{online && justBack && mode !== 'guest' && ("),
    'the shell whisper holds its silence on guest surfaces'
  );
  assert.ok(!pwa.includes("mode === 'guest' ?"), 'the dead English guest text branch is gone');
  assert.ok(pwa.includes('one voice per blip'), 'the founding word rides the yield');
});

/* ── 8. the version law (agreement shape) ────────────────────────────── */
check('the version law: APP_VERSION and sw.js agree', () => {
  const v = versionTs.match(/APP_VERSION = '([^']+)'/)?.[1] ?? '';
  assert.ok(v.length > 0, 'APP_VERSION is present');
  assert.ok(swJs.includes(`const VERSION = "servepoint-v${v}-r1";`), `sw.js carries the same word (${v})`);
});

console.log(`\nunit306 — PASS ${passed}/${passed} (all checks green)`);
