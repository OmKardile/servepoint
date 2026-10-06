/* unit342 — v5.303.0 "the day book hears the day before" (agreement shape)
 * The delta chip's ONE home: DELTA_SKIN + DeltaChip moved out of Reports
 * (v5.20.0's private composer) into lib/delta — the offerLabel lesson, one
 * composer per shared word. THE FEATURE: the close-out's day summary speaks
 * the day-over-day strip — one extra bounded read (the day before, slim
 * columns: status + total, no join, no plates), computed under the SAME
 * counting law as the summary's own agg (a cancelled ticket never happened;
 * avg = gross ÷ live), rendered through the Reports KPI's own chip so both
 * screens speak one comparison dialect (the honest teal "new", the ±0%
 * flat, the 5.94 multiple voice). Fail-soft the voice's own contract: a
 * refused read dims the strip, never the close. The baseline word is
 * honest: "yesterday" only when the browsed day IS today. */

import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const read = (p) => readFileSync(`/home/z/my-project/${p}`, 'utf8');

const eod = read('src/components/eod/EodScreen.tsx');
const reports = read('src/components/reports/ReportsScreen.tsx');
const delta = read('src/lib/delta.tsx');
const version = read('src/version.ts');
const sw = read('public/sw.js');

test('unit342 · the delta chip has ONE home and both screens borrow it', () => {
  // the lib speaks the whole composer: the four skins, the chip, the emptyWord
  assert.match(delta, /export const DELTA_SKIN: Record<'up' \| 'down' \| 'flat' \| 'new'/);
  assert.match(delta, /export const DeltaChip: React\.FC</);
  assert.ok(delta.includes("emptyWord = 'no sales'"), 'the default empty word is the money family\u2019s own');
  assert.ok(delta.includes('const mult = pct >= 1000 ? current / prior : null;'), 'the 5.94 multiple voice rode along');
  // the private copies are GONE — no second composer may drift
  assert.equal(reports.includes('const DELTA_SKIN: Record'), false, 'Reports\u2019 private skins moved out');
  assert.equal(reports.includes('const DeltaChip: React.FC<{'), false, 'Reports\u2019 private chip moved out');
  assert.ok(reports.includes("import { DeltaChip } from '../../lib/delta';"), 'Reports borrows the lib');
  assert.ok(eod.includes("import { DeltaChip } from '../../lib/delta';"), 'the day book borrows the lib');
  // the original borrower keeps its own seat and its own words
  assert.ok(reports.includes('delta: <DeltaChip current={current} prior={prior} baseline={priorLabel} fmt={fmt} />'));
});

test('unit342 · the day before rides the SAME load cycle, slim', () => {
  // one window back, the SAME istDayBounds arithmetic
  assert.ok(eod.includes('const prevBounds = istDayBounds(shiftDay(dateIso, -1));'));
  // slim columns: the strip speaks gross/tickets/avg — never the plates
  assert.ok(eod.includes(".select('status, total')"));
  assert.ok(eod.includes(".eq('tenant_id', tenantId)"), 'tenant-scoped');
  assert.ok(eod.includes(".gte('created_at', prevBounds.startIso)") && eod.includes(".lt('created_at', prevBounds.endIso)"));
  // the read rides the load's own Promise.all — the refresh button catches it too
  assert.ok(eod.includes('const [oRes, pRes, cRes, vRes, yRes] = await Promise.all(['));
});

test('unit342 · the fail-soft contract — the voice\u2019s own', () => {
  assert.ok(eod.includes('setPrevRows(yRes.error ? null :'), 'a refusal lands null — the strip dims');
  assert.ok(eod.includes("setPrevRows(null); // a day switch never shows the last window's deltas while loading"));
  assert.equal(eod.includes('throw yRes.error'), false, 'the delta read never throws into the screen\u2019s catch');
});

test('unit342 · the counting law is the summary\u2019s own, mirrored once', () => {
  // the SAME agg law: a cancelled ticket never happened; avg = gross ÷ live
  assert.ok(eod.includes('const live = prevRows.filter((o) => o.status !== \'cancelled\');'));
  assert.ok(eod.includes('const gross = live.reduce((s, o) => s + Number(o.total || 0), 0);'));
  assert.ok(eod.includes('return { gross, count, avg: count > 0 ? gross / count : 0 };'));
  // the baseline word never lies: "yesterday" only when the browsed day IS today
  assert.ok(eod.includes("dateIso === istTodayIso()\n      ? 'yesterday'"));
  assert.ok(eod.includes('appFormatters().dayLabel.format(new Date(`${shiftDay(dateIso, -1)}T12:00:00Z`))'), 'the noon anchor keeps the label on the reporting calendar');
});

test('unit342 · the strip speaks three comparisons through the chip\u2019s own null law', () => {
  // each comparison filtered by the chip's OWN null law — a silent chip never
  // leaves a bare label behind
  assert.ok(eod.includes(".filter((d) => !(d.prior === 0 && d.current === 0));"));
  // the three: gross, tickets, avg ticket — each with its family's empty word
  assert.ok(eod.includes("label: 'Gross', current: agg.gross, prior: prevAgg.gross"));
  assert.ok(eod.includes("label: 'Tickets', current: agg.live.length, prior: prevAgg.count"));
  assert.ok(eod.includes("label: 'Avg ticket', current: agg.avg, prior: prevAgg.avg"));
  assert.ok(eod.includes("emptyWord: 'no sales'"), 'money speaks sales');
  assert.ok(eod.includes("emptyWord: 'no tickets'"), 'counts speak tickets');
  // both days empty = silence — a comparison of two nothings is not news
  assert.ok(eod.includes('{dayDeltas.length > 0 && ('));
});

test('unit342 · the styling law — one skin, the stagger\u2019s own walk', () => {
  const stripStart = eod.indexOf('aria-label="Day over day"');
  const stripEnd = eod.indexOf('cost & margin: what the shelf burned');
  assert.ok(stripStart > 0 && stripEnd > stripStart, 'the strip is locatable');
  const strip = eod.slice(stripStart, stripEnd);
  assert.ok(strip.includes('title="Both days counted the same way — a cancelled ticket never happened"'), 'the label carries the counting law');
  assert.ok(strip.includes("style={{ animation: 'spFadeIn 240ms ease-out both', animationDelay: `${i * 40}ms` }}"), 'the 301/302 grammar\u2019s own walk');
  assert.ok(strip.includes('vs {prevBaseline}'), 'the comparison names what it compares against');
  assert.ok(strip.includes('<DeltaChip current={d.current} prior={d.prior} baseline={prevBaseline} fmt={d.fmt} emptyWord={d.emptyWord} />'), 'the ONE composer renders');
  // zero new colors: the lib's four skins are the app's existing hexes
  assert.ok(delta.includes("up: { fg: '#2E7D32', bg: '#E7F2EB', bd: '#CFE6D8' }"), 'the green family rode along verbatim');
  assert.ok(delta.includes("down: { fg: '#B3261E', bg: '#FDEEEC', bd: '#F0C4BE' }"), 'the red family rode along verbatim');
  assert.ok(delta.includes("new: { fg: '#0F3D3E', bg: '#DCE9E4', bd: '#C6D8D1' }"), 'the teal "new" rode along verbatim');
});

test('unit342 · the neighbours stand — the summary and the Z byte-still', () => {
  // the 5.260 voice card keeps its own words
  assert.ok(eod.includes("label=\"Guest voice\""));
  assert.ok(eod.includes('setVoiceRows(vRes.error ? null :'), 'the voice read untouched');
  assert.ok(eod.includes('setVoiceRows(null); // a day switch never shows yesterday'), 'the voice\u2019s own reset untouched');
  // the day summary's six cards keep their seats
  assert.ok(eod.includes('label="Gross"') && eod.includes('label="Avg ticket"'));
  // the bin's 5.77 truth keeps its own memo
  assert.ok(eod.includes('const wasteDay = useMemo(() => {'), 'the waste memo follows the delta memos');
  // Reports' local usage count — one borrower seat, no stragglers
  assert.equal(reports.split('<DeltaChip').length - 1, 1, 'Reports renders the chip exactly once');
});

test('unit342 · the feature names itself and its law', () => {
  assert.match(eod, /the day vs the day before/);
  assert.match(eod, /Two days computed by two laws would be two lies wearing one strip/);
  assert.match(delta, /composer's law \(the offerLabel lesson\)/, 'the lib names its law');
  assert.match(reports, /one composer per shared word/, 'the borrower names the law it follows');
});

test('unit342 · the version law — version.ts and sw.js carry the same word', () => {
  const v = version.match(/export const APP_VERSION = '([^']+)';/);
  const s = sw.match(/const VERSION = "servepoint-v([^-]+)-r(\d+)"/);
  assert.ok(v, 'version.ts must speak APP_VERSION');
  assert.ok(s, 'sw.js must bake the cache word');
  assert.equal(v[1], s[1], 'the two words must agree');
  // v5.304.0 relaxed the literal pin per the unit308 precedent (the
  // 320→…→343 chain); the agreement itself is the law — unit343 pins the word.
});
