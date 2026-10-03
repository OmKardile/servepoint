import type { Subscription } from '../types';

/* v5.126.0 — the billing clock, consolidated. PlatformScreen's private math
 * (5.125.0) handed over one release later, the same arc MarkHit (5.120.0) and
 * EmptyState (5.121.0) walked: a private helper becomes a shared one the
 * moment a second surface needs to speak the same truth. Both sides of the
 * console now read ONE clock.
 *
 * Day-window math is calendar-day based (midnight-to-midnight), not 24h
 * blocks, so "ends today" lands on the day itself. */

const DAY_MS = 86400000;

/** Calendar days from now until `iso` (negative = past). NaN when unparsable. */
export function daysUntil(iso: string): number {
  const target = new Date(iso);
  const now = new Date();
  if (Number.isNaN(target.getTime())) return NaN;
  target.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - now.getTime()) / DAY_MS);
}

/** The house date grammar: "16 Oct 2026". Unparsable or missing → "—". */
export function formatBillingDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
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
    const rel =
      d === 0 ? 'ends today' : d === 1 ? '1 day left' : d > 1 ? `${d} days left` : 'window passed';
    return {
      primary: `Trial ends ${formatBillingDate(s.trial_end)}`,
      secondary: d >= 0 ? `${rel} · no charge yet` : rel,
      urgent: bucket === 'last',
      bucket,
    };
  }
  return {
    primary: s.next_billing_at ? formatBillingDate(s.next_billing_at) : '—',
    urgent: false,
    bucket: null,
  };
}
