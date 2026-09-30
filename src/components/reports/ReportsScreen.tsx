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
  const { orders, menuItems, feeConfig, ingredients, inventoryLogs, currentProfile, themeMode } = useTsosStore();

  const isServepoint = themeMode === 'servepoint';

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
    <div className={`flex-1 flex flex-col h-[calc(100vh-100px)] overflow-hidden relative ${isServepoint ? 'bg-[#F6F5F2]' : 'bg-[#FFF9F2]'}`}>
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`absolute top-4 right-6 z-50 flex items-center gap-2 px-4 py-2.5 rounded-lg animate-fade-in text-xs ${
            isServepoint
              ? 'bg-[#0F3D3E] text-white border border-[#0B3132]'
              : 'bg-[#0F1D17] text-[#F5F4EE] border border-[#1F3D2E]'
          }`}
          style={isServepoint ? { boxShadow: '0 8px 20px rgba(15,61,62,0.25)' } : { boxShadow: '3px 3px 0 #1F3D2E' }}
        >
          <CheckCircle2 className={`w-4 h-4 shrink-0 ${isServepoint ? 'text-[#B88E2F]' : 'text-[#C5F82A]'}`} />
          <span className="font-medium">{toastMessage}</span>
          <button
            onClick={() => setToastMessage(null)}
            className={`ml-2 hover:opacity-80 ${isServepoint ? 'text-white/60 hover:text-white' : 'text-[#6B8579] hover:text-[#F5F4EE]'}`}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Header */}
      <div
        className={`p-4 border-b flex flex-wrap items-center justify-between gap-3 ${
          isServepoint ? 'bg-white border-[#E3E7E0]' : 'bg-[#0F1D17] border-[#1F3D2E]'
        }`}
      >
        <div className="flex items-center gap-2.5">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center ${
              isServepoint
                ? 'bg-[#D9E2DD] text-[#B88E2F]'
                : 'bg-[#0A1410] text-[#C5F82A] border border-[#1F3D2E]'
            }`}
            style={isServepoint ? undefined : { boxShadow: '2px 2px 0 #1F3D2E' }}
          >
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <h2 className={`text-lg leading-tight ${isServepoint ? 'text-[#1A1A1A]' : 'text-[#F5F4EE]'}`}>
              Reports, Sales & Unit Economics
            </h2>
            <div className={`text-xs ${isServepoint ? 'text-[#6B6B6B]' : 'text-[#9BB5A5]'}`}>
              Live cafe performance metrics, weekly revenue curves, and ₹0 subscription savings
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <div
            className={`hidden sm:flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-lg ${
              isServepoint
                ? 'text-[#6B6B6B] bg-[#D9E2DD]/60'
                : 'text-[#9BB5A5] bg-[#0A1410] border border-[#1F3D2E] font-semibold'
            }`}
          >
            <Calendar className={`w-3.5 h-3.5 ${isServepoint ? 'text-[#B88E2F]' : 'text-[#C5F82A]'}`} />
            <span>Today's Live Snapshot</span>
          </div>

          {/* Export Action Controls */}
          <div className="relative">
            {isServepoint ? (
              <div className="flex items-stretch rounded-xl overflow-hidden">
                <button
                  onClick={() => setIsExportModalOpen(true)}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#B88E2F] hover:bg-[#967221] transition-colors"
                  title="Export financial and inventory datasets for external accounting"
                >
                  <Download className="w-4 h-4" />
                  <span>Export</span>
                </button>
                <button
                  onClick={() => setIsQuickExportOpen(!isQuickExportOpen)}
                  className="px-2 py-2 text-white bg-[#B88E2F] hover:bg-[#967221] border-l border-white/25 transition-colors"
                  title="Quick export options"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center rounded-lg tessera-cta">
                <button
                  onClick={() => setIsExportModalOpen(true)}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold"
                  title="Export financial and inventory datasets for external accounting"
                >
                  <Download className="w-4 h-4" />
                  <span>Export</span>
                </button>
                <div className="w-[1px] h-4 bg-[#0A1410]/30" />
                <button
                  onClick={() => setIsQuickExportOpen(!isQuickExportOpen)}
                  className="px-1.5 py-1.5 hover:bg-[#0A1410]/10 rounded-r-lg transition-colors"
                  title="Quick export options"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Quick Export Dropdown */}
            {isQuickExportOpen && (
              <div className={`absolute right-0 mt-1.5 w-60 rounded-xl shadow-lg py-1 z-40 text-xs ${
                isServepoint ? 'bg-white border border-[#E3E7E0]' : 'bg-white border border-[#E9E0D6]'
              }`}>
                <div className={`px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider border-b ${
                  isServepoint ? 'text-[#6B6B6B] border-[#F6F5F2]' : 'text-[#A8A29E] border-[#F5F0EB]'
                }`}>
                  Download for External Accounting
                </div>
                <button
                  onClick={handleExportFinancialLedger}
                  className={`w-full text-left px-3 py-2 flex items-center gap-2 transition-colors ${
                    isServepoint ? 'text-[#1A1A1A] hover:bg-[#D9E2DD]/50' : 'text-[#1C1917] hover:bg-[#FFF9F2]'
                  }`}
                >
                  <FileSpreadsheet className={`w-4 h-4 ${isServepoint ? 'text-[#B88E2F]' : 'text-[#F97316]'}`} />
                  <div>
                    <div className="font-semibold">Financial Ledger (CSV)</div>
                    <div className={`text-[10px] ${isServepoint ? 'text-[#6B6B6B]' : 'text-[#78716C]'}`}>All transactions & taxes</div>
                  </div>
                </button>
                <button
                  onClick={handleExportDailySummary}
                  className={`w-full text-left px-3 py-2 flex items-center gap-2 transition-colors ${
                    isServepoint ? 'text-[#1A1A1A] hover:bg-[#D9E2DD]/50' : 'text-[#1C1917] hover:bg-[#FFF9F2]'
                  }`}
                >
                  <TrendingUp className={`w-4 h-4 ${isServepoint ? 'text-[#0F3D3E]' : 'text-[#10B981]'}`} />
                  <div>
                    <div className="font-semibold">Daily Sales Summary (CSV)</div>
                    <div className={`text-[10px] ${isServepoint ? 'text-[#6B6B6B]' : 'text-[#78716C]'}`}>Day-by-day revenue breakdown</div>
                  </div>
                </button>
                <button
                  onClick={handleExportInventory}
                  className={`w-full text-left px-3 py-2 flex items-center gap-2 transition-colors ${
                    isServepoint ? 'text-[#1A1A1A] hover:bg-[#D9E2DD]/50' : 'text-[#1C1917] hover:bg-[#FFF9F2]'
                  }`}
                >
                  <Package className={`w-4 h-4 ${isServepoint ? 'text-[#967221]' : 'text-[#0284C7]'}`} />
                  <div>
                    <div className="font-semibold">Inventory Valuation (CSV)</div>
                    <div className={`text-[10px] ${isServepoint ? 'text-[#6B6B6B]' : 'text-[#78716C]'}`}>Stock levels & reorder alerts</div>
                  </div>
                </button>
                <div className={`border-t mt-1 pt-1 ${isServepoint ? 'border-[#F6F5F2]' : 'border-[#F5F0EB]'}`}>
                  <button
                    onClick={() => {
                      setIsQuickExportOpen(false);
                      setIsExportModalOpen(true);
                    }}
                    className={`w-full text-left px-3 py-1.5 font-semibold transition-colors ${
                      isServepoint ? 'text-[#967221] hover:bg-[#D9E2DD]/50' : 'text-[#F97316] hover:bg-[#FFF1E6]'
                    }`}
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
          <div
            className={`p-4 rounded-2xl transition-colors ${
              isServepoint
                ? 'bg-white border border-[#E3E7E0] hover:border-[#B88E2F]/50 shadow-[0_1px_3px_rgba(26,26,26,0.04)]'
                : 'bg-[#0F1D17] border border-[#1F3D2E] tessera-block hover:border-[#2A4A37]'
            }`}
          >
            <div className={`flex items-center justify-between text-xs mb-1 ${isServepoint ? 'text-[#6B6B6B]' : 'text-[#9BB5A5]'}`}>
              <span className={`uppercase tracking-[0.08em] ${isServepoint ? 'font-medium' : 'font-semibold tracking-[0.1em]'}`}>
                Gross Sales
              </span>
              <span
                className={`p-1 rounded-lg ${
                  isServepoint ? 'bg-[#D9E2DD] text-[#0F3D3E]' : 'bg-[#0A1410] text-[#C5F82A] border border-[#1F3D2E]'
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5" />
              </span>
            </div>
            <div className={`text-2xl font-bold tabular-nums ${isServepoint ? 'text-[#1A1A1A]' : 'font-mono text-[#F5F4EE]'}`}>
              ₹{animatedGrossRevenue}
            </div>
            <div className={`text-[11px] mt-1 flex items-center gap-1 ${isServepoint ? 'text-[#6B6B6B]' : 'text-[#34D399]'}`}>
              {isServepoint ? (
                <span className="w-1.5 h-1.5 rounded-full bg-[#B88E2F] animate-pulse" />
              ) : (
                <span className="w-1 h-1 rounded-full bg-[#34D399] animate-pulse" />
              )}
              Across all order types
            </div>
          </div>

          <div
            className={`p-4 rounded-2xl transition-colors ${
              isServepoint
                ? 'bg-white border border-[#E3E7E0] hover:border-[#B88E2F]/50 shadow-[0_1px_3px_rgba(26,26,26,0.04)]'
                : 'bg-[#0F1D17] border border-[#1F3D2E] tessera-block hover:border-[#2A4A37]'
            }`}
          >
            <div className={`flex items-center justify-between text-xs mb-1 ${isServepoint ? 'text-[#6B6B6B]' : 'text-[#9BB5A5]'}`}>
              <span className={`uppercase tracking-[0.08em] ${isServepoint ? 'font-medium' : 'font-semibold tracking-[0.1em]'}`}>
                Orders Placed
              </span>
              <span
                className={`p-1 rounded-lg ${
                  isServepoint ? 'bg-[#D9E2DD] text-[#0F3D3E]' : 'bg-[#0A1410] text-[#34D399] border border-[#1F3D2E]'
                }`}
              >
                <ShoppingBag className="w-3.5 h-3.5" />
              </span>
            </div>
            <div className={`text-2xl font-bold tabular-nums ${isServepoint ? 'text-[#1A1A1A]' : 'font-mono text-[#F5F4EE]'}`}>
              {animatedOrdersCount}
            </div>
            <div className={`text-[11px] mt-1 ${isServepoint ? 'text-[#6B6B6B]' : 'text-[#9BB5A5]'}`}>
              {completedOrders.length} completed
            </div>
          </div>

          <div
            className={`p-4 rounded-2xl transition-colors ${
              isServepoint
                ? 'bg-white border border-[#E3E7E0] hover:border-[#B88E2F]/50 shadow-[0_1px_3px_rgba(26,26,26,0.04)]'
                : 'bg-[#0F1D17] border border-[#1F3D2E] tessera-block hover:border-[#2A4A37]'
            }`}
          >
            <div className={`flex items-center justify-between text-xs mb-1 ${isServepoint ? 'text-[#6B6B6B]' : 'text-[#9BB5A5]'}`}>
              <span className={`uppercase tracking-[0.08em] ${isServepoint ? 'font-medium' : 'font-semibold tracking-[0.1em]'}`}>
                Average Order Value
              </span>
              <span
                className={`p-1 rounded-lg ${
                  isServepoint ? 'bg-[#D9E2DD] text-[#0F3D3E]' : 'bg-[#0A1410] text-[#60A5FA] border border-[#1F3D2E]'
                }`}
              >
                <IndianRupee className="w-3.5 h-3.5" />
              </span>
            </div>
            <div className={`text-2xl font-bold tabular-nums ${isServepoint ? 'text-[#1A1A1A]' : 'font-mono text-[#F5F4EE]'}`}>
              ₹{animatedAov}
            </div>
            <div className={`text-[11px] mt-1 ${isServepoint ? 'text-[#6B6B6B]' : 'text-[#9BB5A5]'}`}>Per dining bill</div>
          </div>

          {/* Savings card — gold-tinted hero (ServePoint) / chartreuse-tinted hero (Tessera) */}
          <div
            className={`p-4 rounded-2xl transition-colors ${
              isServepoint
                ? 'bg-[#D9E2DD]/70 border border-[#B88E2F]/40 hover:border-[#B88E2F]/70'
                : 'bg-gradient-to-br from-[#142620] to-[#0F1D17] border border-[#C5F82A]/30 tessera-block-chartreuse hover:border-[#C5F82A]/50'
            }`}
          >
            <div
              className={`flex items-center justify-between text-xs mb-1 ${
                isServepoint ? 'text-[#967221] font-semibold uppercase tracking-[0.08em]' : 'text-[#C5F82A] font-semibold uppercase tracking-[0.1em]'
              }`}
            >
              <span>Savings with TSOS</span>
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div className={`text-2xl font-bold tabular-nums ${isServepoint ? 'text-[#967221]' : 'font-mono text-[#C5F82A]'}`}>
              ₹{animatedSavings}
            </div>
            <div className={`text-[11px] mt-1 ${isServepoint ? 'text-[#6B6B6B]' : 'text-[#9BB5A5]'}`}>
              vs 2.5% POS + monthly rentals
            </div>
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
          <div className={`p-5 rounded-2xl shadow-xs ${
            isServepoint ? 'bg-white border border-[#E3E7E0]' : 'bg-white border border-[#E9E0D6]'
          }`}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Award className={`w-4 h-4 ${isServepoint ? 'text-[#B88E2F]' : 'text-[#F97316]'}`} />
                <h3 className={`font-semibold text-sm ${isServepoint ? 'text-[#1A1A1A]' : 'text-[#1C1917]'}`}>
                  Top Selling Menu Items
                </h3>
              </div>
              <span className={`text-xs ${isServepoint ? 'text-[#6B6B6B]' : 'text-[#A8A29E]'}`}>By quantity sold</span>
            </div>

            <div className="space-y-3">
              {topItems.length === 0 ? (
                <div className={`text-xs py-6 text-center ${isServepoint ? 'text-[#6B6B6B]' : 'text-[#A8A29E]'}`}>
                  No items sold yet
                </div>
              ) : (
                topItems.map((item, idx) => {
                  const maxQty = topItems[0].qty || 1;
                  const pct = Math.round((item.qty / maxQty) * 100);

                  return (
                    <div key={item.name} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className={`font-medium ${isServepoint ? 'text-[#1A1A1A]' : 'text-[#1C1917]'}`}>
                          #{idx + 1} {item.name}
                        </span>
                        <span className={isServepoint ? 'text-[#6B6B6B] tabular-nums' : 'font-mono text-[#57534E]'}>
                          {item.qty} sold • ₹{item.revenue}
                        </span>
                      </div>
                      <div className={`w-full h-2 rounded-full overflow-hidden ${isServepoint ? 'bg-[#D9E2DD]/70' : 'bg-[#F5F0EB]'}`}>
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            isServepoint ? 'bg-[#B88E2F]' : 'bg-[#F97316]'
                          }`}
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
          <div className={`p-5 rounded-2xl shadow-xs flex flex-col justify-between ${
            isServepoint ? 'bg-white border border-[#E3E7E0]' : 'bg-white border border-[#E9E0D6]'
          }`}>
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className={`font-semibold text-sm ${isServepoint ? 'text-[#1A1A1A]' : 'text-[#1C1917]'}`}>
                  Payment Method Distribution
                </h3>
                <span className={`text-xs ${isServepoint ? 'text-[#6B6B6B]' : 'text-[#A8A29E]'}`}>
                  {totalOrdersCount} transactions
                </span>
              </div>

              <div className="grid grid-cols-3 gap-3 my-4">
                <div
                  className={`p-3 rounded-xl border text-center ${
                    isServepoint ? 'bg-[#D9E2DD]/50 border-[#D9E2DD]' : 'bg-[#FFF1E6] border-[#FED7AA]'
                  }`}
                >
                  <QrCode className={`w-5 h-5 mx-auto mb-1 ${isServepoint ? 'text-[#0F3D3E]' : 'text-[#F97316]'}`} />
                  <div className={`text-xs ${isServepoint ? 'text-[#6B6B6B]' : 'font-semibold text-[#57534E]'}`}>UPI (BharatQR)</div>
                  <div className={`text-lg font-bold tabular-nums ${isServepoint ? 'text-[#1A1A1A]' : 'font-mono text-[#1C1917]'}`}>{upiCount}</div>
                </div>

                <div
                  className={`p-3 rounded-xl border text-center ${
                    isServepoint ? 'bg-[#B88E2F]/10 border-[#B88E2F]/30' : 'bg-[#E8F5EC] border-[#A7F3D0]'
                  }`}
                >
                  <Banknote className={`w-5 h-5 mx-auto mb-1 ${isServepoint ? 'text-[#967221]' : 'text-[#17803D]'}`} />
                  <div className={`text-xs ${isServepoint ? 'text-[#6B6B6B]' : 'font-semibold text-[#57534E]'}`}>Cash Counter</div>
                  <div className={`text-lg font-bold tabular-nums ${isServepoint ? 'text-[#1A1A1A]' : 'font-mono text-[#1C1917]'}`}>{cashCount}</div>
                </div>

                <div
                  className={`p-3 rounded-xl border text-center ${
                    isServepoint ? 'bg-[#0F3D3E]/5 border-[#0F3D3E]/20' : 'bg-[#EFF6FF] border-[#BFDBFE]'
                  }`}
                >
                  <CreditCard className={`w-5 h-5 mx-auto mb-1 ${isServepoint ? 'text-[#0F3D3E]' : 'text-[#2563EB]'}`} />
                  <div className={`text-xs ${isServepoint ? 'text-[#6B6B6B]' : 'font-semibold text-[#57534E]'}`}>Card Terminal</div>
                  <div className={`text-lg font-bold tabular-nums ${isServepoint ? 'text-[#1A1A1A]' : 'font-mono text-[#1C1917]'}`}>{cardCount}</div>
                </div>
              </div>
            </div>

            <div
              className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
                isServepoint
                  ? 'bg-[#F6F5F2] border-[#E3E7E0] text-[#6B6B6B]'
                  : 'bg-[#FFF9F2] border-[#E9E0D6] text-[#57534E]'
              }`}
            >
              <span>TSOS Fee Engine Status</span>
              <span className={`font-semibold ${isServepoint ? 'text-[#967221]' : 'text-[#F97316]'}`}>
                ₹{tsosActualFee} platform fees collected
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Export Modal */}
      {isExportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className={`rounded-2xl max-w-xl w-full shadow-xl overflow-hidden animate-scale-in ${
            isServepoint ? 'bg-white border border-[#E3E7E0]' : 'bg-white border border-[#E9E0D6]'
          }`}>
            <div className={`p-4 border-b flex items-center justify-between ${
              isServepoint ? 'bg-white border-[#E3E7E0]' : 'bg-[#FFF9F2] border-[#E9E0D6]'
            }`}>
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  isServepoint ? 'bg-[#D9E2DD] text-[#B88E2F]' : 'bg-[#FFF1E6] text-[#F97316]'
                }`}>
                  <FileSpreadsheet className="w-4 h-4" />
                </div>
                <div>
                  <h3 className={`font-semibold text-sm ${isServepoint ? 'text-[#1A1A1A]' : 'text-[#1C1917]'}`}>
                    Export Data for External Accounting
                  </h3>
                  <p className={`text-[11px] ${isServepoint ? 'text-[#6B6B6B]' : 'text-[#57534E]'}`}>
                    Download clean CSV files formatted for Tally, QuickBooks, Excel & Zoho Books
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsExportModalOpen(false)}
                className={`p-1 rounded-lg transition-colors ${
                  isServepoint ? 'text-[#6B6B6B] hover:text-[#1A1A1A] hover:bg-[#D9E2DD]/50' : 'text-[#78716C] hover:text-[#1C1917] hover:bg-black/5'
                }`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* Option 1: Financial Orders Ledger */}
              <div className={`p-4 rounded-xl border transition-all space-y-3 ${
                isServepoint
                  ? 'bg-[#F6F5F2] border-[#E3E7E0] hover:border-[#B88E2F]/50'
                  : 'bg-[#FFFDF9] border-[#E9E0D6] hover:border-[#FED7AA]'
              }`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                      isServepoint ? 'bg-[#D9E2DD] text-[#B88E2F]' : 'bg-[#FFF1E6] text-[#F97316]'
                    }`}>
                      <FileSpreadsheet className="w-5 h-5" />
                    </div>
                    <div>
                      <div className={`font-semibold text-sm ${isServepoint ? 'text-[#1A1A1A]' : 'text-[#1C1917]'}`}>
                        Complete Financial Orders Ledger
                      </div>
                      <div className={`text-xs mt-0.5 ${isServepoint ? 'text-[#6B6B6B]' : 'text-[#57534E]'}`}>
                        Detailed itemized records for each transaction including Order ID, date/time, customer details, subtotal, 5% GST tax, platform fee, discounts, and payment status.
                      </div>
                      <div className={`text-[11px] mt-1 ${isServepoint ? 'text-[#967221]' : 'font-mono text-[#F97316]'}`}>
                        Includes {safeOrders.length} transaction rows
                      </div>
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleExportFinancialLedger}
                  className={`w-full py-2 px-3 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-colors ${
                    isServepoint ? 'bg-[#B88E2F] hover:bg-[#967221]' : 'bg-[#F97316] hover:bg-[#EA580C]'
                  }`}
                >
                  <Download className="w-4 h-4" />
                  <span>Download Financial Ledger (.csv)</span>
                </button>
              </div>

              {/* Option 2: Daily Sales Summary */}
              <div className={`p-4 rounded-xl border transition-all space-y-3 ${
                isServepoint
                  ? 'bg-[#F6F5F2] border-[#E3E7E0] hover:border-[#0F3D3E]/40'
                  : 'bg-[#FFFDF9] border-[#E9E0D6] hover:border-[#A7F3D0]'
              }`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                      isServepoint ? 'bg-[#0F3D3E] text-white' : 'bg-[#E8F5EC] text-[#10B981]'
                    }`}>
                      <TrendingUp className="w-5 h-5" />
                    </div>
                    <div>
                      <div className={`font-semibold text-sm ${isServepoint ? 'text-[#1A1A1A]' : 'text-[#1C1917]'}`}>
                        Daily Sales & Revenue Summary
                      </div>
                      <div className={`text-xs mt-0.5 ${isServepoint ? 'text-[#6B6B6B]' : 'text-[#57534E]'}`}>
                        Aggregated daily revenue, net sales, total tax collected, average ticket size, and revenue breakdown by payment method (UPI, Cash, Card).
                      </div>
                      <div className={`text-[11px] mt-1 ${isServepoint ? 'text-[#0F3D3E]' : 'font-mono text-[#10B981]'}`}>
                        Daily audited totals grouped by date
                      </div>
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleExportDailySummary}
                  className={`w-full py-2 px-3 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-colors ${
                    isServepoint ? 'bg-[#0F3D3E] hover:bg-[#0B3132]' : 'bg-[#10B981] hover:bg-[#059669]'
                  }`}
                >
                  <Download className="w-4 h-4" />
                  <span>Download Daily Sales Summary (.csv)</span>
                </button>
              </div>

              {/* Option 3: Inventory & Raw Materials */}
              <div className={`p-4 rounded-xl border transition-all space-y-3 ${
                isServepoint
                  ? 'bg-[#F6F5F2] border-[#E3E7E0] hover:border-[#967221]/50'
                  : 'bg-[#FFFDF9] border-[#E9E0D6] hover:border-[#BAE6FD]'
              }`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                      isServepoint ? 'bg-[#B88E2F]/15 text-[#967221]' : 'bg-[#EFF6FF] text-[#0284C7]'
                    }`}>
                      <Package className="w-5 h-5" />
                    </div>
                    <div>
                      <div className={`font-semibold text-sm ${isServepoint ? 'text-[#1A1A1A]' : 'text-[#1C1917]'}`}>
                        Inventory & Raw Stock Valuation
                      </div>
                      <div className={`text-xs mt-0.5 ${isServepoint ? 'text-[#6B6B6B]' : 'text-[#57534E]'}`}>
                        Current stock on hand for coffee beans, dairy, dry goods, and kitchen prep. Includes low-stock threshold triggers and suggested replenishment quantities.
                      </div>
                      <div className={`text-[11px] mt-1 ${isServepoint ? 'text-[#967221]' : 'font-mono text-[#0284C7]'}`}>
                        Includes {safeIngredients.length} inventory catalog items
                      </div>
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleExportInventory}
                  className={`w-full py-2 px-3 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-colors ${
                    isServepoint ? 'bg-[#967221] hover:bg-[#7A5D1A]' : 'bg-[#0284C7] hover:bg-[#0369A1]'
                  }`}
                >
                  <Download className="w-4 h-4" />
                  <span>Download Inventory Valuation (.csv)</span>
                </button>
              </div>
            </div>

            <div className={`p-4 border-t flex items-center justify-between text-xs ${
              isServepoint
                ? 'bg-white border-[#E3E7E0] text-[#6B6B6B]'
                : 'bg-[#FFF9F2] border-[#E9E0D6] text-[#57534E]'
            }`}>
              <span>UTF-8 BOM encoded for direct import into Microsoft Excel & Google Sheets</span>
              <button
                onClick={() => setIsExportModalOpen(false)}
                className={`px-3 py-1.5 border font-semibold rounded-xl transition-colors ${
                  isServepoint
                    ? 'bg-white border-[#E3E7E0] text-[#1A1A1A] hover:bg-[#D9E2DD]/60'
                    : 'bg-white border-[#D5C9BD] text-[#1C1917] hover:bg-[#F5EBE1]'
                }`}
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
