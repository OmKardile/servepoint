import { createUnreadFeed } from './createUnreadFeed';
import { fetchConversationUnreadCounts, subscribeChatUnreadRealtime } from '../lib/api';

/**
 * ServePoint chat unread — the third bell's feed (v5.108.0), the factory's
 * second consumer (v5.135.0).
 *
 * The rail's Notifications pill has spoken the shared unread feed since
 * 5.104.0; the staff line (031/033) stayed mute on the rail — you learned
 * a teammate had written only by opening Messages. The server truth for
 * "unread" already existed (fn_conversation_unread: messages newer than MY
 * watermark AND not sent by me, per room) — the rooms list rode it, the
 * chrome never did. This feed carries that number to the rail.
 *
 * Born hand-rolled on purpose: the notification feed counts prefs-mutable
 * categories; this feed counts by a different RPC with a different identity
 * (email + display name — "me" on a message is sender_name, there is no
 * sender FK), so its SCOPE is the triple, not the tenant alone. When the
 * factory arrived (5.114.0) the header said migration would be ceremony
 * without a consumer — v5.135.0 grew the factory the identity hook
 * (generic scope tuple) and this feed became its second consumer: the
 * lifecycle (ensure/release, teardown at zero or on identity switch,
 * null-on-failure, realtime + 30s poll, resurrection guard, nudge) is
 * written once, in src/store/createUnreadFeed.ts.
 *
 * The identity stays part of the feed's key because the watermark
 * arithmetic is per READER; a session that loads late repoints the feed
 * once, on arrival. `nudge` lets the Messages screen pull the recount the
 * moment it advances a watermark (room opened → that room reads as read,
 * the rail drops live) without coupling the screen to the feed's internals.
 */

/** The rail badge's math: sum every room's unread. No mute rules here — the
 * deliberate 031 decision keeps chat off the notification bell, so this
 * badge is the line's ONLY chrome voice and it speaks the whole sum. Null
 * counts (feed down, signed out) read as null so the pill stays quiet
 * instead of claiming a zero the DB never backed. */
export function sumChatUnread(counts: Record<string, number> | null): number | null {
  if (counts === null) return null;
  let total = 0;
  for (const n of Object.values(counts)) total += n;
  return total;
}

export const useChatUnread = createUnreadFeed<[string, string, string], Record<string, number>>({
  tag: 'chat-unread',
  fetch: ([tenantId, userEmail, myName]) => fetchConversationUnreadCounts(tenantId, userEmail, myName),
  /* own channel tag — the rooms list keeps its own subscriptions; a shared
   * name would let the feed steal the room and crash the screen on its
   * next postgres_changes add (the unread.ts 'badge' lesson). */
  subscribe: ([tenantId], onPing) => subscribeChatUnreadRealtime(tenantId, onPing),
  pollMs: 30_000,
});
