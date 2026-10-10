import React, { useState } from 'react';
import { Order, PaperWidth } from '../../types';
import { useTsosStore } from '../../lib/store';
import {
  X,
  Printer,
  Check,
  ArrowRight,
  Sliders,
  Code,
  FileText,
  Utensils,
  DollarSign,
  CheckCircle2,
  Sparkles,
  RefreshCw,
  ExternalLink,
  MessageCircle,
  Copy,
} from 'lucide-react';
import {
  generateReceiptEscPos,
  generateKotEscPos,
  triggerCashDrawerKick,
  printViaBluetooth,
  getLineWidth,
} from '../../lib/printerService';

interface ReceiptModalProps {
  order: Order;
  onClose: () => void;
  onNewSale?: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ order, onClose, onNewSale }) => {
  const { location, feeConfig, printerConfig, updatePrinterConfig, themeMode } = useTsosStore();

  const isServepoint = themeMode === 'servepoint';

  const [activeTab, setActiveTab] = useState<'bill' | 'kot' | 'escpos'>('bill');
  const [selectedWidth, setSelectedWidth] = useState<PaperWidth>(printerConfig.paper_width || '80mm');
  const [printFeedback, setPrintFeedback] = useState<{ success: boolean; message: string } | null>(null);
  const [shareFeedback, setShareFeedback] = useState<{ success: boolean; message: string } | null>(null);
  const [isPrinting, setIsPrinting] = useState(false);

  const handlePrint = async () => {
    setIsPrinting(true);
    const activeConfig = { ...printerConfig, paper_width: selectedWidth };

    if (activeConfig.connection_type === 'bluetooth') {
      const bytes =
        activeTab === 'kot'
          ? generateKotEscPos(order, activeConfig)
          : generateReceiptEscPos(order, location, activeConfig);
      const res = await printViaBluetooth(bytes);
      setPrintFeedback(res);
      setIsPrinting(false);
      setTimeout(() => setPrintFeedback(null), 3500);
      return;
    }

    // Default Browser / System Thermal Print:
    // If cash drawer is configured, kick drawer
    if (activeConfig.open_cash_drawer && order.payment_method === 'cash') {
      triggerCashDrawerKick();
    }

    setPrintFeedback({
      success: true,
      message: `Thermal print job sent to ${selectedWidth} printer.`,
    });

    window.print();
    setIsPrinting(false);
    setTimeout(() => setPrintFeedback(null), 3000);
  };

  const handleKickDrawer = () => {
    const res = triggerCashDrawerKick();
    setPrintFeedback(res);
    setTimeout(() => setPrintFeedback(null), 3000);
  };

  // Build a plain-text version of the bill for sharing (WhatsApp / clipboard).
  const buildReceiptText = (): string => {
    const lines: string[] = [];
    lines.push(`*${location.name}*`);
    lines.push(location.address);
    lines.push(`GSTIN: ${printerConfig.gstin || '29AABCT1337C1Z0'}`);
    lines.push('--------------------------------');
    lines.push(`Order #${order.order_number} (${order.order_type.replace('_', ' ')})`);
    lines.push(
      `${new Date(order.created_at).toLocaleDateString()} ${new Date(order.created_at).toLocaleTimeString(
        [],
        { hour: '2-digit', minute: '2-digit' }
      )}`
    );
    if (order.table_label) lines.push(`Table: ${order.table_label}`);
    if (order.customer_name) lines.push(`Guest: ${order.customer_name}`);
    lines.push('--------------------------------');
    order.items.forEach((i) => {
      lines.push(`${i.qty}x ${i.menu_item_name} — ₹${i.item_total.toFixed(2)}`);
    });
    lines.push('--------------------------------');
    lines.push(`Subtotal: ₹${order.subtotal.toFixed(2)}`);
    lines.push(`GST: ₹${order.tax_total.toFixed(2)}`);
    if (order.discount_total > 0) lines.push(`Discount: -₹${order.discount_total.toFixed(2)}`);
    lines.push(`*TOTAL PAID: ₹${order.grand_total.toFixed(2)}*`);
    lines.push(`Payment: ${(order.payment_method || 'paid').toUpperCase()}`);
    lines.push(printerConfig.receipt_footer || 'Thank you for visiting! ✨');
    lines.push('Powered by TSOS');
    return lines.join('\n');
  };

  const handleCopyReceipt = async () => {
    try {
      await navigator.clipboard.writeText(buildReceiptText());
      setShareFeedback({ success: true, message: 'Receipt copied to clipboard.' });
    } catch {
      setShareFeedback({ success: false, message: 'Clipboard unavailable in this browser.' });
    }
    setTimeout(() => setShareFeedback(null), 3000);
  };

  const handleShareWhatsApp = () => {
    const text = encodeURIComponent(buildReceiptText());
    const phone = order.customer_phone ? order.customer_phone.replace(/[^0-9]/g, '') : '';
    // With a guest phone on file, open the direct chat; otherwise open the
    // WhatsApp share picker so the cashier can pick the chat manually.
    const url = phone.length >= 10 ? `https://wa.me/${phone}?text=${text}` : `https://wa.me/?text=${text}`;
    window.open(url, '_blank', 'noopener,noreferrer');
    setShareFeedback({ success: true, message: 'WhatsApp opened — attach the receipt to the chat.' });
    setTimeout(() => setShareFeedback(null), 3500);
  };

  // Generate Hex dump for ESC/POS debugging
  const escPosBytes =
    activeTab === 'kot'
      ? generateKotEscPos(order, { ...printerConfig, paper_width: selectedWidth })
      : generateReceiptEscPos(order, location, { ...printerConfig, paper_width: selectedWidth });

  const hexPreview = Array.from(escPosBytes.slice(0, 160))
    .map((b) => b.toString(16).padStart(2, '0').toUpperCase())
    .join(' ');

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
      <div
        className={`max-w-lg w-full rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] ${
          isServepoint ? 'bg-white border border-[#E3E7E0]' : 'bg-white border border-[#E9E0D6]'
        }`}
      >
        {/* Top Header & Navigation */}
        <div
          className={`p-3.5 border-b flex items-center justify-between ${
            isServepoint ? 'bg-[#D9E2DD] border-[#E3E7E0]' : 'bg-[#FFF9F2] border-[#E9E0D6]'
          }`}
        >
          <div className="flex items-center gap-2">
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                isServepoint ? 'bg-white text-[#B88E2F]' : 'bg-[#17803D]/10 text-[#17803D]'
              }`}
            >
              <Printer className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className={`text-xs font-semibold ${isServepoint ? 'text-[#1A1A1A]' : 'text-[#1C1917]'}`}>
                  Order #{order.order_number} Bill & KOT
                </span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold border ${
                    isServepoint
                      ? 'bg-[#B88E2F]/15 text-[#967221] border-[#B88E2F]/30'
                      : 'bg-emerald-100 text-emerald-800 border-emerald-200'
                  }`}
                >
                  PAID
                </span>
              </div>
              <div className={`text-[10px] ${isServepoint ? 'text-[#6B6B6B]' : 'text-[#A8A29E]'}`}>
                Thermal Printer Workstation • ESC/POS Ready
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Paper Width Selector */}
            <div
              className={`flex items-center p-0.5 rounded-lg border text-[11px] font-semibold ${
                isServepoint ? 'bg-white border-[#E3E7E0]' : 'bg-white border-[#E9E0D6] font-mono'
              }`}
            >
              <button
                onClick={() => {
                  setSelectedWidth('80mm');
                  updatePrinterConfig({ paper_width: '80mm' });
                }}
                className={`px-2 py-0.5 rounded-md transition-colors ${
                  selectedWidth === '80mm'
                    ? isServepoint
                      ? 'bg-[#0F3D3E] text-white'
                      : 'bg-[#1C1917] text-white'
                    : isServepoint
                      ? 'text-[#6B6B6B] hover:bg-[#D9E2DD]/60'
                      : 'text-[#57534E] hover:bg-[#F5F0EB]'
                }`}
                title="80mm standard 3-inch desktop roll (48 characters/line)"
              >
                80mm
              </button>
              <button
                onClick={() => {
                  setSelectedWidth('58mm');
                  updatePrinterConfig({ paper_width: '58mm' });
                }}
                className={`px-2 py-0.5 rounded-md transition-colors ${
                  selectedWidth === '58mm'
                    ? isServepoint
                      ? 'bg-[#0F3D3E] text-white'
                      : 'bg-[#1C1917] text-white'
                    : isServepoint
                      ? 'text-[#6B6B6B] hover:bg-[#D9E2DD]/60'
                      : 'text-[#57534E] hover:bg-[#F5F0EB]'
                }`}
                title="58mm compact 2-inch mobile roll (32 characters/line)"
              >
                58mm
              </button>
            </div>

            <button
              onClick={onClose}
              className={`p-1.5 rounded-xl transition-colors ${
                isServepoint ? 'hover:bg-white/70 text-[#6B6B6B] hover:text-[#1A1A1A]' : 'hover:bg-[#E9E0D6] text-[#57534E]'
              }`}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* View Mode Tabs */}
        <div className={`flex border-b bg-white px-4 text-xs font-medium ${
          isServepoint ? 'border-[#E3E7E0]' : 'border-[#E9E0D6]'
        }`}>
          <button
            onClick={() => setActiveTab('bill')}
            className={`py-2 px-3 border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === 'bill'
                ? isServepoint
                  ? 'border-[#B88E2F] text-[#967221]'
                  : 'border-[#F97316] text-[#F97316]'
                : isServepoint
                  ? 'border-transparent text-[#6B6B6B] hover:text-[#1A1A1A]'
                  : 'border-transparent text-[#57534E] hover:text-[#1C1917]'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Customer Bill ({selectedWidth})</span>
          </button>
          <button
            onClick={() => setActiveTab('kot')}
            className={`py-2 px-3 border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === 'kot'
                ? isServepoint
                  ? 'border-[#B88E2F] text-[#967221]'
                  : 'border-[#F97316] text-[#F97316]'
                : isServepoint
                  ? 'border-transparent text-[#6B6B6B] hover:text-[#1A1A1A]'
                  : 'border-transparent text-[#57534E] hover:text-[#1C1917]'
            }`}
          >
            <Utensils className="w-3.5 h-3.5" />
            <span>Kitchen KOT</span>
          </button>
          <button
            onClick={() => setActiveTab('escpos')}
            className={`py-2 px-3 border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === 'escpos'
                ? isServepoint
                  ? 'border-[#B88E2F] text-[#967221]'
                  : 'border-[#F97316] text-[#F97316]'
                : isServepoint
                  ? 'border-transparent text-[#6B6B6B] hover:text-[#1A1A1A]'
                  : 'border-transparent text-[#57534E] hover:text-[#1C1917]'
            }`}
          >
            <Code className="w-3.5 h-3.5" />
            <span>Raw ESC/POS Dump</span>
          </button>
        </div>

        {/* Status / Feedback Banner */}
        {(printFeedback || shareFeedback) && (
          <div
            className={`p-2.5 px-4 text-xs flex items-center gap-2 border-b ${
              (printFeedback ?? shareFeedback)!.success
                ? isServepoint
                  ? 'bg-[#D9E2DD]/60 text-[#0F3D3E] border-[#E3E7E0]'
                  : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-rose-50 text-rose-800 border-rose-200'
            }`}
          >
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{(printFeedback ?? shareFeedback)!.message}</span>
          </div>
        )}

        {/* Modal Main Content */}
        <div className={`flex-1 overflow-y-auto p-4 flex justify-center ${
          isServepoint ? 'bg-[#F6F5F2]' : 'bg-[#F5F0EB]/50'
        }`}>
          {/* TAB 1: Customer Bill */}
          {activeTab === 'bill' && (
            <div
              id="thermal-receipt-container"
              className={`bg-white p-6 shadow-md border border-[#E9E0D6] rounded-xl font-mono text-xs text-[#1C1917] space-y-3 selection:bg-black selection:text-white transition-all ${
                selectedWidth === '58mm' ? 'w-[260px] text-[11px]' : 'w-[360px]'
              }`}
            >
              {/* Receipt Header */}
              <div className="text-center space-y-1">
                <div className="text-base font-bold tracking-wider uppercase font-display">
                  {location.name}
                </div>
                <div className="text-[11px] text-[#57534E] leading-tight">{location.address}</div>
                <div className="text-[11px] text-[#57534E]">Ph: {location.phone}</div>
                <div className="text-[10px] text-[#A8A29E] pt-1">
                  GSTIN: {printerConfig.gstin || '29AABCT1337C1Z0'}
                </div>
                {printerConfig.receipt_header && (
                  <div className="text-[10px] text-[#57534E] pt-0.5">
                    {printerConfig.receipt_header}
                  </div>
                )}
              </div>

              <div className="border-b border-dashed border-[#1C1917] my-2" />

              {/* Order Meta */}
              <div className="space-y-0.5 text-[11px]">
                <div className="flex justify-between">
                  <span className="font-bold">Order #{order.order_number}</span>
                  <span className="capitalize font-bold">{order.order_type.replace('_', ' ')}</span>
                </div>
                <div className="flex justify-between text-[#57534E]">
                  <span>Date: {new Date(order.created_at).toLocaleDateString()}</span>
                  <span>
                    {new Date(order.created_at).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                {order.table_label ? (
                  <div className="flex justify-between font-bold text-[#1C1917]">
                    <span>Table: {order.table_label}</span>
                    <span>Staff: {order.placed_by || 'Staff'}</span>
                  </div>
                ) : (
                  <div className="flex justify-between text-[#57534E]">
                    <span>Counter / Takeaway</span>
                    <span>Staff: {order.placed_by || 'Staff'}</span>
                  </div>
                )}
                {order.customer_name && (
                  <div className="text-[#57534E] pt-0.5">
                    Guest: <strong>{order.customer_name}</strong>{' '}
                    {order.customer_phone ? `(${order.customer_phone})` : ''}
                  </div>
                )}
              </div>

              <div className="border-b border-dashed border-[#1C1917] my-2" />

              {/* Items Column Header */}
              <div className="flex justify-between font-bold text-[10px] text-[#57534E] uppercase">
                <span>Item</span>
                <span className="text-right">Qty & Amt</span>
              </div>
              <div className="border-b border-dashed border-[#1C1917]/30 my-1" />

              {/* Items List */}
              <div className="space-y-1.5">
                {order.items.map((item) => (
                  <div key={item.id}>
                    <div className="flex justify-between">
                      <span className="font-semibold leading-tight">
                        {item.qty}x {item.menu_item_name}
                      </span>
                      <span className="font-bold">₹{item.item_total.toFixed(2)}</span>
                    </div>
                    {item.variant_name && (
                      <div className="text-[10px] text-[#57534E] pl-4">
                        - Size: {item.variant_name}
                      </div>
                    )}
                    {item.addons &&
                      item.addons.map((a) => (
                        <div key={a.addon_id} className="text-[10px] text-[#57534E] pl-4">
                          + {a.name} (₹{a.price})
                        </div>
                      ))}
                    {item.notes && (
                      <div className="text-[10px] italic text-[#57534E] pl-4">
                        "{item.notes}"
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="border-b border-dashed border-[#1C1917] my-2" />

              {/* Financial Totals */}
              <div className="space-y-1 text-[11px]">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>₹{order.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>GST (5%):</span>
                  <span>₹{order.tax_total.toFixed(2)}</span>
                </div>
                {order.discount_total > 0 && (
                  <div className="flex justify-between text-[#17803D] font-medium">
                    <span>Discount / Loyalty:</span>
                    <span>- ₹{order.discount_total.toFixed(2)}</span>
                  </div>
                )}
                {order.fee_payer === 'customer' && (
                  <div className="flex justify-between text-[#57534E]">
                    <span>Platform Fee:</span>
                    <span>₹{order.platform_fee.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-bold pt-1.5 border-t border-[#1C1917]">
                  <span>TOTAL PAID:</span>
                  <span>₹{order.grand_total.toFixed(2)}</span>
                </div>
              </div>

              {/* Loyalty Club Section */}
              {(order.loyalty_points_earned || order.loyalty_points_redeemed) && (
                <>
                  <div className="border-b border-dashed border-[#1C1917] my-2" />
                  <div className="text-[10px] space-y-0.5 pb-1">
                    <div className="font-bold text-center uppercase tracking-wider text-[#1C1917]">
                      TSOS Club Loyalty
                    </div>
                    {order.loyalty_points_earned ? (
                      <div className="flex justify-between text-[#17803D]">
                        <span>Points Earned (+1 pt/₹10):</span>
                        <span className="font-mono font-bold">
                          +{order.loyalty_points_earned} pts
                        </span>
                      </div>
                    ) : null}
                    {order.loyalty_points_redeemed ? (
                      <div className="flex justify-between text-[#7C3AED]">
                        <span>Points Redeemed:</span>
                        <span className="font-mono font-bold">
                          -{order.loyalty_points_redeemed} pts (₹{order.loyalty_points_redeemed})
                        </span>
                      </div>
                    ) : null}
                  </div>
                </>
              )}

              <div className="border-b border-dashed border-[#1C1917] my-2" />

              {/* Receipt Footer */}
              <div className="text-center space-y-1 text-[10px] text-[#57534E]">
                <div>
                  Payment Mode:{' '}
                  <strong className="uppercase text-[#1C1917]">
                    {order.payment_method || 'PAID'}
                  </strong>
                </div>
                <div>Cashier: {order.placed_by || 'Staff'}</div>
                <div className="pt-1.5 font-semibold text-[#1C1917]">
                  {printerConfig.receipt_footer || 'Thank you for visiting! ✨'}
                </div>
                <div className="text-[9px] text-[#A8A29E]">Powered by TSOS • tsos.dev</div>
              </div>
            </div>
          )}

          {/* TAB 2: Kitchen KOT */}
          {activeTab === 'kot' && (
            <div
              className={`bg-white p-6 shadow-md border-2 border-[#1C1917] rounded-xl font-mono text-xs text-[#1C1917] space-y-3 ${
                selectedWidth === '58mm' ? 'w-[260px]' : 'w-[360px]'
              }`}
            >
              <div className="text-center border-b-2 border-[#1C1917] pb-2">
                <div className="text-lg font-black tracking-wider uppercase">
                  *** KITCHEN TICKET ***
                </div>
                <div className="text-sm font-bold mt-1">
                  ORDER #{order.order_number} ({order.order_type.toUpperCase()})
                </div>
              </div>

              {order.table_label && (
                <div className="p-2 bg-[#1C1917] text-white text-center rounded-lg font-black text-sm uppercase">
                  TABLE: {order.table_label}
                </div>
              )}

              <div className="flex justify-between text-[11px] text-[#57534E]">
                <span>
                  Time:{' '}
                  {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                <span>Server: {order.placed_by || 'POS'}</span>
              </div>

              <div className="border-b border-dashed border-[#1C1917] my-2" />

              {/* Items List */}
              <div className="space-y-3">
                {order.items.map((item) => (
                  <div key={item.id} className="border-b border-gray-100 pb-2">
                    <div className="flex items-start justify-between text-sm font-black">
                      <span>{item.qty}x {item.menu_item_name}</span>
                    </div>
                    {item.variant_name && (
                      <div className="text-xs font-bold text-gray-700 pl-3">
                        Size: {item.variant_name}
                      </div>
                    )}
                    {item.addons &&
                      item.addons.map((a) => (
                        <div key={a.addon_id} className="text-xs font-semibold text-gray-600 pl-3">
                          + {a.name}
                        </div>
                      ))}
                    {item.notes && (
                      <div className="p-1 bg-amber-50 text-amber-900 border border-amber-200 rounded-md text-xs font-bold mt-1 pl-2">
                        &gt;&gt; NOTE: {item.notes.toUpperCase()}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="border-t-2 border-[#1C1917] pt-2 text-center text-[11px] font-bold">
                TOTAL ITEMS: {order.items.reduce((s, i) => s + i.qty, 0)}
              </div>
            </div>
          )}

          {/* TAB 3: Raw ESC/POS Stream */}
          {activeTab === 'escpos' && (
            <div className="bg-white p-5 rounded-2xl border border-[#E9E0D6] max-w-md w-full space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[#1C1917]">ESC/POS Binary Command Stream</span>
                <span className="px-2 py-0.5 bg-purple-100 text-purple-800 rounded-full font-mono text-[10px] font-bold">
                  {escPosBytes.length} bytes
                </span>
              </div>

              <p className="text-[#57534E] text-[11px]">
                Native thermal printers accept raw ESC/POS commands over USB, Network TCP socket (Port 9100), or Bluetooth SPP. The byte stream includes alignment, text bolding, double height, line feeds, cutter, and drawer kick signals.
              </p>

              <div>
                <label className="block font-bold text-[#1C1917] text-[11px] mb-1">
                  Hexadecimal Representation (First 160 Bytes):
                </label>
                <div className="p-3 bg-gray-900 text-emerald-400 font-mono text-[10px] rounded-xl overflow-x-auto leading-relaxed max-h-48">
                  {hexPreview}...
                </div>
              </div>

              <div className="p-3 bg-[#FFF9F2] rounded-xl border border-[#E9E0D6] space-y-1 text-[11px]">
                <div className="font-bold text-[#1C1917]">Supported Hardware Commands:</div>
                <div className="font-mono text-[#57534E]">
                  • <code>\x1b@</code> - Initialize printer<br />
                  • <code>\x1b!\x30</code> - Double width + height header<br />
                  • <code>\x1bp\x00\x19\xfa</code> - Cash drawer kick pulse<br />
                  • <code>\x1dV\x42\x00</code> - Full paper cut with feed
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div
          className={`p-3.5 border-t flex flex-wrap items-center justify-between gap-2 ${
            isServepoint ? 'bg-white border-[#E3E7E0]' : 'bg-[#FFF9F2] border-[#E9E0D6]'
          }`}
        >
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleKickDrawer}
              className={`px-3 py-2 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition-colors ${
                isServepoint
                  ? 'border-[#E3E7E0] bg-white hover:bg-[#D9E2DD]/60 text-[#1A1A1A]'
                  : 'border-[#E9E0D6] bg-white hover:bg-[#F5F0EB] text-[#57534E] shadow-2xs'
              }`}
              title="Send ESC/POS Cash Drawer Kick Pulse (RJ11 Pin 2)"
            >
              <DollarSign className={`w-3.5 h-3.5 ${isServepoint ? 'text-[#0F3D3E]' : 'text-[#17803D]'}`} />
              <span>Kick Drawer</span>
            </button>

            <button
              type="button"
              onClick={handleShareWhatsApp}
              className={`px-3 py-2 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition-colors ${
                isServepoint
                  ? 'border-[#B88E2F]/40 bg-[#B88E2F]/10 hover:bg-[#B88E2F]/20 text-[#967221]'
                  : 'border-[#E9E0D6] bg-white hover:bg-[#F5F0EB] text-[#57534E] shadow-2xs'
              }`}
              title="Share the bill text with the guest on WhatsApp"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>WhatsApp</span>
            </button>

            <button
              type="button"
              onClick={handleCopyReceipt}
              className={`px-3 py-2 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition-colors ${
                isServepoint
                  ? 'border-[#E3E7E0] bg-white hover:bg-[#D9E2DD]/60 text-[#1A1A1A]'
                  : 'border-[#E9E0D6] bg-white hover:bg-[#F5F0EB] text-[#57534E] shadow-2xs'
              }`}
              title="Copy the plain-text receipt to the clipboard"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Copy</span>
            </button>

            <span className={`text-[11px] hidden sm:inline ${isServepoint ? 'text-[#6B6B6B]' : 'text-[#A8A29E]'}`}>
              Mode: {printerConfig.connection_type.toUpperCase()}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              disabled={isPrinting}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white transition-colors ${
                isServepoint
                  ? 'bg-[#0F3D3E] hover:bg-[#0B3132] shadow-md shadow-[#0F3D3E]/20'
                  : 'bg-[#1C1917] hover:bg-black shadow-xs'
              }`}
            >
              <Printer className={`w-3.5 h-3.5 ${isServepoint ? 'text-[#B88E2F]' : 'text-[#F97316]'}`} />
              <span>
                {isPrinting ? 'Transmitting...' : `Print ${activeTab === 'kot' ? 'KOT' : 'Bill'} (${selectedWidth})`}
              </span>
            </button>

            {onNewSale && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onNewSale();
                }}
                className={`flex items-center gap-1 px-4 py-2 rounded-xl text-xs font-semibold text-white transition-colors ${
                  isServepoint ? 'bg-[#B88E2F] hover:bg-[#967221]' : 'bg-[#F97316] hover:bg-[#EA580C]'
                }`}
              >
                <span>Next Sale</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
