import { useEffect, useRef, useState } from 'react';
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
 *
 * v5.134.0 — the banner stops promising a queue that was never built, and
 * the episode learns its ending. The staff copy claimed "Orders queue up
 * when you're back" — but nothing queues: placeOrder inserts directly and
 * an offline tap gets an error toast like any other (audited this round:
 * zero outbox/retry/IndexedDB code in the tree). The copy now says only
 * what is TRUE — the data is the last synced, new orders wait for the
 * wire. And the offline episode finally CLOSES: when the wire returns, a
 * brief sage whisper ("Back online — live updates resumed.") confirms the
 * recovery, then silence again — the banner spoke the fall, the whisper
 * speaks the landing; silence stays the healthy voice.
 *
 * v5.144.0 — the update toast joins the house register ("The house has
 * grown.", serif-italic teal over white, honest sub-line, gold Refresh,
 * quiet Later) — and with the sw.js self-skip finally removed the toast
 * is no longer dead code: an update really does WAIT now, and this
 * surface is the only door that lets it in.
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
  /* v5.134.0 — the episode remembers itself: falling offline arms the
   * memory, the next `online` fires the brief recovery whisper (2.6s,
   * then silence). A reload clears it — recovery is announced once,
   * where it happened. */
  const [justBack, setJustBack] = useState(false);
  const wasOffline = useRef(false);
  useEffect(() => {
    const up = () => {
      setOnline(true);
      setBannerGone(false);
      if (wasOffline.current) {
        wasOffline.current = false;
        setJustBack(true);
      }
    };
    const down = () => {
      setOnline(false);
      wasOffline.current = true;
    };
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);
  useEffect(() => {
    if (!justBack) return;
    const t = window.setTimeout(() => setJustBack(false), 2600);
    return () => window.clearTimeout(t);
  }, [justBack]);

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
  /* v5.144.0 — "Later" dismisses THIS episode only; a genuinely newer
   * worker (waitingWorker changes) reopens the door. */
  const [updateDismissed, setUpdateDismissed] = useState(false);
  useEffect(() => {
    setUpdateDismissed(false);
  }, [waitingWorker]);
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
                <>Offline — the menu may be stale. Place your order when you&rsquo;re back online.</>
              ) : (
                <>Offline — ServePoint shows the last synced data. Place new orders when the connection returns.</>
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

      {/* ── Recovery whisper (v5.134.0) — the episode's landing ──────────── */}
      {/* The banner spoke the fall; this speaks the landing, once, then
          silence again. Same dark-toast anatomy as the banner, but the dot
          is a steady green (the wire is STABLE — no ping) in the layer's
          own bright-on-dark accent register (#4CAF6D against #1A1A1A, the
          softened sibling of the banner's #F59E0B). role="status" so the
          recovery is announced like the fall was. */}
      {online && justBack && (
        <div
          role="status"
          className="fixed inset-x-0 top-0 z-[90] flex justify-center px-3 pt-2 sm:pt-3"
          style={{ animation: 'spPwaDrop 260ms cubic-bezier(0.22, 1, 0.36, 1)' }}
        >
          <div className="flex items-center gap-2.5 rounded-full border border-[#4CAF6D]/25 bg-[#1A1A1A] py-1.5 pl-3 pr-3.5 shadow-lg shadow-black/20">
            <span className="relative flex h-2 w-2">
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#4CAF6D]" />
            </span>
            <span className="whitespace-nowrap text-[11px] font-medium tracking-wide text-[#F6F5F2] sm:text-xs">
              Back online — live updates resumed.
            </span>
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

      {/* ── New-version card (all surfaces, once an update waits) ────────── */}
      {/* v5.144.0 — the register upgrade: the old dark pill flashed and the
          page yanked itself (sw.js self-skipped, so this surface was dead
          code). Now the episode is honest end to end: the worker WAITS,
          the card asks in the house voice, and the tap — not the SW —
          moves the house in. Cream-chip mark with the pinging gold dot
          echoes the offline page's brand chip; teal serif-italic echoes
          the porch headings. "Later" dismisses this episode only. */}
      {waitingWorker && !updateDismissed && (
        <div
          role="status"
          className="fixed inset-x-0 bottom-4 z-[95] flex justify-center px-3 sm:bottom-6"
          style={{ animation: 'spPwaRise 320ms cubic-bezier(0.22, 1, 0.36, 1)' }}
        >
          <div className="flex items-center gap-3.5 rounded-2xl border border-[#E3E7E0] bg-white py-3 pl-4 pr-3 shadow-2xl shadow-[#1A1A1A]/15">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F6F1E9]">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#B88E2F] opacity-60" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#B88E2F]" />
              </span>
            </span>
            <div className="min-w-0">
              <p className="font-serif text-[16px] italic leading-snug text-[#0F3D3E]">
                The house has grown.
              </p>
              <p className="mt-0.5 text-[11.5px] leading-snug text-[#6B6B6B]">
                A newer ServePoint is ready — refresh when the counter is quiet; nothing will be lost.
              </p>
            </div>
            <div className="ml-1 flex shrink-0 items-center gap-1">
              <button
                onClick={applyUpdate}
                className="sp-cta flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6" />
                </svg>
                Refresh
              </button>
              <button
                onClick={() => setUpdateDismissed(true)}
                className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-[#6B6B6B] transition-colors hover:bg-[#F6F5F2] hover:text-[#1A1A1A]"
              >
                Later
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
