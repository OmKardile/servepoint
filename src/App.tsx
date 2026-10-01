/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
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
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);

  // Sync theme mode to document element
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // While UNAUTHENTICATED (auth loading, login screen, public storefront/track
      // routes) the document is FORCE-PINNED to Tessera: the owner froze the login
      // screen UI exactly as approved (ADR-0010). The ServePoint theme
      // (owner-mandated via the ServePoint POS Figma, ADR-0011) applies to the
      // authenticated app only.
      const forceTessera = !authSession || isAuthLoading;
      const effective = forceTessera ? 'tessera' : themeMode;
      document.documentElement.setAttribute('data-theme', effective);
      document.documentElement.classList.remove('dark', 'obsidian', 'tessera');
      if (effective === 'dark' || effective === 'obsidian') {
        document.documentElement.classList.add('dark', 'obsidian');
      } else if (effective === 'tessera') {
        document.documentElement.classList.add('tessera');
      }
    }
  }, [themeMode, authSession, isAuthLoading]);

  // Check auth session on startup
  // v4.0.0: superadmin (TSOS developer) ALWAYS lands on the SuperAdmin Platform —
  // never the cafe POS, regardless of the last URL (fixes "superadmin gets POS screen").
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
            setActiveSurface('superadmin');
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
  // v2.8.1 fix: route handling now runs ONCE at boot (after tables hydrate so QR
  // deep-links can match their table) and on popstate only. Re-running on every
  // tables change re-processed the current URL mid-session and clobbered the
  // just-placed order's navigation (order_track → storefront) + tracked id.
  const handleUrlRoute = () => {
      // v4.0.0: the SuperAdmin (developer) session is platform-only — URL routes to
      // cafe surfaces are ignored unless they explicitly Switch to Cafe View.
      if (authSessionRef.current?.role === 'superadmin') return;

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

  const bootRouteRef = useRef({ done: false });
  const routeRef = useRef<() => void>(() => {});
  const authSessionRef = useRef<AuthUserSession | null>(null);
  authSessionRef.current = authSession;
  routeRef.current = handleUrlRoute;

  useEffect(() => {
    if (bootRouteRef.current.done) return;
    if (isAuthLoading) return;
    if (tables.length === 0) return; // wait for hydration so deep-links match tables
    bootRouteRef.current.done = true;
    handleUrlRoute();
  }, [tables, isAuthLoading]);

  useEffect(() => {
    const onPopState = () => routeRef.current();
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

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

  // v4.0.0: no self-serve signup remains — isNewUser/onboarding path retired.
  // superadmin → platform; owner/staff → their cafe workspace (POS landing).
  const handleAuthSuccess = (session: AuthUserSession) => {
    setAuthSession(session);
    setCurrentProfile({
      name: session.name,
      role: session.role,
    });
    if (session.role === 'superadmin') {
      setActiveSurface('superadmin');
    } else if (session.tenantSlug) {
      switchTenantScope(session.tenantSlug);
    }
    setActiveSurface(session.role === 'superadmin' ? 'superadmin' : 'web');
    if (session.role !== 'superadmin') setActiveWebTab('pos');
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
  // v4.0.0: Register-Cafe self-serve + onboarding wizard removed — accounts are
  // provisioned by the SuperAdmin (developer) wizard or the cafe Owner.
  if (!authSession && !isPublicRoute()) {
    return <AuthScreen onSuccess={handleAuthSuccess} />;
  }

  // SuperAdmin Surface
  if (activeSurface === 'superadmin') {
    return (
      <>
        <Header onSignOut={handleSignOut} />
        <SuperAdminScreen onSignOut={handleSignOut} />
      </>
    );
  }

  // Public Customer QR Storefront (Table Ordering)
  // v2.8.1 — canvas follows the active theme (ServePoint ivory vs warm legacy)
  if (activeSurface === 'storefront') {
    return (
      <main className={`min-h-screen flex flex-col min-h-0 overflow-y-auto ${themeMode === 'servepoint' ? 'bg-[#F6F5F2]' : 'bg-[#FFF9F2]'}`}>
        <StorefrontScreen />
      </main>
    );
  }

  // Public Order Tracking Screen
  if (activeSurface === 'order_track') {
    return (
      <main className={`min-h-screen flex flex-col min-h-0 overflow-y-auto ${themeMode === 'servepoint' ? 'bg-[#F6F5F2]' : 'bg-[#FFF9F2]'}`}>
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

      {/* Manager Override PIN Modal */}
      <StaffPinPadModal
        isOpen={isOverridePinOpen}
        onClose={() => setIsOverridePinOpen(false)}
      />
    </div>
  );
}
