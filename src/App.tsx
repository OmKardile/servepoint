import React, { lazy, Suspense, useEffect, useState } from 'react';
import { authService } from './lib/authService';
import { pingPresence } from './lib/api';
import { normalizeRole } from './lib/rbac';
import { useTenant } from './lib/tenant';
import { useSession, useUi, type Section } from './store/session';
import { SECTION_LABELS } from './components/shell/Sidebar';
import { SECTION_SLUGS, sectionFromPath, platformTabFromPath } from './lib/sectionPath';
import { AuthScreen } from './components/auth/AuthScreen';
import { AppShell } from './components/shell/AppShell';
import { NoWorkspaceScreen } from './components/shell/NoWorkspaceScreen';
import ScreenSkeleton from './components/shell/ScreenSkeleton';
import { PwaLayer } from './components/shell/PwaLayer';
import { ScreenBoundary } from './components/shell/ScreenBoundary';

/* v5.143.0 — the app boots with what the boot needs. Every staff screen (and
 *  the platform console and the guest surfaces) is a door that loads when it
 *  is walked through: before this release all fourteen screens plus the whole
 *  guest module sat in ONE eager 843KB index chunk, and the recharts vendor
 *  chunk (407KB more) loaded at boot because three screens import it — every
 *  counter tablet parsed ~1.2MB of screens it was not looking at. Now the
 *  eager graph is the shell, the auth gate, the porch pages, the 404 register
 *  and the skeleton; screens fetch on first tap (instant once the SW precache
 *  is warm — the build's injector adds every async chunk to the precache
 *  manifest automatically). A failed chunk import (offline cache miss)
 *  rejects into THAT door's ScreenBoundary — "hit a snag" with Try again —
 *  while the shell stays up. Eager-on-purpose: NotFoundPage (the emergency
 *  register must never wait on a fetch) and the porch (marketing first
 *  paint). */
const DashboardScreen = lazy(() => import('./components/dashboard/DashboardScreen').then((m) => ({ default: m.DashboardScreen })));
const FoodDrinksScreen = lazy(() => import('./components/food/FoodDrinksScreen').then((m) => ({ default: m.FoodDrinksScreen })));
const BillsScreen = lazy(() => import('./components/bills/BillsScreen').then((m) => ({ default: m.BillsScreen })));
const EodScreen = lazy(() => import('./components/eod/EodScreen').then((m) => ({ default: m.EodScreen })));
const ReportsScreen = lazy(() => import('./components/reports/ReportsScreen').then((m) => ({ default: m.ReportsScreen })));
const InventoryScreen = lazy(() => import('./components/inventory/InventoryScreen').then((m) => ({ default: m.InventoryScreen })));
const CustomersScreen = lazy(() => import('./components/customers/CustomersScreen').then((m) => ({ default: m.CustomersScreen })));
const KitchenScreen = lazy(() => import('./components/kitchen/KitchenScreen').then((m) => ({ default: m.KitchenScreen })));
const FloorScreen = lazy(() => import('./components/floor/FloorScreen').then((m) => ({ default: m.FloorScreen })));
const MenuScreen = lazy(() => import('./components/menu/MenuScreen').then((m) => ({ default: m.MenuScreen })));
const NotificationsScreen = lazy(() => import('./components/notifications/NotificationsScreen').then((m) => ({ default: m.NotificationsScreen })));
const MessagesScreen = lazy(() => import('./components/messages/MessagesScreen').then((m) => ({ default: m.MessagesScreen })));
const SupportScreen = lazy(() => import('./components/support/SupportScreen').then((m) => ({ default: m.SupportScreen })));
const SettingsScreen = lazy(() => import('./components/settings/SettingsScreen').then((m) => ({ default: m.SettingsScreen })));
const PlatformScreen = lazy(() => import('./components/platform/PlatformScreen').then((m) => ({ default: m.PlatformScreen })));
const guestModule = () => import('./components/guest/GuestPages');
const GuestGatePage = lazy(() => guestModule().then((m) => ({ default: m.GuestGatePage })));
const GuestMenuPage = lazy(() => guestModule().then((m) => ({ default: m.GuestMenuPage })));
const GuestTrackPage = lazy(() => guestModule().then((m) => ({ default: m.GuestTrackPage })));
// Eager on purpose: the porch is first-paint marketing, and the 404 is the
// emergency register — neither may wait on a chunk fetch.
import ShowcasePage from './components/pages/ShowcasePage';
import IndexHelpPage from './components/pages/IndexHelpPage';
import NotFoundPage from './components/pages/NotFoundPage';
import brandLockup from './assets/brand/lockup-light.png';

/* v5.93.0 — the sidebar's words are the URLs: every spoken rail name
 * resolves as a deep link (/close-out → 'eod', /guests → 'customers')
 * alongside the plain ids, which keep working untouched.
 * v5.235.0 — the slug rules AND the segment→section derivation moved to
 * lib/sectionPath.ts as ONE home: the 404 door, the boot deep-link and
 * the URL write-back (which lives in goSection itself — the navigation
 * act, immune to StrictMode's effect echo) all ask the same closure.
 * One grammar, never a fork. */

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
   *  v5.235.0 — the segment→section ask rides the ONE closure in
   *  lib/sectionPath.ts, shared with the write-back below. */
  const deepLinkDone = React.useRef(false);
  useEffect(() => {
    if (deepLinkDone.current) return;
    deepLinkDone.current = true;
    const target = sectionFromPath(SECTION_SLUGS, window.location.pathname);
    if (target) {
      goSection(target, [SECTION_LABELS[target]]);
    }
  }, [goSection]);

  /* v5.32.0 — the tab strip tells the truth: the browser tab title follows
   *  the active screen ("Floor · ServePoint"), so multi-tab operators and
   *  pinned wall displays read at a glance. The title rides STATE (it must
   *  also speak at a plain boot, where no navigation act runs); the ADDRESS
   *  rides the CHOICE (goSection's own writer — v5.235.0). Two clocks, two
   *  honest jobs. */
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
      {/* v5.138.0 — a screen breaks, the house keeps serving: one boundary per
          screen (key={section} gives each door a fresh one), so a render error
          takes the content card, never the shell. See ScreenBoundary's header. */}
      <ScreenBoundary key={section} section={section}>
        {/* v5.143.0 — the skeleton lives INSIDE the boundary: a chunk that
            fails to load rejects into THIS door's boundary (the honest snag
            card with Try again), while the shell and every other door stay
            up. The skeleton itself is the content card's quiet silhouette. */}
        <Suspense fallback={<ScreenSkeleton />}>
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
        </Suspense>
      </ScreenBoundary>
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
  // v5.143.0 — lazy chunk + Splash while it fetches (SW precache makes this
  // instant warm; cold QR scans pay one fetch for a much lighter eager boot).
  if (pathname.startsWith('/t/')) {
    return <Suspense fallback={<Splash />}><GuestGatePage qrToken={decodeURIComponent(pathname.split('/')[2] || '')} /></Suspense>;
  }
  if (pathname.startsWith('/menu/')) {
    return <Suspense fallback={<Splash />}><GuestMenuPage qrToken={decodeURIComponent(pathname.split('/')[2] || '')} /></Suspense>;
  }
  if (pathname.startsWith('/track/')) {
    return <Suspense fallback={<Splash />}><GuestTrackPage orderId={decodeURIComponent(pathname.split('/')[2] || '')} /></Suspense>;
  }

  /* v5.141.0 — no address goes unacknowledged. Every path that is not the
   *  staff root, a porch page, a guest surface, or a staff deep link speaking
   *  the v5.32.0 slug grammar (/:slug/:screen — last segment resolves) now
   *  lands on an honest 404 in the porch's own register, instead of being
   *  silently swallowed into login or the Dashboard. Known staff slugs keep
   *  their old path: anonymous visitors still get the login gate, and after
   *  sign-in the deep-link effect boots them into the bookmarked screen.
   *  CafeApp's internal "unknown slug → Dashboard" fallback stays as a second
   *  safety net, but the door itself now answers.
   *  v5.235.0 — the door's slug ask rides the ONE closure too: three readers
   *  (the 404 door, the boot deep-link, the write-back), one grammar. */
  /* v5.286.0 — the door learns the platform's words: /businesses,
   * /subscriptions and /audit-log (the rail's spoken name) resolve like
   * any staff slug — anonymous visitors still get the login gate (the
   * house's own law for known doors), and after sign-in the superadmin
   * boots straight into the bookmarked room (PlatformScreen reads the
   * same grammar). Unknown words keep falling to the honest 404. */
  const knownDoor =
    pathname === '/' ||
    sectionFromPath(SECTION_SLUGS, pathname) !== undefined ||
    platformTabFromPath(pathname) !== undefined;
  if (!knownDoor) return <NotFoundPage path={pathname} />;

  if (!session) {
    return (
      <AuthScreen
        onSuccess={(s) => setSession({ ...s, role: normalizeRole(s.role) })}
      />
    );
  }

  if (session.role === 'superadmin') {
    return <Suspense fallback={<Splash />}><PlatformScreen /></Suspense>;
  }

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
