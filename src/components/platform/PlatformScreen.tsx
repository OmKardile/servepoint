import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Building2,
  Check,
  ChevronDown,
  Copy,
  CreditCard,
  Hourglass,
  Inbox,
  LayoutGrid,
  Loader2,
  LogOut,
  Plus,
  RefreshCw,
  ScrollText,
  Search,
  TrendingUp,
} from 'lucide-react';
import { fetchAuditLogs, fetchSubscriptions, fetchTenants } from '../../lib/api';
import { subscriptionWords } from '../../lib/billing';
import { formatBillingDate as formatDate } from '../../lib/billing';
import { isSupabaseConfigured } from '../../lib/supabase';
import { authService } from '../../lib/authService';
import { formatMoney, timeAgo } from '../../lib/prefs';
import { useSession } from '../../store/session';
import type { AuditLogEntry, Subscription, Tenant } from '../../types';
import { ProvisioningWizard } from './ProvisioningWizard';
import brandMark from '../../assets/brand/mark.png';

/**
 * ServePoint Platform console (v5.0.0, ADR-0013/ADR-0014).
 * The SuperAdmin ("Platform Operator") surface — its own chrome, never the cafe
 * app shell. Data comes exclusively from live Supabase (fetchTenants,
 * fetchSubscriptions, fetchAuditLogs); tables legitimately start empty.
 */

type PlatformTab = 'dashboard' | 'businesses' | 'subscriptions' | 'audit';

const NAV: { id: PlatformTab; label: string; icon: React.ElementType }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutGrid },
  { id: 'businesses', label: 'Businesses', icon: Building2 },
  { id: 'subscriptions', label: 'Subscriptions', icon: CreditCard },
  { id: 'audit', label: 'Audit log', icon: ScrollText },
];

const TAB_TITLES: Record<PlatformTab, string> = {
  dashboard: 'Dashboard',
  businesses: 'Businesses',
  subscriptions: 'Subscriptions',
  audit: 'Audit log',
};

/* ─────────────────────────── helpers ─────────────────────────── */

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  return 'Unknown error.';
}

function shortId(id: string): string {
  return id.length > 12 ? `${id.slice(0, 12)}…` : id;
}

/* v5.124.0 — the panel's IDs leave whole. The details panel truncates long
 * values for layout; the clipboard always receives the full string. One tap,
 * a two-second checkmark, and the operator never re-derives a UUID by hand. */
async function copyPlain(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to the legacy path */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

const CopyValueButton: React.FC<{ value: string; label: string }> = ({ value, label }) => {
  const [copied, setCopied] = useState(false);
  const timer = React.useRef<number | null>(null);
  useEffect(() => () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
  }, []);
  return (
    <button
      type="button"
      onClick={async () => {
        const ok = await copyPlain(value);
        if (!ok) return;
        setCopied(true);
        if (timer.current !== null) window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => setCopied(false), 2000);
      }}
      aria-label={`${label} — copy to clipboard`}
      className="inline-flex h-6 items-center gap-1 rounded-md px-1.5 text-[11px] font-semibold text-[#0F3D3E] transition-colors hover:bg-[#E3E7E0]"
    >
      {copied ? (
        <>
          <Check size={12} aria-hidden className="text-[#2E7D32]" />
          <span className="text-[#2E7D32]">Copied</span>
        </>
      ) : (
        <>
          <Copy size={12} aria-hidden />
          <span className="sr-only">Copy {label}</span>
        </>
      )}
    </button>
  );
};

function statusChipClass(status: string): string {
  switch (status) {
    case 'trialing':
    case 'trial':
      return 'bg-[#F3E8CF] text-[#8A6A1F]';
    case 'active':
      return 'bg-[#E8F5EC] text-[#2E7D32]';
    case 'suspended':
    case 'cancelled':
      return 'bg-[#FEF2F2] text-[#B42318]';
    default:
      return 'bg-[#D9E2DD] text-[#0F3D3E]';
  }
}

const StatusChip: React.FC<{ status: string }> = ({ status }) => (
  <span
    className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold leading-none ${statusChipClass(status)}`}
  >
    {status || 'unknown'}
  </span>
);

const SlugChip: React.FC<{ slug: string }> = ({ slug }) => (
  <span className="inline-flex items-center rounded-full bg-[#D9E2DD] px-2.5 py-1 text-[11px] font-semibold leading-none text-[#0F3D3E]">
    {slug}
  </span>
);

/* v5.125.0 — the billing cell speaks the row's truth: a trialing subscription
 * answers "Trial ends 16 Oct 2026" with days remaining (amber inside 3 days,
 * no charge yet); an active one answers with the next charge date in the
 * house date grammar; an unknown stays "—" — no invented dates.
 * v5.126.0 — the clock and the words moved into lib/billing.ts (one grammar
 * for both sides of the console); this cell is a thin projection of it. */

function billingCell(s: Subscription) {
  return subscriptionWords(s);
}

const SageChipIcon: React.FC<{ icon: React.ElementType }> = ({ icon: Icon }) => (
  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#D9E2DD] text-[#0F3D3E]">
    <Icon size={18} strokeWidth={2} aria-hidden />
  </span>
);

const KpiCard: React.FC<{ icon: React.ElementType; label: string; value: string | number }> = ({
  icon,
  label,
  value,
}) => (
  <div className="sp-card p-5">
    <div className="flex items-center gap-3">
      <SageChipIcon icon={icon} />
      <p className="text-[13px] font-medium text-[#6B6B6B]">{label}</p>
    </div>
    <p className="mt-4 text-3xl font-bold tracking-tight text-[#1A1A1A]" aria-label={label}>
      {value}
    </p>
  </div>
);

const KpiSkeleton: React.FC = () => (
  <div className="sp-card p-5" role="status" aria-label="Loading">
    <div className="flex items-center gap-3">
      <span className="sp-skeleton h-10 w-10" style={{ borderRadius: 12 }} aria-hidden />
      <span className="sp-skeleton h-4 w-24" style={{ borderRadius: 8 }} aria-hidden />
    </div>
    <span className="sp-skeleton mt-4 block h-9 w-20" style={{ borderRadius: 10 }} aria-hidden />
  </div>
);

const ErrorCard: React.FC<{ title: string; message: string; onRetry: () => void }> = ({
  title,
  message,
  onRetry,
}) => (
  <div className="sp-card p-5" role="alert">
    <div className="flex items-start gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#FEF2F2] text-[#B42318]">
        <AlertTriangle size={18} aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-[#1A1A1A]">{title}</p>
        <p className="mt-1 break-words text-[13px] text-[#6B6B6B]">{message}</p>
      </div>
    </div>
    <button
      type="button"
      onClick={onRetry}
      className="sp-cta mt-4 inline-flex h-11 items-center gap-2 rounded-xl px-4 text-[13px]"
    >
      <RefreshCw size={15} aria-hidden />
      Retry
    </button>
  </div>
);

const EmptyState: React.FC<{
  icon: React.ElementType;
  title: string;
  body: string;
  action?: { label: string; onClick: () => void };
}> = ({ icon: Icon, title, body, action }) => (
  <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
    <span className="flex h-24 w-24 items-center justify-center rounded-full bg-[#EAF0EC] text-[#2C3E3E]">
      <Icon size={38} strokeWidth={1.8} aria-hidden />
    </span>
    <h3 className="mt-6 text-lg font-semibold text-[#1A1A1A]">{title}</h3>
    <p className="mt-2 max-w-sm text-sm leading-relaxed text-[#6B6B6B]">{body}</p>
    {action && (
      <button
        type="button"
        onClick={action.onClick}
        className="sp-cta mt-6 inline-flex h-11 items-center gap-2 rounded-xl px-5 text-[13px]"
      >
        <Plus size={16} aria-hidden />
        {action.label}
      </button>
    )}
  </div>
);

const RowSkeletons: React.FC<{ rows?: number }> = ({ rows = 5 }) => (
  <div className="space-y-3 p-5" role="status" aria-label="Loading">
    <span className="sr-only">Loading</span>
    {Array.from({ length: rows }).map((_, i) => (
      <span key={i} className="sp-skeleton block h-12" style={{ borderRadius: 12 }} aria-hidden />
    ))}
  </div>
);

/* ─────────────────────── dashboard sub-views ─────────────────────── */

const RecentBusinessRow: React.FC<{ tenant: Tenant }> = ({ tenant }) => (
  <div className="flex items-center gap-3 py-3.5">
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#D9E2DD] text-sm font-bold text-[#0F3D3E]">
      {(tenant.name || '?').charAt(0).toUpperCase()}
    </span>
    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-center gap-2">
        <p className="truncate text-sm font-semibold text-[#1A1A1A]">{tenant.name}</p>
        <SlugChip slug={tenant.slug} />
      </div>
      <p className="mt-0.5 truncate text-xs text-[#969696]">
        {tenant.business_type ? tenant.business_type.charAt(0).toUpperCase() + tenant.business_type.slice(1) : 'Business'}
        {' · '}
        {formatDate(tenant.created_at)}
      </p>
    </div>
    <StatusChip status={tenant.status} />
  </div>
);

const ActivityRow: React.FC<{ log: AuditLogEntry }> = ({ log }) => (
  <div className="flex items-start gap-3 py-3.5">
    <div className="min-w-0 flex-1">
      <p className="truncate text-sm font-semibold text-[#1A1A1A]">{log.action}</p>
      {log.details && <p className="mt-0.5 truncate text-xs text-[#6B6B6B]">{log.details}</p>}
    </div>
    <div className="shrink-0 text-right">
      <p className="text-xs font-medium text-[#6B6B6B]">{log.actor_email || 'System'}</p>
      <p className="mt-0.5 text-xs text-[#969696]">{timeAgo(log.timestamp)}</p>
    </div>
  </div>
);

/* ──────────────────────────── main screen ──────────────────────────── */

export const PlatformScreen: React.FC = () => {
  const session = useSession((s) => s.session);

  const [tab, setTab] = useState<PlatformTab>('dashboard');
  const [tenants, setTenants] = useState<Tenant[] | null>(null);
  const [tenantsError, setTenantsError] = useState<string | null>(null);
  const [subs, setSubs] = useState<Subscription[] | null>(null);
  const [subsError, setSubsError] = useState<string | null>(null);
  const [logs, setLogs] = useState<AuditLogEntry[] | null>(null);
  const [logsError, setLogsError] = useState<string | null>(null);
  const [businessQuery, setBusinessQuery] = useState('');
  const [expandedTenantId, setExpandedTenantId] = useState<string | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const load = useCallback(async () => {
    setTenantsError(null);
    setSubsError(null);
    setLogsError(null);
    const [tenantsRes, subsRes, logsRes] = await Promise.allSettled([
      fetchTenants(),
      fetchSubscriptions(),
      fetchAuditLogs(50),
    ]);
    if (tenantsRes.status === 'fulfilled') setTenants(tenantsRes.value);
    else setTenantsError(errorMessage(tenantsRes.reason));
    if (subsRes.status === 'fulfilled') setSubs(subsRes.value);
    else setSubsError(errorMessage(subsRes.reason));
    if (logsRes.status === 'fulfilled') setLogs(logsRes.value);
    else setLogsError(errorMessage(logsRes.reason));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const supabaseConnected = isSupabaseConfigured();

  const mrr = useMemo(
    () => (subs ?? []).reduce((sum, s) => sum + (s.final_monthly_rate || 0), 0),
    [subs]
  );
  const activeSubscriptions = useMemo(
    () => (subs ?? []).filter((s) => s.status === 'active').length,
    [subs]
  );
  const trialTenants = useMemo(
    () => (tenants ?? []).filter((t) => t.status === 'trialing' || t.status === 'trial').length,
    [tenants]
  );
  const tenantNameById = useMemo(
    () => new Map((tenants ?? []).map((t) => [t.id, t.name] as const)),
    [tenants]
  );

  const filteredTenants = useMemo(() => {
    const q = businessQuery.trim().toLowerCase();
    if (!q) return tenants ?? [];
    return (tenants ?? []).filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.slug.toLowerCase().includes(q) ||
        (t.city || '').toLowerCase().includes(q)
    );
  }, [tenants, businessQuery]);

  const recentTenants = useMemo(() => (tenants ?? []).slice(0, 5), [tenants]);
  const recentLogs = useMemo(() => (logs ?? []).slice(0, 10), [logs]);

  const openWizard = useCallback(() => setWizardOpen(true), []);

  const handleSignOut = useCallback(async () => {
    setSigningOut(true);
    try {
      await authService.signOut();
    } finally {
      useSession.getState().setSession(null);
    }
  }, []);

  const initial = (session?.name || 'P').charAt(0).toUpperCase();

  /* ── tab bodies ── */

  const renderDashboard = () => {
    const kpisLoading = tenants === null || subs === null;
    const anyError = tenantsError || subsError || logsError;

    return (
      <div className="space-y-5">
        {anyError && (
          <ErrorCard
            title="Some platform data could not be loaded"
            message={[tenantsError && `Businesses: ${tenantsError}`, subsError && `Subscriptions: ${subsError}`, logsError && `Audit log: ${logsError}`]
              .filter(Boolean)
              .join(' · ')}
            onRetry={() => void load()}
          />
        )}

        {/* KPI row */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {kpisLoading && !tenantsError && !subsError ? (
            <>
              <KpiSkeleton />
              <KpiSkeleton />
              <KpiSkeleton />
              <KpiSkeleton />
            </>
          ) : (
            <>
              <KpiCard icon={Building2} label="Total businesses" value={tenantsError ? '—' : tenants?.length ?? 0} />
              <KpiCard icon={CreditCard} label="Active subscriptions" value={subsError ? '—' : activeSubscriptions} />
              <KpiCard icon={TrendingUp} label="Monthly recurring revenue" value={subsError ? '—' : formatMoney(mrr)} />
              <KpiCard icon={Hourglass} label="Trials" value={tenantsError ? '—' : trialTenants} />
            </>
          )}
        </div>

        {/* Recent businesses + recent activity */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
          <section className="sp-card lg:col-span-3" aria-label="Recent businesses">
            <div className="flex items-center justify-between px-5 pt-5">
              <h3 className="text-[15px] font-semibold text-[#1A1A1A]">Recent businesses</h3>
              <button
                type="button"
                onClick={() => setTab('businesses')}
                className="text-xs font-semibold text-[#967221] hover:underline"
              >
                View all
              </button>
            </div>
            <div className="px-5 pb-2">
              {tenantsError ? (
                <p className="py-6 text-sm text-[#B42318]">Businesses could not be loaded — see the error above.</p>
              ) : tenants === null ? (
                <RowSkeletons rows={4} />
              ) : tenants.length === 0 ? (
                <EmptyState
                  icon={Inbox}
                  title="No businesses yet"
                  body="Provision your first business and its owner account to see it here."
                  action={{ label: 'Add Business', onClick: openWizard }}
                />
              ) : (
                <div className="divide-y divide-[#E3E7E0]">
                  {recentTenants.map((t) => (
                    <RecentBusinessRow key={t.id} tenant={t} />
                  ))}
                </div>
              )}
            </div>
          </section>

          <section className="sp-card lg:col-span-2" aria-label="Recent activity">
            <div className="flex items-center justify-between px-5 pt-5">
              <h3 className="text-[15px] font-semibold text-[#1A1A1A]">Recent activity</h3>
              <button
                type="button"
                onClick={() => setTab('audit')}
                className="text-xs font-semibold text-[#967221] hover:underline"
              >
                View all
              </button>
            </div>
            <div className="px-5 pb-2">
              {logsError ? (
                <p className="py-6 text-sm text-[#B42318]">Activity could not be loaded — see the error above.</p>
              ) : logs === null ? (
                <RowSkeletons rows={4} />
              ) : logs.length === 0 ? (
                <EmptyState
                  icon={ScrollText}
                  title="No activity yet"
                  body="Platform actions will be recorded here as they happen."
                />
              ) : (
                <div className="divide-y divide-[#E3E7E0]">
                  {recentLogs.map((log) => (
                    <ActivityRow key={log.id} log={log} />
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    );
  };

  const renderBusinessDetailFields = (t: Tenant) => (
    <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <div>
        <dt className="text-[11px] font-medium uppercase tracking-wide text-[#969696]">Owner email</dt>
        <dd className="mt-0.5 flex items-center gap-1">
          <span className="break-all text-[13px] font-medium text-[#1A1A1A]">{t.owner_email || '—'}</span>
          {t.owner_email && <CopyValueButton value={t.owner_email} label="Owner email" />}
        </dd>
      </div>
      <div>
        <dt className="text-[11px] font-medium uppercase tracking-wide text-[#969696]">Status</dt>
        <dd className="mt-0.5">
          <StatusChip status={t.status} />
        </dd>
      </div>
      <div>
        <dt className="text-[11px] font-medium uppercase tracking-wide text-[#969696]">Business ID</dt>
        <dd className="mt-0.5 flex items-center gap-1">
          <span className="text-[13px] font-medium text-[#1A1A1A]" title={t.id}>
            {shortId(t.id)}
          </span>
          <CopyValueButton value={t.id} label="Business ID" />
        </dd>
      </div>
      <div>
        <dt className="text-[11px] font-medium uppercase tracking-wide text-[#969696]">Type</dt>
        <dd className="mt-0.5 text-[13px] font-medium capitalize text-[#1A1A1A]">{t.business_type || '—'}</dd>
      </div>
      <div>
        <dt className="text-[11px] font-medium uppercase tracking-wide text-[#969696]">City</dt>
        <dd className="mt-0.5 text-[13px] font-medium text-[#1A1A1A]">{t.city || '—'}</dd>
      </div>
      <div>
        <dt className="text-[11px] font-medium uppercase tracking-wide text-[#969696]">Created</dt>
        <dd className="mt-0.5 whitespace-nowrap text-[13px] font-medium text-[#1A1A1A]">{formatDate(t.created_at)}</dd>
      </div>
    </dl>
  );

  const renderBusinesses = () => (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-[#1A1A1A]">
          Businesses
          {tenants !== null && !tenantsError && (
            <span className="ml-2 text-sm font-medium text-[#969696]">{tenants.length}</span>
          )}
        </h2>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search
              size={16}
              aria-hidden
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#969696]"
            />
            <input
              type="search"
              value={businessQuery}
              onChange={(e) => setBusinessQuery(e.target.value)}
              placeholder="Search name, slug, city"
              aria-label="Search businesses by name, slug or city"
              className="sp-input h-11 w-full pl-10 pr-4 text-sm sm:w-64"
              style={{ borderRadius: 9999 }}
            />
          </div>
          <button
            type="button"
            onClick={openWizard}
            className="sp-cta inline-flex h-11 items-center gap-2 rounded-xl px-4 text-[13px]"
          >
            <Plus size={16} aria-hidden />
            Add Business
          </button>
        </div>
      </div>

      {tenantsError ? (
        <ErrorCard
          title="Businesses could not be loaded"
          message={tenantsError}
          onRetry={() => void load()}
        />
      ) : tenants === null ? (
        <div className="sp-card">
          <RowSkeletons rows={6} />
        </div>
      ) : tenants.length === 0 ? (
        <div className="sp-card">
          <EmptyState
            icon={Building2}
            title="No businesses yet"
            body="Provision your first business and its owner account."
            action={{ label: 'Add Business', onClick: openWizard }}
          />
        </div>
      ) : filteredTenants.length === 0 ? (
        <div className="sp-card">
          <EmptyState
            icon={Search}
            title="No matches"
            body={`No businesses match “${businessQuery.trim()}”. Try a different name, slug or city.`}
          />
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="sp-card hidden overflow-hidden md:block">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">All provisioned businesses</caption>
              <thead>
                <tr className="bg-[#F6F5F2] text-[11px] uppercase tracking-wide text-[#6B6B6B]">
                  <th scope="col" className="px-4 py-3 font-medium">Name</th>
                  <th scope="col" className="px-4 py-3 font-medium">Type</th>
                  <th scope="col" className="px-4 py-3 font-medium">City</th>
                  <th scope="col" className="px-4 py-3 font-medium">Owner email</th>
                  <th scope="col" className="px-4 py-3 font-medium">Status</th>
                  <th scope="col" className="px-4 py-3 font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {filteredTenants.map((t) => {
                  const expanded = expandedTenantId === t.id;
                  return (
                    <React.Fragment key={t.id}>
                      <tr
                        onClick={() => setExpandedTenantId(expanded ? null : t.id)}
                        className={`cursor-pointer border-t border-[#E3E7E0] transition-colors ${
                          expanded ? 'bg-[#F6F5F2]' : 'hover:bg-[#F6F5F2]/60'
                        }`}
                      >
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              aria-expanded={expanded}
                              aria-label={`${expanded ? 'Hide' : 'Show'} details for ${t.name}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedTenantId(expanded ? null : t.id);
                              }}
                              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#6B6B6B] hover:bg-[#E3E7E0]"
                            >
                              <ChevronDown
                                size={16}
                                aria-hidden
                                className={`transition-transform ${expanded ? 'rotate-180' : ''}`}
                              />
                            </button>
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-[#1A1A1A]">{t.name}</p>
                              <span className="mt-1 inline-flex">
                                <SlugChip slug={t.slug} />
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 capitalize text-[#6B6B6B]">{t.business_type || '—'}</td>
                        <td className="px-4 py-3.5 text-[#6B6B6B]">{t.city || '—'}</td>
                        <td className="max-w-[220px] truncate px-4 py-3.5 text-[#6B6B6B]">{t.owner_email || '—'}</td>
                        <td className="px-4 py-3.5">
                          <StatusChip status={t.status} />
                        </td>
                        <td className="whitespace-nowrap px-4 py-3.5 text-[#6B6B6B]">{formatDate(t.created_at)}</td>
                      </tr>
                      {expanded && (
                        <tr className="border-t border-[#E3E7E0]">
                          <td colSpan={6} className="bg-[#F6F5F2] px-4 py-4">
                            {renderBusinessDetailFields(t)}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile stacked cards */}
          <div className="space-y-3 md:hidden">
            {filteredTenants.map((t) => {
              const expanded = expandedTenantId === t.id;
              return (
                <div key={t.id} className="sp-card p-4">
                  <div
                    onClick={() => setExpandedTenantId(expanded ? null : t.id)}
                    className="cursor-pointer"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-[#1A1A1A]">{t.name}</p>
                        <span className="mt-1.5 inline-flex">
                          <SlugChip slug={t.slug} />
                        </span>
                      </div>
                      <StatusChip status={t.status} />
                    </div>
                    <dl className="mt-3 space-y-1.5 text-[13px]">
                      <div className="flex justify-between gap-3">
                        <dt className="text-[#969696]">Type</dt>
                        <dd className="truncate capitalize text-[#1A1A1A]">{t.business_type || '—'}</dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-[#969696]">City</dt>
                        <dd className="truncate text-[#1A1A1A]">{t.city || '—'}</dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-[#969696]">Created</dt>
                        <dd className="whitespace-nowrap text-[#1A1A1A]">{formatDate(t.created_at)}</dd>
                      </div>
                    </dl>
                  </div>
                  <button
                    type="button"
                    aria-expanded={expanded}
                    aria-label={`${expanded ? 'Hide' : 'Show'} details for ${t.name}`}
                    onClick={() => setExpandedTenantId(expanded ? null : t.id)}
                    className="mt-3 flex h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-[#E3E7E0] text-[13px] font-medium text-[#0F3D3E] hover:bg-[#F6F5F2]"
                  >
                    {expanded ? 'Hide details' : 'View details'}
                    <ChevronDown size={15} aria-hidden className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
                  </button>
                  {expanded && (
                    <div className="mt-3 rounded-xl bg-[#F6F5F2] p-4">{renderBusinessDetailFields(t)}</div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );

  const renderSubscriptions = () => {
    const rows = subs ?? [];
    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-semibold text-[#1A1A1A]">Subscriptions</h2>
          <span
            className="inline-flex h-11 items-center gap-2 rounded-full border border-[#E3E7E0] bg-white px-4 text-sm"
            role="status"
            aria-label={`Monthly recurring revenue ${formatMoney(mrr)}`}
          >
            <TrendingUp size={15} className="text-[#0F3D3E]" aria-hidden />
            <span className="font-medium text-[#6B6B6B]">MRR</span>
            <span className="font-bold text-[#1A1A1A]">{formatMoney(mrr)}</span>
          </span>
        </div>

        {subsError ? (
          <ErrorCard
            title="Subscriptions could not be loaded"
            message={subsError}
            onRetry={() => void load()}
          />
        ) : subs === null ? (
          <div className="sp-card">
            <RowSkeletons rows={5} />
          </div>
        ) : rows.length === 0 ? (
          <div className="sp-card">
            <EmptyState
              icon={CreditCard}
              title="No subscriptions yet"
              body="Subscriptions appear here once businesses are provisioned."
            />
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="sp-card hidden overflow-hidden md:block">
              <table className="w-full text-left text-sm">
                <caption className="sr-only">All business subscriptions</caption>
                <thead>
                  <tr className="bg-[#F6F5F2] text-[11px] uppercase tracking-wide text-[#6B6B6B]">
                    <th scope="col" className="px-4 py-3 font-medium">Business</th>
                    <th scope="col" className="px-4 py-3 font-medium">Plan</th>
                    <th scope="col" className="px-4 py-3 font-medium">Billing cycle</th>
                    <th scope="col" className="px-4 py-3 text-right font-medium">Monthly price</th>
                    <th scope="col" className="px-4 py-3 text-right font-medium">Final rate</th>
                    <th scope="col" className="px-4 py-3 font-medium">Status</th>
                    <th scope="col" className="px-4 py-3 text-right font-medium">Next charge</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((s) => (
                    <tr key={s.id} className="border-t border-[#E3E7E0] hover:bg-[#F6F5F2]/60">
                      <td className="px-4 py-3.5 font-semibold text-[#1A1A1A]">
                        {tenantNameById.get(s.tenant_id) || '—'}
                      </td>
                      <td className="px-4 py-3.5 capitalize text-[#6B6B6B]">{s.plan_id}</td>
                      <td className="px-4 py-3.5 capitalize text-[#6B6B6B]">{s.billing_cycle}</td>
                      <td className="px-4 py-3.5 text-right tabular-nums text-[#6B6B6B]">{formatMoney(s.monthly_price)}</td>
                      <td className="px-4 py-3.5 text-right font-bold tabular-nums text-[#0F3D3E]">
                        {formatMoney(s.final_monthly_rate ?? s.monthly_price ?? 0)}
                      </td>
                      <td className="px-4 py-3.5">
                        <StatusChip status={s.status} />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-right align-top">
                        {(() => {
                          const cell = billingCell(s);
                          return (
                            <>
                              <p className={cell.urgent ? 'font-semibold text-[#B42318]' : 'text-[#6B6B6B]'}>
                                {cell.primary}
                              </p>
                              {cell.secondary && (
                                <p className={`text-[11px] ${cell.urgent ? 'font-medium text-[#B42318]' : 'text-[#969696]'}`}>
                                  {cell.secondary}
                                </p>
                              )}
                            </>
                          );
                        })()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile stacked cards */}
            <div className="space-y-3 md:hidden">
              {rows.map((s) => (
                <div key={s.id} className="sp-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 truncate font-semibold text-[#1A1A1A]">
                      {tenantNameById.get(s.tenant_id) || '—'}
                    </p>
                    <StatusChip status={s.status} />
                  </div>
                  <dl className="mt-3 space-y-1.5 text-[13px]">
                    <div className="flex justify-between gap-3">
                      <dt className="text-[#969696]">Plan</dt>
                      <dd className="capitalize text-[#1A1A1A]">{s.plan_id}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-[#969696]">Billing cycle</dt>
                      <dd className="capitalize text-[#1A1A1A]">{s.billing_cycle}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-[#969696]">Monthly price</dt>
                      <dd className="tabular-nums text-[#1A1A1A]">{formatMoney(s.monthly_price)}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-[#969696]">Final rate</dt>
                      <dd className="font-bold tabular-nums text-[#0F3D3E]">
                        {formatMoney(s.final_monthly_rate ?? s.monthly_price ?? 0)}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-[#969696]">Next charge</dt>
                      <dd className="text-right text-[#1A1A1A]">
                        {(() => {
                          const cell = billingCell(s);
                          return (
                            <>
                              <span className={`block ${cell.urgent ? 'font-semibold text-[#B42318]' : ''}`}>
                                {cell.primary}
                              </span>
                              {cell.secondary && (
                                <span className={`block text-[11px] ${cell.urgent ? 'font-medium text-[#B42318]' : 'text-[#969696]'}`}>
                                  {cell.secondary}
                                </span>
                              )}
                            </>
                          );
                        })()}
                      </dd>
                    </div>
                  </dl>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    );
  };

  const renderAudit = () => (
    <div className="space-y-5">
      <h2 className="text-lg font-semibold text-[#1A1A1A]">Audit log</h2>
      {logsError ? (
        <ErrorCard title="Audit log could not be loaded" message={logsError} onRetry={() => void load()} />
      ) : logs === null ? (
        <div className="sp-card">
          <RowSkeletons rows={6} />
        </div>
      ) : logs.length === 0 ? (
        <div className="sp-card">
          <EmptyState
            icon={ScrollText}
            title="No activity yet"
            body="Platform actions will be recorded here as they happen."
          />
        </div>
      ) : (
        <div className="sp-card divide-y divide-[#E3E7E0] px-5 py-1">
          {logs.map((log) => (
            <div key={log.id} className="flex items-start gap-3 py-3.5">
              <div className="min-w-0 flex-1">
                <p className="break-words text-sm font-semibold text-[#1A1A1A]">{log.action}</p>
                {log.details && <p className="mt-0.5 break-words text-xs text-[#6B6B6B]">{log.details}</p>}
              </div>
              <div className="shrink-0 text-right">
                <p className="text-xs font-medium text-[#6B6B6B]">{log.actor_email || 'System'}</p>
                <p className="mt-0.5 text-xs text-[#969696]">{timeAgo(log.timestamp)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  /* ── chrome ── */

  return (
    <div className="flex min-h-screen bg-[#F6F5F2]">
      {/* Sidebar rail — collapses to icon rail below md */}
      <aside
        className="sp-scroll-dark sticky top-0 flex h-screen w-16 shrink-0 flex-col overflow-y-auto bg-[#0F3D3E] px-2 pb-4 pt-5 md:w-[228px] md:px-3"
        aria-label="Platform navigation"
      >
        {/* Logo */}
        <div className="mb-6 flex items-center justify-center gap-2.5 md:justify-start md:px-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#F6F1E9] p-1">
            <img src={brandMark} alt="ServePoint logo" className="h-full w-full object-contain" />
          </span>
          <span className="hidden min-w-0 md:block">
            <span className="block truncate text-[17px] font-semibold leading-tight text-white">
              ServePoint
            </span>
            <span className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-[#B88E2F]">
              Platform
            </span>
          </span>
        </div>

        {/* Nav tabs */}
        <nav className="flex flex-col gap-1" aria-label="Platform sections">
          {NAV.map((item) => {
            const active = tab === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                aria-current={active ? 'page' : undefined}
                title={item.label}
                className={`sp-nav-pill flex h-11 w-full items-center justify-center gap-3 rounded-xl px-0 text-[13.5px] font-medium md:justify-start md:px-4 ${
                  active
                    ? 'bg-[#B88E2F] text-white shadow-sm'
                    : 'text-white/70 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon size={17} strokeWidth={2} aria-hidden />
                <span className="hidden md:inline">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* User card */}
        <div className="mt-auto flex flex-col items-center rounded-2xl bg-white/8 p-2 md:items-stretch md:p-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#D9E2DD] text-base font-bold text-[#0F3D3E] md:h-12 md:w-12">
            {initial}
          </span>
          <span className="mt-2 hidden min-w-0 md:block">
            <span className="block truncate text-[13px] font-semibold text-white">
              {session?.name || 'Platform Operator'}
            </span>
            <span className="block truncate text-[11px] text-white/55">Platform Operator</span>
          </span>
          <button
            type="button"
            onClick={() => void handleSignOut()}
            disabled={signingOut}
            aria-label="Sign out"
            className="sp-cta mt-2 flex h-11 w-11 items-center justify-center rounded-xl md:w-full"
          >
            {signingOut ? (
              <Loader2 size={16} className="animate-spin" aria-hidden />
            ) : (
              <LogOut size={16} aria-hidden />
            )}
            <span className="ml-2 hidden md:inline">Sign out</span>
          </button>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex h-screen min-w-0 flex-1 flex-col">
        {/* Header strip */}
        <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-[#E3E7E0] bg-white px-4 md:px-8">
          <h1 className="sp-screen-title truncate">{TAB_TITLES[tab]}</h1>
          <span
            className="inline-flex h-8 shrink-0 items-center gap-2 rounded-full border border-[#E3E7E0] bg-white px-3 text-xs font-medium text-[#6B6B6B]"
            role="status"
            aria-label={`Supabase ${supabaseConnected ? 'connected' : 'off'}`}
          >
            <span
              className={`h-2 w-2 rounded-full ${supabaseConnected ? 'bg-[#2E7D32]' : 'bg-[#B42318]'}`}
              aria-hidden
            />
            Supabase: {supabaseConnected ? 'connected' : 'off'}
          </span>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="mx-auto max-w-[1120px]">
            {tab === 'dashboard' && renderDashboard()}
            {tab === 'businesses' && renderBusinesses()}
            {tab === 'subscriptions' && renderSubscriptions()}
            {tab === 'audit' && renderAudit()}
          </div>
        </main>
      </div>

      <ProvisioningWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onProvisioned={() => void load()}
      />
    </div>
  );
};
