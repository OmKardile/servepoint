import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useUi } from '../../store/session';
import {
  BookOpenText,
  Check,
  ChefHat,
  CircleAlert,
  CircleOff,
  Clock,
  Copy,
  AlertTriangle,
  ImagePlus,
  Layers,
  Loader2,
  MessageCircle,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Trash2,
  TrendingDown,
  Trophy,
  X,
} from 'lucide-react';
import {
  createAddon,
  createCategory,
  createMenuItem,
  createVariant,
  deleteAddon,
  deleteMenuItem,
  deleteVariant,
  fetchAddons,
  fetchCategories,
  fetchInventory,
  fetchItemUnitCosts,
  fetchMenuItemAddonIds,
  fetchMenuItems,
  fetchMenuVariants,
  fetchPaidMoverLines,
  fetchRecipeLines,
  renameCategory,
  removeMenuItemPhoto,
  setItemAddons,
  updateMenuItem,
  uploadMenuItemPhoto,
  type Addon,
  type Category,
  type InventoryItem,
  type MenuVariant,
  type RecipeLine,
} from '../../lib/api';
import { computePaceByItem, computeTopMovers, MOVER_WINDOW_DAYS, type Mover } from '../../lib/movers';
import { shelfCoverage, shelfDays, type ShelfCoverage } from '../../lib/shelf';
import { appFormatters, appTzTag, appTodayIso } from '../../lib/appday';
import { useTenant } from '../../lib/tenant';
import { formatMoney } from '../../lib/prefs';
/* v5.280.0 — the rounding rides money.ts's round2 (the ONE arithmetic home). */
import { round2 } from '../../lib/money';
import { downloadCsv } from '../../lib/csv';
import { useExportFlash } from '../../lib/useExportFlash';
import { useTransientFlag } from '../../lib/useTransientFlag';
import { useCopyAck, ackWord } from '../../lib/useCopyAck';
import { CsvExportButton } from '../common/CsvExportButton';
import { useDialogA11y } from '../../lib/useDialogA11y';
import { MarkHit } from '../shell/MarkHit';
import type { MenuItem } from '../../types';

/**
 * Menu management (v5.3.0) — the owner-facing side of "create menu item with
 * variants or addons": categories, items, per-item options (variants with a
 * price delta), a tenant-level add-on library, and which add-ons each item
 * offers. What lands here is exactly what the counter POS and the guest QR
 * menu render — one menu, every surface.
 *
 * v5.75.0 — the dish's true price: every card now states what the dish COSTS
 * to put on the plate (the 018 recipe view, the same truth Reports' earner's
 * list speaks) and what it KEEPS — so thin margins show at the surface where
 * prices are set, not just in the back office. A dish without a recipe says
 * so honestly instead of pretending its cost is zero.
 *
 * v5.171.0 — the house catalog: the menu gains its private voice. The chat
 * menu (5.152.0) is the guest's copy; the Catalog CSV is the owner's own
 * spreadsheet — costs, kept margins, mover ranks and availability ride out
 * together, and an unpriced dish leaves its cost cells EMPTY (never ₹0).
 * The header strip reads the menu's health at a glance — sold out, no
 * recipe, priced under cost, keeps under 25%, thin — with the names riding
 * the tooltips. 5.191.0 — the <25% band split from the loss-makers: a dish
 * keeping 12% is a squeeze, not "priced under cost"; the words now match
 * the arithmetic they name (a sale must lose money or break even to wear
 * the loss chip).
 *
 * v5.173.0 — the menu's expiry dates: the shelf's days voice (5.172.0,
 * src/lib/shelf.ts) joins the owner's sheet. The catalog gains a "Days of
 * cover" column — the shelf's answer ÷ the paid week's pace, floored ONCE
 * at the screen's own memo (daysByItem) so the CSV, the strip's amber
 * "dry within the week" forecast chip and the per-row clock all read ONE
 * number per dish. Silence rules ride the family: no recipe, unknown shelf
 * or no paid pace → EMPTY cell, no clock, never an invented figure. Zero
 * on the sheet is a truth ("dry within a day"), not a fabrication — the
 * EMPTY-vs-zero line is drawn where the shelf stops answering.
 */


const VegDot: React.FC<{ veg: boolean }> = ({ veg }) => (
  <span
    className="flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border"
    title={veg ? 'Vegetarian' : 'Non-vegetarian'}
    style={{ borderColor: veg ? '#2E7D32' : '#B4483C' }}
  >
    <span className="h-2 w-2 rounded-full" style={{ background: veg ? '#2E7D32' : '#B4483C' }} />
  </span>
);

/** v5.80.0 — the week's rank medallion: the same gold grammar the counter's
 * rail prints (rank 1 solid gold, rest tinted). A top mover marked sold out
 * turns RED — the ledger's way of telling the owner the room's favourite is
 * off the shelf before the rush finds out. Numbers are the paid ledger's,
 * never estimates. */
const MoverMedallion: React.FC<{ rank: number; units: number; tickets: number; pulled: boolean }> = ({ rank, units, tickets, pulled }) => (
  <span
    role="img"
    aria-label={pulled
      ? `Ranked No.${rank} this week by paid orders, but sold out — ${units} sold across ${tickets} tickets before it went`
      : `Ranked No.${rank} this week by paid orders — ${units} sold across ${tickets} tickets`}
    title={pulled
      ? `The room's No.${rank} this week (${units} sold across ${tickets} tickets) is SOLD OUT — bring it back before the rush finds out.`
      : `No.${rank} this week — ${units} sold across ${tickets} paid tickets. The counter's rail pins this dish.`}
    className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums"
    style={pulled
      ? { backgroundColor: '#FDF3F2', color: '#B4483C', boxShadow: 'inset 0 0 0 1px #F0D5D1' }
      : rank === 1
        ? { backgroundColor: '#B88E2F', color: '#FFFFFF' }
        : { backgroundColor: '#F3E8CF', color: '#8A6A1F' }}
  >
    {rank === 1 && !pulled && <Trophy size={9} aria-hidden />}
    No.{rank}
    {pulled && ' · pulled'}
  </span>
);

/* v5.171.0 — one quiet chip per condition; the strip counts, the hover
 * names names (up to four, then “+N more”). Silence when all zero — the
 * strip never congratulates. */
const HealthChip: React.FC<{
  count: number;
  names: string[];
  label: string;
  title: string;
  icon: React.ReactNode;
  className: string;
}> = ({ count, names, label, title, icon, className }) => {
  const shown = names.slice(0, 4).join(', ');
  const more = names.length > 4 ? ` +${names.length - 4} more` : '';
  return (
    <span
      title={names.length > 0 ? `${title} — ${shown}${more}` : title}
      className={`flex h-6 items-center gap-1 rounded-full px-2.5 text-[10.5px] font-bold ${className}`}
    >
      {icon}
      {count} {label}
    </span>
  );
};

/* ── modals ─────────────────────────────────────────────────────────────── */

function Overlay({
  title,
  onClose,
  children,
  foot,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  /** v5.290.0 — the modal's verbs ride the stick (OVERLAY_FOOT_STICK) as a
   *  direct child of the scroll panel, so Cancel/Save stay reachable at any
   *  height; bodies hold fields and state, never verbs. */
  foot?: React.ReactNode;
  wide?: boolean;
}) {
  /* v5.110.0 — the overlay holds the door (replaces the hand-rolled Escape listener). */
  const panelRef = React.useRef<HTMLDivElement>(null);
  const dlgRef = useDialogA11y<HTMLDivElement>(onClose, true, panelRef);
  return (
    <div ref={dlgRef} className="fixed inset-0 z-50" style={{ animation: 'spFadeIn 160ms ease-out' }} role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="Close dialog" onClick={onClose} className="absolute inset-0 h-full w-full cursor-default bg-[#0F3D3E]/45 focus-visible:outline-none" />
      <div className="absolute inset-x-2 top-1/2 -translate-y-1/2 sm:inset-x-0 sm:mx-auto" style={{ maxWidth: wide ? 560 : 440 }}>
        <div ref={panelRef} tabIndex={-1} className="max-h-[86vh] overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl outline-none">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-[15px] font-bold text-[#1A1A1A]">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="flex h-10 w-10 items-center justify-center rounded-full text-[#6B6B6B] hover:bg-[#F6F5F2] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#967221]"
            >
              <X size={17} aria-hidden />
            </button>
          </div>
          {children}
          {foot && <div className={`mt-3 flex justify-end gap-2 ${OVERLAY_FOOT_STICK}`}>{foot}</div>}
        </div>
      </div>
    </div>
  );
}

const fieldLabel = 'mb-1 block text-[12px] font-medium text-[#6B6B6B]';
const fieldInput = 'sp-input h-11 w-full px-3 text-[13.5px]';

/* v5.291.0 — the hunt chip's two voices, byte-twins of the Platform
 * console's own constants (327 audit → 328 businesses → 330 menu): idle
 * wears the card's quiet border, active wears the rail's strong teal.
 * unit330 pins the twins EQUAL — one grammar, three rooms, never drift. */
const HUNT_CHIP_IDLE =
  'inline-flex h-8 items-center rounded-full border border-[#E3E7E0] bg-white px-3 text-xs font-medium text-[#6B6B6B] transition-colors hover:bg-[#F6F5F2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B88E2F]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#F6F5F2]';
const HUNT_CHIP_ACTIVE =
  'inline-flex h-8 items-center rounded-full border border-transparent bg-[#0F3D3E] px-3 text-xs font-semibold text-white shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B88E2F]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#F6F5F2]';

/* v5.290.0 — the overlays learn the stick. The wizard taught the Platform
 * (v5.289.0) that a modal's verb rows must hold the panel's own bottom
 * edge while the content scrolls beneath — this family's panels wear the
 * p-5 house, so the same grammar rides at those measures: full-bleed
 * through the panel's own padding, the house's hairline above, the
 * rounded corners kept. FloorScreen carries the byte-twin (FLOOR_FOOT_STICK)
 * for its hand-rolled dialogs; unit329 pins the twins EQUAL so the two
 * can never drift. */
const OVERLAY_FOOT_STICK =
  'sticky bottom-0 -mx-5 -mb-5 rounded-b-3xl border-t border-[#E3E7E0] bg-white px-5 pb-4 pt-2.5';

/* ── item add/edit modal ────────────────────────────────────────────────── */

interface ItemDraft {
  name: string;
  description: string;
  price: string;
  categoryId: string;
  isVeg: boolean;
  isAvailable: boolean;
}

function ItemModal({
  categories,
  initial,
  busy,
  error,
  onSave,
  onClose,
}: {
  categories: Category[];
  initial: ItemDraft | null;
  busy: boolean;
  error: string | null;
  onSave: (d: ItemDraft) => void;
  onClose: () => void;
}) {
  const [d, setD] = useState<ItemDraft>(
    initial || { name: '', description: '', price: '', categoryId: categories[0]?.id || '', isVeg: true, isAvailable: true }
  );
  const priceNum = Number.parseFloat(d.price);
  const valid = d.name.trim().length > 0 && Number.isFinite(priceNum) && priceNum >= 0;

  return (
    <Overlay
      title={initial ? 'Edit item' : 'New menu item'}
      onClose={onClose}
      foot={
        <>
          <button type="button" onClick={onClose} className="h-11 rounded-full border border-[#E3E7E0] px-4 text-[13px] font-semibold text-[#6B6B6B] hover:bg-[#F6F5F2]">
            Cancel
          </button>
          <button
            type="button"
            disabled={!valid || busy}
            onClick={() => onSave({ ...d, price: String(round2(priceNum)) })}
            className="flex h-11 items-center gap-2 rounded-full px-5 text-[13px] font-semibold text-white disabled:opacity-50"
            style={{ background: '#0F3D3E' }}
          >
            {busy && <Loader2 size={14} className="animate-spin" aria-hidden />}
            {initial ? 'Save changes' : 'Add item'}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <label htmlFor="mi-name" className={fieldLabel}>Name *</label>
          <input id="mi-name" type="text" value={d.name} maxLength={80} onChange={(e) => setD({ ...d, name: e.target.value })} placeholder="e.g. Masala Toastie" className={fieldInput} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="mi-price" className={fieldLabel}>Price (₹) *</label>
            <input id="mi-price" type="number" min={0} step={0.01} value={d.price} onChange={(e) => setD({ ...d, price: e.target.value })} placeholder="e.g. 180" className={fieldInput} />
          </div>
          <div>
            <label htmlFor="mi-cat" className={fieldLabel}>Category</label>
            <select id="mi-cat" value={d.categoryId} onChange={(e) => setD({ ...d, categoryId: e.target.value })} className={fieldInput}>
              <option value="">Uncategorised</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label htmlFor="mi-desc" className={fieldLabel}>Description — shown on the guest menu</label>
          <input id="mi-desc" type="text" value={d.description} maxLength={160} onChange={(e) => setD({ ...d, description: e.target.value })} placeholder="e.g. Sourdough, chutney butter, melted cheddar" className={fieldInput} />
        </div>
        <div className="flex flex-wrap gap-4 pt-1">
          <label className="flex min-h-11 cursor-pointer items-center gap-2 text-[13px] font-medium text-[#1A1A1A]">
            <input type="checkbox" checked={d.isVeg} onChange={(e) => setD({ ...d, isVeg: e.target.checked })} className="h-4 w-4 accent-[#2E7D32]" />
            Vegetarian
          </label>
          <label className="flex min-h-11 cursor-pointer items-center gap-2 text-[13px] font-medium text-[#1A1A1A]">
            <input type="checkbox" checked={d.isAvailable} onChange={(e) => setD({ ...d, isAvailable: e.target.checked })} className="h-4 w-4 accent-[#0F3D3E]" />
            Available now (visible to guests)
          </label>
        </div>
        {error && <p className="rounded-xl bg-[#FDF3F2] px-3 py-2 text-[12.5px] text-[#B4483C]" role="alert">{error}</p>}
      </div>
    </Overlay>
  );
}

/* ── variants + allowed add-ons modal ───────────────────────────────────── */

function VariantsModal({
  itemName,
  variants,
  addons,
  linkedAddonIds,
  busy,
  error,
  onAddVariant,
  onDeleteVariant,
  onToggleAddon,
  onClose,
}: {
  itemName: string;
  variants: MenuVariant[];
  addons: Addon[];
  linkedAddonIds: Set<string>;
  busy: boolean;
  error: string | null;
  onAddVariant: (name: string, delta: number) => void;
  onDeleteVariant: (id: string) => void;
  onToggleAddon: (addonId: string, on: boolean) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [delta, setDelta] = useState('');
  const deltaNum = Number.parseFloat(delta || '0');
  const valid = name.trim().length > 0 && Number.isFinite(deltaNum);

  return (
    <Overlay title={`Options — ${itemName}`} onClose={onClose} wide>
      <div className="space-y-4">
        <section>
          <h3 className="text-[12px] font-semibold uppercase tracking-wide text-[#6B6B6B]">Size / option variants</h3>
          <p className="mt-0.5 text-[11.5px] text-[#6B6B6B]">Guests pick exactly one. The delta is added to the item's base price.</p>
          <div className="mt-2 space-y-1.5">
            {variants.length === 0 && <p className="rounded-xl bg-[#F6F5F2] px-3 py-2.5 text-[12.5px] text-[#6B6B6B]">No options yet — the item is served as-is.</p>}
            {variants.map((v) => (
              <div key={v.id} className="flex items-center gap-2 rounded-xl border border-[#E3E7E0] bg-white px-3 py-2">
                <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium text-[#1A1A1A]">{v.name}</span>
                {/* v5.282.0 — the delta's digits hold still (tabular-nums), the
                    same anti-jitter register every money render wears. */}
                <span className="text-[13px] font-bold tabular-nums" style={{ color: v.price_delta > 0 ? '#B88E2F' : '#2E7D32' }}>
                  {v.price_delta > 0 ? `+${formatMoney(v.price_delta)}` : v.price_delta < 0 ? `−${formatMoney(-v.price_delta)}` : 'no change'}
                </span>
                <button
                  type="button"
                  onClick={() => onDeleteVariant(v.id)}
                  disabled={busy}
                  aria-label={`Delete variant ${v.name}`}
                  className="flex h-9 w-9 items-center justify-center rounded-full text-[#B4483C] hover:bg-[#FDF3F2] disabled:opacity-50"
                >
                  <Trash2 size={14} aria-hidden />
                </button>
              </div>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <input type="text" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder="e.g. Large" aria-label="Variant name" className={fieldInput} />
            <input type="number" step={0.01} value={delta} onChange={(e) => setDelta(e.target.value)} placeholder="+₹ delta" aria-label="Price delta" className={`${fieldInput} w-28`} />
            <button
              type="button"
              disabled={!valid || busy}
              onClick={() => {
                onAddVariant(name, round2(deltaNum));
                setName('');
                setDelta('');
              }}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white disabled:opacity-50"
              style={{ background: '#0F3D3E' }}
              aria-label="Add variant"
            >
              <Plus size={16} aria-hidden />
            </button>
          </div>
        </section>

        <section>
          <h3 className="text-[12px] font-semibold uppercase tracking-wide text-[#6B6B6B]">Add-ons this item offers</h3>
          <p className="mt-0.5 text-[11.5px] text-[#6B6B6B]">Guests can tick any of these extras. Manage the library on the Menu page.</p>
          {addons.length === 0 ? (
            <p className="mt-2 rounded-xl bg-[#F6F5F2] px-3 py-2.5 text-[12.5px] text-[#6B6B6B]">The add-on library is empty — add extras like “Extra cheese” on the Menu page first.</p>
          ) : (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {addons.map((a) => {
                const on = linkedAddonIds.has(a.id);
                return (
                  <button
                    key={a.id}
                    type="button"
                    aria-pressed={on}
                    disabled={busy}
                    onClick={() => onToggleAddon(a.id, !on)}
                    className={`flex h-11 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-semibold transition-colors disabled:opacity-60 ${
                      on ? 'border-transparent text-white' : 'border-[#E3E7E0] bg-white text-[#1A1A1A] hover:border-[#B88E2F]'
                    }`}
                    style={on ? { background: '#0F3D3E' } : undefined}
                  >
                    {on && <Check size={13} aria-hidden />}
                    {a.name}
                    {/* 5.139.0 — the row speaks formatMoney like the variant deltas
                        (line 281) and dish prices (863) already do: "₹49.5" was
                        paise-ambiguous money text inside the file's own grammar.
                        v5.282.0 — the pill's digits hold still (tabular-nums). */}
                    <span className={`tabular-nums ${on ? 'text-[#E7C878]' : 'text-[#B88E2F]'}`}>+{formatMoney(a.price)}</span>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {error && <p className="rounded-xl bg-[#FDF3F2] px-3 py-2 text-[12.5px] text-[#B4483C]" role="alert">{error}</p>}
      </div>
    </Overlay>
  );
}

/* ── the screen ─────────────────────────────────────────────────────── */

/**
 * PhotoTile (v5.48.0 — the dishes get their faces; migration 036).
 *
 * One tile per menu row, at the row's head. Empty state: a dashed sage tile
 * with an ImagePlus glyph that darkens to gold on hover — "this dish has no
 * face yet". Filled: the photo itself, soft-ringed, with a small rose X
 * badge bottom-right to clear it (the same corner the presence dot speaks
 * from — one corner language per app). Uploading: a spinner ring over the
 * tile, the row stays put (fixed 44px box, never shifts).
 *
 * The upload is immediate on pick (one honest write per pick: storage
 * object, then the image_url patch, then the row refetches) — no draft
 * state to lose, no "Save" to forget. The storage API itself enforces the
 * 2 MiB / raster-only rules; the API layer restates them as friendly errors.
 */
const PHOTO_INPUT_ID = (itemId: string) => `photo-${itemId}`;

function PhotoTile({
  item,
  tenantId,
  busy,
  runAction,
}: {
  item: MenuItem;
  tenantId: string;
  busy: boolean;
  runAction: (fn: () => Promise<unknown>, okMsg?: string) => Promise<boolean>;
}) {
  const [uploading, setUploading] = useState(false);
  const url = item.image_url || null;

  const onPick = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      await runAction(async () => {
        const old = url;
        const publicUrl = await uploadMenuItemPhoto(tenantId, item.id, file);
        await updateMenuItem(item.id, tenantId, { imageUrl: publicUrl });
        // replacing, not first-dressing: the old face leaves the bucket too
        if (old) await removeMenuItemPhoto(old);
      }, 'Photo added');
    } finally {
      setUploading(false);
    }
  };

  const onClear = () =>
    void runAction(async () => {
      const old = url;
      await updateMenuItem(item.id, tenantId, { imageUrl: null });
      if (old) await removeMenuItemPhoto(old);
    }, 'Photo removed');

  return (
    <span className="relative inline-flex h-11 w-11 shrink-0 items-center justify-center">
      {url ? (
        <img
          src={url}
          alt={item.name}
          className="h-11 w-11 rounded-xl border border-[#E3E7E0] object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).style.opacity = '0.25';
          }}
        />
      ) : (
        <label
          htmlFor={PHOTO_INPUT_ID(item.id)}
          title={`Add photo for ${item.name}`}
          aria-label={`Add photo for ${item.name}`}
          className={`flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl border border-dashed transition-colors ${
            busy || uploading
              ? 'border-[#E3E7E0] bg-[#F6F5F2] text-[#969696]'
              : 'border-[#B8C4BC] bg-[#FBFBF9] text-[#8A938C] hover:border-[#B88E2F] hover:bg-[#FDF9F0] hover:text-[#8A5A16]'
          }`}
        >
          <ImagePlus size={16} aria-hidden />
        </label>
      )}
      <input
        id={PHOTO_INPUT_ID(item.id)}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/avif"
        className="sr-only"
        disabled={busy || uploading}
        onChange={(e) => {
          void onPick(e.target.files?.[0]);
          e.target.value = ''; // re-picking the same file must still fire
        }}
      />
      {uploading && (
        <span className="absolute inset-0 flex items-center justify-center rounded-xl bg-white/70" aria-hidden>
          <Loader2 size={16} className="animate-spin text-[#0F3D3E]" />
        </span>
      )}
      {url && !uploading && (
        <button
          type="button"
          onClick={onClear}
          disabled={busy}
          aria-label={`Remove photo for ${item.name}`}
          title={`Remove photo for ${item.name}`}
          className="absolute -bottom-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-[#B4483C] text-white transition-transform hover:scale-110 disabled:opacity-50"
        >
          <X size={10} aria-hidden />
        </button>
      )}
    </span>
  );
}

/* ── v5.152.0 — the menu speaks in chat ────────────────────────────────
 * The share arc's seventh member and its first catalog: bill, day,
 * range, offer, shopping list, chase list — and now the menu itself,
 * because "send me the menu" is the most-asked-for document in a café's
 * chat life. One assembly feeds Copy + WhatsApp. The chat menu is the
 * GUEST view: prices, descriptions, sold-out honesty, the veg voice,
 * size options — but never the house's own intelligence: costs,
 * margins and paid-mover ranks stay on the screen. Sold-out dishes
 * keep their line (the menu tells the truth about the shelf) and drop
 * their prose (a pulled dish doesn't sell its poetry). A text menu
 * needs no token and no link — no phantom sessions, no gate.
 * Exported pure so E2E can assert the text without the clipboard. */
export interface MenuTextItem {
  name: string;
  price: number;
  description: string | null;
  soldOut: boolean;
  nonVeg: boolean;
  options: string[];
}

export interface MenuTextCategory {
  name: string;
  items: MenuTextItem[];
}

export interface MenuTextOpts {
  storeName: string;
  cats: MenuTextCategory[];
}

export function buildMenuText(opts: MenuTextOpts): string {
  const W = 32;
  const hr = '-'.repeat(W);
  const center = (s: string): string => {
    const t = s.length > W ? `${s.slice(0, W - 1)}…` : s;
    return t.length >= W ? t : ' '.repeat(Math.floor((W - t.length) / 2)) + t;
  };
  const two = (l: string, r: string): string => {
    const cut = Math.max(1, W - r.length - 1);
    const left = l.length > cut ? `${l.slice(0, cut - 1)}…` : l;
    return left.padEnd(W - r.length, ' ') + r;
  };
  /* Prose never rides the money aligner (189/190): descriptions wrap
   * word-by-word and hang indented under their item's name. */
  const wrap = (s: string): string[] => {
    const words = s.split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let cur = '';
    for (const w of words) {
      const t = cur ? `${cur} ${w}` : w;
      if (t.length <= W - 3) {
        cur = t;
        continue;
      }
      if (cur) lines.push(cur);
      cur = w.length > W - 3 ? `${w.slice(0, W - 4)}…` : w;
    }
    if (cur) lines.push(cur);
    return lines;
  };

  const out: string[] = [];
  out.push(center(opts.storeName));
  out.push(center('MENU'));
  out.push(hr);
  for (const c of opts.cats) {
    if (c.items.length === 0) continue;
    out.push(c.name.toUpperCase());
    for (const it of c.items) {
      const mark = it.soldOut ? ' · sold out' : it.nonVeg ? ' · non-veg' : '';
      out.push(two(`${it.name}${mark}`, formatMoney(it.price)));
      if (!it.soldOut) {
        if (it.description) for (const line of wrap(it.description)) out.push(`   ${line}`);
        if (it.options.length > 0) out.push(`   ${it.options.join(', ')}`);
      }
    }
  }
  out.push(hr);
  out.push(center(`Shared ${appFormatters().hhmm.format(new Date())} ${appTzTag()}`));
  out.push(center('· · · end of menu · · ·'));
  return out.join('\n');
}

/* ── v5.171.0 — the house catalog ─────────────────────────────────────
 * The chat menu is the menu's public voice; the catalog is its private
 * one — the owner's own spreadsheet, carrying the intelligence the chat
 * menu withholds: costs, kept margins, mover ranks, availability. One
 * builder feeds the file and the health strip reads the same math, so
 * screen and sheet can never disagree. An unpriced dish leaves its cost
 * cells EMPTY — never ₹0 (the 208 doctrine); a non-mover leaves its
 * rank cells EMPTY — silence, not a dash pretending to be data.
 * Exported pure so the suite can assert the file without the browser. */
export interface CatalogOpts {
  cats: { name: string; items: MenuItem[] }[];
  variants: MenuVariant[];
  links: Map<string, Set<string>>;
  addonNames: Map<string, string>;
  unitCosts: Map<string, number>;
  moverInfo: Map<string, { rank: number; units: number; tickets: number }>;
  /* v5.173.0 — the shelf's days per dish, floored once at the screen's
   * memo. Optional so older callers (and the suite) ride without it —
   * absent map = every row silent, the 5.171.0 file unchanged. */
  daysByItem?: Map<string, number | null>;
}

export interface CatalogRow {
  category: string;
  name: string;
  price: number;
  cost: number | null; /* null = no recipe on file — EMPTY cell, never 0 */
  kept: number | null;
  keptPct: number | null; /* 0..1 fraction; the sheet prints percent */
  options: number;
  addons: string[];
  available: boolean;
  rank: number | null;
  units: number | null;
  tickets: number | null;
  /* v5.173.0 — days of cover at the paid week's pace; null = silence (no
   * recipe / unknown shelf / nobody bought it this week). The sheet prints
   * the number or EMPTY — never a dash, never an invented figure. */
  days: number | null;
}

/* Order follows the screen: categories in their array order, items in
 * fetch order within each — the sheet mirrors what the owner sees. */
export function catalogRows(o: CatalogOpts): CatalogRow[] {
  const rows: CatalogRow[] = [];
  for (const c of o.cats) {
    for (const i of c.items) {
      const price = Number(i.price);
      const costVal = o.unitCosts.get(i.id);
      const cost = costVal !== undefined && Number.isFinite(costVal) ? costVal : null;
      const keptPct = cost !== null && price > 0 ? (price - cost) / price : null;
      const mover = o.moverInfo.get(i.id);
      rows.push({
        category: c.name,
        name: i.name,
        price,
        cost,
        kept: cost !== null ? price - cost : null,
        keptPct,
        options: o.variants.filter((v) => v.menu_item_id === i.id).length,
        addons: [...(o.links.get(i.id) ?? [])]
          .map((id) => o.addonNames.get(id) || '')
          .sort((a, b) => a.localeCompare(b)),
        available: i.is_available !== false,
        rank: mover ? mover.rank : null,
        units: mover ? mover.units : null,
        tickets: mover ? mover.tickets : null,
        days: o.daysByItem ? (o.daysByItem.get(i.id) ?? null) : null,
      });
    }
  }
  return rows;
}

export function catalogCsvRows(o: CatalogOpts & { storeName: string }): unknown[][] {
  const rows = catalogRows(o);
  const priced = rows.filter((r) => r.cost !== null).length;
  const out: unknown[][] = [
    [`${o.storeName} — menu catalog`],
    [`${rows.length} dishes · ${priced} priced from recipes · week ranks and units read the same paid ledger the counter's rail pins · days of cover divide the shelf's answer by that same paid pace`],
    [],
    ['Category', 'Item', 'Price', 'Cost per serve', 'Kept', 'Kept %', 'Options', 'Add-ons', 'Availability', 'Week rank', 'Units (7d)', 'Tickets (7d)', 'Days of cover'],
  ];
  for (const r of rows) {
    out.push([
      r.category,
      r.name,
      r.price,
      r.cost,
      r.kept,
      r.keptPct === null ? null : Math.round(r.keptPct * 1000) / 10,
      r.options,
      r.addons.join(', '),
      r.available ? 'available' : 'SOLD OUT',
      r.rank,
      r.units,
      r.tickets,
      r.days,
    ]);
  }
  return out;
}

/* The menu's health at a glance — the same kept% bands the price chips
 * speak (≥50% healthy, ≥25% thin, ≤0% priced under cost, 0–25% keeps under
 * 25% — the 5.191.0 split; the red tone covers both severities, the WORDS
 * name the difference),
 * plus the two silences: sold out, and no recipe on file.
 * v5.173.0 — dryWeek: dishes the shelf runs dry on WITHIN THE WEEK at the
 * paid pace (days ≤ 7, the family's own cover horizon). A forecast, not a
 * fault — the chip is amber, the tooltip names names. Optional days map =
 * the 5.171.0 signature and its suite unchanged. */
export interface MenuHealth {
  soldOut: string[];
  noRecipe: string[];
  /** v5.191.0 — the LITERAL words: price ≤ cost, every sale loses money or
   *  breaks even. Before this release the band swallowed everything under
   *  25% kept — a dish keeping 12% was announced as "priced under cost"
   *  when its price beat its kitchen. The alarm now says what it means. */
  underCost: string[];
  /** v5.191.0 — 0 < kept% < 25%: covers the kitchen but barely. The squeeze
   *  is severe (the card's red tone stands) but it is not a loss — it wears
   *  its own honest words instead of the loss-maker's. */
  keepsUnder25: string[];
  thin: string[];
  dryWeek: string[];
}

export function menuHealth(o: {
  items: MenuItem[];
  unitCosts: Map<string, number>;
  daysByItem?: Map<string, number | null>;
}): MenuHealth {
  const h: MenuHealth = { soldOut: [], noRecipe: [], underCost: [], keepsUnder25: [], thin: [], dryWeek: [] };
  for (const i of o.items) {
    if (i.is_available === false) h.soldOut.push(i.name);
    const d = o.daysByItem?.get(i.id) ?? null;
    if (d !== null && d <= 7) h.dryWeek.push(i.name);
    const price = Number(i.price);
    const costVal = o.unitCosts.get(i.id);
    if (costVal === undefined || !Number.isFinite(costVal)) {
      h.noRecipe.push(i.name);
      continue;
    }
    if (price <= 0) continue;
    const keptPct = (price - costVal) / price;
    if (keptPct <= 0) h.underCost.push(i.name);
    else if (keptPct < 0.25) h.keepsUnder25.push(i.name);
    else if (keptPct < 0.5) h.thin.push(i.name);
  }
  return h;
}

export function MenuScreen(): React.ReactElement {
  const { tenant, tenantId, error: tenantError, loading } = useTenant();
  const [tick, setTick] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [saved, fireSaved] = useTransientFlag(2200);
  /* v5.275.0 — the catalog's own verb speaks its own ack (the 5.274.0
   * grammar reaching the whole house via the ONE component). */
  const [catalogSaved, flashCatalog] = useExportFlash();

  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [variants, setVariants] = useState<MenuVariant[]>([]);
  const [addons, setAddons] = useState<Addon[]>([]);
  const [links, setLinks] = useState<Map<string, Set<string>>>(new Map());
  /* v5.75.0 — per-serve ingredient cost from the 018 recipe view: what each
   * dish costs the kitchen, joined beside the price that bills for it. */
  const [unitCosts, setUnitCosts] = useState<Map<string, number>>(new Map());
  /* v5.80.0 — the room's movers on the management side: the same paid-ledger
   * rank the counter's rail sells, so the owner sees which dishes must not
   * run out. Fail-soft like everywhere the ledger is read: null = unread,
   * [] = quiet week or read failed — the menu never waits on the ledger,
   * and a quiet week prints no medallions (it does not invent them). */
  const [movers, setMovers] = useState<Mover[] | null>(null);
  /* v5.116.0 — the item search joins the shell-search contract: the
   * header box and the screen's own box are two doors to one state. */
  const query = useUi((s) => s.search);
  const setQuery = useUi((s) => s.setSearch);
  useEffect(() => {
    useUi.getState().setSearchMeta({ placeholder: 'Search items…' });
    return () => useUi.getState().setSearchMeta(null);
  }, []);

  /* v5.291.0 — the shelf joins the hunt (327 audit → 328 businesses → 330
   * menu): a category census chip row narrowing the shelf beside the
   * search, one state, the second tap standing the chip down. */
  const [shelfCat, setShelfCat] = useState<string | null>(null);

  const [itemModal, setItemModal] = useState<{ mode: 'new' } | { mode: 'edit'; itemId: string } | null>(null);
  const [variantsModalFor, setVariantsModalFor] = useState<string | null>(null);
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [catName, setCatName] = useState('');
  /* v5.290.0 — the duplicate door: the shelf's own census (case-insensitive)
   * speaks BEFORE the write, so a twin category is stopped with a word
   * instead of growing on the board and in the guest menu's nav. */
  const catDuplicate = useMemo(
    () => categories.some((c) => c.name.trim().toLowerCase() === catName.trim().toLowerCase()),
    [categories, catName]
  );
  const [addonFormOpen, setAddonFormOpen] = useState(false);
  const [addonName, setAddonName] = useState('');
  const [addonPrice, setAddonPrice] = useState('');
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [renamingCat, setRenamingCat] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const confirmTimer = useRef<number | null>(null);
  const busyRef = useRef(false);
  const armConfirm = useCallback((id: string) => {
    setConfirmId(id);
    if (confirmTimer.current) window.clearTimeout(confirmTimer.current);
    confirmTimer.current = window.setTimeout(() => setConfirmId(null), 3000);
  }, []);

  useEffect(() => {
    if (!tenantId) return;
    let alive = true;
    setLoadError(null);
    (async () => {
      try {
        const [cats, its, vs, as, uc] = await Promise.all([
          fetchCategories(tenantId),
          fetchMenuItems(tenantId),
          fetchMenuVariants(tenantId),
          fetchAddons(tenantId),
          fetchItemUnitCosts(tenantId),
        ]);
        if (!alive) return;
        setCategories(cats);
        setItems(its);
        setVariants(vs);
        setAddons(as);
        setUnitCosts(uc);
        const l = await fetchMenuItemAddonIds(its.map((i) => i.id));
        if (!alive) return;
        const map = new Map<string, Set<string>>();
        l.forEach((r) => {
          const s = map.get(r.menu_item_id) || new Set<string>();
          s.add(r.addon_id);
          map.set(r.menu_item_id, s);
        });
        setLinks(map);
      } catch (err) {
        if (alive) setLoadError(err instanceof Error ? err.message : 'Could not load the menu.');
      }
    })();
    return () => {
      alive = false;
    };
  }, [tenantId, tick]);

  /* v5.80.0 — the movers read: one reused fetch (the rail's own), the one
   * computeTopMovers definition, deterministic ties. Reloads with the
   * menu's tick so a refresh never shows stale ranks.
   * 5.173.0 — the same rows feed the whole-menu pace (computePaceByItem):
   * the days-of-cover column and the dry-this-week chip divide the shelf's
   * answer by the SAME ledger the rail ranks — one fetch, one definition. */
  useEffect(() => {
    if (!tenantId) return;
    let alive = true;
    fetchPaidMoverLines(tenantId, MOVER_WINDOW_DAYS)
      .then((rows) => {
        if (alive) {
          setMovers(computeTopMovers(rows));
          setPace(computePaceByItem(rows));
        }
      })
      .catch(() => {
        if (alive) {
          setMovers([]);
          setPace(new Map());
        }
      });
    return () => {
      alive = false;
    };
  }, [tenantId, tick]);

  /* v5.173.0 — the shelf read, fail-soft exactly as the counter's own
   * (FoodDrinksScreen): recipes (015) + the stock they draw from. null =
   * not read (or the read failed) — the days voice stays silent, never an
   * invented number. */
  const [shelf, setShelf] = useState<{ items: InventoryItem[]; recipes: RecipeLine[] } | null>(null);
  const [pace, setPace] = useState<Map<string, number> | null>(null);
  useEffect(() => {
    if (!tenantId) return;
    let alive = true;
    Promise.all([fetchInventory(tenantId), fetchRecipeLines(tenantId)])
      .then(([inv, recipes]) => {
        if (alive) setShelf({ items: inv, recipes });
      })
      .catch(() => {
        if (alive) setShelf(null);
      });
    return () => {
      alive = false;
    };
  }, [tenantId, tick]);

  /* menuItemId → {rank, units, tickets} for the medallions. */
  const moverInfo = useMemo(() => {
    const m = new Map<string, { rank: number; units: number; tickets: number }>();
    (movers ?? []).forEach((mv, i) => m.set(mv.menuItemId, { rank: i + 1, units: mv.units, tickets: mv.tickets }));
    return m;
  }, [movers]);

  /* v5.173.0 — the shelf's answer per dish WITH a recipe: the ONE shared
   * math (src/lib/shelf.ts), built exactly as the counter's own map
   * (FoodDrinksScreen) so the management sheet and the counter can never
   * disagree about a dish. No recipe → absent → silence, not zero. */
  const shelfByItem = useMemo<Map<string, ShelfCoverage>>(() => {
    const map = new Map<string, ShelfCoverage>();
    if (!shelf) return map;
    for (const it of items) {
      const lines = shelf.recipes.filter((r) => r.menu_item_id === it.id);
      if (lines.length === 0) continue; /* no recipe → silence, not zero */
      map.set(it.id, shelfCoverage(lines, shelf.items));
    }
    return map;
  }, [shelf, items]);

  /* v5.173.0 — the shelf's days, floored ONCE here: the CSV column, the
   * dry-this-week chip and the row clock all read this ONE number per dish
   * (shelfDays = the math; the floor happens here, not per surface).
   * null = silence (no recipe / unknown shelf / no paid pace this week). */
  const daysByItem = useMemo<Map<string, number | null>>(() => {
    const map = new Map<string, number | null>();
    for (const it of items) {
      const c = shelfByItem.get(it.id);
      if (!c) continue;
      const d = shelfDays(c.coverage, pace?.get(it.id) ?? null);
      map.set(it.id, d === null ? null : Math.floor(d));
    }
    return map;
  }, [shelfByItem, pace, items]);

  const runAction = useCallback(async (fn: () => Promise<unknown>, okMsg?: string) => {
    if (busyRef.current) return false; // double-dispatch guard (batch-proof, unlike state)
    busyRef.current = true;
    setBusy(true);
    setActionError(null);
    try {
      await fn();
      setTick((t) => t + 1);
      if (okMsg) fireSaved();
      return true;
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Something went wrong. Try again.');
      return false;
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [fireSaved]);

  const q = query.trim().toLowerCase();
  /* v5.291.0 — the shelf's own census: every named category with the count
   * of dishes it holds, loudest first, ties alphabetical — the chips speak
   * the shelf's own words, never invented rooms. A zero-item category
   * speaks too (count 0, an honest empty room). */
  const shelfCats = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of items) {
      const cat = categories.find((c) => c.id === item.category_id);
      if (cat) counts.set(cat.id, (counts.get(cat.id) || 0) + 1);
    }
    return categories
      .map((c) => ({ id: c.id, name: c.name, count: counts.get(c.id) || 0 }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [categories, items]);
  const catsWithItems = useMemo(() => {
    const grouped: { category: Category | null; list: MenuItem[] }[] = categories
      .filter((c) => shelfCat === null || c.id === shelfCat)
      .map((c) => ({
        category: c,
        list: items.filter((i) => i.category_id === c.id),
      }));
    const orphan = items.filter((i) => !categories.some((c) => c.id === i.category_id));
    if (orphan.length > 0 && shelfCat === null) grouped.push({ category: null, list: orphan });
    if (!q && shelfCat === null) return grouped;
    return grouped
      .map((g) => ({ ...g, list: g.list.filter((i) => `${i.name} ${i.description || ''}`.toLowerCase().includes(q)) }))
      .filter((g) => g.list.length > 0 || (q && g.category && g.category.name.toLowerCase().includes(q)));
  }, [categories, items, q, shelfCat]);
  /* v5.291.0 — the census's filtered voice: N of M when the hunt is on
   * (the whole count staying in the h1's own subline when it is not), and
   * the no-match word naming the prey — the same honesty the audit room
   * and the businesses room already speak. */
  const shelfFiltering = shelfCat !== null || q !== '';
  const shelfHits = useMemo(
    () => catsWithItems.reduce((n, g) => n + g.list.length, 0),
    [catsWithItems],
  );
  const shelfHuntWords = [
    shelfCat !== null ? `the category “${categories.find((c) => c.id === shelfCat)?.name ?? ''}”` : '',
    query.trim() ? `“${query.trim()}”` : '',
  ].filter(Boolean).join(' and ');

  /* v5.152.0 — one assembly feeds Copy + WhatsApp (5.146.0 rule, menu
   * edition): the chat menu is built from the same categories, items
   * and variants state the screen renders, so screen and chat can
   * never disagree. Uncategorised items keep the screen's label. */
  const menuOpts = useMemo<MenuTextOpts>(() => ({
    storeName: tenant?.name || 'ServePoint store',
    cats: [
      ...categories.map((c) => ({
        name: c.name,
        items: items
          .filter((i) => i.category_id === c.id)
          .map((i) => ({
            name: i.name,
            price: Number(i.price),
            description: i.description || null,
            soldOut: i.is_available === false,
            nonVeg: i.is_veg === false,
            options: variants
              .filter((v) => v.menu_item_id === i.id)
              .map((v) => (v.price_delta > 0 ? `${v.name} +${formatMoney(v.price_delta)}` : v.name)),
          })),
      })),
      ...((items.some((i) => !categories.some((c) => c.id === i.category_id))
        ? [{
            name: 'Uncategorised',
            items: items
              .filter((i) => !categories.some((c) => c.id === i.category_id))
              .map((i) => ({
                name: i.name,
                price: Number(i.price),
                description: i.description || null,
                soldOut: i.is_available === false,
                nonVeg: i.is_veg === false,
                options: variants
                  .filter((v) => v.menu_item_id === i.id)
                  .map((v) => (v.price_delta > 0 ? `${v.name} +${formatMoney(v.price_delta)}` : v.name)),
              })),
          }]
        : [])),
    ],
  }), [tenant?.name, categories, items, variants]);
  const menuText = items.length > 0 ? buildMenuText(menuOpts) : '';
  /* v5.277.0 — the ack rides the one home (lib/useCopyAck): the honest
   * boolean from the one door decides the kind, the breath re-arms
   * instead of stacking, and the word comes from ackWord. */
  const [menuCopyState, runMenuCopy] = useCopyAck();
  const copyMenu = () => runMenuCopy(menuText);

  /* v5.171.0 — the house catalog: the same menu state the screen renders,
   * projected for the owner's spreadsheet (5.146.0 rule, menu edition —
   * one assembly per document). The FULL catalog rides out, never the
   * search box's current slice. */
  const addonNames = useMemo(() => new Map(addons.map((a) => [a.id, a.name])), [addons]);
  const catalogOpts = useMemo<CatalogOpts & { storeName: string }>(() => {
    const grouped = categories.map((c) => ({ name: c.name, items: items.filter((i) => i.category_id === c.id) }));
    const orphan = items.filter((i) => !categories.some((c) => c.id === i.category_id));
    if (orphan.length > 0) grouped.push({ name: 'Uncategorised', items: orphan });
    return {
      storeName: tenant?.name || 'ServePoint store',
      cats: grouped,
      variants,
      links,
      addonNames,
      unitCosts,
      moverInfo,
      daysByItem,
    };
  }, [tenant?.name, categories, items, variants, links, addonNames, unitCosts, moverInfo, daysByItem]);
  const health = useMemo(() => menuHealth({ items, unitCosts, daysByItem }), [items, unitCosts, daysByItem]);
  const downloadCatalog = () => {
    if (items.length === 0) return;
    downloadCsv(`servepoint-menu-catalog-${appTodayIso()}.csv`, catalogCsvRows(catalogOpts));
  };

  const editingItem = itemModal?.mode === 'edit' ? items.find((i) => i.id === itemModal.itemId) : null;
  const variantsItem = items.find((i) => i.id === variantsModalFor) || null;

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-4 lg:p-5">
        <Loader2 size={26} className="animate-spin text-[#6B6B6B]" aria-hidden />
      </div>
    );
  }
  if (tenantError || !tenantId) {
    return (
      <div className="p-4 lg:p-5">
        <div className="rounded-2xl border border-[#F0D9D5] bg-[#FDF3F2] p-4 text-[13.5px] text-[#B4483C]">{tenantError || 'No tenant context.'}</div>
      </div>
    );
  }

  const totalItems = items.length;

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-4 lg:p-5">
      {/* header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          {/* v5.136.0 — the editorial pair: Menu and Floor keep the serif-italic
              accent family (28px deep-teal) on purpose — the two "physical room"
              surfaces speak a different register from the staff screens' shared
              .sp-screen-title. Documented so no future header audit flags it. */}
          <h1 className="font-serif text-[28px] italic leading-tight text-[#0F3D3E]">Menu</h1>
          <p className="mt-0.5 text-[13px] text-[#6B6B6B]">
            {tenant?.name} · {categories.length} categor{categories.length === 1 ? 'y' : 'ies'} · {totalItems} item{totalItems === 1 ? '' : 's'} — one menu for the counter, the kitchen and the QR.
          </p>
          {(movers?.length ?? 0) > 0 && (
            <p className="mt-1 flex items-center gap-1.5 text-[11.5px] text-[#8A6A1F]">
              <Trophy size={11} aria-hidden />
              Gold No.N marks this week's paid movers — the same list the counter's rail pins. A red “No.N · pulled” is a favourite gone sold out.
            </p>
          )}
          {/* v5.171.0 — the menu's health at a glance: the same kept% bands
              the price chips speak, plus the two silences (sold out, no
              recipe). Silence when all zero — the strip never congratulates.
              5.173.0 — the forecast joins: dryWeek reads the shelf's days
              (ONE math with the catalog's column), a clock per dish. */}
          {(health.soldOut.length > 0 || health.noRecipe.length > 0 || health.underCost.length > 0 || health.keepsUnder25.length > 0 || health.thin.length > 0 || health.dryWeek.length > 0) && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {health.soldOut.length > 0 && (
                <HealthChip
                  count={health.soldOut.length}
                  names={health.soldOut}
                  label="sold out"
                  title="Marked unavailable — the counter, the kitchen and the QR all refuse it until the Available toggle returns."
                  icon={<CircleOff size={11} aria-hidden />}
                  className="bg-[#FDF3F2] text-[#B4483C]"
                />
              )}
              {health.noRecipe.length > 0 && (
                <HealthChip
                  count={health.noRecipe.length}
                  names={health.noRecipe}
                  label="no recipe"
                  title="No recipe on file (Inventory → Recipes) — the kitchen cost is unknown, so the margin stays silent rather than guessing."
                  icon={<ChefHat size={11} aria-hidden />}
                  className="bg-[#F1F4F1] text-[#6B6B6B]"
                />
              )}
              {health.underCost.length > 0 && (
                <HealthChip
                  count={health.underCost.length}
                  names={health.underCost}
                  label="priced under cost"
                  title="Every sale loses money or breaks even — the price doesn't beat the kitchen's own cost. Raise the price or cost the recipe again (Inventory → Recipes holds the costs)."
                  icon={<TrendingDown size={11} aria-hidden />}
                  className="bg-[#FDF3F2] text-[#B4483C]"
                />
              )}
              {health.keepsUnder25.length > 0 && (
                <HealthChip
                  count={health.keepsUnder25.length}
                  names={health.keepsUnder25}
                  label="keeps under 25%"
                  title="Keeps less than 25% of its bill — the price covers the kitchen but barely. Not a loss, but the thinnest slice on the board (Inventory → Recipes holds the costs)."
                  icon={<TrendingDown size={11} aria-hidden />}
                  className="bg-[#FDF3F2] text-[#B4483C]"
                />
              )}
              {health.thin.length > 0 && (
                <HealthChip
                  count={health.thin.length}
                  names={health.thin}
                  label="thin"
                  title="Keeps 25–50% of its bill — worth a look before the weekend prices go to print."
                  icon={<CircleAlert size={11} aria-hidden />}
                  className="bg-[#FDF9F0] text-[#8A5A16]"
                />
              )}
              {health.dryWeek.length > 0 && (
                <HealthChip
                  count={health.dryWeek.length}
                  names={health.dryWeek}
                  label="dry within the week"
                  title="At the paid week's pace the shelf runs dry within 7 days (days of cover = the shelf's answer ÷ that pace) — cover it from the batch planner before the counter finds out."
                  icon={<Clock size={11} aria-hidden />}
                  className="bg-[#FDF9F0] text-[#8A5A16]"
                />
              )}
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#6B6B6B]" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search items…"
              aria-label="Search items"
              className="h-11 w-44 rounded-full border border-[#E3E7E0] bg-white pl-9 pr-3 text-[13px] focus:outline focus:outline-2 focus:outline-[#B88E2F]"
            />
          </div>
          {saved && (
            <span className="flex h-11 items-center gap-1.5 rounded-full bg-[#EAF4EC] px-3 text-[12.5px] font-semibold text-[#2E7D32]" role="status">
              <Check size={14} aria-hidden /> Saved
            </span>
          )}
          <button
            type="button"
            onClick={() => setCatModalOpen(true)}
            className="flex h-11 items-center gap-1.5 rounded-full border border-[#E3E7E0] bg-white px-4 text-[13px] font-semibold text-[#0F3D3E] hover:border-[#B88E2F]"
          >
            <Layers size={15} aria-hidden /> Category
          </button>
          {items.length > 0 && (
            <>
              <button
                type="button"
                onClick={copyMenu}
                aria-live="polite"
                aria-label="Copy the menu as text"
                className="flex h-11 items-center gap-1.5 rounded-full border border-[#E3E7E0] bg-white px-4 text-[13px] font-semibold text-[#0F3D3E] hover:border-[#B88E2F]"
              >
                {menuCopyState === 'ok' ? (
                  <Check size={15} className="text-[#2E7D32]" aria-hidden />
                ) : menuCopyState === 'fail' ? (
                  <AlertTriangle size={15} className="text-[#8A5A00]" aria-hidden />
                ) : (
                  <Copy size={15} aria-hidden />
                )}
                {ackWord(menuCopyState, 'Copy')}
              </button>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(menuText)}`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Share the menu on WhatsApp"
                className="flex h-11 items-center gap-1.5 rounded-full border border-[#E3E7E0] bg-white px-4 text-[13px] font-semibold text-[#0F3D3E] hover:border-[#B88E2F]"
              >
                <MessageCircle size={15} aria-hidden /> WhatsApp
              </a>
              <CsvExportButton
                saved={catalogSaved}
                onExport={() => flashCatalog(downloadCatalog)}
                idleAria="Download the menu catalog as CSV — the house's own copy, with costs and margins"
                savedAria="Menu catalog exported — the CSV file is saved"
                title="The house's own copy, with costs and margins (opens in Excel / Sheets)"
                geometry="flex h-11 items-center gap-1.5 rounded-full border px-4 text-[13px] font-semibold"
                earSize={15}
                idleEar="sheet"
                idleWord="Catalog CSV"
              />
            </>
          )}
          <button
            type="button"
            onClick={() => setItemModal({ mode: 'new' })}
            className="flex h-11 items-center gap-1.5 rounded-full px-4 text-[13px] font-semibold text-white hover:opacity-90"
            style={{ background: '#0F3D3E' }}
          >
            <Plus size={15} aria-hidden /> Add item
          </button>
        </div>
      </div>

      {(loadError || actionError) && (
        <div className="flex items-center justify-between rounded-2xl border border-[#F0D9D5] bg-[#FDF3F2] px-4 py-3">
          <p className="flex items-center gap-2 text-[13px] text-[#B4483C]">
            <CircleAlert size={15} aria-hidden /> {loadError || actionError}
          </p>
          <button type="button" onClick={() => setTick((t) => t + 1)} className="flex items-center gap-1.5 rounded-full border border-[#F0D9D5] px-3 py-1.5 text-[12px] font-semibold text-[#B4483C] hover:bg-white">
            <RefreshCw size={12} aria-hidden /> Retry
          </button>
        </div>
      )}

      {/* add-on library */}
      <section className="rounded-2xl border border-[#E3E7E0] bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-[13.5px] font-bold text-[#1A1A1A]">Add-on library</h2>
            <p className="text-[11.5px] text-[#6B6B6B]">Extras any item can offer — guests tick them at order time.</p>
          </div>
          <button type="button" onClick={() => setAddonFormOpen((o) => !o)} className="flex h-10 items-center gap-1.5 rounded-full border border-[#E3E7E0] px-3.5 text-[12.5px] font-semibold text-[#0F3D3E] hover:border-[#B88E2F]">
            <Plus size={14} aria-hidden /> Add-on
          </button>
        </div>
        {addonFormOpen && (
          <div className="mt-3 flex flex-wrap gap-2">
            <input type="text" value={addonName} maxLength={40} onChange={(e) => setAddonName(e.target.value)} placeholder="e.g. Extra cheese" aria-label="Add-on name" className={`${fieldInput} w-44`} />
            <input type="number" min={0} step={0.01} value={addonPrice} onChange={(e) => setAddonPrice(e.target.value)} placeholder="₹ price" aria-label="Add-on price" className={`${fieldInput} w-28`} />
            <button
              type="button"
              disabled={!addonName.trim() || !Number.isFinite(Number.parseFloat(addonPrice || 'nan')) || busy}
              onClick={() => {
                void runAction(async () => {
                  const a = await createAddon(tenantId, addonName, round2(Number.parseFloat(addonPrice)));
                  setAddons((prev) => [...prev, a].sort((x, y) => x.name.localeCompare(y.name)));
                }, 'Saved').then((ok) => {
                  if (ok) {
                    setAddonName('');
                    setAddonPrice('');
                    setAddonFormOpen(false);
                  }
                });
              }}
              className="flex h-11 items-center gap-1.5 rounded-full px-4 text-[13px] font-semibold text-white disabled:opacity-50"
              style={{ background: '#0F3D3E' }}
            >
              <Plus size={14} aria-hidden /> Add
            </button>
          </div>
        )}
        {addons.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {addons.map((a) => {
              const armed = confirmId === `addon:${a.id}`;
              return (
                <span key={a.id} className="flex h-9 items-center gap-2 rounded-full bg-[#FDF9F0] pl-3.5 pr-1.5 text-[12.5px] font-semibold text-[#8A5A16]">
                  {/* v5.282.0 — the money digits hold still inside the chip. */}
                  <span className="tabular-nums">{a.name} {formatMoney(a.price)}</span>
                  <button
                    type="button"
                    onClick={() => {
                      if (armed) {
                        void runAction(() => deleteAddon(a.id, tenantId), 'Saved');
                      } else {
                        armConfirm(`addon:${a.id}`);
                      }
                    }}
                    aria-label={armed ? `Confirm delete ${a.name}` : `Delete ${a.name}`}
                    className={`flex h-7 items-center gap-1 rounded-full px-2 text-[11px] font-bold ${armed ? 'bg-[#B4483C] text-white' : 'text-[#B4483C] hover:bg-[#F6E8E6]'}`}
                  >
                    {armed ? 'Confirm?' : <X size={12} aria-hidden />}
                  </button>
                </span>
              );
            })}
          </div>
        )}
      </section>

      {/* v5.291.0 — the hunt row: the shelf's own category census as chips
       * (All owns the null chip, the second tap stands a chip down), with
       * the census's filtered voice beside it when the hunt is on. */}
      {categories.length > 0 && (
        <>
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter the shelf by category">
            <button
              type="button"
              onClick={() => setShelfCat(null)}
              aria-pressed={shelfCat === null}
              className={shelfCat === null ? HUNT_CHIP_ACTIVE : HUNT_CHIP_IDLE}
            >
              All
              <span className="ml-1.5 text-[11px] opacity-70 tabular-nums">{totalItems}</span>
            </button>
            {shelfCats.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setShelfCat(shelfCat === c.id ? null : c.id)}
                aria-pressed={shelfCat === c.id}
                className={shelfCat === c.id ? HUNT_CHIP_ACTIVE : HUNT_CHIP_IDLE}
              >
                {c.name}
                <span className="ml-1.5 text-[11px] opacity-70 tabular-nums">{c.count}</span>
              </button>
            ))}
          </div>
          {shelfFiltering && (
            <p className="text-[12px] text-[#6B6B6B]" role="status">
              {shelfHits} of {totalItems} item{totalItems === 1 ? '' : 's'} on the shelf.
            </p>
          )}
        </>
      )}

      {/* menu sections */}
      {totalItems === 0 && categories.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-[#C9D4CC] bg-white/60 p-10 text-center">
          <BookOpenText size={30} className="mx-auto text-[#6B6B6B]" aria-hidden />
          <h2 className="mt-3 font-serif text-[22px] italic text-[#0F3D3E]">Your menu is empty</h2>
          <p className="mx-auto mt-1 max-w-sm text-[13px] text-[#6B6B6B]">
            Start with a category (“Coffee”, “Snacks”…), then add items with prices, options and add-ons. Everything you add shows up instantly on the counter POS and the guest QR menu.
          </p>
          <button
            type="button"
            onClick={() => setCatModalOpen(true)}
            className="mt-5 inline-flex h-11 items-center gap-2 rounded-full px-5 text-[13.5px] font-semibold text-white hover:opacity-90"
            style={{ background: '#0F3D3E' }}
          >
            <Layers size={15} aria-hidden /> Add your first category
          </button>
        </div>
      ) : shelfFiltering && catsWithItems.length === 0 ? (
        /* v5.291.0 — the no-match card names the prey: chip, needle, or
         * both — the same honesty the audit room and the businesses room
         * already speak (one card, not N empty shelves). */
        <div className="rounded-3xl border border-[#E3E7E0] bg-white p-2 shadow-sm">
          <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
            <span className="flex h-24 w-24 items-center justify-center rounded-full bg-[#EAF0EC] text-[#2C3E3E]">
              <Search size={38} strokeWidth={1.8} aria-hidden />
            </span>
            <h3 className="mt-6 text-lg font-semibold text-[#1A1A1A]">No matches</h3>
            <p className="mt-2 max-w-sm text-sm leading-relaxed text-[#6B6B6B]">
              {`No dishes match ${shelfHuntWords}. Try a name, a description or a category.`}
            </p>
          </div>
        </div>
      ) : (
        catsWithItems.map(({ category, list }) => (
          <section key={category?.id || 'uncategorised'} className="rounded-3xl border border-[#E3E7E0] bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#F0F2EE] px-4 py-3">
              {renamingCat === category?.id ? (
                <div className="flex flex-1 flex-wrap items-center gap-2">
                  <input type="text" value={renameValue} maxLength={40} onChange={(e) => setRenameValue(e.target.value)} aria-label="Category name" className={`${fieldInput} w-48`} />
                  <button
                    type="button"
                    disabled={!renameValue.trim() || busy}
                    onClick={() => {
                      void runAction(() => renameCategory(category.id, tenantId, renameValue), 'Saved').then((ok) => {
                        if (ok) setRenamingCat(null);
                      });
                    }}
                    className="h-11 rounded-full px-4 text-[12.5px] font-semibold text-white disabled:opacity-50"
                    style={{ background: '#0F3D3E' }}
                  >
                    Save
                  </button>
                  <button type="button" onClick={() => setRenamingCat(null)} className="h-11 rounded-full border border-[#E3E7E0] px-4 text-[12.5px] font-semibold text-[#6B6B6B]">
                    Cancel
                  </button>
                </div>
              ) : (
                <h2 className="flex items-center gap-2 font-serif text-[19px] italic text-[#0F3D3E]">
                  {category ? category.name : 'Uncategorised'}
                  <span className="rounded-full bg-[#F1F4F1] px-2 py-0.5 text-[10.5px] font-sans font-bold not-italic text-[#0F3D3E]">{list.length}</span>
                </h2>
              )}
              {category && renamingCat !== category.id && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setRenamingCat(category.id);
                      setRenameValue(category.name);
                    }}
                    className="flex h-9 items-center gap-1.5 rounded-full px-3 text-[12px] font-semibold text-[#6B6B6B] hover:bg-[#F6F5F2]"
                  >
                    <Pencil size={12} aria-hidden /> Rename
                  </button>
                </div>
              )}
            </div>
            <div>
              {list.length === 0 && (
                <p className="px-4 py-4 text-[12.5px] text-[#6B6B6B]">No items here{q ? ' matching your search' : ''} yet.</p>
              )}
              {list.map((item) => {
                const itemVariants = variants.filter((v) => v.menu_item_id === item.id);
                const itemAddonIds = links.get(item.id) || new Set<string>();
                const armed = confirmId === `item:${item.id}`;
                /* v5.75.0 — the dish's true price: recipe cost beside the
                 * billing price. Kept% bands: ≥50% green (healthy), ≥25%
                 * amber (thin), else red (a loss or a squeeze under 25% —
                 * the health strip's chips name which one it is). */
                const cost = unitCosts.get(item.id);
                const keptPct =
                  cost !== undefined && Number(item.price) > 0
                    ? (Number(item.price) - cost) / Number(item.price)
                    : null;
                const keptTone =
                  keptPct === null ? null : keptPct >= 0.5 ? '#2E7D32' : keptPct >= 0.25 ? '#8A5A00' : '#B4483C';
                /* v5.80.0 — the week's rank, from the same paid ledger the
                 * counter's rail reads: management sees what must not run out. */
                const mover = moverInfo.get(item.id);
                /* v5.173.0 — the row's clock: dishes the shelf runs dry on
                   within the week wear it here, the same floored number the
                   catalog's column prints (ONE daysByItem memo). Silence
                   when the days are silence — no clock on healthy rows. */
                const days = daysByItem.get(item.id) ?? null;
                return (
                  <div key={item.id} className="flex flex-wrap items-center gap-3 border-b border-[#F0F2EE] px-4 py-3 last:border-0 hover:bg-[#FBFBF9]">
                    <PhotoTile item={item} tenantId={tenantId} busy={busy} runAction={runAction} />
                    <VegDot veg={item.is_veg !== false} />
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 truncate text-[14px] font-semibold text-[#1A1A1A]">
                        <MarkHit text={item.name} query={q} />
                        {mover && (
                          <MoverMedallion rank={mover.rank} units={mover.units} tickets={mover.tickets} pulled={item.is_available === false} />
                        )}
                        {item.is_available === false && <span className="rounded-full bg-[#FDF3F2] px-2 py-0.5 text-[10px] font-bold text-[#B4483C]">SOLD OUT</span>}
                      </p>
                      {item.description && <p className="truncate text-[12px] text-[#6B6B6B]"><MarkHit text={item.description} query={q} /></p>}
                      <p className="mt-0.5 flex flex-wrap gap-1.5 text-[10.5px]">
                        {itemVariants.length > 0 && <span className="rounded-full bg-[#F1F4F1] px-2 py-0.5 font-medium text-[#0F3D3E]">{itemVariants.length} option{itemVariants.length > 1 ? 's' : ''}</span>}
                        {itemAddonIds.size > 0 && <span className="rounded-full bg-[#FDF9F0] px-2 py-0.5 font-medium text-[#8A5A16]">{itemAddonIds.size} add-on{itemAddonIds.size > 1 ? 's' : ''}</span>}
                        {days !== null && days <= 7 && (
                          <span
                            className="flex items-center gap-0.5 rounded-full bg-[#FDF9F0] px-2 py-0.5 font-semibold text-[#8A5A16]"
                            title={`Days of cover at the paid week's pace: ${days === 0 ? 'less than a day' : `~${days} day${days === 1 ? '' : 's'}`} — the shelf runs dry within the week. Cover it from the batch planner (Inventory → Recipes).`}
                          >
                            <Clock size={10} aria-hidden />
                            {days === 0 ? 'dry within a day' : `dry in ~${days}d`}
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="text-right">
                      {/* v5.282.0 — the card's price is the staff app's most-seen
                          money: its digits hold still now (tabular-nums), like
                          every other money render in the house. */}
                      <p className="text-[14.5px] font-bold tabular-nums" style={{ color: '#B88E2F' }}>{formatMoney(item.price)}</p>
                      {cost === undefined ? (
                        <p
                          className="mt-0.5 text-[10.5px] text-[#969696]"
                          title="No recipe on file yet (Inventory → Recipes). The kitchen cost is unknown, so the margin board in Reports sits this dish out."
                        >
                          no recipe yet
                        </p>
                      ) : (
                        <p
                          className="mt-0.5 whitespace-nowrap text-[10.5px] text-[#969696] tabular-nums"
                          title={`Ingredient cost per serve, from the recipe lines (Inventory). At the base price — options change the bill, not the cost.`}
                        >
                          costs <span className="font-semibold">{formatMoney(cost)}</span> · keeps{' '}
                          <span className="font-bold" style={{ color: keptTone ?? undefined }}>
                            {formatMoney(Number(item.price) - cost)} ({Math.round((keptPct ?? 0) * 100)}%)
                          </span>
                        </p>
                      )}
                    </div>
                    <label className="flex min-h-11 cursor-pointer items-center gap-1.5 text-[11.5px] font-medium text-[#6B6B6B]">
                      <input
                        type="checkbox"
                        checked={item.is_available !== false}
                        disabled={busy}
                        onChange={(e) => void runAction(() => updateMenuItem(item.id, tenantId, { isAvailable: e.target.checked }))}
                        className="h-4 w-4 accent-[#0F3D3E]"
                      />
                      Available
                    </label>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setVariantsModalFor(item.id)}
                        className="flex h-10 items-center gap-1.5 rounded-full border border-[#E3E7E0] px-3 text-[12px] font-semibold text-[#0F3D3E] hover:border-[#B88E2F]"
                      >
                        <SlidersHorizontal size={13} aria-hidden /> Options
                      </button>
                      <button
                        type="button"
                        onClick={() => setItemModal({ mode: 'edit', itemId: item.id })}
                        aria-label={`Edit ${item.name}`}
                        className="flex h-10 w-10 items-center justify-center rounded-full text-[#6B6B6B] hover:bg-[#F6F5F2]"
                      >
                        <Pencil size={14} aria-hidden />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (armed) void runAction(() => deleteMenuItem(item.id, tenantId), 'Saved');
                          else armConfirm(`item:${item.id}`);
                        }}
                        aria-label={armed ? `Confirm delete ${item.name}` : `Delete ${item.name}`}
                        className={`flex h-10 items-center gap-1 rounded-full px-2.5 text-[12px] font-bold ${armed ? 'bg-[#B4483C] text-white' : 'text-[#B4483C] hover:bg-[#F6E8E6]'}`}
                      >
                        {armed ? 'Confirm?' : <Trash2 size={14} aria-hidden />}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))
      )}

      {/* category modal — v5.290.0: the name field learns the shelf's own
          census (a duplicate is stopped at the door with the honest word,
          before the shelf grows a twin) and the verbs ride the stick */}
      {catModalOpen && (
        <Overlay
          title="New category"
          onClose={() => setCatModalOpen(false)}
          foot={
            <>
              <button type="button" onClick={() => setCatModalOpen(false)} className="h-11 rounded-full border border-[#E3E7E0] px-4 text-[13px] font-semibold text-[#6B6B6B]">
                Cancel
              </button>
              <button
                type="button"
                disabled={!catName.trim() || catDuplicate || busy}
                onClick={() => {
                  void runAction(() => createCategory(tenantId, catName), 'Saved').then((ok) => {
                    if (ok) {
                      setCatName('');
                      setCatModalOpen(false);
                    }
                  });
                }}
                className="flex h-11 items-center gap-2 rounded-full px-5 text-[13px] font-semibold text-white disabled:opacity-50"
                style={{ background: '#0F3D3E' }}
              >
                {busy && <Loader2 size={14} className="animate-spin" aria-hidden />} Add category
              </button>
            </>
          }
        >
          <div className="space-y-3">
            <div>
              <label htmlFor="cat-name" className={fieldLabel}>Name *</label>
              <input id="cat-name" type="text" value={catName} maxLength={40} onChange={(e) => setCatName(e.target.value)} placeholder="e.g. Coffee" className={fieldInput} autoFocus />
            </div>
            {catDuplicate && (
              <p className="rounded-xl bg-[#FDF3F2] px-3 py-2 text-[12.5px] text-[#B4483C]" role="alert">
                A category named “{catName.trim()}” is already on the shelf — pick a different name.
              </p>
            )}
            {actionError && <p className="rounded-xl bg-[#FDF3F2] px-3 py-2 text-[12.5px] text-[#B4483C]" role="alert">{actionError}</p>}
          </div>
        </Overlay>
      )}

      {/* item modal */}
      {itemModal && (
        <ItemModal
          categories={categories}
          initial={editingItem ? { name: editingItem.name, description: editingItem.description || '', price: String(editingItem.price), categoryId: editingItem.category_id || '', isVeg: editingItem.is_veg !== false, isAvailable: editingItem.is_available !== false } : null}
          busy={busy}
          error={actionError}
          onClose={() => {
            setItemModal(null);
            setActionError(null);
          }}
          onSave={(d) => {
            const payload = {
              name: d.name,
              description: d.description,
              price: Number.parseFloat(d.price),
              categoryId: d.categoryId || null,
              isVeg: d.isVeg,
              isAvailable: d.isAvailable,
            };
            void runAction(async () => {
              if (itemModal.mode === 'edit') await updateMenuItem(itemModal.itemId, tenantId, payload);
              else await createMenuItem(tenantId, payload);
            }, 'Saved').then((ok) => {
              if (ok) setItemModal(null);
            });
          }}
        />
      )}

      {/* variants modal */}
      {variantsItem && (
        <VariantsModal
          itemName={variantsItem.name}
          variants={variants.filter((v) => v.menu_item_id === variantsItem.id)}
          addons={addons}
          linkedAddonIds={links.get(variantsItem.id) || new Set()}
          busy={busy}
          error={actionError}
          onAddVariant={(name, delta) => void runAction(() => createVariant(tenantId, variantsItem.id, name, delta))}
          onDeleteVariant={(id) => void runAction(() => deleteVariant(id, tenantId))}
          onToggleAddon={(addonId, on) => {
            const next = new Set(links.get(variantsItem.id) || []);
            if (on) next.add(addonId);
            else next.delete(addonId);
            const itemLinks = new Map(links);
            itemLinks.set(variantsItem.id, next);
            setLinks(itemLinks); // optimistic — modal stays open, chips flip instantly
            void runAction(() => setItemAddons(tenantId, variantsItem.id, [...next]));
          }}
          onClose={() => {
            setVariantsModalFor(null);
            setActionError(null);
          }}
        />
      )}
    </div>
  );
}


