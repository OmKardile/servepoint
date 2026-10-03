import { create } from 'zustand';
import type { RealtimeState } from '../lib/api';

/**
 * ServePoint unread-feed factory (v5.114.0) — the lifecycle, written ONCE.
 *
 * The chrome has carried two hand-rolled instances of the same lifecycle:
 * 5.104.0's notification feed (src/store/unread.ts) and 5.108.0's chat feed
 * (src/store/chatUnread.ts) — ref-counted ensure/release, module-level feed
 * state, teardown at zero or on identity switch, a best-effort fetch whose
 * failure leaves the count null (a counting outage must never break the
 * rail), realtime + a safety poll. Their headers agree on the doctrine: a
 * third instance should become a factory. The third feed arrived (stock —
 * see src/store/stockUnread.ts), so the lifecycle is generalized HERE and
 * the new feed is its first consumer.
 *
 * The two older instances stay hand-rolled on purpose, and their headers
 * carry the reasons: the notification feed counts prefs-mutable categories
 * (a mute sum the factory's single number can't express), and the chat
 * feed's identity is (tenant, email, display name) because the watermark
 * arithmetic is per READER — this factory keys on the tenant alone, which
 * is the whole shape a SHARED feed needs. If chat ever migrates, the
 * factory grows an identity hook; today that would be ceremony without a
 * consumer.
 *
 * The contract, identical to both elders:
 *  - `ensure` is idempotent per tenant: +1 consumer, start the feed if this
 *    is its first, repoint it on a tenant switch.
 *  - `release` is -1; at zero the channel, poll and data are torn down.
 *  - `nudge` lets a screen pull an immediate recount (guarded: only while
 *    someone is watching) without coupling it to the feed's internals.
 *  - A failed fetch leaves `count` null → no badge, never a broken rail.
 *  - A fetch that resolves after a release/switch must not resurrect a
 *    dead feed's number (the running-tenant guard).
 */

export interface UnreadFeedConfig {
  /** Names the feed in comments and lets devtools tell the channels apart. */
  tag: string;
  /** The feed's server truth, one number per tenant (client-computed from a
   * small fetch is fine — the Inventory shelf does the same arithmetic). */
  fetch: (tenantId: string) => Promise<number>;
  /** Realtime subscription; the config OWNS its channel name (supabase-js
   * dedupes channels by name — a feed must never share a live channel with
   * a screen's own subscription). */
  subscribe: (
    tenantId: string,
    onPing: () => void,
    onState: (s: RealtimeState) => void
  ) => () => void;
  /** Safety poll interval; realtime carries the live moves between polls. */
  pollMs?: number;
}

export interface UnreadFeedStore {
  /** The feed's number; null = feed down or not yet loaded — no badge. */
  count: number | null;
  /** Idempotent per tenant: +1 consumer, start the feed if its first. */
  ensure: (tenantId: string) => void;
  /** -1 consumer; at zero the channel, poll and data are torn down. */
  release: () => void;
  /** Fire-and-forget recount (guarded: only while consumers > 0). */
  nudge: () => void;
}

interface StoreHandles {
  set: (partial: Partial<UnreadFeedStore>) => void;
  get: () => UnreadFeedStore;
}

export function createUnreadFeed(config: UnreadFeedConfig) {
  let runningTenant: string | null = null;
  let consumers = 0;
  let unsubscribe: (() => void) | null = null;
  let pollTimer: number | null = null;
  /* the live refresh handle — nudge reuses it; teardown clears it */
  let refresh: (() => Promise<void>) | null = null;

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
    refresh = null;
    set({ count: null });
  };

  const start = ({ set }: StoreHandles, tenantId: string) => {
    runningTenant = tenantId;
    const pull = async () => {
      try {
        const count = await config.fetch(tenantId);
        /* a release during the fetch must not resurrect the number */
        if (runningTenant === tenantId && consumers > 0) set({ count });
      } catch {
        /* best-effort: a failed count just means no badge, never a broken rail */
      }
    };
    refresh = pull;
    void pull();
    unsubscribe = config.subscribe(tenantId, () => void pull(), () => {});
    pollTimer = window.setInterval(() => void pull(), config.pollMs ?? 30_000);
  };

  const useFeed = create<UnreadFeedStore>((set, get) => ({
    count: null,
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
    nudge: () => {
      /* the screen moved the truth — recount now, if anyone is watching */
      if (consumers === 0 || !runningTenant || !refresh) return;
      void refresh();
    },
  }));

  return useFeed;
}
