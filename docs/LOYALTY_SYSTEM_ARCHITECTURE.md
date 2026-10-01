# TSOS Loyalty Points System & CRM Architecture

This document provides a comprehensive technical and operational specification for the **Loyalty Points System** in TSOS (The Restaurant & Cafe Operating System).

---

## 1. Executive Summary

The TSOS Loyalty Engine is designed to drive repeat footfall, increase average order value (AOV), and provide real-time point accrual and redemption across Point of Sale (POS), QR Storefronts, and Back-Office CRM.

### Core Value Proposition:
- **Automatic Accrual:** 1 Loyalty Point earned for every ₹10 spent on order subtotal (10% reward yield).
- **Instant POS Redemption:** 1 Loyalty Point = ₹1 deduction on the order total.
- **Registration Incentive:** +25 Loyalty Points credited instantly upon new guest registration.
- **Dynamic Tier Progression:** Bronze, Silver, Gold, and Platinum tiers calculated in real-time based on active point balance.
- **Immutable Ledger Audit Trail:** Every point credit, debit, and manual adjustment is tracked in an auditable double-entry ledger.

---

## 2. Loyalty Rules & Mathematical Model

### 2.1 Earning Formula
Points are calculated strictly on the **subtotal** of the order (before GST and platform fee):

$$\text{Points Earned} = \left\lfloor \frac{\text{Order Subtotal}}{10} \right\rfloor$$

*Example:*
- An order with items subtotal of **₹480** earns $\lfloor 480 / 10 \rfloor = \mathbf{48\text{ points}}$.
- An order with items subtotal of **₹1,255** earns $\lfloor 1255 / 10 \rfloor = \mathbf{125\text{ points}}$.

Points are accrued immediately upon order creation, with full ledger reconciliation when the order transitions to `completed` in the Kitchen Display System (KDS) or POS.

### 2.2 Redemption Formula
Redemption at the POS follows a direct 1:1 monetary valuation:

$$\text{Monetary Discount} = \text{Points Redeemed} \times ₹1.00$$

#### Constraints:
1. **Balance Limit:** A customer cannot redeem more points than their current active balance.
2. **Subtotal Cap:** The maximum redeemable points for any transaction cannot exceed the order subtotal minus existing promotional discounts:
   $$\text{Max Redeemable Points} = \min(\text{Customer Points}, \lfloor \text{Subtotal} - \text{Promotional Discounts} \rfloor)$$
3. **Preset Quick Actions:** The POS Cart Drawer provides 1-click redemption presets (`₹25`, `₹50`, `₹100`, `Max Redeemable`) and real-time removal.

### 2.3 Tier Thresholds & Progression
Customers are dynamically categorized into tiers based on their current active loyalty points:

| Tier | Points Range | Badge Styling | Privilege / Experience |
| :--- | :--- | :--- | :--- |
| **Bronze** | `0 – 99 pts` | Amber/Brown (`#FFF1E6`) | Standard guest entry, welcome bonus |
| **Silver** | `100 – 249 pts` | Cool Slate/Steel (`#E2E8F0`) | Priority kitchen queuing, birthday perk |
| **Gold** | `250 – 499 pts` | Warm Gold (`#FEF3C7`) | VIP seating preference, special events |
| **Platinum** | `500+ pts` | Royal Violet (`#F3E8FF`) | Dedicated manager greeting, max perks |

Tier calculation is computed via the deterministic helper:
```typescript
export function getCustomerTier(points: number): LoyaltyTier {
  if (points >= 500) return 'Platinum';
  if (points >= 250) return 'Gold';
  if (points >= 100) return 'Silver';
  return 'Bronze';
}
```

---

## 3. Data Schema & Types

### 3.1 `Customer` Interface (`/src/types.ts`)
```typescript
export type LoyaltyTier = 'Bronze' | 'Silver' | 'Gold' | 'Platinum';

export interface Customer {
  id: string;
  business_id: string;
  name: string;
  phone: string;
  email?: string;
  loyalty_points: number;
  total_orders: number;
  total_spent: number;
  created_at: string;
  tier?: LoyaltyTier;
}
```

### 3.2 `LoyaltyLedger` Interface (`/src/types.ts`)
An append-only audit trail that guarantees non-repudiation of loyalty transactions:
```typescript
export interface LoyaltyLedger {
  id: string;
  customer_id: string;
  points_delta: number;   // Positive for earned/bonus, negative for redeemed
  reason: string;         // e.g., 'Earned from Order #1004', 'Redeemed at POS'
  ref_order_id?: string;  // Linked order ID
  created_at: string;     // ISO timestamp
  balance_after: number;  // Running point balance after operation
}
```

### 3.3 `Order` Interface Updates
```typescript
export interface Order {
  // ... core order fields
  customer_id?: string;
  customer_name?: string;
  customer_phone?: string;
  loyalty_points_earned?: number;
  loyalty_points_redeemed?: number;
  // ... financial breakdown
}
```

---

## 4. Operational Flows

### 4.1 New Customer Enrollment
1. Operator navigates to **CustomersScreen** and clicks **"Register New Customer"**.
2. Operator enters Name, Mobile Phone (10 digits), and optional Email.
3. Upon submission:
   - Customer document created with `loyalty_points: 25` and `tier: 'Bronze'`.
   - Initial `LoyaltyLedger` entry recorded: `+25 pts` with reason `"New Member Registration Bonus"`.
   - Customer is instantly available for selection at the POS and assigned a digital membership card.

### 4.2 Attaching Customer & Redeeming at POS
1. In the POS **CartDrawer**, operator clicks **"Attach Customer"** or picks from the fast-search dropdown.
2. The UI renders the customer's:
   - Full Name and Avatar
   - Current Tier Badge (`Bronze`, `Silver`, `Gold`, `Platinum`)
   - Current Available Balance (`140 pts = ₹140`)
   - Projected Points to be Earned on current cart (`Earns +18 pts`)
3. When cart contains items, the **Redeem Loyalty Points** panel reveals:
   - Quick chips: `Use ₹25`, `Use ₹50`, `Use ₹100`, `Use Max (₹X)`.
   - Clicking a chip applies the discount, updates the `discountTotal`, and adjusts the `grandTotal`.
   - Operator can remove or modify the redeemed points at any time before payment.
4. On completing payment in `PaymentModal`:
   - Customer's point balance is decremented by the redeemed amount.
   - A redemption ledger record is committed with reference to `newOrder.id`.
   - Thermal Receipt displays a dedicated **TSOS Club Loyalty** section with points redeemed and discount received.

### 4.3 Points Accrual on Order Completion
1. When the order transitions to `'completed'` in the Kitchen Display System (KDS) or Orders view:
   - System calculates `pointsEarned = Math.floor(subtotal / 10)`.
   - Customer document is updated:
     - `loyalty_points += pointsEarned`
     - `total_orders += 1`
     - `total_spent += order.grand_total`
     - `tier = getCustomerTier(newBalance)`
   - Accrual record added to `loyaltyLedgers` noting the order number and subtotal value.

### 4.4 Manager Adjustments & Service Recovery
1. In the **CustomersScreen**, clicking **"Adjust"** opens the `CustomerLoyaltyModal` under the **Manual Points Adjustment** tab.
2. Manager can add or subtract points (preset chips `+25`, `+50`, `+100`, `-25`, `-50` or custom numeric value).
3. Manager selects reason from standard categories:
   - *Staff Points Bonus (Customer Appreciation)*
   - *Birthday Celebration Bonus*
   - *Customer Satisfaction / Service Recovery (delayed order, wrong item)*
   - *Special Festival Promotion Gift*
   - *Manual Balance Correction*
4. System validates new balance ($\ge 0$), commits change to state, updates tier, and appends audit log.

---

## 5. UI/UX Architecture

- **`CustomersScreen.tsx`**:
  - Filterable by all 4 tiers (`All`, `Bronze`, `Silver`, `Gold`, `Platinum`) and multi-field text search.
  - KPI cards: Total Registered Guests, Total Active Points Balance, Lifetime Points Redeemed, Average Points per Guest.
  - Interactive table with tier milestone progress bars (e.g., *To Gold: 110 pts needed*).
  - Modal with 3 sub-views: Points Ledger, Manual Adjustments, and Linked Order History.
- **`CartDrawer.tsx`**:
  - Customer attachment card with dynamic tier badges.
  - 1-click redemption presets and real-time subtotal discount rendering.
- **`PaymentModal.tsx`**:
  - Detailed loyalty discount breakdown and pending points accrual notice.
- **`ReceiptModal.tsx`**:
  - Thermal printing format with dedicated TSOS Club section.
