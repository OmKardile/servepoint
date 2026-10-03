import React, { useEffect, useRef, useState } from 'react';
import {
  Bell,
  Building2,
  Check,
  ChevronDown,
  CookingPot,
  Copy,
  Eye,
  EyeOff,
  Glasses,
  Globe2,
  ImagePlus,
  Info,
  Loader2,
  Lock,
  LogOut,
  RefreshCw,
  ShieldCheck,
  SlidersHorizontal,
  TriangleAlert,
  User,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { authService } from '../../lib/authService';
import { updateTenantLegal } from '../../lib/api';
import { dbErrorHint } from '../../lib/dbErrors';
import { canPerformAction, getRoleMeta } from '../../lib/rbac';
import { getPrefs, setPrefs, subscribePrefs } from '../../lib/prefs';
import type { SpPrefs } from '../../lib/prefs';
import { useTenant } from '../../lib/tenant';
import { useSession, useUi } from '../../store/session';
import { useCart } from '../../store/cart';
import type { Employee } from '../../types';

/**
 * ServePoint Settings (v5.0.0, ADR-0014) — Checkout_Settings_219-29597 frame:
 * sage section-nav card left (active row white bg, bold ink) + white setting
 * panel right (bold label + small description + gold toggle, hairline
 * dividers, full-width gold Save Changes). Every editable section persists
 * REAL preferences via getPrefs/setPrefs (src/lib/prefs.ts).
 *
 * v5.27.0 adds the owner's Café brand section (migration 024): paste a
 * publicly reachable logo URL → it rides sp_get_public_menu to every guest
 * phone's menu hero. Live preview with an honest broken-URL fallback, an
 * async-aware Save (the gold chip only after the RLS write actually held),
 * and a one-tap Remove back to the honest text-only hero.
 */

/* ────────────────────────── shared primitives ───────────────────────── */

type SettingsSection =
  | 'profile'
  | 'brand'
  | 'business'
  | 'notification'
  | 'appearance'
  | 'checkout'
  | 'security'
  | 'language'
  | 'staff';

const SECTION_TITLES: Record<SettingsSection, string> = {
  profile: 'Profile',
  brand: 'Café brand',
  business: 'Business profile',
  notification: 'Notification',
  appearance: 'Appearance',
  checkout: 'Checkout Settings',
  security: 'Security',
  language: 'Language & Region',
  staff: 'Staff accounts',
};

/** Timed confirmation flag ("Saved", "Cleared", "Copied") with cleanup. */
function useTransientFlag(durationMs = 2400): [boolean, () => void] {
  const [on, setOn] = useState(false);
  const timer = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    []
  );
  const fire = () => {
    setOn(true);
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setOn(false), durationMs);
  };
  return [on, fire];
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to legacy path */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

/** ServePoint toggle — sage track, white knob, gold when checked. */
const SPToggle: React.FC<{
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}> = ({ checked, onChange, label, disabled }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    disabled={disabled}
    onClick={() => onChange(!checked)}
    className={`relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200 before:absolute before:-inset-2.5 before:rounded-full before:content-[''] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#967221] disabled:cursor-not-allowed disabled:opacity-45 ${
      checked ? 'bg-[#B88E2F]' : 'bg-[#D9E2DD]'
    }`}
  >
    <span
      aria-hidden
      className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all duration-200 ${
        checked ? 'left-[22px]' : 'left-0.5'
      }`}
    />
  </button>
);

const SectionHeading: React.FC<{ title: string; description?: string }> = ({
  title,
  description,
}) => (
  <div>
    <h2 className="text-[17px] font-semibold text-[#1A1A1A]">{title}</h2>
    {description && (
      <p className="mt-1 text-[13px] leading-relaxed text-[#6B6B6B]">{description}</p>
    )}
  </div>
);

const SettingRow: React.FC<{
  label: string;
  description?: string;
  last?: boolean;
  children: React.ReactNode;
}> = ({ label, description, last, children }) => (
  <div
    className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-4 ${
      last ? '' : 'border-b border-[#E3E7E0]'
    }`}
  >
    <div className="min-w-0">
      <p className="text-[14px] font-semibold text-[#1A1A1A]">{label}</p>
      {description && (
        <p className="mt-0.5 text-[12px] leading-relaxed text-[#6B6B6B]">{description}</p>
      )}
    </div>
    <div className="flex items-center gap-3">{children}</div>
  </div>
);

/** Full-width gold Save Changes + inline "Saved" confirmation chip. */
const SectionSave: React.FC<{ onPersist: () => void; buttonLabel?: string }> = ({
  onPersist,
  buttonLabel = 'Save Changes',
}) => {
  const [saved, fireSaved] = useTransientFlag(2400);
  return (
    <div className="mt-6 flex flex-wrap items-center gap-3">
      <button
        type="button"
        className="sp-cta min-h-[44px] flex-1 py-2.5 text-[14px]"
        onClick={() => {
          onPersist();
          fireSaved();
        }}
      >
        {buttonLabel}
      </button>
      {saved && (
        <span
          role="status"
          className="inline-flex items-center gap-1.5 rounded-full bg-[#E8F5EC] px-3.5 py-2 text-[12px] font-semibold text-[#2E7D32]"
        >
          <Check size={14} aria-hidden /> Saved
        </span>
      )}
    </div>
  );
};

const Note: React.FC<{ tone: 'amber' | 'error' | 'success'; children: React.ReactNode }> = ({
  tone,
  children,
}) => {
  const cls =
    tone === 'amber'
      ? 'bg-[#FCF1DF] text-[#8A5A0B]'
      : tone === 'error'
        ? 'bg-[#FEF2F2] text-[#B42318]'
        : 'bg-[#E8F5EC] text-[#2E7D32]';
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={`flex items-start gap-2 rounded-xl px-3.5 py-2.5 text-[12.5px] leading-relaxed ${cls}`}
    >
      {tone === 'success' ? (
        <Check size={14} aria-hidden className="mt-0.5 shrink-0" />
      ) : (
        <TriangleAlert size={14} aria-hidden className="mt-0.5 shrink-0" />
      )}
      <span>{children}</span>
    </div>
  );
};

const CopyButton: React.FC<{ value: string; label: string }> = ({ value, label }) => {
  const [copied, fireCopied] = useTransientFlag(1600);
  const onCopy = async () => {
    const ok = await copyToClipboard(value);
    if (ok) fireCopied();
  };
  return (
    <button
      type="button"
      onClick={onCopy}
      aria-label={`Copy ${label}`}
      className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-xl border border-[#E3E7E0] bg-white px-3.5 text-[12.5px] font-semibold text-[#0F3D3E] transition-colors hover:bg-[#F6F5F2] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#967221]"
    >
      {copied ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
};

const PasswordField: React.FC<{
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
}> = ({ id, label, value, onChange, autoComplete }) => {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label htmlFor={id} className="text-[12.5px] font-semibold text-[#1A1A1A]">
        {label}
      </label>
      <div className="relative mt-1.5">
        <input
          id={id}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          className="sp-input h-11 w-full pl-3.5 pr-12 text-[14px]"
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          aria-pressed={show}
          className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center rounded-r-xl text-[#6B6B6B] hover:text-[#1A1A1A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#967221]"
        >
          {show ? <EyeOff size={16} aria-hidden /> : <Eye size={16} aria-hidden />}
        </button>
      </div>
    </div>
  );
};

const SPSelect: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}> = ({ label, value, onChange, options }) => (
  <div className="relative">
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="sp-input h-11 w-44 max-w-[52vw] appearance-none pl-3.5 pr-9 text-[13.5px]"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
    <ChevronDown
      size={15}
      aria-hidden
      className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#6B6B6B]"
    />
  </div>
);

/* ──────────────────────────── 1 · Profile ───────────────────────────── */

const ProfileSection: React.FC = () => {
  const session = useSession((s) => s.session);
  const roleMeta = getRoleMeta(session?.role);
  const initial = (session?.name || session?.email || 'S').charAt(0).toUpperCase();

  return (
    <div>
      <SectionHeading title="Profile" description="Your account details as recorded by the platform." />
      <div className="mt-6 flex items-center gap-4">
        <span
          aria-hidden
          className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-[#D9E2DD] text-[26px] font-bold text-[#0F3D3E]"
        >
          {initial}
        </span>
        <div className="min-w-0">
          <p className="truncate text-[16px] font-semibold text-[#1A1A1A]">
            {session?.name || '—'}
          </p>
          <p className="mt-0.5 truncate text-[13px] text-[#6B6B6B]">{session?.email || '—'}</p>
          <span
            className={`mt-2 inline-block rounded-full px-3 py-1 text-[11px] font-semibold ${roleMeta.className}`}
          >
            {roleMeta.label}
          </span>
        </div>
      </div>

      <div className="mt-6 border-t border-[#E3E7E0]">
        <SettingRow label="Workspace" description="The business this login operates">
          <span className="max-w-[52vw] truncate text-[13.5px] font-medium text-[#1A1A1A]">
            {session?.tenantName || 'ServePoint Platform'}
          </span>
        </SettingRow>
        <SettingRow label="Member since" description="Account creation date" last>
          <span className="text-[13.5px] font-medium text-[#1A1A1A]">—</span>
        </SettingRow>
      </div>

      <div className="mt-4 flex items-start gap-2 rounded-xl bg-[#F6F5F2] px-4 py-3 text-[12.5px] leading-relaxed text-[#6B6B6B]">
        <Info size={14} aria-hidden className="mt-0.5 shrink-0 text-[#969696]" />
        <span>Profile details are managed by the platform operator.</span>
      </div>

      <button
        type="button"
        className="sp-cta mt-6 flex min-h-[44px] w-full items-center justify-center gap-2 py-2.5 text-[14px]"
        onClick={async () => {
          await authService.signOut();
          useSession.getState().setSession(null);
        }}
      >
        <LogOut size={16} aria-hidden /> Sign out
      </button>
    </div>
  );
};

/* ───────────────────────── 2 · Notification ─────────────────────────── */

const NOTIFY_ROWS: { key: keyof SpPrefs['notify']; label: string; description: string }[] = [
  { key: 'messages', label: 'New messages', description: 'Team & personal chats' },
  { key: 'orders', label: 'Order updates', description: 'Bills & payments' },
  { key: 'promotions', label: 'Promotions', description: 'Offers & news' },
];

const NotificationSection: React.FC = () => {
  const [draft, setDraft] = useState<SpPrefs['notify']>(() => ({ ...getPrefs().notify }));

  return (
    <div>
      <SectionHeading title="Notification" description="Choose what ServePoint alerts you about." />
      <div className="mt-6 border-t border-[#E3E7E0]">
        {NOTIFY_ROWS.map((row, i) => (
          <SettingRow
            key={row.key}
            label={row.label}
            description={row.description}
            last={i === NOTIFY_ROWS.length - 1}
          >
            <SPToggle
              label={row.label}
              checked={draft[row.key]}
              onChange={(v) => setDraft((d) => ({ ...d, [row.key]: v }))}
            />
          </SettingRow>
        ))}
      </div>
      <SectionSave onPersist={() => setPrefs({ notify: draft })} />
    </div>
  );
};

/* ───────────────────────── 3 · Appearance ───────────────────────────── */

const AppearanceSection: React.FC = () => {
  const [compact, setCompact] = useState<boolean>(() => getPrefs().compact);

  return (
    <div>
      <SectionHeading title="Appearance" description="Interface style and density." />
      <p className="mt-6 text-[14px] font-semibold text-[#1A1A1A]">Interface style</p>
      <div className="mt-3 rounded-2xl border border-[#E3E7E0] bg-[#EAF0EC] p-4">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-[#0F3D3E]">
            <CookingPot size={20} aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-semibold text-[#1A1A1A]">ServePoint</p>
            <p className="text-[12px] text-[#6B6B6B]">Owner-designed theme</p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[#6B6B6B]">
            <Lock size={12} aria-hidden /> Locked
          </span>
        </div>
        <p className="mt-3 text-[12px] text-[#969696]">ServePoint is the production theme</p>
      </div>

      <div className="mt-4 border-t border-[#E3E7E0]">
        <SettingRow
          label="Compact density"
          description="Tighter rows and smaller text across the app"
          last
        >
          <SPToggle label="Compact density" checked={compact} onChange={setCompact} />
        </SettingRow>
      </div>
      <SectionSave onPersist={() => setPrefs({ compact })} />
    </div>
  );
};

/* ─────────────────────── 4 · Checkout settings ──────────────────────── */

const CheckoutSection: React.FC = () => {
  const [saveHistory, setSaveHistory] = useState<boolean>(() => getPrefs().savePaymentHistory);
  const [methods, setMethods] = useState<SpPrefs['paymentMethods']>(() => ({
    ...getPrefs().paymentMethods,
  }));
  const [confirmClear, setConfirmClear] = useState(false);
  const [cleared, fireCleared] = useTransientFlag(2400);

  const doClear = () => {
    useCart.getState().clear();
    setConfirmClear(false);
    fireCleared();
  };

  return (
    <div>
      <SectionHeading
        title="Checkout Settings"
        description="Payments accepted at the counter and bill history."
      />

      <p className="mt-6 text-[14px] font-semibold text-[#1A1A1A]">Payment History</p>
      <div className="mt-1 border-t border-[#E3E7E0]">
        <SettingRow
          label="Save payment history"
          description="Bills are cached on this device for exports and audits"
        >
          <SPToggle
            label="Save payment history"
            checked={saveHistory}
            onChange={setSaveHistory}
          />
        </SettingRow>
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3">
          <p className="text-[12.5px] text-[#6B6B6B]">
            Clear locally cached bill drafts stored in this browser.
          </p>
          {confirmClear ? (
            <span className="flex flex-wrap items-center gap-x-3 text-[12.5px]">
              <span className="font-medium text-[#B42318]">
                This clears locally cached bill drafts
              </span>
              <button
                type="button"
                onClick={doClear}
                className="inline-flex min-h-[44px] items-center rounded-lg px-1 font-semibold text-[#B42318] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#967221]"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => setConfirmClear(false)}
                className="inline-flex min-h-[44px] items-center rounded-lg px-1 font-semibold text-[#6B6B6B] hover:text-[#1A1A1A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#967221]"
              >
                Cancel
              </button>
            </span>
          ) : cleared ? (
            <span
              role="status"
              className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-[#2E7D32]"
            >
              <Check size={14} aria-hidden /> Cleared
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmClear(true)}
              className="inline-flex min-h-[44px] items-center px-1 text-[12.5px] font-semibold text-[#2E7D32] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#967221]"
            >
              Clear history
            </button>
          )}
        </div>
      </div>

      <p className="mt-4 text-[14px] font-semibold text-[#1A1A1A]">Payment Method</p>
      <p className="mt-0.5 text-[12px] text-[#6B6B6B]">Methods accepted at the counter</p>
      <div className="mt-1 border-t border-[#E3E7E0]">
        <SettingRow label="Bank Card">
          <SPToggle
            label="Bank Card"
            checked={methods.card}
            onChange={(v) => setMethods((m) => ({ ...m, card: v }))}
          />
        </SettingRow>
        <SettingRow label="Cash">
          <SPToggle
            label="Cash"
            checked={methods.cash}
            onChange={(v) => setMethods((m) => ({ ...m, cash: v }))}
          />
        </SettingRow>
        <SettingRow label="UPI" last>
          <SPToggle
            label="UPI"
            checked={methods.upi}
            onChange={(v) => setMethods((m) => ({ ...m, upi: v }))}
          />
        </SettingRow>
      </div>

      <SectionSave
        onPersist={() => setPrefs({ savePaymentHistory: saveHistory, paymentMethods: methods })}
      />
    </div>
  );
};

/* ─────────────────────────── 5 · Security ───────────────────────────── */

const LOCAL_PASSWORD_NOTICE =
  'This account is provisioned locally. Password changes are managed by the account creator.';

const SecuritySection: React.FC = () => {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [status, setStatus] = useState<'idle' | 'saving' | 'updated' | 'local' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);

  const submit = async () => {
    setMessage(null);
    if (!current || !next || !confirmPw) {
      setStatus('error');
      setMessage('Fill in all three password fields.');
      return;
    }
    if (next.length < 6) {
      setStatus('error');
      setMessage('New password must be at least 6 characters.');
      return;
    }
    if (next !== confirmPw) {
      setStatus('error');
      setMessage('New password and confirmation do not match.');
      return;
    }
    setStatus('saving');
    try {
      const { error } = await supabase.auth.updateUser({ password: next });
      if (error) {
        setStatus('local');
        setMessage(LOCAL_PASSWORD_NOTICE);
        return;
      }
      setStatus('updated');
      setCurrent('');
      setNext('');
      setConfirmPw('');
    } catch {
      setStatus('local');
      setMessage(LOCAL_PASSWORD_NOTICE);
    }
  };

  return (
    <div>
      <SectionHeading title="Security" description="Change your password and protect the account." />

      <p className="mt-6 text-[14px] font-semibold text-[#1A1A1A]">Change password</p>
      <div className="mt-3 space-y-4">
        <PasswordField
          id="sp-current-password"
          label="Current password"
          value={current}
          onChange={setCurrent}
          autoComplete="current-password"
        />
        <PasswordField
          id="sp-new-password"
          label="New password"
          value={next}
          onChange={setNext}
          autoComplete="new-password"
        />
        <PasswordField
          id="sp-confirm-password"
          label="Confirm new password"
          value={confirmPw}
          onChange={setConfirmPw}
          autoComplete="new-password"
        />
      </div>

      {status === 'error' && message && (
        <div className="mt-4">
          <Note tone="error">{message}</Note>
        </div>
      )}
      {status === 'local' && message && (
        <div className="mt-4">
          <Note tone="amber">{message}</Note>
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={submit}
          disabled={status === 'saving'}
          className="sp-cta min-h-[44px] flex-1 py-2.5 text-[14px]"
        >
          {status === 'saving' ? 'Updating…' : 'Update password'}
        </button>
        {status === 'updated' && (
          <span
            role="status"
            className="inline-flex items-center gap-1.5 rounded-full bg-[#E8F5EC] px-3.5 py-2 text-[12px] font-semibold text-[#2E7D32]"
          >
            <Check size={14} aria-hidden /> Password updated
          </span>
        )}
      </div>

      <div className="mt-6 border-t border-[#E3E7E0]">
        <SettingRow
          label="Two-factor authentication"
          description="Available on cloud accounts"
          last
        >
          <SPToggle
            label="Two-factor authentication"
            checked={false}
            onChange={() => {}}
            disabled
          />
        </SettingRow>
      </div>
    </div>
  );
};

/* ────────────────────── 6 · Language & Region ───────────────────────── */

const CURRENCY_OPTIONS: { value: string; label: string }[] = [
  { value: '₹', label: '₹ INR — Indian Rupee' },
  { value: '$', label: '$ USD — US Dollar' },
  { value: '€', label: '€ EUR — Euro' },
];
const TIMEZONE_OPTIONS: { value: string; label: string }[] = [
  { value: 'Asia/Kolkata', label: 'Asia/Kolkata' },
  { value: 'Asia/Dubai', label: 'Asia/Dubai' },
  { value: 'Asia/Singapore', label: 'Asia/Singapore' },
  { value: 'Europe/London', label: 'Europe/London' },
  { value: 'America/New_York', label: 'America/New_York' },
];

const LanguageRegionSection: React.FC = () => {
  const [currency, setCurrency] = useState<string>(() => getPrefs().currency);
  const [timezone, setTimezone] = useState<string>(() => getPrefs().timezone);

  return (
    <div>
      <SectionHeading
        title="Language & Region"
        description="Currency and timezone used across bills and reports."
      />
      <div className="mt-6 border-t border-[#E3E7E0]">
        <SettingRow label="Currency" description="Applied to menus, bills and dashboards">
          <SPSelect
            label="Currency"
            value={currency}
            onChange={setCurrency}
            options={CURRENCY_OPTIONS}
          />
        </SettingRow>
        <SettingRow label="Language" description="Interface language">
          <SPSelect
            label="Language"
            value="English"
            onChange={() => {}}
            options={[{ value: 'English', label: 'English' }]}
          />
        </SettingRow>
        <SettingRow label="Timezone" description="Timestamps in reports and shifts" last>
          <SPSelect
            label="Timezone"
            value={timezone}
            onChange={setTimezone}
            options={TIMEZONE_OPTIONS}
          />
        </SettingRow>
      </div>
      <SectionSave onPersist={() => setPrefs({ currency, timezone })} />
    </div>
  );
};

/* ─────────────────────── 7 · Staff accounts (owner) ─────────────────── */

function generateTempPassword(): string {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const digits = '23456789';
  const pick = (set: string): string => {
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      const buf = new Uint32Array(1);
      crypto.getRandomValues(buf);
      return set[Math.floor((buf[0] / 4294967296) * set.length)];
    }
    return set[Math.floor(Math.random() * set.length)];
  };
  const half = (): string => `${pick(letters)}${pick(letters)}${pick(letters)}${pick(digits)}`;
  return `${half()}-${half()}`;
}

const CredentialRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white px-3.5 py-2.5">
    <div className="min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[#969696]">{label}</p>
      <p className="mt-0.5 break-all text-[14px] font-semibold text-[#1A1A1A]">{value}</p>
    </div>
    <CopyButton value={value} label={label.toLowerCase()} />
  </div>
);

const StaffSection: React.FC = () => {
  const session = useSession((s) => s.session);
  const { loading: tenantLoading, error: tenantError, tenantId } = useTenant();

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  const [formOpen, setFormOpen] = useState(false);
  const [staffName, setStaffName] = useState('');
  const [staffEmail, setStaffEmail] = useState('');
  const [tempPassword, setTempPassword] = useState<string>(() => generateTempPassword());
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [created, setCreated] = useState<{
    email: string;
    password: string;
    cloudNotice?: string;
  } | null>(null);

  useEffect(() => {
    if (!tenantId) {
      setListLoading(false);
      return;
    }
    let alive = true;
    setListLoading(true);
    setListError(null);
    supabase
      .from('tenant_users')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (!alive) return;
        if (error) {
          setListError(error.message);
          setEmployees([]);
        } else {
          setEmployees((data || []) as Employee[]);
        }
        setListLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [tenantId, reloadTick]);

  const openForm = () => {
    setCreated(null);
    setSubmitError(null);
    setTempPassword(generateTempPassword());
    setFormOpen(true);
  };

  const submitCreate = async () => {
    setSubmitError(null);
    const cleanEmail = staffEmail.trim().toLowerCase();
    if (!staffName.trim()) {
      setSubmitError("Enter the staff member's full name.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setSubmitError('Enter a valid email address.');
      return;
    }
    if (tempPassword.length < 6) {
      setTempPassword(generateTempPassword());
      setSubmitError('A stronger password was generated — submit again.');
      return;
    }
    setSubmitting(true);
    const result = await authService.signUp(cleanEmail, tempPassword, staffName.trim(), 'staff', {
      slug: session?.tenantSlug,
      name: session?.tenantName,
    });
    setSubmitting(false);
    if (result.success) {
      setCreated({ email: cleanEmail, password: tempPassword, cloudNotice: result.error });
      setFormOpen(false);
      setStaffName('');
      setStaffEmail('');
      setTempPassword(generateTempPassword());
      setReloadTick((t) => t + 1);
    } else {
      setSubmitError(result.error || 'Could not create the staff login. Try again.');
    }
  };

  return (
    <div>
      <SectionHeading
        title="Staff accounts"
        description="Create logins for your team. Staff operate the whole app but cannot manage accounts."
      />

      {tenantLoading && (
        <div className="mt-5 space-y-3" aria-label="Loading staff accounts">
          <div className="sp-skeleton h-14 w-full" />
          <div className="sp-skeleton h-14 w-full" />
        </div>
      )}

      {!tenantLoading && tenantError && (
        <div className="mt-5">
          <Note tone="error">{tenantError}</Note>
        </div>
      )}

      {!tenantLoading && !tenantError && listError && (
        <div className="mt-5 space-y-2">
          <Note tone="error">{listError}</Note>
          <Note tone="amber">{dbErrorHint(listError)}</Note>
        </div>
      )}

      {!tenantLoading && !tenantError && !listError && (
        <>
          {listLoading ? (
            <div className="mt-5 space-y-3" aria-label="Loading staff accounts">
              <div className="sp-skeleton h-14 w-full" />
              <div className="sp-skeleton h-14 w-full" />
            </div>
          ) : employees.length === 0 ? (
            <div className="mt-6 flex flex-col items-center rounded-2xl border border-[#E3E7E0] bg-[#F6F5F2] px-6 py-10 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#D9E2DD] text-[#0F3D3E]">
                <Users size={24} aria-hidden />
              </span>
              <p className="mt-4 text-[15px] font-semibold text-[#1A1A1A]">No staff accounts yet</p>
              <p className="mt-1 max-w-sm text-[12.5px] leading-relaxed text-[#6B6B6B]">
                Your team signs in with their own logins. Create the first one to get started.
              </p>
              <button type="button" onClick={openForm} className="sp-teal-btn mt-5 px-5 py-2.5 text-[13px]">
                Create staff login
              </button>
            </div>
          ) : (
            <ul className="mt-4 border-t border-[#E3E7E0]">
              {employees.map((e) => {
                const meta = getRoleMeta(e.role);
                const active = e.is_active !== false;
                return (
                  <li
                    key={e.id}
                    className="flex items-center gap-3 border-b border-[#E3E7E0] py-3.5 last:border-b-0"
                  >
                    <span
                      aria-hidden
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#D9E2DD] text-[14px] font-semibold text-[#0F3D3E]"
                    >
                      {(e.email || '?').charAt(0).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-medium text-[#1A1A1A]">{e.email}</p>
                      <p className="text-[12px] text-[#969696]">
                        {e.created_at ? new Date(e.created_at).toDateString() : '—'}
                      </p>
                    </div>
                    <span
                      className={`hidden shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold sm:inline-block ${meta.className}`}
                    >
                      {meta.label}
                    </span>
                    <span
                      className={`block h-2.5 w-2.5 shrink-0 rounded-full ${active ? 'bg-[#2E7D32]' : 'bg-[#C4C9C4]'}`}
                      title={active ? 'Active' : 'Inactive'}
                    >
                      <span className="sr-only">{active ? 'Active' : 'Inactive'}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}

          {created && (
            <div className="mt-6 rounded-2xl border border-[#E3E7E0] bg-[#EAF0EC] p-5" role="status">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#2E7D32] text-white">
                  <Check size={15} aria-hidden />
                </span>
                <p className="text-[14px] font-semibold text-[#1A1A1A]">Staff login created</p>
              </div>
              <div className="mt-4 space-y-2.5">
                <CredentialRow label="Email" value={created.email} />
                <CredentialRow label="Temporary password" value={created.password} />
              </div>
              <p className="mt-4 text-[12.5px] leading-relaxed text-[#6B6B6B]">
                Hand these credentials to your staff member. They sign in on the login screen.
              </p>
              {created.cloudNotice && (
                <div className="mt-3">
                  <Note tone="amber">{created.cloudNotice}</Note>
                </div>
              )}
              <button
                type="button"
                onClick={() => setCreated(null)}
                className="mt-4 min-h-[44px] rounded-xl border border-[#E3E7E0] bg-white px-4 py-2.5 text-[13px] font-semibold text-[#1A1A1A] transition-colors hover:bg-[#F6F5F2] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#967221]"
              >
                Done
              </button>
            </div>
          )}

          {formOpen && !created && (
            <div className="mt-6 rounded-2xl border border-[#E3E7E0] bg-[#F6F5F2] p-5">
              <p className="text-[14px] font-semibold text-[#1A1A1A]">New staff login</p>
              <div className="mt-4 space-y-4">
                <div>
                  <label htmlFor="staff-name" className="text-[12.5px] font-semibold text-[#1A1A1A]">
                    Full name
                  </label>
                  <input
                    id="staff-name"
                    type="text"
                    value={staffName}
                    onChange={(e) => setStaffName(e.target.value)}
                    autoComplete="off"
                    placeholder="Staff member's full name"
                    className="sp-input mt-1.5 h-11 w-full px-3.5 text-[14px]"
                  />
                </div>
                <div>
                  <label htmlFor="staff-email" className="text-[12.5px] font-semibold text-[#1A1A1A]">
                    Email
                  </label>
                  <input
                    id="staff-email"
                    type="text"
                    inputMode="email"
                    autoCapitalize="none"
                    value={staffEmail}
                    onChange={(e) => setStaffEmail(e.target.value)}
                    autoComplete="off"
                    placeholder="name@yourbusiness.com"
                    className="sp-input mt-1.5 h-11 w-full px-3.5 text-[14px]"
                  />
                </div>
                <div>
                  <label
                    htmlFor="staff-temp-password"
                    className="text-[12.5px] font-semibold text-[#1A1A1A]"
                  >
                    Temporary password
                  </label>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <input
                      id="staff-temp-password"
                      type="text"
                      readOnly
                      value={tempPassword}
                      aria-readonly="true"
                      className="sp-input h-11 min-w-0 flex-1 px-3.5 text-[14px] font-semibold tracking-wide"
                    />
                    <button
                      type="button"
                      onClick={() => setTempPassword(generateTempPassword())}
                      aria-label="Generate a new temporary password"
                      className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-xl border border-[#E3E7E0] bg-white px-3.5 text-[12.5px] font-semibold text-[#0F3D3E] transition-colors hover:bg-[#F6F5F2] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#967221]"
                    >
                      <RefreshCw size={14} aria-hidden /> Generate
                    </button>
                    <CopyButton value={tempPassword} label="temporary password" />
                  </div>
                </div>
              </div>

              {submitError && (
                <div className="mt-4">
                  <Note tone="error">{submitError}</Note>
                </div>
              )}

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setFormOpen(false);
                    setSubmitError(null);
                  }}
                  className="min-h-[44px] flex-1 rounded-xl border border-[#E3E7E0] bg-white px-4 py-2.5 text-[13.5px] font-semibold text-[#1A1A1A] transition-colors hover:bg-[#F6F5F2] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#967221]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={submitCreate}
                  disabled={submitting}
                  className="sp-cta min-h-[44px] flex-1 py-2.5 text-[13.5px]"
                >
                  {submitting ? 'Creating…' : 'Create login'}
                </button>
              </div>
            </div>
          )}

          {!formOpen && !created && employees.length > 0 && (
            <button type="button" onClick={openForm} className="sp-cta mt-6 w-full py-3 text-[14px]">
              Create staff login
            </button>
          )}
        </>
      )}
    </div>
  );
};

/* ─────────────────────────── 7 · Café brand ────────────────────────── */

/**
 * Café brand (v5.27.0, migration 024): the owner pastes a publicly
 * reachable logo URL; it rides sp_get_public_menu to every guest phone's
 * menu hero. Honest at both ends — a dead URL hides its own tile on the
 * guest side (never a broken-image glyph), and an RLS refusal here says so
 * instead of pretending to save. NULL is the honest default: no logo means
 * the pre-5.27 text-only hero, exactly as shipped.
 * v5.33.0 (migration 026): the owner can also UPLOAD a file from this
 * device — the tenant-logos storage bucket hosts it (public read, 1 MiB,
 * image mime only), the public URL lands in the same logo_url field and
 * auto-saves. Paste stays for logos that already live on the web.
 */
const CafeBrandSection: React.FC = () => {
  const session = useSession((s) => s.session);
  const { tenantId } = useTenant();
  const [loading, setLoading] = useState<boolean>(() => !!tenantId);
  const [savedUrl, setSavedUrl] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [saved, fireSaved] = useTransientFlag(2400);
  const [previewBroken, setPreviewBroken] = useState(false);
  /* v5.33.0 — device upload state (separate from the save busy: an upload
   * runs storage→then persist, and the two failures read differently). */
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadErr, setUploadErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    if (!tenantId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    void supabase
      .from('tenants')
      .select('logo_url')
      .eq('id', tenantId)
      .single()
      .then(({ data, error }) => {
        if (!alive) return;
        if (!error && data) {
          const url = (data as { logo_url: string | null }).logo_url;
          setSavedUrl(url);
          setDraft(url || '');
        }
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [tenantId]);

  useEffect(() => setPreviewBroken(false), [draft]);

  const trimmed = draft.trim();
  const valid = trimmed === '' || /^https?:\/\/\S+$/i.test(trimmed);
  const dirty = trimmed !== (savedUrl || '');
  const previewSrc = trimmed !== '' && valid && !previewBroken ? trimmed : null;
  const initial = (session?.tenantName || 'C').charAt(0).toUpperCase();

  const persist = async (value: string) => {
    if (!tenantId || busy) return;
    setBusy(true);
    setErr(null);
    const { error } = await supabase
      .from('tenants')
      .update({ logo_url: value === '' ? null : value })
      .eq('id', tenantId);
    setBusy(false);
    if (error) {
      setErr(`Could not save — ${dbErrorHint(error.message) || error.message}`);
      return;
    }
    setSavedUrl(value === '' ? null : value);
    setDraft(value);
    fireSaved();
  };

  /* v5.33.0 — upload from this device: the bucket hosts the file (each
   * operator writes only inside their own user-id folder — migration 026's
   * RLS), the public URL auto-saves into the SAME logo_url field, and the
   * previous UPLOADED logo is retired best-effort so the folder doesn't
   * silt up. Paste-a-URL keeps working untouched beside it. */
  const uploadLogo = async (file: File) => {
    if (!tenantId || uploadBusy) return;
    setUploadErr(null);
    if (file.size > 1048576) {
      setUploadErr(`That file is ${(file.size / 1048576).toFixed(1)} MB — logos stay under 1 MB.`);
      return;
    }
    setUploadBusy(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData?.user?.id;
      if (!uid) throw new Error('not signed in — the upload needs your session');
      const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '') || 'png';
      const path = `${uid}/logo-${Date.now()}.${ext}`;
      const up = await supabase.storage.from('tenant-logos').upload(path, file, {
        cacheControl: '3600',
        contentType: file.type || 'image/png',
      });
      if (up.error) throw up.error;
      const pub = supabase.storage.from('tenant-logos').getPublicUrl(path).data.publicUrl;
      await persist(pub);
      if (savedUrl && savedUrl.includes('/storage/v1/object/public/tenant-logos/')) {
        try {
          const old = decodeURIComponent(savedUrl.split('/object/public/tenant-logos/')[1] || '');
          if (old && old.startsWith(`${uid}/`)) void supabase.storage.from('tenant-logos').remove([old]);
        } catch {
          /* retirement is best-effort — the new logo is already live */
        }
      }
    } catch (e) {
      setUploadErr(`Upload failed — ${e instanceof Error ? e.message : 'unknown error'}`);
    } finally {
      setUploadBusy(false);
    }
  };

  return (
    <div>
      <SectionHeading title="Café brand" description="The face guests see when they scan your table QR." />
      <div className="mt-6 flex items-center gap-4">
        {previewSrc ? (
          <img
            src={previewSrc}
            alt="Café logo preview"
            onError={() => setPreviewBroken(true)}
            className="h-16 w-16 shrink-0 rounded-2xl bg-[#D9E2DD] object-contain p-1.5 shadow-sm"
          />
        ) : (
          <span
            aria-hidden
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[#D9E2DD] text-[22px] font-bold text-[#0F3D3E]"
          >
            {initial}
          </span>
        )}
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold text-[#1A1A1A]">{session?.tenantName || '—'}</p>
          <p className="mt-0.5 text-[12.5px] leading-snug text-[#6B6B6B]">
            {previewBroken
              ? 'That URL doesn’t render — the guest menu will show the café name only.'
              : savedUrl
                ? 'Live on the guest menu’s header tile.'
                : 'No logo yet — the guest menu shows the café name only.'}
          </p>
        </div>
      </div>

      <div className="mt-6 border-t border-[#E3E7E0] pt-5">
        <label htmlFor="cafe-logo-url" className="block text-[13px] font-semibold text-[#1A1A1A]">
          Logo image URL
        </label>
        <p className="mt-1 text-[12px] leading-snug text-[#6B6B6B]">
          Paste a publicly reachable image (https://…). The guest’s phone loads it directly — a private file or dead link never renders.
        </p>
        <input
          id="cafe-logo-url"
          type="url"
          inputMode="url"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="https://example.com/logo.png"
          aria-label="Café logo image URL"
          className={`sp-input mt-3 h-11 w-full text-[13.5px] ${draft !== '' && !valid ? 'border-[#B3261E]' : ''}`}
        />
        {draft !== '' && !valid && (
          <p role="alert" className="mt-2 text-[12px] font-medium text-[#B3261E]">
            Enter a full http(s):// image URL — or clear the field to remove the logo.
          </p>
        )}
        {err && <Note tone="error">{err}</Note>}
      </div>

      {/* v5.33.0 — upload from this device: the bucket hosts it, no URL
          wrangling. The input is sr-only inside a real button-label; the
          value resets on every change so re-choosing the same file after a
          fix still fires. */}
      <div className="mt-5 border-t border-[#E3E7E0] pt-5">
        <label htmlFor="cafe-logo-upload" className="block text-[13px] font-semibold text-[#1A1A1A]">
          Or upload from this device
        </label>
        <p className="mt-1 text-[12px] leading-snug text-[#6B6B6B]">
          PNG, JPEG, WebP, AVIF or SVG up to 1 MB — hosted in your workspace's storage and saved as the logo the moment it lands.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label
            htmlFor="cafe-logo-upload"
            className={`inline-flex min-h-[44px] cursor-pointer items-center justify-center gap-2 rounded-full border border-[#E3E7E0] bg-white px-5 text-[13px] font-semibold text-[#0F3D3E] transition hover:border-[#B88E2F]/50 hover:text-[#8A5A00] ${
              uploadBusy ? 'pointer-events-none opacity-60' : ''
            }`}
          >
            {uploadBusy ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <ImagePlus size={15} aria-hidden />}
            {uploadBusy ? 'Uploading…' : 'Choose image…'}
          </label>
          <input
            id="cafe-logo-upload"
            type="file"
            accept="image/png,image/jpeg,image/webp,image/avif,image/svg+xml"
            className="sr-only"
            disabled={uploadBusy}
            aria-label="Upload café logo image"
            onChange={(e) => {
              const f = e.target.files?.[0] || null;
              e.target.value = '';
              if (f) void uploadLogo(f);
            }}
          />
          {uploadErr && <Note tone="error">{uploadErr}</Note>}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={busy || !dirty || !valid || loading}
          onClick={() => void persist(trimmed)}
          className="sp-cta min-h-[44px] flex-1 py-2.5 text-[14px] disabled:opacity-50"
        >
          {busy ? 'Saving…' : 'Save Changes'}
        </button>
        {savedUrl !== null && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void persist('')}
            className="min-h-[44px] rounded-full border border-[#E3E7E0] px-4 text-[13px] font-semibold text-[#6B6B6B] transition hover:bg-[#F6F5F2] hover:text-[#1A1A1A] disabled:opacity-50"
          >
            Remove logo
          </button>
        )}
        {saved && (
          <span
            role="status"
            className="inline-flex items-center gap-1.5 rounded-full bg-[#E8F5EC] px-3.5 py-2 text-[12px] font-semibold text-[#2E7D32]"
          >
            <Check size={14} aria-hidden /> Saved
          </span>
        )}
      </div>
    </div>
  );
};

/* ───────────────────────── 6.5 · Business profile ─────────────────── */

/**
 * Business profile (Task 90): the tenant's LEGAL identity — the fields the
 * printed bill must carry for an Indian café to hand paper over the counter
 * legally. GSTIN turns the thermal receipt into a TAX INVOICE (ReceiptPrint
 * swaps the document title the moment a GSTIN exists); FSSAI is the food
 * business licence; legal_name/address/phone finish the who-and-where.
 *
 * Writes go through updateTenantLegal (api.ts) straight against tenants —
 * the owner-only UPDATE policy (same grant that lets Café brand save the
 * logo) is the gate; this section is nav-hidden for staff and superadmins,
 * and a leaked write would bounce on RLS anyway. Empty string saves as
 * null — clearing is honest.
 *
 * The styling centerpiece is the thermal PREVIEW: a mini receipt card that
 * re-renders from the drafts on every keystroke — what you save is exactly
 * what the guest holds. The two licence inputs warn softly (shape only,
 * never a hard block — the DB is not the place to outsmart a valid edge
 * GSTIN the government issued).
 */

const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const FSSAI_RE = /^[0-9]{14}$/;

interface LegalDraft {
  legalName: string;
  gst: string;
  fssai: string;
  address: string;
  phone: string;
}

const trimDraft = (d: LegalDraft): LegalDraft => ({
  legalName: d.legalName.trim(),
  gst: d.gst.trim(),
  fssai: d.fssai.trim(),
  address: d.address.trim(),
  phone: d.phone.trim(),
});

const BusinessProfileSection: React.FC = () => {
  const { tenantId } = useTenant();
  const [loading, setLoading] = useState<boolean>(() => !!tenantId);
  const [storeName, setStoreName] = useState('');
  const [draft, setDraft] = useState<LegalDraft>({
    legalName: '',
    gst: '',
    fssai: '',
    address: '',
    phone: '',
  });
  const [saved, setSaved] = useState<LegalDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, fireOk] = useTransientFlag(2400);

  useEffect(() => {
    let alive = true;
    if (!tenantId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    void supabase
      .from('tenants')
      .select('name, legal_name, gst_number, fssai_number, address, owner_phone')
      .eq('id', tenantId)
      .single()
      .then(({ data, error }) => {
        if (!alive) return;
        if (!error && data) {
          const d = data as {
            name: string;
            legal_name: string | null;
            gst_number: string | null;
            fssai_number: string | null;
            address: string | null;
            owner_phone: string | null;
          };
          setStoreName(d.name || '');
          const next: LegalDraft = {
            legalName: d.legal_name || '',
            gst: d.gst_number || '',
            fssai: d.fssai_number || '',
            address: d.address || '',
            phone: d.owner_phone || '',
          };
          setDraft(next);
          setSaved(next);
        }
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [tenantId]);

  const t = trimDraft(draft);
  const s = saved ? trimDraft(saved) : null;
  const dirty = !!s && (t.legalName !== s.legalName || t.gst !== s.gst || t.fssai !== s.fssai || t.address !== s.address || t.phone !== s.phone);
  const gstWarn = t.gst !== '' && !GSTIN_RE.test(t.gst.toUpperCase());
  const fssaiWarn = t.fssai !== '' && !FSSAI_RE.test(t.fssai);

  const persist = async () => {
    if (!tenantId || busy || !dirty) return;
    setBusy(true);
    setErr(null);
    try {
      await updateTenantLegal(tenantId, {
        legalName: t.legalName,
        gstNumber: t.gst,
        fssaiNumber: t.fssai,
        address: t.address,
        phone: t.phone,
      });
      setSaved(t);
      fireOk();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'unknown error';
      setErr(`Could not save — ${dbErrorHint(msg) || msg}`);
    } finally {
      setBusy(false);
    }
  };

  const previewGst = t.gst.toUpperCase();
  const isTaxInvoice = previewGst !== '';

  const legalRow = (label: string, value: string, id: string, opts?: {
    description?: string;
    placeholder?: string;
    warn?: string;
    mono?: boolean;
    maxLength?: number;
  }): React.ReactNode => (
    <div>
      <label htmlFor={id} className="block text-[13px] font-semibold text-[#1A1A1A]">
        {label}
      </label>
      {opts?.description && (
        <p className="mt-1 text-[12px] leading-snug text-[#6B6B6B]">{opts.description}</p>
      )}
      <input
        id={id}
        type="text"
        value={value}
        maxLength={opts?.maxLength ?? 80}
        placeholder={opts?.placeholder}
        autoComplete="off"
        onChange={(e) => setDraft((d) => ({ ...d, [id === 'business-legal-name' ? 'legalName' : id === 'business-gstin' ? 'gst' : id === 'business-fssai' ? 'fssai' : id === 'business-address' ? 'address' : 'phone']: e.target.value }))}
        className={`sp-input mt-1.5 h-11 w-full px-3.5 text-[14px] ${opts?.mono ? 'font-mono tracking-wider uppercase' : ''}`}
      />
      {opts?.warn && (
        <p role="alert" className="mt-1.5 text-[12px] font-medium text-[#B3261E]">
          {opts.warn}
        </p>
      )}
    </div>
  );

  return (
    <div>
      <SectionHeading
        title="Business profile"
        description="The legal identity your printed bills carry — a GSTIN turns every receipt into a tax invoice."
      />

      <div className="mt-6 space-y-5 border-t border-[#E3E7E0] pt-5">
        {legalRow('Legal entity name', draft.legalName, 'business-legal-name', {
          description: 'Printed under the trade name when it differs — the entity the invoice legally belongs to.',
          placeholder: 'Qrflow Hospitality Pvt Ltd',
        })}
        {legalRow('GSTIN', draft.gst, 'business-gstin', {
          description: '15-character GST identification. Present GSTIN → bills print TAX INVOICE with the number.',
          placeholder: '29ABCDE1234F1Z5',
          warn: gstWarn ? 'That does not match the 15-character GSTIN shape — check it before the first print.' : undefined,
          mono: true,
          maxLength: 15,
        })}
        {legalRow('FSSAI licence number', draft.fssai, 'business-fssai', {
          description: 'The 14-digit food business licence printed on every bill.',
          placeholder: '11223344556677',
          warn: fssaiWarn ? 'FSSAI licence numbers are 14 digits — check it before the first print.' : undefined,
          mono: true,
          maxLength: 14,
        })}
        {legalRow('Address', draft.address, 'business-address', {
          description: 'The counter\u2019s address as the bill should show it.',
          placeholder: '12 Marine Street, Bengaluru 560001',
        })}
        {legalRow('Phone', draft.phone, 'business-phone', {
          description: 'Printed on the bill for guests who need to reach you.',
          placeholder: '+91 98000 00000',
        })}
      </div>

      {err && (
        <div className="mt-4">
          <Note tone="error">{err}</Note>
        </div>
      )}

      {/* The thermal preview — what you save is what the guest holds. */}
      <div className="mt-6 rounded-2xl border border-[#E3E7E0] bg-[#F6F5F2] p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[#969696]">
          What the printed bill will carry
        </p>
        <div className="mt-3 rounded-xl border border-dashed border-[#C9CFC5] bg-white px-4 py-3.5 text-center font-mono text-[11px] leading-relaxed text-[#1A1A1A]">
          <div className="text-[13px] font-extrabold tracking-[1px]">
            {storeName || 'Your café'}
          </div>
          {t.legalName !== '' && t.legalName !== storeName && (
            <div className="text-[10px] font-semibold">{t.legalName}</div>
          )}
          {t.address !== '' && <div className="text-[10px] text-[#444]">{t.address}</div>}
          {t.phone !== '' && <div className="text-[10px] text-[#444]">{t.phone}</div>}
          {isTaxInvoice && (
            <div className="mt-1 text-[10px] tracking-[1px]">GSTIN: {previewGst}</div>
          )}
          {t.fssai !== '' && (
            <div className="text-[10px] tracking-[1px]">FSSAI Lic. No: {t.fssai}</div>
          )}
          <div className={`mt-1.5 text-[10px] font-bold tracking-wide ${isTaxInvoice ? 'text-[#2E7D32]' : 'text-[#969696]'}`}>
            {isTaxInvoice ? 'TAX INVOICE' : 'CUSTOMER RECEIPT'}
          </div>
        </div>
        <p className="mt-2.5 text-[11.5px] leading-snug text-[#6B6B6B]">
          {isTaxInvoice
            ? 'Every bill prints as a tax invoice while a GSTIN is saved. Clear it to fall back to a plain receipt.'
            : 'No GSTIN yet — bills print as plain customer receipts. Add the number to make each one a tax invoice.'}
        </p>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={busy || !dirty || loading}
          onClick={() => void persist()}
          className="sp-cta min-h-[44px] flex-1 py-2.5 text-[14px] disabled:opacity-50"
        >
          {busy ? 'Saving…' : 'Save Changes'}
        </button>
        {ok && (
          <span
            role="status"
            className="inline-flex items-center gap-1.5 rounded-full bg-[#E8F5EC] px-3.5 py-2 text-[12px] font-semibold text-[#2E7D32]"
          >
            <Check size={14} aria-hidden /> Saved
          </span>
        )}
      </div>
    </div>
  );
};

/* ─────────────────────────────── screen ─────────────────────────────── */

const NAV_ITEMS: { id: SettingsSection; label: string; icon: LucideIcon }[] = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'notification', label: 'Notification', icon: Bell },
  { id: 'appearance', label: 'Appearance', icon: Glasses },
  { id: 'checkout', label: 'Checkout settings', icon: SlidersHorizontal },
  { id: 'security', label: 'Security', icon: ShieldCheck },
  { id: 'language', label: 'Language & Region', icon: Globe2 },
];

export const SettingsScreen: React.FC = () => {
  const session = useSession((s) => s.session);
  const setBreadcrumb = useUi((s) => s.setBreadcrumb);
  const [active, setActive] = useState<SettingsSection>('checkout');
  const [, setPrefsTick] = useState(0);
  const canManageStaff = canPerformAction(session?.role, 'manage_staff');
  // Registry (provisioned) owner sessions carry tenantSlug but no tenantId —
  // useTenant() resolves the id from the slug, so the gate accepts either.
  const isTenantOwner =
    session?.role === 'owner' && !!(session?.tenantId || session?.tenantSlug);

  useEffect(() => {
    setBreadcrumb(['Settings', 'Checkout Settings']);
    return subscribePrefs(() => setPrefsTick((t) => t + 1));
  }, [setBreadcrumb]);

  const selectSection = (id: SettingsSection) => {
    setActive(id);
    setBreadcrumb(['Settings', SECTION_TITLES[id]]);
  };

  const items = [...NAV_ITEMS];
  // Café brand is an owner decision about THEIR tenant — superadmins run the
  // platform, staff run tickets; only the tenant owner sees the section.
  if (isTenantOwner) items.splice(1, 0, { id: 'brand', label: 'Café brand', icon: ImagePlus });
  // Business profile (Task 90) — the legal twin of brand, same owner gate.
  if (isTenantOwner) items.splice(2, 0, { id: 'business', label: 'Business profile', icon: Building2 });
  if (canManageStaff) items.push({ id: 'staff', label: 'Staff accounts', icon: Users });

  const effective: SettingsSection =
    (active === 'staff' && !canManageStaff) ||
    (active === 'brand' && !isTenantOwner) ||
    (active === 'business' && !isTenantOwner)
      ? 'checkout'
      : active;

  return (
    <div className="p-5 lg:p-8">
      <h1 className="text-[22px] font-semibold tracking-[-0.01em] text-[#1A1A1A]">Settings</h1>

      <div className="mt-5 flex flex-col gap-5 lg:flex-row lg:items-start">
        <nav
          aria-label="Settings sections"
          className="w-full shrink-0 rounded-2xl bg-[#D9E2DD] p-2 lg:w-56"
        >
          <div className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
            {items.map((item) => {
              const Icon = item.icon;
              const isActive = effective === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => selectSection(item.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`sp-nav-pill flex min-h-[44px] shrink-0 items-center gap-2.5 whitespace-nowrap rounded-xl px-3.5 py-2.5 text-[13.5px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#967221] ${
                    isActive
                      ? 'bg-white font-semibold text-[#1A1A1A] shadow-sm'
                      : 'text-[#0F3D3E]/70 hover:bg-white/50'
                  }`}
                >
                  <Icon size={16} aria-hidden className="shrink-0" />
                  {item.label}
                </button>
              );
            })}
          </div>
        </nav>

        <div className="sp-card w-full min-w-0 flex-1 p-5 sm:p-6">
          {effective === 'profile' && <ProfileSection />}
          {effective === 'brand' && <CafeBrandSection />}
          {effective === 'business' && <BusinessProfileSection />}
          {effective === 'notification' && <NotificationSection />}
          {effective === 'appearance' && <AppearanceSection />}
          {effective === 'checkout' && <CheckoutSection />}
          {effective === 'security' && <SecuritySection />}
          {effective === 'language' && <LanguageRegionSection />}
          {effective === 'staff' && <StaffSection />}
        </div>
      </div>
    </div>
  );
};
