import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  BookOpenText,
  Check,
  ChevronDown,
  ClipboardCheck,
  ClipboardList,
  Copy,
  Download,
  Layers,
  Loader2,
  MessageCircle,
  Minus,
  Package,
  PackageMinus,
  PackagePlus,
  PackageX,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShoppingBasket,
  Trash2,
  Wifi,
  WifiOff,
  X,
  Zap,
} from 'lucide-react';
import {
  adjustStock,
  createInventoryItem,
  deleteInventoryItem,
  fetchDeductionWindow,
  fetchInventory,
  fetchMenuItems,
  fetchPaidMoverLines,
  fetchRecentAdjustments,
  fetchRecentDeductions,
  fetchRecipeLines,
  restockInventoryItem,
  setRecipeLines,
  subscribeInventoryRealtime,
  updateInventoryItem,
  type InventoryItem,
  type RealtimeState,
  type RecipeLine,
  type StockAdjustment,
  type StockAdjustmentReason,
  type StockDeduction,
} from '../../lib/api';
import { computeTopMovers, MOVER_WINDOW_DAYS, type Mover } from '../../lib/movers';
import { formatMoney } from '../../lib/prefs';
import { LOW_COVER, shelfCoverage } from '../../lib/shelf';
import { downloadCsv } from '../../lib/csv';
import { appTodayIso, appFormatters, appTzTag } from '../../lib/appday';
import { useDialogA11y } from '../../lib/useDialogA11y';
import { useTenant } from '../../lib/tenant';
import { useUi } from '../../store/session';
import { MarkHit } from '../shell/MarkHit';
import { EmptyState } from '../shell/EmptyState';
import type { MenuItem } from '../../types';

/**
 * Inventory (v5.4.0 — NOVA stock parity, migration 015 engine; v5.36.0 — the
 * 027 stock diary).
 *
 * The board answers four questions at a glance:
 *   1. STOCK — what's on the shelf (level bars vs reorder point), with
 *      restock / waste / edit / delete and the STOCK DIARY: one feed that
 *      merges the engine's ticket deductions with the hand-made moves
 *      (deliveries, spoilage, spills, damage, corrections — 027).
 *   2. RECIPES — what one serve of each menu item consumes. No recipe ⇒
 *      that item moves no stock (stated honestly in the UI).
 *   3. REORDER — what to buy this week: the stock_deductions ledger prices
 *      each SKU's burn per day (last 14 days), converts to days-left meters
 *      and a 7-day-cover shopping list with estimated cost (copy/CSV).
 *   4. LIVE — the engine deducts the moment a ticket hits `preparing`
 *      (single-engine rule: trg_orders_deduct_stock is THE deduction path);
 *      realtime keeps this board moving while tickets fire.
 *
 * Data truth: inventory_items / recipe_lines / stock_deductions /
 * stock_adjustments on the cloud. Every hand-made move goes through the
 * 027 RPC (atomic, row-locked — no client read-modify-write). Stock going
 * negative is allowed (real cafes oversell) — rendered red.
 *
 * v5.117.0 — the shelf learns the shell's word: the screen registers its
 * search vocabulary with the header ("Search the shelf…") and the filter
 * narrows the ingredient list by NAME (two doors — the toolbar's own box
 * and the header box share one state). Honesty rails: the LOW STOCK / OUT
 * chips, the shelf value and the movers section keep counting the WHOLE
 * shelf; a filtered list is a narrower view, never a quieter ledger, and
 * the empty state says so.
 */

type TabKey = 'stock' | 'recipes' | 'reorder';

/** Burn-rate window for reorder suggestions (ledger days). */
const REORDER_WINDOW_DAYS = 14;
/** Days of cover the shopping list buys (suggested = burn × this − stock). */
const REORDER_COVER_DAYS = 7;

/** v5.81.0 — one row of the shelf's answer: how many more of a shortlist
 * dish the shelf can make. coverage null + unknown false = no recipe on
 * file (the shelf can't answer); unknown true = a recipe SKU is missing
 * from the shelf map (coverage unknowable, said honestly). */
interface ShelfAnswerRow {
  mover: Mover;
  rank: number;
  name: string;
  coverage: number | null;
  thin: string | null;
  thinUnit: string | null;
  unknown: boolean;
}

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

/** The diary merges two ledgers: the engine's ticket deductions (always
 *  stock out) and the hand-made adjustments (027, already signed). Newest
 *  first, capped like the old feed. */
type DiaryRow =
  | { kind: 'ticket'; id: string; itemId: string; qty: number; at: string }
  | {
      kind: 'adjust';
      id: string;
      itemId: string;
      qty: number;
      at: string;
      reason: StockAdjustmentReason;
      note: string;
    };

const REASON_META: Record<StockAdjustmentReason, { label: string; chip: string }> = {
  delivery: { label: 'Delivery', chip: 'bg-[#E7F1E8] text-[#2E7D32]' },
  spoilage: { label: 'Spoiled', chip: 'bg-[#FBF3E1] text-[#8A5A00]' },
  spillage: { label: 'Spilled', chip: 'bg-[#FBF3E1] text-[#8A5A00]' },
  damage: { label: 'Damaged', chip: 'bg-[#FBF3E1] text-[#8A5A00]' },
  correction: { label: 'Correction', chip: 'bg-[#FBF3E1] text-[#8A5A00]' },
};

/* ─────────────────────────────── screen ────────────────────────────────── */

/* v5.120.0 — the gold glint, consolidated: one truth now lives in
 * src/components/shell/MarkHit.tsx and serves every search surface
 * (rooms, shelf, menu, bills, guests). This file imports it like any
 * other shell primitive. */
export const InventoryScreen: React.FC = () => {
  const [attempt, setAttempt] = useState(0);
  return <InventoryInner key={attempt} onTenantRetry={() => setAttempt((a) => a + 1)} />;
};

const InventoryInner: React.FC<{ onTenantRetry: () => void }> = ({ onTenantRetry }) => {
  const { tenantId, loading: tenantLoading, error: tenantError, tenant } = useTenant();
  /* v5.117.0 — the shelf joins the shell-search contract: the header box
   * (when the shelf is on stage) and the toolbar's own box are two doors
   * to one state. The filter reads ingredient NAMES only and never
   * touches the ledger's own voices — the LOW STOCK / OUT chips and the
   * movers section keep counting the WHOLE shelf while the list narrows;
   * a filtered view must never be mistaken for a quieter shelf. */
  const shelfQuery = useUi((s) => s.search);
  const setShelfQuery = useUi((s) => s.setSearch);
  useEffect(() => {
    useUi.getState().setSearchMeta({ placeholder: 'Search the shelf…' });
    return () => useUi.getState().setSearchMeta(null);
  }, []);
  const [tab, setTab] = useState<TabKey>('stock');
  /* 5.130.0 — the tiles' filter (null = whole shelf): the LOW STOCK and OUT
   * OF STOCK tiles take up the Floor's filter grammar (5.128.0, crossed to
   * Guests in 5.129.0). The tiles keep counting the WHOLE shelf; the list
   * below narrows, and the count line says so. */
  const [shelfFilter, setShelfFilter] = useState<'low' | 'out' | null>(null);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [recipes, setRecipes] = useState<RecipeLine[]>([]);
  const [deductions, setDeductions] = useState<StockDeduction[]>([]);
  const [adjustments, setAdjustments] = useState<StockAdjustment[]>([]);
  const [dedWindow, setDedWindow] = useState<StockDeduction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rt, setRt] = useState<RealtimeState>('connecting');
  const [busyId, setBusyId] = useState<string | null>(null);

  // dialog state
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<InventoryItem | null>(null);
  const [restockFor, setRestockFor] = useState<{ item: InventoryItem; suggested: number | null } | null>(null);
  /* v5.81.0 — the room's movers, so the shelf answers in their terms.
   * Fail-soft like every ledger read: null = unread, [] = quiet week or
   * failed read — the shelf view never waits on the ledger, and a quiet
   * week prints no rows (never a lie). */
  const [movers, setMovers] = useState<Mover[] | null>(null);
  const [wasteFor, setWasteFor] = useState<InventoryItem | null>(null);
  const [countOpen, setCountOpen] = useState(false);
  const [deleteArm, setDeleteArm] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!tenantId) return;
    setError(null);
    try {
      const [inv, mi, rl, sd, sa, sdw] = await Promise.all([
        fetchInventory(tenantId),
        fetchMenuItems(tenantId),
        fetchRecipeLines(tenantId),
        fetchRecentDeductions(tenantId, 12),
        fetchRecentAdjustments(tenantId, 12),
        fetchDeductionWindow(tenantId, REORDER_WINDOW_DAYS),
      ]);
      setItems(inv);
      setMenuItems(mi);
      setRecipes(rl);
      setDeductions(sd);
      setAdjustments(sa);
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

  /* v5.81.0 — the shortlist read: the same movers the counter sells and the
   * menu protects, computed by the one definition (no forked math). */
  useEffect(() => {
    if (!tenantId) return;
    let alive = true;
    fetchPaidMoverLines(tenantId, MOVER_WINDOW_DAYS)
      .then((rows) => {
        if (alive) setMovers(computeTopMovers(rows));
      })
      .catch(() => {
        if (alive) setMovers([]);
      });
    return () => {
      alive = false;
    };
  }, [tenantId]);

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

  /* v5.117.0 — the visible slice of the shelf under the search: names
   * only, case-insensitive. 5.130.0 — the tile filter composes with it:
   * the SAME predicates the stat tiles count with (low = above zero but
   * at/below reorder point; out = at/below zero). The header chips above
   * keep speaking the WHOLE shelf's truth — the filter narrows the list,
   * never the story. */
  const shelfQ = shelfQuery.trim().toLowerCase();
  const visibleShelf = useMemo(
    () =>
      items.filter((i) => {
        if (shelfQ && !i.name.toLowerCase().includes(shelfQ)) return false;
        if (shelfFilter === 'low' && !(i.current_stock > 0 && i.current_stock <= i.reorder_point))
          return false;
        if (shelfFilter === 'out' && i.current_stock > 0) return false;
        return true;
      }),
    [items, shelfQ, shelfFilter]
  );

  /* v5.81.0 — THE SHELF'S ANSWER: for each of the room's favourites, how
   * many more the shelf can make right now. Per-serve needs come from the
   * recipe lines (015), stock from the shelf itself; the thinnest SKU
   * decides. Dishes without a recipe say so; a recipe naming a SKU that
   * left the shelf says so; a dish that left the menu drops off the list.
   * Recomputes with the screen's own reload rhythm (realtime + 30s poll). */
  const shelfAnswer = useMemo<ShelfAnswerRow[]>(() => {
    if (!movers || movers.length === 0 || menuItems.length === 0) return [];
    const live = new Map(menuItems.map((m) => [m.id, m.name]));
    const rows: ShelfAnswerRow[] = [];
    movers.forEach((mv, idx) => {
      const name = live.get(mv.menuItemId);
      if (!name) return; /* the dish left the menu — the shelf no longer answers for it */
      const lines = recipes.filter((r) => r.menu_item_id === mv.menuItemId);
      /* the ONE shared math (5.91.0, src/lib/shelf.ts) — the counter's rail
         speaks the same answer the board computes here */
      const c = shelfCoverage(lines, items);
      rows.push({
        mover: mv,
        rank: idx + 1,
        name,
        coverage: c.coverage,
        thin: c.thin ? c.thin.name : null,
        thinUnit: c.thin ? c.thin.unit : null,
        unknown: c.unknown,
      });
    });
    return rows;
  }, [movers, menuItems, items, recipes]);

  /** one feed, two ledgers: engine deductions + hand-made moves, newest first */
  const diary = useMemo<DiaryRow[]>(() => {
    const rows: DiaryRow[] = [
      ...deductions.map(
        (d): DiaryRow => ({
          kind: 'ticket',
          id: `t-${d.id}`,
          itemId: d.inventory_item_id,
          qty: -Number(d.qty),
          at: d.created_at,
        })
      ),
      ...adjustments.map(
        (a): DiaryRow => ({
          kind: 'adjust',
          id: `a-${a.id}`,
          itemId: a.inventory_item_id,
          qty: Number(a.qty),
          at: a.created_at,
          reason: a.reason,
          note: a.note,
        })
      ),
    ];
    return rows.sort((x, y) => (x.at < y.at ? 1 : x.at > y.at ? -1 : 0)).slice(0, 12);
  }, [deductions, adjustments]);

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

  const doWaste = useCallback(
    async (item: InventoryItem, qty: number, reason: StockAdjustmentReason, note: string) => {
      // Errors are surfaced inside the dialog (it stays open, the line is
      // specific) — so no screen-level setError here; rethrow as-is.
      setBusyId(item.id);
      try {
        await adjustStock(item.id, -qty, reason, note);
        setWasteFor(null);
        await load();
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
            <h1 className="sp-screen-title">Inventory</h1>
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

      {/* ── stat strip — 5.130.0: LOW STOCK and OUT OF STOCK narrow the shelf
          (Floor's tile grammar); the numbers stay whole-shelf always ── */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Ingredients" value={String(items.length)} sub="SKUs on the shelf" tone="#0F3D3E" />
        <StatCard
          label="Low stock"
          value={String(stats.low)}
          sub="below reorder point"
          tone="#8A5A00"
          onToggle={() => setShelfFilter((f) => (f === 'low' ? null : 'low'))}
          active={shelfFilter === 'low'}
          hint={
            shelfFilter === 'low'
              ? 'Showing low-stock SKUs only — tap again for the whole shelf'
              : 'Tap to show low-stock SKUs only'
          }
        />
        <StatCard
          label="Out of stock"
          value={String(stats.out)}
          sub="need ordering now"
          tone="#B3261E"
          onToggle={() => setShelfFilter((f) => (f === 'out' ? null : 'out'))}
          active={shelfFilter === 'out'}
          hint={
            shelfFilter === 'out'
              ? 'Showing out-of-stock SKUs only — tap again for the whole shelf'
              : 'Tap to show out-of-stock SKUs only'
          }
        />
        <StatCard label="Stock value" value={formatMoney(stats.value)} sub="qty × unit cost" tone="#0F3D3E" />
      </div>

      {/* ── tabs ── */}
      <div className="flex w-fit rounded-full border border-[#E3E7E0] bg-white p-1" role="tablist" aria-label="Inventory tabs">
        <button
          role="tab"
          aria-selected={tab === 'stock'}
          onClick={() => setTab('stock')}
          className={`flex h-9 items-center gap-1.5 rounded-full px-4 text-[12.5px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B88E2F]/50 ${
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
          className={`flex h-9 items-center gap-1.5 rounded-full px-4 text-[12.5px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B88E2F]/50 ${
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
          className={`flex h-9 items-center gap-1.5 rounded-full px-4 text-[12.5px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B88E2F]/50 ${
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
            <>
              {/* ── the shelf's answer — prep coverage of the counter's shortlist ── */}
              {shelfAnswer.length > 0 && (
                <section
                  className="rounded-2xl border border-[#EAD9BE] bg-[#FDF9F0] p-4"
                  aria-label="How many more of the room's favourites the shelf can still make"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.08em] text-[#8A5A00]">
                      <Zap size={12} aria-hidden /> The shelf's answer
                    </h2>
                    <span className="rounded-full bg-[#F3E8CF] px-2 py-0.5 text-[10px] font-bold text-[#8A5A00]">
                      the counter's shortlist · last {MOVER_WINDOW_DAYS} days
                    </span>
                  </div>
                  <p className="mt-1 text-[11.5px] text-[#8A6A1F]">
                    How many more of the room's favourites this shelf can still make — the thinnest recipe SKU
                    decides, computed from what's actually on file.
                  </p>
                  <ul className="mt-2.5 flex flex-col gap-1.5">
                    {shelfAnswer.map((row) => {
                      const tone =
                        row.unknown || row.coverage === null
                          ? '#969696'
                          : row.coverage === 0
                            ? '#B4483C'
                            : row.coverage < LOW_COVER
                              ? '#8A5A00'
                              : '#2E7D32';
                      const verdict = row.unknown
                        ? 'a recipe SKU is off the shelf — coverage unknown'
                        : row.coverage === null
                          ? 'no recipe on file — the shelf can\'t answer'
                          : row.coverage === 0
                            ? `can't make another — ${row.thin} is out`
                            : `~${row.coverage} more · thinnest: ${row.thin}${row.thinUnit ? ` (${row.thinUnit})` : ''}`;
                      return (
                        <li
                          key={row.mover.menuItemId}
                          className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl bg-white/80 px-3 py-2"
                        >
                          <span
                            className="inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums"
                            style={
                              row.rank === 1
                                ? { backgroundColor: '#B88E2F', color: '#FFFFFF' }
                                : { backgroundColor: '#F3E8CF', color: '#8A6A1F' }
                            }
                          >
                            No.{row.rank}
                          </span>
                          <span className="text-[13px] font-semibold text-[#1A1A1A]">{row.name}</span>
                          <span
                            className="ml-auto whitespace-nowrap text-[11.5px] font-bold tabular-nums"
                            style={{ color: tone }}
                          >
                            {verdict}
                          </span>
                          <span className="whitespace-nowrap text-[10.5px] text-[#8A6A1F] tabular-nums">
                            {row.mover.units} sold · {row.mover.tickets} {row.mover.tickets === 1 ? 'ticket' : 'tickets'} this week
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              )}

              {/* ── shelf toolbar — the count entry point ── */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                {/* v5.117.0 — the shelf's own door to the shared search:
                    types into the same useUi.search the header box speaks. */}
                <div className="relative">
                  <Search
                    size={14}
                    aria-hidden
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#969696]"
                  />
                  <input
                    type="search"
                    value={shelfQuery}
                    onChange={(e) => setShelfQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        setShelfQuery('');
                        e.currentTarget.blur();
                      }
                    }}
                    placeholder="Search the shelf…"
                    aria-label="Search the shelf"
                    title="Search ingredient names — Esc clears"
                    className="h-9 w-44 rounded-full border border-[#E3E7E0] bg-white pl-8.5 pr-3 text-[12.5px] text-[#1A1A1A] outline-none transition placeholder:text-[#969696] hover:border-[#C9CFC9] focus:border-[#B88E2F] focus:ring-2 focus:ring-[#B88E2F]/25 [&::-webkit-search-cancel-button]:hidden"
                  />
                </div>
                {shelfQ || shelfFilter ? (
                  /* 5.130.0 — the count line grows into the Floor's whisper
                      (5.128.0, crossed to Guests in 5.129.0): while the
                      search or a tile narrows the shelf, say how much
                      survived — and admit the tiles above still count the
                      WHOLE shelf. The narrowing never rewrites the story. */
                  <p className="flex flex-wrap items-center gap-2 text-[11.5px] text-[#6B6B6B]" aria-live="polite">
                    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#0F3D3E] px-1.5 text-[10.5px] font-bold tabular-nums text-white">
                      {visibleShelf.length}
                    </span>
                    Showing {visibleShelf.length} of {items.length}{' '}
                    {items.length === 1 ? 'ingredient' : 'ingredients'}
                    {shelfQ ? (
                      <> for “{shelfQuery.trim()}”</>
                    ) : null}{' '}
                    — the tiles above still count the whole shelf
                  </p>
                ) : (
                  <p className="text-[11.5px] text-[#6B6B6B]">
                    <span className="font-bold text-[#1A1A1A]">{items.length}</span>{' '}
                    ingredient{items.length === 1 ? '' : 's'} on the shelf — every hand move lands in the diary
                  </p>
                )}
                <button
                  onClick={() => setCountOpen(true)}
                  className="flex h-9 items-center gap-1.5 rounded-lg border border-[#E3E7E0] bg-white px-3 text-[11.5px] font-bold text-[#0F3D3E] transition hover:border-[#0F3D3E] disabled:opacity-50"
                >
                  <ClipboardCheck size={13} aria-hidden />
                  Count shelf
                </button>
              </div>
              <ul className="flex flex-col gap-2.5" aria-label="Ingredient stock list">
              {items.length > 0 && visibleShelf.length === 0 ? (
                /* v5.117.0 — the search came up empty; own what it reads
                    (names) and offer the way back. 5.129.0 — the shape is
                    the shared EmptyState's compact register; words stay.
                    5.130.0 — the tile's word joins the miss (the Floor's
                    either-can-miss grammar, third surface): the search's
                    reach, the tile's ledger definition, or both. */
                <li>
                  <EmptyState
                    compact
                    icon={shelfQ ? Search : shelfFilter === 'out' ? PackageX : Package}
                    title={
                      shelfQ
                        ? `No ingredient matches “${shelfQuery.trim()}”`
                        : shelfFilter === 'low'
                          ? 'No low ingredients'
                          : 'Nothing is out of stock'
                    }
                    body={
                      shelfQ ? (
                        <>
                          Search reads ingredient names — the shelf counts stay whole-shelf.
                          {shelfFilter && (
                            <> The {shelfFilter === 'low' ? 'Low stock' : 'Out of stock'} tile is also in play — either can miss.</>
                          )}
                        </>
                      ) : shelfFilter === 'low' ? (
                        <>
                          The shelf holds {items.length}{' '}
                          {items.length === 1 ? 'ingredient' : 'ingredients'} — every one sits at or above
                          its reorder point. Tap the tile again, or show the whole shelf.
                        </>
                      ) : (
                        <>
                          The shelf holds {items.length}{' '}
                          {items.length === 1 ? 'ingredient' : 'ingredients'} — none has run dry. Tap the
                          tile again, or show the whole shelf.
                        </>
                      )
                    }
                    action={
                      <button
                        onClick={() => {
                          if (shelfQ) setShelfQuery('');
                          if (shelfFilter) setShelfFilter(null);
                        }}
                        className="rounded-lg bg-[#F3E8CF] px-3 py-1.5 text-[12px] font-semibold text-[#1A1A1A] transition hover:bg-[#E9D9AF]"
                      >
                        {shelfQ && shelfFilter ? 'Clear both' : shelfQ ? 'Clear search' : 'Show the whole shelf'}
                      </button>
                    }
                  />
                </li>
              ) : visibleShelf.map((it) => {
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
                        <h3 className="truncate text-[14px] font-bold text-[#1A1A1A]">
                          <MarkHit text={it.name} query={shelfQ} />
                        </h3>
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
                        onClick={() => setWasteFor(it)}
                        disabled={busy}
                        aria-label={`Log waste for ${it.name}`}
                        title="Spoilage, spills, breakage — stock that left without a sale"
                        className="flex h-9 items-center gap-1 rounded-lg border border-[#E3E7E0] bg-white px-2.5 text-[11.5px] font-bold text-[#0F3D3E] transition hover:border-[#B88E2F] hover:text-[#8A5A00] disabled:opacity-50"
                      >
                        <PackageMinus size={12} aria-hidden />
                        Waste
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
            </>
          )}

          {/* ── stock diary — every move, on the record ── */}
          {items.length > 0 && (
            <section className="sp-card p-5" aria-label="Stock diary">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <ClipboardList size={15} className="text-[#0F3D3E]" aria-hidden />
                <h2 className="text-[14px] font-bold text-[#1A1A1A]">Stock diary</h2>
                <span className="text-[11px] text-[#969696]">
                  every move, on the record — deliveries, waste, fired tickets
                </span>
              </div>
              {diary.length === 0 ? (
                <p className="py-2 text-[12px] italic text-[#969696]">
                  Nothing has moved yet — deliveries, waste and fired tickets will land here.
                </p>
              ) : (
                <ul className="flex flex-col divide-y divide-[#E3E7E0]">
                  {diary.map((row) => {
                    const ing = items.find((i) => i.id === row.itemId);
                    const unit = ing?.unit ?? '';
                    return (
                      <li key={row.id} className="flex items-center justify-between gap-3 py-2">
                        <span className="flex min-w-0 items-center gap-2">
                          {row.kind === 'ticket' ? (
                            <Minus size={12} className="shrink-0 text-[#B3261E]" aria-hidden />
                          ) : row.qty > 0 ? (
                            <Plus size={12} className="shrink-0 text-[#2E7D32]" aria-hidden />
                          ) : (
                            <PackageMinus size={12} className="shrink-0 text-[#B88E2F]" aria-hidden />
                          )}
                          <span className="truncate text-[12.5px] font-semibold text-[#1A1A1A]">
                            {ing ? ing.name : 'Ingredient'}
                          </span>
                          {row.kind === 'ticket' ? (
                            <span className="shrink-0 rounded-full bg-[#EAF0EC] px-2 py-0.5 text-[10px] font-bold text-[#0F3D3E]">
                              Ticket
                            </span>
                          ) : (
                            <span
                              className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${REASON_META[row.reason].chip}`}
                            >
                              {REASON_META[row.reason].label}
                            </span>
                          )}
                          {row.kind === 'adjust' && row.note && (
                            <span className="hidden min-w-0 truncate text-[11px] italic text-[#969696] md:block">
                              “{row.note}”
                            </span>
                          )}
                        </span>
                        <span className="flex shrink-0 items-center gap-2 text-[11.5px] tabular-nums text-[#6B6B6B]">
                          <span
                            className={
                              row.qty > 0
                                ? 'font-bold text-[#2E7D32]'
                                : row.kind === 'ticket'
                                  ? 'font-bold text-[#B3261E]'
                                  : 'font-bold text-[#8A5A00]'
                            }
                          >
                            {row.qty > 0 ? '+' : '−'}
                            {fmtQty(Math.abs(row.qty))} {unit}
                          </span>
                          {new Date(row.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
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
          storeName={tenant?.name || 'ServePoint store'}
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
      {wasteFor && (
        <WasteDialog
          item={wasteFor}
          busy={busyId === wasteFor.id}
          onClose={() => setWasteFor(null)}
          onConfirm={(qty, reason, note) => doWaste(wasteFor, qty, reason, note)}
        />
      )}
      {countOpen && (
        <StocktakeDialog
          items={items}
          onClose={() => setCountOpen(false)}
          onApplied={async () => {
            setCountOpen(false);
            await load();
          }}
        />
      )}
    </div>
  );
};

/* ─────────────────────────── small pieces ─────────────────────────────── */

const StatCard: React.FC<{
  label: string;
  value: string;
  sub?: string;
  tone: string;
  /* 5.130.0 — the Floor's filter register (5.128.0): when onToggle is
   * passed the card becomes a pressed button — gold ring when active,
   * hover lift — while the passive cards keep their section anatomy. */
  onToggle?: () => void;
  active?: boolean;
  hint?: string;
}> = ({ label, value, sub, tone, onToggle, active, hint }) => {
  if (!onToggle) {
    return (
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
  }
  return (
    <button
      type="button"
      aria-pressed={!!active}
      onClick={onToggle}
      title={hint}
      className={`rounded-2xl border bg-white p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#967221] ${
        active ? 'border-[#B88E2F] ring-2 ring-[#B88E2F]/30' : 'border-[#E3E7E0]'
      }`}
    >
      <p className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-[#969696]">{label}</p>
      <p
        className="mt-1.5 truncate text-[19px] font-extrabold tabular-nums leading-tight"
        style={{ color: tone }}
      >
        {value}
      </p>
      {sub ? <p className="mt-0.5 truncate text-[10.5px] text-[#969696]">{sub}</p> : null}
    </button>
  );
};

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

  /* v5.75.0 bug fix — this screen polls every 30s and rides inventory
   * realtime; every refetch hands `recipes` a new identity, and the load
   * effect below used to clobber the draft mid-edit, silently discarding
   * an operator's unsaved lines. Dirty edits now survive background
   * refreshes — they still yield to an explicit item switch or Discard. */
  const dirtyRef = useRef(false);
  const editedIdRef = useRef<string | null>(null);
  const markDirty = () => {
    dirtyRef.current = true;
    editedIdRef.current = effectiveId;
    setDirty(true);
  };
  const clearDirty = () => {
    dirtyRef.current = false;
    editedIdRef.current = null;
    setDirty(false);
  };

  // Load the saved recipe into the draft whenever the picked item changes —
  // but never clobber unsaved edits for the item being edited (5.75.0).
  useEffect(() => {
    if (!effectiveId) return;
    if (dirtyRef.current && editedIdRef.current === effectiveId) return;
    const saved = recipes
      .filter((r) => r.menu_item_id === effectiveId)
      .map((r) => ({ inventory_item_id: r.inventory_item_id, qty_per_serve: Number(r.qty_per_serve) }));
    setDraft(saved);
    dirtyRef.current = false;
    editedIdRef.current = null;
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
    markDirty();
    setAddIng('');
    setAddQty('');
  };

  const save = async () => {
    if (!effectiveId) return;
    setSaving(true);
    await onSave(effectiveId, draft);
    setSaving(false);
    /* the refetch hands back the saved ledger; drop the dirty guard so the
       draft reloads from truth (5.75.0). */
    clearDirty();
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
                      markDirty();
                    }}
                    aria-label={`Quantity of ${ing?.name ?? 'ingredient'} per serve`}
                    className="h-9 w-24 rounded-lg border border-[#E3E7E0] bg-white px-2.5 text-right text-[12.5px] tabular-nums text-[#1A1A1A] focus:border-[#B88E2F] focus:outline-none focus:ring-2 focus:ring-[#B88E2F]/25"
                  />
                  <span className="w-7 text-[11.5px] font-bold text-[#6B6B6B]">{ing?.unit ?? ''}</span>
                </span>
                <button
                  onClick={() => {
                    setDraft((d) => d.filter((x) => x.inventory_item_id !== l.inventory_item_id));
                    markDirty();
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
              clearDirty();
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
  /* v5.110.0 — Escape/trap/restore; Escape stands down while a save is in flight. */
  const dlgRef = useDialogA11y<HTMLDivElement>(() => { if (!busy) onClose(); }, true);

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
    <div ref={dlgRef} className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F3D3E]/45 p-4" style={{ animation: 'spFadeIn 160ms ease-out' }} role="dialog" aria-modal="true" aria-label={editing ? 'Edit ingredient' : 'Add ingredient'}>
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
  /* v5.110.0 — Escape/trap/restore; Escape stands down while a restock lands. */
  const dlgRef = useDialogA11y<HTMLDivElement>(() => { if (!busy) onClose(); }, true);
  return (
    <div ref={dlgRef} className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F3D3E]/45 p-4" style={{ animation: 'spFadeIn 160ms ease-out' }} role="dialog" aria-modal="true" aria-label={`Restock ${item.name}`}>
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

const WASTE_REASONS: { value: StockAdjustmentReason; label: string }[] = [
  { value: 'spoilage', label: 'Spoiled' },
  { value: 'spillage', label: 'Spilled' },
  { value: 'damage', label: 'Damaged' },
  { value: 'correction', label: 'Correction' },
];

/** Server refusals become honest human lines — the raw PG code names the rule. */
function wasteErrText(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e);
  if (raw.includes('WASTE_MUST_BE_NEGATIVE'))
    return 'The server refused a positive waste quantity — waste leaves the shelf.';
  if (raw.includes('NOT_FOUND')) return 'This ingredient is gone from the shelf — refresh and try again.';
  if (raw.includes('TOO_LONG')) return 'The note is too long — 280 characters at most.';
  if (raw.includes('BAD_QTY')) return 'The amount must be more than zero.';
  return raw || 'Could not record the waste.';
}

/** Records stock leaving the shelf for reasons other than a sale — spoilage,
 *  spills, breakage, or an honest count correction. The amount typed is what
 *  LEFT; the server receives it signed negative and writes the diary row
 *  (027 RPC — atomic, row-locked, sign-guarded). */
const WasteDialog: React.FC<{
  item: InventoryItem;
  busy: boolean;
  onClose: () => void;
  onConfirm: (qty: number, reason: StockAdjustmentReason, note: string) => Promise<void>;
}> = ({ item, busy, onClose, onConfirm }) => {
  const [qty, setQty] = useState('');
  const [reason, setReason] = useState<StockAdjustmentReason>('spoilage');
  const [note, setNote] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const valid = Number(qty) > 0 && note.length <= 280;
  /* v5.110.0 — Escape/trap/restore; Escape stands down while waste posts. */
  const dlgRef = useDialogA11y<HTMLDivElement>(() => { if (!sending) onClose(); }, true);

  const submit = async () => {
    if (!valid) return;
    setSending(true);
    setErr(null);
    try {
      await onConfirm(Number(qty), reason, note.trim());
    } catch (e) {
      setErr(wasteErrText(e));
    } finally {
      setSending(false);
    }
  };

  const newLevel = item.current_stock - Number(qty || 0);

  return (
    <div
      ref={dlgRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F3D3E]/45 p-4"
      style={{ animation: 'spFadeIn 160ms ease-out' }}
      role="dialog"
      aria-modal="true"
      aria-label={`Log waste for ${item.name}`}
    >
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
        <h2 className="text-[16px] font-bold text-[#1A1A1A]">Log waste — {item.name}</h2>
        <p className="mt-0.5 text-[11.5px] text-[#6B6B6B]">
          On the shelf now:{' '}
          <span className="font-bold tabular-nums text-[#0F3D3E]">
            {fmtQty(item.current_stock)} {item.unit}
          </span>{' '}
          — waste leaves it, on the record.
        </p>

        <label className="mt-4 block">
          <span className="mb-1 block text-[11px] font-bold uppercase tracking-[0.08em] text-[#969696]">
            Amount wasted ({item.unit})
          </span>
          <input
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            type="number"
            min="0"
            step="any"
            autoFocus
            placeholder="200"
            className="h-11 w-full rounded-xl border border-[#E3E7E0] bg-white px-3.5 text-right text-[13px] tabular-nums text-[#1A1A1A] placeholder:text-[#B9C4BE] focus:border-[#B88E2F] focus:outline-none focus:ring-2 focus:ring-[#B88E2F]/25"
          />
        </label>

        <div className="mt-3">
          <span className="mb-1 block text-[11px] font-bold uppercase tracking-[0.08em] text-[#969696]">
            Why it left
          </span>
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Waste reason">
            {WASTE_REASONS.map((r) => {
              const on = reason === r.value;
              return (
                <button
                  key={r.value}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setReason(r.value)}
                  className={`h-10 rounded-xl border text-[12px] font-bold transition ${
                    on
                      ? 'border-[#B88E2F] bg-[#FBF3E1] text-[#8A5A00]'
                      : 'border-[#E3E7E0] bg-white text-[#6B6B6B] hover:border-[#B88E2F] hover:text-[#8A5A00]'
                  }`}
                >
                  {r.label}
                </button>
              );
            })}
          </div>
        </div>

        <label className="mt-3 block">
          <span className="mb-1 block text-[11px] font-bold uppercase tracking-[0.08em] text-[#969696]">
            Note (optional)
          </span>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={280}
            placeholder="e.g. bar fridge leaked overnight"
            className="h-11 w-full rounded-xl border border-[#E3E7E0] bg-white px-3.5 text-[13px] text-[#1A1A1A] placeholder:text-[#B9C4BE] focus:border-[#B88E2F] focus:outline-none focus:ring-2 focus:ring-[#B88E2F]/25"
          />
        </label>

        {Number(qty) > 0 && (
          <p className={`mt-2 text-[11.5px] font-semibold ${newLevel < 0 ? 'text-[#B3261E]' : 'text-[#8A5A00]'}`}>
            New level: {fmtQty(newLevel)} {item.unit}
            {newLevel < 0 ? ' — below zero; the shelf shows it red (real cafes oversell).' : ''}
          </p>
        )}

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
            disabled={!valid || busy || sending}
            className="flex h-11 items-center gap-1.5 rounded-xl bg-[#B88E2F] px-5 text-[12.5px] font-bold text-white transition hover:bg-[#967221] disabled:opacity-40"
          >
            {busy || sending ? <Loader2 size={14} aria-hidden className="animate-spin" /> : <PackageMinus size={14} aria-hidden />}
            Record waste
          </button>
        </div>
      </div>
    </div>
  );
};

/** Variance chip tone for the stocktake: surplus green, shortfall red, even gray. */
function varianceTone(delta: number): { chip: string; label: string } {
  if (delta === 0) return { chip: 'bg-[#EAF0EC] text-[#6B6B6B]', label: 'even' };
  return delta > 0
    ? { chip: 'bg-[#E7F1E8] text-[#2E7D32]', label: `+${fmtQty(delta)} surplus` }
    : { chip: 'bg-[#FCEBEA] text-[#B3261E]', label: `${fmtQty(Math.abs(delta))} short` };
}

/** Stocktake — count the shelf, adjust the books. Each counted row whose
 *  variance isn't zero becomes ONE correction adjustment through the 027 RPC
 *  (row-locked, signed honestly both ways); blank rows skip, exact rows cost
 *  nothing. A mid-batch refusal is reported honestly: how far it got. */
const StocktakeDialog: React.FC<{
  items: InventoryItem[];
  onClose: () => void;
  onApplied: () => Promise<void>;
}> = ({ items, onClose, onApplied }) => {
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [note, setNote] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  /* v5.110.0 — Escape/trap/restore; Escape stands down while corrections post. */
  const dlgRef = useDialogA11y<HTMLDivElement>(() => { if (!sending) onClose(); }, true);

  const rows = items.map((it) => {
    const raw = counts[it.id]?.trim() ?? '';
    const counted = raw === '' ? null : Number(raw);
    const delta = counted == null || !Number.isFinite(counted) ? null : counted - Number(it.current_stock);
    return { item: it, raw, counted, delta };
  });
  const corrections = rows.filter((r) => r.delta != null && r.delta !== 0);
  const even = rows.filter((r) => r.delta === 0).length;
  const skipped = rows.length - corrections.length - even;
  const validCounts = rows.every((r) => r.counted == null || (Number.isFinite(r.counted) && r.counted >= 0));

  const submit = async () => {
    if (corrections.length === 0 || !validCounts) return;
    setSending(true);
    setErr(null);
    const batchNote = note.trim() || `Stocktake — ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`;
    const applied: string[] = [];
    try {
      for (const r of corrections) {
        await adjustStock(r.item.id, r.delta as number, 'correction', batchNote);
        applied.push(r.item.name);
      }
      await onApplied();
    } catch (e) {
      setErr(
        `${applied.length} of ${corrections.length} corrections landed before the refusal — ${wasteErrText(e)} The rest are still open; fix and re-apply.`,
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      ref={dlgRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F3D3E]/45 p-4"
      style={{ animation: 'spFadeIn 160ms ease-out' }}
      role="dialog"
      aria-modal="true"
      aria-label="Count the shelf"
    >
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl bg-white p-5 shadow-2xl">
        <h2 className="text-[16px] font-bold text-[#1A1A1A]">Count the shelf</h2>
        <p className="mt-0.5 text-[11.5px] text-[#6B6B6B]">
          Type what's physically there — the difference becomes a{' '}
          <span className="font-bold text-[#8A5A00]">Correction</span> on the diary. Blank rows skip; exact rows cost nothing.
        </p>

        <ul className="mt-4 flex min-h-0 flex-1 flex-col divide-y divide-[#E3E7E0] overflow-y-auto" aria-label="Stocktake rows">
          {rows.map(({ item, raw, counted, delta }) => (
            <li key={item.id} className="flex items-center gap-3 py-2.5">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-semibold text-[#1A1A1A]">{item.name}</span>
                <span className="block text-[11px] tabular-nums text-[#969696]">
                  books: {fmtQty(item.current_stock)} {item.unit}
                </span>
              </span>
              {delta != null && (
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${varianceTone(delta).chip}`}>
                  {varianceTone(delta).label}
                </span>
              )}
              <span className="flex shrink-0 items-center gap-1.5">
                <input
                  value={raw}
                  onChange={(e) => setCounts((c) => ({ ...c, [item.id]: e.target.value }))}
                  type="number"
                  min="0"
                  step="any"
                  inputMode="decimal"
                  placeholder="counted"
                  aria-label={`Counted quantity of ${item.name}`}
                  className={`h-9 w-24 rounded-lg border bg-white px-2.5 text-right text-[12.5px] tabular-nums text-[#1A1A1A] placeholder:text-[#B9C4BE] focus:outline-none focus:ring-2 focus:ring-[#B88E2F]/25 ${
                    counted != null && counted < 0 ? 'border-[#B3261E]' : 'border-[#E3E7E0] focus:border-[#B88E2F]'
                  }`}
                />
                <span className="w-7 text-[11px] font-bold text-[#6B6B6B]">{item.unit}</span>
              </span>
            </li>
          ))}
        </ul>

        <label className="mt-3 block">
          <span className="mb-1 block text-[11px] font-bold uppercase tracking-[0.08em] text-[#969696]">
            Diary note (optional)
          </span>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={280}
            placeholder={`Stocktake — ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`}
            className="h-11 w-full rounded-xl border border-[#E3E7E0] bg-white px-3.5 text-[13px] text-[#1A1A1A] placeholder:text-[#B9C4BE] focus:border-[#B88E2F] focus:outline-none focus:ring-2 focus:ring-[#B88E2F]/25"
          />
        </label>

        {err && <p className="mt-3 text-[12px] font-semibold text-[#B42318]">{err}</p>}

        <div className="mt-4 flex items-center justify-between gap-2.5">
          <p className="text-[11.5px] font-semibold text-[#6B6B6B]" aria-live="polite">
            {corrections.length} correction{corrections.length === 1 ? '' : 's'}
            {even > 0 ? ` · ${even} even` : ''}
            {skipped > 0 ? ` · ${skipped} skipped` : ''}
          </p>
          <span className="flex gap-2.5">
            <button
              onClick={onClose}
              className="h-11 rounded-full border border-[#E3E7E0] bg-white px-4 text-[12.5px] font-semibold text-[#1A1A1A] transition hover:border-[#B88E2F]"
            >
              Cancel
            </button>
            <button
              onClick={() => void submit()}
              disabled={corrections.length === 0 || !validCounts || sending}
              className="flex h-11 items-center gap-1.5 rounded-xl bg-[#0F3D3E] px-5 text-[12.5px] font-bold text-white transition hover:bg-[#0C3233] disabled:opacity-40"
            >
              {sending ? <Loader2 size={14} aria-hidden className="animate-spin" /> : <ClipboardCheck size={14} aria-hidden />}
              Apply corrections
            </button>
          </span>
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

/* ── v5.150.0 — the shopping list speaks in chat ──────────────────────────
 * The share arc's fifth member: the bill (5.145.0), the day (5.146.0),
 * the range (5.147.0), the offer (5.149.0) — and now the shelf's reorder
 * voice. The morning ritual is real: look at what the week will burn,
 * then message the supplier (or the partner, or the owner's own notes)
 * — through the house PICKER (wa.me/?text=), the owner decides which
 * chat; ServePoint never guesses a recipient. The voice is the house's
 * 32-column register, and it speaks the WHOLE truth: the buy lines with
 * (owner-editable) quantities and estimated rupees when the shelf runs
 * short, and the honest "covers the week" verdict with the watched SKUs'
 * days of cover when it doesn't — a healthy shelf is news too. Exported
 * pure so E2E can assert the text without touching the clipboard. */
export interface ReorderTextOpts {
  storeName: string;
  coverDays: number;
  buys: { name: string; qty: string; unit: string; est: number }[];
  estTotal: number;
  watching: { name: string; daysLeft: number }[];
}

export function buildReorderText(opts: ReorderTextOpts): string {
  const W = 32;
  const hr = '-'.repeat(W);
  const center = (s: string): string =>
    s.length >= W ? s : ' '.repeat(Math.floor((W - s.length) / 2)) + s;
  const two = (l: string, r: string): string => {
    const cut = Math.max(1, W - r.length - 1);
    const left = l.length > cut ? `${l.slice(0, cut - 1)}…` : l;
    return left.padEnd(W - r.length, ' ') + r;
  };

  const out: string[] = [];
  out.push(center(opts.storeName));
  out.push(center(`SHOPPING LIST · ${opts.coverDays}-DAY COVER`));
  out.push(hr);
  if (opts.buys.length === 0) {
    out.push('THE SHELF COVERS THE WEEK');
    /* full-width sentence, deliberately NOT a two() row — the verdict is
     * prose, and a truncated "Every burning …" would break the English. */
    out.push(`Every burning SKU has ${opts.coverDays}+ days.`);
  } else {
    opts.buys.forEach((b, i) => {
      out.push(two(`${i + 1}. ${b.name}`, formatMoney(b.est)));
      out.push(`   × ${b.qty} ${b.unit}`);
    });
    out.push(two('Est basket', formatMoney(opts.estTotal)));
  }
  if (opts.watching.length > 0) {
    out.push(hr);
    out.push(opts.buys.length === 0 ? 'WATCHING · COVER' : 'ALSO WATCHING');
    for (const w of opts.watching)
      out.push(two(w.name, `${Math.max(1, Math.round(w.daysLeft))}d cover`));
  }
  out.push(hr);
  out.push(center(`Shared ${appFormatters().hhmm.format(new Date())} ${appTzTag()}`));
  out.push(center('· · · end of list · · ·'));
  return out.join('\n');
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
  storeName: string;
}> = ({ items, deductions, onRestock, storeName }) => {
  const rows = useMemo(() => buildReorderRows(items, deductions), [items, deductions]);
  const [edits, setEdits] = useState<Record<string, string>>({});
  /* v5.150.0 — the copy button joins the arc's honest tri-state: ok/fail
   * said out loud (aria-live), the 1.8s reset the bill taught (5.145.0);
   * the old silent catch is gone. */
  const [copyState, setCopyState] = useState<'idle' | 'ok' | 'fail'>('idle');

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

  /* v5.150.0 — one assembly feeds Copy, WhatsApp and nothing else; the
   * screen's buy rows and watch rows can never disagree with the chat
   * text (the 5.146.0 one-assembly rule, shelf edition). The owner's
   * edited Buy quantities ride along via effectiveQty. */
  const buildOpts = (): ReorderTextOpts => ({
    storeName,
    coverDays: REORDER_COVER_DAYS,
    buys: buyRows.map((r) => ({
      name: r.item.name,
      qty: fmtQty(effectiveQty(r)),
      unit: r.item.unit,
      est: effectiveQty(r) * Number(r.item.cost_per_unit ?? 0),
    })),
    estTotal: listCost,
    watching: watchRows.slice(0, 4).map((r) => ({
      name: r.item.name,
      daysLeft: r.daysLeft ?? 0,
    })),
  });
  const shareable = buyRows.length > 0 || watchRows.length > 0;

  const copyList = async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('clipboard unavailable');
      await navigator.clipboard.writeText(buildReorderText(buildOpts()));
      setCopyState('ok');
    } catch {
      setCopyState('fail');
    }
    window.setTimeout(() => setCopyState('idle'), 1800);
  };

  const exportList = useCallback(() => {
    if (buyRows.length === 0) return;
    /* v5.106.0 — the filename carries the reporting day (appday), the same
       word the shelf's reports speak; the old name was hardcoded IST. */
    const todayIso = appTodayIso();
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
              disabled={!shareable}
              aria-live="polite"
              aria-label="Copy the shopping list as text"
              className="flex h-11 items-center gap-1.5 rounded-xl border border-[#E3E7E0] bg-white px-3 text-[12.5px] font-bold text-[#0F3D3E] transition hover:border-[#B88E2F] hover:text-[#B88E2F] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B88E2F] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {copyState === 'ok' ? (
                <Check size={14} className="text-[#2E7D32]" aria-hidden />
              ) : (
                <Copy size={14} aria-hidden />
              )}
              {copyState === 'ok' ? 'Copied' : copyState === 'fail' ? 'Copy blocked' : 'Copy'}
            </button>
            {/* v5.150.0 — the list's chat voice: the house PICKER, the owner
                decides which chat (supplier, partner, own notes). Same ghost
                grammar as the bill's, the Z's, the range's and the offer's
                share rows. */}
            <a
              href={shareable ? `https://wa.me/?text=${encodeURIComponent(buildReorderText(buildOpts()))}` : undefined}
              target="_blank"
              rel="noopener noreferrer"
              aria-disabled={!shareable}
              aria-label="Share the shopping list on WhatsApp"
              className={`flex h-11 items-center gap-1.5 rounded-xl border border-[#E3E7E0] bg-white px-3 text-[12.5px] font-bold text-[#0F3D3E] transition hover:border-[#B88E2F] hover:text-[#B88E2F] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B88E2F] ${shareable ? '' : 'pointer-events-none opacity-40'}`}
            >
              <MessageCircle size={14} aria-hidden />
              WhatsApp
            </a>
            <button
              onClick={exportList}
              disabled={buyRows.length === 0}
              aria-label="Export shopping list as CSV"
              title="Export the shopping list as CSV (opens in Excel / Sheets)"
              className="flex h-11 items-center gap-1.5 rounded-xl border border-[#E3E7E0] bg-white px-3 text-[12.5px] font-bold text-[#0F3D3E] transition hover:border-[#B88E2F] hover:text-[#B88E2F] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B88E2F] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Download size={15} aria-hidden />
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
