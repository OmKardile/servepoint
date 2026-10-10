import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
  Legend,
} from 'recharts';
import { Order } from '../../types';
import { useTsosStore } from '../../lib/store';
import {
  TrendingUp,
  TrendingDown,
  Calendar,
  IndianRupee,
  ShoppingBag,
  ArrowUpRight,
  Sparkles,
  Info,
  GitCompareArrows,
} from 'lucide-react';

interface WeeklySalesLineChartProps {
  orders: Order[];
}

interface DayDataPoint {
  dayName: string;
  dayShort: string;
  dateStr: string;
  displayDate: string;
  revenue: number;
  ordersCount: number;
  avgTicket: number;
  prevRevenue: number;
  isToday: boolean;
  isFuture: boolean;
}

export const WeeklySalesLineChart: React.FC<WeeklySalesLineChartProps> = ({ orders }) => {
  const [viewMetric, setViewMetric] = useState<'revenue' | 'orders' | 'dual'>('revenue');
  const { themeMode } = useTsosStore();
  const isServepoint = themeMode === 'servepoint';

  // Compute the 7 days of the current week (Monday through Sunday)
  const { weekData, weeklyTotal, dailyAvg, peakDay, totalWeekOrders, prevWeekTotal, wowDeltaPct, hasPrevWeekData } = useMemo(() => {
    const now = new Date();
    // Monday = 0, ..., Sunday = 6
    const currentDayOfWeek = (now.getDay() + 6) % 7;

    const monday = new Date(now);
    monday.setDate(now.getDate() - currentDayOfWeek);
    monday.setHours(0, 0, 0, 0);

    const safeOrders = (orders || []).filter((o) => o && o.status !== 'cancelled');

    const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const dayShorts = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    // Revenue for a given calendar date key.
    const revenueForDate = (dateKey: string) =>
      safeOrders
        .filter((o) => {
          if (!o.created_at) return false;
          const oDate = new Date(o.created_at);
          const oMonth = String(oDate.getMonth() + 1).padStart(2, '0');
          const oDay = String(oDate.getDate()).padStart(2, '0');
          return `${oDate.getFullYear()}-${oMonth}-${oDay}` === dateKey;
        })
        .reduce((acc, o) => acc + (o.grand_total || 0), 0);

    const data: DayDataPoint[] = [];
    let weekSum = 0;
    let weekOrders = 0;
    let maxRev = -1;
    let bestDayName = 'Friday';
    let prevWeekSum = 0;

    for (let i = 0; i < 7; i++) {
      const dayDate = new Date(monday);
      dayDate.setDate(monday.getDate() + i);

      const year = dayDate.getFullYear();
      const month = String(dayDate.getMonth() + 1).padStart(2, '0');
      const dayNum = String(dayDate.getDate()).padStart(2, '0');
      const dateKey = `${year}-${month}-${dayNum}`;

      const isToday = i === currentDayOfWeek;
      const isFuture = i > currentDayOfWeek;

      const dayRevenue = revenueForDate(dateKey);
      const daysOrders = safeOrders.filter((o) => {
        if (!o.created_at) return false;
        const oDate = new Date(o.created_at);
        const oMonth = String(oDate.getMonth() + 1).padStart(2, '0');
        const oDay = String(oDate.getDate()).padStart(2, '0');
        return `${oDate.getFullYear()}-${oMonth}-${oDay}` === dateKey;
      });
      const ordersCount = daysOrders.length;
      const avgTicket = ordersCount > 0 ? Math.round(dayRevenue / ordersCount) : 0;

      // Same weekday LAST week (for the comparison curve).
      const prevDate = new Date(dayDate);
      prevDate.setDate(dayDate.getDate() - 7);
      const pMonth = String(prevDate.getMonth() + 1).padStart(2, '0');
      const pDay = String(prevDate.getDate()).padStart(2, '0');
      const prevRevenue = revenueForDate(`${prevDate.getFullYear()}-${pMonth}-${pDay}`);
      prevWeekSum += prevRevenue;

      if (!isFuture) {
        weekSum += dayRevenue;
        weekOrders += ordersCount;
        if (dayRevenue > maxRev) {
          maxRev = dayRevenue;
          bestDayName = dayNames[i];
        }
      }

      data.push({
        dayName: dayNames[i],
        dayShort: `${dayShorts[i]} ${dayDate.getDate()}`,
        dateStr: dateKey,
        displayDate: dayDate.toLocaleDateString('en-IN', {
          month: 'short',
          day: 'numeric',
          weekday: 'short',
        }),
        revenue: Math.round(dayRevenue),
        ordersCount,
        avgTicket,
        prevRevenue: Math.round(prevRevenue),
        isToday,
        isFuture,
      });
    }

    const activeDaysCount = Math.max(1, currentDayOfWeek + 1);
    const calculatedAvg = Math.round(weekSum / activeDaysCount);
    const deltaPct =
      prevWeekSum > 0 ? Math.round(((weekSum - prevWeekSum) / prevWeekSum) * 100) : null;

    return {
      weekData: data,
      weeklyTotal: weekSum,
      dailyAvg: calculatedAvg,
      peakDay: `${bestDayName} (₹${Math.max(0, maxRev).toLocaleString()})`,
      totalWeekOrders: weekOrders,
      prevWeekTotal: prevWeekSum,
      wowDeltaPct: deltaPct,
      hasPrevWeekData: prevWeekSum > 0,
    };
  }, [orders]);

  // Custom Chart Tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data: DayDataPoint = payload[0].payload;
      return (
        <div
          className={`p-3.5 rounded-xl shadow-xl text-xs space-y-2 min-w-[190px] ${
            isServepoint
              ? 'bg-white border border-[#E3E7E0] text-[#1A1A1A]'
              : 'bg-[#1C1917] text-white border border-[#44403C]'
          }`}
        >
          <div className={`flex items-center justify-between border-b pb-1.5 ${isServepoint ? 'border-[#E3E7E0]' : 'border-[#44403C]'}`}>
            <span className={`font-bold text-sm ${isServepoint ? 'text-[#1A1A1A]' : 'text-[#FFF9F2]'}`}>{data.displayDate}</span>
            {data.isToday && (
              <span
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                  isServepoint ? 'bg-[#B88E2F] text-white' : 'bg-[#F97316] text-white'
                }`}
              >
                Today
              </span>
            )}
            {data.isFuture && (
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                  isServepoint ? 'bg-[#F6F5F2] text-[#969696] border border-[#E3E7E0]' : 'bg-[#57534E] text-[#D6D3D1]'
                }`}
              >
                Upcoming
              </span>
            )}
          </div>

          <div className="space-y-1.5 pt-0.5">
            <div className="flex items-center justify-between">
              <span className={`${isServepoint ? 'text-[#6B6B6B]' : 'text-[#A8A29E]'} flex items-center gap-1.5`}>
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: isServepoint ? '#0F3D3E' : '#F97316' }} />
                Daily Sales Revenue:
              </span>
              <span
                className={`font-bold text-sm ${isServepoint ? 'text-[#0F3D3E]' : 'font-mono text-[#F97316]'}`}
              >
                ₹{data.revenue.toLocaleString()}
              </span>
            </div>

            {data.prevRevenue > 0 && (viewMetric === 'revenue' || viewMetric === 'dual') && (
              <div className="flex items-center justify-between">
                <span className={`${isServepoint ? 'text-[#969696]' : 'text-[#A8A29E]'} flex items-center gap-1.5`}>
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: isServepoint ? '#8FA99B' : '#D6D3D1' }} />
                  Same day last week:
                </span>
                <span className={`font-semibold ${isServepoint ? 'text-[#6B6B6B]' : 'font-mono text-[#E7E5E4]'}`}>
                  ₹{data.prevRevenue.toLocaleString()}
                </span>
              </div>
            )}

            <div className="flex items-center justify-between">
              <span className={`${isServepoint ? 'text-[#6B6B6B]' : 'text-[#A8A29E]'} flex items-center gap-1.5`}>
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: isServepoint ? '#B88E2F' : '#0284C7' }} />
                Orders Placed:
              </span>
              <span className={`font-semibold ${isServepoint ? 'text-[#1A1A1A]' : 'font-mono text-white'}`}>
                {data.ordersCount} orders
              </span>
            </div>

            {data.ordersCount > 0 && (
              <div className={`flex items-center justify-between pt-1 border-t text-[11px] ${isServepoint ? 'border-[#E3E7E0]' : 'border-[#292524]'}`}>
                <span className={isServepoint ? 'text-[#6B6B6B]' : 'text-[#A8A29E]'}>Avg Ticket Size:</span>
                <span className={isServepoint ? 'text-[#1A1A1A]' : 'font-mono text-[#E7E5E4]'}>₹{data.avgTicket} / bill</span>
              </div>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  const revenueStroke = isServepoint ? '#0F3D3E' : '#F97316';
  const ordersStroke = isServepoint ? '#B88E2F' : '#0284C7';
  const prevWeekStroke = isServepoint ? '#8FA99B' : '#D6D3D1';

  return (
    <div
      className={`p-5 rounded-2xl shadow-xs space-y-4 ${
        isServepoint ? 'bg-white border border-[#E3E7E0]' : 'bg-white border border-[#E9E0D6]'
      }`}
    >
      {/* Header & Controls */}
      <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b ${isServepoint ? 'border-[#E3E7E0]' : 'border-[#F5F0EB]'}`}>
        <div>
          <div className="flex items-center gap-2">
            <div
              className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                isServepoint ? 'bg-[#D9E2DD] text-[#0F3D3E]' : 'bg-[#FFF1E6] text-[#F97316]'
              }`}
            >
              <TrendingUp className="w-4 h-4" />
            </div>
            <h3 className={`font-bold text-sm ${isServepoint ? 'text-[#1A1A1A]' : 'text-[#1C1917]'}`}>
              Current Week Daily Sales & Revenue Trend
            </h3>
          </div>
          <p className={`text-xs mt-0.5 ml-9 ${isServepoint ? 'text-[#6B6B6B]' : 'text-[#57534E]'}`}>
            Day-by-day gross sales curve (Monday to Sunday) with daily averages
          </p>
        </div>

        {/* Metric Mode Switcher */}
        <div
          className={`flex items-center gap-1 p-1 rounded-xl self-start sm:self-auto text-xs font-semibold ${
            isServepoint ? 'bg-[#D9E2DD]/70 border border-[#E3E7E0]' : 'bg-[#F5F0EB]'
          }`}
        >
          {(['revenue', 'orders', 'dual'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setViewMetric(m)}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                viewMetric === m
                  ? isServepoint
                    ? 'bg-white text-[#0F3D3E] shadow-xs'
                    : 'bg-white text-[#1C1917] shadow-xs'
                  : isServepoint
                  ? 'text-[#6B6B6B] hover:text-[#1A1A1A]'
                  : 'text-[#57534E] hover:text-[#1C1917]'
              }`}
            >
              {m === 'revenue' ? 'Revenue (₹)' : m === 'orders' ? 'Order Volume' : 'Dual Trend'}
            </button>
          ))}
        </div>
      </div>

      {/* Metric Highlights Strip */}
      <div
        className={`grid grid-cols-2 md:grid-cols-4 gap-3 p-3.5 rounded-xl border ${
          isServepoint ? 'bg-[#F6F5F2] border-[#E3E7E0]' : 'bg-[#FFFDF9] border-[#E9E0D6]'
        }`}
      >
        <div className="space-y-0.5">
          <div className={`text-[11px] flex items-center gap-1 ${isServepoint ? 'text-[#6B6B6B]' : 'text-[#57534E]'}`}>
            <Calendar className={`w-3 h-3 ${isServepoint ? 'text-[#B88E2F]' : 'text-[#F97316]'}`} />
            <span>Week-to-Date Gross</span>
          </div>
          <div className={`text-lg font-bold ${isServepoint ? 'text-[#1A1A1A]' : 'font-mono text-[#1C1917]'}`}>
            ₹{weeklyTotal.toLocaleString()}
          </div>
        </div>

        <div className="space-y-0.5">
          <div className={`text-[11px] flex items-center gap-1 ${isServepoint ? 'text-[#6B6B6B]' : 'text-[#57534E]'}`}>
            <IndianRupee className={`w-3 h-3 ${isServepoint ? 'text-[#17803D]' : 'text-[#17803D]'}`} />
            <span>Daily Average</span>
          </div>
          <div className={`text-lg font-bold ${isServepoint ? 'text-[#1A1A1A]' : 'font-mono text-[#1C1917]'}`}>
            ₹{dailyAvg.toLocaleString()} <span className={`text-[10px] ${isServepoint ? 'text-[#969696]' : 'text-[#78716C]'}`}>/ day</span>
          </div>
        </div>

        <div className="space-y-0.5">
          <div className={`text-[11px] flex items-center gap-1 ${isServepoint ? 'text-[#6B6B6B]' : 'text-[#57534E]'}`}>
            <Sparkles className={`w-3 h-3 ${isServepoint ? 'text-[#967221]' : 'text-[#B45309]'}`} />
            <span>Peak Day</span>
          </div>
          <div className={`text-sm font-bold truncate ${isServepoint ? 'text-[#967221]' : 'font-mono text-[#B45309]'}`}>
            {peakDay}
          </div>
        </div>

        {/* Total Orders + WoW delta chip (new) */}
        <div className="space-y-0.5">
          <div className={`text-[11px] flex items-center gap-1 ${isServepoint ? 'text-[#6B6B6B]' : 'text-[#57534E]'}`}>
            <ShoppingBag className={`w-3 h-3 ${isServepoint ? 'text-[#0F3D3E]' : 'text-[#0284C7]'}`} />
            <span>Total Orders</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className={`text-lg font-bold ${isServepoint ? 'text-[#0F3D3E]' : 'font-mono text-[#0284C7]'}`}>
              {totalWeekOrders} <span className={`text-[10px] ${isServepoint ? 'text-[#969696]' : 'text-[#78716C]'}`}>placed</span>
            </div>
            {wowDeltaPct !== null && hasPrevWeekData && (
              <span
                title={`vs ₹${prevWeekTotal.toLocaleString()} last week`}
                className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  isServepoint
                    ? wowDeltaPct >= 0
                      ? 'bg-[#17803D]/12 text-[#17803D] border border-[#17803D]/25'
                      : 'bg-[#DC2626]/10 text-[#DC2626] border border-[#DC2626]/25'
                    : wowDeltaPct >= 0
                    ? 'bg-[#E8F5EC] text-[#17803D]'
                    : 'bg-[#FEE2E2] text-[#B91C1C]'
                }`}
              >
                {wowDeltaPct >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {wowDeltaPct >= 0 ? '+' : ''}{wowDeltaPct}% WoW
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Recharts Line Chart */}
      <div className="w-full h-72 pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={weekData} margin={{ top: 15, right: 20, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={isServepoint ? '#E3E7E0' : '#F0E8DF'} vertical={false} />
            <XAxis
              dataKey="dayShort"
              tick={{ fill: isServepoint ? '#6B6B6B' : '#57534E', fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: isServepoint ? '#E3E7E0' : '#E9E0D6' }}
            />
            <YAxis
              yAxisId="left"
              tick={{ fill: isServepoint ? '#6B6B6B' : '#57534E', fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: isServepoint ? '#E3E7E0' : '#E9E0D6' }}
              tickFormatter={(val) => `₹${val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val}`}
            />
            {(viewMetric === 'orders' || viewMetric === 'dual') && (
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fill: ordersStroke, fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: isServepoint ? '#E3E7E0' : '#BAE6FD' }}
                allowDecimals={false}
              />
            )}

            <Tooltip content={<CustomTooltip />} />

            {/* Reference Line for Daily Average */}
            {viewMetric !== 'orders' && dailyAvg > 0 && (
              <ReferenceLine
                yAxisId="left"
                y={dailyAvg}
                stroke={isServepoint ? '#B88E2F' : '#F97316'}
                strokeDasharray="4 4"
                strokeOpacity={0.6}
                label={{
                  value: `Daily Avg: ₹${dailyAvg}`,
                  position: 'insideTopRight',
                  fill: isServepoint ? '#967221' : '#F97316',
                  fontSize: 10,
                  fontWeight: 600,
                }}
              />
            )}

            {/* Last Week Comparison (dashed, new) */}
            {hasPrevWeekData && (viewMetric === 'revenue' || viewMetric === 'dual') && (
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="prevRevenue"
                name="Last Week (₹)"
                stroke={prevWeekStroke}
                strokeWidth={2}
                strokeDasharray="6 4"
                dot={false}
                activeDot={{ r: 4, fill: prevWeekStroke, stroke: '#FFFFFF', strokeWidth: 2 }}
              />
            )}

            {/* Revenue Line */}
            {(viewMetric === 'revenue' || viewMetric === 'dual') && (
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="revenue"
                name="Daily Sales (₹)"
                stroke={revenueStroke}
                strokeWidth={3}
                dot={{ r: 4, fill: revenueStroke, stroke: '#FFFFFF', strokeWidth: 2 }}
                activeDot={{ r: 7, fill: revenueStroke, stroke: isServepoint ? '#D9E2DD' : '#FFF1E6', strokeWidth: 3 }}
              />
            )}

            {/* Orders Line */}
            {(viewMetric === 'orders' || viewMetric === 'dual') && (
              <Line
                yAxisId={viewMetric === 'dual' ? 'right' : 'left'}
                type="monotone"
                dataKey="ordersCount"
                name="Order Count"
                stroke={ordersStroke}
                strokeWidth={2.5}
                strokeDasharray={viewMetric === 'dual' ? '5 5' : undefined}
                dot={{ r: 4, fill: ordersStroke, stroke: '#FFFFFF', strokeWidth: 2 }}
                activeDot={{ r: 6, fill: ordersStroke, stroke: isServepoint ? '#F6F5F2' : '#E0F2FE', strokeWidth: 3 }}
              />
            )}

            <Legend
              verticalAlign="bottom"
              wrapperStyle={{ paddingTop: 10, fontSize: 12, color: isServepoint ? '#6B6B6B' : '#57534E' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Chart Footer Insight */}
      <div
        className={`flex items-center justify-between text-xs p-2.5 rounded-xl border ${
          isServepoint ? 'text-[#6B6B6B] bg-[#F6F5F2] border-[#E3E7E0]' : 'text-[#57534E] bg-[#FFF9F2] border-[#E9E0D6]'
        }`}
      >
        <div className="flex items-center gap-1.5">
          <Info className={`w-3.5 h-3.5 shrink-0 ${isServepoint ? 'text-[#B88E2F]' : 'text-[#F97316]'}`} />
          <span>
            Real-time synchronization: Any new order checked out in POS or QR storefront instantly updates today's sales data.
          </span>
        </div>
        <div className={`flex items-center gap-1 font-semibold shrink-0 ml-2 ${isServepoint ? 'text-[#17803D]' : 'text-[#17803D]'}`}>
          <ArrowUpRight className="w-3.5 h-3.5" />
          <span>7-Day Cycle Active</span>
        </div>
      </div>

      {/* WoW legend footnote (new, only when comparison active) */}
      {hasPrevWeekData && viewMetric !== 'orders' && (
        <div className={`flex items-center gap-1.5 text-[11px] ${isServepoint ? 'text-[#969696]' : 'text-[#A8A29E]'}`}>
          <GitCompareArrows className="w-3.5 h-3.5" />
          <span>
            Dashed curve shows the same weekday last week — week-to-date ₹{weeklyTotal.toLocaleString()} vs ₹{prevWeekTotal.toLocaleString()}
            {wowDeltaPct !== null ? ` (${wowDeltaPct >= 0 ? '+' : ''}${wowDeltaPct}% WoW).` : '.'}
          </span>
        </div>
      )}
    </div>
  );
};
