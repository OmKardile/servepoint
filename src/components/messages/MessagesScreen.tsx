import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  MessageSquare,
  Mic,
  MoreHorizontal,
  Paperclip,
  Phone,
  RefreshCw,
  Search,
  Send,
  Video,
  X,
} from 'lucide-react';
import {
  fetchConversations,
  fetchMessages,
  sendMessage,
} from '../../lib/api';
import { timeAgo } from '../../lib/prefs';
import { useTenant } from '../../lib/tenant';
import { useSession, useUi } from '../../store/session';
import type { ChatMessage, Conversation } from '../../types';

/**
 * Messages (v5.0.0, ADR-0014) — Figma Messages_219-29372.
 * Left: Teams / Personal conversation list (sage cards, avatar clusters, unread badges).
 * Right: chat thread (sage incoming / white outgoing bubbles) + gold send composer.
 * Production data only (conversations / conversation_messages — migration 004).
 */

const MIGRATION_004_NOTE =
  'If this says the table does not exist, migration 004 (notifications & messages) has not been applied to Supabase yet.';

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return ((parts[0][0] || '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

function clockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/* ── Avatars ─────────────────────────────────────────────────────────── */

const AvatarCircle: React.FC<{ name: string; url?: string | null; first?: boolean }> = ({
  name,
  url,
  first,
}) => (
  <span
    className={`flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#D9E2DD] text-[11px] font-semibold text-[#0F3D3E] ring-2 ring-[#EAF0EC] ${
      first ? '' : '-ml-2.5'
    }`}
  >
    {url ? (
      <img src={url} alt="" className="h-full w-full object-cover" />
    ) : (
      initialsOf(name)
    )}
  </span>
);

const ConversationAvatar: React.FC<{ conv: Conversation }> = ({ conv }) => {
  const members = (conv.member_names && conv.member_names.length > 0
    ? conv.member_names
    : [conv.name]
  ).slice(0, 3);
  return (
    <span className="flex shrink-0 items-center" aria-hidden>
      {members.map((m, i) => (
        <AvatarCircle key={`${m}-${i}`} name={m} url={i === 0 ? conv.avatar_url : null} first={i === 0} />
      ))}
    </span>
  );
};

const ThreadAvatar: React.FC<{ conv: Conversation | null }> = ({ conv }) => {
  const label = conv?.name || '?';
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#D9E2DD] text-[13px] font-semibold text-[#0F3D3E]">
      {conv?.avatar_url ? (
        <img src={conv.avatar_url} alt="" className="h-full w-full object-cover" />
      ) : (
        initialsOf(label)
      )}
    </span>
  );
};

/* ── Honest error card ───────────────────────────────────────────────── */

const ErrorCard: React.FC<{ message: string; onRetry: () => void }> = ({ message, onRetry }) => (
  <div className="sp-card mx-auto w-full max-w-xl self-center p-6" role="alert">
    <div className="flex flex-col items-center text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#D9E2DD] text-[#0F3D3E]">
        <AlertTriangle size={22} aria-hidden />
      </span>
      <h2 className="mt-4 text-[15px] font-semibold text-[#1A1A1A]">Couldn't load messages</h2>
      <p className="mt-2 break-words text-[13px] text-[#6B6B6B]">{message}</p>
      <p className="mt-2 text-[12px] text-[#969696]">{MIGRATION_004_NOTE}</p>
      <button onClick={onRetry} className="sp-cta mt-5 flex h-11 items-center gap-2 px-6 text-[13.5px]">
        <RefreshCw size={15} aria-hidden />
        Retry
      </button>
    </div>
  </div>
);

/* ── Conversation card ───────────────────────────────────────────────── */

const ConversationCard: React.FC<{
  conv: Conversation;
  active: boolean;
  onSelect: () => void;
}> = ({ conv, active, onSelect }) => (
  <button
    onClick={onSelect}
    aria-current={active ? 'true' : undefined}
    aria-label={`Open conversation ${conv.name}${conv.unread_count ? `, ${conv.unread_count} unread` : ''}`}
    className={`w-full rounded-[14px] p-3 text-left transition-colors ${
      active
        ? 'bg-[#D9E2DD] ring-1 ring-[#C7D2CB]'
        : 'bg-[#EAF0EC] hover:bg-[#DFE8E1]'
    }`}
  >
    <div className="flex items-center gap-3">
      <ConversationAvatar conv={conv} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span className="truncate text-[13px] font-bold text-[#1A1A1A]">{conv.name}</span>
          {conv.last_message_at && (
            <span className="shrink-0 text-[11px] text-[#6B6B6B]">{timeAgo(conv.last_message_at)}</span>
          )}
        </span>
        <span className="mt-0.5 flex items-center justify-between gap-2">
          <span className="truncate text-[12px] text-[#6B6B6B]">
            {conv.last_message || 'No messages yet'}
          </span>
          {(conv.unread_count || 0) > 0 && (
            <span className="flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-full bg-[#B42318] px-1.5 text-[11px] font-semibold text-white">
              {conv.unread_count}
            </span>
          )}
        </span>
      </span>
    </div>
  </button>
);

/* ── Chat pane ───────────────────────────────────────────────────────── */

const ChatPane: React.FC<{
  conv: Conversation | null;
  tenantId: string | null;
  onBack: () => void;
  onSent: () => void;
}> = ({ conv, tenantId, onBack, onSent }) => {
  const session = useSession((s) => s.session);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    if (!conv) return;
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchMessages(conv.id);
      setMessages(rows);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [conv]);

  useEffect(() => {
    setMessages([]);
    setDraft('');
    setSendError(null);
    void load();
  }, [load]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, loading]);

  const myName = session?.name || '';
  const onSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = draft.trim();
    if (!body || !conv || sending || !tenantId) return;
    setSending(true);
    setSendError(null);
    try {
      await sendMessage(conv.id, tenantId, myName, body);
      setDraft('');
      await load();
      onSent();
    } catch (err) {
      setSendError((err as Error).message);
    } finally {
      setSending(false);
    }
  };

  return (
    <section
      aria-label={`Conversation with ${conv?.name || 'no one'}`}
      className={`sp-card min-h-0 flex-1 flex-col overflow-hidden ${conv ? 'flex' : 'hidden'} lg:flex`}
    >
      {conv ? (
        <>
          {/* Header */}
          <header className="flex shrink-0 items-center gap-3 border-b border-[#E3E7E0] px-4 py-3">
            <button
              onClick={onBack}
              aria-label="Back to conversations"
              className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#F6F5F2] text-[#0F3D3E] transition hover:bg-[#EDEDE9] lg:hidden"
            >
              <ArrowLeft size={18} aria-hidden />
            </button>
            <ThreadAvatar conv={conv} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-semibold text-[#1A1A1A]">{conv.name}</p>
              <p className="truncate text-[11px] text-[#969696]">
                {conv.kind === 'team'
                  ? `${conv.member_names?.length || 0} team members`
                  : 'Personal conversation'}
              </p>
            </div>
            <button
              aria-label="Start voice call"
              title="Voice call"
              className="hidden h-11 w-11 items-center justify-center rounded-xl border border-[#E3E7E0] bg-white text-[#0F3D3E] transition hover:bg-[#F6F5F2] sm:flex"
            >
              <Phone size={17} aria-hidden />
            </button>
            <button
              aria-label="Start video call"
              title="Video call"
              className="hidden h-11 w-11 items-center justify-center rounded-xl border border-[#E3E7E0] bg-white text-[#0F3D3E] transition hover:bg-[#F6F5F2] sm:flex"
            >
              <Video size={17} aria-hidden />
            </button>
            <button
              aria-label="Conversation options"
              title="More options"
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#E3E7E0] bg-white text-[#0F3D3E] transition hover:bg-[#F6F5F2]"
            >
              <MoreHorizontal size={17} aria-hidden />
            </button>
          </header>

          {/* Thread */}
          <div
            ref={scrollRef}
            className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-[#F6F5F2] px-4 py-4"
            aria-live="polite"
          >
            {loading ? (
              <>
                <div className="sp-skeleton h-16 w-2/3" />
                <div className="sp-skeleton ml-auto h-16 w-1/2" />
                <div className="sp-skeleton h-16 w-3/5" />
              </>
            ) : error ? (
              <div className="flex h-full items-center justify-center">
                <div className="sp-card max-w-md p-5 text-center" role="alert">
                  <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-[#D9E2DD] text-[#0F3D3E]">
                    <AlertTriangle size={18} aria-hidden />
                  </span>
                  <p className="mt-3 break-words text-[13px] text-[#6B6B6B]">{error}</p>
                  <p className="mt-1 text-[11.5px] text-[#969696]">{MIGRATION_004_NOTE}</p>
                  <button onClick={() => void load()} className="sp-cta mt-4 h-11 px-5 text-[13px]">
                    Retry
                  </button>
                </div>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#D9E2DD] text-[#0F3D3E]">
                  <MessageSquare size={24} aria-hidden />
                </span>
                <p className="mt-3 text-[14px] font-semibold text-[#1A1A1A]">No messages yet</p>
                <p className="mt-1 max-w-xs text-[12.5px] text-[#6B6B6B]">
                  Say hello — the first message in this conversation will show up here.
                </p>
              </div>
            ) : (
              messages.map((m) => {
                const mine = m.sender_name === myName;
                return (
                  <div key={m.id} className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
                    <div
                      className={`max-w-[78%] rounded-2xl px-4 py-2.5 ${
                        mine
                          ? 'rounded-br-[4px] border border-[#E3E7E0] bg-white'
                          : 'rounded-bl-[4px] bg-[#EAF0EC]'
                      }`}
                    >
                      <p
                        className={`text-[12px] font-semibold ${mine ? 'text-[#B88E2F]' : 'text-[#0F3D3E]'}`}
                      >
                        {mine ? 'You:' : `${m.sender_name}:`}
                      </p>
                      <p className="mt-0.5 whitespace-pre-wrap break-words text-[13px] leading-relaxed text-[#1A1A1A]">
                        {m.body}
                      </p>
                    </div>
                    <span className="mt-1 px-1 text-[11px] text-[#969696]">{clockTime(m.created_at)}</span>
                  </div>
                );
              })
            )}
          </div>

          {/* Composer */}
          <form onSubmit={onSend} className="shrink-0 border-t border-[#E3E7E0] bg-white px-4 py-3">
            {sendError && (
              <p className="mb-2 break-words text-[12px] text-[#B42318]" role="alert">
                Message not sent: {sendError}
              </p>
            )}
            <div className="flex items-center gap-2">
              <span aria-hidden className="hidden h-11 w-9 items-center justify-center text-[#969696] sm:flex">
                <Paperclip size={18} />
              </span>
              <label className="sr-only" htmlFor="sp-message-input">
                Write a message
              </label>
              <input
                id="sp-message-input"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Write a message..."
                autoComplete="off"
                className="sp-input h-11 min-w-0 flex-1 rounded-full px-4 text-[13.5px]"
              />
              <span aria-hidden className="hidden h-11 w-9 items-center justify-center text-[#969696] sm:flex">
                <Mic size={18} />
              </span>
              <button
                type="submit"
                disabled={!draft.trim() || sending}
                aria-label="Send message"
                className="sp-cta flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
              >
                <Send size={17} aria-hidden />
              </button>
            </div>
          </form>
        </>
      ) : (
        /* Desktop placeholder — no conversation selected */
        <div className="flex h-full flex-col items-center justify-center p-6 text-center">
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-[#D9E2DD] text-[#0F3D3E]">
            <MessageSquare size={30} aria-hidden />
          </span>
          <h2 className="mt-4 text-[16px] font-semibold text-[#1A1A1A]">Select a conversation</h2>
          <p className="mt-1 max-w-xs text-[13px] text-[#6B6B6B]">
            Pick a team channel or a personal chat from the list to start messaging.
          </p>
        </div>
      )}
    </section>
  );
};

/* ── Screen content (tenant-scoped) ──────────────────────────────────── */

const MessagesContent: React.FC<{ onTenantRetry: () => void }> = ({ onTenantRetry }) => {
  const tenant = useTenant();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    if (!tenant.tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchConversations(tenant.tenantId);
      setConversations(rows);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [tenant.tenantId]);

  useEffect(() => {
    void load();
  }, [load]);

  const refreshConversations = useCallback(async () => {
    if (!tenant.tenantId) return;
    try {
      const rows = await fetchConversations(tenant.tenantId);
      setConversations(rows);
    } catch {
      /* best-effort list refresh after a send — thread already confirmed the write */
    }
  }, [tenant.tenantId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.last_message || '').toLowerCase().includes(q)
    );
  }, [conversations, query]);

  const teams = filtered.filter((c) => c.kind === 'team');
  const personal = filtered.filter((c) => c.kind !== 'team');
  const selected = conversations.find((c) => c.id === selectedId) || null;

  if (tenant.loading) {
    return (
      <div className="flex h-full min-h-0 gap-4 p-4 lg:gap-5 lg:p-5">
        <div className="sp-card flex h-full w-full flex-col gap-4 overflow-hidden p-5 lg:w-[42%]">
          <div className="sp-skeleton h-7 w-36" />
          <div className="sp-skeleton h-[68px] rounded-[14px]" />
          <div className="sp-skeleton h-[68px] rounded-[14px]" />
          <div className="sp-skeleton h-[68px] rounded-[14px]" />
        </div>
        <div className="sp-card hidden min-h-0 flex-1 lg:block" />
      </div>
    );
  }

  if (tenant.error || !tenant.tenantId) {
    return (
      <div className="flex h-full flex-col p-4 lg:p-5">
        <ErrorCard
          message={tenant.error || 'No workspace is linked to this account.'}
          onRetry={onTenantRetry}
        />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 gap-4 p-4 lg:gap-5 lg:p-5">
      {/* Left pane — conversation list (~42%) */}
      <section
        aria-label="Conversations"
        className={`sp-card min-h-0 w-full flex-col overflow-hidden lg:flex lg:w-[42%] lg:max-w-[480px] ${
          selected ? 'hidden' : 'flex'
        }`}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 px-5 pb-3 pt-5">
          <h1 className="text-[22px] font-bold text-[#1A1A1A]">Messages</h1>
          <button
            onClick={() => {
              setSearchOpen((v) => !v);
              setQuery('');
            }}
            aria-label={searchOpen ? 'Close conversation search' : 'Search conversations'}
            aria-expanded={searchOpen}
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#E3E7E0] bg-white text-[#0F3D3E] transition hover:bg-[#F6F5F2]"
          >
            {searchOpen ? <X size={17} aria-hidden /> : <Search size={17} aria-hidden />}
          </button>
        </div>

        {searchOpen && (
          <div className="shrink-0 px-5 pb-3">
            <label className="sr-only" htmlFor="sp-conversation-search">
              Search conversations
            </label>
            <input
              id="sp-conversation-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search conversations..."
              autoFocus
              className="sp-input h-11 w-full rounded-full px-4 text-[13px]"
            />
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">
          {loading ? (
            <>
              <div className="sp-skeleton mb-2 h-[68px] rounded-[14px]" />
              <div className="sp-skeleton mb-2 h-[68px] rounded-[14px]" />
              <div className="sp-skeleton mb-2 h-[68px] rounded-[14px]" />
              <div className="sp-skeleton h-[68px] rounded-[14px]" />
            </>
          ) : error ? (
            <ErrorCard message={error} onRetry={() => void load()} />
          ) : conversations.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-center">
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#D9E2DD] text-[#0F3D3E]">
                <MessageSquare size={24} aria-hidden />
              </span>
              <p className="mt-3 text-[14px] font-semibold text-[#1A1A1A]">No conversations yet</p>
              <p className="mt-1 max-w-xs text-[12.5px] text-[#6B6B6B]">
                Team channels and personal chats will appear here once your workspace starts messaging.
              </p>
            </div>
          ) : (
            <>
              {teams.length > 0 && (
                <>
                  <p className="pb-2 text-[13px] font-semibold text-[#1A1A1A]">Teams</p>
                  <div className="space-y-2.5">
                    {teams.map((c) => (
                      <ConversationCard
                        key={c.id}
                        conv={c}
                        active={c.id === selectedId}
                        onSelect={() => setSelectedId(c.id)}
                      />
                    ))}
                  </div>
                </>
              )}
              {personal.length > 0 && (
                <>
                  <p className="pb-2 pt-4 text-[13px] font-semibold text-[#1A1A1A]">Personal</p>
                  <div className="space-y-2.5">
                    {personal.map((c) => (
                      <ConversationCard
                        key={c.id}
                        conv={c}
                        active={c.id === selectedId}
                        onSelect={() => setSelectedId(c.id)}
                      />
                    ))}
                  </div>
                </>
              )}
              {teams.length === 0 && personal.length === 0 && (
                <p className="py-8 text-center text-[13px] text-[#6B6B6B]">
                  No conversations match your search.
                </p>
              )}
            </>
          )}
        </div>
      </section>

      {/* Right pane — chat thread */}
      <ChatPane
        conv={selected}
        tenantId={tenant.tenantId}
        onBack={() => setSelectedId(null)}
        onSent={() => void refreshConversations()}
      />
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

  return (
    <MessagesContent
      key={reloadKey}
      onTenantRetry={() => setReloadKey((k) => k + 1)}
    />
  );
};
