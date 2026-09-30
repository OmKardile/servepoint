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
 */
export const OrderTypeBreakdown: React.FC = () => {
  const { orders } = useTsosStore();
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
        color: '#F97316', // warm orange (matches Warm Cafe primary)
        icon: <Utensils className="w-4 h-4" />,
      },
      {
        name: 'Takeaway',
        key: 'takeaway' as const,
        value: takeaway.length,
        revenue: rev(takeaway),
        color: '#7C3AED', // violet
        icon: <ShoppingBag className="w-4 h-4" />,
      },
      {
        name: 'Delivery',
        key: 'delivery' as const,
        value: delivery.length,
        revenue: rev(delivery),
        color: '#0284C7', // sky blue
        icon: <Bike className="w-4 h-4" />,
      },
    ].filter((s) => s.value > 0) as OrderTypeSlice[]; // hide empty slices from the donut
  }, [safeOrders]);

  const totalOrders = slices.reduce((s, x) => s + x.value, 0);
  const totalRevenue = slices.reduce((s, x) => s + x.revenue, 0);

  // Custom tooltip showing order count, revenue, and percentage share.
  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const p = payload[0].payload as OrderTypeSlice;
    const pct = totalOrders > 0 ? Math.round((p.value / totalOrders) * 100) : 0;
    return (
      <div className="bg-white border border-[#E9E0D6] rounded-lg shadow-lg px-3 py-2 text-xs">
        <div className="flex items-center gap-1.5 font-bold text-[#1C1917]">
          <span style={{ color: p.color }}>{p.icon}</span>
          <span>{p.name}</span>
        </div>
        <div className="text-[#57534E] mt-1">{p.value} orders · {pct}% of total</div>
        <div className="text-[#57534E]">Revenue: <span className="font-mono font-semibold text-[#1C1917]">₹{p.revenue.toLocaleString('en-IN')}</span></div>
      </div>
    );
  };

  return (
    <div className="bg-white p-5 rounded-2xl border border-[#E9E0D6] shadow-xs">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Utensils className="w-4 h-4 text-[#F97316]" />
          <h3 className="font-bold text-sm text-[#1C1917]">Order Type Distribution</h3>
        </div>
        <span className="text-xs text-[#A8A29E]">{totalOrders} orders · ₹{totalRevenue.toLocaleString('en-IN')}</span>
      </div>

      {totalOrders === 0 ? (
        <div className="py-10 text-center">
          <ShoppingBag className="w-8 h-8 text-[#E9E0D6] mx-auto mb-2" />
          <div className="text-xs text-[#A8A29E]">No orders yet — analytics will populate as sales come in.</div>
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
                  stroke="none"
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
              <div className="text-2xl font-bold font-mono text-[#1C1917] leading-none">{totalOrders}</div>
              <div className="text-[10px] text-[#78716C] uppercase tracking-wider mt-1">orders</div>
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
                      <span className="font-semibold text-[#1C1917]">{s.name}</span>
                      <span style={{ color: s.color }}>{s.icon}</span>
                    </div>
                    <span className="font-mono text-[#57534E]">
                      {s.value} · ₹{s.revenue.toLocaleString('en-IN')} · {pct}%
                    </span>
                  </div>
                  <div className="w-full bg-[#F5F0EB] h-1.5 rounded-full overflow-hidden">
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
