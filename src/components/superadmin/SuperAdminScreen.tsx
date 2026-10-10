import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useTsosStore } from '../../lib/store';
import { SuperAdminDashboard } from './SuperAdminDashboard';
import { BusinessDirectory } from './BusinessDirectory';
import { ProvisioningWizard } from './ProvisioningWizard';
import { SubscriptionsManager } from './SubscriptionsManager';
import { AuditLogViewer } from './AuditLogViewer';
import {
  LayoutDashboard,
  Building2,
  PlusCircle,
  CreditCard,
  ShieldCheck,
  Store,
  ExternalLink,
  ChevronRight,
  ArrowLeft,
  Search,
  LogOut,
} from 'lucide-react';

interface SuperAdminScreenProps {
  onSignOut?: () => void;
}

const SERVEPOINT_TABS = [
  { id: 'dashboard' as const, label: 'Dashboard', icon: LayoutDashboard },
  { id: 'businesses' as const, label: 'Businesses', icon: Building2 },
  { id: 'wizard' as const, label: 'Provisioning Wizard', icon: PlusCircle, highlight: true },
  { id: 'subscriptions' as const, label: 'Subscriptions', icon: CreditCard },
  { id: 'audit' as const, label: 'Audit Trail', icon: ShieldCheck },
];

const LEGACY_TABS = [
  { id: 'dashboard' as const, label: 'Platform Dashboard', icon: LayoutDashboard },
  { id: 'businesses' as const, label: 'Businesses', icon: Building2 },
  { id: 'wizard' as const, label: 'Provisioning Wizard', icon: PlusCircle, highlight: true },
  { id: 'subscriptions' as const, label: 'Subscriptions & Deals', icon: CreditCard },
  { id: 'audit' as const, label: 'Audit Trail', icon: ShieldCheck },
];

/**
 * ServePoint shell — owner's Dashboard frame 219:29880 language:
 * deep-teal sidebar (gold roundel, nav pills, Others section, pinned profile
 * card), breadcrumb top bar with quick tenant jump, page title row.
 * Height contract: app Header is ~92px → root is h-[calc(100vh-93px)] and all
 * scroll happens inside the main column (no page scroll, per v2.7.2 contract).
 */
const ServePointShell: React.FC<SuperAdminScreenProps> = ({ onSignOut }) => {
  const {
    activeSuperAdminTab,
    setActiveSuperAdminTab,
    setActiveSurface,
    tenantBusinesses,
    platformAuditLogs,
    setSelectedSuperAdminBusinessId,
  } = useTsosStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);

  /* Self-measuring height contract: the app Header's height varies with the
     viewport (button wrapping), so the shell measures its own offsetTop and
     sizes to fill exactly the rest of the viewport — zero page scroll. */
  const rootRef = useRef<HTMLDivElement>(null);
  const [topInset, setTopInset] = useState(95);
  useEffect(() => {
    const measure = () => {
      if (rootRef.current) setTopInset(rootRef.current.getBoundingClientRect().top);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  const tabLabel =
    SERVEPOINT_TABS.find((t) => t.id === activeSuperAdminTab)?.label || 'Dashboard';

  /* Quick tenant jump — type ≥2 chars, pick a tenant, land on the Directory pre-filtered */
  const matches = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (q.length < 2) return [];
    return tenantBusinesses
      .filter(
        (b) =>
          b.name.toLowerCase().includes(q) ||
          b.city.toLowerCase().includes(q) ||
          b.owner_name.toLowerCase().includes(q) ||
          b.slug.toLowerCase().includes(q)
      )
      .slice(0, 6);
  }, [searchQuery, tenantBusinesses]);

  useEffect(() => {
    if (!searchOpen) return;
    const close = () => setSearchOpen(false);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [searchOpen]);

  const jumpToBusiness = (businessId: string) => {
    setSelectedSuperAdminBusinessId(businessId);
    setActiveSuperAdminTab('businesses');
    setSearchQuery('');
    setSearchOpen(false);
  };

  return (
    <div
      ref={rootRef}
      style={{ height: `calc(100vh - ${topInset}px)` }}
      className="flex bg-[#F6F5F2] overflow-hidden font-sans"
    >
      {/* ── Sidebar (deep teal, desktop only) ───────────────────────────── */}
      <aside className="hidden lg:flex w-60 shrink-0 bg-[#0F3D3E] flex-col overflow-y-auto">
        {/* Logo roundel + wordmark */}
        <div className="px-5 pt-5 pb-4 flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full bg-[#B88E2F] flex items-center justify-center font-black text-[#0F3D3E] text-sm shadow-sm">
            TS
          </div>
          <div className="min-w-0">
            <div className="text-white font-bold text-sm leading-tight">TSOS Platform</div>
            <div className="text-[10px] text-[#9DB8AE]">SuperAdmin Console</div>
          </div>
        </div>

        {/* Primary nav */}
        <nav className="px-3 space-y-1" aria-label="Platform navigation">
          {SERVEPOINT_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeSuperAdminTab === tab.id;
            const count =
              tab.id === 'businesses'
                ? tenantBusinesses.length
                : tab.id === 'audit'
                ? platformAuditLogs.length
                : null;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveSuperAdminTab(tab.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-semibold transition-colors ${
                  isActive
                    ? 'bg-[#B88E2F] text-[#0F3D3E] shadow-sm'
                    : tab.highlight
                    ? 'text-[#E5C97A] hover:bg-white/10'
                    : 'text-[#C9D8D1] hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate text-left flex-1">{tab.label}</span>
                {count !== null && count > 0 && (
                  <span
                    className={`min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold flex items-center justify-center ${
                      isActive ? 'bg-[#0F3D3E]/15 text-[#0F3D3E]' : 'bg-[#B88E2F] text-[#0F3D3E]'
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Others section */}
        <div className="px-5 pt-5 pb-2 text-[10px] font-bold uppercase tracking-wider text-[#7FA096]">
          Others
        </div>
        <nav className="px-3 space-y-1" aria-label="Other actions">
          <button
            onClick={() => setActiveSurface('web')}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-semibold text-[#C9D8D1] hover:bg-white/10 hover:text-white transition-colors"
          >
            <Store className="w-4 h-4 shrink-0" />
            <span className="text-left flex-1">Switch to Cafe View</span>
          </button>
        </nav>

        {/* Pinned profile card */}
        <div className="mt-auto p-3">
          <div className="rounded-2xl bg-white/10 p-3 backdrop-blur-sm">
            <div className="flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-full bg-[#D9E2DD] flex items-center justify-center text-[#0F3D3E] font-black text-sm mb-2">
                SA
              </div>
              <div className="text-white text-xs font-bold truncate max-w-full">
                TSOS Super Admin
              </div>
              <div className="text-[10px] text-[#9DB8AE] truncate max-w-full">
                Platform Master Operator
              </div>
              <button
                onClick={onSignOut}
                className="mt-2.5 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#9DB8AE]/50 text-[11px] font-semibold text-white hover:bg-white/10 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign Out
              </button>
            </div>
          </div>
          <div className="text-center text-[10px] text-[#7FA096] mt-2">© 2026 TSOS Setup</div>
        </div>
      </aside>

      {/* ── Main column ─────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar: breadcrumb + quick jump search */}
        <div className="flex items-center justify-between gap-3 px-5 py-3 bg-[#F6F5F2] border-b border-[#E3E7E0]">
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={() => setActiveSurface('web')}
              title="Back to Cafe View"
              aria-label="Back to Cafe View"
              className="w-8 h-8 rounded-full bg-white border border-[#E3E7E0] flex items-center justify-center text-[#1A1A1A] hover:border-[#B88E2F] hover:text-[#967221] transition-colors shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs min-w-0">
              <span className="text-[#6B6B6B] font-medium hidden sm:inline">Platform</span>
              <span className="text-[#969696] hidden sm:inline">›</span>
              <span className="text-[#1A1A1A] font-bold truncate">{tabLabel}</span>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            {/* Quick tenant jump */}
            <div className="relative" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-2 h-9 w-44 sm:w-64 px-3 rounded-full bg-white border border-[#E3E7E0] focus-within:border-[#B88E2F] transition-colors">
                <Search className="w-3.5 h-3.5 text-[#969696] shrink-0" />
                <input
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setSearchOpen(true);
                  }}
                  onFocus={() => setSearchOpen(true)}
                  placeholder="Jump to tenant..."
                  aria-label="Jump to tenant"
                  className="flex-1 min-w-0 bg-transparent text-xs text-[#1A1A1A] placeholder:text-[#969696] outline-none"
                />
              </div>
              {searchOpen && matches.length > 0 && (
                <div className="absolute right-0 top-11 w-72 rounded-xl bg-white border border-[#E3E7E0] shadow-lg shadow-[#0F3D3E]/10 py-1.5 z-50 max-h-64 overflow-y-auto">
                  {matches.map((b) => (
                    <button
                      key={b.id}
                      onClick={() => jumpToBusiness(b.id)}
                      className="w-full flex items-center justify-between gap-2 px-3.5 py-2 hover:bg-[#F6F5F2] transition-colors text-left"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-[#1A1A1A] truncate">{b.name}</div>
                        <div className="text-[10px] text-[#6B6B6B] truncate">
                          {b.city} · {b.status}
                        </div>
                      </div>
                      <ExternalLink className="w-3.5 h-3.5 text-[#967221] shrink-0" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Live RLS chip */}
            <span className="hidden md:flex items-center gap-1.5 px-3 h-9 rounded-full bg-white border border-[#E3E7E0] text-[11px] font-semibold text-[#17803D]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#17803D] animate-pulse" />
              RLS Active
            </span>
          </div>
        </div>

        {/* Page title row */}
        <div className="px-5 pt-4 pb-1 flex items-center justify-between gap-3">
          <h2 className="text-xl font-bold text-[#1A1A1A]">{tabLabel}</h2>
          {/* Mobile sign-out — the sidebar (with its profile card) is desktop-only */}
          <button
            onClick={onSignOut}
            className="lg:hidden flex items-center gap-1.5 px-3 h-9 rounded-full border border-[#E3E7E0] bg-white text-[11px] font-bold text-[#1A1A1A] hover:border-[#B88E2F] hover:text-[#967221] transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
        </div>

        {/* Mobile nav strip (sidebar replacement below lg) */}
        <div
          className="lg:hidden flex items-center gap-1.5 overflow-x-auto px-4 py-2 border-b border-[#E3E7E0] scrollbar-none"
          role="tablist"
          aria-label="Platform navigation"
        >
          {SERVEPOINT_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeSuperAdminTab === tab.id;
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveSuperAdminTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 h-8 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${
                  isActive
                    ? 'bg-[#0F3D3E] text-white'
                    : tab.highlight
                    ? 'bg-white border border-[#E3E7E0] text-[#967221]'
                    : 'bg-white border border-[#E3E7E0] text-[#6B6B6B]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
          <span className="w-px h-5 bg-[#E3E7E0] shrink-0" aria-hidden />
          <button
            onClick={() => setActiveSurface('web')}
            className="flex items-center gap-1.5 px-3 h-8 rounded-full text-xs font-bold whitespace-nowrap bg-[#B88E2F]/15 text-[#967221] transition-colors"
          >
            <Store className="w-3.5 h-3.5" />
            Cafe View
          </button>
        </div>

        {/* Scrollable content viewport */}
        <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-6 pt-2">
          {activeSuperAdminTab === 'dashboard' && <SuperAdminDashboard />}
          {activeSuperAdminTab === 'businesses' && <BusinessDirectory />}
          {activeSuperAdminTab === 'wizard' && <ProvisioningWizard />}
          {activeSuperAdminTab === 'subscriptions' && <SubscriptionsManager />}
          {activeSuperAdminTab === 'audit' && <AuditLogViewer />}
        </div>
      </div>
    </div>
  );
};

export const SuperAdminScreen: React.FC<SuperAdminScreenProps> = ({ onSignOut }) => {
  const { themeMode } = useTsosStore();
  const isServepoint = themeMode === 'servepoint';

  if (isServepoint) {
    return <ServePointShell onSignOut={onSignOut} />;
  }

  return <LegacyShell />;
};

/* ─────────────────────────────────────────────────────────────────────────
 * Legacy shell (Tessera / dark / warm themes — CSS remap layer handles
 * palette). Byte-preserved from v2.7.2.
 * ───────────────────────────────────────────────────────────────────────── */
const LegacyShell: React.FC = () => {
  const {
    activeSuperAdminTab,
    setActiveSuperAdminTab,
    setActiveSurface,
    tenantBusinesses,
    platformAuditLogs,
  } = useTsosStore();

  const tabs = LEGACY_TABS.map((t) => {
    if (t.id === 'businesses') return { ...t, label: `Businesses (${tenantBusinesses.length})` };
    if (t.id === 'audit') return { ...t, label: `Audit Trail (${platformAuditLogs.length})` };
    return t;
  });

  return (
    <div className="min-h-screen bg-[#F7F3EE] flex flex-col font-sans">
      {/* SuperAdmin Top Platform Header */}
      <header className="bg-[#1C1917] text-white border-b border-[#292524] sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            {/* Left: Platform Identity */}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#F97316] flex items-center justify-center font-black text-white text-base shadow-sm">
                TS
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm tracking-tight">
                    TableSide Platform OS
                  </span>
                  <span className="px-2 py-0.2 rounded text-[10px] font-extrabold bg-[#7C3AED] text-white uppercase tracking-wider">
                    SuperAdmin
                  </span>
                </div>
                <div className="text-[10px] text-[#A8A29E] flex items-center gap-1.5">
                  <span>Multi-Tenant SaaS Control Center</span>
                  <span>•</span>
                  <span className="font-mono text-[#4ADE80] flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#4ADE80] animate-pulse" />
                    Supabase Production RLS Active
                  </span>
                </div>
              </div>
            </div>

            {/* Center / Right: Operator Context & Switcher */}
            <div className="flex items-center gap-3">
              {/* Operator info */}
              <div className="hidden md:flex flex-col items-end text-right">
                <span className="text-xs font-semibold text-white">superadmin@tablesideordering.com</span>
                <span className="text-[10px] text-[#A8A29E]">Platform Master Operator</span>
              </div>

              <div className="h-6 w-px bg-[#44403C] hidden md:block" />

              {/* Surface Switch Back to Cafe Owner View */}
              <button
                onClick={() => setActiveSurface('web')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#292524] hover:bg-[#383330] text-xs font-semibold text-[#FAF6F0] transition-colors border border-[#44403C]"
              >
                <Store className="w-3.5 h-3.5 text-[#F97316]" />
                <span className="hidden sm:inline">Switch to Cafe View</span>
                <ChevronRight className="w-3.5 h-3.5 text-[#A8A29E]" />
              </button>
            </div>
          </div>

          {/* Sub-Navigation Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto py-2 border-t border-[#292524] scrollbar-none">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeSuperAdminTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveSuperAdminTab(tab.id)}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                    isActive
                      ? 'bg-white text-[#1C1917] shadow-xs'
                      : tab.highlight
                      ? 'text-[#F97316] hover:bg-[#292524]'
                      : 'text-[#A8A29E] hover:text-white hover:bg-[#292524]'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-[#F97316]' : tab.highlight ? 'text-[#F97316]' : ''}`} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Main Content Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeSuperAdminTab === 'dashboard' && <SuperAdminDashboard />}
        {activeSuperAdminTab === 'businesses' && <BusinessDirectory />}
        {activeSuperAdminTab === 'wizard' && <ProvisioningWizard />}
        {activeSuperAdminTab === 'subscriptions' && <SubscriptionsManager />}
        {activeSuperAdminTab === 'audit' && <AuditLogViewer />}
      </main>

      {/* Platform Status Footer */}
      <footer className="bg-white border-t border-[#E9E0D6] py-3 text-xs text-[#78716C]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-[#1C1917]">TableSide SaaS Multi-Tenant Platform</span>
            <span>•</span>
            <span>v2.0.0 Enterprise SaaS</span>
            <span>•</span>
            <span className="text-[#16A34A] font-medium">PostgreSQL Isolation Active</span>
          </div>
          <div className="text-[11px] text-[#A8A29E]">
            Zero Client Trust Enforced • Cryptographic Table HMAC Tokens Active
          </div>
        </div>
      </footer>
    </div>
  );
};
