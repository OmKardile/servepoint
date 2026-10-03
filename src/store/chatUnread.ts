import { create } from 'zustand';
import { fetchConversationUnreadCounts, subscribeChatUnreadRealtime } from '../lib/api';

/**
 * ServePoint chat unread — the third bell's feed (v5.108.0).
 *
 * The rail's Notifications pill has spoken the shared unread feed since
 * 5.104.0; the staff line (031/033) stayed mute on the rail — you learned
 * a teammate had written only by opening Messages. The server truth for
 * "unread" already existed (fn_conversation_unread: messages newer than MY
 * watermark AND not sent by me, per room) — the rooms list rode it, the
 * chrome never did. This store carries that number to the rail.
 *
 * It is a SECOND instance of the 5.104.0 pattern, deliberately not a merge
 * into unread.ts: the notification feed counts categories the prefs mute;
 * the chat feed has no mute (the deliberate 031 decision — chat never rings
 * the bell) and counts by a different RPC with a different identity (email +
 * display name — "me" on a message is sender_name, there is no sender FK).
 * Merging two feeds with different keys, different tables and different mute
 * rules would couple them for one sum. Two feeds, same lifecycle shape.
 * (A third instance should become a factory — noted for whoever builds it.)
 *
 * Lifecycle is reference-counted exactly like unread.ts: consumers call
 * `ensure` (idempotent per tenant+identity — the identity is part of the
 * feed's key because the watermark arithmetic is per READER) and `release`
 * on unmount. A failed fetch leaves `counts` null → no badge, never a
 * broken rail. `nudge` lets the Messages screen pull the recount the moment
 * it advances a watermark (room opened → that room reads as read, the rail
 * drops live) without coupling the screen to the feed's internals.
 */

interface ChatUnreadState {
  /** Per-room unread lines (fn_conversation_unread's rows); null = feed down. */
  counts: Record<string, number> | null;
  /** Idempotent per tenant+identity: +1 consumer, start the feed if its first. */
  ensure: (tenantId: string, userEmail: string, myName: string) => void;
  /** -1 consumer; at zero the channel, poll and data are torn down. */
  release: () => void;
  /** Fire-and-forget recount (guarded: only while consumers > 0). */
  nudge: () => void;
}

/* Module-level feed state — never rendered, never serialized. */
let runningKey: string | null = null;
let runningTenant = '';
let runningEmail = '';
let runningName = '';
let consumers = 0;
let unsubscribe: (() => void) | null = null;
let pollTimer: number | null = null;

/* zustand's creator handles, passed down so the helpers stay pure module code */
interface StoreHandles {
  set: (partial: Partial<ChatUnreadState>) => void;
  get: () => ChatUnreadState;
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
  runningKey = null;
  runningTenant = '';
  runningEmail = '';
  runningName = '';
  set({ counts: null });
};

const start = ({ set }: StoreHandles, tenantId: string, userEmail: string, myName: string) => {
  const key = `${tenantId}|${userEmail}|${myName}`;
  runningKey = key;
  runningTenant = tenantId;
  runningEmail = userEmail;
  runningName = myName;
  const refresh = async () => {
    try {
      const counts = await fetchConversationUnreadCounts(tenantId, userEmail, myName);
      /* a release during the fetch must not resurrect the number */
      if (runningKey === key && consumers > 0) set({ counts });
    } catch {
      /* best-effort: a failed count just means no badge, never a broken rail */
    }
  };
  void refresh();
  unsubscribe = subscribeChatUnreadRealtime(tenantId, () => void refresh());
  pollTimer = window.setInterval(() => void refresh(), 30_000);
};

export const useChatUnread = create<ChatUnreadState>((set, get) => ({
  counts: null,
  ensure: (tenantId, userEmail, myName) => {
    consumers += 1;
    const key = `${tenantId}|${userEmail}|${myName}`;
    if (runningKey === key) return; // already feeding this identity
    teardown({ set, get });
    start({ set, get }, tenantId, userEmail, myName);
  },
  release: () => {
    consumers = Math.max(0, consumers - 1);
    if (consumers === 0) teardown({ set, get });
  },
  nudge: () => {
    /* the screen advanced a watermark — recount now, if anyone is watching */
    if (consumers === 0 || !runningKey) return;
    void fetchConversationUnreadCounts(runningTenant, runningEmail, runningName)
      .then((counts) => {
        if (runningKey && consumers > 0) set({ counts });
      })
      .catch(() => {});
  },
}));

/**
 * The rail badge's math: sum every room's unread. No mute rules here — the
 * deliberate 031 decision keeps chat off the notification bell, so this
 * badge is the line's ONLY chrome voice and it speaks the whole sum. Null
 * counts (feed down, signed out) read as null so the pill stays quiet
 * instead of claiming a zero the DB never backed.
 */
export function sumChatUnread(counts: Record<string, number> | null): number | null {
  if (counts === null) return null;
  let total = 0;
  for (const n of Object.values(counts)) total += n;
  return total;
}
