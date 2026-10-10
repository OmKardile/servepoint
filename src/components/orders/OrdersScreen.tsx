import React, { useState, useEffect, useMemo } from 'react';
import { useTsosStore } from '../../lib/store';
import { Order, OrderStatus } from '../../types';
import { exportFinancialLedgerCSV } from '../../utils/csvExport';
import { ReceiptModal } from '../pos/ReceiptModal';
import { ManualPrintReceiptModal } from '../pos/ManualPrintReceiptModal';
import { PrintLogsSection } from './PrintLogsSection';
import {
  Receipt,
  Search,
  Eye,
  Utensils,
  ShoppingBag,
  CreditCard,
  Banknote,
  QrCode,
  CheckCircle2,
  Clock,
  Ban,
  Printer,
  AlertTriangle,
  Download,
  ArrowRight,
  StickyNote,
  MousePointerClick,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/* ServePoint status language (exact tokens, Bills frame ramp)         */
/* ------------------------------------------------------------------ */
const SP_STATUS: Record<OrderStatus, { dot: string; text: string; chip: string; label: string }> = {
  new: { dot: 'bg-[#B88E2F]', text: 'text-[#967221]', chip: 'bg-[#B88E2F]/10 text-[#967221]', label: 'New' },
  preparing: { dot: 'bg-[#0F3D3E]', text: 'text-[#0F3D3E]', chip: 'bg-[#0F3D3E]/8 text-[#0F3D3E]', label: 'Preparing' },
  ready: { dot: 'bg-[#17803D]', text: 'text-[#17803D]', chip: 'bg-[#17803D]/8 text-[#17803D]', label: 'Ready' },
  completed: { dot: 'bg-[#969696]', text: 'text-[#6B6B6B]', chip: 'bg-[#6B6B6B]/10 text-[#6B6B6B]', label: 'Completed' },
  cancelled: { dot: 'bg-[#DC2626]', text: 'text-[#DC2626]', chip: 'bg-[#DC2626]/8 text-[#DC2626]', label: 'Cancelled' },
};

const NEXT_STATUS_LABEL: Partial<Record<OrderStatus, string>> = {
  new: 'Preparing',
  preparing: 'Ready',
  ready: 'Completed',
};

export const OrdersScreen: React.FC = () => {
  const { orders, printLogs, themeMode, advanceOrderStatus } = useTsosStore();
  const isTessera = themeMode === 'tessera';
  const isServepoint = themeMode === 'servepoint';
  const [activeView, setActiveView] = useState<'orders' | 'print_logs'>('orders');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | '7d'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [viewingReceiptOrder, setViewingReceiptOrder] = useState<Order | null>(null);
  const [manualPrintOrder, setManualPrintOrder] = useState<Order | null>(null);
  const [isManualPrintOpen, setIsManualPrintOpen] = useState(false);

  const safeOrders = orders || [];
  const safePrintLogs = printLogs || [];
  const failedPrintJobsCount = safePrintLogs.filter((l) => l.status === 'failed').length;

  /* Toast auto-dismiss */
  useEffect(() => {
    if (!toastMessage) return;
    const t = setTimeout(() => setToastMessage(null), 2600);
    return () => clearTimeout(t);
  }, [toastMessage]);

  /* Date-range filter (new feature) */
  const dateFiltered = useMemo(() => {
    if (dateFilter === 'all') return safeOrders;
    const now = new Date();
    if (dateFilter === 'today') {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      return safeOrders.filter((o) => new Date(o.created_at).getTime() >= start.getTime());
    }
    const cutoff = now.getTime() - 7 * 24 * 60 * 60 * 1000;
    return safeOrders.filter((o) => new Date(o.created_at).getTime() >= cutoff);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFilter, safeOrders]);

  const filteredOrders = useMemo(
    () =>
      dateFiltered
        .filter((order) => {
          if (statusFilter !== 'all' && order.status !== statusFilter) return false;
          if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            const numMatch = order.order_number.toString().includes(q);
            const custMatch = order.customer_name?.toLowerCase().includes(q);
            const itemMatch = (order.items || []).some((i) => i.menu_item_name.toLowerCase().includes(q));
            return numMatch || custMatch || itemMatch;
          }
          return true;
        })
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [dateFiltered, statusFilter, searchQuery]
  );

  const selectedOrder = useMemo(
    () => filteredOrders.find((o) => o.id === selectedOrderId) || null,
    [filteredOrders, selectedOrderId]
  );

  /* Auto-select first order (ServePoint detail pane) */
  useEffect(() => {
    if (!isServepoint || activeView !== 'orders') return;
    if (filteredOrders.length === 0) {
      if (selectedOrderId !== null) setSelectedOrderId(null);
      return;
    }
    if (!selectedOrder || !filteredOrders.some((o) => o.id === selectedOrderId)) {
      setSelectedOrderId(filteredOrders[0].id);
    }
  }, [filteredOrders, selectedOrder, selectedOrderId, isServepoint, activeView]);

  const filteredValue = filteredOrders
    .filter((o) => o.status !== 'cancelled')
    .reduce((s, o) => s + o.grand_total, 0);

  const getStatusBadge = (status: OrderStatus) => {
    const dot = (cls: string) => <span className={`w-1.5 h-1.5 rounded-full ${cls}`} />;
    if (isTessera) {
      switch (status) {
        case 'new':
          return (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#F97316]/12 text-[#FDBA74] border border-[#F97316]/40">
              {dot('bg-[#F97316]')}
              New
            </span>
          );
        case 'preparing':
          return (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#C084FC]/12 text-[#D8B4FE] border border-[#C084FC]/40">
              <Clock className="w-3 h-3" />
              Preparing
            </span>
          );
        case 'ready':
          return (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#34D399]/12 text-[#6EE7B7] border border-[#34D399]/40">
              <span className="relative flex w-1.5 h-1.5">
                <span className="absolute inline-flex h-full w-full rounded-full bg-[#34D399] opacity-75 animate-ping" />
                <span className="relative inline-flex rounded-full w-1.5 h-1.5 bg-[#34D399]" />
              </span>
              Ready
            </span>
          );
        case 'completed':
          return (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-white/6 text-[#6B8579] border border-white/15">
              <CheckCircle2 className="w-3 h-3" />
              Completed
            </span>
          );
        case 'cancelled':
          return (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#F87171]/12 text-[#FCA5A5] border border-[#F87171]/40">
              <Ban className="w-3 h-3" />
              Cancelled
            </span>
          );
      }
    }
    if (isServepoint) {
      const cfg = SP_STATUS[status];
      return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${cfg.chip}`}>
          {status === 'ready' ? (
            <span className="relative flex w-1.5 h-1.5">
              <span className={`absolute inline-flex h-full w-full rounded-full opacity-60 animate-ping ${cfg.dot}`} />
              <span className={`relative inline-flex rounded-full w-1.5 h-1.5 ${cfg.dot}`} />
            </span>
          ) : (
            dot(cfg.dot)
          )}
          {cfg.label}
        </span>
      );
    }
    switch (status) {
      case 'new':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#FFF1E6] text-[#F97316]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#F97316]" />
            New
          </span>
        );
      case 'preparing':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#FFF4E5] text-[#B45309]">
            <Clock className="w-3 h-3" />
            Preparing
          </span>
        );
      case 'ready':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#E8F5EC] text-[#17803D]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#17803D] animate-ping" />
            Ready
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#F5F0EB] text-[#57534E]">
            <CheckCircle2 className="w-3 h-3" />
            Completed
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#FEF2F2] text-[#B42318]">
            <Ban className="w-3 h-3" />
            Cancelled
          </span>
        );
    }
  };

  const getPaymentIcon = (method?: string) => {
    if (isServepoint) {
      switch (method) {
        case 'upi':
          return <QrCode className="w-3.5 h-3.5 text-[#0F3D3E]" />;
        case 'cash':
          return <Banknote className="w-3.5 h-3.5 text-[#967221]" />;
        case 'card':
          return <CreditCard className="w-3.5 h-3.5 text-[#2C7A7B]" />;
        default:
          return <Receipt className="w-3.5 h-3.5 text-[#6B6B6B]" />;
      }
    }
    switch (method) {
      case 'upi':
        return <QrCode className={`w-3.5 h-3.5 ${isTessera ? 'text-[#C5F82A]' : 'text-[#F97316]'}`} />;
      case 'cash':
        return <Banknote className={`w-3.5 h-3.5 ${isTessera ? 'text-[#34D399]' : 'text-[#17803D]'}`} />;
      case 'card':
        return <CreditCard className={`w-3.5 h-3.5 ${isTessera ? 'text-[#60A5FA]' : 'text-[#2563EB]'}`} />;
      default:
        return <Receipt className={`w-3.5 h-3.5 ${isTessera ? 'text-[#6B8579]' : 'text-[#A8A29E]'}`} />;
    }
  };

  /* ---------------- New-feature handlers ---------------- */
  const handleExportCSV = () => {
    if (filteredOrders.length === 0) {
      setToastMessage('No orders to export in this view');
      return;
    }
    exportFinancialLedgerCSV(filteredOrders);
    setToastMessage(`Exported ${filteredOrders.length} orders to CSV`);
  };

  const handleAdvanceStatus = () => {
    if (!selectedOrder) return;
    const nextLabel = NEXT_STATUS_LABEL[selectedOrder.status];
    if (!nextLabel) return;
    const num = selectedOrder.order_number;
    advanceOrderStatus(selectedOrder.id);
    setToastMessage(`Order #${num} moved to ${nextLabel} — KDS & cloud synced`);
  };

  const handlePrintInvoice = (order: Order | null) => {
    setManualPrintOrder(order);
    setIsManualPrintOpen(true);
  };

  return (
    <div className={`flex-1 flex flex-col h-[calc(100vh-145px)] overflow-hidden ${
      isTessera ? 'bg-[#0A1410]' : isServepoint ? 'bg-[#F6F5F2]' : 'bg-[#FFF9F2]'
    }`}>
      {/* Primary Sub-Navigation Bar */}
      <div className={`px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 shrink-0 border-b ${
        isTessera ? 'bg-[#0F1D17] border-[#1F3D2E]' : isServepoint ? 'bg-white border-[#E3E7E0]' : 'bg-white border-[#E9E0D6]'
      }`}>
        <div className={`flex items-center gap-1.5 p-1 rounded-2xl border ${
          isTessera ? 'bg-[#0A1410] border-[#2A4A37]' : isServepoint ? 'bg-[#F6F5F2] border-[#E3E7E0]' : 'bg-[#F5F0EB] border-[#E9E0D6]'
        }`}>
          <button
            onClick={() => setActiveView('orders')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
              activeView === 'orders'
                ? isTessera
                  ? 'bg-[#C5F82A] text-[#0A1410] tessera-block'
                  : 'bg-white text-[#1A1A1A] shadow-xs'
                : isTessera
                  ? 'text-[#6B8579] hover:text-[#F5F4EE]'
                  : 'text-[#57534E] hover:text-[#1C1917]'
            }`}
          >
            <ShoppingBag className={`w-3.5 h-3.5 ${activeView === 'orders' && isTessera ? '' : isTessera ? 'text-[#C5F82A]' : isServepoint ? 'text-[#0F3D3E]' : 'text-[#F97316]'}`} />
            <span>Orders Directory</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-semibold ${
              activeView === 'orders' && isTessera
                ? 'bg-[#0A1410]/15 text-[#0A1410]'
                : isTessera
                  ? 'bg-[#142620] text-[#C5F82A] border border-[#2A4A37]'
                  : isServepoint
                    ? 'bg-[#D9E2DD] text-[#0F3D3E]'
                    : 'bg-[#E9E0D6] text-[#1C1917]'
            }`}>
              {safeOrders.length}
            </span>
          </button>

          <button
            onClick={() => setActiveView('print_logs')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
              activeView === 'print_logs'
                ? isTessera
                  ? 'bg-[#C5F82A] text-[#0A1410] tessera-block'
                  : 'bg-white text-[#1A1A1A] shadow-xs'
                : isTessera
                  ? 'text-[#6B8579] hover:text-[#F5F4EE]'
                  : 'text-[#57534E] hover:text-[#1C1917]'
            }`}
          >
            <Printer className={`w-3.5 h-3.5 ${activeView === 'print_logs' && isTessera ? '' : isTessera ? 'text-[#60A5FA]' : isServepoint ? 'text-[#B88E2F]' : 'text-blue-600'}`} />
            <span>Print Logs</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-semibold ${
              activeView === 'print_logs' && isTessera
                ? 'bg-[#0A1410]/15 text-[#0A1410]'
                : isTessera
                  ? 'bg-[#142620] text-[#60A5FA] border border-[#2A4A37]'
                  : isServepoint
                    ? 'bg-[#D9E2DD] text-[#0F3D3E]'
                    : 'bg-[#E9E0D6] text-[#1C1917]'
            }`}>
              {safePrintLogs.length}
            </span>
            {failedPrintJobsCount > 0 && (
              <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-semibold ${
                isTessera
                  ? 'bg-[#F87171]/12 text-[#FCA5A5] border border-[#F87171]/40'
                  : isServepoint
                    ? 'bg-[#DC2626]/8 text-[#DC2626] border border-[#DC2626]/25'
                    : 'bg-rose-100 text-rose-700 border border-rose-200'
              }`}>
                <AlertTriangle className="w-2.5 h-2.5" />
                {failedPrintJobsCount} err
              </span>
            )}
          </button>
        </div>

        <div className="flex items-center gap-2">
          {activeView === 'orders' && (
            <button
              onClick={() => handlePrintInvoice(filteredOrders[0] || null)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 border ${
                isTessera
                  ? 'tessera-ghost border-[#2A4A37] bg-[#0A1410] text-[#F5F4EE]'
                  : isServepoint
                    ? 'border-[#E3E7E0] bg-white hover:bg-[#F6F5F2] text-[#1A1A1A] shadow-xs'
                    : 'border-[#D5C9BD] bg-white hover:bg-[#F5F0EB] text-[#1C1917] shadow-xs'
              }`}
              title="Manual Print Receipt Module (Thermal & Web Bluetooth)"
            >
              <Printer className={`w-3.5 h-3.5 ${isTessera ? 'text-[#C5F82A]' : isServepoint ? 'text-[#B88E2F]' : 'text-[#F97316]'}`} />
              <span>Thermal Workstation</span>
              <span className={`text-[10px] px-1 rounded-md font-semibold border ${
                isTessera
                  ? 'text-[#60A5FA] bg-[#60A5FA]/10 border-[#60A5FA]/40'
                  : isServepoint
                    ? 'text-[#0F3D3E] bg-[#D9E2DD] border-[#D9E2DD]'
                    : 'text-blue-700 bg-blue-50 border-blue-200'
              }`}>
                BT
              </span>
            </button>
          )}
        </div>
      </div>

      {/* View 1: Orders Directory — legacy table (Tessera explicit; dark & warm via CSS remap) */}
      {activeView === 'orders' && !isServepoint && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Top Filter Bar */}
          <div className={`p-4 border-b flex flex-wrap items-center justify-between gap-3 ${
            isTessera ? 'bg-[#0F1D17] border-[#1F3D2E]' : 'bg-white border-[#E9E0D6]'
          }`}>
            <div className="relative flex-1 min-w-[220px] max-w-md">
              <Search className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 ${isTessera ? 'text-[#6B8579]' : 'text-[#A8A29E]'}`} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search order #, customer, or dish name..."
                className={`w-full pl-9 pr-4 py-2 text-sm rounded-xl border focus:outline-hidden transition-colors ${
                  isTessera
                    ? 'bg-[#0A1410] border-[#2A4A37] text-[#F5F4EE] placeholder-[#6B8579] focus:border-[#C5F82A]'
                    : 'border-[#E9E0D6] bg-[#FFF9F2] focus:bg-white focus:border-[#F97316] text-[#1C1917]'
                }`}
              />
            </div>

            {/* Status Filters */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {[
                { id: 'all', label: 'All Orders' },
                { id: 'new', label: 'New' },
                { id: 'preparing', label: 'Preparing' },
                { id: 'ready', label: 'Ready' },
                { id: 'completed', label: 'Completed' },
                { id: 'cancelled', label: 'Cancelled' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setStatusFilter(tab.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                    statusFilter === tab.id
                      ? isTessera
                        ? 'bg-[#C5F82A] text-[#0A1410] tessera-block'
                        : 'bg-[#1C1917] text-white shadow-xs'
                      : isTessera
                        ? 'bg-[#142620] text-[#6B8579] hover:text-[#F5F4EE] border border-[#2A4A37]'
                        : 'bg-[#F5F0EB] text-[#57534E] hover:bg-[#E9E0D6]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

      {/* Orders Table */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className={`rounded-2xl border overflow-hidden ${
          isTessera ? 'bg-[#0F1D17] border-[#1F3D2E] tessera-block' : 'bg-white border-[#E9E0D6] shadow-xs'
        }`}>
          <table className="w-full text-left text-sm">
            <thead className={`border-b text-[11px] font-semibold uppercase tracking-wider ${
              isTessera ? 'bg-[#0A1410] border-[#1F3D2E] text-[#6B8579]' : 'bg-[#FFF9F2] border-[#E9E0D6] text-[#57534E]'
            }`}>
              <tr>
                <th className="py-3 px-4">Order</th>
                <th className="py-3 px-4">Type / Table</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Items</th>
                <th className="py-3 px-4">Total & Fee</th>
                <th className="py-3 px-4">Payment</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className={isTessera ? 'divide-y divide-[#1F3D2E]' : 'divide-y divide-[#F5F0EB]'}>
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <Receipt className={`w-8 h-8 stroke-[1.5] ${isTessera ? 'text-[#2A4A37]' : 'text-[#E9E0D6]'}`} />
                      <span className={`font-serif italic text-lg ${
                        isTessera ? 'text-[#6B8579]' : 'text-[#A8A29E] font-sans not-italic text-sm'
                      }`}>
                        No orders in this lane yet.
                      </span>
                      <span className={`text-xs ${isTessera ? 'text-[#4A6357]' : 'text-[#A8A29E]'}`}>
                        New tickets appear here the moment a sale is tendered.
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => (
                  <tr key={order.id} className={`transition-colors ${
                    isTessera ? 'hover:bg-[#142620]/60' : 'hover:bg-[#FFF9F2]/50'
                  }`}>
                    <td className="py-3.5 px-4">
                      <div className={`font-mono font-bold ${isTessera ? 'text-[#F5F4EE]' : 'text-[#1C1917]'}`}>
                        #{order.order_number}
                      </div>
                      <div className={`text-[11px] font-mono ${isTessera ? 'text-[#6B8579]' : 'text-[#A8A29E]'}`}>
                        {new Date(order.created_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium">
                        {order.order_type === 'dine_in' ? (
                          <>
                            <Utensils className={`w-3.5 h-3.5 ${isTessera ? 'text-[#C5F82A]' : 'text-[#F97316]'}`} />
                            <span className={isTessera ? 'text-[#F5F4EE]' : 'text-[#1C1917]'}>{order.table_label || 'Dine-In'}</span>
                          </>
                        ) : (
                          <>
                            <ShoppingBag className={`w-3.5 h-3.5 ${isTessera ? 'text-[#6B8579]' : 'text-[#57534E]'}`} />
                            <span className={`capitalize ${isTessera ? 'text-[#F5F4EE]' : 'text-[#1C1917]'}`}>{order.order_type}</span>
                          </>
                        )}
                      </span>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className={`font-medium ${
                        isTessera ? 'font-serif italic text-[13.5px] text-[#F5F4EE]' : 'text-[#1C1917]'
                      }`}>
                        {order.customer_name || 'Walk-in Guest'}
                      </div>
                      {order.customer_phone && (
                        <div className={`text-[11px] font-mono ${isTessera ? 'text-[#6B8579]' : 'text-[#A8A29E]'}`}>
                          {order.customer_phone}
                        </div>
                      )}
                      {(order.loyalty_points_earned || order.loyalty_points_redeemed) && (
                        <div className="flex items-center gap-1.5 text-[10px] mt-0.5">
                          {order.loyalty_points_earned ? (
                            <span className={`font-semibold px-1.5 py-0.2 rounded-sm ${
                              isTessera
                                ? 'text-[#6EE7B7] bg-[#34D399]/12 border border-[#34D399]/30'
                                : 'text-emerald-700 bg-emerald-50'
                            }`}>
                              +{order.loyalty_points_earned} pts
                            </span>
                          ) : null}
                          {order.loyalty_points_redeemed ? (
                            <span className={`font-semibold px-1.5 py-0.2 rounded-sm ${
                              isTessera
                                ? 'text-[#D8B4FE] bg-[#C084FC]/12 border border-[#C084FC]/30'
                                : 'text-purple-700 bg-purple-50'
                            }`}>
                              -{order.loyalty_points_redeemed} pts
                            </span>
                          ) : null}
                        </div>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      <div className={`text-xs max-w-xs truncate ${isTessera ? 'text-[#A8BDB0]' : 'text-[#1C1917]'}`}>
                        {(order.items || []).map((i) => `${i.qty}x ${i.menu_item_name}`).join(', ')}
                      </div>
                      <div className={`text-[10px] ${isTessera ? 'text-[#6B8579]' : 'text-[#A8A29E]'}`}>
                        {(order.items || []).reduce((s, i) => s + (i?.qty || 0), 0)} total items
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className={`font-mono font-bold ${isTessera ? 'text-[#C5F82A]' : 'text-[#1C1917]'}`}>
                        ₹{order.grand_total.toFixed(2)}
                      </div>
                      <div className={`text-[10px] flex items-center gap-1 ${isTessera ? 'text-[#6B8579]' : 'text-[#57534E]'}`}>
                        <span>Fee: ₹{order.platform_fee}</span>
                        <span className={`px-1 rounded-sm ${
                          isTessera
                            ? 'bg-[#F97316]/12 text-[#FDBA74] border border-[#F97316]/30'
                            : 'bg-[#FFF1E6] text-[#F97316]'
                        }`}>
                          {order.fee_payer === 'cafe' ? 'Cafe' : 'Cust'}
                        </span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className={`inline-flex items-center gap-1.5 text-xs capitalize font-medium ${
                        isTessera ? 'text-[#F5F4EE]' : 'text-[#1C1917]'
                      }`}>
                        {getPaymentIcon(order.payment_method)}
                        <span>{order.payment_method || 'Paid'}</span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">{getStatusBadge(order.status)}</td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handlePrintInvoice(order)}
                          className={`p-1.5 rounded-lg border transition-colors ${
                            isTessera
                              ? 'border-[#2A4A37] bg-[#0A1410] text-[#60A5FA] hover:border-[#60A5FA]/60 hover:bg-[#60A5FA]/10'
                              : 'border-[#D5C9BD] bg-white hover:bg-blue-50 text-blue-600 hover:text-blue-800'
                          }`}
                          title="Manual Print Receipt (Web Bluetooth & Custom Format)"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setViewingReceiptOrder(order)}
                          className={`p-1.5 rounded-lg border transition-colors ${
                            isTessera
                              ? 'border-[#2A4A37] bg-[#0A1410] text-[#6B8579] hover:text-[#C5F82A] hover:border-[#C5F82A]/50'
                              : 'border-[#E9E0D6] bg-white hover:bg-[#F5F0EB] text-[#57534E] hover:text-[#1C1917]'
                          }`}
                          title="View Quick Receipt"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      </div>
      )}

      {/* View 1b: Orders Directory — ServePoint two-pane (Bills frames 219:23130 / 219:24297) */}
      {activeView === 'orders' && isServepoint && (
        <div className="flex flex-col lg:flex-row overflow-hidden h-[calc(100vh-204px)] max-h-[calc(100vh-204px)]">
          {/* LEFT PANE — order cards list */}
          <aside className="w-full lg:w-[420px] shrink-0 flex flex-col bg-white lg:border-r border-[#E3E7E0] border-b lg:border-b-0 lg:max-h-none max-h-[55vh]">
            {/* Pane header */}
            <div className="px-4 pt-4 pb-3 shrink-0">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-[#1A1A1A] tracking-tight">Orders</h2>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#D9E2DD] text-[#0F3D3E]">
                    {filteredOrders.length}
                  </span>
                </div>
                <button
                  onClick={handleExportCSV}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-[#967221] bg-[#B88E2F]/8 border border-[#B88E2F]/30 hover:bg-[#B88E2F]/15 transition-colors"
                  title="Export filtered orders to CSV"
                >
                  <Download className="w-3.5 h-3.5" />
                  Export
                </button>
              </div>

              {/* Summary strip */}
              <p className="mt-1 text-[11px] text-[#6B6B6B]">
                {filteredOrders.length} order{filteredOrders.length === 1 ? '' : 's'} in view
                {filteredOrders.length > 0 && (
                  <> · <span className="font-semibold text-[#1A1A1A]">₹{filteredValue.toFixed(2)}</span> combined value</>
                )}
              </p>

              {/* Status pills */}
              <div className="mt-3 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                {[
                  { id: 'all', label: 'All Orders' },
                  { id: 'new', label: 'New' },
                  { id: 'preparing', label: 'Preparing' },
                  { id: 'ready', label: 'Ready' },
                  { id: 'completed', label: 'Completed' },
                  { id: 'cancelled', label: 'Cancelled' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setStatusFilter(tab.id)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all border ${
                      statusFilter === tab.id
                        ? 'bg-[#0F3D3E] text-white border-[#0F3D3E] shadow-xs'
                        : 'bg-white text-[#6B6B6B] border-[#E3E7E0] hover:bg-[#F6F5F2] hover:text-[#1A1A1A]'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Date range filter */}
              <div className="mt-2 flex items-center gap-2">
                <span className="text-[11px] font-medium text-[#6B6B6B] uppercase tracking-wider">Date</span>
                <div className="flex items-center gap-1 p-0.5 rounded-xl bg-[#F6F5F2] border border-[#E3E7E0]">
                  {[
                    { id: 'all' as const, label: 'All Time' },
                    { id: 'today' as const, label: 'Today' },
                    { id: '7d' as const, label: 'Last 7 Days' },
                  ].map((d) => (
                    <button
                      key={d.id}
                      onClick={() => setDateFilter(d.id)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                        dateFilter === d.id
                          ? 'bg-white text-[#0F3D3E] shadow-xs border border-[#E3E7E0]'
                          : 'text-[#6B6B6B] hover:text-[#1A1A1A]'
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Cards list */}
            <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-3 space-y-2">
              {filteredOrders.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center gap-2 py-10 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-[#D9E2DD] flex items-center justify-center">
                    <Receipt className="w-5 h-5 text-[#0F3D3E]" />
                  </div>
                  <span className="text-sm font-semibold text-[#1A1A1A]">No orders in this view</span>
                  <span className="text-xs text-[#6B6B6B] max-w-[240px]">
                    Adjust the filters or search — new tickets appear here the moment a sale is tendered.
                  </span>
                </div>
              ) : (
                filteredOrders.map((order) => {
                  const selected = order.id === selectedOrderId;
                  const cfg = SP_STATUS[order.status];
                  const itemCount = (order.items || []).reduce((s, i) => s + (i?.qty || 0), 0);
                  return (
                    <button
                      key={order.id}
                      onClick={() => setSelectedOrderId(order.id)}
                      className={`w-full text-left rounded-2xl border p-3.5 transition-all ${
                        selected
                          ? 'bg-[#F6F5F2] border-[#0F3D3E]/30 ring-1 ring-[#0F3D3E]/20'
                          : 'bg-white border-[#E3E7E0] hover:bg-[#F6F5F2]/60 hover:border-[#D9E2DD]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-[#1A1A1A] text-[15px]">Order #{order.order_number}</span>
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold">
                              <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                              <span className={cfg.text}>{cfg.label}</span>
                            </span>
                          </div>
                          <div className="mt-0.5 text-xs text-[#6B6B6B] flex items-center gap-1.5">
                            {order.order_type === 'dine_in' ? (
                              <>
                                <Utensils className="w-3 h-3 text-[#B88E2F]" />
                                <span>{order.table_label || 'Dine-In'}</span>
                              </>
                            ) : (
                              <>
                                <ShoppingBag className="w-3 h-3 text-[#0F3D3E]" />
                                <span className="capitalize">{order.order_type.replace('_', '-')}</span>
                              </>
                            )}
                            <span className="text-[#E3E7E0]">·</span>
                            <span>{itemCount} item{itemCount === 1 ? '' : 's'}</span>
                            {order.customer_name && (
                              <>
                                <span className="text-[#E3E7E0]">·</span>
                                <span className="truncate max-w-[110px]">{order.customer_name}</span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="font-bold text-[#1A1A1A] text-[15px]">₹{order.grand_total.toFixed(2)}</div>
                          <div className="text-[11px] text-[#6B6B6B] mt-0.5">
                            {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* Search pinned bottom (per Bills frame) */}
            <div className="p-3 border-t border-[#E3E7E0] shrink-0">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#6B6B6B]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search for order #, customer, dish..."
                  className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl border border-[#E3E7E0] bg-[#F6F5F2] focus:bg-white focus:border-[#0F3D3E] text-[#1A1A1A] placeholder-[#6B6B6B] focus:outline-hidden transition-colors"
                />
              </div>
            </div>
          </aside>

          {/* RIGHT PANE — order detail */}
          <section className="flex-1 min-h-0 min-w-0 overflow-y-auto bg-[#F6F5F2] relative">
            {!selectedOrder ? (
              <div className="h-full flex flex-col items-center justify-center gap-3 p-8 text-center">
                <div className="w-16 h-16 rounded-3xl bg-[#D9E2DD] flex items-center justify-center">
                  <MousePointerClick className="w-7 h-7 text-[#0F3D3E]" />
                </div>
                <span className="text-lg font-bold text-[#1A1A1A]">Select an order</span>
                <span className="text-sm text-[#6B6B6B] max-w-[280px]">
                  Pick any bill from the list to see its full details, items and actions here.
                </span>
              </div>
            ) : (
              <div className="max-w-3xl mx-auto p-4 lg:p-6 pb-40">
                {/* Detail header */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 text-[11px] text-[#6B6B6B]">
                      <span>Orders</span>
                      <span className="text-[#E3E7E0]">/</span>
                      <span className="text-[#1A1A1A] font-medium">Order #{selectedOrder.order_number}</span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-2.5 flex-wrap">
                      <h1 className="text-2xl font-bold text-[#1A1A1A] tracking-tight">
                        Order #{selectedOrder.order_number}
                      </h1>
                      {getStatusBadge(selectedOrder.status)}
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          selectedOrder.payment_status === 'completed'
                            ? 'bg-[#B88E2F]/10 text-[#967221] border border-[#B88E2F]/30'
                            : selectedOrder.payment_status === 'failed'
                              ? 'bg-[#DC2626]/8 text-[#DC2626] border border-[#DC2626]/25'
                              : 'bg-[#6B6B6B]/10 text-[#6B6B6B] border border-[#E3E7E0]'
                        }`}
                      >
                        {selectedOrder.payment_status === 'completed' ? 'PAID' : selectedOrder.payment_status.toUpperCase()}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-[#6B6B6B]">
                      {new Date(selectedOrder.created_at).toLocaleString([], {
                        weekday: 'short',
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                      {' · '}
                      Placed by {selectedOrder.placed_by || 'Staff'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => handlePrintInvoice(selectedOrder)}
                      className="p-2 rounded-xl border border-[#E3E7E0] bg-white hover:bg-[#F6F5F2] text-[#0F3D3E] transition-colors"
                      title="Print Invoice (Thermal & Bluetooth)"
                    >
                      <Printer className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setViewingReceiptOrder(selectedOrder)}
                      className="p-2 rounded-xl border border-[#E3E7E0] bg-white hover:bg-[#F6F5F2] text-[#6B6B6B] hover:text-[#1A1A1A] transition-colors"
                      title="View Quick Receipt"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Details card */}
                <div className="mt-5 bg-white rounded-2xl border border-[#E3E7E0] p-5">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[#6B6B6B]">Details</p>
                  <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-[11px] text-[#6B6B6B]">Table</p>
                      <p className="mt-0.5 text-sm font-semibold text-[#1A1A1A]">
                        {selectedOrder.order_type === 'dine_in' ? selectedOrder.table_label || 'Dine-In' : selectedOrder.order_type.replace('_', '-')}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-[#6B6B6B]">Items</p>
                      <p className="mt-0.5 text-sm font-semibold text-[#1A1A1A]">
                        {(selectedOrder.items || []).reduce((s, i) => s + (i?.qty || 0), 0)}
                      </p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] text-[#6B6B6B]">Customer</p>
                      <p className="mt-0.5 text-sm font-semibold text-[#1A1A1A] truncate">
                        {selectedOrder.customer_name || 'Walk-in Guest'}
                      </p>
                      {selectedOrder.customer_phone && (
                        <p className="text-[11px] text-[#6B6B6B]">{selectedOrder.customer_phone}</p>
                      )}
                    </div>
                    <div>
                      <p className="text-[11px] text-[#6B6B6B]">Payment</p>
                      <p className="mt-0.5 text-sm font-semibold text-[#1A1A1A] capitalize inline-flex items-center gap-1.5">
                        {getPaymentIcon(selectedOrder.payment_method)}
                        {selectedOrder.payment_method || 'Pending'}
                      </p>
                      {selectedOrder.fee_payer && (
                        <p className="text-[11px] text-[#6B6B6B]">
                          Fee ₹{selectedOrder.platform_fee.toFixed(2)} · {selectedOrder.fee_payer === 'cafe' ? 'cafe paid' : 'customer paid'}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Order Info card */}
                <div className="mt-4 bg-white rounded-2xl border border-[#E3E7E0] p-5">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-[#6B6B6B]">Order Info</p>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-[#6B6B6B]">Price</p>
                  </div>
                  <div className="mt-3 space-y-3">
                    {(selectedOrder.items || []).map((item, idx) => (
                      <div key={item.id || idx} className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[#D9E2DD] flex items-center justify-center shrink-0">
                          <Utensils className="w-4 h-4 text-[#0F3D3E]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-[#B88E2F]/10 text-[#967221] border border-[#B88E2F]/25">
                              {item.qty}x
                            </span>
                            <span className="text-sm font-medium text-[#1A1A1A] truncate">{item.menu_item_name}</span>
                          </div>
                          {item.variant_name && (
                            <p className="text-[11px] text-[#6B6B6B] mt-0.5">{item.variant_name}</p>
                          )}
                          {item.addons && item.addons.length > 0 && (
                            <p className="text-[11px] text-[#6B6B6B] mt-0.5 truncate">
                              + {item.addons.map((a) => a.name).join(', ')}
                            </p>
                          )}
                        </div>
                        <span className="text-sm font-semibold text-[#1A1A1A] shrink-0">
                          ₹{(item.item_total || item.qty * item.unit_price).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Totals */}
                  <div className="mt-4 pt-4 border-t border-[#E3E7E0] space-y-1.5">
                    <div className="flex items-center justify-between text-xs text-[#6B6B6B]">
                      <span>Subtotal</span>
                      <span>₹{selectedOrder.subtotal.toFixed(2)}</span>
                    </div>
                    {selectedOrder.discount_total > 0 && (
                      <div className="flex items-center justify-between text-xs text-[#967221]">
                        <span>Discount</span>
                        <span>−₹{selectedOrder.discount_total.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between text-xs text-[#6B6B6B]">
                      <span>GST</span>
                      <span>₹{selectedOrder.tax_total.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-[#6B6B6B]">
                      <span>Platform Fee</span>
                      <span>₹{selectedOrder.platform_fee.toFixed(2)}</span>
                    </div>
                    <div className="pt-2 border-t border-[#E3E7E0] flex items-center justify-between">
                      <span className="text-sm font-semibold text-[#1A1A1A]">Total</span>
                      <span className="text-lg font-bold text-[#1A1A1A]">₹{selectedOrder.grand_total.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* Notes + loyalty */}
                {(selectedOrder.notes || selectedOrder.loyalty_points_earned || selectedOrder.loyalty_points_redeemed) && (
                  <div className="mt-4 space-y-2">
                    {selectedOrder.notes && (
                      <div className="bg-[#D9E2DD]/70 border border-[#D9E2DD] rounded-2xl p-4 flex items-start gap-2.5">
                        <StickyNote className="w-4 h-4 text-[#B88E2F] shrink-0 mt-0.5" />
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#0F3D3E]">Kitchen Notes</p>
                          <p className="text-sm text-[#1A1A1A] mt-0.5">{selectedOrder.notes}</p>
                        </div>
                      </div>
                    )}
                    {(selectedOrder.loyalty_points_earned || selectedOrder.loyalty_points_redeemed) && (
                      <div className="flex items-center gap-2 flex-wrap">
                        {selectedOrder.loyalty_points_earned ? (
                          <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#17803D]/8 text-[#17803D] border border-[#17803D]/20">
                            +{selectedOrder.loyalty_points_earned} loyalty pts earned
                          </span>
                        ) : null}
                        {selectedOrder.loyalty_points_redeemed ? (
                          <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#B88E2F]/10 text-[#967221] border border-[#B88E2F]/25">
                            −{selectedOrder.loyalty_points_redeemed} loyalty pts redeemed
                          </span>
                        ) : null}
                      </div>
                    )}
                  </div>
                )}

                {/* CTA zone */}
                <div className="fixed lg:sticky bottom-0 inset-x-0 lg:inset-x-auto lg:right-0 lg:w-[calc(100%-420px)] p-4 bg-gradient-to-t from-[#F6F5F2] via-[#F6F5F2] to-transparent pointer-events-none">
                  <div className="max-w-3xl mx-auto pointer-events-auto">
                    {NEXT_STATUS_LABEL[selectedOrder.status] ? (
                      <>
                        <button
                          onClick={handleAdvanceStatus}
                          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-[#0F3D3E] hover:bg-[#0B3132] text-white font-semibold text-sm transition-colors shadow-sm"
                        >
                          Move to {NEXT_STATUS_LABEL[selectedOrder.status]}
                          <ArrowRight className="w-4 h-4 text-[#D9E2DD]" />
                        </button>
                        <p className="mt-1.5 text-center text-[11px] text-[#6B6B6B]">
                          Status syncs to KDS, cloud & receipts instantly
                        </p>
                      </>
                    ) : selectedOrder.status === 'completed' ? (
                      <button
                        onClick={() => handlePrintInvoice(selectedOrder)}
                        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-[#B88E2F] hover:bg-[#967221] text-white font-semibold text-sm transition-colors shadow-sm"
                      >
                        <Printer className="w-4 h-4" />
                        Print Invoice
                      </button>
                    ) : (
                      <div className="py-3 text-center text-xs text-[#6B6B6B] bg-white border border-[#E3E7E0] rounded-2xl">
                        This order was cancelled — no further actions available.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      )}

      {/* View 2: Print Logs Section */}
      {activeView === 'print_logs' && (
        <PrintLogsSection
          onOpenManualPrint={(order) => {
            setManualPrintOrder(order || filteredOrders[0] || null);
            setIsManualPrintOpen(true);
          }}
        />
      )}

      {/* Toast (ServePoint deep-teal) */}
      {toastMessage && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[70] flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-[#0F3D3E] text-white shadow-xl border border-[#0B3132] max-w-[92vw]">
          <CheckCircle2 className="w-4 h-4 text-[#B88E2F] shrink-0" />
          <span className="text-sm font-medium">{toastMessage}</span>
        </div>
      )}

      {/* Receipt Modal */}
      {viewingReceiptOrder && (
        <ReceiptModal
          order={viewingReceiptOrder}
          onClose={() => setViewingReceiptOrder(null)}
        />
      )}

      {/* Manual Print Receipt Thermal Workstation Modal */}
      {(isManualPrintOpen || manualPrintOrder) && (
        <ManualPrintReceiptModal
          initialOrder={manualPrintOrder}
          onClose={() => {
            setIsManualPrintOpen(false);
            setManualPrintOrder(null);
          }}
        />
      )}
    </div>
  );
};
