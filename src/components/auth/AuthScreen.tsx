import React, { useEffect, useState } from 'react';
import { authService, AuthUserSession } from '../../lib/authService';
import {
  AlertCircle,
  Coffee,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
} from 'lucide-react';
import loginIllustration from '../../assets/login-illustration.png';

/**
 * v5.0.4 AuthScreen — rebuilt to the Figma "Welcome_Back" frame (219-30095)
 * after the v5.0.0 rebuild pass missed this screen (it still carried v4
 * "tessera" classes whose CSS was deleted — the Sign in button rendered
 * invisible). Frame-faithful split layout:
 *   LEFT  — white panel: illustration + rotating caption + carousel dots.
 *   RIGHT — sage panel: "Welcome Back!" + placeholder-style inputs
 *           (password eye toggle per frame) + full-width gold "Sign in".
 * Functionality unchanged (ADR-0010): email + password sign-in only;
 * accounts are provisioned by the platform superadmin, never self-registered.
 */

const SLIDES = [
  'Manage sales, inventory and other transactions',
  'Run your café from a single point of sale',
  'Track bills, staff and business insights live',
] as const;

interface AuthScreenProps {
  onSuccess: (session: AuthUserSession) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slide, setSlide] = useState(0);

  // Auto-advance the brand caption carousel (paused for reduced-motion users).
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const t = window.setInterval(
      () => setSlide((s) => (s + 1) % SLIDES.length),
      5000,
    );
    return () => window.clearInterval(t);
  }, []);

  // v5.32.0 — the tab strip stays honest at the gate: a signed-out tab reads
  // "Sign in · ServePoint", never a screen name it isn't showing.
  useEffect(() => {
    document.title = 'Sign in · ServePoint';
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await authService.signIn(email, password);
      if (res.success && res.session) {
        onSuccess(res.session);
      } else {
        setError(res.error || 'Invalid email or password.');
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected authentication error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-white">
      {/* ── Left brand panel (Welcome_Back frame) ─────────────────────── */}
      <section className="hidden lg:flex lg:w-1/2 bg-white flex-col items-center justify-center px-10 py-12">
        <img
          src={loginIllustration}
          alt="Illustration of a manager presenting sales and inventory reports"
          className="w-full max-w-md select-none"
          draggable={false}
        />
        <p className="mt-10 max-w-xs text-center text-xl font-semibold leading-snug text-[#1A1A1A]">
          {SLIDES[slide]}
        </p>
        <div className="mt-6 flex items-center gap-2" role="group" aria-label="Highlights">
          {SLIDES.map((caption, i) => (
            <button
              key={caption}
              type="button"
              onClick={() => setSlide(i)}
              aria-label={`Show highlight ${i + 1} of ${SLIDES.length}`}
              aria-pressed={i === slide}
              className={`h-2.5 rounded-full transition-all duration-300 ${
                i === slide
                  ? 'w-7 bg-[#B88E2F]'
                  : 'w-2.5 bg-[#C9CFC9] hover:bg-[#AEB5AE]'
              }`}
            />
          ))}
        </div>
      </section>

      {/* ── Right sign-in panel ───────────────────────────────────────── */}
      <section className="flex-1 flex flex-col min-h-screen bg-[#E3E7E0]">
        <div className="flex-1 flex items-center justify-center p-6 sm:p-10">
          <div className="w-full max-w-sm animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* Compact brand row (mobile only — desktop shows the left panel) */}
            <div className="lg:hidden flex items-center gap-2.5 mb-9">
              <span
                className="w-9 h-9 rounded-full bg-[#0F3D3E] flex items-center justify-center"
                aria-hidden="true"
              >
                <Coffee className="w-5 h-5 text-[#B88E2F]" />
              </span>
              <span className="text-lg font-bold text-[#1A1A1A]">ServePoint</span>
            </div>

            <h1 className="text-3xl font-bold tracking-tight text-[#1A1A1A]">
              Welcome Back!
            </h1>
            <p className="mt-1.5 text-sm text-[#6B6B6B]">
              Please sign in to continue
            </p>

            {error && (
              <div
                role="alert"
                className="mt-6 flex items-start gap-2.5 rounded-xl border border-[#F0D2CE] bg-[#FDF3F2] p-3.5 text-xs leading-relaxed text-[#B42318]"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-8 space-y-4">
              <div>
                <label htmlFor="signin-email" className="sr-only">
                  Email address
                </label>
                <input
                  id="signin-email"
                  type="text"
                  inputMode="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email address"
                  className="sp-input w-full px-4 py-3 text-sm"
                />
              </div>

              <div>
                <label htmlFor="signin-password" className="sr-only">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="signin-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password"
                    className="sp-input w-full py-3 pl-4 pr-12 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    aria-pressed={showPassword}
                    className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-[#969696] transition-colors hover:bg-[#F3F1EC] hover:text-[#6B6B6B] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#B88E2F]"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4.5 w-4.5" aria-hidden="true" />
                    ) : (
                      <Eye className="h-4.5 w-4.5" aria-hidden="true" />
                    )}
                  </button>
                </div>
              </div>

              {/* Primary CTA — full-width gold per frame */}
              <button
                type="submit"
                disabled={loading}
                className="sp-cta mt-2 flex w-full items-center justify-center gap-2 py-3 text-sm"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    <span>Signing in…</span>
                  </>
                ) : (
                  <span>Sign in</span>
                )}
              </button>
            </form>

            {/* Provisioned-accounts note — honest replacement for the
                frame's social-login row (no OAuth providers configured) */}
            <div className="mt-8 flex items-start gap-3 rounded-xl border border-[#E3E7E0] bg-white p-4">
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#F3E8CF]"
                aria-hidden="true"
              >
                <KeyRound className="h-4 w-4 text-[#967221]" />
              </span>
              <div>
                <p className="text-xs font-semibold text-[#1A1A1A]">
                  Accounts are provisioned, not self-registered
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-[#6B6B6B]">
                  The platform superadmin creates each business and its owner
                  sign-in; owners add their own staff. Credentials are shared
                  by your administrator.
                </p>
              </div>
            </div>
          </div>
        </div>

        <footer className="pb-6 text-center text-[11px] text-[#969696]">
          © 2026 ServePoint · Point of Sale Platform
        </footer>
      </section>
    </div>
  );
};
