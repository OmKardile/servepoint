import { StrictMode, Component, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { installChartHush } from './lib/chartvoice';
import './index.css';

/** Minimal production error boundary — honest failure screen, no demo content. */
class ProductionErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  /* v5.138.0 — the root boundary leaves a trace: until now a caught error
   * vanished with no stack anywhere (state was set, nothing was logged).
   * Diagnostics are part of containment — the screen-level boundaries log
   * their catches too, but an error that reaches THIS line is one the
   * screen boundaries never saw (auth, shell, guest surfaces). */
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ServePoint] uncaught render error (root boundary):', error, info.componentStack);
  }
  render() {
    if (this.state.error) {
      return (
        <div className="flex h-screen flex-col items-center justify-center gap-3 bg-[#F6F5F2] p-6 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#B42318]/10 text-xl font-bold text-[#B42318]">
            !
          </span>
          <h1 className="text-lg font-semibold text-[#1A1A1A]">Something went wrong</h1>
          <p className="max-w-md text-sm text-[#6B6B6B]">{this.state.error.message}</p>
          <button
            onClick={() => window.location.reload()}
            className="sp-cta mt-2 px-6 py-2.5 text-sm"
          >
            Reload ServePoint
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ProductionErrorBoundary>
      <App />
    </ProductionErrorBoundary>
  </StrictMode>,
);

/* v5.132.0 — the charts stand down: recharts ships every chart svg with
   tabindex="0" (a UA-outline dead stop inside decorative/labelled figures);
   one observer strips them wherever a chart mounts, for every surface. */
installChartHush();

/**
 * PWA service worker (v5.6.0) — PRODUCTION ONLY.
 * Registering in dev would cache Vite's unbundled modules and break HMR;
 * in production the SW gives the counter tablet offline resilience.
 *
 * Update flow (v5.7.0): a newly installed worker WAITS (sw.js never
 * self-skips). We surface it to PwaLayer as `sp:sw-waiting` (with the worker
 * as detail); the user taps "Refresh" → SP_CHECK_UPDATE → skipWaiting →
 * controllerchange → ONE controlled reload. No mid-task page yanks.
 */
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/', updateViaCache: 'none' })
      .then((reg) => {
        const announce = (w: ServiceWorker | null) => {
          if (w && navigator.serviceWorker.controller) {
            window.dispatchEvent(new CustomEvent('sp:sw-waiting', { detail: w }));
          }
        };
        announce(reg.waiting);
        reg.addEventListener('updatefound', () => {
          const installing = reg.installing;
          if (!installing) return;
          installing.addEventListener('statechange', () => {
            if (installing.state === 'installed') announce(installing);
          });
        });
        let refreshing = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          if (refreshing) return;
          refreshing = true;
          window.location.reload();
        });
      })
      .catch((err) => {
        console.warn('[ServePoint] service worker registration skipped:', err);
      });
  });
}
