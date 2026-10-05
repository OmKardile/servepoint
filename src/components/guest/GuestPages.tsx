import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Ban,
  Check,
  ChefHat,
  ChevronRight,
  CircleAlert,
  CircleOff,
  Clock,
  CloudOff,
  Copy,
  HeartHandshake,
  Loader2,
  Minus,
  Plus,
  QrCode,
  ReceiptText,
  RefreshCw,
  Search,
  ShoppingBag,
  Star,
  StickyNote,
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
  ticketAge,
  ticketPlacedStamp,
  verifyTableSession,
  type GuestAddon,
  type GuestMenuItem,
  type GuestOrderSummary,
  type GuestTenantBrand,
  type GuestVariant,
  type PublicMenu,
  type PublicOffer,
  type TableSession,
} from '../../lib/guest';
import { GUEST_LANGS, useGuestLang } from '../../lib/guest-i18n';
import { useDialogA11y } from '../../lib/useDialogA11y';
/* v5.212.0 — the offer's own words, borrowed from the ONE composer. The
   guest menu composed its badge/rule locally since the banner was born
   (5.71's disease reaching the guest side): a no-paise badge plus a local
   min clause while the offers tab's card said "₹50.00 off over ₹300.00" —
   two composers of one offer's words can disagree, and the guest heard
   the dialect.
   The compact register (the tiny-chip "₹50") also lives in the lib now —
   one composer for BOTH guest badge sites, its paise branch honest
   (formatMoney, never a toFixed rounding lie). PublicOffer satisfies
   the lib's OfferVoice triple — the guest side borrows the words without
   owning an Offer-shaped shadow of the owner's row. */
import { offerBadgeShort, offerRuleLabel } from '../../lib/offerLabel';
/* v5.213.0 — the chip knows what it saves: the preview reads the store's
   ONE offerDiscount (widened to the voice triple last round precisely so a
   projection could borrow it) — the SAME number the counter's fit whisper
   speaks and the drawer's discount line will speak when the guest taps.
   The locked chips read it as ₹0 naturally (the arithmetic guards the
   threshold), so the savings never lies about an offer the cart can't
   take yet. */
import { offerDiscount } from '../../store/cart';
/* v5.214.0 — the floating bar whispers the fit: the LAST silent offer
   surface on the guest side borrows the family home (lib/offerFit) — the
   SAME reducer the counter's pill reads (best take among eligible, the
   closest threshold among unlocks, the honest 'a better offer fits'
   upsell) and the SAME sentence composer (offerFitVoice — 5.211's
   own-words rule for the fit: two surfaces never say it in two
   dialects). The bar's own total already includes the discount when one
   is applied — '₹40.00 off applied' explains why the number moved. */
import { offerFit, offerFitVoice } from '../../lib/offerFit';
import { appTimezone, formatWindowLeft, WARM_WINDOW_MS } from '../../lib/appday';

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

/** The licence line (migration 037): the receipt's legal block spoken at
 *  glass scale — centered, small, tabular digits a hand-keyed typo can't
 *  hide in. Renders ONLY when the owner saved something in Business
 *  profile; an all-NULL payload leaves the footer byte-identical to the
 *  pre-5.52 footer (the v5.29 logo precedent, one row down). */
function GuestFooterLegal({
  tenant,
}: {
  tenant?: { name?: string | null; legal_name?: string | null; gst_number?: string | null; fssai_number?: string | null } | null;
}): React.ReactElement | null {
  const legalName =
    tenant?.legal_name && tenant.legal_name.trim() !== '' && tenant.legal_name.trim() !== tenant.name
      ? tenant.legal_name.trim()
      : null;
  const gst = tenant?.gst_number?.trim() ? tenant.gst_number.trim().toUpperCase() : null;
  const fssai = tenant?.fssai_number?.trim() ? tenant.fssai_number.trim() : null;
  if (!legalName && !gst && !fssai) return null;
  return (
    <div className="border-t border-[#E3E7E0]/70 bg-[#F6F5F2] px-4 py-2.5 text-center">
      {legalName && <div className="text-[10.5px] font-semibold text-[#1A1A1A]">{legalName}</div>}
      {(gst || fssai) && (
        <div className="mt-0.5 font-mono text-[10px] tracking-[0.08em] text-[#6B6B6B]">
          {gst && (
            <span className="tabular-nums">
              GSTIN: {gst}
              {fssai ? ' · ' : ''}
            </span>
        )}
          {fssai && <span className="tabular-nums">FSSAI Lic. No: {fssai}</span>}
        </div>
      )}
    </div>
  );
}

function GuestFooter({
  legalTenant,
}: {
  legalTenant?: { name?: string | null; legal_name?: string | null; gst_number?: string | null; fssai_number?: string | null } | null;
}): React.ReactElement {
  const { t } = useGuestLang();
  return (
    <footer className="mt-auto border-t border-[#E3E7E0] bg-white">
      <GuestFooterLegal tenant={legalTenant} />
      <div className="mx-auto flex max-w-xl items-center justify-between px-4 py-3 text-[11px] text-[#6B6B6B]">
        <span className="font-semibold uppercase tracking-[0.14em]" style={{ color: brand.teal }}>
          ServePoint
        </span>
        <span>{t('poweredBy')}</span>
      </div>
    </footer>
  );
}

/* 5.249.0 — the card learns its own busy voice: a retry that is RUNNING says
   so (the loader swaps for the refresh arrow, the button disables) — a guest
   who taps twice must never fire two chains, and a spinning arrow is the
   honest word for "the phone is trying". aria-busy names it to the reader. */
function GuestErrorCard({ title, body, onRetry, busy = false }: { title: string; body: string; onRetry?: () => void; busy?: boolean }): React.ReactElement {
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
            disabled={busy}
            aria-busy={busy || undefined}
            className="mt-5 inline-flex h-11 items-center gap-2 rounded-full px-5 text-[13.5px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            style={{ background: brand.teal }}
          >
            {busy ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <RefreshCw size={15} aria-hidden />} {t('tryAgain')}
          </button>
        )}
      </div>
    </div>
  );
}

/* ══════════════ the guest hears the blip (v5.267.0) ══════════════
 * The showcase promises the house is "ready when the Wi-Fi blips" — and
 * the wake family (5.261) makes the data true: visibility and network
 * each refetch the moment the page is seen again. But the blip ITSELF
 * was silent: the guest on flaky café Wi-Fi kept reading a page that
 * looked alive while nothing moved — the stepper frozen, the ribbon
 * ticking on client arithmetic, no word anywhere. The staff shell has
 * spoken its offline banner since 5.134 (PwaLayer's episode grammar);
 * the guest — the one person on the house's flakiest network — heard
 * nothing. THE BAND: the same episode grammar (a wasOffline ref, the
 * 2.6s recovery whisper, each episode announced once), the guest's own
 * words in the three guest languages, the amber family the house speaks
 * when something's off, spFadeIn 0.35s (the reduced-motion gate holds
 * it), role="status" so the ears hear it too. THE BAND MOVES NO DATA:
 * its listeners speak words only — the pages' own wakes (the track's
 * tick, the menu's verify) keep their fetch jobs; the band never
 * fetches (asserted in unit306). */
function GuestNetBand(): React.ReactElement | null {
  const { t } = useGuestLang();
  const [online, setOnline] = useState(() => navigator.onLine);
  const [justBack, setJustBack] = useState(false);
  const wasOffline = useRef(false);
  useEffect(() => {
    const up = () => {
      setOnline(true);
      if (wasOffline.current) {
        wasOffline.current = false;
        setJustBack(true);
      }
    };
    const down = () => {
      setOnline(false);
      wasOffline.current = true;
    };
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);
  useEffect(() => {
    if (!justBack) return;
    const t2 = window.setTimeout(() => setJustBack(false), 2600);
    return () => window.clearTimeout(t2);
  }, [justBack]);
  if (online && !justBack) return null;
  const offline = !online;
  return (
    <div
      role="status"
      title={t('netBandTitle')}
      style={{ animation: 'spFadeIn 0.35s ease' }}
      className={`mb-3 flex items-center gap-2 rounded-xl border px-3 py-2 text-[12.5px] font-medium ${
        offline
          ? 'border-[#F0E4C8] border-l-4 border-l-[#B45309] bg-[#FBF6EA] text-[#8A5A00]'
          : 'border-[#E3E7E0] bg-white text-[#5B6B63]'
      }`}
    >
      {offline ? <CloudOff size={13} aria-hidden /> : <Check size={13} aria-hidden />}
      <span>{offline ? t('netOffline') : t('netBack')}</span>
    </div>
  );
}

/* ════════════════════════════ 1 · GATE ════════════════════════════ */

export function GuestGatePage({ qrToken }: { qrToken: string }): React.ReactElement {
  const { t } = useGuestLang();
  const [state, setState] = useState<'working' | 'invalid' | 'session'>('working');
  const [detail, setDetail] = useState(t('checking'));
  /* 5.249.0 — the gate's own busy word: the session-retry wears the card's
     shared busy voice (one card, one language). */
  const [busy, setBusy] = useState(false);

  const run = useCallback(async () => {
    setBusy(true);
    setState('working');
    setDetail(t('checking'));
    if (!qrToken) {
      setState('invalid');
      setDetail(t('missingCode'));
      setBusy(false);
      return;
    }
    const resolved = await resolveTableQr(qrToken);
    if (!resolved.is_valid || !resolved.tenant || !resolved.table) {
      setState('invalid');
      setDetail(resolved.message || t('invalidCode'));
      setBusy(false);
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
      setBusy(false);
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
        {state === 'session' && <GuestErrorCard title={t('gateSessionTitle')} body={detail} busy={busy} onRetry={() => void run()} />}
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
/* v5.254.0 — the kitchen's ears: an optional order-level note rides the whole
 * order (the server has taken p_notes since the first menu round — the drawer
 * just never offered the field, and the ticket never spoke the word back).
 * The note persists per-tab beside the cart (a reload keeps it with the food),
 * rides to the server at checkout, and clears when the cart does — the next
 * order writes its own word. The ticket displays it verbatim: the guest's own
 * word, never rewritten. */
const ORDER_NOTE_KEY = (token: string) => `sp.guest.orderNote.${token}`;
const ORDER_NOTE_MAX = 280; // the feedback card's cap — one number, one language

function readOrderNote(token: string): string {
  try {
    const raw = sessionStorage.getItem(ORDER_NOTE_KEY(token));
    return typeof raw === 'string' ? raw : '';
  } catch {
    /* private mode — the field just starts empty */
  }
  return '';
}
/* v5.253.0 — the ticket's word reaches the menu: the loop 5.252.0 opened
 * (ticket → "Order more" → menu) closes here. The menu page remembers the
 * guest's latest ticket FROM THEIR OWN CHECKOUT (the id + number the server
 * handed back at placeOrder — the guest's memory, not a status claim: the
 * kitchen's live word lives on the ticket page, and the chip only points the
 * way). Per-tab sessionStorage by the same law as 5.252.0's pill — a fresh
 * or reopened link remembers nothing and claims nothing. */
const LAST_ORDER_KEY = (token: string) => `sp.guest.lastOrder.${token}`;

function readLastTicket(token: string): { id: string; n: number } | null {
  try {
    const raw = sessionStorage.getItem(LAST_ORDER_KEY(token));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { id?: unknown; n?: unknown };
    if (!parsed || typeof parsed.id !== 'string' || typeof parsed.n !== 'number') return null;
    return { id: parsed.id, n: parsed.n };
  } catch {
    /* private mode / corrupt cache — the menu claims no ticket */
  }
  return null;
}

/** The window's left-over, computed fresh each tick. The server's anchor WINS
 *  when present — 023's own discipline ("the server, not this phone's clock,
 *  decides") extended from the LOCK to the DISPLAY: seconds-left minus the
 *  time since the verdict landed, floored at zero. With no anchor yet (the
 *  first 30s of a fresh window, or a fail-soft tick that came back without
 *  the number) the phone subtracts its own clock from expires_at — correct
 *  at birth, corrected the moment the server speaks. A drifted phone clock
 *  can interpolate, but it can never PROMISE a window the server disagrees
 *  with for longer than one 30s tick. */
function windowLeft(
  session: TableSession,
  serverRemaining: { at: number; seconds: number } | null | undefined,
): number {
  if (serverRemaining) {
    return Math.max(0, serverRemaining.seconds * 1000 - (Date.now() - serverRemaining.at));
  }
  return new Date(session.expires_at).getTime() - Date.now();
}

/** Session countdown ribbon — pure renderer since 5.250.0. The ONE 1s tick
 *  lives on the PAGE now (see msLeft there): the ribbon renders whatever
 *  msLeft it is handed, and the ordering machinery speaks the SAME number —
 *  one window arithmetic, never two (the 5.218 cross-screen law, finally
 *  literal: the ribbon used to be the only 1s component, and the ONLY thing
 *  that knew the window had died while the buttons below kept ordering).
 *  It still re-anchors to the server's `remaining_seconds` on every 30s
 *  re-verify tick (5.216.0 — the field the RPC always sent and the app
 *  always threw away). The ended state is i18n'd like every other state
 *  (the dead window is exactly when a guest is most confused — English-only
 *  words there were a hole in the three-language promise), and the rescan
 *  hint is audible at EVERY width — `hidden sm:inline` hid the recovery
 *  sentence on the phones the ribbon exists for. 5.251.0 — the warm/ended
 *  verdicts are derived ON THE PAGE now (windowEnded / windowWarm from the
 *  same msLeft, the threshold in appday's WARM_WINDOW_MS): the ribbon
 *  renders the verdicts it is handed and computes nothing — one window
 *  arithmetic, never two, for the bands as well as the clock. */
function SessionRibbon({
  session,
  msLeft,
  ended,
  warm,
}: {
  session: TableSession;
  msLeft: number | null;
  ended: boolean;
  warm: boolean;
}): React.ReactElement {
  const { t } = useGuestLang();
  if (msLeft === null) return null as unknown as React.ReactElement;
  /* 5.218.0 — the m:ss voice moved to lib/appday's formatWindowLeft: the
     owner's Floor drill now speaks the SAME grammar (one window arithmetic,
     never two — the cross-screen rule). */
  const left = formatWindowLeft(msLeft);
  return (
    <div
      className="flex flex-wrap items-center justify-center gap-2 px-4 py-2 text-center text-[12.5px] font-semibold"
      style={{ background: ended ? '#F1F4F1' : warm ? '#FBF3E4' : brand.teal, color: ended ? '#6B6B6B' : warm ? '#8A5A16' : '#FFFFFF' }}
      role="status"
      aria-label={t('ariaEnds', { t: left })}
    >
      <Clock size={14} aria-hidden />
      <span>{ended ? t('windowEnded') : warm ? t('endingSoon') : t('orderingWindow')}</span>
      {!ended && (
        <span className="font-mono tabular-nums">{left}</span>
      )}
      <span className="text-[11.5px] font-medium opacity-90">{ended ? t('windowEndedHint') : t('rescanHint')}</span>
    </div>
  );
}

/* The dish's face (v5.49.0, pairs with migration 036): menu items can carry a
   photo, and the guest's phone is the whole reason the owner took it. Rules
   borrowed from the café logo tile (v5.27): a URL that fails to load hides
   its own tile — never a broken-image glyph on a menu a guest is holding.
   The box is FIXED-SIZE with a cream floor, so the row never reflows while
   the bytes arrive; loading="lazy" because a phone on café wifi should not
   fetch forty photos to show one category. */
function DishPhoto({ url, alt, shape }: { url: string; alt: string; shape: 'thumb' | 'banner' }): React.ReactElement | null {
  const [broken, setBroken] = useState(false);
  useEffect(() => {
    setBroken(false);
  }, [url]);
  if (broken) return null;
  if (shape === 'banner') {
    return (
      <span className="mb-3 block overflow-hidden rounded-2xl border border-[#E3E7E0] bg-[#F6F5F2] shadow-sm">
        <img
          src={url}
          alt={alt}
          loading="lazy"
          decoding="async"
          className="h-28 w-full object-cover sm:h-32"
          onError={() => setBroken(true)}
        />
      </span>
    );
  }
  return (
    <span className="relative block h-14 w-14 shrink-0 overflow-hidden rounded-2xl border border-[#E3E7E0] bg-[#F6F5F2] shadow-sm transition-colors group-hover:border-[#D9C48A]">
      <img
        src={url}
        alt={alt}
        loading="lazy"
        decoding="async"
        className="h-full w-full object-cover"
        onError={() => setBroken(true)}
      />
    </span>
  );
}

function Customizer({ item, onAdd, locked, lockedLabel }: { item: GuestMenuItem; onAdd: (l: Omit<CartLine, 'key'>) => void; locked?: boolean; lockedLabel?: string }): React.ReactElement {
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
      {item.image_url && <DishPhoto url={item.image_url} alt={item.name} shape="banner" />}
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
                      {/* 5.139.0 — money() like every other price the guest file
                          renders: "+₹10.5" was paise-ambiguous money text. */}
                      {v.price_delta > 0 ? `+${money(v.price_delta)}` : `−${money(-v.price_delta)}`}
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
                  {/* 5.139.0 — the chip speaks the file's own money() helper like
                      the dish prices and cart rows already do: "₹49.5" was
                      paise-ambiguous money text inside the file's own grammar. */}
                  <span className={active ? 'text-[#E7C878]' : 'text-[#B88E2F]'}>+{money(a.price)}</span>
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
          <Plus size={15} aria-hidden /> {locked ? (lockedLabel ?? t('orderingPaused')) : t('addToOrder', { amt: money(unit * qty) })}
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
  /* v5.253.0 — the guest's latest ticket from THIS tab's own checkout, read
   * once at mount (sessionStorage is per-tab; no other tab can gain a key). */
  const [lastTicket] = useState(() => readLastTicket(qrToken));
  /* v5.254.0 — the kitchen's ears: the order-level note, read once, kept
   * beside the cart. */
  const [orderNote, setOrderNote] = useState(() => readOrderNote(qrToken));
  const changeNote = (v: string) => {
    setOrderNote(v);
    try {
      sessionStorage.setItem(ORDER_NOTE_KEY(qrToken), v); // kept with the food
    } catch {
      /* private mode — the word just lives in the field */
    }
  };
  const [lockTone, setLockTone] = useState<'clock' | 'cut'>('clock');
  /* 5.216.0 — the ribbon's freshest SERVER verdict: { when it landed, seconds
     it said were left }. The 30s re-verify tick writes it; the 1s ribbon tick
     interpolates from it. A fail-soft tick (ok without a number) leaves this
     untouched — silence from the network is never read as zero. */
  const [serverAnchor, setServerAnchor] = useState<{ at: number; seconds: number } | null>(null);
  /* 5.250.0 — the window's word reaches the cart. msLeft is the page's OWN
     state now: ONE 1s interval derives it (below), the ribbon renders it,
     and — the round's point — the ordering machinery (addLine, the
     customizer's lock, the drawer's place button) speaks the SAME number.
     Before this round the ribbon went grey at zero while every button below
     kept taking orders, and the guest's first word came from the SERVER'S
     rejection at checkout — a full cart journey into a rescan dead end.
     The cart is kept (sessionStorage) — the note says so, honestly. */
  const [msLeft, setMsLeft] = useState<number | null>(() => (sessionToken ? windowLeft(sessionToken, serverAnchor) : null));
  const [lines, setLines] = useState<CartLine[]>(() => {
    try {
      const raw = sessionStorage.getItem(CART_KEY(qrToken));
      return raw ? (JSON.parse(raw) as CartLine[]) : [];
    } catch {
      return [];
    }
  });
  const [query, setQuery] = useState('');
  /* Veg-only (v5.53.0) — India's dietary identity is a filter, not a footnote.
     Guests scanning the table QR decide with it; the mark grammar below is
     the same square-and-dot the rows already speak. */
  const [vegOnly, setVegOnly] = useState(false);
  const [openItemId, setOpenItemId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  /* v5.110.0 — the guest's cart holds the door too: desktop QR users get
     Escape, a trapped Tab, and focus returned to the bar that opened it. */
  const cartDlgRef = useDialogA11y<HTMLDivElement>(() => setDrawerOpen(false), drawerOpen && phase === 'ready');
  const [customerName, setCustomerName] = useState('');
  const [placing, setPlacing] = useState(false);
  const [placeError, setPlaceError] = useState<string | null>(null);
  /* v5.58.0 — the stale line owns its fault. After the server bounces the
     order with ITEM_UNAVAILABLE, cart lines whose dish vanished from the
     fresh bundle get marked HERE — the drawer shows the badge, the guest
     removes in one tap, the retry is clean. */
  const [staleIds, setStaleIds] = useState<ReadonlySet<string>>(new Set());
  const [offers, setOffers] = useState<PublicOffer[]>([]);
  const [selectedOfferId, setSelectedOfferId] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem(OFFER_KEY(qrToken)) || null;
    } catch {
      return null;
    }
  });

  /* 5.249.0 — the load chain is ONE runnable: the effect calls it, and the
     error card's Try again calls it again. The menu used to dead-end on a
     Wi-Fi blip — the network's own message said "Check your connection and
     try again" while the card offered no way to (the gate's session card had
     the button from birth; the menu's never did). The busy word rides the
     card while the chain re-runs. */
  const [loadBusy, setLoadBusy] = useState(false);
  const run = useCallback((): (() => void) => {
    let alive = true;
    setLoadBusy(true);
    (async () => {
      try {
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
      } finally {
        if (alive) setLoadBusy(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [qrToken, t]);

  useEffect(() => run(), [run]);

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

  // 5.250.0 — the page's ONE 1s tick: windowLeft is the same single
  // arithmetic the ribbon always used (one window arithmetic, never two),
  // now derived at the page render boundary so the drawer and the grid
  // re-derive every second too. A server anchor that says the window lives
  // again (a drifted phone clock) re-arms EVERYTHING — buttons included —
  // within one second; the word appears AND leaves.
  useEffect(() => {
    if (phase !== 'ready' || !sessionToken) return;
    setMsLeft(windowLeft(sessionToken, serverAnchor));
    const t1 = window.setInterval(() => setMsLeft(windowLeft(sessionToken, serverAnchor)), 1000);
    return () => window.clearInterval(t1);
  }, [phase, sessionToken, serverAnchor]);

  // Session re-verify (v5.24.0, migration 023) — the server, not this phone's
  // clock, decides whether the window is still open. A staff cut from the
  // floor locks the menu within one 30s tick; a network hiccup never locks a
  // paying guest (fail-soft, retried next tick).
  useEffect(() => {
    if (phase !== 'ready' || !sessionToken) return;
    const token = sessionToken.session_token;
    const verify = () => {
      void verifyTableSession(token).then((r) => {
        // the server's own remaining-seconds (5.216.0) — only a verdict with a
        // finite number re-anchors the ribbon; a fail-soft ok keeps the last one
        if (r.ok && typeof r.remainingSeconds === 'number') {
          setServerAnchor({ at: Date.now(), seconds: r.remainingSeconds });
        }
        if (!r.ok) lockGuest(r.reason || 'unknown');
      });
    };
    const iv = window.setInterval(verify, 30000);
    /* v5.261.0 — the window's word wakes when the guest does: a throttled
     * background tab could hold armed buttons in front of a returning guest
     * while the floor already cut the session. Visibility wakes the verify —
     * the anchor re-lands and the page's own 1s tick re-derives the band
     * within one beat (the server's word at checkout stays the hard stop). */
    const wake = () => {
      if (document.visibilityState !== 'visible') return;
      verify();
    };
    document.addEventListener('visibilitychange', wake);
    return () => {
      window.clearInterval(iv);
      document.removeEventListener('visibilitychange', wake);
    };
  }, [phase, sessionToken, lockGuest]);

  // 5.250.0 — the ordering machinery speaks the window: a dead window accepts
  // nothing, the same law the ribbon already rendered. The server's verdict
  // at checkout stays byte-true as the hard stop — this is the courtesy that
  // saves the cart journey, not a replacement of the server's word.
  const windowEnded = msLeft !== null && msLeft <= 0;
  // 5.251.0 — the WARM band climbs off the ribbon too: `endingSoon` used to
  // live and die inside the ribbon (the exact disease 5.250.0 cured for the
  // dead band, one band earlier) while the guest's eyes were on a full cart.
  // Same msLeft, same threshold constant (WARM_WINDOW_MS — one arithmetic),
  // derived HERE so the drawer and the FAB speak the ribbon's own amber
  // verdict. A warm window still ACCEPTS orders — this is the nudge, not a
  // lock; the server's word at checkout stays the hard stop.
  const windowWarmMs = msLeft !== null && msLeft > 0 && msLeft < WARM_WINDOW_MS ? msLeft : null;
  const windowWarm = windowWarmMs !== null;
  const addLine = useCallback(
    (l: Omit<CartLine, 'key'>) => {
      if (phase !== 'ready' || windowEnded) return; // locked windows accept nothing (v5.24.0); dead windows neither (5.250.0)
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
      // a dish the guest can add is, by definition, live again — clear its mark
      setStaleIds((prev) => {
        if (!prev.has(l.item.id)) return prev;
        const next = new Set(prev);
        next.delete(l.item.id);
        return next;
      });
    },
    [phase, windowEnded],
  );

  /* Café logo (migration 024): the owner-set URL rides the menu payload. A
     URL that fails to load hides its own tile (never a broken-image glyph) —
     the text-only hero of every release before 5.27 stays the honest base. */
  const logoUrl = menu?.tenant?.logo_url || null;
  const [logoBroken, setLogoBroken] = useState(false);
  useEffect(() => {
    setLogoBroken(false);
  }, [logoUrl]);

  const filtered = useMemo(() => {
    if (!menu?.categories) return [];
    const q = query.trim().toLowerCase();
    let cats = menu.categories;
    if (vegOnly) {
      cats = cats
        .map((c) => ({ ...c, items: c.items.filter((i) => i.is_veg) }))
        .filter((c) => c.items.length > 0);
    }
    if (!q) return cats;
    return cats
      .map((c) => ({ ...c, items: c.items.filter((i) => `${i.name} ${i.description || ''}`.toLowerCase().includes(q)) }))
      .filter((c) => c.items.length > 0);
  }, [menu, query, vegOnly]);

  /* honest count of vegetarian dishes across the whole menu — the toggle's
     count chip only ever shows what the kitchen actually said is veg */
  const vegCount = useMemo(
    () => (menu?.categories ?? []).reduce((s, c) => s + c.items.filter((i) => i.is_veg).length, 0),
    [menu],
  );

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
  /* v5.214.0 — the bar's fit: the best live offer for this line set, the
     counter pill's exact grammar (offerFit picks it — best take wins,
     closest threshold speaks among unlocks). The register is the screen's
     ONE offers read; the applied id is the guest's own selection. */
  const fit = useMemo(
    () => offerFit(offers, cartSubtotal, selectedOfferId),
    [offers, cartSubtotal, selectedOfferId],
  );

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
      notes: orderNote.trim() || null, // v5.254.0 — the kitchen's ears, finally wired
      clientOperationId: crypto.randomUUID(),
      offerId: selectedOffer && offerReady ? selectedOffer.id : null,
      sessionToken: sessionToken?.session_token ?? null,
    });
    if (!res.is_valid || !res.order) {
      setPlaceError(res.message || t('orderFail'));
      // a stale offer (paused mid-session) drops off so the retry is clean
      if (res.error === 'OFFER_INVALID') setSelectedOfferId(null);
      // v5.58.0 — the kitchen moved faster than this cart. Re-fetch the live
      // bundle (available items only, server-side), mark every line whose
      // dish vanished, and let the menu grid speak the same truth. The
      // server's own message stays the voice of the banner; the badge below
      // just shows WHERE the problem lives. Fail-soft: a refresh hiccup
      // keeps the banner alone — never invents a stale mark.
      if (res.error === 'ITEM_UNAVAILABLE' && resolved) {
        const fresh = await fetchPublicMenu(resolved.slug).catch(() => null);
        if (fresh?.is_valid && fresh.categories) {
          const live = new Set<string>();
          for (const c of fresh.categories) for (const it of c.items) live.add(it.id);
          setStaleIds(new Set(lines.filter((l) => !live.has(l.item.id)).map((l) => l.item.id)));
          setMenu(fresh);
        }
      }
      setPlacing(false);
      if (res.error === 'SESSION_CLOSED') {
        // the window died mid-checkout (staff cut or the clock) — no silent
        // retry, no auto-reopen: the cut must hold. The guest rescans.
        lockGuest(res.reason || 'unknown');
        return;
      }
      if (res.error === 'INVALID_TOKEN') {
        sessionStorage.removeItem(CART_KEY(qrToken));
        sessionStorage.removeItem(ORDER_NOTE_KEY(qrToken)); // the note goes with the cart
        sessionStorage.removeItem(LAST_ORDER_KEY(qrToken)); // the token died — the memory goes with it
        window.location.assign(`/t/${encodeURIComponent(qrToken)}`);
      }
      return;
    }
    sessionStorage.removeItem(CART_KEY(qrToken));
    sessionStorage.removeItem(ORDER_NOTE_KEY(qrToken)); // the note rode to the server — the field starts fresh
    try {
      sessionStorage.setItem(LAST_ORDER_KEY(qrToken), JSON.stringify({ id: res.order.id, n: res.order.order_number }));
    } catch {
      /* private mode — no memory, no chip; the ticket page still found its way */
    }
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
          <GuestErrorCard title={t('menuUnavailable')} body={errorBody} busy={loadBusy} onRetry={() => run()} />
        </main>
        <GuestFooter />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#F6F5F2]">
      {sessionToken && <SessionRibbon session={sessionToken} msLeft={msLeft} ended={windowEnded} warm={windowWarm} />}

      {/* brand hero */}
      <header className="px-4 pb-4 pt-6" style={{ background: `linear-gradient(160deg, ${brand.teal} 0%, #14514f 100%)` }}>
        <div className="mx-auto flex max-w-xl items-start justify-between gap-3">
          <div>
            {logoUrl && !logoBroken && (
              <img
                src={logoUrl}
                alt=""
                aria-hidden
                onError={() => setLogoBroken(true)}
                className="mb-2.5 h-14 w-14 rounded-2xl bg-white/95 object-contain p-1 shadow-sm"
              />
            )}
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
          {/* Veg-only (v5.53.0): the FSSAI square-and-dot as a filter — ON
              fills the green tint; the count chip only ever shows dishes the
              kitchen actually marked veg. */}
          <button
            type="button"
            onClick={() => setVegOnly((v) => !v)}
            aria-pressed={vegOnly}
            aria-label={t('vegOnlyAria')}
            title={t('vegOnlyAria')}
            className={`flex h-12 shrink-0 items-center gap-2 rounded-full border bg-white pl-3 pr-3.5 text-[13px] font-semibold shadow-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#B88E2F] ${
              vegOnly
                ? 'border-[#2E7D32] text-[#1F5C26]'
                : 'border-[#E3E7E0] text-[#6B6B6B] hover:border-[#2E7D32]'
            }`}
          >
            <span
              aria-hidden
              className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border ${
                vegOnly ? 'border-[#2E7D32] bg-[#EAF4EB]' : 'border-[#9AA8A0]'
              }`}
            >
              <span className="h-2 w-2 rounded-full bg-[#2E7D32]" />
            </span>
            {t('vegOnly')}
            {vegOnly && vegCount > 0 && (
              <span className="rounded-full bg-[#EAF4EB] px-1.5 py-px text-[10.5px] font-bold text-[#1F5C26]">
                {vegCount}
              </span>
            )}
          </button>
          <LangSwitcher dark />
        </div>
      </header>

      <main className="mx-auto w-full max-w-xl flex-1 px-4 pb-36 pt-4">
        <GuestNetBand />
        {/* v5.253.0 — the ticket's word reaches the menu: the guest's latest
            ticket (from THIS tab's own checkout) rides a slim chip above the
            category rail. The chip claims NOTHING about the kitchen — the
            ticket page speaks the live state; this only points the way back
            (5.252.0's loop, closed). No memory, no chip. */}
        {phase === 'ready' && lastTicket && (
          <button
            type="button"
            onClick={() => window.location.assign(`/track/${lastTicket.id}`)}
            className="mb-4 flex w-full items-center gap-2.5 rounded-2xl border border-[#E3E7E0] bg-white px-4 py-3 text-left shadow-sm transition-colors hover:border-[#B88E2F] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B88E2F]"
            aria-label={t('lastTicketAria', { n: String(lastTicket.n) })}
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full" style={{ background: '#FBF3E4' }}>
              <ReceiptText size={15} className="text-[#8A5A16]" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-bold text-[#1A1A1A]">{t('lastTicketTitle', { n: lastTicket.n })}</span>
              <span className="block text-[11.5px] text-[#6B6B6B]">{t('lastTicketSub')}</span>
            </span>
            <ChevronRight size={16} className="shrink-0 text-[#9A9A9A]" aria-hidden />
          </button>
        )}
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
                /* v5.213.0 — the savings preview: what this offer takes off
                   the line set AS IT STANDS (₹0 while locked — the arithmetic
                   guards the threshold, the preview never lies). */
                const take = offerDiscount(o, cartSubtotal);
                const addMore = t('offerAddMore', { amt: money(round2(Math.max(min - cartSubtotal, 0))) });
                return (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => toggleOffer(o.id)}
                    aria-pressed={selected}
                    /* v5.213.0 — the aria speaks EVERY state the sighted read
                       (5.212's own lesson: aria-label REPLACES content — a
                       state the aria omits is a state the SR never hears): */
                    aria-label={`${o.title} — ${offerRuleLabel(o)}${
                      selected && unlockable
                        ? ` — ${t('offerApplied')}`
                        : unlockable
                          ? take > 0
                            ? ` — ${t('offerSaves', { amt: money(take) })}`
                            : ` — ${t('offerTap')}`
                          : ` — ${addMore}`
                    }`}
                    className={`relative flex min-w-[240px] max-w-[300px] flex-1 items-center gap-3 rounded-2xl border px-3.5 py-3 text-left shadow-sm transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#B88E2F] ${
                      selected
                        ? 'border-[#B88E2F] bg-white ring-2 ring-[#B88E2F]'
                        : 'border-[#EED9B8] bg-gradient-to-br from-[#FBF3E4] to-[#F6EAD8] hover:border-[#B88E2F]'
                    }`}
                  >
                    {/* v5.212.0 — min-w + px, not a fixed w-9: a paise badge
                        ("₹44.50") needs room to breathe; the circle becomes
                        a pill without losing its seat at the chip's head. */}
                    <span
                      className="relative flex h-9 min-w-9 shrink-0 items-center justify-center rounded-xl px-1 text-[11px] font-bold leading-none text-white"
                      style={{ background: selected ? brand.teal : '#B88E2F' }}
                    >
                      {offerBadgeShort(o)}
                      {selected && (
                        <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full border-2 border-white bg-[#2E7D32]">
                          <Check size={9} className="text-white" aria-hidden />
                        </span>
                      )}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[12.5px] font-bold text-[#5B4300]">{o.title}</span>
                      <span className="block truncate text-[11px] text-[#8A5A00]">
                        {offerRuleLabel(o)}
                        {o.description ? ` — ${o.description}` : ''}
                      </span>
                      <span
                        className={`mt-0.5 block text-[10.5px] font-semibold tabular-nums ${
                          selected && unlockable ? 'text-[#2E7D32]' : unlockable ? 'text-[#967221]' : 'text-[#B4483C]'
                        }`}
                      >
                        {selected && unlockable
                          ? `✓ ${t('offerApplied')}`
                          : unlockable
                            ? take > 0
                              ? t('offerSaves', { amt: money(take) })
                              : t('offerTap')
                            : addMore}
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

        {phase === 'ready' && filtered.length === 0 && (
          <p className="mt-10 text-center text-[13.5px] text-[#6B6B6B]">
            {vegOnly
              ? query.trim()
                ? t('nothingMatchesVeg', { q: query })
                : t('vegEmpty')
              : t('nothingMatches', { q: query })}
          </p>
        )}

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
                      className="group flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-[#FBFBF9] focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-[#B88E2F]"
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
                      {item.image_url && <DishPhoto url={item.image_url} alt={item.name} shape="thumb" />}
                    </button>
                    {open && (
                      <div className="px-4 pb-4">
                        <Customizer item={item} onAdd={addLine} locked={phase !== 'ready' || windowEnded} lockedLabel={windowEnded ? t('windowEndedCta') : undefined} />
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
          {/* v5.214.0 — the bar's fit whisper, always visible (guests are on
              phones — the counter's hidden-sm:inline chip would never show
              here). The state colors are the chips' own palette: applied
              green, applies gold, unlock red. tabular-nums so the money
              holds still while the cart moves. */}
          {fit && (
            <p
              className={`mx-auto mb-1.5 max-w-xl text-[11.5px] font-semibold tabular-nums ${
                fit.kind === 'applied'
                  ? 'text-[#2E7D32]'
                  : fit.kind === 'applies'
                    ? 'text-[#967221]'
                    : 'text-[#B4483C]'
              }`}
              style={{ animation: 'spFadeIn 200ms ease-out' }}
            >
              {offerFitVoice(fit)}
            </p>
          )}
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label={`${t('viewOrder', { amt: money(cartTotal) })}${fit ? `, ${offerFitVoice(fit)}` : ''}${windowWarm ? `, ${t('windowWarmFab')}` : ''}`}
            className="mx-auto flex w-full max-w-xl items-center justify-between rounded-full px-5 text-white shadow-lg transition-opacity hover:opacity-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B88E2F]"
            style={{ background: brand.teal, height: 52 }}
          >
            <span className="flex items-center gap-2 text-[13.5px] font-semibold">
              <ShoppingBag size={16} aria-hidden />
              {t('nItems', { n: cartCount, s: cartCount > 1 ? 's' : '' })}
              {/* 5.251.0 — the warm band's pulse rides the FAB: the gold dot
                  is the stepper's "still trying" energy (5.248's pager chip
                  language) borrowed for "still open — but draining". The
                  money stays calm (teal); the urgency is a word in the
                  aria-label + a dot, never a recolor of the price. */}
              {windowWarm && (
                <span
                  aria-hidden
                  className="h-1.5 w-1.5 animate-pulse rounded-full"
                  style={{ background: brand.gold }}
                />
              )}
            </span>
            <span className="text-[14px] font-bold">{t('viewOrder', { amt: money(cartTotal) })}</span>
          </button>
        </div>
      )}

      {/* cart drawer */}
      {drawerOpen && phase === 'ready' && (
        <div ref={cartDlgRef} className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={t('yourOrder')}>
          <button
            type="button"
            aria-label={t('closeCart')}
            onClick={() => setDrawerOpen(false)}
            className="absolute inset-0 h-full w-full cursor-default bg-[#0F3D3E]/45 focus-visible:outline-none"
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
              {lines.map((l) => {
                const stale = staleIds.has(l.item.id);
                return (
                  <div
                    key={l.key}
                    className={`rounded-xl py-3 transition-colors ${
                      stale
                        ? 'mt-2 border border-[#F3D8D4] bg-[#FDF3F2]/70 px-3 first:mt-0'
                        : 'border-b border-[#F0F2EE] px-0 last:border-0'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className={`text-[14px] font-semibold ${stale ? 'text-[#6B6B6B]' : 'text-[#1A1A1A]'}`}>
                          {l.qty} × {l.item.name}
                        </p>
                        {stale && (
                          <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[10px] font-bold tracking-[0.06em] text-[#B4483C]">
                            <CircleOff size={10} aria-hidden />
                            {t('justSoldOut')}
                          </p>
                        )}
                        {l.variant && <p className="text-[12.5px] text-[#6B6B6B]">{l.variant.name}</p>}
                        {l.addons.length > 0 && <p className="text-[12.5px] text-[#6B6B6B]">+ {l.addons.map((a) => a.name).join(', ')}</p>}
                        {l.notes && <p className="mt-0.5 text-[12px] italic text-[#8A5A16]">↳ {l.notes}</p>}
                      </div>
                      <div className="shrink-0 text-right">
                        <p className={`text-[14px] font-bold ${stale ? 'text-[#969696]' : 'text-[#1A1A1A]'}`}>{money(lineUnit(l) * l.qty)}</p>
                        <button
                          type="button"
                          onClick={() => setLines((prev) => prev.filter((x) => x.key !== l.key))}
                          className={`mt-1 text-[11.5px] font-medium hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#967221] ${stale ? 'font-bold text-[#B4483C]' : 'text-[#B4483C]'}`}
                        >
                          {t('remove')}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

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

              {/* v5.212.0 — the drawer's honest state line. An offer the guest
                  picked but hasn't unlocked used to sit silently in the totals:
                  the discount line never came, the reason lived only in the
                  pill's hover title (a tooltip a thumb can never lift). The
                  line now speaks HERE — the i18n's own "add more" voice plus
                  the rule from the ONE composer ("Add ₹55.00 more to unlock —
                  ₹50.00 off over ₹300.00"). Selected-and-applied keeps the
                  green discount line below — one state, one voice, never both. */}
              {lines.length > 0 && selectedOffer && !offerReady && (
                <p
                  role="status"
                  className="mt-4 text-[12px] font-semibold text-[#B4483C]"
                  style={{ animation: 'spFadeIn 200ms ease-out' }}
                >
                  {t('offerAddMore', { amt: money(round2(Math.max(Number(selectedOffer.min_order_amount) - cartSubtotal, 0))) })}
                  {' — '}
                  {offerRuleLabel(selectedOffer)}
                </p>
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
                            {offerBadgeShort(o)}
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
                {/* 5.250.0 — the window's word INSIDE the drawer: the guest is
                    looking here when the clock hits zero, so the word is
                    spoken HERE, in the straggler amber (off-stage work
                    waiting for the rescan — the ledger's waiting language,
                    now the cart's too). role="status" so the appearance AND
                    the recovery (a server anchor that re-arms the window)
                    are both announced. */}
                {/* 5.251.0 — the WARM word reaches the cart: the ribbon's amber
                    band (endingSoon) used to be the only voice while the guest
                    sat on a full cart with the clock draining. Same straggler
                    ink as the ended note (one waiting language), with the
                    LIVE countdown OUTSIDE the role=status span — the word is
                    announced once on arrival, the clock ticks silently beside
                    it (an aria-live region must never inherit a 1s ticker). */}
                {windowWarmMs !== null && (
                  <div className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-[#F0E4C8] border-l-4 border-l-[#B45309] bg-[#FBF6EA] px-3 py-2 text-[12.5px] font-medium text-[#8A5A00]">
                    <span role="status">{t('windowWarmNote')}</span>
                    <span className="shrink-0 font-mono tabular-nums">{formatWindowLeft(windowWarmMs)}</span>
                  </div>
                )}
                {windowEnded && (
                  <p role="status" className="mt-3 rounded-xl border border-[#F0E4C8] border-l-4 border-l-[#B45309] bg-[#FBF6EA] px-3 py-2 text-[12.5px] font-medium text-[#8A5A00]">
                    {t('windowEndedNote')}
                  </p>
                )}
                <p className="mt-2 flex items-center gap-1.5 text-[11.5px] text-[#6B6B6B]">
                  <Wallet size={13} aria-hidden /> {t('payNote')}
                </p>
                {/* v5.254.0 — the kitchen's ears: an optional word rides the
                    whole order (allergies, spice, timing). The feedback
                    card's textarea language — one input shape across the
                    guest's surfaces. */}
                <div className="mt-3">
                  <label htmlFor="drawer-note" className="text-[11.5px] font-semibold text-[#6B6B6B]">
                    {t('drawerNoteLabel')}
                  </label>
                  <textarea
                    id="drawer-note"
                    rows={2}
                    maxLength={ORDER_NOTE_MAX}
                    value={orderNote}
                    onChange={(e) => changeNote(e.target.value)}
                    placeholder={t('drawerNotePh')}
                    className="mt-1.5 w-full resize-none rounded-2xl border border-[#E3E7E0] bg-[#FBF9F4] px-3.5 py-2.5 text-[13px] text-[#1A1A1A] placeholder:text-[#9A9A9A] focus:border-[#B88E2F] focus:outline-none focus:ring-2 focus:ring-[#B88E2F]/25"
                  />
                  <p className="mt-1 text-right text-[10.5px] tabular-nums text-[#9A9A9A]" aria-hidden>
                    {orderNote.length}/{ORDER_NOTE_MAX}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void placeOrder()}
                  disabled={placing || windowEnded}
                  className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-full text-[14px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B88E2F]"
                  style={{ background: brand.teal }}
                >
                  {placing ? t('sending') : windowEnded ? t('windowEndedCta') : t('placeOrder', { amt: money(cartTotal) })}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <GuestFooter legalTenant={menu?.tenant ?? null} />
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
  /* v5.256.0 — the thanks that stayed: server truth first (the day the
   * payload carries it again — 039 pending), the tab's own accepted act
   * second. The poll can no longer ask the guest to rate twice. */
  const [tab, setTab] = useState<GuestTabFeedback | null>(() => readGuestTabFeedback(order.id));
  const rated = order.feedback_rating ?? tab?.rating ?? null;
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
    /* v5.256.0 — ALREADY is acceptance, not failure: the ledger's
     * UNIQUE(order_id) answers a second submit with error 'ALREADY' — the
     * guest's voice REACHED the counter. The pre-256 chain (poll flips the
     * card back → guest rates again) read that as "Could not send your
     * rating" — an accusation where the truth was "already heard". The
     * thanks card shows the guest's own choice; the counter's verdict row
     * (this same release) reads the ledger — the truth where it matters. */
    if (res.is_valid || res.error === 'ALREADY') {
      const word = comment.trim() || null;
      writeGuestTabFeedback(order.id, picked, word); // the tab keeps its own accepted act
      setTab({ rating: picked, comment: word });
      onRated(picked); // the parent's summary also learns the rating
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
        {/* v5.256.0 — the guest hears their own word back: the tab kept what
            they wrote, so the thank-you speaks it — verbatim, never cut. */}
        {tab?.comment && (
          <p className="mt-2.5 break-words text-[12.5px] italic leading-relaxed text-[#6B6B6B]">
            “{tab.comment}”
          </p>
        )}
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

/* ── the ticket's way back (v5.252.0) ────────────────────────────────────────
 * After "Enjoy — pay at the counter" the second round — a café's most natural
 * guest act — had no button: the ticket's only exits were copy-link and home
 * (the QR check-in gate, the wrong destination for a seated guest). The
 * session cache is sessionStorage (per-tab by design), so the pill only speaks
 * where a session can actually be resumed: a fresh or reopened link shows
 * nothing and keeps the two honest exits — the button never claims a session
 * it cannot see. And routing to the menu promises nothing about the window:
 * the menu's own bands speak every session state (live / warm / ended —
 * 288/289/290's machinery) — the destination always tells its own truth, the
 * kept cart rides along (the sessionStorage promise, 289's law).
 */
const GUEST_SESSION_PREFIX = /^sp\.guest\.session\.(.+)$/;

function recoverGuestSessionToken(): string | null {
  try {
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      const m = k ? GUEST_SESSION_PREFIX.exec(k) : null;
      if (m) return m[1];
    }
  } catch {
    /* private mode — no session to recover, no pill */
  }
  return null;
}

/* ── v5.256.0 — the thanks that stayed ──────────────────────────────────────
 * The guest rates the visit; the acceptance comes back is_valid — and then
 * the ticket page's 10-second poll REPLACED the order with a payload that
 * carries no feedback_rating (025/037's rebuild of sp_get_public_order
 * dropped the 019 field; migration 039 sits ready to give it back). The
 * thanks card flipped back to the form: the guest was asked to rate what
 * they had already rated. The tab now keeps its own act: keyed by ORDER ID
 * (the ticket's own deed, not the session's), per-tab by design (the pill's
 * law — no other tab can claim this one's word), rating + the guest's own
 * word so the thank-you speaks it back. Server truth stays first choice the
 * day the payload carries it again; the tab's act covers the gap honestly —
 * and the resubmit it prevents was a replay-silent no-op anyway. */
interface GuestTabFeedback {
  rating: number;
  comment: string | null;
}

function readGuestTabFeedback(orderId: string): GuestTabFeedback | null {
  try {
    const raw = sessionStorage.getItem(`sp.guest.fb.${orderId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { rating?: unknown; comment?: unknown };
    const rating = Number(parsed.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) return null;
    return {
      rating,
      comment: typeof parsed.comment === 'string' && parsed.comment.trim().length > 0 ? parsed.comment : null,
    };
  } catch {
    return null; // unreadable → no tab act, the form asks honestly
  }
}

function writeGuestTabFeedback(orderId: string, rating: number, comment: string | null): void {
  try {
    sessionStorage.setItem(`sp.guest.fb.${orderId}`, JSON.stringify({ rating, comment }));
  } catch {
    /* private mode — the act lives in memory for this mount, nowhere else */
  }
}

export function GuestTrackPage({ orderId }: { orderId: string }): React.ReactElement {
  const { t } = useGuestLang();
  const uuidLike = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId);
  const [order, setOrder] = useState<GuestOrderSummary | null>(null);
  const [tenant, setTenant] = useState<GuestTenantBrand | null>(null);
  const [logoBroken, setLogoBroken] = useState(false);
  useEffect(() => setLogoBroken(false), [tenant?.logo_url]);
  const [state, setState] = useState<'loading' | 'ready' | 'bad' | 'net'>('loading');
  const [muted, setMuted] = useState(() => localStorage.getItem('sp.guest.chime') === 'off');
  const [copied, setCopied] = useState(false);
  /* v5.252.0 — read once at mount: sessionStorage is per-tab, no other tab can
   * gain a key into this one while the ticket is on screen. */
  const [moreToken] = useState(() => recoverGuestSessionToken());
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
      setTenant(res.tenant || null); // v5.28.0 — whose ticket this is
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
    /* v5.261.0 — one tick at a time: the loop's tick and a wake tick share
     * this gate, so the chime's prev guard is read exactly once per status
     * change (a wake and a loop tick racing would ring twice). */
    let busy = false;
    const runTick = (): Promise<void> => {
      if (!alive || busy) return Promise.resolve();
      busy = true;
      return tick().finally(() => {
        busy = false;
      });
    };
    const loop = () => {
      if (!alive) return;
      void runTick().finally(() => {
        if (alive) window.setTimeout(loop, 10000);
      });
    };
    loop();
    /* v5.261.0 — the pager wakes when the guest does: a background tab's
     * timers are throttled (clamped to 1/min, or paused outright), so the
     * guest who locks their phone while waiting returns to a stale stepper —
     * the kitchen's "ready" unseen, the chime late. Visibility and network
     * each wake the pager: an immediate tick the moment the page is seen
     * again (or the network returns). The wake rides the SAME tick — a call
     * that landed while away rings exactly once, on return. */
    const wake = () => {
      if (document.visibilityState !== 'visible') return;
      void runTick();
    };
    document.addEventListener('visibilitychange', wake);
    window.addEventListener('online', wake);
    return () => {
      alive = false;
      document.removeEventListener('visibilitychange', wake);
      window.removeEventListener('online', wake);
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

  /* 5.248.0 — the ticket's clock. The stamp speaks the café's wall clock in
   * the reporting zone (appTimezone() named HERE, at the call site — the
   * drawer doctrine: a guest abroad reads the café's clock, not their
   * phone's); the age re-derives at every render, so each 10-second tick
   * re-speaks it (the drawer-card law 5.179, the audit pair 5.246 — a
   * stored sentence re-rendered re-derives its time-truth). A future-dated
   * corrupt row ages to null and the pill speaks the stamp alone. */
  const placedStamp = order ? ticketPlacedStamp(order.created_at, appTimezone()) : '';
  const placedAge = order ? ticketAge(order.created_at) : null;
  const placedAgeWord =
    placedAge === null
      ? ''
      : placedAge.kind === 'now'
        ? t('ageNow')
        : placedAge.kind === 'min'
          ? t('ageMin', { n: placedAge.n })
          : placedAge.kind === 'days'
            ? t('ageD', { d: placedAge.d })
            : placedAge.m === 0
              ? t('ageH', { h: placedAge.h })
              : t('ageHm', { h: placedAge.h, m: placedAge.m });

  return (
    <div className="flex min-h-screen flex-col bg-[#F6F5F2]">
      <header className="px-4 pb-4 pt-5" style={{ background: `linear-gradient(160deg, ${brand.teal} 0%, #14514f 100%)` }}>
        {/* v5.28.0 (migration 025) — whose ticket this is: the café's name on
            every ticket, the logo tile when the owner set one. No brand in
            the payload → exactly the pre-5.28 header. A dead URL hides its
            own tile; the name never breaks. */}
        {tenant && (tenant.logo_url || tenant.name) && (
          <div className="mx-auto mb-3 flex max-w-xl items-center gap-2.5">
            {tenant.logo_url && !logoBroken && (
              <img
                src={tenant.logo_url}
                alt=""
                onError={() => setLogoBroken(true)}
                className="h-9 w-9 shrink-0 rounded-xl bg-white/95 object-contain p-1 shadow-sm"
              />
            )}
            {tenant.name && (
              <span className="truncate text-[12.5px] font-semibold tracking-[0.02em] text-white/85">
                {tenant.name}
              </span>
            )}
          </div>
        )}
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
            {order && (
              <p
                className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-white/85"
                title={t('autoUpdate')}
              >
                <Clock size={11} aria-hidden />
                <span>
                  {t('placedAt', { t: placedStamp })}
                  {placedAgeWord ? ` · ${placedAgeWord}` : ''}
                </span>
              </p>
            )}
            {/* 5.249.0 — the pager speaks its own silence: when the poll fails
                with a ticket on the page, the word below froze — say so. The
                chip wears the 287 pill's glass (one header language); the
                gold pulse is the phone's own "still trying" energy, the
                stepper's pulse voice. The next successful tick removes it —
                the loop never stopped (the 5.24 fail-soft law, guest side). */}
            {order && state === 'net' && (
              <p
                role="status"
                className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-white/85"
              >
                <CloudOff size={11} aria-hidden />
                <span className="inline-flex items-center gap-1">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: brand.gold }} aria-hidden />
                  {t('netStale')}
                </span>
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
        <GuestNetBand />
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
                      {/* v5.261.0 — the change is SEEN, not just read: the hint
                          remounts on every status change (key), so a wake
                          tick's catch-up rises instead of swapping. */}
                      <p
                        key={order.status}
                        className="text-[12px] text-[#6B6B6B]"
                        style={{ animation: 'spFadeIn 240ms ease-out both' }}
                      >{now ? (servedNow && paid ? t('flowServedPaidHint') : t(f.hintKey)) : done ? t('done') : t('waiting')}</p>
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
                {/* v5.254.0 — the note comes home: the order-level word the
                    guest wrote at checkout, spoken verbatim on the ticket in
                    the waiting ink (the straggler family — the guest's word
                    sits on the bill where the counter reads it too). An
                    empty/blank note renders nothing. */}
                {order.notes && order.notes.trim().length > 0 && (
                  <div className="mt-2 rounded-xl border border-[#F0E4C8] border-l-4 border-l-[#B45309] bg-[#FBF6EA] px-3 py-2.5">
                    <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8A5A00]">
                      <StickyNote size={11} aria-hidden /> {t('trackNoteLabel')}
                    </p>
                    <p className="mt-1 break-words text-[12.5px] leading-relaxed text-[#6B4A0E]">{order.notes}</p>
                  </div>
                )}
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
            <div className="mt-2 flex flex-wrap items-center justify-center gap-2 text-[11.5px] text-[#6B6B6B]">
              {/* v5.252.0 — the forward action takes the first seat and the
                  brand's voice (teal, the header's kin); the ghost pills stay
                  for the passive words. A cancelled ticket keeps the two
                  exits — a cut order's way back is the staff, not the menu. */}
              {moreToken && (
                <button
                  type="button"
                  onClick={() => window.location.assign(`/menu/${moreToken}`)}
                  aria-label={t('orderMore')}
                  title={t('orderMore')}
                  className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 font-semibold text-white shadow-sm transition-[filter] hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0F3D3E]"
                  style={{ background: brand.teal }}
                >
                  <UtensilsCrossed size={12} aria-hidden /> {t('orderMore')}
                </button>
              )}
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
      <GuestFooter legalTenant={tenant} />
    </div>
  );
}
