import { create } from 'zustand';
import type { MenuItem, OrderType } from '../types';

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
  clear: () => set({ lines: [] }),
}));

export const cartTotal = (lines: CartLine[]): number =>
  Math.round(lines.reduce((s, l) => s + l.qty * l.unitPrice, 0) * 100) / 100;
