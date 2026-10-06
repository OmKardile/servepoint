import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
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
import { daysUntil, planLabel, subscriptionWords, trialBucket, trialRelWords } from '../../lib/billing';
import { formatBillingDate as formatDate } from '../../lib/billing';
import { isSupabaseConfigured } from '../../lib/supabase';
import { useCopyAck, ackWord } from '../../lib/useCopyAck';
import { authService } from '../../lib/authService';
import { formatMoney } from '../../lib/prefs';
/* v5.279.0 — the "how fresh?" register rides lib/age's ageLong (timeAgo's
 * new home — a wait is not a preference); the stamp pair stands. */
import { ageLong } from '../../lib/age';
import { dayTime } from '../../lib/day';
import { appTimezone } from '../../lib/appday';
/* v5.286.0 — the console learned its address: the tab union lives in
 * lib/sectionPath beside the slugs it names (the ONE grammar home — the
 * slugs and the tab words can never drift). */
import {
  platformTabFromPath,
  platformPathForTab,
  PLATFORM_SLUGS,
  type PlatformTab,
} from '../../lib/sectionPath';
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

/* v5.286.0 — PlatformTab's union moved to lib/sectionPath (the slugs and
 * the tab words share ONE home); the NAV still spells the rail's words. */

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
/* v5.276.0 — the page's copy verbs ride the house's ONE door
 * (lib/clipboard); the local copyPlain — a byte-sibling of the wizard's
 * own local copyText — is retired with the other three hand-rolled
 * clipboard helpers. */

const CopyValueButton: React.FC<{ value: string; label: string; stopRowClick?: boolean }> = ({
  value,
  label,
  stopRowClick,
}) => {
  /* v5.277.0 — the ack rides the one home (lib/useCopyAck): the timer,
   * the re-arm and the cleanup live there now; a refused copy says so. */
  const [copied, runCopy] = useCopyAck();
  return (
    <button
      type="button"
      onClick={(e) => {
        /* v5.287.0 — stopRowClick: inside the businesses table's row
         * the copy tap must not fire the row's expand. */
        if (stopRowClick) e.stopPropagation();
        runCopy(value);
      }}
      aria-live="polite"
      aria-label={`${label} — copy to clipboard`}
      className="inline-flex h-6 items-center gap-1 rounded-md px-1.5 text-[11px] font-semibold text-[#0F3D3E] transition-colors hover:bg-[#E3E7E0]"
    >
      {copied === 'ok' ? (
        <>
          <Check size={12} aria-hidden className="text-[#2E7D32]" />
          <span className="text-[#2E7D32]">{ackWord(copied, 'Copy')}</span>
        </>
      ) : copied === 'fail' ? (
        <>
          <AlertTriangle size={12} aria-hidden className="text-[#8A5A00]" />
          <span className="text-[#8A5A00]">{ackWord(copied, 'Copy')}</span>
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

/* v5.288.0 — the event's one line for the support ticket: verb, details,
 * actor, stamp — joined by the house's own separator. The copy verb rides
 * the ONE breath (CopyValueButton → useCopyAck); no new clipboard code. */
function auditLineFor(log: AuditLogEntry): string {
  return [
    log.action,
    log.details,
    log.actor_email || 'System',
    dayTime(log.timestamp, appTimezone()),
  ]
    .filter(Boolean)
    .join(' · ');
}

/* v5.288.0 — the hunt chip's two voices: idle wears the card's own quiet
 * border, active wears the rail's strong teal (the same voice the active
 * nav pill speaks, scaled to a chip). The focus ring is the house's gold
 * ring, offset to the room's own floor. */
const HUNT_CHIP_IDLE =
  'inline-flex h-8 items-center rounded-full border border-[#E3E7E0] bg-white px-3 text-xs font-medium text-[#6B6B6B] transition-colors hover:bg-[#F6F5F2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B88E2F]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#F6F5F2]';
const HUNT_CHIP_ACTIVE =
  'inline-flex h-8 items-center rounded-full border border-transparent bg-[#0F3D3E] px-3 text-xs font-semibold text-white shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B88E2F]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#F6F5F2]';

/* v5.232.0 — the billing words' CLASS LAW, one place (the 5.196 shape: one
 * set, no fork — this time for ink, not stages): the primary's grey and the
 * secondary's 11px pair, urgent wearing the same amber-red every site
 * already spoke. THREE projections read it now — the subscriptions table,
 * the subscriptions card, and the businesses table's new status voice —
 * so the amber can never fork between surfaces again. */
const BillingWords: React.FC<{
  cell: ReturnType<typeof subscriptionWords>;
  block?: boolean;
}> = ({ cell, block }) => {
  const P = block ? 'span' : 'p';
  return (
    <>
      <P
        className={`${block ? 'block ' : ''}${
          cell.urgent ? 'font-semibold text-[#B42318]' : 'text-[#6B6B6B]'
        }`}
      >
        {cell.primary}
      </P>
      {cell.secondary && (
        <P
          className={`${block ? 'block ' : ''}text-[11px] ${
            cell.urgent ? 'font-medium text-[#B42318]' : 'text-[#969696]'
          }`}
        >
          {cell.secondary}
        </P>
      )}
    </>
  );
};

const SageChipIcon: React.FC<{ icon: React.ElementType }> = ({ icon: Icon }) => (
  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#D9E2DD] text-[#0F3D3E]">
    <Icon size={18} strokeWidth={2} aria-hidden />
  </span>
);

const KpiCard: React.FC<{
  icon: React.ElementType;
  label: string;
  value: string | number;
  hint?: string;
  hintTone?: 'urgent';
  /* v5.305.0 — the door: when a card carries one, the whole card is a
   * button that opens the room its number speaks for. */
  door?: { onClick: () => void; aria: string };
}> = ({
  icon,
  label,
  value,
  hint,
  hintTone,
  door,
}) => {
  const body = (
    <>
      <div className="flex items-center gap-3">
        <SageChipIcon icon={icon} />
        <p className="text-[13px] font-medium text-[#6B6B6B]">{label}</p>
      </div>
      <p className="mt-4 text-3xl font-bold tracking-tight text-[#1A1A1A]" aria-label={label}>
        {value}
      </p>
      {/* v5.232.0 — the walking question answered beside the number: who
          carries the MRR, when the nearest trial ends. The line's grey voice,
          honest silence when there is nothing to name.
          v5.304.0 — the tone slot: the urgent ink only when a card's story is
          genuinely last-days (the bucket's own law, the cell's own colors),
          the grey voice otherwise; the tooltip carries the full sentence so a
          truncated line never hides its own words, and the tone swap repaints
          on the house's transition instead of snapping. */}
      {hint && (
        <p
          title={hint}
          className={`mt-1.5 truncate text-[11.5px] transition-colors duration-300 ${
            hintTone === 'urgent' ? 'font-semibold text-[#B42318]' : 'font-medium text-[#969696]'
          }`}
        >
          {hint}
        </p>
      )}
    </>
  );
  if (!door) return <div className="sp-card p-5">{body}</div>;
  /* v5.305.0 — the door's own grammar: the card keeps its seat and its
   * look; the hairline warms to the sage hover tone, and the gold whisper
   * (the "View all" ink — the room's own affordance color) appears at the
   * top-right on hover AND keyboard focus, so a mouse user and a Tab user
   * see the same door open. The global focus ring answers the Tab key;
   * zero new colors. */
  return (
    <button
      type="button"
      onClick={door.onClick}
      aria-label={door.aria}
      className="sp-card group relative block w-full cursor-pointer p-5 text-left transition-colors duration-200 hover:border-[#D9E2DD]"
    >
      <ArrowUpRight
        size={16}
        aria-hidden
        className="absolute right-4 top-4 text-[#967221] opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100"
      />
      {body}
    </button>
  );
};

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

const RecentBusinessRow: React.FC<{
  tenant: Tenant;
  sub?: Subscription | null;
  /* v5.306.0 — the row door: when carried, the whole row is a button that
   * opens the businesses room at this very business, expanded. */
  door?: { onClick: () => void; aria: string };
}> = ({
  tenant,
  sub,
  door,
}) => {
  /* v5.232.0 — the strip hears the clock: a trialing business names its own
   * end date in the line it already speaks, the EXACT words the clock
   * says everywhere else (words.primary — no third phrasing). Active rows
   * stay calm — renewal urgency is not a thing the strip raises. */
  const cell = sub ? billingCell(sub) : null;
  const trialClause = cell && (sub?.status === 'trialing' || sub?.status === 'trial') && cell.primary !== '—' ? cell.primary : null;
  const body = (
    <>
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
          {trialClause && (
            <>
              {' · '}
              <span className={cell?.urgent ? 'font-semibold text-[#B42318]' : 'font-medium text-[#6B6B6B]'}>{trialClause}</span>
            </>
          )}
        </p>
      </div>
      <StatusChip status={tenant.status} />
    </>
  );
  if (!door) return <div className="flex items-center gap-3 py-3.5">{body}</div>;
  /* v5.306.0 — the door's own grammar: the row keeps its anatomy and its
   * seat; the hover warms to the house's own soft row tone (#F6F5F2 — the
   * wizard's row hover, zero new colors) with the tint bleeding a breath
   * past the text so the whole row reads as one target; the global focus
   * ring answers the Tab key. */
  return (
    <button
      type="button"
      onClick={door.onClick}
      aria-label={door.aria}
      className="-mx-2 flex w-[calc(100%+16px)] items-center gap-3 rounded-lg px-2 py-3.5 text-left transition-colors duration-150 hover:bg-[#F6F5F2]"
    >
      {body}
    </button>
  );
};

/* v5.246.0 — the time word speaks BOTH registers (the drawer-card grammar,
 * 5.179): the age lib's ageLong answers "how fresh?" while dayTime(appTimezone()) stamps
 * the record's absolute when ("2 Oct · 10:14") — a stored sentence
 * re-rendered later re-derives its time-truth at the render boundary, so a
 * row ages from "3 hours ago · 17:28" into "3 days ago · 2 Oct · 10:14"
 * without ever reading like a lie. The stamp's class core is byte-equal in
 * both rooms (this strip and the Audit tab's ledger rows). */
const ActivityRow: React.FC<{ log: AuditLogEntry }> = ({ log }) => (
  <div className="flex items-start gap-3 py-3.5">
    <div className="min-w-0 flex-1">
      <p className="truncate text-sm font-semibold text-[#1A1A1A]">{log.action}</p>
      {log.details && <p className="mt-0.5 truncate text-xs text-[#6B6B6B]">{log.details}</p>}
    </div>
    <div className="shrink-0 text-right">
      <p className="text-xs font-medium text-[#6B6B6B]">{log.actor_email || 'System'}</p>
      <p className="mt-0.5 text-xs text-[#969696]">{ageLong(log.timestamp)}</p>
      <p className="mt-0.5 text-[11px] text-[#969696]">{dayTime(log.timestamp, appTimezone())}</p>
    </div>
  </div>
);

/* ──────────────────────────── main screen ──────────────────────────── */

export const PlatformScreen: React.FC = () => {
  const session = useSession((s) => s.session);

  /* v5.286.0 — the console learned its address (the walk found the rail's
   * four pills speaking pure state: /businesses fell to the 404 door, a
   * bookmark was impossible, a mid-session refresh threw the operator back
   * to Dashboard). THREE changes, ONE grammar:
   *   (1) the boot reads the address — a deep link (/businesses,
   *       /audit-log) or a mid-session refresh lands the operator in the
   *       room the path names (the same deep-link law the staff shell
   *       has spoken since v5.32.0); the bare root and unknown words
   *       keep Dashboard's throne (the boot default, not a path claim).
   *   (2) the ONE writer — every navigation act (rail pill, dashboard
   *       "View all") claims the address with replaceState, v5.235.0's
   *       doctrine byte-for-byte: no history pile, the Back key keeps
   *       its device-level meaning. The bare root keeps its throne —
   *       Dashboard writes '/' , never '/dashboard' — and a path that
   *       already names the running room keeps its own word (a deep
   *       link at /audit is not silently rewritten to /audit-log).
   * The reader and the writer ask the same closure (lib/sectionPath) —
   * three platform readers (the door in App.tsx, this boot read, the
   * write-back), one grammar. */
  const [tab, setTabState] = useState<PlatformTab>(
    () => platformTabFromPath(window.location.pathname) ?? 'dashboard'
  );
  const setTab = useCallback((next: PlatformTab) => {
    setTabState(next);
    if (typeof window !== 'undefined' && typeof history !== 'undefined') {
      const path = window.location.pathname;
      const seg = path.split('/').filter(Boolean)[0];
      const alreadyNamesRoom = seg ? PLATFORM_SLUGS[seg] === next : next === 'dashboard';
      if (!alreadyNamesRoom) {
        history.replaceState(null, '', platformPathForTab(next));
      }
    }
  }, []);
  const [tenants, setTenants] = useState<Tenant[] | null>(null);
  const [tenantsError, setTenantsError] = useState<string | null>(null);
  const [subs, setSubs] = useState<Subscription[] | null>(null);
  const [subsError, setSubsError] = useState<string | null>(null);
  const [logs, setLogs] = useState<AuditLogEntry[] | null>(null);
  const [logsError, setLogsError] = useState<string | null>(null);
  const [businessQuery, setBusinessQuery] = useState('');
  /* v5.288.0 — the audit log learns the hunt: the room's own query and the
   * verb chip it is standing on (null = All). Two filters that compose. */
  const [auditQuery, setAuditQuery] = useState('');
  const [auditVerb, setAuditVerb] = useState<string | null>(null);
  /* v5.289.0 — the businesses room joins the hunt: its own status census
   * chip (null = All), composing with the search exactly as the audit
   * room's verb chip composes. */
  const [businessStatus, setBusinessStatus] = useState<string | null>(null);
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
      fetchAuditLogs(),
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

  /* v5.232.0 — the businesses' own clock, joined once: every business voice
   * (the table's status cell, the details panel, the dashboard's strip and
   * hints) reads this Map — one join, no per-row finds, one register. */
  const subByTenantId = useMemo(
    () => new Map((subs ?? []).map((s) => [s.tenant_id, s] as const)),
    [subs]
  );

  /* v5.289.0 — the status census read from the tenants themselves (the
   * hunt's own law: no invented values), loudest first, ties alphabetical. */
  const businessStatuses = useMemo(() => {
    const counts = new Map<string, number>();
    for (const t of tenants ?? [])
      counts.set(t.status || 'unknown', (counts.get(t.status || 'unknown') || 0) + 1);
    return [...counts.entries()]
      .map(([status, count]) => ({ status, count }))
      .sort((a, b) => b.count - a.count || a.status.localeCompare(b.status));
  }, [tenants]);

  const filteredTenants = useMemo(() => {
    const q = businessQuery.trim().toLowerCase();
    return (tenants ?? []).filter(
      (t) =>
        (businessStatus === null || t.status === businessStatus) &&
        (t.name.toLowerCase().includes(q) ||
          t.slug.toLowerCase().includes(q) ||
          (t.city || '').toLowerCase().includes(q))
    );
  }, [tenants, businessQuery, businessStatus]);

  const recentTenants = useMemo(() => (tenants ?? []).slice(0, 5), [tenants]);
  const recentLogs = useMemo(() => (logs ?? []).slice(0, 10), [logs]);

  /* v5.288.0 — the hunt's own census: each distinct verb with its count,
   * loudest first (ties walk alphabetical). The chips read this; the room
   * never invents a verb the ledger does not carry. */
  const auditVerbs = useMemo(() => {
    const counts = new Map<string, number>();
    for (const log of logs ?? []) counts.set(log.action, (counts.get(log.action) || 0) + 1);
    return [...counts.entries()]
      .map(([verb, count]) => ({ verb, count }))
      .sort((a, b) => b.count - a.count || a.verb.localeCompare(b.verb));
  }, [logs]);

  /* The hunt composes BOTH filters: the chip's verb (exact match) AND the
   * query (case-insensitive across action, actor and details). */
  const filteredLogs = useMemo(() => {
    const q = auditQuery.trim().toLowerCase();
    return (logs ?? []).filter((log) => {
      if (auditVerb !== null && log.action !== auditVerb) return false;
      if (!q) return true;
      return (
        log.action.toLowerCase().includes(q) ||
        (log.actor_email || '').toLowerCase().includes(q) ||
        log.details.toLowerCase().includes(q)
      );
    });
  }, [logs, auditQuery, auditVerb]);

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

    /* v5.232.0 — the walking questions answered beside the numbers: who
     * carries the MRR, when the money next moves, when the nearest trial
     * ends, where the fleet lives. Every hint derives from registers already
     * in scope; silence when there is nothing honest to name. */
    const activeSubs = (subs ?? []).filter((s) => s.status === 'active');
    const payingSubs = activeSubs.filter((s) => (s.final_monthly_rate ?? s.monthly_price ?? 0) > 0);
    let mrrHint: string | undefined;
    if (payingSubs.length === 1) {
      mrrHint = `from ${tenantNameById.get(payingSubs[0].tenant_id) || '—'} · ${planLabel(payingSubs[0].plan_id)}`;
    } else if (payingSubs.length > 1) {
      mrrHint = `from ${payingSubs.length} paying subscriptions`;
    }
    const nextCharges = activeSubs
      .map((s) => s.next_billing_at)
      .filter((d): d is string => !!d)
      .sort();
    const activeSubsHint =
      nextCharges.length > 0 ? `next charge ${formatDate(nextCharges[0])}` : undefined;
    /* v5.304.0 — the Trials card hears the clock's WHOLE sentence: which
     * business carries the nearest end, the same relative words the rows
     * speak (trialRelWords — no third phrasing), the date in the owner's
     * grammar, and the urgent ink only when the shared bucket law says
     * 'last' (≤3 days — the cell's own threshold, zero new colors). The
     * nearest is the nearest LIVE window when one exists; a passed window
     * is named only when every window has passed, and the words still say
     * "window passed" — the sentence never lies about a dead trial. */
    const trialClocks = (subs ?? [])
      .filter((s) => (s.status === 'trialing' || s.status === 'trial') && !!s.trial_end)
      .map((s) => ({ sub: s, end: s.trial_end as string, d: daysUntil(s.trial_end as string) }))
      .filter((t) => !Number.isNaN(t.d));
    const liveTrials = trialClocks.filter((t) => t.d >= 0).sort((a, b) => a.end.localeCompare(b.end));
    const passedTrials = trialClocks.filter((t) => t.d < 0).sort((a, b) => b.end.localeCompare(a.end));
    const nearestTrial = liveTrials[0] ?? passedTrials[0];
    const trialsHint = nearestTrial
      ? `${tenantNameById.get(nearestTrial.sub.tenant_id) || '—'} · ${trialRelWords(nearestTrial.d)} · ${formatDate(nearestTrial.end)}`
      : undefined;
    const trialsUrgent = nearestTrial ? trialBucket(nearestTrial.d) === 'last' : false;
    /* v5.305.0 — the Trials door's filter word: the value the room's OWN
     * census chip would carry for trials (the chips derive from the
     * tenants' statuses — 'trial' or 'trialing' — never an invented word),
     * null when no trial exists so the door forgets the filter honestly. */
    const trialChipStatus =
      businessStatuses.find((b) => b.status === 'trial' || b.status === 'trialing')?.status ?? null;
    const cities = [...new Set((tenants ?? []).map((t) => (t.city || '').trim()).filter(Boolean))];
    const businessesHint =
      cities.length === 1 ? cities[0] : cities.length > 1 ? cities.join(' · ') : undefined;

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
              {/* v5.305.0 — the cards become doors: each KPI opens the room
               * its number speaks for, landed in the state that makes its
               * own number TRUE — Total businesses opens the businesses
               * room with the census reset to All; the money cards open
               * the subscriptions room; Trials opens the businesses room
               * at the trial chip the census itself derives (and without
               * any trial in the data, the door honestly forgets the
               * filter). The room's own setTab carries the URL sync. */}
              <KpiCard
                icon={Building2}
                label="Total businesses"
                value={tenantsError ? '—' : tenants?.length ?? 0}
                hint={businessesHint}
                door={{
                  onClick: () => {
                    setBusinessStatus(null);
                    setTab('businesses');
                  },
                  aria: 'Open the businesses room — all businesses',
                }}
              />
              <KpiCard
                icon={CreditCard}
                label="Active subscriptions"
                value={subsError ? '—' : activeSubscriptions}
                hint={activeSubsHint}
                door={{
                  onClick: () => setTab('subscriptions'),
                  aria: 'Open the subscriptions room',
                }}
              />
              <KpiCard
                icon={TrendingUp}
                label="Monthly recurring revenue"
                value={subsError ? '—' : formatMoney(mrr)}
                hint={mrrHint}
                door={{
                  onClick: () => setTab('subscriptions'),
                  aria: 'Open the subscriptions room',
                }}
              />
              <KpiCard
                icon={Hourglass}
                label="Trials"
                value={tenantsError ? '—' : trialTenants}
                hint={trialsHint}
                hintTone={trialsUrgent ? 'urgent' : undefined}
                door={
                  trialChipStatus
                    ? {
                        onClick: () => {
                          setBusinessStatus(trialChipStatus);
                          setTab('businesses');
                        },
                        aria: 'Open the businesses room filtered to trials',
                      }
                    : {
                        onClick: () => {
                          setBusinessStatus(null);
                          setTab('businesses');
                        },
                        aria: 'Open the businesses room',
                      }
                }
              />
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
                    <RecentBusinessRow
                      key={t.id}
                      tenant={t}
                      sub={subByTenantId.get(t.id)}
                      /* v5.306.0 — the row door lands the room in the state
                       * that makes the row true: the named business VISIBLE
                       * (the hunt reset — a filtered room could hide the very
                       * row the operator clicked) and EXPANDED, then the
                       * room's own setTab carries the URL sync. */
                      door={{
                        onClick: () => {
                          setBusinessQuery('');
                          setBusinessStatus(null);
                          setExpandedTenantId(t.id);
                          setTab('businesses');
                        },
                        aria: `Open ${t.name || 'business'} in the businesses room`,
                      }}
                    />
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

  const renderBusinessDetailFields = (t: Tenant) => {
    const sub = subByTenantId.get(t.id);
    return (
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
      {/* v5.232.0 — the details panel hears the clock too: the plan's own
          name (planLabel) and the subscription's words — the same words the
          tables speak, never a third phrasing. No subscription row: an
          honest dash, no invented plan. */}
      <div>
        <dt className="text-[11px] font-medium uppercase tracking-wide text-[#969696]">Plan</dt>
        <dd className="mt-0.5 text-[13px] font-medium text-[#1A1A1A]">{sub ? planLabel(sub.plan_id) : '—'}</dd>
      </div>
      <div>
        <dt className="text-[11px] font-medium uppercase tracking-wide text-[#969696]">Subscription</dt>
        <dd className="mt-0.5">{sub ? <BillingWords cell={billingCell(sub)} /> : <span className="text-[13px] font-medium text-[#1A1A1A]">—</span>}</dd>
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
  };

  const renderBusinesses = () => {
    /* v5.289.0 — the hunt's words for this room: the no-match card names
     * what was actually hunted (status chip, query, or both). */
    const needle = businessQuery.trim();
    const businessHuntWords = [
      businessStatus !== null ? `the status “${businessStatus}”` : '',
      needle ? `“${needle}”` : '',
    ]
      .filter(Boolean)
      .join(' and ');
    const filtering = businessStatus !== null || needle !== '';
    return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-[#1A1A1A]">
          Businesses
          {tenants !== null && !tenantsError && (
            /* v5.289.0 — the census answers from its own count: while the
             * room is filtered, "N of M"; the whole count when not. */
            <span className="ml-2 text-sm font-medium text-[#969696]">
              {filtering ? `${filteredTenants.length} of ${tenants.length}` : tenants.length}
            </span>
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
              className="sp-input h-11 w-full pl-10 pr-4 text-sm sm:w-72"
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
      {/* v5.289.0 — the status census: the hunt's own chip grammar riding
       * the SAME two voices the audit room speaks (one constant, zero
       * drift). "All" owns the null; a status chip toggles itself off on
       * the second tap; aria-pressed speaks the state. */}
      {tenants !== null && tenants.length > 0 && businessStatuses.length > 0 && (
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter the businesses by status">
          <button
            type="button"
            onClick={() => setBusinessStatus(null)}
            aria-pressed={businessStatus === null}
            className={businessStatus === null ? HUNT_CHIP_ACTIVE : HUNT_CHIP_IDLE}
          >
            All
            <span className="ml-1.5 text-[11px] opacity-70 tabular-nums">{tenants.length}</span>
          </button>
          {businessStatuses.map(({ status, count }) => (
            <button
              key={status}
              type="button"
              onClick={() => setBusinessStatus(businessStatus === status ? null : status)}
              aria-pressed={businessStatus === status}
              className={businessStatus === status ? HUNT_CHIP_ACTIVE : HUNT_CHIP_IDLE}
            >
              {status}
              <span className="ml-1.5 text-[11px] opacity-70 tabular-nums">{count}</span>
            </button>
          ))}
        </div>
      )}

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
            body={`No businesses match ${businessHuntWords}. Try a different name, slug or city.`}
          />
        </div>
      ) : (
        <>
          {/* Desktop table — v5.287.0 "the console's tables learn
              their belt": the crossover learns the rail's own appetite.
              Below lg the rail eats 228px and this table's columns
              clipped silently (measured at 768: 474px of card vs 696px
              of table — Status and Created simply vanished,
              overflow-hidden, no scrollbar, no ellipsis). The stacked
              cards — already proven at the phone — own the band below
              lg; the table owns lg and above, and the belt below
              (overflow-x-auto, the EOD escape's own convention)
              guarantees any future crunch degrades to a scroll, never
              a silent clip. */}
          <div className="sp-card hidden overflow-hidden lg:block">
            <div className="overflow-x-auto [scrollbar-width:thin]">
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
                        <td className="max-w-[220px] px-4 py-3.5 text-[#6B6B6B]">
                          {/* v5.287.0 — the handover: the email learns to
                              leave the row. The verb rides the one copy
                              breath (useCopyAck via CopyValueButton) and
                              stopRowClick keeps the row's expand out of
                              the tap; the address keeps truncate + title
                              so a long email never reflows the row, and
                              the button never squeezes (shrink-0 in the
                              verb's own classes). The full address and
                              its verdict still live in the detail panel
                              below — this is the one-tap shortcut, not a
                              second grammar. */}
                          <span className="flex items-center gap-1">
                            <span className="min-w-0 truncate" title={t.owner_email || undefined}>
                              {t.owner_email || '—'}
                            </span>
                            {t.owner_email && (
                              <CopyValueButton value={t.owner_email} label="Owner email" stopRowClick />
                            )}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          {/* v5.232.0 — the status cell hears the clock: the
                              chip keeps its word, and the business's own
                              subscription speaks beneath it — the SAME
                              words and ink the Subscriptions table speaks
                              (one join, one grammar, no fork). */}
                          <StatusChip status={t.status} />
                          {(() => {
                            const s = subByTenantId.get(t.id);
                            if (!s) return null;
                            return (
                              <div className="mt-1.5 max-w-[190px]">
                                <BillingWords cell={billingCell(s)} />
                              </div>
                            );
                          })()}
                        </td>
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
          </div>

          {/* Mobile stacked cards — the crossover climbs with the
              table's (v5.287.0): these cards own everything below lg. */}
          <div className="space-y-3 lg:hidden">
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
                      {/* v5.232.0 — the mobile card hears the clock: plan's
                          name and the subscription's words, the same law the
                          desktop cell speaks. */}
                      {(() => {
                        const s = subByTenantId.get(t.id);
                        if (!s) return null;
                        return (
                          <>
                            <div className="flex justify-between gap-3">
                              <dt className="text-[#969696]">Plan</dt>
                              <dd className="text-[#1A1A1A]">{planLabel(s.plan_id)}</dd>
                            </div>
                            <div className="flex justify-between gap-3">
                              <dt className="text-[#969696]">Subscription</dt>
                              <dd className="text-right text-[#1A1A1A]">
                                <BillingWords cell={billingCell(s)} block />
                              </dd>
                            </div>
                          </>
                        );
                      })()}
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
  };

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
            {/* Desktop table — the same belt the businesses table
                wears (v5.287.0): seven columns and a whitespace-nowrap
                tail clipped Final rate at the card's own edge at 768;
                the cards own the band below lg, the belt keeps lg+
                honest forever. */}
            <div className="sp-card hidden overflow-hidden lg:block">
              <div className="overflow-x-auto [scrollbar-width:thin]">
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
                        <BillingWords cell={billingCell(s)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>

            {/* Mobile stacked cards — the crossover climbs with the
                table's (v5.287.0). */}
            <div className="space-y-3 lg:hidden">
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
                        <BillingWords cell={billingCell(s)} block />
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

  const renderAudit = () => {
    /* v5.288.0 — the hunt's words: when the operator is filtering, the
     * census answers with the filtered truth ("N of M events on record")
     * and the no-match card names what was actually hunted. */
    const needle = auditQuery.trim();
    const filtering = auditVerb !== null || needle !== '';
    const huntWords = [
      auditVerb !== null ? `the verb “${auditVerb}”` : '',
      needle ? `“${needle}”` : '',
    ]
      .filter(Boolean)
      .join(' and ');
    return (
    <div className="space-y-5">
      {/* v5.246.0 — the ledger speaks its own census: "N events on record"
       *  names the size the reader is reading (the 5.282 law — a register
       *  answers from its own count). Silent while loading; the empty
       *  state owns the zero. v5.288.0 — while hunting, the census
       *  answers with the filtered count ("N of M"). */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[#1A1A1A]">Audit log</h2>
          {logs !== null && logs.length > 0 && (
            <p className="mt-0.5 text-xs text-[#6B6B6B]">
              {filtering
                ? `${filteredLogs.length} of ${logs.length} ${logs.length === 1 ? 'event' : 'events'} on record`
                : `${logs.length} ${logs.length === 1 ? 'event' : 'events'} on record`}
            </p>
          )}
        </div>
        {/* The hunt's field — the businesses room's own search grammar,
         * one byte-sibling input so the console speaks ONE search. */}
        <div className="relative">
          <Search
            size={16}
            aria-hidden
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#969696]"
          />
          <input
            type="search"
            value={auditQuery}
            onChange={(e) => setAuditQuery(e.target.value)}
            placeholder="Search verb, actor, business"
            aria-label="Search the audit log by verb, actor or business"
            className="sp-input h-11 w-full pl-10 pr-4 text-sm sm:w-72"
            style={{ borderRadius: 9999 }}
          />
        </div>
      </div>
      {/* The verb chips — the hunt's census, read from the ledger itself
       * (no invented verbs). "All" owns the null chip; a verb chip toggles
       * itself off on the second tap. aria-pressed speaks the state. */}
      {logs !== null && logs.length > 0 && auditVerbs.length > 0 && (
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter the log by verb">
          <button
            type="button"
            onClick={() => setAuditVerb(null)}
            aria-pressed={auditVerb === null}
            className={auditVerb === null ? HUNT_CHIP_ACTIVE : HUNT_CHIP_IDLE}
          >
            All
            <span className="ml-1.5 text-[11px] opacity-70 tabular-nums">{logs.length}</span>
          </button>
          {auditVerbs.map(({ verb, count }) => (
            <button
              key={verb}
              type="button"
              onClick={() => setAuditVerb(auditVerb === verb ? null : verb)}
              aria-pressed={auditVerb === verb}
              className={auditVerb === verb ? HUNT_CHIP_ACTIVE : HUNT_CHIP_IDLE}
            >
              {verb}
              <span className="ml-1.5 text-[11px] opacity-70 tabular-nums">{count}</span>
            </button>
          ))}
        </div>
      )}
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
      ) : filteredLogs.length === 0 ? (
        <div className="sp-card">
          <EmptyState
            icon={Search}
            title="No matches"
            body={`No events match ${huntWords}. Try a verb, an actor or a business.`}
          />
        </div>
      ) : (
        <div className="sp-card divide-y divide-[#E3E7E0] px-5 py-1">
          {filteredLogs.map((log) => (
            <div key={log.id} className="flex items-start gap-3 py-3.5">
              <div className="min-w-0 flex-1">
                {/* v5.288.0 — the row's headline learned to leave: the
                 * copy verb rides the quiet flex pair (min-w-0 keeps the
                 * verb's words wrapping, the button never squeezes) and
                 * carries the WHOLE event line for the support ticket. */}
                <div className="flex items-start gap-1.5">
                  <p className="min-w-0 break-words text-sm font-semibold text-[#1A1A1A]">{log.action}</p>
                  <CopyValueButton value={auditLineFor(log)} label="event line" />
                </div>
                {log.details && <p className="mt-0.5 break-words text-xs text-[#6B6B6B]">{log.details}</p>}
              </div>
              <div className="shrink-0 text-right">
                <p className="text-xs font-medium text-[#6B6B6B]">{log.actor_email || 'System'}</p>
                <p className="mt-0.5 text-xs text-[#969696]">{ageLong(log.timestamp)}</p>
                <p className="mt-0.5 text-[11px] text-[#969696]">{dayTime(log.timestamp, appTimezone())}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
    );
  };

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
                className={`sp-nav-pill relative flex h-11 w-full items-center justify-center gap-3 rounded-xl px-0 text-[13.5px] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B88E2F]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B2E2F] md:justify-start md:px-4 ${
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
