#!/usr/bin/env python3
"""ServePoint brand extraction v3 — exact band boxes measured by scan.

figma-7.png (1920x1080, 100% zoom):
  cream tile x0..710  : mark y11..329, SERVE y358..434, POINT y449..550, tagline y580..597
  black tile x712..1596: same rows (white-on-dark)
figma-9.png (1568x1150): wordmark tile — ServePoint + tagline band y433..762, x34..1131
"""
from PIL import Image
import os

ROOT = "/home/z/my-project"
OUT = f"{ROOT}/tool-results/brand"
os.makedirs(OUT, exist_ok=True)

CREAM = (251, 248, 243)
f7 = Image.open(f"{ROOT}/tool-results/figma-7.png").convert("RGB")
f9 = Image.open(f"{ROOT}/tool-results/figma-9.png").convert("RGB")
TILE_BLACK = f7.getpixel((1580, 640))


def key_bg(img, base, thresh=24.0, hard=90.0):
    """Distance-to-base alpha ramp: base -> alpha 0, far -> alpha 255."""
    img = img.convert("RGB")
    px = img.load()
    w, h = img.size
    out = Image.new("RGBA", (w, h))
    op = out.load()
    br, bg_, bb = base
    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y]
            d = ((r - br) ** 2 + (g - bg_) ** 2 + (b - bb) ** 2) ** 0.5
            if d <= thresh:
                a = 0
            elif d >= hard:
                a = 255
            else:
                a = int(255 * (d - thresh) / (hard - thresh))
            op[x, y] = (r, g, b, a)
    return out


def trim(img, pad=12, alpha_t=8):
    alpha = img.split()[3].point(lambda v: 255 if v > alpha_t else 0)
    box = alpha.getbbox()
    if not box:
        return img
    x0, y0, x1, y1 = box
    return img.crop((max(0, x0 - pad), max(0, y0 - pad),
                     min(img.width, x1 + pad), min(img.height, y1 + pad)))


# ── 1. the geometric MARK (cream tile, transparent) ─────────────────────────
# The Figma toolbar chip sits at ~(0..240, 0..62) OVER the tile — erase it to
# cream before keying (the mark's own shapes start below y≈67).
mark_src = f7.crop((0, 0, 710, 345))
from PIL import ImageDraw
d = ImageDraw.Draw(mark_src)
d.rectangle((0, 0, 250, 63), fill=CREAM)
mark = trim(key_bg(mark_src, CREAM), pad=14)
mark.save(f"{OUT}/mark.png")
print("mark:", mark.size)

# ── 2. the stacked SERVE POINT lockup (transparent, portrait) ───────────────
stacked = trim(key_bg(f7.crop((0, 345, 710, 615)), CREAM), pad=12)
stacked.save(f"{OUT}/stacked-lockup.png")
print("stacked:", stacked.size)

# ── 3. the horizontal ServePoint wordmark (transparent, for splash) ────────
word = trim(key_bg(f9.crop((20, 420, 1145, 775)), CREAM, thresh=20, hard=78), pad=12)
word.save(f"{OUT}/lockup-light.png")
print("lockup:", word.size)

# ── 4. favicons: transparent mark ───────────────────────────────────────────
for name, size in [("favicon.png", 128), ("favicon-32.png", 32)]:
    s = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    mm = mark.copy()
    mm.thumbnail((int(size * 0.86),) * 2, Image.LANCZOS)
    s.paste(mm, ((size - mm.width) // 2, (size - mm.height) // 2), mm)
    s.save(f"{OUT}/{name}")
    print(name, s.size)

# ── 5. PWA + touch icons: mark on brand cream square ───────────────────────
def icon(size, inner, name):
    s = Image.new("RGB", (size, size), CREAM)
    mm = mark.copy()
    mm.thumbnail((int(size * inner),) * 2, Image.LANCZOS)
    s.paste(mm, ((size - mm.width) // 2, (size - mm.height) // 2), mm)
    s.save(f"{OUT}/{name}")
    print(name, s.size)

icon(180, 0.80, "apple-touch-icon.png")
icon(192, 0.76, "icon-192.png")
icon(512, 0.76, "icon-512.png")
icon(512, 0.62, "icon-maskable-512.png")

# ── 6. og-image 1200x630: black dual-tone tile centered ────────────────────
black_tile = f7.crop((712, 0, 1596, 615))
og = Image.new("RGB", (1200, 630), TILE_BLACK)
bt = black_tile.copy()
bt.thumbnail((1080, 560), Image.LANCZOS)
og.paste(bt, ((1200 - bt.width) // 2, (630 - bt.height) // 2))
og.save(f"{OUT}/og-image.jpg", quality=92)
print("og:", og.size, "tile-black:", TILE_BLACK)
print("DONE")
