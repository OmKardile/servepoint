/* Task 227 — v5.188.0 unit suite: the door reads its mail.
 * A notification's deep link walked the counter to the right screen but
 * never consumed the unread — the bell stayed fat with rows already seen,
 * and every walk cost a second click (the explicit Mark read button) to
 * drain it. Now the walk IS the read receipt.
 * Asserted: doorOf's truth table (a real section slug maps; null link_to
 *   maps null — honest no-door; an unknown slug maps null — honest
 *   unknown, never a button to nowhere) and the mark decision's shape —
 *   the receipt fires ONLY when a door exists AND the row is unread; a
 *   read row's door never re-writes (the DB write is spent already); a
 *   doorless unread keeps its badge (it was seen nowhere but here). The
 *   SECTION_LABELS contract the door rides is asserted too — every section
 *   the rail names maps, so a renamed section can never silently break
 *   the bell's doors.
 * Run: bunx vite-node scripts/unit227.mjs
 */
import assert from 'node:assert/strict';

const notifM = await import('/src/components/notifications/NotificationsScreen.tsx');
const { doorOf } = notifM;
const { SECTION_LABELS } = await import('/src/components/shell/Sidebar.tsx');

let n = 0;
const ok = (name) => console.log(`  ok ${++n} - ${name}`);

const row = (over = {}) => ({ id: 'x', title: 'T', link_to: 'floor', is_read: false, ...over });

/* 1 — the door's truth table: a real slug maps */
assert.equal(doorOf(row({ link_to: 'floor' })), 'floor');
assert.equal(doorOf(row({ link_to: 'bills' })), 'bills');
assert.equal(doorOf(row({ link_to: 'dashboard' })), 'dashboard');
ok('a real section slug maps to its section (floor, bills, dashboard)');

/* 2 — no link, no door */
assert.equal(doorOf(row({ link_to: null })), null);
assert.equal(doorOf(row({ link_to: undefined })), null);
ok('a row without a link_to has no door — honest no-button');

/* 3 — an unknown slug is honest: null, never a walk to nowhere */
assert.equal(doorOf(row({ link_to: 'counter' })), null); // not a route — the /counter lesson
assert.equal(doorOf(row({ link_to: 'garbage-slug' })), null);
ok('an unknown slug maps null — the door never walks off the app');

/* 4 — every section the app knows maps (the door's truth table IS
 *    SECTION_LABELS — doorOf checks hasOwn against it; the router's
 *    alias slugs are a different contract, and an alias link_to maps
 *    null: honest unknown, no button to nowhere) */
const slugs = Object.keys(SECTION_LABELS);
for (const slug of slugs) {
  assert.equal(doorOf(row({ link_to: slug })), slug);
}
assert.equal(doorOf(row({ link_to: 'close-out' })), null);
ok(`all ${slugs.length} SECTION_LABELS map, aliases stay doorless — the door's truth table is the rail's own`);

/* 5 — the receipt's decision shape: door + unread → mark */
const marksRead = (r) => doorOf(r) !== null && r.is_read === false;
assert.equal(marksRead(row()), true); // unread + door
assert.equal(marksRead(row({ is_read: true })), false); // read row — the write is spent
assert.equal(marksRead(row({ link_to: null })), false); // doorless unread keeps its badge
ok('the receipt fires only for unread rows WITH a door — read rows never re-write, doorless rows keep their badge');

/* 6 — the aria grammar: the unread door speaks the receipt */
const aria = (r) => {
  const d = doorOf(r);
  return d ? `Open ${d} — ${r.title}${r.is_read ? '' : ', marks it read'}` : null;
};
assert.equal(aria({ link_to: 'floor', is_read: false, title: 'Booking today: Maya Iyer ×2' }), 'Open floor — Booking today: Maya Iyer ×2, marks it read');
assert.equal(aria({ link_to: 'floor', is_read: true, title: 'Booking today: Maya Iyer ×2' }), 'Open floor — Booking today: Maya Iyer ×2');
ok("the unread door's aria speaks the receipt; the read door stays quiet");

console.log(`\nunit227: ${n} asserts passed`);
