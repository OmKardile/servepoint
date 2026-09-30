import React, { useState } from 'react';
import { useTsosStore } from '../../lib/store';
import {
  Clock,
  ChefHat,
  Bell,
  CheckCircle2,
  Utensils,
  ChevronLeft,
  FileText,
  UserCheck,
  Download,
  X,
  QrCode,
  Sparkles,
  Timer,
  MessageCircle,
  Copy,
} from 'lucide-react';
import { play880HzChime } from '../../lib/sound';

export const OrderTrackingScreen: React.FC = () => {
  const { orders, trackedOrderId, setActiveSurface, location, currentTenant, themeMode } = useTsosStore();
  const isServepoint = themeMode === 'servepoint';

  const [waiterCalled, setWaiterCalled] = useState(false);
  const [showBillModal, setShowBillModal] = useState(false);
  // v2.8.1 — bill share feedback (WhatsApp / Copy), mirroring ReceiptModal
  const [shareFeedback, setShareFeedback] = useState<{ success: boolean; message: string } | null>(null);

  const trackedOrder = orders.find((o) => o.id === trackedOrderId) || orders[0];

  if (!trackedOrder) {
    if (isServepoint) {
      return (
        <div className="min-h-screen bg-[#F6F5F2] flex flex-col items-center justify-center p-4">
          <p className="text-sm text-[#6B6B6B]">No active order found.</p>
          <button
            onClick={() => setActiveSurface('storefront')}
            className="mt-3 px-4 py-2 bg-[#B88E2F] hover:bg-[#967221] text-white rounded-xl text-xs font-semibold transition-colors"
          >
            Go to Menu
          </button>
        </div>
      );
    }
    return (
      <div className="min-h-[calc(100vh-100px)] flex flex-col items-center justify-center p-4">
        <p className="text-sm text-[#57534E]">No active order found.</p>
        <button
          onClick={() => setActiveSurface('storefront')}
          className="mt-3 px-4 py-2 bg-[#F97316] text-white rounded-xl text-xs font-semibold"
        >
          Go to Menu
        </button>
      </div>
    );
  }

  const steps = [
    { key: 'new', label: 'Order Received', desc: 'Sent to the kitchen ticket line' },
    { key: 'preparing', label: 'In the Kitchen', desc: 'Brewing, cooking & plating your meal' },
    { key: 'ready', label: 'Ready to Serve', desc: 'Hot & fresh on counter or heading to table' },
    { key: 'completed', label: 'Served & Enjoyed', desc: 'Thank you for dining with us!' },
  ];

  const currentStepIndex =
    trackedOrder.status === 'cancelled'
      ? -1
      : steps.findIndex((s) => s.key === trackedOrder.status);

  const handleCallWaiter = () => {
    setWaiterCalled(true);
    play880HzChime();
    setTimeout(() => setWaiterCalled(false), 5000);
  };

  const handleDownloadInvoice = () => {
    const text = `================================================
${location.name.toUpperCase()} - TAX INVOICE
================================================
Order #${trackedOrder.order_number}
Table: ${trackedOrder.table_label || 'Self-Pickup'}
Date: ${new Date(trackedOrder.created_at).toLocaleString()}
------------------------------------------------
${trackedOrder.items.map((i) => `${i.qty}x ${i.menu_item_name} = ₹${i.item_total}`).join('\n')}
------------------------------------------------
Subtotal: ₹${trackedOrder.subtotal.toFixed(2)}
GST (5%): ₹${trackedOrder.tax_total.toFixed(2)}
Total Paid: ₹${trackedOrder.grand_total.toFixed(2)}
Payment: ${(trackedOrder.payment_method || 'UPI').toUpperCase()} (PAID)
================================================
Thank you for visiting ${location.name}!
Powered by TSOS • tsos.dev
================================================`;

    const blob = new Blob([text], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `digital-bill-order-${trackedOrder.order_number}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // ————————————————— v2.8.1 bill sharing (parity with ReceiptModal) ————————
  const buildBillText = () =>
    [
      `*${location.name}* — Bill #${trackedOrder.order_number}`,
      trackedOrder.table_label ? `Table ${trackedOrder.table_label}` : 'Counter Pickup',
      `${new Date(trackedOrder.created_at).toLocaleString()}`,
      '--------------------------------',
      ...trackedOrder.items.map((i) => `${i.qty}x ${i.menu_item_name} — ₹${i.item_total.toFixed(2)}`),
      '--------------------------------',
      `Subtotal: ₹${trackedOrder.subtotal.toFixed(2)}`,
      `GST: ₹${trackedOrder.tax_total.toFixed(2)}`,
      `*TOTAL PAID: ₹${trackedOrder.grand_total.toFixed(2)}*`,
      `Payment: ${(trackedOrder.payment_method || 'UPI').toUpperCase()}`,
      'Thank you for visiting! ✨',
      'Powered by TSOS',
    ].join('\n');

  const handleCopyBill = async () => {
    try {
      await navigator.clipboard.writeText(buildBillText());
      setShareFeedback({ success: true, message: 'Bill copied to clipboard.' });
    } catch {
      setShareFeedback({ success: false, message: 'Clipboard unavailable in this browser.' });
    }
    setTimeout(() => setShareFeedback(null), 3000);
  };

  const handleShareWhatsApp = () => {
    const text = encodeURIComponent(buildBillText());
    // With a guest phone captured on the order, open the direct chat; otherwise
    // open the WhatsApp share picker so the guest can pick the chat manually.
    const phone = trackedOrder.customer_phone ? trackedOrder.customer_phone.replace(/[^0-9]/g, '') : '';
    const url = phone.length >= 10 ? `https://wa.me/${phone}?text=${text}` : `https://wa.me/?text=${text}`;
    window.open(url, '_blank', 'noopener,noreferrer');
    setShareFeedback({ success: true, message: 'WhatsApp opened — send the bill from there.' });
    setTimeout(() => setShareFeedback(null), 3500);
  };

  const upiId = currentTenant?.upi_id || 'coolkafe@okaxis';

  // ————— v2.8.1 live ETA / progress (ServePoint guest surface) —————
  const elapsedMin = Math.max(
    0,
    Math.floor((Date.now() - new Date(trackedOrder.created_at).getTime()) / 60000)
  );
  const etaInfo: { label: string; pct: number } | null =
    trackedOrder.status === 'cancelled'
      ? null
      : trackedOrder.status === 'new'
      ? { label: 'Estimated ~12–15 min to your table', pct: 15 }
      : trackedOrder.status === 'preparing'
      ? { label: 'Estimated ~7–10 min to your table', pct: 55 }
      : trackedOrder.status === 'ready'
      ? { label: 'Ready now — enjoy!', pct: 90 }
      : { label: 'Served — thank you!', pct: 100 };

  // ————————————————————————————————————————————————————————————
  // v2.8.1 — EXPLICIT ServePoint tracking surface (13th explicit surface)
  // ————————————————————————————————————————————————————————————
  if (isServepoint) {
    const statusHero: Record<string, { ring: string; icon: React.ReactNode }> = {
      new: {
        ring: 'bg-[#D9E2DD]/70 text-[#0F3D3E]',
        icon: <Clock className="w-8 h-8 animate-spin" />,
      },
      preparing: {
        ring: 'bg-[#B88E2F]/15 text-[#B88E2F]',
        icon: <ChefHat className="w-8 h-8 animate-bounce" />,
      },
      ready: {
        ring: 'bg-[#B88E2F] text-white',
        icon: <Bell className="w-8 h-8 animate-pulse" />,
      },
      completed: {
        ring: 'bg-[#0F3D3E] text-[#F6F5F2]',
        icon: <CheckCircle2 className="w-8 h-8" />,
      },
    };
    const hero = statusHero[trackedOrder.status] || statusHero.new;

    return (
      <div className="min-h-screen bg-[#F6F5F2] flex flex-col items-center justify-start p-2 sm:p-6">
        <div className="w-full max-w-md bg-white rounded-[2rem] border border-[#E3E7E0] shadow-[0_24px_60px_-24px_rgba(15,61,62,0.18)] overflow-hidden flex flex-col p-5 space-y-4">
          {/* Top bar */}
          <div className="flex items-center justify-between border-b border-[#E3E7E0] pb-3">
            <button
              onClick={() => setActiveSurface('storefront')}
              className="flex items-center gap-1 text-xs font-semibold text-[#0F3D3E] hover:text-[#B88E2F] transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Storefront Menu</span>
            </button>

            <span className="text-xs font-bold text-[#B88E2F]">
              Order #{trackedOrder.order_number}
            </span>
          </div>

          {/* Live Status Animation */}
          <div className="text-center py-2 space-y-2">
            <div className={`w-16 h-16 rounded-full mx-auto flex items-center justify-center ${hero.ring}`}>
              {hero.icon}
            </div>

            <h2 className="text-lg font-semibold text-[#1A1A1A]">
              {trackedOrder.status === 'new' && 'Order Received & Queued!'}
              {trackedOrder.status === 'preparing' && 'In the Kitchen — Brewing & Cooking'}
              {trackedOrder.status === 'ready' && 'Ready to Serve! 🎉'}
              {trackedOrder.status === 'completed' && 'Order Served. Enjoy your meal!'}
              {trackedOrder.status === 'cancelled' && 'Order was Cancelled'}
            </h2>

            <p className="text-xs text-[#6B6B6B]">
              {trackedOrder.table_label ? `Table ${trackedOrder.table_label}` : 'Pickup Counter'} • {location.name}
            </p>
          </div>

          {/* v2.8.1 — Live ETA + progress card */}
          {etaInfo && (
            <div className="p-3 bg-[#D9E2DD]/50 border border-[#E3E7E0] rounded-2xl space-y-2">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-semibold text-[#0F3D3E] flex items-center gap-1.5">
                  <Timer className="w-3.5 h-3.5 text-[#B88E2F]" />
                  {etaInfo.label}
                </span>
                <span className="text-[#6B6B6B]">Placed {elapsedMin} min ago</span>
              </div>
              <div className="h-1.5 rounded-full bg-white overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${
                    trackedOrder.status === 'completed' ? 'bg-[#0F3D3E]' : 'bg-[#B88E2F]'
                  }`}
                  style={{ width: `${etaInfo.pct}%` }}
                />
              </div>
            </div>
          )}

          {/* Vertical Stepper Timeline with connector rail */}
          <div className="p-4 bg-[#D9E2DD]/40 rounded-2xl border border-[#E3E7E0]">
            <div className="relative">
              <div className="absolute left-[11px] top-3 bottom-3 w-0.5 bg-[#E3E7E0]" aria-hidden="true" />
              {steps.map((step, idx) => {
                const isPassed = idx <= currentStepIndex;
                const isCurrent = idx === currentStepIndex;

                return (
                  <div key={step.key} className="flex items-start gap-3 relative pb-3 last:pb-0">
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 relative z-10 transition-colors ${
                        isCurrent
                          ? 'bg-white border-2 border-[#B88E2F] text-[#B88E2F]'
                          : isPassed
                          ? 'bg-[#0F3D3E] text-[#F6F5F2]'
                          : 'bg-white border-2 border-[#E3E7E0] text-[#6B6B6B]/70'
                      }`}
                    >
                      {isPassed && !isCurrent ? '✓' : idx + 1}
                    </div>

                    <div className="flex-1">
                      <div
                        className={`text-xs font-semibold ${
                          isCurrent
                            ? 'text-[#0F3D3E]'
                            : isPassed
                            ? 'text-[#1A1A1A]'
                            : 'text-[#6B6B6B]/70'
                        }`}
                      >
                        {step.label}
                        {isCurrent && (
                          <span className="ml-2 px-1.5 py-0.5 rounded-full bg-[#B88E2F] text-white text-[9px] font-bold uppercase tracking-wide">
                            Now
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-[#6B6B6B]">{step.desc}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* One-Tap Customer Actions: Request Digital Bill & Call Waiter */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleCallWaiter}
              disabled={waiterCalled}
              className={`py-2.5 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all min-h-[44px] ${
                waiterCalled
                  ? 'bg-[#0F3D3E] text-white border-[#0F3D3E]'
                  : 'bg-[#D9E2DD]/60 hover:bg-[#D9E2DD] text-[#0F3D3E] border-[#E3E7E0]'
              }`}
            >
              <UserCheck className="w-4 h-4 text-[#B88E2F]" />
              <span>{waiterCalled ? 'Waiter Summoned ✓' : 'Call Waiter'}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowBillModal(true)}
              className="py-2.5 px-3 rounded-xl bg-[#0F3D3E] hover:bg-[#0B3132] text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-all min-h-[44px]"
            >
              <FileText className="w-4 h-4 text-[#B88E2F]" />
              <span>Digital Bill</span>
            </button>
          </div>

          {/* Waiter Summoned Toast Banner */}
          {waiterCalled && (
            <div className="p-2.5 bg-[#D9E2DD]/60 border border-[#E3E7E0] rounded-xl text-xs text-[#0F3D3E] flex items-center gap-2 animate-in fade-in">
              <Sparkles className="w-4 h-4 text-[#B88E2F] shrink-0" />
              <span>A server has been notified for {trackedOrder.table_label || 'your table'} and is on the way!</span>
            </div>
          )}

          {/* Order Items Summary */}
          <div className="border-t border-[#E3E7E0] pt-3 space-y-1.5">
            <div className="text-xs font-semibold text-[#6B6B6B]">Items Ordered:</div>
            {trackedOrder.items.map((i) => (
              <div key={i.id} className="flex justify-between text-xs">
                <span className="text-[#1A1A1A]">
                  {i.qty} × {i.menu_item_name} {i.variant_name ? `(${i.variant_name})` : ''}
                </span>
                <span className="text-[#6B6B6B]">₹{i.item_total}</span>
              </div>
            ))}

            <div className="flex justify-between text-xs font-bold pt-2 border-t border-[#E3E7E0]">
              <span className="text-[#1A1A1A]">Total Paid (PAID)</span>
              <span className="text-[#0F3D3E]">₹{trackedOrder.grand_total}</span>
            </div>
          </div>

          <button
            onClick={() => setActiveSurface('storefront')}
            className="w-full py-2.5 rounded-xl bg-[#D9E2DD]/60 hover:bg-[#D9E2DD] text-xs font-semibold text-[#0F3D3E] transition-colors"
          >
            Add More Items to Bill
          </button>
        </div>

        {/* Digital Bill Modal */}
        {showBillModal && (
          <div className="fixed inset-0 z-50 bg-[#0F3D3E]/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-sm w-full border border-[#E3E7E0] shadow-2xl p-5 space-y-4 animate-in zoom-in-95">
              <div className="flex items-center justify-between border-b border-[#E3E7E0] pb-3">
                <div className="font-semibold text-sm text-[#1A1A1A]">Digital Tax Bill</div>
                <button
                  onClick={() => setShowBillModal(false)}
                  className="p-1.5 rounded-full hover:bg-[#F6F5F2] text-[#6B6B6B]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="text-xs space-y-2 p-3 bg-[#F6F5F2] rounded-2xl border border-[#E3E7E0]">
                <div className="text-center font-semibold text-sm uppercase text-[#1A1A1A]">{location.name}</div>
                <div className="text-center text-[10px] text-[#6B6B6B]">{location.address}</div>
                <div className="border-b border-dashed border-[#1A1A1A]/40 my-2" />

                <div className="flex justify-between text-[#1A1A1A]">
                  <span>Order: #{trackedOrder.order_number}</span>
                  <span>{trackedOrder.table_label || 'Counter'}</span>
                </div>
                <div className="flex justify-between text-[#6B6B6B]">
                  <span>Date: {new Date(trackedOrder.created_at).toLocaleDateString()}</span>
                  <span>{new Date(trackedOrder.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>

                <div className="border-b border-dashed border-[#1A1A1A]/40 my-2" />

                {trackedOrder.items.map((item) => (
                  <div key={item.id} className="flex justify-between text-[#1A1A1A]">
                    <span>{item.qty}x {item.menu_item_name}</span>
                    <span>₹{item.item_total.toFixed(2)}</span>
                  </div>
                ))}

                <div className="border-b border-dashed border-[#1A1A1A]/40 my-2" />

                <div className="flex justify-between text-[#6B6B6B]">
                  <span>Subtotal:</span>
                  <span>₹{trackedOrder.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-[#6B6B6B]">
                  <span>GST (5%):</span>
                  <span>₹{trackedOrder.tax_total.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold text-sm pt-1 border-t border-[#1A1A1A]/40 text-[#1A1A1A]">
                  <span>TOTAL PAID:</span>
                  <span>₹{trackedOrder.grand_total.toFixed(2)}</span>
                </div>

                <div className="text-center pt-2 text-[10px] text-[#0F3D3E] font-bold">
                  ✓ PAYMENT COMPLETED VIA {(trackedOrder.payment_method || 'UPI').toUpperCase()}
                </div>
              </div>

              {(shareFeedback) && (
                <div
                  className={`p-2 rounded-xl text-xs flex items-center gap-1.5 ${
                    shareFeedback.success
                      ? 'bg-[#D9E2DD]/60 text-[#0F3D3E]'
                      : 'bg-[#DC2626]/10 text-[#DC2626]'
                  }`}
                >
                  {shareFeedback.success ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#B88E2F] shrink-0" />
                  ) : (
                    <X className="w-3.5 h-3.5 shrink-0" />
                  )}
                  <span>{shareFeedback.message}</span>
                </div>
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleShareWhatsApp}
                  className="flex-1 py-2 px-3 rounded-xl bg-[#B88E2F] hover:bg-[#967221] text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>WhatsApp</span>
                </button>
                <button
                  type="button"
                  onClick={handleCopyBill}
                  className="py-2 px-3 rounded-xl border border-[#E3E7E0] bg-white hover:border-[#B88E2F] text-[#0F3D3E] text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy</span>
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDownloadInvoice}
                  className="flex-1 py-2 px-3 rounded-xl bg-[#0F3D3E] hover:bg-[#0B3132] text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Download className="w-3.5 h-3.5 text-[#B88E2F]" />
                  <span>Download Bill</span>
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="py-2 px-3 rounded-xl bg-[#D9E2DD]/60 hover:bg-[#D9E2DD] text-[#0F3D3E] text-xs font-semibold transition-colors"
                >
                  Print
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-100px)] bg-[#FFF9F2] flex flex-col items-center justify-start p-2 sm:p-4">
      <div className="w-full max-w-md bg-white rounded-3xl border border-[#E9E0D6] shadow-xl overflow-hidden flex flex-col p-5 space-y-4">
        {/* Top bar */}
        <div className="flex items-center justify-between border-b border-[#F5F0EB] pb-3">
          <button
            onClick={() => setActiveSurface('storefront')}
            className="flex items-center gap-1 text-xs font-semibold text-[#57534E] hover:text-[#1C1917]"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Storefront Menu</span>
          </button>

          <span className="text-xs font-bold text-[#F97316] font-mono">
            Order #{trackedOrder.order_number}
          </span>
        </div>

        {/* Live Status Animation */}
        <div className="text-center py-2 space-y-2">
          <div className="w-16 h-16 rounded-full bg-[#FFF1E6] text-[#F97316] mx-auto flex items-center justify-center shadow-inner">
            {trackedOrder.status === 'new' && <Clock className="w-8 h-8 animate-spin" />}
            {trackedOrder.status === 'preparing' && <ChefHat className="w-8 h-8 animate-bounce" />}
            {trackedOrder.status === 'ready' && <Bell className="w-8 h-8 animate-pulse text-[#17803D]" />}
            {trackedOrder.status === 'completed' && <CheckCircle2 className="w-8 h-8 text-[#17803D]" />}
          </div>

          <h2 className="text-lg font-bold text-[#1C1917]">
            {trackedOrder.status === 'new' && 'Order Received & Queued!'}
            {trackedOrder.status === 'preparing' && 'In the Kitchen — Brewing & Cooking'}
            {trackedOrder.status === 'ready' && 'Ready to Serve! 🎉'}
            {trackedOrder.status === 'completed' && 'Order Served. Enjoy your meal!'}
            {trackedOrder.status === 'cancelled' && 'Order was Cancelled'}
          </h2>

          <p className="text-xs text-[#57534E]">
            {trackedOrder.table_label ? `Table ${trackedOrder.table_label}` : 'Pickup Counter'} • {location.name}
          </p>
        </div>

        {/* Vertical Stepper Timeline */}
        <div className="p-4 bg-[#FFF9F2] rounded-2xl border border-[#E9E0D6] space-y-3">
          {steps.map((step, idx) => {
            const isPassed = idx <= currentStepIndex;
            const isCurrent = idx === currentStepIndex;

            return (
              <div key={step.key} className="flex items-start gap-3 relative">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${
                    isPassed
                      ? 'bg-[#17803D] text-white'
                      : 'bg-white border-2 border-[#E9E0D6] text-[#A8A29E]'
                  }`}
                >
                  {isPassed ? '✓' : idx + 1}
                </div>

                <div className="flex-1">
                  <div
                    className={`text-xs font-bold ${
                      isCurrent
                        ? 'text-[#F97316]'
                        : isPassed
                        ? 'text-[#1C1917]'
                        : 'text-[#A8A29E]'
                    }`}
                  >
                    {step.label}
                  </div>
                  <div className="text-[11px] text-[#57534E]">{step.desc}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* One-Tap Customer Actions: Request Digital Bill & Call Waiter */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={handleCallWaiter}
            disabled={waiterCalled}
            className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-xs min-h-[44px] ${
              waiterCalled
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                : 'bg-white hover:bg-[#F5F0EB] text-[#1C1917] border-[#E9E0D6]'
            }`}
          >
            <UserCheck className="w-4 h-4 text-[#F97316]" />
            <span>{waiterCalled ? 'Waiter Summoned ✓' : 'Call Waiter'}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowBillModal(true)}
            className="py-2.5 px-3 rounded-xl bg-white hover:bg-[#F5F0EB] border border-[#E9E0D6] text-[#1C1917] text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-xs min-h-[44px]"
          >
            <FileText className="w-4 h-4 text-[#7C3AED]" />
            <span>Digital Bill</span>
          </button>
        </div>

        {/* Waiter Summoned Toast Banner */}
        {waiterCalled && (
          <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2 animate-in fade-in">
            <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>A server has been notified for {trackedOrder.table_label || 'your table'} and is on the way!</span>
          </div>
        )}

        {/* Order Items Summary */}
        <div className="border-t border-[#F5F0EB] pt-3 space-y-1.5">
          <div className="text-xs font-semibold text-[#57534E]">Items Ordered:</div>
          {trackedOrder.items.map((i) => (
            <div key={i.id} className="flex justify-between text-xs">
              <span className="text-[#1C1917]">
                {i.qty} × {i.menu_item_name} {i.variant_name ? `(${i.variant_name})` : ''}
              </span>
              <span className="font-mono text-[#57534E]">₹{i.item_total}</span>
            </div>
          ))}

          <div className="flex justify-between text-xs font-bold pt-2 border-t border-[#F5F0EB]">
            <span>Total Paid (PAID)</span>
            <span className="font-mono text-[#17803D]">₹{trackedOrder.grand_total}</span>
          </div>
        </div>

        <button
          onClick={() => setActiveSurface('storefront')}
          className="w-full py-2.5 rounded-xl bg-[#F5F0EB] hover:bg-[#E9E0D6] text-xs font-semibold text-[#1C1917] transition-colors"
        >
          Add More Items to Bill
        </button>
      </div>

      {/* Digital Bill Modal */}
      {showBillModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full border border-[#E9E0D6] shadow-2xl p-5 space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-[#E9E0D6] pb-3">
              <div className="font-bold text-sm text-[#1C1917]">Digital Tax Bill</div>
              <button
                onClick={() => setShowBillModal(false)}
                className="p-1.5 rounded-full hover:bg-[#F5F0EB] text-[#57534E]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="font-mono text-xs space-y-2 p-3 bg-[#FFF9F2] rounded-2xl border border-[#E9E0D6]">
              <div className="text-center font-bold text-sm uppercase">{location.name}</div>
              <div className="text-center text-[10px] text-[#57534E]">{location.address}</div>
              <div className="border-b border-dashed border-[#1C1917] my-2" />

              <div className="flex justify-between">
                <span>Order: #{trackedOrder.order_number}</span>
                <span>{trackedOrder.table_label || 'Counter'}</span>
              </div>
              <div className="flex justify-between text-[#57534E]">
                <span>Date: {new Date(trackedOrder.created_at).toLocaleDateString()}</span>
                <span>{new Date(trackedOrder.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>

              <div className="border-b border-dashed border-[#1C1917] my-2" />

              {trackedOrder.items.map((item) => (
                <div key={item.id} className="flex justify-between">
                  <span>{item.qty}x {item.menu_item_name}</span>
                  <span>₹{item.item_total.toFixed(2)}</span>
                </div>
              ))}

              <div className="border-b border-dashed border-[#1C1917] my-2" />

              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>₹{trackedOrder.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>GST (5%):</span>
                <span>₹{trackedOrder.tax_total.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-sm pt-1 border-t border-[#1C1917]">
                <span>TOTAL PAID:</span>
                <span>₹{trackedOrder.grand_total.toFixed(2)}</span>
              </div>

              <div className="text-center pt-2 text-[10px] text-emerald-800 font-bold">
                ✓ PAYMENT COMPLETED VIA {(trackedOrder.payment_method || 'UPI').toUpperCase()}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDownloadInvoice}
                className="flex-1 py-2 px-3 rounded-xl bg-[#1C1917] hover:bg-black text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Bill</span>
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="py-2 px-3 rounded-xl bg-[#F5F0EB] hover:bg-[#E9E0D6] text-[#1C1917] text-xs font-semibold transition-colors"
              >
                Print
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
