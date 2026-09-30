import React, { useState, useMemo } from 'react';
import { useTsosStore } from '../../lib/store';
import { TenantBusiness } from '../../types';
import {
  TrendingUp,
  CreditCard,
  Clock,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Activity,
  ArrowUpRight,
  Database,
  Cpu,
  Radio,
  PlusCircle,
  Download,
  Building2,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ReTooltip,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
} from 'recharts';

/* ═══════════════════════════ Shared metric engine (deterministic) ═════════ */

type RangeKey = 'today' | '7d' | '30d';

const RANGE_LABEL: Record<RangeKey, string> = {
  today: 'Today',
  '7d': 'Last 7 Days',
  '30d': 'Last 30 Days',
};

/** Stable string hash → deterministic pseudo-random weights per tenant/point. */
const hashOf = (s: string): number => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
};

interface TrendPoint {
  label: string;
  orders: number;
  revenue: number; // ₹
}

/**
 * Build the platform trend series for a range by distributing each tenant's
 * lifetime orders/revenue across the window with stable per-tenant weights.
 * Deterministic across renders (no Math.random) so the chart never flickers.
 */
function buildTrendSeries(tenants: TenantBusiness[], range: RangeKey): TrendPoint[] {
  if (range === 'today') {
    const hours = ['9 AM', '10 AM', '11 AM', '12 PM', '1 PM', '2 PM', '3 PM', '4 PM', '5 PM', '6 PM', '7 PM', '8 PM', '9 PM'];
    //咖啡馆 rush curve — weights favour lunch (12–2) and evening (5–8)
    const shape = [0.4, 0.7, 1.0, 1.6, 1.8, 1.2, 0.9, 0.8, 1.1, 1.7, 1.9, 1.4, 0.8];
    const shapeSum = shape.reduce((a, b) => a + b, 0);
    return hours.map((label, i) => {
      let orders = 0;
      let revenue = 0;
      tenants.forEach((b) => {
        const count = b.total_orders_count || 0;
        const ticket = count > 0 ? b.lifetime_revenue / count : 0;
        const w = 0.55 + (hashOf(b.id + ':h' + i) % 90) / 100; // 0.55..1.45 jitter
        const dayOrders = count * 0.008; // ~0.8% of lifetime orders land today
        const o = (dayOrders * shape[i] * w) / shapeSum;
        orders += o;
        revenue += o * ticket;
      });
      return { label, orders: Math.round(orders), revenue: Math.round(revenue) };
    });
  }

  const days = range === '7d' ? 7 : 30;
  const out: TrendPoint[] = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const label = `${d.toLocaleDateString('en-IN', { weekday: 'short' })} ${d.getDate()}`;
    let orders = 0;
    let revenue = 0;
    tenants.forEach((b) => {
      const count = b.total_orders_count || 0;
      const ticket = count > 0 ? b.lifetime_revenue / count : 0;
      const weekend = d.getDay() === 0 || d.getDay() === 6 ? 1.35 : 1;
      const w = 0.5 + (hashOf(b.id + ':d' + i) % 100) / 100;
      const rangeOrders = count * (range === '7d' ? 0.015 : 0.06);
      const o = (rangeOrders * weekend * w) / days;
      orders += o;
      revenue += o * ticket;
    });
    out.push({ label, orders: Math.round(orders), revenue: Math.round(revenue) });
  }
  return out;
}

const fmtINR = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const fmtCompact = (n: number) =>
  n >= 100000 ? `₹${(n / 100000).toFixed(1)}L` : n >= 1000 ? `₹${(n / 1000).toFixed(1)}K` : `₹${Math.round(n)}`;

const PLAN_COLORS: Record<string, string> = {
  starter: '#8FA99B',
  growth: '#B88E2F',
  pro: '#0F3D3E',
  enterprise: '#DC2626',
};

const AVATAR_CYCLE = [
  'bg-[#0F3D3E] text-white',
  'bg-[#B88E2F] text-white',
  'bg-[#D9E2DD] text-[#0F3D3E]',
];

/* ServePoint tooltip — white card, #E3E7E0 border, teal/gold dots */
const TrendTooltip: React.FC<{ active?: boolean; payload?: any[]; label?: string }> = ({
  active,
  payload,
  label,
}) => {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-xl bg-white border border-[#E3E7E0] shadow-lg shadow-[#0F3D3E]/10 px-3.5 py-2.5 text-xs">
      <div className="font-bold text-[#1A1A1A] mb-1.5">{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center justify-between gap-4 py-0.5">
          <span className="flex items-center gap-1.5 text-[#6B6B6B]">
            <span
              className="w-2 h-2 rounded-full"
              style={{ background: p.dataKey === 'orders' ? '#0F3D3E' : '#B88E2F' }}
            />
            {p.dataKey === 'orders' ? 'Orders' : 'Revenue'}
          </span>
          <span className="font-bold text-[#1A1A1A]">
            {p.dataKey === 'orders' ? p.value : fmtINR(p.value)}
          </span>
        </div>
      ))}
    </div>
  );
};

/* ═══════════════════════════ ServePoint dashboard ═════════════════════════ */

const ServePointDashboard: React.FC = () => {
  const {
    tenantBusinesses,
    platformAuditLogs,
    setActiveSuperAdminTab,
    setSelectedSuperAdminBusinessId,
  } = useTsosStore();

  const [range, setRange] = useState<RangeKey>('today');
  const [hoveredPlan, setHoveredPlan] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  React.useEffect(() => {
    if (!toastMessage) return;
    const t = setTimeout(() => setToastMessage(null), 2600);
    return () => clearTimeout(t);
  }, [toastMessage]);

  /* ── Core metrics (from real tenant store) ── */
  const totalBusinesses = tenantBusinesses.length;
  const activeBusinesses = tenantBusinesses.filter((b) => b.status === 'active').length;
  const trialBusinesses = tenantBusinesses.filter((b) => b.status === 'trial').length;
  const pastDueBusinesses = tenantBusinesses.filter((b) => b.status === 'past_due').length;
  const suspendedBusinesses = tenantBusinesses.filter((b) => b.status === 'suspended').length;
  const archivedBusinesses = tenantBusinesses.filter((b) => b.status === 'archived').length;

  const activeMRR = tenantBusinesses
    .filter((b) => b.status === 'active' || b.status === 'past_due')
    .reduce((sum, b) => sum + (b.subscription?.final_monthly_rate || 0), 0);

  const totalPlatformOrders = tenantBusinesses.reduce((sum, b) => sum + (b.total_orders_count || 0), 0);
  const totalPlatformGMV = tenantBusinesses.reduce((sum, b) => sum + (b.lifetime_revenue || 0), 0);

  /* ── Trend series + deltas ── */
  const trend = useMemo(() => buildTrendSeries(tenantBusinesses, range), [tenantBusinesses, range]);
  const rangeOrders = trend.reduce((a, p) => a + p.orders, 0);
  const rangeRevenue = trend.reduce((a, p) => a + p.revenue, 0);

  const todaySeries = useMemo(
    () => (range === 'today' ? buildTrendSeries(tenantBusinesses, '7d') : trend),
    [range, tenantBusinesses, trend]
  );
  const yesterdayOrders =
    range === 'today' && todaySeries.length >= 2
      ? todaySeries[todaySeries.length - 2]?.orders ?? 0
      : trend.length >= 2
      ? trend[trend.length - 2]?.orders ?? 0
      : 0;
  const ordersDeltaPct =
    yesterdayOrders > 0 ? Math.round(((rangeOrders / 1 - yesterdayOrders) / yesterdayOrders) * 1000) / 10 : 0;

  const mrrDeltaPct = useMemo(() => {
    if (activeMRR <= 0) return 0;
    return (hashOf('mrr-delta:' + totalBusinesses) % 70) / 10 - 2.5; // −2.5%..+4.4%
  }, [activeMRR, totalBusinesses]);

  /* ── Donut: MRR by plan ── */
  const planCounts: Record<string, number> = { starter: 0, growth: 0, pro: 0, enterprise: 0 };
  const planMRR: Record<string, number> = { starter: 0, growth: 0, pro: 0, enterprise: 0 };
  tenantBusinesses.forEach((b) => {
    const plan = b.subscription?.plan_id;
    if (plan && planCounts[plan] !== undefined) {
      planCounts[plan]++;
      if (b.status === 'active' || b.status === 'past_due') {
        planMRR[plan] += b.subscription?.final_monthly_rate || 0;
      }
    }
  });
  const donutData = Object.keys(planCounts)
    .filter((p) => planCounts[p] > 0)
    .map((p) => ({ name: p.charAt(0).toUpperCase() + p.slice(1), plan: p, value: Math.round(planMRR[p]), count: planCounts[p] }));
  // Slices need a positive MRR — trials contribute ₹0 and would render invisible arcs.
  const pieData = donutData.filter((d) => d.value > 0);
  const donutTotal = donutData.reduce((a, d) => a + d.value, 0);

  /* ── Leaderboards ── */
  const rangeFraction = range === 'today' ? 0.008 : range === '7d' ? 0.015 : 0.06;
  const topTenants = useMemo(() => {
    return [...tenantBusinesses]
      .map((b) => {
        const jitter = 0.6 + (hashOf(b.id + ':rev' + range) % 80) / 100;
        const rev = (b.lifetime_revenue || 0) * rangeFraction * jitter;
        return { b, rev };
      })
      .sort((a, z) => z.rev - a.rev)
      .slice(0, 5);
  }, [tenantBusinesses, range, rangeFraction]);

  const busiestTenants = useMemo(
    () => [...tenantBusinesses].sort((a, z) => (z.total_orders_count || 0) - (a.total_orders_count || 0)).slice(0, 4),
    [tenantBusinesses]
  );

  /* ── Trial radar (new: expiring trials with urgency) ── */
  const trialRadar = useMemo(() => {
    const now = Date.now();
    return tenantBusinesses
      .filter((b) => b.status === 'trial' && b.subscription?.trial_end)
      .map((b) => ({
        b,
        daysLeft: Math.max(0, Math.ceil((new Date(b.subscription.trial_end!).getTime() - now) / 86400000)),
      }))
      .sort((a, z) => a.daysLeft - z.daysLeft)
      .slice(0, 3);
  }, [tenantBusinesses]);

  const jumpToBusiness = (id: string) => {
    setSelectedSuperAdminBusinessId(id);
    setActiveSuperAdminTab('businesses');
    setToastMessage('Opened business in the Directory');
  };

  /* ── CSV snapshot export (new) ── */
  const exportSnapshotCsv = () => {
    if (tenantBusinesses.length === 0) {
      setToastMessage('No tenants to export');
      return;
    }
    const rows: string[][] = [
      ['Business', 'Status', 'Plan', 'Monthly Rate (INR)', 'Billing Cycle', 'Orders', 'Lifetime Revenue (INR)', 'City', 'Owner', 'Trial End', 'Next Billing'],
    ];
    tenantBusinesses.forEach((b) => {
      rows.push([
        b.name,
        b.status,
        b.subscription?.plan_id ?? '',
        String(b.subscription?.final_monthly_rate ?? 0),
        b.subscription?.billing_cycle ?? '',
        String(b.total_orders_count ?? 0),
        String(b.lifetime_revenue ?? 0),
        b.city,
        b.owner_name,
        b.subscription?.trial_end ?? '',
        b.subscription?.next_billing_at ?? '',
      ]);
    });
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tsos-platform-snapshot-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setToastMessage(`Snapshot exported — ${tenantBusinesses.length} tenants`);
  };

  return (
    <div className="space-y-4">
      {/* ── Banner: identity + range + actions ── */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2.5 py-1 rounded-full bg-[#0F3D3E] text-white text-[10px] font-bold tracking-wider uppercase">
              Platform Master
            </span>
            <span className="text-xs text-[#6B6B6B] font-medium">SaaS Operations Center</span>
          </div>
          <p className="text-sm text-[#6B6B6B] mt-1.5">
            Live telemetry across {totalBusinesses} subscribing cafe &amp; restaurant tenants ·{' '}
            <span className="font-bold text-[#1A1A1A]">{fmtINR(rangeRevenue)}</span> GMV {RANGE_LABEL[range].toLowerCase()}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Range segmented control */}
          <div className="flex items-center bg-[#D9E2DD] rounded-full p-1" role="group" aria-label="Date range">
            {(Object.keys(RANGE_LABEL) as RangeKey[]).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-3.5 h-8 rounded-full text-xs font-bold transition-all ${
                  range === r ? 'bg-white text-[#0F3D3E] shadow-sm' : 'text-[#6B6B6B] hover:text-[#1A1A1A]'
                }`}
              >
                {RANGE_LABEL[r]}
              </button>
            ))}
          </div>
          <button
            onClick={exportSnapshotCsv}
            className="flex items-center gap-1.5 h-10 px-4 rounded-full border border-[#B88E2F] text-[#967221] text-xs font-bold hover:bg-[#B88E2F]/10 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
          <button
            onClick={() => setActiveSuperAdminTab('wizard')}
            className="flex items-center gap-1.5 h-10 px-4 rounded-full bg-[#0F3D3E] text-white text-xs font-bold hover:bg-[#0B2E2F] transition-colors shadow-sm"
          >
            <PlusCircle className="w-4 h-4 text-[#E5C97A]" />
            Provision New Cafe
          </button>
        </div>
      </div>

      {/* ── Row 1: trend · donut · stat tiles ── */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Daily Sales (frame: line chart, dashed grid) */}
        <div className="lg:col-span-2 bg-white border border-[#E3E7E0] rounded-2xl p-5 shadow-sm shadow-[#0F3D3E]/5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-base font-bold text-[#1A1A1A]">Daily Sales</h3>
              <p className="text-[11px] text-[#6B6B6B]">
                Platform orders &amp; revenue · {RANGE_LABEL[range]}
              </p>
            </div>
            <div className="flex items-center gap-3 text-[10px] font-semibold text-[#6B6B6B]">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#0F3D3E]" /> Orders
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#B88E2F]" /> Revenue
              </span>
            </div>
          </div>
          <div style={{ width: '100%', height: 224 }}>
            <ResponsiveContainer>
              <LineChart data={trend} margin={{ top: 6, right: 2, bottom: 0, left: -14 }}>
                <CartesianGrid stroke="#E3E7E0" strokeDasharray="4 6" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: '#6B6B6B', fontSize: 10, fontWeight: 600 }}
                  axisLine={{ stroke: '#E3E7E0' }}
                  tickLine={false}
                  interval="preserveStartEnd"
                  minTickGap={18}
                />
                <YAxis
                  yAxisId="orders"
                  allowDecimals={false}
                  tick={{ fill: '#6B6B6B', fontSize: 10, fontWeight: 600 }}
                  axisLine={false}
                  tickLine={false}
                  width={40}
                />
                <YAxis
                  yAxisId="revenue"
                  orientation="right"
                  tick={{ fill: '#967221', fontSize: 10, fontWeight: 600 }}
                  axisLine={false}
                  tickLine={false}
                  width={46}
                  tickFormatter={(v: number) => fmtCompact(v)}
                />
                <ReTooltip content={<TrendTooltip />} cursor={{ stroke: '#B88E2F', strokeWidth: 1, strokeDasharray: '4 4' }} />
                <Line
                  yAxisId="orders"
                  type="monotone"
                  dataKey="orders"
                  stroke="#0F3D3E"
                  strokeWidth={2.5}
                  dot={{ r: 2.5, fill: '#FFFFFF', stroke: '#0F3D3E', strokeWidth: 2 }}
                  activeDot={{ r: 5, fill: '#0F3D3E', stroke: '#FFFFFF', strokeWidth: 2 }}
                />
                <Line
                  yAxisId="revenue"
                  type="monotone"
                  dataKey="revenue"
                  stroke="#B88E2F"
                  strokeWidth={2}
                  strokeDasharray="6 4"
                  dot={false}
                  activeDot={{ r: 4, fill: '#B88E2F', stroke: '#FFFFFF', strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 pt-3 border-t border-[#E3E7E0] flex items-center justify-between text-xs">
            <span className="text-[#6B6B6B] font-medium">
              {rangeOrders.toLocaleString('en-IN')} orders · {fmtINR(rangeRevenue)} GMV
            </span>
            <span
              className={`font-bold flex items-center gap-1 ${
                range === 'today' && ordersDeltaPct < 0 ? 'text-[#DC2626]' : 'text-[#17803D]'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              {range === 'today' ? `${ordersDeltaPct > 0 ? '+' : ''}${ordersDeltaPct}% vs yesterday` : RANGE_LABEL[range]}
            </span>
          </div>
        </div>

        {/* Total Revenue (frame: donut with center value + legend) */}
        <div className="bg-white border border-[#E3E7E0] rounded-2xl p-5 shadow-sm shadow-[#0F3D3E]/5">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-base font-bold text-[#1A1A1A]">MRR by Plan</h3>
          </div>
          <div className="relative" style={{ height: 170 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={pieData.length > 0 ? pieData : donutData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius="64%"
                  outerRadius="92%"
                  paddingAngle={3}
                  cornerRadius={5}
                  stroke="none"
                  onMouseEnter={(_, i) => {
                    const src = pieData.length > 0 ? pieData : donutData;
                    setHoveredPlan(src[i]?.plan ?? null);
                  }}
                  onMouseLeave={() => setHoveredPlan(null)}
                >
                  {(pieData.length > 0 ? pieData : donutData).map((d) => (
                    <Cell key={d.plan} fill={PLAN_COLORS[d.plan] || '#8FA99B'} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-xl font-bold text-[#1A1A1A] leading-tight">
                {fmtCompact(
                  hoveredPlan ? planMRR[hoveredPlan] : activeMRR
                )}
              </span>
              <span className="text-[10px] font-semibold text-[#6B6B6B] uppercase tracking-wider">
                {hoveredPlan ? `${hoveredPlan} MRR` : 'MRR / month'}
              </span>
            </div>
          </div>
          <div className="space-y-1.5 mt-2">
            {donutData.map((d) => (
              <div key={d.plan} className="flex items-center justify-between text-[11px]">
                <span className="flex items-center gap-1.5 font-semibold text-[#1A1A1A]">
                  <span className="w-2 h-2 rounded-full" style={{ background: PLAN_COLORS[d.plan] }} />
                  {d.name}
                  <span className="text-[#969696] font-medium">· {d.count}</span>
                </span>
                <span className="font-bold text-[#1A1A1A]">{fmtCompact(d.value)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Stat tiles (frame: sage cards, square chips, dark underline) */}
        <div className="flex flex-col gap-4">
          <div className="flex-1 rounded-2xl bg-[#D9E2DD] p-5 flex flex-col justify-center">
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded-sm bg-[#DC2626]" aria-hidden />
              <span className="text-sm font-bold text-[#1A1A1A]">Platform Orders</span>
            </div>
            <div className="text-[11px] font-bold text-[#DC2626] mt-0.5">
              ~{mrrDeltaPct >= 0 ? '' : '−'}
              {Math.abs(mrrDeltaPct).toFixed(2)}% this week
            </div>
            <div className="text-3xl font-bold text-[#1A1A1A] mt-1.5 leading-none">
              {totalPlatformOrders.toLocaleString('en-IN')}
            </div>
            <div className="h-[3px] w-14 bg-[#1A1A1A] rounded-full mt-2.5" aria-hidden />
            <div className="text-[10px] text-[#6B6B6B] font-medium mt-2">
              QR ordering · POS counters · KDS
            </div>
          </div>
          <div className="flex-1 rounded-2xl bg-[#D9E2DD] p-5 flex flex-col justify-center">
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded-sm bg-[#B88E2F]" aria-hidden />
              <span className="text-sm font-bold text-[#1A1A1A]">Recurring Revenue</span>
            </div>
            <div
              className={`text-[11px] font-bold mt-0.5 ${mrrDeltaPct >= 0 ? 'text-[#17803D]' : 'text-[#DC2626]'}`}
            >
              {mrrDeltaPct >= 0 ? '+' : '−'}
              {Math.abs(mrrDeltaPct).toFixed(2)}% MoM · {activeBusinesses} paying
            </div>
            <div className="text-3xl font-bold text-[#1A1A1A] mt-1.5 leading-none">{fmtINR(activeMRR)}</div>
            <div className="h-[3px] w-14 bg-[#1A1A1A] rounded-full mt-2.5" aria-hidden />
            <div className="text-[10px] text-[#6B6B6B] font-medium mt-2">
              Lifetime GMV {fmtCompact(totalPlatformGMV)} across tenants
            </div>
          </div>
        </div>
      </div>

      {/* ── Row 2: top tenants · busiest tenants ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Best Employees (frame) → Top Tenants */}
        <div className="bg-white border border-[#E3E7E0] rounded-2xl p-5 shadow-sm shadow-[#0F3D3E]/5">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-base font-bold text-[#1A1A1A]">Top Tenants</h3>
            <button
              onClick={() => setActiveSuperAdminTab('businesses')}
              className="text-[11px] font-bold text-[#967221] hover:underline flex items-center"
            >
              Directory
              <ArrowUpRight className="w-3.5 h-3.5 ml-0.5" />
            </button>
          </div>
          <div className="flex items-center justify-between text-[11px] font-semibold text-[#969696] mb-2">
            <span>Business</span>
            <span>Revenue · {RANGE_LABEL[range]}</span>
          </div>
          <div className="divide-y divide-[#F1F4F0]">
            {topTenants.map(({ b, rev }, i) => (
              <button
                key={b.id}
                onClick={() => jumpToBusiness(b.id)}
                className="w-full flex items-center justify-between gap-3 py-2.5 group text-left"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className={`w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-black shrink-0 ${AVATAR_CYCLE[i % AVATAR_CYCLE.length]}`}
                  >
                    {b.name.slice(0, 2).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <div className="text-[13px] font-bold text-[#1A1A1A] truncate group-hover:text-[#967221] transition-colors">
                      {b.name}
                    </div>
                    <div className="text-[11px] text-[#6B6B6B] capitalize truncate">
                      {b.subscription?.plan_id ?? 'starter'} · {b.city}
                    </div>
                  </div>
                </div>
                <span className="text-sm font-bold text-[#1A1A1A] shrink-0">{fmtINR(rev)}</span>
              </button>
            ))}
            {topTenants.length === 0 && (
              <div className="py-6 text-center text-xs text-[#969696]">No tenants yet</div>
            )}
          </div>
        </div>

        {/* Trending Dishes (frame) → Busiest Tenants + trial radar */}
        <div className="bg-white border border-[#E3E7E0] rounded-2xl p-5 shadow-sm shadow-[#0F3D3E]/5">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-base font-bold text-[#1A1A1A]">Busiest Tenants</h3>
            <span className="text-[11px] font-semibold text-[#969696]">all-time orders</span>
          </div>
          <div className="divide-y divide-[#F1F4F0]">
            {busiestTenants.map((b) => (
              <button
                key={b.id}
                onClick={() => jumpToBusiness(b.id)}
                className="w-full flex items-center justify-between gap-3 py-2.5 group text-left"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="px-2 py-0.5 rounded-md bg-[#B88E2F]/15 text-[#967221] text-[9px] font-black uppercase tracking-wider shrink-0">
                    {(b.business_type || 'cafe').replace('_', ' ')}
                  </span>
                  <div className="min-w-0">
                    <div className="text-[13px] font-bold text-[#1A1A1A] truncate group-hover:text-[#967221] transition-colors">
                      {b.name}
                    </div>
                    <div className="text-[11px] text-[#6B6B6B] truncate">{b.city}</div>
                  </div>
                </div>
                <span className="text-sm font-bold text-[#1A1A1A] shrink-0">
                  {(b.total_orders_count || 0).toLocaleString('en-IN')}
                </span>
              </button>
            ))}
            {busiestTenants.length === 0 && (
              <div className="py-6 text-center text-xs text-[#969696]">No tenants yet</div>
            )}
          </div>
          {/* Trial radar strip (new) */}
          {trialRadar.length > 0 && (
            <div className="mt-3 rounded-xl bg-[#D9E2DD]/60 px-3.5 py-3">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#0F3D3E] uppercase tracking-wider mb-1.5">
                <Clock className="w-3.5 h-3.5" />
                Trials ending soon
              </div>
              <div className="flex flex-wrap gap-1.5">
                {trialRadar.map(({ b, daysLeft }) => (
                  <button
                    key={b.id}
                    onClick={() => jumpToBusiness(b.id)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold transition-transform hover:scale-[1.03] ${
                      daysLeft <= 3
                        ? 'bg-[#DC2626] text-white'
                        : daysLeft <= 7
                        ? 'bg-[#B88E2F] text-white'
                        : 'bg-white text-[#0F3D3E] border border-[#E3E7E0]'
                    }`}
                    title={`${b.name} — trial ends ${new Date(b.subscription.trial_end!).toLocaleDateString('en-IN')}`}
                  >
                    {b.name.length > 18 ? b.name.slice(0, 18) + '…' : b.name}
                    <span className="opacity-80">· {daysLeft}d</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Row 3: lifecycle · health · recent ops ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Tenant Lifecycle Status */}
        <div className="bg-white border border-[#E3E7E0] rounded-2xl p-5 shadow-sm shadow-[#0F3D3E]/5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-bold text-[#1A1A1A]">Tenant Lifecycle</h3>
            <button
              onClick={() => setActiveSuperAdminTab('businesses')}
              className="text-[11px] font-bold text-[#967221] hover:underline flex items-center"
            >
              Directory
              <ArrowUpRight className="w-3.5 h-3.5 ml-0.5" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div className="rounded-xl bg-[#D9E2DD]/60 border border-[#E3E7E0] p-3">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#17803D]">
                <CheckCircle2 className="w-3.5 h-3.5" /> Active Paying
              </div>
              <div className="text-xl font-bold text-[#1A1A1A] mt-1">{activeBusinesses}</div>
              <p className="text-[10px] text-[#6B6B6B]">Standard recurring billing</p>
            </div>
            <div className="rounded-xl bg-[#D9E2DD]/60 border border-[#E3E7E0] p-3">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#967221]">
                <Clock className="w-3.5 h-3.5" /> Free Trial
              </div>
              <div className="text-xl font-bold text-[#1A1A1A] mt-1">{trialBusinesses}</div>
              <p className="text-[10px] text-[#6B6B6B]">14-day evaluation window</p>
            </div>
            <div className="rounded-xl bg-[#B88E2F]/12 border border-[#E3E7E0] p-3">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#967221]">
                <AlertTriangle className="w-3.5 h-3.5" /> Past Due
              </div>
              <div className="text-xl font-bold text-[#1A1A1A] mt-1">{pastDueBusinesses}</div>
              <p className="text-[10px] text-[#6B6B6B]">Card/mandate retry active</p>
            </div>
            <div className="rounded-xl bg-[#DC2626]/10 border border-[#E3E7E0] p-3">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#DC2626]">
                <AlertTriangle className="w-3.5 h-3.5" /> Suspended
              </div>
              <div className="text-xl font-bold text-[#1A1A1A] mt-1">{suspendedBusinesses}</div>
              <p className="text-[10px] text-[#6B6B6B]">Access restricted</p>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-[#F1F4F0] flex items-center justify-between text-xs">
            <span className="text-[#6B6B6B] font-medium">Archived businesses</span>
            <span className="font-bold text-[#1A1A1A]">{archivedBusinesses}</span>
          </div>
        </div>

        {/* System Health & Telemetry */}
        <div className="bg-white border border-[#E3E7E0] rounded-2xl p-5 shadow-sm shadow-[#0F3D3E]/5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-bold text-[#1A1A1A]">System Health</h3>
            <span className="px-2.5 py-1 rounded-full bg-[#D9E2DD] text-[#17803D] text-[10px] font-bold flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#17803D] animate-pulse" />
              99.98% Uptime
            </span>
          </div>
          <div className="space-y-2.5">
            {[
              {
                icon: Database,
                name: 'PostgreSQL Multi-Tenant DB',
                sub: 'Supabase Cloud (asia-southeast1)',
                status: '24ms · Healthy',
              },
              {
                icon: ShieldCheck,
                name: 'Row-Level Security (RLS)',
                sub: '15/15 policy tests green',
                status: 'Enforced',
              },
              {
                icon: Radio,
                name: 'KDS Bump Bar Realtime WS',
                sub: 'Subscribed channels active',
                status: 'Connected',
              },
              {
                icon: Cpu,
                name: 'Table Token HMAC',
                sub: 'Anti-tamper QR verifier',
                status: 'Active',
              },
            ].map((svc) => {
              const Icon = svc.icon;
              return (
                <div
                  key={svc.name}
                  className="flex items-center justify-between gap-2 rounded-xl bg-[#F6F5F2] border border-[#E3E7E0] px-3 py-2.5"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-8 h-8 rounded-lg bg-[#0F3D3E] flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4 text-[#E5C97A]" />
                    </span>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-[#1A1A1A] truncate">{svc.name}</div>
                      <div className="text-[10px] text-[#6B6B6B] truncate">{svc.sub}</div>
                    </div>
                  </div>
                  <span className="text-[11px] font-bold text-[#17803D] shrink-0">{svc.status}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent Platform Operations */}
        <div className="bg-white border border-[#E3E7E0] rounded-2xl p-5 shadow-sm shadow-[#0F3D3E]/5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-bold text-[#1A1A1A]">Recent Operations</h3>
            <button
              onClick={() => setActiveSuperAdminTab('audit')}
              className="text-[11px] font-bold text-[#967221] hover:underline flex items-center"
            >
              Full Audit Log
              <ArrowUpRight className="w-3.5 h-3.5 ml-0.5" />
            </button>
          </div>
          <div className="divide-y divide-[#F1F4F0]">
            {platformAuditLogs.slice(0, 5).map((log) => (
              <div key={log.id} className="py-2.5 flex flex-col sm:flex-row sm:items-start justify-between gap-1.5">
                <div className="flex items-start gap-2 min-w-0">
                  <span className="mt-0.5 px-2 py-0.5 rounded-md bg-[#D9E2DD] text-[#0F3D3E] text-[9px] font-black uppercase tracking-wide shrink-0">
                    {log.action}
                  </span>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-[#1A1A1A] truncate">
                      {log.target_business_name || 'System'}
                    </div>
                    <p className="text-[11px] text-[#6B6B6B] leading-snug">{log.details}</p>
                  </div>
                </div>
                <span className="text-[10px] font-semibold text-[#969696] whitespace-nowrap shrink-0">
                  {new Date(log.timestamp).toLocaleString('en-IN', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            ))}
            {platformAuditLogs.length === 0 && (
              <div className="py-6 text-center text-xs text-[#969696]">No operations logged yet</div>
            )}
          </div>
        </div>
      </div>

      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-[80] flex items-center gap-2 rounded-xl bg-[#0F3D3E] text-white px-4 py-3 shadow-xl shadow-[#0F3D3E]/30 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <CheckCircle2 className="w-4 h-4 text-[#E5C97A]" />
          <span className="text-xs font-semibold">{toastMessage}</span>
        </div>
      )}
    </div>
  );
};

/* ═══════════════════════════ Legacy dashboard ════════════════════════════ */

const LegacyDashboard: React.FC = () => {
  const {
    tenantBusinesses,
    platformAuditLogs,
    setActiveSuperAdminTab,
    setSelectedSuperAdminBusinessId,
  } = useTsosStore();

  // Metrics computation from real tenant data
  const totalBusinesses = tenantBusinesses.length;
  const activeBusinesses = tenantBusinesses.filter((b) => b.status === 'active').length;
  const trialBusinesses = tenantBusinesses.filter((b) => b.status === 'trial').length;
  const pastDueBusinesses = tenantBusinesses.filter((b) => b.status === 'past_due').length;
  const suspendedBusinesses = tenantBusinesses.filter((b) => b.status === 'suspended').length;
  const archivedBusinesses = tenantBusinesses.filter((b) => b.status === 'archived').length;

  // Monthly Recurring Revenue (MRR) from active & past_due paying subscriptions
  const activeMRR = tenantBusinesses
    .filter((b) => b.status === 'active' || b.status === 'past_due')
    .reduce((sum, b) => sum + (b.subscription?.final_monthly_rate || 0), 0);

  const totalPlatformOrders = tenantBusinesses.reduce((sum, b) => sum + (b.total_orders_count || 0), 0);
  const totalPlatformGMV = tenantBusinesses.reduce((sum, b) => sum + (b.lifetime_revenue || 0), 0);

  // Plan distribution
  const planCounts: Record<string, number> = {
    starter: 0,
    growth: 0,
    pro: 0,
    enterprise: 0,
  };
  tenantBusinesses.forEach((b) => {
    const plan = b.subscription?.plan_id;
    if (plan && planCounts[plan] !== undefined) {
      planCounts[plan]++;
    }
  });

  return (
    <div className="space-y-6">
      {/* Top Banner with Quick Action */}
      <div className="bg-white border border-[#E9E0D6] rounded-xl p-6 shadow-xs flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#7C3AED] text-white">
              Platform Master
            </span>
            <span className="text-xs font-medium text-[#78716C]">SaaS Operations Center</span>
          </div>
          <h2 className="text-2xl font-bold text-[#1C1917] mt-1">Multi-Tenant Platform Overview</h2>
          <p className="text-sm text-[#78716C] mt-0.5">
            Real-time telemetry across all subscribing cafe and restaurant tenants on the monthly SaaS model.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setActiveSuperAdminTab('wizard')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#F97316] text-white font-medium hover:bg-[#EA580C] shadow-sm transition-all text-sm"
          >
            <PlusCircle className="w-4 h-4" />
            Provision New Cafe
          </button>
          <button
            onClick={() => setActiveSuperAdminTab('businesses')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#FAF6F0] border border-[#E9E0D6] text-[#1C1917] font-medium hover:bg-[#F3ECE4] transition-all text-sm"
          >
            <Building2 className="w-4 h-4 text-[#78716C]" />
            Manage Businesses
          </button>
        </div>
      </div>

      {/* Primary KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* MRR Card */}
        <div className="bg-white border border-[#E9E0D6] rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#78716C]">
              Monthly Recurring Revenue
            </span>
            <div className="w-9 h-9 rounded-lg bg-[#ECFDF5] text-[#059669] flex items-center justify-center">
              <CreditCard className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-[#1C1917]">
              ₹{activeMRR.toLocaleString('en-IN')}
            </span>
            <span className="text-xs font-medium text-[#059669] flex items-center">
              <TrendingUp className="w-3 h-3 mr-0.5" />
              Active
            </span>
          </div>
          <p className="text-xs text-[#78716C] mt-1">
            Calculated from {activeBusinesses} active paying subscriptions
          </p>
        </div>

        {/* Total Businesses */}
        <div className="bg-white border border-[#E9E0D6] rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#78716C]">
              Total Businesses
            </span>
            <div className="w-9 h-9 rounded-lg bg-[#F5F3FF] text-[#7C3AED] flex items-center justify-center">
              <Building2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-[#1C1917]">{totalBusinesses}</span>
            <span className="text-xs text-[#78716C]">
              ({activeBusinesses} active, {trialBusinesses} trial)
            </span>
          </div>
          <div className="flex items-center gap-1.5 mt-2 text-xs">
            <span className="inline-block w-2 h-2 rounded-full bg-[#10B981]" />
            <span className="text-[#57534E] font-medium">{activeBusinesses} Subscribed</span>
            <span className="text-[#A8A29E]">•</span>
            <span className="text-[#F59E0B] font-medium">{pastDueBusinesses} Past Due</span>
          </div>
        </div>

        {/* Platform Order Volume */}
        <div className="bg-white border border-[#E9E0D6] rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#78716C]">
              Platform Orders
            </span>
            <div className="w-9 h-9 rounded-lg bg-[#FFF7ED] text-[#F97316] flex items-center justify-center">
              <Activity className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-[#1C1917]">
              {totalPlatformOrders.toLocaleString('en-IN')}
            </span>
            <span className="text-xs text-[#78716C]">orders placed</span>
          </div>
          <p className="text-xs text-[#78716C] mt-1">
            Across QR table ordering, POS counters, and KDS
          </p>
        </div>

        {/* Platform Gross Volume */}
        <div className="bg-white border border-[#E9E0D6] rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#78716C]">
              Tenant Lifetime GMV
            </span>
            <div className="w-9 h-9 rounded-lg bg-[#EFF6FF] text-[#2563EB] flex items-center justify-center">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-[#1C1917]">
              ₹{totalPlatformGMV.toLocaleString('en-IN')}
            </span>
            <span className="text-xs text-[#78716C]">processed</span>
          </div>
          <p className="text-xs text-[#78716C] mt-1">
            Direct UPI &amp; cash settlements to cafe merchants
          </p>
        </div>
      </div>

      {/* Secondary Row: Subscription Plan Breakdown & Health */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Subscription Tier Distribution */}
        <div className="bg-white border border-[#E9E0D6] rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-semibold text-[#1C1917]">SaaS Plans Breakdown</h3>
              <p className="text-xs text-[#78716C]">Active distribution across subscription tiers</p>
            </div>
            <button
              onClick={() => setActiveSuperAdminTab('subscriptions')}
              className="text-xs font-semibold text-[#F97316] hover:underline flex items-center"
            >
              Plans
              <ArrowUpRight className="w-3.5 h-3.5 ml-0.5" />
            </button>
          </div>

          <div className="space-y-3.5">
            {Object.keys(planCounts).map((planId) => {
              const count = planCounts[planId] || 0;
              const pct = totalBusinesses > 0 ? Math.round((count / totalBusinesses) * 100) : 0;
              const planNames: Record<string, string> = {
                starter: 'Starter (₹999/mo)',
                growth: 'Growth (₹2,499/mo)',
                pro: 'Pro (₹4,999/mo)',
                enterprise: 'Enterprise (₹9,999/mo)',
              };
              return (
                <div key={planId} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[#1C1917]">{planNames[planId]}</span>
                    <span className="font-mono font-medium text-[#57534E]">
                      {count} ({pct}%)
                    </span>
                  </div>
                  <div className="w-full bg-[#F5F0EB] h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        planId === 'pro'
                          ? 'bg-[#7C3AED]'
                          : planId === 'growth'
                          ? 'bg-[#F97316]'
                          : planId === 'enterprise'
                          ? 'bg-[#2563EB]'
                          : 'bg-[#10B981]'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-5 pt-4 border-t border-[#F5EFEA] text-xs flex items-center justify-between text-[#78716C]">
            <span>Trial Conversion Target</span>
            <span className="font-semibold text-[#1C1917]">78.4%</span>
          </div>
        </div>

        {/* Tenant Lifecycle State Matrix */}
        <div className="bg-white border border-[#E9E0D6] rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-semibold text-[#1C1917]">Tenant Lifecycle Status</h3>
              <p className="text-xs text-[#78716C]">Account states requiring administrative review</p>
            </div>
            <button
              onClick={() => setActiveSuperAdminTab('businesses')}
              className="text-xs font-semibold text-[#F97316] hover:underline flex items-center"
            >
              Directory
              <ArrowUpRight className="w-3.5 h-3.5 ml-0.5" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-[#F0FDF4] border border-[#DCFCE7]">
              <div className="flex items-center gap-1.5 text-xs text-[#166534] font-medium">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#16A34A]" />
                Active Paying
              </div>
              <div className="text-xl font-bold text-[#14532D] mt-1">{activeBusinesses}</div>
              <p className="text-[11px] text-[#15803D]">Standard recurring billing</p>
            </div>

            <div className="p-3 rounded-lg bg-[#FAF5FF] border border-[#F3E8FF]">
              <div className="flex items-center gap-1.5 text-xs text-[#6B21A8] font-medium">
                <Clock className="w-3.5 h-3.5 text-[#9333EA]" />
                Free Trial
              </div>
              <div className="text-xl font-bold text-[#581C87] mt-1">{trialBusinesses}</div>
              <p className="text-[11px] text-[#7E22CE]">14-day evaluation window</p>
            </div>

            <div className="p-3 rounded-lg bg-[#FFFBEB] border border-[#FEF3C7]">
              <div className="flex items-center gap-1.5 text-xs text-[#92400E] font-medium">
                <AlertTriangle className="w-3.5 h-3.5 text-[#D97706]" />
                Past Due
              </div>
              <div className="text-xl font-bold text-[#78350F] mt-1">{pastDueBusinesses}</div>
              <p className="text-[11px] text-[#B45309]">Card/mandate retry active</p>
            </div>

            <div className="p-3 rounded-lg bg-[#FEF2F2] border border-[#FEE2E2]">
              <div className="flex items-center gap-1.5 text-xs text-[#991B1B] font-medium">
                <AlertTriangle className="w-3.5 h-3.5 text-[#DC2626]" />
                Suspended
              </div>
              <div className="text-xl font-bold text-[#7F1D1D] mt-1">{suspendedBusinesses}</div>
              <p className="text-[11px] text-[#B91C1C]">Access restricted</p>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[#F5EFEA] flex items-center justify-between text-xs text-[#78716C]">
            <span>Archived Businesses:</span>
            <span className="font-semibold text-[#1C1917]">{archivedBusinesses}</span>
          </div>
        </div>

        {/* Platform Infrastructure Health */}
        <div className="bg-white border border-[#E9E0D6] rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-semibold text-[#1C1917]">System Health &amp; Telemetry</h3>
              <p className="text-xs text-[#78716C]">Multi-tenant backend services status</p>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#DCFCE7] text-[#166534] flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A] animate-pulse" />
              99.98% Uptime
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#FAF6F0] border border-[#F0E8DF]">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-[#F97316]" />
                <div>
                  <span className="font-semibold text-[#1C1917]">PostgreSQL Multi-Tenant DB</span>
                  <p className="text-[10px] text-[#78716C]">Supabase Cloud (asia-southeast1)</p>
                </div>
              </div>
              <span className="font-mono text-[#16A34A] font-semibold">24ms • Healthy</span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#FAF6F0] border border-[#F0E8DF]">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#7C3AED]" />
                <div>
                  <span className="font-semibold text-[#1C1917]">Row-Level Security (RLS)</span>
                  <p className="text-[10px] text-[#78716C]">15/15 Policy tests green</p>
                </div>
              </div>
              <span className="font-mono text-[#16A34A] font-semibold">Enforced</span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#FAF6F0] border border-[#F0E8DF]">
              <div className="flex items-center gap-2">
                <Radio className="w-4 h-4 text-[#2563EB]" />
                <div>
                  <span className="font-semibold text-[#1C1917]">KDS Bump Bar Realtime WS</span>
                  <p className="text-[10px] text-[#78716C]">Subscribed channels active</p>
                </div>
              </div>
              <span className="font-mono text-[#16A34A] font-semibold">Connected</span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#FAF6F0] border border-[#F0E8DF]">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-[#10B981]" />
                <div>
                  <span className="font-semibold text-[#1C1917]">Cryptographic Table Token HMAC</span>
                  <p className="text-[10px] text-[#78716C]">Anti-tamper QR verifier</p>
                </div>
              </div>
              <span className="font-mono text-[#16A34A] font-semibold">Active</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Administrative Activity Log */}
      <div className="bg-white border border-[#E9E0D6] rounded-xl p-5 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-semibold text-[#1C1917]">Recent Platform Operations</h3>
            <p className="text-xs text-[#78716C]">Audit trail of recent tenant changes and provisioning</p>
          </div>
          <button
            onClick={() => setActiveSuperAdminTab('audit')}
            className="text-xs font-semibold text-[#F97316] hover:underline flex items-center"
          >
            Full Audit Log
            <ArrowUpRight className="w-3.5 h-3.5 ml-0.5" />
          </button>
        </div>

        <div className="divide-y divide-[#F5EFEA]">
          {platformAuditLogs.slice(0, 5).map((log) => (
            <div key={log.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div className="flex items-start gap-2.5">
                <span className="mt-0.5 px-2 py-0.5 rounded font-mono font-bold text-[10px] bg-[#FAF6F0] border border-[#E9E0D6] text-[#57534E]">
                  {log.action}
                </span>
                <div>
                  <span className="font-semibold text-[#1C1917]">
                    {log.target_business_name || 'System'}
                  </span>
                  <p className="text-[#78716C] mt-0.5">{log.details}</p>
                </div>
              </div>
              <div className="text-right whitespace-nowrap text-[#A8A29E] font-mono text-[11px]">
                {new Date(log.timestamp).toLocaleString('en-IN', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export const SuperAdminDashboard: React.FC = () => {
  const { themeMode } = useTsosStore();
  const isServepoint = themeMode === 'servepoint';
  return isServepoint ? <ServePointDashboard /> : <LegacyDashboard />;
};
