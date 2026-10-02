import { create } from 'zustand';
import type { MenuItem, Offer, OrderType } from '../types';

export interface CartLine {
  key: string;
  menuItemId: string;
  name: string;
  qty: number;
  unitPrice: number;
  image_url?: string | null;
  addonNames: string[];
  addonTotal: number;
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
  add: (
    item: MenuItem,
    qty: number,
    addons: { id: string; name: string; price: number }[]
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
  clear: () => void;
}

const lineKey = (menuItemId: string, addonNames: string[]) =>
  `${menuItemId}::${[...addonNames].sort().join('|')}`;

export const useCart = create<CartState>((set, get) => ({
  lines: [],
  orderType: 'dine_in',
  tableId: null,
  tableLabel: '',
  guestCount: 2,
  customerName: '',
  customerPhone: '',
  offer: null,
  add: (item, qty, addons) => {
    const addonNames = addons.map((a) => a.name);
    const addonTotal = addons.reduce((s, a) => s + a.price, 0);
    const key = lineKey(item.id, addonNames);
    const lines = [...get().lines];
    const idx = lines.findIndex((l) => l.key === key);
    if (idx >= 0) {
      lines[idx] = { ...lines[idx], qty: lines[idx].qty + qty };
    } else {
      lines.push({
        key,
        menuItemId: item.id,
        name: item.name,
        qty,
        unitPrice: item.price + addonTotal,
        image_url: item.image_url,
        addonNames,
        addonTotal,
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
    }),
}));

export const cartTotal = (lines: CartLine[]): number =>
  Math.round(lines.reduce((s, l) => s + l.qty * l.unitPrice, 0) * 100) / 100;

/** Offer discount in rupees against a subtotal — percent or flat, never below zero, capped at the subtotal. */
export const offerDiscount = (offer: Offer | null, subtotal: number): number => {
  if (!offer || subtotal <= 0) return 0;
  if (subtotal < offer.min_order_amount) return 0;
  const raw = offer.discount_type === 'percent'
    ? (subtotal * offer.discount_value) / 100
    : offer.discount_value;
  return Math.min(Math.round(raw * 100) / 100, subtotal);
};
