import React, { useState } from 'react';
import { useTsosStore } from '../../lib/store';
import { MenuItem, DineTable } from '../../types';
import { VariantModal } from '../pos/VariantModal';
import { useTableSession } from '../../hooks/useTableSession';
import { sessionService } from '../../lib/sessionService';
import {
  ShoppingBag,
  Search,
  Plus,
  Minus,
  Trash2,
  QrCode,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  Clock,
  Utensils,
  ChevronLeft,
  ShieldCheck,
  ShieldAlert,
  Lock,
  RefreshCw,
  AlertTriangle,
  RotateCcw,
  Leaf,
} from 'lucide-react';
import confetti from 'canvas-confetti';

type StorefrontSort = 'popular' | 'price-asc' | 'price-desc';

export const StorefrontScreen: React.FC = () => {
  const {
    location,
    categories,
    menuItems,
    tables,
    selectedTableId,
    setSelectedTableId,
    cart,
    addToCart,
    updateCartQty,
    removeFromCart,
    clearCart,
    createOrder,
    setActiveSurface,
    setTrackedOrderId,
    feeConfig,
    themeMode,
    currentTenant,
  } = useTsosStore();
  const isServepoint = themeMode === 'servepoint';

  const [selectedCatId, setSelectedCatId] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [customizingItem, setCustomizingItem] = useState<MenuItem | null>(null);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerNotes, setCustomerNotes] = useState('');
  const [isOrdering, setIsOrdering] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  // v2.8.1 — ServePoint customer niceties
  const [vegOnly, setVegOnly] = useState(false);
  const [sortBy, setSortBy] = useState<StorefrontSort>('popular');

  const selectedTable = tables.find((t) => t.id === selectedTableId) || tables[0];
  const tableSlug = selectedTable ? selectedTable.label.toLowerCase().replace(/[^a-z0-9]/g, '') : 't1';
  // v2.8.1 fix: session RPC validates against the TENANT slug (currentTenant),
  // not the location's slug ('demo-cafe' ≠ live 'coolkafe' — the mismatch locked
  // every deep-linked diner out of ordering).
  const cafeSlug = currentTenant?.slug || location.slug || 'coolkafe';

  // Read permanent QR token from query parameter or table secret
  const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const rawToken = searchParams.get('token');
  const permanentQrToken = rawToken || selectedTable?.qr_token || 'demo_token';

  // 10-Minute Ephemeral Session Token Hook
  const {
    sessionToken,
    remainingSeconds,
    formattedTime,
    isExpiringSoon,
    isCritical,
    isExpired,
    isLoading: isSessionLoading,
    error: sessionError,
    isTampered,
    toggleTamper,
    expireSession,
    renewSession,
  } = useTableSession({
    tenantSlug: cafeSlug,
    tableNumber: selectedTable?.label || 'T-01',
    permanentQrToken,
    fallbackTable: selectedTable,
  });

  const safeMenuItems = menuItems || [];
  const filteredItems = safeMenuItems.filter((item) => {
    if (!item.is_available) return false;
    if (selectedCatId !== 'all' && item.category_id !== selectedCatId) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return item.name.toLowerCase().includes(q) || item.description.toLowerCase().includes(q);
    }
    return true;
  });

  // v2.8.1 — ServePoint-only: veg filter + price sort layered on the base filter
  const serveFilteredItems = React.useMemo(() => {
    const list = filteredItems.filter((i) => (vegOnly ? i.is_veg : true));
    if (sortBy === 'price-asc') return [...list].sort((a, b) => a.price - b.price);
    if (sortBy === 'price-desc') return [...list].sort((a, b) => b.price - a.price);
    return list;
  }, [filteredItems, vegOnly, sortBy]);

  // Calculate totals
  const safeCart = cart || [];
  const subtotal = safeCart.reduce((sum, i) => sum + (i?.item_total || 0), 0);
  const taxTotal = +(subtotal * 0.05).toFixed(2);
  const feePayer = feeConfig?.default_fee_payer ?? 'customer';
  const platformFee = feeConfig?.per_order_fee ?? 5;
  const grandTotal = Math.max(
    0,
    +(subtotal + taxTotal + (feePayer === 'customer' ? platformFee : 0)).toFixed(2)
  );

  // Order Submission with 10-Minute Ephemeral Session Token Guard
  const handlePlaceOrder = async () => {
    if (safeCart.length === 0) return;
    setOrderError(null);

    // 1. Guard check: Ephemeral Session Expiry & Tamper Simulation
    if (isTampered) {
      setOrderError('Security alert: URL parameter or table token has been tampered. Order locked.');
      return;
    }

    if (isExpired || !sessionToken) {
      setOrderError('Table session expired after 10 minutes. Please re-scan table QR to submit order.');
      return;
    }

    setIsOrdering(true);

    try {
      // 2. Cryptographic Order Submission Verification Guard
      const guardResult = await sessionService.verifyOrderSubmissionSession(
        sessionToken,
        selectedTable.id,
        selectedTable
      );

      if (!guardResult.isValid) {
        setIsOrdering(false);
        setOrderError(guardResult.message || 'Session verification failed. Please re-scan table QR.');
        return;
      }

      // 3. Place Order with session tracking
      setTimeout(() => {
        const order = createOrder({
          paymentMethod: 'upi',
          customPlacedBy: selectedTable ? `Customer (${selectedTable.label} QR)` : 'Customer (Self-Order QR)',
          customerNotes: customerNotes
            ? `${customerNotes} [Phone: ${customerPhone}] [Session: ${sessionToken.slice(0, 12)}...]`
            : `[Session: ${sessionToken.slice(0, 12)}...]`,
        });

        confetti({
          particleCount: 60,
          spread: 70,
          origin: { y: 0.6 },
          // v2.8.1 — palette follows the active theme
          colors: isServepoint ? ['#B88E2F', '#0F3D3E', '#D9E2DD'] : ['#F97316', '#17803D'],
        });

        setIsOrdering(false);
        setIsCartOpen(false);
        setTrackedOrderId(order.id);
        setActiveSurface('order_track');
      }, 500);
    } catch (err: any) {
      setIsOrdering(false);
      setOrderError(err.message || 'Failed to submit order. Please re-scan table QR.');
    }
  };

  const handleRenewClick = async () => {
    await renewSession(selectedTable?.qr_token || 'demo_token');
    setOrderError(null);
  };

  // ————————————————————————————————————————————————————————————
  // v2.8.1 — EXPLICIT ServePoint storefront (12th explicit surface)
  // Owner palette: ivory #F6F5F2 canvas, deep-teal #0F3D3E, gold #B88E2F
  // (pressed #967221), sage #D9E2DD, hairline #E3E7E0, text #1A1A1A/#6B6B6B
  // ————————————————————————————————————————————————————————————
  if (isServepoint) {
    const sessionChipCls = isExpired
      ? 'bg-[#DC2626] text-white'
      : isCritical
      ? 'bg-[#DC2626]/90 text-white animate-pulse'
      : isExpiringSoon
      ? 'bg-[#B88E2F] text-[#0F3D3E] animate-pulse'
      : 'bg-white/10 text-[#D9E2DD] border border-white/15';

    return (
      <div className="min-h-screen bg-[#F6F5F2] flex flex-col items-center justify-start p-2 sm:p-6">
        {/* Mobile-Frame Container */}
        <div className="w-full max-w-md bg-white rounded-[2rem] border border-[#E3E7E0] shadow-[0_24px_60px_-24px_rgba(15,61,62,0.18)] overflow-hidden flex flex-col min-h-[85vh] relative">
          {/* Brand Hero Bar — deep teal */}
          <div className="p-4 bg-[#0F3D3E] relative overflow-hidden">
            <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-[#B88E2F]/10 pointer-events-none" />
            <div className="flex items-center justify-between relative">
              <div className="flex items-center gap-2.5">
                <span className="w-9 h-9 rounded-full bg-[#B88E2F] text-[#0F3D3E] flex items-center justify-center font-bold text-[11px] tracking-wide shrink-0">
                  {location.name.slice(0, 2).toUpperCase()}
                </span>
                <div>
                  <h1 className="font-semibold text-base text-[#F6F5F2] leading-tight">
                    {location.name}
                  </h1>
                  <p className="text-[10px] text-[#D9E2DD]/80">
                    Table Self-Ordering • Freshly crafted food & artisan coffee
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                {selectedTable && (
                  <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#B88E2F] text-[#0F3D3E]">
                    {selectedTable.label}
                  </span>
                )}

                {/* 10-Minute Ephemeral Countdown Timer Badge */}
                <div
                  title="Table QR Session Security Timer (10m Ephemeral Token)"
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold transition-all ${sessionChipCls}`}
                >
                  <Clock className="w-3.5 h-3.5 shrink-0" />
                  <span>{formattedTime}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Security Status Bar & Testing Toggles — sage strip */}
          <div className="px-4 pt-3">
            <div className="p-2.5 bg-[#D9E2DD]/60 border border-[#E3E7E0] rounded-xl flex items-center justify-between text-[11px] text-[#0F3D3E]">
              <div className="flex items-center gap-1.5 font-semibold">
                <ShieldCheck className="w-3.5 h-3.5 text-[#0F3D3E]" />
                <span>Table {selectedTable?.label || 'T1'} • 10m Ephemeral Session</span>
              </div>
              <div className="flex items-center gap-1.5">
                {!isExpired ? (
                  <button
                    type="button"
                    onClick={expireSession}
                    className="px-2 py-0.5 rounded-lg bg-white text-[#0F3D3E] hover:border-[#B88E2F] border border-[#E3E7E0] text-[10px] font-bold transition-colors cursor-pointer"
                    title="Simulate diner opening link from history 2 hours later from home"
                  >
                    Expire (Test History)
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleRenewClick}
                    className="px-2 py-0.5 rounded-lg bg-[#B88E2F] hover:bg-[#967221] text-white text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-2.5 h-2.5" />
                    <span>Re-scan QR</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={toggleTamper}
                  className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition-colors cursor-pointer ${
                    isTampered
                      ? 'bg-[#DC2626]/10 text-[#DC2626] border border-[#DC2626]/30'
                      : 'bg-white text-[#6B6B6B] hover:text-[#0F3D3E] border border-[#E3E7E0]'
                  }`}
                  title="Toggle URL tampering simulation"
                >
                  {isTampered ? 'Spoofed' : 'Tamper'}
                </button>

                <button
                  type="button"
                  onClick={handleRenewClick}
                  className="text-[10px] text-[#0F3D3E] font-bold hover:text-[#B88E2F] underline decoration-[#B88E2F]/50 underline-offset-2 flex items-center gap-1"
                  title="Renew your 10-minute session"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Renew</span>
                </button>
              </div>
            </div>
          </div>

          {/* Expiring Soon Warning Banner — gold */}
          {isExpiringSoon && !isExpired && (
            <div className="mx-4 mt-2 rounded-xl bg-[#B88E2F] text-white px-3 py-2 text-xs flex items-center justify-between gap-2 animate-in slide-in-from-top duration-150">
              <div className="flex items-center gap-1.5 font-medium">
                <AlertTriangle className="w-4 h-4 shrink-0 animate-bounce" />
                <span>
                  Session expires in <strong>{formattedTime}</strong>.
                </span>
              </div>
              <button
                onClick={handleRenewClick}
                className="px-2 py-0.5 rounded-md bg-white text-[#B88E2F] font-bold text-[11px] hover:bg-[#F6F5F2] transition-colors"
              >
                Renew Now
              </button>
            </div>
          )}

          {/* Search, Filters & Categories */}
          <div className="p-4 border-b border-[#E3E7E0] space-y-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#6B6B6B]/60" />
              <input
                type="text"
                disabled={isExpired}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search dishes, drinks, desserts..."
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-[#E3E7E0] bg-[#F6F5F2] focus:bg-white focus:border-[#0F3D3E] focus:outline-hidden disabled:opacity-50 transition-colors"
              />
            </div>

            {/* v2.8.1 — veg-only filter + price sort */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setVegOnly((v) => !v)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors ${
                  vegOnly
                    ? 'bg-[#0F3D3E] text-white border-[#0F3D3E]'
                    : 'bg-white text-[#6B6B6B] border-[#E3E7E0] hover:text-[#0F3D3E]'
                }`}
                title="Show only vegetarian dishes"
              >
                <Leaf className="w-3 h-3" />
                <span>Veg only</span>
              </button>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as StorefrontSort)}
                className="ml-auto text-[11px] rounded-lg border border-[#E3E7E0] bg-white px-2 py-1 text-[#1A1A1A] focus:outline-hidden focus:border-[#0F3D3E] cursor-pointer"
                title="Sort menu"
              >
                <option value="popular">Most Popular</option>
                <option value="price-asc">Price: Low → High</option>
                <option value="price-desc">Price: High → Low</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
              <button
                onClick={() => setSelectedCatId('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
                  selectedCatId === 'all'
                    ? 'bg-[#0F3D3E] text-white'
                    : 'bg-[#D9E2DD]/70 text-[#0F3D3E] hover:bg-[#D9E2DD]'
                }`}
              >
                All Items ({safeMenuItems.length})
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCatId(cat.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
                    selectedCatId === cat.id
                      ? 'bg-[#0F3D3E] text-white'
                      : 'bg-[#D9E2DD]/70 text-[#0F3D3E] hover:bg-[#D9E2DD]'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>

          {/* Menu Catalog Grid */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
            {serveFilteredItems.length === 0 && (
              <div className="py-10 flex flex-col items-center text-center">
                <span className="w-12 h-12 rounded-full bg-[#D9E2DD]/60 flex items-center justify-center mb-3">
                  <Search className="w-5 h-5 text-[#0F3D3E]" />
                </span>
                <p className="text-sm font-semibold text-[#1A1A1A]">No dishes match</p>
                <p className="text-[11px] text-[#6B6B6B] mt-0.5">
                  Try another category, or clear the search & filters.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setVegOnly(false);
                    setSelectedCatId('all');
                    setSortBy('popular');
                  }}
                  className="mt-3 px-3 py-1.5 rounded-lg border border-[#E3E7E0] bg-white text-[11px] font-semibold text-[#0F3D3E] hover:border-[#B88E2F] transition-colors"
                >
                  Clear filters
                </button>
              </div>
            )}

            {serveFilteredItems.map((item) => {
              const hasVariants = item.variants && item.variants.length > 0;
              const inCart = safeCart.find((ci) => ci.menu_item.id === item.id);

              return (
                <div
                  key={item.id}
                  className="p-3 rounded-2xl border border-[#E3E7E0] bg-white flex items-center justify-between gap-3 hover:border-[#B88E2F]/50 hover:shadow-[0_10px_28px_-16px_rgba(184,142,47,0.45)] transition-all"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`w-3.5 h-3.5 rounded-xs border flex items-center justify-center p-0.5 shrink-0 ${
                          item.is_veg
                            ? 'border-emerald-600'
                            : 'border-rose-600'
                        }`}
                      >
                        <span
                          className={`w-2 h-2 rounded-full ${
                            item.is_veg ? 'bg-emerald-600' : 'bg-rose-600'
                          }`}
                        />
                      </span>
                      <h3 className="font-semibold text-xs text-[#1A1A1A] truncate">
                        {item.name}
                      </h3>
                    </div>

                    <p className="text-[11px] text-[#6B6B6B] line-clamp-1 mt-0.5">
                      {item.description}
                    </p>

                    <div className="text-sm font-bold text-[#0F3D3E] mt-1">
                      ₹{item.price}
                    </div>
                  </div>

                  <div className="shrink-0">
                    {inCart && !hasVariants ? (
                      <div className="flex items-center gap-1.5 bg-[#D9E2DD]/50 rounded-xl p-1 border border-[#E3E7E0]">
                        <button
                          onClick={() => updateCartQty(inCart.id, -1)}
                          className="w-6 h-6 rounded-lg bg-white text-[#0F3D3E] flex items-center justify-center font-bold text-xs"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-xs font-bold px-1 text-[#0F3D3E]">
                          {inCart.qty}
                        </span>
                        <button
                          onClick={() => updateCartQty(inCart.id, 1)}
                          className="w-6 h-6 rounded-lg bg-[#B88E2F] text-white flex items-center justify-center font-bold text-xs"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <button
                        disabled={isExpired}
                        onClick={() => {
                          if (hasVariants) {
                            setCustomizingItem(item);
                          } else {
                            addToCart(item);
                          }
                        }}
                        className="px-3 py-1.5 rounded-xl bg-[#0F3D3E] hover:bg-[#0B3132] text-white text-xs font-semibold transition-colors flex items-center gap-1 disabled:opacity-40"
                      >
                        <Plus className="w-3.5 h-3.5 text-[#D9E2DD]" />
                        <span>{hasVariants ? 'Options' : 'Add'}</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Floating Bottom Cart Bar */}
          {safeCart.length > 0 && !isExpired && (
            <div className="p-3 bg-white border-t border-[#E3E7E0] flex items-center justify-between gap-3">
              <div>
                <div className="text-[10px] text-[#6B6B6B] uppercase font-bold tracking-wide">
                  {safeCart.reduce((sum, i) => sum + i.qty, 0)} Items Selected
                </div>
                <div className="text-base font-bold text-[#0F3D3E]">
                  ₹{grandTotal}
                </div>
              </div>

              <button
                onClick={() => setIsCartOpen(true)}
                className="px-5 py-2.5 rounded-xl bg-[#B88E2F] hover:bg-[#967221] text-white font-bold text-xs flex items-center gap-2 shadow-md transition-colors"
              >
                <ShoppingBag className="w-4 h-4" />
                <span>View Order</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* AUTO-LOCK SCREEN WHEN 10-MINUTE EPHEMERAL SESSION EXPIRES */}
          {isExpired && (
            <div className="absolute inset-0 bg-[#0F3D3E]/95 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-center z-50 animate-in fade-in zoom-in-95 duration-200 text-white">
              <div className="w-16 h-16 rounded-3xl bg-[#B88E2F]/20 border-2 border-[#B88E2F] text-[#B88E2F] flex items-center justify-center mb-4">
                <Lock className="w-8 h-8" />
              </div>

              <div className="text-[11px] font-bold uppercase tracking-wider text-[#B88E2F] mb-1">
                Security Auto-Lock Active
              </div>
              <h2 className="text-lg font-bold text-[#F6F5F2] leading-snug max-w-xs">
                Dining Session Expired
              </h2>

              <p className="text-xs text-[#D9E2DD]/80 mt-2 max-w-xs leading-relaxed">
                To protect diners from accidental or unauthorized remote orders via browser history, ordering sessions automatically expire after <strong>10 minutes</strong>.
              </p>

              <div className="p-3 bg-white/10 rounded-2xl border border-white/15 mt-4 text-xs max-w-xs text-[#D9E2DD]">
                Please scan the QR code sticker placed at <strong>Table {selectedTable?.label || 'T-01'}</strong> to renew your dining session.
              </div>

              {sessionError && (
                <p className="text-[10px] text-[#B88E2F] mt-3 max-w-xs leading-relaxed">
                  {sessionError}
                </p>
              )}

              <button
                type="button"
                onClick={handleRenewClick}
                className="mt-6 px-6 py-3 rounded-2xl bg-[#B88E2F] hover:bg-[#967221] text-white font-bold text-xs shadow-lg flex items-center gap-2 transition-all"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Renew Table Session (10 Minutes)</span>
              </button>
            </div>
          )}

          {/* Cart Drawer Modal */}
          {isCartOpen && (
            <div className="absolute inset-0 bg-[#0F3D3E]/50 backdrop-blur-xs z-40 flex flex-col justify-end animate-in fade-in duration-150">
              <div className="bg-white rounded-t-3xl max-h-[85vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-200">
                <div className="p-4 border-b border-[#E3E7E0] flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-sm text-[#1A1A1A]">Your Table Order</h3>
                    <p className="text-[11px] text-[#6B6B6B]">
                      Session valid: {formattedTime} remaining
                    </p>
                  </div>
                  <button
                    onClick={() => setIsCartOpen(false)}
                    className="p-1.5 rounded-lg text-[#6B6B6B] hover:bg-[#F6F5F2]"
                  >
                    <ChevronLeft className="w-5 h-5 rotate-270" />
                  </button>
                </div>

                {orderError && (
                  <div className="mx-4 mt-3 p-3 bg-[#DC2626]/10 border border-[#DC2626]/30 text-[#DC2626] rounded-xl text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{orderError}</span>
                  </div>
                )}

                <div className="p-4 overflow-y-auto space-y-3 flex-1">
                  {safeCart.map((ci) => (
                    <div
                      key={ci.id}
                      className="p-2.5 rounded-xl border border-[#E3E7E0] bg-[#F6F5F2] flex items-center justify-between"
                    >
                      <div>
                        <div className="font-semibold text-xs text-[#1A1A1A]">{ci.menu_item.name}</div>
                        {ci.variant && (
                          <div className="text-[10px] text-[#B88E2F] font-semibold">{ci.variant.name}</div>
                        )}
                        <div className="text-xs text-[#6B6B6B] mt-0.5">
                          ₹{ci.unit_price} × {ci.qty} = ₹{ci.item_total}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => updateCartQty(ci.id, -1)}
                          className="w-6 h-6 rounded-lg bg-white border border-[#E3E7E0] text-xs font-bold flex items-center justify-center text-[#0F3D3E]"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-xs font-bold px-1 text-[#1A1A1A]">{ci.qty}</span>
                        <button
                          onClick={() => updateCartQty(ci.id, 1)}
                          className="w-6 h-6 rounded-lg bg-white border border-[#E3E7E0] text-xs font-bold flex items-center justify-center text-[#0F3D3E]"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => removeFromCart(ci.id)}
                          className="p-1 text-[#DC2626] hover:bg-[#DC2626]/10 rounded-md ml-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}

                  <div className="space-y-2 pt-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-[#6B6B6B] mb-1">
                        Your Name (Optional)
                      </label>
                      <input
                        type="text"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="e.g. Ananya"
                        className="w-full px-3 py-1.5 text-xs rounded-xl border border-[#E3E7E0] bg-white focus:outline-hidden focus:border-[#0F3D3E]"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-[#6B6B6B] mb-1">
                        Phone Number (For Order Tracking SMS)
                      </label>
                      <input
                        type="tel"
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        placeholder="e.g. 9876543210"
                        className="w-full px-3 py-1.5 text-xs rounded-xl border border-[#E3E7E0] bg-white focus:outline-hidden focus:border-[#0F3D3E]"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-[#6B6B6B] mb-1">
                        Kitchen Note / Requests
                      </label>
                      <input
                        type="text"
                        value={customerNotes}
                        onChange={(e) => setCustomerNotes(e.target.value)}
                        placeholder="e.g. Extra hot, less sugar"
                        className="w-full px-3 py-1.5 text-xs rounded-xl border border-[#E3E7E0] bg-white focus:outline-hidden focus:border-[#0F3D3E]"
                      />
                    </div>
                  </div>

                  {/* Bill breakdown */}
                  <div className="p-3 bg-[#F6F5F2] rounded-xl border border-[#E3E7E0] space-y-1 text-xs text-[#6B6B6B]">
                    <div className="flex justify-between">
                      <span>Subtotal</span>
                      <span>₹{subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>GST (5%)</span>
                      <span>₹{taxTotal.toFixed(2)}</span>
                    </div>
                    {feePayer === 'customer' && (
                      <div className="flex justify-between">
                        <span>Platform Fee</span>
                        <span>₹{platformFee}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold text-sm text-[#1A1A1A] pt-1 border-t border-[#E3E7E0]">
                      <span>Total Payable</span>
                      <span className="text-[#0F3D3E]">₹{grandTotal}</span>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-white border-t border-[#E3E7E0] space-y-2">
                  {isTampered && (
                    <div className="p-2 bg-[#DC2626]/10 border border-[#DC2626]/30 rounded-xl text-xs text-[#DC2626] font-semibold flex items-center gap-1.5">
                      <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                      <span>Order locked: URL tampering or spoofed table detected.</span>
                    </div>
                  )}
                  {isExpired && !isTampered && (
                    <div className="p-2 bg-[#B88E2F]/10 border border-[#B88E2F]/40 rounded-xl text-xs text-[#967221] flex items-center justify-between">
                      <span className="font-semibold">Session expired (10m limit)</span>
                      <button
                        type="button"
                        onClick={handleRenewClick}
                        className="px-2 py-0.5 rounded-lg bg-[#B88E2F] text-white font-bold text-[10px]"
                      >
                        Renew QR
                      </button>
                    </div>
                  )}
                  <button
                    disabled={isOrdering || isExpired || isTampered}
                    onClick={handlePlaceOrder}
                    className="w-full py-3 rounded-xl bg-[#0F3D3E] hover:bg-[#0B3132] text-white font-bold text-xs transition-colors flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4 text-[#B88E2F]" />
                    <span>
                      {isOrdering
                        ? 'Validating Token & Sending to Kitchen...'
                        : isTampered
                        ? 'Order Locked (Tampered URL)'
                        : isExpired
                        ? 'Session Expired - Re-scan QR'
                        : `Pay & Send Order (₹${grandTotal})`}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Item Variant Modal */}
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
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-100px)] bg-[#FFF9F2] flex flex-col items-center justify-start p-2 sm:p-4">
      {/* Mobile-Frame Container */}
      <div className="w-full max-w-md bg-white rounded-3xl border border-[#E9E0D6] shadow-xl overflow-hidden flex flex-col min-h-[85vh] relative">
        {/* Brand Hero Bar */}
        <div className="p-4 bg-gradient-to-r from-[#FFF1E6] via-[#FFF9F2] to-white border-b border-[#E9E0D6]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#17803D] animate-pulse" />
              <h1 className="font-bold text-base text-[#1C1917] font-display">
                {location.name}
              </h1>
            </div>

            <div className="flex items-center gap-1.5">
              {selectedTable && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#1C1917] text-white">
                  {selectedTable.label}
                </span>
              )}

              {/* 10-Minute Ephemeral Countdown Timer Badge */}
              <div
                title="Table QR Session Security Timer (10m Ephemeral Token)"
                className={`flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold transition-all shadow-xs ${
                  isExpired
                    ? 'bg-rose-100 text-rose-800 border border-rose-300'
                    : isCritical
                    ? 'bg-rose-50 text-rose-700 border border-rose-200 animate-pulse'
                    : isExpiringSoon
                    ? 'bg-amber-100 text-amber-900 border border-amber-300 animate-pulse'
                    : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                }`}
              >
                <Clock className="w-3.5 h-3.5 shrink-0" />
                <span>{formattedTime}</span>
              </div>
            </div>
          </div>

          {/* Security Status Bar & Testing Toggles */}
          <div className="mt-2.5 p-2 bg-[#F0FDF4] border border-[#BBF7D0] rounded-xl flex items-center justify-between text-[11px] text-[#166534]">
            <div className="flex items-center gap-1.5 font-semibold">
              <ShieldCheck className="w-3.5 h-3.5 text-[#16A34A]" />
              <span>Table {selectedTable?.label || 'T1'} • 10m Ephemeral Session</span>
            </div>
            <div className="flex items-center gap-1.5">
              {!isExpired ? (
                <button
                  type="button"
                  onClick={expireSession}
                  className="px-2 py-0.5 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 text-[10px] font-bold transition-colors cursor-pointer"
                  title="Simulate diner opening link from history 2 hours later from home"
                >
                  Expire (Test History)
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleRenewClick}
                  className="px-2 py-0.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold flex items-center gap-1 shadow-xs cursor-pointer"
                >
                  <RotateCcw className="w-2.5 h-2.5" />
                  <span>Re-scan QR</span>
                </button>
              )}

              <button
                type="button"
                onClick={toggleTamper}
                className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition-colors cursor-pointer ${
                  isTampered
                    ? 'bg-rose-100 text-rose-700 border border-rose-300'
                    : 'bg-stone-100 text-stone-700 hover:bg-stone-200 border border-stone-200'
                }`}
                title="Toggle URL tampering simulation"
              >
                {isTampered ? 'Spoofed' : 'Tamper'}
              </button>

              <button
                type="button"
                onClick={handleRenewClick}
                className="text-[10px] text-[#15803D] font-bold hover:underline flex items-center gap-1"
                title="Renew your 10-minute session"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Renew</span>
              </button>
            </div>
          </div>

          <p className="text-xs text-[#57534E] mt-1.5">
            Table Self-Ordering • Freshly crafted food & artisan coffee
          </p>
        </div>

        {/* Expiring Soon Warning Banner */}
        {isExpiringSoon && !isExpired && (
          <div className="bg-amber-500 text-white px-3 py-2 text-xs flex items-center justify-between gap-2 shadow-xs animate-in slide-in-from-top duration-150">
            <div className="flex items-center gap-1.5 font-medium">
              <AlertTriangle className="w-4 h-4 shrink-0 animate-bounce" />
              <span>
                Session expires in <strong>{formattedTime}</strong>.
              </span>
            </div>
            <button
              onClick={handleRenewClick}
              className="px-2 py-0.5 rounded-md bg-white text-amber-900 font-bold text-[11px] hover:bg-amber-50 shadow-xs"
            >
              Renew Now
            </button>
          </div>
        )}

        {/* Search & Categories */}
        <div className="p-3 border-b border-[#F5F0EB] space-y-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#A8A29E]" />
            <input
              type="text"
              disabled={isExpired}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search dishes, drinks, desserts..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-[#E9E0D6] bg-[#FFF9F2] focus:bg-white focus:border-[#F97316] focus:outline-hidden disabled:opacity-50"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
            <button
              onClick={() => setSelectedCatId('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
                selectedCatId === 'all'
                  ? 'bg-[#1C1917] text-white'
                  : 'bg-[#F5F0EB] text-[#57534E] hover:bg-[#E9E0D6]'
              }`}
            >
              All Items ({safeMenuItems.length})
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCatId(cat.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
                  selectedCatId === cat.id
                    ? 'bg-[#1C1917] text-white'
                    : 'bg-[#F5F0EB] text-[#57534E] hover:bg-[#E9E0D6]'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* Menu Catalog Grid */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
          {filteredItems.map((item) => {
            const hasVariants = item.variants && item.variants.length > 0;
            const inCart = safeCart.find((ci) => ci.menu_item.id === item.id);

            return (
              <div
                key={item.id}
                className="p-3 rounded-2xl border border-[#E9E0D6] bg-white flex items-center justify-between gap-3 hover:border-[#F97316]/40 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`w-3.5 h-3.5 rounded-xs border flex items-center justify-center p-0.5 shrink-0 ${
                        item.is_veg
                          ? 'border-emerald-600'
                          : 'border-rose-600'
                      }`}
                    >
                      <span
                        className={`w-2 h-2 rounded-full ${
                          item.is_veg ? 'bg-emerald-600' : 'bg-rose-600'
                        }`}
                      />
                    </span>
                    <h3 className="font-bold text-xs text-[#1C1917] truncate">
                      {item.name}
                    </h3>
                  </div>

                  <p className="text-[11px] text-[#A8A29E] line-clamp-1 mt-0.5">
                    {item.description}
                  </p>

                  <div className="text-xs font-bold text-[#F97316] font-mono mt-1">
                    ₹{item.price}
                  </div>
                </div>

                <div className="shrink-0">
                  {inCart && !hasVariants ? (
                    <div className="flex items-center gap-1.5 bg-[#FFF1E6] rounded-xl p-1 border border-[#F97316]/30">
                      <button
                        onClick={() => updateCartQty(inCart.id, -1)}
                        className="w-6 h-6 rounded-lg bg-white text-[#F97316] flex items-center justify-center font-bold text-xs"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="font-mono text-xs font-bold px-1 text-[#1C1917]">
                        {inCart.qty}
                      </span>
                      <button
                        onClick={() => updateCartQty(inCart.id, 1)}
                        className="w-6 h-6 rounded-lg bg-[#F97316] text-white flex items-center justify-center font-bold text-xs"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <button
                      disabled={isExpired}
                      onClick={() => {
                        if (hasVariants) {
                          setCustomizingItem(item);
                        } else {
                          addToCart(item);
                        }
                      }}
                      className="px-3 py-1.5 rounded-xl bg-[#1C1917] hover:bg-black text-white text-xs font-bold transition-colors flex items-center gap-1 disabled:opacity-40"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{hasVariants ? 'Options' : 'Add'}</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Floating Bottom Cart Bar */}
        {safeCart.length > 0 && !isExpired && (
          <div className="p-3 bg-white border-t border-[#E9E0D6] flex items-center justify-between gap-3 shadow-lg">
            <div>
              <div className="text-[10px] text-[#A8A29E] uppercase font-bold">
                {safeCart.reduce((sum, i) => sum + i.qty, 0)} Items Selected
              </div>
              <div className="text-sm font-black text-[#1C1917] font-mono">
                ₹{grandTotal}
              </div>
            </div>

            <button
              onClick={() => setIsCartOpen(true)}
              className="px-5 py-2.5 rounded-xl bg-[#F97316] hover:bg-[#EA580C] text-white font-bold text-xs flex items-center gap-2 shadow-md transition-colors"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>View Order</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* AUTO-LOCK SCREEN WHEN 10-MINUTE EPHEMERAL SESSION EXPIRES */}
        {isExpired && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-center z-50 animate-in fade-in zoom-in-95 duration-200 text-white">
            <div className="w-16 h-16 rounded-3xl bg-rose-500/20 border-2 border-rose-500 text-rose-400 flex items-center justify-center mb-4 shadow-xl">
              <Lock className="w-8 h-8" />
            </div>

            <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-rose-400 mb-1">
              Security Auto-Lock Active
            </div>
            <h2 className="text-lg font-black text-white leading-snug max-w-xs">
              Dining Session Expired
            </h2>

            <p className="text-xs text-stone-300 mt-2 max-w-xs leading-relaxed">
              To protect diners from accidental or unauthorized remote orders via browser history, ordering sessions automatically expire after <strong>10 minutes</strong>.
            </p>

            <div className="p-3 bg-white/10 rounded-2xl border border-white/20 mt-4 text-xs max-w-xs text-stone-200">
              Please scan the QR code sticker placed at <strong>Table {selectedTable?.label || 'T-01'}</strong> to renew your dining session.
            </div>

            {sessionError && (
              <p className="text-[10px] text-rose-300 mt-3 max-w-xs leading-relaxed">
                {sessionError}
              </p>
            )}

            <button
              type="button"
              onClick={handleRenewClick}
              className="mt-6 px-6 py-3 rounded-2xl bg-[#F97316] hover:bg-[#EA580C] text-white font-bold text-xs shadow-lg flex items-center gap-2 transition-all"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Renew Table Session (10 Minutes)</span>
            </button>
          </div>
        )}

        {/* Cart Drawer Modal */}
        {isCartOpen && (
          <div className="absolute inset-0 bg-black/50 backdrop-blur-xs z-40 flex flex-col justify-end animate-in fade-in duration-150">
            <div className="bg-white rounded-t-3xl max-h-[85vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-200">
              <div className="p-4 border-b border-[#E9E0D6] flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm text-[#1C1917]">Your Table Order</h3>
                  <p className="text-[11px] text-[#A8A29E] font-mono">
                    Session valid: {formattedTime} remaining
                  </p>
                </div>
                <button
                  onClick={() => setIsCartOpen(false)}
                  className="p-1.5 rounded-lg text-[#57534E] hover:bg-[#F5F0EB]"
                >
                  <ChevronLeft className="w-5 h-5 rotate-270" />
                </button>
              </div>

              {orderError && (
                <div className="mx-4 mt-3 p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{orderError}</span>
                </div>
              )}

              <div className="p-4 overflow-y-auto space-y-3 flex-1">
                {safeCart.map((ci) => (
                  <div
                    key={ci.id}
                    className="p-2.5 rounded-xl border border-[#E9E0D6] bg-[#FFF9F2] flex items-center justify-between"
                  >
                    <div>
                      <div className="font-bold text-xs text-[#1C1917]">{ci.menu_item.name}</div>
                      {ci.variant && (
                        <div className="text-[10px] text-[#F97316]">{ci.variant.name}</div>
                      )}
                      <div className="font-mono text-xs text-[#57534E] mt-0.5">
                        ₹{ci.unit_price} × {ci.qty} = ₹{ci.item_total}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => updateCartQty(ci.id, -1)}
                        className="w-6 h-6 rounded-lg bg-white border border-[#E9E0D6] text-xs font-bold flex items-center justify-center"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="font-mono text-xs font-bold px-1">{ci.qty}</span>
                      <button
                        onClick={() => updateCartQty(ci.id, 1)}
                        className="w-6 h-6 rounded-lg bg-white border border-[#E9E0D6] text-xs font-bold flex items-center justify-center"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => removeFromCart(ci.id)}
                        className="p-1 text-rose-500 hover:bg-rose-50 rounded-md ml-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}

                <div className="space-y-2 pt-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-[#57534E] mb-1">
                      Your Name (Optional)
                    </label>
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="e.g. Ananya"
                      className="w-full px-3 py-1.5 text-xs rounded-xl border border-[#E9E0D6] focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-[#57534E] mb-1">
                      Phone Number (For Order Tracking SMS)
                    </label>
                    <input
                      type="tel"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="e.g. 9876543210"
                      className="w-full px-3 py-1.5 text-xs rounded-xl border border-[#E9E0D6] focus:outline-hidden font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-[#57534E] mb-1">
                      Kitchen Note / Requests
                    </label>
                    <input
                      type="text"
                      value={customerNotes}
                      onChange={(e) => setCustomerNotes(e.target.value)}
                      placeholder="e.g. Extra hot, less sugar"
                      className="w-full px-3 py-1.5 text-xs rounded-xl border border-[#E9E0D6] focus:outline-hidden"
                    />
                  </div>
                </div>

                {/* Bill breakdown */}
                <div className="p-3 bg-[#FFF9F2] rounded-xl border border-[#E9E0D6] space-y-1 text-xs text-[#57534E]">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span className="font-mono">₹{subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>GST (5%)</span>
                    <span className="font-mono">₹{taxTotal.toFixed(2)}</span>
                  </div>
                  {feePayer === 'customer' && (
                    <div className="flex justify-between">
                      <span>Platform Fee</span>
                      <span className="font-mono">₹{platformFee}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-sm text-[#1C1917] pt-1 border-t border-[#E9E0D6]">
                    <span>Total Payable</span>
                    <span className="font-mono text-[#F97316]">₹{grandTotal}</span>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-white border-t border-[#E9E0D6] space-y-2">
                {isTampered && (
                  <div className="p-2 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-semibold flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                    <span>Order locked: URL tampering or spoofed table detected.</span>
                  </div>
                )}
                {isExpired && !isTampered && (
                  <div className="p-2 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-center justify-between">
                    <span className="font-semibold">Session expired (10m limit)</span>
                    <button
                      type="button"
                      onClick={handleRenewClick}
                      className="px-2 py-0.5 rounded-lg bg-amber-600 text-white font-bold text-[10px]"
                    >
                      Renew QR
                    </button>
                  </div>
                )}
                <button
                  disabled={isOrdering || isExpired || isTampered}
                  onClick={handlePlaceOrder}
                  className="w-full py-3 rounded-xl bg-[#17803D] hover:bg-[#156f35] text-white font-bold text-xs shadow-xs transition-colors flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    {isOrdering
                      ? 'Validating Token & Sending to Kitchen...'
                      : isTampered
                      ? 'Order Locked (Tampered URL)'
                      : isExpired
                      ? 'Session Expired - Re-scan QR'
                      : `Pay & Send Order (₹${grandTotal})`}
                  </span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Item Variant Modal */}
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
      </div>
    </div>
  );
};
