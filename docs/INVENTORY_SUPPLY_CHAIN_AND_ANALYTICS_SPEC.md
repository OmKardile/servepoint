# TSOS Inventory, Supply Chain & Culinary Recipe Depletion Specification
**Document Version:** 2.0.0  
**Target Systems:** Cafe Kitchen Inventory, Central Commissary, Ingredient Supply Chain Analytics  
**Component Implementation:** `src/components/inventory/InventoryScreen.tsx`, `RestockOrderModal.tsx`, `useTsosStore`

---

## 1. Architectural Overview

The TSOS Inventory Subsystem provides end-to-end stock tracking from raw bulk ingredients (flour, coffee beans, milk, sugar) to automated per-order recipe depletion during POS checkout and online/mobile table ordering. 

Managers and kitchen head chefs gain immediate visual clarity on replenishment urgency through an integrated **Recharts Supply Chain Analytics Breakdown** that maps low-stock alert thresholds against culinary menu categories.

```
+-------------------------------------------------------------------------+
|                              POS / KDS / QR                             |
|          Order completed: 1x Cappuccino + 1x Artisan Toast              |
+------------------------------------+------------------------------------+
                                     |
                                     v
                 +---------------------------------------+
                 |       Automated Recipe Depletion      |
                 |  Cappuccino: -18g Coffee, -180ml Milk |
                 |  Toast: -2 Slices Bread, -15g Butter  |
                 +-------------------+-------------------+
                                     |
                                     v
          +-----------------------------------------------------+
          |              Zustand Inventory Store                |
          |  Ingredients[] updated with real-time stock levels  |
          +--------------------------+--------------------------+
                                     |
                                     v
          +-----------------------------------------------------+
          |          Recharts Supply Chain Analytics            |
          |  - Category Health: Coffee vs. Tea vs. Snacks       |
          |  - Stacked: Adequate Stock (Green) vs Low (Red)     |
          |  - Interactive Reorder Deficit Tooltip              |
          +-----------------------------------------------------+
```

---

## 2. Supply Chain Breakdown Chart (Recharts)

### 2.1 Dynamic Category Heuristics & Recipe Traversal
The inventory screen analyzes the relational graph linking ingredients to menu categories:
1. **Recipe Association:** For each ingredient, the system scans `recipes[]` to locate matching `menuItems[]`, extracting the associated `category_id` and category name (`categories[]`).
2. **Culinary Heuristics Fallback:** If an ingredient is raw stock not yet assigned to an active recipe, heuristic keyword routing assigns it to appropriate categories (e.g. `coffee/arabica` -> *Coffee*, `milk/dairy` -> *Dairy*, `tea/chai/sugar` -> *Tea*, `dough/bread/samosa` -> *Snacks*).

### 2.2 Recharts Visual Schema
- **Component Type:** `<BarChart>` wrapped inside `<ResponsiveContainer width="100%" height="100%">`
- **X-Axis:** Menu & culinary categories (e.g., *Coffee*, *Tea*, *Snacks*, *Pantry*)
- **Y-Axis:** Discrete ingredient count (units tracked)
- **Bar Series:**
  - `Adequate Stock` (`fill="#10B981"`, green): Ingredients currently above replenishment safety thresholds.
  - `Low Stock (Reorder Needed)` (`fill="#EF4444"`, red): Ingredients with current stock `<= low_stock_threshold`.
- **Interactive Tooltip (`CustomTooltip`):**
  - Displays total items tracked in the hovered category.
  - Displays exact breakdown of healthy vs. critical items.
  - Itemized deficit list displaying item name, current stock, threshold, and metric units (e.g. `• Cane Sugar: 420/500 g`, `• Artisan Bread: 8/10 pcs`).

### 2.3 Integrated Category Filtering & Rapid Actions
Directly below the chart, operators can:
- Filter the inventory grid to a single category via quick filter pills showing live health tags (`X low` or `Y ok`).
- Collapse or expand the chart to optimize screen space during physical stocktaking.
- Click **"Generate Restock Order List"** to compile all deficit items into a supplier PO with suggested restock quantities.

---

## 3. Stock Health Threshold Formulas

Each ingredient maintains a minimum buffer threshold configured in master settings:

$$\text{Deficit} = \max(0, \text{low\_stock\_threshold} - \text{stock\_qty})$$

$$\text{Stock Health \%} = \min\left(100, \text{round}\left(\frac{\text{stock\_qty}}{\text{low\_stock\_threshold} \times 4} \times 100\right)\right)$$

- **Critical Status (Red):** `stock_qty <= low_stock_threshold`
- **Depletion Warning (Amber):** `stock_qty <= low_stock_threshold * 1.5`
- **Optimal Level (Green):** `stock_qty > low_stock_threshold * 1.5`

---

## 4. Multi-Surface Audit Logging

Every inventory delta is recorded in `inventoryLogs[]` with immutable audit properties:
- `timestamp`: ISO-8601 string
- `ingredient_id` and `ingredient_name`
- `delta`: Numerical increase (restock batch) or decrease (POS sale depletion or wastage write-off)
- `reason`: Machine or operator reason (e.g., `Order #1042 Recipe Depletion`, `Fresh supplier batch`, `Daily expiry clearance`)
- `staff_name`: Operating staff member or automated POS engine
