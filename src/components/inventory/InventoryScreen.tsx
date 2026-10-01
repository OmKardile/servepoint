import React, { useState, useMemo } from 'react';
import { useTsosStore } from '../../lib/store';
import { Ingredient, Recipe, InventoryLog } from '../../types';
import { RestockOrderModal } from './RestockOrderModal';
import {
  Boxes,
  AlertTriangle,
  Plus,
  RefreshCw,
  History,
  FileText,
  Search,
  CheckCircle2,
  X,
  ArrowDownRight,
  ArrowUpRight,
  ClipboardList,
  BarChart3,
  TrendingDown,
  Layers,
  ChevronRight,
  Filter,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { canPerformAction } from '../../lib/rbac';

export const InventoryScreen: React.FC = () => {
  const {
    ingredients,
    recipes,
    menuItems,
    categories,
    inventoryLogs,
    restockIngredient,
    currentProfile,
    themeMode,
  } = useTsosStore();
  const isServepoint = themeMode === 'servepoint';

  const [activeTab, setActiveTab] = useState<'stock' | 'recipes' | 'logs'>('stock');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [isChartCollapsed, setIsChartCollapsed] = useState(false);
  const [restockModalItem, setRestockModalItem] = useState<Ingredient | null>(null);
  const [restockAmount, setRestockAmount] = useState<number>(1000);
  const [restockReason, setRestockReason] = useState('Fresh supplier batch');
  const [showRestockModal, setShowRestockModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const lowStockItems = ingredients.filter((i) => i.stock_qty <= i.low_stock_threshold);

  // Helper to determine category for an ingredient via recipes -> menu items -> categories
  const getCategoryForIngredient = (ing: Ingredient): string => {
    const matchingRecipes = recipes.filter((r) => r.ingredient_id === ing.id);
    for (const r of matchingRecipes) {
      const menuItem = menuItems.find((m) => m.id === r.menu_item_id);
      if (menuItem) {
        const cat = categories.find((c) => c.id === menuItem.category_id);
        if (cat) return cat.name;
      }
    }
    const nameLower = ing.name.toLowerCase();
    if (nameLower.includes('coffee') || nameLower.includes('espresso') || nameLower.includes('arabica')) return 'Coffee';
    if (nameLower.includes('milk') || nameLower.includes('dairy') || nameLower.includes('cream')) return 'Coffee';
    if (nameLower.includes('tea') || nameLower.includes('chai') || nameLower.includes('sugar')) return 'Tea';
    if (nameLower.includes('dough') || nameLower.includes('bread') || nameLower.includes('samosa') || nameLower.includes('potato')) return 'Snacks';
    return 'Pantry';
  };

  // Recharts Data Breakdown: Low-Stock vs. Categories
  const categoryBreakdownData = useMemo(() => {
    const map: Record<
      string,
      {
        category: string;
        total: number;
        healthy: number;
        lowStock: number;
        lowStockItems: { name: string; stock: number; threshold: number; unit: string }[];
      }
    > = {};

    ingredients.forEach((ing) => {
      const cat = getCategoryForIngredient(ing);
      if (!map[cat]) {
        map[cat] = {
          category: cat,
          total: 0,
          healthy: 0,
          lowStock: 0,
          lowStockItems: [],
        };
      }
      map[cat].total += 1;
      if (ing.stock_qty <= ing.low_stock_threshold) {
        map[cat].lowStock += 1;
        map[cat].lowStockItems.push({
          name: ing.name,
          stock: ing.stock_qty,
          threshold: ing.low_stock_threshold,
          unit: ing.unit,
        });
      } else {
        map[cat].healthy += 1;
      }
    });

    return Object.values(map);
  }, [ingredients, recipes, menuItems, categories]);

  const filteredIngredients = ingredients.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;
    if (selectedCategoryFilter !== 'all') {
      const itemCat = getCategoryForIngredient(item);
      return itemCat === selectedCategoryFilter;
    }
    return true;
  });

  const handleRestockSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canPerformAction(currentProfile?.role, 'edit_inventory')) {
      setToastMessage('Action Blocked: Cashiers do not have permission to restock inventory.');
      setTimeout(() => setToastMessage(null), 3000);
      return;
    }
    if (!restockModalItem || restockAmount <= 0) return;
    restockIngredient(restockModalItem.id, restockAmount, restockReason);
    setRestockModalItem(null);
  };

  const handleRestockOrderSuccess = (count: number) => {
    if (!canPerformAction(currentProfile?.role, 'edit_inventory')) {
      setToastMessage('Action Blocked: Cashiers do not have permission to place restock orders.');
      setTimeout(() => setToastMessage(null), 3000);
      return;
    }
    setToastMessage(`Successfully restocked ${count} inventory item${count > 1 ? 's' : ''}!`);
    setTimeout(() => setToastMessage(null), 3000);
  };

  return (
    <div className={`flex-1 flex flex-col h-[calc(100vh-100px)] overflow-hidden ${isServepoint ? 'bg-[#F6F5F2]' : 'bg-[#FFF9F2]'}`}>
      {/* Top Banner */}
      <div className={`p-4 bg-white border-b flex flex-wrap items-center justify-between gap-3 ${isServepoint ? 'border-[#E3E7E0]' : 'border-[#E9E0D6]'}`}>
        <div className="flex items-center gap-2.5">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isServepoint ? 'sp-surface text-[#0F3D3E]' : 'bg-[#FFF1E6] text-[#F97316]'}`}>
            <Boxes className="w-5 h-5" />
          </div>
          <div>
            <h2 className={`text-base font-bold leading-tight ${isServepoint ? 'text-[#1A1A1A]' : 'text-[#1C1917]'}`}>
              Inventory & Recipe Engine
            </h2>
            <div className={`text-xs ${isServepoint ? 'text-[#6B6B6B]' : 'text-[#57534E]'}`}>
              Automatic deduction when kitchen finishes orders • Audit trail
            </div>
          </div>
        </div>

        {/* Tab switchers */}
        <div className={`flex items-center gap-1 p-1 rounded-xl ${isServepoint ? 'bg-[#D9E2DD]' : 'bg-[#F5F0EB]'}`}>
          <button
            onClick={() => setActiveTab('stock')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'stock'
                ? isServepoint
                  ? 'bg-[#0F3D3E] text-white'
                  : 'bg-white text-[#1C1917] shadow-xs'
                : isServepoint
                  ? 'text-[#6B6B6B] hover:text-[#1A1A1A]'
                  : 'text-[#57534E] hover:text-[#1C1917]'
            }`}
          >
            <Boxes className="w-3.5 h-3.5" />
            <span>Stock Levels ({ingredients.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('recipes')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'recipes'
                ? isServepoint
                  ? 'bg-[#0F3D3E] text-white'
                  : 'bg-white text-[#1C1917] shadow-xs'
                : isServepoint
                  ? 'text-[#6B6B6B] hover:text-[#1A1A1A]'
                  : 'text-[#57534E] hover:text-[#1C1917]'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Recipes ({recipes.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'logs'
                ? isServepoint
                  ? 'bg-[#0F3D3E] text-white'
                  : 'bg-white text-[#1C1917] shadow-xs'
                : isServepoint
                  ? 'text-[#6B6B6B] hover:text-[#1A1A1A]'
                  : 'text-[#57534E] hover:text-[#1C1917]'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Audit Logs ({inventoryLogs.length})</span>
          </button>
        </div>
      </div>

      {/* Low stock warning banner if any */}
      {lowStockItems.length > 0 && activeTab === 'stock' && (
        <div className={`bg-[#FEF2F2] border-b px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 ${isServepoint ? 'border-[#B42318]/25' : 'border-[#FECACA]'}`}>
          <div className="flex items-center gap-2 text-xs text-[#B42318] font-medium">
            <AlertTriangle className="w-4 h-4 text-[#B42318] shrink-0" />
            <span>
              <strong>Low Stock Alert:</strong> {lowStockItems.map((i) => i.name).join(', ')} are at or below minimum threshold!
            </span>
          </div>

          <button
            type="button"
            onClick={() => setShowRestockModal(true)}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#B42318] hover:bg-[#991B1B] text-white text-xs font-bold shadow-xs transition-colors"
          >
            <ClipboardList className="w-3.5 h-3.5" />
            <span>Generate Restock Order List ({lowStockItems.length})</span>
          </button>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className={`border-b px-4 py-2 text-xs font-bold flex items-center justify-between animate-in fade-in ${
          isServepoint ? 'bg-[#E8F5EC] border-[#17803D]/25 text-[#17803D]' : 'bg-[#DCFCE7] border-[#86EFAC] text-[#15803D]'
        }`}>
          <div className="flex items-center gap-2">
            <CheckCircle2 className={`w-4 h-4 ${isServepoint ? 'text-[#17803D]' : 'text-[#15803D]'}`} />
            <span>{toastMessage}</span>
          </div>
          <button onClick={() => setToastMessage(null)} className={`hover:opacity-75 ${isServepoint ? 'text-[#17803D]' : 'text-[#15803D]'}`}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Tab 1: Stock Levels */}
        {activeTab === 'stock' && (
          <div className="space-y-4">
            {/* Recharts Summary Chart: Low-Stock Items vs Categories */}
            <div className={`bg-white rounded-2xl border p-4 shadow-xs ${isServepoint ? 'border-[#E3E7E0]' : 'border-[#E9E0D6]'}`}>
              <div className={`flex flex-wrap items-center justify-between gap-3 mb-3 border-b pb-3 ${isServepoint ? 'border-[#E3E7E0]' : 'border-[#F5F0EB]'}`}>
                <div className="flex items-center gap-2.5">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${isServepoint ? 'sp-surface text-[#0F3D3E]' : 'bg-orange-50 text-[#F97316]'}`}>
                    <BarChart3 className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className={`text-sm font-bold leading-tight flex items-center gap-2 ${isServepoint ? 'text-[#1A1A1A]' : 'text-[#1C1917]'}`}>
                      <span>Supply Chain Breakdown: Low-Stock Items vs. Categories</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                        isServepoint
                          ? 'bg-[#E8F5EC] text-[#17803D] border-[#17803D]/20'
                          : 'font-mono bg-emerald-50 text-emerald-700 border-emerald-200'
                      }`}>
                        Recharts Live
                      </span>
                    </h3>
                    <p className={`text-xs ${isServepoint ? 'text-[#6B6B6B]' : 'text-[#57534E]'}`}>
                      Aggregated stock health and replenish thresholds across menu categories at a glance.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Critical Category Tag */}
                  {lowStockItems.length > 0 && (
                    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#FEF2F2] text-[#B42318] text-xs font-bold border ${isServepoint ? 'border-[#B42318]/25' : 'border-[#FECACA]'}`}>
                      <TrendingDown className="w-3.5 h-3.5" />
                      <span>
                        {categoryBreakdownData.filter((c) => c.lowStock > 0).length} Categories Understocked
                      </span>
                    </div>
                  )}

                  <button
                    onClick={() => setIsChartCollapsed(!isChartCollapsed)}
                    className={`px-2.5 py-1 rounded-lg border text-xs font-semibold transition-colors ${isServepoint ? 'border-[#E3E7E0] hover:bg-[#F6F5F2] text-[#6B6B6B]' : 'border-[#E9E0D6] hover:bg-[#F5F0EB] text-[#57534E]'}`}
                  >
                    {isChartCollapsed ? 'Expand Chart' : 'Minimize'}
                  </button>
                </div>
              </div>

              {!isChartCollapsed && (
                <div>
                  {/* Recharts BarChart */}
                  <div className="h-64 w-full pt-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={categoryBreakdownData}
                        margin={{ top: 10, right: 20, left: -10, bottom: 20 }}
                        barCategoryGap={30}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke={isServepoint ? '#E3E7E0' : '#F5F0EB'} vertical={false} />
                        <XAxis
                          dataKey="category"
                          tick={{ fill: isServepoint ? '#6B6B6B' : '#57534E', fontSize: 11, fontWeight: 600 }}
                          stroke={isServepoint ? '#E3E7E0' : '#E9E0D6'}
                        />
                        <YAxis
                          allowDecimals={false}
                          tick={{ fill: isServepoint ? '#6B8579' : '#78716C', fontSize: 10 }}
                          stroke={isServepoint ? '#E3E7E0' : '#E9E0D6'}
                        />
                        <Tooltip
                          content={({ active, payload, label }) => {
                            if (active && payload && payload.length) {
                              const data = payload[0].payload;
                              return (
                                <div className={`p-3 rounded-xl shadow-xl text-xs max-w-xs animate-in fade-in duration-100 ${
                                  isServepoint ? 'bg-white text-[#1A1A1A] border border-[#E3E7E0]' : 'bg-[#1C1917] text-white border border-gray-700'
                                }`}>
                                  <div className={`font-bold text-sm mb-1.5 flex items-center justify-between gap-2 border-b pb-1 ${
                                    isServepoint ? 'text-[#0F3D3E] border-[#E3E7E0]' : 'text-[#F97316] border-gray-800'
                                  }`}>
                                    <span>{label} Category</span>
                                    <span className={`text-[10px] ${isServepoint ? 'text-[#6B8579]' : 'text-gray-400 font-mono'}`}>
                                      {data.total} items tracked
                                    </span>
                                  </div>
                                  <div className={`space-y-1 my-1.5 text-[11px] ${isServepoint ? '' : 'font-mono'}`}>
                                    <div className={`flex items-center justify-between ${isServepoint ? 'text-[#17803D]' : 'text-emerald-400'}`}>
                                      <span>Adequate Stock:</span>
                                      <span className="font-bold">{data.healthy}</span>
                                    </div>
                                    <div className={`flex items-center justify-between ${isServepoint ? 'text-[#B42318]' : 'text-rose-400'}`}>
                                      <span>Low-Stock Alert:</span>
                                      <span className="font-bold">{data.lowStock}</span>
                                    </div>
                                  </div>
                                  {data.lowStockItems && data.lowStockItems.length > 0 && (
                                    <div className={`mt-2 pt-1.5 border-t text-[10px] ${isServepoint ? 'border-[#E3E7E0]' : 'border-gray-800'}`}>
                                      <div className={`font-semibold mb-1 ${isServepoint ? 'text-[#B42318]' : 'text-rose-300'}`}>
                                        Action Required:
                                      </div>
                                      <ul className={`space-y-0.5 ${isServepoint ? 'text-[#6B6B6B]' : 'text-gray-300'}`}>
                                        {data.lowStockItems.map((item: any, idx: number) => (
                                          <li
                                            key={idx}
                                            className="flex items-center justify-between gap-2"
                                          >
                                            <span className="truncate">• {item.name}</span>
                                            <span className={`shrink-0 font-bold ${isServepoint ? 'text-[#B42318]' : 'font-mono text-rose-400'}`}>
                                              {item.stock}/{item.threshold} {item.unit}
                                            </span>
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Legend
                          verticalAlign="top"
                          align="right"
                          iconType="circle"
                          wrapperStyle={{ fontSize: 11, paddingBottom: 10 }}
                        />
                        <Bar
                          dataKey="healthy"
                          name="Adequate Stock"
                          fill={isServepoint ? '#17803D' : '#10B981'}
                          radius={[4, 4, 0, 0]}
                          maxBarSize={45}
                        />
                        <Bar
                          dataKey="lowStock"
                          name="Low Stock (Reorder Needed)"
                          fill={isServepoint ? '#B42318' : '#EF4444'}
                          radius={[4, 4, 0, 0]}
                          maxBarSize={45}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Category Filter Pills & Supply Chain Status */}
                  <div className={`mt-3 pt-3 border-t flex flex-wrap items-center justify-between gap-2 text-xs ${isServepoint ? 'border-[#E3E7E0]' : 'border-[#F5F0EB]'}`}>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`font-medium mr-1 flex items-center gap-1 ${isServepoint ? 'text-[#6B6B6B]' : 'text-[#57534E]'}`}>
                        <Filter className={`w-3 h-3 ${isServepoint ? 'text-[#6B8579]' : 'text-[#A8A29E]'}`} /> Filter Category:
                      </span>
                      <button
                        onClick={() => setSelectedCategoryFilter('all')}
                        className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
                          selectedCategoryFilter === 'all'
                            ? isServepoint
                              ? 'bg-[#0F3D3E] text-white'
                              : 'bg-[#1C1917] text-white'
                            : isServepoint
                              ? 'bg-white text-[#6B6B6B] border border-[#E3E7E0] hover:bg-[#F6F5F2]'
                              : 'bg-[#F5F0EB] text-[#57534E] hover:bg-[#E9E0D6]'
                        }`}
                      >
                        All Categories ({ingredients.length})
                      </button>

                      {categoryBreakdownData.map((cat) => {
                        const isSelected = selectedCategoryFilter === cat.category;
                        return (
                          <button
                            key={cat.category}
                            onClick={() => setSelectedCategoryFilter(cat.category)}
                            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-semibold transition-all ${
                              isSelected
                                ? isServepoint
                                  ? 'bg-[#0F3D3E] text-white'
                                  : 'bg-[#F97316] text-white'
                                : isServepoint
                                  ? 'bg-white text-[#6B6B6B] border border-[#E3E7E0] hover:bg-[#F6F5F2]'
                                  : 'bg-[#F5F0EB] text-[#57534E] hover:bg-[#E9E0D6]'
                            }`}
                          >
                            <span>{cat.category}</span>
                            {cat.lowStock > 0 ? (
                              <span
                                className={`text-[10px] px-1.5 rounded-full font-bold ${isServepoint ? '' : 'font-mono'} ${
                                  isSelected
                                    ? 'bg-black/30 text-white'
                                    : isServepoint
                                      ? 'bg-[#B42318]/10 text-[#B42318]'
                                      : 'bg-red-100 text-red-700'
                                }`}
                              >
                                {cat.lowStock} low
                              </span>
                            ) : (
                              <span
                                className={`text-[10px] px-1.5 rounded-full font-bold ${isServepoint ? '' : 'font-mono'} ${
                                  isSelected
                                    ? 'bg-black/30 text-white'
                                    : isServepoint
                                      ? 'bg-[#17803D]/10 text-[#17803D]'
                                      : 'bg-emerald-100 text-emerald-700'
                                }`}
                              >
                                {cat.healthy} ok
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    <div className={`text-[11px] italic ${isServepoint ? 'text-[#6B8579]' : 'text-[#78716C]'}`}>
                      Tip: Hover any bar for supplier reorder deficits.
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="relative max-w-xs w-full">
                <Search className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 ${isServepoint ? 'text-[#6B8579]' : 'text-[#A8A29E]'}`} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter ingredients..."
                  className={`w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border bg-white focus:outline-hidden ${
                    isServepoint ? 'border-[#E3E7E0] focus:border-[#B88E2F] text-[#1A1A1A]' : 'border-[#E9E0D6] text-[#1C1917]'
                  }`}
                />
              </div>

              <button
                type="button"
                onClick={() => setShowRestockModal(true)}
                className={`flex items-center gap-2 px-3.5 py-1.5 font-semibold text-xs transition-colors ${
                  isServepoint
                    ? 'sp-cta'
                    : 'rounded-xl bg-white border border-[#D5C9BD] hover:bg-[#F5EBE1] text-[#1C1917] shadow-xs'
                }`}
              >
                <ClipboardList className={`w-4 h-4 ${isServepoint ? 'text-[#0F3D3E]' : 'text-[#F97316]'}`} />
                <span>Generate Restock Order List</span>
                {lowStockItems.length > 0 && (
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold border ${
                    isServepoint ? 'bg-white/60 text-[#0F3D3E] border-[#0F3D3E]/20' : 'bg-[#FEF2F2] text-[#B42318] border-[#FECACA]'
                  }`}>
                    {lowStockItems.length}
                  </span>
                )}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3.5">
              {filteredIngredients.map((item) => {
                const isLow = item.stock_qty <= item.low_stock_threshold;
                const deficit = Math.max(0, item.low_stock_threshold - item.stock_qty);
                const percentage = Math.min(100, Math.round((item.stock_qty / (item.low_stock_threshold * 4)) * 100));

                return (
                  <div
                    key={item.id}
                    className={`rounded-2xl border p-4 shadow-xs flex flex-col justify-between transition-all ${
                      isLow
                        ? isServepoint
                          ? 'bg-gradient-to-b from-[#FEF2F2]/50 to-white border-[#B42318]/40 ring-1 ring-[#B42318]/25'
                          : 'bg-gradient-to-b from-[#FEF2F2]/50 to-white border-[#FCA5A5] ring-1 ring-[#FCA5A5]'
                        : isServepoint
                          ? 'bg-white border-[#E3E7E0] hover:border-[#B88E2F]'
                          : 'bg-white border-[#E9E0D6]'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <h3 className={`font-bold text-sm leading-tight ${isServepoint ? 'text-[#1A1A1A]' : 'text-[#1C1917]'}`}>
                            {item.name}
                          </h3>
                          <span className={`text-[11px] ${isServepoint ? 'text-[#6B6B6B]' : 'text-[#57534E]'}`}>Base Unit: {item.unit}</span>
                        </div>
                        {isLow ? (
                          <div className="flex flex-col items-end gap-1">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FEF2F2] text-[#B42318] flex items-center gap-1 shadow-2xs border ${isServepoint ? 'border-[#B42318]/25' : 'border-[#FECACA]'}`}>
                              <AlertTriangle className="w-3 h-3 text-[#B42318] shrink-0" />
                              <span>Low Stock</span>
                            </span>
                            <span className="text-[9px] font-semibold text-[#B42318]">
                              Deficit: {deficit} {item.unit}
                            </span>
                          </div>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#E8F5EC] text-[#17803D]">
                            Healthy
                          </span>
                        )}
                      </div>

                      <div className="my-3">
                        <div className="flex items-baseline justify-between mb-1">
                          <span className={`text-2xl font-bold ${isServepoint ? 'text-[#0F3D3E]' : 'font-mono text-[#1C1917]'}`}>
                            {item.stock_qty.toLocaleString()}
                            <span className={`text-sm font-normal ml-1 ${isServepoint ? 'text-[#6B6B6B]' : 'text-[#57534E]'}`}>
                              {item.unit}
                            </span>
                          </span>
                          <span className={`text-[11px] ${isServepoint ? 'text-[#6B8579]' : 'text-[#A8A29E]'}`}>
                            Threshold: {item.low_stock_threshold} {item.unit}
                          </span>
                        </div>

                        {/* Progress Bar */}
                        <div className={`w-full h-2 rounded-full overflow-hidden ${isServepoint ? 'bg-[#D9E2DD]' : 'bg-[#F5F0EB]'}`}>
                          <div
                            className={`h-full transition-all duration-300 ${
                              isLow ? 'bg-[#B42318]' : 'bg-[#17803D]'
                            }`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1.5 mt-2">
                      <button
                        onClick={() => {
                          setRestockModalItem(item);
                          setRestockAmount(item.unit === 'pcs' ? 20 : item.unit === 'kg' || item.unit === 'l' ? 5 : 1000);
                        }}
                        className={`w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl font-semibold text-xs transition-colors ${
                          isLow
                            ? isServepoint
                              ? 'bg-[#FEF2F2] hover:bg-[#B42318] text-[#B42318] hover:text-white border border-[#B42318]/25'
                              : 'bg-[#FEF2F2] hover:bg-[#B42318] text-[#B42318] hover:text-white border border-[#FECACA]'
                            : isServepoint
                              ? 'bg-[#D9E2DD] hover:bg-[#0F3D3E] text-[#0F3D3E] hover:text-white'
                              : 'bg-[#FFF1E6] hover:bg-[#F97316] text-[#F97316] hover:text-white'
                        }`}
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>{isLow ? 'Restock Immediately' : 'Restock Ingredient'}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab 2: Recipes */}
        {activeTab === 'recipes' && (
          <div className="space-y-4">
            <div className={`text-xs bg-white p-3 rounded-xl border ${isServepoint ? 'text-[#6B6B6B] border-[#E3E7E0]' : 'text-[#57534E] border-[#E9E0D6]'}`}>
              Recipes define how many raw ingredients are automatically subtracted from stock whenever a menu item is cooked and marked complete in the KDS.
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {menuItems.map((item) => {
                const itemRecipes = recipes.filter((r) => r.menu_item_id === item.id);

                return (
                  <div
                    key={item.id}
                    className={`bg-white rounded-2xl border p-4 shadow-xs space-y-3 ${isServepoint ? 'border-[#E3E7E0]' : 'border-[#E9E0D6]'}`}
                  >
                    <div className="flex items-center gap-3">
                      <img
                        src={item.image_url}
                        alt={item.name}
                        referrerPolicy="no-referrer"
                        className={`w-12 h-12 rounded-xl object-cover ${isServepoint ? 'bg-[#F6F5F2]' : 'bg-[#F5F0EB]'}`}
                      />
                      <div>
                        <h4 className={`font-bold text-sm leading-tight ${isServepoint ? 'text-[#1A1A1A]' : 'text-[#1C1917]'}`}>
                          {item.name}
                        </h4>
                        <div className={`text-xs font-bold ${isServepoint ? 'text-[#0F3D3E]' : 'text-[#57534E] font-mono'}`}>₹{item.price}</div>
                      </div>
                    </div>

                    <div className={`border-t pt-2 space-y-1.5 ${isServepoint ? 'border-[#E3E7E0]' : 'border-[#F5F0EB]'}`}>
                      <div className={`text-[11px] font-semibold uppercase tracking-wider ${isServepoint ? 'text-[#6B8579]' : 'text-[#A8A29E]'}`}>
                        Ingredient Consumption per Order:
                      </div>
                      {itemRecipes.length === 0 ? (
                        <div className={`text-xs italic ${isServepoint ? 'text-[#6B8579]' : 'text-[#A8A29E]'}`}>
                          No ingredient recipe mapped yet.
                        </div>
                      ) : (
                        itemRecipes.map((rec) => {
                          const ing = ingredients.find((i) => i.id === rec.ingredient_id);
                          return (
                            <div
                              key={rec.id}
                              className={`flex items-center justify-between text-xs p-2 rounded-lg border ${
                                isServepoint ? 'bg-[#F6F5F2] border-[#E3E7E0]' : 'bg-[#FFF9F2] border-[#F5E6D8]'
                              }`}
                            >
                              <span className={`font-medium ${isServepoint ? 'text-[#1A1A1A]' : 'text-[#1C1917]'}`}>
                                {ing?.name || 'Unknown'}
                              </span>
                              <span className={`font-bold ${isServepoint ? 'text-[#0F3D3E]' : 'font-mono text-[#F97316]'}`}>
                                {rec.qty_consumed} {ing?.unit}
                              </span>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab 3: Audit Logs */}
        {activeTab === 'logs' && (
          <div className={`bg-white rounded-2xl border overflow-hidden shadow-xs ${isServepoint ? 'border-[#E3E7E0]' : 'border-[#E9E0D6]'}`}>
            <div className={`p-3 border-b text-xs font-semibold flex items-center justify-between ${
              isServepoint ? 'bg-[#F6F5F2] border-[#E3E7E0] text-[#6B6B6B]' : 'bg-[#FFF9F2] border-[#E9E0D6] text-[#57534E]'
            }`}>
              <span>Inventory Audit Trail (Automatic Order Deductions & Restocks)</span>
              <span>{inventoryLogs.length} total events recorded</span>
            </div>

            <table className="w-full text-left text-xs">
              <thead className={`border-b text-[10px] uppercase tracking-wider ${
                isServepoint ? 'bg-[#F6F5F2] border-[#E3E7E0] text-[#6B6B6B]' : 'bg-[#FAFAFA] border-[#E9E0D6] text-[#A8A29E]'
              }`}>
                <tr>
                  <th className="py-2.5 px-4">Time</th>
                  <th className="py-2.5 px-4">Ingredient</th>
                  <th className="py-2.5 px-4">Change Qty</th>
                  <th className="py-2.5 px-4">Reason / Source</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isServepoint ? 'divide-[#E3E7E0]' : 'divide-[#F5F0EB]'}`}>
                {inventoryLogs.map((log) => {
                  const isPositive = log.change_qty > 0;
                  return (
                    <tr key={log.id} className={isServepoint ? 'hover:bg-[#F6F5F2]/60' : 'hover:bg-[#FFF9F2]/50'}>
                      <td className={`py-2.5 px-4 ${isServepoint ? 'text-[#6B6B6B]' : 'text-[#57534E] font-mono'}`}>
                        {new Date(log.created_at).toLocaleDateString()} {new Date(log.created_at).toLocaleTimeString()}
                      </td>
                      <td className={`py-2.5 px-4 font-semibold ${isServepoint ? 'text-[#1A1A1A]' : 'text-[#1C1917]'}`}>
                        {log.ingredient_name}
                      </td>
                      <td className="py-2.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1 font-bold ${isServepoint ? '' : 'font-mono'} ${
                            isPositive ? 'text-[#17803D]' : 'text-[#B42318]'
                          }`}
                        >
                          {isPositive ? (
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          ) : (
                            <ArrowDownRight className="w-3.5 h-3.5" />
                          )}
                          {isPositive ? `+${log.change_qty}` : log.change_qty}
                        </span>
                      </td>
                      <td className={`py-2.5 px-4 capitalize ${isServepoint ? 'text-[#6B6B6B]' : 'text-[#57534E]'}`}>
                        {log.reason === 'order_consumed' ? (
                          <span className={isServepoint ? 'text-[#967221]' : 'text-[#B45309]'}>
                            Kitchen KDS Auto-Deduct {log.ref_order_id ? `(#${log.ref_order_id.replace('ord-', '')})` : ''}
                          </span>
                        ) : (
                          <span className="text-[#17803D]">Manual Restock Intake</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Restock Modal */}
      {restockModalItem && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className={`bg-white rounded-2xl max-w-sm w-full border shadow-xl overflow-hidden p-5 ${isServepoint ? 'border-[#E3E7E0]' : 'border-[#E9E0D6]'}`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className={`font-bold text-sm ${isServepoint ? 'text-[#1A1A1A]' : 'text-[#1C1917]'}`}>
                Restock: {restockModalItem.name}
              </h3>
              <button
                onClick={() => setRestockModalItem(null)}
                className={isServepoint ? 'text-[#6B8579] hover:text-[#1A1A1A]' : 'text-[#A8A29E] hover:text-[#1C1917]'}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRestockSubmit} className="space-y-4">
              <div>
                <label className={`block text-xs font-semibold mb-1 ${isServepoint ? 'text-[#6B6B6B]' : 'text-[#57534E]'}`}>
                  Quantity to Add ({restockModalItem.unit})
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  value={restockAmount}
                  onChange={(e) => setRestockAmount(Number(e.target.value) || 0)}
                  className={`w-full px-3 py-2 text-base font-bold rounded-xl border focus:outline-hidden ${
                    isServepoint
                      ? 'border-[#E3E7E0] focus:border-[#B88E2F] focus:ring-1 focus:ring-[#B88E2F]/30 text-[#0F3D3E]'
                      : 'border-[#E9E0D6] focus:border-[#F97316] font-mono'
                  }`}
                />
              </div>

              <div>
                <label className={`block text-xs font-semibold mb-1 ${isServepoint ? 'text-[#6B6B6B]' : 'text-[#57534E]'}`}>
                  Restock Reason / Procurement Note
                </label>
                <input
                  type="text"
                  value={restockReason}
                  onChange={(e) => setRestockReason(e.target.value)}
                  placeholder="e.g. Weekly roaster shipment, dairy delivery"
                  className={`w-full px-3 py-2 text-xs rounded-xl border focus:outline-hidden ${
                    isServepoint
                      ? 'border-[#E3E7E0] focus:border-[#B88E2F] focus:ring-1 focus:ring-[#B88E2F]/30'
                      : 'border-[#E9E0D6] focus:border-[#F97316]'
                  }`}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRestockModalItem(null)}
                  className={`px-3 py-2 text-xs font-medium ${isServepoint ? 'text-[#6B6B6B]' : 'text-[#57534E]'}`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`px-4 py-2 text-xs font-semibold ${
                    isServepoint ? 'sp-cta' : 'bg-[#17803D] hover:bg-[#156f35] text-white rounded-xl shadow-xs'
                  }`}
                >
                  Confirm Restock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Restock Order List Generator Modal */}
      {showRestockModal && (
        <RestockOrderModal
          onClose={() => setShowRestockModal(false)}
          onRestockSuccess={handleRestockOrderSuccess}
        />
      )}
    </div>
  );
};
