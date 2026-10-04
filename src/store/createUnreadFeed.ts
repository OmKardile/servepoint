import { create } from 'zustand';
import type { RealtimeState } from '../lib/api';

/**
 * ServePoint unread-feed factory (v5.114.0, generalized v5.135.0) — the
 * lifecycle, written ONCE.
 *
 * The chrome carried three hand-rolled instances of the same lifecycle:
 * 5.104.0's notification feed (src/store/unread.ts), 5.108.0's chat feed
 * (src/store/chatUnread.ts) and — the reason this factory exists — the
 * 5.114.0 stock feed. Ref-counted ensure/release, module-level feed state,
 * teardown at zero or on scope switch, a best-effort fetch whose failure
 * leaves the value null (a counting outage must never break the rail),
 * realtime + a safety poll. The two elders stayed hand-rolled on purpose
 * at birth: the notification feed counts prefs-mutable categories (a mute
 * sum the factory's single number can't express), and the chat feed's
 * identity is (tenant, email, display name) because the watermark
 * arithmetic is per READER — the factory keyed on the tenant alone.
 *
 * v5.135.0 — the factory grew the identity hook its own header promised,
 * and chat migrated (the "ceremony without a consumer" excuse expired the
 * moment the consumer arrived). The factory is now generic over SCOPE (the
 * tuple a caller passes to ensure — a tenant feed passes [tenantId], the
 * chat feed passes [tenantId, email, displayName]) and over VALUE (a number
 * for stock, a per-room record for chat). unread.ts stays hand-rolled by
 * its documented reason — its value is a prefs-shaped categories record
 * with a mute-aware sum, not a feed the rail can wear as one number, and
 * its header says so.
 *
 * The contract, identical to all three feeds:
 *  - `ensure(...scope)` is idempotent per derived key: +1 consumer, start
 *    the feed if this is its first, repoint it on a scope switch.
 *  - `release` is -1; at zero the channel, poll and data are torn down.
 *  - `nudge` lets a screen pull an immediate recount (guarded: only while
 *    someone is watching) without coupling it to the feed's internals.
 *  - A failed fetch leaves `value` null → no badge, never a broken rail.
 *  - A fetch that resolves after a release/switch must not resurrect a
 *    dead feed's number (the running-key guard).
 */

export interface UnreadFeedConfig<Scope extends readonly string[], Value> {
  /** Names the feed in comments and lets devtools tell the channels apart. */
  tag: string;
  /** The feed's server truth for a scope (a client-composed number or
   * record is fine — the shelf does the same arithmetic). */
  fetch: (scope: Scope) => Promise<Value>;
  /** Realtime subscription; the config OWNS its channel name (supabase-js
   * dedupes channels by name — a feed must never share a live channel with
   * a screen's own subscription). */
  subscribe: (
    scope: Scope,
    onPing: () => void,
    onState: (s: RealtimeState) => void
  ) => () => void;
  /** Safety poll interval; realtime carries the live moves between polls. */
  pollMs?: number;
}

export interface UnreadFeedStore<Scope extends readonly string[], Value> {
  /** The feed's value; null = feed down or not yet loaded — no badge. */
  value: Value | null;
  /** Idempotent per derived key: +1 consumer, start the feed if its first. */
  ensure: (...scope: Scope) => void;
  /** -1 consumer; at zero the channel, poll and data are torn down. */
  release: () => void;
  /** Fire-and-forget recount (guarded: only while consumers > 0). */
  nudge: () => void;
}

/** Scope tuples join with the ASCII unit separator — a delimiter that can't
 * appear in an email, a display name or a UUID, so the derived key can't
 * collide across distinct scopes the way a naive '|' join could. */
const UNIT_SEP = String.fromCharCode(31); // ASCII  — invisible, collision-proof
const keyOf = (scope: readonly string[]): string => scope.join(UNIT_SEP);

export function createUnreadFeed<Scope extends readonly string[], Value>(
  config: UnreadFeedConfig<Scope, Value>
) {
  type Store = UnreadFeedStore<Scope, Value>;
  let runningKey: string | null = null;
  let consumers = 0;
  let unsubscribe: (() => void) | null = null;
  let pollTimer: number | null = null;
  /* the live refresh handle — nudge reuses it; teardown clears it */
  let refresh: (() => Promise<void>) | null = null;

  const teardown = ({ set }: { set: (partial: Partial<Store>) => void }) => {
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
    if (pollTimer !== null) {
      window.clearInterval(pollTimer);
      pollTimer = null;
    }
    runningKey = null;
    refresh = null;
    set({ value: null });
  };

  const start = ({ set }: { set: (partial: Partial<Store>) => void }, scope: Scope) => {
    const key = keyOf(scope);
    runningKey = key;
    const pull = async () => {
      try {
        const value = await config.fetch(scope);
        /* a release during the fetch must not resurrect the number */
        if (runningKey === key && consumers > 0) set({ value });
      } catch {
        /* best-effort: a failed count just means no badge, never a broken rail */
      }
    };
    refresh = pull;
    void pull();
    unsubscribe = config.subscribe(scope, () => void pull(), () => {});
    pollTimer = window.setInterval(() => void pull(), config.pollMs ?? 30_000);
  };

  const useFeed = create<Store>((set) => ({
    value: null,
    ensure: (...scope: Scope) => {
      consumers += 1;
      const key = keyOf(scope);
      if (runningKey === key) return; // already feeding this scope
      teardown({ set });
      start({ set }, scope);
    },
    release: () => {
      consumers = Math.max(0, consumers - 1);
      if (consumers === 0) teardown({ set });
    },
    nudge: () => {
      /* the screen moved the truth — recount now, if anyone is watching */
      if (consumers === 0 || !runningKey || !refresh) return;
      void refresh();
    },
  }));

  return useFeed;
}
