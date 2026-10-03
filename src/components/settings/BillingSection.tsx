import React from 'react';
import { CreditCard, Hourglass, LifeBuoy, Loader2, RefreshCw, TriangleAlert } from 'lucide-react';
import { fetchOwnSubscriptionStrict } from '../../lib/api';
import { daysUntil, formatBillingDate, planLabel } from '../../lib/billing';
import { formatMoney } from '../../lib/prefs';
import { useUi } from '../../store/session';
import type { Subscription } from '../../types';

/* v5.127.0 — the record hands over whole. The band (5.126.0) is the clock —
 * slim, urgent only when the truth is urgent. This panel is the calm record
 * behind it: plan, cycle, price, the dates. Active tenants finally get their
 * "next charge" line HERE (deliberately not as a permanent band — the full
 * record lives in Settings, the nag lives in the header when it must). A
 * trialing tenant gets the whole arithmetic; a tenant with no subscription
 * row gets the truth and a real door to Support; a failed read says so and
 * offers Retry — "no record" and "couldn't ask" never collapse into one lie.
 *
 * Owner-gated (like Café brand / Business profile): the plan is the owner's
 * business; staff run tickets. */

type Load = { state: 'loading' } | { state: 'error'; message: string } | { state: 'ok'; sub: Subscription | null };

const Row: React.FC<{ label: string; children: React.ReactNode; last?: boolean }> = ({
  label,
  children,
  last,
}) => (
  <div
    className={`flex items-center justify-between gap-4 py-3 ${
      last ? '' : 'border-b border-[#E3E7E0]'
    }`}
  >
    <dt className="text-[13px] text-[#6B6B6B]">{label}</dt>
    <dd
      className="text-[13px] font-medium text-[#1A1A1A]"
      style={{ fontVariantNumeric: 'tabular-nums' }}
    >
      {children}
    </dd>
  </div>
);

const StatusChip: React.FC<{ status: string }> = ({ status }) => {
  const word =
    status === 'trialing' ? 'Trialing' : status === 'active' ? 'Active' : status.charAt(0).toUpperCase() + status.slice(1);
  const tone =
    status === 'trialing'
      ? 'bg-[#F3E8CF] text-[#1A1A1A]'
      : status === 'active'
        ? 'bg-[#EAF0EC] text-[#0F3D3E]'
        : 'bg-[#E3E7E0] text-[#6B6B6B]';
  return (
    <span className={`inline-block rounded-full px-2.5 py-1 text-[11px] font-semibold ${tone}`}>
      {word}
    </span>
  );
};

const SupportDoor: React.FC<{ question: string }> = ({ question }) => (
  <button
    onClick={() => useUi.getState().goSection('support', ['Support'])}
    className="mt-4 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-semibold text-[#0F3D3E] transition hover:bg-[#EAF0EC]"
  >
    <LifeBuoy size={14} aria-hidden />
    {question}
  </button>
);

export const BillingSection: React.FC = () => {
  const [load, setLoad] = React.useState<Load>({ state: 'loading' });

  const read = React.useCallback(() => {
    setLoad({ state: 'loading' });
    fetchOwnSubscriptionStrict()
      .then((sub) => setLoad({ state: 'ok', sub }))
      .catch((err: unknown) =>
        setLoad({ state: 'error', message: err instanceof Error ? err.message : 'Unknown error.' }),
      );
  }, []);

  React.useEffect(read, [read]);

  const sub = load.state === 'ok' ? load.sub : null;
  const isTrial = !!sub && (sub.status === 'trialing' || sub.status === 'trial');
  const dLeft = sub?.trial_end ? daysUntil(sub.trial_end) : NaN;

  return (
    <div>
      <h2 className="text-[17px] font-semibold text-[#1A1A1A]">Plan & billing</h2>
      <p className="mt-1 text-[13px] leading-relaxed text-[#6B6B6B]">
        The plan this café runs on, and the dates that govern it — the same record
        the Platform console reads.
      </p>

      {load.state === 'loading' && (
        <div className="mt-6 flex items-center gap-2 text-[13px] text-[#6B6B6B]">
          <Loader2 size={16} className="animate-spin" aria-hidden />
          Reading your subscription…
        </div>
      )}

      {load.state === 'error' && (
        <div className="mt-6 rounded-2xl border border-[#E3E7E0] bg-[#F6F5F2] p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-[#B42318]">
              <TriangleAlert size={20} aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-semibold text-[#1A1A1A]">Couldn't read your subscription.</p>
              <p className="mt-0.5 truncate text-[12px] text-[#6B6B6B]">{load.message}</p>
            </div>
          </div>
          <button
            onClick={read}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-[#F3E8CF] px-3 py-1.5 text-[12px] font-semibold text-[#1A1A1A] transition hover:bg-[#E9D9AF]"
          >
            <RefreshCw size={13} aria-hidden />
            Try again
          </button>
        </div>
      )}

      {load.state === 'ok' && !sub && (
        <div className="mt-6 rounded-2xl border border-[#E3E7E0] bg-[#F6F5F2] p-5">
          <p className="text-[14px] font-semibold text-[#1A1A1A]">No subscription on record.</p>
          <p className="mt-1 max-w-md text-[13px] leading-relaxed text-[#6B6B6B]">
            This business has no plan attached to it yet — nothing is being charged,
            and nothing is scheduled to be.
          </p>
          <SupportDoor question="Questions? Open Support" />
        </div>
      )}

      {load.state === 'ok' && sub && (
        <div className="mt-6 rounded-2xl border border-[#E3E7E0] bg-[#EAF0EC] p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-[#0F3D3E]">
              {isTrial ? <Hourglass size={20} aria-hidden /> : <CreditCard size={20} aria-hidden />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-semibold text-[#1A1A1A]">{planLabel(sub.plan_id)} plan</p>
              <p className="text-[12px] text-[#6B6B6B]">
                {isTrial
                  ? dLeft >= 0
                    ? `${dLeft === 1 ? '1 day left' : `${dLeft} days left`} · no charge yet`
                    : 'the trial window has passed'
                  : sub.next_billing_at
                    ? `Next charge ${formatBillingDate(sub.next_billing_at)}`
                    : 'No charge scheduled on record'}
              </p>
            </div>
            <StatusChip status={sub.status} />
          </div>

          <dl className="mt-4 rounded-xl bg-white px-4 py-1">
            <Row label="Billing cycle">{sub.billing_cycle === 'monthly' ? 'Monthly' : sub.billing_cycle}</Row>
            <Row label="Monthly price">{formatMoney(sub.monthly_price ?? 0)}</Row>
            {sub.final_monthly_rate != null && sub.final_monthly_rate !== sub.monthly_price && (
              <Row label="Final rate">{formatMoney(sub.final_monthly_rate)}</Row>
            )}
            {sub.trial_start && <Row label="Trial started">{formatBillingDate(sub.trial_start)}</Row>}
            {sub.trial_end && <Row label="Trial ends">{formatBillingDate(sub.trial_end)}</Row>}
            {sub.next_billing_at && <Row label="Next charge">{formatBillingDate(sub.next_billing_at)}</Row>}
            <Row label="On board since" last>
              {formatBillingDate(sub.created_at)}
            </Row>
          </dl>

          <SupportDoor
            question={
              isTrial ? 'Questions about your trial? Open Support' : 'Questions about billing? Open Support'
            }
          />
        </div>
      )}
    </div>
  );
};
