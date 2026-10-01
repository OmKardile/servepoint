# TableSide Platform OS (TSOS) — Universal Design System & UX Specification

> **Document Classification:** Comprehensive System Specification & Design Blueprint  
> **Version:** 2.0.0 (Enterprise Multi-Tenant SaaS & Native Ecosystem)  
> **Archetype:** Warm Bakery, Specialty Cafe & Fast-Casual Hospitality POS  
> **Target Ecosystem:** Web POS, Kitchen Display System (KDS), Customer QR Mobile Web, Self-Service Kiosk, Waiter Companion, SuperAdmin SaaS Control, Android (Jetpack Compose), and Windows Desktop (.NET 9 WPF).

---

## 1. Executive Summary & Design Philosophy

Hospitality point-of-sale and table ordering systems operate under the most unforgiving real-world conditions: blinding ambient sunlight on outdoor patios, steam and dim lighting in busy kitchens, rushed line queues during morning rushes, greasy or wet fingers on touchscreens, and distracted diners scanning QR codes while talking.

The **TableSide Platform OS (TSOS)** design philosophy rejects "generic SaaS aesthetics" and "AI slop" (such as meaningless purple gradients, neon glowing borders, ungrounded glassmorphism, or nested card mazes). Instead, it implements an intentional, high-craft, optically calibrated design language engineered specifically for hospitality speed, ergonomic precision, and sensory warmth.

### Core Principles

1. **Warm Human Hospitality (Not Cold Tech Enterprise):**
   Coffee shops and dining spaces are warm, tactile, and communal. Our neutral palette is built from warm espresso, unbleached flour, baked terracotta, and soft stone (<5% HSB saturation), avoiding sterile bluish grays and ungrounded harsh pure whites.
2. **Speed-of-Thought Ergonomics:**
   Cashiers and baristas must execute orders in under 12 seconds. Touch targets never fall below 44px (minimum 56px on POS screens), key numeric touchpads mimic physical mechanical calculators, and primary actions sit within direct reach of primary thumb and index trajectories.
3. **Zero Ambiguity Under Pressure:**
   Status indicators (Unpaid, Preparing, Ready, Delivered, Voided) use universally recognizable chroma pairs with high WCAG AA/AAA contrast ratios. Kitchen staff can read a ticket state from 6–8 feet away across a crowded line.
4. **Mathematical and Spatial Discipline:**
   Every margin, padding, border-radius, line-height, and step scale conforms to an unyielding 4px/8px rhythm and calculated nested radius geometry ($R_{\text{inner}} = R_{\text{outer}} - \text{Padding}$).
5. **Contextual Dual-Theme Engine (Light & Dark by Role):**
   Front-of-house (POS, Customer QR, Admin) defaults to a serene, high-contrast warm cream light mode. Back-of-house (KDS, Barista monitors, Low-light night operations) shifts into an ultra-high-contrast warm obsidian dark mode engineered to eliminate screen glare and eye fatigue.

---

## 2. Complete Dual-Theme Color System (Light & Dark Mode)

### 2.1 Light Theme: "Warm Bakery & Artisan Cafe"
Designed for high ambient light, outdoor patios, customer mobile phones, and cashier POS counters.

| Token Key | Hex Value | HSL | Contrast vs Surface | Semantic Purpose & Usage |
| :--- | :--- | :--- | :--- | :--- |
| `--tsos-bg` | `#FFF9F2` | `33°, 100%, 97%` | N/A (Canvas) | Page canvas, outer viewport, subtle warmth |
| `--tsos-surface` | `#FFFFFF` | `0°, 0%, 100%` | Baseline (1.00) | Primary cards, modals, checkout drawer, receipt panels |
| `--tsos-surface-secondary`| `#F5F0EB` | `30°, 24%, 94%` | 1.15:1 | Hover states, tab backgrounds, table cell alternating fills |
| `--tsos-divider` | `#E9E0D6` | `32°, 28%, 88%` | 1.30:1 | 1px clean hairline borders, card dividers, table grids |
| `--tsos-action` | `#F97316` | `24°, 95%, 53%` | 3.40:1 (Large text) | Primary CTA buttons, active radio highlights, Pay button |
| `--tsos-action-hover` | `#EA580C` | `21°, 90%, 48%` | 4.60:1 | Button hover & active pressed feedback states |
| `--tsos-action-soft` | `#FFF1E6` | `26°, 100%, 95%`| 1.12:1 | Category pill active backgrounds, selected item highlight |
| `--tsos-completed` | `#17803D` | `142°, 70%, 29%`| 4.85:1 (WCAG AA) | Paid orders, delivered status, success notifications, sync OK |
| `--tsos-completed-soft` | `#E8F5EC` | `137°, 36%, 94%`| 1.14:1 | Paid badge background, positive inventory delta pill |
| `--tsos-attention` | `#B45309` | `26°, 91%, 37%` | 4.90:1 (WCAG AA) | Kitchen preparing status, low-stock warning, split bill pend |
| `--tsos-attention-soft` | `#FFF4E5` | `36°, 100%, 95%`| 1.11:1 | Preparing status badge background, warning callout container |
| `--tsos-destructive` | `#B42318` | `4°, 76%, 40%`  | 5.25:1 (WCAG AA) | Void item, cancel order, offline warning, error toast |
| `--tsos-destructive-soft`| `#FEF2F2` | `0°, 86%, 97%`  | 1.08:1 | Cancelled order tag, critical stock depletion banner |
| `--tsos-info` | `#2563EB` | `221°, 83%, 53%`| 4.65:1 (WCAG AA) | Online delivery orders, table transfer dialogs, help hints |
| `--tsos-info-soft` | `#EFF6FF` | `214°, 100%, 97%`| 1.09:1 | Online order badges, platform update indicator |
| `--tsos-accent` | `#7C3AED` | `263°, 70%, 58%`| 4.70:1 (WCAG AA) | SuperAdmin badge, loyalty points, VIP customer tier |
| `--tsos-accent-soft` | `#F5F3FF` | `255°, 100%, 98%`| 1.07:1 | VIP tier badge fill, loyalty reward card backing |
| `--tsos-text-primary` | `#1C1917` | `24°, 10%, 10%` | 15.9:1 (AAA) | Headings, item titles, prices, total bill amount |
| `--tsos-text-secondary` | `#57534E` | `30°, 6%, 33%`  | 7.20:1 (AAA) | Item modifiers, timestamps, table numbers, meta labels |
| `--tsos-text-muted` | `#A8A29E` | `24°, 6%, 64%`  | 4.55:1 (AA) | Placeholders, disabled states, subtle metadata |

---

### 2.2 Dark Theme: "Obsidian Barista & KDS Night Operations"
Engineered for kitchen display monitors (KDS) hanging above fryers/espresso machines, dimly lit speakeasy bars, and night managers. Eliminates phosphor burn-in and optical haloing.

| Token Key | Hex Value | HSL | Contrast vs Dark Canvas | Semantic Purpose & Usage |
| :--- | :--- | :--- | :--- | :--- |
| `--tsos-dark-bg` | `#0C0A09` | `24°, 14%, 4%`  | N/A (Canvas) | Deep warm obsidian canvas, zero light reflection |
| `--tsos-dark-surface` | `#18181B` | `240°, 5%, 10%` | 1.30:1 | Primary KDS tickets, modal cards, terminal containers |
| `--tsos-dark-surface-2` | `#27272A` | `240°, 5%, 16%` | 1.70:1 | Ticket body backgrounds, hovered table cells, nested cards |
| `--tsos-dark-divider` | `#3F3F46` | `240°, 4%, 25%` | 2.50:1 | 1px border lines, card separators, column borders |
| `--tsos-dark-action` | `#FB923C` | `27°, 96%, 61%` | 8.20:1 (AAA) | High-visibility primary touch actions, bump order buttons |
| `--tsos-dark-action-soft`| `#2C1A0E` | `25°, 52%, 12%` | 1.45:1 | Action container backing, active filter pill in dark mode |
| `--tsos-dark-completed` | `#22C55E` | `142°, 71%, 45%`| 8.90:1 (AAA) | Done/Ready order flag, completed ticket border, sync OK |
| `--tsos-dark-completed-soft`| `#052E16` | `144°, 80%, 10%`| 1.35:1 | Completed ticket backdrop, status badge fill |
| `--tsos-dark-attention` | `#F59E0B` | `38°, 92%, 50%` | 9.40:1 (AAA) | Ticket age warning (>10 min), urgent items |
| `--tsos-dark-attention-soft`| `#2D1C03` | `36°, 88%, 9%`  | 1.30:1 | Delayed order flash backing, kitchen timer badge |
| `--tsos-dark-destructive`| `#EF4444` | `0°, 84%, 60%`  | 6.80:1 (AA) | Ticket age critical (>20 min), voided lines, alert banner |
| `--tsos-dark-destructive-soft`| `#300D0D`| `0°, 57%, 12%`  | 1.35:1 | Overdue ticket background flash, emergency alert fill |
| `--tsos-dark-info` | `#3B82F6` | `217°, 91%, 60%`| 7.10:1 (AAA) | Incoming delivery ticket, pickup notification |
| `--tsos-dark-accent` | `#A855F7` | `271°, 91%, 65%`| 7.30:1 (AAA) | VIP diner badge, special chef instructions flag |
| `--tsos-dark-text-primary`| `#FAFAF9` | `60°, 9%, 98%`  | 17.5:1 (AAA) | Ticket numbers, table titles, item quantity badges |
| `--tsos-dark-text-secondary`| `#D6D3D1`| `30°, 7%, 83%`  | 12.0:1 (AAA) | Item modifiers ("Oat milk", "Extra shot"), notes |
| `--tsos-dark-text-muted` | `#78716C` | `25°, 5%, 45%`  | 4.60:1 (AA) | Timestamps, order reference IDs, secondary metadata |

---

### 2.3 Color Theory & Semantic Harmony in Food Service

```
┌────────────────────────────────────────────────────────────────────────┐
│                        THE 60 - 30 - 10 RULE                          │
├─────────────────────────┬──────────────────────────┬──────────────────┤
│ 60% DOMINANT FOUNDATION │ 30% STRUCTURAL SURFACES │ 10% FOCAL ACCENT │
│ Warm Cream / Obsidian   │ Pure White / Carbon Slate│ Terracotta / Gold│
│ Creates calmness and    │ Provides optical clarity │ Drives checkout, │
│ prevents eye strain     │ and organizes content    │ bump, and alerts │
└─────────────────────────┴──────────────────────────┴──────────────────┘
```

1. **Chromotherapy of Food & Beverage:**
   - Terracotta Orange (`#F97316`): Biologically stimulates appetite, warm bakery associations, conveys artisanal warmth without the stressful agitation of pure crimson red.
   - Forest Green (`#17803D`): Evokes organic freshness and unequivocal confirmation that payment or cooking is completed safely.
   - Warm Amber (`#B45309`): Natural baking hue that commands awareness (brewing/baking in progress) without triggering panic.
2. **Strict Ban on "AI Slop" Visual Clichés:**
   - **NO** purple-to-cyan or magenta gradients on buttons.
   - **NO** cold tech grays (`#64748B` slate or `#71717A` zinc without warm undertones in light mode).
   - **NO** pure absolute `#000000` or `#FFFFFF` contrast shocks; use `#1C1917` warm dark and `#FFF9F2` cream to preserve natural human optical softness.
   - **NO** semi-transparent frosted glass (glassmorphism) behind active data tables; food and price data requires 100% opaque reading contrast.

---

## 3. Typography & Mathematical Scaling

### 3.1 Font Family Pairings

| Role | Font Family | Fallback Stack | Purpose & Personality |
| :--- | :--- | :--- | :--- |
| **Display & Headings** | **Plus Jakarta Sans** | `system-ui, -apple-system, sans-serif` | Clean geometric humanist sans with generous x-height, distinct numbers, and warm terminals. |
| **Body & UI Data** | **Inter** | `system-ui, -apple-system, sans-serif` | Highly legible, neutral body font designed specifically for dense UI grids, prices, and forms. |
| **Monospace / Receipts** | **JetBrains Mono** | `'SF Mono', 'Courier New', monospace` | High-contrast tabular numbers for bills, GST calculations, table tokens, and raw ESC/POS thermal tickets. |

### 3.2 Typographic Hierarchy & Scale (Major Second Ratio: 1.125 / Perfect Fourth: 1.333)

| Level | Size (px / rem) | Weight | Line Height | Tracking | Purpose & Usage Example |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Display Hero** | `36px` / `2.25rem` | 800 (ExtraBold) | `1.15` | `-0.025em` | Kiosk welcome screen, total revenue metric |
| **Heading 1 (H1)**| `28px` / `1.75rem` | 700 (Bold) | `1.20` | `-0.02em` | POS Cart total (`₹1,248.00`), Screen titles |
| **Heading 2 (H2)**| `22px` / `1.375rem`| 700 (Bold) | `1.25` | `-0.015em` | Category section headers ("Specialty Brews") |
| **Heading 3 (H3)**| `18px` / `1.125rem`| 600 (SemiBold) | `1.30` | `-0.01em` | Table Card numbers ("Table 04"), Modal titles |
| **Body Large** | `16px` / `1.0rem` | 500 (Medium) | `1.50` | `0em` | Food item title ("Iced Oat Cortado"), Buttons |
| **Body Default** | `14px` / `0.875rem`| 400 (Regular) | `1.50` | `0em` | Descriptions, customer order details, input values |
| **Caption / Meta**| `12px` / `0.75rem` | 500 (Medium) | `1.40` | `+0.01em` | Modifiers ("Extra Shot"), timestamps ("2m ago") |
| **Micro Badge** | `10px` / `0.625rem`| 700 (Bold) | `1.20` | `+0.04em` | Status tags (`PAID`, `VEG`, `KDS BUMP`), SuperAdmin pill |

### 3.3 Strict Typographic Constraints
- **Line Length Rule:** Body text and item descriptions must be capped at 65–75 characters (`max-w-prose` or `max-w-sm`) to prevent reader line jumping.
- **Label Anti-Wrap Rule:** Button text, filter pills, badge labels, and table statuses **MUST NEVER WRAP**. Use `whitespace-nowrap`, adequate horizontal padding, and concise wording (`Split Bill`, not `Split This Customer Bill Into Multiple Parts`).
- **Tabular Figures for Money:** All price columns and currency figures must use CSS `font-variant-numeric: tabular-nums;` to guarantee decimal alignment in receipt totals.

---

## 4. Spacing, Geometry & Spatial Math

### 4.1 The 4px / 8px Modular Spacing System

| Token | Dimension | Tailwind Class | Concrete Layout Application |
| :--- | :--- | :--- | :--- |
| `space-1` | `4px` | `p-1`, `gap-1` | Micro-spacing between icon and button label, badge padding |
| `space-2` | `8px` | `p-2`, `gap-2` | Internal card element grouping, modifier pill spacing |
| `space-3` | `12px` | `p-3`, `gap-3` | Compact POS item grid gap, table header cell padding |
| `space-4` | `16px` | `p-4`, `gap-4` | **Standard container inner padding**, cart item row gap |
| `space-6` | `24px` | `p-6`, `gap-6` | Modal outer padding, POS split-pane column gap |
| `space-8` | `32px` | `p-8`, `gap-8` | Section separation in admin dashboards and kiosk headers |
| `space-12`| `48px` | `p-12`, `gap-12`| Kiosk display borders, onboarding step containers |

### 4.2 Button Padding Math (2:1 Ratio)
Every clickable interactive button strictly maintains an exact **2x horizontal to vertical padding ratio**:
- Compact button (32px height): `px-3 py-1.5` (12px horizontal, 6px vertical)
- Standard button (44px height): `px-4 py-2` or `px-5 py-2.5` (16–20px horizontal, 8–10px vertical)
- Hero CTA / Pay button (54px height): `px-8 py-4` (32px horizontal, 16px vertical)

### 4.3 Nested Border Radius Formula
To eliminate awkward overlapping shapes, when a container with border radius $R_1$ contains a child container with margin/padding $P$, the child's corner radius $R_2$ **must satisfy**:

$$R_{\text{inner}} = R_{\text{outer}} - \text{Padding}$$

```
┌───────────────────────────────────────────────┐  R_outer = 16px
│  Padding = 8px                                │
│    ┌─────────────────────────────────────┐    │
│    │                                     │    │  R_inner = 16px - 8px
│    │    Inner Element                    │    │          = 8px
│    │                                     │    │
│    └─────────────────────────────────────┘    │
└───────────────────────────────────────────────┘
```

- Outer Card = `rounded-2xl` (16px), Container Padding = `p-2` (8px) $\rightarrow$ Inner Element = `rounded-lg` (8px).
- Outer Dialog = `rounded-xl` (12px), Container Padding = `p-3` (12px) $\rightarrow$ Inner Button = `rounded-md` (6px) or `rounded-none`.

---

## 5. Shadows, Elevation & Borders

### 5.1 Elevation Levels (Light Mode)

| Elevation | Shadow Definition | Border Specification | Usage |
| :--- | :--- | :--- | :--- |
| **Level 0 (Flat)** | `none` | `1px solid #E9E0D6` | Inactive table cell, divider, table map background |
| **Level 1 (Card)** | `0 1px 3px rgba(28, 25, 23, 0.05)` | `1px solid #E9E0D6` | Menu item card, table tile, customer cart line |
| **Level 2 (Hover)**| `0 4px 12px rgba(28, 25, 23, 0.08)`| `1px solid #D5C9BD` | Hovered menu card, active category tab |
| **Level 3 (Drawer)**| `0 10px 25px rgba(28, 25, 23, 0.12)`| `1px solid #E9E0D6` | POS Checkout Drawer, bottom payment sheet |
| **Level 4 (Modal)** | `0 20px 40px rgba(28, 25, 23, 0.18)`| `1px solid rgba(255,255,255,0.8)`| Payment PIN modal, Refund authorization dialog |

### 5.2 Elevation in Dark Mode (KDS)
In dark mode, shadows disappear visually against dark canvas backgrounds. Depth is achieved strictly through **lightness stratification and border luminosity**:
- Canvas (`#0C0A09`) $\rightarrow$ Card Surface (`#18181B`) $\rightarrow$ Header Bar (`#27272A`) $\rightarrow$ Crisp border (`#3F3F46`).

---

## 6. Layout Mapping: Which UI Where & Priority Matrix

| Surface / Screen | Key Users | Primary Task | Visual Theme | Critical Priority Elements | Speed Benchmark |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Web POS Cashier Counter** | Cashier, Barista, Counter Staff | Fast order entry, item customization, bill settlement, split pay | Warm Light (`#FFF9F2`) | 1. Current Cart Total (`₹...`)<br>2. Large "Tender / Pay" button<br>3. Search & Category pills<br>4. Customization modifier sheet | Complete ticket in < 12 seconds |
| **2. Kitchen Display System (KDS)** | Chef, Line Cook, Head Barista | Cook prioritization, order bump, ticket age monitoring | Obsidian Dark (`#0C0A09`) | 1. Elapsed Timer (Color alert)<br>2. Table # & Ticket ID<br>3. Modifier callouts ("NO ONION")<br>4. Large Bump button | Bump action in 1 tap (< 1 sec) |
| **3. Customer QR Table Ordering** | Dining Guests (Mobile Browser) | Scan QR, browse menu, filter dietary (Veg/Jain), self-pay | Warm Light Clean | 1. Table number confirmation<br>2. High-res food photography<br>3. Veg / Non-Veg toggle chips<br>4. Sticky bottom cart bar | Order placed in < 45 seconds |
| **4. Self-Service Kiosk** | Walk-in Customers | Independent order and digital UPI / Card payment | Warm Light High-Contrast | 1. "Touch anywhere to start"<br>2. Jumbo visual item cards<br>3. Add-on recommendation prompt<br>4. Dynamic UPI QR display | End-to-end order in < 60 seconds |
| **5. Waiter Companion PWA** | Floor Waiters | Table management, taking orders tableside, calling KDS | Mobile Light Compact | 1. Visual floor plan / table grid<br>2. Table occupancy status<br>3. Quick repeat round button<br>4. Split check calculator | 3 taps to send order to kitchen |
| **6. SuperAdmin SaaS Operations** | Platform Operator / Developer | Tenant onboarding, subscription deals, audit log review | Deep Neutral Slate (`#1C1917` header) | 1. Total SaaS MRR & active cafes<br>2. 9-Step Provisioning Wizard<br>3. Business status toggle switches<br>4. Tamper-evident audit trail | Provision new cafe in < 3 minutes |
| **7. Native Windows Client** | Fixed POS Terminals, Receipt Hub | Heavy-duty local order entry, raw ESC/POS thermal printing | Windows Fluent + TSOS Warm | 1. Real-time USB/COM printer status<br>2. Offline queue recovery indicator<br>3. Full keyboard shortcut map (`F1`–`F12`) | Zero input lag (120 FPS local) |
| **8. Customer Android App** | Regular Patrons, Loyalty Members | Table scan, loyalty stamps, re-order favorites, push alerts | Material You + TSOS Warm | 1. One-tap QR camera scanner<br>2. Dynamic loyalty tier card<br>3. Live order tracking timeline<br>4. Saved payment UPI VPAs | App boot-to-order in < 10 seconds |

---

## 7. UX Research & Field Ergonomics in Hospitality

### 7.1 Real-World Physical Constraints
1. **The "Greasy/Wet Thumb" Problem:**
   Staff often have damp or flour-dusted fingers. Small hitboxes (<36px) fail repeatedly. Touch targets on cashier screens must have a minimum physical dimension of $9.5\text{ mm} \times 9.5\text{ mm}$ (minimum 48px to 56px in CSS coordinates).
2. **The "Glance Test" (3-Meter Readability):**
   In a commercial kitchen, the KDS monitor is mounted 2 to 3 meters away above eye level. Text hierarchy must guarantee that:
   - Table Number and Elapsed Minutes are legible at 3 meters (minimum `24px` font size with bold weight).
   - Recipe items are legible at 1.5 meters (`18px`).
   - Standard modifiers are legible at 1 meter (`14px`).
3. **The Morning Rush Eye-Tracking Pattern (POS):**
   Eye-tracking studies in fast-casual cafes reveal an **F-Pattern** skewed toward the right bottom:
   - **Top Left:** Category navigation (Coffee, Bakery, Breakfast, Merchandise).
   - **Center Screen:** Item grid with clear visual titles and badges.
   - **Right Column (Sticky):** Active cart with total price anchored at the bottom right where the cashier's dominant hand rests.
   - **Bottom Right:** Massive "TENDER / PAY" button (`min-h-[56px]`), impossible to miss.

```
┌────────────────────────────────────────────────────────┬─────────────────────────┐
│ CATEGORY TABS: [Coffee] [Bakery] [Savory] [Merch]      │ CART: Table 04 (3 items)│
├────────────────────────────────────────────────────────┼─────────────────────────┤
│ [ Iced Cortado ]  [ Flat White ]    [ Cold Brew ]      │ • 1x Iced Cortado       │
│ ₹180              ₹190              ₹210               │   └ Oat Milk (+₹30)     │
│                                                        │ • 2x Butter Croissant   │
│ [ Butter Croissant] [Almond Danish] [Sourdough Toast]  │                         │
│ ₹140              ₹180              ₹120               ├─────────────────────────┤
│                                                        │ Subtotal:       ₹540.00 │
│ [ Avocado Toast ] [ Eggs Benedict ] [ Granola Bowl ]   │ GST (5%):        ₹27.00 │
│ ₹260              ₹310              ₹220               │ TOTAL:          ₹567.00 │
│                                                        │ [  PAY NOW  (₹567)   ]  │
└────────────────────────────────────────────────────────┴─────────────────────────┘
```

---

## 8. State Transitions, Feedback & Micro-Interactions

### 8.1 Physical Tactile Feedback (Haptic & Audio)
- **POS Screen Tap:** High-frequency, low-amplitude tactile response (10ms on mobile/Android devices).
- **Barcode / QR Scan Success:** 880Hz pleasant audio chime (`120ms` duration).
- **Payment Success:** Two-tone major third chime (523Hz $\rightarrow$ 659Hz, C5 to E5).
- **Out of Stock / Invalid Action:** Low 180Hz double-thud buzz with visual shake animation (`x: [-4, 4, -2, 2, 0]`).

### 8.2 Animation Speeds & Motion Design (`motion/react`)
Every motion in TSOS communicates state change—never decorative distraction.

| Motion Trigger | Duration | Easing Curve | Motion Behavior |
| :--- | :--- | :--- | :--- |
| **Drawer / Cart Slide-in** | `240ms` | `cubic-bezier(0.16, 1, 0.3, 1)` | Slides from right edge with subtle opacity fade (0.9 to 1.0) |
| **Modal Scale-up** | `180ms` | `cubic-bezier(0.16, 1, 0.3, 1)` | Scales from `0.95` to `1.0` with backdrop blur entering `0px` to `8px` |
| **Item Added to Cart** | `140ms` | `easeOut` | Badge bounces slightly (`scale: 1.25 -> 1.0`), cart icon pulses |
| **KDS Order Bumped** | `200ms` | `easeInOut` | Ticket card slides down with green flash and collapses horizontally |
| **Network Reconnected** | `300ms` | `easeOut` | Amber offline pill transitions to green checkmark, then dissolves |

---

## 9. Accessibility, Legibility & Safety Rules (WCAG 2.1 AA/AAA)

1. **Color Never Acts Alone:**
   A status is never signaled solely by red, yellow, or green. Every badge, ticket, and table state pairs color with a distinct icon and explicit text:
   - Green: `CheckCircle2` icon + `"PAID"` text label.
   - Amber: `Clock` icon + `"PREPARING (12m)"` text label.
   - Red: `AlertOctagon` icon + `"VOIDED"` text label.
2. **Strict Contrast Thresholds:**
   - Body text against surface: Minimum **7:1** (AAA standard achieved: `#1C1917` on `#FFFFFF` is 15.9:1).
   - Secondary text: Minimum **4.5:1** (AA standard achieved: `#57534E` on `#FFFFFF` is 7.2:1).
   - Interactive icons: Minimum **3.0:1** against surrounding background.
3. **Focus Rings & Keyboard Navigation:**
   For Windows desktop POS and accessibility devices, all interactive elements support keyboard tabbing with high-visibility double focus rings:
   `focus-visible:ring-2 focus-visible:ring-[#F97316] focus-visible:ring-offset-2`.
4. **Food Allergen Warning Standards:**
   Vegetarian, Non-Vegetarian, Vegan, Gluten-Free, and Nut-Free labels adhere to standardized Indian FSSAI and international culinary symbols:
   - **Vegetarian:** Crisp green square with filled green circle.
   - **Non-Vegetarian:** Brown/maroon square with filled brown triangle.
   - **Allergen Callouts:** Prominent amber pill with `AlertTriangle` icon before checkout.

---

## 10. Complete CSS Token Reference & Tailwind Utility Dictionary

Copy-pasteable CSS variable definitions to be maintained in `src/index.css`:

```css
@import "tailwindcss";

@layer base {
  :root {
    /* ── Light Mode / Warm Bakery ── */
    --tsos-bg: #FFF9F2;
    --tsos-surface: #FFFFFF;
    --tsos-surface-secondary: #F5F0EB;
    --tsos-divider: #E9E0D6;
    --tsos-action: #F97316;
    --tsos-action-hover: #EA580C;
    --tsos-action-soft: #FFF1E6;
    --tsos-completed: #17803D;
    --tsos-completed-soft: #E8F5EC;
    --tsos-attention: #B45309;
    --tsos-attention-soft: #FFF4E5;
    --tsos-destructive: #B42318;
    --tsos-destructive-soft: #FEF2F2;
    --tsos-info: #2563EB;
    --tsos-info-soft: #EFF6FF;
    --tsos-accent: #7C3AED;
    --tsos-accent-soft: #F5F3FF;
    --tsos-text-primary: #1C1917;
    --tsos-text-secondary: #57534E;
    --tsos-text-muted: #A8A29E;

    /* ── Dark Mode / KDS & Barista ── */
    --tsos-dark-bg: #0C0A09;
    --tsos-dark-surface: #18181B;
    --tsos-dark-surface-2: #27272A;
    --tsos-dark-divider: #3F3F46;
    --tsos-dark-action: #FB923C;
    --tsos-dark-action-soft: #2C1A0E;
    --tsos-dark-completed: #22C55E;
    --tsos-dark-completed-soft: #052E16;
    --tsos-dark-attention: #F59E0B;
    --tsos-dark-attention-soft: #2D1C03;
    --tsos-dark-destructive: #EF4444;
    --tsos-dark-destructive-soft: #300D0D;
    --tsos-dark-info: #3B82F6;
    --tsos-dark-accent: #A855F7;
    --tsos-dark-text-primary: #FAFAF9;
    --tsos-dark-text-secondary: #D6D3D1;
    --tsos-dark-text-muted: #78716C;
  }
}
```

### Common Tailwind Class Recipes for Fast Implementation

```html
<!-- Primary Action Button (2:1 padding ratio, high contrast) -->
<button class="px-5 py-2.5 rounded-xl bg-[#F97316] hover:bg-[#EA580C] text-white font-semibold text-sm shadow-xs transition-colors active:scale-98">
  Collect Payment
</button>

<!-- Standard Menu Card (Level 1 elevation, nested radius math) -->
<div class="p-4 rounded-2xl bg-white border border-[#E9E0D6] shadow-xs hover:border-[#D5C9BD] hover:shadow-md transition-all">
  <div class="flex items-start justify-between gap-3">
    <div>
      <h3 class="font-display font-bold text-base text-[#1C1917]">Iced Oat Cortado</h3>
      <p class="text-xs text-[#57534E] line-clamp-2 mt-0.5">Double shot specialty roast poured over cold oat milk</p>
    </div>
    <span class="font-mono font-bold text-sm text-[#1C1917]">₹210</span>
  </div>
</div>

<!-- KDS Dark Mode Ticket (Obsidian contrast, remote glanceable) -->
<div class="p-4 rounded-2xl bg-[#18181B] border border-[#3F3F46] text-[#FAFAF9] flex flex-col justify-between">
  <div class="flex items-center justify-between border-b border-[#27272A] pb-2 mb-3">
    <span class="font-display font-black text-xl text-[#FB923C]">TABLE 07</span>
    <span class="px-2 py-0.5 rounded text-xs font-bold bg-[#2D1C03] text-[#F59E0B]">4m 12s</span>
  </div>
  <ul class="space-y-1.5 text-sm">
    <li class="font-semibold">2x Flat White <span class="text-xs text-[#D6D3D1] font-normal block pl-2">• Extra Hot</span></li>
    <li class="font-semibold">1x Sourdough Toast</li>
  </ul>
  <button class="mt-4 w-full py-3 rounded-xl bg-[#22C55E] hover:bg-[#16A34A] text-black font-extrabold text-sm uppercase tracking-wider">
    Bump Order
  </button>
</div>
```

---

## 11. Maintenance & Review Checklist for Engineers

Before committing any component or screen to the TSOS ecosystem, verify:

- [ ] **Color Check:** Are all hex codes drawn exclusively from `--tsos-*` tokens? (Zero arbitrary `#333`, `#eee`, or uncalibrated blues).
- [ ] **Contrast Verification:** Does body copy test $\ge 4.5:1$ against its immediate container?
- [ ] **Geometry Check:** Does every rounded child element obey $R_{\text{inner}} = R_{\text{outer}} - \text{Padding}$?
- [ ] **Padding Math:** Does horizontal button padding equal exactly $2\times$ vertical padding?
- [ ] **Anti-Wrap Test:** Are all status badges, category chips, and button labels wrapped in `whitespace-nowrap`?
- [ ] **Touch Target Audit:** Is the smallest clickable area on mobile/POS at least $44\text{px} \times 44\text{px}$?
- [ ] **Icon Pairing:** Does every color-coded alert state include an explicit textual label and Lucide icon?
- [ ] **Receipt Monospace:** Are currency amounts rendered in monospace/tabular numerals?
