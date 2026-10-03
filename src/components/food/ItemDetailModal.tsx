import React, { useRef, useState } from 'react';
import { CircleOff, Minus, Plus, RotateCcw, UtensilsCrossed, X } from 'lucide-react';
import type { MenuItem, MenuItemAddon } from '../../types';
import { useCart } from '../../store/cart';
import { formatMoney } from '../../lib/prefs';
import { useDialogA11y } from '../../lib/useDialogA11y';
import { VegMark } from '../shell/VegMark';

const round2 = (n: number) => Math.round(n * 100) / 100;

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
  /** v5.57.0 — the counter pulls the dish. Resolves true when the menu write
   * landed (the parent owns the optimistic flip, the revert and the toast). */
  onToggleAvailability?: (available: boolean) => Promise<boolean>;
}

const MAX_QTY = 99;

export const ItemDetailModal: React.FC<ItemDetailModalProps> = ({
  item,
  onClose,
  onAdded,
  onToggleAvailability,
}) => {
  const [qty, setQty] = useState(1);
  /* v5.55.0 — add-ons rest at 0x. The old "Frame shows every add-on row
     resting at 1x" initializer was never live (the POS never loaded addons,
     so this section never rendered); enabling the section now must not
     silently reprice every ticket — the guest customizer starts at 0 too,
     and one grammar across both ends beats a dormant mockup. */
  const [addonQty, setAddonQty] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    (item.addons || []).forEach((a) => {
      init[a.id] = 0;
    });
    return init;
  });
  const [imgFailed, setImgFailed] = useState(false);
  /* v5.55.0 — the chosen size/option. null = "As served" (base price), the
     same optional-pick rule the guest customizer has always spoken. */
  const [variantId, setVariantId] = useState<string | null>(null);
  const variant = (item.variants || []).find((v) => v.id === variantId) || null;
  const panelRef = useRef<HTMLDivElement>(null);
  /* v5.57.0 — sold-out flip in flight (double-tap guard, mirror of the Menu
     screen's busyRef rule: one menu write at a time). */
  const [flipBusy, setFlipBusy] = useState(false);
  const unavailable = item.is_available === false;

  const handleToggleAvailability = async () => {
    if (!onToggleAvailability || flipBusy) return;
    setFlipBusy(true);
    try {
      /* The new state IS the current state's negation in the UI sense, but the
         PARAMETER is the new availability: pulled modal → putting back (true);
         live modal → pulling (false). First draft sent `!unavailable` — a
         live dish asked to be put BACK, and the toast cheerfully lied
         "is back on the menu". Caught by instrumented E2E, not by review. */
      await onToggleAvailability(unavailable);
    } finally {
      setFlipBusy(false);
    }
  };

  /* v5.110.0 — the item sheet holds the door (replaces the hand-rolled Escape
     listener + manual panel focus). */
  const dlgRef = useDialogA11y<HTMLDivElement>(onClose, true, panelRef);

  const bumpQty = (delta: number) => setQty((q) => Math.min(MAX_QTY, Math.max(1, q + delta)));

  const bumpAddon = (addon: MenuItemAddon, delta: number) =>
    setAddonQty((prev) => ({ ...prev, [addon.id]: Math.min(MAX_QTY, Math.max(0, (prev[addon.id] || 0) + delta)) }));

  const handleAdd = () => {
    const selected: MenuItemAddon[] = [];
    (item.addons || []).forEach((a) => {
      const n = addonQty[a.id] || 0;
      for (let i = 0; i < n; i += 1) selected.push(a);
    });
    useCart.getState().add(item, qty, selected, variant ? { name: variant.name, priceDelta: Number(variant.price_delta) } : null);
    onAdded?.({ name: item.name, qty });
    onClose();
  };

  const detail = (item.description || '').trim();

  return (
    <div
      ref={dlgRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F3D3E]/45 p-4"
      style={{ animation: 'spFadeIn 160ms ease-out' }}
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
          {/* Photo header on sage — grayscales when pulled (v5.57.0), the same
              honesty the cards on the grid speak. */}
          <div className="flex justify-center bg-[#D9E2DD] p-5">
            {item.image_url && !imgFailed ? (
              <img
                src={item.image_url}
                alt={item.name}
                onError={() => setImgFailed(true)}
                className={`h-44 w-full rounded-2xl object-cover ${unavailable ? 'opacity-70 grayscale' : ''}`}
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
            <h2 className="flex items-center justify-center gap-2 text-lg font-bold text-[#1A1A1A]">
              <VegMark veg={item.is_veg} size={15} />
              {item.name}
            </h2>
            {detail && <p className="mt-0.5 truncate text-xs text-[#969696]">{detail}</p>}
            {/* Sold-out strip (v5.57.0) — the Menu screen's own SOLD OUT tone:
                one vocabulary from the owner's list to the counter modal. */}
            {unavailable && (
              <p className="mx-auto mt-2 inline-flex items-center gap-1.5 rounded-full bg-[#FDF3F2] px-2.5 py-1 text-[10.5px] font-bold tracking-[0.08em] text-[#B4483C]">
                <CircleOff size={12} aria-hidden />
                SOLD OUT
              </p>
            )}
            {/* Running unit price (v5.55.0) — base + chosen variant + live
                add-ons; the cashier never does delta math in their head.
                v5.57.0: rests while the dish is pulled — nothing is being
                sold right now, so nothing is being priced. */}
            <p className={`mt-1.5 text-xl font-bold ${unavailable ? 'text-[#969696]' : 'text-[#B88E2F]'}`}>
              {formatMoney(
                round2(
                  item.price +
                    (variant ? Number(variant.price_delta) : 0) +
                    (item.addons || []).reduce((s, a) => s + (addonQty[a.id] || 0) * Number(a.price), 0),
                ),
              )}
            </p>

            {/* Main quantity stepper — order-building only; a pulled dish has
                no stepper (v5.57.0). */}
            {!unavailable && (
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
            )}
          </div>

          {/* Size / option pills (v5.55.0) — the counter sells the whole dish.
              Optional by the same rule as the guest customizer: no pick = as
              served at the base price; the price row below always shows the
              running unit so the cashier never does delta math in their head.
              v5.57.0: order-building sections rest while the dish is pulled. */}
          {!unavailable && (item.variants || []).length > 0 && (
            <div className="mt-4 border-t border-[#E3E7E0] px-5 py-4">
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#6B6B6B]">
                Choose one · optional
              </h3>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setVariantId(null)}
                  aria-pressed={variantId === null}
                  className={`h-9 rounded-full border px-3.5 text-[12.5px] font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#967221] ${
                    variantId === null
                      ? 'border-transparent bg-[#0F3D3E] text-white shadow-sm'
                      : 'border-[#E3E7E0] bg-white text-[#6B6B6B] hover:border-[#0F3D3E]'
                  }`}
                >
                  As served
                </button>
                {(item.variants || []).map((v) => {
                  const active = variantId === v.id;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setVariantId(v.id)}
                      aria-pressed={active}
                      className={`flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-[12.5px] font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#967221] ${
                        active
                          ? 'border-transparent bg-[#0F3D3E] text-white shadow-sm'
                          : 'border-[#E3E7E0] bg-white text-[#1A1A1A] hover:border-[#0F3D3E]'
                      }`}
                    >
                      {v.name}
                      <span
                        className={`text-[11px] font-bold tabular-nums ${active ? 'text-white/85' : 'text-[#967221]'}`}
                      >
                        {v.price_delta > 0
                          ? `+₹${Number(v.price_delta) % 1 === 0 ? Number(v.price_delta) : Number(v.price_delta).toFixed(2)}`
                          : v.price_delta < 0
                            ? `−₹${Number(-v.price_delta) % 1 === 0 ? Number(-v.price_delta) : Number(-v.price_delta).toFixed(2)}`
                            : '±₹0'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Add-ons (hidden when the item has none, or when pulled) */}
          {!unavailable && (item.addons || []).length > 0 && (
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

          {/* Counter actions (v5.57.0) — the kitchen shouts, the counter pulls.
              A quiet, separated zone: never adjacent to the Add CTA, never
              mistakable for order-building. The write hits the same menu
              row the Menu screen owns; the guest menu follows on its next
              load because the RPC serves available items only. */}
          {!unavailable && onToggleAvailability && (
            <div className="mt-4 border-t border-[#E3E7E0] px-5 py-4">
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#6B6B6B]">
                Counter
              </h3>
              <button
                type="button"
                onClick={handleToggleAvailability}
                disabled={flipBusy}
                aria-label={`Mark ${item.name} as sold out — it disappears from this counter and the guest menu`}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#E3E7E0] bg-white text-[13.5px] font-semibold text-[#B4483C] transition-colors hover:border-[#B4483C]/40 hover:bg-[#FDF3F2] disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#967221]"
              >
                <CircleOff size={15} aria-hidden />
                {flipBusy ? 'Marking sold out…' : 'Mark sold out'}
              </button>
              <p className="mt-1.5 text-center text-[11px] leading-snug text-[#969696]">
                Pulls “{item.name}” from this counter and the guest menu until you bring it back.
              </p>
            </div>
          )}
        </div>

        {/* CTA — order-building while on the menu; the way back when pulled. */}
        <div className="border-t border-[#E3E7E0] p-4">
          {unavailable ? (
            onToggleAvailability ? (
              <button
                type="button"
                onClick={handleToggleAvailability}
                disabled={flipBusy}
                aria-label={`Put ${item.name} back on the menu`}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-[#0F3D3E]/25 bg-white text-[14.5px] font-semibold text-[#0F3D3E] transition-colors hover:border-[#0F3D3E]/50 hover:bg-[#F1F5F4] disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#967221]"
              >
                <RotateCcw size={16} aria-hidden />
                {flipBusy ? 'Putting back…' : 'Put back on the menu'}
              </button>
            ) : (
              <p className="py-3 text-center text-[13px] font-medium text-[#969696]">
                Sold out — bring it back from the Menu screen.
              </p>
            )
          ) : (
            <button type="button" onClick={handleAdd} className="sp-cta h-12 w-full text-[15px]">
              Add to Order
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
