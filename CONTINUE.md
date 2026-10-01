# TSOS PRODUCTION ROADMAP & MONOREPO MIGRATION BLUEPRINT (`CONTINUE.md`)

> **FOR ANTIGRAVITY / AI CODING AGENT**:
> This document is the definitive execution blueprint for refactoring the unified TSOS prototype into an enterprise-grade multi-target monorepo. Execute every step, directory split, component extraction, and native bridge exactly as specified below.

---

# ============================================================
# HIGHEST PRIORITY — AUTHORITATIVE SYSTEM DESIGN
# ============================================================

> **CRITICAL OVERRIDE DIRECTIVE**:
> The following System Design and Security Architecture is the **AUTHORITATIVE** architecture for this project.
> If any previous instruction, previous implementation, existing code pattern, old backend architecture, inferred architecture, or AI-generated assumption conflicts with this specification, **THIS SPECIFICATION TAKES PRIORITY**.
> Do not simplify, reinterpret, remove, or replace these requirements.
> The platform must be implemented as a **TRUE MULTI-TENANT CAFE ORDERING PLATFORM** with strict tenant isolation and cryptographically validated table-specific QR ordering.

---

## 0. AUTHORITATIVE PLATFORM & BACKEND ARCHITECTURE

- **Production Platform**: `https://tablesideordering-web.vercel.app/`
- **Existing Core Functionality**: Must be preserved and further developed across POS, KDS, inventory, tables, CRM, and customer storefront.
- **Backend Architecture**: **SUPABASE**
  - **Supabase Auth** (Email + password, session tokens)
  - **PostgreSQL Database**
  - **Row Level Security (RLS)** on all tenant tables
  - **Supabase Storage** (Menu images, receipt attachments)
  - **Secure Server-Side Database Functions / RPCs** for table token verification and order placement
  - *Do NOT preserve the previous backend architecture merely for compatibility.*

---

## 0.1 MULTI-TENANT MODEL — HIGHEST PRIORITY
The platform hosts multiple independent cafes/businesses.
Example: **CoolKafe**
Owner: **coolkafe@gmail.com**

After authentication, the owner must **ONLY** be able to access resources belonging to the cafe/location(s) they are authorized to manage:

```text
coolkafe@gmail.com
        │
        ▼
Tenant Scoping Layer
        │
        ├── business_id = biz_coolkafe
        ├── location_id = loc_1
        └── slug = coolkafe
```

Everything inside the application must be scoped through this tenant relationship.
Cafe owners must **NEVER** be able to access another cafe's:
- menu & categories
- ingredients & recipe mappings
- orders & line items
- customers & loyalty ledgers
- tables & floor layouts
- shifts & cash drawer float reconciliations
- POS data & KDS tickets
- analytics, GST reports, & platform fee settings
- staff & memberships
- or any other tenant-owned resource.

---

## 0.2 LOCATION-LEVEL DATA ISOLATION (RLS REQUIRED)
Every location-owned operational table must contain an appropriate `location_id` / tenant relationship:
`orders.location_id`, `menu_items.location_id`, `tables.location_id`, `categories.location_id`, `ingredients.location_id`, `recipes.location_id`, `customers.location_id`, `shifts.location_id`.

> **CRITICAL**: Do NOT depend on frontend filtering for isolation.
> Executing `SELECT * FROM orders` and filtering inside React is **STRICTLY FORBIDDEN** and unacceptable as the security model.
> Authorization must be enforced at the database level by PostgreSQL / Supabase Row Level Security (RLS).

The effective security model:
$$\text{Authenticated Identity} + \text{Authorized Membership} + \text{Tenant/Location Relationship} + \text{Requested Resource} = \text{Authorization Decision}$$

---

## 0.3 AUTHENTICATION & MEMBERSHIP-BASED ACCESS CONTROL
Use **Supabase Auth**:
```text
auth.users
    │
    ▼
cafe_memberships (user_id, business_id, location_id, role, status)
    │
    ▼
business / location
```

The authenticated session determines which business/location data the user is authorized to access.
- **Do NOT trust** `cafe_id`, `business_id`, or `location_id` provided by the browser headers or request bodies.
- A malicious client must not be able to modify `location_id = loc_2` in the payload and obtain or alter another cafe's data.
- Support multi-role architecture: `owner`, `manager`, `staff`, `kitchen`.

---

## 0.4 ROUTE HIERARCHY — AUTHORITATIVE
Use the following route structure:

- **PUBLIC AUTH**:
  - `/login` ➔ Cafe owner / staff authentication

- **CAFE MANAGEMENT (Authenticated)**:
  - `/:cafeSlug/pos` ➔ Authenticated Counter POS Register
  - `/:cafeSlug/kds` ➔ Authenticated Kitchen Display System Bump Bar
  - `/:cafeSlug/tables` ➔ Authenticated Floor / Table Management & Printable QR Generator

- **CUSTOMER TABLE ORDERING (Public / Session Verified)**:
  - `/:cafeSlug/:tableId?token=<secure-token>` ➔ Public customer table ordering session

Examples:
- `https://tablesideordering-web.vercel.app/coolkafe/pos`
- `https://tablesideordering-web.vercel.app/coolkafe/kds`
- `https://tablesideordering-web.vercel.app/coolkafe/tables`
- `https://tablesideordering-web.vercel.app/coolkafe/t1?token=<TABLE_1_SECURE_TOKEN>`
- `https://tablesideordering-web.vercel.app/coolkafe/t2?token=<TABLE_2_SECURE_TOKEN>`

---

## 0.5 PHYSICAL TABLE QR ARCHITECTURE & ANTI-TAMPER SECURITY
Every physical cafe table has a unique identity (e.g. Table 1 ➔ `t1`, Table 2 ➔ `t2`).
A QR code is generated for each physical table containing a cryptographically secure random token:
- Table 1 QR: `/coolkafe/t1?token=<TABLE_1_SECURE_TOKEN>`
- Table 2 QR: `/coolkafe/t2?token=<TABLE_2_SECURE_TOKEN>`

The QR code is physically printed and attached to the table.

### Anti-Tamper QR Security — Critical Server Enforcement
The system **MUST** prevent a customer from changing `/coolkafe/t1` to `/coolkafe/t2` in their address bar and ordering against Table 2.
- **Enforced Server/Database-Side**: This must NOT rely on frontend JavaScript alone.
- Tokens must be generated using a cryptographically secure random generator (e.g. `crypto.randomBytes(32).toString('hex')` or PostgreSQL `gen_random_uuid()`) and stored in the database.
- Do NOT use `t1`, `t2`, sequential IDs, timestamps, or easily predictable hashes as the security credential.

```text
Physical QR Scan
      │
      ▼
/coolkafe/t1?token=<TABLE_1_TOKEN>
      │
      ▼
Resolve Cafe (coolkafe)
      │
      ▼
Resolve Table (t1)
      │
      ▼
Validate Token in Database
      │
      ▼
Validate Table Belongs to Location & is Active
      │
      ▼
Establish Customer Table Session in Database
      │
      ▼
Allow Menu Viewing & Ordering
```

### URL Tampering Behavior:
If a customer scans Table 1's QR (`/coolkafe/t1?token=<T1_TOKEN>`), then manually edits the URL to `/coolkafe/t2?token=<T1_TOKEN>`:
1. Server validation rejects the request: Token belongs to `t1`, requested table is `t2` ➔ **VALIDATION FAILS**.
2. The customer does **NOT** obtain a Table 2 ordering session.
3. The UI renders the `ShieldAlert` state:
   > *"Table verification failed. Please scan the QR code attached to this table."*
4. **Ordering remains locked**: Add to Cart, Cart Checkout, and Order Submission buttons are completely disabled.

### Security Boundary:
The visual `ShieldCheck` and `ShieldAlert` components are **UX representations** of the security state. **They are NOT the security boundary.**
Actual security exists in:
- Supabase / PostgreSQL Row Level Security (RLS)
- Server-side validation via secure RPC / Edge Functions (`verify_table_session`, `submit_customer_order`)
- Validated table / session relationships
A malicious user must **never** be able to bypass security by editing React state, modifying JavaScript in DevTools, intercepting network requests, manipulating `localStorage`, or calling Supabase client APIs directly.

---

## 0.6 SUPABASE RLS & DATABASE POLICIES (MANDATORY)

Every table has RLS enabled:
```sql
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE cafe_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE dining_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_ledgers ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
```

### RLS Helper Function:
```sql
CREATE OR REPLACE FUNCTION auth_user_has_location_access(target_location_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM cafe_memberships
    WHERE user_id = auth.uid()
      AND location_id = target_location_id
      AND status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Example Policy Pattern:
```sql
-- Orders policy: Staff can only SELECT/UPDATE orders for their authorized location
CREATE POLICY "Tenant isolation for orders"
ON orders FOR ALL
USING (auth_user_has_location_access(location_id));

-- Public customer order creation: Handled via secure SECURITY DEFINER RPC
CREATE OR REPLACE FUNCTION submit_customer_order(
  p_session_token TEXT,
  p_items JSONB,
  p_customer_name TEXT,
  p_customer_phone TEXT
) RETURNS JSONB AS $$
DECLARE
  v_table_record RECORD;
  v_order_id UUID;
BEGIN
  -- Validate active table session
  SELECT t.id, t.location_id, t.business_id INTO v_table_record
  FROM dining_tables t
  JOIN table_sessions s ON s.table_id = t.id
  WHERE s.session_token = p_session_token AND s.expires_at > NOW() AND s.status = 'active';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unauthorized: Invalid or expired table session token';
  END IF;

  -- Create order bound to validated location and table
  INSERT INTO orders (location_id, table_id, order_type, status, customer_name, customer_phone, grand_total)
  VALUES (v_table_record.location_id, v_table_record.id, 'dine_in', 'pending', p_customer_name, p_customer_phone, 0)
  RETURNING id INTO v_order_id;

  RETURN jsonb_build_object('order_id', v_order_id, 'status', 'success');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## 0.7 SECURITY TEST MATRIX (15 MANDATORY TEST SCENARIOS)

The AI and automated test suites **MUST** verify each of these 15 scenarios:

| # | Test Scenario | Action Performed | Expected Result |
| :--- | :--- | :--- | :--- |
| **1** | CoolKafe Owner ➔ CoolKafe POS | Logged in as `coolkafe@gmail.com` accessing `/coolkafe/pos` | **ALLOW** |
| **2** | CoolKafe Owner ➔ OtherCafe POS | Logged in as `coolkafe@gmail.com` accessing `/othercafe/pos` | **DENY** (403 Forbidden) |
| **3** | CoolKafe Owner ➔ CoolKafe Menu | Fetching menu items for CoolKafe | **ALLOW** |
| **4** | CoolKafe Owner ➔ OtherCafe Menu | Attempting to fetch or mutate OtherCafe menu items | **DENY** (0 rows returned via RLS) |
| **5** | CoolKafe Owner ➔ CoolKafe Orders | Fetching orders for CoolKafe | **ALLOW** |
| **6** | CoolKafe Owner ➔ OtherCafe Orders | Attempting to query OtherCafe orders via Supabase client | **DENY** (RLS rejects query) |
| **7** | Valid Table 1 QR Scan | Guest visits `/coolkafe/t1?token=T1_TOKEN` | **ALLOW** (Table 1 ordering unlocked) |
| **8** | URL Tampering (`/t1` ➔ `/t2` with T1 Token) | Guest changes address bar to `/coolkafe/t2?token=T1_TOKEN` | **DENY** (Validation fails, ordering locked) |
| **9** | Missing Token | Guest visits `/coolkafe/t1` (no token parameter) | **DENY** (Verification required screen) |
| **10** | Table 2 Token on Table 1 | Guest visits `/coolkafe/t1?token=T2_TOKEN` | **DENY** (Token does not match table t1) |
| **11** | Cross-Cafe Token Replay | Guest visits `/othercafe/t1?token=COOLKAFE_T1_TOKEN` | **DENY** (Token belongs to another tenant) |
| **12** | Direct Order Payload Tampering | Guest submits order payload with altered `table_id = t2` | **DENY** (RPC enforces validated session table) |
| **13** | Direct Location Tampering | Guest submits order payload with altered `location_id = other_loc` | **DENY** (RPC derives location from server context) |
| **14** | Unauthenticated Staff Route Access | Guest attempts visiting `/coolkafe/pos` or `/coolkafe/kds` | **DENY** (Redirect to `/login`) |
| **15** | Direct UUID Manipulation | Authenticated CoolKafe owner queries resource by OtherCafe UUID | **DENY** (RLS blocks access) |

---

## 0.8 IMPLEMENTATION PRIORITY & ACCEPTANCE CRITERIA

### Implementation Priority:
1. **Tenant Isolation**
2. **Authentication / Authorization**
3. **QR / Table Security**
4. **Database Integrity & RLS**
5. **Existing Core Functionality** (POS, KDS, Inventory, Shifts, CRM)
6. **POS / KDS / Order Workflows**
7. **UI / UX**
8. **Visual Polish**

*Never sacrifice items 1–4 for convenience or frontend simplicity.*

### Final Acceptance Condition:
The implementation is **NOT** complete merely because:
- The UI looks correct
- QR codes render on the screen
- URLs navigate properly
- The dashboard displays the correct cafe name

It is complete **ONLY** when:
- Tenant isolation is enforced at the database level
- Supabase RLS is active and tested
- Supabase Auth works with membership authorization
- Cryptographic table tokens work and prevent URL tampering
- Direct API / database manipulation cannot bypass authorization
- All existing core platform functionality (POS, KDS, inventory, thermal printing, loyalty) works seamlessly.

---

## 0.9 SAAS TRANSFORMATION & SUPERADMIN PLATFORM (AUTHORITATIVE)

### 0.9.1 Platform Transition: PaaS to SaaS Subscription Model
The platform is an enterprise-grade **Multi-Tenant SaaS Platform** operating on a recurring monthly subscription model:
- **Starter Cafe**: ₹1,499/mo (Up to 8 tables, 3 staff, standard QR & POS)
- **Growth Bistro**: ₹2,999/mo (Up to 20 tables, 8 staff, split billing, loyalty engine, KDS)
- **Pro Artisan**: ₹4,999/mo (Up to 50 tables, 25 staff, full inventory recipe deduction, multi-counter POS)
- **Enterprise Chain**: ₹9,999/mo (Unlimited tables & staff, multi-location franchise management)

### 0.9.2 SuperAdmin / DeveloperAdmin Operations Panel (`/superadmin`)
A dedicated, first-class surface (`activeSurface: 'superadmin'`) isolated from cafe tenant views:
- **Platform Telemetry Dashboard**: Real-time SaaS MRR, total active paying tenants, trial conversions, platform order counts, lifetime GMV, and backend health status.
- **Tenant Business Directory**: Full CRUD management of all tenant businesses (`name`, `legal_name`, `slug`, `business_type`, `owner_email`, `gst_number`, `upi_id`, `status`).
- **Lifecycle Transitions**: Toggle business status between `trial`, `active`, `past_due`, `suspended`, and `archived`.
- **Subscription & Custom Deals Engine**: Modify subscription plans on the fly, apply percentage discounts (e.g. 10%–50% Founder deals), record deal contract rationale, and compute live monthly rates.
- **Zero-Trust Administrative Audit Trail**: Append-only log of every administrative mutation, status change, and tenant provisioning with actor timestamp.

### 0.9.3 9-Step New Business / Cafe Provisioning Wizard
A guided wizard for SuperAdmins to onboard new cafe owners:
1. **Business Identity**: Cafe name, legal entity, brand display name, auto-derived kebab-case slug (`/:slug`), category.
2. **Owner Account**: Full name, primary email (`coolkafe@gmail.com`), phone, initial terminal lock PIN.
3. **Tax & KYC**: GSTIN (for 5% GST receipt printing), PAN, FSSAI food license number.
4. **Physical Location**: Street address, city, state, postal code.
5. **Settlement & UPI**: Direct merchant UPI handle (`cafe@okaxis`), bank details for instant QR settlement.
6. **SaaS Subscription & Deals**: Plan selection, evaluation trial period (0/7/14/30 days), custom deal discount %.
7. **Initial Configuration**: Dining table count generator, starter menu template (Artisan Coffee vs Casual Dining), cryptographic anti-tamper token enforcement toggle.
8. **Final Review**: Comprehensive structured parameter review card.
9. **Atomic Provisioning & Launch**: Creates tenant rows, initializes database seed tables, generates direct production URLs (`/:slug/pos`, `/:slug/tables`, `/:slug/t1?token=...`).

---

## 1. PROJECT TARGET DIRECTORY STRUCTURE

Transform the repository into a high-performance monorepo supporting 4 isolated production targets and a shared core engine:

```text
/
├── apps/
│   ├── webapp/                    # TARGET 1: Admin Hub, Counter POS, KDS & Management Portal
│   ├── customerapp/               # TARGET 2: Guest Table QR Web App & Live Order Tracker
│   ├── windowsapp/                # TARGET 3: High-Volume Windows Native Desktop POS (WinUI / Tauri)
│   └── iosapp/                    # TARGET 4: Staff Handheld Table-Side POS & Order Taker (iOS / iPadOS)
├── packages/
│   ├── core/                      # Shared Types, Financial Formulas, Loyalty Engine, Store
│   ├── hardware/                  # ESC/POS Binary Compiler, Web Bluetooth, USB & Network Print Driver
│   └── ui/                        # Design System Tokens, Theme Provider, Shared Modals, Sound Synthesizer
├── docs/                          # Architectural Specs & Hardware Integration Guides
└── package.json                   # Monorepo Workspace Configuration (pnpm / npm / bun workspaces)
```

---

## 2. DETAILED BREAKDOWN OF TARGET APPS

### TARGET 1: `apps/webapp/` (Management Hub, POS & KDS)
**Stack**: React 18+ (Vite), TypeScript, Tailwind CSS, Zustand, Lucide Icons, Web Audio API.

#### What it consists of & Pages included:
1. **Header & Global Status Bar**:
   - Cafe Location Switcher & Shift indicator.
   - Heartbeat Cloud Latency Monitor (`latencyMs`) with offline fallback banner.
   - Master Web Audio sound synthesizer toggle.
   - Quick Cash Register Reconciliation launcher.
2. **POS Counter Register (`/pos`)**:
   - 3-column layout: Visual category filters, high-resolution product cards, fast search (`/` hotkey).
   - Variant customizer modal: Temperature (Hot/Iced), Milk alternatives (Oat, Almond, Soy), Syrups, Roast origins.
   - Cart Drawer: Real-time item additions, quantity multipliers, item-level kitchen notes, quick percentage/flat discounts.
   - Split billing engine: Split evenly (2x, 3x, 4x) or split by individual line item.
   - Loyalty Member Lookup & Redemption: Phone number search with 1-click points redemption.
   - Multi-channel Checkout: Cash (with quick denomination calculators), UPI dynamic QR generation, Card EDC swipe.
   - Hardware trigger: Automatic ESC/POS KOT & Customer Bill print with cash drawer kick pulse.
3. **Kitchen Display System (`/kds`)**:
   - Real-time multi-column Kanban bump bar: `New Tickets` ➔ `In Preparation` ➔ `Ready for Handover`.
   - SLA ticket aging cues: Color-coded headers (Green < 5m, Amber 5-10m, Red > 10m).
   - Audio chimes: Double-ding on new incoming order; harmonic chime on ready.
   - Item modifier highlights: Outlines custom milk substitutions or dietary restrictions in bold orange/red.
4. **Orders Audit Log (`/orders`)**:
   - Master tabular ledger of all historical orders with multi-filter (Dine-in, Takeaway, QR, Delivery).
   - Print history tracker with 1-click duplicate bill or KOT thermal re-print.
   - Refund & order cancellation workflow.
5. **Inventory & Recipe Depletion (`/inventory`)**:
   - Ingredient tracking in fractional units (`g`, `ml`, `pcs`, `kg`, `l`).
   - Automated consumption engine: Every menu item sold automatically deducts mapped recipe ingredients (e.g., 18g espresso beans + 220ml oat milk per Flat White).
   - Low-stock badge alerts & restock log drawer.
6. **Menu Matrix & Category Builder (`/menu`)**:
   - Category management with drag-and-drop sort order.
   - Item creator: Base price, 5% GST tax class, dietary flags (Veg, Non-Veg, Vegan, Gluten-Free).
   - Modifier groups: Required (Size) vs Optional (Add-ons, Extra shots).
   - Recipe mapping matrix: Link menu items directly to inventory raw materials.
7. **Tables & Floor Plan Manager (`/tables`)**:
   - Interactive table layout editor with dynamic occupancy badges (`available`, `occupied`, `billing`).
   - Dynamic Table QR Code generator: Downloads printable vector QR tent cards with pre-encoded table tokens linking to `customerapp/`.
8. **Customer CRM & Receipt History (`/customers`)**:
   - Customer profile directory with TSOS Club tier badges (`Bronze`, `Silver`, `Gold`, `Platinum`).
   - **Receipt History Tab**: Full past order history for selected customer, itemized bill breakdown, thermal re-print, and digital bill email dispatch with `mailto:` fallback.
   - Points Ledger & Manual Adjustment Form: Immutable points credit/debit with staff note audit trails.
9. **Offers & Coupons (`/offers`)**:
   - Discount engine: Percentage off, Flat ₹ discount, BOGO rules, minimum cart value thresholds.
10. **Shift & Cash Reconciliation (`/shifts`)**:
    - Opening float entry, mid-shift cash drops, end-of-day register reconciliation (Expected Cash vs Counted Cash).
11. **Reports & Business Intelligence (`/reports`)**:
    - Net sales, Gross revenue, 5% GST tax collected (CGST/SGST), hourly rush heatmap, top coffee blends, CSV export.
12. **Settings & Hardware Setup (`/settings`)**:
    - Cafe business info, GSTIN/FSSAI numbers.
    - Thermal printer setup: Web Bluetooth, WebUSB, Network IP/Port 9100.
    - Platform Fee configuration: ₹1/order rule, auto-flip threshold from cafe-paid to customer-paid.

---

### TARGET 2: `apps/customerapp/` (Guest QR Storefront & PWA)
**Stack**: React 18+ (Mobile-First / PWA), Tailwind CSS, Lucide Icons, Canvas QR, Web Share API.

#### What it consists of & Pages included:
1. **QR Welcome Screen & Table Resolver (`/?table=t4`)**:
   - Reads URL parameters or stored session to lock the guest's dining table (e.g. *Table 4 • Dine-In*).
   - Cafe branding header with address and dietary badges.
2. **Interactive Digital Menu**:
   - Sticky category navigation bar (Specialty Brews, Manual Drips, Artisanal Bakery, Brunch, Desserts).
   - Dietary filter chips: All, Pure Veg, Non-Veg, High Protein, Dairy-Free.
   - Product bottom-sheet customizer: Select hot/iced variants, milk substitutions, sweetness level, and special kitchen instructions.
3. **Cart & Transparent Tax Breakdown**:
   - Floating cart drawer displaying live item list, modifiers, and quantities.
   - Pricing ledger: Subtotal, 5% GST (2.5% CGST + 2.5% SGST), ₹1.00 platform fee, and Grand Total.
   - Coupon code entry field with instant discount validation.
4. **TSOS Club Loyalty Phone Lookup**:
   - Guest enters their 10-digit mobile number to view their available points balance and apply instant ₹ discounts.
5. **Instant Payment Gateway Simulation**:
   - Dynamic UPI QR Code generator (intent links for Google Pay, PhonePe, Paytm, BHIM).
   - One-click payment confirmation simulation.
6. **Live Visual Order Tracking (`/track/:orderId`)**:
   - Animated 4-step progress tracker: `Received` ➔ `Brewing in Kitchen` ➔ `Ready for Table Delivery` ➔ `Served`.
   - Real-time prep countdown timer based on kitchen load.
   - Allergen note recap and digital receipt download.

---

### TARGET 3: `apps/windowsapp/` (Windows Native Desktop POS)
**Stack**: C# .NET 8 / WinUI 3 (or Tauri 2.0 / Electron with Rust/Node native addons), SQLite (local database), Raw ESC/POS Drivers.

#### What it consists of & Native Features:
1. **High-Speed Touchscreen POS Layout**:
   - Full-screen kiosk mode optimized for 15" - 21" all-in-one POS terminals with high touch-target buttons.
   - Physical numeric keypad integration for instant cash tendered calculations (`Enter` = Pay Cash).
2. **Direct Windows Hardware Subsystems**:
   - **USB Thermal Printer (Direct Spooler / Win32 RAW)**: Bypasses standard Windows XPS print dialogue to send binary byte streams directly to receipt printers (Epson, Citizen, TVS, Star Micronics) in <50ms.
   - **RJ11 Cash Drawer Kick**: Sends hardware pin pulse (`0x1B 0x70 0x00 0x19 0xFA`) on cash transaction finalization.
   - **USB/COM Barcode & Loyalty Scanner**: Native HID keyboard wedge listener for scanning physical customer loyalty cards and pre-packaged coffee bean barcodes.
   - **Customer-Facing Dual Display (Pole Display / Second Screen)**: Second monitor window rendering live cart line items and UPI payment QR code for the guest.
3. **Offline SQLite Database & Dual-Sync Engine**:
   - Local SQLite database storing entire offline catalog and transactions.
   - Background sync worker buffering transactions when internet fails and re-syncing to cloud when online.

---

### TARGET 4: `apps/iosapp/` (Staff Handheld Table-Side POS)
**Stack**: React Native + Expo (or Swift / SwiftUI for iOS / Kotlin for Android), React Native BLE (Bluetooth Low Energy).

#### What it consists of & Handheld Features:
1. **Waiter Table-Side Order Taker**:
   - Compact handheld UI designed for iPhone, iPad Mini, and Android POS handhelds (Sunmi, iMin).
   - Quick table selector grid showing occupied vs free tables.
   - Rapid order creation at the guest's table with instant push to Kitchen KDS.
2. **Portable Bluetooth Thermal Printing**:
   - Native CoreBluetooth / Android Bluetooth integration pairing with portable 58mm belt-clip thermal printers.
   - Instant table-side bill printing and receipt generation.
3. **Camera QR Loyalty Scanner**:
   - Uses device camera with AVFoundation/CameraX for instant QR code scanning of guest loyalty passes.

---

### SHARED PACKAGES (`packages/`)

#### `packages/core/`
- **`types.ts`**: Unified TypeScript types (`Order`, `MenuItem`, `Customer`, `Table`, `Shift`, `FeeConfig`, etc.).
- **`pricing.ts`**: Standardized calculation helper for Subtotal, 5% GST, Discounts, Platform Fees, and Rounding.
- **`loyalty.ts`**: Tier computation logic (`Bronze`, `Silver`, `Gold`, `Platinum`) and ledger math.
- **`store.ts`**: Base Zustand store definition with cross-surface synchronization hooks.

#### `packages/hardware/`
- **`escpos.ts`**: Pure TypeScript byte generator compiling text, bold, alignments, font scaling, line feeds, and paper cuts to `Uint8Array`.
- **`bluetooth.ts`**: Web Bluetooth and React Native BLE printer communication layer.
- **`network.ts`**: TCP Socket client targeting Port 9100 for LAN/Wi-Fi kitchen receipt printers.

#### `packages/ui/`
- **`sound.ts`**: Web Audio API frequency-synthesized chimes (zero dependencies, zero external mp3s).
- **`theme.ts`**: Design tokens, color palette (`#FBF7F2`, `#1C1917`, `#7C3AED`, `#EA580C`), and typography.
- **Components**: `ReceiptModal`, `ManualPrintReceiptModal`, `GuidanceTooltip`, `ConfirmDialog`.

---

## 3. SYSTEM DESIGN: MULTI-TENANT ISOLATION & ANTI-TAMPER TABLE QR SECURITY

### 3.1 Multi-Tenant Cafe Authentication & Data Scoping
- **Production Host Domain**: `https://tablesideordering-web.vercel.app/`
- **Tenant Authentication Flow**:
  - Cafe owners log in with their email and password (e.g., `coolkafe@gmail.com` + password).
  - The authentication layer resolves the owner's `business_id` (e.g. `biz_coolkafe_99`) and `location_id` (e.g. `loc_coolkafe_indiranagar`).
  - **Strict Row-Level Security (RLS) & Tenant Isolation**:
    - Every table in Postgres / Supabase / Firestore contains `business_id` and `location_id`.
    - All queries (`orders`, `menu_items`, `categories`, `ingredients`, `recipes`, `customers`, `shifts`, `tables`) MUST enforce `WHERE location_id = $auth_location_id`.
    - No cafe owner can ever view, query, or leak another cafe's sales, menu, pricing, staff, or customer data.

### 3.2 Secure Table-Side QR Routing & Anti-Tamper Protection
- **Nested Table URLs**:
  - Admin Floor Plan: `https://tablesideordering-web.vercel.app/:cafeSlug/tables`
  - Physical Table QR Code: `https://tablesideordering-web.vercel.app/:cafeSlug/:tableId?token=:hmacSignature`
    - Example: `https://tablesideordering-web.vercel.app/coolkafe/t1?token=8f9a2c3e1b74`
    - Example: `https://tablesideordering-web.vercel.app/coolkafe/t2?token=4a7c1e9f0d23`

- **Anti-Tamper & Anti-Spam Security Rule (Preventing Manual URL Changes)**:
  - **The Problem**: If a guest or prankster sitting at Table 1 manually edits their browser URL bar from `/coolkafe/t1` to `/coolkafe/t2`, they could submit unauthorized spam orders or mix up billing with guests seated at Table 2.
  - **The Cryptographic Shield**:
    1. Every table generates an HMAC-SHA256 signature token: `HMAC_SHA256(cafeSlug + tableId, locationSecretKey)`.
    2. The physical QR code sticker printed for each table encodes the signed token parameter `?token=...`.
    3. When the customer web app loads `/:cafeSlug/:tableId`:
       - The server/client verifies: `isValidTableToken(cafeSlug, tableId, queryToken)`.
       - If the user manually changed the URL (e.g., from `t1` to `t2` without Table 2's valid physical token), verification FAILS.
       - **Security Wall Triggered**:
         - Renders `[ShieldAlert] Tamper Protection Active: Table verification token missing or mismatched.`
         - Completely disables the cart, add-to-cart buttons, and order checkout.
         - Displays clear user guidance: *"Please scan the physical QR code on your table to unlock ordering."*
       - This guarantees zero cross-table spam, zero accidental order hijacking, and 100% table integrity.

---

## 4. MIGRATION & REFACTORING PLAN (FILE-BY-FILE)

### Existing Files to Relocate & Refactor:
| Current Path | Target Monorepo Destination | Modifications Required |
| :--- | :--- | :--- |
| `src/types.ts` | `packages/core/src/types.ts` | Export all domain types as single source of truth. |
| `src/lib/store.ts` | `packages/core/src/store.ts` | Separate sample initial mock data into `packages/core/src/mockData.ts`. |
| `src/lib/sound.ts` | `packages/ui/src/sound.ts` | Export `playChime(type)` utility for Web and Native shells. |
| `src/components/pos/*` | `apps/webapp/src/components/pos/*` | Connect to shared `@tsos/core` and `@tsos/hardware`. |
| `src/components/kds/*` | `apps/webapp/src/components/kds/*` | Standalone KDS view with bump bar shortcuts (F1-F12 keys). |
| `src/components/customers/*` | `apps/webapp/src/components/customers/*` | Includes Receipt History, Re-Print, and Email dispatch modals. |
| `src/components/storefront/*` | `apps/customerapp/src/*` | Make standalone responsive PWA with table QR auto-detection. |
| `src/components/native/WindowsAppClient.tsx` | `apps/windowsapp/src/*` | Upgrade from mockup into full desktop shell (Tauri/WinUI). |
| `src/components/native/AndroidAppClient.tsx` | `apps/iosapp/src/*` | Upgrade into mobile handheld staff client with BLE printer hooks. |

### Files to Remove / Clean Up:
- Deprecate top prototype surface-switcher bar in production builds (`activeSurface: 'web' | 'android' | 'windows' | 'storefront'`) since each app now builds as its own standalone application.
- Maintain unified dev switcher mode ONLY for development and live preview demonstrations.

---

## 4. VERIFICATION & BUILD COMMANDS

When implementing in Antigravity or any agent environment, run:

1. **Install Monorepo Workspaces**:
   ```bash
   npm install
   ```
2. **Typecheck All Packages**:
   ```bash
   npm run lint
   ```
3. **Build Web App**:
   ```bash
   npm run build --workspace=apps/webapp
   ```
4. **Build Customer App**:
   ```bash
   npm run build --workspace=apps/customerapp
   ```
5. **Verify Full App Compilation**:
   ```bash
   npm run build
   ```

---

## 5. COMPLETE PROJECT DOCUMENTATION DIRECTORY INDEX

Antigravity must consult and adhere to all specifications documented in the project repository:

| Document Path | Purpose & What It Governs | Key Directives |
| :--- | :--- | :--- |
| `/PROMPT.md` | Master AI Generation Prompt | Complete domain logic, 5 surfaces, 5% GST tax math, ₹1 platform fee rules, loyalty formula, ESC/POS byte sequence map. |
| `/README.md` | General Overview & Token System | Project intro, styling design tokens, responsive breakpoints, color variables. |
| `/docs/SURFACES_AND_ARCHITECTURE_MAP.md` | Full Surfaces & Screen Matrix | Complete mapping of 5 surfaces, tab navigation, user journeys, Marketing V1 vs V2, Sources attribution, and SQL data access. |
| `/docs/TABLE_SIDE_ORDERING_AND_QR_CLIENT_SPEC.md` | Customer Table-Side QR App | QR routing `/:cafeSlug/:tableId?token=...`, anti-tamper token verification, UPI checkout flow, menu bottom-sheet customizer. |
| `/docs/WINDOWS_NATIVE_CLIENT_SPECIFICATION.md` | Windows Native Client (.NET/WinUI/Tauri) | Direct USB thermal printing, RJ11 cash drawer kick pulse, dual customer-facing pole display, offline SQLite sync. |
| `/docs/MOBILE_NATIVE_CLIENTS_ANDROID_IOS_SPEC.md` | Staff Handheld App (iOS/Android) | Floor staff table-side ordering, portable 58mm Bluetooth thermal printing, camera QR loyalty scanner. |
| `/docs/PRINTER_INTEGRATION_SPECIFICATION.md` | Thermal Hardware & ESC/POS Protocol | Raw byte generator (`ESC @`, `GS !`, `GS V`), Bluetooth GATT service UUIDs, WebUSB, Port 9100 TCP sockets, print audit logs. |
| `/docs/LOYALTY_SYSTEM_ARCHITECTURE.md` | TSOS Club Customer CRM | 4-tier engine (Bronze, Silver, Gold, Platinum), 1 pt / ₹10 earn rate, 1 pt = ₹1 redemption, immutable points ledger. |
| `/docs/INVENTORY_SUPPLY_CHAIN_AND_ANALYTICS_SPEC.md` | Real-time Inventory & Depletion | Recipe ingredient deduction on order completion, fractional unit tracking (g/ml/pcs), restock logging, low-stock alerts. |
| `/docs/CLOUD_SYNC_AND_OFFLINE_RESILIENCE.md` | Offline-First Sync & Networking | Heartbeat latency monitor, offline transaction buffering queue, auto-reconciliation on reconnect. |
| `/docs/SYSTEM_GUIDANCE_AND_ONBOARDING_SPEC.md` | Contextual Help & Staff Onboarding | Guided onboarding tours, cashier tooltips, keyboard hotkeys (`/` search, `Esc` cancel, `Space` pay). |

---

## 6. BACKEND-ONLY PRODUCTION ARCHITECTURE (TRANSITION FROM DEMO TO PRODUCTION)

### 6.1 Eliminate Mock & Seed Data in Production
The current repository serves as a functional client-side demo/prototype with in-memory mock data (`src/data/seedData.ts`) and `localStorage` persistence. For the final end product:
1. **Remove Local Mock Fallbacks**: Deprecate static arrays in `seedData.ts`. All categories, menu items, prices, variants, inventory ingredients, tables, customers, and orders must be retrieved via authenticated API calls.
2. **Dynamic Store Initialization**: The Zustand stores must initialize empty and populate asynchronously via `GET /api/v1/store/bootstrap` or individual endpoint queries upon tenant authentication.

### 6.2 Database Schema & Tenant Scoping (PostgreSQL / Supabase / Prisma)
Every table enforces strict Row-Level Security (RLS) scoped by `business_id` and `location_id`:

```sql
-- 1. Businesses & Locations (Tenants)
CREATE TABLE businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL, -- e.g. 'coolkafe'
  owner_email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) NOT NULL,
  address TEXT,
  phone VARCHAR(50),
  gstin VARCHAR(50),
  fssai VARCHAR(50),
  currency VARCHAR(10) DEFAULT 'INR',
  secret_key VARCHAR(255) NOT NULL, -- Used to sign table QR HMAC tokens
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tables with Anti-Tamper Tokens
CREATE TABLE dining_tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID REFERENCES locations(id) ON DELETE CASCADE,
  table_number VARCHAR(50) NOT NULL, -- 'T1', 'T2'
  seats INT DEFAULT 4,
  status VARCHAR(20) DEFAULT 'available', -- available, occupied, billing, reserved
  qr_token VARCHAR(255) NOT NULL, -- Pre-generated HMAC signature
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Categories & Menu Items
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID REFERENCES locations(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  sort_order INT DEFAULT 0
);

CREATE TABLE menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID REFERENCES locations(id) ON DELETE CASCADE,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  base_price NUMERIC(10, 2) NOT NULL,
  is_veg BOOLEAN DEFAULT TRUE,
  is_available BOOLEAN DEFAULT TRUE,
  image_url TEXT,
  variants JSONB DEFAULT '[]', -- [{ id, name, price_delta }]
  addons JSONB DEFAULT '[]',   -- [{ id, name, price }]
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Recipes & Ingredients
CREATE TABLE ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID REFERENCES locations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100),
  unit VARCHAR(20) NOT NULL, -- 'g', 'ml', 'pcs'
  current_stock NUMERIC(12, 3) NOT NULL DEFAULT 0,
  min_alert_stock NUMERIC(12, 3) NOT NULL DEFAULT 0,
  cost_per_unit NUMERIC(10, 2) DEFAULT 0
);

CREATE TABLE recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_item_id UUID REFERENCES menu_items(id) ON DELETE CASCADE,
  ingredient_id UUID REFERENCES ingredients(id) ON DELETE CASCADE,
  quantity_used NUMERIC(10, 3) NOT NULL -- amount deducted per item sold
);

-- 5. Orders & Line Items
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID REFERENCES locations(id) ON DELETE CASCADE,
  order_number VARCHAR(50) NOT NULL,
  order_type VARCHAR(20) NOT NULL, -- 'dine_in', 'takeaway', 'delivery'
  table_id UUID REFERENCES dining_tables(id) ON DELETE SET NULL,
  customer_id UUID,
  subtotal NUMERIC(10, 2) NOT NULL,
  discount_total NUMERIC(10, 2) DEFAULT 0,
  tax_total NUMERIC(10, 2) NOT NULL, -- 5% GST
  platform_fee NUMERIC(10, 2) DEFAULT 1.00,
  grand_total NUMERIC(10, 2) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending', -- pending, preparing, ready, completed, cancelled
  payment_method VARCHAR(20) DEFAULT 'upi', -- cash, upi, card, split
  payment_status VARCHAR(20) DEFAULT 'paid',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id UUID REFERENCES menu_items(id),
  menu_item_name VARCHAR(255) NOT NULL,
  qty INT NOT NULL,
  unit_price NUMERIC(10, 2) NOT NULL,
  variant_name VARCHAR(100),
  addons JSONB DEFAULT '[]',
  item_total NUMERIC(10, 2) NOT NULL,
  notes TEXT
);

-- 6. Customers & Loyalty Ledger
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID REFERENCES locations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  email VARCHAR(255),
  loyalty_points INT DEFAULT 0,
  lifetime_spent NUMERIC(12, 2) DEFAULT 0,
  tier VARCHAR(20) DEFAULT 'Bronze',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_customer_phone_location UNIQUE(location_id, phone)
);

CREATE TABLE loyalty_ledgers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  points_delta INT NOT NULL,
  reason VARCHAR(255) NOT NULL,
  balance_after INT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 6.3 REST & WebSocket API Endpoints
The backend server (Node.js/Express, NestJS, FastAPI, or Supabase Edge Functions) provides:
- `POST /api/v1/auth/login`: Authenticates cafe owner email + password, returns JWT with `{ business_id, location_id, slug }`.
- `GET /api/v1/:cafeSlug/bootstrap`: Returns tenant configuration, categories, menu items, tables, and active shifts for the authenticated cafe.
- `GET /api/v1/:cafeSlug/tables/:tableId/verify?token=...`: Validates anti-tamper token for guest QR ordering.
- `POST /api/v1/:cafeSlug/orders`: Creates new order, validates pricing server-side, atomically deducts inventory recipe ingredients in a SQL transaction, and broadcasts to KDS over WebSockets.
- `PATCH /api/v1/:cafeSlug/orders/:id/status`: Updates KDS bump bar status (`pending` -> `preparing` -> `ready` -> `completed`).
- `WS /api/v1/:cafeSlug/realtime`: Real-time WebSocket connection streaming order state changes across POS, KDS, and guest order trackers.

---

## 7. NON-NEGOTIABLE OPERATIONAL PRINCIPLES
1. **Zero Math Drift**: Tax calculation (5% GST) and Platform Fee (₹1.00) must yield identical values across all 4 apps.
2. **Offline-First Resilience**: All sales and receipt generation must function without active internet connectivity using local buffering.
3. **Native Hardware Speed**: Receipts must compile to raw ESC/POS bytes without requiring system print dialogs where native drivers exist.
4. **Clean Visual Hierarchy**: Warm artisan coffee aesthetic (`#FBF7F2` neutral canvas, high-contrast dark text, refined purple and orange accents).
