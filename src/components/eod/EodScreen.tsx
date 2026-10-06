import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Armchair,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Clock,
  Coins,
  Copy,
  Flame,
  HandCoins,
  History,
  LockKeyhole,
  MessageCircle,
  MoonStar,
  Printer,
  RefreshCw,
  Split,
  Tag,
  Trash2,
  TrendingDown,
  Wallet,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import {
  closeDrawerSession,
  fetchActiveDrawerSession,
  fetchCashInSince,
  fetchDaySections,
  fetchDrawerHistory,
  fetchDrawerMovements,
  fetchOrderCogs,
  fetchReservations,
  fetchWasteMoves,
  openDrawerSession,
  recordDrawerMovement,
  type DaySectionRow,
  type DrawerMovement,
  type DrawerSession,
  type Reservation,
  type WasteMove,
} from '../../lib/api';
import { formatMoney, subscribePrefs } from '../../lib/prefs';
/* v5.279.0 — the mirror rides the ONE constant: lib/age's AGE_SLA_MIN is
 * the house's 10-minute attention line (the kitchen board's amber, Reports'
 * breach count, the counter's red line). The local name stays — this strip
 * speaks "Late prep", the KDS's own shout — but the number has one home. */
import { AGE_SLA_MIN } from '../../lib/age';
/* v5.280.0 — the drawer's open/close floats ride money.ts's round2. */
/* v5.282.0 — the close-out day book rides moneyBare: the ledger's money
 * cells spoke NO shape at all before (raw Number() — a float-dust total
 * could walk straight into the owner's books); now the ONE bare paise
 * voice speaks them, round2-true, always two decimals. */
import { round2, moneyBare } from '../../lib/money';
import { guestVoice } from '../../lib/verdict';
import {
  appTimezone,
  appTodayIso,
  appDayStartMs,
  appDayBoundsIso,
  appFormatters,
  appTzTag,
} from '../../lib/appday';
import { daySpan, dayTime } from '../../lib/day';
import { isOnRail } from '../kitchen/KitchenScreen';
import { printHiddenFrame } from '../../lib/printFrame';
import { downloadCsv } from '../../lib/csv';
import { useCopyAck, ackWord } from '../../lib/useCopyAck';
import { useExportFlash } from '../../lib/useExportFlash';
import { CsvExportButton } from '../common/CsvExportButton';
import { useDialogA11y } from '../../lib/useDialogA11y';
import { useTenant } from '../../lib/tenant';
import { useSession, useUi } from '../../store/session';
import { DoorChip as LiveDoorChip } from '../shell/DoorChip';

/**
 * EOD Close-out (NOVA §4.3 — EOD reconciliation, /reconcile in the spec).
 *
 * Day stepper (the Settings reporting day — Asia/Kolkata by default) →
 * day summary (orders, gross,
 * paid, unpaid, average ticket) → cost & margin (ingredient cost the shelf
 * burned for the day's tickets, v_order_cogs view from migration 018; gross
 * margin on PAID tickets) → payment mix (cash / UPI / card from the payments
 * ledger) → section mix (v5.21.0: per-category item totals — Coffee / Bakery /
 * Food — mirrored as a SECTIONS block on the printed z-report; unlisted lines
 * bucket honestly) → a compact one-line-per-ticket ledger → and a printable
 * z-report (receipt-style strip, hidden-iframe print — popup blockers can't
 * eat it).
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

/* ────────────────────────── IST day-window helpers ───────────────────
   5.97.0 — the Settings word ("Timestamps in reports and shifts") is
   kept: the math lives in src/lib/appday.ts and follows prefs.timezone.
   The historic IST names stay for the ledger's readability; on every
   Indian device these helpers are exactly IST, unchanged to the paisa. */

/** YYYY-MM-DD of "now" in the reporting timezone (en-CA calendar order). */
function istTodayIso(): string {
  return appTodayIso();
}

/** [00:00, next 00:00) window for a reporting-calendar day. */
function istDayBounds(dateIso: string): { startIso: string; endIso: string } {
  return appDayBoundsIso(dateIso);
}

function shiftDay(dateIso: string, days: number): string {
  /* v5.83.0 — day arithmetic, fixed. The old anchor (midnight IST =
     18:30Z on the PREVIOUS UTC date) shifted the UTC date of the wrong
     instant: from 3 Oct, Previous day derived 2026-10-01T18:30Z whose UTC
     date is still the 1st → the stepper double-jumped 3→1, and Next day
     from 1 Oct was a NO-OP (round 118's "automation double-click" was this
     bug, not the tool). Anchoring at NOON keeps ±1 UTC day safely inside
     the neighbouring calendar date — a pure date-STRING shift, so it is
     timezone-agnostic. */
  const d = new Date(`${dateIso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function prettyDay(dateIso: string): string {
  const d = new Date(appDayStartMs(dateIso));
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: appTimezone(),
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

/** HH:MM in the reporting timezone for a stored timestamptz. */
function istTime(iso: string): string {
  return appFormatters().hhmm.format(new Date(iso));
}

/* ── v5.192.0 — the day-ledger CSV's rows, extracted pure (228's
 * billsCsvRows pattern): the suite reads the exact table the CSV button
 * writes. The Discount column joins (after Tax) — the money the offers
 * gave away, per ticket, so SUM(Discount) reconciles against the Z's
 * "Offers given" line to the paisa. ONE rule: the order row's own
 * discount_amount; a cancelled ticket says '' (never happened — the bills
 * CSV's own rule); null on legacy rows reads 0 (no offer — a true zero,
 * never an unknown). */
export function dayLedgerCsvRows(o: {
  orders: DayOrder[];
  payments: { order_id: string; method: string }[];
  cogsRows: { order_id: string; cogs: number }[];
}): unknown[][] {
  const methodsByOrder = new Map<string, string>();
  for (const p of o.payments) {
    const prev = methodsByOrder.get(p.order_id);
    methodsByOrder.set(p.order_id, prev && !prev.includes(p.method) ? `${prev} + ${p.method}` : p.method);
  }
  const cogsByOrder = new Map(o.cogsRows.map((c) => [c.order_id, Number(c.cogs)]));
  const typeLabel = (t: string) =>
    t === 'dine_in' ? 'Dine-in' : t === 'takeaway' ? 'Takeaway' : t === 'delivery' ? 'Delivery' : t;
  return [
    ['Ticket', `Time (${appTzTag()})`, 'Type', 'Status', 'Payment', 'Method', 'Customer', 'Total', 'Tax', 'Discount', 'COGS'],
    ...o.orders.map((ord) => [
      `#${ord.order_number}`,
      istTime(ord.created_at),
      typeLabel(ord.order_type),
      ord.status,
      ord.payment_status || '',
      methodsByOrder.get(ord.id) || ord.payment_method || '',
      ord.customer_name || '',
      /* v5.282.0 — the money columns ride moneyBare (paise-true, two
         decimals — never float dust in the owner's ledger). */
      moneyBare(Number(ord.total)),
      moneyBare(Number(ord.tax_amount)),
      ord.status === 'cancelled' ? '' : moneyBare(Number(ord.discount_amount ?? 0)),
      cogsByOrder.get(ord.id) == null ? '' : moneyBare(cogsByOrder.get(ord.id)!),
    ]),
  ];
}

/* ── v5.293.0 — the drawer's movements travel too (the parked CSV): the
 * close-out room's export family completes — the day-ledger CSV, the
 * Z-report's print, and now the movements out. ONE row per movement, the
 * same grammar the day ledger speaks: the header names its columns, money
 * rides moneyBare (paise-true, never float dust in the owner's ledger),
 * the kind passes through as the row itself speaks it (payout / drop),
 * the reason travels whole (csvCell owns the quoting), and the by-line
 * names the hand — an empty one stays empty, never a guess. Extracted
 * pure (192's own pattern): the suite reads the exact table the CSV
 * button writes. */
export function drawerMovementsCsvRows(movements: DrawerMovement[]): unknown[][] {
  return [
    [`Time (${appTzTag()})`, 'Kind', 'Amount', 'Reason', 'By'],
    ...movements.map((m) => [
      istTime(m.created_at),
      m.kind,
      moneyBare(Number(m.amount)),
      m.reason,
      m.created_by_email || '',
    ]),
  ];
}

/* ─────────────────────────────── types ─────────────────────────────────── */

interface DayOrder {
  id: string;
  order_number: number;
  order_type: string;
  status: string;
  total: number;
  tax_amount: number;
  /** v5.192.0 — the money the offers gave away on THIS ticket (016's cart
   *  math, frozen on the order row). Null on legacy tickets = no offer —
   *  a true zero, never an unknown. */
  discount_amount: number | null;
  payment_status: string | null;
  payment_method: string | null;
  customer_name: string | null;
  created_at: string;
  table_id: string | null;
  /** v5.83.0 — the close sees the floor: table_number embedded in the same
   *  read (orders.table_id → dining_tables FK), the fetchOrders pattern. */
  table_label: string | null;
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

const LATE_PREP_MIN = AGE_SLA_MIN;

/** Section-mix bar tones — same family as the payment-mix palette (teal/blue/
 *  gold/green/amber), cycling if a cafe ever runs more sections than colors. */
const SECTION_TONES = ['#0F3D3E', '#1D5D7E', '#B88E2F', '#2E7D32', '#8A5A00'];

/* ─────────────────────────── small view atoms ──────────────────────────── */

const StatCard: React.FC<{
  label: string;
  value: string;
  sub?: string;
  tone?: 'teal' | 'gold' | 'green' | 'red';
  whisper?: React.ReactNode;
}> = ({ label, value, sub, tone = 'teal', whisper }) => {
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
      {whisper}
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

/* PayChip reads the LEDGER, not just the stored status: a ticket mid-split
 * (5.63.0) has parts landed but the balance still out — "part" is the honest
 * middle voice between "due" and a settled method. v5.66.0. */
const PayChip: React.FC<{ order: DayOrder; paidIn?: number }> = ({ order, paidIn = 0 }) =>
  order.payment_status === 'completed' ? (
    <span className="inline-flex items-center rounded-full bg-[#EAF0EC] px-2 py-0.5 text-[10.5px] font-bold text-[#2E7D32]">
      {order.payment_method || 'paid'}
    </span>
  ) : order.status === 'cancelled' ? (
    <span className="text-[10.5px] font-bold text-[#B3261E]">—</span>
  ) : paidIn > 0 ? (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-[#FFF8E6] px-2 py-0.5 text-[10.5px] font-bold text-[#8A6D1F]"
      title={`Split in progress — ${formatMoney(paidIn)} in, balance open`}
    >
      <Split size={10} aria-hidden />
      part
    </span>
  ) : (
    <span className="inline-flex items-center rounded-full bg-[#FFF4DB] px-2 py-0.5 text-[10.5px] font-bold text-[#8A5A00]">
      due
    </span>
  );

/* ───────────────────────────── z-report print ──────────────────────────── */

/** v5.180.0 — the Z's drawer block: ONE builder feeds print + chat twin. */
export interface ZDrawerBlock {
  title: string;
  rows: [string, string][];
  strongLast?: boolean;
  strongRows?: number[];
}

interface ZReportOpts {
  storeName: string;
  dateIso: string;
  orders: number;
  gross: number;
  paid: number;
  unpaid: number;
  unpaidTickets: number;
  splitOpen?: number;
  gst: number;
  cogs: number;
  margin: number;
  mix: { method: string; amount: number }[];
  sections?: { name: string; amount: number; units: number; pct: number }[] | null;
  cancelled: number;
  printedBy: string;
  drawer?: ZDrawerBlock | null;
  /** v5.79.0 — the close sees the bin: the day's waste in the Z's own
   *  language. Undefined = the read never happened (the block stays off;
   *  the Z never claims an honest zero it didn't verify). */
  waste?: { rupees: number; moves: number; top: string | null } | null;
  /** v5.192.0 — the close counts the offers: the day's live tickets' own
   *  discount_amount (ONE source — the orders the Z already counts).
   *  Undefined = never assembled (the block stays off; the Z never claims
   *  an honest zero it didn't verify). Present, it speaks the truth even
   *  when that truth is "nothing" — the bin's own zero-language. */
  offers?: { rupees: number; tickets: number } | null;
  /** v5.83.0 — the close sees the floor: the day's rounds, computed from
   *  the SAME day orders the Z already counts (no extra read to trust). */
  floor?: { rounds: number; rupees: number; busiest: string | null; noShows: number | null; wentQuiet: number | null } | null;
  /** v5.260.0 — the close hears the voice: the day's ratings through the ONE
   *  tone law (lib/verdict's guestVoice — the family's fourth speaker after
   *  the dashboard card, the bill row and the CRM drawer). Undefined = the
   *  read never landed (the waste law — the block stays off; the Z never
   *  claims a quiet day it didn't verify). count 0 speaks the floor's own
   *  silence word; low counts the bell's own number (ratings the bell rang
   *  for — 2 or below). */
  guests?: { count: number; avg: number; word: string; low: number } | null;
}

/* v5.180.0 — the day's shifts: the Z's drawer block speaks EVERY shift the
 *  day closed, not just the first the ledger hands back — the .find() era
 *  named one shift and, when a shift was open NOW, the if/else dropped the
 *  sealed one entirely. Two shifts in one day (morning barista, evening
 *  closer) each carried cash the day's own closing document never named.
 *  Sealed shifts read oldest→newest — the BUILDER owns the order (the GST
 *  register's chronological convention; the ledger arrives newest-first)
 *  and unreadable closes sink to the end; single-sealed and open-only
 *  shapes stay byte-identical
 *  with the .find() era (same title, rows, strongLast). DAY TOTAL rows
 *  appear from two sealed shifts and sum counted/variance over SEALED
 *  shifts only — the open shift's money is expected, not counted, and the
 *  two truths never mix (the money doctrine's population rule on the
 *  drawer's own paper). */
export interface ZSealedShift {
  closed_at: string | null;
  closed_by_email: string | null;
  opening_float: number;
  expected_cash: number | null;
  counted_cash: number | null;
  variance: number | null;
}

export interface ZOpenShift {
  opened_at: string;
  opened_by_email: string | null;
  opening_float: number;
  cashIn: number;
  moveSum: number;
}

export function buildZDrawerRows(
  sealed: ZSealedShift[],
  open: ZOpenShift | null,
  fmt: (n: number) => string,
  stamp: (iso: string) => string,
): ZDrawerBlock | null {
  if (sealed.length === 0 && !open) return null;
  const signed = (n: number) => `${n < 0 ? '-' : n > 0 ? '+' : ''}${fmt(Math.abs(n))}`;
  const who = (e: string | null) => e || 'counter';
  const when = (iso: string | null) => (iso ? stamp(iso) : '—');
  const loneSealed = sealed.length === 1 && !open;
  const ordered = [...sealed].sort((a, b) => {
    if (!a.closed_at) return 1; // unreadable closes sink to the end
    if (!b.closed_at) return -1;
    return a.closed_at < b.closed_at ? -1 : a.closed_at > b.closed_at ? 1 : 0;
  });
  const title = open
    ? sealed.length === 0
      ? 'CASH DRAWER · OPEN SHIFT'
      : `CASH DRAWER · ${sealed.length} CLOSED + OPEN`
    : sealed.length === 1
      ? 'CASH DRAWER · LAST SHIFT'
      : `CASH DRAWER · ${sealed.length} SHIFTS CLOSED`;

  const rows: [string, string][] = [];
  ordered.forEach((s, i) => {
    // expected − float is the shift's NET (cash-in minus payouts/drops)
    // since 021 — it was pure cash-in under 020; the label must say so
    const net = Number(s.expected_cash || 0) - Number(s.opening_float);
    rows.push([
      loneSealed ? `Closed ${when(s.closed_at)}` : `Shift ${i + 1} · closed ${when(s.closed_at)}`,
      who(s.closed_by_email),
    ]);
    rows.push(['Float', fmt(Number(s.opening_float))]);
    rows.push(['Net cash (in − out)', signed(net)]);
    rows.push(['Counted', fmt(Number(s.counted_cash || 0))]);
    rows.push(['VARIANCE', signed(Number(s.variance || 0))]);
  });

  if (open) {
    rows.push([
      sealed.length === 0 ? `Opened ${when(open.opened_at)}` : `Open shift · opened ${when(open.opened_at)}`,
      who(open.opened_by_email),
    ]);
    rows.push(['Float', fmt(Number(open.opening_float))]);
    rows.push(['Cash in (ledger)', fmt(open.cashIn)]);
    if (open.moveSum > 0) rows.push(['Payouts/drops', `-${fmt(open.moveSum)}`]);
    rows.push(['IN DRAWER (expected)', fmt(Number(open.opening_float) + open.cashIn - open.moveSum)]);
  }

  if (sealed.length >= 2) {
    const tc = sealed.reduce((a, s) => a + Number(s.counted_cash || 0), 0);
    const tv = sealed.reduce((a, s) => a + Number(s.variance || 0), 0);
    rows.push(['DAY TOTAL · COUNTED', fmt(tc)]);
    rows.push(['DAY TOTAL · VARIANCE', signed(tv)]);
  }

  return sealed.length >= 2
    ? { title, rows, strongRows: [rows.length - 2, rows.length - 1] }
    : { title, rows, strongLast: true };
}

function printZReport(opts: ZReportOpts): void {
  const row = (l: string, r: string, strong = false) =>
    `<div style="display:flex;justify-content:space-between;padding:2.5px 0;${strong ? 'font-weight:700;' : ''}"><span>${l}</span><span style="font-variant-numeric:tabular-nums">${r}</span></div>`;
  const methodRows =
    opts.mix.length > 0
      ? opts.mix.map((m) => row(m.method.toUpperCase(), formatMoney(m.amount))).join('')
      : row('—', 'no payments');
  const sectionsHtml =
    opts.sections && opts.sections.length > 0
      ? `<div style="border-top:1px dashed #000;margin-top:8px;padding-top:6px;">
    <div style="font-weight:800;padding-bottom:3px;">SECTIONS · EX-GST ITEM BASE</div>
    ${opts.sections.map((s) => row(`${s.name} · ${s.units}u`, `${formatMoney(s.amount)} (${s.pct}%)`)).join('')}
  </div>`
      : '';
  const drawerHtml = opts.drawer
    ? `<div style="border-top:1px dashed #000;margin-top:8px;padding-top:6px;">
    <div style="font-weight:800;padding-bottom:3px;">${opts.drawer.title}</div>
    ${opts.drawer.rows
      .map(([l, r], i) =>
        row(
          l,
          r,
          opts.drawer?.strongRows?.includes(i) ||
            (opts.drawer?.strongLast && i === opts.drawer!.rows.length - 1),
        ),
      )
      .join('')}
  </div>`
    : '';
  const wasteHtml = opts.waste
    ? `<div style="border-top:1px dashed #000;margin-top:8px;padding-top:6px;">
    <div style="font-weight:800;padding-bottom:3px;">THE BIN · WASTE</div>
    ${
      opts.waste.moves === 0
        ? row('Waste (spoilage/spill/damage)', 'nothing')
        : row('Waste (spoilage/spill/damage)', `${formatMoney(opts.waste.rupees)} · ${opts.waste.moves} mv`)
    }
    ${opts.waste.top ? row('Heaviest', opts.waste.top) : ''}
  </div>`
    : '';
  const floorHtml = opts.floor
    ? `<div style="border-top:1px dashed #000;margin-top:8px;padding-top:6px;">
    <div style="font-weight:800;padding-bottom:3px;">THE FLOOR · ROUNDS</div>
    ${
      opts.floor.rounds === 0
        ? row('Rounds seated', 'none — the floor sat quiet')
        : row('Rounds seated', `${opts.floor.rounds} · ${formatMoney(opts.floor.rupees)}`)
    }
    ${opts.floor.busiest ? row('Busiest table', opts.floor.busiest) : ''}
    ${opts.floor.noShows && opts.floor.noShows > 0 ? row('No-shows', `${opts.floor.noShows} booking${opts.floor.noShows === 1 ? '' : 's'}`) : ''}
    ${opts.floor.wentQuiet && opts.floor.wentQuiet > 0 ? row('Went quiet', `${opts.floor.wentQuiet} promise${opts.floor.wentQuiet === 1 ? '' : 's'} still booked`) : ''}
  </div>`
    : '';
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Z-report ${opts.dateIso}</title></head>
<body style="font-family:'Courier New',monospace;color:#000;margin:0;padding:16px 12px;width:300px;font-size:12px;">
  <div style="text-align:center;border-bottom:1px dashed #000;padding-bottom:8px;margin-bottom:8px;">
    <div style="font-size:15px;font-weight:800;letter-spacing:1px;">${opts.storeName}</div>
    <div>Z-REPORT · END OF DAY</div>
    <div>${prettyDay(opts.dateIso)} · ${appTimezone()}</div>
  </div>
  <div style="border-top:1px dashed #000;padding-top:6px;">
    ${row('Orders', String(opts.orders), true)}
    ${row('Cancelled', String(opts.cancelled))}
    ${row('Gross sales', formatMoney(opts.gross), true)}
    ${
      opts.offers
        ? row(
            'Offers given',
            opts.offers.tickets > 0
              ? `${formatMoney(opts.offers.rupees)} · ${opts.offers.tickets} tkt`
              : 'nothing',
          )
        : ''
    }
    ${row('GST collected', formatMoney(opts.gst))}
    ${row('PAID', formatMoney(opts.paid), true)}
    ${row(
      'UNPAID',
      `${formatMoney(opts.unpaid)} (${opts.unpaidTickets} tkt${opts.splitOpen ? ` · ${opts.splitOpen} split parts in` : ''})`,
      true,
    )}
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
  ${sectionsHtml}
  ${wasteHtml}
  ${floorHtml}
  ${drawerHtml}
  <div style="border-top:1px dashed #000;margin-top:8px;padding-top:6px;text-align:center;color:#333;">
    <div>Printed ${appFormatters().hhmm.format(new Date())} ${appTzTag()}${opts.printedBy ? ` · ${opts.printedBy}` : ''}</div>
    <div style="margin-top:6px;letter-spacing:2px;">· · · z · close · · ·</div>
  </div>
</body></html>`;

  printHiddenFrame(html);
}

/**
 * v5.146.0 — the Z-report's chat voice ("the accountant's twin" had a CSV;
 * now the owner's pocket gets one too). The SAME ZReportOpts the thermal
 * print consumes, rendered as aligned plain text for Copy / WhatsApp share:
 * same money block, same cost & margin, same payments/sections/bin/floor/
 * drawer blocks in the print's own order, same honest zero-language
 * ("nothing", "the floor sat quiet"). Exported pure so browser E2E can
 * assert the share text without touching the clipboard. 32-column frame,
 * same as the receipt's chat voice (5.145.0) — one house text-register.
 */
export function buildZReportText(opts: ZReportOpts): string {
  const W = 32;
  const two = (l: string, r: string): string => {
    const cut = Math.max(1, W - r.length - 1);
    const left = l.length > cut ? `${l.slice(0, cut - 1)}…` : l;
    return left.padEnd(W - r.length, ' ') + r;
  };
  const hr = '-'.repeat(W);
  const center = (s: string): string => {
    const t = s.length > W ? `${s.slice(0, W - 1)}…` : s;
    return t.length >= W ? t : ' '.repeat(Math.floor((W - t.length) / 2)) + t;
  };

  const out: string[] = [];
  out.push(center(opts.storeName));
  out.push(center('Z-REPORT · END OF DAY'));
  out.push(center(`${prettyDay(opts.dateIso)} · ${appTimezone()}`));
  out.push(hr);
  out.push(two('Orders', String(opts.orders)));
  out.push(two('Cancelled', String(opts.cancelled)));
  out.push(two('Gross sales', formatMoney(opts.gross)));
  /* v5.192.0 — the close counts the offers: the money the offers gave away
   * rides right under the gross it discounts (the print's own order). */
  if (opts.offers) {
    out.push(
      two(
        'Offers given',
        opts.offers.tickets > 0
          ? `${formatMoney(opts.offers.rupees)} · ${opts.offers.tickets} tkt`
          : 'nothing',
      ),
    );
  }
  out.push(two('GST collected', formatMoney(opts.gst)));
  out.push(two('PAID', formatMoney(opts.paid)));
  out.push(
    two(
      'UNPAID',
      `${formatMoney(opts.unpaid)} (${opts.unpaidTickets} tkt${opts.splitOpen ? ` · ${opts.splitOpen} split` : ''})`,
    ),
  );
  out.push(hr);
  out.push('COST & MARGIN · PAID TKTS');
  out.push(two('Ingredient cost', formatMoney(opts.cogs)));
  out.push(two('GROSS MARGIN', formatMoney(opts.margin)));
  out.push(hr);
  out.push('PAYMENTS');
  if (opts.mix.length > 0) {
    for (const m of opts.mix) out.push(two(m.method.toUpperCase(), formatMoney(m.amount)));
  } else {
    out.push('- (no payments)');
  }
  if (opts.sections && opts.sections.length > 0) {
    out.push(hr);
    out.push('SECTIONS · EX-GST ITEM BASE');
    for (const s of opts.sections)
      out.push(two(`${s.name} · ${s.units}u`, `${formatMoney(s.amount)} (${s.pct}%)`));
  }
  if (opts.waste) {
    out.push(hr);
    out.push('THE BIN · WASTE');
    out.push(
      opts.waste.moves === 0
        ? two('Waste (spoil/spill/damage)', 'nothing')
        : two('Waste (spoil/spill/damage)', `${formatMoney(opts.waste.rupees)} · ${opts.waste.moves}mv`),
    );
    if (opts.waste.top) out.push(two('Heaviest', opts.waste.top));
  }
  if (opts.floor) {
    out.push(hr);
    out.push('THE FLOOR · ROUNDS');
    out.push(
      opts.floor.rounds === 0
        ? 'Rounds seated: none - quiet'
        : two('Rounds seated', `${opts.floor.rounds} · ${formatMoney(opts.floor.rupees)}`),
    );
    if (opts.floor.busiest) out.push(two('Busiest table', opts.floor.busiest));
    if (opts.floor.noShows && opts.floor.noShows > 0)
      out.push(two('No-shows', `${opts.floor.noShows} booking${opts.floor.noShows === 1 ? '' : 's'}`));
    if (opts.floor.wentQuiet && opts.floor.wentQuiet > 0)
      out.push(two('Went quiet', `${opts.floor.wentQuiet} promise${opts.floor.wentQuiet === 1 ? '' : 's'} still booked`));
  }
  if (opts.guests) {
    /* v5.260.0 — the close hears the voice: the day's ratings through the
       ONE tone law (guestVoice — the dashboard card's own thresholds and
       words; the family's fourth speaker). The silence keeps the floor's
       own zero-language ('none - quiet'); a voiced day speaks count + avg
       on the row and the tone word CENTERED below — the print's own stamp.
       The bell's number (2 or below) rides last, only when it rang. */
    out.push(hr);
    out.push('THE GUESTS · VOICE');
    out.push(
      opts.guests.count === 0
        ? 'Ratings: none - quiet'
        : two('Ratings', `${opts.guests.count} · avg ${opts.guests.avg.toFixed(1)}`),
    );
    if (opts.guests.word) out.push(center(opts.guests.word));
    if (opts.guests.low > 0) out.push(two('Low ratings (2 or less)', String(opts.guests.low)));
  }
  if (opts.drawer) {
    out.push(hr);
    out.push(opts.drawer.title);
    opts.drawer.rows.forEach(([l, r], i) => {
      const strong =
        opts.drawer?.strongRows?.includes(i) ||
        (opts.drawer?.strongLast && i === opts.drawer!.rows.length - 1);
      out.push(strong ? two(l.toUpperCase(), r) : two(l, r));
    });
  }
  out.push(hr);
  out.push(center(`Printed ${appFormatters().hhmm.format(new Date())} ${appTzTag()}${opts.printedBy ? ` - ${opts.printedBy}` : ''}`));
  out.push(center('· · · z · close · · ·'));
  return out.join('\n');
}

/* ─────────────────────────── cash drawer (020) ─────────────────────────── */

/** Health voice for a closed shift's variance — stored ledger truth, spoken. */
function varianceTone(v: number): { cls: string; chip: string; label: string } {
  const abs = Math.abs(v);
  if (abs < 0.005)
    return {
      cls: 'text-[#2E7D32]',
      chip: 'bg-[#EAF0EC] text-[#2E7D32]',
      label: 'matches the ledger',
    };
  if (abs <= 20)
    return {
      cls: 'text-[#8A5A00]',
      chip: 'bg-[#FFF4DB] text-[#8A5A00]',
      label: 'small slip — noted on the shift',
    };
  return {
    cls: 'text-[#B3261E]',
    chip: 'bg-[#FCEBEA] text-[#B3261E]',
    label: v > 0 ? 'over — investigate' : 'short — investigate',
  };
}

const signedMoney = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${formatMoney(Math.abs(v))}`;

const VarianceChip: React.FC<{ v: number }> = ({ v }) => {
  const t = varianceTone(v);
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-bold tabular-nums ${t.chip}`}>
      {signedMoney(v)}
    </span>
  );
};

/** Stable RPC codes → honest words (never a raw postgres message). */
const DRAWER_ERR: Record<string, string> = {
  DRAWER_ALREADY_OPEN: 'A drawer is already open — count and close it first.',
  DRAWER_NOT_OPEN: 'That shift is sealed — movements can only land on an open drawer.',
  ALREADY_CLOSED: 'That shift is already sealed.',
  NOT_FOUND: 'That drawer shift is not in this workspace.',
  BAD_FLOAT: 'Opening float must be zero or more.',
  BAD_COUNT: 'Counted cash must be zero or more.',
  BAD_KIND: 'A movement is either a payout or a safe drop.',
  BAD_AMOUNT: 'Movement amount must be more than zero.',
  REASON_REQUIRED: 'A movement needs a reason — "₹200 out" without a why is a leak.',
  TOO_LONG: 'That text is over 280 characters.',
  NOT_A_MEMBER: 'Your account is not linked to this workspace.',
};
const drawerErrText = (e: unknown): string => {
  const msg = e instanceof Error ? e.message : '';
  const code = DRAWER_ERR[msg] ? msg : Object.keys(DRAWER_ERR).find((k) => msg.includes(k));
  return (code && DRAWER_ERR[code]) || 'Could not reach the drawer ledger — try again.';
};

/** Open (float) / count-and-close (recount + note) dialog — one body, two modes. */
const DrawerDialog: React.FC<{
  mode: 'open' | 'close';
  active: DrawerSession | null;
  cashIn: number;
  moveOut: number;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (amount: number, note: string) => void;
}> = ({ mode, active, cashIn, moveOut, busy, onCancel, onConfirm }) => {
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  /* v5.110.0 — Escape/trap/restore; Escape stands down while the ledger writes. */
  const dlgRef = useDialogA11y<HTMLDivElement>(() => { if (!busy) onCancel(); }, true);
  const expected = mode === 'close' && active ? Number(active.opening_float) + cashIn - moveOut : 0;
  const parsed = amount.trim() === '' ? null : Number(amount);
  const valid = parsed !== null && Number.isFinite(parsed) && parsed >= 0;
  const variance = mode === 'close' && valid ? round2(parsed! - expected) : null;
  const tone = variance === null ? null : varianceTone(variance);

  return (
    <div
      ref={dlgRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F3D3E]/45 p-4 backdrop-blur-[2px]"
      style={{ animation: 'spFadeIn 160ms ease-out' }}
      role="dialog"
      aria-modal="true"
      aria-label={mode === 'open' ? 'Open cash drawer' : 'Count and close the drawer'}
      onClick={(e) => e.target === e.currentTarget && !busy && onCancel()}
    >
      <div className="w-full max-w-sm rounded-2xl border border-[#E3E7E0] bg-white p-5 shadow-xl">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#0F3D3E] text-white">
            {mode === 'open' ? <Coins size={17} aria-hidden /> : <LockKeyhole size={17} aria-hidden />}
          </span>
          <div>
            <h3 className="text-[15px] font-extrabold tracking-tight text-[#0F3D3E]">
              {mode === 'open' ? 'Open the drawer' : 'Count & close the drawer'}
            </h3>
            <p className="text-[11px] font-semibold text-[#8A938C]">
              {mode === 'open'
                ? 'count the float you are starting with'
                : 'the ledger already knows what to expect'}
            </p>
          </div>
        </div>

        {mode === 'close' ? (
          <div className="mt-4 rounded-xl bg-[#F7F8F6] px-3.5 py-3">
            <div className="flex items-center justify-between text-[12px] font-semibold text-[#5F6B63]">
              <span>Opening float</span>
              <span className="tabular-nums">{formatMoney(Number(active?.opening_float || 0))}</span>
            </div>
            <div className="mt-1 flex items-center justify-between text-[12px] font-semibold text-[#5F6B63]">
              <span>Cash payments since open</span>
              <span className="tabular-nums">{formatMoney(cashIn)}</span>
            </div>
            {moveOut > 0 ? (
              <div className="mt-1 flex items-center justify-between text-[12px] font-semibold text-[#B3261E]">
                <span>Paid out / dropped</span>
                <span className="tabular-nums">−{formatMoney(moveOut)}</span>
              </div>
            ) : null}
            <div className="mt-2 flex items-center justify-between border-t border-dashed border-[#D9DFD9] pt-2 text-[13.5px] font-extrabold text-[#0F3D3E]">
              <span>Expected in drawer</span>
              <span className="tabular-nums">{formatMoney(expected)}</span>
            </div>
          </div>
        ) : null}

        <label className="mt-4 block text-[11px] font-bold uppercase tracking-[0.08em] text-[#8A938C]">
          {mode === 'open' ? 'Opening float (₹)' : 'Counted cash (₹)'}
        </label>
        <input
          autoFocus
          type="number"
          inputMode="decimal"
          min={0}
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && valid && !busy && onConfirm(parsed!, note)}
          placeholder="0.00"
          aria-label={mode === 'open' ? 'Opening float in rupees' : 'Counted cash in rupees'}
          className="mt-1.5 w-full rounded-xl border border-[#E3E7E0] bg-white px-3.5 py-2.5 text-[15px] font-extrabold tabular-nums text-[#0F3D3E] outline-none transition-shadow placeholder:font-semibold placeholder:text-[#C8CFC9] focus:border-[#B88E2F] focus:ring-2 focus:ring-[#B88E2F]/25"
        />

        {mode === 'close' && tone ? (
          <p className={`mt-2 text-[12px] font-bold tabular-nums ${tone.cls}`} aria-live="polite">
            {variance === 0 ? '✓ ' : ''}
            {variance === 0
              ? 'right on the ledger'
              : `${signedMoney(variance!)} vs expected · ${tone.label}`}
          </p>
        ) : null}

        {mode === 'close' ? (
          <>
            <label className="mt-3 block text-[11px] font-bold uppercase tracking-[0.08em] text-[#8A938C]">
              Note <span className="normal-case text-[#C8CFC9]">· optional</span>
            </label>
            <input
              type="text"
              maxLength={280}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="why the count differs, who counted…"
              aria-label="Closing note"
              className="mt-1.5 w-full rounded-xl border border-[#E3E7E0] bg-white px-3.5 py-2.5 text-[12.5px] font-semibold text-[#0F3D3E] outline-none transition-shadow placeholder:text-[#C8CFC9] focus:border-[#B88E2F] focus:ring-2 focus:ring-[#B88E2F]/25"
            />
            <p className="mt-1 text-right text-[10.5px] font-semibold tabular-nums text-[#C8CFC9]">
              {note.length}/280
            </p>
          </>
        ) : null}

        <div className="mt-4 flex gap-2.5">
          <button
            onClick={onCancel}
            disabled={busy}
            className="min-h-[44px] flex-1 rounded-xl border border-[#E3E7E0] bg-white text-[13px] font-bold text-[#0F3D3E] transition-colors hover:bg-[#F0F2EF] disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            onClick={() => valid && !busy && onConfirm(parsed!, note)}
            disabled={!valid || busy}
            className={`min-h-[44px] flex-1 rounded-xl text-[13px] font-extrabold text-white shadow-[0_1px_2px_rgba(15,61,62,0.15)] transition-all active:scale-[0.99] disabled:opacity-40 ${
              mode === 'open' ? 'bg-[#0F3D3E] hover:bg-[#0C3233]' : 'bg-[#B88E2F] hover:bg-[#A57D27]'
            }`}
          >
            {busy ? (
              <span className="inline-flex items-center gap-2">
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" aria-hidden />
                sealing…
              </span>
            ) : mode === 'open' ? (
              'Open drawer'
            ) : (
              'Seal the shift'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

/** Record a payout or safe drop on the open shift — reason is not optional. */
const MovementDialog: React.FC<{
  busy: boolean;
  onCancel: () => void;
  onConfirm: (kind: 'payout' | 'drop', amount: number, reason: string) => void;
}> = ({ busy, onCancel, onConfirm }) => {
  const [kind, setKind] = useState<'payout' | 'drop'>('payout');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  /* v5.110.0 — Escape/trap/restore; Escape stands down while the ledger writes. */
  const dlgRef = useDialogA11y<HTMLDivElement>(() => { if (!busy) onCancel(); }, true);
  const parsed = amount.trim() === '' ? null : Number(amount);
  const valid = parsed !== null && Number.isFinite(parsed) && parsed > 0 && reason.trim().length > 0;

  return (
    <div
      ref={dlgRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F3D3E]/45 p-4 backdrop-blur-[2px]"
      style={{ animation: 'spFadeIn 160ms ease-out' }}
      role="dialog"
      aria-modal="true"
      aria-label="Record a drawer movement"
      onClick={(e) => e.target === e.currentTarget && !busy && onCancel()}
    >
      <div className="w-full max-w-sm rounded-2xl border border-[#E3E7E0] bg-white p-5 shadow-xl">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#0F3D3E] text-white">
            <TrendingDown size={17} aria-hidden />
          </span>
          <div>
            <h3 className="text-[15px] font-extrabold tracking-tight text-[#0F3D3E]">Money leaving the drawer</h3>
            <p className="text-[11px] font-semibold text-[#8A938C]">on the record, with a reason — or it's a leak</p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Movement kind">
          {([['payout', 'Payout', 'paid out — supplier, petty cash'], ['drop', 'Safe drop', 'moved to the safe']] as const).map(
            ([k, label, sub]) => {
              const on = kind === k;
              return (
                <button
                  key={k}
                  onClick={() => setKind(k)}
                  role="radio"
                  aria-checked={on}
                  className={`rounded-xl border px-3 py-2.5 text-left transition-all ${
                    on
                      ? 'border-[#0F3D3E] bg-[#0F3D3E] text-white shadow-[0_1px_2px_rgba(15,61,62,0.2)]'
                      : 'border-[#E3E7E0] bg-white text-[#0F3D3E] hover:bg-[#F7F8F6]'
                  }`}
                >
                  <span className="block text-[13px] font-extrabold">{label}</span>
                  <span className={`block text-[10.5px] font-semibold ${on ? 'text-white/70' : 'text-[#8A938C]'}`}>{sub}</span>
                </button>
              );
            },
          )}
        </div>

        <label className="mt-4 block text-[11px] font-bold uppercase tracking-[0.08em] text-[#8A938C]">
          Amount (₹)
        </label>
        <input
          autoFocus
          type="number"
          inputMode="decimal"
          min={0.01}
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
          aria-label="Movement amount in rupees"
          className="mt-1.5 w-full rounded-xl border border-[#E3E7E0] bg-white px-3.5 py-2.5 text-[15px] font-extrabold tabular-nums text-[#0F3D3E] outline-none transition-shadow placeholder:font-semibold placeholder:text-[#C8CFC9] focus:border-[#B88E2F] focus:ring-2 focus:ring-[#B88E2F]/25"
        />

        <label className="mt-3 block text-[11px] font-bold uppercase tracking-[0.08em] text-[#8A938C]">
          Reason <span className="text-[#B3261E]">· required</span>
        </label>
        <input
          type="text"
          maxLength={280}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && valid && !busy && onConfirm(kind, parsed!, reason)}
          placeholder={kind === 'payout' ? 'e.g. vegetables vendor, paid cash' : 'e.g. lunch rush — drawer to safe'}
          aria-label="Why the money left the drawer"
          className="mt-1.5 w-full rounded-xl border border-[#E3E7E0] bg-white px-3.5 py-2.5 text-[12.5px] font-semibold text-[#0F3D3E] outline-none transition-shadow placeholder:text-[#C8CFC9] focus:border-[#B88E2F] focus:ring-2 focus:ring-[#B88E2F]/25"
        />
        <p className="mt-1 text-right text-[10.5px] font-semibold tabular-nums text-[#C8CFC9]">{reason.length}/280</p>

        <div className="mt-3 flex gap-2.5">
          <button
            onClick={onCancel}
            disabled={busy}
            className="min-h-[44px] flex-1 rounded-xl border border-[#E3E7E0] bg-white text-[13px] font-bold text-[#0F3D3E] transition-colors hover:bg-[#F0F2EF] disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            onClick={() => valid && !busy && onConfirm(kind, parsed!, reason)}
            disabled={!valid || busy}
            className="min-h-[44px] flex-1 rounded-xl bg-[#0F3D3E] text-[13px] font-extrabold text-white shadow-[0_1px_2px_rgba(15,61,62,0.15)] transition-all hover:bg-[#0C3233] active:scale-[0.99] disabled:opacity-40"
          >
            {busy ? (
              <span className="inline-flex items-center gap-2">
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" aria-hidden />
                recording…
              </span>
            ) : (
              'Record movement'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

/** The live drawer card — today's shift at a glance + recent sealed shifts. */
const DrawerCard: React.FC<{
  active: DrawerSession | null;
  history: DrawerSession[];
  cashIn: number;
  cashLoading: boolean;
  movements: DrawerMovement[];
  onOpenFlow: () => void;
  onCloseFlow: () => void;
  onRecordMovement: () => void;
}> = ({ active, history, cashIn, cashLoading, movements, onOpenFlow, onCloseFlow, onRecordMovement }) => {
  const [histOpen, setHistOpen] = useState(false);
  /* v5.293.0 — the movements' own export verb and its ack. The day-ledger
   * CSV has one; the movements out — the card's own leak ledger — rode
   * silent. Same hook, same breath: the tap exports, then the chip speaks
   * its green word for a breath and returns. The file's name carries the
   * day the export happened (istTodayIso — module scope, no prop drilled).
   * The rows build through drawerMovementsCsvRows (exported pure) — the
   * suite reads the exact table this button writes. */
  const [movSaved, flashMov] = useExportFlash();
  const moveSum = movements.reduce((s, m) => s + Number(m.amount || 0), 0);
  const expected = active ? Number(active.opening_float) + cashIn - moveSum : 0;
  const last = history[0];
  /* v5.180.0 — the day's shifts on the SCREEN too: when two or more shifts
   *  seal today, the chip names the count (the Z's drawer block names them
   *  all now — screen and paper agree). One sealed shift: silent — the
   *  chip would repeat what the card already says. */
  const todayBounds = istDayBounds(istTodayIso());
  const shiftsToday = history.filter(
    (h) => h.closed_at && h.closed_at >= todayBounds.startIso && h.closed_at < todayBounds.endIso,
  ).length;

  return (
    <section aria-label="Cash drawer" className="rounded-2xl border border-[#E3E7E0] bg-white p-4">
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#0F3D3E] text-white">
          <Coins size={17} aria-hidden />
        </span>
        <h2 className="text-[13px] font-extrabold uppercase tracking-[0.06em] text-[#0F3D3E]">
          Cash drawer
        </h2>
        {active ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#EAF0EC] px-2.5 py-0.5 text-[10.5px] font-bold text-[#2E7D32]" role="status">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#2E7D32]" aria-hidden />
            OPEN
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full bg-[#F0F2EF] px-2.5 py-0.5 text-[10.5px] font-bold text-[#8A938C]">
            not open
          </span>
        )}
        {shiftsToday >= 2 ? (
          <span
            className="inline-flex items-center rounded-full bg-[#FDF9F0] px-2.5 py-0.5 text-[10.5px] font-bold text-[#8A5A16]"
            title={`Shifts sealed today — each carries its own float, count and variance; the day's z-report names them all`}
          >
            {shiftsToday} sealed today
          </span>
        ) : null}
        <div className="ml-auto flex items-center gap-2">
          {active ? (
            <>
              <button
                onClick={onRecordMovement}
                className="flex min-h-[40px] items-center gap-2 rounded-xl border border-[#E3E7E0] bg-white px-3.5 text-[12.5px] font-extrabold text-[#0F3D3E] transition-colors hover:bg-[#F0F2EF] active:scale-[0.99]"
              >
                <HandCoins size={14} aria-hidden />
                Movement
              </button>
              <button
                onClick={onCloseFlow}
                className="flex min-h-[40px] items-center gap-2 rounded-xl bg-[#B88E2F] px-3.5 text-[12.5px] font-extrabold text-white shadow-[0_1px_2px_rgba(15,61,62,0.15)] transition-colors hover:bg-[#A57D27] active:scale-[0.99]"
              >
                <LockKeyhole size={14} aria-hidden />
                Count &amp; close
              </button>
            </>
          ) : (
            <button
              onClick={onOpenFlow}
              className="flex min-h-[40px] items-center gap-2 rounded-xl bg-[#0F3D3E] px-3.5 text-[12.5px] font-extrabold text-white transition-colors hover:bg-[#0C3233] active:scale-[0.99]"
            >
              <Coins size={14} aria-hidden />
              Open drawer
            </button>
          )}
        </div>
      </div>

      {active ? (
        <>
          <p className="mt-2.5 text-[11.5px] font-semibold text-[#8A938C]">
            Opened {dayTime(active.opened_at, appTimezone())} {appTzTag()} · {active.opened_by_email || 'counter'}
          </p>
          <div className="mt-3 grid grid-cols-3 gap-2.5">
            <div className="rounded-xl bg-[#F7F8F6] px-3 py-2.5">
              <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#8A938C]">Float</p>
              <p className="text-[15px] font-extrabold tabular-nums text-[#0F3D3E]">
                {formatMoney(Number(active.opening_float))}
              </p>
            </div>
            <div className="rounded-xl bg-[#F7F8F6] px-3 py-2.5">
              <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#8A938C]">Cash in</p>
              <p className={`text-[15px] font-extrabold tabular-nums text-[#0F3D3E] ${cashLoading ? 'opacity-50' : ''}`}>
                {formatMoney(cashIn)}
              </p>
            </div>
            <div className="rounded-xl border border-[#B88E2F]/35 bg-[#FDF9F0] px-3 py-2.5">
              <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#8A5A16]">In drawer</p>
              <p className={`text-[15px] font-extrabold tabular-nums text-[#8A5A16] ${expected < 0 ? 'text-[#B3261E]' : ''}`}>
                {formatMoney(expected)}
              </p>
            </div>
          </div>
          {movements.length > 0 ? (
            <div className="mt-2.5">
              {/* v5.293.0 — the header row grew the export verb: the label
               * keeps its exact classes (min-w-0 flex-1), the verb rides
               * ml-auto in the house's ONE chip register — the same amber
               * chip the Reports rooms speak, the same green Saved breath
               * after. It only ever renders inside this branch: a drawer
               * with no movements has nothing to travel — no verb, no
               * empty file. */}
              <div className="flex items-center gap-2">
                <p className="min-w-0 flex-1 text-[10px] font-bold uppercase tracking-[0.08em] text-[#8A938C]">
                  Movements out · {formatMoney(moveSum)}
                </p>
                <CsvExportButton
                  tone="chip"
                  saved={movSaved}
                  onExport={() =>
                    flashMov(() =>
                      downloadCsv(
                        `servepoint-drawer-movements-${istTodayIso()}.csv`,
                        drawerMovementsCsvRows(movements),
                      ),
                    )
                  }
                  idleAria="Export the drawer's movements as CSV"
                  savedAria="Movements exported — the CSV file is saved"
                  title="One row per movement — payouts and safe drops for the spreadsheet"
                />
              </div>
              <ul className="mt-1 flex flex-col gap-1">
                {movements.map((m) => (
                  <li
                    key={m.id}
                    className="flex flex-wrap items-center gap-x-2 gap-y-0.5 rounded-lg bg-[#FDF6F5] px-2.5 py-1.5 text-[11.5px] font-semibold text-[#5F6B63]"
                  >
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                        m.kind === 'payout' ? 'bg-[#FCEBEA] text-[#B3261E]' : 'bg-[#EAF2F7] text-[#1D5D7E]'
                      }`}
                    >
                      <TrendingDown size={10} aria-hidden />
                      {m.kind}
                    </span>
                    <span className="font-extrabold tabular-nums text-[#0F3D3E]">−{formatMoney(Number(m.amount))}</span>
                    <span className="min-w-0 flex-1 truncate" title={m.reason}>
                      {m.reason}
                    </span>
                    <span className="text-[10px] font-semibold text-[#C8CFC9]">{dayTime(m.created_at, appTimezone())}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <p className="mt-2 text-[10.5px] font-semibold text-[#8A938C]">
            expected = float + cash-in − payouts &amp; drops · ledger truth, never a guess
          </p>
        </>
      ) : last ? (
        <p className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] font-semibold text-[#5F6B63]">
          <span>
            Last shift closed {last.closed_at ? dayTime(last.closed_at, appTimezone()) : '—'}
            {last.closed_by_email ? ` by ${last.closed_by_email}` : ''}
          </span>
          <VarianceChip v={Number(last.variance || 0)} />
          {last.closing_note ? (
            <span className="max-w-full truncate text-[11.5px] text-[#8A938C]" title={last.closing_note}>
              “{last.closing_note}”
            </span>
          ) : null}
        </p>
      ) : (
        <p className="mt-2.5 text-[12px] font-semibold text-[#8A938C]">
          Open the drawer with a counted float — at close, the ledger does the math.
        </p>
      )}

      {history.length > 0 ? (
        <div className="mt-3 border-t border-[#F0F2EF] pt-2.5">
          <button
            onClick={() => setHistOpen((o) => !o)}
            aria-expanded={histOpen}
            className="flex min-h-[36px] items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.07em] text-[#5F6B63] transition-colors hover:text-[#0F3D3E]"
          >
            <ChevronDown size={14} className={`transition-transform ${histOpen ? 'rotate-180' : ''}`} aria-hidden />
            Recent shifts · {history.length}
          </button>
          {histOpen ? (
            <ul className="mt-1.5 flex flex-col gap-1.5">
              {history.map((h) => (
                <li
                  key={h.id}
                  className="rounded-xl bg-[#F7F8F6] px-3 py-2 text-[11.5px] font-semibold text-[#5F6B63]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="tabular-nums text-[#0F3D3E]">{daySpan(h.opened_at, h.closed_at, appTimezone())}</span>
                    <VarianceChip v={Number(h.variance || 0)} />
                  </div>
                  <div className="mt-0.5 flex flex-wrap gap-x-2.5 gap-y-0.5 tabular-nums">
                    <span>float {formatMoney(Number(h.opening_float))}</span>
                    {h.expected_cash != null ? (
                      <span>expected {formatMoney(Number(h.expected_cash))}</span>
                    ) : null}
                    <span>counted {formatMoney(Number(h.counted_cash || 0))}</span>
                  </div>
                  {h.closing_note ? (
                    <p className="mt-0.5 truncate text-[11px] font-medium text-[#8A938C]" title={h.closing_note}>
                      “{h.closing_note}”
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  );
};

/* ────────────────────────────── the screen ─────────────────────────────── */

const EodScreenInner: React.FC<{ onTenantRetry: () => void }> = ({ onTenantRetry }) => {
  const { loading: tenantLoading, error: tenantError, tenantId, tenant } = useTenant();
  const session = useSession((s) => s.session);
  const goSection = useUi((s) => s.goSection);
  /* v5.275.0 — the closeout's verb speaks its own ack (the 5.274.0
   * grammar reaching the whole house via the ONE component). */
  const [closeSaved, flashClose] = useExportFlash();
  /* 5.96.0 — the day door: Reports' day-by-day bars open a day's counted
     book straight onto that reporting day. The initializer only PEEKS at the
     section hint (a read is render-safe); the consume — the only store
     write — waits for the mount effect, so the arrival never sets state
     while rendering. A hint aimed at another room (Bills' 'unpaid') is
     never swallowed here. Applied once on arrival; never persists, never
     rides the URL. */
  const [dateIso, setDateIso] = useState<string>(() => {
    const hint = useUi.getState().sectionHint;
    if (hint && hint.startsWith('day:')) {
      const d = hint.slice('day:'.length);
      if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
    }
    return istTodayIso();
  });
  useEffect(() => {
    const hint = useUi.getState().sectionHint;
    if (hint && hint.startsWith('day:')) useUi.getState().consumeSectionHint();
  }, []);
  const [orders, setOrders] = useState<DayOrder[]>([]);
  const [payments, setPayments] = useState<DayPayment[]>([]);
  /* v5.260.0 — the day's voice, in the load's own hand: null = the read never
   * landed (the Z's waste law — the block stays off, the Z never claims a
   * quiet day it didn't verify); [] = the read landed and the day held none.
   * The rows carry only what the voice needs (rating) — the ONE tone law in
   * lib/verdict does the talking. */
  const [voiceRows, setVoiceRows] = useState<{ rating: number }[] | null>(null);
  const [cogsRows, setCogsRows] = useState<DayCogs[]>([]);
  const [sectionRows, setSectionRows] = useState<DaySectionRow[]>([]);
  /** The day's bin (v5.79.0): null = not read yet, [] = the shelf's honest
   *  zero. Fail-soft like the section mix — waste can never take the
   *  day's money view down. */
  const [wasteMoves, setWasteMoves] = useState<WasteMove[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshedAt, setRefreshedAt] = useState<Date | null>(null);
  /* 5.93.0 — the older-unpaid census: everything the day's book can't see
   * (created before it opened, still not settled). The card used to say
   * "Unpaid right now" and count only TODAY's tickets — the strip said
   * "5 · ₹1,801.80" while this tile said "0 · ₹0.00", both honest math, no
   * words saying they count different days. The census is one bounded count,
   * fail-soft: a hiccup silences the whisper, never the day's book. */
  const [olderUnpaid, setOlderUnpaid] = useState(0);
  /* v5.230.0 — the stranded census (the Dashboard's own staleKitchen
   * register, 5.89): rail-active tickets whose day is GONE — stuck on the
   * board before today's book began. The closing checklist was blind to
   * them: an owner read "0 tickets" and walked away while stranded work
   * waited in Bills (the room that can still act). Fail-soft the
   * olderUnpaid way: a failed read is silence, never an invented strand. */
  const [staleKitchen, setStaleKitchen] = useState(0);

  /* ── cash drawer (020) ── */
  const [drawerActive, setDrawerActive] = useState<DrawerSession | null>(null);
  const [drawerHistory, setDrawerHistory] = useState<DrawerSession[]>([]);
  const [cashIn, setCashIn] = useState(0);
  const [cashLoading, setCashLoading] = useState(false);
  const [movements, setMovements] = useState<DrawerMovement[]>([]);
  const [drawerDialog, setDrawerDialog] = useState<'open' | 'close' | null>(null);
  const [moveDialog, setMoveDialog] = useState(false);
  const [drawerBusy, setDrawerBusy] = useState(false);
  const [drawerError, setDrawerError] = useState<string | null>(null);

  const isToday = dateIso === istTodayIso();

  const load = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    setVoiceRows(null); // a day switch never shows yesterday's voice while loading
    try {
      const { startIso, endIso } = istDayBounds(dateIso);
      const [oRes, pRes, cRes, vRes] = await Promise.all([
        supabase
          .from('orders')
          .select(
            'id, order_number, order_type, status, total, tax_amount, payment_status, payment_method, customer_name, created_at, table_id, client_operation_id, dining_tables(table_number)'
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
        /* v5.260.0 — the day's voice rides the SAME load cycle and the SAME
         * day bounds (istDayBounds — one day, one bounds, never a second
         * window). Fail-soft by contract: the read landing is the BLOCK's
         * business, never the screen's error — a voice that cannot be
         * verified is a block that stays off (the waste law). */
        supabase
          .from('order_feedback')
          .select('rating')
          .eq('tenant_id', tenantId)
          .gte('created_at', startIso)
          .lt('created_at', endIso),
      ]);
      if (oRes.error) throw oRes.error;
      if (pRes.error) throw pRes.error;
      /* the voice read answers for itself — a refusal here dims the block,
       * never the close-out (the screen's try/catch is for the money reads) */
      setVoiceRows(vRes.error ? null : ((vRes.data || []) as { rating: number }[]));
      // v5.83.0 — the table embed resolves table_id → table_number in the SAME
      // read (the fetchOrders boundary pattern); the floor strip names tables,
      // never raw uuids.
      const dayOrders = ((oRes.data || []) as unknown[]).map((r: unknown) => {
        const { dining_tables, ...rest } = r as Omit<DayOrder, 'table_label'> & {
          dining_tables?: { table_number: string } | null;
        };
        return { ...rest, table_label: dining_tables?.table_number ?? null } as DayOrder;
      });
      setOrders(dayOrders);
      setPayments((pRes.data || []) as DayPayment[]);
      const ids = new Set(dayOrders.map((o) => o.id));
      setCogsRows(
        (cRes as unknown as DayCogs[]).filter((r) => ids.has(r.order_id)),
      );
      // Section mix (021-era feature, FAIL-SOFT like the drawer): a hiccup in
      // the item join can never take the day's money view down.
      try {
        setSectionRows(await fetchDaySections(tenantId, [...ids]));
      } catch {
        setSectionRows([]);
      }
      // The bin (v5.79.0, FAIL-SOFT the same way): the day's close reads the
      // waste diary so shrinkage lands in the daily ritual, not just Reports.
      // fetchWasteMoves returns the whole diary; the day window filters here
      // (the fetchOrderCogs pattern — fetch wide, slice to the day).
      try {
        const allWaste = await fetchWasteMoves(tenantId);
        setWasteMoves(
          allWaste.filter((m) => m.created_at >= startIso && m.created_at < endIso),
        );
      } catch {
        setWasteMoves([]);
      }
      setRefreshedAt(new Date());
      /* 5.93.0 — the older-unpaid census (today's book only: a past day is
       * finished history, the strip isn't pointing at it). Fail-soft. */
      if (dateIso === istTodayIso()) {
        try {
          const r = await supabase
            .from('orders')
            .select('id', { count: 'exact', head: true })
            .eq('tenant_id', tenantId)
            .lt('created_at', startIso)
            .neq('status', 'cancelled')
            /* v5.242.0 — the legacy leg: status 'paid' with a payment_status
             * that never completed is the trio's PAID (displayStatus honours
             * it), so the census must too — ONE unpaid word at any scale
             * (the money book's server predicate speaks the same three). */
            .neq('status', 'paid')
            .neq('payment_status', 'completed');
          setOlderUnpaid(r.error ? 0 : (r.count ?? 0));
        } catch {
          setOlderUnpaid(0);
        }
        /* v5.230.0 — the stranded census: isOnRail's own three stages
         * (pending/preparing/ready — the wire carries the set the rail
         * answers to; `new` is the counter inbox's voice, `cancelled` is
         * done), created before today's start. The Dashboard's
         * staleKitchen counts the same population from its own read —
         * two surfaces, one register (5.198). */
        try {
          const r = await supabase
            .from('orders')
            .select('id', { count: 'exact', head: true })
            .eq('tenant_id', tenantId)
            .lt('created_at', startIso)
            .in('status', ['pending', 'preparing', 'ready']);
          setStaleKitchen(r.error ? 0 : (r.count ?? 0));
        } catch {
          setStaleKitchen(0);
        }
      } else {
        setOlderUnpaid(0);
        setStaleKitchen(0);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not load the day.');
    } finally {
      setLoading(false);
    }
  }, [tenantId, dateIso]);

  useEffect(() => {
    void load();
  }, [load]);

  /* ── v5.83.0 — the book rides along, FAIL-SOFT like the waste read: the
     day's no-shows are a whisper on the strip, never a hard dependency.
     Fetched ONCE per tenant (200 latest); the selected reporting day filters
     client-side, so day navigation never refetches the book. */
  const [reservations, setReservations] = useState<Reservation[] | null>(null);
  useEffect(() => {
    if (!tenantId) return;
    fetchReservations(tenantId)
      .then((rs) => setReservations(rs))
      .catch(() => setReservations((prev) => prev ?? []));
  }, [tenantId]);

  /* ── drawer ledger: active session + recent sealed shifts ── */
  const moveSum = movements.reduce((s, m) => s + Number(m.amount || 0), 0);

  const loadDrawer = useCallback(async () => {
    if (!tenantId) return;
    try {
      const [act, hist] = await Promise.all([
        fetchActiveDrawerSession(tenantId),
        fetchDrawerHistory(tenantId, 5),
      ]);
      setDrawerActive(act);
      setDrawerHistory(hist);
      if (act) {
        setCashLoading(true);
        const [cash, movs] = await Promise.all([
          fetchCashInSince(tenantId, act.opened_at),
          fetchDrawerMovements(tenantId, act.id).catch(() => [] as DrawerMovement[]),
        ]);
        setCashIn(cash);
        setMovements(movs);
      } else {
        setCashIn(0);
        setMovements([]);
      }
    } catch {
      // drawer is fail-soft: the day's money view must never hard-fail on it
    } finally {
      setCashLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    void loadDrawer();
  }, [loadDrawer]);

  /* live cash-in while a drawer is open — rides the same 20s heartbeat */
  useEffect(() => {
    if (!isToday || !drawerActive) return;
    const t = setInterval(() => void loadDrawer(), 20000);
    return () => clearInterval(t);
  }, [isToday, drawerActive, loadDrawer]);

  const confirmOpenDrawer = async (amount: number) => {
    setDrawerBusy(true);
    setDrawerError(null);
    try {
      await openDrawerSession(round2(amount));
      setDrawerDialog(null);
      await loadDrawer();
    } catch (e: unknown) {
      setDrawerError(drawerErrText(e));
    } finally {
      setDrawerBusy(false);
    }
  };

  const confirmCloseDrawer = async (amount: number, note: string) => {
    if (!drawerActive) return;
    setDrawerBusy(true);
    setDrawerError(null);
    try {
      await closeDrawerSession(drawerActive.id, round2(amount), note);
      setDrawerDialog(null);
      await loadDrawer();
    } catch (e: unknown) {
      setDrawerError(drawerErrText(e));
    } finally {
      setDrawerBusy(false);
    }
  };

  const confirmRecordMovement = async (kind: 'payout' | 'drop', amount: number, reason: string) => {
    if (!drawerActive) return;
    setDrawerBusy(true);
    setDrawerError(null);
    try {
      await recordDrawerMovement(drawerActive.id, kind, amount, reason);
      setMoveDialog(false);
      await loadDrawer();
    } catch (e: unknown) {
      setDrawerError(drawerErrText(e));
    } finally {
      setDrawerBusy(false);
    }
  };

  /* live mirror for the "Right now" strip (today only) — 20s while open */
  useEffect(() => {
    if (!isToday) return;
    const t = setInterval(() => void load(), 20000);
    return () => clearInterval(t);
  }, [isToday, load]);

  /* v5.263.0 — the wake: the close-out wakes when the owner does. The 20s
   * heartbeats clamp or pause in a background tab — the owner who comes
   * back could read stale numbers (or a stale drawer state: a drawer
   * opened or closed while away). The wake rides the page's own TWO paths
   * (load — the day's numbers; loadDrawer — the drawer's state, whose
   * EXISTENCE is itself a fact that can change while away; no second
   * fetch path exists) the moment they look, guarded on visible, cleaned
   * up on unmount. */
  useEffect(() => {
    const wake = () => {
      if (document.visibilityState !== 'visible') return;
      void load();
      void loadDrawer();
    };
    document.addEventListener('visibilitychange', wake);
    return () => document.removeEventListener('visibilitychange', wake);
  }, [load, loadDrawer]);

  /* ── aggregates ── */
  const agg = useMemo(() => {
    const live = orders.filter((o) => o.status !== 'cancelled');
    const cancelled = orders.length - live.length;
    const gross = live.reduce((s, o) => s + Number(o.total || 0), 0);
    const gst = live.reduce((s, o) => s + Number(o.tax_amount || 0), 0);
    const paid = payments.reduce((s, p) => s + Number(p.amount || 0), 0);
    // ledger sums per ticket — the split-aware base (v5.66.0): a ticket
    // mid-split owes only its BALANCE, not the phantom whole. paid + unpaid
    // now reconcile against gross even mid-split.
    const ledgerByOrder = new Map<string, number>();
    payments.forEach((p) =>
      ledgerByOrder.set(p.order_id, (ledgerByOrder.get(p.order_id) || 0) + Number(p.amount || 0)),
    );
    const unpaidOrders = live.filter((o) => o.payment_status !== 'completed');
    const unpaidAmt = unpaidOrders.reduce(
      (s, o) => s + Math.max(0, Number(o.total || 0) - (ledgerByOrder.get(o.id) || 0)),
      0,
    );
    const splitOpen = unpaidOrders.filter((o) => (ledgerByOrder.get(o.id) || 0) > 0).length;
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

    // ── the day's generosity (v5.192.0): the money the offers gave away —
    // the live tickets' own discount_amount, ONE source (the orders the Z
    // already counts — the floor block's doctrine, no extra read to trust).
    // Cancelled tickets stay silent (they never happened — the bills CSV's
    // own rule); a d ≤ 0 row is no offer, not a rounding ghost.
    let offerRupees = 0;
    let offerTickets = 0;
    for (const o of live) {
      const d = Number(o.discount_amount ?? 0);
      if (d > 0) {
        offerRupees += d;
        offerTickets += 1;
      }
    }

    return {
      live,
      cancelled,
      gross,
      gst,
      paid,
      unpaidOrders,
      unpaidAmt,
      splitOpen,
      ledgerByOrder,
      avg,
      mix,
      orphanPaid,
      dayCogs,
      paidCogs,
      paidNet,
      margin,
      paidTickets,
      offerRupees,
      offerTickets,
    };
  }, [orders, payments, cogsRows]);

  /* ── the bin (v5.79.0): the day's waste in rupees, the 5.77 truth ──
   *  Same honesty as Reports' bin's bill: value = |qty| × cost on file; a
   *  move with no cost on file is UNVALUED — counted as nothing, never a
   *  guessed rupee. Deliveries (stock IN) and corrections never fed it. */
  const wasteDay = useMemo(() => {
    if (!wasteMoves) return null;
    let rupees = 0;
    let unvalued = 0;
    const byItem = new Map<string, { name: string; rupees: number; qty: number; unit: string }>();
    for (const m of wasteMoves) {
      const cost = m.inventory_items?.cost_per_unit;
      const it = m.inventory_items;
      if (cost == null) {
        unvalued += 1;
        continue;
      }
      const value = Math.abs(Number(m.qty)) * Number(cost);
      rupees += value;
      const cur = byItem.get(m.inventory_item_id) || {
        name: it?.name || '—',
        rupees: 0,
        qty: 0,
        unit: it?.unit || '',
      };
      cur.rupees += value;
      cur.qty += Math.abs(Number(m.qty));
      byItem.set(m.inventory_item_id, cur);
    }
    const top =
      [...byItem.values()].sort((a, b) => b.rupees - a.rupees || a.name.localeCompare(b.name))[0] ||
      null;
    return { rupees, moves: wasteMoves.length, unvalued, top };
  }, [wasteMoves]);

  /* ── the floor (v5.83.0): the day's no-shows, from the book ──
   *  null = the book never loaded (the whisper stays off — silence, not a
   *  guessed zero); a number = no_show bookings whose slot fell on THIS
   *  IST day. Cancelled/seated/booked never count. */
  const noShowDay = useMemo(() => {
    if (!reservations) return null;
    const { startIso, endIso } = istDayBounds(dateIso);
    return reservations.filter((r) => r.status === 'no_show' && r.slot_at >= startIso && r.slot_at < endIso).length;
  }, [reservations, dateIso]);

  /* ── the floor (v5.224.0): the day's quiet debt — booked promises whose
   *  hour passed and were never resolved (still 'booked' in the ledger;
   *  the no-show row counts what the book RECORDED, this counts what the
   *  book never answered). The SAME istDayBounds as the no-show read —
   *  one day grammar in this surface. Silent when the book never loaded
   *  or the debt is zero — never a guessed zero. */
  const quietDay = useMemo(() => {
    if (!reservations) return null;
    const { startIso, endIso } = istDayBounds(dateIso);
    const nowMs = Date.now();
    return reservations.filter(
      (r) =>
        r.status === 'booked' &&
        r.slot_at >= startIso &&
        r.slot_at < endIso &&
        new Date(r.slot_at).getTime() < nowMs,
    ).length;
  }, [reservations, dateIso]);

  /* ── the floor (v5.83.0): the day's rounds — the close sees the floor ──
   *  A round is a non-cancelled ticket that HELD a table (table_id set) —
   *  the same ledger rule the floor rhythm chart reads. Walk-in counter
   *  tickets don't hold a table, so they stay out — the strip is about the
   *  floor, and it says so in its footer. Busiest table: rupees → rounds →
   *  name, the house deterministic tie-break. */
  const floorDay = useMemo(() => {
    const rounds = orders.filter((o) => o.table_id && o.status !== 'cancelled');
    let rupees = 0;
    const byTable = new Map<string, { label: string; rupees: number; rounds: number }>();
    for (const o of rounds) {
      const amt = Number(o.total ?? 0);
      rupees += amt;
      const cur = byTable.get(o.table_id!) || { label: o.table_label || 'Table', rupees: 0, rounds: 0 };
      cur.rupees += amt;
      cur.rounds += 1;
      byTable.set(o.table_id!, cur);
    }
    const busiest =
      [...byTable.values()].sort(
        (a, b) => b.rupees - a.rupees || b.rounds - a.rounds || a.label.localeCompare(b.label),
      )[0] || null;
    return {
      rounds: rounds.length,
      rupees,
      busiest: busiest
        ? `${busiest.label} · ${busiest.rounds} ${busiest.rounds === 1 ? 'round' : 'rounds'} · ${formatMoney(busiest.rupees)}`
        : null,
    };
  }, [orders]);

  /* v5.260.0 — the day's voice, in the family's own arithmetic: guestVoice
   * (lib/verdict) does the counting and the tone — no local fork of the ONE
   * law. null stays null (the read never landed — no card, no block); an
   * honest zero becomes count 0 so the summary card and the Z can speak
   * the floor's own silence word. low is the bell's own number: the
   * ratings the 030 trigger rang for (2 or below). */
  const voice = useMemo(() => {
    if (voiceRows === null) return null;
    const v = guestVoice(voiceRows);
    return {
      count: voiceRows.length,
      avg: v ? v.avg : 0,
      word: v ? v.tone.word : '',
      tone: v ? v.tone : null,
      low: voiceRows.filter((r) => Number(r.rating) <= 2).length,
    };
  }, [voiceRows]);

  /* right-now strip (today) */
  const now = useMemo(() => {
    /* v5.230.0 — ONE SET, NO FORK (the 5.196 law, Close-out edition): the
     * tile counted only ['pending','preparing'] while the rail's own
     * answer is isOnRail's THREE stages — a ticket waiting on the pass
     * (ready) was invisible on the closing checklist: the owner closed
     * thinking the board was clear while cooked food sat unserved. The
     * Dashboard's kitchen card already read isOnRail (5.196's own fix);
     * this tile now quotes the same register — two surfaces, one set,
     * one number. */
    const inKitchen = orders.filter((o) => isOnRail(String(o.status))).length;
    const latePrep = orders.filter((o) => {
      if (o.status !== 'preparing') return false;
      return Date.now() - new Date(o.created_at).getTime() >= LATE_PREP_MIN * 60000;
    }).length;
    return { inKitchen, latePrep, unpaid: agg.unpaidOrders.length, unpaidAmt: agg.unpaidAmt };
  }, [orders, agg]);

  /* ── section mix (v5.21.0): per-category item totals over LIVE tickets ──
   *  The Z-report's oldest parked ask — an owner reconciles by section
   *  (Coffee / Bakery / Food), not just by payment method. Guest-added or
   *  de-listed lines bucket honestly under "Unlisted" instead of vanishing. */
  const sectionMix = useMemo(() => {
    const liveIds = new Set(agg.live.map((o) => o.id));
    const map = new Map<string, { amount: number; units: number }>();
    let base = 0;
    for (const r of sectionRows) {
      if (!liveIds.has(r.order_id)) continue;
      const key = r.category ?? 'Unlisted';
      const cur = map.get(key) || { amount: 0, units: 0 };
      cur.amount += r.item_total;
      cur.units += r.qty;
      map.set(key, cur);
      base += r.item_total;
    }
    const rows = [...map.entries()]
      .map(([name, v]) => ({ name, ...v, pct: base > 0 ? Math.round((v.amount / base) * 100) : 0 }))
      .sort((a, b) => b.amount - a.amount);
    return { rows, base };
  }, [sectionRows, agg]);

  const buildZOpts = (): ZReportOpts => {
    /* CASH DRAWER block — only when a shift actually touches this day.
       Open shift: float + ledger cash-in → expected (marked as such, never
       counted). Sealed shifts CLOSED today: stored counted/variance. */
    /* v5.180.0 — the day's shifts: every shift the day CLOSED speaks, not
       just the first the ledger hands back (the .find() era), and an open
       shift no longer excludes the sealed ones (the if/else was exclusive).
       Chronological, oldest first; the ONE builder feeds print + chat twin. */
    const drawerBounds = istDayBounds(dateIso);
    const dayShifts = drawerHistory.filter(
      (h) => h.closed_at && h.closed_at >= drawerBounds.startIso && h.closed_at < drawerBounds.endIso,
    );
    // chronological order is the BUILDER's property (unit219) — hand the
    // day's slice verbatim, ledger order untouched
    const drawer = buildZDrawerRows(
      dayShifts,
      drawerActive
        ? {
            opened_at: drawerActive.opened_at,
            opened_by_email: drawerActive.opened_by_email,
            opening_float: Number(drawerActive.opening_float),
            cashIn,
            moveSum,
          }
        : null,
      formatMoney,
      (iso) => `${dayTime(iso, appTimezone())} ${appTzTag()}`,
    );
    return {
      storeName: tenant?.name || 'ServePoint store',
      dateIso,
      orders: agg.live.length,
      gross: agg.gross,
      paid: agg.paid,
      unpaid: agg.unpaidAmt,
      unpaidTickets: agg.unpaidOrders.length,
      splitOpen: agg.splitOpen,
      gst: agg.gst,
      cogs: agg.paidCogs,
      margin: agg.margin,
      mix: agg.mix,
      sections: sectionMix.rows.length > 0 ? sectionMix.rows : null,
      cancelled: agg.cancelled,
      printedBy: session?.email || '',
      offers: { rupees: agg.offerRupees, tickets: agg.offerTickets },
      drawer,
      waste: wasteDay
        ? {
            rupees: wasteDay.rupees,
            moves: wasteDay.moves,
            top: wasteDay.top
              ? `${wasteDay.top.name} · ${wasteDay.top.qty} ${wasteDay.top.unit} · ${formatMoney(wasteDay.top.rupees)}`
              : null,
          }
        : undefined,
      floor: {
        rounds: floorDay.rounds,
        rupees: floorDay.rupees,
        busiest: floorDay.busiest,
        noShows: noShowDay,
        wentQuiet: quietDay,
      },
      guests:
        voice === null
          ? undefined
          : {
              count: voice.count,
              avg: voice.count > 0 ? Math.round(voice.avg * 10) / 10 : 0,
              word: voice.word,
              low: voice.low,
            },
    };
  };
  const printReport = () => {
    printZReport(buildZOpts());
  };

  /* v5.146.0 — the Z's chat voice: the SAME opts the thermal print consumes,
   * rendered by buildZReportText for Copy / WhatsApp. Inline honest feedback
   * (no toast system in the house): "Copied" for a breath, "Copy blocked"
   * when the clipboard refuses (insecure context / permission denial).
   * v5.277.0 — the ack rides the one home (lib/useCopyAck). */
  const [zCopyState, runZCopy] = useCopyAck();
  const copyZReport = () => runZCopy(buildZReportText(buildZOpts()));

  /* ── day-ledger CSV — the accountant's twin of the printed z-report.
     One row per ticket, exactly the loaded day's orders (nothing fetched,
     nothing rounded): split payments join their methods, COGS rides along
     from the 018 view so margin can be recomputed in the spreadsheet.
     v5.192.0 — the rows build through dayLedgerCsvRows (exported pure),
     the Discount column reconciling against the Z's Offers-given line. */
  const exportDayCsv = () => {
    downloadCsv(`servepoint-closeout-${dateIso}.csv`, dayLedgerCsvRows({ orders, payments, cogsRows }));
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
      {/* ── screen head — every screen wears an h1; Close-out was the last
          one without (heading hierarchy jumped straight to h2 sections) ── */}
      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#EAF0EC] text-[#0F3D3E]">
          <MoonStar size={17} aria-hidden />
        </span>
        <div className="min-w-0">
          <h1 className="sp-screen-title">Close-out</h1>
          <p className="truncate text-[11.5px] text-[#6B6B6B]">
            The day, counted — sales, drawer and the z-report
          </p>
        </div>
      </div>

      {/* ── day stepper ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
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
          {/* v5.237.0 — the day jump: the stepper walked one day per click,
              so an owner reconciling last month paid a click and a load per
              day. The input writes through THE one setDateIso — the same
              path the arrows and Today already ask — so the load effect's
              (tenantId, dateIso) stays the only engine; the big label and
              the input read the SAME dateIso, one clock by construction.
              max=today is the ceiling the Next arrow already honors; an
              empty day answers with the ledger's honest MoonStar voice.
              The ink is the Reports calendar row's own (5.236) — one house
              ink for every date box. Wraps under the arrows on narrow
              screens instead of overflowing them. */}
          <label className="flex items-center gap-1.5 pl-1 text-[11.5px] font-semibold text-[#6B6B6B]">
            Jump to
            <input
              type="date"
              value={dateIso}
              max={istTodayIso()}
              onChange={(e) => { const v = e.target.value; if (v) setDateIso(v); }}
              aria-label="Jump straight to a day's book"
              className="sp-input h-9 rounded-xl border border-[#E3E7E0] bg-white px-2.5 text-[12.5px] font-semibold text-[#1A1A1A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#967221]"
            />
          </label>
        </div>

        <div className="flex items-center gap-2">
          {refreshedAt ? (
            <span className="hidden text-[11px] font-semibold text-[#8A938C] sm:inline" title="Last refreshed">
              as of {istTime(refreshedAt.toISOString())} {appTzTag()}
            </span>
          ) : null}
          <button
            onClick={() => void load()}
            className="flex h-[44px] w-[44px] items-center justify-center rounded-xl border border-[#E3E7E0] bg-white text-[#0F3D3E] transition-colors hover:bg-[#F0F2EF]"
            aria-label="Refresh"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          <CsvExportButton
            saved={closeSaved}
            onExport={() => flashClose(exportDayCsv)}
            disabled={loading || orders.length === 0}
            idleAria="Export the day's ledger as CSV"
            savedAria="Closeout exported — the CSV file is saved"
            title="One row per ticket — the day's ledger for the spreadsheet"
            geometry="flex min-h-[44px] items-center gap-2 rounded-xl border px-4 text-[13px] font-extrabold"
            earSize={15}
          />
          <button
            onClick={printReport}
            disabled={loading || orders.length === 0}
            className="flex min-h-[44px] items-center gap-2 rounded-xl bg-[#B88E2F] px-4 text-[13px] font-extrabold text-white shadow-[0_1px_2px_rgba(15,61,62,0.15)] transition-colors hover:bg-[#A57D27] disabled:opacity-40"
          >
            <Printer size={15} aria-hidden />
            Print z-report
          </button>
        </div>
        {/* v5.146.0 — the Z's chat voice: the day summary rides in the
            owner's pocket. Same ghost-gold grammar as the bill's share row
            (5.145.0); the WhatsApp link opens the share picker (a day
            summary goes where the OWNER sends it — their own chat, their
            partners' group — never a guessed recipient). */}
        {orders.length > 0 && !loading && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              onClick={copyZReport}
              aria-live="polite"
              className="flex min-h-[38px] items-center gap-1.5 rounded-xl border border-[#E3E7E0] bg-white px-3.5 text-[12px] font-semibold text-[#0F3D3E] transition hover:border-[#0F3D3E]/40 hover:bg-[#F6F5F2] active:scale-[0.99]"
            >
              {zCopyState === 'ok' ? (
                <Check size={14} className="text-[#2E7D32]" aria-hidden />
              ) : zCopyState === 'fail' ? (
                <AlertTriangle size={14} className="text-[#8A5A00]" aria-hidden />
              ) : (
                <Copy size={14} aria-hidden />
              )}
              {ackWord(zCopyState, 'Copy report')}
            </button>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(buildZReportText(buildZOpts()))}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-[38px] items-center gap-1.5 rounded-xl border border-[#E3E7E0] bg-white px-3.5 text-[12px] font-semibold text-[#0F3D3E] transition hover:border-[#0F3D3E]/40 hover:bg-[#F6F5F2] active:scale-[0.99]"
            >
              <MessageCircle size={14} aria-hidden />
              WhatsApp
            </a>
          </div>
        )}
      </div>

      {/* ── right now (today only) — v5.44.0: a real count earns its door.
           The mirror walks you to the room: kitchen counts open the KDS,
           unpaid opens Bills PRE-FILTERED to money still out (sectionHint
           'unpaid' — the arrival is the context). Zero means zero: no door. ── */}
      {isToday ? (
        <section
          aria-label="Right now"
          className="flex flex-wrap gap-3 rounded-2xl border border-[#F0E4C3] bg-gradient-to-r from-[#FDF6E3] to-white p-4"
        >
          <div className="flex min-w-[150px] flex-1 items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EAF2F7] text-[#1D5D7E]">
              <Flame size={18} aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-[#8A938C]">In the kitchen</p>
              <p className="text-[16px] font-extrabold leading-tight tabular-nums text-[#0F3D3E]">
                {now.inKitchen} {now.inKitchen === 1 ? 'ticket' : 'tickets'}
              </p>
              {/* v5.230.0 — the stranded whisper (the unpaid tile's own
               * grammar — one whisper voice per strip): the board can be
               * clear of TODAY's work while older tickets still wait off
               * today's book. The Dashboard names them; the closing
               * checklist names them too. */}
              {staleKitchen > 0 && (
                <p className="mt-0.5 flex items-center gap-1 text-[10.5px] font-semibold text-[#8A5A00]">
                  <History size={11} aria-hidden />
                  {staleKitchen} older stuck {staleKitchen === 1 ? 'ticket' : 'tickets'} off today's board — see Bills
                </p>
              )}
            </div>
            {/* v5.230.0 — the door follows the truth (the 5.89/5.185
             * doctrine, closing-checklist edition): the Kitchen when the
             * board holds today's work, Bills when only the ghosts remain
             * — an "Open Kitchen — 0 tickets" door walks the owner to an
             * empty board while the stranded tickets it counted wait in
             * Bills' ghost view ('stuck' — the one population the census
             * above and isGhostTicket both answer). */}
            {now.inKitchen > 0 ? (
              <LiveDoorChip
                label="Kitchen"
                aria={`Open Kitchen — ${now.inKitchen} ${now.inKitchen === 1 ? 'ticket is' : 'tickets are'} on the board right now`}
                onOpen={() => goSection('kitchen', ['Close-out', 'Kitchen'])}
              />
            ) : staleKitchen > 0 ? (
              <LiveDoorChip
                label="Bills"
                aria={`Open Bills — ${staleKitchen} older ${staleKitchen === 1 ? 'ticket waits' : 'tickets wait'} off today's board`}
                onOpen={() => goSection('bills', ['Close-out', 'Bills'], 'stuck')}
              />
            ) : null}
          </div>
          <div className="flex min-w-[150px] flex-1 items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FFF4DB] text-[#8A5A00]">
              <Wallet size={18} aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              {/* 5.93.0 — the card says which day it counts: the day's book
                  speaks its own window, never "right now" for what is only
                  today. */}
              <p className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-[#8A938C]">
                {isToday ? 'Unpaid today' : 'Unpaid that day'}
              </p>
              <p className="text-[16px] font-extrabold leading-tight tabular-nums text-[#8A5A00]">
                {now.unpaid} · {formatMoney(now.unpaidAmt)}
              </p>
              {isToday && olderUnpaid > 0 && (
                <p className="mt-0.5 flex items-center gap-1 text-[10.5px] font-semibold text-[#8A5A00]">
                  <History size={11} aria-hidden />
                  {olderUnpaid} older unpaid off today's book — see Bills
                </p>
              )}
            </div>
            {/* 5.93.0 — the door follows the truth (the strip's 5.89.0 rule):
                today's unpaid can be zero while older unpaid still wait — the
                whisper points at Bills, so the door must open Bills. */}
            {(now.unpaid > 0 || olderUnpaid > 0) && (
              <LiveDoorChip
                label="Bills"
                aria={`Open Bills — ${now.unpaid} unpaid ${now.unpaid === 1 ? 'ticket' : 'tickets'}, ${formatMoney(now.unpaidAmt)} still out${olderUnpaid > 0 ? `, ${olderUnpaid} older unpaid from earlier days` : ''}`}
                onOpen={() => goSection('bills', ['Close-out', 'Bills'], 'unpaid')}
              />
            )}
          </div>
          <div className="flex min-w-[150px] flex-1 items-center gap-3">
            <span
              className={`flex h-10 w-10 items-center justify-center rounded-xl ${now.latePrep > 0 ? 'bg-[#FCEBEA] text-[#B3261E]' : 'bg-[#EAF0EC] text-[#2E7D32]'}`}
            >
              <Clock size={18} aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-[#8A938C]">Late prep</p>
              <p
                className={`text-[16px] font-extrabold leading-tight tabular-nums ${now.latePrep > 0 ? 'text-[#B3261E]' : 'text-[#2E7D32]'}`}
              >
                {now.latePrep} <span className="text-[11px] font-bold text-[#8A938C]">over {LATE_PREP_MIN} min</span>
              </p>
            </div>
            {now.latePrep > 0 && (
              <LiveDoorChip
                label="Kitchen"
                aria={`Open Kitchen — ${now.latePrep} ${now.latePrep === 1 ? 'ticket is' : 'tickets are'} past the ${LATE_PREP_MIN}-minute SLA; oldest waits first`}
                onOpen={() => goSection('kitchen', ['Close-out', 'Kitchen'])}
              />
            )}
          </div>
        </section>
      ) : null}

      {/* ── cash drawer (today only — the shift is a now thing) ── */}
      {isToday ? (
        <DrawerCard
          active={drawerActive}
          history={drawerHistory}
          cashIn={cashIn}
          cashLoading={cashLoading}
          movements={movements}
          onOpenFlow={() => {
            setDrawerError(null);
            setDrawerDialog('open');
          }}
          onCloseFlow={() => {
            setDrawerError(null);
            setDrawerDialog('close');
          }}
          onRecordMovement={() => {
            setDrawerError(null);
            setMoveDialog(true);
          }}
        />
      ) : null}

      {drawerError ? (
        <div
          className="flex items-center gap-2.5 rounded-xl border border-[#F2D9D6] bg-[#FCEBEA] px-3.5 py-2.5"
          role="alert"
        >
          <AlertTriangle size={15} className="shrink-0 text-[#B3261E]" aria-hidden />
          <p className="text-[12px] font-semibold text-[#7A2E28]">{drawerError}</p>
        </div>
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
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-[86px] animate-pulse rounded-2xl border border-[#E3E7E0] bg-white" />
          ))}
        </div>
      ) : (
        <>
          {/* ── day summary ── */}
          <section aria-label="Day summary" className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            <StatCard
              label="Orders"
              value={String(agg.live.length)}
              sub={agg.cancelled > 0 ? `${agg.cancelled} cancelled` : 'live day count'}
            />
            <StatCard
              label="Gross"
              value={formatMoney(agg.gross)}
              sub={`GST ${formatMoney(agg.gst)}`}
              whisper={
                agg.offerTickets > 0 ? (
                  <span
                    className="inline-flex items-center gap-1 text-[10.5px] font-bold text-[#8A6D1F]"
                    title="The money the offers gave away — gross is already net of these discounts; the z-report names the line (Offers given)"
                  >
                    <Tag size={11} aria-hidden />
                    {formatMoney(agg.offerRupees)} given in offers · {agg.offerTickets}{' '}
                    {agg.offerTickets === 1 ? 'ticket' : 'tickets'}
                  </span>
                ) : undefined
              }
            />
            <StatCard label="Paid" value={formatMoney(agg.paid)} tone="green" sub="payments taken" />
            <StatCard
              label="Unpaid"
              value={formatMoney(agg.unpaidAmt)}
              tone={agg.unpaidAmt > 0 ? 'gold' : 'teal'}
              sub={`${agg.unpaidOrders.length} ${agg.unpaidOrders.length === 1 ? 'ticket' : 'tickets'} due`}
              whisper={
                agg.splitOpen > 0 ? (
                  <span
                    className="inline-flex items-center gap-1 text-[10.5px] font-bold text-[#8A6D1F]"
                    title="Split tickets count their balance, not the whole — the ledger is the truth"
                  >
                    <Split size={11} aria-hidden />
                    {agg.splitOpen} {agg.splitOpen === 1 ? 'ticket' : 'tickets'} settled in parts — the count reads balances
                  </span>
                ) : undefined
              }
            />
            <StatCard label="Avg ticket" value={formatMoney(agg.avg)} sub="gross ÷ orders" />
            {voice && (
              /* v5.260.0 — the close hears the voice: the summary's sixth card
                 speaks the day's verdict through the ONE tone law — the
                 value wears the tone's own ink (StatCard's toneMap carries
                 the family's exact hexes: loved #2E7D32, good #8A5A00,
                 listen up #B3261E), the sub the count and the word, and the
                 bell's own number rides the whisper when it rang (2 or
                 below — fn_notify_low_rating's line). Unread (null) renders
                 no card — the close never claims a quiet day it didn't
                 verify; an honest zero shows '—' with 'no ratings today'. */
              <StatCard
                label="Guest voice"
                value={voice.count > 0 ? voice.avg.toFixed(1) : '—'}
                tone={voice.count === 0 ? 'teal' : voice.tone!.color === '#2E7D32' ? 'green' : voice.tone!.color === '#8A5A00' ? 'gold' : 'red'}
                sub={
                  voice.count > 0
                    ? `${voice.count} rating${voice.count === 1 ? '' : 's'} · ${voice.word}`
                    : 'no ratings today'
                }
                whisper={
                  voice.low > 0 ? (
                    <span
                      className="inline-flex items-center gap-1 text-[10.5px] font-bold text-[#B3261E]"
                      title="Ratings of 2 stars or below — the notifications bell rang for each of these today"
                    >
                      <CircleAlert size={11} aria-hidden />
                      {voice.low} rated 2★ or below — worth a call-back
                    </span>
                  ) : undefined
                }
              />
            )}
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

            {/* ── 5.79.0 — the close sees the bin: the day's waste strip ── */}
            {wasteDay && (
              <div
                className={`col-span-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-xl border px-4 py-2.5 md:col-span-4 ${
                  wasteDay.moves === 0
                    ? 'border-[#E3E7E0] bg-[#F7F8F6]'
                    : 'border-[#F0DCD7] bg-[#FDF6F4]'
                }`}
                aria-label="The bin today"
              >
                {wasteDay.moves === 0 ? (
                  <span className="text-[11.5px] font-semibold text-[#8A938C]">
                    The bin took nothing today — the shelf's honest day.
                  </span>
                ) : (
                  <>
                    <span className="flex items-center gap-2 text-[12px] font-bold text-[#B3261E]">
                      <Trash2 size={13} aria-hidden className="text-[#B3261E]" />
                      The bin took {formatMoney(wasteDay.rupees)}
                      <span className="rounded-full bg-[#FBEAE7] px-2 py-0.5 text-[10.5px] font-bold tabular-nums text-[#B3261E]">
                        {wasteDay.moves} {wasteDay.moves === 1 ? 'move' : 'moves'}
                      </span>
                    </span>
                    {wasteDay.top && (
                      <span className="text-[11.5px] font-semibold tabular-nums text-[#8A5A00]">
                        heaviest: {wasteDay.top.name} — {wasteDay.top.qty} {wasteDay.top.unit} ·{' '}
                        {formatMoney(wasteDay.top.rupees)}
                      </span>
                    )}
                    {wasteDay.unvalued > 0 && (
                      <span className="text-[10.5px] font-medium text-[#969696]">
                        {wasteDay.unvalued} {wasteDay.unvalued === 1 ? 'move' : 'moves'} with no cost
                        on file — counted as nothing, not guessed
                      </span>
                    )}
                    <span className="text-[10.5px] text-[#969696]">
                      spoilage · spills · damage — deliveries and corrections never fed the bin
                    </span>
                  </>
                )}
              </div>
            )}

            {/* ── 5.83.0 — the close sees the floor: the day's rounds strip ── */}
            <div
              className={`col-span-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-xl border px-4 py-2.5 md:col-span-4 ${
                floorDay.rounds === 0
                  ? 'border-[#E3E7E0] bg-[#F7F8F6]'
                  : 'border-[#D5E2D8] bg-[#F3F8F4]'
              }`}
              aria-label="The floor today"
            >
              {floorDay.rounds === 0 ? (
                <span className="text-[11.5px] font-semibold text-[#8A938C]">
                  The floor sat quiet — no table rounds to close out.
                </span>
              ) : (
                <>
                  <span className="flex items-center gap-2 text-[12px] font-bold text-[#0F3D3E]">
                    <Armchair size={13} aria-hidden className="text-[#2E7D32]" />
                    The floor served {floorDay.rounds} {floorDay.rounds === 1 ? 'round' : 'rounds'}
                    <span className="rounded-full bg-[#E3EFE5] px-2 py-0.5 text-[10.5px] font-bold tabular-nums text-[#2E7D32]">
                      {formatMoney(floorDay.rupees)}
                    </span>
                  </span>
                  {floorDay.busiest && (
                    <span className="text-[11.5px] font-semibold tabular-nums text-[#1D5D7E]">
                      busiest: {floorDay.busiest}
                    </span>
                  )}
                  {noShowDay !== null && noShowDay > 0 && (
                    <span
                      className="text-[10.5px] font-semibold text-[#8A5A00]"
                      title="Bookings whose slot fell on this day and were marked no-show in the book"
                    >
                      {noShowDay} {noShowDay === 1 ? 'booking' : 'bookings'} didn't show
                    </span>
                  )}
                  <span className="text-[10.5px] text-[#969696]">
                    table tickets only — walk-in counter rounds never held a table
                  </span>
                </>
              )}
              {/* v5.224.0 — the book's unanswered hour, in BOTH branches: a
                  zero-rounds day can still carry quiet debt (the host never
                  resolved the promise). The convict-free grey — the book's
                  own words, the no-show whisper's neighbour. */}
              {quietDay !== null && quietDay > 0 && (
                <span
                  className="text-[10.5px] font-semibold text-[#6B6B6B]"
                  title="Booked promises whose hour passed on this day and were never resolved — still booked; the clock does not convict."
                >
                  {quietDay} {quietDay === 1 ? 'promise' : 'promises'} went quiet
                </span>
              )}
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

          {/* ── section mix (v5.21.0) — per-category item totals ── */}
          {sectionMix.rows.length > 0 && (
            <section aria-label="Section mix" className="rounded-2xl border border-[#E3E7E0] bg-white p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                {/* v5.237.0 — the a11y name joins its sentence: a newline
                    between JSX text and a span glues the accessible name
                    ("SECTION MIX· what sold"), while the Ledger sibling
                    (same screen, inline space + ml-1) speaks with a space.
                    One dialect now: inline space + ml-1 — visual bytes
                    near-identical, the name whole. */}
                <h2 className="text-[13px] font-extrabold uppercase tracking-[0.06em] text-[#0F3D3E]">
                  Section mix{' '}
                  <span className="ml-1 font-bold normal-case text-[#8A938C]">· what sold, by menu section</span>
                </h2>
                <span className="text-[10.5px] font-semibold text-[#8A938C]">ex-GST · live tickets</span>
              </div>
              <div className="mt-3 flex flex-col gap-2.5">
                {sectionMix.rows.map((s, i) => (
                  <div key={s.name} className="flex items-center gap-3">
                    <span
                      className="w-16 shrink-0 truncate text-[11px] font-extrabold uppercase tracking-wide text-[#5F6B63]"
                      title={s.name}
                    >
                      {s.name}
                    </span>
                    <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-[#F0F2EF]">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${Math.max(s.pct, 4)}%`,
                          backgroundColor: SECTION_TONES[i % SECTION_TONES.length],
                        }}
                      />
                    </div>
                    <span className="w-9 text-right text-[10.5px] font-bold tabular-nums text-[#8A938C]">
                      {s.units}u
                    </span>
                    <span className="w-24 text-right text-[13px] font-extrabold tabular-nums text-[#0F3D3E]">
                      {formatMoney(s.amount)}
                    </span>
                    <span className="w-10 text-right text-[11px] font-bold tabular-nums text-[#8A938C]">
                      {s.pct}%
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-2.5 text-[10px] text-[#969696]">
                Sections sum to the ex-GST item base {formatMoney(sectionMix.base)}; GST and any
                order-level discounts sit on top and are not re-apportioned per item. Printed on
                the z-report as SECTIONS.
              </p>
            </section>
          )}

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
                          <PayChip order={o} paidIn={agg.ledgerByOrder.get(o.id) || 0} />
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

      {/* ── drawer dialog (open float / count & close) ── */}
      {drawerDialog ? (
        <DrawerDialog
          mode={drawerDialog}
          active={drawerActive}
          cashIn={cashIn}
          moveOut={moveSum}
          busy={drawerBusy}
          onCancel={() => setDrawerDialog(null)}
          onConfirm={(amount, note) =>
            void (drawerDialog === 'open' ? confirmOpenDrawer(amount) : confirmCloseDrawer(amount, note))
          }
        />
      ) : null}

      {/* ── movement dialog (payout / safe drop) ── */}
      {moveDialog ? (
        <MovementDialog
          busy={drawerBusy}
          onCancel={() => setMoveDialog(false)}
          onConfirm={(kind, amount, reason) => void confirmRecordMovement(kind, amount, reason)}
        />
      ) : null}
    </div>
  );
};

/** EodScreen — remountable wrapper so the tenant hook can be retried. */
export const EodScreen: React.FC = () => {
  const [attempt, setAttempt] = useState(0);
  /* 5.97.0 — the owner's timezone word takes effect live: a Settings save
     re-opens the day book in the chosen day. */
  useEffect(() => subscribePrefs(() => setAttempt((a) => a + 1)), []);
  return <EodScreenInner key={attempt} onTenantRetry={() => setAttempt((a) => a + 1)} />;
};
