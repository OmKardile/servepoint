import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Loader2,
  MessagesSquare,
  RefreshCw,
  Send,
  Users,
  Wifi,
  WifiOff,
} from 'lucide-react';
import {
  fetchConversationUnreadCounts,
  fetchConversations,
  fetchMessages,
  fetchMyWatermarks,
  markConversationRead,
  sendMessage,
  subscribeMessagesRealtime,
  type RealtimeState,
} from '../../lib/api';
import { dbErrorHint } from '../../lib/dbErrors';
import { timeAgo } from '../../lib/prefs';
import { useSession, useUi } from '../../store/session';
import { useTenant } from '../../lib/tenant';
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
 */

const AVATAR_TONES = [
  'bg-[#E8F3E9] text-[#2E7D32]', // sage
  'bg-[#FBF3E1] text-[#8A5A00]', // amber
  'bg-[#EAF0EC] text-[#0F3D3E]', // teal wash
  'bg-[#F3E8CF] text-[#967221]', // gold wash
  'bg-[#FCEBEA] text-[#B3261E]', // rose wash
];

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
const Bubble: React.FC<{ m: ChatMessage; mine: boolean }> = ({ m, mine }) => (
  <div className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
    {!mine && <span className="mb-0.5 px-1 text-[11px] font-semibold text-[#0F3D3E]/70">{m.sender_name}</span>}
    <div
      className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 sm:max-w-[70%] ${
        mine
          ? 'rounded-br-md bg-[#0F3D3E] text-[#F6F5F2]'
          : 'rounded-bl-md border border-[#E3E7E0] bg-white text-[#1A1A1A]'
      }`}
    >
      <p className="whitespace-pre-wrap break-words text-[13.5px] leading-relaxed">{m.body}</p>
      <p className={`mt-1 text-right text-[10.5px] tabular-nums ${mine ? 'text-white/60' : 'text-[#969696]'}`}>
        {clockLabel(m.created_at)}
      </p>
    </div>
  </div>
);

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
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [rt, setRt] = useState<RealtimeState>('connecting');
  const [mobileThreadOpen, setMobileThreadOpen] = useState(false);
  const [unread, setUnread] = useState<Record<string, number>>({});
  const [watermarks, setWatermarks] = useState<Record<string, string>>({});
  const [wmLoaded, setWmLoaded] = useState(false);
  const [boundary, setBoundary] = useState<{ id: string; iso: string } | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const active = useMemo(
    () => conversations.find((cv) => cv.id === activeId) || null,
    [conversations, activeId]
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

  /* realtime + poll fallback (the Task 79 pattern: silent refetches) */
  useEffect(() => {
    if (!tenant.tenantId) return;
    const unsub = subscribeMessagesRealtime(tenant.tenantId, () => {
      void loadList();
      void loadThread();
    }, setRt);
    const poll = window.setInterval(() => {
      void loadList();
      void loadThread();
    }, 30_000);
    return () => {
      unsub();
      window.clearInterval(poll);
    };
  }, [tenant.tenantId, loadList, loadThread]);

  /* keep the newest line in view */
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
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

  const onSend = async () => {
    const body = draft.trim();
    if (!tenant.tenantId || !activeId || !body || sending) return;
    setSending(true);
    setSendError(null);
    try {
      await sendMessage(activeId, tenant.tenantId, myName, body);
      setDraft('');
      await loadThread();
      void loadList();
    } catch (err) {
      setSendError((err as Error).message);
    } finally {
      setSending(false);
    }
  };

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
          <h1 className="text-[22px] font-bold text-[#1A1A1A]">Messages</h1>
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
            {listLoading ? (
              <ListSkeleton />
            ) : conversations.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center py-10 text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EAF0EC] text-[#0F3D3E]">
                  <Users size={22} aria-hidden />
                </span>
                <p className="mt-3 max-w-[200px] text-[12.5px] leading-relaxed text-[#6B6B6B]">
                  No rooms yet — the house seeds them when the workspace is provisioned.
                </p>
              </div>
            ) : (
              <ul className="min-h-0 flex-1 space-y-1.5 overflow-y-auto">
                {conversations.map((cv) => {
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
                                {cv.name}
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

                <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-4" aria-live="polite">
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
                          {g.items.map((m) => (
                            <React.Fragment key={m.id}>
                              {m.id === boundaryId && <UnreadDivider />}
                              <Bubble m={m} mine={m.sender_name === myName} />
                            </React.Fragment>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Composer */}
                <div className="border-t border-[#E3E7E0] bg-white px-4 py-3">
                  {sendError && (
                    <p className="mb-2 break-words rounded-xl border border-[#F5C6C0] bg-[#FEF2F2] px-3 py-2 text-[12px] text-[#B42318]" role="alert">
                      Couldn't send: {sendError}
                    </p>
                  )}
                  <div className="flex items-end gap-2">
                    <textarea
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
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
