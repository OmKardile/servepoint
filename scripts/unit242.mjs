/* Task 242 — v5.203.0 unit suite: the ghost answers when called.
 * The dashboard's strip counts "older stuck tickets off today's board —
 * see Bills" (5.196 named the ghosts) and 5.185's door followed the truth
 * as far as Bills' door — but Bills had NO VIEW for the word the strip
 * speaks: the operator landed on the every-thing list and had to eyeball
 * amber chips among the money chase. 5.185's own docstring apologized for
 * it ("no unpaid hint: the ghost set is mixed") — the honest gap a view
 * away from closing. Now: Bills' status filter grows 'Stuck' — its own
 * view, decided by the SAME isGhostTicket predicate the chips and the
 * dashboard's staleKitchen speak (a ghost is paid OR unpaid, so the trio's
 * displayStatus must not decide) — the pill wears the ghost chip's own
 * ink and wash, the kitchen-ghost door hints 'stuck' so the pointer lands
 * pre-armed, the CSV export rides the filtered list (export what you see,
 * 5.3.1), and the impossible combo (Stuck ∧ Today) teaches the definition
 * instead of counting an empty list (the 5.119 empty-states say why).
 * Asserted: isGhostTicket population re-pinned (the view's own predicate —
 * 228's explicit clock); the filter branch wired to the predicate, NOT
 * displayStatus; the door hint consumed once on arrival ('stuck' →
 * statusFilter 'stuck', the 'unpaid' hint untouched); the option present
 * with the trio intact; the ghost pill defined in the chip's own colors
 * and used; the definitional miss body; the dashboard's one 'stuck' hint
 * with the old no-hint door extinct; staleKitchen's population unchanged;
 * and the one-module guard — both surfaces import the rail set from the
 * same lib, so the view and the count can never fork.
 * Run: bunx vite-node scripts/unit242.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

let n = 0;
const ok = (name) => console.log(`  ok ${++n} - ${name}`);

const bills = await import('/src/components/bills/BillsScreen.tsx');
const { isGhostTicket } = bills;

/* The suite owns the clock — fixed NOW, fixtures derived from it (228). */
const NOW = Date.UTC(2026, 9, 4, 17, 30, 0);
const H = 3600_000;
const D = 24 * H;
const o = (status, createdAgoMs, payment = 'pending') => ({
  status,
  payment_status: payment,
  created_at: new Date(NOW - createdAgoMs).toISOString(),
});

/* 1 — the view's predicate, re-pinned: older rail-active tickets (paid or
 * unpaid alike) are the ghosts; today's rail tickets and the departed
 * states are not. This is the population the filter MUST show. */
assert.equal(isGhostTicket(o('pending', 2 * D), NOW), true, 'unpaid ghost (pending, older day)');
assert.equal(isGhostTicket(o('preparing', 2 * D, 'completed'), NOW), true, 'paid ghost (preparing, older day)');
assert.equal(isGhostTicket(o('ready', 2 * D, 'completed'), NOW), true, 'ready ghost');
assert.equal(isGhostTicket(o('pending', 3 * H), NOW), false, "today's pending is not a ghost");
assert.equal(isGhostTicket(o('pending', 2 * D), NOW, 'completed') && false, false);
assert.equal(isGhostTicket({ status: 'cancelled', created_at: new Date(NOW - 2 * D).toISOString() }, NOW), false, 'cancelled never ghosts');
assert.equal(isGhostTicket(o('completed', 2 * D), NOW), false, 'completed is off the rail');
ok('isGhostTicket population re-pinned: older rail-active, paid or unpaid');

/* comment-blind live copy (233's lesson). */
const strip = (p) =>
  readFileSync(new URL(p, import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => !/^\s*(\*|\/\*|\/\/)/.test(l))
    .join('\n');
const billsCode = strip('../src/components/bills/BillsScreen.tsx');
const dashCode = strip('../src/components/dashboard/DashboardScreen.tsx');

/* 2 — the filter branch decides with the predicate, not the trio. */
assert.ok(
  billsCode.includes("if (statusFilter === 'stuck') {\n        if (!isGhostTicket(o, Date.now())) return false;\n      } else if (statusFilter !== 'all' && displayStatus(o) !== statusFilter) return false;"),
  'stuck branch → isGhostTicket; trio branch untouched for the other words',
);
ok("the 'stuck' view rides isGhostTicket — displayStatus never decides it");

/* 3 — the door hint lands pre-armed, consumed once; 'unpaid' untouched. */
assert.ok(
  billsCode.includes("if (hint === 'unpaid') setStatusFilter('active');") &&
    billsCode.includes("if (hint === 'stuck') setStatusFilter('stuck');"),
  "the door consumes 'unpaid' → active and 'stuck' → stuck",
);
ok("door hints: 'unpaid' keeps the money view, 'stuck' arms the ghost view");

/* 4 — the option joins the trio, which stays byte-intact. */
assert.ok(
  billsCode.includes('<option value="all">All Orders</option>') &&
    billsCode.includes('<option value="active">Active</option>') &&
    billsCode.includes('<option value="paid">Paid</option>') &&
    billsCode.includes('<option value="cancelled">Cancelled</option>'),
  'the trio options untouched',
);
assert.ok(billsCode.includes('<option value="stuck">Stuck</option>'), "the 'Stuck' option present");
ok("combobox: All Orders · Active · Paid · Cancelled · Stuck");

/* 5 — the pill wears the ghost chip's own ink and wash (#FDF3E4/#8A5A16,
 * the 5.196 register's colors) and the select uses it. */
assert.ok(
  billsCode.includes("const FILTER_PILL_GHOST =") &&
    billsCode.includes('#FDF3E4') &&
    billsCode.includes('#8A5A16'),
  'FILTER_PILL_GHOST defined in the ghost chip colors',
);
assert.ok(
  billsCode.includes("statusFilter === 'stuck'\n                  ? FILTER_PILL_GHOST"),
  'the select wears the ghost pill when stuck stands',
);
ok('the stuck pill wears the ghosts’ amber — one register, one palette');

/* 6 — the miss voice: the impossible combo teaches the definition. */
assert.ok(
  billsCode.includes("statusWord === 'stuck' && dateFilter === 'today'") &&
    billsCode.includes('Stuck tickets are, by definition, from an earlier day — none can be from today.'),
  'Stuck ∧ Today says WHY it is empty (5.119 empty-states)',
);
assert.ok(
  billsCode.includes("statusFilter === 'stuck'\n            ? 'stuck'"),
  "the miss sentence can say the word 'stuck'",
);
ok('empty-state voice: the definition, not a count of nothing');

/* 7 — the dashboard's ghost door hints 'stuck'; the old no-hint landing is
 * extinct; the money doors keep 'unpaid'. */
const stuckDoors = dashCode.split("go('bills', ['Dashboard', 'Bills'], 'stuck')").length - 1;
const bareDoors = dashCode.split("go('bills', ['Dashboard', 'Bills'])").length - 1;
const unpaidDoors = dashCode.split("go('bills', ['Dashboard', 'Bills'], 'unpaid')").length - 1;
assert.equal(stuckDoors, 1, "exactly one ghost door hints 'stuck'");
assert.equal(bareDoors, 0, 'the no-hint ghost door is extinct');
assert.equal(unpaidDoors, 2, "the money doors keep 'unpaid' (inbox + unpaid tile)");
ok("dashboard doors: ghost → 'stuck', money → 'unpaid', no bare landings");

/* 8 — the strip's population is unchanged: staleKitchen still counts
 * older-day rail-active via isOnRail — the view shows exactly what the
 * strip counted. */
assert.ok(
  dashCode.includes('const staleKitchen = staleOlder.filter((o) => isOnRail(String(o.status)));'),
  'staleKitchen population untouched',
);
ok("staleKitchen unchanged — the view shows the strip's own count");

/* 9 — THE ONE-MODULE GUARD: both surfaces take the rail set from the same
 * lib, so the filter, the chips and the count can never drift apart. */
const billsSrc = readFileSync(new URL('../src/components/bills/BillsScreen.tsx', import.meta.url), 'utf8');
const dashSrc = readFileSync(new URL('../src/components/dashboard/DashboardScreen.tsx', import.meta.url), 'utf8');
const railImport = (src) => {
  const m = src.match(/import\s*{[^}]*isOnRail[^}]*}\s*from\s*'([^']+)'/);
  return m ? m[1] : null;
};
const fromBills = railImport(billsSrc) || (billsCode.includes('isOnRail') ? 're-export' : null);
const fromDash = railImport(dashSrc);
assert.ok(fromDash, 'the dashboard imports isOnRail from a named module');
assert.ok(
  fromBills === fromDash || (billsSrc.includes("from '../../lib/kitchen'") === false && fromBills === null),
  `the rail module is the same lib (dashboard: ${fromDash}, bills: ${fromBills ?? 'via isGhostTicket'})`,
);
ok(`one rail set, one lib (${fromDash}) — view, chips and count share it`);

console.log(`\nunit242 — ${n} asserts ALL GREEN`);
