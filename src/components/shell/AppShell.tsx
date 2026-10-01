import React from 'react';
import { authService } from '../../lib/authService';
import { getRoleMeta } from '../../lib/rbac';
import { useSession, useUi } from '../../store/session';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

/** ServePoint app shell — teal sidebar + breadcrumb header + canvas content. */
export const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { section } = useUi();
  const session = useSession((s) => s.session);
  const { profileOpen, setProfileOpen } = useUi();

  const roleMeta = getRoleMeta(session?.role);

  return (
    <div className="flex h-screen overflow-hidden bg-[#F6F5F2]">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header />
        <main className="min-h-0 flex-1 overflow-y-auto" aria-label={`${section} content`}>
          {children}
        </main>
      </div>

      {profileOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F3D3E]/45 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Profile"
          onClick={() => setProfileOpen(false)}
        >
          <div
            className="sp-card w-full max-w-sm p-6 shadow-xl"
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
