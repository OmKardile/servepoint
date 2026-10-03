import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CalendarClock,
  ChevronDown,
  CircleSlash,
  CheckCircle2,
  Clock,
  Coins,
  Flame,
  Heart,
  History,
  Inbox,
  Info,
  PackageMinus,
  ReceiptText,
  ShoppingBag,
  Split,
  Star,
  TrendingDown,
  TrendingUp,
  UserPlus,
  Wallet,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { fetchDashboard, fetchFeedbackStats, fetchInventory, fetchMenuItems, fetchOpenPaymentSums, fetchOrders, fetchReservations, fetchTables, fetchTodayCostMargin, type DiningTable, type FeedbackStats, type InventoryItem, type Reservation, type TodayCostMargin } from '../../lib/api';
import { formatMoney } from '../../lib/prefs';
import { isSameLocalDay } from '../../lib/day';
import { useTenant } from '../../lib/tenant';
import { useUi } from '../../store/session';
import { DoorChip } from '../shell/DoorChip';
import type { DashboardData, MenuItem, Order } from '../../types';

/**
 * Dashboard (ServePoint v5.0.0, ADR-0014) — rebuilt from the Figma frames:
 *   Dashboard_219-29880 (primary), Dashboard_219-26483 (grid variant),
 *   Empty_State_219-29868 (empty-state language).
 * Production data only: fetchDashboard(tenantId) — no mock data, no fallbacks.
 */

type Range = 'today' | 'week';

const SERIES = [
  { key: 'dineIn', label: 'Dine-in', color: '#0F3D3E' },
  { key: 'takeaway', label: 'Takeaway', color: '#B88E2F' },
  { key: 'delivery', label: 'Delivery', color: '#B42318' },
] as const;

const TYPE_COLORS: Record<string, string> = {
  'Dine-in': '#0F3D3E',
  Takeaway: '#B88E2F',
  Delivery: '#B42318',
};

const TOOLTIP_STYLE: React.CSSProperties = {
  background: '#FFFFFF',
  border: '1px solid #E3E7E0',
  borderRadius: 12,
  fontSize: 12,
  color: '#1A1A1A',
  boxShadow: '0 10px 28px rgba(15, 61, 62, 0.10)',
  padding: '8px 12px',
};

const compactTick = (v: number | string): string => {
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v);
  return n >= 1000 ? `${Math.round((n / 1000) * 10) / 10}k` : `${n}`;
};

const initialsOf = (name: string): string =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join('') || '?';

/** Momentum bar fill derived from the real trend % vs yesterday (no invented data). */
const momentumFill = (pct: number): number => Math.max(6, Math.min(100, Math.round(Math.abs(pct))));

/* ───────────────────────────── Small helpers ───────────────────────────── */

const TrendChip: React.FC<{ pct: number }> = ({ pct }) => {
  const positive = pct >= 0;
  return (
    <span
      className={`mt-0.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
        positive ? 'bg-[#F3E8CF] text-[#967221]' : 'bg-[#FBEAE9] text-[#B42318]'
      }`}
    >
      {positive ? <TrendingUp size={12} aria-hidden /> : <TrendingDown size={12} aria-hidden />}
      {positive ? '+' : '-'}
      {Math.abs(pct).toFixed(2)}%
    </span>
  );
};

const RangeSelect: React.FC<{
  id: string;
  label: string;
  value: Range;
  onChange: (r: Range) => void;
}> = ({ id, label, value, onChange }) => (
  <div className="relative shrink-0">
    <select
      id={id}
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value as Range)}
      className="cursor-pointer appearance-none rounded-lg border border-[#E3E7E0] bg-white py-2.5 pl-3.5 pr-9 text-[12.5px] font-medium text-[#1A1A1A] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B88E2F]/40"
    >
      <option value="today">Today</option>
      <option value="week">Last 7 days</option>
    </select>
    <ChevronDown
      size={14}
      aria-hidden
      className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#6B6B6B]"
    />
  </div>
);

const CardHead: React.FC<{
  title: string;
  selectId: string;
  range: Range;
  onRange: (r: Range) => void;
}> = ({ title, selectId, range, onRange }) => (
  <div className="flex items-center justify-between gap-3">
    <h2 className="text-[15px] font-semibold text-[#1A1A1A]">{title}</h2>
    <RangeSelect id={selectId} label={`${title} date range`} value={range} onChange={onRange} />
  </div>
);

const LegendDots: React.FC<{ items?: { color: string; label: string }[] }> = ({
  items = SERIES.map((s) => ({ color: s.color, label: s.label })),
}) => (
  <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5">
    {items.map((s) => (
      <span key={s.label} className="flex items-center gap-2 text-[12px] text-[#6B6B6B]">
        <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
        {s.label}
      </span>
    ))}
  </div>
);

const ListEmptyRow: React.FC<{ message: string }> = ({ message }) => (
  <li className="py-8 text-center text-[13px] text-[#969696]">{message}</li>
);

/* ───────────────────────────── Card bodies ───────────────────────────── */

const DailySalesCard: React.FC<{ data: DashboardData }> = ({ data }) => (
  <section className="sp-card p-5 md:col-span-2 xl:col-span-2" aria-label="Daily Sales">
    <h2 className="text-[15px] font-semibold text-[#1A1A1A]">Daily Sales</h2>
    <div
      className="mt-3 h-[230px] w-full"
      role="img"
      aria-label="Line chart of today's hourly sales for Dine-in, Takeaway and Delivery"
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data.hourlySales} margin={{ top: 8, right: 8, bottom: 0, left: -14 }}>
          <CartesianGrid stroke="#E3E7E0" strokeDasharray="5 6" vertical={false} />
          <XAxis
            dataKey="hour"
            axisLine={false}
            tickLine={false}
            tickMargin={10}
            tick={{ fill: '#969696', fontSize: 12 }}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            width={44}
            tick={{ fill: '#969696', fontSize: 12 }}
            tickFormatter={compactTick}
          />
          <Tooltip
            cursor={{ stroke: '#C9CFC9', strokeDasharray: '4 4' }}
            contentStyle={TOOLTIP_STYLE}
            labelStyle={{ color: '#6B6B6B', marginBottom: 4 }}
            formatter={(value) => formatMoney(Number(value))}
          />
          {SERIES.map((s) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={s.color}
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 4 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
    <LegendDots />
  </section>
);

const TotalRevenueCard: React.FC<{ data: DashboardData }> = ({ data }) => {
  const [range, setRange] = useState<Range>('today');
  const ariaLabel = `Revenue by order type today: ${data.revenueByType
    .map((seg) => `${seg.name} ${formatMoney(seg.value)}`)
    .join(', ')}`;
  /* v5.113.0 — the week view's summary: the seven days' total and the best
   * day, derived in render from the same buckets the chart reads. */
  const weekTotal = data.weeklyRevenue.reduce((s, d) => s + d.total, 0);
  const bestDay = data.weeklyRevenue.reduce(
    (best, d) => (d.total > best.total ? d : best),
    data.weeklyRevenue[0]
  );
  const weekAria = `Bar chart of daily revenue for the past seven days; total ${formatMoney(
    weekTotal
  )}${bestDay && bestDay.total > 0 ? `; best day ${bestDay.full} at ${formatMoney(bestDay.total)}` : ''}`;
  return (
    <section className="sp-card p-5" aria-label="Total Revenue">
      <CardHead title="Total Revenue" selectId="revenue-range" range={range} onRange={setRange} />
      {range === 'week' ? (
        <>
          <div className="mt-2 h-[176px] w-full" role="img" aria-label={weekAria}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.weeklyRevenue} margin={{ top: 8, right: 8, bottom: 0, left: -14 }}>
                <CartesianGrid stroke="#E3E7E0" strokeDasharray="5 6" vertical={false} />
                <XAxis
                  dataKey="label"
                  axisLine={false}
                  tickLine={false}
                  tickMargin={10}
                  tick={{ fill: '#969696', fontSize: 12 }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  width={44}
                  tick={{ fill: '#969696', fontSize: 12 }}
                  tickFormatter={compactTick}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(15, 61, 62, 0.06)' }}
                  contentStyle={TOOLTIP_STYLE}
                  labelStyle={{ color: '#6B6B6B', marginBottom: 4 }}
                  labelFormatter={(_, payload) =>
                    (payload?.[0]?.payload as { full?: string } | undefined)?.full ?? 'This week'
                  }
                  formatter={(value) => formatMoney(Number(value))}
                />
                <Bar dataKey="total" name="Revenue" radius={[4, 4, 0, 0]} maxBarSize={34}>
                  {data.weeklyRevenue.map((d, i) => (
                    <Cell
                      key={d.label}
                      fill={i === data.weeklyRevenue.length - 1 ? '#B88E2F' : '#0F3D3E'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          {/* The week reads like the pie does: total up front, the legend
              row answering what the eyes just saw — gold today, teal before. */}
          <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <p className="text-[13px] text-[#6B6B6B]">
              7 days · <span className="font-bold tabular-nums text-[#1A1A1A]">{formatMoney(weekTotal)}</span>
            </p>
            {bestDay && bestDay.total > 0 && (
              <p className="text-[12px] text-[#969696]">
                Best day · <span className="font-semibold text-[#1A1A1A]">{bestDay.full}</span> ·{' '}
                {formatMoney(bestDay.total)}
              </p>
            )}
          </div>
          <LegendDots
            items={[
              { color: '#B88E2F', label: 'Today' },
              { color: '#0F3D3E', label: 'Earlier days' },
            ]}
          />
        </>
      ) : (
        <>
          <div className="relative mt-2 h-[176px] w-full" role="img" aria-label={ariaLabel}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.revenueByType}
                  dataKey="value"
                  nameKey="name"
                  innerRadius="64%"
                  outerRadius="88%"
                  paddingAngle={3}
                  cornerRadius={4}
                  stroke="none"
                >
                  {data.revenueByType.map((seg) => (
                    <Cell key={seg.name} fill={TYPE_COLORS[seg.name] ?? '#D9E2DD'} />
                  ))}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value) => formatMoney(Number(value))} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <span className="whitespace-nowrap text-[19px] font-bold text-[#1A1A1A]">
                {formatMoney(data.totalRevenue)}
              </span>
            </div>
          </div>
          <LegendDots />
        </>
      )}
    </section>
  );
};

const StatCard: React.FC<{
  title: string;
  icon: React.ReactNode;
  accent: string;
  value: number;
  pct: number;
  barColor: string;
}> = ({ title, icon, accent, value, pct, barColor }) => (
  <section className="sp-card flex-1 p-5" aria-label={title}>
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-center gap-3">
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white ${accent}`}
          aria-hidden
        >
          {icon}
        </span>
        <div>
          <p className="text-[13px] font-medium text-[#6B6B6B]">{title}</p>
          <TrendChip pct={pct} />
        </div>
      </div>
      <p className="text-[26px] font-bold leading-none text-[#1A1A1A]">{value.toLocaleString('en-IN')}</p>
    </div>
    <div
      className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-[#E3E7E0]"
      role="img"
      aria-label={`${title}: ${value} — ${pct >= 0 ? '+' : '-'}${Math.abs(pct).toFixed(2)}% versus yesterday`}
      title="Momentum versus yesterday"
    >
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${momentumFill(pct)}%`, backgroundColor: barColor }}
      />
    </div>
  </section>
);

/**
 * Today's margin (5.10.0) — the "right now" screen learns what the day COSTS.
 * Same money basis as Reports/Close-out (v_order_cogs, PAID tickets only):
 * split bar = ingredients (gold) vs what the cafe keeps (teal) out of the
 * paid net. Fails soft — a failed load just hides the card.
 */
const TodayMarginCard: React.FC<{ m: TodayCostMargin }> = ({ m }) => {
  const pct = m.paidNet > 0 ? (m.paidCogs / m.paidNet) * 100 : 0;
  const marginPct = m.paidNet > 0 ? (m.margin / m.paidNet) * 100 : 0;
  return (
    <section className="sp-card p-5" aria-label="Today's margin">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[15px] font-semibold text-[#1A1A1A]">Today&apos;s margin</h2>
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#6B6B6B]">
          <Coins size={11} aria-hidden /> paid tickets
        </span>
      </div>
      <div className="mt-3 flex items-end justify-between gap-3">
        <div>
          <p
            className="text-[26px] font-bold leading-none text-[#1A1A1A]"
            style={{ color: m.paidNet > 0 && marginPct < 40 ? '#B3261E' : undefined }}
          >
            {formatMoney(m.margin)}
          </p>
          <p className="mt-1.5 text-[11.5px] font-semibold text-[#6B6B6B]">
            of {formatMoney(m.paidNet)} paid net · {m.paidTickets}{' '}
            {m.paidTickets === 1 ? 'ticket' : 'tickets'}
          </p>
        </div>
        <span
          className="rounded-full px-2.5 py-1 text-[12px] font-extrabold tabular-nums"
          style={{
            color: marginPct >= 65 ? '#2E7D32' : marginPct >= 40 ? '#8A5A00' : '#B3261E',
            backgroundColor:
              (marginPct >= 65 ? '#2E7D32' : marginPct >= 40 ? '#8A5A00' : '#B3261E') + '14',
          }}
        >
          {marginPct.toFixed(0)}% margin
        </span>
      </div>
      <div
        className="mt-4 flex h-2 w-full overflow-hidden rounded-full bg-[#EAF0EC]"
        role="img"
        aria-label={`Paid net ${formatMoney(m.paidNet)}: ingredients ${formatMoney(m.paidCogs)}, margin ${formatMoney(m.margin)}`}
      >
        <div
          className="h-full bg-[#B88E2F] transition-all duration-700"
          style={{ width: `${Math.max(pct, m.paidCogs > 0 ? 1.5 : 0)}%` }}
        />
        <div
          className="h-full bg-[#0F3D3E] transition-all duration-700"
          style={{ width: `${Math.max(m.paidNet > 0 ? (m.margin / m.paidNet) * 100 : 0, 0)}%` }}
        />
      </div>
      <p className="mt-2 text-[11px] font-semibold text-[#969696]">
        ingredients {formatMoney(m.paidCogs)}
        {m.dayCogs > m.paidCogs ? ` · +${formatMoney(m.dayCogs - m.paidCogs)} burned on unpaid tickets` : ''}
      </p>
    </section>
  );
};

/**
 * Guest love (5.12.0) — the "right now" screen hears the guest's voice.
 * Reads the order_feedback ledger (019) — ratings guests left from their own
 * phone through the QR link. Health tones: ≥4.5 loved (green), ≥3.5 good
 * (gold), <3.5 listen up (red). Fails soft — a failed load just hides the card.
 */
const GuestLoveCard: React.FC<{ s: FeedbackStats }> = ({ s }) => {
  const avg = s.avgOverall;
  const tone =
    avg == null ? { color: '#6B6B6B', bg: '#EFEFEF', word: 'no ratings yet' }
    : avg >= 4.5 ? { color: '#2E7D32', bg: '#2E7D3214', word: 'guests love it' }
    : avg >= 3.5 ? { color: '#8A5A00', bg: '#8A5A0014', word: 'good — keep going' }
    : { color: '#B3261E', bg: '#B3261E14', word: 'listen up — guests are not happy' };
  const maxStar = Math.max(1, s.stars.five, s.stars.four, s.stars.three, s.stars.two, s.stars.one);
  const hist = [s.stars.one, s.stars.two, s.stars.three, s.stars.four, s.stars.five];
  return (
    <section className="sp-card p-5" aria-label="Guest love">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[15px] font-semibold text-[#1A1A1A]">Guest love</h2>
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#6B6B6B]">
          <Heart size={11} aria-hidden /> QR ratings
        </span>
      </div>
      <div className="mt-3 flex items-end justify-between gap-3">
        <div>
          <p className="text-[26px] font-bold leading-none text-[#1A1A1A]">
            {avg == null ? '—' : avg.toFixed(1)}
            {avg != null && <span className="text-[14px] font-semibold text-[#969696]"> / 5</span>}
          </p>
          <p className="mt-1.5 text-[11.5px] font-semibold text-[#6B6B6B]">
            {s.countOverall} {s.countOverall === 1 ? 'rating' : 'ratings'}
            {s.countToday > 0 ? ` · ${s.countToday} today` : ''}
          </p>
        </div>
        <span
          className="rounded-full px-2.5 py-1 text-[11.5px] font-extrabold"
          style={{ color: tone.color, backgroundColor: tone.bg }}
        >
          {tone.word}
        </span>
      </div>
      {avg != null && (
        <div className="mt-3 flex items-center gap-1" aria-hidden>
          {[1, 2, 3, 4, 5].map((n) => (
            <Star
              key={n}
              size={15}
              fill={n <= Math.round(avg) ? '#B88E2F' : 'transparent'}
              stroke={n <= Math.round(avg) ? '#B88E2F' : '#C9CFC9'}
              strokeWidth={1.6}
            />
          ))}
        </div>
      )}
      {s.countOverall > 0 && (
        <div className="mt-3 flex items-end gap-1.5" role="img" aria-label={`Ratings histogram: 1 star ${hist[0]}, 2 stars ${hist[1]}, 3 stars ${hist[2]}, 4 stars ${hist[3]}, 5 stars ${hist[4]}`}>
          {hist.map((n, i) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-1">
              <div
                className="w-full rounded-t-md transition-all duration-700"
                style={{ height: `${n === 0 ? 3 : Math.max((n / maxStar) * 34, 6)}px`, background: i + 1 >= 4 ? '#2E7D32' : i + 1 === 3 ? '#B88E2F' : '#B4483C', opacity: n === 0 ? 0.25 : 1 }}
              />
              <span className="text-[9.5px] font-semibold tabular-nums text-[#969696]">{i + 1}★</span>
            </div>
          ))}
        </div>
      )}
      {s.latest && (
        <blockquote
          className="mt-3 border-l-2 border-[#B88E2F]/50 pl-3"
          style={{ animation: 'spFadeIn 400ms ease-out both' }}
        >
          <p className="line-clamp-2 text-[12px] italic text-[#1A1A1A]">
            “{s.latest.comment || `rated ${s.latest.rating}/5`}”
          </p>
          <footer className="mt-0.5 text-[10.5px] font-semibold text-[#969696]">
            #{s.latest.orderNumber} · {s.latest.rating}★
          </footer>
        </blockquote>
      )}
    </section>
  );
};

/* 5.99.0 — the team card tells the truth. It used to be "Best Employees"
 * with a Sales column whose numbers were revenue × hardcoded percentages
 * (fabricated — orders record no staff attribution). It now shows what the
 * workspace actually knows: real members, real roles, real tenure — and the
 * caption says out loud why there is no sales column. The old Today/Week
 * selector is gone with it: a roster has no time axis, and the Week view was
 * the WeekNote stub anyway. */
const TeamCard: React.FC<{ data: DashboardData }> = ({ data }) => (
  <section className="sp-card p-5" aria-label="Team">
    <h2 className="text-[15px] font-semibold text-[#1A1A1A]">Team</h2>
    <ul className="mt-3 divide-y divide-[#EDEFEA]">
      {data.team.length === 0 ? (
        <ListEmptyRow message="No team members yet. Add staff from the platform console." />
      ) : (
        data.team.map((m) => {
          const isOwner = m.role === 'Owner';
          return (
            <li key={`${m.name}-${m.role}`} className="flex items-center gap-3 py-2.5">
              <span
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold ${
                  isOwner
                    ? 'border border-[#B88E2F]/60 bg-[#F7F1E1] text-[#7A5B18]'
                    : 'bg-[#D9E2DD] text-[#0F3D3E]'
                }`}
                aria-hidden
              >
                {initialsOf(m.name)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] font-semibold text-[#1A1A1A]">{m.name}</p>
                {isOwner ? (
                  <span className="mt-0.5 inline-flex items-center rounded-full bg-[#F7F1E1] px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-[#7A5B18]">
                    Owner
                  </span>
                ) : (
                  <p className="truncate text-[12px] text-[#969696]">{m.role}</p>
                )}
              </div>
              <span className="shrink-0 text-[12px] font-medium tabular-nums text-[#969696]">
                {m.since ? `Since ${m.since}` : 'Member'}
              </span>
            </li>
          );
        })
      )}
    </ul>
    <p className="mt-3 flex items-start gap-1.5 border-t border-[#E3E7E0] pt-3 text-[11.5px] leading-relaxed text-[#6B6B6B]">
      <Info size={13} className="mt-0.5 shrink-0 text-[#969696]" aria-hidden />
      <span>Per-staff sales isn&apos;t tracked yet — tickets don&apos;t record who took them.</span>
    </p>
  </section>
);

const DishThumb: React.FC<{ name: string; src?: string | null }> = ({ name, src }) => {
  const [broken, setBroken] = useState(false);
  if (!src || broken) {
    return (
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#D9E2DD] text-[13px] font-semibold text-[#0F3D3E]"
        aria-hidden
      >
        {name.charAt(0).toUpperCase()}
      </span>
    );
  }
  return (
    <img
      src={src}
      alt=""
      aria-hidden
      loading="lazy"
      onError={() => setBroken(true)}
      className="h-10 w-10 shrink-0 rounded-xl border border-[#E3E7E0] object-cover"
    />
  );
};

const TrendingDishesCard: React.FC<{ data: DashboardData }> = ({ data }) => {
  const [range, setRange] = useState<Range>('today');
  /* v5.113.0 — one list, two windows: the week slice has the same row
   * shape, so the card renders either with one grammar; the footer counts
   * the week's plates out loud so the header's claim checks out. */
  const items = range === 'week' ? data.weeklyTrending : data.trendingDishes;
  const emptyMessage =
    range === 'week'
      ? 'No dish sales recorded in the past 7 days.'
      : 'No dish sales recorded yet today.';
  const weekPlates = data.weeklyTrending.reduce((s, d) => s + d.orders, 0);
  return (
    <section className="sp-card p-5" aria-label="Trending Dishes">
      <CardHead title="Trending Dishes" selectId="dishes-range" range={range} onRange={setRange} />
      <>
        {/* 5.94.0 — the column says Plates, because the number is plates:
            a ticket with "Flat White ×2" is one order and two plates. The
            old header counted the museum anyway; now both the window and
            the unit speak true. */}
        <div className="mt-4 flex items-center justify-between border-b border-[#E3E7E0] pb-2 text-[12px] font-medium text-[#969696]">
          <span>Dishes</span>
          <span>Plates</span>
        </div>
        <ul className="divide-y divide-[#EDEFEA]">
          {items.length === 0 ? (
            <ListEmptyRow message={emptyMessage} />
          ) : (
            items.map((dish) => (
              <li key={dish.name} className="flex items-center gap-3 py-2.5">
                <DishThumb name={dish.name} src={dish.image_url} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-semibold text-[#1A1A1A]">{dish.name}</p>
                  <span className="mt-1 inline-block rounded-full bg-[#B88E2F] px-2 py-[2px] text-[10px] font-semibold leading-none text-white">
                    {dish.tag}
                  </span>
                </div>
                <span className="text-[14px] font-bold text-[#1A1A1A]">
                  {dish.orders.toLocaleString('en-IN')}
                </span>
              </li>
            ))
          )}
        </ul>
        {range === 'week' && items.length > 0 && (
          <p className="mt-3 border-t border-[#E3E7E0] pt-2.5 text-[11.5px] text-[#969696]">
            Past 7 days ·{' '}
            <span className="font-semibold tabular-nums text-[#1A1A1A]">
              {weekPlates.toLocaleString('en-IN')}
            </span>{' '}
            plates across {data.weeklyTrending.length}{' '}
            {data.weeklyTrending.length === 1 ? 'dish' : 'dishes'} · top four shown
          </p>
        )}
      </>
    </section>
  );
};

/* ───────────────────────────── State screens ───────────────────────────── */

const DashboardSkeleton: React.FC = () => (
  <div className="mt-5" role="status" aria-busy="true" aria-label="Loading dashboard">
    <span className="sr-only">Loading dashboard…</span>
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
      <div className="sp-skeleton h-[300px] md:col-span-2" />
      <div className="sp-skeleton h-[300px]" />
      <div className="flex flex-col gap-5">
        <div className="sp-skeleton min-h-[140px] flex-1" />
        <div className="sp-skeleton min-h-[140px] flex-1" />
      </div>
    </div>
    <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2">
      <div className="sp-skeleton h-[280px]" />
      <div className="sp-skeleton h-[280px]" />
    </div>
  </div>
);

const ErrorCard: React.FC<{ title: string; message: string; onRetry: () => void }> = ({
  title,
  message,
  onRetry,
}) => (
  <div className="flex min-h-[58vh] items-center justify-center px-2 py-6">
    <section className="sp-card w-full max-w-md p-8 text-center" aria-label={title}>
      <span
        className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#FBEAE9] text-[#B42318]"
        aria-hidden
      >
        <AlertTriangle size={24} />
      </span>
      <h2 className="mt-4 text-[17px] font-semibold text-[#1A1A1A]">{title}</h2>
      <p className="mt-2 break-words text-[13px] leading-relaxed text-[#6B6B6B]">{message}</p>
      <button type="button" onClick={onRetry} className="sp-cta mt-6 px-7 py-2.5 text-[13.5px]">
        Retry
      </button>
    </section>
  </div>
);

/** Empty_State_219-29868 language, adapted to sales: sage circle + honest copy. */
const EmptySales: React.FC = () => (
  <div className="flex min-h-[62vh] flex-col items-center justify-center px-4 py-10 text-center">
    <span
      className="flex h-[120px] w-[120px] items-center justify-center rounded-full bg-[#EAF0EC] text-[#0F3D3E]"
      aria-hidden
    >
      <ShoppingBag size={40} strokeWidth={1.6} />
    </span>
    <h2 className="mt-6 text-[18px] font-semibold text-[#1A1A1A]">No sales yet today</h2>
    <p className="mt-2 max-w-[360px] text-[13px] leading-relaxed text-[#6B6B6B]">
      Once the first order of the day goes through, sales, revenue and customer stats will appear
      here automatically.
    </p>
  </div>
);

/* ───────────────────────────── Data plumbing ───────────────────────────── */

const DashboardContent: React.FC<{ data: DashboardData; margin: TodayCostMargin | null; love: FeedbackStats | null }> = ({
  data,
  margin,
  love,
}) => (
  <>
    <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
      <DailySalesCard data={data} />
      <TotalRevenueCard data={data} />
      <div className="flex flex-col gap-5">
        <StatCard
          title="Total Order"
          icon={<ReceiptText size={18} />}
          accent="bg-[#B42318]"
          value={data.totalOrders}
          pct={data.ordersTrendPct}
          barColor="#B42318"
        />
        <StatCard
          title="New Customers"
          icon={<UserPlus size={18} />}
          accent="bg-[#B88E2F]"
          value={data.newCustomers}
          pct={data.customersTrendPct}
          barColor="#B88E2F"
        />
      </div>
    </div>
    <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
      <TeamCard data={data} />
      <TrendingDishesCard data={data} />
      {margin && <TodayMarginCard m={margin} />}
      {love && <GuestLoveCard s={love} />}
    </div>
  </>
);

interface DashState {
  loading: boolean;
  error: string | null;
  data: DashboardData | null;
  margin: TodayCostMargin | null;
  love: FeedbackStats | null;
}

const DashboardInner: React.FC<{ onRetry: () => void }> = ({ onRetry }) => {
  const { loading: tenantLoading, error: tenantError, tenantId } = useTenant();
  const [dash, setDash] = useState<DashState>({ loading: true, error: null, data: null, margin: null, love: null });

  useEffect(() => {
    if (!tenantId) return;
    let alive = true;
    setDash({ loading: true, error: null, data: null, margin: null, love: null });
    fetchDashboard(tenantId)
      .then((data) => {
        if (alive) setDash({ loading: false, error: null, data, margin: null, love: null });
        // margin rides AFTER the main load — a failure here only hides the card
        fetchTodayCostMargin(tenantId)
          .then((margin) => {
            if (alive) setDash((s) => ({ ...s, margin }));
          })
          .catch(() => {});
        // guest love rides too — a fresh table (no ratings) just leaves it out
        fetchFeedbackStats(tenantId)
          .then((love) => {
            if (alive) setDash((s) => ({ ...s, love }));
          })
          .catch(() => {});
      })
      .catch((err: Error) => {
        if (alive)
          setDash({
            loading: false,
            error: err.message || 'Failed to load dashboard data.',
            data: null,
            margin: null,
            love: null,
          });
      });
    return () => {
      alive = false;
    };
  }, [tenantId]);

  if (tenantError) {
    return <ErrorCard title="Workspace unavailable" message={tenantError} onRetry={onRetry} />;
  }
  if (!tenantLoading && !tenantId) {
    return (
      <ErrorCard
        title="Workspace unavailable"
        message="No workspace is linked to this account. Ask the platform operator to attach your login to a business."
        onRetry={onRetry}
      />
    );
  }
  if (dash.error) {
    return <ErrorCard title="Couldn't load dashboard" message={dash.error} onRetry={onRetry} />;
  }
  if (tenantLoading || dash.loading || !dash.data) {
    return <DashboardSkeleton />;
  }

  const d = dash.data;
  const empty = d.totalRevenue === 0 && d.totalOrders === 0 && d.newCustomers === 0;
  if (empty) return <EmptySales />;
  return <DashboardContent data={d} margin={dash.margin} love={dash.love} />;
};

/* ───────────────────────────── Screen export ───────────────────────────── */

/**
 * NeedsNow (v5.47.0 — "the morning mirror").
 *
 * The landing screen's honest answer to "what needs me before the first
 * pour?" — the union of every surface's WAITING number, each earning its
 * door exactly the way the counter taught it (5.44.0):
 *   • New tickets — the CounterInbox queue (`new`): money waiting to cook.
 *   • In the kitchen — `pending`/`preparing` on the board right now.
 *   • Late prep — `preparing` past the 10-minute SLA (the KDS's own clock).
 *
 *   v5.89.0 — "the strip keeps the day": every WAITING count above now
 *   speaks the SAME local-day grammar the KDS board ("board data — today
 *   only") and the counter inbox already speak. Before this, the mirror
 *   counted all-time `new`/`pending`/`preparing` tickets and the strip said
 *   "4 waiting / 3 in the kitchen" while the rooms themselves showed zero —
 *   yesterday's ghosts inflating tonight's alarm. Stuck older tickets are
 *   still named — as an amber whisper under the card they haunt ("N older
 *   tickets off today's inbox — see Bills"), never silently hidden (a
 *   whisper, not an invented all-clear), and never counted as work the
 *   kitchen can still cook. The late-prep card also joins the KDS's own
 *   escalation clock: amber at the 10-minute SLA, red at the board's
 *   20-minute red line (waitTone's thresholds, verbatim), with the oldest
 *   wait spelled out in the hint.
 *   • Unpaid — money still out (opens Bills pre-filtered via sectionHint,
 *     the same context-carrying door Close-out and Reports use).
 *     v5.65.0 — the band reads the LEDGER: a ticket mid-split (5.63.0) shows
 *     only its open BALANCE (total − recorded parts), not its whole total —
 *     the same per-part truth Reports' unpaid bucket learned in 5.64.0, so
 *     all three surfaces agree mid-split. A gold whisper says when a ticket
 *     is settled in parts.
 *   • Stock low & out — items at/below the reorder point or at zero
 *     (Inventory's own levelTone math, verbatim).
 *   • Sold out — menu items 86'd (`is_available = false`).
 *
 * Truth rules: counts are computed client-side from the same ledgers the
 * rooms read (orders + inventory + menu), refreshed on mount and every 30s.
 * A slot renders ONLY when its count is real (>0 — zero means zero, honest
 * hiding); when NOTHING waits, the strip says so calmly instead of
 * pretending. Fail-soft: a failed read keeps the last honest strip; a first
 * failed read hides the strip entirely — the analytics below still load.
 */
const LATE_PREP_MIN = 10;
/** The KDS board's red line (KitchenScreen waitTone): past 20 minutes the
 *  ticket is not just late, it is an apology. The strip escalates with it. */
const LATE_ESCALATE_MIN = 20;
const NOW_REFRESH_MS = 30_000;


interface NeedsState {
  ready: boolean;
  orders: Order[];
  inventory: InventoryItem[];
  menu: MenuItem[];
  reservations: Reservation[];
  tables: DiningTable[];
  /** v5.65.0 — per-ticket sums of recorded payment parts (the 007 ledger),
   *  bounded to the unpaid ids; an unpaid ticket's true outstanding is
   *  total − this. Empty map = nothing mid-split. */
  paidSums: Map<string, number>;
}

const NeedsNow: React.FC = () => {
  const { tenantId } = useTenant();
  const [now, setNow] = useState<NeedsState>({ ready: false, orders: [], inventory: [], menu: [], reservations: [], tables: [], paidSums: new Map() });

  useEffect(() => {
    if (!tenantId) return;
    let alive = true;
    const load = async () => {
      try {
        const [orders, inventory, menu, reservations, tables] = await Promise.all([
          fetchOrders(tenantId, 200),
          fetchInventory(tenantId),
          fetchMenuItems(tenantId),
          fetchReservations(tenantId, 100),
          fetchTables(tenantId),
        ]);
        /* v5.65.0 — the ledger read, bounded to exactly the open ids (the
           5.63.0 helper; no ids → no call). A cancelled or settled ticket
           never enters this list, so old ledger rows can't leak in. */
        const unpaidIds = orders
          .filter((o) => o.status !== 'cancelled' && o.payment_status !== 'completed')
          .map((o) => o.id);
        const paidSums = await fetchOpenPaymentSums(tenantId, unpaidIds);
        if (alive) setNow({ ready: true, orders, inventory, menu, reservations, tables, paidSums });
      } catch {
        /* the mirror is a courtesy — a first failed read simply stays quiet */
      }
    };
    void load();
    const t = window.setInterval(() => void load(), NOW_REFRESH_MS);
    return () => {
      alive = false;
      window.clearInterval(t);
    };
  }, [tenantId]);

  if (!now.ready) return null;

  const nowMs = Date.now();
  const live = now.orders.filter((o) => o.status !== 'cancelled');
  /* 5.89.0 — the strip keeps the day: waiting counts read TODAY's tickets
     only, the same grammar as the board and inbox the cards open into. The
     older stuck tickets are counted separately — they speak as whispers,
     never as tonight's work. */
  const liveToday = live.filter((o) => isSameLocalDay(o.created_at));
  const staleOlder = live.filter((o) => !isSameLocalDay(o.created_at));
  const newTickets = liveToday.filter((o) => o.status === 'new');
  const staleNew = staleOlder.filter((o) => o.status === 'new');
  const inKitchen = liveToday.filter((o) => ['pending', 'preparing'].includes(o.status));
  const staleKitchen = staleOlder.filter((o) => ['pending', 'preparing'].includes(o.status));
  const latePrep = liveToday.filter(
    (o) => o.status === 'preparing' && nowMs - new Date(o.created_at).getTime() >= LATE_PREP_MIN * 60000
  );
  /* the KDS's own clock — the oldest ACTIVE ticket on today's board
     (queued/preparing/ready, the rail's activeWait grammar): the late card
     escalates amber at the 10-minute SLA and red at the 20-minute line. */
  const oldestWaitMin = liveToday.reduce((m, o) => {
    if (!['pending', 'preparing', 'ready'].includes(o.status)) return m;
    return Math.max(m, (nowMs - new Date(o.created_at).getTime()) / 60000);
  }, 0);
  const unpaid = live.filter((o) => o.payment_status !== 'completed');
  /* v5.65.0 — the band reads the balance, not the whole ticket: a mid-split
     ticket's open outstanding is total − recorded parts (floored at zero;
     an over-covered row can never inflate the count). Un-split tickets have
     no ledger rows, so the arithmetic is identity for them. */
  const unpaidAmt = unpaid.reduce(
    (s, o) => s + Math.max(0, Number(o.total || 0) - (now.paidSums.get(o.id) || 0)),
    0
  );
  const splitOpen = unpaid.filter((o) => (now.paidSums.get(o.id) || 0) > 0);
  const stockAlerts = now.inventory.filter((i) => i.current_stock <= i.reorder_point);
  const soldOut = now.menu.filter((m) => m.is_available === false);
  /* v5.61.0 — the front door joins the mirror: booked parties whose slot has
     arrived or is imminent (the next 90 minutes; an hour of grace covers a
     party running late without letting week-old ghosts pollute the count),
     and tables parked at 'billing' — the bill is asked for but not settled. */
  const arrivals = now.reservations.filter((r) => {
    if (r.status !== 'booked') return false;
    const slot = new Date(r.slot_at).getTime();
    return slot >= nowMs - 60 * 60000 && slot <= nowMs + 90 * 60000;
  });
  const billingTables = now.tables.filter((t) => t.status === 'billing');

  const slots: {
    key: string;
    label: string;
    value: string;
    valueTone: string;
    icon: React.ReactNode;
    iconTone: string;
    aria: string;
    hint?: string;
    /** 5.89.0 — each whisper carries its own glyph (History for the older
     *  stuck, Clock for the board's oldest wait); Split stays the default. */
    hintIcon?: React.ReactNode;
    door: { label: string; aria: string; onOpen: () => void } | null;
  }[] = [];

  const go = useUi.getState().goSection;
  /* 5.89.0 — the card speaks today's inbox count; when older `new` tickets
     are stuck off it (yesterday's ghosts the counter can no longer Ok), the
     amber whisper names them and points to Bills, the room that can still
     act. The door follows the truth: the counter when it holds work, Bills
     when only the ghosts remain. */
  if (newTickets.length > 0 || staleNew.length > 0)
    slots.push({
      key: 'new',
      label: 'New tickets',
      value:
        newTickets.length > 0
          ? `${newTickets.length} ${newTickets.length === 1 ? 'ticket' : 'tickets'} waiting`
          : '0 waiting',
      valueTone: newTickets.length > 0 ? 'text-[#0F3D3E]' : 'text-[#5F6B63]',
      icon: <Inbox size={18} aria-hidden />,
      iconTone: newTickets.length > 0 ? 'bg-[#EAF2F7] text-[#1D5D7E]' : 'bg-[#F6F5F2] text-[#5F6B63]',
      aria: `${newTickets.length} new ${newTickets.length === 1 ? 'ticket' : 'tickets'} in the counter inbox, waiting for an Ok${
        staleNew.length > 0
          ? `; ${staleNew.length} older ${staleNew.length === 1 ? 'ticket is' : 'tickets are'} stuck off today's inbox — see Bills`
          : ''
      }`,
      hint:
        staleNew.length > 0
          ? `${staleNew.length} older ${staleNew.length === 1 ? 'ticket' : 'tickets'} off today's inbox — see Bills`
          : undefined,
      hintIcon: staleNew.length > 0 ? <History size={11} aria-hidden className="shrink-0" /> : undefined,
      door:
        newTickets.length > 0
          ? {
              label: 'Counter',
              aria: `Open the counter — ${newTickets.length} new ${newTickets.length === 1 ? 'ticket waits' : 'tickets wait'} for an Ok`,
              onOpen: () => go('food', ['Dashboard', 'Food & Drinks']),
            }
          : {
              label: 'Bills',
              aria: `Open Bills — ${staleNew.length} older ${staleNew.length === 1 ? 'ticket waits' : 'tickets wait'} off today's inbox`,
              onOpen: () => go('bills', ['Dashboard', 'Bills'], 'unpaid'),
            },
    });
  if (arrivals.length > 0)
    slots.push({
      key: 'arrivals',
      label: 'Arriving now',
      value: `${arrivals.length} ${arrivals.length === 1 ? 'party' : 'parties'} due`,
      valueTone: 'text-[#0F3D3E]',
      icon: <CalendarClock size={18} aria-hidden />,
      iconTone: 'bg-[#EAF2F7] text-[#1D5D7E]',
      aria: `${arrivals.length} booked ${arrivals.length === 1 ? 'party is' : 'parties are'} due at the door; Seat & order walks them straight to the counter`,
      door: {
        label: 'Floor',
        aria: `Open Floor — ${arrivals.length} booked ${arrivals.length === 1 ? 'party is' : 'parties are'} due at the door`,
        onOpen: () => go('floor', ['Dashboard', 'Floor']),
      },
    });
  /* 5.89.0 — the kitchen card mirrors the board's day: today's count, and
     when older tickets are stuck off the board (paid but never bumped, or
     parked mid-flight), the whisper names them — the board itself stays
     clean, the strip stays honest about the residue it hides. */
  if (inKitchen.length > 0 || staleKitchen.length > 0)
    slots.push({
      key: 'kitchen',
      label: 'In the kitchen',
      value: inKitchen.length > 0 ? `${inKitchen.length} ${inKitchen.length === 1 ? 'ticket' : 'tickets'}` : '0 on the board',
      valueTone: inKitchen.length > 0 ? 'text-[#0F3D3E]' : 'text-[#5F6B63]',
      icon: <Flame size={18} aria-hidden />,
      iconTone: inKitchen.length > 0 ? 'bg-[#EAF2F7] text-[#1D5D7E]' : 'bg-[#F6F5F2] text-[#5F6B63]',
      aria: `${inKitchen.length} ${inKitchen.length === 1 ? 'ticket is' : 'tickets are'} on the board right now${
        staleKitchen.length > 0
          ? `; ${staleKitchen.length} older ${staleKitchen.length === 1 ? 'ticket is' : 'tickets are'} stuck off today's board — see Bills`
          : ''
      }`,
      hint:
        staleKitchen.length > 0
          ? `${staleKitchen.length} older stuck ${staleKitchen.length === 1 ? 'ticket' : 'tickets'} off today's board — see Bills`
          : undefined,
      hintIcon: staleKitchen.length > 0 ? <History size={11} aria-hidden className="shrink-0" /> : undefined,
      door: {
        label: 'Kitchen',
        aria: `Open Kitchen — ${inKitchen.length} ${inKitchen.length === 1 ? 'ticket is' : 'tickets are'} on the board right now`,
        onOpen: () => go('kitchen', ['Dashboard', 'Kitchen']),
      },
    });
  /* 5.89.0 — the late card carries the KDS's own escalation clock: amber at
     the 10-minute SLA, red at the board's 20-minute red line (waitTone's
     thresholds), and the oldest wait spelled out — one instrument, one
     clock, strip and board agreeing to the minute. */
  if (latePrep.length > 0) {
    const escalated = oldestWaitMin >= LATE_ESCALATE_MIN;
    slots.push({
      key: 'late',
      label: 'Late prep',
      value: `${latePrep.length}`,
      valueTone: escalated ? 'text-[#B3261E]' : 'text-[#8A5A00]',
      icon: <Clock size={18} aria-hidden />,
      iconTone: escalated ? 'bg-[#FCEBEA] text-[#B3261E]' : 'bg-[#FFF4DB] text-[#8A5A00]',
      aria: `${latePrep.length} ${latePrep.length === 1 ? 'ticket is' : 'tickets are'} past the ${LATE_PREP_MIN}-minute SLA; oldest on the board waits ${Math.round(oldestWaitMin)} minutes${
        escalated ? " — past the board's 20-minute red line" : ''
      }`,
      hint: `oldest waits ${Math.round(oldestWaitMin)} min — the board's own clock`,
      hintIcon: <Clock size={11} aria-hidden className="shrink-0" />,
      door: {
        label: 'Kitchen',
        aria: `Open Kitchen — ${latePrep.length} ${latePrep.length === 1 ? 'ticket is' : 'tickets are'} past the ${LATE_PREP_MIN}-minute SLA; oldest waits first`,
        onOpen: () => go('kitchen', ['Dashboard', 'Kitchen']),
      },
    });
  }
  if (unpaid.length > 0)
    slots.push({
      key: 'unpaid',
      label: 'Unpaid',
      value: `${unpaid.length} · ${formatMoney(unpaidAmt)}`,
      valueTone: 'text-[#8A5A00]',
      icon: <Wallet size={18} aria-hidden />,
      iconTone: 'bg-[#FFF4DB] text-[#8A5A00]',
      aria: `${unpaid.length} unpaid ${unpaid.length === 1 ? 'ticket' : 'tickets'}, ${formatMoney(unpaidAmt)} still out${
        splitOpen.length > 0 ? ` — ${splitOpen.length} ${splitOpen.length === 1 ? 'ticket is' : 'tickets are'} settled in parts` : ''
      }`,
      hint:
        splitOpen.length > 0
          ? `${splitOpen.length} ${splitOpen.length === 1 ? 'ticket' : 'tickets'} settled in parts — the band reads balances`
          : undefined,
      door: {
        label: 'Bills',
        aria: `Open Bills — ${unpaid.length} unpaid ${unpaid.length === 1 ? 'ticket' : 'tickets'}, ${formatMoney(unpaidAmt)} still out`,
        onOpen: () => go('bills', ['Dashboard', 'Bills'], 'unpaid'),
      },
    });
  if (billingTables.length > 0)
    slots.push({
      key: 'billing',
      label: 'Billing',
      value: `${billingTables.length} ${billingTables.length === 1 ? 'table' : 'tables'} settling`,
      valueTone: 'text-[#8A5A16]',
      icon: <ReceiptText size={18} aria-hidden />,
      iconTone: 'bg-[#FFF4DB] text-[#8A5A00]',
      aria: `${billingTables.length} ${billingTables.length === 1 ? 'table has' : 'tables have'} asked for the bill and waits to settle`,
      door: {
        label: 'Floor',
        aria: `Open Floor — ${billingTables.length} ${billingTables.length === 1 ? 'table waits' : 'tables wait'} to settle`,
        onOpen: () => go('floor', ['Dashboard', 'Floor']),
      },
    });
  if (stockAlerts.length > 0)
    slots.push({
      key: 'stock',
      label: 'Stock low & out',
      value: `${stockAlerts.length} ${stockAlerts.length === 1 ? 'item' : 'items'}`,
      valueTone: 'text-[#8A5A00]',
      icon: <PackageMinus size={18} aria-hidden />,
      iconTone: 'bg-[#FFF4DB] text-[#8A5A00]',
      aria: `${stockAlerts.length} inventory ${stockAlerts.length === 1 ? 'item is' : 'items are'} at or below the reorder point`,
      door: {
        label: 'Inventory',
        aria: `Open Inventory — ${stockAlerts.length} ${stockAlerts.length === 1 ? 'item needs' : 'items need'} restocking`,
        onOpen: () => go('inventory', ['Dashboard', 'Inventory']),
      },
    });
  if (soldOut.length > 0)
    slots.push({
      key: 'soldout',
      label: 'Sold out',
      value: `${soldOut.length} on the menu`,
      valueTone: 'text-[#0F3D3E]',
      icon: <CircleSlash size={18} aria-hidden />,
      iconTone: 'bg-[#F6F5F2] text-[#5F6B63]',
      aria: `${soldOut.length} menu ${soldOut.length === 1 ? 'item is' : 'items are'} marked sold out`,
      door: {
        label: 'Menu',
        aria: `Open Menu — ${soldOut.length} ${soldOut.length === 1 ? 'item is' : 'items are'} 86'd`,
        onOpen: () => go('menu', ['Dashboard', 'Menu']),
      },
    });

  return (
    <section
      aria-label="Needs you now"
      className={`mt-5 rounded-2xl border p-4 ${
        slots.length > 0
          ? 'border-[#F0E4C3] bg-gradient-to-r from-[#FDF6E3] to-white'
          : 'border-[#E3E7E0] bg-white'
      }`}
    >
      {slots.length > 0 ? (
        <>
          <p className="mb-3 text-[10.5px] font-bold uppercase tracking-[0.08em] text-[#8A938C]">
            Needs you now
          </p>
          <div className="grid grid-cols-2 gap-x-6 gap-y-4 lg:grid-cols-3">
            {slots.map((s) => (
              <div key={s.key} className="flex min-w-0 items-center gap-3">
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${s.iconTone}`}>
                  {s.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-[#8A938C]">{s.label}</p>
                  <p className={`text-[16px] font-extrabold leading-tight tabular-nums ${s.valueTone}`}>{s.value}</p>
                  {s.hint && (
                    <p className="mt-0.5 flex items-center gap-1 truncate text-[10.5px] font-semibold leading-tight text-[#8A6D1F]">
                      {s.hintIcon ?? <Split size={11} aria-hidden className="shrink-0" />}
                      <span className="truncate">{s.hint}</span>
                    </p>
                  )}
                </div>
                {s.door && <DoorChip label={s.door.label} aria={s.door.aria} onOpen={s.door.onOpen} />}
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EAF0EC] text-[#2E7D32]">
            <CheckCircle2 size={18} aria-hidden />
          </span>
          <div>
            <p className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-[#8A938C]">Needs you now</p>
            <p className="text-[13.5px] font-semibold text-[#5F6B63]">
              Nothing waits on you — the floor is yours.
            </p>
          </div>
        </div>
      )}
    </section>
  );
};

export const DashboardScreen: React.FC = () => {
  const [reload, setReload] = useState(0);

  useEffect(() => {
    useUi.getState().setBreadcrumb(['Dashboard', 'Sales Statistics']);
  }, []);

  return (
    <section aria-label="Dashboard" className="p-5 md:p-6">
      <h1 className="text-[20px] font-bold text-[#1A1A1A]">Dashboard</h1>
      <NeedsNow />
      <DashboardInner key={reload} onRetry={() => setReload((n) => n + 1)} />
    </section>
  );
};
