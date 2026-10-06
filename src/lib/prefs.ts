import { useSession } from '../store/session';
import { moneyNum } from './money';

/**
 * Production preferences (v5.0.0) — real, persisted UI settings that other
 * screens consume (currency symbol, payment methods, notification toggles,
 * the quiet-hours schedule, region). ServePoint-only; no theme system.
 */

export interface SpPrefs {
  currency: string; // currency symbol, e.g. '₹'
  locale: string;
  timezone: string;
  paymentMethods: { card: boolean; cash: boolean; upi: boolean };
  savePaymentHistory: boolean;
  /** 5.103.0 — the notify toggles finally speak the bell's own language:
   * one row per REAL notification category (the words the stream itself
   * uses), each gating its category out of the bell list and the header
   * badge. The old `messages/orders/promotions` trio named no category
   * that existed and gated nothing — a word nobody kept. */
  notify: {
    message: boolean;
    system: boolean;
    reminder: boolean;
    promotion: boolean;
    feedback: boolean;
  };
  /** 5.101.0 — the owner's schedule for the room's sounds. Gates the KDS
   * chime and the counter doorbell ONLY — boards, badges and screens keep
   * counting. Overnight windows (from > to) span midnight; equal bounds
   * mean an empty window (never quiet). */
  quiet: { enabled: boolean; from: string; to: string };
  /** v5.160.0 — the floor's pace, in the house's own words. `turnAfterMin`
   * is the house turn line: a seat past this many minutes is called camping
   * on the tile pill, the table drill and the header chip (FloorScreen's
   * camping clock reads it live — a Settings save re-voices the floor
   * without a remount). `showLongestSeatChip` gates the header's
   * “· longest seat” chip for houses that already breathe at their pace.
   * Validation lives in clampTurnAfterMin — a corrupt blob falls back to
   * the doctrine default, never to a nonsense line. */
  floor: { turnAfterMin: number; showLongestSeatChip: boolean };
}

/** v5.160.0 — the doctrine default: 90 minutes, the turn line 5.158.0 drew.
 * Lives here (not in FloorScreen) so the lib can validate without reaching
 * into a component; the floor re-exports it as CAMPING_AFTER_MIN. */
export const DEFAULT_TURN_AFTER_MIN = 90;

/** Pure validator for the saved turn line: finite numbers round and clamp
 * into a sane band (30–240 — an hour is the fastest real turn, four hours
 * the slowest line worth naming); anything unreadable returns the doctrine
 * default. Silence over invention, at the prefs layer. */
export function clampTurnAfterMin(v: unknown): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return DEFAULT_TURN_AFTER_MIN;
  return Math.min(240, Math.max(30, Math.round(v)));
}

const KEY = 'servepoint_prefs';

const DEFAULTS: SpPrefs = {
  currency: '₹',
  locale: 'en-IN',
  timezone: 'Asia/Kolkata',
  paymentMethods: { card: true, cash: true, upi: true },
  savePaymentHistory: true,
  notify: { message: true, system: true, reminder: true, feedback: true, promotion: false },
  quiet: { enabled: false, from: '22:00', to: '08:00' },
  floor: { turnAfterMin: DEFAULT_TURN_AFTER_MIN, showLongestSeatChip: true },
};

/** 5.103.0 — legacy shim: saved prefs from the old vocabulary map onto the
 * bell's real categories (`messages`→`message`, `promotions`→`promotion`);
 * `orders` named a category the stream never had, so it is dropped. A stale
 * shape must never resurrect dead toggles. */
function migrateNotify(raw: Record<string, unknown> | undefined): Partial<SpPrefs['notify']> {
  if (!raw || typeof raw !== 'object') return {};
  const out: Record<string, boolean> = {};
  for (const k of ['message', 'system', 'reminder', 'promotion', 'feedback'] as const) {
    if (typeof raw[k] === 'boolean') out[k] = raw[k];
  }
  if (typeof raw.messages === 'boolean' && typeof raw.message !== 'boolean') {
    out.message = raw.messages;
  }
  if (typeof raw.promotions === 'boolean' && typeof raw.promotion !== 'boolean') {
    out.promotion = raw.promotions;
  }
  return out;
}

export function getPrefs(): SpPrefs {
  if (typeof window === 'undefined') return DEFAULTS;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<SpPrefs>;
    /* v5.137.0 — an allowlist rebuild, not a blind spread: only the keys the
     * interface declares survive a load. The spread used to carry ANY junk a
     * saved blob held forever — `compact` (a v5.0.0 toggle no code ever read;
     * the Settings round removed it) would have ridden the blob until the end
     * of time, and so would every future dead key. A stale shape must never
     * resurrect a dead toggle — the 5.103.0 doctrine, now structural. */
    return {
      currency: typeof parsed.currency === 'string' ? parsed.currency : DEFAULTS.currency,
      locale: typeof parsed.locale === 'string' ? parsed.locale : DEFAULTS.locale,
      timezone: typeof parsed.timezone === 'string' ? parsed.timezone : DEFAULTS.timezone,
      // nested objects must merge, not replace — a saved `{ enabled: true }`
      // without bounds must never lose the default window
      paymentMethods: { ...DEFAULTS.paymentMethods, ...(parsed.paymentMethods || {}) },
      notify: { ...DEFAULTS.notify, ...migrateNotify(parsed.notify) },
      quiet: { ...DEFAULTS.quiet, ...(parsed.quiet || {}) },
      floor: {
        turnAfterMin: clampTurnAfterMin(parsed.floor?.turnAfterMin),
        showLongestSeatChip:
          typeof parsed.floor?.showLongestSeatChip === 'boolean'
            ? parsed.floor.showLongestSeatChip
            : DEFAULTS.floor.showLongestSeatChip,
      },
      savePaymentHistory:
        typeof parsed.savePaymentHistory === 'boolean'
          ? parsed.savePaymentHistory
          : DEFAULTS.savePaymentHistory,
    };
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

/* ── Quiet hours (5.101.0) ───────────────────────────────────────────── */

/** Pure window check at a minute-of-day. Invalid bounds are never quiet —
 * a broken schedule must not silence the room by accident. */
export function inQuietWindowAt(nowMinutes: number, quiet: SpPrefs['quiet']): boolean {
  if (!quiet?.enabled) return false;
  const parse = (s: string): number | null => {
    const m = /^(\d{1,2}):(\d{2})$/.exec(s || '');
    if (!m) return null;
    const h = Number(m[1]);
    const min = Number(m[2]);
    if (h > 23 || min > 59) return null;
    return h * 60 + min;
  };
  const fromMin = parse(quiet.from);
  const toMin = parse(quiet.to);
  if (fromMin == null || toMin == null || fromMin === toMin) return false;
  return fromMin < toMin
    ? nowMinutes >= fromMin && nowMinutes < toMin
    : nowMinutes >= fromMin || nowMinutes < toMin;
}

/** Is the room silent right now? Reads the DEVICE clock on purpose: a chime
 * is the cashier's room, and the device day is the cashier's wall clock —
 * the seam 5.97.0 drew. Evaluated at sound-time by the consumers, so a
 * Settings save silences the room without a remount. */
export function isQuietNow(prefs?: SpPrefs): boolean {
  const p = prefs || getPrefs();
  const now = new Date();
  return inQuietWindowAt(now.getHours() * 60 + now.getMinutes(), p.quiet);
}

export function formatMoney(amount: number, currency?: string): string {
  /* v5.278.0 — the digits ride the money lib's ONE shape (the census byte
   * lives in lib/money.ts and nowhere else); this door keeps only the
   * staff's configured symbol, which the guest-safe ₹-pinned word cannot
   * know. */
  const sym = currency || getPrefs().currency;
  return `${sym}${moneyNum(amount)}`;
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
