import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpenText,
  Check,
  CircleAlert,
  Layers,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Trash2,
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
  fetchMenuItemAddonIds,
  fetchMenuItems,
  fetchMenuVariants,
  renameCategory,
  setItemAddons,
  updateMenuItem,
  type Addon,
  type Category,
  type MenuVariant,
} from '../../lib/api';
import { useTenant } from '../../lib/tenant';
import { formatMoney } from '../../lib/prefs';
import type { MenuItem } from '../../types';

/**
 * Menu management (v5.3.0) — the owner-facing side of "create menu item with
 * variants or addons": categories, items, per-item options (variants with a
 * price delta), a tenant-level add-on library, and which add-ons each item
 * offers. What lands here is exactly what the counter POS and the guest QR
 * menu render — one menu, every surface.
 */

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Timed confirmation flag ("Saved", "Added") with cleanup — mirrors Settings. */
function useTransientFlag(ms: number): [boolean, () => void] {
  const [on, setOn] = useState(false);
  const timer = useRef<number | null>(null);
  const fire = useCallback(() => {
    setOn(true);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setOn(false), ms);
  }, [ms]);
  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
  }, []);
  return [on, fire];
}

const VegDot: React.FC<{ veg: boolean }> = ({ veg }) => (
  <span
    className="flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border"
    title={veg ? 'Vegetarian' : 'Non-vegetarian'}
    style={{ borderColor: veg ? '#2E7D32' : '#B4483C' }}
  >
    <span className="h-2 w-2 rounded-full" style={{ background: veg ? '#2E7D32' : '#B4483C' }} />
  </span>
);

/* ── modals ─────────────────────────────────────────────────────────────── */

function Overlay({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="Close dialog" onClick={onClose} className="absolute inset-0 h-full w-full cursor-default bg-[#0F3D3E]/45" />
      <div className="absolute inset-x-2 top-1/2 -translate-y-1/2 sm:inset-x-0 sm:mx-auto" style={{ maxWidth: wide ? 560 : 440 }}>
        <div className="max-h-[86vh] overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl">
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
        </div>
      </div>
    </div>
  );
}

const fieldLabel = 'mb-1 block text-[12px] font-medium text-[#6B6B6B]';
const fieldInput = 'sp-input h-11 w-full px-3 text-[13.5px]';

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
    <Overlay title={initial ? 'Edit item' : 'New menu item'} onClose={onClose}>
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
        <div className="flex justify-end gap-2 pt-1">
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
        </div>
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
                <span className="text-[13px] font-bold" style={{ color: v.price_delta > 0 ? '#B88E2F' : '#2E7D32' }}>
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
                    <span className={on ? 'text-[#E7C878]' : 'text-[#B88E2F]'}>+₹{round2(a.price)}</span>
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

export function MenuScreen(): React.ReactElement {
  const { tenant, tenantId, error: tenantError, loading } = useTenant();
  const [tick, setTick] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [saved, fireSaved] = useTransientFlag(2200);

  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [variants, setVariants] = useState<MenuVariant[]>([]);
  const [addons, setAddons] = useState<Addon[]>([]);
  const [links, setLinks] = useState<Map<string, Set<string>>>(new Map());
  const [query, setQuery] = useState('');

  const [itemModal, setItemModal] = useState<{ mode: 'new' } | { mode: 'edit'; itemId: string } | null>(null);
  const [variantsModalFor, setVariantsModalFor] = useState<string | null>(null);
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [catName, setCatName] = useState('');
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
        const [cats, its, vs, as] = await Promise.all([
          fetchCategories(tenantId),
          fetchMenuItems(tenantId),
          fetchMenuVariants(tenantId),
          fetchAddons(tenantId),
        ]);
        if (!alive) return;
        setCategories(cats);
        setItems(its);
        setVariants(vs);
        setAddons(as);
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

  const runAction = useCallback(async (fn: () => Promise<unknown>, okMsg?: string) => {
    if (busyRef.current) return; // double-dispatch guard (batch-proof, unlike state)
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
  const catsWithItems = useMemo(() => {
    const grouped: { category: Category | null; list: MenuItem[] }[] = categories.map((c) => ({
      category: c,
      list: items.filter((i) => i.category_id === c.id),
    }));
    const orphan = items.filter((i) => !categories.some((c) => c.id === i.category_id));
    if (orphan.length > 0) grouped.push({ category: null, list: orphan });
    if (!q) return grouped;
    return grouped
      .map((g) => ({ ...g, list: g.list.filter((i) => `${i.name} ${i.description || ''}`.toLowerCase().includes(q)) }))
      .filter((g) => g.list.length > 0 || (q && g.category && g.category.name.toLowerCase().includes(q)));
  }, [categories, items, q]);

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
          <h1 className="font-serif text-[28px] italic leading-tight text-[#0F3D3E]">Menu</h1>
          <p className="mt-0.5 text-[13px] text-[#6B6B6B]">
            {tenant?.name} · {categories.length} categor{categories.length === 1 ? 'y' : 'ies'} · {totalItems} item{totalItems === 1 ? '' : 's'} — one menu for the counter, the kitchen and the QR.
          </p>
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
                  {a.name} ₹{round2(a.price)}
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
                return (
                  <div key={item.id} className="flex flex-wrap items-center gap-3 border-b border-[#F0F2EE] px-4 py-3 last:border-0 hover:bg-[#FBFBF9]">
                    <VegDot veg={item.is_veg !== false} />
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 truncate text-[14px] font-semibold text-[#1A1A1A]">
                        {item.name}
                        {item.is_available === false && <span className="rounded-full bg-[#FDF3F2] px-2 py-0.5 text-[10px] font-bold text-[#B4483C]">SOLD OUT</span>}
                      </p>
                      {item.description && <p className="truncate text-[12px] text-[#6B6B6B]">{item.description}</p>}
                      <p className="mt-0.5 flex flex-wrap gap-1.5 text-[10.5px]">
                        {itemVariants.length > 0 && <span className="rounded-full bg-[#F1F4F1] px-2 py-0.5 font-medium text-[#0F3D3E]">{itemVariants.length} option{itemVariants.length > 1 ? 's' : ''}</span>}
                        {itemAddonIds.size > 0 && <span className="rounded-full bg-[#FDF9F0] px-2 py-0.5 font-medium text-[#8A5A16]">{itemAddonIds.size} add-on{itemAddonIds.size > 1 ? 's' : ''}</span>}
                      </p>
                    </div>
                    <p className="text-[14.5px] font-bold" style={{ color: '#B88E2F' }}>{formatMoney(item.price)}</p>
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

      {/* category modal */}
      {catModalOpen && (
        <Overlay title="New category" onClose={() => setCatModalOpen(false)}>
          <div className="space-y-3">
            <div>
              <label htmlFor="cat-name" className={fieldLabel}>Name *</label>
              <input id="cat-name" type="text" value={catName} maxLength={40} onChange={(e) => setCatName(e.target.value)} placeholder="e.g. Coffee" className={fieldInput} autoFocus />
            </div>
            {actionError && <p className="rounded-xl bg-[#FDF3F2] px-3 py-2 text-[12.5px] text-[#B4483C]" role="alert">{actionError}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setCatModalOpen(false)} className="h-11 rounded-full border border-[#E3E7E0] px-4 text-[13px] font-semibold text-[#6B6B6B]">
                Cancel
              </button>
              <button
                type="button"
                disabled={!catName.trim() || busy}
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
            </div>
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


