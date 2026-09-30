/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useTsosStore } from './lib/store';
import { authService, AuthUserSession } from './lib/authService';
import { realtimeService } from './lib/realtimeService';
import { playChime, play880HzChime } from './lib/sound';

import { Header } from './components/common/Header';
import { WebNavbar } from './components/common/WebNavbar';
import { PosScreen } from './components/pos/PosScreen';
import { KdsScreen } from './components/kds/KdsScreen';
import { OrdersScreen } from './components/orders/OrdersScreen';
import { InventoryScreen } from './components/inventory/InventoryScreen';
import { MenuScreen } from './components/menu/MenuScreen';
import { TablesScreen } from './components/tables/TablesScreen';
import { CustomersScreen } from './components/customers/CustomersScreen';
import { OffersScreen } from './components/offers/OffersScreen';
import { ReportsScreen } from './components/reports/ReportsScreen';
import { ShiftsScreen } from './components/shifts/ShiftsScreen';
import { SettingsScreen } from './components/settings/SettingsScreen';
import { StorefrontScreen } from './components/storefront/StorefrontScreen';
import { OrderTrackingScreen } from './components/storefront/OrderTrackingScreen';
import { SuperAdminScreen } from './components/superadmin/SuperAdminScreen';
import { AuthScreen } from './components/auth/AuthScreen';
import { CafeOnboardingWizard } from './components/auth/CafeOnboardingWizard';
import { StaffPinPadModal } from './components/auth/StaffPinPadModal';
import { AccessDeniedNotice } from './components/common/AccessDeniedNotice';
import { canAccessTab } from './lib/rbac';
import { WebTab } from './types';

export default function App() {
  const {
    activeSurface,
    setActiveSurface,
    activeWebTab,
    setActiveWebTab,
    currentTenant,
    switchTenantScope,
    loadMenuFromCloud,
    tables,
    setSelectedTableId,
    setTrackedOrderId,
    upsertOrderFromRealtime,
    setCurrentProfile,
    currentProfile,
    audioEnabled,
    themeMode,
  } = useTsosStore();

  // Authentication & Modals State
  const [authSession, setAuthSession] = useState<AuthUserSession | null>(null);
  const [isOverridePinOpen, setIsOverridePinOpen] = useState(false);

  // Sync theme mode to document element
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Tessera is its own editorial-dark forest/chartreuse theme.
      // dark/obsidian map to the zinc dark layer. warm is the original cream light theme.
      document.documentElement.setAttribute('data-theme', themeMode);
      document.documentElement.classList.remove('dark', 'obsidian', 'tessera');
      if (themeMode === 'dark' || themeMode === 'obsidian') {
        document.documentElement.classList.add('dark', 'obsidian');
      } else if (themeMode === 'tessera') {
        document.documentElement.classList.add('tessera');
      }
    }
  }, [themeMode]);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState<boolean>(false);

  // Check auth session on startup
  useEffect(() => {
    const checkSession = async () => {
      try {
        const session = await authService.getSession();
        if (session) {
          setAuthSession(session);
          setCurrentProfile({
            name: session.name,
            role: session.role,
          });
          if (session.role === 'superadmin') {
            const pathname = window.location.pathname.toLowerCase();
            if (pathname === '/superadmin' || pathname === '/' || pathname === '') {
              setActiveSurface('superadmin');
            } else if (session.tenantSlug) {
              switchTenantScope(session.tenantSlug);
            }
          } else if (session.tenantSlug) {
            switchTenantScope(session.tenantSlug);
          }
        }
      } catch (err) {
        console.warn('Auth check error:', err);
      } finally {
        setIsAuthLoading(false);
      }
    };

    checkSession();
  }, []);

  // Determine if the current URL route is public (e.g. Diner Table QR ordering or Order Tracking)
  const isPublicRoute = () => {
    if (typeof window === 'undefined') return false;
    const pathname = window.location.pathname.toLowerCase();
    return (
      pathname.includes('/t/') ||
      pathname.includes('/t1') ||
      pathname.includes('/t2') ||
      pathname.includes('/t3') ||
      pathname.includes('/t4') ||
      pathname.includes('/t5') ||
      pathname.includes('/t6') ||
      pathname.includes('/t7') ||
      pathname.includes('/t8') ||
      pathname.includes('/t9') ||
      pathname.includes('/table/') ||
      pathname.includes('/track/')
    );
  };

  // Dynamic Path-Based Tenant Scoping & Dedicated URL Routing
  useEffect(() => {
    const handleUrlRoute = () => {
      const pathname = window.location.pathname.replace(/^\/|\/$/g, '');
      const segments = pathname.split('/').filter(Boolean);

      if (segments.length === 0) return;

      const first = segments[0]?.toLowerCase();
      const second = segments[1]?.toLowerCase();

      // Route: /superadmin
      if (first === 'superadmin') {
        setActiveSurface('superadmin');
        return;
      }

      // Route: /track/:orderId
      if (first === 'track' && second) {
        setTrackedOrderId(second);
        setActiveSurface('order_track');
        return;
      }

      // Route: /pos, /kds, /admin, etc.
      if (['pos', 'kds', 'orders', 'inventory', 'menu', 'tables', 'customers', 'offers', 'shifts', 'reports', 'settings'].includes(first)) {
        setActiveSurface('web');
        setActiveWebTab(first as WebTab);
        return;
      }

      // Route: /table/:slug/:tableNumber
      if (first === 'table' && second) {
        setActiveSurface('storefront');
        const third = segments[2]?.toLowerCase() || '1';
        const digits = third.replace(/[^0-9]/g, '');
        const matchTable = tables.find((t) => t.label.replace(/[^0-9]/g, '') === digits);
        if (matchTable) setSelectedTableId(matchTable.id);
        switchTenantScope(second);
        return;
      }

      // Route: /:slug/...
      const isTenantSwitched = switchTenantScope(first);
      if (isTenantSwitched || first === 'coolkafe') {
        if (!second || second === 'pos') {
          setActiveSurface('web');
          setActiveWebTab('pos');
        } else if (['pos', 'kds', 'orders', 'inventory', 'menu', 'tables', 'customers', 'offers', 'shifts', 'reports', 'settings'].includes(second)) {
          setActiveSurface('web');
          setActiveWebTab(second as WebTab);
        } else if (second.startsWith('t') || second.startsWith('table')) {
          setActiveSurface('storefront');
          const digits = second.replace(/[^0-9]/g, '');
          const matchTable = tables.find((t) => t.label.replace(/[^0-9]/g, '') === digits);
          if (matchTable) setSelectedTableId(matchTable.id);
        }
      }
    };

    handleUrlRoute();
    window.addEventListener('popstate', handleUrlRoute);
    return () => window.removeEventListener('popstate', handleUrlRoute);
  }, [tables, isAuthLoading]);

  // Sync internal state back to browser URL
  useEffect(() => {
    if (isAuthLoading) return;
    const currentSlug = currentTenant?.slug || 'coolkafe';
    let targetPath = window.location.pathname;

    if (activeSurface === 'superadmin') {
      targetPath = '/superadmin';
    } else if (activeSurface === 'web') {
      targetPath = `/${currentSlug}/${activeWebTab}`;
    } else if (activeSurface === 'storefront') {
      targetPath = `/${currentSlug}/t1`;
    } else if (activeSurface === 'order_track') {
      targetPath = '/track/live';
    }

    if (window.location.pathname !== targetPath) {
      window.history.replaceState(null, '', targetPath);
    }
  }, [activeSurface, activeWebTab, currentTenant, isAuthLoading]);

  // Live Supabase Real-Time Postgres Changes Subscription
  useEffect(() => {
    const tenantId = currentTenant?.id || 'biz_coolkafe_99';
    const unsubscribe = realtimeService.subscribeToTenantRealtime(tenantId, {
      onOrderInserted: (newOrder) => {
        upsertOrderFromRealtime(newOrder);
        if (audioEnabled) {
          play880HzChime();
        }
      },
      onOrderUpdated: (updatedOrder) => {
        upsertOrderFromRealtime(updatedOrder);
        if (audioEnabled) {
          playChime('ready');
        }
      },
    });

    return () => {
      unsubscribe();
    };
  }, [currentTenant?.id, audioEnabled]);

  // Cloud menu hydration — fetch categories + menu_items from Supabase for the
  // active tenant. Falls back to the local seed menu when empty or unavailable.
  useEffect(() => {
    if (currentTenant?.id) {
      loadMenuFromCloud();
    }
  }, [currentTenant?.id, loadMenuFromCloud]);

  const handleAuthSuccess = (session: AuthUserSession, isNewUser?: boolean) => {
    setAuthSession(session);
    setCurrentProfile({
      name: session.name,
      role: session.role,
    });
    if (isNewUser) {
      setIsOnboardingOpen(true);
    } else if (session.role === 'superadmin') {
      setActiveSurface('superadmin');
    } else if (session.tenantSlug) {
      switchTenantScope(session.tenantSlug);
      setActiveSurface('web');
      setActiveWebTab('pos');
    }
  };

  const handleSignOut = () => {
    setAuthSession(null);
    setActiveSurface('web');
    setActiveWebTab('pos');
  };

  // Loading indicator while authenticating (Tessera forest palette by default)
  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-[#0A1410] flex items-center justify-center">
        <div className="flex items-center gap-2 text-sm font-semibold text-[#9BB5A5]">
          <span className="w-2.5 h-2.5 rounded-full bg-[#C5F82A] animate-pulse" />
          <span>Starting TSOS Cloud Engine...</span>
        </div>
      </div>
    );
  }

  // Auth Guard: If unauthenticated and not on a public route, show AuthScreen
  if (!authSession && !isPublicRoute()) {
    return (
      <>
        <AuthScreen
          onSuccess={handleAuthSuccess}
          onOpenOnboarding={() => setIsOnboardingOpen(true)}
        />
        <CafeOnboardingWizard
          isOpen={isOnboardingOpen}
          initialOwnerEmail=""
          initialOwnerName=""
          onClose={() => setIsOnboardingOpen(false)}
          onSuccess={(newSlug) => {
            switchTenantScope(newSlug);
            setActiveSurface('web');
            setActiveWebTab('pos');
          }}
        />
      </>
    );
  }

  // SuperAdmin Surface
  if (activeSurface === 'superadmin') {
    return (
      <>
        <Header onSignOut={handleSignOut} />
        <SuperAdminScreen />
      </>
    );
  }

  // Public Customer QR Storefront (Table Ordering)
  if (activeSurface === 'storefront') {
    return (
      <main className="min-h-screen bg-[#FFF9F2] flex flex-col min-h-0 overflow-y-auto">
        <StorefrontScreen />
      </main>
    );
  }

  // Public Order Tracking Screen
  if (activeSurface === 'order_track') {
    return (
      <main className="min-h-screen bg-[#FFF9F2] flex flex-col min-h-0 overflow-y-auto">
        <OrderTrackingScreen />
      </main>
    );
  }

  // Primary Operational Web POS, KDS & Backoffice
  const renderWebContent = () => {
    // RBAC Security Guard: Verify if active user profile has permission for requested tab
    if (!canAccessTab(currentProfile?.role, activeWebTab)) {
      return (
        <AccessDeniedNotice
          attemptedTab={activeWebTab}
          onOpenPinModal={() => setIsOverridePinOpen(true)}
        />
      );
    }

    switch (activeWebTab) {
      case 'pos':
        return <PosScreen />;
      case 'kds':
        return <KdsScreen />;
      case 'orders':
        return <OrdersScreen />;
      case 'inventory':
        return <InventoryScreen />;
      case 'menu':
        return <MenuScreen />;
      case 'tables':
        return <TablesScreen />;
      case 'customers':
        return <CustomersScreen />;
      case 'offers':
        return <OffersScreen />;
      case 'shifts':
        return <ShiftsScreen />;
      case 'reports':
        return <ReportsScreen />;
      case 'settings':
        return <SettingsScreen />;
      default:
        return <PosScreen />;
    }
  };

  const isDarkTheme = themeMode === 'dark' || themeMode === 'obsidian' || themeMode === 'tessera';

  return (
    <div
      className={`min-h-screen ${
        themeMode === 'tessera'
          ? 'bg-[#0A1410] text-[#F5F4EE] tessera-grain'
          : isDarkTheme
          ? 'bg-[#09090B] text-[#F4F4F5]'
          : 'bg-[#FFF9F2] text-[#1C1917]'
      } flex flex-col font-sans transition-colors duration-200`}
    >
      <Header onSignOut={handleSignOut} />

      <div className="flex-1 flex flex-col min-h-0">
        <WebNavbar />
        <main className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {renderWebContent()}
        </main>
      </div>

      {/* Cafe Onboarding Wizard Modal */}
      <CafeOnboardingWizard
        isOpen={isOnboardingOpen}
        initialOwnerEmail={authSession?.email || ''}
        initialOwnerName={authSession?.name || ''}
        onClose={() => setIsOnboardingOpen(false)}
        onSuccess={(newSlug) => {
          switchTenantScope(newSlug);
          setActiveSurface('web');
          setActiveWebTab('pos');
        }}
      />

      {/* Manager Override PIN Modal */}
      <StaffPinPadModal
        isOpen={isOverridePinOpen}
        onClose={() => setIsOverridePinOpen(false)}
      />
    </div>
  );
}
