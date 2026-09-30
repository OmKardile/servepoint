import React, { useState, useEffect } from 'react';
import { useTsosStore } from '../../lib/store';
import { MenuItem, Order } from '../../types';
import { CartDrawer } from './CartDrawer';
import { VariantModal } from './VariantModal';
import { PaymentModal } from './PaymentModal';
import { ReceiptModal } from './ReceiptModal';
import { ManualPrintReceiptModal } from './ManualPrintReceiptModal';
import { GuidanceTooltip } from '../common/GuidanceTooltip';
import { realtimeService } from '../../lib/realtimeService';
import {
  Search,
  Coffee,
  CupSoda,
  Utensils,
  Croissant,
  Plus,
  SlidersHorizontal,
  Check,
  CheckCircle2,
  Printer,
  Bluetooth,
  AlertTriangle,
  Clock,
  User,
  ShieldCheck,
  Landmark,
  CircleDot,
} from 'lucide-react';

export const PosScreen: React.FC = () => {
  const {
    location,
    currentTenant,
    currentProfile,
    shifts,
    categories,
    menuItems,
    addToCart,
    feeConfig,
    cart,
    appliedOffer,
    redeemedPoints,
    ingredients,
    recipes,
    handleInboundOrder,
    handleInboundTableStatus,
    themeMode,
  } = useTsosStore();

  const isTessera = themeMode === 'tessera';

  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [vegOnly, setVegOnly] = useState(false);
  const [clockTime, setClockTime] = useState<string>('');

  useEffect(() => {
    setClockTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    const timer = setInterval(() => {
      setClockTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Real-time Supabase WebSocket subscription for live POS table and order updates
  useEffect(() => {
    const tenantId = location?.business_id || currentTenant?.id || 'biz_coolkafe_99';
    const unsub = realtimeService.subscribeToTenantRealtime(tenantId, {
      onOrderInserted: (orderPayload) => {
        if (orderPayload) {
          handleInboundOrder(orderPayload as any);
        }
      },
      onTableUpdated: (tablePayload) => {
        if (tablePayload?.id && tablePayload?.status) {
          handleInboundTableStatus(tablePayload.id, tablePayload.status as any);
        }
      },
    });
    return () => unsub();
  }, [location, currentTenant, handleInboundOrder, handleInboundTableStatus]);

  // Modals state
  const [customizingItem, setCustomizingItem] = useState<MenuItem | null>(null);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [completedOrder, setCompletedOrder] = useState<Order | null>(null);
  const [isManualPrintOpen, setIsManualPrintOpen] = useState(false);

  // Icon mapping
  const getCategoryIcon = (name: string) => {
    switch (name.toLowerCase()) {
      case 'coffee':
        return <Coffee className="w-4 h-4" />;
      case 'tea':
        return <CupSoda className="w-4 h-4" />;
      case 'snacks':
        return <Utensils className="w-4 h-4" />;
      case 'pastries':
        return <Croissant className="w-4 h-4" />;
      default:
        return <Coffee className="w-4 h-4" />;
    }
  };

  // Filter items
  const safeMenuItems = menuItems || [];
  const filteredItems = safeMenuItems.filter((item) => {
    if (!item.is_available) return false;
    if (selectedCategoryId !== 'all' && item.category_id !== selectedCategoryId) return false;
    if (vegOnly && !item.is_veg) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        item.name.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleItemClick = (item: MenuItem) => {
    // If item has variants or addons, open customize modal
    const hasVariants = item.variants && item.variants.length > 0;
    const hasAddons = item.addon_ids && item.addon_ids.length > 0;

    if (hasVariants || hasAddons) {
      setCustomizingItem(item);
    } else {
      addToCart(item);
    }
  };

  // Math calculations for payment modal
  const safeCart = cart || [];
  const subtotal = safeCart.reduce((acc, item) => acc + item.item_total, 0);
  const taxTotal = +(subtotal * 0.05).toFixed(2);

  let discountTotal = 0;
  if (appliedOffer) {
    if (appliedOffer.type === 'percent') {
      discountTotal = +(subtotal * (appliedOffer.value / 100)).toFixed(2);
    } else if (appliedOffer.type === 'flat') {
      discountTotal = Math.min(subtotal, appliedOffer.value);
    }
  }
  if (redeemedPoints > 0) {
    discountTotal += redeemedPoints;
  }

  const feePayer = feeConfig.default_fee_payer;
  const platformFee = feeConfig.per_order_fee;
  const grandTotal = Math.max(
    0,
    +(subtotal + taxTotal - discountTotal + (feePayer === 'customer' ? platformFee : 0)).toFixed(2)
  );

  return (
    <div className={`flex-1 flex flex-col lg:flex-row h-[calc(100vh-100px)] overflow-hidden ${
      isTessera ? 'bg-[#0A1410]' : 'bg-[#FFF9F2]'
    }`}>
      {/* Menu Catalog Section */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* POS Operational Status Ribbon */}
        <div className={`px-4 py-2 text-xs flex flex-wrap items-center justify-between gap-2 select-none ${
          isTessera ? 'bg-[#0F1D17] border-b border-[#1F3D2E] text-[#F5F4EE]' : 'bg-[#1C1917] text-white shadow-xs'
        }`}>
          <div className="flex items-center gap-3">
            <span className={`flex items-center gap-1.5 font-bold ${isTessera ? 'text-[#C5F82A]' : 'text-[#F97316]'}`}>
              <span className="w-2 h-2 rounded-full bg-[#16A34A] animate-pulse" />
              <span>{location.name}</span>
            </span>
            <span className={isTessera ? 'text-[#2A4A37]' : 'text-white/30'}>|</span>
            <span className={`flex items-center gap-1.5 ${isTessera ? 'text-[#9BB5A5]' : 'text-stone-300'}`}>
              <User className={`w-3.5 h-3.5 ${isTessera ? 'text-[#C5F82A]' : 'text-[#F97316]'}`} />
              <span>Cashier: <strong>{currentProfile.name}</strong></span>
            </span>
            <span className={`${isTessera ? 'text-[#2A4A37]' : 'text-white/30'} hidden sm:inline`}>|</span>
            <span className={`hidden sm:flex items-center gap-1.5 ${isTessera ? 'text-[#9BB5A5]' : 'text-stone-300'}`}>
              <Clock className={`w-3.5 h-3.5 ${isTessera ? 'text-[#34D399]' : 'text-emerald-400'}`} />
              <span>Shift active (Active)</span>
            </span>
          </div>

          <div className="flex items-center gap-3 font-mono text-[11px]">
            <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md ${
              isTessera ? 'bg-[#34D399]/10 border border-[#34D399]/30 text-[#34D399]' : 'bg-white/10 text-emerald-300'
            }`}>
              <Landmark className="w-3.5 h-3.5" />
              <span>Drawer: ₹2,500 float</span>
            </div>
            <div className={`px-2 py-0.5 rounded-md font-bold tracking-wider ${
              isTessera ? 'bg-[#C5F82A]/10 border border-[#C5F82A]/30 text-[#C5F82A] tabular-nums' : 'bg-white/15 text-stone-200'
            }`}>
              {clockTime || '00:00:00'}
            </div>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className={`p-4 border-b flex flex-wrap items-center justify-between gap-3 ${
          isTessera ? 'bg-[#0F1D17] border-[#1F3D2E]' : 'bg-white border-[#E9E0D6]'
        }`}>
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 ${isTessera ? 'text-[#6B8579]' : 'text-[#A8A29E]'}`} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search dishes, drinks, scan barcode... (Ctrl+K)"
              className={`w-full pl-9 pr-4 py-2 text-sm rounded-xl border transition-all focus:outline-hidden ${
                isTessera
                  ? 'border-[#2A4A37] bg-[#0A1410] focus:bg-[#142620] focus:border-[#C5F82A] text-[#F5F4EE] placeholder:text-[#6B8579]'
                  : 'border-[#E9E0D6] bg-[#FFF9F2] focus:bg-white focus:border-[#F97316] text-[#1C1917]'
              }`}
            />
          </div>

          <div className="flex items-center gap-2">
            {/* Veg Only Toggle */}
            <button
              onClick={() => setVegOnly(!vegOnly)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
                vegOnly
                  ? isTessera
                    ? 'border-[#34D399]/50 bg-[#34D399]/15 text-[#34D399]'
                    : 'border-emerald-600 bg-emerald-50 text-emerald-800'
                  : isTessera
                  ? 'border-[#2A4A37] bg-transparent text-[#9BB5A5] hover:text-[#F5F4EE] hover:border-[#2A4A37] hover:bg-[#142620]'
                  : 'border-[#E9E0D6] bg-white text-[#57534E] hover:bg-[#F5F0EB]'
              }`}
            >
              <span className={`w-3.5 h-3.5 rounded-xs border flex items-center justify-center p-0.5 ${
                vegOnly ? (isTessera ? 'border-[#34D399]' : 'border-emerald-600') : isTessera ? 'border-[#6B8579]' : 'border-emerald-600'
              }`}>
                <span className={`w-2 h-2 rounded-full ${
                  vegOnly ? (isTessera ? 'bg-[#34D399]' : 'bg-emerald-600') : isTessera ? 'bg-[#6B8579]' : 'bg-emerald-600'
                }`} />
              </span>
              <span>Pure Veg Only</span>
            </button>

            {/* Manual Print Receipt Module Button */}
            <button
              onClick={() => setIsManualPrintOpen(true)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
                isTessera
                  ? 'border-[#2A4A37] bg-[#0F1D17] text-[#F5F4EE] hover:border-[#C5F82A]/60 hover:text-[#C5F82A]'
                  : 'border-[#D5C9BD] bg-white hover:bg-[#F5F0EB] text-[#1C1917] shadow-xs'
              }`}
              title="Manual 'Print Receipt' Module (Web Bluetooth thermal printing & order summary formatting)"
            >
              <Printer className={`w-3.5 h-3.5 ${isTessera ? 'text-[#C5F82A]' : 'text-[#F97316]'}`} />
              <span>Print Receipt</span>
              <span className={`flex items-center gap-0.5 text-[10px] px-1.5 py-0.2 rounded-md font-mono border ${
                isTessera ? 'text-[#60A5FA] bg-[#60A5FA]/10 border-[#60A5FA]/30' : 'text-blue-700 bg-blue-50 border-blue-200'
              }`}>
                <Bluetooth className="w-2.5 h-2.5" /> BT
              </span>
            </button>
          </div>
        </div>

        {/* Category Tabs */}
        <GuidanceTooltip guideKey="pos_category_nav" position="bottom" className="w-full">
          <div className={`px-4 py-2 border-b flex items-center gap-2 overflow-x-auto no-scrollbar w-full ${
            isTessera ? 'bg-[#0F1D17] border-[#1F3D2E]' : 'bg-white border-[#E9E0D6]'
          }`}>
            <button
              onClick={() => setSelectedCategoryId('all')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                selectedCategoryId === 'all'
                  ? isTessera
                    ? 'bg-[#C5F82A] text-[#0A1410] shadow-[2px_2px_0_#1F3D2E]'
                    : 'bg-[#1C1917] text-white shadow-xs'
                  : isTessera
                  ? 'bg-[#142620] text-[#9BB5A5] border border-[#2A4A37] hover:text-[#F5F4EE] hover:border-[#C5F82A]/40'
                  : 'bg-[#F5F0EB] text-[#57534E] hover:bg-[#E9E0D6]'
              }`}
            >
              All Items ({menuItems.filter((i) => i.is_available).length})
            </button>

            {categories.map((cat) => {
              const count = menuItems.filter(
                (i) => i.category_id === cat.id && i.is_available
              ).length;
              const isSelected = selectedCategoryId === cat.id;

              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategoryId(cat.id)}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                    isSelected
                      ? isTessera
                        ? 'bg-[#C5F82A] text-[#0A1410] shadow-[2px_2px_0_#1F3D2E]'
                        : 'bg-[#F97316] text-white shadow-xs'
                      : isTessera
                      ? 'bg-[#142620] text-[#9BB5A5] border border-[#2A4A37] hover:text-[#F5F4EE] hover:border-[#C5F82A]/40'
                      : 'bg-[#F5F0EB] text-[#57534E] hover:bg-[#E9E0D6]'
                  }`}
                >
                  {getCategoryIcon(cat.name)}
                  <span>{cat.name}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                      isSelected
                        ? isTessera ? 'bg-[#0A1410]/20 text-[#0A1410]' : 'bg-black/20 text-white'
                        : isTessera ? 'bg-[#0A1410] text-[#6B8579] border border-[#2A4A37]' : 'bg-[#E9E0D6] text-[#57534E]'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </GuidanceTooltip>

        {/* Menu Items Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {filteredItems.length === 0 ? (
            <div className={`h-64 flex flex-col items-center justify-center text-center ${
              isTessera ? 'text-[#6B8579]' : 'text-[#A8A29E]'
            }`}>
              <Coffee className={`w-10 h-10 mb-2 ${isTessera ? 'text-[#1F3D2E]' : 'text-[#E9E0D6]'}`} />
              <div className={`font-serif italic text-xl ${isTessera ? 'text-[#F5F4EE]' : 'text-[#57534E] font-sans font-semibold text-sm not-italic'}`}>
                No matching items found
              </div>
              <div className={`text-xs mt-1 ${isTessera ? 'text-[#6B8579]' : 'text-[#A8A29E]'}`}>
                Try clearing your search query or toggling filters.
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3.5">
              {filteredItems.map((item) => {
                const hasVariants = item.variants && item.variants.length > 0;
                const hasAddons = item.addon_ids && item.addon_ids.length > 0;

                // Recipe BOM check for reorder point threshold
                const itemRecipes = (recipes || []).filter((r) => r.menu_item_id === item.id);
                const lowStockIng = itemRecipes
                  .map((r) => (ingredients || []).find((ing) => ing.id === r.ingredient_id))
                  .find((ing) => ing && ing.stock_qty <= ing.low_stock_threshold);

                return (
                  <div
                    key={item.id}
                    onClick={() => handleItemClick(item)}
                    className={`group rounded-2xl transition-all cursor-pointer overflow-hidden flex flex-col justify-between relative ${
                      isTessera
                        ? 'bg-[#0F1D17] border border-[#1F3D2E] hover:border-[#C5F82A]/50 hover:shadow-[0_8px_24px_-8px_rgba(0,0,0,0.6),0_0_0_1px_rgba(197,248,42,0.15)] hover:-translate-y-0.5'
                        : 'bg-white border border-[#E9E0D6] hover:border-[#F97316]/50 hover:shadow-md'
                    }`}
                  >
                    <div className="p-3">
                      <div className={`relative aspect-video w-full rounded-xl overflow-hidden mb-2.5 ${
                        isTessera ? 'bg-[#142620]' : 'bg-[#F5F0EB]'
                      }`}>
                        <img
                          src={item.image_url}
                          alt={item.name}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        {/* Veg / Non-Veg Indicator */}
                        <div className={`absolute top-2 left-2 p-1 rounded-md shadow-xs ${
                          isTessera ? 'bg-[#0A1410]/85 backdrop-blur-xs' : 'bg-white/90 backdrop-blur-xs'
                        }`}>
                          <span
                            className={`w-3 h-3 rounded-xs border flex items-center justify-center p-0.5 ${
                              item.is_veg
                                ? isTessera ? 'border-[#34D399]' : 'border-emerald-600'
                                : isTessera ? 'border-[#F87171]' : 'border-red-600'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                item.is_veg
                                  ? isTessera ? 'bg-[#34D399]' : 'bg-emerald-600'
                                  : isTessera ? 'bg-[#F87171]' : 'bg-red-600'
                              }`}
                            />
                          </span>
                        </div>

                        {/* Reorder Point Low Stock Badge */}
                        {lowStockIng && (
                          <div
                            className={`absolute top-2 right-2 px-2 py-0.5 rounded-md text-[9px] font-bold flex items-center gap-1 backdrop-blur-xs shadow-xs ${
                              isTessera
                                ? 'bg-[#FBBF24]/90 text-[#0A1410]'
                                : 'bg-amber-500 text-white'
                            }`}
                            title={`Reorder Point Breached: ${lowStockIng.name} has only ${lowStockIng.stock_qty}${lowStockIng.unit} left (threshold: ${lowStockIng.low_stock_threshold}${lowStockIng.unit})`}
                          >
                            <AlertTriangle className="w-2.5 h-2.5" />
                            <span>Low: {lowStockIng.name.split(' ')[0]}</span>
                          </div>
                        )}

                        {/* Variants or Customize Badge */}
                        {(hasVariants || hasAddons) && !lowStockIng && (
                          <div className={`absolute bottom-2 right-2 px-2 py-0.5 rounded-md text-[10px] font-bold backdrop-blur-xs ${
                            isTessera
                              ? 'bg-[#0A1410]/85 text-[#C5F82A] border border-[#C5F82A]/30 uppercase tracking-wider'
                              : 'bg-[#1C1917]/80 text-white'
                          }`}>
                            Customizable
                          </div>
                        )}
                      </div>

                      <h3 className={`font-bold text-sm leading-snug transition-colors line-clamp-1 ${
                        isTessera ? 'text-[#F5F4EE] group-hover:text-[#C5F82A]' : 'text-[#1C1917] group-hover:text-[#F97316]'
                      }`}>
                        {item.name}
                      </h3>
                      <p className={`text-xs mt-1 line-clamp-2 leading-relaxed ${
                        isTessera ? 'text-[#9BB5A5]' : 'text-[#57534E]'
                      }`}>
                        {item.description}
                      </p>
                    </div>

                    <div className={`px-3 pb-3 pt-1 border-t flex items-center justify-between ${
                      isTessera ? 'border-[#1F3D2E]' : 'border-[#F5F0EB]'
                    }`}>
                      <div>
                        <span className={`text-xs ${isTessera ? 'text-[#6B8579]' : 'text-[#57534E]'}`}>Starts at</span>
                        <div className={`font-mono font-bold text-base tabular-nums ${
                          isTessera ? 'text-[#C5F82A]' : 'text-[#1C1917]'
                        }`}>
                          ₹{item.price}
                        </div>
                      </div>

                      <button
                        type="button"
                        className={`flex items-center gap-1 px-3 py-1.5 rounded-xl font-semibold text-xs transition-colors shadow-xs ${
                          isTessera
                            ? 'bg-[#C5F82A]/15 border border-[#C5F82A]/40 text-[#C5F82A] hover:bg-[#C5F82A] hover:text-[#0A1410]'
                            : 'bg-[#FFF1E6] hover:bg-[#F97316] text-[#F97316] hover:text-white'
                        }`}
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Cart Drawer */}
      <CartDrawer onOpenPayment={() => setIsPaymentOpen(true)} />

      {/* Item Variant / Addon Customizer Modal */}
      {customizingItem && (
        <VariantModal
          item={customizingItem}
          onClose={() => setCustomizingItem(null)}
          onConfirm={(variantId, addonIds, notes) => {
            addToCart(customizingItem, variantId, addonIds, notes);
            setCustomizingItem(null);
          }}
        />
      )}

      {/* Payment Modal */}
      {isPaymentOpen && (
        <PaymentModal
          grandTotal={grandTotal}
          subtotal={subtotal}
          taxTotal={taxTotal}
          discountTotal={discountTotal}
          platformFee={platformFee}
          feePayer={feePayer}
          onClose={() => setIsPaymentOpen(false)}
          onSuccess={(newOrder) => {
            setIsPaymentOpen(false);
            setCompletedOrder(newOrder);
          }}
        />
      )}

      {/* Receipt Modal */}
      {completedOrder && (
        <ReceiptModal
          order={completedOrder}
          onClose={() => setCompletedOrder(null)}
          onNewSale={() => setCompletedOrder(null)}
        />
      )}

      {/* Manual Print Receipt Thermal Workstation Modal */}
      {isManualPrintOpen && (
        <ManualPrintReceiptModal
          initialOrder={completedOrder || (cart.length > 0 ? undefined : undefined)}
          onClose={() => setIsManualPrintOpen(false)}
        />
      )}
    </div>
  );
};
