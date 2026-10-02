import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Armchair,
  BadgeCheck,
  CalendarClock,
  CircleAlert,
  Clock,
  Copy,
  CreditCard,
  ExternalLink,
  Link2,
  Loader2,
  Pencil,
  Phone,
  Plus,
  Printer,
  QrCode,
  RefreshCw,
  Scissors,
  Smartphone,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import QRCode from 'qrcode';
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  createTable,
  createReservation,
  deleteTable,
  fetchOrders,
  fetchReservations,
  fetchTableSessions,
  fetchTables,
  revokeTableSession,
  subscribeReservationsRealtime,
  subscribeTablesRealtime,
  updateReservationStatus,
  updateTable,
  type DiningTable,
  type RealtimeState,
  type Reservation,
  type ReservationInput,
  type ReservationStatus,
  type TableSession,
  type TableStatus,
} from '../../lib/api';
import { useTenant } from '../../lib/tenant';
import { printHiddenFrame, preloadPrintImage } from '../../lib/printFrame';
import { formatMoney } from '../../lib/prefs';
import { useUi } from '../../store/session';
import { useCart } from '../../store/cart';
import type { Order, OrderItem } from '../../types';

/**
 * Floor (v5.26.0) — the counter's table cockpit. dining_tables stream over
 * realtime (migration 011); orders hold/release tables automatically through
 * the trg_orders_sync_table trigger, so this board mirrors reality without
 * anyone having to remember to update it. Every card carries the table's
 * permanent QR token; tapping a card opens the drill panel — the table's LIVE
 * order (items, totals, payment state) for occupied/billing tables, or a big
 * scannable QR for open ones. Print stickers renders every table's QR into a
 * cut-line A4 sheet (same hidden-iframe engine as the 5.11.0 receipt).
 *
 * v5.22.0 adds the FLOOR RHYTHM strip: table-bound tickets per IST hour over
 * the last 7 days — when the seats actually fill. It derives from the same
 * orders ledger Reports reads (the board's own fetch), counts only tickets
 * that hold a table (walk-in counter tickets stay out), and is honest about
 * being a count of rounds, not of unique guests. Hour bucketing mirrors
 * Reports' Sales-by-hour IST math exactly.
 *
 * v5.23.0 adds the GUEST SESSION trail (migration 002's ephemeral 10-minute
 * QR sessions): cards grow a "N scans" chip, the drill panel lists the six
 * most recent sessions per table with IST open→expiry windows and honest
 * clock-derived liveness (the DB keeps status='active' after ordinary
 * expiry — the UI trusts expires_at, not the column). The trail rides the
 * floor's refresh cycle, FAIL-SOFT: it can never take the board down.
 *
 * v5.24.0 gives the trail TEETH (migration 023): live rows carry a two-step
 * CUT button — the staff ends the guest's open window. The write is the RLS-
 * scoped revokeTableSession; migration 023's sp_verify_table_session lets the
 * guest's phone re-verify its own session every 30s (server truth, not the
 * client clock), so a cut locks the guest's menu — cart frozen, token dead
 * for orders (sp_create_public_order's new optional p_session_token gate).
 * Honest scope: a cut ends the WINDOW, not the table — the printed sticker's
 * QR reopens a fresh one.
 *
 * v5.26.0 adds the BULK CUT: when two or more windows are open on the same
 * table (the leaked-QR scenario — a photo of the sticker circulating), the
 * drill panel offers "Cut all live", one armed tap that ends every live
 * window at once. Same clock-derived liveness, same RLS revoke path,
 * allSettled so one failed write can't strand the rest, honest partial-
 * failure copy. One live window still belongs to the row's own cut.
 */

const esc = (s: string): string =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const guestUrlOf = (t: DiningTable): string => `${window.location.origin}/t/${t.qr_token}`;

/* ── IST hour math for the floor rhythm strip (v5.22.0) — same calendar
   math as Reports' Sales-by-hour: Asia/Kolkata hours on real IST days. ── */
const IST_TZ = 'Asia/Kolkata';

function istHour(iso: string): number {
  const h = new Intl.DateTimeFormat('en-GB', {
    timeZone: IST_TZ,
    hour: '2-digit',
    hour12: false,
  }).format(new Date(iso));
  return Number(h) % 24;
}

/** YYYY-MM-DD of an ISO instant, in IST. */
function istDateKey(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: IST_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso));
}

/** Today's date (YYYY-MM-DD) in IST. */
function istTodayIsoFloor(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: IST_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

/** UTC-ms of IST midnight for a YYYY-MM-DD day key. */
function istDayStartFloor(dateIso: string): number {
  return new Date(`${dateIso}T00:00:00+05:30`).getTime();
}

function hourLabel(h: number): string {
  if (h === 0) return '12a';
  if (h === 12) return '12p';
  return h < 12 ? `${h}a` : `${h - 12}p`;
}

/** "2 Oct" style day label for the busiest-day chip. */
function istDayPretty(dateKey: string): string {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'short',
  }).format(new Date(`${dateKey}T00:00:00Z`));
}

const qrDataUrl = (url: string): Promise<string> =>
  QRCode.toDataURL(url, { margin: 1, width: 360, color: { dark: '#0F3D3E', light: '#FFFFFF' } });

interface StickerSpec {
  tableNumber: string;
  section: string;
  url: string;
  qr: string;
  /** v5.28.0 — the café's face (migration 024's logo_url) on the sheet head
   *  and every card. NULL/absent → byte-compatible with the pre-5.28 sheet:
   *  no tile, no placeholder. A dead URL hides its own tile at print time. */
  logo?: string | null;
}

/** A4 cut-line sticker sheet — pure builder (exported for E2E assertions).
 *  v5.28.0: optional `cafeLogo` (third arg) prints a head tile + one tile on
 *  EVERY sticker card — the card is what guests see on the table, so the
 *  brand travels with the QR. Absent/NULL logo → identical to the old sheet. */
export function buildStickerSheetHtml(cafeName: string, stickers: StickerSpec[], cafeLogo?: string | null): string {
  const cards = stickers
    .map(
      (s) => `
    <div class="sticker">
      ${s.logo ? `<img class="cardlogo" src="${esc(s.logo)}" alt="" onerror="this.style.display='none'"/>` : ''}
      <div class="cafe">${esc(cafeName)}</div>
      <div class="table">${esc(s.tableNumber)}</div>
      ${s.section ? `<div class="section">${esc(s.section)}</div>` : ''}
      <img class="qr" src="${s.qr}" alt="QR code for table ${esc(s.tableNumber)}"/>
      <div class="hint">Scan &rarr; see the menu &rarr; order from your table</div>
      <div class="url">${esc(s.url)}</div>
    </div>`,
    )
    .join('');
  const today = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date());
  return `<!doctype html><html><head><meta charset="utf-8"><title>Table QR stickers — ${esc(cafeName)}</title>
<style>
  @page { size: A4 portrait; margin: 10mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #1A1A1A; margin: 0; }
  .head { text-align: center; margin-bottom: 10px; }
  .head .t { font-size: 14px; font-weight: 800; }
  .head .s { font-size: 10px; color: #6B6B6B; margin-top: 2px; }
  .headlogo { width: 42px; height: 42px; object-fit: contain; margin: 0 auto 4px; display: block; background: #fff; border: 1px solid #E3E7E0; border-radius: 8px; padding: 3px; }
  .grid { display: flex; flex-wrap: wrap; gap: 8px; }
  .sticker { width: calc(50% - 4px); border: 1.5px dashed #B88E2F; border-radius: 12px; padding: 12px 10px; text-align: center; page-break-inside: avoid; }
  .cardlogo { width: 30px; height: 30px; object-fit: contain; margin: 0 auto 3px; display: block; background: #fff; border: 1px solid #E3E7E0; border-radius: 6px; padding: 2px; }
  .cafe { font-size: 12px; font-weight: 700; color: #0F3D3E; }
  .table { font-size: 22px; font-weight: 800; margin-top: 2px; }
  .section { font-size: 9.5px; color: #6B6B6B; }
  .qr { width: 46mm; height: 46mm; margin: 6px auto 4px; display: block; }
  .hint { font-size: 10px; font-weight: 600; color: #0F3D3E; }
  .url { font-size: 7.5px; color: #8A8A8A; word-break: break-all; margin-top: 3px; font-family: monospace; }
</style></head><body>
<div class="head">${cafeLogo ? `<img class="headlogo" src="${esc(cafeLogo)}" alt="" onerror="this.style.display='none'"/>` : ''}<div class="t">${esc(cafeName)} — table QR stickers</div><div class="s">Printed ${esc(today)} IST &middot; cut on the dashed lines &middot; one sticker per table &middot; ServePoint smartPOS</div></div>
<div class="grid">${cards}</div>
</body></html>`;
}

/** Hidden-iframe print — rides the shared printFrame engine (v5.27.1's
 * afterprint-driven removal; the blind 1500ms removeChild could abort or
 * blank a job in engines whose print() doesn't block). v5.29.0: the logo
 * prewarm moved to the shared preloadPrintImage in lib/printFrame. */
function printQrStickers(cafeName: string, stickers: StickerSpec[], cafeLogo?: string | null): void {
  printHiddenFrame(buildStickerSheetHtml(cafeName, stickers, cafeLogo));
}

/* v5.31.0 — per-hour honesty in compare mode: when the gray prior-week line
 * is on the chart, the tooltip stops being a bare pair of numbers and does
 * the subtraction itself — this hour vs the same hour last week, signed and
 * colored per the DS (green ahead, red behind, neutral even). The default
 * mode keeps the stock tooltip untouched. */
const SpHourDeltaTooltip: React.FC<{
  active?: boolean;
  payload?: { payload?: { label?: string; n?: number; pn?: number } }[];
}> = ({ active, payload }) => {
  const p = payload && payload[0] ? payload[0].payload : undefined;
  if (!active || !p) return null;
  const n = Number(p.n ?? 0);
  const pn = Number(p.pn ?? 0);
  const d = n - pn;
  const dColor = d > 0 ? '#2E7D32' : d < 0 ? '#B42318' : '#6B6B6B';
  return (
    <div className="rounded-xl border border-[#E3E7E0] bg-white px-3 py-2 text-[12px] shadow-[0_4px_14px_rgba(15,61,62,0.10)]">
      <p className="font-semibold text-[#1A1A1A]">{p.label}</p>
      <p className="mt-1 flex items-center gap-1.5 text-[#1A1A1A]">
        <span className="inline-block h-2 w-2 rounded-sm" style={{ background: '#0F3D3E' }} aria-hidden />
        this 7d <span className="ml-auto pl-3 font-mono font-bold tabular-nums">{n}</span>
      </p>
      <p className="mt-0.5 flex items-center gap-1.5 text-[#6B6B6B]">
        <span className="inline-block h-0 w-2.5 border-t-2 border-dashed" style={{ borderColor: '#969696' }} aria-hidden />
        prior 7d <span className="ml-auto pl-3 font-mono font-bold tabular-nums">{pn}</span>
      </p>
      <p
        className="mt-1 border-t border-[#E3E7E0] pt-1 font-mono text-[11.5px] font-bold tabular-nums"
        style={{ color: dColor }}
      >
        {d > 0 ? `+${d}` : `${d}`} vs prior week · same hour
      </p>
    </div>
  );
};

const STATUS_META: Record<TableStatus, { label: string; bg: string; fg: string; dot: string }> = {
  available: { label: 'Available', bg: '#EAF4EC', fg: '#2E7D32', dot: '#2E7D32' },
  occupied: { label: 'Occupied', bg: '#FDF3E4', fg: '#8A5A16', dot: '#C2571B' },
  reserved: { label: 'Reserved', bg: '#F1F4F1', fg: '#0F3D3E', dot: '#B88E2F' },
  billing: { label: 'Billing', bg: '#FDECEA', fg: '#B4483C', dot: '#B4483C' },
};

/* ── The book (v5.38.0) — reservation status tones + IST slot labels. ── */

const RES_META: Record<ReservationStatus, { label: string; bg: string; fg: string }> = {
  booked: { label: 'Booked', bg: '#FBF3E1', fg: '#8A5A00' },
  seated: { label: 'Seated', bg: '#E7F1E8', fg: '#2E7D32' },
  no_show: { label: 'No-show', bg: '#FCEBEA', fg: '#B3261E' },
  cancelled: { label: 'Cancelled', bg: '#EAF0EC', fg: '#6B6B6B' },
};

/** "7:30 pm" IST 12-hour label for a booking slot. */
function istSlotLabel(iso: string): string {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: IST_TZ,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
    .format(new Date(iso))
    .toLowerCase();
}

/** "Today · 3 Oct" / "Tomorrow · 4 Oct" / "Mon · 6 Oct" for book day groups. */
function istDayHeading(dateKey: string): string {
  const today = istTodayIsoFloor();
  const tomorrow = istDateKey(new Date(istDayStartFloor(today) + 24 * 3600 * 1000).toISOString());
  const weekday = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'UTC',
    weekday: 'short',
  }).format(new Date(`${dateKey}T00:00:00Z`));
  const pretty = istDayPretty(dateKey);
  if (dateKey === today) return `Today · ${weekday} ${pretty}`;
  if (dateKey === tomorrow) return `Tomorrow · ${weekday} ${pretty}`;
  return `${weekday} · ${pretty}`;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

function LiveChip({ state }: { state: RealtimeState }): React.ReactElement {
  const map: Record<RealtimeState, { label: string; color: string }> = {
    live: { label: 'Live', color: '#2E7D32' },
    connecting: { label: 'Connecting…', color: '#8A5A16' },
    offline: { label: 'Polling 30s', color: '#6B6B6B' },
  };
  const m = map[state];
  return (
    <span
      className="flex h-9 items-center gap-1.5 rounded-full border border-[#E3E7E0] bg-white px-3 text-[11.5px] font-semibold"
      style={{ color: m.color }}
      role="status"
    >
      <span className={`h-2 w-2 rounded-full ${state === 'live' ? 'animate-pulse' : ''}`} style={{ background: m.color }} aria-hidden />
      {m.label}
    </span>
  );
}

function TimeAgo({ iso }: { iso: string }): React.ReactElement {
  const [, force] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => force((n) => n + 1), 30000);
    return () => window.clearInterval(t);
  }, []);
  const mins = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  return <span>{mins < 1 ? 'just now' : mins < 60 ? `${mins}m` : `${Math.floor(mins / 60)}h ${mins % 60}m`}</span>;
}

/* ── Guest session trail (v5.23.0) — migration 002's ephemeral 10-minute
   QR sessions, read honestly. The DB `status` column stays 'active' after
   ordinary expiry (only revoke/consume paths write it back), so LIVE vs
   EXPIRED is derived from the clock: expires_at vs now. ── */

type SessionState = 'live' | 'expired' | 'consumed' | 'revoked';

function sessionState(s: TableSession): SessionState {
  if (s.status === 'consumed') return 'consumed';
  if (s.status === 'revoked') return 'revoked';
  return new Date(s.expires_at).getTime() > Date.now() ? 'live' : 'expired';
}

const SESSION_TONE: Record<SessionState, { dot: string; fg: string; label: string }> = {
  live: { dot: '#0F3D3E', fg: '#0F3D3E', label: 'menu open' },
  expired: { dot: '#969696', fg: '#6B6B6B', label: 'expired' },
  consumed: { dot: '#2E7D32', fg: '#2E7D32', label: 'used' },
  revoked: { dot: '#B3261E', fg: '#B3261E', label: 'cut' },
};

/** "20:49" IST wall clock for a session window row. */
function istHM(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: IST_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso));
}

/** Relative text for the expiry moment: minutes left while live, ago once past. */
function expiryRel(iso: string): string {
  const diffMs = new Date(iso).getTime() - Date.now();
  const mins = Math.round(Math.abs(diffMs) / 60000);
  const span = mins < 60 ? `${Math.max(1, mins)}m` : `${Math.floor(mins / 60)}h ${mins % 60}m`;
  return diffMs >= 0 ? `${span} left` : `${span} ago`;
}

function AddTableDialog({
  busy,
  error,
  onAdd,
  onClose,
  initial,
}: {
  busy: boolean;
  error: string | null;
  onAdd: (number: string, capacity: number, section: string) => void;
  onClose: () => void;
  /** When present the dialog edits an existing table instead of adding one. */
  initial?: { number: string; capacity: number; section: string };
}) {
  const [number, setNumber] = useState(initial?.number ?? '');
  const [capacity, setCapacity] = useState(String(initial?.capacity ?? 4));
  const [section, setSection] = useState(initial?.section ?? 'Main Floor');
  const capNum = Number.parseInt(capacity, 10);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={initial ? 'Edit table' : 'Add table'}>
      <button type="button" aria-label="Close dialog" onClick={onClose} className="absolute inset-0 h-full w-full cursor-default bg-[#0F3D3E]/45" />
      <div className="absolute inset-x-2 top-1/2 mx-auto max-w-[420px] -translate-y-1/2 rounded-3xl bg-white p-5 shadow-2xl sm:inset-x-0">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[15px] font-bold text-[#1A1A1A]">{initial ? `Edit table ${initial.number}` : 'Add a table'}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-10 w-10 items-center justify-center rounded-full text-[#6B6B6B] hover:bg-[#F6F5F2] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#967221]"
          >
            <X size={17} aria-hidden />
          </button>
        </div>
        <div className="space-y-3">
          <div>
            <label htmlFor="ft-num" className="mb-1 block text-[12px] font-medium text-[#6B6B6B]">Table number / label *</label>
            <input
              id="ft-num"
              type="text"
              value={number}
              maxLength={12}
              onChange={(e) => setNumber(e.target.value)}
              placeholder="e.g. T7 or Patio-2"
              className="sp-input h-11 w-full px-3 text-[13.5px]"
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="ft-cap" className="mb-1 block text-[12px] font-medium text-[#6B6B6B]">Seats</label>
              <input id="ft-cap" type="number" min={1} max={40} value={capacity} onChange={(e) => setCapacity(e.target.value)} className="sp-input h-11 w-full px-3 text-[13.5px]" />
            </div>
            <div>
              <label htmlFor="ft-sec" className="mb-1 block text-[12px] font-medium text-[#6B6B6B]">Section</label>
              <input id="ft-sec" type="text" value={section} maxLength={24} onChange={(e) => setSection(e.target.value)} placeholder="Main Floor" className="sp-input h-11 w-full px-3 text-[13.5px]" />
            </div>
          </div>
          <p className="text-[11.5px] leading-relaxed text-[#6B6B6B]">
            Each table gets a permanent QR token — copy the guest link from the card and print it as the table sticker.
          </p>
          {error && <p className="rounded-xl bg-[#FDF3F2] px-3 py-2 text-[12.5px] text-[#B4483C]" role="alert">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="h-11 rounded-full border border-[#E3E7E0] px-4 text-[13px] font-semibold text-[#6B6B6B] hover:bg-[#F6F5F2]">
              Cancel
            </button>
            <button
              type="button"
              disabled={!number.trim() || !Number.isFinite(capNum) || capNum < 1 || busy}
              onClick={() => onAdd(number.trim(), capNum, section.trim() || 'Main Floor')}
              className="flex h-11 items-center gap-2 rounded-full px-5 text-[13px] font-semibold text-white disabled:opacity-50"
              style={{ background: '#0F3D3E' }}
            >
              {busy && <Loader2 size={14} className="animate-spin" aria-hidden />}
              {initial ? 'Save changes' : 'Add table'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── BookingDialog (v5.38.0) — take a phone promise: who, how many, when,
      (which table), and any note. slot_at is composed as IST wall-clock
      with an explicit +05:30 offset — IST has no DST, so the instant is
      exact. Past slots are allowed (the book tolerates backfill); the
      party>capacity nudge is honest information, not a block. ── */

function BookingDialog({
  tables,
  busy,
  error,
  onTake,
  onClose,
}: {
  tables: DiningTable[];
  busy: boolean;
  error: string | null;
  onTake: (input: ReservationInput) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [party, setParty] = useState('2');
  const [date, setDate] = useState(istTodayIsoFloor());
  const [time, setTime] = useState('19:30');
  const [tableId, setTableId] = useState('');
  const [note, setNote] = useState('');
  const partyNum = Number.parseInt(party, 10);
  const picked = tables.find((t) => t.id === tableId) || null;

  const slotMs = useMemo(() => {
    if (!date || !time) return NaN;
    return new Date(`${date}T${time}:00+05:30`).getTime();
  }, [date, time]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Take a booking">
      <button type="button" aria-label="Close dialog" onClick={onClose} className="absolute inset-0 h-full w-full cursor-default bg-[#0F3D3E]/45" />
      <div className="absolute inset-x-2 top-1/2 mx-auto max-h-[92vh] max-w-[460px] -translate-y-1/2 overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl sm:inset-x-0">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-[15px] font-bold text-[#1A1A1A]">
            <CalendarClock size={16} style={{ color: '#B88E2F' }} aria-hidden /> Take a booking
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-10 w-10 items-center justify-center rounded-full text-[#6B6B6B] hover:bg-[#F6F5F2] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#967221]"
          >
            <X size={17} aria-hidden />
          </button>
        </div>
        <div className="space-y-3">
          <div>
            <label htmlFor="bk-name" className="mb-1 block text-[12px] font-medium text-[#6B6B6B]">Guest name *</label>
            <input
              id="bk-name"
              type="text"
              value={name}
              maxLength={40}
              onChange={(e) => setName(e.target.value)}
              placeholder="Who promised to come"
              className="sp-input h-11 w-full px-3 text-[13.5px]"
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="bk-phone" className="mb-1 block text-[12px] font-medium text-[#6B6B6B]">Phone</label>
              <input id="bk-phone" type="tel" value={phone} maxLength={20} onChange={(e) => setPhone(e.target.value)} placeholder="Optional" className="sp-input h-11 w-full px-3 text-[13.5px]" />
            </div>
            <div>
              <label htmlFor="bk-party" className="mb-1 block text-[12px] font-medium text-[#6B6B6B]">Party size</label>
              <input id="bk-party" type="number" min={1} max={40} value={party} onChange={(e) => setParty(e.target.value)} className="sp-input h-11 w-full px-3 text-[13.5px]" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="bk-date" className="mb-1 block text-[12px] font-medium text-[#6B6B6B]">Day (IST)</label>
              <input id="bk-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="sp-input h-11 w-full px-3 text-[13.5px]" />
            </div>
            <div>
              <label htmlFor="bk-time" className="mb-1 block text-[12px] font-medium text-[#6B6B6B]">Arrives (IST)</label>
              <input id="bk-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} className="sp-input h-11 w-full px-3 text-[13.5px]" />
            </div>
          </div>
          <div>
            <label htmlFor="bk-table" className="mb-1 block text-[12px] font-medium text-[#6B6B6B]">Table</label>
            <select id="bk-table" value={tableId} onChange={(e) => setTableId(e.target.value)} className="sp-input h-11 w-full px-3 text-[13.5px]">
              <option value="">Decide when they arrive</option>
              {tables.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.table_number} · {t.section || 'Main Floor'} · {t.capacity} seats
                </option>
              ))}
            </select>
          </div>
          {picked && Number.isFinite(partyNum) && partyNum > picked.capacity && (
            <p className="rounded-xl bg-[#FBF3E1] px-3 py-2 text-[12px] font-medium text-[#8A5A00]" role="note">
              Party of {partyNum} at {picked.table_number} ({picked.capacity} seats) — pull chairs over, or split across two tables.
            </p>
          )}
          <div>
            <label htmlFor="bk-note" className="mb-1 block text-[12px] font-medium text-[#6B6B6B]">Note</label>
            <textarea
              id="bk-note"
              value={note}
              maxLength={280}
              rows={2}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Window seat · birthday · arriving late…"
              className="sp-input w-full resize-none px-3 py-2 text-[13.5px]"
            />
            <p className="mt-1 text-right text-[10.5px] tabular-nums text-[#6B6B6B]">{note.length}/280</p>
          </div>
          {error && <p className="rounded-xl bg-[#FDF3F2] px-3 py-2 text-[12.5px] text-[#B4483C]" role="alert">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="h-11 rounded-full border border-[#E3E7E0] px-4 text-[13px] font-semibold text-[#6B6B6B] hover:bg-[#F6F5F2]">
              Cancel
            </button>
            <button
              type="button"
              disabled={!name.trim() || !Number.isFinite(partyNum) || partyNum < 1 || partyNum > 40 || Number.isNaN(slotMs) || busy}
              onClick={() =>
                onTake({
                  guestName: name.trim(),
                  phone: phone.trim(),
                  partySize: partyNum,
                  tableId: tableId || null,
                  slotAt: new Date(slotMs).toISOString(),
                  note: note.trim(),
                })
              }
              className="flex h-11 items-center gap-2 rounded-full px-5 text-[13px] font-semibold text-white disabled:opacity-50"
              style={{ background: '#0F3D3E' }}
            >
              {busy && <Loader2 size={14} className="animate-spin" aria-hidden />}
              Write it in the book
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── SkeletonBoard (v5.38.0) — the floor's first paint. The old cold-load
      was a bare spinner; now the board's own shape (header, stat tiles,
      rhythm card, table cards) shimmers into place, so the host stand never
      stares at a blank centred dot. ── */

function SkeletonBoard(): React.ReactElement {
  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-4 lg:p-5" aria-busy="true" aria-label="Loading the floor">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-2">
          <div className="h-7 w-36 animate-pulse rounded-lg bg-[#EAECE8]" />
          <div className="h-4 w-64 animate-pulse rounded bg-[#EAECE8]" />
        </div>
        <div className="flex gap-2">
          <div className="h-11 w-36 animate-pulse rounded-full bg-[#EAECE8]" />
          <div className="h-11 w-28 animate-pulse rounded-full bg-[#EAECE8]" />
          <div className="h-11 w-32 animate-pulse rounded-full bg-[#EAECE8]" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-[74px] animate-pulse rounded-2xl border border-[#E3E7E0] bg-white" />
        ))}
      </div>
      <div className="h-[280px] animate-pulse rounded-3xl bg-[#EAECE8]/70" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-[186px] animate-pulse rounded-3xl border border-[#E3E7E0] bg-white" />
        ))}
      </div>
    </div>
  );
}

function ItemLines({ items }: { items: OrderItem[] }): React.ReactElement {
  return (
    <div className="space-y-2">
      {items.map((it, i) => {
        const subs: string[] = [];
        if (it.variant_name) subs.push(it.variant_name);
        for (const a of it.addons || []) subs.push(`+ ${a.name}`);
        if (it.notes) subs.push(`\u2022 ${it.notes}`);
        return (
          <div key={it.id || `${it.name}-${i}`} className="border-b border-dashed border-[#E9EBE4] pb-2 last:border-0 last:pb-0">
            <p className="flex items-baseline justify-between gap-3 text-[13px]">
              <span className="font-semibold text-[#1A1A1A]">
                {it.name} <span className="font-normal text-[#6B6B6B]">&times;{it.qty}</span>
              </span>
              <span className="font-bold tabular-nums text-[#1A1A1A]">{formatMoney(it.item_total)}</span>
            </p>
            {subs.length > 0 && <p className="mt-0.5 pl-3 text-[11.5px] leading-relaxed text-[#6B6B6B]">{subs.join(' \u00b7 ')}</p>}
          </div>
        );
      })}
    </div>
  );
}

/** Drill panel — tap a card: LIVE order for occupied/billing, big QR for open tables. */
function TableDrill({
  table,
  order,
  sessions,
  cutArmId,
  cutBusyId,
  onCutArm,
  onCut,
  bulkCutBusy,
  onCutAll,
  onEdit,
  onRemove,
  removeBusy,
  onClose,
}: {
  table: DiningTable;
  order: Order | undefined;
  sessions: TableSession[];
  cutArmId: string | null;
  cutBusyId: string | null;
  onCutArm: (sessionId: string) => void;
  onCut: (sessionId: string) => void;
  bulkCutBusy: boolean;
  onCutAll: (sessionIds: string[]) => void;
  onEdit: () => void;
  onRemove: () => void;
  removeBusy: boolean;
  onClose: () => void;
}): React.ReactElement {
  const meta = STATUS_META[table.status];
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState<'link' | 'token' | null>(null);
  const [shown, setShown] = useState(false);
  const [bulkArm, setBulkArm] = useState(false);
  const [removeArmed, setRemoveArmed] = useState(false);
  const url = guestUrlOf(table);
  const isLive = table.status === 'occupied' || table.status === 'billing';
  /* A table that still holds an order (or a reservation) can't be retired —
     the guard is honest: the hint names what to do first. */
  const canRemove = table.status === 'available' && !table.active_order_id;

  /* Live windows on THIS table (clock-derived, same rule as the rows). Two or
     more earns the bulk cut — with one, the row's own cut is the honest tool. */
  const liveIds = useMemo(
    () => sessions.filter((s) => sessionState(s) === 'live').map((s) => s.id),
    [sessions],
  );
  useEffect(() => {
    if (!bulkArm) return;
    const t = window.setTimeout(() => setBulkArm(false), 3000);
    return () => window.clearTimeout(t);
  }, [bulkArm]);

  /* the remove confirm disarms itself, same discipline as the bulk-cut arm */
  useEffect(() => {
    if (!removeArmed) return;
    const t = window.setTimeout(() => setRemoveArmed(false), 3000);
    return () => window.clearTimeout(t);
  }, [removeArmed]);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(raf);
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  useEffect(() => {
    let alive = true;
    qrDataUrl(url)
      .then((d) => {
        if (alive) setQr(d);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [url]);

  const copy = useCallback(async (text: string, kind: 'link' | 'token') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      /* clipboard unavailable — the raw text is visible on screen anyway */
    }
  }, []);

  const items = order?.items || [];
  const discount = Number(order?.discount_amount ?? 0);
  const paid = order?.payment_status === 'paid';

  /** Tap-through (v5.18.0): pre-link the cart to THIS table and open the POS
   *  with the ticket already seated — dine-in, table FK, label and a guest
   *  count prefilled from the table's capacity. The 011 trigger flips the
   *  table to occupied the moment the order lands; the POS strip announces
   *  the binding so nobody ever wonders which table a cart belongs to. */
  const startTicket = useCallback(() => {
    const c = useCart.getState();
    c.setOrderType('dine_in');
    c.setTableId(table.id);
    c.setTableLabel(table.table_number);
    c.setGuestCount(table.capacity);
    onClose();
    useUi.getState().goSection('food', ['Food & Drinks']);
  }, [table, onClose]);

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={`Table ${table.table_number}`}>
      <button
        type="button"
        aria-label="Close panel"
        onClick={onClose}
        className={`absolute inset-0 h-full w-full cursor-default bg-[#0F3D3E]/45 transition-opacity duration-300 ${shown ? 'opacity-100' : 'opacity-0'}`}
      />
      <aside
        className={`absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-[#F6F5F2] shadow-2xl transition-transform duration-300 ease-out ${shown ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* header */}
        <div className="flex items-start justify-between gap-3 border-b border-[#E3E7E0] bg-white px-5 py-4">
          <div>
            <p className="flex items-center gap-2 text-[20px] font-bold leading-none text-[#1A1A1A]">
              <Armchair size={18} style={{ color: meta.dot }} aria-hidden />
              Table {table.table_number}
            </p>
            <p className="mt-1.5 flex items-center gap-2 text-[12px] text-[#6B6B6B]">
              <span className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-bold" style={{ background: meta.bg, color: meta.fg }}>
                <span className={`h-1.5 w-1.5 rounded-full ${table.status === 'occupied' ? 'animate-pulse' : ''}`} style={{ background: meta.dot }} aria-hidden />
                {meta.label}
              </span>
              <span className="flex items-center gap-1">
                <Users size={11} aria-hidden /> {table.capacity} seats
              </span>
              {table.section && <span>{table.section}</span>}
              {isLive && order && (
                <span className="flex items-center gap-1 tabular-nums">
                  <Clock size={11} aria-hidden /> <TimeAgo iso={order.created_at} />
                </span>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[#6B6B6B] hover:bg-[#F6F5F2] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#967221]"
          >
            <X size={17} aria-hidden />
          </button>
        </div>

        {/* body */}
        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {isLive && order && (
            <>
              <div className="rounded-2xl border border-[#E3E7E0] bg-white p-4 shadow-sm">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <p className="text-[14px] font-bold text-[#1A1A1A]">#{order.order_number} &middot; {order.customer_name || 'Guest'}</p>
                  <span className="rounded-full bg-[#F1F4F1] px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wide text-[#0F3D3E]">{String(order.status)}</span>
                </div>
                {items.length > 0 ? (
                  <ItemLines items={items} />
                ) : (
                  <p className="rounded-xl bg-[#FBFBF9] px-3 py-2 text-[12.5px] text-[#6B6B6B]">No item lines recorded on this order yet.</p>
                )}
              </div>

              <div className="rounded-2xl border border-[#E3E7E0] bg-white p-4 shadow-sm">
                <div className="space-y-1.5 text-[12.5px]">
                  <p className="flex justify-between text-[#6B6B6B]"><span>Subtotal</span><span className="tabular-nums text-[#1A1A1A]">{formatMoney(order.subtotal)}</span></p>
                  {discount > 0 && <p className="flex justify-between text-[#2E7D32]"><span>Discount</span><span className="tabular-nums">-{formatMoney(discount)}</span></p>}
                  <p className="flex justify-between text-[#6B6B6B]"><span>GST</span><span className="tabular-nums text-[#1A1A1A]">{formatMoney(order.tax_amount)}</span></p>
                  <div className="mt-1 border-t border-[#E3E7E0] pt-2">
                    <p className="flex justify-between text-[14px] font-bold text-[#1A1A1A]"><span>Total</span><span className="tabular-nums">{formatMoney(order.total)}</span></p>
                  </div>
                </div>
                <p className="mt-3">
                  {paid ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#EAF4EC] px-3 py-1.5 text-[11.5px] font-bold text-[#2E7D32]">
                      <CreditCard size={12} aria-hidden /> PAID{order.payment_method ? ` \u00b7 ${String(order.payment_method)}` : ''}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FDF3E4] px-3 py-1.5 text-[11.5px] font-bold text-[#8A5A16]">
                      <CreditCard size={12} aria-hidden /> Payment due
                    </span>
                  )}
                </p>
              </div>
            </>
          )}

          {isLive && !order && (
            <p className="rounded-2xl border border-dashed border-[#E3E7E0] bg-white px-4 py-6 text-center text-[12.5px] text-[#6B6B6B]">
              The live order isn't on this board right now — open Bills for the full ticket.
            </p>
          )}

          {/* guest session trail (v5.23.0) — who scanned, when it expires */}
          <div className="rounded-2xl border border-[#E3E7E0] bg-white p-4 shadow-sm">
            <div className="mb-1 flex items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-[14px] font-bold text-[#1A1A1A]">
                <Smartphone size={14} className="text-[#0F3D3E]" aria-hidden /> Guest sessions
              </p>
              {sessions.length > 0 && (
                <span className="rounded-full bg-[#F1F4F1] px-2.5 py-1 text-[10.5px] font-bold tabular-nums text-[#0F3D3E]">
                  {sessions.length} on record
                </span>
              )}
            </div>
            {/* Bulk cut (v5.26.0) — one tap ends EVERY live window on this table
                (the leaked-QR scenario: a photo of the sticker circulating).
                Same two-step arm→confirm grammar as the row cut; only appears
                when two or more windows are actually open. */}
            {liveIds.length >= 2 && (
              <div
                className={`mt-1 flex items-center justify-between gap-2 rounded-xl px-3 py-2 ${
                  bulkArm ? 'bg-[#FDF3F2] ring-1 ring-[#B3261E]/30' : 'bg-[#FBFBF9]'
                }`}
              >
                <p className="min-w-0 text-[11.5px] leading-snug text-[#6B6B6B]">
                  <span className="font-bold tabular-nums text-[#B3261E]">{liveIds.length} live windows</span>{' '}
                  open — one photo of this sticker could be many phones.
                </p>
                <button
                  type="button"
                  onClick={() => (bulkArm ? onCutAll(liveIds) : setBulkArm(true))}
                  disabled={bulkCutBusy}
                  aria-label={
                    bulkCutBusy
                      ? 'Cutting all live sessions'
                      : bulkArm
                        ? `Confirm cutting all ${liveIds.length} live sessions on table ${table.table_number}`
                        : `Cut all ${liveIds.length} live sessions on table ${table.table_number}`
                  }
                  className={`flex h-7 shrink-0 items-center gap-1.5 rounded-full px-3 text-[11px] font-bold transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#B3261E] ${
                    bulkArm
                      ? 'bg-[#B3261E] text-white shadow-sm'
                      : 'border border-[#F0C4BE] text-[#B3261E] hover:bg-[#FDF3F2]'
                  }`}
                >
                  {bulkCutBusy ? (
                    <Loader2 size={12} className="animate-spin" aria-hidden />
                  ) : (
                    <Scissors size={12} aria-hidden />
                  )}
                  {bulkCutBusy ? 'Cutting…' : bulkArm ? `Cut ${liveIds.length} live?` : 'Cut all live'}
                </button>
              </div>
            )}
            {sessions.length === 0 ? (
              <p className="rounded-xl bg-[#FBFBF9] px-3 py-3 text-[12.5px] text-[#6B6B6B]">
                No guest has scanned this table's QR yet — the session trail appears here the moment someone opens the menu.
              </p>
            ) : (
              <>
                <ul className="mt-2 space-y-1.5">
                  {sessions.slice(0, 6).map((s) => {
                    const st = sessionState(s);
                    const tone = SESSION_TONE[st];
                    const armed = cutArmId === s.id;
                    const cutting = cutBusyId === s.id;
                    return (
                      <li
                        key={s.id}
                        className="flex items-center gap-2.5 rounded-xl bg-[#FBFBF9] px-3 py-2 transition-colors"
                        title={`Session ${s.id.slice(0, 8)} · ${tone.label}`}
                      >
                        <span
                          className={`h-2 w-2 shrink-0 rounded-full ${st === 'live' ? 'animate-pulse' : ''}`}
                          style={{ background: tone.dot }}
                          aria-hidden
                        />
                        <span className="w-[68px] shrink-0 text-[11px] font-bold" style={{ color: tone.fg }}>
                          {tone.label}
                        </span>
                        <span className="min-w-0 flex-1 truncate font-mono text-[11px] tabular-nums text-[#6B6B6B]">
                          {istHM(s.created_at)} → {istHM(s.expires_at)}
                        </span>
                        <span className="shrink-0 text-[10.5px] tabular-nums text-[#969696]">
                          {st === 'live' || st === 'expired' ? expiryRel(s.expires_at) : tone.label}
                        </span>
                        {st === 'live' && (
                          <button
                            type="button"
                            onClick={() => (armed ? onCut(s.id) : onCutArm(s.id))}
                            disabled={cutting}
                            aria-label={
                              cutting
                                ? 'Ending session'
                                : armed
                                  ? `Confirm cut for the session opened ${istHM(s.created_at)}`
                                  : `Cut the session opened ${istHM(s.created_at)}`
                            }
                            className={`flex h-6 shrink-0 items-center gap-1 rounded-full px-2 text-[10.5px] font-bold transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#B3261E] ${
                              armed
                                ? 'bg-[#B3261E] text-white shadow-sm'
                                : 'text-[#969696] hover:bg-[#FDF3F2] hover:text-[#B3261E]'
                            }`}
                          >
                            {cutting ? (
                              <Loader2 size={11} className="animate-spin" aria-hidden />
                            ) : (
                              <Scissors size={11} aria-hidden />
                            )}
                            {armed ? 'Cut?' : ''}
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
                {sessions.length > 6 && (
                  <p className="mt-2 text-[11px] text-[#969696]">
                    +{sessions.length - 6} earlier scans on record
                  </p>
                )}
                <p className="mt-2 border-t border-[#E3E7E0] pt-2 text-[10.5px] leading-relaxed text-[#969696]">
                  Each row is one scan of this table's QR — a fresh 10-minute menu session every time.
                  The clock, not the stored status, decides live vs expired. <span className="font-semibold text-[#B3261E]">Cut</span> ends the
                  guest's open window — their menu locks and the token dies for orders; a new scan of the
                  printed sticker reopens (the QR stays the table's key). <span className="font-semibold text-[#B3261E]">Cut all live</span> does
                  every open window at once. Rides the floor's refresh.
                </p>
              </>
            )}
          </div>

          {/* QR block — always available; big on open tables, compact footer on live ones */}
          <div className={`rounded-2xl border border-[#E3E7E0] bg-white p-4 text-center shadow-sm ${isLive ? '' : 'mt-6'}`}>
            {!isLive && (
              <p className="mb-3 text-[13px] font-semibold text-[#0F3D3E]">Guests scan this to order from their phones</p>
            )}
            <div className="inline-flex rounded-2xl border-4 p-2" style={{ borderColor: '#0F3D3E' }}>
              {qr ? (
                <img src={qr} alt={`QR code for table ${table.table_number}`} width={isLive ? 120 : 200} height={isLive ? 120 : 200} className="rounded-lg" />
              ) : (
                <div className="flex items-center justify-center" style={{ width: isLive ? 120 : 200, height: isLive ? 120 : 200 }}>
                  <Loader2 size={20} className="animate-spin text-[#6B6B6B]" aria-hidden />
                </div>
              )}
            </div>
            <p className="mt-3 break-all rounded-xl bg-[#FBFBF9] px-3 py-2 font-mono text-[10.5px] text-[#6B6B6B]">{url}</p>
            <div className="mt-2 flex justify-center gap-2">
              <button
                type="button"
                onClick={() => void copy(url, 'link')}
                className="flex h-9 items-center gap-1.5 rounded-full border border-[#E3E7E0] px-3 text-[11.5px] font-bold text-[#0F3D3E] hover:border-[#B88E2F]"
              >
                {copied === 'link' ? <BadgeCheck size={13} className="text-[#2E7D32]" aria-hidden /> : <Link2 size={13} aria-hidden />}
                {copied === 'link' ? 'Copied' : 'Copy link'}
              </button>
              <button
                type="button"
                onClick={() => void copy(table.qr_token, 'token')}
                className="flex h-9 items-center gap-1.5 rounded-full border border-[#E3E7E0] px-3 text-[11.5px] font-bold text-[#6B6B6B] hover:border-[#B88E2F]"
              >
                {copied === 'token' ? <BadgeCheck size={13} className="text-[#2E7D32]" aria-hidden /> : <Copy size={13} aria-hidden />}
                {copied === 'token' ? 'Copied' : 'Copy token'}
              </button>
            </div>
          </div>
        </div>

        {/* footer */}
        <div className="border-t border-[#E3E7E0] bg-white px-4 py-3">
          {isLive ? (
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => useUi.getState().goSection('bills', ['Bills'])}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-full px-4 text-[13px] font-semibold text-white hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#967221]"
                style={{ background: '#0F3D3E' }}
              >
                <ExternalLink size={14} aria-hidden /> Open Bills to settle
              </button>
              <button
                type="button"
                onClick={startTicket}
                className="flex h-10 w-full items-center justify-center gap-2 rounded-full border border-[#E3E7E0] px-4 text-[12.5px] font-semibold text-[#0F3D3E] transition-colors hover:border-[#B88E2F] hover:bg-[#FBF7EC] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#967221]"
              >
                <Plus size={14} aria-hidden /> Start another round on Table {table.table_number}
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <button
                type="button"
                onClick={startTicket}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-full px-4 text-[13.5px] font-bold text-white shadow-sm transition-all hover:opacity-90 active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#967221]"
                style={{ background: table.status === 'reserved' ? '#B88E2F' : '#0F3D3E' }}
              >
                <Plus size={15} aria-hidden />
                {table.status === 'reserved'
                  ? `Seat reserved guests — start ticket on ${table.table_number}`
                  : `Seat & start ticket here (${table.table_number})`}
              </button>
              <p className="px-1 text-center text-[11.5px] leading-relaxed text-[#6B6B6B]">
                Opens Food &amp; Drinks with the ticket already seated — guests can also scan the QR above.
                Print as the table sticker with <span className="font-semibold text-[#0F3D3E]">Print stickers</span> in the header.
              </p>
            </div>
          )}

          {/* ── table management (5.35.0): the floor can be rearranged, not
              only grown. Edit renames/re-seats/re-sections; Remove retires a
              table that is genuinely idle (no order holding it). ── */}
          <div className="mt-auto flex items-center gap-2 border-t border-[#E3E7E0] pt-3">
            <button
              type="button"
              onClick={onEdit}
              className="flex h-10 items-center gap-1.5 rounded-full border border-[#E3E7E0] px-3.5 text-[12.5px] font-semibold text-[#0F3D3E] transition-colors hover:border-[#B88E2F] hover:bg-[#FBF7EC]"
            >
              <Pencil size={13} aria-hidden /> Edit
            </button>
            {removeArmed ? (
              <button
                type="button"
                disabled={removeBusy}
                onClick={onRemove}
                className="flex h-10 items-center gap-1.5 rounded-full bg-[#FEF2F2] px-3.5 text-[12.5px] font-bold text-[#B42318] transition-colors hover:bg-[#FDE7E5] disabled:opacity-55"
              >
                {removeBusy && <Loader2 size={13} className="animate-spin" aria-hidden />}
                Confirm remove?
              </button>
            ) : (
              <button
                type="button"
                disabled={!canRemove || removeBusy}
                title={canRemove ? 'Retire this table from the floor' : 'Seat or clear the table before removing it'}
                onClick={() => setRemoveArmed(true)}
                className="flex h-10 items-center gap-1.5 rounded-full border border-[#E3E7E0] px-3.5 text-[12.5px] font-semibold text-[#B4483C] transition-colors hover:bg-[#FDF3F2] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Trash2 size={13} aria-hidden /> Remove
              </button>
            )}
            <p className="min-w-0 flex-1 truncate text-right text-[10.5px] text-[#969696]">
              {removeArmed
                ? 'Orders keep their amounts; this table\'s QR links stop working.'
                : canRemove
                  ? 'Idle table — safe to retire'
                  : 'Busy tables can\'t be removed'}
            </p>
          </div>
        </div>
      </aside>
    </div>
  );
}

export function FloorScreen(): React.ReactElement {
  const { tenant, tenantId, error: tenantError, loading } = useTenant();
  const [tables, setTables] = useState<DiningTable[] | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [sessions, setSessions] = useState<TableSession[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [rtState, setRtState] = useState<RealtimeState>('connecting');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [editTable, setEditTable] = useState<DiningTable | null>(null);
  const [removeBusy, setRemoveBusy] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [cutArmId, setCutArmId] = useState<string | null>(null);
  const [cutBusyId, setCutBusyId] = useState<string | null>(null);
  const [bulkCutBusy, setBulkCutBusy] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [drillId, setDrillId] = useState<string | null>(null);
  const [filter, setFilter] = useState<TableStatus | null>(null);
  const [stickerBusy, setStickerBusy] = useState(false);
  /** v5.29.0 — floor rhythm compare: 'week' = this 7d alone (pre-5.29 view),
   *  'compare' = lay the prior 7d's hour-of-day rhythm under this one. */
  const [rhythmMode, setRhythmMode] = useState<'week' | 'compare'>('week');
  /** v5.38.0 — the book: reservations, their fail-soft load error, the
   *  booking dialog, and the past-week toggle for the archive rows. */
  const [reservations, setReservations] = useState<Reservation[] | null>(null);
  const [bookError, setBookError] = useState<string | null>(null);
  const [bookOpen, setBookOpen] = useState(false);
  const [showPast, setShowPast] = useState(false);
  const pingRef = useRef<number | null>(null);

  const reload = useCallback(async () => {
    if (!tenantId) return;
    try {
      setLoadError(null);
      const [t, o] = await Promise.all([fetchTables(tenantId), fetchOrders(tenantId, 100)]);
      setTables(t);
      setOrders(o);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not load the floor.');
    }
    // Guest session trail (v5.23.0) rides along FAIL-SOFT: a session-read
    // hiccup must never take the board down, and a stale trail beats a blank one.
    fetchTableSessions(tenantId)
      .then((ss) => setSessions(ss))
      .catch(() => undefined);
    // The book (v5.38.0) rides along too — but it fails HONESTLY: a failed
    // read shows its own error line with a retry, never a fake empty book.
    fetchReservations(tenantId)
      .then((rs) => {
        setReservations(rs);
        setBookError(null);
      })
      .catch(() => setBookError('Could not load the book.'));
  }, [tenantId]);

  useEffect(() => {
    if (!tenantId) return;
    void reload();
  }, [tenantId, reload]);

  // realtime (migration 011) + 30s safety poll — the book rides the same
  // ping (its own subscription, migration 028's publication)
  useEffect(() => {
    if (!tenantId) return;
    const ping = () => {
      if (pingRef.current) window.clearTimeout(pingRef.current);
      pingRef.current = window.setTimeout(() => void reload(), 250);
    };
    const unsub = subscribeTablesRealtime(tenantId, ping, setRtState);
    const unsubBook = subscribeReservationsRealtime(tenantId, ping, setRtState);
    const poll = window.setInterval(() => void reload(), 30000);
    return () => {
      window.clearInterval(poll);
      if (pingRef.current) window.clearTimeout(pingRef.current);
      unsub();
      unsubBook();
    };
  }, [tenantId, reload]);

  const runAction = useCallback(
    async (id: string, fn: () => Promise<void>) => {
      setBusyId(id);
      setActionError(null);
      try {
        await fn();
      } catch (err) {
        setActionError(err instanceof Error ? err.message : 'Something went wrong. Try again.');
      } finally {
        setBusyId(null);
      }
    },
    []
  );

  const armConfirm = useCallback((id: string) => {
    setConfirmId(id);
    window.setTimeout(() => setConfirmId((c) => (c === id ? null : c)), 3000);
  }, []);

  /** Two-step arm for the session cut (own namespace — table confirms are separate). */
  const armCut = useCallback((sessionId: string) => {
    setCutArmId(sessionId);
    window.setTimeout(() => setCutArmId((c) => (c === sessionId ? null : c)), 3000);
  }, []);

  /** Staff cut (v5.24.0): end the guest's live window. Optimistic flip so the
   *  row shows the cut skin instantly; the resync afterwards is the truth. */
  const cutSession = useCallback(
    async (sessionId: string) => {
      setCutArmId(null);
      setCutBusyId(sessionId);
      setActionError(null);
      setSessions((prev) => prev.map((s) => (s.id === sessionId ? { ...s, status: 'revoked' } : s)));
      try {
        await revokeTableSession(sessionId);
      } catch (err) {
        setActionError(err instanceof Error ? err.message : 'Could not cut the session. Try again.');
      } finally {
        setCutBusyId(null);
        void reload(); // the board resyncs — status, cards and the drill agree
      }
    },
    [reload],
  );

  /** Bulk cut (v5.26.0): end EVERY live window on one table — the leaked-QR
   *  scenario (a photo of the sticker circulating) needs one tap, not N
   *  two-step cuts. Optimistic flip for all ids, allSettled so one RLS hiccup
   *  can't strand the rest, honest partial-failure message, resync as truth. */
  const cutAllSessions = useCallback(
    async (tableId: string, sessionIds: string[]) => {
      setActionError(null);
      setBulkCutBusy(tableId);
      const ids = new Set(sessionIds);
      setSessions((prev) => prev.map((s) => (ids.has(s.id) ? { ...s, status: 'revoked' } : s)));
      const results = await Promise.allSettled(sessionIds.map((id) => revokeTableSession(id)));
      const failed = results.filter((r) => r.status === 'rejected').length;
      if (failed > 0) {
        setActionError(
          failed === sessionIds.length
            ? 'Could not cut the sessions. Try again.'
            : `${failed} of ${sessionIds.length} cuts failed — the list shows what actually held.`,
        );
      }
      setBulkCutBusy(null);
      void reload(); // the board resyncs — status, cards and the drill agree
    },
    [reload],
  );

  const copyLink = useCallback(async (t: DiningTable) => {
    try {
      await navigator.clipboard.writeText(guestUrlOf(t));
      setCopiedId(t.id);
      window.setTimeout(() => setCopiedId((c) => (c === t.id ? null : c)), 2000);
    } catch {
      setActionError('Copy failed — long-press the link text instead.');
    }
  }, []);

  /** Render every table's QR into one A4 cut-line sheet (hidden-iframe print). */
  const printStickers = useCallback(async () => {
    const list = tables || [];
    if (list.length === 0 || stickerBusy) return;
    setStickerBusy(true);
    setActionError(null);
    try {
      const logo = tenant?.logo_url || null;
      if (logo) await preloadPrintImage(logo); // print() won't wait for a cold remote image
      const specs = await Promise.all(
        list.map(async (t) => ({
          tableNumber: t.table_number,
          section: t.section || '',
          url: guestUrlOf(t),
          qr: await qrDataUrl(guestUrlOf(t)),
          logo,
        })),
      );
      printQrStickers(tenant?.name || 'ServePoint', specs, logo);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not render the stickers.');
    } finally {
      setStickerBusy(false);
    }
  }, [tables, tenant, stickerBusy]);

  const orderByTable = useMemo(() => {
    const m = new Map<string, Order>();
    orders.forEach((o) => m.set(o.id, o));
    return m;
  }, [orders]);

  const stats = useMemo(() => {
    const list = tables || [];
    const seats = list.reduce((s, t) => s + t.capacity, 0);
    const seatsUsed = list.filter((t) => t.status === 'occupied' || t.status === 'billing').reduce((s, t) => s + t.capacity, 0);
    return {
      available: list.filter((t) => t.status === 'available').length,
      occupied: list.filter((t) => t.status === 'occupied').length,
      reserved: list.filter((t) => t.status === 'reserved').length,
      billing: list.filter((t) => t.status === 'billing').length,
      seats,
      seatsUsed,
    };
  }, [tables]);

  const sections = useMemo(() => {
    const map = new Map<string, DiningTable[]>();
    (tables || []).forEach((t) => {
      if (filter && t.status !== filter) return;
      const key = t.section || 'Main Floor';
      const list = map.get(key) || [];
      list.push(t);
      map.set(key, list);
    });
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [tables, filter]);

  const drillTable = useMemo(
    () => (tables || []).find((t) => t.id === drillId) || null,
    [tables, drillId],
  );
  const drillOrder = useMemo(
    () => (drillTable?.active_order_id ? orderByTable.get(drillTable.active_order_id) : undefined),
    [drillTable, orderByTable],
  );
  const visibleCount = useMemo(
    () => (filter ? sections.reduce((n, [, list]) => n + list.length, 0) : (tables || []).length),
    [sections, filter, tables],
  );

  /* Guest session trail (v5.23.0) — sessions grouped by table for the card
     chips and the drill panel. Rides the floor's refresh cycle (reload +
     realtime ping + 30s poll); the trail is a census, not a live socket. */
  const sessionsByTable = useMemo(() => {
    const m = new Map<string, TableSession[]>();
    for (const s of sessions) {
      const list = m.get(s.table_id);
      if (list) list.push(s);
      else m.set(s.table_id, [s]);
    }
    return m;
  }, [sessions]);

  /* Floor rhythm (v5.22.0) — table-bound tickets per IST hour, last 7 IST days.
     Derives from the same orders array the board already fetched (rides
     reload()); counts every non-cancelled ticket that holds a table, so
     walk-in counter tickets stay out of the floor's rhythm. No chart at all
     when the ledger has nothing table-bound in the window.
     v5.29.0: also aggregates the PRIOR 7 IST days (same hour-of-day shape)
     so the compare toggle can lay this week's rhythm over last week's —
     same ledger, no extra fetch. prevTotal === 0 is honest data (a young
     cafe, or a ledger window that doesn't reach back); the compare mode
     says so instead of drawing a fake baseline. */
  const rhythm = useMemo(() => {
    const endMs = istDayStartFloor(istTodayIsoFloor()) + 24 * 3600 * 1000; // end of today (IST)
    const startMs = endMs - 7 * 24 * 3600 * 1000; // last 7 IST calendar days
    const prevStartMs = startMs - 7 * 24 * 3600 * 1000; // the 7 days before that
    const inWindow = (o: Order, from: number, to: number) => {
      const t = new Date(o.created_at).getTime();
      return (
        o.table_id !== null &&
        o.table_id !== undefined &&
        o.status !== 'cancelled' &&
        t >= from &&
        t < to
      );
    };
    const rows = orders.filter((o) => inWindow(o, startMs, endMs));
    const prevRows = orders.filter((o) => inWindow(o, prevStartMs, startMs));
    const buckets = new Array<number>(24).fill(0);
    const prevBuckets = new Array<number>(24).fill(0);
    const byDay = new Map<string, number>();
    for (const o of rows) {
      buckets[istHour(o.created_at)] += 1;
      const d = istDateKey(o.created_at);
      byDay.set(d, (byDay.get(d) || 0) + 1);
    }
    for (const o of prevRows) {
      prevBuckets[istHour(o.created_at)] += 1;
    }
    const data = buckets.map((n, hour) => ({ hour, n, pn: prevBuckets[hour], label: hourLabel(hour) }));
    const max = buckets.reduce((a, b) => Math.max(a, b), 0);
    const peakHour = max > 0 ? buckets.indexOf(max) : -1;
    const prevTotal = prevRows.length;
    const prevMax = prevBuckets.reduce((a, b) => Math.max(a, b), 0);
    let busiest: { label: string; n: number } | null = null;
    for (const [d, n] of byDay) {
      if (!busiest || n > busiest.n) busiest = { label: istDayPretty(d), n };
    }
    return { data, max, peakHour, total: rows.length, busiest, prevData: prevBuckets, prevTotal, prevMax };
  }, [orders]);

  /* The book (v5.38.0) — lifecycle flips are one honest UPDATE each; the
     board syncs best-effort around them: seating a party claims a FREE
     table (status 'reserved'), any undo releases a table that is still
     reserved and orderless. The 011 trigger owns everything else — an
     occupied/billing table is never touched from here. */
  const flipReservation = useCallback(
    async (r: Reservation, status: ReservationStatus) => {
      if (!tenantId) return;
      setActionError(null);
      setBusyId(`res-${r.id}`);
      try {
        await updateReservationStatus(r.id, status);
        if (r.table_id) {
          const t = (tables ?? []).find((x) => x.id === r.table_id);
          if (t && !t.active_order_id) {
            if (status === 'seated' && t.status === 'available') {
              await updateTable(t.id, tenantId, { status: 'reserved' }).catch(() => undefined);
            } else if (status !== 'seated' && t.status === 'reserved') {
              await updateTable(t.id, tenantId, { status: 'available' }).catch(() => undefined);
            }
          }
        }
      } catch (err) {
        setActionError(err instanceof Error ? err.message : 'Could not update the booking.');
      } finally {
        setBusyId(null);
        void reload();
      }
    },
    [tables, tenantId, reload],
  );

  /* The book's day groups: from today IST forward (or the past week when
     the archive toggle is on), grouped by IST day, rows ascending within a
     day. Days without bookings render nothing — honest silence, not a wall
     of empty headers. */
  const book = useMemo(() => {
    const rows = reservations ?? [];
    const today = istTodayIsoFloor();
    const startMs = istDayStartFloor(today);
    const weekMs = startMs - 7 * 24 * 3600 * 1000;
    const inScope = rows
      .filter((r) => {
        const t = new Date(r.slot_at).getTime();
        return showPast ? t >= weekMs : t >= startMs;
      })
      .sort((a, b) => new Date(a.slot_at).getTime() - new Date(b.slot_at).getTime());
    const map = new Map<string, Reservation[]>();
    for (const r of inScope) {
      const k = istDateKey(r.slot_at);
      const list = map.get(k);
      if (list) list.push(r);
      else map.set(k, [r]);
    }
    const pastCount = rows.filter((r) => new Date(r.slot_at).getTime() < startMs).length;
    const bookedToday = rows.filter((r) => istDateKey(r.slot_at) === today && r.status === 'booked').length;
    return { groups: [...map.entries()], pastCount, bookedToday, total: rows.length };
  }, [reservations, showPast]);

  if (loading) {
    return <SkeletonBoard />;
  }
  if (tenantError || !tenantId) {
    return (
      <div className="p-4 lg:p-5">
        <div className="rounded-2xl border border-[#F0D9D5] bg-[#FDF3F2] p-4 text-[13.5px] text-[#B4483C]">{tenantError || 'No tenant context.'}</div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-4 lg:p-5">
      {/* header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-[28px] italic leading-tight text-[#0F3D3E]">Floor</h1>
          <p className="mt-0.5 text-[13px] text-[#6B6B6B]">
            {tenant?.name} · {stats.seatsUsed}/{stats.seats} seats busy · tables hold themselves when orders land
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <LiveChip state={rtState} />
          <button
            type="button"
            onClick={() => {
              setActionError(null);
              setBookOpen(true);
            }}
            aria-label="Take a booking"
            className="flex h-11 items-center gap-1.5 rounded-full border border-[#E3E7E0] bg-white px-4 text-[13px] font-semibold text-[#0F3D3E] hover:border-[#B88E2F]"
          >
            <CalendarClock size={15} aria-hidden /> Take a booking
          </button>
          <button
            type="button"
            onClick={() => void printStickers()}
            disabled={stickerBusy || (tables || []).length === 0}
            aria-label="Print QR stickers for every table"
            className="flex h-11 items-center gap-1.5 rounded-full border border-[#E3E7E0] bg-white px-4 text-[13px] font-semibold text-[#0F3D3E] hover:border-[#B88E2F] disabled:opacity-50"
          >
            {stickerBusy ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <Printer size={15} aria-hidden />} Print stickers
          </button>
          <button
            type="button"
            onClick={() => void reload()}
            aria-label="Refresh floor"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-[#E3E7E0] bg-white text-[#0F3D3E] hover:border-[#B88E2F]"
          >
            <RefreshCw size={15} aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="flex h-11 items-center gap-1.5 rounded-full px-4 text-[13px] font-semibold text-white hover:opacity-90"
            style={{ background: '#0F3D3E' }}
          >
            <Plus size={15} aria-hidden /> Add table
          </button>
        </div>
      </div>

      {/* stat strip — tap a tile to filter the board to that status */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {(['available', 'occupied', 'reserved', 'billing'] as TableStatus[]).map((s) => {
          const active = filter === s;
          return (
            <button
              key={s}
              type="button"
              aria-pressed={active}
              onClick={() => setFilter((f) => (f === s ? null : s))}
              className={`rounded-2xl border bg-white px-4 py-3 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#967221] ${active ? 'border-[#B88E2F] ring-2 ring-[#B88E2F]/30' : 'border-[#E3E7E0]'}`}
            >
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: STATUS_META[s].dot }} aria-hidden />
                <span className="text-[11.5px] font-semibold uppercase tracking-wide text-[#6B6B6B]">{STATUS_META[s].label}</span>
              </div>
              <p className="mt-1 text-[22px] font-bold tabular-nums text-[#1A1A1A]">{stats[s]}</p>
            </button>
          );
        })}
      </div>

      {/* the book (v5.38.0) — the phone promises, on the record */}
      <section className="sp-card p-5" aria-label="The book">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-[15px] font-bold text-[#1A1A1A]">The book</h2>
            <p className="mt-0.5 text-[12.5px] text-[#6B6B6B]">
              Reservations · every phone promise and what became of it
              {book.bookedToday > 0 && <> · <span className="font-bold text-[#8A5A00]">{book.bookedToday} still expected today</span></>}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setActionError(null);
              setBookOpen(true);
            }}
            aria-label="Take a booking"
            className="flex h-9 items-center gap-1.5 rounded-full border border-[#E3E7E0] bg-white px-3.5 text-[12.5px] font-semibold text-[#0F3D3E] hover:border-[#B88E2F]"
          >
            <CalendarClock size={13} aria-hidden /> Take a booking
          </button>
        </div>

        {bookError && (
          <p className="mt-3 flex items-center gap-2 rounded-xl bg-[#FDF3F2] px-3 py-2 text-[12.5px] text-[#B4483C]" role="alert">
            <CircleAlert size={14} aria-hidden /> {bookError}
            <button type="button" onClick={() => void reload()} className="ml-auto rounded-full border border-[#F0D9D5] px-2.5 py-1 text-[11.5px] font-semibold hover:bg-white">
              Retry
            </button>
          </p>
        )}

        {reservations === null && !bookError && (
          <p className="mt-3 text-[12.5px] text-[#6B6B6B]">Opening the book…</p>
        )}

        {reservations !== null && !bookError && book.groups.length === 0 && (
          <div className="mt-4 rounded-2xl border border-dashed border-[#C9D4CC] bg-white/60 p-6 text-center">
            <CalendarClock size={24} className="mx-auto text-[#6B6B6B]" aria-hidden />
            <p className="mt-2 text-[13px] font-semibold text-[#0F3D3E]">
              {showPast ? 'Nothing on the books this week' : 'No bookings ahead'}
            </p>
            <p className="mx-auto mt-1 max-w-sm text-[12.5px] text-[#6B6B6B]">
              When the phone rings, take the promise here — the book remembers the name, the hour and the table.
            </p>
          </div>
        )}

        {book.groups.map(([dayKey, rows]) => (
          <div key={dayKey} className="mt-4">
            <h3 className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-wide text-[#6B6B6B]">
              {istDayHeading(dayKey)}
              <span className="rounded-full bg-[#F1F4F1] px-2 py-0.5 text-[10.5px] font-bold normal-case tabular-nums text-[#0F3D3E]">{rows.length}</span>
            </h3>
            <div className="mt-2 space-y-2">
              {rows.map((r) => {
                const busy = busyId === `res-${r.id}`;
                const res = RES_META[r.status];
                const table = r.table_id ? (tables ?? []).find((t) => t.id === r.table_id) : null;
                return (
                  <div
                    key={r.id}
                    data-res-status={r.status}
                    className={`flex flex-wrap items-center gap-x-2.5 gap-y-1.5 rounded-2xl border border-[#E3E7E0] bg-white px-3.5 py-2.5 ${r.status === 'cancelled' ? 'opacity-70' : ''}`}
                  >
                    <span className="rounded-xl bg-[#F6F5F2] px-2.5 py-1 text-[12.5px] font-bold tabular-nums text-[#0F3D3E]">{istSlotLabel(r.slot_at)}</span>
                    <span className="flex items-center gap-1 rounded-full bg-[#F1F4F1] px-2 py-0.5 text-[11.5px] font-bold tabular-nums text-[#0F3D3E]" title="Party size">
                      <Users size={11} aria-hidden /> ×{r.party_size}
                    </span>
                    {table ? (
                      <span className="rounded-full bg-[#FBF3E1] px-2 py-0.5 text-[11.5px] font-bold text-[#8A5A00]" title={table.section || 'Main Floor'}>
                        {table.table_number}
                      </span>
                    ) : (
                      <span className="rounded-full border border-dashed border-[#C9D4CC] px-2 py-0.5 text-[11px] font-medium text-[#6B6B6B]">table open</span>
                    )}
                    <span className={`text-[13.5px] font-semibold text-[#1A1A1A] ${r.status === 'cancelled' ? 'line-through' : ''}`}>{r.guest_name}</span>
                    {r.phone && (
                      <a href={`tel:${r.phone}`} className="flex items-center gap-1 text-[12px] tabular-nums text-[#6B6B6B] hover:text-[#0F3D3E]">
                        <Phone size={11} aria-hidden /> {r.phone}
                      </a>
                    )}
                    {r.note && <span className="basis-full text-[12px] italic text-[#6B6B6B]">“{r.note}”</span>}
                    <span className="ml-auto rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide" style={{ background: res.bg, color: res.fg }}>
                      {res.label}
                    </span>
                    <span className="flex items-center gap-1.5">
                      {r.status === 'booked' && (
                        <>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void flipReservation(r, 'seated')}
                            aria-label={`Seat ${r.guest_name}`}
                            className="flex h-8 items-center gap-1 rounded-full px-3 text-[12px] font-semibold text-white disabled:opacity-50"
                            style={{ background: '#0F3D3E' }}
                          >
                            <Users size={12} aria-hidden /> Seat
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void flipReservation(r, 'no_show')}
                            aria-label={`Mark ${r.guest_name} no-show`}
                            className="h-8 rounded-full border border-[#E3E7E0] px-2.5 text-[12px] font-semibold text-[#6B6B6B] hover:bg-[#F6F5F2] disabled:opacity-50"
                          >
                            No-show
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void flipReservation(r, 'cancelled')}
                            aria-label={`Cancel the booking for ${r.guest_name}`}
                            className="h-8 rounded-full border border-[#F0D9D5] px-2.5 text-[12px] font-semibold text-[#B4483C] hover:bg-[#F6E8E6] disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        </>
                      )}
                      {r.status !== 'booked' && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void flipReservation(r, 'booked')}
                          aria-label={r.status === 'seated' ? `Undo seat for ${r.guest_name}` : `Put ${r.guest_name} back in the book`}
                          className="h-8 rounded-full border border-[#E3E7E0] px-2.5 text-[12px] font-semibold text-[#0F3D3E] hover:border-[#B88E2F] disabled:opacity-50"
                        >
                          {r.status === 'seated' ? 'Undo seat' : 'Restore'}
                        </button>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {reservations !== null && !bookError && book.pastCount > 0 && (
          <button
            type="button"
            onClick={() => setShowPast((p) => !p)}
            aria-pressed={showPast}
            className="mt-3 rounded-full border border-[#E3E7E0] px-3 py-1.5 text-[11.5px] font-semibold text-[#6B6B6B] hover:border-[#B88E2F] hover:text-[#0F3D3E]"
          >
            {showPast ? 'Hide past week' : `Show past week (${book.pastCount})`}
          </button>
        )}
      </section>

      {filter && (
        <div className="flex flex-wrap items-center gap-2 text-[12px] text-[#6B6B6B]">
          <span>
            Showing <span className="font-bold text-[#0F3D3E]">{visibleCount}</span> of {(tables || []).length} tables &middot; {STATUS_META[filter].label.toLowerCase()} only
          </span>
          <button
            type="button"
            onClick={() => setFilter(null)}
            className="rounded-full border border-[#E3E7E0] px-3 py-1 text-[11.5px] font-bold text-[#0F3D3E] hover:border-[#B88E2F]"
          >
            Show everything
          </button>
        </div>
      )}

      {filter && visibleCount === 0 && (
        <div className="rounded-3xl border border-dashed border-[#C9D4CC] bg-white/60 p-10 text-center">
          <Armchair size={30} className="mx-auto text-[#6B6B6B]" aria-hidden />
          <h2 className="mt-3 font-serif text-[22px] italic text-[#0F3D3E]">Nothing {STATUS_META[filter].label.toLowerCase()} right now</h2>
          <p className="mx-auto mt-1 max-w-sm text-[13px] text-[#6B6B6B]">
            The board refreshes itself the moment an order lands or a table frees up.
          </p>
        </div>
      )}

      {/* floor rhythm (v5.22.0) — table tickets per IST hour, last 7 days.
          v5.29.0: "vs prior wk" lays the prior 7d's hour-of-day rhythm over
          this one (gray dashed) — the board learns hindsight from the same
          ledger, no extra fetch. */}
      <section className="sp-card p-5" aria-label="Floor rhythm">
        <div className="mb-1 flex items-center justify-between gap-2">
          <h2 className="text-[15px] font-bold text-[#1A1A1A]">Floor rhythm</h2>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#6B6B6B]">
              <Clock size={11} aria-hidden /> IST hours · last 7 days
            </span>
            <div
              className="inline-flex rounded-full border border-[#E3E7E0] bg-white p-0.5"
              role="group"
              aria-label="Rhythm comparison mode"
            >
              {([
                ['week', 'This 7d'],
                ['compare', 'vs prior wk'],
              ] as const).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  aria-pressed={rhythmMode === mode}
                  onClick={() => setRhythmMode(mode)}
                  className={`rounded-full px-2.5 py-1 text-[10.5px] font-bold transition-colors ${
                    rhythmMode === mode
                      ? 'bg-[#0F3D3E] text-white'
                      : 'text-[#6B6B6B] hover:text-[#0F3D3E]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <p className="mb-3 text-[11.5px] text-[#969696]">
          Table tickets seated per hour of day — when the floor actually fills.
          {rhythm.peakHour >= 0 && (
            <>
              {' '}Peak hour: <span className="font-bold text-[#8A5A00]">{hourLabel(rhythm.peakHour)} ({rhythm.max} tickets)</span>
            </>
          )}
          {rhythmMode === 'compare' && rhythm.prevTotal > 0 && (
            <>
              {' '}· <span className="font-semibold text-[#6B6B6B]">gray dashed = prior 7d</span>
            </>
          )}
        </p>
        {rhythm.total === 0 ? (
          <div className="flex h-40 flex-col items-center justify-center gap-2 text-center">
            <Armchair size={22} className="text-[#969696]" aria-hidden />
            <p className="text-[12.5px] font-semibold text-[#1A1A1A]">No table tickets in the last 7 days</p>
            <p className="max-w-[250px] text-[11.5px] text-[#6B6B6B]">
              Seat a table from this board — the rhythm builds itself as rounds land.
            </p>
          </div>
        ) : (
          <>
            <div className="mb-3 grid grid-cols-3 gap-2">
              <div className="rounded-2xl border border-[#E3E7E0] bg-white px-3 py-2">
                <p className="text-[10.5px] font-semibold uppercase tracking-wide text-[#6B6B6B]">Seated rounds · 7d</p>
                <p className="mt-0.5 text-[18px] font-bold tabular-nums text-[#1A1A1A]">{rhythm.total}</p>
                {rhythmMode === 'compare' && (
                  <p className="mt-0.5 text-[10.5px] font-semibold tabular-nums">
                    {rhythm.prevTotal > 0 ? (
                      (() => {
                        const delta = rhythm.total - rhythm.prevTotal;
                        const pct = rhythm.prevTotal > 0 ? Math.round((delta / rhythm.prevTotal) * 100) : null;
                        return (
                          <span className={delta >= 0 ? 'text-[#2E7D32]' : 'text-[#B4483C]'}>
                            {delta >= 0 ? '+' : '-'}{Math.abs(delta)} vs prior 7d
                            {pct !== null && Number.isFinite(pct) ? ` (${delta >= 0 ? '+' : '-'}${Math.abs(pct)}%)` : ''}
                            <span className="ml-1 font-normal text-[#969696]">· prior {rhythm.prevTotal}</span>
                          </span>
                        );
                      })()
                    ) : (
                      <span className="text-[#969696]">no prior-week tickets in the loaded ledger yet</span>
                    )}
                  </p>
                )}
              </div>
              <div className="rounded-2xl border border-[#E3E7E0] bg-white px-3 py-2">
                <p className="text-[10.5px] font-semibold uppercase tracking-wide text-[#6B6B6B]">Peak hour</p>
                <p className="mt-0.5 text-[18px] font-bold tabular-nums text-[#8A5A00]">
                  {hourLabel(rhythm.peakHour)} <span className="text-[12px] font-semibold text-[#6B6B6B]">· {rhythm.max} tickets</span>
                </p>
              </div>
              <div className="rounded-2xl border border-[#E3E7E0] bg-white px-3 py-2">
                <p className="text-[10.5px] font-semibold uppercase tracking-wide text-[#6B6B6B]">Busiest day</p>
                <p className="mt-0.5 text-[18px] font-bold tabular-nums text-[#0F3D3E]">
                  {rhythm.busiest ? rhythm.busiest.label : '—'}{' '}
                  <span className="text-[12px] font-semibold text-[#6B6B6B]">{rhythm.busiest ? `· ${rhythm.busiest.n}` : ''}</span>
                </p>
              </div>
            </div>
            <div className="h-48" aria-hidden>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={rhythm.data} margin={{ top: 4, right: 8, bottom: 0, left: -30 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E3E7E0" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10, fill: '#6B6B6B' }}
                    tickLine={false}
                    axisLine={{ stroke: '#E3E7E0' }}
                    interval={2}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 10, fill: '#969696' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(184,142,47,0.08)' }}
                    contentStyle={{
                      borderRadius: 12,
                      border: '1px solid #E3E7E0',
                      fontSize: 12,
                      boxShadow: '0 4px 14px rgba(15,61,62,0.10)',
                    }}
                    formatter={(v: unknown, name: unknown) => [
                      `${v} ticket${Number(v) === 1 ? '' : 's'}`,
                      String(name ?? 'Seated'),
                    ]}
                    content={rhythmMode === 'compare' && rhythm.prevTotal > 0 ? <SpHourDeltaTooltip /> : undefined}
                  />
                  <Bar dataKey="n" name="Seated · this 7d" radius={[4, 4, 0, 0]}>
                    {rhythm.data.map((h) => (
                      <Cell key={h.hour} fill={h.n >= rhythm.max && h.n > 0 ? '#B88E2F' : '#0F3D3E'} />
                    ))}
                  </Bar>
                  {rhythmMode === 'compare' && rhythm.prevTotal > 0 && (
                    <Line
                      dataKey="pn"
                      name="Seated · prior 7d"
                      stroke="#969696"
                      strokeWidth={1.5}
                      strokeDasharray="5 3"
                      dot={{ r: 2, fill: '#969696', strokeWidth: 0 }}
                      activeDot={{ r: 3, fill: '#969696', strokeWidth: 0 }}
                      isAnimationActive={false}
                    />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-[#969696]">
              Counts every non-cancelled ticket that holds a table, by its IST hour — the same ledger Reports reads.
              Walk-in counter tickets don't hold a table, so they stay out of the rhythm. A round is a ticket, not a headcount.
              Rides the floor's refresh.
              {rhythmMode === 'compare' &&
                (rhythm.prevTotal > 0
                  ? ' The gray dashed line aggregates the PRIOR 7 IST days the same way — same hour-of-day, same rules. Hover a bar for that hour\'s delta.'
                  : ' No prior-week table tickets in the loaded ledger yet — the comparison unlocks as the ledger ages.')}
            </p>
          </>
        )}
      </section>

      {(loadError || actionError) && (
        <div className="flex items-center justify-between rounded-2xl border border-[#F0D9D5] bg-[#FDF3F2] px-4 py-3">
          <p className="flex items-center gap-2 text-[13px] text-[#B4483C]">
            <CircleAlert size={15} aria-hidden /> {loadError || actionError}
          </p>
          <button type="button" onClick={() => void reload()} className="flex items-center gap-1.5 rounded-full border border-[#F0D9D5] px-3 py-1.5 text-[12px] font-semibold text-[#B4483C] hover:bg-white">
            <RefreshCw size={12} aria-hidden /> Retry
          </button>
        </div>
      )}

      {/* board */}
      {(tables || []).length === 0 && !loadError && (
        <div className="rounded-3xl border border-dashed border-[#C9D4CC] bg-white/60 p-10 text-center">
          <Armchair size={30} className="mx-auto text-[#6B6B6B]" aria-hidden />
          <h2 className="mt-3 font-serif text-[22px] italic text-[#0F3D3E]">No tables yet</h2>
          <p className="mx-auto mt-1 max-w-sm text-[13px] text-[#6B6B6B]">
            Add your tables, copy each card's guest link onto a printed QR sticker, and the customer side of ServePoint switches itself on.
          </p>
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="mt-5 inline-flex h-11 items-center gap-2 rounded-full px-5 text-[13.5px] font-semibold text-white hover:opacity-90"
            style={{ background: '#0F3D3E' }}
          >
            <Plus size={15} aria-hidden /> Add your first table
          </button>
        </div>
      )}

      {sections.map(([section, list]) => (
        <section key={section} aria-label={section}>
          <h2 className="mb-2 font-serif text-[19px] italic text-[#0F3D3E]">
            {section}
            <span className="ml-2 rounded-full bg-[#F1F4F1] px-2 py-0.5 align-middle text-[10.5px] font-sans font-bold not-italic text-[#0F3D3E]">{list.length}</span>
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {list.map((t) => {
              const meta = STATUS_META[t.status];
              const activeOrder = t.active_order_id ? orderByTable.get(t.active_order_id) : undefined;
              const busy = busyId === t.id;
              const armed = confirmId === t.id;
              const isLive = t.status === 'occupied' || t.status === 'billing';
              return (
                <div
                  key={t.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`Open details for table ${t.table_number}`}
                  onClick={() => setDrillId(t.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setDrillId(t.id);
                    }
                  }}
                  className="flex cursor-pointer flex-col gap-3 rounded-3xl border border-[#E3E7E0] border-l-4 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#967221]"
                  style={{ borderLeftColor: meta.dot }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="flex items-center gap-2 text-[19px] font-bold leading-none text-[#1A1A1A]">
                        <Armchair size={17} style={{ color: meta.dot }} aria-hidden />
                        {t.table_number}
                      </p>
                      <p className="mt-1.5 flex items-center gap-1.5 text-[12px] text-[#6B6B6B]">
                        <Users size={12} aria-hidden /> {t.capacity} seats
                        {(sessionsByTable.get(t.id)?.length ?? 0) > 0 && (
                          <span
                            className="ml-1.5 flex items-center gap-1 rounded-full bg-[#F1F4F1] px-2 py-0.5 text-[10.5px] font-bold tabular-nums text-[#0F3D3E]"
                            title={`${sessionsByTable.get(t.id)!.length} guest QR sessions on record for this table`}
                          >
                            <Smartphone size={10} aria-hidden /> {sessionsByTable.get(t.id)!.length} scan{sessionsByTable.get(t.id)!.length === 1 ? '' : 's'}
                          </span>
                        )}
                        {isLive && activeOrder && (
                          <span className="ml-auto flex items-center gap-1 tabular-nums" title="Since the order was placed">
                            <Clock size={11} aria-hidden /> <TimeAgo iso={activeOrder.created_at} />
                          </span>
                        )}
                      </p>
                    </div>
                    <span className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: meta.bg, color: meta.fg }}>
                      <span className={`h-1.5 w-1.5 rounded-full ${t.status === 'occupied' ? 'animate-pulse' : ''}`} style={{ background: meta.dot }} aria-hidden />
                      {meta.label}
                    </span>
                  </div>

                  {activeOrder && (
                    <div className="rounded-xl bg-[#FBFBF9] px-3 py-2 text-[12px] text-[#6B6B6B]">
                      <p className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-[#1A1A1A]">#{activeOrder.order_number} · {activeOrder.customer_name || 'Guest'}</span>
                        <span className="font-bold tabular-nums text-[#1A1A1A]">{formatMoney(activeOrder.total)}</span>
                      </p>
                      <p className="mt-0.5 flex items-center gap-1.5">
                        <BadgeCheck size={11} aria-hidden /> {activeOrder.status} · placed <TimeAgo iso={activeOrder.created_at} /> ago
                      </p>
                    </div>
                  )}

                  {/* guest link / QR token */}
                  <div className="flex items-center gap-2 rounded-xl border border-[#E3E7E0] bg-[#FBFBF9] px-3 py-2">
                    <QrCode size={14} className="shrink-0 text-[#6B6B6B]" aria-hidden />
                    <code className="min-w-0 flex-1 truncate font-mono text-[10.5px] text-[#6B6B6B]" title={`/t/${t.qr_token}`}>
                      /t/{t.qr_token}
                    </code>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        void copyLink(t);
                      }}
                      className="flex h-9 shrink-0 items-center gap-1 rounded-full px-2.5 text-[11px] font-bold text-[#0F3D3E] hover:bg-[#F1F4F1]"
                      aria-label={`Copy guest link for table ${t.table_number}`}
                    >
                      {copiedId === t.id ? <BadgeCheck size={13} className="text-[#2E7D32]" aria-hidden /> : <Link2 size={13} aria-hidden />}
                      {copiedId === t.id ? 'Copied' : 'Link'}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        void navigator.clipboard?.writeText(t.qr_token);
                      }}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#6B6B6B] hover:bg-[#F1F4F1]"
                      aria-label={`Copy raw QR token for table ${t.table_number}`}
                    >
                      <Copy size={13} aria-hidden />
                    </button>
                  </div>

                  {/* lifecycle actions */}
                  <div className="mt-auto flex flex-wrap gap-1.5">
                    {t.status === 'available' && (
                      <>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={(e) => {
                            e.stopPropagation();
                            void runAction(t.id, () => updateTable(t.id, tenantId, { status: 'occupied' }));
                          }}
                          className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-full px-3 text-[12.5px] font-semibold text-white disabled:opacity-50"
                          style={{ background: '#0F3D3E' }}
                        >
                          <Users size={13} aria-hidden /> Seat guests
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={(e) => {
                            e.stopPropagation();
                            void runAction(t.id, () => updateTable(t.id, tenantId, { status: 'reserved' }));
                          }}
                          className="h-10 rounded-full border border-[#E3E7E0] px-3 text-[12.5px] font-semibold text-[#0F3D3E] hover:border-[#B88E2F] disabled:opacity-50"
                        >
                          Reserve
                        </button>
                      </>
                    )}
                    {t.status === 'reserved' && (
                      <>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={(e) => {
                            e.stopPropagation();
                            void runAction(t.id, () => updateTable(t.id, tenantId, { status: 'occupied' }));
                          }}
                          className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-full px-3 text-[12.5px] font-semibold text-white disabled:opacity-50"
                          style={{ background: '#0F3D3E' }}
                        >
                          <Users size={13} aria-hidden /> Seat guests
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={(e) => {
                            e.stopPropagation();
                            void runAction(t.id, () => updateTable(t.id, tenantId, { status: 'available' }));
                          }}
                          className="h-10 rounded-full border border-[#E3E7E0] px-3 text-[12.5px] font-semibold text-[#6B6B6B] hover:bg-[#F6F5F2] disabled:opacity-50"
                        >
                          Clear
                        </button>
                      </>
                    )}
                    {t.status === 'occupied' && (
                      <>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={(e) => {
                            e.stopPropagation();
                            void runAction(t.id, () => updateTable(t.id, tenantId, { status: 'billing' }));
                          }}
                          className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-full px-3 text-[12.5px] font-semibold text-white disabled:opacity-50"
                          style={{ background: '#B88E2F' }}
                        >
                          <BadgeCheck size={13} aria-hidden /> Ask for the bill
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (armed) void runAction(t.id, () => updateTable(t.id, tenantId, { status: 'available', active_order_id: null }));
                            else armConfirm(t.id);
                          }}
                          aria-label={armed ? `Confirm free table ${t.table_number}` : `Free table ${t.table_number}`}
                          className={`h-10 rounded-full px-3 text-[12.5px] font-bold ${armed ? 'bg-[#B4483C] text-white' : 'border border-[#E3E7E0] text-[#B4483C] hover:bg-[#F6E8E6]'}`}
                        >
                          {armed ? 'Confirm free?' : 'Free'}
                        </button>
                      </>
                    )}
                    {t.status === 'billing' && (
                      <>
                        <p className="flex h-10 flex-1 items-center gap-1.5 rounded-full bg-[#FDECEA] px-3 text-[12px] font-semibold text-[#B4483C]">
                          Settle at the counter, then free the table.
                        </p>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (armed) void runAction(t.id, () => updateTable(t.id, tenantId, { status: 'available', active_order_id: null }));
                            else armConfirm(t.id);
                          }}
                          aria-label={armed ? `Confirm free table ${t.table_number}` : `Free table ${t.table_number}`}
                          className={`h-10 rounded-full px-3 text-[12.5px] font-bold ${armed ? 'bg-[#B4483C] text-white' : 'border border-[#E3E7E0] text-[#B4483C] hover:bg-[#F6E8E6]'}`}
                        >
                          {armed ? 'Confirm free?' : 'Free'}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}

      {addOpen && (
        <AddTableDialog
          busy={busyId === 'creating'}
          error={actionError}
          onClose={() => {
            setAddOpen(false);
            setActionError(null);
          }}
          onAdd={(number, capacity, section) => {
            if (busyId === 'creating') return; // double-dispatch guard
            setBusyId('creating');
            setActionError(null);
            createTable(tenantId, { tableNumber: number, capacity, section })
              .then(() => {
                setAddOpen(false);
                return reload();
              })
              .catch((err) => {
                setActionError(err instanceof Error ? err.message : 'Could not add the table.');
              })
              .finally(() => setBusyId(null));
          }}
        />
      )}

      {editTable && (
        <AddTableDialog
          busy={busyId === 'editing'}
          error={actionError}
          initial={{
            number: editTable.table_number,
            capacity: editTable.capacity,
            section: editTable.section || 'Main Floor',
          }}
          onClose={() => {
            setEditTable(null);
            setActionError(null);
          }}
          onAdd={(number, capacity, section) => {
            if (busyId === 'editing') return; // double-dispatch guard
            /* duplicate check mirrors the 001 digit-matcher: same text, or
               same digits under a different dressing ("T3" vs "Patio-3"). */
            const norm = (s: string) => s.trim().toLowerCase();
            const digits = (s: string) => s.replace(/[^0-9]/g, '');
            const clash = (tables ?? []).find(
              (t) =>
                t.id !== editTable.id &&
                (norm(t.table_number) === norm(number) ||
                  (digits(number) !== '' && digits(t.table_number) === digits(number))),
            );
            if (clash) {
              setActionError(`Another table is already called ${clash.table_number}.`);
              return;
            }
            setBusyId('editing');
            setActionError(null);
            updateTable(editTable.id, tenantId, {
              table_number: number,
              capacity,
              section,
            })
              .then(() => {
                setEditTable(null);
                return reload();
              })
              .catch((err) => {
                setActionError(err instanceof Error ? err.message : 'Could not update the table.');
              })
              .finally(() => setBusyId(null));
          }}
        />
      )}

      {bookOpen && (
        <BookingDialog
          tables={tables ?? []}
          busy={busyId === 'booking'}
          error={actionError}
          onClose={() => {
            setBookOpen(false);
            setActionError(null);
          }}
          onTake={(input) => {
            if (busyId === 'booking') return; // double-dispatch guard
            setBusyId('booking');
            setActionError(null);
            createReservation(tenantId, input)
              .then(() => {
                setBookOpen(false);
                return reload();
              })
              .catch((err) => {
                setActionError(err instanceof Error ? err.message : 'Could not write the booking.');
              })
              .finally(() => setBusyId(null));
          }}
        />
      )}

      {drillTable && (
        <TableDrill
          table={drillTable}
          order={drillOrder}
          sessions={sessionsByTable.get(drillTable.id) ?? []}
          cutArmId={cutArmId}
          cutBusyId={cutBusyId}
          onCutArm={armCut}
          onCut={(id) => void cutSession(id)}
          bulkCutBusy={bulkCutBusy === drillTable.id}
          onCutAll={(ids) => void cutAllSessions(drillTable.id, ids)}
          onEdit={() => {
            setActionError(null);
            setEditTable(drillTable);
          }}
          onRemove={() => {
            if (removeBusy) return; // double-dispatch guard
            setRemoveBusy(true);
            setActionError(null);
            deleteTable(drillTable.id, tenantId)
              .then(() => {
                setDrillId(null);
                return reload();
              })
              .catch((err) => {
                setActionError(err instanceof Error ? err.message : 'Could not remove the table.');
              })
              .finally(() => setRemoveBusy(false));
          }}
          removeBusy={removeBusy}
          onClose={() => setDrillId(null)}
        />
      )}
    </div>
  );
}
