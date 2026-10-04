import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  Loader2,
  MessagesSquare,
  RefreshCw,
  Search,
  Send,
  Users,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import {
  fetchConversationUnreadCounts,
  fetchConversations,
  fetchMessages,
  fetchMyWatermarks,
  fetchPresence,
  fetchTeam,
  fetchTypingNames,
  markConversationRead,
  sendMessage,
  setTyping,
  clearTyping,
  subscribeMessagesRealtime,
  type PresenceRow,
  type RealtimeState,
  type TeamMemberRow,
} from '../../lib/api';
import { dbErrorHint } from '../../lib/dbErrors';
import { timeAgo } from '../../lib/prefs';
import { useSession, useUi } from '../../store/session';
import { useChatUnread } from '../../store/chatUnread';
import { useTenant } from '../../lib/tenant';
import { MarkHit } from '../shell/MarkHit';
import { EmptyState } from '../shell/EmptyState';
import type { ChatMessage, Conversation } from '../../types';

/**
 * Messages (v5.41.0 — the staff line; migration 004's other half, finally
 * built). 004 shipped conversations + conversation_messages with RLS and
 * seeded per-tenant rooms ("Front of House", "Kitchen"); the API layer grew
 * fetch/send; migration 031 put both tables on the realtime publication and
 * gave the conversation row a server-truth preview stamp. This screen is the
 * visible half: a two-pane chat — rooms on the left, the line on the right —
 * that moves live on every signed-in terminal.
 *
 * Honesty rules the small things: a room with no lines says "No messages
 * yet", and the sender's name rides every bubble because 004 is name-based
 * by design.
 *
 * v5.43.0 — the unread line (migration 033): 004 shipped no per-user read
 * state, so "unread" was unknowable and every room read as caught-up
 * forever. 033 adds conversation_reads — one watermark row per reader per
 * room — and a SECURITY INVOKER RPC that counts messages newer than MY
 * watermark AND not mine. The rooms list wears gold badge pills on fresh
 * rooms (name + preview bolden), the room you open upserts its watermark on
 * every refresh while it stays open (the room you are looking at is, by
 * definition, read), and the thread renders the round's namesake: a gold
 * "Unread messages" rule at the boundary captured when the room opened —
 * where caught-up ended and the fresh chatter began.
 *
 * v5.112.0 — the line stays where you left it: autoscroll only when the
 * reader already sits at the bottom (the 30s poll used to yank readers
 * down even with nothing new); drafts are PER ROOM (one shared draft
 * survived switches and could post to the wrong room — caught live); a
 * gold jump pill counts the lines that arrived while you read history and
 * walks you down on click (RM-respecting); the composer grows to 112px;
 * same-sender runs within three minutes cluster tight with the repeated
 * name dropped; every bubble's clock wears a full "day at time" tooltip.
 *
 * v5.115.0 — the rooms learn a ledger line: a filter box for the rooms list
 * (substring against the room's name AND its last-line preview, case-
 * insensitive) plus an "unread only" chip for the busy-hour sweep. Client-
 * side by construction — the list is already in memory; full-history search
 * would be a different, heavier promise and is NOT claimed here (the empty
 * state says so). "/" focuses the filter from anywhere on the screen that
 * isn't already a field; Esc clears; matches paint gold in the name. A
 * room filtered out of the list does NOT change what you are reading — the
 * thread pane keeps its room.
 */

const AVATAR_TONES = [
  'bg-[#E8F3E9] text-[#2E7D32]', // sage
  'bg-[#FBF3E1] text-[#8A5A00]', // amber
  'bg-[#EAF0EC] text-[#0F3D3E]', // teal wash
  'bg-[#F3E8CF] text-[#967221]', // gold wash
  'bg-[#FCEBEA] text-[#B3261E]', // rose wash
];

/* v5.115.0 — the rooms list's gold glint (Mark). v5.120.0 — the component
 * moved to src/components/shell/MarkHit.tsx (one truth for every search
 * surface); this file imports it as MarkHit. */

const avatarTone = (name: string): string => {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_TONES[h % AVATAR_TONES.length];
};

const dayLabel = (iso: string): string => {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (same(d, today)) return 'Today';
  if (same(d, yesterday)) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

const clockLabel = (iso: string): string =>
  new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });

/* v5.112.0 — the full stamp for the bubble tooltip: the clock alone can't
 * say which day a line landed on; a hover that says "Today at 4:47 pm"
 * answers it without reading the dividers. */
const fullStamp = (iso: string): string => {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const day =
    d.toDateString() === today.toDateString()
      ? 'Today'
      : d.toDateString() === yesterday.toDateString()
        ? 'Yesterday'
        : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  return `${day} at ${clockLabel(iso)}`;
};

/* v5.112.0 — the cluster rule: consecutive lines from the same sender within
 * three minutes read as ONE utterance, so they render tight (4px) and the
 * repeated name drops after the first. A gap of three minutes or a sender
 * change breaks the run — chat-shaped honesty, not a wall of floats. */
const CLUSTER_MS = 3 * 60_000;

/* ── Skeletons ───────────────────────────────────────────────────────── */

const ListSkeleton: React.FC = () => (
  <div className="space-y-2" aria-hidden>
    {[0, 1, 2].map((i) => (
      <div key={i} className="sp-skeleton h-[64px] rounded-2xl" />
    ))}
  </div>
);

const ThreadSkeleton: React.FC = () => (
  <div className="flex flex-1 flex-col gap-3 p-5" aria-hidden>
    {[0, 1, 2].map((i) => (
      <div key={i} className={`sp-skeleton h-12 max-w-[70%] rounded-2xl ${i % 2 ? 'self-end' : ''}`} />
    ))}
  </div>
);

/* ── Honest error card ───────────────────────────────────────────────── */

const ErrorCard: React.FC<{ message: string; onRetry: () => void }> = ({ message, onRetry }) => (
  <div className="sp-card p-6 text-center" role="alert">
    <div className="flex flex-col items-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#D9E2DD] text-[#0F3D3E]">
        <MessagesSquare size={22} aria-hidden />
      </span>
      <h2 className="mt-4 text-[15px] font-semibold text-[#1A1A1A]">Couldn't load messages</h2>
      <p className="mt-2 break-words text-[13px] text-[#6B6B6B]">{message}</p>
      <p className="mt-2 break-words text-[12px] text-[#969696]">{dbErrorHint(message)}</p>
      <button onClick={onRetry} className="sp-cta mt-5 flex h-11 items-center gap-2 px-6 text-[13.5px]">
        <RefreshCw size={15} aria-hidden />
        Retry
      </button>
    </div>
  </div>
);

/* ── Unread divider (v5.43.0) ────────────────────────────────────────── */

/* The round's namesake: a gold rule that marks where "caught up" ended
 * and the fresh chatter began when this room was opened. Sits above the
 * first not-from-me line newer than the boundary. */
const UnreadDivider: React.FC = () => (
  <div className="flex items-center gap-3" role="separator" aria-label="Unread messages">
    <span className="h-px flex-1 bg-[#B88E2F]/40" aria-hidden />
    <span className="rounded-full bg-[#F3E8CF] px-2.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-[#8A5A00]">
      Unread messages
    </span>
    <span className="h-px flex-1 bg-[#B88E2F]/40" aria-hidden />
  </div>
);

/* ── Message bubble ──────────────────────────────────────────────────── */
/* v5.112.0 — `tight` clusters same-sender runs (negative margin eats the
 * row gap down to ~4px); `showSender` drops the repeated name inside a
 * run. The first line of a run renders exactly as before. */
const Bubble: React.FC<{ m: ChatMessage; mine: boolean; tight?: boolean; showSender?: boolean }> = ({
  m,
  mine,
  tight = false,
  showSender = true,
}) => (
  <div
    className={`flex flex-col ${mine ? 'items-end' : 'items-start'} ${tight ? '-mt-2' : ''}`}
  >
    {!mine && showSender && (
      <span className="mb-0.5 px-1 text-[11px] font-semibold text-[#0F3D3E]/70">{m.sender_name}</span>
    )}
    <div
      className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 sm:max-w-[70%] ${
        mine
          ? 'rounded-br-md bg-[#0F3D3E] text-[#F6F5F2]'
          : 'rounded-bl-md border border-[#E3E7E0] bg-white text-[#1A1A1A]'
      }`}
    >
      <p className="whitespace-pre-wrap break-words text-[13.5px] leading-relaxed">{m.body}</p>
      <p
        title={fullStamp(m.created_at)}
        className={`mt-1 text-right text-[10.5px] tabular-nums ${mine ? 'text-white/60' : 'text-[#969696]'}`}
      >
        {clockLabel(m.created_at)}
      </p>
    </div>
  </div>
);

/* ── Typing line (v5.45.0) ───────────────────────────────────────────── */

/* The round's namesake: three bouncing dots and a name — the room
 * answering back before the answer exists. Sits above the composer in a
 * fixed-height slot so its arrival never shifts the input. */
const TypingRow: React.FC<{ names: string[] }> = ({ names }) => {
  const label =
    names.length === 1
      ? `${names[0]} is typing…`
      : names.length === 2
        ? `${names[0]} and ${names[1]} are typing…`
        : `${names.length} teammates are typing…`;
  return (
    <div
      className="flex h-6 items-center gap-2 px-1 text-[12px] italic text-[#6B6B6B]"
      aria-live="polite"
      aria-label={label}
    >
      <span className="flex items-center gap-0.5" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-1 w-1 animate-bounce rounded-full bg-[#0F3D3E]/50"
            style={{ animationDelay: `${i * 150}ms` }}
          />
        ))}
      </span>
      <span className="truncate">{label}</span>
    </div>
  );
};

/* ── The line's people (v5.46.0) ─────────────────────────────────────── */

/* The round's namesake: the roster strip above the rooms — who is even AT
 * the app right now. Freshness is derived client-side from the 120s
 * window (migration 035's truth model — the display IS the truth): a
 * fresh row breathes green, a stale row tells you honestly when it was
 * last seen, and a member who never opened the app since 035 has no row
 * at all — "not seen yet", never fabricated. */
const ONLINE_WINDOW_MS = 120_000;

const ROLE_LABEL: Record<string, string> = {
  owner: 'Owner',
  staff: 'Staff',
  superadmin: 'Platform',
};

const LineStrip: React.FC<{
  team: TeamMemberRow[];
  presence: Record<string, PresenceRow>;
  myEmail: string;
  myName: string;
}> = ({ team, presence, myEmail, myName }) => {
  const entries = team
    .filter((m) => m.is_active !== false)
    .map((m) => {
      const p = presence[m.email];
      const fresh = !!p && Date.now() - new Date(p.last_seen_at).getTime() < ONLINE_WINDOW_MS;
      const label = p?.sender_name || (m.email === myEmail ? myName : m.email.split('@')[0]);
      return { email: m.email, role: m.role, label, seen: p?.last_seen_at ?? null, fresh };
    });
  const online = entries.filter((e) => e.fresh).length;
  return (
    <div className="mb-3 border-b border-[#E3E7E0] pb-3">
      <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-[#969696]">
        {online} of {entries.length} on the line now
      </p>
      <ul className="flex flex-wrap gap-x-1 gap-y-2" aria-label="Who is on the line">
        {entries.map((e) => {
          const detail = e.fresh
            ? 'online now'
            : e.seen
              ? `last seen ${timeAgo(e.seen)}`
              : 'not seen yet';
          return (
            <li
              key={e.email}
              className="flex w-14 flex-col items-center gap-1"
              aria-label={`${e.label} (${ROLE_LABEL[e.role] || e.role}), ${detail}`}
            >
              <span className="relative">
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-full text-[13px] font-bold ${avatarTone(e.label)}`}
                  aria-hidden
                >
                  {e.label.charAt(0).toUpperCase()}
                </span>
                <span
                  aria-hidden
                  className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white ${
                    e.fresh ? 'animate-pulse bg-[#2E7D32]' : 'bg-[#969696]'
                  }`}
                />
              </span>
              <span className="max-w-full truncate text-[10.5px] font-medium leading-none text-[#6B6B6B]">
                {e.label}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

/* ── Screen content (tenant-scoped) ──────────────────────────────────── */

const MessagesContent: React.FC<{ onTenantRetry: () => void }> = ({ onTenantRetry }) => {
  const tenant = useTenant();
  const session = useSession((s) => s.session);
  const myName = session?.name || 'Staff';
  const myEmail = session?.email || '';

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [thread, setThread] = useState<ChatMessage[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [threadLoading, setThreadLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /* v5.112.0 — drafts are PER ROOM: a half-typed line belongs to the room it
   * was typed for. One shared draft state survived room switches, so "table 4
   * needs water" begun in Front of House could land in Kitchen on the next
   * Enter (verified live before the fix — the leak was real). Switching back
   * to a room restores its draft; sending clears only that room's. */
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [rt, setRt] = useState<RealtimeState>('connecting');
  const [mobileThreadOpen, setMobileThreadOpen] = useState(false);
  const [unread, setUnread] = useState<Record<string, number>>({});
  const [watermarks, setWatermarks] = useState<Record<string, string>>({});
  const [wmLoaded, setWmLoaded] = useState(false);
  const [boundary, setBoundary] = useState<{ id: string; iso: string } | null>(null);
  /* v5.115.0 — the rooms filter: a ledger line for busy hours. Purely
   * client-side (the list is already in memory); filters names and last-
   * line previews, optionally unread-only. Never touches activeId — what
   * you are reading is not changed by what the list hides.
   *
   * v5.118.0 — the filter stops being a private box: it now reads and
   * writes the same useUi.search the header box speaks (two doors, one
   * state — typing in either moves both live), and the screen registers
   * its vocabulary with the shell so the header box exists here too.
   * The local " / " handler retires with the move: the verb moved to the
   * shell (Header), which owns it once for every screen. */
  const roomQuery = useUi((s) => s.search);
  const setRoomQuery = useUi((s) => s.setSearch);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const roomFilterRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    useUi.getState().setSearchMeta({ placeholder: 'Filter rooms…' });
    return () => useUi.getState().setSearchMeta(null);
  }, []);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  /* v5.112.0 — stick-to-bottom honesty: the old effect pinned scrollTop to
   * scrollHeight on EVERY thread refetch, so the 30s poll yanked a reader
   * back to the bottom even with nothing new on the wire. Autoscroll now
   * happens only when the reader already sits at the bottom (±80px); else
   * the miss is counted and the gold jump pill offers the way down. */
  const stickRef = useRef(true);
  const lastLenRef = useRef(0);
  const [newBelow, setNewBelow] = useState(0);
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  /* v5.45.0 — the typing line: who is answering RIGHT NOW (6s display
   * window, never me). The heartbeat ref throttles my own announces to
   * one upsert per 2.5s of continuous typing; a stale row simply falls
   * out of the window — no cron, the display IS the truth. */
  const [typingNames, setTypingNames] = useState<string[]>([]);
  const lastPingRef = useRef<number>(0);
  /* v5.46.0 — the line's people: the roster (tenant_users) + the presence
   * ledger (035), re-derived on every realtime ping and a 30s tick so a dot
   * decays to gray within a window's width of the truth. Fail-soft: a
   * failed read hides the strip, never the rooms list. */
  const [team, setTeam] = useState<TeamMemberRow[] | null>(null);
  const [presence, setPresence] = useState<Record<string, PresenceRow> | null>(null);

  const active = useMemo(
    () => conversations.find((cv) => cv.id === activeId) || null,
    [conversations, activeId]
  );

  /* v5.115.0 — the visible slice of the rooms list, under the filter. */
  const q = roomQuery.trim().toLowerCase();
  const visibleRooms = useMemo(() => {
    if (!q && !unreadOnly) return conversations;
    return conversations.filter((cv) => {
      if (unreadOnly && !(unread[cv.id] > 0)) return false;
      if (!q) return true;
      return (
        cv.name.toLowerCase().includes(q) ||
        (cv.last_message ?? '').toLowerCase().includes(q)
      );
    });
  }, [conversations, q, unreadOnly, unread]);
  const unreadRoomCount = useMemo(
    () => conversations.reduce((n, cv) => n + (unread[cv.id] > 0 ? 1 : 0), 0),
    [conversations, unread]
  );

  /* v5.115.0 — "/" walked focus to the rooms filter from anywhere on the
   * screen that wasn't already a field. v5.118.0 — the handler retires:
   * the verb moved to the shell (Header), which focuses the header box —
   * now the SAME state through the other door — once for every screen
   * that claims it. Two handlers on one key would race; one owner is
   * the honest shape. */

  /* v5.112.0 — the per-room draft: this room's half-typed line, or empty. */
  const draft = activeId ? (drafts[activeId] ?? '') : '';
  const setDraft = useCallback(
    (v: string) => {
      if (!activeId) return;
      setDrafts((d) => ({ ...d, [activeId]: v }));
    },
    [activeId]
  );

  /* v5.43.0 — the unread counts ride every rooms refresh (realtime ping,
   * poll, tenant retry): one SECURITY INVOKER RPC — server truth. The same
   * refresh carries MY watermarks, which the divider boundary snapshots at
   * room-open. Best-effort by design: a failed count shows no badge, never
   * a broken list; the next ping/poll retells it. */
  const loadUnreads = useCallback(async () => {
    if (!tenant.tenantId || !myEmail) return;
    try {
      const [counts, mine] = await Promise.all([
        fetchConversationUnreadCounts(tenant.tenantId, myEmail, myName),
        fetchMyWatermarks(tenant.tenantId, myEmail),
      ]);
      setUnread(counts);
      setWatermarks(mine);
      setWmLoaded(true);
    } catch {
      /* badge is a courtesy — silence here is the honest best-effort */
    }
  }, [tenant.tenantId, myEmail, myName]);

  const loadPeople = useCallback(async () => {
    if (!tenant.tenantId) return;
    try {
      const [roster, rows] = await Promise.all([
        fetchTeam(tenant.tenantId),
        fetchPresence(tenant.tenantId),
      ]);
      const map: Record<string, PresenceRow> = {};
      for (const r of rows) map[r.user_email] = r;
      setTeam(roster);
      setPresence(map);
    } catch {
      /* the strip is a courtesy — hide it, never break the list */
    }
  }, [tenant.tenantId]);

  useEffect(() => {
    void loadPeople();
  }, [loadPeople]);

  /* rooms — silent refetch on ring, skeleton only on first mount */
  const loadList = useCallback(async () => {
    if (!tenant.tenantId) return;
    setError(null);
    try {
      const rows = await fetchConversations(tenant.tenantId);
      setConversations(rows);
      setActiveId((cur) => (cur && rows.some((r) => r.id === cur) ? cur : rows[0]?.id ?? null));
      void loadUnreads();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setListLoading(false);
    }
  }, [tenant.tenantId, loadUnreads]);

  /* the open thread — silent refetch, never a skeleton flash over live lines.
   * v5.43.0: a successful load upserts MY watermark — the room you are
   * looking at is, by definition, read — and the badge recount rides along. */
  const loadThread = useCallback(async () => {
    if (!activeId) return;
    setThreadLoading(true);
    try {
      const rows = await fetchMessages(activeId);
      setThread(rows);
      if (myEmail && tenant.tenantId) {
        try {
          await markConversationRead(activeId, tenant.tenantId, myEmail);
          /* v5.108.0 — the watermark just moved: the rail's Messages badge
           * recounts NOW instead of waiting for its poll/realtime cycle. */
          useChatUnread.getState().nudge();
        } catch {
          /* watermark is a courtesy — the next refresh retells it */
        }
        void loadUnreads();
      }
    } catch (err) {
      setSendError((err as Error).message);
    } finally {
      setThreadLoading(false);
    }
  }, [activeId, myEmail, tenant.tenantId, loadUnreads]);

  useEffect(() => {
    setListLoading(true);
    void loadList();
  }, [loadList]);

  useEffect(() => {
    void loadThread();
  }, [loadThread]);

  /* realtime + poll fallback (the Task 79 pattern: silent refetches).
   * v5.46.0 — the presence strip rides the same ping (035 published
   * staff_presence: a teammate's first open or heartbeat flips their dot
   * live) plus the 30s poll tick, which is also what decays a stopped
   * heartbeat to honest gray without any socket at all. */
  useEffect(() => {
    if (!tenant.tenantId) return;
    const unsub = subscribeMessagesRealtime(tenant.tenantId, () => {
      void loadList();
      void loadThread();
      void loadPeople();
    }, setRt);
    const poll = window.setInterval(() => {
      void loadList();
      void loadThread();
      void loadPeople();
    }, 30_000);
    return () => {
      unsub();
      window.clearInterval(poll);
    };
  }, [tenant.tenantId, loadList, loadThread, loadPeople]);

  /* room switch (v5.112.0): the new room lands at its bottom, pill-free —
   * never inherit the previous room's scroll stance or unread count. */
  useEffect(() => {
    stickRef.current = true;
    lastLenRef.current = 0;
    setNewBelow(0);
  }, [activeId]);

  /* v5.112.0 — the honest autoscroll: bottom only when already there; a
   * refetch with identical content scrolls NOTHING (the old code yanked on
   * every poll). New lines while reading history feed the jump pill. */
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const added = Math.max(0, thread.length - lastLenRef.current);
    lastLenRef.current = thread.length;
    if (stickRef.current) {
      el.scrollTop = el.scrollHeight;
    } else if (added > 0) {
      setNewBelow((n) => n + added);
    }
  }, [thread]);

  /* v5.43.0 — the unread line's boundary: MY WATERMARK AS IT STOOD when the
   * room opened (never read → epoch, so the whole backlog reads as the
   * fresh side). The divider marks the backlog you are about to catch up
   * on — not lines that arrive while you watch. Captured once per open;
   * watermark refreshes never move it; switching rooms recaptures. */
  useEffect(() => {
    if (!activeId) {
      setBoundary(null);
      return;
    }
    if (!wmLoaded) return;
    setBoundary((cur) => {
      if (cur?.id === activeId) return cur;
      return { id: activeId, iso: watermarks[activeId] || new Date(0).toISOString() };
    });
  }, [activeId, wmLoaded, watermarks]);

  const boundaryId = useMemo(() => {
    if (!boundary || boundary.id !== activeId) return null;
    return thread.find((m) => m.sender_name !== myName && m.created_at > boundary.iso)?.id ?? null;
  }, [boundary, activeId, thread, myName]);

  /* v5.45.0 — refetch who-is-typing for the open room. Rides the same
   * realtime ping as everything else (034 published the table), plus a
   * 5s interval as the poll-mode fallback — a window this short needs a
   * heartbeat-shaped refresh, not the 30s list poll. */
  const loadTyping = useCallback(async () => {
    if (!activeId || !myEmail) return;
    try {
      setTypingNames(await fetchTypingNames(activeId, myEmail));
    } catch {
      /* a failed glance shows nobody typing — the next ping retells it */
    }
  }, [activeId, myEmail]);

  useEffect(() => {
    setTypingNames([]);
    if (!activeId) return;
    void loadTyping();
    const t = window.setInterval(() => void loadTyping(), 5_000);
    return () => window.clearInterval(t);
  }, [activeId, loadTyping]);

  /* announce/heartbeat: first keypress pings at once, then at most one
   * upsert per 2.5s; clearing the draft retracts the row ("typing" is no
   * longer true). Best-effort throughout. */
  const pingTyping = () => {
    if (!activeId || !tenant.tenantId || !myEmail) return;
    const now = Date.now();
    if (now - lastPingRef.current < 2_500) return;
    lastPingRef.current = now;
    void setTyping(activeId, tenant.tenantId, myEmail, myName).catch(() => {});
  };
  const retractTyping = () => {
    lastPingRef.current = 0;
    if (!activeId || !myEmail) return;
    void clearTyping(activeId, myEmail).catch(() => {});
  };

  /* leaving the room (or the screen) retracts the announce — an echo of
   * "typing" with nobody at the keyboard is a lie the next occupant pays
   * for. The stale-6s window already bounds the damage; this closes it. */
  useEffect(() => {
    return () => {
      if (activeId && myEmail) void clearTyping(activeId, myEmail).catch(() => {});
    };
  }, [activeId, myEmail]);

  const onSend = async () => {
    const body = draft.trim();
    if (!tenant.tenantId || !activeId || !body || sending) return;
    setSending(true);
    setSendError(null);
    try {
      await sendMessage(activeId, tenant.tenantId, myName, body);
      setDrafts((d) => {
        const next = { ...d };
        delete next[activeId];
        return next;
      });
      retractTyping();
      await loadThread();
      void loadList();
    } catch (err) {
      setSendError((err as Error).message);
    } finally {
      setSending(false);
    }
  };

  /* v5.112.0 — the scroll ledger: near-bottom (±80px) = sticking; leaving
   * the bottom arms the pill, returning to it disarms. */
  const onThreadScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    stickRef.current = near;
    if (near && newBelow) setNewBelow(0);
  };

  /* the pill's click: down to the freshest line. Smooth, unless the OS
   * prefers reduced motion — then instant (functional movement, but the
   * traveler asked for stillness). */
  const jumpToLatest = () => {
    const el = scrollRef.current;
    if (!el) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollTo({ top: el.scrollHeight, behavior: reduced ? 'auto' : 'smooth' });
    stickRef.current = true;
    setNewBelow(0);
  };

  /* v5.112.0 — the composer grows with its line (capped at max-h-28's
   * 112px); the effect also re-fits on room switch when a restored draft
   * is taller than the resting input. */
  const growComposer = useCallback(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 112)}px`;
  }, []);

  useEffect(() => {
    growComposer();
  }, [draft, growComposer]);

  if (tenant.loading) {
    return (
      <div className="flex h-full gap-4 p-4 lg:p-5">
        <div className="w-full max-w-xs shrink-0 space-y-2">
          <div className="sp-skeleton h-7 w-36" />
          <ListSkeleton />
        </div>
        <div className="hidden flex-1 md:block">
          <div className="sp-skeleton h-full rounded-2xl" />
        </div>
      </div>
    );
  }

  if (tenant.error || !tenant.tenantId) {
    return (
      <div className="mx-auto w-full max-w-3xl p-4 lg:p-5">
        <ErrorCard
          message={tenant.error || 'No workspace is linked to this account.'}
          onRetry={onTenantRetry}
        />
      </div>
    );
  }

  /* group bubbles under day dividers */
  const grouped: { label: string; items: ChatMessage[] }[] = [];
  for (const m of thread) {
    const label = dayLabel(m.created_at);
    const last = grouped[grouped.length - 1];
    if (last && last.label === label) last.items.push(m);
    else grouped.push({ label, items: [m] });
  }

  return (
    <div className="mx-auto flex h-full w-full max-w-5xl flex-col p-4 lg:p-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4">
        <div className="flex items-center gap-3">
          <h1 className="sp-screen-title">Messages</h1>
          <span
            title={rt === 'live' ? 'Realtime connected' : 'Polling every 30s'}
            aria-label={rt === 'live' ? 'Realtime connected' : 'Polling every 30 seconds'}
            className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
              rt === 'live' ? 'bg-[#E8F3E9] text-[#2E7D32]' : 'bg-[#F6F5F2] text-[#6B6B6B]'
            }`}
          >
            {rt === 'live' ? <Wifi size={12} aria-hidden /> : <WifiOff size={12} aria-hidden />}
            {rt === 'live' ? 'Live' : 'Poll'}
          </span>
        </div>
        <p className="text-[12px] text-[#969696]">
          The team's own line — front of house and kitchen, on the record.
        </p>
      </div>

      {error && !listLoading && conversations.length === 0 ? (
        <ErrorCard message={error} onRetry={() => void loadList()} />
      ) : (
        <div className="grid min-h-0 flex-1 gap-4 md:grid-cols-3">
          {/* Rooms — always visible on md+; swaps with the thread on phones.
              (md:block + an inner flex column — md:flex is unreliable in the
              current Tailwind build, every layout utility here is verified
              generated.) */}
          <aside
            aria-label="Conversations"
            className={`${mobileThreadOpen ? 'hidden' : 'block'} min-h-0 md:block`}
          >
            <div className="flex h-full min-h-0 flex-col rounded-2xl border border-[#E3E7E0] bg-white p-3">
            {team && presence && (
              <LineStrip team={team} presence={presence} myEmail={myEmail} myName={myName} />
            )}
            {/* v5.115.0 — the rooms filter: a ledger line for busy hours.
                Rendered only once rooms exist; the empty-list state below
                keeps its own voice. */}
            {!listLoading && conversations.length > 0 && (
              <div className="mt-2.5 flex items-center gap-1.5">
                <div className="relative min-w-0 flex-1">
                  <Search
                    size={14}
                    aria-hidden
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#969696]"
                  />
                  <input
                    ref={roomFilterRef}
                    type="search"
                    value={roomQuery}
                    onChange={(e) => setRoomQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        setRoomQuery('');
                        e.currentTarget.blur();
                      }
                    }}
                    placeholder="Filter rooms…"
                    aria-label="Filter rooms"
                    title="Filter by room name or last line — the header box shares this filter; Esc clears"
                    className="h-9 w-full rounded-xl border border-[#E3E7E0] bg-[#F6F5F2] pl-9 pr-8 text-[12.5px] text-[#1A1A1A] outline-none transition placeholder:text-[#969696] focus:border-[#B88E2F] focus:bg-white focus:ring-2 focus:ring-[#B88E2F]/25 [&::-webkit-search-cancel-button]:hidden"
                  />
                  {roomQuery && (
                    <button
                      onClick={() => {
                        setRoomQuery('');
                        roomFilterRef.current?.focus();
                      }}
                      aria-label="Clear room filter"
                      title="Clear"
                      className="absolute right-1.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-lg text-[#6B6B6B] transition hover:bg-[#E3E7E0]"
                    >
                      <X size={13} aria-hidden />
                    </button>
                  )}
                </div>
                <button
                  onClick={() => setUnreadOnly((v) => !v)}
                  aria-pressed={unreadOnly}
                  title="Show only rooms with unread lines"
                  className={`flex h-9 shrink-0 items-center gap-1 rounded-xl border px-2.5 text-[11.5px] font-semibold transition ${
                    unreadOnly
                      ? 'border-[#B88E2F] bg-[#FBF7EE] text-[#8A5A00]'
                      : 'border-[#E3E7E0] bg-white text-[#6B6B6B] hover:border-[#D8DCD4] hover:text-[#1A1A1A]'
                  }`}
                >
                  Unread
                  <span
                    aria-hidden
                    className={`flex h-4.5 min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold tabular-nums ${
                      unreadRoomCount > 0
                        ? 'bg-[#B88E2F] text-white'
                        : 'bg-[#F6F5F2] text-[#969696]'
                    }`}
                  >
                    {unreadRoomCount}
                  </span>
                </button>
              </div>
            )}
            {(q || unreadOnly) && conversations.length > 0 && (
              <p aria-live="polite" className="sr-only">
                {visibleRooms.length} of {conversations.length} rooms shown
              </p>
            )}
            {listLoading ? (
              <ListSkeleton />
            ) : conversations.length === 0 ? (
              /* 5.129.0 — the no-rooms truth moves onto the shared EmptyState
               * (compact register): same words, the house's miss shape. */
              <EmptyState
                compact
                icon={Users}
                title="No rooms yet"
                body="The house seeds them when the workspace is provisioned."
              />
            ) : visibleRooms.length === 0 ? (
              /* v5.115.0 — the filter came up empty; distinguish it from the
                  no-rooms-yet voice and own what the filter does NOT do
                  (full-history search). 5.129.0 — the shape is the shared
                  EmptyState's compact register; the words stay this room's
                  own, and the Unread toggle owns its side of either-can-miss. */
              <EmptyState
                compact
                icon={Search}
                title={
                  unreadOnly && !q
                    ? 'No unread lines'
                    : `No room matches “${roomQuery.trim()}”`
                }
                body={
                  unreadOnly && !q
                    ? 'The house is quiet — every line has been read.'
                    : (
                      <>
                        Filters names and last lines, not the whole history.
                        {unreadOnly && <> The Unread toggle is also in play.</>}
                      </>
                    )
                }
                action={
                  <button
                    onClick={() => {
                      setRoomQuery('');
                      setUnreadOnly(false);
                      roomFilterRef.current?.focus();
                    }}
                    className="rounded-lg bg-[#F3E8CF] px-3 py-1.5 text-[12px] font-semibold text-[#1A1A1A] transition hover:bg-[#E9D9AF]"
                  >
                    Clear filter
                  </button>
                }
              />
            ) : (
              <ul className="min-h-0 flex-1 space-y-1.5 overflow-y-auto">
                {visibleRooms.map((cv) => {
                  const isActive = cv.id === activeId;
                  const nUnread = unread[cv.id] || 0;
                  return (
                    <li key={cv.id}>
                      <button
                        onClick={() => {
                          setActiveId(cv.id);
                          setMobileThreadOpen(true);
                        }}
                        aria-current={isActive ? 'true' : undefined}
                        aria-label={`${cv.name}${nUnread ? `, ${nUnread} unread` : ''}`}
                        className={`w-full rounded-xl border p-3 text-left transition ${
                          isActive
                            ? 'border-[#B88E2F] bg-[#FBF7EE]'
                            : 'border-transparent hover:border-[#E3E7E0] hover:bg-[#F6F5F2]'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="relative shrink-0">
                            <span
                              className={`flex h-9 w-9 items-center justify-center rounded-xl text-[14px] font-bold ${avatarTone(cv.name)}`}
                              aria-hidden
                            >
                              {cv.name.charAt(0).toUpperCase()}
                            </span>
                            {nUnread > 0 && (
                              <span
                                className="absolute -right-1.5 -top-1.5 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full border-2 border-white bg-[#B88E2F] px-1 text-[10.5px] font-bold tabular-nums text-white"
                                aria-hidden
                              >
                                {nUnread > 99 ? '99+' : nUnread}
                              </span>
                            )}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-baseline justify-between gap-2">
                              <span className={`truncate text-[13.5px] text-[#1A1A1A] ${nUnread ? 'font-bold' : 'font-semibold'}`}>
                                <MarkHit text={cv.name} query={q} />
                              </span>
                              {cv.last_message_at && (
                                <span className="shrink-0 text-[10.5px] tabular-nums text-[#969696]">
                                  {timeAgo(cv.last_message_at)}
                                </span>
                              )}
                            </span>
                            <span
                              className={`mt-0.5 block truncate text-[12px] ${
                                nUnread ? 'font-medium text-[#1A1A1A]' : 'text-[#6B6B6B]'
                              }`}
                            >
                              {cv.last_message ? cv.last_message : 'No messages yet'}
                            </span>
                          </span>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            </div>
          </aside>

          {/* Thread */}
          <section
            aria-label={active ? `Chat: ${active.name}` : 'Chat'}
            className={`${mobileThreadOpen ? 'block' : 'hidden'} h-full min-h-0 md:col-span-2 md:block`}
          >
            <div className="flex h-full min-h-0 flex-col rounded-2xl border border-[#E3E7E0] bg-[#F6F5F2]">
            {!active ? (
              <div className="flex flex-1 flex-col items-center justify-center text-center">
                <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#EAF0EC] text-[#0F3D3E]">
                  <MessagesSquare size={26} aria-hidden />
                </span>
                <p className="mt-3 text-[13px] text-[#6B6B6B]">Pick a room on the left to read the line.</p>
              </div>
            ) : (
              <>
                <header className="flex items-center gap-3 border-b border-[#E3E7E0] bg-white px-4 py-3">
                  <button
                    onClick={() => setMobileThreadOpen(false)}
                    aria-label="Back to rooms"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#F3E8CF] text-[#1A1A1A] hover:bg-[#E9D9AF] md:hidden"
                  >
                    <ArrowLeft size={15} aria-hidden />
                  </button>
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[14px] font-bold ${avatarTone(active.name)}`}
                    aria-hidden
                  >
                    {active.name.charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <h2 className="truncate text-[14px] font-bold text-[#1A1A1A]">{active.name}</h2>
                    <p className="truncate text-[11.5px] text-[#969696]">
                      {active.member_names?.length ? active.member_names.join(' · ') : 'Team room'}
                    </p>
                  </div>
                </header>

                <div
                  ref={scrollRef}
                  onScroll={onThreadScroll}
                  className="min-h-0 flex-1 overflow-y-auto px-4 py-4"
                  aria-live="polite"
                >
                  {threadLoading && thread.length === 0 ? (
                    <ThreadSkeleton />
                  ) : thread.length === 0 ? (
                    <div className="flex h-full flex-col items-center justify-center text-center">
                      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#EAF0EC] text-[#0F3D3E]">
                        <MessagesSquare size={22} aria-hidden />
                      </span>
                      <p className="mt-3 text-[13px] font-semibold text-[#1A1A1A]">No messages yet</p>
                      <p className="mt-1 max-w-[240px] text-[12px] leading-relaxed text-[#6B6B6B]">
                        The first line lands here for the whole room — say hello.
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {grouped.map((g) => (
                        <div key={g.label} className="flex flex-col gap-3">
                          <div className="flex items-center gap-3" role="separator" aria-label={g.label}>
                            <span className="h-px flex-1 bg-[#E3E7E0]" aria-hidden />
                            <span className="text-[11px] font-semibold text-[#969696]">{g.label}</span>
                            <span className="h-px flex-1 bg-[#E3E7E0]" aria-hidden />
                          </div>
                          {g.items.map((m, i) => {
                            const mine = m.sender_name === myName;
                            const prev = i > 0 ? g.items[i - 1] : null;
                            /* a run never crosses the unread divider — the
                             * boundary line always renders full-height with
                             * its name, however close the timestamps sit */
                            const tight =
                              !!prev &&
                              !mine &&
                              prev.sender_name === m.sender_name &&
                              new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() <
                                CLUSTER_MS &&
                              m.id !== boundaryId;
                            return (
                              <React.Fragment key={m.id}>
                                {m.id === boundaryId && <UnreadDivider />}
                                <Bubble m={m} mine={mine} tight={tight} showSender={!tight} />
                              </React.Fragment>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Composer — with the typing slot above the input (fixed
                    h-6: the announce never shifts the input under you). */}
                <div className="relative border-t border-[#E3E7E0] bg-white px-4 py-3">
                  {sendError && (
                    <p className="mb-2 break-words rounded-xl border border-[#F5C6C0] bg-[#FEF2F2] px-3 py-2 text-[12px] text-[#B42318]" role="alert">
                      Couldn't send: {sendError}
                    </p>
                  )}
                  {/* v5.112.0 — the jump pill: N fresh lines arrived while you
                      were reading history; gold, counting, one click from
                      the bottom. Disarms itself the moment you're back. */}
                  {newBelow > 0 && (
                    <button
                      onClick={jumpToLatest}
                      aria-label={`Jump to ${newBelow} new ${newBelow === 1 ? 'message' : 'messages'}`}
                      className="absolute -top-9 right-4 z-10 flex h-8 items-center gap-1.5 rounded-full bg-[#B88E2F] px-3.5 text-[12px] font-bold text-white shadow-[0_8px_20px_rgba(15,61,62,0.25)] transition-colors hover:bg-[#A07D28]"
                    >
                      {newBelow} new {newBelow === 1 ? 'line' : 'lines'}
                      <ArrowDown size={13} aria-hidden />
                    </button>
                  )}
                  <div className="min-h-[24px]">
                    {typingNames.length > 0 && <TypingRow names={typingNames} />}
                  </div>
                  <div className="flex items-end gap-2">
                    <textarea
                      ref={taRef}
                      value={draft}
                      onChange={(e) => {
                        setDraft(e.target.value);
                        if (e.target.value.trim()) pingTyping();
                      }}
                      onBlur={() => {
                        if (!draft.trim()) retractTyping();
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          void onSend();
                        }
                      }}
                      rows={1}
                      aria-label={`Message ${active.name}`}
                      placeholder={`Message ${active.name}…`}
                      className="sp-input max-h-28 min-h-[42px] flex-1 resize-none rounded-xl py-2.5 text-[13.5px]"
                    />
                    <button
                      onClick={() => void onSend()}
                      disabled={!draft.trim() || sending}
                      aria-label={`Send to ${active.name}`}
                      className="sp-cta flex h-[42px] w-[46px] items-center justify-center rounded-xl px-0 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {sending ? (
                        <Loader2 size={16} className="animate-spin" aria-hidden />
                      ) : (
                        <Send size={16} aria-hidden />
                      )}
                    </button>
                  </div>
                </div>
              </>
            )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
};

/* ── Exported screen ─────────────────────────────────────────────────── */

export const MessagesScreen: React.FC = () => {
  const setBreadcrumb = useUi((s) => s.setBreadcrumb);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    setBreadcrumb(['Messages']);
  }, [setBreadcrumb]);

  return <MessagesContent key={reloadKey} onTenantRetry={() => setReloadKey((k) => k + 1)} />;
};
