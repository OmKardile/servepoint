import React, { useState } from 'react';
import { useTsosStore } from '../../lib/store';
import { DineTable } from '../../types';
import {
  Grid,
  Plus,
  QrCode,
  Users,
  ExternalLink,
  Printer,
  CheckCircle2,
  Clock,
  X,
} from 'lucide-react';

export const TablesScreen: React.FC = () => {
  const {
    tables,
    orders,
    addTable,
    updateTableStatus,
    setActiveSurface,
    setSelectedTableId,
    location,
    themeMode,
  } = useTsosStore();

  const isServepoint = themeMode === 'servepoint';

  const [isAddTableOpen, setIsAddTableOpen] = useState(false);
  const [newTableLabel, setNewTableLabel] = useState('');
  const [newTableSeats, setNewTableSeats] = useState(4);
  const [viewingQrTable, setViewingQrTable] = useState<DineTable | null>(null);

  const handleAddTableSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTableLabel.trim()) return;
    addTable(newTableLabel.trim(), newTableSeats);
    setNewTableLabel('');
    setIsAddTableOpen(false);
  };

  const handleOpenStorefrontForTable = (table: DineTable) => {
    setSelectedTableId(table.id);
    setActiveSurface('storefront');
  };

  return (
    <div className={`flex-1 flex flex-col h-[calc(100vh-100px)] overflow-hidden ${isServepoint ? 'bg-[#F6F5F2]' : 'bg-[#FFF9F2]'}`}>
      {/* Header */}
      <div className={`p-4 bg-white border-b flex flex-wrap items-center justify-between gap-3 ${isServepoint ? 'border-[#E3E7E0]' : 'border-[#E9E0D6]'}`}>
        <div className="flex items-center gap-2.5">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isServepoint ? 'bg-[#D9E2DD] text-[#967221]' : 'bg-[#FFF1E6] text-[#F97316]'}`}>
            <Grid className="w-5 h-5" />
          </div>
          <div>
            <h2 className={`text-base font-bold leading-tight ${isServepoint ? 'text-[#1A1A1A]' : 'text-[#1C1917]'}`}>
              Dine-In Floor Plan & Table QR Codes
            </h2>
            <div className={`text-xs ${isServepoint ? 'text-[#6B6B6B]' : 'text-[#57534E]'}`}>
              Tables auto-free when kitchen or cashier finishes orders • Contactless QR ordering
            </div>
          </div>
        </div>

        <button
          onClick={() => setIsAddTableOpen(true)}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-xs font-semibold shadow-xs transition-colors ${
            isServepoint ? 'bg-[#B88E2F] hover:bg-[#967221]' : 'bg-[#F97316] hover:bg-[#EA580C]'
          }`}
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add New Table</span>
        </button>
      </div>

      {/* Tables Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {tables.map((table) => {
            const isOccupied = table.status === 'occupied';
            const activeOrder = orders.find(
              (o) => o.id === table.current_order_id && o.status !== 'completed' && o.status !== 'cancelled'
            );

            return (
              <div
                key={table.id}
                className={`rounded-2xl border p-4 shadow-xs flex flex-col justify-between transition-all ${
                  isOccupied
                    ? isServepoint
                      ? 'bg-white border-[#B88E2F]/45 ring-1 ring-[#B88E2F]/20'
                      : 'bg-[#FFFBEB]/40 border-[#FED7AA] ring-1 ring-[#FED7AA]'
                    : isServepoint
                    ? 'bg-white border-[#E3E7E0] hover:border-[#B88E2F]/40 hover:shadow-[0_4px_14px_rgba(15,61,62,0.07)]'
                    : 'bg-white border-[#E9E0D6]'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <h3 className={`font-bold text-base ${isServepoint ? 'text-[#1A1A1A]' : 'text-[#1C1917]'}`}>{table.label}</h3>
                      <div className={`text-xs flex items-center gap-1 mt-0.5 ${isServepoint ? 'text-[#6B6B6B]' : 'text-[#57534E]'}`}>
                        <Users className={`w-3.5 h-3.5 ${isServepoint ? 'text-[#969696]' : 'text-[#A8A29E]'}`} />
                        <span>{table.seats} Seats</span>
                      </div>
                    </div>

                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold capitalize ${
                        isOccupied
                          ? isServepoint
                            ? 'bg-[#B88E2F]/15 text-[#967221]'
                            : 'bg-[#FFF4E5] text-[#B45309]'
                          : isServepoint
                          ? 'bg-[#0F3D3E]/10 text-[#0F3D3E]'
                          : 'bg-[#E8F5EC] text-[#17803D]'
                      }`}
                    >
                      {table.status}
                    </span>
                  </div>

                  {isOccupied && activeOrder ? (
                    <div className={`my-2 p-2.5 rounded-xl border text-xs space-y-1 ${
                      isServepoint ? 'bg-[#B88E2F]/8 border-[#B88E2F]/25' : 'bg-[#FFF4E5] border-[#FED7AA]'
                    }`}>
                      <div className={`flex justify-between font-bold ${isServepoint ? 'text-[#1A1A1A]' : 'text-[#1C1917]'}`}>
                        <span>Order #{activeOrder.order_number}</span>
                        <span className={isServepoint ? 'font-semibold text-[#967221]' : 'font-mono text-[#B45309]'}>₹{activeOrder.grand_total}</span>
                      </div>
                      <div className={`text-[11px] truncate ${isServepoint ? 'text-[#6B6B6B]' : 'text-[#57534E]'}`}>
                        {activeOrder.items.map((i) => `${i.qty}x ${i.menu_item_name}`).join(', ')}
                      </div>
                      <div className={`text-[10px] capitalize ${isServepoint ? 'text-[#969696]' : 'text-[#A8A29E]'}`}>
                        Status: <strong className={isServepoint ? 'text-[#967221]' : 'text-[#B45309]'}>{activeOrder.status}</strong>
                      </div>
                    </div>
                  ) : (
                    <div className={`my-2 py-3 text-center text-xs border border-dashed rounded-xl ${
                      isServepoint ? 'text-[#969696] border-[#E3E7E0]' : 'text-[#A8A29E] border-[#E9E0D6]'
                    }`}>
                      Ready for guests
                    </div>
                  )}
                </div>

                {/* Table Actions */}
                <div className={`pt-3 border-t flex items-center justify-between gap-2 ${isServepoint ? 'border-[#F6F5F2]' : 'border-[#F5F0EB]'}`}>
                  <button
                    onClick={() => setViewingQrTable(table)}
                    className={`flex-1 flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg border text-xs font-semibold transition-colors ${
                      isServepoint
                        ? 'border-[#E3E7E0] hover:bg-[#D9E2DD] text-[#6B6B6B] hover:text-[#1A1A1A]'
                        : 'border-[#E9E0D6] hover:bg-[#F5F0EB] text-[#57534E]'
                    }`}
                  >
                    <QrCode className={`w-3.5 h-3.5 ${isServepoint ? 'text-[#1A1A1A]' : 'text-[#1C1917]'}`} />
                    <span>View QR</span>
                  </button>

                  <button
                    onClick={() => handleOpenStorefrontForTable(table)}
                    className={`flex items-center gap-1 py-1.5 px-2.5 rounded-lg text-xs font-semibold transition-colors ${
                      isServepoint
                        ? 'bg-[#B88E2F]/10 hover:bg-[#B88E2F] text-[#967221] hover:text-white'
                        : 'bg-[#FFF1E6] hover:bg-[#F97316] text-[#F97316] hover:text-white'
                    }`}
                    title="Launch customer table order screen"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span>Test QR</span>
                  </button>

                  <select
                    value={table.status}
                    onChange={(e) => updateTableStatus(table.id, e.target.value as any)}
                    className={`text-[11px] font-medium border rounded-lg py-1 px-1 ${
                      isServepoint ? 'border-[#E3E7E0] bg-[#D9E2DD] text-[#1A1A1A]' : 'border-[#E9E0D6] bg-white text-[#57534E]'
                    }`}
                  >
                    <option value="free">Free</option>
                    <option value="occupied">Occupied</option>
                    <option value="reserved">Reserved</option>
                  </select>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Add Table Modal */}
      {isAddTableOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className={`rounded-2xl max-w-xs w-full border p-5 shadow-xl ${
            isServepoint ? 'bg-white border-[#E3E7E0]' : 'bg-white border-[#E9E0D6]'
          }`}>
            <h3 className={`font-bold text-sm mb-3 ${isServepoint ? 'text-[#1A1A1A]' : 'text-[#1C1917]'}`}>Add Table to Floor</h3>
            <form onSubmit={handleAddTableSubmit} className="space-y-3">
              <div>
                <label className={`block text-xs font-semibold mb-1 ${isServepoint ? 'text-[#6B6B6B]' : 'text-[#57534E]'}`}>
                  Table Label / Number
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={newTableLabel}
                  onChange={(e) => setNewTableLabel(e.target.value)}
                  placeholder="e.g. T5 (Patio), Table 6"
                  className={`w-full px-3 py-2 text-xs rounded-xl border focus:outline-hidden ${
                    isServepoint
                      ? 'border-[#E3E7E0] focus:border-[#B88E2F] focus:ring-2 focus:ring-[#B88E2F]/25 text-[#1A1A1A]'
                      : 'border-[#E9E0D6] focus:border-[#F97316]'
                  }`}
                />
              </div>

              <div>
                <label className={`block text-xs font-semibold mb-1 ${isServepoint ? 'text-[#6B6B6B]' : 'text-[#57534E]'}`}>
                  Number of Seats
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  max={24}
                  value={newTableSeats}
                  onChange={(e) => setNewTableSeats(Number(e.target.value) || 2)}
                  className={`w-full px-3 py-2 text-xs font-mono font-bold rounded-xl border focus:outline-hidden ${
                    isServepoint
                      ? 'border-[#E3E7E0] focus:border-[#B88E2F] focus:ring-2 focus:ring-[#B88E2F]/25 text-[#1A1A1A]'
                      : 'border-[#E9E0D6] focus:border-[#F97316]'
                  }`}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddTableOpen(false)}
                  className={`px-3 py-1.5 text-xs transition-colors ${
                    isServepoint ? 'text-[#6B6B6B] hover:text-[#1A1A1A]' : 'text-[#57534E]'
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`px-4 py-1.5 text-xs font-semibold text-white rounded-xl shadow-xs transition-colors ${
                    isServepoint ? 'bg-[#B88E2F] hover:bg-[#967221]' : 'bg-[#F97316] hover:bg-[#EA580C]'
                  }`}
                >
                  Add Table
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QR Code Stand Preview Modal */}
      {viewingQrTable && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className={`rounded-2xl max-w-sm w-full border shadow-2xl p-6 text-center space-y-4 ${
            isServepoint ? 'bg-white border-[#E3E7E0]' : 'bg-white border-[#E9E0D6]'
          }`}>
            <div className={`flex items-center justify-between border-b pb-2 ${isServepoint ? 'border-[#F6F5F2]' : 'border-[#F5F0EB]'}`}>
              <span className={`text-xs font-semibold ${isServepoint ? 'text-[#6B6B6B]' : 'text-[#57534E]'}`}>Table Stand Printout</span>
              <button
                onClick={() => setViewingQrTable(null)}
                className={isServepoint ? 'text-[#969696] hover:text-[#DC2626]' : 'text-[#A8A29E] hover:text-[#1C1917]'}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Printable Table Stand Graphic */}
            <div className={`p-6 rounded-2xl border shadow-inner space-y-3 ${
              isServepoint ? 'bg-[#D9E2DD] border-[#E3E7E0]' : 'bg-[#FFF9F2] border-[#E9E0D6]'
            }`}>
              <div className={`font-display font-bold text-lg tracking-wider uppercase ${isServepoint ? 'text-[#0F3D3E]' : 'text-[#1C1917]'}`}>
                {location.name}
              </div>
              <div className={`text-xs ${isServepoint ? 'text-[#6B6B6B]' : 'text-[#57534E]'}`}>Scan to View Menu & Order</div>

              <div className="w-44 h-44 bg-white mx-auto p-3 rounded-xl border-2 border-[#1C1917] shadow-sm flex flex-col items-center justify-center relative">
                <QrCode className="w-32 h-32 text-[#1C1917]" />
                <div className="text-[10px] font-mono font-bold text-[#1C1917]">
                  {viewingQrTable.label}
                </div>
              </div>

              <div className={`text-sm font-bold ${isServepoint ? 'text-[#967221]' : 'text-[#F97316]'}`}>
                {viewingQrTable.label} ({viewingQrTable.seats} Seats)
              </div>

              {/* Secure URL & Anti-Tamper Token Details */}
              <div className={`p-2.5 rounded-xl border text-left space-y-1 ${
                isServepoint ? 'bg-white border-[#E3E7E0]' : 'bg-white border-[#E9E0D6]'
              }`}>
                <div className={`flex items-center justify-between text-[10px] font-semibold ${
                  isServepoint ? 'text-[#0F3D3E]' : 'text-[#17803D]'
                }`}>
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className={`w-3 h-3 ${isServepoint ? 'text-[#0F3D3E]' : 'text-[#16A34A]'}`} />
                    <span>Anti-Tamper & 10m History Guard</span>
                  </span>
                  <span className={`font-mono text-[9px] ${isServepoint ? 'text-[#969696]' : 'text-[#78716C]'}`}>10m Expiry</span>
                </div>
                <div className={`text-[10px] font-mono break-all p-1.5 rounded-md border ${
                  isServepoint ? 'text-[#6B6B6B] bg-[#F6F5F2] border-[#E3E7E0]' : 'text-[#57534E] bg-[#FAF7F2] border-[#E9E0D6]'
                }`}>
                  https://tablesideordering-web.vercel.app/{location.slug || 'coolkafe'}/{viewingQrTable.label.toLowerCase().replace(/[^a-z0-9]/g, '')}?token={viewingQrTable.qr_token}
                </div>
                <div className={`text-[9px] leading-snug ${isServepoint ? 'text-[#969696]' : 'text-[#78716C]'}`}>
                  • Physical scan initiates a <strong>10-minute dynamic session token</strong>.<br />
                  • Expired sessions prevent guests from ordering from home via browser history or saved bookmarks.
                </div>
              </div>

              <div className={`text-[11px] ${isServepoint ? 'text-[#969696]' : 'text-[#A8A29E]'}`}>
                No app download needed • Powered by TSOS
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => handleOpenStorefrontForTable(viewingQrTable)}
                className={`flex-1 py-2 px-3 rounded-xl text-white text-xs font-semibold transition-colors ${
                  isServepoint ? 'bg-[#B88E2F] hover:bg-[#967221]' : 'bg-[#F97316] hover:bg-[#EA580C]'
                }`}
              >
                Test Valid QR Order
              </button>
              <button
                onClick={() => {
                  const url = `https://tablesideordering-web.vercel.app/${location.slug || 'coolkafe'}/${viewingQrTable.label.toLowerCase().replace(/[^a-z0-9]/g, '')}?token=${viewingQrTable.qr_token}`;
                  navigator.clipboard?.writeText(url);
                  alert(`Secure Table QR URL copied:\n${url}`);
                }}
                className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center gap-1 transition-colors ${
                  isServepoint
                    ? 'border-[#E3E7E0] text-[#6B6B6B] hover:bg-[#D9E2DD] hover:text-[#1A1A1A]'
                    : 'border-[#E9E0D6] text-[#57534E] hover:bg-[#F5F0EB]'
                }`}
              >
                <span>Copy Link</span>
              </button>
              <button
                onClick={() => window.print()}
                className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center gap-1 transition-colors ${
                  isServepoint
                    ? 'border-[#E3E7E0] text-[#6B6B6B] hover:bg-[#D9E2DD] hover:text-[#1A1A1A]'
                    : 'border-[#E9E0D6] text-[#57534E] hover:bg-[#F5F0EB]'
                }`}
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
