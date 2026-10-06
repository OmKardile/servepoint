/* unit316 — v5.277.0 "the ack takes itself back — one breath, one word" (agreement shape)
 * The census finding: the copy ACK — the state that says "Copied" and
 * takes itself back — was rendered in SIX hand-rolled grammars:
 *   1. TWELVE tri-state sites (menu, the shelf's two, reports' six,
 *      bills' two, the closeout), each stacking a fresh 1800ms timer on
 *      every tap (a second tap meant the first timer cut the word short),
 *      with no unmount cleanup, and a try/catch ceremony around the
 *      boolean that stopped throwing in v5.276.0;
 *   2. the guests book's keyed {id, ok} object with its own stacking
 *      timer;
 *   3. the floor's three keyed pairs — two on the cards, two in the
 *      dialog — whose token verbs failed SILENTLY (an honest boolean
 *      came back false and the button said nothing);
 *   4. support's two local booleans (also silent on refusal);
 *   5. the wizard's and the platform page's own timer refs (honest and
 *      re-armed, but silent on refusal, and each its own copy);
 *   6. settings riding the flag lib (fine — but no fail word).
 * THE ROUND: lib/useCopyAck — the ack's ONE home. Two hooks (useCopyAck
 * for the single verb, useKeyedCopyAck for the per-row/per-kind family)
 * and one word (ackWord: "Copied" / "Copy blocked" / the surface's own
 * idle word — the literals live in the lib and nowhere else). The breath
 * law is the flag lib's own: a re-tap RE-ARMS, never stacks; the timer
 * is cleaned up on unmount. Every refusal now SPEAKS: the floor's token
 * copy, the dialog's pair, support's two, the wizard's, the platform's
 * and settings' verbs all gained the fail word. The fail EAR is the
 * house's warning amber (#8A5A00) AlertTriangle; the ok ear is the paid
 * green (#2E7D32) everywhere. Every ack button announces (aria-live). */

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

const lib = read('src/lib/useCopyAck.ts');
const menu = read('src/components/menu/MenuScreen.tsx');
const inventory = read('src/components/inventory/InventoryScreen.tsx');
const reports = read('src/components/reports/ReportsScreen.tsx');
const bills = read('src/components/bills/BillsScreen.tsx');
const eod = read('src/components/eod/EodScreen.tsx');
const customers = read('src/components/customers/CustomersScreen.tsx');
const floor = read('src/components/floor/FloorScreen.tsx');
const support = read('src/components/support/SupportScreen.tsx');
const wizard = read('src/components/platform/ProvisioningWizard.tsx');
const platform = read('src/components/platform/PlatformScreen.tsx');
const settings = read('src/components/settings/SettingsScreen.tsx');
const version = read('src/version.ts');
const sw = read('public/sw.js');

const count = (haystack, needle) => haystack.split(needle).length - 1;

function check(name, fn) {
  test(name, () => fn());
  console.log(`  running — ${name}`);
}

/* ── 1. the lib speaks the census ─────────────────────────────────────── */
check('the ack lib exists and speaks its census — two hooks, one word, the door', () => {
  assert.ok(lib.includes('v5.277.0'), 'the lib carries the version word');
  assert.ok(lib.includes('export function useCopyAck('), 'the single-verb hook');
  assert.ok(lib.includes('export function useKeyedCopyAck('), 'the keyed hook');
  assert.ok(lib.includes('export function ackWord('), 'the word');
  assert.ok(lib.includes("from './clipboard'") && count(lib, 'copyText(') === 2, 'the hooks ride the ONE door — exactly two speaks, none other');
  assert.ok(lib.includes('window.clearTimeout(timer.current);'), 'a re-fire re-arms — the word never stacks a second timer');
  assert.ok(/useEffect\(\s*\(\) => \(\) => \{\s*if \(timer\.current !== null\) window\.clearTimeout\(timer\.current\);\s*\},?\s*\[\],?\s*\)/.test(lib), 'the timer is cleaned up on unmount — no ack outlives its surface');
  assert.ok(lib.includes("if (spoke === 'ok') return 'Copied';") && lib.includes("if (spoke === 'fail') return 'Copy blocked';"), 'the literals live HERE — the word\u2019s one home');
});

/* ── 2. the census law: the tri-state is spoken once ──────────────────── */
check('no component declares the ack tri-state — the shape lives once (the lib)', () => {
  const offenders = walk('/home/z/my-project/src')
    .filter((f) => !f.endsWith('lib/useCopyAck.ts'))
    .map((f) => [f, readFileSync(f, 'utf8')])
    .filter(([, src]) => /useState<'idle' \| 'ok' \| 'fail'>/.test(src));
  assert.deepEqual(offenders.map(([f]) => f), [], `local tri-states remain: ${offenders.map(([f]) => f).join(', ')}`);
});

/* ── 3. the census law: the word is spoken once ───────────────────────── */
check('the ack words live in exactly ONE src file — the lib\u2019s own', () => {
  const offenders = walk('/home/z/my-project/src')
    .filter((f) => !f.endsWith('lib/useCopyAck.ts') && !f.endsWith('lib/guest-i18n.ts'))
    .map((f) => [f, readFileSync(f, 'utf8')])
    .filter(([, src]) => src.includes("'Copy blocked'"));
  /* v5.278.0 re-pin — lib/guest-i18n.ts joins the exclusion: it is the
   * guest's TRANSLATED word home (the fail word speaks three languages —
   * en/hi/kn), a dictionary, not a hand-rolled ack grammar. */
  assert.ok(read('src/lib/guest-i18n.ts').split('copyBlocked:').length - 1 === 3, 'the guest fail word speaks exactly three languages');
  assert.deepEqual(offenders.map(([f]) => f), [], `local Copy blocked words remain: ${offenders.map(([f]) => f).join(', ')}`);
  for (const [name, src] of [['menu', menu], ['inventory', inventory], ['reports', reports], ['bills', bills], ['eod', eod], ['customers', customers]]) {
    assert.ok(src.includes('ackWord('), `${name} borrows the word`);
  }
});

/* ── 4. the stragglers' timers are gone ───────────────────────────────── */
check('the stacking timers are retired — no local copy-ack setTimeout remains', () => {
  const offenders = walk('/home/z/my-project/src/components')
    .map((f) => [f, readFileSync(f, 'utf8')])
    .filter(([, src]) => /setTimeout\(\(\) => set\w*(CopyState|OfferCopy|CopiedKey|CopiedTokenId|CopiedId)\b/.test(src));
  assert.deepEqual(offenders.map(([f]) => f), [], `local copy timers remain: ${offenders.map(([f]) => f).join(', ')}`);
  assert.ok(!menu.includes('1800') || !/setTimeout\(\) => set.*1800/.test(menu), 'the menu\u2019s stacked timer is gone');
  assert.ok(reports.includes('useCopyAck()'), 'the reports ride the single-verb hook');
  assert.equal(count(reports, 'useCopyAck()'), 6, 'all six report copies ride it');
  assert.equal(count(inventory, 'useCopyAck()'), 2, 'both shelf copies ride it');
  assert.equal(count(bills, 'useCopyAck()'), 2, 'the chase and the receipt ride it');
});

/* ── 5. every refusal speaks ──────────────────────────────────────────── */
check('the silent refusals speak — floor, support, wizard, platform, settings gained the fail word', () => {
  assert.ok(floor.includes("runTokenAck(t.id, t.qr_token)"), 'the card token rides the keyed ack');
  assert.ok(floor.includes("const copy = (text: string, kind: 'link' | 'token') => runDlgCopy(kind, text);"), 'the dialog rides the keyed ack');
  assert.ok(!floor.includes('/* a refused copy stays silent — the raw link/token is visible on screen anyway */'), 'the old silence comment is retired');
  assert.ok(support.includes('useCopyAck()') && support.includes("ackWord(copied, 'Copy report')"), 'support\u2019s report copy says refused');
  assert.ok(support.includes("ackWord(copied, 'Copy')"), 'support\u2019s email copy says refused');
  assert.ok(wizard.includes('useKeyedCopyAck()') && wizard.includes('ackWord(spoke, '), 'the wizard\u2019s verbs say refused');
  assert.ok(platform.includes('useCopyAck()') && platform.includes('ackWord(copied, '), 'the platform page\u2019s verb says refused');
  assert.ok(settings.includes('useCopyAck(1600)') && settings.includes("ackWord(copied, 'Copy')"), 'settings\u2019 copy keeps its 1600 breath and says refused');
  for (const [name, src] of [['floor', floor], ['support', support], ['wizard', wizard], ['platform', platform], ['settings', settings]]) {
    assert.ok(src.includes('text-[#8A5A00]'), `${name} wears the warning-amber fail ear`);
  }
});

/* ── 6. the fail EAR and the voice ────────────────────────────────────── */
check('the fail ear is the house\u2019s amber AlertTriangle; the ok ear the paid green; every ack announces', () => {
  for (const [name, src] of [['menu', menu], ['inventory', inventory], ['reports', reports], ['bills', bills], ['eod', eod], ['customers', customers], ['floor', floor]]) {
    assert.ok(src.includes("<AlertTriangle"), `${name} has the fail ear`);
    assert.ok(src.includes('aria-live="polite"'), `${name} announces its acks`);
  }
  assert.ok(!/AlertTriangle size=\{1[2-5]\} className="text-\[#8A5A00\]" aria-hidden \/>[\s\S]{0,80}Copied/.test(menu), 'the amber ear never speaks the ok word');
  assert.ok(inventory.includes('text-[#2E7D32]'), 'the ok ear stays the paid green');
});

/* ── 7. the doctrine stands ───────────────────────────────────────────── */
check('the doctrine is not vandalized — the door, the breath, the guest twin stay standing', () => {
  const clipboard = read('src/lib/clipboard.ts');
  const flag = read('src/lib/useTransientFlag.ts');
  const guest = read('src/components/guest/GuestPages.tsx');
  assert.ok(clipboard.includes('export async function copyText'), 'the one door stands');
  assert.equal(walk('/home/z/my-project/src').filter((f) => !f.endsWith('lib/clipboard.ts') && /navigator\.clipboard|execCommand/.test(readFileSync(f, 'utf8'))).length, 0, 'the census law: the raw API is spoken once');
  assert.ok(flag.includes('export function useTransientFlag'), 'the one breath stands — the non-copy flags keep their home');
  assert.ok(settings.includes('useTransientFlag'), 'settings\u2019 non-copy flags (saved/cleared) still ride the breath lib');
  assert.ok(guest.includes('useCopyAck(1600)') && guest.includes('runCopy(window.location.href);') && !guest.includes('setCopied') && guest.includes('aria-live="polite"'), 'the guest twin rides the ack breath (v5.278.0 re-pin: the hand-rolled boolean gone)');
});

/* ── 8. the version law ───────────────────────────────────────────────── */
check('APP_VERSION and sw.js agree — the agreement shape', () => {
  const v = version.match(/APP_VERSION = '([^']+)'/)?.[1];
  assert.ok(v, 'version.ts speaks a version');
  /* v5.278.0 — the literal belongs to the current round's unit (the
   * unit308 precedent): this check keeps the AGREEMENT shape — the
   * two files must speak one word, whichever it is. */
  assert.ok(v && sw.includes(`const VERSION = "servepoint-v${v}-r1";`), 'the two files speak one word');
  assert.ok(sw.includes(`const VERSION = "servepoint-v${v}-r1";`), 'the service worker bakes the SAME word');
});
