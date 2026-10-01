import React, { useState } from 'react';
import { useTsosStore } from '../../lib/store';
import { SEED_PROFILES } from '../../data/seedData';
import { PrinterConfig, PaperWidth } from '../../types';
import {
  Sliders,
  Store,
  CreditCard,
  Zap,
  Users,
  Database,
  RotateCcw,
  Check,
  ShieldCheck,
  Building,
  Printer,
  Wifi,
  Bluetooth,
  Usb,
  DollarSign,
  Scissors,
  Sparkles,
  HelpCircle,
  FileCheck2,
} from 'lucide-react';
import { canPerformAction } from '../../lib/rbac';
import {
  generateTestReceiptEscPos,
  triggerCashDrawerKick,
  printViaBluetooth,
} from '../../lib/printerService';
import { GuidanceTooltip } from '../common/GuidanceTooltip';

/* ServePoint gold toggle switch (ADR-0011 surface 19 — Checkout_Settings frame rows: label + description + gold toggle) */
const SPToggle: React.FC<{
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
}> = ({ checked, onChange, label }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    onClick={() => onChange(!checked)}
    className={`relative inline-flex h-5 w-10 shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B88E2F]/40 ${
      checked ? 'bg-[#B88E2F]' : 'bg-[#C7D2CB]'
    }`}
  >
    <span
      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
        checked ? 'translate-x-[22px]' : 'translate-x-0.5'
      }`}
    />
  </button>
);

export const SettingsScreen: React.FC = () => {
  const {
    location,
    feeConfig,
    updateFeeConfig,
    currentProfile,
    setCurrentProfile,
    resetToSeed,
    printerConfig,
    updatePrinterConfig,
    startTour,
    guidanceMode,
    toggleGuidanceMode,
    themeMode,
  } = useTsosStore();
  const isServepoint = themeMode === 'servepoint';

  const [activeSettingsSection, setActiveSettingsSection] = useState<
    'printer' | 'fees' | 'staff' | 'profile' | 'reset'
  >('printer');

  const [savedSuccess, setSavedSuccess] = useState(false);
  const [printerSavedSuccess, setPrinterSavedSuccess] = useState(false);
  const [testPrintFeedback, setTestPrintFeedback] = useState<string | null>(null);

  // Fee engine form state
  const [feePayer, setFeePayer] = useState(feeConfig.default_fee_payer);
  const [perOrderFee, setPerOrderFee] = useState(feeConfig.per_order_fee);
  const [autoFlipEnabled, setAutoFlipEnabled] = useState(feeConfig.auto_flip_enabled);
  const [autoFlipThreshold, setAutoFlipThreshold] = useState(feeConfig.customer_paid_order_limit);

  // Thermal printer form state
  const [printerForm, setPrinterForm] = useState<PrinterConfig>({ ...printerConfig });

  const handleSaveFeeConfig = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canPerformAction(currentProfile?.role, 'edit_settings')) {
      setTestPrintFeedback('Action Blocked: Only Cafe Owners and SuperAdmins can modify billing and fee configurations.');
      setTimeout(() => setTestPrintFeedback(null), 4000);
      return;
    }
    updateFeeConfig({
      default_fee_payer: feePayer,
      per_order_fee: perOrderFee,
      auto_flip_enabled: autoFlipEnabled,
      customer_paid_order_limit: autoFlipThreshold,
    });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const handleSavePrinterConfig = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canPerformAction(currentProfile?.role, 'edit_settings')) {
      setTestPrintFeedback('Action Blocked: Only Cafe Owners and SuperAdmins can modify hardware printer configurations.');
      setTimeout(() => setTestPrintFeedback(null), 4000);
      return;
    }
    updatePrinterConfig(printerForm);
    setPrinterSavedSuccess(true);
    setTimeout(() => setPrinterSavedSuccess(false), 2500);
  };

  const handleTestPrint = async () => {
    const testBytes = generateTestReceiptEscPos(location, printerForm);

    if (printerForm.connection_type === 'bluetooth') {
      const res = await printViaBluetooth(testBytes);
      setTestPrintFeedback(res.message);
      setTimeout(() => setTestPrintFeedback(null), 4000);
      return;
    }

    if (printerForm.open_cash_drawer) {
      triggerCashDrawerKick();
    }

    setTestPrintFeedback(
      `Test pattern (${printerForm.paper_width}, ${printerForm.connection_type.toUpperCase()}) dispatched. Triggering print dialog.`
    );
    window.print();
    setTimeout(() => setTestPrintFeedback(null), 4000);
  };

  const handleTestDrawerKick = () => {
    const res = triggerCashDrawerKick();
    setTestPrintFeedback(res.message);
    setTimeout(() => setTestPrintFeedback(null), 3000);
  };

  /* ================= SERVEPOINT BRANCH (per docs/design/servepoint/frames/Checkout_Settings_219-29597.png):
      ivory canvas, sage-tint section-nav card w/ deep-teal active row, setting rows with gold toggles,
      hairline dividers, full-width gold Save Changes. All existing handlers/fields preserved. ================= */
  if (isServepoint) {
    const settingsNav = [
      { id: 'printer' as const, label: 'Printer & Hardware', icon: Printer },
      { id: 'fees' as const, label: 'Checkout Settings', icon: Zap },
      { id: 'staff' as const, label: 'Staff Accounts', icon: Users },
      { id: 'profile' as const, label: 'Cafe Profile', icon: Building },
      { id: 'reset' as const, label: 'Reset Data', icon: RotateCcw },
    ];

    const spInputClass =
      'w-full px-3 py-2 text-xs font-bold rounded-xl border border-[#E3E7E0] bg-white text-[#1A1A1A] focus:border-[#B88E2F] focus:ring-1 focus:ring-[#B88E2F]/30 focus:outline-hidden';
    const spLabelClass = 'block text-xs font-semibold text-[#6B6B6B] mb-1';

    return (
      <div className="flex-1 overflow-y-auto bg-[#F6F5F2] p-4 lg:p-8">
        <div className="max-w-5xl mx-auto space-y-6">
          {/* Page Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl sp-surface text-[#0F3D3E] flex items-center justify-center">
                <Sliders className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl font-black text-[#1A1A1A] tracking-tight flex items-center gap-2">
                  <span>Checkout Settings</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-[#D9E2DD] text-[#0F3D3E] font-semibold">
                    Station #{location.id}
                  </span>
                </h1>
                <p className="text-xs text-[#6B6B6B] mt-0.5">
                  Configure thermal bill printing, cash drawer kick, zero-subscription fee engine, and guidance mode.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={startTour}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-[#E3E7E0] text-xs font-bold text-[#0F3D3E] hover:bg-[#F6F5F2] transition-colors"
              >
                <Sparkles className="w-4 h-4 text-[#B88E2F]" />
                <span>Launch Guided Tour</span>
              </button>
              <button
                type="button"
                onClick={toggleGuidanceMode}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-colors ${
                  guidanceMode
                    ? 'bg-[#0F3D3E] text-white'
                    : 'bg-white text-[#6B6B6B] border border-[#E3E7E0] hover:bg-[#F6F5F2]'
                }`}
              >
                {guidanceMode ? 'Guidance ON' : 'Guidance OFF'}
              </button>
            </div>
          </div>

          {/* Section Nav (sage card) + Content */}
          <div className="grid grid-cols-1 lg:grid-cols-[230px_1fr] gap-5 items-start">
            <nav aria-label="Settings sections" className="bg-[#D9E2DD] rounded-2xl p-2 space-y-0.5 lg:sticky lg:top-4">
              <div className="text-[10px] uppercase tracking-wider text-[#6B8579] font-semibold px-3.5 pt-1.5 pb-1">
                Settings
              </div>
              {settingsNav.map((s) => {
                const NavIcon = s.icon;
                const isActive = activeSettingsSection === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setActiveSettingsSection(s.id)}
                    aria-current={isActive ? 'page' : undefined}
                    className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-sm transition-colors ${
                      isActive
                        ? 'bg-[#0F3D3E] text-white font-semibold shadow-xs'
                        : 'text-[#0F3D3E] font-medium hover:bg-white/70'
                    }`}
                  >
                    <NavIcon className={`w-4 h-4 ${isActive ? 'text-[#B88E2F]' : 'text-[#0F3D3E] opacity-70'}`} />
                    <span>{s.label}</span>
                  </button>
                );
              })}
            </nav>

            <div className="space-y-6 min-w-0">
              {/* ===== 1. THERMAL PRINTER ===== */}
              {activeSettingsSection === 'printer' && (
                <div className="bg-white rounded-3xl border border-[#E3E7E0] p-6 shadow-xs space-y-6">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E3E7E0] pb-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-2xl sp-surface text-[#0F3D3E] flex items-center justify-center">
                        <Printer className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-base text-[#1A1A1A] flex items-center gap-2">
                          <span>Thermal Receipt & KOT Printer Integration</span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#E8F5EC] text-[#17803D] font-bold">
                            ESC/POS
                          </span>
                        </h3>
                        <p className="text-xs text-[#6B6B6B]">
                          Connect 58mm or 80mm thermal receipt printers via Web Print, Network/LAN, Bluetooth, or USB.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleTestDrawerKick}
                        className="px-3 py-1.5 rounded-xl border border-[#E3E7E0] bg-white text-xs font-semibold text-[#6B6B6B] hover:bg-[#F6F5F2] flex items-center gap-1.5 transition-colors"
                        title="Send test RJ11/RJ12 drawer kick pulse"
                      >
                        <DollarSign className="w-3.5 h-3.5 text-[#17803D]" />
                        <span>Test Drawer</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleTestPrint}
                        className="px-3.5 py-1.5 rounded-xl bg-[#0F3D3E] hover:bg-[#0B3132] text-white text-xs font-bold flex items-center gap-1.5 transition-colors"
                      >
                        <Printer className="w-3.5 h-3.5 text-[#B88E2F]" />
                        <span>Diagnostic Test Print</span>
                      </button>
                    </div>
                  </div>

                  {testPrintFeedback && (
                    <div className="p-3 bg-[#B88E2F]/10 text-[#967221] border border-[#B88E2F]/30 rounded-xl text-xs flex items-center gap-2 animate-in fade-in">
                      <FileCheck2 className="w-4 h-4 shrink-0" />
                      <span>{testPrintFeedback}</span>
                    </div>
                  )}

                  {printerSavedSuccess && (
                    <div className="p-3 bg-[#E8F5EC] text-[#17803D] border border-[#B7DCC5] rounded-xl text-xs flex items-center gap-2 animate-in fade-in">
                      <Check className="w-4 h-4 shrink-0" />
                      <span>Printer settings saved successfully! Thermal bills will format according to your choices.</span>
                    </div>
                  )}

                  <form onSubmit={handleSavePrinterConfig} className="space-y-5">
                    {/* Connection Type */}
                    <div>
                      <label className="block text-xs font-bold text-[#1A1A1A] mb-2">
                        Printer Connection Interface
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                        {[
                          {
                            id: 'browser',
                            name: 'Browser / System Dialog',
                            icon: Printer,
                            desc: 'Zero drivers needed. Works across Chrome, Edge, and Windows print spools.',
                          },
                          {
                            id: 'network',
                            name: 'Network / LAN (TCP:9100)',
                            icon: Wifi,
                            desc: 'Direct socket to Ethernet or Wi-Fi thermal printer IP address.',
                          },
                          {
                            id: 'bluetooth',
                            name: 'Web Bluetooth (SPP)',
                            icon: Bluetooth,
                            desc: 'Direct wireless pairing with handheld mobile thermal printers.',
                          },
                          {
                            id: 'usb',
                            name: 'Web USB Direct',
                            icon: Usb,
                            desc: 'Direct raw ESC/POS byte streaming to desktop USB receipt printer.',
                          },
                        ].map((conn) => {
                          const Icon = conn.icon;
                          const isSelected = printerForm.connection_type === conn.id;
                          return (
                            <button
                              key={conn.id}
                              type="button"
                              onClick={() =>
                                setPrinterForm((prev) => ({
                                  ...prev,
                                  connection_type: conn.id as any,
                                }))
                              }
                              className={`p-3.5 rounded-2xl border text-left transition-all ${
                                isSelected
                                  ? 'border-[#B88E2F] bg-[#B88E2F]/5 ring-1 ring-[#B88E2F]'
                                  : 'border-[#E3E7E0] bg-white hover:bg-[#F6F5F2]'
                              }`}
                            >
                              <div className="flex items-center justify-between mb-1.5">
                                <Icon className={`w-4 h-4 ${isSelected ? 'text-[#967221]' : 'text-[#6B6B6B]'}`} />
                                {isSelected && <span className="w-2 h-2 rounded-full bg-[#B88E2F]" />}
                              </div>
                              <div className="font-bold text-xs text-[#1A1A1A]">{conn.name}</div>
                              <div className="text-[11px] text-[#6B6B6B] mt-1 leading-snug">{conn.desc}</div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Paper Width & IP Details */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className={spLabelClass}>Thermal Paper Roll Width</label>
                        <div className="flex rounded-xl border border-[#E3E7E0] overflow-hidden bg-white p-1">
                          <button
                            type="button"
                            onClick={() => setPrinterForm((prev) => ({ ...prev, paper_width: '80mm' }))}
                            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                              printerForm.paper_width === '80mm'
                                ? 'bg-[#0F3D3E] text-white'
                                : 'text-[#6B6B6B] hover:bg-[#F6F5F2]'
                            }`}
                          >
                            80mm (Standard Desktop)
                          </button>
                          <button
                            type="button"
                            onClick={() => setPrinterForm((prev) => ({ ...prev, paper_width: '58mm' }))}
                            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                              printerForm.paper_width === '58mm'
                                ? 'bg-[#0F3D3E] text-white'
                                : 'text-[#6B6B6B] hover:bg-[#F6F5F2]'
                            }`}
                          >
                            58mm (Compact Mobile)
                          </button>
                        </div>
                        <span className="text-[10px] text-[#6B8579] mt-1 block">
                          {printerForm.paper_width === '80mm'
                            ? '48 characters per line'
                            : '32 characters per line'}
                        </span>
                      </div>

                      <div>
                        <label className={spLabelClass}>Printer IP / Host Address (Port 9100)</label>
                        <input
                          type="text"
                          value={printerForm.ip_address || ''}
                          onChange={(e) =>
                            setPrinterForm((prev) => ({ ...prev, ip_address: e.target.value }))
                          }
                          placeholder="192.168.1.200"
                          className={spInputClass}
                        />
                        <span className="text-[10px] text-[#6B8579] mt-1 block">
                          Used for Network thermal printers over Wi-Fi/LAN
                        </span>
                      </div>

                      <div>
                        <label className={spLabelClass}>Kitchen KOT Printer IP</label>
                        <input
                          type="text"
                          value={printerForm.kot_printer_ip || ''}
                          onChange={(e) =>
                            setPrinterForm((prev) => ({ ...prev, kot_printer_ip: e.target.value }))
                          }
                          placeholder="192.168.1.201:9100"
                          className={spInputClass}
                        />
                        <span className="text-[10px] text-[#6B8579] mt-1 block">
                          Dedicated ticket printer stationed in barista/kitchen
                        </span>
                      </div>
                    </div>

                    {/* Automation Toggles — setting rows with gold toggles */}
                    <div className="rounded-2xl border border-[#E3E7E0] divide-y divide-[#E3E7E0]">
                      {[
                        {
                          key: 'auto_print_receipt',
                          label: 'Auto-Print Customer Bill on Payment',
                          desc: 'Instantly triggers receipt printer when bill is settled via UPI, Cash, or Card.',
                          value: printerForm.auto_print_receipt,
                        },
                        {
                          key: 'auto_print_kot',
                          label: 'Auto-Print Kitchen Order Ticket (KOT)',
                          desc: 'Sends ticket to kitchen printer immediately upon cart confirmation.',
                          value: printerForm.auto_print_kot,
                        },
                        {
                          key: 'open_cash_drawer',
                          label: 'Auto-Kick Cash Drawer on Cash Sale',
                          desc: 'Sends ESC/POS pulse (ESC p 0 25 250) to RJ11/RJ12 drawer port.',
                          value: printerForm.open_cash_drawer,
                        },
                        {
                          key: 'cut_paper',
                          label: 'Automatic Paper Guillotine Cut',
                          desc: 'Feeds 3 blank lines and triggers hardware cutter command (GS V 66 0).',
                          value: printerForm.cut_paper,
                        },
                      ].map((row) => (
                        <div key={row.key} className="flex items-center justify-between gap-4 px-4 py-3.5">
                          <div>
                            <span className="text-xs font-bold text-[#1A1A1A]">{row.label}</span>
                            <p className="text-[11px] text-[#6B6B6B] mt-0.5">{row.desc}</p>
                          </div>
                          <SPToggle
                            checked={row.value}
                            label={row.label}
                            onChange={(v) =>
                              setPrinterForm((prev) => ({
                                ...prev,
                                [row.key]: v,
                              }))
                            }
                          />
                        </div>
                      ))}
                    </div>

                    {/* Bill Header, Footer & GSTIN */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className={spLabelClass}>Legal GSTIN Number</label>
                        <input
                          type="text"
                          value={printerForm.gstin || ''}
                          onChange={(e) => setPrinterForm((prev) => ({ ...prev, gstin: e.target.value }))}
                          placeholder="29AABCT1337C1Z0"
                          className={spInputClass}
                        />
                      </div>

                      <div>
                        <label className={spLabelClass}>Custom Receipt Header Note</label>
                        <input
                          type="text"
                          value={printerForm.receipt_header || ''}
                          onChange={(e) =>
                            setPrinterForm((prev) => ({ ...prev, receipt_header: e.target.value }))
                          }
                          placeholder="Welcome to TSOS Cafe & Roastery"
                          className={spInputClass}
                        />
                      </div>

                      <div>
                        <label className={spLabelClass}>Custom Receipt Footer Note</label>
                        <input
                          type="text"
                          value={printerForm.receipt_footer || ''}
                          onChange={(e) =>
                            setPrinterForm((prev) => ({ ...prev, receipt_footer: e.target.value }))
                          }
                          placeholder="Thank you for dining with us! ✨"
                          className={spInputClass}
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="sp-cta w-full py-2.5 text-xs font-semibold"
                    >
                      Save Printer Configuration
                    </button>
                  </form>
                </div>
              )}

              {/* ===== 2. FEE ENGINE ===== */}
              {activeSettingsSection === 'fees' && (
                <div className="bg-white rounded-3xl border border-[#E3E7E0] p-6 shadow-xs space-y-4">
                  <div className="flex items-center gap-2.5 border-b border-[#E3E7E0] pb-3">
                    <div className="w-10 h-10 rounded-2xl sp-surface text-[#0F3D3E] flex items-center justify-center">
                      <Zap className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-[#1A1A1A]">
                        TSOS Zero-Subscription Fee Engine
                      </h3>
                      <p className="text-xs text-[#6B6B6B]">
                        Configured at ₹1 per order with zero upfront or monthly software commitments.
                      </p>
                    </div>
                  </div>

                  {savedSuccess && (
                    <div className="p-3 bg-[#E8F5EC] text-[#17803D] border border-[#B7DCC5] rounded-xl text-xs flex items-center gap-2">
                      <Check className="w-4 h-4 shrink-0" />
                      <span>Fee engine configuration saved successfully.</span>
                    </div>
                  )}

                  <form onSubmit={handleSaveFeeConfig} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className={spLabelClass}>Monthly Subscription Fee</label>
                        <div className="px-3 py-2 text-sm font-bold bg-[#F6F5F2] rounded-xl border border-[#E3E7E0] text-[#17803D]">
                          ₹0 / month (Lifetime Free)
                        </div>
                        <div className="text-[11px] text-[#6B8579] mt-1">
                          No hidden monthly software fees or rental contracts.
                        </div>
                      </div>

                      <div>
                        <label className={spLabelClass}>Per-Order Platform Fee (₹)</label>
                        <input
                          type="number"
                          min={0}
                          step={0.25}
                          value={perOrderFee}
                          onChange={(e) => setPerOrderFee(Number(e.target.value) || 0)}
                          className={spInputClass}
                        />
                        <div className="text-[11px] text-[#6B8579] mt-1">
                          Default is ₹1.00 per completed sale.
                        </div>
                      </div>
                    </div>

                    {/* Fee Payer */}
                    <div className="p-4 rounded-xl bg-[#F6F5F2] border border-[#E3E7E0] space-y-3">
                      <div className="text-xs font-semibold text-[#1A1A1A]">Who Pays the Platform Fee?</div>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => setFeePayer('cafe')}
                          className={`p-3 rounded-xl border text-left transition-all ${
                            feePayer === 'cafe'
                              ? 'border-[#B88E2F] bg-[#B88E2F]/5 ring-1 ring-[#B88E2F]'
                              : 'border-[#E3E7E0] bg-white hover:bg-[#F6F5F2]'
                          }`}
                        >
                          <div className="font-bold text-xs text-[#1A1A1A]">Absorbed by Cafe</div>
                          <div className="text-[11px] text-[#6B6B6B] mt-0.5">
                            Customer bill stays clean; ₹1 fee is absorbed as an operating expense.
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => setFeePayer('customer')}
                          className={`p-3 rounded-xl border text-left transition-all ${
                            feePayer === 'customer'
                              ? 'border-[#B88E2F] bg-[#B88E2F]/5 ring-1 ring-[#B88E2F]'
                              : 'border-[#E3E7E0] bg-white hover:bg-[#F6F5F2]'
                          }`}
                        >
                          <div className="font-bold text-xs text-[#1A1A1A]">Paid by Customer</div>
                          <div className="text-[11px] text-[#6B6B6B] mt-0.5">
                            +₹1 platform fee itemized directly on customer invoice/receipt.
                          </div>
                        </button>
                      </div>

                      {/* Auto-flip rule */}
                      <div className="pt-3 border-t border-[#E3E7E0]">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <span className="text-xs font-semibold text-[#1A1A1A]">
                              Enable Auto-Flip Fee Engine
                            </span>
                            <p className="text-[11px] text-[#6B6B6B] leading-relaxed mt-0.5">
                              Automatically switch fee payer from "Cafe" to "Customer" after a promotional trial period.
                            </p>
                          </div>
                          <SPToggle
                            checked={autoFlipEnabled}
                            label="Enable Auto-Flip Fee Engine"
                            onChange={(v) => setAutoFlipEnabled(v)}
                          />
                        </div>

                        {autoFlipEnabled && (
                          <div className="mt-3 flex items-center gap-3">
                            <span className="text-xs text-[#6B6B6B]">Flip threshold:</span>
                            <input
                              type="number"
                              min={10}
                              value={autoFlipThreshold}
                              onChange={(e) => setAutoFlipThreshold(Number(e.target.value) || 100)}
                              className="w-24 px-2 py-1 text-xs font-bold rounded-lg border border-[#E3E7E0] bg-white text-[#1A1A1A] focus:border-[#B88E2F] focus:ring-1 focus:ring-[#B88E2F]/30 focus:outline-none"
                            />
                            <span className="text-xs text-[#6B6B6B]">
                              orders ({feeConfig.period_order_count} of {autoFlipThreshold} completed)
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="sp-cta w-full py-2.5 text-xs font-semibold"
                    >
                      Save Fee Engine Settings
                    </button>
                  </form>
                </div>
              )}

              {/* ===== 3. STAFF ACCOUNTS ===== */}
              {activeSettingsSection === 'staff' && (
                <div className="bg-white rounded-3xl border border-[#E3E7E0] p-6 shadow-xs space-y-4">
                  <div className="flex items-center gap-2.5 border-b border-[#E3E7E0] pb-3">
                    <div className="w-10 h-10 rounded-2xl sp-surface text-[#0F3D3E] flex items-center justify-center">
                      <Users className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-[#1A1A1A]">Staff Accounts & Quick Role Switch</h3>
                      <p className="text-xs text-[#6B6B6B]">
                        Simulate role-based access for Owner, Cashier, and Kitchen staff
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {SEED_PROFILES.map((p) => {
                      const isCurrent = currentProfile.id === p.id;
                      return (
                        <div
                          key={p.id}
                          className={`p-3.5 rounded-xl border transition-all ${
                            isCurrent
                              ? 'border-[#0F3D3E] bg-[#F6F5F2] ring-1 ring-[#0F3D3E]'
                              : 'border-[#E3E7E0] bg-white hover:bg-[#F6F5F2]'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-bold text-xs capitalize text-[#1A1A1A]">{p.role}</span>
                            <span className="text-[10px] font-semibold bg-[#D9E2DD] text-[#0F3D3E] px-1.5 py-0.2 rounded-md">
                              PIN: {p.pin_code}
                            </span>
                          </div>
                          <div className="text-xs font-semibold text-[#1A1A1A]">{p.name}</div>
                          <div className="text-[11px] text-[#6B6B6B]">{p.email}</div>

                          <button
                            onClick={() => setCurrentProfile(p)}
                            disabled={isCurrent}
                            className={`w-full mt-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                              isCurrent
                                ? 'bg-[#0F3D3E] text-white cursor-default'
                                : 'bg-white border border-[#E3E7E0] hover:bg-[#F6F5F2] text-[#0F3D3E]'
                            }`}
                          >
                            {isCurrent ? 'Active User' : 'Switch to This Staff'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ===== 4. CAFE PROFILE ===== */}
              {activeSettingsSection === 'profile' && (
                <div className="bg-white rounded-3xl border border-[#E3E7E0] p-6 shadow-xs space-y-3">
                  <div className="flex items-center gap-2.5 border-b border-[#E3E7E0] pb-3">
                    <div className="w-10 h-10 rounded-2xl sp-surface text-[#0F3D3E] flex items-center justify-center">
                      <Building className="w-5 h-5" />
                    </div>
                    <h3 className="font-bold text-sm text-[#1A1A1A]">Cafe Location & Legal Profile</h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div>
                      <span className="text-[#6B6B6B]">Location Name:</span>
                      <div className="font-bold text-[#1A1A1A] text-sm">{location.name}</div>
                    </div>
                    <div>
                      <span className="text-[#6B6B6B]">Public Slug:</span>
                      <div className="font-bold text-[#B88E2F] hover:text-[#967221]">/storefront/{location.slug}</div>
                    </div>
                    <div>
                      <span className="text-[#6B6B6B]">Registered Address:</span>
                      <div className="text-[#1A1A1A]">{location.address}</div>
                    </div>
                    <div>
                      <span className="text-[#6B6B6B]">Official Phone:</span>
                      <div className="text-[#1A1A1A]">{location.phone}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* ===== 5. RESET DEMO ===== */}
              {activeSettingsSection === 'reset' && (
                <div className="p-5 bg-[#FEF2F2] rounded-3xl border border-[#F5C6C0] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h4 className="font-bold text-xs text-[#B42318]">Reset All Demo Data</h4>
                    <p className="text-[11px] text-[#B42318]/80 mt-0.5">
                      Restore default demo cafe items, initial coffee/tea inventory, sample orders, and tables.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      if (window.confirm('Reset all demo cafe data to initial factory state?')) {
                        resetToSeed();
                      }
                    }}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-[#F5C6C0] text-xs font-semibold text-[#B42318] hover:bg-[#FDE3E3] transition-colors shrink-0"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset Demo</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-[#F5F0EB] p-4 lg:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header & Quick Tour Trigger */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-black text-[#1C1917] tracking-tight flex items-center gap-2">
              <span>Cafe & Hardware Settings</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-[#E9E0D6] text-[#57534E] font-normal">
                Station #{location.id}
              </span>
            </h1>
            <p className="text-xs text-[#57534E] mt-0.5">
              Configure thermal bill printing, cash drawer kick, zero-subscription fee engine, and guidance mode.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={startTour}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-[#E9E0D6] text-xs font-bold text-[#1C1917] hover:bg-[#FFF9F2] shadow-2xs transition-colors"
            >
              <Sparkles className="w-4 h-4 text-[#F97316]" />
              <span>Launch Guided Tour</span>
            </button>
            <button
              type="button"
              onClick={toggleGuidanceMode}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-colors ${
                guidanceMode
                  ? 'bg-[#7C3AED] text-white shadow-2xs'
                  : 'bg-white text-[#57534E] border border-[#E9E0D6]'
              }`}
            >
              {guidanceMode ? 'Guidance ON' : 'Guidance OFF'}
            </button>
          </div>
        </div>

        {/* 1. THERMAL BILL & KOT PRINTER INTEGRATION */}
        <div className="bg-white rounded-3xl border border-[#E9E0D6] p-6 shadow-xs space-y-6">
          <div className="flex items-center justify-between border-b border-[#F5F0EB] pb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-[#FFF1E6] text-[#F97316] flex items-center justify-center">
                <Printer className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-[#1C1917] flex items-center gap-2">
                  <span>Thermal Receipt & KOT Printer Integration</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                    ESC/POS
                  </span>
                </h3>
                <p className="text-xs text-[#57534E]">
                  Connect 58mm or 80mm thermal receipt printers via Web Print, Network/LAN, Bluetooth, or USB.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleTestDrawerKick}
                className="px-3 py-1.5 rounded-xl border border-[#E9E0D6] bg-white text-xs font-semibold text-[#57534E] hover:bg-[#F5F0EB] flex items-center gap-1.5 shadow-2xs"
                title="Send test RJ11/RJ12 drawer kick pulse"
              >
                <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                <span>Test Drawer</span>
              </button>

              <button
                type="button"
                onClick={handleTestPrint}
                className="px-3.5 py-1.5 rounded-xl bg-[#1C1917] hover:bg-black text-white text-xs font-bold flex items-center gap-1.5 shadow-2xs"
              >
                <Printer className="w-3.5 h-3.5 text-[#F97316]" />
                <span>Diagnostic Test Print</span>
              </button>
            </div>
          </div>

          {testPrintFeedback && (
            <div className="p-3 bg-amber-50 text-amber-900 border border-amber-200 rounded-xl text-xs flex items-center gap-2 animate-in fade-in">
              <FileCheck2 className="w-4 h-4 text-amber-600 shrink-0" />
              <span>{testPrintFeedback}</span>
            </div>
          )}

          {printerSavedSuccess && (
            <div className="p-3 bg-emerald-50 text-emerald-900 border border-emerald-200 rounded-xl text-xs flex items-center gap-2 animate-in fade-in">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Printer settings saved successfully! Thermal bills will format according to your choices.</span>
            </div>
          )}

          <form onSubmit={handleSavePrinterConfig} className="space-y-5">
            {/* Connection Type */}
            <div>
              <label className="block text-xs font-bold text-[#1C1917] mb-2">
                Printer Connection Interface
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                {[
                  {
                    id: 'browser',
                    name: 'Browser / System Dialog',
                    icon: Printer,
                    desc: 'Zero drivers needed. Works across Chrome, Edge, and Windows print spools.',
                  },
                  {
                    id: 'network',
                    name: 'Network / LAN (TCP:9100)',
                    icon: Wifi,
                    desc: 'Direct socket to Ethernet or Wi-Fi thermal printer IP address.',
                  },
                  {
                    id: 'bluetooth',
                    name: 'Web Bluetooth (SPP)',
                    icon: Bluetooth,
                    desc: 'Direct wireless pairing with handheld mobile thermal printers.',
                  },
                  {
                    id: 'usb',
                    name: 'Web USB Direct',
                    icon: Usb,
                    desc: 'Direct raw ESC/POS byte streaming to desktop USB receipt printer.',
                  },
                ].map((conn) => {
                  const Icon = conn.icon;
                  const isSelected = printerForm.connection_type === conn.id;
                  return (
                    <button
                      key={conn.id}
                      type="button"
                      onClick={() =>
                        setPrinterForm((prev) => ({
                          ...prev,
                          connection_type: conn.id as any,
                        }))
                      }
                      className={`p-3.5 rounded-2xl border text-left transition-all ${
                        isSelected
                          ? 'border-[#F97316] bg-[#FFF9F2] ring-1 ring-[#F97316]'
                          : 'border-[#E9E0D6] bg-white hover:bg-[#FAFAFA]'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <Icon className={`w-4 h-4 ${isSelected ? 'text-[#F97316]' : 'text-[#57534E]'}`} />
                        {isSelected && <span className="w-2 h-2 rounded-full bg-[#F97316]" />}
                      </div>
                      <div className="font-bold text-xs text-[#1C1917]">{conn.name}</div>
                      <div className="text-[11px] text-[#57534E] mt-1 leading-snug">{conn.desc}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Paper Width & IP Details */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#57534E] mb-1">
                  Thermal Paper Roll Width
                </label>
                <div className="flex rounded-xl border border-[#E9E0D6] overflow-hidden bg-white p-1">
                  <button
                    type="button"
                    onClick={() =>
                      setPrinterForm((prev) => ({ ...prev, paper_width: '80mm' }))
                    }
                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                      printerForm.paper_width === '80mm'
                        ? 'bg-[#1C1917] text-white'
                        : 'text-[#57534E] hover:bg-[#F5F0EB]'
                    }`}
                  >
                    80mm (Standard Desktop)
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setPrinterForm((prev) => ({ ...prev, paper_width: '58mm' }))
                    }
                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                      printerForm.paper_width === '58mm'
                        ? 'bg-[#1C1917] text-white'
                        : 'text-[#57534E] hover:bg-[#F5F0EB]'
                    }`}
                  >
                    58mm (Compact Mobile)
                  </button>
                </div>
                <span className="text-[10px] text-[#A8A29E] mt-1 block">
                  {printerForm.paper_width === '80mm'
                    ? '48 characters per line'
                    : '32 characters per line'}
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#57534E] mb-1">
                  Printer IP / Host Address (Port 9100)
                </label>
                <input
                  type="text"
                  value={printerForm.ip_address || ''}
                  onChange={(e) =>
                    setPrinterForm((prev) => ({ ...prev, ip_address: e.target.value }))
                  }
                  placeholder="192.168.1.200"
                  className="w-full px-3 py-2 text-xs font-mono font-bold rounded-xl border border-[#E9E0D6] bg-white focus:border-[#F97316] focus:outline-hidden"
                />
                <span className="text-[10px] text-[#A8A29E] mt-1 block">
                  Used for Network thermal printers over Wi-Fi/LAN
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#57534E] mb-1">
                  Kitchen KOT Printer IP
                </label>
                <input
                  type="text"
                  value={printerForm.kot_printer_ip || ''}
                  onChange={(e) =>
                    setPrinterForm((prev) => ({ ...prev, kot_printer_ip: e.target.value }))
                  }
                  placeholder="192.168.1.201:9100"
                  className="w-full px-3 py-2 text-xs font-mono font-bold rounded-xl border border-[#E9E0D6] bg-white focus:border-[#F97316] focus:outline-hidden"
                />
                <span className="text-[10px] text-[#A8A29E] mt-1 block">
                  Dedicated ticket printer stationed in barista/kitchen
                </span>
              </div>
            </div>

            {/* Automation Toggles */}
            <div className="p-4 rounded-2xl bg-[#FFF9F2] border border-[#E9E0D6] grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={printerForm.auto_print_receipt}
                  onChange={(e) =>
                    setPrinterForm((prev) => ({
                      ...prev,
                      auto_print_receipt: e.target.checked,
                    }))
                  }
                  className="mt-0.5 rounded-sm text-[#F97316] focus:ring-0"
                />
                <div>
                  <span className="text-xs font-bold text-[#1C1917]">
                    Auto-Print Customer Bill on Payment
                  </span>
                  <p className="text-[11px] text-[#57534E]">
                    Instantly triggers receipt printer when bill is settled via UPI, Cash, or Card.
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={printerForm.auto_print_kot}
                  onChange={(e) =>
                    setPrinterForm((prev) => ({
                      ...prev,
                      auto_print_kot: e.target.checked,
                    }))
                  }
                  className="mt-0.5 rounded-sm text-[#F97316] focus:ring-0"
                />
                <div>
                  <span className="text-xs font-bold text-[#1C1917]">
                    Auto-Print Kitchen Order Ticket (KOT)
                  </span>
                  <p className="text-[11px] text-[#57534E]">
                    Sends ticket to kitchen printer immediately upon cart confirmation.
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={printerForm.open_cash_drawer}
                  onChange={(e) =>
                    setPrinterForm((prev) => ({
                      ...prev,
                      open_cash_drawer: e.target.checked,
                    }))
                  }
                  className="mt-0.5 rounded-sm text-[#F97316] focus:ring-0"
                />
                <div>
                  <span className="text-xs font-bold text-[#1C1917]">
                    Auto-Kick Cash Drawer on Cash Sale
                  </span>
                  <p className="text-[11px] text-[#57534E]">
                    Sends ESC/POS pulse (ESC p 0 25 250) to RJ11/RJ12 drawer port.
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={printerForm.cut_paper}
                  onChange={(e) =>
                    setPrinterForm((prev) => ({
                      ...prev,
                      cut_paper: e.target.checked,
                    }))
                  }
                  className="mt-0.5 rounded-sm text-[#F97316] focus:ring-0"
                />
                <div>
                  <span className="text-xs font-bold text-[#1C1917]">
                    Automatic Paper Guillotine Cut
                  </span>
                  <p className="text-[11px] text-[#57534E]">
                    Feeds 3 blank lines and triggers hardware cutter command (GS V 66 0).
                  </p>
                </div>
              </label>
            </div>

            {/* Bill Header, Footer & GSTIN */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#57534E] mb-1">
                  Legal GSTIN Number
                </label>
                <input
                  type="text"
                  value={printerForm.gstin || ''}
                  onChange={(e) =>
                    setPrinterForm((prev) => ({ ...prev, gstin: e.target.value }))
                  }
                  placeholder="29AABCT1337C1Z0"
                  className="w-full px-3 py-2 text-xs font-mono font-bold rounded-xl border border-[#E9E0D6] bg-white focus:border-[#F97316] focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#57534E] mb-1">
                  Custom Receipt Header Note
                </label>
                <input
                  type="text"
                  value={printerForm.receipt_header || ''}
                  onChange={(e) =>
                    setPrinterForm((prev) => ({ ...prev, receipt_header: e.target.value }))
                  }
                  placeholder="Welcome to TSOS Cafe & Roastery"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-[#E9E0D6] bg-white focus:border-[#F97316] focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#57534E] mb-1">
                  Custom Receipt Footer Note
                </label>
                <input
                  type="text"
                  value={printerForm.receipt_footer || ''}
                  onChange={(e) =>
                    setPrinterForm((prev) => ({ ...prev, receipt_footer: e.target.value }))
                  }
                  placeholder="Thank you for dining with us! ✨"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-[#E9E0D6] bg-white focus:border-[#F97316] focus:outline-hidden"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-[#F97316] hover:bg-[#EA580C] text-white text-xs font-bold shadow-xs transition-colors"
              >
                Save Printer Configuration
              </button>
            </div>
          </form>
        </div>

        {/* 3. Zero-Subscription Fee Engine Settings */}
        <div className="bg-white rounded-3xl border border-[#E9E0D6] p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-[#F5F0EB] pb-3">
            <Zap className="w-5 h-5 text-[#F97316]" />
            <div>
              <h3 className="font-bold text-sm text-[#1C1917]">
                TSOS Zero-Subscription Fee Engine
              </h3>
              <p className="text-xs text-[#57534E]">
                Configured at ₹1 per order with zero upfront or monthly software commitments.
              </p>
            </div>
          </div>

          {savedSuccess && (
            <div className="p-3 bg-emerald-50 text-emerald-900 border border-emerald-200 rounded-xl text-xs flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600" />
              <span>Fee engine configuration saved successfully.</span>
            </div>
          )}

          <form onSubmit={handleSaveFeeConfig} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#57534E] mb-1">
                  Monthly Subscription Fee
                </label>
                <div className="px-3 py-2 text-sm font-mono font-bold bg-[#F5F0EB] rounded-xl border border-[#E9E0D6] text-[#17803D]">
                  ₹0 / month (Lifetime Free)
                </div>
                <div className="text-[11px] text-[#A8A29E] mt-1">
                  No hidden monthly software fees or rental contracts.
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#57534E] mb-1">
                  Per-Order Platform Fee (₹)
                </label>
                <input
                  type="number"
                  min={0}
                  step={0.25}
                  value={perOrderFee}
                  onChange={(e) => setPerOrderFee(Number(e.target.value) || 0)}
                  className="w-full px-3 py-2 text-sm font-mono font-bold rounded-xl border border-[#E9E0D6] bg-white focus:border-[#F97316] focus:outline-hidden"
                />
                <div className="text-[11px] text-[#A8A29E] mt-1">
                  Default is ₹1.00 per completed sale.
                </div>
              </div>
            </div>

            {/* Fee Payer Toggle */}
            <div className="p-4 rounded-xl bg-[#FFF9F2] border border-[#E9E0D6] space-y-3">
              <div className="text-xs font-semibold text-[#1C1917]">Who Pays the Platform Fee?</div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setFeePayer('cafe')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    feePayer === 'cafe'
                      ? 'border-[#F97316] bg-[#FFF1E6] ring-1 ring-[#F97316]'
                      : 'border-[#E9E0D6] bg-white hover:bg-[#F5F0EB]'
                  }`}
                >
                  <div className="font-bold text-xs text-[#1C1917]">Absorbed by Cafe</div>
                  <div className="text-[11px] text-[#57534E] mt-0.5">
                    Customer bill stays clean; ₹1 fee is absorbed as an operating expense.
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setFeePayer('customer')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    feePayer === 'customer'
                      ? 'border-[#F97316] bg-[#FFF1E6] ring-1 ring-[#F97316]'
                      : 'border-[#E9E0D6] bg-white hover:bg-[#F5F0EB]'
                  }`}
                >
                  <div className="font-bold text-xs text-[#1C1917]">Paid by Customer</div>
                  <div className="text-[11px] text-[#57534E] mt-0.5">
                    +₹1 platform fee itemized directly on customer invoice/receipt.
                  </div>
                </button>
              </div>

              {/* Auto-flip rule */}
              <div className="pt-2 border-t border-[#E9E0D6]">
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoFlipEnabled}
                    onChange={(e) => setAutoFlipEnabled(e.target.checked)}
                    className="mt-0.5 rounded-sm text-[#F97316] focus:ring-0"
                  />
                  <div>
                    <span className="text-xs font-semibold text-[#1C1917]">
                      Enable Auto-Flip Fee Engine
                    </span>
                    <p className="text-[11px] text-[#57534E] leading-relaxed">
                      Automatically switch fee payer from "Cafe" to "Customer" after a promotional trial period.
                    </p>
                  </div>
                </label>

                {autoFlipEnabled && (
                  <div className="mt-3 flex items-center gap-3 pl-5">
                    <span className="text-xs text-[#57534E]">Flip threshold:</span>
                    <input
                      type="number"
                      min={10}
                      value={autoFlipThreshold}
                      onChange={(e) => setAutoFlipThreshold(Number(e.target.value) || 100)}
                      className="w-24 px-2 py-1 text-xs font-mono font-bold rounded-lg border border-[#E9E0D6]"
                    />
                    <span className="text-xs text-[#57534E]">
                      orders ({feeConfig.period_order_count} of {autoFlipThreshold} completed)
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-[#F97316] hover:bg-[#EA580C] text-white text-xs font-semibold shadow-xs"
              >
                Save Fee Engine Settings
              </button>
            </div>
          </form>
        </div>

        {/* 3. Staff Accounts & Role Switcher */}
        <div className="bg-white rounded-3xl border border-[#E9E0D6] p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-[#F5F0EB] pb-3">
            <Users className="w-5 h-5 text-[#57534E]" />
            <div>
              <h3 className="font-bold text-sm text-[#1C1917]">Staff Accounts & Quick Role Switch</h3>
              <p className="text-xs text-[#57534E]">
                Simulate role-based access for Owner, Cashier, and Kitchen staff
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {SEED_PROFILES.map((p) => {
              const isCurrent = currentProfile.id === p.id;
              return (
                <div
                  key={p.id}
                  className={`p-3.5 rounded-xl border transition-all ${
                    isCurrent
                      ? 'border-[#1C1917] bg-[#F5F0EB] ring-1 ring-[#1C1917]'
                      : 'border-[#E9E0D6] bg-white hover:bg-[#FAFAFA]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-xs capitalize text-[#1C1917]">{p.role}</span>
                    <span className="text-[10px] font-mono bg-[#E9E0D6] px-1.5 py-0.2 rounded-md">
                      PIN: {p.pin_code}
                    </span>
                  </div>
                  <div className="text-xs font-semibold text-[#1C1917]">{p.name}</div>
                  <div className="text-[11px] text-[#57534E] font-mono">{p.email}</div>

                  <button
                    onClick={() => setCurrentProfile(p)}
                    disabled={isCurrent}
                    className={`w-full mt-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      isCurrent
                        ? 'bg-[#1C1917] text-white cursor-default'
                        : 'bg-white border border-[#E9E0D6] hover:bg-[#E9E0D6] text-[#57534E]'
                    }`}
                  >
                    {isCurrent ? 'Active User' : 'Switch to This Staff'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* 4. Location & Cafe Profile */}
        <div className="bg-white rounded-3xl border border-[#E9E0D6] p-6 shadow-xs space-y-3">
          <div className="flex items-center gap-2 border-b border-[#F5F0EB] pb-3">
            <Building className="w-5 h-5 text-[#57534E]" />
            <h3 className="font-bold text-sm text-[#1C1917]">Cafe Location & Legal Profile</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-[#57534E]">Location Name:</span>
              <div className="font-bold text-[#1C1917] text-sm">{location.name}</div>
            </div>
            <div>
              <span className="text-[#57534E]">Public Slug:</span>
              <div className="font-mono font-bold text-[#F97316]">/storefront/{location.slug}</div>
            </div>
            <div>
              <span className="text-[#57534E]">Registered Address:</span>
              <div className="text-[#1C1917]">{location.address}</div>
            </div>
            <div>
              <span className="text-[#57534E]">Official Phone:</span>
              <div className="font-mono text-[#1C1917]">{location.phone}</div>
            </div>
          </div>
        </div>

        {/* 5. Reset Demo Data */}
        <div className="p-5 bg-[#FEF2F2] rounded-3xl border border-[#FECACA] flex items-center justify-between">
          <div>
            <h4 className="font-bold text-xs text-[#B42318]">Reset All Demo Data</h4>
            <p className="text-[11px] text-[#B42318]/80">
              Restore default demo cafe items, initial coffee/tea inventory, sample orders, and tables.
            </p>
          </div>
          <button
            onClick={() => {
              if (window.confirm('Reset all demo cafe data to initial factory state?')) {
                resetToSeed();
              }
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-[#FECACA] text-xs font-semibold text-[#B42318] hover:bg-[#FEE2E2]"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Demo</span>
          </button>
        </div>
      </div>
    </div>
  );
};
