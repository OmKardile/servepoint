import React, { useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  Check,
  CheckCheck,
  Clock,
  Info,
  Loader2,
  MessageSquare,
  RefreshCw,
  Star,
  Tag,
  Wifi,
  WifiOff,
} from 'lucide-react';
import {
  fetchNotifications,
  fetchReservations,
  markNotificationRead,
  markNotificationsRead,
  subscribeNotificationsRealtime,
  type RealtimeState,
} from '../../lib/api';
import { dbErrorHint } from '../../lib/dbErrors';
import { getPrefs, subscribePrefs, timeAgo } from '../../lib/prefs';
import { bookingSlotLabel, bookingDayKey, bookingTodayKey } from '../../lib/bookingday';
import { useTenant } from '../../lib/tenant';
import { useUi, type Section } from '../../store/session';
import { SECTION_LABELS } from '../shell/Sidebar';
import type { AppNotification, NotificationCategory } from '../../types';
import type { Reservation } from '../../lib/api';

/**
 * Notifications (v5.0.0, ADR-0014) — Figma Notifications_219-29744.
 * Sage-tint cards, gold border when unread, category icon chip, bold title,
 * body, clock icon + relative time. Production data only (notifications —
 * migration 004). "Mark all read" persists to Supabase then re-fetches.
 *
 * v5.40.0 — the bell actually rings (migration 030): three server-truth
 * triggers write real events (low stock, low rating, today's booking), the
 * table joined the realtime publication, and this screen subscribes — a
 * ring re-fetches instantly, with a 30s poll as the honest fallback. The
 * category chips now carry category colors (amber system, red feedback,
 * sage reminder, gold promotion) so the eye triages a stack of cards at a
 * glance instead of reading every title.
 *
 * v5.42.0 — the bell's door opens (migration 032): the generators stamp
 * `link_to` (the in-app section slug), and each card renders its own door —
 * "Open" walks straight to the shelf / the ticket / the book the bell is
 * about. Also: mark ONE bell read (row-scoped UPDATE; the realtime UPDATE
 * ping recounts the header badge for free) and honest category filters —
 * chips exist only for categories that actually have bells, with true
 * counts, so no chip is a dead end.
 *
 * v5.88.0 — the echo learns: a booking reminder is a TEXT snapshot (the
 * trigger has no reservation FK), so it kept advertising parties whose
 * promise had already died — cancelled, seated, no-show, gone quiet. Now
 * each reminder reconciles with the book's LIVE truth at render time:
 * title "Booking today: <name> ×<party>" + body "<slot> — …" matched
 * against today's reservations. Exactly ONE match speaks, in the same
 * tone family the floor's book already uses (cancelled/seated/no-show/
 * went quiet/still expected); zero or several matches stay silent — the
 * echo never guesses, and an unread book (null) never becomes an
 * invented all-clear. Read-only: the bell never writes to the book.
 */

const CATEGORY_ICON: Record<NotificationCategory, React.ComponentType<{ size?: number; className?: string }>> = {
  message: MessageSquare,
  system: AlertTriangle,
  reminder: Clock,
  promotion: Tag,
  feedback: Star,
};

const CATEGORY_LABEL: Record<NotificationCategory, string> = {
  message: 'Message',
  system: 'System',
  reminder: 'Reminder',
  promotion: 'Promotion',
  feedback: 'Feedback',
};

/* The bell's door — a link_to slug only counts if it names a real section;
 * anything else (or nothing) renders no door. Honest unknown = no button. */
const doorOf = (n: AppNotification): Section | null => {
  const slug = n.link_to;
  if (!slug) return null;
  return Object.hasOwn(SECTION_LABELS, slug) ? (slug as Section) : null;
};

/* v5.40.0 — category-tinted chips: the icon chip's surface speaks the
 * category's language (amber = something needs ordering, red = a guest is
 * unhappy, sage = the house clock, gold = noise of the nice kind). Read
 * cards soften to the calm sage-white; unread keeps the saturated tone. */
const CATEGORY_CHIP: Record<NotificationCategory, { unread: string; read: string }> = {
  system: { unread: 'bg-[#FBF3E1] text-[#8A5A00]', read: 'bg-[#F6F5F2] text-[#8A5A00]' },
  feedback: { unread: 'bg-[#FCEBEA] text-[#B3261E]', read: 'bg-[#F6F5F2] text-[#B3261E]' },
  reminder: { unread: 'bg-[#E8F3E9] text-[#2E7D32]', read: 'bg-[#F6F5F2] text-[#2E7D32]' },
  promotion: { unread: 'bg-[#F3E8CF] text-[#967221]', read: 'bg-[#F6F5F2] text-[#967221]' },
  message: { unread: 'bg-white text-[#0F3D3E]', read: 'bg-[#F6F5F2] text-[#0F3D3E]' },
};

/* ── The echo (v5.88.0) — helpers + reconciler ───────────────────────── */

/* v5.88.0 — the echo's slot label compared against the book byte-for-byte.
 * 5.105.0 — the three drifted copies (floor / echo / guest drawer) became
 * ONE voice in src/lib/bookingday.ts, anchored to the DB's own clock —
 * the trigger that composed this bell body speaks Asia/Kolkata, so the
 * matcher must too. On IST devices the words are unchanged. */
const istSlotLabelEcho = bookingSlotLabel;
const istDayKeyEcho = bookingDayKey;

/** "Booking today: Kavita Desai ×2" → name + party. */
const REMINDER_TITLE_RE = /^Booking today: (.+) ×(\d+)$/;

/** The echo's voice — the RES_META family the floor's book already speaks
 *  (same hex values, so bell and book read as one instrument). */
type EchoState = {
  label: string;
  bg: string;
  fg: string;
  /** cancelled strikes the guest's name through, as the book does. */
  strike: boolean;
  /** cancelled dims the whole card, as the book's rows do. */
  dim: boolean;
  /** The full sentence for title/aria — provenance always included. */
  note: string;
};

function echoFor(
  n: AppNotification,
  reservations: Reservation[] | null,
  nowMs: number,
  todayKey: string,
): EchoState | null {
  if (n.category !== 'reminder' || !reservations) return null;
  const m = REMINDER_TITLE_RE.exec(n.title);
  if (!m) return null;
  const name = m[1].trim();
  const party = Number.parseInt(m[2], 10);
  const slotLabel = (n.body || '').split(' — ')[0]?.trim();
  if (!name || !Number.isFinite(party) || !slotLabel) return null;
  const matches = reservations.filter(
    (r) => r.guest_name === name && r.party_size === party && istSlotLabelEcho(r.slot_at) === slotLabel,
  );
  /* Exactly one match speaks. Zero = the echo doesn't guess; more than one
   * = ambiguous (two identical promises) — silence, never a coin flip. */
  if (matches.length !== 1) return null;
  const r = matches[0];
  const provenance = `Matched to the book by guest, party and hour — the book's truth as of now.`;
  if (r.status === 'cancelled')
    return {
      label: 'Cancelled',
      bg: '#EAF0EC',
      fg: '#6B6B6B',
      strike: true,
      dim: true,
      note: `This booking was cancelled. ${provenance}`,
    };
  if (r.status === 'seated')
    return {
      label: 'Seated',
      bg: '#E7F1E8',
      fg: '#2E7D32',
      strike: false,
      dim: false,
      note: `The party is already seated. ${provenance}`,
    };
  if (r.status === 'no_show')
    return {
      label: 'Marked no-show',
      bg: '#FCEBEA',
      fg: '#B3261E',
      strike: false,
      dim: false,
      note: `The booking was marked no-show. ${provenance}`,
    };
  /* Still `booked`: the clock speaks only for today-in-IST, same rule as
   * the floor — quiet when the hour went by, expected while it stands. */
  if (istDayKeyEcho(r.slot_at) !== todayKey) return null;
  if (new Date(r.slot_at).getTime() < nowMs)
    return {
      label: 'Went quiet',
      bg: '#F1F4F1',
      fg: '#6B6B6B',
      strike: false,
      dim: false,
      note: 'The promised hour went by — the party is still booked. Seat them or mark the no-show; the clock does not convict.',
    };
  return {
    label: 'Still expected',
    bg: '#FBF3E1',
    fg: '#8A5A00',
    strike: false,
    dim: false,
    note: `The book still holds this promise. ${provenance}`,
  };
}

/* ── The briefing's hours (v5.159.0) ────────────────────────────────
   A flat feed of bells scans poorly at 7 am; the owner reads the day in
   groups. The clock is the booking clock's own IST day key — the same
   one the book and the echo speak. Unreadable stamps land in "Earlier"
   (honest, never dropped), and each group reads newest-first. */
export interface NotificationGroup {
  label: string;
  items: AppNotification[];
}

export function groupNotificationsForFeed(
  items: AppNotification[],
  todayKey: string,
  yesterdayKey: string,
): NotificationGroup[] {
  const today: AppNotification[] = [];
  const yesterday: AppNotification[] = [];
  const earlier: AppNotification[] = [];
  for (const n of items) {
    let key: string | null = null;
    try {
      key = bookingDayKey(n.created_at);
    } catch {
      key = null; // an unreadable stamp never drops the bell — Earlier holds it
    }
    if (key === todayKey) today.push(n);
    else if (key === yesterdayKey) yesterday.push(n);
    else earlier.push(n);
  }
  const byNewest = (a: AppNotification, b: AppNotification) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  const groups: NotificationGroup[] = [];
  if (today.length) groups.push({ label: 'Today', items: today.sort(byNewest) });
  if (yesterday.length) groups.push({ label: 'Yesterday', items: yesterday.sort(byNewest) });
  if (earlier.length) groups.push({ label: 'Earlier', items: earlier.sort(byNewest) });
  return groups;
}

/* ── Skeletons ───────────────────────────────────────────────────────── */

const NotificationsSkeleton: React.FC = () => (
  <div className="space-y-3" aria-hidden>
    {[0, 1, 2, 3].map((i) => (
      <div key={i} className="sp-skeleton h-[116px] rounded-2xl" />
    ))}
  </div>
);

/* ── Honest error card ───────────────────────────────────────────────── */

const ErrorCard: React.FC<{ message: string; onRetry: () => void }> = ({ message, onRetry }) => (
  <div className="sp-card p-6 text-center" role="alert">
    <div className="flex flex-col items-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#D9E2DD] text-[#0F3D3E]">
        <AlertTriangle size={22} aria-hidden />
      </span>
      <h2 className="mt-4 text-[15px] font-semibold text-[#1A1A1A]">Couldn't load notifications</h2>
      <p className="mt-2 break-words text-[13px] text-[#6B6B6B]">{message}</p>
      <p className="mt-2 break-words text-[12px] text-[#969696]">{dbErrorHint(message)}</p>
      <button onClick={onRetry} className="sp-cta mt-5 flex h-11 items-center gap-2 px-6 text-[13.5px]">
        <RefreshCw size={15} aria-hidden />
        Retry
      </button>
    </div>
  </div>
);

/* ── Notification card ───────────────────────────────────────────────── */

const NotificationCard: React.FC<{
  n: AppNotification;
  echo: EchoState | null;
  marking: boolean;
  onMarkOne: (n: AppNotification) => void;
  onOpen: (n: AppNotification) => void;
}> = ({ n, echo, marking, onMarkOne, onOpen }) => {
  const Icon = CATEGORY_ICON[n.category] || Bell;
  const unread = !n.is_read;
  const chip = CATEGORY_CHIP[n.category] || CATEGORY_CHIP.message;
  const door = doorOf(n);
  const titleMatch = echo?.strike ? REMINDER_TITLE_RE.exec(n.title) : null;
  return (
    <article
      aria-label={`${CATEGORY_LABEL[n.category] || 'Notification'}: ${n.title}${echo ? ` — ${echo.label}` : ''}${unread ? ' (unread)' : ''}`}
      className={`rounded-2xl border bg-[#EAF0EC] p-4 sm:p-5 ${
        unread ? 'border-[#B88E2F]' : 'border-[#E3E7E0]'
      } ${echo?.dim ? 'opacity-70' : ''}`}
      title={echo?.note}
    >
      <div className="flex items-start gap-3">
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
            unread ? chip.unread : chip.read
          }`}
        >
          <Icon size={18} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <h3 className={`text-[14px] leading-snug text-[#1A1A1A] ${unread ? 'font-bold' : 'font-semibold'}`}>{echo?.strike && titleMatch ? (
                <>
                  Booking today: <span className="line-through">{titleMatch[1]}</span> ×{titleMatch[2]}
                </>
              ) : (
                n.title
              )}
              {unread && (
                <span className="ml-2 inline-block h-2 w-2 rounded-full bg-[#B88E2F] align-middle" aria-label="Unread" />
              )}
            </h3>
            <span className="sr-only">{CATEGORY_LABEL[n.category] || 'Notification'}</span>
          </div>
          <p className="mt-1 break-words text-[13px] leading-relaxed text-[#6B6B6B]">{n.body}</p>
          <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
            <p className="flex flex-wrap items-center gap-1.5 text-[12px] text-[#969696]">
              {echo && (
                <span
                  className="rounded-full px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide"
                  style={{ background: echo.bg, color: echo.fg }}
                >
                  {echo.label}
                </span>
              )}
              <Clock size={13} aria-hidden />
              {timeAgo(n.created_at)}
            </p>
            {(unread || door) && (
              <div className="flex items-center gap-2">
                {unread && (
                  <button
                    onClick={() => onMarkOne(n)}
                    disabled={marking}
                    aria-label={`Mark "${n.title}" as read`}
                    className="flex items-center gap-1 rounded-lg border border-[#E3E7E0] bg-white px-2.5 py-1 text-[12px] font-semibold text-[#6B6B6B] transition hover:border-[#B88E2F] hover:text-[#8A5A00] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#967221] disabled:cursor-not-allowed disabled:opacity-55"
                  >
                    {marking ? <Loader2 size={12} className="animate-spin" aria-hidden /> : <Check size={12} aria-hidden />}
                    Mark read
                  </button>
                )}
                {door && (
                  <button
                    onClick={() => onOpen(n)}
                    aria-label={`Open ${SECTION_LABELS[door]} — ${n.title}`}
                    className="flex items-center gap-1 rounded-lg bg-[#0F3D3E]/5 px-2.5 py-1 text-[12px] font-semibold text-[#0F3D3E] transition hover:bg-[#0F3D3E]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#967221]"
                  >
                    Open {SECTION_LABELS[door]}
                    <ArrowRight size={12} aria-hidden />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </article>
  );
};

/* ── Screen content (tenant-scoped) ──────────────────────────────────── */

const NotificationsContent: React.FC<{ onTenantRetry: () => void }> = ({ onTenantRetry }) => {
  const tenant = useTenant();
  const goSection = useUi((s) => s.goSection);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [marking, setMarking] = useState(false);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [markError, setMarkError] = useState<string | null>(null);
  const [rt, setRt] = useState<RealtimeState>('connecting');
  const [filter, setFilter] = useState<NotificationCategory | 'all'>('all');
  /* v5.159.0 — the missed-bells filter: one tap answers "what haven't I
   *  read?" without scrolling the whole feed. Composes with the category
   *  chips (AND); renders only while there is something unread, so no
   *  chip is ever a dead end — the 5.42.0 honesty rule. */
  const [unreadOnly, setUnreadOnly] = useState(false);
  /* v5.88.0 — the echo's book: today's reservations, fail-soft. Null = the
   *  echo goes silent; the list itself never depends on it. */
  const [reservations, setReservations] = useState<Reservation[] | null>(null);
  const [echoTick, setEchoTick] = useState(0);

  /* 5.103.0 — the toggles keep their word. A category switched off in
   * Settings leaves the alert surface (list + chips + header badge); the
   * subscribePrefs tick re-renders on a save, and the fresh read below
   * applies it live — no reload, same discipline as the sound gates. */
  const [, tickNotify] = useReducer((n: number) => n + 1, 0);
  useEffect(() => subscribePrefs(tickNotify), [tickNotify]);
  const notify = getPrefs().notify;

  const load = useCallback(async () => {
    if (!tenant.tenantId) return;
    setError(null);
    try {
      const rows = await fetchNotifications(tenant.tenantId);
      setItems(rows);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
    /* v5.88.0 — the echo's book rides the same rhythm (realtime ring or
     *  30s poll), so a seating on the floor reaches the bell within one
     *  beat. Fail-soft: a refusal leaves the previous truth (or silence). */
    try {
      const book = await fetchReservations(tenant.tenantId, 200);
      setReservations(book);
    } catch {
      setReservations(null);
    }
  }, [tenant.tenantId]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  /* v5.40.0 — the ring is heard live: migration 030 put notifications on the
   * realtime publication, so a trigger-fired event re-fetches the list
   * instantly. The 30s poll stays as the honest fallback when the channel
   * is down (the chip says which one is running). */
  useEffect(() => {
    if (!tenant.tenantId) return;
    const unsub = subscribeNotificationsRealtime(
      tenant.tenantId,
      () => void load(),
      setRt,
      'list' // own channel — the header badge rides 'badge'; shared names throw after subscribe
    );
    const poll = window.setInterval(() => void load(), 30_000);
    return () => {
      unsub();
      window.clearInterval(poll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant.tenantId]);

  const unreadCount = useMemo(() => items.filter((n) => !n.is_read).length, [items]);

  /* v5.88.0 — the echo's clock: the quiet/expected boundary walks on its
   *  own 30s tick, so a reminder flips between polls without a fetch —
   *  the same discipline as the floor's promise clock. */
  const nowMs = useMemo(() => Date.now(), [echoTick]);
  const todayKey = useMemo(() => bookingTodayKey(), [echoTick]);

  /* v5.159.0 — the ticker the comment above always promised: echoTick had
   *  no driver, so nowMs/todayKey froze at mount and the Went-quiet
   *  boundary never walked on the clock alone. One interval — the echo
   *  flips on time now, no fetch attached. */
  useEffect(() => {
    const t = window.setInterval(() => setEchoTick((k) => k + 1), 30_000);
    return () => window.clearInterval(t);
  }, []);

  /* 5.103.0 — the alert surface: only categories the owner kept. A category
   * the panel doesn't name yet (a future one) alerts by default — the
   * toggle mutes only what it names. */
  const kept = items.filter((n) => notify[n.category] !== false);
  const hiddenCount = items.length - kept.length;

  /* v5.42.0 — honest filters: a chip exists only when at least one bell of
   * that category is on record AND the owner hasn't muted it — no chip is
   * ever a dead end, and no chip invites you into a muted room. */
  const chips = useMemo(() => {
    const counts = new Map<NotificationCategory, number>();
    for (const n of kept) counts.set(n.category, (counts.get(n.category) || 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, notify]);

  const visible = useMemo(
    () => {
      const base = filter === 'all' ? kept : kept.filter((n) => n.category === filter);
      return unreadOnly ? base.filter((n) => !n.is_read) : base;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, filter, notify, unreadOnly]
  );

  /* v5.159.0 — the day groups ride the visible set; yesterday's key
   *  derives from the same booking clock so the boundary is one clock,
   *  never two. */
  const groups = useMemo(() => {
    const yesterdayKey = bookingDayKey(new Date(Date.now() - 86_400_000).toISOString());
    return groupNotificationsForFeed(visible, todayKey, yesterdayKey);
  }, [visible, todayKey]);

  const onMarkAllRead = async () => {
    if (!tenant.tenantId || marking) return;
    setMarking(true);
    setMarkError(null);
    try {
      await markNotificationsRead(tenant.tenantId);
      await load();
    } catch (err) {
      setMarkError((err as Error).message);
    } finally {
      setMarking(false);
    }
  };

  /* v5.42.0 — one bell at a time: optimistic flip, row-scoped write, silent
   * refetch; a refusal reverts the flip and says so. The header badge recounts
   * itself over realtime (the UPDATE rides the same publication). */
  const onMarkOne = async (n: AppNotification) => {
    if (markingId) return;
    setMarkingId(n.id);
    setMarkError(null);
    setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)));
    try {
      await markNotificationRead(n.id);
      await load();
    } catch (err) {
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, is_read: n.is_read } : x)));
      setMarkError((err as Error).message);
    } finally {
      setMarkingId(null);
    }
  };

  /* The door: walk from the bell straight to the screen it is about. */
  const onOpen = (n: AppNotification) => {
    const door = doorOf(n);
    if (door) goSection(door, [SECTION_LABELS[door]]);
  };

  if (tenant.loading) {
    return (
      <div className="mx-auto w-full max-w-3xl p-4 lg:p-5">
        <div className="flex items-center justify-between pb-5">
          <div className="sp-skeleton h-7 w-44" />
          <div className="sp-skeleton h-11 w-36 rounded-xl" />
        </div>
        <NotificationsSkeleton />
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

  return (
    <div className="mx-auto w-full max-w-3xl p-4 lg:p-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-5">
        <div className="flex items-center gap-3">
          <h1 className="sp-screen-title">Notifications</h1>
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
        <button
          onClick={() => void onMarkAllRead()}
          disabled={unreadCount === 0 || marking}
          aria-label="Mark all notifications as read"
          className="flex h-11 items-center gap-2 rounded-xl border border-[#E3E7E0] bg-white px-4 text-[13px] font-semibold text-[#0F3D3E] transition hover:bg-[#F6F5F2] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#967221] disabled:cursor-not-allowed disabled:opacity-55"
        >
          {marking ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <CheckCheck size={15} aria-hidden />}
          {marking ? 'Marking…' : 'Mark all read'}
        </button>
      </div>

      {markError && (
        <p className="mb-3 break-words rounded-xl border border-[#F5C6C0] bg-[#FEF2F2] px-4 py-3 text-[12.5px] text-[#B42318]" role="alert">
          Couldn't mark notifications read: {markError}
        </p>
      )}

      {/* v5.42.0 — honest category filters (adaptive: only what exists) */}
      {!loading && !error && items.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 pb-4" role="group" aria-label="Filter by category">
          {/* v5.159.0 — the missed-bells toggle, gold when armed. Adaptive:
              rendered only while unread bells exist — an Unread-0 chip
              would be a dead end, and no chip here may lie. */}
          {unreadCount > 0 && (
            <button
              onClick={() => setUnreadOnly((v) => !v)}
              aria-pressed={unreadOnly}
              className={`rounded-full border px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#967221] ${
                unreadOnly
                  ? 'border-[#B88E2F] bg-[#B88E2F] text-white'
                  : 'border-[#E3E7E0] bg-white text-[#0F3D3E] hover:bg-[#F6F5F2]'
              }`}
            >
              Unread
              <span className={`ml-1.5 tabular-nums ${unreadOnly ? 'text-white/70' : 'text-[#8A5A00]'}`}>
                {unreadCount}
              </span>
            </button>
          )}
          <button
            onClick={() => setFilter('all')}
            aria-pressed={filter === 'all'}
            className={`rounded-full border px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#967221] ${
              filter === 'all'
                ? 'border-[#0F3D3E] bg-[#0F3D3E] text-white'
                : 'border-[#E3E7E0] bg-white text-[#0F3D3E] hover:bg-[#F6F5F2]'
            }`}
          >
            All
            <span className={`ml-1.5 tabular-nums ${filter === 'all' ? 'text-white/70' : 'text-[#969696]'}`}>
              {kept.length}
            </span>
          </button>
          {chips.map(([cat, count]) => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              aria-pressed={filter === cat}
              className={`rounded-full border px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#967221] ${
                filter === cat
                  ? 'border-[#0F3D3E] bg-[#0F3D3E] text-white'
                  : 'border-[#E3E7E0] bg-white text-[#0F3D3E] hover:bg-[#F6F5F2]'
              }`}
            >
              {CATEGORY_LABEL[cat] || cat}
              <span className={`ml-1.5 tabular-nums ${filter === cat ? 'text-white/70' : 'text-[#969696]'}`}>
                {count}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* 5.103.0 — the seam, stated where the hiding happens: muted bells are
       * out of the alert surface, but their data is not touched — "Mark all
       * read" still reaches them, same family of honesty as quiet hours. */}
      {!loading && !error && hiddenCount > 0 && (
        <p className="mb-3 flex items-start gap-1.5 text-[11.5px] leading-relaxed text-[#6B6B6B]">
          <Info size={13} className="mt-0.5 shrink-0 text-[#969696]" aria-hidden />
          <span>
            {hiddenCount} {hiddenCount === 1 ? 'bell' : 'bells'} hidden by your notification
            settings — they keep their data, and “Mark all read” still reaches them.
          </span>
        </p>
      )}

      {/* Body */}
      {loading ? (
        <NotificationsSkeleton />
      ) : error ? (
        <ErrorCard message={error} onRetry={() => void load()} />
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <span className="flex h-24 w-24 items-center justify-center rounded-full bg-[#D9E2DD] text-[#0F3D3E]">
            <Bell size={32} aria-hidden />
          </span>
          <h2 className="mt-4 text-[16px] font-semibold text-[#1A1A1A]">No notifications yet</h2>
          <p className="mt-1 max-w-sm text-[13px] leading-relaxed text-[#6B6B6B]">
            The bell rings on real events: a shelf crossing its reorder line, a
            guest leaving a low rating, a booking landing for today. They will
            appear here the moment they happen in your workspace.
          </p>
        </div>
      ) : visible.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-[#E3E7E0] bg-white px-4 py-8 text-center text-[13px] text-[#6B6B6B]">
          Nothing under this filter right now.
        </p>
      ) : (
        /* v5.159.0 — the briefing reads in day groups: gold small-caps
         *  label + the group's count (unread called out) + a hairline —
         *  the house editorial grammar; the cards keep their own voice. */
        <div className="space-y-6">
          {groups.map((g) => {
            const gUnread = g.items.filter((x) => !x.is_read).length;
            return (
              <section
                key={g.label}
                aria-label={`${g.label}: ${g.items.length} ${g.items.length === 1 ? 'notification' : 'notifications'}${gUnread > 0 ? `, ${gUnread} unread` : ''}`}
              >
                <div className="flex items-center gap-2.5 pb-2.5">
                  <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#8A5A00]">{g.label}</h2>
                  <span className="text-[11px] tabular-nums text-[#969696]">
                    {g.items.length}
                    {gUnread > 0 ? ` · ${gUnread} unread` : ''}
                  </span>
                  <span className="h-px flex-1 bg-[#E3E7E0]" aria-hidden />
                </div>
                <div className="space-y-3">
                  {g.items.map((n) => (
                    <NotificationCard
                      key={n.id}
                      n={n}
                      echo={echoFor(n, reservations, nowMs, todayKey)}
                      marking={markingId === n.id}
                      onMarkOne={(x) => void onMarkOne(x)}
                      onOpen={onOpen}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
};

/* ── Exported screen ─────────────────────────────────────────────────── */

export const NotificationsScreen: React.FC = () => {
  const setBreadcrumb = useUi((s) => s.setBreadcrumb);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    setBreadcrumb(['Notifications']);
  }, [setBreadcrumb]);

  return (
    <NotificationsContent
      key={reloadKey}
      onTenantRetry={() => setReloadKey((k) => k + 1)}
    />
  );
};
