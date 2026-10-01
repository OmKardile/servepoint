# TSOS Table-Side Ordering & Customer QR Client Specification
**Document Version:** 2.0.0 (Authoritative System Design)  
**Target Platform:** Mobile Browser Web App / Progressive Web App (PWA)  
**Production Host:** `https://tablesideordering-web.vercel.app/`  
**Backend:** Supabase (PostgreSQL + RLS + Server-Side RPC / Edge Functions)  
**Security Model:** Cryptographic Random Tokens, PostgreSQL RLS, Server-Side Session Validation

---

## 1. Architectural Overview

TSOS Table-Side Ordering eliminates waitstaff delays by empowering guests to scan an encrypted QR code placed on their dining table, browse the digital menu with high-resolution photography and allergen tags, customize coffee modifiers, and place orders directly to the Kitchen Display System (KDS).

```
+--------------------------------------------------------------------+
|                         Physical Table                             |
|          Sticker / Acrylic Stand with Encrypted Dynamic QR         |
|   https://tablesideordering-web.vercel.app/coolkafe/t1?token=...   |
+---------------------------------+----------------------------------+
                                  |
                                  v
+--------------------------------------------------------------------+
|               Customer Smartphone (Mobile Web / PWA)               |
|                                                                    |
|  [ StorefrontScreen.tsx ]                                          |
|  - Server-Side Token Verification & Session Establishment          |
|  - Anti-Tamper Shield (ShieldCheck vs ShieldAlert)                 |
|  - Category Tabs & Search                                          |
|  - Item Customizer (Milk, Syrups, Ice, Sugar level)                |
|  - Real-Time Table Cart & Running Balance                          |
|  - Customer Phone Attachment (Earn Loyalty Points)                 |
|  - UPI Instant Payment (GPay, PhonePe, Paytm, Cred)                |
|  - Live Kitchen Tracker [ OrderTrackingScreen.tsx ]                |
+---------------------------------+----------------------------------+
                                  |
            HTTPS WebSocket / REST POST /api/v1/orders
                                  |
                                  v
+--------------------------------------------------------------------+
|                           TSOS POS & KDS                           |
|  - Validates session bound to location_id and table_id             |
|  - Auto-accepts order & assigns to Table 1                         |
|  - Auto-prints Kitchen Order Ticket (KOT) on Thermal Printer       |
|  - Deducts recipe ingredients from Inventory ledger                |
|  - Credits 1 Loyalty Point per ₹10 spent to Customer Account       |
+--------------------------------------------------------------------+
```

---

## 2. QR Code URL Schema & Session Security (Authoritative)

### 2.1 Authoritative Production Route Structure
```
https://tablesideordering-web.vercel.app/:cafeSlug/:tableId?token=<SECURE_CRYPTOGRAPHIC_TOKEN>
```
- `:cafeSlug`: Unique slug of the cafe (e.g., `coolkafe`).
- `:tableId`: Semantic table identifier (e.g., `t1`, `t2`, `outdoor3`).
- `token`: Cryptographically secure random token bound to that specific physical table in the database.

### 2.2 Anti-Tamper QR Security (Server Enforcement)
1. **The Problem**: A customer seated at Table 1 manually alters their browser URL bar from `/coolkafe/t1` to `/coolkafe/t2`.
2. **Database Verification**:
   - The backend checks `dining_tables` where `location_id = (SELECT id FROM locations WHERE slug = :cafeSlug)` and `table_number = :tableId` and `qr_token = :token`.
   - If the token belongs to `t1` but the URL requests `t2`, verification **FAILS**.
3. **Ordering Lockout**:
   - The UI renders `ShieldAlert` with: *"Table verification failed. Please scan the QR code attached to this table."*
   - Add to Cart, Cart Checkout, and Order Submission are completely locked.
4. **Zero Client Trust**:
   - Visual shields are UX representations only.
   - Orders submitted via API are strictly rejected if the request payload contains an unverified table or location.

### 2.3 Table Concurrency & Guest Session Locking
1. **Running Table Tabs:** Multiple guests seated at Table T-01 can browse simultaneously. Orders placed by guest smartphones are appended to the table's running open tab.
2. **Server-Side Lock Prevention:** Orders submitted concurrently use an optimistic concurrency token (`table_version`). If an update collides, the client automatically re-fetches and merges line items.

---

## 3. Customer Storefront User Journey (`StorefrontScreen.tsx`)

### 3.1 Digital Menu & Category Browsing
- Sticky category pills: Espresso, Iced Brews, Artisan Bakery, Savory Small Plates, Desserts.
- Dietary tags: **Pure Veg** (Green dot square), **Non-Veg** (Red dot square), **Vegan**, **Gluten-Free**, and **Chef's Signature**.
- Live availability check: Out-of-stock items are disabled in real time with an "86'd / Sold Out" visual badge.

### 3.2 Recipe Customization Dialog
Guests can configure modifiers before adding to cart:
- **Milk Choice:** Whole Milk (Default, +₹0), Oatly Oat Milk (+₹30), Barista Almond Milk (+₹35), Soy Milk (+₹25).
- **Sweetener:** Cane Sugar, Brown Sugar, Sugar-Free Stevia, No Sugar.
- **Espresso Shot:** Standard (Double), Single Shot, Triple Shot (+₹40), Decaf (+₹30).
- **Special Cooking Request:** Freeform text input (e.g., "Make it piping hot", "Dressing on the side").

### 3.3 Cart & Price Transparency
The table-side cart displays:
1. Itemized subtotal
2. CGST (2.5%) + SGST (2.5%)
3. Platform Convenience Fee: If the cafe has configured `default_fee_payer = 'customer'`, a transparent ₹1 line item is displayed. If `default_fee_payer = 'cafe'`, the fee is explicitly marked as "Absorbed by Cafe: ₹0.00".
4. Applicable Coupon Code / Promo Discount.

---

## 4. Payment Methods & UPI Deep Linking

Guests can choose between two checkout modes:
1. **Pay at Counter / Cash after Dining:** Order is dispatched immediately to KDS; the table bill remains in `open` state until the cashier closes it at the main POS.
2. **Instant Digital Payment (UPI Intent / QR):**
   - **Desktop / Tablet scan:** Renders dynamic UPI QR code containing standard NPCI UPI payload:
   ```
   upi://pay?pa=sensoryoasis@icici&pn=TheSensoryOasis&am=727.00&cu=INR&tn=Order-T04-TSOS842
   ```
   - **Mobile Smartphone:** Tapping **Pay with UPI** triggers the native Android/iOS App Chooser launching Google Pay, PhonePe, Paytm, or Cred directly.

---

## 5. Live Kitchen Tracking Screen (`OrderTrackingScreen.tsx`)

Once an order is confirmed, the guest's mobile screen transitions automatically into the live tracker:

### State Machine Lifecycle:
```
[ Order Placed ]  --->  [ In Kitchen Prep ]  --->  [ Ready for Service ]  --->  [ Served / Completed ]
   (Blue Pill)              (Orange Pill)               (Green Pill)                  (Gray Pill)
```

1. **Order Placed (Stage 1):** Ticket has arrived at POS and thermal KOT has printed.
2. **In Kitchen Prep (Stage 2):** Barista has tapped "Start Prep" on the KDS; live progress bar displays estimated time remaining (e.g., "Ready in ~4 mins").
3. **Ready for Service (Stage 3):** Barista has marked ticket ready; device vibrates and chimes acoustic alert.
4. **Served (Stage 4):** Waitstaff has delivered items to Table T-04. Screen displays interactive 5-star rating widget and digital invoice download button.
