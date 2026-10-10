import { Order, Ingredient, InventoryLog, LocationFeeConfig } from '../types';

/**
 * Escapes values for standard RFC 4180 CSV compliance
 */
function escapeCSVValue(val: string | number | boolean | null | undefined): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Triggers a client-side download of a CSV string with UTF-8 BOM
 */
export function downloadCSV(filename: string, rows: (string | number | null | undefined)[][]): void {
  const csvString = rows
    .map((row) => row.map((cell) => escapeCSVValue(cell)).join(','))
    .join('\r\n');

  // Prefix with UTF-8 Byte Order Mark for Excel compatibility
  const blob = new Blob(['\uFEFF' + csvString], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Exports complete Financial Ledger of all customer orders
 */
export function exportFinancialLedgerCSV(orders: Order[], feeConfig?: LocationFeeConfig): void {
  const dateStr = new Date().toISOString().split('T')[0];
  const filename = `tsos_financial_orders_ledger_${dateStr}.csv`;

  const headers = [
    'Order ID',
    'Order Number',
    'Date',
    'Time (IST)',
    'Order Type',
    'Table / Counter',
    'Customer Name',
    'Customer Phone',
    'Placed By',
    'Items Summary',
    'Total Items Count',
    'Subtotal (INR)',
    'GST 5% (INR)',
    'Platform Fee (INR)',
    'Fee Payer',
    'Discount (INR)',
    'Grand Total (INR)',
    'Payment Method',
    'Payment Status',
    'Kitchen Status',
    'Order Notes',
  ];

  const rows: (string | number | null | undefined)[][] = [headers];

  const sortedOrders = [...orders].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  sortedOrders.forEach((o) => {
    const orderDate = new Date(o.created_at);
    const dateFormatted = orderDate.toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
    });
    const timeFormatted = orderDate.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });

    const itemsSummary = (o.items || [])
      .map((i) => `${i.qty}x ${i.menu_item_name}${i.variant_name ? ` (${i.variant_name})` : ''}`)
      .join('; ');

    const totalQty = (o.items || []).reduce((sum, i) => sum + (i.qty || 0), 0);

    rows.push([
      o.id,
      `#${o.order_number}`,
      dateFormatted,
      timeFormatted,
      o.order_type.toUpperCase().replace('_', ' '),
      o.table_label || 'Direct Counter',
      o.customer_name || 'Walk-in Guest',
      o.customer_phone || '-',
      o.placed_by || 'Staff',
      itemsSummary,
      totalQty,
      o.subtotal.toFixed(2),
      o.tax_total.toFixed(2),
      o.platform_fee.toFixed(2),
      o.fee_payer === 'customer' ? 'Customer Paid' : 'Cafe Absorbed',
      o.discount_total.toFixed(2),
      o.grand_total.toFixed(2),
      (o.payment_method || 'PENDING').toUpperCase(),
      o.payment_status.toUpperCase(),
      o.status.toUpperCase(),
      o.notes || '',
    ]);
  });

  downloadCSV(filename, rows);
}

/**
 * Exports Daily Financial Summary grouped by Date
 */
export function exportDailyRevenueCSV(orders: Order[]): void {
  const dateStr = new Date().toISOString().split('T')[0];
  const filename = `tsos_daily_sales_summary_${dateStr}.csv`;

  const headers = [
    'Date',
    'Day of Week',
    'Total Orders Placed',
    'Completed Orders',
    'Gross Revenue (INR)',
    'Net Subtotal (INR)',
    'GST Tax Collected 5% (INR)',
    'Platform Fees (INR)',
    'Total Discounts Given (INR)',
    'Average Order Value (INR)',
    'UPI Revenue (INR)',
    'Cash Revenue (INR)',
    'Card Revenue (INR)',
  ];

  // Group orders by YYYY-MM-DD
  const dailyMap: {
    [dayKey: string]: {
      date: Date;
      totalOrders: number;
      completedOrders: number;
      grossRevenue: number;
      subtotal: number;
      taxTotal: number;
      platformFees: number;
      discounts: number;
      upiRev: number;
      cashRev: number;
      cardRev: number;
    };
  } = {};

  (orders || []).forEach((o) => {
    if (!o || o.status === 'cancelled') return;
    const d = new Date(o.created_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    if (!dailyMap[key]) {
      dailyMap[key] = {
        date: d,
        totalOrders: 0,
        completedOrders: 0,
        grossRevenue: 0,
        subtotal: 0,
        taxTotal: 0,
        platformFees: 0,
        discounts: 0,
        upiRev: 0,
        cashRev: 0,
        cardRev: 0,
      };
    }

    const rec = dailyMap[key];
    rec.totalOrders += 1;
    if (o.status === 'completed') rec.completedOrders += 1;
    rec.grossRevenue += o.grand_total || 0;
    rec.subtotal += o.subtotal || 0;
    rec.taxTotal += o.tax_total || 0;
    rec.platformFees += o.platform_fee || 0;
    rec.discounts += o.discount_total || 0;

    if (o.payment_method === 'upi') rec.upiRev += o.grand_total || 0;
    else if (o.payment_method === 'cash') rec.cashRev += o.grand_total || 0;
    else if (o.payment_method === 'card') rec.cardRev += o.grand_total || 0;
  });

  const rows: (string | number | null | undefined)[][] = [headers];

  const sortedKeys = Object.keys(dailyMap).sort().reverse();
  sortedKeys.forEach((key) => {
    const item = dailyMap[key];
    const aov = item.totalOrders > 0 ? (item.grossRevenue / item.totalOrders).toFixed(2) : '0.00';
    const dayOfWeek = item.date.toLocaleDateString('en-IN', { weekday: 'long' });

    rows.push([
      key,
      dayOfWeek,
      item.totalOrders,
      item.completedOrders,
      item.grossRevenue.toFixed(2),
      item.subtotal.toFixed(2),
      item.taxTotal.toFixed(2),
      item.platformFees.toFixed(2),
      item.discounts.toFixed(2),
      aov,
      item.upiRev.toFixed(2),
      item.cashRev.toFixed(2),
      item.cardRev.toFixed(2),
    ]);
  });

  downloadCSV(filename, rows);
}

/**
 * Exports Ingredients and Inventory valuation data for external accounting
 */
export function exportInventoryStockCSV(
  ingredients: Ingredient[],
  inventoryLogs: InventoryLog[] = []
): void {
  const dateStr = new Date().toISOString().split('T')[0];
  const filename = `tsos_inventory_valuation_${dateStr}.csv`;

  const headers = [
    'Ingredient ID',
    'Ingredient Name',
    'Unit of Measure',
    'Current On-Hand Stock',
    'Low Stock Alert Threshold',
    'Stock Status',
    'Suggested Reorder Qty',
    'Last Activity Recorded',
  ];

  const rows: (string | number | null | undefined)[][] = [headers];

  (ingredients || []).forEach((ing) => {
    let status = 'HEALTHY';
    let reorderQty = 0;

    if (ing.stock_qty <= 0) {
      status = 'OUT OF STOCK';
      reorderQty = ing.low_stock_threshold * 2;
    } else if (ing.stock_qty <= ing.low_stock_threshold) {
      status = 'LOW STOCK WARNING';
      reorderQty = Math.max(0, ing.low_stock_threshold * 2 - ing.stock_qty);
    }

    const relevantLogs = (inventoryLogs || []).filter((l) => l.ingredient_id === ing.id);
    const lastLog = relevantLogs[0]?.created_at
      ? new Date(relevantLogs[0].created_at).toLocaleDateString('en-IN')
      : 'No recent log';

    rows.push([
      ing.id,
      ing.name,
      ing.unit,
      ing.stock_qty,
      ing.low_stock_threshold,
      status,
      reorderQty > 0 ? reorderQty : 'Adequate',
      lastLog,
    ]);
  });

  downloadCSV(filename, rows);
}
