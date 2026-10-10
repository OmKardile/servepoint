import React, { useState } from 'react';
import { useTsosStore } from '../../lib/store';
import { Offer } from '../../types';
import { Tag, Plus, Check, Percent, Gift, Calendar, X } from 'lucide-react';

export const OffersScreen: React.FC = () => {
  const { offers, toggleOffer, addOffer, location, themeMode } = useTsosStore();
  const isServepoint = themeMode === 'servepoint';

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [code, setCode] = useState('');
  const [title, setTitle] = useState('');
  const [type, setType] = useState<'percent' | 'flat' | 'bogo'>('percent');
  const [value, setValue] = useState(15);
  const [minOrderValue, setMinOrderValue] = useState(150);

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !title.trim()) return;
    addOffer({
      location_id: location.id,
      code: code.trim().toUpperCase(),
      title: title.trim(),
      type,
      value,
      min_order_value: minOrderValue,
      valid_from: '2026-01-01',
      valid_to: '2026-12-31',
      is_active: true,
    });
    setCode('');
    setTitle('');
    setIsAddModalOpen(false);
  };

  return (
    <div
      className={`flex-1 flex flex-col h-[calc(100vh-100px)] overflow-hidden ${
        isServepoint ? 'bg-[#F6F5F2]' : 'bg-[#FFF9F2]'
      }`}
    >
      <div
        className={`p-4 border-b flex flex-wrap items-center justify-between gap-3 ${
          isServepoint ? 'bg-white border-[#E3E7E0]' : 'bg-white border-[#E9E0D6]'
        }`}
      >
        <div className="flex items-center gap-2.5">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center ${
              isServepoint ? 'sp-surface text-[#0F3D3E]' : 'bg-[#FFF1E6] text-[#F97316]'
            }`}
          >
            <Tag className="w-5 h-5" />
          </div>
          <div>
            <h2
              className={`text-base font-bold leading-tight ${
                isServepoint ? 'text-[#1A1A1A]' : 'text-[#1C1917]'
              }`}
            >
              Promotional Offers & Discounts
            </h2>
            <div className={`text-xs ${isServepoint ? 'text-[#6B6B6B]' : 'text-[#57534E]'}`}>
              Coupon codes applied at POS and Customer QR Storefront
            </div>
          </div>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold ${
            isServepoint ? 'sp-cta' : 'rounded-xl bg-[#F97316] hover:bg-[#EA580C] text-white shadow-xs'
          }`}
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Create Coupon</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {offers.map((offer) => (
            <div
              key={offer.id}
              className={`rounded-2xl border p-4 shadow-xs flex flex-col justify-between transition-all ${
                isServepoint
                  ? `bg-white border-[#E3E7E0] hover:border-[#B88E2F] ${
                      offer.is_active ? '' : 'opacity-60 bg-[#F6F5F2]'
                    }`
                  : `bg-white ${
                      offer.is_active ? 'border-[#E9E0D6]' : 'border-[#E9E0D6] opacity-60 bg-[#FAFAFA]'
                    }`
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold ${
                        isServepoint ? 'sp-surface text-[#0F3D3E]' : 'bg-[#FFF1E6] text-[#F97316]'
                      }`}
                    >
                      {offer.type === 'percent' ? (
                        <Percent className="w-4 h-4" />
                      ) : (
                        <Gift className="w-4 h-4" />
                      )}
                    </div>
                    <div>
                      <span
                        className={`font-mono font-bold text-sm tracking-wider px-2 py-0.5 rounded-md border ${
                          isServepoint
                            ? 'text-[#0F3D3E] bg-[#D9E2DD]/60 border-[#6B8579]/30'
                            : 'text-[#1C1917] bg-[#F5F0EB] border-[#E9E0D6]'
                        }`}
                      >
                        {offer.code}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => toggleOffer(offer.id)}
                    className={`px-2 py-0.5 rounded-full text-[10px] font-semibold transition-colors ${
                      offer.is_active
                        ? isServepoint
                          ? 'bg-[#D9E2DD] text-[#0F3D3E]'
                          : 'bg-[#E8F5EC] text-[#17803D]'
                        : isServepoint
                          ? 'bg-[#DC2626]/10 text-[#DC2626]'
                          : 'bg-[#FEF2F2] text-[#B42318]'
                    }`}
                  >
                    {offer.is_active ? 'Active' : 'Disabled'}
                  </button>
                </div>

                <h3
                  className={`font-bold text-sm mt-3 leading-tight ${
                    isServepoint ? 'text-[#1A1A1A]' : 'text-[#1C1917]'
                  }`}
                >
                  {offer.title}
                </h3>

                <div className={`mt-3 space-y-1 text-xs ${isServepoint ? 'text-[#6B6B6B]' : 'text-[#57534E]'}`}>
                  <div className="flex justify-between">
                    <span>Discount Value:</span>
                    <strong className={isServepoint ? 'text-[#0F3D3E] font-semibold' : 'text-[#1C1917] font-mono'}>
                      {offer.type === 'percent' ? `${offer.value}% off` : `₹${offer.value} flat`}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Min Order Requirement:</span>
                    <span className={isServepoint ? 'text-[#1A1A1A]' : 'font-mono'}>
                      ₹{offer.min_order_value}
                    </span>
                  </div>
                  <div
                    className={`flex justify-between text-[11px] pt-1 ${
                      isServepoint ? 'text-[#6B8579]' : 'text-[#A8A29E]'
                    }`}
                  >
                    <span>Valid:</span>
                    <span>Till Dec 31, 2026</span>
                  </div>
                </div>
              </div>

              <div
                className={`pt-3 border-t flex justify-end ${
                  isServepoint ? 'border-[#E3E7E0]' : 'border-[#F5F0EB]'
                }`}
              >
                <button
                  onClick={() => toggleOffer(offer.id)}
                  className={`text-xs font-semibold hover:underline ${
                    isServepoint ? 'text-[#B88E2F] hover:text-[#967221]' : 'text-[#F97316]'
                  }`}
                >
                  {offer.is_active ? 'Pause Offer' : 'Activate Offer'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Add Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div
            className={`bg-white rounded-2xl max-w-sm w-full border p-5 shadow-xl ${
              isServepoint ? 'border-[#E3E7E0]' : 'border-[#E9E0D6]'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className={`font-bold text-sm ${isServepoint ? 'text-[#1A1A1A]' : 'text-[#1C1917]'}`}>
                Create New Promo Code
              </h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-[#A8A29E]">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-3">
              <div>
                <label
                  className={`block text-xs font-semibold mb-1 ${
                    isServepoint ? 'text-[#6B6B6B]' : 'text-[#57534E]'
                  }`}
                >
                  Coupon Code (uppercase)
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="e.g. MONSOON20"
                  className={`w-full px-3 py-2 text-xs font-mono font-bold uppercase rounded-xl border focus:outline-hidden ${
                    isServepoint
                      ? 'border-[#E3E7E0] focus:border-[#0F3D3E]'
                      : 'border-[#E9E0D6] focus:border-[#F97316]'
                  }`}
                />
              </div>

              <div>
                <label
                  className={`block text-xs font-semibold mb-1 ${
                    isServepoint ? 'text-[#6B6B6B]' : 'text-[#57534E]'
                  }`}
                >
                  Offer Title / Description
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. 20% Off Weekend Specials"
                  className={`w-full px-3 py-2 text-xs rounded-xl border focus:outline-hidden ${
                    isServepoint
                      ? 'border-[#E3E7E0] focus:border-[#0F3D3E]'
                      : 'border-[#E9E0D6] focus:border-[#F97316]'
                  }`}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label
                    className={`block text-xs font-semibold mb-1 ${
                      isServepoint ? 'text-[#6B6B6B]' : 'text-[#57534E]'
                    }`}
                  >
                    Type
                  </label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as any)}
                    className={`w-full px-2 py-2 text-xs rounded-xl border bg-white focus:outline-hidden ${
                      isServepoint ? 'border-[#E3E7E0]' : 'border-[#E9E0D6]'
                    }`}
                  >
                    <option value="percent">Percentage (%)</option>
                    <option value="flat">Flat Cash (₹)</option>
                  </select>
                </div>

                <div>
                  <label
                    className={`block text-xs font-semibold mb-1 ${
                      isServepoint ? 'text-[#6B6B6B]' : 'text-[#57534E]'
                    }`}
                  >
                    Value ({type === 'percent' ? '%' : '₹'})
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={value}
                    onChange={(e) => setValue(Number(e.target.value) || 0)}
                    className={`w-full px-3 py-2 text-xs font-bold rounded-xl border focus:outline-hidden ${
                      isServepoint ? 'border-[#E3E7E0] text-[#0F3D3E]' : 'border-[#E9E0D6] font-mono'
                    }`}
                  />
                </div>
              </div>

              <div>
                <label
                  className={`block text-xs font-semibold mb-1 ${
                    isServepoint ? 'text-[#6B6B6B]' : 'text-[#57534E]'
                  }`}
                >
                  Min Order Subtotal (₹)
                </label>
                <input
                  type="number"
                  required
                  min={0}
                  value={minOrderValue}
                  onChange={(e) => setMinOrderValue(Number(e.target.value) || 0)}
                  className={`w-full px-3 py-2 text-xs rounded-xl border focus:outline-hidden ${
                    isServepoint ? 'border-[#E3E7E0] text-[#1A1A1A]' : 'border-[#E9E0D6] font-mono'
                  }`}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className={`px-3 py-1.5 text-xs ${
                    isServepoint ? 'text-[#6B6B6B] hover:text-[#1A1A1A]' : 'text-[#57534E]'
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`px-4 py-1.5 text-xs font-semibold ${
                    isServepoint
                      ? 'bg-[#0F3D3E] text-white rounded-xl hover:bg-[#0B3132]'
                      : 'bg-[#F97316] text-white rounded-xl shadow-xs'
                  }`}
                >
                  Create Offer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
