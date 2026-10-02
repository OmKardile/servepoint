import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Armchair,
  BadgeCheck,
  CircleAlert,
  Copy,
  Link2,
  Loader2,
  Plus,
  QrCode,
  RefreshCw,
  Users,
  X,
} from 'lucide-react';
import {
  createTable,
  fetchOrders,
  fetchTables,
  subscribeTablesRealtime,
  updateTable,
  type DiningTable,
  type RealtimeState,
  type TableStatus,
} from '../../lib/api';
import { useTenant } from '../../lib/tenant';
import { formatMoney } from '../../lib/prefs';
import type { Order } from '../../types';

/**
 * Floor (v5.3.0) — the live table board. dining_tables stream over realtime
 * (migration 011); orders hold/release tables automatically through the
 * trg_orders_sync_table trigger, so this board mirrors reality without anyone
 * having to remember to update it. Every card carries the table's permanent
 * QR token — copy the guest link, print the sticker, the customer flow starts
 * there.
 */

const STATUS_META: Record<TableStatus, { label: string; bg: string; fg: string; dot: string }> = {
  available: { label: 'Available', bg: '#EAF4EC', fg: '#2E7D32', dot: '#2E7D32' },
  occupied: { label: 'Occupied', bg: '#FDF3E4', fg: '#8A5A16', dot: '#C2571B' },
  reserved: { label: 'Reserved', bg: '#F1F4F1', fg: '#0F3D3E', dot: '#0F3D3E' },
  billing: { label: 'Billing', bg: '#FDECEA', fg: '#B4483C', dot: '#B4483C' },
};

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

function AddTableDialog({
  busy,
  error,
  onAdd,
  onClose,
}: {
  busy: boolean;
  error: string | null;
  onAdd: (number: string, capacity: number, section: string) => void;
  onClose: () => void;
}) {
  const [number, setNumber] = useState('');
  const [capacity, setCapacity] = useState('4');
  const [section, setSection] = useState('Main Floor');
  const capNum = Number.parseInt(capacity, 10);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Add table">
      <button type="button" aria-label="Close dialog" onClick={onClose} className="absolute inset-0 h-full w-full cursor-default bg-[#0F3D3E]/45" />
      <div className="absolute inset-x-2 top-1/2 mx-auto max-w-[420px] -translate-y-1/2 rounded-3xl bg-white p-5 shadow-2xl sm:inset-x-0">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[15px] font-bold text-[#1A1A1A]">Add a table</h2>
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
              Add table
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function FloorScreen(): React.ReactElement {
  const { tenant, tenantId, error: tenantError, loading } = useTenant();
  const [tables, setTables] = useState<DiningTable[] | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [rtState, setRtState] = useState<RealtimeState>('connecting');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
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
  }, [tenantId]);

  useEffect(() => {
    if (!tenantId) return;
    void reload();
  }, [tenantId, reload]);

  // realtime (migration 011) + 30s safety poll
  useEffect(() => {
    if (!tenantId) return;
    const ping = () => {
      if (pingRef.current) window.clearTimeout(pingRef.current);
      pingRef.current = window.setTimeout(() => void reload(), 250);
    };
    const unsub = subscribeTablesRealtime(tenantId, ping, setRtState);
    const poll = window.setInterval(() => void reload(), 30000);
    return () => {
      window.clearInterval(poll);
      if (pingRef.current) window.clearTimeout(pingRef.current);
      unsub();
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

  const copyLink = useCallback(async (t: DiningTable) => {
    const url = `${window.location.origin}/t/${t.qr_token}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(t.id);
      window.setTimeout(() => setCopiedId((c) => (c === t.id ? null : c)), 2000);
    } catch {
      setActionError('Copy failed — long-press the link text instead.');
    }
  }, []);

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
      const key = t.section || 'Main Floor';
      const list = map.get(key) || [];
      list.push(t);
      map.set(key, list);
    });
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [tables]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-4 lg:p-5">
        <Loader2 size={26} className="animate-spin text-[#6B6B6B]" aria-hidden />
      </div>
    );
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

      {/* stat strip */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {(['available', 'occupied', 'reserved', 'billing'] as TableStatus[]).map((s) => (
          <div key={s} className="rounded-2xl border border-[#E3E7E0] bg-white px-4 py-3 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: STATUS_META[s].dot }} aria-hidden />
              <span className="text-[11.5px] font-semibold uppercase tracking-wide text-[#6B6B6B]">{STATUS_META[s].label}</span>
            </div>
            <p className="mt-1 text-[22px] font-bold tabular-nums text-[#1A1A1A]">{stats[s]}</p>
          </div>
        ))}
      </div>

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
              return (
                <div key={t.id} className="flex flex-col gap-3 rounded-3xl border border-[#E3E7E0] bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="flex items-center gap-2 text-[19px] font-bold leading-none text-[#1A1A1A]">
                        <Armchair size={17} style={{ color: meta.dot }} aria-hidden />
                        {t.table_number}
                      </p>
                      <p className="mt-1.5 flex items-center gap-1.5 text-[12px] text-[#6B6B6B]">
                        <Users size={12} aria-hidden /> {t.capacity} seats
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
                      onClick={() => void copyLink(t)}
                      className="flex h-9 shrink-0 items-center gap-1 rounded-full px-2.5 text-[11px] font-bold text-[#0F3D3E] hover:bg-[#F1F4F1]"
                      aria-label={`Copy guest link for table ${t.table_number}`}
                    >
                      {copiedId === t.id ? <BadgeCheck size={13} className="text-[#2E7D32]" aria-hidden /> : <Link2 size={13} aria-hidden />}
                      {copiedId === t.id ? 'Copied' : 'Link'}
                    </button>
                    <button
                      type="button"
                      onClick={() => void navigator.clipboard?.writeText(t.qr_token)}
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
                          onClick={() => void runAction(t.id, () => updateTable(t.id, tenantId, { status: 'occupied' }))}
                          className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-full px-3 text-[12.5px] font-semibold text-white disabled:opacity-50"
                          style={{ background: '#0F3D3E' }}
                        >
                          <Users size={13} aria-hidden /> Seat guests
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void runAction(t.id, () => updateTable(t.id, tenantId, { status: 'reserved' }))}
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
                          onClick={() => void runAction(t.id, () => updateTable(t.id, tenantId, { status: 'occupied' }))}
                          className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-full px-3 text-[12.5px] font-semibold text-white disabled:opacity-50"
                          style={{ background: '#0F3D3E' }}
                        >
                          <Users size={13} aria-hidden /> Seat guests
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void runAction(t.id, () => updateTable(t.id, tenantId, { status: 'available' }))}
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
                          onClick={() => void runAction(t.id, () => updateTable(t.id, tenantId, { status: 'billing' }))}
                          className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-full px-3 text-[12.5px] font-semibold text-white disabled:opacity-50"
                          style={{ background: '#B88E2F' }}
                        >
                          <BadgeCheck size={13} aria-hidden /> Ask for the bill
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => {
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
                          onClick={() => {
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
    </div>
  );
}
