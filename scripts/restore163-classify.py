#!/usr/bin/env python3
"""Task 163 recovery: classify untracked files after v5.123 overlay.
Residue = file exists in baseline tree (9dfbccd) but NOT in 5.56.0 tree (a561a3b)
         -> it was deleted in the live env before 5.56.0; /tmp incremental copy
            resurrected it. DELETE.
New    = file in NEITHER tree -> added after 5.56.0. KEEP.
"""
import subprocess

BASE = '9dfbccd'   # 5.2.1 baseline (environment reset point)
FIFTYSIX = 'a561a3b'  # remote tip, v5.56.0

def tree(rev):
    out = subprocess.run(['git', 'ls-tree', '-r', '--name-only', rev],
                         capture_output=True, text=True, check=True).stdout
    return set(out.splitlines())

baseline = tree(BASE)
fiftysix = tree(FIFTYSIX)

st = subprocess.run(['git', 'status', '--porcelain'], capture_output=True,
                    text=True, check=True).stdout
untracked = [l[3:].strip() for l in st.splitlines() if l.startswith('??')]

residue, new = [], []
for f in untracked:
    # dirs listed wholesale by git status (e.g. ".qa-screens/")
    if f.endswith('/'):
        d = f.rstrip('/')
        sub = subprocess.run(['git', 'ls-files', '--others', '--exclude-standard', d],
                             capture_output=True, text=True, check=True).stdout
        files = [x for x in sub.splitlines() if x.strip()]
    else:
        files = [f]
    for x in files:
        if x in baseline and x not in fiftysix:
            residue.append(x)
        else:
            new.append(x)

print(f"RESIDUE (delete): {len(residue)}")
for f in sorted(residue):
    print(f"  DEL {f}")
print(f"\nNEW (keep): {len(new)}")
for f in sorted(new):
    print(f"  KEEP {f}")

with open('/tmp/restore163-residue.txt', 'w') as fh:
    fh.write('\n'.join(sorted(residue)) + '\n')
with open('/tmp/restore163-new.txt', 'w') as fh:
    fh.write('\n'.join(sorted(new)) + '\n')
