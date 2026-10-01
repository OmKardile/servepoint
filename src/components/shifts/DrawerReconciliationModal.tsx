import React, { useState, useMemo } from 'react';
import { useTsosStore } from '../../lib/store';
import { StaffShift, DrawerReconciliation, DrawerDenominations } from '../../types';
import {
  Calculator,
  Banknote,
  Coins,
  CheckCircle2,
  AlertTriangle,
  Download,
  X,
  ShieldCheck,
  QrCode,
  CreditCard,
  FileSpreadsheet,
} from 'lucide-react';

interface DrawerReconciliationModalProps {
  shift: StaffShift;
  onClose: () => void;
  onSaveAndClockOut?: (reconciliation: DrawerReconciliation) => void;
}

export const DrawerReconciliationModal: React.FC<DrawerReconciliationModalProps> = ({
  shift,
  onClose,
  onSaveAndClockOut,
}) => {
  const { orders, addDrawerReconciliation, themeMode } = useTsosStore();
  const isServepoint = themeMode === 'servepoint';

  // Configurable Opening Cash Float
  const [openingFloat, setOpeningFloat] = useState<number>(2000);

  // Denominations count
  const [denominations, setDenominations] = useState<DrawerDenominations>({
    d500: 0,
    d200: 0,
    d100: 0,
    d50: 0,
    d20: 0,
    d10: 0,
    coins: 0,
  });

  // Mode: 'denominations' | 'manual_total'
  const [countMode, setCountMode] = useState<'denominations' | 'manual_total'>('denominations');
  const [manualTotal, setManualTotal] = useState<number>(0);
  const [notes, setNotes] = useState<string>('');
  const [isSaved, setIsSaved] = useState(false);

  // Compute System-Recorded Sales during the shift timeframe
  const shiftOrders = useMemo(() => {
    const shiftStart = new Date(shift.clock_in).getTime();
    const shiftEnd = shift.clock_out ? new Date(shift.clock_out).getTime() : Date.now();

    return (orders || []).filter((o) => {
      if (o.status === 'cancelled') return false;
      const orderTime = new Date(o.created_at).getTime();
      return orderTime >= shiftStart && orderTime <= shiftEnd + 60000;
    });
  }, [orders, shift]);

  // Aggregate sales by payment method
  const salesSummary = useMemo(() => {
    let cashSales = 0;
    let upiSales = 0;
    let cardSales = 0;
    let cashCount = 0;

    shiftOrders.forEach((o) => {
      const amount = Number(o.grand_total) || 0;
      if (o.payment_method === 'cash') {
        cashSales += amount;
        cashCount += 1;
      } else if (o.payment_method === 'upi') {
        upiSales += amount;
      } else if (o.payment_method === 'card') {
        cardSales += amount;
      }
    });

    const totalSales = cashSales + upiSales + cardSales;

    return {
      cashSales,
      cashCount,
      upiSales,
      cardSales,
      totalSales,
      totalOrdersCount: shiftOrders.length,
    };
  }, [shiftOrders]);

  // Calculate counted total cash
  const calculatedCountedCash = useMemo(() => {
    if (countMode === 'manual_total') {
      return Number(manualTotal) || 0;
    }
    return (
      denominations.d500 * 500 +
      denominations.d200 * 200 +
      denominations.d100 * 100 +
      denominations.d50 * 50 +
      denominations.d20 * 20 +
      denominations.d10 * 10 +
      denominations.coins
    );
  }, [countMode, denominations, manualTotal]);

  // Expected Cash = Opening Float + System Cash Sales
  const expectedCash = openingFloat + salesSummary.cashSales;
  const variance = calculatedCountedCash - expectedCash;

  const varianceStatus: 'balanced' | 'surplus' | 'shortage' =
    variance === 0 ? 'balanced' : variance > 0 ? 'surplus' : 'shortage';

  const updateDenomination = (key: keyof DrawerDenominations, val: number) => {
    setDenominations((prev) => ({
      ...prev,
      [key]: Math.max(0, val),
    }));
  };

  const handleAutoFillExact = () => {
    // Convenience helper to fill counted cash to match expected
    setCountMode('manual_total');
    setManualTotal(expectedCash);
  };

  const buildReconciliationData = (): DrawerReconciliation => {
    return {
      id: `rec-${Date.now()}`,
      shift_id: shift.id,
      staff_id: shift.staff_id,
      staff_name: shift.staff_name,
      reconciled_at: new Date().toISOString(),
      opening_float: openingFloat,
      system_cash_sales: salesSummary.cashSales,
      system_upi_sales: salesSummary.upiSales,
      system_card_sales: salesSummary.cardSales,
      system_total_sales: salesSummary.totalSales,
      cash_orders_count: salesSummary.cashCount,
      total_orders_count: salesSummary.totalOrdersCount,
      denominations,
      total_counted_cash: calculatedCountedCash,
      expected_cash: expectedCash,
      variance,
      status: varianceStatus,
      notes: notes.trim() || undefined,
    };
  };

  const handleSaveAudit = () => {
    const data = buildReconciliationData();
    addDrawerReconciliation(data);
    setIsSaved(true);
    setTimeout(() => {
      onClose();
    }, 1200);
  };

  const handleSaveAndClockOut = () => {
    const data = buildReconciliationData();
    addDrawerReconciliation(data);
    if (onSaveAndClockOut) {
      onSaveAndClockOut(data);
    }
  };

  const handleDownloadSlip = () => {
    const now = new Date().toLocaleString();
    const slipText = `================================================
TSOS CAFE OS - CASH DRAWER RECONCILIATION SLIP
================================================
Staff Member      : ${shift.staff_name} (${shift.role})
Shift Clock In    : ${new Date(shift.clock_in).toLocaleString()}
Reconciliation At : ${now}
------------------------------------------------
SYSTEM-RECORDED SALES FOR SHIFT:
Total Orders      : ${salesSummary.totalOrdersCount}
Cash Sales        : ₹${salesSummary.cashSales.toLocaleString()} (${salesSummary.cashCount} orders)
UPI (BharatQR)    : ₹${salesSummary.upiSales.toLocaleString()}
Card Terminal     : ₹${salesSummary.cardSales.toLocaleString()}
Total Gross Sales : ₹${salesSummary.totalSales.toLocaleString()}
------------------------------------------------
DRAWER CALCULATION:
Opening Float     : ₹${openingFloat.toLocaleString()}
(+) Cash Sales    : ₹${salesSummary.cashSales.toLocaleString()}
================================================
EXPECTED CASH     : ₹${expectedCash.toLocaleString()}
COUNTED CASH      : ₹${calculatedCountedCash.toLocaleString()}
------------------------------------------------
VARIANCE          : ${variance >= 0 ? '+' : ''}₹${variance.toLocaleString()} [${varianceStatus.toUpperCase()}]
================================================
DENOMINATIONS BREAKDOWN:
₹500 x ${denominations.d500} = ₹${denominations.d500 * 500}
₹200 x ${denominations.d200} = ₹${denominations.d200 * 200}
₹100 x ${denominations.d100} = ₹${denominations.d100 * 100}
₹50  x ${denominations.d50}  = ₹${denominations.d50 * 50}
₹20  x ${denominations.d20}  = ₹${denominations.d20 * 20}
₹10  x ${denominations.d10}  = ₹${denominations.d10 * 10}
Coins Subtotal : ₹${denominations.coins}
------------------------------------------------
Staff Notes       : ${notes || 'None recorded'}
Status Verified   : ${varianceStatus === 'balanced' ? 'PASSED (BALANCED)' : 'AUDIT FLAGGED'}
================================================`;

    const blob = new Blob([slipText], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reconciliation-${shift.staff_name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className={`bg-white rounded-2xl max-w-2xl w-full border shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-auto ${isServepoint ? 'border-[#E3E7E0]' : 'border-[#E9E0D6]'}`}>
        {/* Header */}
        <div className={`p-4 border-b flex items-center justify-between ${isServepoint ? 'bg-[#F6F5F2] border-[#E3E7E0]' : 'bg-[#FFF9F2] border-[#E9E0D6]'}`}>
          <div className="flex items-center gap-2.5">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shadow-xs ${isServepoint ? 'sp-surface text-[#0F3D3E]' : 'bg-[#FFF1E6] text-[#F97316]'}`}>
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className={`font-bold text-sm sm:text-base ${isServepoint ? 'text-[#1A1A1A]' : 'text-[#1C1917]'}`}>
                  End-of-Shift Drawer Reconciliation
                </h3>
                <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md ${
                  isServepoint ? 'bg-[#D9E2DD] text-[#0F3D3E]' : 'bg-[#FFF1E6] text-[#F97316]'
                }`}>
                  Cash Audit
                </span>
              </div>
              <p className={`text-xs mt-0.5 ${isServepoint ? 'text-[#6B6B6B]' : 'text-[#57534E]'}`}>
                {shift.staff_name} ({shift.role}) • Clocked in{' '}
                {new Date(shift.clock_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-lg transition-colors ${isServepoint ? 'text-[#6B8579] hover:text-[#1A1A1A] hover:bg-black/5' : 'text-[#78716C] hover:text-[#1C1917] hover:bg-black/5'}`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Row 1: System-Recorded Sales & Opening Float */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Opening Float */}
            <div className={`p-3 rounded-xl border ${isServepoint ? 'bg-white border-[#E3E7E0]' : 'bg-[#FFFDF9] border-[#E9E0D6]'}`}>
              <div className={`flex items-center justify-between text-xs mb-1 ${isServepoint ? 'text-[#6B6B6B]' : 'text-[#57534E]'}`}>
                <span>Opening Cash Float</span>
                <Banknote className={`w-3.5 h-3.5 ${isServepoint ? 'text-[#0F3D3E]' : 'text-[#F97316]'}`} />
              </div>
              <div className="flex items-center gap-1">
                <span className={`text-sm font-bold ${isServepoint ? 'text-[#0F3D3E]' : 'text-[#1C1917]'}`}>₹</span>
                <input
                  type="number"
                  min={0}
                  step={50}
                  value={openingFloat}
                  onChange={(e) => setOpeningFloat(Math.max(0, Number(e.target.value) || 0))}
                  className={`w-full rounded-lg px-2 py-1 text-base font-bold focus:outline-hidden ${
                    isServepoint
                      ? 'bg-white border border-[#E3E7E0] text-[#0F3D3E] focus:border-[#B88E2F] focus:ring-1 focus:ring-[#B88E2F]/30'
                      : 'bg-white border border-[#E9E0D6] font-mono text-[#1C1917] focus:ring-1 focus:ring-[#F97316]'
                  }`}
                />
              </div>
              <span className={`text-[10px] mt-0.5 block ${isServepoint ? 'text-[#6B8579]' : 'text-[#A8A29E]'}`}>Till balance at shift start</span>
            </div>

            {/* System Cash Sales */}
            <div className={`p-3 rounded-xl border ${isServepoint ? 'bg-white border-[#E3E7E0]' : 'bg-[#FFFDF9] border-[#E9E0D6]'}`}>
              <div className={`flex items-center justify-between text-xs mb-1 ${isServepoint ? 'text-[#6B6B6B]' : 'text-[#57534E]'}`}>
                <span>System Cash Sales</span>
                <span className="text-[10px] font-semibold text-[#17803D] bg-[#E8F5EC] px-1.5 py-0.5 rounded">
                  {salesSummary.cashCount} bills
                </span>
              </div>
              <div className={`text-xl font-bold ${isServepoint ? 'text-[#0F3D3E]' : 'font-mono text-[#1C1917]'}`}>
                ₹{salesSummary.cashSales.toLocaleString()}
              </div>
              <span className={`text-[10px] mt-0.5 block ${isServepoint ? 'text-[#6B8579]' : 'text-[#57534E]'}`}>Recorded at counter register</span>
            </div>

            {/* Expected Cash in Drawer */}
            <div className={`p-3 rounded-xl ${
              isServepoint ? 'bg-[#B88E2F]/10 border border-[#B88E2F]/30' : 'bg-gradient-to-br from-[#FFF4E5] to-[#FFF9F2] border border-[#FED7AA]'
            }`}>
              <div className={`flex items-center justify-between text-xs font-semibold mb-1 ${isServepoint ? 'text-[#967221]' : 'text-[#B45309]'}`}>
                <span>Expected in Till</span>
                <ShieldCheck className={`w-4 h-4 ${isServepoint ? 'text-[#967221]' : 'text-[#B45309]'}`} />
              </div>
              <div className={`text-xl font-bold ${isServepoint ? 'text-[#967221]' : 'font-mono text-[#B45309]'}`}>
                ₹{expectedCash.toLocaleString()}
              </div>
              <span className={`text-[10px] mt-0.5 block ${isServepoint ? 'text-[#967221]/80' : 'text-[#B45309]/80'}`}>Float + Cash Sales</span>
            </div>
          </div>

          {/* Digital Sales Reference (UPI & Card) */}
          <div className={`p-2.5 rounded-xl border flex flex-wrap items-center justify-between gap-2 text-xs ${
            isServepoint ? 'bg-[#F6F5F2] border-[#E3E7E0] text-[#6B6B6B]' : 'bg-[#F5F0EB]/60 border-[#E9E0D6] text-[#57534E]'
          }`}>
            <span className={`font-semibold ${isServepoint ? 'text-[#1A1A1A]' : 'text-[#1C1917]'}`}>Digital Settlements Check:</span>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <QrCode className={`w-3.5 h-3.5 ${isServepoint ? 'text-[#0F3D3E]' : 'text-[#F97316]'}`} />
                <span>UPI: <strong>₹{salesSummary.upiSales.toLocaleString()}</strong></span>
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <CreditCard className={`w-3.5 h-3.5 ${isServepoint ? 'text-[#0F3D3E]' : 'text-[#2563EB]'}`} />
                <span>Card: <strong>₹{salesSummary.cardSales.toLocaleString()}</strong></span>
              </span>
              <span>•</span>
              <span>Total Revenue: <strong>₹{salesSummary.totalSales.toLocaleString()}</strong></span>
            </div>
          </div>

          {/* Section: Drawer Currency Counting */}
          <div className={`bg-white rounded-xl border p-4 space-y-3 ${isServepoint ? 'border-[#E3E7E0]' : 'border-[#E9E0D6]'}`}>
            <div className={`flex flex-wrap items-center justify-between gap-2 border-b pb-2.5 ${isServepoint ? 'border-[#E3E7E0]' : 'border-[#E9E0D6]'}`}>
              <div className="flex items-center gap-2">
                <Banknote className={`w-4 h-4 ${isServepoint ? 'text-[#0F3D3E]' : 'text-[#F97316]'}`} />
                <h4 className={`font-bold text-xs uppercase tracking-wider ${isServepoint ? 'text-[#1A1A1A]' : 'text-[#1C1917]'}`}>
                  Count Cash in Drawer
                </h4>
              </div>

              <div className={`flex items-center gap-1 p-0.5 rounded-lg text-xs ${isServepoint ? 'bg-[#D9E2DD]' : 'bg-[#F5F0EB]'}`}>
                <button
                  type="button"
                  onClick={() => setCountMode('denominations')}
                  className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                    countMode === 'denominations'
                      ? isServepoint
                        ? 'bg-[#0F3D3E] text-white shadow-xs'
                        : 'bg-white text-[#1C1917] shadow-xs'
                      : isServepoint
                        ? 'text-[#6B6B6B] hover:text-[#0F3D3E]'
                        : 'text-[#57534E] hover:text-[#1C1917]'
                  }`}
                >
                  By Denominations
                </button>
                <button
                  type="button"
                  onClick={() => setCountMode('manual_total')}
                  className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                    countMode === 'manual_total'
                      ? isServepoint
                        ? 'bg-[#0F3D3E] text-white shadow-xs'
                        : 'bg-white text-[#1C1917] shadow-xs'
                      : isServepoint
                        ? 'text-[#6B6B6B] hover:text-[#0F3D3E]'
                        : 'text-[#57534E] hover:text-[#1C1917]'
                  }`}
                >
                  Direct Lump Sum
                </button>
              </div>
            </div>

            {countMode === 'denominations' ? (
              <div className="space-y-2">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {/* ₹500 */}
                  <div className={`p-2 rounded-lg border flex items-center justify-between gap-1 ${
                    isServepoint ? 'border-[#E3E7E0] bg-white' : 'border-[#E9E0D6] bg-[#FFFDF9]'
                  }`}>
                    <span className={`font-bold text-xs w-12 ${isServepoint ? 'text-[#1A1A1A]' : 'text-[#1C1917]'}`}>₹500 ×</span>
                    <input
                      type="number"
                      min={0}
                      value={denominations.d500 || ''}
                      placeholder="0"
                      onChange={(e) => updateDenomination('d500', Number(e.target.value) || 0)}
                      className={`w-14 text-center font-bold rounded px-1 py-0.5 text-xs focus:outline-none ${
                        isServepoint
                          ? 'bg-white border border-[#E3E7E0] text-[#0F3D3E] focus:border-[#B88E2F] focus:ring-1 focus:ring-[#B88E2F]/30'
                          : 'font-mono bg-white border border-[#E9E0D6] text-[#1C1917] focus:ring-1 focus:ring-[#F97316]'
                      }`}
                    />
                    <span className={`text-xs w-16 text-right ${isServepoint ? 'text-[#6B6B6B]' : 'font-mono text-[#57534E]'}`}>
                      = ₹{denominations.d500 * 500}
                    </span>
                  </div>

                  {/* ₹200 */}
                  <div className={`p-2 rounded-lg border flex items-center justify-between gap-1 ${
                    isServepoint ? 'border-[#E3E7E0] bg-white' : 'border-[#E9E0D6] bg-[#FFFDF9]'
                  }`}>
                    <span className={`font-bold text-xs w-12 ${isServepoint ? 'text-[#1A1A1A]' : 'text-[#1C1917]'}`}>₹200 ×</span>
                    <input
                      type="number"
                      min={0}
                      value={denominations.d200 || ''}
                      placeholder="0"
                      onChange={(e) => updateDenomination('d200', Number(e.target.value) || 0)}
                      className={`w-14 text-center font-bold rounded px-1 py-0.5 text-xs focus:outline-none ${
                        isServepoint
                          ? 'bg-white border border-[#E3E7E0] text-[#0F3D3E] focus:border-[#B88E2F] focus:ring-1 focus:ring-[#B88E2F]/30'
                          : 'font-mono bg-white border border-[#E9E0D6] text-[#1C1917] focus:ring-1 focus:ring-[#F97316]'
                      }`}
                    />
                    <span className={`text-xs w-16 text-right ${isServepoint ? 'text-[#6B6B6B]' : 'font-mono text-[#57534E]'}`}>
                      = ₹{denominations.d200 * 200}
                    </span>
                  </div>

                  {/* ₹100 */}
                  <div className={`p-2 rounded-lg border flex items-center justify-between gap-1 ${
                    isServepoint ? 'border-[#E3E7E0] bg-white' : 'border-[#E9E0D6] bg-[#FFFDF9]'
                  }`}>
                    <span className={`font-bold text-xs w-12 ${isServepoint ? 'text-[#1A1A1A]' : 'text-[#1C1917]'}`}>₹100 ×</span>
                    <input
                      type="number"
                      min={0}
                      value={denominations.d100 || ''}
                      placeholder="0"
                      onChange={(e) => updateDenomination('d100', Number(e.target.value) || 0)}
                      className={`w-14 text-center font-bold rounded px-1 py-0.5 text-xs focus:outline-none ${
                        isServepoint
                          ? 'bg-white border border-[#E3E7E0] text-[#0F3D3E] focus:border-[#B88E2F] focus:ring-1 focus:ring-[#B88E2F]/30'
                          : 'font-mono bg-white border border-[#E9E0D6] text-[#1C1917] focus:ring-1 focus:ring-[#F97316]'
                      }`}
                    />
                    <span className={`text-xs w-16 text-right ${isServepoint ? 'text-[#6B6B6B]' : 'font-mono text-[#57534E]'}`}>
                      = ₹{denominations.d100 * 100}
                    </span>
                  </div>

                  {/* ₹50 */}
                  <div className={`p-2 rounded-lg border flex items-center justify-between gap-1 ${
                    isServepoint ? 'border-[#E3E7E0] bg-white' : 'border-[#E9E0D6] bg-[#FFFDF9]'
                  }`}>
                    <span className={`font-bold text-xs w-12 ${isServepoint ? 'text-[#1A1A1A]' : 'text-[#1C1917]'}`}>₹50 ×</span>
                    <input
                      type="number"
                      min={0}
                      value={denominations.d50 || ''}
                      placeholder="0"
                      onChange={(e) => updateDenomination('d50', Number(e.target.value) || 0)}
                      className={`w-14 text-center font-bold rounded px-1 py-0.5 text-xs focus:outline-none ${
                        isServepoint
                          ? 'bg-white border border-[#E3E7E0] text-[#0F3D3E] focus:border-[#B88E2F] focus:ring-1 focus:ring-[#B88E2F]/30'
                          : 'font-mono bg-white border border-[#E9E0D6] text-[#1C1917] focus:ring-1 focus:ring-[#F97316]'
                      }`}
                    />
                    <span className={`text-xs w-16 text-right ${isServepoint ? 'text-[#6B6B6B]' : 'font-mono text-[#57534E]'}`}>
                      = ₹{denominations.d50 * 50}
                    </span>
                  </div>

                  {/* ₹20 */}
                  <div className={`p-2 rounded-lg border flex items-center justify-between gap-1 ${
                    isServepoint ? 'border-[#E3E7E0] bg-white' : 'border-[#E9E0D6] bg-[#FFFDF9]'
                  }`}>
                    <span className={`font-bold text-xs w-12 ${isServepoint ? 'text-[#1A1A1A]' : 'text-[#1C1917]'}`}>₹20 ×</span>
                    <input
                      type="number"
                      min={0}
                      value={denominations.d20 || ''}
                      placeholder="0"
                      onChange={(e) => updateDenomination('d20', Number(e.target.value) || 0)}
                      className={`w-14 text-center font-bold rounded px-1 py-0.5 text-xs focus:outline-none ${
                        isServepoint
                          ? 'bg-white border border-[#E3E7E0] text-[#0F3D3E] focus:border-[#B88E2F] focus:ring-1 focus:ring-[#B88E2F]/30'
                          : 'font-mono bg-white border border-[#E9E0D6] text-[#1C1917] focus:ring-1 focus:ring-[#F97316]'
                      }`}
                    />
                    <span className={`text-xs w-16 text-right ${isServepoint ? 'text-[#6B6B6B]' : 'font-mono text-[#57534E]'}`}>
                      = ₹{denominations.d20 * 20}
                    </span>
                  </div>

                  {/* ₹10 */}
                  <div className={`p-2 rounded-lg border flex items-center justify-between gap-1 ${
                    isServepoint ? 'border-[#E3E7E0] bg-white' : 'border-[#E9E0D6] bg-[#FFFDF9]'
                  }`}>
                    <span className={`font-bold text-xs w-12 ${isServepoint ? 'text-[#1A1A1A]' : 'text-[#1C1917]'}`}>₹10 ×</span>
                    <input
                      type="number"
                      min={0}
                      value={denominations.d10 || ''}
                      placeholder="0"
                      onChange={(e) => updateDenomination('d10', Number(e.target.value) || 0)}
                      className={`w-14 text-center font-bold rounded px-1 py-0.5 text-xs focus:outline-none ${
                        isServepoint
                          ? 'bg-white border border-[#E3E7E0] text-[#0F3D3E] focus:border-[#B88E2F] focus:ring-1 focus:ring-[#B88E2F]/30'
                          : 'font-mono bg-white border border-[#E9E0D6] text-[#1C1917] focus:ring-1 focus:ring-[#F97316]'
                      }`}
                    />
                    <span className={`text-xs w-16 text-right ${isServepoint ? 'text-[#6B6B6B]' : 'font-mono text-[#57534E]'}`}>
                      = ₹{denominations.d10 * 10}
                    </span>
                  </div>
                </div>

                {/* Coins */}
                <div className={`p-2.5 rounded-lg border flex items-center justify-between gap-2 ${
                  isServepoint ? 'border-[#E3E7E0] bg-white' : 'border-[#E9E0D6] bg-[#FFFDF9]'
                }`}>
                  <div className={`flex items-center gap-1.5 text-xs font-semibold ${isServepoint ? 'text-[#1A1A1A]' : 'text-[#1C1917]'}`}>
                    <Coins className={`w-4 h-4 ${isServepoint ? 'text-[#0F3D3E]' : 'text-[#B45309]'}`} />
                    <span>Coins Subtotal (₹1, ₹2, ₹5 coins)</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className={`text-xs font-bold ${isServepoint ? 'text-[#6B6B6B]' : 'text-[#57534E]'}`}>₹</span>
                    <input
                      type="number"
                      min={0}
                      value={denominations.coins || ''}
                      placeholder="0"
                      onChange={(e) => updateDenomination('coins', Number(e.target.value) || 0)}
                      className={`w-20 text-right font-bold rounded px-2 py-1 text-xs focus:outline-none ${
                        isServepoint
                          ? 'bg-white border border-[#E3E7E0] text-[#0F3D3E] focus:border-[#B88E2F] focus:ring-1 focus:ring-[#B88E2F]/30'
                          : 'font-mono bg-white border border-[#E9E0D6] text-[#1C1917] focus:ring-1 focus:ring-[#F97316]'
                      }`}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className={`p-4 rounded-xl border space-y-2 ${isServepoint ? 'bg-white border-[#E3E7E0]' : 'bg-[#FFFDF9] border-[#E9E0D6]'}`}>
                <label className={`block text-xs font-semibold ${isServepoint ? 'text-[#1A1A1A]' : 'text-[#1C1917]'}`}>
                  Enter Total Physical Cash Counted in Drawer (₹)
                </label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <span className={`absolute left-3 top-1/2 -translate-y-1/2 font-bold text-sm ${isServepoint ? 'text-[#6B6B6B]' : 'text-[#78716C]'}`}>
                      ₹
                    </span>
                    <input
                      type="number"
                      min={0}
                      step={10}
                      value={manualTotal || ''}
                      placeholder="0"
                      onChange={(e) => setManualTotal(Number(e.target.value) || 0)}
                      className={`w-full pl-8 pr-3 py-2 text-lg font-bold rounded-xl border focus:outline-none ${
                        isServepoint
                          ? 'bg-white border-[#E3E7E0] text-[#0F3D3E] focus:border-[#B88E2F] focus:ring-1 focus:ring-[#B88E2F]/30'
                          : 'font-mono border-[#E9E0D6] bg-white text-[#1C1917] focus:ring-2 focus:ring-[#F97316]'
                      }`}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleAutoFillExact}
                    className={`px-3 py-2 text-xs font-semibold rounded-xl transition-colors ${
                      isServepoint
                        ? 'text-[#967221] bg-[#B88E2F]/10 hover:bg-[#B88E2F]/20'
                        : 'text-[#F97316] bg-[#FFF1E6] hover:bg-[#FED7AA]'
                    }`}
                  >
                    Match Expected (₹{expectedCash})
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Variance Comparison Card */}
          <div
            className={`p-4 rounded-2xl border transition-all ${
              varianceStatus === 'balanced'
                ? isServepoint
                  ? 'bg-[#E8F5EC] border-[#B7DCC5]'
                  : 'bg-[#F0FDF4] border-[#86EFAC]'
                : varianceStatus === 'surplus'
                ? isServepoint
                  ? 'bg-[#B88E2F]/10 border-[#B88E2F]/40'
                  : 'bg-[#EFF6FF] border-[#93C5FD]'
                : isServepoint
                  ? 'bg-[#FEF2F2] border-[#F5C6C0]'
                  : 'bg-[#FEF2F2] border-[#FCA5A5]'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className={`text-[11px] font-semibold uppercase tracking-wider block ${isServepoint ? 'text-[#6B6B6B]' : 'text-[#57534E]'}`}>
                  Reconciliation Result
                </span>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={`text-2xl font-black ${isServepoint ? 'text-[#0F3D3E]' : 'font-mono text-[#1C1917]'}`}>
                    Counted: ₹{calculatedCountedCash.toLocaleString()}
                  </span>
                  <span className={`text-xs ${isServepoint ? 'text-[#6B6B6B]' : 'text-[#57534E]'}`}>
                    (vs Expected: ₹{expectedCash.toLocaleString()})
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {varianceStatus === 'balanced' && (
                  <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs ${
                    isServepoint ? 'bg-[#E8F5EC] text-[#17803D]' : 'bg-[#DCFCE7] text-[#15803D]'
                  }`}>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>BALANCED (Exact Match • ₹0 Diff)</span>
                  </div>
                )}
                {varianceStatus === 'surplus' && (
                  <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs ${
                    isServepoint ? 'bg-[#B88E2F]/15 text-[#967221]' : 'bg-[#DBEAFE] text-[#1E40AF]'
                  }`}>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>SURPLUS (+₹{variance.toLocaleString()})</span>
                  </div>
                )}
                {varianceStatus === 'shortage' && (
                  <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs ${
                    isServepoint ? 'bg-[#FEF2F2] text-[#B42318]' : 'bg-[#FEE2E2] text-[#B91C1C]'
                  }`}>
                    <AlertTriangle className="w-4 h-4" />
                    <span>SHORTAGE (-₹{Math.abs(variance).toLocaleString()})</span>
                  </div>
                )}
              </div>
            </div>

            {variance !== 0 && (
              <p className={`text-xs mt-2 pt-2 border-t border-black/10 ${isServepoint ? 'text-[#6B6B6B]' : 'text-[#57534E]'}`}>
                {variance > 0
                  ? `There is ₹${variance} more cash in the drawer than recorded by the system. Check for unrecorded tips or manual deposits.`
                  : `There is a shortage of ₹${Math.abs(variance)} in the drawer. Verify cash drops, payouts, or incorrect change provided.`}
              </p>
            )}
          </div>

          {/* Audit Notes */}
          <div>
            <label className={`block text-xs font-semibold mb-1 ${isServepoint ? 'text-[#1A1A1A]' : 'text-[#1C1917]'}`}>
              Audit Notes & Handover Remarks (optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Counter handover to evening shift, ₹10 customer tip kept in drawer"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className={`w-full rounded-xl px-3 py-2 text-xs focus:outline-hidden ${
                isServepoint
                  ? 'bg-white border border-[#E3E7E0] text-[#1A1A1A] focus:border-[#B88E2F] focus:ring-1 focus:ring-[#B88E2F]/30'
                  : 'bg-[#FFF9F2] border border-[#E9E0D6] text-[#1C1917] focus:ring-2 focus:ring-[#F97316]'
              }`}
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className={`p-4 border-t flex flex-wrap items-center justify-between gap-2 ${isServepoint ? 'bg-[#F6F5F2] border-[#E3E7E0]' : 'bg-[#FFF9F2] border-[#E9E0D6]'}`}>
          <button
            type="button"
            onClick={handleDownloadSlip}
            className={`px-3 py-2 rounded-xl border font-semibold text-xs flex items-center gap-1.5 transition-colors ${
              isServepoint
                ? 'bg-white border-[#E3E7E0] hover:bg-[#EFEDE8] text-[#0F3D3E]'
                : 'bg-white border-[#D5C9BD] hover:bg-[#F5EBE1] text-[#1C1917]'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download Audit Slip</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className={`px-3.5 py-2 rounded-xl border font-semibold text-xs transition-colors ${
                isServepoint
                  ? 'bg-white border-[#E3E7E0] text-[#6B6B6B] hover:bg-[#EFEDE8]'
                  : 'border-[#E9E0D6] text-[#57534E] hover:bg-[#F5F0EB]'
              }`}
            >
              Cancel
            </button>

            {onSaveAndClockOut ? (
              <button
                type="button"
                onClick={handleSaveAndClockOut}
                className="px-4 py-2 rounded-xl bg-[#B42318] hover:bg-[#91180F] text-white font-bold text-xs shadow-xs flex items-center gap-1.5 transition-colors"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Save Reconciliation & Clock Out</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSaveAudit}
                disabled={isSaved}
                className={`px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors disabled:opacity-50 ${
                  isServepoint ? 'sp-cta' : 'bg-[#F97316] hover:bg-[#EA580C] text-white shadow-xs'
                }`}
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{isSaved ? 'Audit Saved!' : 'Save Reconciliation Audit'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
