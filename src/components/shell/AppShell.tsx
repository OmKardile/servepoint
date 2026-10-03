import React from 'react';
import { authService } from '../../lib/authService';
import { getRoleMeta } from '../../lib/rbac';
import { useDialogA11y } from '../../lib/useDialogA11y';
import { useSession, useUi } from '../../store/session';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

/** ServePoint app shell — teal sidebar + breadcrumb header + canvas content. */
export const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { section } = useUi();
  const session = useSession((s) => s.session);
  const { profileOpen, setProfileOpen } = useUi();

  const roleMeta = getRoleMeta(session?.role);

  /* v5.110.0 — the profile dialog holds the door: Escape closes, Tab cycles
   * inside, focus returns to the avatar button on close. Initial focus sits
   * on the card itself (neutral) — first focusable would be Sign out, and an
   * accidental Enter on that is not a mistake the dialog should invite. */
  const profileCardRef = React.useRef<HTMLDivElement>(null);
  const profileDlgRef = useDialogA11y<HTMLDivElement>(() => setProfileOpen(false), profileOpen, profileCardRef);

  return (
    <div className="flex h-screen overflow-hidden bg-[#F6F5F2]">
      {/* v5.109.0 — the shortcut: the first Tab of every screen offers the way
          in, past the 15-pill rail and the header chrome, straight to the room.
          Styles are the unlayered .sp-skip-link pair in index.css (its own
          class because the unlayered custom .sr-only would smother Tailwind's
          layered focus:not-sr-only even on focus). Enter lands focus on the
          main landmark below — the tab order continues INSIDE the content,
          not back at the rail. */}
      <a
        href="#sp-main"
        className="sp-skip-link"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById('sp-main')?.focus();
        }}
      >
        Skip to content
      </a>
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header />
        {/* tabIndex={-1} makes the landmark focusable for the skip link only —
            Tab skips it. outline-none: the UA ring a keyboard-adjacent
            programmatic focus can paint around the whole content area is
            noise, not signal (the skip link itself shows the visible ring). */}
        <main
          id="sp-main"
          tabIndex={-1}
          className="min-h-0 flex-1 overflow-y-auto outline-none"
          aria-label={`${section} content`}
        >
          {children}
        </main>
      </div>

      {profileOpen && (
        <div
          ref={profileDlgRef}
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F3D3E]/45 p-4"
          style={{ animation: 'spFadeIn 160ms ease-out' }}
          role="dialog"
          aria-modal="true"
          aria-label="Profile"
          onClick={() => setProfileOpen(false)}
        >
          <div
            ref={profileCardRef}
            tabIndex={-1}
            className="sp-card w-full max-w-sm p-6 shadow-xl outline-none"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center">
              <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#D9E2DD] text-xl font-bold text-[#0F3D3E]">
                {(session?.name || 'S').charAt(0).toUpperCase()}
              </span>
              <h2 className="mt-3 text-lg font-semibold text-[#1A1A1A]">{session?.name}</h2>
              <p className="text-[13px] text-[#6B6B6B]">{session?.email}</p>
              <span
                className={`mt-2 inline-block rounded-full px-3 py-1 text-[11px] font-semibold ${roleMeta.className}`}
              >
                {roleMeta.label}
              </span>
              {session?.tenantName && (
                <p className="mt-2 text-[12px] text-[#969696]">{session.tenantName}</p>
              )}
              <button
                onClick={async () => {
                  await authService.signOut();
                  useSession.getState().setSession(null);
                }}
                className="sp-cta mt-5 w-full py-2.5 text-[13.5px]"
              >
                Sign out
              </button>
              <button
                onClick={() => setProfileOpen(false)}
                className="mt-2 w-full py-2 text-[12.5px] text-[#6B6B6B] hover:text-[#1A1A1A]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
