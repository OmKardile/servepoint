/**
 * unit285 — v5.246.0 "the operator's ledger speaks its size".
 *
 * The round's laws, pinned:
 *   1. THE WHOLE-LEDGER READ — api.ts's fetchAuditLogs() lost the silent
 *      50 cap born with the surface: no .limit/.range call, the
 *      newest-first order byte-true, requireCloud + the throw kept. The
 *      platform's own record of record reads the bounds it speaks (the
 *      5.281 money-book precedent; the 5.284 lesson, one register over).
 *   2. ONE READ, TWO DERIVATIONS — the Platform's load() calls
 *      fetchAuditLogs() with NO argument (the numbered-arg call form is
 *      extinct from the file's code); the Dashboard's Recent activity
 *      keeps its slice(0, 10) — a client-side derivation of THIS read,
 *      not a second read shape.
 *   3. THE CENSUS VOICE — the Audit tab's header speaks
 *      "N events on record" (pluralized by the row count), silent while
 *      loading and at zero (the empty state owns the zero).
 *   4. THE TIME WORD SPEAKS BOTH REGISTERS — the drawer-card grammar
 *      (5.179) joins the platform's rows: timeAgo answers "how fresh?",
 *      dayTime(iso, appTimezone()) stamps the record's absolute when.
 *      The stamp's class core is byte-equal in BOTH rooms (ActivityRow
 *      and the Audit tab's ledger rows) — one stamp language.
 *   5. DAYTIME BEHAVIOR — over the matrix: today → "HH:MM" bare,
 *      yesterday → "Yesterday HH:MM", older → "2 Oct · HH:MM" (the
 *      middot joins only a calendar date), unreadable → "—". Judged in
 *      the app's reporting zone (appTimezone), never the device's.
 *   6. NO OTHER ROOM MOVED — fetchTenants / fetchSubscriptions keep
 *      their bytes; the audit tab's row grammar (action / details /
 *      actor / timeAgo) keeps its shape, the stamp ADDED beneath.
 *   7. THE VERSION LAW in the agreement shape.
 *
 * Run: bunx vite-node scripts/unit285.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

let n = 0;
const ok = (name) => console.log(`  ok ${++n} - ${name}`);
const strip = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');

/* ── the live word — behavior, not bytes ── */
const { dayTime } = await import('/src/lib/day.ts');
const { appTimezone } = await import('/src/lib/appday.ts');

const api = strip('../src/lib/api.ts');
const platform = strip('../src/components/platform/PlatformScreen.tsx');
const versionTs = strip('../src/version.ts');
const swJs = strip('../public/sw.js');

/* 1 — the whole-ledger read: the silent cap retired. */
{
  const fn = api.slice(
    api.indexOf('export async function fetchAuditLogs'),
    api.indexOf('export interface ProvisionInput'),
  );
  assert.ok(fn.includes('requireCloud()'), 'the read gates on cloud');
  assert.match(fn, /export async function fetchAuditLogs\(\): Promise<AuditLogEntry\[\]>/,
    'the contract is the whole ledger — no parameter, no default');
  assert.match(fn, /\.from\('platform_audit_logs'\)/, 'the ledger table');
  assert.match(fn, /\.select\('\*'\)/, 'the full row');
  assert.match(fn, /\.order\('timestamp', \{ ascending: false \}\)/,
    'newest-first, byte-true with the surface that was');
  assert.ok(!/\.limit\(|\.range\(/.test(fn), 'no cap — the operator\'s ledger reads whole');
  assert.match(fn, /if \(error\) throw error;/, 'the read THROWS — the caller speaks its own error door');
  ok('the whole-ledger read: no cap, order held, cloud gate + throw held');
}

/* 2 — one read, two derivations: the numbered call form is extinct. */
{
  assert.ok(!/fetchAuditLogs\(\s*\d/.test(platform),
    'no numbered fetchAuditLogs call anywhere in the Platform');
  assert.match(platform, /fetchAuditLogs\(\),/, 'the load() rides the whole-ledger read');
  assert.match(platform, /const recentLogs = useMemo\(\(\) => \(logs \?\? \[\]\)\.slice\(0, 10\), \[logs\]\);/,
    'the Dashboard strip keeps its slice — a derivation of THIS read');
  ok('one read, two derivations: the call site uncapped, the strip\'s slice held');
}

/* 3 — the census voice: the ledger speaks its size. */
{
  assert.ok(platform.includes('on record'), 'the census word exists');
  assert.match(platform,
    /\{logs\.length\} \{logs\.length === 1 \? 'event' : 'events'\} on record/,
    'the count is the row count, pluralized honestly');
  assert.match(platform, /logs !== null && logs.length > 0 &&/,
    'the voice is gated: silent while loading, the empty state owns the zero');
  ok('the census voice: "N events on record", pluralized, gated');
}

/* 4 — the time word speaks both registers, one stamp language, two rooms. */
{
  assert.match(platform, /import \{ dayTime \} from '\.\.\/\.\.\/lib\/day';/, 'the day grammar import');
  assert.match(platform, /import \{ appTimezone \} from '\.\.\/\.\.\/lib\/appday';/, 'the zone import — the reporting zone, not the device\'s');
  const stamp = `dayTime(log.timestamp, appTimezone())`;
  assert.equal(platform.split(stamp).length - 1, 2, 'the stamp rides BOTH rooms');
  const core = `className="mt-0.5 text-[11px] text-[#969696]"`;
  assert.equal(platform.split(core).length - 1, 2, 'the stamp\'s class core byte-equal across the rooms');
  assert.equal(platform.split('timeAgo(log.timestamp)').length - 1, 2,
    'timeAgo stays the "how fresh?" register in both rooms');
  ok('both registers on both rooms: timeAgo + the dayTime stamp, one class core');
}

/* 5 — dayTime behavior over the matrix, judged in the reporting zone. */
{
  const tz = appTimezone();
  /* 228's doctrine — the suite owns the clock: a fixed IST afternoon. */
  const nowMs = Date.parse('2026-10-05T10:00:00.000Z'); // 15:30 IST
  const todayIso = '2026-10-05T09:14:00.000Z';    // 14:44 IST today
  const yesterdayIso = '2026-10-04T09:14:00.000Z'; // 14:44 IST yesterday
  const olderIso = '2026-10-02T04:44:00.000Z';    // 10:14 IST, 2 Oct
  assert.match(dayTime(todayIso, tz, nowMs), /^\d{2}:\d{2}$/, 'today: the bare clock');
  assert.equal(dayTime(yesterdayIso, tz, nowMs), 'Yesterday 14:44', 'yesterday: the plain space');
  assert.equal(dayTime(olderIso, tz, nowMs), '2 Oct · 10:14', 'older: the middot joins a calendar date');
  assert.equal(dayTime('not-a-date', tz, nowMs), '—', 'unreadable: the dash — never a fake time');
  ok('dayTime behavior: today bare / Yesterday space / older middot / unreadable dash');
}

/* 6 — no other room moved. */
{
  assert.match(api, /export async function fetchTenants\(\): Promise<Tenant\[\]> \{[\s\S]*?\.order\('created_at', \{ ascending: false \}\);/,
    'fetchTenants keeps its bytes');
  assert.match(api, /export async function fetchSubscriptions\(\): Promise<Subscription\[\]> \{[\s\S]*?\.order\('created_at', \{ ascending: false \}\);/,
    'fetchSubscriptions keeps its bytes');
  assert.match(platform, /\{log\.action\}/, 'the row\'s action word held');
  assert.match(platform, /\{log\.details &&/, 'the row\'s details line held');
  assert.match(platform, /\{log\.actor_email \|\| 'System'\}/, 'the row\'s actor line held');
  assert.match(platform, /\{logs\.map\(\(log\) => \(/, 'the audit tab still maps the WHOLE read');
  ok('no other room moved: tenants/subscriptions bytes, the row grammar\'s shape');
}

/* 7 — the version law, in the agreement shape (the suite reads BOTH sides
 *     and asserts they AGREE — version-agnostic, so the law survives every
 *     future bump; the 5.286 re-anchor joins the honest-re-anchor family). */
{
  const v = versionTs.match(/APP_VERSION = '([\d.]+)'/)?.[1];
  const sw = swJs.match(/const VERSION = "servepoint-v([\d.]+)-r1"/)?.[1];
  assert.ok(v && sw, 'both sides carry a version');
  assert.equal(v, sw, 'version.ts and sw.js speak the SAME version');
  ok(`the version law: ${v} on both sides`);
}

console.log(`\nunit285 — ${n} checks green.`);
