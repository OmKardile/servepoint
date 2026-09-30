import React, { useState, useEffect } from 'react';
import { PaymentMethod, Order } from '../../types';
import { useTsosStore } from '../../lib/store';
import { playChime } from '../../lib/sound';
import { X, QrCode, Banknote, CreditCard, CheckCircle2, Copy, Users, Check, Sparkles } from 'lucide-react';
import confetti from 'canvas-confetti';

interface PaymentModalProps {
  grandTotal: number;
  subtotal: number;
  taxTotal: number;
  discountTotal: number;
  platformFee: number;
  feePayer: 'cafe' | 'customer';
  onClose: () => void;
  onSuccess: (order: Order) => void;
}

interface SplitDiner {
  dinerNumber: number;
  amount: number;
  paid: boolean;
  method?: 'cash' | 'upi' | 'card';
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  grandTotal,
  subtotal,
  taxTotal,
  discountTotal,
  platformFee,
  feePayer,
  onClose,
  onSuccess,
}) => {
  const { createOrder, audioEnabled, location, currentTenant, redeemedPoints, selectedCustomerId, customers, themeMode } = useTsosStore();
  const isTessera = themeMode === 'tessera';
  const isServepoint = themeMode === 'servepoint';
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | 'split'>('upi');
  const [cashTendered, setCashTendered] = useState<number>(Math.ceil(grandTotal / 50) * 50 || 100);
  const [isProcessing, setIsProcessing] = useState(false);
  const [copiedUpi, setCopiedUpi] = useState(false);

  // Split bill states
  const [splitCount, setSplitCount] = useState<number>(2);
  const [splitDiners, setSplitDiners] = useState<SplitDiner[]>([
    { dinerNumber: 1, amount: Math.ceil(grandTotal / 2), paid: false },
    { dinerNumber: 2, amount: grandTotal - Math.ceil(grandTotal / 2), paid: false },
  ]);

  const updateSplitCount = (count: number) => {
    setSplitCount(count);
    const baseAmount = Math.floor(grandTotal / count);
    const remainder = +(grandTotal - baseAmount * count).toFixed(2);

    const newDiners: SplitDiner[] = Array.from({ length: count }, (_, i) => ({
      dinerNumber: i + 1,
      amount: i === 0 ? baseAmount + remainder : baseAmount,
      paid: false,
    }));
    setSplitDiners(newDiners);
  };

  const markDinerPaid = (dinerNumber: number, method: 'cash' | 'upi' | 'card') => {
    setSplitDiners((prev) =>
      prev.map((d) => (d.dinerNumber === dinerNumber ? { ...d, paid: true, method } : d))
    );
  };

  const allSplitDinersPaid = splitDiners.every((d) => d.paid);
  const totalSplitPaid = splitDiners.filter((d) => d.paid).reduce((sum, d) => sum + d.amount, 0);

  // Keyboard accessibility: Escape closes the modal (unless a payment is mid-flight).
  // This matches the behaviour of native dialogs and the X / "Back to Cart" buttons.
  useEffect(() => {
    if (isProcessing) return; // never abort a payment in progress
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isProcessing, onClose]);

  const attachedCustomer = customers.find((c) => c.id === selectedCustomerId);
  const pointsToEarn = Math.floor(subtotal / 10);

  const upiId = currentTenant?.upi_id || location.phone ? `${currentTenant?.slug || 'coolkafe'}@okaxis` : 'coolkafe@okaxis';
  const cashChange = Math.max(0, cashTendered - grandTotal);

  const handleConfirmPayment = () => {
    setIsProcessing(true);

    setTimeout(() => {
      const finalMethod: PaymentMethod = selectedMethod === 'split' ? 'split' : selectedMethod;
      const newOrder = createOrder({
        paymentMethod: finalMethod,
        customerNotes: selectedMethod === 'split' 
          ? `Split bill: ${splitCount} diners (${splitDiners.map((d) => `Diner ${d.dinerNumber}: ₹${d.amount} via ${d.method || 'cash'}`).join(', ')})`
          : undefined,
      });

      if (audioEnabled) {
        playChime('new_order');
      }

      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.7 },
        colors: isTessera
          ? ['#C5F82A', '#34D399', '#F5F4EE']
          : isServepoint
          ? ['#B88E2F', '#0F3D3E', '#D9E2DD']
          : ['#F97316', '#17803D', '#7C3AED'],
      });

      setIsProcessing(false);
      onSuccess(newOrder);
    }, 400);
  };

  return (
    <div
      className={`fixed inset-0 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150 ${
        isTessera ? 'bg-black/65' : 'bg-black/50'
      }`}
      onClick={(e) => {
        // Click on the backdrop (not inside the modal) closes the modal — matches
        // the Escape / X / "Back to Cart" affordances for fast cashier flow.
        if (e.target === e.currentTarget && !isProcessing) onClose();
      }}
    >
      <div className={`rounded-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[92vh] ${
        isTessera
          ? 'bg-[#0F1D17] border border-[#2A4A37] tessera-block'
          : isServepoint
          ? 'bg-white border border-[#E3E7E0] shadow-[0_8px_30px_rgba(15,61,62,0.08)]'
          : 'bg-white border border-[#E9E0D6] shadow-2xl'
      }`}>
        {/* Header */}
        <div className={`p-4 border-b flex items-center justify-between ${
          isTessera
            ? 'bg-[#0A1410] border-[#1F3D2E]'
            : isServepoint
            ? 'bg-[#D9E2DD] border-[#E3E7E0]'
            : 'bg-[#FFF9F2] border-[#E9E0D6]'
        }`}>
          <div>
            <div className={`text-xs uppercase tracking-widest ${
              isTessera ? 'text-[#6B8579]' : isServepoint ? 'text-[#6B6B6B]' : 'text-[#57534E]'
            }`}>
              Complete Sale Tender
            </div>
            <div className={`text-xl tabular-nums ${
              isTessera
                ? 'font-bold font-mono text-[#C5F82A]'
                : isServepoint
                ? 'font-semibold text-[#1A1A1A]'
                : 'font-bold font-mono text-[#1C1917]'
            }`}>
              Amount to Collect: <span className={isServepoint ? 'text-[#967221]' : undefined}>₹{grandTotal.toFixed(2)}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close payment dialog"
            className={`p-1.5 rounded-full transition-colors ${
              isTessera
                ? 'hover:bg-[#142620] text-[#9BB5A5] hover:text-[#C5F82A]'
                : isServepoint
                ? 'hover:bg-white text-[#6B6B6B] hover:text-[#DC2626]'
                : 'hover:bg-[#E9E0D6] text-[#57534E]'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {/* Payment Method Selector (4 Options) */}
          <div className="grid grid-cols-4 gap-2">
            <button
              type="button"
              onClick={() => setSelectedMethod('upi')}
              className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all ${
                selectedMethod === 'upi'
                  ? isTessera
                    ? 'border-[#C5F82A]/60 bg-[#C5F82A]/12 text-[#C5F82A] ring-1 ring-[#C5F82A]/40'
                    : isServepoint
                    ? 'border-[#B88E2F] bg-[#B88E2F]/10 text-[#967221] ring-1 ring-[#B88E2F]/40'
                    : 'border-[#F97316] bg-[#FFF1E6] text-[#F97316] ring-1 ring-[#F97316]'
                  : isTessera
                  ? 'border-[#2A4A37] hover:bg-[#142620] text-[#9BB5A5]'
                  : isServepoint
                  ? 'border-[#E3E7E0] hover:border-[#B88E2F]/50 hover:bg-[#F6F5F2] text-[#1A1A1A]'
                  : 'border-[#E9E0D6] hover:bg-[#F5F0EB] text-[#57534E]'
              }`}
            >
              <QrCode className="w-5 h-5" />
              <span className="text-[11px] font-semibold">UPI QR</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedMethod('cash')}
              className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all ${
                selectedMethod === 'cash'
                  ? isTessera
                    ? 'border-[#34D399]/60 bg-[#34D399]/12 text-[#34D399] ring-1 ring-[#34D399]/40'
                    : isServepoint
                    ? 'border-[#B88E2F] bg-[#B88E2F]/10 text-[#967221] ring-1 ring-[#B88E2F]/40'
                    : 'border-[#17803D] bg-[#E8F5EC] text-[#17803D] ring-1 ring-[#17803D]'
                  : isTessera
                  ? 'border-[#2A4A37] hover:bg-[#142620] text-[#9BB5A5]'
                  : isServepoint
                  ? 'border-[#E3E7E0] hover:border-[#B88E2F]/50 hover:bg-[#F6F5F2] text-[#1A1A1A]'
                  : 'border-[#E9E0D6] hover:bg-[#F5F0EB] text-[#57534E]'
              }`}
            >
              <Banknote className="w-5 h-5" />
              <span className="text-[11px] font-semibold">Cash</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedMethod('card')}
              className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all ${
                selectedMethod === 'card'
                  ? isTessera
                    ? 'border-[#60A5FA]/60 bg-[#60A5FA]/12 text-[#60A5FA] ring-1 ring-[#60A5FA]/40'
                    : isServepoint
                    ? 'border-[#B88E2F] bg-[#B88E2F]/10 text-[#967221] ring-1 ring-[#B88E2F]/40'
                    : 'border-[#2563EB] bg-[#EFF6FF] text-[#2563EB] ring-1 ring-[#2563EB]'
                  : isTessera
                  ? 'border-[#2A4A37] hover:bg-[#142620] text-[#9BB5A5]'
                  : isServepoint
                  ? 'border-[#E3E7E0] hover:border-[#B88E2F]/50 hover:bg-[#F6F5F2] text-[#1A1A1A]'
                  : 'border-[#E9E0D6] hover:bg-[#F5F0EB] text-[#57534E]'
              }`}
            >
              <CreditCard className="w-5 h-5" />
              <span className="text-[11px] font-semibold">Card</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedMethod('split')}
              className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all ${
                selectedMethod === 'split'
                  ? isTessera
                    ? 'border-[#C084FC]/60 bg-[#C084FC]/12 text-[#C084FC] ring-1 ring-[#C084FC]/40'
                    : isServepoint
                    ? 'border-[#B88E2F] bg-[#B88E2F]/10 text-[#967221] ring-1 ring-[#B88E2F]/40'
                    : 'border-[#7C3AED] bg-[#F5F3FF] text-[#7C3AED] ring-1 ring-[#7C3AED]'
                  : isTessera
                  ? 'border-[#2A4A37] hover:bg-[#142620] text-[#9BB5A5]'
                  : isServepoint
                  ? 'border-[#E3E7E0] hover:border-[#B88E2F]/50 hover:bg-[#F6F5F2] text-[#1A1A1A]'
                  : 'border-[#E9E0D6] hover:bg-[#F5F0EB] text-[#57534E]'
              }`}
            >
              <Users className="w-5 h-5" />
              <span className="text-[11px] font-semibold">Split Bill</span>
            </button>
          </div>

          {/* UPI View */}
          {selectedMethod === 'upi' && (
            <div className={`p-4 rounded-xl border flex flex-col items-center text-center space-y-3 ${
              isTessera
                ? 'bg-[#0A1410] border-[#1F3D2E]'
                : isServepoint
                ? 'bg-[#D9E2DD] border-[#E3E7E0]'
                : 'bg-[#FFF9F2] border-[#E9E0D6]'
            }`}>
              <div className={`p-3 rounded-xl border shadow-xs ${
                isTessera ? 'bg-white border-[#2A4A37]' : isServepoint ? 'bg-white border-[#E3E7E0]' : 'bg-white border-[#E9E0D6]'
              }`}>
                {/* Visual BharatQR simulation with dynamic amount — kept light for scan reliability */}
                <div className="w-40 h-40 bg-white flex flex-col items-center justify-center border-2 border-dashed border-[#1C1917] p-2 rounded-lg relative">
                  <div className="absolute top-2 left-2 w-5 h-5 border-2 border-[#1C1917] bg-white flex items-center justify-center">
                    <div className="w-2 h-2 bg-[#1C1917]" />
                  </div>
                  <div className="absolute top-2 right-2 w-5 h-5 border-2 border-[#1C1917] bg-white flex items-center justify-center">
                    <div className="w-2 h-2 bg-[#1C1917]" />
                  </div>
                  <div className="absolute bottom-2 left-2 w-5 h-5 border-2 border-[#1C1917] bg-white flex items-center justify-center">
                    <div className="w-2 h-2 bg-[#1C1917]" />
                  </div>
                  <div className="text-center">
                    <QrCode className="w-14 h-14 text-[#1C1917] mx-auto opacity-90" />
                    <div className="text-[11px] font-mono font-bold text-[#1C1917] mt-1 tabular-nums">
                      ₹{grandTotal.toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <div className={`text-xs font-semibold ${isTessera ? 'text-[#F5F4EE]' : 'text-[#1C1917]'}`}>
                  Scan with Google Pay, PhonePe, Paytm, or BHIM
                </div>
                <div className={`flex items-center justify-center gap-1.5 text-xs font-mono ${
                  isTessera ? 'text-[#9BB5A5]' : isServepoint ? 'text-[#6B6B6B]' : 'text-[#57534E]'
                }`}>
                  <span>VPA: {upiId}</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(upiId);
                      setCopiedUpi(true);
                      setTimeout(() => setCopiedUpi(false), 2000);
                    }}
                    aria-label="Copy UPI VPA"
                    className={`transition-colors ${isTessera ? 'hover:text-[#C5F82A]' : isServepoint ? 'hover:text-[#967221]' : 'hover:text-[#1C1917]'}`}
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  {copiedUpi && (
                    <span className={`text-[10px] font-bold ${isTessera ? 'text-[#34D399]' : isServepoint ? 'text-[#0F3D3E]' : 'text-[#17803D]'}`}>
                      Copied!
                    </span>
                  )}
                </div>
              </div>

              {/* Instant App Simulation button */}
              <button
                type="button"
                onClick={handleConfirmPayment}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                  isTessera
                    ? 'bg-[#34D399]/10 hover:bg-[#34D399]/20 text-[#34D399] border-[#34D399]/40'
                    : isServepoint
                    ? 'bg-white text-[#1A1A1A] border-[#E3E7E0] hover:border-[#B88E2F] hover:text-[#967221]'
                    : 'bg-[#E8F5EC] hover:bg-[#DCFCE7] text-[#166534] border-[#BBF7D0]'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                Simulate UPI App Confirmation
              </button>
            </div>
          )}

          {/* Cash View */}
          {selectedMethod === 'cash' && (
            <div className={`p-4 rounded-xl border space-y-3 ${
              isTessera
                ? 'bg-[#0A1410] border-[#1F3D2E]'
                : isServepoint
                ? 'bg-[#F6F5F2] border-[#E3E7E0]'
                : 'bg-[#F5F0EB] border-[#E9E0D6]'
            }`}>
              <div>
                <label className={`block text-xs font-semibold uppercase tracking-wider mb-1.5 ${
                  isTessera ? 'text-[#6B8579]' : isServepoint ? 'text-[#6B6B6B]' : 'text-[#57534E]'
                }`}>
                  Cash Tendered (₹)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={cashTendered}
                    onChange={(e) => setCashTendered(Number(e.target.value) || 0)}
                    className={`w-full px-3 py-2 text-lg font-bold font-mono tabular-nums rounded-xl border focus:outline-none ${
                      isTessera
                        ? 'border-[#2A4A37] bg-[#0F1D17] text-[#F5F4EE] focus:border-[#C5F82A]'
                        : isServepoint
                        ? 'border-[#E3E7E0] bg-white text-[#1A1A1A] focus:border-[#B88E2F] focus:ring-2 focus:ring-[#B88E2F]/25'
                        : 'border-[#E9E0D6] bg-white text-[#1C1917]'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setCashTendered(grandTotal)}
                    className={`px-3 py-2 text-xs font-semibold rounded-xl border transition-colors ${
                      isTessera
                        ? 'tessera-ghost rounded-lg'
                        : isServepoint
                        ? 'bg-[#0F3D3E] text-white border-[#0F3D3E] hover:bg-[#0B3132]'
                        : 'bg-white border-[#E9E0D6] hover:bg-[#E9E0D6]'
                    }`}
                  >
                    Exact
                  </button>
                </div>
              </div>

              {/* Denomination Buttons */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {[100, 200, 500, 2000].map((note) => (
                  <button
                    key={note}
                    type="button"
                    onClick={() => setCashTendered(note)}
                    className={`px-3 py-1.5 text-xs rounded-lg border transition-colors tabular-nums ${
                      isTessera
                        ? 'font-mono font-bold bg-[#0F1D17] border-[#2A4A37] text-[#F5F4EE] hover:border-[#34D399]/60 hover:text-[#34D399]'
                        : isServepoint
                        ? 'font-semibold bg-white border-[#E3E7E0] text-[#1A1A1A] hover:border-[#B88E2F] hover:bg-[#B88E2F]/10'
                        : 'font-mono font-bold bg-white border-[#E9E0D6] hover:border-[#17803D] hover:bg-[#E8F5EC] text-[#1C1917]'
                    }`}
                  >
                    ₹{note}
                  </button>
                ))}
              </div>

              <div className={`p-3 rounded-xl border flex items-center justify-between ${
                isTessera ? 'bg-[#0F1D17] border-[#2A4A37]' : isServepoint ? 'bg-white border-[#E3E7E0]' : 'bg-white border-[#E9E0D6]'
              }`}>
                <span className={`text-xs font-semibold ${isTessera ? 'text-[#9BB5A5]' : isServepoint ? 'text-[#6B6B6B]' : 'text-[#57534E]'}`}>
                  Change Due to Return
                </span>
                <span
                  className={`text-xl font-bold font-mono tabular-nums ${
                    cashTendered >= grandTotal
                      ? isTessera ? 'text-[#34D399]' : isServepoint ? 'text-[#0F3D3E]' : 'text-[#17803D]'
                      : isTessera ? 'text-[#F87171]' : isServepoint ? 'text-[#DC2626]' : 'text-[#B42318]'
                  }`}
                >
                  ₹{cashChange.toFixed(2)}
                </span>
              </div>
            </div>
          )}

          {/* Card View */}
          {selectedMethod === 'card' && (
            <div className={`p-4 rounded-xl border text-center space-y-2 ${
              isTessera
                ? 'bg-[#60A5FA]/8 border-[#60A5FA]/30'
                : isServepoint
                ? 'bg-[#D9E2DD] border-[#E3E7E0]'
                : 'bg-[#EFF6FF] border-[#BFDBFE]'
            }`}>
              <CreditCard className={`w-8 h-8 mx-auto ${isTessera ? 'text-[#60A5FA]' : isServepoint ? 'text-[#0F3D3E]' : 'text-[#2563EB]'}`} />
              <div className={`text-sm font-semibold ${isTessera ? 'text-[#F5F4EE]' : isServepoint ? 'text-[#1A1A1A]' : 'text-[#1C1917]'}`}>
                Card Swipe / Tap EDC Terminal
              </div>
              <div className={`text-xs ${isTessera ? 'text-[#9BB5A5]' : isServepoint ? 'text-[#6B6B6B]' : 'text-[#57534E]'}`}>
                Please tap or insert customer card on the Pine Labs / Paytm POS terminal.
              </div>
            </div>
          )}

          {/* Split Bill View */}
          {selectedMethod === 'split' && (
            <div className={`p-4 rounded-xl border space-y-3 ${
              isTessera
                ? 'bg-[#C084FC]/8 border-[#C084FC]/30'
                : isServepoint
                ? 'bg-[#D9E2DD] border-[#E3E7E0]'
                : 'bg-[#F5F3FF] border-[#DDD6FE]'
            }`}>
              <div className="flex items-center justify-between">
                <span className={`text-xs font-bold ${isTessera ? 'text-[#C084FC]' : isServepoint ? 'text-[#1A1A1A]' : 'text-[#5B21B6]'}`}>
                  Number of Diners:
                </span>
                <div className="flex items-center gap-1">
                  {[2, 3, 4, 5, 6].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => updateSplitCount(n)}
                      className={`w-7 h-7 rounded-lg text-xs font-bold transition-all tabular-nums ${
                        splitCount === n
                          ? isTessera
                            ? 'bg-[#C084FC] text-[#0A1410]'
                            : isServepoint
                            ? 'bg-[#B88E2F] text-white'
                            : 'bg-[#7C3AED] text-white shadow-2xs'
                          : isTessera
                          ? 'bg-[#0F1D17] border border-[#2A4A37] text-[#C084FC] hover:bg-[#142620]'
                          : isServepoint
                          ? 'bg-white border border-[#E3E7E0] text-[#6B6B6B] hover:border-[#B88E2F] hover:text-[#967221]'
                          : 'bg-white border border-[#DDD6FE] text-[#5B21B6] hover:bg-[#EDE9FE]'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                {splitDiners.map((diner) => (
                  <div
                    key={diner.dinerNumber}
                    className={`p-2.5 rounded-lg border flex items-center justify-between text-xs transition-all ${
                      diner.paid
                        ? isTessera
                          ? 'bg-[#34D399]/12 border-[#34D399]/40 text-[#34D399]'
                          : isServepoint
                          ? 'bg-[#0F3D3E]/10 border-[#0F3D3E]/30 text-[#0F3D3E]'
                          : 'bg-[#DCFCE7] border-[#86EFAC] text-[#166534]'
                        : isTessera
                        ? 'bg-[#0F1D17] border-[#2A4A37] text-[#F5F4EE]'
                        : isServepoint
                        ? 'bg-white border-[#E3E7E0] text-[#1A1A1A]'
                        : 'bg-white border-[#E9E0D6] text-[#1C1917]'
                    }`}
                  >
                    <div>
                      <span className="font-bold">Diner {diner.dinerNumber}:</span>{' '}
                      <span className="font-mono font-bold tabular-nums">₹{diner.amount.toFixed(2)}</span>
                      {diner.paid && (
                        <span className={`ml-2 text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${
                          isTessera ? 'bg-[#0A1410] text-[#34D399] border border-[#34D399]/40' : isServepoint ? 'bg-white text-[#0F3D3E]' : 'bg-white text-[#166534]'
                        }`}>
                          Paid via {diner.method}
                        </span>
                      )}
                    </div>

                    {!diner.paid ? (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => markDinerPaid(diner.dinerNumber, 'upi')}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors ${
                            isTessera
                              ? 'bg-[#C5F82A]/12 hover:bg-[#C5F82A]/25 text-[#C5F82A] border-[#C5F82A]/40'
                              : isServepoint
                              ? 'bg-white hover:border-[#B88E2F] hover:bg-[#B88E2F]/10 text-[#6B6B6B] hover:text-[#967221] border-[#E3E7E0]'
                              : 'bg-[#FFF1E6] hover:bg-[#FDE2CF] text-[#EA580C] border-[#FDBA74]'
                          }`}
                        >
                          UPI
                        </button>
                        <button
                          type="button"
                          onClick={() => markDinerPaid(diner.dinerNumber, 'cash')}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors ${
                            isTessera
                              ? 'bg-[#34D399]/12 hover:bg-[#34D399]/25 text-[#34D399] border-[#34D399]/40'
                              : isServepoint
                              ? 'bg-white hover:border-[#B88E2F] hover:bg-[#B88E2F]/10 text-[#6B6B6B] hover:text-[#967221] border-[#E3E7E0]'
                              : 'bg-[#E8F5EC] hover:bg-[#DCFCE7] text-[#166534] border-[#BBF7D0]'
                          }`}
                        >
                          Cash
                        </button>
                        <button
                          type="button"
                          onClick={() => markDinerPaid(diner.dinerNumber, 'card')}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors ${
                            isTessera
                              ? 'bg-[#60A5FA]/12 hover:bg-[#60A5FA]/25 text-[#60A5FA] border-[#60A5FA]/40'
                              : isServepoint
                              ? 'bg-white hover:border-[#B88E2F] hover:bg-[#B88E2F]/10 text-[#6B6B6B] hover:text-[#967221] border-[#E3E7E0]'
                              : 'bg-[#EFF6FF] hover:bg-[#DBEAFE] text-[#1D4ED8] border-[#BFDBFE]'
                          }`}
                        >
                          Card
                        </button>
                      </div>
                    ) : (
                      <Check className="w-4 h-4" />
                    )}
                  </div>
                ))}
              </div>

              <div className={`flex items-center justify-between text-xs pt-1 font-semibold ${
                isTessera ? 'text-[#C084FC]' : isServepoint ? 'text-[#6B6B6B]' : 'text-[#5B21B6]'
              }`}>
                <span className="tabular-nums">Collected: ₹{totalSplitPaid.toFixed(2)} / ₹{grandTotal.toFixed(2)}</span>
                <span className={`tabular-nums ${
                  allSplitDinersPaid
                    ? isTessera ? 'text-[#34D399]' : isServepoint ? 'text-[#0F3D3E]' : 'text-[#166534]'
                    : isTessera ? 'text-[#FBBF24]' : isServepoint ? 'text-[#967221]' : 'text-[#B45309]'
                }`}>
                  {allSplitDinersPaid ? 'All Diners Paid!' : `₹${(grandTotal - totalSplitPaid).toFixed(2)} Remaining`}
                </span>
              </div>
            </div>
          )}

          {/* Bill Summary Breakdown */}
          <div className={`text-xs space-y-1.5 pt-2 border-t ${
            isTessera
              ? 'border-[#1F3D2E] text-[#9BB5A5]'
              : isServepoint
              ? 'border-[#E3E7E0] text-[#6B6B6B]'
              : 'border-[#E9E0D6] text-[#57534E]'
          }`}>
            <div className="flex justify-between">
              <span>Items Subtotal</span>
              <span className={isServepoint ? 'font-semibold text-[#1A1A1A] tabular-nums' : 'font-mono tabular-nums'}>₹{subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>GST (5%)</span>
              <span className={isServepoint ? 'font-semibold text-[#1A1A1A] tabular-nums' : 'font-mono tabular-nums'}>₹{taxTotal.toFixed(2)}</span>
            </div>
            {discountTotal > 0 && (
              <div className={`flex justify-between ${isTessera ? 'text-[#34D399]' : isServepoint ? 'text-[#967221]' : 'text-[#17803D]'}`}>
                <span>
                  Discount / Offer {redeemedPoints > 0 ? `(incl. ${redeemedPoints} pts)` : ''}
                </span>
                <span className={`tabular-nums ${isServepoint ? 'font-semibold' : 'font-mono'}`}>- ₹{discountTotal.toFixed(2)}</span>
              </div>
            )}
            {attachedCustomer && pointsToEarn > 0 && (
              <div className={`flex justify-between px-2 py-1 rounded-lg ${
                isTessera ? 'text-[#C084FC] bg-[#C084FC]/10' : isServepoint ? 'text-[#967221] bg-[#B88E2F]/10' : 'text-[#7C3AED] bg-[#F5F3FF]'
              }`}>
                <span className="font-medium">Loyalty Reward ({attachedCustomer.name})</span>
                <span className={`font-bold tabular-nums ${isServepoint ? 'font-semibold' : 'font-mono'}`}>+{pointsToEarn} pts to earn</span>
              </div>
            )}
            <div className="flex justify-between items-center text-xs">
              <span className="flex items-center gap-1">
                Platform Fee:
                <span className={`text-[10px] font-semibold px-1.5 py-0.2 rounded-full ${
                  isTessera
                    ? 'bg-[#C5F82A]/10 text-[#C5F82A] border border-[#C5F82A]/30'
                    : isServepoint
                    ? 'bg-[#B88E2F]/15 text-[#967221] border border-[#B88E2F]/30'
                    : 'bg-[#FFF1E6] text-[#F97316]'
                }`}>
                  {feePayer === 'cafe' ? 'Absorbed by Cafe' : 'Paid by Customer'}
                </span>
              </span>
              <span className="font-mono tabular-nums">
                {feePayer === 'customer' ? `+ ₹${platformFee}` : '₹0.00'}
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className={`p-4 border-t flex items-center justify-between ${
          isTessera
            ? 'bg-[#0A1410] border-[#1F3D2E]'
            : isServepoint
            ? 'bg-white border-[#E3E7E0]'
            : 'bg-[#FFF9F2] border-[#E9E0D6]'
        }`}>
          <button
            type="button"
            onClick={onClose}
            className={`px-4 py-2.5 text-sm font-medium transition-colors ${
              isTessera
                ? 'text-[#9BB5A5] hover:text-[#F5F4EE]'
                : isServepoint
                ? 'text-[#6B6B6B] hover:text-[#1A1A1A]'
                : 'text-[#57534E] hover:text-[#1C1917]'
            }`}
          >
            Back to Cart
          </button>
          <button
            type="button"
            disabled={isProcessing || (selectedMethod === 'cash' && cashTendered < grandTotal)}
            onClick={handleConfirmPayment}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              isTessera
                ? 'tessera-cta rounded-lg disabled:hover:transform-none disabled:hover:shadow-none'
                : isServepoint
                ? 'bg-[#0F3D3E] hover:bg-[#0B3132] text-white shadow-[0_4px_14px_rgba(15,61,62,0.25)]'
                : 'bg-[#17803D] hover:bg-[#156f35] text-white shadow-xs'
            }`}
          >
            {isProcessing ? (
              <span>Recording...</span>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Confirm Payment (₹{grandTotal})</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
