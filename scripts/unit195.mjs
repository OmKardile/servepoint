/* Task 195 — builder torture suite + guest-voices asserts.
 * Part A: EVERY chat twin must hold the 32-column frame under a hostile
 *         40-char store name and over-long data fields (the 194 lesson,
 *         now proven across the whole arc).
 * Part B: buildRatingsText semantic asserts (histogram zeros, recover
 *         list voices, caps, honest empty). */
const LONG = 'A Very Long Store Name That Blows Unhardened Frames';
const LONGDISH = 'Super Calfragilistic Expialidocious Dish Name Edition';
const LONGCOMMENT = 'an over-long guest comment that rambles on and on about coffee temperature and seat comfort';

let fails = 0;
const assert = (name, cond) => {
  console.log(`${cond ? 'PASS' : 'FAIL'} — ${name}`);
  if (!cond) fails++;
};
const maxCol = (t) => Math.max(0, ...t.split('\n').map((l) => l.length));
const torture = (name, fn) => {
  try {
    const t = fn();
    const mc = maxCol(t);
    assert(`torture ${name} (max ${mc} cols)`, mc <= 32);
  } catch (e) {
    assert(`torture ${name} — THREW: ${e.message}`, false);
  }
};

const reports = await import('/src/components/reports/ReportsScreen.tsx');
const menuM = await import('/src/components/menu/MenuScreen.tsx');
const receiptM = await import('/src/components/bills/ReceiptPrint.tsx');
const billsM = await import('/src/components/bills/BillsScreen.tsx');
const invM = await import('/src/components/inventory/InventoryScreen.tsx');
const eodM = await import('/src/components/eod/EodScreen.tsx');
const custM = await import('/src/components/customers/CustomersScreen.tsx');

/* ── Part A: torture ─────────────────────────────────────────────── */
torture('buildReportText', () =>
  reports.buildReportText({
    storeName: LONG, rangeLabel: 'Last 7 days', windowLabel: 'window', tz: 'IST',
    gross: 9267.3, gst: 500, net: 8767.3, orders: 29, items: 39, avgTicket: 319.5,
    cancelled: 1, paidNet: 8700, paidCount: 26, cogs: 1500, margin: 7200, marginPct: 82,
    mix: [{ method: 'UPI', count: 20, amount: 7000 }],
    unpaidAmt: 567.3, unpaid: 3, splitTickets: 2,
    top: [{ name: LONGDISH, units: 30, revenue: 8580 }],
    bestDay: { label: 'Fri 3 Oct', gross: 3000 }, peakHour: { label: '5 pm', gross: 1200 },
  }));

torture('buildTopText', () =>
  reports.buildTopText({
    storeName: LONG, rangeLabel: 'Last 7 days',
    items: [{ name: LONGDISH, units: 37, revenue: 8580, sharePct: 95, marginPct: 84, kept: 7248 }],
    earners: [{ name: LONGDISH, kept: 7248, marginPct: 84, sellsRank: 1 }],
    itemsSold: 39,
  }));

torture('buildOfferScoreText', () =>
  reports.buildOfferScoreText({
    storeName: LONG, rangeLabel: 'Last 7 days',
    offers: [{
      title: 'An Extremely Long Offer Title That Keeps Going And Going', voice: '10% off',
      isActive: true, uses: 3, revenue: 997.5, discount: 150,
      lastRode: '3 Oct, 4:58 pm',
    }],
    totalUses: 4, totalDiscount: 194, totalRevenue: 1413.3,
  }));

torture('buildKitchenSpeedText', () =>
  reports.buildKitchenSpeedText({
    storeName: LONG, rangeLabel: 'Last 7 days',
    timed: 1, avgMin: 76, medianMin: 76, slowest: { orderNumber: 55, minutes: 76 },
    breaches: 1,
    tickets: [{ orderNumber: 55, minutes: 76, firedAt: '2 Oct, 5:45 pm', over: true }],
    dishes: [{ name: LONGDISH, tickets: 1, avgMin: 76, slowestMin: 76, own: { avgMin: 76, n: 1 }, waitedFor: true }],
  }));

torture('buildRatingsText', () =>
  reports.buildRatingsText({
    storeName: LONG, rangeLabel: 'Last 7 days',
    avg: 4.3, avgWord: 'good — keep going', count: 3, commentCount: 2,
    stars: [0, 0, 0, 2, 1],
    comments: [{ rating: 4, orderNumber: 55, text: LONGCOMMENT }],
    low: [{
      name: 'An Extremely Long Guest Name That Keeps Going', phone: '98765 43210',
      rating: 3, orderNumber: 71, when: '3 Oct, 6:05 pm', comment: LONGCOMMENT,
    }, {
      name: null, phone: null, rating: 3, orderNumber: 60, when: '2 Oct, 9:00 am', comment: null,
    }],
    lowTotal: 1,
  }));

torture('buildMenuText', () =>
  menuM.buildMenuText({
    storeName: LONG,
    cats: [{
      name: 'COFFEE',
      items: [{
        name: LONGDISH, price: 220, description: LONGCOMMENT,
        soldOut: false, nonVeg: false, options: ['Large +₹50.00'],
      }],
    }],
  }));

torture('buildReceiptText', () =>
  receiptM.buildReceiptText({
    storeName: LONG, orderNumber: 55, orderType: 'dine-in', tableLabel: 'T2',
    createdAt: '3 Oct, 4:58 pm',
    items: [{ name: LONGDISH, qty: 2, lineTotal: 440, addons: [{ name: 'An Overly Long Addon Name', price: 20 }] }],
    subtotal: 460, tax: 46, total: 506, paymentLabel: 'UPI', isPaid: true,
  }));

torture('buildReorderText', () =>
  invM.buildReorderText({
    storeName: LONG, coverDays: 7,
    buys: [{ name: LONGDISH, qty: '2.0', unit: 'kg', est: 560 }],
    estTotal: 560, watching: [{ name: LONGDISH, daysLeft: 2 }],
  }));

torture('buildZReportText', () =>
  eodM.buildZReportText({
    storeName: LONG, dateIso: '2026-10-03', orders: 29, gross: 9267.3, paid: 8700,
    unpaid: 567.3, unpaidTickets: 3, gst: 500, cogs: 1500, margin: 7200,
    mix: [{ method: 'UPI', amount: 7000 }], cancelled: 1, printedBy: 'QR Owner',
  }));

torture('buildChaseText', () =>
  billsM.buildChaseText({
    storeName: LONG,
    tickets: [{
      num: '#96', where: 'Dine-in · T2', open: 35, when: '2 Oct, 8:30 am',
      age: '35h', note: 'An extremely long chase note that keeps going and going and going',
    }],
    total: 2,
  }));

torture('buildOfferText', () =>
  custM.buildOfferText({
    id: 'o1', tenant_id: 't1',
    title: 'An Extremely Long Offer Title That Keeps Going And Going',
    description: LONGCOMMENT,
    discount_type: 'percent', discount_value: 10, min_order_amount: 199,
    is_active: true, usage_count: 12, created_at: '', updated_at: '',
  }, LONG));

/* ── Part B: guest-voices semantics ──────────────────────────────── */
const { buildRatingsText } = reports;

const t1 = buildRatingsText({
  storeName: 'QR Flow Cafe', rangeLabel: 'Last 7 days',
  avg: 4.3, avgWord: 'good — keep going', count: 3, commentCount: 2,
  stars: [0, 0, 0, 2, 1],
  comments: [
    { rating: 4, orderNumber: 55, text: 'Large flat white was perfect, hot and quick' },
    { rating: 5, orderNumber: 63, text: 'ordering from the table just worked' },
  ],
  low: [],
  lowTotal: 0,
});
console.log('--- guest voices (healthy) ---\n' + t1 + '\n--------------');
assert('avg row aligned', /Average\s+4\.3 \/ 5/.test(t1));
assert('card voice rides', t1.includes('good — keep going'));
assert('count + comments voice', t1.includes('3 ratings · 2 with comments'));
assert('histogram speaks non-zero stars', t1.includes('5★ ×1') && t1.includes('4★ ×2'));
assert('histogram hides zero rows', !t1.includes('3★ ×0'));
assert('quotes wrapped full-width', t1.includes('“Large flat white was perfect,'));
assert('quote detail star + ticket', /4★ · #55/.test(t1));
assert('honest empty recover line', t1.includes('no low stars in this window —') && t1.includes('nothing to recover'));
assert('footer signature', t1.includes('· · · end of guest voices · · ·'));
assert('healthy max 32 cols', maxCol(t1) <= 32);

const t2 = buildRatingsText({
  storeName: 'QR Flow Cafe', rangeLabel: 'Today',
  avg: 2.6, avgWord: 'rough — recover today', count: 4, commentCount: 1,
  stars: [1, 2, 1, 0, 0],
  comments: [{ rating: 2, orderNumber: 71, text: 'cold coffee' }],
  low: [
    { name: 'Maya Iyer', phone: '98765 43210', rating: 2, orderNumber: 71, when: '3 Oct, 6:05 pm', comment: 'cold coffee, sorry folks' },
    { name: null, phone: '9812345678', rating: 3, orderNumber: 66, when: '3 Oct, 1:10 pm', comment: null },
    { name: null, phone: null, rating: 3, orderNumber: 60, when: '2 Oct, 9:00 am', comment: null },
  ],
  lowTotal: 7,
});
console.log('--- guest voices (recover) ---\n' + t2 + '\n--------------');
assert('recover list heading', t2.includes('THE RECOVER LIST'));
assert('named guest with star', /Maya Iyer\s+2★/.test(t2));
assert('phone rides under name', t2.includes('98765 43210'));
assert('phone-only guest named by phone', /9812345678\s+3★/.test(t2));
assert('anonymous voice', t2.includes('anonymous ticket'));
assert('no-comment voice', t2.includes('no comment — the stars spoke'));
assert('recover comment quoted', t2.includes('“cold coffee, sorry folks”'));
assert('over-cap honesty', t2.includes('+ 4 more in the CSV'));
assert('recover max 32 cols', maxCol(t2) <= 32);

console.log(fails === 0 ? '\nALL ASSERTS PASS' : `\n${fails} ASSERT(S) FAILED`);
process.exit(fails === 0 ? 0 : 1);
