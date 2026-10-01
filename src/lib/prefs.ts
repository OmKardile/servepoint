import { useSession } from '../store/session';

/**
 * Production preferences (v5.0.0) — real, persisted UI settings that other
 * screens consume (currency symbol, payment methods, notification toggles,
 * compact mode, region). ServePoint-only; no theme system.
 */

export interface SpPrefs {
  currency: string; // currency symbol, e.g. '₹'
  locale: string;
  timezone: string;
  compact: boolean;
  paymentMethods: { card: boolean; cash: boolean; upi: boolean };
  savePaymentHistory: boolean;
  notify: { messages: boolean; orders: boolean; promotions: boolean };
}

const KEY = 'servepoint_prefs';

const DEFAULTS: SpPrefs = {
  currency: '₹',
  locale: 'en-IN',
  timezone: 'Asia/Kolkata',
  compact: false,
  paymentMethods: { card: true, cash: true, upi: true },
  savePaymentHistory: true,
  notify: { messages: true, orders: true, promotions: false },
};

export function getPrefs(): SpPrefs {
  if (typeof window === 'undefined') return DEFAULTS;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return DEFAULTS;
  }
}

export function setPrefs(patch: Partial<SpPrefs>): SpPrefs {
  const next = { ...getPrefs(), ...patch };
  localStorage.setItem(KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent('sp-prefs-changed'));
  return next;
}

export function subscribePrefs(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener('sp-prefs-changed', cb);
  return () => window.removeEventListener('sp-prefs-changed', cb);
}

export function formatMoney(amount: number, currency?: string): string {
  const sym = currency || getPrefs().currency;
  return `${sym}${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Relative "x minutes ago" label used by Notifications/Messages (Figma). */
export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m} minute${m === 1 ? '' : 's'} ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? '' : 's'} ago`;
  const d = Math.floor(h / 24);
  return `${d} day${d === 1 ? '' : 's'} ago`;
}

export function useSessionUser() {
  return useSession((s) => s.session);
}
