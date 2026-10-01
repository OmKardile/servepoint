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
} from 'lucide-react';
import { fetchNotifications, markNotificationsRead } from '../../lib/api';
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
            unread ? 'bg-white text-[#B88E2F]' : 'bg-white text-[#0F3D3E]'
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

  const load = useCallback(async () => {
    if (!tenant.tenantId) return;
    setLoading(true);
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
    void load();
  }, [load]);

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
        <h1 className="text-[22px] font-bold text-[#1A1A1A]">Notifications</h1>
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
            Order updates, staff messages, reminders and system alerts will appear here as they happen in your workspace.
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
