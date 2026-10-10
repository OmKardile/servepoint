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
  const { addons, themeMode } = useTsosStore();
  const isTessera = themeMode === 'tessera';

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
      className={`fixed inset-0 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150 ${
        isTessera ? 'bg-black/60' : 'bg-black/40'
      }`}
      onClick={(e) => {
        // Click on the backdrop (not inside the modal) closes the picker.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={`rounded-2xl max-w-md w-full overflow-hidden flex flex-col max-h-[90vh] ${
        isTessera
          ? 'bg-[#0F1D17] border border-[#2A4A37] tessera-block'
          : 'bg-white border border-[#E9E0D6] shadow-xl'
      }`}>
        {/* Modal Header */}
        <div className={`p-4 border-b flex items-center justify-between ${
          isTessera ? 'border-[#1F3D2E] bg-[#0A1410]' : 'border-[#E9E0D6] bg-[#FFF9F2]'
        }`}>
          <div className="flex items-center gap-2">
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
            <div>
              <h3 className={`font-semibold text-base leading-tight ${
                isTessera ? 'text-[#F5F4EE] font-serif italic' : 'text-[#1C1917]'
              }`}>
                {item.name}
              </h3>
              <span className={`text-xs ${isTessera ? 'text-[#9BB5A5]' : 'text-[#57534E]'}`}>
                Customize your selection
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close customize dialog"
            className={`p-1 rounded-full transition-colors ${
              isTessera ? 'hover:bg-[#142620] text-[#9BB5A5] hover:text-[#C5F82A]' : 'hover:bg-[#E9E0D6] text-[#57534E]'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 overflow-y-auto space-y-5">
          {/* Variants */}
          {item.variants && item.variants.length > 0 && (
            <div>
              <div className={`text-xs font-semibold uppercase tracking-wider mb-2 ${
                isTessera ? 'text-[#6B8579]' : 'text-[#57534E]'
              }`}>
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
                          ? isTessera
                            ? 'border-[#C5F82A]/60 bg-[#C5F82A]/10 text-[#F5F4EE] ring-1 ring-[#C5F82A]/40'
                            : 'border-[#F97316] bg-[#FFF1E6] text-[#1C1917] ring-1 ring-[#F97316]'
                          : isTessera
                          ? 'border-[#2A4A37] hover:bg-[#142620] text-[#F5F4EE]'
                          : 'border-[#E9E0D6] hover:bg-[#F5F0EB]'
                      }`}
                    >
                      <span className="font-medium text-sm">{v.name}</span>
                      <span className={`text-xs mt-1 font-mono tabular-nums ${
                        isSelected && isTessera ? 'text-[#C5F82A]' : isTessera ? 'text-[#9BB5A5]' : 'text-[#57534E]'
                      }`}>
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
              <div className={`text-xs font-semibold uppercase tracking-wider mb-2 ${
                isTessera ? 'text-[#6B8579]' : 'text-[#57534E]'
              }`}>
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
                          ? isTessera
                            ? 'border-[#C5F82A]/50 bg-[#C5F82A]/10'
                            : 'border-[#F97316] bg-[#FFF1E6]'
                          : isTessera
                          ? 'border-[#2A4A37] hover:bg-[#142620]'
                          : 'border-[#E9E0D6] hover:bg-[#F5F0EB]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-4 h-4 rounded-md border flex items-center justify-center transition-colors ${
                            isChecked
                              ? isTessera
                                ? 'bg-[#C5F82A] border-[#C5F82A] text-[#0A1410]'
                                : 'bg-[#F97316] border-[#F97316] text-white'
                              : isTessera
                              ? 'border-[#6B8579] bg-transparent'
                              : 'border-[#A8A29E] bg-white'
                          }`}
                        >
                          {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                        <span className={`text-sm font-medium ${
                          isTessera ? 'text-[#F5F4EE]' : 'text-[#1C1917]'
                        }`}>
                          {addon.name}
                        </span>
                      </div>
                      <span className={`text-xs font-mono font-medium tabular-nums ${
                        isTessera ? 'text-[#9BB5A5]' : 'text-[#57534E]'
                      }`}>
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
            <label className={`block text-xs font-semibold uppercase tracking-wider mb-1.5 ${
              isTessera ? 'text-[#6B8579]' : 'text-[#57534E]'
            }`}>
              Special Instructions
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Less spicy, oat milk warm, no sugar"
              className={`w-full px-3 py-2 text-sm rounded-xl border focus:outline-hidden transition-colors ${
                isTessera
                  ? 'border-[#2A4A37] bg-[#0A1410] text-[#F5F4EE] placeholder:text-[#6B8579] focus:border-[#C5F82A]'
                  : 'border-[#E9E0D6] focus:border-[#F97316] bg-white text-[#1C1917]'
              }`}
            />
          </div>
        </div>

        {/* Modal Footer */}
        <div className={`p-4 border-t flex items-center justify-between ${
          isTessera ? 'border-[#1F3D2E] bg-[#0A1410]' : 'border-[#E9E0D6] bg-[#FFF9F2]'
        }`}>
          <div>
            <div className={`text-[11px] ${isTessera ? 'text-[#6B8579]' : 'text-[#57534E]'}`}>
              Total Price
            </div>
            <div className={`text-lg font-bold font-mono tabular-nums ${
              isTessera ? 'text-[#C5F82A]' : 'text-[#1C1917]'
            }`}>
              ₹{totalPrice}
            </div>
          </div>
          <button
            onClick={() => {
              onConfirm(selectedVariantId, selectedAddonIds, notes);
              onClose();
            }}
            className={`px-5 py-2.5 rounded-xl font-semibold text-sm transition-colors ${
              isTessera
                ? 'tessera-cta rounded-lg'
                : 'bg-[#F97316] hover:bg-[#EA580C] text-white shadow-xs'
            }`}
          >
            Add to Order
          </button>
        </div>
      </div>
    </div>
  );
};
