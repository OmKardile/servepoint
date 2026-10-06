/* unit314 — v5.275.0 "every export verb speaks — one shape" (agreement shape)
 * The census finding: 5.274.0 taught TWO CSV verbs to speak (the bills
 * list, the guests book) and parked the rest as "one adoption round
 * away". The fresh-eyes census found the parked note UNDERCOUNTED: not
 * reports ×5 but reports ×12 — plus the menu catalog, the shelf's
 * production sheet, the shelf's shopping list, and the closeout's day
 * ledger — SIXTEEN verbs still tapping into a silent tray. THE ROUND
 * EXTRACTS THE GRAMMAR THOSE TWO SPOKE INTO THE ONE COMPONENT, AND EVERY
 * EXPORT VERB IN THE HOUSE RIDES IT:
 *   1. THE ONE SHAPE: CsvExportButton — the resting verb wears its
 *      surface's own register (the white header frame, or the section
 *      chip's amber), and after the tap the paid chip's green register
 *      (#2E7D32 on the #E8F5EC ghost) with the Check ear and the word
 *      "Saved" for a breath (useExportFlash owns the breath), then
 *      returns; the aria flips with the word;
 *   2. THE GEOMETRY RIDES THE CALL SITE — heights, radius, type: each
 *      surface keeps its own proportions; THE REGISTER IS THE HOUSE'S
 *      and lives in the component, once (the trio bytes in exactly one
 *      file — a future retint is one edit, not eighteen);
 *   3. THE REPORTS TWELVE: every section's CSV chip rides the component,
 *      each with its OWN hook pair (a tap makes ONLY the tapped verb say
 *      Saved — its siblings keep their own silence) and its OWN aria word
 *      naming its file;
 *   4. THE MENU CATALOG: the pill keeps its spreadsheet ear and its
 *      "Catalog CSV" word at rest;
 *   5. THE SHELF'S TWO: the production sheet (compact) and the shopping
 *      list (header) ride it in their own boards;
 *   6. THE CLOSEOUT: the day ledger's verb rides it;
 *   7. THE TWO TEACHERS JOIN: bills and the guests book — the verbs that
 *      TAUGHT the grammar in 5.274.0 — now ride the component too; no
 *      call site carries its own copy of the colors;
 *   8. THE VERSION LAW: APP_VERSION and sw.js agree (the agreement
 *      shape — the literal belongs to this round's unit). */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';

const button = readFileSync('/home/z/my-project/src/components/common/CsvExportButton.tsx', 'utf8');
const reports = readFileSync('/home/z/my-project/src/components/reports/ReportsScreen.tsx', 'utf8');
const menu = readFileSync('/home/z/my-project/src/components/menu/MenuScreen.tsx', 'utf8');
const inventory = readFileSync('/home/z/my-project/src/components/inventory/InventoryScreen.tsx', 'utf8');
const eod = readFileSync('/home/z/my-project/src/components/eod/EodScreen.tsx', 'utf8');
const bills = readFileSync('/home/z/my-project/src/components/bills/BillsScreen.tsx', 'utf8');
const customers = readFileSync('/home/z/my-project/src/components/customers/CustomersScreen.tsx', 'utf8');
const versionTs = readFileSync('/home/z/my-project/src/version.ts', 'utf8');
const swJs = readFileSync('/home/z/my-project/public/sw.js', 'utf8');

let passed = 0;
const check = (name, fn) => {
  fn();
  passed += 1;
  console.log(`  ok ${passed} — ${name}`);
};

const count = (hay, needle) => hay.split(needle).length - 1;

/* ── 1. the one shape ─────────────────────────────────────────────────── */
check('the ONE component speaks the grammar — saved register, word swap, ear swap, two resting registers', () => {
  assert.ok(button.includes("The resting verb wears its surface's own register"), 'the component says why it exists');
  assert.ok(button.includes("'border-[#2E7D32] bg-[#E8F5EC] text-[#2E7D32] focus-visible:outline-[#2E7D32]'"), 'the saved register — the paid chip\u2019s own green, named once');
  assert.ok(button.includes("{saved ? 'Saved' : idleWord}"), 'the word swaps');
  assert.ok(button.includes('<Check size={earSize ?? DEFAULT_EAR[tone]} aria-hidden />'), 'the ear swaps to the Check for the breath');
  assert.ok(button.includes("{saved ? savedAria : idleAria}"), 'the aria flips with the word');
  assert.ok(button.includes("'border-[#E3E7E0] bg-white text-[#0F3D3E] hover:border-[#B88E2F] hover:text-[#B88E2F]"), 'the header\u2019s resting register');
  assert.ok(button.includes("'border-[#B88E2F]/45 bg-[#FDF9F0] text-[#8A5A00] hover:bg-[#B88E2F] hover:text-white active:scale-[0.97]"), 'the chip\u2019s resting register — the amber it already wore');
  assert.ok(button.includes("tone?: 'header' | 'chip';"), 'two tones, named');
  assert.ok(button.includes('idleEar?: \'download\' | \'sheet\';'), 'the resting ear has its own word');
  assert.ok(button.includes("geometry?: string;"), 'the geometry rides the call site');
  assert.ok(button.includes('THE GEOMETRY RIDES THE CALL SITE'), 'the docstring draws the line: geometry theirs, register the house\u2019s');
  assert.ok(button.includes('disabled:cursor-not-allowed disabled:opacity-40'), 'the disabled grammar rides every resting verb');
  assert.ok(button.includes('import { Check, Download, FileSpreadsheet } from \'lucide-react\';'), 'the component owns the ears');
});

/* ── 2. the reports twelve ────────────────────────────────────────────── */
check('the reports\u2019 twelve export verbs ride the ONE component — each its own hook, each its own word', () => {
  assert.ok(reports.includes("import { CsvExportButton } from '../common/CsvExportButton';"), 'the component is imported');
  assert.ok(reports.includes("import { useExportFlash } from '../../lib/useExportFlash';"), 'the hook is imported');
  assert.equal(count(reports, '<CsvExportButton'), 12, 'twelve verbs, twelve components');
  assert.equal(count(reports, 'tone="chip"'), 10, 'ten section chips keep their amber register');
  assert.equal(count(reports, '= useExportFlash();'), 12, 'twelve hook pairs — a tap speaks ONLY the tapped verb');
  for (const word of [
    'Item ranking exported \u2014 the CSV file is saved',
    'Daily sales exported \u2014 the CSV file is saved',
    'Sales by hour exported \u2014 the CSV file is saved',
    'Payment mix exported \u2014 the CSV file is saved',
    'GST register exported \u2014 the CSV file is saved',
    'Offer scorecard exported \u2014 the CSV file is saved',
    'Cost and margin exported \u2014 the CSV file is saved',
    'Service mix exported \u2014 the CSV file is saved',
    'Kitchen speed exported \u2014 the CSV file is saved',
    'Table turnover exported \u2014 the CSV file is saved',
    'Guest ratings exported \u2014 the CSV file is saved',
    'Drawer shifts exported \u2014 the CSV file is saved',
  ]) assert.ok(reports.includes(`savedAria="${word}"`), `the aria names its own file: ${word}`);
  assert.ok(reports.includes('a tap makes ONLY the tapped verb say "Saved"'), 'the hooks say why there are twelve');
  assert.ok(!reports.includes('bg-[#E8F5EC]'), 'no call-site copy of the green register');
});

/* ── 3. the menu catalog ──────────────────────────────────────────────── */
check('the menu catalog\u2019s verb rides the ONE component — the pill keeps its own ear and word', () => {
  assert.ok(menu.includes("import { CsvExportButton } from '../common/CsvExportButton';"), 'the component is imported');
  assert.ok(menu.includes('const [catalogSaved, flashCatalog] = useExportFlash();'), 'the catalog\u2019s own hook pair');
  assert.ok(menu.includes('idleEar="sheet"'), 'the resting ear is the spreadsheet\u2019s own');
  assert.ok(menu.includes('idleWord="Catalog CSV"'), 'the resting word keeps its name');
  assert.ok(menu.includes('savedAria="Menu catalog exported \u2014 the CSV file is saved"'), 'the aria names the catalog');
  assert.ok(menu.includes('geometry="flex h-11 items-center gap-1.5 rounded-full border px-4 text-[13px] font-semibold"'), 'the pill keeps its own geometry');
});

/* ── 4. the shelf's two ───────────────────────────────────────────────── */
check('the shelf\u2019s two export verbs ride the ONE component in their own boards', () => {
  assert.ok(inventory.includes("import { CsvExportButton } from '../common/CsvExportButton';"), 'the component is imported');
  assert.ok(inventory.includes('const [sheetSaved, flashSheet] = useExportFlash();'), 'the production sheet\u2019s hook pair lives in the RecipeBoard');
  assert.ok(inventory.includes('const [listSaved, flashList] = useExportFlash();'), 'the shopping list\u2019s hook pair lives in the ReorderBoard');
  assert.ok(inventory.includes('savedAria="Production plan exported \u2014 the CSV file is saved"'), 'the aria names the production plan');
  assert.ok(inventory.includes('savedAria="Shopping list exported \u2014 the CSV file is saved"'), 'the aria names the shopping list');
  assert.ok(inventory.includes('geometry="flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[11px] font-bold"'), 'the compact sheet keeps its own geometry');
  assert.ok(inventory.includes('disabled={buyRows.length === 0}'), 'the empty-list refusal keeps its own grammar');
  assert.ok(!inventory.includes('bg-[#E8F5EC]'), 'no call-site copy of the green register');
});

/* ── 5. the closeout ──────────────────────────────────────────────────── */
check('the closeout\u2019s verb rides the ONE component', () => {
  assert.ok(eod.includes("import { CsvExportButton } from '../common/CsvExportButton';"), 'the component is imported');
  assert.ok(eod.includes('const [closeSaved, flashClose] = useExportFlash();'), 'the closeout\u2019s own hook pair');
  assert.ok(eod.includes('savedAria="Closeout exported \u2014 the CSV file is saved"'), 'the aria names the closeout');
  assert.ok(eod.includes('geometry="flex min-h-[44px] items-center gap-2 rounded-xl border px-4 text-[13px] font-extrabold"'), 'the counter\u2019s own geometry rides the call site');
  assert.ok(eod.includes('disabled={loading || orders.length === 0}'), 'the mid-flight refusal keeps its own grammar');
});

/* ── 6. the two teachers join ─────────────────────────────────────────── */
check('bills and the guests book — the verbs that taught the grammar — ride the ONE component too', () => {
  assert.ok(bills.includes('saved={billsSaved}') && bills.includes('<CsvExportButton'), 'the bills verb rides the component');
  assert.ok(customers.includes('saved={bookSaved}') && customers.includes('<CsvExportButton'), 'the book\u2019s verb rides the component');
  for (const src of [bills, customers]) {
    assert.ok(!/\{billsSaved \? 'Saved'|\{bookSaved \? 'Saved'/.test(src), 'no inline word swap left at the call sites');
    assert.ok(!src.includes('border border-[#2E7D32] bg-[#E8F5EC]'), 'no inline saved-register ternary left at the call sites (the paid chips\u2019 own ghosts stay — they are the register\u2019s origin)');
  }
});

/* ── 7. the one-register law ──────────────────────────────────────────── */
check('the saved register trio lives in exactly ONE file — a retint is one edit, not eighteen', () => {
  const walk = (dir) => {
    const out = [];
    for (const name of readdirSync(dir)) {
      const p = `${dir}/${name}`;
      if (statSync(p).isDirectory()) out.push(...walk(p));
      else if (/\.(tsx?|mjs|css)$/.test(name)) out.push(p);
    }
    return out;
  };
  const carriers = walk('/home/z/my-project/src').filter((f) =>
    readFileSync(f, 'utf8').includes('border-[#2E7D32] bg-[#E8F5EC]'),
  );
  assert.deepEqual(carriers, ['/home/z/my-project/src/components/common/CsvExportButton.tsx'],
    'the trio bytes live only in the component');
});

/* ── 8. the version law ───────────────────────────────────────────────── */
check('APP_VERSION and sw.js agree — the agreement shape', () => {
  const v = versionTs.match(/APP_VERSION = '([^']+)'/)?.[1] ?? '';
  assert.equal(v, '5.275.0', 'the version word is this round\u2019s');
  assert.ok(swJs.includes(`const VERSION = "servepoint-v${v}-r1";`), `sw.js carries the same word (${v})`);
});

console.log(`\nunit314 — PASS ${passed}/${passed} (all checks green)`);
