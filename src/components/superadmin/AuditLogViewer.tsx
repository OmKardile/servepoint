import React, { useState } from 'react';
import { useTsosStore } from '../../lib/store';
import { ShieldCheck, Search, Filter, Download, Clock, User, AlertCircle } from 'lucide-react';

export const AuditLogViewer: React.FC = () => {
  const { platformAuditLogs } = useTsosStore();

  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('all');

  const filteredLogs = platformAuditLogs.filter((log) => {
    const q = search.toLowerCase();
    const matchesSearch =
      log.action.toLowerCase().includes(q) ||
      (log.target_business_name && log.target_business_name.toLowerCase().includes(q)) ||
      log.admin_email.toLowerCase().includes(q) ||
      log.details.toLowerCase().includes(q);

    const matchesAction = actionFilter === 'all' || log.action.includes(actionFilter);

    return matchesSearch && matchesAction;
  });

  const handleExportJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(platformAuditLogs, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `platform_audit_logs_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-[#E9E0D6] rounded-xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#DCFCE7] text-[#166534] border border-[#BBF7D0]">
              Zero-Trust Audit Trail
            </span>
            <span className="text-xs text-[#78716C]">Append-Only Log</span>
          </div>
          <h2 className="text-xl font-bold text-[#1C1917] mt-1">Platform Administrative Audit Trail</h2>
          <p className="text-xs text-[#78716C]">
            Tamper-evident system logs capturing every tenant creation, subscription change, status transition, and administrative action.
          </p>
        </div>

        <button
          onClick={handleExportJson}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#FAF6F0] hover:bg-[#F3ECE4] text-[#1C1917] text-xs font-semibold transition-colors border border-[#E9E0D6] self-start sm:self-auto"
        >
          <Download className="w-4 h-4" />
          Export JSON
        </button>
      </div>

      {/* Filter toolbar */}
      <div className="bg-white border border-[#E9E0D6] rounded-xl p-4 shadow-xs flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-[#A8A29E] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search audit trail by business, action, email, or keywords..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs rounded-lg border border-[#E9E0D6] bg-[#FAF6F0] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#F97316]"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs text-[#78716C]">Action:</span>
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="text-xs px-3 py-2 rounded-lg border border-[#E9E0D6] bg-[#FAF6F0] text-[#1C1917]"
          >
            <option value="all">All Actions</option>
            <option value="PROVISION">Provisioning</option>
            <option value="SUBSCRIPTION">Subscription / Deal</option>
            <option value="UPDATE">Business Update</option>
            <option value="STATUS">Status Changes</option>
            <option value="DELETE">Archival / Deletions</option>
          </select>
        </div>
      </div>

      {/* Log list */}
      <div className="bg-white border border-[#E9E0D6] rounded-xl shadow-xs divide-y divide-[#F5EFEA] overflow-hidden">
        {filteredLogs.length === 0 ? (
          <div className="py-12 text-center text-xs text-[#78716C]">
            No audit records matching criteria.
          </div>
        ) : (
          filteredLogs.map((log) => (
            <div key={log.id} className="p-4 hover:bg-[#FFFBF5] transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#FAF6F0] border border-[#E9E0D6] text-[#78716C] flex items-center justify-center shrink-0 mt-0.5">
                  <ShieldCheck className="w-4 h-4 text-[#7C3AED]" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-[11px] px-2 py-0.5 rounded bg-[#FAF6F0] border border-[#E9E0D6] text-[#1C1917]">
                      {log.action}
                    </span>
                    {log.target_business_name && (
                      <span className="font-bold text-[#1C1917]">
                        {log.target_business_name}
                      </span>
                    )}
                  </div>
                  <p className="text-[#57534E] mt-1">{log.details}</p>
                  <div className="flex items-center gap-3 mt-1.5 text-[11px] text-[#A8A29E]">
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3" />
                      {log.admin_email}
                    </span>
                    <span>•</span>
                    <span className="font-mono">{log.id}</span>
                  </div>
                </div>
              </div>

              <div className="text-right whitespace-nowrap text-[#78716C] font-mono text-[11px] flex sm:flex-col items-center sm:items-end justify-between sm:justify-start">
                <span>
                  {new Date(log.timestamp).toLocaleDateString('en-IN', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
                <span className="text-[#A8A29E]">
                  {new Date(log.timestamp).toLocaleTimeString('en-IN', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
