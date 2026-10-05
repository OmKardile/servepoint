/**
 * unit297 — v5.258.0 "the floor hears the word".
 *
 * 293's order-level note rode the KDS (5.255's never-cut block), the counter
 * inbox, the bill and the paper — but the host/manager drilling into a busy
 * table on the FLOOR read only items and totals. The ticket's own word was
 * silent on the one screen whose whole job is "what is happening at THIS
 * table". This round:
 *   1. THE DRILL SPEAKS THE WORD — the live-ticket card grows the note block,
 *      seated after the items (the words-family order: items, then the word).
 *   2. THE FAMILY INK — the block wears the amber words family the KDS block
 *      wears: bg #FBF6EA, text #6B4A0E, and the #C2571B rail (the same
 *      rationale the kitchen board recorded in 5.255 — the rail matches the
 *      item-note ink the board itself speaks on the line above).
 *   3. NEVER CUT — verbatim, break-words, no truncate, no line-clamp (the
 *      bill's own law; the drill panel has the room the KDS card lacks).
 *   4. HONEST ABSENCE — conditional render: no word, no block.
 *   5. THE ITEM NOTES WEAR THE WORDS-INK — the floor's ItemLines note leaves
 *      the grey subs join and speaks ↳ italic #C2571B, byte-matched to the
 *      KDS's own item-note line — one ink for one guest's word, on every
 *      staff board that shows it.
 *   6. THE FAMILY CENSUS — KDS, counter inbox and floor all read order.notes
 *      (three staff boards, one word).
 *   7. THE VERSION LAW, the agreement shape (unit274's, live word).
 *
 * Run: bunx vite-node scripts/unit297.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

let n = 0;
const ok = (s) => { n++; console.log(`  ok ${n} — ${s}`); };

const floor = readFileSync('src/components/floor/FloorScreen.tsx', 'utf8');
const kds = readFileSync('src/components/kitchen/KitchenScreen.tsx', 'utf8');
const inbox = readFileSync('src/components/food/CounterInbox.tsx', 'utf8');
const versionTs = readFileSync('src/version.ts', 'utf8');
const swJs = readFileSync('public/sw.js', 'utf8');

// ── 1. the drill speaks the word ──────────────────────────────────────────
// The live-ticket card: conditional block on order.notes, seated after the
// ItemLines / no-items conditional, inside the same card.
const drillNote = /order\.notes && \([\s\S]*?className="mt-3 break-words rounded-lg border-l-\[3px\] border-l-\[#C2571B\] bg-\[#FBF6EA\] px-2\.5 py-2 text-\[12px\] leading-relaxed text-\[#6B4A0E\]"[\s\S]*?title=\{order\.notes\}[\s\S]*?\{order\.notes\}/;
assert.ok(drillNote.test(floor), 'the drill grows the order-note block on order.notes');
ok('the drill speaks the word (conditional block on order.notes)');

const itemsIdx = floor.indexOf('No item lines recorded on this order yet.');
const noteIdx = floor.search(drillNote);
assert.ok(itemsIdx > -1 && noteIdx > itemsIdx, 'the note sits after the items (the words-family order)');
ok('the seat — after the items, inside the live-ticket card');

// ── 2. the family ink, pinned against the KDS block ───────────────────────
const kdsBlock = kds.match(/order\.notes && \([\s\S]*?<p\s+className="([^"]+)"/);
assert.ok(kdsBlock, 'the KDS note block exists (the family anchor)');
for (const ink of ['bg-[#FBF6EA]', 'text-[#6B4A0E]', 'border-l-[#C2571B]']) {
  assert.ok(kdsBlock[1].includes(ink), `KDS block wears ${ink}`);
  assert.ok(floor.match(drillNote)[0].includes(ink), `floor block wears ${ink}`);
}
ok('the family ink — bg/text/rail byte-matched against the KDS block');

// ── 3. never cut ──────────────────────────────────────────────────────────
const floorBlock = floor.match(drillNote)[0];
assert.ok(floorBlock.includes('break-words'), 'the block breaks words');
assert.ok(!floorBlock.includes('truncate') && !floorBlock.includes('line-clamp'), 'no clamp, no truncate — the bill law');
ok('never cut — verbatim, break-words, no clamp');

// ── 4. honest absence ─────────────────────────────────────────────────────
assert.ok(/\{order\.notes && \(/.test(floor), 'conditional render — no word, no block');
ok('honest absence — the block only exists when the word does');

// ── 5. the item notes wear the words-ink ──────────────────────────────────
const itemLines = floor.slice(floor.indexOf('function ItemLines'), floor.indexOf('function TableDrill'));
assert.ok(!itemLines.includes('subs.push(`\\u2022 ${it.notes}`)'), 'the note left the grey subs join');
const inkLine = itemLines.match(/it\.notes && \([\s\S]*?<p className="([^"]+)">&#8627; \{it\.notes\}/);
assert.ok(inkLine, 'the note speaks on its own line with the KDS marker');
assert.ok(inkLine[1].includes('text-[#C2571B]') && inkLine[1].includes('italic'), 'the item-note ink is ↳ italic #C2571B (byte-matched family)');
const kdsItem = kds.match(/it\.notes && <span className="([^"]+)">↳ \{it\.notes\}<\/span>/);
assert.ok(kdsItem && kdsItem[1].includes('text-[#C2571B]') && kdsItem[1].includes('italic'), 'the KDS item-note line confirmed as the family anchor');
ok('item notes wear the words-ink — byte-matched to the KDS line');

// ── 6. the family census — three staff boards read the word ───────────────
assert.ok(kds.includes('order.notes') || kds.includes('order?.notes'), 'KDS reads order.notes');
assert.ok(inbox.includes('order.notes') || inbox.includes('order?.notes'), 'counter inbox reads order.notes');
assert.ok(floor.includes('order.notes') || floor.includes('order?.notes'), 'floor reads order.notes');
ok('the family census — KDS + inbox + floor, one word on three boards');

// ── 7. the version law, the agreement shape ───────────────────────────────
const v = versionTs.match(/APP_VERSION = '([^']+)'/)?.[1] ?? '';
assert.ok(v.length > 0, 'APP_VERSION is present');
assert.ok(swJs.includes(`const VERSION = "servepoint-v${v}-r1";`), 'sw.js carries the same word');
ok(`version law — ${v} agreed between version.ts and sw.js`);

console.log(`\nunit297: PASS ${n}/${n}`);
