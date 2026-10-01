import { StrictMode, Component, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

/** Minimal production error boundary — honest failure screen, no demo content. */
class ProductionErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
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
