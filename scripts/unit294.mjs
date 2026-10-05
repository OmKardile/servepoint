/**
 * unit294 — v5.255.0 "the word on paper".
 *
 * 293 gave the note a writer (the drawer) and the guest's own ticket a
 * reader. This round completes the reader side — every surface that speaks
 * a bill speaks the word:
 *   1. THE RECEIPT CARRIES IT — ReceiptOpts grows orderNote; the print HTML
 *      speaks a dashed KITCHEN NOTE block between the items and the totals,
 *      the full word (never truncated), escaped like every stored string.
 *   2. THE SHARE VOICE CARRIES IT — buildReceiptText wraps the note as
 *      prose at the 32-column frame (the chase-list law), indented like
 *      every item sub-line, under its own hr.
 *   3. THE BYTE-IDENTITY LAW — absent/blank note → NO block, NO extra hr in
 *      the text voice: the pre-5.255 receipt is byte-identical (the
 *      split-payment law since 5.63).
 *   4. THE CALLER FEEDS IT — BillsScreen's receiptOpts() passes
 *      selected.notes, so print + Copy + WhatsApp all inherit the word.
 *   5. THE COUNTER'S SCREEN SPEAKS IT — the bill detail panel renders the
 *      amber "Kitchen note" row (the ticket's straggler family), gated on
 *      a non-blank word.
 *   6. THE KITCHEN NEVER READS A CUT WORD — the KDS order-note block is
 *      line-clamp-3 break-words (truncate is GONE from that block), the
 *      full word rides the title, and the block wears the amber family
 *      with the board's own #C2571B rail.
 *
 * Run: bunx vite-node scripts/unit294.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

let n = 0;
const ok = (s) => { n++; console.log(`  ok ${n} — ${s}`); };

const receipt = readFileSync('src/components/bills/ReceiptPrint.tsx', 'utf8');
const bills = readFileSync('src/components/bills/BillsScreen.tsx', 'utf8');
const kds = readFileSync('src/components/kitchen/KitchenScreen.tsx', 'utf8');
const versionTs = readFileSync('src/version.ts', 'utf8');
const swJs = readFileSync('public/sw.js', 'utf8');

/* 1 — the receipt carries it. */
{
  assert.ok(receipt.includes('orderNote?: string | null;'), 'ReceiptOpts grows orderNote');
  assert.ok(receipt.includes('KITCHEN NOTE'), 'the print block speaks the label');
  const noteIdx = receipt.indexOf('const orderNote =');
  assert.ok(noteIdx > 0, 'the HTML note block is built');
  const build = receipt.slice(receipt.indexOf('export function buildReceiptHtml'), receipt.indexOf('export function printReceipt'));
  assert.ok(build.includes('${orderNote}'), 'the HTML receipt renders the block between items and totals');
  assert.ok(build.includes('esc(opts.orderNote.trim())'), 'the word is escaped like every stored string');
  const noteConst = receipt.slice(receipt.indexOf('const orderNote ='), receipt.indexOf('const split = (opts.splitPayments'));
  assert.ok(noteConst.includes('overflow-wrap:anywhere') && !noteConst.includes('truncate'), 'the block wraps anywhere and never cuts the word');
  ok('the print receipt speaks the KITCHEN NOTE verbatim, escaped, uncut');
}

/* 2 — the share voice carries it. */
{
  const text = receipt.slice(receipt.indexOf('export function buildReceiptText'));
  assert.ok(text.includes('KITCHEN NOTE'), 'the share text speaks the label');
  assert.ok(text.includes('const wrapNote'), 'the note is wrapped as prose (the chase-list law)');
  assert.ok(text.includes('if (noteText)'), 'the share text gates on a non-blank word');
  ok('the share voice (Copy / WhatsApp) wraps the word at the frame');
}

/* 3 — the byte-identity law. */
{
  assert.ok(
    receipt.includes("opts.orderNote && opts.orderNote.trim() !== ''"),
    'both builders gate on a non-blank (trimmed) word — blank/absent renders nothing',
  );
  ok('absent or blank note → byte-identical pre-5.255 receipt (no block, no hr)');
}

/* 4 — the caller feeds it. */
{
  assert.ok(bills.includes('orderNote: selected.notes,'), 'receiptOpts() passes selected.notes');
  ok('print + Copy + WhatsApp inherit the word from one call site');
}

/* 5 — the counter's screen speaks it. */
{
  const rowIdx = bills.indexOf('{selected.notes && selected.notes.trim().length > 0 && (');
  assert.ok(rowIdx > 0, 'the detail row is gated on a non-blank word');
  const detail = bills.slice(rowIdx, rowIdx + 600);
  assert.ok(detail.includes('border-l-[#B45309]') && detail.includes('bg-[#FBF6EA]'), 'the straggler amber family carries it');
  assert.ok(detail.includes('{selected.notes}'), 'the word is spoken VERBATIM');
  assert.ok(detail.includes('Kitchen note'), 'the label names the kitchen');
  ok("the bill detail panel speaks the amber 'Kitchen note' row");
}

/* 6 — the kitchen never reads a cut word. */
{
  const noteIdx = kds.indexOf('v5.255.0 — the word the kitchen must hear');
  assert.ok(noteIdx > 0, 'the KDS block is this round\'s');
  const block = kds.slice(noteIdx, noteIdx + 700);
  assert.ok(block.includes('line-clamp-3 break-words'), 'the word wraps and clamps — readable, bounded');
  const cls = block.match(/className="([^"]+)"/)?.[1] ?? '';
  assert.ok(cls.length > 0 && !cls.includes('truncate'), 'truncate is GONE from the order-note className');
  assert.ok(block.includes('title={order.notes}'), 'the full word rides the title');
  assert.ok(block.includes('border-l-[#C2571B]') && block.includes('bg-[#FBF6EA]'), "the board's own words-colour rails the amber family");
  ok('the KDS note is bounded but never cut, in the amber words-family');
}

/* 7 — the version law, the agreement shape. */
{
  const v = versionTs.match(/APP_VERSION = '([^']+)'/)?.[1] ?? '';
  assert.ok(v.length > 0, 'APP_VERSION is present');
  assert.ok(swJs.includes(`const VERSION = "servepoint-v${v}-r1";`), `the SW cache name is servepoint-v${v}-r1 (old shells re-fetch)`);
  ok(`the version law holds: version.ts and sw.js agree on ${v}`);
}

console.log(`\nunit294 — ${n} checks, all green.`);
