import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Copy,
  Loader2,
  RefreshCw,
  X,
} from 'lucide-react';
import { provisionBusiness } from '../../lib/api';
import { authService } from '../../lib/authService';
import { formatMoney } from '../../lib/prefs';
import type { Tenant } from '../../types';

/**
 * ServePoint Platform — "Add Business" provisioning wizard (ADR-0013).
 * Three steps: Business → Owner account → Review & provision. Creates the
 * tenant (provisionBusiness) AND the owner login (authService.signUp with the
 * generated temporary password), then hands the credentials to the operator.
 */

export interface ProvisioningWizardProps {
  open: boolean;
  onClose: () => void;
  onProvisioned: () => void;
}

type WizardStep = 1 | 2 | 3;
type PlanChoice = 'trial' | 'standard';

interface WizardForm {
  name: string;
  businessType: string;
  city: string;
  slug: string;
  plan: PlanChoice;
  monthlyPrice: string;
  ownerName: string;
  ownerEmail: string;
  ownerPassword: string;
}

interface ProvisionOutcome {
  tenant: Tenant | null;
  cloudError?: string;
  authNotice?: string;
}

const BUSINESS_TYPES = [
  { value: 'cafe', label: 'Cafe' },
  { value: 'restaurant', label: 'Restaurant' },
  { value: 'bakery', label: 'Bakery' },
  { value: 'qsr', label: 'QSR' },
];

const STEP_LABELS = ['Business', 'Owner account', 'Review'] as const;
const SLUG_PATTERN = /^[a-z0-9-]+$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* ─────────────────────────── helpers ─────────────────────────── */

const PW_POOLS = [
  'ABCDEFGHJKLMNPQRSTUVWXYZ', // upper
  'abcdefghijkmnpqrstuvwxyz', // lower
  '23456789', // digits
  '!@#$%^&*-_', // symbols
];

function randomIndex(max: number): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] % max;
}

function generateStrongPassword(length = 16): string {
  const chars: string[] = PW_POOLS.map((pool) => pool.charAt(randomIndex(pool.length)));
  const all = PW_POOLS.join('');
  while (chars.length < length) chars.push(all.charAt(randomIndex(all.length)));
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomIndex(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to the legacy path */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

function freshForm(): WizardForm {
  return {
    name: '',
    businessType: 'cafe',
    city: '',
    slug: '',
    plan: 'trial',
    monthlyPrice: '4999',
    ownerName: '',
    ownerEmail: '',
    ownerPassword: generateStrongPassword(),
  };
}

/* ─────────────────────── small presentational bits ─────────────────────── */

const FieldLabel: React.FC<{ htmlFor: string; required?: boolean; children: React.ReactNode }> = ({
  htmlFor,
  required,
  children,
}) => (
  <label htmlFor={htmlFor} className="mb-1.5 block text-xs font-medium text-[#6B6B6B]">
    {children}
    {required && <span className="ml-0.5 text-[#B42318]">*</span>}
  </label>
);

const FieldError: React.FC<{ id: string; message?: string }> = ({ id, message }) =>
  message ? (
    <p id={id} className="mt-1 text-xs font-medium text-[#B42318]">
      {message}
    </p>
  ) : null;

const inputClass =
  'sp-input h-11 w-full px-3.5 text-sm placeholder:text-[#969696] aria-[invalid=true]:border-[#B42318]';

/* ──────────────────────────── component ──────────────────────────── */

export const ProvisioningWizard: React.FC<ProvisioningWizardProps> = ({
  open,
  onClose,
  onProvisioned,
}) => {
  const [step, setStep] = useState<WizardStep | 4>(1); // 4 = success screen
  const [form, setForm] = useState<WizardForm>(freshForm);
  const [slugTouched, setSlugTouched] = useState(false);
  const [stepErrors, setStepErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<ProvisionOutcome | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const copyTimer = useRef<number | null>(null);

  /* Fresh wizard on every open; lock body scroll while open. */
  useEffect(() => {
    if (!open) return;
    setStep(1);
    setForm(freshForm());
    setSlugTouched(false);
    setStepErrors({});
    setError(null);
    setOutcome(null);
    setSubmitting(false);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  /* Escape closes the dialog — unless a provision run is in flight. */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, submitting, onClose]);

  useEffect(() => {
    return () => {
      if (copyTimer.current !== null) window.clearTimeout(copyTimer.current);
    };
  }, []);

  const patch = (changes: Partial<WizardForm>) => setForm((f) => ({ ...f, ...changes }));

  const handleNameChange = (name: string) => {
    setForm((f) => ({ ...f, name, slug: slugTouched ? f.slug : slugify(name) }));
  };

  const handleSlugChange = (slug: string) => {
    setSlugTouched(true);
    setForm((f) => ({ ...f, slug: slug.toLowerCase() }));
  };

  const handleCopy = useCallback(async (key: string, text: string) => {
    const ok = await copyText(text);
    if (!ok) return;
    setCopiedKey(key);
    if (copyTimer.current !== null) window.clearTimeout(copyTimer.current);
    copyTimer.current = window.setTimeout(() => setCopiedKey(null), 2000);
  }, []);

  const validateStep = (target: WizardStep | 4): boolean => {
    const errors: Record<string, string> = {};
    if (target === 1) {
      if (!form.name.trim()) errors.name = 'Business name is required.';
      const slug = form.slug.trim();
      if (!slug) errors.slug = 'Slug is required.';
      else if (!SLUG_PATTERN.test(slug)) errors.slug = 'Use lowercase letters, numbers and dashes only.';
      const price = Number(form.monthlyPrice);
      if (form.monthlyPrice.trim() === '' || Number.isNaN(price) || price < 0) {
        errors.monthlyPrice = 'Enter a valid monthly price.';
      }
    }
    if (target === 2) {
      if (!form.ownerName.trim()) errors.ownerName = 'Owner full name is required.';
      if (!form.ownerEmail.trim()) errors.ownerEmail = 'Owner email is required.';
      else if (!EMAIL_PATTERN.test(form.ownerEmail.trim())) errors.ownerEmail = 'Enter a valid email address.';
      if (form.ownerPassword.length < 8) errors.ownerPassword = 'Temporary password is too short.';
    }
    setStepErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const goNext = () => {
    if (!validateStep(step)) return;
    setStep((s) => (s === 1 ? 2 : 3) as WizardStep);
  };

  const goBack = () => {
    setStepErrors({});
    setStep((s) => (s === 3 ? 2 : 1) as WizardStep);
  };

  const handleProvision = async () => {
    if (submitting) return;
    if (!validateStep(3)) {
      setStep(1);
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const result = await provisionBusiness({
        name: form.name.trim(),
        businessType: form.businessType,
        city: form.city.trim(),
        slug: form.slug.trim(),
        planId: form.plan,
        monthlyPrice: Number(form.monthlyPrice),
        ownerName: form.ownerName.trim(),
        ownerEmail: form.ownerEmail.trim(),
        ownerPassword: form.ownerPassword,
      });
      const auth = await authService.signUp(
        form.ownerEmail.trim(),
        form.ownerPassword,
        form.ownerName.trim(),
        'owner',
        { slug: form.slug.trim(), name: form.name.trim() }
      );
      setOutcome({
        tenant: result.tenant,
        cloudError: result.cloudError,
        authNotice: auth.error,
      });
      setStep(4);
    } catch (err: any) {
      setError(err?.message || 'Provisioning failed. Check the details and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDone = () => {
    onProvisioned();
    onClose();
  };

  if (!open) return null;

  const monthlyPrice = Number(form.monthlyPrice);
  const pricePreview = Number.isNaN(monthlyPrice) ? '—' : formatMoney(monthlyPrice);
  const planLabel = form.plan === 'trial' ? 'Trial (status: trial)' : 'Standard (status: active)';

  const copyButton = (key: string, text: string, label: string) => (
    <button
      type="button"
      onClick={() => void handleCopy(key, text)}
      aria-label={`Copy ${label}`}
      className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-xl border border-[#E3E7E0] bg-white px-3 text-xs font-semibold text-[#0F3D3E] transition-colors hover:bg-[#F6F5F2]"
    >
      {copiedKey === key ? (
        <>
          <Check size={14} className="text-[#2E7D32]" aria-hidden />
          Copied
        </>
      ) : (
        <>
          <Copy size={14} aria-hidden />
          Copy
        </>
      )}
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-[#0F3D3E]/45"
        aria-hidden
        onClick={() => {
          if (!submitting) onClose();
        }}
      />

      {/* Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="provision-wizard-title"
        className="relative max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-[#E3E7E0] bg-white p-6 shadow-xl"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            {step !== 4 && (
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#969696]">
                Step {step} of 3 — {STEP_LABELS[step - 1]}
              </p>
            )}
            <h2 id="provision-wizard-title" className="mt-1 text-xl font-semibold text-[#1A1A1A]">
              Add Business
            </h2>
          </div>
          <button
            type="button"
            onClick={() => {
              if (!submitting) onClose();
            }}
            disabled={submitting}
            aria-label="Close wizard"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[#6B6B6B] transition-colors hover:bg-[#F6F5F2] disabled:opacity-50"
          >
            <X size={18} aria-hidden />
          </button>
        </div>

        {/* Step indicator (gold dots) */}
        {step !== 4 && (
          <ol className="mt-5 flex items-center gap-2" aria-label="Wizard progress">
            {STEP_LABELS.map((label, i) => {
              const idx = (i + 1) as WizardStep;
              const current = step === idx;
              const done = step > idx;
              return (
                <li key={label} className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className={`h-2.5 w-2.5 rounded-full ${
                      done || current ? 'bg-[#B88E2F]' : 'bg-[#E3E7E0]'
                    } ${current ? 'ring-4 ring-[#F3E8CF]' : ''}`}
                  />
                  <span
                    className={`text-xs ${
                      current ? 'font-semibold text-[#1A1A1A]' : done ? 'font-medium text-[#6B6B6B]' : 'text-[#969696]'
                    }`}
                  >
                    {label}
                  </span>
                  {i < STEP_LABELS.length - 1 && <span aria-hidden className="mx-1 h-px w-4 bg-[#E3E7E0]" />}
                </li>
              );
            })}
          </ol>
        )}

        {/* ── Step 1: Business ── */}
        {step === 1 && (
          <form
            className="mt-5 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              goNext();
            }}
          >
            <div>
              <FieldLabel htmlFor="pw-name" required>
                Business name
              </FieldLabel>
              <input
                id="pw-name"
                type="text"
                autoComplete="off"
                autoFocus
                value={form.name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="e.g. Blue Ember Coffee"
                aria-invalid={Boolean(stepErrors.name)}
                aria-describedby={stepErrors.name ? 'pw-name-error' : undefined}
                className={inputClass}
              />
              <FieldError id="pw-name-error" message={stepErrors.name} />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <FieldLabel htmlFor="pw-type" required>
                  Type
                </FieldLabel>
                <select
                  id="pw-type"
                  value={form.businessType}
                  onChange={(e) => patch({ businessType: e.target.value })}
                  className={inputClass}
                >
                  {BUSINESS_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <FieldLabel htmlFor="pw-city">City</FieldLabel>
                <input
                  id="pw-city"
                  type="text"
                  autoComplete="off"
                  value={form.city}
                  onChange={(e) => patch({ city: e.target.value })}
                  placeholder="e.g. Pune"
                  className={inputClass}
                />
              </div>
            </div>

            <div>
              <FieldLabel htmlFor="pw-slug" required>
                Slug
              </FieldLabel>
              <input
                id="pw-slug"
                type="text"
                autoComplete="off"
                value={form.slug}
                onChange={(e) => handleSlugChange(e.target.value)}
                placeholder="blue-ember-coffee"
                aria-invalid={Boolean(stepErrors.slug)}
                aria-describedby={stepErrors.slug ? 'pw-slug-error' : 'pw-slug-hint'}
                className={`${inputClass} lowercase`}
              />
              {stepErrors.slug ? (
                <FieldError id="pw-slug-error" message={stepErrors.slug} />
              ) : (
                <p id="pw-slug-hint" className="mt-1 text-xs text-[#969696]">
                  Auto-generated from the name — lowercase letters, numbers and dashes only.
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <FieldLabel htmlFor="pw-plan" required>
                  Plan
                </FieldLabel>
                <select
                  id="pw-plan"
                  value={form.plan}
                  onChange={(e) => patch({ plan: e.target.value as PlanChoice })}
                  className={inputClass}
                >
                  <option value="trial">Trial (14 days)</option>
                  <option value="standard">Standard (active)</option>
                </select>
              </div>
              <div>
                <FieldLabel htmlFor="pw-price" required>
                  Monthly price
                </FieldLabel>
                <input
                  id="pw-price"
                  type="number"
                  min={0}
                  step={1}
                  inputMode="numeric"
                  value={form.monthlyPrice}
                  onChange={(e) => patch({ monthlyPrice: e.target.value })}
                  aria-invalid={Boolean(stepErrors.monthlyPrice)}
                  aria-describedby={stepErrors.monthlyPrice ? 'pw-price-error' : 'pw-price-preview'}
                  className={inputClass}
                />
                {stepErrors.monthlyPrice ? (
                  <FieldError id="pw-price-error" message={stepErrors.monthlyPrice} />
                ) : (
                  <p id="pw-price-preview" className="mt-1 text-xs text-[#969696]">
                    Charged at {pricePreview} / month
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button type="submit" className="sp-cta h-11 rounded-xl px-5 text-[13px]">
                Continue
              </button>
            </div>
          </form>
        )}

        {/* ── Step 2: Owner account ── */}
        {step === 2 && (
          <form
            className="mt-5 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              goNext();
            }}
          >
            <div>
              <FieldLabel htmlFor="pw-owner-name" required>
                Owner full name
              </FieldLabel>
              <input
                id="pw-owner-name"
                type="text"
                autoComplete="name"
                autoFocus
                value={form.ownerName}
                onChange={(e) => patch({ ownerName: e.target.value })}
                placeholder="e.g. Aisha Kapoor"
                aria-invalid={Boolean(stepErrors.ownerName)}
                aria-describedby={stepErrors.ownerName ? 'pw-owner-name-error' : undefined}
                className={inputClass}
              />
              <FieldError id="pw-owner-name-error" message={stepErrors.ownerName} />
            </div>

            <div>
              <FieldLabel htmlFor="pw-owner-email" required>
                Owner email
              </FieldLabel>
              <input
                id="pw-owner-email"
                type="text"
                inputMode="email"
                autoComplete="email"
                value={form.ownerEmail}
                onChange={(e) => patch({ ownerEmail: e.target.value })}
                placeholder="owner@blueember.com"
                aria-invalid={Boolean(stepErrors.ownerEmail)}
                aria-describedby={stepErrors.ownerEmail ? 'pw-owner-email-error' : undefined}
                className={inputClass}
              />
              <FieldError id="pw-owner-email-error" message={stepErrors.ownerEmail} />
            </div>

            <div>
              <FieldLabel htmlFor="pw-owner-password" required>
                Temporary password
              </FieldLabel>
              <div className="flex flex-wrap items-center gap-2 rounded-xl bg-[#F6F5F2] p-3">
                <output
                  id="pw-owner-password"
                  className="min-w-0 flex-1 break-all font-mono text-sm font-medium tracking-wide text-[#1A1A1A]"
                >
                  {form.ownerPassword}
                </output>
                <button
                  type="button"
                  onClick={() => patch({ ownerPassword: generateStrongPassword() })}
                  aria-label="Regenerate temporary password"
                  className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-xl border border-[#E3E7E0] bg-white px-3 text-xs font-semibold text-[#0F3D3E] transition-colors hover:bg-[#F6F5F2]"
                >
                  <RefreshCw size={14} aria-hidden />
                  Regenerate
                </button>
                {copyButton('password', form.ownerPassword, 'temporary password')}
              </div>
              {stepErrors.ownerPassword ? (
                <FieldError id="pw-owner-password-error" message={stepErrors.ownerPassword} />
              ) : (
                <p className="mt-1 text-xs text-[#969696]">
                  Strong auto-generated password — regenerate or copy it for handover.
                </p>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={goBack}
                className="inline-flex h-11 items-center gap-2 rounded-xl border border-[#E3E7E0] px-4 text-[13px] font-semibold text-[#0F3D3E] transition-colors hover:bg-[#F6F5F2]"
              >
                <ArrowLeft size={15} aria-hidden />
                Back
              </button>
              <button type="submit" className="sp-cta h-11 rounded-xl px-5 text-[13px]">
                Continue
              </button>
            </div>
          </form>
        )}

        {/* ── Step 3: Review & provision ── */}
        {step === 3 && (
          <div className="mt-5 space-y-4">
            <dl className="divide-y divide-[#E3E7E0] rounded-2xl border border-[#E3E7E0]">
              {[
                ['Business name', form.name.trim()],
                ['Type', BUSINESS_TYPES.find((t) => t.value === form.businessType)?.label || form.businessType],
                ['City', form.city.trim() || '—'],
                ['Slug', form.slug.trim()],
                ['Plan', planLabel],
                ['Monthly price', pricePreview],
                ['Owner name', form.ownerName.trim()],
                ['Owner email', form.ownerEmail.trim()],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <dt className="shrink-0 text-xs font-medium text-[#969696]">{label}</dt>
                  <dd className="min-w-0 truncate text-right text-[13px] font-medium text-[#1A1A1A]">{value}</dd>
                </div>
              ))}
              <div className="flex items-center justify-between gap-3 px-4 py-2.5">
                <dt className="shrink-0 text-xs font-medium text-[#969696]">Temporary password</dt>
                <dd className="min-w-0 truncate text-right font-mono text-[13px] font-medium text-[#1A1A1A]">
                  {form.ownerPassword}
                </dd>
              </div>
            </dl>

            <p className="text-xs leading-relaxed text-[#6B6B6B]">
              Provisioning creates the business and registers the owner account immediately with the
              temporary password. Hand the credentials to the business owner after this wizard closes.
            </p>

            {error && (
              <div className="flex items-start gap-2 rounded-xl border border-[#F5C6C0] bg-[#FEF2F2] p-3 text-xs leading-relaxed text-[#B42318]" role="alert">
                <AlertTriangle size={15} className="mt-0.5 shrink-0" aria-hidden />
                <span className="break-words">{error}</span>
              </div>
            )}

            <div className="flex items-center justify-between gap-3 pt-1">
              <button
                type="button"
                onClick={goBack}
                disabled={submitting}
                className="inline-flex h-11 items-center gap-2 rounded-xl border border-[#E3E7E0] px-4 text-[13px] font-semibold text-[#0F3D3E] transition-colors hover:bg-[#F6F5F2] disabled:opacity-50"
              >
                <ArrowLeft size={15} aria-hidden />
                Back
              </button>
              <button
                type="button"
                onClick={() => void handleProvision()}
                disabled={submitting}
                className="sp-cta inline-flex h-11 items-center gap-2 rounded-xl px-5 text-[13px]"
              >
                {submitting && <Loader2 size={15} className="animate-spin" aria-hidden />}
                Provision business
              </button>
            </div>
          </div>
        )}

        {/* ── Success screen ── */}
        {step === 4 && outcome && (
          <div className="mt-5 space-y-4">
            <div className="flex flex-col items-center pt-1 text-center">
              <CheckCircle2 size={48} strokeWidth={1.8} className="text-[#2E7D32]" aria-hidden />
              <h3 className="mt-3 text-xl font-semibold text-[#1A1A1A]">Business provisioned</h3>
              {outcome.tenant && (
                <p className="mt-1 text-sm text-[#6B6B6B]">
                  {outcome.tenant.name}
                  {outcome.tenant.slug ? ` · ${outcome.tenant.slug}` : ''}
                </p>
              )}
            </div>

            {outcome.cloudError ? (
              <div
                className="flex items-start gap-2 rounded-xl border border-[#EBCF8E] bg-[#F3E8CF] p-3 text-xs leading-relaxed text-[#7A5C1B]"
                role="status"
              >
                <AlertTriangle size={15} className="mt-0.5 shrink-0" aria-hidden />
                <span className="break-words">
                  Cloud notice: {outcome.cloudError} — the business is saved locally only. Retry Add
                  Business in a moment, or create the tenant row in Supabase (docs/CREDENTIALS.md).
                </span>
              </div>
            ) : (
              <p
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#E8F5EC] px-3 py-2.5 text-xs font-semibold text-[#2E7D32]"
                role="status"
              >
                <CheckCircle2 size={15} aria-hidden />
                Saved to cloud
              </p>
            )}

            {outcome.authNotice && (
              <div
                className="flex items-start gap-2 rounded-xl border border-[#EBCF8E] bg-[#F3E8CF] p-3 text-xs leading-relaxed text-[#7A5C1B]"
                role="status"
              >
                <AlertTriangle size={15} className="mt-0.5 shrink-0" aria-hidden />
                <span className="break-words">
                  Account registered locally — ready to sign in. {outcome.authNotice}
                </span>
              </div>
            )}

            {/* Credentials block */}
            <div className="rounded-2xl bg-[#F6F5F2] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#969696]">
                Owner credentials
              </p>
              <div className="mt-3 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#E3E7E0] bg-white p-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium text-[#969696]">Email</p>
                    <p className="break-all text-sm font-medium text-[#1A1A1A]">{form.ownerEmail.trim()}</p>
                  </div>
                  {copyButton('email', form.ownerEmail.trim(), 'owner email')}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#E3E7E0] bg-white p-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium text-[#969696]">Temporary password</p>
                    <p className="break-all font-mono text-sm font-medium tracking-wide text-[#1A1A1A]">
                      {form.ownerPassword}
                    </p>
                  </div>
                  {copyButton('final-password', form.ownerPassword, 'temporary password')}
                </div>
              </div>
              <p className="mt-3 text-center text-xs leading-relaxed text-[#6B6B6B]">
                Hand these to the business owner. They sign in on the login screen and land in their
                business app.
              </p>
            </div>

            <button type="button" onClick={handleDone} className="sp-cta h-11 w-full rounded-xl text-[13px]">
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
