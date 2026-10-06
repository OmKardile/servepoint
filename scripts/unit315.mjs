/* unit315 — v5.276.0 "the copy finds its way home — one door" (agreement shape)
 * The census finding: a whole-house clipboard walk found FOUR hand-rolled
 * helpers (settings, support, the platform page, the wizard — each with
 * its own fallback copy), FIFTEEN verbs that spoke the raw API with a
 * throw-guard (dead forever on a non-secure origin), the floor's two
 * silent no-ops, and a guest copy-link button that said "Copied" without
 * having copied anything. The house's real deployment is LAN counter
 * tablets on plain HTTP — where navigator.clipboard is undefined — so
 * EVERY copy verb outside settings was broken THERE. THE ROUND:
 *   1. THE ONE DOOR: lib/clipboard — copyText(): the async Clipboard API
 *      when the origin is secure, the select-and-execCommand textarea
 *      fallback when it is not, one honest boolean out the other side;
 *   2. THE CENSUS LAW: navigator.clipboard and execCommand appear in
 *      exactly ONE src file — the lib's own;
 *   3. THE FOUR TWINS RETIRED: the settings/support/platform/wizard
 *      locals are deleted, their call sites ride the lib;
 *   4. THE SEVENTEEN WAKE: every throw-guard verb (eod, bills ×2,
 *      reports ×6, inventory ×2, menu, customers) hands through copyText —
 *      the fail words stay, but on a plain-HTTP tablet they now fire only
 *      when the copy truly failed;
 *   5. THE GUEST LIE FIXED: the track page's copy-link flips Copied only
 *      when the boolean is true;
 *   6. THE FLOOR'S VERBS SPEAK: the silent token copy earns its OWN word
 *      (state, aria flip, BadgeCheck ear) without borrowing the Link
 *      button's;
 *   7. THE ONE BREATH: lib/useTransientFlag is the timed-flag's one home
 *      (fire, re-arm, unmount cleanup); useExportFlash rides it; the menu
 *      and settings local copies are retired;
 *   8. THE VERSION LAW: APP_VERSION and sw.js agree (the agreement shape
 *      — the literal belongs to this round's unit). */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';

const clip = readFileSync('/home/z/my-project/src/lib/clipboard.ts', 'utf8');
const flag = readFileSync('/home/z/my-project/src/lib/useTransientFlag.ts', 'utf8');
const flash = readFileSync('/home/z/my-project/src/lib/useExportFlash.ts', 'utf8');
const settings = readFileSync('/home/z/my-project/src/components/settings/SettingsScreen.tsx', 'utf8');
const support = readFileSync('/home/z/my-project/src/components/support/SupportScreen.tsx', 'utf8');
const platform = readFileSync('/home/z/my-project/src/components/platform/PlatformScreen.tsx', 'utf8');
const wizard = readFileSync('/home/z/my-project/src/components/platform/ProvisioningWizard.tsx', 'utf8');
const eod = readFileSync('/home/z/my-project/src/components/eod/EodScreen.tsx', 'utf8');
const bills = readFileSync('/home/z/my-project/src/components/bills/BillsScreen.tsx', 'utf8');
const reports = readFileSync('/home/z/my-project/src/components/reports/ReportsScreen.tsx', 'utf8');
const inventory = readFileSync('/home/z/my-project/src/components/inventory/InventoryScreen.tsx', 'utf8');
const menu = readFileSync('/home/z/my-project/src/components/menu/MenuScreen.tsx', 'utf8');
const customers = readFileSync('/home/z/my-project/src/components/customers/CustomersScreen.tsx', 'utf8');
const floor = readFileSync('/home/z/my-project/src/components/floor/FloorScreen.tsx', 'utf8');
const guest = readFileSync('/home/z/my-project/src/components/guest/GuestPages.tsx', 'utf8');
const versionTs = readFileSync('/home/z/my-project/src/version.ts', 'utf8');
const swJs = readFileSync('/home/z/my-project/public/sw.js', 'utf8');

let passed = 0;
const check = (name, fn) => {
  fn();
  passed += 1;
  console.log(`  ok ${passed} — ${name}`);
};

const count = (hay, needle) => hay.split(needle).length - 1;
const walk = (dir) => {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = `${dir}/${name}`;
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.(tsx?|mjs|css)$/.test(name)) out.push(p);
  }
  return out;
};

/* ── 1. the one door ──────────────────────────────────────────────────── */
check('lib/clipboard speaks the ONE door — secure API, legacy fallback, one honest boolean', () => {
  assert.ok(clip.includes('export async function copyText(text: string): Promise<boolean>'), 'the word is named and returns the honest boolean');
  assert.ok(clip.includes('if (navigator.clipboard && window.isSecureContext)'), 'the async door opens on secure origins');
  assert.ok(clip.includes("document.execCommand('copy')"), 'the legacy door — select-and-execCommand');
  assert.ok(clip.includes('ta.setAttribute(\'readonly\', \'\');') && clip.includes('ta.focus();'), 'the textarea is readonly and focused (the iOS shape)');
  assert.ok(clip.includes("throw new Error('clipboard unavailable')") === false, 'the lib never throws — a refused copy is an answer');
  assert.ok(clip.includes('LAN counter tablets on plain HTTP'), 'the lib says why it exists — the real deployment target');
  assert.ok(clip.includes('Never throws: a refused copy is an ANSWER'), 'the contract is spoken');
});

/* ── 2. the census law ────────────────────────────────────────────────── */
check('the clipboard API is spoken in exactly ONE src file — the lib\'s own', () => {
  const offenders = walk('/home/z/my-project/src')
    .filter((f) => !f.endsWith('lib/clipboard.ts'))
    .filter((f) => /navigator\.clipboard|execCommand/.test(readFileSync(f, 'utf8')));
  assert.deepEqual(offenders, [], `raw clipboard refs remain: ${offenders.join(', ')}`);
});

/* ── 3. the four twins retired ────────────────────────────────────────── */
check('the four hand-rolled helpers are retired — every platform word rides the lib', () => {
  assert.ok(!/async function copyToClipboard|function copyToClipboard/.test(settings), 'settings\u2019 local is gone');
  assert.ok(!/const copyText = \(text: string, onDone/.test(support), 'support\u2019s local is gone');
  assert.ok(!/function copyPlain/.test(platform), 'the platform\u2019s copyPlain is gone');
  assert.ok(!/async function copyText/.test(wizard), 'the wizard\u2019s local is gone');
  for (const [name, src] of [['settings', settings], ['support', support], ['platform', platform], ['wizard', wizard]]) {
    assert.ok(src.includes("import { copyText } from '../../lib/clipboard';"), `${name} imports the ONE door`);
  }
  assert.ok(settings.includes('const ok = await copyText(value);') && settings.includes('if (ok) fireCopied();'), 'settings\u2019 CopyButton keeps its honest boolean gate');
  assert.ok(platform.includes('const ok = await copyText(value);') && platform.includes('if (!ok) return;'), 'the platform\u2019s refusal stays silent');
  assert.ok(wizard.includes('const ok = await copyText(text);'), 'the wizard\u2019s call sites keep their name — the lib word IS copyText');
});

/* ── 4. the seventeen wake ─────────────────────────────────────────────── */
check('all seventeen guarded verbs hand through copyText — the fail words stay honest', () => {
  assert.equal(count(eod, 'await copyText('), 1, 'the closeout\u2019s Z-report copy');
  assert.equal(count(bills, 'await copyText('), 2, 'the chase text and the receipt text');
  assert.equal(count(reports, 'await copyText('), 6, 'the six report copies');
  assert.equal(count(inventory, 'await copyText('), 2, 'the production sheet and the reorder list');
  assert.equal(count(menu, 'await copyText('), 1, 'the menu\u2019s chat text');
  assert.equal(count(customers, 'await copyText('), 1, 'the offer scorecard copy');
  for (const [name, src] of [['eod', eod], ['bills', bills], ['reports', reports], ['inventory', inventory], ['menu', menu], ['customers', customers]]) {
    assert.ok(!src.includes('navigator.clipboard'), `${name} never speaks the raw API`);
    assert.ok(src.includes("import { copyText } from '../../lib/clipboard';"), `${name} imports the ONE door`);
  }
  assert.ok(eod.includes("throw new Error('clipboard unavailable');"), 'the guard\u2019s fail word stays — the catch decides what the surface says');
});

/* ── 5. the guest lie fixed ────────────────────────────────────────────── */
check('the guest\u2019s copy-link says Copied only when the copy happened', () => {
  assert.ok(guest.includes('void copyText(window.location.href).then(setCopied);'), 'the honest boolean drives the word');
  assert.ok(guest.includes('the lie is gone'), 'the comment names what changed');
  assert.ok(!guest.includes('navigator.clipboard'), 'the raw API is gone from the guest pages');
  assert.ok(guest.includes("import { copyText } from '../../lib/clipboard';"), 'the guest pages import the ONE door');
});

/* ── 6. the floor's verbs speak ────────────────────────────────────────── */
check('the floor\u2019s copy verbs ride the door — the silent token copy earns its OWN word', () => {
  assert.equal(count(floor, 'await copyText('), 3, 'the link, the token, and the session\u2019s own copy');
  assert.ok(floor.includes("if (!(await copyText(text))) return;"), 'a refused link/token copy stays silent — the raw text is on screen anyway');
  assert.ok(floor.includes("setActionError('Copy failed — long-press the link text instead.')"), 'the copy-link\u2019s error word stays');
  assert.ok(floor.includes('const [copiedTokenId, setCopiedTokenId] = useState<string | null>(null);'), 'the token copy has its OWN state — sharing would flip the LINK button\u2019s word (a lie)');
  assert.ok(floor.includes('copiedTokenId === t.id ? `QR token for table ${t.table_number} copied` : `Copy raw QR token for table ${t.table_number}`'), 'the token\u2019s aria flips with the breath');
  assert.ok(floor.includes('{copiedTokenId === t.id ? <BadgeCheck size={13} className="text-[#2E7D32]" aria-hidden /> : <Copy size={13} aria-hidden />}'), 'the token\u2019s ear swaps for the breath');
});

/* ── 7. the one breath ─────────────────────────────────────────────────── */
check('the breath has ONE home — the flag lib; the export ack rides it', () => {
  assert.equal(walk('/home/z/my-project/src').filter((f) => /function useTransientFlag/.test(readFileSync(f, 'utf8'))).length, 1, 'one definition, in the lib');
  assert.ok(flag.includes('export function useTransientFlag(ms = 2400): [boolean, () => void]'), 'the default breath is the settings\u2019 own 2400');
  assert.ok(flag.includes('if (timer.current !== null) window.clearTimeout(timer.current);'), 'a re-fire re-arms — the word never stacks a second timer');
  assert.ok(flag.match(/useEffect\(\s*\(\) => \(\) => \{\s*if \(timer\.current !== null\) window\.clearTimeout\(timer\.current\);\s*\},\s*\[\],?\s*\)/), 'the timer is cleaned up on unmount');
  assert.ok(flag.includes('no flag outlives its surface'), 'the lib says why it exists');
  assert.ok(flash.includes('const [saved, setSaved] = useTransientFlag(FLASH_MS);'), 'the export ack rides the ONE breath');
  assert.ok(flash.includes('const FLASH_MS = 2200;'), 'the export\u2019s own breath length stays');
  assert.ok(flash.match(/const speak = \(run: \(\) => void\): void => \{\s*run\(\);\s*setSaved\(\);\s*\};/), 'run-then-speak: the export still exports before the word');
  assert.ok(flash.includes('re-tap inside the window just re-arms'), 'the ack\u2019s own law stays spoken');
  for (const [name, src, ms] of [['menu', menu, 'useTransientFlag(2200)'], ['settings', settings, 'useTransientFlag(1600)']]) {
    assert.ok(src.includes(`import { useTransientFlag } from '../../lib/useTransientFlag';`), `${name} imports the ONE breath`);
    assert.ok(src.includes(ms), `${name} keeps its own breath length`);
  }
});

/* ── 8. the version law ───────────────────────────────────────────────── */
check('APP_VERSION and sw.js agree — the agreement shape', () => {
  const v = versionTs.match(/APP_VERSION = '([^']+)'/)?.[1] ?? '';
  assert.equal(v, '5.276.0', 'the version word is this round\u2019s');
  assert.ok(swJs.includes(`const VERSION = "servepoint-v${v}-r1";`), `sw.js carries the same word (${v})`);
});

console.log(`\nunit315 — PASS ${passed}/${passed} (all checks green)`);
