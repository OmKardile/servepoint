#!/usr/bin/env python3
"""Task 163 recovery: compute the transitive import closure of the live app
(entry: src/main.tsx). Files in src/ NOT in the closure are ghost files from
older eras (never git-tracked, resurrected by the partial /tmp sync).
Outputs: /tmp/closure163.txt (closure) and /tmp/ghosts163.txt (to quarantine).
"""
import os, re, sys

ROOT = '/home/z/my-project'
SRC = os.path.join(ROOT, 'src')
ENTRY = os.path.join(SRC, 'main.tsx')

IMP_RE = re.compile(
    r"""(?:import|export)\s+(?:[\w*{}\s,]+\s+from\s+)?['"]([^'"]+)['"]"""
    r"""|import\(\s*['"]([^'"]+)['"]\s*\)""", re.M)
DYNAMIC_RE = re.compile(r"""import\(\s*['"]([^'"]+)['"]\s*\)""")

def resolve(spec, importer):
    if spec.startswith('@/'):
        p = os.path.join(ROOT, spec[2:])
    elif spec.startswith('.'):
        p = os.path.normpath(os.path.join(os.path.dirname(importer), spec))
    else:
        return None  # bare module (npm dep) — not part of src closure
    cands = [p,
             p + '.ts', p + '.tsx', p + '.js', p + '.jsx',
             os.path.join(p, 'index.ts'), os.path.join(p, 'index.tsx'),
             p + '.css', p + '.json']
    for c in cands:
        if os.path.isfile(c):
            return c
    return None

seen = set()
stack = [ENTRY]
while stack:
    f = stack.pop()
    if f in seen or not os.path.isfile(f):
        continue
    seen.add(f)
    try:
        text = open(f, encoding='utf-8', errors='replace').read()
    except OSError:
        continue
    for m in IMP_RE.finditer(text):
        spec = m.group(1) or m.group(2)
        if not spec:
            continue
        r = resolve(spec, f)
        if r and r not in seen:
            stack.append(r)

all_src = []
for dp, dn, fn in os.walk(SRC):
    for f in fn:
        all_src.append(os.path.join(dp, f))

closure = sorted(f for f in seen if f.startswith(SRC))
ghosts = sorted(f for f in all_src if f not in seen)
ts_ghosts = [g for g in ghosts if g.endswith(('.ts', '.tsx'))]

with open('/tmp/closure163.txt', 'w') as fh:
    fh.write('\n'.join(closure) + '\n')
with open('/tmp/ghosts163.txt', 'w') as fh:
    fh.write('\n'.join(ts_ghosts) + '\n')

print(f"CLOSURE files: {len(closure)}")
print(f"src files total: {len(all_src)}")
print(f"GHOST .ts/.tsx (not imported): {len(ts_ghosts)}")
print("\n-- ghosts --")
for g in ts_ghosts:
    print("  " + os.path.relpath(g, ROOT))
