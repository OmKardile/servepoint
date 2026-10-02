import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  CalendarRange,
  Clock,
  Download,
  Flame,
  QrCode,
  RefreshCw,
  ShoppingBag,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { fetchOrders } from '../../lib/api';
import { formatMoney } from '../../lib/prefs';
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
 *      cancelled sinkage), average ticket, items sold.
 *   2. Sales by hour — a bar chart of when the day actually earns (IST hours,
 *      whole range summed). The Dashboard only charts today; this is the trend.
 *   3. Payment mix — how money arrived (cash / UPI / card) + what's still out.
 *   4. Top items — best sellers by revenue with unit counts and share bars,
 *      exportable as CSV.
 *   5. Service mix — dine-in / takeaway / delivery split.
 *
 * Data truth: the orders + order_items tables, aggregated client-side. The
 * window scans at most the most recent 500 tickets (a cafe month) — stated
 * honestly in the footer, no silent truncation beyond that.
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

/* ── CSV (same injection-safe escaping as Bills — shared lib can come later) */

function csvCell(value: unknown): string {
  let s =
    value === null || value === undefined
      ? ''
      : String(value).replace(/\r/g, '').replace(/\n/g, ' ');
  if (/^[=+\-@]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

function downloadCsv(filename: string, rows: (string | number)[][]): void {
  if (rows.length === 0) return;
  const lines = rows.map((r) => r.map(csvCell).join(','));
  const blob = new Blob(['\ufeff' + lines.join('\n')], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/* ── aggregation shapes ─────────────────────────────────────────────────── */

interface ItemRank {
  name: string;
  units: number;
  revenue: number;
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

/* ─────────────────────────────── screen ────────────────────────────────── */

export const ReportsScreen: React.FC = () => {
  const [attempt, setAttempt] = useState(0);
  return <ReportsInner key={attempt} onTenantRetry={() => setAttempt((a) => a + 1)} />;
};

const ReportsInner: React.FC<{ onTenantRetry: () => void }> = ({ onTenantRetry }) => {
  const { tenantId, loading: tenantLoading, error: tenantError } = useTenant();
  const [range, setRange] = useState<RangeKey>('7d');
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshedAt, setRefreshedAt] = useState<Date | null>(null);

  const load = useCallback(async () => {
    if (!tenantId) return;
    setError(null);
    try {
      // Recent 500 tickets — a cafe month; the footer states the cap honestly.
      const data = await fetchOrders(tenantId, 500);
      setOrders(data);
      setRefreshedAt(new Date());
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

  const agg = useMemo(() => {
    let gross = 0;
    let gst = 0;
    let net = 0;
    let placed = 0;
    let cancelled = 0;
    let items = 0;
    for (const o of inRange) {
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
    }
    const avgTicket = placed > 0 ? gross / placed : 0;
    return { gross, gst, net, placed, cancelled, items, avgTicket };
  }, [inRange]);

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
        const cur = byName.get(it.name) || { name: it.name, units: 0, revenue: 0 };
        cur.units += Number(it.qty ?? 0);
        cur.revenue += Number(it.item_total ?? Number(it.unit_price ?? 0) * Number(it.qty ?? 0));
        byName.set(it.name, cur);
      }
    }
    return [...byName.values()].sort((a, b) => b.revenue - a.revenue);
  }, [inRange]);

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
      ['Rank', 'Item', 'Units sold', 'Revenue (INR)', 'Share of item revenue %'],
    ];
    const total = topItems.reduce((n, it) => n + it.revenue, 0) || 1;
    topItems.forEach((it, i) => {
      rows.push([
        i + 1,
        it.name,
        it.units,
        it.revenue.toFixed(2),
        ((it.revenue / total) * 100).toFixed(1),
      ]);
    });
    downloadCsv(`servepoint-top-items-${istTodayIso()}.csv`, rows);
  }, [topItems]);

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
        <StatCard label="Gross sales" value={formatMoney(agg.gross)} tone="#0F3D3E" />
        <StatCard label="GST collected" value={formatMoney(agg.gst)} tone="#8A5A00" />
        <StatCard label="Net (ex-GST)" value={formatMoney(agg.net)} tone="#0F3D3E" />
        <StatCard
          label="Orders"
          value={String(agg.placed)}
          sub={agg.cancelled > 0 ? `${agg.cancelled} cancelled excluded` : 'live in range'}
          tone="#0F3D3E"
        />
        <StatCard label="Avg ticket" value={formatMoney(agg.avgTicket)} tone="#B88E2F" />
        <StatCard label="Items sold" value={String(agg.items)} tone="#0F3D3E" />
      </div>

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
                            <span className="truncate text-[13px] font-bold text-[#1A1A1A]">
                              {it.name}
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

          <p className="px-1 text-[10.5px] text-[#969696]">
            Aggregated from the most recent 500 tickets in the cloud, IST calendar days. Cancelled
            tickets are excluded from every money figure.
          </p>
        </>
      )}
    </div>
  );
};

/* ─────────────────────────── small pieces ─────────────────────────────── */

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

const StatCard: React.FC<{ label: string; value: string; sub?: string; tone: string }> = ({
  label,
  value,
  sub,
  tone,
}) => (
  <section className="sp-card p-4" aria-label={label}>
    <p className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-[#969696]">{label}</p>
    <p
      className="mt-1.5 truncate text-[19px] font-extrabold tabular-nums leading-tight"
      style={{ color: tone }}
    >
      {value}
    </p>
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
