/* Task 265 — v5.226.0 unit suite: the rhythm names its tables.
 *
 * 5.223 taught the floor rhythm card to count the looks beside the work
 * (Menu windows · 7d beside Seated rounds · 7d) and 5.183 taught it the
 * by-table chip (the breach strip). The census named the thin read that
 * was still missing: the split BY TABLE — which tables get looked at,
 * which get seated, the gap each table's own QR sees. A read, not a rule.
 *
 * 1. lib/turn.ts gains tableWeekSplit — the week's seated rounds and menu
 *    windows per table, from the two ledgers the card already holds (no
 *    second cloud read). ONE ticket rule with the trail's day counts
 *    (table-bound, not cancelled); ONE week grammar (the caller passes the
 *    floorWeekWindow bounds it already gave the tiles, so the split can
 *    never draw a different week than the totals it sits beside). A table
 *    with neither a round nor a look stays out of the map — silence,
 *    never a zero.
 * 2. The FloorScreen derives the split beside the tiles (same bounds memo)
 *    and renders the by-table strip after the rhythm's own ternary — both
 *    branches get it, one render site. Chips speak the card's own words
 *    (rounds · windows); the all-lookers table wears the card's amber
 *    ("no rounds yet"); a rounds-only chip stays quiet about its zero
 *    windows — the title carries the counter-born honesty (attribution
 *    would be a lie). The label says "this 7d" so compare mode never
 *    implies the chips delta.
 *
 * Asserted: the lib derivation (empty silence, per-table isolation, merged
 * rounds+looks row, cancelled excluded, tableless excluded, window bounds
 * [from, to), purity — fresh map, inputs untouched); the FloorScreen wiring
 * (the grown lib import, no local copy, the same-bounds memo, the name map
 * + sort, the strip guard + label + amber + silence laws, the neighbour
 * bytes untouched — breach strip, windows tile, no new timer).
 * Run: bunx vite-node scripts/unit265.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

let n = 0;
const ok = (s) => { n++; console.log(`  ✓ ${s}`); };
const strip = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');

/* ── 1. The lib — ONE ticket rule, ONE week grammar ── */

const turn = await import('/src/lib/turn.ts');
const { tableWeekSplit } = turn;

assert.equal(typeof tableWeekSplit, 'function', 'tableWeekSplit lives in lib/turn');
ok('tableWeekSplit has its home in the seat-span lib');

/* window anchors: [FROM, TO) — 7 IST days ending 2026-10-05 09:00 IST. */
const FROM = Date.parse('2026-09-28T03:30:00Z'); // 09:00 IST 28 Sep
const TO = Date.parse('2026-10-05T03:30:00Z'); // 09:00 IST 5 Oct
const IN_A = '2026-10-02T06:30:00Z'; // 12:00 IST 2 Oct — in window
const IN_B = '2026-10-04T09:30:00Z'; // 15:00 IST 4 Oct — in window
const BEFORE = '2026-09-28T03:29:59Z'; // one tick before the window opens
const AT_TO = '2026-10-05T03:30:00Z'; // exactly TO — outside ([from, to))

// empty ledgers → empty map (silence, never a zero)
assert.equal(tableWeekSplit([], [], FROM, TO).size, 0, 'empty ledgers are silence');
ok('empty ledgers read as silence — no invented zero');

// per-table isolation + accumulation
const orders = [
  { table_id: 't1', status: 'paid', created_at: IN_A },
  { table_id: 't1', status: 'unpaid', created_at: IN_B },
  { table_id: 't2', status: 'paid', created_at: IN_A },
];
const split = tableWeekSplit(orders, [], FROM, TO);
assert.equal(split.size, 2, 'two tables spoke, two rows');
assert.equal(split.get('t1')?.rounds, 2, 't1 accumulated both rounds');
assert.equal(split.get('t2')?.rounds, 1, 't2 kept its own round — isolation');
assert.equal(split.get('t1')?.looks, 0, 'a rounds-only row carries no invented looks');
ok('rounds accumulate per table — no leakage across tables');

// cancelled never happened; tableless never held one
const dirty = [
  { table_id: 't1', status: 'cancelled', created_at: IN_A },
  { table_id: null, status: 'paid', created_at: IN_A },
  { status: 'paid', created_at: IN_A },
  { table_id: 't3', status: 'paid', created_at: IN_A },
];
const clean = tableWeekSplit(dirty, [], FROM, TO);
assert.equal(clean.size, 1, 'cancelled + tableless stay out — one table spoke');
assert.equal(clean.get('t3')?.rounds, 1, 'the honest round survived');
ok('cancelled never happened; a ticket with no table never held one');

// window bounds are [from, to)
const edged = [
  { table_id: 't1', status: 'paid', created_at: BEFORE },
  { table_id: 't1', status: 'paid', created_at: AT_TO },
  { table_id: 't1', status: 'paid', created_at: IN_A },
];
const edgedSplit = tableWeekSplit(edged, [], FROM, TO);
assert.equal(edgedSplit.get('t1')?.rounds, 1, 'only the in-window round counts');
ok('the window is [from, to) — the tiles\' exact bounds');

// sessions count as looks, same bounds, merged into the same row
const sessions = [
  { table_id: 't1', created_at: IN_A },
  { table_id: 't1', created_at: IN_B },
  { table_id: 't4', created_at: IN_A },
  { table_id: 't4', created_at: AT_TO },
];
const merged = tableWeekSplit(orders, sessions, FROM, TO);
assert.equal(merged.get('t1')?.looks, 2, 't1 merged its looks beside its rounds');
assert.equal(merged.get('t4')?.looks, 1, 'the all-lookers table speaks (at-TO scan excluded)');
assert.equal(merged.get('t4')?.rounds, 0, 'the all-lookers table holds no invented rounds');
ok('looks and work merge into one row per table — the gap speaks');

// purity: inputs untouched, a fresh map every call
const before1 = JSON.stringify(orders);
const before2 = JSON.stringify(sessions);
tableWeekSplit(orders, sessions, FROM, TO);
assert.equal(JSON.stringify(orders), before1, 'orders untouched');
assert.equal(JSON.stringify(sessions), before2, 'sessions untouched');
assert.notEqual(tableWeekSplit(orders, sessions, FROM, TO), merged, 'a fresh map every call');
ok('the split is pure — a new map, the ledgers never touched');

/* ── 2. The FloorScreen wiring — same bounds, same ledgers ── */

const floor = strip('../src/components/floor/FloorScreen.tsx');

assert.ok(floor.includes("tableTicketDays, tableWeekSplit } from '../../lib/turn'"),
  'the Floor imports the grown turn family');
assert.ok(!/\bfunction tableWeekSplit\b/.test(floor), 'no local copy of the split');
ok('the Floor imports the lib rule — no local copy born');

assert.ok(floor.includes('return tableWeekSplit(orders, sessions, startMs, endMs);'),
  'the split memo reads both ledgers through floorWeekWindow\'s own bounds');
const splitCalls = floor.split('tableWeekSplit(orders, sessions,').length - 1;
assert.equal(splitCalls, 1, `exactly one call site — found ${splitCalls}`);
ok('the split draws floorWeekWindow — one week grammar with the tiles');

assert.ok(floor.includes('const nameById = new Map((tables ?? []).map((t) => [t.id, t.table_number]));'),
  'the chips speak the rail\'s own table words');
assert.ok(floor.includes('b.rounds - a.rounds || b.looks - a.looks || a.label.localeCompare'),
  'the sort: work first, then looks, then the table\'s natural order');
ok('the rows take their names from the tables ledger and sort honestly');

/* ── 3. The strip — the card's words, the honest tones ── */

assert.ok(floor.includes('{tableSplitRows.length > 0 && ('),
  'the strip is guarded — no rows, no strip (silence, never a zero)');
assert.ok(floor.includes('By table · this 7d'), 'the label says this 7d — compare never implied');
assert.ok(floor.includes("<Armchair size={12} aria-hidden /> By table"),
  'the strip wears the card\'s own glyph family');
assert.ok(floor.includes("font-bold text-[#8A5A00]\">no rounds yet</span>"),
  'the all-lookers table wears the amber ("no rounds yet")');
assert.ok(floor.includes("{r.looks > 0 && ("),
  'a zero-looks chip stays silent — the zero windows clause never prints');
assert.ok(floor.includes('counter tickets never scan`'),
  'the rounds-only title carries the counter-born honesty');
assert.ok(floor.includes("style={{ background: '#F6F5F2', boxShadow: 'inset 0 0 0 1px #E3E7E0' }}"),
  'the strip wears the ivory canvas + inset ring (the breach strip\'s family)');
assert.ok(floor.includes("className=\"inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold tabular-nums text-[#0F3D3E]\""),
  'the chips keep the breach chip\'s pill grammar in the house ink');
assert.ok(floor.includes("{r.looks > r.rounds ? 'text-[#8A5A00]' : 'text-[#969696]'}"),
  'the windows clause turns amber exactly when the gap opens');
ok('the strip speaks the card\'s words in the card\'s tones');

/* ── 4. The neighbours — byte-untouched ── */

assert.ok(floor.includes('Past the {turnMin}-min line · by table'),
  'the breach strip\'s header bytes untouched');
assert.ok(floor.includes('the raw look count, before any of it became a ticket.'),
  'the windows tile\'s title tooltip untouched');
assert.ok(floor.includes('>Menu windows · 7d</p>'), 'the windows tile\'s label untouched');
assert.ok(floor.includes('>Seated rounds · 7d</p>'), 'the seated-rounds tile\'s label untouched');
const intervals = floor.split('setInterval').length - 1;
assert.equal(intervals, 4, `the heartbeats stand — still 4, found ${intervals}`);
ok('the neighbours keep their bytes; no new timer was born');

console.log(`\nunit265 — ${n} checks green`);
