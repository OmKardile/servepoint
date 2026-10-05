/**
 * unit292 — v5.253.0 "the ticket's word reaches the menu".
 *
 * The round's laws, pinned:
 *   1. THE LOOP CLOSES — 5.252.0 opened ticket → "Order more" → menu; the
 *      menu now remembers the guest's latest ticket (from THEIR OWN
 *      checkout) and offers the way back: a slim chip above the category
 *      rail, first thing in main.
 *   2. THE GUEST'S MEMORY, NOT A STATUS CLAIM — the chip's data is the
 *      {id, n} the server handed back at placeOrder; the chip's words
 *      claim NOTHING about the kitchen (no "preparing"/"ready" — the
 *      ticket page speaks the live state); the chip only points the way.
 *   3. PER-TAB, READ ONCE — the read helper touches sessionStorage only
 *      (never localStorage — a cross-tab scan would remember what this
 *      tab never earned), validates the shape (id string, n number),
 *      try/catch for private mode, and reads once at mount.
 *   4. THE WRITE AT THE SOURCE OF TRUTH — placeOrder's success path writes
 *      the memory BEFORE navigating to the ticket; INVALID_TOKEN's wipe
 *      (a dead token's memory goes with it) removes it beside the cart.
 *   5. NO MEMORY, NO CHIP — the chip gates on `phase === 'ready' &&
 *      lastTicket`; a fresh link / private mode / corrupt cache renders
 *      nothing and claims nothing.
 *   6. THE THREE-LANGUAGE PROMISE — lastTicketTitle + lastTicketSub +
 *      lastTicketAria in EN, HI and KN.
 *   7. THE VERSION LAW in the agreement shape (the live word, unit274's law).
 *
 * Run: bunx vite-node scripts/unit292.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

let n = 0;
const ok = (s) => { n++; console.log(`  ok ${n} — ${s}`); };

const page = readFileSync('src/components/guest/GuestPages.tsx', 'utf8');
const i18n = readFileSync('src/lib/guest-i18n.ts', 'utf8');
const versionTs = readFileSync('src/version.ts', 'utf8');
const swJs = readFileSync('public/sw.js', 'utf8');

/* 1 — the loop closes: the chip exists, above the rail, first in main. */
{
  assert.ok(page.includes('const LAST_ORDER_KEY = (token: string) => `sp.guest.lastOrder.${token}`;'), 'the memory key exists');
  const chipIdx = page.indexOf("{phase === 'ready' && lastTicket && (");
  const railIdx = page.indexOf('{/* sticky category rail'); // the JSX comment — the earlier one (line ~875) is a JS block's prose
  assert.ok(chipIdx > 0 && railIdx > chipIdx, 'the chip renders BEFORE the sticky rail (first in main)');
  assert.ok(page.includes('window.location.assign(`/track/${lastTicket.id}`)'), 'the chip routes to the ticket page');
  ok('the loop closes: the chip leads back to the ticket');
}

/* 2 — the guest's memory, not a status claim. */
{
  assert.ok(page.includes('JSON.stringify({ id: res.order.id, n: res.order.order_number })'), 'the write stores the server\'s own {id, n}');
  const i18nEn = i18n.slice(i18n.indexOf('const EN: Dict = {'), i18n.indexOf('const HI: Dict = {'));
  assert.ok(i18nEn.includes("lastTicketSub: 'Placed from this table — tap to follow it',"), 'the EN sub claims only the placement (no kitchen status)');
  const chipLines = i18nEn.split('\n').filter((l) => l.includes('lastTicket')).join('\n');
  for (const banned of ['preparing', 'in the kitchen', 'being made', 'ready']) {
    assert.ok(!chipLines.toLowerCase().includes(banned), `no status claim ("${banned}") in the chip words`);
  }
  ok('the chip is a memory, the ticket page speaks the live truth');
}

/* 3 — per-tab, read once, shape-validated. */
{
  const helperStart = page.indexOf('function readLastTicket');
  const helperEnd = page.indexOf('/** The window\'s left-over');
  const helper = page.slice(helperStart, helperEnd);
  assert.ok(helper.includes('sessionStorage'), 'the helper reads sessionStorage (per-tab)');
  assert.ok(!helper.includes('localStorage'), 'the helper never reads localStorage');
  assert.ok(helper.includes("typeof parsed.id !== 'string' || typeof parsed.n !== 'number'"), 'the shape is validated (id string, n number)');
  assert.ok(helper.includes('} catch {'), 'private mode / corrupt cache lands in the catch');
  assert.ok(page.includes('const [lastTicket] = useState(() => readLastTicket(qrToken));'), 'read once at mount');
  ok('per-tab, read once, shape-validated');
}

/* 4 — the write at the source of truth + the INVALID_TOKEN wipe. */
{
  const writeIdx = page.indexOf('sessionStorage.setItem(LAST_ORDER_KEY(qrToken)');
  const navIdx = page.indexOf("window.location.assign(`/track/${res.order.id}`);");
  assert.ok(writeIdx > 0 && navIdx > writeIdx, 'the memory is written BEFORE the navigation to the ticket');
  const wipeIdx = page.indexOf("sessionStorage.removeItem(LAST_ORDER_KEY(qrToken)); // the token died — the memory goes with it");
  const cartWipeIdx = page.indexOf("sessionStorage.removeItem(CART_KEY(qrToken));\n        sessionStorage.removeItem(LAST_ORDER_KEY(qrToken))");
  assert.ok(wipeIdx > 0 && cartWipeIdx > 0, 'INVALID_TOKEN wipes the memory beside the cart');
  ok('the write rides the checkout; a dead token takes its memory with it');
}

/* 5 — no memory, no chip. */
{
  assert.ok(page.includes("{phase === 'ready' && lastTicket && ("), 'the chip gates on ready AND a memory');
  ok('no memory, no chip — nothing claimed');
}

/* 6 — the three-language promise. */
{
  for (const [lang, title, sub, aria] of [
    ['EN', "lastTicketTitle: 'Your ticket #{n}',", "lastTicketSub: 'Placed from this table — tap to follow it',", "lastTicketAria: 'Follow your ticket #{n}',"],
    ['HI', "lastTicketTitle: 'आपका टिकट #{n}',", "lastTicketSub: 'इसी टेबल से लगा — देखने के लिए टैप करें',", "lastTicketAria: 'अपना टिकट #{n} देखें',"],
    ['KN', "lastTicketTitle: 'ನಿಮ್ಮ ಟಿಕೆಟ್ #{n}',", "lastTicketSub: 'ಇದೇ ಟೇಬಲ್‌ನಿಂದ ಆರ್ಡರ್ — ನೋಡಲು ಟ್ಯಾಪ್ ಮಾಡಿ',", "lastTicketAria: 'ನಿಮ್ಮ ಟಿಕೆಟ್ #{n} ನೋಡಿ',"],
  ]) {
    assert.ok(i18n.includes(title), `${lang} speaks lastTicketTitle`);
    assert.ok(i18n.includes(sub), `${lang} speaks lastTicketSub`);
    assert.ok(i18n.includes(aria), `${lang} speaks lastTicketAria`);
  }
  ok('three languages carry the chip words');
}

/* 7 — the version law, the agreement shape. */
{
  const v = versionTs.match(/APP_VERSION = '([^']+)'/)?.[1] ?? '';
  assert.ok(v.length > 0, 'APP_VERSION is present');
  assert.ok(swJs.includes(`const VERSION = "servepoint-v${v}-r1";`), `the SW cache name is servepoint-v${v}-r1 (old shells re-fetch)`);
  ok(`the version law holds: version.ts and sw.js agree on ${v}`);
}

console.log(`\nunit292 — ${n} checks, all green.`);
