# Changelog

All notable changes to **ServePoint — smartPOS** (formerly TSOS — The Cafe Operating System; renamed per owner directive 2026-10-01) are recorded in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [5.31.0] — 2026-10-03 — The pass wears the crest; the rhythm speaks hour by hour

### Added — brand tile on the Kitchen Display header
- The KDS header now carries the café's logo tile (40px, hairline `#E3E7E0` border, white backing, object-contain) beside "Kitchen Display" — the same honest brand row the guest ticket has worn since 5.28, and the last major screen to get it. The real justification is multi-tenant reality: an owner running two cafés in two tabs tells them apart at a glance. **Honest guards**: no logo set → the header is exactly pre-5.31 (no tile, no placeholder); a dead URL hides its own tile via `onerror`; a logo change in Settings un-hides it (guard resets on `logo_url`). Deliberately NOT per-card — a logo on every churning ticket would be noise; one tile in the header is identity.

### Added — READY cards read from across the kitchen (styling detail)
- A quiet green wash (DS green `#2E7D32` at 5%) now tints the whole card in the **Ready to serve** column — the one stage where the food waits on the runner, not the cook. Every other stage keeps the white card; the elapsed timer and its amber/red escalation stay honest and untouched (food under the lamp ages too).

### Added — per-hour delta in the rhythm compare tooltip (parked idea, now shipped)
- In **vs prior wk** mode the Floor rhythm tooltip stops being a bare pair of numbers: a custom DS-styled tooltip (rounded-xl, hairline border, teal square + gray dashed swatch, mono tabular figures) does the subtraction itself — `12a · this 7d 2 · prior 7d 1 · +1 vs prior week · same hour` — green when ahead, red when behind, neutral gray when even. Default **This 7d** mode keeps the stock tooltip byte-for-byte. Footer now hints "Hover a bar for that hour's delta."

### Verified
- `tsc` 0 after every edit; zero page errors across Floor/Kitchen/Bills/Reports/Dashboard. E2E via the stage→verify→clean convention (`scripts/qa70-kds-fixture.mjs`, three tickets tagged `kds-fixture`: #101 ready-today + #102 completed-today + #103 prior-week, all table-bound at hour 00 IST): KDS header tile rendered with the live logo (`naturalWidth 180`), #101 showed the green wash + Unpaid chip honestly; compare mode chip `+28 vs prior 7d (+2800%) · prior 1` (29−1, exact); hovered tooltip DOM-verified with the exact delta line `+1 vs prior week · same hour` (screenshot `scripts/qa70-rhythm-hour-delta.png`, KDS record `scripts/qa70-kds-brand-ready.png`); default mode → 0 line paths, no delta tooltip; fixtures cleaned → 0 `kds-fixture`, 0 `rhy-fixture`, 0 orphan `order_items`; after the 30s safety poll the guard state honestly restored ("no prior-week tickets in the loaded ledger yet"). sw `5.31.0-r1`.

## [5.30.0] — 2026-10-03 — The ServePoint Design System (owner-commissioned)

### Added — a whole design system around the web app (`design-system/`, DS v1.0.0)
- Per the owner's directive ("I liked the whole site's UI/UX — create one whole design system around the web app; research first, separate root directory, then push"), the repo now carries **`design-system/`**: `docs/01-research.md` (industry methodology, grounded in a live web sweep: Figma docs guide, USWDS principles, Brad Frost, W3C DTCG token format), `docs/02-audit.md` (the app's real design language extracted by **code census** — top-30 hex counts, type/radius/shadow/icon/motion/a11y censuses, the status semantic table), `docs/03–05` (foundations, component specs, the eleven normative UX patterns — honesty family, arm→confirm, IST math, print honesty…), `docs/06-governance.md` (add-don't-rename, evidence-based tokens, semver).
- **Tokens**: `tokens/servepoint.tokens.json` — 3-tier (primitive → semantic → component), 31 internal references all validated; `tokens/servepoint.css` — the drop-in build (mirrors the app's ADR-0012 `:root` block + canonical `sp-*` utilities).
- **Living showcase**: `showcase/index.html` — the style guide that renders the system (palette with census ranks, ink ramp, status chips, type specimens, geometry/elevation, live component specimens incl. a working arm→confirm demo). Browser-verified in agent-browser, zero console errors.
- **No runtime change**: the app shell, routes, sw (`servepoint-v5.29.0-r1`) and every component are untouched — this release ships a repo-level design artifact, versioned independently as DS 1.0.0.

## [5.29.0] — 2026-10-03 — The paper carries the face; the rhythm learns hindsight

### Added — logo on the customer receipt (Bills → Print receipt)
- The thermal 80mm receipt header now prints the owner-set logo (migration 024's `logo_url`) as a centered tile (max 44px tall, object-contain — any logo shape fits) above the store name. Absent/NULL logo renders the receipt **byte-identical to pre-5.29**: no tile, no placeholder. A dead URL hides its own tile at print time via `onerror` — never a broken-image glyph, never a hole.
- **Print-timing honesty**, now a shared primitive: `preloadPrintImage()` moves into `lib/printFrame.ts` next to the print engine it serves (FloorScreen's local `preloadLogo` retired — one helper, one job). BillsScreen warms the remote logo BEFORE the hidden iframe prints (2.5s timeout, non-fatal), because `print()` does not wait for cold images. With this, the brand rides every artifact end to end: guest menu hero (5.27.0) → printed sticker sheet + guest ticket (5.28.0) → the paper receipt that closes the loop (5.29.0).

### Added — Floor rhythm "vs prior wk" compare (the board learns hindsight)
- The Floor rhythm card grows a two-mode segmented toggle: **This 7d** (the pre-5.29 view, byte-for-byte default) and **vs prior wk** — which aggregates the **prior 7 IST days** from the same in-memory orders ledger (no extra fetch) and lays them under this week's bars as a gray dashed `Line` with honest dots: same hour-of-day shape, same rules (non-cancelled, table-bound only). Tooltip labels both series (`Seated · this 7d` / `Seated · prior 7d`); the legend hint ("gray dashed = prior 7d") appears only when there's something to see.
- The "Seated rounds · 7d" KPI gains a compare-mode delta chip: `+31 vs prior 7d (+1550%) · prior 2` — green when up, red when down, computed from stored facts only. **Honest guards**: zero prior-week tickets → no fake baseline line, the chip reads "no prior-week tickets in the loaded ledger yet", and the footer explains the comparison unlocks as the ledger ages (a young cafe sees truth, not a flat gray lie).

### Verified
- `tsc` 0 after every edit; E2E on real data (this ledger: 33 table tickets this 7d vs 2 in the prior window) — toggle renders the gray dashed overlay at the right hours, tooltip shows both series, delta chip arithmetic matches the SQL probe (`scripts/probe-026-day-spread.mjs`), default "This 7d" view visually identical to pre-5.29; receipt print click clean through the shared preloader. Zero page errors. sw `5.29.0-r1`.

## [5.28.0] — 2026-10-03 — The brand travels: logo on the printed sticker sheet and the guest's ticket

### Added — sticker sheet carries the café's face (Floor → Print stickers)
- The A4 cut-line sticker sheet (`buildStickerSheetHtml`) now prints the owner-set logo (migration 024's `logo_url`) **twice**: a 42px head tile above the sheet title, and a 30px tile on **every sticker card** — the card is what guests see on the table, so the brand travels with the QR. Absent/NULL logo renders the sheet byte-identical to pre-5.28 (no tile, no placeholder — the builder's 2-arg call signature still works for E2E assertions).
- **Print-timing honesty**: `print()` does not wait for remote images, so a cold logo could lose the race and print a blank tile. `preloadLogo()` warms the URL in the HTTP cache before the iframe prints (2.5s timeout, non-fatal), and every printed `<img>` carries its own `onerror` self-hide — a dead or half-warmed URL can never render a broken glyph, it just prints the pre-5.28 sheet.

### Added — the ticket says whose ticket it is (migration 025)
- `sp_get_public_order` replaced (same signature, SECURITY DEFINER + `search_path=public` preserved, replace-in-place keeps 012's anon EXECUTE) to join the order's tenant and return a sibling `tenant` payload `{name, logo_url}` next to `order`. Applied via `scripts/apply-025.mjs` with 5 SQL proofs: tenant payload shape + order keys intact / join correctness against the live ledger / NOT_FOUND leaks no tenant / anon EXECUTE survived / exactly 1 signature, SECURITY DEFINER.
- The guest `/track/:orderId` header now opens with a compact brand row — the café's **name** on every ticket, plus a 36px logo tile (white backing, object-contain, onError self-hide) when the owner set one. No brand in the payload → exactly the pre-5.28 header. The ticket page previously showed no café identity at all; even a logo-less café now signs its tickets.

### Verified
- Midnight-flip honesty sweep (00:00 IST Oct 3, the carried watch item): Reports **Today** honestly zeroed to ₹0.00 across all chips with the "No sales in this range" empty state the instant the calendar rolled; 7d window slid to include 3 Oct in Day-by-day (best day still 2 Oct, ₹5,046.30); Floor rhythm 7d held peak 8p (8 tickets) with Oct 2 still in range — all honest recomputes, zero page errors across Dashboard/Floor/Reports/KDS/Bills/Close-out.
- Sticker builder E2E: 2-arg call → no logo markup; 3-arg with logo → head tile + one `cardlogo` per card; QR Flow Cafe order's `/track/` page renders the brand row (name + logo tile, real pixels) while a CheeseBurg order (no logo set) renders the name-only header honestly. `tsc` 0; sw `5.28.0-r1`.

## [5.27.0] — 2026-10-03 — The café's own face: tenant logo on the guest menu

### Added — Settings → Café brand (owner-only, migration 024)
- A new **Café brand** section (Profile-adjacent, visible only to tenant owners — superadmins run the platform, staff run tickets) lets the owner paste a **publicly reachable logo URL**. Live preview tile beside the café name with three honest states: "No logo yet — the guest menu shows the café name only", "Live on the guest menu's header tile", and "That URL doesn't render — …" when the preview's own onError fires. The Save is **async-aware**: the gold "Saved" chip appears only after the RLS write actually held; an RLS refusal surfaces as an inline error instead of pretending. One-tap **Remove logo** returns to the honest text-only hero. Field validation demands a full `http(s)://…` URL with an inline red explanation.
- Gate fix found in E2E: registry-provisioned owner sessions (the QR one-click login) carry `tenantSlug` but no `tenantId` — the section gate now accepts either and lets `useTenant()` resolve the id from the slug.

### Added — the guest sees it (migration 024)
- `tenants.logo_url text` (nullable) + `sp_get_public_menu` replaced to carry `logo_url` in its tenant payload — same body as 016's otherwise, SECURITY DEFINER + `search_path=public` preserved, verified column/RPC/RLS/write-path/revert (5 SQL proofs). The write path rides the existing "Tenant owner update access on own tenant" RLS policy — no policy change.
- The guest menu hero renders the logo as a 56px rounded tile (white backing, object-contain — any logo shape fits) above the TABLESIDE MENU eyebrow. **Honest fallback**: a URL that fails to load hides its own tile via onError (never a broken-image glyph) and the pre-5.27 text-only hero stands unchanged; NULL renders exactly that hero too.

### Verified
- E2E, zero page errors (fresh-load console + page-error buffers both clean): Settings → Café brand appears for the owner and not for platform/staff gates; URL pasted → live preview rendered → Save → "Saved" chip + status line + DB row set; guest menu header img loaded (naturalWidth 180, real pixels); dead URL (`example.invalid`) → Settings preview honestly says "doesn't render", guest menu hides the tile and keeps the café name; Remove/restore round-trips through the UI; `tsc` 0; sw `5.27.0-r1`. Demo value left on QR Flow Cafe (the app's own apple-touch-icon URL) so the guest menu demos the feature — replaceable by the owner at will.

## [5.26.0] — 2026-10-03 — One scan, one window; a ledger that answers back

### Fixed — the guest gate was minting phantom windows (latent bug, caught live)
- **The bug**: every visit to the guest gate (`/t/{token}`) created **two** `table_sessions` — rows landing 2–12 ms apart (in the trail: 15:03 ×2, 15:19 ×2, 18:00 ×2; every pre-fix scan doubled). The gate's `run()` callback is recreated whenever the language context's `t` identity churns (and again under StrictMode remount), and its effect re-fired the `issue_ephemeral_table_session` RPC with no guard — one scan, two windows, an inflated trail and a phantom "leak" the floor never caused.
- **The fix (one scan, one window)**: `openTableSession` keeps a module-level in-flight promise per qrToken — a second concurrent call rides the first's RPC instead of issuing its own; the entry is removed the moment the RPC settles, so a later re-scan still opens a genuinely fresh window. Verified live: the post-fix gate visit minted exactly **one** row (`f93f7a2e…`) and redirected clean.

### Added — Floor: cut all live windows in one tap (the leaked-QR scenario)
- A photo of a table's sticker can be many phones. When a table's drill panel shows **two or more clock-live windows**, a red "Cut all live" band appears with the honest count ("3 live windows open — one photo of this sticker could be many phones"), the same two-step arm→confirm grammar as the row cut (arm flips the button to "Cut N live?" for 3 s), one `Promise.allSettled` revoke across every live id so one failed write can't strand the rest, honest partial-failure copy ("N of M cuts failed — the list shows what actually held"), and the board resync as truth. With exactly one live window the band stays hidden — the row's own cut is the honest tool for that case.

### Added — Bills: search that matches what the card prints (WYSIWYG hay)
- **The bug (found by the parked Task-63 eyeball)**: the search hay held the bare table number ("T2"), but every card prints "Table T2" — typing the literal string on screen matched nothing (verified live: "96" → 1 hit, "T2" → hits, "Table T2" → zero).
- **The fix**: the hay is now the row's own visible subline (`rowSubline(o)` — "Table T2 · 2 guests", "Takeaway · Meera") plus order number and customer name, case-insensitive. While searching, a match-count legibility line (aria-live polite) says plainly how much of the ledger the term captured — "**12** of 35 bills match 'Table T2'" — with a count badge and a one-tap clear button.

### Verified
- E2E, zero page errors: Bills "Table T2" → 12 of 35 hits (was 0), "table t2" identical, count line + clear behave; Floor drill at 3 live windows → arm → confirm → all three sessions `revoked` in SQL, no error banner, rows re-label honestly; at 1 live window the bulk band stays hidden; post-fix gate scan mints exactly ONE session ("menu open" in the trail); `tsc` 0; sw `5.26.0-r1`.

## [5.25.0] — 2026-10-03 — Legibility passes: the runner sees WHERE, the owner sees the shape

### Fixed — the table was invisible everywhere it mattered (latent bug, found by audit)
- **The bug**: the `orders` table has NO `table_label` column — only the `table_id` FK — yet Bills read `order.table_label` for its "Table" detail row and search hay. Result: the Table detail showed **'—' for every order, ever**, and Bills search could never match a table. Meanwhile the KDS showed table identity only when it happened to leak into free-text notes ("via QR · Table T1") — a runner staring at the rail had no idea where food goes.
- **The fix (derived, never stored)**: `fetchOrders` now embeds `dining_tables(table_number)` in the SAME PostgREST read (orders.table_id → dining_tables FK) and maps it to `table_label` in memory — one fetch, no second roundtrip, the ledger stays the only truth. Bills' existing code wakes up as-is; the KDS grows a solid teal **TABLE chip** (Armchair icon) on every table-bound card, honestly absent for takeaway/unbound tickets (#48 stays chip-less because #48 is genuinely unbound — verified in SQL).

### Added — Reports: the day-shape behind every headline chip
- Hover (or keyboard-focus) any of the six headline KPI chips and a **per-day sparkline** fades in — this metric's own IST-day series for the range, drawn as a pure-SVG polyline (92×24, no chart dependency) with an end-dot and a dotted zero baseline. Colors follow each chip's tone; the series reuses the Day-by-day bucketing extended with gst/net/items (same semantics as `aggregateTickets` — gross = Σ total, gst = Σ tax, net = Σ subtotal − discounts, items = Σ qty, avg = gross/tickets).
- **Honest guards**: one point draws nothing (Today's chip says it elsewhere: "one day can't show a shape"); an all-zero series draws the dotted flat line AS a flat line, never a fake trend; the reveal is React-state driven (mouse + focus) after CSS `group-hover` variants proved unreliable in this build — deterministic on every browser.

### Verified
- E2E, zero page errors: KDS #66 renders the **T1 chip** (and #48 correctly none); Bills list cards read "Table T2"/"Table T1" and #96's detail drawer shows Table **T2** where '—' lived since the beginning; Reports 7d hover reveals the Gross sparkline (shape mirrors the Day-by-day bars, spike at 2 Oct), keyboard focus reveals Avg ticket's, Today renders NO sparkline (single-point guard); the `table_label` embed broke nothing downstream — Floor (rhythm + scan chips), Dashboard, Bills all render clean; `tsc` 0; sw `5.25.0-r1`.

## [5.24.0] — 2026-10-03 — The staff cut: a session you can end, and a guest's phone that listens

### Added — Migration 023: the ephemeral session finally gates something
- **The gap found while building the revoke button**: `sp_create_public_order` never validated the table session at all — the 10-minute ephemeral token was issued, displayed, and tracked, but ordering only ever needed the printed QR. A staff "cut" would have been theater. Migration 023 (`023_session_gate_staff_cut.sql`) closes the loop **additively, without breaking 012's "separate capabilities" design**: `sp_create_public_order` grows an OPTIONAL `p_session_token` (DEFAULT NULL) — when a token IS presented it must be alive (status='active', matching table, unexpired clock), else the RPC returns `SESSION_CLOSED` with a `reason` (`unknown` / `table_mismatch` / `revoked` / `expired` / `consumed`); NULL proceeds byte-for-byte as 017/022 did, so the printed QR remains the table's ordering capability. A presented-and-alive token gets its `last_activity_at` bumped — the order itself becomes the strongest activity signal the trail can show. Old overloads dropped, one 9-arg overload remains, grants unchanged (anon + authenticated), hard-failure verification block asserts all of it.
- **`sp_verify_table_session(token)`** — tiny SECURITY DEFINER read (anon-granted; 002's RLS hides `table_sessions` from anon) for the guest's phone to re-verify its own window. Returns `{is_valid, reason, remaining_seconds}`; converges the stored status to 'expired' on natural expiry (the same hygiene 002's own verify RPC has always had).

### Added — Floor: the CUT button on live session rows
- Live rows in the drill's Guest sessions block carry a **two-step cut control** (scissors ghost chip → red "Cut?" pill, 3s disarm, spinner while in flight). The write is `revokeTableSession()` — RLS-scoped ("Tenant staff manage sessions", migration 002), so a tenant can only ever cut its own rows. Optimistic flip shows the red **"cut"** skin instantly; the board resyncs behind it. The block's caption now states the honest scope: **a cut ends the window, not the table** — the guest's menu locks and the token dies for orders, while the printed sticker's QR reopens a fresh one.

### Added — Guest: the phone actually listens
- The guest menu now **re-verifies its own session every 30s** (server truth, not the client clock — a network hiccup never locks a paying guest). On a cut, the page locks within one tick into a distinct tone: red Ban ring, serif **"Ordering closed"**, "This session was closed by the cafe. Please speak to our staff, or scan the table QR to start over." — the natural-expiry lock keeps its amber clock tone ("Your 10-minute table session ended…"). The lock **freezes the cart too**: add-to-cart gates on phase, the customizer's Add button disables, the cart bar and drawer unmount, and the cached session token is dropped so a rescan re-issues a FRESH window instead of silently reusing the dead one. `SESSION_CLOSED` at submit time (cut mid-checkout) locks without any silent retry — the cut must hold.
- The countdown ribbon learns an honest zero state: at 0:00 it flips to a gray "Window ended — scan the table QR to continue" instead of ticking at 00:00 in the warm style.

### Verified
- Apply proofs (no order rows written): `sp_verify_table_session('garbage')` → `{is_valid:false, reason:'unknown'}` via SQL **and** REST/anon; presented dead token → `SESSION_CLOSED` before any pricing; NULL token → proceeds to `EMPTY_ORDER` exactly as before; order count unchanged.
- Full-loop E2E through the real guest QR page, zero page errors: fresh session minted (22:53 IST) → floor drill showed it "menu open" with a Cut button → two-step cut → DB row `revoked` and the **first organic 'cut' row in ledger history** rendered (the 5.23.0 watch item closes) → guest page poll-locked ≤30s into the red cut tone (screenshot `qa62-guest-locked.png`) → Reopen re-issued a fresh session (cache was dropped) → a real **order #96** (Flat White ₹231.00, dine-in T2) placed WITH the presented token — the gate's success path — landing in the counter inbox (Bills Active; correctly absent from the KDS rail per the v5.3.0 counter-gate) → session `last_activity_at` bumped by the order → T2 card census honest ("7 scans" incl. the dev-mode StrictMode double-mints) → Close-out rescaled exactly (gross ₹5,046.30, section base ₹4,950, Coffee ₹4,510). `tsc` 0; sw `5.24.0-r1`.

## [5.23.0] — 2026-10-03 — The floor sees the guest's phone (QR session trail on every table)

### Added — Floor: guest session trail (who scanned, when it expires)
- **The gap**: the guest QR loop's counter half was blind — staff handed guests a table QR but could never see who had actually scanned, whether a menu was open right now, or when a session would die. Migration 002's ephemeral 10-minute `table_sessions` have been landing in the ledger since day one (33 rows on T1 alone) with zero UI. Now: every floor card grows a **"N scans"** chip (Smartphone icon, only when >0 — no fake zeros), and the drill panel gains a **Guest sessions** block: the six most recent sessions with their IST open→expiry windows ("22:28 → 22:38"), a relative clock ("10m left" while live, "1h 28m ago" once past), "+N earlier scans on record" overflow, and an honest empty state for never-scanned tables.
- **The clock, not the column**: the DB's `status` stays 'active' after ordinary expiry (only revoke/consume paths write it back — verified against all 33 live rows: every one is status='active', `expires_at` past). The UI therefore DERIVES liveness from `expires_at` vs now and labels the four states honestly: live = "menu open" (teal, pulsing), expired = gray, consumed = "used" (green), revoked = "cut" (red). The block's caption states the rule so nobody trusts the stored column.
- **Data path**: `fetchTableSessions()` (api.ts, most-recent 60 for the tenant, grouped client-side by table). The trail rides the floor's existing refresh cycle (reload + realtime ping + 30s poll) and loads **FAIL-SOFT** — a session-read hiccup can never take the board down, and a stale trail beats a blank one. No migration, no new realtime socket: it's a census that updates with the floor.

### Verified
- Full-loop E2E on real data: T1 card "33 scans" chip; T1 drill lists 6 rows + "+27 earlier scans on record" (6+27=33), all clock-derived "expired" with honest ago-times while the DB still says active — the derivation proven live. T2 (never scanned) showed the empty state; then the actual guest page was opened via T2's QR (`/t/c3b03…`), minting 2 fresh sessions — the floor's poll cycle updated the OPEN drill and the T2 card chip to "2 scans · menu open · 22:28 → 22:38 · 10m left" without any manual reload. Kannada-locale guest page renders its own session ribbon ("order ends 9:54"); zero page errors on guest and staff tabs; `tsc` 0; sw `5.23.0-r1`.

## [5.22.0] — 2026-10-03 — The floor learns its rhythm (per-hour seat demand on the board)

### Added — Floor: FLOOR RHYTHM strip (table tickets per IST hour, last 7 days)
- **The gap**: the floor cockpit showed the seats' state right NOW (x/x busy) but never answered the planning question behind it — "when does the floor actually fill?" Parked since Task 56, the hourly capacity heatmap ships: a **Floor rhythm** card on the board with all 24 IST hours drawn as bars (teal, peak gold — the same visual language as Reports' Sales-by-hour), a three-chip stat row (**Seated rounds · 7d**, **Peak hour**, **Busiest day**), and a caption that states exactly what a bar is.
- **Honest derivation, no new fetch**: the strip derives from the SAME orders array the board already loads (rides `reload()` + the realtime/poll cycle — no parallel API path to drift). Only **table-bound, non-cancelled** tickets count: a walk-in counter ticket holds no table, so it stays out of the floor's rhythm; a round is a ticket, not a headcount (the ledger has no guests column — the caption says so instead of faking seats). Hour bucketing mirrors Reports' IST math line-for-line (`Asia/Kolkata`, 7 calendar IST days).
- **Honest empties**: zero table-bound tickets in the window renders a real empty state ("Seat a table from this board — the rhythm builds itself as rounds land") — never a flat line pretending to be data.
- **Demo seed for the curve** (`scripts/seed-floor-rhythm.mjs`, idempotent via `demo:floor-rhythm` marker, 5/5 self-verifying): 21 marked table-bound dine-in tickets across Sep 27–30 + Oct 2 shaped like a real cafe day (8a×1 9a×2 11a×1 12p×2 1p×3 2p×1 4p×2 5p×1 7p×3 8p×4 9p×1). **Oct 1 deliberately left empty** — it is the prior-day window behind Reports' today chips, which must keep honestly reading "new". Trigger safety proven, not assumed: migration-011's release branch (`active_order_id = NEW.id`) matches zero rows on these inserts, verified before/after — live T1/T2 state untouched.

### Verified
- E2E on real data: strip shows peak **8p · 8 tickets** (4 seeded + 4 live rounds that evening), 26 seated rounds in 7 days, busiest day 2 Oct; hour bars match the seed's SQL verify (5/5 PASS); tooltips read "N tickets"; T1/T2 still occupied with their real active orders after seeding; Reports windows recomputed around the seeds with today's chips still "new" (Oct 1 untouched); `tsc` 0; zero page errors; sw `5.22.0-r1`.

## [5.21.0] — 2026-10-03 — The Z-report learns its sections (per-category subtotals + a real menu to sell)

### Added — Close-out: SECTION MIX, on screen and on the printed z-report
- **The gap**: the Z-report reconciled by payment method but never by what actually sold — an owner closing the day asks "how much of today was Coffee vs Bakery vs Food?" and had no answer. Parked since Task 56, the oldest idea on the board finally ships: a **Section mix** block on Close-out (per-menu-category item totals with units, share bars in the payment-mix visual language, and the ex-GST base stated) mirrored byte-for-byte as a **SECTIONS · EX-GST ITEM BASE** block on the printed z-report, right after PAYMENTS.
- **Data path**: `fetchDaySections()` (api.ts) reads the day's `order_items` nested-joined through `menu_items → categories`, bounded to the day's ticket ids. Lines whose menu row vanished (or guest-added lines with no menu item) bucket honestly under **"Unlisted"** instead of silently vanishing; cancelled tickets are excluded; the load is FAIL-SOFT — a join hiccup can never take the day's money view down.
- **Honest base**: sections sum the ex-GST item base (₹2,750 today) — the block's caption says exactly what sits on top: GST (₹130.30) and order-level discounts (₹144 across #48/#55/#67) are not re-apportioned per item. No fake reconciliation to the gross.

### Added — the live cafe sells more than one thing (marked demo config + day orders)
- **The provisioning gap**: the live menu was exactly ONE item (Flat White) under ONE category — every "mix" would have been a trivial 100%. `scripts/seed-menu-mix.mjs` (idempotent, 5/5 self-verifying) adds the **Bakery** and **Food** categories, three ingredients (Flour ₹0.30/g, Butter ₹0.50/g, Cheese ₹1.20/g), two recipe-priced menu items (**Blueberry Muffin** ₹180 — 80g flour + 20g butter = ₹34 COGS; **Veg Grilled Sandwich** ₹260 — 60g cheese + 10g butter = ₹77 COGS), and two completed day tickets (#73 08:40 UPI, #74 13:15 cash) so COGS & margin keep reconciling everywhere.

### Verified
- E2E on real data: screen shows Coffee 9u ₹2,310 (84%) / Food 1u ₹260 (9%) / Bakery 1u ₹180 (7%); the printed z-report (captured from the live print iframe) carries the identical SECTIONS block; base math reconciles (2,750 item base = 2,736.30 gross − 130.30 GST + 144 discounts); seed verify 5/5 (incl. v_order_cogs ₹34/₹77); Menu + Food & Drinks screens show the new categories/items with zero page errors; `tsc` 0; sw `5.21.0-r1`.

## [5.20.0] — 2026-10-03 — The report learns what "better" means (vs-prior-range delta chips on every headline KPI)

### Added — Reports: comparison chips that answer "better than when?"
- **The gap**: the headline strip stated figures in isolation — ₹2,967.30 sounds great until you ask "compared to when?". Twice designed and twice parked (helpers committed unused since `a7a4c34`), the "vs previous range" comparison finally ships: every headline KPI (Gross sales, GST collected, Net ex-GST, Orders, Avg ticket, Items sold) now carries a **delta chip** against the same KPI recomputed over the **equal-length window immediately before the selected range** — prior day / prior 7 days / prior 30 days, IST-exact like every window in the app.
- **One aggregation body, zero drift**: the money-view loop was extracted into `aggregateTickets()` — the headline `agg` and the new `priorAgg` memo share the exact same body, so a chip's percentage can never drift from the headline figure it annotates (cancelled excluded, margin on paid tickets only, all of it preserved byte-for-byte).
- **Honest states, in the app's health vocabulary**: up = green with a trending-up icon, down = red, flat = gray `±0%` (<0.05% band), and an empty prior window chips an honest teal **"new"** instead of a fake "+∞%". Both windows empty → no chip at all. **All time has no earlier boundary** — it gets NO chips plus a one-line explanation under the strip, never a fabricated baseline. The exact money always rides the chip's tooltip + aria label ("₹2,967.30 vs ₹693.00 (prior 7 days)") — a percentage never hides the figures it came from.
- **Demo seed for the math** (`scripts/seed-prior-demo.mjs`, idempotent via `demo:prior-seed` marker, 5/5 self-verifying): three marked Flat-White tickets planted in the prior windows (Sep 22 ₹231 UPI, Sep 24 ₹462 cash → prior-7d = ₹693 · 2 orders · 3 items; Sep 1 ₹693 UPI → prior-30d = ₹693 · 1 order · 3 items) so the percent path renders on real, hand-checkable data. Today reads "new" across the strip (Oct 1 empty by construction) — both chip states live at once.

### Verified
- Window math cross-checked three ways: seed script SQL sums (5/5 PASS), chip arithmetic hand-checked (7d gross (2,967.30−693)/693 = +328.2% → "328%", avg ticket 370.91 vs 346.50 = +7.0%; 30d (3,660.30−693)/693 = +428%, orders 10 vs 1 = +900%, items 15 vs 3 = +400% — the Sep 22/24 seeds correctly fall inside current-30d but outside current-7d), and All time shows no chips + the hint line. `tsc` 0; zero page errors across Dashboard / Reports / Floor / Bills / KDS / Close-out; sw `5.20.0-r1`.
- Untested paths stated honestly: the red "down" and gray "±0%" chip skins are code-symmetric to the verified green/new skins — no window pair in the live ledger currently produces them (no data was bent for QA).

## [5.19.0] — 2026-10-02 — The official brand arrives (Figma ServePoint-Brand logos ship everywhere)

### Added — real brand identity from the owner's Figma file
- **The gap**: every brand surface shipped placeholder-era art (a generic mark in the sidebar chips, an old 3D render on /showcase, stock favicon squares). The owner delivered the official brand file — Figma "ServePoint Brand" — and asked for the suitable marks to replace ServePoint branding.
- **Asset extraction** (`scripts/brand-extract.py`, repeatable): the public Figma canvas was screenshotted at 100% zoom (band-scanned for exact tile boundaries — the captures are 1920×1080, cream `#F6F1E9` / tile-black `#0C0C0C`), then the **geometric mark** (black rounded triangle + orange disc + glass + peach pill with its warm glow) and the **minimalist "ServePoint" wordmark** were keyed off the cream background with a distance-based alpha ramp into clean transparent PNGs; the Figma toolbar remnant baked into the capture was erased before keying. White-composited checks verify every cut visually.
- **Shipped everywhere the old brand lived**: sidebar / Platform / Showcase / IndexHelp chips now hold the real mark on the brand's own cream (`#D9E2DD` → `#F6F1E9` — the glow blends into it); the app **splash** now shows the official horizontal wordmark; **favicon 32/128 + apple-touch-icon + PWA icon-192/512/maskable-512** regenerated from the mark on cream (maskable keeps the 62% safe zone); **og-image** is the dual-tone SERVE POINT lockup on black; and the /showcase **hero** swaps the old 3D render for the official dual-tone lockup (`hero-lockup.jpg`).

### Governance
- **ADR-0016 respected**: the frozen login screen is untouched (visuals AND structure) — its existing brand stays as-is until the owner unfreezes it. `admin@tsos.dev` credentials, RLS function names, Render service name and historical records remain out of scope per the established exclusions.

### Verified
- Browser E2E: sidebar renders the new mark on the cream chip (orange pops against the teal rail), /showcase header + hero show the mark and the dual-tone lockup, /index-help header clean, all seven icon/og assets serve `200` with correct content types, `tsc` 0, sw `5.19.0-r1`. Guest QR + Dashboard regression-clean. One transient cloud hiccup observed during QA (a single PostgREST "None of these media types are available" on tenant resolve) — auto-recovered on remount, not reproducible, unrelated to asset-only changes; logged for the next round to watch.
- **Reconciliation note (second pass)**: a parallel extraction ran concurrently and briefly overwrote the committed binaries; the d12a982 set was restored wholesale (`git checkout d12a982 -- <assets>`) — the treatment above is canonical and unchanged. The "transient" PostgREST error was root-caused: a custom `Accept` header set on the shared agent-browser session during the Figma capture poisoned subsequent Supabase REST calls (406) — a QA-harness artifact, NOT a product bug; session headers were reset.

## [5.18.0] — 2026-10-02 — The counter seats and starts in one tap (Floor → POS tap-through + the silent-table-carryover fix)

### Fixed — a placed ticket no longer chains the next one onto a seated table
- **The gap**: `useCart.clear()` reset lines/offer/customer fields but left `tableId`, `tableLabel` and `guestCount` untouched — so the ticket AFTER a dine-in placement opened **still pre-linked to the same table**, silently. The dropdown's occupied-guard (`disabled` unless the occupied table IS the cart's table) made the chained table selectable again, meaning a walk-in could quietly land on a table that was already seated. "Another round" is a deliberate act, not a leftover.
- **The fix**: `clear()` now releases the full seating context — `tableId: null`, `tableLabel: ''`, `guestCount: 2`. Verified live: placed #68 on T2 → the very next drawer reads **"Walk-in / unassigned"**.

### Added — Floor drill gains the seat-and-start tap-through
- **Available tables**: the drill footer now leads with **"Seat & start ticket here (T2)"** — a full-width teal CTA that pre-links the cart (dine-in, real table FK, label, guest count prefilled from the table's capacity), closes the drill, and lands on Food & Drinks with the ticket already seated. One tap from "empty table" to "taking the order".
- **Reserved tables**: same action in gold — **"Seat reserved guests — start ticket on T…"** — because seating the reservation and opening their ticket is one gesture, not two.
- **Occupied/billing tables**: a secondary outline action **"Start another round on Table T…"** sits under *Open Bills to settle* — the re-order gesture, pointed at the right table by construction. The cart's existing lines ride along (the ticket IS the cart); the strip below announces the new binding.
- **POS pre-link strip** (`TablePrelinkStrip`, Food & Drinks): while `cart.tableId` is bound, a teal band under the Counter inbox states **"Ticket seated at T2 · 2 guests — guests can also scan the table's own QR"** with a one-tap **Unassign**. A cart is never silently seated; the binding is visible the whole time it lives and vanishes the moment it's gone.

### STYLE MANDATE
- Seat CTA: full-width rounded-full `h-12`, bold white on tenant-teal (`#0F3D3E`) / gold for reserved, `hover:opacity-90` + `active:scale-[0.98]`, gold focus-visible ring; another-round button mirrors the drill's outline-pill language (hover gold border + warm `#FBF7EC` fill). Strip: `#EAF4F0` teal tint with `#CFE3DC` border, white round icon chip with the Armchair glyph, tabular-nums guest count, white-hover Unassign pill. All new controls keyboard-reachable with gold focus-visible outlines.

### Verified
- Browser E2E on real data, ZERO page errors: Floor → T2 available drill shows the seat CTA → tap → POS opens with the teal strip ("Unassign table T2") and the drawer preselects **"Table T2 · Patio · 2 seats", Guests 2** → Flat White added → placed → counter gate holds **Ticket 68 "Table: T2 · Guests: 2"** → T2 flips OCCUPIED live (011 trigger; floor reads "6/6 seats busy") → **next drawer honestly reads "Walk-in / unassigned"** (carryover fix proven). T1 occupied drill shows Open Bills + "Start another round on Table T1" → tap → strip rebinds → placed → **Ticket 69 "Table: T1 · Guests: 4"**. Unassign tap clears the strip (`role=status` gone). DB truth: orders 68/69 `dine_in` with table FK set and the exact context notes; T1+T2 `occupied`. Seat CTA correctly yields to the live footer once a table is occupied. Guest QR menu regression-clean (KN persisted, session ribbon, cart bar ₹283.50). tsc 0. `sw.js` `5.18.0-r1`.

## [5.17.0] — 2026-10-02 — The floor becomes the counter's table cockpit (+ THE OFFERLESS-ORDER CRASH FIX)

### Fixed — migration 022: guest QR checkout crashed without an offer (CRITICAL)
- **The gap**: Task 55's browser E2E of the Floor drill exposed `sp_create_public_order` dying with `record "v_offer" is not assigned yet` on EVERY guest order that did NOT attach an offer — since migration 017, the most common customer flow in the whole product had been broken server-side. Root cause: 017's final RETURN read `v_offer.title` behind a `CASE WHEN v_discount > 0` — but PL/pgSQL resolves record fields **eagerly** while building the statement's parameter list, so even a branch the CASE never takes explodes when the record was never assigned (`p_offer_id IS NULL` skips the entire offer block). The CASE guard was a lie about evaluation order.
- **The fix** (022, `supabase/migrations/022_public_order_offer_fix.sql`): the offer title now rides out in a plain `v_offer_title TEXT` variable — assigned only inside the validated offer block, NULL-safe everywhere else; body otherwise byte-identical to 017, same 8-param signature, same single overload, anon EXECUTE grant re-asserted. Its DO-block verifies: exactly one overload, `p_offer_id` present, **the eager `THEN v_offer.title` reference GONE from prosrc**, `v_offer_title` present, anon grant intact. `db-setup.mjs` carries the 022 sentinel (prosrc-based) so fresh provisionings get the fixed body.
- **Proven live on real data, both paths**: offerless order #66 (2× Large Flat White + Extra shot, ₹693, `offer_title: null`, no crash — T1 auto-held via the 011 trigger) AND offer order #67 (2× Flat White, Morning flat white 10% → subtotal ₹440 − discount ₹44, GST ₹19.80, total ₹415.80, offer_title carried). Replay of the exact pre-fix crash call now returns `is_valid: true`.

### Added — Floor: tap a table, see its truth
- **Drill panel** — every table card is now a button (`role=button`, keyboard Enter/Space). Occupied/billing tables open the **live order**: item lines with ×qty and variant/addon/notes sub-lines, the ticket's stored subtotal → green discount row (when attached) → GST → **Total**, a payment chip (green `PAID · UPI` / amber `Payment due`), status pill, and elapsed-since-placed in the header. An occupied table whose live order isn't on the board (QA-orphaned `active_order_id`, out-of-window order) says so honestly and points to Bills. Available/reserved tables open the **QR panel**: big scannable QR (locally generated by the new `qrcode` dep, tenant-teal on white, spinner while rendering), full guest URL, copy link / copy token with Copied! feedback, and a footer hint pointing at Print stickers. Live panels carry an **Open Bills to settle** jump (`goSection('bills')`). Escape closes; backdrop click closes; 300ms slide + fade.
- **Print QR stickers** — header action renders EVERY table's QR into one A4 cut-line sheet: sticker per table (dashed gold cut border, cafe name, table number, section, 46mm QR, "Scan → see the menu → order from your table", fallback URL), printed through the same hidden-iframe engine as the 5.11.0 receipt. `buildStickerSheetHtml` is a pure exported builder (E2E-assertable); busy spinner on the button; honest error banner if QR rendering fails.
- **Status filter tiles** — the four stat tiles are now `aria-pressed` toggle buttons: tap AVAILABLE/OCCUPIED/RESERVED/BILLING to filter the board to that status (gold ring on the active tile, "Showing N of M tables · … only" line with a Show-everything reset, honest "Nothing … right now" empty state with the self-refreshing promise when a status has zero tables).

### STYLE MANDATE
- Table cards gain a **4px status accent bar** on the left edge (green/amber/teal/red — the board reads at a glance from across the counter), hover lift (`-translate-y-0.5` + deeper shadow, 200ms), occupied cards show a **live elapsed chip** (clock + `TimeAgo`, 30s heartbeat) beside the seat count; filter tiles hover-lift with focus-visible gold outlines; drill panel rides the shell's warm `#F6F5F2` with white cards, dashed item separators, tabular-nums money everywhere.

### Verified
- Browser E2E on real data, ZERO page errors throughout: placed a real guest QR order on T1 via the public RPC → floor card shows #67 · Arjun N · ₹415.80 with elapsed chip → drill shows Flat White ×2 ₹440.00, Discount −₹44.00, GST ₹19.80, Total ₹415.80 (hand-verified against the ledger), Payment due chip, QR + copies; orphaned-occupied T1 (pre-fix residue, `active_order_id: null`) renders the honest empty state; AVAILABLE filter → honest empty + ring + restore; Add table T2 (2 seats, Patio) → new section renders → available drill shows the big QR variant + sticker footer hint → Reserve → RESERVED 1 → Clear → available again; Print stickers clicked with no errors; guest QR menu regression-clean (KN persisted, offers, cart bar). tsc 0. sw.js `5.17.0-r1`.

## [5.16.0] — 2026-10-02 — The report learns to see time (Trends: day-by-day + ratings line + variance chart)

### Added — Reports: the shape of the range, day by day
- **The gap**: Task 53's Reports could TELL the owner the range's totals (gross, avg rating, net variance) but could not SHOW TIME — nothing answered "is the week getting better? was Tuesday a fluke? are we slipping after the rush?" Three parked ideas from 5.15.0's own notes ship here as one Trends section, placed right under the headline strip so time is the FIRST thing the owner sees after the totals: **Day by day** (2-col) + **Ratings over time** (1-col).
- **Day by day** — a recharts `ComposedChart` per IST calendar day: **gross ₹ as teal bars** (the best day of the range turns GOLD, same peak-highlight language as Sales by hour) and **tickets as a gold line on a right-hand axis** (`allowDecimals={false}` — you can't sell half a ticket). The caption names the best day with its rupees; the dual-series tooltip speaks both (`29 Sept · Gross ₹231.00 · Tickets 1`). Windows are honest: **7d/30d fill every calendar day with true zeros** (a slow Tuesday reads as a slow Tuesday, not as missing data); **Today** refuses to fake a shape — the card renders "One day can't show a shape" with a one-tap **See last 7 days** switch that drives the real range state; **All time** buckets the most recent 30 ticket days and says so in both the caption and the footer. CSV export (`servepoint-daily-sales-YYYY-MM-DD.csv`): Day (IST) / Gross / Tickets / Avg ticket — zero-ticket days leave the avg cell empty rather than inventing ₹0 averages.
- **Ratings over time** — the 019 ledger's daily story: a **gold line of the average ★ per IST day**, y-domain pinned [1,5] with integer ticks, and — the honesty part — **`connectNulls={false}` so unrated days stay GAPS**, verified visually (5★ → 4★ across 29–30 Sept, an empty 1 Oct the line refuses to cross, then an isolated 2 Oct dot). Dot radius scales with how many ratings backed the day (`3 + min(3, n)`), the `role=img` aria summary speaks "N ratings over M rated days", and unrated ranges get an honest empty state instead of an empty chart.
- **Drawer honesty gains a chart** — the parked "variance trends" idea lands INSIDE the section that owns variance: a **shift-by-shift diverging mini bar-chart** under the net/counted tiles, one bar per sealed shift, **colored by the exact `varianceColor` thresholds the close dialog speaks** (exact green / ≤₹20 amber / else red), `ReferenceLine` at zero, signed y-ticks, and a sealed-exact shift honestly renders as *no bar at all* (it WAS exact — the aria summary still counts it). Tooltip prints the stored variance through the shared `signedMoney`.

### STYLE MANDATE
- Both new charts ride the screen's existing chart conventions (rounded bar tops, `#E3E7E0` dashed grid, 12px-radius tooltips with the soft teal shadow, gold hover cursor wash); the CSV button on Day by day mirrors the section buttons (gold-outline pill, hover fill, `active:scale-[0.97]`); the Today hint card keeps its height (`h-56`) so the range switch never reflows the page; every money figure `tabular-nums`.

### Verified
- Browser E2E on the real cloud data, zero page errors on every surface touched: **7d** — Day by day bars hand-checked against the ledger (29 Sept ₹231 · 30 Sept ₹462 · 2 Oct ₹703.50 gold best-day, 26–28 Sept + 1 Oct true zero bars; ticket line 1·1·2), ratings line 5★→4★ with the 1 Oct gap and isolated 2 Oct dot confirmed by zoomed screenshot, variance mini-chart shows the −₹7.00 amber down-bar (30 Sept) next to the invisible ₹0.00 shift (29 Sept); **Today** — "One day can't show a shape" + See-last-7-days button that really flips the range; **30d / All time** — captions honest, footer cap line present; **daily CSV downloaded for real** (BOM + 7 filled rows + 351.75 avg on 2 Oct + empty avg on zero days); tooltips verified live (`29 Sept · Gross ₹231.00 · Tickets 1`). Guest QR menu + Dashboard regression-clean.
- `sw.js` VERSION 5.15.0-r1 → **5.16.0-r1** (shell-changing deploy discipline). tsc 0.

## [5.15.0] — 2026-10-02 — The report learns to listen (Guest satisfaction + Drawer honesty on Reports)

### Added — Reports: the two newest ledgers join the business view
- **The gap**: Tasks 50–52 built the `order_feedback` and `cash_drawer_sessions` ledgers and gave them homes on the guest track page, the Dashboard (today only) and Close-out — but **Reports, the "where does the business actually stand" screen, could not hear either of them**. An owner could be loved by guests and running a leaking drawer without the weekly report ever mentioning it. Both sections now ride the established range tabs (Today / 7 / 30 days / All time, IST calendar days) and load **fail-soft**: a hiccup in either ledger read can never take the sales view down — the section falls back to its own honest empty state.
- **Guest satisfaction (019 ledger)**: average rating over the selected range with the Dashboard card's health verdict (≥4.5 green *guests love it* / ≥3.5 gold *good — keep going* / <3.5 red *listen up*), ratings-in-range count with a "N with comments" subline, a **5★-first star histogram** (the way a cafe reads it — modal bar turns gold, spoken `role=img` summary), and the **newest guest comments as gold-ruled quotes** with star chip + order number. CSV export (Submitted IST / Order # / Rating / Comment) rides the shared `csv.ts` (BOM + injection-safe). New appended api helper `fetchFeedbackRows` reads the ledger raw (500-row cap convention); range filtering is client-side like orders.
- **Drawer honesty (020 ledger)**: sealed shifts only — the section refuses to speak about open shifts. Net variance tile tinted by the **exact same `varianceTone` thresholds the Close-out dialog speaks** (exact green *matches the ledger* / ≤₹20 amber *small slip — noted on the shift* / else red *over/short — investigate*), shifts-sealed count, and per-shift rows: closed-at IST, `expected exp · counted counted`, a signed variance chip, and the closer's note as an italic quote. Variance is the **stored column**, never re-derived — the section's subtitle says so.

### Added — demo state (seed script, ledger-consistent)
- `scripts/seed-reports-demo.mjs` (idempotent via `orders.notes = 'demo:reports-seed'`, transactional, self-verifying 8/8): two historical paid orders — #63 Meera Joshi, dine-in 1× Flat White ₹231 UPI + 5★ "The flat white was perfect — hot, quick, and ordering from the table just worked."; #64 Arjun Nair, takeaway 2× Flat White ₹462 **cash** — each with its `order_items` + `payments` ledger rows so COGS (v_order_cogs ₹36/serve ✓) and the cash math stay honest; and two closed drawer shifts — 29 Sept exact (₹500 float, no cash sales, variance ₹0) and 30 Sept (₹962 expected = ₹500 float + ₹462 cash ledger ✓, counted ₹955, variance **−₹7.00** with the note "Coin tray ran light during the evening rush."). The demo is **consistent with the payments ledger by construction** — anyone recomputing expected from the ledger gets the stored numbers.

### Fixed — and one harness lesson banked
- **The histogram bar-height bug in my own first draft**: the star bars' `height: N%` resolved against an auto-height flex column (content-sized), rendering the chart as flat stubs. Fixed with a definite-height bar area (`h-full flex-1 items-end` wrapper inside a fixed `h-28` row) so percentage heights have something real to resolve against.
- **Harness lesson**: the sandbox tool-output renderer can **eat the literal substring ` [h`** (space-bracket-h), which made `), [hourly])` display as `), ourly])` across sed/grep/cat/JSON.stringify — a ghost syntax error that tsc, esbuild AND the running app all disagreed with. Rule banked: before believing a "syntax error" that the toolchain itself doesn't report, verify the actual bytes via `charCodeAt` — display pipelines can lie.
- STYLE MANDATE: headline KPI tiles gain a gentle hover lift (`hover:-translate-y-0.5` + soft teal shadow); guest quotes carry a gold left rule, warm surface and hover deepen; histogram bars animate in with a 55ms-per-bar stagger (reduced-motion gated by the global rule); every money figure stays `tabular-nums`.

### Verified
- Browser E2E on the real seeded data, zero page errors throughout: headline strip hand-checked (gross ₹1,396.50 = 409.50+294+231+462 · GST ₹66.50 · net ₹1,330 · 4 orders · avg ₹349.13 · 6 items); Cost & margin ₹216 ingredients / ₹1,114 margin / 84%; Top items ₹1,430 @ 85% mgn; payment mix UPI ₹934.50 ×3 + Cash ₹462 ×1; satisfaction 4.3/5 "good — keep going", histogram 1×5★ + 2×4★, both real comments quoted with order #s; drawer −₹7.00 net amber, 2 sealed shifts row-for-row with the note; **Today** range shows the honest empty drawer state ("No sealed shifts in this range") while satisfaction falls to 1 rating · 4.0/5; ratings CSV downloaded for real (BOM + header + "2 Oct, 7:02 pm,55,4,…" row). Dashboard Guest love card independently reads "3 ratings · 1 today" — the two views agree on the same ledger. Guest QR menu + Dashboard regression-clean.
- `sw.js` VERSION 5.14.0-r1 → **5.15.0-r1** (shell-changing deploy discipline). tsc 0.

## [5.14.0] — 2026-10-02 — The drawer lets money leave — honestly (cash drawer movements)

### Added — Migration 021: the `cash_drawer_movements` outflow ledger
- **The honesty gap 5.13.0 parked out loud, closed**: a real drawer doesn't only take money in — a supplier gets paid at the door (**payout**) or the counter skips cash to the safe before it grows top-heavy (**safe drop**). Without a ledger for that, an operator closing after a payout would be blamed for a variance that isn't theirs — the whole point of stored variance is trust. `cash_drawer_movements` (tenant_id, session_id CASCADE, kind CHECK `payout|drop`, amount > 0, **reason REQUIRED** 1–280 after trim — "₹200 out" without a why is not evidence, it's a leak, created_by_email, created_at) is append-only evidence: member-only RLS, zero anon paths, session-bound so a shift dies with its movements.
- **`sp_record_drawer_movement(UUID, TEXT, NUMERIC, TEXT)`** — SECURITY DEFINER, tenant from `current_tenant_id()`, stable P0001 codes (`BAD_KIND`, `BAD_AMOUNT`, `REASON_REQUIRED`, `TOO_LONG`, `NOT_FOUND`, `DRAWER_NOT_OPEN` — a sealed shift can never be amended, that would rewrite sealed evidence), reason trimmed server-side, **PUBLIC default EXECUTE revoked before the grant** (the 020 lesson baked in from the start). The migration's own DO-block verifies the table/RLS/policy/one-overload/no-anon/realtime AND that the re-bodied close actually reads the movements ledger.
- **`sp_close_drawer` re-bodied, same single overload**: expected = `opening_float + cash-in − Σ(movements)`. **With zero movements the math is byte-identical to 020** — the 020 E2E suite stays green untouched (proven: the movements E2E re-asserts the no-movement path). The close response now also returns `movements_out` alongside `cash_in`, and DB E2E 24/24 proves the core invariant live: float ₹500 + ₹0 cash − ₹300 outflows (₹200 payout + ₹100 drop) ⇒ expected ₹200, counted ₹200, **variance ₹0 — the payout is NOT the operator's fault**. `db-setup.mjs` gains the 021 sentinel (001→021).

### Added — Close-out: movements on the drawer card + dialogs
- **Movements strip on the open card**: every payout/drop as a row — kind chip (red PAYOUT / blue SAFE DROP), `−₹` amount, the required reason, IST time — under a `Movements out · ₹` header; the gold **In drawer** tile now nets them (`float + cash-in − movements`, flips red if paper-negative) and the honesty line spells the formula: *expected = float + cash-in − payouts & drops · ledger truth, never a guess*. Header gains a **Movement** button beside Count & close.
- **Movement dialog**: kind radios (Payout *paid out — supplier, petty cash* / Safe drop *moved to the safe*), amount, and a **required** reason with its own placeholder voice per kind and a 280 counter — the confirm button stays disabled until both amount and reason are real. Recording shows a spinner; new stable codes map to honest copy in the alert banner.
- **Count & close dialog** gains the breakdown row: `Paid out / dropped −₹150.00` between cash-in and the expected line, so the operator sees the outflow *before* being asked for the recount.
- **STYLE MANDATE**: movement rows use a soft red-tinted surface (`#FDF6F5`) that visually reads as "money left", kind chips carry the existing red/blue ledger vocabulary, the dialog kind-radios invert to the dark-teal active state, and everything stays `tabular-nums` on money.

### Fixed
- **A label-honesty bug the browser E2E caught in my own new code**: the Z-report's sealed-shift block derived cash-in as `expected − float` — true under 020, but with movements that derivation is the shift's **net** (₹400 float − ₹150 payout ⇒ it printed "Cash in (ledger) ₹-150.00" when cash-in was actually ₹0). The Z-report must never claim a number that isn't what it says it is: the row is now **`Net cash (in − out)`** with an explicit sign, derived from stored columns only (the shift window's raw split isn't persisted, and the report refuses to fake it).

### Verification
- DB E2E 24/24 (structure + RPC loop as the forged-claims owner: kind/amount/reason rejections, payout+drop recorded with trimmed reason, close nets outflows to variance ₹0, DRAWER_NOT_OPEN after seal, 020 no-movement math unchanged, anon lockout, cascade cleanup) and a full browser loop on real data: open ₹400 → record payout ₹150 "vegetables vendor paid cash" → In-drawer ₹250 with the movements strip → close dialog shows the −₹150 row → count ₹250 → "✓ right on the ledger" → sealed → Z-report block re-captured after the label fix → cleanup back to a zero-row ledger. Zero page errors throughout. `tsc` clean; SW `5.14.0-r1`.


## [5.13.0] — 2026-10-02 — The drawer counts the cash (shifts & drawer — THE LAST UNBUILT NOVA ITEM)

### Added — Migration 020: the `cash_drawer_sessions` ledger
- **One session is one shift's physical drawer**: `cash_drawer_sessions` (tenant_id, opened_by_email, opened_at, opening_float ≥ 0, status `open`/`closed`, closed_by_email, closed_at, counted_cash, expected_cash, variance, closing_note ≤ 280) — and the bookkeeping rule that makes it trustworthy: **expected cash is computed SERVER-SIDE at close time** as `opening_float + Σ(cash payments while open)` read straight off the 007 payments ledger, and `variance = counted − expected` is **stored, never re-derived**, so a sealed shift is immutable evidence. A `card`/`upi` payment can never leak into the drawer math (the sum filters `method = 'cash'` — proven live: a ₹999.99 card fixture left expected untouched at ₹620.50).
- **One open drawer per tenant**: a partial unique index (`WHERE status = 'open'`) is the hard guard — a cafe has one physical drawer; the RPC pre-checks it anyway to raise a stable `DRAWER_ALREADY_OPEN` instead of a raw constraint violation. Multi-location can extend by widening the index key later.
- **RLS + grants, the established two-actor model**: member-only policy (`sp_tenant_member`) with zero anon paths; `sp_open_drawer(NUMERIC)` and `sp_close_drawer(UUID, NUMERIC, TEXT)` are SECURITY DEFINER with tenant from `current_tenant_id()`, stable P0001 codes (`BAD_FLOAT`, `BAD_COUNT`, `NOT_FOUND`, `ALREADY_CLOSED`, `TOO_LONG`, `NOT_A_MEMBER`) the UI maps to honest words. **Grant-hygiene bug caught by the migration's own DO-block**: `GRANT … TO authenticated` does not remove the default `PUBLIC` EXECUTE — anon inherited the RPC back until an explicit `REVOKE … FROM PUBLIC, anon` was added (the verification now fails the migration loudly if anon can ever execute). Realtime membership so a future multi-device counter mirrors drawer state. `db-setup.mjs` gains the 020 sentinel (001→020).
- **DB E2E 26/26** (`scripts/qa-drawer-e2e.mjs`, self-cleaning): structure (table/RLS/1 policy/one-open index/2 RPCs/no-anon/realtime) + full RPC loop as the real owner via forged `request.jwt.claims` (a missing `email` claim in the first fixture run proved the RPCs read `auth.jwt()->>'email'` — fixed the harness, not the app) + anon lockout both ways + zero residue.

### Added — Close-out: the Cash drawer card (today only)
- **The live shift at a glance**: OPEN state (pulsing green chip) shows who opened it and when, plus three tiles — **Float** / **Cash in** (ledger truth since open, refreshed on the same 20s heartbeat as the day view) / **In drawer** (gold-tinted, `float + cash-in`, labelled "expected", never "counted"). Not-open state shows the last sealed shift's variance chip + note, or honest empty copy. **Recent shifts** folds open into a compact list (time range, float · counted, variance chip, note) of the last five sealed shifts.
- **Count & close dialog**: the ledger already knows what to expect — the dialog shows the breakdown (float, cash-in since open, **Expected in drawer**) *before* asking for the recount, then the variance line **speaks as you type** (`aria-live`): `✓ right on the ledger` (green, exact), `+₹X vs expected · small slip — noted on the shift` (amber ≤ ₹20), `over/short — investigate` (red). Optional note with 280 counter, `TOO_LONG`-proof. Sealing shows a spinner; stable RPC codes map to human copy in a red `role="alert"` banner that never blocks retry.
- **STYLE MANDATE**: the drawer card follows the day-summary language (rounded-2xl white card, `tabular-nums` money, uppercase micro-labels), with its own identity — dark-teal Coins badge, gold-tinted "In drawer" tile (the one number the count is about), brand focus rings on every input, `active:scale-[0.99]` buttons.

### Added — Z-report: CASH DRAWER block
- The printable Z-report gains a `CASH DRAWER` section whenever a shift actually touches the report day: an **open shift** prints `Opened · by / Float / Cash in (ledger) / IN DRAWER (expected)` — explicitly "(expected)", a Z-report never claims a count that didn't happen; a **shift sealed today** prints the stored truth `Closed · by / Float / Cash in (ledger) / Counted / VARIANCE`. Verified against the live DB through the iframe print spy: block matched row-for-row (`Closed 19:26 · Float ₹500.00 · Cash in ₹120.50 · Counted ₹630.50 · VARIANCE +₹10.00`) and the PAYMENTS section picked up the fixture's CASH ₹120.50 alongside UPI ₹703.50.

### Fixed
- **PostgREST `+00:00` timestamp pitfall** (caught by the browser E2E, not the DB suite): `fetchCashInSince` compared `created_at` against the raw `opened_at` PostgREST returns — whose `+00:00` timezone suffix corrupts the `gte` filter in the query string, silently returning ₹0.00 cash-in while every other number was right. Normalized through `new Date(...).toISOString()` (`Z`-form, the same reason EodScreen's day bounds never hit this). The card went ₹0.00 → ₹120.50 → ₹620.50 exactly on the DB math after the fix.

### Verification
- DB E2E 26/26 (structure + RPC loop + lockout + cleanup) and a full browser loop on the real cloud data: open ₹500 → cash lands → in-drawer ₹620.50 → count ₹630.50 with live `+₹10.00` variance → sealed → history + Z-report block row-for-row → cleanup back to a zero-row ledger with the card back on its honest empty state. Zero page errors on every surface touched. `tsc` clean; SW `5.13.0-r1`.


## [5.12.0] — 2026-10-02 — Guests rate the cafe ("how was everything?" — the last guest-side NOVA item)

### Added — Migration 019: the `order_feedback` ledger
- **One rating per order, ever**: `order_feedback` (tenant_id, order_id `UNIQUE`, rating `SMALLINT CHECK 1–5`, comment ≤ 280 chars, created_at) follows the 015/016 ledger pattern — the UNIQUE constraint **is** the replay guard, so a second submit can never stack and a cascade-deleted order takes its rating with it. Index on `(tenant_id, created_at DESC)` powers the Dashboard's newest-first reads.
- **Capabilities, not accounts (the 012 principle)**: the order UUID doubles as the rating capability — anyone holding the track link can rate that order, exactly once. Anon never touches the table directly (RLS deny-by-default, zero anon policies); every guest write goes through **`sp_submit_public_feedback(order_id, rating INTEGER, comment)`** — a SECURITY DEFINER RPC that validates the order exists (`NOT_FOUND`), the rating is 1–5 (`BAD_RATING`), the comment trims to ≤ 280 (`TOO_LONG`), and answers `ALREADY` on replays while leaving the stored rating untouched. `p_rating` is INTEGER on purpose: `int4→smallint` is an *assignment* (not implicit) cast, so a raw SQL caller with an integer literal would fail overload resolution — the column CHECK stays the hard boundary. The DB E2E caught this exact failure mode live ("function does not exist") before any UI was written.
- **The track pager learns the rating**: `sp_get_public_order` now returns `feedback_rating`, so a reopened track page shows its thank-you state from **server truth** — not localStorage guesswork. Realtime: `order_feedback` joins `supabase_realtime` (a future live widget can subscribe without another migration). Migration's DO-block verification hard-fails unless: table + RLS + exactly 2 policies, exactly ONE overload, anon EXECUTE grants intact, `feedback_rating` present in the pager's source, and realtime membership. `db-setup.mjs` gains the 019 sentinel (001→019) so fresh bootstraps carry feedback.

### Added — Guest track page: "How was everything?"
- Once the cafe marks the ticket **served**, the pager grows a rating card: five gold stars (staggered `spStarPop` pop-in, hover/focus preview, `active:scale-90` tap, full `radiogroup`/`radio` + `aria-checked` semantics), an optional comment that unfolds after the first star (280-char counter, brand focus ring), and a teal **Send rating** button that stays disabled until a star is picked and shows a spinner while sending. Success morphs the card into a **Thank you** state (HeartHandshake badge, filled star row, `N/5`, `spThanksRise` rise-in) driven by the server's `feedback_rating`; errors surface in a red `role="alert"` banner without ever blocking a retry.
- **Three languages day one**: 15 new keys × EN/हिंदी/ಕನ್ನಡ in `guest-i18n.ts` — Kannada guests see "ಎಲ್ಲವೂ ಹೇಗಿತ್ತು?" and "ಧನ್ಯವಾದಗಳು!" live.
- **Served-state flourish (style)**: the stepper's final node turns **gold with a soft halo ring** the moment the ticket is served (and its pulse dot retires) — the widget below is why.

### Added — Dashboard: the "Guest love" card
- The right-now screen hears the guest's voice: **average rating / 5** with a health-tone pill (**≥ 4.5 green "guests love it" · ≥ 3.5 gold "good — keep going" · < 3.5 red "listen up"**), a filled-star row at the rounded average, a **5-bar ratings histogram** (green 4–5★ / gold 3★ / red 1–2★, `role="img"` with a spoken summary, animated heights), "N ratings · M today", and the **newest comment as a gold-ruled quote** with its order number. Data comes from `fetchFeedbackStats` (api.ts, appended — read-only on the ledger, tenant-scoped by RLS, IST-today bucketing, latest row quoted). Fails soft: a fresh table with no ratings just leaves the card out.

### Verified
- **DB E2E 16/16 first** (`scripts/qa-feedback-e2e.mjs`, self-cleaning fixture, RPCs exercised AS anon): valid submit persists rating 4 + trimmed comment + tenant copy; replay returns ALREADY with still exactly one row; ratings 0/6/null → BAD_RATING; 281-char comment → TOO_LONG; random UUID → NOT_FOUND; the pager carries `feedback_rating=4` for the rated fixture and `null` for unrated #48; anon direct INSERT violates RLS and anon direct SELECT sees zero rows; cleanup leaves the ledger at zero.
- **Browser E2E on the live demo ticket**: #55 advanced paid→ready→completed (the 011 trigger auto-released T1 — a served guest is a left guest); track page grew the widget the moment status flipped; 4★ + "Large flat white was perfect, hot and quick" submitted → DB row verified (rating 4, comment, #55) → **reload shows the thank-you from server truth**; Kannada switch live; Dashboard card reads **4.0 / 5 · 1 rating · 1 today**, histogram aria "4 stars 1", quote "#55 · 4★". Guest menu + Bills regressions clean, tsc 0, zero page errors on every surface.
- Two migration-authoring lessons banked in `scripts/qa-feedback-e2e.mjs` + the 019 comments: (1) never assign a boolean column straight into an integer variable in a verification DO-block; (2) an E2E harness that wraps anon RPC calls in ROLLBACK discards its own writes — commit and clean up in `finally` instead.

## [5.11.0] — 2026-10-02 — The counter can print the bill (customer receipts + money-honest Bills detail)

### Added — Printable customer receipt (thermal 80mm)
- **Bills gains the receipt the counter was missing**: every live (non-cancelled) ticket in the Bills detail pane gets a full-width gold **"Print receipt"** button. It renders a thermal-80mm (302px, Courier) receipt through the same hidden-iframe print engine as the EOD Z-report — cafe name, `CUSTOMER RECEIPT`, order #, order type, table, customer, IST timestamp; item lines with variant and `+ add-on` sub-lines and frozen line totals; then **Subtotal → DISCOUNT (with the offer's real title) → CGST 2.5% → SGST 2.5% → TOTAL → PAID · method → paid-at time**; footer thank-you + printed-at + servepoint sign-off.
- **Money honesty is structural**: every rupee on the receipt is a *stored* column (`subtotal`, `discount_amount`, `tax_amount`, `total`) — never recomputed. The CGST/SGST split is a display-only halving of the stored `tax_amount` that sums back exactly (India restaurant convention: 5% GST prints as 2.5% + 2.5%).
- **Two new lazy, fail-soft API helpers** (`src/lib/api.ts`, appended at file end): `fetchOrderOfferTitle` (offer title via the 016 redemption ledger — prints even for offers paused after the sale) and `fetchOrderPayment` (payments-ledger row from 007: method, amount, paid-at; legacy orders without a ledger row fall back to `orders.payment_method` and the status trail). Both return `null` on any miss so a receipt never hard-fails on a nice-to-have.
- **`buildReceiptHtml` is exported and pure** — the receipt is assertable without a printer: browser E2E captured the REAL iframe HTML for orders #48 and #55 and verified every figure against DB truth (440 − 50 + 19.50 = 409.50; 330 − 50 + 14 = 294), offer titles from the ledger, `PAID · UPI` with the ledger's paid-time, and variant/add-on sub-lines (`Large`, `+ Extra shot`).

### Added — Bills detail: money breakdown (the QA gap this round found and fixed)
- The detail pane used to show items ₹330.00 vs a total ₹294.00 with **no explanation** — the ₹50 offer discount and GST were invisible. A new dashed-rule breakdown block above the Total now prints **Subtotal → OFFER badge + offer title + −₹ (green) → GST (5% · CGST+SGST)**, all stored figures, appearing only when the ledger says the order actually has a discount/tax.
- Item rows now show the **frozen line total** (`item_total`, add-ons included) instead of the bare unit price — a 2× line with extras reads the full ticket amount.

### Changed — Bills list polish
- Each order row carries a **status accent bar** on its left edge (gold = active, green = paid, red = cancelled) so the column scans by color, and discounted tickets show a small green **"−₹50 off"** chip right on the row; row totals/times are now `tabular-nums` aligned.

### Verified
- tsc 0, lint clean; zero page errors on Bills, guest QR menu, Inventory Reorder, Dashboard (agent-browser sweep, start → finish). Receipt print path proven in-browser twice (iframe captured, `contentDocument` read back, print window focused) — #48: `DISCOUNT · ₹50 off over ₹300 −₹50.00`, `CGST ₹9.75 + SGST ₹9.75`, `TOTAL ₹409.50`, `PAID · UPI 16:27`; #55 adds `Large` + `+ Extra shot` sub-lines. Ledger method label normalized through `METHOD_LABEL` (raw `upi` → `UPI`). OFFER-row hide-logic exercised via the exported builder (discount = 0 ⇒ no discount row). Guest QR menu regression-clean after the api.ts additions.

## [5.10.0] — 2026-10-02 — The shelf asks to be refilled (burn-rate reorder list + today's margin on the Dashboard)

### Added — Inventory gains the Reorder tab
- **Burn-rate reorder suggestions, ledger-driven and read-only**: `fetchDeductionWindow(tenantId, days)` pulls the last 14 days of `stock_deductions` (the 015 ledger — no new write path, no migration), and a pure client-side engine converts burn into buying:
  - `burn/day` = Σ ledger qty per SKU ÷ 14;
  - `days left` = current stock ÷ burn (color-coded: red < 3d, amber < 7d, green ≥ 7d, "no burn yet" for silent SKUs);
  - `suggested qty` = ⌈burn × 7 − stock⌉ (**7 days of cover**), editable right in the BUY input;
  - `est cost` = qty × current `cost_per_unit`, with the list's **est total** in the footer.
- **On the list when it counts**: a SKU joins the shopping list when it burns AND (stock ≤ reorder point OR fewer than 7 days of cover remain) — the first condition catches the shelf that's simply low, the second the fast-burner that isn't low yet. Burning-but-covered SKUs appear in a muted **"Watching"** list (days left + burn/day) instead of vanishing.
- **Actions that match a delivery day**: **Copy** (clipboard text with per-line estimated cost, 1.6s "Copied!" feedback) and **CSV** (`servepoint-shopping-list-<IST date>.csv`, 9 columns incl. burn/day and days-left) — plus a per-row **Restock** button that opens the existing restock dialog **prefilled with the suggested quantity** (`RestockDialog` gains an optional `suggestedQty` prop; the dialog also shows a dotted "Suggested: N unit (7-day cover)" button that re-applies it; the Stock tab's plain restock path is unchanged, empty input).
- Honest empty state: no burn history ⇒ "Nothing to buy yet — place a few tickets and the ledger will price your shopping list"; burn but covered ⇒ "The shelf covers the week" + the Watching list.

### Added — Dashboard "Today's margin" card
- The "right now" screen learns what the day COSTS: a third card beside Best Employees / Trending Dishes shows **today's margin** on the SAME money basis as Reports & Close-out (one query on `v_order_cogs` bounded to the IST day, paid non-cancelled tickets only): big margin number, `NN% margin` pill tinted by the shared health tones, gold/teal split bar (ingredients vs what the cafe keeps), and an honest sub-line that surfaces stock burned on UNPAID tickets (`+₹X burned on unpaid tickets`) when the numbers differ.
- Loads AFTER the main dashboard fetch and **fails soft** — a failed margin query only hides the card, never the dashboard.

### Verified
- Browser E2E as owner with a single-row fixture (beans stock temporarily 20g, restored to 4,900g after — recipe and margin numbers untouched): buy list shows Coffee beans `burn 4.286 g/day` (= 60g ledger ÷ 14), `4.7d left` (20 ÷ 4.286), BUY prefilled `10 g` (= ⌈4.286×7 − 20⌉), est `₹18.00` (= 10 × ₹1.80), est total ₹18.00; restock dialog opens prefilled with the "Suggested: 10 g (7-day cover)" affordance; **real CSV download checked byte-for-byte** (UTF-8 BOM, 9 columns, correct row); Copy → "Copied!". After restore: "The shelf covers the week" + Watching row `1143.3d` (= 4,900 ÷ 4.286). Dashboard card: ₹562.00 of ₹670.00 paid net · 2 tickets · 84% margin — hand-verified against the DB. Stock-tab restock dialog and the guest QR menu regression-clean. tsc 0; zero page errors on every surface touched.

## [5.9.0] — 2026-10-02 — The menu knows what it costs (COGS & margin wire into Reports + Close-out)

### Added — COGS views (migration `018_cogs_margin.sql`)
- **The last NOVA-parity item is closed**: the inventory shelf (015) now talks to the money screens. Two read-only views, no new tables, no triggers — the deduction ledger stays the single write path (SINGLE-ENGINE RULE untouched):
  - **`v_order_cogs`** — one row per order with its ingredient cost: Σ `recipe_lines.qty_per_serve × order_items.qty × inventory_items.cost_per_unit` over every non-null item line. Recipe-less items read an honest `0.00` (not null).
  - **`v_item_unit_cost`** — what ONE serve of each menu item costs in ingredients; Reports joins it to item lines for per-item margin.
  - Both views are `security_invoker = on` (same shape as `v_customer_stats` in 016) — every read flows through the caller's own tenant policies, no SECURITY DEFINER surface. Idempotent apply + verification DO-block (both views exist, both invoker-flagged).
- **Honest money basis** (mirrored in the UI copy): margin is computed on **PAID, non-cancelled tickets only** — margin cannot be banked on money not collected. Gross margin = paid net (ex-GST, after discount) − COGS. Cost basis is CURRENT `cost_per_unit` (no cost-history table — a restock reprices history; the screens say so), and recipes model the BASE item only (variant sizes and add-ons are not priced yet — documented in both screens).

### Added — Reports: "Cost & margin" section
- Three stat tiles — **Ingredient cost** (gold on cream), **Gross margin** (health-colored), **Margin rate** with a plain-language verdict (`healthy for a cafe` ≥65% · `worth watching` 40–65% · `check your pricing` <40% — typical cafe economics).
- **Revenue-split bar**: what the shelf burned (gold) vs what the cafe keeps (teal), animated width, color-dot legend, full `role="img"` aria description.
- **Top items gain margin chips**: each ranked item shows a `NN% mgn` pill tinted by the same health tones, with a tooltip carrying the item's ingredient cost and margin rupees. The CSV export gains `Ingredient cost (INR)`, `Margin (INR)` and `Margin %` columns (8 columns total).
- COGS loads ride along with the sales fetch (`Promise.all` — the maps can never drift from the orders).

### Added — Close-out: cost & margin row + Z-report lines
- The day summary grows a second strip: **Ingredient cost** (all LIVE tickets — the shelf burned for them, paid or not) · **Margin · paid** (paid net − paid COGS, red below 40%) · **"Where the paid money went"** split bar (gold/green on the grey panel, aria-described).
- The **printed Z-report** gains a `COST & MARGIN · PAID TICKETS` block — `Ingredient cost` + `GROSS MARGIN` lines between the money block and PAYMENTS, so the paper trail carries the margin story too.

### Verified
- DB E2E `scripts/qa-cogs-e2e.mjs` **9/9 PASS** on the live cloud: `v_item_unit_cost` matches recipe math per item; `v_order_cogs` matches Σ `qty_per_serve×qty×cost` for every order; the demo tickets carry real COGS (#48 Maya ₹72.00 = 2 serves × 20g × ₹1.80, #55 Ira ₹36.00); margin math sane (#55: net ₹294.00 − ₹36.00 = ₹258.00, 88%); a self-cleaning fixture (temp recipe-less item + order) prices at exactly `0.00` and cascades away clean.
- Browser E2E as owner: Reports `Cost & margin` shows ₹108.00 ingredients / ₹562.00 margin / **84%** (= 562/670 paid net — hand-verified against the DB), Top-items chip `86% mgn` (= (440+330−108)/770 item-level, pre-discount — both bases correct by design); Close-out strip shows the same ₹108/₹562/₹670 with the split bar; Z-report print path clean. Zero page errors on Reports + Close-out.
- db-setup.mjs now carries sentinels for **017 AND 018** (017 had been applied out-of-band with no bootstrap path — a fresh environment would have missed guest-offer checkout); header updated 001-010 → 001-018. sw.js VERSION bumped `5.8.0-r1` → `5.9.0-r1` (shell-changing deploy discipline).

## [5.8.0] — 2026-10-02 — Guests redeem the offer (QR checkout joins the CRM loop) + shared csv lib

### Added — guest offer checkout (migration `017_guest_offer_checkout.sql`)
- **`sp_create_public_order` gains `p_offer_id`** — the QR menu's offers banner was read-only since 5.5.0; now a guest can actually USE an offer. The server re-validates EVERYTHING against the recomputed subtotal: offer belongs to this tenant, `is_active`, min-order floor holds, discount clamped to the subtotal (percent capped at 100, flat never exceeds the basket — an offer can never pay the guest). Validate-before-insert: a rejected offer (`OFFER_MIN`, `OFFER_INVALID`) leaves zero residue, exactly like a rejected item line.
- **Ledger-honest money**: GST is recomputed on the discounted base (`(subtotal − discount) × 5%`), the order writes `discount_amount`, and the `offer_redemptions` row (UNIQUE per order — replay-proof since 016) rides with the ticket; `trg_offer_redemptions_usage` recomputes `usage_count` from the ledger automatically. No customer row is created for phone-less guests — by design.
- **Signature discipline**: the new param changed the RPC signature, so Postgres would have OVERLOAD-ed (not replaced) it — the 7-arg shadow is explicitly `DROP`ped first, and the migration's verification DO-block asserts exactly ONE overload exists, `p_offer_id` landed, and anon EXECUTE grants survived.
- **`sp_get_public_order`** now exposes `discount_amount` + the offer title, so the guest's track-page bill shows the same −discount row the counter sees.

### Added — the guest offer UX (`/menu/:token`)
- **Offer chips are now tap-to-apply buttons** (`aria-pressed`): tap to apply, tap again to remove; the applied chip flips to a white card with a gold ring, the medallion swaps to teal, and a green check-badge docks onto it. Selecting one offer deselects the other (one per order — the ledger's UNIQUE guard).
- **Honest states**: below the floor the chip shows "Add ₹X more to unlock" in red (and keeps showing it if a selected offer's floor is no longer met — "Applied" is only claimed when it counts); after applying, the label flips to "✓ Applied". A paused/removed offer is dropped automatically once the offers list refreshes — it never rides along silently.
- **Cart drawer**: a compact offer-picker row (same toggles, pill-sized, dashed border for below-floor ones with the unlock hint as tooltip) plus a green discount row — `OFFER` badge + offer title + −₹, with an ✕ to remove, fading in on the discounted base. GST and total update live; the cart bar's total matches the drawer's matches the server's.
- **Track bill**: paid or due, the bill now prints the discount line in green with the offer title.
- **i18n**: the offer keys (`offer`, `offerTap`, `offerApplied`, `offerAddMore`, `offerRemove`) ship in all three guest languages — a Kannada reader sees "ಅನ್ಲಾಕ್ ಮಾಡಲು ₹300.00 ಸೇರಿಸಿ", a Hindi reader "अनलॉक करने के लिए {amt} और जोड़ें".
- The offer selection persists with the cart in `sessionStorage` (identity only — the offer ID, never prices).

### Changed — shared `src/lib/csv.ts` (last NOVA-parity leftover)
- Bills (5.3.1) and Reports (5.3.3) carried byte-identical copies of the injection-safe CSV escaping + BOM-blob download; both now import the consolidated `csvCell`/`downloadCsv`. Bills' exporter was rebuilt on `downloadCsv` (same file name, same columns, same OWASP neutralization of leading `= + - @`). Behavior verified by actual downloads from both screens.

### Verified (engine + browser E2E on the live cloud)
- `scripts/qa-guest-offer-e2e.mjs` **11/11 PASS** calling the RPCs AS `anon` (the real guest privilege path): flat offer money (330 → −50 → GST 14 → **294**), percent money (220 → −22 → GST 9.90 → **207.90**), redemption row + usage recompute, track projection shows discount + title, below-floor rejected with zero residue, paused offer rejected, no-offer path byte-identical (GST 11, total 231), idempotent replay returns the SAME discounted ticket, cleanup cascade-heals `usage_count`.
- Browser, end to end as a guest: chip tap → cart bar ₹346.50 → **₹294.00** instantly; drawer discount row + compact picker; order **#55 (Ira Menon)** placed with the ₹50 offer → track bill shows Subtotal ₹330 / **₹50 off over ₹300 −₹50.00** / GST ₹14 / Total ₹294 → counter inbox shows "for Ira Menon · ₹294.00" → Ok → Bills → UPI charged → DB truth: `discount_amount=50`, redemption row, `usage_count` flipped, payment auto-advanced the ticket.
- Kannada + English chip states verified on a live reload; Reports + Bills CSV downloads verified through the shared lib; `tsc` 0.
- **Kept as the owner's try-it-now demo** (Task 42/43 precedent): paid ticket #55 (Ira Menon, Flat White Large + Extra shot, ₹50 offer, ₹294 UPI) alongside #48 (Maya Iyer, ₹409.50). QA fixture orders (#50/#53) were deleted and the offers' `usage_count` self-healed.

### Notes
- NOVA parity remaining: COGS wiring (inventory cost → Close-out/Reports), staff-side i18n (deliberately out of scope — guests first).
- `sw.js` VERSION bumped to `5.8.0-r1` per the shell-deploy discipline.

## [5.7.0] — 2026-10-02 — Guests speak Hindi & Kannada (NOVA guest-i18n parity) + SW update toast

### Added — guest i18n (EN / हिंदी / ಕನ್ನಡ)
- **`src/lib/guest-i18n.ts`** — self-contained dictionary + hook, NO external i18n dependency. ~110 keys per language covering every guest surface: gate (check-in, invalid-link, session errors), session ribbon, menu hero/search/offers, customizer (variants, add-ons, cook note, qty), cart drawer (totals, GST, pay-at-counter, place order), track page (stepper labels + hints, bill, PAID/DUE, copy-link, auto-refresh). `{var}` interpolation; EN is the fallback for any missing key; owner data (menu items, categories, offer titles) correctly stays untranslated.
- **Shared language store** — `useSyncExternalStore`-backed module store: switching language in ONE component re-renders EVERY guest component instantly. (First cut used per-component `useState` — browser QA caught the page split into two languages; fixed before commit.) Choice persists in `localStorage` (`sp.guest.lang`), survives reloads and applies across menu → track navigation; `document.documentElement.lang` syncs for screen readers.
- **`LangSwitcher` pills** — English / हिंदी / ಕನ್ನಡ on the menu hero (dark variant, gold active) and the track hero; native-script labels, `aria-pressed` states.
- **Order-type labels**: the track subtitle no longer shows the raw `dine_in` enum — translated Dine-in / Takeaway / Delivery (Hindi uses the natural café terms डाइन-इन / पार्सल / डिलीवरी).

### Added — SW update toast (completes the 5.6.0 PWA story)
- **Detection (`main.tsx`)**: `reg.waiting` probe + `updatefound`→`statechange` announce a WAITING worker via the `sp:sw-waiting` event; `controllerchange` fires exactly ONE guarded reload. Registration now uses `updateViaCache: 'none'` (best practice; preview serves `no-cache` anyway). `sw.js` never self-skips — the user stays in control.
- **Toast (`PwaLayer.tsx`)**: dark pill, gold beacon + "New version ready" + Refresh → posts `SP_CHECK_UPDATE` (sw.js then `skipWaiting()`s) → controlled reload. Mount-probe covers a reload that happened while an update already waited. Shown on all surfaces, z above the install card.

### Style — guest menu polish
- **Sticky category rail**: horizontally scrollable chips under the hero with scroll-spy highlight (IntersectionObserver) and smooth-scroll jumps (`scroll-mt` anchored sections) — one-tap navigation once the menu grows past a screen.
- **Cart drawer animation**: slide-in panel + backdrop fade (280ms brand easing), `prefers-reduced-motion` honoured (keyframes gated in `index.css`).
- **Copy-link feedback**: the track page's copy button flips to "Copied!"/"ನಕಲಾಗಿದೆ!"/"कॉपी हो गया!" for 1.6s.

### Verified (browser E2E on the live dev server)
- EN default → हिंदी → ಕನ್ನಡ → EN switching re-renders every string instantly (ribbon, hero, search, chips, offers region, customizer, cart, track stepper); choice persists across reloads; zero page errors. Full Kannada menu + cart drawer screenshots (`/tmp/guest-kn-menu.png`, `/tmp/guest-kn-cart.png`); cart math unchanged (Large + Extra shot ₹330 + 5% = ₹346.50, matching prior E2E money).
- Update toast E2E (production build, `vite preview :4173`): toast renders on `sp:sw-waiting`, Refresh posts `SP_CHECK_UPDATE` (postMessage observed), fresh-worker install/activate/cache-eviction/claim all browser-proven. **Known harness limit**: this headless Chromium does not propagate SW update checks on activated registrations (soft-update and `reg.update()` both no-op despite byte diffs, `no-cache` headers and `updateViaCache:'none'`) — the waiting→skipWaiting→controllerchange chain is the standard pattern, verified in code; the UI half is browser-proven.
- `tsc` 0; preview server killed after E2E.

## [5.6.0] — 2026-10-02 — PWA: the POS survives the Wi-Fi (installable counter tablet, offline shell)

### Added — installable app (manifest + icons)
- **`public/manifest.webmanifest`** — `standalone` display (with `display_override` fallback ladder), brand `theme_color #0F3D3E` / cream `background_color`, `en-IN` locale, business/food categories. `start_url`/`scope` pinned to `/` so the SPA owns every deep link.
- **`public/icons/`** — `icon-192.png`, `icon-512.png` (Lanczos upscales of the brand tile) + `icon-maskable-512.png` (full-bleed cream canvas, glyph composited at 76% inside the Android safe zone; the source tile's baked-in corner stroke is cropped out so no arcs show). Generated by `scripts/make-pwa-icons.py` (Pillow) — re-run any time the brand mark changes.
- **index.html** — manifest link, iOS `apple-mobile-web-app-*` set (status-bar `default` so content never slides under the notch), `mobile-web-app-capable`; theme-color already present.

### Added — the service worker (`public/sw.js`, hand-rolled, no workbox)
- **Precache**: shell (`/`, manifest, icons, favicons) + **every hashed build asset** — injected at build time by `scripts/inject-sw-precache.mjs` (wired into `package.json` `build`), because a session's FIRST load is not SW-controlled and runtime caching would never see those files. Cold offline boot proven.
- **Navigations**: network-first with a 5s watchdog → exact cached match → SPA shell → styled inline offline notice. Freshness wins online; the shell wins offline; deep links keep working (`/showcase` offline E2E'd).
- **Supabase is NETWORK-ONLY** — data, realtime and auth requests are never intercepted and never cached; orders, payments and the counter-gate can never be served stale.
- **Header hygiene** (`cachePutClean`): fetch() hands back decoded bodies while headers still claim `Content-Encoding: gzip` — stored responses get honest headers so the offline path never double-decompresses.
- **`ignoreVary: true` on lookups**: the build server stamps `Vary: Origin` on module assets; `crossorigin` module requests carry an Origin header that precache requests don't, and strict matching would miss perfectly good cached scripts (found by E2E, fixed, re-proven).
- **Registration is PROD-only** (`main.tsx`) — dev HMR stays untouched; `agent-browser` confirmed zero SW on :3000 and full SW on the built app.

### Added — PWA UX layer (`src/components/shell/PwaLayer.tsx`)
- **Offline banner** on every surface (staff / public / guest — mode self-derived from the plain path): dark pill, pulsing amber beacon, honest copy ("shows the last synced data / orders queue up when you're back"), manual dismiss per offline episode, auto-return on reconnect. `prefers-reduced-motion` respected.
- **Install card** on staff surfaces only — appears exclusively after a REAL `beforeinstallprompt` (never a button we can't honour), gold-spine white card with the brand mark, serif headline, Install + Not-now; dismissal persists a 7-day cooldown (`localStorage`), hides inside standalone sessions, clears on `appinstalled`. E2E'd live: event captured → card rendered → Not-now → card gone + cooldown stored.

### Verified (production build via `vite preview :4173`, server then killed)
- Shell + 12 build assets precached → **full offline boot** (login screen rendered with zero network); **logged-in offline reload** restored the owner session and the complete app shell (Wi-Fi blips ⇒ the counter keeps running); offline `/showcase` deep link served from cache; offline banner + install card + dismiss-cooldown all browser-proven. Screenshots: `/tmp/pwa-install-card.png`.

## [5.5.0] — 2026-10-02 — Guests & Offers: the CRM remembers (NOVA customers/offers parity, migration 016)

### Added — the CRM engine (migration `016_customers_offers.sql`, CLI-applied + sentinel)
- **`customers`** — identity keyed by `(tenant_id, phone)`. The auto-enrich trigger `trg_orders_touch_customer` upserts the guest the moment any order carries a phone: the counter types a number once and the CRM remembers forever. An edited CRM name always wins over a newer ticket's spelling; a blank name gets filled.
- **`offers`** — percent or flat discounts with a `min_order_amount` floor, `is_active` pause switch, and a CHECK that forbids percent offers above 100 (an offer can never pay the guest).
- **`offer_redemptions`** — the ledger. `UNIQUE(order_id)` makes one-offer-per-order replay-proof (015 ledger pattern); `trg_offer_redemptions_usage` RECOMPUTES `offers.usage_count` from the ledger on insert/delete/update, so a cascade-deleted order heals the counter instead of leaving a phantom use.
- **`v_customer_stats`** — visits/spend are never stored: the view derives them from the orders ledger (`security_invoker = on` so tenant RLS applies), only PAID, non-cancelled tickets count. Nothing to drift.
- **`sp_public_offers(p_slug)`** — SECURITY DEFINER RPC feeding the guest menu banner; guests never touch the offers table directly.
- **Realtime**: `customers` + `offers` on `supabase_realtime` (idempotent membership check).

### Added — the counter discount flow (cart ↔ DB honest math)
- Order drawer gains **Phone** ("books the guest in CRM") and an **Offer** dropdown of active offers; below-minimum offers show their floor and stay unselectable.
- Live totals: discount row in green (`OFFER` badge), **GST recomputed on the discounted base**, total = subtotal − discount + GST. The same math runs in `createOrder`, which now writes `customer_phone`, `discount_amount`, and the redemption ledger row atomically with the ticket.
- A placed ticket clears name/phone/offer — the next ticket never inherits the last guest's discount silently.

### Added — the Guests screen (nav: `Guests`, between Inventory and Floor)
- **Guests tab**: KPI strip (guests on the books / regulars 2+ paid visits / VIPs ≥5 visits or ₹5,000 paid / top spender), search across name+phone+notes+email, ledger-honest rows (Visits grey at 0, Spent green when paid, last-visit "today 10:55 am"-style), deterministic tone-ring avatars by phone hash, tier chips (NEW/REGULAR/VIP), two-tap delete, add/edit dialog with phone validation.
- **Guest detail drawer** (slide-over, Esc-closable): paid visits / paid total / all tickets from the ledger, plus the guest's recent tickets with items, status, green −discount and total.
- **Offers tab**: card grid with discount medallions (gold % / sage flat), gold spine + LIVE chip on active offers, "used N×" from the ledger, pause toggle, edit, two-tap delete, honest empty states both tabs. Live chip + 30s poll, tenant-retry remount, skeletons.

### Added — guest-side marketing (no login, capability-safe)
- The QR menu (`/menu/:token`) renders a **gold offers banner** (scrollable chips: medallion + title + rule + min + description) fetched via `sp_public_offers` — best-effort: a failed fetch hides the banner, never blocks ordering.

### QA — engine + money loop proven on the live cloud
- `scripts/qa-crm-e2e.mjs`: 7/7 PASS — auto-enrich creates the guest from an order; unpaid ticket ⇒ visits=0 while orders_placed=1; payment ⇒ visits=1/spent=210; redemption insert recomputes usage; second redemption per order rejected (UNIQUE); deleting the order cascades the ledger AND heals usage_count to 0.
- Browser E2E as the owner: offers tab renders the seeded demo offers → counter order #48 (2 × Flat White ₹440, Maya Iyer, 98765 43210) + "₹50 off over ₹300" → drawer showed −₹50 / GST ₹19.50 / **total ₹409.50** → placed → inbox shows "for Maya Iyer · ₹409.50" → DB verified (discount_amount=50, redemption row, usage_count=1, customer row auto-created) → Bills UPI charge → Guests screen flipped to VISITS 1 / SPENT ₹409.50 / top-spender card → guest QR menu shows both offer chips.
- **Kept as the owner's try-it-now demo** (Task 42 inventory-demo precedent): Maya Iyer + paid ticket #48 + the two demo offers ("Morning flat white — 10% off", "₹50 off over ₹300"). Fixture scripts clean up after themselves.

### Notes
- NOVA parity remaining: guest i18n, PWA (manifest + SW), shared csv lib, COGS wiring into Reports/Close-out.
- Migration 013's sentinel re-fired an idempotent re-apply during 016 provisioning (harmless; engine strings intact).

## [5.4.0] — 2026-10-02 — Inventory: the stock moves with the pan (NOVA inventory parity, migration 015 engine)

### Added — the deduction ENGINE (migration `015_inventory_engine.sql`, CLI-applied + sentinel)
- **Collaboration note**: the `inventory_items` shelf (location_id / current_stock / reorder_point / cost_per_unit) was applied to the live cloud out-of-band by the parallel round (no migration file); 015 **adopts it as canonical** and adds the missing moving parts. `inventory_items` was also missing from `supabase_realtime` — 015 subscribes both tables.
- **`recipe_lines`** — what ONE serve of a menu item consumes (ingredient + qty, UNIQUE per item+ingredient).
- **`stock_deductions`** — the append-only LEDGER keyed **UNIQUE (order_id, inventory_item_id)**: replays can never double-deduct a ticket. Stock going negative is allowed (real cafes oversell) — the UI shows it red.
- **`trg_orders_deduct_stock`** — fires on `orders.status → 'preparing'` (and ONLY that transition): a ticket burning stock is the kitchen actually starting it — not placement (counter declines would phantom-burn stock), not completion (the food already left). One atomic CTE: insert ledger rows ON CONFLICT DO NOTHING, then apply exactly the rows it inserted. **SINGLE-ENGINE RULE** documented in the migration: any other stock-decrementing code must check this trigger first.
- RLS two-policy shape (superadmin/tenant) on both new tables; validation block hard-fails unless tables+trigger+publication are whole.

### Added — Inventory screen (`src/components/inventory/InventoryScreen.tsx`, nav "Inventory", Package icon after Reports)
- **Stock tab** — level bars vs reorder point (green Healthy / amber Low / red Out), restock dialog with live "new level" preview, edit dialog (name/unit/current/reorder/cost), two-tap delete, and a **stat strip**: ingredients, low stock, out of stock, **stock value (Σ qty × cost)**. A low-stock alert banner appears only when something needs attention.
- **Recent deductions feed** — the engine's audit trail on the board (ingredient, −qty, time), so the counter can SEE stock moving as tickets fire. Realtime (`inventory-<tenant>` channel) + 30s safety poll + Live chip.
- **Recipes tab** — per-menu-item editor: pick an item, add ingredient + qty-per-serve rows, inline qty edit, save/discard with unsaved-changes guard, and honest copy: an item without a recipe moves no stock.

### Proven end-to-end on the live cloud (DB + browser)
- Engine: SKU "Coffee beans" 5,000 g + Flat White recipe (20 g/serve) → guest QR order ×2 → `preparing` → **stock 5,000 → 4,960, ledger row exactly 40 g** → replay-proof verified (status reset to pending and re-fired: stock unchanged, still 1 ledger row) → deleting the order cascades its ledger rows.
- UI: ingredient created via the dialog (Coffee beans / g / 5,000 / 500 / ₹1.80), recipe saved via the Recipes editor (qty edit 18→20 verified in DB), live board showed **4,960 / reorder 500 · Healthy** with the "−40 g · 10:28 AM" feed row; stock value ₹8,928 = 4,960 × ₹1.80. Screenshots: empty shelf → stocked card → live deduction.
- The demo SKU + recipe are KEPT on the QR Flow Cafe tenant as the owner's try-it-now inventory demo.

### Housekeeping
- `scripts/db-setup.mjs` sentinel 015 (2 tables + trigger + publication = green). Parallel-collision handled by protocol: their out-of-band shelf adopted, my conflicting 014 file deleted and renumbered engine-only 015.

## [5.3.3] — 2026-10-02 — Reports: sales, items and hours over real ranges (NOVA manager-reports parity)

### Added — Reports screen (`src/components/reports/ReportsScreen.tsx`, nav "Reports", BarChart3 between Close-out and Floor)
- **Range pills** — Today / Last 7 days / Last 30 days / All time, computed in **IST calendar days** (same day math as Close-out; today's window ends at IST midnight). The Dashboard answers "right now"; Reports answers "where does the business stand".
- **Headline strip (6 cards)** — gross sales, GST collected, net (ex-GST, discounts respected), orders (with a "N cancelled excluded" sub-line — cancelled tickets never touch money figures), average ticket, items sold (units).
- **Sales by hour** — 24-hour recharts bar chart (gross ₹ per IST hour across the whole range), **peak hour auto-highlighted in gold** both on the chart and in the subtitle; the "when does the cafe actually earn" view.
- **How money arrived** — donut + legend of paid tickets by method (UPI / Cash / Card) with per-method totals and ticket counts, plus an **Unpaid sink line** (₹ and ×count) when money is still out.
- **Top items** — best sellers by revenue with units, **gold share bars**, flame badge for #1, top 8 inline (+N more noted), and **CSV export** of the full ranking (rank / item / units / revenue / share %, UTF-8 BOM, injection-safe escaping).
- **Service mix** — dine-in / takeaway / delivery split with count · ₹ and share meters.
- Honest data footer: aggregated client-side from the most recent 500 tickets (a cafe month) — the cap is stated, never silent. Empty state + skeleton + tenant-error retry (attempt-remount pattern).

### QA — proven live with a 12-ticket, 3-day fixture spread (then cleaned)
- Staged orders #33–#44 across 3 IST days, 5 items, 3 payment methods, 1 cancelled, 1 unpaid, 3 service types; cross-checked every aggregate against hand math (gross ₹10,888.50 = 11 valid tickets; GST ₹518.50 = 5% of net; peak 9a = ₹2,562 = three morning tickets; mixes match staging). Range switch (7d → today), CSV download inspected, zero console errors. Fixture orders/items deleted after; tenant back to zero.
- One fixture-side lesson recorded: the first staging run dated "past" tickets into the future — the screen correctly excluded them, proving the IST window math from the other side.

### Housekeeping
- Repo-rename sweep (owner renamed the GitHub repo to `servepoint`): README clone instructions + compact.md run-it block now use `OmKardile/servepoint.git`; historical docs left untouched (history is history). `origin` already points at the new URL since Task 39.

## [5.3.2] — 2026-10-02 — EOD Close-out: the day closes with a z-report (NOVA reconcile parity)

### Added — Close-out screen (new nav item between Bills and Floor)
- **Day stepper** (`EodScreen`): ‹ › steps calendar days in **Asia/Kolkata** (NOVA TZ discipline — day windows are `[00:00, next 00:00)` IST, not UTC), future days disabled, quick **Today** jump, last-refreshed stamp, manual refresh.
- **"Right now" strip** (today only, 20s auto-refresh): tickets in the kitchen (pending+preparing), unpaid tickets · ₹, **late prep** (preparing ≥10 min — the KDS amber SLA mirrored at close-out).
- **Day summary cards**: Orders (with cancelled count), Gross (with GST collected), **Paid** (payments-ledger take — the drawer's number), Unpaid (tickets · ₹), Avg ticket.
- **Payment mix**: cash / UPI / card rows with proportional bars and share %, straight from the `payments` ledger.
- **Order ledger**: one line per ticket — IST time, #, source chip (**QR** via `client_operation_id` vs counter), guest, status, pay state, total.
- **Printable z-report**: receipt-style strip (store name, day, orders/cancelled, gross, GST, PAID/UNPAID, method split, printed-at + operator) rendered through a **hidden iframe** — popup blockers can't eat it; button disabled on empty days. Screenshot-verified states, desktop + 390px.
- **Honesty probe**: tickets marked paid with **no payments-ledger row** surface a warning ("recorded outside the payment engine; not counted in PAID") — the ledger is truth, order flags are not (verified live with a probe order, then removed).
- Zero-migration round: reads only existing tables (`orders`, `payments`); RLS-gated; no new RPCs.

### Verified — counter-gate ladder + money loop, end-to-end on the live cloud
- Guest QR order #14 (Flat White Large + Extra shot, ₹346.50): landed `new` → **KDS blind** ("Queue is clear") → counter inbox showed the ticket (found the Walk-in-badge bug here; fix already in 5.3.1) → **Ok** → `pending` → KDS **Queued** → Start preparing → Mark ready → Complete → **T1 auto-released** (`available`, `active_order_id` cleared — closes the prior round's truncated verification) → UPI charge → **guest track flips PAID** with the itemized bill.
- Test residue cleaned (#14 + its payment row); the demo tenant stays pristine for the owner's try-it-now link.

## [5.3.1] — 2026-10-02 — Counter-gate proven live; Bills get unpaid-priority + CSV (NOVA Orders-page parity)

### Added — Bills: the counter's money view gets teeth
- **Unpaid-first priority** (`BillsScreen`): money-outstanding bills float to the top of the list (then paid, then cancelled; newest within each group) — the counter never loses sight of what's owed. On load / filter change the detail pane auto-selects the **most urgent** bill. A gold **"N unpaid" chip** beside the title shows money outstanding across everything loaded (filter-independent).
- **CSV export**: a header button exports the **currently filtered** list (what you see is what you export) — order #, placed-at, status, payment + method, type, customer, table, full item summary (qty × name (variant) [+ add-ons]), subtotal/GST/discount/total, notes. UTF-8 BOM for Excel, bare decimals for spreadsheet formatting, and **CSV-injection-safe cell escaping** (leading `=+-@` neutralized) so a hostile note can't become a formula. Verified live: 3-order fixture exported in priority order.

### Verified — the counter is the gate, end-to-end (independent re-proof on the live cloud)
- **Migration 013 engine live**: `sp_advance_order` accepts `new → pending` (the inbox Ok) and `sp_record_payment` auto-advances un-started tickets (money in hand ⇒ cook).
- **Inbox Ok-gate E2E** (agent-browser): a QR guest ticket (order #16, Flat White Large ×2 + Extra shot = ₹693, Aarav, INBOX-DIAG) appeared **only** in the counter inbox with a `QR · Table` badge, full ticket detail (items/variant/add-on/cook-note/order-note) and a Live chip → **"Ok — fire to kitchen"** emptied the inbox (the band disappears at zero) and the KDS received the ticket in the **Queued** column (`pending`) — the KDS never rendered the `new` state. Screenshots: inbox ticket, empty inbox after Ok, KDS queued.
- **Table hold/release trigger double-proven** on isolated diagnostic tables: order created → table `occupied` + `active_order_id` set; order cancelled → table **auto-released** (`available`, FK cleared) with the status hop stamped in `order_status_history`. `sp_create_public_order` validates before insert (a malformed-qty call returned `BAD_QTY` and left **zero residue**). `sp_advance_order` correctly refuses unauthenticated bare-DB callers (42501 — membership guard, not a bug).
- **Badge bug found & fixed**: `orders.table_session_id` is declared in `types.ts` but no migration creates it, so the inbox's QR-vs-walk-in badge heuristic never fired — every QR ticket showed "Walk-in". Heuristic switched to `order.table_id` (guest QR orders always carry a real table FK; counter walk-ins don't).

### Housekeeping
- All QA fixtures (diagnostic tables + test orders #15–#19) deleted; the QR Flow Cafe demo tenant is back to a clean state (T1 available, zero orders) — the owner's try-it-now link still works: `/t/2e65bd6858a063cf41614b1b1519b385`.

## [5.3.0] — 2026-10-02 — The main flow is whole: menu depth, live floor, guest QR ordering (Messages removed)

### Removed — Messages (owner directive: "remove the messages system; it's a point of sale app")
- The Messages screen, its nav entry and the `messages` Section are gone. A POS's surface area now maps 1:1 to running a cafe: Dashboard, Food & Drinks (counter POS), Kitchen (KDS), Bills (money), Floor (tables), Menu (what you sell), Settings.

### Added — menu with variants & add-ons (owner directive: "where's create menu item with variants or addons")
- **Migration 012** (`012_menu_variants_guest_qr.sql`, applied to the live cloud from the CLI): `menu_variants` (per-item options with a price delta), `addons` (tenant-level library), `menu_item_addons` (which extras an item offers), `order_item_addons` (**name+price snapshots on tickets** so bills and KDS never depend on live menu rows), and `orders.client_operation_id` with a per-tenant partial unique index — **replaying a checkout can never double-order**.
- **NEW `src/components/menu/MenuScreen.tsx`** (nav "Menu", BookOpenText): categories (add/rename, auto sort), items with name/price/description/veg/availability (live toggle), search, and a per-item **Options modal** — variants (name + ±₹ delta, one pick at order time) and the allowed add-on checklist (chips flip instantly, diff-free rewrite of the join rows). Add-on library strip on the page (add/delete with two-tap confirm). What lands here is exactly what the counter POS and the guest QR menu render — one menu, every surface.

### Added — Floor: the live table board (migration 011)
- **Migration 011** (`011_floor_security_realtime.sql`): **closes two anon-read RLS leaks** inherited from the early schema — `dining_tables` public policy was `USING (true)` (any anon client could read every tenant's tables *including permanent QR tokens*) and `table_sessions` ended with `OR status = 'active'` (every active session token readable cross-tenant). Both are now header-gated token matches; guests go through SECURITY DEFINER RPCs only. Also puts `dining_tables` + `table_sessions` on the `supabase_realtime` publication, and adds **`trg_orders_sync_table`**: an order with a `table_id` holds its table (`occupied` + `active_order_id`), completing/cancelling releases it — manual staff actions are never fought back.
- **NEW `src/components/floor/FloorScreen.tsx`** (nav "Floor", Armchair): sections grid, status machine (Available / Occupied / Reserved / Billing), stat strip with seat counts, per-card guest link (`/t/<qr_token>`) + raw token copy, lifecycle actions (Seat / Reserve / Start billing / two-tap Free), add-table dialog (double-dispatch guarded), realtime Live chip + 30s safety poll.
- **New Sale links real tables**: the order pad's free-text table input is now a live picker from `dining_tables` (occupied tables disabled; walk-ins still allowed) — orders carry the real `table_id`, notes still feed the KDS context line.

### Added — the customer side: QR → menu → order → track (owner directive: "bring order from the customer side table link through QR")
- **Guest surfaces** (public plain-path routes, zero login — capabilities only): **`/t/:qr_token`** gate (validates the printed token via `sp_resolve_table_qr`, opens the 10-minute ephemeral session through 002's `issue_ephemeral_table_session`, redirects to the menu) · **`/menu/:qr_token`** (`sp_get_public_menu` bundle: brand hero, table chip, live **session countdown ribbon**, search, per-item inline customizer — variant radios, add-on checkboxes, cook note, qty stepper with live line price — cart that survives refresh in sessionStorage (identity only), GST-transparent drawer, place order) · **`/track/:orderId`** (the pager: `sp_get_public_order` polled every 10s, status stepper, ready chime + vibration with persisted mute, live tab title, bill with PAID/DUE-AT-COUNTER, copy tracking link).
- **`sp_create_public_order`** (SECURITY DEFINER): resolves the table by its **permanent token** (never trusts client table ids), validates tenant status, **recomputes every rupee server-side** (base + variant delta + add-ons, GST 5%), snapshots items + add-ons, inserts as status `new` (the counter is the gate — kitchen never sees a guest ticket until staff act), and is **idempotent per `client_operation_id`** (replays return the original order). **`sp_get_public_order`** exposes a scoped tracking projection; the anon key can still read zero rows directly.
- **`src/lib/guest.ts`** — the guest data layer: RPC wrappers + sessionStorage identity cache (resolve result, session token, cart). Guests never pay online — the bill says what to settle at the counter.

### Proven end-to-end on the live cloud (agent-browser, both sides)
Menu: variant + add-on created and linked → rendered on the guest menu instantly. Floor: T1 created → guest link copied → **guest flow on a phone-sized viewport**: gate → 10:00 session ribbon → customize (Large +₹50, Extra shot +₹60, cook note) → live-priced cart ₹330 → **order #9 placed** → **T1 flipped Occupied with "Meera" on the Floor board** (011 trigger + realtime) → KDS New column received the ticket → Start preparing → Mark ready → **guest track page flipped to "Ready" live (tab title `#9 · Ready — ServePoint`)** → Complete → Bills charge UPI ₹346.50 → **track bill chip flipped PAID**. Server-side pricing verified in the DB (220 + 50 + 60 = 330, GST 16.50, total 346.50). Screenshots: guest menu 390px, track 390px, Floor 1440px.
- Fixed en route: MenuScreen/FloorScreen double-dispatch guards (busyRef — a doubled variant row proved the need); FoodDrinksScreen table picker; `Order` type import.
- Housekeeping: the leftover "QR Flow Cafe" QA tenant from an earlier round was reset to a clean demo (orders/sessions wiped, duplicate variant removed, T1 free) — its menu + table are kept as the owner's try-it-now demo: open `/t/2e65bd6858a063cf41614b1b1519b385` in the preview to walk the guest flow.

### Verified
- `tsc --noEmit` 0 errors; lint clean; migrations 001→012 sentinel-green from CLI (`db-setup.mjs` covers 010/011/012 with publication + trigger + policy + table sentinels); dev.log HMR-only. Login screen untouched (ADR-0016).

## [5.2.2] — 2026-10-02 — Render link rebranded: `servepoint-tsos.onrender.com`

### Changed — blueprint service name (owner request: the render link should say "servepoint")
- **`render.yaml`**: service renamed **`tsos-pos` → `servepoint-tsos`** — Render derives the default URL from the service name, so the deployment now lives at **https://servepoint-tsos.onrender.com**. The subdomain was chosen by live probe, not guesswork: `servepoint-tsos.onrender.com` answered with Render's clean "service not found" (unclaimed → we get the exact name), while bare `servepoint.onrender.com` connected but never responded (a claimed/limbo record — applying under it would have appended a random suffix, defeating the whole purpose). The blueprint header documents the rename and its one operational consequence; the legacy "The Cafe Operating System" title line is updated to **ServePoint — smartPOS**.
- **Re-provision caveat (expected behavior, not a regression)**: the old service was already applied and live (`tsos-pos.onrender.com` returned 200). Renaming a service re-provisions it on the next blueprint sync — the old URL is **retired, not redirected**. Bookmarks and any printed QR material must move to the new link; every other service property (build command, routes, headers, env vars) is re-created identically because the blueprint is the source of truth. Owner to-do once this lands: click **Apply** on the Render blueprint (or let blueprint sync run on push), confirm the new `servepoint-tsos` service goes green, and delete the old `tsos-pos` service if Render doesn't remove it automatically.
- **Docs**: README deployment section + ADR-0008 update note aligned. Historical records (older CHANGELOG bodies, compacts, worklogs) intentionally still say `tsos-pos` — they describe the past, and rewriting history is not the job of a changelog.

### Verified
- Blueprint YAML structure intact (runtime/build/routes/headers/env blocks untouched apart from the name + provenance comment); no app code changed; login screen untouched (ADR-0016).

## [5.2.1] — 2026-10-02 — Public surfaces: /showcase + /index-help

### Added — two standalone public pages (owner request: "check /showcase /index-help and develop them")
Neither route existed (only historical mentions from the pre-rebuild era) — both are now real product surfaces, routed on the plain path via the SPA fallback (the POS stays king at `/`):
- **`/showcase`** (`src/components/pages/ShowcasePage.tsx`) — the product tour: Instrument-Serif italic hero ("Run the counter, the kitchen and the books — from one screen."), 3D brand render as a hero card (new web-weight derivative `src/assets/brand/hero-3d.jpg`, 1600px q85 ≈ 48 KB — ~20× lighter than the 1.1 MB master, added as step 4 of `build-brand-assets.mjs` so it regenerates with the rest), six feature cards (multi-tenancy, guarded order engine, live KDS, payments ledger, team messaging, realtime), a deep-teal engineering strip (stack chips + three stat blocks: 10 migrations / 2 engine RPCs / 0 mock paths), and closing CTA.
- **`/index-help`** (alias `/help`) — the getting-started guide: three roles explained (operator / owner / staff), the golden path as six numbered steps, owner + operator operational notes, and a five-question FAQ accordion (single-open behavior; data isolation, double-charge guard, realtime, password reset). No credential is ever printed — accounts are provisioned, by design.
- **Routing**: `usePathname()` reads the browser path once in `App.tsx`; `/showcase` and `/index-help` render before auth/session logic (no session flicker, fully unauthenticated). Footer nav on both pages links App / Showcase / Help; sticky-footer rule honored (`min-h-screen flex flex-col` + `mt-auto`).
- **Discoverability**: Support screen gained a "Product links" card (Megaphone icon) with buttons to both surfaces — the auth screen stays untouched (ADR-0016).

### Verified
- tsc 0 errors; lint clean. agent-browser E2E: /showcase renders at 1440 + 390 (hero, features, nav); "How it works" navigates to /index-help; FAQ accordion opens/closes correctly; `/` still renders the frozen login byte-identical. Screenshots saved.

## [5.2.0] — 2026-10-02 — Kitchen Display System: the live rail (NOVA roadmap #1)

### Added — Kitchen screen (owner + staff)
- **`src/components/kitchen/KitchenScreen.tsx`** — a real KDS rail in the brand palette: four stage columns (New → Preparing → Ready to serve → Completed), stat strip with per-stage counts, "oldest active ticket waiting" clock, and today-only scoping (completed capped to newest 12 with an overflow note; cancelled orders leave the rail but count in the context line).
- **Order cards** built for the pass: bold `#N` + customer, Dine-in/Takeaway/Delivery chip, live per-second elapsed timer that escalates green → amber (10 min) → red (20 min) and greys out when terminal, qty × item lines with per-item notes (`↳ …`), parked table/guest context from notes, and a payment chip on completed cards (**Paid** / **Unpaid · bill at counter**).
- **Engine actions on the card**: Start preparing → Mark ready → Complete, all through the guarded `sp_advance_order` RPC (legal-transition map server-side); cancel is a two-tap confirm (no browser dialogs) also via the engine. Busy state per card, error banner with retry.
- **New-order chime**: WebAudio two-tone ping when a fresh `new` order appears on the rail, persisted mute toggle (`sp.kds.sound`), unmute gives an audible confirmation and unlocks the AudioContext on the user gesture.
- **Navigation**: "Kitchen" with a ChefHat icon between Food & Drinks and Messages (`Section` union extended; breadcrumb + header search work as everywhere else).

### Added — realtime (migration 010, applied to the live cloud from the CLI)
- `supabase/migrations/010_realtime_kds.sql` (additive, idempotent, guarded verification block): puts `orders` + `order_items` on the `supabase_realtime` publication — the first tables in the project to stream. Realtime enforces the tables' SELECT RLS, so subscribers only ever receive their own tenant's rows.
- **`subscribeOrdersRealtime()`** in `lib/api.ts`: postgres_changes channel (`kds-<tenantId>`) filtered per tenant; any event triggers a debounced (250 ms) refetch — no client-side server-state duplication. Connection chip in the KDS header: **Live** (pulsing dot) / Connecting… / **Polling 30s** fallback (plus a 30 s safety poll in all states).
- `scripts/db-setup.mjs` applies 010 with a `pg_publication_tables` sentinel — migrations now 001→010, all CLI-applied.

### Proven end-to-end on the live cloud (agent-browser, as a freshly provisioned owner)
Wizard provision "KDS Rail Cafe" (009 trigger + claim worked first try) → owner sign-in → menu seeded via REST → **golden path in UI**: Food & Drinks cart (1× Flat White + 2× Masala Toastie, ₹504) → Place Order → KDS card appears in New with items, `Table: T4 · Guests: 2`, ticking timer → Start preparing → Mark ready → Complete (each hop verified in its column) → Bills → Charge UPI → **Paid + Payment recorded** → KDS card flips to the **Paid** chip live (payment UPDATE = realtime ping → refetch). **Realtime injection test**: two orders created via raw REST while the board sat untouched appeared on the rail by themselves (New 1 → 2) and vanished into the "cancelled today" counter after engine-RPC cancels. Desktop (1440) + mobile (390) screenshots.
- Bug found & fixed during QA: the KDS root lacked the shell's screen padding (`p-4 lg:p-5`) — the h1 hugged the sticky header; matches Messages/Bills spacing after the fix.
- Cleanup: test tenant + provisioning audit row + both test auth users deleted via pooler (also purged the orphan `smoke.owner@coolkafe.in` left by an earlier round). Cloud census: 1 tenant (CheeseBurg), 0 orders, 0 payments, 2 auth users / 2 tenant_users.

### Verified
- `tsc --noEmit` 0 errors; lint clean; migration 010 sentinel-green from CLI; dev.log HMR-only. Login untouched (ADR-0016).

## [5.1.3] — 2026-10-01 — Test → Debug → Retest: live-cloud E2E round (owners can finally sell)

### Live-cloud E2E battery on the real 007 engine (REST, superadmin probe) — 11/11 PASS
New probe (`tool-results/probe-live-engine.mjs`, gitignored) ran the REAL guarded RPCs on the cloud: order create (201, `new`, DB-numbered) → `sp_advance_order` ×2 → `sp_record_payment` upi ₹240 → order flips completed/upi → ledger row verified → trail rows actor-stamped → backward transition rejected → **double payment rejected (new 008 guard)**. Cleanup via pooler (FK cascade) — cloud pristine.

### Fixed — THREE real bugs the probe/UI round uncovered
1. **Double payment accepted (money bug)** — `sp_record_payment` guarded only cancelled orders; a second charge on a paid order booked the money twice. **Migration 008** re-creates the function with `Order has already been paid` (guard verified live: rejected with the exact message).
2. **Owners could never sell (RLS hole since provisioning was born)** — the wizard created the tenant + auth user but NEVER the owner's `tenant_users` membership row; `tsos_is_tenant_member()` / `sp_tenant_member()` were false for every owner, all owner reads silently rode on public storefront policies, and **every owner write returned 42501** (found as: location insert 403 while placing the first real UI order). **Migration 009**: (a) trigger on `tenants` INSERT seeds the owner membership keyed by `owner_email`; (b) definer RPC `sp_claim_tenant_memberships()` stamps `user_id` onto email-matching rows at sign-in (covers the wizard's tenant-before-auth-user ordering); (c) client calls the claim after every cloud grant. Live owners (CheeseBurg + test tenant) backfilled from the CLI. Root cause proven by policies dump + JWT metadata inspection before touching anything.
3. **`createOrder` sent a phantom `guest_count` column** (doesn't exist in 001) → 400 on every order. Table/guest context now parks in `notes` (`Table: … · Guests: …`) until table-sessions ship.

### Full UI golden path re-proven (agent-browser, as a REAL provisioned owner)
Wizard provision "Test Round Cafe" ("Saved to cloud") → owner sign-in → Food & Drinks (seeded menu) → cart → Place Order → **order in cloud (201)** → Bills: Start preparing → Mark ready → Charge UPI ₹126 → **Paid + Payment recorded** → ledger row (`upi, 126, testround.owner@…`) + append-only trail actor-stamped — desktop + mobile screenshots. Test tenant + auth user then deleted; cloud pristine (1 tenant, 0 orders).

### Verified
- `tsc --noEmit` 0 errors; lint clean; migrations 001→009 applied from the CLI (sentinels green); dev.log clean. Login untouched (ADR-0016).

## [5.1.2] — 2026-10-01 — "EXECUTE SQL FROM CLI" delivered: migration 007 is LIVE + crons begun

### CLI SQL channel opened (owner supplied the DB password in-chat)
- `SUPABASE_DB_PASSWORD='…' bun scripts/db-setup.mjs` connected via the session pooler as `postgres.gehjsxopcowmotgrrcgc` and ran the chain idempotently: 001–004 + 006 correctly SKIPped (sentinels matched), 005 re-applied (idempotent by design), **007 APPLIED ✓** — `payments` and `order_status_history` are now live production tables. The password exists only as a command-line env var — never in the repo, worklog, or any committed file.
- **Live REST proof**: `POST /rest/v1/rpc/sp_advance_order` on a dummy UUID → the engine's own `{"code":"P0002","message":"Order not found"}` (the guarded RPC exists and executes — no PGRST202 fallback anymore); `GET /rest/v1/payments` → **200 `[]`** (RLS working; tenant-free operator correctly sees zero rows). The Bills console's guarded RPCs now hit the real cloud; the legacy-write fallback is dead code on this project.
- From now on every migration applies from the CLI automatically — the owner never touches the SQL Editor again.

### Crons begun (owner directive — supersedes the "crons 0" standing order)
- A recurring 15-minute **webDevReview** job now drives autonomous rounds: status assessment + agent-browser QA → fix bugs or advance the NOVA roadmap (KDS board next) → worklog handover each round.

## [5.1.1] — 2026-10-01 — Official Brand Assets Applied (owner-supplied logos)

### Added — real ServePoint logos everywhere the temporary gold CookingPot glyph stood
The owner supplied the two official logos; both are now committed masters plus generated derivatives:
- **Flat brand mark** (`ServePoint POS Brand Mark.png`, 2172×724 RGBA, pre-keyed transparent) → trimmed **`src/assets/brand/lockup-light.png`** (full lockup for light surfaces — app Splash) and **`src/assets/brand/mark.png`** (icon alone, square-padded).
- **3D render logo** (`ServePoint POS Logo (1).png`, opaque near-black bg) → **`public/og-image.jpg`** (1200×630 social card).

### Brand surfaces updated
- **index.html**: first real favicon set (32 + 128 rounded cream app-icon tiles), apple-touch-icon (180 full-bleed cream), `theme-color` #0F3D3E, `og:image`/`twitter:image` wired to the 3D-render card.
- **Cafe sidebar + Platform sidebar**: temporary gold circle → sage #D9E2DD rounded tile holding the real mark (dark terminal + orange sun + cream base read perfectly on the dark teal rail); "ServePoint" wordmark text kept for crispness.
- **Splash**: temporary glyph + text → the full flat lockup.
- Login screen untouched — ADR-0016 freeze respected (its text wordmark stands until the owner explicitly unfreezes).

### Tooling & provenance
- **`scripts/build-brand-assets.mjs`** regenerates every derivative from the committed masters (`docs/design/servepoint/brand/src/`, owner's originals preserved) — `bun scripts/build-brand-assets.mjs`; see `docs/design/servepoint/brand/README.md`.

### Verified
- `tsc --noEmit` → 0 errors; lint clean; browser E2E: favicon in the tab, both sidebars + Splash show the real mark, login pixel-identical, zero console/page errors. Crons 0 (owner standing order).

## [5.1.0] — 2026-10-01 — Order Engine: NOVA Discipline (payments ledger + status trail + guarded RPCs)

### Learned from the alternative NOVA build (owner directive + uploaded A-to-Z spec, web-nova v0.5.139)
The owner supplied the full spec of the alternatively-developed sibling project (41 tables, 51 migrations, guest QR → counter → KDS → money). Adopted its engineering rules for ServePoint's order engine this round: **writes to money paths go through SECURITY DEFINER RPCs**, **every status change leaves an append-only trail**, **payments are a ledger**, **the counter is the gate** (staff record money; the kitchen lifecycle is separate).

### Added — migration 007 (`supabase/migrations/007_order_engine_payments_history.sql`, additive, idempotent)
- **`payments` ledger**: one row per recorded payment (method cash/UPI/card, amount > 0 CHECK, confirmed_by_email, tenant-scoped RLS via `sp_tenant_member`).
- **`order_status_history`**: append-only trail written by a SECURITY DEFINER trigger on every `orders.status` change (actor email stamped from the JWT; no client INSERT policy exists — NOVA append-only pattern).
- **`sp_advance_order(order_id, to_status)`**: the only way statuses change — membership-checked, locks the row, enforces the legal-transition map (new/pending → preparing/cancelled; preparing → ready/cancelled; ready → completed; cancelled is terminal).
- **`sp_record_payment(order_id, method, amount)`**: the only way money is recorded — membership-checked, atomic ledger row + order flip to `payment_status='completed'`; cancelled orders can never be paid.

### Fixed — three latent New-Sale crashes found by checking the working
- `createOrder` wrote `status:'active'` — **violates migration 001's orders_status_check** on the live DB → now enters as `'new'`.
- `createOrder` omitted `location_id` (NOT NULL) and manually inserted `order_number` (GENERATED ALWAYS — DB-assigned only) → both would hard-fail; now auto-ensures a "Main Counter" location and lets the DB number orders.
- The charge flow wrote `status:'paid'` (also CHECK-illegal) → money fields only now; **Paid is derived from `payment_status='completed'`** (counter-gate display), kitchen status unchanged.

### Changed — Bills is now a full order console
- Charge/cancel go through the guarded RPCs (with honest fallback to the legacy write ONLY when 007 isn't applied yet — console-warned).
- **Kitchen lifecycle buttons** in the detail pane (Start preparing → Mark ready → Complete order) via `sp_advance_order`, with the engine's rejection messages surfaced verbatim.
- **Timeline**: the selected order's append-only status trail (who moved it, when, from → to).

### Verified — local Postgres 16.4 Supabase-replica harness, **15/15 PASS**
- Applied 001→007 on a fresh cluster: order create → preparing → ready → completed; ledger row (upi ₹84, actor stamped); order flips completed/upi; history trail = 3 transitions with actor emails; cancelled is terminal and unpayable; illegal transitions/unknown status/amount≤0/unknown method all rejected with clear messages; stranger (non-member) denied on RPC **and** sees 0 payments/history rows via RLS. `tsc --noEmit` 0 errors; lint clean; browser sanity clean; login untouched (ADR-0016).
- **Cloud apply (CLI)**: `SUPABASE_DB_PASSWORD='<db-password>' bun scripts/db-setup.mjs` — now applies 001→007 idempotently. (The DB password is owner-private and not present in this session's environment; the moment it's exported into the session, all future migrations apply automatically without the SQL-editor step.)

### NOVA gap map (roadmap for the next rounds)
KDS kitchen board · table floor + QR sessions · inventory movements (recipes → auto-deduction) · customers/CRM · offers/coupons · owner reports (sales/items/hours) · EOD reconcile + z-report · shifts & drawer · guest feedback · offline queue · realtime fan-out.

## [5.0.8] — 2026-10-01 — 006 Applied & Verified Live + Default Conversation Seeding

### Owner ran migration 006 — fix verified on the live cloud
- The owner pasted migration 006's verification output: the self-referencing `"Tenant owner manage staff members"` policy is **gone** and all six policies match the post-fix state exactly (notifications / conversations / conversation_messages on the `sp_tenant_member` helper; `tenant_users` on three definer-only policies).
- **Live REST proof**: operator password grant → 200; `GET /rest/v1/notifications` and `/rest/v1/conversations` → **HTTP 200** (was 42P17 before 006). Messages, Notifications and Settings → Team are unblocked.

### Fixed — tenants provisioned after 004 never got the default conversations seed
- Migration 004 seeds "Front of House" / "Kitchen" team conversations for tenants that existed at apply time; CheeseBurg (provisioned later) received none → Messages would show a correct-but-empty list.
- `provisionBusiness` now inserts the same two default team conversations (best-effort) for every newly provisioned tenant — mirroring 004's seed.
- **CheeseBurg back-seeded via REST (201)** in 004's exact shape; readback confirms both rows. Hit Retry on Messages → the two team conversations appear.

### Verified
- `tsc --noEmit` → 0 errors; lint clean; browser sanity clean (zero console/page errors). Login screen untouched (ADR-0016). Crons 0 (owner standing order).

## [5.0.7] — 2026-10-01 — Messages & Notifications Fixed: RLS Recursion (migration 006)

### Fixed — "infinite recursion detected in policy for relation tenant_users" (owner screenshots: Messages + Notifications)
- **Root cause** (proven on a local Postgres 16.4 with a Supabase `auth` stub — reproduced byte-identical `42P17` on all three surfaces, then fixed): migration 001's tenant_users policy `"Tenant owner manage staff members"` queried **tenant_users from inside a policy on tenant_users** — any statement against the table re-triggered its own RLS → Postgres aborted with 42P17. Migration 004's policies (notifications / conversations / conversation_messages) sub-queried `tenant_users` directly, so **every Messages, Notifications and Settings → Team read died**. Menu/order/bill surfaces were unaffected (they use SECURITY DEFINER helpers only) — which is why only these screens broke.
- **Migration 006** (`supabase/migrations/006_fix_rls_recursion.sql`, idempotent, touches no data): adds `sp_tenant_member(p_tenant_id)` SECURITY DEFINER membership helper (with the platform-superadmin override); **drops the self-referencing 001 policy** (003's definer-based `"owner manages tenant_users"` supersedes it, re-created with an `is_superadmin()` belt-and-braces); rewrites the three 004 policies onto the helper; pins `SET search_path = public` on every RLS helper function.
- **Honest, precise error copy**: `src/lib/dbErrors.ts` maps raw Postgres/PostgREST messages to actionable hints — the 42P17 case now tells the operator to run migration 006 in the SQL Editor (instead of the misleading "migration 004 not applied" note); missing-table cases get the 004→006 instruction. Wired into Messages (list + thread), Notifications and Settings → Team error cards.

### Verified (local Postgres 16.4 harness + live REST + browser)
- Local Supabase-replica harness (portable PG 16.4 + `auth.jwt()`/`auth.uid()` stubs + role `authenticated`): **reproduced** 42P17 on conversations/notifications/tenant_users → applied 006 → **6/6 PASS**: Messages list, Notifications list, Team read, chat send (INSERT), mark-all-read (UPDATE), and tenant isolation intact (non-member sees 0 rows). 006 re-run = idempotent ✓ (the harness also caught and fixed a duplicate function-attribute bug in 006 before it reached the owner).
- Live REST: operator password grant → **200** (auth path healthy); `GET /rest/v1/{notifications,conversations}` → the exact `42P17` body captured, confirming the live diagnosis.
- Browser E2E: app loads clean, zero console/page errors; the owner's CheeseBurg workspace confirmed live in the cloud (provisioned minutes earlier — they hit exactly this recursion). Login screen untouched (ADR-0016).

### Owner action (10 seconds, one time)
- **Supabase Dashboard → SQL Editor → paste the contents of `supabase/migrations/006_fix_rls_recursion.sql` → Run → back in the app, hit Retry.** Alternative: `SUPABASE_DB_PASSWORD='<db-password>' bun scripts/db-setup.mjs` (db-setup now applies 006 automatically). Full write-up in `docs/CREDENTIALS.md`.

## [5.0.6] — 2026-10-01 — Rebrand: ServePoint — smartPOS Everywhere (owner directive)

### Changed
- **Product renamed TSOS → ServePoint across the entire living tree** (owner: "i like the new branding — ServePoint - smartPOS — change everywhere"): UI strings, `index.html` title/og tags + honest meta description (the old one advertised KDS/inventory/loyalty features removed in v5.0.0), `metadata.json`, `package.json` name (`react-example` → `servepoint`), sidebar footer (© 2026 ServePoint · smartPOS), operator display name (`ServePoint Developer` — app constant, migration 005 seed for future reprovisions, and the LIVE cloud `auth.users` metadata updated via pooler), and 20+ living docs (README, help, technical/business docs, design reference, all forward-looking specs, render.yaml comments, design-tokens.json).
- **Deliberately NOT renamed** (identifiers/history, not branding): the `admin@tsos.dev` operator email (documented credential, seeded in cloud auth), live DB function names `tsos_is_tenant_*` (referenced by applied RLS policies), the QR salt, `tsos_auth_session` localStorage key, the Render service name `tsos-pos` (renaming it in render.yaml would re-provision the service), the frozen login screen (ADR-0016), and historical records (CHANGELOG entry bodies, ADRs, worklogs, compacts).

### Governance — GitHub repo rename
- Owner renames `OmKardile/tsos-alt` → `OmKardile/servepoint`; pushes continue on the old URL until it errors (GitHub redirects renamed repos), then remote + doc references flip to the new name.

## [5.0.5] — 2026-10-01 — "Workspace not found" Diagnosed + One Actionable No-Workspace Screen

### Diagnosed — owner screenshots (3× "Workspace not found in the cloud" + one password-grant 400)
- **Cloud state verified via pooler (read-only)**: `tenants: 0` — the owner's business never reached the cloud. Their earlier screenshot showed the **pre-5.0.2 wizard copy** ("provisioned locally; run it on Supabase…"), proving the run happened on a stale build whose cloud writes failed — the business exists only in that device's local registry.
- **The 400 explained**: registry-first sign-in replays the same credentials against Supabase Auth (the silent cloud link that earns the JWT for RLS). For an email with **no cloud auth account** (`cheeseburg@gmail.com` never landed — confirmed absent from `auth.users`), that attempt returns 400. It was harmless but repeated on every sign-in.

### Fixed
- **One unified "No business workspace yet" screen at the shell level** (`NoWorkspaceScreen`): when a signed-in owner/staff account can't resolve a tenant in the cloud, `CafeApp` now renders a single honest, actionable state — the account email, why it happens, a 3-step fix (sign in as the operator → Platform console → + Add Business on the current version → sign back in with the wizard-shown password), Retry + Sign out. Replaces the seven per-screen "Workspace not found" error cards (which remain as defense-in-depth for transient errors).
- **Grant-failure memory**: `tryLinkCloudSession` now distinguishes `linked` / `no-account` / `error`; a definitive rejection sets `cloudGrantFailedAt` on the registry entry so later sign-ins **skip the doomed attempt** (console stays clean). Cleared automatically on re-provisioning or when a grant succeeds.
- **Duplicate grant attempt removed**: the bootstrap-operator fallback path no longer re-fires the cloud grant that step 2 attempted moments earlier (previously up to 2× 400s per operator sign-in when auth hiccuped).
- **Accurate not-found copy** in `useTenant` (migrations are applied; the actual cause is the business isn't in the cloud) + `reloadKey` so the shell's Retry actually re-resolves.

### Verified (browser E2E at 127.0.0.1:3000)
- Ghost registry-only owner (no cloud user): sign-in → **NoWorkspaceScreen** with exactly ONE 400 grant (first attempt), second sign-in → **zero** token requests (memory works), Retry/Sign out functional.
- Operator sign-in → exactly one 200 grant → Platform console.
- Golden path re-proven on the current build: wizard provisioned "Verify Workspace Cafe" (+ owner `verify.owner@coolkafe.in`) → "Saved to cloud" → owner sign-in → workspace resolves (Dashboard shows the business; Food & Drinks + Bills load cleanly; mobile 390px shell intact). Test data fully deleted afterwards — cloud pristine (tenants 0 / subscriptions 0 / audit 0 / auth.users back to operator + smoke owner). `tsc --noEmit` → 0 errors.
- Login screen untouched (frozen per ADR-0016).

## [5.0.4] — 2026-10-01 — Login Screen Restored to the Figma & Frozen (ADR-0016)

### Fixed — "u deleted the damn log in button on screen"
- **Root cause**: the v5.0.0 rebuild pass missed `src/components/auth/AuthScreen.tsx` — it still carried v4 `tessera-*` classes (`tessera-cta`/`tessera-grain`/`tessera-block`) whose CSS was deleted with the old stylesheet, so the primary submit button rendered with no background and inherited near-black text on the near-black card = **invisible**.
- **Rebuilt to the archived Figma frame** `Welcome_Back_219-30095.png`: split layout — white left brand panel (palette-matched `login-illustration.png`, rotating caption carousel with gold active dot, reduced-motion aware) + sage `#E3E7E0` right panel ("Welcome Back!", placeholder-style `sp-input` fields, password show/hide eye toggle per frame, **full-width gold `sp-cta` "Sign in"** with spinner loading state).
- The frame's social-login row is honestly replaced by the provisioned-accounts note (no OAuth providers configured — no dead buttons); red error alert retained; "© 2026 ServePoint" footer; mobile stacks to the form with a compact brand row; new `src/vite-env.d.ts` for the PNG import.

### Governance — Owner directive: "pls dont change the login page"
- **ADR-0016: the v5 login screen is frozen at commit `a6fd120`** (supersedes ADR-0010's Tessera-era freeze). The auth surface (`AuthScreen.tsx` + `login-illustration.png`) is read-only for all future passes; hotfixes that must touch it may not alter visuals and must be logged in the worklog.

### Verified
- `tsc --noEmit` → 0 errors; agent-browser E2E at `127.0.0.1:3000`: button visible in the a11y tree, real sign-in (`admin@tsos.dev`) → Platform console "Supabase: connected"; desktop 1440×900 + mobile 390px screenshots match the frame; zero console/page errors.

## [5.0.3] — 2026-10-01 — Auth Model: Provisioned Accounts First (owner directive: "no unnecessary authentication")

### Changed — Registry-first sign-in + cloud session upgrade
- **Provisioned accounts now sign in INSTANTLY from the local credential registry** — zero cloud round-trips, no email validation, no rate limits, no console 400 noise. The email does not need to be a real mailbox (owner decision: the superadmin invents the address and hands over the password).
- **Silent cloud session upgrade** (`tryLinkCloudSession`): after any registry/constant sign-in, the app replays the same credentials against Supabase Auth in the background — when the cloud account exists with the same password, the session gains its JWT so **row-level security** authorizes data (menus, orders, tenants). The bootstrap operator auto-upgrades even when the cloud grant hiccupped transiently (self-heals the two 400s observed).
- **`provisionBusiness` session guard**: cloud writes now require a JWT-backed session up front — a registry-only session returns actionable guidance ("sign out, sign in with your cloud password") instead of a raw RLS 42501; RLS failures map to the same clear message.
- **Wizard review step shows a "Cloud session missing" banner** before submitting when the session is registry-only — the operator knows before provisioning, not after.
- **QSR option fixed**: the wizard sent `'qsr'`, which violates `tenants_business_type_check` — now sends `'quick_service'` (third latent CHECK mismatch).

### Verified
- Full browser E2E of the owner's exact flow: fresh sign-out → sign in as operator → Add Business wizard (Smoke Test Cafe) → **"Saved to cloud"** with zero warnings; Businesses tab shows the row; REST confirms tenant (trial) + subscription (starter/trialing) + audit (`business.provisioned`) all landed; owner signup created **confirmed** in auth.users (Confirm-email is now OFF — the owner flipped it, so zero emails/rate limits). Test data deleted afterwards — production DB pristine (`tenants: []`). `tsc --noEmit` → 0 errors.

## [5.0.2] — 2026-10-01 — Wizard Provisioning Fixed Against Live DB

### Fixed — Owner's first real "Add Business" run hit two cloud failures (screenshot)
- **`tenants_status_check` violation fixed**: the wizard inserted `status: 'trialing'`, but `tenants.status` CHECK allows only `trial | active | past_due | suspended | cancelled | archived`. `provisionBusiness` now maps Trial → `'trial'`, Standard → `'active'` (the DB is the source of truth; migration 001 already applied).
- **Subscription row now created** (best-effort, one per tenant via `uq_tenant_subscription`): wizard's two-plan model maps to the `plan_id` CHECK enum — Trial → `starter` @ `trialing` (14-day trial_end), Standard → `growth` @ `active` with 30-day `next_billing_at` — so the Platform Subscriptions tab and MRR metric populate on first provision.
- **Platform audit trail is now live**: every provisioning writes `platform_audit_logs` (`action: business.provisioned`, actor = operator email, details + metadata JSON) under the "System insert audit logs" policy — the Platform Audit tab shows real activity.
- **"Email address is invalid" diagnosed**: Supabase's enhanced email validation does DNS-level checks that failed transiently (the same address passed on retry — proven by REST battery). `authService.signUp` now sanitizes emails (zero-width/NBSP strip, trim, lowercase) and **retries once** on `email_address_invalid` before surfacing.
- **`429 over_email_send_rate_limit` handled properly**: the new project has "Confirm email" ON (default) — free tier allows ≈2 confirmation emails/hour, which blocks wizard signups. The notice now says exactly that with the one-toggle fix; **docs/CREDENTIALS.md documents the dashboard step** (Authentication → Sign In / Providers → Email → Confirm email OFF) so provisioned accounts exist confirmed and sign in immediately.
- **Stale copy removed**: the wizard no longer says "run it on Supabase once migrations are applied" (migrations ARE applied); honest retry/dashboard guidance instead.

### Verified
- REST E2E of the exact fixed path as the operator: tenant insert (`status: trial`) → 201, subscription (`starter/trialing`) → 201, audit (`business.provisioned`) → 201, Platform readback shows all three → then deleted, leaving the production DB pristine (`tenants: []`). `tsc --noEmit` → 0 errors.

## [5.0.1] — 2026-10-01 — Fresh Supabase Provisioning & Platform Hardening (ADR-0015)

### Fixed — Owner reported console errors after the old cloud project was deleted
- **NEW Supabase project wired in everywhere** (`gehjsxopcowmotgrrcgc`): `src/lib/supabase.ts` (hardcoded public URL + `sb_publishable_…` key), `render.yaml` build env, `help.md`. The deleted project (`vbufsuzzmehsidshopku`) is fully retired.
- **Full schema applied to the fresh DB** via the new `scripts/db-setup.mjs` (Supavisor session pooler — `aws-0-ap-northeast-2.pooler.supabase.com`, IPv4 path; direct `db.<ref>.supabase.co:5432` is IPv6-only on current projects). Migrations 001→004 applied and verified: 16 public tables, RLS policies in place, **zero rows — no demo data**.
- **NEW `supabase/migrations/005_production_baseline_hardening.sql`** (idempotent, also applied): ① `platform_audit_logs.created_at` as a STORED generated alias of the canonical `timestamp` column — PostgREST `order=created_at.desc` resolves instead of PGRST204/HTTP 400; ② guarded policy re-ensures (migration 001's exact names) for tenants/subscriptions/platform_audit_logs so partially-migrated environments self-repair; ③ seeds the **bootstrap Platform Operator as a real Supabase Auth user** (`admin@tsos.dev`, bcrypt, `role:"superadmin"` in `raw_user_meta_data`, confirmed) + an active tenant-free `tenant_users` superadmin row so `is_superadmin()` authorizes Platform tables.
- **Audit-log schema mismatch fixed in the app**: `AuditLogEntry` now matches migration 001's real columns (`actor_email`/`details`/`timestamp`); `fetchAuditLogs` orders by `timestamp`; Platform console (Dashboard activity + Audit tab) renders the correct fields.
- **Auth hardening**: after a successful cloud password sign-in, the bootstrap operator's `user_metadata.role` is pinned to `superadmin` client-side (updateUser + refreshSession, best-effort) so RLS authorization survives metadata drift.

### Verified
- REST E2E against the new project — the exact failing calls from the owner's console: password grant `admin@tsos.dev` → **200 JWT**; `GET /rest/v1/platform_audit_logs?order=created_at.desc&limit=50` → **200 []** (was 400); `GET /rest/v1/tenants` → **200 []** (was 403). Browser E2E: sign-in → Platform console (Dashboard/Businesses/Subscriptions/Audit) with clean empty states, no error banners; sign-out returns to login; 390px mobile layout clean; browser console + dev.log free of network errors. `tsc --noEmit` → 0 errors. Secrets hygiene: the DB password lives in `.env`-style local env only (`SUPABASE_DB_PASSWORD`) — never committed.

## [5.0.0] — 2026-10-01 — Production Rebuild: App Equals the Figma (ADR-0014)

### Changed — Owner order: "delete everything except login page; redesign everything according to the figma design each and every component; make this end production app; remove any demo or development things"
- **THE PRODUCT EQUALS THE FIGMA.** The app is now the ServePoint IA from the 57 archived frames: **Dashboard · Food & Drinks · Bills · Messages · Settings** (+ Notifications, Support), inside the ServePoint shell (deep-teal sidebar with gold active pill + user card + Open Profile, breadcrumb header with bell/clock/search). Login screen KEPT (v4.0.0 credentials-only), rebranded ServePoint.
- **DELETED**: KDS, Inventory, Menu management, Shifts, Customers, Offers, Reports, Tables, Storefront/QR OrderTracking, native clients, printer/session/sound/realtime services, BOTH seed-data modules, the 1,865-line hybrid store, Tessera/dark themes + remap layer, "Switch to Cafe View" dev tool, email-alias auto-login, hardcoded demo accounts. 42 components → 14 production components.
- **NEW production data layer** (`src/lib/api.ts`): typed Supabase access only (tenants, categories, menu_items, orders, order_items, tenant_users, subscriptions, audit) — no seed data, no mock fallbacks; loading skeletons (frame 219-26844), honest error cards with Retry, Figma empty states. `useTenant()` resolves the workspace from session metadata (cloud tenant_id or slug lookup) with honest "workspace not linked/found" states.
- **NEW surfaces built to frames**: Dashboard (Daily Sales line chart, Revenue donut, Total Order/New Customers stats, Best Employees, Trending Dishes — Recharts themed), Food & Drinks (categories grid → items grid with gold selected state → Frame_30 item modal with add-on steppers → order drawer with GST math → cloud order creation), Bills (two-pane per 219-29423: status/date filters, bottom search, detail pane with legacy-status normalization, method-gated Charge flow → PAID against live Supabase), Messages (Teams/Personal two-pane chat, migration-004 grace notes), Notifications (category cards + mark-all-read), Support, Settings (sage nav: Profile/Notification/Appearance/Checkout/Security/Language & Region + owner-only Staff accounts), Platform console (Businesses/Subscriptions/Audit + **Provisioning Wizard** creating business + owner with generated password and copyable credentials).
- **Auth hardening**: the bootstrap platform operator (`admin@tsos.dev`) now resolves to `superadmin` regardless of stale cloud metadata (found via E2E: cloud metadata `role:"staff"` dropped the operator into the cafe app — fixed). Alias shortcuts and demo fallbacks removed; CREDENTIALS.md rewritten to the production account model.
- **Mobile**: sidebar collapses to a 76px icon rail below md; header search swaps to a profile chip; breadcrumbs truncate.
- **DB**: `supabase/migrations/004_notifications_messages.sql` — notifications/conversations/conversation_messages + RLS + default team conversations.

### Verified
- `tsc --noEmit` + `bun run lint` → 0 errors; browser console clean. agent-browser E2E against the LIVE Supabase: operator sign-in → Platform (never cafe); wizard provisioned "Brew & Bean Koramangala" (RLS-blocked cloud insert honestly surfaced; owner registered locally) → owner sign-in landed in the cafe app; CoolKafe cloud data end-to-end: live menu categories/items → item modal → cart → order drawer (GST 5% correct) → Bills live order #1 → status normalized from legacy "new" → Cash charge → **"Payment recorded" / Paid**; Messages/Notifications show honest migration-004 states; mobile icon rail verified at 390px.

## [4.0.0] — 2026-10-01 — Role Model Rework: superadmin/owner/staff + Login Overhaul (ADR-0010 Unfrozen by Owner Order)

### Changed — Owner-mandated role model & auth rework
- **NEW ROLE MODEL** (`types.ts`, `lib/rbac.ts`): `UserRole` is now **`superadmin` | `owner` | `staff`**.
  - **superadmin = TSOS developer**: lands on the SuperAdmin Platform console ALWAYS (restored sessions included); URL routes to cafe surfaces are ignored; the explicit "Switch to Cafe View" dev tool remains for testing.
  - **owner**: business dashboards + every cafe screen + **Create Staff Login** (Settings → Staff Accounts, owner-only via `canManageStaff`).
  - **staff = merged Manager+Cashier**: operates the WHOLE cafe POS app (all 11 tabs); account creation stays owner-only.
  - `normalizeRole()` maps every legacy role (manager/cashier/kitchen/barista/chef/server/waiter/cleaner) → `staff` at the auth boundary; legacy accounts keep working (role auto-merges).
- **FIX — "superadmin gets POS screen"** (`App.tsx`): session restore routed superadmin to the platform only when the URL happened to be `/superadmin` or `/`; any other persisted URL (e.g. `/coolkafe/pos`) dropped them into the cafe POS. Superadmin now ALWAYS lands on the platform; `handleUrlRoute` early-returns for superadmin sessions.
- **LOGIN OVERHAUL** (`AuthScreen.tsx` — ADR-0010 freeze lifted by explicit owner order): email + password sign-in ONLY. Removed: "Register Cafe" tab (self-serve signup is dead — the SuperAdmin wizard provisions businesses + owners), "Magic Link" tab, the 4 one-click demo buttons, and the on-screen credentials card. A pointer to **`docs/CREDENTIALS.md`** remains. Email field accepts friendly aliases (`admin` / `owner` / `staff` / `manager` — `type="text" inputMode="email"` so HTML5 validation does not block aliases).
- **CREDENTIALS MOVED OUT OF THE UI**: new **`docs/CREDENTIALS.md`** documents every account (superadmin/owner/staff + legacy merged accounts + aliases), the provisioning flow, and the Supabase-dashboard fallback for cloud auth.
- **Provisioning Wizard creates the OWNER login** (`ProvisioningWizard.tsx` + `lib/authService.ts`): a strong temporary password is generated, shown + copyable on the success screen, registered in the new **local credential registry** (`tsos_local_credentials`) so the owner can sign in immediately; cloud push to Supabase Auth is best-effort with a documented dashboard fallback.
- **Owner creates STAFF logins** (`SettingsScreen.tsx` → Staff Accounts): "Create Staff Login" form (name/email/temp password) → `authService.signUp(..., 'staff', tenant)`; registers locally + cloud best-effort; feedback shows the exact credentials to hand over. Staff/kitchen users see an owner-only notice instead.
- **authService rework**: role narrowing to the trio, alias map, known-account fallback (incl. `staff@coolkafe.com`), local credential registry, `signUp(email, password, name, role, tenant)` (local registry first — cloud notices are non-blocking), magic-link API removed. PIN pad logins resolve to `staff`.
- **DB migration `003_role_model_staff_merge.sql`**: `tenant_users.role` folded to `superadmin|owner|staff` (legacy values updated in-place), CHECK constraint replaced, RLS helper functions `tsos_is_tenant_member()/tsos_is_tenant_owner()` + member/owner policies re-created on the new role set. Owner runs it in the Supabase SQL editor (as with 001).

### Verified
- `tsc --noEmit` + `bun run lint` → 0 errors; fresh-load console clean (menu hydrates from Supabase cloud). agent-browser E2E: login screen shows sign-in only; `admin@tsos.dev` → SuperAdmin Platform (Businesses/Provisioning/Dashboard — NOT the POS) incl. after restart; owner → POS + Settings → **Create Staff Login** created `rahul@coolkafe.com / staffpass1` E2E → sign-out → sign-in as the new staff → lands in POS as "Rahul Verma — Cafe Staff"; legacy `manager` alias → "Cafe Staff"; wrong password → "Invalid email or password. Credentials live in docs/CREDENTIALS.md."

## [3.0.0] — 2026-10-01 — Inventory + Menu + Shifts + Settings Explicit ServePoint — ADR-0011 Roadmap Complete (19 Surfaces)

### Added — Final four screens rebuilt to the ServePoint language; the explicit-ServePoint roadmap is now COMPLETE
- **Inventory (`InventoryScreen.tsx` + `RestockOrderModal.tsx`, 16th surface)**: ivory `#F6F5F2` canvas, `#E3E7E0` hairlines, sage `sp-surface` icon chips, tab switcher on sage `#D9E2DD` track with deep-teal `#0F3D3E` active pills; Recharts chart fully themed (`#E3E7E0` grid, green/red bars, white tooltip with deep-teal header); filter pills deep-teal active; stock cards with gold hover border + `#B42318` low-stock tint ring, deep-teal bold stock numbers (mono retired), progress bars on sage tracks; Recipes tab ivory rows + deep-teal prices; Audit Logs ivory thead with pressed-gold KDS auto-deduct; Restock modal gold focus rings + gold `sp-cta` submit; RestockOrderModal ivory header/footer strips, white qty inputs with gold focus, gold 1-Click Apply Restock.
- **Menu & Catalog (`MenuScreen.tsx`, 17th surface)**: deep-teal active category pills on white hairline tracks, gold `sp-cta` **Add Menu Item**, availability summary strip, ivory thead table with deep-teal bold prices (mono retired), `#E3E7E0` ghost Edit/Delete buttons, gold-focus modals (Add/Edit gold submit, New Category deep-teal submit); veg/non-veg regulatory badges + In Stock/Sold Out chips kept semantic.
- **NEW Menu feature — availability summary strip**: "X of Y items available • N sold out" chip above the table, reactive to filters/search/toggles (gold sold-out count, sage chip).
- **NEW Menu feature — sort control**: Name A–Z / Price Low–High / Price High–Low dropdown applied to filtered items (verified: ₹40 samosa first under Low–High).
- **Staff & Shifts (`ShiftsScreen.tsx` + `DrawerReconciliationModal.tsx`, 18th surface)**: ivory canvas, `sp-cta` gold CTAs (Clock In Staff / Add Employee / modal submits), deep-teal secondary buttons + active pills on sage tracks, sage/gold/danger reconciliation chips, sage payroll KPI tile + gold-tint Avg Hourly Cost card, sage staff avatars/wells, `#F6F5F2` table theads; Drawer Reconciliation: sage "Cash Audit" chip, gold-tint Expected in Till, sage count-mode toggle, gold Match Expected chip, `#E8F5EC`/gold/`#FEF2F2` variance states, gold Save Audit (danger-red Save & Clock Out kept intentionally).
- **NEW Shifts feature — live shift-duration ticker**: every active shift card shows elapsed "Shift duration" (net of breaks) via a 60s `setInterval` (cleaned up on unmount).
- **NEW Shifts feature — history filter**: All / Open / Closed segmented control on shift history (payroll math intentionally still uses the unfiltered set).
- **Settings (`SettingsScreen.tsx`, 19th surface — restructured per Figma `Checkout_Settings_219-29597`)**: left **sage `#D9E2DD` section-nav card** (Printer & Hardware / Checkout Settings / Staff Accounts / Cafe Profile / Reset Data) with deep-teal active rows; page header "Checkout Settings" with sage icon chip; setting rows (bold label + description + gold toggle + hairline dividers); gold-focus inputs; full-width gold **Save Changes**; new `SPToggle` component (gold track, `role="switch"`, ARIA-checked/labelled). All 5 sections, every field, and every handler preserved — ServePoint-only branch; legacy warm JSX untouched.

### Verified
- `tsc --noEmit` → 0 errors; `bun run lint` clean. agent-browser E2E: Inventory (Restock CTA + modals), Menu (availability strip "7 of 7 • 0 sold out", sort → ₹40 first), Settings (sage nav + deep-teal active row + section switching), Shifts (duration tickers ×2, All/Open/Closed click-tested both ways); dark round-trip legacy intact; zero console errors.

## [2.9.0] — 2026-10-01 — Customers + Offers Explicit ServePoint (Loyalty & Promo Surfaces) + Tracking Label Fix

### Added — Loyalty & promo surfaces rebuilt to the ServePoint language (14th + 15th explicit surfaces)
- **Customers CRM (`CustomersScreen.tsx`)**: ivory `#F6F5F2` canvas, white header with `#E3E7E0` hairline + sage icon chip (deep-teal glyph) + gold **Register New Customer** `sp-cta`; "1 pt = ₹1" chip and +25 pts bonus note in sage/gold; **4 KPI cards restyled** — white hairline (Enrolled Guests, deep-teal value, mono retired), sage-tint (Active Loyalty Points, deep-teal), gold-tint (Points Redeemed, pressed-gold `#967221`), white (Avg Points/Guest, kept `#17803D`); **deep-teal active tier tabs** with sage hover; table with ivory thead, `#E3E7E0` dividers, sage avatars, **ServePoint tier-badge palette** (Platinum = deep-teal tint, Gold = pressed-gold, Silver = sage-slate, Bronze = sage), sage loyalty chips with deep-teal counts, **gold tier-progress bars on sage tracks**, deep-teal POS Order button, white Receipts ghost with gold glyph; **detail modal**: ivory chrome, deep-teal avatar, **deep-teal gradient loyalty card** (`#0F3D3E→#0B3132`) with gold **Redeem at POS** CTA, deep-teal active tabs; add-customer modal with deep-teal focus rings + sage welcome note. All legacy warm branches preserved behind `isServepoint` ternaries (tessera/dark keep purple/chartreuse).
- **Offers (`OffersScreen.tsx`)**: ivory canvas, white header + hairline, sage icon chip, gold **Create Coupon** `sp-cta`; offer cards = white with `#E3E7E0` hairline + **gold-border hover**, sage code chips (deep-teal mono codes), sage Active chips / danger-tint Disabled, deep-teal discount values (mono retired), `#6B8579` muted meta, **gold Pause/Activate links**; create modal with hairline inputs + deep-teal submit. Legacy warm preserved.
- **Fixed — OrderTracking fallback label**: QR orders placed before table binding showed "Pickup Counter"; now "**Guest Order**" (cosmetic debt from the v2.8.1 round notes).

### Verified
- `tsc --noEmit` → 0 errors. agent-browser E2E: Customers KPI cards / tier tabs / table (sage avatars, gold progress bars) / detail modal (deep-teal loyalty card + gold Redeem) all on-theme; **create-coupon E2E** (MONSOON20 → card renders); **Pause toggle** → Disabled chip + Activate link; **theme round-trip** servepoint → tessera (legacy purple/chartreuse intact) → dark → servepoint; mobile 390px clean; zero console errors.

## [2.8.1] — 2026-10-01 — Storefront + OrderTracking ServePoint (Guest QR Surfaces) + Deep-Link Session Fixes + Veg Filter/Sort + Live ETA + Bill Sharing

### Added — Guest QR surfaces rebuilt to the ServePoint language (12th + 13th explicit surfaces)
- **Storefront ServePoint branch (`StorefrontScreen.tsx`)**: ivory `#F6F5F2` canvas, white phone-frame card with `#E3E7E0` hairline + deep-teal ambient shadow; deep-teal `#0F3D3E` hero bar (gold roundel with cafe initials, cafe name, gold table chip, theme-aware session timer chip: sage/white-on-teal → gold at ≤2min → danger pulse at ≤30s/expired); sage security strip (10m ephemeral session + Expire/Tamper/Renew controls restyled); gold "expiring soon" banner; deep-teal active category pills on sage tracks; white menu cards with gold-border hover, deep-teal prices (mono retired), deep-teal Add CTAs with sage glyphs, sage qty steppers with gold plus; gold "View Order" cart bar; deep-teal/95 auto-lock overlay with gold lock chip + gold Renew CTA; ServePoint confetti (`#B88E2F`/`#0F3D3E`/`#D9E2DD`); sage-tinted cart drawer (gold variant labels, ivory bill breakdown, deep-teal Pay & Send with gold check). Legacy warm branch **byte-preserved** for tessera/dark/warm (remap layer handles palette). FSSAI veg/non-veg marks intentionally keep the regulatory green/brown.
- **OrderTracking ServePoint branch (`OrderTrackingScreen.tsx`)**: ivory canvas + white frame; status hero (sage/gold/gold/teal rings per step); **NEW live ETA card** — status-based estimate ("Estimated ~12–15 min" → "~7–10 min" → "Ready now" → "Served"), "Placed X min ago", gold progress bar (15% → 55% → 90% → deep-teal 100%); **stepper upgraded with connector rail** (absolute `#E3E7E0` line, deep-teal passed nodes, gold-ringed current node with gold **NOW** chip); sage Call Waiter + deep-teal Digital Bill tiles; sage items summary with deep-teal total. Legacy branch byte-preserved.
- **New feature — bill sharing on the guest bill modal (parity with ReceiptModal v2.7.0)**: WhatsApp share (gold CTA; direct `wa.me/<phone>` chat when the order carries a guest phone, else the share picker), Copy-to-clipboard (white/teal CTA) with a merged sage/danger feedback chip, Download Bill (deep-teal + gold glyph), Print (sage ghost).
- **New feature — storefront veg filter + price sort (ServePoint branch)**: "Veg only" leaf toggle (deep-teal active pill) and a sort select (Most Popular / Price: Low → High / Price: High → Low) layered over the base category+search filter via a memoized `serveFilteredItems`; ServePoint-only empty state (sage search circle + "Clear filters" reset). Verified sort ordering ₹40 → ₹160.

### Fixed — QR deep-link session + navigation (guest journey was broken end-to-end)
- **Route clobbering (`App.tsx`)**: the URL-route effect re-ran on every `tables` change and re-processed the current path mid-session — placing an order deterministically flipped `order_track` back to `storefront` (stale `/coolkafe/t1` path re-matched) and clobbered the tracked order id. Route handling now runs **once at boot** (waiting for table hydration so deep-links still match tables) and on `popstate` only (latest-handler ref).
- **Tenant slug for sessions (`StorefrontScreen.tsx`)**: the session RPC was called with `location.slug` (`demo-cafe`) instead of the tenant slug (`coolkafe`) → the live RPC always rejected. Now `currentTenant?.slug || location.slug || 'coolkafe'`.
- **Session RPC fall-through (`sessionService.ts`)**: an explicit RPC rejection (unknown tenant, `INVALID_PERMANENT_QR`) returned early and skipped the documented offline HMAC fallback — locking every path. `issueEphemeralSession` now remembers the rejection and falls through (the local fallback still only mints a session when `fallbackTable.qr_token` matches the presented token, so tampered tokens can never pass); `verifyOrderSubmissionSession` falls through to the local HMAC verdict for locally-signed `v1.` tokens, and verifies opaque live tokens **by token alone** (`p_table_id: null` — the live session belongs to the live table uuid, so comparing against the local demo id always failed `TABLE_MISMATCH`).
- **Lock-screen diagnosability**: `sessionError` is now displayed on the auto-lock overlay (gold note in ServePoint, rose in legacy) instead of failing silently.
- **`App.tsx` public surfaces**: the standalone storefront/tracking `<main>` canvas follows the active theme (ServePoint ivory vs warm legacy).

### Verified
- `tsc --noEmit` → 0 errors; `bun run lint` clean. Browser E2E: **live deep-link** `/:slug/t01?token=<live-uuid>` → session issued by RPC (09:56) → add items → cart → guest name/note → **Pay & Send ₹630** → Order #107 → ServePoint tracking with ETA card + NOW stepper → **Digital Bill modal** (Copy feedback chip verified, WhatsApp/Download/Print present) → URL stayed `/track/live` (clobber fixed); **in-app Test QR** path with the local `qr-demo-t1` token → RPC rejection → local HMAC `v1.` session minted → order placed → tracking shows "Table T1 (Window)"; theme round-trip servepoint → tessera (legacy warm branch + remap intact) → dark → servepoint; **mobile 390px** storefront renders cleanly (hero wraps, controls stack, categories scroll); zero browser console errors (only the known 42501 RLS queue-locally info line).

---

## [2.8.0] — 2026-10-01 — SuperAdmin ServePoint (Dashboard Frame) + Range Selector + Interactive MRR Donut + Quick Jump + Trial Radar + CSV Snapshot

### Added — SuperAdmin surface rebuilt to the owner's Dashboard frame (`Dashboard_219:29880` filled / `219:23581` wireframe)
- **ServePoint shell (`SuperAdminScreen.tsx` ServePoint branch)**: deep-teal `#0F3D3E` sidebar per the frame — gold roundel logo + "TSOS Platform" wordmark, nav pills with **gold active state** (`#B88E2F` pill, deep-teal text, exactly like the frame's Dashboard item) and gold count badges (Businesses 5, Audit Trail 3 — the frame's Notifications "5" language), gold-highlighted Provisioning Wizard, **OTHERS** section with Switch to Cafe View, and the frame's **pinned profile card** (SA avatar, name, role, Sign Out outline button, © 2026 footer). Main column: breadcrumb top bar (back arrow → cafe view, `Platform › {Tab}`), **quick tenant-jump search** (type ≥2 chars → dropdown of name/city/owner/slug matches → click lands on the Businesses Directory pre-filtered to that tenant via `setSelectedSuperAdminBusinessId`), RLS-Active live chip, page title row with mobile sign-out.
- **ServePoint dashboard (`SuperAdminDashboard.tsx` ServePoint branch)** — the frame's 6-card grid: **Daily Sales** line chart (dual Y-axes: integer orders left in teal `#0F3D3E` with white-stroked dots, ₹ revenue right in gold `#B88E2F` dashed, `#E3E7E0` dashed grid, white tooltip with teal/gold dots, footer totals + %-vs-yesterday chip); **MRR by Plan** interactive donut (center swaps to the hovered plan's MRR on mouseenter — Starter sage `#8FA99B` / Growth gold `#B88E2F` / Pro deep-teal `#0F3D3E` / Enterprise danger `#DC2626`, legend with per-plan counts + ₹ values, zero-MRR trial plans filtered from the arcs but kept in the legend); the frame's two **sage stat tiles** (Platform Orders with danger-red square chip + dark underline, Recurring Revenue with gold square chip + MoM delta + lifetime-GMV sub-line); **Top Tenants** leaderboard (Best-Employees analog: initial avatars in the teal/gold/sage cycle, `plan · city` subtitles, range-scaled revenue, click-to-jump); **Busiest Tenants** (Trending-Dishes analog: gold `business_type` badge chips, all-time orders, click-to-jump) with the **Trial Radar** strip (trials ending soon, urgency-colored day chips: ≤3d red, ≤7d gold, else white); **Tenant Lifecycle** (sage/gold/red 2×2 tiles + archived footer), **System Health** (teal icon chips on ivory wells, sage 99.98% Uptime pill), **Recent Operations** (sage action chips, Poppins timestamps, Full Audit Log link).
- **New feature — shared date-range selector**: Today / Last 7 Days / Last 30 Days segmented control (sage track, white active pill) driving the Daily Sales trend, the Top-Tenants revenue scaling and the banner GMV line. Today renders the frame's 9 AM–9 PM hourly buckets with a café rush curve; 7d/30d render per-day series with weekend lift. All series are **deterministic** (stable string-hash weights over each tenant's lifetime orders/revenue — no `Math.random`, no flicker across renders).
- **New feature — CSV platform snapshot**: gold-outline Export button downloads the full tenant roster (name, status, plan, rate, cycle, orders, lifetime revenue, city, owner, trial end, next billing) with proper CSV escaping.
- **BusinessDirectory quick-jump consumer**: pending `selectedSuperAdminBusinessId` now pre-filters the directory's search to that business and clears itself.

### Fixed
- **Height contract, self-measuring**: the app Header's height varies with viewport width (92px desktop, ~100px mobile). The shell now measures its own `offsetTop` (with resize listener) and sizes to `calc(100vh − inset)` — verified zero page scroll at 1280×720, 390×844 and a 577px-tall window.
- **Orders/revenue scale mismatch**: single-axis chart made the orders line flat against the ₹ scale → dual Y-axes with `allowDecimals={false}` on the orders side.

### Changed
- **ServePoint remap layer extended (section 5e)**: purple/violet family (`#7C3AED`, `#9333EA`, `#6B21A8`…) → deep-teal/info-teal, green family → ServePoint `#17803D`, amber family → pressed gold, soft-red family → exact `#DC2626`, plus their tint backgrounds → sage/danger tints. The Directory, Wizard, Subscriptions and Audit tabs now ride the owner theme without individual rewrites.
- **Mobile (<lg)**: sidebar hidden; a horizontally-scrollable pill nav strip replaces it (teal active pill, gold Provisioning, Cafe View quick-switch) and Sign Out moves to the title row.
- Legacy "TableSide" shell + dashboard **byte-preserved** for tessera/dark/warm behind the `themeMode === 'servepoint'` gate; `App.tsx` passes `onSignOut` to the screen for the sidebar profile card.

### Verified
- `tsc --noEmit` → 0 errors; `bun run lint` clean. Browser E2E as superadmin: shell + all 6 dashboard cards render; **range switch** (Today → 7 Days: banner GMV ₹6,864→₹15,929, weekday X labels, integer axes); **quick jump** "cool" → CoolKafe Indiranagar → Businesses tab with search pre-filled; **CSV download** verified on disk (header + 5 tenant rows); **theme round-trip** servepoint → tessera (legacy TableSide shell intact) → dark (legacy, remap) → servepoint (shell, zero scroll); **mobile 390px** pill-strip nav + stacked banner + full-width chart; Directory/Subscriptions/Audit/Wizard tabs all ServePoint-consistent via the 5e remap; zero browser console errors.

---

## [2.7.2] — 2026-10-01 — Orders Two-Pane (Bills Frames) + Date Filter + CSV Export + One-Tap Status Advance

### Added — Orders Directory rebuilt as the ServePoint two-pane (`Bills_219:23130` / `219:24297`)
- **Left pane — order cards list** (420px, white): `Orders` title + sage count chip + gold-tinted **Export** button, live summary strip (`N orders in view · ₹X combined value`, cancelled excluded), status pill row (active = deep-teal pill), **date-range filter** (All Time / Today / Last 7 Days — the frame's date dropdown), order cards (`Order #N` + ServePoint status dot/label, table-or-type · items · customer subtitle, amount + timestamp right-aligned, selected card = ivory bg + deep-teal ring), and the frame's **bottom-pinned search bar** ("Search for order #, customer, dish...").
- **Right pane — order detail**: breadcrumb (`Orders / Order #N`), Poppins-bold `Order #N` title + status chip + **PAID/pending payment chip** (payment_status-aware: completed→PAID gold-tinted, failed→danger, else neutral), placed-at meta line, Print/Eye icon actions; **Details card** (Table / Items / Customer / Payment 4-column grid incl. fee payer microcopy); **Order Info card** (sage thumbnails, gold `2x` qty chips, variant + add-on lines, per-item totals, full totals block: Subtotal → Discount (gold, when >0) → GST → Platform Fee → bold Total); **Kitchen Notes sage strip** + loyalty earned/redeemed chips when present.
- **Contextual sticky CTA**: active orders get a full-width deep-teal **Move to Preparing/Ready/Completed** button (`advanceOrderStatus` — same cloud+KDS path as KDS bump) with "syncs to KDS, cloud & receipts instantly" microcopy; completed orders get a gold **Print Invoice** CTA; cancelled orders show a neutral no-actions note.
- **New features**: date-range filter, **filtered CSV export** (reuses `exportFinancialLedgerCSV`), one-tap status advance with deep-teal toast, combined-value summary strip, and auto-select of the first filtered order (detail pane never empty while orders exist).

### Fixed — layout height + theme gating
- **Page-scroll bug**: the two-pane relied on flex height inheritance through the auto-height app shell → content grew the page (`min-height:auto` chain). Root now `h-[calc(100vh-145px)]` (measured shell chrome) and the two-pane container `h-[calc(100vh-204px)]`; verified `document.body.scrollHeight === innerHeight` (zero page scroll) with the detail pane scrolling internally.
- **Dark-mode hybrid**: the two-pane originally gated on `!isTessera`, so theme `dark` (cycle servepoint→tessera→dark→servepoint) rendered the *light* ServePoint two-pane under the dark-remapped shell. The two-pane is now **ServePoint-only** (`themeMode === 'servepoint'`); Tessera keeps its explicit table byte-identical and dark/warm keep the legacy table via the CSS remap (all warm ternaries restored in the legacy branch).

### Verified
- `tsc --noEmit` → 0 errors. Browser E2E across all three theme modes: ServePoint two-pane (auto-selected Order #105, card selection, Details/Order Info/totals/loyalty rendering), **Move to Ready** click → card + KDS nav count updated (4→3) + toast "Order #105 moved to Ready — KDS & cloud synced", **Today filter** 18→10 cards with summary recompute, Export click clean; Tessera round-trip shows the untouched 8-column table; dark mode shows the warm-remapped table (hybrid gone); zero browser console errors beyond the known 42501 RLS queue line.

---

## [2.7.1] — 2026-10-01 — Reports Analytics Complete: ServePoint Internals + Week-over-Week Comparison + Live Pulse Auto-Refresh

### Added — New analytics features
- **Week-over-Week comparison in WeeklySalesLineChart**: the chart now computes the *previous* week's same-weekday revenue and draws it as a dashed comparison curve behind this week's solid line ("Last Week (₹)" legend entry). The metric highlights strip gained a **+% WoW delta chip** (green TrendingUp / red TrendingDown, tooltip shows last week's total), the chart tooltip shows "Same day last week" per hovered day, and a footnote under the chart spells out week-to-date vs last-week totals (e.g. "week-to-date ₹5,779 vs ₹1,608 (+259% WoW)").
- **LiveOpsPulse 30s auto-refresh heartbeat**: the pulse widget now re-computes its "last 60 min / tables / kitchen load / staff" windows every 30 seconds even when the manager leaves the tab open — with a "auto 30s" indicator and a live "upd HH:MM:SS" timestamp so staff can trust what they're seeing.

### Changed — Reports internals explicit ServePoint (screen now 100% on-theme)
- **LiveOpsPulse**: first theme-aware pass (was hardcoded Tessera dark forest). ServePoint branch = white card, gold LIVE pill with pulsing dot, deep-teal icon chip, ivory metric tiles with gold-border hover, Poppins values, ServePoint kitchen-severity ramp (idle `#969696` → light `#17803D` → moderate `#B88E2F` → busy `#967221` → critical `#DC2626`), sage insight strip. Tessera branch byte-preserved.
- **WeeklySalesLineChart**: ServePoint branch = deep-teal `#0F3D3E` revenue line + white-stroked dots, gold `#B88E2F` orders line, gold dashed Daily-Avg reference (pressed-gold label), sage hairline grid/axes, sage inset metric switcher with white active pill, Poppins semibold highlight values (mono retired), white tooltip with teal/gold dots, ivory footer. Warm branch byte-preserved.
- **DailySalesHeatmap**: theme-aware from JS (inline SVG attrs bypass CSS remaps) — ComposedChart bars now use the ServePoint **deep-teal monochrome rush ramp** (ivory → sage → sage-dark → mid-teal `#2C6E64` → deep-teal `#0F3D3E`), orders line gold with pressed-gold active dots, `#E3E7E0` grid/axes, matrix heat cells + legend swatches on the same teal ramp. Peak-threshold stays ServePoint danger red.
- **Global ServePoint remap extended** (benefits all remaining warm surfaces): deep warm ramp `#C2410C`→deep teal / `#EA580C`→mid teal / `#FED7AA`·`#FFEDD5`·`#FFF7ED`·`#FFF4E5`→sage-tint / warm borders→`#E3E7E0`; cool blues `#2563EB`→deep-teal/info-teal, `#E0F2FE`→info-soft; danger variants `#B91C1C`→exact `#DC2626`; `hover:bg-[#EA580C]`→pressed gold; `ring-[#F97316]`→gold ring.

### Verified
- `tsc --noEmit` → 0 errors. Browser E2E: LiveOpsPulse white/ServePoint + heartbeat ticking (upd timestamp advancing), weekly chart teal line + dashed last-week curve + "+259% WoW" chip, heatmap ComposedChart teal ramp + gold orders line, matrix view teal heat cells + matched legend, Staffing Planner gold CTA via remap; theme cycle servepoint→dark→tessera→servepoint round-trips (Tessera branch: forest pulse + orange line + white comparison curve intact); Menu/Orders screens re-checked with zero remap regressions; zero browser console errors.

---

## [2.7.0] — 2026-10-01 — Cloud Order Sync Fix + Reports/Receipt ServePoint + Receipt Sharing

### Fixed — Orders never reached the live cloud (QA-discovered, highest priority)
- **Root cause**: `realtimeService.syncOrderToSupabase` pushed local demo ids (`biz_coolkafe_99`, `loc-demo-01`) straight into the live schema's UUID columns → Postgres `22P02 invalid input syntax for type uuid` on **every** sale since v2.6.2; zero orders ever landed in Supabase and the offline queue silently collected every attempt.
- **Fix**: added a cached `resolveCloudIds` resolver — tenant UUID resolved by slug lookup (the exact path menu hydration has used since v2.6.2), location UUID resolved as the tenant's first `locations` row; valid UUID pairs pass through untouched. Resolution failure now queues locally instead of hammering Postgres.
- **Local→cloud id map**: after a successful insert, the local `ord-…` id maps to the returned cloud UUID so KDS bump / cashier status advances target the correct cloud row (previously `updateOrderStatus` also risked 22P02 on non-UUID ids — now guarded: unmapped non-UUID ids skip the cloud call cleanly).
- **Offline queue carries `tenantSlug`** so deferred flushes resolve ids too; `order_items` insert uses the resolved tenant UUID.
- **Verification**: sale E2E now fails past 22P02 into `42501` RLS (anon INSERT policy pending — migration 001 re-run still owed); the insert *reaches* the orders table with valid UUIDs. Catch block now discriminates: `42501` logs an actionable info line ("RLS blocked — order kept local + queued"), other failures keep the full warning.

### Added — Top-level ErrorBoundary (QA gap)
- React DevTools warned "An error occurred in the \<App\> component. Consider adding an error boundary" — any screen crash unmounted the whole tree into a white screen. New `src/components/common/ErrorBoundary.tsx` wraps `<App />` in `main.tsx`: ServePoint recovery card (ivory canvas, deep-teal Reload CTA, Back-to-POS ghost, error message inspector) instead of a blank page.

### Added — Receipt sharing (WhatsApp + Copy) in ReceiptModal
- **WhatsApp share**: builds a plain-text bill (cafe header, GSTIN, order meta, items, totals, payment mode, footer) and opens `wa.me` — direct chat when the guest's phone is on the order, else the share picker. Indian-counter-native: receipts go where guests actually read them.
- **Copy to clipboard** with success/failure feedback chips; both buttons sit beside Kick Drawer in the receipt footer.

### Redesigned — Reports/Dashboard explicit ServePoint pass (per Dashboard frame 219:23581)
- **Header**: white with `#E3E7E0` hairline, sage icon chip + gold `BarChart3`, near-black Poppins title; **gold `#B88E2F`→`#967221` Export split-CTA** replacing the Tessera chartreuse pill; snapshot chip on sage.
- **KPI cards ×4**: white cards + `#E3E7E0` hairlines + gold-border hover + soft shadow, labels `#6B6B6B`, values Poppins bold `#1A1A1A` (mono retired), sage icon chips (deep-teal glyphs); **Savings card = gold-tinted hero** (`#D9E2DD`/70 + `#B88E2F`/40 border, pressed-gold value).
- **Top Selling Items**: gold `#B88E2F` bars on sage `#D9E2DD`/70 tracks (was orange on warm); `#6B6B6B`/`#1A1A1A` text.
- **Payment Method tiles**: UPI on sage + deep-teal icon, Cash on gold tint + pressed-gold icon, Card on deep-teal tint + deep-teal icon (replaces warm orange/green/blue rainbow with the restrained ServePoint trio); tabular-nums values in `#1A1A1A`.
- **Export modal**: white/`#E3E7E0` chrome, ivory option wells, gold Ledger / deep-teal Daily / pressed-gold Inventory download CTAs; toast = deep-teal `#0F3D3E` with gold check.
- **OrderTypeBreakdown donut**: white card + `#E3E7E0`, slices **Dine-In = deep-teal `#0F3D3E`, Takeaway = gold `#B88E2F`, Delivery = sage `#8FA99B`** (exact frame language), ivory slice strokes, `#1A1A1A` center count, `#6B6B6B` legend stats, white ServePoint tooltip; Tessera branch preserved untouched.

### Redesigned — ReceiptModal explicit ServePoint pass (7th surface)
- **Header**: sage `#D9E2DD` strip, white icon chip with gold printer glyph, gold-tinted PAID badge (was emerald), paper-width selector with **deep-teal active pill**.
- **Tabs**: gold `#B88E2F` active underline + pressed-gold text (was orange); receipt canvas on ivory `#F6F5F2`; feedback banners sage/deep-teal.
- **Footer**: white; Kick Drawer + Copy ghosts, gold-tinted WhatsApp chip, **Print = deep-teal `#0F3D3E`→`#0B3132` CTA with gold printer glyph**, **Next Sale = gold `#B88E2F`→`#967221`**. Thermal bill/KOT previews stay monochrome paper (print artifacts, correctly untouched).

### Verified
- `tsc --noEmit` → 0 errors; fresh-load console = **0 errors / 0 warnings** (previously: 22P02 warning on every sale); full sale E2E in ServePoint — 2-item cart ₹126 → UPI tender → Confirm → Order #105 PAID with receipt (Copy → "Receipt copied to clipboard."; WhatsApp button opens wa.me); KDS board shows #105 as NEW ticket → bump to PREPARING with **zero UUID errors**; Reports header/KPIs/donut/payment tiles/Export modal render exact ServePoint; theme cycle servepoint→dark→servepoint round-trips with Tessera Reports intact in dark.

## [2.6.9] — 2026-10-01 — PaymentModal + Dine-in Tables Explicit ServePoint

### Redesigned — PaymentModal now follows the ServePoint tender language (Bills/Charge frames)
- **Header**: sage `#D9E2DD` strip, "Complete Sale Tender" eyebrow `#6B6B6B`, **"Amount to Collect" in Poppins semibold `#1A1A1A` with the amount in pressed-gold `#967221`** (mono retired for ServePoint); close `#6B6B6B`→`#DC2626` hover on white pill.
- **Method tabs**: all four (UPI QR / Cash / Card / Split Bill) share the gold active state — `#B88E2F` border + `#B88E2F/10` tint + `#967221` text + gold ring (replaces the four-color warm rainbow, matching ServePoint's restrained accent); inactive `#E3E7E0` hairline with `#1A1A1A` icons and gold-tint hover.
- **Method wells**: UPI/Card/Split on sage `#D9E2DD`, Cash on canvas `#F6F5F2` (input-bearing well stays quieter); white QR card with `#E3E7E0` border; VPA row `#6B6B6B` with `#967221` copy hover; "Simulate UPI App Confirmation" as white ghost with gold hover.
- **Cash**: white input with gold focus ring, **Exact = mini deep-teal `#0F3D3E` button**, denomination chips white/`#E3E7E0` with gold hover (Poppins semibold, mono retired), change-due card white with deep-teal (sufficient) / `#DC2626` (short) value.
- **Split**: sage well, gold active diner count, white diner rows with ghost UPI/Cash/Card chips (gold hover), paid rows in deep-teal tint, "Remaining" in pressed-gold.
- **Bill summary**: labels `#6B6B6B`, values Poppins semibold `#1A1A1A` (mono retired), discount in `#967221`, loyalty chip gold-tinted, platform-fee chip `#B88E2F/15`.
- **Footer**: white with `#E3E7E0` hairline; **Confirm Payment CTA = deep-teal `#0F3D3E` → `#0B3132` with white text + soft teal shadow** (exact "Charge customer" button); Back to Cart `#6B6B6B`→`#1A1A1A`.
- **Confetti**: ServePoint palette `[#B88E2F, #0F3D3E, #D9E2DD]`.
- **Fixed**: transient JSX artifact (doubled `>` on the Copied! span) caught by byte-level verification during the pass.

### Redesigned — Dine-in Tables full ServePoint pass (first theme-aware version of this screen)
- **Canvas/header**: ivory `#F6F5F2` canvas, white header bar with `#E3E7E0` hairline, sage icon chip + gold grid icon, near-black title, **gold `#B88E2F`→`#967221` "Add New Table" CTA**.
- **Floor cards**: free = white card + `#E3E7E0` hairline + gold-border hover lift; occupied = white card with **gold ring `#B88E2F/45` + gold status badge**; free badge in deep-teal tint `#0F3D3E/10`; active-order inset gold-tinted with pressed-gold amount (Poppins semibold, mono retired); "Ready for guests" dashed `#E3E7E0` with `#969696`.
- **Actions**: View QR ghost (`#E3E7E0`→sage hover), Test QR gold-tinted (`#B88E2F/10`→solid gold hover), status select on sage.
- **Add Table modal**: white + `#E3E7E0`, gold focus rings, gold submit; **QR Stand printout: sage stand well, deep-teal cafe name, gold table label, `#F6F5F2` URL box, gold "Test Valid QR Order" CTA, ghost Copy/Print**.
- Tessera/warm fallbacks preserved unchanged (pre-existing remap behavior in those modes).

### Verified
- `tsc --noEmit` → 0 errors; agent-browser E2E — full tender flow (UPI QR → Cash ₹400/change ₹1.00 → Split 2 diners) in ServePoint, Confirm Payment → Order #104 PAID + receipt with ServePoint confetti; Tables screen floor plan + QR stand modal render exact ServePoint; theme cycle servepoint→tessera→dark→servepoint round-trips; zero browser console errors.

## [2.6.8] — 2026-10-01 — CartDrawer Explicit ServePoint (Bills Detail-Pane Language)

### Redesigned — Current Order drawer now follows the ServePoint "Bills" detail pane (frame 219:23130)
- **Header**: signature sage `#D9E2DD` strip with gold shopping-bag icon (`#967221`), near-black Poppins "Current Order", gold-tinted items pill, `#6B6B6B` Clear → `#DC2626` hover; order-type tabs on deeper `#E3E7E0` inset.
- **Items**: white cards with `#E3E7E0` hairlines and gold hover ring; item totals in Poppins semibold `#1A1A1A` (mono retired for ServePoint per Figma), "each" captions `#969696`; **sage `#D9E2DD` qty steppers** with `#6B6B6B`→gold buttons; Remove `#969696`→`#DC2626`.
- **Footer**: white pane (Figma has no cream footer), sage coupon input with gold focus ring, **Apply button in exact deep-teal `#0F3D3E`**; totals labels `#6B6B6B` with semibold near-black values; platform-fee chip gold-tinted; **"To Pay" value in pressed-gold `#967221`**; **Charge CTA = the Figma "Charge customer" button: full-width deep-teal `#0F3D3E` → `#0B3132`, white text, soft teal shadow**.
- **Empty state**: sage icon well + gold bag, non-italic semibold near-black copy.
- **Verified**: `tsc --noEmit` → 0 errors; agent-browser E2E — add item → sage header/steppers render → Charge opens PaymentModal (UPI QR tender, gold active tab) → Back to Cart round-trip; zero console errors; tessera/warm branches untouched.

## [2.6.7] — 2026-10-01 — Figma REST Pipeline & Exact ServePoint Tokens (ADR-0012)

### Unlocked — owner-provided Figma PAT + uploaded design kits
- **FIGMA_TOKEN** (owner-supplied, `file_content:read` scope) saved verbatim in `.env`; Render wired via `sync: false` — GitHub Push Protection (GH013) blocks committing Figma PATs, so the blueprint declares the variable and Render prompts for the value once at apply (token stays out of Git; revocable from Figma → Settings).
- **Full design exploration** of *ServePoint POS Preview* via the REST API: all **6 pages** inventoried (Cover, Research, Wireframes, UI Exploration, **Final UI — 57 frames**, Components); **all 57 Final UI screens rendered to PNG** and archived at `docs/design/servepoint/frames/` + 6 page overviews at `docs/design/servepoint/pages/` — future development no longer needs live Figma access.
- **Owner-uploaded kits triaged** (`upload/`): Dae Alright! POS kit RAR extracted (layout reference); Dashboard `.sketch` unzipped (JSON + preview); two fig-kiwi **v4** `.fig` files are below fig2sketch's minimum (v15) and resist image carving — documented dead end, superseded by the REST pipeline.

### Fixed — ServePoint tokens were estimates; now EXACT (mined from node fills)
- Canvas `#F2EFE5`→**`#F6F5F2`** · depth `#17402E`→**`#0F3D3E` deep teal** · accent `#E9A63C`→**`#B88E2F` gold** (pressed `#967221` — from the Primary Button component variants) · text →**`#1A1A1A` / `#6B6B6B` / `#969696`** · signature **sage surface `#D9E2DD`** added (cards/inputs/user card) · hairline `#E7E2D2`→`#E3E7E0` · danger confirmed `#DC2626` · font **Plus Jakarta Sans → Poppins** (400/16 body, 500/16 buttons, 600/24 headings) · radii 12/16/24/100 confirmed.
- `index.css`: full `[data-theme="servepoint"]` token + remap rewrite; `sp-cta` now the exact Primary Button (gold bg, near-black text, Poppins 500, r12); `sp-sidebar` exact `#0F3D3E`; new `sp-surface` utility; gold scrollbar hover.
- `Header.tsx` / `WebNavbar.tsx`: every ServePoint branch re-tokened hex-for-hex (gold brand block + active tabs + baseline marker, near-black text, sage outlet selector & dropdown hover, `#967221` fee accent).
- `index.html`: Poppins imported; body/selection classes re-tokened.
- **PosScreen menu cards** — new explicit `isServepoint` branch implementing the Figma card: sage card + gold-border hover lift, `#E3E7E0` image well, near-black name/description, non-mono semibold price, **gold Add button** (`#B88E2F`→`#967221`), `#C9D3CC` footer divider, `#DC2626` low-stock badge.
- **Verified**: `tsc --noEmit` → 0 errors; browser E2E — frozen login pixel-identical (Tessera pin intact), ServePoint POS matches the Figma (sage cards, gold CTAs, deep-teal ribbon), cart add→Charge/Pay golden path works, theme cycle servepoint→tessera→dark→servepoint round-trips with every theme intact, zero console errors.

### Documented — ADR-0012
- Full decision record (token table, PAT custody, 57-frame archive, kit triage) at [`docs/decisions/0012-figma-rest-pipeline-and-exact-servepoint-tokens.md`](docs/decisions/0012-figma-rest-pipeline-and-exact-servepoint-tokens.md).

## [2.6.6] — 2026-10-01 — ServePoint UI Adoption (Owner Figma, ADR-0011)

### Added — `servepoint` theme: the owner's own design becomes the default post-login look
- **Source**: owner's Figma file *ServePoint POS Preview* (LOKOMAX STUDIO). Cover thumbnail recovered via the thumbnail-CDN redirect (app pages are CloudFront-403; REST API needs a PAT) and archived at `docs/design/servepoint/cover-thumbnail.webp` — it yielded the full design language: **ivory canvas `#F2EFE5` · white rounded cards with soft forest shadows · deep forest-green primary `#17402E` · amber accent `#E9A63C` · Plus Jakarta Sans bold geometric headings · warm hairline borders `#E7E2D2`**.
- **Theme engine** (`src/types.ts`, `src/lib/store.ts`): new `'servepoint'` ThemeMode is the **default** (fresh sessions; stored `tessera` one-time-migrated — Tessera was agent-imposed, never owner-chosen). Header toggle now cycles `servepoint → tessera → dark → servepoint`; warm/obsidian remain reachable via `setThemeMode`.
- **Auth-scoped theme pinning** (`src/App.tsx`): while unauthenticated (login screen, public storefront/track routes) the document is **force-pinned to Tessera** — the ADR-0010 frozen login renders in its exact approved environment with **zero edits to `AuthScreen.tsx`**; ServePoint applies to the authenticated app only.
- **CSS layer** (`src/index.css`): `[data-theme="servepoint"]` token block + remaps mirroring the Tessera architecture — creams→ivory, `.bg-white` cards keep white but gain ServePoint shadow treatment, stone text→forest green, orange accent→amber, dark-stone strips→forest green, Plus Jakarta Sans bold (non-italic) headings, amber scrollbar; new `sp-cta` (amber CTA with lift/sink ergonomics), `sp-sidebar`, `sp-banner`, `sp-ghost` utilities. `index.html` imports Plus Jakarta Sans.
- **Explicit chrome** (`Header.tsx`, `WebNavbar.tsx`): amber TSOS brand block, ivory header + navbar, amber active tab with baseline marker, `sp-cta` Fast PIN, forest/amber model line, soft-shadow More dropdown, ServePoint badge treatments. POS ribbon converts to forest green via the remap.
- **Verified**: `tsc --noEmit` → 0 errors; browser E2E — authenticated POS/Orders render full ServePoint (white cards, amber tabs, forest text), theme cycle servepoint→tessera→dark→servepoint round-trips with every theme intact, and the logged-out login screen is **pixel-identical frozen Tessera** (explicitly re-verified after localStorage clear). Zero console errors.

### Documented — Figma access paths (ADR-0011)
- To unlock "explore all pages" pixel-exact fidelity: owner sets `FIGMA_TOKEN` in `.env` (REST API pulls every page's tree + renders) or drops exported screenshots into `docs/design/servepoint/`. Until then the cover thumbnail is the token source of truth.

## [2.6.5] — 2026-10-01 — OrdersScreen Tessera + Design Governance (ADR-0010)

### Redesigned — OrdersScreen explicit Tessera (conditional `isTessera`; warm styling preserved)
- **Sub-navigation**: Orders Directory / Print Logs tabs as uppercase tracked pills — active = chartreuse block with `tessera-block` 3D shadow, inactive = forest ghost with tinted count pills; failed-print error badge moved to the Tessera status palette (`#F87171` soft tint/ring).
- **Filter bar**: forest-inset search input with chartreuse focus ring; status filter pills — active = chartreuse `tessera-block`, inactive = raised forest chips with `#2A4A37` borders.
- **Orders table**: card converted to `tessera-block` on `#0F1D17`; forest header row; `#1F3D2E` row dividers with `#142620` hover; order numbers + timestamps in JetBrains Mono; customer names set in **italic serif** (Tessera editorial signature); totals in chartreuse mono; fee-payer chip, loyalty point chips (+pts emerald / −pts accent purple) and payment icons (UPI chartreuse / Cash emerald / Card info blue) all restyled to the status palette; action buttons as forest ghost icons with chartreuse/info-blue hover rings; empty state gets serif-italic editorial copy.
- **Verified**: `tsc --noEmit` → 0 errors; browser E2E — status filter switching, Print Logs tab round-trip, zero console errors.

### Documented — Design Governance (ADR-0010, owner directives)
- **LOGIN SCREEN FROZEN**: `src/components/auth/AuthScreen.tsx` is approved as-is at v2.6.4 (commit `5f38efc`) and must not change until the owner explicitly says so. All future redesign passes skip it.
- **Recorded design direction**: *Free 75 Illustrations — Surface Pack* (Figma Community) is the designated illustration source for login **when unfrozen**; the *shadcn/ui Design System* (Figma Community) is the component reference for all post-login surfaces (dark/light mode, buttons, forms). Sandbox is CloudFront-blocked from figma.com — asset export path documented in the ADR.
- Full ADR: [`docs/decisions/0010-login-screen-design-freeze-and-design-system-directives.md`](docs/decisions/0010-login-screen-design-freeze-and-design-system-directives.md).

## [2.6.4] — 2026-10-01 — Live Credentials Re-Hardcoded (Owner Decision)

### Changed — Supabase credentials embedded as hardcoded defaults
- **`render.yaml`**: `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` restored to **hardcoded values in the blueprint** (reverting the v2.6.3 `sync: false` prompt flow) so a Render blueprint apply is zero-touch and every deploy boots connected to the live project. All other v2.6.3 hardening is untouched: service `tsos-pos`, `npm install --include=dev && npm run build`, `NODE_VERSION=22`, immutable asset caching, security headers, `autoDeploy` + PR previews.
- **`src/lib/supabase.ts`**: the live URL and public anon key are now **hardcoded fallback defaults** in the client module (previously the fallback was a fake `demo-tsos-project` key that silently pushed the app into offline-resilient mode whenever env vars were missing). `import.meta.env.VITE_SUPABASE_*` values still take precedence when set, so `.env` overrides keep working. `isSupabaseConfigured()` now evaluates the resolved constants.
- **Rationale (owner directive)**: the anon key is a *public* client key — data is protected by Supabase Row Level Security, not by key secrecy. Embedding it guarantees that Render applies, Vercel builds, and bare `npm run build` with no env config all produce a live-connected bundle, and eliminates the class of "deployed build silently offline" failures. The `service_role` key must STILL never appear in any client-facing file.

### Verified
- `tsc --noEmit` → 0 errors. Browser E2E: app boots authenticated, Header shows **Cloud Synced (24 ms)** — live Supabase session with the hardcoded keys; zero console errors.

## [2.6.3] — 2026-10-01 — Render Blueprint Hardened (`tsos-pos`)

### Changed — `render.yaml` rewritten to production-grade blueprint
- **Service renamed** `tsos-cafe-pos` → **`tsos-pos`** (per operator request).
- **Secret hygiene**: hardcoded Supabase anon key removed from the committed blueprint — `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` now use `sync: false` so Render prompts for values at blueprint-apply time and they never live in Git. Comment block documents that the anon key is RLS-protected by design and the `service_role` key must NEVER appear here.
- **Build command fixed**: `npm run build` → `npm install --include=dev && npm run build` (Vite/TypeScript are devDependencies; explicit install makes the static build environment deterministic regardless of lockfile auto-detection — repo carries `bun.lock` which Render's default npm flow does not consume).
- **Node pinned**: `NODE_VERSION=22` env var (Vite 8 requires Node ≥ 20.19/22.12).
- **Cache + security headers added**: `/assets/*` → `Cache-Control: public, max-age=31536000, immutable` (Vite content-hashed filenames); `/index.html` → `no-cache` so new deploys propagate instantly; global `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (camera/mic/geolocation denied).
- **Deploy semantics explicit**: `autoDeploy: true` (deploy on push) + `pullRequestPreviewsEnabled: true` (free preview URLs for static sites).
- **Self-documenting**: header comment explains *why* a Render **Static Site** and not a Web Service — TSOS is a pure client-side SPA with all backend concerns (Postgres/Auth/Realtime/RLS) in Supabase; Web Service free instances sleep after 15 min (50s+ cold starts unacceptable for POS/QR-scan flows) while static sites are free and never sleep. Rationale matches ADR-0008.

### Deployment Notes
- To apply: Render Dashboard → **New + → Blueprint** → select `OmKardile/tsos-alt` → fill the two prompted env vars → Create. SPA rewrite `/* → /index.html` (deep links `/coolkafe/pos`, `/:slug/t1?token=…`, `/track/:id`, `/superadmin`) unchanged.

## [2.6.2] — 2026-09-30 — Live Cloud Menu + Payment Tender Tessera Polish

### Added — Live Cloud Menu Hydration (closes the "menu from local fallback" data gap)
- **`loadMenuFromCloud`** (`src/lib/store.ts`): new store action that fetches `categories` + `menu_items` from Supabase for the active tenant and maps them into the local menu model (`is_available`, `tax_rate_pct`, prices coerced from `NUMERIC`). Resolves the tenant correctly when `currentTenant.id` is a local seed id (`biz_coolkafe_99`) by looking up the live tenant UUID by slug in the `tenants` table. Falls back to the local seed menu with a console notice when the cloud menu is empty or the fetch fails — offline-resilient behavior preserved.
- **Bootstrap wiring** (`src/App.tsx`): `loadMenuFromCloud()` runs in a `useEffect` whenever `currentTenant.id` changes. Console confirmation: `[TSOS] Menu loaded from Supabase cloud (4 categories, 7 items).`
- **Live DB seeded** (ops action, no code): `categories` (4 rows) + `menu_items` (7 rows) inserted into the live Supabase project for the CoolKafe tenant via PostgREST, using deterministic UUIDs and the seed menu's names/prices/images/veg flags. Anon-key readable; POS, Menu builder and Storefront now render the cloud menu.

### Fixed — provisionTenant UUID Bug
- `provisionTenant()` (`src/lib/supabase.ts`) previously inserted starter categories/menu items with string ids like `cat_<slug>_coffee` / `item_<slug>_espresso` into `UUID PRIMARY KEY` columns — the inserts failed server-side (invalid uuid syntax) and the errors were silently discarded, so Supabase-provisioned tenants never got a seeded menu. Now maps seed category ids to `crypto.randomUUID()` values (keeping category→item referential integrity) and logs insert warnings explicitly.

### Redesigned — Payment Tender Modals (completes the Tessera POS flow)
- **VariantModal** (`src/components/pos/VariantModal.tsx`): forest shell with `tessera-block` shadow, serif italic item name, chartreuse selected variant ring, chartreuse addon checkboxes, forest-inset notes input, chartreuse total, `tessera-cta` "Add to Order". Darker `bg-black/60` backdrop. Added `aria-label` to the close button.
- **PaymentModal** (`src/components/pos/PaymentModal.tsx`): forest shell with `tessera-block` shadow; "COMPLETE SALE TENDER" uppercase tracked label + chartreuse mono amount; method tiles (UPI = chartreuse, Cash = emerald, Card = info blue, Split = accent purple — all in Tessera status palette with 12% fills / 40% rings); UPI view on forest inset with the QR panel kept white for scan reliability; cash view with forest tender input, ghost denomination chips and emerald/rose change-due; split-bill view in accent soft-tint with per-diner UPI/Cash/Card chips in the status palette; bill summary with chartreuse fee pill; **Confirm Payment as `tessera-cta`**; confetti colors switch to chartreuse/emerald/off-white in Tessera. Darker backdrop, disabled-state guard on the CTA hover lift, `aria-label`s on icon buttons.

### Verified
- E2E in browser: live cloud menu on POS (alphabetical order = cloud fetch) → add Espresso (goes straight to cart — live DB items have no variants; variant picker only exists for locally seeded menus) → Charge/Pay → tessera PaymentModal → **Escape closes it (outstanding v2.5.0 test item now explicitly verified ✓)** → reopen → Simulate UPI → Order #104 created with Tessera confetti → receipt renders. Storefront `/coolkafe/t1` shows the ADR-0005 security auto-lock as designed (no valid session token). Zero page errors across the sweep; `tsc --noEmit` → 0 errors.

## [2.6.1] — 2026-09-30 — Tessera Chrome Polish: Header, Navbar, POS, Cart & KDS

### Redesigned — Explicit Tessera Surfaces (conditional `isTessera` classes; warm/dark/obsidian styling preserved untouched)
- **Header** (`src/components/common/Header.tsx`): TSOS brand pill is now a chartreuse block (`#C5F82A` on forest text) with `tessera-block` 3D offset shadow + uppercase tracking; tenant name set in italic serif; model line shows `₹0/mo` in emerald + per-order fee in chartreuse; outlet selector, printer chip, audio toggle, dark-mode toggle and profile chip restyled as forest ghost buttons with chartreuse hover borders; **Fast PIN promoted to the primary `tessera-cta`** (chartreuse block with hover lift); profile dropdown uses `tessera-block` shadow, forest gradient identity card, uppercase tracked chartreuse role badge, and serif italic user name; role avatars use the Tessera status palette (superadmin `#C084FC`, owner `#C5F82A`, manager `#60A5FA`, cashier `#34D399`); SuperAdmin impersonation banner tuned to accent `#C084FC` on forest.
- **WebNavbar** (`src/components/common/WebNavbar.tsx`): active tab is a chartreuse tint block (`bg-[#C5F82A]/15`, chartreuse text + border) with a new **chartreuse baseline marker** (2px underline) beneath it; inactive tabs are sage ghost buttons with forest hover; KDS/Staff/Stock count badges restyled as soft-tinted status chips (amber/emerald/rose at 15% opacity + 40% border) instead of solid fills; "More" dropdown is a `tessera-block` forest panel with chartreuse active rows; low-stock alert chip restyled in rose soft tint.
- **PosScreen** (`src/components/pos/PosScreen.tsx`): status ribbon on forest surface with chartreuse outlet name, emerald drawer chip and chartreuse tabular-nums clock; search input with chartreuse focus ring; category pills use solid chartreuse active state with `2px 2px 0` block shadow; menu cards get forest surface + chartreuse hover border + lift (`hover:-translate-y-0.5` + layered shadow), uppercase tracked chartreuse "Customizable" badge, chartreuse prices in `tabular-nums`, and chartreuse-tinted Add buttons that fill solid on hover; veg toggle, BT chip and empty state tuned to the forest palette.
- **CartDrawer** (`src/components/pos/CartDrawer.tsx`): drawer shell + footer on forest canvas with moss dividers; "Current Order" header with chartreuse items pill; order-type selector is a forest-inset segmented control with solid chartreuse active segment + block shadow; cart rows on canvas-inset with chartreuse item totals and chartreuse kitchen notes; qty stepper on forest inset with chartreuse hover; **Charge / Pay checkout button is the full `tessera-cta`** (chartreuse block, forest text, 3D hover lift); coupon Apply is a `tessera-ghost` button; discount/coupon confirmations in emerald soft tint.
- **KdsScreen** (`src/components/kds/KdsScreen.tsx`): ChefHat icon tile and KITCHEN DISPLAY mono chip switch to chartreuse tint in Tessera (amber in other themes); the board surface itself converts via the new CSS remap below.

### Added — Tessera CSS Override Layer Extensions (`src/index.css` §11)
- **KDS zinc→forest terminal remap**: the KDS board is an always-dark surface built on zinc hexes (`#18181B`, `#121110`, `#0C0A09`, `#27272A`, `#FAFAFA`, `#A1A1AA`, `#71717A`, `#3F3F46`) plus `text-zinc-400/500`. All of these are now remapped to the forest palette under `[data-theme="tessera"]`, so the whole board (tickets, columns, course filter, SLA chips) matches the Tessera canvas while keeping its semantic status accents (blue/amber/emerald/rose).
- **Bug fix**: `hover:bg-[#FAFAFA]` (used by Settings, Inventory, Offers table rows) previously flashed near-white on forest cards in Tessera mode; it now resolves to the forest hover surface `#1A2E25`.

### Verified
- `npx tsc --noEmit` → 0 errors. `agent-browser errors` → clean across `/` (auth), `/coolkafe/pos` (incl. variant modal → add to cart → cart drawer → Charge/Pay footer), `/coolkafe/kds`, `/coolkafe/orders`, `/coolkafe/reports`, `/coolkafe/t1`, `/superadmin`.
- Theme round-trip regression: tessera → dark → tessera verified in-browser; dark mode reverts to zinc/amber/orange chrome as designed; console clean throughout.

## [2.6.0] — 2026-09-30 — Tessera UI Kit Redesign (Editorial Dark / Forest + Chartreuse)

### Added — Tessera Theme System
- **New `tessera` ThemeMode** (`src/types.ts`, `src/lib/store.ts`, `src/App.tsx`): a fourth theme option alongside `warm` / `dark` / `obsidian`. Tessera is the new **default theme** — an editorial dark design system pairing italic serif headlines with crisp sans body, deep forest surfaces, and a vivid chartreuse action accent. Inspired by [uiverse.io/ui-kits/tessera](https://uiverse.io/ui-kits/tessera).
- **Tessera design tokens** (`src/index.css` ~330 new lines): a full `[data-theme="tessera"]` / `.tessera` CSS variable layer mapping every warm-cream hex color to forest equivalents when the theme is active:
  - **Forest palette**: canvas `#0A1410`, surface `#0F1D17`, surface-2 `#142620`, divider `#1F3D2E`, border-strong `#2A4A37`
  - **Chartreuse action accent**: `#C5F82A` (hover `#B8E633`), with soft tint `rgba(197,248,42,0.12)`
  - **Text hierarchy on forest**: primary `#F5F4EE` (warm off-white), secondary `#9BB5A5` (sage), muted `#6B8579` (moss)
  - **Status colors tuned for forest**: emerald `#34D399`, amber `#FBBF24`, rose `#F87171`, info `#60A5FA`, accent `#C084FC`
- **Typography pairing** (the Tessera signature): `Instrument Serif` italic for h1/h2/h3 headlines + `.font-display`; `Inter` for body; h4 stays sans uppercase tracked for sub-section labels. `Instrument Serif` + `Inter` + `JetBrains Mono` loaded via Google Fonts in `index.html`.
- **3D isometric block-motif utilities** (Tessera signature volume):
  - `.tessera-block` — hard 3D offset shadow (`3px 3px 0 #1F3D2E`) for hero cards.
  - `.tessera-block-chartreuse` — chartreuse-offset variant for accent cards.
  - `.tessera-cta` — chartreuse CTA button with `translateY(-1px)` hover lift + 3D shadow.
  - `.tessera-ghost` — transparent forest button with chartreuse hover border.
  - `.tessera-grain` — subtle CSS-only radial-gradient grain texture for forest surfaces.
- **Tessera override layer** for: deep backgrounds, elevated card surfaces, inset surfaces, text hierarchy, moss borders, hover states, header/nav, form controls (chartreuse focus ring), status badges (emerald/amber/rose/info/accent tuned for forest), 3D shadows on `.shadow-xs/sm/lg/xl/2xl`, scrollbar (chartreuse hover).

### Redesigned — Surfaces (Tessera Showcase)
- **AuthScreen** (`src/components/auth/AuthScreen.tsx`): full Tessera redesign — forest card with `tessera-block` shadow, italic serif "TSOS Cafe Operating System" headline, chartreuse coffee-cube icon with 3D offset, 3D isometric block motif accents (chartreuse + emerald cubes) in the brand banner, ghost tab-toggle with chartreuse active underline, forest-inset form inputs with chartreuse focus ring, chartreuse `tessera-cta` primary submit button, 4 ghost quick-demo role buttons (SuperAdmin highlighted chartreuse), forest-inset credentials cheat-sheet with pulsing emerald "Active" indicator.
- **ReportsScreen** (`src/components/reports/ReportsScreen.tsx`): Tessera polish — forest header bar with `tessera-block` icon tile, italic serif section heading, chartreuse `tessera-cta` Export button, 4 KPI cards now use `tessera-block` shadow + uppercase tracked labels + forest-inset icon chips. The "Savings with TSOS" card is a chartreuse-tinted hero (`tessera-block-chartreuse`).
- **LiveOpsPulse** (`src/components/reports/LiveOpsPulse.tsx`): `tessera-block` shadow, chartreuse pulsing Activity icon, solid chartreuse "● LIVE" badge with 3D offset, forest-inset stat tiles, chartreuse insight-strip icon.
- **OrderTypeBreakdown** (`src/components/reports/OrderTypeBreakdown.tsx`): `tessera-block` shadow, chartreuse Utensils icon, forest tooltip with 3D offset + chartreuse revenue figure, bordered percentage bars on forest inset.
- **Loading screen** (`src/App.tsx`): forest bg with chartreuse pulsing dot + sage "Starting TSOS Cloud Engine…" text.
- **App wrapper** (`src/App.tsx`): `tessera-grain` texture on the main min-h-screen wrapper when tessera theme is active.

### Fixed — Build / Sandbox Infrastructure
- **Restored `.gitignore`** that was accidentally reverted to a minimal version (only `skills/` + `node_modules/`) during the fresh re-clone — the full exclusion list (`.env*`, `*.log`, `.zscripts/`, `Caddyfile`, `vite.pid`, `start-dev.sh`, `skills/`, `mini-services/`, `tests/`, `examples/`, `download/`, `upload/`, `db/`, `prisma/`) is back in place. Prevented accidental commit of `.env` (live Supabase anon key) + `dev.log` + sandbox infra.
- **Fixed file modes** on 40+ tracked files that had been flipped to `100755` (executable) by the `tar` extraction during the fresh re-clone — reset to `100644` via `git config core.fileMode` + `chmod`. No content changes, just mode restoration.
- **Recreated `.zscripts/dev.sh` + `.zscripts/run-vite.sh`** (the sandbox dev-server launcher) after the `/tmp` backup was cleaned up by the sandbox between turns. The launcher uses `start-stop-daemon --background` to daemonize Vite so it survives shell exit.

### Verification (agent-browser)
- All surfaces render with zero console errors: `/` (auth, Tessera showcase), `/superadmin`, `/:slug/pos`, `/:slug/kds`, `/:slug/orders`, `/:slug/reports` (LiveOpsPulse + KPI cards + OrderTypeBreakdown with explicit `tessera-block` shadows), `/:slug/t1` (storefront), `/track/live`.
- Tessera styles verified via `getComputedStyle`: body bg = `rgb(10, 20, 16)` (forest `#0A1410`), cards = `rgb(15, 29, 23)` (forest `#0F1D17`), CTA bg = `rgb(197, 248, 42)` (chartreuse `#C5F82A`), h1/h2/h3 font-family = `"Instrument Serif", ...` with `font-style: italic`, `data-theme="tessera"` on `<html>`.
- `npx tsc --noEmit` → **0 errors**.

---

## [2.5.0] — 2026-09-30 — Reports Analytics Expansion, Modal UX Fix & Documentation Re-alignment

### Added — Reports Screen
- **Live Operational Pulse widget** (`src/components/reports/LiveOpsPulse.tsx`): a real-time "right now" dashboard card showing orders in the last 60 minutes (revenue + count + per-minute velocity), active dining tables (occupied/total + % occupied), kitchen load (tickets in `new`+`preparing` state, color-coded idle→light→moderate→busy→critical), and staff currently on shift. Includes a contextual insight strip that adapts its message to the current state ("kitchen at critical load — consider pulling a runner" vs "floor is quiet — good moment for restocks").
- **Order Type Breakdown donut chart** (`src/components/reports/OrderTypeBreakdown.tsx`): a Recharts donut visualizing the split of orders by type (Dine-In / Takeaway / Delivery) with revenue + percentage share per slice. Fills a gap in the Reports screen — previously only payment-method breakdown was shown, not order-type analytics. Renders an empty state when no orders exist.
- **`useCountUp` / `useCountUpFormatted` hook** (`src/hooks/useCountUp.ts`): animates a number from its previous value to the target over a configurable duration (default 900ms) using `requestAnimationFrame` + an ease-out cubic curve. Used by the 4 Reports KPI cards (Gross Sales, Orders Placed, AOV, Savings) so they visibly "tick up" on mount and when values change — gives the dashboard a live feel without re-rendering the whole tree.

### Fixed — POS Modal UX
- **Escape key + backdrop-click now dismiss `PaymentModal` and `VariantModal`**. Previously the only dismiss affordances were the X button and "Back to Cart" — a friction point for fast cashier flow. Added a `useEffect` keydown listener for `Escape` to both modals; the PaymentModal handler is gated on `!isProcessing` so a mid-flight payment can't be aborted by a stray keystroke. Backdrop click (`if (e.target === e.currentTarget) onClose()`) added as a second standard affordance.

### Fixed — Documentation Re-alignment
- **Version drift corrected**: README badges, tech-doc §2.1, PROMPT.md, and business-doc all claimed React 18 / Vite 6 / TypeScript 5.2 / Tailwind 3.4. Updated to match the actual `package.json`: React 19 / Vite 8.3 / TypeScript 7.0 / Tailwind 4.3.
- **Stale git URL fixed**: README now points to `https://github.com/OmKardile/tsos-alt.git` (was `jhonny-silverhand/tsos-alternate`, the reference repo that was audited, not this repo). Clone dir corrected to `tsos-alt`.
- **`docs/README.md` index corrected**: added `compact6.md` + `compact7.md` (was stopping at 5), added ADRs `0006`–`0009` (was stopping at 5), removed the nonexistent `specifications/` subfolder (the 10 spec `.md` files live directly in `docs/`).
- **README "ADRs 0001 through 0008"** corrected to **"0001 through 0009"** (ADR 0009 RBAC was missing from the mention).
- **Deleted `technical-dcoumentation.md`** (the typo'd byte-identical duplicate of `technical-documentation.md` — same MD5 `ca478d34…`).
- **Created root `compact.md`**: single-page dense project-state summary for fast cold re-onboarding, points to `docs/compacts/` for chronological detail.
- **Created root `decisions.md`**: single-file ADR summary (Context → Decision → Alternatives → Consequences for all 9 ADRs), points to `docs/decisions/` for full ADRs.

### Fixed — Build / Type Configuration
- **`tsconfig.json` now scopes type-checking to `src/**/*`** and excludes sandbox-only dirs (`skills`, `mini-services`, `tests`, `examples`, `download`, `upload`, `db`, `prisma`). Previously `npx tsc --noEmit` would surface dozens of spurious errors from sandbox infrastructure files (e.g. `skills/*/scripts/*.ts` importing `z-ai-web-dev-sdk`, `examples/websocket/*.ts` importing `socket.io-client`).
- **Added `"node"` to tsconfig `types`** (alongside `vite/client`) so the `Buffer` global in `src/lib/sessionService.ts` resolves — was a pre-existing 2-error type leak.
- **`.gitignore` extended** to exclude sandbox-only infrastructure (`Caddyfile`, `vite.pid`, `.zscripts/`, `start-dev.sh`, `skills/`, `mini-services/`, `tests/`, `examples/`, `download/`, `upload/`, `db/`, `prisma/`) so it doesn't pollute the upstream repo when committing local changes.

### Infrastructure — Live Supabase DB
- **`.env` now configured with live Supabase credentials** (`VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` for project `vbufsuzzmehsidshopku`). `isSupabaseConfigured()` returns `true`; all Supabase-aware code paths (auth `getSession`, tenant provisioning, realtime subscriptions, ephemeral table-session RPC) now hit the live DB instead of the offline-resilient fallback. Live DB data gaps outstanding: `categories` + `menu_items` tables empty (menu served from local seed fallback); `customers` + `offers` tables return HTTP 404 to anon (migration re-run needed).

### Git History Recovery
- **Re-cloned fresh from `github.com/OmKardile/tsos-alt`** to recover the real git history (the local `.git` was previously the Next.js sandbox template — only 4 UUID-named commits, no remote, wrong author). The fresh clone preserves the upstream commit history (`944ddb6 feat(rbac)…`, `d26a136 feat(security)…`, etc.) and the `origin` remote. Git identity set to `Omkar Kardile (Z) <omkardile84@gmail.com>`. Local changes (`.env`, `vite.config.ts`, `.zscripts/`, `worklog.md`, PaymentModal/VariantModal Escape fixes) re-applied on top.

---

## [2.4.0] — 2026-09-25 — Multi-Platform Cloud Deployment: Render & Vercel Blueprints

### Deployment & Cloud Infrastructure
- **Render Cloud Configuration (`render.yaml`)**: Added Infrastructure-as-Code Blueprint for 1-click Render deployment as a free, high-performance **Static Site**.
- **Edge Routing & SPA Rewrites**: Configured `/* -> /index.html` rewrites on both Vercel (`vercel.json`) and Render (`render.yaml`) to ensure seamless deep-linking for tableside QR sessions (`/:slug/t1?token=...`), KDS, and POS terminals without 404 errors.
- **Zero Cold-Start Architecture**: Documented hosting benefits of Render Static Sites over web services (free tier CDN hosting with zero spin-down / sleep delays).
- **Deployment Documentation**: Expanded `help.md` and `README.md` with side-by-side deployment walkthroughs and feature comparisons for Vercel vs. Render.

---

## [2.3.0] — 2026-09-25 — Strategic Streamlining: Purged Hardware Hub & Electron Pivot

### Removed & Deprecated
- **Removed Hardware Hub & Downloads Modal**: Completely deleted `HardwareDownloadsModal.tsx` and removed all download triggers from `Header.tsx`, `SettingsScreen.tsx`, and `App.tsx`.
- **Cancelled Native Customer Mobile App**: Eliminated Android APK showcase. Established pure camera QR ordering workflow: diners scan the physical QR code with their mobile phone camera, instantly opening the web storefront directly in their mobile browser with time-bound 10-minute sessions.
- **Frozen Windows WPF Native Client**: Standalone C# / WPF desktop client is officially frozen. Transitioned all desktop POS roadmap to cross-platform **Electron.js** wrapping the unified Web POS codebase for raw ESC/POS WebUSB/WebSerial access.

---

## [2.2.0] — 2026-09-25 — Realtime WebSockets & Comparative Feature Migration

### Real-Time Synchronization & Offline Resiliency
- **Supabase Realtime WebSockets**: Integrated `realtimeService.subscribeToTenantRealtime` for instant zero-reload KDS ticket progression, live order arrivals with synthesized Web Audio chimes, and automatic floor table occupancy syncing.
- **Offline Order Queue**: Implemented localStorage-backed queue (`tsos_pending_offline_orders`) ensuring continuous checkout operations during network dropouts, with automatic background synchronization on browser `'online'` reconnection.

### Hardware & Operations Hub
- **Hardware Integration & Downloads Modal**: Added centralized hub accessible via Header and Settings for downloading the Windows Desktop POS client (.exe), Android Tablet APK, and thermal printer ESC/POS driver documentation.
- **Fast Touchscreen Staff PIN Pad**: Integrated `StaffPinPadModal` featuring an on-screen numeric keypad for 2-tap cashier and barista shift transitions on counter touchscreens.

### Testing & Table QR Hardening
- **Storefront Testing Toggles**: Added `[Expire (Test History)]` and `[Tamper]` buttons to easily simulate and test browser history protections and anti-spoofing guards.
- **Table Card Guidance**: Updated table card modal with security advisories on short-lived sessions and anti-tamper QR protocols.

---

## [2.1.0] — 2026-09-25 — 10-Minute Ephemeral Table QR Session Security

### Security & Anti-Fraud
- **Ephemeral Session Tokens**: Implemented a dual-token architecture where scanning a table's physical QR code (`GET /api/table/:slug/:tableNumber?token=:permanentQrToken`) verifies the permanent secret and issues a cryptographically signed HMAC-SHA256 session token with `expires_at = now() + INTERVAL '10 minutes'`.
- **Database Backed Session Store**: Created `table_sessions` table with foreign keys, indexes, and RLS policies for tenant staff and anonymous diners.
- **Order Submission Guard**: Added enforcement requiring `X-Table-Session-Token` header on `POST /api/orders`. Rejects with 401/403 if signature is invalid, table ID is spoofed (`TABLE_MISMATCH`), session is expired (`SESSION_EXPIRED`), or the table is settled (`TABLE_SETTLED`).
- **PostgreSQL Session RPCs**:
  - `issue_ephemeral_table_session`: Verifies physical token, revokes stale sessions, issues fresh 600s token.
  - `verify_and_consume_table_session`: Validates token signature, table ID, and table dining status.
  - `renew_ephemeral_table_session`: Re-scans physical token for renewal handshake.
  - `purge_expired_table_sessions`: Maintenance procedure to purge sessions older than 24 hours.

### Storefront UI / UX
- **Live Countdown Timer**: Integrated a real-time `mm:ss` countdown badge in the storefront header.
- **Warning States**:
  - Amber warning banner appears at $\le$ 2 minutes remaining with instant `[Renew Now]` action.
  - Pulsing red badge at $\le$ 30 seconds remaining.
- **Security Auto-Lock Screen**: Fullscreen backdrop overlay triggers automatically when the timer reaches 00:00, disabling item selection and checkout with instructions to scan the physical QR sticker to renew.

---

## [2.0.0] — 2026-09-25 — Multi-Tenant Cloud Architecture & Obsidian Mode

### Multi-Tenant Core & Backend
- **PostgreSQL Schema (Migration 001)**: Deployed 24 core tables to Supabase with strict `tenant_id` foreign keys and cascading deletes.
- **Row-Level Security (RLS)**: Enforced tenant isolation across all tables using session-based `current_tenant_id()` extraction.
- **Dynamic Scoped Routing**: Implemented path-based URL routing (`/:slug/pos`, `/:slug/kds`, `/:slug/orders`, `/:slug/inventory`, `/:slug/reports`, `/:slug/settings`, `/:slug/t:tableNumber`, `/superadmin`).
- **SuperAdmin Workspace Impersonation**: One-click "Enter Tenant Workspace" hook for operator support.

### Prototype Chrome Purge & Production Hardening
- **Removed Prototype Chrome**: Eliminated top "SURFACES" switcher bar, mock network sliders, fake latency toggles, tutorial purple dots (`GuidanceTooltip`), and demo reset handlers.
- **Production Store Bindings**: Connected POS actions, cart workflows, and customer lookup directly to persistent Zustand stores and live Supabase queries.

### Design System & Obsidian Mode
- **System-Wide Obsidian Terminal Theme**: Added global high-contrast industrial dark mode (`#0C0A09` background, `#292524` borders, phosphor amber `#F59E0B` and safety emerald `#10B981` accents).
- **Single-Button Header Toggle**: Added header Sun/Moon button toggling the entire system between Warm Cafe Cream and Obsidian Dark Terminal.

---

## [1.0.0] — 2026-09-24 — Initial Offline-First POS Prototype

### Added
- Core POS billing terminal with category selection, search, variant customization, and order type selector (Dine-In, Takeaway, Delivery).
- Kitchen Display System (KDS) board with stage filtering (`new`, `preparing`, `ready`, `completed`) and SLA timers.
- Loyalty & Customer CRM engine with 1 pt per ₹10 accrual, 1 pt = ₹1 redemption, and tier progression.
- Multi-mode payment engine: Dynamic UPI QR code generator, cash tender calculator, card terminal mock.
- Thermal receipt preview and printing generator.
- Inventory recipe depletion tracking on order completion.
