import React, { useEffect, useRef, useState } from 'react';
import { Minus, Plus, UtensilsCrossed, X } from 'lucide-react';
import type { MenuItem, MenuItemAddon } from '../../types';
import { useCart } from '../../store/cart';
import { formatMoney } from '../../lib/prefs';

/**
 * Item detail modal (Figma Frame_30_219-30083):
 * sage photo header, name + weight/description, gold price, per-item quantity
 * stepper, add-on rows with − qty + steppers (gold +), full-width gold CTA.
 */

interface ItemDetailModalProps {
  item: MenuItem;
  onClose: () => void;
  /** Fired after the selection is pushed into the cart (for the toast). */
  onAdded?: (info: { name: string; qty: number }) => void;
}

const MAX_QTY = 99;

export const ItemDetailModal: React.FC<ItemDetailModalProps> = ({ item, onClose, onAdded }) => {
  const [qty, setQty] = useState(1);
  // Frame shows every add-on row resting at "1x" — the − button removes it.
  const [addonQty, setAddonQty] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    (item.addons || []).forEach((a) => {
      init[a.id] = 1;
    });
    return init;
  });
  const [imgFailed, setImgFailed] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const bumpQty = (delta: number) => setQty((q) => Math.min(MAX_QTY, Math.max(1, q + delta)));

  const bumpAddon = (addon: MenuItemAddon, delta: number) =>
    setAddonQty((prev) => ({ ...prev, [addon.id]: Math.min(MAX_QTY, Math.max(0, (prev[addon.id] || 0) + delta)) }));

  const handleAdd = () => {
    const selected: MenuItemAddon[] = [];
    (item.addons || []).forEach((a) => {
      const n = addonQty[a.id] || 0;
      for (let i = 0; i < n; i += 1) selected.push(a);
    });
    useCart.getState().add(item, qty, selected);
    onAdded?.({ name: item.name, qty });
    onClose();
  };

  const detail = (item.description || '').trim();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F3D3E]/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`${item.name} details`}
      onClick={onClose}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="relative flex max-h-[92vh] w-full max-w-sm flex-col overflow-hidden rounded-[24px] border border-[#E3E7E0] bg-white shadow-2xl outline-none"
      >
        {/* Close */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close item details"
          className="absolute right-3 top-3 z-10 flex h-11 w-11 items-center justify-center rounded-full border border-[#E3E7E0] bg-white/90 text-[#6B6B6B] transition-colors hover:bg-white hover:text-[#1A1A1A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#967221]"
        >
          <X size={18} aria-hidden />
        </button>

        {/* Scrollable body */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {/* Photo header on sage */}
          <div className="flex justify-center bg-[#D9E2DD] p-5">
            {item.image_url && !imgFailed ? (
              <img
                src={item.image_url}
                alt={item.name}
                onError={() => setImgFailed(true)}
                className="h-44 w-full rounded-2xl object-cover"
              />
            ) : (
              <span
                aria-hidden
                className="flex h-44 w-full items-center justify-center rounded-2xl bg-white/55 text-[#0F3D3E]"
              >
                <UtensilsCrossed size={56} />
              </span>
            )}
          </div>

          {/* Name / weight / price */}
          <div className="px-5 pt-4 text-center">
            <h2 className="text-lg font-bold text-[#1A1A1A]">{item.name}</h2>
            {detail && <p className="mt-0.5 truncate text-xs text-[#969696]">{detail}</p>}
            <p className="mt-1.5 text-xl font-bold text-[#B88E2F]">{formatMoney(item.price)}</p>

            {/* Main quantity stepper */}
            <div className="mt-3 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => bumpQty(-1)}
                disabled={qty <= 1}
                aria-label="Reduce quantity"
                className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#E3E7E0] bg-white text-[#6B6B6B] transition-colors hover:text-[#1A1A1A] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#967221]"
              >
                <Minus size={16} aria-hidden />
              </button>
              <span aria-live="polite" className="min-w-9 text-center text-sm font-semibold text-[#1A1A1A]">
                {qty}x
              </span>
              <button
                type="button"
                onClick={() => bumpQty(1)}
                aria-label="Add one more"
                className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#B88E2F] text-white transition-colors hover:bg-[#967221] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#967221]"
              >
                <Plus size={16} aria-hidden />
              </button>
            </div>
          </div>

          {/* Add-ons (hidden when the item has none) */}
          {(item.addons || []).length > 0 && (
            <div className="mt-4 border-t border-[#E3E7E0] px-5 py-4">
              <h3 className="sr-only">Add-ons</h3>
              <ul className="divide-y divide-[#E3E7E0]">
                {(item.addons || []).map((a) => {
                  const n = addonQty[a.id] || 0;
                  return (
                    <li key={a.id} className="flex items-center gap-3 py-2.5">
                      <span
                        aria-hidden
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#D9E2DD] text-sm font-bold text-[#0F3D3E]"
                      >
                        {a.name.charAt(0).toUpperCase()}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-[#1A1A1A]">{a.name}</span>
                      <span className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => bumpAddon(a, -1)}
                          disabled={n <= 0}
                          aria-label={`Remove one ${a.name}`}
                          className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#E3E7E0] bg-white text-[#6B6B6B] transition-colors hover:text-[#1A1A1A] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#967221]"
                        >
                          <Minus size={15} aria-hidden />
                        </button>
                        <span className="min-w-8 text-center text-sm font-semibold text-[#1A1A1A]">{n}x</span>
                        <button
                          type="button"
                          onClick={() => bumpAddon(a, 1)}
                          aria-label={`Add one ${a.name}`}
                          className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#B88E2F] text-white transition-colors hover:bg-[#967221] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#967221]"
                        >
                          <Plus size={15} aria-hidden />
                        </button>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>

        {/* CTA */}
        <div className="border-t border-[#E3E7E0] p-4">
          <button type="button" onClick={handleAdd} className="sp-cta h-12 w-full text-[15px]">
            Add to Order
          </button>
        </div>
      </div>
    </div>
  );
};
