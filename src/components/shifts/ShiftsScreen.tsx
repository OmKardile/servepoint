import React, { useState, useEffect, useMemo } from 'react';
import { useTsosStore } from '../../lib/store';
import { StaffMember, StaffShift, StaffRole } from '../../types';
import { DrawerReconciliationModal } from './DrawerReconciliationModal';
import {
  Clock,
  UserCheck,
  UserX,
  Plus,
  Play,
  Square,
  Coffee,
  Calendar,
  DollarSign,
  Download,
  Filter,
  Search,
  CheckCircle2,
  AlertCircle,
  FileText,
  Edit2,
  Trash2,
  Users,
  ShieldCheck,
  ChevronDown,
  Sparkles,
  ArrowUpRight,
  TrendingUp,
  Calculator,
  Banknote,
  Coins,
  KeyRound,
} from 'lucide-react';
import { StaffPinPadModal } from '../auth/StaffPinPadModal';

export const ShiftsScreen: React.FC = () => {
  const {
    staffMembers,
    shifts,
    clockInStaff,
    clockOutStaff,
    recordBreak,
    addManualShift,
    updateShift,
    deleteShift,
    addStaffMember,
    updateStaffMember,
    setActiveWebTab,
    themeMode,
  } = useTsosStore();
  const isServepoint = themeMode === 'servepoint';

  // Active view tab: 'roster' (Clock In / History) | 'payroll' (Payroll Calculations) | 'staff' (Staff Directory)
  const [activeSubTab, setActiveSubTab] = useState<'roster' | 'payroll' | 'staff'>('roster');

  // Filters
  const [selectedStaffFilter, setSelectedStaffFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<'today' | 'week' | 'month' | 'all'>('week');
  const [searchQuery, setSearchQuery] = useState('');
  const [historyStatusFilter, setHistoryStatusFilter] = useState<'all' | 'open' | 'closed'>('all');

  // Modals & Panels
  const [isClockInOpen, setIsClockInOpen] = useState(false);
  const [isFastPinOpen, setIsFastPinOpen] = useState(false);
  const [isManualShiftOpen, setIsManualShiftOpen] = useState(false);
  const [isAddStaffOpen, setIsAddStaffOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<StaffShift | null>(null);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [clockOutTarget, setClockOutTarget] = useState<StaffShift | null>(null);
  const [reconcilingShift, setReconcilingShift] = useState<StaffShift | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Form states for Clock In
  const [selectedClockInStaffId, setSelectedClockInStaffId] = useState<string>('');
  const [clockInPin, setClockInPin] = useState<string>('');
  const [clockInNotes, setClockInNotes] = useState<string>('');

  // Form states for Clock Out
  const [clockOutBreaks, setClockOutBreaks] = useState<number>(0);
  const [clockOutNotes, setClockOutNotes] = useState<string>('');

  // Form states for Manual Shift
  const [manualStaffId, setManualStaffId] = useState<string>('');
  const [manualClockIn, setManualClockIn] = useState<string>('');
  const [manualClockOut, setManualClockOut] = useState<string>('');
  const [manualBreaks, setManualBreaks] = useState<number>(30);
  const [manualNotes, setManualNotes] = useState<string>('');

  // Form states for Add Staff
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffRole, setNewStaffRole] = useState<StaffRole>('barista');
  const [newStaffPhone, setNewStaffPhone] = useState('');
  const [newStaffRate, setNewStaffRate] = useState<number>(200);
  const [newStaffPin, setNewStaffPin] = useState('');

  // Live seconds ticker for active shifts
  const [now, setNow] = useState<Date>(new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Shift duration ticker — minute-granularity elapsed time shown on active shift cards
  const [nowMinute, setNowMinute] = useState<Date>(() => new Date());
  useEffect(() => {
    const durationTimer = setInterval(() => setNowMinute(new Date()), 60000);
    return () => clearInterval(durationTimer);
  }, []);

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3500);
  };

  const handleFastPinClockIn = (staff: StaffMember) => {
    const isAlreadyClockedIn = activeShifts.some((s) => s.staff_id === staff.id);
    if (isAlreadyClockedIn) {
      showNotification('error', `${staff.name} is already clocked in.`);
      return;
    }
    const res = clockInStaff(staff.id, 'Fast PIN Keypad Clock In');
    if (res.success) {
      showNotification('success', `Clocked in ${staff.name} (${staff.role.toUpperCase()})`);
    } else {
      showNotification('error', res.message || 'Failed to clock in');
    }
  };

  // Active shifts currently on the floor
  const safeShifts = shifts || [];
  const safeStaffMembers = staffMembers || [];

  const activeShifts = useMemo(() => {
    return safeShifts.filter((s) => s && s.status === 'active');
  }, [safeShifts]);

  // Date filtering logic
  const filteredShifts = useMemo(() => {
    const cutoffDate = new Date();
    if (dateFilter === 'today') {
      cutoffDate.setHours(0, 0, 0, 0);
    } else if (dateFilter === 'week') {
      cutoffDate.setDate(cutoffDate.getDate() - 7);
      cutoffDate.setHours(0, 0, 0, 0);
    } else if (dateFilter === 'month') {
      cutoffDate.setDate(cutoffDate.getDate() - 30);
      cutoffDate.setHours(0, 0, 0, 0);
    } else {
      cutoffDate.setTime(0);
    }

    return safeShifts.filter((shift) => {
      if (!shift) return false;
      const shiftDate = new Date(shift.clock_in);
      if (dateFilter !== 'all' && shiftDate < cutoffDate) return false;
      if (selectedStaffFilter !== 'all' && shift.staff_id !== selectedStaffFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = shift.staff_name?.toLowerCase().includes(q);
        const matchesRole = shift.role?.toLowerCase().includes(q);
        const matchesNotes = shift.notes?.toLowerCase().includes(q);
        if (!matchesName && !matchesRole && !matchesNotes) return false;
      }
      return true;
    });
  }, [safeShifts, dateFilter, selectedStaffFilter, searchQuery]);

  // History table view — All / Open / Closed segmented filter applied on top of date/staff/search filters
  const visibleHistoryShifts = useMemo(() => {
    return filteredShifts.filter((shift) => {
      if (!shift) return false;
      if (historyStatusFilter === 'open') return shift.status === 'active';
      if (historyStatusFilter === 'closed') return shift.status === 'completed';
      return true;
    });
  }, [filteredShifts, historyStatusFilter]);

  // Payroll Calculation aggregations
  const payrollSummary = useMemo(() => {
    const summaryMap: {
      [staffId: string]: {
        staffId: string;
        name: string;
        role: StaffRole;
        hourlyRate: number;
        shiftCount: number;
        regularHours: number;
        overtimeHours: number;
        totalHours: number;
        grossPay: number;
      };
    } = {};

    // Initialize all staff
    safeStaffMembers.forEach((staff) => {
      if (!staff) return;
      summaryMap[staff.id] = {
        staffId: staff.id,
        name: staff.name,
        role: staff.role,
        hourlyRate: staff.hourly_rate,
        shiftCount: 0,
        regularHours: 0,
        overtimeHours: 0,
        totalHours: 0,
        grossPay: 0,
      };
    });

    // Aggregate completed and active shifts in filtered date range
    filteredShifts.forEach((shift) => {
      if (!shift) return;
      if (!summaryMap[shift.staff_id]) {
        summaryMap[shift.staff_id] = {
          staffId: shift.staff_id,
          name: shift.staff_name,
          role: shift.role,
          hourlyRate: shift.hourly_rate,
          shiftCount: 0,
          regularHours: 0,
          overtimeHours: 0,
          totalHours: 0,
          grossPay: 0,
        };
      }

      const item = summaryMap[shift.staff_id];
      item.shiftCount += 1;

      if (shift.status === 'completed') {
        const reg = shift.regular_hours ?? Math.min(8, shift.total_hours ?? 0);
        const ot = shift.overtime_hours ?? Math.max(0, (shift.total_hours ?? 0) - 8);
        item.regularHours += reg;
        item.overtimeHours += ot;
        item.totalHours += shift.total_hours ?? 0;
        item.grossPay += shift.total_pay ?? 0;
      } else {
        // Active shift estimated hours so far
        const diffHours = Math.max(0, (now.getTime() - new Date(shift.clock_in).getTime()) / (1000 * 3600) - ((shift.break_minutes || 0) / 60));
        const reg = Math.min(8, diffHours);
        const ot = Math.max(0, diffHours - 8);
        const pay = reg * shift.hourly_rate + ot * shift.hourly_rate * 1.5;
        item.regularHours += reg;
        item.overtimeHours += ot;
        item.totalHours += diffHours;
        item.grossPay += pay;
      }
    });

    return Object.values(summaryMap);
  }, [safeStaffMembers, filteredShifts, now]);

  const totalGrossPayroll = useMemo(() => {
    return (payrollSummary || []).reduce((sum, item) => sum + (item?.grossPay || 0), 0);
  }, [payrollSummary]);

  const totalHoursWorked = useMemo(() => {
    return (payrollSummary || []).reduce((sum, item) => sum + (item?.totalHours || 0), 0);
  }, [payrollSummary]);

  // Helper formatting
  const formatDuration = (hours: number) => {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h}h ${m}m`;
  };

  const formatTime = (isoString?: string) => {
    if (!isoString) return '--:--';
    return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (isoString?: string) => {
    if (!isoString) return '--';
    return new Date(isoString).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      weekday: 'short',
    });
  };

  const getLiveDuration = (clockIn: string, breakMinutes: number) => {
    const diffMs = Math.max(0, now.getTime() - new Date(clockIn).getTime());
    const totalMins = Math.floor(diffMs / 60000);
    const netMins = Math.max(0, totalMins - breakMinutes);
    const h = Math.floor(netMins / 60);
    const m = netMins % 60;
    const s = Math.floor((diffMs % 60000) / 1000);
    return { h, m, s, netHours: netMins / 60 };
  };

  // Minute-granularity shift duration (elapsed from clock-in, net of breaks)
  const getShiftDuration = (clockIn: string, breakMinutes: number) => {
    const diffMs = Math.max(0, nowMinute.getTime() - new Date(clockIn).getTime());
    const netMins = Math.max(0, Math.floor(diffMs / 60000) - breakMinutes);
    return { h: Math.floor(netMins / 60), m: netMins % 60 };
  };

  // Clock In Submit
  const handleClockInSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClockInStaffId) {
      showNotification('error', 'Please select an employee.');
      return;
    }
    const staff = staffMembers.find((s) => s.id === selectedClockInStaffId);
    if (!staff) return;

    if (staff.pin_code && clockInPin !== staff.pin_code) {
      showNotification('error', 'Incorrect employee PIN code.');
      return;
    }

    const res = clockInStaff(selectedClockInStaffId, clockInNotes);
    if (res.success) {
      showNotification('success', res.message);
      setIsClockInOpen(false);
      setSelectedClockInStaffId('');
      setClockInPin('');
      setClockInNotes('');
    } else {
      showNotification('error', res.message);
    }
  };

  // Clock Out Submit
  const handleClockOutSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clockOutTarget) return;

    const res = clockOutStaff(clockOutTarget.id, clockOutBreaks, clockOutNotes || undefined);
    if (res.success) {
      showNotification('success', res.message);
      setClockOutTarget(null);
      setClockOutBreaks(0);
      setClockOutNotes('');
    } else {
      showNotification('error', res.message);
    }
  };

  // Manual Shift Submit
  const handleManualShiftSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualStaffId || !manualClockIn || !manualClockOut) {
      showNotification('error', 'Please fill in all shift times.');
      return;
    }

    const inDate = new Date(manualClockIn);
    const outDate = new Date(manualClockOut);
    if (outDate <= inDate) {
      showNotification('error', 'Clock out time must be after clock in time.');
      return;
    }

    addManualShift({
      staff_id: manualStaffId,
      clock_in: inDate.toISOString(),
      clock_out: outDate.toISOString(),
      break_minutes: Number(manualBreaks) || 0,
      notes: manualNotes,
    });

    showNotification('success', 'Manual shift entry saved successfully.');
    setIsManualShiftOpen(false);
    setManualStaffId('');
    setManualClockIn('');
    setManualClockOut('');
    setManualBreaks(30);
    setManualNotes('');
  };

  // Add Staff Submit
  const handleAddStaffSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaffName.trim()) {
      showNotification('error', 'Please enter employee name.');
      return;
    }

    addStaffMember({
      location_id: 'loc-demo-01',
      name: newStaffName.trim(),
      role: newStaffRole,
      phone: newStaffPhone || '+91 98000 00000',
      hourly_rate: Number(newStaffRate) || 200,
      pin_code: newStaffPin || '1234',
      is_active: true,
    });

    showNotification('success', `Added ${newStaffName} to cafe staff directory.`);
    setIsAddStaffOpen(false);
    setNewStaffName('');
    setNewStaffPhone('');
    setNewStaffRate(200);
    setNewStaffPin('');
  };

  // CSV Export for Payroll
  const exportPayrollCSV = () => {
    const headers = ['Staff Name', 'Role', 'Hourly Rate (₹)', 'Shifts Count', 'Regular Hours', 'Overtime Hours', 'Total Hours', 'Gross Pay (₹)'];
    const rows = payrollSummary.map((item) => [
      `"${item.name}"`,
      item.role,
      item.hourlyRate,
      item.shiftCount,
      item.regularHours.toFixed(2),
      item.overtimeHours.toFixed(2),
      item.totalHours.toFixed(2),
      Math.round(item.grossPay),
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Cafe_Payroll_${dateFilter}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showNotification('success', 'Payroll report exported to CSV.');
  };

  return (
    <div className={`flex-1 flex flex-col h-[calc(100vh-100px)] overflow-hidden ${isServepoint ? 'bg-[#F6F5F2]' : 'bg-[#FFF9F2]'}`}>
      {/* Toast Notification */}
      {notification && (
        <div
          className={`fixed top-14 right-6 z-50 px-4 py-3 rounded-xl shadow-lg border text-sm flex items-center gap-2.5 transition-all ${
            notification.type === 'success'
              ? 'bg-[#E8F5EC] border-[#A7F3D0] text-[#17803D]'
              : 'bg-[#FEF2F2] border-[#FECACA] text-[#B42318]'
          }`}
        >
          {notification.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
          )}
          <span className="font-medium">{notification.message}</span>
        </div>
      )}

      {/* Top Header Bar */}
      <div className={`p-4 bg-white border-b flex flex-wrap items-center justify-between gap-3 ${isServepoint ? 'border-[#E3E7E0]' : 'border-[#E9E0D6]'}`}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-xs ${isServepoint ? 'sp-surface text-[#0F3D3E]' : 'bg-[#FFF1E6] text-[#F97316]'}`}>
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className={`text-base font-bold leading-tight ${isServepoint ? 'text-[#1A1A1A]' : 'text-[#1C1917]'}`}>
                Staff Shifts & Cafe Payroll
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#E8F5EC] text-[#17803D] flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#17803D] animate-pulse" />
                {activeShifts.length} Clocked In
              </span>
            </div>
            <div className={`text-xs ${isServepoint ? 'text-[#6B6B6B]' : 'text-[#57534E]'}`}>
              Clock-in terminal, live floor hours tracking, and automated wage calculations
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => {
              if (activeShifts.length > 0) {
                setReconcilingShift(activeShifts[0]);
              } else if (shifts.length > 0) {
                setReconcilingShift(shifts[0]);
              } else {
                showNotification('error', 'No shifts available for drawer reconciliation.');
              }
            }}
            className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl shadow-xs transition-colors ${
              isServepoint
                ? 'border border-[#E3E7E0] bg-white hover:bg-[#F6F5F2] text-[#0F3D3E]'
                : 'bg-[#FFF1E6] hover:bg-[#FED7AA] border border-[#FED7AA] text-[#B45309]'
            }`}
          >
            <Calculator className={`w-3.5 h-3.5 ${isServepoint ? 'text-[#0F3D3E]' : 'text-[#B45309]'}`} />
            <span>Reconcile Cash Drawer</span>
          </button>

          <button
            onClick={() => setIsFastPinOpen(true)}
            className={`flex items-center gap-1.5 px-3.5 py-2 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer ${
              isServepoint ? 'bg-[#0F3D3E] hover:bg-[#0B3132]' : 'bg-[#1C1917] hover:bg-black'
            }`}
            title="Fast 4-digit numeric keypad clock in"
          >
            <KeyRound className={`w-3.5 h-3.5 ${isServepoint ? 'text-[#B88E2F]' : 'text-[#F97316]'}`} />
            <span>Fast PIN Clock In</span>
          </button>

          <button
            onClick={() => setIsClockInOpen(true)}
            className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl ${
              isServepoint ? 'sp-cta' : 'bg-[#F97316] hover:bg-[#EA580C] text-white shadow-xs'
            } transition-colors`}
          >
            <Play className="w-3.5 h-3.5" />
            <span>Clock In Staff</span>
          </button>

          <button
            onClick={() => setIsManualShiftOpen(true)}
            className={`flex items-center gap-1.5 px-3 py-2 border text-xs font-semibold rounded-xl transition-colors ${
              isServepoint
                ? 'bg-white hover:bg-[#F6F5F2] border-[#E3E7E0] text-[#0F3D3E]'
                : 'bg-white hover:bg-[#F5F0EB] border-[#E9E0D6] text-[#1C1917]'
            }`}
          >
            <FileText className={`w-3.5 h-3.5 ${isServepoint ? 'text-[#0F3D3E]' : 'text-[#57534E]'}`} />
            <span>Log Shift</span>
          </button>

          <button
            onClick={() => setActiveWebTab('reports')}
            className={`hidden sm:flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border transition-colors ${
              isServepoint
                ? 'bg-white hover:bg-[#F6F5F2] border-[#E3E7E0] text-[#B88E2F] hover:text-[#967221]'
                : 'bg-[#FFF1E6] hover:bg-[#FED7AA] text-[#C2410C] border-[#FDBA74]/40'
            }`}
            title="View Sales Heatmap to schedule staff"
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Peak Hours Heatmap</span>
            <ArrowUpRight className="w-3 h-3 ml-0.5 opacity-70" />
          </button>
        </div>
      </div>

      {/* Subnav & Metrics Bar */}
      <div className={`bg-white border-b px-4 py-2 flex flex-wrap items-center justify-between gap-3 text-xs ${isServepoint ? 'border-[#E3E7E0]' : 'border-[#E9E0D6]'}`}>
        {/* Module Sub-Tabs */}
        <div className={`flex items-center gap-1 p-1 rounded-xl ${isServepoint ? 'bg-[#D9E2DD]' : 'bg-[#F5F0EB]'}`}>
          <button
            onClick={() => setActiveSubTab('roster')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
              activeSubTab === 'roster'
                ? isServepoint
                  ? 'bg-[#0F3D3E] text-white shadow-xs'
                  : 'bg-white text-[#F97316] shadow-xs'
                : isServepoint
                  ? 'text-[#6B6B6B] hover:text-[#0F3D3E]'
                  : 'text-[#57534E] hover:text-[#1C1917]'
            }`}
          >
            Active Shifts & History
          </button>
          <button
            onClick={() => setActiveSubTab('payroll')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
              activeSubTab === 'payroll'
                ? isServepoint
                  ? 'bg-[#0F3D3E] text-white shadow-xs'
                  : 'bg-white text-[#F97316] shadow-xs'
                : isServepoint
                  ? 'text-[#6B6B6B] hover:text-[#0F3D3E]'
                  : 'text-[#57534E] hover:text-[#1C1917]'
            }`}
          >
            Payroll Calculations ({dateFilter})
          </button>
          <button
            onClick={() => setActiveSubTab('staff')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
              activeSubTab === 'staff'
                ? isServepoint
                  ? 'bg-[#0F3D3E] text-white shadow-xs'
                  : 'bg-white text-[#F97316] shadow-xs'
                : isServepoint
                  ? 'text-[#6B6B6B] hover:text-[#0F3D3E]'
                  : 'text-[#57534E] hover:text-[#1C1917]'
            }`}
          >
            Staff Directory ({staffMembers.length})
          </button>
        </div>

        {/* Quick KPI stats */}
        <div className={`flex items-center gap-4 ${isServepoint ? 'text-[#6B6B6B]' : 'text-[#57534E]'}`}>
          <div>
            <span className={isServepoint ? 'text-[#6B8579]' : 'text-[#A8A29E]'}>Period Hours: </span>
            <span className={`font-bold ${isServepoint ? 'text-[#0F3D3E]' : 'font-mono text-[#1C1917]'}`}>{totalHoursWorked.toFixed(1)} hrs</span>
          </div>
          <div className={`h-3 w-px ${isServepoint ? 'bg-[#E3E7E0]' : 'bg-[#E9E0D6]'}`} />
          <div>
            <span className={isServepoint ? 'text-[#6B8579]' : 'text-[#A8A29E]'}>Estimated Payroll: </span>
            <span className={`font-bold ${isServepoint ? 'text-[#0F3D3E]' : 'font-mono text-[#17803D]'}`}>₹{Math.round(totalGrossPayroll).toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* ================= VIEW 1: ACTIVE SHIFTS & SHIFT HISTORY ================= */}
        {activeSubTab === 'roster' && (
          <>
            {/* Live Active Shifts Section */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#17803D] animate-ping" />
                  <h3 className={`font-bold text-sm ${isServepoint ? 'text-[#1A1A1A]' : 'text-[#1C1917]'}`}>Currently Clocked In on Floor</h3>
                </div>
                <span className={`text-xs ${isServepoint ? 'text-[#6B8579]' : 'text-[#A8A29E]'}`}>{activeShifts.length} employees active</span>
              </div>

              {activeShifts.length === 0 ? (
                <div className={`p-6 bg-white rounded-2xl border border-dashed text-center ${isServepoint ? 'border-[#E3E7E0]' : 'border-[#E9E0D6]'}`}>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-2 ${isServepoint ? 'sp-surface text-[#0F3D3E]' : 'bg-[#FFF1E6] text-[#F97316]'}`}>
                    <UserX className="w-5 h-5" />
                  </div>
                  <div className={`text-sm font-semibold ${isServepoint ? 'text-[#1A1A1A]' : 'text-[#1C1917]'}`}>No staff currently clocked in</div>
                  <div className={`text-xs mt-0.5 ${isServepoint ? 'text-[#6B6B6B]' : 'text-[#57534E]'}`}>Click "Clock In Staff" to punch in baristas and cashiers.</div>
                  <button
                    onClick={() => setIsClockInOpen(true)}
                    className={`mt-3 px-3.5 py-1.5 text-xs font-semibold rounded-lg ${
                      isServepoint ? 'sp-cta' : 'bg-[#F97316] text-white hover:bg-[#EA580C]'
                    } transition-colors`}
                  >
                    Clock In Now
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {activeShifts.map((shift) => {
                    const duration = getLiveDuration(shift.clock_in, shift.break_minutes);
                    const shiftDuration = getShiftDuration(shift.clock_in, shift.break_minutes);
                    const accruedPay = Math.round(duration.netHours * shift.hourly_rate);

                    return (
                      <div
                        key={shift.id}
                        className={`bg-white rounded-2xl p-4 border shadow-xs flex flex-col justify-between relative overflow-hidden ${
                          isServepoint ? 'border-[#E3E7E0]' : 'border-[#FED7AA]'
                        }`}
                      >
                        <div className={`absolute top-0 right-0 w-2 h-full ${isServepoint ? 'bg-[#B88E2F]' : 'bg-[#F97316]'}`} />

                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <div>
                              <h4 className={`font-bold text-sm ${isServepoint ? 'text-[#1A1A1A]' : 'text-[#1C1917]'}`}>{shift.staff_name}</h4>
                              <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                                isServepoint ? 'bg-[#D9E2DD] text-[#0F3D3E]' : 'bg-[#FFF1E6] text-[#C2410C]'
                              }`}>
                                {shift.role}
                              </span>
                            </div>
                            <div className="text-right">
                              <div className={`text-xs font-bold ${isServepoint ? 'text-[#0F3D3E]' : 'font-mono text-[#17803D]'}`}>
                                ₹{accruedPay}
                              </div>
                              <div className={`text-[10px] ${isServepoint ? 'text-[#6B8579]' : 'text-[#A8A29E]'}`}>@ ₹{shift.hourly_rate}/hr</div>
                            </div>
                          </div>

                          {/* Live Timer Counter */}
                          <div className={`p-2.5 rounded-xl border flex items-center justify-between my-2 ${
                            isServepoint ? 'bg-[#F6F5F2] border-[#E3E7E0]' : 'bg-[#FFF9F2] border-[#E9E0D6]'
                          }`}>
                            <div className={`flex items-center gap-1.5 text-xs ${isServepoint ? 'text-[#6B6B6B]' : 'text-[#57534E]'}`}>
                              <Clock className={`w-3.5 h-3.5 animate-spin ${isServepoint ? 'text-[#0F3D3E]' : 'text-[#F97316]'}`} style={{ animationDuration: '6s' }} />
                              <span>Elapsed:</span>
                            </div>
                            <div className={`text-sm font-bold ${isServepoint ? 'text-[#0F3D3E]' : 'font-mono text-[#1C1917]'}`}>
                              {String(duration.h).padStart(2, '0')}:{String(duration.m).padStart(2, '0')}:
                              <span className={isServepoint ? 'text-[#B88E2F]' : 'text-[#F97316]'}>{String(duration.s).padStart(2, '0')}</span>
                            </div>
                          </div>

                          {/* Shift duration live ticker (minute-granularity) */}
                          <div className="flex items-center justify-between text-[11px] px-0.5">
                            <span className={isServepoint ? 'text-[#6B8579]' : 'text-[#A8A29E]'}>Shift duration</span>
                            <span className={`font-semibold ${isServepoint ? 'text-[#0F3D3E]' : 'text-[#1C1917]'}`}>
                              {shiftDuration.h}h {String(shiftDuration.m).padStart(2, '0')}m
                            </span>
                          </div>

                          <div className={`text-[11px] flex items-center justify-between ${isServepoint ? 'text-[#6B6B6B]' : 'text-[#57534E]'}`}>
                            <span>Clocked in at {formatTime(shift.clock_in)}</span>
                            <span>Break: {shift.break_minutes} mins</span>
                          </div>

                          {shift.notes && (
                            <div className={`mt-2 text-[11px] italic truncate ${isServepoint ? 'text-[#6B8579]' : 'text-[#A8A29E]'}`}>
                              "{shift.notes}"
                            </div>
                          )}
                        </div>

                        {/* Controls */}
                        <div className={`mt-4 pt-3 border-t flex items-center gap-1.5 ${isServepoint ? 'border-[#E3E7E0]' : 'border-[#F5F0EB]'}`}>
                          <button
                            onClick={() => recordBreak(shift.id, 15)}
                            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-colors ${
                              isServepoint
                                ? 'bg-[#F6F5F2] hover:bg-[#D9E2DD] text-[#0F3D3E]'
                                : 'bg-[#F5F0EB] hover:bg-[#E9E0D6] text-[#57534E]'
                            }`}
                            title="Add 15 min break"
                          >
                            <Coffee className="w-3 h-3" />
                            <span>+15m</span>
                          </button>

                          <button
                            onClick={() => setReconcilingShift(shift)}
                            className={`flex-1 px-2 py-1.5 rounded-lg border text-xs font-bold flex items-center justify-center gap-1 transition-colors ${
                              isServepoint
                                ? 'bg-white hover:bg-[#F6F5F2] border-[#E3E7E0] text-[#0F3D3E]'
                                : 'bg-[#FFF9F2] hover:bg-[#FED7AA] border-[#FED7AA] text-[#B45309]'
                            }`}
                            title="Count cash drawer & audit variance"
                          >
                            <Calculator className="w-3 h-3" />
                            <span>Reconcile</span>
                          </button>

                          <button
                            onClick={() => {
                              setClockOutTarget(shift);
                              setClockOutBreaks(shift.break_minutes);
                            }}
                            className="flex-1 px-2.5 py-1.5 rounded-lg bg-[#B42318] hover:bg-[#91180F] text-white text-xs font-semibold flex items-center justify-center gap-1 transition-colors"
                          >
                            <Square className="w-3 h-3 fill-current" />
                            <span>Clock Out</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Shift History & Filters */}
            <div className={`bg-white rounded-2xl border shadow-xs overflow-hidden ${isServepoint ? 'border-[#E3E7E0]' : 'border-[#E9E0D6]'}`}>
              {/* Filter controls */}
              <div className={`p-4 border-b flex flex-wrap items-center justify-between gap-3 ${isServepoint ? 'border-[#E3E7E0]' : 'border-[#E9E0D6]'}`}>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className={`font-bold text-sm mr-2 ${isServepoint ? 'text-[#1A1A1A]' : 'text-[#1C1917]'}`}>Shift History</h3>

                  {/* Status Filter: All / Open / Closed */}
                  <div
                    className={`flex items-center gap-1 p-1 rounded-lg ${
                      isServepoint ? 'bg-[#D9E2DD]' : 'bg-[#FFF9F2] border border-[#E9E0D6]'
                    }`}
                    role="group"
                    aria-label="Filter shifts by status"
                  >
                    {([
                      { id: 'all', label: 'All' },
                      { id: 'open', label: 'Open' },
                      { id: 'closed', label: 'Closed' },
                    ] as const).map((st) => (
                      <button
                        key={st.id}
                        onClick={() => setHistoryStatusFilter(st.id)}
                        className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                          historyStatusFilter === st.id
                            ? isServepoint
                              ? 'bg-[#0F3D3E] text-white font-bold shadow-xs'
                              : 'bg-white text-[#F97316] font-bold shadow-xs'
                            : isServepoint
                              ? 'text-[#6B6B6B] hover:text-[#0F3D3E]'
                              : 'text-[#57534E] hover:text-[#1C1917]'
                        }`}
                      >
                        {st.label}
                      </button>
                    ))}
                  </div>

                  {/* Date Filter Tabs */}
                  <div className={`flex items-center gap-1 p-1 rounded-lg ${
                    isServepoint ? 'bg-[#D9E2DD]' : 'bg-[#FFF9F2] border border-[#E9E0D6]'
                  }`}>
                    {(['today', 'week', 'month', 'all'] as const).map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setDateFilter(tab)}
                        className={`px-2.5 py-1 rounded-md text-xs font-medium capitalize transition-colors ${
                          dateFilter === tab
                            ? isServepoint
                              ? 'bg-[#0F3D3E] text-white font-bold shadow-xs'
                              : 'bg-white text-[#F97316] font-bold shadow-xs'
                            : isServepoint
                              ? 'text-[#6B6B6B] hover:text-[#0F3D3E]'
                              : 'text-[#57534E] hover:text-[#1C1917]'
                        }`}
                      >
                        {tab === 'today' ? 'Today' : tab === 'week' ? 'Past 7 Days' : tab === 'month' ? 'This Month' : 'All Time'}
                      </button>
                    ))}
                  </div>

                  {/* Staff Select Filter */}
                  <select
                    value={selectedStaffFilter}
                    onChange={(e) => setSelectedStaffFilter(e.target.value)}
                    className={`text-xs rounded-lg px-2.5 py-1.5 font-medium focus:outline-none ${
                      isServepoint
                        ? 'bg-white border border-[#E3E7E0] text-[#1A1A1A] focus:border-[#B88E2F] focus:ring-1 focus:ring-[#B88E2F]/30'
                        : 'bg-[#FFF9F2] border border-[#E9E0D6] text-[#1C1917] focus:ring-1 focus:ring-[#F97316]'
                    }`}
                  >
                    <option value="all">All Staff Members</option>
                    {staffMembers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.role})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#A8A29E]" />
                    <input
                      type="text"
                      placeholder="Search shifts..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className={`text-xs pl-8 pr-3 py-1.5 rounded-lg border focus:outline-none w-36 sm:w-48 ${
                        isServepoint
                          ? 'bg-white border-[#E3E7E0] text-[#1A1A1A] focus:border-[#B88E2F] focus:ring-1 focus:ring-[#B88E2F]/30'
                          : 'border-[#E9E0D6] bg-[#FFF9F2] text-[#1C1917] focus:ring-1 focus:ring-[#F97316]'
                      }`}
                    />
                  </div>
                  <button
                    onClick={exportPayrollCSV}
                    className={`flex items-center gap-1 px-3 py-1.5 border text-xs font-semibold rounded-lg transition-colors ${
                      isServepoint
                        ? 'bg-white hover:bg-[#F6F5F2] border-[#E3E7E0] text-[#0F3D3E]'
                        : 'bg-[#FFF9F2] hover:bg-[#F5F0EB] text-[#57534E] border-[#E9E0D6]'
                    }`}
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Export</span>
                  </button>
                </div>
              </div>

              {/* Shifts Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className={`border-b font-semibold uppercase tracking-wider text-[11px] ${
                    isServepoint ? 'bg-[#F6F5F2] border-[#E3E7E0] text-[#6B6B6B]' : 'bg-[#FFF9F2] border-[#E9E0D6] text-[#57534E]'
                  }`}>
                    <tr>
                      <th className="px-4 py-3">Staff & Role</th>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Clock In — Out</th>
                      <th className="px-4 py-3">Break</th>
                      <th className="px-4 py-3">Hours Worked</th>
                      <th className="px-4 py-3">Hourly Rate</th>
                      <th className="px-4 py-3">Gross Pay</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Drawer Audit</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${isServepoint ? 'divide-[#E3E7E0]' : 'divide-[#F5F0EB]'}`}>
                    {visibleHistoryShifts.length === 0 ? (
                      <tr>
                        <td colSpan={10} className={`px-4 py-8 text-center text-xs ${isServepoint ? 'text-[#6B8579]' : 'text-[#A8A29E]'}`}>
                          No shift logs found matching the selected filter.
                        </td>
                      </tr>
                    ) : (
                      visibleHistoryShifts.map((shift) => {
                        const isLive = shift.status === 'active';
                        const liveDur = isLive ? getLiveDuration(shift.clock_in, shift.break_minutes) : null;
                        const netHrs = isLive ? liveDur!.netHours : shift.total_hours || 0;
                        const pay = isLive ? Math.round(netHrs * shift.hourly_rate) : shift.total_pay || 0;
                        const hasOvertime = (shift.overtime_hours && shift.overtime_hours > 0) || netHrs > 8;

                        return (
                          <tr key={shift.id} className={`transition-colors ${isServepoint ? 'hover:bg-[#F6F5F2]/60' : 'hover:bg-[#FFF9F2]/50'}`}>
                            <td className={`px-4 py-3 font-semibold ${isServepoint ? 'text-[#1A1A1A]' : 'text-[#1C1917]'}`}>
                              <div>{shift.staff_name}</div>
                              <div className={`text-[11px] font-normal capitalize ${isServepoint ? 'text-[#6B8579]' : 'text-[#A8A29E]'}`}>
                                {shift.role}
                              </div>
                            </td>
                            <td className={`px-4 py-3 whitespace-nowrap ${isServepoint ? 'text-[#6B6B6B]' : 'text-[#57534E] font-mono'}`}>
                              {formatDate(shift.clock_in)}
                            </td>
                            <td className={`px-4 py-3 whitespace-nowrap ${isServepoint ? 'text-[#1A1A1A]' : 'text-[#1C1917] font-mono'}`}>
                              <span>{formatTime(shift.clock_in)}</span>
                              <span className={`mx-1 ${isServepoint ? 'text-[#6B8579]' : 'text-[#A8A29E]'}`}>→</span>
                              {isLive ? (
                                <span className={`font-semibold ${isServepoint ? 'text-[#B88E2F]' : 'text-[#F97316]'}`}>Active Now</span>
                              ) : (
                                <span>{formatTime(shift.clock_out)}</span>
                              )}
                            </td>
                            <td className={`px-4 py-3 ${isServepoint ? 'text-[#6B6B6B]' : 'text-[#57534E] font-mono'}`}>
                              {shift.break_minutes}m
                            </td>
                            <td className="px-4 py-3">
                              <span className={`font-bold ${isServepoint ? 'text-[#0F3D3E]' : 'text-[#1C1917] font-mono'}`}>{netHrs.toFixed(2)} hrs</span>
                              {hasOvertime && (
                                <span className={`ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                  isServepoint ? 'bg-[#B88E2F]/15 text-[#967221]' : 'bg-[#FEF3C7] text-[#B45309]'
                                }`}>
                                  OT
                                </span>
                              )}
                            </td>
                            <td className={`px-4 py-3 ${isServepoint ? 'text-[#6B6B6B]' : 'font-mono text-[#57534E]'}`}>
                              ₹{shift.hourly_rate}/hr
                            </td>
                            <td className={`px-4 py-3 font-bold ${isServepoint ? 'text-[#0F3D3E]' : 'font-mono text-[#17803D]'}`}>
                              ₹{Math.round(pay)}
                            </td>
                            <td className="px-4 py-3">
                              {isLive ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#E8F5EC] text-[#17803D] inline-flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-[#17803D] animate-ping" />
                                  Clocked In
                                </span>
                              ) : (
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                  isServepoint ? 'bg-white text-[#6B6B6B] border border-[#E3E7E0]' : 'bg-[#F5F0EB] text-[#57534E]'
                                }`}>
                                  Completed
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {shift.reconciliation ? (
                                <button
                                  type="button"
                                  onClick={() => setReconcilingShift(shift)}
                                  className={`px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1.5 shadow-2xs transition-all ${
                                    shift.reconciliation.status === 'balanced'
                                      ? isServepoint
                                        ? 'bg-[#E8F5EC] text-[#17803D] hover:bg-[#D6EADD] border border-[#B7DCC5]'
                                        : 'bg-[#DCFCE7] text-[#15803D] hover:bg-[#BBF7D0] border border-[#86EFAC]'
                                      : shift.reconciliation.status === 'surplus'
                                      ? isServepoint
                                        ? 'bg-[#B88E2F]/15 text-[#967221] hover:bg-[#B88E2F]/25 border border-[#B88E2F]/40'
                                        : 'bg-[#DBEAFE] text-[#1E40AF] hover:bg-[#BFDBFE] border border-[#93C5FD]'
                                      : isServepoint
                                        ? 'bg-[#FEF2F2] text-[#B42318] hover:bg-[#FDE3E3] border border-[#F5C6C0]'
                                        : 'bg-[#FEE2E2] text-[#B91C1C] hover:bg-[#FECACA] border border-[#FCA5A5]'
                                  }`}
                                  title="Click to view drawer reconciliation slip"
                                >
                                  <Calculator className="w-3 h-3" />
                                  <span>
                                    {shift.reconciliation.status === 'balanced'
                                      ? 'Balanced (₹0)'
                                      : `${shift.reconciliation.variance > 0 ? '+' : ''}₹${shift.reconciliation.variance}`}
                                  </span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setReconcilingShift(shift)}
                                  className={`px-2 py-1 rounded-lg text-[10px] font-semibold flex items-center gap-1 transition-colors ${
                                    isServepoint
                                      ? 'text-[#0F3D3E] bg-white hover:bg-[#F6F5F2] border border-[#E3E7E0]'
                                      : 'text-[#B45309] bg-[#FFF9F2] hover:bg-[#FED7AA]/50 border border-[#FED7AA]'
                                  }`}
                                  title="Perform drawer reconciliation count"
                                >
                                  <Calculator className="w-3 h-3" />
                                  <span>Count Till</span>
                                </button>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => setEditingShift(shift)}
                                  className={`p-1 rounded transition-colors ${
                                    isServepoint
                                      ? 'text-[#6B6B6B] hover:text-[#0F3D3E] hover:bg-[#F6F5F2]'
                                      : 'text-[#57534E] hover:text-[#1C1917] hover:bg-[#F5F0EB]'
                                  }`}
                                  title="Edit Shift Details"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => {
                                    if (window.confirm(`Delete shift record for ${shift.staff_name}?`)) {
                                      deleteShift(shift.id);
                                      showNotification('success', 'Shift record deleted');
                                    }
                                  }}
                                  className={`p-1 rounded transition-colors ${
                                    isServepoint
                                      ? 'text-[#6B8579] hover:text-[#B42318] hover:bg-[#FEF2F2]'
                                      : 'text-[#A8A29E] hover:text-[#B42318] hover:bg-[#FEF2F2]'
                                  }`}
                                  title="Delete Shift"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
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
          </>
        )}

        {/* ================= VIEW 2: PAYROLL CALCULATIONS ================= */}
        {activeSubTab === 'payroll' && (
          <div className="space-y-4">
            {/* Payroll KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className={`p-4 rounded-2xl border shadow-xs ${isServepoint ? 'bg-[#D9E2DD]/45 border-[#6B8579]/25' : 'bg-white border-[#E9E0D6]'}`}>
                <div className={`text-xs mb-1 ${isServepoint ? 'font-semibold text-[#0F3D3E]' : 'text-[#57534E]'}`}>Total Payroll Expenditure</div>
                <div className={`text-2xl font-bold ${isServepoint ? 'text-[#0F3D3E]' : 'font-mono text-[#17803D]'}`}>
                  ₹{Math.round(totalGrossPayroll).toLocaleString()}
                </div>
                <div className={`text-[11px] mt-1 capitalize ${isServepoint ? 'text-[#6B8579]' : 'text-[#A8A29E]'}`}>For {dateFilter === 'today' ? 'Today' : dateFilter === 'week' ? 'Past 7 Days' : dateFilter === 'month' ? 'This Month' : 'All Time'}</div>
              </div>

              <div className={`p-4 rounded-2xl border shadow-xs ${isServepoint ? 'bg-white border-[#E3E7E0]' : 'bg-white border-[#E9E0D6]'}`}>
                <div className={`text-xs mb-1 ${isServepoint ? 'text-[#6B6B6B]' : 'text-[#57534E]'}`}>Total Shift Hours</div>
                <div className={`text-2xl font-bold ${isServepoint ? 'text-[#0F3D3E]' : 'font-mono text-[#1C1917]'}`}>
                  {totalHoursWorked.toFixed(1)} hrs
                </div>
                <div className={`text-[11px] mt-1 ${isServepoint ? 'text-[#6B8579]' : 'text-[#57534E]'}`}>Across {(payrollSummary || []).reduce((acc, c) => acc + (c?.shiftCount || 0), 0)} shift logs</div>
              </div>

              <div className={`p-4 rounded-2xl border shadow-xs ${isServepoint ? 'bg-[#B88E2F]/10 border-[#B88E2F]/30' : 'bg-white border-[#E9E0D6]'}`}>
                <div className={`text-xs mb-1 ${isServepoint ? 'font-semibold text-[#967221]' : 'text-[#57534E]'}`}>Avg Hourly Cost</div>
                <div className={`text-2xl font-bold ${isServepoint ? 'text-[#967221]' : 'font-mono text-[#F97316]'}`}>
                  ₹{totalHoursWorked > 0 ? Math.round(totalGrossPayroll / totalHoursWorked) : 0}/hr
                </div>
                <div className={`text-[11px] mt-1 ${isServepoint ? 'text-[#6B8579]' : 'text-[#A8A29E]'}`}>Blended wage rate</div>
              </div>

              <div className={`p-4 rounded-2xl border shadow-xs flex flex-col justify-between ${
                isServepoint ? 'bg-white border-[#E3E7E0]' : 'bg-gradient-to-br from-[#FFF4E5] to-[#FFF9F2] border-[#FED7AA]'
              }`}>
                <div>
                  <div className={`text-xs font-semibold ${isServepoint ? 'text-[#0F3D3E]' : 'text-[#C2410C]'}`}>Payroll Export Ready</div>
                  <div className={`text-xs mt-1 ${isServepoint ? 'text-[#6B6B6B]' : 'text-[#57534E]'}`}>Compliant CSV payroll file for bank disbursals & accountant audit.</div>
                </div>
                <button
                  onClick={exportPayrollCSV}
                  className={`mt-3 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl transition-colors ${
                    isServepoint ? 'sp-cta' : 'bg-[#F97316] hover:bg-[#EA580C] text-white shadow-xs'
                  }`}
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download CSV Slip</span>
                </button>
              </div>
            </div>

            {/* Payroll Breakdown Table */}
            <div className={`bg-white rounded-2xl border shadow-xs overflow-hidden ${isServepoint ? 'border-[#E3E7E0]' : 'border-[#E9E0D6]'}`}>
              <div className={`p-4 border-b flex flex-wrap items-center justify-between gap-3 ${isServepoint ? 'border-[#E3E7E0]' : 'border-[#E9E0D6]'}`}>
                <div>
                  <h3 className={`font-bold text-sm ${isServepoint ? 'text-[#1A1A1A]' : 'text-[#1C1917]'}`}>Staff Payroll Breakdown</h3>
                  <div className={`text-xs ${isServepoint ? 'text-[#6B6B6B]' : 'text-[#57534E]'}`}>Calculated based on verified clock-in/out timestamps and overtime (&gt;8 hrs @ 1.5x)</div>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`text-xs ${isServepoint ? 'text-[#6B6B6B]' : 'text-[#57534E]'}`}>Timeframe:</span>
                  <div className={`flex items-center gap-1 p-1 rounded-lg ${
                    isServepoint ? 'bg-[#D9E2DD]' : 'bg-[#FFF9F2] border border-[#E9E0D6]'
                  }`}>
                    {(['today', 'week', 'month', 'all'] as const).map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setDateFilter(tab)}
                        className={`px-2.5 py-1 rounded-md text-xs font-medium capitalize transition-colors ${
                          dateFilter === tab
                            ? isServepoint
                              ? 'bg-[#0F3D3E] text-white font-bold shadow-xs'
                              : 'bg-white text-[#F97316] font-bold shadow-xs'
                            : isServepoint
                              ? 'text-[#6B6B6B] hover:text-[#0F3D3E]'
                              : 'text-[#57534E] hover:text-[#1C1917]'
                        }`}
                      >
                        {tab}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className={`border-b font-semibold uppercase tracking-wider text-[11px] ${
                    isServepoint ? 'bg-[#F6F5F2] border-[#E3E7E0] text-[#6B6B6B]' : 'bg-[#FFF9F2] border-[#E9E0D6] text-[#57534E]'
                  }`}>
                    <tr>
                      <th className="px-4 py-3">Employee Name</th>
                      <th className="px-4 py-3">Role</th>
                      <th className="px-4 py-3">Hourly Rate</th>
                      <th className="px-4 py-3">Shifts Logged</th>
                      <th className="px-4 py-3">Regular Hours</th>
                      <th className="px-4 py-3">Overtime (1.5x)</th>
                      <th className="px-4 py-3">Total Hours</th>
                      <th className="px-4 py-3 font-bold">Gross Payable</th>
                      <th className="px-4 py-3 text-right">Audit Status</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${isServepoint ? 'divide-[#E3E7E0]' : 'divide-[#F5F0EB]'}`}>
                    {payrollSummary.map((item) => (
                      <tr key={item.staffId} className={`transition-colors ${isServepoint ? 'hover:bg-[#F6F5F2]/60' : 'hover:bg-[#FFF9F2]/50'}`}>
                        <td className={`px-4 py-3 font-semibold ${isServepoint ? 'text-[#1A1A1A]' : 'text-[#1C1917]'}`}>
                          {item.name}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize ${
                            isServepoint ? 'bg-[#D9E2DD] text-[#0F3D3E]' : 'bg-[#F5F0EB] text-[#57534E]'
                          }`}>
                            {item.role}
                          </span>
                        </td>
                        <td className={`px-4 py-3 ${isServepoint ? 'text-[#6B6B6B]' : 'font-mono text-[#57534E]'}`}>
                          ₹{item.hourlyRate}/hr
                        </td>
                        <td className={`px-4 py-3 ${isServepoint ? 'text-[#1A1A1A]' : 'font-mono text-[#1C1917]'}`}>
                          {item.shiftCount} shifts
                        </td>
                        <td className={`px-4 py-3 ${isServepoint ? 'text-[#6B6B6B]' : 'font-mono text-[#57534E]'}`}>
                          {item.regularHours.toFixed(2)} hrs
                        </td>
                        <td className="px-4 py-3">
                          {item.overtimeHours > 0 ? (
                            <span className={`font-bold ${isServepoint ? 'text-[#967221]' : 'font-mono text-[#B45309]'}`}>
                              +{item.overtimeHours.toFixed(2)} hrs
                            </span>
                          ) : (
                            <span className={isServepoint ? 'text-[#6B8579]' : 'font-mono text-[#A8A29E]'}>0.00 hrs</span>
                          )}
                        </td>
                        <td className={`px-4 py-3 font-bold ${isServepoint ? 'text-[#0F3D3E]' : 'font-mono text-[#1C1917]'}`}>
                          {item.totalHours.toFixed(2)} hrs
                        </td>
                        <td className={`px-4 py-3 font-bold text-base ${isServepoint ? 'text-[#0F3D3E]' : 'font-mono text-[#17803D]'}`}>
                          ₹{Math.round(item.grossPay).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#E8F5EC] text-[#17803D]">
                            Verified
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className={`border-t font-semibold text-xs ${
                    isServepoint ? 'bg-[#F6F5F2] border-[#E3E7E0]' : 'bg-[#FFF9F2] border-[#E9E0D6]'
                  }`}>
                    <tr>
                      <td colSpan={4} className={`px-4 py-3 ${isServepoint ? 'text-[#1A1A1A]' : 'text-[#1C1917]'}`}>
                        Grand Total:
                      </td>
                      <td className={`px-4 py-3 ${isServepoint ? 'text-[#6B6B6B]' : 'font-mono text-[#57534E]'}`}>
                        {(payrollSummary || []).reduce((acc, c) => acc + (c?.regularHours || 0), 0).toFixed(2)} hrs
                      </td>
                      <td className={`px-4 py-3 ${isServepoint ? 'text-[#967221]' : 'font-mono text-[#B45309]'}`}>
                        {(payrollSummary || []).reduce((acc, c) => acc + (c?.overtimeHours || 0), 0).toFixed(2)} hrs
                      </td>
                      <td className={`px-4 py-3 font-bold ${isServepoint ? 'text-[#0F3D3E]' : 'font-mono text-[#1C1917]'}`}>
                        {totalHoursWorked.toFixed(2)} hrs
                      </td>
                      <td className={`px-4 py-3 font-bold text-base ${isServepoint ? 'text-[#0F3D3E]' : 'font-mono text-[#17803D]'}`}>
                        ₹{Math.round(totalGrossPayroll).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={exportPayrollCSV}
                          className={`font-bold text-xs hover:underline ${
                            isServepoint ? 'text-[#B88E2F] hover:text-[#967221]' : 'text-[#F97316]'
                          }`}
                        >
                          Export CSV
                        </button>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ================= VIEW 3: STAFF DIRECTORY ================= */}
        {activeSubTab === 'staff' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className={`font-bold text-sm ${isServepoint ? 'text-[#1A1A1A]' : 'text-[#1C1917]'}`}>Staff Directory & Wage Setup</h3>
                <div className={`text-xs ${isServepoint ? 'text-[#6B6B6B]' : 'text-[#57534E]'}`}>Configure hourly pay rates, roles, and PIN codes for the clock-in terminal</div>
              </div>
              <button
                onClick={() => setIsAddStaffOpen(true)}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl transition-colors ${
                  isServepoint ? 'sp-cta' : 'bg-[#F97316] hover:bg-[#EA580C] text-white shadow-xs'
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Employee</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {staffMembers.map((staff) => {
                const isActiveOnFloor = activeShifts.some((s) => s.staff_id === staff.id);

                return (
                  <div
                    key={staff.id}
                    className={`bg-white rounded-2xl p-4 border shadow-xs flex flex-col justify-between ${
                      isServepoint ? 'border-[#E3E7E0]' : 'border-[#E9E0D6]'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-10 h-10 rounded-full font-bold text-sm flex items-center justify-center ${
                            isServepoint ? 'bg-[#D9E2DD] text-[#0F3D3E]' : 'bg-[#FFF1E6] text-[#F97316]'
                          }`}>
                            {staff.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <h4 className={`font-bold text-sm ${isServepoint ? 'text-[#1A1A1A]' : 'text-[#1C1917]'}`}>{staff.name}</h4>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                              isServepoint ? 'bg-[#F6F5F2] text-[#6B6B6B] border border-[#E3E7E0]' : 'bg-[#F5F0EB] text-[#57534E]'
                            }`}>
                              {staff.role}
                            </span>
                          </div>
                        </div>

                        {isActiveOnFloor ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#E8F5EC] text-[#17803D] flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#17803D] animate-ping" />
                            On Shift
                          </span>
                        ) : (
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                            isServepoint ? 'bg-white text-[#6B6B6B] border border-[#E3E7E0]' : 'bg-[#F5F0EB] text-[#A8A29E]'
                          }`}>
                            Off Shift
                          </span>
                        )}
                      </div>

                      <div className={`grid grid-cols-2 gap-2 my-3 p-2.5 rounded-xl border text-xs ${
                        isServepoint ? 'bg-[#F6F5F2] border-[#E3E7E0]' : 'bg-[#FFF9F2] border-[#E9E0D6]'
                      }`}>
                        <div>
                          <div className={`text-[10px] ${isServepoint ? 'text-[#6B8579]' : 'text-[#A8A29E]'}`}>Hourly Wage</div>
                          <div className={`font-bold ${isServepoint ? 'text-[#0F3D3E]' : 'font-mono text-[#1C1917]'}`}>₹{staff.hourly_rate}/hr</div>
                        </div>
                        <div>
                          <div className={`text-[10px] ${isServepoint ? 'text-[#6B8579]' : 'text-[#A8A29E]'}`}>Clock-in PIN</div>
                          <div className={isServepoint ? 'text-[#1A1A1A]' : 'font-mono text-[#57534E]'}>•••• ({staff.pin_code})</div>
                        </div>
                        <div>
                          <div className={`text-[10px] ${isServepoint ? 'text-[#6B8579]' : 'text-[#A8A29E]'}`}>Contact Phone</div>
                          <div className={`text-[11px] ${isServepoint ? 'text-[#6B6B6B]' : 'font-mono text-[#57534E]'}`}>{staff.phone}</div>
                        </div>
                        <div>
                          <div className={`text-[10px] ${isServepoint ? 'text-[#6B8579]' : 'text-[#A8A29E]'}`}>Joined Date</div>
                          <div className={`text-[11px] ${isServepoint ? 'text-[#6B6B6B]' : 'text-[#57534E]'}`}>{staff.joined_date}</div>
                        </div>
                      </div>
                    </div>

                    <div className={`pt-2 border-t flex items-center justify-between text-xs ${isServepoint ? 'border-[#E3E7E0]' : 'border-[#F5F0EB]'}`}>
                      <button
                        onClick={() => setEditingStaff(staff)}
                        className={`font-semibold flex items-center gap-1 hover:underline ${
                          isServepoint ? 'text-[#B88E2F] hover:text-[#967221]' : 'text-[#F97316]'
                        }`}
                      >
                        <Edit2 className="w-3 h-3" />
                        <span>Edit Wage & Info</span>
                      </button>

                      {isActiveOnFloor ? (
                        <button
                          onClick={() => {
                            const sh = activeShifts.find((s) => s.staff_id === staff.id);
                            if (sh) setClockOutTarget(sh);
                          }}
                          className="text-[#B42318] hover:underline font-semibold"
                        >
                          Clock Out
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            setSelectedClockInStaffId(staff.id);
                            setIsClockInOpen(true);
                          }}
                          className="text-[#17803D] hover:underline font-semibold"
                        >
                          Clock In
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ================= MODAL: CLOCK IN STAFF ================= */}
      {isClockInOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className={`bg-white rounded-2xl max-w-md w-full p-5 border shadow-xl animate-in fade-in zoom-in-95 duration-150 ${isServepoint ? 'border-[#E3E7E0]' : 'border-[#E9E0D6]'}`}>
            <div className={`flex items-center justify-between pb-3 border-b ${isServepoint ? 'border-[#E3E7E0]' : 'border-[#E9E0D6]'}`}>
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isServepoint ? 'sp-surface text-[#0F3D3E]' : 'bg-[#FFF1E6] text-[#F97316]'}`}>
                  <Play className="w-4 h-4" />
                </div>
                <h3 className={`font-bold text-sm ${isServepoint ? 'text-[#1A1A1A]' : 'text-[#1C1917]'}`}>Clock In Staff Member</h3>
              </div>
              <button
                onClick={() => setIsClockInOpen(false)}
                className={`text-sm ${isServepoint ? 'text-[#6B8579] hover:text-[#1A1A1A]' : 'text-[#A8A29E] hover:text-[#1C1917]'}`}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleClockInSubmit} className="space-y-4 pt-4 text-xs">
              <div>
                <label className={`block font-semibold mb-1 ${isServepoint ? 'text-[#1A1A1A]' : 'text-[#1C1917]'}`}>
                  Select Employee <span className="text-[#B42318]">*</span>
                </label>
                <select
                  value={selectedClockInStaffId}
                  onChange={(e) => setSelectedClockInStaffId(e.target.value)}
                  className={`w-full ${isServepoint ? 'bg-white border border-[#E3E7E0] rounded-xl px-3 py-2 text-[#1A1A1A] font-medium focus:border-[#B88E2F] focus:ring-1 focus:ring-[#B88E2F]/30 focus:outline-none' : 'bg-[#FFF9F2] border border-[#E9E0D6] rounded-xl px-3 py-2 text-[#1C1917] font-medium focus:outline-none focus:ring-2 focus:ring-[#F97316]'}`}
                  required
                >
                  <option value="">-- Choose Employee --</option>
                  {staffMembers.map((staff) => {
                    const isAlreadyClockedIn = activeShifts.some((s) => s.staff_id === staff.id);
                    return (
                      <option key={staff.id} value={staff.id} disabled={isAlreadyClockedIn}>
                        {staff.name} — {staff.role.toUpperCase()} (₹{staff.hourly_rate}/hr){' '}
                        {isAlreadyClockedIn ? '(Already on shift)' : ''}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label className={`block font-semibold mb-1 ${isServepoint ? 'text-[#1A1A1A]' : 'text-[#1C1917]'}`}>
                  Security PIN Code (optional verification)
                </label>
                <input
                  type="password"
                  maxLength={6}
                  placeholder="Enter 4-digit PIN (default: 1234 or staff PIN)"
                  value={clockInPin}
                  onChange={(e) => setClockInPin(e.target.value)}
                  className={`w-full ${isServepoint ? 'bg-white border border-[#E3E7E0] rounded-xl px-3 py-2 text-[#1A1A1A] focus:border-[#B88E2F] focus:ring-1 focus:ring-[#B88E2F]/30 focus:outline-none' : 'bg-[#FFF9F2] border border-[#E9E0D6] rounded-xl px-3 py-2 text-[#1C1917] font-mono focus:outline-none focus:ring-2 focus:ring-[#F97316]'}`}
                />
              </div>

              <div>
                <label className={`block font-semibold mb-1 ${isServepoint ? 'text-[#1A1A1A]' : 'text-[#1C1917]'}`}>
                  Shift Notes / Assigned Station (optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Espresso bar, cashier counter, pastry baking"
                  value={clockInNotes}
                  onChange={(e) => setClockInNotes(e.target.value)}
                  className={`w-full ${isServepoint ? 'bg-white border border-[#E3E7E0] rounded-xl px-3 py-2 text-[#1A1A1A] focus:border-[#B88E2F] focus:ring-1 focus:ring-[#B88E2F]/30 focus:outline-none' : 'bg-[#FFF9F2] border border-[#E9E0D6] rounded-xl px-3 py-2 text-[#1C1917] focus:outline-none focus:ring-2 focus:ring-[#F97316]'}`}
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsClockInOpen(false)}
                  className={isServepoint ? 'px-4 py-2 rounded-xl border border-[#E3E7E0] bg-white font-semibold text-[#6B6B6B] hover:bg-[#F6F5F2]' : 'px-4 py-2 rounded-xl border border-[#E9E0D6] font-semibold text-[#57534E] hover:bg-[#F5F0EB]'}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={isServepoint ? 'px-4 py-2 rounded-xl sp-cta text-xs' : 'px-4 py-2 rounded-xl bg-[#F97316] hover:bg-[#EA580C] text-white font-bold shadow-xs transition-colors'}
                >
                  Confirm Clock In
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: CLOCK OUT CONFIRMATION ================= */}
      {clockOutTarget && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className={`bg-white rounded-2xl max-w-md w-full p-5 border shadow-xl animate-in fade-in zoom-in-95 duration-150 ${isServepoint ? 'border-[#E3E7E0]' : 'border-[#E9E0D6]'}`}>
            <div className={`flex items-center justify-between pb-3 border-b ${isServepoint ? 'border-[#E3E7E0]' : 'border-[#E9E0D6]'}`}>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#FEF2F2] text-[#B42318] flex items-center justify-center">
                  <Square className="w-4 h-4 fill-current" />
                </div>
                <div>
                  <h3 className={`font-bold text-sm ${isServepoint ? 'text-[#1A1A1A]' : 'text-[#1C1917]'}`}>Clock Out {clockOutTarget.staff_name}</h3>
                  <div className="text-[11px] text-[#A8A29E] capitalize">{clockOutTarget.role} • ₹{clockOutTarget.hourly_rate}/hr</div>
                </div>
              </div>
              <button
                onClick={() => setClockOutTarget(null)}
                className={`text-sm ${isServepoint ? 'text-[#6B8579] hover:text-[#1A1A1A]' : 'text-[#A8A29E] hover:text-[#1C1917]'}`}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleClockOutSubmit} className="space-y-4 pt-4 text-xs">
              <div className={`p-3 rounded-xl border space-y-1 ${isServepoint ? 'bg-[#F6F5F2] border-[#E3E7E0]' : 'bg-[#FFF9F2] border-[#E9E0D6]'}`}>
                <div className="flex justify-between">
                  <span className={isServepoint ? 'text-[#6B6B6B]' : 'text-[#57534E]'}>Clock In Time:</span>
                  <span className={`font-bold ${isServepoint ? 'text-[#0F3D3E]' : 'font-mono text-[#1C1917]'}`}>{formatTime(clockOutTarget.clock_in)}</span>
                </div>
                <div className="flex justify-between">
                  <span className={isServepoint ? 'text-[#6B6B6B]' : 'text-[#57534E]'}>Current Clock Out:</span>
                  <span className={`font-bold ${isServepoint ? 'text-[#0F3D3E]' : 'font-mono text-[#1C1917]'}`}>{formatTime(new Date().toISOString())}</span>
                </div>
                <div className={`flex justify-between text-[#17803D] pt-1 border-t ${isServepoint ? 'border-[#E3E7E0]' : 'border-[#E9E0D6]'}`}>
                  <span>Estimated Shift Net Hours:</span>
                  <span className="font-bold">
                    {getLiveDuration(clockOutTarget.clock_in, clockOutBreaks).netHours.toFixed(2)} hrs
                  </span>
                </div>
              </div>

              <div>
                <label className={`block font-semibold mb-1 ${isServepoint ? 'text-[#1A1A1A]' : 'text-[#1C1917]'}`}>
                  Total Break Minutes (unpaid / deducted)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    max={240}
                    value={clockOutBreaks}
                    onChange={(e) => setClockOutBreaks(Number(e.target.value))}
                    className={`flex-1 ${isServepoint ? 'bg-white border border-[#E3E7E0] rounded-xl px-3 py-2 text-[#1A1A1A] focus:border-[#B88E2F] focus:ring-1 focus:ring-[#B88E2F]/30 focus:outline-none' : 'bg-[#FFF9F2] border border-[#E9E0D6] rounded-xl px-3 py-2 text-[#1C1917] font-mono focus:outline-none focus:ring-2 focus:ring-[#F97316]'}`}
                  />
                  <span className={`text-xs ${isServepoint ? 'text-[#6B6B6B]' : 'text-[#57534E]'}`}>minutes</span>
                </div>
              </div>

              <div>
                <label className={`block font-semibold mb-1 ${isServepoint ? 'text-[#1A1A1A]' : 'text-[#1C1917]'}`}>
                  Closing Notes (optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Completed till handover, clean bar counter"
                  value={clockOutNotes}
                  onChange={(e) => setClockOutNotes(e.target.value)}
                  className={`w-full ${isServepoint ? 'bg-white border border-[#E3E7E0] rounded-xl px-3 py-2 text-[#1A1A1A] focus:border-[#B88E2F] focus:ring-1 focus:ring-[#B88E2F]/30 focus:outline-none' : 'bg-[#FFF9F2] border border-[#E9E0D6] rounded-xl px-3 py-2 text-[#1C1917] focus:outline-none focus:ring-2 focus:ring-[#F97316]'}`}
                />
              </div>

              {/* End of shift reconciliation trigger */}
              <div className={`p-3 border rounded-xl flex items-center justify-between gap-2 ${
                isServepoint ? 'bg-[#F6F5F2] border-[#E3E7E0]' : 'bg-[#FFF9F2] border-[#FED7AA]'
              }`}>
                <div className="flex items-center gap-2">
                  <Calculator className={`w-4 h-4 shrink-0 ${isServepoint ? 'text-[#0F3D3E]' : 'text-[#B45309]'}`} />
                  <div>
                    <div className={`font-bold text-xs ${isServepoint ? 'text-[#1A1A1A]' : 'text-[#1C1917]'}`}>Audit Cash Drawer First</div>
                    <div className={`text-[10px] ${isServepoint ? 'text-[#6B6B6B]' : 'text-[#57534E]'}`}>Count denominations and verify against system sales</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const target = clockOutTarget;
                    setClockOutTarget(null);
                    setReconcilingShift(target);
                  }}
                  className={`px-2.5 py-1.5 rounded-lg font-bold text-xs border transition-colors ${
                    isServepoint
                      ? 'bg-white hover:bg-[#F6F5F2] text-[#0F3D3E] border-[#E3E7E0]'
                      : 'bg-[#FFF1E6] hover:bg-[#FED7AA] text-[#B45309] border-[#FED7AA]'
                  }`}
                >
                  Count Till Now
                </button>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setClockOutTarget(null)}
                  className={isServepoint ? 'px-4 py-2 rounded-xl border border-[#E3E7E0] bg-white font-semibold text-[#6B6B6B] hover:bg-[#F6F5F2]' : 'px-4 py-2 rounded-xl border border-[#E9E0D6] font-semibold text-[#57534E] hover:bg-[#F5F0EB]'}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#B42318] hover:bg-[#91180F] text-white font-bold shadow-xs transition-colors"
                >
                  Confirm Clock Out & Calculate Pay
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: MANUAL SHIFT LOG ================= */}
      {isManualShiftOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className={`bg-white rounded-2xl max-w-md w-full p-5 border shadow-xl animate-in fade-in zoom-in-95 duration-150 ${isServepoint ? 'border-[#E3E7E0]' : 'border-[#E9E0D6]'}`}>
            <div className={`flex items-center justify-between pb-3 border-b ${isServepoint ? 'border-[#E3E7E0]' : 'border-[#E9E0D6]'}`}>
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isServepoint ? 'sp-surface text-[#0F3D3E]' : 'bg-[#EFF6FF] text-[#2563EB]'}`}>
                  <FileText className="w-4 h-4" />
                </div>
                <h3 className={`font-bold text-sm ${isServepoint ? 'text-[#1A1A1A]' : 'text-[#1C1917]'}`}>Log Past or Manual Shift</h3>
              </div>
              <button
                onClick={() => setIsManualShiftOpen(false)}
                className={`text-sm ${isServepoint ? 'text-[#6B8579] hover:text-[#1A1A1A]' : 'text-[#A8A29E] hover:text-[#1C1917]'}`}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleManualShiftSubmit} className="space-y-3 pt-4 text-xs">
              <div>
                <label className={`block font-semibold mb-1 ${isServepoint ? 'text-[#1A1A1A]' : 'text-[#1C1917]'}`}>
                  Employee <span className="text-[#B42318]">*</span>
                </label>
                <select
                  value={manualStaffId}
                  onChange={(e) => setManualStaffId(e.target.value)}
                  className={`w-full ${isServepoint ? 'bg-white border border-[#E3E7E0] rounded-xl px-3 py-2 text-[#1A1A1A] font-medium focus:border-[#B88E2F] focus:ring-1 focus:ring-[#B88E2F]/30 focus:outline-none' : 'bg-[#FFF9F2] border border-[#E9E0D6] rounded-xl px-3 py-2 text-[#1C1917] font-medium focus:outline-none focus:ring-2 focus:ring-[#F97316]'}`}
                  required
                >
                  <option value="">-- Choose Employee --</option>
                  {staffMembers.map((staff) => (
                    <option key={staff.id} value={staff.id}>
                      {staff.name} ({staff.role}) — ₹{staff.hourly_rate}/hr
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={`block font-semibold mb-1 ${isServepoint ? 'text-[#1A1A1A]' : 'text-[#1C1917]'}`}>
                    Clock In <span className="text-[#B42318]">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={manualClockIn}
                    onChange={(e) => setManualClockIn(e.target.value)}
                    className={`w-full ${isServepoint ? 'bg-white border border-[#E3E7E0] rounded-xl px-2.5 py-2 text-[#1A1A1A] focus:border-[#B88E2F] focus:ring-1 focus:ring-[#B88E2F]/30 focus:outline-none' : 'bg-[#FFF9F2] border border-[#E9E0D6] rounded-xl px-2.5 py-2 text-[#1C1917] focus:outline-none focus:ring-2 focus:ring-[#F97316]'}`}
                    required
                  />
                </div>
                <div>
                  <label className={`block font-semibold mb-1 ${isServepoint ? 'text-[#1A1A1A]' : 'text-[#1C1917]'}`}>
                    Clock Out <span className="text-[#B42318]">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={manualClockOut}
                    onChange={(e) => setManualClockOut(e.target.value)}
                    className={`w-full ${isServepoint ? 'bg-white border border-[#E3E7E0] rounded-xl px-2.5 py-2 text-[#1A1A1A] focus:border-[#B88E2F] focus:ring-1 focus:ring-[#B88E2F]/30 focus:outline-none' : 'bg-[#FFF9F2] border border-[#E9E0D6] rounded-xl px-2.5 py-2 text-[#1C1917] focus:outline-none focus:ring-2 focus:ring-[#F97316]'}`}
                    required
                  />
                </div>
              </div>

              <div>
                <label className={`block font-semibold mb-1 ${isServepoint ? 'text-[#1A1A1A]' : 'text-[#1C1917]'}`}>
                  Break Duration (minutes)
                </label>
                <input
                  type="number"
                  min={0}
                  max={180}
                  value={manualBreaks}
                  onChange={(e) => setManualBreaks(Number(e.target.value))}
                  className={`w-full ${isServepoint ? 'bg-white border border-[#E3E7E0] rounded-xl px-3 py-2 text-[#1A1A1A] focus:border-[#B88E2F] focus:ring-1 focus:ring-[#B88E2F]/30 focus:outline-none' : 'bg-[#FFF9F2] border border-[#E9E0D6] rounded-xl px-3 py-2 text-[#1C1917] font-mono focus:outline-none focus:ring-2 focus:ring-[#F97316]'}`}
                />
              </div>

              <div>
                <label className={`block font-semibold mb-1 ${isServepoint ? 'text-[#1A1A1A]' : 'text-[#1C1917]'}`}>
                  Shift Notes / Adjustment Reason
                </label>
                <input
                  type="text"
                  placeholder="e.g. Forgot to clock out on POS terminal"
                  value={manualNotes}
                  onChange={(e) => setManualNotes(e.target.value)}
                  className={`w-full ${isServepoint ? 'bg-white border border-[#E3E7E0] rounded-xl px-3 py-2 text-[#1A1A1A] focus:border-[#B88E2F] focus:ring-1 focus:ring-[#B88E2F]/30 focus:outline-none' : 'bg-[#FFF9F2] border border-[#E9E0D6] rounded-xl px-3 py-2 text-[#1C1917] focus:outline-none focus:ring-2 focus:ring-[#F97316]'}`}
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsManualShiftOpen(false)}
                  className={isServepoint ? 'px-4 py-2 rounded-xl border border-[#E3E7E0] bg-white font-semibold text-[#6B6B6B] hover:bg-[#F6F5F2]' : 'px-4 py-2 rounded-xl border border-[#E9E0D6] font-semibold text-[#57534E] hover:bg-[#F5F0EB]'}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={isServepoint ? 'px-4 py-2 rounded-xl sp-cta text-xs' : 'px-4 py-2 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold shadow-xs transition-colors'}
                >
                  Save Shift Log
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: ADD STAFF MEMBER ================= */}
      {isAddStaffOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className={`bg-white rounded-2xl max-w-md w-full p-5 border shadow-xl animate-in fade-in zoom-in-95 duration-150 ${isServepoint ? 'border-[#E3E7E0]' : 'border-[#E9E0D6]'}`}>
            <div className={`flex items-center justify-between pb-3 border-b ${isServepoint ? 'border-[#E3E7E0]' : 'border-[#E9E0D6]'}`}>
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isServepoint ? 'sp-surface text-[#0F3D3E]' : 'bg-[#FFF1E6] text-[#F97316]'}`}>
                  <Users className="w-4 h-4" />
                </div>
                <h3 className={`font-bold text-sm ${isServepoint ? 'text-[#1A1A1A]' : 'text-[#1C1917]'}`}>Add Cafe Staff Member</h3>
              </div>
              <button
                onClick={() => setIsAddStaffOpen(false)}
                className={`text-sm ${isServepoint ? 'text-[#6B8579] hover:text-[#1A1A1A]' : 'text-[#A8A29E] hover:text-[#1C1917]'}`}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddStaffSubmit} className="space-y-3 pt-4 text-xs">
              <div>
                <label className={`block font-semibold mb-1 ${isServepoint ? 'text-[#1A1A1A]' : 'text-[#1C1917]'}`}>
                  Full Name <span className="text-[#B42318]">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Ramesh Chandra"
                  value={newStaffName}
                  onChange={(e) => setNewStaffName(e.target.value)}
                  className={`w-full ${isServepoint ? 'bg-white border border-[#E3E7E0] rounded-xl px-3 py-2 text-[#1A1A1A] focus:border-[#B88E2F] focus:ring-1 focus:ring-[#B88E2F]/30 focus:outline-none' : 'bg-[#FFF9F2] border border-[#E9E0D6] rounded-xl px-3 py-2 text-[#1C1917] focus:outline-none focus:ring-2 focus:ring-[#F97316]'}`}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={`block font-semibold mb-1 ${isServepoint ? 'text-[#1A1A1A]' : 'text-[#1C1917]'}`}>
                    Role <span className="text-[#B42318]">*</span>
                  </label>
                  <select
                    value={newStaffRole}
                    onChange={(e) => setNewStaffRole(e.target.value as StaffRole)}
                    className={`w-full ${isServepoint ? 'bg-white border border-[#E3E7E0] rounded-xl px-3 py-2 text-[#1A1A1A] font-medium focus:border-[#B88E2F] focus:ring-1 focus:ring-[#B88E2F]/30 focus:outline-none' : 'bg-[#FFF9F2] border border-[#E9E0D6] rounded-xl px-3 py-2 text-[#1C1917] font-medium focus:outline-none focus:ring-2 focus:ring-[#F97316]'}`}
                  >
                    <option value="barista">Barista</option>
                    <option value="cashier">Cashier</option>
                    <option value="chef">Chef</option>
                    <option value="server">Server</option>
                    <option value="manager">Floor Manager</option>
                    <option value="cleaner">Cleaner / Helper</option>
                  </select>
                </div>

                <div>
                  <label className={`block font-semibold mb-1 ${isServepoint ? 'text-[#1A1A1A]' : 'text-[#1C1917]'}`}>
                    Hourly Wage (₹) <span className="text-[#B42318]">*</span>
                  </label>
                  <input
                    type="number"
                    min={50}
                    max={2000}
                    value={newStaffRate}
                    onChange={(e) => setNewStaffRate(Number(e.target.value))}
                    className={`w-full ${isServepoint ? 'bg-white border border-[#E3E7E0] rounded-xl px-3 py-2 text-[#1A1A1A] focus:border-[#B88E2F] focus:ring-1 focus:ring-[#B88E2F]/30 focus:outline-none' : 'bg-[#FFF9F2] border border-[#E9E0D6] rounded-xl px-3 py-2 text-[#1C1917] font-mono focus:outline-none focus:ring-2 focus:ring-[#F97316]'}`}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={`block font-semibold mb-1 ${isServepoint ? 'text-[#1A1A1A]' : 'text-[#1C1917]'}`}>
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    placeholder="+91 98XXX XXXXX"
                    value={newStaffPhone}
                    onChange={(e) => setNewStaffPhone(e.target.value)}
                    className={`w-full ${isServepoint ? 'bg-white border border-[#E3E7E0] rounded-xl px-3 py-2 text-[#1A1A1A] focus:border-[#B88E2F] focus:ring-1 focus:ring-[#B88E2F]/30 focus:outline-none' : 'bg-[#FFF9F2] border border-[#E9E0D6] rounded-xl px-3 py-2 text-[#1C1917] focus:outline-none focus:ring-2 focus:ring-[#F97316]'}`}
                  />
                </div>

                <div>
                  <label className={`block font-semibold mb-1 ${isServepoint ? 'text-[#1A1A1A]' : 'text-[#1C1917]'}`}>
                    Clock-in PIN
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    placeholder="4 digits (e.g. 2345)"
                    value={newStaffPin}
                    onChange={(e) => setNewStaffPin(e.target.value)}
                    className={`w-full ${isServepoint ? 'bg-white border border-[#E3E7E0] rounded-xl px-3 py-2 text-[#1A1A1A] focus:border-[#B88E2F] focus:ring-1 focus:ring-[#B88E2F]/30 focus:outline-none' : 'bg-[#FFF9F2] border border-[#E9E0D6] rounded-xl px-3 py-2 text-[#1C1917] font-mono focus:outline-none focus:ring-2 focus:ring-[#F97316]'}`}
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddStaffOpen(false)}
                  className={isServepoint ? 'px-4 py-2 rounded-xl border border-[#E3E7E0] bg-white font-semibold text-[#6B6B6B] hover:bg-[#F6F5F2]' : 'px-4 py-2 rounded-xl border border-[#E9E0D6] font-semibold text-[#57534E] hover:bg-[#F5F0EB]'}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={isServepoint ? 'px-4 py-2 rounded-xl sp-cta text-xs' : 'px-4 py-2 rounded-xl bg-[#F97316] hover:bg-[#EA580C] text-white font-bold shadow-xs transition-colors'}
                >
                  Add Staff Member
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: EDIT SHIFT ================= */}
      {editingShift && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className={`bg-white rounded-2xl max-w-md w-full p-5 border shadow-xl animate-in fade-in zoom-in-95 duration-150 ${isServepoint ? 'border-[#E3E7E0]' : 'border-[#E9E0D6]'}`}>
            <div className={`flex items-center justify-between pb-3 border-b ${isServepoint ? 'border-[#E3E7E0]' : 'border-[#E9E0D6]'}`}>
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isServepoint ? 'sp-surface text-[#0F3D3E]' : 'bg-[#FFF1E6] text-[#F97316]'}`}>
                  <Edit2 className="w-4 h-4" />
                </div>
                <h3 className={`font-bold text-sm ${isServepoint ? 'text-[#1A1A1A]' : 'text-[#1C1917]'}`}>Edit Shift Record</h3>
              </div>
              <button
                onClick={() => setEditingShift(null)}
                className={`text-sm ${isServepoint ? 'text-[#6B8579] hover:text-[#1A1A1A]' : 'text-[#A8A29E] hover:text-[#1C1917]'}`}
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 pt-4 text-xs">
              <div className={`text-sm font-bold ${isServepoint ? 'text-[#1A1A1A]' : 'text-[#1C1917]'}`}>
                {editingShift.staff_name}{' '}
                <span className={`text-xs font-normal capitalize ${isServepoint ? 'text-[#6B8579]' : 'text-[#A8A29E]'}`}>
                  ({editingShift.role})
                </span>
              </div>

              <div>
                <label className={`block font-semibold mb-1 ${isServepoint ? 'text-[#1A1A1A]' : 'text-[#1C1917]'}`}>
                  Break Duration (minutes)
                </label>
                <input
                  type="number"
                  min={0}
                  max={240}
                  value={editingShift.break_minutes}
                  onChange={(e) =>
                    setEditingShift({
                      ...editingShift,
                      break_minutes: Number(e.target.value),
                    })
                  }
                  className={`w-full ${isServepoint ? 'bg-white border border-[#E3E7E0] rounded-xl px-3 py-2 text-[#1A1A1A] focus:border-[#B88E2F] focus:ring-1 focus:ring-[#B88E2F]/30 focus:outline-none' : 'bg-[#FFF9F2] border border-[#E9E0D6] rounded-xl px-3 py-2 text-[#1C1917] font-mono focus:outline-none focus:ring-2 focus:ring-[#F97316]'}`}
                />
              </div>

              <div>
                <label className={`block font-semibold mb-1 ${isServepoint ? 'text-[#1A1A1A]' : 'text-[#1C1917]'}`}>
                  Hourly Rate for Shift (₹)
                </label>
                <input
                  type="number"
                  value={editingShift.hourly_rate}
                  onChange={(e) =>
                    setEditingShift({
                      ...editingShift,
                      hourly_rate: Number(e.target.value),
                    })
                  }
                  className={`w-full ${isServepoint ? 'bg-white border border-[#E3E7E0] rounded-xl px-3 py-2 text-[#1A1A1A] focus:border-[#B88E2F] focus:ring-1 focus:ring-[#B88E2F]/30 focus:outline-none' : 'bg-[#FFF9F2] border border-[#E9E0D6] rounded-xl px-3 py-2 text-[#1C1917] font-mono focus:outline-none focus:ring-2 focus:ring-[#F97316]'}`}
                />
              </div>

              <div>
                <label className={`block font-semibold mb-1 ${isServepoint ? 'text-[#1A1A1A]' : 'text-[#1C1917]'}`}>
                  Shift Notes
                </label>
                <input
                  type="text"
                  value={editingShift.notes || ''}
                  onChange={(e) =>
                    setEditingShift({
                      ...editingShift,
                      notes: e.target.value,
                    })
                  }
                  className={`w-full ${isServepoint ? 'bg-white border border-[#E3E7E0] rounded-xl px-3 py-2 text-[#1A1A1A] focus:border-[#B88E2F] focus:ring-1 focus:ring-[#B88E2F]/30 focus:outline-none' : 'bg-[#FFF9F2] border border-[#E9E0D6] rounded-xl px-3 py-2 text-[#1C1917] focus:outline-none focus:ring-2 focus:ring-[#F97316]'}`}
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingShift(null)}
                  className={isServepoint ? 'px-4 py-2 rounded-xl border border-[#E3E7E0] bg-white font-semibold text-[#6B6B6B] hover:bg-[#F6F5F2]' : 'px-4 py-2 rounded-xl border border-[#E9E0D6] font-semibold text-[#57534E] hover:bg-[#F5F0EB]'}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    updateShift(editingShift.id, {
                      break_minutes: editingShift.break_minutes,
                      hourly_rate: editingShift.hourly_rate,
                      notes: editingShift.notes,
                    });
                    showNotification('success', 'Shift updated successfully');
                    setEditingShift(null);
                  }}
                  className={isServepoint ? 'px-4 py-2 rounded-xl sp-cta text-xs' : 'px-4 py-2 rounded-xl bg-[#F97316] hover:bg-[#EA580C] text-white font-bold shadow-xs transition-colors'}
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: EDIT STAFF INFO & WAGE ================= */}
      {editingStaff && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className={`bg-white rounded-2xl max-w-md w-full p-5 border shadow-xl animate-in fade-in zoom-in-95 duration-150 ${isServepoint ? 'border-[#E3E7E0]' : 'border-[#E9E0D6]'}`}>
            <div className={`flex items-center justify-between pb-3 border-b ${isServepoint ? 'border-[#E3E7E0]' : 'border-[#E9E0D6]'}`}>
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isServepoint ? 'sp-surface text-[#0F3D3E]' : 'bg-[#FFF1E6] text-[#F97316]'}`}>
                  <Users className="w-4 h-4" />
                </div>
                <h3 className={`font-bold text-sm ${isServepoint ? 'text-[#1A1A1A]' : 'text-[#1C1917]'}`}>Edit {editingStaff.name}</h3>
              </div>
              <button
                onClick={() => setEditingStaff(null)}
                className={`text-sm ${isServepoint ? 'text-[#6B8579] hover:text-[#1A1A1A]' : 'text-[#A8A29E] hover:text-[#1C1917]'}`}
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 pt-4 text-xs">
              <div>
                <label className={`block font-semibold mb-1 ${isServepoint ? 'text-[#1A1A1A]' : 'text-[#1C1917]'}`}>
                  Hourly Rate (₹/hr)
                </label>
                <input
                  type="number"
                  min={50}
                  max={2000}
                  value={editingStaff.hourly_rate}
                  onChange={(e) =>
                    setEditingStaff({
                      ...editingStaff,
                      hourly_rate: Number(e.target.value),
                    })
                  }
                  className={`w-full ${isServepoint ? 'bg-white border border-[#E3E7E0] rounded-xl px-3 py-2 text-[#1A1A1A] focus:border-[#B88E2F] focus:ring-1 focus:ring-[#B88E2F]/30 focus:outline-none' : 'bg-[#FFF9F2] border border-[#E9E0D6] rounded-xl px-3 py-2 text-[#1C1917] font-mono focus:outline-none focus:ring-2 focus:ring-[#F97316]'}`}
                />
              </div>

              <div>
                <label className={`block font-semibold mb-1 ${isServepoint ? 'text-[#1A1A1A]' : 'text-[#1C1917]'}`}>
                  Terminal PIN Code
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={editingStaff.pin_code}
                  onChange={(e) =>
                    setEditingStaff({
                      ...editingStaff,
                      pin_code: e.target.value,
                    })
                  }
                  className={`w-full ${isServepoint ? 'bg-white border border-[#E3E7E0] rounded-xl px-3 py-2 text-[#1A1A1A] focus:border-[#B88E2F] focus:ring-1 focus:ring-[#B88E2F]/30 focus:outline-none' : 'bg-[#FFF9F2] border border-[#E9E0D6] rounded-xl px-3 py-2 text-[#1C1917] font-mono focus:outline-none focus:ring-2 focus:ring-[#F97316]'}`}
                />
              </div>

              <div>
                <label className={`block font-semibold mb-1 ${isServepoint ? 'text-[#1A1A1A]' : 'text-[#1C1917]'}`}>
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={editingStaff.phone}
                  onChange={(e) =>
                    setEditingStaff({
                      ...editingStaff,
                      phone: e.target.value,
                    })
                  }
                  className={`w-full ${isServepoint ? 'bg-white border border-[#E3E7E0] rounded-xl px-3 py-2 text-[#1A1A1A] focus:border-[#B88E2F] focus:ring-1 focus:ring-[#B88E2F]/30 focus:outline-none' : 'bg-[#FFF9F2] border border-[#E9E0D6] rounded-xl px-3 py-2 text-[#1C1917] focus:outline-none focus:ring-2 focus:ring-[#F97316]'}`}
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingStaff(null)}
                  className={isServepoint ? 'px-4 py-2 rounded-xl border border-[#E3E7E0] bg-white font-semibold text-[#6B6B6B] hover:bg-[#F6F5F2]' : 'px-4 py-2 rounded-xl border border-[#E9E0D6] font-semibold text-[#57534E] hover:bg-[#F5F0EB]'}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    updateStaffMember(editingStaff);
                    showNotification('success', `Updated wage and profile for ${editingStaff.name}`);
                    setEditingStaff(null);
                  }}
                  className={isServepoint ? 'px-4 py-2 rounded-xl sp-cta text-xs' : 'px-4 py-2 rounded-xl bg-[#F97316] hover:bg-[#EA580C] text-white font-bold shadow-xs transition-colors'}
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: DRAWER RECONCILIATION ================= */}
      {reconcilingShift && (
        <DrawerReconciliationModal
          shift={reconcilingShift}
          onClose={() => setReconcilingShift(null)}
          onSaveAndClockOut={(reconciliation) => {
            const res = clockOutStaff(
              reconcilingShift.id,
              reconcilingShift.break_minutes || 0,
              reconciliation.notes,
              reconciliation
            );
            if (res.success) {
              showNotification(
                'success',
                `${res.message} • Drawer verified (${reconciliation.status.toUpperCase()} ${
                  reconciliation.variance !== 0 ? `₹${reconciliation.variance}` : 'Balanced'
                })`
              );
            }
            setReconcilingShift(null);
          }}
        />
      )}

      {/* ================= MODAL: FAST PIN PAD CLOCK IN ================= */}
      <StaffPinPadModal
        isOpen={isFastPinOpen}
        onClose={() => setIsFastPinOpen(false)}
        onSuccess={handleFastPinClockIn}
        title="Staff 4-Digit Shift Clock In"
      />
    </div>
  );
};
