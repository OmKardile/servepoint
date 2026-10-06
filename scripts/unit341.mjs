/* unit341 — v5.302.0 "the drill reads the table's past" (agreement shape)
 * The parked item's honest delta: the day-keyed form shipped in 5.259
 * (tonight's rows), but the trail's counts and rows both rode the board's
 * latest-100 ledger — a browsing window that forgets a busy table's older
 * nights. THE FEATURE: one targeted read (fetchTableTickets — the hold
 * audit's own pattern: table-keyed, bounded at the shared constant,
 * caller-cached, in-flight guarded, a failed read is silence) brings the
 * table's newest tickets across days; the drill's new "Earlier at this
 * table" block groups them under the scan trail's own day grammar
 * (appDayKey + istDayPretty), newest day first, the two newest days open
 * by default behind the 5.219 expansion law, the rows wearing tonight's
 * exact anatomy minus the pulse — nothing in the past is living. A
 * cancelled ticket never happened; today belongs to the Tonight block —
 * one ticket can never double-render. The cap whisper reads the SAME
 * constant the read used. */

import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const read = (p) => readFileSync(`/home/z/my-project/${p}`, 'utf8');

const floor = read('src/components/floor/FloorScreen.tsx');
const api = read('src/lib/api.ts');
const version = read('src/version.ts');
const sw = read('public/sw.js');

const count = (hay, needle) => hay.split(needle).length - 1;

test('unit341 · the targeted read — table-keyed, bounded, slim', () => {
  // the reader is born beside the hold audit's own targeted read
  assert.match(api, /export async function fetchTableTickets\(/);
  assert.ok(api.includes(".eq('tenant_id', tenantId)"), 'tenant-scoped');
  assert.ok(api.includes(".eq('table_id', tableId)"), 'table-keyed');
  assert.ok(api.includes(".order('created_at', { ascending: false })"), 'newest first');
  // the shared bound — the read and the whisper read the SAME constant
  assert.match(api, /export const TABLE_TICKET_READ_LIMIT = 120;/);
  assert.match(api, /limit: number = TABLE_TICKET_READ_LIMIT,/);
  // slim columns: the trail never shows plates, so no items ride
  assert.ok(api.includes("select('id, order_number, status, payment_status, total, created_at, table_id')"));
  assert.ok(api.includes('export interface TableTicketRow {'), 'the row shape');
});

test('unit341 · the parent fetches like the hold audit', () => {
  // the hold audit's own pattern: cached per table, in-flight guarded
  assert.ok(floor.includes('const [historyRows, setHistoryRows] = useState<Map<string, TableTicketRow[]>>(new Map());'));
  assert.ok(floor.includes('const [historyFailed, setHistoryFailed] = useState<Set<string>>(new Set());'));
  assert.ok(floor.includes('const historyInFlight = useRef<Set<string>>(new Set());'));
  assert.ok(floor.includes('if (historyRows.has(id) || historyFailed.has(id) || historyInFlight.current.has(id)) return;'));
  assert.ok(floor.includes('fetchTableTickets(tenantId, id)'), 'the targeted read');
  // a failed read is silence — the drill never blocks on a nicety
  assert.ok(floor.includes('setHistoryFailed'), 'the failed set');
  // the read rides the drill's opening
  assert.ok(floor.includes('historyRows={historyRows.get(drillTable.id) ?? null}'));
  assert.ok(floor.includes('historyFailed={historyFailed.has(drillTable.id)}'));
});

test('unit341 · the grouping speaks the ONE rule and the ONE day grammar', () => {
  // the same predicates the trail counts and tonight's rows speak
  assert.ok(floor.includes("if (o.status === 'cancelled') continue;"), 'a cancelled ticket never happened');
  assert.ok(floor.includes('const key = appDayKey(o.created_at);'), 'the ONE day key');
  // today belongs to the Tonight block — one ticket can never double-render
  assert.ok(floor.includes('if (key === todayKey) continue;'), 'today is not history');
  // newest day first, rows newest first within the day
  assert.ok(floor.includes('.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())'));
  assert.ok(floor.includes('.sort((a, b) => (a.day < b.day ? 1 : a.day > b.day ? -1 : 0));'), 'newest day first');
  // the cap whisper reads the SAME constant
  assert.ok(floor.includes('historyRows.length >= TABLE_TICKET_READ_LIMIT'), 'the bound is shared');
  assert.ok(floor.includes('deeper nights live in Bills.'), 'the honest word');
});

test('unit341 · the block renders honest absence and folds on table switch', () => {
  // silence, never a zero list
  assert.ok(floor.includes('{history && history.groups.length > 0 && ('));
  // the 5.219 law: two days by default, the earlier ones behind the toggle
  assert.ok(floor.includes('(showAllHistory ? history.groups : history.groups.slice(0, 2))'));
  assert.ok(floor.includes('onClick={() => setShowAllHistory((v) => !v)}'));
  // a table switch folds it back — the next table's past starts closed
  assert.ok(floor.includes('useEffect(() => {\n    setShowAllHistory(false);\n  }, [table.id]);'));
  // the day heading counts the work AND its money — tonight's chip voice
  assert.ok(floor.includes("{istDayPretty(day)} · {rows.length} ticket{rows.length === 1 ? '' : 's'} ·{' '}"));
});

test('unit341 · the past rows wear tonight\u2019s anatomy minus the pulse', () => {
  // the history rows carry NO live pulse — nothing in the past is living
  const blockStart = floor.indexOf("the drill reads the table's past: the days BEFORE");
  const blockEnd = floor.indexOf('{/* guest session trail (v5.23.0)');
  assert.ok(blockStart > 0 && blockEnd > blockStart, 'the history block is locatable');
  const block = floor.slice(blockStart, blockEnd);
  assert.equal(block.includes('animate-pulse'), false, 'no pulse in the past');
  // the paid pills are the exact family tonight speaks
  assert.ok(block.includes("paid ? 'bg-[#EAF4EC] text-[#2E7D32]' : 'bg-[#FDF3E4] text-[#8A5A16]'"), 'the PAID/DUE pills');
  assert.ok(block.includes('{paid ? \'PAID\' : \'DUE\'}'), 'the words');
  // the row whisper names the ticket's own truth
  assert.ok(block.includes("title={`Ticket #${o.order_number} · placed ${istHM(o.created_at)}"));
  // the styling law: the day groups walk in staggered on the fade's own family
  // (the 5.301 grammar), the block whispers its convention, the toggle's aria
  // keeps its function
  assert.ok(block.includes("style={{ animation: 'spFadeIn 240ms ease-out both', animationDelay: `${gi * 40}ms` }}"));
  assert.ok(block.includes('title="Every ticket this table has held before today — a cancelled ticket never happened"'));
  assert.ok(block.includes("aria-label={showAllHistory ? 'Show the two newest days only' : 'Show every day this table holds'}"));
});

test('unit341 · tonight\u2019s block byte-still and the neighbours standing', () => {
  // the 5.259 block is untouched — tonight keeps its own words
  assert.ok(floor.includes('/> Tonight at this table'), "tonight's heading");
  assert.ok(floor.includes('{tonightTickets.length} ticket{tonightTickets.length === 1 ? \'\' : \'s\'} ·{'), "tonight's chip");
  // the drill still receives the whole family
  assert.ok(floor.includes('ticketDays={drillTicketDays}'));
  assert.ok(floor.includes('tonightTickets={drillTonightTickets}'));
  // the hold audit's own machinery stands untouched
  assert.ok(floor.includes('const [holdAudit, setHoldAudit] = useState<Map<string, Order | null>>(new Map());'));
  // the History icon joined the family, alphabetically
  assert.ok(floor.includes('  History,\n  Link2,'));
});

test('unit341 · the feature names itself and its law', () => {
  assert.match(floor, /the drill reads the table's PAST/);
  assert.match(floor, /the next table's past starts closed/);
  assert.match(api, /the drill reads the table's PAST/);
  assert.match(api, /no second read is spent on rows the block never shows/);
});

test('unit341 · the version law — version.ts and sw.js carry the same word', () => {
  const v = version.match(/export const APP_VERSION = '([^']+)';/);
  const s = sw.match(/const VERSION = "servepoint-v([^-]+)-r(\d+)"/);
  assert.ok(v, 'version.ts must speak APP_VERSION');
  assert.ok(s, 'sw.js must bake the cache word');
  assert.equal(v[1], s[1], 'the two words must agree');
  assert.equal(v[1], '5.302.0');
});
