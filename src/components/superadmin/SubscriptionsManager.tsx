import React, { useState } from 'react';
import { useTsosStore } from '../../lib/store';
import { SAAS_PLANS } from '../../data/saasSeedData';
import { SubscriptionPlanId } from '../../types';
import {
  CreditCard,
  CheckCircle2,
  Users,
  Building2,
  Percent,
  TrendingUp,
  Tag,
  Zap,
} from 'lucide-react';

export const SubscriptionsManager: React.FC = () => {
  const { tenantBusinesses, updateBusinessSubscription } = useTsosStore();

  const [selectedPlanFilter, setSelectedPlanFilter] = useState<string>('all');
  const [dealModalBizId, setDealModalBizId] = useState<string | null>(null);
  const [dealDiscount, setDealDiscount] = useState<number>(10);
  const [dealRationale, setDealRationale] = useState<string>('');

  const targetBiz = tenantBusinesses.find((b) => b.id === dealModalBizId);

  const handleApplyDeal = () => {
    if (!targetBiz) return;
    const plan = SAAS_PLANS.find((p) => p.id === targetBiz.subscription.plan_id) || SAAS_PLANS[0];
    const discount = Math.min(100, Math.max(0, dealDiscount));
    const finalRate = Math.round(plan.monthly_price * (1 - discount / 100));

    updateBusinessSubscription(targetBiz.id, {
      applied_discount_pct: discount,
      final_monthly_rate: finalRate,
      deal_notes: dealRationale || `${discount}% administrative promotional deal`,
    });
    setDealModalBizId(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-[#E9E0D6] rounded-xl p-5 shadow-xs">
        <h2 className="text-xl font-bold text-[#1C1917]">SaaS Subscription Plans & Deal Architecture</h2>
        <p className="text-xs text-[#78716C] mt-0.5">
          Standard monthly billing tiers, custom franchise deals, partner discounts, and recurring revenue distribution.
        </p>
      </div>

      {/* Plan Cards Matrix */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {SAAS_PLANS.map((plan) => {
          const bizCount = tenantBusinesses.filter((b) => b.subscription.plan_id === plan.id).length;
          const planMRR = tenantBusinesses
            .filter((b) => b.subscription.plan_id === plan.id && (b.status === 'active' || b.status === 'past_due'))
            .reduce((sum, b) => sum + b.subscription.final_monthly_rate, 0);

          return (
            <div
              key={plan.id}
              className={`bg-white border rounded-xl p-5 shadow-xs flex flex-col justify-between relative overflow-hidden ${
                plan.is_popular ? 'border-[#F97316] ring-1 ring-[#F97316]' : 'border-[#E9E0D6]'
              }`}
            >
              {plan.is_popular && (
                <div className="absolute top-0 right-0 bg-[#F97316] text-white text-[10px] font-bold px-3 py-0.5 rounded-bl-lg">
                  POPULAR
                </div>
              )}

              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-[#1C1917]">{plan.name}</h3>
                </div>
                <p className="text-[11px] text-[#78716C] mt-0.5">{plan.tagline}</p>

                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-2xl font-black text-[#1C1917]">
                    ₹{plan.monthly_price.toLocaleString('en-IN')}
                  </span>
                  <span className="text-xs text-[#78716C]">/ month</span>
                </div>

                <div className="mt-3 pt-3 border-t border-[#F5EFEA] space-y-1.5 text-xs text-[#57534E]">
                  <div className="flex items-center justify-between">
                    <span>Tables Cap:</span>
                    <span className="font-semibold text-[#1C1917]">
                      {plan.max_tables > 100 ? 'Unlimited' : plan.max_tables}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Staff Accounts:</span>
                    <span className="font-semibold text-[#1C1917]">
                      {plan.max_staff > 100 ? 'Unlimited' : plan.max_staff}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Locations:</span>
                    <span className="font-semibold text-[#1C1917]">
                      {plan.max_locations > 100 ? 'Multi-chain' : `${plan.max_locations} branch`}
                    </span>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-[#F5EFEA] space-y-1 text-[11px] text-[#78716C]">
                  {plan.features.slice(0, 4).map((f, idx) => (
                    <div key={idx} className="flex items-start gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#10B981] shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-[#F5EFEA] flex items-center justify-between text-xs">
                <div>
                  <span className="text-[10px] text-[#78716C] uppercase font-semibold">Subscribers</span>
                  <div className="font-bold text-[#1C1917]">{bizCount} Cafes</div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-[#78716C] uppercase font-semibold">Plan MRR</span>
                  <div className="font-bold text-[#F97316]">₹{planMRR.toLocaleString('en-IN')}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Tenant Subscriptions & Deals Table */}
      <div className="bg-white border border-[#E9E0D6] rounded-xl shadow-xs overflow-hidden">
        <div className="p-4 border-b border-[#E9E0D6] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h3 className="text-base font-bold text-[#1C1917]">Active Subscriptions & Deal Registry</h3>
            <p className="text-xs text-[#78716C]">Apply custom enterprise deals, partner waivers, or modify renewal terms</p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-[#78716C]">Filter Plan:</span>
            <select
              value={selectedPlanFilter}
              onChange={(e) => setSelectedPlanFilter(e.target.value)}
              className="text-xs px-2.5 py-1.5 rounded-lg border border-[#E9E0D6] bg-[#FAF6F0]"
            >
              <option value="all">All Plans</option>
              <option value="starter">Starter</option>
              <option value="growth">Growth</option>
              <option value="pro">Pro</option>
              <option value="enterprise">Enterprise</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#FAF6F0] border-b border-[#E9E0D6] text-[#78716C] uppercase font-semibold">
              <tr>
                <th className="py-3 px-4">Business</th>
                <th className="py-3 px-4">Plan</th>
                <th className="py-3 px-4">Standard Rate</th>
                <th className="py-3 px-4">Deal / Discount</th>
                <th className="py-3 px-4">Final Monthly Rate</th>
                <th className="py-3 px-4">Billing Status</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F5EFEA]">
              {tenantBusinesses
                .filter((b) => selectedPlanFilter === 'all' || b.subscription.plan_id === selectedPlanFilter)
                .map((b) => {
                  const plan = SAAS_PLANS.find((p) => p.id === b.subscription.plan_id);
                  return (
                    <tr key={b.id} className="hover:bg-[#FFFBF5]">
                      <td className="py-3 px-4">
                        <div className="font-bold text-[#1C1917]">{b.name}</div>
                        <div className="text-[10px] text-[#78716C] font-mono">/{b.slug}</div>
                      </td>
                      <td className="py-3 px-4 font-semibold text-[#1C1917]">
                        {plan?.name || b.subscription.plan_id}
                      </td>
                      <td className="py-3 px-4 text-[#78716C]">
                        ₹{b.subscription.monthly_price}/mo
                      </td>
                      <td className="py-3 px-4">
                        {b.subscription.applied_discount_pct > 0 ? (
                          <div className="flex items-center gap-1.5">
                            <span className="px-2 py-0.5 rounded text-xs font-bold bg-[#FEF3C7] text-[#B45309]">
                              {b.subscription.applied_discount_pct}% OFF
                            </span>
                            {b.subscription.deal_notes && (
                              <span className="text-[10px] text-[#78716C] truncate max-w-[120px]" title={b.subscription.deal_notes}>
                                ({b.subscription.deal_notes})
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[#A8A29E]">Standard Pricing</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-bold text-sm text-[#F97316]">
                          ₹{b.subscription.final_monthly_rate.toLocaleString('en-IN')}
                        </span>
                        <span className="text-[10px] text-[#78716C]">/mo</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="capitalize font-medium text-[#57534E]">
                          {b.subscription.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => {
                            setDealModalBizId(b.id);
                            setDealDiscount(b.subscription.applied_discount_pct || 10);
                            setDealRationale(b.subscription.deal_notes || '');
                          }}
                          className="px-2.5 py-1 rounded bg-[#FAF6F0] hover:bg-[#F3ECE4] text-[#1C1917] font-medium transition-colors border border-[#E9E0D6]"
                        >
                          Modify Deal
                        </button>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick Deal Modal */}
      {targetBiz && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[#E9E0D6] space-y-4">
            <h3 className="text-base font-bold text-[#1C1917]">
              Apply Custom Deal for {targetBiz.name}
            </h3>
            <p className="text-xs text-[#78716C]">
              Plan: {targetBiz.subscription.plan_id.toUpperCase()} (Base ₹{targetBiz.subscription.monthly_price}/mo)
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-[#1C1917]">Deal Discount %</label>
                  <span className="font-bold text-[#F97316]">{dealDiscount}% OFF</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={dealDiscount}
                  onChange={(e) => setDealDiscount(Number(e.target.value))}
                  className="w-full accent-[#F97316]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#1C1917] mb-1">Deal Rationale / Contract Note</label>
                <input
                  type="text"
                  placeholder="e.g. 20% Founder roastery discount for 1 year"
                  value={dealRationale}
                  onChange={(e) => setDealRationale(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-[#E9E0D6] focus:outline-none focus:ring-1 focus:ring-[#F97316]"
                />
              </div>

              <div className="p-3 rounded-lg bg-[#FAF6F0] text-xs flex items-center justify-between">
                <span className="text-[#78716C]">New Net Rate:</span>
                <span className="text-base font-bold text-[#1C1917]">
                  ₹{Math.round(targetBiz.subscription.monthly_price * (1 - dealDiscount / 100))}/mo
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E9E0D6]">
              <button
                onClick={() => setDealModalBizId(null)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-[#78716C] hover:bg-[#FAF6F0]"
              >
                Cancel
              </button>
              <button
                onClick={handleApplyDeal}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-[#F97316] text-white hover:bg-[#EA580C]"
              >
                Confirm & Apply Deal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
