import React, { useMemo } from 'react';
import { useTsosStore } from '../../lib/store';
import {
  Activity,
  Clock,
  Table2,
  ChefHat,
  Users,
  TrendingUp,
  IndianRupee,
} from 'lucide-react';

/**
 * LiveOpsPulse — a real-time operational dashboard widget for the Reports
 * screen. Shows the cafe's *live* operational state at a glance:
 *   - Orders in the last 60 minutes (revenue + count)
 *   - Active dining tables (occupied right now)
 *   - Kitchen load (tickets currently in `new` or `preparing` state)
 *   - Staff currently on shift
 *
 * This is genuinely new analytics — the DailySalesHeatmap covers the full
 * day hour-by-hour, but managers need a "right now" pulse view too.
 */
export const LiveOpsPulse: React.FC = () => {
  const { orders, tables, shifts, currentProfile } = useTsosStore();

  const stats = useMemo(() => {
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;

    // Orders placed in the last 60 minutes (any status except cancelled).
    const lastHourOrders = (orders || []).filter((o) => {
      const ts = new Date(o.created_at).getTime();
      return ts >= oneHourAgo && ts <= now && o.status !== 'cancelled';
    });
    const lastHourRevenue = lastHourOrders.reduce((s, o) => s + (o?.grand_total || 0), 0);

    // Active tables = occupied right now.
    const activeTables = (tables || []).filter((t) => t.status === 'occupied').length;
    const totalTables = (tables || []).length;

    // Kitchen load = tickets in `new` or `preparing` (waiting on the kitchen).
    const kitchenLoad = (orders || []).filter(
      (o) => o.status === 'new' || o.status === 'preparing'
    ).length;
    const readyTickets = (orders || []).filter((o) => o.status === 'ready').length;

    // Staff on active shift = shifts with no clock_out yet.
    const staffOnShift = (shifts || []).filter((s) => s.status === 'active').length;

    // Throughput velocity: orders per minute over the last hour.
    const ordersPerMin = lastHourOrders.length / 60;

    return {
      lastHourOrders: lastHourOrders.length,
      lastHourRevenue,
      activeTables,
      totalTables,
      kitchenLoad,
      readyTickets,
      staffOnShift,
      ordersPerMin,
    };
  }, [orders, tables, shifts]);

  // Kitchen load severity for color coding.
  const kitchenSeverity =
    stats.kitchenLoad === 0 ? 'idle' :
    stats.kitchenLoad <= 2 ? 'light' :
    stats.kitchenLoad <= 5 ? 'moderate' :
    stats.kitchenLoad <= 8 ? 'busy' : 'critical';

  const kitchenColor = {
    idle: '#A8A29E',
    light: '#10B981',
    moderate: '#F97316',
    busy: '#EA580C',
    critical: '#DC2626',
  }[kitchenSeverity];

  const cards = [
    {
      label: 'Last 60 min',
      value: `₹${stats.lastHourRevenue.toLocaleString('en-IN')}`,
      sub: `${stats.lastHourOrders} orders · ${stats.ordersPerMin.toFixed(1)}/min`,
      icon: <IndianRupee className="w-4 h-4" />,
      tint: 'bg-[#FFF1E6] text-[#F97316]',
    },
    {
      label: 'Active Tables',
      value: `${stats.activeTables}/${stats.totalTables}`,
      sub: stats.activeTables === 0 ? 'floor is clear' : `${Math.round((stats.activeTables / Math.max(stats.totalTables, 1)) * 100)}% occupied`,
      icon: <Table2 className="w-4 h-4" />,
      tint: 'bg-[#E8F5EC] text-[#17803D]',
    },
    {
      label: 'Kitchen Load',
      value: `${stats.kitchenLoad}`,
      sub: `${stats.readyTickets} ready to serve`,
      icon: <ChefHat className="w-4 h-4" />,
      tint: 'bg-[#FFF1E6]',
      customColor: kitchenColor,
    },
    {
      label: 'Staff On Shift',
      value: `${stats.staffOnShift}`,
      sub: stats.staffOnShift === 0 ? 'no one clocked in' : 'clocked in now',
      icon: <Users className="w-4 h-4" />,
      tint: 'bg-[#F5F3FF] text-[#7C3AED]',
    },
  ];

  return (
    <div className="bg-[#0F1D17] p-5 rounded-2xl border border-[#1F3D2E] tessera-block">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-[#C5F82A] animate-pulse" />
          <h3 className="text-sm text-[#F5F4EE]">Live Operational Pulse</h3>
          <span className="text-[10px] font-bold text-[#0A1410] bg-[#C5F82A] px-2 py-0.5 rounded-full" style={{ boxShadow: '1px 1px 0 #1F3D2E' }}>
            ● LIVE
          </span>
        </div>
        <div className="flex items-center gap-1 text-[11px] text-[#6B8579] font-mono">
          <Clock className="w-3 h-3" />
          <span>{new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map((c) => (
          <div
            key={c.label}
            className="p-3 rounded-lg border border-[#1F3D2E] bg-[#0A1410] hover:border-[#2A4A37] hover:bg-[#142620] transition-colors"
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] uppercase tracking-[0.12em] font-semibold text-[#6B8579]">{c.label}</span>
              <span className="p-1 rounded-md" style={{ color: c.customColor || undefined }}>
                {c.icon}
              </span>
            </div>
            <div className="text-xl font-bold font-mono leading-none tabular-nums" style={{ color: c.customColor || '#F5F4EE' }}>
              {c.value}
            </div>
            <div className="text-[10px] text-[#9BB5A5] mt-1">{c.sub}</div>
          </div>
        ))}
      </div>

      {/* Quick insight strip — chartreuse accent on forest inset */}
      <div className="mt-3 p-2.5 rounded-lg bg-[#0A1410] border border-[#1F3D2E] text-[11px] text-[#9BB5A5] flex items-center gap-2">
        <TrendingUp className="w-3.5 h-3.5 text-[#C5F82A] shrink-0" />
        <span>
          {stats.kitchenLoad === 0 && stats.activeTables === 0
            ? 'Floor is quiet — good moment for restocks and shift handovers.'
            : stats.kitchenLoad >= 5
            ? `Kitchen at ${kitchenSeverity} load (${stats.kitchenLoad} tickets) — consider pulling a runner.`
            : stats.activeTables >= Math.ceil(stats.totalTables * 0.7)
            ? `${stats.activeTables}/${stats.totalTables} tables occupied — near peak capacity.`
            : `Operations steady: ${stats.lastHourOrders} orders in the last hour at ${stats.ordersPerMin.toFixed(1)}/min.`}
        </span>
      </div>
    </div>
  );
};
