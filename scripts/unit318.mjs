/* unit318 — v5.279.0 "the wait keeps one register" (agreement shape)
 * The census finding: the house's LIVE AGE voice — "how long has THIS
 * ticket been waiting?" — was hand-rolled in three grammars beside each
 * other:
 *   1. the counter's inbox rolled its own ageMinutes + ageLabel, whose
 *      minute word was "5 min" while the floor's TimeAgo said "5m" for
 *      the SAME ticket's age — twins disagreeing about one wait;
 *   2. the floor's TimeAgo re-rolled the same math a second time (and
 *      expiryRel a third, with its own Math.max(1, mins) span copy);
 *   3. prefs.timeAgo — the LONG register ("3 minutes ago", the narrative
 *      voice Messages/Platform/Notifications speak) — lived in the prefs
 *      lib, where no preference ever asked for it.
 * And the house's 10-minute SLA — the kitchen board's amber, the EOD
 * strip's mirror, Reports' breach count, the counter's red line — was a
 * bare literal in four files, no single owner.
 * THE ROUND: lib/age.ts — the wait's ONE home, importing NOTHING.
 * ageSpan is the span grammar ("5m" / "1h 12m", byte-identical to
 * turn.ts's seatSpanLabel at every real duration); ageCompact speaks
 * "just now" under a minute (a state, not a span — turn.ts doctrine);
 * ageLong is the narrative register (timeAgo's new home — a wait is not
 * a preference); AGE_SLA_MIN is the house's attention line, ONE home.
 * The counter's red pill says "· late" (the breach says itself, not just
 * tints itself) and the queue's live SLA strip stands above the ticket
 * row: N past the line, the oldest wait, the one action that clears it. */

import { readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const read = (p) => readFileSync(`/home/z/my-project/${p}`, 'utf8');
const walk = (dir, acc = []) => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = `${dir}/${e.name}`;
    if (e.isDirectory()) walk(p, acc);
    else if (/\.(tsx?|mjs)$/.test(e.name)) acc.push(p);
  }
  return acc;
};

const ageLib = read('src/lib/age.ts');
const counter = read('src/components/food/CounterInbox.tsx');
const floor = read('src/components/floor/FloorScreen.tsx');
const prefs = read('src/lib/prefs.ts');
const messages = read('src/components/messages/MessagesScreen.tsx');
const platform = read('src/components/platform/PlatformScreen.tsx');
const notifications = read('src/components/notifications/NotificationsScreen.tsx');
const kitchen = read('src/components/kitchen/KitchenScreen.tsx');
const eod = read('src/components/eod/EodScreen.tsx');
const reports = read('src/components/reports/ReportsScreen.tsx');
const turn = read('src/lib/turn.ts');
const shelf = read('src/lib/shelf.ts');
const i18n = read('src/lib/guest-i18n.ts');
const version = read('src/version.ts');
const sw = read('public/sw.js');

function check(name, fn) {
  test(name, () => fn());
  console.log(`  running — ${name}`);
}

/* ── 1. the lib speaks the census ─────────────────────────────────────── */
check('the age lib exists and speaks its census — the span, the state, the long word, the ONE SLA', () => {
  assert.match(ageLib, /the wait's ONE register \(v5\.279\.0\)/, 'the lib names its round');
  assert.match(ageLib, /twins disagreeing about one wait/, 'the census finding named');
  // imports NOTHING — the register's arithmetic depends on nothing
  assert.ok(!/^\s*import /m.test(ageLib), 'lib/age imports nothing');
  // the span grammar — byte shapes, the floor
  assert.match(ageLib, /export function ageSpan\(mins: number\): string \{/, 'ageSpan exported');
  assert.match(ageLib, /const m = Math\.max\(1, Math\.floor\(mins\)\);/, 'the span starts at one minute');
  assert.match(ageLib, /return h > 0 \? `\$\{h\}h \$\{m % 60\}m` : `\$\{m\}m`;/, 'the span words: "1h 12m" / "5m"');
  // the state word — sub-minute is a state, not a span
  assert.match(ageLib, /export function ageCompact\(iso: string, nowMs: number\): string \{/, 'ageCompact exported');
  assert.match(ageLib, /return m < 1 \? 'just now' : ageSpan\(m\);/, '"just now" under a minute, then the span');
  // the long register — timeAgo's words, moved not rewritten
  assert.match(ageLib, /export function ageLong\(iso: string, nowMs: number = Date\.now\(\)\): string \{/, 'ageLong exported, ownable clock');
  assert.match(ageLib, /if \(m < 1\) return 'Just now';/, 'the long register keeps its words');
  assert.match(ageLib, /return `\$\{m\} minute\$\{m === 1 \? '' : 's'\} ago`;/, 'the plural minute word');
  // the ONE SLA
  assert.match(ageLib, /export const AGE_SLA_MIN = 10;/, 'the house attention line has ONE home');
  assert.match(ageLib, /prefs\.timeAgo's new home/, 'the mis-homing named in the lib');
});

/* ── 2. the counter rides the register ────────────────────────────────── */
check('the counter retires its hand-rolled twins and rides the register — the late word, the live strip', () => {
  assert.match(counter, /import \{ ageCompact, ageMinutes, AGE_SLA_MIN \} from '\.\.\/\.\.\/lib\/age';/, 'the import edge');
  // the twins retired — the lib's shapes now, not the locals
  assert.ok(!/function ageLabel\(/.test(counter), 'the local ageLabel is GONE');
  assert.ok(!/function ageMinutes\(/.test(counter), 'the local ageMinutes is GONE');
  assert.ok(!/\$\{m\} min`/.test(counter), 'the "5 min" grammar is GONE — the register says "5m"');
  assert.match(counter, /\{ageCompact\(order\.created_at, nowMs\)\}/, 'the pill speaks the lib word');
  // the warn stays the counter's own judgment, named
  assert.match(counter, /const WARN_MIN = 5;/, 'the 5-minute warn named, its one opinion legible');
  assert.match(counter, /const late = mins >= AGE_SLA_MIN;/, 'the red line rides the ONE constant');
  assert.match(counter, /mins >= WARN_MIN/, 'the amber line rides the named warn');
  // the breach says itself
  assert.match(counter, /\{late \? <span className="uppercase tracking-wide">· late<\/span> : null\}/, 'the red pill says "· late"');
  assert.match(counter, /title=\{late \? `Past the \$\{AGE_SLA_MIN\}-minute SLA — waiting at the counter` : 'Waiting at the counter'\}/, 'the title carries the law');
  // the live strip — gated, honest, one action
  assert.match(counter, /const lateTickets = useMemo\(/, 'the strip derives from the rendered list');
  assert.match(counter, /\(\(t\) => ageMinutes\(t\.created_at, nowMs\) >= AGE_SLA_MIN\)/, 'the same census the pills speak');
  assert.match(counter, /\{lateTickets\.length > 0 && tickets\.length > 0 \? \(/, 'GATED — no zero-band lie');
  assert.match(counter, /\{lateTickets\.length\} past the \{AGE_SLA_MIN\}-min SLA · oldest \{ageCompact\(tickets\[0\]\.created_at, nowMs\)\}/, 'the count, the line, the oldest wait');
  assert.match(counter, /Ok the oldest first/, 'the one action that clears it');
  assert.match(counter, /aria-label=\{`\$\{lateTickets\.length\} \$\{lateTickets\.length === 1 \? 'ticket has' : 'tickets have'\} waited past the \$\{AGE_SLA_MIN\}-minute SLA/, 'the full sentence for the screen reader');
  assert.match(counter, /border-l-\[3px\] border-\[#B45309\] bg-\[#FFF4DB\]/, 'the chase amber family — 5.243\u2019s left rule');
});

/* ── 3. the floor agrees ──────────────────────────────────────────────── */
check('the floor rides the register — TimeAgo and expiryRel speak the one grammar, the breath kept', () => {
  assert.match(floor, /import \{ ageCompact, ageSpan \} from '\.\.\/\.\.\/lib\/age';/, 'the import edge');
  // the hand-rolled ternary is gone
  assert.ok(!/mins < 1 \? 'just now' : mins < 60 \? `\$\{mins\}m`/.test(floor), 'TimeAgo\u2019s hand-rolled grammar GONE');
  assert.match(floor, /\{ageCompact\(iso, Date\.now\(\)\)\}/, 'TimeAgo speaks the lib word');
  assert.match(floor, /<span className="tabular-nums" title="Time since the ticket was placed">/, 'tabular-nums + the title — the tick does not jitter');
  // expiryRel keeps its edge, rides the span
  assert.match(floor, /const span = ageSpan\(mins\);/, 'expiryRel rides the span grammar');
  assert.ok(!/Math\.max\(1, mins\)/.test(floor), 'the inline span copy is GONE');
  assert.match(floor, /diffMs >= 0 \? `\$\{span\} left` : `\$\{span\} ago`/, 'the future-vs-past edge kept');
  // the four-interval law — the self-breath stays
  const intervalCount = floor.split('window.setInterval(').length - 1;
  assert.equal(intervalCount, 4, `exactly the four pre-existing intervals (TimeAgo, the heartbeat, the promise tick, the poll) — found ${intervalCount}`);
});

/* ── 4. the long register's new home ─────────────────────────────────── */
check('timeAgo has LEFT prefs — the narrative voices ride lib/age\u2019s ageLong', () => {
  assert.ok(!/export function timeAgo/.test(prefs), 'prefs no longer holds the age register');
  assert.match(prefs, /timeAgo has LEFT the prefs lib/, 'the redirect note names the new home');
  for (const [name, src] of [['messages', messages], ['platform', platform], ['notifications', notifications]]) {
    assert.ok(src.includes("from '../../lib/age'"), `${name} imports the age lib`);
    assert.ok(!/\btimeAgo\s*\(/.test(src), `${name} no longer CALLS the old name (the comment may name the history)`);
    assert.ok(src.includes('ageLong('), `${name} rides ageLong`);
  }
  // the whole tree — no importer left behind
  const strays = walk('src').filter((p) => !p.endsWith('lib/prefs.ts') && !p.endsWith('lib/age.ts') && read(p).includes('timeAgo('));
  assert.deepEqual(strays, [], 'no src file still CALLS timeAgo — census clean');
});

/* ── 5. the SLA has ONE home ─────────────────────────────────────────── */
check('the 10-minute line has ONE home — kitchen, EOD, reports and the counter ride AGE_SLA_MIN', () => {
  assert.match(kitchen, /import \{ AGE_SLA_MIN \} from '\.\.\/\.\.\/lib\/age';/, 'kitchen rides the constant');
  assert.match(kitchen, /if \(mins >= AGE_SLA_MIN\) return '#B88E2F';/, 'the amber escalation rides it');
  assert.match(kitchen, /if \(mins >= 20\) return '#B42318';/, 'the RED line stays the kitchen\u2019s own judgment (20m)');
  assert.ok(!/mins >= 10\)/.test(kitchen), 'the bare 10 literal GONE from the kitchen');
  assert.match(eod, /import \{ AGE_SLA_MIN \} from '\.\.\/\.\.\/lib\/age';/, 'EOD rides the constant');
  assert.match(eod, /const LATE_PREP_MIN = AGE_SLA_MIN;/, 'the mirror rides the one home (the local word stays — the strip speaks the KDS\u2019s shout)');
  assert.ok(!/LATE_PREP_MIN = 10/.test(eod), 'the EOD\u2019s bare 10 literal GONE');
  assert.match(reports, /import \{ AGE_SLA_MIN \} from '\.\.\/\.\.\/lib\/age';/, 'reports rides the constant');
  assert.match(reports, /const breaches = sample\.filter\(\(t\) => t\.minutes > AGE_SLA_MIN\);/, 'the breach count rides it');
  assert.ok(!/t\.minutes > 10/.test(reports), 'the reports\u2019 bare 10 literal GONE');
});

/* ── 6. the doctrine stands ──────────────────────────────────────────── */
check('the deliberate registers stand untouched — the finished span, the shelf, the guest twin', () => {
  // turn.ts: the FINISHED seat's register — "<1m" is a span, never a state
  assert.match(turn, /export function seatSpanLabel\(minutes: number\): string \{/, 'the seat-span lib exported');
  assert.match(turn, /return m < 1 \? '<1m' : h > 0 \? `\$\{h\}h \$\{m % 60\}m` : `\$\{m\}m`;/, 'the finished span keeps "<1m" — ageCompact\u2019s "just now" never leaks into it');
  assert.match(turn, /ONE duration register/, 'the reconciliation doctrine stands');
  assert.ok(!turn.includes('lib/age'), 'turn.ts does not lean on the age lib — two libs, two questions, one voice by agreement');
  // shelf: the coverage register, deliberate and named
  assert.match(shelf, /'today' \| 'Nd ago'/, 'the shelf\u2019s own register stands');
  // guest twin: the translated age words live in the i18n home
  assert.match(i18n, /ageNow: 'just now',/, 'the guest\u2019s ageNow stands');
  assert.match(i18n, /ageMin: '\{n\} min ago',/, 'the guest\u2019s translated minute word stands');
  // the kitchen stopwatch keeps its own seconds-true voice
  assert.match(kitchen, /function elapsed\(createdIso: string, nowMs: number\): string \{/, 'the stopwatch stands');
});

/* ── 7. behavior over the matrix ─────────────────────────────────────── */
check('the register behaves — the matrix, the owned clock, the never-negative floor', async () => {
  const lib = await import('/src/lib/age.ts');
  const now = Date.parse('2026-10-06T14:00:00+05:30');
  const at = (min) => new Date(now - min * 60000).toISOString();
  // ageMinutes — never negative
  assert.equal(lib.ageMinutes(at(5), now), 5, 'five minutes waited');
  assert.equal(lib.ageMinutes(new Date(now + 60000).toISOString(), now), 0, 'a future stamp waited zero, not minus');
  // ageSpan — the floor at one minute
  assert.equal(lib.ageSpan(5), '5m', 'the minute word — the counter\u2019s old "5 min" now the register');
  assert.equal(lib.ageSpan(72), '1h 12m', 'the hour word');
  assert.equal(lib.ageSpan(0.4), '1m', 'a span starts at one minute — the state word is ageCompact\u2019s');
  // ageCompact — the state and the span
  assert.equal(lib.ageCompact(at(0.5), now), 'just now', 'sub-minute is a state');
  assert.equal(lib.ageCompact(at(5), now), '5m', 'the register — twins agreeing again');
  assert.equal(lib.ageCompact(at(72), now), '1h 12m', 'the hour word through the compact door');
  // ageLong — timeAgo\u2019s words, byte-equal, on the owned clock
  assert.equal(lib.ageLong(at(0.5), now), 'Just now', 'the capitalized state');
  assert.equal(lib.ageLong(at(1), now), '1 minute ago', 'the singular');
  assert.equal(lib.ageLong(at(2), now), '2 minutes ago', 'the plural');
  assert.equal(lib.ageLong(at(90), now), '1 hour ago', 'the hour');
  assert.equal(lib.ageLong(at(1500), now), '1 day ago', 'the day');
  // the ONE SLA
  assert.equal(lib.AGE_SLA_MIN, 10, 'the house\u2019s attention line');
});

/* ── 8. the version law (agreement shape) ────────────────────────────── */
check('the version law — version.ts and sw.js carry the same word', () => {
  const v = version.match(/APP_VERSION = '([\d.]+)'/)?.[1];
  assert.ok(v, 'version.ts holds a version');
  assert.match(sw, new RegExp(`servepoint-v${v.replace(/\./g, '\\.')}-r1`), 'sw.js bakes the same word');
});
