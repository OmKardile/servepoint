#!/usr/bin/env python3
"""ServePoint brand extraction v2 — band-detected, exact-boundary crops.

Captures: figma-6/7.png are 1920x1080 (100% zoom canvas), figma-9.png is
1568x1150. Tile backgrounds: cream (251,248,243), tile black ~ (17,17,17),
canvas gray ~(185,185,185) / (222,220,217).
"""
from PIL import Image
import os

ROOT = "/home/z/my-project"
OUT = f"{ROOT}/tool-results/brand"
os.makedirs(OUT, exist_ok=True)

CREAM = (251, 248, 243)
f6 = Image.open(f"{ROOT}/tool-results/figma-6.png").convert("RGB")
f7 = Image.open(f"{ROOT}/tool-results/figma-7.png").convert("RGB")
f9 = Image.open(f"{ROOT}/tool-results/figma-9.png").convert("RGB")


def near(c, base, tol):
    return all(abs(c[i] - base[i]) <= tol for i in range(3))


def content_mask(im, box, bg_colors, tol=10):
    """Binary map of pixels that are NOT background (any of bg_colors)."""
    x0, y0, x1, y1 = box
    px = im.load()
    rows = []
    for y in range(y0, y1):
        xs = [x for x in range(x0, x1) if not any(near(px[x, y], b, tol) for b in bg_colors)]
        rows.append((y, xs))
    return rows


def bands(rows, min_gap=8, min_px=3):
    """Group content rows into vertical bands separated by >= min_gap empty rows."""
    out = []
    cur = None
    empty = 0
    for y, xs in rows:
        if len(xs) >= min_px:
            if cur is None:
                cur = [y, y, min(xs), max(xs)]
            else:
                cur[1] = y
                cur[2] = min(cur[2], min(xs))
                cur[3] = max(cur[3], max(xs))
            empty = 0
        else:
            empty += 1
            if cur and empty >= min_gap:
                out.append(tuple(cur)); cur = None
    if cur:
        out.append(tuple(cur))
    return out


# ── figma-6 cream tile: mark + SERVE + POINT + tagline bands ────────────────
tile6 = (0, 236, 730, 846)
rows6 = content_mask(f6, tile6, [CREAM, (185, 185, 185), (222, 220, 217)])
b6 = bands(rows6)
print("fig6 cream-tile bands (y0,y1,x0,x1):", b6)

# ── figma-9 wordmark tile bands ──────────────────────────────────────────────
tile9 = (0, 116, 1368, 1136)
rows9 = content_mask(f9, tile9, [CREAM, (222, 220, 217), (185, 185, 185)])
b9 = bands(rows9, min_gap=12)
print("fig9 wordmark-tile bands:", b9)

# ── figma-7 black tile bands (white-on-dark content) ────────────────────────
tile7 = (712, 0, 1596, 740)
rows7 = content_mask(f7, tile7, [(17, 17, 17), (12, 12, 12), (28, 20, 13)])
b7 = bands(rows7, min_gap=12)
print("fig7 black-tile bands:", b7)
