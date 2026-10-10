import React, { useState, useMemo } from 'react';
import { useTsosStore } from '../../lib/store';
import { Ingredient } from '../../types';
import {
  ClipboardList,
  AlertTriangle,
  Download,
  Copy,
  CheckCircle2,
  RefreshCw,
  X,
  Package,
  Boxes,
  Truck,
  FileSpreadsheet,
} from 'lucide-react';

interface RestockOrderModalProps {
  onClose: () => void;
  onRestockSuccess?: (count: number) => void;
}

// Estimated approximate wholesale cost per unit in ₹
const ESTIMATED_UNIT_COST: { [id: string]: number } = {
  'ing-coffee': 0.85, // ₹850 per 1000g
  'ing-milk': 0.06,   // ₹60 per 1000ml
  'ing-sugar': 0.045, // ₹45 per 1000g
  'ing-tea': 0.60,    // ₹600 per 1000g
  'ing-dough': 0.05,  // ₹50 per 1000g
  'ing-potato': 0.03, // ₹30 per 1000g
  'ing-bread': 4.0,   // ₹4 per slice
};

export const RestockOrderModal: React.FC<RestockOrderModalProps> = ({
  onClose,
  onRestockSuccess,
}) => {
  const { ingredients, bulkRestockIngredients, themeMode } = useTsosStore();
  const isServepoint = themeMode === 'servepoint';

  const [filterMode, setFilterMode] = useState<'low_only' | 'all'>('low_only');
  const [copied, setCopied] = useState(false);
  const [applied, setApplied] = useState(false);
  const [supplierNotes, setSupplierNotes] = useState('Standard vendor delivery - Morning 8 AM');

  // Compute low-stock items
  const lowStockItems = useMemo(() => {
    return ingredients.filter((i) => i.stock_qty <= i.low_stock_threshold);
  }, [ingredients]);

  const targetIngredients = filterMode === 'low_only' ? lowStockItems : ingredients;

  // State for user-editable reorder quantities: { [ingredientId]: quantity }
  const [reorderQuantities, setReorderQuantities] = useState<{ [id: string]: number }>(() => {
    const initial: { [id: string]: number } = {};
    ingredients.forEach((item) => {
      // Suggested replenishment: bring to 2x threshold, or at least 1 threshold
      const targetPar = item.low_stock_threshold * 2;
      const deficit = Math.max(0, targetPar - item.stock_qty);
      initial[item.id] = deficit > 0 ? deficit : item.low_stock_threshold;
    });
    return initial;
  });

  const handleQtyChange = (id: string, val: number) => {
    setReorderQuantities((prev) => ({
      ...prev,
      [id]: Math.max(0, val),
    }));
  };

  // Financial calculations
  const orderSummary = useMemo(() => {
    let totalItems = 0;
    let totalEstimatedCost = 0;

    targetIngredients.forEach((item) => {
      const qty = reorderQuantities[item.id] || 0;
      if (qty > 0) {
        totalItems += 1;
        const unitCost = ESTIMATED_UNIT_COST[item.id] || 0.1;
        totalEstimatedCost += qty * unitCost;
      }
    });

    return {
      totalItems,
      totalEstimatedCost: Math.round(totalEstimatedCost),
    };
  }, [targetIngredients, reorderQuantities]);

  // Copy purchase order to clipboard
  const handleCopyPO = () => {
    const now = new Date().toLocaleDateString();
    let text = `=========================================\n`;
    text += `TSOS CAFE - RESTOCK PURCHASE ORDER\n`;
    text += `Date: ${now}\n`;
    text += `Supplier Delivery Note: ${supplierNotes}\n`;
    text += `=========================================\n\n`;
    text += `ITEMS TO DELIVER:\n`;

    targetIngredients.forEach((item, idx) => {
      const qty = reorderQuantities[item.id] || 0;
      if (qty > 0) {
        const estCost = Math.round(qty * (ESTIMATED_UNIT_COST[item.id] || 0.1));
        text += `${idx + 1}. ${item.name}: ${qty} ${item.unit} (Est: ₹${estCost})\n`;
      }
    });

    text += `\n-----------------------------------------\n`;
    text += `Total SKUs: ${orderSummary.totalItems}\n`;
    text += `Estimated Total: ₹${orderSummary.totalEstimatedCost.toLocaleString()}\n`;
    text += `=========================================\n`;

    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  // Export CSV
  const handleExportCSV = () => {
    const headers = [
      'Ingredient ID',
      'Ingredient Name',
      'Current Stock',
      'Min Threshold',
      'Unit',
      'Reorder Qty',
      'Est Unit Cost (INR)',
      'Est Total Cost (INR)',
      'Status',
    ];

    const rows = targetIngredients.map((item) => {
      const qty = reorderQuantities[item.id] || 0;
      const unitCost = ESTIMATED_UNIT_COST[item.id] || 0.1;
      const totalCost = Math.round(qty * unitCost);
      const isLow = item.stock_qty <= item.low_stock_threshold;

      return [
        item.id,
        `"${item.name.replace(/"/g, '""')}"`,
        item.stock_qty,
        item.low_stock_threshold,
        item.unit,
        qty,
        unitCost.toFixed(2),
        totalCost,
        isLow ? 'LOW STOCK' : 'HEALTHY',
      ].join(',');
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `restock-purchase-order-${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // 1-Click apply restock to live inventory
  const handleApplyRestock = () => {
    const toRestock: { id: string; addQty: number }[] = [];
    targetIngredients.forEach((item) => {
      const qty = reorderQuantities[item.id] || 0;
      if (qty > 0) {
        toRestock.push({ id: item.id, addQty: qty });
      }
    });

    if (toRestock.length === 0) return;

    bulkRestockIngredients(toRestock, `Restock PO: ${supplierNotes}`);
    setApplied(true);

    if (onRestockSuccess) {
      onRestockSuccess(toRestock.length);
    }

    setTimeout(() => {
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className={`bg-white rounded-2xl max-w-3xl w-full border shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-auto ${isServepoint ? 'border-[#E3E7E0]' : 'border-[#E9E0D6]'}`}>
        {/* Header */}
        <div className={`p-4 border-b flex items-center justify-between ${isServepoint ? 'bg-[#F6F5F2] border-[#E3E7E0]' : 'bg-[#FFF9F2] border-[#E9E0D6]'}`}>
          <div className="flex items-center gap-2.5">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shadow-xs ${isServepoint ? 'sp-surface text-[#0F3D3E]' : 'bg-[#FFF1E6] text-[#F97316]'}`}>
              <ClipboardList className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className={`font-bold text-sm sm:text-base ${isServepoint ? 'text-[#1A1A1A]' : 'text-[#1C1917]'}`}>
                  Generate Restock Order List
                </h3>
                {lowStockItems.length > 0 && (
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-[#FEF2F2] text-[#B42318] flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    {lowStockItems.length} Low Stock
                  </span>
                )}
              </div>
              <p className={`text-xs mt-0.5 ${isServepoint ? 'text-[#6B6B6B]' : 'text-[#57534E]'}`}>
                Automatically calculates replenishments required to maintain kitchen par levels
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-lg hover:bg-black/5 transition-colors ${isServepoint ? 'text-[#6B6B6B] hover:text-[#1A1A1A]' : 'text-[#78716C] hover:text-[#1C1917]'}`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Filter & Metric Row */}
          <div className={`flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl border ${isServepoint ? 'bg-[#F6F5F2] border-[#E3E7E0]' : 'bg-[#FFFDF9] border-[#E9E0D6]'}`}>
            <div className={`flex items-center gap-1 p-0.5 rounded-lg text-xs ${isServepoint ? 'bg-[#D9E2DD]' : 'bg-[#F5F0EB]'}`}>
              <button
                type="button"
                onClick={() => setFilterMode('low_only')}
                className={`px-3 py-1.5 rounded-md font-semibold transition-all ${
                  filterMode === 'low_only'
                    ? isServepoint
                      ? 'bg-[#0F3D3E] text-white'
                      : 'bg-white text-[#1C1917] shadow-xs'
                    : isServepoint
                      ? 'text-[#6B6B6B] hover:text-[#1A1A1A]'
                      : 'text-[#57534E] hover:text-[#1C1917]'
                }`}
              >
                Low Stock Only ({lowStockItems.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('all')}
                className={`px-3 py-1.5 rounded-md font-semibold transition-all ${
                  filterMode === 'all'
                    ? isServepoint
                      ? 'bg-[#0F3D3E] text-white'
                      : 'bg-white text-[#1C1917] shadow-xs'
                    : isServepoint
                      ? 'text-[#6B6B6B] hover:text-[#1A1A1A]'
                      : 'text-[#57534E] hover:text-[#1C1917]'
                }`}
              >
                All Raw Ingredients ({ingredients.length})
              </button>
            </div>

            <div className={`flex items-center gap-4 text-xs ${isServepoint ? '' : 'font-mono'}`}>
              <div>
                <span className={isServepoint ? 'text-[#6B8579]' : 'text-[#A8A29E]'}>SKUs:</span>{' '}
                <strong className={`text-sm ${isServepoint ? 'text-[#0F3D3E]' : 'text-[#1C1917]'}`}>{orderSummary.totalItems}</strong>
              </div>
              <div>
                <span className={isServepoint ? 'text-[#6B8579]' : 'text-[#A8A29E]'}>Est. PO Total:</span>{' '}
                <strong className={`text-sm ${isServepoint ? 'text-[#0F3D3E]' : 'text-[#F97316]'}`}>₹{orderSummary.totalEstimatedCost.toLocaleString()}</strong>
              </div>
            </div>
          </div>

          {/* Table of items to restock */}
          <div className={`border rounded-xl overflow-hidden ${isServepoint ? 'border-[#E3E7E0]' : 'border-[#E9E0D6]'}`}>
            <div className="max-h-72 overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className={`font-semibold sticky top-0 border-b z-10 ${
                  isServepoint ? 'bg-[#F6F5F2] text-[#6B6B6B] border-[#E3E7E0]' : 'bg-[#FFF9F2] text-[#57534E] border-[#E9E0D6]'
                }`}>
                  <tr>
                    <th className="p-2.5">Item & Unit</th>
                    <th className="p-2.5 text-right">Current</th>
                    <th className="p-2.5 text-right">Min Threshold</th>
                    <th className="p-2.5 text-right">Status</th>
                    <th className="p-2.5 text-right w-36">Order Qty</th>
                    <th className="p-2.5 text-right">Est. Cost</th>
                  </tr>
                </thead>
                <tbody className={`divide-y bg-white ${isServepoint ? 'divide-[#E3E7E0]' : 'divide-[#E9E0D6]'}`}>
                  {targetIngredients.length === 0 ? (
                    <tr>
                      <td colSpan={6} className={`text-center py-8 ${isServepoint ? 'text-[#6B8579]' : 'text-[#A8A29E]'}`}>
                        All inventory stock levels are healthy! No items need restocking.
                      </td>
                    </tr>
                  ) : (
                    targetIngredients.map((item) => {
                      const isLow = item.stock_qty <= item.low_stock_threshold;
                      const qty = reorderQuantities[item.id] || 0;
                      const unitCost = ESTIMATED_UNIT_COST[item.id] || 0.1;
                      const estTotal = Math.round(qty * unitCost);

                      return (
                        <tr
                          key={item.id}
                          className={
                            isLow
                              ? 'bg-[#FEF2F2]/40 hover:bg-[#FEF2F2]/70'
                              : isServepoint
                                ? 'hover:bg-[#F6F5F2]/60'
                                : 'hover:bg-[#FFFDF9]'
                          }
                        >
                          <td className={`p-2.5 font-semibold ${isServepoint ? 'text-[#1A1A1A]' : 'text-[#1C1917]'}`}>
                            <div className="flex items-center gap-1.5">
                              {isLow && <AlertTriangle className="w-3.5 h-3.5 text-[#B42318] shrink-0" />}
                              <span>{item.name}</span>
                            </div>
                            <span className={`text-[10px] ${isServepoint ? 'text-[#6B8579]' : 'text-[#A8A29E]'}`}>Unit: {item.unit}</span>
                          </td>

                          <td className={`p-2.5 text-right font-bold ${isServepoint ? 'text-[#0F3D3E]' : 'font-mono text-[#1C1917]'}`}>
                            {item.stock_qty.toLocaleString()} {item.unit}
                          </td>

                          <td className={`p-2.5 text-right ${isServepoint ? 'text-[#6B6B6B]' : 'font-mono text-[#57534E]'}`}>
                            {item.low_stock_threshold.toLocaleString()} {item.unit}
                          </td>

                          <td className="p-2.5 text-right">
                            {isLow ? (
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FEF2F2] text-[#B42318] border ${isServepoint ? 'border-[#B42318]/25' : 'border-[#FECACA]'}`}>
                                Deficit: {item.low_stock_threshold - item.stock_qty} {item.unit}
                              </span>
                            ) : (
                              <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#E8F5EC] text-[#17803D]">
                                Par OK
                              </span>
                            )}
                          </td>

                          <td className="p-2.5 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <input
                                type="number"
                                min={0}
                                value={qty}
                                onChange={(e) => handleQtyChange(item.id, Number(e.target.value) || 0)}
                                className={`w-20 text-right font-bold rounded-lg px-2 py-1 text-xs focus:outline-hidden ${
                                  isServepoint
                                    ? 'bg-white border border-[#E3E7E0] focus:border-[#B88E2F] focus:ring-1 focus:ring-[#B88E2F]/30 text-[#0F3D3E]'
                                    : 'bg-[#FFFDF9] border border-[#E9E0D6] focus:ring-1 focus:ring-[#F97316] font-mono text-[#1C1917]'
                                }`}
                              />
                              <span className={`text-[10px] w-6 text-left ${isServepoint ? 'text-[#6B8579]' : 'text-[#57534E]'}`}>{item.unit}</span>
                            </div>
                          </td>

                          <td className={`p-2.5 text-right font-bold ${isServepoint ? 'text-[#0F3D3E]' : 'font-mono text-[#F97316]'}`}>
                            ₹{estTotal.toLocaleString()}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Supplier Order Remarks */}
          <div>
            <label className={`block text-xs font-semibold mb-1 ${isServepoint ? 'text-[#1A1A1A]' : 'text-[#1C1917]'}`}>
              Supplier Delivery Notes & Invoice Instructions
            </label>
            <input
              type="text"
              value={supplierNotes}
              onChange={(e) => setSupplierNotes(e.target.value)}
              placeholder="e.g. Deliver before 9 AM, gate B entry, invoice to Artisan Cafe Pvt Ltd"
              className={`w-full rounded-xl px-3 py-2 text-xs focus:outline-hidden ${
                isServepoint
                  ? 'bg-white border border-[#E3E7E0] text-[#1A1A1A] focus:border-[#B88E2F] focus:ring-1 focus:ring-[#B88E2F]/30'
                  : 'bg-[#FFF9F2] border border-[#E9E0D6] text-[#1C1917] focus:ring-2 focus:ring-[#F97316]'
              }`}
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className={`p-4 border-t flex flex-wrap items-center justify-between gap-2 ${isServepoint ? 'bg-[#F6F5F2] border-[#E3E7E0]' : 'bg-[#FFF9F2] border-[#E9E0D6]'}`}>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyPO}
              className={`px-3 py-2 rounded-xl font-semibold text-xs flex items-center gap-1.5 transition-colors shadow-xs ${
                isServepoint ? 'bg-white border border-[#E3E7E0] hover:bg-[#F6F5F2] text-[#0F3D3E]' : 'bg-white border border-[#D5C9BD] hover:bg-[#F5EBE1] text-[#1C1917]'
              }`}
            >
              {copied ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#17803D]" />
                  <span className="text-[#17803D]">Copied PO to Clipboard!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy PO for WhatsApp / Supplier</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleExportCSV}
              className={`px-3 py-2 rounded-xl font-semibold text-xs flex items-center gap-1.5 transition-colors shadow-xs ${
                isServepoint ? 'bg-white border border-[#E3E7E0] hover:bg-[#F6F5F2] text-[#0F3D3E]' : 'bg-white border border-[#D5C9BD] hover:bg-[#F5EBE1] text-[#1C1917]'
              }`}
            >
              <FileSpreadsheet className={`w-3.5 h-3.5 ${isServepoint ? 'text-[#17803D]' : 'text-[#10B981]'}`} />
              <span>Download CSV</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className={`px-3.5 py-2 rounded-xl border font-semibold text-xs ${
                isServepoint ? 'border-[#E3E7E0] text-[#6B6B6B] hover:bg-[#F6F5F2]' : 'border-[#E9E0D6] text-[#57534E] hover:bg-[#F5F0EB]'
              }`}
            >
              Close
            </button>

            <button
              type="button"
              onClick={handleApplyRestock}
              disabled={applied || orderSummary.totalItems === 0}
              className={`px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors disabled:opacity-50 ${
                isServepoint ? 'sp-cta' : 'bg-[#17803D] hover:bg-[#156f35] text-white shadow-xs'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${applied ? 'animate-spin' : ''}`} />
              <span>{applied ? 'Stock Updated in TSOS!' : '1-Click Apply Restock to Stock'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
