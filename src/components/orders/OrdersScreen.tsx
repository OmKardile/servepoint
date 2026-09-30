import React, { useState } from 'react';
import { useTsosStore } from '../../lib/store';
import { Order, OrderStatus } from '../../types';
import { ReceiptModal } from '../pos/ReceiptModal';
import { ManualPrintReceiptModal } from '../pos/ManualPrintReceiptModal';
import { PrintLogsSection } from './PrintLogsSection';
import {
  Receipt,
  Search,
  Filter,
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
  Bluetooth,
  Activity,
  AlertTriangle,
} from 'lucide-react';

export const OrdersScreen: React.FC = () => {
  const { orders, printLogs, themeMode } = useTsosStore();
  const isTessera = themeMode === 'tessera';
  const [activeView, setActiveView] = useState<'orders' | 'print_logs'>('orders');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewingReceiptOrder, setViewingReceiptOrder] = useState<Order | null>(null);
  const [manualPrintOrder, setManualPrintOrder] = useState<Order | null>(null);
  const [isManualPrintOpen, setIsManualPrintOpen] = useState(false);

  const safeOrders = orders || [];
  const safePrintLogs = printLogs || [];
  const failedPrintJobsCount = safePrintLogs.filter((l) => l.status === 'failed').length;
  const filteredOrders = safeOrders.filter((order) => {
    if (statusFilter !== 'all' && order.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const numMatch = order.order_number.toString().includes(q);
      const custMatch = order.customer_name?.toLowerCase().includes(q);
      const itemMatch = (order.items || []).some((i) => i.menu_item_name.toLowerCase().includes(q));
      return numMatch || custMatch || itemMatch;
    }
    return true;
  });

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

  return (
    <div className={`flex-1 flex flex-col h-[calc(100vh-100px)] overflow-hidden ${isTessera ? 'bg-[#0A1410]' : 'bg-[#FFF9F2]'}`}>
      {/* Primary Sub-Navigation Bar */}
      <div className={`px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 shrink-0 border-b ${
        isTessera ? 'bg-[#0F1D17] border-[#1F3D2E]' : 'bg-white border-[#E9E0D6]'
      }`}>
        <div className={`flex items-center gap-1.5 p-1 rounded-2xl border ${
          isTessera ? 'bg-[#0A1410] border-[#2A4A37]' : 'bg-[#F5F0EB] border-[#E9E0D6]'
        }`}>
          <button
            onClick={() => setActiveView('orders')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
              activeView === 'orders'
                ? isTessera
                  ? 'bg-[#C5F82A] text-[#0A1410] tessera-block'
                  : 'bg-white text-[#1C1917] shadow-xs'
                : isTessera
                  ? 'text-[#6B8579] hover:text-[#F5F4EE]'
                  : 'text-[#57534E] hover:text-[#1C1917]'
            }`}
          >
            <ShoppingBag className={`w-3.5 h-3.5 ${activeView === 'orders' && isTessera ? '' : isTessera ? 'text-[#C5F82A]' : 'text-[#F97316]'}`} />
            <span>Orders Directory</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-semibold ${
              activeView === 'orders' && isTessera
                ? 'bg-[#0A1410]/15 text-[#0A1410]'
                : isTessera
                  ? 'bg-[#142620] text-[#C5F82A] border border-[#2A4A37]'
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
                  : 'bg-white text-[#1C1917] shadow-xs'
                : isTessera
                  ? 'text-[#6B8579] hover:text-[#F5F4EE]'
                  : 'text-[#57534E] hover:text-[#1C1917]'
            }`}
          >
            <Printer className={`w-3.5 h-3.5 ${activeView === 'print_logs' && isTessera ? '' : isTessera ? 'text-[#60A5FA]' : 'text-blue-600'}`} />
            <span>Print Logs</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-semibold ${
              activeView === 'print_logs' && isTessera
                ? 'bg-[#0A1410]/15 text-[#0A1410]'
                : isTessera
                  ? 'bg-[#142620] text-[#60A5FA] border border-[#2A4A37]'
                  : 'bg-[#E9E0D6] text-[#1C1917]'
            }`}>
              {safePrintLogs.length}
            </span>
            {failedPrintJobsCount > 0 && (
              <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-bold font-mono ${
                isTessera
                  ? 'bg-[#F87171]/12 text-[#FCA5A5] border border-[#F87171]/40'
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
              onClick={() => {
                setManualPrintOrder(filteredOrders[0] || null);
                setIsManualPrintOpen(true);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 border ${
                isTessera
                  ? 'tessera-ghost border-[#2A4A37] bg-[#0A1410] text-[#F5F4EE]'
                  : 'border-[#D5C9BD] bg-white hover:bg-[#F5F0EB] text-[#1C1917] shadow-xs'
              }`}
              title="Manual Print Receipt Module (Thermal & Web Bluetooth)"
            >
              <Printer className={`w-3.5 h-3.5 ${isTessera ? 'text-[#C5F82A]' : 'text-[#F97316]'}`} />
              <span>Thermal Workstation</span>
              <span className={`text-[10px] px-1 rounded-md font-mono border ${
                isTessera
                  ? 'text-[#60A5FA] bg-[#60A5FA]/10 border-[#60A5FA]/40'
                  : 'text-blue-700 bg-blue-50 border-blue-200'
              }`}>
                BT
              </span>
            </button>
          )}
        </div>
      </div>

      {/* View 1: Orders Directory */}
      {activeView === 'orders' && (
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
                          onClick={() => {
                            setManualPrintOrder(order);
                            setIsManualPrintOpen(true);
                          }}
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

      {/* View 2: Print Logs Section */}
      {activeView === 'print_logs' && (
        <PrintLogsSection
          onOpenManualPrint={(order) => {
            setManualPrintOrder(order || filteredOrders[0] || null);
            setIsManualPrintOpen(true);
          }}
        />
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
