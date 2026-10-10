import React, { useState, useMemo } from 'react';
import { useTsosStore } from '../../lib/store';
import { PrintLogEntry, Order } from '../../types';
import {
  Printer,
  Bluetooth,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Search,
  Filter,
  Trash2,
  RotateCcw,
  FileText,
  Wifi,
  Monitor,
  Info,
  Radio,
  Clock,
  HelpCircle,
  Activity,
  HardDrive,
  Cpu,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface PrintLogsSectionProps {
  onOpenManualPrint: (order?: Order) => void;
}

export const PrintLogsSection: React.FC<PrintLogsSectionProps> = ({ onOpenManualPrint }) => {
  const { printLogs, clearPrintLogs, orders } = useTsosStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'failed'>('all');
  const [docTypeFilter, setDocTypeFilter] = useState<'all' | 'bill' | 'kot' | 'test' | 'drawer_kick'>('all');
  const [interfaceFilter, setInterfaceFilter] = useState<'all' | 'bluetooth' | 'browser' | 'network' | 'usb'>('all');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [showTroubleshooter, setShowTroubleshooter] = useState(false);

  const safeLogs = useMemo(() => printLogs || [], [printLogs]);

  // Statistics calculation
  const stats = useMemo(() => {
    const total = safeLogs.length;
    const successful = safeLogs.filter((l) => l.status === 'success').length;
    const failed = safeLogs.filter((l) => l.status === 'failed').length;
    const successRate = total > 0 ? Math.round((successful / total) * 100) : 100;
    const bluetoothJobs = safeLogs.filter((l) => l.interface_type === 'bluetooth').length;
    return { total, successful, failed, successRate, bluetoothJobs };
  }, [safeLogs]);

  // Filtering
  const filteredLogs = useMemo(() => {
    return safeLogs.filter((log) => {
      // Status filter
      if (statusFilter !== 'all' && log.status !== statusFilter) return false;
      // Document type filter
      if (docTypeFilter !== 'all' && log.document_type !== docTypeFilter) return false;
      // Interface filter
      if (interfaceFilter !== 'all' && log.interface_type !== interfaceFilter) return false;
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesOrder = log.order_number?.toString().includes(q) || false;
        const matchesPrinter = log.printer_name.toLowerCase().includes(q);
        const matchesError = log.error_message?.toLowerCase().includes(q) || false;
        const matchesOperator = log.operator_name?.toLowerCase().includes(q) || false;
        const matchesDocType = log.document_type.toLowerCase().includes(q);
        return matchesOrder || matchesPrinter || matchesError || matchesOperator || matchesDocType;
      }
      return true;
    });
  }, [safeLogs, statusFilter, docTypeFilter, interfaceFilter, searchQuery]);

  const formatTimestamp = (iso: string) => {
    try {
      const date = new Date(iso);
      return {
        time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        date: date.toLocaleDateString([], { month: 'short', day: 'numeric' }),
      };
    } catch {
      return { time: iso, date: '' };
    }
  };

  const getInterfaceIcon = (type: string) => {
    switch (type) {
      case 'bluetooth':
        return <Bluetooth className="w-3.5 h-3.5 text-blue-600" />;
      case 'network':
        return <Wifi className="w-3.5 h-3.5 text-purple-600" />;
      case 'browser':
        return <Monitor className="w-3.5 h-3.5 text-amber-600" />;
      default:
        return <HardDrive className="w-3.5 h-3.5 text-stone-600" />;
    }
  };

  const getDocTypeBadge = (type: string) => {
    switch (type) {
      case 'bill':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-50 text-amber-900 border border-amber-200">
            <FileText className="w-3 h-3 text-amber-700" />
            Customer Bill
          </span>
        );
      case 'kot':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-blue-50 text-blue-900 border border-blue-200">
            <Radio className="w-3 h-3 text-blue-700" />
            Kitchen KOT
          </span>
        );
      case 'test':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-stone-100 text-stone-800 border border-stone-300">
            <Cpu className="w-3 h-3 text-stone-600" />
            Self-Test Roll
          </span>
        );
      case 'drawer_kick':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-900 border border-emerald-200">
            <Activity className="w-3 h-3 text-emerald-700" />
            Cash Solenoid Kick
          </span>
        );
      default:
        return <span className="text-xs capitalize">{type}</span>;
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#FFF9F2]">
      {/* Top Diagnostics KPI Cards */}
      <div className="p-4 bg-white border-b border-[#E9E0D6] space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-stone-900 text-white flex items-center justify-center shadow-xs">
              <Printer className="w-5 h-5 text-[#F97316]" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#1C1917] flex items-center gap-2">
                <span>POS & Kitchen Thermal Print Audit Logs</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-bold border border-blue-200">
                  Real-time Tracking
                </span>
              </h2>
              <p className="text-xs text-[#57534E]">
                Diagnostic audit trail tracking hardware transmissions, GATT bluetooth chunks, and printer exceptions.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowTroubleshooter(!showTroubleshooter)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
                showTroubleshooter
                  ? 'bg-[#1C1917] text-white border-[#1C1917]'
                  : 'bg-white text-[#57534E] border-[#E9E0D6] hover:bg-[#F5F0EB]'
              }`}
            >
              <HelpCircle className="w-3.5 h-3.5 text-[#F97316]" />
              <span>Hardware Guide</span>
            </button>

            <button
              onClick={() => onOpenManualPrint()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F97316] hover:bg-[#EA580C] text-white text-xs font-semibold transition-all shadow-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Open Print Workstation</span>
            </button>

            {safeLogs.length > 0 && (
              <button
                onClick={() => {
                  if (confirm('Clear all local thermal printer logs?')) {
                    clearPrintLogs();
                  }
                }}
                className="p-1.5 rounded-xl border border-[#E9E0D6] bg-white hover:bg-rose-50 hover:text-rose-600 text-[#57534E] transition-colors"
                title="Clear Print Log History"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-[#FFF9F2] p-3 rounded-2xl border border-[#E9E0D6]">
            <div className="text-[11px] text-[#57534E] font-medium flex items-center justify-between">
              <span>Total Print Jobs</span>
              <Activity className="w-3.5 h-3.5 text-[#A8A29E]" />
            </div>
            <div className="text-xl font-bold font-mono text-[#1C1917] mt-1">
              {stats.total}
            </div>
            <div className="text-[10px] text-[#78716C] mt-0.5">
              Across all POS & kitchen rolls
            </div>
          </div>

          <div className="bg-emerald-50/50 p-3 rounded-2xl border border-emerald-200">
            <div className="text-[11px] text-emerald-800 font-medium flex items-center justify-between">
              <span>Successful Transmissions</span>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            </div>
            <div className="text-xl font-bold font-mono text-emerald-900 mt-1">
              {stats.successful}
              <span className="text-xs font-normal text-emerald-700 ml-1.5 font-sans">
                ({stats.successRate}%)
              </span>
            </div>
            <div className="text-[10px] text-emerald-700 mt-0.5">
              Acknowledged by print head
            </div>
          </div>

          <div
            className={`p-3 rounded-2xl border ${
              stats.failed > 0
                ? 'bg-rose-50/60 border-rose-200 text-rose-900'
                : 'bg-stone-50 border-[#E9E0D6] text-[#57534E]'
            }`}
          >
            <div className="text-[11px] font-medium flex items-center justify-between">
              <span className={stats.failed > 0 ? 'text-rose-800 font-bold' : 'text-[#57534E]'}>
                Hardware Failures / Errors
              </span>
              <AlertTriangle
                className={`w-3.5 h-3.5 ${stats.failed > 0 ? 'text-rose-600' : 'text-[#A8A29E]'}`}
              />
            </div>
            <div
              className={`text-xl font-bold font-mono mt-1 ${
                stats.failed > 0 ? 'text-rose-900' : 'text-[#1C1917]'
              }`}
            >
              {stats.failed}
            </div>
            <div className={`text-[10px] mt-0.5 ${stats.failed > 0 ? 'text-rose-700' : 'text-[#78716C]'}`}>
              {stats.failed > 0 ? 'Requires operator review' : 'No errors recorded'}
            </div>
          </div>

          <div className="bg-blue-50/50 p-3 rounded-2xl border border-blue-200">
            <div className="text-[11px] text-blue-800 font-medium flex items-center justify-between">
              <span>Web Bluetooth Devices</span>
              <Bluetooth className="w-3.5 h-3.5 text-blue-600" />
            </div>
            <div className="text-xl font-bold font-mono text-blue-900 mt-1">
              {stats.bluetoothJobs}
            </div>
            <div className="text-[10px] text-blue-700 mt-0.5">
              GATT BLE ESC/POS stream
            </div>
          </div>
        </div>

        {/* Expandable Hardware Troubleshooting Guide */}
        {showTroubleshooter && (
          <div className="bg-[#1C1917] text-white p-4 rounded-2xl border border-stone-700 animate-in fade-in duration-150 text-xs">
            <div className="flex items-center justify-between mb-3 border-b border-stone-800 pb-2">
              <div className="font-bold text-sm text-[#F97316] flex items-center gap-2">
                <Info className="w-4 h-4" />
                <span>Thermal Printer Troubleshooting & Error Codes Matrix</span>
              </div>
              <button
                onClick={() => setShowTroubleshooter(false)}
                className="text-stone-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="bg-stone-900/90 p-3 rounded-xl border border-stone-800">
                <div className="font-bold text-amber-400 mb-1 flex items-center gap-1.5">
                  <Bluetooth className="w-3.5 h-3.5" /> Bluetooth Out of Range / GATT Disconnect
                </div>
                <p className="text-stone-300 leading-relaxed text-[11px]">
                  If the log reports <em>"GATT Characteristic write failed"</em>, ensure the thermal printer is powered on and within 5m line-of-sight. Web Bluetooth requires browser user activation per session.
                </p>
              </div>

              <div className="bg-stone-900/90 p-3 rounded-xl border border-stone-800">
                <div className="font-bold text-purple-400 mb-1 flex items-center gap-1.5">
                  <Wifi className="w-3.5 h-3.5" /> Network Socket / Port 9100 Timeout
                </div>
                <p className="text-stone-300 leading-relaxed text-[11px]">
                  If a kitchen KOT print fails with <em>"Host unreachable on 9100"</em>, verify the kitchen router subnet, check ethernet cables, and ensure the printer's static IP hasn't shifted after a power cycle.
                </p>
              </div>

              <div className="bg-stone-900/90 p-3 rounded-xl border border-stone-800">
                <div className="font-bold text-emerald-400 mb-1 flex items-center gap-1.5">
                  <Monitor className="w-3.5 h-3.5" /> Browser System Print Formatting
                </div>
                <p className="text-stone-300 leading-relaxed text-[11px]">
                  When using standard browser printing on 58mm or 80mm rolls, set Margins to <strong>None</strong> and uncheck "Headers and Footers" in Chrome/Edge print settings for optimal monospace rendering.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Search & Filter Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#A8A29E]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by order #, printer, or error..."
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-[#E9E0D6] bg-[#FFF9F2] focus:bg-white focus:outline-hidden text-[#1C1917]"
            />
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Status Filter */}
            <div className="flex items-center bg-[#F5F0EB] p-0.5 rounded-xl border border-[#E9E0D6] text-xs">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-colors ${
                  statusFilter === 'all' ? 'bg-white text-[#1C1917] shadow-xs' : 'text-[#57534E]'
                }`}
              >
                All Status
              </button>
              <button
                onClick={() => setStatusFilter('success')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-colors flex items-center gap-1 ${
                  statusFilter === 'success' ? 'bg-emerald-600 text-white shadow-xs' : 'text-[#57534E]'
                }`}
              >
                <CheckCircle2 className="w-3 h-3" />
                Success ({safeLogs.filter((l) => l.status === 'success').length})
              </button>
              <button
                onClick={() => setStatusFilter('failed')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-colors flex items-center gap-1 ${
                  statusFilter === 'failed' ? 'bg-rose-600 text-white shadow-xs' : 'text-[#57534E]'
                }`}
              >
                <AlertTriangle className="w-3 h-3" />
                Failed ({safeLogs.filter((l) => l.status === 'failed').length})
              </button>
            </div>

            {/* Document Type Filter */}
            <div className="flex items-center bg-[#F5F0EB] p-0.5 rounded-xl border border-[#E9E0D6] text-xs">
              <button
                onClick={() => setDocTypeFilter('all')}
                className={`px-2 py-1 rounded-lg font-semibold transition-colors ${
                  docTypeFilter === 'all' ? 'bg-white text-[#1C1917] shadow-xs' : 'text-[#57534E]'
                }`}
              >
                All Types
              </button>
              <button
                onClick={() => setDocTypeFilter('bill')}
                className={`px-2 py-1 rounded-lg font-semibold transition-colors ${
                  docTypeFilter === 'bill' ? 'bg-white text-[#1C1917] shadow-xs' : 'text-[#57534E]'
                }`}
              >
                Bills
              </button>
              <button
                onClick={() => setDocTypeFilter('kot')}
                className={`px-2 py-1 rounded-lg font-semibold transition-colors ${
                  docTypeFilter === 'kot' ? 'bg-white text-[#1C1917] shadow-xs' : 'text-[#57534E]'
                }`}
              >
                KOTs
              </button>
              <button
                onClick={() => setDocTypeFilter('test')}
                className={`px-2 py-1 rounded-lg font-semibold transition-colors ${
                  docTypeFilter === 'test' ? 'bg-white text-[#1C1917] shadow-xs' : 'text-[#57534E]'
                }`}
              >
                Tests
              </button>
            </div>

            {/* Interface Filter */}
            <div className="flex items-center bg-[#F5F0EB] p-0.5 rounded-xl border border-[#E9E0D6] text-xs">
              <button
                onClick={() => setInterfaceFilter('all')}
                className={`px-2 py-1 rounded-lg font-semibold transition-colors ${
                  interfaceFilter === 'all' ? 'bg-white text-[#1C1917] shadow-xs' : 'text-[#57534E]'
                }`}
              >
                All Interfaces
              </button>
              <button
                onClick={() => setInterfaceFilter('bluetooth')}
                className={`px-2 py-1 rounded-lg font-semibold transition-colors flex items-center gap-1 ${
                  interfaceFilter === 'bluetooth' ? 'bg-blue-600 text-white shadow-xs' : 'text-[#57534E]'
                }`}
              >
                <Bluetooth className="w-3 h-3" /> BT
              </button>
              <button
                onClick={() => setInterfaceFilter('browser')}
                className={`px-2 py-1 rounded-lg font-semibold transition-colors flex items-center gap-1 ${
                  interfaceFilter === 'browser' ? 'bg-amber-600 text-white shadow-xs' : 'text-[#57534E]'
                }`}
              >
                <Monitor className="w-3 h-3" /> Browser
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Logs Table Area */}
      <div className="flex-1 overflow-y-auto p-4">
        {filteredLogs.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-[#E9E0D6] p-8">
            <Printer className="w-12 h-12 text-[#A8A29E] mx-auto mb-3 stroke-[1.5]" />
            <h3 className="text-sm font-bold text-[#1C1917]">No Print Log Entries Found</h3>
            <p className="text-xs text-[#57534E] max-w-sm mx-auto mt-1 mb-4">
              {searchQuery || statusFilter !== 'all' || docTypeFilter !== 'all'
                ? 'No print events match your current filter parameters. Try clearing your search.'
                : 'No print attempts have been executed yet. Initiate a test print or complete an order to populate the audit log.'}
            </p>
            <button
              onClick={() => onOpenManualPrint()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#F97316] text-white text-xs font-semibold hover:bg-[#EA580C] transition-colors"
            >
              <Printer className="w-4 h-4" />
              <span>Perform Manual Test Print</span>
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-[#E9E0D6] shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#E9E0D6] bg-[#FFF9F2] text-[#57534E] font-semibold text-[11px]">
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-4">Order / Document</th>
                    <th className="py-3 px-4">Printer & Interface</th>
                    <th className="py-3 px-4">Payload & Operator</th>
                    <th className="py-3 px-4">Status & Health</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F5F0EB]">
                  {filteredLogs.map((log) => {
                    const { time, date } = formatTimestamp(log.timestamp);
                    const isExpanded = expandedLogId === log.id;
                    const matchedOrder = orders.find(
                      (o) => o.id === log.order_id || o.order_number === log.order_number
                    );

                    return (
                      <React.Fragment key={log.id}>
                        <tr
                          className={`hover:bg-[#FFF9F2]/60 transition-colors ${
                            log.status === 'failed' ? 'bg-rose-50/20' : ''
                          }`}
                        >
                          {/* Timestamp */}
                          <td className="py-3 px-4 align-top">
                            <div className="font-mono font-semibold text-[#1C1917]">{time}</div>
                            <div className="text-[10px] text-[#A8A29E] flex items-center gap-1 mt-0.5">
                              <Clock className="w-2.5 h-2.5" />
                              {date}
                            </div>
                          </td>

                          {/* Order / Document */}
                          <td className="py-3 px-4 align-top">
                            <div className="flex items-center gap-2">
                              {getDocTypeBadge(log.document_type)}
                              {log.order_number && (
                                <span className="font-mono font-bold text-[#1C1917]">
                                  #{log.order_number}
                                </span>
                              )}
                            </div>
                            {matchedOrder && (
                              <div className="text-[11px] text-[#57534E] mt-1 flex items-center gap-1.5">
                                <span>{matchedOrder.customer_name || 'Walk-in'}</span>
                                <span className="text-[#A8A29E]">•</span>
                                <span className="font-mono font-bold text-[#1C1917]">
                                  ₹{matchedOrder.grand_total.toFixed(2)}
                                </span>
                              </div>
                            )}
                          </td>

                          {/* Printer & Interface */}
                          <td className="py-3 px-4 align-top">
                            <div className="font-medium text-[#1C1917] flex items-center gap-1.5">
                              {getInterfaceIcon(log.interface_type)}
                              <span className="truncate max-w-[180px]">{log.printer_name}</span>
                            </div>
                            <div className="text-[10px] text-[#78716C] mt-0.5 flex items-center gap-1.5 font-mono">
                              <span className="capitalize">{log.interface_type}</span>
                              <span>•</span>
                              <span>{log.paper_width} Roll</span>
                            </div>
                          </td>

                          {/* Payload & Operator */}
                          <td className="py-3 px-4 align-top">
                            <div className="font-mono text-[#1C1917] text-[11px]">
                              {log.bytes_sent !== undefined ? `${log.bytes_sent} bytes` : 'N/A'}
                            </div>
                            <div className="text-[10px] text-[#A8A29E] mt-0.5">
                              By: {log.operator_name || 'System'}
                            </div>
                          </td>

                          {/* Status & Health */}
                          <td className="py-3 px-4 align-top">
                            {log.status === 'success' ? (
                              <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3" />
                                Success
                              </div>
                            ) : (
                              <div>
                                <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                  <AlertTriangle className="w-3 h-3" />
                                  Print Failed
                                </div>
                                {log.error_message && (
                                  <div className="text-[10px] text-rose-600 mt-1 max-w-xs font-mono line-clamp-1">
                                    {log.error_message}
                                  </div>
                                )}
                              </div>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="py-3 px-4 align-top text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {log.error_message && (
                                <button
                                  onClick={() =>
                                    setExpandedLogId(isExpanded ? null : log.id)
                                  }
                                  className="p-1 rounded-lg border border-[#E9E0D6] bg-white hover:bg-[#F5F0EB] text-[#57534E] text-[11px] transition-colors"
                                  title="View Diagnostic Details"
                                >
                                  {isExpanded ? (
                                    <ChevronUp className="w-3.5 h-3.5" />
                                  ) : (
                                    <ChevronDown className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              )}

                              {matchedOrder && (
                                <button
                                  onClick={() => onOpenManualPrint(matchedOrder)}
                                  className="flex items-center gap-1 px-2 py-1 rounded-lg border border-[#D5C9BD] bg-white hover:bg-blue-50 text-blue-700 text-[11px] font-semibold transition-colors shadow-2xs"
                                  title="Retry Print in Thermal Workstation"
                                >
                                  <RotateCcw className="w-3 h-3" />
                                  <span>Retry</span>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>

                        {/* Expanded Diagnostic Row */}
                        {isExpanded && log.error_message && (
                          <tr className="bg-rose-50/40 border-b border-rose-100">
                            <td colSpan={6} className="p-3 pl-8">
                              <div className="rounded-xl bg-white border border-rose-200 p-3 shadow-2xs text-xs space-y-1.5">
                                <div className="font-bold text-rose-800 flex items-center gap-1.5">
                                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                                  <span>Exception Details & Suggested Remediation</span>
                                </div>
                                <div className="font-mono text-[11px] bg-rose-50 text-rose-900 p-2 rounded-lg border border-rose-100 break-words">
                                  {log.error_message}
                                </div>
                                <div className="text-[11px] text-[#57534E] flex flex-wrap items-center justify-between gap-2 pt-1">
                                  <span>
                                    <strong>Troubleshooting:</strong> Check Bluetooth pairing status, ensure printer has paper roll seated, and verify battery level.
                                  </span>
                                  {matchedOrder && (
                                    <button
                                      onClick={() => onOpenManualPrint(matchedOrder)}
                                      className="px-2.5 py-1 rounded-lg bg-[#F97316] text-white text-[11px] font-bold hover:bg-[#EA580C] transition-colors"
                                    >
                                      Launch Thermal Workstation for #{log.order_number}
                                    </button>
                                  )}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
