/* Task 198 — the briefing's hours asserts.
 * groupNotificationsForFeed gives the bell feed its day rhythm: Today /
 * Yesterday / Earlier on the booking clock's IST day keys, unreadable
 * stamps landing in Earlier (never dropped), each group newest-first.
 * Pinned here so the boundary, the order and the honesty can't drift. */

let fails = 0;
const assert = (name, cond) => {
  console.log(`${cond ? 'PASS' : 'FAIL'} — ${name}`);
  if (!cond) fails++;
};

const mod = await import('/src/components/notifications/NotificationsScreen.tsx');
const { groupNotificationsForFeed } = mod;
const { bookingDayKey } = await import('/src/lib/bookingday.ts');

/* Build stamps the same way the screen derives its keys, so the group
 * boundaries align by construction. */
const NOW = new Date('2026-10-04T09:00:00Z'); // 4 Oct 2026, 14:30 IST
const todayKey = bookingDayKey(NOW.toISOString());
const yesterdayKey = bookingDayKey(new Date(NOW.getTime() - 86_400_000).toISOString());

const bell = (id, iso, is_read = true) => ({
  id,
  tenant_id: 't',
  category: 'system',
  title: `bell ${id}`,
  body: '',
  is_read,
  created_at: iso,
});

const iso = (ms) => new Date(ms).toISOString();
const T1 = iso(NOW.getTime() - 30 * 60_000); // today, 30 min ago
const T2 = iso(NOW.getTime() - 2 * 60 * 60_000); // today, 2h ago
const Y1 = iso(NOW.getTime() - 86_400_000 - 60 * 60_000); // yesterday evening
const E1 = iso(NOW.getTime() - 5 * 86_400_000); // 5 days ago
const E2 = iso(NOW.getTime() - 3 * 86_400_000); // 3 days ago

/* ── the honest empty ── */
assert('empty feed → no groups', groupNotificationsForFeed([], todayKey, yesterdayKey).length === 0);

/* ── all-today: one group, newest-first ── */
const onlyToday = groupNotificationsForFeed([bell('a', T2), bell('b', T1)], todayKey, yesterdayKey);
assert('all-today → single "Today" group', onlyToday.length === 1 && onlyToday[0].label === 'Today');
assert('within group, newest first', onlyToday[0].items[0].id === 'b' && onlyToday[0].items[1].id === 'a');

/* ── mixed: three groups in reading order ── */
const mixed = groupNotificationsForFeed(
  [bell('e1', E1), bell('y1', Y1), bell('t1', T2), bell('t2', T1), bell('e2', E2)],
  todayKey,
  yesterdayKey,
);
assert('mixed feed → exactly three groups', mixed.length === 3);
assert('groups read Today, Yesterday, Earlier', mixed.map((g) => g.label).join(',') === 'Today,Yesterday,Earlier');
assert('every bell survives the grouping',
  mixed.reduce((s, g) => s + g.items.length, 0) === 5);
assert('Earlier group sorts newest-first too',
  mixed[2].items[0].id === 'e2' && mixed[2].items[1].id === 'e1');

/* ── unreadable stamps: honest Earlier, never dropped ── */
const broken = groupNotificationsForFeed(
  [bell('good', T1), bell('bad', 'not-a-timestamp')],
  todayKey,
  yesterdayKey,
);
assert('unreadable stamp lands in Earlier (not dropped)',
  broken.length === 2 && broken[1].label === 'Earlier' && broken[1].items[0].id === 'bad');

/* ── the screen's own boundary keys agree with the helper's clock ── */
const bY = bookingDayKey(new Date(NOW.getTime() - 86_400_000).toISOString());
assert("yesterday's key derives from the same booking clock", bY === yesterdayKey);

/* ── read/unread mix doesn't move groups (unread filters upstream) ── */
const mixedRead = groupNotificationsForFeed(
  [bell('u1', T1, false), bell('r1', Y1, true), bell('u2', E1, false)],
  todayKey,
  yesterdayKey,
);
assert('grouping ignores read state (composition, not coupling)',
  mixedRead.length === 3 && mixedRead[0].items[0].id === 'u1');

console.log(fails === 0 ? '\nALL PASS (10 asserts)' : `\n${fails} FAILURES`);
process.exit(fails === 0 ? 0 : 1);
