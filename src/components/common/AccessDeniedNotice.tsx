import React from 'react';
import { ShieldAlert, ArrowLeft, KeyRound } from 'lucide-react';
import { useTsosStore } from '../../lib/store';
import { getRoleMeta } from '../../lib/rbac';
import { WebTab } from '../../types';

interface AccessDeniedNoticeProps {
  attemptedTab?: WebTab;
  onOpenPinModal?: () => void;
}

const TAB_NAMES: Record<WebTab, string> = {
  pos: 'New Sale (POS)',
  kds: 'Kitchen Display System',
  orders: 'Orders Directory',
  menu: 'Menu & Variants',
  inventory: 'Stock & Recipes',
  tables: 'Dine-in Tables',
  customers: 'Customers & Loyalty',
  offers: 'Offers & Promos',
  shifts: 'Staff & Shifts',
  reports: 'Reports & Financial Analytics',
  settings: 'Settings & Fee Engine',
};

export const AccessDeniedNotice: React.FC<AccessDeniedNoticeProps> = ({
  attemptedTab = 'reports',
  onOpenPinModal,
}) => {
  const { currentProfile, setActiveWebTab, themeMode, currentTenant } = useTsosStore();
  const roleMeta = getRoleMeta(currentProfile.role);
  const isDark = themeMode === 'dark' || themeMode === 'obsidian';

  const handleReturnToPos = () => {
    setActiveWebTab('pos');
    if (typeof window !== 'undefined') {
      const slug = currentTenant?.slug || 'coolkafe';
      window.history.replaceState(null, '', `/${slug}/pos`);
    }
  };

  return (
    <div className={`min-h-[70vh] flex items-center justify-center p-6 ${isDark ? 'bg-[#09090B]' : 'bg-[#FFF9F2]'}`}>
      <div className={`max-w-md w-full p-8 rounded-3xl border shadow-xl text-center animate-in fade-in zoom-in-95 duration-200 ${
        isDark 
          ? 'bg-[#18181B] border-[#27272A] text-zinc-100' 
          : 'bg-white border-[#E9E0D6] text-[#1C1917]'
      }`}>
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center mx-auto mb-4">
          <ShieldAlert className="w-8 h-8" />
        </div>

        <h2 className="text-xl font-bold tracking-tight mb-2">
          Access Restricted
        </h2>

        <p className={`text-sm mb-6 ${isDark ? 'text-zinc-400' : 'text-[#78716C]'}`}>
          Your current active profile is logged in as{' '}
          <span className="font-semibold text-amber-500">{roleMeta.roleLabel}</span>. 
          Access to <span className="font-semibold underline">{TAB_NAMES[attemptedTab] || attemptedTab}</span> requires Manager or Owner privileges.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            type="button"
            onClick={handleReturnToPos}
            className={`w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm transition-all ${
              isDark
                ? 'bg-[#27272A] hover:bg-[#3F3F46] text-zinc-200 border border-[#3F3F46]'
                : 'bg-[#F5F0EB] hover:bg-[#EFE8E1] text-[#57534E]'
            }`}
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to POS</span>
          </button>

          {onOpenPinModal && (
            <button
              type="button"
              onClick={onOpenPinModal}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm bg-[#F97316] hover:bg-[#EA580C] text-white shadow-md transition-all cursor-pointer"
            >
              <KeyRound className="w-4 h-4" />
              <span>Manager Override</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
