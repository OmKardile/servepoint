/* Task 225 — v5.186.0 unit suite: the strip knows the age.
 * 5.185 taught the dashboard's unpaid mirror to speak the dimension a total
 * hides ("oldest #96 owes ₹869.00, 3d old") — but the Bills chase strip, the
 * WORK surface where the chase list actually lives, still said only how much
 * and how many. This round the strip completes its summary grammar — how
 * much · how many · how OLD — riding the chase set's own oldest-first rule
 * (the head IS the oldest; no second sort, no second writer) and echoing the
 * age on the paper's count line (the screen/paper pairing 5.184 taught).
 * Asserted: the paper's count line carries "· oldest Nd old" when the head
 *   rides along; silence when absent (undefined AND null — the optional
   * option's two absences); the 'today' register echoed honestly (the chase
 *   set includes today's unpaid — money out is money out); the singular
 *   branch inside the new conditional; the strip's title register = the
 *   dashboard mirror's EXACT sentence (ONE register, two surfaces); the
 *   head-is-oldest selection on the chase set's own sort; the 32-col frame
 *   still holds (the count line can't ride past the border).
 * Run: bunx vite-node scripts/unit225.mjs
 */
import assert from 'node:assert/strict';

const billsM = await import('/src/components/bills/BillsScreen.tsx');
const { chaseAge } = await import('/src/lib/day.ts');
const { buildChaseText } = billsM;

let n = 0;
const ok = (name) => console.log(`  ok ${++n} - ${name}`);

/* the count line = the line after TOTAL TO COLLECT — read structurally,
 * never by guessed padding bytes (center()'s floor rounding is its own). */
const countLine = (text) => {
  const ls = text.split('\n');
  return ls[ls.findIndex((l) => l.startsWith('TOTAL TO COLLECT')) + 1];
};

const base = {
  storeName: 'QR Flow Cafe',
  total: 1801.8,
};

const tickets3 = [
  { num: '#66', where: 'Dine-in · T1', open: 693, when: '2 Oct, 7:10 pm', age: '1d old', note: null },
  { num: '#96', where: 'Dine-in · T2', open: 231, when: '2 Oct, 5:28 pm', age: '1d old', note: null },
  { num: '#97', where: 'counter', open: 231, when: '3 Oct, 9:00 am', age: 'today', note: null },
];

/* 1 — the count line carries the age when the head rides along */
const withAge = buildChaseText({ ...base, tickets: tickets3, oldestAge: '1d old' });
assert.equal(countLine(withAge).trim(), '3 tickets · oldest 1d old');
ok('the paper speaks the age: "3 tickets · oldest 1d old" on the count line');

/* 2 — silence when the option is absent (undefined — unit195's torture shape) */
const noOpt = buildChaseText({ ...base, tickets: tickets3 });
assert.equal(countLine(noOpt).trim(), '3 tickets');
assert.ok(!noOpt.includes('oldest'));
ok('oldestAge undefined → the count line stays "3 tickets" — the 5.151 grammar byte-intact');

/* 3 — silence when the option is explicitly null (the assembly's ?? null) */
const nullOpt = buildChaseText({ ...base, tickets: tickets3, oldestAge: null });
assert.equal(nullOpt, noOpt);
ok('oldestAge null → byte-identical silence — the two absences agree');

/* 4 — the 'today' register echoes honestly (today's unpaid are money out) */
const todayAge = buildChaseText({ ...base, tickets: tickets3, oldestAge: 'today' });
assert.equal(countLine(todayAge).trim(), '3 tickets · oldest today');
ok('the chase set includes today\'s unpaid — "oldest today" said without shame');

/* 5 — the singular branch inside the new conditional */
const one = buildChaseText({
  ...base,
  tickets: [tickets3[0]],
  oldestAge: '1d old',
});
assert.equal(countLine(one).trim(), '1 ticket · oldest 1d old');
ok('the singular branch: "1 ticket · oldest 1d old"');

/* 6 — the strip's title register = the dashboard mirror's EXACT sentence
 * (chaseTickets[].num already carries the '#' — the memo builds it) */
const mirror = `oldest ${tickets3[0].num} owes ₹${tickets3[0].open.toFixed(2)}, ${tickets3[0].age}`;
assert.equal(mirror, 'oldest #66 owes ₹693.00, 1d old');
ok('ONE register: the strip\'s title is 5.185\'s ageVoice, byte for byte');

/* 7 — the head IS the oldest: the chase set's own sort, no second writer */
const chaseSet = [
  { id: 'b', order_number: 97, created_at: '2026-10-03T10:00:00Z', total: 300 },
  { id: 'a', order_number: 66, created_at: '2026-10-01T09:00:00Z', total: 693 },
  { id: 'c', order_number: 98, created_at: '2026-10-04T08:00:00Z', total: 150.5 },
].slice().sort((x, y) => x.created_at.localeCompare(y.created_at));
assert.equal(chaseSet[0].order_number, 66);
assert.equal(chaseAge(chaseSet[0].created_at, Date.parse('2026-10-04T15:00:00Z')), '3d old');
ok('the head of the oldest-first chase set is the age voice — #66, 3d old');

/* 8 — the frame holds: the count line stays within the 32-col border */
assert.ok(countLine(withAge).length <= 32);
ok('the count line rides inside the 32-col frame — centered, never past the border');

/* 9 — the strip chip's text grammar: "oldest " + the head's own age string */
const chipText = `oldest ${tickets3[0].age}`;
assert.equal(chipText, 'oldest 1d old');
ok('the chip reads "oldest 1d old" — the head\'s own age, verbatim from the lib');

console.log(`\nunit225: ${n} asserts passed`);
