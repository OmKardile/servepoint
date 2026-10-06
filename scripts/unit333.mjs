/* unit333 — v5.294.0 "the cart drawer learns the stick; the counter learns
 * to clear the rush" (agreement shape). The fresh-eyes walk (844×390 phone
 * landscape — a lens no round had taken) FOUND its finding on the guest's
 * most consequential surface: the cart drawer's footer (bill + notes +
 * Place order, ~318px natural) had NO shrink discipline — at 390px the
 * rows' scroll region collapsed to 32px, the footer STILL overflowed the
 * drawer's own rounded bottom by 37px, and Place order sat 21px-clipped
 * below the fold with no scroll law to reach it (the v5.289 wizard's
 * disease, one drawer late — the guest family's own turn). THE FIX: the
 * footer shrinks (min-h-0 flex-col), the money and every alert hold their
 * seat (shrink-0), the optional words scroll (min-h-0 flex-1 overflow-
 * y-auto), and the verb holds the drawer's own bottom edge (shrink-0).
 * THE FEATURE: the counter inbox learned to clear the rush — "Ok all · N"
 * beside the bell (two or more tickets only), the two-tap confirm door,
 * one-ticket-at-a-time firing through the SAME advanceOrder door the
 * cards speak, the honest "Cleared X of N — …" on a mid-rush failure,
 * and a band-wide busy that stands every card's verbs down while firing. */

import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const read = (p) => readFileSync(`/home/z/my-project/${p}`, 'utf8');

const guest = read('src/components/guest/GuestPages.tsx');
const inbox = read('src/components/food/CounterInbox.tsx');
const version = read('src/version.ts');
const sw = read('public/sw.js');

const count = (hay, needle) => hay.split(needle).length - 1;
// the cart drawer's footer region: from the stick law's own comment to the footer's close
const footerIdx = guest.indexOf('footer learns the stick');
const drawerEnd = guest.indexOf("t('placeOrder', { amt: money(cartTotal) })");
const drawerFooter = guest.slice(footerIdx, drawerEnd + 200);

test('unit333 · the stick law — the footer shrinks, the verb holds the edge', () => {
  // the footer learned flex-col min-h-0 — it can shrink below its content now
  assert.match(drawerFooter, /className="flex min-h-0 flex-col border-t border-\[#E3E7E0\] px-5 py-4"/);
  // the law names itself in the source
  assert.match(drawerFooter, /footer learns the stick/);
  assert.match(drawerFooter, /Place order\s*\n\s* \* reachable at ANY height/);
  // the verb holds the drawer's own bottom edge — it can never compress
  assert.match(drawerFooter, /className="mt-3 flex h-12 w-full shrink-0 items-center justify-center gap-2 rounded-full text-\[14px\] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-\[#B88E2F\]"/);
  // the bill holds its seat — the money is always visible
  assert.match(drawerFooter, /className="shrink-0 space-y-1 text-\[13px\] text-\[#6B6B6B\]"/);
});

test('unit333 · the alerts hold their seats — the gating words always seen', () => {
  // the place error, the window's warm word and the ended word: shrink-0 each
  assert.match(drawerFooter, /mt-2 shrink-0 rounded-xl bg-\[#FDF3F2\] px-3 py-2 text-\[12\.5px\] text-\[#B4483C\]/);
  assert.match(drawerFooter, /mt-3 flex shrink-0 items-center justify-between gap-2 rounded-xl border border-\[#F0E4C8\] border-l-4 border-l-\[#B45309\]/);
  assert.match(drawerFooter, /mt-3 shrink-0 rounded-xl border border-\[#F0E4C8\] border-l-4 border-l-\[#B45309\]/);
});

test('unit333 · the scroll body — the optional words ride it', () => {
  // the pay note and the kitchen note live inside ONE scroll region
  assert.match(drawerFooter, /<div className="min-h-0 flex-1 overflow-y-auto">/);
  const bodyStart = drawerFooter.indexOf('<div className="min-h-0 flex-1 overflow-y-auto">');
  const bodyEnd = drawerFooter.indexOf('</div>\n                <button');
  assert.ok(bodyStart > -1 && bodyEnd > bodyStart, 'the scroll body closes before the verb');
  const body = drawerFooter.slice(bodyStart, bodyEnd);
  assert.match(body, /t\('payNote'\)/);
  assert.match(body, /id="drawer-note"/);
  assert.match(body, /\{orderNote\.length\}\/\{ORDER_NOTE_MAX\}/);
  // the bill and the verb are OUTSIDE the scroll body
  assert.ok(body.indexOf('t(\'subtotal\')') === -1, 'the bill never scrolls away');
  assert.ok(body.indexOf('void placeOrder()') === -1, 'the verb never scrolls away');
});

test('unit333 · the rush door — Ok all beside the bell', () => {
  // the verb exists, gated at two or more tickets
  assert.match(inbox, /\{tickets\.length >= 2 \? \(/);
  // the two-tap door: the same button arms, then fires
  assert.match(inbox, /onClick=\{\(\) => \(bulkArmed \? void actAll\(\) : setBulkArmed\(true\)\)\}/);
  // the words name what the NEXT tap does; the count is honest and tabular
  assert.match(inbox, /<span className="tabular-nums">Ok all · \{tickets\.length\}<\/span>/);
  assert.match(inbox, /<span className="tabular-nums">Fire all \{tickets\.length\}\?<\/span>/);
  assert.match(inbox, /<span className="tabular-nums">Firing\u2026<\/span>/);
  // the two registers the band already speaks: the Ok teal idle, the confirm red armed
  assert.match(inbox, /bulkArmed \|\| bulkBusy \? 'bg-\[#B3261E\] hover:bg-\[#9C211A\]' : 'bg-\[#0F3D3E\] hover:bg-\[#0C3233\]'/);
  // the band's own chip geometry, and the aria speaks the ask
  assert.match(inbox, /flex h-8 shrink-0 items-center gap-1\.5 rounded-full px-2\.5 text-\[12px\] font-semibold text-white/);
  assert.match(inbox, /aria-label=\{\s*\n\s*bulkBusy/);
});

test('unit333 · the fire — one door, oldest first, the honest score', () => {
  // the fire rides the SAME advanceOrder door the cards speak — one at a time
  assert.match(inbox, /await advanceOrder\(t\.id, tenantId, 'pending'\);/);
  assert.match(inbox, /cleared \+= 1;/);
  // a mid-rush failure stops honestly
  assert.match(inbox, /`Cleared \$\{cleared\} of \$\{total\} — \$\{firstErr\}`/);
  // the armed seat stands down after — fired or failed
  assert.match(inbox, /setBulkArmed\(false\);\n      setBulkBusy\(false\);/);
  // any refresh disarms — a changed queue would make the count a stale promise
  assert.match(inbox, /useEffect\(\(\) => \{\n    setBulkArmed\(false\);\n  \}, \[tickets\]\);/);
});

test('unit333 · the busy band — no double-fire through a card mid-loop', () => {
  // the cards' verbs ride the band's busy now
  assert.match(inbox, /busy=\{bulkBusy \|\| busyId === t\.id\}/);
  // the bulk chip disables while firing
  assert.match(inbox, /disabled=\{bulkBusy\}/);
  // the per-card act's own shape stands byte-still
  assert.match(inbox, /onOk=\{\(\) => void act\(t, 'pending'\)\}/);
  assert.match(inbox, /setBusyId\(null\);/);
});

test('unit333 · the prune law — the drawer and the band byte-still around the new laws', () => {
  // the drawer's own laws stand: the rows region, the stale line, the steppers
  assert.match(guest, /className="min-h-0 flex-1 overflow-y-auto px-5 py-4"/);
  assert.match(guest, /t\('justSoldOut'\)/);
  assert.match(guest, /aria-label=\{t\('qtyDec', \{ name: l\.item\.name \}\)\}/);
  // the offer picker and the name field stand in the rows region
  assert.match(guest, /aria-pressed=\{selected\}/);
  assert.match(guest, /id="g-name"/);
  // the inbox's own words stand: the SLA line, the straggler voice, the bell
  assert.match(inbox, /Ok the oldest first/);
  assert.match(inbox, /No tickets awaiting the counter — all caught up\./);
  assert.match(inbox, /aria-pressed=\{soundOn\}/);
  // the per-ticket Ok keeps its exact word
  assert.match(inbox, /Ok — fire to kitchen/);
});

test('unit333 · the version law — version.ts and sw.js carry the same word', () => {
  const v = version.match(/export const APP_VERSION = '([^']+)';/);
  const s = sw.match(/const VERSION = "servepoint-v([^-]+)-r(\d+)"/);
  assert.ok(v, 'version.ts must speak APP_VERSION');
  assert.ok(s, 'sw.js must bake the cache word');
  assert.equal(v[1], s[1], 'the two words must agree');
  assert.equal(v[1], '5.294.0');
});
