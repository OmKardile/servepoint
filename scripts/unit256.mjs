/* Task 256 — v5.217.0 unit suite: freeing the table ends its windows.
 * The Floor's "Free table" action only flipped the table's row — status
 * 'available', active_order_id null — and never touched the guests' live QR
 * sessions. The order RPC gates on the TENANT's status and the session's
 * life, never the table's own status, so a freed table whose guests still
 * held a live window could keep taking their orders — and migration 011's
 * hold trigger would re-hold the FREED table from the ghost order. The
 * seating is over; the windows end with it: the free action now composes the
 * table write (PRIMARY — it holds even if every cut fails, the residue is
 * bounded by the 10-minute expiry) with a FRESH session read (a window
 * opened while the confirm sat armed must not outlive the free) and the
 * drill's own RLS-scoped revoke primitive (no new RPC). A partial cut
 * failure speaks its honest count while the board resyncs. The card face
 * speaks the live windows in the drill's own tone (deep-ink pill, gold
 * pulse) BEFORE the confirm names the count, and the armed confirm grows the
 * disclosure ("Free + cut 2?") — never a surprise cut.
 * Asserted: the two true free sites route through freeTable (occupied +
 * billing) and no bare updateTable free path remains on them; the table
 * write comes FIRST (byte order — freedom is the primary intent); the fresh
 * fetchTableSessions read inside the handler (the stale closure would miss
 * windows opened during the arm window); liveWindowsOf's filter shape
 * (table_id + the clock-derived sessionState, the SAME liveness rule as the
 * drill rows); allSettled + the honest partial-failure voice that names the
 * table's freedom; the armed disclosure bytes ("Free + cut N?" composed from
 * liveNow, plain confirm at zero, aria names the cut); the card-face chip
 * (deep ink, gold pulse, tabular-nums, the free-consequence title); the
 * reservation paths and the party move LEFT ALONE (they never held a
 * seating — a move is not an end); the drill's cutAllSessions body intact.
 * Run: bunx vite-node scripts/unit256.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

let n = 0;
const ok = (name) => console.log(`  ok ${++n} - ${name}`);

const strip = (p) =>
  readFileSync(new URL(p, import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => !l.trim().startsWith('*') && !l.trim().startsWith('/*') && !l.trim().startsWith('//'))
    .join('\n');

const floor = strip('../src/components/floor/FloorScreen.tsx');

/* ── 1. The composed free action ── */

// The primary write comes FIRST — freedom is the owner's intent; the cuts follow.
const ftIdx = floor.indexOf('const freeTable = useCallback(');
assert.ok(ftIdx > 0, 'freeTable callback exists');
const ftBody = floor.slice(ftIdx, floor.indexOf('const handleMoveParty = useCallback('));
assert.ok(ftBody.length > 400 && ftBody.length < 2400, 'freeTable slice resolved (code anchors only)');
assert.ok(ftBody.indexOf("updateTable(t.id, tenantId, { status: 'available', active_order_id: null })") <
  ftBody.indexOf('fetchTableSessions(tenantId)'), 'the table write precedes the session read');
ok('the table write is the PRIMARY step, the cuts follow');

// The session read is FRESH — a window opened during the arm window must not outlive the free.
assert.ok(ftBody.includes('const fresh = await fetchTableSessions(tenantId).catch(() => null);'),
  'fresh session read inside the handler (fail-soft to the cached rows)');
assert.ok(ftBody.includes('liveWindowsOf(fresh ?? sessions, t.id)'), 'fresh rows win, the cached rows are the honest fallback');
ok('the session read is fresh, fail-soft to the cached rows');

// The liveness rule is the drill's own — never a second definition.
const lwIdx = floor.indexOf('function liveWindowsOf');
const lwBody = floor.slice(lwIdx, floor.indexOf('function istHM('));
assert.ok(lwBody.length > 100, 'liveWindowsOf slice resolved');
assert.ok(lwBody.includes("s.table_id === tableId && sessionState(s, nowMs) === 'live'"),
  'liveWindowsOf filters on table_id + the clock-derived sessionState');
ok('liveWindowsOf rides the drill sessionState — no second liveness rule');

// The revokes use the drill's own RLS-scoped primitive, allSettled, honest partial voice.
assert.ok(ftBody.includes('Promise.allSettled(ids.map((id) => revokeTableSession(id)))'), 'allSettled over the drill primitive');
assert.ok(ftBody.includes("The table is free, but ${failed} of ${ids.length} session cuts failed"),
  'the partial-failure voice names the table freedom + the 10-minute bound');
ok('partial cut failure speaks honestly; freedom holds either way');

// The optimistic flip + the resync as truth.
assert.ok(ftBody.includes("prev.map((s) => (ids.includes(s.id) ? { ...s, status: 'revoked' } : s))"), 'optimistic flip');
assert.ok(ftBody.includes('void reload()'), 'the board resyncs as truth');
ok('optimistic flip + resync — same discipline as the drill cuts');

// The busy/error surface is the board's own — one surface, no double-busy.
assert.ok(ftBody.includes('setBusyId(t.id)') && ftBody.includes('setActionError(null)'), 'busy + error surface claimed');
ok('freeTable owns the card busy/error surface');

/* ── 2. Both true free sites route through freeTable — no bare path left ── */

const armedFreeSites = floor.split('if (armed) void freeTable(t)').length - 1;
assert.equal(armedFreeSites, 2, 'occupied + billing free sites both route through freeTable');
ok('both free sites (occupied + billing) route through freeTable');

// The OLD bare free path is gone from the card actions.
assert.ok(!floor.includes("runAction(t.id, () => updateTable(t.id, tenantId, { status: 'available', active_order_id: null }))"),
  'no bare updateTable free path left on the cards');
ok('the bare free path is retired');

// The reservation/clear + party-move paths keep their own semantics — a move
// is not an end, a never-seated table holds no windows to cut.
assert.ok(floor.includes("void runAction(t.id, () => updateTable(t.id, tenantId, { status: 'available' }));"),
  'the reserved-clear path untouched (no seating ever happened)');
assert.ok(floor.includes("{ ...t, status: 'available' as const, active_order_id: null }"),
  'the party move keeps its own optimistic shape');
ok('reservation clear + party move left alone (never a seating)');

/* ── 3. The armed disclosure — never a surprise cut ── */

assert.ok(floor.includes("armed ? (liveNow > 0 ? `Free + cut ${liveNow}?` : 'Confirm free?') : 'Free'"),
  'the armed confirm names the cut count, plain at zero');
assert.equal(floor.split("armed ? (liveNow > 0 ? `Free + cut ${liveNow}?` : 'Confirm free?') : 'Free'").length - 1, 2,
  'the disclosure on BOTH free sites (one sentence, two buttons)');
assert.ok(floor.includes("` — its ${liveNow} live QR window${liveNow === 1 ? '' : 's'} ${liveNow === 1 ? 'is' : 'are'} cut too`"),
  'the aria names the cut in full words, verb-agreed (the E2E caught "1 window are")');
assert.ok(!floor.includes("} are cut too`"), 'the un-agreed verb is gone');
ok('armed confirm: "Free + cut N?" visible + aria, both sites');

/* ── 4. The card face speaks the live windows first ── */

// Code anchor: 5.219.0 grew the pill a warm branch, so the className became a
// template — anchor on the youngest-window computation that heads the block.
const chipIdx = floor.indexOf('const youngest = liveWindowsOf(sessions, t.id, nowTick).reduce(');
assert.ok(chipIdx > 0, 'the card-face live chip exists');
const chipBody = floor.slice(chipIdx, chipIdx + 1300);
assert.ok(chipBody.includes('animate-pulse') && chipBody.includes('bg-[#E7C878]'), 'the gold pulse');
assert.ok(chipBody.includes('tabular-nums'), 'the count aligns like its own table');
assert.ok(chipBody.includes('freeing the table ends'), 'the title names the free consequence');
ok('card face: deep-ink pill, gold pulse, honest title');

/* ── 5. The drill family intact — cutAllSessions untouched ── */

const caIdx = floor.indexOf('const cutAllSessions = useCallback(');
const caBody = floor.slice(caIdx, ftIdx);
assert.ok(caBody.length > 400, 'cutAllSessions slice resolved');
assert.ok(caBody.includes("prev.map((s) => (ids.has(s.id) ? { ...s, status: 'revoked' } : s))"),
  'the bulk-cut optimistic flip intact');
assert.ok(caBody.includes('the list shows what actually held.'), 'the drill partial voice intact');
ok('the drill bulk cut keeps its own body (the free composes, never forks)');

console.log(`\nunit256 — ${n} checks green`);
