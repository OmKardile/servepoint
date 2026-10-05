/* unit308 — v5.269.0 "the ticket remembers the order" (agreement shape)
 * The census finding: a COMPLETED ticket — the end of the meal, the moment a
 * guest most naturally wants the same plates again — had no way to say so.
 * Its items are display words (sp_get_public_order predates ids), and "Order
 * more" opens an EMPTY cart. The round's design: the ticket leaves a NAME
 * MANIFEST (identity only — never prices, the sessionStorage law) for the
 * next menu page with the same session token; the menu — the only holder of
 * live items — maps every plate against TODAY's menu at TODAY's prices, or
 * drops it whole and COUNTS it (the house does not substitute).
 * THE LAWS PINNED HERE:
 *   1. THE MANIFEST IS IDENTITY-ONLY: writeReorderPayload carries names,
 *      counts, the guest's own words — no price/total/money field anywhere;
 *   2. READ-ONCE: takeReorderPayload removes the key the moment it reads it
 *      (a reload can never double-add the plates);
 *   3. THE CTA'S GATE: completed + resumable session + plates present; a
 *      cancelled ticket keeps the two exits (252's own law); the payload is
 *      written BEFORE the walk;
 *   4. ONE MERGE GRAMMAR: the cart's dedupe-and-grow is extracted to
 *      mergeLines and BOTH the customizer's add and the reorder landing ride
 *      it (the 50 cap lives in the one grammar);
 *   5. THE STRICT MATCH: item, variant and EVERY add-on matched by name,
 *      case-insensitive and trimmed; any miss drops the WHOLE line and
 *      counts it — never a silent substitution; qty clamped 1..50;
 *   6. THE LANDING WORD: role=status, the thanks card's green family,
 *      spFadeIn under the reduced-motion gate, a dismiss X with an
 *      aria-label, three honest words (landed / gone / dropped);
 *   7. THE WORDS EXIST IN ALL THREE LANGUAGES: the six reorder keys in
 *      en/hi/kn (18 dictionary lines, the census counts); the en landed
 *      word says "today's prices" because the manifest carried none;
 *   8. THE FAMILY STANDS: the net band (306) byte-kept on both render
 *      sites; the version law: APP_VERSION and sw.js agree. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const guest = readFileSync('/home/z/my-project/src/components/guest/GuestPages.tsx', 'utf8');
const guestLib = readFileSync('/home/z/my-project/src/lib/guest.ts', 'utf8');
const i18n = readFileSync('/home/z/my-project/src/lib/guest-i18n.ts', 'utf8');
const versionTs = readFileSync('/home/z/my-project/src/version.ts', 'utf8');
const swJs = readFileSync('/home/z/my-project/public/sw.js', 'utf8');

let passed = 0;
const check = (name, fn) => {
  fn();
  passed += 1;
  console.log(`  ok ${passed} — ${name}`);
};

/* ── 1. the manifest is identity-only ────────────────────────────────── */
check('the manifest carries names and counts — never prices', () => {
  assert.ok(guestLib.includes('export function writeReorderPayload('), 'the writer exists');
  assert.ok(guestLib.includes('`sp.guest.reorder.${token}`'), 'the key lives in the session-key family');
  const writer = guestLib.match(/export function writeReorderPayload\([\s\S]*?\n\}/);
  assert.ok(writer, 'the writer body found');
  const map = writer[0].match(/order\.items\.map\(\(it\) => \(\{[\s\S]*?\}\)\)/);
  assert.ok(map, 'the line map found');
  for (const field of ['name', 'variantName', 'addonNames', 'qty', 'notes']) {
    assert.ok(map[0].includes(field), `the map carries ${field}`);
  }
  for (const banned of ['price', 'total', 'money', 'unit_', 'tax']) {
    assert.ok(!map[0].includes(banned), `the map carries NO ${banned} field`);
  }
  assert.ok(writer[0].includes('placedAt: order.created_at'), 'the manifest remembers when the visit was');
});

/* ── 2. read-once ────────────────────────────────────────────────────── */
check('the manifest is consumed the moment the menu sees it', () => {
  const taker = guestLib.match(/export function takeReorderPayload\([\s\S]*?\n\}/);
  assert.ok(taker, 'the taker exists');
  const getAt = taker[0].indexOf('sessionStorage.getItem(');
  const rmAt = taker[0].indexOf('sessionStorage.removeItem(');
  const parseAt = taker[0].indexOf('JSON.parse(');
  assert.ok(getAt >= 0 && rmAt > getAt && parseAt > rmAt, 'remove sits between get and parse — read-once by construction');
  assert.ok(taker[0].includes('parsed.lines.length > 0'), 'an empty manifest reads as nothing');
});

/* ── 3. the CTA's gate ───────────────────────────────────────────────── */
check('the reorder CTA is gated: completed + session + plates, payload first', () => {
  assert.ok(
    guest.includes("{moreToken && order.status === 'completed' && order.items.length > 0 && ("),
    'completed + resumable session + plates present'
  );
  const cta = guest.match(/\{moreToken && order\.status === 'completed'[\s\S]*?\n              \)\}/);
  assert.ok(cta, 'the CTA block found');
  const writeAt = cta[0].indexOf('writeReorderPayload(moreToken, order)');
  const walkAt = cta[0].indexOf('window.location.assign(`/menu/${moreToken}`)');
  assert.ok(writeAt >= 0 && walkAt > writeAt, 'the manifest is written BEFORE the walk');
  // the cancelled law (252) stands: only completed passes this gate
  assert.ok(!cta[0].includes('cancelled'), 'a cancelled ticket never reaches this door');
});

/* ── 4. one merge grammar ────────────────────────────────────────────── */
check('add and reorder speak ONE merge grammar (dedupe, grow, cap 50)', () => {
  assert.ok(guest.includes('const mergeLines = (prev: CartLine[], incoming: CartLine[]): CartLine[] => {'), 'mergeLines extracted');
  const merge = guest.match(/const mergeLines = [\s\S]*?\n\};/);
  assert.ok(merge && merge[0].includes('Math.min(50,'), 'the 50 cap lives in the one grammar');
  // the customizer's add rides it
  assert.ok(guest.includes('setLines((prev) => mergeLines(prev, [{ ...l, key }]));'), 'addLine rides the shared grammar');
  // the reorder landing rides it
  assert.ok(guest.includes('setLines((prev) => mergeLines(prev, matched));'), 'the reorder landing rides the shared grammar');
  // the old inline duplicate is gone
  assert.ok(!guest.includes('const idx = prev.findIndex((x) => x.key === key);'), 'the inline merge duplicate retired');
});

/* ── 5. the strict match ─────────────────────────────────────────────── */
check('the match is strict: names, whole-line drops, honest count', () => {
  const consume = guest.match(/const manifest = takeReorderPayload\(qrToken\);[\s\S]*?setReorderNote\(\{ orderNumber: manifest\.orderNumber/);
  assert.ok(consume, 'the consume block found');
  assert.ok(consume[0].includes("i.name.trim().toLowerCase() === rl.name.trim().toLowerCase()"), 'items match by trimmed, case-folded name');
  assert.ok(consume[0].includes('v.name.trim().toLowerCase()'), 'variants match the same way');
  assert.ok(consume[0].includes('x.name.trim().toLowerCase()'), 'add-ons match the same way');
  assert.ok(consume[0].includes('if (rl.variantName && !variant) {'), 'a named variant that vanished drops the line');
  assert.ok(consume[0].includes('if (!addonsOk) {'), 'a missing add-on drops the line');
  assert.equal((consume[0].match(/dropped \+= 1;/g) ?? []).length, 3, 'three honest drop doors: item, variant, add-ons');
  assert.ok(consume[0].includes('Math.max(1, Math.min(50, Math.round(rl.qty) || 1))'), 'qty clamped into the cart law');
  assert.ok(consume[0].includes('key: lineKey(item.id,'), 'the landing speaks the SAME line identity the add flow speaks');
});

/* ── 6. the landing word ─────────────────────────────────────────────── */
check('the landing band: status role, green family, motion gate, dismiss door', () => {
  const band = guest.match(/\{phase === 'ready' && reorderNote && \([\s\S]*?\n        \)\}/);
  assert.ok(band, 'the band found');
  assert.ok(band[0].includes('role="status"'), 'the ears hear it');
  assert.ok(band[0].includes('bg-[#EAF4EC]'), 'the thanks family green');
  assert.ok(band[0].includes('border-l-[#2E7D32]'), 'the left rule the house bands speak');
  assert.ok(band[0].includes("<History size={15}"), 'the History ear names the past');
  assert.ok(band[0].includes('spFadeIn 240ms'), 'the motion grammar (stilled by index.css under reduced motion)');
  assert.ok(band[0].includes('aria-label={t(\'reorderDismiss\')}'), 'the X names itself');
  assert.ok(band[0].includes('<span className="block">'), 'the drop sentence breaks its own line — two truths, not one run-on');
  assert.ok(band[0].includes("t('reorderLanded'") && band[0].includes("t('reorderGone'") && band[0].includes("t('reorderDropped'"), 'landed / gone / dropped — three honest words');
  assert.ok(band[0].includes("reorderNote.matched === 1 ? '' : 's'"), 'the plural rides the house grammar');
});

/* ── 7. the words in three languages ─────────────────────────────────── */
check('the eight reorder keys exist in en, hi and kn; the words price honestly and agree', () => {
  for (const key of ['reorderCta', 'reorderCtaTitle', 'reorderLanded', 'reorderDropped', 'reorderGone', 'reorderDismiss', 'dropIsnt', 'dropArent']) {
    const hits = i18n.match(new RegExp(`^\\s*${key}: ['"]`, 'gm')) ?? [];
    assert.equal(hits.length, 3, `${key} speaks in all three dictionaries`);
  }
  assert.ok(i18n.includes("reorderLanded: \"#{n} is back in your cart — {m} item{s} at today's prices\""), "the en landed word says today's prices — the manifest's own honesty");
  assert.ok(i18n.includes('reorderGone: \'Nothing from #{n} is on the menu anymore — nothing was added.\''), 'the gone word admits what did NOT happen');
  // the drop word's verb rides a param — a number and its verb agree in every language
  assert.ok(i18n.includes('reorderDropped: "{d} item{s} from that visit {v} on the menu anymore."'), 'the en drop word interpolates its verb');
  assert.ok(guest.includes("v: reorderNote.dropped === 1 ? t('dropIsnt') : t('dropArent')"), 'the band picks the agreeing verb');
});

/* ── 8. the family stands + the version law ──────────────────────────── */
check('the 306 family byte-kept; APP_VERSION and sw.js agree', () => {
  assert.equal((guest.match(/<GuestNetBand \/>/g) ?? []).length, 2, 'the net band still renders on menu + track');
  assert.ok(guest.includes('wasOffline.current = true'), 'the episode grammar byte-kept');
  const v = versionTs.match(/APP_VERSION = '([^']+)'/)?.[1] ?? '';
  assert.ok(v.length > 0, 'APP_VERSION is present');
  assert.ok(swJs.includes(`const VERSION = "servepoint-v${v}-r1";`), `sw.js carries the same word (${v})`);
});

console.log(`\nunit308 — PASS ${passed}/${passed} (all checks green)`);
