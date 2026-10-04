import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ArrowRight,
  BadgePercent,
  CalendarRange,
  Check,
  CheckCircle2,
  Clock,
  Coins,
  Copy,
  Download,
  Flame,
  HandCoins,
  HeartHandshake,
  MessageCircle,
  Minus,
  MousePointerClick,
  Printer,
  QrCode,
  Quote,
  RefreshCw,
  ShoppingBag,
  Split,
  Star,
  Timer,
  Trash2,
  TrendingDown,
  TrendingUp,
  UtensilsCrossed,
  Wallet,
} from 'lucide-react';
import {
  fetchDrawerHistory,
  fetchFeedbackRows,
  fetchItemUnitCosts,
  fetchOfferRedemptions,
  fetchOrderCogs,
  fetchOrders,
  fetchOffers,
  fetchStatusHopsInRange,
  fetchPaymentsInRange,
  fetchWasteMoves,
} from '../../lib/api';
import type {
  DrawerSession,
  FeedbackRow,
  OfferRedemptionRow,
  ReceiptPayment,
  StatusHop,
  WasteMove,
} from '../../lib/api';
import type { Offer } from '../../types';
import { formatMoney, subscribePrefs } from '../../lib/prefs';
import { downloadCsv } from '../../lib/csv';
import { printHiddenFrame } from '../../lib/printFrame';
import { CHART_TOOLTIP_LABEL, CHART_TOOLTIP_STYLE } from '../../lib/chartvoice';
import {
  appTimezone,
  appTodayIso,
  appDayStartMs,
  appDayEndMs,
  appHour,
  appDayKey,
  appFormatters,
  appTzTag,
} from '../../lib/appday';
import { useTenant } from '../../lib/tenant';
import { useUi } from '../../store/session';
import type { Order } from '../../types';

/**
 * Reports (NOVA — manager reports: sales / items / hours).
 *
 * The Dashboard answers "how is RIGHT NOW?"; Reports answers "where does the
 * business actually stand?" over a real range (Today / 7 days / 30 days /
 * All time, in the reporting day chosen in Settings — Asia/Kolkata by
 * default, like Close-out — via src/lib/appday.ts (5.97.0):
 *
 *   1. Headline strip — gross, GST collected, net (ex-GST), orders (+
 *      cancelled sinkage), average ticket, items sold — each carrying a
 *      "vs prior range" delta chip: the same KPI recomputed over the
 *      equal-length window immediately before the selected one (prior day /
 *      prior 7 / prior 30). All time has no earlier boundary, so it gets no
 *      chips instead of a fake baseline; empty prior windows chip "new".
 *   2. Trends — the shape of the range, day by day (reporting days):
 *      gross bars + ticket line per day with the best day gold, and the
 *      guest-rating average per day as a gold line with honest gaps.
 *   3. Sales by hour — a bar chart of when the day actually earns (reporting hours,
 *      whole range summed). The Dashboard only charts today; this is the trend.
 *   4. Payment mix — how money arrived (cash / UPI / card) + what's still out.
 *   5. Cost & margin — the inventory shelf prices the menu (018 views):
 *      COGS, gross margin and margin-% on PAID tickets, with a revenue-split
 *      bar (what the shelf burned vs what the cafe keeps).
 *   6. Top items — best sellers by revenue with unit counts, share bars and
 *      per-item margin chips, exportable as CSV. Unpriced dishes wear an
 *      honest "unpriced" chip instead of a fake 100% margin. Under the list
 *      sits THE EARNER'S LIST (5.72.0): the same dishes ranked by what they
 *      KEEP (revenue − ingredient cost, recipe-priced dishes only), each row
 *      naming its divergence from the sales board — "earns above its bill"
 *      (a quiet earner worth pushing) vs "sells above its earn" (popular but
 *      thin; review price or recipe). THE MENU'S QUADRANTS (5.73.0) finish
 *      the frame: the priced menu split at its own averages into Stars /
 *      Plowhorses / Puzzles / Dogs, each quadrant speaking its verdict.
 *   7. Service mix — dine-in / takeaway / delivery split.
 *   8. Guest satisfaction — the 019 order_feedback ledger read over the
 *      range: average rating with a health verdict, a spoken star histogram,
 *      the newest guest comments as quotes, exportable as CSV — plus the
 *      rating average per day as a gold trend line (honest gaps on
 *      unrated days).
 *   9. Drawer honesty — the 020 cash_drawer_sessions ledger read over the
 *      range: sealed shifts, net variance (server-stored, never re-derived),
 *      a shift-by-shift diverging variance mini-chart in the exact health
 *      tones, per-shift expected-vs-counted rows with the same voice the
 *      Close-out dialog speaks.
 *
 * The two ledger sections load FAIL-SOFT (Task 53): a hiccup in feedback or
 * drawer reads can never take the sales view down — their sections fall back
 * to honest empty states.
 *
 * Data truth: the orders + order_items tables, aggregated client-side; COGS
 * comes from v_order_cogs / v_item_unit_cost (recipe_lines × current
 * cost_per_unit — no cost-history table, so a restock reprices history; the
 * section says so). Margin is computed on PAID tickets only — margin cannot
 * be banked on money not collected. The window scans at most the most recent
 * 500 tickets (a cafe month) — stated honestly in the footer.
 */

type RangeKey = 'today' | '7d' | '30d' | 'all';

/* ── The reporting day (5.97.0) — the Settings word, kept. Windows, keys,
   hour buckets and the zone tag resolve through src/lib/appday.ts
   (Settings › Language & Region › Timezone); on every Indian device that
   is Asia/Kolkata, so IST numbers here are unchanged to the paisa. ─────── */

/** Calendar-string day shift, DST-safe (noon anchor, v5.83.0's argument). */
function shiftDayIso(days: number): string {
  const d = new Date(`${appTodayIso()}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/* Windows keep the v5.19.0 semantics EXACTLY: "N days" = N calendar days
   ENDING today (today inclusive) — only the midnight math is now DST-safe
   through the lib instead of a +05:30 literal. */
function rangeWindow(range: RangeKey): { startMs: number | null; endMs: number } {
  const endMs = appDayEndMs(appTodayIso()); // end of the reporting day
  if (range === 'all') return { startMs: null, endMs };
  const days = range === 'today' ? 1 : range === '7d' ? 7 : 30;
  return { startMs: appDayStartMs(shiftDayIso(-(days - 1))), endMs };
}

/** The EQUAL-LENGTH window immediately before the current one (v5.19.0) —
 *  the honest baseline for the KPI delta chips. 'all' has no earlier
 *  boundary in the ledger, so it gets NO chips rather than a fake baseline. */
function priorWindow(range: RangeKey): { startMs: number; endMs: number } | null {
  if (range === 'all') return null;
  const { startMs, endMs } = rangeWindow(range);
  const days = range === 'today' ? 1 : range === '7d' ? 7 : 30;
  const start = startMs ?? appDayStartMs(shiftDayIso(-(days - 1)));
  return { startMs: appDayStartMs(shiftDayIso(-(2 * days - 1))), endMs: start };
}

/** Spoken/written name of the comparison baseline. */
function priorRangeLabel(range: RangeKey): string | null {
  if (range === 'all') return null;
  return range === 'today' ? 'prior day' : range === '7d' ? 'prior 7 days' : 'prior 30 days';
}

/** The single money-view aggregation shared by the selected range AND its
 *  prior comparison window (v5.20.0 — one body, so the chips can never drift
 *  from the headline figures they compare against). */
interface RangeAgg {
  gross: number;
  gst: number;
  net: number;
  placed: number;
  cancelled: number;
  items: number;
  avgTicket: number;
  paidNet: number;
  cogs: number;
  margin: number;
  marginPct: number;
  paidCount: number;
}

function aggregateTickets(rows: Order[], cogsMap: Map<string, number>): RangeAgg {
  let gross = 0;
  let gst = 0;
  let net = 0;
  let placed = 0;
  let cancelled = 0;
  let items = 0;
  let paidNet = 0;
  let cogs = 0;
  let paidCount = 0;
  for (const o of rows) {
    const st = String(o.status || '').toLowerCase();
    if (st === 'cancelled') {
      cancelled += 1;
      continue; // money view skips cancelled entirely
    }
    placed += 1;
    gross += Number(o.total ?? 0);
    gst += Number(o.tax_amount ?? 0);
    net += Number(o.subtotal ?? 0) - Number(o.discount_amount ?? 0);
    items += (o.items || []).reduce((n, it) => n + Number(it.qty ?? 0), 0);
    // margin banks on COLLECTED money only
    if (String(o.payment_status || '').toLowerCase() === 'completed') {
      paidCount += 1;
      paidNet += Number(o.subtotal ?? 0) - Number(o.discount_amount ?? 0);
      cogs += cogsMap.get(o.id) ?? 0;
    }
  }
  const avgTicket = placed > 0 ? gross / placed : 0;
  const margin = paidNet - cogs;
  const marginPct = paidNet > 0 ? (margin / paidNet) * 100 : 0;
  return { gross, gst, net, placed, cancelled, items, avgTicket, paidNet, cogs, margin, marginPct, paidCount };
}

/* ── v5.147.0 — the range report's chat voice ────────────────────────────
 *  The bill got a chat twin (5.145.0), the Z-report got one (5.146.0); the
 *  range report is the third sibling. `ReportOpts` is fed from the SAME
 *  memoized aggregates the screen renders — the headline strip, the money
 *  mix, the item ranking, the day/hour shapes — so paper (CSV), screen and
 *  chat can never disagree about the range. The chat twin is the POCKET
 *  summary by design: the CSVs stay the complete export (all 24 hour
 *  buckets, every day, every item); chat carries the range's shape —
 *  headline money, cost & margin on collected tickets, how money arrived,
 *  what sold (top 3), best day, peak hour. The sender's name is
 *  deliberately absent — a chat message shows its sender inherently. */
export interface ReportOpts {
  storeName: string;
  rangeLabel: string;
  windowLabel: string;
  tz: string;
  gross: number;
  gst: number;
  net: number;
  orders: number;
  items: number;
  avgTicket: number;
  cancelled: number;
  paidNet: number;
  paidCount: number;
  cogs: number;
  margin: number;
  marginPct: number;
  mix: { method: string; count: number; amount: number }[];
  unpaidAmt: number;
  unpaid: number;
  splitTickets: number;
  top: { name: string; units: number; revenue: number }[];
  bestDay: { label: string; gross: number } | null;
  peakHour: { label: string; gross: number } | null;
}

/** The range report rendered as the house's aligned 32-column text register
 *  — same frame as the receipt (5.145.0) and the Z-report (5.146.0), one
 *  house text-voice across every surface that can be shared. Exported pure
 *  so browser E2E can assert the share text without touching the clipboard. */
export function buildReportText(opts: ReportOpts): string {
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
  out.push(center(`REPORT · ${opts.rangeLabel.toUpperCase()}`));
  out.push(center(`${opts.windowLabel} · ${opts.tz}`));
  out.push(hr);
  out.push(two('Gross sales', formatMoney(opts.gross)));
  out.push(two('GST collected', formatMoney(opts.gst)));
  out.push(two('Net (ex-GST)', formatMoney(opts.net)));
  out.push(two('Orders', String(opts.orders)));
  out.push(two('Items sold', String(opts.items)));
  out.push(two('Avg ticket', formatMoney(opts.avgTicket)));
  if (opts.cancelled > 0) out.push(two('Cancelled (excluded)', String(opts.cancelled)));
  out.push(hr);
  out.push('COST & MARGIN · PAID TKTS');
  out.push(two(`Paid net (${opts.paidCount} tkt)`, formatMoney(opts.paidNet)));
  out.push(two('Ingredient cost', formatMoney(opts.cogs)));
  out.push(two('GROSS MARGIN', `${formatMoney(opts.margin)} (${Math.round(opts.marginPct)}%)`));
  out.push(hr);
  out.push('MONEY ARRIVED');
  if (opts.mix.length > 0) {
    for (const m of opts.mix)
      out.push(two(`${m.method.toUpperCase()} · ${m.count}`, formatMoney(m.amount)));
  } else {
    out.push('- (no payments)');
  }
  if (opts.splitTickets > 0) out.push(two('Split tickets', `${opts.splitTickets} in parts`));
  if (opts.unpaid > 0) out.push(two('UNPAID', `${formatMoney(opts.unpaidAmt)} (${opts.unpaid} tkt)`));
  if (opts.top.length > 0) {
    out.push(hr);
    out.push('WHAT SOLD · TOP 3');
    opts.top.forEach((t, i) => out.push(two(`${i + 1}. ${t.name} · ${t.units}u`, formatMoney(t.revenue))));
  }
  if (opts.bestDay || opts.peakHour) {
    out.push(hr);
    out.push('THE SHAPE');
    if (opts.bestDay) out.push(two('Best day', `${opts.bestDay.label} · ${formatMoney(opts.bestDay.gross)}`));
    if (opts.peakHour) out.push(two('Peak hour', `${opts.peakHour.label} · ${formatMoney(opts.peakHour.gross)}`));
  }
  out.push(hr);
  out.push(center(`Shared ${appFormatters().hhmm.format(new Date())} ${appTzTag()}`));
  out.push(center('· · · end of report · · ·'));
  return out.join('\n');
}

/* ── v5.153.0 — the best sellers speak in chat ───────────────────────
 * The share arc's eighth member: the item ranking gets a pocket voice.
 * "Weekly best-sellers" is the most-shared owner report in F&B — to a
 * partner, a supplier, a franchise head — and unlike the menu (5.152.0,
 * the GUEST view), this is the house's own book: margins legitimately
 * ride along. Mirrors the screen's two boards — TOP ITEMS by revenue
 * (units, share of sales, margin when priced) and THE EARNER'S LIST by
 * what dishes KEEP (revenue − ingredient cost, sells-rank divergence
 * named when it isn't the earns rank). Unpriced dishes say so by
 * omission — a zero cost is not a 100% margin. Detail lines are
 * greedy-packed segments joined with ' · ' — never truncated mid-word
 * (the 189/190 prose lesson, list edition). Exported pure so E2E can
 * assert the text without the clipboard. */
export interface TopTextItem {
  name: string;
  units: number;
  revenue: number;
  sharePct: number;
  /** null when the dish is unpriced — the text stays honest by omission */
  marginPct: number | null;
  kept: number | null;
}

export interface TopTextOpts {
  storeName: string;
  rangeLabel: string;
  items: TopTextItem[];
  /** priced dishes by what they keep; earns rank = position + 1 */
  earners: { name: string; kept: number; marginPct: number; sellsRank: number }[];
  itemsSold: number;
}

export function buildTopText(opts: TopTextOpts): string {
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
  /* detail lines are packed segments, not an aligned row — a sentence
   * about a dish is prose, and prose never rides the money aligner.
   * An over-long single segment word-wraps at the detail width instead
   * of riding the packer past the frame (194's lesson, ported). */
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
  const detail = (segs: string[]): string[] => {
    const lines: string[] = [];
    let cur = '';
    for (const s of segs) {
      if (s.length > W - 3) {
        if (cur) {
          lines.push(cur);
          cur = '';
        }
        for (const w of wrap(s, W - 3)) lines.push(w);
        continue;
      }
      const t = cur ? `${cur} · ${s}` : s;
      if (t.length <= W - 3) {
        cur = t;
        continue;
      }
      if (cur) lines.push(cur);
      cur = s;
    }
    if (cur) lines.push(cur);
    return lines;
  };

  const out: string[] = [];
  out.push(center(opts.storeName));
  out.push(center(`BEST SELLERS · ${opts.rangeLabel.toUpperCase()}`));
  out.push(hr);
  opts.items.forEach((it, i) => {
    out.push(two(`${i + 1}. ${it.name}`, formatMoney(it.revenue)));
    const segs = [`${it.units} unit${it.units === 1 ? '' : 's'}`, `${Math.round(it.sharePct)}% of sales`];
    if (it.marginPct !== null) segs.push(`${Math.round(it.marginPct)}% mgn`);
    for (const line of detail(segs)) out.push(`   ${line}`);
  });
  if (opts.earners.length > 0) {
    out.push(hr);
    out.push("THE EARNER'S LIST");
    opts.earners.forEach((e, i) => {
      out.push(two(`${i + 1}. ${e.name}`, formatMoney(e.kept)));
      const segs = [`${Math.round(e.marginPct)}% kept`, `sells #${e.sellsRank}`];
      if (i + 1 !== e.sellsRank) segs.push(`earns #${i + 1}`);
      for (const line of detail(segs)) out.push(`   ${line}`);
    });
  }
  out.push(hr);
  out.push(two(`${opts.items.length} dish${opts.items.length === 1 ? '' : 'es'}`, `${opts.itemsSold} units`));
  out.push(center(`Shared ${appFormatters().hhmm.format(new Date())} ${appTzTag()}`));
  out.push(center('· · · end of best sellers · · ·'));
  return out.join('\n');
}

/* ── v5.154.0 — the offer scorecard speaks in chat ──────────────────
 * The share arc's ninth member: the promo review gets a pocket voice.
 * "Is the discount pulling its weight?" is a weekly owner question,
 * and the answer rides in chat the same way the offers themselves do
 * (5.149.0). Same house register; zero-ride offers speak honest zeros
 * instead of vanishing — the dead offer is the one the owner most
 * needs to see. The screen's own caveat rides as full-width prose:
 * revenue rode IN with the offers, but the counter can't prove they
 * wouldn't have come anyway. Exported pure so E2E can assert the
 * text without the clipboard. */
export interface OfferScoreOpts {
  storeName: string;
  rangeLabel: string;
  offers: {
    title: string;
    voice: string;
    isActive: boolean;
    uses: number;
    revenue: number;
    discount: number;
    lastRode: string | null;
  }[];
  totalUses: number;
  totalDiscount: number;
  totalRevenue: number;
}

export function buildOfferScoreText(opts: OfferScoreOpts): string {
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
  const detail = (segs: string[]): string[] => {
    const lines: string[] = [];
    let cur = '';
    for (const s of segs) {
      if (s.length > W - 3) {
        if (cur) {
          lines.push(cur);
          cur = '';
        }
        for (const w of wrap(s, W - 3)) lines.push(w);
        continue;
      }
      const t = cur ? `${cur} · ${s}` : s;
      if (t.length <= W - 3) {
        cur = t;
        continue;
      }
      if (cur) lines.push(cur);
      cur = s;
    }
    if (cur) lines.push(cur);
    return lines;
  };

  const out: string[] = [];
  out.push(center(opts.storeName));
  out.push(center(`OFFER SCORECARD · ${opts.rangeLabel.toUpperCase()}`));
  out.push(hr);
  for (const o of opts.offers) {
    out.push(two(o.title, o.isActive ? 'live' : 'paused'));
    const segs = [`${o.uses} ticket${o.uses === 1 ? '' : 's'}`];
    if (o.voice) segs.push(o.voice);
    segs.push(`brought ${formatMoney(o.revenue)}`, `cost ${formatMoney(o.discount)}`);
    if (o.lastRode) segs.push(`last rode ${o.lastRode}`);
    for (const line of detail(segs)) out.push(`   ${line}`);
  }
  out.push(hr);
  out.push(`${opts.totalUses} ticket${opts.totalUses === 1 ? '' : 's'} rode offers`);
  for (const line of detail([`${formatMoney(opts.totalDiscount)} off the gross`, `${formatMoney(opts.totalRevenue)} walked in`])) out.push(line);
  out.push(hr);
  for (const line of wrap("Revenue rode in with the offers — the counter can't prove they wouldn't have come anyway.")) out.push(line);
  out.push(center(`Shared ${appFormatters().hhmm.format(new Date())} ${appTzTag()}`));
  out.push(center('· · · end of scorecard · · ·'));
  return out.join('\n');
}

/**
 * v5.148.0 — the range report's PAPER voice: the quad completes. The screen
 * shows the range, the CSVs carry it complete to a spreadsheet, chat pockets
 * it (5.147.0), and now the thermal printer gets the same ReportOpts — the
 * SAME assembly buildReportText consumes, so paper can never disagree with
 * the chat text or the screen (the 5.146.0 one-assembly rule, range edition).
 * House thermal register: 'Courier New' 32-ish-col frame, dashed rules,
 * tabular-nums right column, honest zero-language. The headline money block
 * carries the range; cost & margin stay paid-tickets-truthful; WHAT SOLD is
 * the top-3 (the item CSVs stay the complete ranking); THE SHAPE closes with
 * best day and peak hour.
 */
function printRangeReport(opts: ReportOpts): void {
  const row = (l: string, r: string, strong = false) =>
    `<div style="display:flex;justify-content:space-between;padding:2.5px 0;${strong ? 'font-weight:700;' : ''}"><span>${l}</span><span style="font-variant-numeric:tabular-nums">${r}</span></div>`;
  const moneyRows = opts.mix.length > 0
    ? opts.mix.map((m) => row(`${m.method.toUpperCase()} · ${m.count}`, formatMoney(m.amount))).join('')
    : row('—', 'no payments');
  const topRows = opts.top.length > 0
    ? `<div style="border-top:1px dashed #000;margin-top:8px;padding-top:6px;">
    <div style="font-weight:800;padding-bottom:3px;">WHAT SOLD · TOP 3</div>
    ${opts.top.map((t, i) => row(`${i + 1}. ${t.name} · ${t.units}u`, formatMoney(t.revenue))).join('')}
  </div>`
    : '';
  const shapeRows = opts.bestDay || opts.peakHour
    ? `<div style="border-top:1px dashed #000;margin-top:8px;padding-top:6px;">
    <div style="font-weight:800;padding-bottom:3px;">THE SHAPE</div>
    ${opts.bestDay ? row('Best day', `${opts.bestDay.label} · ${formatMoney(opts.bestDay.gross)}`) : ''}
    ${opts.peakHour ? row('Peak hour', `${opts.peakHour.label} · ${formatMoney(opts.peakHour.gross)}`) : ''}
  </div>`
    : '';
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Report ${opts.rangeLabel}</title></head>
<body style="font-family:'Courier New',monospace;color:#000;margin:0;padding:16px 12px;width:300px;font-size:12px;">
  <div style="text-align:center;border-bottom:1px dashed #000;padding-bottom:8px;margin-bottom:8px;">
    <div style="font-size:15px;font-weight:800;letter-spacing:1px;">${opts.storeName}</div>
    <div>REPORT · ${opts.rangeLabel.toUpperCase()}</div>
    <div>${opts.windowLabel} · ${opts.tz}</div>
  </div>
  <div style="border-top:1px dashed #000;padding-top:6px;">
    ${row('Orders', String(opts.orders), true)}
    ${opts.cancelled > 0 ? row('Cancelled (excluded)', String(opts.cancelled)) : ''}
    ${row('Gross sales', formatMoney(opts.gross), true)}
    ${row('GST collected', formatMoney(opts.gst))}
    ${row('Net (ex-GST)', formatMoney(opts.net))}
    ${row('Items sold', String(opts.items))}
    ${row('Avg ticket', formatMoney(opts.avgTicket), true)}
  </div>
  <div style="border-top:1px dashed #000;margin-top:8px;padding-top:6px;">
    <div style="font-weight:800;padding-bottom:3px;">COST &amp; MARGIN · PAID TKTS</div>
    ${row(`Paid net (${opts.paidCount} tkt)`, formatMoney(opts.paidNet))}
    ${row('Ingredient cost', formatMoney(opts.cogs))}
    ${row('GROSS MARGIN', `${formatMoney(opts.margin)} (${Math.round(opts.marginPct)}%)`, true)}
  </div>
  <div style="border-top:1px dashed #000;margin-top:8px;padding-top:6px;">
    <div style="font-weight:800;padding-bottom:3px;">MONEY ARRIVED</div>
    ${moneyRows}
    ${opts.splitTickets > 0 ? row('Split tickets', `${opts.splitTickets} settled in parts`) : ''}
    ${opts.unpaid > 0 ? row('UNPAID', `${formatMoney(opts.unpaidAmt)} (${opts.unpaid} tkt)`, true) : ''}
  </div>
  ${topRows}
  ${shapeRows}
  <div style="border-top:1px dashed #000;margin-top:8px;padding-top:6px;text-align:center;color:#333;">
    <div>Printed ${appFormatters().hhmm.format(new Date())} ${appTzTag()}</div>
    <div style="margin-top:6px;letter-spacing:2px;">· · · end of report · · ·</div>
  </div>
</body></html>`;

  printHiddenFrame(html);
}

/* ── v5.155.0 — the kitchen speed speaks in chat ────────────────────
 * The share arc's tenth member: the stopwatch gets a pocket voice.
 * "Is the kitchen slow today?" is the daily off-site owner question —
 * the answer rides in the same chat where the day's money travels.
 * The clock speaks only what the hop ledger proves: average, median,
 * slowest, the SLA scoreboard, the tickets (top-5 slowest, the screen's
 * own order) and the dish the pass waits for. Small samples say so in
 * prose — the card's own honesty rides verbatim, and a clean sheet
 * speaks its honest zero. Exported pure so E2E can assert the text
 * without the clipboard. */
export interface KitchenSpeedOpts {
  storeName: string;
  rangeLabel: string;
  timed: number;
  avgMin: number | null;
  medianMin: number | null;
  slowest: { orderNumber: number; minutes: number } | null;
  breaches: number;
  /** top-5 slowest, the screen's own descending order */
  tickets: { orderNumber: number; minutes: number; firedAt: string; over: boolean }[];
  dishes: {
    name: string;
    tickets: number;
    avgMin: number;
    slowestMin: number;
    own: { avgMin: number; n: number } | null;
    waitedFor: boolean;
  }[];
}

export function buildKitchenSpeedText(opts: KitchenSpeedOpts): string {
  const W = 32;
  const hr = '-'.repeat(W);
  // center() never breaks the frame: an over-long title truncates to W
  // (ellipsis) before padding — a 40-char store name can't blow the col.
  const center = (s: string): string => {
    const t = s.length > W ? `${s.slice(0, W - 1)}…` : s;
    return t.length >= W ? t : ' '.repeat(Math.floor((W - t.length) / 2)) + t;
  };
  const two = (l: string, r: string): string => {
    const cut = Math.max(1, W - r.length - 1);
    const left = l.length > cut ? `${l.slice(0, cut - 1)}…` : l;
    return left.padEnd(W - r.length, ' ') + r;
  };
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
  const detail = (segs: (string | false | null | undefined)[]): string[] => {
    const lines: string[] = [];
    let cur = '';
    for (const raw of segs) {
      if (!raw) continue;
      const s = String(raw);
      // an over-long segment wraps on its own words (at the W-3 detail
      // width) instead of riding the packer past the frame — the 189/192
      // prose lesson, detail edition.
      if (s.length > W - 3) {
        if (cur) {
          lines.push(cur);
          cur = '';
        }
        for (const w of wrap(s, W - 3)) lines.push(w);
        continue;
      }
      const t = cur ? `${cur} · ${s}` : s;
      if (t.length <= W - 3) {
        cur = t;
        continue;
      }
      if (cur) lines.push(cur);
      cur = s;
    }
    if (cur) lines.push(cur);
    return lines;
  };

  const out: string[] = [];
  out.push(center(opts.storeName));
  out.push(center(`KITCHEN SPEED · ${opts.rangeLabel.toUpperCase()}`));
  out.push(hr);
  if (opts.avgMin !== null) out.push(two('Average', fmtDuration(opts.avgMin)));
  if (opts.medianMin !== null) out.push(two('Median', fmtDuration(opts.medianMin)));
  if (opts.slowest)
    out.push(two('Slowest', `#${opts.slowest.orderNumber} · ${fmtDuration(opts.slowest.minutes)}`));
  out.push(two('Over the 10-min SLA', String(opts.breaches)));
  out.push(hr);
  for (const t of opts.tickets) {
    out.push(two(`#${t.orderNumber}`, fmtDuration(t.minutes)));
    for (const line of detail([`fired ${t.firedAt}`, t.over ? 'over SLA' : null]))
      out.push(`   ${line}`);
  }
  if (opts.dishes.length > 0) {
    out.push(hr);
    out.push('THE SLOW DISH');
    opts.dishes.forEach((d, i) => {
      out.push(two(`${i + 1}. ${d.name}`, fmtDuration(d.avgMin)));
      const segs = [
        d.waitedFor ? 'the pass waits for this' : null,
        `${d.tickets} ticket${d.tickets === 1 ? '' : 's'}`,
        `slowest ${fmtDuration(d.slowestMin)}`,
        d.own ? `own clock avg ${fmtDuration(d.own.avgMin)}` : null,
        d.own ? `${d.own.n} ticked` : null,
      ];
      for (const line of detail(segs)) out.push(`   ${line}`);
    });
  }
  out.push(hr);
  out.push(two(`${opts.timed} ticket${opts.timed === 1 ? '' : 's'} timed`, `${opts.breaches} over SLA`));
  if (opts.timed > 0 && opts.timed < 3) {
    out.push('');
    for (const line of wrap('small sample — the clock needs more timed tickets before it says anything loud'))
      out.push(line);
  }
  out.push(center(`Shared ${appFormatters().hhmm.format(new Date())} ${appTzTag()}`));
  out.push(center('· · · end of kitchen speed · · ·'));
  return out.join('\n');
}

/* ── v5.156.0 — the guest voices speak in chat ──────────────────────
 * The share arc's eleventh member: the satisfaction card gets a pocket
 * voice. "What did guests say this week?" rides in the same chat where
 * the day's money travels — the average with the card's own word, the
 * star histogram (non-zero rows; the recover line carries the zero
 * story), the guests' own words quoted full-width, and THE RECOVER
 * LIST with names and phones: the callback sheet an owner can act on
 * from the group chat. Zeros stay honest ("nothing to recover"), and
 * the chat caps mirror the screen's (3 quotes, 5 recover rows — the
 * CSVs stay complete). Built on the hardened helpers from birth:
 * center() truncates into the frame, detail() wraps over-long
 * segments, prose never rides the money aligner. Exported pure so
 * E2E can assert the text without the clipboard. */
export interface GuestVoiceOpts {
  storeName: string;
  rangeLabel: string;
  avg: number | null;
  avgWord: string;
  count: number;
  commentCount: number;
  /** index 0 = 1★ … 4 = 5★, the screen's own histogram */
  stars: number[];
  comments: { rating: number; orderNumber: number; text: string }[];
  low: {
    name: string | null;
    phone: string | null;
    rating: number;
    orderNumber: number;
    when: string;
    comment: string | null;
  }[];
  lowTotal: number;
}

export function buildRatingsText(opts: GuestVoiceOpts): string {
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
  const detail = (segs: (string | false | null | undefined)[]): string[] => {
    const lines: string[] = [];
    let cur = '';
    for (const raw of segs) {
      if (!raw) continue;
      const s = String(raw);
      if (s.length > W - 3) {
        if (cur) {
          lines.push(cur);
          cur = '';
        }
        for (const w of wrap(s, W - 3)) lines.push(w);
        continue;
      }
      const t = cur ? `${cur} · ${s}` : s;
      if (t.length <= W - 3) {
        cur = t;
        continue;
      }
      if (cur) lines.push(cur);
      cur = s;
    }
    if (cur) lines.push(cur);
    return lines;
  };

  const out: string[] = [];
  out.push(center(opts.storeName));
  out.push(center(`GUEST VOICES · ${opts.rangeLabel.toUpperCase()}`));
  out.push(hr);
  if (opts.avg !== null) out.push(two('Average', `${opts.avg.toFixed(1)} / 5`));
  if (opts.avgWord) for (const line of detail([opts.avgWord])) out.push(`   ${line}`);
  for (const line of detail([
    `${opts.count} rating${opts.count === 1 ? '' : 's'}`,
    opts.commentCount > 0 ? `${opts.commentCount} with comment${opts.commentCount === 1 ? '' : 's'}` : null,
  ]))
    out.push(line);
  const starSegs = opts.stars
    .map((n, i) => ({ n, star: i + 1 }))
    .reverse()
    .filter((s) => s.n > 0)
    .map((s) => `${s.star}★ ×${s.n}`);
  if (starSegs.length > 0) {
    out.push(hr);
    for (const line of detail(starSegs)) out.push(line);
  }
  if (opts.comments.length > 0) {
    out.push(hr);
    for (const c of opts.comments) {
      for (const line of wrap(`“${c.text}”`)) out.push(line);
      for (const line of detail([`${c.rating}★`, `#${c.orderNumber}`])) out.push(`   ${line}`);
    }
  }
  out.push(hr);
  if (opts.low.length > 0) {
    out.push('THE RECOVER LIST');
    for (const l of opts.low) {
      out.push(two(l.name || l.phone || 'anonymous ticket', `${l.rating}★`));
      for (const line of detail([l.name && l.phone ? l.phone : null, `#${l.orderNumber}`, l.when]))
        out.push(`   ${line}`);
      if (l.comment && l.comment.trim().length > 0)
        for (const line of wrap(`“${l.comment.trim()}”`, W - 3)) out.push(`   ${line}`);
      else out.push('   no comment — the stars spoke');
    }
    if (opts.lowTotal > opts.low.length) out.push(`+ ${opts.lowTotal - opts.low.length} more in the CSV`);
  } else {
    for (const line of wrap('no low stars in this window — nothing to recover')) out.push(line);
  }
  out.push(center(`Shared ${appFormatters().hhmm.format(new Date())} ${appTzTag()}`));
  out.push(center('· · · end of guest voices · · ·'));
  return out.join('\n');
}

/* ── v5.157.0 — the drawer speaks in chat ───────────────────────────
 * The share arc's twelfth member, and the last parked surface: the
 * drawer-honesty card gets a pocket voice. "Did the drawer balance?"
 * is the end-of-day owner question, and the answer rides home in the
 * same chat as everything else. The card's own doctrine holds: sealed
 * shifts only, expected is the ledger's math, variance is STORED
 * truth never re-derived. Net variance with the card's own word, then
 * shift by shift (newest first): the when, the variance right-aligned
 * via the money aligner, expected/counted as packed detail, the
 * per-shift chat word, and the closing note quoted as the indented
 * prose it is — a clean shift says "matches the ledger" and stays
 * silent otherwise (the minority marked, never the majority). Chat
 * caps mirror the screen's (5 shifts; the CSV stays complete). Built
 * on the hardened helpers from birth and joins the standing torture
 * suite before it ships. Exported pure so E2E can assert the text
 * without the clipboard. */
export interface DrawerOpts {
  storeName: string;
  rangeLabel: string;
  net: number;
  netWord: string;
  sealed: number;
  shifts: {
    when: string;
    expected: number;
    counted: number;
    variance: number;
    word: string | null;
    note: string | null;
  }[];
  shiftTotal: number;
}

export function buildDrawerText(opts: DrawerOpts): string {
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
  const detail = (segs: (string | false | null | undefined)[]): string[] => {
    const lines: string[] = [];
    let cur = '';
    for (const raw of segs) {
      if (!raw) continue;
      const s = String(raw);
      if (s.length > W - 3) {
        if (cur) {
          lines.push(cur);
          cur = '';
        }
        for (const w of wrap(s, W - 3)) lines.push(w);
        continue;
      }
      const t = cur ? `${cur} · ${s}` : s;
      if (t.length <= W - 3) {
        cur = t;
        continue;
      }
      if (cur) lines.push(cur);
      cur = s;
    }
    if (cur) lines.push(cur);
    return lines;
  };

  const out: string[] = [];
  out.push(center(opts.storeName));
  out.push(center(`THE DRAWER · ${opts.rangeLabel.toUpperCase()}`));
  out.push(hr);
  out.push(two('Net variance', signedMoney(opts.net)));
  // the card's own word rides as full-width prose — never indented, so the
  // exact label ("small slip — noted on the shift", 31 cols) fits the frame
  if (opts.netWord) for (const line of wrap(opts.netWord)) out.push(line);
  out.push(`${opts.sealed} shift${opts.sealed === 1 ? '' : 's'} sealed in range`);
  out.push(hr);
  for (const s of opts.shifts) {
    out.push(two(s.when, signedMoney(s.variance)));
    for (const line of detail([`exp ${formatMoney(s.expected)}`, `counted ${formatMoney(s.counted)}`, s.word]))
      out.push(`   ${line}`);
    if (s.note && s.note.trim().length > 0)
      for (const line of wrap(`“${s.note.trim()}”`, W - 3)) out.push(`   ${line}`);
  }
  if (opts.shiftTotal > opts.shifts.length) out.push(`+ ${opts.shiftTotal - opts.shifts.length} more sealed in range`);
  out.push(center(`Shared ${appFormatters().hhmm.format(new Date())} ${appTzTag()}`));
  out.push(center('· · · end of the drawer · · ·'));
  return out.join('\n');
}

/* ── Kitchen speed (5.67.0) — the clock reads the hop ledger ──────────────── */

interface SpeedTicket {
  orderNumber: number;
  orderId: string;
  minutes: number;
  firedAt: Date;
  readyAt: Date;
}

interface SpeedItem {
  name: string;
  tickets: number;
  avgMin: number;
  slowestMin: number;
  /** 5.69.0 — the dish's own clock: fire → its last ticked line (029's
   *  checked_at), one opinion per dish per timed ticket, only when EVERY
   *  line of that dish on the ticket was ticked (a half-ticked dish hasn't
   *  fully passed — the clock never half-speaks). Null = no ticks on file
   *  for this dish; the row then rides the ticket-donated span alone. */
  own: { n: number; avgMin: number; slowestMin: number } | null;
}

interface SpeedAgg {
  sample: SpeedTicket[];
  avgMin: number | null;
  medianMin: number | null;
  slowest: SpeedTicket | null;
  breaches: SpeedTicket[];
  items: SpeedItem[];
}

/** The kitchen's honest stopwatch, straight off 007's trigger-written hop
 *  trail: FIRED = the hop into 'preparing' (the counter's Ok — the earliest
 *  one wins, retries can't inflate), READY = the earliest hop into 'ready'
 *  or, for takeaways that never sat on the pass, 'completed'. Only tickets
 *  with BOTH endpoints are timed — a ticket still cooking has no finish
 *  line, and the clock never guesses. Cancelled tickets never enter. */
function kitchenSpeed(rows: Order[], hopRows: StatusHop[]): SpeedAgg {
  const live = new Map(
    rows
      .filter((o) => String(o.status || '').toLowerCase() !== 'cancelled')
      .map((o) => [o.id, o]),
  );
  const firedAt = new Map<string, Date>();
  const readyAt = new Map<string, Date>();
  for (const h of hopRows) {
    if (!live.has(h.orderId)) continue;
    const at = new Date(h.atIso);
    if (Number.isNaN(at.getTime())) continue;
    if (h.toStatus === 'preparing') {
      const prev = firedAt.get(h.orderId);
      if (!prev || at < prev) firedAt.set(h.orderId, at);
    }
    if (h.toStatus === 'ready' || h.toStatus === 'completed') {
      const prev = readyAt.get(h.orderId);
      if (!prev || at < prev) readyAt.set(h.orderId, at);
    }
  }
  const sample: SpeedTicket[] = [];
  for (const [id, o] of live) {
    const f = firedAt.get(id);
    const r = readyAt.get(id);
    if (!f || !r || r.getTime() <= f.getTime()) continue;
    sample.push({
      orderNumber: Number(o.order_number),
      orderId: id,
      minutes: (r.getTime() - f.getTime()) / 60000,
      firedAt: f,
      readyAt: r,
    });
  }
  sample.sort((a, b) => a.minutes - b.minutes);
  const n = sample.length;
  const avgMin = n > 0 ? sample.reduce((s, t) => s + t.minutes, 0) / n : null;
  const medianMin = n > 0 ? sample[Math.floor((n - 1) / 2)].minutes : null;
  const slowest = n > 0 ? sample[n - 1] : null;
  // the 10-minute SLA the kitchen board already shouts about (LATE PREP)
  const breaches = sample.filter((t) => t.minutes > 10);
  // 5.68.0 — the slow dish: each timed ticket donates its fire→ready span to
  // every dish on it (one sample per DISH per ticket — a ×2 line is one
  // opinion, not two). The dish the pass waits for floats up on its own.
  const byItem = new Map<string, { total: number; n: number; max: number }>();
  // 5.69.0 — the dish's own clock: the SAME timed tickets, but the span is
  // fire → the dish's last ticked line (029's checked_at), not the ticket's
  // ready hop. A ticket with three dishes waits for the slowest one; the
  // check-clock lets the two that passed early speak for themselves. Rules:
  // every line of the dish must be ticked (fully passed), the sample spans
  // fire→check only when the check is after the fire (a pre-fire tick would
  // wind the clock backwards — skipped, never negative), and only tickets
  // already in the timed sample contribute (the block's common denominator
  // stays 'tickets with a complete story'; mid-flight dishes stay on the
  // KDS's clock).
  const byOwn = new Map<string, { total: number; n: number; max: number }>();
  for (const t of sample) {
    const o = live.get(t.orderId);
    const lines = o?.items || [];
    const perDish = new Map<string, { allChecked: boolean; last: number }>();
    for (const it of lines) {
      const key = it.variant_name ? `${it.name} · ${it.variant_name}` : it.name;
      const cur = perDish.get(key) || { allChecked: true, last: 0 };
      if (!it.checked_at) {
        cur.allChecked = false;
      } else {
        const at = new Date(it.checked_at).getTime();
        if (!Number.isNaN(at) && at > cur.last) cur.last = at;
      }
      perDish.set(key, cur);
    }
    for (const [key, d] of perDish) {
      if (!d.allChecked || d.last <= t.firedAt.getTime()) continue;
      const spanMin = (d.last - t.firedAt.getTime()) / 60000;
      const cur = byOwn.get(key) || { total: 0, n: 0, max: 0 };
      cur.total += spanMin;
      cur.n += 1;
      cur.max = Math.max(cur.max, spanMin);
      byOwn.set(key, cur);
    }
    const seen = new Set<string>();
    for (const it of lines) {
      const key = it.variant_name ? `${it.name} · ${it.variant_name}` : it.name;
      if (seen.has(key)) continue;
      seen.add(key);
      const cur = byItem.get(key) || { total: 0, n: 0, max: 0 };
      cur.total += t.minutes;
      cur.n += 1;
      cur.max = Math.max(cur.max, t.minutes);
      byItem.set(key, cur);
    }
  }
  const items: SpeedItem[] = [...byItem.entries()]
    .map(([name, v]) => {
      const own = byOwn.get(name);
      return {
        name,
        tickets: v.n,
        avgMin: v.total / v.n,
        slowestMin: v.max,
        own: own ? { n: own.n, avgMin: own.total / own.n, slowestMin: own.max } : null,
      };
    })
    .sort((a, b) => b.avgMin - a.avgMin || b.slowestMin - a.slowestMin);
  return { sample, avgMin, medianMin, slowest, breaches, items };
}

/** "6m 40s" voice — seconds-true, never a bare decimal the eye rounds wrong. */
function fmtDuration(minutes: number): string {
  const totalSec = Math.max(0, Math.round(minutes * 60));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  return `${m}m ${String(s).padStart(2, '0')}s`;
}

/* ── Table turnover (v5.161.0) — the room's breathing, off the same ledger ── */

export interface TurnoverTable {
  tableLabel: string;
  turns: number;
  /** tickets from this table whose span is provable (placed → paid hop) */
  timed: number;
  avgSpanMin: number | null;
  longestSpanMin: number | null;
}

export interface TurnoverAgg {
  /** dine-in tickets in range (a table_id on the ticket is the floor's truth) */
  tickets: number;
  tablesTouched: number;
  perTable: TurnoverTable[];
  spans: { n: number; avgMin: number | null; medianMin: number | null };
  longest: { orderNumber: number; tableLabel: string; minutes: number } | null;
}

/** The floor's TimeAgo register for seated spans ("45m" · "1h 5m") — the
 *  same clock voice the camping pill speaks, minus "just sat": a finished
 *  span of zero minutes still reads "0m", not a greeting. */
export function turnoverSpanLabel(minutes: number): string {
  const m = Math.max(0, Math.floor(minutes));
  const h = Math.floor(m / 60);
  return h > 0 ? `${h}h ${m % 60}m` : `${m}m`;
}

/** The room's honest breathing, off the ledger the kitchen stopwatch reads
 *  (007's trigger-written hop trail). Dine-in = the ticket carries a
 *  table_id; cancelled tickets never entered the room. The seat span is
 *  placed → the earliest 'completed' hop; a ticket still at its table has
 *  no finish line, so it donates a TURN but never a span — the clock never
 *  guesses. A hop older than the ticket itself would wind the clock
 *  backwards and is skipped, never negative. */
export function tableTurnover(rows: Order[], hopRows: StatusHop[]): TurnoverAgg {
  const dineIn = rows.filter(
    (o) => o.table_id && String(o.status || '').toLowerCase() !== 'cancelled',
  );
  const byId = new Map(dineIn.map((o) => [o.id, o]));
  const doneAt = new Map<string, Date>();
  for (const h of hopRows) {
    if (h.toStatus !== 'completed') continue;
    if (!byId.has(h.orderId)) continue;
    const at = new Date(h.atIso);
    if (Number.isNaN(at.getTime())) continue;
    const prev = doneAt.get(h.orderId);
    if (!prev || at < prev) doneAt.set(h.orderId, at);
  }
  const spans: { orderNumber: number; tableLabel: string; minutes: number }[] = [];
  const perTable = new Map<string, { turns: number; spans: number[] }>();
  for (const o of dineIn) {
    const label = (o.table_label || '').trim() || 'Unnamed table';
    const cell = perTable.get(label) || { turns: 0, spans: [] as number[] };
    cell.turns += 1;
    const placed = new Date(o.created_at).getTime();
    const done = doneAt.get(o.id)?.getTime();
    if (Number.isFinite(placed) && done && done > placed) {
      const minutes = (done - placed) / 60000;
      cell.spans.push(minutes);
      spans.push({ orderNumber: Number(o.order_number), tableLabel: label, minutes });
    }
    perTable.set(label, cell);
  }
  spans.sort((a, b) => a.minutes - b.minutes);
  const n = spans.length;
  const avgMin = n > 0 ? spans.reduce((s, t) => s + t.minutes, 0) / n : null;
  const medianMin = n > 0 ? spans[Math.floor((n - 1) / 2)].minutes : null;
  const longest = n > 0 ? spans[n - 1] : null;
  const tables: TurnoverTable[] = [...perTable.entries()]
    .map(([tableLabel, cell]) => ({
      tableLabel,
      turns: cell.turns,
      timed: cell.spans.length,
      avgSpanMin:
        cell.spans.length > 0
          ? cell.spans.reduce((s, m) => s + m, 0) / cell.spans.length
          : null,
      longestSpanMin: cell.spans.length > 0 ? Math.max(...cell.spans) : null,
    }))
    .sort(
      (a, b) =>
        b.turns - a.turns ||
        (b.avgSpanMin ?? -1) - (a.avgSpanMin ?? -1) ||
        a.tableLabel.localeCompare(b.tableLabel),
    );
  return {
    tickets: dineIn.length,
    tablesTouched: perTable.size,
    perTable: tables,
    spans: { n, avgMin, medianMin },
    longest,
  };
}

function hourLabel(h: number): string {
  if (h === 0) return '12a';
  if (h === 12) return '12p';
  return h < 12 ? `${h}a` : `${h - 12}p`;
}

const RANGE_LABEL: Record<RangeKey, string> = {
  today: 'Today',
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  all: 'All time',
};

/* ── CSV — shared lib/csv.ts (injection-safe escaping + UTF-8 BOM, since 5.8.0;
 *    byte-identical to the Bills export it replaces) */

/* ── aggregation shapes ─────────────────────────────────────────────────── */

interface ItemRank {
  name: string;
  units: number;
  revenue: number;
  cost: number;
  /** true when the dish's menu item has recipe pricing on file (v_item_unit_cost);
   *  unpriced dishes sit out of the margin board — a zero cost is not a 100% margin */
  priced: boolean;
}

const TYPE_LABEL: Record<string, string> = {
  dine_in: 'Dine-in',
  takeaway: 'Takeaway',
  delivery: 'Delivery',
};

const METHOD_LABEL: Record<string, string> = {
  cash: 'Cash',
  upi: 'UPI',
  card: 'Bank Card',
};

const METHOD_COLOR: Record<string, string> = {
  cash: '#2E7D32',
  upi: '#0F3D3E',
  card: '#B88E2F',
};

/* ── guest satisfaction health (same thresholds as the Dashboard card) ──── */

function ratingTone(avg: number | null): string {
  if (avg === null) return '#969696';
  if (avg >= 4.5) return '#2E7D32';
  if (avg >= 3.5) return '#8A5A00';
  return '#B3261E';
}

function ratingWord(avg: number | null): string {
  if (avg === null) return 'no ratings in range yet';
  if (avg >= 4.5) return 'guests love it';
  if (avg >= 3.5) return 'good — keep going';
  return 'listen up';
}

/* ── drawer variance health (mirrors the Close-out dialog's exact voice) ── */

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

function signedMoney(v: number): string {
  if (v > 0) return `+${formatMoney(v)}`;
  if (v < 0) return `−${formatMoney(Math.abs(v))}`;
  return formatMoney(0);
}

/* Trends bucket keys/labels come from appday: appDayKey + appFormatters,
   rebuilt whenever the owner's chosen timezone changes. */

/** Drawer variance color — the exact health tones the Close-out voice uses. */
function varianceColor(v: number): string {
  const abs = Math.abs(v);
  if (abs < 0.005) return '#2E7D32';
  if (abs <= 20) return '#8A5A00';
  return '#B3261E';
}

/* ─────────────────────────────── screen ────────────────────────────────── */

export const ReportsScreen: React.FC = () => {
  const [attempt, setAttempt] = useState(0);
  /* 5.97.0 — the owner's timezone word takes effect live: a Settings save
     refetches and re-renders every report in the chosen day. */
  useEffect(() => subscribePrefs(() => setAttempt((a) => a + 1)), []);
  return <ReportsInner key={attempt} onTenantRetry={() => setAttempt((a) => a + 1)} />;
};

const ReportsInner: React.FC<{ onTenantRetry: () => void }> = ({ onTenantRetry }) => {
  const { tenantId, loading: tenantLoading, error: tenantError, tenant } = useTenant();
  const goSection = useUi((s) => s.goSection);
  const [range, setRange] = useState<RangeKey>('7d');
  const [orders, setOrders] = useState<Order[]>([]);
  const [cogsMap, setCogsMap] = useState<Map<string, number>>(new Map());
  const [unitCosts, setUnitCosts] = useState<Map<string, number>>(new Map());
  const [feedback, setFeedback] = useState<FeedbackRow[]>([]);
  const [shifts, setShifts] = useState<DrawerSession[]>([]);
  /* 5.71.0 — the offer's scorecard: the redemption ledger (016) finally read
     as a season, joined to the offer rows so silent offers speak zeros. */
  const [redemptions, setRedemptions] = useState<OfferRedemptionRow[]>([]);
  const [offersList, setOffersList] = useState<Offer[]>([]);
  /* 5.77.0 — the bin's bill: the waste side of the 027 diary (spoilage /
     spillage / damage with the SKU joined). null = not answered yet; [] =
     answered, nothing was binned. Rides the fail-soft sidecar. */
  const [waste, setWaste] = useState<WasteMove[] | null>(null);
  /* 5.64.0 — the payments ledger rows for the SELECTED range. The mix reads
     the parts: a split ticket lands under each method it was paid with. */
  const [ledger, setLedger] = useState<(ReceiptPayment & { orderId: string })[]>([]);
  const [hops, setHops] = useState<StatusHop[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshedAt, setRefreshedAt] = useState<Date | null>(null);

  const load = useCallback(async () => {
    if (!tenantId) return;
    setError(null);
    try {
      // Recent 500 tickets — a cafe month; the footer states the cap honestly.
      // COGS rides along (018 views) so cost & margin never drift from sales.
      const [data, cogs, unitCosts] = await Promise.all([
        fetchOrders(tenantId, 500),
        fetchOrderCogs(tenantId),
        fetchItemUnitCosts(tenantId),
      ]);
      setOrders(data);
      setCogsMap(cogs);
      setUnitCosts(unitCosts);
      setRefreshedAt(new Date());
      // Ledger sections (019 satisfaction + 020 drawer) ride along FAIL-SOFT:
      // the sales view never dies for them — their sections fall back to
      // their own honest empty states.
      try {
        const [fb, sh, reds, offerRows, wmoves] = await Promise.all([
          fetchFeedbackRows(tenantId),
          fetchDrawerHistory(tenantId, 200),
          fetchOfferRedemptions(tenantId),
          fetchOffers(tenantId),
          fetchWasteMoves(tenantId),
        ]);
        setFeedback(fb);
        setShifts(sh);
        setRedemptions(reds);
        setOffersList(offerRows);
        setWaste(wmoves);
      } catch {
        setFeedback([]);
        setShifts([]);
        setRedemptions([]);
        setOffersList([]);
        setWaste([]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load sales data from the cloud.');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [tenantId, load]);

  const inRange = useMemo(() => {
    const { startMs, endMs } = rangeWindow(range);
    return orders.filter((o) => {
      const t = new Date(o.created_at).getTime();
      if (Number.isNaN(t)) return false;
      if (startMs !== null && (t < startMs || t >= endMs)) return false;
      return true;
    });
  }, [orders, range]);

  /* 5.64.0 — the ledger rides the range: one bounded read per window (or
     refresh), fail-soft like every other sidecar section. */
  useEffect(() => {
    if (!tenantId) return;
    let alive = true;
    const { startMs, endMs } = rangeWindow(range);
    fetchPaymentsInRange(
      tenantId,
      startMs !== null ? new Date(startMs).toISOString() : null,
      new Date(endMs).toISOString()
    )
      .then((rows) => {
        if (alive) setLedger(rows);
      })
      .catch(() => {
        if (alive) setLedger([]);
      });
    return () => {
      alive = false;
    };
  }, [tenantId, range, refreshedAt]);

  /* 5.67.0 — the hop ledger rides the range: 007's trigger-written trail of
     every status hop, bounded to the window with a 6h tail (a ticket that
     fires just after midnight still lands), fail-soft like every sidecar. */
  useEffect(() => {
    if (!tenantId) return;
    let alive = true;
    const { startMs, endMs } = rangeWindow(range);
    fetchStatusHopsInRange(
      tenantId,
      startMs !== null ? new Date(startMs).toISOString() : null,
      new Date(endMs + 6 * 3600 * 1000).toISOString()
    )
      .then((rows) => {
        if (alive) setHops(rows);
      })
      .catch(() => {
        if (alive) setHops([]);
      });
    return () => {
      alive = false;
    };
  }, [tenantId, range, refreshedAt]);

  const agg = useMemo(() => aggregateTickets(inRange, cogsMap), [inRange, cogsMap]);

  /** The equal-length window immediately before the selected one — the
   *  delta-chip baseline. `null` for All time (no earlier boundary). */
  const priorAgg = useMemo(() => {
    const w = priorWindow(range);
    if (!w) return null;
    const rows = orders.filter((o) => {
      const t = new Date(o.created_at).getTime();
      if (Number.isNaN(t)) return false;
      return t >= w.startMs && t < w.endMs;
    });
    return aggregateTickets(rows, cogsMap);
  }, [orders, range, cogsMap]);

  /** Spread-able chip props for a headline KPI: `{ delta, deltaBaseline }`
   *  when a prior window exists, `{}` otherwise (All time → no chips). */
  const priorLabel = priorRangeLabel(range);
  const deltaProps = (current: number, prior: number, fmt: (n: number) => string) =>
    priorAgg && priorLabel
      ? {
          delta: <DeltaChip current={current} prior={prior} baseline={priorLabel} fmt={fmt} />,
          deltaBaseline: priorLabel,
        }
      : {};

  const hourly = useMemo(() => {
    const buckets = Array.from({ length: 24 }, (_, h) => ({ hour: h, label: hourLabel(h), gross: 0 }));
    for (const o of inRange) {
      if (String(o.status || '').toLowerCase() === 'cancelled') continue;
      buckets[appHour(o.created_at)].gross += Number(o.total ?? 0);
    }
    return buckets;
  }, [inRange]);

  const payMix = useMemo(() => {
    /* 5.64.0 — the mix reads the LEDGER, not the covering method: a split
       ticket's parts each land under the method that took them, and "money
       still out" is the BALANCE (total − ledger parts), not the whole ticket.
       Legacy pre-007 tickets (no ledger rows) keep the stored-method
       fallback, so old history never vanishes from the mix. */
    const cancelledIds = new Set(
      inRange.filter((o) => String(o.status || '').toLowerCase() === 'cancelled').map((o) => o.id)
    );
    const rowsByOrder = new Map<string, (ReceiptPayment & { orderId: string })[]>();
    for (const r of ledger) {
      if (cancelledIds.has(r.orderId)) continue;
      const cur = rowsByOrder.get(r.orderId);
      if (cur) cur.push(r);
      else rowsByOrder.set(r.orderId, [r]);
    }
    const mix = new Map<string, { method: string; count: number; total: number }>();
    let unpaid = 0;
    let unpaidAmt = 0;
    let splitTickets = 0;
    for (const o of inRange) {
      if (String(o.status || '').toLowerCase() === 'cancelled') continue;
      const rows = rowsByOrder.get(o.id) || [];
      if (String(o.payment_status || '').toLowerCase() === 'completed') {
        if (rows.length > 1) splitTickets += 1;
        if (rows.length > 0) {
          for (const r of rows) {
            const m = String(r.method || 'cash').toLowerCase();
            const cur = mix.get(m) || { method: m, count: 0, total: 0 };
            cur.count += 1;
            cur.total += Number(r.amount || 0);
            mix.set(m, cur);
          }
        } else {
          const m = String(o.payment_method || 'cash').toLowerCase();
          const cur = mix.get(m) || { method: m, count: 0, total: 0 };
          cur.count += 1;
          cur.total += Number(o.total ?? 0);
          mix.set(m, cur);
        }
      } else {
        unpaid += 1;
        const paid = rows.reduce((s, r) => s + Number(r.amount || 0), 0);
        unpaidAmt += Math.max(0, Number(o.total ?? 0) - paid);
      }
    }
    const paid = [...mix.values()].sort((a, b) => b.total - a.total);
    return { paid, unpaid, unpaidAmt, splitTickets };
  }, [inRange, ledger]);

  const topItems = useMemo(() => {
    const byName = new Map<string, ItemRank>();
    for (const o of inRange) {
      if (String(o.status || '').toLowerCase() === 'cancelled') continue;
      for (const it of o.items || []) {
        const priced = unitCosts.has(it.menu_item_id ?? '');
        const cur = byName.get(it.name) || { name: it.name, units: 0, revenue: 0, cost: 0, priced };
        cur.units += Number(it.qty ?? 0);
        cur.revenue += Number(it.item_total ?? Number(it.unit_price ?? 0) * Number(it.qty ?? 0));
        // base-recipe ingredient cost for the units sold (variants/add-ons not priced)
        cur.cost += (unitCosts.get(it.menu_item_id ?? '') ?? 0) * Number(it.qty ?? 0);
        byName.set(it.name, cur);
      }
    }
    return [...byName.values()].sort((a, b) => b.revenue - a.revenue);
  }, [inRange, unitCosts]);

  /* 5.72.0 — the earner's list. Top items ranks by what dishes RING; this ranks
   * by what they KEEP (revenue − ingredient cost). Only recipe-priced dishes
   * speak here — an unpriced dish would claim a fake 100% margin. The sell rank
   * rides along so the board can name the divergence: the dish that sells most
   * is not always the dish that earns most. */
  const marginRank = useMemo(
    () =>
      topItems
        .filter((it) => it.priced && it.revenue > 0)
        .sort((a, b) => b.revenue - b.cost - (a.revenue - a.cost)),
    [topItems],
  );
  const sellsRank = useMemo(() => {
    const m = new Map<string, number>();
    topItems.forEach((it, i) => m.set(it.name, i + 1));
    return m;
  }, [topItems]);

  /* 5.73.0 — the menu's quadrants (classic menu engineering, honestly computed).
   * Popularity = units vs the priced menu's average units; richness = per-unit
   * contribution margin vs the average. Stars protect themselves; Plowhorses
   * sell but keep little (re-price or re-recipe); Puzzles keep much but sell
   * little (push them); Dogs do neither. Relative by nature — needs ≥2 priced
   * dishes before a split means anything. */
  const menuMatrix = useMemo(() => {
    const priced = topItems.filter((it) => it.priced && it.revenue > 0 && it.units > 0);
    if (priced.length < 2) return null;
    const avgUnits = priced.reduce((s, it) => s + it.units, 0) / priced.length;
    const avgCm = priced.reduce((s, it) => s + (it.revenue - it.cost) / it.units, 0) / priced.length;
    const cells: Record<'star' | 'plowhorse' | 'puzzle' | 'dog', ItemRank[]> = {
      star: [], plowhorse: [], puzzle: [], dog: [],
    };
    for (const it of priced) {
      const pop = it.units >= avgUnits;
      const rich = (it.revenue - it.cost) / it.units >= avgCm;
      cells[pop && rich ? 'star' : pop && !rich ? 'plowhorse' : !pop && rich ? 'puzzle' : 'dog'].push(it);
    }
    return { cells, avgUnits, avgCm, n: priced.length };
  }, [topItems]);

  const typeMix = useMemo(() => {
    const m = new Map<string, { count: number; total: number }>();
    for (const o of inRange) {
      if (String(o.status || '').toLowerCase() === 'cancelled') continue;
      const t = String(o.order_type || 'dine_in');
      const cur = m.get(t) || { count: 0, total: 0 };
      cur.count += 1;
      cur.total += Number(o.total ?? 0);
      m.set(t, cur);
    }
    return [...m.entries()].sort((a, b) => b[1].total - a[1].total);
  }, [inRange]);

  const maxHour = useMemo(() => Math.max(1, ...hourly.map((h) => h.gross)), [hourly]);

  const exportRanking = useCallback(() => {
    if (topItems.length === 0) return;
    const earnsRank = new Map<string, number>();
    marginRank.forEach((it, i) => earnsRank.set(it.name, i + 1));
    const className = new Map<string, string>();
    if (menuMatrix) {
      for (const [key, dishes] of Object.entries(menuMatrix.cells)) {
        for (const d of dishes) className.set(d.name, key);
      }
    }
    const rows: (string | number)[][] = [
      ['Rank', 'Item', 'Units sold', 'Revenue (INR)', 'Ingredient cost (INR)', 'Margin (INR)', 'Margin %', 'Share of item revenue %', 'Sells rank', 'Earns rank', 'Quadrant'],
    ];
    const total = topItems.reduce((n, it) => n + it.revenue, 0) || 1;
    topItems.forEach((it, i) => {
      const margin = it.revenue - it.cost;
      const marginPct = it.revenue > 0 ? (margin / it.revenue) * 100 : 0;
      rows.push([
        i + 1,
        it.name,
        it.units,
        it.revenue.toFixed(2),
        it.cost.toFixed(2),
        margin.toFixed(2),
        marginPct.toFixed(1),
        ((it.revenue / total) * 100).toFixed(1),
        i + 1,
        it.priced ? (earnsRank.get(it.name) ?? '') : 'unpriced',
        it.priced ? (className.get(it.name) ?? '') : '',
      ]);
    });
    downloadCsv(`servepoint-top-items-${appTodayIso()}.csv`, rows);
  }, [topItems, marginRank, menuMatrix]);

  /* v5.153.0 — one assembly feeds Copy + WhatsApp (5.146.0 rule, ranking
   * edition): the chat best-sellers are built from the same topItems /
   * marginRank / sellsRank memos the screen renders, so screen and chat
   * can never disagree. Earner rank is the earner's list position. Hooks
   * live ABOVE the early returns — a crash here taught the order rule. */
  const topShareOpts = useMemo<TopTextOpts>(() => {
    const revTotal = topItems.reduce((n, it) => n + it.revenue, 0) || 1;
    return {
      storeName: tenant?.name || 'ServePoint store',
      rangeLabel: RANGE_LABEL[range],
      items: topItems.slice(0, 8).map((it) => ({
        name: it.name,
        units: it.units,
        revenue: it.revenue,
        sharePct: (it.revenue / revTotal) * 100,
        marginPct: it.priced && it.revenue > 0 ? ((it.revenue - it.cost) / it.revenue) * 100 : null,
        kept: it.priced ? it.revenue - it.cost : null,
      })),
      earners: marginRank.slice(0, 8).map((it) => ({
        name: it.name,
        kept: it.revenue - it.cost,
        marginPct: it.revenue > 0 ? ((it.revenue - it.cost) / it.revenue) * 100 : 0,
        sellsRank: sellsRank.get(it.name) ?? 0,
      })),
      itemsSold: agg.items,
    };
  }, [tenant?.name, range, topItems, sellsRank, agg.items]);
  const topText = topItems.length > 0 ? buildTopText(topShareOpts) : '';
  const [topCopyState, setTopCopyState] = useState<'idle' | 'ok' | 'fail'>('idle');
  const copyTop = async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('clipboard unavailable');
      await navigator.clipboard.writeText(topText);
      setTopCopyState('ok');
    } catch {
      setTopCopyState('fail');
    }
    window.setTimeout(() => setTopCopyState('idle'), 1800);
  };

  /* ── guest satisfaction (019) — range-scoped reads, fail-soft data ── */

  const fbInRange = useMemo(() => {
    const { startMs, endMs } = rangeWindow(range);
    return feedback.filter((f) => {
      const t = new Date(f.created_at).getTime();
      if (Number.isNaN(t)) return false;
      if (startMs !== null && (t < startMs || t >= endMs)) return false;
      return true;
    });
  }, [feedback, range]);

  const fbAgg = useMemo(() => {
    const stars = [0, 0, 0, 0, 0]; // index 0 = 1★ … 4 = 5★
    let sum = 0;
    for (const f of fbInRange) {
      sum += f.rating;
      stars[Math.min(5, Math.max(1, Math.round(f.rating))) - 1] += 1;
    }
    const avg = fbInRange.length > 0 ? sum / fbInRange.length : null;
    const quotes = fbInRange
      .filter((f) => f.comment && f.comment.trim().length > 0)
      .slice(0, 3);
    /* 5.70.0 — the recover list: every rating ≤ 3 in the window, newest
       first. The bell already rings at ≤ 2 (030's trigger); this is the
       owner's season-long callback sheet — the three-star "meh" deserves
       a name too. Capped on screen, complete in the CSV. */
    const low = fbInRange
      .filter((f) => f.rating <= 3)
      .slice(0, 8);
    return { stars, avg, count: fbInRange.length, quotes, low };
  }, [fbInRange]);

  /* v5.156.0 — one assembly feeds Copy + WhatsApp (5.146.0 rule, guest
   * voices edition): built from the same fbAgg memo the screen renders.
   * Hooks stay above the early returns — the 192 rule. The chat caps
   * mirror the screen's (3 quotes, 5 recover rows); lowTotal keeps the
   * "+ more in the CSV" honest. */
  const ratingsShareOpts = useMemo<GuestVoiceOpts>(() => ({
    storeName: tenant?.name || 'ServePoint store',
    rangeLabel: RANGE_LABEL[range],
    avg: fbAgg.avg,
    avgWord: fbAgg.avg !== null ? ratingWord(fbAgg.avg) : '',
    count: fbAgg.count,
    commentCount: fbAgg.quotes.length,
    stars: fbAgg.stars,
    comments: fbAgg.quotes.map((q) => ({
      rating: q.rating,
      orderNumber: q.order_number,
      text: (q.comment ?? '').trim(),
    })),
    low: fbAgg.low.slice(0, 5).map((f) => ({
      name: f.customer_name ?? null,
      phone: f.customer_phone ?? null,
      rating: f.rating,
      orderNumber: f.order_number,
      when: appFormatters().dt.format(new Date(f.created_at)),
      comment: f.comment,
    })),
    lowTotal: fbInRange.filter((f) => f.rating <= 3).length,
  }), [tenant?.name, range, fbAgg, fbInRange]);
  const ratingsText = fbAgg.count > 0 ? buildRatingsText(ratingsShareOpts) : '';
  const [ratingsCopyState, setRatingsCopyState] = useState<'idle' | 'ok' | 'fail'>('idle');
  const copyRatings = async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('clipboard unavailable');
      await navigator.clipboard.writeText(ratingsText);
      setRatingsCopyState('ok');
    } catch {
      setRatingsCopyState('fail');
    }
    window.setTimeout(() => setRatingsCopyState('idle'), 1800);
  };

  /* ── 5.77.0 — the bin's bill: what the shelf threw away, in rupees ── */

  const wasteAgg = useMemo(() => {
    const moves = waste || [];
    const { startMs, endMs } = rangeWindow(range);
    const inWin = moves.filter((m) => {
      const t = new Date(m.created_at).getTime();
      if (Number.isNaN(t)) return false;
      if (startMs !== null && (t < startMs || t >= endMs)) return false;
      return true;
    });
    /* Each move is valued at its SKU's cost on file. A SKU with no cost on
       file counts as UNVALUED — the bill stays silent rather than guessing
       a rupee (the same honesty the earner's list gives unpriced dishes).
       027's server guard makes waste leave the shelf (negative qty), so the
       bill reads |qty| — but abs() defensively anyway. */
    const valueOf = (m: WasteMove): number | null => {
      const c = m.inventory_items?.cost_per_unit;
      if (c === null || c === undefined) return null;
      return Math.abs(Number(m.qty)) * Number(c);
    };
    let total = 0;
    let unvalued = 0;
    const reasons: Record<'spoilage' | 'spillage' | 'damage', { rupees: number; count: number }> = {
      spoilage: { rupees: 0, count: 0 },
      spillage: { rupees: 0, count: 0 },
      damage: { rupees: 0, count: 0 },
    };
    const byItem = new Map<
      string,
      { name: string; unit: string; qty: number; rupees: number; count: number; unvalued: number; last: string; note: string }
    >();
    for (const m of inWin) {
      const v = valueOf(m);
      if (v === null) unvalued += 1;
      else total += v;
      const r = reasons[m.reason as keyof typeof reasons];
      if (r) {
        if (v !== null) r.rupees += v;
        r.count += 1;
      }
      const key = m.inventory_items?.name || 'Unknown SKU';
      const cur =
        byItem.get(key) ||
        {
          name: key,
          unit: m.inventory_items?.unit || '',
          qty: 0,
          rupees: 0,
          count: 0,
          unvalued: 0,
          last: m.created_at,
          note: m.note || '',
        };
      cur.qty += Math.abs(Number(m.qty));
      cur.count += 1;
      if (v === null) cur.unvalued += 1;
      else cur.rupees += v;
      if (new Date(m.created_at).getTime() > new Date(cur.last).getTime()) cur.last = m.created_at;
      byItem.set(key, cur);
    }
    const items = [...byItem.values()]
      .sort((a, b) => b.rupees - a.rupees || b.count - a.count || a.name.localeCompare(b.name))
      .slice(0, 6);
    return { count: inWin.length, total, unvalued, reasons, items };
  }, [waste, range]);

  /* ── 5.71.0 — the offer's scorecard: every offer answers for itself ── */

  const offerAgg = useMemo(() => {
    const { startMs, endMs } = rangeWindow(range);
    const inWin = redemptions.filter((r) => {
      const t = new Date(r.createdAt).getTime();
      if (Number.isNaN(t)) return false;
      if (startMs !== null && (t < startMs || t >= endMs)) return false;
      return true;
    });
    const byOffer = new Map<string, { uses: number; discountSum: number; revenue: number; lastAt: string | null }>();
    for (const r of inWin) {
      const cur = byOffer.get(r.offerId) || { uses: 0, discountSum: 0, revenue: 0, lastAt: null as string | null };
      cur.uses += 1;
      cur.discountSum += r.discountAmount;
      cur.revenue += r.orderTotal ?? 0;
      if (!cur.lastAt || r.createdAt > cur.lastAt) cur.lastAt = r.createdAt;
      byOffer.set(r.offerId, cur);
    }
    /* every offer on the books gets a row — an offer with zero rides in the
       window speaks honest zeros, it does not vanish (the dead offer is the
       one the owner most needs to see). Orphaned redemptions (offer row gone
       despite the CASCADE) still render defensively. */
    const rows = new Map<string, { id: string; title: string; isActive: boolean; uses: number; discountSum: number; revenue: number; lastAt: string | null; voice: string }>();
    const voiceOf = (o: Offer) => (o.discount_type === 'flat' ? `${formatMoney(Number(o.discount_value))} off` : `${Number(o.discount_value)}% off`);
    for (const o of offersList) {
      const v = byOffer.get(o.id);
      rows.set(o.id, {
        id: o.id,
        title: o.title,
        isActive: o.is_active,
        uses: v?.uses ?? 0,
        discountSum: v?.discountSum ?? 0,
        revenue: v?.revenue ?? 0,
        lastAt: v?.lastAt ?? null,
        voice: voiceOf(o),
      });
    }
    for (const [id, v] of byOffer) {
      if (rows.has(id)) continue;
      rows.set(id, {
        id,
        title: inWin.find((r) => r.offerId === id)?.title || 'an offer since gone',
        isActive: false,
        uses: v.uses,
        discountSum: v.discountSum,
        revenue: v.revenue,
        lastAt: v.lastAt,
        voice: '',
      });
    }
    const list = [...rows.values()].sort((a, b) => b.uses - a.uses || b.revenue - a.revenue || a.title.localeCompare(b.title));
    const totalUses = list.reduce((s, o) => s + o.uses, 0);
    const totalDiscount = list.reduce((s, o) => s + o.discountSum, 0);
    const totalRevenue = list.reduce((s, o) => s + o.revenue, 0);
    return { list, totalUses, totalDiscount, totalRevenue, offerCount: offersList.length };
  }, [redemptions, offersList, range]);

  const exportOffers = useCallback(() => {
    if (offerAgg.list.length === 0) return;
    const rows: (string | number)[][] = [
      ['Offer scorecard — how the counter\'s offers performed', ''],
      ['Offer', 'State', 'Discount', 'Tickets', 'Brought in', 'Discount cost', `Last redemption (${appTzTag()})`],
    ];
    for (const o of offerAgg.list) {
      rows.push([
        o.title,
        o.isActive ? 'active' : 'paused',
        o.voice,
        o.uses,
        formatMoney(o.revenue),
        formatMoney(o.discountSum),
        o.lastAt ? appFormatters().dt.format(new Date(o.lastAt)) : '',
      ]);
    }
    downloadCsv(`servepoint-offer-scorecard-${appTodayIso()}.csv`, rows);
  }, [offerAgg]);

  /* v5.154.0 — one assembly feeds Copy + WhatsApp (5.146.0 rule, scorecard
   * edition): built from the same offerAgg memo the screen renders. Hooks
   * stay above the early returns — the 192 rule. Zero-ride offers ride
   * along with honest zeros, exactly as the screen shows them. */
  const offerScoreOpts = useMemo<OfferScoreOpts>(() => ({
    storeName: tenant?.name || 'ServePoint store',
    rangeLabel: RANGE_LABEL[range],
    offers: offerAgg.list.map((o) => ({
      title: o.title,
      voice: o.voice,
      isActive: o.isActive,
      uses: o.uses,
      revenue: o.revenue,
      discount: o.discountSum,
      lastRode: o.lastAt ? appFormatters().dt.format(new Date(o.lastAt)) : null,
    })),
    totalUses: offerAgg.totalUses,
    totalDiscount: offerAgg.totalDiscount,
    totalRevenue: offerAgg.totalRevenue,
  }), [tenant?.name, range, offerAgg]);
  const offerScoreText = offerAgg.list.length > 0 ? buildOfferScoreText(offerScoreOpts) : '';
  const [scoreCopyState, setScoreCopyState] = useState<'idle' | 'ok' | 'fail'>('idle');
  const copyScore = async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('clipboard unavailable');
      await navigator.clipboard.writeText(offerScoreText);
      setScoreCopyState('ok');
    } catch {
      setScoreCopyState('fail');
    }
    window.setTimeout(() => setScoreCopyState('idle'), 1800);
  };

  const exportRatings = useCallback(() => {
    if (fbAgg.count === 0) return;
    const rows: (string | number)[][] = [
      [`Submitted (${appTzTag()})`, 'Order #', 'Rating (1-5)', 'Comment'],
    ];
    for (const f of [...fbInRange].reverse()) {
      rows.push([
        appFormatters().dt.format(new Date(f.created_at)),
        f.order_number,
        f.rating,
        f.comment ?? '',
      ]);
    }
    if (fbAgg.low.length > 0) {
      rows.push(
        [],
        ['The recover list — every rating ≤ 3, newest first'],
        [`Submitted (${appTzTag()})`, 'Order #', 'Rating', 'Guest', 'Phone', 'Comment'],
      );
      for (const f of fbAgg.low) {
        rows.push([
          appFormatters().dt.format(new Date(f.created_at)),
          f.order_number,
          f.rating,
          f.customer_name ?? '',
          f.customer_phone ?? '',
          f.comment ?? '',
        ]);
      }
    }
    downloadCsv(`servepoint-guest-ratings-${appTodayIso()}.csv`, rows);
  }, [fbInRange, fbAgg]);

  /* ── kitchen speed (5.67.0) — the stopwatch that reads the hop ledger ───── */

  const kitchen = useMemo(() => kitchenSpeed(inRange, hops), [inRange, hops]);

  /* v5.161.0 — the room's breathing, off the same two streams the kitchen
   * stopwatch reads (inRange + hop ledger): zero new fetches. Hooks stay
   * above the early returns — the 192 rule. */
  const turnover = useMemo(() => tableTurnover(inRange, hops), [inRange, hops]);

  const exportTurnover = useCallback(() => {
    if (turnover.tickets === 0) return;
    const rows: (string | number)[][] = [
      [`Table turnover (placed → paid, ${appTzTag()})`, ''],
      ['Dine-in tickets', turnover.tickets],
      ['Tables touched', turnover.tablesTouched],
      ['Spans timed', turnover.spans.n],
      ['Average span', turnover.spans.avgMin != null ? fmtDuration(turnover.spans.avgMin) : '—'],
      [
        'Longest span',
        turnover.longest
          ? `#${turnover.longest.orderNumber} · ${turnover.longest.tableLabel} · ${fmtDuration(turnover.longest.minutes)}`
          : '—',
      ],
      [],
      ['Table', 'Turns', 'Timed spans', 'Average span', 'Longest span'],
    ];
    for (const t of turnover.perTable) {
      rows.push([
        t.tableLabel,
        t.turns,
        t.timed,
        t.avgSpanMin != null ? fmtDuration(t.avgSpanMin) : '—',
        t.longestSpanMin != null ? fmtDuration(t.longestSpanMin) : '—',
      ]);
    }
    downloadCsv(`servepoint-table-turnover-${appTodayIso()}.csv`, rows);
  }, [turnover]);

  const exportKitchenSpeed = useCallback(() => {
    if (kitchen.sample.length === 0) return;
    const rows: (string | number)[][] = [
      [`Kitchen speed (fire → ready, ${appTzTag()})`, ''],
      ['Tickets timed', kitchen.sample.length],
      ['Average', fmtDuration(kitchen.avgMin ?? 0)],
      ['Median', fmtDuration(kitchen.medianMin ?? 0)],
      ['Slowest', kitchen.slowest ? `#${kitchen.slowest.orderNumber} · ${fmtDuration(kitchen.slowest.minutes)}` : '—'],
      [`Over the 10-minute SLA`, kitchen.breaches.length],
      [],
      ['Ticket', `Fired (${appTzTag()})`, `Ready (${appTzTag()})`, 'Duration', 'SLA'],
    ];
    for (const t of [...kitchen.sample].sort((a, b) => b.minutes - a.minutes)) {
      rows.push([
        `#${t.orderNumber}`,
        appFormatters().dt.format(t.firedAt),
        appFormatters().dt.format(t.readyAt),
        fmtDuration(t.minutes),
        t.minutes > 10 ? 'over' : 'ok',
      ]);
    }
    if (kitchen.items.length > 0) {
      rows.push(
        [],
        ['The slow dish — fire-to-ready span of every timed ticket the dish rode on'],
        ['Item', 'Tickets timed', 'Average', 'Slowest ticket span', 'Own-clock average', 'Own-clock slowest', 'Own-clock tickets'],
      );
      for (const d of kitchen.items) {
        rows.push([
          d.name,
          d.tickets,
          fmtDuration(d.avgMin),
          fmtDuration(d.slowestMin),
          d.own ? fmtDuration(d.own.avgMin) : '',
          d.own ? fmtDuration(d.own.slowestMin) : '',
          d.own ? d.own.n : '',
        ]);
      }
    }
    downloadCsv(`servepoint-kitchen-speed-${appTodayIso()}.csv`, rows);
  }, [kitchen]);

  /* v5.155.0 — one assembly feeds Copy + WhatsApp (5.146.0 rule, kitchen
   * edition): built from the same kitchen memo the screen renders. Hooks
   * stay above the early returns — the 192 rule. The card's honesty rides
   * verbatim: top-5 slowest in the screen's own order, the waited-for dish
   * first, own-clock only when the check ledger has one, small-sample
   * prose under three timed tickets. */
  const kitchenShareOpts = useMemo<KitchenSpeedOpts>(() => ({
    storeName: tenant?.name || 'ServePoint store',
    rangeLabel: RANGE_LABEL[range],
    timed: kitchen.sample.length,
    avgMin: kitchen.avgMin,
    medianMin: kitchen.medianMin,
    slowest: kitchen.slowest
      ? { orderNumber: kitchen.slowest.orderNumber, minutes: kitchen.slowest.minutes }
      : null,
    breaches: kitchen.breaches.length,
    tickets: [...kitchen.sample]
      .sort((a, b) => b.minutes - a.minutes)
      .slice(0, 5)
      .map((t) => ({
        orderNumber: t.orderNumber,
        minutes: t.minutes,
        firedAt: appFormatters().dt.format(t.firedAt),
        over: t.minutes > 10,
      })),
    dishes: kitchen.items.slice(0, 5).map((d, i) => ({
      name: d.name,
      tickets: d.tickets,
      avgMin: d.avgMin,
      slowestMin: d.slowestMin,
      own: d.own ? { avgMin: d.own.avgMin, n: d.own.n } : null,
      waitedFor: i === 0,
    })),
  }), [tenant?.name, range, kitchen]);
  const kitchenSpeedText = kitchen.sample.length > 0 ? buildKitchenSpeedText(kitchenShareOpts) : '';
  const [kitchenCopyState, setKitchenCopyState] = useState<'idle' | 'ok' | 'fail'>('idle');
  const copyKitchenSpeed = async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('clipboard unavailable');
      await navigator.clipboard.writeText(kitchenSpeedText);
      setKitchenCopyState('ok');
    } catch {
      setKitchenCopyState('fail');
    }
    window.setTimeout(() => setKitchenCopyState('idle'), 1800);
  };

  /* ── drawer honesty (020) — sealed shifts only, variance is STORED truth ── */

  const shiftsInRange = useMemo(() => {
    const { startMs, endMs } = rangeWindow(range);
    return shifts.filter((s) => {
      if (!s.closed_at) return false; // the section speaks only about SEALED shifts
      const t = new Date(s.closed_at).getTime();
      if (Number.isNaN(t)) return false;
      if (startMs !== null && (t < startMs || t >= endMs)) return false;
      return true;
    });
  }, [shifts, range]);

  const shiftAgg = useMemo(() => {
    let net = 0;
    for (const s of shiftsInRange) net += Number(s.variance ?? 0);
    return { net, count: shiftsInRange.length };
  }, [shiftsInRange]);

  /* v5.157.0 — one assembly feeds Copy + WhatsApp (5.146.0 rule, drawer
   * edition): built from the same shiftsInRange/shiftAgg memos the screen
   * renders (declared just above). Hooks stay above the early returns —
   * the 192 rule. The chat word is the card's tone tiers in compact
   * register (clean keeps the full "matches the ledger"; slips and
   * investigations shorten to fit the detail width without wrapping);
   * the closing note rides as quoted prose, and a clean shift's silence
   * about notes is deliberate. */
  const drawerChatWord = (v: number): string | null => {
    const abs = Math.abs(v);
    if (abs < 0.005) return 'matches the ledger';
    if (abs <= 20) return 'small slip — noted';
    return v > 0 ? 'over — investigate' : 'short — investigate';
  };
  const drawerShareOpts = useMemo<DrawerOpts>(() => ({
    storeName: tenant?.name || 'ServePoint store',
    rangeLabel: RANGE_LABEL[range],
    net: shiftAgg.net,
    netWord: varianceTone(shiftAgg.net).label,
    sealed: shiftAgg.count,
    shifts: shiftsInRange.slice(0, 5).map((s) => {
      const v = Number(s.variance ?? 0);
      return {
        when: s.closed_at ? appFormatters().dt.format(new Date(s.closed_at)) : '—',
        expected: Number(s.expected_cash ?? 0),
        counted: Number(s.counted_cash ?? 0),
        variance: v,
        word: drawerChatWord(v),
        note: s.closing_note,
      };
    }),
    shiftTotal: shiftsInRange.length,
  }), [tenant?.name, range, shiftAgg, shiftsInRange]);
  const drawerText = shiftAgg.count > 0 ? buildDrawerText(drawerShareOpts) : '';
  const [drawerCopyState, setDrawerCopyState] = useState<'idle' | 'ok' | 'fail'>('idle');
  const copyDrawer = async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('clipboard unavailable');
      await navigator.clipboard.writeText(drawerText);
      setDrawerCopyState('ok');
    } catch {
      setDrawerCopyState('fail');
    }
    window.setTimeout(() => setDrawerCopyState('idle'), 1800);
  };

  /* ── trends — the shape of the range, IST day by day (2.0 section) ─────── */

  const daily = useMemo(() => {
    // Bucket orders into IST days — cancelled excluded, same as every money figure.
    // v5.25.0: gst/net/items ride along (same semantics as aggregateTickets) so
    // the headline chips can draw the day-shape behind their delta.
    const byDay = new Map<string, { gross: number; tickets: number; gst: number; net: number; items: number }>();
    for (const o of inRange) {
      if (String(o.status || '').toLowerCase() === 'cancelled') continue;
      const key = appDayKey(o.created_at);
      const cur = byDay.get(key) || { gross: 0, tickets: 0, gst: 0, net: 0, items: 0 };
      cur.gross += Number(o.total ?? 0);
      cur.tickets += 1;
      cur.gst += Number(o.tax_amount ?? 0);
      cur.net += Number(o.subtotal ?? 0) - Number(o.discount_amount ?? 0);
      cur.items += (o.items || []).reduce((n, it) => n + Number(it.qty ?? 0), 0);
      byDay.set(key, cur);
    }
    // The window: filled calendar days for 7d/30d (gaps read as slow days),
    // today's single day, or — for All time — the most recent 30 days that
    // actually hold tickets, said honestly in the caption. Days are stepped
    // as calendar STRINGS through the lib (DST-safe — a 24h ms stride drifts
    // across a zone's spring-forward).
    let dayMs: number[] = [];
    if (range === 'today') {
      dayMs = [appDayStartMs(appTodayIso())];
    } else if (range === '7d' || range === '30d') {
      const days = range === '7d' ? 7 : 30;
      const dayKeys: string[] = [];
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date(`${appTodayIso()}T12:00:00Z`);
        d.setUTCDate(d.getUTCDate() - i);
        dayKeys.push(d.toISOString().slice(0, 10));
      }
      dayMs = dayKeys.map((k) => appDayStartMs(k));
    } else {
      dayMs = [...byDay.keys()]
        .sort()
        .slice(-30)
        .map((k) => appDayStartMs(k));
    }
    return dayMs.map((ms) => {
      const key = appDayKey(new Date(ms).toISOString());
      const cur = byDay.get(key) || { gross: 0, tickets: 0, gst: 0, net: 0, items: 0 };
      return {
        key,
        label: appFormatters().dayLabel.format(new Date(ms)),
        gross: cur.gross,
        tickets: cur.tickets,
        gst: cur.gst,
        net: cur.net,
        items: cur.items,
        avg: cur.tickets > 0 ? cur.gross / cur.tickets : 0,
      };
    });
  }, [inRange, range]);

  const bestDay = useMemo(() => {
    let best: { label: string; gross: number } | null = null;
    for (const d of daily) if (!best || d.gross > best.gross) best = { label: d.label, gross: d.gross };
    return best && best.gross > 0 ? best : null;
  }, [daily]);

  const exportDaily = useCallback(() => {
    if (daily.length === 0) return;
    const rows: (string | number)[][] = [[`Day (${appTzTag()})`, 'Gross (INR)', 'Tickets', 'Avg ticket (INR)']];
    for (const d of daily) {
      rows.push([d.label, d.gross.toFixed(2), d.tickets, d.tickets > 0 ? d.avg.toFixed(2) : '']);
    }
    downloadCsv(`servepoint-daily-sales-${appTodayIso()}.csv`, rows);
  }, [daily]);

  /* 5.96.0 — the day door: a bar is a day's whole counted book one tap away.
     Close-out already browses any IST day (its own Previous/Next arrows);
     the sectionHint grammar carries the day key there — consumed once on
     arrival, never persisted, never riding the URL. */
  const openDayInCloseout = useCallback((key: string) => {
    useUi.getState().goSection('eod', ['Reports', 'Close-out'], `day:${key}`);
  }, []);

  /* ── v5.147.0 — the range report's chat voice: Copy + WhatsApp. The opts
     come from the SAME memos the screen renders (agg / payMix / topItems /
     daily / hourly) — one assembly, so chat can never quote a number the
     screen disagrees with. WhatsApp opens the PICKER, like the Z-report's
     twin: a business summary goes where the OWNER sends it — their
     bookkeeper, their partners' group — never a guessed recipient. */
  const buildRepOpts = (): ReportOpts => {
    const peak = hourly.reduce<{ label: string; gross: number } | null>(
      (best, h) => (h.gross > 0 && (!best || h.gross > best.gross) ? { label: h.label, gross: h.gross } : best),
      null,
    );
    const windowLabel =
      daily.length === 0
        ? RANGE_LABEL[range].toLowerCase()
        : daily.length === 1
          ? daily[0].label
          : `${daily[0].label} – ${daily[daily.length - 1].label}`;
    return {
      storeName: tenant?.name || 'ServePoint store',
      rangeLabel: RANGE_LABEL[range],
      windowLabel,
      tz: appTimezone(),
      gross: agg.gross,
      gst: agg.gst,
      net: agg.net,
      orders: agg.placed,
      items: agg.items,
      avgTicket: agg.avgTicket,
      cancelled: agg.cancelled,
      paidNet: agg.paidNet,
      paidCount: agg.paidCount,
      cogs: agg.cogs,
      margin: agg.margin,
      marginPct: agg.marginPct,
      mix: payMix.paid.map((m) => ({ method: m.method, count: m.count, amount: m.total })),
      unpaidAmt: payMix.unpaidAmt,
      unpaid: payMix.unpaid,
      splitTickets: payMix.splitTickets,
      top: topItems
        .filter((t) => t.revenue > 0)
        .slice(0, 3)
        .map((t) => ({ name: t.name, units: t.units, revenue: t.revenue })),
      bestDay,
      peakHour: peak,
    };
  };
  const [repCopyState, setRepCopyState] = useState<'idle' | 'ok' | 'fail'>('idle');
  const copyReport = async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('clipboard unavailable');
      await navigator.clipboard.writeText(buildReportText(buildRepOpts()));
      setRepCopyState('ok');
    } catch {
      setRepCopyState('fail');
    }
    window.setTimeout(() => setRepCopyState('idle'), 1800);
  };
  const printRange = () => {
    printRangeReport(buildRepOpts());
  };

  /* ── 5.50.0 — the other five sections speak CSV too. Reports had exits for
     daily sales, item ranking and guest ratings since 5.3.x; the hour shape,
     the money's arrival, the margin, the service mix and the drawer's honesty
     were chart-only. An owner carrying the week's numbers to an accountant
     should not have to read them off a screen. Same lib, same escape rules,
     one file per section — the spreadsheet owns the formatting. */

  const exportHourly = useCallback(() => {
    // All 24 buckets, zeros included — the gaps ARE the quiet hours; a
    // spreadsheet should see the whole day the chart draws.
    const rows: (string | number)[][] = [[`Hour (${appTzTag()})`, 'Gross (INR)']];
    for (const h of hourly) rows.push([h.label, h.gross.toFixed(2)]);
    downloadCsv(`servepoint-sales-by-hour-${appTodayIso()}.csv`, rows);
  }, [hourly]);

  const exportPayMix = useCallback(() => {
    const rows: (string | number)[][] = [['Method', 'Payments', 'Total (INR)']];
    for (const m of payMix.paid) rows.push([m.method, m.count, m.total.toFixed(2)]);
    if (payMix.splitTickets > 0)
      rows.push([
        `Split tickets — settled in parts`,
        payMix.splitTickets,
        '',
      ]);
    if (payMix.unpaid > 0)
      rows.push(['Unpaid — balance still out', payMix.unpaid, payMix.unpaidAmt.toFixed(2)]);
    if (rows.length === 1) return;
    downloadCsv(`servepoint-payment-mix-${appTodayIso()}.csv`, rows);
  }, [payMix]);

  const exportMargin = useCallback(() => {
    if (agg.paidCount === 0) return;
    const rows: (string | number)[][] = [
      ['Metric', 'Value'],
      ['Range', RANGE_LABEL[range]],
      ['Paid tickets', agg.paidCount],
      ['Paid net (INR)', agg.paidNet.toFixed(2)],
      ['Ingredient cost (INR)', agg.cogs.toFixed(2)],
      ['Gross margin (INR)', agg.margin.toFixed(2)],
      ['Margin rate (%)', agg.marginPct.toFixed(1)],
      ['', ''],
      ['Note', 'Recipes × current shelf cost — a restock reprices history; variants/add-ons not priced.'],
    ];
    downloadCsv(`servepoint-cost-margin-${appTodayIso()}.csv`, rows);
  }, [agg, range]);

  const exportTypeMix = useCallback(() => {
    if (typeMix.length === 0) return;
    const rows: (string | number)[][] = [['Service', 'Tickets', 'Total (INR)', 'Share of orders %']];
    for (const [t, v] of typeMix) {
      const share = agg.placed > 0 ? (v.count / agg.placed) * 100 : 0;
      rows.push([TYPE_LABEL[t] || t, v.count, v.total.toFixed(2), share.toFixed(1)]);
    }
    downloadCsv(`servepoint-service-mix-${appTodayIso()}.csv`, rows);
  }, [typeMix, agg.placed]);

  const exportShifts = useCallback(() => {
    if (shiftAgg.count === 0) return;
    const rows: (string | number)[][] = [
      [`Closed (${appTzTag()})`, 'Expected (INR)', 'Counted (INR)', 'Variance (INR)', 'Closed by', 'Note'],
    ];
    let sumExp = 0;
    let sumCnt = 0;
    for (const s of shiftsInRange) {
      const exp = Number(s.expected_cash ?? 0);
      const cnt = Number(s.counted_cash ?? 0);
      sumExp += exp;
      sumCnt += cnt;
      rows.push([
        s.closed_at ? appFormatters().closeLabel.format(new Date(s.closed_at)) : '—',
        s.expected_cash === null ? '' : exp.toFixed(2),
        s.counted_cash === null ? '' : cnt.toFixed(2),
        s.variance === null ? '' : Number(s.variance).toFixed(2),
        s.closed_by_email || '',
        s.closing_note || '',
      ]);
    }
    rows.push(['NET', sumExp.toFixed(2), sumCnt.toFixed(2), shiftAgg.net.toFixed(2), '', '']);
    downloadCsv(`servepoint-drawer-shifts-${appTodayIso()}.csv`, rows);
  }, [shiftsInRange, shiftAgg]);

  const fbDaily = useMemo(() => {
    const byDay = new Map<string, { sum: number; n: number }>();
    for (const f of fbInRange) {
      const key = appDayKey(f.created_at);
      const cur = byDay.get(key) || { sum: 0, n: 0 };
      cur.sum += f.rating;
      cur.n += 1;
      byDay.set(key, cur);
    }
    if (range === '7d' || range === '30d') {
      // Filled window: unrated days stay null so the line's gaps are honest.
      // Calendar strings through the lib — DST-safe (see the trends window);
      // the window ENDS today, same as the KPI range.
      const days = range === '7d' ? 7 : 30;
      const out: { label: string; avg: number | null; n: number }[] = [];
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date(`${appTodayIso()}T12:00:00Z`);
        d.setUTCDate(d.getUTCDate() - i);
        const key = appDayKey(new Date(appDayStartMs(d.toISOString().slice(0, 10))).toISOString());
        const cur = byDay.get(key);
        out.push({
          label: appFormatters().dayLabel.format(new Date(appDayStartMs(d.toISOString().slice(0, 10)))),
          avg: cur ? cur.sum / cur.n : null,
          n: cur?.n ?? 0,
        });
      }
      return out;
    }
    // Today / All time: only days that actually hold ratings.
    return [...byDay.keys()]
      .sort()
      .map((k) => {
        const cur = byDay.get(k)!;
        return { label: appFormatters().dayLabel.format(new Date(appDayStartMs(k))), avg: cur.sum / cur.n, n: cur.n };
      });
  }, [fbInRange, range]);

  const fbDailyTotals = useMemo(() => {
    let ratings = 0;
    let days = 0;
    for (const d of fbDaily) {
      if (d.avg !== null) days += 1;
      ratings += d.n;
    }
    return { ratings, days };
  }, [fbDaily]);

  /** Diverging variance series for the Drawer honesty mini-chart. */
  const varianceSeries = useMemo(
    () =>
      shiftsInRange.map((s) => ({
        id: s.id,
        short: s.closed_at ? appFormatters().closeLabel.format(new Date(s.closed_at)) : '—',
        variance: Number(s.variance ?? 0),
      })),
    [shiftsInRange],
  );

  const retry = useCallback(() => {
    setLoading(true);
    void load();
  }, [load]);

  if (tenantLoading) return <ReportsSkeleton />;
  if (tenantError)
    return (
      <div className="p-4">
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-2xl border border-[#F0C4BE] bg-[#FEF2F2] px-4 py-3.5"
        >
          <p className="text-[13px] font-semibold text-[#B42318]">{tenantError}</p>
          <button
            onClick={onTenantRetry}
            className="h-11 shrink-0 rounded-lg bg-[#B42318] px-4 text-[12.5px] font-semibold text-white transition hover:bg-[#8F1C13]"
          >
            Retry
          </button>
        </div>
      </div>
    );
  if (!tenantId)
    return (
      <div className="p-4">
        <div className="rounded-2xl border border-[#E3E7E0] bg-white px-4 py-6 text-center text-[13px] text-[#6B6B6B]">
          No workspace is linked to this account.
        </div>
      </div>
    );

  const itemRevenueTotal = topItems.reduce((n, it) => n + it.revenue, 0) || 1;

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* ── header: title + range pills + refresh ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#EAF0EC] text-[#0F3D3E]">
            <TrendingUp size={17} aria-hidden />
          </span>
          <div className="min-w-0">
            <h1 className="sp-screen-title">Reports</h1>
            <p className="truncate text-[11.5px] text-[#6B6B6B]">
              Sales, items and hours — the business over a real range
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="flex rounded-full border border-[#E3E7E0] bg-white p-1"
            role="tablist"
            aria-label="Report range"
          >
            {(Object.keys(RANGE_LABEL) as RangeKey[]).map((k) => (
              <button
                key={k}
                role="tab"
                aria-selected={range === k}
                onClick={() => setRange(k)}
                className={`h-8 rounded-full px-3 text-[12px] font-bold transition ${
                  range === k ? 'bg-[#0F3D3E] text-white' : 'text-[#6B6B6B] hover:text-[#1A1A1A]'
                }`}
              >
                {RANGE_LABEL[k]}
              </button>
            ))}
          </div>
          <button
            onClick={retry}
            disabled={loading}
            aria-label="Refresh report"
            title={refreshedAt ? `Refreshed ${refreshedAt.toLocaleTimeString()}` : 'Refresh'}
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#E3E7E0] bg-white text-[#0F3D3E] transition hover:border-[#B88E2F] hover:text-[#B88E2F] disabled:opacity-50"
          >
            <RefreshCw size={15} aria-hidden className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-xl border border-[#F0C4BE] bg-[#FEF2F2] px-3.5 py-2.5"
        >
          <p className="text-[12px] font-medium text-[#B42318]">Refresh failed: {error}</p>
          <button
            onClick={retry}
            className="h-11 shrink-0 rounded-lg bg-[#B42318] px-3.5 text-[12px] font-semibold text-white transition hover:bg-[#8F1C13]"
          >
            Retry
          </button>
        </div>
      )}

      {/* ── headline strip ── */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard
          label="Gross sales"
          value={formatMoney(agg.gross)}
          tone="#0F3D3E"
          spark={daily.map((d) => d.gross)}
          {...deltaProps(agg.gross, priorAgg?.gross ?? 0, formatMoney)}
        />
        <StatCard
          label="GST collected"
          value={formatMoney(agg.gst)}
          tone="#8A5A00"
          spark={daily.map((d) => d.gst)}
          {...deltaProps(agg.gst, priorAgg?.gst ?? 0, formatMoney)}
        />
        <StatCard
          label="Net (ex-GST)"
          value={formatMoney(agg.net)}
          tone="#0F3D3E"
          spark={daily.map((d) => d.net)}
          {...deltaProps(agg.net, priorAgg?.net ?? 0, formatMoney)}
        />
        <StatCard
          label="Orders"
          value={String(agg.placed)}
          sub={agg.cancelled > 0 ? `${agg.cancelled} cancelled excluded` : 'live in range'}
          tone="#0F3D3E"
          spark={daily.map((d) => d.tickets)}
          {...deltaProps(agg.placed, priorAgg?.placed ?? 0, (n) => String(Math.round(n)))}
        />
        <StatCard
          label="Avg ticket"
          value={formatMoney(agg.avgTicket)}
          tone="#B88E2F"
          spark={daily.map((d) => d.avg)}
          {...deltaProps(agg.avgTicket, priorAgg?.avgTicket ?? 0, formatMoney)}
        />
        <StatCard
          label="Items sold"
          value={String(agg.items)}
          tone="#0F3D3E"
          spark={daily.map((d) => d.items)}
          {...deltaProps(agg.items, priorAgg?.items ?? 0, (n) => String(Math.round(n)))}
        />
      </div>

      {/* ── v5.147.0 — the range's chat voice: the owner's pocket carries the
          whole range now, not just a day. The lead-in chip names the range
          on view (Reports lives under four live ranges — a day summary's
          context is obvious, a range's must be said). Ghost-gold grammar,
          the bill's and the Z's share-row voice. v5.148.0: Print joins —
          the range's paper voice from the same opts. Renders only when the
          range holds live tickets — an empty range has nothing to share. ── */}
      {agg.placed > 0 && !loading && (
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Share this report">
          <span className="inline-flex h-[38px] items-center rounded-xl bg-[#FDF6E3] px-3 text-[10.5px] font-bold uppercase tracking-[0.08em] text-[#8A5A00]">
            {RANGE_LABEL[range]}
          </span>
          <button
            onClick={printRange}
            aria-label={`Print the ${RANGE_LABEL[range]} report`}
            className="flex min-h-[38px] items-center gap-1.5 rounded-xl border border-[#E3E7E0] bg-white px-3.5 text-[12px] font-semibold text-[#0F3D3E] transition hover:border-[#0F3D3E]/40 hover:bg-[#F6F5F2] active:scale-[0.99]"
          >
            <Printer size={14} aria-hidden />
            Print
          </button>
          <button
            onClick={copyReport}
            aria-live="polite"
            aria-label={`Copy the ${RANGE_LABEL[range]} report as text`}
            className="flex min-h-[38px] items-center gap-1.5 rounded-xl border border-[#E3E7E0] bg-white px-3.5 text-[12px] font-semibold text-[#0F3D3E] transition hover:border-[#0F3D3E]/40 hover:bg-[#F6F5F2] active:scale-[0.99]"
          >
            {repCopyState === 'ok' ? (
              <Check size={14} className="text-[#2E7D32]" aria-hidden />
            ) : (
              <Copy size={14} aria-hidden />
            )}
            {repCopyState === 'ok' ? 'Copied' : repCopyState === 'fail' ? 'Copy blocked' : 'Copy report'}
          </button>
          <a
            href={`https://wa.me/?text=${encodeURIComponent(buildReportText(buildRepOpts()))}`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Share the ${RANGE_LABEL[range]} report on WhatsApp`}
            className="flex min-h-[38px] items-center gap-1.5 rounded-xl border border-[#E3E7E0] bg-white px-3.5 text-[12px] font-semibold text-[#0F3D3E] transition hover:border-[#0F3D3E]/40 hover:bg-[#F6F5F2] active:scale-[0.99]"
          >
            <MessageCircle size={14} aria-hidden />
            WhatsApp
          </a>
        </div>
      )}

      {range === 'all' && !loading && (
        <p className="px-1 text-[10.5px] text-[#969696]">
          All time has no earlier window to compare — comparison chips appear on Today, Last 7
          days and Last 30 days.
        </p>
      )}

      {inRange.length === 0 && !loading ? (
        <div className="sp-card flex flex-col items-center justify-center gap-2 px-4 py-14 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#D9E2DD]">
            <CalendarRange size={26} className="text-[#0F3D3E]" aria-hidden />
          </span>
          <h2 className="mt-1 text-[15px] font-bold text-[#1A1A1A]">No sales in this range</h2>
          <p className="max-w-xs text-[12.5px] text-[#6B6B6B]">
            Counter sales and guest QR tickets appear here once placed. Try a wider range.
          </p>
        </div>
      ) : (
        <>
          {/* ── row: trends — day by day + ratings over time ── */}
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <section className="sp-card p-5 xl:col-span-2" aria-label="Sales day by day">
              <div className="mb-1 flex items-center justify-between gap-2">
                <h2 className="text-[15px] font-bold text-[#1A1A1A]">Day by day</h2>
                <div className="flex shrink-0 items-center gap-2">
                  {daily.length > 0 && (
                    <button
                      onClick={exportDaily}
                      aria-label="Export daily sales as CSV"
                      title="Export the day-by-day gross as CSV"
                      className="inline-flex h-7 items-center rounded-lg border border-[#B88E2F]/45 bg-[#FDF9F0] px-2.5 text-[11px] font-bold text-[#8A5A00] transition hover:bg-[#B88E2F] hover:text-white active:scale-[0.97]"
                    >
                      CSV
                    </button>
                  )}
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#6B6B6B]">
                    <CalendarRange size={11} aria-hidden /> {appTzTag()} days ·{' '}
                    {RANGE_LABEL[range].toLowerCase()}
                  </span>
                </div>
              </div>
              {range === 'today' ? (
                <div className="flex h-56 flex-col items-center justify-center gap-2 text-center">
                  <TrendingUp size={22} className="text-[#969696]" aria-hidden />
                  <p className="text-[12.5px] font-semibold text-[#1A1A1A]">
                    One day can't show a shape
                  </p>
                  <p className="max-w-[250px] text-[11.5px] text-[#6B6B6B]">
                    Today's story lives in Sales by hour below. Widen the range and this chart
                    draws the week.
                  </p>
                  <button
                    onClick={() => setRange('7d')}
                    className="mt-1 inline-flex h-9 items-center rounded-lg bg-[#0F3D3E] px-3.5 text-[12px] font-bold text-white transition hover:bg-[#164f50] active:scale-[0.98]"
                  >
                    See last 7 days
                  </button>
                </div>
              ) : (
                <>
                  <p className="mb-3 text-[11.5px] text-[#969696]">
                    Gross ₹ (bars) and tickets (line) per {appTzTag()} day — the shape of the range. Best
                    day:{' '}
                    <span className="font-bold text-[#8A5A00]">
                      {bestDay ? `${bestDay.label} (${formatMoney(bestDay.gross)})` : '—'}
                    </span>
                    {range === 'all' ? ' · most recent 30 ticket days shown' : ''}
                    {/* 5.96.0 — the affordance is said out loud: a bar opens that
                        day's counted book in Close-out. */}
                    <span className="mt-0.5 flex items-center gap-1 font-semibold text-[#1D5D7E]">
                      <MousePointerClick size={11} aria-hidden /> Tap a bar to open that day in
                      Close-out
                    </span>
                  </p>
                  <div
                    className="h-56 [&_.recharts-bar-rectangle]:cursor-pointer [&_.recharts-rectangle]:cursor-pointer"
                    aria-hidden
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={daily} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E3E7E0" vertical={false} />
                        <XAxis
                          dataKey="label"
                          tick={{ fontSize: 10, fill: '#6B6B6B' }}
                          tickLine={false}
                          axisLine={{ stroke: '#E3E7E0' }}
                          interval="preserveStartEnd"
                          minTickGap={14}
                        />
                        <YAxis
                          yAxisId="rupees"
                          tick={{ fontSize: 10, fill: '#969696' }}
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={(v: number) =>
                            v >= 1000 ? `${Math.round(v / 1000)}k` : String(v)
                          }
                        />
                        <YAxis
                          yAxisId="tickets"
                          orientation="right"
                          tick={{ fontSize: 10, fill: '#B88E2F' }}
                          tickLine={false}
                          axisLine={false}
                          allowDecimals={false}
                        />
                        <Tooltip
                          cursor={{ fill: 'rgba(184,142,47,0.08)' }}
                          contentStyle={CHART_TOOLTIP_STYLE}
                          labelStyle={CHART_TOOLTIP_LABEL}
                          formatter={(v: unknown, name: unknown) =>
                            name === 'gross'
                              ? [formatMoney(Number(v)), 'Gross']
                              : [String(v), 'Tickets']
                          }
                        />
                        <Bar
                          yAxisId="rupees"
                          dataKey="gross"
                          radius={[4, 4, 0, 0]}
                          maxBarSize={38}
                          activeBar={{ fill: '#967221' }}
                          onClick={(
                            data: unknown,
                            index: number,
                          ) => {
                            const payload = (data as { payload?: (typeof daily)[number] } | null)
                              ?.payload;
                            const d = payload || (index != null ? daily[index] : undefined);
                            if (d && d.key) openDayInCloseout(d.key);
                          }}
                        >
                          {daily.map((d) => (
                            <Cell
                              key={d.key}
                              fill={
                                bestDay && d.gross > 0 && d.gross === bestDay.gross
                                  ? '#B88E2F'
                                  : '#0F3D3E'
                              }
                            />
                          ))}
                        </Bar>
                        <Line
                          yAxisId="tickets"
                          type="monotone"
                          dataKey="tickets"
                          stroke="#B88E2F"
                          strokeWidth={2}
                          dot={{ r: 2.5, fill: '#B88E2F', strokeWidth: 0 }}
                          activeDot={{ r: 4 }}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </>
              )}
            </section>

            <section className="sp-card p-5" aria-label="Ratings over time">
              <h2 className="mb-1 text-[15px] font-bold text-[#1A1A1A]">Ratings over time</h2>
              <p className="mb-3 text-[11.5px] text-[#969696]">
                Average ★ per {appTzTag()} day — gaps are honest unrated days.{' '}
                {fbDailyTotals.ratings > 0
                  ? `${fbDailyTotals.ratings} rating${fbDailyTotals.ratings === 1 ? '' : 's'} · ${fbDailyTotals.days} day${fbDailyTotals.days === 1 ? '' : 's'} rated.`
                  : ''}
              </p>
              {fbDailyTotals.ratings === 0 ? (
                <div className="flex h-56 flex-col items-center justify-center gap-2 text-center">
                  <Star size={22} className="text-[#969696]" aria-hidden />
                  <p className="text-[12.5px] font-semibold text-[#1A1A1A]">
                    No rated days in this range
                  </p>
                  <p className="max-w-[220px] text-[11.5px] text-[#969696]">
                    Guests rate served tickets from their own phones — the daily line draws
                    itself here.
                  </p>
                </div>
              ) : (
                <div
                  className="h-56"
                  role="img"
                  aria-label={`Ratings trend: ${fbDailyTotals.ratings} ratings over ${fbDailyTotals.days} rated days in range`}
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={fbDaily} margin={{ top: 8, right: 8, bottom: 0, left: -22 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E3E7E0" vertical={false} />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 10, fill: '#6B6B6B' }}
                        tickLine={false}
                        axisLine={{ stroke: '#E3E7E0' }}
                        interval="preserveStartEnd"
                        minTickGap={14}
                      />
                      <YAxis
                        domain={[1, 5]}
                        ticks={[1, 2, 3, 4, 5]}
                        allowDecimals={false}
                        tick={{ fontSize: 10, fill: '#969696' }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip
                        cursor={{ stroke: '#B88E2F', strokeWidth: 1, strokeDasharray: '3 3' }}
                        contentStyle={CHART_TOOLTIP_STYLE}
                        labelStyle={CHART_TOOLTIP_LABEL}
                        formatter={(v: unknown) => [
                          v === null || v === undefined ? '—' : `${Number(v).toFixed(1)}★`,
                          'Avg rating',
                        ]}
                      />
                      <Line
                        type="monotone"
                        dataKey="avg"
                        stroke="#B88E2F"
                        strokeWidth={2.5}
                        connectNulls={false}
                        dot={(props: { cx?: number; cy?: number; payload?: { avg: number | null; n: number } }) => {
                          const { cx, cy, payload } = props;
                          if (!payload || payload.avg === null || cx === undefined || cy === undefined)
                            return <g key={`${cx}-${cy}`} />;
                          return (
                            <circle
                              key={`${cx}-${cy}`}
                              cx={cx}
                              cy={cy}
                              r={3 + Math.min(3, payload.n)}
                              fill="#B88E2F"
                              stroke="#fff"
                              strokeWidth={1.5}
                            />
                          );
                        }}
                        activeDot={{ r: 5, stroke: '#fff', strokeWidth: 2 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </section>
          </div>

          {/* ── row: sales by hour + payment mix ── */}
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <section className="sp-card p-5 xl:col-span-2" aria-label="Sales by hour of day">
              <div className="mb-1 flex items-center justify-between gap-2">
                <h2 className="text-[15px] font-bold text-[#1A1A1A]">Sales by hour</h2>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    onClick={exportHourly}
                    aria-label="Export sales by hour as CSV"
                    title="Export the hour-by-hour gross as CSV"
                    className="inline-flex h-7 items-center rounded-lg border border-[#B88E2F]/45 bg-[#FDF9F0] px-2.5 text-[11px] font-bold text-[#8A5A00] transition hover:bg-[#B88E2F] hover:text-white active:scale-[0.97]"
                  >
                    CSV
                  </button>
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#6B6B6B]">
                    <Clock size={11} aria-hidden /> {appTzTag()} hours · {RANGE_LABEL[range].toLowerCase()}
                  </span>
                </div>
              </div>
              <p className="mb-3 text-[11.5px] text-[#969696]">
                Gross ₹ per hour of day — when the cafe actually earns. Peak hour:{' '}
                <span className="font-bold text-[#8A5A00]">{peakHourLabel(hourly)}</span>
              </p>
              <div className="h-56" aria-hidden>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={hourly} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E3E7E0" vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 10, fill: '#6B6B6B' }}
                      tickLine={false}
                      axisLine={{ stroke: '#E3E7E0' }}
                      interval={2}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: '#969696' }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v: number) =>
                        v >= 1000 ? `${Math.round(v / 1000)}k` : String(v)
                      }
                    />
                    <Tooltip
                      cursor={{ fill: 'rgba(184,142,47,0.08)' }}
                      contentStyle={CHART_TOOLTIP_STYLE}
                      labelStyle={CHART_TOOLTIP_LABEL}
                      formatter={(v: unknown) => [formatMoney(Number(v)), 'Gross']}
                    />
                    <Bar dataKey="gross" radius={[4, 4, 0, 0]}>
                      {hourly.map((h) => (
                        <Cell
                          key={h.hour}
                          fill={h.gross >= maxHour && h.gross > 0 ? '#B88E2F' : '#0F3D3E'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="sp-card p-5" aria-label="Payment mix">
              <div className="mb-1 flex items-center justify-between gap-2">
                <h2 className="text-[15px] font-bold text-[#1A1A1A]">How money arrived</h2>
                {payMix.paid.length > 0 && (
                  <button
                    onClick={exportPayMix}
                    aria-label="Export payment mix as CSV"
                    title="Export the method split — including money still out — as CSV"
                    className="inline-flex h-7 items-center rounded-lg border border-[#B88E2F]/45 bg-[#FDF9F0] px-2.5 text-[11px] font-bold text-[#8A5A00] transition hover:bg-[#B88E2F] hover:text-white active:scale-[0.97]"
                  >
                    CSV
                  </button>
                )}
              </div>
              <p className="mb-2 text-[11.5px] text-[#969696]">
                Settled money by method — each part under its own method
                {payMix.unpaid > 0 ? ' · plus what is still out' : ''}
              </p>
              {payMix.splitTickets > 0 && (
                <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold text-[#8A6A20]">
                  <Split size={12} aria-hidden />
                  {payMix.splitTickets} {payMix.splitTickets === 1 ? 'ticket' : 'tickets'} settled in
                  parts — the mix reads each part, not the covering method
                </p>
              )}
              {payMix.paid.length === 0 ? (
                <div className="flex h-56 flex-col items-center justify-center gap-2 text-center">
                  <Wallet size={22} className="text-[#969696]" aria-hidden />
                  <p className="text-[12.5px] font-semibold text-[#1A1A1A]">No payments yet</p>
                  <p className="max-w-[220px] text-[11.5px] text-[#6B6B6B]">
                    Charge bills on Bills — the mix lands here.
                  </p>
                </div>
              ) : (
                <div className="flex h-56 items-center gap-3">
                  <div className="h-full w-1/2 shrink-0" aria-hidden>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={payMix.paid}
                          dataKey="total"
                          nameKey="method"
                          innerRadius="58%"
                          outerRadius="88%"
                          paddingAngle={3}
                          stroke="none"
                        >
                          {payMix.paid.map((m) => (
                            <Cell key={m.method} fill={METHOD_COLOR[m.method] || '#6B6B6B'} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={CHART_TOOLTIP_STYLE}
                          labelStyle={CHART_TOOLTIP_LABEL}
                          formatter={(v: unknown, n: unknown) => [
                            formatMoney(Number(v)),
                            METHOD_LABEL[String(n)] || String(n),
                          ]}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <ul className="flex min-w-0 flex-1 flex-col gap-2.5">
                    {payMix.paid.map((m) => (
                      <li key={m.method} className="flex items-center gap-2">
                        <span
                          aria-hidden
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: METHOD_COLOR[m.method] || '#6B6B6B' }}
                        />
                        <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-[#1A1A1A]">
                          {METHOD_LABEL[m.method] || m.method}
                        </span>
                        <span className="shrink-0 text-[11.5px] font-bold tabular-nums text-[#0F3D3E]">
                          {formatMoney(m.total)}
                        </span>
                        <span className="shrink-0 text-[10.5px] tabular-nums text-[#969696]">
                          ×{m.count}
                        </span>
                      </li>
                    ))}
                    {payMix.unpaid > 0 && (
                      <li className="mt-1 flex items-center gap-2 border-t border-dashed border-[#E3E7E0] pt-2.5">
                        <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#B3261E]" />
                        <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-[#B3261E]">
                          Unpaid
                        </span>
                        <span className="shrink-0 text-[11.5px] font-bold tabular-nums text-[#B3261E]">
                          {formatMoney(payMix.unpaidAmt)}
                        </span>
                        <span className="shrink-0 text-[10.5px] tabular-nums text-[#969696]">
                          ×{payMix.unpaid}
                        </span>
                        {/* v5.44.0: the row walks you there — Bills lands
                            pre-filtered to money still out (sectionHint). */}
                        <button
                          type="button"
                          onClick={() => goSection('bills', ['Reports', 'Bills'], 'unpaid')}
                          aria-label={`Open Bills — collect ${formatMoney(payMix.unpaidAmt)} across ${payMix.unpaid} unpaid tickets`}
                          className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#0F3D3E]/5 px-2 py-0.5 text-[10px] font-bold text-[#0F3D3E] transition-[background-color,transform] duration-150 hover:bg-[#0F3D3E]/10 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B88E2F]"
                        >
                          Open Bills
                          <ArrowRight size={10} aria-hidden />
                        </button>
                      </li>
                    )}
                  </ul>
                </div>
              )}
            </section>
          </div>

          {/* ── 5.71.0 — the offer's scorecard: offers answer for themselves ── */}
          <section className="sp-card p-5" aria-label="Offer scorecard">
            <div className="mb-1 flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-1.5 text-[15px] font-bold text-[#1A1A1A]">
                <BadgePercent size={15} aria-hidden className="text-[#8A5A00]" />
                Offer scorecard
              </h2>
              {offerAgg.list.length > 0 && (
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    onClick={copyScore}
                    aria-live="polite"
                    aria-label="Copy the offer scorecard as text"
                    title="Copy how each offer performed as text"
                    className="inline-flex h-7 items-center gap-1 rounded-lg border border-[#B88E2F]/45 bg-[#FDF9F0] px-2.5 text-[11px] font-bold text-[#8A5A00] transition hover:bg-[#B88E2F] hover:text-white active:scale-[0.97]"
                  >
                    {scoreCopyState === 'ok' ? (
                      <Check size={12} aria-hidden />
                    ) : (
                      <Copy size={12} aria-hidden />
                    )}
                    {scoreCopyState === 'ok' ? 'Copied' : scoreCopyState === 'fail' ? 'Copy blocked' : 'Copy'}
                  </button>
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(offerScoreText)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Share the offer scorecard on WhatsApp"
                    title="Share how each offer performed on WhatsApp"
                    className="inline-flex h-7 items-center gap-1 rounded-lg border border-[#B88E2F]/45 bg-[#FDF9F0] px-2.5 text-[11px] font-bold text-[#8A5A00] transition hover:bg-[#B88E2F] hover:text-white active:scale-[0.97]"
                  >
                    <MessageCircle size={12} aria-hidden />
                    WhatsApp
                  </a>
                  <button
                    onClick={exportOffers}
                    aria-label="Export offer scorecard as CSV"
                    title="Export how each offer performed — tickets, money in, discount cost — as CSV"
                    className="inline-flex h-7 items-center rounded-lg border border-[#B88E2F]/45 bg-[#FDF9F0] px-2.5 text-[11px] font-bold text-[#8A5A00] transition hover:bg-[#B88E2F] hover:text-white active:scale-[0.97]"
                  >
                    CSV
                  </button>
                </div>
              )}
            </div>
            <p className="mb-3 text-[11.5px] text-[#969696]">
              How the counter's offers actually performed. Revenue rode in with the offer — the counter can't prove it
              wouldn't have come anyway.
            </p>
            {offerAgg.totalUses > 0 && (
              <p className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold text-[#8A6A20]">
                <BadgePercent size={12} aria-hidden />
                {offerAgg.totalUses} {offerAgg.totalUses === 1 ? 'ticket' : 'tickets'} rode offers —{' '}
                {formatMoney(offerAgg.totalDiscount)} off the gross, {formatMoney(offerAgg.totalRevenue)} walked in with
                them
              </p>
            )}
            {offerAgg.list.length === 0 ? (
              <div className="flex h-40 flex-col items-center justify-center gap-2 text-center">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#FDF6E7]">
                  <BadgePercent size={18} className="text-[#B88E2F]" aria-hidden />
                </span>
                <p className="text-[12.5px] font-semibold text-[#1A1A1A]">No offers written yet</p>
                <p className="max-w-[260px] text-[11.5px] text-[#969696]">
                  Offers live on Guests → Offers; the counter applies them at charge time, and every ride lands here.
                </p>
              </div>
            ) : (
              <ul className="flex flex-col gap-2">
                {offerAgg.list.map((o) => {
                  const silent = o.uses === 0;
                  return (
                    <li
                      key={o.id}
                      className="flex items-center gap-3 rounded-xl border border-[#E3E7E0] bg-[#FBFBF9] px-3.5 py-2.5"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="truncate text-[13px] font-bold text-[#1A1A1A]">{o.title}</span>
                          {o.voice && (
                            <span className="shrink-0 rounded-full bg-[#F3E8CF] px-1.5 py-0.5 text-[9.5px] font-bold text-[#8A5A00]">
                              {o.voice}
                            </span>
                          )}
                          <span
                            className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9.5px] font-bold ${
                              o.isActive ? 'bg-[#EAF0EC] text-[#2E7D32]' : 'bg-[#F6F5F2] text-[#969696]'
                            }`}
                            title={o.isActive ? 'The counter can apply it right now' : 'Paused — nothing new can ride it'}
                          >
                            {o.isActive ? 'active' : 'paused'}
                          </span>
                        </div>
                        <p className="mt-0.5 truncate text-[10.5px] font-semibold text-[#969696]">
                          {silent
                            ? 'silent in this window — no ticket rode it'
                            : `last rode ${o.lastAt ? appFormatters().dt.format(new Date(o.lastAt)) : '—'}`}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p
                          className={`text-[13px] font-extrabold tabular-nums leading-tight ${
                            silent ? 'text-[#C9CFC9]' : 'text-[#0F3D3E]'
                          }`}
                        >
                          {o.uses} {o.uses === 1 ? 'ticket' : 'tickets'}
                        </p>
                        {!silent && (
                          <p className="text-[10.5px] font-semibold tabular-nums text-[#6B6B6B]">
                            brought {formatMoney(o.revenue)} · cost {formatMoney(o.discountSum)}
                          </p>
                        )}
                      </div>
                    </li>
                  );
                })}
                {offerAgg.totalUses === 0 && (
                  <li className="pt-1 text-center text-[11.5px] font-semibold text-[#969696]">
                    no ticket rode an offer in this window
                  </li>
                )}
              </ul>
            )}
          </section>

          {/* ── cost & margin: the shelf prices the menu (018 views) ── */}
          <section className="sp-card p-5" aria-label="Cost and margin">
            <div className="mb-1 flex items-center justify-between gap-2">
              <h2 className="text-[15px] font-bold text-[#1A1A1A]">Cost &amp; margin</h2>
              <div className="flex shrink-0 items-center gap-2">
                {agg.paidCount > 0 && (
                  <button
                    onClick={exportMargin}
                    aria-label="Export cost and margin as CSV"
                    title="Export the range's margin summary as CSV"
                    className="inline-flex h-7 items-center rounded-lg border border-[#B88E2F]/45 bg-[#FDF9F0] px-2.5 text-[11px] font-bold text-[#8A5A00] transition hover:bg-[#B88E2F] hover:text-white active:scale-[0.97]"
                  >
                    CSV
                  </button>
                )}
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#6B6B6B]">
                  <Coins size={11} aria-hidden /> paid tickets only
                </span>
              </div>
            </div>
            <p className="mb-4 text-[11.5px] text-[#969696]">
              Ingredients priced from recipes × current shelf cost (a restock reprices history;
              variant sizes and add-ons are not priced yet). Margin banks on collected money only.
            </p>
            {agg.paidCount === 0 ? (
              <p className="py-6 text-center text-[12.5px] text-[#969696]">
                No paid tickets in this range yet — charge bills on Bills and the margin lands here.
              </p>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-xl border border-[#E3E7E0] bg-[#FFFBF2] px-3.5 py-3">
                    <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#8A5A00]">
                      Ingredient cost
                    </p>
                    <p className="mt-1 truncate text-[18px] font-extrabold tabular-nums leading-tight text-[#8A5A00]">
                      {formatMoney(agg.cogs)}
                    </p>
                    <p className="mt-0.5 text-[10px] font-semibold text-[#969696]">
                      {agg.paidCount} paid {agg.paidCount === 1 ? 'ticket' : 'tickets'}
                    </p>
                  </div>
                  <div className="rounded-xl border border-[#E3E7E0] bg-white px-3.5 py-3">
                    <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#969696]">
                      Gross margin
                    </p>
                    <p
                      className="mt-1 truncate text-[18px] font-extrabold tabular-nums leading-tight"
                      style={{ color: marginTone(agg.marginPct) }}
                    >
                      {formatMoney(agg.margin)}
                    </p>
                    <p className="mt-0.5 text-[10px] font-semibold text-[#969696]">
                      paid net {formatMoney(agg.paidNet)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-[#E3E7E0] bg-white px-3.5 py-3">
                    <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#969696]">
                      Margin rate
                    </p>
                    <p
                      className="mt-1 truncate text-[18px] font-extrabold tabular-nums leading-tight"
                      style={{ color: marginTone(agg.marginPct) }}
                    >
                      {agg.marginPct.toFixed(0)}%
                    </p>
                    <p className="mt-0.5 text-[10px] font-semibold text-[#969696]">
                      {marginWord(agg.marginPct)}
                    </p>
                  </div>
                </div>
                {/* revenue split — what the shelf burned vs what the cafe keeps */}
                <div className="mt-4" role="img" aria-label={`Revenue split: ingredient cost ${formatMoney(agg.cogs)}, gross margin ${formatMoney(agg.margin)}`}>
                  <div className="flex h-3.5 w-full overflow-hidden rounded-full bg-[#EAF0EC]" aria-hidden>
                    <div
                      className="h-full bg-[#B88E2F] transition-all duration-700"
                      style={{ width: `${Math.min(100, Math.max(agg.paidNet > 0 ? (agg.cogs / agg.paidNet) * 100 : 0, 1.5))}%` }}
                    />
                    <div
                      className="h-full bg-[#0F3D3E] transition-all duration-700"
                      style={{ width: `${Math.min(100, Math.max(agg.paidNet > 0 ? (agg.margin / agg.paidNet) * 100 : 0, 0))}%` }}
                    />
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10.5px] font-semibold text-[#6B6B6B]">
                    <span className="inline-flex items-center gap-1.5">
                      <span aria-hidden className="h-2 w-2 rounded-full bg-[#B88E2F]" />
                      ingredients {formatMoney(agg.cogs)}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span aria-hidden className="h-2 w-2 rounded-full bg-[#0F3D3E]" />
                      the cafe keeps {formatMoney(agg.margin)}
                    </span>
                  </div>
                </div>
              </>
            )}
          </section>

          {/* ── row: top items + service mix ── */}
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <section className="sp-card p-5 xl:col-span-2" aria-label="Top selling items">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-[15px] font-bold text-[#1A1A1A]">Top items</h2>
                  <p className="text-[11.5px] text-[#969696]">
                    Best sellers by revenue · {topItems.length} distinct item
                    {topItems.length === 1 ? '' : 's'} · {agg.items} units
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {topItems.length > 0 && (
                    <>
                      <button
                        onClick={copyTop}
                        aria-live="polite"
                        aria-label="Copy the best sellers as text"
                        title="Copy the best sellers as text"
                        className="flex h-11 items-center gap-1.5 rounded-xl border border-[#E3E7E0] bg-white px-3 text-[12.5px] font-bold text-[#0F3D3E] transition hover:border-[#B88E2F] hover:text-[#B88E2F]"
                      >
                        {topCopyState === 'ok' ? (
                          <Check size={14} className="text-[#2E7D32]" aria-hidden />
                        ) : (
                          <Copy size={14} aria-hidden />
                        )}
                        {topCopyState === 'ok' ? 'Copied' : topCopyState === 'fail' ? 'Copy blocked' : 'Copy'}
                      </button>
                      <a
                        href={`https://wa.me/?text=${encodeURIComponent(topText)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="Share the best sellers on WhatsApp"
                        title="Share the best sellers on WhatsApp"
                        className="flex h-11 items-center gap-1.5 rounded-xl border border-[#E3E7E0] bg-white px-3 text-[12.5px] font-bold text-[#0F3D3E] transition hover:border-[#B88E2F] hover:text-[#B88E2F]"
                      >
                        <MessageCircle size={14} aria-hidden />
                        WhatsApp
                      </a>
                    </>
                  )}
                  <button
                    onClick={exportRanking}
                    disabled={topItems.length === 0}
                    aria-label="Export item ranking as CSV"
                    title="Export the item ranking as CSV"
                    className="flex h-11 shrink-0 items-center gap-1.5 rounded-xl border border-[#E3E7E0] bg-white px-3 text-[12.5px] font-bold text-[#0F3D3E] transition hover:border-[#B88E2F] hover:text-[#B88E2F] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Download size={14} aria-hidden />
                    CSV
                  </button>
                </div>
              </div>
              {topItems.length === 0 ? (
                <p className="py-8 text-center text-[12.5px] text-[#969696]">
                  No item lines in this range yet.
                </p>
              ) : (
                <ol className="flex flex-col gap-2.5">
                  {topItems.slice(0, 8).map((it, i) => {
                    const share = (it.revenue / itemRevenueTotal) * 100;
                    return (
                      <li key={it.name} className="flex items-center gap-3">
                        <span
                          aria-hidden
                          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[11.5px] font-extrabold ${
                            i === 0
                              ? 'bg-[#B88E2F] text-white'
                              : i < 3
                                ? 'bg-[#F3E8CF] text-[#8A5A00]'
                                : 'bg-[#EAF0EC] text-[#0F3D3E]'
                          }`}
                        >
                          {i === 0 ? <Flame size={13} aria-hidden /> : i + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="flex min-w-0 items-center gap-1.5">
                              <span className="truncate text-[13px] font-bold text-[#1A1A1A]">
                                {it.name}
                              </span>
                              {it.revenue > 0 &&
                                (it.priced ? (
                                  <span
                                    className="shrink-0 rounded-full px-1.5 py-0.5 text-[9.5px] font-extrabold tabular-nums"
                                    style={{
                                      color: marginTone(((it.revenue - it.cost) / it.revenue) * 100),
                                      backgroundColor: `${marginTone(((it.revenue - it.cost) / it.revenue) * 100)}14`,
                                    }}
                                    title={`Ingredient cost ${formatMoney(it.cost)} · margin ${formatMoney(it.revenue - it.cost)}`}
                                  >
                                    {(((it.revenue - it.cost) / it.revenue) * 100).toFixed(0)}% mgn
                                  </span>
                                ) : (
                                  <span
                                    className="shrink-0 rounded-full bg-[#F1F1EE] px-1.5 py-0.5 text-[9.5px] font-extrabold text-[#969696]"
                                    title="No recipe pricing on file for this dish — its cost reads zero, so no margin is claimed. Price it with recipe lines in Inventory."
                                  >
                                    unpriced
                                  </span>
                                ))}
                            </span>
                            <span className="shrink-0 text-[12px] font-bold tabular-nums text-[#0F3D3E]">
                              {formatMoney(it.revenue)}
                            </span>
                          </div>
                          <div className="mt-1 flex items-center gap-2">
                            <div
                              className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-[#EAF0EC]"
                              aria-hidden
                            >
                              <div
                                className="h-full rounded-full bg-[#B88E2F]"
                                style={{ width: `${Math.max(3, share)}%` }}
                              />
                            </div>
                            <span className="shrink-0 text-[10.5px] font-semibold tabular-nums text-[#6B6B6B]">
                              {it.units} unit{it.units === 1 ? '' : 's'} · {share.toFixed(0)}%
                            </span>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                  {topItems.length > 8 && (
                    <li className="pt-1 text-center text-[11.5px] text-[#969696]">
                      + {topItems.length - 8} more in the CSV export
                    </li>
                  )}
                </ol>
              )}
              {marginRank.length > 0 ? (
                <div className="mt-4 rounded-xl border border-[#E3E7E0] bg-[#FBFBF9] p-3">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <h3 className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.08em] text-[#8A938C]">
                      <Coins size={11} aria-hidden />
                      The earner's list
                    </h3>
                    <span className="text-[10px] font-semibold text-[#969696]">
                      ranked by what the dish keeps
                    </span>
                  </div>
                  <p className="mb-2.5 text-[10.5px] font-semibold text-[#8A938C]">
                    {marginRank.length} recipe-priced dish{marginRank.length === 1 ? '' : 'es'} in range
                    {topItems.some((t) => !t.priced)
                      ? ` · ${topItems.filter((t) => !t.priced).length} unpriced sit out — no honest cost on file`
                      : ''}
                  </p>
                  <ol className="flex flex-col gap-2.5">
                    {marginRank.slice(0, 5).map((it, i) => {
                      const margin = it.revenue - it.cost;
                      const pct = it.revenue > 0 ? (margin / it.revenue) * 100 : 0;
                      const sell = sellsRank.get(it.name) ?? 0;
                      const earns = i + 1;
                      const top = marginRank[0];
                      const maxMargin = top.revenue - top.cost || 1;
                      const share = (margin / maxMargin) * 100;
                      const drift = sell - earns; // >0: earns above its bill · <0: sells above its earn
                      return (
                        <li key={it.name} className="flex items-center gap-3">
                          <span
                            aria-hidden
                            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[11.5px] font-extrabold ${
                              i === 0
                                ? 'bg-[#B88E2F] text-white'
                                : i < 3
                                  ? 'bg-[#F3E8CF] text-[#8A5A00]'
                                  : 'bg-[#EAF0EC] text-[#0F3D3E]'
                            }`}
                          >
                            {i === 0 ? <Coins size={13} aria-hidden /> : i + 1}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-baseline justify-between gap-2">
                              <span className="flex min-w-0 items-center gap-1.5">
                                <span
                                  className="truncate text-[13px] font-bold text-[#1A1A1A]"
                                  title={`${it.name} — kept ${formatMoney(margin)} of ${formatMoney(it.revenue)}`}
                                >
                                  {it.name}
                                </span>
                                {drift !== 0 && (
                                  <span
                                    className="shrink-0 whitespace-nowrap rounded-full px-1.5 py-0.5 text-[9.5px] font-extrabold"
                                    style={{
                                      color: drift > 0 ? '#2E7D32' : '#8A5A00',
                                      backgroundColor: drift > 0 ? '#2E7D3214' : '#8A5A0014',
                                    }}
                                    title={
                                      drift > 0
                                        ? `Earns #${earns} while selling #${sell} — a quiet earner worth pushing`
                                        : `Sells #${sell} while earning #${earns} — popular but thin; review price or recipe`
                                    }
                                  >
                                    {drift > 0 ? 'earns above its bill' : 'sells above its earn'}
                                  </span>
                                )}
                              </span>
                              <span className="shrink-0 text-[12px] font-bold tabular-nums text-[#8A5A00]">
                                {formatMoney(margin)}
                                <span className="ml-1 text-[10px] font-semibold text-[#969696]">
                                  {pct.toFixed(0)}%
                                </span>
                              </span>
                            </div>
                            <div className="mt-1 flex items-center gap-2">
                              <div
                                className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-[#EAF0EC]"
                                aria-hidden
                              >
                                <div
                                  className="h-full rounded-full bg-[#8A5A00]"
                                  style={{ width: `${Math.max(3, share)}%` }}
                                />
                              </div>
                              <span className="shrink-0 text-[10.5px] font-semibold tabular-nums text-[#6B6B6B]">
                                sells #{sell} · earns #{earns}
                              </span>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                    {marginRank.length > 5 && (
                      <li className="pt-1 text-center text-[11.5px] text-[#969696]">
                        + {marginRank.length - 5} more in the CSV export
                      </li>
                    )}
                  </ol>
                </div>
              ) : topItems.some((t) => !t.priced) ? (
                <p className="mt-3 rounded-xl border border-[#E3E7E0] bg-[#FBFBF9] p-3 text-[11px] text-[#969696]">
                  No recipe-priced dishes in this range yet — the earner's list needs recipe
                  lines (Inventory) before it can say what a dish keeps.
                </p>
              ) : null}
              {menuMatrix && (
                <div className="mt-4 rounded-xl border border-[#E3E7E0] bg-[#FBFBF9] p-3">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <h3 className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.08em] text-[#8A938C]">
                      <Split size={11} aria-hidden />
                      The menu's quadrants
                    </h3>
                    <span className="text-[10px] font-semibold text-[#969696]">
                      popularity × per-unit margin
                    </span>
                  </div>
                  <p className="mb-2.5 text-[10.5px] font-semibold text-[#8A938C]">
                    {menuMatrix.n} priced dishes split at the menu average —{' '}
                    {menuMatrix.avgUnits.toFixed(1)} units · {formatMoney(menuMatrix.avgCm)} kept
                    per unit sold
                  </p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {MENU_QUADRANTS.map((q) => {
                      const dishes = [...menuMatrix.cells[q.key]].sort((a, b) => b.units - a.units);
                      return (
                        <div
                          key={q.key}
                          className="rounded-lg border p-2.5"
                          style={{ borderColor: q.bg, backgroundColor: `${q.bg}26` }}
                          aria-label={`${q.label}: ${dishes.length > 0 ? dishes.map((d) => d.name).join(', ') : 'none this window'}`}
                        >
                          <div className="mb-0.5 flex items-center justify-between gap-1">
                            <span
                              className="text-[10.5px] font-extrabold uppercase tracking-[0.06em]"
                              style={{ color: q.color }}
                            >
                              {q.label}
                            </span>
                            <span className="text-[9.5px] font-semibold tabular-nums text-[#969696]">
                              {dishes.length}
                            </span>
                          </div>
                          <p className="mb-1.5 text-[10px] font-semibold leading-tight text-[#8A938C]">
                            {q.verdict}
                          </p>
                          {dishes.length === 0 ? (
                            <p className="text-[10.5px] italic text-[#969696]">none this window</p>
                          ) : (
                            <ul className="flex flex-col gap-1">
                              {dishes.map((d) => (
                                <li
                                  key={d.name}
                                  className="flex items-baseline justify-between gap-2"
                                >
                                  <span
                                    className="truncate text-[11.5px] font-bold text-[#1A1A1A]"
                                    title={`${d.name} — ${d.units} units · keeps ${formatMoney((d.revenue - d.cost) / d.units)} per unit`}
                                  >
                                    {d.name}
                                  </span>
                                  <span className="shrink-0 text-[10px] font-semibold tabular-nums text-[#6B6B6B]">
                                    {d.units}u · {formatMoney((d.revenue - d.cost) / d.units)}/unit
                                  </span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </section>

            <section className="sp-card p-5" aria-label="Order type mix">
              <div className="mb-1 flex items-center justify-between gap-2">
                <h2 className="text-[15px] font-bold text-[#1A1A1A]">Service mix</h2>
                {typeMix.length > 0 && (
                  <button
                    onClick={exportTypeMix}
                    aria-label="Export service mix as CSV"
                    title="Export the order-type split as CSV"
                    className="inline-flex h-7 items-center rounded-lg border border-[#B88E2F]/45 bg-[#FDF9F0] px-2.5 text-[11px] font-bold text-[#8A5A00] transition hover:bg-[#B88E2F] hover:text-white active:scale-[0.97]"
                  >
                    CSV
                  </button>
                )}
              </div>
              <p className="mb-4 text-[11.5px] text-[#969696]">
                Where tickets come from — table service vs counter vs delivery
              </p>
              {typeMix.length === 0 ? (
                <p className="py-8 text-center text-[12.5px] text-[#969696]">
                  No tickets in range.
                </p>
              ) : (
                <ul className="flex flex-col gap-4">
                  {typeMix.map(([t, v]) => {
                    const share = agg.placed > 0 ? (v.count / agg.placed) * 100 : 0;
                    return (
                      <li key={t}>
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="flex items-center gap-1.5 text-[12.5px] font-bold text-[#1A1A1A]">
                            {t === 'dine_in' ? (
                              <QrCode size={13} aria-hidden />
                            ) : t === 'takeaway' ? (
                              <ShoppingBag size={13} aria-hidden />
                            ) : (
                              <Wallet size={13} aria-hidden />
                            )}
                            {TYPE_LABEL[t] || t}
                          </span>
                          <span className="text-[11.5px] tabular-nums text-[#6B6B6B]">
                            {v.count} · {formatMoney(v.total)}
                          </span>
                        </div>
                        <div
                          className="mt-1.5 h-2 overflow-hidden rounded-full bg-[#EAF0EC]"
                          role="meter"
                          aria-valuenow={Math.round(share)}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-label={`${TYPE_LABEL[t] || t} share of orders`}
                        >
                          <div
                            className="h-full rounded-full bg-[#0F3D3E]"
                            style={{ width: `${Math.max(2, share)}%` }}
                          />
                        </div>
                        <p className="mt-1 text-[10.5px] font-semibold text-[#969696]">
                          {share.toFixed(0)}% of orders in range
                        </p>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>

          {/* ── row: kitchen speed (5.67.0) — the clock reads the hop ledger ── */}
          <section className="sp-card p-5" aria-label="Kitchen speed">
            <div className="mb-1 flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-1.5 text-[15px] font-bold text-[#1A1A1A]">
                <Flame size={14} aria-hidden className="text-[#B3261E]" />
                Kitchen speed
              </h2>
              {kitchen.sample.length > 0 && (
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    onClick={copyKitchenSpeed}
                    aria-live="polite"
                    aria-label="Copy the kitchen speed as text"
                    title="Copy the kitchen's stopwatch as text"
                    className="inline-flex h-7 items-center gap-1 rounded-lg border border-[#B88E2F]/45 bg-[#FDF9F0] px-2.5 text-[11px] font-bold text-[#8A5A00] transition hover:bg-[#B88E2F] hover:text-white active:scale-[0.97]"
                  >
                    {kitchenCopyState === 'ok' ? (
                      <Check size={12} aria-hidden />
                    ) : (
                      <Copy size={12} aria-hidden />
                    )}
                    {kitchenCopyState === 'ok'
                      ? 'Copied'
                      : kitchenCopyState === 'fail'
                        ? 'Copy blocked'
                        : 'Copy'}
                  </button>
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(kitchenSpeedText)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Share the kitchen speed on WhatsApp"
                    title="Share the kitchen's stopwatch on WhatsApp"
                    className="inline-flex h-7 items-center gap-1 rounded-lg border border-[#B88E2F]/45 bg-[#FDF9F0] px-2.5 text-[11px] font-bold text-[#8A5A00] transition hover:bg-[#B88E2F] hover:text-white active:scale-[0.97]"
                  >
                    <MessageCircle size={12} aria-hidden />
                    WhatsApp
                  </a>
                  <button
                    onClick={exportKitchenSpeed}
                    disabled={kitchen.sample.length === 0}
                    aria-label="Export kitchen speed as CSV"
                    title="Export the range's fire-to-ready timings as CSV"
                    className="inline-flex h-7 items-center rounded-lg border border-[#B88E2F]/45 bg-[#FDF9F0] px-2.5 text-[11px] font-bold text-[#8A5A00] transition hover:bg-[#B88E2F] hover:text-white active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    CSV
                  </button>
                </div>
              )}
            </div>
            <p className="mb-4 text-[11.5px] text-[#969696]">
              How long each ticket really took from the counter's Ok to the pass —
              the status ledger, not guesses
            </p>
            {kitchen.sample.length === 0 ? (
              <p className="py-8 text-center text-[12.5px] text-[#969696]">
                No fired-then-finished tickets in range — the clock times only
                tickets with both hops on the ledger.
              </p>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  <div className="flex flex-col gap-1 rounded-2xl border border-[#E3E7E0] bg-white px-4 py-3.5">
                    <span className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-[#8A938C]">
                      Average
                    </span>
                    <span className="text-[21px] font-extrabold leading-none tracking-tight tabular-nums text-[#0F3D3E]">
                      {fmtDuration(kitchen.avgMin ?? 0)}
                    </span>
                    <span className="text-[11px] font-semibold text-[#8A938C]">
                      {kitchen.sample.length} {kitchen.sample.length === 1 ? 'ticket' : 'tickets'} timed
                    </span>
                  </div>
                  <div className="flex flex-col gap-1 rounded-2xl border border-[#E3E7E0] bg-white px-4 py-3.5">
                    <span className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-[#8A938C]">
                      Median
                    </span>
                    <span className="text-[21px] font-extrabold leading-none tracking-tight tabular-nums text-[#0F3D3E]">
                      {fmtDuration(kitchen.medianMin ?? 0)}
                    </span>
                    <span className="text-[11px] font-semibold text-[#8A938C]">the middle ticket</span>
                  </div>
                  <div className="flex flex-col gap-1 rounded-2xl border border-[#E3E7E0] bg-white px-4 py-3.5">
                    <span className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-[#8A938C]">
                      Slowest
                    </span>
                    <span className="text-[21px] font-extrabold leading-none tracking-tight tabular-nums text-[#0F3D3E]">
                      {kitchen.slowest ? fmtDuration(kitchen.slowest.minutes) : '—'}
                    </span>
                    <span className="text-[11px] font-semibold text-[#8A938C]">
                      {kitchen.slowest ? `ticket #${kitchen.slowest.orderNumber}` : '—'}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1 rounded-2xl border border-[#E3E7E0] bg-white px-4 py-3.5">
                    <span className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-[#8A938C]">
                      Over the 10-min SLA
                    </span>
                    <span
                      className={`text-[21px] font-extrabold leading-none tracking-tight tabular-nums ${kitchen.breaches.length > 0 ? 'text-[#B3261E]' : 'text-[#2E7D32]'}`}
                    >
                      {kitchen.breaches.length}
                    </span>
                    <span className="text-[11px] font-semibold text-[#8A938C]">
                      {kitchen.breaches.length === 0
                        ? 'all tickets inside the line'
                        : 'late-prep territory'}
                    </span>
                  </div>
                </div>
                <div
                  className={`mt-3 h-2 overflow-hidden rounded-full ${kitchen.breaches.length > 0 ? 'bg-[#FCEBEA]' : 'bg-[#EAF0EC]'}`}
                  role="meter"
                  aria-valuenow={Math.round((kitchen.breaches.length / kitchen.sample.length) * 100)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Share of timed tickets over the 10-minute SLA"
                  title={
                    kitchen.breaches.length > 0
                      ? `${kitchen.breaches.length} of ${kitchen.sample.length} timed tickets over the 10-minute line`
                      : 'every timed ticket finished inside the 10-minute line'
                  }
                >
                  <div
                    className={`h-full rounded-full ${kitchen.breaches.length > 0 ? 'bg-[#B3261E]' : 'bg-[#2E7D32]'}`}
                    style={{
                      width: `${
                        kitchen.breaches.length > 0
                          ? Math.max(2, (kitchen.breaches.length / kitchen.sample.length) * 100)
                          : 0
                      }%`,
                    }}
                  />
                </div>
                {kitchen.sample.length < 3 ? (
                  <p className="mt-2 flex items-center gap-1 text-[10.5px] font-bold text-[#8A6D1F]">
                    <Clock size={11} aria-hidden />
                    small sample — the clock needs more timed tickets before it says anything loud
                  </p>
                ) : null}
                {kitchen.items.length > 0 ? (
                  <div className="mt-4 rounded-xl border border-[#E3E7E0] bg-[#FBFBF9] p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <h3 className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.08em] text-[#8A938C]">
                        <UtensilsCrossed size={11} aria-hidden />
                        The slow dish
                      </h3>
                      <span className="text-[10px] font-semibold text-[#969696]">
                        fire → pass, per timed ticket the dish rode on
                      </span>
                    </div>
                    {kitchen.items.some((d) => d.own) ? (
                      <p className="mb-2 flex items-center gap-1 text-[10.5px] font-semibold text-[#8A938C]">
                        <Timer size={11} aria-hidden />
                        rows with “own clock” read fire → the dish's last ticked line — finer than the ticket's span
                      </p>
                    ) : null}
                    <ul className="flex flex-col gap-2.5">
                      {kitchen.items.slice(0, 5).map((d, i) => {
                        const top = kitchen.items[0];
                        const maxAvg = top.avgMin || 1;
                        const share = (d.avgMin / maxAvg) * 100;
                        const over = d.avgMin > 10;
                        return (
                          <li key={d.name}>
                            <div className="flex items-baseline justify-between gap-2">
                              <span className="flex min-w-0 items-center gap-1.5 text-[12.5px] font-bold text-[#1A1A1A]">
                                <span className="truncate">{d.name}</span>
                                {i === 0 ? (
                                  <span
                                    className={`inline-flex shrink-0 items-center rounded-full px-1.5 py-0.5 text-[9.5px] font-bold ${over ? 'bg-[#FCEBEA] text-[#B3261E]' : 'bg-[#EAF0EC] text-[#2E7D32]'}`}
                                    title="The dish the pass waits for — longest average fire-to-ready span"
                                  >
                                    the pass waits for this
                                  </span>
                                ) : null}
                              </span>
                              <span
                                className={`shrink-0 text-[11.5px] tabular-nums ${over ? 'text-[#B3261E]' : 'text-[#6B6B6B]'}`}
                              >
                                {d.tickets} {d.tickets === 1 ? 'ticket' : 'tickets'} · avg{' '}
                                {fmtDuration(d.avgMin)}
                              </span>
                            </div>
                            <div
                              className="mt-1 h-2 overflow-hidden rounded-full bg-[#EAF0EC]"
                              role="meter"
                              aria-valuenow={Math.round(share)}
                              aria-valuemin={0}
                              aria-valuemax={100}
                              aria-label={`${d.name} average fire-to-ready span, relative to the slowest dish`}
                            >
                              <div
                                className={`h-full rounded-full ${over ? 'bg-[#B3261E]' : 'bg-[#0F3D3E]'}`}
                                style={{ width: `${Math.max(3, share)}%` }}
                              />
                            </div>
                            <p className="mt-0.5 text-[10.5px] font-semibold text-[#969696]">
                              slowest ticket span {fmtDuration(d.slowestMin)}
                            </p>
                            {d.own && (
                              <p
                                className={`mt-0.5 flex items-center gap-1 text-[10.5px] font-bold ${d.own.avgMin > 10 ? 'text-[#B3261E]' : 'text-[#0F3D3E]'}`}
                                title="The dish's own clock — fire to its last ticked line (the kitchen's 029 checks), only on timed tickets. Finer than the ticket's span: the ticket waits for its slowest dish, the check-clock lets the early ones speak."
                              >
                                <Timer size={11} aria-hidden className="shrink-0" />
                                <span className="truncate">
                                  own clock · avg {fmtDuration(d.own.avgMin)} · {d.own.n}{' '}
                                  {d.own.n === 1 ? 'ticked ticket' : 'ticked tickets'}
                                  {d.own.avgMin > 10 ? ' · over SLA' : ''}
                                </span>
                              </p>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                    {kitchen.items.length > 5 ? (
                      <p className="pt-1.5 text-center text-[11.5px] text-[#969696]">
                        + {kitchen.items.length - 5} more in the CSV export
                      </p>
                    ) : null}
                  </div>
                ) : null}
                <ul className="mt-4 flex flex-col gap-1.5">
                  {[...kitchen.sample]
                    .sort((a, b) => b.minutes - a.minutes)
                    .slice(0, 5)
                    .map((t) => (
                      <li
                        key={t.orderNumber}
                        className="flex items-center justify-between gap-2 border-b border-[#E3E7E0]/60 pb-1.5 last:border-0"
                      >
                        <span className="flex items-center gap-1.5 text-[12.5px] font-bold text-[#1A1A1A]">
                          #{t.orderNumber}
                          {t.minutes > 10 ? (
                            <span className="inline-flex items-center rounded-full bg-[#FCEBEA] px-1.5 py-0.5 text-[10px] font-bold text-[#B3261E]">
                              over SLA
                            </span>
                          ) : null}
                        </span>
                        <span className="text-[11.5px] tabular-nums text-[#6B6B6B]">
                          fired {appFormatters().dt.format(t.firedAt)} → ready {appFormatters().dt.format(t.readyAt)}
                        </span>
                        <span
                          className={`text-[12.5px] font-extrabold tabular-nums ${t.minutes > 10 ? 'text-[#B3261E]' : 'text-[#0F3D3E]'}`}
                        >
                          {fmtDuration(t.minutes)}
                        </span>
                      </li>
                    ))}
                  {kitchen.sample.length > 5 ? (
                    <li className="pt-1 text-center text-[11.5px] text-[#969696]">
                      + {kitchen.sample.length - 5} more in the CSV export
                    </li>
                  ) : null}
                </ul>
              </>
            )}
          </section>

          {/* ── v5.161.0 — TABLE TURNOVER: the room's breathing, off the same ledger ── */}
          <section className="sp-card p-5" aria-label="Table turnover">
            <div className="mb-1 flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-1.5 text-[15px] font-bold text-[#1A1A1A]">
                <UtensilsCrossed size={14} aria-hidden className="text-[#0F3D3E]" />
                Table turnover
              </h2>
              {turnover.tickets > 0 && (
                <button
                  onClick={exportTurnover}
                  aria-label="Export table turnover as CSV"
                  title="Export the range's turns and seated spans as CSV"
                  className="inline-flex h-7 items-center rounded-lg border border-[#B88E2F]/45 bg-[#FDF9F0] px-2.5 text-[11px] font-bold text-[#8A5A00] transition hover:bg-[#B88E2F] hover:text-white active:scale-[0.97]"
                >
                  CSV
                </button>
              )}
            </div>
            <p className="mb-4 text-[11.5px] text-[#969696]">
              How the room breathes — turns per table and the seated span, placed to
              paid, off the status ledger the kitchen stopwatch reads.
            </p>
            {turnover.tickets === 0 ? (
              <p className="text-[13px] leading-relaxed text-[#6B6B6B]">
                No dine-in tickets in this range — the room hasn't sat yet.
              </p>
            ) : (
              <>
                <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <div className="rounded-xl bg-[#EAF0EC] px-3 py-2.5">
                    <p className="text-[10.5px] font-semibold uppercase tracking-wide text-[#6B6B6B]">
                      Turns
                    </p>
                    <p className="text-[18px] font-bold tabular-nums text-[#1A1A1A]">
                      {turnover.tickets}
                    </p>
                  </div>
                  <div className="rounded-xl bg-[#EAF0EC] px-3 py-2.5">
                    <p className="text-[10.5px] font-semibold uppercase tracking-wide text-[#6B6B6B]">
                      Tables touched
                    </p>
                    <p className="text-[18px] font-bold tabular-nums text-[#1A1A1A]">
                      {turnover.tablesTouched}
                    </p>
                  </div>
                  <div className="rounded-xl bg-[#EAF0EC] px-3 py-2.5">
                    <p className="text-[10.5px] font-semibold uppercase tracking-wide text-[#6B6B6B]">
                      Avg span
                    </p>
                    <p className="text-[18px] font-bold tabular-nums text-[#1A1A1A]">
                      {turnover.spans.avgMin != null ? turnoverSpanLabel(turnover.spans.avgMin) : '—'}
                    </p>
                  </div>
                  <div className="rounded-xl bg-[#EAF0EC] px-3 py-2.5">
                    <p className="text-[10.5px] font-semibold uppercase tracking-wide text-[#6B6B6B]">
                      Longest
                    </p>
                    <p className="truncate text-[13px] font-bold tabular-nums text-[#1A1A1A]" title={turnover.longest ? `#${turnover.longest.orderNumber} · ${turnover.longest.tableLabel} · ${turnoverSpanLabel(turnover.longest.minutes)}` : undefined}>
                      {turnover.longest
                        ? `#${turnover.longest.orderNumber} · ${turnoverSpanLabel(turnover.longest.minutes)}`
                        : '—'}
                    </p>
                  </div>
                </div>
                <ul className="space-y-2.5">
                  {turnover.perTable.slice(0, 6).map((t) => {
                    const maxTurns = turnover.perTable[0]?.turns || 1;
                    return (
                      <li key={t.tableLabel}>
                        <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 text-[12.5px]">
                          <span className="font-semibold text-[#1A1A1A]">{t.tableLabel}</span>
                          <span className="tabular-nums text-[#6B6B6B]">
                            {t.turns} turn{t.turns === 1 ? '' : 's'}
                            {t.avgSpanMin != null
                              ? ` · avg ${turnoverSpanLabel(t.avgSpanMin)}`
                              : ' · no span yet'}
                          </span>
                        </div>
                        <div
                          className="mt-1 h-1.5 overflow-hidden rounded-full bg-[#E3E7E0]"
                          role="img"
                          aria-label={`${t.tableLabel}: ${t.turns} turn${t.turns === 1 ? '' : 's'}${t.avgSpanMin != null ? `, average span ${turnoverSpanLabel(t.avgSpanMin)}` : ', no timed span'}`}
                        >
                          <div
                            className="h-full rounded-full bg-[#0F3D3E]/70"
                            style={{ width: `${Math.max(6, Math.round((t.turns / maxTurns) * 100))}%` }}
                          />
                        </div>
                      </li>
                    );
                  })}
                  {turnover.perTable.length > 6 ? (
                    <li className="pt-1 text-center text-[11.5px] text-[#969696]">
                      + {turnover.perTable.length - 6} more in the CSV export
                    </li>
                  ) : null}
                </ul>
                {turnover.spans.n === 0 && (
                  <p
                    className="mt-3 rounded-xl px-3.5 py-2.5 text-[12px] leading-relaxed text-[#8A5A0B]"
                    style={{ background: '#FCF1DF' }}
                    role="status"
                  >
                    No ticket has left its table in this range — a span needs the paid hop;
                    live seats donate turns only.
                  </p>
                )}
              </>
            )}
          </section>

          {/* ── 5.77.0 — THE BIN'S BILL: the waste side of the 027 diary ── */}
          <section className="sp-card p-5" aria-label="The bin's bill">
            <div className="mb-1 flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-1.5 text-[15px] font-bold text-[#1A1A1A]">
                <Trash2 size={15} aria-hidden className="text-[#8A5A00]" />
                The bin's bill
              </h2>
              {wasteAgg.count > 0 && (
                <span className="rounded-full bg-[#F3E8CF] px-2 py-0.5 text-[10.5px] font-bold tabular-nums text-[#8A5A00]">
                  {wasteAgg.count} {wasteAgg.count === 1 ? 'move' : 'moves'}
                </span>
              )}
            </div>
            <p className="mb-3 text-[11.5px] text-[#969696]">
              What the shelf threw away — spoilage, spills, damage, valued at each SKU's cost on file. Corrections
              reconcile the shelf; they didn't feed the bin.
            </p>
            {wasteAgg.count === 0 ? (
              <div className="flex h-36 flex-col items-center justify-center gap-2 text-center">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#EAF0EC]">
                  <Trash2 size={18} className="text-[#0F3D3E]" aria-hidden />
                </span>
                <p className="text-[12.5px] font-semibold text-[#1A1A1A]">The bin took nothing in this range</p>
                <p className="max-w-[280px] text-[11.5px] text-[#969696]">
                  No spoilage, spillage or damage rows in the diary window — the shelf is honest. Log waste from
                  Inventory and it answers here.
                </p>
              </div>
            ) : (
              <>
                {/* the bill itself — one number, then how the bin split it */}
                <div className="mb-3 flex flex-wrap items-end justify-between gap-2 rounded-xl bg-[#FBFAF7] px-4 py-3">
                  <div>
                    <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[#969696]">
                      Binned in this range
                    </p>
                    <p className="text-[26px] font-extrabold leading-tight tabular-nums text-[#B4483C]">
                      {formatMoney(Math.round(wasteAgg.total * 100) / 100)}
                    </p>
                    {wasteAgg.unvalued > 0 && (
                      <p className="mt-0.5 text-[11px] text-[#8A5A00]">
                        + {wasteAgg.unvalued} {wasteAgg.unvalued === 1 ? 'move' : 'moves'} with no cost on file —
                        counted as nothing rather than guessed
                      </p>
                    )}
                  </div>
                  <ul className="flex flex-col gap-1.5">
                    {(['spoilage', 'spillage', 'damage'] as const).map((r) => {
                      const meta = {
                        spoilage: { label: 'Spoilage', dot: '#C9950A' },
                        spillage: { label: 'Spillage', dot: '#3B5BA5' },
                        damage: { label: 'Damage', dot: '#B3261E' },
                      }[r];
                      const share = wasteAgg.total > 0 ? wasteAgg.reasons[r].rupees / wasteAgg.total : 0;
                      return (
                        <li key={r} className="flex items-center gap-2 text-[11.5px]">
                          <span
                            aria-hidden
                            className="h-2 w-2 shrink-0 rounded-full"
                            style={{ backgroundColor: meta.dot }}
                          />
                          <span className="w-16 shrink-0 font-semibold text-[#6B6B6B]">{meta.label}</span>
                          <span
                            aria-hidden
                            className="h-1.5 w-24 shrink-0 overflow-hidden rounded-full"
                            style={{ backgroundColor: '#EAF0EC' }}
                          >
                            <span
                              className="block h-full rounded-full"
                              style={{ width: `${Math.max(share * 100, wasteAgg.reasons[r].count > 0 ? 3 : 0)}%`, backgroundColor: meta.dot }}
                            />
                          </span>
                          <span className="min-w-14 text-right font-bold tabular-nums text-[#1A1A1A]">
                            {formatMoney(Math.round(wasteAgg.reasons[r].rupees * 100) / 100)}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
                {/* the heaviest SKUs — sorted by what they cost the bin */}
                <ul className="flex flex-col gap-1.5">
                  {wasteAgg.items.map((it) => (
                    <li
                      key={it.name}
                      className="flex items-center gap-3 rounded-xl border border-[#E3E7E0] bg-[#FBFBF9] px-3.5 py-2.5"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-center gap-1.5">
                          <span className="truncate text-[13px] font-bold text-[#1A1A1A]">{it.name}</span>
                          <span className="shrink-0 rounded-full bg-[#F1F4F1] px-1.5 py-0.5 text-[9.5px] font-bold tabular-nums text-[#0F3D3E]">
                            {Math.round(it.qty * 100) / 100} {it.unit} · {it.count} {it.count === 1 ? 'move' : 'moves'}
                          </span>
                          {it.unvalued > 0 && (
                            <span
                              className="shrink-0 rounded-full bg-[#F3E8CF] px-1.5 py-0.5 text-[9.5px] font-bold text-[#8A5A00]"
                              title="Some moves of this SKU had no cost on file — those rows are counted as nothing rather than guessed."
                            >
                              no cost on file
                            </span>
                          )}
                        </p>
                        {it.note && (
                          <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] italic text-[#6B6B6B]" title={it.note}>
                            <Quote size={10} aria-hidden className="shrink-0" />
                            {it.note}
                          </p>
                        )}
                        <p className="mt-0.5 text-[10.5px] tabular-nums text-[#969696]">
                          last binned {appFormatters().dt.format(new Date(it.last).getTime())}
                        </p>
                      </div>
                      <span className="shrink-0 text-[13px] font-extrabold tabular-nums text-[#B4483C]">
                        {formatMoney(Math.round(it.rupees * 100) / 100)}
                      </span>
                    </li>
                  ))}
                </ul>
                {wasteAgg.items.length > 0 && (
                  <p className="mt-2.5 flex items-center gap-1.5 text-[11px] text-[#969696]">
                    <Trash2 size={11} aria-hidden />
                    Reads the 027 diary's waste side only — deliveries (stock in) and corrections (shelf
                    reconciliation) never land here. Log waste from Inventory; the bill answers for the range selected
                    above.
                  </p>
                )}
              </>
            )}
          </section>

          {/* ── row: guest satisfaction (019) + drawer honesty (020) ── */}
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <section className="sp-card p-5 xl:col-span-2" aria-label="Guest satisfaction">
              <div className="mb-1 flex items-center justify-between gap-2">
                <h2 className="text-[15px] font-bold text-[#1A1A1A]">Guest satisfaction</h2>
                {fbAgg.count > 0 && (
                  <div className="flex shrink-0 items-center gap-1.5">
                    <button
                      onClick={copyRatings}
                      aria-live="polite"
                      aria-label="Copy the guest voices as text"
                      title="Copy what guests said this range as text"
                      className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-xl border border-[#E3E7E0] bg-white px-3 text-[12.5px] font-bold text-[#0F3D3E] transition hover:border-[#B88E2F] hover:text-[#B88E2F] active:scale-[0.97]"
                    >
                      {ratingsCopyState === 'ok' ? (
                        <Check size={14} aria-hidden />
                      ) : (
                        <Copy size={14} aria-hidden />
                      )}
                      {ratingsCopyState === 'ok'
                        ? 'Copied'
                        : ratingsCopyState === 'fail'
                          ? 'Copy blocked'
                          : 'Copy'}
                    </button>
                    <a
                      href={`https://wa.me/?text=${encodeURIComponent(ratingsText)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Share the guest voices on WhatsApp"
                      title="Share what guests said this range on WhatsApp"
                      className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-xl border border-[#E3E7E0] bg-white px-3 text-[12.5px] font-bold text-[#0F3D3E] transition hover:border-[#B88E2F] hover:text-[#B88E2F] active:scale-[0.97]"
                    >
                      <MessageCircle size={14} aria-hidden />
                      WhatsApp
                    </a>
                    <button
                      onClick={exportRatings}
                      disabled={fbAgg.count === 0}
                      aria-label="Export guest ratings as CSV"
                      title="Export the range's guest ratings as CSV"
                      className="flex h-11 shrink-0 items-center gap-1.5 rounded-xl border border-[#E3E7E0] bg-white px-3 text-[12.5px] font-bold text-[#0F3D3E] transition hover:border-[#B88E2F] hover:text-[#B88E2F] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Download size={14} aria-hidden />
                      CSV
                    </button>
                  </div>
                )}
              </div>
              <p className="mb-4 text-[11.5px] text-[#969696]">
                Star ratings guests leave on their own phones, from the order's track page —
                served tickets only. {RANGE_LABEL[range].toLowerCase()}.
              </p>
              {fbAgg.count === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
                  <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#FDF6E7]">
                    <Star size={22} className="text-[#B88E2F]" aria-hidden />
                  </span>
                  <p className="text-[12.5px] font-semibold text-[#1A1A1A]">
                    No ratings in this range yet
                  </p>
                  <p className="max-w-xs text-[11.5px] text-[#969696]">
                    Once served guests rate from their track page, the average and their words
                    land here.
                  </p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-[#E3E7E0] bg-[#FFFBF2] px-3.5 py-3">
                      <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#8A5A00]">
                        Average rating
                      </p>
                      <p
                        className="mt-1 truncate text-[18px] font-extrabold tabular-nums leading-tight"
                        style={{ color: ratingTone(fbAgg.avg) }}
                      >
                        {fbAgg.avg!.toFixed(1)}
                        <span className="text-[12px] font-bold text-[#969696]"> / 5</span>
                      </p>
                      <p className="mt-0.5 text-[10px] font-semibold text-[#969696]">
                        {ratingWord(fbAgg.avg)}
                      </p>
                    </div>
                    <div className="rounded-xl border border-[#E3E7E0] bg-white px-3.5 py-3">
                      <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#969696]">
                        Ratings in range
                      </p>
                      <p className="mt-1 truncate text-[18px] font-extrabold tabular-nums leading-tight text-[#0F3D3E]">
                        {fbAgg.count}
                      </p>
                      <p className="mt-0.5 truncate text-[10px] font-semibold text-[#969696]">
                        {fbAgg.quotes.length} with {fbAgg.quotes.length === 1 ? 'a comment' : 'comments'}
                      </p>
                    </div>
                  </div>
                  {/* star histogram — 5★ first, the way a cafe reads it */}
                  <div
                    className="mt-4"
                    role="img"
                    aria-label={`Guest ratings histogram: ${fbAgg.stars[4]} five star, ${fbAgg.stars[3]} four star, ${fbAgg.stars[2]} three star, ${fbAgg.stars[1]} two star, ${fbAgg.stars[0]} one star ratings`}
                  >
                    <div className="flex h-28 items-end gap-2" aria-hidden>
                      {fbAgg.stars
                        .map((n, i) => ({ n, label: `${i + 1}★` }))
                        .reverse()
                        .map(({ n, label }, idx) => {
                          const max = Math.max(1, ...fbAgg.stars);
                          const h = n === 0 ? 6 : Math.max(14, (n / max) * 100);
                          const modal = n > 0 && n === max;
                          return (
                            <div key={label} className="flex h-full min-w-0 flex-1 flex-col items-center">
                              <span
                                className={`text-[10.5px] font-bold tabular-nums ${n === 0 ? 'text-[#C9CFC9]' : modal ? 'text-[#8A5A00]' : 'text-[#6B6B6B]'}`}
                              >
                                {n}
                              </span>
                              {/* definite-height bar area so % heights resolve */}
                              <div className="flex h-full w-full flex-1 items-end justify-center py-1">
                                <div
                                  className={`w-full max-w-[44px] rounded-t-md transition-all duration-700 ${
                                    n === 0 ? 'bg-[#EAF0EC]' : modal ? 'bg-[#B88E2F]' : 'bg-[#0F3D3E]'
                                  }`}
                                  style={{ height: `${h}%`, transitionDelay: `${idx * 55}ms` }}
                                />
                              </div>
                              <span className="text-[10px] font-semibold text-[#969696]">{label}</span>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                  {fbAgg.quotes.length > 0 && (
                    <ul className="mt-4 flex flex-col gap-2.5 border-t border-dashed border-[#E3E7E0] pt-3.5">
                      {fbAgg.quotes.map((q) => (
                        <li
                          key={`${q.order_number}-${q.created_at}`}
                          className="rounded-r-lg border-l-2 border-[#B88E2F] bg-[#FDFBF5] py-2 pl-3 pr-2.5 transition hover:bg-[#FBF5E6]"
                        >
                          <div className="flex items-start gap-1.5">
                            <Quote size={11} aria-hidden className="mt-0.5 shrink-0 text-[#B88E2F]" />
                            <p className="min-w-0 flex-1 text-[12px] italic leading-snug text-[#1A1A1A]">
                              “{q.comment!.trim()}”
                            </p>
                            <span className="inline-flex shrink-0 items-center gap-1 text-[10.5px] font-bold tabular-nums text-[#8A5A00]">
                              <Star size={10} aria-hidden className="fill-[#B88E2F] text-[#B88E2F]" />
                              {q.rating} · #{q.order_number}
                            </span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                  {/* 5.70.0 — the recover list: every ≤3-star rating in the window
                      becomes a named callback. The bell rings at ≤2 (030's
                      trigger); this is the season-long sheet, three-star "meh"
                      included, each row opening the CRM the ticket booked. */}
                  {fbAgg.low.length > 0 ? (
                    <div className="mt-4 border-t border-dashed border-[#E3E7E0] pt-3.5">
                      <div className="flex items-baseline justify-between gap-2">
                        <h3 className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.08em] text-[#8A938C]">
                          <HeartHandshake size={12} aria-hidden />
                          The recover list
                        </h3>
                        <span className="text-[10px] font-semibold text-[#969696]">
                          every rating ≤ 3 · newest first
                        </span>
                      </div>
                      <ul className="mt-2.5 flex flex-col gap-2">
                        {fbAgg.low.map((f) => {
                          const who = f.customer_name || (f.customer_phone ? f.customer_phone : null);
                          /* severity storytelling: ≤2★ is the bell's alarm
                           * (030's trigger — red), 3★ is the "meh" that still
                           * deserves a name (amber). Same row, honest tier. */
                          const alarm = f.rating <= 2;
                          return (
                            <li
                              key={`low-${f.order_number}-${f.created_at}`}
                              className={`rounded-r-lg border-l-2 py-2 pl-3 pr-2.5 ${
                                alarm ? 'border-[#B3261E] bg-[#FDF7F6]' : 'border-[#C9A227] bg-[#FDFBF5]'
                              }`}
                            >
                              <div className="flex items-start gap-2">
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5">
                                    <span
                                      className={`inline-flex shrink-0 items-center gap-0.5 text-[10.5px] font-bold tabular-nums ${alarm ? 'text-[#B3261E]' : 'text-[#8A6D1F]'}`}
                                      aria-label={`${f.rating} star rating`}
                                    >
                                      {Array.from({ length: f.rating }).map((_, i) => (
                                        <Star
                                          key={i}
                                          size={10}
                                          aria-hidden
                                          className={alarm ? 'fill-[#B3261E] text-[#B3261E]' : 'fill-[#C9A227] text-[#C9A227]'}
                                        />
                                      ))}
                                      {f.rating}
                                    </span>
                                    <span className="text-[10.5px] font-bold tabular-nums text-[#6B6B6B]">
                                      #{f.order_number}
                                    </span>
                                    <span className="text-[10px] font-semibold text-[#969696]">
                                      {appFormatters().dt.format(new Date(f.created_at))}
                                    </span>
                                  </div>
                                  <p className="mt-0.5 truncate text-[12px] italic leading-snug text-[#1A1A1A]">
                                    {f.comment && f.comment.trim().length > 0
                                      ? `“${f.comment.trim()}”`
                                      : 'no comment — the stars said it'}
                                  </p>
                                  <p className="mt-0.5 truncate text-[10.5px] font-semibold text-[#969696]">
                                    {who
                                      ? `${f.customer_name || ''}${f.customer_name && f.customer_phone ? ' · ' : ''}${f.customer_phone || ''}`
                                      : 'anonymous ticket — no guest on file'}
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => goSection('customers', ['Reports', 'Guests'])}
                                  aria-label={
                                    who
                                      ? `Open Guests — find ${f.customer_name || f.customer_phone} and make it right`
                                      : 'Open Guests — the CRM books every phone automatically'
                                  }
                                  title={
                                    who
                                      ? `Open Guests — find ${f.customer_name || f.customer_phone} and make it right`
                                      : 'Open Guests — the CRM books every phone automatically'
                                  }
                                  className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#0F3D3E]/5 px-2 py-0.5 text-[10px] font-bold text-[#0F3D3E] transition-[background-color,transform] duration-150 hover:bg-[#0F3D3E]/10 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B88E2F]"
                                >
                                  Find guest
                                  <ArrowRight size={10} aria-hidden />
                                </button>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                      {fbInRange.filter((f) => f.rating <= 3).length > fbAgg.low.length ? (
                        <p className="pt-1.5 text-center text-[11px] text-[#969696]">
                          + {fbInRange.filter((f) => f.rating <= 3).length - fbAgg.low.length} more in the CSV export
                        </p>
                      ) : null}
                    </div>
                  ) : (
                    <p className="mt-4 flex items-center gap-1.5 border-t border-dashed border-[#E3E7E0] pt-3 text-[11.5px] font-semibold text-[#2E7D32]">
                      <CheckCircle2 size={12} aria-hidden />
                      no low stars in this window — nothing to recover
                    </p>
                  )}
                </>
              )}
            </section>

            <section className="sp-card p-5" aria-label="Drawer honesty">
              <div className="mb-1 flex items-center justify-between gap-2">
                <h2 className="text-[15px] font-bold text-[#1A1A1A]">Drawer honesty</h2>
                {shiftAgg.count > 0 && (
                  <div className="flex shrink-0 items-center gap-1.5">
                    <button
                      onClick={copyDrawer}
                      aria-live="polite"
                      aria-label="Copy the drawer as text"
                      title="Copy the drawer's sealed-shift honesty as text"
                      className="inline-flex h-7 items-center gap-1 rounded-lg border border-[#B88E2F]/45 bg-[#FDF9F0] px-2.5 text-[11px] font-bold text-[#8A5A00] transition hover:bg-[#B88E2F] hover:text-white active:scale-[0.97]"
                    >
                      {drawerCopyState === 'ok' ? (
                        <Check size={12} aria-hidden />
                      ) : (
                        <Copy size={12} aria-hidden />
                      )}
                      {drawerCopyState === 'ok'
                        ? 'Copied'
                        : drawerCopyState === 'fail'
                          ? 'Copy blocked'
                          : 'Copy'}
                    </button>
                    <a
                      href={`https://wa.me/?text=${encodeURIComponent(drawerText)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Share the drawer on WhatsApp"
                      title="Share the drawer's sealed-shift honesty on WhatsApp"
                      className="inline-flex h-7 items-center gap-1 rounded-lg border border-[#B88E2F]/45 bg-[#FDF9F0] px-2.5 text-[11px] font-bold text-[#8A5A00] transition hover:bg-[#B88E2F] hover:text-white active:scale-[0.97]"
                    >
                      <MessageCircle size={12} aria-hidden />
                      WhatsApp
                    </a>
                    <button
                      onClick={exportShifts}
                      aria-label="Export drawer shifts as CSV"
                      title="Export the sealed shifts — expected, counted, variance — as CSV"
                      className="inline-flex h-7 items-center rounded-lg border border-[#B88E2F]/45 bg-[#FDF9F0] px-2.5 text-[11px] font-bold text-[#8A5A00] transition hover:bg-[#B88E2F] hover:text-white active:scale-[0.97]"
                    >
                      CSV
                    </button>
                  </div>
                )}
              </div>
              <p className="mb-4 text-[11.5px] text-[#969696]">
                Sealed shifts only — expected is the ledger's math, variance is stored, never
                re-derived. {RANGE_LABEL[range].toLowerCase()}.
              </p>
              {shiftAgg.count === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
                  <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#EAF0EC]">
                    <HandCoins size={22} className="text-[#0F3D3E]" aria-hidden />
                  </span>
                  <p className="text-[12.5px] font-semibold text-[#1A1A1A]">
                    No sealed shifts in this range
                  </p>
                  <p className="max-w-[230px] text-[11.5px] text-[#969696]">
                    Close a drawer shift on Close-out and its honesty lands here.
                  </p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div
                      className={`rounded-xl border px-3.5 py-3 ${
                        varianceTone(shiftAgg.net).cls.includes('2E7D32')
                          ? 'border-[#BFDCC5] bg-[#F4FAF5]'
                          : varianceTone(shiftAgg.net).cls.includes('8A5A00')
                            ? 'border-[#EBD9A8] bg-[#FFFBF2]'
                            : 'border-[#F0C4BE] bg-[#FEF4F3]'
                      }`}
                    >
                      <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#969696]">
                        Net variance
                      </p>
                      <p
                        className={`mt-1 truncate text-[18px] font-extrabold tabular-nums leading-tight ${varianceTone(shiftAgg.net).cls}`}
                      >
                        {signedMoney(shiftAgg.net)}
                      </p>
                      <p className="mt-0.5 text-[10px] font-semibold text-[#969696]">
                        {varianceTone(shiftAgg.net).label}
                      </p>
                    </div>
                    <div className="rounded-xl border border-[#E3E7E0] bg-white px-3.5 py-3">
                      <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#969696]">
                        Shifts sealed
                      </p>
                      <p className="mt-1 truncate text-[18px] font-extrabold tabular-nums leading-tight text-[#0F3D3E]">
                        {shiftAgg.count}
                      </p>
                      <p className="mt-0.5 text-[10px] font-semibold text-[#969696]">
                        closed in range
                      </p>
                    </div>
                  </div>
                  {varianceSeries.length > 0 && (
                    <div className="mt-4 border-t border-dashed border-[#E3E7E0] pt-3">
                      <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.08em] text-[#969696]">
                        Variance, shift by shift
                      </p>
                      <div
                        className="h-28"
                        role="img"
                        aria-label={`Variance chart: ${varianceSeries.length} sealed shifts, net ${signedMoney(shiftAgg.net)}`}
                      >
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={varianceSeries}
                            margin={{ top: 4, right: 8, bottom: 0, left: -28 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" stroke="#E3E7E0" vertical={false} />
                            <XAxis
                              dataKey="short"
                              tick={{ fontSize: 9, fill: '#969696' }}
                              tickLine={false}
                              axisLine={{ stroke: '#E3E7E0' }}
                              interval={0}
                            />
                            <YAxis
                              tick={{ fontSize: 9, fill: '#969696' }}
                              tickLine={false}
                              axisLine={false}
                              tickFormatter={(v: number) =>
                                v === 0 ? '0' : `${v > 0 ? '+' : '−'}${Math.abs(Math.round(v))}`
                              }
                            />
                            <Tooltip
                              cursor={{ fill: 'rgba(184,142,47,0.08)' }}
                              contentStyle={CHART_TOOLTIP_STYLE}
                              labelStyle={CHART_TOOLTIP_LABEL}
                              formatter={(v: unknown) => [signedMoney(Number(v)), 'Variance']}
                            />
                            <ReferenceLine y={0} stroke="#C9D2CB" />
                            <Bar
                              dataKey="variance"
                              radius={[3, 3, 3, 3]}
                              maxBarSize={26}
                              aria-hidden
                            >
                              {varianceSeries.map((s) => (
                                <Cell key={s.id} fill={varianceColor(s.variance)} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}
                  <ul className="mt-4 flex flex-col gap-2.5 border-t border-dashed border-[#E3E7E0] pt-3.5">
                    {shiftsInRange.slice(0, 5).map((s) => {
                      const v = Number(s.variance ?? 0);
                      const t = varianceTone(v);
                      return (
                        <li key={s.id}>
                          <div className="flex items-center justify-between gap-2">
                            <span className="min-w-0 truncate text-[11.5px] font-semibold text-[#1A1A1A]">
                              {s.closed_at ? appFormatters().dt.format(new Date(s.closed_at)) : '—'}
                            </span>
                            <span className="flex shrink-0 items-center gap-2">
                              <span className="text-[10.5px] tabular-nums text-[#969696]">
                                {formatMoney(Number(s.expected_cash ?? 0))} exp ·{' '}
                                {formatMoney(Number(s.counted_cash ?? 0))} counted
                              </span>
                              <span
                                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-bold tabular-nums ${t.chip}`}
                              >
                                {signedMoney(v)}
                              </span>
                            </span>
                          </div>
                          {s.closing_note ? (
                            <p
                              className="mt-0.5 line-clamp-2 pl-0.5 text-[10.5px] italic text-[#969696]"
                              title={s.closing_note}
                            >
                              “{s.closing_note}”
                            </p>
                          ) : null}
                        </li>
                      );
                    })}
                    {shiftsInRange.length > 5 && (
                      <li className="pt-1 text-center text-[11.5px] text-[#969696]">
                        + {shiftsInRange.length - 5} more sealed in range
                      </li>
                    )}
                  </ul>
                </>
              )}
            </section>
          </div>

          <p className="px-1 text-[10.5px] text-[#969696]">
            Aggregated from the most recent 500 tickets in the cloud, {appTzTag()} calendar days. Cancelled
            tickets are excluded from every money figure; margin is computed on paid tickets only.
            Comparison chips read the equal-length window immediately before the selected range,
            from the same ledger. Guest satisfaction reads the ratings ledger; drawer honesty reads
            sealed shifts only. All-time day buckets show the most recent 30 ticket days.
          </p>
        </>
      )}
    </div>
  );
};

/* ─────────────────────────── small pieces ─────────────────────────────── */

/** Margin health — typical cafe economics: ≥65% healthy, 40–65% watch, <40% alarm. */
function marginTone(pct: number): string {
  if (pct >= 65) return '#2E7D32';
  if (pct >= 40) return '#8A5A00';
  return '#B3261E';
}

/** 5.73.0 — the menu-engineering quadrants, in the house palette. */
const MENU_QUADRANTS: { key: 'star' | 'plowhorse' | 'puzzle' | 'dog'; label: string; verdict: string; color: string; bg: string }[] = [
  { key: 'star', label: 'Stars', verdict: 'popular and rich — protect them', color: '#8A5A00', bg: '#F3E8CF' },
  { key: 'puzzle', label: 'Puzzles', verdict: 'rich but rarely ordered — push them', color: '#0F3D3E', bg: '#EAF0EC' },
  { key: 'plowhorse', label: 'Plowhorses', verdict: 'popular but thin — re-price or re-recipe', color: '#8A5A00', bg: '#F3E8CF' },
  { key: 'dog', label: 'Dogs', verdict: 'neither popular nor rich — review their place', color: '#6B6B6B', bg: '#F1F1EE' },
];

function marginWord(pct: number): string {
  if (pct >= 65) return 'healthy for a cafe';
  if (pct >= 40) return 'worth watching';
  return 'check your pricing';
}

function peakHourLabel(hourly: { hour: number; gross: number }[]): string {
  let best = -1;
  let bestVal = 0;
  for (const h of hourly) {
    if (h.gross > bestVal) {
      bestVal = h.gross;
      best = h.hour;
    }
  }
  return best < 0 || bestVal === 0 ? '—' : `${hourLabel(best)} (${formatMoney(bestVal)})`;
}

/** Delta chip — the "vs prior range" comparison on the headline KPIs
 *  (v5.20.0). Direction-colored in the app's health vocabulary: up = green,
 *  down = red, flat = gray, and an honest teal "new" when the prior window
 *  had no sales at all. The exact figures always live in the tooltip + aria
 *  label — a percentage never hides the money it came from. */
const DELTA_SKIN: Record<'up' | 'down' | 'flat' | 'new', { fg: string; bg: string; bd: string }> = {
  up: { fg: '#2E7D32', bg: '#E7F2EB', bd: '#CFE6D8' },
  down: { fg: '#B3261E', bg: '#FDEEEC', bd: '#F0C4BE' },
  flat: { fg: '#6B6B6B', bg: '#F1F2EF', bd: '#E3E7E0' },
  new: { fg: '#0F3D3E', bg: '#DCE9E4', bd: '#C6D8D1' },
};

const DeltaChip: React.FC<{
  current: number;
  prior: number;
  baseline: string;
  fmt: (n: number) => string;
}> = ({ current, prior, baseline, fmt }) => {
  if (prior === 0 && current === 0) return null;
  const isNew = prior === 0 && current > 0;
  const pct = prior > 0 ? ((current - prior) / prior) * 100 : 0;
  /* 5.94.0 — the multiple voice: at extreme ratios a percentage slab is a
   *  dare, not a signal ("1471% vs prior 7 days" — true, and useless). From
   *  1000% up — eleven times prior and beyond — the chip speaks in multiples
   *  ("15.7×"), the way the counter actually says it; the title/aria still
   *  carry both raw numbers, so the truth never left the chip. */
  const mult = pct >= 1000 ? current / prior : null;
  const flat = !isNew && mult === null && Math.abs(pct) < 0.05;
  const kind = isNew ? 'new' : flat ? 'flat' : pct > 0 ? 'up' : 'down';
  const skin = DELTA_SKIN[kind];
  const text = isNew
    ? 'new'
    : flat
      ? '±0%'
      : mult !== null
        ? `${mult.toFixed(1)}×`
        : `${Math.abs(pct) >= 100 ? Math.round(Math.abs(pct)) : Math.abs(pct).toFixed(1)}%`;
  const detail = isNew
    ? `${fmt(current)} — no sales in the earlier window (${baseline})`
    : mult !== null
      ? `${fmt(current)} vs ${fmt(prior)} — ${mult.toFixed(1)}× the earlier window (${baseline})`
      : `${fmt(current)} vs ${fmt(prior)} (${baseline})`;
  const Icon = kind === 'up' ? TrendingUp : kind === 'down' ? TrendingDown : Minus;
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-[1.5px] text-[10px] font-bold leading-none tabular-nums"
      style={{ color: skin.fg, backgroundColor: skin.bg, border: `1px solid ${skin.bd}` }}
      title={detail}
      aria-label={`vs ${baseline}: ${detail}`}
    >
      <Icon size={10} aria-hidden strokeWidth={2.5} />
      {text}
    </span>
  );
};

const StatCard: React.FC<{
  label: string;
  value: string;
  sub?: string;
  tone: string;
  delta?: React.ReactNode;
  deltaBaseline?: string;
  /** v5.25.0 — the day-shape behind the number (per-IST-day series of THIS
   *  metric). Revealed on hover/focus via React state (not CSS variants —
   *  deterministic everywhere); one point draws nothing because one day
   *  can't show a shape. */
  spark?: number[];
}> = ({ label, value, sub, tone, delta, deltaBaseline, spark }) => {
  const [sparkOn, setSparkOn] = useState(false);
  const sparkable = !!spark && spark.length >= 2;
  return (
    <section
      className="sp-card p-4 transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_22px_rgba(15,61,62,0.10)] focus-within:-translate-y-0.5 focus-within:shadow-[0_8px_22px_rgba(15,61,62,0.10)]"
      aria-label={label}
      tabIndex={0}
      onMouseEnter={() => setSparkOn(true)}
      onMouseLeave={() => setSparkOn(false)}
      onFocus={() => setSparkOn(true)}
      onBlur={() => setSparkOn(false)}
    >
      <p className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-[#969696]">{label}</p>
      <p
        className="mt-1.5 truncate text-[19px] font-extrabold tabular-nums leading-tight"
        style={{ color: tone }}
      >
        {value}
      </p>
      {delta ? (
        <div className="mt-1.5 flex items-center gap-1">
          {delta}
          {deltaBaseline ? (
            <span className="truncate text-[10px] font-medium text-[#969696]">vs {deltaBaseline}</span>
          ) : null}
        </div>
      ) : null}
      {sub ? <p className="mt-0.5 truncate text-[10.5px] text-[#969696]">{sub}</p> : null}
      {sparkable ? (
        <div
          className={`mt-2 flex items-center gap-2 overflow-hidden transition-opacity duration-200 ${
            sparkOn ? 'opacity-100' : 'hidden'
          }`}
        >
          <Sparkline values={spark!} stroke={tone} />
          <span className="shrink-0 text-[9.5px] font-semibold uppercase tracking-wide text-[#969696]">
            per day
          </span>
        </div>
      ) : null}
    </section>
  );
};

/** v5.25.0 — a tiny honest polyline: normalized to the series max, dotted
 *  baseline when the whole series is zero (a flat nothing is drawn AS a flat
 *  nothing, never as a trend). Pure SVG, no chart dependency. */
const SPARK_W = 92;
const SPARK_H = 24;
const Sparkline: React.FC<{ values: number[]; stroke: string }> = ({ values, stroke }) => {
  const max = Math.max(...values, 0);
  const min = Math.min(...values, 0);
  const span = max - min;
  const pts =
    span === 0
      ? null // all-zero (or all-equal) — no shape to draw
      : values
          .map((v, i) => {
            const x = values.length === 1 ? SPARK_W / 2 : (i / (values.length - 1)) * (SPARK_W - 2) + 1;
            const y = SPARK_H - 2 - ((v - min) / span) * (SPARK_H - 4);
            return `${x.toFixed(1)},${y.toFixed(1)}`;
          })
          .join(' ');
  const zeroY = span === 0 ? SPARK_H - 2 : SPARK_H - 2 - ((0 - min) / span) * (SPARK_H - 4);
  return (
    <svg
      width={SPARK_W}
      height={SPARK_H}
      viewBox={`0 0 ${SPARK_W} ${SPARK_H}`}
      role="img"
      aria-label={`Daily trend: ${values.map((v) => Math.round(v)).join(', ')}`}
      className="shrink-0"
    >
      <line x1="0" x2={SPARK_W} y1={zeroY} y2={zeroY} stroke="#E3E7E0" strokeWidth="1" strokeDasharray="2 2" />
      {pts ? (
        <>
          <polyline points={pts} fill="none" stroke={stroke} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
          <circle
            cx={SPARK_W - 1}
            cy={SPARK_H - 2 - ((values[values.length - 1] - min) / span) * (SPARK_H - 4)}
            r="2.2"
            fill={stroke}
          />
        </>
      ) : null}
    </svg>
  );
};

const ReportsSkeleton: React.FC = () => (
  <div className="flex flex-col gap-4 p-4" aria-busy="true" aria-label="Loading reports">
    <div className="sp-skeleton h-14 w-72 rounded-2xl" />
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="sp-skeleton h-[86px] rounded-2xl" />
      ))}
    </div>
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
      <div className="sp-skeleton h-72 rounded-2xl xl:col-span-2" />
      <div className="sp-skeleton h-72 rounded-2xl" />
    </div>
  </div>
);
