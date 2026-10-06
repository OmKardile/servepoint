/* Task 271 — v5.232.0 unit suite: one clock, every surface.
 *
 * The Platform's own audit found a 5.198 gap on the never-audited side of
 * the console: lib/billing.ts has been the ONE billing grammar since
 * 5.126/5.133 ("one grammar for both surfaces"), and the Subscriptions
 * table spoke it — but the Businesses surface answered bare words: a
 * status chip said "trial" while Subscriptions said "Trial ends 16 Oct
 * 2026 · 11 days left · no charge yet". The operator crossed rooms to
 * learn what the row already knew. And the class law behind the urgent
 * amber lived twice (the subscriptions table's IIFE and the mobile
 * card's IIFE) — a fork waiting to drift.
 *
 * v5.232.0: the businesses' clock joins ONCE (subByTenantId Map) and the
 * SAME words reach every business voice — the desktop status cell, the
 * mobile card's Plan/Subscription rows, the details panel (Plan via
 * planLabel + the words), and the dashboard's Recent strip (a trialing
 * business names its end date in the line it already speaks, words.primary
 * verbatim — no third phrasing). The two subscriptions IIFEs retire into
 * BillingWords — the class law lives in ONE component (5.196's shape,
 * applied to ink: one set, no fork). The four KPI tiles answer the walking
 * questions: who carries the MRR, when the money next moves, when the
 * nearest trial ends, where the fleet lives — honest silence when there is
 * nothing to name.
 *
 * Asserted: billing.ts's contract untouched (the clock's own behavior);
 * planLabel imported; the join as ONE memo Map; BillingWords is the single
 * class-law site (the inline fork EXTINCT from the tables) used at FIVE
 * sites; the businesses voices (desktop cell + mobile dl + details panel
 * + strip clause gated on trialing); the KPI hint laws (carrier named when
 * single, nearest end, silence at zero); no new timer (the screen keeps
 * zero intervals — mount load + manual retry).
 * Run: bunx vite-node scripts/unit271.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { subscriptionWords, planLabel, trialBucket, daysUntil } from '/src/lib/billing.ts';

let n = 0;
const ok = (name) => console.log(`  ok ${++n} - ${name}`);
const strip = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');

/* ── 1–4: the shared clock's contract, unchanged (billing.ts untouched) ── */

const trialLike = { status: 'trialing', trial_end: '2026-10-16T00:00:00Z' };
const words = subscriptionWords(trialLike);
assert.match(words.primary, /Trial ends 16 Oct 2026/);
assert.match(words.secondary ?? '', /days left · no charge yet/);
assert.equal(words.urgent, false);
ok("the clock's words: 'Trial ends 16 Oct 2026 · N days left · no charge yet' (calm bucket)");

assert.equal(subscriptionWords({ status: 'trialing' }).primary, '—', 'no invented dates');
assert.equal(planLabel('growth'), 'Growth');
assert.equal(trialBucket(2), 'last');
assert.equal(trialBucket(11), 'calm');
assert.ok(Number.isNaN(daysUntil('')), 'daysUntil: unparsable stays NaN');
ok("the clock's contract: wordless without a date, planLabel, the buckets — billing.ts untouched");

/* ── source pins — the wiring cannot lie ── */
const src = strip('../src/components/platform/PlatformScreen.tsx');

/* 2 — planLabel joins subscriptionWords from the same lib. */
assert.ok(
  src.includes("import { daysUntil, planLabel, subscriptionWords, trialBucket, trialRelWords } from '../../lib/billing';"),
  'planLabel rides the same import as the words (v5.304.0 grew the clock family on the same line)'
);
ok('import: planLabel + subscriptionWords from the one clock');

/* 3 — the join is ONE memo Map, not per-row finds. */
assert.ok(
  src.includes('const subByTenantId = useMemo(\n    () => new Map((subs ?? []).map((s) => [s.tenant_id, s] as const)),\n    [subs]\n  );'),
  'the businesses clock joins once'
);
const joinUses = src.split('subByTenantId.get(').length - 1;
assert.equal(joinUses, 4, 'four readers, one Map (the strip call site, the desktop cell, the mobile card, the details panel)');
ok('one join: subByTenantId Map memo — four readers, one register');

/* 4 — BillingWords: the class law in ONE component. */
assert.ok(
  src.includes("const BillingWords: React.FC<{\n  cell: ReturnType<typeof subscriptionWords>;\n  block?: boolean;\n}>"),
  'BillingWords exists with the words shape'
);
const primaryLaw = src.split("cell.urgent ? 'font-semibold text-[#B42318]' : 'text-[#6B6B6B]'").length - 1;
const secondaryLaw = src.split("cell.urgent ? 'font-medium text-[#B42318]' : 'text-[#969696]'").length - 1;
assert.equal(primaryLaw, 1, 'the primary ink law lives exactly once');
assert.equal(secondaryLaw, 1, 'the secondary ink law lives exactly once');
ok('class law: the amber pair lives in ONE component — the IIFE fork extinct');

/* 5 — five projections read the one law. */
const billingWordsUses = src.split('<BillingWords').length - 1;
assert.equal(billingWordsUses, 5, 'BillingWords at five sites: businesses cell, businesses mobile, details panel, subscriptions table, subscriptions card');
ok('five projections: businesses cell + card + details, subscriptions table + card');

/* 6 — the businesses desktop status cell speaks beneath the chip. */
assert.ok(
  src.includes('<StatusChip status={t.status} />') && src.includes('the status cell hears the clock'),
  'the desktop chip keeps its word with the clock beneath'
);
ok('businesses desktop: chip + the subscription words beneath');

/* 7 — the mobile card gains Plan + Subscription rows. */
assert.ok(
  src.includes('the mobile card hears the clock') && src.includes('<dt className="text-[#969696]">Plan</dt>'),
  'the mobile dl names the plan'
);
ok('businesses mobile: Plan + Subscription rows');

/* 8 — the details panel: Plan via planLabel, the words beside it, honest
 * dash when no subscription row exists. */
assert.ok(
  src.includes("{sub ? planLabel(sub.plan_id) : '—'}"),
  'planLabel answers Plan, dash when unknown'
);
assert.ok(
  src.includes('{sub ? <BillingWords cell={billingCell(sub)} /> : <span className="text-[13px] font-medium text-[#1A1A1A]">—</span>}'),
  'the words answer Subscription, dash when unknown'
);
ok('details panel: Plan + Subscription with honest dashes');

/* 9 — the Recent strip: ONLY a trialing business names its end, in the
 * clock's exact words; active rows stay calm. */
assert.ok(
  src.includes("const trialClause = cell && (sub?.status === 'trialing' || sub?.status === 'trial') && cell.primary !== '—' ? cell.primary : null;"),
  'the strip clause is gated on trialing + wordless-safe'
);
assert.ok(
  src.includes('{trialClause}'),
  'the clause renders the clock words verbatim'
);
ok('strip: trial clause = words.primary, trialing only — active rows calm');

/* 10 — the KPI hints: the walking questions, honest silence at zero. */
assert.ok(
  src.includes('hint?: string'),
  'KpiCard carries an optional hint'
);
assert.ok(
  src.includes('mt-1.5 truncate text-[11.5px]'),
  'the hint keeps its size and seat'
);
assert.ok(
  src.includes(": 'font-medium text-[#969696]'"),
  'the hint wears the line-grey voice (v5.304.0 moved the tone into a ternary — grey stays the default arm)'
);
assert.ok(
  src.includes('`from ${tenantNameById.get(payingSubs[0].tenant_id) || \'—\'} · ${planLabel(payingSubs[0].plan_id)}`'),
  'the MRR hint names its single carrier and plan'
);
assert.ok(
  src.includes('`from ${payingSubs.length} paying subscriptions`'),
  'many carriers count; zero stays silent (undefined)'
);
assert.ok(
  src.includes('${trialRelWords(nearestTrial.d)} · ${formatDate(nearestTrial.end)}`'),
  'the trials hint names the nearest end (v5.304.0: business + the rows\u2019 own rel words + the owner\u2019s date)'
);
assert.ok(
  src.includes('`next charge ${formatDate(nextCharges[0])}`'),
  'the active-subscriptions hint names the next charge'
);
assert.ok(
  src.includes("hint={mrrHint}") && src.includes("hint={trialsHint}") && src.includes("hint={activeSubsHint}") && src.includes("hint={businessesHint}"),
  'all four tiles wired'
);
ok('KPI hints: carrier named, nearest end, next charge, cities — silence at zero');

/* 11 — no new timer: the Platform loads on mount and retries by hand. */
const timers = src.match(/setInterval/g) || [];
assert.equal(timers.length, 0, 'setInterval count stands at 0 (mount load + manual retry)');
ok('no new timer: a join and a render, not a clock');

console.log(`\nunit271 — ${n} checks green`);
