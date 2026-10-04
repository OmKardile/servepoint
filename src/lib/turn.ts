/* ── turn.ts — the seat-span lib (v5.182.0) ─────────────────────────────
   The floor's camping clock (5.158.0) answers "how long has THIS table
   been sitting?"; the turn census (5.181.0) answers "how long did the
   week's seats hold?"; Reports' table turnover (5.161.0) answers "how
   does the room breathe?". Three surfaces, ONE question about finished
   seats — and by 5.181 they had TWO finish lines (Reports read the
   status ledger's completed hop, the kitchen's own close, while the
   census read the payments ledger's settle) and TWO duration registers
   ("0m" vs "<1m"). The live app said AVG SPAN 1h 18m in Reports and
   "<1m median" on the floor for the same room, the same week. This lib
   is the reconciliation:

   · ONE finish line — the payments ledger's LAST settle for a ticket
     (a split frees the table when its final part lands). The status
     hop stays where it is honest: the kitchen stopwatch's own ledger
     (fire → ready), never the seat's end.
   · ONE duration register — seatSpanLabel, "<1m · 45m · 1h 5m". A
     finished sub-minute hold lasted under a minute; "just sat" stays
     the LIVE clock's state word (FloorScreen's seatLabelFor wraps this
     register, byte-identical at every real duration).
   · ONE noise rule — a settle at or before the ticket's creation is
     ledger noise, skipped by every consumer (never a fake 0-minute
     seat; the clock never winds backwards).
   · ONE silence rule — a ticket with no settle (unpaid, or the ledger
     unread) is COUNTED but never MEASURED; a cancelled ticket never
     happened; a ticket with no table never held one. */

/** The floor's DURATION register — minutes to words ("<1m" · "45m" ·
 *  "1h 5m"). The census's median and Reports' spans read this: a finished
 *  seat that held under a minute lasted "<1m", never "just sat" — that
 *  word belongs to the LIVE clock (a seat that just sat is a state, not
 *  a span). Every real duration (≥1m) is byte-identical across both. */
export function seatSpanLabel(minutes: number): string {
  const m = Math.max(0, Math.floor(minutes));
  const h = Math.floor(m / 60);
  return m < 1 ? '<1m' : h > 0 ? `${h}h ${m % 60}m` : `${m}m`;
}

/** The settle map from payments-ledger rows already in hand: orderId →
 *  the ticket's LAST settle instant (newest wins, whatever order the
 *  rows arrive in — a split frees the table when its final part lands).
 *  The floor's fetchPaymentMoments applies the same rule SQL-side; this
 *  twin exists so a surface holding the rows reads them without a
 *  second trip to the cloud. Unreadable instants never enter the map. */
export function buildSettleMap(
  rows: { orderId: string; paidAt: string }[],
): Map<string, string> {
  const out = new Map<string, string>();
  for (const r of rows) {
    if (!r.orderId) continue;
    const t = new Date(r.paidAt).getTime();
    if (!Number.isFinite(t)) continue;
    const prev = out.get(r.orderId);
    if (prev === undefined || t > new Date(prev).getTime()) out.set(r.orderId, r.paidAt);
  }
  return out;
}

/** The ONE median rule for seat spans — odd count takes the middle, even
 *  count rounds the mean of the two middles (the standard definition; the
 *  census and Reports' turnover both read this — until 5.182 the turnover
 *  used a lower-element median and could disagree with the census on the
 *  same spans). Integer minutes: spans speak in whole minutes or not at
 *  all. */
export function medianMinOf(minutes: number[]): number {
  if (minutes.length === 0) return 0;
  const s = [...minutes].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

export interface TableTurnStats {
  label: string | null;
  rounds: number;
  spans: number;
  medianMin: number;
  breaches: number;
  /** v5.183.0 — this table's longest MEASURED span in minutes (breach or
   *  not); 0 when nothing settled here. The named breach list sorts on it. */
  worstMin: number;
}

export interface TurnCensus {
  rounds: number;
  spans: number;
  medianMin: number;
  breaches: number;
  /** v5.183.0 — the floor's longest measured span this window; 0 when
   *  nothing settled. One number, the same register as the median. */
  worstMin: number;
  byTable: Map<string, TableTurnStats>;
}

export interface NamedBreach {
  id: string;
  label: string | null;
  breaches: number;
  worstMin: number;
}

/** The week's named breach list (v5.183.0) — the tables whose SETTLED
 *  seats crossed the house turn line, each carrying its breach count and
 *  its worst held span. ONE sort rule: worst span first, table label as
 *  the stable tiebreak; an empty census yields an empty list — silence,
 *  never invented names. */
export function namedBreachList(census: TurnCensus): NamedBreach[] {
  const out: NamedBreach[] = [];
  for (const [id, s] of census.byTable) {
    if (s.breaches > 0) out.push({ id, label: s.label, breaches: s.breaches, worstMin: s.worstMin });
  }
  return out.sort(
    (a, b) => b.worstMin - a.worstMin || (a.label ?? '').localeCompare(b.label ?? ''),
  );
}

/** The week's turn census: per finished seat, created → last settle, in
 *  minutes; median, worst held span and breach count per table and across
 *  the floor. An
 *  empty/null settle map is HONEST silence (spans 0) — the caller decides
 *  whether the UI speaks. `orders` may carry any population; the census
 *  keeps only what the rhythm's own rules admit (table-bound, not
 *  cancelled, inside [startMs, endMs)). A settle at or before the
 *  ticket's creation is noise — skipped, never a fake 0-minute seat. */
export function computeTurnCensus(
  orders: {
    id: string;
    table_id?: string | null;
    table_label?: string | null;
    status?: string | null;
    created_at: string;
  }[],
  settleByOrder: Map<string, string> | null,
  turnAfterMin: number,
  startMs: number,
  endMs: number,
): TurnCensus {
  const census: TurnCensus = {
    rounds: 0,
    spans: 0,
    medianMin: 0,
    breaches: 0,
    worstMin: 0,
    byTable: new Map(),
  };
  const spans: number[] = [];
  const tableSpans = new Map<string, number[]>();
  for (const o of orders) {
    if (o.table_id == null || o.status === 'cancelled') continue;
    const t = new Date(o.created_at).getTime();
    if (!Number.isFinite(t) || t < startMs || t >= endMs) continue;
    census.rounds += 1;
    const stat =
      census.byTable.get(o.table_id) ??
      ({ label: o.table_label ?? null, rounds: 0, spans: 0, medianMin: 0, breaches: 0, worstMin: 0 } as TableTurnStats);
    stat.rounds += 1;
    const settleIso = settleByOrder?.get(o.id);
    const settleMs = settleIso ? new Date(settleIso).getTime() : NaN;
    if (Number.isFinite(settleMs) && settleMs > t) {
      const minutes = Math.floor((settleMs - t) / 60000);
      spans.push(minutes);
      const arr = tableSpans.get(o.table_id) ?? [];
      arr.push(minutes);
      tableSpans.set(o.table_id, arr);
      if (minutes >= turnAfterMin) {
        census.breaches += 1;
        stat.breaches += 1;
      }
      if (minutes > census.worstMin) census.worstMin = minutes;
      if (minutes > stat.worstMin) stat.worstMin = minutes;
      census.spans += 1;
      stat.spans += 1;
    }
    census.byTable.set(o.table_id, stat);
  }
  census.medianMin = medianMinOf(spans);
  for (const [id, stat] of census.byTable) {
    stat.medianMin = medianMinOf(tableSpans.get(id) ?? []);
  }
  return census;
}
