# TSOS Multi-Surface Architecture & Comprehensive Page Mapping

This document provides a complete technical and functional catalog of all surfaces in TSOS (The Simple Operating System), detailing their components, routes, linked pages, and real-time interaction flows.

---

## 1. Overview of the 5 TSOS Surfaces

TSOS is architected as an **omnichannel cafe & restaurant OS**, operating across 5 specialized execution surfaces connected by a unified reactive state layer and offline-resilient local storage.

```
                               ┌──────────────────────────────────────────────┐
                               │             TSOS Unified Store               │
                               │   (Menu, Orders, KDS, Loyalty, Inventory)    │
                               └──────────────────────┬───────────────────────┘
                                                      │
         ┌───────────────────┬────────────────────────┼────────────────────────┬───────────────────┐
         │                   │                        │                        │                   │
         ▼                   ▼                        ▼                        ▼                   ▼
┌──────────────────┐ ┌────────────────┐ ┌──────────────────────────┐ ┌────────────────┐ ┌────────────────┐
│   Surface 1:     │ │  Surface 2:    │ │       Surface 3:         │ │  Surface 4:    │ │  Surface 5:    │
│ Web Hub & POS    │ │ Windows Desktop│ │ Android / iOS Handheld   │ │ QR Storefront  │ │ Live Tracking  │
│ (Browser Admin)  │ │ (WinUI 3 POS)  │ │ (Staff Table-Side & POS) │ │ (Guest Mobile) │ │ (Self-Service) │
└──────────────────┘ └────────────────┘ └──────────────────────────┘ └────────────────┘ └────────────────┘
```

---

## 2. Surface Catalog & Page Breakdown

### Surface 1: Web Management Hub & Counter POS (`activeSurface: 'web'`)
The full-scale desktop browser interface used by cafe owners, managers, cashiers, and head baristas.

| Web Tab | Icon / ID | Key Capabilities & What It Consists Of | Links & Interactions |
| :--- | :--- | :--- | :--- |
| **POS Register** | `pos` | Visual category grid, fast search, product variants (Hot/Iced/Oat), add-ons, split bills, customer attachment, loyalty redemption, tip calculation, quick discounts, cash/UPI QR/card checkout, ESC/POS thermal printing. | Links to **Receipts Modal**, **Manual Print Modal**, **Loyalty Member Lookup**, and pushes tickets straight to **KDS**. |
| **KDS (Kitchen)** | `kds` | Real-time Kanban station ticket queue (`new` -> `preparing` -> `ready`), visual ticket timers, audio chimes, table indicators, modifier highlights, 1-click bump bar. | Triggers order status transitions that update **Order Tracking** and **POS**. |
| **Orders Log** | `orders` | Comprehensive audit trail of all historical and active orders, live filters (dine-in, takeaway, delivery), reprint receipt, cancel/refund actions. | Deep-links to specific order receipts and re-print dialogs. |
| **Inventory** | `inventory` | Real-time ingredient tracking (g, ml, pcs), automated recipe consumption deduction per menu item sold, restock logging, low stock alerts, supplier orders. | Connected directly to recipe yields and menu item sales. |
| **Menu Matrix** | `menu` | Visual category builder, item creation, 5% GST tax setup, recipe mapping, veg/non-veg flags, variant & addon modifiers, out-of-stock toggles. | Controls live catalogs visible in **POS**, **Windows**, **Android**, and **QR Storefront**. |
| **Tables & Floor**| `tables` | Interactive floor plan, seating capacity, table occupancy status (`free`, `occupied`, `reserved`), unique QR code generation for every table with 1-click test launcher. | Generates QR tokens that route guests directly to **Surface 4 (QR Storefront)** with table context. |
| **Customers & CRM**| `customers` | TSOS Club loyalty ledger, 4-tier engine (Bronze, Silver, Gold, Platinum), points adjustment tools, and **Receipt History** (expandable line item bills, ESC/POS re-print, and direct email copy dispatch). | Links customer profile to **POS Checkout** with 1-click points redemption. |
| **Offers & Promos**| `offers` | Coupon codes (percentage, flat amount, BOGO), minimum order thresholds, date validity rules, and active toggles. | Auto-validated during cart calculations in **POS** and **QR Storefront**. |
| **Staff & Shifts** | `shifts` | Cash drawer management, opening float, cash drops, register reconciliation, shift handover summaries, staff role PIN validation. | Reconciles end-of-day register totals with recorded POS cash payments. |
| **Reports** | `reports` | Daily sales graphs, hourly traffic heatmaps, top-selling coffee beans & food items, category revenue breakdown, GST tax summary, CSV exports. | Aggregates data from all connected surfaces. |
| **Settings** | `settings` | Cafe profile, address, GSTIN, thermal printer pairing (Bluetooth/USB 58mm & 80mm), platform fee pass-through rules, system sound toggles. | Applies business configuration across all surfaces. |

---

### Surface 2: Windows Native POS Client (`activeSurface: 'windows'`)
Simulates the **WinUI 3 / WPF Windows desktop application** engineered for high-volume counter terminals, touchscreens, and hardwired USB/COM thermal receipt printers.
- **Components Included**:
  - Full-screen fast POS grid with numeric keypad support
  - Native hardware status bar (USB Thermal ESC/POS Printer, Cash Drawer, Barcode Scanner, Network Ping)
  - Raw ESC/POS byte sequence compiler with paper cut commands
  - Offline sync queue indicator with auto-retry
- **Links**: Fast-switch toggle back to the Web Hub or Mobile Staff surface via top surface switcher.

---

### Surface 3: Android / iOS Handheld Staff Client (`activeSurface: 'android'`)
Simulates the **Kotlin / Swift mobile handheld app** utilized by cafe floor staff and waiters for table-side ordering, mobile billing, and portable Bluetooth thermal printing.
- **Components Included**:
  - Compact mobile-first category bar and item cards
  - Table-side order taker with quick seat selection
  - Portable 58mm Bluetooth thermal printer integration
  - Fast camera QR barcode scanner for loyalty member scanning
  - Mobile bottom navigation: `Register`, `Tables`, `Queue`, `Settings`
- **Links**: Synced with kitchen KDS in real time; creates tickets identical to counter POS.

---

### Surface 4: Customer Table-Side QR Storefront (`activeSurface: 'storefront'`)
The zero-install mobile web application launched by customers scanning the QR code sticker on their dining table.
- **Components Included**:
  - Cafe branding header with table banner (e.g. *Table 4 • Dine-In*)
  - Dietary filters (All, Pure Veg, Non-Veg, High Protein, Specialty Brews)
  - Item detail bottom-sheet with customizable milk variants, syrups, temperature options, and kitchen notes
  - Floating cart preview bar with live subtotal, 5% GST, and platform fee breakdown
  - Instant UPI QR & Card pay checkout
  - TSOS Club loyalty points phone-lookup
- **Links**: On order submission, smoothly forwards the guest to **Surface 5 (Live Order Tracking)** with their generated order number.

---

### Surface 5: Live Visual Order Tracking (`activeSurface: 'order_track'`)
The real-time self-service order tracking screen displayed to guests after ordering via QR or at self-service kiosks.
- **Components Included**:
  - Animated 4-stage progress tracker: `Received` ➔ `In the Kitchen / Brewing` ➔ `Ready for Pickup / Table Delivery` ➔ `Completed`
  - Itemized order recap with allergen notes
  - Live kitchen estimated prep time countdown timer
  - Contact cafe & help buttons
- **Links**: Allows guests to browse the menu again or place an additional add-on order.

---

## 3. Explaining "Marketing V1 vs V2, Sources & SQL Tabs"

Users and developers reviewing enterprise POS systems and analytics suites frequently see references to:

1. **Marketing V1 vs Marketing V2**:
   - **Marketing V1 (Static Rules & Coupons)**: Traditional promotional codes with fixed percentage or flat discounts (e.g., `WELCOME50`, `COFFEE15`), managed in the **Offers** tab.
   - **Marketing V2 (Automated Lifecycle & Tier Triggers)**: Modern behavioral marketing integrated with TSOS Loyalty. Automatically sends automated WhatsApp/SMS/Email triggers based on customer cohorts (e.g., *7-day absent high-value Gold customers*, *Birthday double points perks*, or *Post-order review requests*).
2. **Sources (Acquisition & Channel Attribution)**:
   - Tracks which ordering channels generate revenue: **Counter POS Dine-In**, **Table-side QR Storefront**, **Takeaway Kiosk**, and **Third-Party Integrations**.
   - Enables operators to see average spend differences between cashier-assisted orders and self-service QR orders.
3. **SQL & Raw Data Query Tabs**:
   - In enterprise reporting, the SQL/Query interface provides direct access to export structured order, inventory ledger, and loyalty event data for ERP systems (Tally, Zoho, SAP) or custom business intelligence dashboards.
