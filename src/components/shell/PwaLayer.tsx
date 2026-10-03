import { useEffect, useState } from 'react';
import brandMark from '../../assets/brand/mark.png';

/**
 * PwaLayer — the install + offline surface of the PWA (v5.6.0).
 *
 * Self-contained: decides its mode from the plain path ONCE.
 *   staff  → offline banner + install card (counter tablet / owner phone)
 *   public → offline banner only (showcase / help)
 *   guest  → offline banner only (a diner never installs the POS)
 *
 * The install card only ever appears after a REAL `beforeinstallprompt`
 * event — we never render a button we cannot honour. Dismissal cools down
 * for 7 days (localStorage), and the card never shows inside an installed
 * (standalone) session.
 */

type Mode = 'staff' | 'public' | 'guest';

const DISMISS_KEY = 'sp.pwa.installDismissedAt';
const DISMISS_DAYS = 7;

function modeFromPath(pathname: string): Mode {
  if (pathname.startsWith('/t/') || pathname.startsWith('/menu/') || pathname.startsWith('/track/')) {
    return 'guest';
  }
  if (pathname === '/showcase' || pathname === '/index-help' || pathname === '/help') {
    return 'public';
  }
  return 'staff';
}

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice?: Promise<{ outcome: string }> };

export function PwaLayer() {
  const [mode] = useState<Mode>(() => modeFromPath(window.location.pathname));

  // ── Offline awareness ────────────────────────────────────────────────────
  const [online, setOnline] = useState(() => navigator.onLine);
  const [bannerGone, setBannerGone] = useState(false); // manual dismiss per episode
  useEffect(() => {
    const up = () => {
      setOnline(true);
      setBannerGone(false);
    };
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);

  // ── Install prompt ───────────────────────────────────────────────────────
  const [installEvent, setInstallEvent] = useState<InstallEvent | null>(null);
  const [standalone] = useState(
    () =>
      window.matchMedia('(display-mode: standalone)').matches ||
      // iOS Safari sets navigator.standalone when launched from the home screen
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
  );
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    if (standalone) return;
    const onPrompt = (event: Event) => {
      event.preventDefault(); // take ownership — no browser mini-infobar
      setInstallEvent(event as InstallEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setInstallEvent(null);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, [standalone]);

  const [cooledDown, setCooledDown] = useState(true);
  useEffect(() => {
    const raw = localStorage.getItem(DISMISS_KEY);
    const at = raw ? Number(raw) : 0;
    setCooledDown(Date.now() - at < DISMISS_DAYS * 24 * 60 * 60 * 1000);
  }, []);

  const dismissInstall = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setInstallEvent(null);
  };

  const runInstall = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    setInstallEvent(null);
  };

  const showOffline = !online && !bannerGone;
  const showInstall =
    mode === 'staff' && !standalone && !installed && !cooledDown && Boolean(installEvent);

  // ── New-version toast (v5.7.0) ───────────────────────────────────────────
  // main.tsx announces a WAITING service worker via `sp:sw-waiting`; the tap
  // posts SP_CHECK_UPDATE (sw.js then skipWaiting()s) and controllerchange
  // reloads once. Awaiting worker is also probed on mount (covers a reload
  // that happened while an update already waited).
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  useEffect(() => {
    const onWaiting = (e: Event) => setWaitingWorker((e as CustomEvent<ServiceWorker>).detail || null);
    window.addEventListener('sp:sw-waiting', onWaiting);
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .getRegistration()
        .then((reg) => {
          if (reg?.waiting && navigator.serviceWorker.controller) setWaitingWorker(reg.waiting);
        })
        .catch(() => undefined);
    }
    return () => window.removeEventListener('sp:sw-waiting', onWaiting);
  }, []);

  const applyUpdate = () => {
    waitingWorker?.postMessage('SP_CHECK_UPDATE');
  };

  return (
    <>
      {/* ── Offline banner (all surfaces) ─────────────────────────────────── */}
      {showOffline && (
        <div
          role="status"
          className="fixed inset-x-0 top-0 z-[90] flex justify-center px-3 pt-2 sm:pt-3"
          style={{ animation: 'spPwaDrop 260ms cubic-bezier(0.22, 1, 0.36, 1)' }}
        >
          <div className="flex items-center gap-2.5 rounded-full border border-[#B45309]/25 bg-[#1A1A1A] py-1.5 pl-3 pr-2 shadow-lg shadow-black/20">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#F59E0B] opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#F59E0B]" />
            </span>
            <span className="whitespace-nowrap text-[11px] font-medium tracking-wide text-[#F6F5F2] sm:text-xs">
              {mode === 'guest' ? (
                <>Offline — the menu may be stale. Orders go through when you&rsquo;re back.</>
              ) : (
                <>Offline — ServePoint shows the last synced data. Orders queue up when you&rsquo;re back.</>
              )}
            </span>
            <button
              onClick={() => setBannerGone(true)}
              aria-label="Dismiss offline notice"
              className="ml-1 rounded-full p-1 text-[#F6F5F2]/60 transition-colors hover:bg-white/10 hover:text-[#F6F5F2]"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* ── Install card (staff surfaces only) ───────────────────────────── */}
      {showInstall && (
        <div
          /* v5.111.0 — role="region", not "dialog": this card is a NON-modal
             toast (the app stays usable behind it; own close button, no
             aria-modal). role="dialog" promised a modal room that never
             existed, and assistive tech held it to the promise. */
          role="region"
          aria-label="Install ServePoint"
          className="fixed bottom-4 right-4 z-[90] w-[calc(100vw-2rem)] max-w-sm sm:bottom-6 sm:right-6"
          style={{ animation: 'spPwaRise 320ms cubic-bezier(0.22, 1, 0.36, 1)' }}
        >
          <div className="overflow-hidden rounded-2xl border border-[#E3E7E0] bg-white shadow-2xl shadow-[#1A1A1A]/15">
            <div className="h-1 w-full bg-gradient-to-r from-[#B88E2F] via-[#E8A33D] to-[#B88E2F]" />
            <div className="flex gap-3.5 p-4">
              <img
                src={brandMark}
                alt=""
                className="h-12 w-12 shrink-0 rounded-xl border border-[#E3E7E0] object-cover shadow-sm"
              />
              <div className="min-w-0 flex-1">
                <p className="font-serif text-[17px] leading-snug text-[#1A1A1A]">
                  Install ServePoint
                </p>
                <p className="mt-1 text-xs leading-relaxed text-[#6B6B6B]">
                  Full-screen on your counter tablet, one tap from the home screen, and
                  ready when the Wi-Fi blips.
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <button onClick={runInstall} className="sp-cta rounded-lg px-4 py-1.5 text-xs font-semibold">
                    Install
                  </button>
                  <button
                    onClick={dismissInstall}
                    className="rounded-lg px-3 py-1.5 text-xs font-medium text-[#6B6B6B] transition-colors hover:bg-[#F6F5F2] hover:text-[#1A1A1A]"
                  >
                    Not now
                  </button>
                </div>
              </div>
              <button
                onClick={dismissInstall}
                aria-label="Dismiss install prompt"
                className="-mr-1 -mt-1 h-7 w-7 shrink-0 rounded-full text-[#6B6B6B]/50 transition-colors hover:bg-[#F6F5F2] hover:text-[#1A1A1A]"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true" className="mx-auto">
                  <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── New-version toast (all surfaces, once an update waits) ────────── */}
      {waitingWorker && (
        <div
          role="status"
          className="fixed inset-x-0 bottom-4 z-[95] flex justify-center px-3 sm:bottom-6"
          style={{ animation: 'spPwaRise 320ms cubic-bezier(0.22, 1, 0.36, 1)' }}
        >
          <div className="flex items-center gap-3 rounded-full border border-[#B88E2F]/40 bg-[#1A1A1A] py-2 pl-4 pr-2 shadow-xl shadow-black/25">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#E7C878] opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#E7C878]" />
            </span>
            <span className="whitespace-nowrap text-xs font-medium tracking-wide text-[#F6F5F2]">
              New version ready
            </span>
            <button
              onClick={applyUpdate}
              className="ml-1 flex items-center gap-1.5 rounded-full bg-[#B88E2F] px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#967221]"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6" />
              </svg>
              Refresh
            </button>
          </div>
        </div>
      )}
    </>
  );
}
