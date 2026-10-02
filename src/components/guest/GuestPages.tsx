import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Ban,
  Check,
  ChefHat,
  CircleAlert,
  Clock,
  Copy,
  HeartHandshake,
  Minus,
  Plus,
  QrCode,
  ReceiptText,
  RefreshCw,
  Search,
  ShoppingBag,
  Star,
  UtensilsCrossed,
  Volume2,
  VolumeX,
  Wallet,
  X,
} from 'lucide-react';
import {
  clearCachedSession,
  createPublicOrder,
  fetchPublicMenu,
  fetchPublicOffers,
  fetchPublicOrder,
  openTableSession,
  resolveTableQr,
  submitPublicFeedback,
  verifyTableSession,
  type GuestAddon,
  type GuestMenuItem,
  type GuestOrderSummary,
  type GuestVariant,
  type PublicMenu,
  type PublicOffer,
  type TableSession,
} from '../../lib/guest';
import { GUEST_LANGS, useGuestLang } from '../../lib/guest-i18n';

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
  const { t } = useGuestLang();
  return (
    <footer className="mt-auto border-t border-[#E3E7E0] bg-white">
      <div className="mx-auto flex max-w-xl items-center justify-between px-4 py-3 text-[11px] text-[#6B6B6B]">
        <span className="font-semibold uppercase tracking-[0.14em]" style={{ color: brand.teal }}>
          ServePoint
        </span>
        <span>{t('poweredBy')}</span>
      </div>
    </footer>
  );
}

function GuestErrorCard({ title, body, onRetry }: { title: string; body: string; onRetry?: () => void }): React.ReactElement {
  const { t } = useGuestLang();
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
            <RefreshCw size={15} aria-hidden /> {t('tryAgain')}
          </button>
        )}
      </div>
    </div>
  );
}

/* ════════════════════════════ 1 · GATE ════════════════════════════ */

export function GuestGatePage({ qrToken }: { qrToken: string }): React.ReactElement {
  const { t } = useGuestLang();
  const [state, setState] = useState<'working' | 'invalid' | 'session'>('working');
  const [detail, setDetail] = useState(t('checking'));

  const run = useCallback(async () => {
    setState('working');
    setDetail(t('checking'));
    if (!qrToken) {
      setState('invalid');
      setDetail(t('missingCode'));
      return;
    }
    const resolved = await resolveTableQr(qrToken);
    if (!resolved.is_valid || !resolved.tenant || !resolved.table) {
      setState('invalid');
      setDetail(resolved.message || t('invalidCode'));
      return;
    }
    setDetail(t('opening', { cafe: resolved.tenant.name }));
    const opened = await openTableSession({
      slug: resolved.tenant.slug,
      tableNumber: resolved.table.table_number,
      qrToken,
    });
    if (!opened.ok || !opened.session) {
      setState('session');
      setDetail(opened.message || t('sessionFail'));
      return;
    }
    window.location.assign(`/menu/${encodeURIComponent(qrToken)}`);
  }, [qrToken, t]);

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
            <p className="text-[12px] text-[#6B6B6B]">{t('serviceLine')}</p>
          </div>
        )}
        {state === 'invalid' && <GuestErrorCard title={t('gateInvalidTitle')} body={detail} />}
        {state === 'session' && <GuestErrorCard title={t('gateSessionTitle')} body={detail} onRetry={() => void run()} />}
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
const OFFER_KEY = (token: string) => `sp.guest.offer.${token}`;

/** Session countdown ribbon — the ONLY 1s-ticking component on the page. */
function SessionRibbon({ session }: { session: TableSession }): React.ReactElement {
  const { t } = useGuestLang();
  const [msLeft, setMsLeft] = useState(() => new Date(session.expires_at).getTime() - Date.now());
  useEffect(() => {
    const t2 = window.setInterval(() => setMsLeft(new Date(session.expires_at).getTime() - Date.now()), 1000);
    return () => window.clearInterval(t2);
  }, [session.expires_at]);
  const totalSec = Math.max(0, Math.floor(msLeft / 1000));
  const mm = String(Math.floor(totalSec / 60));
  const ss = String(totalSec % 60).padStart(2, '0');
  const ended = totalSec === 0;
  const warm = totalSec < 180 && !ended;
  return (
    <div
      className="flex items-center justify-center gap-2 px-4 py-2 text-[12.5px] font-semibold"
      style={{ background: ended ? '#F1F4F1' : warm ? '#FBF3E4' : brand.teal, color: ended ? '#6B6B6B' : warm ? '#8A5A16' : '#FFFFFF' }}
      role="status"
      aria-label={t('ariaEnds', { t: `${mm}:${ss}` })}
    >
      <Clock size={14} aria-hidden />
      <span>{ended ? 'Window ended' : warm ? t('endingSoon') : t('orderingWindow')}</span>
      {!ended && (
        <span className="font-mono tabular-nums">
          {mm}:{ss}
        </span>
      )}
      <span className="hidden sm:inline">{ended ? 'scan the table QR to continue' : t('rescanHint')}</span>
    </div>
  );
}

function Customizer({ item, onAdd, locked }: { item: GuestMenuItem; onAdd: (l: Omit<CartLine, 'key'>) => void; locked?: boolean }): React.ReactElement {
  const { t } = useGuestLang();
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
          <legend className="mb-1.5 text-[11.5px] font-semibold uppercase tracking-wide text-[#6B6B6B]">{t('chooseOne')}</legend>
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
          <legend className="mb-1.5 text-[11.5px] font-semibold uppercase tracking-wide text-[#6B6B6B]">{t('addons')}</legend>
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
        placeholder={t('cookNotePh')}
        aria-label={t('cookNoteAria')}
        className="sp-input h-11 w-full px-3 text-[13.5px]"
      />

      <div className="mt-3 flex items-center gap-3">
        <div className="flex items-center gap-1 rounded-full border border-[#E3E7E0] bg-white p-1">
          <button
            type="button"
            aria-label={t('decQty')}
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
            aria-label={t('incQty')}
            onClick={() => setQty((q) => Math.min(50, q + 1))}
            className="flex h-9 w-9 items-center justify-center rounded-full text-[#6B6B6B] hover:bg-[#F6F5F2] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0F3D3E]"
          >
            <Plus size={15} aria-hidden />
          </button>
        </div>
        <button
          type="button"
          disabled={locked}
          onClick={() => {
            onAdd({ item, variant, addons, qty, notes });
            setQty(1);
            setNotes('');
          }}
          className="flex h-11 flex-1 items-center justify-center gap-2 rounded-full text-[13.5px] font-semibold text-white transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B88E2F] disabled:cursor-not-allowed disabled:opacity-45"
          style={{ background: brand.teal }}
        >
          <Plus size={15} aria-hidden /> {locked ? t('orderingPaused') : t('addToOrder', { amt: money(unit * qty) })}
        </button>
      </div>
    </div>
  );
}

/** Language pills — EN / हिंदी / ಕನ್ನಡ, persisted per device. */
function LangSwitcher({ dark }: { dark?: boolean }): React.ReactElement {
  const { lang, setLang, t } = useGuestLang();
  return (
    <div
      role="group"
      aria-label={t('langAria')}
      className={`inline-flex items-center gap-0.5 rounded-full border p-[3px] ${dark ? 'border-white/15 bg-white/10' : 'border-[#E3E7E0] bg-white shadow-sm'}`}
    >
      {GUEST_LANGS.map((l) => {
        const active = lang === l.code;
        return (
          <button
            key={l.code}
            type="button"
            onClick={() => setLang(l.code)}
            aria-pressed={active}
            className={`flex h-8 items-center rounded-full px-3 text-[12.5px] font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 ${
              dark ? 'focus-visible:outline-white' : 'focus-visible:outline-[#B88E2F]'
            } ${active ? 'text-white shadow-sm' : dark ? 'text-white/70 hover:text-white' : 'text-[#6B6B6B] hover:text-[#1A1A1A]'}`}
            style={active ? { background: dark ? brand.gold : brand.teal } : undefined}
          >
            {l.native}
          </button>
        );
      })}
    </div>
  );
}

export function GuestMenuPage({ qrToken }: { qrToken: string }): React.ReactElement {
  const { t } = useGuestLang();
  const [phase, setPhase] = useState<'loading' | 'ready' | 'locked' | 'error'>('loading');
  const [errorBody, setErrorBody] = useState('');
  const [resolved, setResolved] = useState<{ tenantName: string; slug: string; tableNumber: string; capacity: number } | null>(null);
  const [menu, setMenu] = useState<PublicMenu | null>(null);
  const [sessionToken, setSessionToken] = useState<TableSession | null>(null);
  const [lockTone, setLockTone] = useState<'clock' | 'cut'>('clock');
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
  const [selectedOfferId, setSelectedOfferId] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem(OFFER_KEY(qrToken)) || null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    let alive = true;
    (async () => {
      const r = await resolveTableQr(qrToken);
      if (!alive) return;
      if (!r.is_valid || !r.tenant || !r.table) {
        setPhase('error');
        setErrorBody(r.message || t('invalidCode'));
        return;
      }
      setResolved({ tenantName: r.tenant.name, slug: r.tenant.slug, tableNumber: r.table.table_number, capacity: r.table.capacity });
      const opened = await openTableSession({ slug: r.tenant.slug, tableNumber: r.table.table_number, qrToken });
      if (!alive) return;
      if (!opened.ok || !opened.session) {
        setPhase('locked');
        setErrorBody(opened.message || t('sessionClosed'));
        return;
      }
      setSessionToken(opened.session);
      const m = await fetchPublicMenu(r.tenant.slug);
      if (!alive) return;
      if (!m.is_valid) {
        setPhase('error');
        setErrorBody(m.message || t('menuFail'));
        return;
      }
      setMenu(m);
      setPhase('ready');
      document.title = t('docTitleMenu', { cafe: r.tenant.name, n: r.table.table_number });
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

  // the applied offer rides with the cart — identity only, re-validated by the server
  useEffect(() => {
    try {
      if (selectedOfferId) sessionStorage.setItem(OFFER_KEY(qrToken), selectedOfferId);
      else sessionStorage.removeItem(OFFER_KEY(qrToken));
    } catch {
      /* quota — ignore */
    }
  }, [selectedOfferId, qrToken]);

  /** Lock the ordering UI — the server said this window is dead. Drops the
   *  cached token so a rescan re-issues a FRESH window instead of reusing the
   *  dead one (v5.24.0). */
  const lockGuest = useCallback(
    (reason: string) => {
      clearCachedSession(qrToken);
      setSessionToken(null);
      setDrawerOpen(false); // the cut freezes the cart too, not just the submit
      setLockTone(reason === 'revoked' ? 'cut' : 'clock');
      setErrorBody(
        reason === 'revoked'
          ? 'This session was closed by the cafe. Please speak to our staff, or scan the table QR to start over.'
          : reason === 'expired'
            ? 'Your 10-minute table session ended. Scan the table QR to open a fresh window.'
            : 'Your table session is no longer open. Scan the table QR to continue.',
      );
      setPhase('locked');
    },
    [qrToken],
  );

  // Session re-verify (v5.24.0, migration 023) — the server, not this phone's
  // clock, decides whether the window is still open. A staff cut from the
  // floor locks the menu within one 30s tick; a network hiccup never locks a
  // paying guest (fail-soft, retried next tick).
  useEffect(() => {
    if (phase !== 'ready' || !sessionToken) return;
    const token = sessionToken.session_token;
    const iv = window.setInterval(() => {
      void verifyTableSession(token).then((r) => {
        if (!r.ok) lockGuest(r.reason || 'unknown');
      });
    }, 30000);
    return () => window.clearInterval(iv);
  }, [phase, sessionToken, lockGuest]);

  const addLine = useCallback(
    (l: Omit<CartLine, 'key'>) => {
      if (phase !== 'ready') return; // locked windows accept nothing (v5.24.0)
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
    },
    [phase],
  );

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

  // offer math — mirrors the server (migration 017) EXACTLY: percent capped at
  // 100, flat clamped to the subtotal, GST on the discounted base, never below
  // zero. The device's numbers are only a preview; sp_create_public_order
  // re-validates the offer against the recomputed subtotal before it counts.
  const selectedOffer = offers.find((o) => o.id === selectedOfferId) ?? null;
  const offerReady = !!selectedOffer && cartSubtotal >= Number(selectedOffer.min_order_amount);
  const cartDiscount = selectedOffer && offerReady
    ? round2(
        selectedOffer.discount_type === 'percent'
          ? (cartSubtotal * Math.min(Number(selectedOffer.discount_value), 100)) / 100
          : Math.min(Number(selectedOffer.discount_value), cartSubtotal),
      )
    : 0;
  const cartTax = round2((cartSubtotal - cartDiscount) * 0.05);
  const cartTotal = round2(cartSubtotal - cartDiscount + cartTax);

  // a paused/removed offer must not ride along silently — drop it once offers load
  useEffect(() => {
    if (selectedOfferId && offers.length > 0 && !offers.some((o) => o.id === selectedOfferId)) {
      setSelectedOfferId(null);
    }
  }, [offers, selectedOfferId]);

  const toggleOffer = (id: string) => setSelectedOfferId((prev) => (prev === id ? null : id));

  // sticky category rail — scroll-spy highlights the section under the reader's thumb
  const [activeCat, setActiveCat] = useState<string | null>(null);
  useEffect(() => {
    if (phase !== 'ready') return;
    const els = Array.from(document.querySelectorAll<HTMLElement>('[data-cat]'));
    if (els.length === 0) return;
    const io = new IntersectionObserver(
      (entries) => {
        const vis = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (vis[0]) setActiveCat((vis[0].target as HTMLElement).dataset.cat ?? null);
      },
      { rootMargin: '-130px 0px -65% 0px', threshold: 0 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [phase, filtered]);

  const jumpToCat = (id: string) => {
    setActiveCat(id);
    document.getElementById(`cat-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

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
      offerId: selectedOffer && offerReady ? selectedOffer.id : null,
      sessionToken: sessionToken?.session_token ?? null,
    });
    if (!res.is_valid || !res.order) {
      setPlaceError(res.message || t('orderFail'));
      // a stale offer (paused mid-session) drops off so the retry is clean
      if (res.error === 'OFFER_INVALID') setSelectedOfferId(null);
      setPlacing(false);
      if (res.error === 'SESSION_CLOSED') {
        // the window died mid-checkout (staff cut or the clock) — no silent
        // retry, no auto-reopen: the cut must hold. The guest rescans.
        lockGuest(res.reason || 'unknown');
        return;
      }
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
        <p className="mt-3 text-[13px] text-[#6B6B6B]">{t('settingTable')}</p>
      </div>
    );
  }
  if (phase === 'error') {
    return (
      <div className="flex min-h-screen flex-col bg-[#F6F5F2]">
        <main className="flex-1">
          <GuestErrorCard title={t('menuUnavailable')} body={errorBody} />
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
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#E7C878]">{t('tablesideMenu')}</p>
            <h1 className="mt-1 font-serif text-[30px] italic leading-tight text-white">{resolved?.tenantName}</h1>
            <p className="mt-1.5 flex items-center gap-1.5 text-[12.5px] text-white/75">
              <UtensilsCrossed size={13} aria-hidden />
              {t('tableLine', { n: resolved?.tableNumber ?? '', s: resolved?.capacity ?? '' })}
            </p>
          </div>
          <button
            type="button"
            onClick={() => window.location.assign(`/t/${encodeURIComponent(qrToken)}`)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
            aria-label={t('backToCheckin')}
          >
            <ArrowLeft size={18} aria-hidden />
          </button>
        </div>

        <div className="mx-auto mt-4 flex max-w-xl items-center gap-2">
          <div className="relative flex-1">
            <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6B6B6B]" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('searchPh')}
              aria-label={t('searchAria')}
              className="h-12 w-full rounded-full border border-white/15 bg-white pl-10 pr-4 text-[14px] text-[#1A1A1A] shadow-sm placeholder:text-[#9A9A9A] focus:outline focus:outline-2 focus:outline-[#B88E2F]"
            />
          </div>
          <LangSwitcher dark />
        </div>
      </header>

      <main className="mx-auto w-full max-w-xl flex-1 px-4 pb-36 pt-4">
        {/* sticky category rail — thumb-friendly jumps, scroll-spy highlight */}
        {phase === 'ready' && filtered.length > 0 && (
          <nav
            aria-label={t('categoriesAria')}
            className="sticky top-0 z-30 -mx-4 mb-4 border-b border-[#E3E7E0] bg-[#F6F5F2]/95 px-4 py-2.5 backdrop-blur"
          >
            <div className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {filtered.map((c) => {
                const active = activeCat === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => jumpToCat(c.id)}
                    aria-current={active ? 'true' : undefined}
                    className={`h-9 shrink-0 rounded-full border px-3.5 text-[12.5px] font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#B88E2F] ${
                      active
                        ? 'border-transparent text-white shadow-sm'
                        : 'border-[#E3E7E0] bg-white text-[#1A1A1A] hover:border-[#B88E2F]'
                    }`}
                    style={active ? { background: brand.teal } : undefined}
                  >
                    {c.name}
                  </button>
                );
              })}
            </div>
          </nav>
        )}

        {/* today's offers — tap to apply, straight from the owner's CRM */}
        {phase === 'ready' && offers.length > 0 && (
          <section aria-label={t('offersAria')} className="mb-4">
            <div className="flex gap-2.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {offers.map((o) => {
                const min = Number(o.min_order_amount);
                const selected = selectedOfferId === o.id;
                const unlockable = cartSubtotal >= min;
                return (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => toggleOffer(o.id)}
                    aria-pressed={selected}
                    aria-label={`${o.title}${selected && unlockable ? ` — ${t('offerApplied')}` : ''}`}
                    className={`relative flex min-w-[240px] max-w-[300px] flex-1 items-center gap-3 rounded-2xl border px-3.5 py-3 text-left shadow-sm transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#B88E2F] ${
                      selected
                        ? 'border-[#B88E2F] bg-white ring-2 ring-[#B88E2F]'
                        : 'border-[#EED9B8] bg-gradient-to-br from-[#FBF3E4] to-[#F6EAD8] hover:border-[#B88E2F]'
                    }`}
                  >
                    <span
                      className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[11px] font-bold leading-none text-white"
                      style={{ background: selected ? brand.teal : '#B88E2F' }}
                    >
                      {o.discount_type === 'percent'
                        ? `${Number(o.discount_value)}%`
                        : `₹${Number(o.discount_value) % 1 === 0 ? Number(o.discount_value) : Number(o.discount_value).toFixed(0)}`}
                      {selected && (
                        <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full border-2 border-white bg-[#2E7D32]">
                          <Check size={9} className="text-white" aria-hidden />
                        </span>
                      )}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[12.5px] font-bold text-[#5B4300]">{o.title}</span>
                      <span className="block truncate text-[11px] text-[#8A5A00]">
                        {o.discount_type === 'percent' ? `${Number(o.discount_value)}% off` : `₹${Number(o.discount_value)} off`}
                        {min > 0 && ` · min ₹${min}`}
                        {o.description ? ` — ${o.description}` : ''}
                      </span>
                      <span
                        className={`mt-0.5 block text-[10.5px] font-semibold ${
                          selected && unlockable ? 'text-[#2E7D32]' : unlockable ? 'text-[#967221]' : 'text-[#B4483C]'
                        }`}
                      >
                        {selected && unlockable ? `✓ ${t('offerApplied')}` : unlockable ? t('offerTap') : t('offerAddMore', { amt: money(Math.max(min - cartSubtotal, 0)) })}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {phase === 'locked' && (
          <div className="rounded-3xl border border-[#E3E7E0] bg-white p-6 text-center shadow-sm">
            <div
              className="mx-auto flex h-14 w-14 items-center justify-center rounded-full"
              style={{ background: lockTone === 'cut' ? '#FDF3F2' : '#FBF3E4' }}
            >
              {lockTone === 'cut' ? (
                <Ban size={24} style={{ color: '#B3261E' }} aria-hidden />
              ) : (
                <Clock size={24} className="text-[#8A5A16]" aria-hidden />
              )}
            </div>
            <h2 className="mt-3 font-serif text-[22px] italic text-[#0F3D3E]">
              {lockTone === 'cut' ? 'Ordering closed' : t('orderingPaused')}
            </h2>
            <p className="mt-2 text-[13.5px] text-[#6B6B6B]">{errorBody}</p>
            <button
              type="button"
              onClick={() => window.location.assign(`/t/${encodeURIComponent(qrToken)}`)}
              className="mt-5 inline-flex h-11 items-center gap-2 rounded-full px-5 text-[13.5px] font-semibold text-white"
              style={{ background: brand.teal }}
            >
              <QrCode size={15} aria-hidden /> {t('reopen')}
            </button>
          </div>
        )}

        {phase === 'ready' && filtered.length === 0 && <p className="mt-10 text-center text-[13.5px] text-[#6B6B6B]">{t('nothingMatches', { q: query })}</p>}

        {filtered.map((cat) => (
          <section key={cat.id} id={`cat-${cat.id}`} data-cat={cat.id} className="mt-5 scroll-mt-16" aria-label={cat.name}>
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
                        title={item.is_veg ? t('veg') : t('nonveg')}
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
                              {t('nOptions', { n: item.variants.length, s: item.variants.length > 1 ? 's' : '' })}
                            </span>
                          )}
                          {item.addons.length > 0 && (
                            <span className="rounded-full bg-[#FDF9F0] px-2 py-0.5 text-[10.5px] font-medium text-[#8A5A16]">
                              {t('nAddons', { n: item.addons.length, s: item.addons.length > 1 ? 's' : '' })}
                            </span>
                          )}
                        </span>
                      </span>
                    </button>
                    {open && (
                      <div className="px-4 pb-4">
                        <Customizer item={item} onAdd={addLine} locked={phase !== 'ready'} />
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
      {phase === 'ready' && cartCount > 0 && !drawerOpen && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#E3E7E0] bg-white/95 p-3 backdrop-blur">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="mx-auto flex w-full max-w-xl items-center justify-between rounded-full px-5 text-white shadow-lg transition-opacity hover:opacity-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B88E2F]"
            style={{ background: brand.teal, height: 52 }}
          >
            <span className="flex items-center gap-2 text-[13.5px] font-semibold">
              <ShoppingBag size={16} aria-hidden />
              {t('nItems', { n: cartCount, s: cartCount > 1 ? 's' : '' })}
            </span>
            <span className="text-[14px] font-bold">{t('viewOrder', { amt: money(cartTotal) })}</span>
          </button>
        </div>
      )}

      {/* cart drawer */}
      {drawerOpen && phase === 'ready' && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={t('yourOrder')}>
          <button
            type="button"
            aria-label={t('closeCart')}
            onClick={() => setDrawerOpen(false)}
            className="absolute inset-0 h-full w-full cursor-default bg-[#0F3D3E]/45"
            style={{ animation: 'spFadeIn 200ms ease-out' }}
          />
          <div
            className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col rounded-l-[24px] bg-white shadow-2xl"
            style={{ animation: 'spDrawerIn 280ms cubic-bezier(0.22, 1, 0.36, 1)' }}
          >
            <div className="flex items-center justify-between border-b border-[#E3E7E0] px-5 py-4">
              <h2 className="text-base font-bold text-[#1A1A1A]">{t('yourOrderTable', { n: resolved?.tableNumber ?? '' })}</h2>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label={t('close')}
                className="flex h-11 w-11 items-center justify-center rounded-full text-[#6B6B6B] hover:bg-[#F6F5F2] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#967221]"
              >
                <X size={18} aria-hidden />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              {lines.length === 0 && <p className="mt-10 text-center text-[13.5px] text-[#6B6B6B]">{t('emptyCart')}</p>}
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
                        {t('remove')}
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {lines.length > 0 && (
                <div className="mt-4">
                  <label htmlFor="g-name" className="mb-1 block text-[12px] font-medium text-[#6B6B6B]">
                    {t('nameLabel')}
                  </label>
                  <input
                    id="g-name"
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    maxLength={60}
                    placeholder={t('namePh')}
                    className="sp-input h-11 w-full px-3 text-[13.5px]"
                  />
                </div>
              )}

              {/* offer picker — the same toggles as the menu chips, compacted for the drawer */}
              {lines.length > 0 && offers.length > 0 && (
                <div className="mt-4" aria-label={t('offersAria')}>
                  <p className="mb-1.5 text-[12px] font-medium text-[#6B6B6B]">{t('offersAria')}</p>
                  <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {offers.map((o) => {
                      const selected = selectedOfferId === o.id;
                      const unlockable = cartSubtotal >= Number(o.min_order_amount);
                      return (
                        <button
                          key={o.id}
                          type="button"
                          onClick={() => toggleOffer(o.id)}
                          aria-pressed={selected}
                          title={unlockable ? o.title : t('offerAddMore', { amt: money(Math.max(Number(o.min_order_amount) - cartSubtotal, 0)) })}
                          className={`flex h-9 shrink-0 items-center gap-2 rounded-full border px-2.5 text-[12px] font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#B88E2F] ${
                            selected
                              ? 'border-[#B88E2F] bg-[#FBF3E4] text-[#5B4300]'
                              : unlockable
                                ? 'border-[#EED9B8] bg-white text-[#1A1A1A] hover:border-[#B88E2F]'
                                : 'border-dashed border-[#EED9B8] bg-white text-[#9A9A9A]'
                          }`}
                        >
                          <span
                            className="flex h-5 min-w-5 items-center justify-center rounded-md px-1 text-[9.5px] font-bold text-white"
                            style={{ background: selected ? brand.teal : '#B88E2F' }}
                          >
                            {o.discount_type === 'percent'
                              ? `${Number(o.discount_value)}%`
                              : `₹${Number(o.discount_value) % 1 === 0 ? Number(o.discount_value) : Number(o.discount_value).toFixed(0)}`}
                          </span>
                          <span className="max-w-[150px] truncate">{o.title}</span>
                          {selected && <Check size={12} className="text-[#2E7D32]" aria-hidden />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {lines.length > 0 && (
              <div className="border-t border-[#E3E7E0] px-5 py-4">
                <div className="space-y-1 text-[13px] text-[#6B6B6B]">
                  <div className="flex justify-between">
                    <span>{t('subtotal')}</span>
                    <span className="tabular-nums">{money(cartSubtotal)}</span>
                  </div>
                  {cartDiscount > 0 && selectedOffer && (
                    <div className="flex items-center justify-between font-medium text-[#2E7D32]" style={{ animation: 'spFadeIn 200ms ease-out' }}>
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span className="shrink-0 rounded bg-[#EAF4EC] px-1.5 py-0.5 text-[10px] font-bold">{t('offer')}</span>
                        <span className="truncate">{selectedOffer.title}</span>
                        <button
                          type="button"
                          onClick={() => setSelectedOfferId(null)}
                          aria-label={t('offerRemove')}
                          className="shrink-0 text-[#6B6B6B] hover:text-[#B4483C] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#B4483C]"
                        >
                          <X size={12} aria-hidden />
                        </button>
                      </span>
                      <span className="shrink-0 tabular-nums">−{money(cartDiscount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>{t('gst')}</span>
                    <span className="tabular-nums">{money(cartTax)}</span>
                  </div>
                  <div className="flex justify-between text-[15px] font-bold text-[#1A1A1A]">
                    <span>{t('total')}</span>
                    <span className="tabular-nums">{money(cartTotal)}</span>
                  </div>
                </div>
                {placeError && (
                  <p className="mt-2 rounded-xl bg-[#FDF3F2] px-3 py-2 text-[12.5px] text-[#B4483C]" role="alert">
                    {placeError}
                  </p>
                )}
                <p className="mt-2 flex items-center gap-1.5 text-[11.5px] text-[#6B6B6B]">
                  <Wallet size={13} aria-hidden /> {t('payNote')}
                </p>
                <button
                  type="button"
                  onClick={() => void placeOrder()}
                  disabled={placing}
                  className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-full text-[14px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B88E2F]"
                  style={{ background: brand.teal }}
                >
                  {placing ? t('sending') : t('placeOrder', { amt: money(cartTotal) })}
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

const FLOW: { key: string; labelKey: string; hintKey: string }[] = [
  { key: 'new', labelKey: 'flowPlaced', hintKey: 'flowPlacedHint' },
  { key: 'preparing', labelKey: 'flowKitchen', hintKey: 'flowKitchenHint' },
  { key: 'ready', labelKey: 'flowReady', hintKey: 'flowReadyHint' },
  { key: 'completed', labelKey: 'flowServed', hintKey: 'flowServedHint' },
];

function statusIndex(status: string): number {
  const i = FLOW.findIndex((f) => f.key === status);
  return i < 0 ? 0 : i;
}

/** raw order_type enum → translated label (t() falls back to the raw value). */
const OT_KEYS: Record<string, string> = {
  dine_in: 'otDineIn',
  dinein: 'otDineIn',
  takeaway: 'otTakeaway',
  delivery: 'otDelivery',
};

/* ── feedback (019) — "how was everything?" ────────────────────────────────── */

const FB_MAX_COMMENT = 280;

function StarRow({
  value,
  interactive,
  onPick,
  onHover,
}: {
  value: number;
  interactive: boolean;
  onPick?: (n: number) => void;
  onHover?: (n: number) => void;
}): React.ReactElement {
  const { t } = useGuestLang();
  return (
    <div className="flex items-center gap-1.5" role={interactive ? 'radiogroup' : undefined} aria-label={interactive ? t('fbStarsAria') : undefined}>
      {[1, 2, 3, 4, 5].map((n) => {
        const on = n <= value;
        const star = (
          <Star
            size={interactive ? 34 : 17}
            className={interactive ? 'transition-transform duration-150' : ''}
            aria-hidden
            fill={on ? brand.gold : 'transparent'}
            stroke={on ? brand.gold : '#C9CFC9'}
            strokeWidth={1.6}
          />
        );
        if (!interactive) return <span key={n}>{star}</span>;
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={t('fbStarN', { n: String(n), plural: n === 1 ? '' : 's' })}
            onClick={() => onPick?.(n)}
            onMouseEnter={() => onHover?.(n)}
            onMouseLeave={() => onHover?.(0)}
            onFocus={() => onHover?.(n)}
            onBlur={() => onHover?.(0)}
            className="rounded-full p-0.5 outline-none focus-visible:ring-2 focus-visible:ring-[#B88E2F]/60 active:scale-90"
            style={{ animation: `spStarPop 360ms cubic-bezier(0.34,1.56,0.64,1) both`, animationDelay: `${n * 55}ms` }}
          >
            {star}
          </button>
        );
      })}
    </div>
  );
}

function FeedbackCard({
  order,
  onRated,
}: {
  order: GuestOrderSummary;
  onRated: (n: number) => void;
}): React.ReactElement {
  const { t } = useGuestLang();
  const rated = order.feedback_rating; // server truth — survives reloads
  const [hoverN, setHoverN] = useState(0);
  const [picked, setPicked] = useState(0);
  const [comment, setComment] = useState('');
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState(false);

  const shown = hoverN || picked;

  const submit = async () => {
    if (!picked || sending) return;
    setSending(true);
    setErr(false);
    const res = await submitPublicFeedback(order.id, picked, comment.trim() || null);
    setSending(false);
    if (res.is_valid) {
      onRated(picked); // the parent refreshes the pager → thank-you from server truth
    } else {
      setErr(true);
    }
  };

  if (rated != null && rated > 0) {
    return (
      <section
        className="mt-4 rounded-3xl border border-[#E3E7E0] bg-white p-5 shadow-sm"
        aria-label={t('fbRatedAria', { n: String(rated) })}
        style={{ animation: 'spThanksRise 320ms ease-out both' }}
      >
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-full" style={{ background: '#EAF4EC' }}>
            <HeartHandshake size={16} className="text-[#2E7D32]" aria-hidden />
          </span>
          <div>
            <h2 className="text-[14.5px] font-bold text-[#1A1A1A]">{t('fbThanksTitle')}</h2>
            <p className="text-[11.5px] text-[#6B6B6B]">{t('fbThanksSub')}</p>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2 rounded-2xl bg-[#FBF9F4] px-3.5 py-2.5">
          <StarRow value={rated} interactive={false} />
          <span className="ml-auto text-[12px] font-semibold text-[#8A5A16] tabular-nums">{rated}/5</span>
        </div>
      </section>
    );
  }

  return (
    <section
      className="mt-4 rounded-3xl border border-[#E3E7E0] bg-white p-5 shadow-sm"
      aria-label={t('fbTitle')}
      style={{ animation: 'spThanksRise 320ms ease-out both' }}
    >
      <div className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-full" style={{ background: '#FBF3E4' }}>
          <Star size={15} fill={brand.gold} stroke={brand.gold} aria-hidden />
        </span>
        <div>
          <h2 className="text-[14.5px] font-bold text-[#1A1A1A]">{t('fbTitle')}</h2>
          <p className="text-[11.5px] text-[#6B6B6B]">{t('fbSub')}</p>
        </div>
      </div>

      <div className="mt-3.5 flex justify-center py-1">
        <StarRow value={shown} interactive onPick={setPicked} onHover={setHoverN} />
      </div>

      {picked > 0 && (
        <div className="mt-3" style={{ animation: 'spFadeIn 240ms ease-out both' }}>
          <label htmlFor="fb-comment" className="text-[11.5px] font-semibold text-[#6B6B6B]">
            {t('fbCommentLabel')}
          </label>
          <textarea
            id="fb-comment"
            rows={2}
            maxLength={FB_MAX_COMMENT}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={t('fbCommentPlaceholder')}
            className="mt-1.5 w-full resize-none rounded-2xl border border-[#E3E7E0] bg-[#FBF9F4] px-3.5 py-2.5 text-[13px] text-[#1A1A1A] placeholder:text-[#9A9A9A] focus:border-[#B88E2F] focus:outline-none focus:ring-2 focus:ring-[#B88E2F]/25"
          />
          <p className="mt-1 text-right text-[10.5px] tabular-nums text-[#9A9A9A]" aria-hidden>
            {comment.length}/{FB_MAX_COMMENT}
          </p>
        </div>
      )}

      {err && (
        <p className="mt-2.5 rounded-xl bg-[#FBEDEB] px-3 py-2 text-[12.5px] font-medium text-[#B4483C]" role="alert" style={{ animation: 'spFadeIn 240ms ease-out both' }}>
          {t('fbErr')}
        </p>
      )}

      <button
        type="button"
        disabled={picked === 0 || sending}
        onClick={() => void submit()}
        className="mt-1 flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-[13.5px] font-bold text-white transition-all active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-45"
        style={{ background: brand.teal }}
      >
        {sending ? (
          <>
            <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden />
            {t('fbSending')}
          </>
        ) : (
          t('fbSubmit')
        )}
      </button>
    </section>
  );
}

export function GuestTrackPage({ orderId }: { orderId: string }): React.ReactElement {
  const { t } = useGuestLang();
  const uuidLike = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId);
  const [order, setOrder] = useState<GuestOrderSummary | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'bad' | 'net'>('loading');
  const [muted, setMuted] = useState(() => localStorage.getItem('sp.guest.chime') === 'off');
  const [copied, setCopied] = useState(false);
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
        new: t('stNew'),
        pending: t('stNew'),
        preparing: t('stPreparing'),
        ready: t('stReady'),
        completed: t('stCompleted'),
        cancelled: t('stCancelled'),
      };
      document.title = t('docTitleTrack', { n: res.order.order_number, s: labels[res.order.status] || res.order.status });
    }
  }, [orderId, muted, t]);

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
          <GuestErrorCard title={t('badLinkTitle')} body={t('badLinkBody')} />
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
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#E7C878]">{t('yourTicket')}</p>
            <h1 className="mt-0.5 font-serif text-[30px] italic text-white">{order ? `#${order.order_number}` : '· · ·'}</h1>
            {order && (
              <p className="mt-1 text-[12.5px] text-white/75">
                {order.table_number ? t('tableN', { n: order.table_number }) : t(OT_KEYS[order.order_type] || order.order_type)}
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
            aria-label={muted ? t('unmute') : t('mute')}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
          >
            {muted ? <VolumeX size={17} aria-hidden /> : <Volume2 size={17} aria-hidden />}
          </button>
        </div>
        <div className="mx-auto mt-3 max-w-xl">
          <LangSwitcher dark />
        </div>
      </header>

      <main className="mx-auto w-full max-w-xl flex-1 px-4 pb-10 pt-5">
        {state === 'loading' && <p className="mt-10 text-center text-[13.5px] text-[#6B6B6B]">{t('finding')}</p>}
        {state === 'net' && !order && <GuestErrorCard title={t('netTitle')} body={t('netBody')} />}

        {order && cancelled && (
          <div className="rounded-3xl border border-[#E3E7E0] bg-white p-6 text-center shadow-sm">
            <CircleAlert size={26} className="mx-auto text-[#B4483C]" aria-hidden />
            <h2 className="mt-3 font-serif text-[22px] italic text-[#0F3D3E]">{t('cancelledTitle')}</h2>
            <p className="mt-2 text-[13.5px] text-[#6B6B6B]">{t('cancelledBody')}</p>
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
                  const servedNow = now && order.status === 'completed'; // the last node, gold on serve
                  return (
                    <li key={f.key} className="relative pl-6">
                      <span
                        className="absolute -left-[13px] flex h-6 w-6 items-center justify-center rounded-full border-2"
                        style={{
                          background: done || now ? (servedNow ? brand.gold : brand.teal) : '#FFFFFF',
                          borderColor: done || now ? (servedNow ? brand.gold : brand.teal) : '#E3E7E0',
                          boxShadow: servedNow ? '0 0 0 4px rgba(184,142,47,0.18)' : undefined,
                        }}
                      >
                        {done && <Check size={12} className="text-white" aria-hidden />}
                        {now && <ChefHat size={12} className="text-white" aria-hidden />}
                      </span>
                      <p className={`text-[14.5px] font-bold ${now ? 'text-[#0F3D3E]' : done ? 'text-[#1A1A1A]' : 'text-[#9A9A9A]'}`}>
                        {t(f.labelKey)}
                        {now && !servedNow && <span className="ml-2 inline-block h-2 w-2 animate-pulse rounded-full" style={{ background: brand.gold }} aria-hidden />}
                      </p>
                      <p className="text-[12px] text-[#6B6B6B]">{now ? t(f.hintKey) : done ? t('done') : t('waiting')}</p>
                    </li>
                  );
                })}
              </ol>
              {order.status === 'ready' && (
                <p className="mt-4 rounded-xl bg-[#EAF4EC] px-3 py-2.5 text-center text-[13px] font-semibold text-[#2E7D32]">
                  {t('readyBanner')}
                </p>
              )}
            </div>

            {/* bill */}
            <div className="mt-4 overflow-hidden rounded-3xl border border-[#E3E7E0] bg-white shadow-sm">
              <div className="flex items-center gap-2 border-b border-[#F0F2EE] px-5 py-3.5">
                <ReceiptText size={16} className="text-[#6B6B6B]" aria-hidden />
                <h2 className="text-[14px] font-bold text-[#1A1A1A]">{t('bill')}</h2>
                <span
                  className="ml-auto rounded-full px-2.5 py-1 text-[11px] font-bold"
                  style={paid ? { background: '#EAF4EC', color: '#2E7D32' } : { background: '#FBF3E4', color: '#8A5A16' }}
                >
                  {paid ? t('paid') : t('due')}
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
                    <span>{t('subtotal')}</span>
                    <span className="tabular-nums">{money(order.subtotal)}</span>
                  </div>
                  {Number(order.discount_amount) > 0 && (
                    <div className="flex justify-between font-medium text-[#2E7D32]">
                      <span className="truncate pr-2">{order.offer_title || t('offer')}</span>
                      <span className="shrink-0 tabular-nums">−{money(Number(order.discount_amount))}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>{t('gst')}</span>
                    <span className="tabular-nums">{money(order.tax_amount)}</span>
                  </div>
                  <div className="flex justify-between text-[15px] font-bold text-[#1A1A1A]">
                    <span>{t('total')}</span>
                    <span className="tabular-nums">{money(order.total)}</span>
                  </div>
                </div>
                {!paid && (
                  <p className="mt-3 flex items-center gap-1.5 rounded-xl bg-[#FBF3E4] px-3 py-2.5 text-[12.5px] font-medium text-[#8A5A16]">
                    <Wallet size={14} aria-hidden /> {t('showCounter', { n: order.order_number })}
                  </p>
                )}
              </div>
            </div>

            {/* rate your visit — appears once the cafe marks the ticket served */}
            {order.status === 'completed' && (
              <FeedbackCard
                order={order}
                onRated={(n) => setOrder((o) => (o ? { ...o, feedback_rating: n } : o))}
              />
            )}

            <p className="mt-4 flex items-center justify-center gap-1.5 text-[11.5px] text-[#6B6B6B]">
              <RefreshCw size={11} aria-hidden /> {t('autoUpdate')}
            </p>
            <div className="mt-2 flex items-center justify-center gap-2 text-[11.5px] text-[#6B6B6B]">
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard?.writeText(window.location.href);
                  setCopied(true);
                  window.setTimeout(() => setCopied(false), 1600);
                }}
                className="inline-flex items-center gap-1.5 rounded-full border border-[#E3E7E0] bg-white px-3 py-1.5 font-medium hover:border-[#B88E2F]"
              >
                <Copy size={12} aria-hidden /> {copied ? t('copied') : t('copyLink')}
              </button>
              <button type="button" onClick={() => window.location.assign('/')} className="inline-flex items-center gap-1.5 rounded-full border border-[#E3E7E0] bg-white px-3 py-1.5 font-medium hover:border-[#B88E2F]">
                {t('goHome')}
              </button>
            </div>
          </>
        )}
      </main>
      <GuestFooter />
    </div>
  );
}
