import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { useTsosStore } from '../../lib/store';
import { Utensils, ShoppingBag, Bike } from 'lucide-react';
import { Order } from '../../types';

interface OrderTypeSlice {
  name: string;
  key: Order['order_type'];
  value: number; // order count
  revenue: number; // total revenue
  color: string; // hex
  icon: React.ReactNode;
}

/**
 * OrderTypeBreakdown — a donut chart showing the split of orders by
 * order type (dine_in / takeaway / delivery). This analytics view was
 * missing from the Reports screen (which previously only showed payment
 * methods). Cafe managers use this to decide staffing: a dine-in heavy
 * day needs more servers; a delivery-heavy day needs more runners.
 *
 * Theme-aware: ServePoint (default) renders a white card with the owner's
 * restrained palette (deep-teal / gold / sage); Tessera keeps the dark
 * editorial treatment.
 */
export const OrderTypeBreakdown: React.FC = () => {
  const { orders, themeMode } = useTsosStore();
  const isServepoint = themeMode === 'servepoint';
  const safeOrders = orders || [];

  const slices: OrderTypeSlice[] = useMemo(() => {
    const dineIn = safeOrders.filter((o) => o.order_type === 'dine_in');
    const takeaway = safeOrders.filter((o) => o.order_type === 'takeaway');
    const delivery = safeOrders.filter((o) => o.order_type === 'delivery');

    const rev = (arr: Order[]) => arr.reduce((s, o) => s + (o?.grand_total || 0), 0);

    return [
      {
        name: 'Dine-In',
        key: 'dine_in' as const,
        value: dineIn.length,
        revenue: rev(dineIn),
        color: isServepoint ? '#0F3D3E' : '#F97316', // deep teal / warm orange
        icon: <Utensils className="w-4 h-4" />,
      },
      {
        name: 'Takeaway',
        key: 'takeaway' as const,
        value: takeaway.length,
        revenue: rev(takeaway),
        color: isServepoint ? '#B88E2F' : '#7C3AED', // gold / violet
        icon: <ShoppingBag className="w-4 h-4" />,
      },
      {
        name: 'Delivery',
        key: 'delivery' as const,
        value: delivery.length,
        revenue: rev(delivery),
        color: isServepoint ? '#8FA99B' : '#0284C7', // sage / sky blue
        icon: <Bike className="w-4 h-4" />,
      },
    ].filter((s) => s.value > 0) as OrderTypeSlice[]; // hide empty slices from the donut
  }, [safeOrders, isServepoint]);

  const totalOrders = slices.reduce((s, x) => s + x.value, 0);
  const totalRevenue = slices.reduce((s, x) => s + x.revenue, 0);

  // Custom tooltip showing order count, revenue, and percentage share.
  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const p = payload[0].payload as OrderTypeSlice;
    const pct = totalOrders > 0 ? Math.round((p.value / totalOrders) * 100) : 0;
    if (isServepoint) {
      return (
        <div
          className="bg-white border border-[#E3E7E0] rounded-lg px-3 py-2 text-xs"
          style={{ boxShadow: '0 8px 20px rgba(26,26,26,0.12)' }}
        >
          <div className="flex items-center gap-1.5 font-semibold text-[#1A1A1A]">
            <span style={{ color: p.color }}>{p.icon}</span>
            <span>{p.name}</span>
          </div>
          <div className="text-[#6B6B6B] mt-1">
            {p.value} orders · {pct}% of total
          </div>
          <div className="text-[#6B6B6B]">
            Revenue: <span className="font-semibold text-[#967221]">₹{p.revenue.toLocaleString('en-IN')}</span>
          </div>
        </div>
      );
    }
    return (
      <div className="bg-[#0F1D17] border border-[#1F3D2E] rounded-lg px-3 py-2 text-xs" style={{ boxShadow: '2px 2px 0 #1F3D2E' }}>
        <div className="flex items-center gap-1.5 font-bold text-[#F5F4EE]">
          <span style={{ color: p.color }}>{p.icon}</span>
          <span>{p.name}</span>
        </div>
        <div className="text-[#9BB5A5] mt-1">{p.value} orders · {pct}% of total</div>
        <div className="text-[#9BB5A5]">Revenue: <span className="font-mono font-semibold text-[#C5F82A]">₹{p.revenue.toLocaleString('en-IN')}</span></div>
      </div>
    );
  };

  return (
    <div
      className={`p-5 rounded-2xl ${
        isServepoint
          ? 'bg-white border border-[#E3E7E0] shadow-[0_1px_3px_rgba(26,26,26,0.04)]'
          : 'bg-[#0F1D17] border border-[#1F3D2E] tessera-block'
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Utensils className={`w-4 h-4 ${isServepoint ? 'text-[#B88E2F]' : 'text-[#C5F82A]'}`} />
          <h3 className={`text-sm ${isServepoint ? 'font-semibold text-[#1A1A1A]' : 'text-[#F5F4EE]'}`}>
            Order Type Distribution
          </h3>
        </div>
        <span className={`text-xs tabular-nums ${isServepoint ? 'text-[#6B6B6B]' : 'text-[#6B8579] font-mono'}`}>
          {totalOrders} orders · ₹{totalRevenue.toLocaleString('en-IN')}
        </span>
      </div>

      {totalOrders === 0 ? (
        <div className="py-10 text-center">
          <ShoppingBag className={`w-8 h-8 mx-auto mb-2 ${isServepoint ? 'text-[#D9E2DD]' : 'text-[#1F3D2E]'}`} />
          <div className={`text-xs ${isServepoint ? 'text-[#6B6B6B]' : 'text-[#6B8579]'}`}>
            No orders yet — analytics will populate as sales come in.
          </div>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row items-center gap-4">
          {/* Donut chart — 180px wide */}
          <div className="w-[180px] h-[180px] shrink-0 relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={slices}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={2}
                  stroke={isServepoint ? '#F6F5F2' : 'none'}
                  strokeWidth={isServepoint ? 2 : 0}
                >
                  {slices.map((s) => (
                    <Cell key={s.key} fill={s.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            {/* Center label — total orders */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <div className={`text-2xl font-bold leading-none tabular-nums ${isServepoint ? 'text-[#1A1A1A]' : 'font-mono text-[#F5F4EE]'}`}>
                {totalOrders}
              </div>
              <div className={`text-[10px] uppercase tracking-[0.15em] mt-1 ${isServepoint ? 'text-[#6B6B6B]' : 'text-[#6B8579]'}`}>
                orders
              </div>
            </div>
          </div>

          {/* Legend with revenue + percentage bar */}
          <div className="flex-1 w-full space-y-2.5">
            {slices.map((s) => {
              const pct = totalOrders > 0 ? Math.round((s.value / totalOrders) * 100) : 0;
              return (
                <div key={s.key} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-sm" style={{ background: s.color }} />
                      <span className={`font-medium ${isServepoint ? 'text-[#1A1A1A]' : 'font-semibold text-[#F5F4EE]'}`}>{s.name}</span>
                      <span style={{ color: s.color }}>{s.icon}</span>
                    </div>
                    <span className={`tabular-nums ${isServepoint ? 'text-[#6B6B6B]' : 'font-mono text-[#9BB5A5]'}`}>
                      {s.value} · ₹{s.revenue.toLocaleString('en-IN')} · {pct}%
                    </span>
                  </div>
                  <div
                    className={`w-full h-1.5 rounded-full overflow-hidden ${
                      isServepoint ? 'bg-[#D9E2DD]/70' : 'bg-[#0A1410] border border-[#1F3D2E]'
                    }`}
                  >
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, background: s.color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
