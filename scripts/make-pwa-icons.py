#!/usr/bin/env python3
"""Generate ServePoint PWA icons from the existing brand favicon (128px tile).

Outputs (public/icons/):
  icon-192.png           — Lanczos upscale of the brand tile
  icon-512.png           — Lanczos upscale of the brand tile
  icon-maskable-512.png  — full-bleed brand background + glyph inside the
                           80% safe zone (Android adaptive/maskable spec)
"""
from PIL import Image
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "public" / "favicon.png"
OUT = ROOT / "public" / "icons"
OUT.mkdir(parents=True, exist_ok=True)

src = Image.open(SRC).convert("RGBA")
print(f"source: {src.size} {src.mode}")

# --- plain icons: high-quality upscale of the tile -------------------------
for size in (192, 512):
    icon = src.resize((size, size), Image.LANCZOS)
    icon.save(OUT / f"icon-{size}.png", optimize=True)
    print(f"icon-{size}.png written")

# --- maskable: full-bleed background, glyph at ~78% (safe zone >= 80%) -----
# Sample the tile's own background so the glyph blends seamlessly into the
# full-bleed canvas (probe a pixel just inside a rounded corner).
probe = src.getpixel((16, 16))
bg = probe if probe[3] > 250 else (246, 245, 242, 255)  # fall back to cream
print(f"maskable background: {bg}")

canvas = Image.new("RGBA", (512, 512), bg)
# Crop INSIDE the source tile's rounded edge (removes the baked-in corner
# stroke so no faint arcs show against the full-bleed background).
inner = src.crop((10, 10, src.width - 10, src.height - 10))
glyph = int(512 * 0.76)  # ~389px — inside the maskable safe zone
logo = inner.resize((glyph, glyph), Image.LANCZOS)
offset = ((512 - glyph) // 2, (512 - glyph) // 2)
canvas.paste(logo, offset, logo)
canvas.save(OUT / "icon-maskable-512.png", optimize=True)
print("icon-maskable-512.png written")

for p in sorted(OUT.glob("*.png")):
    print(f"  {p.name}: {Image.open(p).size}")
