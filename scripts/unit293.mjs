/**
 * unit293 — v5.254.0 "the kitchen's ears / the note comes home".
 *
 * The round's laws, pinned:
 *   1. THE FIELD EXISTS — the drawer offers an optional order-level note
 *      before the Place order button: the server has taken p_notes since
 *      the first menu round; the UI just never offered the word. The
 *      textarea wears the FeedbackCard's language (one input shape across
 *      the guest's surfaces) with the shared 280 cap and a live counter.
 *   2. THE WORD RIDES TO THE SERVER — placeOrder passes
 *      `notes: orderNote.trim() || null` (a blank note is no note — the
 *      server stores NULL, not whitespace).
 *   3. KEPT WITH THE FOOD — the note persists per-tab beside the cart
 *      (`sp.guest.orderNote.<token>`), read once at mount, written on
 *      every change, never localStorage.
 *   4. THE FIELD STARTS FRESH — the checkout success wipes the key beside
 *      the cart (the note rode to the server); INVALID_TOKEN's wipe takes
 *      it too (a dead token's word goes with the cart).
 *   5. THE NOTE COMES HOME — the ticket's bill card speaks the order-level
 *      note verbatim in the waiting ink (the straggler family: amber
 *      border-l-[#B45309] on bg-[#FBF6EA], the StickyNote label), gated on
 *      a non-blank note (no empty row).
 *   6. THE THREE-LANGUAGE PROMISE — drawerNoteLabel + drawerNotePh +
 *      trackNoteLabel in EN, HI and KN.
 *   7. THE VERSION LAW in the agreement shape (the live word, unit274's law).
 *
 * Run: bunx vite-node scripts/unit293.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

let n = 0;
const ok = (s) => { n++; console.log(`  ok ${n} — ${s}`); };

const page = readFileSync('src/components/guest/GuestPages.tsx', 'utf8');
const i18n = readFileSync('src/lib/guest-i18n.ts', 'utf8');
const versionTs = readFileSync('src/version.ts', 'utf8');
const swJs = readFileSync('public/sw.js', 'utf8');

/* 1 — the field exists in the feedback card's language. */
{
  assert.ok(page.includes("const ORDER_NOTE_KEY = (token: string) => `sp.guest.orderNote.${token}`;"), 'the note key exists');
  assert.ok(page.includes('const ORDER_NOTE_MAX = 280;'), 'the cap is the feedback card\'s 280');
  const fieldIdx = page.indexOf('id="drawer-note"');
  const btnIdx = page.indexOf('windowEndedCta') > 0 ? page.indexOf("onClick={() => void placeOrder()}") : -1;
  assert.ok(fieldIdx > 0 && btnIdx > fieldIdx, 'the note field stands BEFORE the Place order button');
  assert.ok(page.includes('maxLength={ORDER_NOTE_MAX}'), 'the textarea is capped');
  assert.ok(page.includes('{orderNote.length}/{ORDER_NOTE_MAX}'), 'the live counter speaks');
  assert.ok(page.includes("htmlFor=\"drawer-note\""), 'the label is bound (a11y)');
  ok('the field exists, in one shared input language');
}

/* 2 — the word rides to the server. */
{
  assert.ok(page.includes('notes: orderNote.trim() || null, // v5.254.0 — the kitchen\'s ears, finally wired'), 'placeOrder passes the trimmed note (blank = null)');
  ok('the word rides to the server at checkout');
}

/* 3 — kept with the food, per-tab, read once. */
{
  const helperStart = page.indexOf('function readOrderNote');
  const helperEnd = page.indexOf('/* v5.253.0 — the ticket\'s word reaches the menu');
  const helper = page.slice(helperStart, helperEnd);
  assert.ok(helper.includes('sessionStorage'), 'the read touches sessionStorage');
  assert.ok(!helper.includes('localStorage'), 'the read never touches localStorage');
  assert.ok(helper.includes('typeof raw === \'string\''), 'the shape is validated (string only)');
  assert.ok(page.includes('const [orderNote, setOrderNote] = useState(() => readOrderNote(qrToken));'), 'read once at mount');
  assert.ok(page.includes('sessionStorage.setItem(ORDER_NOTE_KEY(qrToken), v); // kept with the food'), 'every change is written (the note survives a reload with the cart)');
  ok('kept with the food, per-tab, read once, written on change');
}

/* 4 — the field starts fresh. */
{
  const wipeIdx = page.indexOf("sessionStorage.removeItem(ORDER_NOTE_KEY(qrToken)); // the note rode to the server — the field starts fresh");
  const cartWipe = page.indexOf("sessionStorage.removeItem(CART_KEY(qrToken));\n    sessionStorage.removeItem(ORDER_NOTE_KEY(qrToken))");
  assert.ok(wipeIdx > 0 && cartWipe > 0, 'checkout success wipes the note beside the cart');
  const invalidWipe = page.indexOf("sessionStorage.removeItem(ORDER_NOTE_KEY(qrToken)); // the note goes with the cart");
  assert.ok(invalidWipe > 0, 'INVALID_TOKEN takes the note with the cart too');
  ok('the field starts fresh; a dead token takes its word');
}

/* 5 — the note comes home. */
{
  /* v5.298.0 honest re-anchor — the honest-note law evolved this gate: the
     operational suffix alone (a QR order with no guest word) keeps the
     section's silence, and the body speaks the GUEST'S word, stripped of the
     house's 'via QR · Table n' tail. The law's shape is unchanged: the row
     stands in the bill card before the totals, the waiting ink carries the
     word, the word is verbatim (never rewritten — more so now: only what the
     guest wrote). */
  const noteIdx = page.indexOf('{guestNote.length > 0 && (');
  assert.ok(noteIdx > 0, 'the ticket gates the note row on a guest word (the suffix alone keeps its silence)');
  const billIdx = page.indexOf('{/* v5.254.0 — the note comes home');
  const trackStart = page.indexOf('export function GuestTrackPage');
  const totalsIdx = page.indexOf("{t('subtotal')}", trackStart); // the BILL card's totals — the drawer's own appear earlier
  assert.ok(billIdx > 0 && totalsIdx > billIdx, 'the note row stands in the bill card, before the totals');
  const rowSlice = page.slice(billIdx, noteIdx + 800);
  assert.ok(rowSlice.includes('border-l-[#B45309]') && rowSlice.includes('bg-[#FBF6EA]'), 'the waiting ink (the straggler family) carries the guest\'s word');
  assert.ok(rowSlice.includes('{guestNote}'), 'the word is spoken VERBATIM (never rewritten)');
  ok('the note comes home on the ticket, verbatim, in the waiting ink');
}

/* 6 — the three-language promise. */
{
  for (const [lang, label, ph, back] of [
    ['EN', "drawerNoteLabel: 'Anything we should know? (optional)',", "drawerNotePh: 'Allergies, spice level, timing…',", "trackNoteLabel: 'Your note to the kitchen',"],
    ['HI', "drawerNoteLabel: 'हमें कुछ बताना है? (वैकल्पिक)',", "drawerNotePh: 'एलर्जी, तीखापन, समय…',", "trackNoteLabel: 'रसोई के लिए आपकी टिप्पणी',"],
    ['KN', "drawerNoteLabel: 'ಏನಾದರೂ ಹೇಳಬೇಕೆ? (ಐಚ್ಛಿಕ)',", "drawerNotePh: 'ಅಲರ್ಜಿ, ಖಾರ, ಸಮಯ…',", "trackNoteLabel: 'ಅಡುಗೆಮನೆಗೆ ನಿಮ್ಮ ಟಿಪ್ಪಣಿ',"],
  ]) {
    assert.ok(i18n.includes(label), `${lang} speaks drawerNoteLabel`);
    assert.ok(i18n.includes(ph), `${lang} speaks drawerNotePh`);
    assert.ok(i18n.includes(back), `${lang} speaks trackNoteLabel`);
  }
  ok('three languages carry the ears and the echo');
}

/* 7 — the version law, the agreement shape. */
{
  const v = versionTs.match(/APP_VERSION = '([^']+)'/)?.[1] ?? '';
  assert.ok(v.length > 0, 'APP_VERSION is present');
  assert.ok(swJs.includes(`const VERSION = "servepoint-v${v}-r1";`), `the SW cache name is servepoint-v${v}-r1 (old shells re-fetch)`);
  ok(`the version law holds: version.ts and sw.js agree on ${v}`);
}

console.log(`\nunit293 — ${n} checks, all green.`);
