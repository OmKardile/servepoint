import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  Bug,
  Check,
  Copy,
  Headphones,
  Info,
  Loader2,
  Mail,
  RefreshCw,
  Send,
} from 'lucide-react';
import { useTenant } from '../../lib/tenant';
import { useSession, useUi } from '../../store/session';

/**
 * Support (v5.0.0, ADR-0014) — built in the ServePoint design language
 * (no dedicated Figma frame). Honest, static support surface: platform
 * operator contact with copy-to-clipboard, docs pointer, and a report
 * form that stores nothing — support requests are relayed by the
 * platform operator (support@servepoint.app).
 */

const SUPPORT_EMAIL = 'support@servepoint.app';

/* ── Honest error card ───────────────────────────────────────────────── */

const ErrorCard: React.FC<{ message: string; onRetry: () => void }> = ({ message, onRetry }) => (
  <div className="sp-card p-6 text-center" role="alert">
    <div className="flex flex-col items-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#D9E2DD] text-[#0F3D3E]">
        <AlertTriangle size={22} aria-hidden />
      </span>
      <h2 className="mt-4 text-[15px] font-semibold text-[#1A1A1A]">Couldn't load Support</h2>
      <p className="mt-2 break-words text-[13px] text-[#6B6B6B]">{message}</p>
      <button onClick={onRetry} className="sp-cta mt-5 flex h-11 items-center gap-2 px-6 text-[13.5px]">
        <RefreshCw size={15} aria-hidden />
        Retry
      </button>
    </div>
  </div>
);

/* ── Report form states ──────────────────────────────────────────────── */

interface ReportDraft {
  subject: string;
  message: string;
}

const ReportForm: React.FC = () => {
  const session = useSession((s) => s.session);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<ReportDraft>({ subject: '', message: '' });
  const [sending, setSending] = useState(false);
  const [submitted, setSubmitted] = useState<ReportDraft | null>(null);

  const canSend = draft.subject.trim().length > 0 && draft.message.trim().length > 0;

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSend || sending) return;
    setSending(true);
    // Honest by design: nothing is stored or transmitted here. The submitted
    // state is local-only and tells the user how the request is actually relayed.
    window.setTimeout(() => {
      setSubmitted({ subject: draft.subject.trim(), message: draft.message.trim() });
      setSending(false);
    }, 350);
  };

  if (submitted) {
    return (
      <div className="rounded-2xl border border-[#E3E7E0] bg-[#EAF0EC] p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-[#2E7D32]">
            <Check size={18} aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-semibold text-[#1A1A1A]">Report ready: {submitted.subject}</p>
            <p className="mt-1 break-words text-[13px] leading-relaxed text-[#6B6B6B]">{submitted.message}</p>
            <p className="mt-3 flex items-start gap-2 text-[12.5px] leading-relaxed text-[#6B6B6B]">
              <Info size={14} className="mt-0.5 shrink-0" aria-hidden />
              <span>
                Support requests are relayed by the platform operator. Email{' '}
                <span className="font-semibold text-[#0F3D3E]">{SUPPORT_EMAIL}</span> with the report above to make
                sure it gets picked up.
              </span>
            </p>
            <button
              onClick={() => {
                setSubmitted(null);
                setDraft({ subject: '', message: '' });
              }}
              className="mt-4 flex h-11 items-center rounded-xl border border-[#E3E7E0] bg-white px-4 text-[13px] font-semibold text-[#0F3D3E] transition hover:bg-[#F6F5F2] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#967221]"
            >
              Write another report
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="sp-report-form"
        className="sp-cta flex h-11 items-center gap-2 px-5 text-[13.5px]"
      >
        <Bug size={15} aria-hidden />
        Report an issue
      </button>

      {open && (
        <form id="sp-report-form" onSubmit={onSubmit} className="mt-4 space-y-3">
          <div>
            <label htmlFor="sp-report-subject" className="mb-1.5 block text-[12.5px] font-semibold text-[#1A1A1A]">
              Subject
            </label>
            <input
              id="sp-report-subject"
              value={draft.subject}
              onChange={(e) => setDraft((d) => ({ ...d, subject: e.target.value }))}
              placeholder="Short summary of the problem"
              autoComplete="off"
              maxLength={120}
              className="sp-input h-11 w-full px-4 text-[13.5px]"
            />
          </div>
          <div>
            <label htmlFor="sp-report-message" className="mb-1.5 block text-[12.5px] font-semibold text-[#1A1A1A]">
              What happened?
            </label>
            <textarea
              id="sp-report-message"
              value={draft.message}
              onChange={(e) => setDraft((d) => ({ ...d, message: e.target.value }))}
              placeholder="Steps to reproduce, what you expected, and what happened instead."
              rows={4}
              maxLength={2000}
              className="sp-input w-full resize-y px-4 py-3 text-[13.5px]"
            />
          </div>
          {session?.name && (
            <p className="text-[12px] text-[#969696]">Reporting as {session.name} ({session.email})</p>
          )}
          <button
            type="submit"
            disabled={!canSend || sending}
            className="sp-cta flex h-11 items-center gap-2 px-5 text-[13.5px]"
          >
            {sending ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <Send size={15} aria-hidden />}
            Send report
          </button>
        </form>
      )}
    </>
  );
};

/* ── Screen content (tenant-scoped) ──────────────────────────────────── */

const SupportContent: React.FC<{ onTenantRetry: () => void }> = ({ onTenantRetry }) => {
  const tenant = useTenant();
  const [copied, setCopied] = useState(false);

  const onCopy = () => {
    const finish = () => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(SUPPORT_EMAIL).then(finish).catch(finish);
    } else {
      // Fallback for non-secure contexts: select-like copy via execCommand.
      const el = document.createElement('textarea');
      el.value = SUPPORT_EMAIL;
      document.body.appendChild(el);
      el.select();
      try {
        document.execCommand('copy');
        finish();
      } catch {
        finish();
      }
      document.body.removeChild(el);
    }
  };

  if (tenant.loading) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-4 p-4 lg:p-5">
        <div className="sp-skeleton h-[132px]" />
        <div className="sp-skeleton h-[104px]" />
        <div className="sp-skeleton h-[104px]" />
        <div className="sp-skeleton h-[168px]" />
      </div>
    );
  }

  if (tenant.error || !tenant.tenantId) {
    return (
      <div className="mx-auto w-full max-w-3xl p-4 lg:p-5">
        <ErrorCard
          message={tenant.error || 'No workspace is linked to this account.'}
          onRetry={onTenantRetry}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl p-4 lg:p-5">
      <h1 className="pb-5 text-[22px] font-bold text-[#1A1A1A]">Support</h1>

      {/* Hero */}
      <div className="sp-card p-5 sm:p-6">
        <div className="flex items-start gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#D9E2DD] text-[#0F3D3E]">
            <Headphones size={24} aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 className="text-[17px] font-bold text-[#1A1A1A]">ServePoint Support</h2>
            <p className="mt-1 text-[13.5px] leading-relaxed text-[#6B6B6B]">
              {tenant.tenant
                ? `Help with ${tenant.tenant.name} — billing, hardware, staff logins or anything else in your workspace.`
                : 'Help with your workspace — billing, hardware, staff logins or anything else.'}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-4">
        {/* Platform operator */}
        <section className="sp-card p-5" aria-label="Platform operator contact">
          <div className="flex flex-wrap items-center gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#D9E2DD] text-[#0F3D3E]">
              <Mail size={19} aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="text-[14px] font-semibold text-[#1A1A1A]">Platform operator</h3>
              <p className="mt-0.5 truncate text-[13px] text-[#6B6B6B]">{SUPPORT_EMAIL}</p>
            </div>
            <button
              onClick={onCopy}
              aria-label={copied ? 'Email copied to clipboard' : `Copy ${SUPPORT_EMAIL} to clipboard`}
              className="flex h-11 items-center gap-2 rounded-xl border border-[#E3E7E0] bg-white px-4 text-[13px] font-semibold text-[#0F3D3E] transition hover:bg-[#F6F5F2] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#967221]"
            >
              {copied ? <Check size={15} className="text-[#2E7D32]" aria-hidden /> : <Copy size={15} aria-hidden />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </section>

        {/* Documentation */}
        <section className="sp-card p-5" aria-label="Documentation">
          <div className="flex items-center gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#D9E2DD] text-[#0F3D3E]">
              <BookOpen size={19} aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="text-[14px] font-semibold text-[#1A1A1A]">Documentation</h3>
              <p className="mt-0.5 text-[13px] leading-relaxed text-[#6B6B6B]">
                Setup, deployment and operations guides live in the{' '}
                <span className="font-semibold text-[#0F3D3E]">docs/</span> folder of the ServePoint repository.
              </p>
            </div>
          </div>
        </section>

        {/* Report an issue */}
        <section className="sp-card p-5" aria-label="Report an issue">
          <div className="flex items-center gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#D9E2DD] text-[#0F3D3E]">
              <Bug size={19} aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="text-[14px] font-semibold text-[#1A1A1A]">Report an issue</h3>
              <p className="mt-0.5 text-[13px] leading-relaxed text-[#6B6B6B]">
                Describe the problem and the platform operator will follow up.
              </p>
            </div>
          </div>
          <div className="mt-4">
            <ReportForm />
          </div>
        </section>
      </div>
    </div>
  );
};

/* ── Exported screen ─────────────────────────────────────────────────── */

export const SupportScreen: React.FC = () => {
  const setBreadcrumb = useUi((s) => s.setBreadcrumb);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    setBreadcrumb(['Support']);
  }, [setBreadcrumb]);

  return <SupportContent key={reloadKey} onTenantRetry={() => setReloadKey((k) => k + 1)} />;
};
