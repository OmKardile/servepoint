import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BadgePercent,
  Crown,
  Gift,
  Loader2,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  Repeat,
  Search,
  Sparkles,
  Trash2,
  Users,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import {
  createCustomer,
  createOffer,
  deleteCustomer,
  deleteOffer,
  fetchCustomerOrders,
  fetchCustomerStats,
  fetchCustomers,
  fetchOffers,
  subscribeCrmRealtime,
  updateCustomer,
  updateOffer,
  type CustomerInput,
  type OfferInput,
  type RealtimeState,
} from '../../lib/api';
import { formatMoney } from '../../lib/prefs';
import { useTenant } from '../../lib/tenant';
import { useCart } from '../../store/cart';
import { useUi } from '../../store/session';
import type { Customer, CustomerStats, Offer, Order } from '../../types';

/**
 * Guests (v5.5.0 — NOVA CRM parity, migration 016).
 *
 * Two tabs, one ledger truth:
 *   1. GUESTS — every phone that ever rode a ticket is on the books (the 016
 *      trigger upserts identity from orders). Visits and spend are NOT stored
 *      counters: v_customer_stats derives them from the orders ledger, so they
 *      cannot drift, and only PAID tickets count.
 *   2. OFFERS — percent/flat discounts with a minimum-order floor. Applying one
 *      at the counter writes a redemption ledger row (UNIQUE per order — the
 *      ONLY thing that bumps usage), the cart shows the live discount, and the
 *      guest QR menu banner picks active offers up automatically.
 *
 * Guests who walk in anonymous stay anonymous — the CRM never invents people.
 */

type TabKey = 'guests' | 'offers';

/* ─────────────────────────────── helpers ───────────────────────────────── */

function initials(name: string, phone: string): string {
  const n = name.trim();
  if (n) {
    const parts = n.split(/\s+/).slice(0, 2);
    return parts.map((w) => w.charAt(0).toUpperCase()).join('');
  }
  return phone.replace(/\D/g, '').slice(-2) || '·';
}

/** Paired avatar tones — deterministic by phone so a guest is always the same color. */
const AVATAR_TONES: { bg: string; text: string; ring: string }[] = [
  { bg: '#E8F3E9', text: '#2E7D32', ring: '#CBE3CD' },
  { bg: '#F6EAD8', text: '#8A5A00', ring: '#EED9B8' },
  { bg: '#E3EAF5', text: '#3B5BA5', ring: '#C9D6EE' },
  { bg: '#F5E6EC', text: '#A03E63', ring: '#EBCBDA' },
  { bg: '#EDEAF7', text: '#5B4BA5', ring: '#D8D2EE' },
];

function avatarTone(phone: string): { bg: string; text: string; ring: string } {
  let h = 0;
  for (let i = 0; i < phone.length; i++) h = (h * 31 + phone.charCodeAt(i)) >>> 0;
  return AVATAR_TONES[h % AVATAR_TONES.length];
}

/** Loyalty tier from LEDGER truth: only paid visits and paid rupees count. */
function tierOf(visits: number, spent: number): { label: string; cls: string } {
  if (visits >= 5 || spent >= 5000)
    return { label: 'VIP', cls: 'bg-[#B88E2F]/12 text-[#8A5A00] border-[#B88E2F]/30' };
  if (visits >= 2) return { label: 'Regular', cls: 'bg-[#E8F3E9] text-[#2E7D32] border-[#CBE3CD]' };
  return { label: 'New', cls: 'bg-[#F6F5F2] text-[#6B6B6B] border-[#E3E7E0]' };
}

function offerBadgeLabel(o: Offer): string {
  return o.discount_type === 'percent'
    ? `${Number(o.discount_value)}% off`
    : `${formatMoney(Number(o.discount_value))} off`;
}

function fmtWhen(ts: string | null): string {
  if (!ts) return '—';
  const d = new Date(ts);
  const today = new Date();
  const dayMs = 86_400_000;
  const midnight = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((midnight(today) - midnight(d)) / dayMs);
  if (days <= 0) return `today ${d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}`;
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function orderStatusTone(s: string): string {
  if (s === 'completed') return 'bg-[#E8F3E9] text-[#2E7D32]';
  if (s === 'cancelled') return 'bg-[#FEECEB] text-[#B3261E]';
  if (s === 'ready') return 'bg-[#E8F0FE] text-[#3B5BA5]';
  return 'bg-[#FFF4DC] text-[#8A5A00]';
}

/* ─────────────────────────────── screen ────────────────────────────────── */

export const CustomersScreen: React.FC = () => {
  const [attempt, setAttempt] = useState(0);
  return <GuestsInner key={attempt} onTenantRetry={() => setAttempt((a) => a + 1)} />;
};

const GuestsInner: React.FC<{ onTenantRetry: () => void }> = ({ onTenantRetry }) => {
  const { tenantId, loading: tenantLoading, error: tenantError } = useTenant();
  const [tab, setTab] = useState<TabKey>('guests');
  const [guests, setGuests] = useState<Customer[]>([]);
  const [stats, setStats] = useState<Map<string, CustomerStats>>(new Map());
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rt, setRt] = useState<RealtimeState>('connecting');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  // dialogs / drawers
  const [guestForm, setGuestForm] = useState<{ mode: 'new' | 'edit'; customer: Customer | null; open: boolean }>({
    mode: 'new',
    customer: null,
    open: false,
  });
  const [offerForm, setOfferForm] = useState<{ mode: 'new' | 'edit'; offer: Offer | null; open: boolean }>({
    mode: 'new',
    offer: null,
    open: false,
  });
  const [deleteArm, setDeleteArm] = useState<string | null>(null);
  const [detailFor, setDetailFor] = useState<Customer | null>(null);

  const load = useCallback(async () => {
    if (!tenantId) return;
    setError(null);
    try {
      const [g, st, o] = await Promise.all([
        fetchCustomers(tenantId),
        fetchCustomerStats(tenantId),
        fetchOffers(tenantId),
      ]);
      setGuests(g);
      setStats(st);
      setOffers(o);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load guests from the cloud.');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [tenantId, load]);

  useEffect(() => {
    if (!tenantId) return;
    const unsub = subscribeCrmRealtime(tenantId, () => void load(), setRt);
    const poll = window.setInterval(() => void load(), 30_000);
    return () => {
      unsub();
      window.clearInterval(poll);
    };
  }, [tenantId, load]);

  /* mutations ─────────────────────────────────────────────────────────── */

  const saveGuest = useCallback(
    async (input: CustomerInput, id: string | null) => {
      setBusyId(id || 'new');
      setError(null);
      try {
        if (id) await updateCustomer(id, input);
        else await createCustomer(tenantId as string, input);
        setGuestForm({ mode: 'new', customer: null, open: false });
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not save the guest.');
      } finally {
        setBusyId(null);
      }
    },
    [tenantId, load]
  );

  const saveOffer = useCallback(
    async (input: OfferInput, id: string | null) => {
      setBusyId(id || 'new');
      setError(null);
      try {
        if (id) await updateOffer(id, input);
        else await createOffer(tenantId as string, input);
        setOfferForm({ mode: 'new', offer: null, open: false });
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not save the offer.');
      } finally {
        setBusyId(null);
      }
    },
    [tenantId, load]
  );

  const doDeleteGuest = useCallback(
    async (g: Customer) => {
      setBusyId(g.id);
      setError(null);
      try {
        await deleteCustomer(g.id);
        setDeleteArm(null);
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not remove the guest.');
      } finally {
        setBusyId(null);
      }
    },
    [load]
  );

  const doDeleteOffer = useCallback(
    async (o: Offer) => {
      setBusyId(o.id);
      setError(null);
      try {
        await deleteOffer(o.id);
        setDeleteArm(null);
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not delete the offer.');
      } finally {
        setBusyId(null);
      }
    },
    [load]
  );

  const toggleOffer = useCallback(
    async (o: Offer) => {
      setBusyId(o.id);
      setError(null);
      try {
        await updateOffer(o.id, {
          title: o.title,
          description: o.description ?? null,
          discount_type: o.discount_type,
          discount_value: Number(o.discount_value),
          min_order_amount: Number(o.min_order_amount),
          is_active: !o.is_active,
        });
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not update the offer.');
      } finally {
        setBusyId(null);
      }
    },
    [load]
  );

  /* derived ───────────────────────────────────────────────────────────── */

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return guests
      .filter((g) => {
        if (!q) return true;
        return (
          g.name.toLowerCase().includes(q) ||
          g.phone.toLowerCase().includes(q) ||
          (g.email || '').toLowerCase().includes(q) ||
          (g.notes || '').toLowerCase().includes(q)
        );
      })
      .map((g) => ({ g, s: stats.get(g.phone) || null }))
      .sort((a, b) => {
        // most valuable regulars float up: visits, then spend, then recency
        const va = a.s?.visits ?? 0;
        const vb = b.s?.visits ?? 0;
        if (va !== vb) return vb - va;
        const sa = Number(a.s?.total_spent ?? 0);
        const sb = Number(b.s?.total_spent ?? 0);
        if (sa !== sb) return sb - sa;
        return (a.s?.last_visit_at || a.g.created_at) > (b.s?.last_visit_at || b.g.created_at) ? -1 : 1;
      });
  }, [guests, stats, query]);

  const kpis = useMemo(() => {
    let regulars = 0;
    let vip = 0;
    let topName = '—';
    let topSpent = 0;
    for (const g of guests) {
      const s = stats.get(g.phone);
      const v = s?.visits ?? 0;
      const sp = Number(s?.total_spent ?? 0);
      if (v >= 5 || sp >= 5000) vip += 1;
      else if (v >= 2) regulars += 1;
      if (sp > topSpent) {
        topSpent = sp;
        topName = g.name || g.phone;
      }
    }
    return { total: guests.length, regulars, vip, topName, topSpent };
  }, [guests, stats]);

  const activeOffers = offers.filter((o) => o.is_active).length;

  /* tenant states ─────────────────────────────────────────────────────── */

  if (tenantLoading) {
    return (
      <div className="space-y-3 p-6">
        <div className="sp-skeleton h-10 w-56 rounded-xl" />
        <div className="sp-skeleton h-[120px] rounded-2xl" />
        <div className="sp-skeleton h-[280px] rounded-2xl" />
      </div>
    );
  }
  if (tenantError || !tenantId) {
    return (
      <div className="p-6">
        <div className="mx-auto max-w-md rounded-2xl border border-[#F5C6C0] bg-[#FEF2F2] p-5 text-center">
          <p className="text-[14px] font-semibold text-[#B42318]">Could not resolve your workspace</p>
          <p className="mt-1 text-[12.5px] text-[#B42318]/80">{tenantError || 'No workspace linked to this account.'}</p>
          <button
            type="button"
            onClick={onTenantRetry}
            className="sp-cta mt-4 inline-flex items-center gap-2 rounded-xl px-4 py-2 text-[13px]"
          >
            <RefreshCw size={14} aria-hidden /> Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col">
      {/* ── header ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 pt-6">
        <div>
          <h1 className="text-xl font-bold text-[#1A1A1A]">Guests</h1>
          <p className="mt-0.5 text-[12.5px] text-[#6B6B6B]">
            Regulars, their spend, and the offers that keep them coming back.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            title={rt === 'live' ? 'Realtime connected' : 'Polling every 30s'}
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
              rt === 'live' ? 'bg-[#E8F3E9] text-[#2E7D32]' : 'bg-[#F6F5F2] text-[#6B6B6B]'
            }`}
          >
            {rt === 'live' ? <Wifi size={12} aria-hidden /> : <WifiOff size={12} aria-hidden />}
            {rt === 'live' ? 'Live' : 'Poll'}
          </span>
          <button
            type="button"
            onClick={() => void load()}
            aria-label="Refresh"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#E3E7E0] bg-white text-[#6B6B6B] transition hover:border-[#C9CFC9] hover:text-[#1A1A1A]"
          >
            <RefreshCw size={15} aria-hidden />
          </button>
          {tab === 'guests' ? (
            <button
              type="button"
              onClick={() => setGuestForm({ mode: 'new', customer: null, open: true })}
              className="sp-cta inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-semibold"
            >
              <Plus size={15} aria-hidden /> Add guest
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setOfferForm({ mode: 'new', offer: null, open: true })}
              className="sp-cta inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-semibold"
            >
              <Plus size={15} aria-hidden /> New offer
            </button>
          )}
        </div>
      </div>

      {/* ── tabs ── */}
      <div className="mt-4 flex items-center gap-1 border-b border-[#E3E7E0] px-6">
        {(
          [
            { id: 'guests' as TabKey, label: 'Guests', icon: Users, count: guests.length },
            { id: 'offers' as TabKey, label: 'Offers', icon: Gift, count: offers.length },
          ]
        ).map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              aria-current={active ? 'page' : undefined}
              className={`relative flex items-center gap-2 px-4 py-3 text-[13.5px] font-semibold transition-colors ${
                active ? 'text-[#0F3D3E]' : 'text-[#6B6B6B] hover:text-[#1A1A1A]'
              }`}
            >
              <Icon size={15} aria-hidden />
              {t.label}
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10.5px] font-bold ${
                  active ? 'bg-[#B88E2F] text-white' : 'bg-[#F6F5F2] text-[#6B6B6B]'
                }`}
              >
                {t.count}
              </span>
              {active && <span className="absolute inset-x-3 -bottom-px h-[2.5px] rounded-full bg-[#B88E2F]" />}
            </button>
          );
        })}
      </div>

      {error && (
        <p role="alert" className="mx-6 mt-4 rounded-xl border border-[#F5C6C0] bg-[#FEF2F2] px-3.5 py-2.5 text-[12.5px] text-[#B42318]">
          {error}
        </p>
      )}

      {tab === 'guests' ? (
        <GuestsTab
          rows={rows}
          kpis={kpis}
          query={query}
          setQuery={setQuery}
          loading={loading}
          onEdit={(g) => setGuestForm({ mode: 'edit', customer: g, open: true })}
          onDelete={doDeleteGuest}
          deleteArm={deleteArm}
          setDeleteArm={setDeleteArm}
          busyId={busyId}
          onOpenDetail={setDetailFor}
        />
      ) : (
        <OffersTab
          offers={offers}
          loading={loading}
          onEdit={(o) => setOfferForm({ mode: 'edit', offer: o, open: true })}
          onToggle={toggleOffer}
          onDelete={doDeleteOffer}
          deleteArm={deleteArm}
          setDeleteArm={setDeleteArm}
          busyId={busyId}
          activeOffers={activeOffers}
        />
      )}

      {/* ── dialogs & drawers ── */}
      {guestForm.open && (
        <GuestDialog
          mode={guestForm.mode}
          customer={guestForm.customer}
          busy={busyId !== null}
          onClose={() => setGuestForm({ mode: 'new', customer: null, open: false })}
          onSave={(input) => saveGuest(input, guestForm.customer?.id ?? null)}
        />
      )}
      {offerForm.open && (
        <OfferDialog
          mode={offerForm.mode}
          offer={offerForm.offer}
          busy={busyId !== null}
          onClose={() => setOfferForm({ mode: 'new', offer: null, open: false })}
          onSave={(input) => saveOffer(input, offerForm.offer?.id ?? null)}
        />
      )}
      {detailFor && (
        <GuestDetailDrawer
          tenantId={tenantId}
          customer={detailFor}
          stats={stats.get(detailFor.phone) || null}
          onClose={() => setDetailFor(null)}
        />
      )}
    </div>
  );
};

/* ─────────────────────────────── guests tab ────────────────────────────── */

interface GuestRow {
  g: Customer;
  s: CustomerStats | null;
}

const GuestsTab: React.FC<{
  rows: GuestRow[];
  kpis: { total: number; regulars: number; vip: number; topName: string; topSpent: number };
  query: string;
  setQuery: (q: string) => void;
  loading: boolean;
  onEdit: (g: Customer) => void;
  onDelete: (g: Customer) => void;
  deleteArm: string | null;
  setDeleteArm: (id: string | null) => void;
  busyId: string | null;
  onOpenDetail: (g: Customer) => void;
}> = ({ rows, kpis, query, setQuery, loading, onEdit, onDelete, deleteArm, setDeleteArm, busyId, onOpenDetail }) => {
  if (loading) {
    return (
      <div className="space-y-3 px-6 py-5">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="sp-skeleton h-[64px] rounded-2xl" />
        ))}
      </div>
    );
  }
  return (
    <div className="px-6 py-5">
      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="sp-card px-4 py-3.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#969696]">Guests on the books</p>
          <p className="mt-1 text-2xl font-bold text-[#1A1A1A]">{kpis.total}</p>
        </div>
        <div className="sp-card px-4 py-3.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#969696]">Regulars · 2+ visits</p>
          <p className="mt-1 text-2xl font-bold text-[#2E7D32]">{kpis.regulars}</p>
        </div>
        <div className="sp-card px-4 py-3.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#969696]">VIPs</p>
          <p className="mt-1 flex items-center gap-1.5 text-2xl font-bold text-[#8A5A00]">
            <Crown size={17} aria-hidden /> {kpis.vip}
          </p>
        </div>
        <div className="sp-card px-4 py-3.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#969696]">Top spender</p>
          <p className="mt-1 truncate text-[15px] font-bold text-[#1A1A1A]">{kpis.topName}</p>
          {kpis.topSpent > 0 && <p className="text-[12px] font-semibold text-[#B88E2F]">{formatMoney(kpis.topSpent)} paid</p>}
        </div>
      </div>

      {/* search */}
      <div className="relative mt-5 max-w-sm">
        <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#969696]" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, phone, notes…"
          aria-label="Search guests"
          className="sp-input h-11 w-full pl-10 pr-3 text-[13.5px]"
        />
      </div>

      {/* list */}
      {rows.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-[#E3E7E0] bg-[#FBFAF7] px-6 py-12 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#F6F5F2] text-[#969696]">
            <Users size={20} aria-hidden />
          </span>
          <p className="mt-3 text-[14px] font-semibold text-[#1A1A1A]">
            {query ? 'No guests match that search' : 'No guests yet'}
          </p>
          <p className="mx-auto mt-1 max-w-sm text-[12.5px] leading-relaxed text-[#6B6B6B]">
            {query
              ? 'Try a different name or phone.'
              : 'Add one by hand, or just type a phone on the next ticket — every order with a phone books its guest here automatically.'}
          </p>
        </div>
      ) : (
        <ul className="mt-4 space-y-2.5">
          {rows.map(({ g, s }) => {
            const tone = avatarTone(g.phone);
            const tier = tierOf(s?.visits ?? 0, Number(s?.total_spent ?? 0));
            const visits = s?.visits ?? 0;
            const spent = Number(s?.total_spent ?? 0);
            const armed = deleteArm === g.id;
            return (
              <li key={g.id} className="sp-card group px-4 py-3.5 transition-shadow hover:shadow-md">
                <div className="flex items-center gap-3.5">
                  <button
                    type="button"
                    onClick={() => onOpenDetail(g)}
                    aria-label={`Open ${g.name || g.phone}`}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[13px] font-bold transition-transform hover:scale-105"
                    style={{ backgroundColor: tone.bg, color: tone.text, boxShadow: `0 0 0 2px ${tone.ring}` }}
                  >
                    {initials(g.name, g.phone)}
                  </button>
                  <button type="button" onClick={() => onOpenDetail(g)} className="min-w-0 flex-1 text-left">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-[14px] font-semibold text-[#1A1A1A]">{g.name || 'Unnamed guest'}</span>
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${tier.cls}`}>
                        {tier.label}
                      </span>
                    </span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px] text-[#6B6B6B]">
                      <span className="inline-flex items-center gap-1">
                        <Phone size={11} aria-hidden /> {g.phone}
                      </span>
                      {g.notes && <span className="truncate">· {g.notes}</span>}
                    </span>
                  </button>
                  <div className="hidden shrink-0 items-center gap-7 sm:flex">
                    <div className="text-right">
                      <p className="text-[10.5px] font-semibold uppercase tracking-wide text-[#969696]">Visits</p>
                      <p className={`text-[14px] font-bold ${visits > 0 ? 'text-[#1A1A1A]' : 'text-[#C9CFC9]'}`}>{visits}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10.5px] font-semibold uppercase tracking-wide text-[#969696]">Spent</p>
                      <p className={`text-[14px] font-bold ${spent > 0 ? 'text-[#2E7D32]' : 'text-[#C9CFC9]'}`}>
                        {formatMoney(spent)}
                      </p>
                    </div>
                    <div className="hidden w-24 text-right lg:block">
                      <p className="text-[10.5px] font-semibold uppercase tracking-wide text-[#969696]">Last visit</p>
                      <p className="text-[12.5px] font-semibold text-[#1A1A1A]">{fmtWhen(s?.last_visit_at ?? null)}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => onEdit(g)}
                      aria-label={`Edit ${g.name || g.phone}`}
                      className="flex h-9 w-9 items-center justify-center rounded-xl text-[#969696] transition hover:bg-[#F6F5F2] hover:text-[#1A1A1A]"
                    >
                      <Pencil size={14.5} aria-hidden />
                    </button>
                    <button
                      type="button"
                      onClick={() => (armed ? onDelete(g) : setDeleteArm(g.id))}
                      onBlur={() => deleteArm === g.id && setDeleteArm(null)}
                      aria-label={armed ? 'Confirm remove guest' : 'Remove guest'}
                      className={`flex h-9 w-9 items-center justify-center rounded-xl transition ${
                        armed ? 'bg-[#B3261E] text-white' : 'text-[#969696] hover:bg-[#FEECEB] hover:text-[#B3261E]'
                      }`}
                    >
                      {busyId === g.id ? <Loader2 size={14.5} className="animate-spin" aria-hidden /> : <Trash2 size={14.5} aria-hidden />}
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

/* ─────────────────────────────── offers tab ────────────────────────────── */

const OffersTab: React.FC<{
  offers: Offer[];
  loading: boolean;
  onEdit: (o: Offer) => void;
  onToggle: (o: Offer) => void;
  onDelete: (o: Offer) => void;
  deleteArm: string | null;
  setDeleteArm: (id: string | null) => void;
  busyId: string | null;
  activeOffers: number;
}> = ({ offers, loading, onEdit, onToggle, onDelete, deleteArm, setDeleteArm, busyId, activeOffers }) => {
  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-3 px-6 py-5 md:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="sp-skeleton h-[150px] rounded-2xl" />
        ))}
      </div>
    );
  }
  return (
    <div className="px-6 py-5">
      <p className="text-[12.5px] text-[#6B6B6B]">
        {offers.length === 0
          ? 'Offers appear in the counter’s order drawer the moment you create one.'
          : `${activeOffers} live · ${offers.length - activeOffers} paused — active offers show at the counter and on the guest QR menu.`}
      </p>
      {offers.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-[#E3E7E0] bg-[#FBFAF7] px-6 py-12 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#F6F5F2] text-[#969696]">
            <Gift size={20} aria-hidden />
          </span>
          <p className="mt-3 text-[14px] font-semibold text-[#1A1A1A]">No offers yet</p>
          <p className="mx-auto mt-1 max-w-sm text-[12.5px] leading-relaxed text-[#6B6B6B]">
            Create a “10% off” or “₹50 off over ₹300” — the counter picks it from a dropdown and the discount lands on the bill honestly.
          </p>
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {offers.map((o) => {
            const armed = deleteArm === o.id;
            const pct = o.discount_type === 'percent';
            return (
              <div
                key={o.id}
                className={`sp-card relative overflow-hidden px-4 py-4 transition-shadow hover:shadow-md ${o.is_active ? '' : 'opacity-70'}`}
              >
                {/* gold spine for active offers */}
                {o.is_active && <span className="absolute inset-y-0 left-0 w-1 bg-[#B88E2F]" aria-hidden />}
                <div className="flex items-start gap-3">
                  <span
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-[11px] font-bold leading-tight ${
                      pct ? 'bg-[#F6EAD8] text-[#8A5A00]' : 'bg-[#E8F3E9] text-[#2E7D32]'
                    }`}
                  >
                    {pct ? (
                      <span className="flex flex-col items-center">
                        <BadgePercent size={16} aria-hidden />
                        <span>{Number(o.discount_value)}%</span>
                      </span>
                    ) : (
                      <span className="flex flex-col items-center">
                        <Sparkles size={15} aria-hidden />
                        <span>flat</span>
                      </span>
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-[14.5px] font-bold text-[#1A1A1A]">{o.title}</p>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                          o.is_active ? 'bg-[#E8F3E9] text-[#2E7D32]' : 'bg-[#F6F5F2] text-[#969696]'
                        }`}
                      >
                        {o.is_active ? 'Live' : 'Paused'}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[13px] font-semibold text-[#B88E2F]">{offerBadgeLabel(o)}</p>
                    {o.description && (
                      <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-[#6B6B6B]">{o.description}</p>
                    )}
                    <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-[#6B6B6B]">
                      {Number(o.min_order_amount) > 0 && (
                        <span className="rounded-md bg-[#F6F5F2] px-1.5 py-0.5 font-medium">
                          min {formatMoney(Number(o.min_order_amount))}
                        </span>
                      )}
                      <span>
                        used <b className="text-[#1A1A1A]">{o.usage_count}</b>×
                      </span>
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-[#F0F1EE] pt-3">
                  <button
                    type="button"
                    onClick={() => onToggle(o)}
                    disabled={busyId === o.id}
                    className="inline-flex items-center gap-2 text-[12.5px] font-semibold text-[#6B6B6B] transition hover:text-[#1A1A1A] disabled:opacity-50"
                    aria-pressed={o.is_active}
                  >
                    {busyId === o.id ? (
                      <Loader2 size={14} className="animate-spin" aria-hidden />
                    ) : (
                      <span
                        className={`relative inline-flex h-4.5 w-8 items-center rounded-full transition-colors ${
                          o.is_active ? 'bg-[#2E7D32]' : 'bg-[#D5D9D3]'
                        }`}
                        aria-hidden
                      >
                        <span
                          className={`absolute h-3.5 w-3.5 rounded-full bg-white shadow transition-all ${
                            o.is_active ? 'left-[17px]' : 'left-[2px]'
                          }`}
                        />
                      </span>
                    )}
                    {o.is_active ? 'Active' : 'Paused'}
                  </button>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => onEdit(o)}
                      aria-label={`Edit ${o.title}`}
                      className="flex h-8.5 w-8.5 items-center justify-center rounded-xl text-[#969696] transition hover:bg-[#F6F5F2] hover:text-[#1A1A1A]"
                    >
                      <Pencil size={14} aria-hidden />
                    </button>
                    <button
                      type="button"
                      onClick={() => (armed ? onDelete(o) : setDeleteArm(o.id))}
                      onBlur={() => deleteArm === o.id && setDeleteArm(null)}
                      aria-label={armed ? 'Confirm delete offer' : 'Delete offer'}
                      className={`flex h-8.5 w-8.5 items-center justify-center rounded-xl transition ${
                        armed ? 'bg-[#B3261E] text-white' : 'text-[#969696] hover:bg-[#FEECEB] hover:text-[#B3261E]'
                      }`}
                    >
                      <Trash2 size={14} aria-hidden />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

/* ─────────────────────────────── guest dialog ──────────────────────────── */

const GuestDialog: React.FC<{
  mode: 'new' | 'edit';
  customer: Customer | null;
  busy: boolean;
  onClose: () => void;
  onSave: (input: CustomerInput) => void;
}> = ({ mode, customer, busy, onClose, onSave }) => {
  const [name, setName] = useState(customer?.name ?? '');
  const [phone, setPhone] = useState(customer?.phone ?? '');
  const [email, setEmail] = useState(customer?.email ?? '');
  const [notes, setNotes] = useState(customer?.notes ?? '');
  const [localErr, setLocalErr] = useState<string | null>(null);

  const submit = () => {
    if (!phone.trim()) return setLocalErr('A phone number is the guest’s key — it is required.');
    if (phone.replace(/\D/g, '').length < 6) return setLocalErr('That phone looks too short to be real.');
    setLocalErr(null);
    onSave({ name: name.trim(), phone: phone.trim(), email: email.trim() || null, notes: notes.trim() || null });
  };

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={mode === 'new' ? 'Add guest' : 'Edit guest'}>
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 h-full w-full cursor-default bg-[#0F3D3E]/45" />
      <div className="absolute left-1/2 top-1/2 w-[min(440px,92vw)] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-5 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-[16px] font-bold text-[#1A1A1A]">{mode === 'new' ? 'Add guest' : 'Edit guest'}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-[#969696] hover:bg-[#F6F5F2] hover:text-[#1A1A1A]">
            <X size={17} aria-hidden />
          </button>
        </div>
        <div className="mt-4 space-y-3">
          <div>
            <label htmlFor="gd-name" className="mb-1 block text-[12px] font-medium text-[#6B6B6B]">Name</label>
            <input id="gd-name" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Aarav Sharma" className="sp-input h-11 w-full px-3 text-[13.5px]" />
          </div>
          <div>
            <label htmlFor="gd-phone" className="mb-1 block text-[12px] font-medium text-[#6B6B6B]">Phone · required</label>
            <input id="gd-phone" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="98765 43210" className="sp-input h-11 w-full px-3 text-[13.5px]" />
          </div>
          <div>
            <label htmlFor="gd-email" className="mb-1 block text-[12px] font-medium text-[#6B6B6B]">Email</label>
            <input id="gd-email" type="email" value={email ?? ''} onChange={(e) => setEmail(e.target.value)} placeholder="Optional" className="sp-input h-11 w-full px-3 text-[13.5px]" />
          </div>
          <div>
            <label htmlFor="gd-notes" className="mb-1 block text-[12px] font-medium text-[#6B6B6B]">Notes</label>
            <textarea id="gd-notes" value={notes ?? ''} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Oat milk, window seat, birthday in March…" className="sp-input w-full px-3 py-2.5 text-[13.5px]" />
          </div>
        </div>
        {localErr && (
          <p role="alert" className="mt-3 rounded-xl border border-[#F5C6C0] bg-[#FEF2F2] px-3 py-2 text-[12.5px] text-[#B42318]">
            {localErr}
          </p>
        )}
        <div className="mt-4 flex items-center justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-xl px-4 py-2.5 text-[13px] font-semibold text-[#6B6B6B] transition hover:bg-[#F6F5F2] hover:text-[#1A1A1A]">
            Cancel
          </button>
          <button type="button" onClick={submit} disabled={busy} className="sp-cta inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-[13px] font-semibold">
            {busy && <Loader2 size={14} className="animate-spin" aria-hidden />}
            {mode === 'new' ? 'Add guest' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  );
};

/* ─────────────────────────────── offer dialog ──────────────────────────── */

const OfferDialog: React.FC<{
  mode: 'new' | 'edit';
  offer: Offer | null;
  busy: boolean;
  onClose: () => void;
  onSave: (input: OfferInput) => void;
}> = ({ mode, offer, busy, onClose, onSave }) => {
  const [title, setTitle] = useState(offer?.title ?? '');
  const [description, setDescription] = useState(offer?.description ?? '');
  const [dtype, setDtype] = useState<'percent' | 'flat'>(offer?.discount_type ?? 'percent');
  const [dvalue, setDvalue] = useState(offer ? String(Number(offer.discount_value)) : '10');
  const [minOrder, setMinOrder] = useState(offer ? String(Number(offer.min_order_amount)) : '0');
  const [isActive, setIsActive] = useState(offer?.is_active ?? true);
  const [localErr, setLocalErr] = useState<string | null>(null);

  const submit = () => {
    const v = Number(dvalue);
    const m = Number(minOrder);
    if (!title.trim()) return setLocalErr('Give the offer a name the counter will recognise.');
    if (!Number.isFinite(v) || v <= 0) return setLocalErr('The discount must be more than zero.');
    if (dtype === 'percent' && v > 100) return setLocalErr('A percent offer cannot exceed 100%.');
    if (!Number.isFinite(m) || m < 0) return setLocalErr('Minimum order cannot be negative.');
    setLocalErr(null);
    onSave({
      title: title.trim(),
      description: description.trim() || null,
      discount_type: dtype,
      discount_value: Math.round(v * 100) / 100,
      min_order_amount: Math.round(m * 100) / 100,
      is_active: isActive,
    });
  };

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={mode === 'new' ? 'New offer' : 'Edit offer'}>
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 h-full w-full cursor-default bg-[#0F3D3E]/45" />
      <div className="absolute left-1/2 top-1/2 w-[min(460px,92vw)] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-5 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-[16px] font-bold text-[#1A1A1A]">{mode === 'new' ? 'New offer' : 'Edit offer'}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-[#969696] hover:bg-[#F6F5F2] hover:text-[#1A1A1A]">
            <X size={17} aria-hidden />
          </button>
        </div>
        <div className="mt-4 space-y-3">
          <div>
            <label htmlFor="of-title" className="mb-1 block text-[12px] font-medium text-[#6B6B6B]">Name</label>
            <input id="of-title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Morning flat white" className="sp-input h-11 w-full px-3 text-[13.5px]" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="of-type" className="mb-1 block text-[12px] font-medium text-[#6B6B6B]">Discount type</label>
              <select id="of-type" value={dtype} onChange={(e) => setDtype(e.target.value as 'percent' | 'flat')} className="sp-input h-11 w-full px-3 text-[13.5px]">
                <option value="percent">Percent (%)</option>
                <option value="flat">Flat (₹)</option>
              </select>
            </div>
            <div>
              <label htmlFor="of-value" className="mb-1 block text-[12px] font-medium text-[#6B6B6B]">
                {dtype === 'percent' ? 'Percent off' : 'Rupees off'}
              </label>
              <input id="of-value" type="number" min="0" step={dtype === 'percent' ? 1 : 0.5} value={dvalue} onChange={(e) => setDvalue(e.target.value)} className="sp-input h-11 w-full px-3 text-[13.5px]" />
            </div>
          </div>
          <div>
            <label htmlFor="of-min" className="mb-1 block text-[12px] font-medium text-[#6B6B6B]">Minimum order (₹) · 0 = no floor</label>
            <input id="of-min" type="number" min="0" step="10" value={minOrder} onChange={(e) => setMinOrder(e.target.value)} className="sp-input h-11 w-full px-3 text-[13.5px]" />
          </div>
          <div>
            <label htmlFor="of-desc" className="mb-1 block text-[12px] font-medium text-[#6B6B6B]">Description</label>
            <textarea id="of-desc" value={description ?? ''} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Shows on the guest menu banner" className="sp-input w-full px-3 py-2.5 text-[13.5px]" />
          </div>
          <label className="flex cursor-pointer items-center gap-2.5">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="h-4 w-4 accent-[#B88E2F]" />
            <span className="text-[13px] font-medium text-[#1A1A1A]">Active — visible at the counter and to guests now</span>
          </label>
        </div>
        {localErr && (
          <p role="alert" className="mt-3 rounded-xl border border-[#F5C6C0] bg-[#FEF2F2] px-3 py-2 text-[12.5px] text-[#B42318]">
            {localErr}
          </p>
        )}
        <div className="mt-4 flex items-center justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-xl px-4 py-2.5 text-[13px] font-semibold text-[#6B6B6B] transition hover:bg-[#F6F5F2] hover:text-[#1A1A1A]">
            Cancel
          </button>
          <button type="button" onClick={submit} disabled={busy} className="sp-cta inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-[13px] font-semibold">
            {busy && <Loader2 size={14} className="animate-spin" aria-hidden />}
            {mode === 'new' ? 'Create offer' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  );
};

/* ───────────────────────────── guest detail drawer ─────────────────────── */

const GuestDetailDrawer: React.FC<{
  tenantId: string;
  customer: Customer;
  stats: CustomerStats | null;
  onClose: () => void;
}> = ({ tenantId, customer, stats, onClose }) => {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetchCustomerOrders(tenantId, customer.phone, 8)
      .then((o) => {
        if (alive) setOrders(o);
      })
      .catch((e) => {
        if (alive) setErr(e instanceof Error ? e.message : 'Could not load tickets.');
      });
    return () => {
      alive = false;
    };
  }, [tenantId, customer.phone]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const tone = avatarTone(customer.phone);
  const tier = tierOf(stats?.visits ?? 0, Number(stats?.total_spent ?? 0));
  const visits = stats?.visits ?? 0;
  const spent = Number(stats?.total_spent ?? 0);
  const placed = stats?.orders_placed ?? 0;

  /* "Their usual" (v5.54.0) — a regular's past ticket becomes today's cart:
     every line (qty + the addon-inclusive unit price the ledger froze) rides
     into the LIVE cart additively, the guest's identity pre-fills the
     drawer, and the cashier lands on Food & Drinks to review and place.
     Guard: every line must still point at a living menu item — a ticket
     whose item was de-listed cannot be repeated, and says so honestly. */
  const repeatable = (o: Order): boolean =>
    (o.items || []).length > 0 && (o.items || []).every((it) => Boolean(it.menu_item_id));

  const repeatOrder = (o: Order) => {
    const cart = useCart.getState();
    for (const it of o.items || []) {
      /* v5.56.0 — the ledger's frozen extras repeat too (a guest-placed
         "Large + Extra shot" no longer degrades to a bare Large). The RPC
         froze unit_price WITH the add-ons (017: price + delta + Σ addons),
         so the base is reconstructed by subtracting the snapshot back out —
         cart.add then re-folds the same extras into the exact same total.
         The snapshot's addon_id is not in the read payload, so id rides
         null — the column is SET NULL by design, a snapshot needs no
         living row. The variant keeps 5.54/5.55's delta-0 rule for the
         same reason. */
      const addonSnap = (it.addons || []).map((a) => ({
        id: null as string | null,
        name: a.name,
        price: Number(a.price),
      }));
      const addonSum = Math.round(addonSnap.reduce((s, a) => s + a.price, 0) * 100) / 100;
      const basePrice = Math.round((Number(it.unit_price) - addonSum) * 100) / 100;
      cart.add(
        { id: it.menu_item_id as string, name: it.name, price: basePrice, image_url: null, is_veg: null },
        it.qty,
        addonSnap,
        it.variant_name ? { name: it.variant_name, priceDelta: 0 } : null,
      );
    }
    cart.setCustomerName(customer.name || '');
    cart.setCustomerPhone(customer.phone);
    onClose();
    useUi.getState().goSection('food', ['Food & Drinks'], `repeat:${o.order_number}`);
  };

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={`Guest ${customer.name || customer.phone}`}>
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 h-full w-full cursor-default bg-[#0F3D3E]/45" />
      <div className="absolute inset-y-0 right-0 flex w-[min(430px,94vw)] flex-col bg-white shadow-2xl">
        {/* head */}
        <div className="border-b border-[#E3E7E0] px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <span
                className="flex h-12 w-12 items-center justify-center rounded-full text-[15px] font-bold"
                style={{ backgroundColor: tone.bg, color: tone.text, boxShadow: `0 0 0 2px ${tone.ring}` }}
              >
                {initials(customer.name, customer.phone)}
              </span>
              <div>
                <p className="text-[15.5px] font-bold text-[#1A1A1A]">{customer.name || 'Unnamed guest'}</p>
                <p className="text-[12.5px] text-[#6B6B6B]">{customer.phone}</p>
              </div>
            </div>
            <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-[#969696] hover:bg-[#F6F5F2] hover:text-[#1A1A1A]">
              <X size={17} aria-hidden />
            </button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className={`rounded-full border px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wide ${tier.cls}`}>{tier.label}</span>
            {customer.email && <span className="rounded-full bg-[#F6F5F2] px-2.5 py-1 text-[11px] text-[#6B6B6B]">{customer.email}</span>}
            {customer.notes && <span className="rounded-full bg-[#F6F5F2] px-2.5 py-1 text-[11px] text-[#6B6B6B]">“{customer.notes}”</span>}
          </div>
        </div>

        {/* ledger stats */}
        <div className="grid grid-cols-3 divide-x divide-[#F0F1EE] border-b border-[#E3E7E0] bg-[#FBFAF7]">
          <div className="px-4 py-3 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[#969696]">Paid visits</p>
            <p className="mt-0.5 text-[18px] font-bold text-[#1A1A1A]">{visits}</p>
          </div>
          <div className="px-4 py-3 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[#969696]">Paid total</p>
            <p className="mt-0.5 text-[18px] font-bold text-[#2E7D32]">{formatMoney(spent)}</p>
          </div>
          <div className="px-4 py-3 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[#969696]">All tickets</p>
            <p className="mt-0.5 text-[18px] font-bold text-[#1A1A1A]">{placed}</p>
          </div>
        </div>

        {/* tickets */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#969696]">Recent tickets</p>
          {err && <p className="mt-2 rounded-xl bg-[#FEF2F2] px-3 py-2 text-[12.5px] text-[#B42318]">{err}</p>}
          {orders === null && !err && (
            <div className="mt-3 space-y-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="sp-skeleton h-[64px] rounded-xl" />
              ))}
            </div>
          )}
          {orders && orders.length === 0 && (
            <p className="mt-3 rounded-xl bg-[#F6F5F2] px-3 py-4 text-center text-[12.5px] text-[#6B6B6B]">
              No tickets on this phone yet.
            </p>
          )}
          {orders && orders.length > 0 && (
            <ul className="mt-3 space-y-2.5">
              {orders.map((o) => (
                <li key={o.id} className="rounded-xl border border-[#E3E7E0] px-3.5 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13px] font-bold text-[#1A1A1A]">#{o.order_number}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${orderStatusTone(String(o.status))}`}>
                      {String(o.status).replace('_', ' ')}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-[12px] text-[#6B6B6B]">
                    {(o.items || []).map((it) => `${it.qty}× ${it.name}`).join(', ') || '—'}
                  </p>
                  <div className="mt-1.5 flex items-center justify-between text-[11.5px] text-[#969696]">
                    <span>{fmtWhen(o.created_at)} · {String(o.payment_status || 'pending')}</span>
                    <span className="font-semibold text-[#1A1A1A]">
                      {Number(o.discount_amount) > 0 && (
                        <span className="mr-1.5 text-[#2E7D32]">−{formatMoney(Number(o.discount_amount))}</span>
                      )}
                      {formatMoney(Number(o.total))}
                    </span>
                  </div>
                  {repeatable(o) ? (
                    <button
                      type="button"
                      onClick={() => repeatOrder(o)}
                      aria-label={`Repeat order #${o.order_number} into the current order`}
                      title={`Repeat order #${o.order_number} into the current order`}
                      className="mt-2 flex h-7 w-full items-center justify-center gap-1.5 rounded-full border border-[#E3E7E0] text-[11.5px] font-semibold text-[#967221] transition-colors hover:border-[#B88E2F] hover:bg-[#FBF7EC] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#B88E2F]"
                    >
                      <Repeat size={12} aria-hidden />
                      Repeat this order
                    </button>
                  ) : (
                    <p
                      className="mt-2 rounded-full bg-[#F6F5F2] px-2.5 py-1 text-center text-[10.5px] text-[#969696]"
                      title="This ticket's items are no longer all on the menu, so it cannot be repeated."
                    >
                      Items changed since this ticket — repeat unavailable
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

