import React, { useState, useRef, useEffect } from 'react';
import { useTsosStore } from '../../lib/store';
import { WebTab } from '../../types';
import { canAccessTab } from '../../lib/rbac';
import {
  ShoppingBag,
  ChefHat,
  Receipt,
  UtensilsCrossed,
  Boxes,
  Grid,
  Users,
  Tag,
  BarChart3,
  Sliders,
  ChevronDown,
  AlertTriangle,
  Clock,
} from 'lucide-react';

export const WebNavbar: React.FC = () => {
  const { activeWebTab, setActiveWebTab, orders, ingredients, shifts, currentProfile, themeMode } = useTsosStore();
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const isTessera = themeMode === 'tessera';

  // Active kitchen orders (new or preparing)
  const activeKdsCount = orders.filter(
    (o) => o.status === 'new' || o.status === 'preparing'
  ).length;

  // Active staff clocked in
  const activeStaffCount = shifts.filter((s) => s.status === 'active').length;

  // Low stock ingredients count
  const lowStockCount = ingredients.filter(
    (i) => i.stock_qty <= i.low_stock_threshold
  ).length;

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(event.target as Node)) {
        setIsMoreOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const allPrimaryTabs: { id: WebTab; label: string; icon: React.ReactNode; badge?: number; badgeColor?: string; tesseraBadge?: string }[] = [
    { id: 'pos', label: 'New Sale (POS)', icon: <ShoppingBag className="w-4 h-4" /> },
    { id: 'tables', label: 'Dine-in Tables', icon: <Grid className="w-4 h-4" /> },
    { id: 'orders', label: 'Orders', icon: <Receipt className="w-4 h-4" /> },
    { id: 'kds', label: 'KDS (Kitchen)', icon: <ChefHat className="w-4 h-4" />, badge: activeKdsCount, badgeColor: 'bg-[#F97316]', tesseraBadge: 'bg-[#FBBF24]/15 text-[#FBBF24] border border-[#FBBF24]/40' },
    { id: 'shifts', label: 'Staff & Shifts', icon: <Clock className="w-4 h-4" />, badge: activeStaffCount, badgeColor: 'bg-[#17803D]', tesseraBadge: 'bg-[#34D399]/15 text-[#34D399] border border-[#34D399]/40' },
    { id: 'inventory', label: 'Stock & Recipes', icon: <Boxes className="w-4 h-4" />, badge: lowStockCount, badgeColor: 'bg-[#B42318]', tesseraBadge: 'bg-[#F87171]/15 text-[#F87171] border border-[#F87171]/40' },
  ];

  const allMoreTabs: { id: WebTab; label: string; icon: React.ReactNode; desc: string }[] = [
    { id: 'menu', label: 'Menu & Variants', icon: <UtensilsCrossed className="w-4 h-4" />, desc: 'Categories, pricing, veg/non-veg' },
    { id: 'customers', label: 'Customers & Loyalty', icon: <Users className="w-4 h-4" />, desc: 'Points ledger (1 pt per ₹10)' },
    { id: 'offers', label: 'Offers & Promos', icon: <Tag className="w-4 h-4" />, desc: 'Flat, percent & BOGO discounts' },
    { id: 'reports', label: 'Reports & Analytics', icon: <BarChart3 className="w-4 h-4" />, desc: 'Daily sales, top items, margins' },
    { id: 'settings', label: 'Settings & Fee Engine', icon: <Sliders className="w-4 h-4" />, desc: 'Per-order fee, auto-flip rules' },
  ];

  // Filter tabs dynamically based on logged-in user's role
  const visiblePrimaryTabs = allPrimaryTabs.filter((t) => canAccessTab(currentProfile?.role, t.id));
  const visibleMoreTabs = allMoreTabs.filter((t) => canAccessTab(currentProfile?.role, t.id));

  const isMoreActive = visibleMoreTabs.some((t) => t.id === activeWebTab);

  return (
    <nav
      className={`border-b px-4 py-2 flex items-center justify-between ${
        isTessera ? 'bg-[#0A1410] border-[#1F3D2E]' : 'bg-white border-[#E9E0D6]'
      }`}
    >
      <div className="flex items-center gap-1.5 flex-wrap">
        {visiblePrimaryTabs.map((tab) => {
          const isActive = activeWebTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveWebTab(tab.id)}
              className={`relative flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm transition-all ${
                isTessera
                  ? isActive
                    ? 'bg-[#C5F82A]/15 text-[#C5F82A] font-semibold border border-[#C5F82A]/35 shadow-[inset_0_1px_0_rgba(197,248,42,0.12)]'
                    : 'text-[#9BB5A5] font-medium border border-transparent hover:text-[#F5F4EE] hover:bg-[#142620] hover:border-[#2A4A37]'
                  : isActive
                  ? 'bg-[#FFF1E6] text-[#F97316] font-semibold border border-[#F97316]/20'
                  : 'text-[#57534E] hover:bg-[#F5F0EB] hover:text-[#1C1917]'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {tab.badge !== undefined && tab.badge > 0 && (
                <span
                  className={`text-[11px] font-bold px-1.5 py-0.2 rounded-full ${
                    isTessera && 'tesseraBadge' in tab ? tab.tesseraBadge : `text-white ${tab.badgeColor}`
                  }`}
                >
                  {tab.badge}
                </span>
              )}
              {/* Tessera signature: chartreuse baseline marker under the active tab */}
              {isTessera && isActive && (
                <span className="absolute left-3 right-3 -bottom-[9px] h-[2px] bg-[#C5F82A] rounded-full" aria-hidden="true" />
              )}
            </button>
          );
        })}

        {/* More Dropdown - Only shown if role has accessible sub-tabs */}
        {visibleMoreTabs.length > 0 && (
          <div className="relative" ref={moreRef}>
            <button
              onClick={() => setIsMoreOpen(!isMoreOpen)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm transition-all ${
                isTessera
                  ? isMoreActive
                    ? 'bg-[#C5F82A]/15 text-[#C5F82A] font-semibold border border-[#C5F82A]/35'
                    : 'text-[#9BB5A5] font-medium border border-transparent hover:text-[#F5F4EE] hover:bg-[#142620] hover:border-[#2A4A37]'
                  : isMoreActive
                  ? 'bg-[#FFF1E6] text-[#F97316] font-semibold border border-[#F97316]/20'
                  : 'text-[#57534E] hover:bg-[#F5F0EB] hover:text-[#1C1917]'
              }`}
            >
              <span>More</span>
              {isMoreActive && (
                <span className={`text-xs font-normal ${isTessera ? 'text-[#C5F82A]/80' : 'text-[#F97316]'}`}>
                  ({visibleMoreTabs.find((t) => t.id === activeWebTab)?.label})
                </span>
              )}
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform ${
                  isMoreOpen
                    ? isTessera ? 'rotate-180 text-[#C5F82A]' : 'rotate-180 text-[#F97316]'
                    : isTessera ? 'text-[#6B8579]' : 'text-[#A8A29E]'
                }`}
              />
            </button>

            {isMoreOpen && (
              <div
                className={`absolute left-0 mt-1.5 w-64 border rounded-xl py-1.5 z-50 animate-in fade-in slide-in-from-top-1 duration-150 ${
                  isTessera
                    ? 'bg-[#0F1D17] border-[#2A4A37] tessera-block'
                    : 'bg-white border-[#E9E0D6] shadow-lg'
                }`}
              >
                <div
                  className={`px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider border-b ${
                    isTessera ? 'text-[#6B8579] border-[#1F3D2E]' : 'text-[#A8A29E] border-[#F5F0EB]'
                  }`}
                >
                  Cafe Management
                </div>
                {visibleMoreTabs.map((tab) => {
                  const isActive = activeWebTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => {
                        setActiveWebTab(tab.id);
                        setIsMoreOpen(false);
                      }}
                      className={`w-full flex items-start gap-2.5 px-3 py-2 text-left text-sm transition-colors ${
                        isTessera
                          ? isActive
                            ? 'bg-[#C5F82A]/10 text-[#C5F82A]'
                            : 'text-[#F5F4EE] hover:bg-[#142620]'
                          : isActive
                          ? 'bg-[#FFF1E6] text-[#F97316]'
                          : 'text-[#1C1917] hover:bg-[#F5F0EB]'
                      }`}
                    >
                      <span className={`mt-0.5 ${isActive ? (isTessera ? 'text-[#C5F82A]' : 'text-[#F97316]') : isTessera ? 'text-[#9BB5A5]' : 'text-[#57534E]'}`}>
                        {tab.icon}
                      </span>
                      <div>
                        <div className="font-medium text-xs leading-tight">{tab.label}</div>
                        <div className={`text-[11px] ${isTessera ? 'text-[#6B8579]' : 'text-[#A8A29E]'}`}>{tab.desc}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {canAccessTab(currentProfile?.role, 'inventory') && lowStockCount > 0 && (
        <button
          onClick={() => setActiveWebTab('inventory')}
          className={`hidden md:flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors ${
            isTessera
              ? 'bg-[#F87171]/10 border-[#F87171]/35 text-[#F87171] hover:bg-[#F87171]/20'
              : 'bg-[#FEF2F2] border-[#FCA5A5] text-[#B42318] hover:bg-[#FEE2E2]'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>{lowStockCount} items low in stock</span>
        </button>
      )}
    </nav>
  );
};
