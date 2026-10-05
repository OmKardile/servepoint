/* Task 229 — v5.190.0 unit suite: the tally learns the date.
 * The offer card said "used 3×" — a count you can't date is a count you
 * can't trust (5.187's doctrine, carried to the CRM). The redemption
 * ledger (offer_redemptions, migration 016) always knew WHEN an offer
 * last moved a ticket; now the card speaks it ("last used 2d ago", the
 * History icon the shelf taught), the hover title carries the exact
 * stamp, and the share paper grows a "Last used" row — Copy and WhatsApp
 * say what the screen says (the pairing discipline, 5.184→5.189).
 * Asserted: usedAgo's event register (today / Nd ago, clamp, floor,
 * boundary), the deliberate register fork side by side (debts stand
 * "Nd old" — events pass "Nd ago" — never mixed), offerUsageAria's full
 * sentence (count always, date only when the ledger has a row — silence
 * is not zero), buildOfferText's byte-identity without the ledger and
 * its "Last used" row with it (structured read — never guessed padding),
 * and the shared-arithmetic sweep (usedAgo === shelfTouch.words across
 * the ages — ONE clamp, ONE floor, two named voices).
 * Run: bunx vite-node scripts/unit229.mjs
 */
import assert from 'node:assert/strict';

const dayM = await import('/src/lib/day.ts');
const { chaseAge, usedAgo, dayTime } = dayM;
const shelfM = await import('/src/lib/shelf.ts');
const { shelfTouch } = shelfM;
const custM = await import('/src/components/customers/CustomersScreen.tsx');
const { buildOfferText, offerUsageAria } = custM;

let n = 0;
const ok = (name) => console.log(`  ok ${++n} - ${name}`);

/* the suite owns the clock — no run-hour literal ever appears (228's rule) */
const NOW = new Date('2026-10-04T12:00:00+05:30').getTime();
const ago = (hours) => new Date(NOW - hours * 36e5).toISOString();

/* ── 1. usedAgo: the event register ─────────────────────────────────── */
assert.equal(usedAgo(ago(0), NOW), 'today', 'just now is today');
assert.equal(usedAgo(ago(3), NOW), 'today', '3h is still today');
assert.equal(usedAgo(ago(24), NOW), '1d ago', 'the 24h boundary is 1d ago');
assert.equal(usedAgo(ago(49), NOW), '2d ago', '49h floors to 2d ago');
assert.equal(usedAgo(ago(30 * 24), NOW), '30d ago', 'a month speaks plainly');
ok('usedAgo words: today / 1d / 2d / 30d, floor + 24h boundary');

/* ── 2. the clamp: the clock never convicts backwards ───────────────── */
assert.equal(usedAgo(new Date(NOW + 2 * 36e5).toISOString(), NOW), 'today',
  'a future-dated row clamps to today, never a negative age');
ok('clock-skew clamped: future stamp reads today');

/* ── 3. the register fork, side by side (5.187's discipline) ────────── */
const stamp49 = ago(49);
assert.equal(chaseAge(stamp49, NOW), '2d old', 'debts stand: Nd old');
assert.equal(usedAgo(stamp49, NOW), '2d ago', 'events pass: Nd ago');
assert.equal(shelfTouch(stamp49, NOW).words, '2d ago', 'shelf events pass too');
assert.equal(chaseAge(ago(0), NOW), 'today', 'a fresh debt is today');
assert.equal(usedAgo(ago(0), NOW), 'today', 'a fresh event is today');
ok('register fork side by side: "2d old" (debt) vs "2d ago" (event)');

/* ── 4. the shared-arithmetic sweep: ONE clamp, ONE floor ───────────── */
for (const h of [0.5, 6, 23.9, 24, 30, 47.9, 48, 72, 100, 200, 720]) {
  assert.equal(usedAgo(ago(h), NOW), shelfTouch(ago(h), NOW).words,
    `usedAgo === shelfTouch.words at ${h}h — the event register is ONE math`);
}
ok('sweep 0.5h–720h: usedAgo matches shelfTouch.words at every age');

/* ── 5. offerUsageAria: the full sentence ───────────────────────────── */
assert.equal(offerUsageAria(3, ago(49), NOW), 'used 3 times, last used 2d ago');
assert.equal(offerUsageAria(1, ago(3), NOW), 'used 1 time, last used today');
assert.equal(offerUsageAria(0, null, NOW), 'used 0 times', 'no ledger row: the base sentence alone');
assert.equal(offerUsageAria(0, undefined, NOW), 'used 0 times', 'both absences read the same');
assert.equal(offerUsageAria(1, ago(49), NOW), 'used 1 time, last used 2d ago', 'singular count');
assert.equal(offerUsageAria(12, ago(49), NOW), 'used 12 times, last used 2d ago', 'plural count');
ok('offerUsageAria: count always, date only when the ledger speaks');

/* ── 6. the aria's date clause IS the card's clause ─────────────────── */
const iso = ago(49);
assert.ok(offerUsageAria(3, iso, NOW).endsWith(`last used ${usedAgo(iso, NOW)}`),
  'one composer: the aria ends with the exact words the card renders');
ok('ONE sentence shape: aria date clause === card words');

/* ── 7. the title's exact-stamp register (dayTime) ──────────────────── */
const y = new Date(NOW);
y.setDate(y.getDate() - 1);
y.setHours(12, 0, 0, 0);
assert.match(dayTime(y.toISOString(), undefined, NOW), /^Yesterday \d{2}:\d{2}$/,
  'the hover title speaks the exact day-clock (Yesterday HH:MM)');
ok('title register: dayTime gives the exact stamp');

/* ── 8. the share paper: byte-identity without the ledger ───────────── */
const offer = {
  id: 'o1',
  tenant_id: 't1',
  title: '₹50 off over ₹300',
  description: 'Treat the table — orders over ₹300 take ₹50 off.',
  discount_type: 'flat',
  discount_value: 50,
  min_order_amount: 300,
  is_active: true,
  usage_count: 3,
  created_at: ago(30 * 24),
  updated_at: ago(2 * 24),
};
const paperOld = buildOfferText(offer, 'QR Flow Cafe');
assert.ok(paperOld.includes('Used so far'), 'the tally row is there');
assert.ok(!paperOld.includes('Last used'), 'no ledger date → no Last used row (silence)');
const linesOld = paperOld.split('\n');
const idxOld = linesOld.findIndex((l) => l.startsWith('Used so far'));
assert.ok(idxOld >= 0, 'Used so far found');
/* two() pads BETWEEN label and value — trim alone keeps the inner gap
 * (the 225 lesson); the row reads as cells split on the padding run */
const cellsOld = (linesOld[idxOld + 1] ?? '').trim().split(/\s{2,}/);
assert.deepEqual(cellsOld, ['Status', 'Live'], 'the tally row is followed by Status — the old shape byte-intact');
ok('paper without the ledger: byte-identical to the old shape');

/* ── 9. the share paper: the Last used row with the ledger ──────────── */
const paperNew = buildOfferText(offer, 'QR Flow Cafe', iso, NOW);
const linesNew = paperNew.split('\n');
const idxNew = linesNew.findIndex((l) => l.startsWith('Used so far'));
assert.ok(idxNew >= 0, 'Used so far still there');
const lastRow = linesNew[idxNew + 1] ?? '';
const lastCells = lastRow.trim().split(/\s{2,}/);
assert.deepEqual(lastCells, ['Last used', usedAgo(iso, NOW)],
  'the paper speaks the card\'s words in the paper\'s own label/value grammar');
assert.ok(lastRow.length <= 32, 'the row fits the 32-col frame — no truncation');
assert.equal(paperOld.split('\n').length + 1, paperNew.split('\n').length,
  'the paper grows exactly one row');
/* today's redemption reads "today" on the paper too */
const paperToday = buildOfferText(offer, 'QR Flow Cafe', ago(3), NOW);
const todayRow = ((paperToday.split('\n').find((l) => l.startsWith('Last used')) ?? '')
  .trim().split(/\s{2,}/))[1] ?? '';
assert.equal(todayRow, 'today', 'a fresh redemption reads today');
ok('paper with the ledger: "Last used 2d ago" row, framed, +1 line');

console.log(`\nunit229 — ${n} asserts, all green.`);
