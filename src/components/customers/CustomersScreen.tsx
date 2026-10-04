import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BadgePercent,
  CalendarClock,
  Crown,
  Download,
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
  TrendingUp,
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
  fetchReservations,
  subscribeCrmRealtime,
  updateCustomer,
  updateOffer,
  type CustomerInput,
  type OfferInput,
  type RealtimeState,
  type Reservation,
  type ReservationStatus,
} from '../../lib/api';
import { formatMoney } from '../../lib/prefs';
import { downloadCsv } from '../../lib/csv';
import { appTodayIso } from '../../lib/appday';
import { bookingSlotLabel, bookingDayKey, bookingTodayKey, bookingTzIsForeign } from '../../lib/bookingday';
import { useTenant } from '../../lib/tenant';
import { computeUsual, isPaidTicket, USUAL_WINDOW } from '../../lib/usual';
import { useDialogA11y } from '../../lib/useDialogA11y';
import { useCart } from '../../store/cart';
import { useUi } from '../../store/session';
import { MarkHit } from '../shell/MarkHit';
import { EmptyState } from '../shell/EmptyState';
import type { Customer, CustomerStats, Offer, Order, OrderItem } from '../../types';

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
 *
 * v5.74.0 — the regular's usual: the drawer now names the dish the guest's
 * own PAID ledger keeps ordering (the same paid truth v_customer_stats
 * speaks — status ≠ cancelled AND payment completed), reads it across a
 * 50-ticket window, and can start it into the live cart at the last price
 * and extras the ledger froze. A regular's past, one tap from today.
 *
 * v5.122.0 — the count line (Bills' house pattern, aria-live): while a
 * search narrows the book, a badge says how many guests the term captured
 * out of the whole book — the KPI cards above keep counting EVERYONE, the
 * way the shelf's value and Bills' unpaid total never narrow with a filter.
 *
 * v5.123.0 — the book's miss says why: the generic "No guests match that
 * search" becomes the shared EmptyState — term named, reach named
 * (names, phones, notes, AND emails: the hay always read email but the
 * old placeholder never admitted it; the local box's placeholder now
 * does), gold Clear search clearing both doors. The catalog-truth "No
 * guests yet" state joins the same family shape — an empty book and a
 * filtered one stay different sentences.
 */

type TabKey = 'guests' | 'offers';

/* v5.74.0 — the usual's definition (paid truth, tie-breaks, 50-ticket
 * window) lives in src/lib/usual.ts — ONE ledger truth shared with the
 * counter cart's chip. The drawer still SHOWS only the recent 8 rows. */
const TICKETS_SHOWN = 8;

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

/** Loyalty tier from LEDGER truth: only paid visits and paid rupees count.
 * 5.129.0 — the key and its metadata split apart so the tiles, the row
 * predicate, the miss voices and the CSV all read ONE definition
 * (tierKeyOf); the badge stays tierOf. */
type TierKey = 'new' | 'regular' | 'vip';

const TIER_META: Record<TierKey, { label: string; cls: string }> = {
  vip: { label: 'VIP', cls: 'bg-[#B88E2F]/12 text-[#8A5A00] border-[#B88E2F]/30' },
  regular: { label: 'Regular', cls: 'bg-[#E8F3E9] text-[#2E7D32] border-[#CBE3CD]' },
  new: { label: 'New', cls: 'bg-[#F6F5F2] text-[#6B6B6B] border-[#E3E7E0]' },
};

function tierKeyOf(visits: number, spent: number): TierKey {
  if (visits >= 5 || spent >= 5000) return 'vip';
  if (visits >= 2) return 'regular';
  return 'new';
}

function tierOf(visits: number, spent: number): { key: TierKey; label: string; cls: string } {
  const key = tierKeyOf(visits, spent);
  return { key, ...TIER_META[key] };
}

/** v5.131.0 — THE LADDER: how far the LEDGER stands from the next rung,
 *  spoken from the SAME predicates tierKeyOf counts with (one ledger
 *  truth, two voices — the badge names the rung, the ladder names the
 *  way back to the next one). New → Regular has one door: 2 paid visits.
 *  Regular → VIP has two doors — 5 paid visits OR ₹5,000 paid — and the
 *  line names the NEARER one (both stay true; naming one never closes
 *  the other). A VIP holds the top rung: silence. */
function ladderOf(visits: number, spent: number): { lead: string; target: 'regular' | 'vip' } | null {
  const key = tierKeyOf(visits, spent);
  if (key === 'vip') return null;
  if (key === 'new') {
    return (2 - visits) <= 1
      ? { lead: 'one more paid visit makes a', target: 'regular' }
      : { lead: 'two paid visits make a', target: 'regular' };
  }
  const vLeft = 5 - visits;
  return (visits / 5) >= (spent / 5000)
    ? { lead: `${vLeft} more paid visit${vLeft === 1 ? '' : 's'} make${vLeft === 1 ? 's' : ''} a`, target: 'vip' }
    : { lead: `${formatMoney(5000 - spent)} more makes a`, target: 'vip' };
}

/** The rung word's tone on the ladder line — the target tier's own text
 *  voice (the same family the badge and the tiles wear). */
const LADDER_TONE: Record<'regular' | 'vip', string> = {
  regular: 'text-[#2E7D32]',
  vip: 'text-[#8A5A00]',
};

/** The stepper's dot/label tone per rung — ledger tones, not decoration. */
const RUNG_TONE: Record<TierKey, string> = {
  new: '#6B6B6B',
  regular: '#2E7D32',
  vip: '#B88E2F',
};

function offerBadgeLabel(o: Offer): string {
  return o.discount_type === 'percent'
    ? `${Number(o.discount_value)}% off`
    : `${formatMoney(Number(o.discount_value))} off`;
}

/* ── The CRM reads the book (5.90.0) — a guest row carries today's promise.
   The join is the PHONE, the CRM's own identity key since v5.5: a book row
   speaks for a guest only when both sides carry a non-empty phone that
   normalizes to the same digits — the echo never guesses, and a row without
   a phone on either side stays silent. 5.105.0 — the IST helpers were
   "byte-matched to FloorScreen" by hand; now they ARE the floor's voice:
   one booking clock (src/lib/bookingday.ts, the DB's word) for book, bell
   and drawer — drift can never return. ── */
const istDateKeyBook = bookingDayKey;
const istTodayKeyBook = bookingTodayKey;
const istSlotLabelBook = bookingSlotLabel;

/** Digits-only phone normalizer — "98765 43210" and "9876543210" are the
 *  same guest. Empty stays empty: an empty phone never matches. */
function phoneDigits(p: string | null | undefined): string {
  return (p || '').replace(/\D/g, '');
}

/* ── CSV export (v5.129.0 — the book, carried out; shared lib/csv.ts since
 * 5.8.0). Exports the CURRENTLY NARROWED list — the tiles and the search
 * decide what the counter is looking at, the file carries exactly that (the
 * Bills house law: the counter exports what they see). Rows travel in the
 * list's own order — most-valuable regulars first. */
function exportGuestsCsv(rows: GuestRow[]): void {
  if (rows.length === 0) return;
  const header = [
    'Name',
    'Phone',
    'Tier',
    'Paid visits',
    'Paid total (INR)',
    'Last visit',
    'On the book since',
    'Email',
    'Notes',
  ];
  const lines: unknown[][] = [header];
  for (const { g, s } of rows) {
    const tier = TIER_META[tierKeyOf(s?.visits ?? 0, Number(s?.total_spent ?? 0))].label;
    lines.push([
      g.name || '',
      g.phone,
      tier,
      s?.visits ?? 0,
      Number(s?.total_spent ?? 0).toFixed(2),
      s?.last_visit_at ? new Date(s.last_visit_at).toLocaleString() : '',
      new Date(g.created_at).toLocaleString(),
      g.email || '',
      g.notes || '',
    ]);
  }
  downloadCsv(`servepoint-guests-${appTodayIso()}.csv`, lines);
}

export interface BookVoice {
  /** The strongest of the guest's promises today — the pill's voice. */
  status: ReservationStatus;
  /** True when the booked slot is still ahead (the gold "expected" voice). */
  upcoming: boolean;
  /** The pill's label — "On the book · seated" / "· 7:10 pm" / "· went quiet". */
  label: string;
  /** IST slot label of the speaking row ("6:31 pm"). */
  slot: string;
  /** Minutes until the slot (only for the upcoming gold voice). */
  mins: number | null;
  /** How many book rows the guest has today (the sentence names them all). */
  count: number;
  /** The full provenance sentence for title/aria. */
  sentence: string;
  /** The book's own tone family, byte-matched to RES_META / the bell. */
  bg: string;
  fg: string;
}

/** Pick the strongest of a guest's today-rows and word the voice. Priority:
 *  a party on the premises outranks a promise, a promise outranks a debt,
 *  the record outranks silence — seated > expected > no-show > went quiet >
 *  cancelled. The clock never convicts: a past booked hour is "went
 *  quiet", never "no-show". */
function buildBookVoice(name: string, rows: Reservation[], nowMs: number): BookVoice | null {
  if (!rows.length) return null;
  const todayKey = istTodayKeyBook();
  const todays = rows.filter((r) => istDateKeyBook(r.slot_at) === todayKey);
  if (!todays.length) return null;
  const rank: Record<ReservationStatus, number> = { seated: 4, booked: 3, no_show: 2, cancelled: 1 };
  const pick = [...todays].sort((a, b) => {
    // booked splits into expected (future) vs quiet (past) — future first
    const ra = rank[a.status] === 3 && new Date(a.slot_at).getTime() > nowMs ? 3.5 : rank[a.status];
    const rb = rank[b.status] === 3 && new Date(b.slot_at).getTime() > nowMs ? 3.5 : rank[b.status];
    if (ra !== rb) return rb - ra;
    return new Date(b.slot_at).getTime() - new Date(a.slot_at).getTime();
  })[0];
  const slotMs = new Date(pick.slot_at).getTime();
  const upcoming = pick.status === 'booked' && slotMs > nowMs;
  const mins = upcoming ? Math.round((slotMs - nowMs) / 60000) : null;
  const voice: Record<string, { label: string; bg: string; fg: string; detail: string }> = {
    seated: { label: 'On the book · seated', bg: '#E7F1E8', fg: '#2E7D32', detail: 'the party is on the premises now' },
    expected: {
      label: `On the book · ${istSlotLabelBook(pick.slot_at)}`,
      bg: '#FBF3E1',
      fg: '#8A5A00',
      detail: mins !== null && mins <= 45 ? `the party is expected at ${istSlotLabelBook(pick.slot_at)} — due in about ${mins} minute${mins === 1 ? '' : 's'}` : `the party is expected at ${istSlotLabelBook(pick.slot_at)}`,
    },
    quiet: {
      label: 'On the book · went quiet',
      bg: '#F1F4F1',
      fg: '#6B6B6B',
      detail: `the promised hour (${istSlotLabelBook(pick.slot_at)}) went by, still booked`,
    },
    no_show: {
      label: 'On the book · no-show',
      bg: '#FCEBEA',
      fg: '#B3261E',
      detail: `marked no-show for ${istSlotLabelBook(pick.slot_at)}`,
    },
    cancelled: {
      label: 'On the book · cancelled',
      bg: '#EAF0EC',
      fg: '#6B6B6B',
      detail: `the ${istSlotLabelBook(pick.slot_at)} promise was cancelled — the book keeps the record`,
    },
  };
  const key = pick.status === 'booked' ? (upcoming ? 'expected' : 'quiet') : pick.status;
  const v = voice[key];
  const n = todays.length;
  return {
    status: pick.status,
    upcoming,
    label: v.label,
    slot: istSlotLabelBook(pick.slot_at),
    mins,
    count: n,
    bg: v.bg,
    fg: v.fg,
    sentence: `The book holds ${n === 1 ? 'a promise' : `${n} promises`} for ${name} today — ${v.detail}. Matched by phone number; the book's truth as of now.`,
  };
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

/** v5.74.0 — a 3px left rail in the ticket's own status color, so the
 *  drawer's ticket stack scans by state before it is even read. */
function orderRail(s: string): string {
  if (s === 'completed') return '#2E7D32';
  if (s === 'cancelled') return '#B3261E';
  if (s === 'ready') return '#3B5BA5';
  return '#C9950A';
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
  /* 5.129.0 — the tier tiles' filter: null = the whole book; a tier narrows
   * the list to guests whose LEDGER truth (tierKeyOf) matches. The tiles'
   * numbers above stay whole-book, always. */
  const [tier, setTier] = useState<TierKey | null>(null);
  /* v5.116.0 — the guest search joins the shell-search contract: the
   * header box and the tab's own box are two doors to one state. */
  const query = useUi((s) => s.search);
  const setQuery = useUi((s) => s.setSearch);
  useEffect(() => {
    useUi.getState().setSearchMeta({ placeholder: 'Search guests…' });
    return () => useUi.getState().setSearchMeta(null);
  }, []);
  /* 5.90.0 — the book, read fail-soft alongside every load. null = the CRM
     has not read the book (or could not): every voice stays SILENT — an
     unread book never becomes an invented all-clear. */
  const [book, setBook] = useState<Reservation[] | null>(null);
  /* the 30s book tick: a booked row crosses its hour (expected → went quiet)
     between loads, and the pill must cross with it, unprompted. */
  const [bookTick, setBookTick] = useState(0);

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
    /* the book rides along, fail-soft — its own truth, never the screen's
       error: a failed read silences the voices, it does not alarm the CRM. */
    fetchReservations(tenantId, 100)
      .then((rows) => setBook(rows))
      .catch(() => setBook(null));
  }, [tenantId]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [tenantId, load]);

  useEffect(() => {
    if (!tenantId) return;
    const unsub = subscribeCrmRealtime(tenantId, () => void load(), setRt);
    const poll = window.setInterval(() => void load(), 30_000);
    const tick = window.setInterval(() => setBookTick((t) => t + 1), 30_000);
    return () => {
      unsub();
      window.clearInterval(poll);
      window.clearInterval(tick);
    };
  }, [tenantId, load]);

  /* one voice per guest — built on every book read and every 30s tick so
     the expected/quiet boundary crosses live (the floor's promiseTick
     grammar, the bell's echoTick grammar, now the CRM's bookTick). */
  const bookVoices = useMemo(() => {
    void bookTick;
    if (!book) return null;
    const nowMs = Date.now();
    const byPhone = new Map<string, Reservation[]>();
    for (const r of book) {
      const d = phoneDigits(r.phone);
      if (!d) continue; // a book row without a phone can never claim a guest
      const list = byPhone.get(d) || [];
      list.push(r);
      byPhone.set(d, list);
    }
    const map = new Map<string, BookVoice>();
    for (const g of guests) {
      const d = phoneDigits(g.phone);
      if (!d) continue;
      const rows = byPhone.get(d);
      if (!rows) continue;
      const voice = buildBookVoice(g.name || 'Unnamed guest', rows, nowMs);
      if (voice) map.set(g.id, voice);
    }
    return map;
  }, [book, guests, bookTick]);

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
      /* 5.129.0 — the tier tile's word decides who survives; the same
       * tierKeyOf the badge and the tiles count with. */
      .filter(({ s }) => !tier || tierKeyOf(s?.visits ?? 0, Number(s?.total_spent ?? 0)) === tier)
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
  }, [guests, stats, query, tier]);

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
          <h1 className="sp-screen-title">Guests</h1>
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
            <>
              {/* 5.129.0 — the book, carried out: the narrowed list IS the
                  file. Disabled while the current narrowing shows nothing —
                  an empty narrowing exports an empty file, so it refuses. */}
              <button
                type="button"
                onClick={() => exportGuestsCsv(rows)}
                disabled={rows.length === 0}
                aria-label="Export guests as CSV"
                title="Export the filtered list as CSV (opens in Excel / Sheets)"
                className="flex h-9 items-center gap-1.5 rounded-xl border border-[#E3E7E0] bg-white px-3 text-[12px] font-bold text-[#0F3D3E] transition hover:border-[#B88E2F] hover:text-[#B88E2F] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B88E2F] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Download size={14} aria-hidden />
                CSV
              </button>
              <button
                type="button"
                onClick={() => setGuestForm({ mode: 'new', customer: null, open: true })}
                className="sp-cta inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-semibold"
              >
                <Plus size={15} aria-hidden /> Add guest
              </button>
            </>
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
          total={guests.length}
          kpis={kpis}
          query={query}
          setQuery={setQuery}
          tier={tier}
          setTier={setTier}
          loading={loading}
          onEdit={(g) => setGuestForm({ mode: 'edit', customer: g, open: true })}
          onDelete={doDeleteGuest}
          deleteArm={deleteArm}
          setDeleteArm={setDeleteArm}
          busyId={busyId}
          onOpenDetail={setDetailFor}
          bookVoices={bookVoices}
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
          voice={bookVoices?.get(detailFor.id) ?? null}
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
  total: number;
  kpis: { total: number; regulars: number; vip: number; topName: string; topSpent: number };
  query: string;
  setQuery: (q: string) => void;
  /* 5.129.0 — the tiles' filter (null = whole book), lifted to GuestsInner
   * so the list, the whisper and the misses read one state. */
  tier: TierKey | null;
  setTier: (t: TierKey | null) => void;
  loading: boolean;
  onEdit: (g: Customer) => void;
  onDelete: (g: Customer) => void;
  deleteArm: string | null;
  setDeleteArm: (id: string | null) => void;
  busyId: string | null;
  onOpenDetail: (g: Customer) => void;
  /* 5.90.0 — the book's voices, keyed by guest id (null = the CRM has not
     read the book: every row stays silent, never an invented all-clear). */
  bookVoices: Map<string, BookVoice> | null;
}> = ({ rows, total, kpis, query, setQuery, tier, setTier, loading, onEdit, onDelete, deleteArm, setDeleteArm, busyId, onOpenDetail, bookVoices }) => {
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
      {/* KPI strip — 5.129.0: the Regulars and VIPs tiles follow the Floor's
       * tile grammar (5.128.0): tap to narrow the list to that tier, tap
       * again to release. The numbers stay whole-book — the tiles COUNT the
       * book; the list below shows the narrowing, and the whisper says so. */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="sp-card px-4 py-3.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#969696]">Guests on the books</p>
          <p className="mt-1 text-2xl font-bold text-[#1A1A1A]">{kpis.total}</p>
        </div>
        {(
          [
            {
              key: 'regular' as TierKey,
              label: 'Regulars · 2+ visits',
              count: kpis.regulars,
              valueCls: 'text-[#2E7D32]',
              icon: null,
            },
            {
              key: 'vip' as TierKey,
              label: 'VIPs',
              count: kpis.vip,
              valueCls: 'text-[#8A5A00]',
              icon: <Crown size={17} aria-hidden />,
            },
          ]
        ).map((t) => {
          const active = tier === t.key;
          return (
            <button
              key={t.key}
              type="button"
              aria-pressed={active}
              onClick={() => setTier(active ? null : t.key)}
              title={
                active
                  ? `Showing ${t.label.split(' ·')[0].toLowerCase()} only — tap again for the whole book`
                  : `Tap to show ${t.label.split(' ·')[0].toLowerCase()} only`
              }
              className={`rounded-2xl border bg-white px-4 py-3.5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#967221] ${
                active ? 'border-[#B88E2F] ring-2 ring-[#B88E2F]/30' : 'border-[#E3E7E0]'
              }`}
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#969696]">{t.label}</p>
              <p className={`mt-1 flex items-center gap-1.5 text-2xl font-bold ${t.valueCls}`}>
                {t.icon} {t.count}
              </p>
            </button>
          );
        })}
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
          placeholder="Search name, phone, email, notes…"
          aria-label="Search guests"
          className="sp-input h-11 w-full pl-10 pr-3 text-[13.5px]"
        />
      </div>

      {/* 5.129.0 — the whisper (the 5.122.0 count line grows into the
          Floor's 5.128.0 grammar): while the search or a tier tile narrows
          the book, say how much of it survived — and admit the tiles above
          still count the WHOLE book. The narrowing never rewrites the
          headline. */}
      {(query.trim() || tier) && (
        <p
          aria-live="polite"
          className="mt-3 flex flex-wrap items-center gap-2 text-[12px] font-medium text-[#0F3D3E]"
        >
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#0F3D3E] px-1.5 text-[10.5px] font-bold tabular-nums text-white">
            {rows.length}
          </span>
          <span className="text-[#6B6B6B]">
            Showing {rows.length} of {total} {total === 1 ? 'guest' : 'guests'}
            {query.trim() && <> for “{query.trim()}”</>} — the tiles above still
            count the whole book
          </span>
        </p>
      )}

      {/* list */}
      {rows.length === 0 ? (
        query.trim() || tier ? (
          /* 5.129.0 — the miss says why (the Floor's either-can-miss
           * grammar reaches the book): the search's word, the tile's word
           * with its ledger definition, or both. The catalog truth below
           * ("No guests yet") stays its own sentence — an empty book is
           * not a filtered one. */
          query.trim() ? (
            <EmptyState
              icon={Search}
              title={`No guest matches “${query.trim()}”`}
              body={
                <>
                  Search reads names, phones, notes, and emails — an email match keeps its row
                  without a gold mark; open the guest to see the address.
                  {tier && (
                    <> The {TIER_META[tier].label} tile is also in play — either can miss.</>
                  )}
                </>
              }
              action={
                <button
                  onClick={() => {
                    setQuery('');
                    if (tier) setTier(null);
                  }}
                  className="rounded-lg bg-[#F3E8CF] px-3 py-1.5 text-[12px] font-semibold text-[#1A1A1A] transition hover:bg-[#E9D9AF]"
                >
                  {tier ? 'Clear both' : 'Clear search'}
                </button>
              }
            />
          ) : (
            <EmptyState
              icon={tier === 'vip' ? Crown : Users}
              title={tier === 'vip' ? 'No VIPs to show' : 'No regulars to show'}
              body={
                <>
                  The book holds {total} {total === 1 ? 'guest' : 'guests'} — none of them{' '}
                  {tier === 'vip' ? 'a VIP yet' : 'a regular yet'} (
                  {tier === 'vip'
                    ? 'a VIP has 5+ paid visits or ₹5,000 paid'
                    : 'a regular has 2+ paid visits'}
                  ). Tap the tile again, or show the whole book.
                </>
              }
              action={
                <button
                  onClick={() => setTier(null)}
                  className="rounded-lg bg-[#F3E8CF] px-3 py-1.5 text-[12px] font-semibold text-[#1A1A1A] transition hover:bg-[#E9D9AF]"
                >
                  Show the whole book
                </button>
              }
            />
          )
        ) : (
          /* catalog truth: an empty book is a different sentence from a
           * filtered one — it keeps its own voice, now in the shared
           * family shape. */
          <EmptyState
            icon={Users}
            title="No guests yet"
            body="Add one by hand, or just type a phone on the next ticket — every order with a phone books its guest here automatically."
          />
        )
      ) : (
        <ul className="mt-4 space-y-2.5">
          {rows.map(({ g, s }) => {
            const tone = avatarTone(g.phone);
            const tier = tierOf(s?.visits ?? 0, Number(s?.total_spent ?? 0));
            const visits = s?.visits ?? 0;
            const spent = Number(s?.total_spent ?? 0);
            const armed = deleteArm === g.id;
            /* v5.131.0 — the ladder line: the ledger's distance to the next
               rung, from the same tierKeyOf the badge counts with. */
            const ladder = ladderOf(visits, spent);
            /* 5.90.0 — the guest's promise today, if the book holds one for
               this phone. The pill wears the book's own tone family; the
               hover/aria carries the full provenance sentence. */
            const voice = bookVoices?.get(g.id) ?? null;
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
                      <span className="truncate text-[14px] font-semibold text-[#1A1A1A]">
                        <MarkHit text={g.name || 'Unnamed guest'} query={query} />
                      </span>
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${tier.cls}`}>
                        {tier.label}
                      </span>
                      {voice && (
                        <span
                          className="inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-bold"
                          style={{ backgroundColor: voice.bg, color: voice.fg }}
                          title={voice.sentence}
                          aria-label={voice.sentence}
                        >
                          <CalendarClock size={10} aria-hidden />
                          {voice.label}
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px] text-[#6B6B6B]">
                      <span className="inline-flex items-center gap-1">
                        <Phone size={11} aria-hidden /> <MarkHit text={g.phone} query={query} />
                      </span>
                      {g.notes && <span className="truncate">· <MarkHit text={g.notes} query={query} /></span>}
                    </span>
                    {ladder && (
                      <span className="mt-1 flex items-center gap-1.5 text-[11.5px] text-[#969696]">
                        <TrendingUp size={11} aria-hidden className="shrink-0" />
                        <span className="min-w-0 truncate">
                          {ladder.lead}{' '}
                          <span className={`font-semibold ${LADDER_TONE[ladder.target]}`}>
                            {TIER_META[ladder.target].label}
                          </span>
                        </span>
                      </span>
                    )}
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
  /* v5.110.0 — Escape/trap/restore; Escape stands down while the guest saves. */
  const dlgRef = useDialogA11y<HTMLDivElement>(() => { if (!busy) onClose(); }, true);
  const [localErr, setLocalErr] = useState<string | null>(null);

  const submit = () => {
    if (!phone.trim()) return setLocalErr('A phone number is the guest’s key — it is required.');
    if (phone.replace(/\D/g, '').length < 6) return setLocalErr('That phone looks too short to be real.');
    setLocalErr(null);
    onSave({ name: name.trim(), phone: phone.trim(), email: email.trim() || null, notes: notes.trim() || null });
  };

  return (
    <div ref={dlgRef} className="fixed inset-0 z-50" style={{ animation: 'spFadeIn 160ms ease-out' }} role="dialog" aria-modal="true" aria-label={mode === 'new' ? 'Add guest' : 'Edit guest'}>
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 h-full w-full cursor-default bg-[#0F3D3E]/45 focus-visible:outline-none" />
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
  /* v5.110.0 — Escape/trap/restore; Escape stands down while the offer saves. */
  const dlgRef = useDialogA11y<HTMLDivElement>(() => { if (!busy) onClose(); }, true);

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
    <div ref={dlgRef} className="fixed inset-0 z-50" style={{ animation: 'spFadeIn 160ms ease-out' }} role="dialog" aria-modal="true" aria-label={mode === 'new' ? 'New offer' : 'Edit offer'}>
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 h-full w-full cursor-default bg-[#0F3D3E]/45 focus-visible:outline-none" />
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
  /* 5.90.0 — the guest's promise today (null = no match, or the book is
     unread — silence either way). */
  voice: BookVoice | null;
  onClose: () => void;
}> = ({ tenantId, customer, stats, voice, onClose }) => {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  /* v5.110.0 — the drawer holds the door (replaces the hand-rolled Escape listener). */
  const dlgRef = useDialogA11y<HTMLDivElement>(onClose, true);

  useEffect(() => {
    let alive = true;
    /* v5.74.0 — the fetch widened from 8 to USUAL_WINDOW (50): the recent
     * list still SHOWS the same TICKETS_SHOWN rows, but the usual now reads
     * a window wide enough that a habit cannot hide behind one accident. */
    fetchCustomerOrders(tenantId, customer.phone, USUAL_WINDOW)
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

  const tone = avatarTone(customer.phone);
  const tier = tierOf(stats?.visits ?? 0, Number(stats?.total_spent ?? 0));
  const visits = stats?.visits ?? 0;
  const spent = Number(stats?.total_spent ?? 0);
  const placed = stats?.orders_placed ?? 0;

  /* THE USUAL (v5.74.0) — the dish the guest's own paid ledger keeps naming.
   * The definition (paid truth, tie-breaks, window) is ONE shared truth in
   * src/lib/usual.ts — the counter cart's chip speaks the same one. */
  const paidTickets = useMemo(() => (orders || []).filter(isPaidTicket), [orders]);

  const usual = useMemo(() => (orders ? computeUsual(orders) : null), [orders]);
  const usualLiving = Boolean(usual?.line?.menu_item_id);

  /** One ledger line rides into the live cart — the exact v5.56.0
   *  arithmetic the repeat action speaks (extras folded back out of the
   *  frozen unit price, cart.add re-folding the same extras in). */
  const addLineToCart = (it: OrderItem, qty?: number) => {
    const addonSnap = (it.addons || []).map((a) => ({
      id: null as string | null,
      name: a.name,
      price: Number(a.price),
    }));
    const addonSum = Math.round(addonSnap.reduce((s, a) => s + a.price, 0) * 100) / 100;
    const basePrice = Math.round((Number(it.unit_price) - addonSum) * 100) / 100;
    useCart.getState().add(
      { id: it.menu_item_id as string, name: it.name, price: basePrice, image_url: null, is_veg: null },
      qty ?? it.qty,
      addonSnap,
      it.variant_name ? { name: it.variant_name, priceDelta: 0 } : null
    );
  };

  /* "Their usual" (v5.54.0) — a regular's past ticket becomes today's cart:
     every line (qty + the addon-inclusive unit price the ledger froze) rides
     into the LIVE cart additively, the guest's identity pre-fills the
     drawer, and the cashier lands on Food & Drinks to review and place.
     Guard: every line must still point at a living menu item — a ticket
     whose item was de-listed cannot be repeated, and says so honestly. */
  const repeatable = (o: Order): boolean =>
    (o.items || []).length > 0 && (o.items || []).every((it) => Boolean(it.menu_item_id));

  const repeatOrder = (o: Order) => {
    for (const it of o.items || []) addLineToCart(it);
    const cart = useCart.getState();
    cart.setCustomerName(customer.name || '');
    cart.setCustomerPhone(customer.phone);
    onClose();
    useUi.getState().goSection('food', ['Food & Drinks'], `repeat:${o.order_number}`);
  };

  /* START THEIR USUAL (v5.74.0) — the habit itself, one tap. The latest
   * expression of it rides in at the habit's own size (the last line's
   * qty), at the last price and extras the ledger froze, with the guest's
   * identity pre-filled. Guard: a usual whose dish was de-listed cannot
   * start — the well keeps the name (ledger truth) but says so honestly. */
  const startUsual = () => {
    if (!usual?.line || !usualLiving) return;
    addLineToCart(usual.line);
    const cart = useCart.getState();
    cart.setCustomerName(customer.name || '');
    cart.setCustomerPhone(customer.phone);
    onClose();
    useUi.getState().goSection('food', ['Food & Drinks'], `usual:${customer.phone}`);
  };

  return (
    <div ref={dlgRef} className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={`Guest ${customer.name || customer.phone}`}>
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 h-full w-full cursor-default bg-[#0F3D3E]/45 focus-visible:outline-none" />
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
            <p className="mt-0.5 text-[18px] font-bold text-[#1A1A1A] tabular-nums">{visits}</p>
          </div>
          <div className="px-4 py-3 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[#969696]">Paid total</p>
            <p className="mt-0.5 text-[18px] font-bold text-[#2E7D32] tabular-nums">{formatMoney(spent)}</p>
          </div>
          <div className="px-4 py-3 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[#969696]">All tickets</p>
            <p className="mt-0.5 text-[18px] font-bold text-[#1A1A1A] tabular-nums">{placed}</p>
          </div>
        </div>

        {/* tickets */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {/* v5.131.0 — THE LADDER: the book's three rungs and the guest's
              place on them, counted from the same ledger the badge counts
              with. The strip carries the shape (aria-hidden — the words
              below it are the announcement); the sentence carries the
              distance. A VIP hears the definition restated, not a nudge. */}
          {(() => {
            const rungs: TierKey[] = ['new', 'regular', 'vip'];
            const tierIdx = rungs.indexOf(tier.key);
            const ladder = ladderOf(visits, spent);
            return (
              <div className="mb-4 rounded-2xl border border-[#E3E7E0] bg-[#FBFAF7] px-4 py-3.5">
                <div aria-hidden="true" className="flex items-center">
                  {rungs.map((k, i) => {
                    const reached = tierIdx >= i;
                    const current = tierIdx === i;
                    return (
                      <React.Fragment key={k}>
                        {i > 0 && <span className="mx-2 h-px flex-1 bg-[#E3E7E0]" />}
                        <span className="flex items-center gap-1.5">
                          <span
                            className={`h-2.5 w-2.5 shrink-0 rounded-full ${current ? 'ring-2 ring-offset-1' : ''}`}
                            style={{
                              backgroundColor: reached ? RUNG_TONE[k] : '#FFFFFF',
                              boxShadow: reached ? undefined : 'inset 0 0 0 1.5px #C9CFC9',
                              ...(current ? ({ '--tw-ring-color': RUNG_TONE[k] } as React.CSSProperties) : {}),
                            }}
                          />
                          <span
                            className={`text-[10px] font-bold uppercase tracking-wide ${reached ? '' : 'text-[#C9CFC9]'}`}
                            style={reached ? { color: RUNG_TONE[k] } : undefined}
                          >
                            {TIER_META[k].label}
                          </span>
                        </span>
                      </React.Fragment>
                    );
                  })}
                </div>
                <p className="mt-2.5 text-[12.5px] leading-relaxed text-[#6B6B6B]">
                  {ladder ? (
                    <>
                      {ladder.lead}{' '}
                      <span className={`font-semibold ${LADDER_TONE[ladder.target]}`}>
                        {TIER_META[ladder.target].label}
                      </span>
                      .
                    </>
                  ) : (
                    <>
                      Holds the top rung — <span className="font-semibold text-[#8A5A00]">5 paid visits or ₹5,000 paid</span>.
                    </>
                  )}
                </p>
              </div>
            );
          })()}
          {/* TODAY ON THE BOOK (5.90.0) — the guest's promise, in the book's
              own tones: the same family the chip, drill, book rows and the
              bell speak. Null = no match today: the block simply never
              renders, an unread book never invents an all-clear. */}
          {voice && (
            <div
              className="mb-4 rounded-2xl border px-4 py-3.5"
              style={{ borderColor: voice.fg ? `${voice.fg}22` : undefined, backgroundColor: voice.bg }}
              role="note"
              aria-label={voice.sentence}
            >
              <div className="flex items-center gap-1.5">
                <CalendarClock size={13} style={{ color: voice.fg }} aria-hidden />
                <p className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: voice.fg }}>
                  Today on the book
                </p>
              </div>
              <p className="mt-1.5 text-[15.5px] font-bold tabular-nums" style={{ color: voice.fg }}>
                {voice.upcoming
                  ? `Expected ${voice.slot}${bookingTzIsForeign() ? ' IST' : ''}`
                  : voice.label.replace('On the book · ', '')}
              </p>
              <p className="mt-0.5 text-[11.5px] font-medium leading-relaxed" style={{ color: voice.fg, opacity: 0.88 }}>
                {voice.sentence}
              </p>
            </div>
          )}
          {/* THE USUAL (v5.74.0) — the dish this guest's own paid ledger keeps
              naming, with the share of everything they've rung it accounts
              for, and one tap to start it into today's order. */}
          {orders !== null && usual && usual.line && (
            <div
              className="mb-4 rounded-2xl border border-[#E3E7E0] bg-[#FBFAF7] px-4 py-3.5"
              aria-label={`The usual: ${usual.units} times ${usual.name}`}
            >
              <div className="flex items-center gap-1.5">
                <Sparkles size={13} className="text-[#B88E2F]" aria-hidden />
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#8A5A00]">The usual</p>
              </div>
              <p className="mt-1.5 text-[15.5px] font-bold text-[#1A1A1A]">
                <span className="tabular-nums">{usual.units}×</span> {usual.name}
              </p>
              <p className="mt-0.5 text-[11.5px] leading-relaxed text-[#6B6B6B]">
                named across <span className="font-semibold text-[#1A1A1A] tabular-nums">{usual.tickets}</span>{' '}
                paid {usual.tickets === 1 ? 'ticket' : 'tickets'} ·{' '}
                <span className="tabular-nums">{formatMoney(usual.rupees)}</span> of everything they've rung
                {paidTickets.length >= USUAL_WINDOW && ` · last-${USUAL_WINDOW}-ticket window`}
              </p>
              <div
                className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#EAF0EC]"
                role="img"
                aria-label={`${Math.round(usual.share * 100)} percent of everything they have rung`}
              >
                <div
                  className="h-full rounded-full bg-[#B88E2F]"
                  style={{ width: `${Math.max(3, Math.round(usual.share * 100))}%` }}
                />
              </div>
              {usualLiving ? (
                <button
                  type="button"
                  onClick={startUsual}
                  aria-label={`Start their usual — ${usual.line.qty} times ${usual.name} at the last price they paid`}
                  title={`Start their usual — ${usual.line.qty}× ${usual.name} at the last price and extras the ledger froze`}
                  className="mt-2.5 flex h-8 w-full items-center justify-center gap-1.5 rounded-full bg-[#B88E2F] text-[12px] font-bold text-white shadow-sm transition-colors hover:bg-[#A67D28] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#B88E2F]"
                >
                  <Repeat size={12} aria-hidden />
                  Start their usual
                </button>
              ) : (
                <p
                  className="mt-2.5 rounded-full bg-[#F6F5F2] px-2.5 py-1.5 text-center text-[10.5px] text-[#969696]"
                  title="This dish is no longer on the menu, so the usual cannot be started."
                >
                  Off the menu now — the usual can't be started
                </p>
              )}
            </div>
          )}
          {orders !== null && !usual && orders.length > 0 && (
            <p className="mb-4 rounded-xl bg-[#F6F5F2] px-3 py-2.5 text-center text-[11.5px] text-[#969696]">
              No usual yet — a usual is named by paid tickets only.
            </p>
          )}
          {orders !== null && !usual && orders.length === 0 && (
            <p className="mb-4 rounded-xl bg-[#F6F5F2] px-3 py-2.5 text-center text-[11.5px] text-[#969696]">
              No usual yet — their first paid ticket will name it.
            </p>
          )}
          {orders === null && !err && <div className="sp-skeleton mb-4 h-[92px] rounded-2xl" />}
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
              {orders.slice(0, TICKETS_SHOWN).map((o) => (
                <li
                  key={o.id}
                  className="rounded-xl border border-[#E3E7E0] px-3.5 py-3"
                  style={{ borderLeft: `3px solid ${orderRail(String(o.status))}` }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13px] font-bold text-[#1A1A1A] tabular-nums">#{o.order_number}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${orderStatusTone(String(o.status))}`}>
                      {String(o.status).replace('_', ' ')}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-[12px] text-[#6B6B6B]">
                    {(o.items || []).map((it) => `${it.qty}× ${it.name}`).join(', ') || '—'}
                  </p>
                  <div className="mt-1.5 flex items-center justify-between text-[11.5px] text-[#969696]">
                    <span>{fmtWhen(o.created_at)} · {String(o.payment_status || 'pending')}</span>
                    <span className="font-semibold text-[#1A1A1A] tabular-nums">
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

