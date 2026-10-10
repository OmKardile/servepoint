import React, { useState, useEffect } from 'react';
import { useTsosStore } from '../../lib/store';
import { TenantBusiness, BusinessStatus, SubscriptionPlanId } from '../../types';
import { SAAS_PLANS } from '../../data/saasSeedData';
import {
  Building2,
  Search,
  Filter,
  MoreVertical,
  Edit2,
  CreditCard,
  Ban,
  RotateCcw,
  Archive,
  ExternalLink,
  Phone,
  Mail,
  MapPin,
  PlusCircle,
  X,
  Check,
  Percent,
  Calendar,
  AlertCircle,
} from 'lucide-react';

export const BusinessDirectory: React.FC = () => {
  const {
    tenantBusinesses,
    updateTenantBusiness,
    updateBusinessSubscription,
    setBusinessStatus,
    deleteTenantBusiness,
    setActiveSuperAdminTab,
    switchTenantScope,
    setImpersonatedTenant,
    setActiveSurface,
    setActiveWebTab,
    selectedSuperAdminBusinessId,
    setSelectedSuperAdminBusinessId,
  } = useTsosStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [planFilter, setPlanFilter] = useState<string>('all');

  // Quick-jump consumer: when the Dashboard/Shell jumps to a tenant, pre-filter
  // the directory to that business and clear the pending selection.
  useEffect(() => {
    if (!selectedSuperAdminBusinessId) return;
    const target = tenantBusinesses.find((b) => b.id === selectedSuperAdminBusinessId);
    if (target) setSearchQuery(target.name);
    setSelectedSuperAdminBusinessId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSuperAdminBusinessId]);

  // Modals state
  const [editingBusiness, setEditingBusiness] = useState<TenantBusiness | null>(null);
  const [subModalBusiness, setSubModalBusiness] = useState<TenantBusiness | null>(null);

  // Sub modal state
  const [selectedPlanId, setSelectedPlanId] = useState<SubscriptionPlanId>('starter');
  const [discountPct, setDiscountPct] = useState<number>(0);
  const [dealNotes, setDealNotes] = useState<string>('');

  // Filtered and sorted businesses
  const filtered = tenantBusinesses.filter((b) => {
    const q = searchQuery.toLowerCase();
    const matchesQuery =
      b.name.toLowerCase().includes(q) ||
      b.slug.toLowerCase().includes(q) ||
      b.owner_name.toLowerCase().includes(q) ||
      b.owner_email.toLowerCase().includes(q) ||
      b.city.toLowerCase().includes(q) ||
      (b.gst_number && b.gst_number.toLowerCase().includes(q));

    const matchesStatus = statusFilter === 'all' || b.status === statusFilter;
    const matchesPlan = planFilter === 'all' || b.subscription.plan_id === planFilter;

    return matchesQuery && matchesStatus && matchesPlan;
  });

  const openSubModal = (b: TenantBusiness) => {
    setSubModalBusiness(b);
    setSelectedPlanId(b.subscription.plan_id);
    setDiscountPct(b.subscription.applied_discount_pct || 0);
    setDealNotes(b.subscription.deal_notes || '');
  };

  const handleSaveSubscription = () => {
    if (!subModalBusiness) return;
    const plan = SAAS_PLANS.find((p) => p.id === selectedPlanId) || SAAS_PLANS[0];
    const discount = Math.min(100, Math.max(0, discountPct));
    const finalRate = Math.round(plan.monthly_price * (1 - discount / 100));

    updateBusinessSubscription(subModalBusiness.id, {
      plan_id: selectedPlanId,
      monthly_price: plan.monthly_price,
      applied_discount_pct: discount,
      final_monthly_rate: finalRate,
      deal_notes: dealNotes,
    });
    setSubModalBusiness(null);
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBusiness) return;
    updateTenantBusiness(editingBusiness);
    setEditingBusiness(null);
  };

  const getStatusBadge = (status: BusinessStatus) => {
    switch (status) {
      case 'active':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-[#DCFCE7] text-[#166534] border border-[#BBF7D0]">
            Active
          </span>
        );
      case 'trial':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-[#FAF5FF] text-[#6B21A8] border border-[#E9D5FF]">
            14-Day Trial
          </span>
        );
      case 'past_due':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A]">
            Past Due
          </span>
        );
      case 'suspended':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-[#FEE2E2] text-[#991B1B] border border-[#FECACA]">
            Suspended
          </span>
        );
      case 'archived':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-[#F5F5F4] text-[#78716C] border border-[#E7E5E4]">
            Archived
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-[#F5F5F4] text-[#78716C]">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Search Bar */}
      <div className="bg-white border border-[#E9E0D6] rounded-xl p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-[#1C1917]">Subscribing Businesses & Cafes</h2>
            <p className="text-xs text-[#78716C]">
              Manage tenant directory, profile details, SaaS monthly plans, custom deals, and lifecycle states.
            </p>
          </div>
          <button
            onClick={() => setActiveSuperAdminTab('wizard')}
            className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-[#F97316] text-white font-medium hover:bg-[#EA580C] shadow-sm transition-all text-xs"
          >
            <PlusCircle className="w-4 h-4" />
            Provision New Cafe
          </button>
        </div>

        {/* Filter Toolbar */}
        <div className="flex flex-col md:flex-row items-center gap-3 pt-2">
          {/* Search Input */}
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-[#A8A29E] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by cafe name, slug, owner, email, GST, city..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs rounded-lg border border-[#E9E0D6] bg-[#FAF6F0] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#F97316] transition-colors"
            />
          </div>

          {/* Status Filter Tabs */}
          <div className="flex items-center gap-1 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
            {['all', 'active', 'trial', 'past_due', 'suspended', 'archived'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize whitespace-nowrap transition-colors ${
                  statusFilter === st
                    ? 'bg-[#1C1917] text-white'
                    : 'bg-[#FAF6F0] text-[#78716C] hover:bg-[#F3ECE4]'
                }`}
              >
                {st === 'all' ? 'All Status' : st.replace('_', ' ')}
              </button>
            ))}
          </div>

          {/* Plan Filter */}
          <select
            value={planFilter}
            onChange={(e) => setPlanFilter(e.target.value)}
            className="text-xs px-3 py-2 rounded-lg border border-[#E9E0D6] bg-[#FAF6F0] text-[#1C1917] focus:outline-none focus:ring-1 focus:ring-[#F97316]"
          >
            <option value="all">All Plans</option>
            <option value="starter">Starter Cafe</option>
            <option value="growth">Growth Bistro</option>
            <option value="pro">Pro Artisan</option>
            <option value="enterprise">Enterprise Chain</option>
          </select>
        </div>
      </div>

      {/* Directory Table */}
      <div className="bg-white border border-[#E9E0D6] rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#FAF6F0] border-b border-[#E9E0D6] text-[#78716C] uppercase font-semibold">
              <tr>
                <th className="py-3 px-4">Business & Slug</th>
                <th className="py-3 px-4">Owner / Contact</th>
                <th className="py-3 px-4">Location</th>
                <th className="py-3 px-4">SaaS Subscription & Deal</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Volume</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F5EFEA]">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-[#78716C]">
                    No businesses matching the selected search query or filters.
                  </td>
                </tr>
              ) : (
                filtered.map((b) => {
                  const plan = SAAS_PLANS.find((p) => p.id === b.subscription.plan_id);
                  return (
                    <tr key={b.id} className="hover:bg-[#FFFBF5] transition-colors">
                      {/* Name & Slug */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-[#1C1917] text-sm">{b.name}</div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <code className="text-[11px] font-mono px-1.5 py-0.2 bg-[#F5EFEA] text-[#78716C] rounded">
                            /{b.slug}
                          </code>
                          <span className="text-[#A8A29E]">•</span>
                          <span className="text-[11px] text-[#78716C] capitalize">{b.business_type}</span>
                        </div>
                        {b.gst_number && (
                          <div className="text-[10px] text-[#A8A29E] mt-0.5">
                            GST: <span className="font-mono">{b.gst_number}</span>
                          </div>
                        )}
                      </td>

                      {/* Owner & Contact */}
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-[#1C1917]">{b.owner_name}</div>
                        <div className="flex items-center gap-1 text-[11px] text-[#78716C] mt-0.5">
                          <Mail className="w-3 h-3 text-[#A8A29E]" />
                          <span>{b.owner_email}</span>
                        </div>
                        <div className="flex items-center gap-1 text-[11px] text-[#78716C] mt-0.5">
                          <Phone className="w-3 h-3 text-[#A8A29E]" />
                          <span>{b.owner_phone}</span>
                        </div>
                      </td>

                      {/* Location */}
                      <td className="py-3.5 px-4">
                        <div className="text-[#1C1917] font-medium">{b.city}, {b.state}</div>
                        <div className="text-[11px] text-[#78716C] truncate max-w-[180px]" title={b.address}>
                          {b.address}
                        </div>
                        <div className="text-[10px] text-[#A8A29E] mt-0.5">
                          PIN: {b.postal_code}
                        </div>
                      </td>

                      {/* Subscription & Deal */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-[#1C1917] flex items-center gap-1.5">
                          <span>{plan?.name || b.subscription.plan_id}</span>
                          {b.subscription.applied_discount_pct > 0 && (
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-[#FEF3C7] text-[#B45309]">
                              {b.subscription.applied_discount_pct}% OFF
                            </span>
                          )}
                        </div>
                        <div className="text-sm font-bold text-[#F97316] mt-0.5">
                          ₹{b.subscription.final_monthly_rate.toLocaleString('en-IN')}
                          <span className="text-[10px] font-normal text-[#78716C]">/mo</span>
                        </div>
                        {b.subscription.deal_notes && (
                          <p className="text-[10px] text-[#78716C] truncate max-w-[170px]" title={b.subscription.deal_notes}>
                            Deal: {b.subscription.deal_notes}
                          </p>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {getStatusBadge(b.status)}
                        {b.status === 'trial' && b.subscription.trial_end && (
                          <div className="text-[10px] text-[#78716C] mt-1 flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-[#A8A29E]" />
                            Ends {new Date(b.subscription.trial_end).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                          </div>
                        )}
                      </td>

                      {/* Volume */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-[#1C1917]">
                          {b.total_orders_count.toLocaleString('en-IN')} orders
                        </div>
                        <div className="text-[11px] text-[#78716C]">
                          ₹{(b.lifetime_revenue / 1000).toFixed(1)}k GMV
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Enter Cafe Workspace (SuperAdmin Impersonation) */}
                          <button
                            onClick={() => {
                              switchTenantScope(b.slug);
                              setImpersonatedTenant(b);
                              setActiveSurface('web');
                              setActiveWebTab('pos');
                              window.history.pushState(null, '', `/${b.slug}/pos`);
                            }}
                            title={`Enter ${b.name} Workspace as SuperAdmin`}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#FFF1E6] hover:bg-[#FDE2CF] text-[#EA580C] text-[11px] font-bold transition-all border border-[#FDBA74] shadow-2xs"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span>Enter Workspace</span>
                          </button>

                          {/* Change Subscription / Deal Button */}
                          <button
                            onClick={() => openSubModal(b)}
                            title="Manage Subscription Plan & Deals"
                            className="p-1.5 rounded-md hover:bg-[#F5EFEA] text-[#78716C] hover:text-[#F97316] transition-colors"
                          >
                            <CreditCard className="w-4 h-4" />
                          </button>

                          {/* Edit Profile Button */}
                          <button
                            onClick={() => setEditingBusiness({ ...b })}
                            title="Edit Business Profile"
                            className="p-1.5 rounded-md hover:bg-[#F5EFEA] text-[#78716C] hover:text-[#1C1917] transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          {/* Suspend / Reactivate */}
                          {b.status === 'suspended' ? (
                            <button
                              onClick={() => setBusinessStatus(b.id, 'active')}
                              title="Reactivate Suspended Account"
                              className="p-1.5 rounded-md hover:bg-[#DCFCE7] text-[#16A34A] transition-colors"
                            >
                              <RotateCcw className="w-4 h-4" />
                            </button>
                          ) : (
                            <button
                              onClick={() => setBusinessStatus(b.id, 'suspended')}
                              title="Suspend Business Account"
                              className="p-1.5 rounded-md hover:bg-[#FEE2E2] text-[#DC2626] transition-colors"
                            >
                              <Ban className="w-4 h-4" />
                            </button>
                          )}

                          {/* Archive / Delete */}
                          <button
                            onClick={() => deleteTenantBusiness(b.id, false)}
                            title="Archive Tenant Record"
                            className="p-1.5 rounded-md hover:bg-[#F5F5F4] text-[#A8A29E] hover:text-[#78716C] transition-colors"
                          >
                            <Archive className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: Edit Subscription & Custom Deal */}
      {subModalBusiness && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-[#E9E0D6] space-y-5 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-[#E9E0D6] pb-3">
              <div>
                <h3 className="text-lg font-bold text-[#1C1917]">Manage Subscription & Deals</h3>
                <p className="text-xs text-[#78716C]">
                  {subModalBusiness.name} (<code>/{subModalBusiness.slug}</code>)
                </p>
              </div>
              <button
                onClick={() => setSubModalBusiness(null)}
                className="p-1 text-[#A8A29E] hover:text-[#1C1917] rounded-lg hover:bg-[#FAF6F0]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Select Plan */}
              <div>
                <label className="block text-xs font-semibold text-[#1C1917] mb-2">
                  Select SaaS Monthly Plan
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {SAAS_PLANS.map((plan) => {
                    const isSelected = selectedPlanId === plan.id;
                    return (
                      <div
                        key={plan.id}
                        onClick={() => setSelectedPlanId(plan.id)}
                        className={`p-3 rounded-xl border cursor-pointer transition-all ${
                          isSelected
                            ? 'border-[#F97316] bg-[#FFF7ED] ring-1 ring-[#F97316]'
                            : 'border-[#E9E0D6] hover:bg-[#FAF6F0]'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs text-[#1C1917]">{plan.name}</span>
                          {plan.is_popular && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-[#F97316] text-white">
                              Popular
                            </span>
                          )}
                        </div>
                        <div className="text-sm font-bold text-[#F97316] mt-1">
                          ₹{plan.monthly_price}
                          <span className="text-[10px] font-normal text-[#78716C]">/mo</span>
                        </div>
                        <p className="text-[10px] text-[#78716C] mt-1 line-clamp-1">{plan.tagline}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Custom Deal / Discount % */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-[#1C1917]">
                    Custom Deal / Discount Percentage
                  </label>
                  <span className="text-xs font-bold text-[#F97316]">{discountPct}% OFF</span>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={discountPct}
                    onChange={(e) => setDiscountPct(Number(e.target.value))}
                    className="flex-1 accent-[#F97316]"
                  />
                  <div className="w-16">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={discountPct}
                      onChange={(e) => setDiscountPct(Number(e.target.value))}
                      className="w-full text-xs px-2 py-1.5 rounded-lg border border-[#E9E0D6] text-center font-bold"
                    />
                  </div>
                </div>
              </div>

              {/* Deal Notes / Rationale */}
              <div>
                <label className="block text-xs font-semibold text-[#1C1917] mb-1">
                  Deal Notes / Rationale
                </label>
                <input
                  type="text"
                  placeholder="e.g. 10% Founder Deal, Roastery launch partnership"
                  value={dealNotes}
                  onChange={(e) => setDealNotes(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-[#E9E0D6] focus:outline-none focus:ring-1 focus:ring-[#F97316]"
                />
              </div>

              {/* Live Rate Preview */}
              {(() => {
                const plan = SAAS_PLANS.find((p) => p.id === selectedPlanId) || SAAS_PLANS[0];
                const netRate = Math.round(plan.monthly_price * (1 - discountPct / 100));
                return (
                  <div className="p-3 rounded-xl bg-[#FAF6F0] border border-[#E9E0D6] flex items-center justify-between">
                    <div>
                      <span className="text-xs text-[#78716C]">Final Monthly Recurring Rate:</span>
                      <div className="text-lg font-bold text-[#1C1917]">
                        ₹{netRate.toLocaleString('en-IN')}{' '}
                        <span className="text-xs font-normal text-[#78716C]">/ month</span>
                      </div>
                    </div>
                    {discountPct > 0 && (
                      <span className="px-2 py-1 rounded bg-[#DCFCE7] text-[#166534] text-xs font-bold">
                        Save ₹{(plan.monthly_price - netRate).toLocaleString('en-IN')}/mo
                      </span>
                    )}
                  </div>
                );
              })()}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E9E0D6]">
              <button
                type="button"
                onClick={() => setSubModalBusiness(null)}
                className="px-4 py-2 rounded-lg text-xs font-medium text-[#78716C] hover:bg-[#FAF6F0]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveSubscription}
                className="px-4 py-2 rounded-lg text-xs font-medium bg-[#F97316] text-white hover:bg-[#EA580C] shadow-sm"
              >
                Save Subscription & Deal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Edit Business Profile */}
      {editingBusiness && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-[#E9E0D6] space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#E9E0D6] pb-3">
              <div>
                <h3 className="text-lg font-bold text-[#1C1917]">Edit Cafe Profile & KYC</h3>
                <p className="text-xs text-[#78716C]">Updating tenant record: {editingBusiness.name}</p>
              </div>
              <button
                onClick={() => setEditingBusiness(null)}
                className="p-1 text-[#A8A29E] hover:text-[#1C1917] rounded-lg hover:bg-[#FAF6F0]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#1C1917] mb-1">Business Name</label>
                  <input
                    type="text"
                    required
                    value={editingBusiness.name}
                    onChange={(e) => setEditingBusiness({ ...editingBusiness, name: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-[#E9E0D6] focus:outline-none focus:ring-1 focus:ring-[#F97316]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#1C1917] mb-1">Legal Registered Name</label>
                  <input
                    type="text"
                    required
                    value={editingBusiness.legal_name}
                    onChange={(e) => setEditingBusiness({ ...editingBusiness, legal_name: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-[#E9E0D6] focus:outline-none focus:ring-1 focus:ring-[#F97316]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#1C1917] mb-1">URL Slug</label>
                  <input
                    type="text"
                    required
                    value={editingBusiness.slug}
                    onChange={(e) => setEditingBusiness({ ...editingBusiness, slug: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-[#E9E0D6] font-mono focus:outline-none focus:ring-1 focus:ring-[#F97316]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#1C1917] mb-1">Business Type</label>
                  <select
                    value={editingBusiness.business_type}
                    onChange={(e) => setEditingBusiness({ ...editingBusiness, business_type: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-lg border border-[#E9E0D6] focus:outline-none focus:ring-1 focus:ring-[#F97316]"
                  >
                    <option value="cafe">Cafe & Coffee Bar</option>
                    <option value="restaurant">Casual Dining Restaurant</option>
                    <option value="quick_service">Quick Service / Kiosk</option>
                    <option value="bakery">Bakery & Patisserie</option>
                    <option value="brewery">Microbrewery & Roastery</option>
                    <option value="cloud_kitchen">Cloud Kitchen</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-[#1C1917] mb-1">Owner Full Name</label>
                  <input
                    type="text"
                    required
                    value={editingBusiness.owner_name}
                    onChange={(e) => setEditingBusiness({ ...editingBusiness, owner_name: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-[#E9E0D6] focus:outline-none focus:ring-1 focus:ring-[#F97316]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#1C1917] mb-1">Owner Email</label>
                  <input
                    type="email"
                    required
                    value={editingBusiness.owner_email}
                    onChange={(e) => setEditingBusiness({ ...editingBusiness, owner_email: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-[#E9E0D6] focus:outline-none focus:ring-1 focus:ring-[#F97316]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#1C1917] mb-1">Owner Phone</label>
                  <input
                    type="text"
                    required
                    value={editingBusiness.owner_phone}
                    onChange={(e) => setEditingBusiness({ ...editingBusiness, owner_phone: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-[#E9E0D6] focus:outline-none focus:ring-1 focus:ring-[#F97316]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#1C1917] mb-1">Merchant Settlement UPI ID</label>
                  <input
                    type="text"
                    placeholder="e.g. cafe@okaxis"
                    value={editingBusiness.upi_id || ''}
                    onChange={(e) => setEditingBusiness({ ...editingBusiness, upi_id: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-[#E9E0D6] font-mono focus:outline-none focus:ring-1 focus:ring-[#F97316]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#1C1917] mb-1">GSTIN Number</label>
                  <input
                    type="text"
                    placeholder="29ABCDE1234F1Z5"
                    value={editingBusiness.gst_number || ''}
                    onChange={(e) => setEditingBusiness({ ...editingBusiness, gst_number: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-[#E9E0D6] font-mono focus:outline-none focus:ring-1 focus:ring-[#F97316]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#1C1917] mb-1">City</label>
                  <input
                    type="text"
                    required
                    value={editingBusiness.city}
                    onChange={(e) => setEditingBusiness({ ...editingBusiness, city: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-[#E9E0D6] focus:outline-none focus:ring-1 focus:ring-[#F97316]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#1C1917] mb-1">Full Physical Street Address</label>
                <textarea
                  rows={2}
                  required
                  value={editingBusiness.address}
                  onChange={(e) => setEditingBusiness({ ...editingBusiness, address: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-[#E9E0D6] focus:outline-none focus:ring-1 focus:ring-[#F97316]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#1C1917] mb-1">Administrative Notes</label>
                <textarea
                  rows={2}
                  placeholder="Internal notes regarding client requirements, hardware setup, deal history..."
                  value={editingBusiness.notes || ''}
                  onChange={(e) => setEditingBusiness({ ...editingBusiness, notes: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-[#E9E0D6] focus:outline-none focus:ring-1 focus:ring-[#F97316]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E9E0D6]">
                <button
                  type="button"
                  onClick={() => setEditingBusiness(null)}
                  className="px-4 py-2 rounded-lg text-xs font-medium text-[#78716C] hover:bg-[#FAF6F0]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg text-xs font-medium bg-[#F97316] text-white hover:bg-[#EA580C] shadow-sm"
                >
                  Update Profile Details
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
