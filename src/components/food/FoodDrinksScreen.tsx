import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CircleOff, Repeat, RotateCcw, Trash2 } from 'lucide-react';
import {
  Armchair,
  CircleAlert,
  Coffee,
  Croissant,
  CupSoda,
  IceCreamCone,
  Loader2,
  MessageSquare,
  MessageSquarePlus,
  Minus,
  PackageOpen,
  Pencil,
  Pizza,
  Plus,
  Search,
  ShoppingBag,
  Soup,
  UserCheck,
  UtensilsCrossed,
  X,
  Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Category, Customer, CustomerStats, MenuItem, MenuItemVariant, Offer, OrderType } from '../../types';
import { createOrder, fetchAddons, fetchCategories, fetchCustomerOrders, fetchCustomerStats, fetchCustomers, fetchInventory, fetchMenuItemAddonIds, fetchMenuItems, fetchMenuVariants, fetchOffers, fetchPaidMoverLines, fetchRecipeLines, fetchTables, updateMenuItem, type DiningTable, type InventoryItem, type RecipeLine } from '../../lib/api';
import { computePaceByItem, computeTopMovers, MOVER_WINDOW_DAYS, type Mover } from '../../lib/movers';
import { counterShelfLine, shelfCoverage, shelfDaysClause, type ShelfCoverage } from '../../lib/shelf';
import { CounterInbox } from './CounterInbox';
import { useTenant } from '../../lib/tenant';
import { useDialogA11y } from '../../lib/useDialogA11y';
import { formatMoney } from '../../lib/prefs';
import { deviceDayTag } from '../../lib/appday';
/* v5.280.0 — the tax rides the ONE rate (lib/tax: gstTax + the derived
 * percent words) and the rounding rides money.ts's round2 (the ONE
 * arithmetic home — the local def retired). */
import { gstPercentWord, gstTax } from '../../lib/tax';
import { round2 } from '../../lib/money';
/* v5.214.0 — the fit family moved to its cart-domain home (lib/offerFit):
   the guest menu's floating bar whispers the SAME fit, and a component
   file must never be a lib (the guest would have imported this screen's
   whole module graph to reach one reducer). One body, one voice — the
   screen renders it, the lib owns it. */
import { offerFit, offerFitVoice } from '../../lib/offerFit';
import { computeUsual, USUAL_WINDOW } from '../../lib/usual';
import { useUi } from '../../store/session';
import { cartTotal, offerDiscount, useCart, type CartLine } from '../../store/cart';
import { ItemDetailModal } from './ItemDetailModal';
import { VegMark } from '../shell/VegMark';
import { MarkHit } from '../shell/MarkHit';
import { EmptyState } from '../shell/EmptyState';

/**
 * Food & Drinks (Figma Food_&_Drinks_219-30044 / 219-29357 / Add_to_Order_219-30062 /
 * 219-26844 skeleton / Empty_State_219-29868):
 * categories grid of sage photo cards → items grid (gold prices, gold selected card)
 * → item detail modal → floating order pill + review drawer with GST checkout.
 *
 * v5.119.0 — the first door learns to say why: the shell search's oldest
 * consumer now keeps the box's promise level-honest (dynamic placeholder —
 * "Search categories…" vs "Search {category}…"), its empty states distinguish
 * a search miss from an empty catalog (what was searched, what the search
 * reaches, and a Clear search way out), and surviving names paint their
 * matched span gold (MarkHit — the rooms/shelf treatment, now menu-wide).
 */

/* ────────────────────────────── helpers ────────────────────────────── */

/* ── v5.78.0 — THE COUNTER'S SHORTLIST: the week's paid movers, one tap each.
   The store-wide sibling of the regular's usual: the usual names what ONE
   guest keeps ordering, the shortlist names what the ROOM keeps ordering.
   A speed surface — no category, no modal, one tap and the line is in. */

interface MoverEntry {
  mover: Mover;
  item: MenuItem;
  /** The chip rides the dish AS THE CARD PRINTS IT — the base price, no
   *  size inferred. The counter never silently upsizes a guest (the house
   *  rule the usual's well already obeys): a size is a conscious modal pick. */
  price: number;
}

function RushRail({
  entries,
  shelf,
  pace,
  onTap,
}: {
  entries: MoverEntry[];
  /* 5.91.0 — the shelf's answer per dish (null = the shelf hasn't been read:
     the line stays silent, never an invented number). */
  shelf: Map<string, ShelfCoverage>;
  /* 5.172.0 — the shelf's days: units per dish over the movers' window
     (computePaceByItem, whole menu, no cap). null = not read yet — the
     voice stays serves-only until the pace lands. */
  pace: Map<string, number> | null;
  onTap: (e: MoverEntry) => void;
}): React.ReactElement | null {
  if (entries.length === 0) return null;
  return (
    <section
      className="mb-5 rounded-2xl border border-[#EAD9BE] bg-[#FDF9F0] p-4"
      aria-label="The counter's shortlist"
    >
      <div className="mb-1 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-[15px] font-bold text-[#1A1A1A]">
          <Zap size={15} aria-hidden className="text-[#8A5A00]" />
          The counter's shortlist
        </h2>
        <span className="rounded-full bg-[#F3E8CF] px-2 py-0.5 text-[10.5px] font-bold tabular-nums text-[#8A5A00]">
          last {MOVER_WINDOW_DAYS} days
        </span>
      </div>
      <p className="mb-3 text-[11.5px] text-[#969696]">
        The week's movers by paid tickets — one tap, straight into the cart at the card price.
      </p>
      <div className="flex flex-wrap gap-2">
        {entries.map((e, i) => {
          const soldOut = e.item.is_available === false;
          const label = e.item.name;
          return (
            <button
              key={e.mover.menuItemId}
              type="button"
              onClick={() => onTap(e)}
              aria-label={
                soldOut
                  ? `${e.item.name}, sold out — open it to put it back on the menu`
                  : `Add ${label} to order — ${e.mover.units} sold this week, ${formatMoney(e.price)}`
              }
              className={`flex items-center gap-2.5 rounded-xl border border-[#E3E7E0] bg-[#FBFAF7] px-3 py-2 text-left transition hover:-translate-y-0.5 hover:border-[#B88E2F] hover:shadow-sm active:translate-y-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#967221] ${
                soldOut ? 'opacity-60' : ''
              }`}
            >
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11.5px] font-bold tabular-nums ${
                  i === 0 ? 'bg-[#B88E2F] text-white' : 'bg-[#F3E8CF] text-[#8A6A1F]'
                }`}
                aria-hidden
              >
                {i + 1}
              </span>
              <span className="text-left">
                <span className="block text-[13px] font-semibold leading-tight text-[#1F3A38]">
                  {e.item.name}
                  {soldOut && (
                    <span className="ml-1.5 rounded-full bg-[#FDF3F2] px-1.5 py-0.5 align-middle text-[9.5px] font-bold uppercase text-[#B4483C]">
                      sold out
                    </span>
                  )}
                </span>
                <span className="block text-[11px] tabular-nums text-[#969696]">
                  ×{e.mover.units} this week · {e.mover.tickets}{' '}
                  {e.mover.tickets === 1 ? 'ticket' : 'tickets'}
                </span>
                {/* 5.91.0 — the shelf's voice at the moment of selling: the same
                    answer the inventory board speaks, in the board's own tones
                    (green comfortable · amber low · red out · grey can't-say).
                    A dish with no recipe stays silent — silence, not zero.
                    5.170.0 — the pairing rides the ONE contract
                    (counterShelfLine), so the rail and the item sheet can
                    never disagree about a dish's voice or tone. */}
                {(() => {
                  const c = shelf.get(e.mover.menuItemId);
                  if (!c) return null;
                  /* 5.172.0 — the voice grows a days clause when the paid
                     pace answers: coverage ÷ pace-per-day, ONE math in
                     src/lib/shelf.ts. No pace → byte-identical to before. */
                  const p = pace?.get(e.mover.menuItemId) ?? null;
                  const line = counterShelfLine(c, p);
                  if (!line) return null;
                  return (
                    <span
                      className="mt-0.5 block text-[10.5px] font-semibold tabular-nums"
                      style={{ color: line.tone }}
                      title={
                        c.unknown
                          ? 'A recipe SKU is off the shelf — the shelf cannot answer.'
                          : c.coverage === 0
                            ? `The thinnest recipe SKU (${c.thin?.name || 'a SKU'}) is out — the shelf cannot make another.`
                            : `The shelf can make about ${c.coverage} more — the thinnest recipe SKU (${c.thin?.name || 'a SKU'}) decides.${shelfDaysClause(c.coverage, p) != null ? ` (${shelfDaysClause(c.coverage, p)})` : ''}`
                      }
                    >
                      {line.text}
                    </span>
                  );
                })()}
              </span>
              <span className="text-[12px] font-bold tabular-nums text-[#B88E2F]">
                {formatMoney(e.price)}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

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

/* ── v5.210.0 — the cart hears the offers ────────────────────────────
 * The fit's REDUCER and VOICE live in lib/offerFit.ts since v5.214.0
 * (cart-domain, borrowed by the guest menu's floating bar too — a
 * component file must never be a lib: the guest would have imported
 * this screen's whole module graph to reach one reducer). This screen
 * owns the SURFACE: the pill's chip and aria render the fit the lib
 * computes. */

/** What the drawer knows about the phone being keyed — CRM identity +
 *  ledger facts + the guest's most-ordered dish, matched against the live menu.
 *  v5.74.0 — the usual's NAME and SIZE now come from the ONE shared truth in
 *  src/lib/usual.ts (paid tickets only, 50-ticket window, deterministic
 *  tie-breaks) — the same definition the guest drawer's well speaks. */
interface RegularInfo {
  crm: Customer | null;
  stats: CustomerStats | null;
  usual: { name: string; qty: number; item: MenuItem | null } | null;
}

/** Digits-only phone key — the ledger stores phones as typed ("98765 43210"
 *  lives beside "9876543210"), so recognition normalizes; +91 prefixes drop. */
const phoneKey = (p: string): string => {
  const d = p.replace(/\D/g, '');
  return d.length > 10 ? d.slice(-10) : d;
};

/** "last seen today / yesterday / 2 Oct" — the book speaks in days, not timestamps. */
function fmtLastSeen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return 'today';
  const yest = new Date(now);
  yest.setDate(now.getDate() - 1);
  if (d.toDateString() === yest.toDateString()) return 'yesterday';
  return deviceDayTag(iso);
}

/** Teal strip bound to cart.tableId (v5.18.0): which table this cart is
 *  seated at, one-tap unassign, honest hint that guests can also scan the
 *  table's own QR. Invisible the moment the binding is gone. */
function TablePrelinkStrip(): React.ReactElement | null {
  const tableId = useCart((s) => s.tableId);
  const tableLabel = useCart((s) => s.tableLabel);
  const guestCount = useCart((s) => s.guestCount);
  if (!tableId) return null;
  return (
    <div
      role="status"
      className="mb-5 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#CFE3DC] bg-[#EAF4F0] px-4 py-3"
    >
      <p className="flex items-center gap-2.5 text-[13px] text-[#0F3D3E]">
        <span
          aria-hidden
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0F3D3E] text-white"
        >
          <Armchair size={15} />
        </span>
        <span>
          Ticket seated at <span className="font-bold">{tableLabel || 'a table'}</span>
          {guestCount > 0 && <span className="tabular-nums"> · {guestCount} guests</span>}
          <span className="text-[#416B62]"> — guests can also scan the table's own QR</span>
        </span>
      </p>
      <button
        type="button"
        onClick={() => {
          useCart.getState().setTableId(null);
          useCart.getState().setTableLabel('');
        }}
        aria-label={`Unassign table ${tableLabel || ''}`}
        className="flex h-8 items-center gap-1 rounded-full px-3 text-[12px] font-bold text-[#0F3D3E] transition-colors hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#967221]"
      >
        <X size={13} aria-hidden /> Unassign
      </button>
    </div>
  );
}

/* ─────────────────────────── presentational bits ─────────────────────────── */

/* v5.119.0 — the gold glint reached the menu; v5.120.0 — the component
 * itself moved to src/components/shell/MarkHit.tsx (one truth for every
 * search surface — the rooms Mark and the shelf ShelfMark live there
 * too). This file imports it like any other shell primitive.
 * v5.121.0 — the honest-miss layout followed the same arc: the private
 * EmptyState born here in 5.119.0 now lives in
 * src/components/shell/EmptyState.tsx (Bills' misses speak the same
 * voice), and this file imports it like any other shell primitive.
 * v5.122.0 — the count line reaches the menu (Bills' house pattern):
 * while a search narrows either grid, a badge says how much of the pool
 * the term captured — categories at the grid level, dishes inside one
 * (the pool = the open category, Veg already applied). */

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

const CategoryCard: React.FC<{
  category: Category;
  count: number;
  pulled: number;
  query?: string;
  onOpen: (c: Category) => void;
}> = ({ category, count, pulled, query, onOpen }) => {
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
      <span className="mt-4 text-[15px] font-bold text-[#1A1A1A]">
        <MarkHit text={category.name} query={query ?? ''} />
      </span>
      {/* 5.95.0 — the card says what it holds: an honest item count, and when
          some of them are pulled the caption names that too (a "3 items" card
          that opens onto one sellable dish was a small lie). */}
      <span className="mt-0.5 text-[12px] font-medium text-[#5F6B63]">
        {count} {count === 1 ? 'item' : 'items'}
        {pulled > 0 ? ` · ${pulled} pulled` : ''}
      </span>
    </button>
  );
};

const ItemCard: React.FC<{
  item: MenuItem;
  selected: boolean;
  query?: string;
  onSelect: (item: MenuItem) => void;
  onAdd: (item: MenuItem) => void;
}> = ({ item, selected, query, onSelect, onAdd }) => {
  const [imgFailed, setImgFailed] = useState(false);
  const Icon = categoryIcon(item.name);
  const showImage = Boolean(item.image_url) && !imgFailed;
  /* v5.57.0 — a pulled dish is no longer a wall: the card still opens (first
     tap), the modal becomes the way back. Only order-building is blocked. */
  const unavailable = item.is_available === false;
  const detail = (item.description || '').trim();

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (unavailable) onAdd(item);
      else onSelect(item);
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={
        unavailable
          ? `${item.name}, sold out — open to put it back on the menu`
          : `${item.name}, ${formatMoney(item.price)}${
              item.is_veg === true ? ', vegetarian' : item.is_veg === false ? ', non-vegetarian' : ''
            }${selected ? ', selected' : ''}`
      }
      onClick={() => (unavailable ? onAdd(item) : onSelect(item))}
      onKeyDown={handleKeyDown}
      className={`flex cursor-pointer flex-col items-center rounded-2xl border p-4 text-center transition-shadow ${
        selected
          ? 'border-transparent bg-[#B88E2F] shadow-md'
          : 'border-[#E3E7E0] bg-white hover:shadow-md'
      } ${unavailable ? 'opacity-60' : 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#967221]'}`}
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
      <span className="mt-3 text-[15px] font-bold text-[#1A1A1A]">
        <MarkHit text={item.name} query={query ?? ''} />
      </span>
      {detail && (
        <span className={`mt-0.5 truncate text-xs ${selected ? 'text-[#1A1A1A]/70' : 'text-[#969696]'}`}>
          {detail}
        </span>
      )}
      {unavailable && (
        /* v5.57.0 — the Menu screen's own SOLD OUT tone (#B4483C on #FDF3F2):
           one vocabulary from the owner's list to the counter grid, instead
           of the old lone "Unavailable" pill nobody else spoke. */
        <span className="mt-1.5 rounded-full bg-[#FDF3F2] px-2 py-0.5 text-[10.5px] font-bold tracking-[0.06em] text-[#B4483C]">
          SOLD OUT
        </span>
      )}
      <span className={`mt-1 flex items-center justify-center gap-1.5 text-lg font-bold ${selected ? 'text-[#1A1A1A]' : 'text-[#B88E2F]'}`}>
        <VegMark veg={item.is_veg} size={14} />
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
  /** The live menu — the recognition well matches the guest's usual dish
   *  against it, so "add their usual" can only ever sell what exists today. */
  items: MenuItem[];
  /* v5.210.0 — the ACTIVE offers, the screen's own state (null = the read
   * hasn't landed or failed: the picker hides — an unread register never
   * becomes a fabricated "no offers"). The drawer no longer reads offers
   * itself: the pill and the picker quote ONE register, they can never
   * disagree. The screen refreshes the read on every drawer open. */
  offers: Offer[] | null;
  /** Variant-bearing usuals open the item modal — the drawer can't reach the
   *  parent's modal state, so the parent hands down the gesture. */
  onChooseItem: (item: MenuItem) => void;
  /** v5.272.0 — the line's Edit verb (5.271's law, one cart later): the
   *  drawer hands the line AND its live dish to the parent, which closes the
   *  drawer and opens the dish's own room PRE-FILLED. A stale line never
   *  reaches here — the verb is dead before the hand. */
  onEditLine: (line: CartLine, item: MenuItem) => void;
  onClose: () => void;
  onPlaced: (orderNumber: number) => void;
}> = ({ open, tenantId, items, offers, onChooseItem, onEditLine, onClose, onPlaced }) => {
  const cart = useCart();
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [tables, setTables] = useState<DiningTable[] | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  /* v5.110.0 — the order drawer holds the door (replaces the hand-rolled Escape
     listener + manual panel focus; Escape stands down once the order posts). */
  const dlgRef = useDialogA11y<HTMLDivElement>(() => { if (!submitting) onClose(); }, open, panelRef);
  /* v5.76.0 — the line-note editor: which line is speaking, and its draft.
     Commits through cart.setLineNote (trims, empty clears). The editor row
     only renders while its line exists, so a stale key after a clear is
     harmless. */
  const [noteKey, setNoteKey] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const commitNote = () => {
    if (noteKey) cart.setLineNote(noteKey, noteDraft);
    setNoteKey(null);
    setNoteDraft('');
  };

  /* v5.273.0 — the clear door's arm: armed by the first tap, disarmed by
     four seconds alone, by the drawer closing, or by the clear itself.
     One arm at a time — a destructive verb that cannot be undone earns a
     second word before it acts. */
  const [clearArmed, setClearArmed] = useState(false);
  useEffect(() => {
    if (!clearArmed) return;
    const t = window.setTimeout(() => setClearArmed(false), 4000);
    return () => window.clearTimeout(t);
  }, [clearArmed]);
  useEffect(() => {
    if (!open) setClearArmed(false);
  }, [open]);

  /* Regular guest recognition (5.62.0) — the CRM + ledger speak while the
     cashier keys the phone. Recognition is a bonus, never a gate: any read
     failure stays silent and the ticket flows as if the book were empty. */
  const [regular, setRegular] = useState<{ key: string; info: RegularInfo | null } | null>(null);
  const [regLoading, setRegLoading] = useState(false);
  const phoneInput = cart.customerPhone;

  useEffect(() => {
    const key = phoneKey(phoneInput);
    if (!open || !tenantId || key.length < 6) {
      setRegular(null);
      setRegLoading(false);
      return;
    }
    if (regular && regular.key === key) return; // already answered for this phone
    let alive = true;
    setRegLoading(true);
    const timer = setTimeout(async () => {
      try {
        const [statsMap, crmRows] = await Promise.all([
          fetchCustomerStats(tenantId),
          fetchCustomers(tenantId),
        ]);
        if (!alive) return;
        let stats: CustomerStats | null = null;
        let rawPhone = '';
        for (const [p, s] of statsMap) {
          if (phoneKey(p) === key) {
            stats = s;
            rawPhone = p;
            break;
          }
        }
        const crm = crmRows.find((c) => phoneKey(c.phone) === key) || null;
        if (!stats || stats.orders_placed === 0) {
          // book-only phone (or a ghost of cancelled tickets): the name is
          // worth showing, history never is.
          if (!alive) return;
          setRegular({ key, info: crm ? { crm, stats, usual: null } : null });
          setRegLoading(false);
          return;
        }
        const past = await fetchCustomerOrders(tenantId, rawPhone, USUAL_WINDOW);
        if (!alive) return;
        /* v5.74.0 — the shared usual: paid tickets only, over the same
         * 50-ticket window the guest drawer reads, tie-broken the same
         * deterministic way. The chip, the well and the ledger cannot
         * disagree about a regular's habit anymore. */
        const shared = computeUsual(past);
        const usual: RegularInfo['usual'] = shared
          ? { name: shared.name, qty: shared.units, item: items.find((m) => m.name === shared.name) || null }
          : null;
        setRegular({ key, info: { crm, stats, usual } });
      } catch {
        if (alive) setRegular({ key, info: null }); // silent-bonus discipline
      }
      if (alive) setRegLoading(false);
    }, 420);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, phoneInput, tenantId, items, regular]);

  const regKey = phoneKey(cart.customerPhone);
  const regActive = regular && regular.key === regKey ? regular.info : null;
  const regHistory =
    regActive?.stats && regActive.stats.orders_placed > 0 ? regActive.stats : null;
  const regShowLoad = regLoading && regKey.length >= 6 && !regActive;
  const regCrmName = regActive?.crm?.name || null;
  const regSuggestName = !!regCrmName && !cart.customerName.trim();
  const regUsual = regActive?.usual ?? null;

  const addTheirUsual = useCallback(() => {
    if (!regUsual?.item) return;
    cart.add(regUsual.item, 1, [], undefined);
  }, [regUsual, cart]);

  const chooseTheirUsual = useCallback(() => {
    if (!regUsual?.item) return;
    onClose();
    onChooseItem(regUsual.item);
  }, [regUsual, onClose, onChooseItem]);

  // floor list — loaded when the drawer opens. The offers ride the
  // SCREEN's state (v5.210.0): the parent refreshes its read on every
  // open, so the picker quotes the freshest register without holding a
  // second one of its own.
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

  if (!open) return null;

  const subtotal = round2(cartTotal(cart.lines));
  const discount = offerDiscount(cart.offer, subtotal);
  const tax = gstTax(subtotal - discount);
  const total = round2(subtotal - discount + tax);
  const offerEligible = (o: Offer) => subtotal >= o.min_order_amount;
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
        customerPhone: cart.customerPhone.trim() || null,
        // v5.76.0 — the ticket's word to the kitchen, riding FIRST in the
        // context string (before Table:/Guests:) so the board's chip leads
        // with what the guest actually asked for.
        notes: cart.kitchenNote.trim() || null,
        discountAmount: discount > 0 ? discount : null,
        offerId: discount > 0 && cart.offer ? cart.offer.id : null,
        items: cart.lines.map((l) => ({
          name: l.name,
          qty: l.qty,
          unitPrice: l.unitPrice,
          menuItemId: l.menuItemId,
          variantName: l.variantName || null,
          // v5.56.0 — the extras ride to the ledger; receipts/KDS/track read
          // them back the same way they do for guest-placed tickets.
          addons: l.addons,
          // v5.76.0 — the line's word rides to order_items.notes, the column
          // KDS prints as an orange ↳ whisper and the receipt as a bullet.
          notes: l.note?.trim() || undefined,
        })),
      });
      useCart.getState().clear();
      setNoteKey(null);
      setNoteDraft('');
      onPlaced(order.order_number);
      onClose();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Could not place the order. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div ref={dlgRef} className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Review order">
      <button
        type="button"
        aria-label="Close order drawer"
        onClick={onClose}
        className="absolute inset-0 h-full w-full cursor-default bg-[#0F3D3E]/45 focus-visible:outline-none"
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
            <div className="col-span-2">
              <label htmlFor="od-phone" className="mb-1 block text-[12px] font-medium text-[#6B6B6B]">
                Phone <span className="text-[#969696]">· books the guest in CRM</span>
              </label>
              <input
                id="od-phone"
                type="tel"
                inputMode="tel"
                value={cart.customerPhone}
                onChange={(e) => cart.setCustomerPhone(e.target.value)}
                placeholder="98765 43210"
                className="sp-input h-11 w-full px-3 text-[13.5px]"
              />
            </div>
            {/* Regular guest recognition (5.62.0): the book speaks while the
                cashier keys — identity is teal, the usual rides existing paths. */}
            {regActive && (
              <div className="col-span-2 rounded-xl border border-[#E3E7E0] bg-[#FBFBF9] px-3.5 py-3">
                <p className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[#969696]">
                  <UserCheck size={12} aria-hidden />
                  {regHistory ? 'Regular guest' : 'In the book'}
                </p>
                <p className="mt-1 text-[13.5px] font-semibold text-[#1A1A1A]">
                  {regCrmName || 'Known phone'}
                </p>
                {regHistory ? (
                  <p className="mt-0.5 text-[11.5px] tabular-nums text-[#6B6B6B]">
                    {regHistory.visits > 0
                      ? `${regHistory.visits} ${regHistory.visits === 1 ? 'visit' : 'visits'}`
                      : `${regHistory.orders_placed} ${regHistory.orders_placed === 1 ? 'order' : 'orders'}`}
                    {regHistory.total_spent > 0 && (
                      <>
                        {' · '}
                        <span className="font-semibold text-[#8A6D1F]">{formatMoney(regHistory.total_spent)}</span> lifetime
                      </>
                    )}
                    {regHistory.last_visit_at && <> · last seen {fmtLastSeen(regHistory.last_visit_at)}</>}
                  </p>
                ) : (
                  <p className="mt-0.5 text-[11.5px] text-[#6B6B6B]">
                    First order on this phone — the ledger will remember it.
                  </p>
                )}
                {(regSuggestName || regUsual) && (
                  <div className="mt-2.5 flex flex-wrap items-center gap-2">
                    {regSuggestName && regCrmName && (
                      <button
                        type="button"
                        onClick={() => cart.setCustomerName(regCrmName)}
                        className="rounded-lg border border-[#E3E7E0] bg-white px-2.5 py-1.5 text-[11.5px] font-semibold text-[#0F3D3E] transition-colors hover:bg-[#EEF3F1]"
                      >
                        It's {regCrmName} — add name
                      </button>
                    )}
                    {regUsual?.item && regUsual.item.is_available !== false && (
                      regUsual.item.variants && regUsual.item.variants.length > 0 ? (
                        <button
                          type="button"
                          onClick={chooseTheirUsual}
                          className="rounded-lg border border-[#E3E7E0] bg-white px-2.5 py-1.5 text-[11.5px] font-semibold text-[#0F3D3E] transition-colors hover:bg-[#EEF3F1]"
                        >
                          Usually {regUsual.name} — choose size
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={addTheirUsual}
                          className="rounded-lg bg-[#0F3D3E] px-2.5 py-1.5 text-[11.5px] font-semibold text-white transition-colors hover:bg-[#0C3233]"
                        >
                          Add their usual — {regUsual.name}
                        </button>
                      )
                    )}
                    {regUsual?.item && regUsual.item.is_available === false && (
                      <p className="flex items-center gap-1.5 text-[11.5px] text-[#969696]">
                        <CircleOff size={12} aria-hidden />
                        Their usual {regUsual.name} is sold out right now
                      </p>
                    )}
                    {regUsual && !regUsual.item && (
                      <p className="text-[11.5px] text-[#969696]">Usually orders {regUsual.name}</p>
                    )}
                  </div>
                )}
              </div>
            )}
            {regShowLoad && (
              <p className="col-span-2 px-1 text-[11px] text-[#969696]">Checking the book…</p>
            )}
            {/* v5.76.0 — the ticket's word to the kitchen. orders.notes has
                carried the chip on the board since 001 and the receipt reads
                it too, but only the guest door ever wrote it — the counter
                was mute. One honest line, trimmed at the store boundary. */}
            <div className="col-span-2">
              <label htmlFor="od-kitchen-note" className="mb-1 flex items-center gap-1.5 text-[12px] font-medium text-[#6B6B6B]">
                <MessageSquare size={12} aria-hidden />
                Kitchen note <span className="text-[#969696]">· the board reads it first</span>
              </label>
              <textarea
                id="od-kitchen-note"
                rows={2}
                maxLength={240}
                value={cart.kitchenNote}
                onChange={(e) => cart.setKitchenNote(e.target.value)}
                placeholder="e.g. candle with the muffin · pack separately · guest allergic to nuts"
                className="sp-input w-full resize-none px-3 py-2.5 text-[13.5px] leading-relaxed"
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
                {cart.lines.map((l) => {
                  /* v5.272.0 — the edit verb reads the LIVE menu: the dish the
                     line was sold as must still be on it (and not pulled) for
                     its choices to be re-said — the stale law (308's, two
                     verbs later). The minus and the note pencil stay live. */
                  const lineItem = items.find((m) => m.id === l.menuItemId) || null;
                  const stale = !lineItem || lineItem.is_available === false;
                  return (
                  <li key={l.key} className="flex items-start justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 truncate text-[13.5px] font-semibold text-[#1A1A1A]">
                        <VegMark veg={l.isVeg} size={13} />
                        {l.name}
                        {l.variantName && (
                          <span className="shrink-0 rounded-full bg-[#F6F5F2] px-1.5 py-px text-[10.5px] font-bold text-[#6B6B6B]">
                            {l.variantName}
                          </span>
                        )}
                        {/* v5.273.0 — the line says WHY its verbs are dead: the
                            dish's own SOLD OUT vocabulary (the grid card's
                            strip, the modal's badge — one house tone) rides
                            the drawer row when the dish is pulled or gone. */}
                        {stale && (
                          <span
                            className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-[#FDF3F2] px-1.5 py-px text-[9.5px] font-bold uppercase tracking-[0.08em] text-[#B4483C]"
                            title="This dish is pulled — the line can shrink or leave, but not grow or be re-said"
                          >
                            <CircleOff size={9} aria-hidden />
                            Sold out
                          </span>
                        )}
                      </p>
                      {l.addonNames.length > 0 && (
                        <p className="mt-0.5 truncate text-[11.5px] text-[#5F6B63]">
                          {/* the receipt's per-extra `+` grammar, one voice
                             across drawer / KDS / counter inbox / paper */}
                          + {l.addonNames.join(', + ')}
                        </p>
                      )}
                      {/* v5.76.0 — the line's word to the kitchen, shown in the
                          SAME whisper the board prints (orange ↳, italic): what
                          the cashier types is byte-for-byte what the kitchen
                          reads. Click the pencil to speak or re-speak it. */}
                      {l.note && noteKey !== l.key && (
                        <p className="mt-0.5 flex max-w-full items-center gap-1 text-[11.5px] italic leading-snug text-[#C2571B]" title={l.note}>
                          <span aria-hidden>↳</span>
                          <span className="truncate">{l.note}</span>
                        </p>
                      )}
                      {noteKey === l.key && (
                        <span className="mt-1.5 flex w-full items-center gap-1.5">
                          <input
                            type="text"
                            autoFocus
                            value={noteDraft}
                            onChange={(e) => setNoteDraft(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                commitNote();
                              }
                              if (e.key === 'Escape') {
                                e.preventDefault();
                                setNoteKey(null);
                                setNoteDraft('');
                              }
                            }}
                            placeholder="e.g. less spicy · no onion · oat milk"
                            aria-label={`Kitchen note for ${l.name}`}
                            maxLength={120}
                            className="sp-input h-11 min-w-0 flex-1 px-3 text-[12.5px]"
                          />
                          <button
                            type="button"
                            onClick={commitNote}
                            className="h-11 shrink-0 rounded-xl bg-[#0F3D3E] px-3.5 text-[12px] font-semibold text-white transition-colors hover:bg-[#0C3233] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#967221]"
                          >
                            Save
                          </button>
                        </span>
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
                          disabled={stale}
                          aria-disabled={stale}
                          aria-label={
                            stale
                              ? `${l.name} is sold out — this line can shrink or leave, but not grow`
                              : `Add one more ${l.name}`
                          }
                          title={stale ? 'Sold out — this line cannot grow' : undefined}
                          className={`flex h-11 w-11 items-center justify-center rounded-xl bg-[#B88E2F] text-white transition-colors hover:bg-[#967221] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#967221] ${
                            stale ? 'cursor-not-allowed opacity-40' : ''
                          }`}
                        >
                          <Plus size={15} aria-hidden />
                        </button>
                        {/* v5.76.0 — the line speaks. Ghost pencil beside the
                            steppers: tinted when the line already carries a
                            word (the kitchen will read it), grey when silent. */}
                        <span aria-hidden className="mx-0.5 h-6 w-px bg-[#E3E7E0]" />
                        <button
                          type="button"
                          onClick={() => {
                            if (noteKey === l.key) {
                              setNoteKey(null);
                              setNoteDraft('');
                            } else {
                              setNoteKey(l.key);
                              setNoteDraft(l.note ?? '');
                            }
                          }}
                          aria-label={l.note ? `Edit the kitchen note for ${l.name}` : `Add a kitchen note for ${l.name}`}
                          aria-expanded={noteKey === l.key}
                          className={`flex h-11 w-11 items-center justify-center rounded-xl border transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#967221] ${
                            l.note
                              ? 'border-[#EAD9BE] bg-[#FDF9F0] text-[#C2571B] hover:bg-[#F9F1E2]'
                              : 'border-[#E3E7E0] bg-white text-[#6B6B6B] hover:text-[#1A1A1A]'
                          } ${noteKey === l.key ? 'ring-1 ring-[#E3E7E0]' : ''}`}
                        >
                          <MessageSquarePlus size={15} aria-hidden />
                        </button>
                        {/* v5.272.0 — the line's SECOND pencil: Edit, deep-green
                            ink reading "make it right" (5.271's own ink) beside
                            the note pencil's amber-when-armed. THE STALE LAW
                            EXTENDS (308's law, two verbs later): a pulled or
                            vanished dish's line can shrink or leave, but its
                            choices can never be re-said — the verb is dead. */}
                        <span aria-hidden className="mx-0.5 h-6 w-px bg-[#E3E7E0]" />
                        <button
                          type="button"
                          onClick={() => {
                            if (lineItem && !stale) onEditLine(l, lineItem);
                          }}
                          disabled={stale}
                          aria-disabled={stale}
                          aria-label={
                            stale
                              ? `${l.name} is sold out — this line can shrink or leave, but not be re-said`
                              : `Edit ${l.name} — change options or quantity`
                          }
                          title={
                            stale
                              ? 'Sold out — this line cannot be re-said'
                              : 'Change this line\u2019s options or quantity'
                          }
                          className={`flex h-11 w-11 items-center justify-center rounded-xl border transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#967221] ${
                            stale
                              ? 'cursor-not-allowed border-[#E3E7E0] bg-white text-[#0F3D3E]/35 disabled:hover:bg-white'
                              : 'border-[#E3E7E0] bg-white text-[#0F3D3E] hover:bg-[#F1F5F4]'
                          }`}
                        >
                          <Pencil size={15} aria-hidden />
                        </button>
                      </span>
                    </div>
                    <p className="pt-0.5 text-[13.5px] font-semibold text-[#1A1A1A]">
                      {formatMoney(round2(l.qty * l.unitPrice))}
                    </p>
                  </li>
                  );
                })}
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
          {/* Offer picker (016) — active offers, min-order aware, live discount.
              v5.210.0 — the offers are the screen's own state (the prop):
              the pill and this picker quote ONE register, and a failed or
              unfinished read hides the picker — silence, never a
              fabricated "no offers". */}
          {offers && offers.length > 0 && (
            <div className="mb-3">
              <label htmlFor="od-offer" className="mb-1 block text-[12px] font-medium text-[#6B6B6B]">
                Offer
              </label>
              <select
                id="od-offer"
                value={cart.offer?.id || ''}
                onChange={(e) => {
                  const next = offers.find((o) => o.id === e.target.value) || null;
                  cart.setOffer(next && offerEligible(next) ? next : null);
                }}
                className="sp-input h-11 w-full px-3 text-[13.5px]"
              >
                <option value="">No offer</option>
                {offers.map((o) => (
                  <option key={o.id} value={o.id} disabled={!offerEligible(o)}>
                    {o.title} · {o.discount_type === 'percent' ? `${o.discount_value}% off` : `${formatMoney(o.discount_value)} off`}
                    {!offerEligible(o) && ` (min ${formatMoney(o.min_order_amount)})`}
                  </option>
                ))}
              </select>
              {cart.offer && !offerEligible(cart.offer) && (
                <p className="mt-1 text-[11.5px] text-[#B42318]">
                  Add {formatMoney(cart.offer.min_order_amount - subtotal)} more to use {cart.offer.title}.
                </p>
              )}
            </div>
          )}
          <dl className="mb-3 space-y-1.5 text-[13px]">
            <div className="flex items-center justify-between">
              <dt className="text-[#6B6B6B]">Subtotal</dt>
              <dd className="font-medium text-[#1A1A1A]">{formatMoney(subtotal)}</dd>
            </div>
            {discount > 0 && (
              <div className="flex items-center justify-between">
                <dt className="flex items-center gap-1.5 text-[#2E7D32]">
                  <span className="rounded-md bg-[#E8F3E9] px-1.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wide">
                    Offer
                  </span>
                  {cart.offer?.title}
                </dt>
                <dd className="font-semibold text-[#2E7D32]">−{formatMoney(discount)}</dd>
              </div>
            )}
            <div className="flex items-center justify-between">
              <dt className="text-[#6B6B6B]">GST ({gstPercentWord()})</dt>
              <dd className="font-medium text-[#1A1A1A]">{formatMoney(tax)}</dd>
            </div>
            <div className="flex items-center justify-between border-t border-[#E3E7E0] pt-2">
              <dt className="font-bold text-[#1A1A1A]">Total</dt>
              <dd className="text-base font-bold text-[#1A1A1A]">{formatMoney(total)}</dd>
            </div>
          </dl>
          {/* v5.273.0 — the drawer's way out: an abandoned order (the
              walk-in who leaves, the wrong table) used to mean decrementing
              every line by hand. Clear is a QUIET destructive verb in the
              house's red register, ARMED by a two-tap confirm (the first
              tap turns it solid and speaks the warning; the second acts;
              four seconds alone or the drawer closing disarms) — because
              this one cannot be undone. clear() is the place flow's own
              reset: the lines leave, the note editor's draft dies, and the
              TABLE BINDING RELEASES with them (the store's own clause) so
              the next walk-in can never inherit a table already seated. */}
          {cart.lines.length > 0 && !submitting && (
            <button
              type="button"
              onClick={() => {
                if (clearArmed) {
                  useCart.getState().clear();
                  setNoteKey(null);
                  setNoteDraft('');
                  setClearArmed(false);
                  onClose();
                } else {
                  setClearArmed(true);
                }
              }}
              aria-label={
                clearArmed
                  ? 'Tap again — clearing the order cannot be undone'
                  : 'Clear the whole order'
              }
              className={`mb-2 flex h-11 w-full items-center justify-center gap-2 rounded-xl border text-[13px] font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#967221] ${
                clearArmed
                  ? 'border-[#B4483C] bg-[#B4483C] text-white hover:bg-[#9E3F35]'
                  : 'border-transparent bg-transparent text-[#B4483C] hover:bg-[#FDF3F2]'
              }`}
            >
              <Trash2 size={14} aria-hidden />
              {clearArmed ? 'Tap again — this cannot be undone' : 'Clear order'}
            </button>
          )}
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
  const setSearch = useUi((s) => s.setSearch);
  /* v5.116.0 — the menu is the shell search box's FIRST and oldest
   * consumer; it says so via the registration contract. v5.119.0 — the
   * registration went DYNAMIC: the box's promise now moves with the
   * screen's level (see the level-aware effect at the breadcrumb
   * derivation below). */
  /* Veg-only (v5.53.0) — the counter speaks the same leaf the guest menu
     speaks: a phone order saying "veg only" filters in one tap. */
  const [vegOnly, setVegOnly] = useState(false);

  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  /** The shortlist's raw truth (v5.78.0): null = still reading, [] = the week
   *  was quiet (or the read failed — the rail is never a gate, it stays home). */
  const [movers, setMovers] = useState<Mover[] | null>(null);
  /* 5.91.0 — the shelf, read fail-soft alongside the shortlist: recipes (015)
     + the stock they draw from. null = not yet read (or the read failed) —
     the shelf stays silent on the cards, never an invented number. */
  const [shelf, setShelf] = useState<{ items: InventoryItem[]; recipes: RecipeLine[] } | null>(null);
  /* 5.172.0 — the pace behind the shelf's days: units per dish over the
     movers' window, WHOLE menu (the item sheet opens any dish). Set
     alongside the shortlist from the same paid rows; null = not read. */
  const [pace, setPace] = useState<Map<string, number> | null>(null);
  /* v5.210.0 — the ACTIVE offers, the screen's own register: ONE read
     feeding BOTH the order pill's fit whisper and the review drawer's
     picker (the drawer's own fetch retired — two readers of one state
     can never disagree, and the picker quotes the same words the pill
     does). Refreshed on mount and on every drawer open (the picker must
     meet offers created mid-shift). null = the read hasn't landed (or
     failed): the pill stays silent, the picker hides — an unread
     register never becomes a fabricated "no offers". */
  const [offers, setOffers] = useState<Offer[] | null>(null);
  const [offersTick, setOffersTick] = useState(0);
  useEffect(() => {
    if (!tenantId) return;
    let alive = true;
    fetchOffers(tenantId)
      .then((o) => {
        if (alive) setOffers(o.filter((x) => x.is_active));
      })
      .catch(() => {
        if (alive) setOffers(null);
      });
    return () => {
      alive = false;
    };
  }, [tenantId, offersTick]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailItem, setDetailItem] = useState<MenuItem | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  /* v5.272.0 — the edit room's tenant: the cart line being re-said. Set by
     the drawer's Edit verb, cleared on EVERY way out of the room (close,
     cancel) and on EVERY fresh-add path (a stale line must never pre-fill
     a room the cashier opened for a new plate — the remount law carries
     the rest via the render site's key). */
  const [editingLine, setEditingLine] = useState<CartLine | null>(null);
  useEffect(() => {
    // every drawer open re-reads: the picker is the applying surface, it
    // deserves the freshest register the cloud holds.
    if (drawerOpen) setOffersTick((t) => t + 1);
  }, [drawerOpen]);
  const [toast, setToast] = useState<{
    kind: 'added' | 'placed' | 'repeated' | 'pulled' | 'returned' | 'failed' | 'updated';
    message: string;
    orderNumber?: number;
  } | null>(null);

  /* "Their usual" landing (v5.54.0) — the guests drawer's Repeat drops the
     ticket into the live cart and walks the cashier here; the hint names
     which order arrived so the pill at the corner is never a mystery. */
  useEffect(() => {
    const hint = useUi.getState().consumeSectionHint();
    if (hint && hint.startsWith('repeat:')) {
      const n = hint.slice('repeat:'.length);
      setToast({ kind: 'repeated', message: `Order #${n} loaded into the current order` });
    }
  }, []);

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

  /* v5.119.0 — the placeholder keeps the box honest about its REACH: at
   * the categories level the search reads category names ("Search
   * categories…"); inside a category it reads that category's dish names
   * and says so ("Search Starters…"). The old static "Search the menu…"
   * promised a menu-wide sweep the filter never delivered — the same
   * promise/reach gap the honest empty states below now narrate in the
   * other direction (what was searched, what WITHIN, and the way out). */
  const searchPlaceholder = isItemsLevel
    ? `Search ${activeCategoryName ?? 'items'}…`
    : 'Search categories…';
  useEffect(() => {
    useUi.getState().setSearchMeta({ placeholder: searchPlaceholder });
    return () => useUi.getState().setSearchMeta(null);
  }, [searchPlaceholder]);

  useEffect(() => {
    setSelectedId(null);
  }, [activeCategoryName]);

  /* The shortlist matched against the LIVE menu (v5.78.0): movers whose dish
     left the menu are dropped — the rail pins only what the counter can sell. */
  const moverEntries = useMemo<MoverEntry[]>(() => {
    if (!movers || movers.length === 0) return [];
    const byId = new Map(items.map((i) => [i.id, i]));
    const out: MoverEntry[] = [];
    for (const m of movers) {
      const item = byId.get(m.menuItemId);
      if (!item) continue;
      out.push({ mover: m, item, price: item.price });
    }
    return out;
  }, [movers, items]);

  /* One tap, straight in: the dish joins the cart at its base card price —
     never a size the cashier didn't choose (the same rule that sends the
     usual's variant-bearing dish to the modal instead of guessing). A
     sold-out tap is the way back (v5.57.0 grammar): it opens the item,
     where the put-back toggle lives. */
  const tapMover = useCallback((e: MoverEntry) => {
    if (e.item.is_available === false) {
      setEditingLine(null); // a fresh room — never an edit pre-fill (5.272.0)
      setDetailItem(e.item);
      return;
    }
    useCart.getState().add(e.item, 1, [], undefined);
    setToast({ kind: 'added', message: `1× ${e.item.name} added to order` });
  }, []);

  /* Production data load — no mocks, honest errors. v5.55.0 also loads the
     option surfaces (variants + allowed add-ons) the guest menu has always
     embedded — until now the counter modal could never sell a "Large" or
     an "Extra shot" the QR menu sells every day. */
  useEffect(() => {
    if (!tenantId) return;
    let alive = true;
    setDataLoading(true);
    setDataError(null);
    Promise.all([fetchCategories(tenantId), fetchMenuItems(tenantId)])
      .then(async ([cats, its]) => {
        if (!alive) return;
        try {
          const [variantRows, addonRows, allowed] = await Promise.all([
            fetchMenuVariants(tenantId),
            fetchAddons(tenantId),
            fetchMenuItemAddonIds(its.map((i) => i.id)),
          ]);
          const variantsByItem = new Map<string, MenuItemVariant[]>();
          for (const v of variantRows) {
            const list = variantsByItem.get(v.menu_item_id) || [];
            list.push({ id: v.id, name: v.name, price_delta: Number(v.price_delta) });
            variantsByItem.set(v.menu_item_id, list);
          }
          const addonById = new Map(addonRows.map((a) => [a.id, { id: a.id, name: a.name, price: Number(a.price) }]));
          const addonsByItem = new Map<string, { id: string; name: string; price: number }[]>();
          for (const link of allowed) {
            const addon = addonById.get(link.addon_id);
            if (!addon) continue;
            const list = addonsByItem.get(link.menu_item_id) || [];
            list.push(addon);
            addonsByItem.set(link.menu_item_id, list);
          }
          if (!alive) return;
          setItems(
            its.map((i) => ({
              ...i,
              variants: variantsByItem.get(i.id) || [],
              addons: addonsByItem.get(i.id) || [],
            })),
          );
        } catch {
          /* options are an enhancement, never a gate — the menu sells bare
             if the option read fails (fail-soft, the Menu screen's rule) */
          if (!alive) return;
          setItems(its.map((i) => ({ ...i, variants: [], addons: [] })));
        }
        if (!alive) return;
        setCategories(cats);
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

  /* The shortlist's raw read (v5.78.0) — fail-soft like every option surface:
     if the read fails the rail stays home, the menu never does. Reloads with
     the same tick the menu reloads (availability flips keep it honest). */
  useEffect(() => {
    if (!tenantId) return;
    let alive = true;
    fetchPaidMoverLines(tenantId, MOVER_WINDOW_DAYS)
      .then((rows) => {
        if (alive) {
          setMovers(computeTopMovers(rows));
          /* 5.172.0 — the pace rides the same paid rows: the rail's rank and
             the shelf's days read ONE ledger, ONE definition. */
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
  }, [tenantId, reloadTick]);

  /* 5.91.0 — the shelf's read rides the same tick: recipes + stock, both
     fail-soft together (one answer needs both; a half-read is silence). */
  useEffect(() => {
    if (!tenantId) return;
    let alive = true;
    Promise.all([fetchInventory(tenantId), fetchRecipeLines(tenantId)])
      .then(([items, recipes]) => {
        if (alive) setShelf({ items, recipes });
      })
      .catch(() => {
        if (alive) setShelf(null);
      });
    return () => {
      alive = false;
    };
  }, [tenantId, reloadTick]);

  /* one coverage verdict per dish WITH a recipe — the ONE shared math
     (src/lib/shelf.ts), the same answer the shelf's board computes.
     v5.170.0 — the map reads the WHOLE menu now, not just the shortlist:
     the item detail modal speaks the same answer at the moment of
     selling, so the rail and the sheet can never disagree about a dish. */
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

  /* Toast auto-dismiss. */
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), toast.kind === 'placed' || toast.kind === 'failed' ? 6500 : 3200);
    return () => window.clearTimeout(t);
  }, [toast]);

  /* v5.57.0 — the counter pulls the dish. Optimistic flip (the grid and the
     modal react the same tick), then the same menu write the Menu screen
     makes; a failed write reverts both and says so — a sold-out state the
     cloud never confirmed would be a lie the guest menu can't see. */
  const flipBusyRef = useRef(false);
  const handleToggleAvailability = useCallback(
    async (item: MenuItem, available: boolean): Promise<boolean> => {
      if (!tenantId || flipBusyRef.current) return false; // double-dispatch guard
      flipBusyRef.current = true;
      const revert = () => {
        setItems((list) => list.map((i) => (i.id === item.id ? { ...i, is_available: !available } : i)));
        setDetailItem((d) => (d && d.id === item.id ? { ...d, is_available: !available } : d));
      };
      setItems((list) => list.map((i) => (i.id === item.id ? { ...i, is_available: available } : i)));
      setDetailItem((d) => (d && d.id === item.id ? { ...d, is_available: available } : d));
      try {
        await updateMenuItem(item.id, tenantId, { isAvailable: available });
        setToast(
          available
            ? { kind: 'returned', message: `${item.name} is back on the menu` }
            : { kind: 'pulled', message: `${item.name} marked sold out — guest menu updated` },
        );
        return true;
      } catch {
        revert();
        setToast({ kind: 'failed', message: 'Could not update the menu — check the connection and try again.' });
        return false;
      } finally {
        flipBusyRef.current = false;
      }
    },
    [tenantId],
  );

  const q = search.trim().toLowerCase();
  const visibleCategories = useMemo(
    () => (q ? categories.filter((c) => c.name.toLowerCase().includes(q)) : categories),
    [categories, q]
  );
  /* v5.122.0 — the search's pool, exposed: the count line above the grid
   * needs the number the search STARTS from (the open category, Veg
   * already applied) — otherwise "N of M" would claim the wrong whole.
   * visibleItems is this pool under the search term. */
  const itemPool = useMemo(() => {
    if (!isItemsLevel) return [];
    let inCategory = activeCategory ? items.filter((i) => i.category_id === activeCategory.id) : [];
    if (vegOnly) inCategory = inCategory.filter((i) => i.is_veg === true);
    return inCategory;
  }, [items, activeCategory, isItemsLevel, vegOnly]);
  const visibleItems = useMemo(
    () => (q ? itemPool.filter((i) => i.name.toLowerCase().includes(q)) : itemPool),
    [itemPool, q]
  );

  /* honest counts for the toggle chip — veg dishes in the OPEN category, or
     across the whole menu when no category is open (search-all level) */
  const vegCount = useMemo(() => {
    const pool = activeCategory && isItemsLevel
      ? items.filter((i) => i.category_id === activeCategory.id)
      : items;
    return pool.filter((i) => i.is_veg === true).length;
  }, [items, activeCategory, isItemsLevel]);

  const openCategory = useCallback(
    (c: Category) => {
      setBreadcrumb(['Food & Drinks', 'Categories', c.name]);
    },
    [setBreadcrumb]
  );

  /* 5.95.0 — what each category holds: total live items + how many are
     pulled. One pass feeds both the cards' captions and the switcher
     rail's badges, so every count on the surface comes from one map. */
  const countByCategory = useMemo(() => {
    const map = new Map<string, { total: number; pulled: number }>();
    for (const it of items) {
      const entry = map.get(it.category_id) || { total: 0, pulled: 0 };
      entry.total += 1;
      if (it.is_available === false) entry.pulled += 1;
      map.set(it.category_id, entry);
    }
    return map;
  }, [items]);

  const onSelectItem = useCallback(
    (item: MenuItem) => {
      if (selectedId === item.id) {
        setEditingLine(null); // a fresh room — never an edit pre-fill (5.272.0)
        setDetailItem(item);
      } else setSelectedId(item.id);
    },
    [selectedId]
  );

  const lines = useCart((s) => s.lines);
  const lineCount = useMemo(() => lines.reduce((sum, l) => sum + l.qty, 0), [lines]);
  const linesTotal = useMemo(() => cartTotal(lines), [lines]);
  /* v5.210.0 — the pill's fit whisper: the best live offer for this line
     set, computed from the screen's ONE offers register with the store's
     own offerDiscount arithmetic (the same number the drawer's discount
     line speaks when the offer is applied). v5.214.0 — the sentence
     composes from the lib's ONE voice (offerFitVoice) — the guest bar
     says the same words the pill does. */
  const appliedOfferId = useCart((s) => s.offer?.id ?? null);
  const fit = useMemo(
    () => offerFit(offers, linesTotal, appliedOfferId),
    [offers, linesTotal, appliedOfferId],
  );
  const fitVoice = fit && offerFitVoice(fit);

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
      <h1 className="sp-screen-title mb-5">
        {isItemsLevel ? activeCategoryName || 'Items' : 'Categories'}
      </h1>

      {/* 5.95.0 — the switcher rail: inside a category, every other shelf is
          one tap away — no Go-back detour mid-order. The active chip is the
          way back to Categories (the tap-is-the-way-back grammar), the
          badges say what each shelf holds. Scrolls sideways when the room
          grows; keyboard ring matches the Veg chip's. */}
      {isItemsLevel && categories.length > 0 && (
        <nav
          aria-label="Switch category"
          className="mb-4 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        >
          {categories.map((c) => {
            const active = c.name === activeCategoryName;
            const ChipIcon = categoryIcon(c.name);
            const cnt = countByCategory.get(c.id) || { total: 0, pulled: 0 };
            return (
              <button
                key={c.id}
                type="button"
                aria-current={active ? 'true' : undefined}
                onClick={() =>
                  active
                    ? setBreadcrumb(['Food & Drinks', 'Categories'])
                    : openCategory(c)
                }
                title={
                  active
                    ? `Back to all categories — ${c.name} is open`
                    : `Switch to ${c.name} — ${cnt.total} ${cnt.total === 1 ? 'item' : 'items'}${
                        cnt.pulled > 0 ? `, ${cnt.pulled} pulled` : ''
                      }`
                }
                className={`flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[12.5px] font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#967221] ${
                  active
                    ? 'border-[#0F3D3E] bg-[#0F3D3E] text-white shadow-sm'
                    : 'border-[#E3E7E0] bg-white text-[#6B6B6B] hover:border-[#967221] hover:text-[#1A1A1A]'
                }`}
              >
                <ChipIcon size={13} aria-hidden className={active ? 'text-[#D9E2DD]' : 'text-[#9AA8A0]'} />
                {c.name}
                <span
                  className={`rounded-full px-1.5 py-px text-[10.5px] font-bold ${
                    active ? 'bg-white/15 text-white' : 'bg-[#F0F2EF] text-[#5F6B63]'
                  }`}
                >
                  {cnt.total}
                </span>
              </button>
            );
          })}
        </nav>
      )}

      {/* Veg-only filter (v5.53.0) — items level only; the chip shows the
          honest veg count for the pool it filters. */}
      {isItemsLevel && (
        <div className="mb-4 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setVegOnly((v) => !v)}
            aria-pressed={vegOnly}
            title="Show vegetarian items only"
            className={`flex h-9 items-center gap-2 rounded-full border px-3.5 text-[12.5px] font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#967221] ${
              vegOnly
                ? 'border-[#2E7D32] bg-[#EAF4EB] text-[#1F5C26]'
                : 'border-[#E3E7E0] bg-white text-[#6B6B6B] hover:border-[#2E7D32]'
            }`}
          >
            <span
              aria-hidden
              className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border ${
                vegOnly ? 'border-[#2E7D32]' : 'border-[#9AA8A0]'
              }`}
            >
              <span className="h-2 w-2 rounded-full bg-[#2E7D32]" />
            </span>
            Veg only
            {vegCount > 0 && (
              <span
                className={`rounded-full px-1.5 py-px text-[10.5px] font-bold ${
                  vegOnly ? 'bg-white/80 text-[#1F5C26]' : 'bg-[#EAF4EB] text-[#1F5C26]'
                }`}
              >
                {vegCount}
              </span>
            )}
          </button>
          {vegOnly && (
            <span className="text-[11.5px] text-[#969696]">
              showing vegetarian items only
            </span>
          )}
        </div>
      )}

      {/* The counter's shortlist (v5.78.0): the week's paid movers, one tap
          each — a speed surface above the gate, gone honest when the week
          was quiet (no paid sales ⇒ no rail, never a lie). */}
      {moverEntries.length > 0 && (
        <RushRail entries={moverEntries} shelf={shelfByItem} pace={pace} onTap={tapMover} />
      )}

      {/* Counter gate (v5.3.0): fresh tickets wait HERE for an Ok — the KDS
          never sees `new`. Self-contained band; 5.241.0 — it stays to speak
          older `new` stragglers even when today's queue is empty, and only
          vanishes when nothing waits AND nothing holds. */}
      <div className="mb-5">
        <CounterInbox />
      </div>

      {/* Pre-linked table strip (v5.18.0): arrives from Floor's "Seat & start
          ticket here" tap-through. Announces the binding while it lives, and
          unassigns in one tap — a cart is never silently seated. */}
      <TablePrelinkStrip />

      {!isItemsLevel && (
        <>
          {/* v5.122.0 — the count line (Bills' house pattern, aria-live):
              while the search narrows the grid, say how much of the
              catalog the term captured — even when it captured none
              (the miss state below keeps its own say). */}
          {q && (
            <p
              aria-live="polite"
              className="mb-4 flex items-center gap-2 text-[12px] font-medium text-[#0F3D3E]"
            >
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#0F3D3E] px-1.5 text-[10.5px] font-bold tabular-nums text-white">
                {visibleCategories.length}
              </span>
              <span className="text-[#6B6B6B]">
                of {categories.length} {categories.length === 1 ? 'category' : 'categories'}{' '}
                {visibleCategories.length === 1 || categories.length === 1 ? 'matches' : 'match'} “{search.trim()}”
              </span>
            </p>
          )}
          {visibleCategories.length === 0 ? (
            q ? (
              /* v5.119.0 — a search miss is not an empty catalog: say what
               * was searched, what the search reaches at this level, and
               * hand back the way out. The old "No categories yet" here
               * was the catalog-truth empty state worn during a search. */
              <EmptyState
                icon={Search}
                title={`No category matches “${search.trim()}”`}
                body="At this level the search reads category NAMES only. Open a category to search its dishes — the catalog itself is untouched."
                action={
                  <button
                    onClick={() => setSearch('')}
                    className="rounded-lg bg-[#F3E8CF] px-3 py-1.5 text-[12px] font-semibold text-[#1A1A1A] transition hover:bg-[#E9D9AF]"
                  >
                    Clear search
                  </button>
                }
              />
            ) : (
              <EmptyState
                icon={PackageOpen}
                title="No categories yet"
                body="Categories created for this business in the cloud will show up here."
              />
            )
          ) : (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
              {visibleCategories.map((c) => (
                <CategoryCard
                  key={c.id}
                  category={c}
                  count={countByCategory.get(c.id)?.total ?? 0}
                  pulled={countByCategory.get(c.id)?.pulled ?? 0}
                  query={q}
                  onOpen={openCategory}
                />
              ))}
            </div>
          )}
        </>
      )}

      {isItemsLevel && (
        <>
          {/* v5.122.0 — the count line at the dish level: the badge counts
              what the search captured, the words name the pool it started
              from (the open category, Veg already applied) — and it speaks
              even at zero, like Bills' "0 of 55". */}
          {q && (
            <p
              aria-live="polite"
              className="mb-4 flex items-center gap-2 text-[12px] font-medium text-[#0F3D3E]"
            >
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#0F3D3E] px-1.5 text-[10.5px] font-bold tabular-nums text-white">
                {visibleItems.length}
              </span>
              <span className="text-[#6B6B6B]">
                of {itemPool.length} {itemPool.length === 1 ? 'dish' : 'dishes'}{' '}
                {visibleItems.length === 1 || itemPool.length === 1 ? 'matches' : 'match'} “{search.trim()}”
              </span>
            </p>
          )}
          {visibleItems.length === 0 ? (
            q ? (
              /* v5.119.0 — inside a category the search reaches THIS
               * category's dish names only, and the Veg chip can miss on
               * its own: when both filters are in play, the empty state
               * names both ways to miss and clears the one that came
               * through the search box. The old titles here ("No items in
               * this category" / "No vegetarian items here") claimed a
               * catalog truth a filter had no right to claim. */
              <EmptyState
                icon={Search}
                title={
                  vegOnly
                    ? `Nothing matches “${search.trim()}” among the vegetarian dishes`
                    : `No dish matches “${search.trim()}” in ${activeCategoryName}`
                }
                body={
                  vegOnly
                    ? 'The search and the Veg chip are both in play — either can miss. Clear the search, or turn Veg off to widen the pool.'
                    : `Search reads dish names in ${activeCategoryName} only — a menu-wide sweep is not its job. Clear it, or go back and search category names.`
                }
                action={
                  <button
                    onClick={() => setSearch('')}
                    className="rounded-lg bg-[#F3E8CF] px-3 py-1.5 text-[12px] font-semibold text-[#1A1A1A] transition hover:bg-[#E9D9AF]"
                  >
                    Clear search
                  </button>
                }
              />
            ) : (
              <EmptyState
                icon={PackageOpen}
                title={vegOnly ? 'No vegetarian items here' : 'No items in this category'}
                body={
                  vegOnly
                    ? 'Every item in this category is marked non-vegetarian — turn the Veg only filter off to see them.'
                    : 'Menu items added to this category will show up here.'
                }
              />
            )
          ) : (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
              {visibleItems.map((it) => (
                <ItemCard
                  key={it.id}
                  item={it}
                  selected={selectedId === it.id}
                  query={q}
                  onSelect={onSelectItem}
                  onAdd={(item) => {
                    setEditingLine(null); // a fresh room — never an edit pre-fill (5.272.0)
                    setDetailItem(item);
                  }}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Item detail modal (Frame_30) — v5.272.0: the remount law carries
          the edit register in the KEY (edit-<line key> vs add-<dish id>):
          useState initializers only run on mount, so Edit must never meet a
          room that kept someone else's half-choices — and a fresh add must
          never inherit a line's answers. */}
      {detailItem && (
        <ItemDetailModal
          key={editingLine ? `edit-${editingLine.key}` : `add-${detailItem.id}`}
          item={detailItem}
          coverage={detailItem ? (shelfByItem.get(detailItem.id) ?? null) : null}
          pace={detailItem ? (pace?.get(detailItem.id) ?? null) : null}
          onClose={() => {
            setDetailItem(null);
            setEditingLine(null);
          }}
          editing={
            editingLine
              ? {
                  key: editingLine.key,
                  qty: editingLine.qty,
                  variantName: editingLine.variantName ?? null,
                  addonNames: editingLine.addonNames,
                }
              : null
          }
          onAdded={({ name, qty }) =>
            setToast({ kind: 'added', message: `${qty}× ${name} added to order` })
          }
          onUpdated={() => setToast({ kind: 'updated', message: 'Order line updated' })}
          onToggleAvailability={(available) => handleToggleAvailability(detailItem, available)}
        />
      )}

      {/* Floating order pill (v5.210.0 — the pill hears the offers: the
          fit whisper rides the line set as it stands — "applies" is the
          money on the table (loud, the white inversion), "applied" the
          quiet confirmation, "add ₹X more" the upsell whisper; silence
          when the register is unread, empty, or nothing fits). The tap
          stays the drawer — the picker that applies the offer is one tap
          behind the whisper that named it. */}
      {lineCount > 0 && (
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label={`Review order, ${lineCount} ${lineCount === 1 ? 'item' : 'items'}, ${formatMoney(
            linesTotal
          )}${fit ? `, ${fitVoice}` : ''}`}
          className="fixed bottom-5 right-5 z-40 flex h-12 items-center gap-2 rounded-full bg-[#B88E2F] px-5 text-[13.5px] font-semibold text-white shadow-lg transition-colors hover:bg-[#967221] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#967221]"
        >
          <ShoppingBag size={16} aria-hidden />
          <span className="whitespace-nowrap">
            {lineCount} {lineCount === 1 ? 'item' : 'items'} · {formatMoney(linesTotal)} ·
            Review order
          </span>
          {fit && (
            <span
              className={`hidden whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold sm:inline-flex ${
                fit.kind === 'applies'
                  ? 'bg-white text-[#967221] shadow-sm'
                  : 'bg-white/20 text-white'
              }`}
            >
              {fitVoice}
            </span>
          )}
        </button>
      )}

      {/* Order drawer */}
      <OrderDrawer
        open={drawerOpen}
        tenantId={tenantId}
        items={items}
        offers={offers}
        onChooseItem={(item) => {
          setDrawerOpen(false);
          setSelectedId(item.id);
          setEditingLine(null); // a fresh room — never an edit pre-fill (5.272.0)
          setDetailItem(item);
        }}
        onEditLine={(line, item) => {
          /* v5.272.0 — Edit's front door (5.271's own shape, one cart later):
             close the drawer so the room is visible, open the dish's room,
             remember the line being re-said. */
          setDrawerOpen(false);
          setSelectedId(item.id);
          setEditingLine(line);
          setDetailItem(item);
        }}
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
            {toast.kind === 'placed' ? (
              <ShoppingBag size={14} />
            ) : toast.kind === 'repeated' ? (
              <Repeat size={14} />
            ) : toast.kind === 'pulled' ? (
              <CircleOff size={14} />
            ) : toast.kind === 'returned' ? (
              <RotateCcw size={14} />
            ) : toast.kind === 'failed' ? (
              <CircleAlert size={14} />
            ) : toast.kind === 'updated' ? (
              <Pencil size={14} />
            ) : (
              <Plus size={14} />
            )}
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
