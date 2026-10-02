import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  CheckCheck,
  Clock,
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
  markNotificationsRead,
  subscribeNotificationsRealtime,
  type RealtimeState,
} from '../../lib/api';
import { dbErrorHint } from '../../lib/dbErrors';
import { timeAgo } from '../../lib/prefs';
import { useTenant } from '../../lib/tenant';
import { useUi } from '../../store/session';
import type { AppNotification, NotificationCategory } from '../../types';

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

const NotificationCard: React.FC<{ n: AppNotification }> = ({ n }) => {
  const Icon = CATEGORY_ICON[n.category] || Bell;
  const unread = !n.is_read;
  const chip = CATEGORY_CHIP[n.category] || CATEGORY_CHIP.message;
  return (
    <article
      aria-label={`${CATEGORY_LABEL[n.category] || 'Notification'}: ${n.title}${unread ? ' (unread)' : ''}`}
      className={`rounded-2xl border bg-[#EAF0EC] p-4 sm:p-5 ${
        unread ? 'border-[#B88E2F]' : 'border-[#E3E7E0]'
      }`}
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
            <h3 className={`text-[14px] leading-snug text-[#1A1A1A] ${unread ? 'font-bold' : 'font-semibold'}`}>
              {n.title}
              {unread && (
                <span className="ml-2 inline-block h-2 w-2 rounded-full bg-[#B88E2F] align-middle" aria-label="Unread" />
              )}
            </h3>
            <span className="sr-only">{CATEGORY_LABEL[n.category] || 'Notification'}</span>
          </div>
          <p className="mt-1 break-words text-[13px] leading-relaxed text-[#6B6B6B]">{n.body}</p>
          <p className="mt-2.5 flex items-center gap-1.5 text-[12px] text-[#969696]">
            <Clock size={13} aria-hidden />
            {timeAgo(n.created_at)}
          </p>
        </div>
      </div>
    </article>
  );
};

/* ── Screen content (tenant-scoped) ──────────────────────────────────── */

const NotificationsContent: React.FC<{ onTenantRetry: () => void }> = ({ onTenantRetry }) => {
  const tenant = useTenant();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [marking, setMarking] = useState(false);
  const [markError, setMarkError] = useState<string | null>(null);
  const [rt, setRt] = useState<RealtimeState>('connecting');

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
          <h1 className="text-[22px] font-bold text-[#1A1A1A]">Notifications</h1>
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
      ) : (
        <div className="space-y-3">
          {items.map((n) => (
            <NotificationCard key={n.id} n={n} />
          ))}
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
