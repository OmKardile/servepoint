/**
 * unit289 — v5.250.0 "the window's word reaches the cart".
 *
 * The round's laws, pinned:
 *   1. ONE WINDOW ARITHMETIC — windowLeft stays byte-true (the 5.216/5.218
 *      law: one arithmetic, never two), the ONE 1s tick lives on the PAGE,
 *      and the ribbon is a pure renderer (no internal interval, no internal
 *      clock) — it renders the msLeft it is handed.
 *   2. THE ORDERING MACHINERY SPEAKS THE WINDOW — before this round the
 *      ribbon went grey at zero while every button below kept ordering and
 *      the guest's first word came from the SERVER'S rejection at checkout
 *      (a full cart journey into a rescan dead end). Now: windowEnded
 *      derives at the page, addLine gates on it, the customizer's lock
 *      wears the window's own word (a dead clock is a different cause from
 *      a staff cut — different words, honest ones), and the drawer's place
 *      button is disabled with the word inside.
 *   3. THE AMBER NOTE IN THE DRAWER — the straggler ink (the ledger's
 *      off-stage waiting language, 5.242/5.243) says "your cart is kept —
 *      rescan to order again" with role="status": the appearance AND the
 *      recovery are announced.
 *   4. THE RE-ARM WITHIN ONE TICK — the server anchor (the 30s re-verify)
 *      feeds the SAME msLeft: a drifted phone clock self-heals, the buttons
 *      re-arm, the word leaves. The heartbeat's fail-soft and the lock
 *      verdict stay byte-true.
 *   5. THE THREE-LANGUAGE PROMISE — windowEndedCta + windowEndedNote in
 *      EN, HI and KN.
 *   6. THE VERSION LAW in the agreement shape.
 *
 * Run: bunx vite-node scripts/unit289.mjs
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

/* 1 — one window arithmetic; the page owns the tick; the ribbon renders. */
{
  const winIdx = pages.indexOf('function windowLeft(');
  const winSlice = pages.slice(winIdx, pages.indexOf('}', pages.indexOf('return new Date(session.expires_at)', winIdx)) + 1);
  assert.ok(winSlice.includes('if (serverRemaining) {'), 'windowLeft keeps the server-preferred branch');
  assert.ok(winSlice.includes("return new Date(session.expires_at).getTime() - Date.now();"), 'windowLeft keeps the raw-clock fallback');
  const ribbonIdx = pages.indexOf('function SessionRibbon(');
  const ribbonSlice = pages.slice(ribbonIdx, pages.indexOf('/**', ribbonIdx + 10) > 0 ? pages.indexOf('function Customizer(') : undefined);
  assert.ok(!ribbonSlice.includes('setInterval'), 'the ribbon runs NO interval of its own (the page owns the ONE tick)');
  assert.ok(ribbonSlice.includes('msLeft: number | null;'), 'the ribbon is a pure renderer: it takes msLeft');
  const tickIdx = pages.indexOf("const t1 = window.setInterval(() => setMsLeft(windowLeft(sessionToken, serverAnchor)), 1000);");
  assert.ok(tickIdx > 0, 'the page owns the ONE 1s tick');
  const depsIdx = pages.indexOf('[phase, sessionToken, serverAnchor]', tickIdx);
  assert.ok(depsIdx > 0 && depsIdx - tickIdx < 300, 'the tick re-derives on a fresh server anchor (the re-arm path)');
  assert.ok(pages.includes('{sessionToken && <SessionRibbon session={sessionToken} msLeft={msLeft} ended={windowEnded} warm={windowWarm} />}'), 'the ribbon renders the page\u2019s number (5.251.0 honest re-anchor: the bands ride the same call)');
  ok('one window arithmetic: the page ticks, the ribbon renders');
}

/* 2 — the ordering machinery speaks the window. */
{
  assert.ok(pages.includes('const windowEnded = msLeft !== null && msLeft <= 0;'), 'windowEnded derives at the page');
  assert.ok(
    pages.includes("if (phase !== 'ready' || windowEnded) return; // locked windows accept nothing (v5.24.0); dead windows neither (5.250.0)"),
    'addLine gates on the dead window (belt under the buttons)',
  );
  assert.ok(pages.includes('[phase, windowEnded],'), 'addLine\u2019s deps speak the window too');
  assert.ok(
    pages.includes("locked={phase !== 'ready' || windowEnded} lockedLabel={windowEnded ? t('windowEndedCta') : undefined}"),
    'the customizer\u2019s lock wears the window\u2019s word (a dead clock \u2260 a staff cut)',
  );
  assert.ok(pages.includes("locked ? (lockedLabel ?? t('orderingPaused')) : t('addToOrder'"), 'the customizer button keeps the staff-cut word for staff cuts');
  assert.ok(pages.includes('disabled={placing || windowEnded}'), 'the drawer\u2019s place button is disabled on the dead window');
  assert.ok(
    pages.includes("{placing ? t('sending') : windowEnded ? t('windowEndedCta') : t('placeOrder', { amt: money(cartTotal) })}"),
    'the drawer\u2019s button speaks the window\u2019s word inside the label',
  );
  ok('the ordering machinery speaks the window: grid, customizer, drawer');
}

/* 3 — the amber note in the drawer, the straggler ink, announced. */
{
  const noteIdx = pages.indexOf('{windowEnded && (');
  assert.ok(noteIdx > 0, 'the drawer\u2019s amber note exists');
  const noteSlice = pages.slice(noteIdx, pages.indexOf('</p>', noteIdx));
  assert.ok(noteSlice.includes('role="status"'), 'the note is announced (appearance AND recovery)');
  assert.ok(noteSlice.includes("border-l-[#B45309]"), 'the straggler ink on the left edge (the ledger\u2019s waiting language)');
  assert.ok(noteSlice.includes("bg-[#FBF6EA]"), 'the amber floor');
  assert.ok(noteSlice.includes("t('windowEndedNote')"), 'the note speaks the kept-cart promise');
  ok('the amber note: the cart is kept, the rescan is the way back');
}

/* 4 — the re-arm path + the survival laws byte-true. */
{
  assert.ok(
    pages.includes('if (r.ok && typeof r.remainingSeconds === \'number\') {'),
    'only a finite server number re-anchors (silence is never zero)',
  );
  assert.ok(pages.includes("if (!r.ok) lockGuest(r.reason || 'unknown');"), 'the lock verdict still only fires on the server\u2019s own no');
  assert.ok(
    guestLib.includes("if (error) return { ok: true, reason: 'network' }; // fail-soft: retry on the next tick"),
    'the heartbeat\u2019s fail-soft stays byte-true (a network hiccup never locks a paying guest)',
  );
  // 5.261.0's honest re-anchor: the verify is named now (the wake rides it
  // too) — the rider moved, the 30s cadence law stands.
  assert.ok(pages.includes('window.setInterval(verify, 30000);'), 'the 30s re-verify keeps its cadence');
  ok('the re-arm path rides the server anchor; the survival laws untouched');
}

/* 5 — the three-language promise. */
{
  for (const key of ['windowEndedCta', 'windowEndedNote']) {
    const hits = i18n.split(`  ${key}:`).length - 1;
    assert.equal(hits, 3, `${key} lives in EN, HI and KN (found ${hits})`);
  }
  assert.ok(i18n.includes("windowEndedNote: 'The ordering window has ended — your cart is kept. Rescan the table QR to order again.'"), 'EN voice');
  assert.ok(i18n.includes("windowEndedNote: 'ऑर्डरिंग की अवधि समाप्त हो गई है — आपकी ट्रे सुरक्षित है। दोबारा ऑर्डर करने के लिए टेबल QR स्कैन करें।'"), 'HI voice');
  assert.ok(i18n.includes("windowEndedNote: 'ಆರ್ಡರಿಂಗ್ ಅವಧಿ ಮುಕ್ತಾಯವಾಗಿದೆ — ನಿಮ್ಮ ಬುಟ್ಟಿ ಉಳಿದಿದೆ. ಮತ್ತೆ ಆರ್ಡರ್ ಮಾಡಲು ಟೇಬಲ್ QR ಸ್ಕ್ಯಾನ್ ಮಾಡಿ.'"), 'KN voice');
  ok('the word in three voices (EN, हिंदी, ಕನ್ನಡ)');
}

/* 6 — the version law, in the agreement shape. */
{
  const v = versionTs.match(/APP_VERSION = '([\d.]+)'/)?.[1];
  const sw = swJs.match(/const VERSION = "servepoint-v([\d.]+)-r1"/)?.[1];
  assert.ok(v && sw, 'both sides carry a version');
  assert.equal(v, sw, 'version.ts and sw.js speak the SAME version');
  ok(`the version law: ${v} on both sides`);
}

console.log(`\nunit289 — ${n} checks green.`);
