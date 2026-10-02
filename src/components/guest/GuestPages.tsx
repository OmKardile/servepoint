import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Check,
  ChefHat,
  CircleAlert,
  Clock,
  Copy,
  Minus,
  Plus,
  QrCode,
  ReceiptText,
  RefreshCw,
  Search,
  ShoppingBag,
  UtensilsCrossed,
  Volume2,
  VolumeX,
  Wallet,
  X,
} from 'lucide-react';
import {
  createPublicOrder,
  fetchPublicMenu,
  fetchPublicOffers,
  fetchPublicOrder,
  openTableSession,
  resolveTableQr,
  type GuestAddon,
  type GuestMenuItem,
  type GuestOrderSummary,
  type GuestVariant,
  type PublicMenu,
  type PublicOffer,
  type TableSession,
} from '../../lib/guest';

/**
 * Guest QR surfaces (v5.3.0) — the customer side of the main flow.
 *
 *   /t/:qr_token    gate: validate the printed QR → open the 10-min session → /menu/:token
 *   /menu/:qr_token menu → inline customizer (variants + add-ons + notes) → cart → order
 *   /track/:orderId the pager: 10s-polled status, chime on ready, bill to pay at counter
 *
 * No login anywhere — capabilities only (qr_token, session token, order UUID).
 * Guests never pay online: the bill says what to pay at the counter.
 */

const brand = {
  teal: '#0F3D3E',
  gold: '#B88E2F',
  cream: '#F6F5F2',
};

const round2 = (n: number) => Math.round(n * 100) / 100;
const money = (n: number) => `₹${round2(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function twoToneChime(): void {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    [880, 1174.66].forEach((f, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = f;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.01 + i * 0.18);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5 + i * 0.18);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.18);
      osc.stop(ctx.currentTime + 0.6 + i * 0.18);
    });
    if (navigator.vibrate) navigator.vibrate([80, 60, 80]);
  } catch {
    /* silent — sound is a nicety */
  }
}

function GuestFooter(): React.ReactElement {
  return (
    <footer className="mt-auto border-t border-[#E3E7E0] bg-white">
      <div className="mx-auto flex max-w-xl items-center justify-between px-4 py-3 text-[11px] text-[#6B6B6B]">
        <span className="font-semibold uppercase tracking-[0.14em]" style={{ color: brand.teal }}>
          ServePoint
        </span>
        <span>Powered by ServePoint — smartPOS</span>
      </div>
    </footer>
  );
}

function GuestErrorCard({ title, body, onRetry }: { title: string; body: string; onRetry?: () => void }): React.ReactElement {
  return (
    <div className="mx-auto mt-10 max-w-md px-4">
      <div className="rounded-3xl border border-[#E3E7E0] bg-white p-6 text-center shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#FDF3F2]">
          <CircleAlert size={26} className="text-[#B4483C]" aria-hidden />
        </div>
        <h1 className="mt-4 font-serif text-[24px] italic text-[#0F3D3E]">{title}</h1>
        <p className="mt-2 text-[13.5px] leading-relaxed text-[#6B6B6B]">{body}</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-5 inline-flex h-11 items-center gap-2 rounded-full px-5 text-[13.5px] font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: brand.teal }}
          >
            <RefreshCw size={15} aria-hidden /> Try again
          </button>
        )}
      </div>
    </div>
  );
}

/* ════════════════════════════ 1 · GATE ════════════════════════════ */

export function GuestGatePage({ qrToken }: { qrToken: string }): React.ReactElement {
  const [state, setState] = useState<'working' | 'invalid' | 'session'>('working');
  const [detail, setDetail] = useState('Checking this table…');

  const run = useCallback(async () => {
    setState('working');
    setDetail('Checking this table…');
    if (!qrToken) {
      setState('invalid');
      setDetail('This link is missing its table code. Scan the QR sticker on your table.');
      return;
    }
    const resolved = await resolveTableQr(qrToken);
    if (!resolved.is_valid || !resolved.tenant || !resolved.table) {
      setState('invalid');
      setDetail(resolved.message || 'This table code is not valid. Scan the QR sticker on your table.');
      return;
    }
    setDetail(`Opening your session at ${resolved.tenant.name}…`);
    const opened = await openTableSession({
      slug: resolved.tenant.slug,
      tableNumber: resolved.table.table_number,
      qrToken,
    });
    if (!opened.ok || !opened.session) {
      setState('session');
      setDetail(opened.message || 'This table could not be opened right now. Ask our staff for help.');
      return;
    }
    window.location.assign(`/menu/${encodeURIComponent(qrToken)}`);
  }, [qrToken]);

  useEffect(() => {
    void run();
  }, [run]);

  return (
    <div className="flex min-h-screen flex-col bg-[#F6F5F2]">
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-10">
        {state === 'working' && (
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex h-16 w-16 animate-pulse items-center justify-center rounded-2xl text-white" style={{ background: brand.teal }}>
              <QrCode size={30} aria-hidden />
            </div>
            <p className="text-[14px] font-medium text-[#1A1A1A]">{detail}</p>
            <p className="text-[12px] text-[#6B6B6B]">ServePoint table service</p>
          </div>
        )}
        {state === 'invalid' && <GuestErrorCard title="This link didn't work" body={detail} />}
        {state === 'session' && <GuestErrorCard title="Table didn't open" body={detail} onRetry={() => void run()} />}
      </main>
      <GuestFooter />
    </div>
  );
}

/* ════════════════════════════ 2 · MENU ════════════════════════════ */

interface CartLine {
  key: string;
  item: GuestMenuItem;
  variant: GuestVariant | null;
  addons: GuestAddon[];
  qty: number;
  notes: string;
}

const lineKey = (itemId: string, variantId: string | null, addonIds: string[], notes: string) =>
  `${itemId}::${variantId || 'base'}::${[...addonIds].sort().join('|')}::${notes.trim().toLowerCase()}`;

const lineUnit = (l: CartLine) =>
  round2(l.item.price + (l.variant?.price_delta || 0) + l.addons.reduce((s, a) => s + a.price, 0));

const CART_KEY = (token: string) => `sp.guest.cart.${token}`;

/** Session countdown ribbon — the ONLY 1s-ticking component on the page. */
function SessionRibbon({ session }: { session: TableSession }): React.ReactElement {
  const [msLeft, setMsLeft] = useState(() => new Date(session.expires_at).getTime() - Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setMsLeft(new Date(session.expires_at).getTime() - Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [session.expires_at]);
  const totalSec = Math.max(0, Math.floor(msLeft / 1000));
  const mm = String(Math.floor(totalSec / 60));
  const ss = String(totalSec % 60).padStart(2, '0');
  const warm = totalSec < 180;
  return (
    <div
      className="flex items-center justify-center gap-2 px-4 py-2 text-[12.5px] font-semibold"
      style={{ background: warm ? '#FBF3E4' : brand.teal, color: warm ? '#8A5A16' : '#FFFFFF' }}
      role="status"
      aria-label={`Ordering session ends in ${mm}:${ss}`}
    >
      <Clock size={14} aria-hidden />
      <span>{warm ? 'Session ending soon — ' : 'Ordering window — '}</span>
      <span className="font-mono tabular-nums">
        {mm}:{ss}
      </span>
      <span className="hidden sm:inline">· rescan the table QR to renew</span>
    </div>
  );
}

function Customizer({ item, onAdd }: { item: GuestMenuItem; onAdd: (l: Omit<CartLine, 'key'>) => void }): React.ReactElement {
  const [variantId, setVariantId] = useState<string | null>(null);
  const [addonIds, setAddonIds] = useState<string[]>([]);
  const [qty, setQty] = useState(1);
  const [notes, setNotes] = useState('');

  const variant = item.variants.find((v) => v.id === variantId) || null;
  const addons = item.addons.filter((a) => addonIds.includes(a.id));
  const unit = round2(item.price + (variant?.price_delta || 0) + addons.reduce((s, a) => s + a.price, 0));

  return (
    <div className="mt-3 rounded-2xl border border-[#E3E7E0] bg-[#FBFBF9] p-3">
      {item.variants.length > 0 && (
        <fieldset className="mb-3">
          <legend className="mb-1.5 text-[11.5px] font-semibold uppercase tracking-wide text-[#6B6B6B]">Choose one</legend>
          <div className="flex flex-wrap gap-1.5">
            {item.variants.map((v) => {
              const active = variantId === v.id;
              return (
                <button
                  key={v.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setVariantId(active ? null : v.id)}
                  className={`flex h-11 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B88E2F] ${
                    active ? 'border-transparent text-white' : 'border-[#E3E7E0] bg-white text-[#1A1A1A] hover:border-[#B88E2F]'
                  }`}
                  style={active ? { background: brand.teal } : undefined}
                >
                  {v.name}
                  {v.price_delta !== 0 && (
                    <span className={active ? 'text-[#E7C878]' : 'text-[#B88E2F]'}>
                      {v.price_delta > 0 ? `+₹${round2(v.price_delta)}` : `−₹${round2(-v.price_delta)}`}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      {item.addons.length > 0 && (
        <fieldset className="mb-3">
          <legend className="mb-1.5 text-[11.5px] font-semibold uppercase tracking-wide text-[#6B6B6B]">Add-ons</legend>
          <div className="flex flex-wrap gap-1.5">
            {item.addons.map((a) => {
              const active = addonIds.includes(a.id);
              return (
                <button
                  key={a.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setAddonIds((ids) => (active ? ids.filter((x) => x !== a.id) : [...ids, a.id]))}
                  className={`flex h-11 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B88E2F] ${
                    active ? 'border-transparent text-white' : 'border-[#E3E7E0] bg-white text-[#1A1A1A] hover:border-[#B88E2F]'
                  }`}
                  style={active ? { background: brand.teal } : undefined}
                >
                  {active && <Check size={13} aria-hidden />}
                  {a.name}
                  <span className={active ? 'text-[#E7C878]' : 'text-[#B88E2F]'}>+₹{round2(a.price)}</span>
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      <input
        type="text"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        maxLength={140}
        placeholder="Cook note (e.g. less spicy) — optional"
        aria-label="Cook note"
        className="sp-input h-11 w-full px-3 text-[13.5px]"
      />

      <div className="mt-3 flex items-center gap-3">
        <div className="flex items-center gap-1 rounded-full border border-[#E3E7E0] bg-white p-1">
          <button
            type="button"
            aria-label="Decrease quantity"
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            className="flex h-9 w-9 items-center justify-center rounded-full text-[#6B6B6B] hover:bg-[#F6F5F2] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0F3D3E]"
          >
            <Minus size={15} aria-hidden />
          </button>
          <span className="min-w-6 text-center text-[14px] font-bold tabular-nums" aria-live="polite">
            {qty}
          </span>
          <button
            type="button"
            aria-label="Increase quantity"
            onClick={() => setQty((q) => Math.min(50, q + 1))}
            className="flex h-9 w-9 items-center justify-center rounded-full text-[#6B6B6B] hover:bg-[#F6F5F2] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0F3D3E]"
          >
            <Plus size={15} aria-hidden />
          </button>
        </div>
        <button
          type="button"
          onClick={() => {
            onAdd({ item, variant, addons, qty, notes });
            setQty(1);
            setNotes('');
          }}
          className="flex h-11 flex-1 items-center justify-center gap-2 rounded-full text-[13.5px] font-semibold text-white transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B88E2F]"
          style={{ background: brand.teal }}
        >
          <Plus size={15} aria-hidden /> Add to order · {money(unit * qty)}
        </button>
      </div>
    </div>
  );
}

export function GuestMenuPage({ qrToken }: { qrToken: string }): React.ReactElement {
  const [phase, setPhase] = useState<'loading' | 'ready' | 'locked' | 'error'>('loading');
  const [errorBody, setErrorBody] = useState('');
  const [resolved, setResolved] = useState<{ tenantName: string; slug: string; tableNumber: string; capacity: number } | null>(null);
  const [menu, setMenu] = useState<PublicMenu | null>(null);
  const [sessionToken, setSessionToken] = useState<TableSession | null>(null);
  const [lines, setLines] = useState<CartLine[]>(() => {
    try {
      const raw = sessionStorage.getItem(CART_KEY(qrToken));
      return raw ? (JSON.parse(raw) as CartLine[]) : [];
    } catch {
      return [];
    }
  });
  const [query, setQuery] = useState('');
  const [openItemId, setOpenItemId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [placing, setPlacing] = useState(false);
  const [placeError, setPlaceError] = useState<string | null>(null);
  const [offers, setOffers] = useState<PublicOffer[]>([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const r = await resolveTableQr(qrToken);
      if (!alive) return;
      if (!r.is_valid || !r.tenant || !r.table) {
        setPhase('error');
        setErrorBody(r.message || 'This table code is not valid. Scan the QR sticker on your table.');
        return;
      }
      setResolved({ tenantName: r.tenant.name, slug: r.tenant.slug, tableNumber: r.table.table_number, capacity: r.table.capacity });
      const opened = await openTableSession({ slug: r.tenant.slug, tableNumber: r.table.table_number, qrToken });
      if (!alive) return;
      if (!opened.ok || !opened.session) {
        setPhase('locked');
        setErrorBody(opened.message || 'Your ordering window closed. Scan the table QR again to continue.');
        return;
      }
      setSessionToken(opened.session);
      const m = await fetchPublicMenu(r.tenant.slug);
      if (!alive) return;
      if (!m.is_valid) {
        setPhase('error');
        setErrorBody(m.message || 'The menu could not be loaded.');
        return;
      }
      setMenu(m);
      setPhase('ready');
      document.title = `${r.tenant.name} — order from Table ${r.table.table_number}`;
      // offers banner — best effort, never blocks the menu
      fetchPublicOffers(r.tenant.slug).then((o) => {
        if (alive) setOffers(o);
      });
    })();
    return () => {
      alive = false;
    };
  }, [qrToken]);

  // cart survives refresh (identity only — the server re-prices everything)
  useEffect(() => {
    try {
      sessionStorage.setItem(CART_KEY(qrToken), JSON.stringify(lines));
    } catch {
      /* quota — ignore */
    }
  }, [lines, qrToken]);

  const addLine = useCallback((l: Omit<CartLine, 'key'>) => {
    setLines((prev) => {
      const key = lineKey(l.item.id, l.variant?.id || null, l.addons.map((a) => a.id), l.notes);
      const idx = prev.findIndex((x) => x.key === key);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], qty: Math.min(50, next[idx].qty + l.qty) };
        return next;
      }
      return [...prev, { ...l, key }];
    });
  }, []);

  const filtered = useMemo(() => {
    if (!menu?.categories) return [];
    const q = query.trim().toLowerCase();
    if (!q) return menu.categories;
    return menu.categories
      .map((c) => ({ ...c, items: c.items.filter((i) => `${i.name} ${i.description || ''}`.toLowerCase().includes(q)) }))
      .filter((c) => c.items.length > 0);
  }, [menu, query]);

  const cartCount = lines.reduce((s, l) => s + l.qty, 0);
  const cartSubtotal = round2(lines.reduce((s, l) => s + lineUnit(l) * l.qty, 0));
  const cartTax = round2(cartSubtotal * 0.05);
  const cartTotal = round2(cartSubtotal + cartTax);

  const placeOrder = async () => {
    if (lines.length === 0 || placing) return;
    setPlacing(true);
    setPlaceError(null);
    const res = await createPublicOrder({
      qrToken,
      tableNumber: resolved?.tableNumber,
      items: lines.map((l) => ({
        menu_item_id: l.item.id,
        variant_id: l.variant?.id || null,
        qty: l.qty,
        notes: l.notes || null,
        addon_ids: l.addons.map((a) => a.id),
      })),
      customerName: customerName || null,
      clientOperationId: crypto.randomUUID(),
    });
    if (!res.is_valid || !res.order) {
      setPlaceError(res.message || 'The order did not go through. Please try again.');
      setPlacing(false);
      if (res.error === 'INVALID_TOKEN') {
        sessionStorage.removeItem(CART_KEY(qrToken));
        window.location.assign(`/t/${encodeURIComponent(qrToken)}`);
      }
      return;
    }
    sessionStorage.removeItem(CART_KEY(qrToken));
    window.location.assign(`/track/${res.order.id}`);
  };

  if (phase === 'loading') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#F6F5F2]">
        <div className="h-10 w-10 animate-spin rounded-full border-[#E3E7E0] border-t-[#0F3D3E]" style={{ borderWidth: 3 }} />
        <p className="mt-3 text-[13px] text-[#6B6B6B]">Setting the table…</p>
      </div>
    );
  }
  if (phase === 'error') {
    return (
      <div className="flex min-h-screen flex-col bg-[#F6F5F2]">
        <main className="flex-1">
          <GuestErrorCard title="Menu unavailable" body={errorBody} />
        </main>
        <GuestFooter />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#F6F5F2]">
      {sessionToken && <SessionRibbon session={sessionToken} />}

      {/* brand hero */}
      <header className="px-4 pb-4 pt-6" style={{ background: `linear-gradient(160deg, ${brand.teal} 0%, #14514f 100%)` }}>
        <div className="mx-auto flex max-w-xl items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#E7C878]">Tableside menu</p>
            <h1 className="mt-1 font-serif text-[30px] italic leading-tight text-white">{resolved?.tenantName}</h1>
            <p className="mt-1.5 flex items-center gap-1.5 text-[12.5px] text-white/75">
              <UtensilsCrossed size={13} aria-hidden />
              Table {resolved?.tableNumber} · {resolved?.capacity} seats — scan to order, pay at the counter
            </p>
          </div>
          <button
            type="button"
            onClick={() => window.location.assign(`/t/${encodeURIComponent(qrToken)}`)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
            aria-label="Back to table check-in"
          >
            <ArrowLeft size={18} aria-hidden />
          </button>
        </div>

        <div className="relative mx-auto mt-4 max-w-xl">
          <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6B6B6B]" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search the menu…"
            aria-label="Search the menu"
            className="h-12 w-full rounded-full border border-white/15 bg-white pl-10 pr-4 text-[14px] text-[#1A1A1A] shadow-sm placeholder:text-[#9A9A9A] focus:outline focus:outline-2 focus:outline-[#B88E2F]"
          />
        </div>
      </header>

      <main className="mx-auto w-full max-w-xl flex-1 px-4 pb-36 pt-4">
        {/* today's offers — read-only, active only, straight from the owner's CRM */}
        {phase === 'ready' && offers.length > 0 && (
          <section aria-label="Today's offers" className="mb-4">
            <div className="flex gap-2.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {offers.map((o) => (
                <div
                  key={o.id}
                  className="flex min-w-[240px] max-w-[300px] flex-1 items-center gap-3 rounded-2xl border border-[#EED9B8] bg-gradient-to-br from-[#FBF3E4] to-[#F6EAD8] px-3.5 py-3 shadow-sm"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#B88E2F] text-[11px] font-bold leading-none text-white">
                    {o.discount_type === 'percent' ? `${Number(o.discount_value)}%` : '₹' + (Number(o.discount_value) % 1 === 0 ? Number(o.discount_value) : Number(o.discount_value).toFixed(0))}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[12.5px] font-bold text-[#5B4300]">{o.title}</p>
                    <p className="truncate text-[11px] text-[#8A5A00]">
                      {o.discount_type === 'percent' ? `${Number(o.discount_value)}% off` : `₹${Number(o.discount_value)} off`}
                      {Number(o.min_order_amount) > 0 && ` · min ₹${Number(o.min_order_amount)}`}
                      {o.description ? ` — ${o.description}` : ''}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {phase === 'locked' && (
          <div className="rounded-3xl border border-[#E3E7E0] bg-white p-6 text-center shadow-sm">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#FBF3E4]">
              <Clock size={24} className="text-[#8A5A16]" aria-hidden />
            </div>
            <h2 className="mt-3 font-serif text-[22px] italic text-[#0F3D3E]">Ordering paused</h2>
            <p className="mt-2 text-[13.5px] text-[#6B6B6B]">{errorBody}</p>
            <button
              type="button"
              onClick={() => window.location.assign(`/t/${encodeURIComponent(qrToken)}`)}
              className="mt-5 inline-flex h-11 items-center gap-2 rounded-full px-5 text-[13.5px] font-semibold text-white"
              style={{ background: brand.teal }}
            >
              <QrCode size={15} aria-hidden /> Re-open my session
            </button>
          </div>
        )}

        {phase === 'ready' && filtered.length === 0 && <p className="mt-10 text-center text-[13.5px] text-[#6B6B6B]">Nothing matches “{query}”.</p>}

        {filtered.map((cat) => (
          <section key={cat.id} className="mt-5" aria-label={cat.name}>
            <h2 className="mb-2 font-serif text-[21px] italic text-[#0F3D3E]">{cat.name}</h2>
            <div className="overflow-hidden rounded-3xl border border-[#E3E7E0] bg-white shadow-sm">
              {cat.items.map((item, i) => {
                const open = openItemId === item.id;
                return (
                  <div key={item.id} className={i > 0 ? 'border-t border-[#F0F2EE]' : ''}>
                    <button
                      type="button"
                      aria-expanded={open}
                      onClick={() => setOpenItemId(open ? null : item.id)}
                      className="flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-[#FBFBF9] focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-[#B88E2F]"
                    >
                      <span
                        className="mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border"
                        title={item.is_veg ? 'Vegetarian' : 'Non-vegetarian'}
                        style={{ borderColor: item.is_veg ? '#2E7D32' : '#B4483C' }}
                      >
                        <span className="h-2 w-2 rounded-full" style={{ background: item.is_veg ? '#2E7D32' : '#B4483C' }} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-3">
                          <span className="truncate text-[14.5px] font-semibold text-[#1A1A1A]">{item.name}</span>
                          <span className="shrink-0 text-[14px] font-bold" style={{ color: brand.gold }}>
                            {money(item.price)}
                          </span>
                        </span>
                        {item.description && <span className="mt-0.5 block truncate text-[12.5px] text-[#6B6B6B]">{item.description}</span>}
                        <span className="mt-1 flex flex-wrap gap-1">
                          {item.variants.length > 0 && (
                            <span className="rounded-full bg-[#F1F4F1] px-2 py-0.5 text-[10.5px] font-medium text-[#0F3D3E]">
                              {item.variants.length} option{item.variants.length > 1 ? 's' : ''}
                            </span>
                          )}
                          {item.addons.length > 0 && (
                            <span className="rounded-full bg-[#FDF9F0] px-2 py-0.5 text-[10.5px] font-medium text-[#8A5A16]">
                              {item.addons.length} add-on{item.addons.length > 1 ? 's' : ''}
                            </span>
                          )}
                        </span>
                      </span>
                    </button>
                    {open && (
                      <div className="px-4 pb-4">
                        <Customizer item={item} onAdd={addLine} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </main>

      {/* floating cart bar */}
      {cartCount > 0 && !drawerOpen && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#E3E7E0] bg-white/95 p-3 backdrop-blur">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="mx-auto flex w-full max-w-xl items-center justify-between rounded-full px-5 text-white shadow-lg transition-opacity hover:opacity-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B88E2F]"
            style={{ background: brand.teal, height: 52 }}
          >
            <span className="flex items-center gap-2 text-[13.5px] font-semibold">
              <ShoppingBag size={16} aria-hidden />
              {cartCount} item{cartCount > 1 ? 's' : ''}
            </span>
            <span className="text-[14px] font-bold">View order · {money(cartTotal)}</span>
          </button>
        </div>
      )}

      {/* cart drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Your order">
          <button type="button" aria-label="Close cart" onClick={() => setDrawerOpen(false)} className="absolute inset-0 h-full w-full cursor-default bg-[#0F3D3E]/45" />
          <div className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col rounded-l-[24px] bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#E3E7E0] px-5 py-4">
              <h2 className="text-base font-bold text-[#1A1A1A]">Your order · Table {resolved?.tableNumber}</h2>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="Close"
                className="flex h-11 w-11 items-center justify-center rounded-full text-[#6B6B6B] hover:bg-[#F6F5F2] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#967221]"
              >
                <X size={18} aria-hidden />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              {lines.length === 0 && <p className="mt-10 text-center text-[13.5px] text-[#6B6B6B]">Your order is empty — pick something from the menu.</p>}
              {lines.map((l) => (
                <div key={l.key} className="border-b border-[#F0F2EE] py-3 last:border-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[14px] font-semibold text-[#1A1A1A]">
                        {l.qty} × {l.item.name}
                      </p>
                      {l.variant && <p className="text-[12.5px] text-[#6B6B6B]">{l.variant.name}</p>}
                      {l.addons.length > 0 && <p className="text-[12.5px] text-[#6B6B6B]">+ {l.addons.map((a) => a.name).join(', ')}</p>}
                      {l.notes && <p className="mt-0.5 text-[12px] italic text-[#8A5A16]">↳ {l.notes}</p>}
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-[14px] font-bold text-[#1A1A1A]">{money(lineUnit(l) * l.qty)}</p>
                      <button type="button" onClick={() => setLines((prev) => prev.filter((x) => x.key !== l.key))} className="mt-1 text-[11.5px] font-medium text-[#B4483C] hover:underline">
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {lines.length > 0 && (
                <div className="mt-4">
                  <label htmlFor="g-name" className="mb-1 block text-[12px] font-medium text-[#6B6B6B]">
                    Your name (so we can find you) — optional
                  </label>
                  <input
                    id="g-name"
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    maxLength={60}
                    placeholder="e.g. Aarav"
                    className="sp-input h-11 w-full px-3 text-[13.5px]"
                  />
                </div>
              )}
            </div>

            {lines.length > 0 && (
              <div className="border-t border-[#E3E7E0] px-5 py-4">
                <div className="space-y-1 text-[13px] text-[#6B6B6B]">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span className="tabular-nums">{money(cartSubtotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>GST 5%</span>
                    <span className="tabular-nums">{money(cartTax)}</span>
                  </div>
                  <div className="flex justify-between text-[15px] font-bold text-[#1A1A1A]">
                    <span>Total</span>
                    <span className="tabular-nums">{money(cartTotal)}</span>
                  </div>
                </div>
                {placeError && (
                  <p className="mt-2 rounded-xl bg-[#FDF3F2] px-3 py-2 text-[12.5px] text-[#B4483C]" role="alert">
                    {placeError}
                  </p>
                )}
                <p className="mt-2 flex items-center gap-1.5 text-[11.5px] text-[#6B6B6B]">
                  <Wallet size={13} aria-hidden /> Pay at the counter after your meal — no online payment.
                </p>
                <button
                  type="button"
                  onClick={() => void placeOrder()}
                  disabled={placing}
                  className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-full text-[14px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B88E2F]"
                  style={{ background: brand.teal }}
                >
                  {placing ? 'Sending to the counter…' : `Place order · ${money(cartTotal)}`}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <GuestFooter />
    </div>
  );
}

/* ════════════════════════════ 3 · TRACK ════════════════════════════ */

const FLOW: { key: string; label: string; hint: string }[] = [
  { key: 'new', label: 'Placed', hint: 'The counter has your ticket' },
  { key: 'preparing', label: 'In the kitchen', hint: 'Your food is being made' },
  { key: 'ready', label: 'Ready', hint: 'Heading to your table' },
  { key: 'completed', label: 'Served', hint: 'Enjoy — pay at the counter' },
];

function statusIndex(status: string): number {
  const i = FLOW.findIndex((f) => f.key === status);
  return i < 0 ? 0 : i;
}

export function GuestTrackPage({ orderId }: { orderId: string }): React.ReactElement {
  const uuidLike = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId);
  const [order, setOrder] = useState<GuestOrderSummary | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'bad' | 'net'>('loading');
  const [muted, setMuted] = useState(() => localStorage.getItem('sp.guest.chime') === 'off');
  const prevStatus = useRef<string | null>(null);

  const tick = useCallback(async () => {
    const res = await fetchPublicOrder(orderId);
    if (!res.is_valid) {
      setState(res.error === 'NETWORK' ? 'net' : 'bad');
      return;
    }
    if (res.order) {
      setState('ready');
      setOrder(res.order);
      if (prevStatus.current && prevStatus.current !== 'ready' && res.order.status === 'ready' && !muted) {
        twoToneChime();
      }
      prevStatus.current = res.order.status;
      const labels: Record<string, string> = {
        new: 'Placed',
        pending: 'Placed',
        preparing: 'Preparing',
        ready: 'Ready',
        completed: 'Served',
        cancelled: 'Cancelled',
      };
      document.title = `#${res.order.order_number} · ${labels[res.order.status] || res.order.status} — ServePoint`;
    }
  }, [orderId, muted]);

  useEffect(() => {
    if (!uuidLike) {
      setState('bad');
      return;
    }
    let alive = true;
    const loop = () => {
      if (!alive) return;
      void tick().finally(() => {
        if (alive) window.setTimeout(loop, 10000);
      });
    };
    loop();
    return () => {
      alive = false;
    };
  }, [tick, uuidLike]);

  if (state === 'bad') {
    return (
      <div className="flex min-h-screen flex-col bg-[#F6F5F2]">
        <main className="flex-1">
          <GuestErrorCard title="Order link not valid" body="This tracking link is broken or the order doesn't exist. Keep the link from your order screen." />
        </main>
        <GuestFooter />
      </div>
    );
  }

  const step = order ? statusIndex(order.status) : 0;
  const cancelled = order?.status === 'cancelled';
  const paid = order?.payment_status === 'completed';

  return (
    <div className="flex min-h-screen flex-col bg-[#F6F5F2]">
      <header className="px-4 pb-4 pt-5" style={{ background: `linear-gradient(160deg, ${brand.teal} 0%, #14514f 100%)` }}>
        <div className="mx-auto flex max-w-xl items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#E7C878]">Your ticket</p>
            <h1 className="mt-0.5 font-serif text-[30px] italic text-white">{order ? `#${order.order_number}` : '· · ·'}</h1>
            {order && (
              <p className="mt-1 text-[12.5px] text-white/75">
                {order.table_number ? `Table ${order.table_number}` : order.order_type}
                {order.customer_name ? ` · ${order.customer_name}` : ''}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              const next = !muted;
              setMuted(next);
              localStorage.setItem('sp.guest.chime', next ? 'off' : 'on');
              if (!next) twoToneChime();
            }}
            aria-label={muted ? 'Unmute ready chime' : 'Mute ready chime'}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
          >
            {muted ? <VolumeX size={17} aria-hidden /> : <Volume2 size={17} aria-hidden />}
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-xl flex-1 px-4 pb-10 pt-5">
        {state === 'loading' && <p className="mt-10 text-center text-[13.5px] text-[#6B6B6B]">Finding your ticket…</p>}
        {state === 'net' && !order && <GuestErrorCard title="Connection trouble" body="We couldn't reach the cafe. Retrying automatically…" />}

        {order && cancelled && (
          <div className="rounded-3xl border border-[#E3E7E0] bg-white p-6 text-center shadow-sm">
            <CircleAlert size={26} className="mx-auto text-[#B4483C]" aria-hidden />
            <h2 className="mt-3 font-serif text-[22px] italic text-[#0F3D3E]">This order was cancelled</h2>
            <p className="mt-2 text-[13.5px] text-[#6B6B6B]">Nothing was charged. Speak to our staff if this looks wrong — they can re-take your order.</p>
          </div>
        )}

        {order && !cancelled && (
          <>
            {/* status stepper */}
            <div className="rounded-3xl border border-[#E3E7E0] bg-white p-5 shadow-sm" aria-live="polite">
              <ol className="relative ml-3 space-y-5 border-l-2 border-[#E3E7E0]">
                {FLOW.map((f, i) => {
                  const done = i < step;
                  const now = i === step;
                  return (
                    <li key={f.key} className="relative pl-6">
                      <span
                        className="absolute -left-[13px] flex h-6 w-6 items-center justify-center rounded-full border-2"
                        style={{
                          background: done || now ? brand.teal : '#FFFFFF',
                          borderColor: done || now ? brand.teal : '#E3E7E0',
                        }}
                      >
                        {done && <Check size={12} className="text-white" aria-hidden />}
                        {now && <ChefHat size={12} className="text-white" aria-hidden />}
                      </span>
                      <p className={`text-[14.5px] font-bold ${now ? 'text-[#0F3D3E]' : done ? 'text-[#1A1A1A]' : 'text-[#9A9A9A]'}`}>
                        {f.label}
                        {now && <span className="ml-2 inline-block h-2 w-2 animate-pulse rounded-full" style={{ background: brand.gold }} aria-hidden />}
                      </p>
                      <p className="text-[12px] text-[#6B6B6B]">{now ? f.hint : done ? 'Done' : 'Waiting'}</p>
                    </li>
                  );
                })}
              </ol>
              {order.status === 'ready' && (
                <p className="mt-4 rounded-xl bg-[#EAF4EC] px-3 py-2.5 text-center text-[13px] font-semibold text-[#2E7D32]">
                  Your order is ready — it's coming to your table!
                </p>
              )}
            </div>

            {/* bill */}
            <div className="mt-4 overflow-hidden rounded-3xl border border-[#E3E7E0] bg-white shadow-sm">
              <div className="flex items-center gap-2 border-b border-[#F0F2EE] px-5 py-3.5">
                <ReceiptText size={16} className="text-[#6B6B6B]" aria-hidden />
                <h2 className="text-[14px] font-bold text-[#1A1A1A]">Bill</h2>
                <span
                  className="ml-auto rounded-full px-2.5 py-1 text-[11px] font-bold"
                  style={paid ? { background: '#EAF4EC', color: '#2E7D32' } : { background: '#FBF3E4', color: '#8A5A16' }}
                >
                  {paid ? 'PAID' : 'DUE AT COUNTER'}
                </span>
              </div>
              <div className="px-5 py-3">
                {order.items.map((it, i) => (
                  <div key={i} className="border-b border-[#F0F2EE] py-2.5 last:border-0">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="text-[13.5px] font-semibold text-[#1A1A1A]">
                        {it.qty} × {it.name}
                        {it.variant_name && <span className="font-normal text-[#6B6B6B]"> · {it.variant_name}</span>}
                      </p>
                      <p className="shrink-0 text-[13.5px] font-bold tabular-nums">{money(it.item_total)}</p>
                    </div>
                    {it.addons.length > 0 && <p className="text-[12px] text-[#6B6B6B]">+ {it.addons.map((a) => `${a.name} ₹${round2(a.price)}`).join(', ')}</p>}
                    {it.notes && <p className="text-[12px] italic text-[#8A5A16]">↳ {it.notes}</p>}
                  </div>
                ))}
                <div className="space-y-1 pt-2 text-[13px] text-[#6B6B6B]">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span className="tabular-nums">{money(order.subtotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>GST 5%</span>
                    <span className="tabular-nums">{money(order.tax_amount)}</span>
                  </div>
                  <div className="flex justify-between text-[15px] font-bold text-[#1A1A1A]">
                    <span>Total</span>
                    <span className="tabular-nums">{money(order.total)}</span>
                  </div>
                </div>
                {!paid && (
                  <p className="mt-3 flex items-center gap-1.5 rounded-xl bg-[#FBF3E4] px-3 py-2.5 text-[12.5px] font-medium text-[#8A5A16]">
                    <Wallet size={14} aria-hidden /> Show order #{order.order_number} at the counter and pay there.
                  </p>
                )}
              </div>
            </div>

            <p className="mt-4 flex items-center justify-center gap-1.5 text-[11.5px] text-[#6B6B6B]">
              <RefreshCw size={11} aria-hidden /> This page updates itself every 10 seconds.
            </p>
            <div className="mt-2 flex items-center justify-center gap-2 text-[11.5px] text-[#6B6B6B]">
              <button
                type="button"
                onClick={() => void navigator.clipboard?.writeText(window.location.href)}
                className="inline-flex items-center gap-1.5 rounded-full border border-[#E3E7E0] bg-white px-3 py-1.5 font-medium hover:border-[#B88E2F]"
              >
                <Copy size={12} aria-hidden /> Copy tracking link
              </button>
              <button type="button" onClick={() => window.location.assign('/')} className="inline-flex items-center gap-1.5 rounded-full border border-[#E3E7E0] bg-white px-3 py-1.5 font-medium hover:border-[#B88E2F]">
                ServePoint home
              </button>
            </div>
          </>
        )}
      </main>
      <GuestFooter />
    </div>
  );
}
