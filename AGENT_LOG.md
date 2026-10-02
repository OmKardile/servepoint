# ServePoint — Daily Agent Log

DAILY AGENT RUN — 2026-10-03 (IST; run window 02:37–02:50 +08)
========================
Gates before: tsc (bun run lint) PASS · dev server 200 · tree clean at 1a87398 · no test suite exists (project policy: browser QA, no test code) · `bun run build` FORBIDDEN in this sandbox (skipped per run facts, not failed)
Gates after:  tsc PASS · dev 200 · secrets grep clean (tree) · node --check 20/20 scripts
Issues found:
  1. SECURITY — Supabase pooler password hardcoded in 19 TRACKED one-shot scripts (scripts/apply-017,018,019,020,021,023,024.mjs, probe-017, qa-013-verify + 6 qa-*-e2e, seed-floor-rhythm/menu-mix/prior-demo/reports-demo) — violates the repo's own db-setup.mjs convention ("password never committed", docs/CREDENTIALS.md). Password is also already in git HISTORY (introduced ~d04ca56 era); purge would need force-push (banned).
  2. CORRECTNESS — hidden-iframe print used a blind `setTimeout(removeChild, 1500)` in 3 places; engines whose print() doesn't block (Firefox) could get the document ripped out mid-dialog → aborted/blank jobs. Same pattern in ReceiptPrint.tsx, EodScreen.tsx, FloorScreen.tsx.
Issues fixed:
  1. scripts/db-creds.mjs (new): shared env loader — SUPABASE_DB_PASSWORD, loud failure pointing at docs/CREDENTIALS.md, host/user stay as non-secret config. All 19 tracked scripts converted (one import + one line each; node --check 20/20). Functional proofs: no-env run fails loudly; probe-017 (read-only) runs live against the pooler with env creds.
  2. src/lib/printFrame.ts (new): printHiddenFrame — afterprint-driven removal + 60s no-op fallback + try/catch (thrown print() no longer leaks the frame). ReceiptPrint + EodScreen call sites swapped. FloorScreen call site DEFERRED — the parallel 15-min feature loop is actively editing that file right now (its printQrStickers gained a cafeLogo param mid-run); its file already imports printHiddenFrame, so the loop can swap its body when its logo work lands.
Issues deferred:
  - FloorScreen printQrStickers body swap → feature loop owns the file this run (note left in worklog Task 66).
  - scripts/apply-025.mjs (untracked, parallel loop's in-flight file) still carries the password inline → its author should convert to db-creds.mjs before committing.
  - Git history still contains the old password (force-push banned). If this DB ever leaves sandbox/demo status: ROTATE the password and treat history exposure as closed.
  - Parallel loop is mid-flight on 5.28.0 (track-page café brand + sticker logo): GuestPages.tsx / guest.ts / 025_track_page_brand.sql / CHANGELOG / sw.js — deliberately untouched here.
QA result: PASSED — fresh loads zero page errors; surface sweep Dashboard/Bills/Close-out/Floor/Reports clean across the IST-midnight flip (Reports today honestly ₹0.00 + "No sales in this range" at 00:00, 7d slid to include 3 Oct, Floor rhythm held peak 8p — carried watch item CLOSED); receipt print exercised through printHiddenFrame (zero errors; headless no-op print keeps the frame for the 60s fallback by design); screenshots scripts/qa66-midnight-flip-empty-today.png, scripts/qa66-daily-pass-final.png.
Commits: afd1248 — fix(scripts,print): strip committed DB credentials; print frames live past the dialog (25 files, +182/−37)
Push: pending at log-write time — executed immediately after this entry (same run).
Tomorrow's suggestion: swap FloorScreen's printQrStickers body to printHiddenFrame once the feature loop's 5.28.0 lands; convert apply-025.mjs to db-creds.mjs; check the loop's 5.28.0 CHANGELOG/sw bump shipped clean.
