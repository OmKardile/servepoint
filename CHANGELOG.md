# Changelog

All notable changes to **ServePoint — smartPOS** (formerly TSOS — The Cafe Operating System; renamed per owner directive 2026-10-01) are recorded in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [5.132.0] — 2026-10-04 — The charts stand down

### Added — keyboard dignity for every chart surface

- **The focus leak closes** (`src/lib/chartvoice.ts` + `src/main.tsx`): recharts ships every chart `<svg>` with `tabindex="0"`, so a Tab from the KPI cards landed INSIDE the chart — a UA auto-outline dead stop in a figure that is either `aria-hidden` (decorative: the sibling text already speaks its numbers) or `role="img"` (labelled: the label IS the voice). In both cases the focusable internals were a stop with nothing to read and nothing to press — and in the aria-hidden case, a stop screen readers cannot even see. `installChartHush()` strips `svg[tabindex]` inside `.recharts-wrapper` the moment a chart mounts: one rAF-coalesced MutationObserver installed once from the app entry, so all nine surfaces (Reports ×5, Dashboard ×3, Floor ×1) are covered and every future chart inherits the discipline free.
- **The Dashboard's Daily Sales card speaks its ledger**: the hardcoded "Line chart of today's hourly sales…" label retired; the aria sentence now composes from the same buckets the lines render — *"Today's hourly sales for Dine-in, Takeaway and Delivery — peak 5 pm at ₹X, ₹Y so far today"* (with an honest "no sales yet today" tail).

### Styled — one tooltip voice for the whole house

- The tooltip register (Dashboard's designed voice — white card, hairline #E3E7E0 border, radius 12, the deep 28px shadow, 8×12 padding, gray label line) is promoted to `CHART_TOOLTIP_STYLE` + `CHART_TOOLTIP_LABEL` in `src/lib/chartvoice.ts` and applied at every Tooltip. The drift heals: three Reports tooltips carried a weaker 14px shadow, one had none at all, and none spoke the gray label — now all nine surfaces are byte-identical, and the browser's default black outline is gone from the Tab flow.

### Verified

- tsc EXIT=0; build EXIT=0. Live E2E (dev, Reports + Floor): 5 chart svgs → 0 focusable after the hush; a 9-Tab walk from "Refresh report" lands on "Export payment mix as CSV" with `inChart: false` — the flow no longer falls into chart internals; hovered day-by-day tooltip reads label "28 Sept" in #6B6B6B + 4px margin, container border/radius/shadow/padding byte-identical to the canonical register; Floor rhythm svg hushed. The StatCard `tabIndex={0}` sections stay (deliberate: keyboard-triggered sparklines, v5.25.0 lineage). Console clean after a cleared-buffer reload (a dev-only createRoot message and a 0-size chart warning were HMR-transition artifacts, not app behavior). READ-ONLY round — zero cloud writes.

## [5.131.0] — 2026-10-04 — The book shows the way

### Added — Guests: the ledger learns to speak the distance to the next rung

- **The ladder** (`src/components/customers/CustomersScreen.tsx`): the tier badge names the rung a guest stands on (5.129.0); this release the ledger also names the way to the NEXT one. Every non-VIP row gains a ladder line — *"one more paid visit makes a **Regular**"* / *"two paid visits make a **Regular**"* — and a Regular hears the nearer of VIP's two doors: *"N more paid visits make(s) a **VIP**"* or *"₹M more makes a **VIP**"* (the predicate is 5 paid visits OR ₹5,000 paid — naming the nearer door never closes the other). A VIP holds the top rung: the row stays silent.
- **One ledger, two voices**: the ladder reads the SAME `tierKeyOf` the badge, the tiles, the list predicate and the CSV count with — distance is ledger truth, not a second rule. The rung word wears the target tier's own text tone (sage for Regular, gold for VIP); the line rides the row's whisper register (11.5px, TrendingUp icon) and lives inside the name button — tapping it opens the drawer where the full sentence waits.
- **The drawer's rung strip**: the guest drawer gains a three-rung stepper (NEW — REGULAR — VIP) between the ledger stats and the day's voice: rungs reached fill with their tier tone (the current one wears a ring), rungs ahead stay hollow; the sentence beneath carries the distance in words, and a VIP hears the definition restated — *"Holds the top rung — 5 paid visits or ₹5,000 paid."* The strip is aria-hidden; the words are the announcement.

### Fixed — 5.130.0 errata

- The CHANGELOG's verified example for the shelf whisper read *"Showing 2 of 4 ingredients for 'co'"*; the live sentence says **1** of 4 (Coffee beans is the only survivor). Corrected — never ship an unverified example, including retroactively.

### Verified

- tsc EXIT=0; build EXIT=0. Live E2E (QR Flow book, 3 guests — all NEW rung): Maya (1 paid visit) → "one more paid visit makes a Regular"; Priya & Ravi (0 paid visits) → "two paid visits make a Regular"; Maya's drawer → stepper NEW filled + ring, REGULAR/VIP hollow, sentence present. The Regular/VIP voices share `tierKeyOf`'s live-verified predicates — the book holds no regular or VIP yet, so the distance math is verified at the rung the data reaches (Platform offers no workspace door and no CheeseBurg owner credentials exist in-repo). Console delta ZERO. READ-ONLY round — zero cloud writes.

## [5.130.0] — 2026-10-04 — The shelf narrows

### Added — Inventory: the LOW STOCK and OUT OF STOCK tiles take up the tile grammar

- **The third crossover** (`src/components/inventory/InventoryScreen.tsx`): the Floor's filter-tile grammar (5.128.0) crossed to Guests last release (5.129.0); this release it reaches the shelf. The LOW STOCK and OUT OF STOCK stat tiles become filter tiles — tap narrows the shelf list to that ledger state, tap again releases (`aria-pressed`, gold ring + ring/30, hover lift). The tiles' numbers stay whole-shelf, always; the list below narrows, and the count line says so.
- **One predicate, two readers**: the tile filter uses the SAME boundaries the tiles count with and the row chips wear (`low` = above zero but at/below reorder point; `out` = at/below zero) — the amber and red chips on rows and the tiles can never disagree.
- **The whisper reaches the shelf**: the toolbar's count line (5.123.0 badge) now speaks the Floor's sentence — *"Showing 1 of 4 ingredients for 'co' — the tiles above still count the whole shelf"* — whenever the search or a tile narrows the list. The "4 ingredients on the shelf — every hand move lands in the diary" fact line stays for the unfiltered shelf.
- **The miss says why, third register**: a tile-only miss speaks the shelf's health — *"No low ingredients — the shelf holds 4 ingredients — every one sits at or above its reorder point. Tap the tile again, or show the whole shelf."* / *"Nothing is out of stock — none has run dry."* (Package / PackageX icons); a search miss keeps its words and adds the either-can-miss clause when a tile is also in play, with one gold **Clear both**. The empty-shelf truth ("The shelf is empty") stays its own sentence.

### Styled — one primitive, two registers

- `StatCard` grows the filter register instead of the screen growing new tiles: when a card is handed `onToggle` it renders as the Floor's pressed button (gold ring, hover lift, focus ring); passive cards keep their `section` anatomy byte-for-byte. Ingredients and Stock value stay passive facts — they count, they don't cut.

### Verified

- tsc EXIT=0; build EXIT=0. Live E2E (QR Flow shelf, 4 healthy SKUs — 0 low, 0 out): Low stock tile → aria-pressed + "No low ingredients" + definition + Show the whole shelf; Out of stock tile → "Nothing is out of stock"; tile + query "zz" → either-can-miss + Clear both; release → 4 rows restored; search "co" → "Showing 1 of 4 ingredients for 'co' — the tiles above still count the whole shelf"; count line returns to the fact line on release. Console delta ZERO. READ-ONLY round — zero cloud writes.

## [5.129.0] — 2026-10-04 — The book answers

### Added — Guests: tier tiles filter, and the book can be carried out

- **The tier tiles speak the Floor's grammar** (`src/components/customers/CustomersScreen.tsx`): the Regulars and VIPs tiles — passive counters since the CRM was born — are now filter tiles (`aria-pressed`, gold ring + hover lift, the 5.128.0 tile dialect). Tap to narrow the book to that tier, tap again to release. The definition lives in ONE place: `tierKeyOf`/`TIER_META` (split from `tierOf`) — tiles, list predicate, badge and CSV all read the same ledger truth (2+ paid visits = regular; 5+ or ₹5,000 = VIP).
- **The whisper grows honest**: the 5.122.0 count line now speaks the Floor's sentence — *"Showing 1 of 3 guests for 'maya' — the tiles above still count the whole book"* — the tiles' numbers stay whole-book; the narrowing never rewrites the headline.
- **The miss says why, with the ledger's definition**: a tier-only miss names its bar — *"No regulars to show — the book holds 3 guests — none of them a regular yet (a regular has 2+ paid visits). Tap the tile again, or show the whole book."*; a VIP miss carries the Crown and the ₹5,000 clause; search + tile together say *"either can miss"* with one gold **Clear both**. The empty-book truth ("No guests yet") stays its own sentence — an empty book is not a filtered one.
- **The book, carried out** (CSV, shared `lib/csv.ts`): a header CSV button exports the CURRENTLY NARROWED list — tiles and search decide what the counter is looking at, the file carries exactly that (Bills' house law). Columns: Name, Phone, Tier, Paid visits, Paid total (INR), Last visit, On the book since, Email, Notes — injection-safe + UTF-8 BOM from the shared lib. Refuses to run while the narrowing shows nothing — an empty narrowing exports an empty file, so the button disables.

### Styled — the compact register joins the shared EmptyState

- `EmptyState` (5.121.0) gains a **`compact`** variant — the h-14 rounded-2xl chip, half the air — for misses that live inside a sidebar or another component's list. Three private shapes retire into it: Messages' no-rooms truth and filter-miss (the Unread toggle now owns its side of "either can miss"), and Inventory's shelf search-miss. Words stay per-screen; the shape is the house's. Main-screen misses keep the full-size default.

### Verified

- tsc EXIT=0 (×2 across the round); build EXIT=0. Live E2E (QR Flow book, 3 guests · 0 regulars · 0 VIPs): Regulars tile → gold ring + "No regulars to show" + definition + Show the whole book; VIPs tile → Crown miss; tile + query "zz" → "either can miss" + Clear both; release → whole book restored; whisper arithmetic live; CSV button disabled under an empty narrowing. Compact EmptyStates verified in Messages (room filter "zzqx") and Inventory (shelf search "zz"). Console delta ZERO. Round note: cloud reads only (CRM reads + one realtime subscribe); the CSV export is a local file build — no cloud writes.

## [5.128.0] — 2026-10-04 — The floor answers

### Added — Floor joins the shell-search contract

- **The gap**: six screens spoke the search contract (F&D, Bills, Menu, Guests, Inventory, Messages rooms) and the Floor — the counter's biggest board — sat outside it; the box appeared nowhere while a host scanning twenty sections had no way to cut to one.
- **The board answers the query** (`src/components/floor/FloorScreen.tsx`): the header box now appears on Floor with the honest placeholder **"Search tables or sections…"**. A section whose NAME says the word keeps its whole list (the section is the hit); otherwise only tables whose number matches survive. A gold whisper keeps the record straight while survivors show: *"Showing 1 of 2 tables for 'patio' — the headline above still counts the whole floor"* — the seats-busy headline is the floor's global truth and does not silently become the view's count.
- **The miss says why** (shared `EmptyState`): a search miss quotes the word and states its reach — *"Search reads table numbers and section names"*; a status-tile miss speaks the tile's word — *"No available tables — the floor holds 2 tables — none of them available. Tap the tile again, or show the whole floor."*; both together say *"either can miss"*, with one gold button that clears exactly what it names (Clear search / Show all tables / Clear both). The floor's truth state ("No tables yet") stays its own sentence — an empty floor is not a filtered one.
- **Survivors say why**: section headings and table numbers glint through the shared `MarkHit` — the last list surface joins the glint sweep.

### Fixed — a stale parked verdict, corrected

- The parked list carried "menu-wide item search across categories (needs a design decision)" — audit this round found the behavior **already ships**: Menu's query filters every category group and keeps categories whose name matches (`MenuScreen.tsx` `catsWithItems`). Parked item closed with evidence; no code change.

### Verified

- Live (QR Flow floor, 2 tables): "patio" → Patio section whole + mark on "Patio" + whisper; "t2" → mark on card "T2"; "zzqx" → honest miss + Clear search; Available tile (0) → "No available tables" + Show all tables; both stacked → "either can miss" + Clear both; clear → board fully restored (2 cards, tile released, zero marks). tsc EXIT=0; build EXIT=0; console delta ZERO. READ-ONLY round — zero cloud writes.


## [5.127.0] — 2026-10-04 — The record hands over whole

### Added — Plan & billing, the calm record behind the clock

- **The gap**: 5.126.0 gave the tenant the trial *clock* (the band), but the full *record* — plan, cycle, price, every date — was still readable only by the Platform console. Active tenants had nowhere to see their next charge (deliberately not as a permanent band); a trialing tenant saw the countdown but not the arithmetic behind it.
- **Plan & billing section in Settings** (`src/components/settings/BillingSection.tsx`, owner-gated like Café brand / Business profile — staff run tickets; the plan is the owner's business): one RLS-scoped read renders the whole row — plan name, status chip (Trialing = gold tint / Active = sage / unknown = neutral), billing cycle, monthly price, trial window dates, next charge, on-board date — with `tabular-nums` right-aligned values in the Platform's money grammar, and a secondary line that speaks the one fact the row is about ("13 days left · no charge yet" / "Next charge 31 Oct 2026" / "No charge scheduled on record").
- **Three states, three truths, no collapses**: *no record* says "No subscription on record… nothing is being charged, and nothing is scheduled to be" with a real door to Support (`goSection`); *failed read* says "Couldn't read your subscription" with the error hint and a **Try again** button — `fetchOwnSubscriptionStrict` (api.ts) now throws on failure so an RLS error can never be read as "no record", while the band's silence-on-failure contract stays intact over the same query.
- **Every door is real**: the Support door lands on the actual Support screen (verified live); rows the row can't answer (e.g. "Next charge" on a trial) simply don't render — no invented dashes.

### Styled — the record in the house grammar

- Record card in the sage panel idiom (matches Appearance's locked-theme card), white `dl` inset with hairline row dividers, right-aligned `tabular-nums` values, icon chip (Hourglass for trials, CreditCard for paid plans), status chips in the house palette, hover-tint Support door. Mobile 390px: all five rows wrap-free, zero horizontal overflow.

### Verified

- Live as the QR Flow owner: nav shows Plan & billing between Business profile and Notification; panel reads "Starter plan / Trialing / Monthly / ₹0.00 / Trial started 02 Oct 2026 / Trial ends 16 Oct 2026 / On board since 02 Oct 2026" (matches server truth: provisioned 02 Oct +14d trial); secondary line "13 days left · no charge yet" agrees with the band; Support door navigates; active-tenant and no-row paths are code-verified (no CheeseBurg operator credentials held). tsc EXIT=0; build EXIT=0; console delta ZERO. READ-ONLY round — zero cloud writes.


## [5.126.0] — 2026-10-04 — The clock crosses over

### Added — the tenant sees their own trial

- **The gap**: 5.125.0 taught the *Platform console* to speak the trial clock, but the owner who lives inside the trial never heard it. Migration 005 has always carried **"Tenant read access on own subscription"** (RLS: `tenant_id = current_tenant_id()`), and the app simply never asked — a QR Flow owner had no way to know their trial ends 16 Oct 2026, or that no charge is scheduled.
- **The subscription band** (`src/components/shell/SubscriptionBand.tsx`, wired into the tenant AppShell between header and content): once per session it reads the RLS-scoped row (`fetchOwnSubscription`, any failure → silence) and speaks only a trial it can date — no row, no `trial_end`, or an unworded status renders nothing. Absence is silence, not a lie.
- **The words, tenant-voiced**: "Your **Starter** trial **ends 16 Oct 2026** — **13 days left** · no charge yet." Day grammar matches the Platform cell exactly (calendar-day, midnight-to-midnight; "ends today"/"ends tomorrow" land on their days). Past the window it says what happened and stops: "Your Starter trial ended on 16 Oct 2026 · no charge was made." — no promised doors (no self-serve billing exists), no invented grace period.

### Styled — the ramp of urgency is the house palette

- Four visual registers by truth: **calm >7 days** — sage `#EAF0EC`/teal; **soon ≤7** — gold tint `#F3E8CF`; **last ≤3** — deep gold `#E9D9AF` (Platform's amber kin); **ended** — canvas recess with hairline. Dates and day counts set in `tabular-nums`; one `Hourglass` mark; polite `role="status"`; 160 ms fade. Not dismissible — it is time-boxed (14 days at provision), slim, and it is the operator's own money-clock.

### Refactored — one clock for both sides of the console

- PlatformScreen's private `daysUntil` + `formatDate` and the billing cell's words moved into **`src/lib/billing.ts`** (`daysUntil`, `formatBillingDate`, `trialBucket`, `planLabel`, `subscriptionWords`) — the MarkHit (5.120.0) / EmptyState (5.121.0) arc again: private becomes shared the moment a second surface needs the same truth. The Platform cell is now a thin projection; zero visual delta on the console.

### Verified

- Live (device clock UTC): QR Flow band renders "Your Starter trial ends 16 Oct 2026 — 13 days left · no charge yet" (calm sage, 13 > 7); CheeseBurg (active) renders no band by design. Platform Subscriptions unchanged after the lib extraction. tsc EXIT=0; console delta ZERO; screenshots. READ-ONLY round — zero cloud writes (one RLS-scoped SELECT per tenant session).


## [5.125.0] — 2026-10-04 — The trial clock shows

### Added — the Subscriptions row answers "when does money move?"

- **The gap**: the subscriptions table's `select('*')` always carried `trial_end` / `current_period_end` / `trial_start` (the provisioning wizard even writes `trial_end = +14d` for trials), but the client type and the UI never surfaced them — a trialing business sat in the ledger with a bare **"—"** under Next billing, and the operator had to do date arithmetic to know when the trial runs out (or that a charge is even coming).
- **The billing cell speaks the row's truth**: a trialing subscription now answers **"Trial ends 16 Oct 2026"** with a secondary line **"13 days left · no charge yet"** (calendar-day math, midnight-to-midnight — "ends today" lands on the day itself); inside 3 days the cell turns amber. An active subscription answers with its next charge in the house date grammar. An unknown stays **"—"** — no invented dates.
- **Column renamed to "Next charge"** so the header stays truthful over cells that answer "no charge yet"; mobile card shares the same words and the same helper.

### Styled — money reads like money

- **Monthly price / Final rate columns are right-aligned with `tabular-nums`** (desktop table + mobile dl) — rupee amounts now align on the decimal instead of trailing ragged.
- **Date grammar unified**: the subscriptions table used raw `toDateString()` ("Sat Oct 31 2026") while Businesses used the house `formatDate` ("01 Oct 2026"); every date on the Platform console now speaks one grammar.

### Verified

- Live (device clock UTC): QR Flow Cafe (trialing) → "Trial ends 16 Oct 2026" + "13 days left · no charge yet" (16 Oct − 3 Oct = 13 ✓); CheeseBurg (active) → "31 Oct 2026" ✓; money columns aligned; MRR chip unchanged (₹4,999.00). tsc EXIT=0; console delta ZERO errors; screenshot qa164-trial-clock.png. READ-ONLY round — zero cloud writes.


## [5.124.0] — 2026-10-04 — The reset, the recovery, and the panel that hands over whole

### Fixed — the provisioning wizard can no longer save a business "locally only"

- **The bug** (found live this round, by drill): the wizard's Step 1 treated **City** as optional — no asterisk, no validation — while `tenants.city` is `NOT NULL` in migration 001 and the api layer sends `city: input.city || null` (`src/lib/api.ts`), an explicit NULL that **overrides** the column's `DEFAULT 'Bengaluru'`. Any operator who left City blank got a scary cloud notice — "null value in column city … the business is saved locally only" — plus an orphaned owner auth user, and no tenant row.
- **The fix**: City is now a first-class required field — red asterisk, `aria-invalid` + `aria-describedby` wiring, and the honest blocker **"City is required — the ledger stores it."** at Step 1. The form's contract now matches the ledger's. Verified live: empty city → Step 1 holds with the error; filled city → advances; wizard closed without provisioning, cloud untouched.

### Recovered — environment reset restored from the snapshot copy (v5.57.0 → v5.123.0)

- The container was reset to a stale 5.2.1-era snapshot: local `main` back at `9dfbccd`, worklog truncated at Task 37, and the 107 local commits (5.57.0 → 5.123.0, HEAD `ee28a48`) unrecoverable from git (fsck found only old-era dangling commits). Remote `origin/main` had been pushed through v5.56.0 (`a561a3b`) before the reset.
- Recovery: fast-forwarded local main to v5.56.0, restored the v5.123.0 working tree from the environment's `/tmp` snapshot copy (worklog Tasks 38–162, CHANGELOG 5.57–5.123, migrations to 038, `.qa-screens`, qa scripts), quarantined 47 pre-rebuild ghost files (pos/, superadmin/, orders/, offers/, kds/, `data/seedData`, `lib/store.ts`, `common/Header`…) the partial sync had resurrected — they were outside the live 64-file import closure and broke tsc with 441 errors. `bun install` re-synced node_modules (qrcode was missing).
- **VERIFIED: `tsc --noEmit` EXIT=0 and `vite build` EXIT=0.** History 5.57.0 → 5.123.0 stays compressed into one recovery commit; the CHANGELOG + worklog carry the full per-release narrative.
- **PUSH BROKE THROUGH**: the recovery commit (`bd0de18`) is on GitHub — the first successful push after the round-spanning PUSH PENDING streak (×78). The owner also completed the repo rename (tsos-alt → **servepoint**): remote flipped via `git remote set-url`, per the standing Task-37 action item.

### Added — Platform details panel hands over whole

- **Copy buttons on the IDs**: the Businesses details panel truncates the Business ID for layout and offered no way to see or take the full value — yet every support/SQL workflow starts from that UUID. One tap copies the **full** UUID (clipboard fallback for non-secure contexts), with a two-second green checkmark. Owner email gets the same treatment (every cleanup script's `WHERE email = …` guard starts there).
- **The panel is now the complete record**: it showed owner/status/ID but lacked the row's Type, City and Created — the details surface was *less* complete than the table row above it. Second grid row added (Type · City · Created), shared by the desktop table expansion and the mobile card.

### Verified

- Live drill: wizard City validation (blocked/pass/close), Businesses panel — expand CheeseBurg → six fields render, copy buttons on owner email + Business ID, checkmark feedback; businesses search miss state intact; /showcase + /index-help render; Platform KPIs honest (2 businesses, 1 active subscription). tsc EXIT=0 ×2; vite build EXIT=0; fresh-load console delta ZERO errors. Census READ-ONLY: 2 tenants (CheeseBurg · QR Flow Cafe), no new tenant rows. One orphaned auth user from the failed drill (`drill.owner@recoverydrill.in`, no membership, RLS-blind) awaits owner pooler cleanup — password is owner-private, unavailable this round.


## [5.123.0] — 2026-10-04 — The book's miss says why

### Fixed — Guests' search miss joins the honesty contract (and admits email)

- **The generic voice**: the guest book's narrowed-to-zero state answered "No guests match that search / Try a different name or phone" — no term, no reach, no way out. The 5.119.0 contract's last generic miss outside Messages' compact side-panel (deliberately bespoke).
- **The miss says why**: a search miss now reads **"No guest matches "q""** with the reach named — **"Search reads names, phones, notes, and emails — an email match keeps its row without a gold mark; open the guest to see the address."** — and the family's gold **Clear search** (which clears BOTH doors of the two-door search). Rendered through the shared shell EmptyState.
- **The placeholder admits email**: the hay has read emails since the search was built, but the local box promised "Search name, phone, notes…" — an under-promise the reach line now matches everywhere ("Search name, phone, email, notes…"). An email-only survivor stays unglinted on the row BY CONSTRUCTION (the 5.120.0 rule: the highlight never claims more than the eye can verify) — the reach line says so in plain words.
- **The catalog truth keeps its sentence**: "No guests yet" (empty book, phone-auto-book promise) joins the shared family shape — an empty book and a filtered one stay different sentences.

### Added — the count line family, one badge

- **Inventory's count line wears the house badge**: "3 of 4 ingredients match "cof"" now speaks Bills'/Guests'/F&D's exact pattern (dark pill badge + aria-live) instead of its private bold-number voice. Every count line on every searchable surface now comes from the same visual grammar.

### Verified

- Live drill, all green: Guests "zzqx" → shared EmptyState "No guest matches "zzqx"" + reach line + gold Clear search → clears both doors, KPIs intact; local box placeholder reads "Search name, phone, email, notes…"; Guests "98" → "2 of 3 guests match "98"" intact (5.122.0 regression); Inventory "cof" → badge count "1 of 4 ingredients match "cof"" + `Cof` glint intact; "zzqx9" → miss state + whole-shelf note intact. tsc EXIT=0 ×2 (a/b). Console delta: ZERO errors.


## [5.122.0] — 2026-10-04 — The count and the orphan

### Fixed — the detail pane stops showing a bill the list swears isn't there

- **The orphan**: Bills' keep-a-valid-selection effect (5.92.0) re-selects the top bill whenever a filter excludes the current one — but it early-returns when the filter empties the list entirely. The selection HELD, and the detail pane kept displaying a bill (status pill and all) while the left list said "No active bills from today". A live drill in 5.121.0 showed exactly this: the miss state and an Active bill side by side, no word about the contradiction.
- **The strip**: when the filtered list is empty but a bill stays selected, the detail pane now opens with an amber honesty strip — **"This bill is outside the current filter — the list on the left came up empty. The detail stays open for reference."** — with the family's gold **Clear filters** way-out. Same amber voice as the off-today note (5.92.0); the detail stays open on purpose (auto-deselecting mid-payment would be hostile; the operator may be working the ticket).

### Added — the count line reaches the last two searchable lists

- **The house pattern completes**: Bills has counted its matches since 5.116.0 (badge + "N of 55 bills match" + aria-live) and the shelf names its own count — but Guests and Food & Drinks stayed silent about how much of the list a search captured. Both now speak it: **"2 of 3 guests match "98""**, **"1 of 3 categories match "ba""**, **"1 of 2 dishes match "muf""** — Bills' exact badge voice, `aria-live="polite"` throughout.
- **The pool is honest**: F&D's dish count names what the search STARTED from — the open category with the Veg chip already applied (`itemPool` memo extracted, visibleItems reads it) — so "N of M" never claims a whole the search never saw. Guests' KPI cards keep counting the whole book while the count line speaks the narrowed view, the same way the shelf's value and Bills' unpaid total never narrow with a filter.

### Verified

- Live drill, all green: Bills Active+Today (empty list) → right pane shows amber strip + Order #96 detail below it; **Clear filters** from the strip restores the ledger and the strip vanishes; non-empty filtered lists never show the strip (effect re-selects within the list). F&D categories "ba" → "1 of 3 categories match "ba""; inside Bakery "ba" → "0 of 1 dish matches "ba"" alongside the 5.119.0 miss state; "muf" → "1 of 1 dish matches "muf"" + `Muf` gold; Veg on keeps the same pool and swaps the miss voice ("among the vegetarian dishes"); Guests "98" → "2 of 3 guests match "98""; clearing search removes every count line. Count-line grammar pluralizes by pool size (dish/dishes, guest/guests, matches/match) so a 1-item category never reads "1 dishes". tsc EXIT=0 ×2 (a/b). Console delta: ZERO errors.


## [5.121.0] — 2026-10-04 — The ledger's misses learn to say why

### Fixed — Bills' zero state joins the 5.119.0 honesty contract

- **The last generic miss**: every search surface had learned to say why a miss happened (5.119.0) — except Bills, whose narrowed list answered with a bare **"No bills match / Try a different filter or search term"** whether the culprit was the search, the status select, the window select, or all three at once. The ledger is the screen an operator trusts with money; its emptiness owed them the reason.
- **A miss now names its dimensions**: a search miss reads **"No bill matches "q""** plus the reach (order numbers, customer names, and what each card prints — the table line); a filter miss assembles the sentence from the words the operator actually clicked — **"No cancelled bills from today"**, **"No paid bills in the last 7 days"**, **"No active bills"** — with a body that keeps count context ("The ledger holds 55 bills — none are cancelled AND from today"). When search and filters stand together, the body says either can miss.
- **The empty state, consolidated**: 5.119.0's honest-miss layout was born private in Food & Drinks; it now lives at **`src/components/shell/EmptyState.tsx`** (icon circle, title, body, action slot) and Bills speaks through it — the same arc MarkHit took in 5.120.0, one release later. The gold way-out button matches the family (Messages' "Clear filter", F&D's "Clear search"). Food & Drinks imports the shared primitive with zero visual change.
- **The catalog-truth state stays a different sentence**: "No bills yet" (a truly empty ledger, with its Go to Food & Drinks CTA) is untouched — an empty ledger and a filtered one must not sound alike.

### Verified

- Live audit before the round: Messages' unread-only zero already honest ("No unread lines — the house is quiet." + Clear filter); Floor's Available chip already honest ("Nothing available right now" + Show everything); Bills' "Today" window verified honest under the documented three-clock seam (device day for bills/KDS/counter — v5.97.0's appday.ts) — on a UTC device it showed yesterday's #127, by design, the same word KDS and the counter strip speak. The generic Bills miss was the one gap.
- Live drill, all green: status=Cancelled + window=Today (UTC device, no cancelled bills today) → **"No cancelled bills from today"** + "none are cancelled AND from today" body; search "zzqx9" → "No bill matches "zzqx9"" + reach line; search "t9" + status=Active → title names the term, body adds "The Active filter is also in play — either can miss"; Clear filters (gold) restores the full list. F&D regression: "zzqx" at categories level → same honest state as 5.119.0 through the SHARED component. tsc EXIT=0 ×2 (a/b). Console delta: ZERO errors.

## [5.120.0] — 2026-10-04 — The glint finishes its rounds

### Added — every search surface now says why a row survived

- **The consolidation**: since 5.115.0 three screens kept private copies of the same tiny gold-glint component (rooms `Mark`, shelf `ShelfMark`, menu `MarkHit`). One truth now lives at **`src/components/shell/MarkHit.tsx`** and serves every search surface — rooms, shelf, menu grid, and (below) the three that never had it. Same treatment, same gold, one implementation.
- **The sweep**: Bills, Guests and Menu-management rows paint their matched span too, always where the filter's own hay actually prints — Bills' card glints in the order number and the visible subline (the 5.26.0 WYSIWYG hay made visible), Guests in name / phone / notes (its hay's visible parts), Menu in dish name and description. A hit that only lives in an invisible field stays unglinted — the highlight never claims more than the eye can verify.
- **Trim-tolerant contract**: callers pass the raw search string or a pre-lowered slice; the component trims and case-folds internally, so `#147` glints `147` where the card prints it.

### Verified

- Live drill, all green: Bills "T2" → `T2` gold in six card sublines + count line "12 of 55 bills match "T2"" intact; Guests "98" → `98` gold in two phone numbers, 2 rows survive; Menu "blue" → `Blue` in "Blueberry Muffin" AND `blue` in its description (two glints, one row); regressions through the refactored screens — Food & Drinks "bak" → `Bak`, Inventory "cof" → `Cof`, Messages "kit" → `Kit` — all identical through the shared component. tsc EXIT=0 ×2 (a/b). Console delta: ZERO errors.

## [5.119.0] — 2026-10-04 — The first door learns to say why

### Fixed — Food & Drinks' search stops lying at both levels

- **The lie this closes**: Food & Drinks was the shell search's FIRST consumer (5.116.0 gave it the box; 5.53-era code kept its old empty states). When a search missed at the categories level the screen printed **"No categories yet"** — a catalog-truth claim a filter had no right to wear; inside a category it printed "No items in this category" (or the Veg variant) for the same reason. An operator searching "muf" could conclude the bakery doesn't exist.
- **The empty states learn the filter**: a search miss now says what was searched ("No category matches "zzqx"" / "No dish matches "bak" in Bakery"), what the search actually REACHES at that level ("category NAMES only" / "dish names in Bakery only — a menu-wide sweep is not its job"), and hands back a **Clear search** button. With the Veg chip also on, the title names both filters and the body says either can miss.
- **The placeholder keeps its promise honest**: the static "Search the menu…" promised a menu-wide sweep the filter never delivered (it reads the open category's dishes only). Registration is now DYNAMIC — "Search categories…" at the categories level, "Search {category}…" inside one — so the box says exactly what it does while the operator types.
- **The gold glint reaches the menu**: surviving category and dish names paint their matched span (`MarkHit` — the rooms list's and the shelf's treatment, now menu-wide), so the eye lands on WHY a card survived.

### Verified

- Live drill, all green: categories level → placeholder "Search categories…"; "zzqx" → "No category matches "zzqx"" + reach note + Clear search (the old "No categories yet" gone during search); "bak" → one card, `Bak` gold in "Bakery"; opening Bakery → placeholder flips to "Search Bakery…" live, search text rides along; "bak" inside → "No dish matches "bak" in Bakery"; "muf" → `Muf` gold on the muffin card; Veg on + "zz9" → "Nothing matches "zz9" among the vegetarian dishes" + "both in play" body; Clear/Esc restores the grid; "/" still walks focus (regression: verb works with the dynamic placeholder). tsc EXIT=0 ×2 (a/b). Console delta: ZERO errors through the entire drill.

## [5.118.0] — 2026-10-04 — The slash finds its house

### Added — "/" belongs to the shell now; Messages joins the search contract

- **The verb gets one owner**: since 5.115.0, "/" walked focus to the rooms filter — but only on Messages, by a handler the screen kept for itself. Now the SHELL owns the key (one window-level listener in Header, not per-screen): one press walks focus to the header search box from anywhere that isn't already a field, whenever the current screen has claimed the box (the Slack grammar, app-wide). Where no screen honors the box, the key stays quiet — the verb can't outlive its noun, and one owner per keystroke means no two screens can race.
- **Messages stops being a private box**: the rooms filter (5.115.0) now reads and writes the same `useUi.search` the header speaks — two doors, one state, live mirroring in both directions — and registers its vocabulary ("Filter rooms…") with the shell, so the header box EXISTS on Messages now (it was the one messaging surface the 5.116.0 contract hadn't reached). The local "/" handler retires with the move; the local box's tooltip now points at the shared truth ("the header box shares this filter").
- **The verb, written where the finger lands**: while the header box is empty, a quiet `/` kbd glint sits in its corner — discoverability without a tutorial. The X clear button takes the corner back the moment there's something to clear.

### Styled

- **The gold glint generalizes**: Inventory shelf names now paint their matched span gold (`ShelfMark`, same treatment as the rooms list) while a search narrows the shelf — the eye lands on WHY a row survived. Outside a search, names render untouched.

### Verified

- Live drill, all green: Messages → shell box present as "Filter rooms…" with kbd glint; shell-typed "kit" → local box mirrors live, room list narrows ("1 of 2 rooms shown" announced), "Kit" painted gold in "Kitchen"; local-typed "zzqx" → shell mirrors, honest empty state + Clear filter; Clear from the LOCAL door emptied BOTH doors; "/" from body focus → activeElement becomes the header box (placeholder "Filter rooms…"); Dashboard → box absent, "/" leaves focus on BODY (the key stays honest); Inventory → shell-typed "cof" → 1 row ("1 of 4 ingredients match"), "Cof" painted gold, toolbar door mirrors. tsc EXIT=0 ×2 (a/b). Console delta through the entire drill: ZERO new lines, ZERO errors.

## [5.117.0] — 2026-10-04 — The shelf learns the shell's word

### Added — Inventory joins the shell-search contract (with a search of its own)

- **The gap this closes**: Inventory was the last big list with NO search at all — the operator scrolled 19 SKUs by eye to find one ingredient. (Platform's tenant search stays its own thing by design: Platform runs its own header layout, not the shell, so the contract literally doesn't reach it.)
- **The shelf's own door**: a compact search box now lives in the shelf toolbar (next to "Count shelf"), bound to the same `useUi.search` the header box speaks — two doors, one state, live mirroring in both directions (typing in the toolbar box clears the header box and vice versa, because they were always the same field).
- **The shell registers the shelf**: while Inventory is on stage the header box appears as "Search the shelf…"; on leaving, the registration drops and the box hides, per the 5.116.0 contract.
- **Names only, whole-truth chips**: the filter matches ingredient NAMES (case-insensitive); the count line flips to "N of M ingredients match "q"" while searching. The LOW STOCK / OUT chips, shelf value and movers section keep counting the WHOLE shelf — a filtered list is a narrower view, never a quieter ledger, and the empty state says so ("the shelf counts stay whole-shelf") with a Clear search button. Esc clears from either door.

### Verified

- Live drill, all green: shell-typed "cof" → shelf narrows to 1 row (Coffee beans), toolbar input mirrors live, count line "1 of 4 ingredients match"; toolbar-typed gibberish → honest empty state + Clear; clearing from the LOCAL door empties the SHELL box too (one state proven in both directions); toolbar restores "4 ingredients on the shelf". tsc EXIT=0 ×2 (a/b). Console delta through the drill: ZERO new lines, ZERO errors.
- **Census drift observed, honestly recorded**: the shelf loaded 4 SKUs this round (Butter, Cheese, Coffee beans, Flour) vs 19 seen in Task 153's QA hours earlier — both rounds read-only on this table, so the change came from outside this loop (possibly the repo's other automated actor). No code fault; flagging for the owner. Census otherwise stable: orders 55, payments 31.

## [5.116.0] — 2026-10-04 — The search box learns where it is

### Fixed — the shell search stops lying on thirteen of fourteen screens

- **The lie this closes**: the header's "Search current screen" box had exactly ONE consumer its whole life (Food & Drinks). On every other screen it solicited input and swallowed it — a dead control wearing a live label, the interactive cousin of the WeekNote stub. (Caught while auditing the Messages screen: typed "kit" into it on Messages and nothing in the room list moved — nothing would ever move.)
- **The contract** (`useUi.searchMeta`): a screen that honors the shell search REGISTERS its own vocabulary on mount and clears it on unmount. The header renders the box ONLY while a registration stands — a control that cannot act must not solicit input — and speaks that screen's placeholder instead of a generic "Search ...".
- **Per-screen vocabulary**: Food & Drinks → "Search the menu…" (the original consumer, now saying so out loud); Bills → "Search bills…"; Menu → "Search items…"; Guests → "Search guests…". Everywhere else (Dashboard, Kitchen, Floor, Reports, Inventory, Close-out, Messages, Settings, Support) the box simply does not exist.
- **Two doors, one state**: Bills, Menu and Guests already had their own search boxes; converting them to read/write the same `useUi.search` means the header box and the pane box are two doors to one state — type in either, both move together, one filter runs. Bills' match-count legibility line (5.26.0) responds identically no matter which door you typed in.
- **The value cannot outlive its meaning**: `goSection` already wiped the search on navigation; the header now ALSO wipes it the moment no screen honors the box, so stale text can't wait in the store for its next victim. Esc clears and steps out of the box; a small X clears and keeps focus nearby.

### Verified

- Live drill, all green: Messages → box absent (its room filter lives in the aside); Food & Drinks → "Search the menu…", "flat white" narrows the item grid to one card, gibberish prints "No categories yet" AND "No items in this category", Esc restores; Bills → shell-typed text mirrors into the pane's own input live, match line reads "0 of 55 bills match "147"" then reacts to "flat"; Menu → "Search items…"; Guests → "Search guests…", "qqq7" prints "No guests match that search", X clears; Dashboard → box absent. tsc EXIT=0 ×2 (a/b). Console delta through the entire walk: ZERO new lines, ZERO errors.
- Tool lesson #4 recurrence, third sighting: the display pipeline ate the literal byte sequence `[m` (5b 6d) in `sed` AND `rg` output, rendering `const [menuOpen` as `const enuOpen` and `const [movers` as `const overs` — apparent syntax corruption in two untouched files. tsc EXIT=0 contradicted the eyeballs; a python hexdump proved the bytes intact. Rule re-confirmed: on ANY suspicious byte-loss in tool output, trust `tsc` + hexdump over the terminal, never re-edit based on mangled output alone.

## [5.115.0] — 2026-10-04 — The rooms learn a ledger line

### Added — the rooms list gets a filter (Messages, depth item #1)

- **The seam this closes**: the rooms list rendered every conversation, always, in DB order — fine at two rooms, blind at twenty. Busy-hour reality is "which room is fresh?" and "where was that line about the milk?"; the answer required scrolling and squinting at previews. (Verified non-redundant live before building: the shell's "Search current screen" box does not filter the room list.)
- **The filter box** (aside, under the LineStrip): substring against the room's NAME and its LAST-LINE PREVIEW, case-insensitive, purely client-side by construction — the list is already in memory, zero new queries. Matches paint gold in the room name (`Mark`, first occurrence, honest about being first). An sr-only `aria-live` line announces "N of M rooms shown" as the filter changes.
- **The unread-only chip**: "Unread · n" where n = rooms with unread lines (gold when any, gray when none), `aria-pressed` toggle — the busy-hour sweep, one press. Composes with the text filter.
- **The keyboard grammar**: `/` walks focus to the filter from anywhere on the screen that isn't already a field (Slack/WhatsApp muscle memory); Esc inside the filter clears it and steps back out; the X button clears and refocuses; the empty state's "Clear filter" resets BOTH controls.
- **Honesty in the empty state**: a filter that matches nothing says "No room matches "…"" AND owns what the filter does NOT do — it reads names and last lines, not the whole history (full-history search would be a different, heavier promise and is not claimed). The unread-only dead end gets its own line: "No unread lines — the house is quiet."
- **The contract that protects the reader**: a room filtered out of the list does NOT change what you are reading — `activeId` is never touched by the filter (verified live: Front of House active, filter "kit" hides it from the list, the thread header stays Front of House).

### Verified

- Live drill, all green: name filter "kit" → Kitchen only, gold mark "Kit"; preview filter "147" → Kitchen only (matches the real last line, FOH's doesn't); no-match "zzzqx" → honest empty state + "0 of 2 rooms shown"; Clear filter restores both; unread-only with zero unread → quiet-house state, aria-pressed true; `/` focuses the box; Esc clears and blurs; hidden active room keeps its thread. tsc EXIT=0 ×2 (a/b). Console delta through the entire drill: ZERO new lines, ZERO errors.
- One probe-side hiccup (not an app bug): the first Esc check read `input.value` synchronously after dispatch and saw the pre-settle value — React state is async; a settled re-read showed the clear worked. Probe discipline (IIFE + fresh strings) held.

## [5.114.0] — 2026-10-04 — The third bell hums

### Added — the shelf reaches the rail (the unread-feed factory ships)

- **The seam this closes**: a low shelf spoke only inside the Inventory screen — you learned milk had crossed its reorder point by going to look. During service the operator lives on Bills and Kitchen, and the deduction ledger moves the shelf in real time (037 published all three inventory tables) while nobody outside the screen heard it.
- **The unread-feed factory** (`src/store/createUnreadFeed.ts`, NEW): the ref-counted lifecycle the chrome has carried twice by hand — ensure/release consumers, teardown at zero or on tenant switch, best-effort fetch whose failure leaves the count null (an outage must never break the rail), realtime + safety poll, a post-release fetch guard so a dead feed can't resurrect its number — is now written ONCE and parameterized (fetch, subscribe, poll). The two elders stay hand-rolled on purpose and their headers say why (prefs-mutable category sums; per-reader identity); the factory is what their doctrine asked for: no third hand-rolled copy.
- **The stock feed** (`src/store/stockUnread.ts`, NEW — the factory's first consumer): count = every SKU at or below its reorder point, INCLUDING out-of-stock (an out item is the most urgent member of the set, not a quieter separate story; the Inventory header's LOW STOCK + OUT chips sum to this number). Taps the same three inventory tables on its own channel, 60s safety poll, `nudge` for callers. No mute rules — the 031 chat silence was a decision about social noise; a dry shelf is operationally loud by nature, and the N→M-only announcement keeps service deductions that don't cross a reorder point silent.
- **The rail speaks the shelf**: the Inventory pill carries the same badge anatomy as the other two (gold on teal, pop on change, 99+ ceiling) with ITS OWN grammar — "Inventory, 3 low", quiet state "Inventory, stock healthy" (a rail that said "3 unread" would speak a language the shelf never wrote). The 5.111.0 live region now carries three feeds in one breath ("2 new notifications, 1 new message, 3 items low or out of stock"); stock joins only while it needs ears, same known-value N→M rule.

### Fixed — a live-caught crash on the first E2E

- **The channel-name trap, paid for twice**: supabase-js dedupes channels by name and THROWS on adding postgres_changes callbacks to an already-subscribed channel — the unread.ts 'badge' lesson, in words since 5.104.0. The stock feed's first cut reused `subscribeInventoryRealtime` with its screen channel name: the feed (mounted in the rail) subscribed first, and opening the Inventory screen threw "cannot add postgres_changes callbacks... after subscribe()" into the error boundary — caught live in the first E2E walk. Fixed with a `channelTag` on the subscription builder: the screen keeps 'screen', the feed owns 'railfeed' — two small taps on the same three tables, never one shared room. `subscribeInventoryRealtime` now documents the trap at the signature.

### Verified

- E2E (session qrowner): first walk caught the crash (error boundary + stack in console); after the fix — reload → rail speaks "Inventory, stock healthy", Inventory screen opens CLEAN (main renders, no boundary), shelf chips LOW STOCK 0 / OUT 0 = rail count 0 (the two views agree by construction: same filter, two readers), 19 shelf rows present. Clean reload console delta: ZERO new lines. tsc 0 unpiped, two passes (/tmp/tsc153a|b.log). Screenshot `.qa-screens/qa153-stock-rail.png`.
- The badge visual and the N→M announcement machinery are the proven 5.111.0 components (shared markup, shared debounce) — the stock flip itself is not live-fireable without fabricating deduction-ledger usage, so it is verified at the code level and stated honestly.
- Read-only round: zero cloud writes (the shelf is healthy; no restock or deduction was fabricated to force a badge).

## [5.113.0] — 2026-10-04 — Seven honest days

### Added — the Dashboard's Week views become real (the WeekNote stub retires)

- **The seam this closes**: the dashboard contract has fetched SEVEN DAYS of orders since it shipped — and dropped everything except today on the floor. Flip a card's range to Week and you got an honest stub: "No 7-day breakdown yet." Honest, but a confession that the data was being carried and thrown away. Both Week views are now real, computed from the rows the query already walked — zero new queries.
- **Total Revenue · Week**: a bar chart of daily revenue across seven complete calendar days (oldest first), teal for the earlier days and gold for Today; tooltip says the full date ("Friday, 2 Oct") and the formatted rupees; beneath it a summary line — "7 days · ₹10,884.30 · Best day · Friday, 2 Oct · ₹5,046.30" — and a two-dot legend (Today / Earlier days) so the colors answer themselves. `role="img"` aria summarizes the total and best day for screen readers.
- **Trending Dishes · Week**: the same row grammar (thumb, name, tag, plates) over the week's plates, with an honest footer — "Past 7 days · 46 plates across 3 dishes · top four shown" — and an honest empty state when the week was quiet. One list renders either window; the today view is untouched.
- **The grammar holds across views**: the same live slice rule as the today cards (cancelled never happened — 5.99/5.94), the same typeMap, the same wide order_items fetch now sliced by TWO id-sets (today's and the week's live tickets). Today's bucket in the week chart IS the today card's number — the two views cannot disagree (verified live: pie ₹294.00 = week chart's Today bar).
- **Window alignment fix**: the orders query now starts at LOCAL MIDNIGHT six days back instead of a rolling 168h — calendar-day buckets need calendar-day windows, or the oldest bar undercounts by whatever fell outside the rolling edge. The today slice is unaffected (today begins at local midnight either way). The Dashboard keeps its local-day grammar (the reporting-tz flip remains a Floor-book/CRM seam — noted at the computation).

### Verified

- E2E (session qrowner, console cursor 1041 stable): Revenue flipped to Week → BarChart renders 7 buckets (Sun→Today, alternate ticks for space), stub gone, aria total ₹10,884.30 + best day; Trending flipped to Week → Flat White ×44, Blueberry Muffin ×1, Veg Grilled Sandwich ×1, footer "46 plates across 3 dishes" (44+1+1 internally consistent); both flipped back to Today → pie ₹294.00 = week's Today bar, trending list intact. Zero console errors across the whole sweep. tsc 0 unpiped, two passes (/tmp/tsc152a|b.log). Screenshots: `.qa-screens/qa152-revenue-week.png`, `qa152-trending-week.png`.
- Read-only round: no cloud writes (the week is computed client-side from the existing query's rows).
- Tool lesson #4 recurrence, byte-level this time: the display pipeline swallowed `[h` in `.map(([hour, v]) =>` making valid code read as `(our, v])` — codepoints hexdumped (0x28 0x28 0x5b 0x68...) proved the file was always valid; a MultiEdit anchor copied from the mangled display failed, and the retry batch duplicated two blocks because the "failed" batch had PARTIALLY applied (Task 149's lesson, violated again and re-learned: after ANY MultiEdit failure, re-read before re-editing; the atomicity report lied). Both duplicates removed by byte-range surgery with assertion guards (each declaration exactly once).
- External "…-cron" commit `57627bc` re-added tsconfig.tsbuildinfo on top of the tree (the artifact this repo's cron process keeps tracking; left alone per watch policy — noted, not fought).

## [5.112.0] — 2026-10-04 — The line stays where you left it

### Fixed — two honesty bugs, both caught live before the fix

- **The scroll yank** (Messages): the autoscroll effect pinned `scrollTop` to `scrollHeight` on EVERY thread refetch — the 30s poll and every realtime ping dragged a reader back to the bottom even when nothing new had arrived. A teammate reading last night's history in a live room was yanked down every 30 seconds. Autoscroll is now conditional: it only fires when the reader already sits at the bottom (±80px); otherwise the scroll position is theirs, full stop.
- **The draft leak** (Messages): one shared draft state survived room switches — a line typed for Front of House could land in Kitchen on the next Enter. **Caught live before the fix**: "table 4 needs water" typed in Kitchen survived the switch to Front of House and sat waiting to be sent to the wrong room. Drafts are now PER ROOM: switching back to a room restores its own half-typed line, sending clears only that room's, and a room with no draft opens empty.

### Added — the jump pill, the growing composer, the cluster rule

- **The jump pill**: new lines that arrive while you're reading history arm a gold pill above the composer — "1 new line" / "3 new lines", counting, one click from the bottom. Click scrolls down (smooth, unless the OS prefers reduced motion — then instant) and disarms; manually returning to the bottom disarms it too. Room switches reset the whole ledger: the new room lands at its bottom, pill-free.
- **Per-room drafts** (the constructive half of the leak fix): mid-sentence in Kitchen, duck into Front of House to check something, come back — the draft is still there, per room.
- **The growing composer**: the textarea now grows with its line (capped at the existing max-h-28's 112px) instead of scrolling internally, and re-fits on room switch when a restored draft is taller than the resting input. Cleared, it returns to its 42px rest.
- **The cluster rule**: consecutive lines from the same sender within three minutes render as ONE utterance — tight (~4px), with the repeated sender name dropped after the first. A sender change, a three-minute gap, or the unread divider breaks the run; the boundary line always renders full-height with its name, however close the timestamps sit.
- **Full-stamp tooltips**: every bubble's clock now carries a hover title — "Today at 4:47 pm" / "Yesterday at 9:12 am" / "29 Sep at 6:03 pm" — the day a line landed, without hunting for the dividers.

### Verified

- E2E (QA151 markers, session qrowner): the leak re-verified broken pre-fix and fixed post-fix in both directions (Kitchen draft and FOH draft each restore, the other room's composer opens empty); the auto-grow (40px → 101px on a four-line draft → 40px on clear); **the live pill drill** — thread induced to overflow, scrolled to the top (scroll event armed the unstuck stance), one QA line sent from the composer while reading history → scroll position KEPT at 0, pill armed "1 new line" (aria "Jump to 1 new message"), the new bubble confirmed as the last line → click → bottom reached, pill disarmed, maxHeight probe removed. Post-impl console delta: ZERO new lines, ZERO errors. tsc 0 unpiped, two passes. Screenshots: `.qa-screens/qa151-before.png`, `qa151-after.png`.
- Cluster rule not visually verifiable with current data (no same-sender run within three minutes in any room) — verified at code level; noted honestly.
- Census: orders 55 (QR Flow) + CheeseBurg stray · payments 31 · order_items 58 · customers 3 untouched. The round's only cloud write: ONE chat line ("QA round 151 — pill drill", Front of House) sent through the UI as the pill drill's trigger — a user-class action, same class as rounds 80/84's QA lines.
- Tool lesson (QA-side): `agent-browser eval` top-level bindings persist across calls in the same page — a repeated `const t` either collides or the React value tracker desyncs on repeated native-setter strings; both masquerade as "onChange not firing". IIFE-wrap every probe and use a fresh string per dispatch.

## [5.111.0] — 2026-10-04 — The rail speaks its changes

### Added — ears for the two badges; a pop for the eyes

- **The audit**: Support (21 buttons, 0 unnamed) and Settings (34 buttons, 0 unnamed, 4 payment-method switches) — both clean; recorded with screenshots. The round's work came from the deferred candidate list: the rail's realtime badges (5.104.0's bell sum, 5.108.0's chat sum) change live, but screen-reader users had no way to KNOW a change happened — the badges are visual-only.
- **One polite live region**: the Sidebar now carries a screen-reader-only `role="status" aria-live="polite"` region announcing unread deltas — "10 new notifications", "1 new message", both feeds in one breath when they move together, and "All caught up" when the last one drains. Tuned against noise: the state you LOADED with is never announced, a feed ARRIVING (null → N, the async load catching up) is not news, bursts coalesce through a 1.5s debounce into one sentence, and changes while the debouncer is pending replace rather than stack. The live E2E caught the first cut announcing "11 new notifications" on a cold open — the null→N arrival transition was being counted as news; only N→M moves now.
- **The badge pop** (the sighted half of the same story): when a count changes, the badge does a one-shot scale pop — `key={badge}` remounts the inner span and replays `sp-badge-pop`; the standalone `scale` property animates without fighting the parent's positioning `translate`. Covered by the 5.109.0 reduced-motion block (news arrives; nothing jumps).
- **PwaLayer role fix**: the install card was `role="dialog"` — but it is a NON-modal toast (the app stays usable behind it, own close button, no `aria-modal`); the role promised a modal room that never existed. Now `role="region"`. (Conditional surface — verified at the code level; the card never fired in the QA browser.)

### Verified

- E2E (QA150 markers, session qrowner): region present on every screen (clipped, polite, empty on load — silent cold open after the fix). **The live flip**: one notification marked as read from the Notifications screen → badge 11 → 10 → after the debounce the region reads **"10 new notifications"** and the pill's aria grammar follows. The pop span carries the new count; under emulated `prefers-reduced-motion` the animation names read `none`, restored on reset. Post-impl console delta: ZERO new lines, ZERO errors. tsc 0 unpiped, two passes. Screenshots: `.qa-screens/qa150-notifications-announce.png`, plus the two audit shots.
- Census: orders 55 (QR Flow) + CheeseBurg stray · payments 31 · order_items 58 · customers 3 untouched. The round's only cloud write: one notification marked read through the UI (a user action on the per-reader watermark, same class as 5.108.0's residue note).

## [5.110.0] — 2026-10-04 — Dialogs that hold the door

### Added — one discipline for every modal surface

- **The sweep**: 19 `role="dialog"` surfaces across 12 files. Nine handled Escape by hand (each its own window listener), NONE trapped Tab — a keyboard user could walk straight out the back of an `aria-modal="true"` dialog into the rail and the room behind it, breaking the promise the attribute makes — and NONE returned focus to where the dialog was opened from. Four Inventory dialogs (ingredient edit, restock, waste, stocktake), both EOD drawer dialogs, two Customers dialogs and the guest QR cart had no Escape at all.
- **The fix is one hook**: `src/lib/useDialogA11y.ts` — Escape closes (capture-phase, `stopImmediatePropagation`, so it wins every race; call sites keep their own honesty guards — `!busy` / `!submitting` stand down while a write is in flight), Tab cycles inside the container (focus cannot leave through the back), the first focusable is focused on open (or the dialog's own panel ref — drawers focus their panel so the invisible backdrop button never silently holds focus), and on close focus returns to the element that opened the dialog. The latest-ref pattern keeps the effect bound once per open. Applied to all 15 modal surfaces across 10 files; the nine hand-rolled Escape listeners were deleted in favor of the hook.
- **The 5.107 side-effect, caught and fixed**: the global gold focus ring painted around the FULL VIEWPORT when Tab landed on an `inset-0` backdrop close button — a button the size of the screen wearing a ring. Every backdrop close button now takes `focus-visible:outline-none` (keyboard users close with Escape, which every dialog now speaks; screen readers still hear the button).
- **Styling**: modal dialogs arrive — `spFadeIn 160ms` on the backdrops that lacked any entrance (the profile dialog, Inventory's four, EOD's two, the customers', the floor's, the menu's, the item sheet, the wizard); the drawer family keeps its slides. The animation rides `spFadeIn`, which the reduced-motion block from 5.109 already covers — the still room stays still. The profile dialog's initial focus sits on the card itself (neutral) — first focusable would have been Sign out, and an accidental Enter on that is not a mistake the dialog should invite.
- **False-alarm #4, dismissed by doctrine**: Customers' card classes displayed as `w-in(440px,92vw)]` — the sed/rg `[m`-swallow artifact again; `od -c` showed the bytes are `w-[min(440px,92vw)]`, valid Tailwind. Raw bytes before alarms, as recorded.

### Verified

- E2E (QA149 markers, session qrowner): the profile dialog — initial focus on the card (no ring noise), `spFadeIn` running, five Tab presses cycle inside (focus cannot escape; lands on Sign out / Close / back), Escape closes, focus returns to the "Open Profile" button. The Inventory restock dialog (which never had Escape) — initial focus lands on the qty input, two Tabs stay inside, Escape closes. Post-impl console delta: ZERO new lines, ZERO errors. tsc 0 unpiped, two passes. Screenshot `.qa-screens/qa149-profile-dialog.png`.
- Read-only round — no cloud writes. PwaLayer's install card deliberately left alone: it is a NON-modal toast (`role="dialog"` without `aria-modal`, own close button) — trapping focus there would be wrong; Bills' Escape hit is the "…" menu, not a dialog — untouched.

## [5.109.0] — 2026-10-04 — The still room, the way in

### Added — motion answers the OS; the first Tab offers the way in

- **The motion audit**: a stylesheet sweep counted the room's motion — 11 keyframes — and found only the inline-style family (the PWA banner, the guest drawer, the feedback stars) ever answered `prefers-reduced-motion`. The class-driven half kept moving for users whose OS asks for stillness: the skeleton shimmer (`sp-shimmer`, ~50 loading states across 15 screens), Tailwind's `animate-ping` (install chip, realtime chip), `animate-pulse` (skeletons, the Floor's occupied dots, EOD's live dot, Messages' fresh row), and `animate-bounce` (the typing indicator). One `@media (prefers-reduced-motion: reduce)` block in `index.css` stills them all — unlayered on purpose (the 5.107 cascade law: unlayered author CSS beats the whole utilities layer), `!important` matching the three blocks beside it.
- **`.animate-spin` deliberately stays alive**: a loading spinner IS the state — frozen, it lies — and WCAG's concern is decorative motion, not functional feedback. Under RM the skeletons stand still (still readable as loading affordances), the pings and pulses sit as solid dots (every live indicator still reads — the dot just no longer breathes), the typing indicator holds its three dots. The room goes still; nothing goes dark.
- **The skip link**: the rail is 15 pills, the header a few more — a keyboard user tabbed through ALL of it, every screen change, to reach the room. The shell's first focusable element is now "Skip to content" (`.sp-skip-link`): hidden until the first Tab, then a gold chip over the teal rail with the white ring (gold-on-gold melts — the rail pill's lesson). Enter moves focus to the `<main>` landmark (`id="sp-main"`, `tabIndex={-1}`), and the tab order continues INSIDE the content instead of back at the rail. The link carries its own unlayered class instead of `sr-only` + `focus:not-sr-only`: the custom unlayered `.sr-only` would beat Tailwind's layered `not-sr-only` EVEN ON FOCUS — the same cascade law that 5.107 learned, working against us this time. `main` takes `outline-none`: the UA ring a keyboard-adjacent programmatic focus can paint around the whole content area is noise, not signal.
- **Guests screen audit** (the round's second target, unexplored lately): 35 buttons, ZERO unnamed, the ring gap covered by the 5.107 global rule — clean; recorded with a screenshot, nothing to fix.

### Verified

- E2E (QA148 markers, session qrowner): **the shortcut** — first Tab shows the gold chip at (14, 14) (`rgb(184,142,47)` body, `rgb(255,255,255)` 2px ring, 138×37px), Enter focuses `MAIN#sp-main`, the next Tab lands on the screen's own controls (`insideMain: true`). **The still room** — `agent-browser set media light reduced-motion` flips the OS emulation live: probe elements for all five classes read `sp-shimmer/pulse/ping/bounce → none` while `spin → spin` (the spinner stays); the CSSOM gate proof confirms the rule sits inside the `@media (prefers-reduced-motion: reduce)` block with `!important`; and a REAL element — the Splash's pulse bar during an actual reload — reads `none` under emulation. Reset (`set media light`) returns every animation. Screenshot `.qa-screens/qa148-skip-link.png` (the chip) + `.qa-screens/qa148-guests-audit.png`.
- Console hygiene upgrade: the agent-browser console buffer is cumulative across the persistent browser context (1040 stale-era lines — old EOD bugs, mid-surgery HMR states, all long-fixed), so flat greps mix eras; the delta method (buffer cursor before, `tail -n +N` after a reload) is the honest slice — fresh loads this round: ZERO new lines, ZERO errors. tsc 0 unpiped, two passes.
- Read-only round — no cloud writes.

## [5.108.0] — 2026-10-04 — The third bell speaks

### Added — the staff line's unread reaches the rail

- **The gap**: the rail's Notifications pill has spoken the shared unread feed since 5.104.0; the staff line (031/033) stayed mute on the rail — a teammate could write and the chrome said nothing until Messages was opened. The server truth for chat-unread already existed (migration 033's `fn_conversation_unread`: messages newer than MY watermark AND not sent by me, per room); the rooms list rode it, the rail never did.
- **The second feed**: `src/store/chatUnread.ts` — the 5.104.0 refcounted-lifecycle pattern's second instance, deliberately NOT a merge into `unread.ts`: different RPC, different key (tenant + email + display name — the watermark arithmetic is per READER; "me" on a line is `sender_name`, there is no sender FK), different tables, and no mute rules (the deliberate 031 decision keeps chat off the notification bell — this pill is the line's only chrome voice, so it speaks the whole sum via `sumChatUnread`). One channel of its own (`chat-unread-${tenantId}` — 'badge'/'list'/'shared' teach why names must not collide), one 30s safety poll, teardown-then-repoint on identity change, and a `nudge()` the Messages screen calls the moment it advances a watermark. A third feed should become a factory — the store's header says so.
- **The badge**: the Messages pill carries the exact 5.104.0 badge anatomy (gold + rail ring, deep-teal + cream on the gold active pill, `tabular-nums`, 99+ ceiling) and the header bell's aria grammar ("Messages, N unread" / "Messages, no unread") — two bells in the OTHERS section, one anatomy.

### Verified

- E2E (QA147 markers, device qrowner): reload → "Messages, no unread" while Notifications says 11 — and a direct RPC probe returned `[]`, proving the zero is the DB's own, not a feed outage. **The live flip**: one line inserted from a second sender identity (Kitchen room) → the pill read **"Messages, 1 unread" within ~2.5s** — the realtime pulse, not the poll. **The live drop**: opening the room upserted the watermark and nudged the feed → "no unread" without a reload. An open room swallows arriving lines instantly (read-as-open semantics — the first visual attempt was eaten by exactly this behavior, which is correct). **Retraction on delete** rides the 30s poll: the 031 publication does not announce DELETEs, so a deleted line's badge overstays at most one poll cycle — arriving lines (the case that matters) ping instantly. Screenshot `.qa-screens/qa147-messages-badge.png` — both rail badges speaking side by side.
- Hygiene: the four flip-proof test lines were deleted afterward (HTTP 204, ledger restored); the only residue is a read-watermark row for the Kitchen room — a user action, not data. Chat census (2 seeded rooms) intact. Console ZERO errors post-marker incl. reload; tsc 0 unpiped, two passes.

## [5.107.0] — 2026-10-04 — Keyboard-visible

### Added — the whole room answers the Tab key

- **The sweep**: a programmatic per-screen scan of every interactive control found the room half invisible to the keyboard. Not one button lacked an accessible name (0 across the app) — but focus VISIBILITY was a different story: the header chrome (go-back, the bell, order history), every Bills row card (62 controls on that screen alone), the floor's book and seat actions (32), Reports' range tabs and five CSV buttons (17) — all Tab-reachable, none showing where focus had landed. Only the surfaces styled in recent rounds (the CSV buttons, the rail pills) had rings.
- **The fix is architectural, not per-button**: one rule in `index.css` — `:where(button, a, [role='button'], [role='tab'], [role='switch'], [role='combobox'], [role='option'], select, summary):focus-visible { outline: 2px solid var(--sp-gold); outline-offset: 2px; }` — gives every control the gold default ring, mouse users never see it (`:focus-visible` only answers the keyboard).
- **The cascade lesson worth writing down**: the rule lives in `@layer base`, wrapped in `:where()` (zero specificity). The first attempt was UNLAYERED plain CSS — and unlayered author CSS beats Tailwind's entire `@layer utilities` regardless of specificity, which silently flattened the rail pill's `focus-visible:outline-none` into a double ring. Inside `@layer base` the intent is restored: the rule fills only the gaps, and every per-button treatment still wins — the utility rings (Bills' CSV, the inventory exports), `.sp-cta`'s gold-deep, the rail's ring-offset pair that keeps its gold pill from melting into its own ring.
- **Header tooltips**: the two icon-only header buttons gained `title`s — "Back to the previous screen", "Order history — every ticket, paid and pending" — mouse users can now discover what the clock icon does.

### Verified

- E2E (QA146 markers, device qrowner): real Tab-key presses show the gold ring (`rgb(184,142,47)`, 2px, offset 2) on the header bell and Order history; keyboard round-trip (Shift+Tab/Tab) puts the ring on a Bills row card ("Order 96, Active, ₹231.00") — screenshot `.qa-screens/qa146-ring-bills-card.png`. The three override cases hold: rail pill outline stays `none` with its ring-offset pair present, `.sp-cta` keeps gold-deep `rgb(150,114,33)`, utility-ringed buttons unchanged. Post-marker console ZERO errors. tsc 0 unpiped, two passes.
- Note: recharts chart surfaces keep the UA's own focus behavior on Tab (internal focusables) — observation, not addressed this round.
- Read-only round — no cloud writes.

## [5.106.0] — 2026-10-04 — The ledger keeps the clock

### Fixed — the last hand-kept timezones fall in line behind the two canonical voices

- **The drift, found by sweep**: 5.105.0 gave the app two honest clocks — `appday.ts` (the owner's reporting voice) and `bookingday.ts` (the DB's voice, `Asia/Kolkata`, the clock migrations 030/032 compose in). But a repo-wide sweep found four surfaces still hand-rolling their own `Asia/Kolkata` formatters: the bills CSV export's filename, the inventory shopping-list export's filename, the feedback ledger's "today" bucket, and the printed receipt's own `IST_TZ`.
- **The money exports ride the reporting voice**: the bills CSV (`servepoint-bills-YYYY-MM-DD.csv`) and the inventory shopping list now name their file with `appTodayIso()` — the owner's own today, the same word Reports and Close-out speak. 5.84.0 fixed the UTC→IST direction of the bills filename (it printed yesterday between 00:00 and 05:30 IST); this closes the family: the name now follows the reporting day itself. On IST devices the filenames are byte-identical to before.
- **The Guest love card counts the screen's own today**: `fetchFeedbackStats`'s "today" bucket was hardcoded IST, so on a non-IST reporting day the Dashboard's "N ratings · M today" line counted a different today than the Daily Sales chart beside it. The bucket now reads `appTodayIso()` / `appDayKey()` — one day per screen.
- **The receipt keeps the DB's clock, on purpose**: the printed receipt is a legal record — India's GST clock, the DB's clock — so it now imports `BOOKING_TZ` from `bookingday.ts` instead of hand-keeping `IST_TZ`. It deliberately does **not** follow the reporting-timezone choice: a printed tax document must not shift with a settings toggle. The printed "IST" suffix stays unconditional — correct for a tax record.

### Added — export chrome reaches Bills parity

- The inventory shopping list's **Copy / CSV** buttons now carry the gold `focus-visible` rings (keyboard parity with Bills) and the CSV button gained the `Download` glyph and a descriptive `title` — the two export buttons on the shelf now speak exactly the chrome the ledger's export button speaks.

## [5.105.0] — 2026-10-04 — One clock for the promise

### Fixed — the booking voice stops drifting (the parked IST-formatter dedupe, done truthfully)

- **The drift**: three surfaces spoke the booking's hour, from three hand-kept copies — the floor's book (labels followed the owner's reporting timezone since 5.97/5.98), the bell's echo (`ECHO_TZ = 'Asia/Kolkata'`, v5.88.0, hardcoded), the guest drawer's book voice (`BOOK_TZ = 'Asia/Kolkata'`, "byte-matched to FloorScreen" by hand). Cosmetic drift at first glance — but the reminder bell's body is composed IN THE DATABASE, fixed to Asia/Kolkata (migrations 030/032: the trigger decomposes `slot_at` in IST and fires only when the booking is TODAY in IST). On any device whose reporting timezone was not IST, the book's label and the DB's label disagreed — and the echo matcher, which compares those two strings, went silently deaf.
- **The settled truth**: **the booking clock is the database's clock.** A new shared lib — `src/lib/bookingday.ts` — fixes the promise's voice to `Asia/Kolkata` (IST has no DST, so day arithmetic is exact): `bookingSlotLabel` (en-IN · 12h · lowercase, the echo matcher's exact grammar), `bookingDayKey`, `bookingTodayKey`, `bookingDayStartMs` (UTC midnight − 330 min), and `bookingTzIsForeign()`. The book panel, the board's promise chips, the echo matcher and the guest drawer all call it now; the three drifted copies are gone. On every Indian device the words are byte-identical to what each screen said before — which was IST.
- **The seam, kept honest**: the floor's RHYTHM strip (hour buckets vs Reports) stays on the reporting day (`appday.ts` — the owner's word for reports); the book's day groups and window bounds moved to the booking clock — a promise the bell calls TODAY is a row the book calls TODAY, on every device. Composition keeps 5.98.0's word (`appWallToInstant`): the host composes in their reporting clock; the promise's VOICE reads back in the DB's clock.
- **The words that appear when clocks disagree**: with the reporting timezone ≠ booking clock, the promise chip, the host-moment banner and the guest drawer's "Expected …" line append **"IST"** — nobody misreads which clock speaks. On IST devices the tag never renders.

### Verified

- E2E (QA144 markers, device qrowner): Floor book renders "Today · Sat 3 Oct" (booking-clock today — it is 21:10 IST as the round runs) with the slot column in the shared grammar; the echo matcher still resolves real bells (Cancelled ×3 / Seated / Marked no-show / Went quiet) from DB-composed bodies; the guest drawer's book voice agrees ("the 7:30 pm promise was cancelled" = the book's own "7:30 pm"). **The timezone flip**: reporting tz → Asia/Dubai → save → the board's promise chip reads **"4:47 pm IST · Aditi Kulkarni · 4p · went quiet"** — hour fixed to the booking clock, zone word spoken; slot labels elsewhere byte-unchanged → revert to Asia/Kolkata → tag retracts, labels identical. Post-marker console ZERO errors (incl. reload). tsc 0 unpiped, three passes. Screenshot `.qa-screens/qa144-booking-clock.png`.
- Read-only round — no cloud writes; reporting timezone saved, then reverted (the round started at Asia/Kolkata).

## [5.104.0] — 2026-10-03 — The rail learns the bell too

### Added — the Notifications pill carries the honest unread badge

- **The dishonesty**: the sidebar's Notifications pill had an `unreadCount` prop that **no caller ever passed** — a dead prop rendering a badge that could never exist, while the header bell three inches away said "11 unread". Two bells in one chrome: one speaking, one pretending the room is quiet.
- **The wiring**: the unread plumbing (fetch, realtime subscription, 30-second safety poll) moved out of the Header into a shared store (`src/store/unread.ts`) — **one feed, many readers**. Cloning the header's plumbing would have meant two channels, two polls, two queries for one number; instead the store owns the feed and both bells subscribe to it. Lifecycle is reference-counted: each mounted consumer registers (`ensure`) and releases on unmount — the feed lives exactly as long as someone is watching, never lingers past sign-out, and a tenant switch tears the old channel down before the new one starts.
- **The math, written once**: `sumKeptCategories` — the prefs-aware sum (muted categories stay silent, unnamed future categories alert by default) — is shared by header and rail alike. One number, one grammar, two bells.
- **Styling that keeps its own contrast honest**: the badge is gold (`#B88E2F`) with a rail-colored ring on the teal rail, and **inverts to deep teal (`#0F3D3E`) with a cream ring on the gold active pill** — a gold badge on a gold pill would melt and become a badge nobody reads. `tabular-nums`, `99+` ceiling, and the header bell's exact aria grammar ("Notifications, N unread" / "Notifications, no unread") spoken on the rail too.

### Verified

- E2E (QA143 markers, device qrowner): clean boot → header "11 unread" **and** rail pill badge "11" — the dead prop's silence replaced by the shared feed's truth → Settings › Notification, Reminders OFF → save → **both badges drop 11 → 1 live, no reload** → Notifications screen visited: active gold pill carries the deep-teal badge variant, caption "11 bells hidden…" still speaks → Reminders ON → save → **both badges restore 1 → 11 live** → full reload: persistence holds, both still 11. Post-marker console ZERO errors. tsc 0 unpiped, two passes. Mobile viewport (390×844): badge stays inside the icon-only pill. Screenshot `.qa-screens/qa143-rail-badge.png`.
- Read-only round — no cloud writes; prefs returned to all-on (the round started that way).

## [5.103.0] — 2026-10-03 — The toggles learn the bell's language

### Fixed — a word nobody kept, kept at last

- **The fabrication**: Settings › Notification promised "Choose what ServePoint alerts you about" with three toggles — `New messages`, `Order updates`, `Promotions` — and **nothing read them**. Worse, the words named no category the bell actually carries: the stream speaks `system / reminder / message / promotion / feedback`, and "Order updates" has never been a category in it. Three toggles gating nothing, one naming a fiction.
- **The fix**: the panel now speaks the bell's own language, word for word — five rows, one per real `NotificationCategory`: **System alerts** (low stock, re-order lines, house notices), **Reminders** (today's bookings and the house clock), **New messages** (chat bells), **Guest feedback** (low ratings and guest words), **Promotions** (offers & news, still default-off). The section description states the seam up front: *muted categories keep their data behind the bell*.
- **The wiring**: a muted category leaves the alert surface — the bell list on the Notifications screen (filtered before the honest-chip pass, so **no chip ever invites you into a muted room**), and the **header badge** (unread rows now come back as per-category counts; the header sums only the kept ones — the data layer stays prefs-blind). A future category the panel doesn't yet name **alerts by default**: the toggle mutes only what it names.
- **The seam, stated where the hiding happens**: a caption on the bell reads "N bells hidden by your notification settings — they keep their data, and 'Mark all read' still reaches them." Silence is not hiding — the same word quiet hours chose.
- **Live discipline**: a Settings save applies to the bell and the badge instantly (subscribePrefs ticks on both screens; the badge re-sums at render — no reload), the same evaluate-at-render contract the KDS chime and counter doorbell keep.
- **Saved prefs migrate honestly**: the old `{messages, promotions}` keys map onto `message` / `promotion`; the dead `orders` key is dropped — a stale shape must never resurrect a toggle that never worked.

### Verified

- E2E (QA142 marker, device qrowner): panel renders five rows → toggle **Reminders** off → save → bell list drops from 14 (Reminder 11 · System 3) to 3, chips recompute to System-only, caption "11 bells hidden…", **header badge drops 11 → system-unread** → toggle back on → save → list restores 14, badge restores. All live, no reload. Console clean post-marker. tsc ×2.
- Read-only round — no cloud writes; every state change is device-local prefs.

## [5.102.0] — 2026-10-03 — The doorbell answers to the counter

### Added — the counter's own bell switch

- **The gap (parked in 5.101.0)**: quiet hours gave the room a schedule, and the KDS chime already had the floor staff's own mute toggle — but the counter doorbell still had no switch of its own. It rang whenever a fresh ticket landed and the owner's schedule allowed; the cashier's only recourse was the whole room's window.
- **The feature**: the counter inbox band carries a **bell chip** beside its title — the KDS chime chip's sibling in every particular. Three honest states: **"Bell on"** (gold), **"Bell on · quiet"** (deep teal — title says "quiet hours right now, the band still updates"), **"Muted"** (grey). The state rides the device-local key `sp.counter.sound` (sibling of `sp.kds.sound`), persists across reloads, and re-speaks live when quiet hours are saved — the gate itself is evaluated at sound-time, exactly as the KDS reads. Unmuting rings the two-note doorbell once as confirmation (which also unlocks the AudioContext on the user gesture).
- **Both must say yes**: a fresh ticket rings only if the counter's own switch is on AND the owner's quiet hours are off — the same two-gate grammar the kitchen board reads.
- **The band's zero-noise rule is untouched**: zero tickets still removes the band entirely. A muted bell rides the same rule — the next ticket re-opens the band (silently), and the chip is waiting there with its word.
- **The header was rebuilt to make room**: it was one `<button>` wrapping everything; the bell chip now sits beside a proper band-toggle button (a button inside a button is invalid HTML and a11y mush). Collapse behaviour and `aria-expanded` are unchanged in effect.

### Verified

- E2E (QA141 marker, device qrowner): band renders with a fresh walk-in ticket → chip "Bell on" → tap → "Muted" + `sp.counter.sound=off` persisted → tap again → "Bell on" + confirmation doorbell, no console errors → ticket declined through the gate's own Decline (the seed's honest closure).
- `tsc --noEmit` clean, two passes. Console clean post-marker on Dashboard, Kitchen, Floor, and Food & Drinks.
- Read-only except one documented QA walk-in seed (created, then declined) — census changes are stated in the worklog.

## [5.101.0] — 2026-10-03 — Quiet hours: the cafe sleeps when the owner says

### Added — the owner's schedule for the room's sounds

- **The gap**: the KDS chime had the floor staff's own mute toggle, the counter doorbell had NO gate at all — it rang whenever a fresh ticket landed, 3 a.m. included. And the `notify.*` toggles in Settings gated nothing audible (a word nobody kept — noted, not touched this round; their grammar stays what it is).
- **The feature**: **Quiet hours** in Settings › Notification — a toggle plus a from/until window (`22:00 → 08:00` default). While the window holds, the KDS chime and the counter doorbell fall silent. The seam is stated where the word is chosen: **boards and badges keep counting — silence is not hiding**. Overnight windows (from > to) span midnight; equal bounds mean an empty window; invalid bounds are never quiet (a broken schedule must not silence the room by accident).
- **The gate is evaluated at sound-time**, so a Settings save silences (or re-opens) the room without a remount — proven live: save a window covering now → the Kitchen chip re-speaks itself within the same breath; shift the window off-now → it returns, no reload. The chime button's word stays honest in every state: "Chime on" / "Chime on · quiet" / "Muted", with a title that explains the quiet state ("…the board still updates").
- Mechanics: `SpPrefs.quiet { enabled, from, to }` + `inQuietWindowAt`/`isQuietNow` in the prefs lib (device clock by design — a chime is the cashier's room, the seam 5.97.0 drew); `getPrefs` now merges nested objects (paymentMethods/notify/quiet) so a partial saved shape can never lose default bounds.

### Verified

- E2E round-trip (QA140-QUIET-MARKER): Notification section renders the toggle + window rows (defaults 22:00→08:00, inputs disabled while off); enable → window 14:00→16:00 → live preview "Chimes are silent right now" → save → `servepoint_prefs.quiet` persisted exactly → Kitchen chip reads "Chime on · quiet" live; window shifted to 02:00→04:00 → chip returns to "Chime on" live; preview re-speaks ("Chimes would ring right now"); reset to disabled. tsc 0 unpiped, two passes; post-marker console zero errors. Screenshot `.qa-screens/qa140-quiet-hours.png`.

## [5.100.0] — 2026-10-03 — The report finds its own way out

### Added — Support's report gains a real handoff (ADR-0014 unchanged)

- **The dead-end**: "Send report" honestly stored nothing, then told the user to email the operator — and made them retype everything. The success state now hands the composed report over: **"Open in email app"** (a `mailto:support@servepoint.app` link with `[ServePoint] {subject}` + full body prefilled, signed with the reporter and workspace — the user's own mail client does any sending, the app still transmits nothing), **"Copy report"** (full text to the clipboard), and the existing "Write another report" restyled as the quiet third choice.
- **"Attach diagnostics"**: a chip beside Send that appends the block the operator always ends up asking for — release (read from the service worker's cache names, the one place the release number truly lives; `unknown` stays the honest word when no SW exists, e.g. dev), workspace, reporter, screen, timestamp, online state, device UA. Re-attach REFRESHES the block (marker-split, idempotent) instead of stacking copies, and honours the 2000-char budget by trimming the narrative, never the block.
- Styling: the success card grew a proper CTA row (gold primary mailto, bordered copy, ghost write-another); the diagnostics chip speaks its own state (green + check when attached); both copy affordances on the page now share one clipboard helper with the execCommand fallback for non-secure contexts.

### Verified

- E2E on the live Support screen (deep link `/support` intact): fill → attach diagnostics (block lands with workspace/reporter/device; `release: unknown` correctly honest in dev where no SW controller exists) → send → success card's mailto decodes to the right subject and carries the diagnostics block in the body; copy + write-another present; form resets clean. tsc 0 unpiped; post-marker (QA139-SUPPORT-MARKER) console zero errors. Screenshot `.qa-screens/qa139-support-handoff.png`.

### Found (no code change — owner decision)

- **Cross-tenant RLS read extends to the money table**: qrowner's owner JWT can read CheeseBurg's order **#97** (₹105, completed, unpaid) by id — migration 006's table-level owner gate isn't per-row on `orders` either. Every app surface scopes by `tenant_id` in code and stays honest (Bills/Close-out/Kitchen arithmetic reconciles exactly: **54 QR Flow orders = 31 paid + 5 active + 18 cancelled**, plus the foreign stray = the unscoped 55). The long-carried census line corrects from this round: **orders 54** for QR Flow (previous "55" counted CheeseBurg's stray).

## [5.99.0] — 2026-10-03 — The dashboard stops inventing

### Fixed — two fabrications, one grammar

- **"Best Employees" sold fiction**: the card showed each member with a Sales column computed as `totalRevenue × [0.42, 0.31, 0.17, 0.1][i]` — a hardcoded slice by list position. ₹123.00 under Qrowner was 42% of the day's revenue, not anything the person sold; `orders` carries no staff attribution at all, so per-staff sales was never computable. The card is now **Team**: real members (from the workspace roster), real roles (owner gets the gold ring + pill), real tenure ("Since Oct 2026" from `tenant_users.created_at`), sorted by tenure, capped at four. The caption states the seam out loud: "Per-staff sales isn't tracked yet — tickets don't record who took them." The old Today/Week selector is gone with the fiction it fed (a roster has no time axis, and the Week view was the WeekNote stub anyway).
- **"Total Order" counted cancellations**: `totalOrders` read the day's full row count while the revenue chart beside it (correctly) skipped cancelled — a day with 1 real ticket and 17 QA-test cancellations said "18 orders · ₹294.00" and invited a ₹16 average that never existed. `totalOrders` and `ordersTrendPct` now read the day's LIVE tickets — the same slice 5.94.0 gave Trending. **New Customers** had the same leak (a name on a ticket that never happened is not a customer); it now counts distinct `customer_name` on live tickets only, both sides of its delta.
- Today's service read honestly: Total Order **1** (−93.3% vs yesterday's live tickets), New Customers **0** (−100%), revenue ₹294.00, margin "1 ticket" — every number now tells the same story.

### Verified

- E2E on the live dashboard: Team shows "Qrowner · OWNER · Since Oct 2026" with the honest caption and no Sales column; strip, Daily Sales, Total Revenue, Trending and margin cards unchanged; a11y descriptions re-speak the real numbers ("Total Order: 1 — -93.30% versus yesterday"). tsc 0 unpiped; post-marker (QA138-DASH-MARKER) console zero errors. Screenshot `.qa-screens/qa138-team-honest.png`. Census: orders 55 · payments 31 · order_items 57 · customers 3 UNTOUCHED — read-only round (REST probes were GETs).

## [5.98.0] — 2026-10-03 — Bookings speak the owner's clock

### Added — the last seam of the reporting-day story closes

- **The seam 5.97.0 documented**: booking slots composed as wall-clock `+05:30` no matter what — a host whose floor runs another zone picked "7:30 pm" and the book stored an instant 90 minutes away from the hour their wall showed. The dialog even printed "Day (IST)" / "Arrives (IST)" as literals.
- **The fix**: a new `appWallToInstant(dateIso, wall, tz)` in the day lib — the wall time the host picks composes through the OWNER'S chosen reporting clock (noon-anchored midnight + wall minutes, offset re-measured at the result so a zone's spring-forward can never fabricate an hour). The Take-a-booking dialog composes through it, its labels speak the chosen zone ("Day (GST)" under Dubai — byte-identical "Day (IST)" for the default), and the clash/turn checks ride the same instant. api.ts's `ReservationInput.slotAt` contract comment now tells the truth.
- **The floor keeps the word live**: FloorScreen now subscribes to prefs changes (the one surface 5.97.0 deliberately left to its refresh cycle) — a Settings save re-renders the book, the rhythm and the dialog's zone tag in the same breath as Reports and Close-out.
- **Deliberately unchanged**: the book's day grouping, the reminder notifications and the guest-facing QR all read the same reporting clock they always did; on every Indian device this release is byte-identical to 5.97.0.

### Verified

- E2E round-trip under Asia/Dubai: composed "7:30 pm ×2 · T1" for QA137 → the book speaks "7:30 pm" (GST), flip back to IST live → the SAME row reads "9:00 pm" (90 min, the exact zone delta; same stored instant, both clocks honest) and every seeded row shifts with it (Kiran 8:45 am GST ↔ 10:15 am IST). Booking cancelled — the honest CANCELLED/Restore trail. tsc 0 unpiped, twice; post-marker console zero errors across Reports → Close-out → Floor.

## [5.97.0] — 2026-10-03 — The timezone earns its word

### Fixed — Settings › Timezone was a word nobody kept

- **The gap**: the Language & Region panel promised "Timestamps in reports and shifts" follow the chosen timezone — and `prefs.timezone` was written on save and read by **nothing**. Reports, the Close-out day book, the COGS day-bounds and the floor's rhythm all hardcoded `Asia/Kolkata` (some even raw `+05:30` offsets), while the zone's printed name ("IST hours", "(IST)" CSV headers, "· Asia/Kolkata" on the Z-report) was inked as a literal. An owner who set Dubai got IST numbers wearing IST words.
- **The truth**: a new shared lib, `src/lib/appday.ts` — the reporting day as ONE truth that follows the setting: day keys, day windows (noon-anchor midnight math, DST-refined — v5.83.0's proven argument, generalized), hour buckets, and the zone's spoken tag ("IST" stays "IST"; Dubai speaks "GST" — Intl's short name). Reports, Close-out, api.ts's COGS bounds and the floor rhythm/sticker dates all resolve through it; a Settings save refetches Reports and re-opens the Close-out book live, without a reload.
- **The seam, said out loud**: two day-truths with distinct owners, both documented — the **device day** (`day.ts`: bills, KDS, counter, strip — a cashier's wall clock belongs to the device they hold; the setting's own description never promised these) vs the **reporting day** (`appday.ts`: reports, close-out, shifts, printed slips — the owner's word rules). On every Indian device both say IST, so nothing changes for the real tenant — to the paisa.
- **The words follow**: Reports' captions now say "GST days / GST hours" when Dubai is set; every CSV header speaks the real zone (`Day (GST)`, `Fired (GST)`, `Closed (GST)`…); the Z-report prints "· Asia/Dubai" and "Printed 18:06 GST"; the floor's rhythm says "GST hours · last 7 days"; printed QR stickers carry the chosen day. The Settings row's own description now states the seam precisely: "Reports, Close-out and shift clocks follow this timezone — bills and kitchen boards read the device's own clock".
- **Deliberately untouched**: booking slot composition (`slotAt`) stays wall-clock-IST — the café's front-of-house clock, documented in api.ts; a follow-up if the owner ever runs a Dubai floor.

### Verified

- tsc 0 unpiped; regression on the default tenant: every IST number, label and CSV header byte-identical to 5.96.0. E2E flip to Asia/Dubai and back, live without a reload: captions/CSV headers/shift clocks speak GST, the sales-by-hour peak shifts 8p → 7p (the exact −90 min bucket move), Close-out stamps "as of 18:06 GST", then everything returns byte-identical to the IST baseline (peak 8p ₹2,956.80).

## [5.96.0] — 2026-10-03 — The day door

### Added — Reports' day-by-day bars open the day's counted book

- **The gap**: the Day-by-day chart was a picture — a bar for a day invited the only question a bar can ask ("what happened that day?") and answered nothing. The answer already existed one room away: Close-out browses any IST day with its own Previous/Next arrows, but nothing carried you there.
- **The door**: every bar is now a door — tap a day in the chart and Close-out opens straight onto that day's counted book (the sectionHint grammar, `day:YYYY-MM-DD`, consumed once on arrival; never persists, never rides the URL). The affordance is said out loud under the caption ("Tap a bar to open that day in Close-out"), the bars carry a pointer cursor, and the hovered bar warms gold.
- **The craft**: the arrival only PEEKS at the hint during render (a read is render-safe) and consumes it in the mount effect — a store write during EOD's render tripped React's set-state-in-render guard in the first cut, caught by the post-marker console check and fixed before landing. A hint aimed at another room (Bills' 'unpaid') is never swallowed.
- **Verified live**: leftmost bar → Close-out "Sun, 27 Sept, 2026" (orders 4, gross ₹1,617.00 — the first data day); sidebar re-entry lands on today (no leakage); Bills' unpaid door still pre-filters; post-marker console zero errors; tsc 0 unpiped, twice. Also closed the parked "Reports range-picker honesty" anchor: all four range tabs re-audited — Today's chips carry direction by icon+color+title ("₹294.00 vs ₹5,046.30"), All time already says "no earlier window to compare".

## [5.95.0] — 2026-10-03 — Every shelf one tap away

### Added — the category switcher rail

- **The gap**: inside a category the only route to another category was the header's Go back — Coffee → Bakery cost three taps (back, land on Categories, re-enter) for a cashier standing mid-order. The hierarchy was honest; the choreography wasn't.
- **The rail**: at the items level a chip rail sits above the menu — every category one tap away, the active chip dark-inked with `aria-current`. Tapping a sibling swaps the category in place (breadcrumb, h1 and item grid follow); tapping the **active** chip walks back to Categories — the tap-is-the-way-back grammar the pulled-dish modal already teaches. Badges on each chip say what the shelf holds, and the rail scrolls sideways (scrollbar hidden) when the room grows.
- **The counts**: category cards now speak what they open onto — "1 item" / "2 items", with a "· N pulled" suffix when some of them are sold out (a "3 items" card that opens onto one sellable dish was a small lie). One `countByCategory` map feeds cards, chips and titles, so every count on the surface comes from a single pass.

### Verified

- Live walk: cards read "Coffee 1 item · Bakery 1 item · Food 2 items"; inside Coffee the rail shows `[ACTIVE] Coffee 1 / Bakery 1 / Food 2` with exit title "Back to all categories — Coffee is open"; tapping Food swaps h1, breadcrumb and grid in place (2 cards); tapping active Food returns to Categories (3 cards, rail gone). Post-marker console zero errors; tsc 0 unpiped, twice.

## [5.94.0] — 2026-10-03 — Honest numbers at both scales

### Fixed — Trending counts today's plates, not the museum

- **The gap**: the dashboard's "Trending Dishes · Today" summed **every `order_items` row ever written** — the read fetched wide and nothing sliced it: no day filter, no cancelled exclusion. A cafe whose live week holds 46 sold items read "Flat White · 65" under a TODAY header (all-time quantity, including the 18 cancelled tickets' never-happened lines and every earlier day). A dead `todays.forEach` loop that computed a timestamp and voided it sat right above — the abandoned start of the very filter that was missing.
- **The fix**: the item read is sliced to the day's live ticket ids (`fetchOrderCogs` fetch-wide/slice pattern) — cancelled never happened, earlier days are history. Verified against DB truth: QR Flow's only live ticket today (#126) holds one Flat White → the card reads "Flat White · 1"; CheeseBurg's Classic Sandbich stays invisible by correct RLS.
- **The unit**: the column header said "Orders" while counting plates (a "Flat White ×2" ticket is one order, two plates) — it says **Plates** now.
- **The 7-day toggle** stays the deliberate WeekNote stub (the dashboard contract exposes today-scoped aggregates only — documented since the card landed).

### Added — the multiple voice for extreme deltas

- **The gap**: Reports' KPI delta chips spoke raw percentages at any ratio — with a near-empty prior week, the chips read "1471% / 1550% / 1433% vs prior 7 days". Mathematically true; as a signal, a dare.
- **The voice**: from 1000% up (eleven times prior and beyond) the chip speaks in multiples the way the counter does — "15.7×", "16.5×" — while the title/aria keep both raw numbers ("₹10,884.30 vs ₹693.00 — 15.7× the earlier window (prior 7 days)"). Ordinary ratios keep percentages ("4.8%"), flat stays "±0%", an empty prior window stays "new".
- **Verified live**: gross/GST/net "15.7×", orders "16.5×", avg ticket "4.8%" unchanged; Trending "Flat White · 1" under "Plates"; post-marker console zero errors across Reports → Close-out → Dashboard; tsc 0 unpiped.

## [5.93.0] — 2026-10-03 — Every word addresses its day

### Fixed — the sidebar's words are the URLs

- **The gap**: two rail names differ from their section ids — the rail says "Close-out" (code: `eod`) and "Guests" (code: `customers`). The v5.32.0 deep-link resolver matched section ids only, so `/close-out` and `/guests` — the words staff actually bookmarks, pins, and whispers across the counter — fell through to Dashboard in silence, while `/eod` and `/customers` (words no human ever types) worked.
- **The fix**: `SECTION_SLUGS` in App.tsx — every plain id keeps resolving, and the two spoken names resolve alongside. `/close-out` lands on Close-out ("Close-out · ServePoint"), `/guests` lands on Guests; `/eod` and `/customers` unchanged.

### Fixed — the day's book says which day it counts

- **The gap**: Close-out's unpaid tile said "Unpaid right now" and counted only tickets created today (the day's book fetch is day-bounded by design) — while the dashboard strip counted every unsettled ticket, any day. With the five ghosts from earlier days still open, the strip said "5 · ₹1,801.80" and the tile said "0 · ₹0.00": both honest math, no words saying they count different days. The host closing the day read "right now = zero" and trusted it.
- **The label**: "Unpaid today" (and "Unpaid that day" when browsing a past date — frozen history, not "now").
- **The whisper**: one bounded fail-soft census read (`created_at < day start`, not cancelled, not paid — count only, RLS-scoped) feeds the same grammar the strip has spoken since 5.89.0: "5 older unpaid off today's book — see Bills" (History glyph, amber ink — the gold family), rendered only for today's book.
- **The door follows the truth**: the tile's Bills door now opens when EITHER window holds money (the strip's 5.89.0 rule — the whisper points at Bills, so Bills must open), and its aria speaks both windows: "Open Bills — 0 unpaid tickets, ₹0.00 still out, 5 older unpaid from earlier days". Landing is pre-filtered to money still out, where the 5.92.0 day-aware rows wait.
- **Verified live**: `/close-out` `/guests` `/eod` `/customers` all resolve; card reads "UNPAID TODAY · 0 · ₹0.00" + whisper + door; door click lands Bills (breadcrumb Close-out›Bills, filter Active, chip "5 unpaid · 5 older" agreeing with the whisper's census); post-marker console zero errors; tsc 0 unpiped.

## [5.92.0] — 2026-10-03 — Bills speaks the day

### Added — the room the door opens finishes the sentence

- **The gap**: 5.89.0 taught the dashboard's strip to whisper "4 older tickets off today's inbox — see Bills" — and Bills answered with a bare "17:28" that read like tonight. A host landing from that door couldn't tell which of the five open bills were the older ones the strip was pointing at; yesterday's ghosts masqueraded as today's tables. Worse, the same bare times sat on paid history and ledger entries, aging yesterday's money into today's.
- **The day, as one shared truth**: `src/lib/day.ts` — `isSameLocalDay` (four byte-identical copies across Kitchen, CounterInbox, Bills and Dashboard now read one lib, so "today" can never mean one thing on the board and another on the strip), plus `dayLabel` / `dayTime`: today speaks the bare clock as always ("17:28"), yesterday says the word ("Yesterday 17:28"), anything older shows the en-IN calendar ("2 Oct · 17:28"), and an unparseable timestamp renders "—" — never a fake date.
- **The row wears it**: every off-today bill's time column speaks its day; an off-today ticket still open adds the amber **"older ticket"** chip (History glyph, #FFF4DB/#8A5A00 — the gold family that is this app's one grammar for "needs attention") beside the table subline, next to any offer and split-ledger chips. Paid history speaks the day but wears no chip — history is history, not an alarm.
- **The count chip echoes the strip**: "5 unpaid" becomes **"5 unpaid · 5 older"** when off-today tickets are among the unpaid, with a title that spells it out ("5 awaiting payment — 5 from an earlier day"). The door opens both ways.
- **The detail and its clocks**: an off-today order's detail header grows the amber whisper "Yesterday 17:28 — from an earlier day" under the status pill; the timeline's events and the ledger's part-payments all speak `dayTime` too (the ledger's fixed-width time cell learned to flex — "Yesterday 10:57" no longer clips).
- **Verified live**: strip door → Bills lands with the chip echoing the strip's own count grammar; ghost #96 "Yesterday 17:28" + chip + detail whisper; paid ghost #48 "Yesterday 10:55" chip-free with `Mark ready` intact; today's #126 stays a bare "11:28"; post-marker console zero errors across Bills → Kitchen → Counter (shelf voices intact, "~235 more on the shelf") → Dashboard (strip whispers intact); tsc 0 unpiped.


## [5.91.0] — 2026-10-03 — The counter reads the shelf

### Added — the shortlist speaks the shelf's answer at the moment of selling

- **The gap**: the shelf's answer ("how many more of this dish can we still make?") lived only on the Inventory board — discovered after the order was taken, at the worst moment ("sorry, we're out"). The counter's shortlist — the very cards the cashier taps — named the week's movers but stayed silent about whether the shelf could back the tap.
- **One shared truth**: the coverage math (thinnest recipe SKU decides, computed from recipes 015 × live stock) left the Inventory component and became `src/lib/shelf.ts`, read by BOTH the board and the counter — the board's verdict thresholds ride along verbatim (`LOW_COVER = 5`; green comfortable / amber low / red out / grey can't-say).
- **The voice**: under each shortlist card, beside the week's counts — "~235 more on the shelf" (green), "~4 more left" (amber, under the threshold), "can't make another — Coffee beans is out" (red), "shelf can't answer" (grey — a recipe SKU is off the shelf, said honestly). A dish with **no recipe on file stays silent** — silence, not zero; an unread shelf (fail-soft read riding the shortlist's own reload tick) silences every voice. Hover/aria names the thinnest SKU and the reasoning.
- **Fixed**: the shelf board's "1 tickets this week" pluralization slip ("1 ticket" now, the counter's rail already spoke it correctly).

## [5.90.0] — 2026-10-03 — The CRM reads the book

### Added — a guest row carries today's promise

- **The fourth surface**: the promise arc has learned the floor's chip and drill (5.84–5.86), the book rows (5.87) and the bell (5.88). The one surface still blind to the book was the CRM: a host opening Guests saw tier, visits and spend — but never that this guest has a promise on the book tonight, that last night's party went quiet, or that the party is on the premises right now.
- **The join is the phone** — the CRM's own identity key since v5.5 (order phones upsert the book of guests). A reservation speaks for a guest only when BOTH sides carry a non-empty phone that normalizes to the same digits (`97660 11223` and `9766011223` are the same guest; two empty phones are never a match). The echo never guesses; a row without a phone on either side stays silent.
- **One voice per guest, the book's tones**: the strongest of today's rows speaks — seated (green #E7F1E8/#2E7D32, "the party is on the premises now") outranks an upcoming booked slot (gold #FBF3E1/#8A5A00, "On the book · 7:10 pm", due-soon minutes in the sentence), which outranks no-show (red), went quiet (grey #F1F4F1/#6B6B6B — the clock never convicts), cancelled (grey — the book keeps the record). The pill wears the RES_META family byte-matched; hover/aria carries the full provenance sentence ("Matched by phone number; the book's truth as of now"). The 30s bookTick crosses the expected/quiet boundary between loads, unprompted.
- **The drawer learns too**: opening a guest renders a "Today on the book" block above THE USUAL — same tones, the full sentence, the speaking row's state. Fail-soft: the book rides alongside every CRM load, and a failed read silences the voices rather than alarming the screen — an unread book never becomes an invented all-clear.

## [5.89.0] — 2026-10-03 — The strip keeps the day

### Fixed — the dashboard's "Needs you now" strip stopped counting yesterday's ghosts

- **The lie, measured**: the strip said "4 tickets waiting / 3 in the kitchen / 2 late prep" while the rooms it opens into showed **zero waiting and one on the board**. Root cause: the mirror counted all-time `new`/`pending`/`preparing` tickets (the fetch has no day filter), but the counter inbox and the KDS board are both deliberately today-scoped — so six stuck tickets from yesterday (four never-Ok'd `new`, one parked `pending`, one paid-but-never-bumped `preparing`) inflated tonight's alarm with work that can never be cooked. The strip's own doc claimed "on the board right now"; the arithmetic said otherwise.
- **The grammar**: every waiting count now speaks the SAME local-day rule the board ("board data — today only") and the inbox already speak — `isSameLocalDay`, byte-matched. Zero means zero: the counter's inbox is honestly empty today, the board honestly holds one ticket.
- **Whispers, never silence**: the older stuck tickets are not hidden — each haunted card carries an amber whisper with its own glyph (History): "4 older tickets off today's inbox — see Bills" / "2 older stuck tickets off today's board — see Bills". When a card's today-count is zero but ghosts remain, the card still renders ("0 waiting" / "0 on the board", calm grey) and its door follows the truth — it opens Bills, the room that can still act. A stuck paid ticket (#48-type: paid, eaten, never bumped) has no board anywhere; the whisper is its only voice on the strip.
- **Style — one clock**: the late-prep card joins the KDS's own escalation (`waitTone` thresholds, verbatim): amber at the 10-minute SLA, red past the board's 20-minute red line, and the oldest wait spelled out in the hint ("oldest waits 21 min — the board's own clock"). Strip and board now agree to the minute and to the tone.

## [5.88.0] — 2026-10-03 — The echo learns

### Fixed — booking reminders stopped advertising dead promises

- **The gap**: a booking reminder is a TEXT snapshot — the migration-030 trigger writes "Booking today: Kavita Desai ×2 / 5:31 pm — T2" with no reservation FK — so the bell kept advertising parties whose promise had already died: cancelled, seated, no-show, gone quiet. The floor learned honesty across 5.84–5.87; the notification echo never did. A host reading the bell would prep for a party that isn't coming.
- **The echo**: each reminder now reconciles with the book's LIVE truth at render time — title parsed for guest + party, body's first token ("5:31 pm") parsed for the slot (byte-matched to the floor's own IST label formatter), matched against today's reservations. **Exactly one match speaks; zero or several stay silent** — the echo never guesses, and an unread book (null) never becomes an invented all-clear.
- **One voice, the book's tones**: the matched card wears a status pill in the RES_META family the floor already speaks — grey "Cancelled" (guest's name struck through, card dimmed to the book row's opacity), green "Seated", red "Marked no-show", grey "Went quiet" (the 5.86 voice: the hour went by, still booked — the clock does not convict), gold "Still expected" (the positive echo: the book still holds this promise as of now). Hover/aria carry the full provenance sentence ("Matched to the book by guest, party and hour — the book's truth as of now").
- **The echo's clock**: a 30s tick of its own walks the quiet/expected boundary between polls — the same discipline as the floor's promise clock. The echo's book rides the screen's existing rhythm (realtime ring or 30s poll), fail-soft: a refused read silences the echo, never the list. Read-only — the bell never writes to the book.
- QA-path census: orders 55 · payments 31 (a full counter happy-path walked this round: Flat White Large + Extra shot ₹330, ₹50-off offer, GST on discounted subtotal ₹14, ₹294.00 placed as #126, fired to kitchen, charged cash — every write through the app's own paths).

## [5.87.0] — 2026-10-03 — The book keeps itself honest

### Added — the write side of the book gets a conscience

- **The gap**: 5.84–5.86 taught the board, the drill and the clock to speak every state of a promise — but the moment a promise is INKED stayed blind. Nothing stopped (or even named) the oldest booking-desk mistake: two parties promised onto one table inside the same turn, or a fresh promise dropped onto a table that is still holding a live ticket right now. The book never invents — but it also never warned.
- **The clash whisper** (BookingDialog): pick a table whose standing `booked` rows fall within 90 minutes of the new hour and the dialog says so before the ink dries — "T2 already holds Aditi Kulkarni at 4:47 pm — one table, two parties. Choose another hour or table, or write it in anyway." Quiet rows still count (a party twenty minutes late is still expected); seated/no-show/cancelled rows never clash (their promise is already resolved). The rule is pure |Δ| < 90 min with **no day filter** — a party at 11:45 pm honestly collides with one at 12:15 am, because the turn crosses midnight. Multiple hits are counted, the earliest is named.
- **The still-held whisper**: pick an occupied/billing table for a slot inside the next hour and the dialog names the presumption — "T2 is still holding a live ticket — book this hour only if that party is settling up; otherwise choose a later hour." Backfilled history (slots long past) never nags.
- **Whispers, never blocks**: both notes wear the amber family `#FBF3E1`/`#8A5A00` beside the existing party>capacity nudge, and "Write it in the book" stays enabled — honest information at write time, the host decides. An unread book (`null`) shows nothing — silence, never an invented all-clear.
- **Styled — the book speaks the board's language**: the book panel's status pill now carries the promise tones — amber `#FDF3E4`/`#8A5A16` "Booked · due soon" inside 45 minutes, grey `#F1F4F1`/`#6B6B6B` "Booked · went quiet" once the hour has passed — byte-consistent with the card chips and drill rows, so chip, drill and book read as one instrument. IST-today only (the board refuses to speak across days, and so does the book); rides the 30s promise clock, so rows flip between fetches without one.
- Census untouched; the round's writes are the feature's own lifecycle (one clash-proven booking written then cancelled through the book's own buttons).

## [5.86.0] — 2026-10-03 — The promise went quiet

### Added — the third state of a promise: the hour passed, nobody sat

- **The gap**: 5.84's clock rule said past slots never speak — honest, but it left the most decision-heavy moment of the host's day silent on the board: the party is 20 minutes late, the table is filling up, and nothing anywhere asks "call them, or give the table away?" (the book still said "Booked"; the EOD wouldn't count a no-show until the day closed).
- **"Went quiet"** — a promise whose promised hour has passed, still `booked`, still today-in-IST, now wears its own grey (`#F1F4F1`/`#6B6B6B`) on the card chip ("4:00 pm · Nikhil Shah · 3p · went quiet") and in the drill's Promised list. The wording is deliberate: **went quiet, never "no-show"** — a party can be ten minutes late, and the verdict is the host's, not the clock's. The board refuses to pretend the hour is still ahead; it refuses just as firmly to convict.
- **The three real paths, on the quiet row itself**: **Call** (the booking's phone, one tap), **They're here** (the 5.85 gesture — booking seated first, then the table occupied; offered only when the table can actually take them), and **No-show** (the book's own flip, which the day's close already counts — 5.83). The clock never writes "no-show" by itself; the host's tap does.
- **Priority grammar**: a table with both a future promise and a quiet one shows the FUTURE on its card (the actionable hour) — the quiet debt lives in the drill. A table whose every promise has gone quiet speaks the most recent quiet one. The 5.85 due-whisper now keys on the first FUTURE promise only — a quiet row never borrows the due voice.
- **Verified live** (two self-labelled seeded fixtures whose slots had passed): available T1 showed the grey chip + named seat button and its drill carried the full Call / They're here / No-show set — "They're here" DB-verified (Nikhil seated, T1 occupied) then Free restored the table; occupied T2 held the due whisper for Aditi's 4:47 slot AND Vikram's quiet row at once — his No-show tap DB-verified (`no_show`), after which the drill released him while the book kept the record (line-through, No-show label) and 5.83's EOD strip gained a truth to count. Book census after the round: 1 booked · 2 seated · 1 no-show · 5 cancelled — every state earned, none invented.
- Census untouched at 54 · 30 · 56 · 3; writes only through the book's and board's existing lifecycle paths.

## [5.85.0] — 2026-10-03 — The promise arrives

### Added — the board's promise becomes a gesture

- **The gap**: 5.84 put each table's next promise on its card — but the affordance stayed in the book panel, a page-region away from where the host stands when the party walks in. Reading "Rohan Mehta · 7:22 pm · T1" and then finding his row in the book to seat him is two surfaces for one moment.
- **Named seat buttons** (available + reserved cards): when a card knows WHO is coming, its seat button says the name — "Seat Rohan Mehta" (deep teal when the hour is comfortable, book-amber `#8A5A16` once due). One tap flips the booking **seated first** (the book, the source of truth, acknowledges the arrival) and then seats the table **occupied** — no reserve limbo when the guests are already standing there. The book's own row keeps its gentler Seat (→ reserved) for the party still walking over. Errors surface through the card's own action strip; a failed table write leaves a seated booking and a free table — both truths visible and actionable.
- **The host-moment whisper** (occupied/billing drills): when a due-soon promise lands on a table still holding a ticket, the Promised section opens with the honest sentence — "Aditi Kulkarni's party is due 4:47 pm — the table still holds #96. Settle the ticket, or move the party." No new writes, no seat button (that would be a lie while a hold lives) — just the two real paths, named. Pointer-less occupied gets "the table is still busy".
- **Verified live** (the 5.84 seed fixtures, now one round older): T2's drill spoke the whisper with live #96 while Aditi's slot sat inside the window; "Seat Rohan Mehta" on T1's card flipped his booking to `seated` and T1 to `occupied` in one gesture (DB-verified), the promise chip vanished the moment the booking stopped being `booked` (5.84's booked-only rule), the book panel re-sorted him under SEATED, and the standard Free restored T1 to available afterwards. The 3-second confirm arm bit its own automation twice — the flow is correct for humans.
- Census untouched at 54 · 30 · 56 · 3; the round's writes are the feature's own lifecycle (one booking seated, one table seat + free).

## [5.84.0] — 2026-10-03 — The board keeps the book

### Added — the floor's cards advertise their next promise

- **The gap**: the book (5.38) lists reservations as a chronological panel — but the BOARD, the surface a host actually stares at while seating walk-ins, stayed silent about the future. "The Mehra party lands at 7:30 — on WHICH table?" required opening the book and cross-referencing by memory. The floor knew its holds (5.82) but not its promises.
- **Promise chips on the cards**: each table card grows its next still-standing promise — `7:30 pm · Aditi Kulkarni · 4p` in the book's gold grammar (`#FBF3E1`/`#8A5A00`, CalendarClock), turning **amber** (`#FDF3E4`/`#8A5A16`) once the party is **due within 45 minutes**. A 30s promise clock flips the tone by itself while the board sits open (the poll refetches data; the clock only moves the hands).
- **"Promised today" in the drill**: the panel a host opens before seating now lists EVERY still-standing promise for that table — hour, guest, party size, a `due 12m` pill inside the 45-minute window, and the book's notes whispered under the list.
- **Honesty rules (the book never invents)**: only `booked` advertises — a seated, no-show or cancelled row never speaks; yesterday's promises have already kept or broken themselves, so they don't either; slots are judged TODAY-in-IST with the same IST helpers the book reads; an unread book (null) is silence, never an invented calm; untabled rows pin nowhere (they wait in the book panel for a table assignment). One voice on card and panel: same tones, same hover/aria sentence naming guest, party, hour — and naming the source ("From the floor's book — booked rows only").
- **Verified live** (two self-labelling seeded bookings, qa123-seed-book): occupied T2 carries Aditi Kulkarni at 4:47 pm — amber due-soon chip on the card, `due ~35m` pill in the drill while the table still holds live #96 (the exact host moment: the party lands while the table is still busy); available T1 carries Rohan Mehta at 7:22 pm — quiet gold. The five cancelled QA rows from rounds 77/79 correctly never speak.

### Fixed — the Bills CSV filename joins the right-day family

- `servepoint-bills-*.csv` used the UTC date in its filename — between 00:00 and 05:30 IST the export printed YESTERDAY. Now formatted in IST (the same wrong-clock family EOD's stepper came from; 5.83's lesson applied across the house).

### Wiring

- Zero migration. The only writes this round are the two seeded `booked` demo rows (self-labelled in `note`); the app's own promise layer is read-only — the book remains the only writer, the seat/flip actions remain the only lifecycle.

## [5.83.0] — 2026-10-03 — The close sees the floor

### Fixed — the day stepper's IST arithmetic (a real, old bug)

- **The bug**: EOD's `shiftDay` anchored at midnight IST (18:30Z on the PREVIOUS UTC date) and then shifted the UTC date of that instant — so from Sat 3 Oct, "Previous day" derived `2026-10-01T18:30Z`, whose UTC date is still the 1st → the stepper **double-jumped 3 → 1**, and "Next day" from 1 Oct was a **no-op** (2 Oct was unreachable by the buttons). Unit-proven before and after (`shiftDayOld('2026-10-03',-1) = '2026-10-01'` vs the fixed noon-IST anchor returning `'2026-10-02'`; month boundaries verified both directions). Round 118 logged "an automation double-click landed on 1 Oct en route — not an app bug": **that was this bug**, misattributed to the tooling. The record is corrected.
- **The fix**: anchor at NOON IST — ±1 UTC day then lands safely inside the neighbouring IST calendar date for every day of every month.

### Added — the day's rounds land in the close-out and on the printed Z

- **The gap**: 5.82 taught the floor to prove its holds; but the daily ritual still ended silent on the floor — the owner closes the day knowing tickets, payments, margin and the bin, never learning that the tables served 12 rounds worth ₹4,174.80 or that T1 carried eight of them.
- **THE FLOOR strip** (Close-out, cost & margin band, right under the bin): the day's **rounds** — non-cancelled tickets that HELD a table, the same ledger rule the floor rhythm chart reads — with the round rupees, the **busiest table** (rupees → rounds → name, the house deterministic tie-break), an amber no-show whisper when the book holds no-shows for the day, and the honesty footer "table tickets only — walk-in counter rounds never held a table". Quiet day: grey "The floor sat quiet — no table rounds to close out." Tones in the floor's green/teal family — the bin burns red, the floor earns green.
- **Wiring**: zero migration, zero writes, zero new order reads — the table names ride the day-orders query itself (`dining_tables(table_number)` embed, the fetchOrders boundary pattern); no-shows come from one fail-soft fetchReservations read (fetched once per tenant, IST-day-filtered client-side; a failed read silences the whisper — never a guessed zero). The strip recomputes per selected day with the screen's own 20s heartbeat.
- **THE FLOOR · ROUNDS on the printed Z**: rounds + rupees, busiest table, no-shows when they exist, "none — the floor sat quiet" when they don't — computed from the SAME day orders the Z already counts (no unverified claims; the bin's block contract untouched).
- **Verified live against DB hand math** (qa122-floor-day.mjs / qa122-floor-day2.mjs, computed BEFORE rendering, tenant-scoped like the app): today (3 Oct) → the honest quiet strip (the day's only table round belongs to the OTHER tenant and RLS correctly hides it); Fri 2 Oct → "The floor served 12 rounds | ₹4,174.80 | busiest: T1 · 8 rounds · ₹3,019.80" — row-for-row exact in the DOM, no-shows silently absent (the book had none that day). The 5.82 drill also verified: a live hold (T2 · #96) opens a drill with NO alarm — the verdict strip only speaks when the ledger disproves a hold.
- Census untouched at 54 · 30 · 56 · 3 (ZERO writes this round — the fix is pure IST arithmetic; the strip is read-only).

## [5.82.0] — 2026-10-03 — The floor owns its holds

### Added — stale-hold honesty: the board now proves every hold against the ledger

- **The gap**: migration 011's `sp_sync_table_on_order` trigger releases a table when its ticket COMPLETES or CANCELS — but a ticket that was hard-DELETED never fires that UPDATE, so the hold outlives its own order: the board kept saying "Occupied · Ask for the bill" for a table whose ticket no longer existed (T1's `active_order_id` resolved to nothing — a ghost pointer, live on the board this round). The floor claimed a full house — "6/6 seats busy" — while 4 of those seats were held by a lie. The staff can always Free a table manually; nothing ever TOLD them the hold was stale.
- **The hold audit** (Floor screen): every occupied/billing table's `active_order_id` is judged against the ledger — a hit in the board's latest-100 window is classified directly; a miss gets ONE targeted `fetchOrderById` read (new in api.ts, riding the same `attachItems` bridge so the audit judges a complete Order). Verdicts: **live** (new/pending/preparing/ready — the hold is real), **settled** (completed + paid — "The bill was paid — the table never let go."), **closed-unpaid** (completed, money pending — "Ticket closed, money still pending — settle, then free."), **ghost** (ticket gone or cancelled — "The ticket behind this hold is gone — the table never let go.").
- **The alarm strip** on the card, in the 5.80 pulled-alarm grammar (#FDF3F2/#B4483C, inset ring #F0D5D1, CircleAlert): same sentence in the strip, the hover title, and the aria label — a screen reader hears exactly what the sighted owner reads. The header grows a red honesty chip ("· 1 stale hold") naming the count. On ghost/settled cards the Free button is promoted to solid red with the honest tooltip "Nothing left to settle — the table can go." and aria "Free table T1 — stale hold"; on closed-unpaid it deliberately stays standard — settle first.
- **Never invents an alarm**: a pointer-less manual seat is the staff's choice (the board's own Seat action writes occupied without a ticket) — audited as honest silence, not a lie; a read still in flight proves nothing; a FAILED read stays silent. The board never claims a hold is stale without proof.
- **Wiring**: zero migration, zero automatic writes — the audit reads (one bounded targeted read per unproven pointer, deduped and idempotent) and the EXISTING Free button remains the only way home. The 011 trigger stays the lifecycle's writer; the board just refuses to echo it blindly.
- **Verified live end-to-end**: T1 (ghost `active_order_id` d00a805e…, deleted in an early QA cleanup) lit the alarm + header chip on a fresh load (screenshot qa121-floor-stale) → Free → "Confirm free?" → board healed to "2/6 seats busy · AVAILABLE 1", chip and alarm gone (screenshot qa121-floor-healed) → DB verified `T1: status=available, active_order_id=null`. T2 (genuinely holding live #96 new/pending) stayed quiet throughout — the audit separates real holds from ghosts. Census untouched at 54 · 30 · 56 · 3 (zero order/payment writes; the one dining_tables UPDATE is the UI's own healing path).
- **Console honesty**: two bounded pre-marker HMR artifacts (117's documented `pickDefaultVariant` transient; this round's deps-array 5→6 boundary warning from adding tenantId mid-edit — a comparison that cannot exist on a fresh load). Zero errors after QA121-FINAL-MARKER on fresh loads of /floor + four surfaces.

## [5.81.0] — 2026-10-03 — The shelf's answer

### Added — prep coverage of the counter's shortlist: how many more the shelf can make

- **The gap**: the movers trilogy closed every door except the stockroom's. The ledger proves the room's favourites (computeTopMovers), the counter sells them one tap deep (5.78's rail), the menu protects them from casual 86-ing (5.80's medallions) — but nothing answered the stockroom's question: **how many more Flat Whites can this shelf actually make before the rush finds an empty shelf?** Burn-rate speaks per-SKU history; the rush speaks per-DISH demand. The bridge between them is the recipe.
- **THE SHELF'S ANSWER** (Inventory, stock tab, above the shelf list): for each of the week's top movers, how many more the shelf can make — computed per recipe line as floor(stock ÷ qty_per_serve), the **thinnest SKU decides**, and the row names it ("~236 more · thinnest: Coffee beans (g)") beside the week's honest units + tickets. Rank medallions carry the 5.80 grammar (No.1 solid gold), so the same list is readable on every surface it lands.
- **Honest tones, honest edges**: green at ≥5 serves, amber below five ("restock before the rush"), red at zero — "can't make another — {SKU} is out". A dish with no recipe says "no recipe on file — the shelf can't answer"; a recipe naming a SKU that left the shelf says "coverage unknown"; a dish that left the live menu drops off the list. Invalid per-serve lines are data noise — skipped, never a fake zero. A quiet week renders no section at all.
- **Wiring**: zero migration, ZERO new fetches beyond the movers read — the screen already held recipe_lines and inventory_items; the coverage memo rides the screen's own reload rhythm (realtime + 30s poll) so the answer tracks every hand move live. The movers come from the same `fetchPaidMoverLines` + `computeTopMovers` one-definition pair — no forked math anywhere.
- **Verified live against DB hand math** (`qa120-shelf-answer.mjs`, computed BEFORE rendering — and the script itself needed the 117 lesson re-taught: its first draft dropped the rupees tie-break and put Muffin ahead of Sandwich; fixed to mirror the one definition): No.1 Flat White ~236 more · Coffee beans (g) · 36 sold; No.2 Veg Grilled Sandwich ~83 · Cheese (g); No.3 Blueberry Muffin ~58 · Flour (g) — row-for-row exact in the DOM.
- **The alarm exercised end-to-end through the UI**: the Coffee beans shelf taken to zero via the waste modal, reason **Correction** (bin-safe — 5.77 counts only spoilage/spillage/damage; verified the ₹108 bill stayed ₹108 · 2 moves) → the FW row turned red "can't make another — Coffee beans is out" (screenshot qa120-shelf-alarm) → restocked to exactly 4,720 g through the restock modal → the row returned green "~236 more" (a number that can only come from 4,720 ÷ 20/serve — the DB-verified stock). Two honest diary rows remain; orders/payments untouched at 54 · 30. (A publishable-key script path to sp_adjust_stock returns NOT_A_MEMBER — the RPC is app-session-gated; the UI write path works, which is the path that matters.)

## [5.80.0] — 2026-10-03 — The menu knows its movers

### Added — the week's rank medallions on the management side of the menu

- **The gap**: 5.78's shortlist tells the COUNTER what the room keeps ordering, but the owner managing the menu never sees the ledger's verdict at the surface where dishes live and die — it is entirely possible to casually mark the room's No.1 sold out for a morning and never be told. The rail sells the movers; nothing PROTECTED them.
- **No.N medallions on menu cards** (Menu screen, beside each dish name): every card whose dish sits in the week's top paid movers wears its rank — rank 1 solid gold with the trophy, ranks 2–5 in the rail's tinted gold. The tooltip carries the ledger's own numbers: "No.1 this week — 36 sold across 25 paid tickets. The counter's rail pins this dish." A header legend states the grammar once, in the house gold.
- **The pulled alarm**: a top mover marked Available OFF turns the medallion RED — "No.3 · pulled" — with the honest warning in the tooltip ("the room's No.3 this week (1 sold across 1 ticket) is SOLD OUT — bring it back before the rush finds out") and in the aria-label. Management now reads the cost of an 86 the moment it happens, exactly where the toggle lives. No confirm dialogs were added — the alarm is information, not friction.
- **Wiring**: zero migration, zero writes — the SAME `fetchPaidMoverLines` + `computeTopMovers` one-definition pair the rail speaks (no forked math anywhere), loaded fail-soft (null = unread, [] = quiet week — no medallions invented, the menu never waits on the ledger), reloading with the menu's own tick so a refresh never shows stale ranks.
- **Verified live against DB hand math** (`qa119-menu-movers.mjs`, computed BEFORE rendering): No.1 Flat White — 36 units · 25 tickets · ₹8030.00, No.2 Veg Grilled Sandwich — 1 · 1 · ₹260.00, No.3 Blueberry Muffin — 1 · 1 · ₹180.00 — row-for-row exact in the DOM, legend present. Pulled round-trip exercised live: muffin toggle OFF → "No.3 · pulled | SOLD OUT" (screenshot qa119-menu-pulled) → toggle ON → medallion restored, DB verified `is_available: true`. Census untouched at 54 · 30 (zero order/payment/feedback writes; the one availability flip returned home).

## [5.79.0] — 2026-10-03 — The close sees the bin

### Added — the day's waste lands in the Close-out ritual and on the printed Z-report

- **The gap**: 5.77 gave the owner the bin's bill in Reports, but the daily ritual never breathed it — Close-out states what the shelf BURNED for live tickets (ingredient cost) and stays silent about what the shelf THREW AWAY. An owner closing the day at the counter reads the Z and never learns the bin ate ₹108 of stock that morning. Shrinkage stayed a Reports answer, not a close-out answer.
- **THE BIN strip** (Close-out, inside the cost & margin band, spanning all four columns): the day's waste in rupees — spoilage / spillage / damage only, valued at each SKU's cost on file, the exact 5.77 honesty (a move with no cost on file is UNVALUED and said so; deliveries and corrections never fed the bin). Red-tinted well with the bin icon, a moves chip, the heaviest SKU of the day (name · qty unit · rupees), and the exclusions whispered at the end. An honest zero renders grey: "The bin took nothing today — the shelf's honest day."
- **THE BIN on the printed Z**: the thermal Z-report grows its own THE BIN · WASTE block after COST & MARGIN — waste rupees + move count, heaviest line — so the taped-to-the-register copy of the day carries shrinkage the same breath as margin. `undefined` keeps the block off entirely: the Z never claims an honest zero it didn't verify. The per-ticket CSV keeps its contract untouched (waste is not per-ticket).
- **Wiring**: zero migration, zero writes — `fetchWasteMoves` (5.77's read, reused as-is) filtered to the IST day window client-side, loaded FAIL-SOFT exactly like the section mix (waste can never take the day's money view down), recomputing with the same tick as every other band (day navigation, the 20s today-refresh). The wasteDay memo mirrors 5.77's aggregation: |qty| × cost_per_unit, deterministic heaviest tie-break, unvalued counted and labelled.
- **Verified live against hand math**: today (Sat 3 Oct) → "The bin took ₹108.00 · 2 moves · heaviest: Coffee beans — 60 g · ₹108.00" (10g spoilage + 50g spillage × ₹1.8/g — matching Reports' bin's bill to the paisa, screenshot qa118-eod-bin); navigated to Thu 1 Oct (empty day) → the grey honest-zero strip; the Today button returns and the ₹108 strip restores. The strip speaks the same numbers as the Reports well on every day of the ledger.

## [5.78.0] — 2026-10-03 — The counter's shortlist

### Added — the week's movers, one tap each: a rush rail above the counter's categories

- **The gap**: every order at the counter is three depths deep — category → item card → modal. During a rush, the café's top sellers (the very dishes the ledger proves the room keeps ordering) hide behind the same taps as everything else. The regular's usual (5.74) names what ONE guest keeps ordering; nothing named what the ROOM keeps ordering at the speed a rush demands.
- **THE COUNTER'S SHORTLIST** (Food & Drinks, above the counter gate): an amber well — the house well grammar (#FDF9F0 on #EAD9BE, gold #B88E2F family, Zap header) — pinning up to 5 chips: the week's movers by PAID tickets, last 7 days. Each chip carries a rank medallion (rank 1 wears solid gold), the dish name, its honest units + ticket counts in tabular numerals, and TODAY's card price in gold. One tap = the dish joins the cart, straight, at the card price; the toast confirms it in the modal's own grammar.
- **The counter never silently upsizes a guest**: the chip rides the dish as the card prints it — the base price, no size inferred (the exact rule that sends the usual's variant-bearing dish to the modal instead of guessing a size; the first draft picked "cheapest variant" and a Flat White with only a "Large +₹50" variant on file came out ₹270 — caught in QA, cut to base). A size stays a conscious modal pick.
- **Paid truth, one definition two floors**: `computeTopMovers` (src/lib/movers.ts — the store-wide sibling of the usual) groups paid lines with the same deterministic tie-breaks (units → tickets → rupees → name), so two reloads can never disagree; `fetchPaidMoverLines` filters `orders` at the DB level (status ≠ cancelled, payment completed, created ≥ 7 days ago) — the DB-level mirror of `isPaidTicket`. Cancelled tickets' lines never reach the rail (verified: the Fries and #125 lines stay home).
- **Honest edges everywhere**: movers whose dish left the live menu are dropped (the rail pins only what the counter can sell); a sold-out mover's chip dims, wears the SOLD OUT tag, and its tap is the way back (v5.57.0 grammar — it opens the item where the put-back toggle lives, order-building stays blocked); a quiet week renders NO rail at all (no paid sales ⇒ no shortlist, never a lie); a failed read leaves the menu bare — the shortlist is an option surface, never a gate.
- **Wiring**: one new read (`fetchPaidMoverLines` — flattened like `fetchWasteMoves` so the ledger shape never leaks) into the screen's existing fail-soft pattern, reloading with the same tick the menu reloads (availability flips keep it honest). Zero migration, zero writes, no new screens.
- **Verified live against DB hand math**: Flat White ×36 · 25 tickets · ₹220.00 · rank 1 (solid gold), Veg Grilled Sandwich ×1 · ₹260.00, Blueberry Muffin ×1 · ₹180.00 — chip-for-chip exact vs `qa117-movers.mjs`; tap E2E: chip → toast "1× Flat White added to order" → pill "Review order, 1 item, ₹220.00" → cart emptied via the UI (ZERO cloud writes this round; census untouched at 54 · 30). Sold-out round-trip exercised live: pull via the modal → chip dims + tags + honest aria-label → chip tap opens the modal → put back → chip restored (DB verified back at `is_available: true`). Screenshots: qa117-shortlist-rail.png.

## [5.77.0] — 2026-10-03 — The bin's bill

### Added — Reports names what the shelf threw away: the waste side of the 027 diary, aggregated into a rupee bill

- **The gap**: waste has a WRITE surface since 5.36 (the Inventory waste modal through 027's guarded RPC) and a per-item FEED (the stock diary), but no aggregate answer. The owner could log spoilage forever and never see what the bin actually cost — shrinkage stayed a feeling instead of a number, even though every rupee of it was already in the ledger with a reason and a SKU.
- **THE BIN'S BILL** (Reports, between Kitchen speed and Guest satisfaction): the waste side of `stock_adjustments` — spoilage / spillage / damage only — valued at each SKU's cost on file, in one bill for the selected range (Today / 7 / 30 days / All, same IST windows as every other well). The big number reads binned rupees; beside it the bin's split by reason with colored share bars (spoilage amber #C9950A, spillage blue #3B5BA5, damage red #B3261E — the house status-rail palette); below, the heaviest SKUs ranked by what they cost the bin, each carrying its quantity + unit, move count, latest diary note as a quote, and its last-binned IST timestamp.
- **Honesty rules carried**: corrections never land here (they reconcile the shelf, they didn't feed the bin); deliveries are stock IN, not waste; a SKU with no cost on file is counted as UNVALUED and said so plainly ("counted as nothing rather than guessed") — the same honesty the earner's list gives unpriced dishes. The footer names the exclusions and points back at Inventory for the write side.
- **Wiring**: one new read — `fetchWasteMoves` (stock_adjustments embed-joined to inventory_items name/unit/cost_per_unit, `!inner` so orphan rows can't ghost) — riding the existing fail-soft sidecar Promise.all; the wasteAgg memo re-filters per range like every other section. Zero migration, zero writes, no new screens. PostgREST returns the many-to-one embed as an object while the SDK types insist on an array — normalized defensively at the fetch boundary.
- **Verified live against hand math**: Coffee beans — 10g spoilage × ₹1.8/g = ₹18.00, 50g spillage × ₹1.8/g = ₹90.00 → the bill reads ₹108.00 binned, Spoilage ₹18.00 / Spillage ₹90.00 / Damage ₹0.00, Coffee beans "60 g · 2 moves · ₹108.00 · last binned 3 Oct, 3:35 am" (screenshot qa116-bins-bill). Range switching recomputes consistently; console clean under the marker protocol. This round wrote ZERO data — the section is read-only.

## [5.76.0] — 2026-10-03 — The counter's voice

### Added — the counter can finally speak to the kitchen: per-line and ticket-level kitchen notes, end to end

- **The gap**: the ledger has carried kitchen notes since migration 001 — `order_items.notes` (KDS prints it as an orange italic ↳ whisper, the printed receipt as a bullet) and `orders.notes` (the board's grey chip) — but only the guest door ever wrote them. The counter was mute: a cashier keying "less spicy" or "no onion" had nowhere to put it. This release gives the counter its voice with zero migration and zero API change (`NewOrderInput` already accepted both fields; the insert already wrote them).
- **The line's word** (review drawer): every cart line grows a ghost note button beside the steppers — grey when silent, amber-tinted when the line carries a word. It opens an inline house input (Save button, Enter commits, Escape cancels, 120 chars); the committed note shows exactly where the kitchen will read it: the SAME orange `↳` italic whisper the board prints, so what the cashier types is byte-for-byte what the kitchen sees. Merging lines keeps the earlier note; a fresh line starts silent.
- **The ticket's word** (review drawer, after the CRM fields): a "Kitchen note · the board reads it first" textarea (240 chars) that rides FIRST in the order's context string — before `Table:` / `Guests:` — so the board's chip leads with what the guest actually asked for. Both notes are trimmed at the store boundary; whitespace is not a note.
- **Wiring**: `cart.ts` grows `CartLine.note` + `kitchenNote` state with `setLineNote` / `setKitchenNote` (both normalizing), `clear()` resets both, and `placeOrder` passes `notes` per line and per ticket. Repeat-a-usual and START THEIR USUAL paths untouched (they add through the same store; notes stay optional).
- **E2E verified live**: Flat White + line note "oat milk, extra hot" + ticket note "birthday candle with the muffin — window table" → order #125 placed → `orders.notes` = "birthday candle with the muffin — window table · Guests: 2" and `order_items.notes` = "oat milk, extra hot" verified in the DB → after an engine advance to `pending`, the KDS board rendered BOTH in realtime (#125 card: the ↳ whisper under the line, the chip under the card) — screenshots qa115-notes-drawer / qa115-kds-notes. Totals untouched by notes (₹220 + GST = ₹231).
- Cleanup: #125 cancelled via the authenticated engine RPC (payments 0, feedback 0); census 53 → 54 (one more honest cancelled row).

## [5.75.0] — 2026-10-03 — The dish's true price

### Added — the Menu card now states what each dish costs the kitchen and what it keeps, where prices are set

- **The dish's true price** (Menu cards): beside the billing price, each card now reads the 018 recipe view (the same truth Reports' earner's list speaks) and states "costs ₹X · keeps ₹Y (Z%)" — with the kept-% banded (≥50% green, ≥25% amber, <25% red, priced-under-cost included). A dish without a recipe says "no recipe yet" (grey, pointing at Inventory → Recipes) instead of pretending its cost is zero. Options change the bill, not the cost — stated on the title.
- **Bug fix (Inventory recipe editor)**: the screen's 30s poll + realtime subscription handed `recipes` a new array identity per refresh, and the editor's load effect clobbered the draft mid-edit — an operator's unsaved lines could silently vanish whenever a background refresh landed. Dirty edits now survive background refreshes (guarded by dirty-item refs); they still yield to an explicit item switch, Discard, or Save.
- **Drift-chip data round (live verification of 5.72/5.73's unreachable branches)**: "Truffle Parmesan Fries" (₹340) was created via the real Menu UI, priced by a real recipe (200g Cheese + 60g Butter + 100g Flour = ₹300/serve → kept ₹40, 12%), and ordered for real (#124, takeaway, ₹357). The earner's list lit its amber divergence chip — "sells above its earn" (sells #2, earns #4) — and the menu's quadrants rebased live: the split moved to 4 dishes · 11.5 units · ₹140.17 kept per unit, Blueberry Muffin migrated Dog → Puzzles, and Fries landed in Dogs (₹40/unit). All captured before cleanup.
- Cleanup: #124 cancelled via the authenticated engine RPC (payments 0, feedback 0); census 52 → 53 (one honest cancelled row). The Fries item + recipe STAY on the menu — a plausible dish, priced and documented, for the owner to keep or delete; cancelled orders do not count in Reports, so the baseline reads exactly as before (3 priced dishes · 15.0 units · ₹173.56).
- Zero migration; the Menu card joins one existing read (`fetchItemUnitCosts`) into the screen's existing load.

## [5.74.0] — 2026-10-03 — The regular's usual

### Added — the guest drawer now names the dish the guest's own paid ledger keeps ordering — and starts it into today's order, one tap

- **THE USUAL** (guest 360 drawer, between the ledger stats and the tickets): the guest's most-ordered dish across their PAID tickets — the exact paid truth `v_customer_stats` speaks (status ≠ cancelled AND payment completed) — with its units ("2× Flat White"), the ticket count that names it, its rupees in ledger LINE space ("₹440.00 of everything they've rung"), and a gold share meter in line-space so order-level discounts can never push it over 100%. Guests with tickets but no paid ones get the honest line ("a usual is named by paid tickets only"); empty phones get "their first paid ticket will name it".
- **START THEIR USUAL**: one gold tap rides the habit's latest expression into the live cart — the habit's own size (the last line's qty), at the last price and extras the ledger froze (the same v5.56.0 extras arithmetic the repeat action speaks), with the guest's identity pre-filled and the cashier landed on Food & Drinks. A usual whose dish was de-listed keeps its name (ledger truth) but says "off the menu now" instead of pretending.
- **ONE ledger truth** (`src/lib/usual.ts`): the usual's definition — paid truth, 50-ticket window, deterministic tie-breaks (units → distinct tickets → rupees → name) — is now a shared module. The counter cart's 5.62.0 "Usually …" chip now speaks the SAME definition it spoke differently before (it tallied only the last 8 tickets, counted unpaid ones, and broke ties by ledger accident); chip, well and ledger can no longer disagree about a regular's habit.
- Drawer fetch widened 8 → 50 tickets for the usual's window; the recent-tickets list still shows the same 8 rows. Zero migration, zero new fetch surfaces.
- **[Styling]**: every ticket row in the drawer carries a 3px left rail in its own status color (completed green / cancelled red / ready blue / pending amber) so the stack scans by state before it is read; tabular numerals across the stats band, ticket numbers and totals.

## [5.73.0] — 2026-10-03 — The menu's quadrants

### Added — classic menu engineering finishes the margin frame: the priced menu split at its own averages into Stars / Plowhorses / Puzzles / Dogs

- **THE MENU'S QUADRANTS** (Top items card, beneath the earner's list): each recipe-priced dish is classified by popularity (units vs the menu's average units) × richness (per-unit contribution margin vs the menu's average) — **Stars** (popular and rich — protect them, gold), **Puzzles** (rich but rarely ordered — push them, teal), **Plowhorses** (popular but thin — re-price or re-recipe, amber), **Dogs** (neither — review their place, grey). Each quadrant cell speaks its verdict and lists its dishes with units + kept-per-unit; empty cells say "none this window" instead of vanishing. The split basis is stated on the surface ("3 priced dishes split at the menu average — 15.0 units · ₹173.56 kept per unit sold").
- Relative by nature: the matrix needs ≥2 priced dishes before a split means anything — below that it stays silent rather than classifying against itself.
- **CSV**: item ranking export grows the `Quadrant` column (blank where honest absence).
- Zero new fetches, zero migration — the quadrants ride the same topItems/unitCosts join 5.9.0 and 5.72.0 already pay for.

## [5.72.0] — 2026-10-03 — The earner's list

### Added — Reports Top items gains the margin board: the same dishes ranked by what they KEEP, each row naming its divergence from the sales board

- **THE EARNER'S LIST** (Top items card, own well): `marginRank` sorts recipe-priced dishes by margin (revenue − ingredient cost); each row carries a relative margin meter in the gold money family, the kept ₹ + margin %, and the rank couplet "sells #S · earns #E". When the ranks diverge the row speaks: "earns above its bill" (a quiet earner worth pushing, green) vs "sells above its earn" (popular but thin — review price or recipe, amber). Top 5 on screen, the rest in the CSV.
- **Honesty fix**: dishes without recipe pricing no longer claim a fake 100% margin — their Top-items chip now reads "unpriced" (grey, with a pointer at Inventory recipe lines), and they sit out of the earner's list, counted in the subtitle ("N unpriced sit out — no honest cost on file"). All-unpriced ranges get the honest empty line.
- **CSV**: item ranking export grows `Sells rank` + `Earns rank` columns (unpriced rows say so).
- Best-seller ≠ best-earner was already computable (unitCosts joined in 5.9.0) but never surfaced — now the owner can see which dishes earn their keep, not just which ring the loudest.

## [5.71.0] — 2026-10-03 — The offer's scorecard

### Added — Offers answer for themselves off the 016 redemption ledger (two bounded reads, no migration)

- **Offer scorecard** section in Reports: every offer on the books — active or paused, ridden or silent — states its discount voice chip, tickets rode, "brought ₹X · cost ₹Y", and last-ride IST time; silent offers speak honest zeros ("silent in this window — no ticket rode it") instead of vanishing. Gold whisper totals the season; the subtitle states the attribution limit honestly (revenue rode IN WITH the offer — the counter can't prove the counterfactual). CSV export (Offer / State / Discount / Tickets / Brought / Cost / Last rode). Empty state points at the source (Guests → Offers).
- `fetchOfferRedemptions` joins `offer_redemptions` to its offer + ticket (paise-exact discount, order total, offer state); `offerAgg` merges the ledger with the offer list so dead offers stay visible.
- Verified end-to-end: a flat-₹30 offer applied to a real ₹180 takeaway produced OFFER −₹30.00 / GST ₹7.50 / Total ₹157.50 paise-exact, trigger-bumped `usage_count`, and a live scorecard row — then cleaned back to the seeded baseline.

## [5.70.0] — 2026-10-03 — The recover list

### Added — Guest satisfaction names the callback: every ≤3-star rating becomes a named, door-equipped row (no migration, one widened select)
- The satisfaction block could average the season (4.3 / 5) and quote the newest comments — but it could not answer the owner's next question: **WHO do I call back?** The ≤2-star ratings already ring the bell (030's trigger); the three-star "meh" never made a sound anywhere, and even the bell says only "2★ from a guest" — no ticket, no name, no comment. Now the Guest satisfaction section grows **THE RECOVER LIST**: every rating ≤ 3 in the window, newest first, each row wearing its red star run (#B3261E stars on the #FBFBF9 well — the red voice reserved for what's broken), the guest's own words (or the honest "no comment — the stars said it"), the ticket number, the IST time, and the identity the ticket carried — "Rhea Kapoor · 9810002020", or "anonymous ticket — no guest on file" when the counter never took a phone.
- **The row opens the relationship**: each row carries a "Find guest" door (the house chip grammar, ArrowRight) into the CRM — the same auto-booked guest the drawer promised; the aria speaks the workflow, not the widget ("Open Guests — find Rhea Kapoor and make it right"). The data rides one widened select: `fetchFeedbackRows` now joins the ticket's `customer_name`/`customer_phone` — no new request, no migration; the ≤3 filter runs client-side on the rows the report already held (newest first, 8 on screen, the tail honest: "+ N more in the CSV export").
- **The happy window speaks once, quietly**: when the range holds ratings but none ≤ 3, a single calm line replaces the list — "no low stars in this window — nothing to recover" (#2E7D32, CheckCircle2) — honest absence said in green, not silence. When the range holds no ratings at all, the block's existing empty state stands unchanged.
- **[Styling]**: the recover row mirrors the quote row's geometry (left-border card, truncate guards, tabular times) but inverts the voice — red border + red stars where quotes wear gold; the section subtitle states its rule on the surface ("every rating ≤ 3 · newest first") so the threshold is never a mystery. The ratings CSV grows a second block — Submitted / Order # / Rating / Guest / Phone / Comment — complete beyond the 8-row screen cap.
- E2E (real UI, full loop, every hop honest): baseline showed the green "no low stars" line (4.3 / 5, no ≤3 in window) → takeaway **#121** placed via the real drawer WITH the guest attached (Rhea Kapoor · 9810002020 → "books the guest in CRM") → gate Ok → Bills charged cash ₹231.00 (payment completed) → Kitchen: Mark ready → **Complete** (status completed — the served path) → the guest's own phone moment: `/track/<id>` → tapped 2 stars + "Coffee was lukewarm today" → "You rated this order 2 out of 5 stars" → DB truth: feedback row (rating 2, for #121) AND the 030 bell rang "Low rating: 2★ from a guest" unread → Reports: **THE RECOVER LIST** live — #121 · 2 red stars · the comment · "Rhea Kapoor · 9810002020" · Find guest door (qa109-recover-list.png) → door click landed on Guests (qa109-recover-door-guests.png) → qa109-cleanup 121 (feedback + bell + auto-booked guest + payments deleted, guarded flip, restore-preparing then advance-cancelled — clean: YES) → Reports reverted EXACTLY to the green "no low stars" line. Census: orders 49 (one honest cancelled row #121), payments 30 = pre-round. 14/14 screens re-verified post-feature, tsc 0, console clean after markers.

## [5.69.0] — 2026-10-03 — The dish's own clock

### Added — Kitchen speed's slow-dish rows read the check-clock: fire → last ticked line (no migration, no API change, no new fetches)
- 5.68.0's dish block borrowed the TICKET's span — every dish on a timed ticket inherited the same fire→ready number, so a ticket with three dishes waited for its slowest one and told all three the same story. The finer clock was already on file: 029's `order_items.checked_at` (v5.39.0 "fire as you go") stamps each line the kitchen ticks done, and it already rides every `fetchOrders` payload. Now THE SLOW DISH rows that have it speak it: **own clock · avg 4m 12s · 2 ticked tickets** — fire → the dish's last ticked line, one opinion per dish per timed ticket, strictly comparable to the ticket-donated span that stays beside it.
- **Honest clocks, house rules**: a dish contributes an own-clock sample only when EVERY line of that dish on the ticket was ticked (a half-ticked dish hasn't fully passed — the clock never half-speaks); a check that precedes the fire is skipped (a pre-fire tick would wind the clock backwards — never negative); only tickets already in the timed sample contribute, so the block's common denominator stays "tickets with a complete story" and mid-flight dishes stay on the KDS's clock; a dish with no ticks on file (e.g. a legacy ticket from before 029) simply has no own-clock line — honest absence, never invented. The row's red-over-SLA tone applies to the OWN average independently — a dish can be late even inside a fast ticket.
- **[Styling]**: the own-clock line sits under the row's "slowest ticket span" in the teal clock voice (#0F3D3E, Timer icon; #B3261E + "over SLA" when its own average breaches), truncate-guarded, with a title that explains the distinction ("the ticket waits for its slowest dish, the check-clock lets the early ones speak"); when any row in the window carries a clock, a quiet legend line appears under the block header — "rows with 'own clock' read fire → the dish's last ticked line — finer than the ticket's span" — and disappears when none do. CSV's item block grows three columns: Own-clock average / Own-clock slowest / Own-clock tickets (empty when a dish has none).
- **Also staged this round**: migration `038_guest_birthdays.sql` + `scripts/apply-038.mjs` (the CRM's birthday column, `customers.birthday_md` 'MM-DD' + CHECK) — schema READY but not applied: the round had no raw DB password in-shell (owner one-command unblock: `SUPABASE_DB_PASSWORD=… node scripts/apply-038.mjs`); the capture UI + Dashboard celebration slot land next round once the column exists.
- E2E (real UI, full arc, seconds-true): baseline #55's "Flat White · Large" row carried NO own-clock (pre-029 ticket, unticked — honest absence) → two-dish takeaway #120 (Flat White + Blueberry Muffin ₹400 via real drawer → Takeaway → Place → gate Ok → Start preparing → ticked Flat White, held ~12 s, ticked Blueberry Muffin → Mark ready) → DB truth (qa108-truth): Flat White checked ~12 s after fire, Muffin ~24 s after fire → Reports: Flat White row grew **own clock · avg 0m 12s · 1 ticked ticket**, Muffin row **own clock · avg 0m 24s** — two different clocks inside ONE ticket, the exact lie 5.68's borrowed span told — while Flat White · Large (#55) stayed own-clock-free (qa108-own-clock.png) → qa106-cleanup 120 (restore-preparing + advance-cancelled; clean: YES) → Reports reverted EXACTLY to the #55-only baseline. Census: orders 48 (one honest cancelled row), payments 30 = pre-round. 14/14 screens re-verified post-feature, tsc 0, console clean after markers.

## [5.68.0] — 2026-10-03 — The slow dish

### Added — Kitchen speed names the dish: per-item fire-to-pass breakdown (no migration, no API change, no new fetches)
- 5.67.0's clock could say the kitchen averaged 38 minutes — but not WHAT was slow. Now it can: every timed ticket donates its fire→ready span to each dish on it, and the section grows **THE SLOW DISH** block — dishes ranked slowest-average-first, the leader wearing an honest chip ("the pass waits for this", red when its average sits over the 10-minute SLA, green when inside), each row showing tickets timed, average, slowest ticket span, and a relative bar in the family meter grammar (teal #0F3D3E fill; red #B3261E when over the SLA line).
- **Honest aggregation, not double-counting**: one sample per DISH per ticket — a ×2 line is one opinion, not two; variants key separately (`Flat White · Large` vs `Flat White` — a Large may genuinely take longer, and conflating them would lie to both); the dish ledger rides the same timed-ticket set, so cancelled tickets and untimed (still-cooking) tickets donate nothing. Zero new reads: the dishes come from the `order_items` already attached to `fetchOrders` — the pass names its slow dish from data the report already held.
- **[Styling]**: the block sits in its own #FBFBF9 well (the house card grammar), header carries the UtensilsCrossed mark + "fire → pass, per timed ticket the dish rode on" so the metric's meaning is never in doubt; truncate guards on long dish names; rows share the aria meter pattern ("…average fire-to-ready span, relative to the slowest dish"); "+ N more in the CSV export" beyond five. CSV grows the items block: Item / Tickets timed / Average / Slowest ticket span.
- E2E (real UI, full arc, seconds-true): BEFORE showed #55's dish — "Flat White · Large" (1h 16m, the chip red over-SLA) → two-dish takeaway #119 (Flat White + Blueberry Muffin, ₹400, real drawer → Takeaway → Place → gate Ok → Start preparing → held 25 s → Mark ready; DB truth: fired 05:45:44 → ready 05:46:14 = 0.5 min) → Reports: 2 tickets timed · avg 38m 31s · median 0m 30s, dish block ranked **Flat White · Large (1h 16m, chip) → Blueberry Muffin (0m 30s) → Flat White (0m 30s)** — variant keyed separately, exactly as designed (qa107-slow-dish.png) → qa106-cleanup 119 (restore-preparing + advance-cancelled path, clean: YES) → Reports reverted EXACTLY to the #55-only baseline, dish block back to one dish. Census: orders 47 (one honest cancelled row #119), payments 30 = pre-round. 14/14 screens re-verified post-feature, tsc 0, console clean after markers.

## [5.67.0] — 2026-10-03 — The kitchen keeps time

### Added — Reports' Kitchen speed section: prep-time truth off the status-hop ledger (no migration, no API change)
- A new question the owner couldn't ask before: **how fast was the kitchen, really?** The answer was already on file — 007's `order_status_history` has stamped every status hop (trigger-written, actor + timestamp) since the order engine shipped — nobody read it as a clock. Now Reports does: `fetchStatusHopsInRange` (api.ts) pulls the raw hops for the window (bounded, +6h tail so a ticket that fires just after midnight still lands, fail-soft like every sidecar), and a pure `kitchenSpeed` pass turns them into timings: **FIRED = the earliest hop into `preparing`** (the counter's Ok — retries can't inflate it), **READY = the earliest hop into `ready`** or, for takeaways that never sat on the pass, `completed`. Only tickets with BOTH endpoints are timed — a ticket still cooking has no finish line, and the clock never guesses. Cancelled tickets never enter; legacy tickets predating the trigger simply have no hops and are skipped, never invented.
- **The section speaks in the kitchen's own grammar**: four stat tiles — AVERAGE (seconds-true "6m 40s" voice, never a bare decimal), MEDIAN (the middle ticket, outliers can't drag it), SLOWEST (with its ticket number), OVER THE 10-MIN SLA (red when > 0 — the same 10-minute line the Dashboard's LATE PREP slot shouts about, now on the owner's report). Under them, a red breach-share meter (#B3261E on #FCEBEA) with an aria meter label, and the five slowest tickets listed slowest-first with fired → ready IST times and an `over SLA` chip on breaches.
- **[Styling] honest statistics, spoken quietly**: when the sample is under three tickets the card whispers in the money voice's gold ("small sample — the clock needs more timed tickets before it says anything loud", Clock icon, #8A6D1F) — a stopwatch with one reading shouldn't shout. Empty state is honest about the rule: "the clock times only tickets with both hops on the ledger". CSV export carries the summary (tickets timed, average, median, slowest, SLA count) plus one per-ticket row with IST fired/ready times and an `over`/`ok` verdict.
- E2E (real UI, full arc, seconds-true): Reports 7d BEFORE showed sample 1 — #55, the QA-era completed ticket (fired 2 Oct 5:45 pm → ready 7:01 pm = 1h 16m, honestly wearing `over SLA`); #48 (preparing, no finish line) correctly untimed → takeaway Flat White #118 via real drawer → counter gate Ok → Kitchen board: Start preparing → held 25 seconds → Mark ready → DB truth (qa106-truth 118): `pending>preparing` 05:34:45, `preparing>ready` 05:35:19 = **0.6 min** → Reports read **2 tickets timed · average 38m 33s · median 0m 33s (#118) · slowest #55 1h 16m · 1 over SLA** with the small-sample whisper live (qa106-kitchen-speed.png) → cleanup: `sp_advance_order` refused ready→cancelled (by design — a cooked ticket is real; the transition graph is one-way past ready), so qa106-cleanup restored the fixture with a guarded direct flip (member-managed RLS) then the RPC's own preparing→cancelled — clean: YES, ledger 0 rows → Reports reverted EXACTLY to the #55-only baseline. Census: orders 46 (one honest cancelled row #118), payments 30 = pre-round. TOOLING lesson banked: the advance-RPC guard is the design speaking — cleanup respects the transition graph instead of forcing through it. 14/14 screens re-verified post-feature, tsc 0, console clean after markers.

## [5.66.0] — 2026-10-03 — The Z reads the balance

### Changed — Close-out's money summary understands split tickets (no migration, no API change)
- The last money surface still telling the whole-ticket story: the EOD report's `unpaidAmt` summed whole-ticket totals for non-completed tickets, so a ticket mid-split (5.63.0) counted its FULL total as "still out" — while the same report's PAID figure (ledger rows) already knew the part had landed. Paid + unpaid did not reconcile against gross mid-split (₹115.50 + ₹231.00 = ₹346.50 ≠ ₹231.00 gross): the report double-counted the covered half against itself. Now the aggregates read the ledger: per-ticket ledger sums (`ledgerByOrder`, day-bounded like every EOD read), and an unpaid ticket's outstanding is `total − recorded parts` (floored at zero). Un-split tickets have no rows — identity arithmetic; PAID + UNPAID now reconcile against GROSS even mid-split.
- **PayChip reads the ledger too**: the day-ledger's payment chip grows an honest middle voice — a ticket with parts landed but balance open wears a gold `⇅ part` chip (#FFF8E6/#8A6D1F, title "Split in progress — ₹115.50 in, balance open") instead of the amber `due`; settled tickets keep their method chip, untouched tickets keep `due`, cancelled keep `—`.
- **[Styling] the family whisper reaches the Z**: the Unpaid StatCard grows a `whisper` slot — when the day holds split-open tickets it speaks the money voice (Split icon, #8A6D1F): "1 ticket settled in parts — the count reads balances", with the explanatory title. Absent when nothing is mid-split; no other card touched. The right-now strip ("UNPAID RIGHT NOW · 1 · ₹115.50") inherits the balance arithmetic automatically.
- **Printed Z-report says it too**: the UNPAID line annotates split-open days — `UNPAID ₹115.50 (1 tkt · 1 split parts in)` — so the accountant's paper copy carries the same honesty as the screen; the print's PAID/PAYMENTS sections already rode the ledger (per-part rows since the beginning).
- E2E (real UI, full arc, paise-exact): baseline today EOD `₹0.00 / 0 tickets due` → takeaway Flat White #117 (₹231, real drawer → As served → Takeaway → Place → counter gate Ok) → Bills → Charge customer → Split in 2 ("₹231.00 ÷ 2 · ₹115.50 each") → Cash part 1 → EOD read **PAID ₹115.50 / UNPAID ₹115.50** (paid + unpaid = gross ✓; pre-fix ₹346.50 ✗), right-now strip `1 · ₹115.50`, gold whisper live, day-ledger chip `part` (qa105-z-midsplit.png) → UPI covering part (DB truth: `completed`, method=upi, 2 ledger rows cash+upi ₹115.50 each) → EOD read **PAID ₹231.00 / UNPAID ₹0.00**, whisper gone, chip `upi` (qa105-z-settled.png) → guarded cleanup (qa102-cleanup 117: payments deleted, flip guarded on `completed`, advance cancelled — clean: YES) → EOD back to `₹0.00 / ₹0.00` baseline after reload. Census: orders 45 (one honest cancelled row), payments 32 → 30 after cleanup = pre-round. 14/14 screens re-verified post-feature, tsc 0, console clean after marker (the HMR-window `round2` lines bounded historically before the post-clean marker at line 1000 — zero errors after).

## [5.65.0] — 2026-10-03 — The band reads the balance

### Changed — Dashboard's "Needs you now" Unpaid slot understands split tickets (no migration, no API change)
- The parked asymmetry from 5.64.0 is closed: the Dashboard's money band still read whole-ticket totals for unpaid tickets, so a ticket mid-split (5.63.0) showed its FULL total as "still out" while the ledger knew half had already landed. Now NeedsNow reads the ledger: `fetchOpenPaymentSums` (the 5.63.0 helper, bounded to exactly the open ids — no ids, no call) joins the 30-second mirror refresh, and an unpaid ticket's outstanding is `total − recorded parts` (floored at zero, so an over-covered row can never inflate the count). Un-split tickets have no ledger rows — the arithmetic is identity for them; cancelled/settled tickets never enter the id list, so old rows can't leak in.
- **All three money surfaces now agree mid-split**: Bills says `₹115.50 in · ₹115.50 open`, Reports' unpaid bucket sums balances (5.64.0), and the Dashboard band shows the balance — one ledger, one truth, told three ways.
- **Honest voice + [styling]**: when a ticket is settled in parts, the Unpaid slot grows a gold whisper (Split icon, #8A6D1F — the money voice) — "1 ticket settled in parts — the band reads balances" — and the slot's aria speaks it too ("…, 1 ticket is settled in parts"). Zero-whisper when nothing is mid-split; the slot renders only when its count is real, exactly as before.
- E2E (real UI, full arc, paise-exact): baseline band `5 · ₹1,801.80` → takeaway Flat White #116 (₹231, real drawer → counter gate Ok) → Bills → Split in 2 → Cash part 1 (server truth: `pending`, 1 ledger row) → band read **`6 · ₹1,917.30`** (+₹115.50, the BALANCE — pre-fix it would have lied ₹2,048.70) with the gold whisper (qa104-band-midsplit.png) → UPI covering part (server truth: `completed`, method=upi, 2 ledger rows) → band read **`5 · ₹1,801.80`** exactly, whisper gone, #116 out of the unpaid set → guarded cleanup (ledger rows deleted, flip guarded on `completed`, advance cancelled) → band back to baseline. Census: orders 44 (one honest cancelled row), payments 30 = pre-round. Mid-split state survived a full dev-server restart + reload. 14/14 screens re-verified, tsc 0, console clean after the vite dev-server restart exorcised the known stale-graph `round2` phantom (last error line 368, restart boundaries 670/991 — zero errors after).

## [5.64.0] — 2026-10-03 — The mix reads the ledger

### Changed — Reports' payment mix understands split tickets (no migration, no API change)
- 5.63.0 let a ticket settle across several payments — and immediately left a lie downstream: Reports' "How money arrived" attributed a settled split's WHOLE total to whichever method covered the balance (a cash+UPI split reported as one UPI ticket). The ledger held the per-part truth; the mix didn't read it. Now it does: `fetchPaymentsInRange` pulls the ledger rows for the selected window, and the mix attributes each PART under the method that took it (a cash+UPI ₹231 split shows Cash ₹115.50 ×1 + UPI ₹115.50 ×1, not UPI ₹231 ×1).
- **Balance-based "money still out"**: the unpaid bucket now sums each open ticket's BALANCE (total − ledger parts), not its whole total — a half-paid ticket shows the half that's actually out. Pre-ledger legacy tickets (no ledger rows) keep the stored-method fallback, so old history never vanishes from the mix; the ledger read is fail-soft like every Reports sidecar.
- **Honest voice on the surface**: subtitle becomes "Settled money by method — each part under its own method"; when the window contains split tickets a gold whisper notes it ("1 ticket settled in parts — the mix reads each part, not the covering method", Split icon); the CSV header says Payments (the ×N now counts payment events), gains a "Split tickets — settled in parts" row, and renames the open row to "Unpaid — balance still out".
- Known asymmetry, parked: the Dashboard's money band still reads whole-ticket totals for unpaid tickets (fine while no part-paid ticket is open — both figures agree; they diverge only mid-split). E2E: real split ticket #115 (cash + UPI ₹115.50 each) → mix showed both parts under their own methods + the split whisper (qa103-paymix.png) → cleanup returned the mix to one-shot attribution; census restored.

## [5.63.0] — 2026-10-03 — The bill splits its ways

### Added — a live ticket can be settled across several payments (no migration, no API change)
- A table of three asks to split; a couple pays half cash, half UPI. Until now the settle panel recorded exactly ONE ledger row and flipped the ticket in the same breath — the payments ledger (007) already held one row per payment, but the client never asked for more than one. The ticket's own money story and the counter's split request were different shapes. Now the Bills settle panel grows **Settle in**: One payment · Split in 2 · Split in 3.
- **The ledger stays the truth; the ticket follows it.** A non-covering part writes one `payments` row via the member RLS path (`insertPartialPayment`) and the order stays honestly `pending`; the COVERING part rides the guarded `sp_record_payment`, which flips the ticket exactly once when the balance clears. Zero migration: 007's table was built for this, the client simply stopped assuming one row per ticket. The 008 double-payment guard still stands — a completed ticket refuses further money.
- **Paise-exact math, ledger-derived**: `paidSum`/`balance` are computed from the server's rows (never a client guess); part amounts round DOWN so the covering part absorbs the cents and the parts sum to exactly the total (₹440 in 3 → ₹146.66 + ₹146.67 + ₹146.67). Mid-split replanning is guarded: you can't plan fewer ways than parts already recorded (stranded options grey out).
- **Surfaces**: settle panel (ways segmented control + per-part CTA `Record part 2 · ₹220 · UPI`); ticket detail grows **The ledger** block (one gold-check row per part — method, amount, time, who recorded it — plus an amber "Open balance — part N settles it" strip while money is still out); the LIST card wears a gold `₹220 in · ₹220 open` badge (fed by one bounded `fetchOpenPaymentSums` read keyed to the unpaid column); the receipt prints one PAID line per part + SETTLED when a ticket carries 2+ rows; the CSV says `partial (220.00 of 440.00 in)` instead of a bare `pending` that hides money taken.
- **Styling**: money keeps the gold voice — ways control and method radio share the `#B88E2F`/`#F3E8CF` active fill; the ledger block sits on the `#FBFBF9` well with `#E3E7E0` hairline; open balance wears the amber attention family (`#FDF6E3`/`#8A5A00`); the Split icon marks every split-aware surface (ways label, ledger heading, list badge).
- Reports' by-method mix still attributes a settled split's total to the covering method (orders.payment_method is one column); the ledger holds the honest per-part truth. Ledger-aware pay-mix parked for a reports round.

## [5.62.0] — 2026-10-03 — The counter knows its regulars

### Added — the order drawer recognizes the guest while the cashier keys the phone (no migration, no API change)
- The CRM (016) and the ledger-derived regulars view (`v_customer_stats`) held everything the counter needed — visits, lifetime spend, last visit, per-guest ticket history — but the intelligence lived one navigation away, on the **Guests** tab. The drawer's phone field ("· books the guest in CRM") stayed silent while the cashier keyed a number the book already knew: no name, no history, no usual. The counter-speed family (5.54 repeat, 5.57 pull, 5.59 move, 5.60 seat & order) never covered identity — until now.
- **Recognition**: as the cashier keys a phone (≥6 digits, debounced 420ms), the drawer quietly reads `v_customer_stats` + the CRM and, when history exists, the guest's last 8 tickets. Three honest states:
  - **Regular guest** (orders placed ≥ 1): name + `N visits · ₹X lifetime · last seen today / yesterday / 2 Oct` — the book speaks in days, not timestamps.
  - **In the book** (CRM row, no settled history): name + "First order on this phone — the ledger will remember it" (the auto-enrich trigger keeps that promise).
  - **No match**: silence — recognition is a bonus, never a gate; any read failure stays silent and the ticket flows as if the book were empty.
- **Two one-tap actions ride existing paths**: "It's Maya Iyer — add name" fills the empty name field (never overwrites a typed one); "Add their usual — Flat White" drops the guest's most-ordered dish straight into the cart. The usual is computed client-side from non-cancelled tickets (qty-weighted) and matched against the **live menu**: sold-out usuals render the 5.57 SOLD OUT vocabulary ("Their usual Flat White is sold out right now", CircleOff); renamed/off-menu usuals render a quiet "Usually orders X"; variant-bearing usuals (Flat White has Large +₹50) open the item modal via a new `onChooseItem` prop — "choose size" keeps the 5.55 options honest instead of guessing the guest's size.
- **Phone normalization**: the ledger stores phones as typed ("98765 43210" lives beside "9876543210"), so recognition matches on a digits-only key (last 10 digits) while ledger reads use the raw stored form. Typing `9876543210` finds the guest the book recorded as `98765 43210`.
- **Styling**: the well wears the drawer's card grammar — `#FBFBF9` well on a `#E3E7E0` hairline, small-caps `REGULAR GUEST` label with the UserCheck icon, identity actions in teal (`#0F3D3E` solid for the usual, ghost with `#EEF3F1` hover for name/size), lifetime money in the gold voice (`#8A6D1F`), "checking the book…" as an honest 11px whisper. Same-family states elsewhere: CRM-only guests show "In the book", not a fake history.
- **E2E (real UI, zero net cloud writes)**: typed `9876543210` into the drawer → well: "Maya Iyer · 1 visit · ₹409.50 lifetime · last seen yesterday" (qa101-recognize.png) → name chip filled "Maya Iyer" → "choose size" closed the drawer and opened the Flat White modal → Add → cart merged to 2× Flat White ₹440 (same lineKey — the cart's own grammar) (qa101-usual-added.png) → reduced to zero, drawer closed, NO order placed. Read-only truth: orders census 40 untouched, CRM rows 3 untouched, console clean after marker.

## [5.61.0] — 2026-10-03 — Needs you now learns the front door

### Added — floor slots on the dashboard's alert band (no migration, no API change)
- The "Needs you now" mirror covered the counter (new tickets), the kitchen (live + late SLA), the money (unpaid), the shelf (stock low/out) and the menu (86'd) — but the FLOOR had no door. Two floor states need the owner NOW, and both became actionable this same day (5.59 move, 5.60 seat & order):
  - **Arriving now**: booked parties whose slot has arrived or is imminent — the window is `slot ∈ [now − 60 min, now + 90 min]`: an hour of grace covers a party running late without letting week-old ghost bookings pollute the count; cancelled/no-show/seated rows never count. Door: Floor (where "Seat & order" walks the party straight to the counter).
  - **Billing**: tables parked at 'billing' — the bill was asked for but nobody has settled. Every minute they sit there is a table earning nothing. Door: Floor (each billing drill links straight to its bill).
- Both slots wear the established slot grammar (CalendarClock in the blue family, ReceiptText in the unpaid amber family; singular/plural honest values; Floor doors ride the existing DoorChip). The NeedsNow mirror now reads reservations + tables alongside orders/inventory/menu in the same 30s cycle — five parallel reads for one complete picture.
- E2E (real UI, net-zero): T6 fixture → real counter ticket #112 placed via tap-through → "Ask for the bill" → dashboard showed "BILLING · 1 table settling · Open Floor" → real booking "Kiran Iyer ×2" 55 min out → dashboard showed "ARRIVING NOW · 1 party due" (screenshot qa100-needs-now.png: the six-slot band) → the Open Floor door navigates → #112 cancelled (trigger freed T6), booking cancelled, T6 retired. E2E MISAIM CAUGHT BY TRUTH: the Ask-for-bill DOM traversal clicked **T1's** button (leftover table, now 'billing') — restored surgically to its exact pre-round state via `scripts/qa100-restore-t1.mjs` (guarded `.eq('active_order_id', …)` so the write only lands if the row is still holding the same ticket). Net cloud writes: one cancelled order + two cancelled bookings; tables census 2; TT1/TT2 exactly as found.
- Truth script: `scripts/qa98-truth.mjs` (tables + live orders + reservations, read-only).

## [5.60.0] — 2026-10-03 — Seat & order: the book walks the party to the counter

### Added — one-gesture check-in for a booked party (no migration, no API change)
- The arrival journey was three screens long: the host seats the party from the book row, hunts the table card on the board, opens the drill, taps "Seat & start ticket here" — and then re-keys the guest's name and phone in the drawer that the book was ALREADY holding. For a booked party — the one case where the counter knows exactly who sat down and where — every one of those steps was redundant work at the host stand:
  - **"Seat & order" (book row)**: for a booked reservation with a linked table, a second action next to "Seat" that does the whole arrival in one tap — `updateReservationStatus('seated')`, the table hold (`available → reserved`, the same best-effort flip as plain Seat), then the drill tap-through's exact gesture started one leg earlier: cart prelinked dine-in to the party's table, guest count prefilled with the PARTY size (they told us how many are coming; the drawer's stepper can correct it), and — the part nobody had wired — **customer name and phone prefilled from the booking**. The counter never re-keys a name the book is holding.
  - Plus icon matches the drill tap-through's vocabulary ("start a ticket"), ghost teal grammar with the `#EEF3F1` hover wash — an extended action beside the solid Seat, not a competing primary. Only offered when the booking carries a table; a "decide when they arrive" booking keeps the plain Seat (nothing to prelink yet).
- E2E (real UI, net-zero): fixture T5 added through the real dialog → real booking "Priya Sharma ×3" at T5 → "Seat & order" landed on Food & Drinks with the "Ticket seated at T5 · 3 guests" strip, drawer showed 3 guests + Priya Sharma + 9812345678 with ZERO keystrokes → Flat White placed as #111 (trigger occupied T5, DB truth `seated` × table held) → cancelled through Bills (trigger freed T5) → booking undone and cancelled through the book (honest history row) → T5 retired. Net cloud writes: one cancelled order + one cancelled booking; tables census back to 2; leftover rows untouched.
- Screenshots: `scripts/qa99-seat-order.png` (the book: Priya ×3 T5 SEATED, board 3 occupied). Truth: `scripts/qa98-truth.mjs` (now also reads reservations).

## [5.59.0] — 2026-10-03 — The party moves: a live ticket follows its guests to another table

### Added — table move for live dine-in tickets (no migration, no API change to guests)
- The operational hole nobody had wired: a seated party asks for another table and the LIVE ticket had to die for it — cancel the order, re-key every line, hope the kitchen hadn't fired it. `orders.table_id` existed since migration 001, the 011 engine occupies and releases tables around order state, the POS binds carts to tables (v5.18.0) — but nothing could RE-point a live ticket. The floor's host stand now can:
  - **API (`moveOrderTable`)**: re-checks the target is still free (the 011 trigger occupies unconditionally — two parties must never swap seats through one stale picker row), points `orders.table_id` at the new table (the `AFTER UPDATE OF table_id` trigger occupies it with `active_order_id`), then releases the old table ONLY if it still holds this ticket (a manual free may have beaten us — never fight the staff, the same courtesy the release branch observes). A failed release reverts the ticket — the floor ends the call exactly as it began.
  - **Floor drill ("Move the party to another table")**: a quiet card under the live ticket's money block — collapsed it shows the free count ("1 free"), expanding it lists honest targets (available tables only, never this one, never a reserved table) with capacity + section, each with a two-step arm → confirm ("Move here" → "Confirm move?", teal #0F3D3E — a relocation is not a destruction, so it wears the seat/reserve voice, not the Free button's red). 3s disarm, same discipline as the bulk cut and the remove confirm. No free tables → an honest dashed empty state instead of a dead button. On success the drill closes — the ticket no longer lives at that table.
  - **Realtime without refetch**: the board resolves tickets via `active_order_id → orders` map, and the move only changes TABLE rows — the existing `dining_tables` subscription repaints both cards (old frees, new occupies) with zero extra reads. The moved ticket appears on the new table's card the moment the trigger lands.
  - **Guest sessions are NOT migrated** — the trail documents scans of a table's QR, and those scans happened at the old table. The ticket moves; the scan history stays where it was scanned (the picker says so in one quiet line).
- E2E (real UI, net-zero floor): fixture tables T3/T4 added through the real Add-table dialog → real ticket #110 (Ravi Kumar, Flat White, ₹231.00) placed at T3 via the tap-through → moved T3→T4 through the new picker (DB truth: order at T4, T3 released, T4 occupied by the trigger) → board repainted live (#110 on T4, T3 green again) → cancelled through Bills' arm→confirm → the 011 release branch freed T4 automatically → both fixtures retired through the real Remove flow. Net cloud writes: one honest cancelled ledger row; tables census back to 2.
- Screenshots: `scripts/qa98-move-picker.png` (picker open on T3), `scripts/qa98-moved.png` (the ticket living at T4). Truth: `scripts/qa98-truth.mjs` (read-only).

## [5.58.0] — 2026-10-03 — The stale line owns its fault: the guest cart learns which dish just died

### Added — stale-line marking after an ITEM_UNAVAILABLE bounce (no migration, no API change)
- The server has always been honest at placement (`sp_create_public_order` re-checks `is_available` per line and even names the dish: "Flat White just sold out. Please refresh your order.") — but the guest cart was blunt: the bounced line sat there unmarked, the banner named the culprit in text, and the fix was a scavenger hunt. The loop 5.57.0 opened (counter pulls → guest phone hides) now closes at the cart:
  - **GuestPages.placeOrder**: on `ITEM_UNAVAILABLE`, the flow re-fetches the live menu bundle (available items only, server-side) and marks every cart line whose dish vanished — `staleIds`. The menu grid state swaps to the same fresh bundle, so the pulled dish disappears from the phone in the same breath it's discovered missing. Fail-soft: a refresh hiccup keeps the banner alone and never invents a stale mark; the server's own words stay the voice of the banner.
  - **Cart drawer**: a stale line wears a red band (`#F3D8D4` hairline on `#FDF3F2` — the SOLD OUT family tone), a white "Just sold out" pill badge (CircleOff, `t('justSoldOut')`, +1 key × EN/हिंदी/ಕನ್ನಡ), its price rests gray, and its Remove link turns bold — the one-tap way out is the loudest thing on the row.
  - **addLine hygiene**: a dish the guest can (re-)add is by definition live again — adding one clears its stale mark.
- **Verified end to end, cross-role, one browser**: guest at `/t/<T1>` added a Flat White (cart → sessionStorage) → owner console pulled it through the 5.57.0 modal (DB `is_available=false`) → guest reloaded (cart restored, grid already honest) → Place order bounced with the server's named-dish banner → drawer showed the marked stale line (`scripts/qa97-stale-line.png`) → Remove → cart empty → owner put it back (DB `true`) → guest grid shows it again. Net cloud writes: **zero** (order never placed; both flips through the honest UI path). `tsc` clean, zero page errors.

## [5.57.0] — 2026-10-03 — The counter pulls the dish: sold-out is one tap at the till, one vocabulary everywhere

### Added — quick-86 from the item detail modal (no migration, no API change)
- The kitchen shouts "paneer over!" — until now the only honest response walked through the Menu screen's edit dialog, mid-rush, twice (pull now, put back later). The counter modal now owns both directions of `is_available`, the same menu row the Menu screen has always written:
  - **ItemDetailModal**: a quiet **Counter** zone at the bottom of the scroll body (hairline-top, never adjacent to the Add CTA, never mistakable for order-building) — "Mark sold out" on a live dish. A pulled dish's modal becomes read-only: SOLD OUT strip under the name, price resting in gray, no stepper / variants / add-ons, and the footer CTA swaps to "Put back on the menu".
  - **FoodDrinksScreen**: the optimistic flip updates the grid and the modal in the same tick; the write is the same `updateMenuItem(isAvailable)` the Menu screen makes; a failed write reverts both and says so — a sold-out state the cloud never confirmed would be a lie the guest menu can't see. New toast kinds `pulled` / `returned` / `failed` (CircleOff / RotateCcw / CircleAlert badges; failure lingers 6.5s).
  - **Sold-out cards open on first tap** and focus normally (`tabIndex 0`), because the modal is now the way back — only order-building stays blocked. The card's aria-label says so: "Flat White, sold out — open to put it back on the menu".
  - **Guest honesty**: the guest QR menu serves available items only, server-side (024) — a pull is invisible on the phone within one load; verified live (`qa96-guest-pulled.png`: Flat White hidden while Muffin shows; visible again after put-back).

### Fixed — the inverted toggle (caught by instrumented E2E, not by review)
- First draft sent `onToggleAvailability(!unavailable)` — a LIVE dish asked to be put BACK: the toast cheerfully announced "Flat White is back on the menu" for a dish that never left, and the pulled path was unreachable from the counter. Two E2E rounds "passed" while exercising the wrong branch (the write landed, `updated_at` bumped, nothing looked broken). Instrumented the handler chain (`[qa96]` console lines) and the very next click printed the truth: `modal entry unavailable=false → parent entry available=true`. Fix: the parameter IS the new availability — `onToggleAvailability(unavailable)`. Lesson carried: a passing E2E proves the branch that RAN, not the branch you meant.

### Styled — one SOLD OUT vocabulary across surfaces
- The POS card pill drops its lone "Unavailable" (#B42318 on #FEF2F2) and speaks the Menu screen's own tone: **SOLD OUT**, #B4483C on #FDF3F2 — the owner's list, the counter grid and the counter modal now use the same two words and the same colors. Photo headers grayscale in both card and modal; prices rest gray while pulled.

### Verified
- Real-UI round trip: Flat White pulled from the Coffee modal (toast + SOLD OUT strip + `putBack` footer, `qa96-modal-soldout.png`) → DB truth `is_available=false` (read-only check) → guest QR menu hides it → first-tap reopens the card → "Put back on the menu" → toast + Add CTA restored → DB truth `is_available=true` → guest menu shows it again. Net cloud writes: **zero** (both flips through the honest UI path). 14/14 screens, `tsc` clean, zero page errors on fresh reloads, zero console warnings.

## [5.56.0] — 2026-10-03 — The ticket remembers the extras: counter add-ons reach the ledger, the kitchen reads them back

### Fixed — the write gap one layer under 5.55.0 (no migration, no API schema change)
- 5.55.0 let the counter SELL an "Extra shot" — but `createOrder`'s direct insert dropped it. The cart priced it (₹ folded into `unit_price`), the drawer showed it, and then placement forgot it: `order_item_addons` — the frozen name+price snapshot table the guest RPC door has written since migration 017 — received NOTHING from a counter-placed ticket. The money was right; the dish spec was lost. The kitchen ticket read "Flat White · Large" and never learned about the Extra shot; bills/receipts/floor/track/repeat all read the same blind ledger. The round closes it both ways:
  - **Cart (store/cart.ts)**: `CartLine.addons` now rides as a frozen `{id, name, price}[]` snapshot — the live menu's ids from the modal, `id: null` for repeat-synthesized lines (`addon_id` is ON DELETE SET NULL by design: a snapshot needs no living addon row). `addonNames` stays in sync for the line key and drawer renders.
  - **Placement (api.ts)**: `NewOrderInput.items` grows `addons`; `createOrder` re-selects the inserted `order_items` ids and bulk-writes `order_item_addons` rows in the guest door's exact shape (`tenant_id, order_item_id, addon_id, name, price`). A ticket without extras is byte-identical to the pre-5.56.0 path; a mismatched insert return throws before any partial write.
  - **KDS (KitchenScreen)**: ticket lines now speak the extras — `+ Extra shot` in the warm `#5F6B63` after the variant chip, same `+` grammar as the counter inbox and receipts; the fire checkbox's aria-label restates them ("Mark 1× Flat White (Large) + Extra shot as fired").
  - **Repeat (CustomersScreen)**: 5.54.0's "their usual" no longer degrades a "Large + Extra shot" into a bare Large. The ledger froze `unit_price` WITH the extras (017: price + delta + Σ addons), so the repeat reconstructs the base by subtracting the snapshot back out and lets `cart.add` re-fold the same extras into the exact same total — the new ticket's ledger rows carry real per-extra prices again, not zeros.
- **Verified end to end against the ledger** (read-only `scripts/qa95-truth.mjs`): counter-placed order #109 — line `Flat White · Large @ ₹330.00` (frozen FULL price), one `order_item_addons` row `Extra shot @ ₹60.00` with the real `addon_id` FK, subtotal 330.00 + GST 16.50 = total 346.50 exact; then cancelled through the UI for a clean exit. Counter Inbox aggregated the extra straight from the ledger; the KDS read it back after the fire; a repeat of #109 rebuilt the cart at exactly ₹330.00/₹346.50. 7/7 assertions pass; guests census back to 1 after the duplicate raw-phone key (pre-existing 016 behavior) was removed through the UI.

### Styling — one extras grammar everywhere
- The extras voice is now the same animal on every surface: drawer lines render `+ Extra shot` per-extra (the receipt's grammar) in `#5F6B63` instead of a bare comma list in `#969696`; the KDS uses the identical tone, so "Extra shot" reads at arm's length before the cup leaves; variant chips stay neutral gray, notes stay orange-italic — three voices, three meanings, no overlap.

## [5.55.0] — 2026-10-03 — The counter sells the whole dish: variants + add-ons finally reach the POS

### Fixed — the option gap nobody could see (no migration, no API schema change)
- The guest QR menu could order a "Large Flat White + Extra shot" every day; the cashier's own POS could never build that ticket. The option tables have existed since migration 012 (`menu_variants`, `addons`, `menu_item_addons`), the owner has managed them in Menu since 5.3.0, the guest RPCs have embedded them since 024 — but the POS data load fetched ONLY categories + menu_items, so the item-detail modal's option sections never had anything to render. The counter was blind to every option its own guests could pick. The round closes it end to end:
  - **Data (FoodDrinksScreen)**: the load now also fetches variants + addons + the per-item allow-list and enriches each item client-side (the Menu screen's exact pattern). Fail-soft: if the option read fails the menu still sells bare — options are an enhancement, never a gate.
  - **Modal (ItemDetailModal)**: a "Choose one · optional" pill row — "As served" resting state plus one pill per variant with its delta (`+₹50`, `−₹x`, tabular mono); picking one fills dark-teal, aria-pressed throughout. The gold price under the name becomes the RUNNING unit (base + delta + live add-ons) — the cashier never does delta math in their head. Add-to-Order passes the variant into the cart.
  - **Cart (store/cart.ts)**: `CartLine.variantName` rides the line; the line key grows the variant name so Large and Regular of the same item NEVER merge into one stepper; `unitPrice = base + delta + addons` folded at add time. `add()` grows an optional variant param; the repeat path passes the ledger's frozen variant name with delta 0 (the snapshot price already includes it).
  - **Placement (api.ts)**: `createOrder`'s direct order_items insert now writes `variant_name` — the column `attachItems` has always read back, finally written by BOTH doors. Drawer lines show the variant as a quiet gray chip after the name.
- **Deliberate fix inside the modal**: the Figma-derived "every add-on rests at 1x" initializer was never live (addons never rendered on POS, so the resting state never fired). Enabling the section with 1x-resting would have silently repriced EVERY ticket (+₹60 on every Flat White until manually removed). Add-ons now rest at 0x — the guest customizer's rule, and the only honest grammar once the section is actually reachable.

### Styling — options that speak the house
- Variant pills wear the drawer's committed-tone (dark teal fill, white text, shadow) against hairline gray resters with teal hover invitations; deltas are `#967221` gold in tabular numerals so a hand-keyed total can be checked at a glance. The drawer's variant chip mirrors the SOLD OUT pill's geometry (rounded-full, 10.5px bold) in neutral gray — option, not alarm. The running price keeps the gold-bold money voice.

### Verified
- E2E (real UI, owner session): Flat White's modal now renders "As served | Large +₹50" and the Extra shot row resting at 0x (`scripts/qa93b-modal-options.png`) → picked Large + one Extra shot → running price ₹330.00 live → Add to Order → pill "1 item · ₹330.00" → drawer line: green mark + "Flat White" + Large chip + "Extra shot" + ₹330.00, subtotal ₹330.00 / GST ₹16.50 / total ₹346.50 exact (`scripts/qa93b-drawer-variant.png`) → cart emptied through its own stepper → pill gone. No order placed; zero cloud writes (orders 36 / menu 3 / bells 3 / chat 5 / bucket 0).
- 14/14 screens, tsc 0, zero page errors. The repeat flow (5.54.0) now carries variant names back into the cart by code path (no live order carries a variant yet — first variant ticket will exercise it; the guest side's variant tickets already do).

## [5.54.0] — 2026-10-03 — The regular's round: "Repeat this order" walks a past ticket into today's cart

### Added — the counter-speed feature Indian cafés actually live on (no migration, no API change)
- Chai-and-toastie regulars order the same thing daily; until now the cashier re-keyed it from memory while the guest's whole history sat one tap away doing nothing. The guests drawer (v5.5.0) already fetched each phone's last 8 tickets WITH full item snapshots (`attachItems` carries menu_item_id, name, qty and the addon-inclusive unit_price the ledger froze) — the round turns that payload into a door:
  - **Guests → guest drawer → "Repeat this order"** on every ticket: pushes each line into the LIVE cart additively (cart.add merges by item+addons key, so repeating over an in-flight cart is "another round", not a clobber), pre-fills the drawer's customer name + phone from the CRM card (the repeat IS for this guest — the ticket books itself again), closes the drawer and walks the cashier to Food & Drinks. A toast names the arrival: "Order #N loaded into the current order" — the gold pill at the corner is never a mystery. `goSection`'s dormant hint channel (`consumeSectionHint`) carries the order number; Food & Drinks consumes it on mount (the same grammar Bills' 'unpaid' hint speaks).
  - **Honest guard**: a ticket repeats only when EVERY line still points at a living menu item — a ticket whose item was de-listed renders a gray "Items changed since this ticket — repeat unavailable" chip with the reason in its title, never a button that fails at placement time (order_items.menu_item_id is the FK createOrder needs).
- **Cart lines carry the leaf** (5.53.0's own parked seed — "cart lines are flattened and carry no is_veg; revisit if the line payload ever grows"): `CartLine.isVeg` rides the line (client-only state), `cart.add`'s signature widens to the structural minimum (id/name/price + image_url/is_veg) so both the modal's full MenuItem and the repeat's synthesized snapshot satisfy it, and the review drawer prints the same FSSAI mark beside every line name. Repeat-loaded lines stay silent (order_items carry no veg claim) — the mark never invents a dietary fact the kitchen didn't give.

### Styling — the repeat affordance and the marked line
- "Repeat this order" wears the house ghost-pill grammar: h-7 full-width, hairline `#E3E7E0` border, `#967221` text with the Repeat icon, gold border + `#FBF7EC` fill on hover, gold focus ring — a quiet secondary action under the ticket's money row that turns gold the moment the pointer intends it. The unavailable chip mirrors the sold-out pill's gray. Drawer lines get the 13px mark with a 1.5 gap that never lets the leaf crowd the name.

### Verified
- E2E (real UI, owner session): Maya Iyer's drawer showed "Repeat this order" on ticket #48 (`scripts/qa93-drawer-repeat.png`) → click landed on Food & Drinks with the "Order #48 loaded" toast and the pill "Review order, 2 items, ₹440.00" → drawer showed Flat White 2× ₹440 with customer name + phone prefilled (`scripts/qa93-cart-loaded.png`) → modal-added line showed the green mark beside its name (`scripts/qa93-drawer-vegmark.png`) → cart emptied through the drawer's own stepper (no order placed) → pill gone.
- 14/14 screens, tsc 0, zero page errors. Cloud truth (read-only): orders 36 / menu 3 / bells 3 / chat 5 / bucket 0 — the round's payload is client-side state; the cloud was never written (placement is the cashier's explicit act, and the E2E deliberately stops one step short of it).

## [5.53.0] — 2026-10-03 — The menu respects the leaf: veg-only filter on the guest phone and the counter

### Added — the dietary filter India actually asks for (no migration, no API change — `is_veg` already rode every payload)
- India's veg/non-veg line is dietary identity, not preference — every Indian food app carries a veg toggle front and centre, and this POS served Indian cafés without one. The payload was honest all along (`is_veg` rides the guest RPCs since 024 and `MenuItem` since 001) and both surfaces already PRINTED the mark — but nothing could FILTER by it. The round closes that gap at both ends where the decision happens:
  - **Guest QR menu** (`GuestPages.tsx`): a veg-only toggle beside the search bar — the FSSAI square-and-dot as a filter. ON fills the green tint and appends an honest count chip of the dishes the kitchen actually marked veg; filtering composes with the existing search, and the sticky category rail re-flows with the same filtered set. The empty state speaks honestly in three languages: a bare veg menu says "No vegetarian dishes on this menu yet.", a veg+search miss says "Nothing vegetarian matches "{q}"." — the pre-existing `nothingMatches` stays for the unfiltered miss. All four strings added to EN / हिंदी / ಕನ್ನಡ (`guest-i18n.ts`).
  - **Counter POS** (`FoodDrinksScreen.tsx`): the counter now speaks the same leaf — every `ItemCard` carries the mark beside the price (green veg / brown-red non-veg; `is_veg` NULL stays silent — the mark never invents a dietary fact the kitchen didn't give), the item-detail modal carries it beside the name, the card's aria-label announces "vegetarian / non-vegetarian", and a "Veg only" pill at the items level filters the open category with an honest count chip plus a "showing vegetarian items only" hint. The empty state names the cause: "No vegetarian items here" with a one-line way out.
  - **`VegMark`** (`shell/VegMark.tsx`): the shared mark component — one geometry, one source of truth, imported by card and modal (kept out of `FoodDrinksScreen` to spare the import cycle).

### Styling — the FSSAI mark as the filter's face
- Both toggles wear the mark INSTEAD of a checkbox: a 16px rounded-square border with the centered dot, green `#2E7D32` — the same geometry the guest rows have printed since v5.7, so the filter doesn't introduce a new symbol, it OPERATES the existing one. ON state: green border + `#EAF4EB` tint + dark-green text; OFF: hairline gray with a green hover invitation. Guest toggle is `h-12` to sit flush with the search bar; POS pill is `h-9` in the house chip grammar with the gold focus ring. Counts are honest everywhere (the chip never shows a number the menu didn't earn).

### Verified
- E2E (real UI, both surfaces, full stage→clean): staged "Chicken Keema Pav" (non-veg, ₹180, Food) through the owner Menu UI → guest menu showed 4 rows, veg-only ON hid the chicken and showed the count chip "3" (`scripts/qa92-guest-veg.png`); POS Food category showed the red mark on the card + modal (`scripts/qa92-pos-veg.png`, `scripts/qa92-pos-modal.png`) and the toggle hid it with the hint line. Deleted through the same owner UI → menu back to 3 veg items. TOOLING LESSON: the armed delete auto-disarms after 3s — arm and confirm clicks must fire back-to-back with no snapshot between (three polite flows failed before the instant double-click landed).
- 14/14 screens land with correct titles, zero page errors on fresh reloads, tsc 0. Cloud truth (read-only census): menu back to 3 items all veg, orders 36 / bells 3 / chat 5 / bucket 0 — the round's only writes were the staged fixture, fully cleaned through the UI.

## [5.52.0] — 2026-10-03 — The guest sees the licence: the legal identity reaches the QR menu and the track page

### Added — migration 037: the two public RPCs carry the legal trio (owner's fields → every guest phone)
- Task 90 gave the owner a place to TYPE the legal identity (Settings → Business profile) and a printed bill that carries it — but the two guest-facing surfaces never showed it. In India the FSSAI licence number on a menu is a trust marker guests (and aggregators) expect to find; the GSTIN belongs beside it. Migration `037_guest_legal_footer.sql` extends both public RPCs — `sp_get_public_menu` (024 lineage) and `sp_get_public_order` (025 lineage) — so each `tenant` object now carries `legal_name`, `gst_number` and `fssai_number` beside the name and logo. Everything else in both functions is byte-for-byte the LIVE definition (dumped via `pg_get_functiondef` before editing — no drift). Applied via `scripts/apply-037.mjs`: 7 proofs green, including a self-cleaning probe (stage a legal identity in SQL → both live RPCs return it → reset to NULL → honest absence restored) and the anon-execute privilege check (guest phones never need a session).
- **GuestFooter grows a licence strip**: the receipt's legal block spoken at glass scale — legal entity name (only when it differs from the trade name), then `GSTIN: … · FSSAI Lic. No: …` in letter-spaced tabular digits a hand-keyed typo can't hide in, on a cream strip above the ServePoint row. Renders ONLY when the owner saved something in Business profile; an all-NULL payload leaves the footer byte-identical to the pre-5.52 footer (the v5.29 logo precedent). Wired on the two surfaces where a guest reads something the café "issued" — the QR menu and the track page; the gate/error states keep the bare footer (a spinner needs no licence).

### Verified
- E2E (real UI, both directions): staged the trio through the owner UI (keyboard-driven — Task 90's synthetic-fill lesson), guest menu at `/menu/<T1-token>` rendered "Qrflow Hospitality Pvt Ltd" + "GSTIN: 29ABCDE1234F1Z5 · FSSAI Lic. No: 11223344556677" (`scripts/qa91-guest-menu-footer.png`); the track page for a live order rendered the same strip (`scripts/qa91-track-footer.png`); cleared through the same UI → both footers went back to bare (honest absence, zero matches). 13/13 routes, tsc 0.
- Cloud truth (`scripts/qa91-truth.mjs`): TRUTH OK — legal fields back to NULL, orders 36 / bells 3 / chat 5 / presence 1 / bucket 0, both RPC definitions hold the new payload fields, tenants schema untouched at 20 columns.

## [5.51.0] — 2026-10-03 — The bill speaks legal: Business profile + the TAX INVOICE receipt

### Added — the legal identity travels from Settings to the printed paper (no migration, no API schema change)
- The tenants table has carried `legal_name`, `gst_number`, `fssai_number`, `address` and `owner_phone` since migration 001 — but there was nowhere to edit them and the thermal receipt never printed them. For an Indian café that is a compliance gap, not a nicety: a bill carrying a GSTIN is legally a **tax invoice**, and the FSSAI licence is required on food-business paperwork. The round closes the loop end to end:
  - **Settings → Business profile** (owner-only, the same `isTenantOwner` gate as Café brand): five fields — legal entity name, GSTIN (15-char shape check), FSSAI licence (14-digit shape check), address, phone. Both licence checks warn softly and never hard-block — the DB is not the place to outsmart a valid edge GSTIN the government actually issued. Writes go through `updateTenantLegal` straight against `tenants`, gated by the existing owner-only UPDATE RLS policy (the same grant that lets Café brand save the logo); empty string saves as null, so clearing is honest.
  - **The receipt grows a legal identity block** (ReceiptPrint): legal name (only when it differs from the trade name), address, phone, then `GSTIN: …` and `FSSAI Lic. No: …` in letter-spaced tabular digits a hand-keyed typo can't hide in — and the document title becomes **TAX INVOICE** the moment a GSTIN exists, falling back to CUSTOMER RECEIPT when it doesn't. Every field is optional; with all absent the receipt is byte-identical to the pre-5.51 header (the v5.29 logo precedent).
  - **Bills** passes the tenant's legal fields into the print — one caller, the house's single receipt door.

### Styling — what you save is what the guest holds
- The section's centerpiece is a **thermal preview card**: a mini receipt (dashed hairline frame on the cream floor, monospace, centered) that re-renders from the drafts on every keystroke — trade name, legal name, address, phone, GSTIN/FSSAI lines, and the document title chip flipping between a green TAX INVOICE and a gray CUSTOMER RECEIPT with an honest one-line hint underneath ("No GSTIN yet — bills print as plain customer receipts…"). The GSTIN/FSSAI inputs render in mono uppercase with tracking, matching the paper they will print on.

### Verified
- E2E (real UI, owner session): Business profile nav row sits beside Café brand; empty state renders the gray CUSTOMER RECEIPT preview with Save disabled; typing the GSTIN flips the preview to green TAX INVOICE live; all five fields saved ("Saved" chip), **survived a full reload**, then cleared through the same UI (keyboard-driven — synthetic `fill` turns out to bypass React's onChange on controlled inputs; real keystrokes don't) and the preview flipped back honestly. Receipt builder asserted in-page with the REAL stored values: TAX INVOICE + GSTIN + FSSAI + legal name + address + phone all present, escaping injection-safe, and the all-absent call falls back to the exact pre-5.51 CUSTOMER RECEIPT. The printed paper itself screenshotted via iframe (`scripts/qa90-receipt-legal.png`) next to the filled Settings section (`scripts/qa90-settings-business.png`). 13/13 routes, 0 console errors on full reloads, tsc 0. (One stale HMR-window `pingPresence is not defined` in the session console history predates this round and does not reproduce on any fresh reload.)
- Cloud truth (`scripts/qa90-truth.mjs`): TRUTH OK — legal fields restored to null, orders 36 / bells 3 / chat 5 / presence owner-only / menu-photos bucket 0, tenants schema untouched at 20 columns, the owner UPDATE policy intact. Zero migration, zero schema drift, honest exit state.

## [5.50.0] — 2026-10-03 — Every section speaks CSV: the numbers can leave the building

### Added — the five chart-only sections get their exit (no migration, no API change)
- Reports had CSV exits for three of its nine sections since the 5.3.x days (daily sales, item ranking, guest ratings) — but five sections were chart-only: **Sales by hour, How money arrived (payment mix), Cost & margin, Service mix, Drawer honesty**. An owner carrying the week's numbers to an accountant had to read them off a screen. Each now wears the same gold CSV pill its siblings have, driven by the same `lib/csv.ts` (OWASP formula-guard, UTF-8 BOM, spreadsheet owns the formatting):
  - **Sales by hour** — all 24 IST buckets, zeros included: the gaps ARE the quiet hours, so the spreadsheet sees the whole day the chart draws.
  - **Payment mix** — one row per paid method (tickets + total), plus an honest `Unpaid — money still out` row when money is out, so the export and the section's red footer never disagree.
  - **Cost & margin** — a self-describing summary block (Range, paid tickets, paid net, ingredient cost, gross margin, margin rate) with the shelf-cost caveat carried along as a Note row, because a number without its definition travels badly.
  - **Service mix** — dine-in/takeaway/etc. with tickets, totals and share of orders.
  - **Drawer honesty** — sealed shift by sealed shift: expected vs counted vs the STORED variance (never re-derived, same rule the section speaks), closed-by and the closing note, with a NET row summing the ledger.
- Buttons are gated on their section having data (no CSV pill on an empty chart — an empty download is a lie), and each carries an `aria-label` + `title` naming the section. The two older pills that lacked them (Day by day) got the same aria backfill — one button grammar, one file.

### Verified
- E2E (real UI, blob-intercepted): all 8 CSV pills render on `/reports` (5 new + 3 existing). On Last 30 days: payment-mix rows match the pie to the paisa (UPI ×19 ₹6,205.50, Cash ×10 ₹3,276.00, Unpaid ×5 ₹1,801.80 — the same honest money-still-out the morning mirror and Bills speak); cost-&-margin matches the chips (29 paid, ₹1,515 cost, ₹7,515 margin, 83.2%); service mix 31/3; drawer CSV carries both sealed shifts with stored variances (−7.00, 0.00) + NET row — and the export shows the OWASP guard live (`'-7.00`: a leading minus never becomes a formula); sales-by-hour holds 13 earning hours with the 8p peak ₹2,956.80 the chart draws. Screenshot `scripts/qa89-reports-csv.png`. 13/13 routes, 0 console errors, tsc 0.
- Cloud truth: pure-UI round — zero writes anywhere; orders 36 / bells 3 / chat 5 / menu-photos bucket 0, exactly as found.

## [5.49.0] — 2026-10-03 — The guest sees the face: QR menu photos go live

### Added — the fifth surface, and the one that mattered (no migration)
- 5.48.0 gave every dish a face — but only the house could see it. The upload loop closed on the owner's Menu screen, and `image_url` already rode four internal surfaces, yet the phone the photo was really taken for — the guest's, scanning the table QR — never showed it: `sp_get_public_menu` has carried `image_url` in its payload since migration 024 and the `GuestMenuItem` type declared it, but `GuestPages.tsx` never rendered it. The round's audit caught the gap and closed it with pure UI (no schema change, no RPC change — the payload was already honest).
- **Row thumb** (`DishPhoto shape="thumb"`): a fixed 56×56 tile at the right edge of every item row that has a photo — name, price and description stay left, the way delivery menus read. Rows without a photo render exactly as before (no empty box, no layout shift): a photo-less house's menu is pixel-identical to 5.48.
- **Customizer banner** (`DishPhoto shape="banner"`): open an item and the photo fronts the panel above CHOOSE ONE — you see what you're ordering before the variant pills.

### Styling — the guest photo language
- Same grammar as the logo tile that taught it (v5.27): a URL that fails to load **hides its own tile** — never a broken-image glyph on a menu a guest is holding (verified live: a staged dead URL rendered zero photo imgs, the row reflowed honestly). The box is FIXED-SIZE with a cream floor (`#F6F5F2`) behind the bytes, so the row never shifts while the image arrives. `loading="lazy"` + `decoding="async"` — a phone on café wifi fetches photos as the category scrolls to them, not forty at once. Hairline `#E3E7E0` ring, `rounded-2xl`, soft shadow; on row hover the ring warms to gold (`group-hover` `#D9C48A`) — the owner-side PhotoTile's gold hover, spoken quietly on the guest side. `alt` is the dish name: the photo IS the dish.

### Verified
- E2E (real UI, both sides): owner uploaded a PNG to Flat White through the Menu PhotoTile (in-page DataTransfer + dispatch — 5.48's lesson, reused); guest menu at `/menu/<T1-token>` rendered the row thumb (54×54, lazy, object-cover) within the page load, and the opened customizer showed the banner (482×128 at `sm:h-32`). Photo-less rows (Blueberry Muffin, Veg Grilled Sandwich) confirmed unchanged in the same viewport. Broken-URL stage→verify: tile hid, row intact, no glyph. Clear via the owner UI's ✕ → `image_url` null. One QA-induced lesson: staging the broken URL OVER the real one before clearing orphans the real object (the ✕ removes the URL's target, which no longer existed) — the orphan went home through the Storage API (`scripts/qa87-remove-photo.mjs` doubling as the member-delete-policy proof, again). Screenshots `scripts/qa88-guest-photo.png` + `scripts/qa88-guest-customizer.png`. 13/13 routes, 0 console errors, tsc 0.
- DB truth (`scripts/qa88-truth.mjs`): TRUTH OK — bucket zero objects, every `image_url` null, orders 36 / bells 3 / chat 5 untouched, presence owner-only, 036 and 035 intact.

## [5.48.0] — 2026-10-03 — The dishes get their faces: menu photos close the loop

### Added — an upload path for a column that always rendered (migration 036)
- `menu_items.image_url` has been rendered everywhere since the beginning — the counter POS item modal, the guest dish thumbs, Dashboard's Trending Dishes — but NOTHING could ever put a photo there: no upload UI, no storage bucket, no API. The dishes had frames but no faces. Migration `036_menu_photo_storage.sql` (no table changes — a Storage bucket, mirroring 026's tenant-logos pattern with two deliberate differences):
  - **FOLDER = TENANT, not user**: every object lives under `menu-photos/<tenant_id>/<menu_item_id>-<timestamp>.<ext>`, and the write policies scope by TENANT MEMBERSHIP (003's owner/staff, is_active) on that first folder — the same member gate every operational table uses. 026 scoped by auth.uid because a logo is the account's face; a dish photo is the house's.
  - **NO SVG**: dish photos are photographs — svg+xml is a script-injection vector when served publicly and no phone photo is ever svg. The mime allowlist is png/jpeg/webp/avif only; 2 MiB (photos are bigger than logos, thermal receipts still stay light). Applied via `scripts/apply-036.mjs`, four proofs green (bucket shape, the 4 policies, member scoping on the upload policy's WITH CHECK, idempotent re-apply).
- **API (api.ts)**: `uploadMenuItemPhoto` (mime/size guards restated as friendly errors → storage upload → public URL), `removeMenuItemPhoto` (best-effort object removal, foreign URLs ignored), and `imageUrl` joins `MenuItemInput`/`updateMenuItem` (null clears). **Replacing a photo removes the replaced object** — the old face leaves the bucket in the same breath as the new one lands.
- **UI (MenuScreen)**: a `PhotoTile` at the head of every item row. Empty: a dashed sage tile with an ImagePlus glyph that warms to gold on hover. Filled: the photo, soft-ringed, with a small rose ✕ badge bottom-right to clear it (the same corner the presence dot speaks from — one corner language). Uploading: a spinner ring over a fixed 44px box — the row never shifts. Upload is immediate on pick: one honest write per pick (storage object → image_url patch → row refetch), no draft state to lose, no "Save" to forget.

### Styling — the tile language
- Dashed sage → gold-on-hover for "no face yet"; soft-ringed photo with the rose corner ✕ for "dressed"; the spinner ring for "in flight". A broken URL dims the image instead of showing a broken-image glyph — the tile stays honest even when a photo dies.

### Verified
- E2E (real UI, full cycle): a generated 2.3 KB PNG uploaded through the row's file input → `menu_items.image_url` set, one `storage.objects` row under the tenant folder, the tile flipped to the photo with its ✕ badge, the public URL fetched **200 image/png** with no session (guest phones will load it), and the counter POS item-detail modal rendered the photo header. Clear via the row's ✕ → tile back to dashed, `image_url` null, bucket back to **zero objects** — upload, display, and clear all through the real UI. Two tooling lessons en route: `agent-browser upload` set the file but never fired React's change (the in-page DataTransfer + dispatch path did — and the diagnostic's TypeError was actually the handler clearing the input mid-eval); direct DELETE on storage.objects is platform-blocked, so the QA orphan went home through the Storage API with the owner's session — which doubles as a live proof of 036's member delete policy. Screenshots `scripts/qa87-phototile.png` + `scripts/qa87-pos-modal.png`. 14/14 screens, 0 console errors, tsc 0.
- DB truth (`scripts/qa87-truth.mjs`): TRUTH OK — bucket at zero objects, every `image_url` null, orders 36 / bells 3 / chat 5 untouched, presence owner-only, 036 (public 2 MiB bucket + 4 member policies) and 035 both intact.

## [5.47.0] — 2026-10-03 — Needs you now: the morning mirror earns its doors

### Added — the landing screen's honest "what needs me" (no migration)
- The Dashboard answered "how is the business?" (Daily Sales, Total Revenue, margin, guest love) but not the question you actually open the app with at 7 am: **what needs me before the first pour?** Every surface had its own waiting number — the CounterInbox queue, the KDS board, Bills' money-out, Inventory's shelf, Menu's 86 list — and none of them met you at the door. `NeedsNow` is the strip that unions them, each count earning its door exactly the way the counter taught it (5.44.0):
  - **New tickets** — the CounterInbox queue (`new`): money waiting to cook. Door: Open Counter (the inbox band sits at the top of Food & Drinks' default view).
  - **In the kitchen** — `pending`/`preparing` on the board right now. Door: Open Kitchen.
  - **Late prep** — `preparing` past the 10-minute SLA (the KDS's own clock, red). Door: Open Kitchen, aria restating the SLA.
  - **Unpaid** — money still out with the ₹ total. Door: Open Bills **carrying its context** (sectionHint `'unpaid'` — the same pre-filtered arrival Close-out and Reports use).
  - **Stock low & out** — items at/below the reorder point or at zero (Inventory's own `levelTone` math, verbatim). Door: Open Inventory (lands on the Stock tab's low-stock alert strip).
  - **Sold out** — menu items 86'd (`is_available = false`). Door: Open Menu (the SOLD OUT chips are right there to un-86).
- **Truth rules**: counts are computed client-side from the same ledgers the rooms read (orders + inventory + menu), refreshed on mount and every 30s. A slot renders ONLY when its count is real (>0 — zero means zero, honest hiding); when NOTHING waits, the strip says so calmly ("Nothing waits on you — the floor is yours.") instead of pretending. **DELIBERATE day-agnostic scope**: unlike Close-out's Right-now (which mirrors the IST Z-day and honestly shows zeros for a fresh day), the mirror counts everything still waiting REGARDLESS of day — an unpaid ticket from yesterday still needs you; that's exactly how yesterday's known leftovers should surface on the landing screen. Fail-soft: a failed read keeps the last honest strip; a first failed read hides the strip entirely, and the analytics below still load.
- **Shared door grammar (refactor)**: EodScreen's `LiveDoorChip` moved to `src/components/shell/DoorChip.tsx` as `DoorChip` — one file now owns the deep-teal-on-5%-wash, ArrowRight, gold focus ring and 0.96 press scale; Close-out aliases it back in unchanged, so 5.42/5.44's grammar cannot drift between screens.

### Styling — attention has a chrome, calm has a quieter one
- **Waiting**: the amber-wash gradient card (`#FDF6E3 → white`, the EOD attention chrome) with a "NEEDS YOU NOW" micro-label over a 2×3 grid (3 columns on large screens) — each slot reads icon tile → uppercase label → big tabular count → door chip, in one line, never squeezed.
- **All clear**: the strip drops to a plain white card with a sage circle and the health-green check — "Nothing waits on you — the floor is yours." Silence should look like silence (the same rule as 5.46.0's still gray dot).
- Layout lesson from the E2E screenshot: six `min-w-[150px] flex-1` slots in one flex row squeezed labels into three-line wraps — replaced with a real grid so every slot owns its column.

### Verified
- E2E (real UI, every door walked): the mirror lit with the house's honest waiting queue — New tickets 4 / In the kitchen 2 / Late prep 1 (yesterday's 12h-old preparing ticket) / Unpaid 5 · ₹1,801.80 (the known owner-decision leftovers) — plus two staged flips (Coffee beans 4880→400 g, Veg Grilled Sandwich 86'd) lighting Stock low & out 1 and Sold out 1. All six doors walked: Open Counter → inbox "4 awaiting Ok"; Open Kitchen → the board; Open Bills → landed pre-filtered Active with the honest "Dashboard › Bills" crumb; Open Inventory → the Stock tab's "1 at or below reorder point" alert; Open Menu → the SOLD OUT chip. After the flips were restored, the strip re-derived and the two staged slots vanished — honest hiding proven live. Screenshot `scripts/qa86-needsnow.png`. 14/14 screens land, 0 console errors, tsc 0 after every edit.
- DB truth (`scripts/qa86-truth.mjs`): TRUTH OK — both flips restored (beans 4880, sandwich available), orders unchanged at 36 (zero probe tickets this round), bells back to the honest 3 (the staged 400 g flip fired the 030 low-stock watcher — the QA echo bell was deleted; its watcher works, which is rather the point), chat at 5, presence owner-only, 035 intact.

## [5.46.0] — 2026-10-03 — The line's people: who is even here right now

### Added — presence under the typing signal (migration 035)
- The typing line (034) answers "who is answering THIS room right now"; it can't answer the quieter question the rooms pane starts with — is anyone even AT the app? You open Messages at 7 am, the thread reads silence, and you can't tell "nobody has seen this" from "nobody is here". Migration `035_staff_presence.sql` adds the signal under the signal:
  - `staff_presence (user_email, tenant_id) → sender_name, last_seen_at`, composite PK (one row per member per tenant), upserted on a ~45s heartbeat for as long as the member has the app open. **Presence is APP-level, not room-level** — "on the line" means "at the counter", and the shell (App.tsx) owns the heartbeat because someone standing on Floor is just as "on the line" as someone in chat. Platform accounts (no tenant) skip.
  - **Truth model — the same window-is-the-truth contract as 034, stretched to presence scale**: a member counts as online while `last_seen_at > now() - 120s`; a 45s heartbeat tolerates two missed beats before the dot honestly goes gray; a closed tab simply goes stale — no sign-out retract choreography, no cron, no vacuum. Stale rows cost one row per (member, tenant) and are corrected by the next heartbeat.
  - **DELIBERATE (034's rule holds)**: staff_presence JOINS the realtime publication — being here is ANNOUNCED, not derived; a teammate's first open flips their dot live. The guarded idempotent add keeps re-applies safe. Applied via `scripts/apply-035.mjs`, five proofs green incl. a rollback probe (upsert twice keeps ONE row — heartbeat semantics; ROLLBACK, zero residue).
  - **The roster behind the strip**: `tenant_users` (001 §15, already member-readable FOR SELECT) LEFT JOINed to the presence ledger by email — a member who has never opened the app since 035 has no row and renders "not seen yet", never fabricated. API: `pingPresence` / `fetchPresence` / `fetchTeam`; the messages realtime channel now multiplexes FOUR tables (messages, conversations, typing, presence — same pre-subscribe pattern Task 84 proved).
- **The strip (MessagesScreen)**: "the line's people" sits at the top of the rooms pane — an honest count ("2 of 2 on the line now") above one chip per active member: tone avatar + name + presence dot. Freshness is derived client-side from the 120s window; the strip re-derives on every realtime ping and the 30s poll tick (which is also what decays a stopped heartbeat to gray without any socket at all). Fail-soft by design: a failed read hides the strip, never the rooms list.

### Styling — the dot language
- **Online breathes**: a green (`#2E7D32`, the app's health green) bottom-right dot with a soft `animate-pulse`, white-ringed against the tone avatar — the only breathing element on an otherwise still pane, so the eye reads "alive" without a banner.
- **Away is still**: honest gray (`#969696`), same ring, no motion — silence should look like silence.
- **The caption speaks the count** in the pane's quiet uppercase gray language ("2 OF 2 ON THE LINE NOW"); each chip's full story ("Front of House (Staff), online now / last seen 10 minutes ago / not seen yet") lives in its accessible label and hover title, never fabricated, reusing the app's `timeAgo` voice.

### Verified
- E2E (real UI, both directions): the owner's own heartbeat landed before the screen did — "1 of 1 on the line now, QR Owner (Owner), online now". A staged probe member (real `tenant_users` row, no presence) appeared at the next poll tick as honest "1 of 2 … qa-probe (Staff), not seen yet"; the probe's first presence INSERT flipped the strip LIVE over the socket in ~4s ("2 of 2", display name "Front of House", green); backdating the row 10 minutes flipped it gray with the honest "last seen 10 minutes ago" label — the window doing exactly its job, no poll wait needed for either flip. Screenshot `scripts/qa85-presence.png`. 14/14 screens land, 0 console errors, tsc 0 after every edit.
- DB truth (`scripts/qa85-truth.mjs`): probe member + probe presence deleted (0 residue), presence holds ONLY the owner's honest live heartbeat row, typing table still empty, chat at the honest 5 lines, 3 true bells untouched (all read), 035 intact (4 cols + member_all policy + published).

## [5.45.0] — 2026-10-03 — The typing line: the room answers before the answer exists

### Added — who is typing RIGHT NOW (migration 034)
- 033 taught the staff line WHO it talks to; you could send "refilling the pitcher?" into Kitchen and still stare at silence — not the absence of a teammate, just the absence of a signal. Migration `034_conversation_typing.sql` adds the signal:
  - `conversation_typing (conversation_id, user_email) → sender_name, typing_at`, composite PK (one row per typist per room). Identity keyed on **user_email** (the 033 split: sender_name rides along as a DISPLAY copy only).
  - **Truth model — the display window IS the truth**: a row is shown while `typing_at > now() - 6s`; a heartbeat that stops simply goes stale and disappears. No cron, no vacuum choreography — the client's 6s window is the whole lifecycle. Applied via `scripts/apply-034.mjs`, five proofs green incl. a rollback probe (upsert twice keeps ONE row — heartbeat semantics; ROLLBACK, zero residue).
  - **DELIBERATE (vs 033's opposite call)**: typing JOINS the realtime publication — presence is ANNOUNCED, not derived. The entire value is the live ping; a 30s poll would make the signal a lie. 033 kept read-watermarks off the socket because reading habits need no announcement; "who is typing in this room" is exactly what the room is for.
- **UI (MessagesScreen)**: composer keystrokes announce at once, then heartbeat at most one upsert per 2.5s of continuous typing; sending retracts the row (the line exists — "typing" is no longer true), as does leaving the room or the screen (an echo of typing with nobody at the keyboard is a lie the next occupant pays for). Who-is-typing refetches on the same realtime ping as everything else (one channel now carries three tables), plus a 5s interval for poll-mode. Best-effort throughout — a failed glance shows nobody typing; the next ping retells it.
- **The typing row**: sits above the composer in a fixed-height slot so its arrival never shifts the input under you; single name ("Front of House is typing…"), two names, or an honest count ("3 teammates are typing…"); `aria-live="polite"` with the full label.

### Verified
- E2E (real UI): a DB probe + heartbeat script played the teammate — "Front of House is typing…" appeared over the socket while the heartbeat ran, and disappeared when the heart stopped (the stale row proved `fresh: false` in the DB — the 6s window doing exactly its job). The owner's own keystrokes upserted a fresh row (DB-verified), and pressing Enter sent the line AND retracted the typing row in the same breath (zero rows remain for the typist). 13/13 screens, 0 console errors, tsc 0.
- DB truth: probe deleted, zero typing rows remain, 034 intact (shape + publication + policy), chat at the honest 5 lines (4 prior + this round's QA-tagged UI-sent line), 3 true bells untouched, watermarks unchanged at 2.

## [5.44.0] — 2026-10-03 — The report walks you there: every live count earns its door

### Added — the EOD "Right now" strip opens doors; a door can carry CONTEXT (no migration — pure UI truth)
- Deep-read of the EOD screen found 5.42.0's exact asymmetry living one screen over: the "Right now" strip honestly reported "2 tickets in the kitchen / ₹420 unpaid / 2 late preps" — and then left you to walk yourself. Numbers that announce a room should open it. All three live pills now earn a door **only when their count is real** (>0 — zero means zero, the same honest-hiding rule as the notification filter chips):
  - **In the kitchen** → "Open Kitchen" walks to the KDS.
  - **Unpaid right now** → "Open Bills" walks to Bills **carrying its context**: the new one-shot `sectionHint` channel (zustand, consumed once on arrival, never persisted, never on the URL) lands Bills **pre-filtered to money still out** (statusFilter 'active'). The arrival IS the context.
  - **Late prep** → "Open Kitchen" with the SLA restated in the door's aria-label ("past the 10-minute SLA; oldest waits first" — the KDS's amber/red escalation is the late language, no fake filter invented).
- **Reports "How money arrived"**: the Unpaid row (red dot, ₹ still out, × count) now ends in its own "Open Bills" door — same hint, same landing. The report no longer just measures the hole; it walks you to it.
- **Honest origin breadcrumbs**: a door writes its true origin ('Close-out › Bills' / 'Reports › Bills') via goSection's breadcrumb; Bills' mount-time breadcrumb default ('Bills › Payment History') now stands down when a door brought you. E2E caught the first version clobbering the Reports door's origin with a hardcoded 'Close-out' — fixed to "never clobber what the door wrote".
- Door pill aria-labels carry the honest numbers ("Open Bills — 2 unpaid tickets, ₹420.00 still out"), so the door tells you what waits before you tap.

### Fixed — stale push-tracking lesson (bookkeeping, not code)
- `git status -sb` reported "[ahead 13]" for five rounds: pushes had succeeded all along, but pushing to a URL (not the remote name) never updates the local `origin/main` tracking ref. `git fetch origin` snapped it back to truth (origin/main = 5.43.0). Push verification now goes through fetch, not the tracking ref.

### Styling — the door grammar extends to the counter
- Doors reuse 5.42.0's notification-door grammar exactly: deep-teal `#0F3D3E` on a 5% teal wash, ArrowRight glyph, hover 10%, gold `#B88E2F` focus ring — plus a 0.96 active-press scale, so the pill physically yields under the tap.
- **A filter that is DOING something wears it**: Bills' status/date selects switch from the white pill to an amber-wash, gold-border active pill (`#FDF6E3` on `#B88E2F`, amber-ink text) the moment they're not 'all' — the gold family is this app's one grammar for "needs attention", and a door-landed filter is exactly that. A round gold ✕ button appears beside the filters to clear them in one tap, and retires itself when everything is 'all' again.

### Verified
- E2E (real UI): fixture staged ONE today ticket (preparing + unpaid + created 12 min ago) that lights all three doors at once — zero side effects proven at stage time (INSERT fires none of the orders triggers that matter: deduction is UPDATE-only, table_id NULL skips the table-sync, no phone skips the customer-touch). All three doors rendered with honest counts (1 ticket / 1 · ₹210.00 / 1 over 10 min) → "Open Bills" landed on Bills, select value 'active', gold active pill, breadcrumb 'Close-out › Bills' → "Open Kitchen" landed on the KDS with the probe on the board → Reports' Unpaid row door landed with breadcrumb 'Reports › Bills' → the ✕ cleared filters back to white pills and retired itself. 13/13 screens, 0 console errors, tsc 0.
- DB truth: probe deleted (idempotent truth script — first pass deleted it before crashing on a wrong table name), zero ledger/customer/status-history/payments residue, the 3 true bells untouched (all read, all doored), chat lines unchanged at 4, orders back to the pre-round operator history. Cloud state honest.

## [5.43.0] — 2026-10-03 — The unread line: the staff line learns who's behind

### Added — per-user read watermarks, room badges, the "Unread messages" divider (migration 033)
- 5.41.0's staff line talked, but nothing told you WHO it talked to: a room with fresh chatter read exactly like one you'd caught up on, because 004 shipped **no per-user read state at all** — no members table, no watermark — so "unread" was unknowable. Migration `033_conversation_reads.sql`:
  - `conversation_reads (conversation_id, user_email) → last_read_at`, composite PK (one row per reader per room, upserted on open and on every live refresh while the room stays open). Keys on **user_email** (the auth identity), never sender_name (a display label two teammates could share). `tenant_id` denormalized for the 004-shaped RLS policy (tenant member + active role, USING + WITH CHECK).
  - `fn_conversation_unread(p_tenant, p_email, p_sender_name)` — SECURITY INVOKER RPC (the caller's own RLS guards both tables): messages newer than my watermark AND not mine, per room. Rooms with zero unread return no row.
  - Deliberate: conversation_reads stays OFF the realtime publication — the badge is DERIVED, not announced. A new line already pings 031's publication; the rooms list recomputes counts from this table on that ping. Publishing read-watermarks would leak every teammate's reading habits onto the socket for zero UI need.
  - Applied via `scripts/apply-033.mjs` — five proofs green incl. a rollback probe (fresh watermark inserts, a second upsert ON CONFLICT updates the SAME row — PK holds; ROLLBACK, zero residue).
- **Rooms list**: gold badge pill on each fresh room's avatar (border-2 white ring, tabular-nums, 99+ cap), room name and preview bolden while unread, honest `aria-label` ("Front of House, 1 unread"). Counts ride every rooms refresh — realtime ping, 30s poll, tenant retry — best-effort by design: a failed count shows no badge, never a broken list.
- **The room you open is, by definition, read**: a successful thread load upserts the watermark; the badge recount rides along. Proven live — badge appeared the instant a teammate's line landed (realtime), vanished the moment the room opened.
- **The round's namesake — the "Unread messages" divider**: a gold rule in the thread marking where caught-up ended. Its boundary is MY WATERMARK AS IT STOOD at room-open (never read → epoch, so the whole backlog is the fresh side); captured once per open, never moved by watermark refreshes, recaptured on room switch. Lines arriving while you watch the room stay below it — you're there.

### Fixed — E2E self-race (honesty of the choreography, not the code)
- The first divider E2E consumed itself: the probe line landed 0.5s before the freshly-loaded page's initial markRead, so the badge was wiped before it could be seen. Server truth (RPC = 0, watermark 0.5s ahead of the probe) proved the system was RIGHT and the choreography wrong. Fix: open the OTHER room first, then let the probe land, then walk over. The two raced probe lines were deleted (superseded mid-E2E, plain DELETE of my own QA chatter — no fiction left behind).

### Styling — the unread language
- Badge pill: gold `#B88E2F` with a 2px white ring floating on the avatar's top-right corner — the same gold the notifications badge speaks, one visual grammar for "fresh".
- Unread room rows: name `font-bold`, preview `font-medium` deep-ink (vs. the caught-up gray), so the whole row reads heavier before you enter it.
- UnreadDivider: hairline rules in `#B88E2F/40` framing an amber-wash pill (`#F3E8CF` on `#8A5A00`, uppercase tracking-wide) — louder than a day divider, quieter than a banner.

### Verified
- `tsc` 0 after every edit. **E2E through the real UI** (`scripts/qa82-unread.png`): probe line inserted server-side while Kitchen was open → FOH badge "1 unread" appeared LIVE over realtime → click FOH → the gold divider sat exactly above the probe line (Today → my round-80 line 10:16 pm → UNREAD MESSAGES → probe 10:49 pm) → badge aria back to plain "Front of House" → UI reply via Enter landed below. **DB truth** (`scripts/qa82-unread.mjs`): exactly 4 chat lines (2 from round 80 + tagged probe + UI reply), owner watermarks on both rooms, RPC says zero unread, FOH watermark advanced past the probe, raced probes deleted. 13/13 screens land, 0 page errors. sw `5.43.0-r1`.

## [5.42.0] — 2026-10-03 — The bell's door opens: every ring walks to its source

### Added — notification tap-through, mark-one-read, honest category filters (migration 032)
- 5.40.0 made the bell ring; 5.42.0 gives every ring a **door**. A bell announcing "Coffee beans is under its line" that leaves the owner to find Inventory by hand was half the courtesy. Migration `032_notification_links.sql`:
  - `notifications.link_to TEXT` (nullable, no CHECK whitelist — the client admits a slug only if it names a real section via `Object.hasOwn(SECTION_LABELS, …)` and renders no button otherwise; an unknown door is no door, honestly hidden).
  - The three 030 generators recreated to stamp their doors: low stock `system` → **inventory** (the shelf that crossed), low rating `feedback` → **bills** (the ticket that took the stars), today's booking `reminder` → **floor** (the book that holds the promise). `promotion`/`message` stay doorless by design (no writer rings them; the staff line has its own surface).
  - Honest backfill: the bells already on record (round 79's true system + reminder rows) got their true doors — the triggers that wrote them are known, the doors are not a guess.
  - Deliberate: no RLS change (plain column, 004's member_all covers it), no realtime change (notifications already published — and an `is_read` UPDATE rides the same channels, which is how the header badge recounts for free).
  - Applied via `scripts/apply-032.mjs` — six proofs green incl. a live rollback probe (a real crossing rang **with** `link_to='inventory'`, a real today-booking rang **with** `link_to='floor'`, then ROLLBACK left zero residue). One probe lesson en route: composing the booking slot as a naive timestamp got interpreted in the session timezone (UTC) and landed **tomorrow in IST** — the trigger stayed silent by design; fixed by composing with `AT TIME ZONE 'Asia/Kolkata'`.
- **Mark one read**: `markNotificationRead(id)` (row-scoped UPDATE under 004 RLS). Each unread card carries its own "Mark read" chip — optimistic flip, silent refetch, revert + honest banner on refusal. The realtime UPDATE ping recounts the header badge for free (proven live: "1 unread" → "no unread" with no reload).
- **Honest category filters**: a chip row (All / System / Reminder…) where a chip exists **only** if at least one bell of that category is on record, with the true count (tabular-nums). No chip is ever a dead end; a filter that somehow empties renders an honest dashed "Nothing under this filter right now."

### Styling — the door affordances
- "Open Inventory / Open Floor / Open Bills" pill on every doored card (`#0F3D3E` on a 5% teal wash, `ArrowRight` glyph, hover deepens to 10%, gold focus ring) — the bell tells you **where** it opens before you tap.
- "Mark read" ghost chip on unread cards only (white surface, gray text; hover turns gold `#B88E2F` border + amber text — the unread color family calling back).
- Filter chips: active = deep-teal fill with white text + translucent count; inactive = white surface, gray border, hover wash; `transition-colors` throughout; `aria-pressed` truth on every chip.

### Verified
- `tsc` 0 after every edit. **E2E through the real UI** (`scripts/qa81-door.png`): fresh unread bell rung live by a config-only line crossing (stock 4,880 g, line raised to 4,885 g — no stock moves, no diary rows; the 5.40.0 round already proved the waste path) → card landed over realtime with gold border + both chips → Mark read flipped the card and recounted the badge live ("1 unread" → "no unread") → "Open Inventory" walked straight to the shelves → back, Reminder chip filtered to exactly the booking card, All restored all three. **DB truth** (`scripts/qa81-door.mjs`): exactly 3 bells, all read, all doors point at their true sources, zero blind bells anywhere, line restored to 500 with zero stock drift, zero probe residue. 13/13 screens land, 0 page errors. sw `5.42.0-r1`.

## [5.41.0] — 2026-10-03 — The staff line: 004's other half, finally built

### Added — team messages (the Messages surface, migration 031)
- Migration 004 was titled "Notifications & Messages" and built BOTH halves — but only notifications ever got a screen. The team-chat backend (conversations + conversation_messages, RLS'd, seeded per-tenant "Front of House" and "Kitchen" rooms) and even the API layer (`fetchConversations`/`fetchMessages`/`sendMessage`) have existed since the first build with **zero UI consumers** — the staff line lived only as tables in the dark. 5.41.0 builds the visible half:
  - **Two-pane chat**: rooms on the left (avatar chip tinted by a deterministic name-hash, name, server-stamped preview, relative time; active room carries the gold border), the thread on the right (room header with the 004 member list, day dividers — Today / Yesterday / date — and name-attributed bubbles: mine deep-teal right-aligned, others white left-aligned with the sender's name). Phones get the room→thread swap with a back button. Enter sends; Shift+Enter breaks a line; the composer disables while sending and shows honest errors.
  - **Migration `031_message_line.sql`**: both chat tables join `supabase_realtime` (a sent line lands on every signed-in terminal instantly), and a new AFTER INSERT trigger stamps the parent conversation's `last_message`/`last_message_at` with `clock_timestamp()` — the 004 schema keeps the preview ON the conversation row, so the list never joins or re-sorts client-side and the stamp is server truth. The seeded rooms ship with NULL previews; the UI reads that honestly as "No messages yet". Applied with three proofs (trigger on duty, publication updated, rollback probe proving the stamp) + zero residue.
  - **Deliberate**: a chat message does NOT ring the notifications bell — the Messages screen is its own delivery surface with its own realtime channel; duplicating every line into Notifications would make the bell noise.
- Sidebar grows **Messages** under OTHERS (before Notifications), deep-linkable at `/messages`; the screen joins the sweep (now 13 deep links).

### Changed — layout hardening found during the build
- `md:flex` proved unreliable in the current Tailwind build (verified absent from the generated CSS while sibling utilities generated — checked in-browser with a recursive stylesheet walk). The two-pane layout ships on **verified-generated** utilities only: `md:grid-cols-3` + `md:col-span-2` + `md:block`, with inner flex wrappers carrying the structure. Comment in the source records why.
- **[Styling]** the thread's day dividers (hairline + centered label), the deterministic avatar-tone system (sage/amber/teal-wash/gold-wash/rose-wash by name hash — stable across sessions so "Kitchen" always looks like Kitchen), mine-vs-theirs bubble geometry (rounded-br-md vs rounded-bl-md tails), and the honest composer states (gold send, disabled-when-empty, spinner while sending).

### Verified
- `tsc` 0 after every edit. **E2E through the real UI** (`scripts/qa80-messages-empty.png`, `qa80-foh-thread.png`): rooms list honest at "No messages yet" → FOH line typed + sent via button → bubble under "Today" divider, room preview updated live (server-stamped via the 031 trigger, realtime pinged) → Kitchen line sent via **Enter key** → switch back, thread persists, mine-bubble right-aligned (computed `flex-end`). **DB truth** (`scripts/qa80-line.mjs`): exactly 2 messages (sender "QR Owner", QA-tagged bodies), both rooms' previews stamped server-side with matching bodies, both tables published. 13/13 screens land, 0 page errors. sw `5.41.0-r1`.

## [5.40.0] — 2026-10-03 — The bell actually rings

### Added — notification generators (migration 030)
- The notifications screen (004) has stood ready since the first build — cards, categories, mark-all-read — but **nothing ever wrote to it**: no trigger, no app-side insert. "Reminders and system alerts will appear here as they happen" was an eternal empty state, and the header's gold dot was a static decoration claiming unread state the DB never backed. Migration `030_notification_bells.sql` wires the bell to three events the ledger already records, each **best-effort** (a bell failure can never break the ledger write it announces):
  - **Low stock** (`system`) — fires on the *crossing*: `inventory_items` moving from above its reorder line to at-or-under it (AFTER UPDATE, OLD > line, NEW <= line). Staying below never re-fires (no nagging), restocks stay silent, and a shelf that runs dry with no line set still crosses at zero — a stockout is news with or without a policy.
  - **Low rating** (`feedback`) — a guest's `order_feedback` INSERT at ≤ 2★ rings immediately (service recovery only works the same hour); the ticket number and the guest's own words ride along.
  - **Today's booking** (`reminder`) — a `reservations` INSERT whose slot falls on *today, IST* (the house timezone, no DST, exact math) pings the floor: hour, table (or "table open"), phone, note. Future dates stay on the book; only the ones that matter before lunch ring.
- Realtime: `notifications` joined `supabase_realtime`, so the ring is heard live on every terminal. Applied with six proofs — three triggers on duty, publication updated, and **rollback probes** for each wire (crossing rang / 2★ rang / today-booking rang / tomorrow-booking stayed silent) plus a zero-residue check: no probe committed a single row, so no guest fiction exists.

### Fixed — the channel collision found live
- The first E2E hit the error boundary on `/notifications`: the header badge and the screen both subscribed to the **same channel name**, and supabase-js dedupes channels by name — adding `postgres_changes` callbacks after `subscribe()` throws. Every consumer now rides its own scoped channel (`badge` / `list`).

### Changed — the badge tells the truth
- The header bell's static gold dot is gone. The badge now counts **real unread notifications** — fetched on mount, refreshed on every realtime ring and a 30s safety poll, capped at "99+", and **quiet when zero** (a badge that never sleeps is a badge nobody reads). aria-label reads the count honestly ("Notifications, 2 unread" / "no unread").
- The notifications screen subscribes to its own realtime channel (silent refetches — no skeleton flash on poll) with a **Live/Poll** chip saying which transport is running, and the empty state now describes what actually rings the bell.
- **[Styling] category-tinted chips**: icon chips now speak the category's language — amber for system (something needs ordering), red for feedback (a guest is unhappy), sage for reminder (the house clock), gold for promotion — saturated on unread, calm gray-tinted on read, so the eye triages a stack of cards before reading a single title.

### Verified
- `tsc` 0 after every edit. **E2E through the real UI** (`scripts/qa79-bell.png`): temporarily raised Coffee beans' reorder line to 4,875 g (config, restored after) → WasteDialog 10 g → card honest at 4,870 g, diary row on record, badge 1 unread; Floor "Take a booking" (Dev Patil ×2, T1, 7:30 pm today) → badge 2 unread, reminder card "7:30 pm — T1 — 97660 11223" — both rings **live over realtime, no reload**. Restock +10 g rang nothing (upward moves don't cross). Mark all read → badge honestly "no unread", button disabled. **DB truth** (`scripts/qa79-bell.mjs`): exactly 2 notification rows with true bodies, both read; shelf netted to 4,880 g with the line restored to 500; diary −10/+10 net zero; booking cancelled (reminder stays as history); `order_feedback` still 3 — the 2★ wire was proven by rollback probe, zero fiction. 12/12 screens land, 0 page errors. sw `5.40.0-r1`.

## [5.39.0] — 2026-10-03 — Fire as you go: the pass learns to tick

### Added — KDS item check-off (migration 029)
- The pass showed the cook WHAT to make, but not WHAT'S DONE — a four-line ticket during a rush lived in the cook's head. Every line on a **live** KDS card is now a checkbox (migration `029_order_item_checks.sql` adds `order_items.checked_at TIMESTAMPTZ` — a timestamp, not a boolean, because *when* it fired matters as much as whether). Tap when it drops: the qty chip flips to a green check, the line strikes through, and the card's **fired-fraction bar** counts the ticket down ("fired 1/2", teal fill → green at the end). When the last line fires the card crowns an **ALL FIRED** chip. Tap again to put a line back on the rail — the book forgives a mis-tap.
- **Server truth, two layers**: the tick rides plain RLS-scoped CRUD (order_items' "Tenant full access" policy from 007 covers it), and a new BEFORE UPDATE trigger refuses any tick on a **cancelled/completed** ticket with `ORDER_NOT_ACTIVE` — no fiction on dead tickets. Applied with three proofs: column type exact, terminal-tick refused (probe rolled back), tick + un-tick on a live ticket pass (probe rolled back) — zero residue.
- **A race found live and fixed**: the first E2E tick was written to the DB, then a 30s-poll refetch that had *started before the commit* landed after the optimistic flip and clobbered it — the UI contradicted the database for one poll cycle. Fix: an in-flight overlay (`pendingTicksRef`) that every refetch applies, so no refetch can ever disagree with a write that is already on its way. Also fixed: `attachItems`' explicit field mapping was silently dropping the new column (found because the tick survived a reload in the DB but not on the board).
- **[Styling] the red tier breathes**: a ticket waiting 20+ minutes (the `waitTone` red tier) now pulses its timer chip — urgency visible from across the kitchen, on top of 5.31's green ready-wash and the card's urgency border. The urgency tone is computed once per card and drives the border, the timer and the pulse together.

### Verified
- `tsc` 0 after every edit. **E2E through the real UI** (`scripts/qa78-kds.png`): order #48's line → tick → checked chip + ALL FIRED + "fired 1/1" → un-tick → back to "fired 0/1" → re-tick → un-tick (full round trip, 0 page errors). The tick persisted across a full page reload mid-E2E (the DB is the truth). **DB truth** (`scripts/qa78-kds.mjs`): column TIMESTAMPTZ present, zero ticked rows in the final honest state, live tickets #48/#66 intact. sw `5.39.0-r1`.

## [5.38.0] — 2026-10-03 — The book: the phone promises, on the record

### Added — reservations (migration 028 + the Floor's booking ledger)
- The floor knew how to hold a table (011's trigger) and how to mark one reserved by hand (5.35.0) — but the PHONE had no ledger. "Saturday 7 pm, party of four, window seat" lived on paper scraps and staff memory. The Floor grows **The book**: one row per promised table, grouped by IST day ("Today · Sat 3 Oct", "Tomorrow", then weekday dates), each row carrying the arrival hour chip, a **×N party chip**, the table chip (or an honest dashed **"table open"** when the host picks at the door), the guest's name, a tappable `tel:` phone link, the note in quotes, and a status chip — gold **Booked**, green **Seated**, red **No-show**, gray struck-through **Cancelled**.
- **Take a booking** (header button + section button) opens a dialog: guest name, optional phone, party size 1–40, IST day + arrival time (slot composed as wall-clock **+05:30** — IST has no DST, so the instant is exact), an optional table picker, and a 280-char note with live count. Picking a table too small for the party shows an amber nudge (*"Party of 7 at T1 (4 seats) — pull chairs over, or split across two tables."*) — honest information, not a block. Past slots are allowed; the book tolerates backfill.
- **The lifecycle is calm and reversible**: one-tap **Seat** (claims a free table as `reserved` — best-effort, the 011 trigger owns everything once an order lands), **No-show**, **Cancel**; every non-booked row offers **Undo seat / Restore**, so a mis-tap is one tap from fixed instead of guarded by confirm arms. Cancelled rows stay on the books, grayed and strikethrough — the ledger remembers. A past-week toggle opens the archive ("Show past week (N)") instead of hiding it.
- **Migration `028_reservations.sql`**: `reservations` table (party 1–40 CHECK, status whitelist, 280-char note CHECK, `table_id ON DELETE SET NULL` so retiring a table never shreds the book), two-policy RLS (016/027 shape), realtime publication, and **two server-truth triggers**: `updated_at` stamped with `clock_timestamp()` (now() freezes at transaction start — the book wants the real wall-clock instant of the write) and `created_by_email` filled from `auth.jwt()` on INSERT (027's RPC lesson, carried into plain CRUD). Applied with five proofs: columns exact, 2 policies, both triggers on duty (probe rolled back, zero residue), realtime published, status CHECK present.

### Changed — the Floor's first paint
- The cold-load spinner is gone. **SkeletonBoard**: the floor's own shape — header, stat tiles, rhythm card, table cards — shimmers into place (`animate-pulse`, `aria-busy`), so the host stand never stares at a blank centred dot.

### Verified
- `tsc` 0 after every edit. **E2E through the real UI** (`scripts/qa77-book.png`): "Take a booking" → Maya Iyer ×4, phone, 7:30 pm today, note "QA round 77 — window seat" → row under "Today · Sat 3 Oct" with Booked chip and "1 still expected today" → **Seat** → Seated chip + Undo seat → **Undo seat** → Booked → **No-show** → No-show chip + Restore → **Restore** → Booked → **Cancel** → Cancelled, grayed, restorable. Party-of-7-at-T1 amber nudge rendered. Console: zero page errors.
- **DB truth** (`scripts/qa77-book.mjs`): exactly 1 reservation — Maya Iyer ×4, phone, 19:30 IST slot, `cancelled`, note and owner email stamped, `updated_at` ahead of `created_at` after the five flips. **Creator-stamp probe with the owner's own JWT** (the browser's exact PostgREST path): insert → `created_by_email` stamped server-side → delete → zero residue. The one pre-fix row (created before the trigger existed) was repaired by backfilling its truthfully-known actor email.
- Realtime: the book rides the floor's ping (own subscription on the 028 publication) + the 30s safety poll. sw `5.38.0-r1`.

## [5.37.0] — 2026-10-03 — Count the shelf: the stocktake closes the loop on the diary

### Added — stocktake (variance → Correction, on the 027 rails)
- The inventory story had three of four authors on the record — deliveries in (5.36.0), waste out (5.36.0), sales deducted by the engine (015) — but the oldest inventory ritual of all, **the weekly count**, still had no path. Stock tab grows a **Count shelf** entry ("4 ingredients on the shelf — every hand move lands in the diary") opening a count panel: every SKU on one row with its **books** quantity beside a blank **counted** input. The variance computes live as a chip — green **+50 surplus**, red **20 short**, gray **even** — and the footer tallies the batch honestly ("2 corrections · 1 even · 1 skipped"). Blank rows skip; exact rows cost nothing; a negative count turns its input red and holds the Apply.
- Apply writes **one correction adjustment per divergent row** through the 5.36.0 `sp_adjust_stock` RPC (row-locked, signed honestly both ways, stamped with the operator's email), with a shared diary note defaulting to "Stocktake — 3 Oct". A mid-batch refusal is reported the honest way: *"1 of 2 corrections landed before the refusal — … The rest are still open; fix and re-apply."* — no silent partials, no fake success.
- Tab pills gained visible keyboard focus rings (gold, `focus-visible` only — mouse clicks stay clean).

### Verified
- `tsc` 0 after every edit. **E2E through the real UI** (`scripts/qa76-stocktake.png`): Butter counted 5,050 → "+50 surplus"; Cheese counted 5,000 → "even"; Coffee beans counted 4,880 → "20 short"; Flour left blank → skipped; summary "2 corrections · 1 even · 1 skipped" → **Apply corrections** → diary top rows "Coffee beans · Correction · 'QA round 76 — tap count' · −20 g" and "Butter · Correction · +50 g", cards honestly at 5,050 / 4,880, stock value re-priced ₹18,809. DB truth (`scripts/qa76-stocktake.mjs`): exactly 2 correction rows, notes and `created_by_email` stamped, books = 5,050 / 4,880. Console: only the known stale-HMR reload lines from the edit session; zero live page errors. sw `5.37.0-r1`.

## [5.36.0] — 2026-10-03 — The shelf keeps its diary: waste on the record, restocks in the ledger, one honest feed

### Added — stock adjustments (migration 027) + the Stock diary
- The deduction engine (015) records stock OUT when tickets fire — but the shelf has more than one author, and the other authors were writing in invisible ink. A **restock** was a client-side read-modify-write (the code comment itself flagged it as un-atomic across terminals) and left no ledger row; **spoilage, spills and breakage had no path at all**. Migration `027_stock_adjustments.sql` adds the hand-made moves table (signed qty — + is stock in, − is stock out; reason; note; who) plus **`sp_adjust_stock`**: a SECURITY DEFINER, tenant-guarded, **row-locked** RPC (`SELECT … FOR UPDATE`) that makes two terminals physically unable to lost-update the shelf, and enforces honest sign-per-reason — deliveries must be positive, waste reasons must be negative, corrections may go either way. Negative stock stays possible (015's precedent — real cafes oversell; the shelf shows it red). RLS in the standard two-policy shape; realtime published; anon EXECUTE revoked (the 020 lesson, baked in from the start).
- Inventory grows a **Waste** button on every ingredient card (between Restock and Edit, gold hover). Its dialog takes the amount that left, a reason segmented control (Spoiled / Spilled / Damaged / Correction), an optional note, and previews the new level — honestly red with "below zero; the shelf shows it red (real cafes oversell)" when the count would go under. Server refusals surface as human lines that name the rule (`BAD_REASON`, `WASTE_MUST_BE_NEGATIVE`…), not raw codes.
- The "Recent deductions" feed is now the **Stock diary**: one feed, two ledgers — the engine's ticket deductions and the hand-made adjustments merged newest-first, each row carrying a reason chip (green **Delivery**, gold **Spoiled/Spilled/Damaged/Correction**, teal **Ticket**), signed colored quantities (+green / −red tickets / −gold waste), the note in italics, and an honest empty state ("Nothing has moved yet…"). The feed renders even before the first move — the diary exists from day one, not from the first deduction.
- **Restock moved onto the same RPC** (reason `delivery`): the old race is gone and every delivery now lands in the diary. Realtime subscription covers `stock_adjustments`, so the board still moves live.

### Verified
- Migration proofs (5): exact columns, exactly two policies, RPC present with anon EXECUTE revoked, realtime published, and a no-JWT call refused (`NOT_A_MEMBER` — the tenant gate precedes arg checks on a raw connection). **JWT guard probes as the owner** (`scripts/qa75-diary.mjs`): bad reason → `BAD_REASON`; delivery with −10 → `DELIVERY_MUST_BE_POSITIVE`; spoilage with +10 → `WASTE_MUST_BE_NEGATIVE`; foreign ingredient id → `NOT_FOUND`. All refusals — nothing written. **E2E through the real UI** (`qa75-stock-diary.png`): Waste on Coffee beans → 50 g Spilled with note → diary row "Spilled · 'QA round 75 — spill tap test' · −50 g", shelf 4,900 → 4,850 → Restock 50 g → diary row "Delivery · +50 g", shelf honestly back to 4,900 (**net zero**). DB truth: exactly 2 adjustment rows, `created_by_email` stamped with the operator's address. `tsc` 0 after every edit; zero page errors. sw `5.36.0-r1`.

## [5.35.0] — 2026-10-03 — The floor can be rearranged: table edit & retire, and reserved turns gold

### Added — table management on the drill panel (Edit + Remove)
- The floor could only grow: **Add table** existed, but renaming a table, changing its seat count or moving it to another section, and retiring a table entirely, all needed the database. The table drill panel now carries a management row — **Edit** opens the (now shared) table dialog prefilled with the table's current number, seats and section and saves through an honest duplicate check that mirrors the 001 digit-matcher (same text or same digits under a different dressing — `T3` vs `Patio-3` is refused with the clashing table's name). **Remove** retires an idle table behind the same two-step arm discipline as the bulk cut and Bills cancel (3s self-disarm).
- The Remove guard is honest about why: a table that still holds an order or a reservation shows *disabled* Remove with "Seat or clear the table before removing it"; an idle one reads "Idle table — safe to retire"; the armed confirm names the consequences — "Orders keep their amounts; this table's QR links stop working."
- The schema carries the history: orders that referenced a removed table keep their amounts with `table_id` SET NULL (001), and the table's guest QR sessions die with it (002 CASCADE). Both proven live: #106 cancelled → table auto-released by the 011 trigger → removed → order intact with `table_id: null`, 0 orphan sessions.

### Improved — reserved wears the gold (styling detail)
- Reserved tables were visually teal — same family as available — while their CTA and panel icon had already gone gold in 5.31. The reserved identity is now one color everywhere: the card's left border and status-chip dot, the panel's armchair icon and the "Seat reserved guests" CTA all read **DS gold `#B88E2F`**. A reserved table now catches the eye across the floor exactly the way its CTA already did.

### Verified
- `tsc` 0 after every edit; zero page errors. **Full live journey** (no DB staging — every step through the real UI): created T3 via Add table → Reserve → drill panel → **"Seat reserved guests — start ticket on T3"** (the parked CTA test from Tasks 67–71) landed on Food & Drinks with the cart chip "T3 · 4 guests" (capacity pre-filled) → 1 × Flat White via the item dialog → Place order → **#106 placed** → floor showed OCCUPIED 3 with T3 held by the 011 trigger → Bills two-step Cancel → T3 honestly released. Then the new tools: Edit (seats 4→2, section → Patio, verified on the card), duplicate guard (`T1` refused), Remove disabled-while-reserved → enabled-when-idle → confirm → floor back to T1/T2 with AVAILABLE 0 · OCCUPIED 2. DB integrity: #106 cancelled with `table_id: null`, 0 orphan sessions, screenshot `scripts/qa74-floor-managed.png`. Also chased and cleared a false alarm: Bills' "20:32" on #106 is browser-UTC rendering of a 02:02 IST order (headless Chrome runs UTC; EOD/CSV use IST by design). Found a **QA leftover from an earlier round**: order #67 (customer note "offer-path sanity after 022") still sits active-unpaid in the ledger — flagged for the owner, not silently deleted. sw `5.35.0-r1`.

## [5.34.0] — 2026-10-03 — The day, exported: Close-out wears its h1 and hands the ledger to the spreadsheet

### Added — day-ledger CSV export (Close-out header, beside Print z-report)
- The z-report was print-only; the accountant's copy is usually a spreadsheet. Close-out grows a **CSV** button (white/hairline secondary against the gold Print, same honest disabled-when-empty guard): one row per ticket, **exactly the loaded day's ledger** — ticket #, time IST, type, status, payment status, method, customer, total, tax, COGS — written through the shared 5.8.0 export (OWASP formula-injection neutralization + UTF-8 BOM, so `₹` and any pasted-in `=HYPERLINK()` survive the trip to Excel/Sheets as text).
- Honest joins, not inventions: split payments travel as their distinct methods joined (`cash + upi`); COGS rides along from the 018 view (un-mapped items show the view's own 0 — never a fabricated margin); an order with no payment rows falls back to its `payment_method`. Filename `servepoint-closeout-<date>.csv` follows the date you're viewing, so back-dating the stepper back-dates the export.

### Improved — Close-out wears its h1 (styling/semantics detail)
- A full-screen sweep found Close-out was the **only screen without an `<h1>`** (ten of eleven screens have one; EOD jumped straight to `h2` section headings). It now wears the standard head — MoonStar tile, `Close-out` h1, "The day, counted — sales, drawer and the z-report" subtitle — matching Reports' header pattern, so the heading hierarchy, screen readers and tab order all read like every other screen.

### Verified
- `tsc` 0 after every edit; zero page errors. **E2E with staged fixtures** (`scripts/qa73-eod-fixture.mjs`, tagged `eod-fixture`): #104 dine-in cash 231 (220 + 5% GST = 11 tax) and #105 takeaway 462 split across cash + UPI — clicked the real button, agent-browser saved the download, and the file parsed back exact: header, both rows, correct type labels (Dine-in/Takeaway), the split join (`upi + cash`), and BOM-prefixed cells. Cleanup honest: 0 tagged rows, 0 orphan payments, and after the 30s safety poll the CSV button returned to its disabled empty-day state (`qa73-eod-header.png`). sw `5.34.0-r1`.

## [5.33.0] — 2026-10-03 — The logo comes from your own file: Storage-backed brand upload

### Added — upload the café logo from this device (Settings → Café brand, migration 026)
- Owners no longer need somewhere on the web to host a logo: the Café brand section grows **"Or upload from this device"** — pick a PNG/JPEG/WebP/AVIF/SVG up to 1 MB, and the file lands in the new `tenant-logos` storage bucket (migration 026: public read, `file_size_limit` 1 MiB, image-mime allowlist), its public URL **auto-saves into the same `logo_url` field**, and the preview/Saved chip confirm it. The previous *uploaded* logo is retired best-effort on replacement so the folder doesn't silt up. Paste-a-URL stays untouched beside it for logos that already live on the web.
- **Security posture** (migration 026, four policies): the bucket is public-READ (guest phones render the logo with no session) but write-scoped per operator — each authenticated user may upload/update/delete ONLY inside their own `tenant-logos/<auth.uid()>/` folder; cross-folder writes are refused by RLS, non-image mimes by the bucket guard. The client walks the same path the browser does: anon key + the operator's own JWT.
- Upload failures are honest and specific: an oversized file says its size, an RLS/mime/storage refusal surfaces the server's own message — never a fake success.

### Verified
- `tsc` 0 after every edit; zero page errors. Migration applied via `scripts/apply-026.mjs` with three proofs (bucket public + 1 MiB + 5 mime types; exactly the 4 policies; `tenants.logo_url` undrifted). **Browser E2E**: agent-browser drove a real file upload (`scripts/qa72-brand-upload.png`) — preview loaded, DB `logo_url` = the storage public URL, exactly one object in the owner's user-id folder, public fetch `200 image/png` with no session, and the KDS header tile (5.31) rendered the uploaded logo. **Policy tests as the owner's JWT** (`scripts/qa72-storage-policy.mjs`): cross-folder upload with an allowed mime → refused by RLS; text mime → refused by the bucket guard; own-folder delete → succeeded. Cleanup honest: the test object removed, the tenant logo restored to its original URL through the real UI (paste + Save re-exercised), 0 storage objects remain. sw `5.33.0-r1`.

## [5.32.0] — 2026-10-03 — The URL tells the truth: staff deep links + the honest tab title

### Added — every staff screen is deep-linkable (`/:slug/:screen`)
- Opening `/coolkafe/floor`, `/kitchen`, `/coolkafe/bills`… now boots straight into that screen instead of silently falling back to the Dashboard (the watch item first recorded in the Task 66 round, closed). `CafeApp` reads the path **once** on mount — same read-once philosophy as the public router — and if the screen segment names a real section (the sidebar's own `SECTION_LABELS` map is the single source of truth), it navigates there with the proper breadcrumb. The slug stays decorative: the signed-in session already decides the workspace. Unknown or missing screen → Dashboard, byte-for-byte unchanged. Built for the real use cases: bookmarks, staff shortcuts, and pinned wall displays — especially the KDS (`/coolkafe/kitchen` on a kitchen tablet now just works). In-app navigation keeps the URL where it is (pre-existing behavior: sections are app state, not routes).
- The full bookmark journey verified E2E: signed-out → open `/coolkafe/floor` → login gate → sign in → **lands directly on Floor** (the deep link survives auth because the effect lives on CafeApp's mount).

### Added — the tab strip tells the truth (document.title sync)
- The browser tab title now follows the active screen: `Floor · ServePoint`, `Kitchen · ServePoint`, `Bills · ServePoint`… so multi-tab operators and pinned displays read at a glance. The sign-in gate is honest too: a signed-out tab reads `Sign in · ServePoint` instead of a stale screen name.

### Improved — keyboard focus you can see on the rail (styling/a11y detail)
- Sidebar nav pills gain a DS-aligned focus-visible ring (gold `#B88E2F` at 70%, offset against the teal-900 rail) — keyboard operators (and the POS's tablet keyboards) can now see where focus sits on the primary navigation. Zero visual change for mouse/touch users.

### Verified
- `tsc` 0 after every edit; zero page errors. E2E in agent-browser: `/coolkafe/floor` → Floor (h1 + breadcrumb + title all "Floor"); `/coolkafe/nonsense` → Dashboard fallback unchanged; `/kitchen` single-segment form works; in-app sidebar nav still works and re-syncs the title; signed-out bookmark journey lands on Floor after sign-in; auth gate title honest. sw `5.32.0-r1`.

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
