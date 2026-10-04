/* Task 218 — v5.179.0 unit suite: the shifts' days.
 * Covers the new pure voice in src/lib/day.ts:
 *   daySpan(openIso, closeIso?) — the day-aware span a SHIFT speaks: the
 *   day word rides the open end once for a same-day span ("08:50–19:10"
 *   today byte-identical, "Yesterday 08:50–19:10", "2 Oct · 08:50–19:10"),
 *   both ends stamped when a shift crosses midnight, "—" for any unreadable
 *   or missing end — never a fake time. Plus the dayTime regression the
 *   drawer card now rides (the "Last shift closed 19:10"-at-18:04 lie).
 * Run: bunx vite-node scripts/unit218.mjs
 */
import assert from 'node:assert/strict';

const { daySpan, dayTime } = await import('/src/lib/day.ts');

let n = 0;
const ok = (name) => console.log(`  ok ${++n} - ${name}`);

/* Local calendar builders — daySpan compares LOCAL days, so the fixtures
 * must be built in local time and handed over as ISO. */
const at = (dayOffset, h, m) => {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
};
const cal = (d) => new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' }).format(d);

/* 1 — today's span stays byte-identical: the bare clocks, as always. */
assert.equal(daySpan(at(0, 8, 50), at(0, 19, 10)), '08:50–19:10');
ok('today: bare "08:50–19:10" byte-identical (today needs no introduction)');

/* 2 — yesterday's span gains the word. */
assert.equal(daySpan(at(-1, 8, 50), at(-1, 19, 10)), 'Yesterday 08:50–19:10');
ok('yesterday: "Yesterday 08:50–19:10" — the word beats date math');

/* 3 — an older span wears the calendar with the middot. */
const older = new Date();
older.setDate(older.getDate() - 3);
older.setHours(8, 50, 0, 0);
assert.equal(daySpan(older.toISOString(), at(-3, 19, 10)), `${cal(older)} · 08:50–19:10`);
ok('older: "2 Oct · 08:50–19:10" voice (en-IN, no year)');

/* 4 — cross-midnight into today: the open end stamped, the close bare. */
assert.equal(daySpan(at(-1, 23, 50), at(0, 0, 40)), 'Yesterday 23:50–00:40');
ok('cross-midnight (yesterday → today): "Yesterday 23:50–00:40"');

/* 5 — cross-midnight older: both ends stamped the dayTime way. */
const d5a = new Date();
d5a.setDate(d5a.getDate() - 3);
d5a.setHours(23, 50, 0, 0);
const d5b = new Date();
d5b.setDate(d5b.getDate() - 2);
d5b.setHours(0, 40, 0, 0);
assert.equal(daySpan(d5a.toISOString(), d5b.toISOString()), `${cal(d5a)} · 23:50–${cal(d5b)} · 00:40`);
ok('cross-midnight (older → older): both ends calendar-stamped');

/* 6 — a missing close renders "—" at that end, never a fake time. */
assert.equal(daySpan(at(-1, 8, 50), null), 'Yesterday 08:50–—');
ok('missing close: "Yesterday 08:50–—"');

/* 7 — an unreadable open keeps the readable end speaking. */
assert.equal(daySpan('not-a-date', at(0, 19, 10)), '—–19:10');
ok('unreadable open: "—–19:10" — the readable end speaks');

/* 8 — an unreadable close degrades to the dash after a stamped open. */
assert.equal(daySpan(at(-1, 8, 50), 'garbage'), 'Yesterday 08:50–—');
ok('unreadable close: "Yesterday 08:50–—"');

/* 9 — the open end IS dayTime: the null-close span shares the family voice. */
assert.equal(daySpan(at(-3, 8, 50), null), `${dayTime(at(-3, 8, 50))}–—`);
ok('open end = dayTime byte-true (one grammar, no drift)');

/* 10 — dayTime regression for the "Last shift closed" line: the live lie
 * dies — a 19:10 that is yesterday's reads "Yesterday 19:10", today's
 * stays bare. */
assert.equal(dayTime(at(-1, 19, 10)), 'Yesterday 19:10');
assert.equal(dayTime(at(0, 19, 10)), '19:10');
assert.equal(dayTime(at(-2, 9, 5)), `${cal(new Date(new Date().setDate(new Date().getDate() - 2)))} · 09:05`);
ok('dayTime: yesterday bare-clock lie dies, today stays bare, older middot');

/* 11 — the tz path (the drawer passes the reporting timezone): a stored
 * instant rendered in Asia/Kolkata, deterministic regardless of the
 * machine's own zone. 03:20Z = 08:50 IST, 13:40Z = 19:10 IST, both 30 Sept
 * in the cafe even when UTC agrees — the calendar word + bare clocks. */
assert.equal(daySpan('2026-09-30T03:20:00Z', '2026-09-30T13:40:00Z', 'Asia/Kolkata'), '30 Sept · 08:50–19:10');
ok('tz span (older, IST): "30 Sept · 08:50–19:10" — reporting-zone facts');

/* 12 — THE DISCRIMINATOR: same stored instants, different zones, different
 * days. 13:40Z→19:10Z is one UTC afternoon but crosses IST midnight
 * (19:10 IST 30 Sept → 00:40 IST 1 Oct) — the tz path must stamp both
 * ends, whichever device runs the suite. */
assert.equal(daySpan('2026-09-30T13:40:00Z', '2026-09-30T19:10:00Z', 'Asia/Kolkata'), '30 Sept · 19:10–1 Oct · 00:40');
ok('tz discriminator: IST midnight crossing stamps both ends');

/* 13 — the last-closed line in the reporting zone: en-IN September is
 * "Sept", and the clock is the cafe's, not the device's. */
assert.equal(dayTime('2026-09-30T13:40:00Z', 'Asia/Kolkata'), '30 Sept · 19:10');
ok('tz dayTime: "30 Sept · 19:10" — the IST clock, en-IN "Sept" month');

/* 14 — yesterday-in-zone: now minus 24h is calendar-yesterday in ANY zone
 * (the instant math is zone-free), so the word is safe on every device. */
const yIn = dayTime(new Date(Date.now() - 86400000).toISOString(), 'Asia/Kolkata');
assert.ok(yIn.startsWith('Yesterday '), `yesterday-in-tz prefix, got: ${yIn}`);
ok('tz yesterday: now−24h reads "Yesterday …" in the reporting zone');

/* 15 — an unreadable timestamp stays "—" in a zone too. */
assert.equal(dayTime('garbage', 'Asia/Kolkata'), '—');
ok('tz silence: unreadable renders "—" in a zone, never a fake date');

console.log(`\n1..${n}`);
console.log(`# unit218: ${n} asserts — the shifts' days (daySpan grammar + tz path + dayTime regression)`);
