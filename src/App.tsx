import React, { useEffect, useState } from 'react';
import { authService } from './lib/authService';
import { normalizeRole } from './lib/rbac';
import { useTenant } from './lib/tenant';
import { useSession, useUi } from './store/session';
import { AuthScreen } from './components/auth/AuthScreen';
import { AppShell } from './components/shell/AppShell';
import { NoWorkspaceScreen } from './components/shell/NoWorkspaceScreen';
import { DashboardScreen } from './components/dashboard/DashboardScreen';
import { FoodDrinksScreen } from './components/food/FoodDrinksScreen';
import { BillsScreen } from './components/bills/BillsScreen';
import { KitchenScreen } from './components/kitchen/KitchenScreen';
import { MessagesScreen } from './components/messages/MessagesScreen';
import { NotificationsScreen } from './components/notifications/NotificationsScreen';
import { SupportScreen } from './components/support/SupportScreen';
import { SettingsScreen } from './components/settings/SettingsScreen';
import { PlatformScreen } from './components/platform/PlatformScreen';
import brandLockup from './assets/brand/lockup-light.png';

/**
 * v5.0.0 Production router (ADR-0013 role model / ADR-0014 rebuild):
 *  - No session → ServePoint login (email + password only).
 *  - superadmin → Platform console ALWAYS (developer/operators; never the cafe app).
 *  - owner / staff → the ServePoint cafe app per the Figma (Dashboard, Food & Drinks,
 *    Messages, Bills, Settings + Notifications, Support).
 */

const Splash: React.FC = () => (
  <div className="flex h-screen flex-col items-center justify-center gap-5 bg-[#F6F5F2]">
    <img src={brandLockup} alt="ServePoint" className="h-11 w-auto" />
    <span
      className="h-1 w-28 overflow-hidden rounded-full bg-[#E3E7E0]"
      role="status"
      aria-label="Loading"
    >
      <span className="block h-full w-1/2 animate-pulse rounded-full bg-[#B88E2F]" />
    </span>
  </div>
);

const CafeApp: React.FC = () => {
  const { section } = useUi();
  const session = useSession((s) => s.session);
  const setSession = useSession((s) => s.setSession);
  const [retryKey, setRetryKey] = useState(0);
  // Resolve the workspace ONCE at the shell: if the signed-in account has no
  // business tenant in the cloud, show one actionable state instead of letting
  // every screen render its own "Workspace not found" error card.
  const tenant = useTenant(retryKey);

  if (tenant.loading) return <Splash />;

  if (tenant.error) {
    return (
      <NoWorkspaceScreen
        email={session?.email}
        message={tenant.error}
        onRetry={() => setRetryKey((k) => k + 1)}
        onSignOut={async () => {
          await authService.signOut();
          setSession(null);
        }}
      />
    );
  }

  return (
    <AppShell>
      {section === 'dashboard' && <DashboardScreen />}
      {section === 'food' && <FoodDrinksScreen />}
      {section === 'kitchen' && <KitchenScreen />}
      {section === 'messages' && <MessagesScreen />}
      {section === 'bills' && <BillsScreen />}
      {section === 'notifications' && <NotificationsScreen />}
      {section === 'support' && <SupportScreen />}
      {section === 'settings' && <SettingsScreen />}
    </AppShell>
  );
};

const App: React.FC = () => {
  const { session, setSession, setReady } = useSession();
  const [restoring, setRestoring] = useState(true);

  useEffect(() => {
    let alive = true;
    authService
      .getSession()
      .then((s) => {
        if (!alive) return;
        setSession(s ? { ...s, role: normalizeRole(s.role) } : null);
      })
      .finally(() => {
        if (alive) {
          setRestoring(false);
          setReady(true);
        }
      });
    return () => {
      alive = false;
    };
  }, [setSession, setReady]);

  if (restoring) return <Splash />;

  if (!session) {
    return (
      <AuthScreen
        onSuccess={(s) => setSession({ ...s, role: normalizeRole(s.role) })}
      />
    );
  }

  if (session.role === 'superadmin') return <PlatformScreen />;

  return <CafeApp />;
};

export default App;
