import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Flame,
  MoonStar,
  Printer,
  RefreshCw,
  Wallet,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { fetchOrderCogs } from '../../lib/api';
import { formatMoney } from '../../lib/prefs';
import { useTenant } from '../../lib/tenant';
import { useSession } from '../../store/session';

/**
 * EOD Close-out (NOVA §4.3 — EOD reconciliation, /reconcile in the spec).
 *
 * Day stepper (Asia/Kolkata calendar days) → day summary (orders, gross,
 * paid, unpaid, average ticket) → cost & margin (ingredient cost the shelf
 * burned for the day's tickets, v_order_cogs view from migration 018; gross
 * margin on PAID tickets) → payment mix (cash / UPI / card from the payments
 * ledger) → a compact one-line-per-ticket ledger → and a printable z-report
 * (receipt-style strip, hidden-iframe print — popup blockers can't eat it).
 *
 * The "Right now" strip (today only) mirrors the counter's live money view:
 * tickets in the kitchen, unpaid tickets · ₹, late prep (≥10 min — the KDS
 * amber SLA). It is a mirror only: all money actions live on Bills.
 *
 * Money truth: `payments` rows are the authoritative take for the day;
 * `orders.payment_status` only drives the unpaid tickets count. COGS truth:
 * recipes × current ingredient cost (no cost-history — a restock reprices
 * history); COGS counts every LIVE ticket (the shelf burned for them all)
 * while margin banks on PAID tickets only.
 */

/* ────────────────────────── IST day-window helpers ─────────────────────── */

const IST_TZ = 'Asia/Kolkata';

/** YYYY-MM-DD of "now" in IST (en-CA gives calendar order). */
function istTodayIso(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: IST_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

/** [00:00, next 00:00) ISO window for an IST calendar day. */
function istDayBounds(dateIso: string): { startIso: string; endIso: string } {
  const start = new Date(`${dateIso}T00:00:00+05:30`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}

function shiftDay(dateIso: string, days: number): string {
  const d = new Date(`${dateIso}T00:00:00+05:30`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function prettyDay(dateIso: string): string {
  const d = new Date(`${dateIso}T00:00:00+05:30`);
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: IST_TZ,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

/** HH:MM in IST for a stored timestamptz. */
function istTime(iso: string): string {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: IST_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso));
}

/* ─────────────────────────────── types ─────────────────────────────────── */

interface DayOrder {
  id: string;
  order_number: number;
  order_type: string;
  status: string;
  total: number;
  tax_amount: number;
  payment_status: string | null;
  payment_method: string | null;
  customer_name: string | null;
  created_at: string;
  table_id: string | null;
  client_operation_id: string | null;
}

interface DayPayment {
  id: string;
  order_id: string;
  method: string;
  amount: number;
  created_at: string;
}

/** One row of v_order_cogs (018) — per-order ingredient cost. */
interface DayCogs {
  order_id: string;
  cogs: number;
}

const LATE_PREP_MIN = 10; // KDS amber SLA — the EOD strip mirrors it

/* ─────────────────────────── small view atoms ──────────────────────────── */

const StatCard: React.FC<{
  label: string;
  value: string;
  sub?: string;
  tone?: 'teal' | 'gold' | 'green' | 'red';
}> = ({ label, value, sub, tone = 'teal' }) => {
  const toneMap: Record<string, string> = {
    teal: 'text-[#0F3D3E]',
    gold: 'text-[#8A5A00]',
    green: 'text-[#2E7D32]',
    red: 'text-[#B3261E]',
  };
  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-[#E3E7E0] bg-white px-4 py-3.5">
      <span className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-[#8A938C]">{label}</span>
      <span className={`text-[21px] font-extrabold leading-none tracking-tight tabular-nums ${toneMap[tone]}`}>
        {value}
      </span>
      {sub ? <span className="text-[11px] font-semibold text-[#8A938C]">{sub}</span> : null}
    </div>
  );
};

const LIVE_CHIP: Record<string, string> = {
  new: 'bg-[#FFF4DB] text-[#8A5A00]',
  pending: 'bg-[#FFF4DB] text-[#8A5A00]',
  preparing: 'bg-[#EAF2F7] text-[#1D5D7E]',
  ready: 'bg-[#EAF0EC] text-[#2E7D32]',
  completed: 'bg-[#EAF0EC] text-[#2E7D32]',
  cancelled: 'bg-[#FCEBEA] text-[#B3261E]',
};

const StatusChip: React.FC<{ status: string }> = ({ status }) => (
  <span
    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-bold capitalize ${LIVE_CHIP[status] || 'bg-[#F0F2EF] text-[#5F6B63]'}`}
  >
    {status === 'new' ? 'in inbox' : status.replace('_', ' ')}
  </span>
);

const PayChip: React.FC<{ order: DayOrder }> = ({ order }) =>
  order.payment_status === 'completed' ? (
    <span className="inline-flex items-center rounded-full bg-[#EAF0EC] px-2 py-0.5 text-[10.5px] font-bold text-[#2E7D32]">
      {order.payment_method || 'paid'}
    </span>
  ) : order.status === 'cancelled' ? (
    <span className="text-[10.5px] font-bold text-[#B3261E]">—</span>
  ) : (
    <span className="inline-flex items-center rounded-full bg-[#FFF4DB] px-2 py-0.5 text-[10.5px] font-bold text-[#8A5A00]">
      due
    </span>
  );

/* ───────────────────────────── z-report print ──────────────────────────── */

interface ZReportOpts {
  storeName: string;
  dateIso: string;
  orders: number;
  gross: number;
  paid: number;
  unpaid: number;
  unpaidTickets: number;
  gst: number;
  cogs: number;
  margin: number;
  mix: { method: string; amount: number }[];
  cancelled: number;
  printedBy: string;
}

function printZReport(opts: ZReportOpts): void {
  const row = (l: string, r: string, strong = false) =>
    `<div style="display:flex;justify-content:space-between;padding:2.5px 0;${strong ? 'font-weight:700;' : ''}"><span>${l}</span><span style="font-variant-numeric:tabular-nums">${r}</span></div>`;
  const methodRows =
    opts.mix.length > 0
      ? opts.mix.map((m) => row(m.method.toUpperCase(), formatMoney(m.amount))).join('')
      : row('—', 'no payments');
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Z-report ${opts.dateIso}</title></head>
<body style="font-family:'Courier New',monospace;color:#000;margin:0;padding:16px 12px;width:300px;font-size:12px;">
  <div style="text-align:center;border-bottom:1px dashed #000;padding-bottom:8px;margin-bottom:8px;">
    <div style="font-size:15px;font-weight:800;letter-spacing:1px;">${opts.storeName}</div>
    <div>Z-REPORT · END OF DAY</div>
    <div>${prettyDay(opts.dateIso)} · Asia/Kolkata</div>
  </div>
  <div style="border-top:1px dashed #000;padding-top:6px;">
    ${row('Orders', String(opts.orders), true)}
    ${row('Cancelled', String(opts.cancelled))}
    ${row('Gross sales', formatMoney(opts.gross), true)}
    ${row('GST collected', formatMoney(opts.gst))}
    ${row('PAID', formatMoney(opts.paid), true)}
    ${row('UNPAID', `${formatMoney(opts.unpaid)} (${opts.unpaidTickets} tkt)`, true)}
  </div>
  <div style="border-top:1px dashed #000;margin-top:8px;padding-top:6px;">
    <div style="font-weight:800;padding-bottom:3px;">COST &amp; MARGIN · PAID TICKETS</div>
    ${row('Ingredient cost', formatMoney(opts.cogs))}
    ${row('GROSS MARGIN', formatMoney(opts.margin), true)}
  </div>
  <div style="border-top:1px dashed #000;margin-top:8px;padding-top:6px;">
    <div style="font-weight:800;padding-bottom:3px;">PAYMENTS</div>
    ${methodRows}
  </div>
  <div style="border-top:1px dashed #000;margin-top:8px;padding-top:6px;text-align:center;color:#333;">
    <div>Printed ${new Intl.DateTimeFormat('en-IN', { timeZone: IST_TZ, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date())} IST${opts.printedBy ? ` · ${opts.printedBy}` : ''}</div>
    <div style="margin-top:6px;letter-spacing:2px;">· · · z · close · · ·</div>
  </div>
</body></html>`;

  const frame = document.createElement('iframe');
  frame.style.position = 'fixed';
  frame.style.right = '0';
  frame.style.bottom = '0';
  frame.style.width = '0';
  frame.style.height = '0';
  frame.style.border = '0';
  document.body.appendChild(frame);
  const doc = frame.contentWindow?.document;
  if (!doc) return;
  doc.open();
  doc.write(html);
  doc.close();
  frame.contentWindow?.focus();
  frame.contentWindow?.print();
  setTimeout(() => document.body.removeChild(frame), 1500);
}

/* ────────────────────────────── the screen ─────────────────────────────── */

const EodScreenInner: React.FC<{ onTenantRetry: () => void }> = ({ onTenantRetry }) => {
  const { loading: tenantLoading, error: tenantError, tenantId, tenant } = useTenant();
  const session = useSession((s) => s.session);
  const [dateIso, setDateIso] = useState<string>(() => istTodayIso());
  const [orders, setOrders] = useState<DayOrder[]>([]);
  const [payments, setPayments] = useState<DayPayment[]>([]);
  const [cogsRows, setCogsRows] = useState<DayCogs[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshedAt, setRefreshedAt] = useState<Date | null>(null);

  const isToday = dateIso === istTodayIso();

  const load = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const { startIso, endIso } = istDayBounds(dateIso);
      const [oRes, pRes, cRes] = await Promise.all([
        supabase
          .from('orders')
          .select(
            'id, order_number, order_type, status, total, tax_amount, payment_status, payment_method, customer_name, created_at, table_id, client_operation_id'
          )
          .eq('tenant_id', tenantId)
          .gte('created_at', startIso)
          .lt('created_at', endIso)
          .order('created_at', { ascending: true }),
        supabase
          .from('payments')
          .select('id, order_id, method, amount, created_at')
          .eq('tenant_id', tenantId)
          .gte('created_at', startIso)
          .lt('created_at', endIso)
          .order('created_at', { ascending: true }),
        // cost & margin for the day — 018 view, tenant-scoped by RLS,
        // filtered client-side to this day's tickets by order_id
        fetchOrderCogs(tenantId).then((m) =>
          [...m.entries()].map(([order_id, cogs]) => ({ order_id, cogs })),
        ),
      ]);
      if (oRes.error) throw oRes.error;
      if (pRes.error) throw pRes.error;
      setOrders((oRes.data || []) as DayOrder[]);
      setPayments((pRes.data || []) as DayPayment[]);
      const ids = new Set(((oRes.data || []) as DayOrder[]).map((o) => o.id));
      setCogsRows(
        (cRes as unknown as DayCogs[]).filter((r) => ids.has(r.order_id)),
      );
      setRefreshedAt(new Date());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not load the day.');
    } finally {
      setLoading(false);
    }
  }, [tenantId, dateIso]);

  useEffect(() => {
    void load();
  }, [load]);

  /* live mirror for the "Right now" strip (today only) — 20s while open */
  useEffect(() => {
    if (!isToday) return;
    const t = setInterval(() => void load(), 20000);
    return () => clearInterval(t);
  }, [isToday, load]);

  /* ── aggregates ── */
  const agg = useMemo(() => {
    const live = orders.filter((o) => o.status !== 'cancelled');
    const cancelled = orders.length - live.length;
    const gross = live.reduce((s, o) => s + Number(o.total || 0), 0);
    const gst = live.reduce((s, o) => s + Number(o.tax_amount || 0), 0);
    const paid = payments.reduce((s, p) => s + Number(p.amount || 0), 0);
    const unpaidOrders = live.filter((o) => o.payment_status !== 'completed');
    const unpaidAmt = unpaidOrders.reduce((s, o) => s + Number(o.total || 0), 0);
    const avg = live.length > 0 ? gross / live.length : 0;

    const mixMap = new Map<string, number>();
    payments.forEach((p) => mixMap.set(p.method, (mixMap.get(p.method) || 0) + Number(p.amount || 0)));
    const mix = ['cash', 'upi', 'card']
      .filter((m) => mixMap.has(m))
      .map((m) => ({ method: m, amount: mixMap.get(m) || 0 }));

    // Honesty probe: tickets marked paid with NO payments-ledger row were
    // recorded outside the payment engine (008: sp_record_payment is the
    // only legitimate way money lands). The z-report counts ledger rows.
    const paidOrderIds = new Set(payments.map((p) => p.order_id));
    const orphanPaid = live.filter((o) => o.payment_status === 'completed' && !paidOrderIds.has(o.id)).length;

    // ── cost & margin (018): v_order_cogs rows for THIS day's tickets ──
    const cogsById = new Map(cogsRows.map((r) => [r.order_id, Number(r.cogs)]));
    let dayCogs = 0; // the shelf burned for every live ticket (paid or not)
    let paidCogs = 0; // …but margin banks on collected money only
    let paidNet = 0;
    let paidTickets = 0;
    for (const o of live) {
      const cost = cogsById.get(o.id) ?? 0;
      dayCogs += cost;
      if (o.payment_status === 'completed') {
        paidTickets += 1;
        // total − GST IS the discounted net (GST is computed on that base)
        paidNet += Number(o.total || 0) - Number(o.tax_amount || 0);
        paidCogs += cost;
      }
    }
    const margin = paidNet - paidCogs;

    return {
      live,
      cancelled,
      gross,
      gst,
      paid,
      unpaidOrders,
      unpaidAmt,
      avg,
      mix,
      orphanPaid,
      dayCogs,
      paidCogs,
      paidNet,
      margin,
      paidTickets,
    };
  }, [orders, payments, cogsRows]);

  /* right-now strip (today) */
  const now = useMemo(() => {
    const inKitchen = orders.filter((o) => ['pending', 'preparing'].includes(o.status)).length;
    const latePrep = orders.filter((o) => {
      if (o.status !== 'preparing') return false;
      return Date.now() - new Date(o.created_at).getTime() >= LATE_PREP_MIN * 60000;
    }).length;
    return { inKitchen, latePrep, unpaid: agg.unpaidOrders.length, unpaidAmt: agg.unpaidAmt };
  }, [orders, agg]);

  const printReport = () => {
    printZReport({
      storeName: tenant?.name || 'ServePoint store',
      dateIso,
      orders: agg.live.length,
      gross: agg.gross,
      paid: agg.paid,
      unpaid: agg.unpaidAmt,
      unpaidTickets: agg.unpaidOrders.length,
      gst: agg.gst,
      cogs: agg.paidCogs,
      margin: agg.margin,
      mix: agg.mix,
      cancelled: agg.cancelled,
      printedBy: session?.email || '',
    });
  };

  /* ── tenant gates ── */
  if (tenantLoading) {
    return (
      <div className="flex h-full items-center justify-center p-4 lg:p-5">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#0F3D3E] border-t-transparent" />
      </div>
    );
  }
  if (tenantError || !tenantId) {
    return (
      <div className="flex h-full items-center justify-center p-4 lg:p-5">
        <div className="max-w-sm rounded-2xl border border-[#F2D9D6] bg-[#FCEBEA] p-5 text-center">
          <AlertTriangle className="mx-auto mb-2 text-[#B3261E]" size={22} />
          <p className="text-[13px] font-semibold text-[#7A2E28]">{tenantError || 'No workspace linked.'}</p>
          <button
            onClick={onTenantRetry}
            className="mt-3 min-h-[44px] rounded-xl bg-[#0F3D3E] px-4 text-[13px] font-bold text-white"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-4 lg:p-5" aria-label="Close-out">
      {/* ── day stepper ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setDateIso((d) => shiftDay(d, -1))}
            aria-label="Previous day"
            className="flex h-[44px] w-[44px] items-center justify-center rounded-xl border border-[#E3E7E0] bg-white text-[#0F3D3E] transition-colors hover:bg-[#F0F2EF]"
          >
            <ChevronLeft size={18} />
          </button>
          <div className="flex min-w-[210px] items-center justify-center gap-2 rounded-xl border border-[#E3E7E0] bg-white px-4 py-2.5">
            <CalendarDays size={15} className="text-[#B88E2F]" aria-hidden />
            <span className="text-[14px] font-extrabold tracking-tight text-[#0F3D3E]">{prettyDay(dateIso)}</span>
            {isToday ? (
              <span className="rounded-full bg-[#0F3D3E] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                today
              </span>
            ) : null}
          </div>
          <button
            onClick={() => setDateIso((d) => shiftDay(d, 1))}
            disabled={dateIso >= istTodayIso()}
            aria-label="Next day"
            className="flex h-[44px] w-[44px] items-center justify-center rounded-xl border border-[#E3E7E0] bg-white text-[#0F3D3E] transition-colors hover:bg-[#F0F2EF] disabled:cursor-not-allowed disabled:opacity-35"
          >
            <ChevronRight size={18} />
          </button>
          {!isToday ? (
            <button
              onClick={() => setDateIso(istTodayIso())}
              className="min-h-[44px] rounded-xl border border-[#E3E7E0] bg-white px-3 text-[12.5px] font-bold text-[#0F3D3E] transition-colors hover:bg-[#F0F2EF]"
            >
              Today
            </button>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          {refreshedAt ? (
            <span className="hidden text-[11px] font-semibold text-[#8A938C] sm:inline" title="Last refreshed">
              as of {istTime(refreshedAt.toISOString())} IST
            </span>
          ) : null}
          <button
            onClick={() => void load()}
            className="flex h-[44px] w-[44px] items-center justify-center rounded-xl border border-[#E3E7E0] bg-white text-[#0F3D3E] transition-colors hover:bg-[#F0F2EF]"
            aria-label="Refresh"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={printReport}
            disabled={loading || orders.length === 0}
            className="flex min-h-[44px] items-center gap-2 rounded-xl bg-[#B88E2F] px-4 text-[13px] font-extrabold text-white shadow-[0_1px_2px_rgba(15,61,62,0.15)] transition-colors hover:bg-[#A57D27] disabled:opacity-40"
          >
            <Printer size={15} aria-hidden />
            Print z-report
          </button>
        </div>
      </div>

      {/* ── right now (today only) ── */}
      {isToday ? (
        <section
          aria-label="Right now"
          className="flex flex-wrap gap-3 rounded-2xl border border-[#F0E4C3] bg-gradient-to-r from-[#FDF6E3] to-white p-4"
        >
          <div className="flex min-w-[150px] flex-1 items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EAF2F7] text-[#1D5D7E]">
              <Flame size={18} aria-hidden />
            </span>
            <div>
              <p className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-[#8A938C]">In the kitchen</p>
              <p className="text-[16px] font-extrabold leading-tight tabular-nums text-[#0F3D3E]">
                {now.inKitchen} {now.inKitchen === 1 ? 'ticket' : 'tickets'}
              </p>
            </div>
          </div>
          <div className="flex min-w-[150px] flex-1 items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FFF4DB] text-[#8A5A00]">
              <Wallet size={18} aria-hidden />
            </span>
            <div>
              <p className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-[#8A938C]">Unpaid right now</p>
              <p className="text-[16px] font-extrabold leading-tight tabular-nums text-[#8A5A00]">
                {now.unpaid} · {formatMoney(now.unpaidAmt)}
              </p>
            </div>
          </div>
          <div className="flex min-w-[150px] flex-1 items-center gap-3">
            <span
              className={`flex h-10 w-10 items-center justify-center rounded-xl ${now.latePrep > 0 ? 'bg-[#FCEBEA] text-[#B3261E]' : 'bg-[#EAF0EC] text-[#2E7D32]'}`}
            >
              <Clock size={18} aria-hidden />
            </span>
            <div>
              <p className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-[#8A938C]">Late prep</p>
              <p
                className={`text-[16px] font-extrabold leading-tight tabular-nums ${now.latePrep > 0 ? 'text-[#B3261E]' : 'text-[#2E7D32]'}`}
              >
                {now.latePrep} <span className="text-[11px] font-bold text-[#8A938C]">over {LATE_PREP_MIN} min</span>
              </p>
            </div>
          </div>
        </section>
      ) : null}

      {/* ── error ── */}
      {error ? (
        <div className="flex items-center gap-3 rounded-2xl border border-[#F2D9D6] bg-[#FCEBEA] p-4">
          <AlertTriangle size={18} className="shrink-0 text-[#B3261E]" />
          <p className="text-[13px] font-semibold text-[#7A2E28]">{error}</p>
          <button
            onClick={() => void load()}
            className="ml-auto min-h-[36px] rounded-lg bg-[#B3261E] px-3 text-[12px] font-bold text-white"
          >
            Retry
          </button>
        </div>
      ) : null}

      {loading && orders.length === 0 ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="h-[86px] animate-pulse rounded-2xl border border-[#E3E7E0] bg-white" />
          ))}
        </div>
      ) : (
        <>
          {/* ── day summary ── */}
          <section aria-label="Day summary" className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <StatCard
              label="Orders"
              value={String(agg.live.length)}
              sub={agg.cancelled > 0 ? `${agg.cancelled} cancelled` : 'live day count'}
            />
            <StatCard label="Gross" value={formatMoney(agg.gross)} sub={`GST ${formatMoney(agg.gst)}`} />
            <StatCard label="Paid" value={formatMoney(agg.paid)} tone="green" sub="payments taken" />
            <StatCard
              label="Unpaid"
              value={formatMoney(agg.unpaidAmt)}
              tone={agg.unpaidAmt > 0 ? 'gold' : 'teal'}
              sub={`${agg.unpaidOrders.length} ${agg.unpaidOrders.length === 1 ? 'ticket' : 'tickets'} due`}
            />
            <StatCard label="Avg ticket" value={formatMoney(agg.avg)} sub="gross ÷ orders" />
          </section>

          {/* ── cost & margin: what the shelf burned vs what the cafe keeps ── */}
          <section
            aria-label="Cost and margin"
            className="grid grid-cols-2 gap-3 rounded-2xl border border-[#E3E7E0] bg-white p-4 md:grid-cols-4"
          >
            <StatCard
              label="Ingredient cost"
              value={formatMoney(agg.dayCogs)}
              sub="all live tickets · recipes × shelf cost"
              tone="gold"
            />
            <StatCard
              label="Margin · paid"
              value={formatMoney(agg.margin)}
              sub={`paid net ${formatMoney(agg.paidNet)} · ${agg.paidTickets} ${agg.paidTickets === 1 ? 'ticket' : 'tickets'}`}
              tone={agg.paidNet > 0 && agg.margin / agg.paidNet < 0.4 ? 'red' : 'green'}
            />
            <div className="col-span-2 flex flex-col justify-center gap-2 rounded-2xl bg-[#F7F8F6] px-4 py-3">
              <span className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-[#8A938C]">
                Where the paid money went
              </span>
              <div
                className="flex h-3 w-full overflow-hidden rounded-full bg-[#EAF0EC]"
                role="img"
                aria-label={`Paid net ${formatMoney(agg.paidNet)}: ingredients ${formatMoney(agg.paidCogs)}, margin ${formatMoney(agg.margin)}`}
              >
                <div
                  className="h-full bg-[#B88E2F] transition-all duration-700"
                  style={{
                    width: `${Math.max(agg.paidNet > 0 ? (agg.paidCogs / agg.paidNet) * 100 : 0, 1.5)}%`,
                  }}
                />
                <div
                  className="h-full bg-[#2E7D32] transition-all duration-700"
                  style={{
                    width: `${Math.max(agg.paidNet > 0 ? (agg.margin / agg.paidNet) * 100 : 0, 0)}%`,
                  }}
                />
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[10.5px] font-semibold text-[#5F6B63]">
                <span className="inline-flex items-center gap-1.5">
                  <span aria-hidden className="h-2 w-2 rounded-full bg-[#B88E2F]" />
                  ingredients {formatMoney(agg.paidCogs)}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span aria-hidden className="h-2 w-2 rounded-full bg-[#2E7D32]" />
                  the cafe keeps {formatMoney(agg.margin)}
                </span>
              </div>
            </div>
          </section>

          {/* ── payment mix ── */}
          <section aria-label="Payment mix" className="rounded-2xl border border-[#E3E7E0] bg-white p-4">
            <h2 className="text-[13px] font-extrabold uppercase tracking-[0.06em] text-[#0F3D3E]">Payment mix</h2>
            {agg.mix.length === 0 ? (
              <p className="mt-2 text-[12.5px] font-semibold text-[#8A938C]">
                No payments recorded this day — charged tickets land here.
              </p>
            ) : (
              <div className="mt-3 flex flex-col gap-2.5">
                {agg.mix.map((m) => {
                  const pct = agg.paid > 0 ? Math.round((m.amount / agg.paid) * 100) : 0;
                  const barTone: Record<string, string> = {
                    cash: 'bg-[#2E7D32]',
                    upi: 'bg-[#1D5D7E]',
                    card: 'bg-[#B88E2F]',
                  };
                  return (
                    <div key={m.method} className="flex items-center gap-3">
                      <span className="w-10 text-[11px] font-extrabold uppercase tracking-wide text-[#5F6B63]">
                        {m.method}
                      </span>
                      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-[#F0F2EF]">
                        <div
                          className={`h-full rounded-full ${barTone[m.method] || 'bg-[#0F3D3E]'}`}
                          style={{ width: `${Math.max(pct, 4)}%` }}
                        />
                      </div>
                      <span className="w-24 text-right text-[13px] font-extrabold tabular-nums text-[#0F3D3E]">
                        {formatMoney(m.amount)}
                      </span>
                      <span className="w-10 text-right text-[11px] font-bold tabular-nums text-[#8A938C]">{pct}%</span>
                    </div>
                  );
                })}
              </div>
            )}
            {agg.orphanPaid > 0 ? (
              <p
                className="mt-3 flex items-center gap-2 rounded-xl bg-[#FFF4DB] px-3 py-2 text-[11.5px] font-semibold text-[#8A5A00]"
                role="note"
              >
                <AlertTriangle size={13} aria-hidden />
                {agg.orphanPaid} {agg.orphanPaid === 1 ? 'ticket is' : 'tickets are'} marked paid with no ledger row —
                recorded outside the payment engine; not counted in PAID.
              </p>
            ) : null}
          </section>

          {/* ── ledger ── */}
          <section aria-label="Order ledger" className="rounded-2xl border border-[#E3E7E0] bg-white p-4">
            <h2 className="text-[13px] font-extrabold uppercase tracking-[0.06em] text-[#0F3D3E]">
              Ledger <span className="ml-1 font-bold normal-case text-[#8A938C]">· {orders.length} tickets</span>
            </h2>
            {orders.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <MoonStar size={26} className="text-[#C8CFC9]" aria-hidden />
                <p className="text-[13.5px] font-bold text-[#5F6B63]">No sales recorded this day</p>
                <p className="max-w-xs text-[12px] font-semibold text-[#8A938C]">
                  Counter sales and guest QR tickets both land here once placed.
                </p>
              </div>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[560px] border-collapse text-left">
                  <thead>
                    <tr className="border-b border-[#E3E7E0] text-[10.5px] font-bold uppercase tracking-[0.07em] text-[#8A938C]">
                      <th className="py-2 pr-3">Time</th>
                      <th className="py-2 pr-3">#</th>
                      <th className="py-2 pr-3">Source</th>
                      <th className="py-2 pr-3">Guest</th>
                      <th className="py-2 pr-3">Status</th>
                      <th className="py-2 pr-3">Pay</th>
                      <th className="py-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((o) => (
                      <tr
                        key={o.id}
                        className="border-b border-[#F0F2EF] text-[12.5px] transition-colors last:border-0 hover:bg-[#F7F8F6]"
                      >
                        <td className="py-2 pr-3 font-bold tabular-nums text-[#5F6B63]">{istTime(o.created_at)}</td>
                        <td className="py-2 pr-3 font-extrabold tabular-nums text-[#0F3D3E]">#{o.order_number}</td>
                        <td className="py-2 pr-3">
                          {o.client_operation_id ? (
                            <span className="inline-flex items-center rounded-full bg-[#FFF4DB] px-2 py-0.5 text-[10.5px] font-bold text-[#8A5A00]">
                              QR
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-[#EAF0EC] px-2 py-0.5 text-[10.5px] font-bold text-[#0F3D3E]">
                              counter
                            </span>
                          )}
                        </td>
                        <td className="py-2 pr-3 text-[#5F6B63]">{o.customer_name || '—'}</td>
                        <td className="py-2 pr-3">
                          <StatusChip status={o.status} />
                        </td>
                        <td className="py-2 pr-3">
                          <PayChip order={o} />
                        </td>
                        <td className="py-2 text-right font-extrabold tabular-nums text-[#0F3D3E]">
                          {formatMoney(Number(o.total || 0))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
};

/** EodScreen — remountable wrapper so the tenant hook can be retried. */
export const EodScreen: React.FC = () => {
  const [attempt, setAttempt] = useState(0);
  return <EodScreenInner key={attempt} onTenantRetry={() => setAttempt((a) => a + 1)} />;
};
