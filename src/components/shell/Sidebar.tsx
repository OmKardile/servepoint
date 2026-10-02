import React from 'react';
import {
  Armchair,
  Bell,
  BookOpenText,
  ChefHat,
  CookingPot,
  Headphones,
  LayoutGrid,
  MoonStar,
  BarChart3,
  Package,
  Receipt,
  Settings as SettingsIcon,
  UserRound,
} from 'lucide-react';
import { useSession, useUi, type Section } from '../../store/session';
import brandMark from '../../assets/brand/mark.png';

const NAV: { id: Section; label: string; icon: React.ElementType }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutGrid },
  { id: 'food', label: 'Food & Drinks', icon: CookingPot },
  { id: 'kitchen', label: 'Kitchen', icon: ChefHat },
  { id: 'bills', label: 'Bills', icon: Receipt },
  { id: 'eod', label: 'Close-out', icon: MoonStar },
  { id: 'reports', label: 'Reports', icon: BarChart3 },
  { id: 'inventory', label: 'Inventory', icon: Package },
  { id: 'floor', label: 'Floor', icon: Armchair },
  { id: 'menu', label: 'Menu', icon: BookOpenText },
  { id: 'settings', label: 'Settings', icon: SettingsIcon },
];

const OTHERS: { id: Section; label: string; icon: React.ElementType }[] = [
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'support', label: 'Support', icon: Headphones },
];

interface Props {
  unreadCount?: number;
}

/** ServePoint sidebar — dark teal rail, gold active pill, user card (Figma shell frames). */
export const Sidebar: React.FC<Props> = ({ unreadCount = 0 }) => {
  const { section, goSection } = useUi();
  const session = useSession((s) => s.session);
  const initial = (session?.name || 'S').charAt(0).toUpperCase();

  const renderItem = (item: { id: Section; label: string; icon: React.ElementType }) => {
    const active = section === item.id;
    const Icon = item.icon;
    return (
      <button
        key={item.id}
        onClick={() => goSection(item.id, [item.label])}
        aria-current={active ? 'page' : undefined}
        title={item.label}
        className={`sp-nav-pill relative flex w-full items-center justify-center gap-3 rounded-xl px-4 py-2.5 text-[13.5px] font-medium md:justify-start ${
          active ? 'bg-[#B88E2F] text-white shadow-sm' : 'text-white/70 hover:bg-white/10 hover:text-white'
        }`}
      >
        <Icon size={17} strokeWidth={2} aria-hidden />
        <span className="hidden md:inline">{item.label}</span>
        {item.id === 'notifications' && unreadCount > 0 && (
          <span className="absolute right-2 top-1 md:right-3 md:top-1/2 md:-translate-y-1/2 flex h-4.5 min-w-[18px] items-center justify-center rounded-full bg-[#B88E2F] px-1 text-[10px] font-bold text-white">
            {unreadCount}
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
      {/* Logo */}
      <div className="mb-6 flex items-center justify-center gap-2.5 px-2 md:justify-start">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#D9E2DD] p-1">
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
