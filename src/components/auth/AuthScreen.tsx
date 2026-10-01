import React, { useState } from 'react';
import { authService, AuthUserSession } from '../../lib/authService';
import {
  Coffee,
  Lock,
  Mail,
  ArrowRight,
  AlertCircle,
  KeyRound,
  ShieldCheck,
} from 'lucide-react';

/**
 * v4.0.0 AuthScreen (owner-mandated rework — ADR-0010 unfreeze order):
 *  - Email + Password sign-in ONLY.
 *  - "Register Cafe" self-serve tab REMOVED (businesses are provisioned by the
 *    SuperAdmin/developer wizard, which creates the owner account).
 *  - "Magic Link" tab REMOVED.
 *  - One-click demo sign-ins + on-screen credentials REMOVED — all accounts and
 *    passwords live in docs/CREDENTIALS.md (copy & paste from there).
 */
interface AuthScreenProps {
  onSuccess: (session: AuthUserSession) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    <div className="min-h-screen bg-[#0A1410] tessera-grain flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#0F1D17] rounded-2xl border border-[#1F3D2E] overflow-hidden animate-in fade-in zoom-in-95 duration-200 tessera-block">
        {/* Brand Banner — italic serif headline on forest */}
        <div className="p-6 bg-gradient-to-br from-[#142620] via-[#0F1D17] to-[#0F1D17] border-b border-[#1F3D2E] text-center relative overflow-hidden">
          {/* 3D isometric block motif — chartreuse cube accent */}
          <div className="absolute top-3 right-3 w-8 h-8 rounded-md bg-[#C5F82A] opacity-90" style={{ transform: 'rotate(12deg)', boxShadow: '2px 2px 0 #1F3D2E' }} />
          <div className="absolute top-5 right-6 w-6 h-6 rounded-md bg-[#34D399] opacity-70" style={{ transform: 'rotate(-8deg)', boxShadow: '2px 2px 0 #1F3D2E' }} />
          <div className="w-14 h-14 rounded-2xl bg-[#C5F82A] text-[#0A1410] flex items-center justify-center mx-auto mb-3" style={{ boxShadow: '3px 3px 0 #1F3D2E' }}>
            <Coffee className="w-7 h-7" strokeWidth={2.5} />
          </div>
          <h1 className="text-2xl text-[#F5F4EE] tracking-tight leading-tight">
            ServePoint
          </h1>
          <p className="text-xs text-[#9BB5A5] mt-1.5 font-medium tracking-wide">
            Multi-Tenant Point-of-Sale &amp; Kitchen Management Platform
          </p>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-[rgba(248,113,113,0.12)] border border-[rgba(248,113,113,0.3)] text-[#F87171] rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-[10px] font-semibold text-[#9BB5A5] uppercase tracking-[0.12em] mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#6B8579]" />
              <input
                type="text"
                inputMode="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@yourbusiness.com"
                className="w-full pl-9 pr-3 py-2.5 text-sm rounded-lg border border-[#1F3D2E] bg-[#0A1410] focus:bg-[#142620] focus:border-[#C5F82A] focus:outline-none text-[#F5F4EE] placeholder-[#6B8579] transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-[#9BB5A5] uppercase tracking-[0.12em] mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#6B8579]" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full pl-9 pr-3 py-2.5 text-sm rounded-lg border border-[#1F3D2E] bg-[#0A1410] focus:bg-[#142620] focus:border-[#C5F82A] focus:outline-none text-[#F5F4EE] placeholder-[#6B8579] transition-colors"
              />
            </div>
          </div>

          {/* Primary CTA — chartreuse with 3D block shadow */}
          <button
            type="submit"
            disabled={loading}
            className="tessera-cta w-full py-3 px-4 rounded-lg font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span>Authenticating…</span>
            ) : (
              <>
                <span>Sign In</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>

          {/* Where credentials live (no secrets on screen) */}
          <div className="pt-4 border-t border-[#1F3D2E]">
            <div className="p-3 rounded-lg bg-[#0A1410] border border-[#1F3D2E] text-[11px] text-[#9BB5A5] flex items-start gap-2.5">
              <KeyRound className="w-4 h-4 text-[#34D399] shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="font-semibold text-[#F5F4EE] flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#34D399]" />
                  Accounts are provisioned, not self-registered
                </div>
                <div className="text-[10px] leading-relaxed text-[#6B8579]">
                  The TSOS developer (SuperAdmin) creates each business + owner account;
                  owners create their staff logins. Sign-in credentials are distributed
                  separately — see <span className="font-bold text-[#C5F82A]">docs/CREDENTIALS.md</span> in
                  the repository.
                </div>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
