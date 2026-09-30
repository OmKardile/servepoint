import React, { useState, useEffect, useRef } from 'react';
import { useTsosStore } from '../../lib/store';
import { Order, OrderItem } from '../../types';
import { playChime, play880HzChime, playCriticalAlert } from '../../lib/sound';
import { realtimeService } from '../../lib/realtimeService';
import {
  ChefHat,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Play,
  Bell,
  Utensils,
  ShoppingBag,
  Timer,
  Zap,
  Coffee,
  Soup,
  Cake,
  Check,
  Volume2,
  VolumeX,
} from 'lucide-react';
import confetti from 'canvas-confetti';

type CourseType = 'all' | 'starters_coffee' | 'mains' | 'desserts';

// Target SLA thresholds in minutes based on order type
const SLA_SETTINGS = {
  standard: {
    label: 'Standard Pace',
    takeaway: 7, // 7 minutes
    dine_in: 12, // 12 minutes
  },
  rush: {
    label: 'Rush Hour (Speed)',
    takeaway: 5, // 5 minutes
    dine_in: 9, // 9 minutes
  },
  relaxed: {
    label: 'Relaxed Pace',
    takeaway: 10,
    dine_in: 16,
  },
};

export const KdsScreen: React.FC = () => {
  const {
    orders,
    advanceOrderStatus,
    cancelOrder,
    audioEnabled,
    toggleAudio,
    location,
    currentTenant,
    handleInboundOrder,
    handleInboundOrderStatus,
    themeMode,
  } = useTsosStore();
  const isTessera = themeMode === 'tessera';
  const [, setNow] = useState(Date.now());
  const [slaMode, setSlaMode] = useState<keyof typeof SLA_SETTINGS>('standard');
  const [selectedCourse, setSelectedCourse] = useState<CourseType>('all');
  const [completedItemIds, setCompletedItemIds] = useState<Record<string, boolean>>({});

  // Audio alert tracking to prevent continuous looping alarm
  const alertedOrderIdsRef = useRef<Set<string>>(new Set());

  // Real-time Supabase WebSocket subscription for zero-reload KDS bumps
  useEffect(() => {
    const tenantId = location?.business_id || currentTenant?.id || 'biz_coolkafe_99';
    const unsub = realtimeService.subscribeToTenantRealtime(tenantId, {
      onOrderInserted: (orderPayload) => {
        if (orderPayload) {
          handleInboundOrder(orderPayload as any);
          if (audioEnabled) {
            playChime('new_order');
          }
        }
      },
      onOrderUpdated: (orderPayload) => {
        if (orderPayload?.id && orderPayload?.status) {
          handleInboundOrderStatus(orderPayload.id, orderPayload.status as any);
        }
      },
    });
    return () => unsub();
  }, [location, currentTenant, audioEnabled, handleInboundOrder, handleInboundOrderStatus]);

  // Real-time ticking every second for countdown and elapsed timers
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Detect > 10m critical tickets and play audio alert once
  useEffect(() => {
    if (!audioEnabled) return;
    const nowTime = Date.now();
    orders.forEach((o) => {
      if (o.status === 'new' || o.status === 'preparing') {
        const elapsedMin = (nowTime - new Date(o.created_at).getTime()) / 60000;
        if (elapsedMin >= 10 && !alertedOrderIdsRef.current.has(o.id)) {
          alertedOrderIdsRef.current.add(o.id);
          playCriticalAlert();
        }
      }
    });
  }, [orders, audioEnabled]);

  const activeSla = SLA_SETTINGS[slaMode];

  // Helper to categorize menu items into courses
  const getItemCourse = (itemName: string): 'starters_coffee' | 'mains' | 'desserts' => {
    const lower = itemName.toLowerCase();
    if (
      lower.includes('espresso') ||
      lower.includes('cappuccino') ||
      lower.includes('latte') ||
      lower.includes('tea') ||
      lower.includes('brew') ||
      lower.includes('coffee') ||
      lower.includes('samosa') ||
      lower.includes('vada pav') ||
      lower.includes('snack') ||
      lower.includes('fries')
    ) {
      return 'starters_coffee';
    }
    if (
      lower.includes('cake') ||
      lower.includes('pastry') ||
      lower.includes('muffin') ||
      lower.includes('cookie') ||
      lower.includes('croissant') ||
      lower.includes('brownie') ||
      lower.includes('dessert')
    ) {
      return 'desserts';
    }
    return 'mains';
  };

  // Helper to calculate order countdown and SLA status
  const getOrderSlaTimer = (order: Order) => {
    const elapsedSec = Math.max(0, Math.floor((Date.now() - new Date(order.created_at).getTime()) / 1000));
    const elapsedMins = Math.floor(elapsedSec / 60);
    const elapsedRemainderSec = elapsedSec % 60;
    const elapsedText = `${elapsedMins}m ${String(elapsedRemainderSec).padStart(2, '0')}s`;

    // Age tiers:
    // < 5 mins: Calm green
    // 5 - 10 mins: Urgent amber
    // > 10 mins: Flashing critical red
    const isCalmGreen = elapsedMins < 5;
    const isUrgentAmber = elapsedMins >= 5 && elapsedMins < 10;
    const isCriticalRed = elapsedMins >= 10;

    return {
      elapsedSec,
      elapsedMins,
      elapsedText,
      isCalmGreen,
      isUrgentAmber,
      isCriticalRed,
    };
  };

  const handleBumpTicket = (order: Order) => {
    // 1. Play 880Hz confirmation chime
    if (audioEnabled) {
      play880HzChime();
    }

    // 2. Advance status in store
    advanceOrderStatus(order.id);

    // 3. Trigger celebratory confetti if completing
    if (order.status === 'ready') {
      confetti({
        particleCount: 35,
        spread: 60,
        origin: { y: 0.8 },
        colors: ['#10B981', '#3B82F6', '#F59E0B'],
      });
    }
  };

  const toggleItemDone = (itemId: string) => {
    setCompletedItemIds((prev) => ({
      ...prev,
      [itemId]: !prev[itemId],
    }));
    if (audioEnabled) {
      play880HzChime();
    }
  };

  const filterOrderItems = (items: OrderItem[]) => {
    if (selectedCourse === 'all') return items;
    return items.filter((item) => getItemCourse(item.menu_item_name) === selectedCourse);
  };

  const filterOrdersByCourse = (orderList: Order[]) => {
    if (selectedCourse === 'all') return orderList;
    return orderList.filter((o) =>
      o.items.some((item) => getItemCourse(item.menu_item_name) === selectedCourse)
    );
  };

  const newOrders = filterOrdersByCourse(orders.filter((o) => o.status === 'new'));
  const preparingOrders = filterOrdersByCourse(orders.filter((o) => o.status === 'preparing'));
  const readyOrders = filterOrdersByCourse(orders.filter((o) => o.status === 'ready'));
  const completedCount = orders.filter((o) => o.status === 'completed').length;

  const criticalOrdersCount = orders.filter(
    (o) => (o.status === 'new' || o.status === 'preparing') && getOrderSlaTimer(o).isCriticalRed
  ).length;

  const renderTicket = (order: Order) => {
    const sla = getOrderSlaTimer(order);
    const visibleItems = filterOrderItems(order.items);
    if (visibleItems.length === 0 && selectedCourse !== 'all') return null;

    // Ticket border and accent based on status
    const borderAccent =
      order.status === 'new'
        ? 'border-blue-500/70 shadow-blue-950/30'
        : order.status === 'preparing'
        ? 'border-amber-500/70 shadow-amber-950/30'
        : 'border-emerald-500/70 shadow-emerald-950/30';

    return (
      <div
        key={order.id}
        className={`bg-[#18181B] rounded-2xl border-2 transition-all shadow-lg flex flex-col justify-between overflow-hidden ${borderAccent} ${
          sla.isCriticalRed && order.status !== 'ready'
            ? 'ring-2 ring-red-500/80 animate-pulse'
            : ''
        }`}
      >
        {/* Top Critical Alert Bar if > 10m */}
        {sla.isCriticalRed && order.status !== 'ready' && (
          <div className="bg-[#EF4444] text-white px-3 py-1 text-[11px] font-bold flex items-center justify-between tracking-wider uppercase animate-pulse">
            <span className="flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 fill-white text-[#EF4444]" />
              <span>&gt; 10 MINS • CRITICAL DELAY</span>
            </span>
            <span className="font-mono">{sla.elapsedText}</span>
          </div>
        )}

        {/* Ticket Header */}
        <div
          className={`p-3.5 border-b border-[#27272A] flex items-start justify-between gap-2 ${
            order.status === 'new'
              ? 'bg-blue-950/40'
              : order.status === 'preparing'
              ? 'bg-amber-950/40'
              : 'bg-emerald-950/40'
          }`}
        >
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono font-black text-lg text-[#FAFAFA]">
                #{order.order_number}
              </span>
              <span
                className={`text-[11px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 uppercase tracking-wide ${
                  order.order_type === 'dine_in'
                    ? 'bg-[#27272A] text-white border border-[#3F3F46]'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                }`}
              >
                {order.order_type === 'dine_in' ? (
                  <>
                    <Utensils className="w-3 h-3" />
                    <span>{order.table_label || 'Dine-In'}</span>
                  </>
                ) : (
                  <>
                    <ShoppingBag className="w-3 h-3 text-amber-400" />
                    <span>Takeaway</span>
                  </>
                )}
              </span>

              <span
                className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                  order.status === 'new'
                    ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                    : order.status === 'preparing'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                }`}
              >
                {order.status === 'new'
                  ? 'NEW'
                  : order.status === 'preparing'
                  ? 'PREPARING'
                  : 'READY'}
              </span>
            </div>

            <div className="text-[11px] text-[#A1A1AA] mt-1 font-mono">
              Server: {order.placed_by || 'POS'} {order.customer_name ? `• ${order.customer_name}` : ''}
            </div>
          </div>

          {/* Elapsed Age Timer Badges */}
          <div className="text-right shrink-0">
            <div
              className={`inline-flex items-center gap-1.5 text-xs font-mono font-bold px-2.5 py-1 rounded-xl shadow-xs transition-colors ${
                sla.isCriticalRed
                  ? 'bg-[#EF4444] text-white animate-pulse'
                  : sla.isUrgentAmber
                  ? 'bg-amber-950/80 text-amber-300 border border-amber-700/80'
                  : 'bg-emerald-950/80 text-emerald-300 border border-emerald-700/80'
              }`}
            >
              <Timer className="w-3.5 h-3.5 shrink-0" />
              <span>{sla.elapsedText}</span>
            </div>
            <div className="text-[10px] text-[#71717A] font-mono mt-0.5">
              {sla.isCalmGreen ? '< 5m Calm' : sla.isUrgentAmber ? '5-10m Warning' : '> 10m Critical'}
            </div>
          </div>
        </div>

        {/* Ticket Items List */}
        <div className="p-3.5 space-y-2 flex-1 divide-y divide-[#27272A]">
          {visibleItems.map((item) => {
            const isDone = completedItemIds[item.id] || false;
            const course = getItemCourse(item.menu_item_name);

            return (
              <div
                key={item.id}
                onClick={() => toggleItemDone(item.id)}
                className={`pt-2 first:pt-0 cursor-pointer select-none transition-all group ${
                  isDone ? 'opacity-40 line-through' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2">
                    <button
                      type="button"
                      className={`w-4 h-4 rounded-md mt-0.5 flex items-center justify-center text-xs transition-all ${
                        isDone
                          ? 'bg-emerald-500 text-black'
                          : 'border border-[#52525B] bg-[#27272A] group-hover:border-emerald-400'
                      }`}
                    >
                      {isDone && <Check className="w-3 h-3 stroke-[3]" />}
                    </button>
                    <div>
                      <span className="font-extrabold text-sm text-[#FAFAFA]">
                        {item.qty} × {item.menu_item_name}
                      </span>
                      {item.variant_name && (
                        <span className="ml-1.5 text-xs font-semibold text-amber-400">
                          ({item.variant_name})
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Course Badge */}
                  <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-[#27272A] text-[#A1A1AA] shrink-0">
                    {course === 'starters_coffee'
                      ? 'Coffee/Starter'
                      : course === 'desserts'
                      ? 'Dessert'
                      : 'Main'}
                  </span>
                </div>

                {item.addons && item.addons.length > 0 && (
                  <div className="text-xs text-[#A1A1AA] pl-6 mt-0.5">
                    + {item.addons.map((a) => a.name).join(', ')}
                  </div>
                )}

                {item.notes && (
                  <div className="text-xs text-amber-300 font-semibold italic pl-6 mt-1 bg-amber-950/30 p-1 rounded border border-amber-900/50">
                    ★ NOTE: "{item.notes}"
                  </div>
                )}
              </div>
            );
          })}

          {order.notes && (
            <div className="p-2 bg-amber-950/40 rounded-xl text-xs text-amber-300 font-medium border border-amber-900/60 mt-2">
              Order Note: {order.notes}
            </div>
          )}
        </div>

        {/* Action Bump Bar */}
        <div className="p-3 bg-[#121110] border-t border-[#27272A] flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => {
              if (window.confirm(`Void order #${order.order_number}?`)) {
                cancelOrder(order.id, 'Kitchen Void');
              }
            }}
            className="text-xs text-[#71717A] hover:text-red-400 px-2 py-2 transition-colors min-h-[44px] flex items-center"
          >
            Void
          </button>

          <button
            type="button"
            onClick={() => handleBumpTicket(order)}
            className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-black text-white shadow-md transition-all min-h-[48px] active:scale-98 ${
              order.status === 'new'
                ? 'bg-blue-600 hover:bg-blue-500 active:bg-blue-700'
                : order.status === 'preparing'
                ? 'bg-amber-600 hover:bg-amber-500 active:bg-amber-700'
                : 'bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700'
            }`}
          >
            {order.status === 'new' && (
              <>
                <Play className="w-4 h-4 fill-current" />
                <span>BUMP TO PREPARING (880Hz)</span>
              </>
            )}
            {order.status === 'preparing' && (
              <>
                <Bell className="w-4 h-4" />
                <span>BUMP TO READY</span>
              </>
            )}
            {order.status === 'ready' && (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>BUMP TO SERVED (ARCHIVE)</span>
              </>
            )}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-100px)] overflow-hidden bg-[#0C0A09] text-[#FAFAFA]">
      {/* Top Header Bar: Tessera Forest Surface */}
      <div className="p-3.5 bg-[#18181B] border-b border-[#27272A] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center border shadow-xs ${
            isTessera
              ? 'bg-[#C5F82A]/15 text-[#C5F82A] border-[#C5F82A]/30'
              : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
          }`}>
            <ChefHat className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-black text-[#FAFAFA] tracking-wide">
                Kitchen Display System (KDS)
              </h2>
              <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded border ${
                isTessera
                  ? 'bg-[#C5F82A]/10 text-[#C5F82A] border-[#C5F82A]/30 tracking-widest'
                  : 'bg-[#27272A] text-zinc-400 border-[#3F3F46]'
              }`}>
                Kitchen Display
              </span>
              {criticalOrdersCount > 0 && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-950 text-rose-300 border border-rose-600 flex items-center gap-1 animate-pulse">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {criticalOrdersCount} Critical &gt;10m
                </span>
              )}
            </div>
            <div className="text-xs text-[#A1A1AA] flex items-center gap-2 mt-0.5">
              <span>Touch any ticket item to strike off • One-tap bump with 880Hz chime</span>
            </div>
          </div>
        </div>

        {/* Controls: Course Segregation & Audio & SLA Presets */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Course Segregation Filter */}
          <div className="flex items-center bg-[#0C0A09] p-1 rounded-xl border border-[#27272A] text-xs">
            <button
              onClick={() => setSelectedCourse('all')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                selectedCourse === 'all'
                  ? 'bg-[#27272A] text-white shadow-xs'
                  : 'text-[#A1A1AA] hover:text-white'
              }`}
            >
              All Courses
            </button>
            <button
              onClick={() => setSelectedCourse('starters_coffee')}
              className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 transition-all ${
                selectedCourse === 'starters_coffee'
                  ? 'bg-amber-500/30 text-amber-300 border border-amber-500/50'
                  : 'text-[#A1A1AA] hover:text-white'
              }`}
            >
              <Coffee className="w-3.5 h-3.5" />
              <span>Coffee & Starters</span>
            </button>
            <button
              onClick={() => setSelectedCourse('mains')}
              className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 transition-all ${
                selectedCourse === 'mains'
                  ? 'bg-blue-500/30 text-blue-300 border border-blue-500/50'
                  : 'text-[#A1A1AA] hover:text-white'
              }`}
            >
              <Soup className="w-3.5 h-3.5" />
              <span>Mains</span>
            </button>
            <button
              onClick={() => setSelectedCourse('desserts')}
              className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 transition-all ${
                selectedCourse === 'desserts'
                  ? 'bg-purple-500/30 text-purple-300 border border-purple-500/50'
                  : 'text-[#A1A1AA] hover:text-white'
              }`}
            >
              <Cake className="w-3.5 h-3.5" />
              <span>Desserts</span>
            </button>
          </div>

          {/* Sound Toggle */}
          <button
            onClick={toggleAudio}
            className={`p-2 rounded-xl border text-xs flex items-center gap-1.5 transition-colors ${
              audioEnabled
                ? 'bg-emerald-950/60 text-emerald-300 border-emerald-700/60'
                : 'bg-[#27272A] text-zinc-400 border-[#3F3F46]'
            }`}
            title={audioEnabled ? '880Hz Audio Chimes Active' : 'Audio Muted'}
          >
            {audioEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            <span className="font-mono font-bold text-[11px]">{audioEnabled ? '880Hz' : 'Mute'}</span>
          </button>

          {/* Counts */}
          <div className="text-xs text-[#A1A1AA] flex items-center gap-2 pl-1 font-mono">
            <span className="flex items-center gap-1 text-blue-400 font-bold">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              {newOrders.length} New
            </span>
            <span>•</span>
            <span className="flex items-center gap-1 text-amber-400 font-bold">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              {preparingOrders.length} Prep
            </span>
            <span>•</span>
            <span className="flex items-center gap-1 text-emerald-400 font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              {readyOrders.length} Ready
            </span>
            <span>•</span>
            <span className="text-[#71717A]">{completedCount} Served</span>
          </div>
        </div>
      </div>

      {/* 3-Column Obsidian KDS Bump Bar Grid */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4 p-4 overflow-y-auto min-h-0 bg-[#0C0A09]">
        {/* Column 1: NEW (Blue) */}
        <div className="bg-[#121110] rounded-2xl border border-blue-950 p-3 flex flex-col min-h-0 shadow-inner">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-blue-900/40">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
              <h3 className="font-black text-xs uppercase tracking-wider text-blue-400">
                1. NEW TICKETS ({newOrders.length})
              </h3>
            </div>
            <span className="text-[11px] text-zinc-500 font-mono">Pending Kitchen Start</span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {newOrders.length === 0 ? (
              <div className="h-48 flex flex-col items-center justify-center text-center text-zinc-600 text-xs">
                <span>No new tickets in queue</span>
              </div>
            ) : (
              newOrders.map(renderTicket)
            )}
          </div>
        </div>

        {/* Column 2: PREPARING (Amber) */}
        <div className="bg-[#121110] rounded-2xl border border-amber-950 p-3 flex flex-col min-h-0 shadow-inner">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-amber-900/40">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              <h3 className="font-black text-xs uppercase tracking-wider text-amber-400">
                2. PREPARING / BREWING ({preparingOrders.length})
              </h3>
            </div>
            <span className="text-[11px] text-amber-600 font-mono">On the Line</span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {preparingOrders.length === 0 ? (
              <div className="h-48 flex flex-col items-center justify-center text-center text-zinc-600 text-xs">
                <span>All tickets prepped</span>
              </div>
            ) : (
              preparingOrders.map(renderTicket)
            )}
          </div>
        </div>

        {/* Column 3: READY (Green) */}
        <div className="bg-[#121110] rounded-2xl border border-emerald-950 p-3 flex flex-col min-h-0 shadow-inner">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-emerald-900/40">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <h3 className="font-black text-xs uppercase tracking-wider text-emerald-400">
                3. READY FOR PICKUP ({readyOrders.length})
              </h3>
            </div>
            <span className="text-[11px] text-emerald-600 font-mono">Notify Server</span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {readyOrders.length === 0 ? (
              <div className="h-48 flex flex-col items-center justify-center text-center text-zinc-600 text-xs">
                <span>No tickets waiting pickup</span>
              </div>
            ) : (
              readyOrders.map(renderTicket)
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
