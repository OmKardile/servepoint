import React, { useState } from 'react';
import { useTsosStore, getCustomerTier } from '../../lib/store';
import { Customer, LoyaltyTier, LoyaltyLedger, Order } from '../../types';
import { ReceiptModal } from '../pos/ReceiptModal';
import { ManualPrintReceiptModal } from '../pos/ManualPrintReceiptModal';
import {
  Users,
  Plus,
  Sparkles,
  Phone,
  Mail,
  ShoppingBag,
  TrendingUp,
  Search,
  Award,
  X,
  History,
  Coins,
  ChevronRight,
  Filter,
  CheckCircle2,
  Calendar,
  AlertCircle,
  ExternalLink,
  ArrowUpRight,
  ArrowDownLeft,
  Sliders,
  Receipt,
  Printer,
  Send,
  CreditCard,
  Banknote,
  QrCode,
  ChevronDown,
  ChevronUp,
  Copy,
  FileText,
  Check,
} from 'lucide-react';

export const CustomersScreen: React.FC = () => {
  const {
    customers,
    addCustomer,
    addLoyaltyAdjustment,
    loyaltyLedgers,
    orders,
    setSelectedCustomerId,
    setActiveWebTab,
    location,
    themeMode,
  } = useTsosStore();
  const isServepoint = themeMode === 'servepoint';

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTierFilter, setSelectedTierFilter] = useState<string>('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedCustomerForDetail, setSelectedCustomerForDetail] = useState<Customer | null>(null);
  const [activeModalTab, setActiveModalTab] = useState<'receipts' | 'ledger' | 'adjust'>('receipts');

  // Receipt History, Re-Print & Email Modal States
  const [viewingReceiptOrder, setViewingReceiptOrder] = useState<Order | null>(null);
  const [manualPrintOrder, setManualPrintOrder] = useState<Order | null>(null);
  const [emailReceiptOrder, setEmailReceiptOrder] = useState<Order | null>(null);
  const [emailRecipient, setEmailRecipient] = useState<string>('');
  const [emailCustomNote, setEmailCustomNote] = useState<string>('Thank you for visiting TSOS Cafe & Roastery!');
  const [emailFeedback, setEmailFeedback] = useState<{ success: boolean; message: string } | null>(null);
  const [isSendingEmail, setIsSendingEmail] = useState<boolean>(false);
  const [expandedOrderIds, setExpandedOrderIds] = useState<Record<string, boolean>>({});

  // New Customer Form State
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');

  // Adjustment Form State
  const [adjustPointsDelta, setAdjustPointsDelta] = useState<number>(50);
  const [adjustReason, setAdjustReason] = useState('Staff Points Bonus (Customer Appreciation)');
  const [adjustFeedback, setAdjustFeedback] = useState<{ success: boolean; message: string } | null>(null);

  const safeCustomers = customers || [];

  // Filter customers by search and tier
  const filteredCustomers = safeCustomers.filter((c) => {
    const q = searchQuery.toLowerCase();
    const matchesQuery =
      c.name.toLowerCase().includes(q) ||
      c.phone.includes(q) ||
      (c.email && c.email.toLowerCase().includes(q));

    const tier = c.tier || getCustomerTier(c.loyalty_points);
    const matchesTier =
      selectedTierFilter === 'all' || tier.toLowerCase() === selectedTierFilter.toLowerCase();

    return matchesQuery && matchesTier;
  });

  const totalPoints = safeCustomers.reduce((sum, c) => sum + (c?.loyalty_points || 0), 0);
  const totalOrdersCount = safeCustomers.reduce((sum, c) => sum + (c?.total_orders || 0), 0);
  const totalSpend = safeCustomers.reduce((sum, c) => sum + (c?.total_spent || 0), 0);

  // Total points redeemed in history
  const totalRedeemedPoints = (loyaltyLedgers || [])
    .filter((l) => l.points_delta < 0)
    .reduce((sum, l) => sum + Math.abs(l.points_delta), 0);

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newPhone.trim()) return;
    const created = addCustomer(newName.trim(), newPhone.trim(), newEmail.trim() || undefined);
    setNewName('');
    setNewPhone('');
    setNewEmail('');
    setIsAddModalOpen(false);
    setSelectedCustomerForDetail(created);
    setActiveModalTab('ledger');
  };

  const handleApplyAdjustment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerForDetail) return;
    const result = addLoyaltyAdjustment(
      selectedCustomerForDetail.id,
      Number(adjustPointsDelta),
      adjustReason
    );
    setAdjustFeedback(result);
    setTimeout(() => setAdjustFeedback(null), 4000);

    // Refresh selected customer state
    const refreshed = useTsosStore.getState().customers.find((c) => c.id === selectedCustomerForDetail.id);
    if (refreshed) {
      setSelectedCustomerForDetail(refreshed);
    }
  };

  const handleStartOrderForCustomer = (cust: Customer) => {
    setSelectedCustomerId(cust.id);
    setActiveWebTab('pos');
  };

  // Helper for Tier Badge styling
  const getTierBadgeStyle = (tier: LoyaltyTier) => {
    if (isServepoint) {
      switch (tier) {
        case 'Platinum':
          return 'bg-[#0F3D3E]/10 text-[#0F3D3E] border-[#0F3D3E]/30';
        case 'Gold':
          return 'bg-[#B88E2F]/15 text-[#967221] border-[#B88E2F]/45';
        case 'Silver':
          return 'bg-[#6B8579]/12 text-[#4E6459] border-[#6B8579]/35';
        case 'Bronze':
        default:
          return 'bg-[#D9E2DD] text-[#0F3D3E] border-[#6B8579]/30';
      }
    }
    switch (tier) {
      case 'Platinum':
        return 'bg-purple-100 text-purple-800 border-purple-300';
      case 'Gold':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'Silver':
        return 'bg-slate-200 text-slate-800 border-slate-300';
      case 'Bronze':
      default:
        return 'bg-orange-100 text-orange-800 border-orange-200';
    }
  };

  // Helper for progress towards next tier
  const getNextTierProgress = (points: number, tier: LoyaltyTier) => {
    if (tier === 'Bronze') {
      const needed = 100;
      const pct = Math.min(100, Math.round((points / needed) * 100));
      return { nextTier: 'Silver', needed: 100 - points, progressPct: pct, target: 100 };
    }
    if (tier === 'Silver') {
      const needed = 250;
      const pct = Math.min(100, Math.round(((points - 100) / 150) * 100));
      return { nextTier: 'Gold', needed: 250 - points, progressPct: pct, target: 250 };
    }
    if (tier === 'Gold') {
      const needed = 500;
      const pct = Math.min(100, Math.round(((points - 250) / 250) * 100));
      return { nextTier: 'Platinum', needed: 500 - points, progressPct: pct, target: 500 };
    }
    return { nextTier: 'Max Tier reached', needed: 0, progressPct: 100, target: 500 };
  };

  return (
    <div className={`flex-1 flex flex-col h-[calc(100vh-100px)] overflow-hidden ${isServepoint ? 'bg-[#F6F5F2]' : 'bg-[#FFF9F2]'}`}>
      {/* Top Header */}
      <div className={`p-4 border-b flex flex-wrap items-center justify-between gap-3 shadow-2xs ${isServepoint ? 'bg-white border-[#E3E7E0]' : 'bg-white border-[#E9E0D6]'}`}>
        <div className="flex items-center gap-2.5">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${isServepoint ? 'sp-surface text-[#0F3D3E] border-[#6B8579]/30' : 'bg-[#F5F3FF] text-[#7C3AED] border-[#DDD6FE]'}`}>
            <Award className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className={`text-base font-bold leading-tight ${isServepoint ? 'text-[#1A1A1A]' : 'text-[#1C1917]'}`}>
                Customer CRM & Loyalty Points System
              </h2>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${isServepoint ? 'bg-[#D9E2DD] text-[#0F3D3E] border-[#6B8579]/30' : 'bg-emerald-100 text-emerald-800 border-emerald-200'}`}>
                1 pt = ₹1 at POS
              </span>
            </div>
            <div className={`text-xs flex items-center gap-1.5 mt-0.5 ${isServepoint ? 'text-[#6B6B6B]' : 'text-[#57534E]'}`}>
              <span>Auto-earns 1 Point per ₹10 spent on order subtotal</span>
              <span className="text-[#A8A29E]">•</span>
              <span className={`font-medium ${isServepoint ? 'text-[#B88E2F]' : 'text-[#7C3AED]'}`}>+25 pts Welcome Bonus</span>
            </div>
          </div>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold transition-colors ${
            isServepoint
              ? 'sp-cta'
              : 'rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white shadow-xs'
          }`}
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Register New Customer</span>
        </button>
      </div>

      {/* KPI & Loyalty Summary Cards */}
      <div className={`p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 border-b ${isServepoint ? 'bg-white border-[#E3E7E0]' : 'border-[#E9E0D6] bg-white'}`}>
        <div className={`p-3 rounded-xl border ${isServepoint ? 'bg-white border-[#E3E7E0]' : 'bg-[#FFF9F2] border-[#E9E0D6]'}`}>
          <div className={`text-xs flex items-center justify-between ${isServepoint ? 'text-[#6B6B6B]' : 'text-[#57534E]'}`}>
            <span>Enrolled Guests</span>
            <Users className={`w-3.5 h-3.5 ${isServepoint ? 'text-[#0F3D3E]' : 'text-[#A8A29E]'}`} />
          </div>
          <div className={`text-xl font-bold mt-0.5 ${isServepoint ? 'text-[#0F3D3E]' : 'font-mono text-[#1C1917]'}`}>
            {safeCustomers.length}
          </div>
          <div className={`text-[10px] mt-0.5 ${isServepoint ? 'text-[#6B8579]' : 'text-[#A8A29E]'}`}>
            {totalOrdersCount} lifetime orders logged
          </div>
        </div>

        <div className={`p-3 rounded-xl border ${isServepoint ? 'bg-[#D9E2DD]/45 border-[#6B8579]/25' : 'bg-[#F5F3FF] border-[#DDD6FE]'}`}>
          <div className={`text-xs font-semibold flex items-center justify-between ${isServepoint ? 'text-[#0F3D3E]' : 'text-[#7C3AED]'}`}>
            <span className="flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Active Loyalty Points</span>
            </span>
          </div>
          <div className={`text-xl font-bold mt-0.5 ${isServepoint ? 'text-[#0F3D3E]' : 'font-mono text-[#7C3AED]'}`}>
            {totalPoints.toLocaleString()} pts
          </div>
          <div className={`text-[10px] mt-0.5 font-medium ${isServepoint ? 'text-[#6B8579]' : 'text-[#7C3AED]/80'}`}>
            ₹{totalPoints.toLocaleString()} redeemable liability
          </div>
        </div>

        <div className={`p-3 rounded-xl border ${isServepoint ? 'bg-[#B88E2F]/10 border-[#B88E2F]/30' : 'bg-[#FFF1E6] border-[#F5E6D8]'}`}>
          <div className={`text-xs font-semibold flex items-center justify-between ${isServepoint ? 'text-[#967221]' : 'text-[#F97316]'}`}>
            <span className="flex items-center gap-1">
              <Coins className="w-3.5 h-3.5" />
              <span>Points Redeemed to Date</span>
            </span>
          </div>
          <div className={`text-xl font-bold mt-0.5 ${isServepoint ? 'text-[#967221]' : 'font-mono text-[#F97316]'}`}>
            {totalRedeemedPoints.toLocaleString()} pts
          </div>
          <div className={`text-[10px] mt-0.5 ${isServepoint ? 'text-[#6B8579]' : 'text-[#57534E]'}`}>
            ₹{totalRedeemedPoints.toLocaleString()} discount awarded
          </div>
        </div>

        <div className={`p-3 rounded-xl border ${isServepoint ? 'bg-white border-[#E3E7E0]' : 'bg-[#E8F5EC] border-[#A7F3D0]'}`}>
          <div className={`text-xs font-semibold flex items-center justify-between ${isServepoint ? 'text-[#17803D]' : 'text-[#17803D]'}`}>
            <span className="flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Avg Points / Guest</span>
            </span>
          </div>
          <div className={`text-xl font-bold mt-0.5 ${isServepoint ? 'text-[#17803D]' : 'font-mono text-[#17803D]'}`}>
            {safeCustomers.length > 0 ? Math.round(totalPoints / safeCustomers.length) : 0} pts
          </div>
          <div className={`text-[10px] mt-0.5 ${isServepoint ? 'text-[#6B8579]' : 'text-[#57534E]'}`}>
            ₹{totalSpend.toLocaleString()} gross sales tracked
          </div>
        </div>
      </div>

      {/* Filter, Search & Tiers Bar */}
      <div className={`p-4 flex flex-wrap items-center justify-between gap-3 border-b ${isServepoint ? 'bg-[#F6F5F2] border-[#E3E7E0]' : 'bg-[#FFF9F2] border-[#E9E0D6]'}`}>
        {/* Search */}
        <div className="relative max-w-sm w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#A8A29E]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by customer name, phone, or email..."
            className={`w-full pl-9 pr-3 py-2 text-xs rounded-xl border bg-white focus:outline-hidden shadow-2xs ${isServepoint ? 'border-[#E3E7E0] text-[#1A1A1A] focus:border-[#0F3D3E]' : 'border-[#E9E0D6] text-[#1C1917]'}`}
          />
        </div>

        {/* Tier Tabs */}
        <div className={`flex items-center gap-1 bg-white p-1 rounded-xl border ${isServepoint ? 'border-[#E3E7E0]' : 'border-[#E9E0D6]'}`}>
          {[
            { id: 'all', label: 'All Tiers' },
            { id: 'bronze', label: 'Bronze (<100 pts)' },
            { id: 'silver', label: 'Silver (100-249)' },
            { id: 'gold', label: 'Gold (250-499)' },
            { id: 'platinum', label: 'Platinum (500+)' },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setSelectedTierFilter(t.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                selectedTierFilter === t.id
                  ? isServepoint
                    ? 'bg-[#0F3D3E] text-white shadow-xs'
                    : 'bg-[#1C1917] text-white shadow-xs'
                  : isServepoint
                    ? 'text-[#6B6B6B] hover:bg-[#D9E2DD]/60'
                    : 'text-[#57534E] hover:bg-[#F5F0EB]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Customers List Table */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        <div className={`bg-white rounded-2xl border overflow-hidden shadow-xs ${isServepoint ? 'border-[#E3E7E0]' : 'border-[#E9E0D6]'}`}>
          <table className="w-full text-left text-xs">
            <thead className={`text-[10px] font-semibold uppercase tracking-wider border-b ${isServepoint ? 'bg-[#F6F5F2] border-[#E3E7E0] text-[#6B6B6B]' : 'bg-[#FFF9F2] border-[#E9E0D6] text-[#57534E]'}`}>
              <tr>
                <th className="py-3 px-4">Member Name & Tier</th>
                <th className="py-3 px-4">Contact Details</th>
                <th className="py-3 px-4">Loyalty Balance</th>
                <th className="py-3 px-4">Tier Milestone</th>
                <th className="py-3 px-4">Lifetime Orders</th>
                <th className="py-3 px-4">Total Spent</th>
                <th className="py-3 px-4 text-right">Quick Actions</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isServepoint ? 'divide-[#E3E7E0]' : 'divide-[#F5F0EB]'}`}>
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-[#A8A29E]">
                    No customers found matching the search criteria.
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((cust) => {
                  const tier = cust.tier || getCustomerTier(cust.loyalty_points);
                  const progress = getNextTierProgress(cust.loyalty_points, tier);

                  return (
                    <tr key={cust.id} className={`transition-colors ${isServepoint ? 'hover:bg-[#F6F5F2]' : 'hover:bg-[#FFF9F2]/50'}`}>
                      {/* Name & Tier */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-full font-bold text-xs flex items-center justify-center border shrink-0 ${isServepoint ? 'bg-[#D9E2DD] text-[#0F3D3E] border-[#6B8579]/30' : 'bg-[#F5F3FF] text-[#7C3AED] border-[#DDD6FE]'}`}>
                            {cust.name.charAt(0)}
                          </div>
                          <div>
                            <div className={`font-bold flex items-center gap-1.5 ${isServepoint ? 'text-[#1A1A1A]' : 'text-[#1C1917]'}`}>
                              <span>{cust.name}</span>
                              <span
                                className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full border uppercase tracking-wider ${getTierBadgeStyle(
                                  tier
                                )}`}
                              >
                                {tier}
                              </span>
                            </div>
                            <div className={`text-[10px] ${isServepoint ? 'text-[#6B8579]' : 'text-[#A8A29E]'}`}>
                              Member since {new Date(cust.created_at).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Contact */}
                      <td className={`py-3 px-4 font-mono ${isServepoint ? 'text-[#6B6B6B]' : 'text-[#57534E]'}`}>
                        <div className="flex items-center gap-1.5">
                          <Phone className="w-3 h-3 text-[#A8A29E]" />
                          <span>{cust.phone}</span>
                        </div>
                        {cust.email && (
                          <div className="flex items-center gap-1.5 text-[10px] text-[#A8A29E] mt-0.5">
                            <Mail className="w-3 h-3" />
                            <span className="truncate max-w-[140px]">{cust.email}</span>
                          </div>
                        )}
                      </td>

                      {/* Loyalty Balance */}
                      <td className="py-3 px-4">
                        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${isServepoint ? 'bg-[#D9E2DD]/60 text-[#0F3D3E] border-[#6B8579]/30' : 'bg-[#F5F3FF] text-[#7C3AED] border-[#DDD6FE]'}`}>
                          <Sparkles className={`w-3 h-3 ${isServepoint ? 'text-[#0F3D3E]' : 'text-[#7C3AED]'}`} />
                          <span>{cust.loyalty_points} Points</span>
                        </div>
                        <div className={`text-[10px] font-medium mt-0.5 font-mono ${isServepoint ? 'text-[#17803D]' : 'text-[#17803D]'}`}>
                          ₹{cust.loyalty_points} off at POS
                        </div>
                      </td>

                      {/* Tier Progress Bar */}
                      <td className="py-3 px-4 min-w-[150px]">
                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px] text-[#57534E]">
                            <span>
                              {tier === 'Platinum' ? 'VIP Tier' : `To ${progress.nextTier}:`}
                            </span>
                            <span className="font-semibold">
                              {tier === 'Platinum'
                                ? 'Highest Level'
                                : `${progress.needed} pts needed`}
                            </span>
                          </div>
                          <div className={`w-full h-1.5 rounded-full overflow-hidden ${isServepoint ? 'bg-[#D9E2DD]' : 'bg-[#E9E0D6]'}`}>
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${isServepoint ? 'bg-[#B88E2F]' : 'bg-[#7C3AED]'}`}
                              style={{ width: `${progress.progressPct}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Lifetime Orders */}
                      <td className="py-3 px-4 font-mono font-semibold text-[#1C1917]">
                        {cust.total_orders} orders
                      </td>

                      {/* Total Spent */}
                      <td className="py-3 px-4 font-mono font-bold text-[#17803D]">
                        ₹{cust.total_spent.toLocaleString()}
                      </td>

                      {/* Quick Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedCustomerForDetail(cust);
                              setActiveModalTab('receipts');
                            }}
                            title="View Customer Receipt History & Previous Orders"
                            className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold flex items-center gap-1 transition-colors ${
                              isServepoint
                                ? 'border-[#E3E7E0] bg-white hover:border-[#B88E2F] text-[#0F3D3E]'
                                : 'border-[#FDBA74] bg-[#FFF7ED] hover:bg-[#FFEDD5] text-[#C2410C] shadow-2xs'
                            }`}
                          >
                            <Receipt className={`w-3 h-3 ${isServepoint ? 'text-[#B88E2F]' : 'text-[#EA580C]'}`} />
                            <span>Receipts</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setSelectedCustomerForDetail(cust);
                              setActiveModalTab('ledger');
                            }}
                            title="View Points History & Ledger"
                            className="px-2.5 py-1 rounded-lg border border-[#E9E0D6] hover:bg-[#F5F0EB] text-[#57534E] text-[11px] font-semibold flex items-center gap-1 transition-colors"
                          >
                            <History className="w-3 h-3 text-[#7C3AED]" />
                            <span>Ledger</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setSelectedCustomerForDetail(cust);
                              setActiveModalTab('adjust');
                            }}
                            title="Manual Points Adjustment / Bonus"
                            className="px-2.5 py-1 rounded-lg border border-[#E9E0D6] hover:bg-[#F5F0EB] text-[#57534E] text-[11px] font-semibold flex items-center gap-1 transition-colors"
                          >
                            <Sliders className="w-3 h-3 text-[#F97316]" />
                            <span>Adjust</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleStartOrderForCustomer(cust)}
                            title="Start POS Order with Customer attached"
                            className={`px-2.5 py-1 rounded-lg text-white text-[11px] font-semibold flex items-center gap-1 transition-colors ${isServepoint ? 'bg-[#0F3D3E] hover:bg-[#0B3132]' : 'bg-[#1C1917] hover:bg-black shadow-2xs'}`}
                          >
                            <ShoppingBag className="w-3 h-3" />
                            <span>POS Order</span>
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

      {/* Customer Detail, Receipt History & Loyalty Ledger Modal */}
      {selectedCustomerForDetail && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className={`bg-white rounded-2xl max-w-3xl w-full border shadow-2xl overflow-hidden flex flex-col max-h-[90vh] ${isServepoint ? 'border-[#E3E7E0]' : 'border-[#E9E0D6]'}`}>
            {/* Modal Header */}
            <div className={`p-4 border-b flex items-center justify-between ${isServepoint ? 'bg-[#F6F5F2] border-[#E3E7E0]' : 'bg-[#FFF9F2] border-[#E9E0D6]'}`}>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full text-white font-bold text-sm flex items-center justify-center shadow-xs ${isServepoint ? 'bg-[#0F3D3E]' : 'bg-[#7C3AED]'}`}>
                  {selectedCustomerForDetail.name.charAt(0)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm text-[#1C1917]">
                      {selectedCustomerForDetail.name}
                    </h3>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider ${getTierBadgeStyle(
                        selectedCustomerForDetail.tier ||
                          getCustomerTier(selectedCustomerForDetail.loyalty_points)
                      )}`}
                    >
                      {selectedCustomerForDetail.tier ||
                        getCustomerTier(selectedCustomerForDetail.loyalty_points)}{' '}
                      Tier
                    </span>
                  </div>
                  <div className="text-xs text-[#57534E] flex items-center gap-2 font-mono mt-0.5">
                    <span>{selectedCustomerForDetail.phone}</span>
                    {selectedCustomerForDetail.email && (
                      <>
                        <span>•</span>
                        <span>{selectedCustomerForDetail.email}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <button
                onClick={() => setSelectedCustomerForDetail(null)}
                className="p-1 rounded-lg text-[#A8A29E] hover:text-[#1C1917] hover:bg-[#E9E0D6]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Loyalty Digital Card Highlight */}
            <div className={`p-4 text-white flex items-center justify-between shadow-inner ${
              isServepoint
                ? 'bg-linear-to-r from-[#0F3D3E] to-[#0B3132]'
                : 'bg-linear-to-r from-[#7C3AED] to-[#5B21B6]'
            }`}>
              <div>
                <div className={`text-[10px] uppercase font-semibold tracking-wider ${isServepoint ? 'text-[#D9E2DD]' : 'text-purple-200'}`}>
                  TSOS Club Member Balance
                </div>
                <div className="text-2xl font-bold flex items-center gap-2 mt-0.5">
                  <span className={isServepoint ? 'text-[#F6F5F2]' : ''}>{selectedCustomerForDetail.loyalty_points}</span>
                  <span className={`text-sm font-normal ${isServepoint ? 'text-[#D9E2DD]' : 'text-purple-200'}`}>Points</span>
                </div>
                <div className={`text-xs mt-1 ${isServepoint ? 'text-[#D9E2DD]/90' : 'text-purple-100'}`}>
                  Value at POS checkout: <strong className={isServepoint ? 'text-[#F6F5F2]' : ''}>₹{selectedCustomerForDetail.loyalty_points}.00</strong>
                </div>
              </div>

              <div className="text-right space-y-1">
                <button
                  type="button"
                  onClick={() => {
                    handleStartOrderForCustomer(selectedCustomerForDetail);
                    setSelectedCustomerForDetail(null);
                  }}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors shadow-xs flex items-center gap-1.5 ${
                    isServepoint
                      ? 'bg-[#B88E2F] text-[#1A1A1A] hover:bg-[#967221]'
                      : 'bg-white text-[#7C3AED] hover:bg-purple-50'
                  }`}
                >
                  <ShoppingBag className="w-3.5 h-3.5" />
                  <span>Redeem at POS</span>
                </button>
                <div className={`text-[10px] font-mono ${isServepoint ? 'text-[#D9E2DD]/80' : 'text-purple-200'}`}>
                  {selectedCustomerForDetail.total_orders} orders • ₹{selectedCustomerForDetail.total_spent} spent
                </div>
              </div>
            </div>

            {/* Modal Navigation Tabs */}
            <div className={`flex border-b px-4 text-xs font-semibold ${isServepoint ? 'border-[#E3E7E0] bg-[#F6F5F2]' : 'border-[#E9E0D6] bg-[#FFF9F2]'}`}>
              <button
                onClick={() => setActiveModalTab('receipts')}
                className={`py-2.5 px-3 border-b-2 flex items-center gap-1.5 transition-colors ${
                  activeModalTab === 'receipts'
                    ? isServepoint
                      ? 'border-[#0F3D3E] text-[#0F3D3E]'
                      : 'border-[#EA580C] text-[#EA580C]'
                    : isServepoint
                      ? 'border-transparent text-[#6B6B6B] hover:text-[#1A1A1A]'
                      : 'border-transparent text-[#57534E] hover:text-[#1C1917]'
                }`}
              >
                <Receipt className="w-3.5 h-3.5" />
                <span>
                  Receipt History (
                  {
                    orders.filter(
                      (o) =>
                        o.customer_id === selectedCustomerForDetail.id ||
                        (o.customer_name &&
                          o.customer_name.toLowerCase() === selectedCustomerForDetail.name.toLowerCase()) ||
                        (o.customer_phone && o.customer_phone === selectedCustomerForDetail.phone)
                    ).length
                  }
                  )
                </span>
              </button>

              <button
                onClick={() => setActiveModalTab('ledger')}
                className={`py-2.5 px-3 border-b-2 flex items-center gap-1.5 transition-colors ${
                  activeModalTab === 'ledger'
                    ? isServepoint
                      ? 'border-[#0F3D3E] text-[#0F3D3E]'
                      : 'border-[#7C3AED] text-[#7C3AED]'
                    : isServepoint
                      ? 'border-transparent text-[#6B6B6B] hover:text-[#1A1A1A]'
                      : 'border-transparent text-[#57534E] hover:text-[#1C1917]'
                }`}
              >
                <History className="w-3.5 h-3.5" />
                <span>
                  Points Ledger (
                  {loyaltyLedgers.filter((l) => l.customer_id === selectedCustomerForDetail.id).length}
                  )
                </span>
              </button>

              <button
                onClick={() => setActiveModalTab('adjust')}
                className={`py-2.5 px-3 border-b-2 flex items-center gap-1.5 transition-colors ${
                  activeModalTab === 'adjust'
                    ? isServepoint
                      ? 'border-[#0F3D3E] text-[#0F3D3E]'
                      : 'border-[#7C3AED] text-[#7C3AED]'
                    : isServepoint
                      ? 'border-transparent text-[#6B6B6B] hover:text-[#1A1A1A]'
                      : 'border-transparent text-[#57534E] hover:text-[#1C1917]'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Manual Points Adjustment</span>
              </button>
            </div>

            {/* Tab 1: Receipt History & Bill Actions */}
            {activeModalTab === 'receipts' && (() => {
              const customerOrders = orders.filter(
                (o) =>
                  o.customer_id === selectedCustomerForDetail.id ||
                  (o.customer_name &&
                    o.customer_name.toLowerCase() === selectedCustomerForDetail.name.toLowerCase()) ||
                  (o.customer_phone && o.customer_phone === selectedCustomerForDetail.phone)
              );

              const totalCustomerSpend = customerOrders.reduce((sum, o) => sum + o.grand_total, 0);
              const avgTicket =
                customerOrders.length > 0
                  ? Math.round(totalCustomerSpend / customerOrders.length)
                  : 0;

              return (
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {/* Summary Metric Ribbon */}
                  <div className="grid grid-cols-3 gap-2 bg-[#FFF9F2] p-3 rounded-xl border border-[#E9E0D6] text-xs">
                    <div>
                      <div className="text-[10px] text-[#A8A29E] uppercase font-semibold">Total Orders</div>
                      <div className="font-mono font-bold text-sm text-[#1C1917]">
                        {customerOrders.length}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-[#A8A29E] uppercase font-semibold">Lifetime Spend</div>
                      <div className="font-mono font-bold text-sm text-[#17803D]">
                        ₹{totalCustomerSpend.toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-[#A8A29E] uppercase font-semibold">Avg Ticket Size</div>
                      <div className="font-mono font-bold text-sm text-[#7C3AED]">
                        ₹{avgTicket}
                      </div>
                    </div>
                  </div>

                  {customerOrders.length === 0 ? (
                    <div className="text-center py-10 px-4 bg-[#FFFDF9] rounded-xl border border-dashed border-[#E9E0D6]">
                      <Receipt className="w-8 h-8 text-[#A8A29E] mx-auto mb-2 opacity-50" />
                      <p className="text-xs font-semibold text-[#1C1917]">No previous receipts on record</p>
                      <p className="text-[11px] text-[#78716C] mt-0.5">
                        Completed orders linked to this customer phone or name will appear here with re-print and email tools.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          handleStartOrderForCustomer(selectedCustomerForDetail);
                          setSelectedCustomerForDetail(null);
                        }}
                        className="mt-3 px-3 py-1.5 rounded-lg bg-[#1C1917] hover:bg-black text-white text-xs font-medium inline-flex items-center gap-1.5"
                      >
                        <ShoppingBag className="w-3.5 h-3.5" />
                        <span>Start POS Order for {selectedCustomerForDetail.name.split(' ')[0]}</span>
                      </button>
                    </div>
                  ) : (
                    customerOrders.map((ord) => {
                      const isExpanded = !!expandedOrderIds[ord.id];
                      return (
                        <div
                          key={ord.id}
                          className="bg-white rounded-xl border border-[#E9E0D6] hover:border-[#D6C7B8] transition-all shadow-2xs overflow-hidden"
                        >
                          {/* Order Header Summary */}
                          <div className="p-3.5 flex flex-wrap items-center justify-between gap-2 border-b border-[#F5F0EB]">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-lg bg-[#FFF7ED] border border-[#FFEDD5] text-[#EA580C] flex items-center justify-center shrink-0">
                                <Receipt className="w-4 h-4" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-xs text-[#1C1917] font-mono">
                                    #{ord.order_number}
                                  </span>
                                  <span
                                    className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                                      ord.status === 'completed'
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : ord.status === 'ready'
                                        ? 'bg-blue-100 text-blue-800'
                                        : 'bg-amber-100 text-amber-800'
                                    }`}
                                  >
                                    {ord.status}
                                  </span>
                                  <span className="text-[10px] text-[#78716C] capitalize bg-[#F5F0EB] px-1.5 py-0.5 rounded font-medium">
                                    {ord.order_type.replace('_', ' ')}
                                    {ord.table_id ? ` • Table ${ord.table_id.replace('t', '')}` : ''}
                                  </span>
                                </div>
                                <div className="text-[10px] text-[#A8A29E] flex items-center gap-2 mt-0.5">
                                  <span>{new Date(ord.created_at || Date.now()).toLocaleString()}</span>
                                  <span>•</span>
                                  <span className="capitalize font-mono font-medium text-[#57534E]">
                                    Paid via {ord.payment_method}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-3">
                              <div className="text-right">
                                <div className="font-mono font-bold text-sm text-[#17803D]">
                                  ₹{ord.grand_total.toFixed(2)}
                                </div>
                                <div className="text-[10px] text-[#7C3AED] font-semibold">
                                  {ord.loyalty_points_earned
                                    ? `+${ord.loyalty_points_earned} pts`
                                    : `+${Math.floor(ord.subtotal / 10)} pts`}
                                  {ord.loyalty_points_redeemed
                                    ? ` • -${ord.loyalty_points_redeemed} redeemed`
                                    : ''}
                                </div>
                              </div>

                              {/* Action Buttons: Re-Print, Quick View, Email */}
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setManualPrintOrder(ord)}
                                  title="Thermal ESC/POS Web Bluetooth Print"
                                  className="px-2.5 py-1.5 rounded-lg border border-[#E9E0D6] bg-white hover:bg-[#F5F0EB] text-[#1C1917] text-xs font-semibold flex items-center gap-1 transition-colors"
                                >
                                  <Printer className="w-3.5 h-3.5 text-[#0284C7]" />
                                  <span>Re-Print</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => setViewingReceiptOrder(ord)}
                                  title="Quick View Digital Receipt"
                                  className="px-2.5 py-1.5 rounded-lg border border-[#E9E0D6] bg-white hover:bg-[#F5F0EB] text-[#57534E] text-xs font-semibold flex items-center gap-1 transition-colors"
                                >
                                  <FileText className="w-3.5 h-3.5 text-[#78716C]" />
                                  <span className="hidden sm:inline">View</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setEmailReceiptOrder(ord);
                                    setEmailRecipient(selectedCustomerForDetail.email || '');
                                    setEmailFeedback(null);
                                  }}
                                  title="Email Copy of Bill / Tax Invoice"
                                  className="px-2.5 py-1.5 rounded-lg bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs font-semibold flex items-center gap-1 shadow-2xs transition-colors"
                                >
                                  <Mail className="w-3.5 h-3.5" />
                                  <span>Email Copy</span>
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Collapsible Order Item Details */}
                          <div className="px-3.5 py-2 bg-[#FAF7F2] flex items-center justify-between text-[11px] text-[#57534E]">
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedOrderIds((prev) => ({
                                  ...prev,
                                  [ord.id]: !prev[ord.id],
                                }))
                              }
                              className="flex items-center gap-1 text-[#78716C] hover:text-[#1C1917] font-medium transition-colors"
                            >
                              {isExpanded ? (
                                <>
                                  <ChevronUp className="w-3.5 h-3.5" />
                                  <span>Hide Items breakdown ({ord.items.length})</span>
                                </>
                              ) : (
                                <>
                                  <ChevronDown className="w-3.5 h-3.5" />
                                  <span>Show {ord.items.length} items breakdown</span>
                                </>
                              )}
                            </button>

                            <div className="font-mono text-[10px] text-[#78716C] flex items-center gap-2">
                              <span>Subtotal: ₹{ord.subtotal}</span>
                              <span>•</span>
                              <span>Tax: ₹{ord.tax_total.toFixed(1)}</span>
                              {ord.platform_fee > 0 && (
                                <>
                                  <span>•</span>
                                  <span>Fee: ₹{ord.platform_fee}</span>
                                </>
                              )}
                            </div>
                          </div>

                          {isExpanded && (
                            <div className="p-3 bg-white border-t border-[#F5F0EB] text-xs space-y-1.5 animate-in fade-in">
                              <div className="font-semibold text-[10px] uppercase text-[#A8A29E] tracking-wider mb-1">
                                Itemized Bill Breakdown:
                              </div>
                              {ord.items.map((item, idx) => (
                                <div
                                  key={idx}
                                  className="flex items-center justify-between py-1 border-b border-[#FAF5EE] last:border-none text-[#1C1917]"
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono font-bold text-[#7C3AED] w-5">
                                      {item.qty}x
                                    </span>
                                    <div>
                                      <span className="font-medium">{item.menu_item_name}</span>
                                      {item.variant_name && (
                                        <span className="text-[10px] text-[#78716C] ml-1">
                                          ({item.variant_name})
                                        </span>
                                      )}
                                      {item.addons && item.addons.length > 0 && (
                                        <div className="text-[10px] text-[#78716C]">
                                          +{' '}
                                          {item.addons
                                            .map((a) => `${a.name} (₹${a.price})`)
                                            .join(', ')}
                                        </div>
                                      )}
                                      {item.notes && (
                                        <div className="text-[10px] text-[#EA580C] italic">
                                          Note: {item.notes}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  <div className="font-mono font-medium text-[#1C1917]">
                                    ₹{(item.item_total || item.unit_price * item.qty).toFixed(2)}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              );
            })()}

            {/* Tab 2: Ledger History */}
            {activeModalTab === 'ledger' && (
              <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
                {loyaltyLedgers.filter((l) => l.customer_id === selectedCustomerForDetail.id).length === 0 ? (
                  <div className="text-center py-8 text-[#A8A29E] text-xs">
                    No points transactions recorded yet for this customer.
                  </div>
                ) : (
                  loyaltyLedgers
                    .filter((l) => l.customer_id === selectedCustomerForDetail.id)
                    .map((entry) => (
                      <div
                        key={entry.id}
                        className="p-3 rounded-xl border border-[#E9E0D6] bg-white flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                              entry.points_delta >= 0
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {entry.points_delta >= 0 ? (
                              <ArrowUpRight className="w-4 h-4" />
                            ) : (
                              <ArrowDownLeft className="w-4 h-4" />
                            )}
                          </div>
                          <div>
                            <div className="font-semibold text-[#1C1917]">{entry.reason}</div>
                            <div className="text-[10px] text-[#A8A29E] flex items-center gap-2">
                              <span>{new Date(entry.created_at).toLocaleString()}</span>
                              {entry.ref_order_id && (
                                <>
                                  <span>•</span>
                                  <span className="font-mono">{entry.ref_order_id}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="text-right">
                          <div
                            className={`font-mono font-bold text-xs ${
                              entry.points_delta >= 0 ? 'text-emerald-700' : 'text-rose-700'
                            }`}
                          >
                            {entry.points_delta >= 0 ? `+${entry.points_delta}` : entry.points_delta} pts
                          </div>
                          <div className="text-[10px] text-[#57534E] font-mono">
                            Bal: {entry.balance_after} pts
                          </div>
                        </div>
                      </div>
                    ))
                )}
              </div>
            )}

            {/* Tab 3: Manual Points Adjustment */}
            {activeModalTab === 'adjust' && (
              <form onSubmit={handleApplyAdjustment} className="flex-1 overflow-y-auto p-4 space-y-4">
                {adjustFeedback && (
                  <div
                    className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                      adjustFeedback.success
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : 'bg-rose-50 text-rose-800 border border-rose-200'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{adjustFeedback.message}</span>
                  </div>
                )}

                <div className="p-3 bg-[#FFF9F2] rounded-xl border border-[#E9E0D6] text-xs text-[#57534E]">
                  Managers can award bonus loyalty points (e.g. Birthday, VIP perk, apology for order delay) or correct balances.
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#57534E] mb-1">
                    Points Adjustment (Delta)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={adjustPointsDelta}
                      onChange={(e) => setAdjustPointsDelta(Number(e.target.value))}
                      className="w-32 px-3 py-2 text-xs font-mono font-bold rounded-xl border border-[#E9E0D6] focus:border-[#7C3AED] focus:outline-hidden"
                    />
                    <div className="flex gap-1.5">
                      {[+25, +50, +100, -25, -50].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setAdjustPointsDelta(preset)}
                          className={`px-2 py-1 text-[11px] font-mono rounded-lg border transition-colors ${
                            adjustPointsDelta === preset
                              ? 'bg-[#7C3AED] text-white border-[#7C3AED]'
                              : 'bg-white text-[#57534E] border-[#E9E0D6] hover:bg-[#F5F0EB]'
                          }`}
                        >
                          {preset >= 0 ? `+${preset}` : preset}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#57534E] mb-1">
                    Reason for Adjustment
                  </label>
                  <select
                    value={adjustReason}
                    onChange={(e) => setAdjustReason(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-[#E9E0D6] bg-white focus:border-[#7C3AED] focus:outline-hidden"
                  >
                    <option value="Staff Points Bonus (Customer Appreciation)">
                      Staff Points Bonus (Customer Appreciation)
                    </option>
                    <option value="Birthday Celebration Bonus">Birthday Celebration Bonus</option>
                    <option value="Customer Satisfaction / Service Recovery">
                      Customer Satisfaction / Service Recovery
                    </option>
                    <option value="Special Festival Promotion Gift">
                      Special Festival Promotion Gift
                    </option>
                    <option value="Manual Balance Correction">Manual Balance Correction</option>
                  </select>
                </div>

                <div className="p-3 bg-white rounded-xl border border-[#E9E0D6] flex items-center justify-between text-xs">
                  <span className="text-[#57534E]">Projected New Balance:</span>
                  <span className="font-mono font-bold text-sm text-[#7C3AED]">
                    {Math.max(0, selectedCustomerForDetail.loyalty_points + adjustPointsDelta)} points
                    (Tier: {getCustomerTier(Math.max(0, selectedCustomerForDetail.loyalty_points + adjustPointsDelta))})
                  </span>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 px-4 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs font-semibold shadow-xs transition-colors"
                >
                  Save & Apply Points Adjustment
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Email Bill / Digital Invoice Modal */}
      {emailReceiptOrder && selectedCustomerForDetail && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-60 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-[#E9E0D6] shadow-2xl overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="p-4 bg-[#F5F3FF] border-b border-[#DDD6FE] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#7C3AED] text-white flex items-center justify-center shadow-xs">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-[#1C1917]">Email Digital Bill Copy</h3>
                  <p className="text-[11px] text-[#7C3AED]">
                    Order #{emailReceiptOrder.order_number} • ₹{emailReceiptOrder.grand_total.toFixed(2)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEmailReceiptOrder(null)}
                className="p-1 rounded-lg text-[#A8A29E] hover:text-[#1C1917]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Email Form & Live Preview */}
            <div className="p-4 space-y-4 max-h-[75vh] overflow-y-auto">
              {emailFeedback && (
                <div
                  className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                    emailFeedback.success
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-rose-50 text-rose-800 border border-rose-200'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{emailFeedback.message}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-[#57534E] mb-1">
                  Recipient Email Address
                </label>
                <input
                  type="email"
                  value={emailRecipient}
                  onChange={(e) => setEmailRecipient(e.target.value)}
                  placeholder="e.g. customer@example.com"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-[#E9E0D6] focus:border-[#7C3AED] focus:outline-hidden font-mono"
                />
                {!selectedCustomerForDetail.email && (
                  <p className="text-[10px] text-[#EA580C] mt-1">
                    * Customer did not have an email saved on profile. Enter their email above to dispatch the bill.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#57534E] mb-1">
                  Custom Greeting / Note (Optional)
                </label>
                <input
                  type="text"
                  value={emailCustomNote}
                  onChange={(e) => setEmailCustomNote(e.target.value)}
                  placeholder="e.g. Thank you for dining with us!"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-[#E9E0D6] focus:border-[#7C3AED] focus:outline-hidden"
                />
              </div>

              {/* Digital Invoice Preview Box */}
              <div className="p-3 bg-[#FAF7F2] rounded-xl border border-[#E9E0D6] text-xs font-mono space-y-2">
                <div className="text-center pb-2 border-b border-[#E9E0D6]">
                  <div className="font-bold text-[#1C1917]">{location.name}</div>
                  <div className="text-[10px] text-[#78716C]">{location.address}</div>
                  <div className="text-[10px] text-[#78716C]">GSTIN: 27AABCT3518Q1ZY</div>
                </div>

                <div className="flex justify-between text-[11px] text-[#57534E]">
                  <span>Order: #{emailReceiptOrder.order_number}</span>
                  <span>{new Date(emailReceiptOrder.created_at || Date.now()).toLocaleDateString()}</span>
                </div>
                <div className="text-[11px] text-[#57534E]">
                  Customer: <strong>{selectedCustomerForDetail.name}</strong>
                </div>

                {/* Items preview */}
                <div className="pt-2 border-t border-[#E9E0D6] space-y-1">
                  {emailReceiptOrder.items.map((it, idx) => (
                    <div key={idx} className="flex justify-between text-[11px] text-[#1C1917]">
                      <span>
                        {it.qty}x {it.menu_item_name}
                      </span>
                      <span>₹{(it.item_total || it.unit_price * it.qty).toFixed(2)}</span>
                    </div>
                  ))}
                </div>

                <div className="pt-2 border-t border-[#E9E0D6] space-y-0.5 text-[11px] text-[#57534E]">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span>₹{emailReceiptOrder.subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>GST (5%)</span>
                    <span>₹{emailReceiptOrder.tax_total.toFixed(2)}</span>
                  </div>
                  {emailReceiptOrder.platform_fee > 0 && (
                    <div className="flex justify-between">
                      <span>Platform Fee</span>
                      <span>₹{emailReceiptOrder.platform_fee.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-[#1C1917] text-xs pt-1 border-t border-[#E9E0D6]">
                    <span>Grand Total Paid ({emailReceiptOrder.payment_method})</span>
                    <span className="text-[#17803D]">₹{emailReceiptOrder.grand_total.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="p-4 bg-[#FFF9F2] border-t border-[#E9E0D6] flex flex-wrap items-center justify-between gap-2">
              {/* Mailto link fallback */}
              {(() => {
                const mailSubject = encodeURIComponent(
                  `Tax Invoice & Receipt for Order #${emailReceiptOrder.order_number} - ${location.name}`
                );
                const mailBody = encodeURIComponent(
                  `Dear ${selectedCustomerForDetail.name},\n\n` +
                    `${emailCustomNote}\n\n` +
                    `================================\n` +
                    `${location.name}\n` +
                    `Order #${emailReceiptOrder.order_number}\n` +
                    `Date: ${new Date(emailReceiptOrder.created_at || Date.now()).toLocaleString()}\n` +
                    `Payment: ${emailReceiptOrder.payment_method}\n` +
                    `================================\n\n` +
                    `ITEMS:\n` +
                    emailReceiptOrder.items
                      .map((i) => `${i.qty}x ${i.menu_item_name} - ₹${(i.item_total || i.unit_price * i.qty).toFixed(2)}`)
                      .join('\n') +
                    `\n\n` +
                    `Subtotal: ₹${emailReceiptOrder.subtotal.toFixed(2)}\n` +
                    `GST Tax: ₹${emailReceiptOrder.tax_total.toFixed(2)}\n` +
                    `Grand Total: ₹${emailReceiptOrder.grand_total.toFixed(2)}\n\n` +
                    `Thank you for dining with TSOS!`
                );
                return (
                  <a
                    href={`mailto:${emailRecipient}?subject=${mailSubject}&body=${mailBody}`}
                    className="px-3 py-2 rounded-xl border border-[#E9E0D6] bg-white hover:bg-[#F5F0EB] text-[#57534E] text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-[#7C3AED]" />
                    <span>Open in Mail Client</span>
                  </a>
                );
              })()}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEmailReceiptOrder(null)}
                  className="px-3.5 py-2 text-xs font-semibold text-[#57534E] hover:text-[#1C1917]"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  disabled={!emailRecipient || isSendingEmail}
                  onClick={() => {
                    if (!emailRecipient) return;
                    setIsSendingEmail(true);
                    setTimeout(() => {
                      setIsSendingEmail(false);
                      setEmailFeedback({
                        success: true,
                        message: `Tax invoice copy successfully emailed to ${emailRecipient}! Dispatch Ref #INV-${emailReceiptOrder.order_number}-${Date.now().toString().slice(-4)}`,
                      });
                      setTimeout(() => {
                        setEmailReceiptOrder(null);
                        setEmailFeedback(null);
                      }, 2500);
                    }, 600);
                  }}
                  className="px-4 py-2 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isSendingEmail ? 'Dispatching Email...' : 'Send Digital Bill Copy'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick View Receipt Modal */}
      {viewingReceiptOrder && (
        <ReceiptModal
          order={viewingReceiptOrder}
          onClose={() => setViewingReceiptOrder(null)}
        />
      )}

      {/* ESC/POS Thermal Re-Print Modal */}
      {manualPrintOrder && (
        <ManualPrintReceiptModal
          initialOrder={manualPrintOrder}
          onClose={() => setManualPrintOrder(null)}
        />
      )}

      {/* Add Customer Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-sm w-full border border-[#E9E0D6] p-5 shadow-xl">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isServepoint ? 'sp-surface text-[#0F3D3E]' : 'bg-[#F5F3FF] text-[#7C3AED]'}`}>
                  <Award className="w-4 h-4" />
                </div>
                <div>
                  <h3 className={`font-bold text-sm ${isServepoint ? 'text-[#1A1A1A]' : 'text-[#1C1917]'}`}>Register New Customer</h3>
                  <p className={`text-[10px] ${isServepoint ? 'text-[#B88E2F]' : 'text-[#7C3AED]'}`}>Includes +25 pts Welcome Bonus</p>
                </div>
              </div>
              <button onClick={() => setIsAddModalOpen(false)} className="text-[#A8A29E] hover:text-[#1C1917]">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#57534E] mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Vikram Joshi"
                  className={`w-full px-3 py-2 text-xs rounded-xl border focus:outline-hidden ${isServepoint ? 'border-[#E3E7E0] focus:border-[#0F3D3E]' : 'border-[#E9E0D6] focus:border-[#7C3AED]'}`}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#57534E] mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  required
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className={`w-full px-3 py-2 text-xs rounded-xl border focus:outline-hidden ${isServepoint ? 'border-[#E3E7E0] focus:border-[#0F3D3E]' : 'border-[#E9E0D6] focus:border-[#7C3AED]'}`}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#57534E] mb-1">
                  Email Address (Optional)
                </label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="vikram@example.com"
                  className={`w-full px-3 py-2 text-xs rounded-xl border focus:outline-hidden ${isServepoint ? 'border-[#E3E7E0] focus:border-[#0F3D3E]' : 'border-[#E9E0D6] focus:border-[#7C3AED]'}`}
                />
              </div>

              <div className={`p-2.5 rounded-xl border text-[11px] ${isServepoint ? 'bg-[#D9E2DD]/50 border-[#6B8579]/30 text-[#0F3D3E]' : 'bg-[#F5F3FF] border-[#DDD6FE] text-[#7C3AED]'}`}>
                ✨ New members automatically receive a <strong>25 points welcome registration bonus</strong> (₹25 value) redeemable immediately at POS!
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-[#57534E] hover:text-[#1C1917]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`px-4 py-1.5 text-xs font-semibold rounded-xl shadow-xs ${isServepoint ? 'bg-[#0F3D3E] text-white hover:bg-[#0B3132]' : 'bg-[#7C3AED] text-white hover:bg-[#6D28D9]'}`}
                >
                  Register & Credit 25 Pts
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
