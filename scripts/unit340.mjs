/* unit340 — v5.301.0 "the table's live tickets" (agreement shape)
 * The QA walk (the fresh-eyes 1600×900 lens — the never-walked desktop)
 * found the house clean, so the round carried the roadmap's QR-session
 * family forward: the menu only pointed back at the tab's OWN checkout
 * (the 5.253.0 chip), but a table QR seat is SHARED — family-style dining
 * means one table's tickets live on more than one phone. THE FEATURE: the
 * menu answers the table — the SHARED table's open tickets (orders carry
 * table_id since 001; anon reads are the house's own RLS posture), read
 * when ready, refreshed on the house's 30s cadence. THE RESPECTFUL SLICE:
 * number, kitchen state, item count, total — never a name, never a note.
 * THE WORDS (styling): rows walk in staggered on the fade's own family,
 * a ready ticket pulses its dot, the header whispers the panel's
 * convention in three languages — all house colors, zero new inks. */

import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const read = (p) => readFileSync(`/home/z/my-project/${p}`, 'utf8');

const guest = read('src/components/guest/GuestPages.tsx');
const lib = read('src/lib/guest.ts');
const i18n = read('src/lib/guest-i18n.ts');
const version = read('src/version.ts');
const sw = read('public/sw.js');

const count = (hay, needle) => hay.split(needle).length - 1;

test('unit340 · the lib law — the table\u2019s own read, fail-soft', () => {
  // the interface and the reader are born beside the family
  assert.match(lib, /export interface TableLiveTicket \{/);
  assert.match(lib, /export async function fetchTableLiveTickets\(tableId: string\): Promise<TableLiveTicket\[\]> \{/);
  // the query grammar — table-keyed, open statuses only, newest first, six at most
  assert.ok(lib.includes(".eq('table_id', tableId)"), 'table-keyed');
  assert.ok(lib.includes(".in('status', ['new', 'pending', 'preparing', 'ready'])"), 'open statuses only');
  assert.ok(lib.includes(".gte('created_at', since)"), 'the 12h floor');
  assert.ok(lib.includes(".order('created_at', { ascending: false })"), 'newest first');
  assert.ok(lib.includes('.limit(6);'), 'a panel, not a ledger');
  // the zombie floor — a dead shift's 'new' never lingers
  assert.ok(lib.includes('12 * 60 * 60 * 1000'), 'the 12-hour law');
  // fail-soft at the offers banner's own law
  assert.ok(lib.includes('if (error || !data) return [];'), 'a failed fetch is no panel');
  // the law names itself and its slice
  assert.match(lib, /the table's live tickets/);
  assert.match(lib, /Never a name, never a note/);
});

test('unit340 · the count rides the embedded rows', () => {
  // one read, no N+1 — the embed carries the qty lines and the mapping sums
  // the PIECES (2 sandwiches is 2 items, never 1 line wearing the word)
  assert.ok(lib.includes('order_items(qty)'), 'the embed');
  assert.ok(lib.includes("row.order_items.reduce((s, li) => s + (Number(li?.qty) || 0), 0)"), 'the piece sum');
  assert.equal(lib.includes('order_items(count)'), false, 'the line-count lie is gone');
});

test('unit340 · the menu\u2019s state and its 30s cadence', () => {
  // the state is born typed on the lib's own word
  assert.ok(guest.includes('const [tableTickets, setTableTickets] = useState<TableLiveTicket[]>([]);'));
  // the table id reached the menu — the resolved shape grew the field
  assert.match(guest, /tableId: string; tableNumber: string; capacity: number/);
  assert.ok(guest.includes('tableId: r.table.id,'), 'setResolved carries the id');
  // the effect: read when ready, refreshed on the house's cadence, cleaned up
  assert.ok(guest.includes('const tableId = resolved?.tableId;'));
  assert.ok(guest.includes("if (!tableId || phase !== 'ready') return;"));
  assert.ok(guest.includes('window.setInterval(() => void load(), 30_000);'));
  assert.ok(guest.includes('window.clearInterval(iv);'));
  assert.ok(guest.includes('if (alive) setTableTickets(rows);'), 'the alive guard');
});

test('unit340 · the render gate and the row grammar', () => {
  // the panel only when ready and non-empty
  assert.ok(guest.includes("{phase === 'ready' && tableTickets.length > 0 && ("));
  // a row follows its ticket through the house's own door
  assert.ok(guest.includes('window.location.assign(`/track/${tk.id}`)'));
  // the row's own aria — never the personal chip's "your ticket" word
  assert.ok(guest.includes("aria-label={t('tableLiveRowAria', { n: String(tk.order_number) })}"));
  // the header, the mine marker, the count word
  assert.ok(guest.includes("{t('tableLiveTitle')}"));
  assert.ok(guest.includes("{t('tableLiveMine')}"));
  assert.ok(guest.includes("t('tableLiveItems', { n: String(tk.items_count), s: tk.items_count === 1 ? '' : 's' })"));
});

test('unit340 · the respectful slice — no name, no note, house colors only', () => {
  // the panel block speaks no sibling's name, no sibling's note
  const panelStart = guest.indexOf("tickets, on the guest's own phone. Family-style dining means one");
  const panelEnd = guest.indexOf("{/* today's offers");
  assert.ok(panelStart > 0 && panelEnd > panelStart, 'the panel block is locatable');
  const panel = guest.slice(panelStart, panelEnd);
  assert.equal(panel.includes('customer_name'), false, 'no names in the panel');
  assert.equal(panel.includes('.notes'), false, 'no notes in the panel');
  assert.equal(panel.includes('guestWordFromNotes'), false, 'no note grammar either');
  // the chip colors are the house's own words — zero new inks
  assert.ok(panel.includes('bg-[#EAF4EC] text-[#2E7D32]'), 'ready wears the green family');
  assert.ok(panel.includes('bg-[#FBF6EA] text-[#B45309]'), 'kitchen wears the 337 warm');
  assert.ok(panel.includes('bg-[#F6F5F2] text-[#6B6B6B]'), 'placed wears the page grey');
  // the ready dot pulses
  assert.ok(panel.includes('animate-pulse rounded-full'), 'the eye goes to the food');
});

test('unit340 · the styling law — staggered fade, whisper, three languages', () => {
  // the rows walk in staggered on the fade's own family (5.269's keyframe)
  assert.ok(guest.includes("animation: 'spFadeIn 240ms ease-out both', animationDelay: `${i * 40}ms`"));
  // the panel whispers its convention on hover
  assert.ok(guest.includes("title={t('tableLiveWhisper')}"));
  // every guest language carries the family — 3 dicts, 4 words each
  for (const key of ['tableLiveTitle:', 'tableLiveAria:', 'tableLiveMine:', 'tableLiveWhisper:', 'tableLiveRowAria:']) {
    assert.equal(count(i18n, key), 3, `${key} in EN, HI and KN`);
  }
  assert.match(i18n, /tableLiveTitle: 'Live at this table',/);
  assert.match(i18n, /tableLiveTitle: 'इस टेबल के चालू टिकट',/);
  assert.match(i18n, /tableLiveTitle: 'ಈ ಟೇಬಲ್‌ನ ಚಾಲ್ತಿ ಟಿಕೆಟ್‌ಗಳು',/);
});

test('unit340 · the neighbours byte-still', () => {
  // the 5.253.0 personal chip stands above the panel — two truths, two scopes
  assert.ok(guest.includes("{phase === 'ready' && lastTicket && ("));
  // the honest note law stands untouched (the 337 law)
  assert.ok(guest.includes('function guestWordFromNotes'));
  // the lib's elder laws stand
  assert.ok(lib.includes('export async function fetchPublicOffers'));
  assert.ok(lib.includes('export async function fetchPublicOrder'));
  // the flow words the panel borrows are the track page's own
  assert.match(i18n, /flowKitchen: 'In the kitchen',/);
  assert.match(i18n, /flowPlaced: 'Placed',/);
  // the veg lens (339) and the name law (338) stand
  assert.match(guest, /const \[vegOnly, setVegOnly\] = useState\(readVegOnly\);/);
  assert.match(guest, /const NAME_KEY = \(token: string\) => `sp\.guest\.name\.\$\{token\}`;/);
});

test('unit340 · the version law — version.ts and sw.js carry the same word', () => {
  const v = version.match(/export const APP_VERSION = '([^']+)';/);
  const s = sw.match(/const VERSION = "servepoint-v([^-]+)-r(\d+)"/);
  assert.ok(v, 'version.ts must speak APP_VERSION');
  assert.ok(s, 'sw.js must bake the cache word');
  assert.equal(v[1], s[1], 'the two words must agree');
  assert.equal(v[1], '5.301.0');
});
