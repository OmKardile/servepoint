/**
 * unit288 — v5.249.0 "the guest surfaces speak their own silence".
 *
 * The round's laws, pinned:
 *   1. THE MENU'S DEAD END IS EXTINCT — the menu's error card carries the
 *      Try again the network's own message always asked for ("Check your
 *      connection and try again" — with no way to): the load chain is ONE
 *      runnable (the effect calls it, the card calls it again), and the
 *      busy word rides the card while the chain re-runs.
 *   2. THE BUSY VOICE IS SHARED — GuestErrorCard's retry button wears
 *      disabled + aria-busy + the spinning loader while busy: a guest who
 *      taps twice never fires two chains, and the gate's session retry
 *      speaks the same card language (one card, one voice).
 *   3. THE PAGER SPEAKS ITS SILENCE — the poll's failure with a ticket on
 *      the page used to freeze the word without a word: the net chip
 *      (role="status", announced) rides the header glass (the 287 pill's
 *      family) with the gold pulse (the stepper's own "still trying"
 *      energy), in the guest's three languages. The next successful tick
 *      removes it — the loop never stopped (the auto-recovery law).
 *   4. THE SESSION-SURVIVAL LAWS UNTOUCHED — the heartbeat's fail-soft
 *      (a network hiccup never locks a paying guest, 5.24) and the tick's
 *      finally-loop stay byte-true; this round adds words, not behavior,
 *      to the recovery machinery.
 *   5. THE VERSION LAW in the agreement shape.
 *
 * Run: bunx vite-node scripts/unit288.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

let n = 0;
const ok = (name) => console.log(`  ok ${++n} - ${name}`);
const strip = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');

const pages = strip('../src/components/guest/GuestPages.tsx');
const i18n = strip('../src/lib/guest-i18n.ts');
const guestLib = strip('../src/lib/guest.ts');
const versionTs = strip('../src/version.ts');
const swJs = strip('../public/sw.js');

/* 1 — the menu's dead end is extinct. */
{
  assert.ok(
    pages.includes('<GuestErrorCard title={t(\'menuUnavailable\')} body={errorBody} busy={loadBusy} onRetry={() => run()} />'),
    'the menu error card carries Try again (busy + onRetry)',
  );
  const runIdx = pages.indexOf('const run = useCallback((): (() => void) => {');
  assert.ok(runIdx > 0, 'the load chain lives in ONE runnable');
  const runSlice = pages.slice(runIdx, pages.indexOf('}, [qrToken, t]);', runIdx));
  assert.ok(runSlice.includes('resolveTableQr'), 'the chain keeps its first read');
  assert.ok(runSlice.includes('openTableSession'), 'the chain keeps the session open');
  assert.ok(runSlice.includes('fetchPublicMenu'), 'the chain keeps the menu read');
  assert.ok(runSlice.includes('finally {'), 'the busy word clears on EVERY exit (try/finally)');
  assert.ok(runSlice.includes('if (alive) setLoadBusy(false);'), 'the unmount guard survives');
  assert.ok(pages.includes('useEffect(() => run(), [run]);'), 'the effect rides the runnable');
  ok('the menu dead end is extinct: one runnable, the card calls it again, busy on every exit');
}

/* 2 — the busy voice is shared. */
{
  assert.ok(pages.includes('function GuestErrorCard({ title, body, onRetry, busy = false }'),
    'the card grows the busy prop');
  const cardIdx = pages.indexOf('function GuestErrorCard(');
  const cardSlice = pages.slice(cardIdx, pages.indexOf('/* ═', cardIdx));
  assert.ok(cardSlice.includes('disabled={busy}'), 'a busy retry cannot double-fire');
  assert.ok(cardSlice.includes('aria-busy={busy || undefined}'), 'aria-busy names it to the reader');
  assert.ok(cardSlice.includes('<Loader2 size={15} className="animate-spin" aria-hidden />'),
    'the loader swaps for the arrow while busy');
  assert.ok(cardSlice.includes('disabled:opacity-60'), 'the disabled breath is visible');
  assert.ok(pages.includes('busy={busy} onRetry={() => void run()} />'),
    'the gate\'s session retry speaks the same card language');
  ok('the busy voice is shared: one card, one language, menu and gate both');
}

/* 3 — the pager speaks its silence. */
{
  const chipIdx = pages.indexOf("{order && state === 'net' && (");
  assert.ok(chipIdx > 0, 'the net chip exists behind the stale gate');
  const chipSlice = pages.slice(chipIdx, pages.indexOf('</p>', chipIdx));
  assert.ok(chipSlice.includes('role="status"'), 'the word is announced (role=status)');
  assert.ok(chipSlice.includes('<CloudOff size={11} aria-hidden />'), 'the icon is aria-hidden');
  assert.ok(chipSlice.includes("style={{ background: brand.gold }}"), 'the gold pulse (the stepper\'s trying energy)');
  assert.ok(chipSlice.includes('bg-white/10'), 'the chip wears the 287 pill\'s glass — one header language');
  assert.ok(chipSlice.includes("t('netStale')"), 'the word rides the dictionary, never inline English');
  // the tick loop's auto-recovery stays byte-true — the loop lives in the
  // pager's effect (tick's slice ends at its own deps; the loop is the
  // effect's), so the pin reads the effect region:
  const tickIdx = pages.indexOf('const tick = useCallback(async () => {');
  const tickSlice = pages.slice(tickIdx, pages.indexOf('}, [orderId, muted, t]);', tickIdx));
  assert.ok(tickSlice.includes("res.error === 'NETWORK' ? 'net' : 'bad'"), 'the network verdict is unchanged');
  const loopIdx = pages.indexOf('const loop = () => {', tickIdx);
  assert.ok(loopIdx > tickIdx, 'the recovery loop exists');
  const loopSlice = pages.slice(loopIdx, pages.indexOf('}, [tick, uuidLike]);', loopIdx));
  assert.ok(/\.finally\(\(\) => \{[\s\S]*?window\.setTimeout\(loop, 10000\)/.test(loopSlice),
    'the loop continues through failures (auto-recovery)');
  ok('the pager speaks its silence: announced chip, glass family, the loop never stopped');
}

/* 4 — the session-survival laws untouched. */
{
  assert.ok(
    guestLib.includes("if (error) return { ok: true, reason: 'network' }; // fail-soft: retry on the next tick"),
    'the heartbeat\'s fail-soft stays byte-true (a network hiccup never locks a paying guest)',
  );
  assert.ok(
    pages.includes('if (!r.ok) lockGuest(r.reason || \'unknown\');'),
    'the lock verdict still only fires on the server\'s own no',
  );
  const keys = ['netStale'];
  for (const key of keys) {
    const hits = i18n.split(`  ${key}:`).length - 1;
    assert.equal(hits, 3, `${key} lives in EN, HI and KN (found ${hits})`);
  }
  assert.ok(i18n.includes("netStale: 'Connection lost — this is the last word'"), 'EN voice');
  assert.ok(i18n.includes("netStale: 'कनेक्शन टूट गया — यह आख़िरी जानकारी है'"), 'HI voice');
  assert.ok(i18n.includes("netStale: 'ಸಂಪರ್ಕ ಕಡಿತವಾಗಿದೆ — ಇದು ಕೊನೆಯ ಮಾಹಿತಿ'"), 'KN voice');
  ok('the session-survival laws untouched + the word in three voices');
}

/* 5 — the version law, in the agreement shape. */
{
  const v = versionTs.match(/APP_VERSION = '([\d.]+)'/)?.[1];
  const sw = swJs.match(/const VERSION = "servepoint-v([\d.]+)-r1"/)?.[1];
  assert.ok(v && sw, 'both sides carry a version');
  assert.equal(v, sw, 'version.ts and sw.js speak the SAME version');
  ok(`the version law: ${v} on both sides`);
}

console.log(`\nunit288 — ${n} checks green.`);
