# ServePoint Brand Assets

Master sources (owner-supplied, 2026-10-01) — provenance of record, do not edit:

- `src/servepoint-brand-mark.png` — flat vector-style lockup (icon + wordmark), 2172×724 RGBA,
  **pre-keyed transparent** (soft alpha edges). The "Serve" wordmark is near-black → best on
  **light** surfaces.
- `src/servepoint-logo-3d.png` — 3D-rendered lockup, 2172×724, opaque near-black background
  (#050505–#090909 gradient). The "Serve" wordmark is white → best on **dark** surfaces
  (used for the social card).

Everything else in the app's brand pipeline is **generated** — never edit derivatives by hand:

```bash
bun scripts/build-brand-assets.mjs
```

Outputs: `src/assets/brand/lockup-light.png`, `src/assets/brand/mark.png`,
`public/favicon.png`, `public/favicon-32.png`, `public/apple-touch-icon.png`,
`public/og-image.jpg`.

Usage rules of thumb:
- Light surfaces (Splash, cards on #F6F5F2) → `lockup-light.png` or `mark.png`.
- Dark teal rails (#0F3D3E) → `mark.png` inside a sage `#D9E2DD` rounded tile (the near-black
  "Serve" wordmark would vanish on teal; keep the wordmark as text).
- Favicons / iOS icon → the generated cream tiles. Social preview → `og-image.jpg`.
