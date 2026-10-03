import React, { useEffect, useState } from 'react';
import { authService } from './lib/authService';
import { pingPresence } from './lib/api';
import { normalizeRole } from './lib/rbac';
import { useTenant } from './lib/tenant';
import { useSession, useUi, type Section } from './store/session';
import { SECTION_LABELS } from './components/shell/Sidebar';
import { AuthScreen } from './components/auth/AuthScreen';
import { AppShell } from './components/shell/AppShell';
import { NoWorkspaceScreen } from './components/shell/NoWorkspaceScreen';
import { DashboardScreen } from './components/dashboard/DashboardScreen';
import { FoodDrinksScreen } from './components/food/FoodDrinksScreen';
import { BillsScreen } from './components/bills/BillsScreen';
import { EodScreen } from './components/eod/EodScreen';
import { ReportsScreen } from './components/reports/ReportsScreen';
import { InventoryScreen } from './components/inventory/InventoryScreen';
import { CustomersScreen } from './components/customers/CustomersScreen';
import { KitchenScreen } from './components/kitchen/KitchenScreen';
import { FloorScreen } from './components/floor/FloorScreen';
import { MenuScreen } from './components/menu/MenuScreen';
import { NotificationsScreen } from './components/notifications/NotificationsScreen';
import { MessagesScreen } from './components/messages/MessagesScreen';
import { SupportScreen } from './components/support/SupportScreen';
import { SettingsScreen } from './components/settings/SettingsScreen';
import { PlatformScreen } from './components/platform/PlatformScreen';
import ShowcasePage from './components/pages/ShowcasePage';
import IndexHelpPage from './components/pages/IndexHelpPage';
import { GuestGatePage, GuestMenuPage, GuestTrackPage } from './components/guest/GuestPages';
import { PwaLayer } from './components/shell/PwaLayer';
import brandLockup from './assets/brand/lockup-light.png';

/* v5.93.0 — the sidebar's words are the URLs. Two rail names differ from
 * their section ids (the rail says "Close-out", the code says 'eod'; the rail
 * says "Guests", the code says 'customers') — and until now only the code's
 * word was deep-linkable: /close-out and /guests fell through to Dashboard
 * while /eod and /customers worked, words no human ever bookmarks. Staff
 * bookmark what the rail SAYS, so every spoken name resolves — alongside the
 * plain ids, which keep working untouched. */
const SECTION_SLUGS: Readonly<Record<string, Section>> = Object.freeze(
  Object.fromEntries([
    ...(Object.keys(SECTION_LABELS) as Section[]).map((id) => [id, id]),
    ['close-out', 'eod'],
    ['guests', 'customers'],
  ] as [string, Section][])
);

/**
 * v5.0.0 Production router (ADR-0013 role model / ADR-0014 rebuild):
 *  - No session → ServePoint login (email + password only).
 *  - superadmin → Platform console ALWAYS (developer/operators; never the cafe app).
 *  - owner / staff → the ServePoint cafe app per the Figma (Dashboard, Food & Drinks,
 *    Kitchen, Bills, Floor, Menu, Settings + Notifications, Support).
 *  - /showcase + /index-help → public, unauthenticated product surfaces (v5.2.1):
 *    plain-path routing on the SPA fallback — the POS stays king at "/".
 *  - /t/:token, /menu/:token, /track/:orderId → guest QR ordering surfaces (v5.3.0):
 *    no login — the table's permanent QR token + the order UUID are the capabilities.
 */

/** Reads the browser path ONCE (these are standalone pages, not in-app tabs). */
const usePathname = (): string => useState(() => window.location.pathname)[0];

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
  const { section, goSection } = useUi();
  const session = useSession((s) => s.session);
  const setSession = useSession((s) => s.setSession);
  const [retryKey, setRetryKey] = useState(0);

  /* v5.32.0 — staff deep links: /:slug/:screen (or /:screen) boots straight
   *  into the named screen — bookmarks, staff shortcuts, pinned wall displays.
   *  The path is read ONCE on mount (same philosophy as usePathname above);
   *  the slug segment stays decorative — the signed-in session already
   *  decides the workspace. Unknown/missing screen → Dashboard, unchanged.
   *  In-app navigation keeps the URL where it is (pre-existing behavior:
   *  sections are app state, not routes). */
  const deepLinkDone = React.useRef(false);
  useEffect(() => {
    if (deepLinkDone.current) return;
    deepLinkDone.current = true;
    const parts = window.location.pathname.split('/').filter(Boolean);
    const seg = parts.length >= 2 ? parts[1] : parts[0];
    const target = seg ? SECTION_SLUGS[seg] : undefined;
    if (target) {
      goSection(target, [SECTION_LABELS[target]]);
    }
  }, [goSection]);

  /* v5.32.0 — the tab strip tells the truth: the browser tab title follows
   *  the active screen ("Floor · ServePoint"), so multi-tab operators and
   *  pinned wall displays read at a glance. */
  useEffect(() => {
    document.title = `${SECTION_LABELS[section]} · ServePoint`;
  }, [section]);

  // Resolve the workspace ONCE at the shell: if the signed-in account has no
  // business tenant in the cloud, show one actionable state instead of letting
  // every screen render its own "Workspace not found" error card.
  const tenant = useTenant(retryKey);

  /* v5.46.0 — the presence heartbeat (migration 035): "I am at the app",
   *  upserted the moment a workspace is open and every 45s after — the
   *  shell is the right owner because presence is APP-level, not a
   *  Messages-screen state (someone standing on Floor is just as "on the
   *  line" as someone in chat). Best-effort throughout: a failed ping is
   *  silent, the next one retells it; a closed tab simply goes stale and
   *  falls out of the 120s display window — no retract choreography, the
   *  window IS the truth. Platform accounts (no tenant) skip. */
  const heartbeatEmail = session?.email || '';
  const heartbeatName = session?.name || 'Staff';
  useEffect(() => {
    const tenantId = tenant.tenantId;
    if (!tenantId || !heartbeatEmail) return;
    const ping = () =>
      void pingPresence(tenantId, heartbeatEmail, heartbeatName).catch(() => {});
    ping();
    const t = window.setInterval(ping, 45_000);
    return () => window.clearInterval(t);
  }, [tenant.tenantId, heartbeatEmail, heartbeatName]);

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
      {section === 'bills' && <BillsScreen />}
      {section === 'eod' && <EodScreen />}
      {section === 'reports' && <ReportsScreen />}
      {section === 'inventory' && <InventoryScreen />}
      {section === 'customers' && <CustomersScreen />}
      {section === 'floor' && <FloorScreen />}
      {section === 'menu' && <MenuScreen />}
      {section === 'notifications' && <NotificationsScreen />}
      {section === 'messages' && <MessagesScreen />}
      {section === 'support' && <SupportScreen />}
      {section === 'settings' && <SettingsScreen />}
    </AppShell>
  );
};

const AppRoutes: React.FC = () => {
  const pathname = usePathname(); // public surfaces route on the plain path
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

  // Public product surfaces bypass auth entirely (no session restore flicker).
  if (pathname === '/showcase') return <ShowcasePage />;
  if (pathname === '/index-help' || pathname === '/help') return <IndexHelpPage />;
  // Guest QR surfaces (v5.3.0) — public, no session, capabilities only:
  // /t/:qr_token (table gate) · /menu/:qr_token (menu + cart) · /track/:orderId (pager).
  if (pathname.startsWith('/t/')) return <GuestGatePage qrToken={decodeURIComponent(pathname.split('/')[2] || '')} />;
  if (pathname.startsWith('/menu/')) return <GuestMenuPage qrToken={decodeURIComponent(pathname.split('/')[2] || '')} />;
  if (pathname.startsWith('/track/')) return <GuestTrackPage orderId={decodeURIComponent(pathname.split('/')[2] || '')} />;

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

/**
 * Root frame (v5.6.0): every surface — staff, public, guest — gets the PWA
 * layer (offline banner; install card on staff surfaces only, where the
 * component itself narrows the audience from the plain path).
 */
const App: React.FC = () => (
  <>
    <PwaLayer />
    <AppRoutes />
  </>
);

export default App;
