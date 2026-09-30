import React, { useState } from 'react';
import { authService, AuthUserSession } from '../../lib/authService';
import {
  Coffee,
  Lock,
  Mail,
  User,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  ShieldCheck,
  Store,
} from 'lucide-react';

interface AuthScreenProps {
  onSuccess: (session: AuthUserSession, isNewUser?: boolean) => void;
  onOpenOnboarding: () => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onSuccess, onOpenOnboarding }) => {
  const [mode, setMode] = useState<'signin' | 'signup' | 'magic_link'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    try {
      if (mode === 'signin') {
        const res = await authService.signIn(email, password);
        if (res.success && res.session) {
          onSuccess(res.session, false);
        } else {
          setError(res.error || 'Invalid email or password.');
        }
      } else if (mode === 'signup') {
        const res = await authService.signUp(email, password, name);
        if (res.success && res.session) {
          onSuccess(res.session, true);
        } else {
          setError(res.error || 'Failed to create account.');
        }
      } else if (mode === 'magic_link') {
        const res = await authService.sendMagicLink(email);
        if (res.success) {
          setMessage(res.message);
        } else {
          setError(res.error || 'Failed to dispatch magic link.');
        }
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected authentication error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemoLogin = async (role: 'super_admin' | 'owner' | 'manager' | 'cashier') => {
    const demoEmail =
      role === 'super_admin'
        ? 'admin@tsos.dev'
        : role === 'owner'
        ? 'owner@coolkafe.com'
        : role === 'manager'
        ? 'manager@coolkafe.com'
        : 'cashier@coolkafe.com';
    const demoPass = role === 'super_admin' ? 'admin123456' : 'demo123456';
    setEmail(demoEmail);
    setPassword(demoPass);
    setLoading(true);
    const res = await authService.signIn(demoEmail, demoPass);
    setLoading(false);
    if (res.session) {
      onSuccess(res.session, false);
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
            TSOS Cafe Operating System
          </h1>
          <p className="text-xs text-[#9BB5A5] mt-1.5 font-medium tracking-wide">
            Multi-Tenant Point-of-Sale &amp; Kitchen Management Platform
          </p>
        </div>

        {/* Tab Toggle — ghost buttons with chartreuse active underline */}
        <div className="flex border-b border-[#1F3D2E] bg-[#0A1410]/40 text-xs font-semibold">
          <button
            type="button"
            onClick={() => { setMode('signin'); setError(null); setMessage(null); }}
            className={`flex-1 py-3 text-center transition-colors border-b-2 ${
              mode === 'signin'
                ? 'border-[#C5F82A] text-[#C5F82A]'
                : 'border-transparent text-[#6B8579] hover:text-[#F5F4EE]'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setMode('signup'); setError(null); setMessage(null); }}
            className={`flex-1 py-3 text-center transition-colors border-b-2 ${
              mode === 'signup'
                ? 'border-[#C5F82A] text-[#C5F82A]'
                : 'border-transparent text-[#6B8579] hover:text-[#F5F4EE]'
            }`}
          >
            Register Cafe
          </button>
          <button
            type="button"
            onClick={() => { setMode('magic_link'); setError(null); setMessage(null); }}
            className={`flex-1 py-3 text-center transition-colors border-b-2 ${
              mode === 'magic_link'
                ? 'border-[#C5F82A] text-[#C5F82A]'
                : 'border-transparent text-[#6B8579] hover:text-[#F5F4EE]'
            }`}
          >
            Magic Link
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-[rgba(248,113,113,0.12)] border border-[rgba(248,113,113,0.3)] text-[#F87171] rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {message && (
            <div className="p-3 bg-[rgba(52,211,153,0.12)] border border-[rgba(52,211,153,0.3)] text-[#34D399] rounded-xl text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{message}</span>
            </div>
          )}

          {mode === 'signup' && (
            <div>
              <label className="block text-[10px] font-semibold text-[#9BB5A5] uppercase tracking-[0.12em] mb-1.5">
                Your Full Name
              </label>
              <div className="relative">
                <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#6B8579]" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Vikram Malhotra"
                  className="w-full pl-9 pr-3 py-2.5 text-sm rounded-lg border border-[#1F3D2E] bg-[#0A1410] focus:bg-[#142620] focus:border-[#C5F82A] focus:outline-none text-[#F5F4EE] placeholder-[#6B8579] transition-colors"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-[10px] font-semibold text-[#9BB5A5] uppercase tracking-[0.12em] mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#6B8579]" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="owner@yourcafe.com"
                className="w-full pl-9 pr-3 py-2.5 text-sm rounded-lg border border-[#1F3D2E] bg-[#0A1410] focus:bg-[#142620] focus:border-[#C5F82A] focus:outline-none text-[#F5F4EE] placeholder-[#6B8579] transition-colors"
              />
            </div>
          </div>

          {mode !== 'magic_link' && (
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
          )}

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
                <span>
                  {mode === 'signin' ? 'Sign In to Workspace' : mode === 'signup' ? 'Create Cafe Account' : 'Send Magic Link'}
                </span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>

          {/* Quick Demo Access Bar — ghost buttons grid */}
          <div className="pt-4 border-t border-[#1F3D2E]">
            <div className="text-[10px] font-semibold text-[#6B8579] uppercase tracking-[0.15em] text-center mb-2.5">
              Quick One-Click Sign In
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              <button
                type="button"
                onClick={() => handleQuickDemoLogin('super_admin')}
                className="tessera-ghost p-2 rounded-lg text-center text-xs"
              >
                <div className="font-bold text-[#C5F82A]">SuperAdmin</div>
                <div className="text-[10px] text-[#9BB5A5] mt-0.5">Platform</div>
              </button>
              <button
                type="button"
                onClick={() => handleQuickDemoLogin('owner')}
                className="tessera-ghost p-2 rounded-lg text-center text-xs"
              >
                <div className="font-bold text-[#F5F4EE]">Owner</div>
                <div className="text-[10px] text-[#9BB5A5] mt-0.5">Full Access</div>
              </button>
              <button
                type="button"
                onClick={() => handleQuickDemoLogin('manager')}
                className="tessera-ghost p-2 rounded-lg text-center text-xs"
              >
                <div className="font-bold text-[#F5F4EE]">Manager</div>
                <div className="text-[10px] text-[#9BB5A5] mt-0.5">Shift Audit</div>
              </button>
              <button
                type="button"
                onClick={() => handleQuickDemoLogin('cashier')}
                className="tessera-ghost p-2 rounded-lg text-center text-xs"
              >
                <div className="font-bold text-[#F5F4EE]">Cashier</div>
                <div className="text-[10px] text-[#9BB5A5] mt-0.5">POS / Tender</div>
              </button>
            </div>

            {/* Credentials Cheat-Sheet — forest inset card */}
            <div className="mt-3 p-3 rounded-lg bg-[#0A1410] border border-[#1F3D2E] text-[11px] text-[#9BB5A5] space-y-1.5">
              <div className="font-semibold text-[#F5F4EE] flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#34D399]" />
                  Default Credentials
                </span>
                <span className="text-[9px] text-[#34D399] font-bold uppercase tracking-wider flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#34D399] animate-pulse" />
                  Active
                </span>
              </div>
              <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10px] font-mono text-[#9BB5A5]">
                <div>Admin: <span className="text-[#F5F4EE]">admin@tsos.dev</span></div>
                <div>Pass: <span className="text-[#F5F4EE]">admin123456</span></div>
                <div>Owner: <span className="text-[#F5F4EE]">owner@coolkafe.com</span></div>
                <div>Pass: <span className="text-[#F5F4EE]">demo123456</span></div>
              </div>
              <div className="text-[9px] text-[#6B8579] pt-1.5 border-t border-[#1F3D2E]">
                Tip: You can also simply type username <span className="font-bold text-[#C5F82A]">admin</span> or <span className="font-bold text-[#C5F82A]">owner</span>.
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
