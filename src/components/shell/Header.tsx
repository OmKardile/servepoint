import React, { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Bell, Clock3, Search } from 'lucide-react';
import { fetchUnreadNotificationCount, subscribeNotificationsRealtime } from '../../lib/api';
import { useTenant } from '../../lib/tenant';
import { useSession, useUi } from '../../store/session';

/**
 * ServePoint header — back + breadcrumbs, bell with an HONEST unread badge,
 * history clock, search (Figma shell).
 *
 * v5.40.0 — the bell stops pretending: the old static gold dot was always
 * on, claiming unread state the DB never backed. The badge now counts real
 * unread notifications (migration 030 gave the table its first writers),
 * refreshed on mount, on every realtime ring, and on a 30s safety poll —
 * and it stays QUIET when the count is zero. A badge that never sleeps is
 * a badge nobody reads.
 */
export const Header: React.FC = () => {
  const { breadcrumb, setBreadcrumb, goSection, search, setSearch } = useUi();
  const session = useSession((s) => s.session);
  const { tenantId } = useTenant();

  const [unread, setUnread] = useState<number | null>(null);

  const refreshUnread = useCallback(async () => {
    if (!tenantId) return;
    try {
      setUnread(await fetchUnreadNotificationCount(tenantId));
    } catch {
      /* best-effort: a failed count just means no badge, never a broken header */
    }
  }, [tenantId]);

  useEffect(() => {
    if (!tenantId) {
      setUnread(null);
      return;
    }
    void refreshUnread();
    const unsub = subscribeNotificationsRealtime(
      tenantId,
      () => void refreshUnread(),
      () => {}, // the badge doesn't care about the channel chip; only the ring
      'badge' // own channel — sharing names with other consumers throws after subscribe
    );
    const poll = window.setInterval(() => void refreshUnread(), 30_000);
    return () => {
      unsub();
      window.clearInterval(poll);
    };
  }, [tenantId, refreshUnread]);

  const canGoBack = breadcrumb.length > 1;

  const onBack = () => {
    if (canGoBack) setBreadcrumb(breadcrumb.slice(0, -1));
  };

  return (
    <header className="flex h-[62px] shrink-0 items-center gap-4 border-b border-[#E3E7E0] bg-white px-5">
      <button
        onClick={onBack}
        disabled={!canGoBack}
        aria-label="Go back"
        className={`flex h-9 w-11 items-center justify-center rounded-lg transition ${
          canGoBack
            ? 'bg-[#F3E8CF] text-[#1A1A1A] hover:bg-[#E9D9AF]'
            : 'cursor-not-allowed bg-[#F3EFE5] text-[#969696]/50'
        }`}
      >
        <ArrowLeft size={17} aria-hidden />
      </button>

      <nav aria-label="Breadcrumb" className="min-w-0 flex-1 overflow-hidden">
        <ol className="flex items-center gap-2 text-[13px]">
          {breadcrumb.map((part, i) => (
            <li key={`${part}-${i}`} className={`flex min-w-0 items-center gap-2 ${i === 0 ? 'hidden sm:flex' : ''}`}>
              {i > 0 && (
                <span aria-hidden className="text-[#C4C9C4]">
                  ›
                </span>
              )}
              <span
                className={
                  i === breadcrumb.length - 1
                    ? 'truncate font-semibold text-[#1A1A1A]'
                    : 'truncate text-[#969696]'
                }
              >
                {part}
              </span>
            </li>
          ))}
        </ol>
      </nav>

      <button
        onClick={() => goSection('notifications', ['Notifications'])}
        aria-label={
          unread && unread > 0
            ? `Notifications, ${unread} unread`
            : 'Notifications, no unread'
        }
        className="relative flex h-9 w-9 items-center justify-center rounded-full text-[#1A1A1A] hover:bg-[#F6F5F2]"
      >
        <Bell size={18} aria-hidden />
        {unread !== null && unread > 0 && (
          <span
            aria-hidden
            className="absolute -right-0.5 -top-0.5 flex h-[17px] min-w-[17px] items-center justify-center rounded-full border-2 border-white bg-[#B88E2F] px-[3px] text-[9.5px] font-bold leading-none tabular-nums text-white"
          >
            {unread > 99 ? '99+' : unread}
          </span>
        )}
        <span className="sr-only">Unread notifications</span>
      </button>

      <button
        onClick={() => goSection('bills', ['Bills'])}
        aria-label="Order history"
        className="flex h-9 w-9 items-center justify-center rounded-full text-[#1A1A1A] hover:bg-[#F6F5F2]"
      >
        <Clock3 size={18} aria-hidden />
      </button>

      <div className="relative hidden w-[240px] max-w-[32vw] md:block">
        <Search
          size={15}
          aria-hidden
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#969696]"
        />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search ..."
          aria-label="Search current screen"
          className="sp-input w-full rounded-full py-2 pl-9 pr-3 text-[13px]"
        />
      </div>
      <button
        onClick={() => useUi.getState().setProfileOpen(true)}
        aria-label="Open Profile"
        className="sp-cta flex h-9 items-center justify-center rounded-full px-3 text-[12px] md:hidden"
      >
        {(session?.name || 'S').charAt(0).toUpperCase()}
      </button>
    </header>
  );
};
