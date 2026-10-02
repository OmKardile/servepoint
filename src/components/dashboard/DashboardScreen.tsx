import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CalendarClock,
  ChevronDown,
  Coins,
  ReceiptText,
  ShoppingBag,
  TrendingDown,
  TrendingUp,
  UserPlus,
} from 'lucide-react';
import {
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
import { fetchDashboard, fetchTodayCostMargin, type TodayCostMargin } from '../../lib/api';
import { formatMoney } from '../../lib/prefs';
import { useTenant } from '../../lib/tenant';
import { useUi } from '../../store/session';
import type { DashboardData } from '../../types';

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

const LegendDots: React.FC = () => (
  <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5">
    {SERIES.map((s) => (
      <span key={s.key} className="flex items-center gap-2 text-[12px] text-[#6B6B6B]">
        <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
        {s.label}
      </span>
    ))}
  </div>
);

/** Honest 7-day view: the dashboard contract exposes today-scoped aggregates only. */
const WeekNote: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`flex flex-col items-center justify-center gap-2 text-center ${className}`}>
    <span
      className="flex h-14 w-14 items-center justify-center rounded-full bg-[#D9E2DD] text-[#0F3D3E]"
      aria-hidden
    >
      <CalendarClock size={22} />
    </span>
    <p className="text-[13.5px] font-semibold text-[#1A1A1A]">No 7-day breakdown yet</p>
    <p className="max-w-[260px] text-[12px] leading-relaxed text-[#6B6B6B]">
      This card is recorded for today&apos;s service. Switch back to Today to see current numbers.
    </p>
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
  return (
    <section className="sp-card p-5" aria-label="Total Revenue">
      <CardHead title="Total Revenue" selectId="revenue-range" range={range} onRange={setRange} />
      {range === 'week' ? (
        <WeekNote className="mt-3 h-[200px]" />
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

const BestEmployeesCard: React.FC<{ data: DashboardData }> = ({ data }) => {
  const [range, setRange] = useState<Range>('today');
  return (
    <section className="sp-card p-5" aria-label="Best Employees">
      <CardHead title="Best Employees" selectId="employees-range" range={range} onRange={setRange} />
      {range === 'week' ? (
        <WeekNote className="mt-6 min-h-[240px]" />
      ) : (
        <>
          <div className="mt-4 flex items-center justify-between border-b border-[#E3E7E0] pb-2 text-[12px] font-medium text-[#969696]">
            <span>Employees</span>
            <span>Sales</span>
          </div>
          <ul className="divide-y divide-[#EDEFEA]">
            {data.bestEmployees.length === 0 ? (
              <ListEmptyRow message="No employee sales recorded yet today." />
            ) : (
              data.bestEmployees.map((emp) => (
                <li key={`${emp.name}-${emp.role}`} className="flex items-center gap-3 py-2.5">
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#D9E2DD] text-[13px] font-semibold text-[#0F3D3E]"
                    aria-hidden
                  >
                    {initialsOf(emp.name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-semibold text-[#1A1A1A]">{emp.name}</p>
                    <p className="truncate text-[12px] text-[#969696]">{emp.role}</p>
                  </div>
                  <span className="text-[13.5px] font-semibold text-[#1A1A1A]">
                    {formatMoney(emp.sales)}
                  </span>
                </li>
              ))
            )}
          </ul>
        </>
      )}
    </section>
  );
};

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
  return (
    <section className="sp-card p-5" aria-label="Trending Dishes">
      <CardHead title="Trending Dishes" selectId="dishes-range" range={range} onRange={setRange} />
      {range === 'week' ? (
        <WeekNote className="mt-6 min-h-[240px]" />
      ) : (
        <>
          <div className="mt-4 flex items-center justify-between border-b border-[#E3E7E0] pb-2 text-[12px] font-medium text-[#969696]">
            <span>Dishes</span>
            <span>Orders</span>
          </div>
          <ul className="divide-y divide-[#EDEFEA]">
            {data.trendingDishes.length === 0 ? (
              <ListEmptyRow message="No dish sales recorded yet today." />
            ) : (
              data.trendingDishes.map((dish) => (
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
        </>
      )}
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

const DashboardContent: React.FC<{ data: DashboardData; margin: TodayCostMargin | null }> = ({
  data,
  margin,
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
      <BestEmployeesCard data={data} />
      <TrendingDishesCard data={data} />
      {margin && <TodayMarginCard m={margin} />}
    </div>
  </>
);

interface DashState {
  loading: boolean;
  error: string | null;
  data: DashboardData | null;
  margin: TodayCostMargin | null;
}

const DashboardInner: React.FC<{ onRetry: () => void }> = ({ onRetry }) => {
  const { loading: tenantLoading, error: tenantError, tenantId } = useTenant();
  const [dash, setDash] = useState<DashState>({ loading: true, error: null, data: null, margin: null });

  useEffect(() => {
    if (!tenantId) return;
    let alive = true;
    setDash({ loading: true, error: null, data: null, margin: null });
    fetchDashboard(tenantId)
      .then((data) => {
        if (alive) setDash({ loading: false, error: null, data, margin: null });
        // margin rides AFTER the main load — a failure here only hides the card
        fetchTodayCostMargin(tenantId)
          .then((margin) => {
            if (alive) setDash((s) => ({ ...s, margin }));
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
  return <DashboardContent data={d} margin={dash.margin} />;
};

/* ───────────────────────────── Screen export ───────────────────────────── */

export const DashboardScreen: React.FC = () => {
  const [reload, setReload] = useState(0);

  useEffect(() => {
    useUi.getState().setBreadcrumb(['Dashboard', 'Sales Statistics']);
  }, []);

  return (
    <section aria-label="Dashboard" className="p-5 md:p-6">
      <h1 className="text-[20px] font-bold text-[#1A1A1A]">Dashboard</h1>
      <DashboardInner key={reload} onRetry={() => setReload((n) => n + 1)} />
    </section>
  );
};
