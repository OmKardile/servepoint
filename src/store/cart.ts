import { create } from 'zustand';
import type { MenuItem, Offer, OrderType } from '../types';
import type { OfferVoice } from '../lib/offerLabel';

export interface CartLine {
  key: string;
  menuItemId: string;
  name: string;
  qty: number;
  unitPrice: number;
  image_url?: string | null;
  addonNames: string[];
  addonTotal: number;
  /* v5.54.0 — the leaf rides the line: the drawer shows the same FSSAI mark
     the cards show. Absent for repeat-loaded lines (order_items carry no
     veg claim) — the mark stays silent rather than inventing one. */
  isVeg?: boolean | null;
  /* v5.55.0 — the size/option the line was sold as ('Large'). Rides the key
     so Large and Regular never merge, and the drawer/receipt say what the
     guest actually chose. priceDelta is folded into unitPrice at add time. */
  variantName?: string | null;
  /* v5.56.0 — the extras the line was sold with, as a frozen snapshot. The
     modal passes the live menu's {id,name,price}; the repeat path passes
     ledger rows whose addon_id is gone (id: null). Rides to createOrder so
     the counter's extras reach order_item_addons — the same rows the guest
     door has always written — and the kitchen/receipt/track read them back. */
  addons: { id: string | null; name: string; price: number }[];
  /* v5.76.0 — the line's word to the kitchen ('less spicy', 'no onion').
     order_items.notes exists since 001 and KDS/receipts already render it —
     this is the counter finally writing the column the guest side always
     did. Empty/whitespace is normalized away at the store boundary. */
  note?: string;
}

interface CartState {
  lines: CartLine[];
  orderType: OrderType;
  /** Real dining_tables FK — null = walk-in/unassigned. Drives the 011 table-hold trigger. */
  tableId: string | null;
  tableLabel: string;
  guestCount: number;
  customerName: string;
  /** CRM key (016) — typing a phone books the guest forever. */
  customerPhone: string;
  /** Offer picked in the drawer; discount is computed at render, ledger written on place. */
  offer: Offer | null;
  /** v5.76.0 — the ticket-level note the kitchen reads on the board
      (rides input.notes → orders.notes; the counter's context joins
      'Table:' / 'Guests:' after it). */
  kitchenNote: string;
  add: (
    /* Structural minimum (v5.54.0): the modal passes the full MenuItem, the
       guests drawer's "their usual" repeat passes a synthesized snapshot —
       both only ever need these five fields to become a line. */
    item: Pick<MenuItem, 'id' | 'name' | 'price'> & {
      image_url?: string | null;
      is_veg?: boolean | null;
    },
    qty: number,
    /* v5.56.0 — id rides null for repeat-synthesized lines (the ledger read
       doesn't carry addon_id); live-menu adds pass the real FK. */
    addons: { id: string | null; name: string; price: number }[],
    /* v5.55.0 — chosen size/option. priceDelta joins the unit price here;
       the repeat path passes delta 0 because the ledger's unit_price is
       already the frozen full price. */
    variant?: { name: string; priceDelta: number } | null
  ) => void;
  increment: (key: string) => void;
  decrement: (key: string) => void;
  remove: (key: string) => void;
  setOrderType: (t: OrderType) => void;
  setTableId: (id: string | null) => void;
  setTableLabel: (t: string) => void;
  setGuestCount: (n: number) => void;
  setCustomerName: (n: string) => void;
  setCustomerPhone: (p: string) => void;
  setOffer: (o: Offer | null) => void;
  setKitchenNote: (n: string) => void;
  /** v5.76.0 — set/clear one line's kitchen word. Empty string clears. */
  setLineNote: (key: string, note: string) => void;
  clear: () => void;
}

/** v5.272.0 — exported: the edit room must know the key the new choices
 *  will land on BEFORE the old line leaves (the note-survival clause reads
 *  it to ask whether a sibling already holds that key). ONE key grammar,
 *  one speaker — computed here, read everywhere; a second builder would
 *  mean two truths about what "the same plate twice" is (the 5.269 law). */
export const lineKey = (menuItemId: string, addonNames: string[], variantName?: string | null) =>
  `${menuItemId}::${variantName || 'base'}::${[...addonNames].sort().join('|')}`;

export const useCart = create<CartState>((set, get) => ({
  lines: [],
  orderType: 'dine_in',
  tableId: null,
  tableLabel: '',
  guestCount: 2,
  customerName: '',
  customerPhone: '',
  offer: null,
  kitchenNote: '',
  add: (item, qty, addons, variant) => {
    const addonNames = addons.map((a) => a.name);
    const addonTotal = addons.reduce((s, a) => s + a.price, 0);
    const key = lineKey(item.id, addonNames, variant?.name);
    const lines = [...get().lines];
    const idx = lines.findIndex((l) => l.key === key);
    if (idx >= 0) {
      lines[idx] = { ...lines[idx], qty: lines[idx].qty + qty };
    } else {
      // note: undefined — a fresh line starts silent; the drawer's editor
      // writes it after the line exists (merges keep the earlier note).
      lines.push({
        key,
        menuItemId: item.id,
        name: item.name,
        qty,
        unitPrice: item.price + (variant?.priceDelta || 0) + addonTotal,
        image_url: item.image_url,
        addonNames,
        addonTotal,
        isVeg: item.is_veg ?? null,
        variantName: variant?.name ?? null,
        addons: addons.map((a) => ({ id: a.id || null, name: a.name, price: a.price })),
      });
    }
    set({ lines });
  },
  increment: (key) =>
    set({
      lines: get().lines.map((l) => (l.key === key ? { ...l, qty: l.qty + 1 } : l)),
    }),
  decrement: (key) =>
    set({
      lines: get()
        .lines.map((l) => (l.key === key ? { ...l, qty: l.qty - 1 } : l))
        .filter((l) => l.qty > 0),
    }),
  remove: (key) => set({ lines: get().lines.filter((l) => l.key !== key) }),
  setOrderType: (orderType) => set({ orderType }),
  setTableId: (tableId) => set({ tableId }),
  setTableLabel: (tableLabel) => set({ tableLabel }),
  setGuestCount: (guestCount) => set({ guestCount }),
  setCustomerName: (customerName) => set({ customerName }),
  setCustomerPhone: (customerPhone) => set({ customerPhone }),
  setOffer: (offer) => set({ offer }),
  setKitchenNote: (kitchenNote) => set({ kitchenNote: kitchenNote.trim() ? kitchenNote : '' }),
  setLineNote: (key, note) =>
    set({
      lines: get().lines.map((l) =>
        l.key === key ? { ...l, note: note.trim() ? note.trim() : undefined } : l,
      ),
    }),
  // a placed ticket is a finished story — the next ticket starts anonymous,
  // with no offer silently riding over from the last one. The TABLE binding
  // releases too (v5.18.0): a chained pre-link would quietly put the next
  // walk-in on a table that is already seated. "Another round" is a
  // deliberate act — Floor's drill has a button for exactly that.
  clear: () =>
    set({
      lines: [],
      offer: null,
      customerName: '',
      customerPhone: '',
      tableId: null,
      tableLabel: '',
      guestCount: 2,
      kitchenNote: '',
    }),
}));

export const cartTotal = (lines: CartLine[]): number =>
  Math.round(lines.reduce((s, l) => s + l.qty * l.unitPrice, 0) * 100) / 100;

/** Offer discount in rupees against a subtotal — percent or flat, never below zero, capped at the subtotal.
 *  v5.212.0 — the parameter speaks the voice triple, not the whole row: the
 *  guest menu's PublicOffer projection (and any future projection) can share
 *  this ONE arithmetic — Offer still satisfies it, every caller unchanged. */
export const offerDiscount = (offer: OfferVoice | null, subtotal: number): number => {
  if (!offer || subtotal <= 0) return 0;
  if (subtotal < offer.min_order_amount) return 0;
  const raw = offer.discount_type === 'percent'
    ? (subtotal * offer.discount_value) / 100
    : offer.discount_value;
  return Math.min(Math.round(raw * 100) / 100, subtotal);
};
