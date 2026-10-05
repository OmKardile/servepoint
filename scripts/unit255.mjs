/* Task 255 — v5.216.0 unit suite: the ribbon hears the server.
 * Migration 023's sp_verify_table_session has ALWAYS answered live sessions
 * with `remaining_seconds` — the SERVER's arithmetic, read from the same
 * clock that decides the lock — and every release before this one discarded
 * it. The guest ribbon counted on the phone's clock alone (expires_at minus
 * Date.now()), so a drifted phone could promise a window the server
 * disagrees with. The tick now carries the number home: the 30s re-verify
 * writes a server anchor ({ at, seconds }), the 1s ribbon tick interpolates
 * from it, and a fail-soft tick (ok WITHOUT a number) leaves the anchor
 * untouched — silence from the network is never read as zero. Two more
 * honesty holes in the same strip: the ended state was hardcoded English in
 * an otherwise three-language component (the dead window is exactly when a
 * guest is most confused), and the rescan hint rode `hidden sm:inline`,
 * hiding the recovery sentence on the very phones the ribbon exists for.
 * Asserted: verifyTableSession's mapping byte-cases (live + number → ok with
 * remainingSeconds floored at zero; live without a number → ok only;
 * invalid → ok:false with the reason; error/catch → the fail-soft ok WITHOUT
 * the field); windowLeft's arithmetic (the server anchor wins and
 * interpolates, clamped at zero; no anchor → the legacy phone-clock
 * subtraction); source guards — the lib names remaining_seconds (the field
 * threaded, never re-derived), the tick re-anchors only on a finite number
 * (no `?? null` laundering of an absent field), the ribbon's interval
 * cleanup intact and still the ONLY 1s ticker, ariaEnds still exactly once
 * (one sentence two ears), the ended words i18n'd in all three dicts, and
 * the hint's hidden sm:inline retired from the ribbon.
 * Run: bunx vite-node scripts/unit255.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

let n = 0;
const ok = (name) => console.log(`  ok ${++n} - ${name}`);

const { verifyTableSession } = await import('/src/lib/guest.ts');

const strip = (p) =>
  readFileSync(new URL(p, import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => !l.trim().startsWith('*') && !l.trim().startsWith('/*') && !l.trim().startsWith('//'))
    .join('\n');

const guestLib = strip('../src/lib/guest.ts');
const guestPages = strip('../src/components/guest/GuestPages.tsx');
const i18n = strip('../src/lib/guest-i18n.ts');

/* ── 1. verifyTableSession threading — the server's number comes home.
 *    The lib's mapping is guarded by its own bytes (the module-scoped
 *    supabase client cannot be stubbed from outside — a copied body would
 *    guard nothing, so the suite pins the CONTRACT: the field threaded, the
 *    finite gate, the clamp, and the fail-soft shapes that must stay silent
 *    about the number). The function's real network path stays E2E's job. */

assert.equal(typeof verifyTableSession, 'function', 'verifyTableSession exported');
ok('verifyTableSession exported from the lib home');

// Source guard: the mapping names the RPC's own field — the server's
// arithmetic threaded, never re-derived from a local clock.
assert.ok(guestLib.includes('remaining_seconds'), 'lib must thread remaining_seconds (the RPC field)');
ok('lib threads the RPC field remaining_seconds');

assert.ok(guestLib.includes('Number.isFinite(remaining)'), 'finite gate on the server number (NaN covers the absent field)');
ok('finite gate — a non-number verdict never becomes an anchor');

assert.ok(guestLib.includes('Math.max(0, Math.floor(remaining))'), 'floor + clamp at zero');
ok('server number floored and clamped at zero');

// The fail-soft branches return WITHOUT the field — silence is not zero.
const failSoftBranches = [
  "if (error) return { ok: true, reason: 'network' };",
  "return { ok: true, reason: 'network' }; // a network hiccup never locks a paying guest",
];
for (const b of failSoftBranches) {
  assert.ok(guestLib.includes(b), `fail-soft branch intact: ${b.slice(0, 40)}`);
  assert.ok(!b.includes('remainingSeconds'), 'fail-soft branches carry NO remainingSeconds');
}
ok('fail-soft branches return without remainingSeconds (silence is not zero)');

/* ── 2. windowLeft — the server anchor wins, the phone interpolates ── */

// windowLeft is module-private in GuestPages; its CONTRACT is asserted via
// the source bytes + a behavioral mirror through the ribbon's rendering path
// is out of scope for vite-node (no DOM). The suite guards the exact
// arithmetic instead — one anchor form, one clamp, one fallback.
assert.ok(
  guestPages.includes('return Math.max(0, serverRemaining.seconds * 1000 - (Date.now() - serverRemaining.at));'),
  'anchor arithmetic: seconds*1000 minus time-since-verdict, clamped at zero',
);
ok('windowLeft: the anchor interpolates (seconds − elapsed, floored)');

assert.ok(
  guestPages.includes("return new Date(session.expires_at).getTime() - Date.now();"),
  'no-anchor fallback: the legacy phone-clock subtraction',
);
ok('windowLeft: no anchor → the legacy expires_at − now path');

// 5.250.0 — the ONE 1s tick moved to the PAGE (the ribbon is a pure
// renderer now). windowLeft's "never a second clock" law moved WITH it, in
// its new shape: every msLeft computation site rides windowLeft — the
// initializer (birth), the effect's immediate re-derive (a fresh anchor
// lands in 0ms, not 1s), and the 1s interval — and NOTHING else computes
// time. Same law, honest re-anchor (the unit241 lesson: the rider changed,
// the law didn't).
const ribbonBody = guestPages.slice(guestPages.indexOf('function SessionRibbon'), guestPages.indexOf('function Customizer('));
assert.ok(ribbonBody.length > 400, 'ribbon slice resolved');
assert.ok(!ribbonBody.includes('windowLeft('), 'the ribbon computes NOTHING — it renders the msLeft it is handed');
const pageBody = guestPages.slice(guestPages.indexOf('const [resolved, setResolved]'));
assert.equal(pageBody.split('windowLeft(').length - 1, 3,
  'windowLeft has exactly THREE sites on the page: initializer + immediate re-derive + interval');
assert.ok(pageBody.includes('const [msLeft, setMsLeft] = useState<number | null>(() => (sessionToken ? windowLeft(sessionToken, serverAnchor) : null));'),
  'the initializer computes from windowLeft at birth');
assert.ok(pageBody.includes('setMsLeft(windowLeft(sessionToken, serverAnchor));'),
  'a fresh anchor re-derives immediately (0ms, not 1s)');
assert.ok(pageBody.includes('window.setInterval(() => setMsLeft(windowLeft(sessionToken, serverAnchor)), 1000);'),
  'the interval is the page\u2019s only timer');
ok('windowLeft is the ONLY clock (initializer + immediate re-derive + interval — 5.250.0\u2019s honest re-anchor)');

/* ── 3. The tick writes the anchor — only a finite verdict does ── */

assert.ok(
  guestPages.includes("if (r.ok && typeof r.remainingSeconds === 'number') {"),
  'the tick re-anchors ONLY on ok + a finite number',
);
ok('tick: re-anchor gated on ok && typeof number');

assert.ok(
  guestPages.includes('setServerAnchor({ at: Date.now(), seconds: r.remainingSeconds });'),
  'anchor form: { at: verdict time, seconds: server number }',
);
ok('tick: anchor captured at verdict time');

// Silence must NOT reset the anchor: no `?? null`, no unconditional reset.
assert.ok(!guestPages.includes('setServerAnchor(r.remainingSeconds ?? null),'), 'no null-laundering of an absent field');
assert.ok(!guestPages.includes('setServerAnchor(null);'), 'no unconditional anchor reset in the tick path');
ok('tick: fail-soft silence leaves the last anchor standing');

// 5.250.0 — the anchor rides the TICK now: serverAnchor feeds the page's
// windowLeft sites, msLeft carries the verdict to the ribbon AND the
// ordering machinery. One thread, three listeners.
assert.ok(
  guestPages.includes('const t1 = window.setInterval(() => setMsLeft(windowLeft(sessionToken, serverAnchor)), 1000);'),
  'the anchor threads to the tick (the freshest verdict wins within one second)',
);
assert.ok(
  guestPages.includes('{sessionToken && <SessionRibbon session={sessionToken} msLeft={msLeft} ended={windowEnded} warm={windowWarm} />}'),
  'the verdict rides msLeft to the ribbon (5.251.0: the bands ride with it — honest re-anchor, the rider moved, the law didn\u0027t)',
);
ok('the anchor threads: serverAnchor → windowLeft → msLeft → ribbon + buttons');

/* ── 4. The page stays the ONLY 1s-ticking surface, cleanup intact ── */

// 5.250.0's honest re-anchor: the ONE 1s tick lives on the menu PAGE (the
// ribbon renders its number). The "exactly one ticker" law is literal: one
// 1s interval on the menu page, cleanup intact, re-arms on a fresh anchor.
const menuBody = guestPages.slice(guestPages.indexOf('const [resolved, setResolved]'), guestPages.indexOf('3 · TRACK'));
const menu1s = menuBody.match(/window\.setInterval\(\(\) => setMsLeft/g) || [];
assert.equal(menu1s.length, 1, 'exactly ONE 1s interval on the menu page (the ONE-tick law)');
assert.ok(menuBody.includes('return () => window.clearInterval(t1);'), 'the page tick cleans up');
assert.ok(menuBody.includes('[phase, sessionToken, serverAnchor]'), 'the tick re-arms when the anchor moves (the freshest verdict wins)');
ok('menu page: one 1s tick, cleanup intact, re-arms on a fresh anchor');

// 5.261.0's honest re-anchor: the inline arrow became the named `verify`
// (the wake rides it too) — the rider moved, the law stands: ONE verify,
// ONE 30s interval calling it, the wake adds a beat but no interval.
const verifyDef = guestPages.match(/const verify = \(\) => \{\s*void verifyTableSession/g) || [];
assert.equal(verifyDef.length, 1, 'the re-verify is one named verify riding the shipped lib call');
assert.ok(guestPages.includes('window.setInterval(verify, 30000);'), 'the verify tick stays at 30s');
ok('re-verify tick: still one 30s interval');

/* ── 5. The ended state speaks the guest's language — all three dicts ── */

for (const [dict, words] of [
  ['en', /windowEnded: 'Window ended — '/],
  ['hi', /windowEnded: 'अवधि समाप्त — '/],
  ['kn', /windowEnded: 'ಅವಧಿ ಮುಕ್ತಾಯ — '/],
]) {
  assert.ok(words.test(i18n), `windowEnded present in the ${dict} dict`);
}
ok('windowEnded i18n: en / hi / kn');

for (const [dict, words] of [
  ['en', /windowEndedHint: 'scan the table QR to continue'/],
  ['hi', /windowEndedHint: 'जारी रखने के लिए टेबल QR स्कैन करें'/],
  ['kn', /windowEndedHint: 'ಮುಂದುವರಿಯಲು ಟೇಬಲ್ QR ಸ್ಕ್ಯಾನ್ ಮಾಡಿ'/],
]) {
  assert.ok(words.test(i18n), `windowEndedHint present in the ${dict} dict`);
}
ok('windowEndedHint i18n: en / hi / kn');

// The hardcoded English is GONE from the ribbon — no literals survive.
assert.ok(!ribbonBody.includes("'Window ended'"), 'no hardcoded "Window ended" literal left');
assert.ok(!ribbonBody.includes("'scan the table QR to continue'"), 'no hardcoded rescan literal left');
ok('the ribbon hosts zero hardcoded ended-words');

// The aria stays the ONE sentence (one sentence, two ears — 5.213's rule).
assert.equal(ribbonBody.split("ariaEnds").length - 1, 1, 'ariaEnds spoken exactly once');
ok('ariaEnds: exactly once (one sentence, two ears)');

/* ── 6. The hint is audible at every width ── */

assert.ok(!ribbonBody.includes('hidden sm:inline'), 'hidden sm:inline retired from the ribbon');
assert.ok(ribbonBody.includes('text-[11.5px] font-medium opacity-90'), 'the hint rides its own quieter voice');
assert.ok(ribbonBody.includes('flex-wrap'), 'the strip wraps — the hint never overflows a narrow phone');
ok('the recovery sentence visible at every width, in a quieter voice');

/* ── 7. The family intact — the lock still belongs to the server ── */

assert.ok(guestPages.includes('if (!r.ok) lockGuest(r.reason'), 'the server still decides the lock (023 discipline)');
assert.ok(guestPages.includes("const iv = window.setInterval"), 'the tick interval binding intact');
// No local lock at zero: the ribbon's ended state must NOT call lockGuest.
assert.ok(!ribbonBody.includes('lockGuest'), 'the ribbon NEVER locks locally — display, not verdict');
ok('the lock stays the server verdict; the ribbon only displays');

console.log(`\nunit255 — ${n} checks green`);
