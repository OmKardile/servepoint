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

DAILY AGENT RUN — 2026-10-04 (IST; run window ~03:40–04:00 +08)
========================
Gates before: tsc (bun run lint) PASS · dev server 200 · tree clean at 9e76d57 (= 5.144.0, the 15-min loop's Task 183) · no test suite exists (project policy: browser QA, no test code) · `bun run build` FORBIDDEN in this sandbox (skipped per run facts, not failed)
Gates after:  tsc PASS (run 3×: pre-commit ×2 + final) · dev 200 · tracked-tree JWT sweep clean
Issues found:
  1. SECURITY — help.md:108-113 embedded a REAL Supabase SERVICE-ROLE JWT (role=service_role, ref vbufsuzzmehsidshopku — a retired template project, not the live one) plus a stale anon JWT with the same dead ref beside the live project's URL. Violates the repo's own rule ("service_role must STILL never appear in any client-facing file") and the never-commit-secrets hard rule.
  2. SECURITY/HYGIENE — scripts/qa102.har (TRACKED, swept in by the bd0de18 snapshot commit) is a QA network capture holding an expired Supabase access token for qrowner@qrflowcafe.in (role=authenticated; exp 2026-10-03 — dead, but the file also carries owner email + user/tenant UUIDs). No refresh tokens, no passwords inside (audited).
  3. CORRECTNESS — src/components/eod/EodScreen.tsx:351-366: printZReport still hand-rolled the hidden iframe with the blind `setTimeout(removeChild, 1500)` — the v5.27.1 hardening's LAST survivor (ReceiptPrint + FloorScreen were swapped; this call site was missed). Also leaked the already-appended frame on the `if (!doc) return` early-exit.
Issues fixed:
  1. help.md env block: both literal JWTs → placeholders + policy notes pointing at src/lib/supabase.ts's embedded defaults (modern sb_publishable_ format, current ref). Old project's key rotation flagged as an owner action IF that project still exists.
  2. scripts/qa102.har untracked (file kept on disk) + `*.har` gitignored with a comment — QA captures can never be swept into git again.
  3. EodScreen printZReport → printHiddenFrame(html) (afterprint-driven removal + 60s fallback + thrown-print try/catch). src/lib/printFrame.ts is now the ONLY createElement('iframe') in src/.
Issues deferred:
  - README.md documents a stale route grammar (`/:slug/pos`, `/:slug/kds`, `/superadmin`, v2.7.x-era feature notes) that no longer matches the app (`/` + `/:slug/:screen` SECTION_SLUGS grammar, ADR-0016 login, v5.144.0 reality). BIG surface — own docs pass tomorrow; flagged with this context.
  - worklog.md line 72 carries the same dead-project anon JWT in the append-only log — left as-is (anon role, dead ref, zero real-world risk; history purge is force-push territory, banned).
  - docs/CREDENTIALS.md holds the provisioned dev/demo credential registry BY DESIGN (referenced by the app's own help; not a leak class) — noted, not touched.
  - Git HISTORY still contains the scrubbed JWTs + the old pooler password (force-push banned). If this repo ever leaves sandbox/demo status: rotate everything, treat history exposure as closed.
QA result: PASSED — fresh loads zero page errors; primary flow Dashboard → Bills (62 cards) → Dashboard clean; EOD print path exercised for real: Close-out → day stepper to Sat Oct 3 (orders exist, button honestly disabled for empty today) → Print z-report → iframe created (0→1), zero console errors (screenshots scripts/daily-qa-2026-10-04.png, scripts/daily-qa-2026-10-04-eod-print.png).
Commits: 6211785 — fix(security): scrub committed credentials (help.md JWTs + qa102.har untrack + *.har gitignore) · dc717eb — fix(eod): Z-report print joins the shared print engine (last blind removeChild retires)
Push: CONFIRMED — 9e76d57..dc717eb main -> main (clean origin push, no token needed in URL).
Tomorrow's suggestion: README route-grammar + feature-note refresh (the app is v5.144.0; README narrates a v2.8.0 world) — verify SECTION_SLUGS list in src/App.tsx as the source of truth; consider rotating the retired project's keys if it still exists anywhere.
