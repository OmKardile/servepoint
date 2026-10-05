/**
 * unit287 — v5.248.0 "the guest's ticket tells the time".
 *
 * The round's laws, pinned:
 *   1. THE WIRE CONTRACT — sp_get_public_order has handed created_at (and
 *      updated_at) to the pager since migration 025/037, and the summary
 *      type carried it (lib/guest.ts) — the round adds NO read, NO field,
 *      NO migration: the fact already rides the wire, the pager just speaks
 *      it now. If anyone drops the field from the type or the RPC body,
 *      this battery fails.
 *   2. THE STAMP — the café's wall clock in the reporting zone the CALLER
 *      names (appTimezone() at the call site — the drawer doctrine: a guest
 *      abroad reads the café's clock, not their phone's). Today bare
 *      "14:17"; any older day the calendar "5 Oct · 14:17" — the calendar
 *      speaks even for yesterday (no borrowed English word inside a
 *      Hindi/Kannada sentence); an unreadable stamp renders "—", never a
 *      fake time.
 *   3. THE AGE — "now" under a minute, whole minutes to the hour, then
 *      hours+minutes; a NEGATIVE age (a future-dated corrupt row) is
 *      UNSPEAKABLE (null — the pill speaks the stamp alone; 5.243's census
 *      law: corruption is not forgiven, and the pager does not invent a
 *      clock either).
 *   4. THE RENDER-BOUNDARY LAW — the age derives at the render boundary
 *      (nowMs an argument, the suite owns now — 228's doctrine); the pill's
 *      derivation rides order.created_at and re-renders on every 10-second
 *      tick, so a stored sentence re-rendered re-derives its time-truth
 *      (5.179/5.246, now in the guest's hand).
 *   5. THE GUEST'S OWN VOICE — the words live in ALL THREE guest
 *      dictionaries (EN/HI/KN) — the guest surfaces' language law (5.7.0):
 *      staff English never leaks into a translated sentence.
 *   6. THE VERSION LAW in the agreement shape.
 *
 * Run: bunx vite-node scripts/unit287.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

let n = 0;
const ok = (name) => console.log(`  ok ${++n} - ${name}`);
const strip = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');

const guestLib = strip('../src/lib/guest.ts');
const i18n = strip('../src/lib/guest-i18n.ts');
const pages = strip('../src/components/guest/GuestPages.tsx');
const mig037 = strip('../supabase/migrations/037_guest_legal_footer.sql');
const versionTs = strip('../src/version.ts');
const swJs = strip('../public/sw.js');

const IST = 'Asia/Kolkata';
const { ticketPlacedStamp, ticketAge } = await import('/src/lib/guest.ts');
assert.equal(typeof ticketPlacedStamp, 'function', 'ticketPlacedStamp exported');
assert.equal(typeof ticketAge, 'function', 'ticketAge exported');

/* 1 — the wire contract: the fact already rides the wire. */
{
  assert.ok(
    /interface GuestOrderSummary \{[\s\S]*?created_at: string;[\s\S]*?updated_at: string;/.test(guestLib),
    'GuestOrderSummary carries created_at + updated_at',
  );
  assert.ok(
    mig037.includes("'created_at', v_order.created_at") && mig037.includes("'updated_at', v_order.updated_at"),
    'sp_get_public_order returns both stamps (037 lineage, no new migration this round)',
  );
  assert.ok(
    !supabaseWriteCrept(guestLib),
    'the ticket clock adds no second read — pure derivations in the lib',
  );
  ok('the wire contract: created_at rides 025/037, the type carries it, no new read');
}
function supabaseWriteCrept(src) {
  // the new section must not touch supabase — a pure derivation, not a read
  const section = src.split('the ticket\'s clock')[1]?.split('feedback (migration 019)')[0] ?? '';
  return /supabase\./.test(section);
}

/* 2 — the stamp matrix (the suite owns now — 228's doctrine). */
{
  const NOW = new Date('2026-10-05T17:30:00+05:30').getTime(); // 5 Oct 17:30 IST
  assert.equal(ticketPlacedStamp('2026-10-05T14:17:00+05:30', IST, NOW), '14:17',
    'today speaks the bare clock');
  assert.equal(ticketPlacedStamp('2026-10-02T14:17:00+05:30', IST, NOW), '2 Oct · 14:17',
    'older speaks the calendar');
  assert.equal(ticketPlacedStamp('2026-10-04T23:59:00+05:30', IST, NOW), '4 Oct · 23:59',
    'yesterday speaks the calendar too (no borrowed word in a translated sentence)');
  assert.equal(ticketPlacedStamp('not-a-date', IST, NOW), '—',
    'an unreadable stamp renders —, never a fake time');

  // the zone doctrine: the CALLER names the clock, the day verdict follows the zone.
  // One instant, one now — 2026-10-05T20:30:00-04:00 = 6 Oct 06:00 IST = 5 Oct 20:30 EDT
  // (DST still on in October); now = +4h = 00:30Z = 10:00 IST 6 Oct (midnight untouched)
  // vs 00:30 6 Oct NY (midnight crossed). The SAME pair must speak bare in IST and
  // calendar in NY.
  const placed = new Date('2026-10-05T20:30:00-04:00').getTime();
  const nowPlus4h = placed + 4 * 60 * 60 * 1000;
  assert.equal(ticketPlacedStamp(new Date(placed).toISOString(), IST, nowPlus4h), '06:00',
    'in the café zone midnight was not crossed — the bare clock');
  assert.equal(ticketPlacedStamp(new Date(placed).toISOString(), 'America/New_York', nowPlus4h), '5 Oct · 20:30',
    'the same instant in a zone whose midnight WAS crossed — the calendar');
  ok('the stamp matrix: today bare / older calendar / yesterday calendar / — / the zone doctrine');
}

/* 3 — the age matrix. */
{
  const NOW = new Date('2026-10-05T17:30:00Z').getTime();
  const iso = (ms) => new Date(ms).toISOString();
  assert.deepEqual(ticketAge(iso(NOW - 30 * 1000), NOW), { kind: 'now' }, 'under a minute: now');
  assert.deepEqual(ticketAge(iso(NOW - 60 * 1000), NOW), { kind: 'min', n: 1 }, 'the minute floor');
  assert.deepEqual(ticketAge(iso(NOW - 59 * 60 * 1000), NOW), { kind: 'min', n: 59 }, 'the minute ceiling');
  assert.deepEqual(ticketAge(iso(NOW - 60 * 60 * 1000), NOW), { kind: 'hours', h: 1, m: 0 }, 'the hour turn');
  assert.deepEqual(ticketAge(iso(NOW - 125 * 60 * 1000), NOW), { kind: 'hours', h: 2, m: 5 }, 'hours + minutes');
  assert.deepEqual(ticketAge(iso(NOW - 23 * 60 * 60 * 1000), NOW), { kind: 'hours', h: 23, m: 0 }, 'the hour ceiling');
  assert.deepEqual(ticketAge(iso(NOW - 25 * 60 * 60 * 1000), NOW), { kind: 'days', d: 1 }, 'the day turn');
  assert.deepEqual(ticketAge(iso(NOW - 50 * 60 * 60 * 1000), NOW), { kind: 'days', d: 2 }, 'day granularity is the honest ceiling — no "54 h ago"');
  assert.equal(ticketAge(iso(NOW + 5 * 60 * 1000), NOW), null, 'a future-dated corrupt row is UNSPEAKABLE');
  assert.equal(ticketAge('not-a-date', NOW), null, 'an unreadable stamp has no speakable age');
  ok('the age matrix: now / minutes / hours / days / the negative floor (corruption not forgiven)');
}

/* 4 — the render-boundary law at the pill (the wiring). */
{
  assert.ok(
    pages.includes('ticketPlacedStamp(order.created_at, appTimezone())'),
    'the zone is named at the call site (the drawer doctrine — café clock, not phone clock)',
  );
  assert.ok(pages.includes('ticketAge(order.created_at)'), 'the age derives from the stored stamp');
  assert.ok(pages.includes("t('placedAt', { t: placedStamp })"), 'the pill speaks the placedAt key');
  assert.ok(pages.includes('placedAgeWord ? ` · ${placedAgeWord}` : \'\''),
    'the age rides the same sentence — one text flow (the a11y-glue law)');
  const pill = pages.split('{order && (\n              <p\n                className="mt-2 inline-flex')[1]?.split('</p>')[0] ?? '';
  assert.ok(pill.includes('<Clock size={11} aria-hidden />'), 'the pill\'s icon is aria-hidden');
  assert.ok(pill.includes('bg-white/10'), 'the pill wears the header\'s own glass (one header language)');
  ok('the render-boundary law: derive at render, café zone named at the call site, one text flow');
}

/* 5 — the guest's own voice: five keys, three dictionaries. */
{
  for (const key of ['placedAt', 'ageNow', 'ageMin', 'ageH', 'ageHm', 'ageD']) {
    const hits = i18n.split(`  ${key}:`).length - 1;
    assert.equal(hits, 3, `${key} lives in EN, HI and KN (found ${hits})`);
  }
  assert.ok(i18n.includes("placedAt: 'Placed {t}'"), 'EN placedAt');
  assert.ok(i18n.includes("placedAt: '{t} पर ऑर्डर लगा'"), 'HI placedAt');
  assert.ok(i18n.includes("placedAt: '{t} ಕ್ಕೆ ಆರ್ಡರ್ ಆಗಿದೆ'"), 'KN placedAt');
  ok('the guest\'s own voice: 6 keys × 3 dictionaries, no staff English leaks');
}

/* 6 — the version law, in the agreement shape. */
{
  const v = versionTs.match(/APP_VERSION = '([\d.]+)'/)?.[1];
  const sw = swJs.match(/const VERSION = "servepoint-v([\d.]+)-r1"/)?.[1];
  assert.ok(v && sw, 'both sides carry a version');
  assert.equal(v, sw, 'version.ts and sw.js speak the SAME version');
  ok(`the version law: ${v} on both sides`);
}

console.log(`\nunit287 — ${n} checks green.`);
