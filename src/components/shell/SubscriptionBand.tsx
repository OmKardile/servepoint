import React from 'react';
import { Hourglass } from 'lucide-react';
import { fetchOwnSubscription } from '../../lib/api';
import { daysUntil, planLabel, subscriptionWords } from '../../lib/billing';
import type { Subscription } from '../../types';

/* v5.126.0 — the clock crosses over. The Platform console met the trial clock
 * first (5.125.0); the owner who lives inside it never did — migration 005
 * always allowed a tenant to read their own subscription row, and the app
 * simply never asked. This band asks once per session and speaks only when it
 * has the row AND the words for it: no row, no trial_end, or a status the
 * band has no sentence for → it stays silent. Absence is silence, not a lie.
 *
 * Visual ramp (the house palette, escalating by truth):
 *   calm  >7 days   — sage (#EAF0EC / #0F3D3E), the quiet register
 *   soon  ≤7 days   — gold tint (#F3E8CF / #1A1A1A)
 *   last  ≤3 days   — deep gold (#E9D9AF / #1A1A1A), Platform's amber kin
 *   ended <0 days   — canvas recess (#F6F5F2 / #6B6B6B), the honest afterword
 * Dismissible? No — it is time-boxed (14 days at provision), slim, and it is
 * the operator's own money-clock; when it goes quiet the trial is over. */

const BAND_STYLES: Record<string, string> = {
  calm: 'bg-[#EAF0EC] text-[#0F3D3E]',
  soon: 'bg-[#F3E8CF] text-[#1A1A1A]',
  last: 'bg-[#E9D9AF] text-[#1A1A1A]',
  ended: 'bg-[#F6F5F2] text-[#6B6B6B] border-b border-[#E3E7E0]',
};

export const SubscriptionBand: React.FC = () => {
  const [sub, setSub] = React.useState<Subscription | null>(null);

  React.useEffect(() => {
    let alive = true;
    fetchOwnSubscription()
      .then((s) => {
        if (alive) setSub(s);
      })
      .catch(() => {
        if (alive) setSub(null);
      });
    return () => {
      alive = false;
    };
  }, []);

  const words = sub ? subscriptionWords(sub) : null;
  const isTrial = !!sub && (sub.status === 'trialing' || sub.status === 'trial');
  if (!sub || !words || !isTrial || !sub.trial_end) return null;

  const d = daysUntil(sub.trial_end);
  const bucket = words.bucket;
  if (bucket === null) return null;
  const plan = planLabel(sub.plan_id);
  const ended = d < 0;

  return (
    <div
      role="status"
      style={{ animation: 'spFadeIn 160ms ease-out' }}
      className={`flex items-center justify-center gap-2 px-6 py-2 text-[12.5px] ${BAND_STYLES[bucket]}`}
    >
      <Hourglass size={13} strokeWidth={2.2} aria-hidden className={ended ? 'opacity-60' : ''} />
      {/* v5.307.0 — the date strip reads BOTH of the ONE home's prefixes:
       * "Trial ends …" from the live arm and "Trial ended …" from the tense
       * law's past arm — the regex takes the bare date either way, so the
       * band's own sentences never double-speak the tense. */}
      {ended ? (
        <span>
          Your {plan} trial ended on{' '}
          <span className="font-semibold" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {words.primary.replace(/^Trial (?:ends|ended) /, '')}
          </span>{' '}
          · no charge was made.
        </span>
      ) : (
        <span>
          Your {plan} trial{' '}
          <span className="font-semibold" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {d === 0 ? 'ends today' : d === 1 ? 'ends tomorrow' : `ends ${words.primary.replace(/^Trial (?:ends|ended) /, '')}`}
          </span>
          {d === 1 ? ' — 1 day left' : d === 0 ? '' : ` — ${d} days left`} · no charge yet.
        </span>
      )}
    </div>
  );
};
