/* unit313 — v5.274.0 "the export speaks the house's voice" (agreement shape)
 * The census finding: four CSV export cells — the bills file's "Placed at"
 * and the guests book's "Last ticket" / "On the book since" / "Last
 * redemption" — stamped their timestamps with the EXPORTING DEVICE's bare
 * toLocaleString(): no locale, no timezone pinned. A CSV cell is data
 * LEAVING the house — it lands in accounting, a GST folder, a
 * reconciliation sheet — so the same order exported from the counter
 * tablet and from the owner's phone spoke two different shapes in two
 * different clocks, and a reconciliation never agreed with itself. THE
 * ROUND GIVES THE EXPORT ITS VOICE, AT BOTH ENDS:
 *   1. THE LIB WORD: appday's AppFormatters gains `stamp` — en-IN ·
 *      appTimezone() · "06 Oct 2026, 14:32" (the hhmm 24h anchor) — and
 *      appStampLabel() names it for every call site;
 *   2. THE BILLS CELL: the "Placed at" column rides appStampLabel — the
 *      bare toLocaleString() is GONE;
 *   3. THE BOOK'S CELLS: all three guest timestamps ride appStampLabel —
 *      the null-read silence keeps its own grammar (an unread ledger never
 *      becomes an invented number);
 *   4. THE CENSUS LAW: NO bare no-arg toLocaleString() anywhere in src/ —
 *      the export voice is now fully pinned, the 305 law's sibling;
 *   5. THE VERB'S ACK (bills): the CSV button speaks its own confirmation
 *      — Saved + the Check ear in the paid chip's green register
 *      (#2E7D32 on the #E8F5EC ghost) for a breath, then returns; the aria
 *      flips with the word — no second tap born of a silent download tray;
 *   6. THE VERB'S ACK (the book): the same grammar on the guests CSV —
 *      one shared hook (useExportFlash: one timer, cleaned up, re-arm
 *      honest), two buttons, one voice;
 *   7. THE VERSION LAW: APP_VERSION and sw.js agree (the agreement shape —
 *      the literal belongs to this round's unit). */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';

const appday = readFileSync('/home/z/my-project/src/lib/appday.ts', 'utf8');
const bills = readFileSync('/home/z/my-project/src/components/bills/BillsScreen.tsx', 'utf8');
const customers = readFileSync('/home/z/my-project/src/components/customers/CustomersScreen.tsx', 'utf8');
const flash = readFileSync('/home/z/my-project/src/lib/useExportFlash.ts', 'utf8');
const versionTs = readFileSync('/home/z/my-project/src/version.ts', 'utf8');
const swJs = readFileSync('/home/z/my-project/public/sw.js', 'utf8');

let passed = 0;
const check = (name, fn) => {
  fn();
  passed += 1;
  console.log(`  ok ${passed} — ${name}`);
};

/* the bills export block */
const billsCsv = bills.match(/export function billsCsvRows\([\s\S]*?\n  return lines;\n\}/);
assert.ok(billsCsv, 'billsCsvRows found');

/* the guests export block */
const guestsCsv = customers.match(/export function guestsCsvRows\([\s\S]*?\n  return lines;\n\}/);
assert.ok(guestsCsv, 'guestsCsvRows found');

/* the bills CSV button block */
const billsBtn = bills.match(/\{\/\* v5\.274\.0 — the verb's own ack: after the export the button[\s\S]*?\{billsSaved \? 'Saved' : 'CSV'\}\n            <\/button>/);
assert.ok(billsBtn, 'the bills CSV button found');

/* the guests CSV button block */
const guestsBtn = customers.match(/\{\/\* 5\.129\.0 — the book, carried out[\s\S]*?\{bookSaved \? 'Saved' : 'CSV'\}\n              <\/button>/);
assert.ok(guestsBtn, 'the guests CSV button found');

/* ── 1. the lib word ─────────────────────────────────────────────────── */
check('appday speaks the export stamp — en-IN, the reporting clock, the 24h anchor', () => {
  assert.ok(appday.includes("/** \"06 Oct 2026, 14:32\" — the EXPORT stamp (v5.274.0): the day AND the"), 'the interface names the voice');
  assert.ok(appday.includes("stamp: new Intl.DateTimeFormat('en-IN', {"), 'en-IN — the register every pinned render shares');
  const stampFmt = appday.match(/stamp: new Intl\.DateTimeFormat\('en-IN', \{[\s\S]*?\}\),/);
  assert.ok(stampFmt, 'the stamp formatter found');
  assert.ok(stampFmt[0].includes("timeZone: tz,"), 'the reporting clock rides the tz argument — appTimezone() at every call');
  assert.ok(stampFmt[0].includes("day: '2-digit',"), 'the day is zero-padded');
  assert.ok(stampFmt[0].includes("month: 'short',"), 'the month is the house word');
  assert.ok(stampFmt[0].includes("year: 'numeric',"), 'the year is spoken');
  assert.ok(stampFmt[0].includes("hour: '2-digit',"), "the hour is the hhmm shape's");
  assert.ok(stampFmt[0].includes("minute: '2-digit',"), 'the minute rides');
  assert.ok(stampFmt[0].includes('hour12: false,'), 'hour12:false — the house 24h anchor, byte-kin to hhmm');
  const label = appday.match(/export function appStampLabel\(iso: string, tz: string = appTimezone\(\)\): string \{\n  return appFormatters\(tz\)\.stamp\.format\(new Date\(iso\)\);\n\}/);
  assert.ok(label, 'appStampLabel names the word for every call site');
  assert.ok(appday.includes('rows, exported from any device in the house, now read back byte-equal'), 'the lib says why it exists');
});

/* ── 2. the bills cell ───────────────────────────────────────────────── */
check('the bills "Placed at" cell rides the house stamp — the bare render is gone', () => {
  assert.ok(billsCsv[0].includes('appStampLabel(o.created_at),'), 'the cell rides appStampLabel');
  assert.ok(!billsCsv[0].includes('.toLocaleString()'), 'no bare toLocaleString in the bills export');
  assert.ok(billsCsv[0].includes("the device's bare toLocaleString() could not agree with itself"), 'the cell says why');
});

/* ── 3. the book's cells ─────────────────────────────────────────────── */
check('the guests book\u2019s three timestamps ride the stamp — the silence grammar kept', () => {
  assert.ok(guestsCsv[0].includes("s?.last_visit_at ? appStampLabel(s.last_visit_at) : '',"), 'Last ticket rides the stamp, the null read stays silent');
  assert.ok(guestsCsv[0].includes('appStampLabel(g.created_at),'), 'On the book since rides the stamp');
  assert.ok(guestsCsv[0].includes("bucket && bucket[0]?.createdAt ? appStampLabel(bucket[0].createdAt) : '',"), 'Last redemption rides the stamp, the timestamp-less row stays silent (the 5.190 law)');
  assert.ok(!guestsCsv[0].includes('.toLocaleString()'), 'no bare toLocaleString in the book export');
});

/* ── 4. the census law ───────────────────────────────────────────────── */
check('NO bare no-arg toLocaleString() anywhere in src/ — the export voice fully pinned', () => {
  const walk = (dir) => {
    const out = [];
    for (const name of readdirSync(dir)) {
      const p = `${dir}/${name}`;
      if (statSync(p).isDirectory()) out.push(...walk(p));
      else if (/\.(tsx?|mjs|css)$/.test(name)) out.push(p);
    }
    return out;
  };
  const offenders = walk('/home/z/my-project/src').filter((f) => /\.toLocaleString\(\)/.test(readFileSync(f, 'utf8')));
  assert.deepEqual(offenders, [], `unpinned export stamps remain: ${offenders.join(', ')}`);
});

/* ── 5. the verb's ack (bills) ───────────────────────────────────────── */
check('the bills CSV button speaks its own confirmation — Saved, the green register, the aria flip', () => {
  assert.ok(bills.includes("import { useExportFlash } from '../../lib/useExportFlash';"), 'the hook is imported');
  assert.ok(bills.includes('const [billsSaved, exportBills] = useExportFlash();'), 'the ack state lives with the toolbar');
  assert.ok(billsBtn[0].includes('onClick={() => exportBills(() => exportBillsCsv(sorted, paidSums))}'), 'the verb hands through the hook — the export still exports');
  assert.ok(billsBtn[0].includes("aria-label={billsSaved ? 'Bills exported — the CSV file is saved' : 'Export filtered bills as CSV — chase ages and open money included'}"), 'the aria speaks both stages');
  assert.ok(billsBtn[0].includes("border border-[#2E7D32] bg-[#E8F5EC] px-3 text-[12.5px] font-bold text-[#2E7D32]"), 'the saved state wears the paid chip\u2019s own green register');
  assert.ok(billsBtn[0].includes("border border-[#E3E7E0] bg-white px-3 text-[12.5px] font-bold text-[#0F3D3E]"), 'the resting state keeps the house\u2019s quiet frame');
  assert.ok(billsBtn[0].includes('{billsSaved ? <Check size={15} aria-hidden /> : <Download size={15} aria-hidden />}'), 'the ear swaps — the Check marks the done');
  assert.ok(billsBtn[0].includes("{billsSaved ? 'Saved' : 'CSV'}"), 'the word swaps');
  assert.ok(!billsBtn[0].includes('hover:border-[#B88E2F] hover:text-[#B88E2F] hover:'), 'clean parse of the two registers');
  assert.ok(billsBtn[0].includes('disabled:opacity-40'), 'the empty-narrowing refusal keeps its own grammar');
});

/* ── 6. the verb's ack (the book) + the one hook ─────────────────────── */
check('the book\u2019s CSV verb speaks the same ack — one hook, two buttons, one voice', () => {
  assert.ok(customers.includes("import { useExportFlash } from '../../lib/useExportFlash';"), 'the hook rides in the book too');
  assert.ok(customers.includes('const [bookSaved, exportBook] = useExportFlash();'), 'the ack lives with the book\u2019s toolbar');
  assert.ok(guestsBtn[0].includes('onClick={() => exportBook(() => exportGuestsCsv(rows, ledgerByPhone))}'), 'the verb hands through');
  assert.ok(guestsBtn[0].includes("aria-label={bookSaved ? 'Guests exported — the CSV file is saved' : 'Export guests as CSV'}"), 'the aria flips with the word');
  assert.ok(guestsBtn[0].includes("border border-[#2E7D32] bg-[#E8F5EC] px-3 text-[12px] font-bold text-[#2E7D32]"), 'the green register, the book\u2019s own size');
  assert.ok(guestsBtn[0].includes("{bookSaved ? <Check size={14} aria-hidden /> : <Download size={14} aria-hidden />}"), 'the ear swaps at the book\u2019s scale');
  assert.ok(guestsBtn[0].includes("{bookSaved ? 'Saved' : 'CSV'}"), 'the word swaps');
  // the hook's own discipline
  assert.ok(flash.includes('const FLASH_MS = 2200;'), 'a breath, not a flag — the word returns');
  assert.ok(flash.includes('if (timer.current !== null) window.clearTimeout(timer.current);'), 'a re-tap re-arms — a second honest export still exports');
  assert.ok(flash.match(/useEffect\(\s*\(\) => \(\) => \{[\s\S]*?clearTimeout\(timer\.current\);[\s\S]*?\},\s*\[\],?\s*\)/), 'the timer is cleaned up on unmount');
  assert.ok(flash.includes('reads the silence as a missed tap and taps again: two identical files'), 'the hook says why it exists');
});

/* ── 7. the version law ──────────────────────────────────────────────── */
check('APP_VERSION and sw.js agree — the agreement shape', () => {
  const v = versionTs.match(/APP_VERSION = '([^']+)'/)?.[1] ?? '';
  assert.equal(v, '5.274.0', 'the version word is this round\u2019s');
  assert.ok(swJs.includes(`const VERSION = "servepoint-v${v}-r1";`), `sw.js carries the same word (${v})`);
});

console.log(`\nunit313 — PASS ${passed}/${passed} (all checks green)`);
