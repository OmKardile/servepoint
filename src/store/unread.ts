import { create } from 'zustand';
import { fetchUnreadCategoryCounts, subscribeNotificationsRealtime } from '../lib/api';

/**
 * ServePoint unread counts — ONE feed, many readers.
 *
 * v5.104.0 — the rail learns the bell too. Until now the unread count lived
 * entirely inside the Header: its own fetch, its own realtime channel
 * ('badge' — supabase-js dedupes channels by name, and adding postgres_changes
 * callbacks to an already-subscribed channel throws), its own 30s poll. The
 * Sidebar's `unreadCount` prop sat beside it as a DEAD prop nobody ever passed
 * — two bells in one chrome, one speaking, one pretending the room is quiet.
 *
 * Wiring the rail by cloning the header's plumbing would mean TWO channels,
 * TWO polls, TWO queries for one number — a duplication tax on every signed-in
 * minute. So the plumbing moves here: this store owns the single fetch, the
 * single realtime subscription, the single safety poll; Header and Sidebar
 * become readers that do nothing but sum the categories their prefs keep.
 *
 * Lifecycle is reference-counted: every mounted consumer calls `ensure`
 * (idempotent per tenant) and `release` on unmount — the feed lives exactly
 * as long as someone is watching it, never lingers past sign-out, and a
 * tenant switch tears the old channel down before the new one starts. A
 * failed fetch leaves `counts` null, which every reader already speaks as
 * "no badge" — a counting outage must never break the chrome.
 */

interface UnreadState {
  counts: Record<string, number> | null;
  /** Idempotent per tenant: +1 consumer, start the feed if this is its first. */
  ensure: (tenantId: string) => void;
  /** -1 consumer; at zero the channel, poll and data are torn down. */
  release: () => void;
}

/* Module-level feed state — never rendered, never serialized. */
let runningTenant: string | null = null;
let consumers = 0;
let unsubscribe: (() => void) | null = null;
let pollTimer: number | null = null;

/* zustand's creator handles, passed down so the helpers stay pure module code */
interface StoreHandles {
  set: (partial: Partial<UnreadState>) => void;
  get: () => UnreadState;
}

const teardown = ({ set }: StoreHandles) => {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
  if (pollTimer !== null) {
    window.clearInterval(pollTimer);
    pollTimer = null;
  }
  runningTenant = null;
  set({ counts: null });
};

const start = ({ set }: StoreHandles, tenantId: string) => {
  runningTenant = tenantId;
  const refresh = async () => {
    try {
      const counts = await fetchUnreadCategoryCounts(tenantId);
      /* a release during the fetch must not resurrect the number */
      if (runningTenant === tenantId && consumers > 0) set({ counts });
    } catch {
      /* best-effort: a failed count just means no badge, never a broken rail */
    }
  };
  void refresh();
  unsubscribe = subscribeNotificationsRealtime(
    tenantId,
    () => void refresh(),
    () => {}, // the feed only cares about data changes; channel chips are the screens' business
    'shared' // own channel name — the screens' 'badge'/'list' consumers keep theirs
  );
  pollTimer = window.setInterval(() => void refresh(), 30_000);
};

export const useUnread = create<UnreadState>((set, get) => ({
  counts: null,
  ensure: (tenantId) => {
    consumers += 1;
    if (runningTenant === tenantId) return; // already feeding this tenant
    teardown({ set, get });
    start({ set, get }, tenantId);
  },
  release: () => {
    consumers = Math.max(0, consumers - 1);
    if (consumers === 0) teardown({ set, get });
  },
}));

/**
 * v5.104.0 — the badge's math, written ONCE: sum the kept categories only.
 * A category the panel doesn't name yet alerts by default (`undefined` is
 * not a mute); `false` is the only mute. Null counts (feed down, signed
 * out) read as null so every reader can keep its badge quiet instead of
 * claiming a zero the DB never backed. Header and Sidebar both speak this
 * — one number, one grammar, two bells.
 */
export function sumKeptCategories(
  counts: Record<string, number> | null,
  notify: Record<string, boolean | undefined> | undefined
): number | null {
  if (counts === null) return null;
  let total = 0;
  for (const [cat, n] of Object.entries(counts)) {
    if (notify?.[cat] !== false) total += n;
  }
  return total;
}
