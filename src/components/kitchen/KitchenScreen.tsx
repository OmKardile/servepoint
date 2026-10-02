import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BellRing,
  CheckCheck,
  ChefHat,
  ChefHat as ChefIdle,
  CircleSlash,
  Clock,
  Flame,
  Loader2,
  RefreshCw,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { advanceOrder, fetchOrders, subscribeOrdersRealtime, type RealtimeState } from '../../lib/api';
import { useTenant } from '../../lib/tenant';
import type { Order } from '../../types';

/**
 * Kitchen Display System (ServePoint, NOVA roadmap item #1).
 * A live rail for the kitchen: every order card advances through
 * New → Preparing → Ready → Completed via the guarded engine
 * (sp_advance_order), and the board refreshes in realtime from
 * postgres_changes on orders/order_items (migration 010).
 * The counter is still the money gate — charging lives in Bills.
 */

/* ───────────────────────────── board model ────────────────────────────── */

type StageKey = 'new' | 'preparing' | 'ready' | 'completed';

const STAGES: {
  key: StageKey;
  title: string;
  pill: string; // header dot
}[] = [
  { key: 'new', title: 'Queued', pill: 'bg-[#B88E2F]' },
  { key: 'preparing', title: 'Preparing', pill: 'bg-[#C2571B]' },
  { key: 'ready', title: 'Ready to serve', pill: 'bg-[#2E7D32]' },
  { key: 'completed', title: 'Completed', pill: 'bg-[#0F3D3E]' },
];

const TYPE_LABEL: Record<string, string> = {
  dine_in: 'Dine-in',
  takeaway: 'Takeaway',
  delivery: 'Delivery',
};

function stageOf(status: string): StageKey | null {
  const s = String(status || '').toLowerCase();
  // Counter-gate (v5.3.0): `new` tickets live in the counter inbox on New
  // Sale — the KDS never sees them. The kitchen's first column is the QUEUE
  // (`pending`): tickets the counter has Oked. Ok fires them here.
  if (s === 'pending') return 'new';
  if (s === 'preparing') return 'preparing';
  if (s === 'ready') return 'ready';
  if (s === 'completed') return 'completed';
  return null; // `new` (counter inbox) + cancelled — hidden from the rail
}

function isSameLocalDay(iso: string): boolean {
  return new Date(iso).toDateString() === new Date().toDateString();
}

/** Elapsed since created_at, KDS style: 0:42 under an hour, then 1:04:09. */
function elapsed(createdIso: string, nowMs: number): string {
  const diff = Math.max(0, nowMs - new Date(createdIso).getTime());
  const s = Math.floor(diff / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

/** Waiting too long? Escalate the timer color: green → amber (10m) → red (20m). */
function waitTone(createdIso: string, nowMs: number, terminal: boolean): string {
  if (terminal) return '#969696';
  const mins = (nowMs - new Date(createdIso).getTime()) / 60000;
  if (mins >= 20) return '#B42318';
  if (mins >= 10) return '#B88E2F';
  return '#2E7D32';
}

/* ───────────────────────────── new-order chime ────────────────────────── */

function chime(): void {
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const t0 = ctx.currentTime;
    [880, 1174.66].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const at = t0 + i * 0.18;
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.12, at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.38);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(at);
      osc.stop(at + 0.42);
    });
    window.setTimeout(() => void ctx.close().catch(() => {}), 1500);
  } catch {
    /* audio is best-effort */
  }
}

/* ───────────────────────────── building blocks ────────────────────────── */

const TypeChip: React.FC<{ type: string }> = ({ type }) => {
  const label = TYPE_LABEL[String(type)] || String(type);
  const tint =
    String(type) === 'delivery'
      ? 'text-[#B42318] border-[#B42318]/30'
      : String(type) === 'takeaway'
        ? 'text-[#0F3D3E] border-[#0F3D3E]/25'
        : 'text-[#7A5B18] border-[#B88E2F]/35';
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10.5px] font-semibold leading-4 ${tint}`}>{label}</span>
  );
};

const KdsCard: React.FC<{
  order: Order;
  nowMs: number;
  busy: boolean;
  onAdvance: (o: Order, to: 'preparing' | 'ready' | 'completed') => void;
  onCancel: (o: Order) => void;
}> = ({ order, nowMs, busy, onAdvance, onCancel }) => {
  const stage = stageOf(String(order.status))!;
  const terminal = stage === 'completed';
  const paid = String(order.payment_status).toLowerCase() === 'completed';
  const [confirming, setConfirming] = useState(false);
  useEffect(() => {
    if (!confirming) return;
    const t = window.setTimeout(() => setConfirming(false), 3000);
    return () => window.clearTimeout(t);
  }, [confirming]);

  const actionLabel =
    stage === 'new' ? 'Start preparing' : stage === 'preparing' ? 'Mark ready' : stage === 'ready' ? 'Complete' : null;
  const ActionIcon = stage === 'new' ? Flame : stage === 'preparing' ? BellRing : CheckCheck;

  return (
    <article
      className={`rounded-2xl border border-[#EDEBE6] bg-white p-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition ${
        busy ? 'opacity-60' : 'hover:shadow-[0_4px_14px_rgba(15,23,42,0.08)]'
      }`}
      style={{ borderLeft: `3px solid ${terminal ? '#D9E2DD' : waitTone(order.created_at, nowMs, false)}` }}
      aria-label={`Order ${order.order_number} — ${STAGES.find((s) => s.key === stage)?.title}`}
    >
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[15px] font-bold leading-5 text-[#1A1A1A]">
            #{order.order_number}
            {order.customer_name && (
              <span className="ml-1.5 truncate text-[12px] font-medium text-[#969696]">· {order.customer_name}</span>
            )}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <TypeChip type={String(order.order_type)} />
            {terminal &&
              (paid ? (
                <span className="rounded-full bg-[#2E7D32]/10 px-2 py-0.5 text-[10.5px] font-semibold leading-4 text-[#2E7D32]">
                  Paid
                </span>
              ) : (
                <span className="rounded-full bg-[#B88E2F]/12 px-2 py-0.5 text-[10.5px] font-semibold leading-4 text-[#7A5B18]">
                  Unpaid · bill at counter
                </span>
              ))}
          </div>
        </div>
        <span
          className="shrink-0 rounded-lg px-1.5 py-1 font-mono text-[12.5px] font-bold tabular-nums"
          style={{ color: waitTone(order.created_at, nowMs, terminal), background: 'rgba(0,0,0,0.035)' }}
          title="Time since the order was placed"
        >
          <Clock size={11} className="mb-0.5 mr-0.5 inline" aria-hidden />
          {elapsed(order.created_at, nowMs)}
        </span>
      </header>

      <ul className="mt-2.5 space-y-1.5">
        {(order.items || []).map((it) => (
          <li key={it.id} className="flex items-baseline gap-2 text-[13px] leading-5">
            <span className="min-w-7 rounded-md bg-[#F6F5F2] px-1.5 text-center font-mono text-[11.5px] font-bold text-[#0F3D3E]">
              {it.qty}×
            </span>
            <span className="min-w-0 flex-1">
              <span className="font-medium text-[#1A1A1A]">{it.name}</span>
              {it.variant_name && <span className="text-[#969696]"> · {it.variant_name}</span>}
              {it.notes && <span className="block text-[11.5px] italic text-[#C2571B]">↳ {it.notes}</span>}
            </span>
          </li>
        ))}
        {(order.items || []).length === 0 && <li className="text-[12px] text-[#969696]">No items recorded</li>}
      </ul>

      {order.notes && (
        <p className="mt-2 truncate rounded-lg bg-[#F6F5F2] px-2 py-1 text-[11.5px] text-[#5B6B63]" title={order.notes}>
          {order.notes}
        </p>
      )}

      {(actionLabel || !terminal) && (
        <footer className="mt-3 flex items-center gap-2">
          {actionLabel && (
            <button
              onClick={() =>
                onAdvance(order, stage === 'new' ? 'preparing' : stage === 'preparing' ? 'ready' : 'completed')
              }
              disabled={busy}
              className="sp-cta flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl text-[12.5px] disabled:cursor-wait"
            >
              {busy ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <ActionIcon size={14} aria-hidden />}
              {actionLabel}
            </button>
          )}
          {!terminal && (
            <button
              onClick={() => {
                if (confirming) {
                  setConfirming(false);
                  onCancel(order);
                } else setConfirming(true);
              }}
              disabled={busy}
              aria-label={`Cancel order ${order.order_number}`}
              title={confirming ? 'Tap again to confirm' : 'Cancel this order'}
              className={`flex h-9 items-center justify-center rounded-xl border px-2.5 text-[12px] font-semibold transition ${
                confirming
                  ? 'border-[#B42318] bg-[#B42318] text-white'
                  : 'border-[#E3E7E0] bg-white text-[#969696] hover:border-[#B42318]/40 hover:text-[#B42318]'
              }`}
            >
              {confirming ? 'Sure?' : <CircleSlash size={14} aria-hidden />}
            </button>
          )}
        </footer>
      )}
    </article>
  );
};

const EmptyStage: React.FC<{ stage: StageKey }> = ({ stage }) => {
  const icons: Record<StageKey, React.ElementType> = {
    new: ChefIdle,
    preparing: Flame,
    ready: BellRing,
    completed: CheckCheck,
  };
  const copy: Record<StageKey, string> = {
    new: 'Queue is clear — all caught up',
    preparing: 'Nothing on the fire',
    ready: 'Nothing waiting to serve',
    completed: 'Nothing completed yet today',
  };
  const Icon = icons[stage];
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-[#D9DEDA] bg-white/40 px-3 py-7 text-center">
      <Icon size={20} className="text-[#B9C4BE]" aria-hidden />
      <p className="text-[12px] font-medium text-[#969696]">{copy[stage]}</p>
    </div>
  );
};

/* ───────────────────────────── the screen ─────────────────────────────── */

export const KitchenScreen: React.FC = () => {
  const { tenant, tenantId, error: tenantError, loading: tenantLoading } = useTenant();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rtState, setRtState] = useState<RealtimeState>('connecting');
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [soundOn, setSoundOn] = useState(() => {
    try {
      return window.localStorage.getItem('sp.kds.sound') !== 'off';
    } catch {
      return true;
    }
  });
  const soundRef = useRef(soundOn);
  soundRef.current = soundOn;

  /* one ticking clock for every elapsed timer */
  useEffect(() => {
    const t = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  /* data: initial load + debounced realtime pings + 30s safety poll */
  const pingRef = useRef<number | null>(null);
  const refetch = useCallback(async () => {
    if (!tenantId) return;
    try {
      const rows = await fetchOrders(tenantId, 100);
      setOrders(rows);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  const scheduleRefetch = useCallback(() => {
    if (pingRef.current) window.clearTimeout(pingRef.current);
    pingRef.current = window.setTimeout(() => void refetch(), 250);
  }, [refetch]);

  useEffect(() => {
    if (!tenantId) return;
    setLoading(true);
    void refetch();
  }, [tenantId, refetch]);

  useEffect(() => {
    if (!tenantId) return;
    const unsubscribe = subscribeOrdersRealtime(tenantId, scheduleRefetch, setRtState);
    const poll = window.setInterval(() => void refetch(), 30_000);
    return () => {
      unsubscribe();
      window.clearInterval(poll);
      if (pingRef.current) window.clearTimeout(pingRef.current);
    };
  }, [tenantId, scheduleRefetch, refetch]);

  /* chime when an accepted ticket (pending) lands in the kitchen queue */
  const seenNewRef = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (loading) return;
    const current = new Set(orders.filter((o) => stageOf(String(o.status)) === 'new').map((o) => o.id));
    if (seenNewRef.current === null) {
      seenNewRef.current = current; // first paint: baseline, no chime
      return;
    }
    let fresh = false;
    current.forEach((id) => {
      if (!seenNewRef.current!.has(id)) fresh = true;
    });
    if (fresh && soundRef.current) chime();
    seenNewRef.current = current;
  }, [orders, loading]);

  /* engine actions */
  const advance = useCallback(
    async (o: Order, to: 'preparing' | 'ready' | 'completed') => {
      if (!tenantId) return;
      setBusyId(o.id);
      try {
        await advanceOrder(o.id, tenantId, to);
        await refetch();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not update the order');
      } finally {
        setBusyId(null);
      }
    },
    [tenantId, refetch]
  );

  const cancel = useCallback(
    async (o: Order) => {
      if (!tenantId) return;
      setBusyId(o.id);
      try {
        await advanceOrder(o.id, tenantId, 'cancelled');
        await refetch();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not cancel the order');
      } finally {
        setBusyId(null);
      }
    },
    [tenantId, refetch]
  );

  const toggleSound = useCallback(() => {
    setSoundOn((v) => {
      const next = !v;
      try {
        window.localStorage.setItem('sp.kds.sound', next ? 'on' : 'off');
      } catch {
        /* storage optional */
      }
      if (next) chime(); // audible confirmation + unlocks AudioContext on a user gesture
      return next;
    });
  }, []);

  /* board data — today only; completed capped to the newest 12 */
  const board = useMemo(() => {
    const todays = orders.filter((o) => isSameLocalDay(o.created_at) && stageOf(String(o.status)) !== null);
    const byStage = new Map<StageKey, Order[]>([
      ['new', []],
      ['preparing', []],
      ['ready', []],
      ['completed', []],
    ]);
    todays.forEach((o) => {
      const st = stageOf(String(o.status));
      if (st) byStage.get(st)!.push(o);
    });
    byStage.forEach((list) => list.sort((a, b) => a.created_at.localeCompare(b.created_at)));
    const completed = byStage.get('completed')!;
    const overflow = Math.max(0, completed.length - 12);
    if (overflow > 0) byStage.set('completed', completed.slice(overflow));
    const activeWait = [...byStage.get('new')!, ...byStage.get('preparing')!, ...byStage.get('ready')!];
    const oldest = activeWait.reduce<string | null>(
      (acc, o) => (!acc || o.created_at < acc ? o.created_at : acc),
      null
    );
    const cancelled = orders.filter(
      (o) => String(o.status).toLowerCase() === 'cancelled' && isSameLocalDay(o.created_at)
    ).length;
    return {
      byStage,
      overflow,
      oldestWait: oldest ? elapsed(oldest, nowMs) : null,
      cancelledToday: cancelled,
    };
  }, [orders, nowMs]);

  if (tenantLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="animate-spin text-[#969696]" aria-hidden />
      </div>
    );
  }
  if (tenantError || !tenant || !tenantId) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <ChefHat className="text-[#969696]" size={30} aria-hidden />
        <p className="text-[14px] font-semibold text-[#1A1A1A]">Kitchen board unavailable</p>
        <p className="max-w-md text-[12.5px] text-[#969696]">
          {tenantError || 'No workspace found for this account.'}
        </p>
      </div>
    );
  }

  const rtChip =
    rtState === 'live'
      ? { cls: 'bg-[#2E7D32]/10 text-[#2E7D32]', dot: 'bg-[#2E7D32]', label: 'Live' }
      : rtState === 'connecting'
        ? { cls: 'bg-[#B88E2F]/10 text-[#7A5B18]', dot: 'bg-[#B88E2F]', label: 'Connecting…' }
        : { cls: 'bg-[#B42318]/10 text-[#B42318]', dot: 'bg-[#B42318]', label: 'Polling 30s' };

  return (
    <div className="flex h-full flex-col gap-4 overflow-hidden p-4 lg:p-5">
      {/* header strip */}
      <header className="flex flex-wrap items-center gap-3">
        <div className="min-w-0">
          <h1 className="text-[19px] font-bold text-[#1A1A1A]">Kitchen Display</h1>
          <p className="text-[12.5px] text-[#969696]">
            {tenant.name} · live rail for the pass — statuses move through the guarded engine
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <span
            className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold ${rtChip.cls}`}
            title={
              rtState === 'live'
                ? 'Realtime stream connected — orders appear instantly'
                : rtState === 'connecting'
                  ? 'Establishing the realtime stream'
                  : 'Realtime unavailable — refreshing every 30 seconds'
            }
          >
            <span className="relative flex h-1.5 w-1.5">
              {rtState === 'live' && (
                <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${rtChip.dot} opacity-60`} />
              )}
              <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${rtChip.dot}`} />
            </span>
            {rtChip.label}
          </span>
          <button
            onClick={toggleSound}
            aria-pressed={soundOn}
            title={soundOn ? 'New-order chime on' : 'New-order chime muted'}
            className={`flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-[12px] font-semibold transition ${
              soundOn ? 'border-[#B88E2F]/40 bg-[#B88E2F]/10 text-[#7A5B18]' : 'border-[#E3E7E0] bg-white text-[#969696]'
            }`}
          >
            {soundOn ? <Volume2 size={14} aria-hidden /> : <VolumeX size={14} aria-hidden />}
            {soundOn ? 'Chime on' : 'Muted'}
          </button>
          <button
            onClick={() => void refetch()}
            className="flex h-8 items-center gap-1.5 rounded-full border border-[#E3E7E0] bg-white px-2.5 text-[12px] font-semibold text-[#5B6B63] transition hover:border-[#C9CFC9]"
            title="Refresh now"
          >
            <RefreshCw size={13} aria-hidden />
            Refresh
          </button>
        </div>
      </header>

      {/* stat strip */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {STAGES.map((s) => (
          <div key={s.key} className="flex items-center gap-2.5 rounded-xl border border-[#E3E7E0] bg-white px-3 py-2">
            <span className={`h-2 w-2 shrink-0 rounded-full ${s.pill}`} aria-hidden />
            <p className="min-w-0 truncate text-[11.5px] font-medium text-[#969696]">{s.title}</p>
            <p className="ml-auto font-mono text-[15px] font-bold tabular-nums text-[#1A1A1A]">
              {board.byStage.get(s.key)!.length}
            </p>
          </div>
        ))}
      </div>

      {/* context line */}
      <p className="-mt-2 text-[11.5px] text-[#969696]">
        {board.oldestWait ? (
          <>
            Oldest active ticket waiting{' '}
            <span className="font-mono font-bold text-[#1A1A1A]">{board.oldestWait}</span>
            {board.cancelledToday > 0 && <> · {board.cancelledToday} cancelled today (off rail)</>}
          </>
        ) : (
          <>
            Quiet service — no active tickets
            {board.cancelledToday > 0 ? ` · ${board.cancelledToday} cancelled today` : ''}
          </>
        )}
        {board.overflow > 0 && <> · {board.overflow} older completed orders hidden</>}
      </p>

      {/* error banner */}
      {error && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-xl border border-[#B42318]/30 bg-[#B42318]/8 px-3.5 py-2.5"
        >
          <p className="min-w-0 truncate text-[12.5px] font-medium text-[#B42318]">{error}</p>
          <button
            onClick={() => void refetch()}
            className="shrink-0 text-[12px] font-bold text-[#B42318] underline underline-offset-2"
          >
            Retry
          </button>
        </div>
      )}

      {/* the rail */}
      {loading && orders.length === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="animate-spin text-[#969696]" aria-hidden />
        </div>
      ) : (
        <div className="grid flex-1 auto-rows-min grid-cols-1 content-start gap-3 overflow-y-auto pb-2 sm:grid-cols-2 xl:grid-cols-4">
          {STAGES.map((stage) => {
            const list = board.byStage.get(stage.key)!;
            return (
              <section
                key={stage.key}
                className="flex min-w-0 flex-col gap-2.5 rounded-2xl bg-[#F6F5F2]/60 p-2.5"
                aria-label={`${stage.title} orders`}
              >
                <div className="flex items-center gap-2 px-1">
                  <span className={`h-2 w-2 rounded-full ${stage.pill}`} aria-hidden />
                  <h2 className="text-[12.5px] font-bold uppercase tracking-[0.08em] text-[#5B6B63]">
                    {stage.title}
                  </h2>
                  <span className="ml-auto rounded-full bg-white px-2 py-0.5 font-mono text-[11px] font-bold text-[#1A1A1A]">
                    {list.length}
                  </span>
                </div>
                {list.length === 0 ? (
                  <EmptyStage stage={stage.key} />
                ) : (
                  list.map((o) => (
                    <KdsCard
                      key={o.id}
                      order={o}
                      nowMs={nowMs}
                      busy={busyId === o.id}
                      onAdvance={(ord, to) => void advance(ord, to)}
                      onCancel={(ord) => void cancel(ord)}
                    />
                  ))
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default KitchenScreen;
