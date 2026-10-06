import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  ChevronDown,
  Clock,
  Copy,
  AlertTriangle,
  History,
  Loader2,
  MessageCircle,
  MoreHorizontal,
  Plus,
  Receipt,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Split,
  Star,
  StickyNote,
  X,
} from 'lucide-react';
import { chaseAge, dayTime } from '../../lib/day';
import {
  advanceOrder,
  fetchOrderHistory,
  fetchOrderOfferTitle,
  fetchOrderPayment,
  fetchOpenOrders,
  fetchOrderPayments,
  fetchOpenPaymentSums,
  fetchOrders,
  fetchOrderFeedback,
  insertPartialPayment,
  recordPayment,
} from '../../lib/api';
import type { OrderStatusEvent, OrderVerdict, PaymentMethod, ReceiptPayment } from '../../lib/api';
/* v5.256.0 — the verdict wears the dashboard's own tone law (one voice,
 * never a fork): the thresholds and words live in lib/verdict. */
import { verdictTone } from '../../lib/verdict';
import { buildReceiptText, printReceipt, type ReceiptOpts } from './ReceiptPrint';
import { preloadPrintImage } from '../../lib/printFrame';
import { formatMoney, getPrefs } from '../../lib/prefs';
/* v5.280.0 — the bill row's rate word is DERIVED now (the rate's one
 * home, lib/tax): "GST (5% · CGST+SGST)" was typed — the day the slab
 * moves, a typed word keeps lying. */
import { gstPercentWord } from '../../lib/tax';
/* v5.280.0 — the bill's balance rides money.ts's round2 (the split's own
 * Math.floor stays: each way rounds DOWN so the parts never overpay — a
 * deliberate judgment, not the rounder's twin). */
import { round2, moneyBare } from '../../lib/money';
import { downloadCsv } from '../../lib/csv';
import { useCopyAck, ackWord } from '../../lib/useCopyAck';
import { appStampLabel, appTodayIso, appFormatters, appTzTag, isSameAppDay, isSameAppDayAs } from '../../lib/appday';
import { useExportFlash } from '../../lib/useExportFlash';
import { CsvExportButton } from '../common/CsvExportButton';
/* v5.238.0 — the chase borrows the window grammar's ONE home (5.236): the
 * custom pair's bounds and its spoken span come from lib/reportWindow —
 * orderedCustom inside, the same swap and the same fallback Reports asks.
 * No inline calendar math in this file, ever.
 * v5.240.0 — the home now answers for EVERY date key (the fixed week
 * included) and speaks the fixed window's own dates (rangeSpanOf). */
import { rangeWindow, rangeLabelOf, rangeSpanOf, shiftDayIso } from '../../lib/reportWindow';
import { useTenant } from '../../lib/tenant';
import { useSession, useUi } from '../../store/session';
/* v5.196.0 — the ghost chip asks the BOARD's own question: isOnRail is THE
 * rail-active set (pending/preparing/ready), exported from the kitchen
 * screen so the dashboard's stuck count and this chip can never fork. */
import { isOnRail } from '../kitchen/KitchenScreen';
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

type StatusFilter = 'all' | 'active' | 'paid' | 'cancelled' | 'stuck';
type DateFilter = 'today' | '7d' | 'custom' | 'all';
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
 *
 * v5.242.0 — exported (the isGhostTicket precedent): the money book's server
 * predicate must speak THE SAME word at any scale, and unit281 pins the
 * agreement over the full (status × payment_status) matrix. A pure function
 * of the pair — no store, no clock, no component tree.
 */
export function displayStatus(o: Pick<Order, 'status' | 'payment_status'>): string {
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

/* ── v5.196.0 — the ghost register ───────────────────────────────────
 * The dashboard's strip counts "older stuck tickets off today's board"
 * and points here — but a ghost (placed on an earlier day, still on the
 * kitchen rail) used to be unnameable on this screen: the trio model
 * shows the PAYMENT word (Active/Paid), so a paid-but-never-bumped
 * ticket read settled, and the pointer died at the door. The ghost chip
 * names them in the dashboard's own word, wearing the service-nudge
 * amber. ONE population with the dashboard (isOnRail && an earlier
 * local day), the rail set imported from the board's own screen —
 * never re-decided here. Both predicates take an explicit clock so the
 * suite owns now (228's rule). */
export function isGhostTicket(
  o: Pick<Order, 'status' | 'created_at'>,
  nowMs: number,
): boolean {
  return isOnRail(String(o.status)) && !isSameAppDayAs(o.created_at, nowMs);
}

/** The chip's words. An unpaid ghost already wears its chase age (the
 * money register, 5.151) right beside — the chip says just "stuck", the
 * kitchen register. A PAID ghost has no age voice anywhere, so the chip
 * carries the age itself: "stuck 2d old". Cancelled never reaches —
 * isOnRail already excludes it. */
export function ghostChipWords(trio: string, createdAt: string, nowMs: number): string {
  if (trio === 'paid') return `stuck ${chaseAge(createdAt, nowMs)}`;
  return 'stuck';
}

const TYPE_LABEL: Record<string, string> = {
  dine_in: 'Dine-in',
  takeaway: 'Takeaway',
  delivery: 'Delivery',
};

/* ── v5.151.0 — the chase list's age voice ────────────────────────────────
 * Moved to src/lib/day.ts (5.185.0) — the day-grammar home — so the
 * dashboard's unpaid card can speak the SAME age without dragging this
 * screen's module graph into another chunk. This file imports it; the
 * register is ONE, wherever it is spoken. */

/* ── v5.151.0 — the chase list speaks in chat ──────────────────────────
 * The share arc's sixth member: the bill (5.145.0), the day (5.146.0),
 * the range (5.147.0), the offer (5.149.0), the shopping list (5.150.0)
 * — and now the money still out, because "5 unpaid · ₹1,801.80" on a
 * screen is a glance, but a chat message is a promise someone reads.
 * One assembly feeds Copy + WhatsApp; amounts are LEDGER truth (total
 * minus paid parts, the split card's own math), never the client's
 * guess; today's unpaid are listed too — money out is money out. Exported
 * pure so E2E can assert the text without touching the clipboard. */
export interface ChaseOpts {
  storeName: string;
  tickets: {
    num: string;
    where: string;
    open: number;
    when: string;
    age: string;
    note: string | null;
  }[];
  total: number;
  /** v5.186.0 — the chase head's own age ('today' | 'Nd old'), the strip's
   *  oldest voice echoed on the paper's count line. Optional — silence
   *  when absent (a head exists whenever tickets do). */
  oldestAge?: string | null;
}

export function buildChaseText(opts: ChaseOpts): string {
  const W = 32;
  const hr = '-'.repeat(W);
  const center = (s: string): string => {
    const t = s.length > W ? `${s.slice(0, W - 1)}…` : s;
    return t.length >= W ? t : ' '.repeat(Math.floor((W - t.length) / 2)) + t;
  };
  const two = (l: string, r: string): string => {
    const cut = Math.max(1, W - r.length - 1);
    const left = l.length > cut ? `${l.slice(0, cut - 1)}…` : l;
    return left.padEnd(W - r.length, ' ') + r;
  };
  /* chase notes are prose — word-wrapped at the detail width so a long
   * "will pay tomorrow" story can't ride past the frame (195 torture). */
  const wrap = (s: string, width = W): string[] => {
    const words = s.split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let cur = '';
    for (const w of words) {
      const t = cur ? `${cur} ${w}` : w;
      if (t.length <= width) {
        cur = t;
        continue;
      }
      if (cur) lines.push(cur);
      cur = w.length > width ? `${w.slice(0, width - 1)}…` : w;
    }
    if (cur) lines.push(cur);
    return lines;
  };

  const out: string[] = [];
  out.push(center(opts.storeName));
  out.push(center('UNPAID · THE CHASE LIST'));
  out.push(hr);
  for (const t of opts.tickets) {
    out.push(two(`${t.num} · ${t.where}`, formatMoney(t.open)));
    const head = `   ${t.when} · ${t.age}`;
    out.push(head.length <= W ? head : `   ${t.when}`);
    if (t.note) for (const line of wrap(t.note, W - 3)) out.push(`   ${line}`);
  }
  out.push(hr);
  out.push(two('TOTAL TO COLLECT', formatMoney(opts.total)));
  /* v5.186.0 — the count line speaks the age the strip speaks: how many ·
   * how old. Silence when the head is absent (no tickets, no age). */
  out.push(
    center(
      opts.oldestAge
        ? `${opts.tickets.length} ticket${opts.tickets.length === 1 ? '' : 's'} · oldest ${opts.oldestAge}`
        : `${opts.tickets.length} ticket${opts.tickets.length === 1 ? '' : 's'}`
    )
  );
  out.push(hr);
  out.push(center(`Shared ${appFormatters().hhmm.format(new Date())} ${appTzTag()}`));
  out.push(center('· · · end of chase list · · ·'));
  return out.join('\n');
}

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

/* 5.203.0 — the ghost answers when called: the 'stuck' filter wears the
 *  ghost chip's own ink and wash (the 5.196 register's colors) — the
 *  dashboard points here with the same word, the pill that filters to the
 *  ghosts wears the ghosts' amber, and the pointer's promise lands
 *  pre-armed. */
const FILTER_PILL_GHOST =
  'h-11 w-full appearance-none rounded-full border border-[#8A5A16] bg-[#FDF3E4] pl-4 pr-9 text-[13px] font-bold text-[#8A5A16] transition hover:border-[#6F4A12] focus:border-[#8A5A16] focus:outline-none focus:ring-2 focus:ring-[#8A5A16]/25';

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

/** v5.189.0 — the accountant's twin, row by row (PURE: the suite reads the
 *  exact table the download button writes — the 227 doorOf pattern).
 *
 *  Two columns join the sheet, and both speak what the SCREEN already
 *  speaks — the CSV/strip/paper pairing discipline (5.184, closed for the
 *  chase in 5.186) now closes its third surface:
 *
 *  • AGE — the per-row chase age ('1d old'), governed by the row chip's
 *    OWN condition (5.151: unpaid AND from an earlier day), byte-for-byte.
 *    Silence elsewhere: today's unpaid are not aged yet, and paid/cancelled
 *    tickets are not debts standing — silence, never a fabricated '0d'.
 *    Sort the sheet by this column and the chase list falls out oldest-
 *    first, the strip's own order.
 *  • OPEN (INR) — the ledger's honest open (total minus paid parts), the
 *    chase strip's per-ticket math. Active speaks what's still out, paid
 *    speaks '0.00' (the debt closed — true, not filler), cancelled stays
 *    silent (it never happened). On the unfiltered export the column
 *    SUMS to the strip's OUT — the accountant can verify the sheet
 *    against the screen with one SUM().
 *
 *  `nowMs` is injected (the suite's clock); every other cell keeps its
 *  existing bytes — the 5.63 partial voice included.
 */
export function billsCsvRows(
  rows: Order[],
  paidSums: Map<string, number>,
  nowMs: number,
): unknown[][] {
  const header = [
    'Order #',
    'Placed at',
    'Status',
    'Age',
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
    'Open (INR)',
    'Notes',
  ];
  const lines: unknown[][] = [header];
  for (const o of rows) {
    const st = STATUS_LABEL[displayStatus(o)] || displayStatus(o);
    const method = o.payment_method ? METHOD_LABEL[o.payment_method as MethodKey] || o.payment_method : '';
    /* v5.63.0: a partially-split ticket says so — the ledger's honest voice,
       not a bare 'pending' that hides money already taken. v5.282.0: the
       cells ride moneyBare — the books' ONE bare paise voice. */
    const partPaid = Number(paidSums.get(o.id) ?? 0);
    const paymentCell =
      String(o.payment_status || '').toLowerCase() === 'completed'
        ? 'completed'
        : partPaid > 0
          ? `partial (${moneyBare(partPaid)} of ${moneyBare(Number(o.total ?? 0))} in)`
          : o.payment_status || 'pending';
    /* v5.189.0 — the age cell: the row chip's own rule (5.151), ONE rule,
       two surfaces. chaseAge is THE register (day.ts). */
    const isActive = displayStatus(o) === 'active';
    /* 5.219.0 — the gate obeys the INJECTED clock (228's own rule): a real-
       clock gate beside an injected chaseAge is two clocks in one cell, and
       at a day boundary they disagreed — an aged cell could say 'today'. */
    const ageCell =
      isActive && !isSameAppDayAs(o.created_at, nowMs) ? chaseAge(o.created_at, nowMs) : '';
    /* v5.189.0 — the open cell: the chase's own math (max(0, total − paid));
       paid reads '0.00' — the debt closed; cancelled reads silence.
       v5.282.0 — the cell rides moneyBare (round2's math, then the pad). */
    const openCell = isActive
      ? moneyBare(Math.max(0, Number(o.total ?? 0) - partPaid))
      : st === 'Paid'
        ? '0.00'
        : '';
    lines.push([
      o.order_number,
      /* v5.274.0 — the cell rides the house's own stamp (appStampLabel):
         the device's bare toLocaleString() could not agree with itself
         across devices — two shapes, two clocks, one file. */
      appStampLabel(o.created_at),
      st,
      ageCell,
      paymentCell,
      method,
      TYPE_LABEL[String(o.order_type)] || String(o.order_type),
      o.customer_name || '',
      o.table_label || '',
      itemsSummary(o),
      /* v5.282.0 — the paise columns ride moneyBare, the ONE bare voice. */
      moneyBare(Number(o.subtotal ?? 0)),
      moneyBare(Number(o.tax_amount ?? 0)),
      moneyBare(Number(o.discount_amount ?? 0)),
      moneyBare(Number(o.total ?? 0)),
      openCell,
      o.notes || '',
    ]);
  }
  return lines;
}

function exportBillsCsv(rows: Order[], paidSums: Map<string, number>): void {
  if (rows.length === 0) return;
  /* v5.106.0 — the filename carries the reporting day (appday): the owner's
     own today, the same word Reports and Close-out speak. The old name was
     hardcoded IST — the wrong-clock family EOD's stepper came from (5.83.0);
     5.84.0 fixed the UTC→IST direction, and now the name also follows the
     owner when the reporting day itself moves. */
  downloadCsv(`servepoint-bills-${appTodayIso()}.csv`, billsCsvRows(rows, paidSums, Date.now()));
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

  /* v5.274.0 — the CSV verb's own ack: the export speaks, then the button
   * says it spoke (the Saved word, the green register) — no second tap
   * born of a silent tray. */
  const [billsSaved, exportBills] = useExportFlash();

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  /* v5.238.0 — Custom joins the chase (the 5.236 law reaching Bills): the
   * pair arms pre-filled with the last 7 days (7 calendar days ending
   * today, today inclusive), so Custom is never an empty or invalid
   * state; the owner adjusts from a truth they can see. The cleared
   * filters chip leaves the pair armed — re-selecting Custom shows the
   * owner's own words, not a reset. */
  const [customFrom, setCustomFrom] = useState<string>(() => shiftDayIso(-6));
  const [customTo, setCustomTo] = useState<string>(() => appTodayIso());
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

  /* ── v5.256.0 — the bill hears the verdict ──────────────────────────────
   * The guest's rating + word ride the order_feedback ledger; the aggregates
   * read it on the dashboard and Reports, but the operator looking at THIS
   * bill never heard THIS guest. ONE row per order (UNIQUE(order_id)), read
   * fail-soft the moment the selection moves — a hiccup or an unrated ticket
   * both honestly render as no row, never an error banner. */
  const [verdict, setVerdict] = useState<OrderVerdict | null>(null);
  useEffect(() => {
    setVerdict(null); // honest absence until the read lands
    if (!selectedId) return;
    let live = true;
    fetchOrderFeedback(selectedId)
      .then((v) => {
        if (live) setVerdict(v);
      })
      .catch(() => {
        if (live) setVerdict(null);
      });
    return () => {
      live = false;
    };
  }, [selectedId]);

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

  /* ── v5.242.0 — the money book: the WHOLE book's open tickets, uncapped
   * (fetchOpenOrders), so the census chip, the chase strip and the list speak
   * the DB's truth even after an unpaid ticket slides past the newest-100
   * browsing window. null = the read failed (fail-soft: the room falls back
   * to the loaded page's own count — what it can see, honestly scoped). */
  const [moneyBook, setMoneyBook] = useState<Order[] | null>(null);

  /* ── v5.242.0 — the whole book: loaded page ∪ money book, loaded wins
   * collisions (its rows carry the in-session patches). The money book is a
   * SUPERSET of the loaded page's unpaid rows by construction (the same
   * trio, server-side, uncapped), so the merge only ever APPENDS rows the
   * browsing window dropped — the list, the census chip, the chase strip
   * and the CSV all read this one base. */
  const book = useMemo(() => {
    if (!moneyBook || moneyBook.length === 0) return orders;
    const seen = new Set(orders.map((o) => o.id));
    const past = moneyBook.filter((m) => !seen.has(m.id));
    if (past.length === 0) return orders;
    return [...orders, ...past];
  }, [orders, moneyBook]);

  /** v5.242.0 — how many open bills the money book holds that the browsing
   * window dropped. Zero most days; when it grows, the census says so. */
  const moneyOnlyCount = useMemo(() => {
    if (!moneyBook) return 0;
    const ids = new Set(orders.map((o) => o.id));
    return moneyBook.filter((m) => !ids.has(m.id)).length;
  }, [orders, moneyBook]);

  /** Mirror of the orders list for mutation callbacks (fresh totals). */
  const ordersRef = useRef<Order[]>([]);
  useEffect(() => {
    ordersRef.current = book;
  }, [book]);

  /** v5.44.0: a door that arrived with context consumes its hint ONCE —
   *  'unpaid' → land on the money still out (statusFilter 'active'), not
   *  the every-thing list. Consumed on mount, never persists. The hint is
   *  snapshotted once (useState lazy init) so the breadcrumb effect below
   *  can honor the door's origin too. */
  const [doorHint] = useState(() => useUi.getState().sectionHint);
  useEffect(() => {
    const hint = consumeSectionHint();
    if (hint === 'unpaid') setStatusFilter('active');
    /* 5.203.0 — the kitchen-ghost door's hint: 'stuck' lands on the ghost
     * view itself (isGhostTicket — the ONE population the strip counted),
     * the same word the strip and the chips speak. */
    if (hint === 'stuck') setStatusFilter('stuck');
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
      /* v5.242.0 — the whole book rides the same load: the money book read
         (uncapped, the trio's unpaid server-side) feeds the census, and its
         own ledger-sum read replaces the loaded-page one so every balance —
         including tickets past the browsing window — is split-aware. The
         fallback stays the bounded sums above; a failed book read dims to
         the loaded page's own count, never to a lie. */
      fetchOpenOrders(tenantId)
        .then((mb) => {
          setMoneyBook(mb);
          return fetchOpenPaymentSums(
            tenantId,
            mb.filter((o) => displayStatus(o) === 'active').map((o) => o.id),
          );
        })
        .then((m) => setPaidSums(m))
        .catch(() => setMoneyBook(null));
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
    return orders.filter((o) => {
      /* 5.203.0 — 'stuck' is its own view, not a trio value: a ghost is
       * paid OR unpaid (the dashboard's mixed ghost set), so the predicate
       * — not displayStatus — decides. The same isGhostTicket the row
       * chips and the dashboard's staleKitchen speak: one population, no
       * fork to close (5.196's pointer now has a view of its own). */
      if (statusFilter === 'stuck') {
        if (!isGhostTicket(o, Date.now())) return false;
      } else if (statusFilter !== 'all' && displayStatus(o) !== statusFilter) return false;
      /* v5.240.0 — the whole chase asks ONE window builder: Today, the
       * 7-day week, the owner's custom pair — every bounded key rides
       * lib/reportWindow's rangeWindow, the home the Close-out, Reports
       * and the movers' week already ask. The rolling week-long second
       * clock — the file's last (its fossil carried since the 5.238
       * walk, classified in 5.239's round) — is EXTINCT: "Last 7 days"
       * now means the same 7 calendar days ending today, today inclusive,
       * that Reports' KPIs and the armed Custom row mean — midnight to
       * midnight on the app-day clock, not a stride back from the
       * moment. The today key rides the same builder: lastNDaysMs(1)'s
       * bounds ARE the app-day clock 5.239 taught this filter
       * (isSameAppDay's verdict, through the ONE door). The customs laws
       * hold inside the lib — a reversed pair is swapped by
       * orderedCustom, a malformed pair falls back to the last 7 days
       * (the inputs arm pre-filled and can never empty). The null guard
       * is structural: every bounded path resolves a real start; 'all'
       * keeps its no-bounds silence before this ask — the ledger's whole
       * truth has no window to consult. */
      if (dateFilter !== 'all') {
        const { startMs, endMs } = rangeWindow(dateFilter, { from: customFrom, to: customTo });
        const t = new Date(o.created_at).getTime();
        if (startMs !== null && (t < startMs || t > endMs)) return false;
      }
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
  }, [book, statusFilter, dateFilter, search, customFrom, customTo]);

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

  /* Money outstanding across the WHOLE book (v5.242.0 — not the loaded page,
     not filter-dependent) — the "you still owe / are owed" signal for the
     counter. */
  const unpaidCount = useMemo(
    () => book.filter((o) => displayStatus(o) === 'active').length,
    [book]
  );

  /* 5.92.0 — the count chip echoes the strip's whisper: how many of the
     unpaid are from an earlier day (the ghosts the strip points at when it
     says "N older tickets — see Bills"). The door opens both ways. */
  const olderUnpaidCount = useMemo(
    () =>
      book.filter(
        (o) => displayStatus(o) === 'active' && !isSameAppDay(o.created_at)
      ).length,
    [book]
  );

  /* ── v5.151.0 — the chase set: every unpaid ticket, oldest first, with
   * LEDGER-open amounts (total minus paid parts) and the honest age. One
   * assembly feeds the strip's Copy + WhatsApp. */
  const chaseTickets = useMemo(
    () =>
      book
        .filter((o) => displayStatus(o) === 'active')
        .slice()
        .sort((a, b) => a.created_at.localeCompare(b.created_at))
        .map((o) => {
          const paid = Number(paidSums.get(o.id) ?? 0);
          const open = Math.max(0, Number(o.total ?? 0) - paid);
          const notes: string[] = [];
          if (Number(o.discount_amount ?? 0) > 0)
            notes.push(`−${formatMoney(Number(o.discount_amount))} off`);
          if (paid > 0) notes.push(`${formatMoney(paid)} in`);
          return {
            num: `#${o.order_number}`,
            where: o.table_label || TYPE_LABEL[String(o.order_type)] || 'counter',
            open,
            when: dayTime(o.created_at),
            age: chaseAge(o.created_at, Date.now()),
            note: notes.length > 0 ? notes.join(' · ') : null,
          };
        }),
    [book, paidSums]
  );
  const chaseTotal = useMemo(() => chaseTickets.reduce((s, t) => s + t.open, 0), [chaseTickets]);
  /* ── v5.186.0 — the strip knows the age: the chase list runs oldest first,
   * so the head IS the oldest — no second sort, no second writer. The title
   * speaks the dashboard mirror's EXACT sentence (5.185's ageVoice) — ONE
   * register, two surfaces. ── */
  const chaseOldest = chaseTickets[0] ?? null;
  const chaseAgeTitle = chaseOldest
    ? `oldest ${chaseOldest.num} owes ${formatMoney(chaseOldest.open)}, ${chaseOldest.age}`
    : null;
  /* v5.277.0 — the ack rides the one home (lib/useCopyAck). */
  const [chaseCopyState, runChaseCopy] = useCopyAck();
  const copyChase = () =>
    runChaseCopy(
      buildChaseText({
        storeName: tenant?.name || 'ServePoint store',
        tickets: chaseTickets,
        total: chaseTotal,
        oldestAge: chaseOldest?.age ?? null,
      }),
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

  /* ── v5.145.0 — the bill's chat voice ─────────────────────────────────
   * ONE opts assembly feeds the thermal print AND the share row (Copy /
   * WhatsApp), so every surface says the same numbers from the same stored
   * columns — the money-doctrine, now three surfaces wide. Copy feedback is
   * inline (the app keeps no toast system): the button flips to "Copied"
   * for a breath, or honestly says "Copy blocked" when the clipboard is
   * unavailable (insecure context / permission denial). */
  /* v5.277.0 — the ack rides the one home (lib/useCopyAck). */
  const [billCopyState, runBillCopy] = useCopyAck();
  const receiptOpts = (): ReceiptOpts | null => {
    if (!selected) return null;
    return {
      storeName: tenant?.name || 'ServePoint store',
      // Task 90 — the legal identity rides the paper: GSTIN turns the
      // printout into a TAX INVOICE, FSSAI is the food licence the law
      // wants shown. Absent → the pre-5.51 receipt, byte for byte.
      legalName: tenant?.legal_name || null,
      gstNumber: tenant?.gst_number || null,
      fssaiNumber: tenant?.fssai_number || null,
      address: tenant?.address || null,
      phone: tenant?.owner_phone || null,
      orderNumber: selected.order_number,
      orderType: String(selected.order_type || ''),
      tableLabel: selected.table_label,
      customerName: selected.customer_name,
      orderNote: selected.notes, // v5.255.0 — the word on paper (print / copy / WhatsApp share all speak it)
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
      logoUrl: tenant?.logo_url || null,
    };
  };
  const copyBillText = () => {
    const opts = receiptOpts();
    if (!opts) return;
    runBillCopy(buildReceiptText(opts));
  };

  /* ── Split math (5.63.0) — paise-exact, ledger-derived ──────────────────
   * paidSum / balance come from the LEDGER (server truth), never from a
   * client-side guess. nextPartAmount rounds DOWN so the covering part
   * absorbs the cents and the parts sum to exactly the total. */
  const selectedTotal = Number(selected?.total ?? 0);
  const paidSum = useMemo(() => ledger.reduce((s, r) => s + Number(r.amount || 0), 0), [ledger]);
  const balance = Math.max(0, round2(selectedTotal - paidSum));
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
        /* v5.242.0 — the money book follows the ledger in-session: a settled
           or cancelled ticket LEAVES the census (a kept book would count
           money that just landed); a split part stays, its balance rides
           paidSums. The census never waits for the next load to be true. */
        setMoneyBook((prev) => {
          if (!prev) return prev;
          if (kind === 'cancel' || (kind === 'pay' && coveredNow)) {
            return prev.filter((o) => o.id !== orderId);
          }
          return prev.map((o) =>
            o.id === orderId
              ? ({
                  ...o,
                  ...patch,
                  payment_status: kind === 'pay' ? (coveredNow ? 'completed' : 'pending') : patch.payment_status,
                } as Order)
              : o
          );
        });
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
        /* v5.242.0 — the kitchen lifecycle never settles money: the ticket
           stays in the census, its row keeps pace with the board. */
        setMoneyBook((prev) =>
          prev ? prev.map((o) => (o.id === orderId ? ({ ...o, status: toStatus } as Order) : o)) : prev
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
          : statusFilter === 'stuck'
            ? 'stuck'
            : '';
  /* v5.240.0 — the fixed week speaks its dates: the span the 7d window
   * actually holds, through THE span builder on THE pair the window builds
   * (shiftDayIso(-6)…today — the same pair the Custom row arms pre-filled,
   * so the fixed key and the owner's own default Custom say the same
   * window in the same words). The 5.238 label law reaching the fixed
   * keys — never a bare chip word standing in for dates nobody can
   * verify; the rolling-vs-calendar fossil was exactly that lie. */
  const weekSpan = rangeSpanOf('7d');
  const windowPhrase =
    dateFilter === 'today'
      ? 'from today'
      : dateFilter === '7d'
        ? /* 5.240.0 — the dates the window holds, not the chip word (the
           * 5.238 law, the fixed-key edition): the miss sentence and the
           * hint row say the same span the predicate enforces. */
          `from ${weekSpan}`
        : dateFilter === 'custom'
          ? /* 5.238.0 — the span speaks the DATES the owner chose, never
             * the bare chip word "Custom" standing in for dates nobody
             * can verify (the 5.236 law reaching the chase's miss). */
            `from ${rangeLabelOf('custom', { from: customFrom, to: customTo })}`
          : '';
  const customSpan = rangeLabelOf('custom', { from: customFrom, to: customTo });
  const filterLabels = [
    statusFilter !== 'all' ? statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1) : '',
    dateFilter === 'today'
      ? 'Today'
      : dateFilter === '7d'
        ? /* 5.240.0 — the chip word carries its dates (the Custom pattern,
           * fixed-key edition): "Last 7 days (29 Sept – 5 Oct)". */
        `Last 7 days (${weekSpan})`
        : dateFilter === 'custom' ? `Custom (${customSpan})` : '',
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
  ) : statusWord === 'stuck' && dateFilter === 'today' ? (
    /* 5.203.0 — the impossible combo says why: a ghost is older-day by
     * definition (isGhostTicket's own rule), so Stuck ∧ Today is empty
     * BEFORE the ledger is consulted — the sentence teaches the
     * definition instead of counting an empty list. */
    <>Stuck tickets are, by definition, from an earlier day — none can be from today. Widen the window, or clear the filters.</>
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
                  (olderUnpaidCount > 0
                    ? `${unpaidCount} awaiting payment — ${olderUnpaidCount} from an earlier day`
                    : 'Bills awaiting payment in the loaded list') +
                  (moneyOnlyCount > 0
                    ? ` — the whole book is counted (${moneyOnlyCount} past the loaded page)`
                    : '')
                }
                className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#FFF4DB] px-2.5 py-1 text-[11px] font-extrabold tabular-nums text-[#8A5A00]"
              >
                <Receipt size={11} aria-hidden />
                {/* ONE text flex item (the icon is the other): the text flow
                    keeps the real spaces "8 unpaid · 5 older" — the a11y-glue
                    law never gets a fork; the amber rides a nested inline
                    span, never a second flex item. */}
                <span>
                  {unpaidCount} unpaid
                  {olderUnpaidCount > 0 && (
                    <>
                      {' · '}
                      {/* v5.242.0 — the older segment wears its own ink: the
                          chase amber family the book's service voices use. */}
                      <span className="text-[#B45309]">{olderUnpaidCount} older</span>
                    </>
                  )}
                </span>
              </span>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {/* v5.274.0 — the verb's own ack: after the export the button
                wears the paid chip's green register (#2E7D32 on its ghost
                #E8F5EC) and speaks "Saved" with the Check ear for a breath,
                then returns — the file landed, and the button said so. The
                aria flips with the word so a screen reader hears it too.
                v5.275.0 — the grammar moved into the ONE component
                (CsvExportButton); this verb rides it like every other
                export verb in the house — same register, same word. */}
            <CsvExportButton
              saved={billsSaved}
              onExport={() => exportBills(() => exportBillsCsv(sorted, paidSums))}
              disabled={sorted.length === 0}
              idleAria="Export filtered bills as CSV — chase ages and open money included"
              savedAria="Bills exported — the CSV file is saved"
              title="Export the filtered list as CSV (opens in Excel / Sheets) — every unpaid ticket's age rides the Age column, and Open (INR) sums to the strip's out"
              geometry="flex h-11 items-center gap-1.5 rounded-xl border px-3 text-[12.5px] font-bold"
              earSize={15}
            />
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

        {/* ── v5.151.0 — the chase strip: the money still out, ready to ride
            in a chat. The cream chip names the amount (the gold family's
            voice), Copy + WhatsApp speak the per-ticket truth from ONE
            assembly. Hidden honestly when nothing is out. ── */}
        {chaseTickets.length > 0 && (
          <div
            className="mt-3 flex flex-wrap items-center gap-2"
            role="group"
            aria-label={`Share the chase list — ${formatMoney(chaseTotal)} out, ${chaseTickets.length} unpaid${chaseAgeTitle ? `, ${chaseAgeTitle}` : ''}`}
          >
            <span className="inline-flex h-[34px] items-center rounded-xl bg-[#FDF6E3] px-3 text-[10.5px] font-bold uppercase tracking-[0.08em] text-[#8A5A00]">
              {formatMoney(chaseTotal)} out · {chaseTickets.length} unpaid
            </span>
            {/* v5.186.0 — the age voice joins the strip: how much · how many ·
                how old. The quiet chip (the alarm tones stay on the per-row
                age chips); the title carries the mirror's exact sentence. ── */}
            <span
              className="inline-flex h-[34px] items-center gap-1.5 rounded-xl border border-[#E3E7E0] bg-white px-3 text-[12px] font-semibold tabular-nums text-[#5B6B66]"
              title={chaseAgeTitle ?? undefined}
            >
              <Clock size={14} aria-hidden className="shrink-0 text-[#8A5A00]" />
              oldest {chaseTickets[0].age}
            </span>
            <button
              onClick={copyChase}
              aria-live="polite"
              aria-label="Copy the chase list as text"
              className="flex h-[34px] items-center gap-1.5 rounded-xl border border-[#E3E7E0] bg-white px-3 text-[12px] font-semibold text-[#0F3D3E] transition hover:border-[#0F3D3E]/40 hover:bg-[#F6F5F2] active:scale-[0.99]"
            >
              {chaseCopyState === 'ok' ? (
                <Check size={14} className="text-[#2E7D32]" aria-hidden />
              ) : chaseCopyState === 'fail' ? (
                <AlertTriangle size={14} className="text-[#8A5A00]" aria-hidden />
              ) : (
                <Copy size={14} aria-hidden />
              )}
              {ackWord(chaseCopyState, 'Copy')}
            </button>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(
                buildChaseText({
                  storeName: tenant?.name || 'ServePoint store',
                  tickets: chaseTickets,
                  total: chaseTotal,
                  oldestAge: chaseOldest?.age ?? null,
                })
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Share the chase list on WhatsApp"
              className="flex h-[34px] items-center gap-1.5 rounded-xl border border-[#E3E7E0] bg-white px-3 text-[12px] font-semibold text-[#0F3D3E] transition hover:border-[#0F3D3E]/40 hover:bg-[#F6F5F2] active:scale-[0.99]"
            >
              <MessageCircle size={14} aria-hidden />
              WhatsApp
            </a>
          </div>
        )}

        {/* v5.242.0 — the census's own honesty row: when the money book holds
            open bills the browsing window dropped, the room says so — the
            chip counts the whole book, the strip carries them, the list below
            is the loaded page. One text flow (the a11y-glue law), the span
            ink the quiet voices wear. */}
        {moneyBook && moneyOnlyCount > 0 && (
          <p className="mt-2 text-[11.5px] leading-snug text-[#8A938C]">
            {`The census reads the whole book — ${moneyOnlyCount} open ${moneyOnlyCount === 1 ? 'bill' : 'bills'} ${moneyOnlyCount === 1 ? 'sits' : 'sit'} past the loaded page below, counted in the chip and carried by the chase copy.`}
          </p>
        )}

        <div className="mt-3 flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <select
              aria-label="Filter bills by status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className={
                statusFilter === 'stuck'
                  ? FILTER_PILL_GHOST
                  : statusFilter !== 'all'
                    ? FILTER_PILL_ACTIVE
                    : WHITE_PILL
              }
            >
              <option value="all">All Orders</option>
              <option value="active">Active</option>
              <option value="paid">Paid</option>
              <option value="cancelled">Cancelled</option>
              <option value="stuck">Stuck</option>
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
              <option value="custom">Custom</option>
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

        {/* v5.238.0 — the chase's calendar row, revealed only while Custom
         * stands (the 5.236 pattern reaching Bills): both inputs max at
         * today (the future has no ledger), wearing the house date-box ink
         * (sp-input, gold focus ring #967221) — one ink for every date box
         * in the app. The hint speaks the span live and, when the pair was
         * typed reversed, says so — the window reads it the honest way
         * (orderedCustom, inside rangeWindow); the owner is never left
         * guessing which end became which. */}
        {dateFilter === 'custom' ? (
          <div className="flex flex-wrap items-center gap-2 pt-2" role="group" aria-label="Custom chase range">
            <label className="flex items-center gap-1.5 text-[11.5px] font-semibold text-[#6B6B6B]">
              From
              <input
                type="date"
                value={customFrom}
                max={appTodayIso()}
                onChange={(e) => setCustomFrom(e.target.value || customFrom)}
                aria-label="Custom chase start date"
                className="sp-input h-9 rounded-xl border border-[#E3E7E0] bg-white px-2.5 text-[12.5px] font-semibold text-[#1A1A1A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#967221]"
              />
            </label>
            <label className="flex items-center gap-1.5 text-[11.5px] font-semibold text-[#6B6B6B]">
              To
              <input
                type="date"
                value={customTo}
                max={appTodayIso()}
                onChange={(e) => setCustomTo(e.target.value || customTo)}
                aria-label="Custom chase end date"
                className="sp-input h-9 rounded-xl border border-[#E3E7E0] bg-white px-2.5 text-[12.5px] font-semibold text-[#1A1A1A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#967221]"
              />
            </label>
            <span className="text-[11.5px] font-semibold text-[#8A938C]">
              Showing {customSpan}
              {customFrom > customTo ? ' — the dates were swapped, the chase read them the honest way' : ''}
            </span>
          </div>
        ) : null}

        {dateFilter === '7d' ? (
          /* v5.240.0 — the fixed week earns the same honesty row the
           * Custom pair earned (5.238): while the window stands, the row
           * says WHICH dates it holds — the span phrase, in the span
           * voice's own ink (#8A938C) — plus the window's shape, so the
           * owner learns the week is the calendar's (midnight to midnight,
           * today included), not 168 hours back from the moment. ONE text
           * flow — the a11y-glue law (5.237) never gets a fork to glue. */
          <p className="pt-2 text-[11.5px] font-semibold text-[#8A938C]">
            Showing {weekSpan} · the last 7 calendar days, today included — midnight to midnight, not 168 hours back
          </p>
        ) : null}

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
                      }${formatMoney(o.total)}${
                        isGhostTicket(o, Date.now()) ? ', stuck off the kitchen rail' : ''
                      }`}
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
                            {/* v5.151.0 — the age voice: "older ticket" became
                                an honest age ("1d old"), amber under 48h,
                                red beyond — the chase priority reads at a
                                glance now. */}
                            {status === 'active' && !isSameAppDay(o.created_at) && (
                              <span
                                title={`From an earlier day — still awaiting payment (${chaseAge(o.created_at, Date.now())})`}
                                className={`inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-px text-[10px] font-bold ${
                                  (Date.now() - new Date(o.created_at).getTime()) / 36e5 >= 48
                                    ? 'bg-[#FCEBEA] text-[#B3261E]'
                                    : 'bg-[#FFF4DB] text-[#8A5A00]'
                                }`}
                              >
                                <History size={10} aria-hidden />
                                {chaseAge(o.created_at, Date.now())}
                              </span>
                            )}
                            {/* v5.196.0 — the ghost chip: placed on an earlier day,
                                still on the kitchen rail. The dashboard's stuck
                                count points HERE — the chip is the name it was
                                pointing at. Paid ghosts carry their own age
                                (nothing else on the row speaks it); unpaid ghosts
                                let the chase chip beside say the age. */}
                            {isGhostTicket(o, Date.now()) && (
                              <span
                                title={`Placed ${dayTime(o.created_at)} and still ${String(o.status).replace('_', ' ')} on the kitchen rail — today's board holds today only, so it waits here named.`}
                                className="inline-flex shrink-0 items-center gap-1 rounded bg-[#FDF3E4] px-1.5 py-px text-[10px] font-bold text-[#8A5A16]"
                              >
                                <History size={10} aria-hidden />
                                {ghostChipWords(status, o.created_at, Date.now())}
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
              {!isSameAppDay(selected.created_at) && (
                <p className="mt-1.5 flex items-center gap-1.5 text-[12px] font-medium text-[#8A5A00]">
                  <History size={12} aria-hidden />
                  {dayTime(selected.created_at)} — from an earlier day
                </p>
              )}

              {/* v5.196.0 — the pane names the ghost too: the row chip scans;
                  this line SPEAKS the whole story (rail state + the absence
                  the board cannot show). */}
              {isGhostTicket(selected, Date.now()) && (
                <p className="mt-1 flex items-center gap-1.5 text-[12px] font-semibold text-[#8A5A16]">
                  <History size={12} aria-hidden />
                  Still {String(selected.status).replace('_', ' ')} on the kitchen rail — stuck off today's board.
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
                    {/* v5.282.0 — the drawer's line money holds still (tabular-nums)
                        and its fallback math rides round2 (a unit × qty product
                        can carry float dust; paise-true before it speaks). */}
                    <span className="shrink-0 text-[13px] font-semibold tabular-nums text-[#1A1A1A]">
                      {formatMoney(it.item_total ?? round2(it.unit_price * it.qty))}
                    </span>
                  </div>
                ))}
                {(selected.items || []).length === 0 && (
                  <p className="py-3 text-[12.5px] text-[#969696]">
                    No item lines recorded for this order.
                  </p>
                )}
              </div>

              {/* v5.255.0 — the word on the counter's screen: the order-level
                  note the ticket has spoken since 5.254, now where the counter
                  reads the bill too. The ticket's own amber family (the
                  straggler ink), gated on a non-blank word. */}
              {selected.notes && selected.notes.trim().length > 0 && (
                <div className="mt-3 rounded-xl border border-[#F0E4C8] border-l-4 border-l-[#B45309] bg-[#FBF6EA] px-3 py-2.5">
                  <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8A5A00]">
                    <StickyNote size={11} aria-hidden /> Kitchen note
                  </p>
                  <p className="mt-1 break-words text-[12.5px] leading-relaxed text-[#6B4A0E]">
                    {selected.notes}
                  </p>
                </div>
              )}

              {/* v5.256.0 — the bill hears the verdict: the guest's stars and
                  word join the counter's detail panel, right after the kitchen
                  note (the words-family seat order). The gold family — the
                  dashboard's guest-love ink — and the dashboard's own tone
                  law (verdictTone) speak the health word. The comment renders
                  VERBATIM, break-words, never a cut word (the 294 law);
                  absent or failed read → no row, honestly. */}
              {verdict && (
                <div className="mt-3 rounded-xl border border-[#E9DFC8] border-l-4 border-l-[#B88E2F] bg-[#FBF9F1] px-3 py-2.5">
                  <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8A5A16]">
                    <Star size={11} aria-hidden /> Guest verdict
                  </p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <span className="flex items-center gap-1" role="img" aria-label={`Rated ${verdict.rating} of 5 stars`}>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <Star
                          key={n}
                          size={13}
                          fill={n <= verdict.rating ? '#B88E2F' : 'transparent'}
                          stroke={n <= verdict.rating ? '#B88E2F' : '#C9CFC9'}
                          strokeWidth={1.6}
                          aria-hidden
                        />
                      ))}
                    </span>
                    <span className="text-[12px] font-semibold text-[#1A1A1A] tabular-nums">{verdict.rating}/5</span>
                    <span
                      className="rounded-full px-2 py-0.5 text-[10.5px] font-extrabold"
                      style={{ color: verdictTone(verdict.rating).color, backgroundColor: verdictTone(verdict.rating).bg }}
                    >
                      {verdictTone(verdict.rating).word}
                    </span>
                  </div>
                  {verdict.comment && verdict.comment.trim().length > 0 && (
                    <p className="mt-1.5 break-words text-[12.5px] italic leading-relaxed text-[#6B5A2E]">
                      “{verdict.comment.trim()}”
                    </p>
                  )}
                  {selected.customer_name && (
                    <p className="mt-1 text-[10.5px] font-semibold text-[#969696]">
                      — {selected.customer_name}
                    </p>
                  )}
                </div>
              )}

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
                    {/* v5.189.0 — the state rides beside the next step: the
                        counter sees WHERE the ticket stands without reading
                        the Timeline below — same dot + label that trail
                        speaks, ONE voice (on a PAID ticket a gold Active chip
                        is the stuck-state signal itself). */}
                    {(() => {
                      const ds = displayStatus({ status: raw, payment_status: '' });
                      return (
                        <span
                          className="inline-flex h-[26px] items-center gap-1.5 rounded-full border border-[#E3E7E0] bg-white px-2.5 text-[11.5px] font-semibold text-[#1A1A1A]"
                          aria-label={`Kitchen status: ${STATUS_LABEL[ds] || raw || 'unknown'}`}
                          title="Kitchen status — the trail below tells how it got here"
                        >
                          <span
                            className="h-1.5 w-1.5 shrink-0 rounded-full"
                            style={{ backgroundColor: STATUS_DOT[ds] || '#969696' }}
                            aria-hidden
                          />
                          {STATUS_LABEL[ds] || raw || '—'}
                        </span>
                      );
                    })()}
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
                    <span>GST ({gstPercentWord()} · CGST+SGST)</span>
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

              {/* Customer receipt (Task 49) — thermal 80mm print for any live ticket.
                  v5.145.0 — the bill's chat voice: the SAME opts now feed the
                  thermal print AND the share row (Copy / WhatsApp), so the
                  paper and the chat can never disagree about the money. The
                  wa.me grammar follows help.md's long-standing promise: with
                  a guest phone the link opens the DIRECT chat; without one,
                  WhatsApp's own share picker. India-first: a bare 10-digit
                  number assumes +91 (the house's ₹/GST/IST frame); longer
                  digit strings pass through as dialed. */}
              {displayStatus(selected) !== 'cancelled' &&
                (() => {
                  const opts = receiptOpts();
                  if (!opts) return null;
                  const rawDigits = (selected.customer_phone || '').replace(/\D/g, '');
                  const waNumber =
                    rawDigits.length === 10 ? `91${rawDigits}` : rawDigits.length > 10 ? rawDigits : '';
                  const waHref = `https://wa.me/${waNumber}?text=${encodeURIComponent(buildReceiptText(opts))}`;
                  return (
                    <>
                      <button
                        onClick={async () => {
                          // v5.29.0 — the café's face rides the paper receipt too.
                          // Warm the remote logo BEFORE the iframe prints (print()
                          // won't wait for a cold image); dead/absent logo → the
                          // pre-5.29 text-only header, never a hole.
                          if (opts.logoUrl) await preloadPrintImage(opts.logoUrl);
                          printReceipt(opts);
                        }}
                        className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#B88E2F]/45 bg-[#FDF9F0] text-[12.5px] font-semibold text-[#8A6A20] transition hover:border-[#B88E2F] hover:bg-[#F8EFDB] active:scale-[0.99]"
                      >
                        <Receipt size={15} aria-hidden />
                        Print receipt
                      </button>
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <button
                          onClick={copyBillText}
                          aria-live="polite"
                          className="flex h-11 items-center justify-center gap-1.5 rounded-xl border border-[#E3E7E0] bg-white text-[12.5px] font-semibold text-[#0F3D3E] transition hover:border-[#0F3D3E]/40 hover:bg-[#F6F5F2] active:scale-[0.99]"
                        >
                          {billCopyState === 'ok' ? (
                            <Check size={15} className="text-[#2E7D32]" aria-hidden />
                          ) : billCopyState === 'fail' ? (
                            <AlertTriangle size={15} className="text-[#8A5A00]" aria-hidden />
                          ) : (
                            <Copy size={15} aria-hidden />
                          )}
                          {ackWord(billCopyState, 'Copy bill')}
                        </button>
                        <a
                          href={waHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex h-11 items-center justify-center gap-1.5 rounded-xl border border-[#E3E7E0] bg-white text-[12.5px] font-semibold text-[#0F3D3E] transition hover:border-[#0F3D3E]/40 hover:bg-[#F6F5F2] active:scale-[0.99]"
                        >
                          <MessageCircle size={15} aria-hidden />
                          WhatsApp
                        </a>
                      </div>
                    </>
                  );
                })()}
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
