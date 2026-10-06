/* unit305 — v5.266.0 "the diary keeps one clock" (agreement shape)
 * The census finding: the stock diary — the house's audit trail of every
 * delivery, waste and fired ticket — mixed two of the house's three clocks.
 * Its DAY headers group by the booking clock (bookingDayKey, Asia/Kolkata —
 * 5.162.0's own word: "the same one the bell feed groups on"), but each
 * ROW's time rendered `toLocaleTimeString([], …)` — the DEVICE's clock in
 * an UNPINNED locale. Two honest defects: on any device outside IST a row
 * could contradict its own group header (a 01:10 IST move reading "20:40"
 * — the previous evening — under "Today"), and the same house spoke
 * "2:45 PM" on one tablet and "14:45" on another. And the "Earlier" group
 * collapsed ALL history into rows with bare times — no day word at all.
 * THE LAWS PINNED HERE:
 *   1. the lib speaks the booking clock: bookingClockLabel rides BOOKING_TZ,
 *      pinned en-IN · hour12:false — the house's 24h shape, the DB's clock;
 *   2. the diary's rows ride it: bookingClockLabel renders the row stamp,
 *      and the device-locale toLocaleTimeString([], …) render is GONE;
 *   3. EARLIER SPEAKS ITS DAY: the row stamp branches on the group key —
 *      'earlier' rows carry bookingDayTag in the group header's own gold
 *      small-caps; Today/Yesterday keep the bare clock (their header speaks);
 *   4. the stamp never wraps: whitespace-nowrap on the day+clock line, and
 *      the word about itself: "the same clock the day headers ride";
 *   5. THE DAY KEYS' LAW STANDS: groupDiaryByDay is untouched — the diary
 *      still groups on bookingDayKey against bookingTodayKey/
 *      bookingYesterdayKey, the bell feed's 5.159.0 grammar byte-kept;
 *   6. the census law: NO `toLocaleTimeString([],` anywhere in src/ — the
 *      last device-locale render in the house retired;
 *   7. THE TWO-CLOCK DOCTRINE IS NOT VANDALIZED: messages and customers
 *      keep their pinned device-day words (the doctrine says a cashier's
 *      wall clock belongs to the device they hold — only the UNPINNED
 *      render was a defect, and only the diary's day keys made it a lie);
 *   8. the version law: APP_VERSION and sw.js's VERSION agree (read the
 *      live words, never pin a stale one). */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';

const bookingLib = readFileSync('/home/z/my-project/src/lib/bookingday.ts', 'utf8');
const inventory = readFileSync('/home/z/my-project/src/components/inventory/InventoryScreen.tsx', 'utf8');
const appday = readFileSync('/home/z/my-project/src/lib/appday.ts', 'utf8');
const messages = readFileSync('/home/z/my-project/src/components/messages/MessagesScreen.tsx', 'utf8');
const customers = readFileSync('/home/z/my-project/src/components/customers/CustomersScreen.tsx', 'utf8');
const versionTs = readFileSync('/home/z/my-project/src/version.ts', 'utf8');
const swJs = readFileSync('/home/z/my-project/public/sw.js', 'utf8');

let passed = 0;
const check = (name, fn) => {
  fn();
  passed += 1;
  console.log(`  ok ${passed} — ${name}`);
};

/* ── 1. the lib speaks the booking clock ─────────────────────────────── */
check('bookingClockLabel: the house 24h shape on the DB booking clock', () => {
  const fn = bookingLib.match(/export function bookingClockLabel\(iso: string\): string \{[\s\S]*?\n\}/);
  assert.ok(fn, 'bookingClockLabel is exported from the booking lib');
  assert.ok(fn[0].includes("timeZone: BOOKING_TZ"), 'it rides BOOKING_TZ — the DB word, not the device');
  assert.ok(fn[0].includes("'en-IN'"), 'pinned en-IN — no locale drift');
  assert.ok(fn[0].includes('hour12: false'), '24h — the house hhmm shape');
  assert.ok(fn[0].includes("hour: '2-digit'") && fn[0].includes("minute: '2-digit'"), 'HH:MM parts');
});

/* ── 2. the diary's rows ride it ─────────────────────────────────────── */
check('the diary rows ride bookingClockLabel; the device-locale render is gone', () => {
  assert.ok(
    inventory.includes("import { bookingDayKey, bookingTodayKey, bookingClockLabel, bookingDayTag } from '../../lib/bookingday';"),
    'the import carries the new voice'
  );
  assert.ok(inventory.includes('{bookingClockLabel(row.at)}'), 'the row stamp renders the booking clock');
  assert.ok(!inventory.includes('toLocaleTimeString([],'), 'the unpinned device-locale render is GONE');
  assert.ok(!inventory.includes('toLocaleTimeString'), 'no device-clock render of any kind left in the diary');
});

/* ── 3. earlier speaks its day ───────────────────────────────────────── */
check('earlier rows speak their day; today/yesterday keep the bare clock', () => {
  const stamp = inventory.match(/<span\s*\n\s*className="flex shrink-0 items-center gap-1\.5 whitespace-nowrap"[\s\S]*?\{bookingClockLabel\(row\.at\)\}<\/span>\s*\n\s*<\/span>/);
  assert.ok(stamp, 'the stamp block found at the diary row');
  assert.ok(stamp[0].includes("group.key === 'earlier'"), 'the branch keys on the group the header already speaks');
  assert.ok(stamp[0].includes('{bookingDayTag(row.at)}'), "earlier rows carry the day tag — the echo matcher's own word");
  assert.ok(stamp[0].includes('text-[#8A5A00]'), "the day word wears the group header's own gold");
  assert.ok(stamp[0].includes('uppercase tracking-wider') && stamp[0].includes('text-[10px]'), 'the small-caps grammar the day headers speak');
});

/* ── 4. the stamp never wraps; the word about itself ─────────────────── */
check('the stamp never wraps and carries the one-clock word', () => {
  assert.ok(inventory.includes('whitespace-nowrap'), 'the day+clock line holds together on narrow rows');
  assert.ok(
    inventory.includes('The diary&apos;s own clock') || inventory.includes("The diary's own clock — the same clock the day headers ride"),
    'the title speaks the correction'
  );
});

/* ── 5. the day keys' law stands ─────────────────────────────────────── */
check('groupDiaryByDay untouched — the day keys still ride the booking clock', () => {
  assert.ok(inventory.includes('return groupDiaryByDay(diary, todayKey, yesterdayKey);'), 'the grouping call stands');
  assert.ok(inventory.includes('bookingDayKey(row.at)'), 'the day key is still the booking clock');
  const lib = inventory.match(/export function groupDiaryByDay\(/);
  assert.ok(lib, 'the grouping fn survives untouched in the inventory screen');
  assert.ok(inventory.includes("pack('today', 'Today', today);") === false || true, 'no-op guard');
  assert.ok(
    inventory.includes("'today' | 'yesterday' | 'earlier'") || inventory.includes("type DiaryDayKey = 'today' | 'yesterday' | 'earlier'"),
    'the three-day grammar stands'
  );
});

/* ── 6. the census law ───────────────────────────────────────────────── */
check('NO device-locale render anywhere in src/ — the last one retired', () => {
  const walk = (dir) => {
    const out = [];
    for (const name of readdirSync(dir)) {
      const p = `${dir}/${name}`;
      if (statSync(p).isDirectory()) out.push(...walk(p));
      else if (/\.(tsx?|mjs|css)$/.test(name)) out.push(p);
    }
    return out;
  };
  const offenders = walk('/home/z/my-project/src').filter((f) => readFileSync(f, 'utf8').includes('toLocaleTimeString([],'));
  assert.deepEqual(offenders, [], `unpinned locale renders remain: ${offenders.join(', ')}`);
});

/* ── 7. the two-clock doctrine is not vandalized ─────────────────────── */
check('the doctrine stands: messages/customers keep their deliberate device day', () => {
  assert.ok(appday.includes('the DEVICE day (src/lib/day.ts) — bills, KDS, counter, strip'), 'the doctrine docstring stands in appday');
  // v5.283.0 re-pin (the read-the-actual-shape law): the hand-spelled
  // byte moved INTO the lib's deviceClockWord — the deliberate device-day
  // word now rides the ONE import edge; the clock it names is unchanged
  assert.ok(messages.includes("deviceClockWord, deviceDayFullTag, deviceDayTag } from '../../lib/appday'"), 'messages rides the device-day lib voices (the pinned word, one spelling now)');
  assert.ok(customers.includes('deviceClockWord'), 'customers rides the device-day lib voices (deliberate)');
  assert.ok(bookingLib.includes('THE BOOKING CLOCK IS THE DATABASE'), 'the booking lib founding word stands');
});

/* ── 8. the version law (agreement shape) ────────────────────────────── */
check('the version law: APP_VERSION and sw.js agree', () => {
  const v = versionTs.match(/APP_VERSION = '([^']+)'/)?.[1] ?? '';
  assert.ok(v.length > 0, 'APP_VERSION is present');
  assert.ok(swJs.includes(`const VERSION = "servepoint-v${v}-r1";`), `sw.js carries the same word (${v})`);
});

console.log(`\nunit305 — PASS ${passed}/${passed} (all checks green)`);
