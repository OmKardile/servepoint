const m = await import('/src/components/reports/ReportsScreen.tsx');
const { buildKitchenSpeedText } = m;

let fails = 0;
const assert = (name, cond) => {
  console.log(`${cond ? 'PASS' : 'FAIL'} — ${name}`);
  if (!cond) fails++;
};
const maxCol = (t) => Math.max(...t.split('\n').map((l) => l.length));

// ── case 1: live-like single ticket, over SLA, no own clock, waited-for dish
const t1 = buildKitchenSpeedText({
  storeName: 'QR Flow Cafe',
  rangeLabel: 'Last 7 days',
  timed: 1,
  avgMin: 76,
  medianMin: 76,
  slowest: { orderNumber: 55, minutes: 76 },
  breaches: 1,
  tickets: [{ orderNumber: 55, minutes: 76, firedAt: '2 Oct, 5:45 pm', over: true }],
  dishes: [
    { name: 'Flat White · Large', tickets: 1, avgMin: 76, slowestMin: 76, own: null, waitedFor: true },
  ],
});
console.log('--- case 1 ---\n' + t1 + '\n--------------');
assert('store centered on top', t1.split('\n')[0].trim() === 'QR Flow Cafe' && t1.split('\n')[0].startsWith('  '));
assert('heading voice', t1.includes('KITCHEN SPEED · LAST 7 DAYS'));
assert('average row', /Average\s+1h 16m/.test(t1));
assert('median row', /Median\s+1h 16m/.test(t1));
assert('slowest row names the ticket', /Slowest\s+#55 · 1h 16m/.test(t1));
assert('SLA headline = 1', /Over the 10-min SLA\s+1/.test(t1));
assert('ticket row with duration', /#55\s+1h 16m/.test(t1));
assert('fired detail rides', t1.includes('fired 2 Oct, 5:45 pm'));
assert('over-SLA badge on breach ticket', t1.includes('over SLA'));
assert('slow dish heading', t1.includes('THE SLOW DISH'));
assert('waited-for badge on first dish', t1.includes('the pass waits for this'));
assert('no own-clock line when own is null', !t1.includes('own clock'));
assert('small-sample prose rides at timed=1', t1.includes('small sample — the clock needs'));
assert('footer signature', t1.includes('· · · end of kitchen speed · · ·'));
assert('Shared footer', /Shared \d{1,2}:\d{2}/.test(t1) && t1.includes('IST'));
assert('case 1 max 32 columns', maxCol(t1) <= 32);

// ── case 2: healthy sheet — zero breaches, own clock present, big sample (no prose)
const t2 = buildKitchenSpeedText({
  storeName: 'Test Cafe',
  rangeLabel: 'Today',
  timed: 9,
  avgMin: 6.5,
  medianMin: 6,
  slowest: { orderNumber: 12, minutes: 9.25 },
  breaches: 0,
  tickets: [
    { orderNumber: 12, minutes: 9.25, firedAt: '4 Oct, 12:10 pm', over: false },
    { orderNumber: 9, minutes: 5.5, firedAt: '4 Oct, 11:30 am', over: false },
  ],
  dishes: [
    { name: 'Truffle Parmesan Fries', tickets: 4, avgMin: 8.75, slowestMin: 9.25, own: { avgMin: 7.2, n: 3 }, waitedFor: true },
    { name: 'Flat White', tickets: 6, avgMin: 4.1, slowestMin: 5.5, own: null, waitedFor: false },
  ],
});
console.log('--- case 2 ---\n' + t2 + '\n--------------');
assert('honest zero on SLA headline', /Over the 10-min SLA\s+0/.test(t2));
assert('honest zero in totals', /\b0 over SLA\b/.test(t2));
assert('own-clock voice when ticks exist', t2.includes('own clock avg 7m 12s') && /(^|\n)\s*3 ticked/.test(t2));
assert('second dish has no waited-for badge', !t2.split('2. Flat White')[1].includes('the pass waits for this'));
assert('no small-sample prose at timed=9', !t2.includes('small sample'));
assert('duration voice is seconds-true', t2.includes('6m 30s'));
assert('case 2 max 32 columns', maxCol(t2) <= 32);

// ── case 3: truncation — long dish name never breaks the frame
const t3 = buildKitchenSpeedText({
  storeName: 'A Very Long Store Name That Truncates The Heading',
  rangeLabel: 'Last 30 days',
  timed: 4,
  avgMin: 12,
  medianMin: 11,
  slowest: { orderNumber: 7, minutes: 20 },
  breaches: 2,
  tickets: [{ orderNumber: 7, minutes: 20, firedAt: '1 Oct, 9:15 am', over: true }],
  dishes: [
    { name: 'Super Calfragilistic Expialidocious Dish Name Edition', tickets: 2, avgMin: 14, slowestMin: 20, own: null, waitedFor: true },
  ],
});
assert('case 3 max 32 columns under truncation', maxCol(t3) <= 32);
assert('long dish name truncated with ellipsis', t3.includes('…'));

console.log(fails === 0 ? '\nALL ASSERTS PASS' : `\n${fails} ASSERT(S) FAILED`);
process.exit(fails === 0 ? 0 : 1);
