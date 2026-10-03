import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import {
  BellRing,
  ChevronDown,
  CircleSlash,
  QrCode,
  ShoppingBag,
  Timer,
  TriangleAlert,
  User,
  Volume2,
  VolumeX,
  Wifi,
  WifiOff,
} from 'lucide-react';
import type { Order } from '../../types';
import { isQuietNow, subscribePrefs } from '../../lib/prefs';
import {
  advanceOrder,
  fetchOrders,
  fetchTables,
  subscribeOrdersRealtime,
  type DiningTable,
  type RealtimeState,
} from '../../lib/api';
import { useTenant } from '../../lib/tenant';
import { formatMoney } from '../../lib/prefs';
import { isSameLocalDay } from '../../lib/day';

/**
 * CounterInbox (v5.3.0 — "the counter is the gate", NOVA rule #1).
 *
 * Guest QR tickets and walk-in sales land as `new` orders. They appear HERE,
 * on New Sale, with full ticket detail (items, variants, add-ons, notes) —
 * and NOWHERE else: the KDS never sees `new`. Only this inbox's "Ok" fires a
 * ticket into the kitchen queue (`pending`); "Decline" kills it. Recording a
 * payment on an un-started ticket auto-advances it (money in hand ⇒ cook).
 */

/* ── counter doorbell — two soft notes, distinct from the KDS chime ─────── */
function doorbell(): void {
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const t0 = ctx.currentTime;
    [659.25, 987.77].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const at = t0 + i * 0.14;
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.1, at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.42);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(at);
      osc.stop(at + 0.46);
    });
    window.setTimeout(() => void ctx.close().catch(() => {}), 900);
  } catch {
    /* audio optional */
  }
}

function ageMinutes(createdIso: string, nowMs: number): number {
  return Math.max(0, (nowMs - new Date(createdIso).getTime()) / 60_000);
}

function ageLabel(createdIso: string, nowMs: number): string {
  const m = Math.floor(ageMinutes(createdIso, nowMs));
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

/* ───────────────────────────── ticket card ────────────────────────────── */

const TicketCard: React.FC<{
  order: Order;
  tableLabel: string | null;
  nowMs: number;
  busy: boolean;
  confirming: boolean;
  onOk: () => void;
  onDecline: () => void;
}> = ({ order, tableLabel, nowMs, busy, confirming, onOk, onDecline }) => {
  const mins = ageMinutes(order.created_at, nowMs);
  const ageTone =
    mins >= 10 ? 'text-[#B3261E] bg-[#FCEBEA]' : mins >= 5 ? 'text-[#8A5A00] bg-[#FFF4DB]' : 'text-[#5F6B63] bg-[#F0F2EF]';
  // Guest QR tickets carry a real dining-table FK (sp_create_public_order
  // resolves the scanned table). Counter walk-ins have none. (The type's
  // table_session_id is never populated — orders don't link sessions yet.)
  const isQr = Boolean(order.table_id);
  return (
    <article
      className="flex w-[300px] max-w-full shrink-0 flex-col gap-3 rounded-2xl border border-[#E3E7E0] bg-white p-4 shadow-[0_1px_2px_rgba(15,61,62,0.05)] transition-shadow hover:shadow-[0_4px_14px_rgba(15,61,62,0.10)]"
      aria-label={`Ticket ${order.order_number}`}
    >
      {/* identity row */}
      <header className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-[15px] font-extrabold tracking-tight text-[#1A1A1A]">
            #{order.order_number}
          </span>
          {isQr ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#FFF4DB] px-2 py-0.5 text-[11px] font-bold text-[#8A5A00]">
              <QrCode size={11} aria-hidden />
              {tableLabel ? `QR · Table ${tableLabel}` : 'QR table'}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#EAF0EC] px-2 py-0.5 text-[11px] font-bold text-[#0F3D3E]">
              <ShoppingBag size={11} aria-hidden />
              Walk-in
            </span>
          )}
        </div>
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums ${ageTone}`}
          title="Waiting at the counter"
        >
          <Timer size={11} aria-hidden />
          {ageLabel(order.created_at, nowMs)}
        </span>
      </header>

      {order.customer_name ? (
        <p className="flex items-center gap-1.5 text-[12px] font-semibold text-[#5F6B63]">
          <User size={12} aria-hidden />
          for {order.customer_name}
        </p>
      ) : null}

      {/* full ticket detail — the whole point of the gate */}
      <ul className="flex flex-col gap-1.5 border-t border-dashed border-[#E3E7E0] pt-2.5">
        {(order.items || []).map((it, idx) => (
          <li key={it.id || idx} className="text-[12.5px] leading-snug">
            <span className="font-bold text-[#1A1A1A]">
              {it.qty} × {it.name}
            </span>
            {it.variant_name ? (
              <span className="text-[#5F6B63]"> · {it.variant_name}</span>
            ) : null}
            {it.addons && it.addons.length > 0 ? (
              <span className="block pl-4 text-[11.5px] text-[#8A5A00]">
                + {it.addons.map((a) => a.name).join(', ')}
              </span>
            ) : null}
            {it.notes ? (
              <span className="block pl-4 text-[11.5px] italic text-[#6B6B6B]">“{it.notes}”</span>
            ) : null}
          </li>
        ))}
        {(order.items || []).length === 0 ? (
          <li className="text-[12px] italic text-[#969696]">No line items</li>
        ) : null}
      </ul>

      {order.notes ? (
        <p className="rounded-lg bg-[#F7F8F6] px-2.5 py-1.5 text-[11.5px] italic text-[#5F6B63]">
          {order.notes}
        </p>
      ) : null}

      <footer className="mt-auto flex items-center justify-between border-t border-[#E3E7E0] pt-2.5">
        <span className="text-[13px] font-extrabold tabular-nums text-[#0F3D3E]">
          {formatMoney(order.total)}
          <span className="ml-1 text-[10.5px] font-semibold text-[#969696]">incl. GST</span>
        </span>
        <span className="text-[10.5px] font-semibold text-[#969696]">pay at counter</span>
      </footer>

      {/* gate actions */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onOk}
          disabled={busy}
          className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#0F3D3E] text-[12.5px] font-bold text-white transition hover:bg-[#0C3233] active:scale-[0.98] disabled:opacity-50"
        >
          <BellRing size={13} aria-hidden />
          Ok — fire to kitchen
        </button>
        <button
          type="button"
          onClick={onDecline}
          disabled={busy}
          title={confirming ? 'Tap again to decline this ticket' : 'Decline this ticket'}
          aria-label={confirming ? 'Tap again to confirm declining the ticket' : 'Decline ticket'}
          className={`flex h-9 items-center justify-center gap-1.5 rounded-xl border px-3 text-[12.5px] font-bold transition active:scale-[0.98] disabled:opacity-50 ${
            confirming
              ? 'border-[#B3261E] bg-[#B3261E] text-white'
              : 'border-[#E3E7E0] bg-white text-[#6B6B6B] hover:border-[#B3261E] hover:text-[#B3261E]'
          }`}
        >
          <CircleSlash size={13} aria-hidden />
          {confirming ? 'Sure?' : 'Decline'}
        </button>
      </div>
    </article>
  );
};

/* ───────────────────────────── the inbox band ─────────────────────────── */

export function CounterInbox(): React.ReactElement | null {
  const { tenantId } = useTenant();
  const [orders, setOrders] = useState<Order[]>([]);
  const [tables, setTables] = useState<DiningTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [rt, setRt] = useState<RealtimeState>('connecting');
  const [nowMs, setNowMs] = useState(() => Date.now());

  /* 5.102.0 — the doorbell answers to the counter. The KDS chime has had its
   * own mute since the chip landed; the counter's bell now keeps the same
   * room-local grammar: its own switch, its own key (sp.counter.sound,
   * sibling of sp.kds.sound), its own honest word. Quiet hours (5.101.0)
   * layers the owner's schedule OVER this switch — both must say yes to ring. */
  const [soundOn, setSoundOn] = useState(() => {
    try {
      return window.localStorage.getItem('sp.counter.sound') !== 'off';
    } catch {
      return true;
    }
  });
  const soundRef = useRef(soundOn);
  soundRef.current = soundOn;

  /* the tick keeps the BUTTON'S WORD current — the gate itself is evaluated
   * at sound-time (no remount needed); this only re-renders the chip when
   * prefs change so a quiet-hours save re-speaks the label live. */
  const [, tickQuiet] = useReducer((n: number) => n + 1, 0);
  useEffect(() => subscribePrefs(tickQuiet), [tickQuiet]);
  const quietNow = isQuietNow();

  const load = useCallback(async () => {
    if (!tenantId) return;
    setError(null);
    try {
      const [os, ts] = await Promise.all([fetchOrders(tenantId, 100), fetchTables(tenantId)]);
      setOrders(os);
      setTables(ts);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load incoming tickets');
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
    const unsubscribe = subscribeOrdersRealtime(tenantId, () => void load(), setRt);
    const poll = window.setInterval(() => void load(), 30_000);
    return () => {
      unsubscribe();
      window.clearInterval(poll);
    };
  }, [tenantId, load]);

  /* 30s tick so the age labels breathe */
  useEffect(() => {
    const t = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(t);
  }, []);

  const tickets = useMemo(
    () =>
      orders
        .filter((o) => String(o.status) === 'new' && isSameLocalDay(o.created_at))
        .sort((a, b) => a.created_at.localeCompare(b.created_at)),
    [orders]
  );

  const tableLabelFor = useCallback(
    (id: string | null | undefined): string | null => {
      if (!id) return null;
      const t = tables.find((x) => x.id === id);
      return t ? t.table_number : null;
    },
    [tables]
  );

  /* doorbell when a fresh ticket id appears (baseline on first paint) */
  const seenRef = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (loading) return;
    const current = new Set(tickets.map((t) => t.id));
    if (seenRef.current === null) {
      seenRef.current = current;
      return;
    }
    let fresh = false;
    current.forEach((id) => {
      if (!seenRef.current!.has(id)) fresh = true;
    });
    /* 5.101.0 quiet hours + 5.102.0 the counter's own mute: both must say
     * yes — the KDS gate reads the same way in KitchenScreen. */
    if (fresh && soundRef.current && !isQuietNow()) doorbell();
    seenRef.current = current;
  }, [tickets, loading]);

  const act = useCallback(
    async (o: Order, to: 'pending' | 'cancelled') => {
      if (!tenantId) return;
      setBusyId(o.id);
      setError(null);
      try {
        await advanceOrder(o.id, tenantId, to);
        setConfirmingId(null);
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not update the ticket');
      } finally {
        setBusyId(null);
      }
    },
    [tenantId, load]
  );

  /* 5.102.0 — the counter's own bell switch. Mirrors the KDS chime toggle:
   * persist, then ring once as audible confirmation — which also unlocks the
   * AudioContext on a user gesture (autoplay policies). */
  const toggleSound = useCallback(() => {
    setSoundOn((v) => {
      const next = !v;
      try {
        window.localStorage.setItem('sp.counter.sound', next ? 'on' : 'off');
      } catch {
        /* storage optional */
      }
      if (next) doorbell();
      return next;
    });
  }, []);

  /* zero tickets → the band disappears entirely (zero noise on the POS).
   * A muted bell rides the same rule: the next ticket re-opens the band
   * (silently), and the chip is waiting there with its honest word. */
  if (!loading && tickets.length === 0 && !error) return null;

  return (
    <section
      aria-label="Incoming order tickets awaiting the counter"
      className="rounded-2xl border border-[#E3E7E0] bg-white/70 backdrop-blur-sm"
    >
      {/* 5.102.0 — the header is no longer one button: the band toggle keeps
       * the identity + chevron, and the doorbell's own switch sits beside it
       * (a button inside a button is invalid HTML and a11y mush). */}
      <div className="flex w-full items-center gap-2.5 px-4 py-3">
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          aria-expanded={!collapsed}
          className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
        >
          <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#FFF4DB] text-[#B88E2F]">
            <BellRing size={15} aria-hidden />
            {tickets.length > 0 && !collapsed ? (
              <span
                className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#B3261E] px-1 text-[10px] font-extrabold text-white"
                aria-hidden
              >
                {tickets.length}
              </span>
            ) : null}
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2">
              <h2 className="text-[13.5px] font-extrabold tracking-tight text-[#1A1A1A]">
                Incoming tickets
              </h2>
              <span className="rounded-full bg-[#EAF0EC] px-2 py-0.5 text-[11px] font-bold text-[#0F3D3E]">
                {tickets.length} awaiting Ok
              </span>
            </span>
            <p className="truncate text-[11.5px] text-[#6B6B6B]">
              Guest QR tickets &amp; walk-ins land here — only Ok fires them to the kitchen.
            </p>
          </span>
        </button>
        {/* the counter's own bell switch — the KDS chime chip's sibling, same
         * three honest states: gold on / deep-teal on-but-quiet / grey muted */}
        <button
          type="button"
          onClick={toggleSound}
          aria-pressed={soundOn}
          title={
            !soundOn
              ? 'Counter doorbell muted'
              : quietNow
                ? 'Doorbell on — quiet hours right now, the band still updates'
                : 'Counter doorbell on'
          }
          className={`flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-[12px] font-semibold transition ${
            !soundOn
              ? 'border-[#E3E7E0] bg-white text-[#969696]'
              : quietNow
                ? 'border-[#0F3D3E]/30 bg-[#0F3D3E]/5 text-[#0F3D3E]'
                : 'border-[#B88E2F]/40 bg-[#B88E2F]/10 text-[#7A5B18]'
          }`}
        >
          {!soundOn ? <VolumeX size={14} aria-hidden /> : <Volume2 size={14} aria-hidden />}
          {!soundOn ? 'Muted' : quietNow ? 'Bell on · quiet' : 'Bell on'}
        </button>
        <span
          className="flex shrink-0 items-center gap-1.5 text-[11px] font-bold"
          title={rt === 'live' ? 'Realtime connected' : rt === 'connecting' ? 'Connecting…' : 'Realtime offline — polling'}
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
        <ChevronDown
          size={16}
          aria-hidden
          className={`shrink-0 text-[#6B6B6B] transition-transform ${collapsed ? '' : 'rotate-180'}`}
        />
      </div>

      {!collapsed ? (
        <div className="border-t border-[#E3E7E0] px-4 py-3">
          {error ? (
            <p className="mb-3 flex items-center gap-2 rounded-xl border border-[#F3C7C4] bg-[#FCEBEA] px-3 py-2 text-[12px] font-semibold text-[#B3261E]">
              <TriangleAlert size={14} aria-hidden />
              {error}
              <button
                type="button"
                onClick={() => void load()}
                className="ml-auto font-extrabold underline underline-offset-2"
              >
                Retry
              </button>
            </p>
          ) : null}
          {loading ? (
            <div className="flex gap-3" aria-hidden>
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-44 w-[300px] shrink-0 animate-pulse rounded-2xl bg-[#F0F2EF]" />
              ))}
            </div>
          ) : tickets.length === 0 ? (
            <p className="py-4 text-center text-[12.5px] text-[#6B6B6B]">
              No tickets awaiting the counter — all caught up.
            </p>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-1.5 [scrollbar-width:thin]">
              {tickets.map((t) => (
                <TicketCard
                  key={t.id}
                  order={t}
                  tableLabel={tableLabelFor(t.table_id)}
                  nowMs={nowMs}
                  busy={busyId === t.id}
                  confirming={confirmingId === t.id}
                  onOk={() => void act(t, 'pending')}
                  onDecline={() => {
                    if (confirmingId === t.id) void act(t, 'cancelled');
                    else setConfirmingId(t.id);
                  }}
                />
              ))}
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
