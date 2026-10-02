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
  CalendarRange,
  Clock,
  Coins,
  Download,
  Flame,
  HandCoins,
  Minus,
  QrCode,
  Quote,
  RefreshCw,
  ShoppingBag,
  Star,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import {
  fetchDrawerHistory,
  fetchFeedbackRows,
  fetchItemUnitCosts,
  fetchOrderCogs,
  fetchOrders,
} from '../../lib/api';
import type { DrawerSession, FeedbackRow } from '../../lib/api';
import { formatMoney } from '../../lib/prefs';
import { downloadCsv } from '../../lib/csv';
import { useTenant } from '../../lib/tenant';
import type { Order } from '../../types';

/**
 * Reports (NOVA — manager reports: sales / items / hours).
 *
 * The Dashboard answers "how is RIGHT NOW?"; Reports answers "where does the
 * business actually stand?" over a real range (Today / 7 days / 30 days /
 * All time, in IST calendar days like Close-out):
 *
 *   1. Headline strip — gross, GST collected, net (ex-GST), orders (+
 *      cancelled sinkage), average ticket, items sold — each carrying a
 *      "vs prior range" delta chip: the same KPI recomputed over the
 *      equal-length window immediately before the selected one (prior day /
 *      prior 7 / prior 30). All time has no earlier boundary, so it gets no
 *      chips instead of a fake baseline; empty prior windows chip "new".
 *   2. Trends — the shape of the range, day by day (IST calendar days):
 *      gross bars + ticket line per day with the best day gold, and the
 *      guest-rating average per day as a gold line with honest gaps.
 *   3. Sales by hour — a bar chart of when the day actually earns (IST hours,
 *      whole range summed). The Dashboard only charts today; this is the trend.
 *   4. Payment mix — how money arrived (cash / UPI / card) + what's still out.
 *   5. Cost & margin — the inventory shelf prices the menu (018 views):
 *      COGS, gross margin and margin-% on PAID tickets, with a revenue-split
 *      bar (what the shelf burned vs what the cafe keeps).
 *   6. Top items — best sellers by revenue with unit counts, share bars and
 *      per-item margin chips, exportable as CSV.
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

const IST_TZ = 'Asia/Kolkata';

/* ── IST day windows (same calendar math as Close-out) ─────────────────── */

function istTodayIso(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: IST_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function istDayStart(dateIso: string): number {
  return new Date(`${dateIso}T00:00:00+05:30`).getTime();
}

function rangeWindow(range: RangeKey): { startMs: number | null; endMs: number } {
  const endMs = istDayStart(istTodayIso()) + 24 * 3600 * 1000; // end of today (IST)
  if (range === 'all') return { startMs: null, endMs };
  const days = range === 'today' ? 1 : range === '7d' ? 7 : 30;
  return { startMs: endMs - days * 24 * 3600 * 1000, endMs };
}

/** The EQUAL-LENGTH window immediately before the current one (v5.19.0) —
 *  the honest baseline for the KPI delta chips. 'all' has no earlier
 *  boundary in the ledger, so it gets NO chips rather than a fake baseline. */
function priorWindow(range: RangeKey): { startMs: number; endMs: number } | null {
  if (range === 'all') return null;
  const { startMs, endMs } = rangeWindow(range);
  const days = range === 'today' ? 1 : range === '7d' ? 7 : 30;
  const span = days * 24 * 3600 * 1000;
  const start = startMs ?? endMs - span;
  return { startMs: start - span, endMs: start };
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

/** Hour-of-day (0–23) in IST for an ISO timestamp. */
function istHour(iso: string): number {
  const h = new Intl.DateTimeFormat('en-GB', {
    timeZone: IST_TZ,
    hour: '2-digit',
    hour12: false,
  }).format(new Date(iso));
  return Number(h) % 24;
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

const IST_DT = new Intl.DateTimeFormat('en-IN', {
  timeZone: IST_TZ,
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

/* ── IST day keys/labels for the trends buckets ────────────────────────── */

const IST_DAY_KEY = new Intl.DateTimeFormat('en-CA', {
  timeZone: IST_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const IST_DAY_LABEL = new Intl.DateTimeFormat('en-IN', {
  timeZone: IST_TZ,
  day: 'numeric',
  month: 'short',
});

const IST_CLOSE_LABEL = new Intl.DateTimeFormat('en-IN', {
  timeZone: IST_TZ,
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

/** YYYY-MM-DD in IST for an ISO timestamp — the trends bucket key. */
function istDayKey(iso: string): string {
  return IST_DAY_KEY.format(new Date(iso));
}

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
  return <ReportsInner key={attempt} onTenantRetry={() => setAttempt((a) => a + 1)} />;
};

const ReportsInner: React.FC<{ onTenantRetry: () => void }> = ({ onTenantRetry }) => {
  const { tenantId, loading: tenantLoading, error: tenantError } = useTenant();
  const [range, setRange] = useState<RangeKey>('7d');
  const [orders, setOrders] = useState<Order[]>([]);
  const [cogsMap, setCogsMap] = useState<Map<string, number>>(new Map());
  const [unitCosts, setUnitCosts] = useState<Map<string, number>>(new Map());
  const [feedback, setFeedback] = useState<FeedbackRow[]>([]);
  const [shifts, setShifts] = useState<DrawerSession[]>([]);
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
        const [fb, sh] = await Promise.all([
          fetchFeedbackRows(tenantId),
          fetchDrawerHistory(tenantId, 200),
        ]);
        setFeedback(fb);
        setShifts(sh);
      } catch {
        setFeedback([]);
        setShifts([]);
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
      buckets[istHour(o.created_at)].gross += Number(o.total ?? 0);
    }
    return buckets;
  }, [inRange]);

  const payMix = useMemo(() => {
    const mix = new Map<string, { method: string; count: number; total: number }>();
    let unpaid = 0;
    let unpaidAmt = 0;
    for (const o of inRange) {
      if (String(o.status || '').toLowerCase() === 'cancelled') continue;
      if (String(o.payment_status || '').toLowerCase() === 'completed') {
        const m = String(o.payment_method || 'cash').toLowerCase();
        const cur = mix.get(m) || { method: m, count: 0, total: 0 };
        cur.count += 1;
        cur.total += Number(o.total ?? 0);
        mix.set(m, cur);
      } else {
        unpaid += 1;
        unpaidAmt += Number(o.total ?? 0);
      }
    }
    const paid = [...mix.values()].sort((a, b) => b.total - a.total);
    return { paid, unpaid, unpaidAmt };
  }, [inRange]);

  const topItems = useMemo(() => {
    const byName = new Map<string, ItemRank>();
    for (const o of inRange) {
      if (String(o.status || '').toLowerCase() === 'cancelled') continue;
      for (const it of o.items || []) {
        const cur = byName.get(it.name) || { name: it.name, units: 0, revenue: 0, cost: 0 };
        cur.units += Number(it.qty ?? 0);
        cur.revenue += Number(it.item_total ?? Number(it.unit_price ?? 0) * Number(it.qty ?? 0));
        // base-recipe ingredient cost for the units sold (variants/add-ons not priced)
        cur.cost += (unitCosts.get(it.menu_item_id ?? '') ?? 0) * Number(it.qty ?? 0);
        byName.set(it.name, cur);
      }
    }
    return [...byName.values()].sort((a, b) => b.revenue - a.revenue);
  }, [inRange, unitCosts]);

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
    const rows: (string | number)[][] = [
      ['Rank', 'Item', 'Units sold', 'Revenue (INR)', 'Ingredient cost (INR)', 'Margin (INR)', 'Margin %', 'Share of item revenue %'],
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
      ]);
    });
    downloadCsv(`servepoint-top-items-${istTodayIso()}.csv`, rows);
  }, [topItems]);

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
    return { stars, avg, count: fbInRange.length, quotes };
  }, [fbInRange]);

  const exportRatings = useCallback(() => {
    if (fbAgg.count === 0) return;
    const rows: (string | number)[][] = [
      ['Submitted (IST)', 'Order #', 'Rating (1-5)', 'Comment'],
    ];
    for (const f of [...fbInRange].reverse()) {
      rows.push([
        IST_DT.format(new Date(f.created_at)),
        f.order_number,
        f.rating,
        f.comment ?? '',
      ]);
    }
    downloadCsv(`servepoint-guest-ratings-${istTodayIso()}.csv`, rows);
  }, [fbInRange, fbAgg.count]);

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

  /* ── trends — the shape of the range, IST day by day (2.0 section) ─────── */

  const daily = useMemo(() => {
    // Bucket orders into IST days — cancelled excluded, same as every money figure.
    const byDay = new Map<string, { gross: number; tickets: number }>();
    for (const o of inRange) {
      if (String(o.status || '').toLowerCase() === 'cancelled') continue;
      const key = istDayKey(o.created_at);
      const cur = byDay.get(key) || { gross: 0, tickets: 0 };
      cur.gross += Number(o.total ?? 0);
      cur.tickets += 1;
      byDay.set(key, cur);
    }
    // The window: filled calendar days for 7d/30d (gaps read as slow days),
    // today's single day, or — for All time — the most recent 30 days that
    // actually hold tickets, said honestly in the caption.
    const { endMs } = rangeWindow(range);
    let dayMs: number[] = [];
    if (range === 'today') {
      dayMs = [endMs - 24 * 3600 * 1000];
    } else if (range === '7d' || range === '30d') {
      const days = range === '7d' ? 7 : 30;
      for (let t = endMs - days * 24 * 3600 * 1000; t < endMs; t += 24 * 3600 * 1000) dayMs.push(t);
    } else {
      dayMs = [...byDay.keys()]
        .sort()
        .slice(-30)
        .map((k) => istDayStart(k));
    }
    return dayMs.map((ms) => {
      const key = IST_DAY_KEY.format(new Date(ms));
      const cur = byDay.get(key) || { gross: 0, tickets: 0 };
      return {
        key,
        label: IST_DAY_LABEL.format(new Date(ms)),
        gross: cur.gross,
        tickets: cur.tickets,
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
    const rows: (string | number)[][] = [['Day (IST)', 'Gross (INR)', 'Tickets', 'Avg ticket (INR)']];
    for (const d of daily) {
      rows.push([d.label, d.gross.toFixed(2), d.tickets, d.tickets > 0 ? d.avg.toFixed(2) : '']);
    }
    downloadCsv(`servepoint-daily-sales-${istTodayIso()}.csv`, rows);
  }, [daily]);

  const fbDaily = useMemo(() => {
    const byDay = new Map<string, { sum: number; n: number }>();
    for (const f of fbInRange) {
      const key = istDayKey(f.created_at);
      const cur = byDay.get(key) || { sum: 0, n: 0 };
      cur.sum += f.rating;
      cur.n += 1;
      byDay.set(key, cur);
    }
    if (range === '7d' || range === '30d') {
      // Filled window: unrated days stay null so the line's gaps are honest.
      const { endMs } = rangeWindow(range);
      const days = range === '7d' ? 7 : 30;
      const out: { label: string; avg: number | null; n: number }[] = [];
      for (let t = endMs - days * 24 * 3600 * 1000; t < endMs; t += 24 * 3600 * 1000) {
        const cur = byDay.get(IST_DAY_KEY.format(new Date(t)));
        out.push({
          label: IST_DAY_LABEL.format(new Date(t)),
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
        return { label: IST_DAY_LABEL.format(new Date(istDayStart(k))), avg: cur.sum / cur.n, n: cur.n };
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
        short: s.closed_at ? IST_CLOSE_LABEL.format(new Date(s.closed_at)) : '—',
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
            <h1 className="text-[20px] font-bold leading-tight text-[#1A1A1A]">Reports</h1>
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
          {...deltaProps(agg.gross, priorAgg?.gross ?? 0, formatMoney)}
        />
        <StatCard
          label="GST collected"
          value={formatMoney(agg.gst)}
          tone="#8A5A00"
          {...deltaProps(agg.gst, priorAgg?.gst ?? 0, formatMoney)}
        />
        <StatCard
          label="Net (ex-GST)"
          value={formatMoney(agg.net)}
          tone="#0F3D3E"
          {...deltaProps(agg.net, priorAgg?.net ?? 0, formatMoney)}
        />
        <StatCard
          label="Orders"
          value={String(agg.placed)}
          sub={agg.cancelled > 0 ? `${agg.cancelled} cancelled excluded` : 'live in range'}
          tone="#0F3D3E"
          {...deltaProps(agg.placed, priorAgg?.placed ?? 0, (n) => String(Math.round(n)))}
        />
        <StatCard
          label="Avg ticket"
          value={formatMoney(agg.avgTicket)}
          tone="#B88E2F"
          {...deltaProps(agg.avgTicket, priorAgg?.avgTicket ?? 0, formatMoney)}
        />
        <StatCard
          label="Items sold"
          value={String(agg.items)}
          tone="#0F3D3E"
          {...deltaProps(agg.items, priorAgg?.items ?? 0, (n) => String(Math.round(n)))}
        />
      </div>

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
                      className="inline-flex h-7 items-center rounded-lg border border-[#B88E2F]/45 bg-[#FDF9F0] px-2.5 text-[11px] font-bold text-[#8A5A00] transition hover:bg-[#B88E2F] hover:text-white active:scale-[0.97]"
                    >
                      CSV
                    </button>
                  )}
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#6B6B6B]">
                    <CalendarRange size={11} aria-hidden /> IST days ·{' '}
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
                    Gross ₹ (bars) and tickets (line) per IST day — the shape of the range. Best
                    day:{' '}
                    <span className="font-bold text-[#8A5A00]">
                      {bestDay ? `${bestDay.label} (${formatMoney(bestDay.gross)})` : '—'}
                    </span>
                    {range === 'all' ? ' · most recent 30 ticket days shown' : ''}
                  </p>
                  <div className="h-56" aria-hidden>
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
                          contentStyle={{
                            borderRadius: 12,
                            border: '1px solid #E3E7E0',
                            fontSize: 12,
                            boxShadow: '0 4px 14px rgba(15,61,62,0.10)',
                          }}
                          formatter={(v: unknown, name: unknown) =>
                            name === 'gross'
                              ? [formatMoney(Number(v)), 'Gross']
                              : [String(v), 'Tickets']
                          }
                        />
                        <Bar yAxisId="rupees" dataKey="gross" radius={[4, 4, 0, 0]} maxBarSize={38}>
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
                Average ★ per IST day — gaps are honest unrated days.{' '}
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
                        contentStyle={{
                          borderRadius: 12,
                          border: '1px solid #E3E7E0',
                          fontSize: 12,
                          boxShadow: '0 4px 14px rgba(15,61,62,0.10)',
                        }}
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
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#6B6B6B]">
                  <Clock size={11} aria-hidden /> IST hours · {RANGE_LABEL[range].toLowerCase()}
                </span>
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
                      contentStyle={{
                        borderRadius: 12,
                        border: '1px solid #E3E7E0',
                        fontSize: 12,
                        boxShadow: '0 4px 14px rgba(15,61,62,0.10)',
                      }}
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
              <h2 className="mb-1 text-[15px] font-bold text-[#1A1A1A]">How money arrived</h2>
              <p className="mb-2 text-[11.5px] text-[#969696]">
                Paid tickets by method{payMix.unpaid > 0 ? ' — plus what is still out' : ''}
              </p>
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
                          contentStyle={{
                            borderRadius: 12,
                            border: '1px solid #E3E7E0',
                            fontSize: 12,
                          }}
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
                      </li>
                    )}
                  </ul>
                </div>
              )}
            </section>
          </div>

          {/* ── cost & margin: the shelf prices the menu (018 views) ── */}
          <section className="sp-card p-5" aria-label="Cost and margin">
            <div className="mb-1 flex items-center justify-between gap-2">
              <h2 className="text-[15px] font-bold text-[#1A1A1A]">Cost &amp; margin</h2>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#6B6B6B]">
                <Coins size={11} aria-hidden /> paid tickets only
              </span>
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
                              {it.revenue > 0 && (
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
                              )}
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
            </section>

            <section className="sp-card p-5" aria-label="Order type mix">
              <h2 className="mb-1 text-[15px] font-bold text-[#1A1A1A]">Service mix</h2>
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

          {/* ── row: guest satisfaction (019) + drawer honesty (020) ── */}
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <section className="sp-card p-5 xl:col-span-2" aria-label="Guest satisfaction">
              <div className="mb-1 flex items-center justify-between gap-2">
                <h2 className="text-[15px] font-bold text-[#1A1A1A]">Guest satisfaction</h2>
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
                </>
              )}
            </section>

            <section className="sp-card p-5" aria-label="Drawer honesty">
              <h2 className="mb-1 text-[15px] font-bold text-[#1A1A1A]">Drawer honesty</h2>
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
                              contentStyle={{
                                borderRadius: 12,
                                border: '1px solid #E3E7E0',
                                fontSize: 12,
                                boxShadow: '0 4px 14px rgba(15,61,62,0.10)',
                              }}
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
                              {s.closed_at ? IST_DT.format(new Date(s.closed_at)) : '—'}
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
                            <p className="mt-0.5 truncate pl-0.5 text-[10.5px] italic text-[#969696]">
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
            Aggregated from the most recent 500 tickets in the cloud, IST calendar days. Cancelled
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
  const flat = !isNew && Math.abs(pct) < 0.05;
  const kind = isNew ? 'new' : flat ? 'flat' : pct > 0 ? 'up' : 'down';
  const skin = DELTA_SKIN[kind];
  const text = isNew
    ? 'new'
    : flat
      ? '±0%'
      : `${Math.abs(pct) >= 100 ? Math.round(Math.abs(pct)) : Math.abs(pct).toFixed(1)}%`;
  const detail = isNew
    ? `${fmt(current)} — no sales in the earlier window (${baseline})`
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
}> = ({ label, value, sub, tone, delta, deltaBaseline }) => (
  <section
    className="sp-card p-4 transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_22px_rgba(15,61,62,0.10)]"
    aria-label={label}
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
  </section>
);

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
