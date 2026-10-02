import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Coffee,
  Croissant,
  CupSoda,
  IceCreamCone,
  Loader2,
  Minus,
  PackageOpen,
  Pizza,
  Plus,
  ShoppingBag,
  Soup,
  UtensilsCrossed,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Category, MenuItem, OrderType } from '../../types';
import { createOrder, fetchCategories, fetchMenuItems, fetchTables, type DiningTable } from '../../lib/api';
import { useTenant } from '../../lib/tenant';
import { formatMoney } from '../../lib/prefs';
import { useUi } from '../../store/session';
import { cartTotal, useCart } from '../../store/cart';
import { ItemDetailModal } from './ItemDetailModal';

/**
 * Food & Drinks (Figma Food_&_Drinks_219-30044 / 219-29357 / Add_to_Order_219-30062 /
 * 219-26844 skeleton / Empty_State_219-29868):
 * categories grid of sage photo cards → items grid (gold prices, gold selected card)
 * → item detail modal → floating order pill + review drawer with GST 5% checkout.
 */

/* ────────────────────────────── helpers ────────────────────────────── */

function categoryIcon(name: string): LucideIcon {
  const n = name.toLowerCase();
  if (/(coffee|espresso|tea|brew|latte|cappuccino)/.test(n)) return Coffee;
  if (/pizza/.test(n)) return Pizza;
  if (/(croissant|bakery|bread|pastry|donut|doughnut|cake|muffin|dessert)/.test(n)) return Croissant;
  if (/(drink|soda|beverage|juice|cold|shake|smoothie|cola|water|mojito)/.test(n)) return CupSoda;
  if (/(ice\s?cream|gelato|sundae)/.test(n)) return IceCreamCone;
  if (/(soup|stew|broth|ramen|noodle|pho)/.test(n)) return Soup;
  return UtensilsCrossed;
}

const ORDER_TYPES: { value: OrderType; label: string }[] = [
  { value: 'dine_in', label: 'Dine-in' },
  { value: 'takeaway', label: 'Takeaway' },
  { value: 'delivery', label: 'Delivery' },
];

const round2 = (n: number) => Math.round(n * 100) / 100;

/* ─────────────────────────── presentational bits ─────────────────────────── */

const EmptyState: React.FC<{ icon: LucideIcon; title: string; body: string }> = ({
  icon: Icon,
  title,
  body,
}) => (
  <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
    <span
      aria-hidden
      className="flex h-20 w-20 items-center justify-center rounded-full bg-[#EAF0EC] text-[#0F3D3E]"
    >
      <Icon size={34} strokeWidth={1.6} />
    </span>
    <h3 className="mt-4 text-base font-bold text-[#1A1A1A]">{title}</h3>
    <p className="mt-1 max-w-sm text-[13px] leading-relaxed text-[#6B6B6B]">{body}</p>
  </div>
);

const SkeletonGrid: React.FC<{ count?: number; withCircle?: boolean }> = ({
  count = 8,
  withCircle = true,
}) => (
  <div aria-hidden className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="rounded-2xl border border-[#E3E7E0] bg-white p-5">
        <div className="flex flex-col items-center gap-3">
          {withCircle && <div className="sp-skeleton h-24 w-24 rounded-full" />}
          <div className="sp-skeleton h-3.5 w-3/4 rounded-full" />
          <div className="sp-skeleton h-3 w-1/2 rounded-full" />
          <div className="sp-skeleton h-4 w-1/3 rounded-full" />
        </div>
      </div>
    ))}
  </div>
);

const CategoryCard: React.FC<{ category: Category; onOpen: (c: Category) => void }> = ({
  category,
  onOpen,
}) => {
  const [imgFailed, setImgFailed] = useState(false);
  const Icon = categoryIcon(category.name);
  const showImage = Boolean(category.image_url) && !imgFailed;

  return (
    <button
      type="button"
      onClick={() => onOpen(category)}
      aria-label={`Open ${category.name}`}
      className="group flex flex-col items-center rounded-2xl bg-[#D9E2DD] px-5 py-6 text-center transition-shadow hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#967221]"
    >
      {showImage ? (
        <img
          src={category.image_url || ''}
          alt=""
          onError={() => setImgFailed(true)}
          className="h-28 w-28 rounded-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
        />
      ) : (
        <span
          aria-hidden
          className="flex h-28 w-28 items-center justify-center rounded-full bg-white/55 text-[#0F3D3E] transition-transform duration-200 group-hover:scale-[1.03]"
        >
          <Icon size={52} strokeWidth={1.6} />
        </span>
      )}
      <span className="mt-4 text-[15px] font-bold text-[#1A1A1A]">{category.name}</span>
    </button>
  );
};

const ItemCard: React.FC<{
  item: MenuItem;
  selected: boolean;
  onSelect: (item: MenuItem) => void;
  onAdd: (item: MenuItem) => void;
}> = ({ item, selected, onSelect, onAdd }) => {
  const [imgFailed, setImgFailed] = useState(false);
  const Icon = categoryIcon(item.name);
  const showImage = Boolean(item.image_url) && !imgFailed;
  const unavailable = item.is_available === false;
  const detail = (item.description || '').trim();

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (unavailable) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect(item);
    }
  };

  return (
    <div
      role="button"
      tabIndex={unavailable ? -1 : 0}
      aria-pressed={selected}
      aria-disabled={unavailable || undefined}
      aria-label={
        unavailable
          ? `${item.name}, unavailable`
          : `${item.name}, ${formatMoney(item.price)}${selected ? ', selected' : ''}`
      }
      onClick={() => !unavailable && onSelect(item)}
      onKeyDown={handleKeyDown}
      className={`flex cursor-pointer flex-col items-center rounded-2xl border p-4 text-center transition-shadow ${
        selected
          ? 'border-transparent bg-[#B88E2F] shadow-md'
          : 'border-[#E3E7E0] bg-white hover:shadow-md'
      } ${unavailable ? 'cursor-not-allowed opacity-60' : 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#967221]'}`}
    >
      {showImage ? (
        <img
          src={item.image_url || ''}
          alt=""
          onError={() => setImgFailed(true)}
          className={`h-36 w-full rounded-xl object-cover ${unavailable ? 'opacity-70 grayscale' : ''}`}
        />
      ) : (
        <span
          aria-hidden
          className={`flex h-20 w-20 items-center justify-center rounded-full ${
            selected ? 'bg-white/40 text-[#1A1A1A]' : 'bg-[#D9E2DD] text-[#0F3D3E]'
          }`}
        >
          <Icon size={36} strokeWidth={1.6} />
        </span>
      )}
      <span className="mt-3 text-[15px] font-bold text-[#1A1A1A]">{item.name}</span>
      {detail && (
        <span className={`mt-0.5 truncate text-xs ${selected ? 'text-[#1A1A1A]/70' : 'text-[#969696]'}`}>
          {detail}
        </span>
      )}
      {unavailable && (
        <span className="mt-1.5 rounded-full bg-[#FEF2F2] px-2 py-0.5 text-[10.5px] font-semibold text-[#B42318]">
          Unavailable
        </span>
      )}
      <span className={`mt-1 text-lg font-bold ${selected ? 'text-[#1A1A1A]' : 'text-[#B88E2F]'}`}>
        {formatMoney(item.price)}
      </span>
      {selected && !unavailable && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onAdd(item);
          }}
          aria-label={`Add ${item.name} to order`}
          className="mt-3 flex h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-white text-[13.5px] font-semibold text-[#0F3D3E] transition-colors hover:bg-[#F6F5F2] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0F3D3E]"
        >
          <Plus size={15} aria-hidden />
          Add
        </button>
      )}
    </div>
  );
};

/* ────────────────────────────── order drawer ────────────────────────────── */

const OrderDrawer: React.FC<{
  open: boolean;
  tenantId: string;
  onClose: () => void;
  onPlaced: (orderNumber: number) => void;
}> = ({ open, tenantId, onClose, onPlaced }) => {
  const cart = useCart();
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [tables, setTables] = useState<DiningTable[] | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // floor list for the table picker — loaded when the drawer opens
  useEffect(() => {
    if (!open || !tenantId) return;
    let alive = true;
    setTables(null);
    fetchTables(tenantId)
      .then((t) => {
        if (alive) setTables(t);
      })
      .catch(() => {
        if (alive) setTables([]);
      });
    return () => {
      alive = false;
    };
  }, [open, tenantId]);

  useEffect(() => {
    if (!open) return;
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const subtotal = round2(cartTotal(cart.lines));
  const tax = round2(subtotal * 0.05);
  const total = round2(subtotal + tax);
  const canPlace = cart.lines.length > 0 && !submitting;

  const placeOrder = async () => {
    if (!canPlace) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const order = await createOrder(tenantId, {
        orderType: cart.orderType,
        tableId: cart.orderType === 'dine_in' ? cart.tableId : null,
        tableLabel: cart.orderType === 'dine_in' ? cart.tableLabel || null : null,
        guestCount: cart.orderType === 'dine_in' ? cart.guestCount || null : null,
        customerName: cart.customerName || null,
        items: cart.lines.map((l) => ({
          name: l.name,
          qty: l.qty,
          unitPrice: l.unitPrice,
          menuItemId: l.menuItemId,
        })),
      });
      useCart.getState().clear();
      onPlaced(order.order_number);
      onClose();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Could not place the order. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Review order">
      <button
        type="button"
        aria-label="Close order drawer"
        onClick={onClose}
        className="absolute inset-0 h-full w-full cursor-default bg-[#0F3D3E]/45"
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col rounded-l-[24px] bg-white shadow-2xl outline-none"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E3E7E0] px-5 py-4">
          <h2 className="text-base font-bold text-[#1A1A1A]">Your Order</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-11 w-11 items-center justify-center rounded-full text-[#6B6B6B] transition-colors hover:bg-[#F6F5F2] hover:text-[#1A1A1A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#967221]"
          >
            <X size={18} aria-hidden />
          </button>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {/* Order type */}
          <div>
            <span className="mb-1.5 block text-[12px] font-medium text-[#6B6B6B]">Order type</span>
            <div role="radiogroup" aria-label="Order type" className="grid grid-cols-3 gap-1 rounded-xl bg-[#D9E2DD] p-1">
              {ORDER_TYPES.map((t) => {
                const active = cart.orderType === t.value;
                return (
                  <button
                    key={t.value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => cart.setOrderType(t.value)}
                    className={`flex h-11 items-center justify-center rounded-lg text-[13px] font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#967221] ${
                      active ? 'bg-[#0F3D3E] text-white shadow-sm' : 'text-[#6B6B6B] hover:text-[#1A1A1A]'
                    }`}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Dine-in fields + customer */}
          <div className="mt-4 grid grid-cols-2 gap-3">
            {cart.orderType === 'dine_in' && (
              <>
                <div>
                  <label htmlFor="od-table" className="mb-1 block text-[12px] font-medium text-[#6B6B6B]">
                    Table
                  </label>
                  <select
                    id="od-table"
                    value={cart.tableId || ''}
                    onChange={(e) => {
                      const id = e.target.value || null;
                      const t = (tables || []).find((x) => x.id === id);
                      cart.setTableId(t ? t.id : null);
                      cart.setTableLabel(t ? t.table_number : '');
                    }}
                    className="sp-input h-11 w-full px-3 text-[13.5px]"
                  >
                    <option value="">Walk-in / unassigned</option>
                    {(tables || []).map((t) => (
                      <option key={t.id} value={t.id} disabled={t.status === 'occupied' && t.id !== cart.tableId}>
                        {t.table_number} · {t.section} · {t.capacity} seats{t.status === 'occupied' ? ' (seated)' : t.status === 'reserved' ? ' (reserved)' : ''}
                      </option>
                    ))}
                  </select>
                  {tables === null && <p className="mt-1 text-[11px] text-[#6B6B6B]">Loading floor…</p>}
                  {tables !== null && tables.length === 0 && <p className="mt-1 text-[11px] text-[#6B6B6B]">No tables on the Floor yet — walk-ins are fine.</p>}
                </div>
                <div>
                  <label htmlFor="od-guests" className="mb-1 block text-[12px] font-medium text-[#6B6B6B]">
                    Guests
                  </label>
                  <input
                    id="od-guests"
                    type="number"
                    min={1}
                    value={cart.guestCount}
                    onChange={(e) => {
                      const n = e.target.valueAsNumber;
                      cart.setGuestCount(Number.isFinite(n) ? n : 0);
                    }}
                    className="sp-input h-11 w-full px-3 text-[13.5px]"
                  />
                </div>
              </>
            )}
            <div className={cart.orderType === 'dine_in' ? '' : 'col-span-2'}>
              <label htmlFor="od-customer" className="mb-1 block text-[12px] font-medium text-[#6B6B6B]">
                Customer name
              </label>
              <input
                id="od-customer"
                type="text"
                value={cart.customerName}
                onChange={(e) => cart.setCustomerName(e.target.value)}
                placeholder="Optional"
                className="sp-input h-11 w-full px-3 text-[13.5px]"
              />
            </div>
          </div>

          {/* Lines */}
          <div className="mt-4">
            <span className="mb-1 block text-[12px] font-medium text-[#6B6B6B]">Items</span>
            {cart.lines.length === 0 ? (
              <p className="rounded-xl bg-[#F6F5F2] px-3 py-4 text-center text-[13px] text-[#6B6B6B]">
                No items yet — add items from the menu.
              </p>
            ) : (
              <ul className="divide-y divide-[#E3E7E0]">
                {cart.lines.map((l) => (
                  <li key={l.key} className="flex items-start justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-[13.5px] font-semibold text-[#1A1A1A]">{l.name}</p>
                      {l.addonNames.length > 0 && (
                        <p className="mt-0.5 truncate text-[11.5px] text-[#969696]">
                          {l.addonNames.join(', ')}
                        </p>
                      )}
                      <span className="mt-1.5 flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => cart.decrement(l.key)}
                          aria-label={`Reduce ${l.name}`}
                          className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#E3E7E0] bg-white text-[#6B6B6B] transition-colors hover:text-[#1A1A1A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#967221]"
                        >
                          <Minus size={15} aria-hidden />
                        </button>
                        <span className="min-w-8 text-center text-sm font-semibold text-[#1A1A1A]">
                          {l.qty}x
                        </span>
                        <button
                          type="button"
                          onClick={() => cart.increment(l.key)}
                          aria-label={`Add one more ${l.name}`}
                          className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#B88E2F] text-white transition-colors hover:bg-[#967221] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#967221]"
                        >
                          <Plus size={15} aria-hidden />
                        </button>
                      </span>
                    </div>
                    <p className="pt-0.5 text-[13.5px] font-semibold text-[#1A1A1A]">
                      {formatMoney(round2(l.qty * l.unitPrice))}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-[#E3E7E0] px-5 py-4">
          {submitError && (
            <p
              role="alert"
              className="mb-3 rounded-xl border border-[#F5C6C0] bg-[#FEF2F2] px-3 py-2.5 text-[12.5px] leading-relaxed text-[#B42318]"
            >
              {submitError}
            </p>
          )}
          <dl className="mb-3 space-y-1.5 text-[13px]">
            <div className="flex items-center justify-between">
              <dt className="text-[#6B6B6B]">Subtotal</dt>
              <dd className="font-medium text-[#1A1A1A]">{formatMoney(subtotal)}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-[#6B6B6B]">GST (5%)</dt>
              <dd className="font-medium text-[#1A1A1A]">{formatMoney(tax)}</dd>
            </div>
            <div className="flex items-center justify-between border-t border-[#E3E7E0] pt-2">
              <dt className="font-bold text-[#1A1A1A]">Total</dt>
              <dd className="text-base font-bold text-[#1A1A1A]">{formatMoney(total)}</dd>
            </div>
          </dl>
          <button
            type="button"
            onClick={placeOrder}
            disabled={!canPlace}
            className="sp-cta flex h-12 w-full items-center justify-center gap-2 text-[15px]"
          >
            {submitting ? (
              <>
                <Loader2 size={17} className="animate-spin" aria-hidden />
                Placing…
              </>
            ) : (
              'Place Order'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

/* ────────────────────────────── main screen ────────────────────────────── */

const FoodDrinksInner: React.FC<{ onRetry: () => void }> = ({ onRetry }) => {
  const tenant = useTenant();
  const tenantId = tenant.tenantId;

  const breadcrumb = useUi((s) => s.breadcrumb);
  const setBreadcrumb = useUi((s) => s.setBreadcrumb);
  const search = useUi((s) => s.search);

  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailItem, setDetailItem] = useState<MenuItem | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [toast, setToast] = useState<{ kind: 'added' | 'placed'; message: string; orderNumber?: number } | null>(null);

  /* Breadcrumb contract: categories → ['Food & Drinks', 'Categories'];
     items → ['Food & Drinks', 'Categories', <CategoryName>] (frames 30044/29357). */
  useEffect(() => {
    if (breadcrumb[0] !== 'Food & Drinks' || breadcrumb.length < 2) {
      setBreadcrumb(['Food & Drinks', 'Categories']);
    }
  }, [breadcrumb, setBreadcrumb]);

  /* Items level is derived from the breadcrumb (Header back button works for free). */
  const isItemsLevel = breadcrumb[0] === 'Food & Drinks' && breadcrumb.length >= 3;
  const activeCategoryName = isItemsLevel ? breadcrumb[breadcrumb.length - 1] : null;
  const activeCategory = useMemo(
    () => categories.find((c) => c.name === activeCategoryName) || null,
    [categories, activeCategoryName]
  );

  useEffect(() => {
    setSelectedId(null);
  }, [activeCategoryName]);

  /* Production data load — no mocks, honest errors. */
  useEffect(() => {
    if (!tenantId) return;
    let alive = true;
    setDataLoading(true);
    setDataError(null);
    Promise.all([fetchCategories(tenantId), fetchMenuItems(tenantId)])
      .then(([cats, its]) => {
        if (!alive) return;
        setCategories(cats);
        setItems(its);
      })
      .catch((err: Error) => {
        if (!alive) return;
        setDataError(err.message);
      })
      .finally(() => {
        if (alive) setDataLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [tenantId, reloadTick]);

  /* Toast auto-dismiss. */
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), toast.kind === 'placed' ? 6500 : 3200);
    return () => window.clearTimeout(t);
  }, [toast]);

  const q = search.trim().toLowerCase();
  const visibleCategories = useMemo(
    () => (q ? categories.filter((c) => c.name.toLowerCase().includes(q)) : categories),
    [categories, q]
  );
  const visibleItems = useMemo(() => {
    if (!isItemsLevel) return [];
    const inCategory = activeCategory ? items.filter((i) => i.category_id === activeCategory.id) : [];
    return q ? inCategory.filter((i) => i.name.toLowerCase().includes(q)) : inCategory;
  }, [items, activeCategory, isItemsLevel, q]);

  const openCategory = useCallback(
    (c: Category) => {
      setBreadcrumb(['Food & Drinks', 'Categories', c.name]);
    },
    [setBreadcrumb]
  );

  const onSelectItem = useCallback(
    (item: MenuItem) => {
      if (selectedId === item.id) setDetailItem(item);
      else setSelectedId(item.id);
    },
    [selectedId]
  );

  const lines = useCart((s) => s.lines);
  const lineCount = useMemo(() => lines.reduce((sum, l) => sum + l.qty, 0), [lines]);
  const linesTotal = useMemo(() => cartTotal(lines), [lines]);

  /* ── Tenant loading → skeleton (frame 26844) ── */
  if (tenant.loading || (tenantId && dataLoading && categories.length === 0 && items.length === 0)) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 pt-5 sm:px-6 lg:px-8">
        <div className="sp-skeleton mb-5 h-6 w-44 rounded-full" aria-hidden />
        <div role="status" aria-label="Loading Food and Drinks">
          <span className="sr-only">Loading Food and Drinks…</span>
          <SkeletonGrid count={8} />
        </div>
      </div>
    );
  }

  /* ── Tenant error → honest card + gold Retry ── */
  if (tenant.error || !tenantId) {
    return (
      <div className="mx-auto w-full max-w-md px-4 pt-10 sm:px-6">
        <div className="sp-card p-6 text-center" role="alert">
          <span
            aria-hidden
            className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#FEF2F2] text-[#B42318]"
          >
            <UtensilsCrossed size={26} />
          </span>
          <h2 className="mt-3 text-base font-bold text-[#1A1A1A]">Couldn't load Food &amp; Drinks</h2>
          <p className="mt-1 text-[13px] leading-relaxed text-[#6B6B6B]">
            {tenant.error || 'No workspace is linked to this account.'}
          </p>
          <button type="button" onClick={onRetry} className="sp-cta mt-4 h-11 px-6 text-[13.5px]">
            Retry
          </button>
        </div>
      </div>
    );
  }

  /* ── Data error → honest card + gold Retry ── */
  if (dataError) {
    return (
      <div className="mx-auto w-full max-w-md px-4 pt-10 sm:px-6">
        <div className="sp-card p-6 text-center" role="alert">
          <span
            aria-hidden
            className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#FEF2F2] text-[#B42318]"
          >
            <UtensilsCrossed size={26} />
          </span>
          <h2 className="mt-3 text-base font-bold text-[#1A1A1A]">Couldn't load the menu</h2>
          <p className="mt-1 text-[13px] leading-relaxed text-[#6B6B6B]">{dataError}</p>
          <button
            type="button"
            onClick={() => setReloadTick((t) => t + 1)}
            className="sp-cta mt-4 h-11 px-6 text-[13.5px]"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-28 pt-5 sm:px-6 lg:px-8">
      <h1 className="mb-5 text-[22px] font-bold text-[#1A1A1A]">
        {isItemsLevel ? activeCategoryName || 'Items' : 'Categories'}
      </h1>

      {!isItemsLevel && (
        <>
          {visibleCategories.length === 0 ? (
            <EmptyState
              icon={PackageOpen}
              title="No categories yet"
              body="Categories created for this business in the cloud will show up here."
            />
          ) : (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
              {visibleCategories.map((c) => (
                <CategoryCard key={c.id} category={c} onOpen={openCategory} />
              ))}
            </div>
          )}
        </>
      )}

      {isItemsLevel && (
        <>
          {visibleItems.length === 0 ? (
            <EmptyState
              icon={PackageOpen}
              title="No items in this category"
              body="Menu items added to this category will show up here."
            />
          ) : (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
              {visibleItems.map((it) => (
                <ItemCard
                  key={it.id}
                  item={it}
                  selected={selectedId === it.id}
                  onSelect={onSelectItem}
                  onAdd={setDetailItem}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Item detail modal (Frame_30) */}
      {detailItem && (
        <ItemDetailModal
          item={detailItem}
          onClose={() => setDetailItem(null)}
          onAdded={({ name, qty }) =>
            setToast({ kind: 'added', message: `${qty}× ${name} added to order` })
          }
        />
      )}

      {/* Floating order pill */}
      {lineCount > 0 && (
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label={`Review order, ${lineCount} ${lineCount === 1 ? 'item' : 'items'}, ${formatMoney(
            linesTotal
          )}`}
          className="fixed bottom-5 right-5 z-40 flex h-12 items-center gap-2 rounded-full bg-[#B88E2F] px-5 text-[13.5px] font-semibold text-white shadow-lg transition-colors hover:bg-[#967221] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#967221]"
        >
          <ShoppingBag size={16} aria-hidden />
          <span className="whitespace-nowrap">
            {lineCount} {lineCount === 1 ? 'item' : 'items'} · {formatMoney(linesTotal)} ·
            Review order
          </span>
        </button>
      )}

      {/* Order drawer */}
      <OrderDrawer
        open={drawerOpen}
        tenantId={tenantId}
        onClose={() => setDrawerOpen(false)}
        onPlaced={(n) => setToast({ kind: 'placed', message: `Order #${n} placed`, orderNumber: n })}
      />

      {/* Floating toast */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="sp-card fixed bottom-5 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-3 px-4 py-3 shadow-xl"
        >
          <span
            aria-hidden
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#B88E2F] text-white"
          >
            {toast.kind === 'placed' ? <ShoppingBag size={14} /> : <Plus size={14} />}
          </span>
          <span className="whitespace-nowrap text-[13px] font-medium text-[#1A1A1A]">{toast.message}</span>
          {toast.kind === 'placed' && (
            <button
              type="button"
              onClick={() => useUi.getState().goSection('bills', ['Bills'])}
              className="h-11 rounded-lg px-2 text-[13px] font-bold text-[#B88E2F] underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#967221]"
            >
              View Bills
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export const FoodDrinksScreen: React.FC = () => {
  const [retryTick, setRetryTick] = useState(0);
  // Remount on Retry so useTenant re-resolves the workspace and data refetches.
  return <FoodDrinksInner key={retryTick} onRetry={() => setRetryTick((t) => t + 1)} />;
};
