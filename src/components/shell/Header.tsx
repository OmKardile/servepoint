import React, { useEffect, useMemo, useReducer, useRef } from 'react';
import { ArrowLeft, Bell, Clock3, Search, X } from 'lucide-react';
import { getPrefs, subscribePrefs } from '../../lib/prefs';
import { useTenant } from '../../lib/tenant';
import { useSession, useUi } from '../../store/session';
import { useUnread, sumKeptCategories } from '../../store/unread';

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
 *
 * v5.103.0 — the badge learns the bell's language too: unread rows come
 * back as per-category counts and the badge sums only the categories the
 * owner kept — a muted category stops ringing the header bell. A
 * subscribePrefs tick re-speaks the badge live after a Settings save (the
 * sound gates' discipline: evaluate at render, no reload).
 *
 * v5.104.0 — the plumbing moves out: fetch, realtime and poll now live in
 * the shared unread store (src/store/unread.ts), because the rail's
 * Notifications pill needs the same number and one room needs one feed.
 * The header is a reader — it registers itself, sums what its prefs keep,
 * and speaks the same words it always has.
 *
 * v5.116.0 — the search box learns where it is: for its whole life the
 * shell's "Search current screen" box had exactly ONE consumer (Food &
 * Drinks) — on every other screen it solicited input and swallowed it, a
 * dead control wearing a live label. A screen now REGISTERS its search
 * vocabulary on mount (useUi.searchMeta); the box renders only while a
 * registration stands, speaks that screen's placeholder, clears on Esc
 * or its own X, and the value is wiped the moment no screen honors it.
 * Two doors, one state: a screen with its own search box (Bills) shares
 * the same store field, so the header box and the pane box move
 * together.
 *
 * v5.118.0 — the slash finds its house: "/" now belongs to the shell.
 * One window-level handler (here, not per-screen — exactly one owner per
 * keystroke) walks focus to the header box whenever the current screen
 * has registered one, from anywhere that isn't already a field. A quiet
 * "/" kbd glint sits in the box's corner while it's empty; where no
 * screen honors the box, the key stays honest and quiet. */
export const Header: React.FC = () => {
  const { breadcrumb, setBreadcrumb, goSection, search, setSearch } = useUi();
  const searchMeta = useUi((s) => s.searchMeta);
  const searchRef = useRef<HTMLInputElement | null>(null);
  /* v5.118.0 — "/" finds its house: one keypress walks focus to the header
   * box from anywhere that isn't already a field, whenever the current
   * screen has claimed the box (the Slack grammar, app-wide). Where no
   * screen honors it, the key stays quiet — the verb can't outlive its
   * noun. Lives here, not per-screen, so there is exactly ONE handler
   * and no two screens can race for the same keystroke. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
      if (!useUi.getState().searchMeta) return;
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      e.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  const session = useSession((s) => s.session);
  const { tenantId } = useTenant();

  /* v5.116.0 — no screen honors the box right now: wipe any stale text so
   * the value can't outlive its meaning. */
  useEffect(() => {
    if (!searchMeta && search) setSearch('');
  }, [searchMeta, search, setSearch]);

  const counts = useUnread((s) => s.counts);

  /* prefs change → re-render → the unread memo below re-sums live */
  const [, tickNotify] = useReducer((n: number) => n + 1, 0);
  useEffect(() => subscribePrefs(tickNotify), [tickNotify]);

  /* register as a feed consumer; the store starts, re-points or stops it */
  useEffect(() => {
    if (!tenantId) return;
    useUnread.getState().ensure(tenantId);
    return () => useUnread.getState().release();
  }, [tenantId]);

  const canGoBack = breadcrumb.length > 1;

  /* 5.103.0 — the badge's math: sum the kept categories only. A category
   * the panel doesn't name yet alerts by default; `false` is the only mute.
   * 5.104.0 — the same sum now feeds the rail's pill; one number, two bells. */
  const notify = getPrefs().notify;
  const unread = useMemo(
    () => sumKeptCategories(counts, notify),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [counts, notify]
  );

  const onBack = () => {
    if (canGoBack) setBreadcrumb(breadcrumb.slice(0, -1));
  };

  return (
    <header className="flex h-[62px] shrink-0 items-center gap-4 border-b border-[#E3E7E0] bg-white px-5">
      <button
        onClick={onBack}
        disabled={!canGoBack}
        aria-label="Go back"
        title="Back to the previous screen"
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
        title="Order history — every ticket, paid and pending"
        className="flex h-9 w-9 items-center justify-center rounded-full text-[#1A1A1A] hover:bg-[#F6F5F2]"
      >
        <Clock3 size={18} aria-hidden />
      </button>

      {/* v5.116.0 — the box exists only where a screen honors it; the
          placeholder is that screen's own vocabulary, not a generic lie. */}
      {searchMeta && (
        <div className="relative hidden w-[240px] max-w-[32vw] md:block">
          <Search
            size={15}
            aria-hidden
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#969696]"
          />
          <input
            ref={searchRef}
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setSearch('');
                e.currentTarget.blur();
              }
            }}
            placeholder={searchMeta.placeholder}
            aria-label={`Search current screen — ${searchMeta.placeholder}`}
            title={`${searchMeta.placeholder} — press / to focus, Esc clears`}
            className="sp-input w-full rounded-full py-2 pl-9 pr-8 text-[13px] [&::-webkit-search-cancel-button]:hidden"
          />
          {/* v5.118.0 — the verb, written where the finger lands: a quiet
              kbd glint when the box is empty (the X takes the corner back
              once there is something to clear). */}
          {!search && (
            <kbd
              aria-hidden
              className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md border border-[#E3E7E0] bg-[#F6F5F2] px-1.5 py-0.5 font-sans text-[10px] font-semibold leading-none text-[#969696]"
            >
              /
            </kbd>
          )}
          {search && (
            <button
              onClick={() => setSearch('')}
              aria-label="Clear screen search"
              title="Clear"
              className="absolute right-2 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full text-[#969696] transition hover:bg-[#E3E7E0] hover:text-[#1A1A1A]"
            >
              <X size={12} aria-hidden />
            </button>
          )}
        </div>
      )}
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
