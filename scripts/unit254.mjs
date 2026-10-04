/* Task 254 — v5.215.0 unit suite: the offers tab keeps the week's tally.
 * The Guests → Offers chip said only the standing state — "2 live · 0
 * paused — active offers show at the counter and on the guest QR menu" —
 * and never answered the owner's actual weekly question: is the discount
 * pulling its weight? The chip now grows the tab's own window voice: the
 * week's rides and the money they gave away, composed from the SAME read
 * the drawer doors slice (no second fetch), timed by lib/appday's
 * lastNDaysMs — the SAME week the movers' medallion and Reports' "Last n"
 * quote (two surfaces quoting the week can never fork), and costed by the
 * family's own reducer (guestGiveaway — one arithmetic across three
 * surfaces). The honesty rules the ledger family already taught hold:
 * an unread ledger renders NO clause (silence, never an invented zero),
 * a read ledger with an empty week speaks "no rides this week" (the dead
 * week is the fact the owner most needs to see — the scorecard's own
 * rule), and an empty week's money clause stays silent (the chip's own
 * 5.197 rule: silence is not zero).
 * Asserted: ridesInWindow's bucketing byte-cases (in-window kept,
 * out-of-window dropped, inclusive boundaries, malformed dates fall out
 * honestly, the read's own newest-first order preserved); the tally's
 * family agreement (given == guestGiveaway's sum over the window's rows,
 * count == rows.length); the chip's sentence bytes for all three states
 * (rides / no rides / unread silence); source guards — ONE clock
 * (lastNDaysMs imported from lib/appday, no local window math), the memo
 * composes ridesInWindow + guestGiveaway (no second arithmetic), the
 * clause rides tabular-nums + the deep ink + spFadeIn, the prop threading
 * intact, and the old standing-state sentence's tail byte-identical.
 * Run: bunx vite-node scripts/unit254.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

let n = 0;
const ok = (name) => console.log(`  ok ${++n} - ${name}`);

const { ridesInWindow, guestGiveaway } = await import('/src/components/customers/CustomersScreen.tsx');
const { lastNDaysMs } = await import('/src/lib/appday.ts');

const strip = (p) =>
  readFileSync(new URL(p, import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => !/^\s*(\*|\/\*|\/\/)/.test(l))
    .join('\n');

const crmCode = strip('../src/components/customers/CustomersScreen.tsx');
const dayCode = strip('../src/lib/appday.ts');

/* the ledger row's exact shape (api's OfferRedemptionRow projection) */
const row = (id, createdAt, discountAmount) => ({
  offerId: 'f50',
  title: '₹50 off over ₹300',
  discountType: 'flat',
  discountValue: 50,
  isActive: true,
  discountAmount,
  orderTotal: 400,
  customerPhone: null,
  createdAt,
});

/* ── 1 — the bucket's byte-cases ─────────────────────────────────────── */
const w = lastNDaysMs(7, new Date('2026-10-05T12:00:00Z'));

/* inside the window: this morning */
const inWeek = row('a', '2026-10-05T03:30:00.000Z', 50);
/* six days back, still inside the 7-day tail */
const inWeekFar = row('b', '2026-09-29T21:10:00.000Z', 22.5);
/* eight days back — outside */
const stale = row('c', '2026-09-26T09:00:00.000Z', 40);
/* malformed date — falls out of every window honestly */
const broken = row('d', 'not-a-date', 10);

const rows = ridesInWindow([stale, inWeekFar, broken, inWeek], w.startMs, w.endMs);
assert.deepEqual(rows.map((r) => r.createdAt), [inWeekFar.createdAt, inWeek.createdAt]);
ok('bucket: in-window kept, out-of-window + malformed dropped');

/* the read's own newest-first order preserved — a local re-sort would be a second clock */
assert.deepEqual(rows.map((r) => r.discountAmount), [22.5, 50]);
ok('bucket: read order preserved (no re-sort)');

/* boundaries are inclusive: a row exactly at startMs or endMs rides */
const atStart = row('s', new Date(w.startMs).toISOString(), 5);
const atEnd = row('e', new Date(w.endMs).toISOString(), 7);
assert.equal(ridesInWindow([atStart, atEnd], w.startMs, w.endMs).length, 2);
ok('bucket: boundaries inclusive (startMs and endMs both ride)');

assert.equal(ridesInWindow([], w.startMs, w.endMs).length, 0);
ok('bucket: empty ledger → empty window (silence, not an error)');

/* ── 2 — the family agreement: ONE money arithmetic ──────────────────── */
const give = guestGiveaway(rows);
assert.ok(give && give.count === 2);
assert.equal(give.given, 72.5); /* 22.5 + 50 — string paise coerced at the boundary */
ok('family: guestGiveaway sums the window\'s rides (22.5 + 50 = ₹72.50)');

/* the empty week's money clause stays silent — the chip's own 5.197 rule */
const emptyWeek = ridesInWindow([stale], w.startMs, w.endMs);
assert.equal(guestGiveaway(emptyWeek), null);
ok('family: empty week → guestGiveaway null → no money clause');

/* ── 3 — the chip's sentence bytes (three states) ────────────────────── */
/* the standing state's tail is byte-identical to the old line */
assert.ok(crmCode.includes("' — active offers show at the counter and on the guest QR menu.'"));
ok('chip: standing tail byte-identical ("— active offers show …")');

/* the week clause's count grammar: ride / rides / no */
assert.ok(crmCode.includes("{weekTally.count === 0 ? 'no' : weekTally.count}"));
assert.ok(crmCode.includes("{weekTally.count === 1 ? 'ride' : 'rides'} this week"));
ok('chip: count grammar speaks ride / rides / no');

/* the money register reuses the family's voice, through formatMoney */
assert.ok(crmCode.includes('{formatMoney(weekTally.given)} given away'));
ok('chip: money clause speaks formatMoney + "given away"');

/* the honest zero renders when the ledger is read; the clause never
 * renders when the tally is null (an unread ledger never becomes an
 * invented zero) */
assert.ok(crmCode.includes('{weekTally && ('));
ok('chip: unread ledger renders no clause (null-guard)');

/* ── 4 — source guards: ONE clock, ONE arithmetic, the styling ───────── */
/* ONE clock — the window comes from lib/appday, no local Date math */
assert.ok(crmCode.includes("lastNDaysMs } from '../../lib/appday'"));
assert.ok(dayCode.includes('export function lastNDaysMs'));
ok('guard: lastNDaysMs is the ONE week clock (lib/appday)');

/* the memo composes the family — no second arithmetic, no second fetch */
assert.ok(crmCode.includes('const rows = ridesInWindow(redemptions, w.startMs, w.endMs);'));
assert.ok(crmCode.includes('guestGiveaway(rows)?.given ?? null'));
ok('guard: memo composes ridesInWindow + guestGiveaway (one arithmetic)');

/* the memo's silence rule: null ledger → null tally */
assert.ok(crmCode.includes('if (!redemptions) return null;'));
ok('guard: unread ledger → null tally (never an invented zero)');

/* the clause rides the tabular table of its own + the deep ink + the
 * honest lines' arrival */
assert.ok(crmCode.includes('font-semibold tabular-nums text-[#0F3D3E]'));
assert.ok(crmCode.includes("animation: 'spFadeIn 200ms ease-out'"));
ok('guard: clause rides tabular-nums + deep ink + spFadeIn');

/* the prop threading: the tally rides from the screen into the tab */
assert.ok(crmCode.includes('weekTally={weekTally}'));
assert.ok(crmCode.includes('weekTally: { count: number; given: number | null } | null;'));
ok('guard: prop threading intact (screen → tab, typed nullable)');

/* the pure bucket is exported for the suite to own */
assert.ok(crmCode.includes('export function ridesInWindow('));
ok('guard: ridesInWindow exported pure (the suite owns the bucketing)');

/* regression — the older window voices did not move */
assert.ok(crmCode.includes('export function redemptionsByOffer('));
assert.ok(crmCode.includes('export function redemptionsByPhone('));
assert.ok(crmCode.includes('export function guestGiveaway('));
ok('guard: the ledger family (5.206/5.208/5.209) intact');

console.log(`\nPASS ${n} checks — unit254 (v5.215.0 the offers tab keeps the week's tally)`);
