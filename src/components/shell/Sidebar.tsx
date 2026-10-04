import React, { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import {
  Armchair,
  Bell,
  BookOpenText,
  ChefHat,
  CookingPot,
  Headphones,
  LayoutGrid,
  MessagesSquare,
  MoonStar,
  BarChart3,
  Package,
  Receipt,
  Settings as SettingsIcon,
  UserRound,
  Users,
} from 'lucide-react';
import { useSession, useUi, type Section } from '../../store/session';
import { useUnread, sumKeptCategories } from '../../store/unread';
import { useChatUnread, sumChatUnread } from '../../store/chatUnread';
import { useStockUnread } from '../../store/stockUnread';
import { getPrefs, subscribePrefs } from '../../lib/prefs';
import { useTenant } from '../../lib/tenant';
import brandMark from '../../assets/brand/mark.png';

const NAV: { id: Section; label: string; icon: React.ElementType }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutGrid },
  { id: 'food', label: 'Food & Drinks', icon: CookingPot },
  { id: 'kitchen', label: 'Kitchen', icon: ChefHat },
  { id: 'bills', label: 'Bills', icon: Receipt },
  { id: 'eod', label: 'Close-out', icon: MoonStar },
  { id: 'reports', label: 'Reports', icon: BarChart3 },
  { id: 'inventory', label: 'Inventory', icon: Package },
  { id: 'customers', label: 'Guests', icon: Users },
  { id: 'floor', label: 'Floor', icon: Armchair },
  { id: 'menu', label: 'Menu', icon: BookOpenText },
  { id: 'settings', label: 'Settings', icon: SettingsIcon },
];

const OTHERS: { id: Section; label: string; icon: React.ElementType }[] = [
  { id: 'messages', label: 'Messages', icon: MessagesSquare },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'support', label: 'Support', icon: Headphones },
];

/** v5.32.0 — deep links: every staff screen is addressable as /:slug/:screen
 *  (bookmarks, staff shortcuts, pinned wall displays). This map is the single
 *  source of truth for screen names — the same labels the sidebar renders. */
export const SECTION_LABELS: Readonly<Record<Section, string>> = Object.freeze(
  Object.fromEntries([...NAV, ...OTHERS].map((i) => [i.id, i.label]))
) as Readonly<Record<Section, string>>;

/** ServePoint sidebar — dark teal rail, gold active pill, user card (Figma shell frames).
 *
 * v5.104.0 — the rail learns the bell too: the Notifications pill carries the
 * same honest unread badge the header bell has spoken since 5.40.0 — same
 * feed (the shared unread store), same prefs-aware sum, same 99+ ceiling.
 * Until now the pill's `unreadCount` prop was DEAD — no caller ever passed
 * it, so the rail kept claiming a quiet room while the header said 11. Two
 * bells in one chrome must tell one truth. The badge also keeps its own
 * contrast honest: gold on the teal rail, deep-teal on the gold active pill
 * — a badge that melts into its pill is a badge nobody reads. */
export const Sidebar: React.FC = () => {
  const { section, goSection } = useUi();
  const session = useSession((s) => s.session);
  const { tenantId } = useTenant();
  const initial = (session?.name || 'S').charAt(0).toUpperCase();

  /* the feed is shared; this rail registers as a consumer exactly like the header */
  useEffect(() => {
    if (!tenantId) return;
    useUnread.getState().ensure(tenantId);
    return () => useUnread.getState().release();
  }, [tenantId]);

  /* prefs change → re-render → the sum re-speaks live after a Settings save */
  const counts = useUnread((s) => s.counts);
  const [, tickNotify] = useReducer((n: number) => n + 1, 0);
  useEffect(() => subscribePrefs(tickNotify), [tickNotify]);
  const notify = getPrefs().notify;
  const unread = useMemo(
    () => sumKeptCategories(counts, notify),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [counts, notify]
  );

  /* the third bell (5.108.0) — the staff line's unread reaches the rail the
   * same way: a shared feed, a registered consumer, its own channel. The
   * identity is part of the feed's key (the watermark arithmetic is per
   * READER); a session that loads late repoints the feed once, on arrival. */
  const email = session?.email || '';
  const name = session?.name || 'Staff';
  useEffect(() => {
    if (!tenantId || !email) return;
    useChatUnread.getState().ensure(tenantId, email, name);
    return () => useChatUnread.getState().release();
  }, [tenantId, email, name]);
  const chatCounts = useChatUnread((s) => s.value);
  const chatUnread = useMemo(() => sumChatUnread(chatCounts), [chatCounts]);

  /* v5.114.0 — the third bell hums: the shelf's count reaches the rail the
   * same way the other two feeds did — a shared feed from the new factory
   * (createUnreadFeed), a registered consumer, its own channel. Shared
   * truth, no identity: every terminal sees the same shelf. */
  useEffect(() => {
    if (!tenantId) return;
    useStockUnread.getState().ensure(tenantId);
    return () => useStockUnread.getState().release();
  }, [tenantId]);
  const stockLow = useStockUnread((s) => s.value);

  /* v5.111.0 — the rail speaks its changes. One polite live region announces
   * unread deltas for ears that can't watch two badges: skips the state you
   * LOADED with (an announcement of the obvious is noise), waits 1.5s so a
   * burst coalesces into one sentence, and speaks both feeds in one breath
   * ("2 new notifications, 1 new message"; falling to zero reads "All
   * caught up"). Screen-reader-only — the sighted chrome gets the badge pop
   * instead (sp-badge-pop). */
  const [announce, setAnnounce] = useState('');
  const prevUnread = useRef<number | null>(null);
  const prevChat = useRef<number | null>(null);
  const prevStock = useRef<number | null>(null);
  const announceTimer = useRef<number | null>(null);
  useEffect(() => {
    const prevU = prevUnread.current;
    const prevC = prevChat.current;
    const prevS = prevStock.current;
    prevUnread.current = unread;
    prevChat.current = chatUnread;
    prevStock.current = stockLow;
    /* news = a feed moving between KNOWN values. A feed ARRIVING (null → N,
     * the async load catching up) is not news — the live E2E caught the first
     * cut announcing "11 new notifications" on a cold open. Only N → M moves. */
    const isNews = (a: number | null, b: number | null) => a !== null && b !== null && a !== b;
    if (!isNews(prevU, unread) && !isNews(prevC, chatUnread) && !isNews(prevS, stockLow)) return;
    if (announceTimer.current !== null) window.clearTimeout(announceTimer.current);
    announceTimer.current = window.setTimeout(() => {
      announceTimer.current = null;
      const parts: string[] = [];
      if (unread !== null && unread > 0) parts.push(`${unread} new notification${unread === 1 ? '' : 's'}`);
      if (chatUnread !== null && chatUnread > 0) parts.push(`${chatUnread} new message${chatUnread === 1 ? '' : 's'}`);
      /* stock speaks only while it needs ears — a drained count joins the
       * silence unless something else is talking (a restock is good news,
       * and the shelf tab is where good news is read in detail) */
      if (stockLow !== null && stockLow > 0)
        parts.push(`${stockLow} item${stockLow === 1 ? '' : 's'} low or out of stock`);
      setAnnounce(parts.length ? parts.join(', ') : 'All caught up');
    }, 1500);
    return () => {
      if (announceTimer.current !== null) {
        window.clearTimeout(announceTimer.current);
        announceTimer.current = null;
      }
    };
  }, [unread, chatUnread, stockLow]);

  const renderItem = (item: { id: Section; label: string; icon: React.ElementType }) => {
    const active = section === item.id;
    const Icon = item.icon;
    /* three feeds, one badge anatomy: the notifications bell sums its
     * prefs-kept categories; the staff line sums every room's unread (no
     * mute — chat's deliberate 031 silence on the bell makes this pill its
     * only voice); the shelf counts items at or below their reorder point
     * (out included — 5.114.0's grammar rides the aria below). */
    const badge =
      item.id === 'notifications'
        ? unread
        : item.id === 'messages'
          ? chatUnread
          : item.id === 'inventory'
            ? stockLow
            : null;
    const showUnread = badge !== null && badge > 0;
    /* the badge's grammar, per feed: the first two count UNREAD, the shelf
     * counts items LOW OR OUT — a rail that says "Inventory, 3 unread"
     * would be speaking a language the shelf never wrote */
    const badgeWord = item.id === 'inventory' ? 'low' : 'unread';
    const quietWord = item.id === 'inventory' ? 'stock healthy' : 'no unread';
    const ariaLabel =
      badge === null
        ? undefined
        : showUnread
          ? `${item.label}, ${badge > 99 ? '99+' : badge} ${badgeWord}`
          : `${item.label}, ${quietWord}`;
    return (
      <button
        key={item.id}
        onClick={() => goSection(item.id, [item.label])}
        aria-current={active ? 'page' : undefined}
        aria-label={ariaLabel}
        title={item.label}
        className={`sp-nav-pill relative flex w-full items-center justify-center gap-3 rounded-xl px-4 py-2.5 text-[13.5px] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B88E2F]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B2E2F] md:justify-start ${
          active ? 'bg-[#B88E2F] text-white shadow-sm' : 'text-white/70 hover:bg-white/10 hover:text-white'
        }`}
      >
        <Icon size={17} strokeWidth={2} aria-hidden />
        <span className="hidden md:inline">{item.label}</span>
        {showUnread && (
          <span
            aria-hidden
            className={`absolute right-2 top-1 flex h-4.5 min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none tabular-nums shadow-sm ring-2 md:right-2.5 md:top-1/2 md:-translate-y-1/2 ${
              active
                ? 'bg-[#0F3D3E] text-[#F6F1E9] ring-[#F6F1E9]/40'
                : 'bg-[#B88E2F] text-white ring-[#0F3D3E]'
            }`}
          >
            {/* v5.111.0 — the badge pops when news arrives (key = the count:
                a change remounts and replays the one-shot; the standalone
                `scale` property animates without fighting the positioning
                translate on the parent). Stilled under reduced motion. */}
            <span key={badge ?? 0} className="sp-badge-pop inline-flex items-center">
              {badge !== null && badge > 99 ? '99+' : badge}
            </span>
          </span>
        )}
      </button>
    );
  };

  return (
    <aside
      className="sp-scroll-dark flex h-full w-[76px] shrink-0 flex-col overflow-y-auto bg-[#0F3D3E] px-3 pb-4 pt-5 md:w-[228px]"
      aria-label="Primary navigation"
    >
      {/* v5.111.0 — the rail's voice for ears that can't watch the badges. */}
      <span role="status" aria-live="polite" className="sr-only">
        {announce}
      </span>
      {/* Logo */}
      <div className="mb-6 flex items-center justify-center gap-2.5 px-2 md:justify-start">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#F6F1E9] p-1">
          <img src={brandMark} alt="ServePoint logo" className="h-full w-full object-contain" />
        </span>
        <span className="hidden text-[17px] font-semibold text-white md:inline">ServePoint</span>
      </div>

      {/* Primary nav */}
      <nav className="flex flex-col gap-1">{NAV.map(renderItem)}</nav>

      <div className="mx-3 my-4 border-t border-white/12" />

      {/* Others */}
      <p className="mb-1.5 hidden px-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40 md:block">
        Others
      </p>
      <nav className="flex flex-col gap-1">{OTHERS.map(renderItem)}</nav>

      {/* User card */}
      <div className="mt-auto rounded-2xl bg-white/8 p-3 pt-4 text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#D9E2DD] text-lg font-bold text-[#0F3D3E]">
          {initial}
        </span>
        <p className="mt-2.5 hidden text-[13px] font-semibold text-white md:block">{session?.name || 'Signed in'}</p>
        <p className="hidden text-[11px] text-white/55 md:block">{session?.tenantName || 'ServePoint Platform'}</p>
        <button
          onClick={() => useUi.getState().setProfileOpen(true)}
          aria-label="Open Profile"
          className="sp-cta mt-3 flex w-full items-center justify-center rounded-lg py-2 text-[12px]"
        >
          <UserRound size={15} className="md:hidden" aria-hidden />
          <span className="hidden md:inline">Open Profile</span>
        </button>
      </div>

      <p className="mt-3 hidden text-center text-[10px] text-white/40 md:block">© 2026 ServePoint · smartPOS</p>
    </aside>
  );
};
