import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import {
  Armchair,
  BellRing,
  CalendarDays,
  Check,
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
import {
  advanceOrder,
  /* v5.245.0 — the board reads the day it speaks: fetchTodayOrders' bounds
   * are the app-today the board's own isSameAppDay verdicts mean, so the
   * columns can never go blind to today's oldest work on a busy ledger
   * (fetchOrders' all-time newest-100 window is extinct here). */
  fetchTodayOrders,
  setOrderItemChecked,
  subscribeOrdersRealtime,
  type RealtimeState,
} from '../../lib/api';
import { useTenant } from '../../lib/tenant';
import { hhmm } from '../../lib/day';
/* v5.239.0 — the board's day grammar is the app's clock (isSameAppDay):
 * the counters, the cancelled-today clause and the quiet line's memory
 * answer "today" the same way the Close-out's book does — one day in
 * every room, never the browser's. The grammar stays INJECTED —
 * lastRailTicketAt still takes it, suites still own now. */
import { isSameAppDay, appFormatters } from '../../lib/appday';
import { isQuietNow, subscribePrefs } from '../../lib/prefs';
/* v5.279.0 — the amber escalation rides the ONE constant (lib/age's
 * AGE_SLA_MIN — the same 10 the EOD strip mirrors and Reports counts);
 * the RED line (20m) stays the kitchen's own judgment below. */
import { AGE_SLA_MIN } from '../../lib/age';
import type { Order } from '../../types';

/**
 * Kitchen Display System (ServePoint, NOVA roadmap item #1).
 * A live rail for the kitchen: every order card advances through
 * New → Preparing → Ready → Completed via the guarded engine
 * (sp_advance_order), and the board refreshes in realtime from
 * postgres_changes on orders/order_items (migration 010).
 * The counter is still the money gate — charging lives in Bills.
 * v5.25.0: table-bound tickets grow a solid TABLE chip (resolved from the
 * table_id FK in fetchOrders) — the runner sees WHERE without reading notes.
 * v5.31.0: the pass wears the crest — the header carries the café's logo
 * tile (same brand row the guest ticket has worn since 5.28), and READY
 * cards get a quiet green wash so the run-the-food moment reads from
 * across the kitchen. No logo set → the header is exactly pre-5.31.
 * v5.39.0: the pass learns to tick (migration 029) — every line on a live
 * ticket is a checkbox the cook taps the moment it fires: struck through,
 * qty chip flips to a check. A fired-fraction bar counts the ticket down
 * ("fired 1/2"), an ALL FIRED chip crowns a finished rail card, and the
 * red-tier timer (20m+) breathes — urgency you can see from the pass.
 * v5.228.0: the quiet line remembers its last ticket — a quiet board is
 * two different stories (the day passed through and the rail is empty
 * again, or the day has not reached the kitchen yet), and the context
 * line now says which: "last ticket HH:MM" when a ticket landed today,
 * "nothing yet today" when the kitchen has seen nothing (lastRailTicketAt,
 * the pure read beside isOnRail).
 * v5.229.0: the line carries the day's tally — the context line said how
 * LONG the oldest ticket has waited and WHEN the last one landed, but
 * never how FAR the day has come: the pass's Completed column keeps the
 * newest 12 (overflow hidden), so on a 14-ticket day the true count lived
 * nowhere on the board. Both branches now speak "· N completed today"
 * when the day has completed anything (silence, never a zero) — the
 * UNCAPPED count, captured before the column's cap so tally = column +
 * overflow always; the tally's number wears the completed stage's own
 * ink (#0F3D3E, the pill's color); and the Completed stat tile whispers
 * "+N" when the column is hiding older work. A cancelled-only day stays
 * stamp-true with no tally — completed ⊂ landed, the two clauses can
 * never disagree.
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

/** v5.196.0 — THE rail-active set, exported so every surface asks the
 * same question. "On the board" means the kitchen rail holds the ticket:
 * queued (`pending`), preparing, or ready. `new` is the counter inbox's
 * (the rail never sees it), `completed` and `cancelled` are done. The
 * dashboard's stuck count and its today's-board count, and Bills' ghost
 * chip, all read THIS — one set, no fork (the dashboard previously
 * counted only pending/preparing while its own oldest-wait clock ran
 * the three-state set: two answers to one question in one file).
 * v5.244.0 — the set grows a second MOUTH: RAIL_STATUSES is the same
 * vocabulary as an array, so the server head-count (api.ts's
 * fetchOffTodayCount — the board's whole-book word) speaks the exact
 * statuses the predicate honours; isOnRail asks the array, and the two
 * mouths can never fork (5.196's law, now reaching the DB's own ear). */
export const RAIL_STATUSES = ['pending', 'preparing', 'ready'] as const;

export function isOnRail(status: string): boolean {
  const s = String(status || '').toLowerCase();
  return (RAIL_STATUSES as readonly string[]).includes(s);
}

/** v5.228.0 — the quiet line's memory. A quiet board is two different
 *  stories: the day passed through and the rail is empty again, or the
 *  day has not reached the kitchen yet. The last ticket that LANDED
 *  answers which — the rail-active stages (isOnRail's own three) plus
 *  the pass's `completed` column plus `cancelled` (a cancelled ticket
 *  did land; the line's own cancelledToday clause already tells that
 *  story, so the two clauses must never disagree — cancelledToday > 0
 *  forces a stamp). The counter inbox's `new` never landed: the
 *  Dashboard's NEEDS YOU NOW owns that voice. The caller passes the day
 *  grammar (isSameAppDay since 5.239.0 — the app's clock, one "today"
 *  in every room) — one day, one derivation, the same bounds
 *  law the floor's week split obeys (5.226). Null when the kitchen has
 *  seen nothing today; the line says so in its own words — silence is
 *  still never a zero, and no new timer: a stamp, not a duration. */
export function lastRailTicketAt(
  orders: { created_at: string; status: string }[],
  sameDay: (iso: string) => boolean
): string | null {
  const landed = orders.filter((o) => {
    const s = String(o.status || '').toLowerCase();
    return (
      sameDay(o.created_at) &&
      (isOnRail(s) || s === 'completed' || s === 'cancelled')
    );
  });
  return landed.reduce<string | null>(
    (acc, o) => (!acc || o.created_at > acc ? o.created_at : acc),
    null
  );
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

/** Waiting too long? Escalate the timer color: green → amber (the house's SLA) → red (20m). */
function waitTone(createdIso: string, nowMs: number, terminal: boolean): string {
  if (terminal) return '#969696';
  const mins = (nowMs - new Date(createdIso).getTime()) / 60000;
  if (mins >= 20) return '#B42318';
  if (mins >= AGE_SLA_MIN) return '#B88E2F';
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

/** v5.25.0 — where the food goes. The runner's answer at a glance: a solid
 *  teal chip with the table number, resolved from order.table_id (the FK),
 *  never from free-text notes. Absent for takeaway/delivery/unbound — no
 *  fake placeholders. */
const TableChip: React.FC<{ label?: string | null }> = ({ label }) => {
  if (!label) return null;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-bold leading-4 text-white"
      style={{ background: '#0F3D3E' }}
      title={`Deliver to table ${label}`}
    >
      <Armchair size={10} aria-hidden strokeWidth={2.5} />
      {label}
    </span>
  );
};

const KdsCard: React.FC<{
  order: Order;
  nowMs: number;
  busy: boolean;
  onAdvance: (o: Order, to: 'preparing' | 'ready' | 'completed') => void;
  onCancel: (o: Order) => void;
  /** v5.39.0 — tick one line fired / waiting (optimistic in the parent). */
  onToggleItem: (orderId: string, itemId: string, checked: boolean, prevCheckedAt: string | null | undefined) => void;
}> = ({ order, nowMs, busy, onAdvance, onCancel, onToggleItem }) => {
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

  /* v5.39.0 — urgency tone once: the left border, the timer chip and the
     red-tier breathing all read the same number. */
  const tone = terminal ? '#D9E2DD' : waitTone(order.created_at, nowMs, false);
  const breathes = !terminal && tone === '#B42318';

  /* the fired count — NULL checked_at = waiting, timestamp = off the cook's mind */
  const items = order.items || [];
  const fired = items.filter((it) => it.checked_at).length;
  const allFired = items.length > 0 && fired === items.length;

  return (
    <article
      className={`rounded-2xl border border-[#EDEBE6] p-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition ${
        /* v5.31.0 — READY reads from across the kitchen: a quiet green wash
         * (DS green at 5%) on the stage where the food is waiting on the
         * runner, not on the cook. Every other stage keeps the white card. */
        stage === 'ready' ? 'bg-[#2E7D32]/[0.05]' : 'bg-white'
      } ${
        busy ? 'opacity-60' : 'hover:shadow-[0_4px_14px_rgba(15,23,42,0.08)]'
      }`}
      style={{ borderLeft: `3px solid ${tone}` }}
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
            <TableChip label={order.table_label} />
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
            {!terminal && allFired && (
              <span
                className="rounded-full bg-[#2E7D32]/12 px-2 py-0.5 text-[10.5px] font-bold leading-4 text-[#2E7D32]"
                title="Every line on this ticket is fired"
              >
                <Check size={10} className="mr-0.5 inline font-bold" aria-hidden strokeWidth={3} />
                ALL FIRED
              </span>
            )}
          </div>
        </div>
        <span
          className={`shrink-0 rounded-lg px-1.5 py-1 font-mono text-[12.5px] font-bold tabular-nums ${breathes ? 'animate-pulse' : ''}`}
          style={{ color: tone, background: 'rgba(0,0,0,0.035)' }}
          title={breathes ? 'Waiting over 20 minutes — oldest tickets first' : 'Time since the order was placed'}
        >
          <Clock size={11} className="mb-0.5 mr-0.5 inline" aria-hidden />
          {elapsed(order.created_at, nowMs)}
        </span>
      </header>

      <ul className="mt-2.5 space-y-1">
        {items.map((it) => {
          const done = Boolean(it.checked_at);
          const interactive = !terminal && Boolean(it.id);
          const line = (
            <>
              <span
                className={`inline-flex min-w-7 items-center justify-center rounded-md px-1.5 py-0.5 text-center font-mono text-[11.5px] font-bold transition ${
                  done ? 'bg-[#2E7D32] text-white' : 'bg-[#F6F5F2] text-[#0F3D3E]'
                }`}
              >
                {done ? <Check size={12} aria-hidden strokeWidth={3} /> : `${it.qty}×`}
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className={`font-medium transition ${
                    done ? 'text-[#969696] line-through decoration-[#C9CFC9]' : 'text-[#1A1A1A]'
                  }`}
                >
                  {it.name}
                </span>
                {it.variant_name && <span className="text-[#969696]"> · {it.variant_name}</span>}
                {/* v5.56.0 — the extras speak on the line (same `+` grammar as
                   the counter inbox / receipts, in the warm #5F6B63 so the
                   barista's eye catches "Extra shot" before the cup leaves). */}
                {it.addons && it.addons.length > 0 && (
                  <span className="text-[#5F6B63]"> + {it.addons.map((a) => a.name).join(', ')}</span>
                )}
                {it.notes && <span className="block text-[11.5px] italic text-[#C2571B]">↳ {it.notes}</span>}
              </span>
            </>
          );
          return (
            <li key={it.id} className="text-[13px] leading-5">
              {interactive ? (
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={done}
                  aria-label={`${done ? 'Un-mark' : 'Mark'} ${it.qty}× ${it.name}${it.variant_name ? ` (${it.variant_name})` : ''}${it.addons && it.addons.length > 0 ? ` + ${it.addons.map((a) => a.name).join(', ')}` : ''} as fired`}
                  onClick={() => onToggleItem(order.id, it.id!, !done, it.checked_at)}
                  title={done ? 'Tap to put back on the line' : 'Tap when it fires'}
                  className={`flex w-full items-baseline gap-2 rounded-lg px-1 py-0.5 text-left transition hover:bg-[#F6F5F2] ${
                    busy ? 'cursor-wait opacity-70' : ''
                  }`}
                >
                  {line}
                </button>
              ) : (
                <div className="flex items-baseline gap-2 px-1 py-0.5">{line}</div>
              )}
            </li>
          );
        })}
        {items.length === 0 && <li className="text-[12px] text-[#969696]">No items recorded</li>}
      </ul>

      {/* v5.39.0 — the fired-fraction bar: the ticket counts itself down */}
      {!terminal && items.length > 0 && (
        <div className="mt-2 flex items-center gap-2" aria-hidden={false}>
          <div
            className="h-1 flex-1 overflow-hidden rounded-full bg-[#EDEBE6]"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={items.length}
            aria-valuenow={fired}
            aria-label={`Fired ${fired} of ${items.length} lines`}
          >
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{ width: `${(fired / items.length) * 100}%`, background: allFired ? '#2E7D32' : '#0F3D3E' }}
            />
          </div>
          <span className="shrink-0 font-mono text-[10.5px] font-bold tabular-nums text-[#969696]">
            fired {fired}/{items.length}
          </span>
        </div>
      )}

      {order.notes && (
        /* v5.255.0 — the word the kitchen must hear, never cut: `truncate`
         * became `line-clamp-3 break-words` (a truncated allergy word is a
         * wrong allergy word — the full word rides the title), and the block
         * wears the amber words-family the guest ticket has spoken since
         * 5.254, with this board's own #C2571B as the left rail (the same
         * colour every item-level note wears on the line above). */
        <p
          className="mt-2 line-clamp-3 break-words rounded-lg border-l-[3px] border-l-[#C2571B] bg-[#FBF6EA] px-2 py-1.5 text-[11.5px] leading-relaxed text-[#6B4A0E]"
          title={order.notes}
        >
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
  /* v5.262.0 — the caught-up whisper: the wake's receipt. When the board
   * refetches because the staff looked (or the network returned), the
   * header raises a quiet chip naming the moment — the cook SEES the
   * catch-up instead of trusting a silent swap. Cleared after 4s; keyed
   * by the instant so a second wake re-rises it. */
  const [caughtUpAt, setCaughtUpAt] = useState<number | null>(null);
  useEffect(() => {
    if (caughtUpAt === null) return;
    const t = window.setTimeout(() => setCaughtUpAt(null), 4000);
    return () => window.clearTimeout(t);
  }, [caughtUpAt]);
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

  /* 5.101.0 — quiet hours: the owner's schedule silences the room. The gate
   * itself is evaluated at sound-time (no remount needed); the tick below
   * only keeps the BUTTON'S WORD current — when quiet hours are live the
   * chip says so instead of claiming a chime that will not ring. */
  const [, tickQuiet] = useReducer((n: number) => n + 1, 0);
  useEffect(() => subscribePrefs(tickQuiet), [tickQuiet]);
  const quietNow = isQuietNow();

  /* v5.31.0 — header brand tile: same honest guard as the guest ticket's
   * brand row (5.28). A dead URL hides its own tile; a logo change un-hides. */
  const [logoBroken, setLogoBroken] = useState(false);
  useEffect(() => setLogoBroken(false), [tenant?.logo_url]);

  /* one ticking clock for every elapsed timer */
  useEffect(() => {
    const t = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  /* data: initial load + debounced realtime pings + 30s safety poll */
  const pingRef = useRef<number | null>(null);
  const pendingTicksRef = useRef<Map<string, boolean>>(new Map());
  const refetch = useCallback(async () => {
    if (!tenantId) return;
    try {
      /* v5.245.0 — the day-bounded read: the board speaks today (its own
       * isSameAppDay verdicts below), so it reads today — every ticket from
       * the day's first minute to its last, uncapped (a day is finite).
       * The all-time newest-100 window went blind to today's oldest work
       * once 100 newer rows stacked past it: a rail ticket past the page
       * never fired, a tally quietly undercounted. The client's day
       * filters stay — the read's [start, end) bounds are byte-equal to
       * isSameAppDay by construction, so the filters now VERIFY instead
       * of rescue. */
      const rows = await fetchTodayOrders(tenantId);
      // overlay ticks still in flight (see toggleItem) — a refetch that
      // started before a tick committed must never clobber the flip
      if (pendingTicksRef.current.size > 0) {
        for (const o of rows) {
          for (const it of o.items || []) {
            if (it.id && pendingTicksRef.current.has(it.id)) {
              it.checked_at = pendingTicksRef.current.get(it.id) ? new Date().toISOString() : null;
            }
          }
        }
      }
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
    /* v5.262.0 — the wake: the board wakes when the staff does. The
     * kitchen tablet sleeps between tickets; mobile browsers throttle
     * background timers (the 30s poll clamps to 1/min or pauses) and the
     * realtime socket can die silently under pressure — the cook who
     * comes back to a rush could stare at a rail up to 30s stale. The
     * wake rides the ONE path (refetch — the same road the realtime ping
     * and the 30s poll ride; no second fetch path exists): visibility
     * (the moment they look) and online (the network's return — a missed
     * ticket is a missed dish). The chime's set-diff reads prev once per
     * orders change, so a catch-up that lands tickets rings exactly once,
     * on return — the one-busy law by the same mechanism as the guest
     * pager's wake (5.261). */
    const wake = () => {
      if (document.visibilityState !== 'visible') return;
      void refetch().then(() => setCaughtUpAt(Date.now()));
    };
    document.addEventListener('visibilitychange', wake);
    window.addEventListener('online', wake);
    return () => {
      unsubscribe();
      window.clearInterval(poll);
      if (pingRef.current) window.clearTimeout(pingRef.current);
      document.removeEventListener('visibilitychange', wake);
      window.removeEventListener('online', wake);
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
    if (fresh && soundRef.current && !isQuietNow()) chime();
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

  /* The kitchen's tick (v5.39.0): optimistic flip with an in-flight overlay
     (pendingTicksRef) so racing refetches can't clobber it, revert + honest
     banner on refusal (the 029 guard rejects ticks on terminal tickets
     server-side). No full refetch — the realtime ping and the 30s poll
     resync the board. */
  const toggleItem = useCallback(
    async (orderId: string, itemId: string, checked: boolean, prevCheckedAt: string | null | undefined) => {
      const stamp = new Date().toISOString();
      pendingTicksRef.current.set(itemId, checked);
      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId
            ? {
                ...o,
                items: (o.items || []).map((it) =>
                  it.id === itemId ? { ...it, checked_at: checked ? stamp : null } : it
                ),
              }
            : o
        )
      );
      try {
        await setOrderItemChecked(itemId, checked);
        pendingTicksRef.current.delete(itemId); // truth now matches the flip
      } catch (e) {
        pendingTicksRef.current.delete(itemId);
        setOrders((prev) =>
          prev.map((o) =>
            o.id === orderId
              ? {
                  ...o,
                  items: (o.items || []).map((it) => (it.id === itemId ? { ...it, checked_at: prevCheckedAt ?? null } : it)),
                }
              : o
          )
        );
        setError(e instanceof Error ? e.message : 'Could not update the line');
      }
    },
    []
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
    const todays = orders.filter((o) => isSameAppDay(o.created_at) && stageOf(String(o.status)) !== null);
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
    /* v5.229.0 — the day's tally: the UNCAPPED completed count, captured
     * BEFORE the column's 12-card cap below. One array, one read — the
     * tally and the column can never disagree: tally = column + overflow
     * exactly (the 5.262 law: a count computed beside a verdict is a
     * second verdict — here the tally IS the verdict the cap reads). */
    const completedToday = completed.length;
    const overflow = Math.max(0, completedToday - 12);
    if (overflow > 0) byStage.set('completed', completed.slice(overflow));
    const activeWait = [...byStage.get('new')!, ...byStage.get('preparing')!, ...byStage.get('ready')!];
    const oldest = activeWait.reduce<string | null>(
      (acc, o) => (!acc || o.created_at < acc ? o.created_at : acc),
      null
    );
    const cancelled = orders.filter(
      (o) => String(o.status).toLowerCase() === 'cancelled' && isSameAppDay(o.created_at)
    ).length;
    return {
      byStage,
      overflow,
      completedToday,
      oldestWait: oldest ? elapsed(oldest, nowMs) : null,
      cancelledToday: cancelled,
      lastTicketAt: lastRailTicketAt(orders, isSameAppDay),
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
        <div className="flex min-w-0 items-center gap-2.5">
          {tenant.logo_url && !logoBroken && (
            <img
              src={tenant.logo_url}
              alt=""
              onError={() => setLogoBroken(true)}
              className="h-10 w-10 shrink-0 rounded-xl border border-[#E3E7E0] bg-white object-contain p-1 shadow-sm"
              title="Café logo — set it in Settings"
            />
          )}
          <div className="min-w-0">
            <h1 className="sp-screen-title">Kitchen Display</h1>
            <p className="text-[12.5px] text-[#969696]">
              {tenant.name} · live rail for the pass — statuses move through the guarded engine
            </p>
          </div>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {/* v5.245.0 — the day-scope chip: the board speaks one day, and now
           * the header SAYS so — the day in the house formatter's own voice
           * (appFormatters' dayLabel), the title naming the whole-day read.
           * One chip language, two rooms (the counter inbox wears its
           * sibling) — the scope word travels with the surfaces. */}
          <span
            className="flex h-8 items-center gap-1.5 rounded-full border border-[#E3E7E0] bg-white px-2.5 text-[12px] font-semibold text-[#5B6B63]"
            title="The board reads the whole day — every ticket from the day's first minute to its last, however busy the ledger runs"
          >
            <CalendarDays size={13} aria-hidden />
            Today · {appFormatters().dayLabel.format(new Date(nowMs))}
          </span>
          {/* v5.262.0 — the caught-up whisper: the wake's receipt, risen in
           * the chip row the day chip made (spFadeIn, the house's own
           * rise; the reduced-motion gate in index.css holds it still).
           * Keyed by the instant so a second wake re-rises, not swaps;
           * the clock is the house's own hhmm (slips and shift clocks).
           * Gone after 4s — a receipt, not a resident. */}
          {caughtUpAt !== null && (
            <span
              key={caughtUpAt}
              className="flex h-8 items-center gap-1.5 rounded-full border border-[#E3E7E0] bg-white px-2.5 text-[12px] font-semibold text-[#5B6B63]"
              title="The board just caught up — the read rode the same path the realtime stream and the 30s poll ride"
              style={{ animation: 'spFadeIn 0.35s ease' }}
            >
              <Check size={13} aria-hidden />
              Caught up · {appFormatters().hhmm.format(new Date(caughtUpAt))}
            </span>
          )}
          <span
            className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold ${rtChip.cls}`}
            title={
              rtState === 'live'
                ? 'Realtime stream connected — orders appear instantly'
                : rtState === 'connecting'
                  ? 'Establishing the realtime stream'
                  : 'Realtime unavailable — refreshing every 30 seconds, and the moment you look back'
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
            title={
              !soundOn
                ? 'New-order chime muted'
                : quietNow
                  ? 'New-order chime on — quiet hours right now, the board still updates'
                  : 'New-order chime on'
            }
            className={`flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-[12px] font-semibold transition ${
              !soundOn
                ? 'border-[#E3E7E0] bg-white text-[#969696]'
                : quietNow
                  ? 'border-[#0F3D3E]/30 bg-[#0F3D3E]/5 text-[#0F3D3E]'
                  : 'border-[#B88E2F]/40 bg-[#B88E2F]/10 text-[#7A5B18]'
            }`}
          >
            {!soundOn ? <VolumeX size={14} aria-hidden /> : <Volume2 size={14} aria-hidden />}
            {!soundOn ? 'Muted' : quietNow ? 'Chime on · quiet' : 'Chime on'}
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
            {/* v5.229.0 — the Completed tile whispers "+N" when the column
             * hides older work: the tile still speaks the column's own
             * count (12), the whisper names the hidden — the same words
             * the context line's overflow clause uses (5.198: two
             * surfaces, one register, one number). */}
            <p className="ml-auto flex items-baseline gap-1 font-mono text-[15px] font-bold tabular-nums text-[#1A1A1A]">
              {board.byStage.get(s.key)!.length}
              {s.key === 'completed' && board.overflow > 0 && (
                <span
                  className="text-[11px] font-semibold text-[#969696]"
                  title={`${board.overflow} older completed orders hidden — the day's tally is ${board.completedToday}`}
                >
                  +{board.overflow}
                </span>
              )}
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
            {/* v5.229.0 — the day's tally, after the wait and before the
             * cancelled aside: how far the day has come. The number wears
             * the completed stage's own ink (#0F3D3E — the pill's color). */}
            {board.completedToday > 0 && (
              <>
                {' · '}
                <span
                  className="font-semibold text-[#0F3D3E]"
                  title="Completed today — the day's tally; the column keeps the newest 12"
                >
                  {board.completedToday}
                </span>{' '}
                completed today
              </>
            )}
            {board.cancelledToday > 0 && <> · {board.cancelledToday} cancelled today (off rail)</>}
          </>
        ) : (
          <>
            Quiet service — no active tickets
            {board.lastTicketAt
              ? ` · last ticket ${hhmm(board.lastTicketAt)}`
              : ' · nothing yet today'}
            {/* v5.229.0 — the quieter case hears the tally too (5.266: a
             * card's sub-voice inherits the headline's blindness): a quiet
             * board at day's end says the day's SIZE, not just its last
             * moment. Zero completes = silence, never a zero. */}
            {board.completedToday > 0 && (
              <>
                {' · '}
                <span
                  className="font-semibold text-[#0F3D3E]"
                  title="Completed today — the day's tally; the column keeps the newest 12"
                >
                  {board.completedToday}
                </span>{' '}
                completed today
              </>
            )}
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
                      onToggleItem={(orderId, itemId, checked, prev) => void toggleItem(orderId, itemId, checked, prev)}
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
