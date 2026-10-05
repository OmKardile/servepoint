/* unit307 — v5.268.0 "the gate hears the blip" (agreement shape)
 * The census finding: the gate page (/t/:token) — the FIRST page a QR scan
 * ever lands on — lied on a Wi-Fi stumble. The lib marks wire failures with
 * error: 'NETWORK' and an honest body word ("Could not reach the cafe…"),
 * but the gate never read the marker: a network fail routed to state
 * 'invalid', wearing the lying title "This link didn't work" — while its
 * own body said "try again" with NO retry door (the invalid card had none;
 * the exact dead end 5.249.0 cured on the menu). And openTableSession's
 * wire-fail word blamed the sticker ("Scan the QR sticker again") when
 * retrying is the move.
 * THE LAWS PINNED HERE:
 *   1. the gate reads the marker: resolved.error === 'NETWORK' → state
 *      'net' — the lying routing is GONE;
 *   2. THE NET CARD HAS THE DOOR: the net card carries onRetry → run() and
 *      the busy voice — the word and the door finally agree;
 *   3. THE AMBER REGISTER: the net tone wears the same amber family the
 *      net band speaks (#FBF6EA circle, #8A5A00 CloudOff) — one amber
 *      language for "the wire is down" across the guest surfaces; genuine
 *      bad links keep the red CircleAlert;
 *   4. THE STICKER IS NOT BLAMED: openTableSession's wire-fail message no
 *      longer says "Scan the QR sticker again" — the word says try again;
 *   5. THE WORDS EXIST IN ALL THREE LANGUAGES: gateNetTitle + gateNetBody
 *      in en/hi/kn (6 keys, the census counts);
 *   6. THE FAMILY STANDS: the net band (306) byte-kept — both render
 *      sites, the episode grammar, the shell's yield;
 *   7. the honest invalid path stands: a genuinely bad code still routes
 *      to 'invalid' with the red card and the scan-the-sticker body;
 *   8. the version law: APP_VERSION and sw.js's VERSION agree. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const guest = readFileSync('/home/z/my-project/src/components/guest/GuestPages.tsx', 'utf8');
const guestLib = readFileSync('/home/z/my-project/src/lib/guest.ts', 'utf8');
const i18n = readFileSync('/home/z/my-project/src/lib/guest-i18n.ts', 'utf8');
const versionTs = readFileSync('/home/z/my-project/src/version.ts', 'utf8');
const swJs = readFileSync('/home/z/my-project/public/sw.js', 'utf8');

let passed = 0;
const check = (name, fn) => {
  fn();
  passed += 1;
  console.log(`  ok ${passed} — ${name}`);
};

/* ── 1. the gate reads the marker ────────────────────────────────────── */
check("the gate reads the lib's NETWORK marker — the lying routing is gone", () => {
  assert.ok(guest.includes("if (resolved.error === 'NETWORK') {"), 'the branch exists');
  const netBranch = guest.match(/if \(resolved\.error === 'NETWORK'\) \{[\s\S]*?\n      \}/);
  assert.ok(netBranch && netBranch[0].includes("setState('net')"), 'wire failures route to the net state');
  assert.ok(netBranch && netBranch[0].includes("t('gateNetBody')"), 'the fallback body is the net word');
  // the net branch sits INSIDE the !is_valid guard, BEFORE the invalid routing
  const guard = guest.match(/if \(!resolved\.is_valid[\s\S]*?\n    \}/);
  assert.ok(guard && guard[0].indexOf("resolved.error === 'NETWORK'") < guard[0].indexOf("setState('invalid')"), 'net wins before invalid');
});

/* ── 2. the net card has the door ────────────────────────────────────── */
check('the net card carries the retry door and the busy voice', () => {
  assert.ok(
    guest.includes("{state === 'net' && <GuestErrorCard tone=\"net\" title={t('gateNetTitle')} body={detail} busy={busy} onRetry={() => void run()} />}"),
    'the net card: tone + retry + busy'
  );
  assert.ok(guest.match(/'working' \| 'invalid' \| 'session' \| 'net'/), 'the state machine knows net');
});

/* ── 3. the amber register ───────────────────────────────────────────── */
check('the net tone wears the amber register; bad links keep red', () => {
  const card = guest.match(/function GuestErrorCard\(\{[\s\S]*?\n\}/);
  assert.ok(card, 'the card found');
  assert.ok(card[0].includes("tone?: 'error' | 'net'"), 'the tone prop exists');
  assert.ok(card[0].includes("net ? 'bg-[#FBF6EA]' : 'bg-[#FDF3F2]'"), 'the net circle is amber');
  assert.ok(card[0].includes("net ? <CloudOff size={26} className=\"text-[#8A5A00]\""), 'the net ear is CloudOff in the house amber ink');
  assert.ok(card[0].includes("<CircleAlert size={26} className=\"text-[#B4483C]\""), 'bad links keep the red CircleAlert');
});

/* ── 4. the sticker is not blamed ────────────────────────────────────── */
check("the wire-fail word stops blaming the sticker", () => {
  assert.ok(!guestLib.includes('Scan the QR sticker again.'), 'the old sticker-blame is gone from the open path');
  assert.ok(guestLib.includes('Could not open this table right now — try again in a moment.'), 'the word says try again');
  // genuine server rejections keep the staff word
  assert.ok(guestLib.includes('Ask our staff for help.'), 'server rejections keep their own word');
});

/* ── 5. the words in three languages ─────────────────────────────────── */
check('gateNetTitle + gateNetBody exist in en, hi and kn', () => {
  for (const key of ['gateNetTitle', 'gateNetBody']) {
    const hits = i18n.match(new RegExp(`^\\s*${key}: ['"]`, 'gm')) ?? [];
    assert.equal(hits.length, 3, `${key} speaks in all three dictionaries`);
  }
});

/* ── 6. the family stands (306 byte-kept) ────────────────────────────── */
check('the net band family stands: renders, grammar, shell yield', () => {
  assert.equal((guest.match(/<GuestNetBand \/>/g) ?? []).length, 2, 'the band still renders on menu + track');
  assert.ok(guest.includes('wasOffline.current = true'), 'the episode grammar byte-kept');
  const pwa = readFileSync('/home/z/my-project/src/components/shell/PwaLayer.tsx', 'utf8');
  assert.ok(pwa.includes("mode !== 'guest';"), "the shell's yield stands");
});

/* ── 7. the honest invalid path stands ───────────────────────────────── */
check('a genuinely bad code still routes to the red card with the scan word', () => {
  assert.ok(guest.includes("{state === 'invalid' && <GuestErrorCard title={t('gateInvalidTitle')} body={detail} />}"), 'invalid keeps its red card (no door by design — a bad code needs a rescan, not a retry)');
  assert.ok(i18n.includes("invalidCode: 'This table code is not valid. Scan the QR sticker on your table.'"), 'the scan-the-sticker word lives for BAD CODES (where it is true)');
});

/* ── 8. the version law (agreement shape) ────────────────────────────── */
check('the version law: APP_VERSION and sw.js agree', () => {
  const v = versionTs.match(/APP_VERSION = '([^']+)'/)?.[1] ?? '';
  assert.ok(v.length > 0, 'APP_VERSION is present');
  assert.ok(swJs.includes(`const VERSION = "servepoint-v${v}-r1";`), `sw.js carries the same word (${v})`);
});

console.log(`\nunit307 — PASS ${passed}/${passed} (all checks green)`);
