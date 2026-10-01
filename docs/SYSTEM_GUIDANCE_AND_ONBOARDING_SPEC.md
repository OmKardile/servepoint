# TSOS System Guidance & First-Time Usage Specification
**Document Version:** 1.0.0  
**Target Audience:** Cafe Operators, Cashiers, Baristas, and Automated AI Implementation Engines  
**Modules Covered:** Contextual Hover Tooltips, Interactive Onboarding Tour, Dynamic Surface Switcher, Keyboard Accelerators, and Training Mode

---

## 1. System Overview

Cafe staff experience rapid turnover. To eliminate lengthy software training and operator error during peak service hours, TSOS incorporates a zero-latency, two-tiered guidance engine:
1. **Tier 1: Contextual Hover Tooltips (`GuidanceTooltip.tsx`):** Ambient, non-intrusive floating badges that activate on hover or keyboard focus, displaying operational guidance, keyboard shortcuts, and business impact.
2. **Tier 2: Guided Interactive Walkthrough Tour (`OnboardingTourModal.tsx`):** A step-by-step interactive onboarding sequence that walks first-time users through the POS register, order customization, loyalty redemption, KDS kitchen workflows, table maps, and fiscal reconciliation.

---

## 2. Guidance Data Dictionary (`src/data/guidanceData.ts`)

Every interactive feature in TSOS is registered in a centralized dictionary containing the following schema:

```typescript
export interface GuidanceItem {
  id: string;              // Unique identifier (e.g., 'pos_cart_customer')
  title: string;           // Human-readable feature name
  description: string;     // Concise functional explanation
  actionHint?: string;     // Explicit operational directive
  shortcut?: string;       // Keyboard shortcut (e.g., 'Ctrl + P')
  category: 'pos' | 'kds' | 'loyalty' | 'printer' | 'sync' | 'shift' | 'general';
}
```

### Registered Feature Registry:

| Feature Key | Display Title | Functional Scope | Key Shortcut |
|---|---|---|---|
| `surface_switcher` | Multi-Surface Switcher | Toggles Web POS, KDS, Customer QR, Windows .NET, and Android surfaces. | `Alt + S` |
| `cloud_sync_indicator` | Cloud Sync & Offline Guard | Real-time database latency meter, connection status, and offline transaction queue. | N/A |
| `thermal_printer_shortcut` | Thermal Bill & KOT Printing | ESC/POS hardware setup, paper width selection (58mm/80mm), cash drawer kicks. | `Ctrl + P` |
| `guidance_toggle` | Training / Guidance Mode | Toggles all hover badges across the register for novice staff. | `?` |
| `audio_toggle` | Acoustic Kitchen Chimes | Sound effects for incoming orders, ticket ready bell, and bill paid. | `M` |
| `pos_category_nav` | Category Filter Bar | Instant filtering across Beverage, Food, Bakery, and Coffee with live counts. | `1..9` |
| `pos_item_card` | Recipe Card & Customizer | Click adds item to cart or launches variant modifier modal. | Click |
| `pos_order_type` | Order Type Selector | Dine-In (links to table), Takeaway, or Delivery partner routing. | `Tab` |
| `pos_table_picker` | Table Layout Selector | Interactive floor map showing table occupancy, guest count, and bills. | Click |
| `pos_cart_customer` | Customer Phone Attachment | Search or enroll customer by mobile number to track loyalty points. | `Alt + C` |
| `pos_loyalty_redemption`| 1-Click Points Redemption | Deduct customer loyalty balance (1 pt = ₹1) with 1-click preset chips. | Click |
| `pos_fee_engine` | Zero-Subscription Fee Engine| Real-time display of ₹1/order platform fee (absorbed vs customer paid). | Hover |
| `pos_checkout_button` | Payment & Charge Modal | Finalizes bill via UPI QR, Cash change calculator, or Card. | `Enter` |
| `kds_ticket_card` | KDS Order Routing Slip | Barista timer countdown, status advancement (New -> Prep -> Ready), auto-stock deduction. | Space |
| `customers_tier_filter` | Loyalty Tier Breakdown | Categorizes guests into Bronze, Silver, Gold, and Platinum tiers. | Click |
| `customers_ledger_button`| Immutable Loyalty Ledger | Complete audit trail of points earned, spent, and manager adjustments. | Click |
| `shift_reconciliation` | Cash Register Reconciliation| End-of-shift drawer count comparing expected vs actual cash float. | Click |

---

## 3. Interactive Walkthrough Tour Sequence

When a user launches TSOS for the first time (or clicks the **Tour** button in the header), the state machine initiates a step-by-step interactive walkthrough:

### Step 1: Welcome & Mission
- **Tab:** `pos`
- **Focus:** Application header & brand banner.
- **Narrative:** Introduces TSOS as the open, high-speed cafe operating system with zero monthly subscription fees and instant thermal printing.

### Step 2: Multi-Surface Architecture & Cloud Sync
- **Tab:** `pos`
- **Focus:** Surface switcher and Cloud Sync status pill.
- **Narrative:** Demonstrates how TSOS unifies Web, Android, Windows, and Customer Storefront into a single synchronized database, maintaining offline operability.

### Step 3: Catalog Navigation & Item Modifiers
- **Tab:** `pos`
- **Focus:** Category tabs & menu item grid.
- **Narrative:** Shows how baristas filter items, customize milk types (Oat, Almond, Soy), add espresso shots, and monitor real-time stock levels.

### Step 4: Table-Side Dine-In & Customer Loyalty
- **Tab:** `pos`
- **Focus:** Cart drawer, table picker, and customer phone attachment.
- **Narrative:** Explains how attaching a customer's phone number awards 1 point per ₹10 spent, and how points can be redeemed instantly at ₹1 discount per point.

### Step 5: Thermal Receipt & KOT Printing
- **Tab:** `pos`
- **Focus:** Receipt modal & thermal printer workstation.
- **Narrative:** Shows ESC/POS raw printing, 58mm/80mm formatting, paper cut commands, and cash drawer kick automation.

### Step 6: Kitchen Display System (KDS)
- **Tab:** `kds`
- **Focus:** Kitchen ticket columns and prep timers.
- **Narrative:** Guides kitchen staff on ticket transitions (New -> Preparing -> Ready) and automatic inventory deduction.

### Step 7: Inventory & Recipe Stock Depletion
- **Tab:** `inventory`
- **Focus:** Ingredient ledger and stock alert badges.
- **Narrative:** Explains automatic recipe-level stock depletion (e.g., pulling a latte depletes 18g espresso beans and 220ml milk).

### Step 8: Transparent Fee Engine & Settings
- **Tab:** `settings`
- **Focus:** Zero-subscription fee controls and printer hardware setup.
- **Narrative:** Shows the operator how to toggle between cafe-absorbed and customer-paid modes, and set auto-flip thresholds.

---

## 4. Technical Implementation Details

### 4.1 Tooltip Component Ergonomics (`GuidanceTooltip.tsx`)
```typescript
interface GuidanceTooltipProps {
  guideKey: string;
  children: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
}
```
- **State Coupling:** Reads `guidanceMode` directly from `useTsosStore()`.
- **Zero Layout Shift:** Tooltips are mounted using fixed absolute positioning with subtle `z-50` elevation and Tailwind transitions (`opacity-0 group-hover:opacity-100 pointer-events-none`).
- **Keyboard Accessible:** Supports `tabIndex={0}` and ARIA `role="tooltip"`, `aria-describedby` tags.

### 4.2 State Management (`src/lib/store.ts`)
```typescript
interface TsosState {
  guidanceMode: boolean;
  isTourActive: boolean;
  currentTourStep: number;
  toggleGuidanceMode: () => void;
  startTour: () => void;
  nextTourStep: () => void;
  prevTourStep: () => void;
  endTour: () => void;
}
```
All tour progress and guidance settings are persisted to browser `localStorage` under `tsos_guidance_state` to prevent re-prompting experienced staff while remaining instantly summonable via the header button.
