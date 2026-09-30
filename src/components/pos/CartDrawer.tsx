import React, { useState } from 'react';
import { useTsosStore } from '../../lib/store';
import { OrderType } from '../../types';
import {
  ShoppingBag,
  Trash2,
  Plus,
  Minus,
  Tag,
  User,
  Check,
  Percent,
  Sparkles,
  ArrowRight,
  Utensils,
  ShoppingBasket,
  Truck,
  Award,
  Coins,
  Search,
} from 'lucide-react';
import { getCustomerTier } from '../../lib/store';
import { GuidanceTooltip } from '../common/GuidanceTooltip';

interface CartDrawerProps {
  onOpenPayment: () => void;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({ onOpenPayment }) => {
  const {
    cart,
    updateCartQty,
    removeFromCart,
    clearCart,
    orderType,
    setOrderType,
    tables,
    selectedTableId,
    setSelectedTableId,
    customers,
    selectedCustomerId,
    setSelectedCustomerId,
    appliedOffer,
    applyOffer,
    removeOffer,
    redeemedPoints,
    setRedeemedPoints,
    feeConfig,
    addCustomer,
    themeMode,
  } = useTsosStore();

  const isTessera = themeMode === 'tessera';

  const [couponCode, setCouponCode] = useState('');
  const [couponError, setCouponError] = useState('');
  const [couponSuccess, setCouponSuccess] = useState('');
  const [isCustomerSelectorOpen, setIsCustomerSelectorOpen] = useState(false);
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');

  const safeCart = cart || [];
  const safeCustomers = customers || [];
  const safeTables = tables || [];

  // Math calculations
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

  // Customer loyalty points
  const selectedCustomer = safeCustomers.find((c) => c.id === selectedCustomerId);
  const maxRedeemablePoints = selectedCustomer
    ? Math.min(selectedCustomer.loyalty_points, Math.floor(subtotal - discountTotal))
    : 0;

  if (redeemedPoints > 0) {
    discountTotal += redeemedPoints;
  }

  const feePayer = feeConfig.default_fee_payer;
  const platformFee = feeConfig.per_order_fee;
  const grandTotal = Math.max(
    0,
    +(subtotal + taxTotal - discountTotal + (feePayer === 'customer' ? platformFee : 0)).toFixed(2)
  );

  const handleApplyCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    setCouponError('');
    setCouponSuccess('');
    if (!couponCode.trim()) return;

    const res = applyOffer(couponCode);
    if (res.success) {
      setCouponSuccess(res.message);
      setCouponCode('');
    } else {
      setCouponError(res.message);
    }
  };

  const orderTypeOptions: { type: OrderType; label: string; icon: React.ReactNode }[] = [
    { type: 'dine_in', label: 'Dine-In', icon: <Utensils className="w-3.5 h-3.5" /> },
    { type: 'takeaway', label: 'Takeaway', icon: <ShoppingBasket className="w-3.5 h-3.5" /> },
    { type: 'delivery', label: 'Delivery', icon: <Truck className="w-3.5 h-3.5" /> },
  ];

  return (
    <aside className={`w-full lg:w-96 border-l flex flex-col h-full ${
      isTessera ? 'bg-[#0F1D17] border-[#1F3D2E]' : 'bg-white border-[#E9E0D6] shadow-xs'
    }`}>
      {/* Drawer Header */}
      <div className={`p-4 border-b space-y-3 ${
        isTessera ? 'border-[#1F3D2E] bg-[#0A1410]' : 'border-[#E9E0D6] bg-[#FFF9F2]'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingBag className={`w-5 h-5 ${isTessera ? 'text-[#C5F82A]' : 'text-[#F97316]'}`} />
            <h2 className={`font-bold text-base ${isTessera ? 'text-[#F5F4EE]' : 'text-[#1C1917]'}`}>Current Order</h2>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
              isTessera ? 'bg-[#C5F82A]/15 text-[#C5F82A] border border-[#C5F82A]/30' : 'bg-[#FFF1E6] text-[#F97316]'
            }`}>
              {safeCart.reduce((sum, i) => sum + i.qty, 0)} items
            </span>
          </div>

          {safeCart.length > 0 && (
            <button
              onClick={clearCart}
              className={`text-xs flex items-center gap-1 transition-colors ${
                isTessera ? 'text-[#6B8579] hover:text-[#F87171]' : 'text-[#57534E] hover:text-[#B42318]'
              }`}
            >
              <Trash2 className="w-3 h-3" />
              <span>Clear</span>
            </button>
          )}
        </div>

        {/* Order Type Selector */}
        <GuidanceTooltip guideKey="pos_order_type" position="bottom" className="w-full">
          <div className={`grid grid-cols-3 gap-1 p-1 rounded-xl w-full ${
            isTessera ? 'bg-[#0A1410] border border-[#2A4A37]' : 'bg-[#F5F0EB]'
          }`}>
            {orderTypeOptions.map((opt) => {
              const isSelected = orderType === opt.type;
              return (
                <button
                  key={opt.type}
                  onClick={() => setOrderType(opt.type)}
                  className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs transition-all ${
                    isSelected
                      ? isTessera
                        ? 'bg-[#C5F82A] text-[#0A1410] font-semibold shadow-[2px_2px_0_#1F3D2E]'
                        : 'bg-white text-[#1C1917] font-semibold shadow-xs'
                      : isTessera
                      ? 'text-[#9BB5A5] hover:text-[#F5F4EE]'
                      : 'text-[#57534E] hover:text-[#1C1917]'
                  }`}
                >
                  {opt.icon}
                  <span>{opt.label}</span>
                </button>
              );
            })}
          </div>
        </GuidanceTooltip>

        {/* Dine-in Table Selector */}
        {orderType === 'dine_in' && (
          <GuidanceTooltip guideKey="pos_table_picker" position="bottom" className="w-full">
            <div className="w-full">
              <div className="text-[11px] font-semibold text-[#57534E] uppercase tracking-wider mb-1.5 flex justify-between">
                <span>Select Table</span>
                {selectedTableId && (
                  <button
                    onClick={() => setSelectedTableId(null)}
                    className="text-[#F97316] hover:underline"
                  >
                    Clear Table
                  </button>
                )}
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {tables.map((tbl) => {
                  const isSelected = selectedTableId === tbl.id;
                  const isOccupied = tbl.status === 'occupied';
                  return (
                    <button
                      key={tbl.id}
                      onClick={() => setSelectedTableId(tbl.id)}
                      className={`py-1.5 px-2 rounded-lg text-xs border text-center transition-all ${
                        isSelected
                          ? 'border-[#F97316] bg-[#FFF1E6] font-bold text-[#F97316] ring-1 ring-[#F97316]'
                          : isOccupied
                          ? 'border-amber-300 bg-amber-50 text-amber-900'
                          : 'border-[#E9E0D6] bg-white hover:bg-[#F5F0EB] text-[#1C1917]'
                      }`}
                    >
                      <div className="font-semibold truncate">{tbl.label.split(' ')[0]}</div>
                      <div className="text-[10px] opacity-75">
                        {isOccupied ? 'Busy' : `${tbl.seats}s`}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </GuidanceTooltip>
        )}

        {/* Customer & Loyalty Selector */}
        <GuidanceTooltip guideKey="pos_cart_customer" position="top" className="w-full pt-1">
          <div className="w-full">
            {selectedCustomer ? (
              <div className="flex items-center justify-between p-2 rounded-xl bg-[#F5F3FF] border border-[#DDD6FE]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-[#7C3AED] text-white flex items-center justify-center font-bold text-xs shrink-0">
                  {selectedCustomer.name.charAt(0)}
                </div>
                <div className="overflow-hidden">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-bold text-[#1C1917] truncate">
                      {selectedCustomer.name}
                    </span>
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full uppercase tracking-wider ${
                        (selectedCustomer.tier || getCustomerTier(selectedCustomer.loyalty_points)) === 'Platinum'
                          ? 'bg-purple-100 text-purple-800 border border-purple-300'
                          : (selectedCustomer.tier || getCustomerTier(selectedCustomer.loyalty_points)) === 'Gold'
                          ? 'bg-amber-100 text-amber-800 border border-amber-300'
                          : (selectedCustomer.tier || getCustomerTier(selectedCustomer.loyalty_points)) === 'Silver'
                          ? 'bg-slate-200 text-slate-800 border border-slate-300'
                          : 'bg-[#FFF1E6] text-[#B45309] border border-[#FDE68A]'
                      }`}
                    >
                      {selectedCustomer.tier || getCustomerTier(selectedCustomer.loyalty_points)}
                    </span>
                  </div>
                  <div className="text-[10px] text-[#57534E] flex items-center gap-2 mt-0.5">
                    <span className="font-semibold text-[#7C3AED]">
                      {selectedCustomer.loyalty_points} pts (₹{selectedCustomer.loyalty_points})
                    </span>
                    {subtotal > 0 && (
                      <span className="text-[#17803D] font-medium">
                        • Earns +{Math.floor(subtotal / 10)} pts
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <button
                onClick={() => {
                  setSelectedCustomerId(null);
                  setRedeemedPoints(0);
                }}
                className="text-[11px] text-[#57534E] hover:text-[#B42318] px-2 py-1 rounded-md hover:bg-[#F5F0EB]"
              >
                Change
              </button>
            </div>
          ) : (
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsCustomerSelectorOpen(!isCustomerSelectorOpen)}
                className="w-full flex items-center justify-between px-3 py-1.5 text-xs rounded-xl border border-[#E9E0D6] bg-white hover:bg-[#F5F0EB] text-[#57534E]"
              >
                <div className="flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" />
                  <span>Attach Customer (Earn 1 pt per ₹10 spent)</span>
                </div>
                <span className="text-[11px] text-[#F97316] font-medium">Select</span>
              </button>

              {isCustomerSelectorOpen && (
                <div className="absolute top-full left-0 mt-1 w-full bg-white border border-[#E9E0D6] rounded-xl shadow-lg p-2 z-30 max-h-64 overflow-y-auto space-y-1">
                  {/* Phone / Name Search Input */}
                  <div className="pb-1 mb-1 border-b border-[#E9E0D6]">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-[#A8A29E]" />
                      <input
                        type="text"
                        value={customerSearchQuery}
                        onChange={(e) => setCustomerSearchQuery(e.target.value)}
                        placeholder="Search phone (e.g. 98200) or name..."
                        className="w-full pl-7 pr-2 py-1 text-xs rounded-lg border border-[#E9E0D6] bg-[#FFF9F2] focus:bg-white focus:outline-none text-[#1C1917]"
                        autoFocus
                      />
                    </div>
                  </div>

                  <div className="text-[10px] font-semibold text-[#A8A29E] uppercase px-1 py-0.5 flex items-center justify-between">
                    <span>Customer</span>
                    <span>Points Balance</span>
                  </div>

                  {customers
                    .filter((c) => {
                      if (!customerSearchQuery.trim()) return true;
                      const q = customerSearchQuery.toLowerCase();
                      return c.name.toLowerCase().includes(q) || c.phone.includes(q);
                    })
                    .map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setSelectedCustomerId(c.id);
                          setIsCustomerSelectorOpen(false);
                          setCustomerSearchQuery('');
                        }}
                        className="w-full text-left p-2 rounded-lg hover:bg-[#F5F0EB] text-xs flex items-center justify-between transition-colors"
                      >
                        <div>
                          <div className="font-semibold text-[#1C1917] flex items-center gap-1.5">
                            <span>{c.name}</span>
                            <span className="text-[9px] px-1.5 py-0.2 rounded-full font-medium bg-[#F5F0EB] text-[#57534E]">
                              {c.tier || getCustomerTier(c.loyalty_points)}
                            </span>
                          </div>
                          <div className="text-[10px] text-[#57534E] font-mono">{c.phone}</div>
                        </div>
                        <span className="text-[11px] font-bold text-[#7C3AED]">
                          {c.loyalty_points} pts
                        </span>
                      </button>
                    ))}

                  {customers.filter((c) => {
                    if (!customerSearchQuery.trim()) return true;
                    const q = customerSearchQuery.toLowerCase();
                    return c.name.toLowerCase().includes(q) || c.phone.includes(q);
                  }).length === 0 && (
                    <div className="p-2 text-center text-xs text-[#57534E]">
                      <p>No customer found matching "{customerSearchQuery}"</p>
                      <button
                        type="button"
                        onClick={() => {
                          const isPhone = /^[0-9+ -]{7,15}$/.test(customerSearchQuery);
                          const newC = addCustomer(
                            isPhone ? `Customer (${customerSearchQuery.slice(-4)})` : customerSearchQuery,
                            isPhone ? customerSearchQuery : '+91 98000 00000'
                          );
                          setSelectedCustomerId(newC.id);
                          setIsCustomerSelectorOpen(false);
                          setCustomerSearchQuery('');
                        }}
                        className="mt-1.5 px-3 py-1 bg-[#7C3AED] hover:bg-[#6D28D9] text-white rounded-lg font-bold text-xs shadow-xs"
                      >
                        + Quick Register "{customerSearchQuery}"
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </GuidanceTooltip>

          {/* Loyalty Points Redemption Panel */}
          {selectedCustomer && selectedCustomer.loyalty_points > 0 && subtotal > 0 && (
            <GuidanceTooltip guideKey="pos_loyalty_redemption" position="top" className="w-full">
              <div className="mt-2 p-2.5 bg-[#FFF9F2] rounded-xl border border-[#E9E0D6] space-y-2 text-xs w-full">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1 text-[#7C3AED] font-semibold text-xs">
                    <Coins className="w-3.5 h-3.5" />
                    <span>Redeem Loyalty Points (1 pt = ₹1)</span>
                  </div>
                  {redeemedPoints > 0 && (
                    <button
                      type="button"
                      onClick={() => setRedeemedPoints(0)}
                      className="text-[10px] font-medium text-rose-600 hover:underline"
                    >
                      Remove
                    </button>
                  )}
                </div>

                {redeemedPoints > 0 ? (
                  <div className="flex items-center justify-between p-2 rounded-lg bg-purple-100 text-purple-900 border border-purple-200">
                    <span className="font-medium text-xs">
                      Redeeming {redeemedPoints} pts discount
                    </span>
                    <span className="font-bold font-mono text-xs text-[#7C3AED]">
                      -₹{redeemedPoints} off
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                    {[25, 50, 100].map((pts) => {
                      if (pts > maxRedeemablePoints) return null;
                      return (
                        <button
                          key={pts}
                          type="button"
                          onClick={() => setRedeemedPoints(pts)}
                          className="px-2 py-1 rounded-lg text-[10px] font-semibold bg-white border border-[#DDD6FE] text-[#7C3AED] hover:bg-[#F5F3FF] transition-colors shadow-2xs"
                        >
                          Use ₹{pts} ({pts} pts)
                        </button>
                      );
                    })}
                    {maxRedeemablePoints > 0 && (
                      <button
                        type="button"
                        onClick={() => setRedeemedPoints(maxRedeemablePoints)}
                        className="px-2 py-1 rounded-lg text-[10px] font-bold bg-[#7C3AED] text-white hover:bg-[#6D28D9] transition-colors shadow-2xs"
                      >
                        Use Max (₹{maxRedeemablePoints})
                      </button>
                    )}
                  </div>
                )}
              </div>
            </GuidanceTooltip>
          )}
        </div>

      {/* Cart Items List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {safeCart.length === 0 ? (
          <div className={`h-full flex flex-col items-center justify-center text-center p-6 ${
            isTessera ? 'text-[#6B8579]' : 'text-[#A8A29E]'
          }`}>
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-3 ${
              isTessera ? 'bg-[#142620] border border-[#2A4A37]' : ''
            }`}>
              <ShoppingBag className={`w-8 h-8 stroke-[1.5] ${isTessera ? 'text-[#2A4A37]' : 'text-[#E9E0D6]'}`} />
            </div>
            <div className={`font-serif italic text-lg ${isTessera ? 'text-[#F5F4EE]' : 'font-sans not-italic font-semibold text-sm text-[#57534E]'}`}>
              Order is Empty
            </div>
            <div className={`text-xs max-w-xs mt-1 ${isTessera ? 'text-[#6B8579]' : 'text-[#A8A29E]'}`}>
              Select items from the menu grid to start building the order.
            </div>
          </div>
        ) : (
          safeCart.map((item) => (
            <div
              key={item.id}
              className={`p-3 rounded-xl border transition-all space-y-2 ${
                isTessera
                  ? 'bg-[#0A1410] border-[#1F3D2E] hover:border-[#2A4A37]'
                  : 'bg-white border-[#E9E0D6] hover:border-[#D5C9BD]'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2">
                  <span
                    className={`mt-1 w-2.5 h-2.5 rounded-xs border shrink-0 flex items-center justify-center p-0.5 ${
                      item.menu_item.is_veg
                        ? isTessera ? 'border-[#34D399]' : 'border-emerald-600'
                        : isTessera ? 'border-[#F87171]' : 'border-red-600'
                    }`}
                  >
                    <span
                      className={`w-1 h-1 rounded-full ${
                        item.menu_item.is_veg
                          ? isTessera ? 'bg-[#34D399]' : 'bg-emerald-600'
                          : isTessera ? 'bg-[#F87171]' : 'bg-red-600'
                      }`}
                    />
                  </span>
                  <div>
                    <h4 className={`font-semibold text-xs leading-tight ${
                      isTessera ? 'text-[#F5F4EE]' : 'text-[#1C1917]'
                    }`}>
                      {item.menu_item.name}
                    </h4>
                    {item.variant && (
                      <div className={`text-[10px] ${isTessera ? 'text-[#9BB5A5]' : 'text-[#57534E]'}`}>Size: {item.variant.name}</div>
                    )}
                    {(item.addons || []).map((a) => (
                      <div key={a.addon_id} className={`text-[10px] ${isTessera ? 'text-[#9BB5A5]' : 'text-[#57534E]'}`}>
                        + {a.name} (+₹{a.price})
                      </div>
                    ))}
                    {item.notes && (
                      <div className={`text-[10px] italic ${isTessera ? 'text-[#C5F82A]' : 'text-[#F97316]'}`}>
                        Note: "{item.notes}"
                      </div>
                    )}
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className={`font-mono font-bold text-xs tabular-nums ${
                    isTessera ? 'text-[#C5F82A]' : 'text-[#1C1917]'
                  }`}>
                    ₹{item.item_total}
                  </div>
                  <div className={`text-[10px] font-mono ${isTessera ? 'text-[#6B8579]' : 'text-[#A8A29E]'}`}>
                    ₹{item.unit_price} each
                  </div>
                </div>
              </div>

              {/* Item Qty Controls */}
              <div className={`flex items-center justify-between pt-1 border-t ${
                isTessera ? 'border-[#1F3D2E]' : 'border-[#F5F0EB]'
              }`}>
                <button
                  onClick={() => removeFromCart(item.id)}
                  className={`text-[10px] flex items-center gap-1 ${
                    isTessera ? 'text-[#6B8579] hover:text-[#F87171]' : 'text-[#A8A29E] hover:text-[#B42318]'
                  }`}
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Remove</span>
                </button>

                <div className={`flex items-center gap-2 px-2 py-0.5 rounded-lg ${
                  isTessera ? 'bg-[#142620] border border-[#2A4A37]' : 'bg-[#F5F0EB]'
                }`}>
                  <button
                    onClick={() => updateCartQty(item.id, -1)}
                    className={`p-0.5 ${isTessera ? 'text-[#9BB5A5] hover:text-[#C5F82A]' : 'text-[#57534E] hover:text-[#1C1917]'}`}
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className={`font-bold text-xs font-mono min-w-4 text-center tabular-nums ${
                    isTessera ? 'text-[#F5F4EE]' : ''
                  }`}>
                    {item.qty}
                  </span>
                  <button
                    onClick={() => updateCartQty(item.id, 1)}
                    className={`p-0.5 ${isTessera ? 'text-[#9BB5A5] hover:text-[#C5F82A]' : 'text-[#57534E] hover:text-[#1C1917]'}`}
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Cart Footer: Discount / Totals / Checkout */}
      {safeCart.length > 0 && (
        <div className={`p-4 border-t space-y-3 ${
          isTessera ? 'border-[#1F3D2E] bg-[#0A1410]' : 'border-[#E9E0D6] bg-[#FFF9F2]'
        }`}>
          {/* Coupon Form */}
          {appliedOffer ? (
            <div className={`flex items-center justify-between p-2 rounded-xl border text-xs ${
              isTessera
                ? 'bg-[#34D399]/10 border-[#34D399]/30'
                : 'bg-[#E8F5EC] border-[#A7F3D0]'
            }`}>
              <div className={`flex items-center gap-1.5 font-medium ${isTessera ? 'text-[#34D399]' : 'text-[#17803D]'}`}>
                <Tag className="w-3.5 h-3.5" />
                <span>Coupon <strong>{appliedOffer.code}</strong> applied</span>
              </div>
              <button
                onClick={removeOffer}
                className={`text-[11px] ${isTessera ? 'text-[#9BB5A5] hover:text-[#F87171]' : 'text-[#57534E] hover:text-[#B42318]'}`}
              >
                Remove
              </button>
            </div>
          ) : (
            <form onSubmit={handleApplyCoupon} className="space-y-1">
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value)}
                  placeholder="Coupon code (e.g. WELCOME50)"
                  className={`flex-1 px-2.5 py-1.5 text-xs uppercase font-mono rounded-xl border focus:outline-hidden ${
                    isTessera
                      ? 'border-[#2A4A37] bg-[#0F1D17] text-[#F5F4EE] placeholder:text-[#6B8579] focus:border-[#C5F82A]'
                      : 'border-[#E9E0D6] bg-white focus:border-[#F97316]'
                  }`}
                />
                <button
                  type="submit"
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                    isTessera
                      ? 'tessera-ghost rounded-lg'
                      : 'bg-[#1C1917] text-white hover:bg-black'
                  }`}
                >
                  Apply
                </button>
              </div>
              {couponError && <div className={`text-[10px] ${isTessera ? 'text-[#F87171]' : 'text-[#B42318]'}`}>{couponError}</div>}
              {couponSuccess && <div className={`text-[10px] ${isTessera ? 'text-[#34D399]' : 'text-[#17803D]'}`}>{couponSuccess}</div>}
            </form>
          )}

          {/* Subtotal, GST, Platform Fee */}
          <div className={`space-y-1 text-xs ${isTessera ? 'text-[#9BB5A5]' : 'text-[#57534E]'}`}>
            <div className="flex justify-between">
              <span>Items Subtotal</span>
              <span className="font-mono tabular-nums">₹{subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>GST (5%)</span>
              <span className="font-mono tabular-nums">₹{taxTotal.toFixed(2)}</span>
            </div>
            {discountTotal > 0 && (
              <div className={`flex justify-between font-medium ${isTessera ? 'text-[#34D399]' : 'text-[#17803D]'}`}>
                <span>Total Discount</span>
                <span className="font-mono tabular-nums">- ₹{discountTotal.toFixed(2)}</span>
              </div>
            )}
            <GuidanceTooltip guideKey="pos_fee_engine" position="top" className="w-full">
              <div className="flex justify-between items-center text-xs w-full py-0.5">
                <span className="flex items-center gap-1">
                  <span>TSOS Platform Fee</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-medium ${
                    isTessera ? 'bg-[#C5F82A]/10 text-[#C5F82A] border border-[#C5F82A]/30' : 'bg-[#FFF1E6] text-[#F97316]'
                  }`}>
                    {feePayer === 'cafe' ? 'Absorbed by Cafe' : 'Paid by Customer'}
                  </span>
                </span>
                <span className="font-mono tabular-nums">
                  {feePayer === 'customer' ? `+ ₹${platformFee}` : '₹0.00'}
                </span>
              </div>
            </GuidanceTooltip>

            <div className={`flex justify-between text-base font-bold pt-2 border-t ${
              isTessera ? 'text-[#F5F4EE] border-[#2A4A37]' : 'text-[#1C1917] border-[#E9E0D6]'
            }`}>
              <span>To Pay</span>
              <span className={`font-mono text-lg tabular-nums ${isTessera ? 'text-[#C5F82A]' : 'text-[#F97316]'}`}>
                ₹{grandTotal}
              </span>
            </div>
          </div>

          {/* Checkout Button */}
          <GuidanceTooltip guideKey="pos_checkout_button" position="top" className="w-full">
            <button
              type="button"
              onClick={onOpenPayment}
              className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-colors ${
                isTessera
                  ? 'tessera-cta rounded-lg'
                  : 'bg-[#F97316] hover:bg-[#EA580C] text-white shadow-xs'
              }`}
            >
              <span>Charge / Pay (₹{grandTotal})</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </GuidanceTooltip>
        </div>
      )}
    </aside>
  );
};
