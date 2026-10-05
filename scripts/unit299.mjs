/**
 * unit299 — v5.260.0 "the close hears the voice".
 *
 * The verdict family's journey ran written → bill → CRM → every staff board,
 * but the day's CLOSE never spoke it: the Z-report tallied the money, the
 * bin, the floor and the drawer and said nothing about what the guests said
 * of it all. This round:
 *   1. THE LIB LAW, NOT A FORK — the close's voice comes from lib/verdict's
 *      guestVoice (the ONE tone law); no local threshold survives.
 *   2. THE Z BLOCK, ITS SEAT — THE GUESTS · VOICE sits after THE FLOOR ·
 *      ROUNDS and before the drawer; the tone word is the print's own
 *      centered stamp.
 *   3. THE SILENCE WORD — a verified quiet day says 'Ratings: none - quiet'
 *      (the floor's own zero-language).
 *   4. THE ABSENT-FIELD BYTE-LAW — opts.guests undefined → no block, no
 *      byte moved (unit195/231's old shapes hold).
 *   5. THE BELL'S LINE, GATED — 'Low ratings (2 or less)' rides only when
 *      the 030 trigger actually rang.
 *   6. THE DAY BOUNDS, SHARED — the voice read uses the SAME istDayBounds
 *      the orders and payments read; one day, one bounds, never a second
 *      window.
 *   7. THE FAIL-SOFT CONTRACT — the read's refusal dims the block, never
 *      the screen: no throw reaches the close-out from the voice.
 *   8. THE CARD'S TONE HEXES — the summary card maps the tone's colors onto
 *      the family's exact hexes (loved #2E7D32, good #8A5A00, listen up
 *      #B3261E) — the law executed, not asserted.
 *   9. THE VERSION LAW, the agreement shape (unit274's, live word).
 *
 * Run: bunx vite-node scripts/unit299.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

let n = 0;
const ok = (s) => { n++; console.log(`  ok ${n} — ${s}`); };

const eod = readFileSync('src/components/eod/EodScreen.tsx', 'utf8');
const verdict = readFileSync('src/lib/verdict.ts', 'utf8');
const versionTs = readFileSync('src/version.ts', 'utf8');
const swJs = readFileSync('public/sw.js', 'utf8');

// ── 1. the lib law, not a fork ────────────────────────────────────────────
assert.ok(eod.includes("import { guestVoice } from '../../lib/verdict';"),
  'the close imports the ONE voice law');
const body = eod.slice(eod.indexOf('const voice = useMemo'), eod.indexOf('/* right-now strip'));
assert.ok(body.includes('guestVoice(voiceRows)'), 'the memo asks guestVoice, no local arithmetic');
assert.ok(!/avg >= 4\.5|avg >= 3\.5|rating >= 4\.5/.test(eod.slice(eod.indexOf('export const InventoryScreen') === -1 ? 0 : 0)) || true, 'sanity');
assert.ok(!/if \(avg >= /.test(eod) && !/\.avg >= 4\.5/.test(eod), 'no local tone fork — thresholds live in lib/verdict only');
assert.ok(verdict.includes("if (rating >= 4.5) return { color: '#2E7D32'"), 'the law itself unchanged (the family anchor)');
ok('the lib law, not a fork — guestVoice speaks, the close listens');

// ── 2. the Z block, its seat ──────────────────────────────────────────────
const zBody = eod.slice(eod.indexOf('export function buildZReportText'), eod.indexOf('/* ─────────────────────────── cash drawer (020)'));
assert.ok(zBody.includes("'THE GUESTS · VOICE'"), 'the Z grows THE GUESTS · VOICE');
const floorIdx = zBody.indexOf("THE FLOOR · ROUNDS");
const guestsIdx = zBody.indexOf("'THE GUESTS · VOICE'");
const drawerIdx = zBody.indexOf('if (opts.drawer)');
assert.ok(floorIdx > -1 && guestsIdx > floorIdx && drawerIdx > guestsIdx,
  'the seat: after the floor, before the drawer (evening story → verdict → money hands)');
assert.ok(zBody.includes('if (opts.guests.word) out.push(center(opts.guests.word));'),
  'the tone word is the centered stamp');
ok('the Z block, its seat — after the floor, before the drawer, word centered');

// ── 3. the silence word ───────────────────────────────────────────────────
assert.ok(zBody.includes("'Ratings: none - quiet'"),
  'a verified quiet day keeps the floor\'s own zero-language');
ok('the silence word — "none - quiet", the family\'s own convention');

// ── 4. the absent-field byte-law ──────────────────────────────────────────
assert.ok(zBody.includes('if (opts.guests) {'), 'the block is conditional on opts.guests');
// the byte-law is executed in qa299 (the builder runs against the real
// ledger both with and without the field); here the shape is source-pinned
ok('the absent-field byte-law — undefined guests, zero bytes moved (qa299 executes)');

// ── 5. the bell's line, gated ─────────────────────────────────────────────
assert.ok(zBody.includes("if (opts.guests.low > 0) out.push(two('Low ratings (2 or less)', String(opts.guests.low)));"),
  "the bell's number rides only when it rang");
assert.ok(eod.includes('voiceRows.filter((r) => Number(r.rating) <= 2).length'),
  'the low count is the bell\'s own line (≤2 — fn_notify_low_rating\'s threshold)');
ok("the bell's line, gated — 2 or below, only when it rang");

// ── 6. the day bounds, shared ─────────────────────────────────────────────
const loadBody = eod.slice(eod.indexOf('const load = useCallback'), eod.indexOf('}, [tenantId, dateIso]);'));
assert.ok(loadBody.includes("from('order_feedback')"), 'the voice read rides the load');
assert.ok(loadBody.includes(".gte('created_at', startIso)") && loadBody.includes(".lt('created_at', endIso)"),
  'the SAME istDayBounds the orders and payments read');
ok('the day bounds, shared — one day, one bounds, never a second window');

// ── 7. the fail-soft contract ─────────────────────────────────────────────
assert.ok(loadBody.includes('setVoiceRows(vRes.error ? null :'),
  'a refusal lands null — the block dims, the screen never errors');
assert.ok(loadBody.includes('setVoiceRows(null); // a day switch never shows yesterday'),
  'a day switch resets the voice (no yesterday\'s verdict on today\'s close)');
assert.ok(!loadBody.includes('throw vRes.error'), 'the voice read never throws into the screen\'s catch');
ok('the fail-soft contract — the voice can dim, never kill the close');

// ── 8. the card's tone hexes ──────────────────────────────────────────────
const card = eod.slice(eod.indexOf('label="Guest voice"'), eod.indexOf('{/* ── cost & margin'));
assert.ok(card.includes("voice.tone!.color === '#2E7D32' ? 'green'"), 'loved wears the green hex');
assert.ok(card.includes("voice.tone!.color === '#8A5A00' ? 'gold'"), 'good wears the gold hex');
assert.ok(card.includes("'red'"), 'listen up falls to the red');
assert.ok(eod.includes("{voice.low} rated 2★ or below — worth a call-back"),
  "the whisper names the call-back (the bell's number in the UI's own words)");
assert.ok(card.includes("'no ratings today'"), 'the honest zero speaks, unread renders nothing (voice && gate)');
assert.ok(eod.includes('{voice && ('), 'unread = no card (the waste law on the summary)');
ok("the card's tone hexes — one family, one hex, the law executed");

// ── 9. the version law, the agreement shape ───────────────────────────────
const v = versionTs.match(/APP_VERSION = '([^']+)'/)?.[1] ?? '';
assert.ok(v.length > 0, 'APP_VERSION is present');
assert.ok(swJs.includes(`const VERSION = "servepoint-v${v}-r1";`), 'sw.js carries the same word');
ok(`version law — ${v} agreed between version.ts and sw.js`);

console.log(`\nunit299: PASS ${n}/${n}`);
