import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BookOpenText,
  Check,
  ChevronDown,
  ClipboardList,
  Copy,
  Layers,
  Loader2,
  Minus,
  Package,
  PackagePlus,
  Pencil,
  Plus,
  RefreshCw,
  ShoppingBasket,
  Trash2,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import {
  createInventoryItem,
  deleteInventoryItem,
  fetchDeductionWindow,
  fetchInventory,
  fetchMenuItems,
  fetchRecentDeductions,
  fetchRecipeLines,
  restockInventoryItem,
  setRecipeLines,
  subscribeInventoryRealtime,
  updateInventoryItem,
  type InventoryItem,
  type RealtimeState,
  type RecipeLine,
  type StockDeduction,
} from '../../lib/api';
import { formatMoney } from '../../lib/prefs';
import { downloadCsv } from '../../lib/csv';
import { useTenant } from '../../lib/tenant';
import type { MenuItem } from '../../types';

/**
 * Inventory (v5.4.0 — NOVA stock parity, migration 015 engine).
 *
 * The board answers four questions at a glance:
 *   1. STOCK — what's on the shelf (level bars vs reorder point), with
 *      restock / edit / delete and the recent-deduction audit feed.
 *   2. RECIPES — what one serve of each menu item consumes. No recipe ⇒
 *      that item moves no stock (stated honestly in the UI).
 *   3. REORDER — what to buy this week: the stock_deductions ledger prices
 *      each SKU's burn per day (last 14 days), converts to days-left meters
 *      and a 7-day-cover shopping list with estimated cost (copy/CSV).
 *   4. LIVE — the engine deducts the moment a ticket hits `preparing`
 *      (single-engine rule: trg_orders_deduct_stock is THE deduction path);
 *      realtime keeps this board moving while tickets fire.
 *
 * Data truth: inventory_items / recipe_lines / stock_deductions on the cloud.
 * Stock going negative is allowed (real cafes oversell) — rendered red.
 */

type TabKey = 'stock' | 'recipes' | 'reorder';

/** Burn-rate window for reorder suggestions (ledger days). */
const REORDER_WINDOW_DAYS = 14;
/** Days of cover the shopping list buys (suggested = burn × this − stock). */
const REORDER_COVER_DAYS = 7;

const UNITS = ['g', 'kg', 'ml', 'l', 'pc'] as const;

const PILL =
  'h-11 w-full appearance-none rounded-full border border-[#E3E7E0] bg-white pl-4 pr-9 text-[13px] font-medium text-[#1A1A1A] transition hover:border-[#C9CFC9] focus:border-[#B88E2F] focus:outline-none focus:ring-2 focus:ring-[#B88E2F]/25';

function fmtQty(q: number): string {
  return Number(q).toLocaleString('en-IN', { maximumFractionDigits: 3 });
}

/** Level tone: red at/below zero, amber at/below reorder point, green above. */
function levelTone(stock: number, reorder: number): {
  bar: string;
  text: string;
  label: string;
} {
  if (stock <= 0) return { bar: '#B3261E', text: 'text-[#B3261E]', label: 'Out of stock' };
  if (stock <= reorder)
    return { bar: '#B88E2F', text: 'text-[#8A5A00]', label: 'Low stock' };
  return { bar: '#2E7D32', text: 'text-[#2E7D32]', label: 'Healthy' };
}

/* ─────────────────────────────── screen ────────────────────────────────── */

export const InventoryScreen: React.FC = () => {
  const [attempt, setAttempt] = useState(0);
  return <InventoryInner key={attempt} onTenantRetry={() => setAttempt((a) => a + 1)} />;
};

const InventoryInner: React.FC<{ onTenantRetry: () => void }> = ({ onTenantRetry }) => {
  const { tenantId, loading: tenantLoading, error: tenantError } = useTenant();
  const [tab, setTab] = useState<TabKey>('stock');
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [recipes, setRecipes] = useState<RecipeLine[]>([]);
  const [deductions, setDeductions] = useState<StockDeduction[]>([]);
  const [dedWindow, setDedWindow] = useState<StockDeduction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rt, setRt] = useState<RealtimeState>('connecting');
  const [busyId, setBusyId] = useState<string | null>(null);

  // dialog state
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<InventoryItem | null>(null);
  const [restockFor, setRestockFor] = useState<{ item: InventoryItem; suggested: number | null } | null>(null);
  const [deleteArm, setDeleteArm] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!tenantId) return;
    setError(null);
    try {
      const [inv, mi, rl, sd, sdw] = await Promise.all([
        fetchInventory(tenantId),
        fetchMenuItems(tenantId),
        fetchRecipeLines(tenantId),
        fetchRecentDeductions(tenantId, 12),
        fetchDeductionWindow(tenantId, REORDER_WINDOW_DAYS),
      ]);
      setItems(inv);
      setMenuItems(mi);
      setRecipes(rl);
      setDeductions(sd);
      setDedWindow(sdw);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load inventory from the cloud.');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [tenantId, load]);

  useEffect(() => {
    if (!tenantId) return;
    const unsub = subscribeInventoryRealtime(tenantId, () => void load(), setRt);
    const poll = window.setInterval(() => void load(), 30_000);
    return () => {
      unsub();
      window.clearInterval(poll);
    };
  }, [tenantId, load]);

  const stats = useMemo(() => {
    const low = items.filter((i) => i.current_stock > 0 && i.current_stock <= i.reorder_point).length;
    const out = items.filter((i) => i.current_stock <= 0).length;
    const value = items.reduce((n, i) => n + i.current_stock * Number(i.cost_per_unit ?? 0), 0);
    return { low, out, value };
  }, [items]);

  /* mutations ─────────────────────────────────────────────────────────── */
  const doRestock = useCallback(
    async (item: InventoryItem, qty: number) => {
      setBusyId(item.id);
      setError(null);
      try {
        await restockInventoryItem(item.id, qty);
        setRestockFor(null);
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not restock.');
      } finally {
        setBusyId(null);
      }
    },
    [load]
  );

  const doDelete = useCallback(
    async (item: InventoryItem) => {
      setBusyId(item.id);
      setError(null);
      try {
        await deleteInventoryItem(item.id);
        setDeleteArm(null);
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not delete the ingredient.');
      } finally {
        setBusyId(null);
      }
    },
    [load]
  );

  const saveEditor = useCallback(
    async (input: {
      name: string;
      unit: string;
      currentStock: number;
      reorderPoint: number;
      costPerUnit: number | null;
    }) => {
      setError(null);
      try {
        if (editing) {
          await updateInventoryItem(editing.id, {
            name: input.name,
            unit: input.unit,
            current_stock: input.currentStock,
            reorder_point: input.reorderPoint,
            cost_per_unit: input.costPerUnit,
          });
        } else if (tenantId) {
          await createInventoryItem(tenantId, input);
        }
        setEditorOpen(false);
        setEditing(null);
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not save the ingredient.');
      }
    },
    [editing, tenantId, load]
  );

  const saveRecipe = useCallback(
    async (menuItemId: string, lines: { inventory_item_id: string; qty_per_serve: number }[]) => {
      if (!tenantId) return;
      setError(null);
      try {
        await setRecipeLines(tenantId, menuItemId, lines);
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not save the recipe.');
      }
    },
    [tenantId, load]
  );

  const retry = useCallback(() => {
    setLoading(true);
    void load();
  }, [load]);

  if (tenantLoading) return <InventorySkeleton />;
  if (tenantError)
    return (
      <div className="p-4">
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-2xl border border-[#F0C4BE] bg-[#FEF2F2] px-4 py-3.5"
        >
          <p className="text-[13px] font-semibold text-[#B42318]">{tenantError}</p>
          <button
            onClick={onTenantRetry}
            className="h-11 shrink-0 rounded-lg bg-[#B42318] px-4 text-[12.5px] font-semibold text-white transition hover:bg-[#8F1C13]"
          >
            Retry
          </button>
        </div>
      </div>
    );
  if (!tenantId)
    return (
      <div className="p-4">
        <div className="rounded-2xl border border-[#E3E7E0] bg-white px-4 py-6 text-center text-[13px] text-[#6B6B6B]">
          No workspace is linked to this account.
        </div>
      </div>
    );

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* ── header ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#EAF0EC] text-[#0F3D3E]">
            <Package size={17} aria-hidden />
          </span>
          <div className="min-w-0">
            <h1 className="text-[20px] font-bold leading-tight text-[#1A1A1A]">Inventory</h1>
            <p className="truncate text-[11.5px] text-[#6B6B6B]">
              The shelf, the recipes, and the stock that moves when the kitchen fires
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="flex items-center gap-1.5 text-[11px] font-bold"
            title={
              rt === 'live'
                ? 'Realtime connected'
                : rt === 'connecting'
                  ? 'Connecting…'
                  : 'Realtime offline — polling'
            }
          >
            {rt === 'offline' ? (
              <WifiOff size={12} className="text-[#969696]" aria-hidden />
            ) : (
              <Wifi size={12} className={rt === 'live' ? 'text-[#2E7D32]' : 'text-[#B9C4BE]'} aria-hidden />
            )}
            <span className={rt === 'live' ? 'text-[#2E7D32]' : 'text-[#969696]'}>
              {rt === 'live' ? 'Live' : rt === 'connecting' ? '…' : 'Poll'}
            </span>
          </span>
          <button
            onClick={() => {
              setEditing(null);
              setEditorOpen(true);
            }}
            className="flex h-11 items-center gap-1.5 rounded-xl bg-[#B88E2F] px-4 text-[12.5px] font-bold text-white transition hover:bg-[#967221]"
          >
            <PackagePlus size={15} aria-hidden />
            Add ingredient
          </button>
          <button
            onClick={retry}
            disabled={loading}
            aria-label="Refresh inventory"
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#E3E7E0] bg-white text-[#0F3D3E] transition hover:border-[#B88E2F] hover:text-[#B88E2F] disabled:opacity-50"
          >
            <RefreshCw size={15} aria-hidden className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-xl border border-[#F0C4BE] bg-[#FEF2F2] px-3.5 py-2.5"
        >
          <p className="text-[12px] font-medium text-[#B42318]">{error}</p>
          <button
            onClick={() => setError(null)}
            aria-label="Dismiss error"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-[#B42318] hover:bg-[#FCEBEA]"
          >
            <X size={14} aria-hidden />
          </button>
        </div>
      )}

      {/* ── low-stock alert strip ── */}
      {stats.low + stats.out > 0 && (
        <div className="flex items-center gap-2.5 rounded-2xl border border-[#F0D9A8] bg-[#FFF9EE] px-4 py-3">
          <AlertTriangle size={16} className="shrink-0 text-[#B88E2F]" aria-hidden />
          <p className="min-w-0 flex-1 text-[12.5px] font-semibold text-[#8A5A00]">
            {stats.out > 0 && (
              <>
                {stats.out} ingredient{stats.out === 1 ? '' : 's'} out of stock
                {stats.low > 0 ? ' · ' : ''}
              </>
            )}
            {stats.low > 0 && (
              <>
                {stats.low} at or below reorder point — restock before the rush
              </>
            )}
          </p>
        </div>
      )}

      {/* ── stat strip ── */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Ingredients" value={String(items.length)} sub="SKUs on the shelf" tone="#0F3D3E" />
        <StatCard label="Low stock" value={String(stats.low)} sub="below reorder point" tone="#8A5A00" />
        <StatCard label="Out of stock" value={String(stats.out)} sub="need ordering now" tone="#B3261E" />
        <StatCard label="Stock value" value={formatMoney(stats.value)} sub="qty × unit cost" tone="#0F3D3E" />
      </div>

      {/* ── tabs ── */}
      <div className="flex w-fit rounded-full border border-[#E3E7E0] bg-white p-1" role="tablist" aria-label="Inventory tabs">
        <button
          role="tab"
          aria-selected={tab === 'stock'}
          onClick={() => setTab('stock')}
          className={`flex h-9 items-center gap-1.5 rounded-full px-4 text-[12.5px] font-bold transition ${
            tab === 'stock' ? 'bg-[#0F3D3E] text-white' : 'text-[#6B6B6B] hover:text-[#1A1A1A]'
          }`}
        >
          <Layers size={13} aria-hidden />
          Stock
        </button>
        <button
          role="tab"
          aria-selected={tab === 'recipes'}
          onClick={() => setTab('recipes')}
          className={`flex h-9 items-center gap-1.5 rounded-full px-4 text-[12.5px] font-bold transition ${
            tab === 'recipes' ? 'bg-[#0F3D3E] text-white' : 'text-[#6B6B6B] hover:text-[#1A1A1A]'
          }`}
        >
          <BookOpenText size={13} aria-hidden />
          Recipes
        </button>
        <button
          role="tab"
          aria-selected={tab === 'reorder'}
          onClick={() => setTab('reorder')}
          className={`flex h-9 items-center gap-1.5 rounded-full px-4 text-[12.5px] font-bold transition ${
            tab === 'reorder' ? 'bg-[#0F3D3E] text-white' : 'text-[#6B6B6B] hover:text-[#1A1A1A]'
          }`}
        >
          <ShoppingBasket size={13} aria-hidden />
          Reorder
        </button>
      </div>

      {loading && items.length === 0 ? (
        <div className="flex flex-col gap-2.5" aria-busy="true">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="sp-skeleton h-[72px] rounded-2xl" />
          ))}
        </div>
      ) : tab === 'stock' ? (
        <>
          {items.length === 0 ? (
            <div className="sp-card flex flex-col items-center justify-center gap-2 px-4 py-14 text-center">
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#D9E2DD]">
                <Package size={26} className="text-[#0F3D3E]" aria-hidden />
              </span>
              <h2 className="mt-1 text-[15px] font-bold text-[#1A1A1A]">The shelf is empty</h2>
              <p className="max-w-sm text-[12.5px] text-[#6B6B6B]">
                Add ingredients (beans, milk, cups…), link them to menu items under Recipes, and
                stock will deduct itself every time the kitchen starts a ticket.
              </p>
            </div>
          ) : (
            <ul className="flex flex-col gap-2.5" aria-label="Ingredient stock list">
              {items.map((it) => {
                const tone = levelTone(it.current_stock, it.reorder_point);
                const max = Math.max(it.reorder_point * 2, it.current_stock, 1);
                const pct = Math.min(100, (it.current_stock / max) * 100);
                const busy = busyId === it.id;
                return (
                  <li
                    key={it.id}
                    className="sp-card flex flex-wrap items-center gap-3 p-4"
                    aria-label={`${it.name}: ${fmtQty(it.current_stock)} ${it.unit}`}
                  >
                    <div className="min-w-0 flex-1 basis-52">
                      <div className="flex items-center gap-2">
                        <h3 className="truncate text-[14px] font-bold text-[#1A1A1A]">{it.name}</h3>
                        <span className="shrink-0 rounded-full bg-[#EAF0EC] px-2 py-0.5 text-[10.5px] font-bold text-[#0F3D3E]">
                          {it.unit}
                        </span>
                        <span className={`shrink-0 text-[10.5px] font-bold ${tone.text}`}>
                          {tone.label}
                        </span>
                      </div>
                      <div className="mt-1.5 flex items-center gap-2">
                        <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-[#EAF0EC]" aria-hidden>
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${Math.max(2, pct)}%`, backgroundColor: tone.bar }}
                          />
                        </div>
                        <span className="shrink-0 text-[11px] tabular-nums text-[#6B6B6B]">
                          <span className={`font-bold ${tone.text}`}>{fmtQty(it.current_stock)}</span>
                          {' / reorder '}
                          {fmtQty(it.reorder_point)} {it.unit}
                        </span>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="hidden text-[11px] text-[#969696] sm:block">
                        {it.cost_per_unit != null ? `${formatMoney(Number(it.cost_per_unit))}/${it.unit}` : 'no cost set'}
                      </span>
                      <button
                        onClick={() => setRestockFor({ item: it, suggested: null })}
                        disabled={busy}
                        aria-label={`Restock ${it.name}`}
                        className="flex h-9 items-center gap-1 rounded-lg border border-[#E3E7E0] bg-white px-2.5 text-[11.5px] font-bold text-[#0F3D3E] transition hover:border-[#2E7D32] hover:text-[#2E7D32] disabled:opacity-50"
                      >
                        <PackagePlus size={12} aria-hidden />
                        Restock
                      </button>
                      <button
                        onClick={() => {
                          setEditing(it);
                          setEditorOpen(true);
                        }}
                        disabled={busy}
                        aria-label={`Edit ${it.name}`}
                        className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#E3E7E0] bg-white text-[#0F3D3E] transition hover:border-[#B88E2F] hover:text-[#B88E2F] disabled:opacity-50"
                      >
                        <Pencil size={13} aria-hidden />
                      </button>
                      <button
                        onClick={() => (deleteArm === it.id ? void doDelete(it) : setDeleteArm(it.id))}
                        disabled={busy}
                        aria-label={deleteArm === it.id ? `Confirm deleting ${it.name}` : `Delete ${it.name}`}
                        title={deleteArm === it.id ? 'Tap again to confirm' : 'Delete ingredient'}
                        className={`flex h-9 items-center gap-1 rounded-lg border px-2.5 text-[11.5px] font-bold transition disabled:opacity-50 ${
                          deleteArm === it.id
                            ? 'border-[#B3261E] bg-[#B3261E] text-white'
                            : 'border-[#E3E7E0] bg-white text-[#6B6B6B] hover:border-[#B3261E] hover:text-[#B3261E]'
                        }`}
                      >
                        <Trash2 size={12} aria-hidden />
                        {deleteArm === it.id ? 'Sure?' : ''}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {/* ── recent deductions — the audit feed ── */}
          {deductions.length > 0 && (
            <section className="sp-card p-5" aria-label="Recent stock deductions">
              <div className="mb-3 flex items-center gap-2">
                <ClipboardList size={15} className="text-[#0F3D3E]" aria-hidden />
                <h2 className="text-[14px] font-bold text-[#1A1A1A]">Recent deductions</h2>
                <span className="text-[11px] text-[#969696]">auto — when tickets fire to the pan</span>
              </div>
              <ul className="flex flex-col divide-y divide-[#E3E7E0]">
                {deductions.map((d) => {
                  const ing = items.find((i) => i.id === d.inventory_item_id);
                  const ord = menuItems.length; // order numbers live on orders; ledger keeps ids
                  void ord;
                  return (
                    <li key={d.id} className="flex items-center justify-between gap-3 py-2">
                      <span className="flex min-w-0 items-center gap-2">
                        <Minus size={12} className="shrink-0 text-[#B3261E]" aria-hidden />
                        <span className="truncate text-[12.5px] font-semibold text-[#1A1A1A]">
                          {ing ? ing.name : 'Ingredient'}
                        </span>
                      </span>
                      <span className="shrink-0 text-[11.5px] tabular-nums text-[#6B6B6B]">
                        −{fmtQty(Number(d.qty))} {ing?.unit ?? ''} ·{' '}
                        {new Date(d.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </>
      ) : tab === 'recipes' ? (
        <RecipeBoard
          items={items}
          menuItems={menuItems}
          recipes={recipes}
          onSave={saveRecipe}
        />
      ) : (
        <ReorderBoard
          items={items}
          deductions={dedWindow}
          onRestock={(item, suggested) => setRestockFor({ item, suggested })}
        />
      )}

      {/* ── dialogs ── */}
      {editorOpen && (
        <IngredientDialog
          editing={editing}
          onClose={() => {
            setEditorOpen(false);
            setEditing(null);
          }}
          onSave={saveEditor}
        />
      )}
      {restockFor && (
        <RestockDialog
          item={restockFor.item}
          suggestedQty={restockFor.suggested}
          busy={busyId === restockFor.item.id}
          onClose={() => setRestockFor(null)}
          onConfirm={(qty) => void doRestock(restockFor.item, qty)}
        />
      )}
    </div>
  );
};

/* ─────────────────────────── small pieces ─────────────────────────────── */

const StatCard: React.FC<{ label: string; value: string; sub?: string; tone: string }> = ({
  label,
  value,
  sub,
  tone,
}) => (
  <section className="sp-card p-4" aria-label={label}>
    <p className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-[#969696]">{label}</p>
    <p
      className="mt-1.5 truncate text-[19px] font-extrabold tabular-nums leading-tight"
      style={{ color: tone }}
    >
      {value}
    </p>
    {sub ? <p className="mt-0.5 truncate text-[10.5px] text-[#969696]">{sub}</p> : null}
  </section>
);

const InventorySkeleton: React.FC = () => (
  <div className="flex flex-col gap-4 p-4" aria-busy="true" aria-label="Loading inventory">
    <div className="sp-skeleton h-14 w-80 rounded-2xl" />
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="sp-skeleton h-[86px] rounded-2xl" />
      ))}
    </div>
    <div className="sp-skeleton h-12 w-48 rounded-full" />
    {Array.from({ length: 3 }).map((_, i) => (
      <div key={i} className="sp-skeleton h-[72px] rounded-2xl" />
    ))}
  </div>
);

/* ─────────────────────────── recipes board ────────────────────────────── */

const RecipeBoard: React.FC<{
  items: InventoryItem[];
  menuItems: MenuItem[];
  recipes: RecipeLine[];
  onSave: (menuItemId: string, lines: { inventory_item_id: string; qty_per_serve: number }[]) => Promise<void>;
}> = ({ items, menuItems, recipes, onSave }) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ inventory_item_id: string; qty_per_serve: number }[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [addIng, setAddIng] = useState('');
  const [addQty, setAddQty] = useState('');

  const effectiveId = selectedId ?? menuItems[0]?.id ?? null;
  const selected = menuItems.find((m) => m.id === effectiveId) || null;

  // Load the saved recipe into the draft whenever the picked item changes.
  useEffect(() => {
    if (!effectiveId) return;
    const saved = recipes
      .filter((r) => r.menu_item_id === effectiveId)
      .map((r) => ({ inventory_item_id: r.inventory_item_id, qty_per_serve: Number(r.qty_per_serve) }));
    setDraft(saved);
    setDirty(false);
  }, [effectiveId, recipes]);

  const ingById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const recipeCount = useMemo(() => {
    const m = new Map<string, number>();
    recipes.forEach((r) => m.set(r.menu_item_id, (m.get(r.menu_item_id) || 0) + 1));
    return m;
  }, [recipes]);

  const addLine = () => {
    if (!addIng) return;
    const qty = Number(addQty);
    if (!(qty > 0)) return;
    setDraft((d) => [
      ...d.filter((l) => l.inventory_item_id !== addIng),
      { inventory_item_id: addIng, qty_per_serve: qty },
    ]);
    setDirty(true);
    setAddIng('');
    setAddQty('');
  };

  const save = async () => {
    if (!effectiveId) return;
    setSaving(true);
    await onSave(effectiveId, draft);
    setSaving(false);
  };

  if (menuItems.length === 0) {
    return (
      <div className="sp-card px-4 py-10 text-center text-[12.5px] text-[#6B6B6B]">
        Add menu items first (under Menu) — recipes link menu items to ingredients.
      </div>
    );
  }

  return (
    <section className="sp-card p-5" aria-label="Recipe editor">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[15px] font-bold text-[#1A1A1A]">What one serve consumes</h2>
        <span className="text-[11px] font-semibold text-[#969696]">
          {recipeCount.size} of {menuItems.length} menu items have recipes
        </span>
      </div>
      <p className="mb-4 text-[11.5px] text-[#969696]">
        Stock deducts automatically when a ticket starts preparing — an item without a recipe
        moves no stock.
      </p>

      <div className="mb-4 max-w-sm">
        <label htmlFor="recipe-item" className="mb-1 block text-[11px] font-bold uppercase tracking-[0.08em] text-[#969696]">
          Menu item
        </label>
        <div className="relative">
          <select
            id="recipe-item"
            value={effectiveId ?? ''}
            onChange={(e) => setSelectedId(e.target.value)}
            className={PILL}
          >
            {menuItems.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
                {recipeCount.get(m.id) ? ` · ${recipeCount.get(m.id)} ingredient${recipeCount.get(m.id) === 1 ? '' : 's'}` : ' · no recipe'}
              </option>
            ))}
          </select>
          <ChevronDown size={15} aria-hidden className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[#6B6B6B]" />
        </div>
      </div>

      {draft.length > 0 && (
        <ul className="mb-4 flex flex-col gap-2" aria-label="Recipe lines">
          {draft.map((l) => {
            const ing = ingById.get(l.inventory_item_id);
            return (
              <li key={l.inventory_item_id} className="flex items-center gap-3 rounded-xl bg-[#F7F8F6] px-3.5 py-2.5">
                <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-[#1A1A1A]">
                  {ing?.name ?? 'Ingredient'}
                </span>
                <span className="flex shrink-0 items-center gap-1.5">
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={l.qty_per_serve}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setDraft((d) =>
                        d.map((x) => (x.inventory_item_id === l.inventory_item_id ? { ...x, qty_per_serve: v } : x))
                      );
                      setDirty(true);
                    }}
                    aria-label={`Quantity of ${ing?.name ?? 'ingredient'} per serve`}
                    className="h-9 w-24 rounded-lg border border-[#E3E7E0] bg-white px-2.5 text-right text-[12.5px] tabular-nums text-[#1A1A1A] focus:border-[#B88E2F] focus:outline-none focus:ring-2 focus:ring-[#B88E2F]/25"
                  />
                  <span className="w-7 text-[11.5px] font-bold text-[#6B6B6B]">{ing?.unit ?? ''}</span>
                </span>
                <button
                  onClick={() => {
                    setDraft((d) => d.filter((x) => x.inventory_item_id !== l.inventory_item_id));
                    setDirty(true);
                  }}
                  aria-label={`Remove ${ing?.name ?? 'ingredient'} from recipe`}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#6B6B6B] transition hover:bg-[#FCEBEA] hover:text-[#B3261E]"
                >
                  <Trash2 size={13} aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex flex-wrap items-end gap-2 rounded-xl border border-dashed border-[#E3E7E0] p-3.5">
        <div className="min-w-40 flex-1">
          <label htmlFor="add-ing" className="mb-1 block text-[11px] font-bold uppercase tracking-[0.08em] text-[#969696]">
            Ingredient
          </label>
          <div className="relative">
            <select id="add-ing" value={addIng} onChange={(e) => setAddIng(e.target.value)} className={PILL}>
              <option value="">Pick an ingredient…</option>
              {items
                .filter((i) => !draft.some((d) => d.inventory_item_id === i.id))
                .map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name} ({i.unit})
                  </option>
                ))}
            </select>
            <ChevronDown size={15} aria-hidden className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[#6B6B6B]" />
          </div>
        </div>
        <div className="w-28">
          <label htmlFor="add-qty" className="mb-1 block text-[11px] font-bold uppercase tracking-[0.08em] text-[#969696]">
            Per serve
          </label>
          <input
            id="add-qty"
            type="number"
            min="0"
            step="any"
            value={addQty}
            onChange={(e) => setAddQty(e.target.value)}
            placeholder="18"
            className="h-11 w-full rounded-full border border-[#E3E7E0] bg-white px-4 text-right text-[13px] tabular-nums text-[#1A1A1A] placeholder:text-[#B9C4BE] focus:border-[#B88E2F] focus:outline-none focus:ring-2 focus:ring-[#B88E2F]/25"
          />
        </div>
        <button
          onClick={addLine}
          disabled={!addIng || !(Number(addQty) > 0)}
          className="flex h-11 items-center gap-1.5 rounded-xl border border-[#E3E7E0] bg-white px-3.5 text-[12.5px] font-bold text-[#0F3D3E] transition hover:border-[#B88E2F] hover:text-[#B88E2F] disabled:opacity-40"
        >
          <Plus size={14} aria-hidden />
          Add
        </button>
      </div>

      <div className="mt-4 flex items-center justify-end gap-2.5">
        {dirty && (
          <span className="text-[11.5px] font-semibold text-[#8A5A00]">Unsaved changes</span>
        )}
        <button
          onClick={() => {
            if (selected) {
              const saved = recipes
                .filter((r) => r.menu_item_id === selected.id)
                .map((r) => ({ inventory_item_id: r.inventory_item_id, qty_per_serve: Number(r.qty_per_serve) }));
              setDraft(saved);
              setDirty(false);
            }
          }}
          disabled={!dirty}
          className="h-11 rounded-full border border-[#E3E7E0] bg-white px-4 text-[12.5px] font-semibold text-[#1A1A1A] transition hover:border-[#B88E2F] disabled:opacity-40"
        >
          Discard
        </button>
        <button
          onClick={() => void save()}
          disabled={!dirty || saving || !effectiveId}
          className="flex h-11 items-center gap-1.5 rounded-xl bg-[#0F3D3E] px-5 text-[12.5px] font-bold text-white transition hover:bg-[#0C3233] disabled:opacity-40"
        >
          {saving ? <Loader2 size={14} aria-hidden className="animate-spin" /> : <Check size={14} aria-hidden />}
          Save recipe
        </button>
      </div>
      {selected && !dirty && draft.length === 0 && (
        <p className="mt-3 text-[11.5px] italic text-[#969696]">
          {selected.name} has no recipe yet — its sales will not move stock.
        </p>
      )}
    </section>
  );
};

/* ───────────────────────────── dialogs ────────────────────────────────── */

const IngredientDialog: React.FC<{
  editing: InventoryItem | null;
  onClose: () => void;
  onSave: (input: {
    name: string;
    unit: string;
    currentStock: number;
    reorderPoint: number;
    costPerUnit: number | null;
  }) => Promise<void>;
}> = ({ editing, onClose, onSave }) => {
  const [name, setName] = useState(editing?.name ?? '');
  const [unit, setUnit] = useState(editing?.unit ?? 'g');
  const [stock, setStock] = useState(String(editing?.current_stock ?? ''));
  const [reorder, setReorder] = useState(String(editing?.reorder_point ?? ''));
  const [cost, setCost] = useState(editing?.cost_per_unit != null ? String(editing.cost_per_unit) : '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const valid = name.trim().length > 0 && Number(stock) >= 0 && Number(reorder) >= 0;

  const submit = async () => {
    if (!valid) return;
    setBusy(true);
    setErr(null);
    try {
      await onSave({
        name: name.trim(),
        unit,
        currentStock: Number(stock) || 0,
        reorderPoint: Number(reorder) || 0,
        costPerUnit: cost.trim() === '' ? null : Number(cost),
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not save.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F3D3E]/45 p-4" role="dialog" aria-modal="true" aria-label={editing ? 'Edit ingredient' : 'Add ingredient'}>
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
        <h2 className="text-[16px] font-bold text-[#1A1A1A]">
          {editing ? 'Edit ingredient' : 'Add ingredient'}
        </h2>
        <p className="mt-0.5 text-[11.5px] text-[#6B6B6B]">
          The shelf tracks what the kitchen consumes — one row per ingredient.
        </p>

        <div className="mt-4 flex flex-col gap-3">
          <label className="block">
            <span className="mb-1 block text-[11px] font-bold uppercase tracking-[0.08em] text-[#969696]">Name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Coffee beans"
              autoFocus
              className="h-11 w-full rounded-xl border border-[#E3E7E0] bg-white px-3.5 text-[13px] text-[#1A1A1A] placeholder:text-[#B9C4BE] focus:border-[#B88E2F] focus:outline-none focus:ring-2 focus:ring-[#B88E2F]/25"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-[11px] font-bold uppercase tracking-[0.08em] text-[#969696]">Unit</span>
              <div className="relative">
                <select value={unit} onChange={(e) => setUnit(e.target.value)} className={PILL}>
                  {UNITS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
                <ChevronDown size={15} aria-hidden className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[#6B6B6B]" />
              </div>
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-bold uppercase tracking-[0.08em] text-[#969696]">Cost / unit (₹)</span>
              <input
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                type="number"
                min="0"
                step="any"
                placeholder="1.80"
                className="h-11 w-full rounded-xl border border-[#E3E7E0] bg-white px-3.5 text-right text-[13px] tabular-nums text-[#1A1A1A] placeholder:text-[#B9C4BE] focus:border-[#B88E2F] focus:outline-none focus:ring-2 focus:ring-[#B88E2F]/25"
              />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-[11px] font-bold uppercase tracking-[0.08em] text-[#969696]">Current stock</span>
              <input
                value={stock}
                onChange={(e) => setStock(e.target.value)}
                type="number"
                min="0"
                step="any"
                placeholder="5000"
                className="h-11 w-full rounded-xl border border-[#E3E7E0] bg-white px-3.5 text-right text-[13px] tabular-nums text-[#1A1A1A] placeholder:text-[#B9C4BE] focus:border-[#B88E2F] focus:outline-none focus:ring-2 focus:ring-[#B88E2F]/25"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-bold uppercase tracking-[0.08em] text-[#969696]">Reorder point</span>
              <input
                value={reorder}
                onChange={(e) => setReorder(e.target.value)}
                type="number"
                min="0"
                step="any"
                placeholder="500"
                className="h-11 w-full rounded-xl border border-[#E3E7E0] bg-white px-3.5 text-right text-[13px] tabular-nums text-[#1A1A1A] placeholder:text-[#B9C4BE] focus:border-[#B88E2F] focus:outline-none focus:ring-2 focus:ring-[#B88E2F]/25"
              />
            </label>
          </div>
        </div>

        {err && <p className="mt-3 text-[12px] font-semibold text-[#B42318]">{err}</p>}

        <div className="mt-5 flex justify-end gap-2.5">
          <button
            onClick={onClose}
            className="h-11 rounded-full border border-[#E3E7E0] bg-white px-4 text-[12.5px] font-semibold text-[#1A1A1A] transition hover:border-[#B88E2F]"
          >
            Cancel
          </button>
          <button
            onClick={() => void submit()}
            disabled={!valid || busy}
            className="flex h-11 items-center gap-1.5 rounded-xl bg-[#0F3D3E] px-5 text-[12.5px] font-bold text-white transition hover:bg-[#0C3233] disabled:opacity-40"
          >
            {busy ? <Loader2 size={14} aria-hidden className="animate-spin" /> : <Check size={14} aria-hidden />}
            {editing ? 'Save changes' : 'Add to shelf'}
          </button>
        </div>
      </div>
    </div>
  );
};

const RestockDialog: React.FC<{
  item: InventoryItem;
  suggestedQty?: number | null;
  busy: boolean;
  onClose: () => void;
  onConfirm: (qty: number) => void;
}> = ({ item, suggestedQty = null, busy, onClose, onConfirm }) => {
  const [qty, setQty] = useState(suggestedQty != null && suggestedQty > 0 ? String(suggestedQty) : '');
  const valid = Number(qty) > 0;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F3D3E]/45 p-4" role="dialog" aria-modal="true" aria-label={`Restock ${item.name}`}>
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
        <h2 className="text-[16px] font-bold text-[#1A1A1A]">Restock {item.name}</h2>
        <p className="mt-0.5 text-[11.5px] text-[#6B6B6B]">
          On the shelf now:{' '}
          <span className="font-bold tabular-nums text-[#0F3D3E]">
            {fmtQty(item.current_stock)} {item.unit}
          </span>{' '}
          — delivery adds to it.
          {suggestedQty != null && suggestedQty > 0 && (
            <>
              {' '}
              Suggested:{' '}
              <button
                type="button"
                onClick={() => setQty(String(suggestedQty))}
                className="font-bold text-[#8A5A00] underline decoration-dotted underline-offset-2"
              >
                {fmtQty(suggestedQty)} {item.unit}
              </button>{' '}
              (7-day cover)
            </>
          )}
        </p>
        <label className="mt-4 block">
          <span className="mb-1 block text-[11px] font-bold uppercase tracking-[0.08em] text-[#969696]">
            Quantity received ({item.unit})
          </span>
          <input
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            type="number"
            min="0"
            step="any"
            autoFocus
            placeholder="1000"
            className="h-11 w-full rounded-xl border border-[#E3E7E0] bg-white px-3.5 text-right text-[13px] tabular-nums text-[#1A1A1A] placeholder:text-[#B9C4BE] focus:border-[#B88E2F] focus:outline-none focus:ring-2 focus:ring-[#B88E2F]/25"
          />
        </label>
        {Number(qty) > 0 && (
          <p className="mt-2 text-[11.5px] font-semibold text-[#2E7D32]">
            New level: {fmtQty(item.current_stock + Number(qty))} {item.unit}
          </p>
        )}
        <div className="mt-5 flex justify-end gap-2.5">
          <button
            onClick={onClose}
            className="h-11 rounded-full border border-[#E3E7E0] bg-white px-4 text-[12.5px] font-semibold text-[#1A1A1A] transition hover:border-[#B88E2F]"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(Number(qty))}
            disabled={!valid || busy}
            className="flex h-11 items-center gap-1.5 rounded-xl bg-[#2E7D32] px-5 text-[12.5px] font-bold text-white transition hover:bg-[#256428] disabled:opacity-40"
          >
            {busy ? <Loader2 size={14} aria-hidden className="animate-spin" /> : <PackagePlus size={14} aria-hidden />}
            Add to shelf
          </button>
        </div>
      </div>
    </div>
  );
};

/* ─────────────────────────── reorder board ────────────────────────────── */

interface ReorderRow {
  item: InventoryItem;
  /** ledger burn per day across the window (qty units/day) */
  burnPerDay: number;
  /** days until the shelf runs dry at this burn — null when nothing burns */
  daysLeft: number | null;
  /** suggested purchase for 7-day cover, ceil'd — 0 when nothing burns */
  suggested: number;
  /** suggested × current cost_per_unit */
  estCost: number;
  /** on the shopping list: burning AND (at/below reorder OR under 7 days of cover) */
  needsBuy: boolean;
}

/** Pure burn-rate math over the stock_deductions ledger — read-only, no engine. */
function buildReorderRows(items: InventoryItem[], deductions: StockDeduction[]): ReorderRow[] {
  const burn = new Map<string, number>();
  for (const d of deductions) {
    burn.set(d.inventory_item_id, (burn.get(d.inventory_item_id) ?? 0) + Number(d.qty ?? 0));
  }
  return items
    .map((item) => {
      const burnPerDay = (burn.get(item.id) ?? 0) / REORDER_WINDOW_DAYS;
      const daysLeft = burnPerDay > 0 ? Number(item.current_stock) / burnPerDay : null;
      const suggested =
        burnPerDay > 0
          ? Math.max(0, Math.ceil(burnPerDay * REORDER_COVER_DAYS - Number(item.current_stock)))
          : 0;
      const estCost = suggested * Number(item.cost_per_unit ?? 0);
      const needsBuy =
        burnPerDay > 0 &&
        (Number(item.current_stock) <= Number(item.reorder_point) ||
          (daysLeft ?? Infinity) < REORDER_COVER_DAYS);
      return { item, burnPerDay, daysLeft, suggested, estCost, needsBuy };
    })
    .sort(
      (a, b) =>
        Number(b.needsBuy) - Number(a.needsBuy) ||
        (a.daysLeft ?? 1e9) - (b.daysLeft ?? 1e9) ||
        b.burnPerDay - a.burnPerDay,
    );
}

function daysTone(daysLeft: number | null): { text: string; bar: string; label: string } {
  if (daysLeft == null) return { text: 'text-[#6B6B6B]', bar: '#C8CFC9', label: 'no burn yet' };
  if (daysLeft < 3) return { text: 'text-[#B3261E]', bar: '#B3261E', label: 'critical' };
  if (daysLeft < REORDER_COVER_DAYS) return { text: 'text-[#8A5A00]', bar: '#B88E2F', label: 'running low' };
  return { text: 'text-[#2E7D32]', bar: '#2E7D32', label: 'covered' };
}

const ReorderBoard: React.FC<{
  items: InventoryItem[];
  deductions: StockDeduction[];
  onRestock: (item: InventoryItem, suggested: number) => void;
}> = ({ items, deductions, onRestock }) => {
  const rows = useMemo(() => buildReorderRows(items, deductions), [items, deductions]);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);

  const buyRows = rows.filter((r) => r.needsBuy);
  const watchRows = rows.filter((r) => !r.needsBuy && r.burnPerDay > 0);

  const effectiveQty = (r: ReorderRow): number => {
    const raw = edits[r.item.id];
    if (raw != null) {
      const n = Number(raw);
      if (Number.isFinite(n) && n >= 0) return Math.ceil(n);
    }
    return r.suggested;
  };

  const listCost = buyRows.reduce((s, r) => s + effectiveQty(r) * Number(r.item.cost_per_unit ?? 0), 0);

  const copyList = useCallback(() => {
    if (buyRows.length === 0) return;
    const lines = buyRows.map((r) => {
      const q = effectiveQty(r);
      const cost = q * Number(r.item.cost_per_unit ?? 0);
      return `${r.item.name} × ${fmtQty(q)} ${r.item.unit} — est ${formatMoney(cost)}`;
    });
    void navigator.clipboard
      .writeText(`ServePoint shopping list (7-day cover):\n${lines.join('\n')}`)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buyRows, edits]);

  const exportList = useCallback(() => {
    if (buyRows.length === 0) return;
    const todayIso = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
    const out: (string | number)[][] = [
      ['Item', 'On shelf', 'Unit', 'Reorder point', 'Burn/day', 'Days left', 'Suggested qty', 'Cost/unit', 'Est cost'],
    ];
    for (const r of buyRows) {
      const q = effectiveQty(r);
      out.push([
        r.item.name,
        Number(r.item.current_stock),
        r.item.unit,
        Number(r.item.reorder_point),
        r.burnPerDay.toFixed(3),
        r.daysLeft == null ? '' : r.daysLeft.toFixed(1),
        q,
        Number(r.item.cost_per_unit ?? 0).toFixed(2),
        (q * Number(r.item.cost_per_unit ?? 0)).toFixed(2),
      ]);
    }
    downloadCsv(`servepoint-shopping-list-${todayIso}.csv`, out);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buyRows, edits]);

  if (rows.every((r) => r.burnPerDay <= 0)) {
    return (
      <div className="sp-card flex flex-col items-center justify-center gap-2 px-4 py-14 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#D9E2DD]">
          <ShoppingBasket size={26} className="text-[#0F3D3E]" aria-hidden />
        </span>
        <h2 className="mt-1 text-[15px] font-bold text-[#1A1A1A]">Nothing to buy yet</h2>
        <p className="max-w-sm text-[12.5px] text-[#6B6B6B]">
          Reorder suggestions need burn history — place a few tickets and the ledger will price your
          shopping list automatically. No recipes yet? Link ingredients to menu items under Recipes.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* ── shopping list ── */}
      <section className="sp-card p-5" aria-label="Shopping list">
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-[15px] font-bold text-[#1A1A1A]">Shopping list</h2>
            <p className="text-[11.5px] text-[#969696]">
              Burn rates from the last {REORDER_WINDOW_DAYS} days of the deductions ledger · the list
              buys {REORDER_COVER_DAYS} days of cover
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={copyList}
              disabled={buyRows.length === 0}
              aria-label="Copy shopping list to clipboard"
              className="flex h-11 items-center gap-1.5 rounded-xl border border-[#E3E7E0] bg-white px-3 text-[12.5px] font-bold text-[#0F3D3E] transition hover:border-[#B88E2F] hover:text-[#B88E2F] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {copied ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
            <button
              onClick={exportList}
              disabled={buyRows.length === 0}
              aria-label="Export shopping list as CSV"
              className="flex h-11 items-center gap-1.5 rounded-xl border border-[#E3E7E0] bg-white px-3 text-[12.5px] font-bold text-[#0F3D3E] transition hover:border-[#B88E2F] hover:text-[#B88E2F] disabled:cursor-not-allowed disabled:opacity-40"
            >
              CSV
            </button>
          </div>
        </div>

        {buyRows.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#EAF0EC]">
              <Check size={22} className="text-[#2E7D32]" aria-hidden />
            </span>
            <p className="text-[13.5px] font-bold text-[#1A1A1A]">The shelf covers the week</p>
            <p className="max-w-xs text-[12px] font-semibold text-[#8A938C]">
              Every burning SKU has {REORDER_COVER_DAYS}+ days of stock. Watch this space — the list
              rebuilds itself after each service.
            </p>
          </div>
        ) : (
          <>
            <ul className="mt-3 flex flex-col divide-y divide-[#E3E7E0]">
              {buyRows.map((r) => {
                const tone = daysTone(r.daysLeft);
                const q = effectiveQty(r);
                const cost = q * Number(r.item.cost_per_unit ?? 0);
                const meterPct = r.daysLeft == null ? 100 : Math.min(100, (r.daysLeft / REORDER_WINDOW_DAYS) * 100);
                return (
                  <li key={r.item.id} className="flex flex-wrap items-center gap-3 py-3" aria-label={`${r.item.name} shopping list row`}>
                    <div className="min-w-0 flex-1 basis-56">
                      <div className="flex items-center gap-2">
                        <h3 className="truncate text-[13.5px] font-bold text-[#1A1A1A]">{r.item.name}</h3>
                        <span className="shrink-0 rounded-full bg-[#EAF0EC] px-2 py-0.5 text-[10.5px] font-bold text-[#0F3D3E]">
                          {r.item.unit}
                        </span>
                        <span className={`shrink-0 text-[10.5px] font-bold ${tone.text}`}>{tone.label}</span>
                      </div>
                      <div className="mt-1.5 flex items-center gap-2">
                        <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-[#EAF0EC]" aria-hidden>
                          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.max(2, meterPct)}%`, backgroundColor: tone.bar }} />
                        </div>
                        <span className={`shrink-0 text-[11px] tabular-nums font-bold ${tone.text}`}>
                          {r.daysLeft == null ? '—' : `${r.daysLeft.toFixed(1)}d left`}
                        </span>
                      </div>
                      <p className="mt-1 text-[10.5px] font-semibold text-[#969696]">
                        burn {fmtQty(r.burnPerDay)} {r.item.unit}/day · shelf {fmtQty(Number(r.item.current_stock))}{' '}
                        {r.item.unit} · reorder at {fmtQty(Number(r.item.reorder_point))} {r.item.unit}
                      </p>
                    </div>
                    <label className="flex shrink-0 items-center gap-2">
                      <span className="text-[10.5px] font-bold uppercase tracking-[0.06em] text-[#969696]">Buy</span>
                      <input
                        value={edits[r.item.id] ?? String(r.suggested)}
                        onChange={(e) => setEdits((m) => ({ ...m, [r.item.id]: e.target.value }))}
                        type="number"
                        min="0"
                        step="any"
                        aria-label={`Quantity of ${r.item.name} to buy (${r.item.unit})`}
                        className="h-10 w-24 rounded-xl border border-[#E3E7E0] bg-white px-3 text-right text-[12.5px] tabular-nums text-[#1A1A1A] focus:border-[#B88E2F] focus:outline-none focus:ring-2 focus:ring-[#B88E2F]/25"
                      />
                    </label>
                    <span className="w-20 shrink-0 text-right text-[12.5px] font-extrabold tabular-nums text-[#8A5A00]">
                      {formatMoney(cost)}
                    </span>
                    <button
                      onClick={() => onRestock(r.item, q)}
                      aria-label={`Restock ${r.item.name} with the suggested quantity`}
                      className="flex h-9 shrink-0 items-center gap-1 rounded-lg border border-[#E3E7E0] bg-white px-2.5 text-[11.5px] font-bold text-[#0F3D3E] transition hover:border-[#2E7D32] hover:text-[#2E7D32]"
                    >
                      <PackagePlus size={12} aria-hidden />
                      Restock
                    </button>
                  </li>
                );
              })}
            </ul>
            <div className="mt-3 flex items-center justify-between gap-3 border-t border-[#E3E7E0] pt-3">
              <p className="text-[11.5px] font-semibold text-[#6B6B6B]">
                {buyRows.length} ingredient{buyRows.length === 1 ? '' : 's'} to buy · delivery day, one bill
              </p>
              <p className="text-[13px] font-extrabold tabular-nums text-[#0F3D3E]">
                Est total <span className="text-[15px] text-[#8A5A00]">{formatMoney(listCost)}</span>
              </p>
            </div>
          </>
        )}
      </section>

      {/* ── watching (burning, but covered) ── */}
      {watchRows.length > 0 && (
        <section className="sp-card p-5" aria-label="Covered SKUs being watched">
          <div className="mb-2 flex items-center gap-2">
            <h2 className="text-[14px] font-bold text-[#1A1A1A]">Watching</h2>
            <span className="text-[11px] text-[#969696]">burning, but the shelf covers the week</span>
          </div>
          <ul className="flex flex-col divide-y divide-[#E3E7E0]">
            {watchRows.map((r) => {
              const tone = daysTone(r.daysLeft);
              return (
                <li key={r.item.id} className="flex items-center justify-between gap-3 py-2">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-[12.5px] font-semibold text-[#1A1A1A]">{r.item.name}</span>
                    <span className="shrink-0 rounded-full bg-[#EAF0EC] px-1.5 py-0.5 text-[10px] font-bold text-[#0F3D3E]">
                      {r.item.unit}
                    </span>
                  </span>
                  <span className="shrink-0 text-[11.5px] tabular-nums text-[#6B6B6B]">
                    <span className={`font-bold ${tone.text}`}>
                      {r.daysLeft == null ? '—' : `${r.daysLeft.toFixed(1)}d`}
                    </span>{' '}
                    · {fmtQty(r.burnPerDay)} {r.item.unit}/day
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
};
