import React, { useState } from 'react';
import { useTsosStore } from '../../lib/store';
import { SAAS_PLANS } from '../../data/saasSeedData';
import { TenantBusiness, SubscriptionPlanId, BillingCycle } from '../../types';
import { authService } from '../../lib/authService';
import {
  Building2,
  User,
  FileText,
  MapPin,
  CreditCard,
  Sparkles,
  Sliders,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Store,
  ShieldCheck,
  Copy,
  ExternalLink,
  QrCode,
  Loader2,
  Cloud,
  KeyRound,
} from 'lucide-react';
import { provisionTenant, isSupabaseConfigured } from '../../lib/supabase';

interface WizardState {
  // Step 1: Business Information
  name: string;
  legal_name: string;
  display_name: string;
  business_type: 'cafe' | 'restaurant' | 'quick_service' | 'bakery' | 'brewery' | 'cloud_kitchen';
  slug: string;

  // Step 2: Owner Account
  owner_name: string;
  owner_email: string;
  owner_phone: string;
  owner_pin: string;

  // Step 3: Tax & KYC
  gst_number: string;
  pan_number: string;
  fssai_number: string;

  // Step 4: Location
  address: string;
  city: string;
  state: string;
  country: string;
  postal_code: string;

  // Step 5: Payment & Settlement
  upi_id: string;
  bank_account: string;
  ifsc_code: string;

  // Step 6: Subscription & Deals
  plan_id: SubscriptionPlanId;
  trial_days: number;
  billing_cycle: BillingCycle;
  discount_pct: number;
  deal_notes: string;

  // Step 7: Initial Configuration
  initial_tables_count: number;
  menu_template: 'coffee_bakery' | 'casual_dining' | 'empty';
  enable_table_qr: boolean;
  enable_anti_tamper: boolean;
}

const INITIAL_WIZARD_STATE: WizardState = {
  name: '',
  legal_name: '',
  display_name: '',
  business_type: 'cafe',
  slug: '',
  owner_name: '',
  owner_email: '',
  owner_phone: '',
  owner_pin: '1234',
  gst_number: '',
  pan_number: '',
  fssai_number: '',
  address: '',
  city: 'Bengaluru',
  state: 'Karnataka',
  country: 'India',
  postal_code: '',
  upi_id: '',
  bank_account: '',
  ifsc_code: '',
  plan_id: 'growth',
  trial_days: 14,
  billing_cycle: 'monthly',
  discount_pct: 0,
  deal_notes: '',
  initial_tables_count: 10,
  menu_template: 'coffee_bakery',
  enable_table_qr: true,
  enable_anti_tamper: true,
};

export const ProvisioningWizard: React.FC = () => {
  const { addTenantBusiness, setActiveSuperAdminTab, setActiveSurface } = useTsosStore();

  const [currentStep, setCurrentStep] = useState<number>(1);
  const [form, setForm] = useState<WizardState>(INITIAL_WIZARD_STATE);
  const [createdTenant, setCreatedTenant] = useState<TenantBusiness | null>(null);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [isProvisioning, setIsProvisioning] = useState<boolean>(false);
  const [provisionMode, setProvisionMode] = useState<'supabase' | 'offline_fallback'>('offline_fallback');
  const [generatedOwnerPassword, setGeneratedOwnerPassword] = useState<string>('');

  const updateField = (field: keyof WizardState, value: any) => {
    setForm((prev) => {
      const updated = { ...prev, [field]: value };
      // Auto slug derivation from business name if user hasn't custom edited slug yet
      if (field === 'name' && (!prev.slug || prev.slug === prev.name.toLowerCase().replace(/[^a-z0-9]/g, ''))) {
        updated.slug = value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      }
      if (field === 'name' && !prev.display_name) {
        updated.display_name = value;
      }
      if (field === 'name' && !prev.legal_name) {
        updated.legal_name = `${value} LLP`;
      }
      return updated;
    });
  };

  const selectedPlan = SAAS_PLANS.find((p) => p.id === form.plan_id) || SAAS_PLANS[1];
  const finalMonthlyRate = Math.round(selectedPlan.monthly_price * (1 - form.discount_pct / 100));

  const steps = [
    { num: 1, title: 'Business Info', icon: Building2 },
    { num: 2, title: 'Owner Account', icon: User },
    { num: 3, title: 'Tax & KYC', icon: FileText },
    { num: 4, title: 'Location', icon: MapPin },
    { num: 5, title: 'Settlement & UPI', icon: CreditCard },
    { num: 6, title: 'Subscription & Deals', icon: Sparkles },
    { num: 7, title: 'Initial Setup', icon: Sliders },
    { num: 8, title: 'Review & Provision', icon: CheckCircle2 },
  ];

  const handleNext = () => {
    if (currentStep < 8) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleExecuteProvisioning = async () => {
    setIsProvisioning(true);
    try {
      // v4.0.0: the wizard creates the business OWNER's login account. A strong
      // temporary password is generated here (shown + copyable on the success
      // screen) and registered in the local credential registry so the owner can
      // sign in immediately; when cloud auth is active the same account is pushed
      // to Supabase Auth (best-effort — the dashboard fallback is documented in
      // docs/CREDENTIALS.md).
      const ownerPassword = `tsos-${Math.random().toString(36).slice(2, 8)}${Math.floor(Math.random() * 90 + 10)}`;
      setGeneratedOwnerPassword(ownerPassword);
      const ownerName = form.owner_name || 'Admin';
      const ownerEmail = form.owner_email || 'owner@tsos.dev';
      await authService.signUp(ownerEmail, ownerPassword, ownerName, 'owner', {
        slug: form.slug || 'cafe',
        name: form.name || 'New Cafe',
      });

      const result = await provisionTenant({
        business: {
          name: form.name || 'New Cafe',
          legal_name: form.legal_name || form.name || 'New Cafe',
          display_name: form.display_name || form.name || 'New Cafe',
          slug: form.slug || 'cafe',
          business_type: form.business_type,
          owner_name: ownerName,
          owner_email: ownerEmail,
          owner_phone: form.owner_phone || '+91 98000 00000',
          owner_pin: form.owner_pin || '1234',
          gst_number: form.gst_number || undefined,
          pan_number: form.pan_number || undefined,
          fssai_number: form.fssai_number || undefined,
          upi_id: form.upi_id || `${form.slug}@upi`,
          address: form.address || 'Commercial Hub, Main Road',
          city: form.city || 'Bengaluru',
          state: form.state || 'Karnataka',
          postal_code: form.postal_code || '560001',
          country: form.country || 'India',
        },
        subscription: {
          plan_id: form.plan_id,
          billing_cycle: form.billing_cycle,
          monthly_price: selectedPlan.monthly_price,
          discount_pct: form.discount_pct,
          final_monthly_rate: finalMonthlyRate,
          trial_days: form.trial_days,
          deal_notes: form.deal_notes || undefined,
        },
        config: {
          initial_tables_count: form.initial_tables_count || 10,
          menu_template: form.menu_template,
          enable_table_qr: form.enable_table_qr,
          enable_anti_tamper: form.enable_anti_tamper,
        },
        actorEmail: 'admin@tablesideordering.com',
      });

      addTenantBusiness(result.tenantBusiness);
      setProvisionMode(result.mode);
      setCreatedTenant(result.tenantBusiness);
    } catch (err) {
      console.error('Failed to execute provisioning:', err);
    } finally {
      setIsProvisioning(false);
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedUrl(key);
    setTimeout(() => setCopiedUrl(null), 2000);
  };

  // SUCCESS SCREEN
  if (createdTenant) {
    const baseUrl = 'https://tablesideordering-web.vercel.app';
    const posUrl = `${baseUrl}/${createdTenant.slug}/pos`;
    const tablesUrl = `${baseUrl}/${createdTenant.slug}/tables`;
    const qrUrl = `${baseUrl}/${createdTenant.slug}/t1?token=8f9a2c3e1b74`;

    return (
      <div className="max-w-3xl mx-auto bg-white border border-[#E9E0D6] rounded-2xl p-8 shadow-md text-center space-y-6 animate-in fade-in zoom-in duration-200">
        <div className="w-16 h-16 rounded-full bg-[#DCFCE7] text-[#16A34A] flex items-center justify-center mx-auto shadow-inner">
          <CheckCircle2 className="w-10 h-10" />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-center gap-2">
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-[#FAF5FF] text-[#7C3AED] border border-[#E9D5FF]">
              Tenant Provisioned Successfully
            </span>
            {provisionMode === 'supabase' ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#DCFCE7] text-[#16A34A] border border-[#BBF7D0]">
                <ShieldCheck className="w-3 h-3" />
                Supabase Cloud & RLS Active
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#FEF3C7] text-[#D97706] border border-[#FDE68A]">
                <Cloud className="w-3 h-3" />
                Offline-Resilient Local State (Demo)
              </span>
            )}
          </div>
          <h2 className="text-2xl font-bold text-[#1C1917] mt-2">
            Welcome, {createdTenant.name}!
          </h2>
          <p className="text-sm text-[#78716C] max-w-lg mx-auto mt-1">
            The business profile, location record, owner account, and SaaS subscription ({selectedPlan.name} at ₹{finalMonthlyRate}/mo) have been provisioned in the multi-tenant database.
          </p>
        </div>

        {/* Credentials & Scoped URLs Summary */}
        <div className="bg-[#FAF6F0] border border-[#E9E0D6] rounded-xl p-5 text-left space-y-3 text-xs">
          <div className="flex items-center justify-between pb-3 border-b border-[#E9E0D6]">
            <div>
              <span className="text-[#78716C]">Tenant ID:</span>
              <div className="font-mono font-bold text-[#1C1917]">{createdTenant.id}</div>
            </div>
            <div>
              <span className="text-[#78716C]">Owner Login:</span>
              <div className="font-mono font-bold text-[#1C1917]">{createdTenant.owner_email}</div>
            </div>
            <div>
              <span className="text-[#78716C]">Initial PIN:</span>
              <div className="font-mono font-bold text-[#1C1917]">{form.owner_pin}</div>
            </div>
          </div>

          {/* v4.0.0 — Owner login credentials (copy & hand over securely) */}
          <div className="p-3 bg-white rounded-lg border border-[#E9E0D6]">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-semibold text-[#1C1917] flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-[#967221]" />
                  Owner Sign-In Password
                </span>
                <div className="font-mono font-bold text-[#1C1917] mt-0.5">{generatedOwnerPassword || '(generated at provision time)'}</div>
                <div className="text-[10px] text-[#78716C] mt-1">
                  The owner signs in at the login screen with their email + this password.
                  Share it securely — it is not shown again.
                </div>
              </div>
              <button
                onClick={() => copyToClipboard(generatedOwnerPassword, 'owner-pass')}
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#FAF6F0] hover:bg-[#F3ECE4] text-[#1C1917] font-medium transition-colors"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>{copiedUrl === 'owner-pass' ? 'Copied!' : 'Copy'}</span>
              </button>
            </div>
          </div>

          <div className="space-y-2 pt-1">
            <span className="font-semibold text-[#1C1917] uppercase tracking-wider text-[10px] text-[#78716C]">
              Tenant Production Endpoints
            </span>

            {/* Counter POS */}
            <div className="flex items-center justify-between p-2.5 bg-white rounded-lg border border-[#E9E0D6]">
              <div className="flex items-center gap-2">
                <Store className="w-4 h-4 text-[#F97316]" />
                <div>
                  <span className="font-semibold text-[#1C1917]">Counter POS Register</span>
                  <div className="font-mono text-[11px] text-[#78716C]">{posUrl}</div>
                </div>
              </div>
              <button
                onClick={() => copyToClipboard(posUrl, 'pos')}
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#FAF6F0] hover:bg-[#F3ECE4] text-[#1C1917] font-medium transition-colors"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>{copiedUrl === 'pos' ? 'Copied!' : 'Copy'}</span>
              </button>
            </div>

            {/* Tables QR Generator */}
            <div className="flex items-center justify-between p-2.5 bg-white rounded-lg border border-[#E9E0D6]">
              <div className="flex items-center gap-2">
                <QrCode className="w-4 h-4 text-[#7C3AED]" />
                <div>
                  <span className="font-semibold text-[#1C1917]">Floor Tables & Printable QRs</span>
                  <div className="font-mono text-[11px] text-[#78716C]">{tablesUrl}</div>
                </div>
              </div>
              <button
                onClick={() => copyToClipboard(tablesUrl, 'tables')}
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#FAF6F0] hover:bg-[#F3ECE4] text-[#1C1917] font-medium transition-colors"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>{copiedUrl === 'tables' ? 'Copied!' : 'Copy'}</span>
              </button>
            </div>

            {/* Table 1 QR Link */}
            <div className="flex items-center justify-between p-2.5 bg-white rounded-lg border border-[#E9E0D6]">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#10B981]" />
                <div>
                  <span className="font-semibold text-[#1C1917]">Customer Table 1 QR Order Link</span>
                  <div className="font-mono text-[11px] text-[#78716C]">{qrUrl}</div>
                </div>
              </div>
              <button
                onClick={() => copyToClipboard(qrUrl, 'qr')}
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#FAF6F0] hover:bg-[#F3ECE4] text-[#1C1917] font-medium transition-colors"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>{copiedUrl === 'qr' ? 'Copied!' : 'Copy'}</span>
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            onClick={() => {
              setCreatedTenant(null);
              setForm(INITIAL_WIZARD_STATE);
              setCurrentStep(1);
            }}
            className="px-5 py-2.5 rounded-lg border border-[#E9E0D6] text-xs font-semibold text-[#1C1917] hover:bg-[#FAF6F0]"
          >
            Provision Another Business
          </button>
          <button
            onClick={() => setActiveSuperAdminTab('businesses')}
            className="px-5 py-2.5 rounded-lg bg-[#F97316] text-white text-xs font-semibold hover:bg-[#EA580C] shadow-sm"
          >
            Go to Business Directory
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Wizard Header */}
      <div className="bg-white border border-[#E9E0D6] rounded-xl p-5 shadow-xs">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-[#1C1917]">New Cafe & Tenant Provisioning Wizard</h2>
            <p className="text-xs text-[#78716C] mt-0.5">
              Set up a complete multi-tenant cafe account with business details, owner login, KYC, UPI settlement, and SaaS subscription.
            </p>
          </div>
          <button
            onClick={() => setActiveSuperAdminTab('businesses')}
            className="text-xs font-medium text-[#78716C] hover:text-[#1C1917]"
          >
            Cancel & Exit
          </button>
        </div>

        {/* Multi-step progress indicator */}
        <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 mt-6 pt-4 border-t border-[#F5EFEA]">
          {steps.map((s) => {
            const isCompleted = s.num < currentStep;
            const isCurrent = s.num === currentStep;
            return (
              <div
                key={s.num}
                onClick={() => s.num < currentStep && setCurrentStep(s.num)}
                className={`flex flex-col items-center text-center cursor-pointer group ${
                  s.num < currentStep ? 'opacity-100' : isCurrent ? 'opacity-100' : 'opacity-40'
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    isCompleted
                      ? 'bg-[#10B981] text-white'
                      : isCurrent
                      ? 'bg-[#F97316] text-white ring-4 ring-[#FFEDD5]'
                      : 'bg-[#FAF6F0] text-[#78716C] border border-[#E9E0D6]'
                  }`}
                >
                  {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : s.num}
                </div>
                <span className="text-[10px] font-medium text-[#57534E] mt-1.5 line-clamp-1">
                  {s.title}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Step Content Card */}
      <div className="bg-white border border-[#E9E0D6] rounded-xl p-6 shadow-xs min-h-[420px] flex flex-col justify-between">
        {/* STEP 1: Business Information */}
        {currentStep === 1 && (
          <div className="space-y-4 animate-in fade-in duration-150">
            <div>
              <h3 className="text-base font-bold text-[#1C1917]">Step 1: Business & Cafe Identity</h3>
              <p className="text-xs text-[#78716C]">
                Enter the primary trading brand, registered entity name, and unique URL slug.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-semibold text-[#1C1917] mb-1">
                  Cafe / Trading Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Roastery Coffee House"
                  value={form.name}
                  onChange={(e) => updateField('name', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-[#E9E0D6] focus:outline-none focus:ring-1 focus:ring-[#F97316]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#1C1917] mb-1">
                  Legal Entity Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Roastery Hospitality Pvt Ltd"
                  value={form.legal_name}
                  onChange={(e) => updateField('legal_name', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-[#E9E0D6] focus:outline-none focus:ring-1 focus:ring-[#F97316]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#1C1917] mb-1">
                  Customer Display Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Roastery Cafe"
                  value={form.display_name}
                  onChange={(e) => updateField('display_name', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-[#E9E0D6] focus:outline-none focus:ring-1 focus:ring-[#F97316]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#1C1917] mb-1">
                  Unique Platform Slug *
                </label>
                <div className="flex items-center">
                  <span className="px-2 py-2 bg-[#F5EFEA] border border-r-0 border-[#E9E0D6] rounded-l-lg text-[#78716C] font-mono text-[11px]">
                    /
                  </span>
                  <input
                    type="text"
                    placeholder="roastery-cafe"
                    value={form.slug}
                    onChange={(e) => updateField('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                    className="flex-1 px-3 py-2 rounded-r-lg border border-[#E9E0D6] font-mono focus:outline-none focus:ring-1 focus:ring-[#F97316]"
                  />
                </div>
                <p className="text-[10px] text-[#A8A29E] mt-1">
                  Used for guest QR URLs: <code>tablesideordering-web.vercel.app/{form.slug || 'slug'}/t1</code>
                </p>
              </div>

              <div>
                <label className="block font-semibold text-[#1C1917] mb-1">Business Category</label>
                <select
                  value={form.business_type}
                  onChange={(e) => updateField('business_type', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-[#E9E0D6] focus:outline-none focus:ring-1 focus:ring-[#F97316]"
                >
                  <option value="cafe">Specialty Coffee & Cafe</option>
                  <option value="restaurant">Casual Dining Restaurant</option>
                  <option value="quick_service">Quick Service Food Kiosk</option>
                  <option value="bakery">Bakery & Pastry Studio</option>
                  <option value="brewery">Craft Roastery / Microbrewery</option>
                  <option value="cloud_kitchen">Cloud Kitchen Delivery Brand</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: Owner / Primary Account */}
        {currentStep === 2 && (
          <div className="space-y-4 animate-in fade-in duration-150">
            <div>
              <h3 className="text-base font-bold text-[#1C1917]">Step 2: Owner & Administrator Account</h3>
              <p className="text-xs text-[#78716C]">
                Provide primary contact details. This account is provisioned with `owner` role in Supabase Auth.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-semibold text-[#1C1917] mb-1">
                  Owner Full Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Vikram Sharma"
                  value={form.owner_name}
                  onChange={(e) => updateField('owner_name', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-[#E9E0D6] focus:outline-none focus:ring-1 focus:ring-[#F97316]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#1C1917] mb-1">
                  Owner Login Email *
                </label>
                <input
                  type="email"
                  placeholder="coolkafe@gmail.com"
                  value={form.owner_email}
                  onChange={(e) => updateField('owner_email', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-[#E9E0D6] focus:outline-none focus:ring-1 focus:ring-[#F97316]"
                />
                <p className="text-[10px] text-[#A8A29E] mt-1">Used to log in to `/:slug/pos` and manage floor staff.</p>
              </div>

              <div>
                <label className="block font-semibold text-[#1C1917] mb-1">
                  Mobile Number (WhatsApp) *
                </label>
                <input
                  type="text"
                  placeholder="+91 98450 12345"
                  value={form.owner_phone}
                  onChange={(e) => updateField('owner_phone', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-[#E9E0D6] focus:outline-none focus:ring-1 focus:ring-[#F97316]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#1C1917] mb-1">
                  Initial Cashier / POS Quick PIN
                </label>
                <input
                  type="text"
                  maxLength={4}
                  placeholder="1234"
                  value={form.owner_pin}
                  onChange={(e) => updateField('owner_pin', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-[#E9E0D6] font-mono text-center tracking-widest text-sm focus:outline-none focus:ring-1 focus:ring-[#F97316]"
                />
                <p className="text-[10px] text-[#A8A29E] mt-1">4-digit lock PIN for physical POS terminals.</p>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: Tax / Business Information */}
        {currentStep === 3 && (
          <div className="space-y-4 animate-in fade-in duration-150">
            <div>
              <h3 className="text-base font-bold text-[#1C1917]">Step 3: Tax & KYC Compliance</h3>
              <p className="text-xs text-[#78716C]">
                Standard Indian commercial tax IDs used for GST receipt printing and regulatory compliance.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-semibold text-[#1C1917] mb-1">
                  GST Number (GSTIN)
                </label>
                <input
                  type="text"
                  placeholder="29ABCDE1234F1Z5"
                  value={form.gst_number}
                  onChange={(e) => updateField('gst_number', e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 rounded-lg border border-[#E9E0D6] font-mono focus:outline-none focus:ring-1 focus:ring-[#F97316]"
                />
                <p className="text-[10px] text-[#A8A29E] mt-1">Printed on thermal receipts and KOTs for 5% GST reporting.</p>
              </div>

              <div>
                <label className="block font-semibold text-[#1C1917] mb-1">
                  PAN Number
                </label>
                <input
                  type="text"
                  placeholder="ABCDE1234F"
                  value={form.pan_number}
                  onChange={(e) => updateField('pan_number', e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 rounded-lg border border-[#E9E0D6] font-mono focus:outline-none focus:ring-1 focus:ring-[#F97316]"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block font-semibold text-[#1C1917] mb-1">
                  FSSAI Food License Number
                </label>
                <input
                  type="text"
                  placeholder="11223344556677"
                  value={form.fssai_number}
                  onChange={(e) => updateField('fssai_number', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-[#E9E0D6] font-mono focus:outline-none focus:ring-1 focus:ring-[#F97316]"
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: Location */}
        {currentStep === 4 && (
          <div className="space-y-4 animate-in fade-in duration-150">
            <div>
              <h3 className="text-base font-bold text-[#1C1917]">Step 4: Primary Outlet Location</h3>
              <p className="text-xs text-[#78716C]">
                Physical address of the initial branch or flagship store.
              </p>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-[#1C1917] mb-1">
                  Street Address & Landmark *
                </label>
                <textarea
                  rows={2}
                  placeholder="12th Main Road, HAL 2nd Stage, Indiranagar"
                  value={form.address}
                  onChange={(e) => updateField('address', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-[#E9E0D6] focus:outline-none focus:ring-1 focus:ring-[#F97316]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-[#1C1917] mb-1">City *</label>
                  <input
                    type="text"
                    value={form.city}
                    onChange={(e) => updateField('city', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-[#E9E0D6] focus:outline-none focus:ring-1 focus:ring-[#F97316]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#1C1917] mb-1">State *</label>
                  <input
                    type="text"
                    value={form.state}
                    onChange={(e) => updateField('state', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-[#E9E0D6] focus:outline-none focus:ring-1 focus:ring-[#F97316]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#1C1917] mb-1">Postal Code (PIN) *</label>
                  <input
                    type="text"
                    placeholder="560038"
                    value={form.postal_code}
                    onChange={(e) => updateField('postal_code', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-[#E9E0D6] focus:outline-none focus:ring-1 focus:ring-[#F97316]"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 5: Payment / Settlement Information */}
        {currentStep === 5 && (
          <div className="space-y-4 animate-in fade-in duration-150">
            <div>
              <h3 className="text-base font-bold text-[#1C1917]">Step 5: Merchant Settlement & UPI</h3>
              <p className="text-xs text-[#78716C]">
                Guest payments from QR ordering settle directly to the cafe's registered UPI VPA.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="sm:col-span-2">
                <label className="block font-semibold text-[#1C1917] mb-1">
                  Merchant UPI ID (VPA) *
                </label>
                <input
                  type="text"
                  placeholder="coolkafe@okaxis or roastery@hdfcbank"
                  value={form.upi_id}
                  onChange={(e) => updateField('upi_id', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-[#E9E0D6] font-mono focus:outline-none focus:ring-1 focus:ring-[#F97316]"
                />
                <p className="text-[10px] text-[#A8A29E] mt-1">
                  QR checkout opens GPay, PhonePe, Paytm, or Cred directly paying to this handle. Zero platform retention.
                </p>
              </div>

              <div>
                <label className="block font-semibold text-[#1C1917] mb-1">
                  Bank Account Number (Optional)
                </label>
                <input
                  type="text"
                  placeholder="91201004567890"
                  value={form.bank_account}
                  onChange={(e) => updateField('bank_account', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-[#E9E0D6] font-mono focus:outline-none focus:ring-1 focus:ring-[#F97316]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#1C1917] mb-1">
                  Bank IFSC Code (Optional)
                </label>
                <input
                  type="text"
                  placeholder="HDFC0001234"
                  value={form.ifsc_code}
                  onChange={(e) => updateField('ifsc_code', e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 rounded-lg border border-[#E9E0D6] font-mono focus:outline-none focus:ring-1 focus:ring-[#F97316]"
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP 6: Subscription & Deals */}
        {currentStep === 6 && (
          <div className="space-y-4 animate-in fade-in duration-150">
            <div>
              <h3 className="text-base font-bold text-[#1C1917]">Step 6: SaaS Subscription Plan & Custom Deal</h3>
              <p className="text-xs text-[#78716C]">
                Select the monthly SaaS package, trial period, and apply developer partner deals or discounts.
              </p>
            </div>

            {/* Plan Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
              {SAAS_PLANS.map((plan) => {
                const isSelected = form.plan_id === plan.id;
                return (
                  <div
                    key={plan.id}
                    onClick={() => updateField('plan_id', plan.id)}
                    className={`p-3.5 rounded-xl border cursor-pointer flex flex-col justify-between transition-all ${
                      isSelected
                        ? 'border-[#F97316] bg-[#FFF7ED] ring-2 ring-[#F97316]'
                        : 'border-[#E9E0D6] hover:bg-[#FAF6F0]'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[#1C1917]">{plan.name}</span>
                        {plan.is_popular && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-[#F97316] text-white">
                            Popular
                          </span>
                        )}
                      </div>
                      <div className="text-base font-bold text-[#F97316] mt-1.5">
                        ₹{plan.monthly_price}
                        <span className="text-[10px] font-normal text-[#78716C]">/mo</span>
                      </div>
                      <p className="text-[10px] text-[#78716C] mt-1">{plan.tagline}</p>
                    </div>

                    <div className="mt-3 pt-2 border-t border-[#E9E0D6]/50 text-[10px] text-[#57534E] space-y-1">
                      <div>• {plan.max_tables > 100 ? 'Unlimited' : plan.max_tables} Tables</div>
                      <div>• {plan.max_staff > 100 ? 'Unlimited' : plan.max_staff} Staff Accounts</div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Deal / Discount Customizer */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-2">
              <div>
                <label className="block font-semibold text-[#1C1917] mb-1">
                  Evaluation Free Trial Duration
                </label>
                <select
                  value={form.trial_days}
                  onChange={(e) => updateField('trial_days', Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg border border-[#E9E0D6] focus:outline-none focus:ring-1 focus:ring-[#F97316]"
                >
                  <option value={0}>No Trial (Immediate Paid Billing)</option>
                  <option value={7}>7-Day Evaluation Trial</option>
                  <option value={14}>14-Day Free Trial (Standard)</option>
                  <option value={30}>30-Day Extended Pilot</option>
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-[#1C1917]">Special Deal / Discount</label>
                  <span className="font-bold text-[#F97316]">{form.discount_pct}% OFF</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={form.discount_pct}
                  onChange={(e) => updateField('discount_pct', Number(e.target.value))}
                  className="w-full accent-[#F97316]"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block font-semibold text-[#1C1917] mb-1">Deal Notes / Rationale</label>
                <input
                  type="text"
                  placeholder="e.g. 15% discount for 1st year pioneer roastery agreement"
                  value={form.deal_notes}
                  onChange={(e) => updateField('deal_notes', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-[#E9E0D6] focus:outline-none focus:ring-1 focus:ring-[#F97316]"
                />
              </div>
            </div>

            {/* Live Monthly Rate Callout */}
            <div className="p-4 rounded-xl bg-[#FAF6F0] border border-[#E9E0D6] flex items-center justify-between">
              <div>
                <span className="text-xs text-[#78716C]">Final Monthly Recurring Rate for Tenant:</span>
                <div className="text-xl font-bold text-[#1C1917]">
                  ₹{finalMonthlyRate.toLocaleString('en-IN')}{' '}
                  <span className="text-xs font-normal text-[#78716C]">/ month (+ 18% GST)</span>
                </div>
              </div>
              <div className="text-right text-xs">
                {form.trial_days > 0 ? (
                  <span className="px-2.5 py-1 rounded-full font-semibold bg-[#FAF5FF] text-[#7C3AED] border border-[#E9D5FF]">
                    First {form.trial_days} Days Free
                  </span>
                ) : (
                  <span className="px-2.5 py-1 rounded-full font-semibold bg-[#DCFCE7] text-[#166534] border border-[#BBF7D0]">
                    Bill Starts Today
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* STEP 7: Initial Configuration */}
        {currentStep === 7 && (
          <div className="space-y-4 animate-in fade-in duration-150">
            <div>
              <h3 className="text-base font-bold text-[#1C1917]">Step 7: Initial Seed Configuration</h3>
              <p className="text-xs text-[#78716C]">
                Bootstrap floor tables, default menu recipes, and anti-tamper security tokens.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-semibold text-[#1C1917] mb-1">
                  Initial Dining Tables to Auto-Generate
                </label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={form.initial_tables_count}
                  onChange={(e) => updateField('initial_tables_count', Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg border border-[#E9E0D6] focus:outline-none focus:ring-1 focus:ring-[#F97316]"
                />
                <p className="text-[10px] text-[#A8A29E] mt-1">
                  Creates Table 1 to Table {form.initial_tables_count} with individual cryptographic HMAC tokens.
                </p>
              </div>

              <div>
                <label className="block font-semibold text-[#1C1917] mb-1">
                  Starter Menu Template
                </label>
                <select
                  value={form.menu_template}
                  onChange={(e) => updateField('menu_template', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-[#E9E0D6] focus:outline-none focus:ring-1 focus:ring-[#F97316]"
                >
                  <option value="coffee_bakery">Artisan Coffee & Bakery Essentials (Seed 12 items)</option>
                  <option value="casual_dining">Casual Dining & Cafe Bites (Seed 20 items)</option>
                  <option value="empty">Empty Catalog (Owner creates menu manually)</option>
                </select>
              </div>

              <div className="sm:col-span-2 space-y-2 pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.enable_table_qr}
                    onChange={(e) => updateField('enable_table_qr', e.target.checked)}
                    className="rounded text-[#F97316] accent-[#F97316]"
                  />
                  <span className="font-semibold text-[#1C1917]">
                    Enable Table-Side QR Ordering Surface (`/:slug/:tableId`)
                  </span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.enable_anti_tamper}
                    onChange={(e) => updateField('enable_anti_tamper', e.target.checked)}
                    className="rounded text-[#F97316] accent-[#F97316]"
                  />
                  <span className="font-semibold text-[#1C1917]">
                    Enforce Server-Side HMAC Cryptographic Token Verification (Anti-Tamper Shield)
                  </span>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* STEP 8: Review & Provision */}
        {currentStep === 8 && (
          <div className="space-y-4 animate-in fade-in duration-150">
            <div>
              <h3 className="text-base font-bold text-[#1C1917]">Step 8: Final Review & Tenant Provisioning</h3>
              <p className="text-xs text-[#78716C]">
                Verify all parameters before creating tenant rows in the database.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-[#FAF6F0] rounded-xl border border-[#E9E0D6] space-y-1">
                <span className="text-[#78716C] font-semibold uppercase text-[10px]">Business</span>
                <div className="font-bold text-[#1C1917]">{form.name || 'Untitled Cafe'}</div>
                <div className="text-[11px] text-[#78716C]">Slug: <code>/{form.slug}</code></div>
                <div className="text-[11px] text-[#78716C]">Type: {form.business_type}</div>
              </div>

              <div className="p-3 bg-[#FAF6F0] rounded-xl border border-[#E9E0D6] space-y-1">
                <span className="text-[#78716C] font-semibold uppercase text-[10px]">Owner Account</span>
                <div className="font-bold text-[#1C1917]">{form.owner_name || 'Admin'}</div>
                <div className="text-[11px] text-[#78716C]">{form.owner_email}</div>
                <div className="text-[11px] text-[#78716C]">{form.owner_phone}</div>
              </div>

              <div className="p-3 bg-[#FAF6F0] rounded-xl border border-[#E9E0D6] space-y-1">
                <span className="text-[#78716C] font-semibold uppercase text-[10px]">Location & Tax</span>
                <div className="font-bold text-[#1C1917]">{form.city}, {form.state}</div>
                <div className="text-[11px] text-[#78716C]">UPI: {form.upi_id || 'Pending'}</div>
                <div className="text-[11px] text-[#78716C]">GST: {form.gst_number || 'Unregistered'}</div>
              </div>

              <div className="p-3 bg-[#FAF6F0] rounded-xl border border-[#E9E0D6] space-y-1">
                <span className="text-[#78716C] font-semibold uppercase text-[10px]">SaaS Subscription</span>
                <div className="font-bold text-[#F97316]">{selectedPlan.name}</div>
                <div className="text-[11px] text-[#1C1917] font-semibold">
                  ₹{finalMonthlyRate}/mo {form.discount_pct > 0 && `(${form.discount_pct}% discount)`}
                </div>
                <div className="text-[11px] text-[#78716C]">
                  {form.trial_days > 0 ? `${form.trial_days}-Day Trial Active` : 'Immediate Active'}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Wizard Footer Navigation Controls */}
        <div className="flex items-center justify-between pt-6 border-t border-[#E9E0D6] mt-6">
          <button
            type="button"
            disabled={currentStep === 1}
            onClick={handlePrev}
            className={`flex items-center gap-1 px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
              currentStep === 1
                ? 'text-[#A8A29E] cursor-not-allowed'
                : 'text-[#1C1917] bg-[#FAF6F0] hover:bg-[#F3ECE4]'
            }`}
          >
            <ArrowLeft className="w-4 h-4" />
            Previous
          </button>

          <div className="text-xs text-[#78716C]">
            Step {currentStep} of {steps.length}
          </div>

          {currentStep < 8 ? (
            <button
              type="button"
              onClick={handleNext}
              className="flex items-center gap-1 px-5 py-2 rounded-lg text-xs font-semibold bg-[#F97316] text-white hover:bg-[#EA580C] shadow-sm transition-all"
            >
              Next Step
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              disabled={isProvisioning}
              onClick={handleExecuteProvisioning}
              className={`flex items-center gap-1 px-6 py-2 rounded-lg text-xs font-bold text-white shadow-md transition-all ${
                isProvisioning
                  ? 'bg-[#6EE7B7] cursor-wait'
                  : 'bg-[#10B981] hover:bg-[#059669] animate-pulse'
              }`}
            >
              {isProvisioning ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  PROVISIONING DATABASE...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  CREATE & PROVISION TENANT
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
