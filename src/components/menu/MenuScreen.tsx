import React, { useState } from 'react';
import { useTsosStore } from '../../lib/store';
import { MenuItem, MenuItemVariant } from '../../types';
import {
  UtensilsCrossed,
  Plus,
  Edit2,
  Trash2,
  Check,
  X,
  Tag,
  ToggleLeft,
  ToggleRight,
  Layers,
  Search,
  AlertTriangle,
  CheckCircle2,
  ArrowUpDown,
} from 'lucide-react';

export const MenuScreen: React.FC = () => {
  const {
    categories,
    menuItems,
    addons,
    toggleItemAvailability,
    addMenuItem,
    updateMenuItem,
    deleteMenuItem,
    addCategory,
    location,
    themeMode,
  } = useTsosStore();
  const isServepoint = themeMode === 'servepoint';

  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<'name' | 'price_asc' | 'price_desc'>('name');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);

  // New Category input state
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: 100,
    category_id: categories[0]?.id || '',
    image_url: 'https://images.unsplash.com/photo-1510591509098-f4fdc6d0ff04?w=400&auto=format&fit=crop&q=80',
    is_veg: true,
    is_available: true,
    tax_rate_pct: 5,
    variants: [] as MenuItemVariant[],
    addon_ids: [] as string[],
  });

  const openAddModal = () => {
    setEditingItem(null);
    setFormData({
      name: '',
      description: '',
      price: 120,
      category_id: categories[0]?.id || '',
      image_url: 'https://images.unsplash.com/photo-1510591509098-f4fdc6d0ff04?w=400&auto=format&fit=crop&q=80',
      is_veg: true,
      is_available: true,
      tax_rate_pct: 5,
      variants: [],
      addon_ids: [],
    });
    setIsAddModalOpen(true);
  };

  const openEditModal = (item: MenuItem) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      description: item.description,
      price: item.price,
      category_id: item.category_id,
      image_url: item.image_url,
      is_veg: item.is_veg,
      is_available: item.is_available,
      tax_rate_pct: item.tax_rate_pct,
      variants: item.variants || [],
      addon_ids: item.addon_ids || [],
    });
    setIsAddModalOpen(true);
  };

  const handleSaveItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingItem) {
      updateMenuItem({
        ...editingItem,
        ...formData,
      });
    } else {
      addMenuItem({
        ...formData,
        location_id: location.id,
      });
    }
    setIsAddModalOpen(false);
  };

  const handleAddCategorySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    addCategory(newCategoryName.trim());
    setNewCategoryName('');
    setIsAddingCategory(false);
  };

  const filteredItems = menuItems
    .filter((item) => {
      if (selectedCategoryId !== 'all' && item.category_id !== selectedCategoryId) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return item.name.toLowerCase().includes(q) || item.description.toLowerCase().includes(q);
      }
      return true;
    })
    .sort((a, b) => {
      if (sortMode === 'price_asc') return a.price - b.price;
      if (sortMode === 'price_desc') return b.price - a.price;
      return a.name.localeCompare(b.name);
    });

  const availableCount = filteredItems.filter((i) => i.is_available).length;
  const soldOutCount = filteredItems.length - availableCount;

  return (
    <div className={`flex-1 flex flex-col h-[calc(100vh-100px)] overflow-hidden ${isServepoint ? 'bg-[#F6F5F2]' : 'bg-[#FFF9F2]'}`}>
      {/* Top Header */}
      <div className={`p-4 bg-white border-b flex flex-wrap items-center justify-between gap-3 ${isServepoint ? 'border-[#E3E7E0]' : 'border-[#E9E0D6]'}`}>
        <div className="flex items-center gap-2.5">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isServepoint ? 'sp-surface text-[#0F3D3E]' : 'bg-[#FFF1E6] text-[#F97316]'}`}>
            <UtensilsCrossed className="w-5 h-5" />
          </div>
          <div>
            <h2 className={`text-base font-bold leading-tight ${isServepoint ? 'text-[#1A1A1A]' : 'text-[#1C1917]'}`}>
              Menu & Catalog Management
            </h2>
            <div className={`text-xs ${isServepoint ? 'text-[#6B6B6B]' : 'text-[#57534E]'}`}>
              Categories, variant sizes, addons, and live availability toggles
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsAddingCategory(true)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold ${
              isServepoint
                ? 'border-[#E3E7E0] bg-white hover:bg-[#F6F5F2] text-[#0F3D3E]'
                : 'border-[#E9E0D6] bg-white hover:bg-[#F5F0EB] text-[#57534E]'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Category</span>
          </button>

          <button
            onClick={openAddModal}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold ${
              isServepoint ? 'sp-cta' : 'rounded-xl bg-[#F97316] hover:bg-[#EA580C] text-white shadow-xs'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Menu Item</span>
          </button>
        </div>
      </div>

      {/* Categories Bar & Search */}
      <div className={`px-4 py-2.5 bg-white border-b flex items-center justify-between gap-3 overflow-x-auto no-scrollbar ${isServepoint ? 'border-[#E3E7E0]' : 'border-[#E9E0D6]'}`}>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSelectedCategoryId('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              selectedCategoryId === 'all'
                ? isServepoint
                  ? 'bg-[#0F3D3E] text-white'
                  : 'bg-[#1C1917] text-white'
                : isServepoint
                  ? 'bg-white text-[#6B6B6B] border border-[#E3E7E0] hover:bg-[#F6F5F2]'
                  : 'bg-[#F5F0EB] text-[#57534E] hover:bg-[#E9E0D6]'
            }`}
          >
            All Categories ({menuItems.length})
          </button>

          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategoryId(cat.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                selectedCategoryId === cat.id
                  ? isServepoint
                    ? 'bg-[#0F3D3E] text-white'
                    : 'bg-[#F97316] text-white'
                  : isServepoint
                    ? 'bg-white text-[#6B6B6B] border border-[#E3E7E0] hover:bg-[#F6F5F2]'
                    : 'bg-[#F5F0EB] text-[#57534E] hover:bg-[#E9E0D6]'
              }`}
            >
              {cat.name} ({menuItems.filter((i) => i.category_id === cat.id).length})
            </button>
          ))}
        </div>

        <div className="relative max-w-xs w-full">
          <Search className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 ${isServepoint ? 'text-[#6B8579]' : 'text-[#A8A29E]'}`} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search items..."
            className={`w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border focus:outline-hidden ${
              isServepoint
                ? 'border-[#E3E7E0] bg-white focus:border-[#B88E2F] text-[#1A1A1A]'
                : 'border-[#E9E0D6] bg-[#FFF9F2] text-[#1C1917]'
            }`}
          />
        </div>
      </div>

      {/* Menu Items Table / Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Availability Summary Strip + Sort Control */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div
            className={`flex items-center gap-2.5 px-3.5 py-2 rounded-xl border text-xs shadow-xs ${
              isServepoint ? 'bg-white border-[#E3E7E0]' : 'bg-white border-[#E9E0D6]'
            }`}
          >
            <div
              className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
                soldOutCount > 0
                  ? isServepoint
                    ? 'bg-[#B88E2F]/15 text-[#967221]'
                    : 'bg-[#FFF1E6] text-[#F97316]'
                  : isServepoint
                    ? 'bg-[#D9E2DD] text-[#0F3D3E]'
                    : 'bg-[#E8F5EC] text-[#17803D]'
              }`}
            >
              {soldOutCount > 0 ? (
                <AlertTriangle className="w-3.5 h-3.5" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5" />
              )}
            </div>
            <span className={isServepoint ? 'text-[#6B6B6B]' : 'text-[#57534E]'}>
              <strong className={isServepoint ? 'text-[#0F3D3E]' : 'text-[#1C1917]'}>
                {availableCount} of {filteredItems.length}
              </strong>{' '}
              items available
            </span>
            <span className={isServepoint ? 'text-[#6B8579]' : 'text-[#A8A29E]'}>•</span>
            <span className={isServepoint ? 'text-[#6B6B6B]' : 'text-[#57534E]'}>
              <strong className={isServepoint ? 'text-[#B88E2F]' : 'text-[#F97316]'}>{soldOutCount}</strong> sold out
            </span>
          </div>

          <label
            className={`flex items-center gap-1.5 text-xs font-semibold ${
              isServepoint ? 'text-[#6B6B6B]' : 'text-[#57534E]'
            }`}
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
            <span className="sr-only">Sort menu items</span>
            <select
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as 'name' | 'price_asc' | 'price_desc')}
              className={`rounded-xl border px-2.5 py-1.5 text-xs bg-white focus:outline-hidden cursor-pointer ${
                isServepoint
                  ? 'border-[#E3E7E0] text-[#1A1A1A] focus:border-[#B88E2F] focus:ring-1 focus:ring-[#B88E2F]/30'
                  : 'border-[#E9E0D6] text-[#57534E]'
              }`}
            >
              <option value="name">Name A–Z</option>
              <option value="price_asc">Price Low–High</option>
              <option value="price_desc">Price High–Low</option>
            </select>
          </label>
        </div>

        <div className={`bg-white rounded-2xl border overflow-hidden shadow-xs ${isServepoint ? 'border-[#E3E7E0]' : 'border-[#E9E0D6]'}`}>
          <table className="w-full text-left text-xs">
            <thead className={`border-b text-[10px] font-semibold uppercase tracking-wider ${
              isServepoint ? 'bg-[#F6F5F2] border-[#E3E7E0] text-[#6B6B6B]' : 'bg-[#FFF9F2] border-[#E9E0D6] text-[#57534E]'
            }`}>
              <tr>
                <th className="py-3 px-4">Item</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Base Price</th>
                <th className="py-3 px-4">Variants & Addons</th>
                <th className="py-3 px-4">In Stock / Available</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isServepoint ? 'divide-[#E3E7E0]' : 'divide-[#F5F0EB]'}`}>
              {filteredItems.map((item) => {
                const cat = categories.find((c) => c.id === item.category_id);
                return (
                  <tr key={item.id} className={isServepoint ? 'hover:bg-[#F6F5F2]/60 transition-colors' : 'hover:bg-[#FFF9F2]/50 transition-colors'}>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={item.image_url}
                          alt={item.name}
                          referrerPolicy="no-referrer"
                          className={`w-10 h-10 rounded-xl object-cover ${isServepoint ? 'bg-[#F6F5F2]' : 'bg-[#F5F0EB]'}`}
                        />
                        <div>
                          <div className={`font-bold text-sm ${isServepoint ? 'text-[#1A1A1A]' : 'text-[#1C1917]'}`}>{item.name}</div>
                          <div className={`text-[11px] max-w-sm truncate ${isServepoint ? 'text-[#6B6B6B]' : 'text-[#57534E]'}`}>
                            {item.description}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className={`py-3 px-4 font-medium ${isServepoint ? 'text-[#1A1A1A]' : 'text-[#1C1917]'}`}>
                      {cat?.name || 'General'}
                    </td>

                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold ${
                          item.is_veg
                            ? 'bg-emerald-50 text-emerald-800'
                            : 'bg-red-50 text-red-800'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            item.is_veg ? 'bg-emerald-600' : 'bg-red-600'
                          }`}
                        />
                        {item.is_veg ? 'Veg' : 'Non-Veg'}
                      </span>
                    </td>

                    <td className={`py-3 px-4 font-bold text-sm ${isServepoint ? 'text-[#0F3D3E]' : 'font-mono text-[#1C1917]'}`}>
                      ₹{item.price}
                    </td>

                    <td className={`py-3 px-4 ${isServepoint ? 'text-[#6B6B6B]' : 'text-[#57534E]'}`}>
                      {item.variants && item.variants.length > 0 && (
                        <div className="text-[11px]">
                          <strong>Sizes:</strong> {item.variants.map((v) => v.name).join(', ')}
                        </div>
                      )}
                      {item.addon_ids && item.addon_ids.length > 0 && (
                        <div className={`text-[10px] ${isServepoint ? 'text-[#6B8579]' : 'text-[#A8A29E]'}`}>
                          {item.addon_ids.length} Addons linked
                        </div>
                      )}
                      {!item.variants?.length && !item.addon_ids?.length && (
                        <span className={isServepoint ? 'text-[#6B8579]' : 'text-[#A8A29E]'}>—</span>
                      )}
                    </td>

                    <td className="py-3 px-4">
                      <button
                        onClick={() => toggleItemAvailability(item.id)}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-all ${
                          item.is_available
                            ? 'bg-[#E8F5EC] text-[#17803D]'
                            : 'bg-[#FEF2F2] text-[#B42318]'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            item.is_available ? 'bg-[#17803D]' : 'bg-[#B42318]'
                          }`}
                        />
                        <span>{item.is_available ? 'In Stock' : '86 / Sold Out'}</span>
                      </button>
                    </td>

                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => openEditModal(item)}
                          className={`p-1.5 rounded-lg border bg-white ${
                            isServepoint
                              ? 'border-[#E3E7E0] hover:bg-[#F6F5F2] text-[#0F3D3E]'
                              : 'border-[#E9E0D6] hover:bg-[#F5F0EB] text-[#57534E]'
                          }`}
                          title="Edit Item"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            if (window.confirm(`Delete item "${item.name}"?`)) {
                              deleteMenuItem(item.id);
                            }
                          }}
                          className={`p-1.5 rounded-lg border bg-white ${
                            isServepoint
                              ? 'border-[#E3E7E0] hover:bg-[#FEF2F2] text-[#6B8579] hover:text-[#B42318]'
                              : 'border-[#E9E0D6] hover:bg-[#FEF2F2] text-[#A8A29E] hover:text-[#B42318]'
                          }`}
                          title="Delete Item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className={`bg-white rounded-2xl max-w-lg w-full border shadow-xl overflow-hidden flex flex-col max-h-[90vh] ${isServepoint ? 'border-[#E3E7E0]' : 'border-[#E9E0D6]'}`}>
            <div className={`p-4 border-b flex items-center justify-between ${isServepoint ? 'bg-[#F6F5F2] border-[#E3E7E0]' : 'bg-[#FFF9F2] border-[#E9E0D6]'}`}>
              <h3 className={`font-bold text-base ${isServepoint ? 'text-[#1A1A1A]' : 'text-[#1C1917]'}`}>
                {editingItem ? 'Edit Menu Item' : 'Add New Menu Item'}
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className={isServepoint ? 'text-[#6B8579] hover:text-[#1A1A1A]' : 'text-[#A8A29E] hover:text-[#1C1917]'}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="p-5 overflow-y-auto space-y-4">
              <div>
                <label className={`block text-xs font-semibold mb-1 ${isServepoint ? 'text-[#6B6B6B]' : 'text-[#57534E]'}`}>
                  Item Name
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Masala Chai, Cold Brew, Paneer Tikka Roll"
                  className={`w-full px-3 py-2 text-sm rounded-xl border focus:outline-hidden ${
                    isServepoint
                      ? 'border-[#E3E7E0] focus:border-[#B88E2F] focus:ring-1 focus:ring-[#B88E2F]/30'
                      : 'border-[#E9E0D6] focus:border-[#F97316]'
                  }`}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block text-xs font-semibold mb-1 ${isServepoint ? 'text-[#6B6B6B]' : 'text-[#57534E]'}`}>
                    Category
                  </label>
                  <select
                    value={formData.category_id}
                    onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                    className={`w-full px-3 py-2 text-sm rounded-xl border bg-white focus:outline-hidden ${
                      isServepoint
                        ? 'border-[#E3E7E0] focus:border-[#B88E2F] focus:ring-1 focus:ring-[#B88E2F]/30'
                        : 'border-[#E9E0D6] focus:border-[#F97316]'
                    }`}
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={`block text-xs font-semibold mb-1 ${isServepoint ? 'text-[#6B6B6B]' : 'text-[#57534E]'}`}>
                    Base Price (₹)
                  </label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) || 0 })}
                    className={`w-full px-3 py-2 text-sm font-bold rounded-xl border focus:outline-hidden ${
                      isServepoint
                        ? 'border-[#E3E7E0] focus:border-[#B88E2F] focus:ring-1 focus:ring-[#B88E2F]/30 text-[#0F3D3E]'
                        : 'border-[#E9E0D6] focus:border-[#F97316] font-mono'
                    }`}
                  />
                </div>
              </div>

              <div>
                <label className={`block text-xs font-semibold mb-1 ${isServepoint ? 'text-[#6B6B6B]' : 'text-[#57534E]'}`}>
                  Description
                </label>
                <textarea
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Appetizing description for customers and POS staff..."
                  className={`w-full px-3 py-2 text-xs rounded-xl border focus:outline-hidden ${
                    isServepoint
                      ? 'border-[#E3E7E0] focus:border-[#B88E2F] focus:ring-1 focus:ring-[#B88E2F]/30'
                      : 'border-[#E9E0D6] focus:border-[#F97316]'
                  }`}
                />
              </div>

              <div>
                <label className={`block text-xs font-semibold mb-1 ${isServepoint ? 'text-[#6B6B6B]' : 'text-[#57534E]'}`}>
                  Image URL
                </label>
                <input
                  type="url"
                  value={formData.image_url}
                  onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                  placeholder="https://images.unsplash.com/..."
                  className={`w-full px-3 py-2 text-xs rounded-xl border focus:outline-hidden ${
                    isServepoint
                      ? 'border-[#E3E7E0] focus:border-[#B88E2F] focus:ring-1 focus:ring-[#B88E2F]/30'
                      : 'border-[#E9E0D6] focus:border-[#F97316]'
                  }`}
                />
              </div>

              <div className="flex items-center gap-6 pt-2">
                <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_veg}
                    onChange={(e) => setFormData({ ...formData, is_veg: e.target.checked })}
                    className="rounded-sm text-[#17803D] focus:ring-0"
                  />
                  <span>Pure Veg Item</span>
                </label>

                <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_available}
                    onChange={(e) => setFormData({ ...formData, is_available: e.target.checked })}
                    className={isServepoint ? 'rounded-sm text-[#B88E2F] focus:ring-0' : 'rounded-sm text-[#F97316] focus:ring-0'}
                  />
                  <span>Available in POS</span>
                </label>
              </div>

              <div className={`p-4 border-t flex justify-end gap-2 -mx-5 -mb-5 mt-4 ${isServepoint ? 'bg-[#F6F5F2] border-[#E3E7E0]' : 'bg-[#FFF9F2] border-[#E9E0D6]'}`}>
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className={`px-4 py-2 text-xs font-medium ${isServepoint ? 'text-[#6B6B6B]' : 'text-[#57534E]'}`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`px-5 py-2 text-xs font-semibold ${
                    isServepoint ? 'sp-cta' : 'bg-[#F97316] hover:bg-[#EA580C] text-white rounded-xl shadow-xs'
                  }`}
                >
                  Save Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Category Modal */}
      {isAddingCategory && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className={`bg-white rounded-2xl max-w-xs w-full border p-5 shadow-xl ${isServepoint ? 'border-[#E3E7E0]' : 'border-[#E9E0D6]'}`}>
            <h3 className={`font-bold text-sm mb-3 ${isServepoint ? 'text-[#1A1A1A]' : 'text-[#1C1917]'}`}>Add Menu Category</h3>
            <form onSubmit={handleAddCategorySubmit} className="space-y-3">
              <input
                type="text"
                autoFocus
                required
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="e.g. Cold Brews, Desserts"
                className={`w-full px-3 py-2 text-xs rounded-xl border focus:outline-hidden ${
                  isServepoint
                    ? 'border-[#E3E7E0] focus:border-[#B88E2F] focus:ring-1 focus:ring-[#B88E2F]/30'
                    : 'border-[#E9E0D6] focus:border-[#F97316]'
                }`}
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddingCategory(false)}
                  className={`px-3 py-1.5 text-xs ${isServepoint ? 'text-[#6B6B6B]' : 'text-[#57534E]'}`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`px-4 py-1.5 text-xs font-semibold rounded-xl ${
                    isServepoint ? 'bg-[#0F3D3E] text-white hover:bg-[#0B3132]' : 'bg-[#1C1917] text-white'
                  }`}
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
