import React, { useState } from 'react';
import { useTsosStore } from '../../lib/store';
import { DailySalesHeatmap } from './DailySalesHeatmap';
import { WeeklySalesLineChart } from './WeeklySalesLineChart';
import { OrderTypeBreakdown } from './OrderTypeBreakdown';
import { LiveOpsPulse } from './LiveOpsPulse';
import { useCountUpFormatted } from '../../hooks/useCountUp';
import { canPerformAction } from '../../lib/rbac';
import {
  exportFinancialLedgerCSV,
  exportDailyRevenueCSV,
  exportInventoryStockCSV,
} from '../../utils/csvExport';
import {
  BarChart3,
  TrendingUp,
  ShoppingBag,
  IndianRupee,
  Award,
  CreditCard,
  Banknote,
  QrCode,
  ShieldCheck,
  Calendar,
  Download,
  FileSpreadsheet,
  Package,
  CheckCircle2,
  X,
  ChevronDown,
} from 'lucide-react';

export const ReportsScreen: React.FC = () => {
  const { orders, menuItems, feeConfig, ingredients, inventoryLogs, currentProfile } = useTsosStore();

  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isQuickExportOpen, setIsQuickExportOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const safeOrders = orders || [];
  const safeIngredients = ingredients || [];
  const safeInventoryLogs = inventoryLogs || [];

  const completedOrders = safeOrders.filter((o) => o.status === 'completed');
  const allSalesOrders = safeOrders.filter((o) => o.status !== 'cancelled');

  const grossRevenue = allSalesOrders.reduce((sum, o) => sum + (o?.grand_total || 0), 0);
  const totalOrdersCount = allSalesOrders.length;
  const aov = totalOrdersCount > 0 ? +(grossRevenue / totalOrdersCount).toFixed(2) : 0;

  // Platform fee comparison: Toast / traditional POS charge ₹3,500/mo + 2.5% per swipe
  const traditionalCostEstimate = grossRevenue * 0.025 + 3500;
  const tsosActualFee = totalOrdersCount * (feeConfig?.per_order_fee ?? 5);
  const estimatedSavings = Math.max(0, traditionalCostEstimate - tsosActualFee);

  // Animated count-up values for the 4 KPI cards (animate from previous → target on mount + when value changes).
  // Called unconditionally at the top level so the Rules of Hooks are satisfied.
  const animatedGrossRevenue = useCountUpFormatted(grossRevenue, 1100, 0);
  const animatedOrdersCount = useCountUpFormatted(totalOrdersCount, 900, 0);
  const animatedAov = useCountUpFormatted(aov, 1000, 2);
  const animatedSavings = useCountUpFormatted(Math.round(estimatedSavings), 1200, 0);

  // Top Selling Items tally
  const itemMap: { [name: string]: { qty: number; revenue: number } } = {};
  allSalesOrders.forEach((order) => {
    (order.items || []).forEach((item) => {
      if (!itemMap[item.menu_item_name]) {
        itemMap[item.menu_item_name] = { qty: 0, revenue: 0 };
      }
      itemMap[item.menu_item_name].qty += item.qty;
      itemMap[item.menu_item_name].revenue += item.item_total;
    });
  });

  const topItems = Object.entries(itemMap)
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5);

  // Payment breakdown
  const upiCount = allSalesOrders.filter((o) => o.payment_method === 'upi').length;
  const cashCount = allSalesOrders.filter((o) => o.payment_method === 'cash').length;
  const cardCount = allSalesOrders.filter((o) => o.payment_method === 'card').length;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((current) => (current === msg ? null : current));
    }, 4000);
  };

  const handleExportFinancialLedger = () => {
    if (!canPerformAction(currentProfile?.role, 'export_reports')) {
      showToast('Action Blocked: Only Store Managers and Cafe Owners can export financial ledgers.');
      return;
    }
    exportFinancialLedgerCSV(safeOrders, feeConfig);
    showToast('Financial Ledger CSV exported successfully!');
    setIsExportModalOpen(false);
    setIsQuickExportOpen(false);
  };

  const handleExportDailySummary = () => {
    if (!canPerformAction(currentProfile?.role, 'export_reports')) {
      showToast('Action Blocked: Only Store Managers and Cafe Owners can export daily sales.');
      return;
    }
    exportDailyRevenueCSV(safeOrders);
    showToast('Daily Sales Summary CSV exported successfully!');
    setIsExportModalOpen(false);
    setIsQuickExportOpen(false);
  };

  const handleExportInventory = () => {
    if (!canPerformAction(currentProfile?.role, 'export_reports')) {
      showToast('Action Blocked: Only Store Managers and Cafe Owners can export inventory valuations.');
      return;
    }
    exportInventoryStockCSV(safeIngredients, safeInventoryLogs);
    showToast('Inventory & Stock Valuation CSV exported successfully!');
    setIsExportModalOpen(false);
    setIsQuickExportOpen(false);
  };

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-100px)] overflow-hidden bg-[#FFF9F2] relative">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="absolute top-4 right-6 z-50 flex items-center gap-2 bg-[#1C1917] text-white px-4 py-2.5 rounded-xl shadow-lg border border-[#44403C] animate-fade-in text-xs">
          <CheckCircle2 className="w-4 h-4 text-[#10B981] shrink-0" />
          <span className="font-medium">{toastMessage}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="ml-2 text-[#A8A29E] hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="p-4 bg-white border-b border-[#E9E0D6] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-[#FFF1E6] text-[#F97316] flex items-center justify-center">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-[#1C1917] leading-tight">
              Reports, Sales & Unit Economics
            </h2>
            <div className="text-xs text-[#57534E]">
              Live cafe performance metrics, weekly revenue curves, and ₹0 subscription savings
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="hidden sm:flex items-center gap-2 text-xs font-semibold text-[#57534E] bg-[#FFF9F2] px-3 py-1.5 rounded-xl border border-[#E9E0D6]">
            <Calendar className="w-3.5 h-3.5 text-[#F97316]" />
            <span>Today's Live Snapshot</span>
          </div>

          {/* Export Action Controls */}
          <div className="relative">
            <div className="flex items-center rounded-xl bg-[#F97316] text-white shadow-xs hover:bg-[#EA580C] transition-colors">
              <button
                onClick={() => setIsExportModalOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold"
                title="Export financial and inventory datasets for external accounting"
              >
                <Download className="w-4 h-4" />
                <span>Export</span>
              </button>
              <div className="w-[1px] h-4 bg-white/30" />
              <button
                onClick={() => setIsQuickExportOpen(!isQuickExportOpen)}
                className="px-1.5 py-1.5 hover:bg-black/10 rounded-r-xl transition-colors"
                title="Quick export options"
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Quick Export Dropdown */}
            {isQuickExportOpen && (
              <div className="absolute right-0 mt-1.5 w-60 bg-white rounded-xl shadow-lg border border-[#E9E0D6] py-1 z-40 text-xs">
                <div className="px-3 py-1.5 text-[11px] font-semibold text-[#A8A29E] uppercase tracking-wider border-b border-[#F5F0EB]">
                  Download for External Accounting
                </div>
                <button
                  onClick={handleExportFinancialLedger}
                  className="w-full text-left px-3 py-2 text-[#1C1917] hover:bg-[#FFF9F2] flex items-center gap-2 transition-colors"
                >
                  <FileSpreadsheet className="w-4 h-4 text-[#F97316]" />
                  <div>
                    <div className="font-semibold">Financial Ledger (CSV)</div>
                    <div className="text-[10px] text-[#78716C]">All transactions & taxes</div>
                  </div>
                </button>
                <button
                  onClick={handleExportDailySummary}
                  className="w-full text-left px-3 py-2 text-[#1C1917] hover:bg-[#FFF9F2] flex items-center gap-2 transition-colors"
                >
                  <TrendingUp className="w-4 h-4 text-[#10B981]" />
                  <div>
                    <div className="font-semibold">Daily Sales Summary (CSV)</div>
                    <div className="text-[10px] text-[#78716C]">Day-by-day revenue breakdown</div>
                  </div>
                </button>
                <button
                  onClick={handleExportInventory}
                  className="w-full text-left px-3 py-2 text-[#1C1917] hover:bg-[#FFF9F2] flex items-center gap-2 transition-colors"
                >
                  <Package className="w-4 h-4 text-[#0284C7]" />
                  <div>
                    <div className="font-semibold">Inventory Valuation (CSV)</div>
                    <div className="text-[10px] text-[#78716C]">Stock levels & reorder alerts</div>
                  </div>
                </button>
                <div className="border-t border-[#F5F0EB] mt-1 pt-1">
                  <button
                    onClick={() => {
                      setIsQuickExportOpen(false);
                      setIsExportModalOpen(true);
                    }}
                    className="w-full text-left px-3 py-1.5 text-[#F97316] font-semibold hover:bg-[#FFF1E6] transition-colors"
                  >
                    View All Export Formats...
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Dashboard */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Live Operational Pulse — right-now metrics (orders last 60min, active tables, kitchen load, staff on shift) */}
        <LiveOpsPulse />

        {/* 4 KPI Cards (animated count-up on mount + when value changes) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-2xl border border-[#E9E0D6] shadow-xs hover:shadow-md hover:border-[#FED7AA] transition-all">
            <div className="flex items-center justify-between text-xs text-[#57534E] mb-1">
              <span>Gross Sales</span>
              <span className="p-1 rounded-md bg-[#FFF1E6] text-[#F97316]">
                <TrendingUp className="w-3.5 h-3.5" />
              </span>
            </div>
            <div className="text-2xl font-bold font-mono text-[#1C1917] tabular-nums">
              ₹{animatedGrossRevenue}
            </div>
            <div className="text-[11px] text-[#17803D] mt-1 flex items-center gap-1">
              <span className="w-1 h-1 rounded-full bg-[#17803D] animate-pulse" />
              Across all order types
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-[#E9E0D6] shadow-xs hover:shadow-md hover:border-[#A7F3D0] transition-all">
            <div className="flex items-center justify-between text-xs text-[#57534E] mb-1">
              <span>Orders Placed</span>
              <span className="p-1 rounded-md bg-[#E8F5EC] text-[#17803D]">
                <ShoppingBag className="w-3.5 h-3.5" />
              </span>
            </div>
            <div className="text-2xl font-bold font-mono text-[#1C1917] tabular-nums">
              {animatedOrdersCount}
            </div>
            <div className="text-[11px] text-[#57534E] mt-1">{completedOrders.length} completed</div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-[#E9E0D6] shadow-xs hover:shadow-md hover:border-[#BFDBFE] transition-all">
            <div className="flex items-center justify-between text-xs text-[#57534E] mb-1">
              <span>Average Order Value</span>
              <span className="p-1 rounded-md bg-[#EFF6FF] text-[#2563EB]">
                <IndianRupee className="w-3.5 h-3.5" />
              </span>
            </div>
            <div className="text-2xl font-bold font-mono text-[#1C1917] tabular-nums">
              ₹{animatedAov}
            </div>
            <div className="text-[11px] text-[#57534E] mt-1">Per dining bill</div>
          </div>

          <div className="bg-gradient-to-br from-[#FFF4E5] to-[#FFF9F2] p-4 rounded-2xl border border-[#FED7AA] shadow-xs hover:shadow-md transition-all">
            <div className="flex items-center justify-between text-xs text-[#B45309] font-semibold mb-1">
              <span>Savings with TSOS</span>
              <ShieldCheck className="w-4 h-4 text-[#B45309]" />
            </div>
            <div className="text-2xl font-bold font-mono text-[#B45309] tabular-nums">
              ₹{animatedSavings}
            </div>
            <div className="text-[11px] text-[#B45309] mt-1">vs 2.5% POS + monthly rentals</div>
          </div>
        </div>

        {/* Current Week Daily Sales Recharts Line Chart */}
        <WeeklySalesLineChart orders={safeOrders} />

        {/* Order Type Breakdown donut (dine-in vs takeaway vs delivery) — new analytics */}
        <OrderTypeBreakdown />


        {/* Daily Sales Heatmap & Peak Operational Hours (Recharts) */}
        <DailySalesHeatmap />

        {/* Breakdown row: Top Items & Payment Methods */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Top Selling Items */}
          <div className="bg-white p-5 rounded-2xl border border-[#E9E0D6] shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4 text-[#F97316]" />
                <h3 className="font-bold text-sm text-[#1C1917]">Top Selling Menu Items</h3>
              </div>
              <span className="text-xs text-[#A8A29E]">By quantity sold</span>
            </div>

            <div className="space-y-3">
              {topItems.length === 0 ? (
                <div className="text-xs text-[#A8A29E] py-6 text-center">No items sold yet</div>
              ) : (
                topItems.map((item, idx) => {
                  const maxQty = topItems[0].qty || 1;
                  const pct = Math.round((item.qty / maxQty) * 100);

                  return (
                    <div key={item.name} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-[#1C1917]">
                          #{idx + 1} {item.name}
                        </span>
                        <span className="font-mono text-[#57534E]">
                          {item.qty} sold • ₹{item.revenue}
                        </span>
                      </div>
                      <div className="w-full bg-[#F5F0EB] h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-[#F97316] h-full rounded-full transition-all duration-300"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Payment Methods Breakdown */}
          <div className="bg-white p-5 rounded-2xl border border-[#E9E0D6] shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-sm text-[#1C1917]">Payment Method Distribution</h3>
                <span className="text-xs text-[#A8A29E]">{totalOrdersCount} transactions</span>
              </div>

              <div className="grid grid-cols-3 gap-3 my-4">
                <div className="p-3 bg-[#FFF1E6] rounded-xl border border-[#FED7AA] text-center">
                  <QrCode className="w-5 h-5 text-[#F97316] mx-auto mb-1" />
                  <div className="text-xs font-semibold text-[#57534E]">UPI (BharatQR)</div>
                  <div className="text-lg font-bold font-mono text-[#1C1917]">{upiCount}</div>
                </div>

                <div className="p-3 bg-[#E8F5EC] rounded-xl border border-[#A7F3D0] text-center">
                  <Banknote className="w-5 h-5 text-[#17803D] mx-auto mb-1" />
                  <div className="text-xs font-semibold text-[#57534E]">Cash Counter</div>
                  <div className="text-lg font-bold font-mono text-[#1C1917]">{cashCount}</div>
                </div>

                <div className="p-3 bg-[#EFF6FF] rounded-xl border border-[#BFDBFE] text-center">
                  <CreditCard className="w-5 h-5 text-[#2563EB] mx-auto mb-1" />
                  <div className="text-xs font-semibold text-[#57534E]">Card Terminal</div>
                  <div className="text-lg font-bold font-mono text-[#1C1917]">{cardCount}</div>
                </div>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-[#FFF9F2] border border-[#E9E0D6] text-xs text-[#57534E] flex items-center justify-between">
              <span>TSOS Fee Engine Status</span>
              <span className="font-bold text-[#F97316]">
                ₹{tsosActualFee} platform fees collected
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Export Modal */}
      {isExportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full border border-[#E9E0D6] shadow-xl overflow-hidden animate-scale-in">
            <div className="p-4 bg-[#FFF9F2] border-b border-[#E9E0D6] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#FFF1E6] text-[#F97316] flex items-center justify-center">
                  <FileSpreadsheet className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-[#1C1917]">
                    Export Data for External Accounting
                  </h3>
                  <p className="text-[11px] text-[#57534E]">
                    Download clean CSV files formatted for Tally, QuickBooks, Excel & Zoho Books
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsExportModalOpen(false)}
                className="text-[#78716C] hover:text-[#1C1917] p-1 rounded-lg hover:bg-black/5"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* Option 1: Financial Orders Ledger */}
              <div className="p-4 rounded-xl border border-[#E9E0D6] hover:border-[#FED7AA] bg-[#FFFDF9] transition-all space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#FFF1E6] text-[#F97316] flex items-center justify-center shrink-0 mt-0.5">
                      <FileSpreadsheet className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-bold text-sm text-[#1C1917]">
                        Complete Financial Orders Ledger
                      </div>
                      <div className="text-xs text-[#57534E] mt-0.5">
                        Detailed itemized records for each transaction including Order ID, date/time, customer details, subtotal, 5% GST tax, platform fee, discounts, and payment status.
                      </div>
                      <div className="text-[11px] font-mono text-[#F97316] mt-1">
                        Includes {safeOrders.length} transaction rows
                      </div>
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleExportFinancialLedger}
                  className="w-full py-2 px-3 bg-[#F97316] hover:bg-[#EA580C] text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-colors shadow-xs"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Financial Ledger (.csv)</span>
                </button>
              </div>

              {/* Option 2: Daily Sales Summary */}
              <div className="p-4 rounded-xl border border-[#E9E0D6] hover:border-[#A7F3D0] bg-[#FFFDF9] transition-all space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#E8F5EC] text-[#10B981] flex items-center justify-center shrink-0 mt-0.5">
                      <TrendingUp className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-bold text-sm text-[#1C1917]">
                        Daily Sales & Revenue Summary
                      </div>
                      <div className="text-xs text-[#57534E] mt-0.5">
                        Aggregated daily revenue, net sales, total tax collected, average ticket size, and revenue breakdown by payment method (UPI, Cash, Card).
                      </div>
                      <div className="text-[11px] font-mono text-[#10B981] mt-1">
                        Daily audited totals grouped by date
                      </div>
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleExportDailySummary}
                  className="w-full py-2 px-3 bg-[#10B981] hover:bg-[#059669] text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-colors shadow-xs"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Daily Sales Summary (.csv)</span>
                </button>
              </div>

              {/* Option 3: Inventory & Raw Materials */}
              <div className="p-4 rounded-xl border border-[#E9E0D6] hover:border-[#BAE6FD] bg-[#FFFDF9] transition-all space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#EFF6FF] text-[#0284C7] flex items-center justify-center shrink-0 mt-0.5">
                      <Package className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-bold text-sm text-[#1C1917]">
                        Inventory & Raw Stock Valuation
                      </div>
                      <div className="text-xs text-[#57534E] mt-0.5">
                        Current stock on hand for coffee beans, dairy, dry goods, and kitchen prep. Includes low-stock threshold triggers and suggested replenishment quantities.
                      </div>
                      <div className="text-[11px] font-mono text-[#0284C7] mt-1">
                        Includes {safeIngredients.length} inventory catalog items
                      </div>
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleExportInventory}
                  className="w-full py-2 px-3 bg-[#0284C7] hover:bg-[#0369A1] text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-colors shadow-xs"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Inventory Valuation (.csv)</span>
                </button>
              </div>
            </div>

            <div className="p-4 bg-[#FFF9F2] border-t border-[#E9E0D6] flex items-center justify-between text-xs text-[#57534E]">
              <span>UTF-8 BOM encoded for direct import into Microsoft Excel & Google Sheets</span>
              <button
                onClick={() => setIsExportModalOpen(false)}
                className="px-3 py-1.5 bg-white border border-[#D5C9BD] hover:bg-[#F5EBE1] text-[#1C1917] font-semibold rounded-xl transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
