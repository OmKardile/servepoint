/* unit324 — v5.285.0 "the porch keeps its narrow door" (agreement shape)
 * The round's lens: the porch family at 320px — the narrow Androids India
 * actually holds — and the walk FOUND its finding on the emergency page:
 * the 404 header held wordmark + Help pill + "Open the app" in one h-16
 * row, and at 320px the crush wrapped the gold CTA's words into three
 * clipped lines inside a 36px pill. The house's own grammar already
 * existed — IndexHelpPage's Showcase pill has stood down below sm since
 * 5.2.1 — but the 404 and the showcase never learned it. THE FIX, one
 * grammar across the family: the secondary pill hides below sm (the
 * footer keeps the door — both footers carry App/Showcase/Help), and
 * EVERY porch nav pill wears shrink-0 whitespace-nowrap, so no width can
 * ever wrap a pill's words into a clipped stack again. THE FEATURE: the
 * 404's address echo — the chip that says "You followed /no-such-page" —
 * learned to travel: one tap copies the FULL url (origin + path, the
 * exact string a support ticket needs) through the house's ONE copy door
 * (useCopyAck, v5.277.0) with ackWord's one word ("Copy this address" →
 * "Copied" / "Copy blocked"), the chip's border naming the outcome —
 * gold-warm on hover, green when the copy happened, the honest red when
 * the device refused — and the trailing icon Copy→Check on the breath. */

import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const read = (p) => readFileSync(`/home/z/my-project/${p}`, 'utf8');

const notfound = read('src/components/pages/NotFoundPage.tsx');
const showcase = read('src/components/pages/ShowcasePage.tsx');
const indexhelp = read('src/components/pages/IndexHelpPage.tsx');
const version = read('src/version.ts');
const sw = read('public/sw.js');

test('unit324 · the narrow door is ONE grammar — the secondary pill stands down below sm on all three porch headers', () => {
  // 404 + showcase learn the grammar IndexHelp already spoke
  for (const [name, src] of [['404', notfound], ['showcase', showcase]]) {
    assert.match(
      src,
      /className="hidden h-9 shrink-0 items-center whitespace-nowrap rounded-full border border-\[#E3E7E0\] bg-white px-4 text-\[13px\] font-semibold text-\[#0F3D3E\] transition hover:border-\[#C9CFC9\] sm:flex"/,
      `${name}'s secondary pill must stand down below sm`
    );
  }
  // index-help's Showcase pill keeps its own post
  assert.match(
    indexhelp,
    /className="hidden h-9 shrink-0 items-center whitespace-nowrap rounded-full border border-\[#E3E7E0\] bg-white px-4 text-\[13px\] font-semibold text-\[#0F3D3E\] transition hover:border-\[#C9CFC9\] sm:flex"/
  );
});

test('unit324 · the nowrap belt — no porch pill can ever wrap its words', () => {
  // the gold CTA wears shrink-0 whitespace-nowrap on ALL THREE headers
  const cta =
    /className="sp-cta flex h-9 shrink-0 items-center whitespace-nowrap rounded-full px-4 text-\[13px\]"/;
  assert.match(notfound, cta);
  assert.match(showcase, cta);
  assert.match(indexhelp, cta);
});

test('unit324 · the door survives the stand-down — the footers keep App/Showcase/Help', () => {
  // hiding a header pill below sm is honest ONLY because the footer
  // carries the same door; pin the footer nav on the two changed pages
  for (const [name, src] of [['404', notfound], ['showcase', showcase]]) {
    assert.match(
      src,
      /<a href="\/" className="hover:underline hover:underline-offset-2">App<\/a>/,
      `${name}'s footer must keep the App door`
    );
    assert.match(
      src,
      /<a href="\/index-help" className="hover:underline hover:underline-offset-2">Help<\/a>/,
      `${name}'s footer must keep the Help door`
    );
  }
});

test('unit324 · the echo learned to travel — the 404 chip rides the ONE copy breath', () => {
  // the chip is a button now, speaking the house's one ack
  const chip = notfound.match(/<button\s*\n\s*type="button"\s*\n\s*onClick=\{\(\) => runCopy\(window\.location\.href\)\}[\s\S]*?<\/button>/);
  assert.ok(chip, 'the address echo must be a copy-verb button');
  assert.match(chip[0], /ackWord\(copyAck, 'Copy this address'\)/);
  assert.match(chip[0], /aria-label=\{`Copy this address — \$\{window\.location\.href\}`\}/);
  assert.match(chip[0], /aria-live="polite"/);
  // the FULL url travels (origin + path — what a ticket needs), via the
  // one door: the hook import edge carries it
  assert.match(notfound, /import \{ ackWord, useCopyAck \} from '\.\.\/\.\.\/lib\/useCopyAck';/);
  // the border names the outcome: green on ok, the honest red on fail
  assert.match(chip[0], /'border-\[#2E7D32\]\/40'/);
  assert.match(chip[0], /'border-\[#B4483C\]\/50'/);
  // the trailing icon flips Copy→Check on the breath, tinted per verdict
  assert.match(chip[0], /copyAck === 'ok' \? \(/);
  assert.match(chip[0], /<Check size=\{13\} className="shrink-0 text-\[#2E7D32\]" aria-hidden \/>/);
  assert.match(chip[0], /copyAck === 'fail' \? 'text-\[#B4483C\]' : 'text-\[#969696\]'/);
});

test('unit324 · the registers stand — the porch voice, the battery pins, the lib untouched', () => {
  // the porch's own register keeps its words (the walk found layout, not copy)
  assert.match(notfound, /No such room in this house\./);
  assert.match(notfound, /This address leads nowhere/);
  assert.match(showcase, /Run the counter,/);
  assert.match(indexhelp, /Everything you need/);
  // the footers' DERIVED version line stands (unit286's pin family)
  for (const src of [notfound, showcase, indexhelp]) {
    assert.match(src, /© 2026 ServePoint · smartPOS · v\{APP_VERSION\}/);
  }
  // the ONE ack lib is untouched — the porch only imports it
  const lib = read('src/lib/useCopyAck.ts');
  assert.match(lib, /export function useCopyAck\(ms = 1800\)/);
  assert.match(lib, /export function ackWord\(/);
});

test('unit324 · the version law — version.ts and sw.js carry the same word', () => {
  const v = version.match(/export const APP_VERSION = '([^']+)';/);
  const s = sw.match(/const VERSION = "servepoint-v([^-]+)-r(\d+)"/);
  assert.ok(v, 'version.ts must speak APP_VERSION');
  assert.ok(s, 'sw.js must bake the cache word');
  assert.equal(v[1], s[1], 'the two words must agree');
  assert.equal(v[1], '5.285.0');
});
