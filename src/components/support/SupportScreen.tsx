import React, { useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BookOpen,
  Bug,
  Check,
  Copy,
  Headphones,
  Info,
  Loader2,
  Mail,
  Megaphone,
  RefreshCw,
  Send,
} from 'lucide-react';
import { useTenant } from '../../lib/tenant';
import { copyText } from '../../lib/clipboard';
import { useSession, useUi } from '../../store/session';

/**
 * Support (v5.0.0, ADR-0014) — built in the ServePoint design language
 * (no dedicated Figma frame). Honest, static support surface: platform
 * operator contact with copy-to-clipboard, docs pointer, and a report
 * form that stores nothing — support requests are relayed by the
 * platform operator (support@servepoint.app).
 *
 * 5.100.0 — the report finds its own way out. "Send report" still stores
 * and transmits NOTHING (ADR-0014 unchanged); but the finished report used
 * to dead-end — the user was told to email the operator and had to retype
 * everything. The success state now hands the composed report over: an
 * "Open in email app" mailto link with subject/body prefilled (the user's
 * own mail client does the sending — the app still transmits nothing), a
 * "Copy report" button, and an "Attach diagnostics" helper in the form
 * that appends the release/workspace/device block the operator always
 * ends up asking for.
 */

const SUPPORT_EMAIL = 'support@servepoint.app';

/* v5.276.0 — the page's two copy affordances (email, report) ride the
 * house's ONE door (lib/clipboard — the async API when the origin is
 * secure, the legacy fallback when it is not). The old local helper
 * fired its callback EITHER way, so the button said "Copied" even when
 * both doors refused; the lib's honest boolean now decides — Copied only
 * when the copy happened (the email and the report text are on-screen
 * anyway — a refused copy never becomes an invented word). */

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

const DIAG_BEGIN = '— ServePoint diagnostics —';
const DIAG_END = '— end diagnostics —';

const ReportForm: React.FC = () => {
  const session = useSession((s) => s.session);
  const { tenant } = useTenant();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<ReportDraft>({ subject: '', message: '' });
  const [sending, setSending] = useState(false);
  const [submitted, setSubmitted] = useState<ReportDraft | null>(null);
  const [copied, setCopied] = useState(false);
  const [diagAttached, setDiagAttached] = useState(false);

  const canSend = draft.subject.trim().length > 0 && draft.message.trim().length > 0;

  /* Diagnostics: the release number lives only in the service worker's cache
   * names, so that is where we read it — 'unknown' stays the honest word when
   * the API is unavailable (private mode). Re-attaching REFRESHES the block
   * (the split markers make it idempotent) instead of stacking copies. */
  const attachDiagnostics = async () => {
    let release = 'unknown';
    try {
      const keys = await caches.keys();
      const hit = keys.find((k) => k.startsWith('servepoint-v'));
      if (hit) release = hit.replace(/-(shell|assets|fonts)$/, '');
    } catch {
      /* keep 'unknown' */
    }
    const block = [
      DIAG_BEGIN,
      `release: ${release}`,
      `workspace: ${tenant?.name || 'unknown'}`,
      `reported by: ${session?.name || 'unknown'} (${session?.email || 'unknown'})`,
      `screen: Support`,
      `when: ${new Date().toString()}`,
      `online: ${navigator.onLine ? 'yes' : 'no'}`,
      `device: ${navigator.userAgent}`,
      DIAG_END,
    ].join('\n');
    setDraft((d) => {
      const base = d.message.split(DIAG_BEGIN)[0].trimEnd();
      const joined = (base ? `${base}\n\n` : '') + block;
      const overflow = Math.max(0, joined.length - 2000);
      const trimmedBase = overflow > 0 ? base.slice(0, base.length - overflow) : base;
      return {
        ...d,
        message: (trimmedBase ? `${trimmedBase}\n\n` : '') + block,
      };
    });
    setDiagAttached(true);
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSend || sending) return;
    setSending(true);
    // Honest by design (ADR-0014): nothing is stored or transmitted here. The
    // submitted state is local-only and the handoff below gives the composed
    // report somewhere to go — the user's own mail client does any sending.
    window.setTimeout(() => {
      setSubmitted({ subject: draft.subject.trim(), message: draft.message.trim() });
      setSending(false);
    }, 350);
  };

  const handoffHref = (r: ReportDraft): string => {
    const body = [
      r.message,
      '',
      `— Reported from the Support screen by ${session?.name || 'unknown'} (${session?.email || 'unknown'}) · ${tenant?.name || 'workspace unknown'}`,
    ].join('\n');
    return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(`[ServePoint] ${r.subject}`)}&body=${encodeURIComponent(body)}`;
  };

  const onCopyReport = () => {
    if (!submitted) return;
    void copyText(`Subject: ${submitted.subject}\n\n${submitted.message}`).then((ok) => {
      if (!ok) return;
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    });
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
            <p className="mt-1 break-words whitespace-pre-wrap text-[13px] leading-relaxed text-[#6B6B6B]">{submitted.message}</p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <a
                href={handoffHref(submitted)}
                className="sp-cta flex h-10 items-center gap-2 px-4 text-[13px]"
                aria-label={`Open your email app with the report to ${SUPPORT_EMAIL}`}
              >
                <Mail size={15} aria-hidden />
                Open in email app
              </a>
              <button
                type="button"
                onClick={onCopyReport}
                aria-label={copied ? 'Report copied to clipboard' : 'Copy the full report to the clipboard'}
                className="flex h-10 items-center gap-2 rounded-xl border border-[#E3E7E0] bg-white px-4 text-[13px] font-semibold text-[#0F3D3E] transition hover:bg-[#F6F5F2] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#967221]"
              >
                {copied ? <Check size={15} className="text-[#2E7D32]" aria-hidden /> : <Copy size={15} aria-hidden />}
                {copied ? 'Copied' : 'Copy report'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setSubmitted(null);
                  setDraft({ subject: '', message: '' });
                  setDiagAttached(false);
                }}
                className="flex h-10 items-center rounded-xl px-3 text-[13px] font-semibold text-[#6B6B6B] transition hover:bg-[#F6F5F2] hover:text-[#0F3D3E] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#967221]"
              >
                Write another report
              </button>
            </div>
            <p className="mt-3 flex items-start gap-2 text-[12.5px] leading-relaxed text-[#6B6B6B]">
              <Info size={14} className="mt-0.5 shrink-0" aria-hidden />
              <span>
                Nothing was sent by the app itself — the button above hands this text to your own mail app,
                addressed to <span className="font-semibold text-[#0F3D3E]">{SUPPORT_EMAIL}</span>.
              </span>
            </p>
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
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <button
              type="button"
              onClick={attachDiagnostics}
              aria-label={diagAttached ? 'Diagnostics attached to the report' : 'Attach app diagnostics to the report'}
              className={`flex h-9 items-center gap-2 rounded-xl border px-3 text-[12.5px] font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#967221] ${
                diagAttached
                  ? 'border-[#BBDBC0] bg-[#EAF0EC] text-[#2E7D32]'
                  : 'border-[#E3E7E0] bg-white text-[#5F6B63] hover:bg-[#F6F5F2]'
              }`}
            >
              {diagAttached ? <Check size={14} aria-hidden /> : <Activity size={14} aria-hidden />}
              {diagAttached ? 'Diagnostics attached' : 'Attach diagnostics'}
            </button>
            <p className="text-[11.5px] text-[#969696]">release · workspace · device — helps the operator reproduce it</p>
          </div>
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
    void copyText(SUPPORT_EMAIL).then((ok) => {
      if (ok) finish();
    });
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
      <h1 className="sp-screen-title pb-5">Support</h1>

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

        {/* Product links — public surfaces (v5.2.1) */}
        <section className="sp-card p-5" aria-label="Product links">
          <div className="flex items-center gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#D9E2DD] text-[#0F3D3E]">
              <Megaphone size={19} aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="text-[14px] font-semibold text-[#1A1A1A]">Product links</h3>
              <p className="mt-0.5 text-[13px] leading-relaxed text-[#6B6B6B]">
                Shareable pages that don't need a sign-in — great for showing ServePoint off.
              </p>
            </div>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <a
              href="/showcase"
              className="flex h-10 items-center justify-center rounded-xl border border-[#E3E7E0] bg-white text-[13px] font-semibold text-[#0F3D3E] transition hover:border-[#B88E2F]/50 hover:text-[#7A5B18]"
            >
              Product showcase
            </a>
            <a
              href="/index-help"
              className="flex h-10 items-center justify-center rounded-xl border border-[#E3E7E0] bg-white text-[13px] font-semibold text-[#0F3D3E] transition hover:border-[#B88E2F]/50 hover:text-[#7A5B18]"
            >
              Getting-started guide
            </a>
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
