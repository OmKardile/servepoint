import React from 'react';
import { AlertTriangle, RotateCcw, Home } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * ErrorBoundary — top-level safety net for the whole TSOS app.
 *
 * Without this, any uncaught render error in a screen unmounts the entire
 * React tree and leaves the cashier staring at a blank white screen (React
 * logs "An error occurred in the <App> component. Consider adding an error
 * boundary" — observed in QA). With this, the rest of the app degrades into
 * a friendly recovery card with Reload / Back to POS actions instead.
 *
 * ServePoint-styled: ivory canvas, deep-teal accents, gold CTA.
 */
export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('[TSOS] Uncaught UI error captured by ErrorBoundary:', error, info.componentStack);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleBackToPos = () => {
    // Clear the crashed tree and give the app a fresh route.
    try {
      const url = new URL(window.location.href);
      url.hash = '#/pos';
      window.location.href = url.toString();
    } catch {
      /* ignore */
    }
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen bg-[#F6F5F2] flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl border border-[#E3E7E0] shadow-xl max-w-md w-full p-8 text-center">
          <div className="w-14 h-14 rounded-2xl bg-[#D9E2DD] text-[#967221] flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <h1 className="text-xl font-semibold text-[#1A1A1A] mb-1.5">Something went wrong</h1>
          <p className="text-sm text-[#6B6B6B] mb-2">
            The counter screen hit an unexpected error. Your sale in progress is safe —
            reload to continue taking orders.
          </p>
          {this.state.error?.message && (
            <div className="mt-3 mb-5 p-2.5 rounded-xl bg-[#F6F5F2] border border-[#E3E7E0] text-[11px] font-mono text-[#6B6B6B] break-words max-h-20 overflow-y-auto text-left">
              {this.state.error.message}
            </div>
          )}
          <div className="flex items-center justify-center gap-2.5">
            <button
              onClick={this.handleBackToPos}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white border border-[#E3E7E0] text-[#1A1A1A] text-sm font-medium hover:bg-[#D9E2DD] transition-colors"
            >
              <Home className="w-4 h-4" />
              <span>Back to POS</span>
            </button>
            <button
              onClick={this.handleReload}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#0F3D3E] hover:bg-[#0B3132] text-white text-sm font-medium transition-colors shadow-md shadow-[#0F3D3E]/20"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Reload TSOS</span>
            </button>
          </div>
        </div>
      </div>
    );
  }
}
