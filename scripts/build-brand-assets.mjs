#!/usr/bin/env bun
/**
 * Build all ServePoint brand assets from the master source images.
 *
 * Sources (committed, provenance of record):
 *   docs/design/servepoint/brand/src/servepoint-brand-mark.png  — flat vector-style lockup, RGBA pre-keyed (transparent)
 *   docs/design/servepoint/brand/src/servepoint-logo-3d.png     — 3D render lockup, opaque near-black background
 *
 * Outputs:
 *   src/assets/brand/lockup-light.png — full flat lockup, trimmed, for LIGHT surfaces (Splash)
 *   src/assets/brand/mark.png         — flat icon alone, transparent, square-padded (tiles, favicon source)
 *   public/favicon.png                — 128px app-icon tile (rounded cream square + mark)
 *   public/favicon-32.png             — 32px favicon tile
 *   public/apple-touch-icon.png       — 180px full-bleed cream square + mark (iOS masks corners itself)
 *   public/og-image.jpg               — 1200×630 social card (3D render on near-black)
 *
 * Re-run after replacing the sources:  bun scripts/build-brand-assets.mjs
 */
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dir, '..');
const BRAND = path.join(ROOT, 'docs/design/servepoint/brand');
const SRC = (name, uploadName) => {
  const committed = path.join(BRAND, 'src', name);
  if (fs.existsSync(committed)) return committed;
  const uploaded = path.join(ROOT, 'upload', uploadName);
  if (fs.existsSync(uploaded)) return uploaded;
  throw new Error(`Source not found: ${name} (looked in ${committed} and ${uploaded})`);
};
const SRC_FLAT = SRC('servepoint-brand-mark.png', 'ServePoint POS Brand Mark.png');
const SRC_3D = SRC('servepoint-logo-3d.png', 'ServePoint POS Logo (1).png');

const ensureDir = (p) => fs.mkdirSync(path.dirname(p), { recursive: true });
const save = async (buf, out) => {
  ensureDir(out);
  await fs.promises.writeFile(out, buf);
  const meta = await sharp(buf).metadata();
  console.log(`✓ ${path.relative(ROOT, out)}  ${meta.width}x${meta.height}  ${(buf.length / 1024).toFixed(0)}KB`);
};

/** Decode to raw RGBA uchar and return pixel accessors. */
async function rawRGBA(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw({ depth: 'uchar' }).toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels: ch } = info;
  const A = (p) => data[p * ch + 3];
  return { data, w, h, ch, A };
}

/** Bounding box of pixels with alpha > t. */
function bboxAlpha({ w, h, A }, t = 6, x0 = 0, x1 = w - 1, y0 = 0, y1 = h - 1) {
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (A(y * w + x) > t) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  return { minX, minY, maxX, maxY };
}

const padBox = (b, pad, w, h) => ({
  left: Math.max(0, b.minX - pad),
  top: Math.max(0, b.minY - pad),
  width: Math.min(w - 1, b.maxX + pad) - Math.max(0, b.minX - pad) + 1,
  height: Math.min(h - 1, b.maxY + pad) - Math.max(0, b.minY - pad) + 1,
});

/** Pad a buffer to a square canvas (content centred, `fill` fraction of the side). */
async function squarePad(buf, fill = 0.9) {
  const m = await sharp(buf).metadata();
  const side = Math.round(Math.max(m.width, m.height) / fill);
  const top = Math.round((side - m.height) / 2);
  const left = Math.round((side - m.width) / 2);
  return sharp(buf)
    .extend({ top, bottom: side - m.height - top, left, right: side - m.width - left, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
}

// ── 1. Flat logo: full lockup (light surfaces) + icon-only mark ─────────────
const flat = await rawRGBA(SRC_FLAT);
const flatBox = bboxAlpha(flat);
console.log(`flat lockup bbox: x[${flatBox.minX}..${flatBox.maxX}] y[${flatBox.minY}..${flatBox.maxY}]`);

// Column occupancy to find the icon | wordmark gap (first ≥12px empty run after the icon block).
const cols = new Array(flat.w).fill(0);
for (let x = flatBox.minX; x <= flatBox.maxX; x++) {
  let c = 0;
  for (let y = flatBox.minY; y <= flatBox.maxY; y++) if (flat.A(y * flat.w + x) > 6) c++;
  cols[x] = c;
}
let gapStart = -1;
const minIconEnd = flatBox.minX + Math.round((flatBox.maxX - flatBox.minX) * 0.18);
for (let x = minIconEnd; x < flatBox.maxX - 10; x++) {
  if (cols[x] === 0) {
    let run = 0;
    while (x + run <= flatBox.maxX && cols[x + run] === 0) run++;
    if (run >= 12) { gapStart = x; break; }
    x += run;
  }
}
if (gapStart < 0) throw new Error('icon|wordmark gap not found');
console.log(`icon|wordmark gap at x=${gapStart} (run of ${(() => { let r = 0; while (gapStart + r <= flatBox.maxX && cols[gapStart + r] === 0) r++; return r; })()}px)`);

const lockupBox = padBox(flatBox, 8, flat.w, flat.h);
const lockupBuf = await sharp(SRC_FLAT).extract(lockupBox).png().toBuffer();
await save(await sharp(lockupBuf).resize({ width: 900 }).png().toBuffer(), path.join(ROOT, 'src/assets/brand/lockup-light.png'));

const iconRows = bboxAlpha(flat, 6, flatBox.minX, gapStart - 1, flatBox.minY, flatBox.maxY);
const iconBox = padBox(iconRows, 4, flat.w, flat.h);
const iconBuf = await sharp(SRC_FLAT).extract(iconBox).png().toBuffer();
const markSquare = await squarePad(iconBuf, 0.88);
await save(await sharp(markSquare).resize(512, 512).png().toBuffer(), path.join(ROOT, 'src/assets/brand/mark.png'));

// ── 2. Favicon + apple-touch-icon tiles ─────────────────────────────────────
const CREAM = '#FAF7F2';
const mark128 = await sharp(markSquare).resize(102, 102).png().toBuffer();
const faviconBase = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128"><rect width="128" height="128" rx="29" fill="${CREAM}"/></svg>`
);
const faviconBuf = await sharp(faviconBase).composite([{ input: mark128, top: 13, left: 13 }]).png().toBuffer();
await save(faviconBuf, path.join(ROOT, 'public/favicon.png'));
await save(await sharp(faviconBuf).resize(32, 32).png().toBuffer(), path.join(ROOT, 'public/favicon-32.png'));

const mark180 = await sharp(markSquare).resize(126, 126).png().toBuffer();
await save(
  await sharp({ create: { width: 180, height: 180, channels: 4, background: CREAM } })
    .composite([{ input: mark180, top: 27, left: 27 }])
    .png()
    .toBuffer(),
  path.join(ROOT, 'public/apple-touch-icon.png')
);

// ── 3. OG social card from the 3D render ────────────────────────────────────
const render1200 = await sharp(SRC_3D).resize({ width: 1200 }).png().toBuffer();
await save(
  await sharp({ create: { width: 1200, height: 630, channels: 3, background: '#050505' } })
    .composite([{ input: render1200, top: 115, left: 0 }])
    .jpeg({ quality: 92 })
    .toBuffer(),
  path.join(ROOT, 'public/og-image.jpg')
);

console.log('\nAll brand assets built.');
