# MASTER PROMPT: ServePoint (The Simple Operating System) - Omnichannel Cafe & Restaurant POS Engine

> **Prompt Usage**: Provide this prompt to any AI coding assistant (Gemini, Claude, Antigravity, Cursor, ChatGPT) to reproduce the complete **ServePoint** multi-surface cafe operating system from scratch in React 19, TypeScript 7, Tailwind CSS 4.3, Lucide Icons, and Zustand 5.

---

```markdown
You are a senior full-stack software architect and native systems engineer.
Build **ServePoint (The Simple Operating System)** — an omnichannel, offline-resilient, hardware-integrated Point of Sale, Kitchen Display System (KDS), Table-Side Ordering Storefront, and Management OS for specialty cafes, roasteries, bakeries, and QSRs.

---

## 1. CORE ARCHITECTURAL SPECIFICATIONS

### 1.1 Multi-Surface Execution (5 Synchronized Surfaces)
The application must execute across 5 distinct operational surfaces driven by a single unified reactive state store:
1. **Surface 1: Web Management Hub & Counter POS** (`web`): Complete browser workspace containing 11 core tabs:
   - `pos`: High-speed register with category grid, variant customizer, split bills, customer loyalty redemption, and thermal print triggers.
   - `kds`: Live Kanban kitchen ticket queue (`pending` -> `preparing` -> `ready` -> `completed`) with visual timers, audio alerts, and 1-click bump bar.
   - `orders`: Master order audit trail with live filters, re-print actions, and hardware print log audit.
   - `inventory`: Real-time stock tracking with automated recipe-based ingredient depletion per item sold, restock logging, defect drills, and low-stock alerts.
   - `menu`: Dynamic category, item, modifier/variant builder with veg/non-veg flags, tax configurations, and recipe ingredient mappings.
   - `tables`: Interactive floor plan with occupancy states (`available`, `occupied`, `reserved`, `billing`) and dynamic table QR code generator with test links.
   - `customers`: CRM engine with **Receipt History** (expandable line items, ESC/POS re-print, email digital bill dispatch), 4-tier loyalty program, and manual points adjustment ledger.
   - `offers`: Promotional coupon builder (percentage, flat amount, BOGO, minimum cart value rules).
   - `shifts`: Cash drawer float management, cash drops, register reconciliation, and staff PIN handover.
   - `reports`: Daily revenue graphs, hourly traffic heatmaps, top-selling coffee beans/food, category distribution, and GST tax reports.
   - `settings`: Cafe profile, GSTIN/FSSAI, Web Bluetooth/USB thermal printer configs, platform fee pass-through rules, and audio settings.

2. **Surface 2: Windows Native Desktop POS** (`windows`): Simulates a WinUI 3 / WPF desktop application with hardware status bar (USB Thermal Printer, Cash Drawer, Barcode Scanner, Network Ping), raw ESC/POS byte generator, and offline sync queue.
3. **Surface 3: Android / iOS Handheld Staff Client** (`android`): Simulates a Kotlin/Swift mobile app for floor staff table-side ordering, portable 58mm Bluetooth thermal printing, and camera QR member scanning.
4. **Surface 4: Customer Table-Side QR Storefront** (`storefront`): Zero-install mobile web ordering app launched by guests scanning table QR codes, with dietary filters, variant modifiers, UPI QR payment, and loyalty lookup.
5. **Surface 5: Live Order Tracking** (`order_track`): Real-time 4-stage preparation visualizer (`Received` -> `Brewing/Kitchen` -> `Ready` -> `Completed`) with prep countdown timers and allergen notes.

---

## 2. FINANCIAL & BUSINESS ENGINE RULES

### 2.1 Zero-Subscription Fee & Platform Monetization
- **₹0 Monthly Software Subscription**: The cafe pays no monthly base fee.
- **₹1 Platform Fee**: Default ₹1.00 per completed order.
- **Smart Auto-Flip Threshold**: Configurable rules to absorb the fee (`cafe` pays) or pass transparently to consumers (`customer` pays) once a monthly order threshold is met (e.g., 500 orders/month).

### 2.2 Taxation & Currency
- **Currency**: Indian Rupee (₹ - INR).
- **Tax Calculation**: 5% GST (2.5% CGST + 2.5% SGST) calculated automatically on discounted subtotal.
- **Formulae**:
  - `subtotal` = Sum of all `(item.unit_price + variants + addons) * item.qty`
  - `discount_total` = `coupon_discount + loyalty_points_redeemed` (capped at subtotal)
  - `taxable_amount` = `Math.max(0, subtotal - discount_total)`
  - `tax_total` = `Math.round(taxable_amount * 0.05 * 100) / 100`
  - `platform_fee` = `feeConfig.default_fee_payer === 'customer' ? feeConfig.per_order_fee : 0`
  - `grand_total` = `Math.max(0, taxable_amount + tax_total + platform_fee)`

### 2.3 ServePoint Club Loyalty Engine
- **Earn Rate**: 1 Loyalty Point per ₹10 spent on subtotal (floored).
- **Redemption Rate**: 1 Point = ₹1.00 cash discount.
- **Dynamic Tiering**:
  - **Bronze**: 0 - 99 lifetime points (Base 1x earn rate)
  - **Silver**: 100 - 249 lifetime points (5% bonus points)
  - **Gold**: 250 - 499 lifetime points (10% bonus points + priority queue)
  - **Platinum**: 500+ lifetime points (15% bonus points + VIP perks)
- **Immutable Ledger**: Every earn, redeem, and manual staff adjustment writes a timestamped record to `loyalty_ledgers` with the reference order ID and balance after.

---

## 3. HARDWARE & THERMAL PRINTER SUBSYSTEM (ESC/POS)

### 3.1 Binary ESC/POS Protocol Support
Generate raw byte arrays compatible with standard 58mm (32 column) and 80mm (48 column) thermal receipt printers:
- `ESC @` (0x1B 0x40): Initialize printer
- `ESC a n` (0x1B 0x61 0x00/0x01/0x02): Align Left / Center / Right
- `ESC E n` (0x1B 0x45 0x01/0x00): Emphasized / Bold text ON / OFF
- `GS ! n` (0x1D 0x21 0x00/0x01/0x10/0x11): Font size normal / double-height / double-width / quad
- `GS V m` (0x1D 0x56 0x41 0x03): Full / Partial paper cut with feed
- `ESC p m t1 t2` (0x1B 0x70 0x00 0x19 0xFA): Pulse cash drawer kick (RJ11 24V solenoid)

### 3.2 Connectivity Channels
- **Web Bluetooth**: Direct `navigator.bluetooth.requestDevice` pairing with standard Serial Port Service `000018f0-0000-1000-8000-00805f9b34fb` and write characteristic `00002af1-0000-1000-8000-00805f9b34fb` with chunked 512-byte throttled writes.
- **WebUSB & Network TCP**: IP socket transmission targeting Port `9100`.
- **Browser Print Fallback**: Pixel-perfect monospace receipt template formatted with CSS `@media print`.

### 3.3 Hardware Print Logs & Audit
- All thermal print attempts log to `printLogs` state with timestamp, payload byte size, printer type (KOT / Bill), status (`success` / `failed`), error message, and 1-click retry handler.

---

## 4. COMPLETE DATA TYPES (`src/types.ts`)

```typescript
export type ActiveSurface = 'web' | 'android' | 'windows' | 'storefront' | 'order_track' | 'marketing_v1' | 'marketing_v2';
export type WebTab = 'pos' | 'kds' | 'orders' | 'inventory' | 'menu' | 'tables' | 'customers' | 'offers' | 'shifts' | 'reports' | 'settings';
export type OrderType = 'dine_in' | 'takeaway' | 'delivery';
export type OrderStatus = 'pending' | 'preparing' | 'ready' | 'completed' | 'cancelled';
export type PaymentMethod = 'cash' | 'upi' | 'card' | 'split';
export type LoyaltyTier = 'Bronze' | 'Silver' | 'Gold' | 'Platinum';

export interface Location {
  id: string;
  name: string;
  address: string;
  phone: string;
  gstin?: string;
  fssai?: string;
  currency: string;
}

export interface MenuItemVariant {
  id: string;
  name: string;
  price_delta: number;
}

export interface MenuItemAddon {
  id: string;
  name: string;
  price: number;
}

export interface RecipeItem {
  ingredient_id: string;
  quantity_used: number; // in g, ml, or pcs
}

export interface MenuItem {
  id: string;
  category_id: string;
  name: string;
  description: string;
  base_price: number;
  is_veg: boolean;
  is_available: boolean;
  image_url?: string;
  variants?: MenuItemVariant[];
  addons?: MenuItemAddon[];
  recipe?: RecipeItem[];
}

export interface OrderItem {
  id: string;
  menu_item_id: string;
  menu_item_name: string;
  qty: number;
  unit_price: number;
  variant_name?: string;
  variant_price_delta?: number;
  addons?: MenuItemAddon[];
  item_total: number;
  notes?: string;
}

export interface Order {
  id: string;
  order_number: string;
  location_id: string;
  order_type: OrderType;
  table_id?: string;
  customer_id?: string;
  customer_name?: string;
  customer_phone?: string;
  items: OrderItem[];
  subtotal: number;
  tax_total: number;
  discount_total: number;
  platform_fee: number;
  grand_total: number;
  status: OrderStatus;
  payment_method: PaymentMethod;
  created_at: string;
  loyalty_points_earned?: number;
  loyalty_points_redeemed?: number;
  kot_printed?: boolean;
  bill_printed?: boolean;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  loyalty_points: number;
  lifetime_spent: number;
  total_orders: number;
  tier?: LoyaltyTier;
  created_at: string;
}

export interface LoyaltyLedger {
  id: string;
  customer_id: string;
  ref_order_id?: string;
  points_delta: number;
  reason: string;
  balance_after: number;
  created_at: string;
}

export interface Ingredient {
  id: string;
  name: string;
  category: string;
  unit: 'g' | 'ml' | 'pcs' | 'kg' | 'l';
  current_stock: number;
  min_alert_stock: number;
  cost_per_unit: number;
  last_restocked_at: string;
}

export interface Table {
  id: string;
  number: string;
  capacity: number;
  status: 'available' | 'occupied' | 'reserved' | 'billing';
  current_order_id?: string;
}

export interface Offer {
  id: string;
  code: string;
  title: string;
  discount_type: 'percentage' | 'flat';
  discount_value: number;
  min_order_value: number;
  max_discount?: number;
  is_active: boolean;
}

export interface Shift {
  id: string;
  staff_name: string;
  opened_at: string;
  closed_at?: string;
  opening_cash_float: number;
  closing_cash_actual?: number;
  cash_sales: number;
  upi_sales: number;
  card_sales: number;
  notes?: string;
}

export interface FeeConfig {
  per_order_fee: number;
  default_fee_payer: 'cafe' | 'customer';
  auto_flip_enabled: boolean;
  customer_paid_order_limit: number;
  period_order_count: number;
}

export interface PrinterConfig {
  connection_type: 'browser' | 'bluetooth' | 'network' | 'usb';
  paper_width: '58mm' | '80mm';
  ip_address: string;
  port: number;
  auto_print_bill: boolean;
  auto_print_kot: boolean;
  cut_paper: boolean;
  kick_cash_drawer: boolean;
  header_text: string;
  footer_text: string;
}

export interface PrintLogEntry {
  id: string;
  timestamp: string;
  order_id: string;
  order_number: string;
  printer_type: 'bill' | 'kot';
  paper_width: '58mm' | '80mm';
  status: 'success' | 'failed';
  error_message?: string;
  byte_size: number;
}
```

---

## 5. UI/UX & CRAFTSMANSHIP DESIGN SYSTEM

- **Styling**: Tailwind CSS with custom warm coffee aesthetic.
- **Palette**:
  - Warm Canvas Background: `#FBF7F2` / `#FFFDF9`
  - High-Contrast Text: `#1C1917` (Stone 900)
  - Neutral Borders & Dividers: `#E9E0D6` / `#D6C7B8`
  - Brand Royal Purple (Loyalty & VIP): `#7C3AED` / `#6D28D9`
  - Artisan Orange (POS & Receipts): `#EA580C` / `#C2410C`
  - Success Green (Revenue & Paid): `#17803D` / `#15803D`
- **Typography**: Clean, high-legibility geometric sans fonts for UI controls; monospace fonts for receipt outputs, currency figures, and order numbers (`font-mono`).
- **Interactive Tooltips & Onboarding**: Contextual `GuidanceTooltip` and floating `OnboardingTourModal` with step-by-step guidance for cashier training.

---

## 6. IMPLEMENTATION STEPS FOR AI GENERATOR

1. **State Store (`src/lib/store.ts`)**: Implement Zustand store initialized with sample specialty coffee menu (Espresso, Cortado, Flat White, Cold Brew, Croissants, Sourdough Sandwiches), ingredient recipes, 8 dining tables, loyalty customers, and printer configurations.
2. **Thermal Receipt Builder (`src/utils/printerService.ts`)**: Construct complete ESC/POS binary stream compiler supporting alignment, double-height headers, item tables, tax breakdowns, and cut commands.
3. **Counter POS Screen (`src/components/pos/POSScreen.tsx`)**: Build 3-column POS layout with category chips, menu cards, modifier modal, cart drawer, loyalty points slider, and split checkout.
4. **Customer CRM & Receipt Audit (`src/components/customers/CustomersScreen.tsx`)**: Build customer directory with tier badges, manual point adjustment form, and **Receipt History** tab featuring thermal re-print and digital invoice email modals.
5. **Kitchen Display System (`src/components/kds/KDSScreen.tsx`)**: Build multi-column Kanban bump bar with real-time ticket aging color cues.
6. **QR Mobile Storefront (`src/components/storefront/StorefrontScreen.tsx`)**: Build customer mobile ordering interface with instant UPI payment simulation and order tracking redirection.
7. **Native Simulator Shells (`src/components/native/WindowsAppClient.tsx` & `AndroidAppClient.tsx`)**: Build simulated desktop/mobile native clients showing raw hardware hooks and local sync queues.
8. **Documentation**: Ensure `docs/` contains comprehensive architectural and operational documentation.
```

---

## What makes this prompt complete:
- **Zero Ambiguity**: Includes full TypeScript type definitions, mathematical formulas for tax and loyalty, ESC/POS hexadecimal command mappings, and state architectures.
- **Multi-Surface Scope**: Specifies exactly how POS, Kitchen KDS, Native Desktop, Mobile Handheld, and Table QR Storefront interact seamlessly.
- **Production Ready**: Delivers all requirements for Indian cafe taxation (5% GST), thermal printing (Bluetooth/USB 58mm & 80mm), and zero-subscription platform monetization.
