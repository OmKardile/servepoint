import React, { useState, useEffect } from 'react';
import { MenuItem, MenuItemVariant } from '../../types';
import { useTsosStore } from '../../lib/store';
import { X, Check } from 'lucide-react';

interface VariantModalProps {
  item: MenuItem;
  onClose: () => void;
  onConfirm: (variantId?: string, addonIds?: string[], notes?: string) => void;
}

export const VariantModal: React.FC<VariantModalProps> = ({ item, onClose, onConfirm }) => {
  const { addons } = useTsosStore();

  const [selectedVariantId, setSelectedVariantId] = useState<string | undefined>(
    item.variants && item.variants.length > 0 ? item.variants[0].id : undefined
  );
  const [selectedAddonIds, setSelectedAddonIds] = useState<string[]>([]);
  const [notes, setNotes] = useState('');

  // Keyboard accessibility: Escape closes the variant picker, matching the X button.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Available addons for this item
  const safeAddons = addons || [];
  const availableAddons = safeAddons.filter((a) => item.addon_ids?.includes(a.id));

  const selectedVariant: MenuItemVariant | undefined = item.variants?.find(
    (v) => v.id === selectedVariantId
  );
  const currentBasePrice = item.price + (selectedVariant ? selectedVariant.price_delta : 0);
  const currentAddonsPrice = availableAddons
    .filter((a) => selectedAddonIds.includes(a.id))
    .reduce((sum, a) => sum + (a?.price || 0), 0);
  const totalPrice = currentBasePrice + currentAddonsPrice;

  const toggleAddon = (id: string) => {
    setSelectedAddonIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150"
      onClick={(e) => {
        // Click on the backdrop (not inside the modal) closes the picker.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-2xl max-w-md w-full border border-[#E9E0D6] shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-4 border-b border-[#E9E0D6] flex items-center justify-between bg-[#FFF9F2]">
          <div className="flex items-center gap-2">
            <span
              className={`w-3 h-3 rounded-xs border ${
                item.is_veg ? 'border-emerald-600' : 'border-red-600'
              } flex items-center justify-center p-0.5`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  item.is_veg ? 'bg-emerald-600' : 'bg-red-600'
                }`}
              />
            </span>
            <div>
              <h3 className="font-semibold text-base text-[#1C1917] leading-tight">{item.name}</h3>
              <span className="text-xs text-[#57534E]">Customize your selection</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-[#E9E0D6] text-[#57534E] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 overflow-y-auto space-y-5">
          {/* Variants */}
          {item.variants && item.variants.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-[#57534E] uppercase tracking-wider mb-2">
                Choose Size / Option
              </div>
              <div className="grid grid-cols-2 gap-2">
                {item.variants.map((v) => {
                  const isSelected = selectedVariantId === v.id;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setSelectedVariantId(v.id)}
                      className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
                        isSelected
                          ? 'border-[#F97316] bg-[#FFF1E6] text-[#1C1917] ring-1 ring-[#F97316]'
                          : 'border-[#E9E0D6] hover:bg-[#F5F0EB]'
                      }`}
                    >
                      <span className="font-medium text-sm">{v.name}</span>
                      <span className="text-xs text-[#57534E] mt-1 font-mono">
                        {v.price_delta === 0 ? 'Included' : `+ ₹${v.price_delta}`}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Addons */}
          {availableAddons.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-[#57534E] uppercase tracking-wider mb-2">
                Add-ons & Extras
              </div>
              <div className="space-y-1.5">
                {availableAddons.map((addon) => {
                  const isChecked = selectedAddonIds.includes(addon.id);
                  return (
                    <label
                      key={addon.id}
                      className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition-all ${
                        isChecked
                          ? 'border-[#F97316] bg-[#FFF1E6]'
                          : 'border-[#E9E0D6] hover:bg-[#F5F0EB]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-4 h-4 rounded-md border flex items-center justify-center transition-colors ${
                            isChecked
                              ? 'bg-[#F97316] border-[#F97316] text-white'
                              : 'border-[#A8A29E] bg-white'
                          }`}
                        >
                          {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                        <span className="text-sm font-medium text-[#1C1917]">{addon.name}</span>
                      </div>
                      <span className="text-xs font-mono font-medium text-[#57534E]">
                        + ₹{addon.price}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* Special Instructions / Notes */}
          <div>
            <label className="block text-xs font-semibold text-[#57534E] uppercase tracking-wider mb-1.5">
              Special Instructions
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Less spicy, oat milk warm, no sugar"
              className="w-full px-3 py-2 text-sm rounded-xl border border-[#E9E0D6] focus:border-[#F97316] focus:outline-hidden bg-white text-[#1C1917]"
            />
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-[#E9E0D6] bg-[#FFF9F2] flex items-center justify-between">
          <div>
            <div className="text-[11px] text-[#57534E]">Total Price</div>
            <div className="text-lg font-bold text-[#1C1917] font-mono">₹{totalPrice}</div>
          </div>
          <button
            onClick={() => {
              onConfirm(selectedVariantId, selectedAddonIds, notes);
              onClose();
            }}
            className="px-5 py-2.5 rounded-xl font-semibold text-sm bg-[#F97316] hover:bg-[#EA580C] text-white shadow-xs transition-colors"
          >
            Add to Order
          </button>
        </div>
      </div>
    </div>
  );
};
