import React, { useState } from 'react';
import { provisionTenant, ProvisionTenantPayload } from '../../lib/supabase';
import { useTsosStore } from '../../lib/store';
import {
  Coffee,
  Sparkles,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Building2,
  DollarSign,
  QrCode,
  ArrowRight,
  ShieldCheck,
  X,
} from 'lucide-react';

interface CafeOnboardingWizardProps {
  initialOwnerEmail?: string;
  initialOwnerName?: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newTenantSlug: string) => void;
}

export const CafeOnboardingWizard: React.FC<CafeOnboardingWizardProps> = ({
  initialOwnerEmail = '',
  initialOwnerName = '',
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { addTenant, switchTenantScope } = useTsosStore();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [cafeName, setCafeName] = useState('');
  const [outletName, setOutletName] = useState('Main Branch');
  const [businessType, setBusinessType] = useState<'cafe' | 'bakery' | 'restaurant' | 'qsr'>('cafe');
  const [city, setCity] = useState('Bengaluru');
  const [state, setState] = useState('Karnataka');
  const [currency, setCurrency] = useState<'INR' | 'USD'>('INR');
  const [upiId, setUpiId] = useState('');
  const [gstNumber, setGstNumber] = useState('');
  const [taxRatePct, setTaxRatePct] = useState(5);
  const [tableCount, setTableCount] = useState(10);
  const [menuTemplate, setMenuTemplate] = useState<'coffee_bakery' | 'casual_dining' | 'empty'>('coffee_bakery');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'my-cafe';
  };

  const handleFinish = async () => {
    setLoading(true);
    setError(null);

    const slug = generateSlug(cafeName || 'Artisan Cafe');
    const computedUpi = upiId.trim() || `${slug}@okaxis`;

    const payload: ProvisionTenantPayload = {
      business: {
        name: cafeName.trim() || 'My Artisan Cafe',
        legal_name: `${cafeName.trim() || 'My Artisan Cafe'} Private Limited`,
        display_name: cafeName.trim() || 'My Artisan Cafe',
        slug,
        business_type: businessType,
        owner_name: initialOwnerName || 'Cafe Owner',
        owner_email: initialOwnerEmail || 'owner@tsos.local',
        owner_phone: '+91 98765 43210',
        owner_pin: '1234',
        upi_id: computedUpi,
        gst_number: gstNumber.trim() || '29AAAAA0000A1Z5',
        address: `${outletName}, Indiranagar 100ft Road`,
        city,
        state,
        postal_code: '560038',
        country: currency === 'INR' ? 'India' : 'United States',
      },
      subscription: {
        plan_id: 'pro',
        billing_cycle: 'monthly',
        monthly_price: currency === 'INR' ? 1499 : 49,
        discount_pct: 0,
        final_monthly_rate: currency === 'INR' ? 1499 : 49,
        trial_days: 14,
        deal_notes: '14-Day Free Production Trial',
      },
      config: {
        initial_tables_count: tableCount,
        menu_template: menuTemplate,
        enable_table_qr: true,
        enable_anti_tamper: true,
      },
      actorEmail: initialOwnerEmail || 'onboarding@tsos.local',
    };

    try {
      const res = await provisionTenant(payload);
      if (res.success && res.tenantBusiness) {
        addTenant(res.tenantBusiness);
        switchTenantScope(res.tenantBusiness.slug);
        onSuccess(res.tenantBusiness.slug);
        onClose();
      } else {
        setError(res.error || 'Failed to complete cafe provisioning.');
      }
    } catch (err: any) {
      setError(err.message || 'Unexpected onboarding error.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-xl w-full border border-[#E9E0D6] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-[#1C1917] via-[#292524] to-[#1C1917] text-white flex items-center justify-between border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#F97316] text-white flex items-center justify-center shadow-md">
              <Coffee className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] font-bold text-[#F97316] uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Cafe Onboarding Wizard</span>
              </div>
              <h2 className="text-base font-bold text-white mt-0.5">
                Launch Your Cloud POS & Kitchen in 2 Minutes
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Steps Breadcrumb */}
        <div className="grid grid-cols-3 border-b border-[#E9E0D6] bg-[#FFF9F2] text-xs font-semibold">
          <div
            className={`py-2.5 text-center flex items-center justify-center gap-1.5 border-b-2 ${
              step === 1 ? 'border-[#F97316] text-[#F97316] bg-white' : 'border-transparent text-[#57534E]'
            }`}
          >
            <span className="w-5 h-5 rounded-full bg-[#F97316]/10 text-[#F97316] flex items-center justify-center text-[10px] font-bold">
              1
            </span>
            <span>Cafe Profile</span>
          </div>
          <div
            className={`py-2.5 text-center flex items-center justify-center gap-1.5 border-b-2 ${
              step === 2 ? 'border-[#F97316] text-[#F97316] bg-white' : 'border-transparent text-[#57534E]'
            }`}
          >
            <span className="w-5 h-5 rounded-full bg-[#F97316]/10 text-[#F97316] flex items-center justify-center text-[10px] font-bold">
              2
            </span>
            <span>Tax & UPI VPA</span>
          </div>
          <div
            className={`py-2.5 text-center flex items-center justify-center gap-1.5 border-b-2 ${
              step === 3 ? 'border-[#F97316] text-[#F97316] bg-white' : 'border-transparent text-[#57534E]'
            }`}
          >
            <span className="w-5 h-5 rounded-full bg-[#F97316]/10 text-[#F97316] flex items-center justify-center text-[10px] font-bold">
              3
            </span>
            <span>Tables & Starter Menu</span>
          </div>
        </div>

        {/* Form Body */}
        <div className="p-6 overflow-y-auto max-h-[60vh] space-y-4 text-xs">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block font-semibold text-[#57534E] uppercase tracking-wider mb-1">
                  Cafe / Restaurant Name *
                </label>
                <input
                  type="text"
                  required
                  value={cafeName}
                  onChange={(e) => setCafeName(e.target.value)}
                  placeholder="e.g. Copper Kettle Roasters"
                  className="w-full px-3 py-2 text-sm rounded-xl border border-[#E9E0D6] bg-[#FFF9F2] focus:bg-white focus:border-[#F97316] focus:outline-none"
                />
                <p className="text-[10px] text-[#A8A29E] mt-1">
                  URL slug will be: <code>/{generateSlug(cafeName || 'my-cafe')}</code>
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#57534E] uppercase tracking-wider mb-1">
                    First Outlet Name
                  </label>
                  <input
                    type="text"
                    value={outletName}
                    onChange={(e) => setOutletName(e.target.value)}
                    placeholder="e.g. Indiranagar Flagship"
                    className="w-full px-3 py-2 text-sm rounded-xl border border-[#E9E0D6] bg-[#FFF9F2] focus:bg-white focus:border-[#F97316] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#57534E] uppercase tracking-wider mb-1">
                    Business Type
                  </label>
                  <select
                    value={businessType}
                    onChange={(e) => setBusinessType(e.target.value as any)}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-[#E9E0D6] bg-[#FFF9F2] focus:bg-white focus:border-[#F97316] focus:outline-none cursor-pointer"
                  >
                    <option value="cafe">Specialty Cafe & Roastery</option>
                    <option value="bakery">Artisan Bakery & Patisserie</option>
                    <option value="restaurant">Casual Dine-in Restaurant</option>
                    <option value="qsr">Quick Service (QSR) / Takeaway</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#57534E] uppercase tracking-wider mb-1">
                    City
                  </label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-[#E9E0D6] bg-[#FFF9F2] focus:bg-white focus:border-[#F97316] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#57534E] uppercase tracking-wider mb-1">
                    State
                  </label>
                  <input
                    type="text"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-[#E9E0D6] bg-[#FFF9F2] focus:bg-white focus:border-[#F97316] focus:outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#57534E] uppercase tracking-wider mb-1">
                    Currency
                  </label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value as any)}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-[#E9E0D6] bg-[#FFF9F2] focus:bg-white focus:border-[#F97316] focus:outline-none cursor-pointer"
                  >
                    <option value="INR">Indian Rupee (₹ INR)</option>
                    <option value="USD">US Dollar ($ USD)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-[#57534E] uppercase tracking-wider mb-1">
                    Standard GST / Tax Rate (%)
                  </label>
                  <input
                    type="number"
                    value={taxRatePct}
                    onChange={(e) => setTaxRatePct(Number(e.target.value))}
                    min={0}
                    max={28}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-[#E9E0D6] bg-[#FFF9F2] focus:bg-white focus:border-[#F97316] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#57534E] uppercase tracking-wider mb-1">
                  UPI VPA / Merchant ID (For Instant QR Tenders)
                </label>
                <input
                  type="text"
                  value={upiId}
                  onChange={(e) => setUpiId(e.target.value)}
                  placeholder="e.g. coffeehouse@hdfcbank"
                  className="w-full px-3 py-2 text-sm rounded-xl border border-[#E9E0D6] bg-[#FFF9F2] focus:bg-white focus:border-[#F97316] focus:outline-none"
                />
                <p className="text-[10px] text-[#A8A29E] mt-1">
                  Generates dynamic dynamic UPI QR codes on POS right tender panel and customer bills.
                </p>
              </div>

              <div>
                <label className="block font-semibold text-[#57534E] uppercase tracking-wider mb-1">
                  GSTIN / Tax Registration (Optional)
                </label>
                <input
                  type="text"
                  value={gstNumber}
                  onChange={(e) => setGstNumber(e.target.value)}
                  placeholder="e.g. 29AAAAA0000A1Z5"
                  className="w-full px-3 py-2 text-sm rounded-xl border border-[#E9E0D6] bg-[#FFF9F2] focus:bg-white focus:border-[#F97316] focus:outline-none uppercase font-mono"
                />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div>
                <label className="block font-semibold text-[#57534E] uppercase tracking-wider mb-1">
                  Initial Dining Tables Count
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={2}
                    max={30}
                    value={tableCount}
                    onChange={(e) => setTableCount(Number(e.target.value))}
                    className="flex-1 accent-[#F97316]"
                  />
                  <span className="font-mono font-bold text-sm bg-[#FFF1E6] text-[#F97316] px-3 py-1 rounded-lg">
                    {tableCount} Tables
                  </span>
                </div>
                <p className="text-[10px] text-[#A8A29E] mt-1">
                  Each table receives a secure, tamper-proof QR token for customer self-ordering.
                </p>
              </div>

              <div>
                <label className="block font-semibold text-[#57534E] uppercase tracking-wider mb-1">
                  Preload Menu Catalog Template
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setMenuTemplate('coffee_bakery')}
                    className={`p-3 rounded-2xl border text-left transition-all ${
                      menuTemplate === 'coffee_bakery'
                        ? 'border-[#F97316] bg-[#FFF1E6] text-[#1C1917]'
                        : 'border-[#E9E0D6] bg-white text-[#57534E]'
                    }`}
                  >
                    <div className="font-bold text-xs">Coffee & Bakery</div>
                    <div className="text-[10px] text-[#A8A29E] mt-0.5">Espressos, croissants, pastries, sourdough</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMenuTemplate('casual_dining')}
                    className={`p-3 rounded-2xl border text-left transition-all ${
                      menuTemplate === 'casual_dining'
                        ? 'border-[#F97316] bg-[#FFF1E6] text-[#1C1917]'
                        : 'border-[#E9E0D6] bg-white text-[#57534E]'
                    }`}
                  >
                    <div className="font-bold text-xs">Casual Dining</div>
                    <div className="text-[10px] text-[#A8A29E] mt-0.5">Pizzas, burgers, starters, bowls & coolers</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMenuTemplate('empty')}
                    className={`p-3 rounded-2xl border text-left transition-all ${
                      menuTemplate === 'empty'
                        ? 'border-[#F97316] bg-[#FFF1E6] text-[#1C1917]'
                        : 'border-[#E9E0D6] bg-white text-[#57534E]'
                    }`}
                  >
                    <div className="font-bold text-xs">Blank Catalog</div>
                    <div className="text-[10px] text-[#A8A29E] mt-0.5">Add your own categories and dishes manually</div>
                  </button>
                </div>
              </div>

              <div className="p-3 bg-[#F0FDF4] border border-[#BBF7D0] text-[#166534] rounded-2xl flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-[#16A34A]" />
                <div className="text-[11px] leading-relaxed">
                  <strong>Production Isolation Active:</strong> All your orders, tables, sales, and inventory items will be strictly isolated in Supabase under your unique tenant ID.
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="p-4 bg-[#FFF9F2] border-t border-[#E9E0D6] flex items-center justify-between">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep((s) => (s - 1) as any)}
              className="px-4 py-2 rounded-xl border border-[#E9E0D6] bg-white text-xs font-semibold text-[#57534E] hover:bg-[#F5F0EB]"
            >
              Previous
            </button>
          ) : (
            <div />
          )}

          {step < 3 ? (
            <button
              type="button"
              onClick={() => {
                if (step === 1 && !cafeName.trim()) {
                  setError('Please specify your cafe or restaurant name.');
                  return;
                }
                setError(null);
                setStep((s) => (s + 1) as any);
              }}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#F97316] hover:bg-[#EA580C] text-white text-xs font-bold shadow-md transition-all"
            >
              <span>Continue</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              disabled={loading}
              onClick={handleFinish}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#1C1917] hover:bg-black text-white text-xs font-bold shadow-md transition-all disabled:opacity-50"
            >
              {loading ? (
                <span>Provisioning Supabase Workspace...</span>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 text-[#F97316]" />
                  <span>Launch Cafe POS & Kitchen</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
