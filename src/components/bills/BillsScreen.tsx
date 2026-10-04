import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  ChevronDown,
  Download,
  History,
  Loader2,
  MoreHorizontal,
  Plus,
  Receipt,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Split,
  X,
} from 'lucide-react';
import { dayTime, isSameLocalDay } from '../../lib/day';
import {
  advanceOrder,
  fetchOrderHistory,
  fetchOrderOfferTitle,
  fetchOrderPayment,
  fetchOrderPayments,
  fetchOpenPaymentSums,
  fetchOrders,
  insertPartialPayment,
  recordPayment,
} from '../../lib/api';
import type { OrderStatusEvent, PaymentMethod, ReceiptPayment } from '../../lib/api';
import { printReceipt } from './ReceiptPrint';
import { preloadPrintImage } from '../../lib/printFrame';
import { formatMoney, getPrefs } from '../../lib/prefs';
import { downloadCsv } from '../../lib/csv';
import { appTodayIso } from '../../lib/appday';
import { useTenant } from '../../lib/tenant';
import { useSession, useUi } from '../../store/session';
import { MarkHit } from '../shell/MarkHit';
import { EmptyState } from '../shell/EmptyState';
import type { Order } from '../../types';

/**
 * Bills / Payment History (ServePoint production, ADR-0014).
 * Matches docs/design/servepoint/frames/Bills_219-29423.png (+ variants / Empty_State_219-29868).
 * Two-pane: left order list w/ filters + bottom search bar; right detail pane with
 * Details, Order Info, Items, Total and the gold "Charge customer" flow.
 * Data is live Supabase only (fetchOrders / updateOrderStatus) — no mocks.
 *
 * v5.121.0 — the ledger's misses learn to say why (the 5.119.0 contract
 * reaches its last generic zero state): a search miss now names the term
 * and the reach (order numbers, customer names, the card's own line); a
 * filter miss names the status and the window that stood; when both are
 * in play the body says either can miss. The catalog-truth "No bills
 * yet" state above it is untouched — an empty ledger and a filtered one
 * are different sentences.
 * v5.122.0 — the orphan learns to say why: when a filter empties the
 * list, the selection HOLDS (5.92.0's keep-valid effect early-returns)
 * and the detail pane now says so in the amber voice instead of showing
 * a bill the list swore wasn't there.
 */

type StatusFilter = 'all' | 'active' | 'paid' | 'cancelled';
type DateFilter = 'today' | '7d' | 'all';
type MethodKey = 'cash' | 'card' | 'upi';

interface OrderPatch {
  status?: string;
  payment_status?: string;
  payment_method?: string;
}

const STATUS_LABEL: Record<string, string> = {
  active: 'Active',
  paid: 'Paid',
  cancelled: 'Cancelled',
};

/** Status dot colors (frame: Active gold, Paid green, Cancelled red). */
const STATUS_DOT: Record<string, string> = {
  active: '#B88E2F',
  paid: '#2E7D32',
  cancelled: '#B42318',
};

/**
 * Legacy cloud orders may carry fine-grained statuses (new/preparing/ready/
 * served/pending). They are all "active" in the trio model until paid/cancelled.
 * With the 001 engine, a completed PAYMENT means "Paid" regardless of where
 * the order sits in the kitchen lifecycle (NOVA: the counter is the gate).
 */
function displayStatus(o: Pick<Order, 'status' | 'payment_status'>): string {
  const s = String(o.status || '').toLowerCase();
  if (s === 'cancelled') return 'cancelled';
  if (s === 'paid') return 'paid';
  if (String(o.payment_status || '').toLowerCase() === 'completed') return 'paid';
  return 'active';
}

/** Detail-pane status pill fills. */
const STATUS_PILL: Record<string, string> = {
  active: 'bg-[#B88E2F] text-white',
  paid: 'bg-[#2E7D32] text-white',
  cancelled: 'bg-[#B42318] text-white',
};

const TYPE_LABEL: Record<string, string> = {
  dine_in: 'Dine-in',
  takeaway: 'Takeaway',
  delivery: 'Delivery',
};

const METHOD_LABEL: Record<MethodKey, string> = {
  cash: 'Cash',
  card: 'Bank Card',
  upi: 'UPI',
};

const WHITE_PILL =
  'h-11 w-full appearance-none rounded-full border border-[#E3E7E0] bg-white pl-4 pr-9 text-[13px] font-medium text-[#1A1A1A] transition hover:border-[#C9CFC9] focus:border-[#B88E2F] focus:outline-none focus:ring-2 focus:ring-[#B88E2F]/25';

/** A filter that is DOING something wears it (v5.44.0) — the gold family is
 *  this app's one grammar for "needs attention": amber wash, gold border,
 *  amber-ink text. Landed from a door, you can see the filter landed too. */
const FILTER_PILL_ACTIVE =
  'h-11 w-full appearance-none rounded-full border border-[#B88E2F] bg-[#FDF6E3] pl-4 pr-9 text-[13px] font-bold text-[#8A5A00] transition hover:border-[#967221] focus:border-[#B88E2F] focus:outline-none focus:ring-2 focus:ring-[#B88E2F]/25';

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/* ── CSV export (NOVA "Orders page — CSV", v5.3.1; shared lib/csv.ts since 5.8.0)
 * Exports the CURRENTLY FILTERED list — the counter exports exactly what they
 * see. Injection-safe escaping + UTF-8 BOM live in the shared lib.
 */

function itemsSummary(o: Order): string {
  return (o.items || [])
    .map((it) => {
      let line = `${it.qty} × ${it.name}`;
      if (it.variant_name) line += ` (${it.variant_name})`;
      if (it.addons && it.addons.length > 0)
        line += ` [+ ${it.addons.map((a) => a.name).join(', ')}]`;
      return line;
    })
    .join('; ');
}

function exportBillsCsv(rows: Order[], paidSums: Map<string, number>): void {
  if (rows.length === 0) return;
  const header = [
    'Order #',
    'Placed at',
    'Status',
    'Payment',
    'Method',
    'Type',
    'Customer',
    'Table',
    'Items',
    'Subtotal (INR)',
    'GST (INR)',
    'Discount (INR)',
    'Total (INR)',
    'Notes',
  ];
  const lines: unknown[][] = [header];
  for (const o of rows) {
    const st = STATUS_LABEL[displayStatus(o)] || displayStatus(o);
    const method = o.payment_method ? METHOD_LABEL[o.payment_method as MethodKey] || o.payment_method : '';
    /* 5.63.0: a partially-split ticket says so — the ledger's honest voice,
       not a bare 'pending' that hides money already taken. */
    const partPaid = Number(paidSums.get(o.id) ?? 0);
    const paymentCell =
      String(o.payment_status || '').toLowerCase() === 'completed'
        ? 'completed'
        : partPaid > 0
          ? `partial (${partPaid.toFixed(2)} of ${Number(o.total ?? 0).toFixed(2)} in)`
          : o.payment_status || 'pending';
    lines.push([
      o.order_number,
      new Date(o.created_at).toLocaleString(),
      st,
      paymentCell,
      method,
      TYPE_LABEL[String(o.order_type)] || String(o.order_type),
      o.customer_name || '',
      o.table_label || '',
      itemsSummary(o),
      Number(o.subtotal ?? 0).toFixed(2),
      Number(o.tax_amount ?? 0).toFixed(2),
      Number(o.discount_amount ?? 0).toFixed(2),
      Number(o.total ?? 0).toFixed(2),
      o.notes || '',
    ]);
  }
  /* v5.106.0 — the filename carries the reporting day (appday): the owner's
     own today, the same word Reports and Close-out speak. The old name was
     hardcoded IST — the wrong-clock family EOD's stepper came from (5.83.0);
     5.84.0 fixed the UTC→IST direction, and now the name also follows the
     owner when the reporting day itself moves. */
  downloadCsv(`servepoint-bills-${appTodayIso()}.csv`, lines);
}

/** Secondary line on a row card: "Table 12 · 2 guests" or type + customer. */
function rowSubline(o: Order): string {
  if (o.table_label) {
    const guests = o.guest_count ? ` · ${o.guest_count} guests` : '';
    return `Table ${o.table_label}${guests}`;
  }
  const type = TYPE_LABEL[String(o.order_type)] || String(o.order_type);
  return o.customer_name ? `${type} · ${o.customer_name}` : type;
}

/* ─────────────────────────── Small building blocks ─────────────────────── */

const DetailCol: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="min-w-0">
    <p className="text-[11.5px] text-[#969696]">{label}</p>
    <p className="mt-0.5 truncate text-[13.5px] font-semibold text-[#1A1A1A]">{value}</p>
  </div>
);

const BillsSkeleton: React.FC = () => (
  <div className="flex flex-col gap-4 p-4 lg:h-full lg:flex-row" role="status" aria-label="Loading bills">
    <div className="sp-card flex w-full flex-col p-4 lg:w-[55%]">
      <div className="sp-skeleton h-7 w-28" />
      <div className="mt-4 flex gap-2">
        <div className="sp-skeleton h-11 flex-1" />
        <div className="sp-skeleton h-11 flex-1" />
        <div className="sp-skeleton h-11 w-11" />
      </div>
      <div className="mt-4 flex-1 space-y-2.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="sp-skeleton h-[68px]" />
        ))}
      </div>
      <div className="sp-skeleton mt-4 h-11" style={{ borderRadius: 999 }} />
    </div>
    <div className="sp-card flex w-full flex-col p-5 lg:w-[45%]">
      <div className="sp-skeleton h-4 w-32" />
      <div className="sp-skeleton mt-5 h-8 w-44" />
      <div className="sp-skeleton mt-6 h-4 w-20" />
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="sp-skeleton h-11" />
        ))}
      </div>
      <div className="sp-skeleton mt-6 h-4 w-24" />
      <div className="mt-3 space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="sp-skeleton h-12" />
        ))}
      </div>
      <div className="mt-auto pt-4">
        <div className="sp-skeleton h-12 w-full" />
      </div>
    </div>
  </div>
);

const ErrorCard: React.FC<{ message: string; onRetry: () => void }> = ({ message, onRetry }) => (
  <div className="flex min-h-full flex-col items-center justify-center p-6">
    <div className="sp-card w-full max-w-md p-6 text-center">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#FEF2F2] text-[#B42318]">
        <Receipt size={22} aria-hidden />
      </span>
      <h2 className="mt-4 text-[16px] font-bold text-[#1A1A1A]">Could not load bills</h2>
      <p role="alert" className="mt-2 break-words text-[13px] text-[#B42318]">
        {message}
      </p>
      <button onClick={onRetry} className="sp-cta mt-5 h-11 px-6 text-[13.5px]">
        Retry
      </button>
    </div>
  </div>
);

/* ─────────────────────────────── Main screen ───────────────────────────── */

const BillsScreenInner: React.FC<{ onTenantRetry: () => void }> = ({ onTenantRetry }) => {
  const { loading: tenantLoading, error: tenantError, tenantId, tenant } = useTenant();
  const consumeSectionHint = useUi((s) => s.consumeSectionHint);

  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [ordersError, setOrdersError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  /* v5.116.0 — the bills search is ONE state with two doors: the header's
   * shell box and the pane's own bottom box both read and write the same
   * useUi.search, so they move together no matter which you type in. The
   * old local useState made the header box a silent stranger here. */
  const search = useUi((s) => s.search);
  const setSearch = useUi((s) => s.setSearch);
  useEffect(() => {
    useUi.getState().setSearchMeta({ placeholder: 'Search bills…' });
    return () => useUi.getState().setSearchMeta(null);
  }, []);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmArm, setConfirmArm] = useState(false);
  const [chooserOpen, setChooserOpen] = useState(false);
  const [methodChoices, setMethodChoices] = useState<MethodKey[]>([]);
  const [chosenMethod, setChosenMethod] = useState<MethodKey | null>(null);
  const [mutating, setMutating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [paidThisSession, setPaidThisSession] = useState<Set<string>>(new Set());

  /* ── 5.63.0 split bills — the ledger is the truth, the ticket follows it ──
   * splitWays: how many ways the counter plans to settle the CURRENT chooser
   * session. ledger: every payment row already on the selected ticket.
   * paidSums: ₹-in-per-ticket for the whole list (badges), bounded to unpaid. */
  const [splitWays, setSplitWays] = useState<1 | 2 | 3>(1);
  const [ledger, setLedger] = useState<ReceiptPayment[]>([]);
  const [paidSums, setPaidSums] = useState<Map<string, number>>(new Map());
  const actorEmail = useSession((s) => s.session?.email || '');

  const lastAction = useRef<{
    orderId: string;
    kind: 'pay' | 'cancel' | 'advance';
    patch: OrderPatch;
    amount?: number;
  } | null>(null);

  /** Mirror of the orders list for mutation callbacks (fresh totals). */
  const ordersRef = useRef<Order[]>([]);
  useEffect(() => {
    ordersRef.current = orders;
  }, [orders]);

  /** v5.44.0: a door that arrived with context consumes its hint ONCE —
   *  'unpaid' → land on the money still out (statusFilter 'active'), not
   *  the every-thing list. Consumed on mount, never persists. The hint is
   *  snapshotted once (useState lazy init) so the breadcrumb effect below
   *  can honor the door's origin too. */
  const [doorHint] = useState(() => useUi.getState().sectionHint);
  useEffect(() => {
    const hint = consumeSectionHint();
    if (hint === 'unpaid') setStatusFilter('active');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Receipt metadata (Task 49) — lazy per-order lookups, both fail soft. */
  const [receiptMeta, setReceiptMeta] = useState<{
    offerTitle: string | null;
    payment: ReceiptPayment | null;
  } | null>(null);
  useEffect(() => {
    if (!selectedId || !tenantId) {
      setReceiptMeta(null);
      return;
    }
    const selected = orders.find((o) => o.id === selectedId) || null;
    const wantsOffer = Number(selected?.discount_amount ?? 0) > 0;
    const wantsPayment = String(selected?.payment_status || '').toLowerCase() === 'completed';
    if (!wantsOffer && !wantsPayment) {
      setReceiptMeta(null);
      return;
    }
    let alive = true;
    Promise.all([
      wantsOffer ? fetchOrderOfferTitle(tenantId, selectedId) : Promise.resolve(null),
      wantsPayment ? fetchOrderPayment(tenantId, selectedId) : Promise.resolve(null),
    ])
      .then(([offerTitle, payment]) => {
        if (alive) setReceiptMeta({ offerTitle, payment });
      })
      .catch(() => {
        if (alive) setReceiptMeta({ offerTitle: null, payment: null });
      });
    return () => {
      alive = false;
    };
  }, [selectedId, tenantId, orders]);

  /** 5.63.0: the selected ticket's FULL ledger (one row per recorded part).
   * Rides the same deps as receiptMeta — after any mutation the orders array
   * changes and the ledger re-reads, so the panel always shows server truth. */
  useEffect(() => {
    if (!selectedId || !tenantId) {
      setLedger([]);
      return;
    }
    let alive = true;
    fetchOrderPayments(tenantId, selectedId)
      .then((rows) => {
        if (alive) setLedger(rows);
      })
      .catch(() => {
        if (alive) setLedger([]);
      });
    return () => {
      alive = false;
    };
  }, [selectedId, tenantId, orders]);

  /** Append-only status trail of the selected order (migration 007). */
  const [trail, setTrail] = useState<OrderStatusEvent[]>([]);
  const [trailLoading, setTrailLoading] = useState(false);
  useEffect(() => {
    if (!selectedId || !tenantId) {
      setTrail([]);
      return;
    }
    let alive = true;
    setTrailLoading(true);
    fetchOrderHistory(tenantId, selectedId)
      .then((rows) => {
        if (alive) setTrail(rows);
      })
      .catch(() => {
        if (alive) setTrail([]);
      })
      .finally(() => {
        if (alive) setTrailLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [selectedId, tenantId, orders]);

  /* Breadcrumbs: Bills › Payment History — unless a door brought you here
     (v5.44.0): the door already wrote its honest origin breadcrumb into the
     store ('Close-out › Bills' / 'Reports › Bills'); never clobber it. */
  useEffect(() => {
    if (doorHint === null) {
      useUi.getState().setBreadcrumb(['Bills', 'Payment History']);
    }
  }, []);

  /* ── Load orders (live Supabase; mount = section visible again) ── */
  const load = useCallback(async () => {
    if (!tenantId) return;
    setOrdersLoading(true);
    setOrdersError(null);
    try {
      const data = await fetchOrders(tenantId);
      setOrders(data);
      /* 5.63.0: badge math for the unpaid column — one bounded read of the
         ledger keyed to exactly the tickets still open. */
      const unpaidIds = data
        .filter((o) => displayStatus(o) === 'active')
        .map((o) => o.id);
      fetchOpenPaymentSums(tenantId, unpaidIds)
        .then((m) => setPaidSums(m))
        .catch(() => setPaidSums(new Map()));
    } catch (err) {
      setOrdersError((err as Error)?.message || 'Failed to load orders from the cloud.');
    } finally {
      setOrdersLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    void load();
  }, [load]);

  /* ── Filtering (status + date + search) ── */
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase().replace(/^#/, '');
    const weekAgo = Date.now() - 7 * 24 * 3600 * 1000;
    return orders.filter((o) => {
      if (statusFilter !== 'all' && displayStatus(o) !== statusFilter) return false;
      if (dateFilter === 'today' && !isSameLocalDay(o.created_at)) return false;
      if (dateFilter === '7d' && new Date(o.created_at).getTime() < weekAgo) return false;
      if (q) {
        /* WYSIWYG hay (5.26.0): search matches what the card actually prints —
           the visible subline ("Table T2 · 2 guests", "Takeaway · Meera") — not
           just raw internals. Before this, typing the literal string on every
           table card ("Table T2") matched nothing: the hay held the bare
           table number only. Customer name stays searchable too. */
        const hay = `${o.order_number} ${o.customer_name || ''} ${rowSubline(o)}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [orders, statusFilter, dateFilter, search]);

  /* NOVA "unpaid priority" (v5.3.1): money-outstanding bills float to the top
     of the list so the counter never loses sight of what's owed; within each
     group, newest first. Cancelled bills sink to the bottom. */
  /* v5.120.0 — the glint's query: the same WYSIWYG hay the filter reads
   * (with the leading '#' stripped, so "#147" glints "147" where the
   * card actually prints it). The filter memo computes its own copy —
   * this render-scope one feeds only the row highlights. */
  const billQ = search.trim().toLowerCase().replace(/^#/, '');
  const sorted = useMemo(() => {
    const rank = (o: Order): number =>
      displayStatus(o) === 'active' ? 0 : displayStatus(o) === 'cancelled' ? 2 : 1;
    return [...visible].sort((a, b) => {
      const ra = rank(a);
      const rb = rank(b);
      if (ra !== rb) return ra - rb;
      return b.created_at.localeCompare(a.created_at);
    });
  }, [visible]);

  /* Money outstanding across everything loaded (not filter-dependent) — the
     "you still owe / are owed" signal for the counter. */
  const unpaidCount = useMemo(
    () => orders.filter((o) => displayStatus(o) === 'active').length,
    [orders]
  );

  /* 5.92.0 — the count chip echoes the strip's whisper: how many of the
     unpaid are from an earlier day (the ghosts the strip points at when it
     says "N older tickets — see Bills"). The door opens both ways. */
  const olderUnpaidCount = useMemo(
    () =>
      orders.filter(
        (o) => displayStatus(o) === 'active' && !isSameLocalDay(o.created_at)
      ).length,
    [orders]
  );

  /* Keep a valid selection (auto-select the most urgent bill on load / after
     a filter change — top of the sorted list, i.e. oldest unpaid first).
     5.122.0: when a filter empties the list this early-returns and the
     selection HOLDS — the detail pane now wears the orphan strip and says
     why it still shows a bill the list does not. */
  useEffect(() => {
    if (ordersLoading || sorted.length === 0) return;
    if (!sorted.some((o) => o.id === selectedId)) setSelectedId(sorted[0].id);
  }, [sorted, selectedId, ordersLoading]);

  const selected = orders.find((o) => o.id === selectedId) || null;

  /* ── Split math (5.63.0) — paise-exact, ledger-derived ──────────────────
   * paidSum / balance come from the LEDGER (server truth), never from a
   * client-side guess. nextPartAmount rounds DOWN so the covering part
   * absorbs the cents and the parts sum to exactly the total. */
  const selectedTotal = Number(selected?.total ?? 0);
  const paidSum = useMemo(() => ledger.reduce((s, r) => s + Number(r.amount || 0), 0), [ledger]);
  const balance = Math.max(0, Math.round((selectedTotal - paidSum) * 100) / 100);
  const covered = selectedTotal > 0 && balance <= 0.005;
  const remainingWays = Math.max(0, splitWays - ledger.length);
  const nextPartAmount =
    remainingWays <= 1 ? balance : Math.floor((balance / remainingWays) * 100) / 100;
  /* The part that flips the ticket: the only-ways plan, or its last leg. */
  const nextPartIsCovering = ledger.length === 0 ? splitWays === 1 : remainingWays <= 1;

  /* Reset per-order interaction state when the selection changes. */
  useEffect(() => {
    setMenuOpen(false);
    setConfirmArm(false);
    setChooserOpen(false);
    setChosenMethod(null);
    setActionError(null);
    setSplitWays(1);
  }, [selectedId]);

  /* Escape closes the "..." menu. */
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenuOpen(false);
        setConfirmArm(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  /* ── Mutations (charge / cancel) — guarded RPCs + honest errors + retry ── */
  const runMutation = useCallback(
    async (orderId: string, patch: OrderPatch, kind: 'pay' | 'cancel', amount?: number) => {
      if (!tenantId) return;
      const order = ordersRef.current.find((o) => o.id === orderId);
      lastAction.current = { orderId, kind, patch, amount };
      setMutating(true);
      setActionError(null);
      try {
        const fullTotal = Number(order?.total ?? 0);
        if (kind === 'pay') {
          const method = (patch.payment_method as PaymentMethod) || 'cash';
          const part = Number(amount ?? order?.total ?? 0);
          /* Covering = this part settles the REMAINING balance (ledger truth,
             read before the write) — NOT "part == total": a split's covering
             half is half the ticket. The covering part rides the guarded RPC
             (ledger row + flip in one transaction); anything less is a plain
             member insert and the ticket stays honestly pending. */
          const rowsBefore = await fetchOrderPayments(tenantId, orderId).catch(
            () => [] as ReceiptPayment[]
          );
          const paidBefore = rowsBefore.reduce((s, r) => s + Number(r.amount || 0), 0);
          const balanceBefore = fullTotal - paidBefore;
          if (part >= balanceBefore - 0.005) {
            // The covering payment — migration 007/008 engine: membership-
            // checked RPC writes the final ledger row and flips the order in
            // one transaction. The order's kitchen status is NOT touched —
            // the counter is the gate.
            await recordPayment(orderId, tenantId, method, part);
          } else {
            // A non-covering SPLIT part — one ledger row, order stays
            // honestly pending until a later part covers the ticket (5.63.0).
            await insertPartialPayment(tenantId, orderId, method, part, actorEmail);
          }
        } else {
          await advanceOrder(orderId, tenantId, 'cancelled');
        }
        /* Local state follows the LEDGER, not the intent: re-derive whether
           the ticket is now covered from the rows just written. */
        let coveredNow = true;
        if (kind === 'pay') {
          const rows = await fetchOrderPayments(tenantId, orderId).catch(() => [] as ReceiptPayment[]);
          const sum = rows.reduce((s, r) => s + Number(r.amount || 0), 0);
          coveredNow = fullTotal > 0 && sum >= fullTotal - 1;
          setPaidSums((prev) => new Map(prev).set(orderId, sum));
          setLedger(rows);
        }
        setOrders((prev) =>
          prev.map((o) =>
            o.id === orderId
              ? ({
                  ...o,
                  ...patch,
                  payment_status: kind === 'pay' ? (coveredNow ? 'completed' : 'pending') : patch.payment_status,
                } as Order)
              : o
          )
        );
        if (kind === 'pay') {
          if (coveredNow) {
            setPaidThisSession((prev) => new Set(prev).add(orderId));
            setChooserOpen(false);
            setChosenMethod(null);
          }
        } else {
          setMenuOpen(false);
          setConfirmArm(false);
        }
      } catch (err) {
        setActionError(
          (err as Error)?.message ||
            (kind === 'pay' ? 'Failed to record the payment.' : 'Failed to cancel the order.')
        );
      } finally {
        setMutating(false);
      }
    },
    [tenantId, actorEmail]
  );

  /* ── Kitchen lifecycle advance (Start preparing / Mark ready / Complete) ── */
  const runAdvance = useCallback(
    async (orderId: string, toStatus: 'preparing' | 'ready' | 'completed') => {
      if (!tenantId) return;
      lastAction.current = { orderId, kind: 'advance', patch: { status: toStatus } };
      setMutating(true);
      setActionError(null);
      try {
        await advanceOrder(orderId, tenantId, toStatus);
        setOrders((prev) =>
          prev.map((o) => (o.id === orderId ? ({ ...o, status: toStatus } as Order) : o))
        );
      } catch (err) {
        setActionError((err as Error)?.message || 'Failed to update the order.');
      } finally {
        setMutating(false);
      }
    },
    [tenantId]
  );

  const retryAction = useCallback(() => {
    const last = lastAction.current;
    if (!last) return;
    if (last.kind === 'pay' || last.kind === 'cancel') {
      void runMutation(last.orderId, last.patch, last.kind, last.amount);
    } else if (last.patch.status) {
      void runAdvance(last.orderId, last.patch.status as 'preparing' | 'ready' | 'completed');
    }
  }, [runMutation, runAdvance]);

  const openChooser = useCallback(() => {
    const pm = getPrefs().paymentMethods;
    const list: MethodKey[] = [];
    if (pm.cash) list.push('cash');
    if (pm.card) list.push('card');
    if (pm.upi) list.push('upi');
    setMethodChoices(list);
    setChosenMethod(null);
    setChooserOpen(true);
  }, []);

  const goFood = useCallback(() => {
    useUi.getState().goSection('food', ['Food & Drinks', 'Categories']);
  }, []);

  const clearFilters = useCallback(() => {
    setStatusFilter('all');
    setDateFilter('all');
    setSearch('');
  }, []);

  /* v5.121.0 — the miss sentence. When the narrowed list comes up empty
   * the note must say WHY: which status word stood, which window word
   * stood, and — when a search rides along — that either can miss. The
   * words below are the select labels the operator actually clicked
   * ("Cancelled", "Last 7 days"), so the note speaks the same nouns the
   * filters do. 'all' contributes no word: "No bills" needs no adjective.
   * The catalog-truth "No bills yet" state stays a different sentence —
   * an empty ledger and a filtered one must not sound alike. */
  const missQ = search.trim();
  const statusWord =
    statusFilter === 'active'
      ? 'active'
      : statusFilter === 'paid'
        ? 'paid'
        : statusFilter === 'cancelled'
          ? 'cancelled'
          : '';
  const windowPhrase = dateFilter === 'today' ? 'from today' : dateFilter === '7d' ? 'in the last 7 days' : '';
  const filterLabels = [
    statusFilter !== 'all' ? statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1) : '',
    dateFilter === 'today' ? 'Today' : dateFilter === '7d' ? 'Last 7 days' : '',
  ].filter(Boolean);

  const missTitle = missQ
    ? `No bill matches “${missQ}”`
    : statusWord && windowPhrase
      ? `No ${statusWord} bills ${windowPhrase}`
      : statusWord
        ? `No ${statusWord} bills`
        : windowPhrase
          ? `No bills ${windowPhrase}`
          : 'No bills match';
  const missBody = missQ ? (
    <>
      Search reads order numbers, customer names, and what each card prints —
      the table line.
      {filterLabels.length > 0 && (
        <>
          {' '}
          The {filterLabels.join(' and ')}{' '}
          {filterLabels.length > 1 ? 'filters are' : 'filter is'} also in play —
          either can miss.
        </>
      )}
    </>
  ) : statusWord && windowPhrase ? (
    <>The ledger holds {orders.length} bills — none are {statusWord} AND {windowPhrase}. Loosen one, or clear both.</>
  ) : statusWord ? (
    <>The ledger holds {orders.length} bills — none of them {statusWord}. Loosen the filter, or clear it.</>
  ) : (
    <>The ledger holds {orders.length} bills — none {windowPhrase}. Widen the window, or clear it.</>
  );

  /* ── Full-screen states: tenant skeleton / honest error / empty ── */
  if (tenantLoading) return <BillsSkeleton />;
  if (tenantError) return <ErrorCard message={tenantError} onRetry={onTenantRetry} />;
  if (!tenantId)
    return (
      <ErrorCard
        message="No workspace is linked to this account."
        onRetry={onTenantRetry}
      />
    );

  if (!ordersLoading && !ordersError && orders.length === 0) {
    /* Empty_State_219-29868 */
    return (
      <div className="flex min-h-full flex-col items-center justify-center p-6">
        <span className="flex h-24 w-24 items-center justify-center rounded-full bg-[#D9E2DD]">
          <Receipt size={34} className="text-[#0F3D3E]" aria-hidden />
        </span>
        <h2 className="mt-5 text-[19px] font-bold text-[#1A1A1A]">No bills yet</h2>
        <p className="mt-1.5 max-w-xs text-center text-[13px] text-[#6B6B6B]">
          Orders placed in Food &amp; Drinks appear here.
        </p>
        <button onClick={goFood} className="sp-cta mt-6 h-11 px-6 text-[13.5px]">
          Go to Food &amp; Drinks
        </button>
      </div>
    );
  }

  if (!tenantLoading && !tenantError && tenantId && ordersLoading && orders.length === 0 && !ordersError) {
    return <BillsSkeleton />;
  }

  return (
    <div className="flex flex-col gap-4 p-4 lg:h-full lg:min-h-0 lg:flex-row">
      {/* ───────────────────────── LEFT PANE — order list ───────────────────── */}
      <section
        aria-label="Bills"
        className="sp-card flex min-h-0 w-full flex-col p-4 lg:w-[55%]"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <h1 className="sp-screen-title">Bills</h1>
            {unpaidCount > 0 && (
              <span
                title={
                  olderUnpaidCount > 0
                    ? `${unpaidCount} awaiting payment — ${olderUnpaidCount} from an earlier day`
                    : 'Bills awaiting payment in the loaded list'
                }
                className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#FFF4DB] px-2.5 py-1 text-[11px] font-extrabold tabular-nums text-[#8A5A00]"
              >
                <Receipt size={11} aria-hidden />
                {unpaidCount} unpaid{olderUnpaidCount > 0 ? ` · ${olderUnpaidCount} older` : ''}
              </span>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={() => exportBillsCsv(sorted, paidSums)}
              disabled={sorted.length === 0}
              aria-label="Export filtered bills as CSV"
              title="Export the filtered list as CSV (opens in Excel / Sheets)"
              className="flex h-11 items-center gap-1.5 rounded-xl border border-[#E3E7E0] bg-white px-3 text-[12.5px] font-bold text-[#0F3D3E] transition hover:border-[#B88E2F] hover:text-[#B88E2F] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B88E2F] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Download size={15} aria-hidden />
              CSV
            </button>
            <button
              onClick={goFood}
              aria-label="New order"
              title="New order — start in Food & Drinks"
              className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#B88E2F] text-white transition hover:bg-[#967221] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#967221]"
            >
              <Plus size={20} aria-hidden />
            </button>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <select
              aria-label="Filter bills by status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className={statusFilter !== 'all' ? FILTER_PILL_ACTIVE : WHITE_PILL}
            >
              <option value="all">All Orders</option>
              <option value="active">Active</option>
              <option value="paid">Paid</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <ChevronDown
              size={15}
              aria-hidden
              className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[#6B6B6B]"
            />
          </div>
          <div className="relative min-w-0 flex-1">
            <select
              aria-label="Filter bills by date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as DateFilter)}
              className={dateFilter !== 'all' ? FILTER_PILL_ACTIVE : WHITE_PILL}
            >
              <option value="today">Today</option>
              <option value="7d">Last 7 days</option>
              <option value="all">All time</option>
            </select>
            <ChevronDown
              size={15}
              aria-hidden
              className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[#6B6B6B]"
            />
          </div>
          {statusFilter !== 'all' || dateFilter !== 'all' ? (
            <button
              type="button"
              onClick={() => {
                setStatusFilter('all');
                setDateFilter('all');
              }}
              aria-label="Clear filters — show every bill"
              title="Clear filters"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#F3E8CF] text-[#8A5A00] transition hover:bg-[#EBDDB0] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B88E2F]"
            >
              <X size={15} aria-hidden />
            </button>
          ) : null}
        </div>

        {ordersError && orders.length > 0 && (
          <div
            role="alert"
            className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-[#F0C4BE] bg-[#FEF2F2] px-3.5 py-2.5"
          >
            <p className="min-w-0 break-words text-[12px] font-medium text-[#B42318]">
              Refresh failed: {ordersError}
            </p>
            <button
              onClick={() => void load()}
              className="h-11 shrink-0 rounded-lg bg-[#B42318] px-3.5 text-[12px] font-semibold text-white transition hover:bg-[#8F1C13]"
            >
              Retry
            </button>
          </div>
        )}

        {/* Match-count legibility line (5.26.0): while searching, say plainly
            how much of the ledger the term captured — announced politely. */}
        {!ordersLoading && search.trim() && (
          <p
            aria-live="polite"
            className="mt-3 flex items-center gap-2 text-[12px] font-medium text-[#0F3D3E]"
          >
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#0F3D3E] px-1.5 text-[10.5px] font-bold tabular-nums text-white">
              {visible.length}
            </span>
            <span className="text-[#6B6B6B]">
              of {orders.length} bills match “{search.trim()}”
            </span>
            <button
              onClick={() => setSearch('')}
              aria-label="Clear search"
              className="ml-auto flex h-6 w-6 items-center justify-center rounded-full text-[#969696] transition hover:bg-[#F6F5F2] hover:text-[#1A1A1A]"
            >
              <X size={13} aria-hidden />
            </button>
          </p>
        )}

        {/* Scrollable order list */}
        <div
          role="list"
          aria-label="Orders"
          className="mt-3 min-h-0 max-h-[52vh] flex-1 space-y-2.5 overflow-y-auto pr-0.5 lg:max-h-none"
        >
          {ordersLoading && orders.length === 0
            ? Array.from({ length: 5 }).map((_, i) => (
                <div key={i} role="listitem">
                  <div className="sp-skeleton h-[68px]" />
                </div>
              ))
            : sorted.map((o) => {
                const isSelected = o.id === selectedId;
                const status = displayStatus(o);
                return (
                  <div role="listitem" key={o.id}>
                    <button
                      onClick={() => setSelectedId(o.id)}
                      aria-pressed={isSelected}
                      aria-label={`Order ${o.order_number}, ${STATUS_LABEL[status] || status}, ${
                        status === 'active' && Number(paidSums.get(o.id) ?? 0) > 0
                          ? `${formatMoney(paidSums.get(o.id) ?? 0)} of ${formatMoney(o.total)} in the ledger, `
                          : ''
                      }${formatMoney(o.total)}`}
                      className={`relative w-full rounded-xl border-2 p-3.5 text-left transition ${
                        isSelected
                          ? 'border-[#B88E2F] bg-[#F3E8CF]'
                          : 'border-transparent bg-[#EAF0EC] hover:border-[#D9E2DD]'
                      }`}
                    >
                      {/* Status accent bar — scan the column by color, not by reading */}
                      <span
                        aria-hidden
                        className="absolute left-0 top-1/2 h-9 w-[3px] -translate-y-1/2 rounded-r-full"
                        style={{ backgroundColor: STATUS_DOT[status] || '#969696' }}
                      />
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[14.5px] font-bold text-[#1A1A1A]">
                              Order&nbsp;<MarkHit text={`#${o.order_number}`} query={billQ} />
                            </span>
                            <span
                              aria-hidden
                              className="h-2 w-2 shrink-0 rounded-full"
                              style={{ backgroundColor: STATUS_DOT[status] || '#969696' }}
                            />
                            <span className="text-[11px] font-medium text-[#6B6B6B]">
                              {STATUS_LABEL[status] || status}
                            </span>
                          </div>
                          <p className="mt-1 flex items-center gap-1.5 truncate text-[12.5px] text-[#6B6B6B]">
                            <MarkHit text={rowSubline(o)} query={billQ} />
                            {Number(o.discount_amount ?? 0) > 0 && (
                              <span className="inline-flex shrink-0 items-center rounded bg-[#E8F5EC] px-1.5 py-px text-[10px] font-bold text-[#2E7D32]">
                                {/* 5.139.0 — paise-true: the hand-rolled toFixed(0)
                                    rounded the CUSTOMER'S discount up (a ₹99.50
                                    offer read "−₹100 off", 50p fabricated) while
                                    the drawer row and the printed receipt said
                                    formatMoney truth — one rupee, two registers.
                                    The chip speaks the screen's own helper now. */}
                                −{formatMoney(Number(o.discount_amount))} off
                              </span>
                            )}
                            {/* 5.63.0 — a part-split ticket wears its ledger on
                                the card: money in (gold) vs money still open. */}
                            {status === 'active' && Number(paidSums.get(o.id) ?? 0) > 0 && (
                              <span className="inline-flex shrink-0 items-center gap-1 rounded bg-[#FDF6E3] px-1.5 py-px text-[10px] font-bold tabular-nums text-[#8A5A00]">
                                <Split size={10} aria-hidden />
                                {formatMoney(paidSums.get(o.id) ?? 0)} in · {formatMoney(Math.max(0, Number(o.total ?? 0) - Number(paidSums.get(o.id) ?? 0)))}{' '}
                                open
                              </span>
                            )}
                            {/* 5.92.0 — an off-today ticket still open wears the day:
                                the strip whispered "N older tickets — see Bills";
                                the row finishes the sentence. The gold family is
                                this app's one grammar for "needs attention". */}
                            {status === 'active' && !isSameLocalDay(o.created_at) && (
                              <span
                                title="From an earlier day — still awaiting payment"
                                className="inline-flex shrink-0 items-center gap-1 rounded bg-[#FFF4DB] px-1.5 py-px text-[10px] font-bold text-[#8A5A00]"
                              >
                                <History size={10} aria-hidden />
                                older ticket
                              </span>
                            )}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-[14.5px] font-bold tabular-nums text-[#1A1A1A]">
                            {formatMoney(o.total)}
                          </p>
                          <p className="mt-0.5 text-[11.5px] tabular-nums text-[#969696]">
                            {dayTime(o.created_at)}
                          </p>
                        </div>
                      </div>
                    </button>
                  </div>
                );
              })}
          {!ordersLoading && visible.length === 0 && (
            /* v5.121.0 — the miss says why (shared shell EmptyState): the
             * term and the reach when a search stands, the named status
             * and window when a filter stands; the gold way-out matches
             * the family (Messages' "Clear filter", F&D's "Clear search"). */
            <div role="listitem">
              <EmptyState
                icon={missQ ? Search : SlidersHorizontal}
                title={missTitle}
                body={missBody}
                action={
                  <button
                    onClick={clearFilters}
                    className="rounded-lg bg-[#F3E8CF] px-3 py-1.5 text-[12px] font-semibold text-[#1A1A1A] transition hover:bg-[#E9D9AF]"
                  >
                    Clear filters
                  </button>
                }
              />
            </div>
          )}
        </div>

        {/* Fixed search bar at the bottom of the left pane (frame) */}
        <div className="mt-3 shrink-0">
          <div className="relative">
            <Search
              size={16}
              aria-hidden
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#969696]"
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search for order ..."
              aria-label="Search for order"
              className="h-11 w-full rounded-full border border-[#E3E7E0] bg-white pl-10 pr-4 text-[13px] text-[#1A1A1A] transition placeholder:text-[#969696] hover:border-[#C9CFC9] focus:border-[#B88E2F] focus:outline-none focus:ring-2 focus:ring-[#B88E2F]/25"
            />
          </div>
        </div>
      </section>

      {/* ─────────────────────── RIGHT PANE — payment history ─────────────────── */}
      <section
        aria-label="Payment history"
        className="sp-card flex min-h-0 w-full flex-col lg:w-[45%]"
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[#E3E7E0] px-5 py-3">
          <span className="text-[12.5px] font-medium text-[#969696]">Payment History</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => void load()}
              aria-label="Refresh orders"
              className="flex h-11 w-11 items-center justify-center rounded-full text-[#1A1A1A] transition hover:bg-[#F6F5F2]"
            >
              <RefreshCw
                size={17}
                aria-hidden
                className={ordersLoading ? 'animate-spin' : undefined}
              />
            </button>
            <div className="relative">
              <button
                onClick={() => {
                  setMenuOpen((v) => !v);
                  setConfirmArm(false);
                }}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                aria-label="More actions"
                className={`flex h-11 w-11 items-center justify-center rounded-full text-[#1A1A1A] transition hover:bg-[#F6F5F2] ${
                  menuOpen ? 'bg-[#F6F5F2]' : ''
                }`}
              >
                <MoreHorizontal size={18} aria-hidden />
              </button>

              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-40" aria-hidden onClick={() => setMenuOpen(false)} />
                  <div
                    role="menu"
                    aria-label="Order actions"
                    className="absolute right-0 top-full z-50 mt-1.5 w-56 overflow-hidden rounded-xl border border-[#E3E7E0] bg-white py-1 shadow-lg"
                  >
                    {selected && displayStatus(selected) === 'active' ? (
                      confirmArm ? (
                        <button
                          role="menuitem"
                          onClick={() => {
                            if (selected) void runMutation(selected.id, { status: 'cancelled' }, 'cancel');
                          }}
                          disabled={mutating}
                          className="flex w-full items-center gap-2 bg-[#FEF2F2] px-4 py-3 text-left text-[13px] font-semibold text-[#B42318] transition hover:bg-[#FDE7E5] disabled:opacity-55"
                        >
                          {mutating && <Loader2 size={15} className="animate-spin" aria-hidden />}
                          Confirm cancel?
                        </button>
                      ) : (
                        <button
                          role="menuitem"
                          onClick={() => setConfirmArm(true)}
                          className="w-full px-4 py-3 text-left text-[13px] font-medium text-[#B42318] transition hover:bg-[#F6F5F2]"
                        >
                          Cancel order
                        </button>
                      )
                    ) : (
                      <p className="px-4 py-3 text-[12.5px] text-[#969696]">No actions available</p>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {!selected ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#D9E2DD]">
                <Receipt size={24} className="text-[#0F3D3E]" aria-hidden />
              </span>
              <p className="mt-4 text-[14px] font-semibold text-[#1A1A1A]">Select a bill</p>
              <p className="mt-1 text-[12.5px] text-[#6B6B6B]">
                Choose an order on the left to see its payment details.
              </p>
            </div>
          ) : (
            <>
              {/* v5.122.0 — the orphan honesty strip. The keep-a-valid-
                  selection effect (5.92.0) HOLDS the selected bill when a
                  filter empties the list — the pane never strands, but
                  until now it showed a bill the list swore wasn't there.
                  Same amber voice as the off-today note; the way-out is
                  the family gold. A non-empty filtered list never shows
                  this: there the effect re-selects within the list. */}
              {sorted.length === 0 && (
                <div className="mb-4 flex flex-wrap items-center gap-2.5 rounded-xl bg-[#FFF4DB] px-3.5 py-2.5">
                  <SlidersHorizontal size={14} aria-hidden className="shrink-0 text-[#8A5A00]" />
                  <p className="min-w-0 flex-1 text-[12.5px] font-medium leading-snug text-[#8A5A00]">
                    This bill is outside the current filter — the list on the
                    left came up empty. The detail stays open for reference.
                  </p>
                  <button
                    onClick={clearFilters}
                    className="shrink-0 rounded-lg bg-[#F3E8CF] px-3 py-1.5 text-[12px] font-semibold text-[#1A1A1A] transition hover:bg-[#E9D9AF]"
                  >
                    Clear filters
                  </button>
                </div>
              )}
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-[22px] font-bold text-[#1A1A1A]">
                  Order #{selected.order_number}
                </h2>
                <span
                  className={`shrink-0 rounded-full px-3.5 py-1.5 text-[12px] font-semibold ${
                    STATUS_PILL[displayStatus(selected)] || 'bg-[#D9E2DD] text-[#0F3D3E]'
                  }`}
                >
                  {STATUS_LABEL[displayStatus(selected)] || String(selected.status)}
                </span>
              </div>

              {/* 5.92.0 — the detail speaks the day too: an off-today ticket's
                  header no longer implies tonight. Bare clock for today,
                  "Yesterday 17:28" / "2 Oct · 17:28" otherwise. */}
              {!isSameLocalDay(selected.created_at) && (
                <p className="mt-1.5 flex items-center gap-1.5 text-[12px] font-medium text-[#8A5A00]">
                  <History size={12} aria-hidden />
                  {dayTime(selected.created_at)} — from an earlier day
                </p>
              )}

              {paidThisSession.has(selected.id) && (
                <div aria-live="polite" className="mt-3">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E8F5EC] px-3 py-1.5 text-[12px] font-semibold text-[#2E7D32]">
                    <Check size={14} aria-hidden />
                    Payment recorded
                  </span>
                </div>
              )}

              {actionError && (
                <div
                  role="alert"
                  className="mt-3 rounded-xl border border-[#F0C4BE] bg-[#FEF2F2] p-3.5"
                >
                  <p className="break-words text-[12.5px] font-medium text-[#B42318]">
                    {actionError}
                  </p>
                  {lastAction.current && (
                    <button
                      onClick={retryAction}
                      disabled={mutating}
                      className="mt-2 h-11 rounded-lg bg-[#B42318] px-4 text-[12px] font-semibold text-white transition hover:bg-[#8F1C13] disabled:opacity-55"
                    >
                      Retry
                    </button>
                  )}
                </div>
              )}

              {/* Details */}
              <h3 className="mt-5 text-[13px] font-semibold text-[#1A1A1A]">Details</h3>
              <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <DetailCol label="Table" value={selected.table_label || '—'} />
                <DetailCol
                  label="Guests"
                  value={selected.guest_count ? String(selected.guest_count) : '—'}
                />
                <DetailCol label="Customers" value={selected.customer_name || 'Walk-in'} />
                <DetailCol
                  label="Payment"
                  value={selected.payment_status ? capitalize(String(selected.payment_status)) : '—'}
                />
              </div>

              {/* Order Info / Items */}
              <h3 className="mt-6 text-[15px] font-bold text-[#1A1A1A]">Order Info</h3>
              <div className="mt-1 flex items-center justify-between py-2 text-[12px] font-medium text-[#969696]">
                <span>Items</span>
                <span>Price</span>
              </div>
              <div className="divide-y divide-[#E3E7E0]">
                {(selected.items || []).map((it, i) => (
                  <div key={it.id || `${selected.id}-item-${i}`} className="flex items-center gap-3 py-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#D9E2DD]">
                      {it.image_url ? (
                        <img
                          src={it.image_url}
                          alt=""
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <span aria-hidden className="text-[13px] font-bold text-[#0F3D3E]">
                          {it.name.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px] font-semibold text-[#1A1A1A]">
                        {it.name}{' '}
                        <span className="font-medium text-[#969696]">x{it.qty}</span>
                      </p>
                      {(it.variant_name || it.notes) && (
                        <p className="mt-0.5 truncate text-[11.5px] text-[#969696]">
                          {[it.variant_name, it.notes].filter(Boolean).join(' · ')}
                        </p>
                      )}
                    </div>
                    <span className="shrink-0 text-[13px] font-semibold text-[#1A1A1A]">
                      {formatMoney(it.item_total ?? it.unit_price * it.qty)}
                    </span>
                  </div>
                ))}
                {(selected.items || []).length === 0 && (
                  <p className="py-3 text-[12.5px] text-[#969696]">
                    No item lines recorded for this order.
                  </p>
                )}
              </div>

              {/* Kitchen lifecycle — the engine's legal next step, if any */}
              {(() => {
                const raw = String(selected.status || '').toLowerCase();
                const next =
                  raw === 'new' || raw === 'pending' || raw === 'active'
                    ? { to: 'preparing' as const, label: 'Start preparing' }
                    : raw === 'preparing'
                      ? { to: 'ready' as const, label: 'Mark ready' }
                      : raw === 'ready'
                        ? { to: 'completed' as const, label: 'Complete order' }
                        : null;
                if (!next) return null;
                return (
                  <div className="mt-4 flex items-center gap-2">
                    <button
                      onClick={() => void runAdvance(selected.id, next.to)}
                      disabled={mutating}
                      className="flex h-11 items-center gap-2 rounded-xl border border-[#E3E7E0] bg-white px-4 text-[12.5px] font-semibold text-[#1A1A1A] transition hover:border-[#B88E2F] disabled:opacity-55"
                    >
                      {mutating && <Loader2 size={14} className="animate-spin" aria-hidden />}
                      {next.label}
                    </button>
                    <span className="text-[11.5px] text-[#969696]">Kitchen status</span>
                  </div>
                );
              })()}

              {/* Status trail — append-only, trigger-written (migration 007) */}
              {(trail.length > 0 || trailLoading) && (
                <div className="mt-5">
                  <h3 className="text-[13px] font-semibold text-[#1A1A1A]">Timeline</h3>
                  <div className="mt-2 space-y-1.5">
                    {trailLoading && trail.length === 0 && (
                      <div className="sp-skeleton h-4 w-40" />
                    )}
                    {trail.map((ev, i) => (
                      <div
                        key={`${ev.created_at}-${i}`}
                        className="flex items-center gap-2 text-[12px] text-[#6B6B6B]"
                      >
                        <span
                          className="h-1.5 w-1.5 shrink-0 rounded-full"
                          style={{ backgroundColor: STATUS_DOT[displayStatus({ status: ev.to_status, payment_status: '' })] || '#969696' }}
                          aria-hidden
                        />
                        <span className="font-medium text-[#1A1A1A]">
                          {STATUS_LABEL[displayStatus({ status: ev.to_status, payment_status: '' })] || ev.to_status}
                        </span>
                        {ev.from_status && (
                          <span>
                            (from {ev.from_status})
                          </span>
                        )}
                        <span aria-hidden>·</span>
                        <span>{ev.actor_email || 'system'}</span>
                        <span aria-hidden>·</span>
                        <span>{dayTime(ev.created_at)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Money breakdown (Task 49) — every figure is a stored column,
                  never recomputed; discount line appears only when the ledger says so. */}
              <div className="mt-4 space-y-1.5 border-t border-dashed border-[#E3E7E0] pt-3">
                <div className="flex items-center justify-between text-[12.5px] text-[#6B6B6B]">
                  <span>Subtotal</span>
                  <span className="font-medium tabular-nums text-[#1A1A1A]">
                    {formatMoney(selected.subtotal)}
                  </span>
                </div>
                {Number(selected.discount_amount ?? 0) > 0 && (
                  <div className="flex items-center justify-between text-[12.5px]">
                    <span className="inline-flex items-center gap-1.5 text-[#2E7D32]">
                      <span className="rounded bg-[#E8F5EC] px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-[#2E7D32]">
                        OFFER
                      </span>
                      {receiptMeta?.offerTitle || 'Discount'}
                    </span>
                    <span className="font-semibold tabular-nums text-[#2E7D32]">
                      -{formatMoney(Number(selected.discount_amount ?? 0))}
                    </span>
                  </div>
                )}
                {Number(selected.tax_amount ?? 0) > 0 && (
                  <div className="flex items-center justify-between text-[12.5px] text-[#6B6B6B]">
                    <span>GST (5% · CGST+SGST)</span>
                    <span className="font-medium tabular-nums text-[#1A1A1A]">
                      {formatMoney(selected.tax_amount)}
                    </span>
                  </div>
                )}
              </div>

              {/* Total (uses order.total as stored — never recomputed) */}
              <div className="mt-3 flex items-center justify-between border-t border-[#E3E7E0] pt-3">
                <span className="text-[16px] font-bold text-[#1A1A1A]">Total</span>
                <span className="text-[20px] font-bold tabular-nums text-[#1A1A1A]">
                  {formatMoney(selected.total)}
                </span>
              </div>

              {/* The ledger (5.63.0) — every part already recorded on this
                  ticket, one row per payment. Gold = money; the open-balance
                  strip wears the amber "needs attention" grammar. A covered
                  ticket shows the same rows as its receipt's split block. */}
              {ledger.length > 0 && (
                <div className="mt-4 rounded-xl border border-[#E3E7E0] bg-[#FBFBF9] p-3.5">
                  <div className="flex items-center justify-between">
                    <h3 className="flex items-center gap-1.5 text-[13px] font-semibold text-[#1A1A1A]">
                      <Split size={14} aria-hidden className="text-[#8A6A20]" />
                      The ledger
                    </h3>
                    <span className="text-[11px] font-medium text-[#969696]">
                      {ledger.length} {ledger.length === 1 ? 'entry' : 'entries'}
                    </span>
                  </div>
                  <div className="mt-1.5 divide-y divide-[#E8E8E4]">
                    {ledger.map((p, i) => (
                      <div key={`${p.paidAt}-${i}`} className="flex items-center gap-2.5 py-2">
                        <span
                          aria-hidden
                          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#F3E8CF] text-[#8A6A20]"
                        >
                          <Check size={13} />
                        </span>
                        <span className="text-[12.5px] font-semibold text-[#1A1A1A]">
                          {METHOD_LABEL[p.method as MethodKey] || capitalize(p.method || '—')}
                        </span>
                        {p.confirmedByEmail && (
                          <span className="hidden truncate text-[11px] text-[#969696] sm:inline">
                            {p.confirmedByEmail}
                          </span>
                        )}
                        <span className="ml-auto text-[12.5px] font-bold tabular-nums text-[#1A1A1A]">
                          {formatMoney(p.amount)}
                        </span>
                        <span className="shrink-0 text-right text-[11px] tabular-nums text-[#969696]">
                          {dayTime(p.paidAt)}
                        </span>
                      </div>
                    ))}
                  </div>
                  {!covered && paidSum > 0 && (
                    <div className="mt-2 flex items-center justify-between rounded-lg bg-[#FDF6E3] px-3 py-2">
                      <span className="text-[12px] font-semibold text-[#8A5A00]">
                        Open balance — part {ledger.length + 1} settles it
                      </span>
                      <span className="text-[13px] font-bold tabular-nums text-[#8A5A00]">
                        {formatMoney(balance)}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Customer receipt (Task 49) — thermal 80mm print for any live ticket */}
              {displayStatus(selected) !== 'cancelled' && (
                <button
                  onClick={async () => {
                    // v5.29.0 — the café's face rides the paper receipt too.
                    // Warm the remote logo BEFORE the iframe prints (print()
                    // won't wait for a cold image); dead/absent logo → the
                    // pre-5.29 text-only header, never a hole.
                    const logoUrl = tenant?.logo_url || null;
                    if (logoUrl) await preloadPrintImage(logoUrl);
                    printReceipt({
                      storeName: tenant?.name || 'ServePoint store',
                      // Task 90 — the legal identity rides the paper: GSTIN
                      // turns the printout into a TAX INVOICE, FSSAI is the
                      // food licence the law wants shown. Absent → the
                      // pre-5.51 receipt, byte for byte.
                      legalName: tenant?.legal_name || null,
                      gstNumber: tenant?.gst_number || null,
                      fssaiNumber: tenant?.fssai_number || null,
                      address: tenant?.address || null,
                      phone: tenant?.owner_phone || null,
                      orderNumber: selected.order_number,
                      orderType: String(selected.order_type || ''),
                      tableLabel: selected.table_label,
                      customerName: selected.customer_name,
                      createdAt: selected.created_at,
                      items: (selected.items || []).map((it) => ({
                        name: it.name,
                        qty: it.qty,
                        variantName: it.variant_name,
                        notes: it.notes,
                        addons: it.addons,
                        lineTotal: it.item_total ?? it.unit_price * it.qty,
                      })),
                      subtotal: selected.subtotal,
                      discount: selected.discount_amount,
                      offerTitle: receiptMeta?.offerTitle || null,
                      tax: selected.tax_amount,
                      total: selected.total,
                      paymentLabel:
                        (receiptMeta?.payment?.method &&
                          (METHOD_LABEL[receiptMeta.payment.method as MethodKey] ||
                            receiptMeta.payment.method)) ||
                        (selected.payment_method
                          ? METHOD_LABEL[selected.payment_method as MethodKey] || null
                          : null),
                      /* 5.63.0 — a settled split prints one PAID line per part. */
                      splitPayments:
                        ledger.length > 1
                          ? ledger.map((p) => ({
                              label: METHOD_LABEL[p.method as MethodKey] || p.method,
                              amount: Number(p.amount || 0),
                            }))
                          : null,
                      paidAt:
                        receiptMeta?.payment?.paidAt ||
                        (displayStatus(selected) === 'paid'
                          ? [...trail].reverse().find((ev) => displayStatus({ status: ev.to_status, payment_status: '' }) === 'paid')?.created_at || null
                          : null),
                      isPaid: displayStatus(selected) === 'paid',
                      printedBy: null,
                      logoUrl,
                    });
                  }}
                  className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#B88E2F]/45 bg-[#FDF9F0] text-[12.5px] font-semibold text-[#8A6A20] transition hover:border-[#B88E2F] hover:bg-[#F8EFDB] active:scale-[0.99]"
                >
                  <Receipt size={15} aria-hidden />
                  Print receipt
                </button>
              )}
            </>
          )}
        </div>

        {/* Footer CTA — only for active orders */}
        {selected && displayStatus(selected) === 'active' && (
          <div className="shrink-0 border-t border-[#E3E7E0] px-5 py-4">
            {chooserOpen ? (
              <div>
                {/* 5.63.0 — settle in one payment or split the bill in 2/3.
                    Options below the parts already recorded are honestly
                    stranded (you can't plan fewer ways than money taken). */}
                <div className="mb-2 flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#969696]">
                    <Split size={13} aria-hidden />
                    Settle in
                  </span>
                  {splitWays > 1 && ledger.length === 0 && (
                    <span className="text-[11px] font-medium tabular-nums text-[#8A5A00]">
                      {formatMoney(selectedTotal)} ÷ {splitWays} · {formatMoney(nextPartAmount)} each
                    </span>
                  )}
                  {ledger.length > 0 && (
                    <span className="text-[11px] font-medium tabular-nums text-[#8A5A00]">
                      part {ledger.length} of {Math.max(splitWays, ledger.length + (balance > 0.005 ? 1 : 0))} in
                      {' · '}
                      {formatMoney(balance)} open
                    </span>
                  )}
                </div>
                <div role="radiogroup" aria-label="Ways to pay" className="mb-3 grid grid-cols-3 gap-2">
                  {([1, 2, 3] as const).map((w) => {
                    const stranded = balance > 0.005 && w <= ledger.length;
                    return (
                      <button
                        key={w}
                        role="radio"
                        aria-checked={splitWays === w}
                        disabled={mutating || stranded}
                        onClick={() => setSplitWays(w)}
                        className={`h-9 rounded-xl border text-[12px] font-semibold transition ${
                          splitWays === w
                            ? 'border-[#B88E2F] bg-[#F3E8CF] text-[#8A5A00]'
                            : stranded
                              ? 'cursor-not-allowed border-[#E3E7E0] bg-[#FBFBF9] text-[#C9C9C4]'
                              : 'border-[#E3E7E0] bg-white text-[#1A1A1A] hover:border-[#B88E2F]'
                        }`}
                      >
                        {w === 1 ? 'One payment' : `Split in ${w}`}
                      </button>
                    );
                  })}
                </div>
                {methodChoices.length === 0 ? (
                  <p className="py-2 text-center text-[12.5px] text-[#6B6B6B]">
                    No payment methods are enabled in Settings.
                  </p>
                ) : (
                  <div role="radiogroup" aria-label="Payment method" className="grid grid-cols-3 gap-2">
                    {methodChoices.map((m) => (
                      <button
                        key={m}
                        role="radio"
                        aria-checked={chosenMethod === m}
                        onClick={() => setChosenMethod(m)}
                        className={`h-11 rounded-xl border text-[12.5px] font-semibold transition ${
                          chosenMethod === m
                            ? 'border-[#B88E2F] bg-[#F3E8CF] text-[#1A1A1A]'
                            : 'border-[#E3E7E0] bg-white text-[#1A1A1A] hover:border-[#B88E2F]'
                        }`}
                      >
                        {METHOD_LABEL[m]}
                      </button>
                    ))}
                  </div>
                )}
                <button
                  onClick={() => {
                    if (selected && chosenMethod)
                      void runMutation(
                        selected.id,
                        // The kitchen status is NOT touched (NOVA: the counter
                        // is the gate). payment_status follows the ledger —
                        // only the covering part completes the ticket.
                        {
                          payment_status: nextPartIsCovering ? 'completed' : 'pending',
                          payment_method: chosenMethod,
                        },
                        'pay',
                        nextPartAmount
                      );
                  }}
                  disabled={!chosenMethod || mutating || methodChoices.length === 0 || balance <= 0.005}
                  aria-label={
                    nextPartIsCovering
                      ? `Confirm charge ${formatMoney(nextPartAmount)} by ${chosenMethod ? METHOD_LABEL[chosenMethod] : 'chosen method'}`
                      : `Record part ${ledger.length + 1} ${formatMoney(nextPartAmount)} by ${chosenMethod ? METHOD_LABEL[chosenMethod] : 'chosen method'}`
                  }
                  className="sp-cta mt-3 flex h-12 w-full items-center justify-center gap-2 text-[14px]"
                >
                  {mutating && <Loader2 size={17} className="animate-spin" aria-hidden />}
                  {mutating
                    ? 'Recording payment ...'
                    : nextPartIsCovering
                      ? `Confirm charge · ${formatMoney(nextPartAmount)} · ${chosenMethod ? METHOD_LABEL[chosenMethod] : 'choose method'}`
                      : `Record part ${ledger.length + 1} · ${formatMoney(nextPartAmount)} · ${chosenMethod ? METHOD_LABEL[chosenMethod] : 'choose method'}`}
                </button>
                <button
                  onClick={() => {
                    setChooserOpen(false);
                    setChosenMethod(null);
                  }}
                  disabled={mutating}
                  className="mt-1 flex h-11 w-full items-center justify-center text-[12.5px] text-[#6B6B6B] transition hover:text-[#1A1A1A] disabled:opacity-55"
                >
                  Back
                </button>
              </div>
            ) : (
              <button
                onClick={openChooser}
                disabled={mutating}
                aria-label={`Charge customer ${formatMoney(selected.total)}`}
                className="sp-cta flex h-12 w-full items-center justify-center text-[14.5px]"
              >
                Charge customer {formatMoney(selected.total)}
              </button>
            )}
          </div>
        )}
      </section>
    </div>
  );
};

/** BillsScreen — remountable wrapper so the tenant hook can be retried. */
export const BillsScreen: React.FC = () => {
  const [attempt, setAttempt] = useState(0);
  return <BillsScreenInner key={attempt} onTenantRetry={() => setAttempt((a) => a + 1)} />;
};
