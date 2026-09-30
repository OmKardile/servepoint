import React, { useState, useRef, useEffect } from 'react';
import { useTsosStore } from '../../lib/store';
import { authService } from '../../lib/authService';
import {
  Printer,
  Volume2,
  VolumeX,
  KeyRound,
  LogOut,
  ChevronDown,
  User,
  Building,
  Sparkles,
  Moon,
  Sun,
  Shield,
} from 'lucide-react';
import { ConnectionStatusIndicator, CloudOfflineBanner } from './ConnectionStatusIndicator';
import { StaffPinPadModal } from '../auth/StaffPinPadModal';
import { getRoleMeta } from '../../lib/rbac';

interface HeaderProps {
  onSignOut?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onSignOut }) => {
  const {
    location,
    setLocation,
    availableLocations,
    currentTenant,
    impersonatedTenant,
    setImpersonatedTenant,
    currentProfile,
    audioEnabled,
    toggleAudio,
    themeMode,
    toggleThemeMode,
    feeConfig,
    printerConfig,
    activeSurface,
    setActiveSurface,
    setActiveWebTab,
  } = useTsosStore();

  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isStaffPinOpen, setIsStaffPinOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const roleMeta = getRoleMeta(currentProfile?.role);
  const isDark = themeMode === 'dark' || themeMode === 'obsidian';
  const isTessera = themeMode === 'tessera';
  const isServepoint = themeMode === 'servepoint';

  // Tessera role avatar palette (status colors tuned for forest)
  const roleAvatarClass =
    currentProfile.role === 'superadmin'
      ? 'bg-[#C084FC] text-[#0A1410]'
      : currentProfile.role === 'owner'
      ? 'bg-[#C5F82A] text-[#0A1410]'
      : currentProfile.role === 'manager'
      ? 'bg-[#60A5FA] text-[#0A1410]'
      : 'bg-[#34D399] text-[#0A1410]';

  const roleAvatarClassWarm =
    currentProfile.role === 'superadmin'
      ? 'bg-purple-600 text-white'
      : currentProfile.role === 'owner'
      ? 'bg-amber-600 text-white'
      : currentProfile.role === 'manager'
      ? 'bg-blue-600 text-white'
      : 'bg-emerald-600 text-white';

  // Close profile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsProfileMenuOpen(false);
      }
    };
    if (isProfileMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isProfileMenuOpen]);

  const handleSignOut = async () => {
    setIsProfileMenuOpen(false);
    await authService.signOut();
    if (onSignOut) {
      onSignOut();
    } else {
      window.location.href = '/login';
    }
  };

  return (
    <>
      <header
        className={`border-b sticky top-0 z-40 ${
          isServepoint
            ? 'bg-[#F6F5F2]/95 backdrop-blur border-[#E3E7E0] shadow-[0_4px_20px_-12px_rgba(15,61,62,0.25)]'
            : isTessera
              ? 'bg-[#0A1410] border-[#1F3D2E]'
              : 'bg-white border-[#E9E0D6] shadow-xs'
        }`}
      >
        {/* SuperAdmin Impersonation Banner */}
        {impersonatedTenant && (
          <div
            className={`px-4 py-1.5 text-xs flex items-center justify-between shadow-sm animate-in fade-in duration-150 ${
              isTessera ? 'bg-[#C084FC]/15 text-[#E9D5FF] border-b border-[#C084FC]/30' : 'bg-[#7C3AED] text-white'
            }`}
          >
            <div className="flex items-center gap-2">
              <Sparkles className={`w-4 h-4 animate-pulse shrink-0 ${isTessera ? 'text-[#C084FC]' : 'text-[#FDE047]'}`} />
              <span>
                ⚡ <strong>SUPERADMIN IMPERSONATION:</strong> Viewing as <strong>{impersonatedTenant.name}</strong> (<code>/{impersonatedTenant.slug}</code>)
              </span>
            </div>
            <button
              onClick={() => {
                setImpersonatedTenant(null);
                setActiveSurface('superadmin');
                window.history.pushState(null, '', '/superadmin');
              }}
              className={`px-3 py-1 rounded-md font-bold transition-all text-xs shadow-xs ${
                isTessera
                  ? 'bg-[#0A1410] text-[#C084FC] border border-[#C084FC]/40 hover:bg-[#C084FC]/10'
                  : 'bg-white text-[#7C3AED] hover:bg-[#F3E8FF]'
              }`}
            >
              Return to SuperAdmin Console
            </button>
          </div>
        )}

        {/* Operational POS Header */}
        <div className="px-4 py-2 bg-inherit flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Left: Brand & Outlet Switcher */}
          <div className="flex items-center gap-3">
            {/* TSOS brand cube — ServePoint amber block (owner Figma) / Tessera chartreuse block */}
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 font-bold ${
                isServepoint
                  ? 'bg-[#B88E2F] text-[#1A1A1A] rounded-lg uppercase tracking-widest text-[11px] shadow-[0_4px_12px_-4px_rgba(184,142,47,0.6)]'
                  : isTessera
                    ? 'bg-[#C5F82A] text-[#0A1410] tessera-block rounded-lg uppercase tracking-widest text-[11px]'
                    : 'bg-[#1C1917] text-white shadow-xs rounded-full'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full animate-pulse ${
                  isServepoint ? 'bg-[#0F3D3E]' : isTessera ? 'bg-[#0A1410]' : 'bg-[#F97316]'
                }`}
              />
              <span className="tracking-wide">TSOS</span>
            </div>

            {/* Outlet Selector */}
            <div className="flex items-center gap-1.5">
              <select
                value={location.id}
                onChange={(e) => {
                  const selected = (availableLocations || []).find((l) => l.id === e.target.value);
                  if (selected) setLocation(selected);
                }}
                aria-label="Switch Outlet"
                className={`rounded-xl px-2.5 py-1 text-xs font-semibold focus:outline-none focus:ring-1 cursor-pointer transition-colors ${
                  isTessera
                    ? 'bg-[#0F1D17] border border-[#2A4A37] text-[#F5F4EE] focus:ring-[#C5F82A] hover:border-[#C5F82A]/50'
                    : isServepoint
                      ? 'bg-[#D9E2DD] border border-[#E3E7E0] text-[#1A1A1A] focus:ring-[#B88E2F] hover:bg-[#E3E7E0]'
                      : 'bg-[#FFF9F2] border border-[#E9E0D6] text-[#1C1917] focus:ring-[#F97316] hover:bg-[#FFF1E6]'
                }`}
              >
                {(availableLocations || [location]).map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    📍 {loc.name}
                  </option>
                ))}
              </select>
            </div>

            <div
              className={`hidden lg:flex items-center gap-2 border-l pl-3 ${
                isServepoint ? 'text-[#6B6B6B] border-[#E3E7E0]' : isTessera ? 'text-[#6B8579] border-[#1F3D2E]' : 'text-[#78716C] border-[#E9E0D6]'
              }`}
            >
              <span>
                Tenant:{' '}
                <strong className={
                  isServepoint
                    ? 'text-[#1A1A1A] font-semibold'
                    : isTessera
                      ? 'text-[#F5F4EE] font-serif italic font-normal text-sm'
                      : 'text-[#1C1917]'
                }>
                  {currentTenant?.name || 'CoolKafe'}
                </strong>
              </span>
              <span className={isServepoint ? 'text-[#969696]' : isTessera ? 'text-[#2A4A37]' : 'text-[#D6D3D1]'}>|</span>
              <span>
                Model:{' '}
                <strong className={isServepoint ? 'text-[#17803D]' : isTessera ? 'text-[#34D399]' : 'text-[#15803D]'}>₹0/mo</strong> +{' '}
                <strong className={isServepoint ? 'text-[#967221]' : isTessera ? 'text-[#C5F82A]' : 'text-[#F97316]'}>₹{feeConfig.per_order_fee}/order</strong>
              </span>
            </div>
          </div>

          {/* Right: Operational Controls & User Profile */}
          <div className="flex items-center gap-2.5">
            {/* Thermal Printer Quick Status */}
            <button
              onClick={() => {
                setActiveSurface('web');
                setActiveWebTab('settings');
              }}
              title="Thermal Printer Status & Receipt Templates"
              className={`flex items-center gap-1 px-2.5 py-1 rounded-xl border text-[11px] font-mono font-medium transition-colors ${
                isTessera
                  ? 'bg-[#0F1D17] border-[#2A4A37] text-[#9BB5A5] hover:border-[#C5F82A]/50 hover:text-[#C5F82A]'
                  : 'bg-[#FFF9F2] border-[#E9E0D6] hover:bg-[#F5F0EB] text-[#57534E]'
              }`}
            >
              <Printer className={`w-3.5 h-3.5 ${isTessera ? 'text-[#C5F82A]' : 'text-[#F97316]'}`} />
              <span>{printerConfig.paper_width}</span>
              <span className={`text-[10px] hidden sm:inline ${isTessera ? 'text-[#6B8579]' : 'text-[#A8A29E]'}`}>
                ({printerConfig.connection_type})
              </span>
            </button>

            {/* Live Cloud Database Sync Status */}
            <ConnectionStatusIndicator />

            {/* Audio Chime Toggle */}
            <button
              onClick={toggleAudio}
              title={audioEnabled ? 'Kitchen & Order Chimes Active' : 'Sound Muted'}
              className={`p-1.5 rounded-xl border transition-colors ${
                isTessera
                  ? 'border-[#2A4A37] bg-[#0F1D17] hover:border-[#C5F82A]/50'
                  : 'border-[#E9E0D6] bg-white text-[#57534E] hover:text-[#1C1917] hover:bg-[#FFF9F2]'
              }`}
            >
              {audioEnabled ? (
                <Volume2 className={`w-3.5 h-3.5 ${isTessera ? 'text-[#34D399]' : 'text-[#16A34A]'}`} />
              ) : (
                <VolumeX className={`w-3.5 h-3.5 ${isTessera ? 'text-[#6B8579]' : 'text-[#A8A29E]'}`} />
              )}
            </button>

            {/* Dark Mode Global Toggle */}
            <button
              type="button"
              onClick={toggleThemeMode}
              title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                isTessera
                  ? 'bg-transparent border-[#2A4A37] text-[#F5F4EE] hover:border-[#C5F82A] hover:text-[#C5F82A]'
                  : isDark
                  ? 'bg-[#27272A] border-[#3F3F46] text-amber-300 hover:bg-[#3F3F46]'
                  : 'bg-white border-[#E9E0D6] text-[#57534E] hover:text-[#1C1917] hover:bg-[#FFF9F2]'
              }`}
            >
              {isDark ? (
                <>
                  <Sun className={`w-3.5 h-3.5 ${isTessera ? 'text-[#C5F82A]' : 'text-amber-400'}`} />
                  <span className={`hidden md:inline font-bold ${isTessera ? 'text-[#F5F4EE]' : 'text-amber-300'}`}>Light Mode</span>
                </>
              ) : (
                <>
                  <Moon className={`w-3.5 h-3.5 ${isTessera ? 'text-[#9BB5A5]' : 'text-slate-700'}`} />
                  <span className={`hidden md:inline font-bold ${isTessera ? 'text-[#F5F4EE]' : 'text-[#1C1917]'}`}>Dark Mode</span>
                </>
              )}
            </button>

            {/* SuperAdmin Platform Console Switch */}
            {currentProfile?.role === 'superadmin' && (
              <button
                type="button"
                onClick={() => setActiveSurface(activeSurface === 'superadmin' ? 'web' : 'superadmin')}
                title="Toggle between Platform Console and Cafe Operations"
                className={`flex items-center gap-1.5 px-3 py-1 rounded-xl font-semibold text-xs transition-all cursor-pointer ${
                  isTessera
                    ? 'bg-[#C084FC]/15 border border-[#C084FC]/40 text-[#C084FC] hover:bg-[#C084FC]/25'
                    : 'bg-purple-600 hover:bg-purple-700 text-white shadow-sm'
                }`}
              >
                <Shield className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">
                  {activeSurface === 'superadmin' ? 'Cafe POS' : 'SuperAdmin'}
                </span>
              </button>
            )}

            {/* Fast PIN Switch Button — ServePoint amber CTA / Tessera chartreuse block */}
            <button
              type="button"
              onClick={() => setIsStaffPinOpen(true)}
              title="Switch Cashier or Barista Shift"
              className={`flex items-center gap-1.5 px-2.5 py-1 font-semibold text-xs transition-all ${
                isServepoint
                  ? 'sp-cta rounded-lg text-[11px]'
                  : isTessera
                    ? 'tessera-cta rounded-lg'
                    : 'bg-[#FFF1E6] hover:bg-[#FFE4D1] text-[#C2410C] border border-[#FDBA74] rounded-xl'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Fast PIN</span>
            </button>

            {/* Authenticated User Profile Dropdown with Role-Specific Visual Identity */}
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                className={`flex items-center gap-2 pl-2 pr-2.5 py-1 rounded-xl border transition-all cursor-pointer ${
                  isTessera
                    ? 'bg-[#0F1D17] border-[#2A4A37] text-[#F5F4EE] hover:border-[#C5F82A]/50'
                    : isDark
                    ? 'bg-stone-900 border-stone-800 text-stone-200 hover:bg-stone-800'
                    : 'bg-[#FFF9F2] border-[#E9E0D6] text-[#1C1917] hover:bg-[#FFF1E6]'
                }`}
              >
                <div className={`w-6 h-6 rounded-lg flex items-center justify-center font-bold text-xs ${
                  isTessera ? roleAvatarClass : roleAvatarClassWarm
                }`}>
                  {currentProfile.name.charAt(0)}
                </div>
                <div className="text-left hidden md:block">
                  <div className="font-bold leading-none text-xs">
                    {currentProfile.name}
                  </div>
                  <div className={`text-[10px] mt-0.5 font-semibold capitalize ${isTessera ? 'text-[#9BB5A5]' : 'opacity-80'}`}>
                    {roleMeta.roleLabel}
                  </div>
                </div>
                <ChevronDown className="w-3.5 h-3.5 opacity-60" />
              </button>

              {/* Profile Dropdown Menu */}
              {isProfileMenuOpen && (
                <div className={`absolute right-0 mt-2 w-64 rounded-2xl border z-50 p-2 text-xs animate-in fade-in slide-in-from-top-2 ${
                  isTessera
                    ? 'bg-[#0F1D17] border-[#2A4A37] text-[#F5F4EE] tessera-block'
                    : isDark
                    ? 'bg-stone-900 border-stone-800 text-stone-200 shadow-xl'
                    : 'bg-white border-[#E9E0D6] text-[#1C1917] shadow-xl'
                }`}>
                  <div className={`p-3 rounded-xl mb-2 border ${
                    isTessera
                      ? 'bg-gradient-to-br from-[#142620] to-[#0F1D17] border-[#2A4A37]'
                      : isDark
                      ? 'bg-stone-800/80 border-stone-700'
                      : 'bg-[#FFF9F2] border-[#E9E0D6]'
                  }`}>
                    <div className={`font-bold text-sm ${isTessera ? 'font-serif italic text-base' : ''}`}>{currentProfile.name}</div>
                    <div className="text-[11px] mt-1 flex items-center gap-1.5">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        isTessera
                          ? 'bg-[#C5F82A]/10 border-[#C5F82A]/40 text-[#C5F82A] uppercase tracking-wider'
                          : isDark ? roleMeta.badgeDarkClass : roleMeta.badgeClass
                      }`}>
                        {roleMeta.roleLabel}
                      </span>
                    </div>
                    <div className={`text-[10px] mt-1.5 truncate ${isTessera ? 'text-[#6B8579]' : 'opacity-60'}`}>
                      Outlet: {location.name}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <button
                      type="button"
                      onClick={() => {
                        setIsProfileMenuOpen(false);
                        setIsStaffPinOpen(true);
                      }}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left transition-colors ${
                        isTessera
                          ? 'text-[#F5F4EE] hover:bg-[#142620] hover:text-[#C5F82A]'
                          : 'hover:bg-[#FFF1E6] text-[#1C1917]'
                      }`}
                    >
                      <KeyRound className={`w-4 h-4 ${isTessera ? 'text-[#C5F82A]' : 'text-[#F97316]'}`} />
                      <div className="flex-1">
                        <div className="font-semibold">Switch Staff PIN</div>
                        <div className={`text-[10px] ${isTessera ? 'text-[#6B8579]' : 'text-[#78716C]'}`}>Change cashier for shifts</div>
                      </div>
                    </button>

                    <div className={`border-t my-1 ${isTessera ? 'border-[#1F3D2E]' : 'border-[#E9E0D6]'}`} />

                    <button
                      type="button"
                      onClick={handleSignOut}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left transition-colors font-semibold ${
                        isTessera
                          ? 'text-[#F87171] hover:bg-[#F87171]/10'
                          : 'text-rose-600 hover:bg-rose-50'
                      }`}
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Persistent Cloud Offline Warning Banner */}
        <CloudOfflineBanner />
      </header>

      {/* Staff Fast PIN Switch Modal */}
      <StaffPinPadModal
        isOpen={isStaffPinOpen}
        onClose={() => setIsStaffPinOpen(false)}
      />
    </>
  );
};
