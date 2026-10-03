#!/usr/bin/env python3
"""Task 163 recovery: quarantine pre-rebuild ghost files (not in live import
closure) into upload/ghosts-pre-rebuild/ (gitignored holding area, reversible).
Exempts: *.d.ts ambient declarations (vite-env.d.ts)."""
import os, shutil

ROOT = '/home/z/my-project'
QUAR = os.path.join(ROOT, 'upload', 'ghosts-pre-rebuild')

ghosts = [l.strip() for l in open('/tmp/ghosts163.txt') if l.strip()]
moved, skipped = [], []
for g in ghosts:
    rel = os.path.relpath(g, ROOT)
    if rel.endswith('.d.ts'):  # ambient declarations stay
        skipped.append(rel)
        continue
    dest = os.path.join(QUAR, rel)
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    shutil.move(g, dest)
    moved.append(rel)

print(f"QUARANTINED: {len(moved)}")
for m in moved:
    print("  -> " + m)
print(f"SKIPPED (kept): {skipped}")

# prune now-empty ghost dirs under src/
for d in ['src/components/pos', 'src/components/superadmin', 'src/components/orders',
          'src/components/storefront', 'src/components/offers', 'src/components/kds',
          'src/components/shifts', 'src/components/tables', 'src/components/native',
          'src/data', 'src/hooks', 'src/utils']:
    p = os.path.join(ROOT, d)
    if os.path.isdir(p) and not os.listdir(p):
        os.rmdir(p)
        print(f"rmdir {d}")
