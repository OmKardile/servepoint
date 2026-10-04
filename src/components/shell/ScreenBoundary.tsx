import { Component, type ErrorInfo, type ReactNode } from 'react';
import { useUi, type Section } from '../../store/session';
import { SECTION_LABELS } from './Sidebar';

/**
 * v5.138.0 — a screen breaks, the house keeps serving.
 *
 * Until now the tree carried exactly ONE error boundary — the root one in
 * main.tsx — so a render error ANYWHERE (one malformed row in Kitchen, a
 * bad date in Reports) replaced the entire POS: sidebar, presence, feeds,
 * everything gone until a full page reload re-ran session restore. Mid-
 * service, one screen's bug evicted staff from the building.
 *
 * This boundary wraps each staff screen INSIDE the shell: when a screen
 * throws, the card below takes only the content area — the rail keeps its
 * badges, the heartbeat keeps pinging, and every other screen stays one
 * tap away. Three honest doors, no demo content (the root boundary's own
 * doctrine, screen-sized):
 *   Try again            — reset this boundary; the screen remounts fresh.
 *   Back to Dashboard    — in-app nav via the same goSection the rail uses.
 *   Reload the whole app — the last resort, for when the failure is bigger
 *                          than one screen.
 *
 * key={section} at the mount point means each screen gets a FRESH boundary —
 * a fallen screen's error state never follows you across a door. And every
 * catch leaves a console trace (componentDidCatch): the root boundary was
 * silent — errors vanished with no stack anywhere. Diagnostics are part of
 * containment, not a luxury.
 *
 * Scope (deliberate): staff screens only. Platform is a developer/operator
 * console where the root screen is tolerable; the guest QR surfaces are
 * stateless deep links — a reload recovers them fully because the
 * capability lives in the URL. The cafe app is where mid-service state
 * (section, watermarks, scroll) dies with a root reload, so it is the
 * surface that earns containment.
 */

interface ScreenBoundaryProps {
  section: Section;
  children: ReactNode;
}

interface ScreenBoundaryState {
  error: Error | null;
}

export class ScreenBoundary extends Component<ScreenBoundaryProps, ScreenBoundaryState> {
  state: ScreenBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ScreenBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(
      `[ServePoint] ${this.props.section} screen crashed:`,
      error,
      info.componentStack
    );
  }

  private readonly retry = () => {
    this.setState({ error: null });
  };

  private readonly goDashboard = () => {
    useUi.getState().goSection('dashboard', ['Dashboard']);
  };

  render() {
    if (this.state.error) {
      const label = SECTION_LABELS[this.props.section] ?? this.props.section;
      return (
        <div
          role="alert"
          className="flex min-h-full flex-col items-center justify-center gap-3 p-8 text-center"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#B42318]/10 text-xl font-bold text-[#B42318]">
            !
          </span>
          <h1 className="sp-screen-title">{label} hit a snag</h1>
          <p className="max-w-md text-[13.5px] text-[#6B6B6B]">
            The rest of ServePoint is still running — your other screens are one tap
            away on the rail.
          </p>
          <p className="max-w-md text-xs text-[#969696]">{this.state.error.message}</p>
          <div className="mt-1 flex items-center gap-4">
            <button onClick={this.retry} className="sp-cta px-6 py-2.5 text-sm">
              Try again
            </button>
            <button
              onClick={this.goDashboard}
              className="px-2 py-2 text-[13px] text-[#6B6B6B] hover:text-[#1A1A1A]"
            >
              Back to Dashboard
            </button>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="mt-1 text-xs text-[#969696] underline underline-offset-2 hover:text-[#6B6B6B]"
          >
            Reload the whole app
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
