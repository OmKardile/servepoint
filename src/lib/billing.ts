import type { Subscription } from '../types';
import { appDayKey, appTodayIso, appTimezone } from './appday';

/* v5.126.0 — the billing clock, consolidated. PlatformScreen's private math
 * (5.125.0) handed over one release later, the same arc MarkHit (5.120.0) and
 * EmptyState (5.121.0) walked: a private helper becomes a shared one the
 * moment a second surface needs to speak the same truth. Both sides of the
 * console now read ONE clock.
 *
 * Day-window math is calendar-day based (midnight-to-midnight), not 24h
 * blocks, so "ends today" lands on the day itself.
 *
 * v5.133.0 — the clock keeps the CAFÉ'S day. daysUntil counted DEVICE-local
 * midnights and formatBillingDate formatted in the DEVICE zone, so a UTC
 * laptop and an IST tablet could disagree about the same trial by a whole
 * day (the "documented device-day seam" the QA logs kept noting). Billing
 * is an owner surface — the reporting day (Settings › Language & Region)
 * is its truth, the same word Reports and Close-out read. On every Indian
 * device both truths say IST and nothing moves; elsewhere the lie stops.
 *
 * v5.304.0 — the clock gains its relative words as a public voice
 * (trialRelWords): the dashboard's Trials card now composes the same
 * sentence the rows speak, so the landing glance and the ledger can never
 * drift into two dialects. */

const DAY_MS = 86400000;

const dayNumber = (dayKey: string): number => {
  const [y, m, d] = dayKey.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};

/** Calendar days from the OWNER'S today to the calendar day `iso` lands on
 *  in the owner's timezone (negative = past). NaN when unparsable. */
export function daysUntil(iso: string): number {
  if (!iso) return NaN;
  const target = new Date(iso);
  if (Number.isNaN(target.getTime())) return NaN;
  return Math.round((dayNumber(appDayKey(iso)) - dayNumber(appTodayIso())) / DAY_MS);
}

/** The house date grammar: "16 Oct 2026", spoken in the owner's timezone —
 *  the same calendar the day-count reads. Unparsable or missing → "—". */
export function formatBillingDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: appTimezone(),
  }).format(d);
}

/** The trial's urgency bucket. calm > 7 days out; soon inside a week;
 * last inside three (Platform's amber); ended past the window. */
export type TrialBucket = 'calm' | 'soon' | 'last' | 'ended';

export function trialBucket(daysLeft: number): TrialBucket | null {
  if (Number.isNaN(daysLeft)) return null;
  if (daysLeft < 0) return 'ended';
  if (daysLeft <= 3) return 'last';
  if (daysLeft <= 7) return 'soon';
  return 'calm';
}

/** plan_id → spoken name (CHECK constraint: starter|growth|pro|enterprise). */
export function planLabel(planId: string): string {
  switch (planId) {
    case 'starter':
      return 'Starter';
    case 'growth':
      return 'Growth';
    case 'pro':
      return 'Pro';
    case 'enterprise':
      return 'Enterprise';
    default:
      return planId;
  }
}

/** v5.304.0 — the trial clock's relative words, ONE phrasing everywhere the
 *  clock speaks (the 232 lesson: a borrower takes words.primary rather than
 *  phrase a third sentence — now the exporter itself, so even the borrower's
 *  source has no second copy). d === 0 is the last day; d < 0 is a window
 *  already passed. */
export function trialRelWords(d: number): string {
  return d === 0 ? 'ends today' : d === 1 ? '1 day left' : d > 1 ? `${d} days left` : 'window passed';
}

/** The words the subscription row speaks, one grammar for both surfaces.
 * Platform's cell renders {primary, secondary, urgent}; the tenant band adds
 * the bucket for its color ramp. A trialing row without a trial_end stays
 * wordless ("—") — no invented dates, ever. */
export function subscriptionWords(s: Subscription): {
  primary: string;
  secondary?: string;
  urgent: boolean;
  bucket: TrialBucket | null;
} {
  if (s.status === 'trialing' || s.status === 'trial') {
    if (!s.trial_end) return { primary: '—', urgent: false, bucket: null };
    const d = daysUntil(s.trial_end);
    const bucket = trialBucket(d);
    if (bucket === null) return { primary: '—', urgent: false, bucket: null };
    const rel = trialRelWords(d);
    /* v5.307.0 — the tense law: a LIVE window says "Trial ends <date>"; a
     * window already PASSED says "Trial ended <date>" — the future tense
     * would lie to a dead trial (the tenant band's own afterword — "Your
     * Growth trial ended on …" — has spoken the past tense since 5.126;
     * now the ONE home carries it for every projection). The date strip in
     * SubscriptionBand reads both prefixes. */
    return {
      primary:
        d >= 0
          ? `Trial ends ${formatBillingDate(s.trial_end)}`
          : `Trial ended ${formatBillingDate(s.trial_end)}`,
      secondary: d >= 0 ? `${rel} · no charge yet` : rel,
      urgent: bucket === 'last',
      bucket,
    };
  }
  return {
    primary: s.next_billing_at ? formatBillingDate(s.next_billing_at) : '—',
    secondary: activeRenewalWords(s),
    urgent: false,
    bucket: null,
  };
}

/** v5.133.0 — the active plan's clock speaks the same grammar the trial's
 *  does: the date plus the honest day-count. A row with no scheduled charge
 *  stays wordless — silence, never an invented date. */
function activeRenewalWords(s: Subscription): string | undefined {
  if (!s.next_billing_at) return undefined;
  const d = daysUntil(s.next_billing_at);
  if (Number.isNaN(d)) return undefined;
  return d === 0 ? 'renews today' : d === 1 ? 'renews tomorrow' : d > 1 ? `renews in ${d} days` : 'renewal window passed';
}
