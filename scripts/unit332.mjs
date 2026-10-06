/* unit332 — v5.293.0 "the drawer's movements learn to travel" (agreement shape)
 * The close-out room's export family completes: the day-ledger CSV
 * exports, the Z-report prints — but the drawer's movements out (every
 * payout and every safe drop, with its reason and its hand) rode silent,
 * no way to hand the day's cash movements to the spreadsheet that
 * reconciles them. THE FEATURE: the movements header grew the export
 * verb — ONE row per movement in the exact grammar the day ledger speaks
 * (the header names its columns; money rides moneyBare paise-true; the
 * kind passes through as the row itself speaks it; the reason travels
 * whole, csvCell owning the quoting; the by-line names the hand), built
 * pure through drawerMovementsCsvRows (192's own pattern), the file
 * named servepoint-drawer-movements-{today}.csv (istTodayIso at export
 * time — the day the movements travel, no prop drilled). THE REGISTER
 * (styling): the verb rides the house's ONE export chip (CsvExportButton
 * tone="chip" — the Reports rooms' own amber register), the same green
 * Saved breath after the tap (useExportFlash, the 5.274 grammar), the
 * header row grown the flex that seats it, and the verb only ever
 * rendering inside the movements branch — no drawer with no movements
 * ever exports an empty file. */

import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const read = (p) => readFileSync(`/home/z/my-project/${p}`, 'utf8');

const eod = read('src/components/eod/EodScreen.tsx');
const reports = read('src/components/reports/ReportsScreen.tsx');
const version = read('src/version.ts');
const sw = read('public/sw.js');

const count = (hay, needle) => hay.split(needle).length - 1;
const drawerCard = eod.slice(eod.indexOf('const DrawerCard'), eod.indexOf('const EodScreenInner'));

test('unit332 · the rows pure — one row per movement, the day-ledger grammar', () => {
  // extracted pure (192's own pattern): exported, named, typed
  assert.match(eod, /export function drawerMovementsCsvRows\(movements: DrawerMovement\[\]\): unknown\[\]\[\] \{/);
  // the header names its columns — the same Time-with-tz voice the day ledger speaks
  assert.match(eod, /\[`Time \(\$\{appTzTag\(\)\}\)`, 'Kind', 'Amount', 'Reason', 'By'\]/);
  // one row per movement: istTime stamps, money rides moneyBare paise-true
  assert.match(eod, /istTime\(m\.created_at\),/);
  assert.match(eod, /moneyBare\(Number\(m\.amount\)\),/);
  // the kind passes through as the row itself speaks it; the reason travels whole
  assert.match(eod, /m\.kind,/);
  assert.match(eod, /m\.reason,/);
  // the by-line names the hand — an empty one stays empty, never a guess
  assert.match(eod, /m\.created_by_email \|\| '',/);
});

test('unit332 · the verb speaks the house\u2019s ONE chip register', () => {
  // the register: the Reports rooms' own amber chip, one voice more, zero new colors
  assert.equal(count(drawerCard, 'tone="chip"'), 1, 'the movements verb rides the chip register');
  assert.equal(count(reports, 'tone="chip"'), 10, 'the Reports rooms stand byte-still');
  // the words: the idle ask, the saved word, the honest title
  assert.match(drawerCard, /idleAria="Export the drawer's movements as CSV"/);
  assert.match(drawerCard, /savedAria="Movements exported — the CSV file is saved"/);
  assert.match(drawerCard, /title="One row per movement — payouts and safe drops for the spreadsheet"/);
  // the house's ONE export component — never a hand-rolled button
  assert.match(drawerCard, /<CsvExportButton/);
});

test('unit332 · the flash breath — the tap exports, then the chip speaks', () => {
  // the movements' own ack instance beside the day-ledger's (two verbs, one hook)
  assert.equal(count(eod, 'useExportFlash()'), 2, 'closeSaved + movSaved');
  assert.match(drawerCard, /const \[movSaved, flashMov\] = useExportFlash\(\);/);
  // the ride: flashMov hands the export through — run-then-speak, the 5.274 order
  assert.match(drawerCard, /onExport=\{\(\) =>\s*\n\s*flashMov\(\(\) =>\s*\n\s*downloadCsv\(/);
});

test('unit332 · the filename — the day the movements travel', () => {
  // istTodayIso at export time — module scope, no prop drilled
  assert.match(drawerCard, /`servepoint-drawer-movements-\$\{istTodayIso\(\)\}\.csv`/);
  // the rows ride through the pure builder — the suite reads what the button writes
  assert.equal(count(eod, 'drawerMovementsCsvRows'), 3, 'definition + the card\u2019s comment + the button\u2019s call');
});

test('unit332 · the seat — the flex row, the label kept, the branch kept', () => {
  // the header row grew the flex that seats the verb; the label keeps its exact classes
  assert.match(drawerCard, /<div className="flex items-center gap-2">\s*\n\s*<p className="min-w-0 flex-1 text-\[10px\] font-bold uppercase tracking-\[0\.08em\] text-\[#8A938C\]">\s*\n\s*Movements out · \{formatMoney\(moveSum\)\}/);
  // the verb only ever renders inside the movements branch — no empty file
  const branchIdx = drawerCard.indexOf('{movements.length > 0 ? (');
  const verbIdx = drawerCard.indexOf('<CsvExportButton');
  assert.ok(branchIdx > -1, 'the movements branch stands');
  assert.ok(verbIdx > branchIdx, 'the verb lives inside the branch, never outside it');
  // the movement rows themselves stand byte-still: the kind chips, the money, the reason, the stamp
  assert.match(drawerCard, /m\.kind === 'payout' \? 'bg-\[#FCEBEA\] text-\[#B3261E\]' : 'bg-\[#EAF2F7\] text-\[#1D5D7E\]'/);
  assert.match(drawerCard, /\u2212\{formatMoney\(Number\(m\.amount\)\)\}<\/span>/);
  assert.match(drawerCard, /\{dayTime\(m\.created_at, appTimezone\(\)\)\}<\/span>/);
});

test('unit332 · the prune law — the export family byte-still around the new member', () => {
  // the day-ledger CSV's rows and its own verb stand untouched
  assert.match(eod, /export function dayLedgerCsvRows\(o: \{/);
  assert.match(eod, /idleAria="Export the day's ledger as CSV"/);
  assert.match(eod, /onExport=\{\(\) => flashClose\(exportDayCsv\)\}/);
  // the Z-report's print and its chat voice stand untouched
  assert.match(eod, /function printZReport\(opts: ZReportOpts\): void \{/);
  assert.match(eod, /export function buildZReportText\(opts: ZReportOpts\): string \{/);
  // the drawer's own math stands: float + cash-in − movements, ledger truth
  assert.match(drawerCard, /const expected = active \? Number\(active\.opening_float\) \+ cashIn - moveSum : 0;/);
  assert.match(drawerCard, /expected = float \+ cash-in \u2212 payouts &amp; drops · ledger truth, never a guess/);
});

test('unit332 · the family law — the house\u2019s export grammar holds one shape', () => {
  // the CsvExportButton is the ONE export verb component in the house
  assert.equal(count(eod, '<CsvExportButton'), 2, 'the day ledger + the movements');
  assert.match(eod, /import \{ CsvExportButton \} from '\.\.\/common\/CsvExportButton';/);
  // the hook's contract stands (5.274/5.276: the ONE home owns the clock)
  const flash = read('src/lib/useExportFlash.ts');
  assert.match(flash, /const FLASH_MS = 2200;/);
  assert.match(flash, /export function useExportFlash\(\): \[boolean, \(run: \(\) => void\) => void\] \{/);
  // the csv lib's own laws stand: the BOM, the injection guard
  const csv = read('src/lib/csv.ts');
  assert.match(csv, /\/\^\[=\+\\-@\]\/\.test\(s\)/);
  assert.match(csv, /new Blob\(\['\\ufeff' \+ lines\.join\('\\n'\)\]/);
});

test('unit332 · the version law — version.ts and sw.js carry the same word', () => {
  const v = version.match(/export const APP_VERSION = '([^']+)';/);
  const s = sw.match(/const VERSION = "servepoint-v([^-]+)-r(\d+)"/);
  assert.ok(v, 'version.ts must speak APP_VERSION');
  assert.ok(s, 'sw.js must bake the cache word');
  assert.equal(v[1], s[1], 'the two words must agree');
});
