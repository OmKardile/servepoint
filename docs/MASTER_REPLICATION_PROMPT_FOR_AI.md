# TSOS Master Replication Blueprint for AI Engines
**Document Version:** 1.0.0  
**Purpose:** This document is an exhaustive, self-contained technical prompt and architectural blueprint. Any Large Language Model or automated coding agent (e.g., Gemini, Claude, GPT, Antigravity) can ingest this single file and generate the exact, complete TSOS cafe operating system with identical UI, database schema, ESC/POS thermal printing, customer loyalty, zero-subscription fee engine, and native clients.

---

## 1. System Prompt for AI Replication

```markdown
You are an expert full-stack systems engineer and native desktop/mobile developer.
Your task is to build TSOS (The Cafe Operating System) — a comprehensive, offline-first, high-velocity Point of Sale, Kitchen Display System (KDS), Table-Side Ordering Storefront, and Cafe Management Suite designed for specialty coffee shops, bakeries, and QSRs.

### Core Architectural Pillars:
1. Zero Monthly Subscription Fee Engine: The platform charges ₹0/month base software fee. Monetization relies on a ₹1/order platform fee, with an intelligent auto-flip threshold allowing cafes to absorb the fee or pass it transparently to consumers.
2. Built-in Customer Loyalty Points System: Earn 1 point per ₹10 spent. Redeem at 1 point = ₹1 cash discount with 1-click preset chips. Automatic customer tiering (Bronze, Silver, Gold, Platinum) with complete immutable ledger auditing.
3. Hardware-Agnostic Thermal Printing: Native ESC/POS binary command engine supporting both 58mm (32 columns) and 80mm (48 columns) roll widths via Web Bluetooth, WebUSB, Network TCP (Port 9100), and Browser print fallback.
4. Complete System Guidance & Training System: Contextual hover guidance tooltips across every UI feature, paired with an interactive step-by-step onboarding walkthrough tour for novice cafe staff.
5. Cloud Sync & Offline Resilience: Bi-directional synchronization with real-time ping latency indicator and local transaction replay buffer that guarantees zero lost orders during internet dropouts.
6. Multi-Surface Execution: Single synchronized state driving Web POS, Kitchen KDS, Table-Side QR Mobile Web, Windows Native WPF (.NET 9), and Android Handheld (Kotlin/Compose).
```

---

## 2. Complete Data Schema (TypeScript Interfaces)

```typescript
export type OrderType = 'dine_in' | 'takeaway' | 'delivery';
export type OrderStatus = 'pending' | 'preparing' | 'ready' | 'completed' | 'cancelled';
export type PaymentMethod = 'cash' | 'upi' | 'card' | 'split';
export type ActiveSurface = 'web' | 'android' | 'windows' | 'storefront' | 'order_track' | 'marketing_v1' | 'marketing_v2' | 'code_viewer';
export type WebTab = 'pos' | 'kds' | 'orders' | 'inventory' | 'menu' | 'tables' | 'customers' | 'offers' | 'shifts' | 'reports' | 'settings';

export interface FeeConfig {
  per_order_fee: number;                      // Default: 1.00 (₹1 per order)
  default_fee_payer: 'cafe' | 'customer';     // Which party pays the fee
  auto_flip_enabled: boolean;                 // Automatically flip from cafe to customer
  customer_paid_order_limit: number;          // Threshold (e.g. 500 orders/mo)
  period_order_count: number;                 // Orders in current billing cycle
  last_flip_timestamp?: string;
}

export interface PrinterConfig {
  connection_type: 'browser' | 'bluetooth' | 'network' | 'usb';
  paper_width: '58mm' | '80mm';
  ip_address: string;
  port: number;                               // Default: 9100
  auto_print_bill_on_payment: boolean;
  auto_print_kot_on_order: boolean;
  cut_paper: boolean;
  kick_cash_drawer: boolean;
  header_text: string;
  footer_text: string;
  gstin: string;
  fssai: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  loyalty_points: number;                     // 1 pt = ₹1 redemption value
  lifetime_spend: number;
  total_orders: number;
  tier?: 'Bronze' | 'Silver' | 'Gold' | 'Platinum';
  created_at: string;
  last_visit_at?: string;
}

export interface LoyaltyTransaction {
  id: string;
  customer_id: string;
  order_id?: string;
  points: number;                             // Positive for earn, negative for redeem
  type: 'earn' | 'redeem' | 'manual_adjust';
  reason: string;
  timestamp: string;
  balance_after: number;
}

export interface Table {
  id: string;
  label: string;                              // e.g. "T-01 (Window)"
  seats: number;
  status: 'available' | 'occupied' | 'reserved' | 'billing';
  active_order_id?: string;
}

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  base_price: number;
  category_id: string;
  is_veg: boolean;
  is_available: boolean;
  image_url: string;
  variants?: { id: string; name: string; price_delta: number }[];
  addon_ids?: string[];
  recipe_ingredients?: { ingredient_id: string; quantity_used: number }[];
}

export interface OrderItem {
  id: string;
  menu_item_id: string;
  name: string;
  qty: number;
  base_price: number;
  selected_variant?: { id: string; name: string; price_delta: number };
  selected_addons?: { id: string; name: string; price: number }[];
  item_total: number;
  notes?: string;
}

export interface Order {
  id: string;
  order_number: string;                       // e.g. "TSOS-2026-0842"
  location_id: string;
  order_type: OrderType;
  table_id?: string;
  customer_id?: string;
  items: OrderItem[];
  subtotal: number;
  tax_total: number;                          // 5% GST (2.5% CGST + 2.5% SGST)
  discount_total: number;
  platform_fee: number;
  grand_total: number;
  status: OrderStatus;
  payment_method: PaymentMethod;
  created_at: string;
  redeemed_loyalty_points?: number;
  earned_loyalty_points?: number;
  kot_printed: boolean;
  bill_printed: boolean;
}
```

---

## 3. Mathematical Calculations & Business Rules

### 3.1 Order Financial Calculation Rules:
1. `subtotal` = Sum of all `item.item_total`.
2. `tax_total` = `Math.round(subtotal * 0.05 * 100) / 100` (5% GST).
3. `discount_total` = `couponDiscount + redeemed_loyalty_points`. (Redemption is capped at subtotal).
4. `platform_fee` = `feeConfig.default_fee_payer === 'customer' ? feeConfig.per_order_fee : 0`.
5. `grand_total` = `Math.max(0, subtotal + tax_total - discount_total + platform_fee)`.

### 3.2 Customer Loyalty Points Rules:
- **Earn Rate:** 1 Point per ₹10 spent on `subtotal` (floored).
- **Redemption Rate:** 1 Point = ₹1.00 cash discount.
- **Dynamic Tiering:**
  - `< 100 points`: **Bronze**
  - `100 - 249 points`: **Silver**
  - `250 - 499 points`: **Gold**
  - `500+ points`: **Platinum**

---

## 4. ESC/POS Command Byte Sequences

Thermal print generators compile byte arrays using this exact command structure:

```typescript
const ESC = 0x1B;
const GS = 0x1D;

export const ESC_POS_COMMANDS = {
  INIT: [ESC, 0x40],                          // Initialize
  ALIGN_LEFT: [ESC, 0x61, 0x00],              // Align Left
  ALIGN_CENTER: [ESC, 0x61, 0x01],            // Align Center
  ALIGN_RIGHT: [ESC, 0x61, 0x02],             // Align Right
  BOLD_ON: [ESC, 0x45, 0x01],                 // Bold On
  BOLD_OFF: [ESC, 0x45, 0x00],                // Bold Off
  TEXT_NORMAL: [GS, 0x21, 0x00],              // Normal font size
  TEXT_DOUBLE_H: [GS, 0x21, 0x01],            // Double Height
  TEXT_DOUBLE_W: [GS, 0x21, 0x10],            // Double Width
  TEXT_DOUBLE_WH: [GS, 0x21, 0x11],           // Quad size
  PAPER_CUT: [GS, 0x56, 0x41, 0x03],          // Cut paper
  DRAWER_KICK: [ESC, 0x70, 0x00, 0x19, 0xFA], // 24V RJ11 Solenoid Kick
};
```

---

## 5. Implementation Roadmap for Replicating AI Systems

When instructing another AI to generate TSOS from scratch:
1. **Initialize State:** Create Zustand store `useTsosStore` seeded with categories, menu items with recipes, tables, initial customers with loyalty history, and printer settings.
2. **Implement POS Screen:** Build 3-column responsive layout (Category filter, recipe card grid with veg indicator, and cart drawer with table assignment and customer loyalty attachment).
3. **Add Guidance System:** Register guidance dictionary in `src/data/guidanceData.ts`, wrap interactive elements in `GuidanceTooltip`, and mount `OnboardingTourModal`.
4. **Implement Printer Subsystem:** Create `printerService.ts` generating binary ESC/POS streams for 58mm/80mm layouts with Web Bluetooth discovery (`ManualPrintReceiptModal.tsx`), chunked throttled transmission, and configurable order summary format toggles (GST, fee, table, cashier).
5. **Implement KDS & Inventory:** Create live kitchen tickets with prep stage advancement that automatically deducts recipe ingredient grammages from inventory ledger. Render an interactive Recharts Supply Chain Summary Chart (`InventoryScreen.tsx`) visualizing low-stock items vs menu categories with defect drills.
6. **Implement Native Clients:** Structure WPF XAML (`WindowsAppClient.tsx`) with raw Win32 spooler hooks and Jetpack Compose customer Android client (`AndroidAppClient.tsx`) for table QR code scanning, seat booking, and ordering.
7. **Implement Hardware Audit & Print Logs:** Integrate an auditable logging subsystem (`printLogs`, `PrintLogEntry`) into `OrdersScreen.tsx` (`PrintLogsSection.tsx`) tracking transmission timestamps, payloads, byte counters, status flags (success/failed), stack traces, and one-click failure retries.

