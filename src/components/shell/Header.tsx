import React from 'react';
import { ArrowLeft, Bell, Clock3, Search } from 'lucide-react';
import { useSession, useUi } from '../../store/session';

/** ServePoint header — back + breadcrumbs, bell with gold dot, history clock, search (Figma shell). */
export const Header: React.FC = () => {
  const { breadcrumb, setBreadcrumb, goSection, search, setSearch } = useUi();
  const session = useSession((s) => s.session);

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
        aria-label={`Notifications${session ? '' : ''}`}
        className="relative flex h-9 w-9 items-center justify-center rounded-full text-[#1A1A1A] hover:bg-[#F6F5F2]"
      >
        <Bell size={18} aria-hidden />
        <span aria-hidden className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-[#B88E2F]" />
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
