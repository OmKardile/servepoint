/**
 * unit281 — v5.242.0 "the money answers to the whole book".
 *
 * The round's laws, pinned:
 *   1. THE MONEY BOOK — api.ts's fetchOpenOrders reads EVERY open ticket
 *      uncapped: the trio's unpaid spoken server-side (status ≠ cancelled,
 *      status ≠ paid — the legacy leg displayStatus already honours —
 *      payment_status ≠ completed), the same shape as fetchOrders
 *      (attachItems bridges the lines). No limit, no window.
 *   2. ONE WORD AT ANY SCALE — the server predicate and displayStatus
 *      agree over the FULL (status × payment_status) matrix (behavior,
 *      not bytes): the census chip and Close-out's head-count can never
 *      disagree about what "unpaid" means.
 *   3. THE WHOLE-BOOK BASE — loaded ∪ money book, loaded wins collisions;
 *      the merge only ever APPENDS (the book is a superset of the loaded
 *      unpaid by construction). ONE base feeds FOUR voices: the visible
 *      list, the census chip (unpaid + older), the chase strip, the CSV.
 *   4. THE IN-SESSION LAW — the money book follows the ledger: settled or
 *      cancelled LEAVES the census (a kept book would count money that
 *      just landed); a split part stays, its balance rides paidSums; the
 *      kitchen lifecycle never settles money — the row keeps pace.
 *   5. FAIL-SOFT HONESTY — a failed book read dims to the loaded page's
 *      own count (null book, moneyOnly 0), never to a lie; the ledger-sum
 *      fallback (bounded to the loaded unpaid) still stands.
 *   6. THE CENSUS'S OWN VOICE — the honesty row speaks when the book
 *      holds open bills the browsing window dropped (the span ink, one
 *      text flow — the a11y-glue law); the chip's older segment wears the
 *      chase amber as a flex sibling (the blessed family).
 *   7. THE LEGACY LEG — Close-out's older-unpaid head-count grows
 *      .neq('status','paid'): the server predicate byte-equal to the trio.
 *   8. THE FIVE-SITE PIN — unit278's app-clock count holds (the census
 *      memo changed its ARRAY, never its clock).
 *   9. THE VERSION LAW in the agreement shape.
 *
 * Run: bunx vite-node scripts/unit281.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

let n = 0;
const ok = (name) => console.log(`  ok ${++n} - ${name}`);
const strip = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');

/* behavior, not bytes: the trio itself rides in from the room. */
const bills = await import('/src/components/bills/BillsScreen.tsx');
const { displayStatus } = bills;

const api = strip('../src/lib/api.ts');
const eod = strip('../src/components/eod/EodScreen.tsx');
const billsSrc = strip('../src/components/bills/BillsScreen.tsx');
const versionTs = strip('../src/version.ts');
const swJs = strip('../public/sw.js');

/* 1 — the money book: uncapped, the trio's legs, the same shape. */
{
  const fn = api.slice(
    api.indexOf('export async function fetchOpenOrders'),
    api.indexOf('v5.82.0 — one ticket by id')
  );
  assert.ok(fn.includes(".neq('status', 'cancelled')"), 'the trio leg: not cancelled');
  assert.ok(fn.includes(".neq('status', 'paid')"), 'the legacy leg: not status-paid');
  assert.ok(fn.includes(".neq('payment_status', 'completed')"), 'the trio leg: not payment-completed');
  assert.ok(!fn.includes('.limit('), 'uncapped — no limit in the money read');
  assert.ok(fn.includes(".select('*, dining_tables(table_number)')"), 'same shape: the table embed');
  assert.ok(fn.includes("order('created_at', { ascending: false })"), 'deterministic order');
  assert.ok(fn.includes('return attachItems(rows, tenantId)'), 'the items bridge rides along');
  ok('the money book: every open ticket, uncapped, the trio spoken server-side');
}

/* 2 — ONE word: the server legs and displayStatus agree on the full matrix. */
{
  const statuses = ['new', 'pending', 'preparing', 'ready', 'completed', 'cancelled', 'paid', '', null];
  const payments = ['pending', 'completed', 'refunded', '', null];
  // the server predicate, from the three legs as data (exactly what the neqs enforce)
  const serverUnpaid = (o) =>
    String(o.status) !== 'cancelled' && String(o.status) !== 'paid' && String(o.payment_status) !== 'completed';
  let checked = 0;
  for (const status of statuses) {
    for (const payment_status of payments) {
      const o = { status, payment_status };
      assert.equal(
        serverUnpaid(o),
        displayStatus(o) === 'active',
        `matrix drift at (${JSON.stringify(status)}, ${JSON.stringify(payment_status)})`
      );
      checked++;
    }
  }
  assert.equal(checked, statuses.length * payments.length, 'the full matrix, no pair skipped');
  ok(`ONE unpaid word: server legs ≡ displayStatus across ${checked} pairs`);
}

/* 3 — the whole-book base: append-only, loaded wins. */
{
  assert.match(
    billsSrc,
    /if \(!moneyBook \|\| moneyBook\.length === 0\) return orders;/,
    'a missing or empty book dims to the loaded page'
  );
  assert.match(billsSrc, /const past = moneyBook\.filter\(\(m\) => !seen\.has\(m\.id\)\);/, 'the merge appends only');
  assert.match(billsSrc, /return \[\.\.\.orders, \.\.\.past\];/, 'loaded rows keep their seat (spread order)');
  ok('the whole-book base: loaded ∪ book, loaded wins, append-only');
}

/* 4 — ONE base feeds FOUR voices. */
{
  assert.match(billsSrc, /\}, \[book, statusFilter, dateFilter, search, customFrom, customTo\]\);/, 'the visible list reads the book');
  assert.match(billsSrc, /const unpaidCount = useMemo\(\s*\n\s*\(\) => book\.filter/, 'the census count reads the book');
  assert.match(
    billsSrc,
    /book\.filter\(\s*\n\s*\(o\) => displayStatus\(o\) === 'active' && !isSameAppDay\(o\.created_at\)/,
    'the older count reads the book'
  );
  assert.match(billsSrc, /book\s*\n\s*\.filter\(\(o\) => displayStatus\(o\) === 'active'\)/, 'the chase reads the book');
  assert.match(billsSrc, /\[book, paidSums\]\s*\n\s*\);/, 'the chase follows book + ledger sums');
  ok('ONE base, four voices: list, chip, older count, chase');
}

/* 5 — the mirror follows the book (money-only rows are chargeable). */
{
  assert.match(billsSrc, /ordersRef\.current = book;/, 'ordersRef mirrors the whole book');
  ok('the mutation mirror reads the book');
}

/* 6 — the ledger sums re-key to the book; the bounded fallback stands. */
{
  assert.match(
    billsSrc,
    /fetchOpenOrders\(tenantId\)\s*\n\s*\.then\(\(mb\) => \{/,
    'the book read rides the same load'
  );
  assert.match(
    billsSrc,
    /mb\.filter\(\(o\) => displayStatus\(o\) === 'active'\)\.map\(\(o\) => o\.id\)/,
    'the sums key to the book’s open ids'
  );
  assert.match(billsSrc, /fetchOpenPaymentSums\(tenantId, unpaidIds\)/, 'the bounded fallback still stands');
  ok('every balance split-aware, including past the browsing window');
}

/* 7 — the in-session law: the book follows the ledger. */
{
  assert.match(
    billsSrc,
    /if \(kind === 'cancel' \|\| \(kind === 'pay' && coveredNow\)\) \{\s*\n\s*return prev\.filter\(\(o\) => o\.id !== orderId\);/,
    'settled or cancelled LEAVES the census'
  );
  assert.match(
    billsSrc,
    /payment_status: kind === 'pay' \? \(coveredNow \? 'completed' : 'pending'\) : patch\.payment_status,\s*\n\s*\} as Order\)\s*\n\s*: o\s*\n\s*\)\;\s*\n\s*\}\);/,
    'a split part stays, patched, not removed'
  );
  assert.match(
    billsSrc,
    /prev \? prev\.map\(\(o\) => \(o\.id === orderId \? \(\{ \.\.\.o, status: toStatus \} as Order\) : o\)\) : prev/,
    'advances keep pace (never settle money)'
  );
  ok('the in-session law: the census never waits for the next load to be true');
}

/* 8 — fail-soft honesty. */
{
  assert.match(billsSrc, /\.catch\(\(\) => setMoneyBook\(null\)\);/, 'a failed book read dims to null');
  assert.match(billsSrc, /if \(!moneyBook\) return 0;/, 'moneyOnly stays silent on a null book');
  ok('fail-soft: the loaded page’s own count, never a lie');
}

/* 9 — the census's own honesty row. */
{
  assert.match(
    billsSrc,
    /\{moneyBook && moneyOnlyCount > 0 && \(/,
    'the row speaks only when the book holds dropped bills'
  );
  assert.match(billsSrc, /The census reads the whole book — \$\{moneyOnlyCount\} open/, 'the sentence');
  assert.match(billsSrc, /text-\[#8A938C\]/, 'the span ink the quiet voices wear');
  ok('the honesty row: the whole book counted, the page scoped');
}

/* 10 — the chip's older segment wears the chase amber (ONE text flow). */
{
  assert.match(
    billsSrc,
    /\{' · '\}\s*\n\s*\{\/\* v5\.242\.0[\s\S]*?\*\/\}\s*\n\s*<span className="text-\[#B45309\]">\{olderUnpaidCount\} older<\/span>/,
    'the amber segment rides the JSX space (the Ledger dialect)'
  );
  assert.match(billsSrc, /inline-flex shrink-0 items-center gap-1 rounded-full bg-\[#FFF4DB\]/, 'the chip stays the flex chip');
  assert.match(billsSrc, /the whole book is counted \(\$\{moneyOnlyCount\} past the loaded page\)/, 'the title’s whole-book clause');
  ok('the chip: "8 unpaid · 5 older" — real spaces, the older voice in chase amber');
}

/* 11 — the legacy leg in Close-out's older-unpaid census. */
{
  assert.match(
    eod,
    /\.neq\('status', 'cancelled'\)\s*\n\s*\/\* v5\.242\.0 — the legacy leg[\s\S]*?\.neq\('status', 'paid'\)\s*\n\s*\.neq\('payment_status', 'completed'\)/,
    'the three legs, in order, in the head-count'
  );
  ok("Close-out's head-count speaks the trio's exact unpaid");
}

/* 12 — the five-site pin holds (unit278): the census changed its ARRAY, not its clock. */
{
  const sites = (billsSrc.match(/isSameAppDay(As)?\(/g) || []).length;
  assert.equal(sites, 5, `Bills: five direct app-clock sites — found ${sites}`);
  ok('unit278’s five-site pin holds through the whole-book round');
}

/* 13 — the version law in the agreement shape. */
{
  const v = versionTs.match(/APP_VERSION = '([\d.]+)'/)?.[1];
  const sw = swJs.match(/const VERSION = "servepoint-v([\d.]+)-r1"/)?.[1];
  assert.ok(v, 'version.ts speaks a word');
  assert.equal(v, sw, 'version.ts and sw.js agree');
  ok(`the version law: ${v} agreed on both homes`);
}

console.log(`\nunit281: ${n} checks green`);
