/**
 * unit291 — v5.252.0 "the ticket's way back".
 *
 * The round's laws, pinned:
 *   1. THE FORWARD ACTION EXISTS — the track page recovers the guest's
 *      session token from sessionStorage (the per-tab promise) and offers
 *      "Order more" in the FIRST seat of the bottom row: the second round
 *      — a café's most natural guest act — no longer requires a rescan.
 *   2. THE PILL NEVER CLAIMS A SESSION IT CANNOT SEE — the token comes from
 *      sessionStorage only (per-tab by design; a fresh/reopened link shows
 *      no pill and keeps the two honest exits); localStorage is never read
 *      for the session (a storage-wide scan would promise cross-tab).
 *   3. THE DESTINATION TELLS ITS OWN TRUTH — the route is /menu/<token>,
 *      where 288/289/290's band machinery speaks every session state
 *      (live / warm / ended); the pill promises the way, not the window.
 *   4. THE KEPT CART RIDES ALONG — the menu's cart is keyed by token in
 *      sessionStorage; recovering the same token re-opens the same cart.
 *   5. A CANCELLED TICKET KEEPS THE TWO EXITS — the pill lives inside the
 *      order && !cancelled block; a cut order's way back is the staff.
 *   6. THE PAID WORD — a served AND paid ticket's hint speaks "the bill is
 *      settled" (the stepper agrees with the green PAID pill; "pay at the
 *      counter" was a lie the moment the money landed), in all three
 *      dictionaries.
 *   7. THE THREE-LANGUAGE PROMISE — orderMore + flowServedPaidHint in EN,
 *      HI and KN.
 *   8. THE VERSION LAW in the agreement shape.
 *
 * Run: bunx vite-node scripts/unit291.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

let n = 0;
const ok = (s) => { n++; console.log(`  ok ${n} — ${s}`); };

const page = readFileSync('src/components/guest/GuestPages.tsx', 'utf8');
const i18n = readFileSync('src/lib/guest-i18n.ts', 'utf8');
const versionTs = readFileSync('src/version.ts', 'utf8');
const swJs = readFileSync('public/sw.js', 'utf8');

/* 1 — the forward action exists, in the forward seat. */
{
  assert.ok(page.includes('function recoverGuestSessionToken(): string | null'), 'the recovery helper exists');
  assert.ok(page.includes('const [moreToken] = useState(() => recoverGuestSessionToken());'), 'the token derives once at mount');
  const rowIdx = page.indexOf('the forward action takes the first seat');
  assert.ok(rowIdx > 0, 'the pill carries the first-seat comment');
  const pillIdx = page.indexOf("{moreToken && (");
  const copyIdx = page.indexOf("void navigator.clipboard?.writeText(window.location.href);");
  assert.ok(pillIdx > 0 && copyIdx > pillIdx, 'the pill sits BEFORE copy-link in the row (the forward seat)');
  ok('the forward action exists and takes the first seat');
}

/* 2 — sessionStorage only: the pill never claims a session it cannot see. */
{
  assert.ok(page.includes('/^sp\\.guest\\.session\\.(.+)$/'), 'the scan keys on the session cache prefix');
  const helperStart = page.indexOf('function recoverGuestSessionToken');
  const helperEnd = page.indexOf('export function GuestTrackPage');
  const helper = page.slice(helperStart, helperEnd);
  assert.ok(helper.includes('sessionStorage'), 'the helper scans sessionStorage (per-tab)');
  assert.ok(!helper.includes('localStorage'), 'the helper never reads localStorage (no cross-tab promise)');
  ok('sessionStorage only — no cross-tab promise');
}

/* 3 — the destination tells its own truth. */
{
  assert.ok(page.includes('window.location.assign(`/menu/${moreToken}`)'), 'the route is the menu with the recovered token');
  assert.ok(page.includes("aria-label={t('orderMore')}"), 'the word rides the aria-label');
  ok('the destination is the menu — the bands speak their own truth');
}

/* 4 — the kept cart rides along (the token is the cart key's other half). */
{
  assert.ok(page.includes("const CART_KEY = (token: string) => `sp.guest.cart.${token}`;"), 'the cart is keyed by the same token');
  ok('the recovered token re-opens the same cart');
}

/* 5 — a cancelled ticket keeps the two exits. */
{
  const blockStart = page.indexOf('{order && !cancelled && (');
  const pillIdx = page.indexOf('{moreToken && (');
  const cancelledCard = page.indexOf("{order && cancelled && (");
  assert.ok(blockStart > 0 && pillIdx > blockStart, 'the pill lives inside the !cancelled block');
  assert.ok(pillIdx > cancelledCard, 'the pill renders after the cancelled branch (not inside it)');
  ok('a cancelled ticket keeps the two honest exits');
}

/* 6 — the paid word: the stepper agrees with the PAID pill. */
{
  assert.ok(page.includes("servedNow && paid ? t('flowServedPaidHint') : t(f.hintKey)"), 'the served hint swaps on paid');
  ok('the paid word: served + paid speaks settled');
}

/* 7 — the three-language promise. */
{
  for (const [lang, word, hint] of [
    ['EN', "orderMore: 'Order more',", "flowServedPaidHint: 'Enjoy — the bill is settled',"],
    ['HI', "orderMore: 'और ऑर्डर करें',", "flowServedPaidHint: 'स्वाद लें — बिल चुक गया',"],
    ['KN', "orderMore: 'ಮತ್ತಷ್ಟು ಆರ್ಡರ್ ಮಾಡಿ',", "flowServedPaidHint: 'ಆನಂದಿಸಿ — ಬಿಲ್ ಪಾವತಿಸಲಾಗಿದೆ',"],
  ]) {
    assert.ok(i18n.includes(word), `${lang} speaks orderMore`);
    assert.ok(i18n.includes(hint), `${lang} speaks flowServedPaidHint`);
  }
  ok('three languages carry both words');
}

/* 8 — the version law, the agreement shape. */
{
  assert.ok(versionTs.includes("export const APP_VERSION = '5.252.0';"), 'APP_VERSION is 5.252.0');
  assert.ok(swJs.includes('const VERSION = "servepoint-v5.252.0-r1";'), 'the SW cache name is servepoint-v5.252.0-r1 (old shells re-fetch)');
  ok('the version law holds: 5.252.0 / servepoint-v5.252.0-r1');
}

console.log(`\nunit291 — ${n} checks, all green.`);
