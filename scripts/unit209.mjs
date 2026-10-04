/* Task 209 — v5.170.0 unit suite: the counter's paired shelf line.
 * Covers the new pure contract in src/lib/shelf.ts:
 *   counterShelfLine — voice and tone as ONE pairing: the item detail
 *   modal speaks the same answer the rail speaks (and vice versa), so
 *   the surfaces can never disagree about a dish. Silence for a dish
 *   with no recipe on file — silence, not zero. The tones are the
 *   family's own (shelfTone), the words the family's own (shelfVoice).
 * Run: bunx vite-node scripts/unit209.mjs
 */
import assert from 'node:assert/strict';

const { counterShelfLine, shelfVoice, shelfTone, LOW_COVER } = await import(
  '/src/lib/shelf.ts'
);

let n = 0;
const ok = (name) => console.log(`  ok ${++n} - ${name}`);

const cov = (coverage, thin = null, unknown = false) => ({ coverage, thin, unknown });
const flour = { id: 'f', name: 'Flour' };

/* 1 — a dish with no recipe on file stays SILENT (silence, not zero). */
assert.equal(counterShelfLine(cov(null)), null);
ok('no recipe: silence — the modal says nothing, never "0"');

/* 2 — zero: the red out voice, named bin. */
const zero = counterShelfLine(cov(0, flour));
assert.equal(zero.text, "can't make another — Flour is out");
assert.equal(zero.tone, '#B4483C');
ok('zero: red "can\'t make another" with the bin named');

/* 3 — below the shared threshold: amber "more left". */
const low = counterShelfLine(cov(4, flour));
assert.equal(low.text, '~4 more left');
assert.equal(low.tone, '#8A5A00');
ok('low (4 < 5): amber "~4 more left"');

/* 4 — the LOW_COVER boundary: 5 is NOT below 5 — comfortable green. */
const atFive = counterShelfLine(cov(5, flour));
assert.equal(atFive.text, '~5 more on the shelf');
assert.equal(atFive.tone, '#2E7D32');
assert.equal(LOW_COVER, 5);
ok('boundary: 5 speaks the comfortable green voice (shared threshold)');

/* 5 — comfortable: green "more on the shelf". */
const okLine = counterShelfLine(cov(59, flour));
assert.equal(okLine.text, '~59 more on the shelf');
assert.equal(okLine.tone, '#2E7D32');
ok('comfortable (59): green "~59 more on the shelf"');

/* 6 — unknown: grey "can't answer". */
const unk = counterShelfLine(cov(null, null, true));
assert.equal(unk.text, "shelf can't answer");
assert.equal(unk.tone, '#969696');
ok('unknown: grey "shelf can\'t answer"');

/* 7 — the pairing is STRUCTURAL: text is shelfVoice, tone is shelfTone —
 * the rail and the sheet can never drift apart by construction. */
for (const c of [cov(0, flour), cov(4, flour), cov(5, flour), cov(59, flour), cov(null, null, true)]) {
  const line = counterShelfLine(c);
  assert.equal(line.text, shelfVoice(c));
  assert.equal(line.tone, shelfTone(c));
}
ok('pairing identity: counterShelfLine === shelfVoice + shelfTone, always');

/* 8 — the unknown case is NOT silent (it speaks honestly that it can't). */
assert.notEqual(counterShelfLine(cov(null, null, true)), null);
ok('unknown is a voice, not silence — honesty over quiet');

console.log(`\nunit209 — ${n} asserts, the counter's paired shelf line (v5.170.0)`);
