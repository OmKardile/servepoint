/* unit337 — v5.298.0 "the ticket's honest note + the window's shape" (agreement shape)
 * The QA walk (the 1366×768 lens — the world's most common laptop, never
 * walked before this round) found the house clean but the ticket LYING: every
 * QR order's notes column carries the house's operational suffix (composed
 * server-side since migration 012: concat_ws(' · ', p_notes, 'via QR · Table '
 * || table_number)), and the ticket's note section rendered whenever notes
 * was non-empty — so #133's ticket claimed "YOUR NOTE TO THE KITCHEN" over
 * the body "via QR · Table t1": a guest word that was never written. THE
 * FEATURE: the ticket's honest note — the strip reads the composition's exact
 * grammar, the body speaks the guest's word verbatim (no operational tail),
 * and the section keeps its silence when the guest wrote nothing. THE SHAPE:
 * the ribbon's drain bar — a 2px aria-hidden bar whose width is presentation
 * of the handed msLeft against the issue RPC's own 10-minute law (appday's
 * WINDOW_TOTAL_MS), the window's shape made visible at a glance. */

import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const read = (p) => readFileSync(`/home/z/my-project/${p}`, 'utf8');

const guest = read('src/components/guest/GuestPages.tsx');
const appday = read('src/lib/appday.ts');
const version = read('src/version.ts');
const sw = read('public/sw.js');

const count = (hay, needle) => hay.split(needle).length - 1;

test('unit337 · the strip law reads the house\u2019s exact composition', () => {
  // the helper is born at module level, beside the Track section's own table
  assert.match(guest, /function guestWordFromNotes\(notes: string \| null \| undefined\): string \{/);
  // the strip pins the RPC's grammar: the tail anchors the string's END, the
  // word rides before it, the separator is the composition's own ' · '
  assert.ok(
    guest.includes(`.replace(/(?:^|\\s·\\s)via QR · Table [^·]*$/, '')`),
    'the strip reads the composition\u2019s exact grammar'
  );
  // the trim is the honesty — a word of spaces is no word
  assert.match(guest, /\.trim\(\);\n\}/);
  // the old liar condition is GONE from the ticket
  assert.equal(count(guest, 'order.notes && order.notes.trim().length > 0'), 0);
});

test('unit337 · the card speaks the guest\u2019s word — or keeps its silence', () => {
  // the gate is the guest word, once per render, beside the other derived truths
  assert.match(guest, /const guestNote = guestWordFromNotes\(order\?\.notes\);/);
  assert.match(guest, /\{guestNote\.length > 0 && \(/);
  // the body speaks the guest's word, not the house's tail
  assert.match(guest, /text-\[#6B4A0E\]">\{guestNote\}<\/p>/);
  // the card's face stands byte-still — the warm band, the sticky note, the label
  assert.match(guest, /border-l-\[#B45309\] bg-\[#FBF6EA\] px-3 py-2\.5/);
  assert.match(guest, /<StickyNote size=\{11\} aria-hidden \/> \{t\('trackNoteLabel'\)\}/);
});

test('unit337 · the bill\u2019s neighbours byte-still', () => {
  // the per-item note line stands (the ↳ family)
  assert.match(guest, /\{it\.notes && <p className="text-\[12px\] italic text-\[#8A5A16\]">↳ \{it\.notes\}<\/p>\}/);
  // the DUE/PAID chip stands
  assert.match(guest, /\{paid \? t\('paid'\) : t\('due'\)\}/);
  // the totals block's head stands
  assert.match(guest, /\{t\('subtotal'\)\}<\/span>/);
});

test('unit337 · the ribbon\u2019s drain bar', () => {
  // the bar is aria-hidden — the sentence and the label speak; the bar is for the eye
  assert.match(guest, /<span aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-\[2px\] overflow-hidden">/);
  // the width is presentation of the handed msLeft against the RPC's own law
  assert.match(guest, /width: `\$\{Math\.max\(0, Math\.min\(100, \(msLeft \/ WINDOW_TOTAL_MS\) \* 100\)\)\}%`/);
  // the 1s linear ease walks the drain in step with the tick
  assert.match(guest, /transition-\[width\] duration-1000 ease-linear/);
  // the ended band keeps its silence — no clock, no bar
  assert.match(guest, /\{!ended && \(\n\s*<span aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-\[2px\]/);
  // the warm band drains in the warm ink, the teal band in white — zero new colors
  assert.match(guest, /background: warm \? 'rgba\(138, 90, 22, 0\.35\)' : 'rgba\(255, 255, 255, 0\.6\)'/);
  // the ribbon's own law stands: the container is the ONE status, the aria label rides
  assert.match(guest, /className="relative flex flex-wrap items-center justify-center gap-2 px-4 py-2 text-center text-\[12\.5px\] font-semibold"/);
});

test('unit337 · the drain\u2019s denominator lives beside the window grammar', () => {
  // appday carries the constant, citing migration 002's own interval
  assert.match(appday, /export const WINDOW_TOTAL_MS = 10 \* 60 \* 1000;/);
  assert.match(appday, /`now\(\) \+ INTERVAL '10 minutes'`/);
  // the ribbon imports it beside the constants it already speaks
  assert.match(guest, /import \{ appTimezone, formatWindowLeft, WARM_WINDOW_MS, WINDOW_TOTAL_MS \} from '\.\.\/\.\.\/lib\/appday';/);
});

test('unit337 · the feature names itself and its law', () => {
  // the ticket's honest note
  assert.match(guest, /the ticket's honest note/);
  assert.match(guest, /keeps its silence/);
  assert.match(guest, /the guest's word verbatim — or/);
  // the drain bar's words
  assert.match(guest, /the window's SHAPE rides the ribbon/);
  assert.match(guest, /one window\n\s*arithmetic, never two/);
});

test('unit337 · the ribbon\u2019s older truths stand', () => {
  // the aria label still speaks the m:ss voice
  assert.match(guest, /aria-label=\{t\('ariaEnds', \{ t: left \}\)\}/);
  // the countdown grammar still rides appday
  assert.match(guest, /const left = formatWindowLeft\(msLeft\);/);
  // the warm/ended verdicts still derive on the page (the ribbon computes nothing)
  assert.match(guest, /function SessionRibbon\(\{\n\s*session,\n\s*msLeft,\n\s*ended,\n\s*warm,\n\}: \{/);
});

test('unit337 · the version law — version.ts and sw.js carry the same word', () => {
  const v = version.match(/export const APP_VERSION = '([^']+)';/);
  const s = sw.match(/const VERSION = "servepoint-v([^-]+)-r(\d+)"/);
  assert.ok(v, 'version.ts must speak APP_VERSION');
  assert.ok(s, 'sw.js must bake the cache word');
  assert.equal(v[1], s[1], 'the two words must agree');
  assert.equal(v[1], '5.298.0');
});
