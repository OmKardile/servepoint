/* Task 270 — v5.231.0 unit suite: the trending card tells the whole truth.
 *
 * Two defects found by the Task 270 walk:
 *
 * BUG — the trending tag never asked the menu. `tag: v.veg === false ?
 * 'Signature' : 'Food'` is a guess from is_veg, not the dish's shelf: a
 * Flat White (Coffee) wore "Food" and a Blueberry Muffin (Bakery) wore
 * "Food" — the tag beside the name was a lie in two ways at once.
 *
 * THIN READ — the card counted plates and stayed silent on money: the
 * order_items read carried name/qty/order_id but not item_total, so "how
 * much the plates carried" lived nowhere on the tile.
 *
 * v5.231.0: the meta join carries category_id with categories as the
 * id→name map; the tag law is ONE closure both slice sites read (the
 * 5.196 shape: one set, no fork) — the dish's own category when the shelf
 * knows it, the old is_veg guess only as the fail-soft for a dish whose
 * menu row is gone; item_total rides the same wide fetch, accumulated
 * fail-soft (null lines add zero, never NaN); the rows speak the money in
 * the line's grey tabular voice beneath the bold plates; the week footer
 * names the top four's take when it is non-zero and keeps its old bytes
 * when it is not.
 *
 * Asserted: the wire pins (category_id + item_total + the categories
 * fetch); the map shape ×2 (category seed fail-soft, rev accumulator
 * fail-soft); the tag law declared once and called ×2 with the inline
 * fork EXTINCT; the types carry revenue; the row money grammar (grey +
 * tabular + ₹ + fail-soft) at a single site; the pill and the bold plates
 * byte-preserved; the footer's two-state law; no new timer (the screen's
 * ONE standing interval stands).
 * Run: bunx vite-node scripts/unit270.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

let n = 0;
const ok = (name) => console.log(`  ok ${++n} - ${name}`);
const strip = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');

const api = strip('../src/lib/api.ts');
const types = strip('../src/types.ts');
const dash = strip('../src/components/dashboard/DashboardScreen.tsx');

/* ── 1–3: the wire — the reads carry what the truth needs ── */

/* 1 — the menu meta fetch carries the shelf-word's key. */
assert.ok(
  api.includes(".select('id, name, is_veg, image_url, category_id')"),
  'menu_items fetch carries category_id'
);
ok('wire: menu_items select carries category_id');

/* 2 — categories rides as the id→name map. */
assert.ok(
  api.includes(".from('categories')\n    .select('id, name')\n    .eq('tenant_id', tenantId)"),
  'fetchDashboard fetches categories (id, name)'
);
assert.ok(api.includes('categoryNameById'), 'the id→name map exists');
ok('wire: categories fetch + categoryNameById map');

/* 3 — item_total rides the wide order_items read. */
assert.ok(
  api.includes(".select('name, qty, order_id, item_total')"),
  'order_items fetch carries item_total'
);
ok('wire: order_items select carries item_total');

/* ── 4–6: the map shape — both slices, one shape, fail-soft ── */

/* 4 — the seed: category resolved through the map, fail-soft to null when
 * the id is unknown; rev starts at zero. Both slices must seed alike. */
const seeds = api.split('category: meta?.category_id != null ? categoryNameById.get(meta.category_id) ?? null : null,').length - 1;
assert.equal(seeds, 2, 'the category seed appears at BOTH slice sites (today + week)');
ok('map shape: fail-soft category seed ×2 (today + week)');

/* 5 — the accumulator: a null/malformed line total adds zero, never NaN. */
const revs = api.split('prev.rev += Number(it.item_total) || 0;').length - 1;
assert.equal(revs, 2, 'the rev accumulator appears at BOTH slice sites');
ok('fail-soft: rev accumulator ×2 — Number() || 0, never NaN');

/* 6 — rev: 0 seeds beside the count seeds (the maps cannot fork). */
const revSeeds = api.split('        count: 0,\n        rev: 0,').length - 1;
assert.equal(revSeeds, 2, 'both maps seed count and rev together');
ok('map shape: count + rev seeded together ×2');

/* ── 7–9: the tag law — one law, no fork ── */

/* 7 — the law is declared ONCE as a closure. */
assert.ok(
  api.includes(
    'const trendingTag = (v: { veg?: boolean | null; category?: string | null }): string =>\n    v.category ?? (v.veg === false ? \'Signature\' : \'Food\');'
  ),
  'the tag law closure exists: category first, is_veg fallback'
);
ok('tag law: category first, the old guess only as fail-soft');

/* 8 — the inline fork is EXTINCT: no slice site guesses anymore. */
assert.equal(
  api.includes("tag: v.veg === false ? 'Signature' : 'Food',"),
  false,
  'the inline is_veg tag fork must be extinct from both slice sites'
);
ok('fork extinct: the inline is_veg tag expression no longer exists');

/* 9 — both slices call the same closure (5.196: one set, no fork). */
const calls = api.split('tag: trendingTag(v),').length - 1;
assert.equal(calls, 2, 'trendingTag called at BOTH slice sites');
ok('one law: both slices call trendingTag — no fork');

/* ── 10: the types carry the money ── */
const typeRows = types.split('orders: number; revenue: number; image_url?: string | null').length - 1;
assert.equal(typeRows, 2, 'both trending row shapes carry revenue: number');
ok('types: trendingDishes + weeklyTrending rows carry revenue');

/* ── 11–13: the card — the money beside the plates ── */

/* 11 — the row stack: plates keep their bold; the ₹ speaks grey beneath,
 * tabular so the column adds up by eye, fail-soft at the render. */
assert.ok(
  dash.includes('<div className="shrink-0 text-right">'),
  'the right-aligned money stack exists'
);
assert.ok(
  dash.includes('mt-[2px] block text-[11.5px] font-medium tabular-nums text-[#969696]'),
  'the money span wears the line-grey tabular voice'
);
assert.ok(
  dash.includes('{money(Number(dish.revenue) || 0)}'),
  'the money renders through the lib\u2019s ONE register (v5.278.0: \u20b9 + en-IN 2dp via money()), fail-soft'
);
assert.ok(
  dash.includes('carried by ${dish.orders} ${dish.orders === 1 ? \'plate\' : \'plates\'}'),
  'the title names the plates the money carried (singular/plural)'
);
ok('card: money stack — grey + tabular + ₹ + fail-soft + honest title');

/* 12 — the bold plates byte-preserved beside the new money. */
assert.ok(
  dash.includes('block text-[14px] font-bold text-[#1A1A1A]'),
  'the plates keep their bold voice'
);
ok('card: the plates keep their bold');

/* 13 — the money stack is ONE site (the row grammar is shared by both
 * windows — no fork between today and week rows). */
const stacks = dash.split('shrink-0 text-right').length - 1;
assert.equal(stacks, 1, 'exactly one money-stack site in the card');
ok('one grammar: the money stack is a single site');

/* 14 — the gold pill byte-preserved: the category word wears the same
 * pill the old guesses wore. */
assert.ok(
  dash.includes('rounded-full bg-[#B88E2F] px-2 py-[2px] text-[10px] font-semibold leading-none text-white'),
  'the tag pill keeps its bytes'
);
ok('pill byte-preserved: the category wears the same gold');

/* ── 15: the footer's two-state law ── */

/* 15 — revenue > 0 names the top four's take; zero keeps the old bytes.
 * The claim can never double-speak "top four shown" twice. */
assert.ok(
  dash.includes('on the top four shown'),
  'the footer names the take when the top four carried money'
);
assert.ok(
  dash.includes(") : (\n              ' · top four shown'\n            )}"),
  'the zero path keeps the footer’s old bytes'
);
assert.ok(
  dash.includes('const weekRevenue = data.weeklyTrending.reduce((s, d) => s + (Number(d.revenue) || 0), 0);'),
  'the footer sum is fail-soft'
);
ok('footer: two-state law — the take named when > 0, old bytes at zero');

/* ── 16: no new timer ── */

/* 16 — the screen's ONE standing interval stands; a render-side sum adds
 * no clock. */
const timers = dash.match(/setInterval/g) || [];
assert.equal(timers.length, 1, 'setInterval count stands at 1 (the NOW poll)');
ok('no new timer: the money is a sum, not a clock — the interval stands');

console.log(`\nunit270 — ${n} checks green`);
