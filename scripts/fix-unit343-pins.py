"""Re-anchor unit343's three KPI-card seat pins to the v5.305.0 door shape.

The cards grew `door={...}` props, so the old exact-JSX needles broke.
The law (the cards keep their seats, labels and hints) is unchanged —
the needles follow the file per the read-the-actual-shape law.
"""
import sys

p = 'scripts/unit343.mjs'
src = open(p).read()
lines = src.split('\n')

idx = next(i for i, l in enumerate(lines) if 'other three cards' in l)
needle = "assert.ok(platform.includes('<KpiCard"
for i in (idx + 1, idx + 2, idx + 3):
    assert needle in lines[i], f'line {i}: {lines[i]}'

repl = [
    "  assert.ok(platform.includes('label=\"Total businesses\"') && platform.includes('hint={businessesHint}'), 'the Total card keeps its seat (v5.305.0: it grew a door, the seat and the hint stand)');",
    "  assert.ok(platform.includes('label=\"Active subscriptions\"') && platform.includes('hint={activeSubsHint}'), 'the Active-subs card keeps its seat (v5.305.0: it grew a door)');",
    "  assert.ok(platform.includes('label=\"Monthly recurring revenue\"') && platform.includes('hint={mrrHint}'), 'the MRR card keeps its seat (v5.305.0: it grew a door)');",
]
for k, i in enumerate((idx + 1, idx + 2, idx + 3)):
    lines[i] = repl[k]

open(p, 'w').write('\n'.join(lines))
print('unit343 card pins re-anchored to the door shape')
