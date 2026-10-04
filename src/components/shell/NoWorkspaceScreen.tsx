import React from 'react';
import { Building2, KeyRound, LogOut, RefreshCw } from 'lucide-react';

/**
 * Unified "no workspace" state (v5.0.5) — shown at the shell level when a
 * signed-in owner/staff account cannot resolve a business tenant in the
 * cloud (e.g. the business was provisioned from an older app version whose
 * cloud writes failed, so it exists only in that device's local registry).
 * Replaces the per-screen "Workspace not found" cards with ONE honest,
 * actionable screen: what happened, how to fix it, retry / switch account.
 */

interface NoWorkspaceScreenProps {
  /** The signed-in account's email (shown for clarity). */
  email?: string;
  /** The underlying resolution error (kept visible for honesty). */
  message: string;
  onRetry: () => void;
  onSignOut: () => void | Promise<void>;
}

export const NoWorkspaceScreen: React.FC<NoWorkspaceScreenProps> = ({
  email,
  message,
  onRetry,
  onSignOut,
}) => {
  return (
    <div className="min-h-screen bg-[#F6F5F2] flex items-center justify-center p-4">
      <main className="w-full max-w-md">
        <div className="sp-card p-8 text-center animate-in fade-in slide-in-from-bottom-2 duration-300">
          <span
            className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#D9E2DD]"
            aria-hidden="true"
          >
            <Building2 className="h-7 w-7 text-[#0F3D3E]" />
          </span>

          <h1 className="sp-screen-title mt-5">
            No business workspace yet
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-[#6B6B6B]">
            {email ? (
              <>
                <span className="font-semibold text-[#1A1A1A]">{email}</span>{' '}
                isn&apos;t attached to a business in the ServePoint cloud.
              </>
            ) : (
              "This account isn't attached to a business in the ServePoint cloud."
            )}
          </p>

          <div className="mt-6 rounded-xl border border-[#E3E7E0] bg-[#EAF0EC] p-4 text-left">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#6B6B6B]">
              <KeyRound className="h-3.5 w-3.5 text-[#967221]" aria-hidden="true" />
              How to fix
            </p>
            <ol className="mt-2.5 list-decimal space-y-1.5 pl-4 text-[13px] leading-relaxed text-[#1A1A1A]">
              <li>Sign out, then sign in as the platform operator (developer account — credentials in docs/CREDENTIALS.md).</li>
              <li>
                Open the Platform console → <span className="font-semibold">+ Add Business</span> and
                provision this business again — the current version writes to the cloud directly.
              </li>
              <li>Use this same email as the owner, then sign back in here with the password the wizard shows.</li>
            </ol>
          </div>

          <p className="mt-4 text-xs leading-relaxed text-[#969696]">{message}</p>

          <div className="mt-6 flex gap-3">
            <button
              type="button"
              onClick={onRetry}
              className="sp-cta flex flex-1 items-center justify-center gap-2 py-2.5 text-sm"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Retry
            </button>
            <button
              type="button"
              onClick={onSignOut}
              className="sp-teal-btn flex flex-1 items-center justify-center gap-2 py-2.5 text-sm"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              Sign out
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};
