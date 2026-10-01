import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  ChevronDown,
  Loader2,
  MoreHorizontal,
  Plus,
  Receipt,
  RefreshCw,
  Search,
} from 'lucide-react';
import {
  advanceOrder,
  fetchOrderHistory,
  fetchOrders,
  recordPayment,
} from '../../lib/api';
import type { OrderStatusEvent, PaymentMethod } from '../../lib/api';
import { formatMoney, getPrefs } from '../../lib/prefs';
import { useTenant } from '../../lib/tenant';
import { useUi } from '../../store/session';
import type { Order } from '../../types';

/**
 * Bills / Payment History (ServePoint production, ADR-0014).
 * Matches docs/design/servepoint/frames/Bills_219-29423.png (+ variants / Empty_State_219-29868).
 * Two-pane: left order list w/ filters + bottom search bar; right detail pane with
 * Details, Order Info, Items, Total and the gold "Charge customer" flow.
 * Data is live Supabase only (fetchOrders / updateOrderStatus) — no mocks.
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

function hhmm(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function isSameLocalDay(iso: string): boolean {
  return new Date(iso).toDateString() === new Date().toDateString();
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
  const { loading: tenantLoading, error: tenantError, tenantId } = useTenant();

  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [ordersError, setOrdersError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmArm, setConfirmArm] = useState(false);
  const [chooserOpen, setChooserOpen] = useState(false);
  const [methodChoices, setMethodChoices] = useState<MethodKey[]>([]);
  const [chosenMethod, setChosenMethod] = useState<MethodKey | null>(null);
  const [mutating, setMutating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [paidThisSession, setPaidThisSession] = useState<Set<string>>(new Set());

  const lastAction = useRef<{
    orderId: string;
    kind: 'pay' | 'cancel' | 'advance';
    patch: OrderPatch;
  } | null>(null);

  /** Mirror of the orders list for mutation callbacks (fresh totals). */
  const ordersRef = useRef<Order[]>([]);
  useEffect(() => {
    ordersRef.current = orders;
  }, [orders]);

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

  /* Breadcrumbs: Bills › Payment History */
  useEffect(() => {
    useUi.getState().setBreadcrumb(['Bills', 'Payment History']);
  }, []);

  /* ── Load orders (live Supabase; mount = section visible again) ── */
  const load = useCallback(async () => {
    if (!tenantId) return;
    setOrdersLoading(true);
    setOrdersError(null);
    try {
      const data = await fetchOrders(tenantId);
      setOrders(data);
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
        const hay = `${o.order_number} ${o.customer_name || ''} ${o.table_label || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [orders, statusFilter, dateFilter, search]);

  /* Keep a valid selection (auto-select newest on load / after filter change). */
  useEffect(() => {
    if (ordersLoading || visible.length === 0) return;
    if (!visible.some((o) => o.id === selectedId)) setSelectedId(visible[0].id);
  }, [visible, selectedId, ordersLoading]);

  const selected = orders.find((o) => o.id === selectedId) || null;

  /* Reset per-order interaction state when the selection changes. */
  useEffect(() => {
    setMenuOpen(false);
    setConfirmArm(false);
    setChooserOpen(false);
    setChosenMethod(null);
    setActionError(null);
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
    async (orderId: string, patch: OrderPatch, kind: 'pay' | 'cancel') => {
      if (!tenantId) return;
      const order = ordersRef.current.find((o) => o.id === orderId);
      lastAction.current = { orderId, kind, patch };
      setMutating(true);
      setActionError(null);
      try {
        if (kind === 'pay') {
          // Migration 007 engine: membership-checked RPC writes the payments
          // ledger row and flips the order in one transaction. The order's
          // kitchen status is NOT touched — the counter is the gate.
          await recordPayment(
            orderId,
            tenantId,
            (patch.payment_method as PaymentMethod) || 'cash',
            Number(order?.total ?? 0)
          );
        } else {
          await advanceOrder(orderId, tenantId, 'cancelled');
        }
        setOrders((prev) =>
          prev.map((o) => (o.id === orderId ? ({ ...o, ...patch } as Order) : o))
        );
        if (kind === 'pay') {
          setPaidThisSession((prev) => new Set(prev).add(orderId));
          setChooserOpen(false);
          setChosenMethod(null);
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
    [tenantId]
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
      void runMutation(last.orderId, last.patch, last.kind);
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
          <h1 className="text-[20px] font-bold text-[#1A1A1A]">Bills</h1>
          <button
            onClick={goFood}
            aria-label="New order"
            title="New order — start in Food & Drinks"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#B88E2F] text-white transition hover:bg-[#967221] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#967221]"
          >
            <Plus size={20} aria-hidden />
          </button>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <select
              aria-label="Filter bills by status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className={WHITE_PILL}
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
              className={WHITE_PILL}
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
            : visible.map((o) => {
                const isSelected = o.id === selectedId;
                const status = displayStatus(o);
                return (
                  <div role="listitem" key={o.id}>
                    <button
                      onClick={() => setSelectedId(o.id)}
                      aria-pressed={isSelected}
                      aria-label={`Order ${o.order_number}, ${STATUS_LABEL[status] || status}, ${formatMoney(o.total)}`}
                      className={`w-full rounded-xl border-2 p-3.5 text-left transition ${
                        isSelected
                          ? 'border-[#B88E2F] bg-[#F3E8CF]'
                          : 'border-transparent bg-[#EAF0EC] hover:border-[#D9E2DD]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[14.5px] font-bold text-[#1A1A1A]">
                              Order #{o.order_number}
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
                          <p className="mt-1 truncate text-[12.5px] text-[#6B6B6B]">
                            {rowSubline(o)}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-[14.5px] font-bold text-[#1A1A1A]">
                            {formatMoney(o.total)}
                          </p>
                          <p className="mt-0.5 text-[11.5px] text-[#969696]">
                            {hhmm(o.created_at)}
                          </p>
                        </div>
                      </div>
                    </button>
                  </div>
                );
              })}
          {!ordersLoading && visible.length === 0 && (
            <div role="listitem" className="flex flex-col items-center justify-center py-10 text-center">
              <p className="text-[13.5px] font-semibold text-[#1A1A1A]">No bills match</p>
              <p className="mt-1 text-[12.5px] text-[#6B6B6B]">
                Try a different filter or search term.
              </p>
              <button
                onClick={clearFilters}
                className="mt-4 h-11 rounded-full border border-[#E3E7E0] bg-white px-5 text-[13px] font-semibold text-[#1A1A1A] transition hover:border-[#B88E2F]"
              >
                Clear filters
              </button>
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
                      {formatMoney(it.unit_price)}
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
                        <span>{hhmm(ev.created_at)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Total (uses order.total as stored — never recomputed) */}
              <div className="mt-4 flex items-center justify-between border-t border-[#E3E7E0] pt-4">
                <span className="text-[16px] font-bold text-[#1A1A1A]">Total</span>
                <span className="text-[20px] font-bold text-[#1A1A1A]">
                  {formatMoney(selected.total)}
                </span>
              </div>
            </>
          )}
        </div>

        {/* Footer CTA — only for active orders */}
        {selected && displayStatus(selected) === 'active' && (
          <div className="shrink-0 border-t border-[#E3E7E0] px-5 py-4">
            {chooserOpen ? (
              <div>
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
                        // Money fields only — the kitchen status is NOT touched
                        // (NOVA: the counter is the gate, engine advances status).
                        { payment_status: 'completed', payment_method: chosenMethod },
                        'pay'
                      );
                  }}
                  disabled={!chosenMethod || mutating || methodChoices.length === 0}
                  className="sp-cta mt-3 flex h-12 w-full items-center justify-center gap-2 text-[14px]"
                >
                  {mutating && <Loader2 size={17} className="animate-spin" aria-hidden />}
                  {mutating
                    ? 'Recording payment ...'
                    : `Confirm charge · ${chosenMethod ? METHOD_LABEL[chosenMethod] : 'choose method'}`}
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
