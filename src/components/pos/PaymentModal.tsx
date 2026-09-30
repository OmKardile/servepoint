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
  const { createOrder, audioEnabled, location, currentTenant, redeemedPoints, selectedCustomerId, customers } = useTsosStore();
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
        colors: ['#F97316', '#17803D', '#7C3AED'],
      });

      setIsProcessing(false);
      onSuccess(newOrder);
    }, 400);
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150"
      onClick={(e) => {
        // Click on the backdrop (not inside the modal) closes the modal — matches
        // the Escape / X / "Back to Cart" affordances for fast cashier flow.
        if (e.target === e.currentTarget && !isProcessing) onClose();
      }}
    >
      <div className="bg-white rounded-2xl max-w-lg w-full border border-[#E9E0D6] shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 bg-[#FFF9F2] border-b border-[#E9E0D6] flex items-center justify-between">
          <div>
            <div className="text-xs text-[#57534E]">Complete Sale Tender</div>
            <div className="text-xl font-bold text-[#1C1917] font-mono tabular-nums">
              Amount to Collect: ₹{grandTotal.toFixed(2)}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-[#E9E0D6] text-[#57534E] transition-colors"
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
                  ? 'border-[#F97316] bg-[#FFF1E6] text-[#F97316] ring-1 ring-[#F97316]'
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
                  ? 'border-[#17803D] bg-[#E8F5EC] text-[#17803D] ring-1 ring-[#17803D]'
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
                  ? 'border-[#2563EB] bg-[#EFF6FF] text-[#2563EB] ring-1 ring-[#2563EB]'
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
                  ? 'border-[#7C3AED] bg-[#F5F3FF] text-[#7C3AED] ring-1 ring-[#7C3AED]'
                  : 'border-[#E9E0D6] hover:bg-[#F5F0EB] text-[#57534E]'
              }`}
            >
              <Users className="w-5 h-5" />
              <span className="text-[11px] font-semibold">Split Bill</span>
            </button>
          </div>

          {/* UPI View */}
          {selectedMethod === 'upi' && (
            <div className="p-4 bg-[#FFF9F2] rounded-xl border border-[#E9E0D6] flex flex-col items-center text-center space-y-3">
              <div className="bg-white p-3 rounded-xl border border-[#E9E0D6] shadow-xs">
                {/* Visual BharatQR simulation with dynamic amount */}
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
                <div className="text-xs font-semibold text-[#1C1917]">
                  Scan with Google Pay, PhonePe, Paytm, or BHIM
                </div>
                <div className="flex items-center justify-center gap-1.5 text-xs text-[#57534E] font-mono">
                  <span>VPA: {upiId}</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(upiId);
                      setCopiedUpi(true);
                      setTimeout(() => setCopiedUpi(false), 2000);
                    }}
                    className="hover:text-[#1C1917]"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  {copiedUpi && <span className="text-[10px] text-[#17803D] font-bold">Copied!</span>}
                </div>
              </div>

              {/* Instant App Simulation button */}
              <button
                type="button"
                onClick={handleConfirmPayment}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#E8F5EC] hover:bg-[#DCFCE7] text-[#166534] text-xs font-bold transition-all border border-[#BBF7D0]"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Simulate UPI App Confirmation
              </button>
            </div>
          )}

          {/* Cash View */}
          {selectedMethod === 'cash' && (
            <div className="p-4 bg-[#F5F0EB] rounded-xl border border-[#E9E0D6] space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#57534E] uppercase tracking-wider mb-1.5">
                  Cash Tendered (₹)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={cashTendered}
                    onChange={(e) => setCashTendered(Number(e.target.value) || 0)}
                    className="w-full px-3 py-2 text-lg font-bold font-mono tabular-nums rounded-xl border border-[#E9E0D6] bg-white text-[#1C1917]"
                  />
                  <button
                    type="button"
                    onClick={() => setCashTendered(grandTotal)}
                    className="px-3 py-2 text-xs font-semibold bg-white border border-[#E9E0D6] rounded-xl hover:bg-[#E9E0D6]"
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
                    className="px-3 py-1.5 text-xs font-mono font-bold bg-white rounded-lg border border-[#E9E0D6] hover:border-[#17803D] hover:bg-[#E8F5EC] text-[#1C1917]"
                  >
                    ₹{note}
                  </button>
                ))}
              </div>

              <div className="p-3 bg-white rounded-xl border border-[#E9E0D6] flex items-center justify-between">
                <span className="text-xs font-semibold text-[#57534E]">Change Due to Return</span>
                <span
                  className={`text-xl font-bold font-mono tabular-nums ${
                    cashTendered >= grandTotal ? 'text-[#17803D]' : 'text-[#B42318]'
                  }`}
                >
                  ₹{cashChange.toFixed(2)}
                </span>
              </div>
            </div>
          )}

          {/* Card View */}
          {selectedMethod === 'card' && (
            <div className="p-4 bg-[#EFF6FF] rounded-xl border border-[#BFDBFE] text-center space-y-2">
              <CreditCard className="w-8 h-8 text-[#2563EB] mx-auto" />
              <div className="text-sm font-semibold text-[#1C1917]">Card Swipe / Tap EDC Terminal</div>
              <div className="text-xs text-[#57534E]">
                Please tap or insert customer card on the Pine Labs / Paytm POS terminal.
              </div>
            </div>
          )}

          {/* Split Bill View */}
          {selectedMethod === 'split' && (
            <div className="p-4 bg-[#F5F3FF] rounded-xl border border-[#DDD6FE] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#5B21B6]">Number of Diners:</span>
                <div className="flex items-center gap-1">
                  {[2, 3, 4, 5, 6].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => updateSplitCount(n)}
                      className={`w-7 h-7 rounded-lg text-xs font-bold transition-all ${
                        splitCount === n
                          ? 'bg-[#7C3AED] text-white shadow-2xs'
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
                        ? 'bg-[#DCFCE7] border-[#86EFAC] text-[#166534]'
                        : 'bg-white border-[#E9E0D6] text-[#1C1917]'
                    }`}
                  >
                    <div>
                      <span className="font-bold">Diner {diner.dinerNumber}:</span>{' '}
                      <span className="font-mono font-bold">₹{diner.amount.toFixed(2)}</span>
                      {diner.paid && (
                        <span className="ml-2 text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-white text-[#166534]">
                          Paid via {diner.method}
                        </span>
                      )}
                    </div>

                    {!diner.paid ? (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => markDinerPaid(diner.dinerNumber, 'upi')}
                          className="px-2 py-0.5 rounded bg-[#FFF1E6] hover:bg-[#FDE2CF] text-[#EA580C] text-[10px] font-bold border border-[#FDBA74]"
                        >
                          UPI
                        </button>
                        <button
                          type="button"
                          onClick={() => markDinerPaid(diner.dinerNumber, 'cash')}
                          className="px-2 py-0.5 rounded bg-[#E8F5EC] hover:bg-[#DCFCE7] text-[#166534] text-[10px] font-bold border border-[#BBF7D0]"
                        >
                          Cash
                        </button>
                        <button
                          type="button"
                          onClick={() => markDinerPaid(diner.dinerNumber, 'card')}
                          className="px-2 py-0.5 rounded bg-[#EFF6FF] hover:bg-[#DBEAFE] text-[#1D4ED8] text-[10px] font-bold border border-[#BFDBFE]"
                        >
                          Card
                        </button>
                      </div>
                    ) : (
                      <Check className="w-4 h-4 text-[#16A34A]" />
                    )}
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between text-xs pt-1 text-[#5B21B6] font-semibold">
                <span>Collected: ₹{totalSplitPaid.toFixed(2)} / ₹{grandTotal.toFixed(2)}</span>
                <span className={allSplitDinersPaid ? 'text-[#166534]' : 'text-[#B45309]'}>
                  {allSplitDinersPaid ? 'All Diners Paid!' : `₹${(grandTotal - totalSplitPaid).toFixed(2)} Remaining`}
                </span>
              </div>
            </div>
          )}

          {/* Bill Summary Breakdown */}
          <div className="text-xs space-y-1.5 pt-2 border-t border-[#E9E0D6] text-[#57534E]">
            <div className="flex justify-between">
              <span>Items Subtotal</span>
              <span className="font-mono">₹{subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>GST (5%)</span>
              <span className="font-mono">₹{taxTotal.toFixed(2)}</span>
            </div>
            {discountTotal > 0 && (
              <div className="flex justify-between text-[#17803D]">
                <span>
                  Discount / Offer {redeemedPoints > 0 ? `(incl. ${redeemedPoints} pts)` : ''}
                </span>
                <span className="font-mono">- ₹{discountTotal.toFixed(2)}</span>
              </div>
            )}
            {attachedCustomer && pointsToEarn > 0 && (
              <div className="flex justify-between text-[#7C3AED] bg-[#F5F3FF] px-2 py-1 rounded-lg">
                <span className="font-medium">Loyalty Reward ({attachedCustomer.name})</span>
                <span className="font-mono font-bold">+{pointsToEarn} pts to earn</span>
              </div>
            )}
            <div className="flex justify-between items-center text-xs">
              <span className="flex items-center gap-1">
                Platform Fee:
                <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded-full bg-[#FFF1E6] text-[#F97316]">
                  {feePayer === 'cafe' ? 'Absorbed by Cafe' : 'Paid by Customer'}
                </span>
              </span>
              <span className="font-mono">
                {feePayer === 'customer' ? `+ ₹${platformFee}` : '₹0.00'}
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-[#FFF9F2] border-t border-[#E9E0D6] flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 text-sm font-medium text-[#57534E] hover:text-[#1C1917]"
          >
            Back to Cart
          </button>
          <button
            type="button"
            disabled={isProcessing || (selectedMethod === 'cash' && cashTendered < grandTotal)}
            onClick={handleConfirmPayment}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-sm bg-[#17803D] hover:bg-[#156f35] text-white shadow-xs transition-colors disabled:opacity-50"
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
