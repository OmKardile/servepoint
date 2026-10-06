import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  BellRing,
  ChevronDown,
  CircleHelp,
  KeyRound,
  LifeBuoy,
  MonitorSmartphone,
  QrCode,
  ShieldCheck,
  ShoppingBag,
  Star,
  UserCog,
  Users,
  Wallet,
} from 'lucide-react';
import brandMark from '../../assets/brand/mark.png';
import { APP_VERSION } from '../../version';

/**
 * /index-help — public getting-started guide for ServePoint — smartPOS.
 * Answers "what is this, who signs in, and how do I run my first order"
 * without ever printing a credential (accounts are provisioned — the
 * wizard hands owners their temporary password in person).
 */

const ROLES: { icon: React.ElementType; title: string; body: string }[] = [
  {
    icon: UserCog,
    title: 'Platform operator',
    body: 'The ServePoint team member who provisions each business: creates the workspace, its subscription and the owner sign-in with a temporary password. Signs into the Platform console.',
  },
  {
    icon: Users,
    title: 'Business owner',
    body: 'Runs the cafe: menu, orders, the kitchen rail, bills and team channels. Gets a workspace from the operator, signs in with the temporary password, then changes it in Settings.',
  },
  {
    icon: MonitorSmartphone,
    title: 'Staff',
    body: 'Added by the owner from Settings → Staff accounts. Works the counter and the kitchen board — placing orders, advancing tickets, taking payments.', // 5.140.0 — the tab is "Staff accounts"; the porch said "Team", a tab that does not exist,
  },
  {
    /* v5.264.0 — the fourth role: the guest's journey (QR → menu → ticket
     * → feedback) has been a whole surface of the house since the table
     * sessions shipped — the porch taught three roles and never said
     * their name. The guest has NO account: the table's QR is the only
     * door, the session window the only guard. */
    icon: QrCode,
    title: 'Guest',
    body: 'No account, no download — the table\u2019s QR code is the only door. Scans it, orders from the live menu, watches the ticket\u2019s stepper with a ready chime, pays at the counter and leaves the stars.',
  },
];

const STEPS: { title: string; body: string }[] = [
  {
    title: 'Sign in',
    body: 'Open the app and enter the owner credentials your administrator shared. Accounts are provisioned, not self-registered — there is no sign-up form by design.',
  },
  {
    title: 'Set up the menu',
    body: 'Go to Food & Drinks and add your categories and items — prices, veg marks and photos. This is what the counter sells from.',
  },
  {
    title: 'Place an order',
    body: 'Open a category, add items to the cart, review, choose dine-in / takeaway and place the order. The ticket lands in the cloud instantly.',
  },
  {
    title: 'Watch the Kitchen board',
    body: 'The new Kitchen screen shows the ticket the moment it exists — no refresh. Fire Start preparing → Mark ready → Complete as the food moves.',
  },
  {
    title: 'Charge the bill',
    body: 'In Bills, open the order, pick Cash / Card / UPI and charge. A ledger row is written and the order flips to Paid — a second charge is refused by the database.',
  },
  {
    title: 'Check the trail',
    body: 'Every status hop and payment is stamped with who and when — open the Timeline on any bill for the full audit history.',
  },
];

/* v5.264.0 — the guest's journey in five beats: the porch never taught the
 * QR flow (the whole surface the table sessions shipped). The beats carry
 * the house's own words — the live window, the session cart, the ready
 * chime, the honest bill, the day's voice. */
const GUEST_FLOW: { icon: React.ElementType; title: string; body: string }[] = [
  {
    icon: QrCode,
    title: 'Scan the table\'s QR',
    body: 'The table\'s code opens the live menu — no download, no sign-up. The ordering window is the session: the ribbon counts it down.',
  },
  {
    icon: ShoppingBag,
    title: 'Order from the live menu',
    body: 'Veg marks, photos and prices. The cart rides the session — step away and come back, your picks are still there.',
  },
  {
    icon: BellRing,
    title: 'Watch the ticket',
    body: 'A stepper follows the order — Placed, In the kitchen, Ready, Served — with a chime when it\'s ready, and an "Order more" pill for the second round.',
  },
  {
    icon: Wallet,
    title: 'Pay at the counter',
    body: 'The bill speaks the truth — DUE AT COUNTER until the money lands, then PAID — and the stepper\'s word agrees with it.',
  },
  {
    icon: Star,
    title: 'Leave the stars',
    body: 'The rating reaches the day\'s voice — the close-out reads the tone: guests love it, good — keep going, or listen up.',
  },
];

const FAQ: { q: string; a: string }[] = [
  {
    q: 'Why can\'t I create my own account?',
    a: 'ServePoint is a B2B platform — every workspace belongs to a real business with a paid or trial subscription. Your operator provisions the business and hands you credentials, which keeps stray sign-ups and orphan data out of the system.',
  },
  {
    q: 'Is my cafe\'s data isolated from other cafes?',
    a: 'Yes — at the database layer. Every table is protected by Postgres row-level security keyed to your tenant, so a query from another cafe physically cannot read or write your rows. Realtime streams are filtered the same way.',
  },
  {
    q: 'What stops a bill from being charged twice?',
    a: 'The payment RPC checks the order state inside the same transaction that writes the ledger row. A completed payment makes further charges impossible — the database refuses, not just the button.',
  },
  {
    q: 'Does the kitchen screen really update by itself?',
    /* v5.264.0 — the answer grows the wake's truth (301/302): the poll is
     * not the whole rhythm anymore — the boards wake the moment the staff
     * looks back at a backgrounded tablet. The porch's word stays true. */
    a: 'Yes. Orders and their items stream over a realtime connection the moment they change, a 30-second safety poll backs it up if the stream ever drops, and the boards wake the moment you look back at a backgrounded tablet — the chip in the header tells you which mode you\'re in.',
  },
  {
    q: 'I forgot my password. What now?',
    a: 'Your workspace owner can reset staff passwords from Settings → Staff accounts. If you are the owner, contact your ServePoint operator — they can issue you a fresh temporary sign-in.', // 5.140.0 — pointer healed,
  },
  {
    /* v5.264.0 — the guests' door gets its FAQ: the question every owner
     * asks when they hear "QR ordering". */
    q: 'How do guests order from their phones?',
    a: 'They scan the table\'s QR code — no app, no account. The menu page opens with a live ordering window, the cart rides the table\'s session, and the ticket page follows the order: a chime when it\'s ready, an "Order more" pill for the second round, and a star rating that reaches the day\'s close-out.',
  },
];

const FaqItem: React.FC<{ q: string; a: string; open: boolean; onToggle: () => void }> = ({ q, a, open, onToggle }) => (
  <div className="rounded-2xl border border-[#E3E7E0] bg-white">
    <button
      onClick={onToggle}
      aria-expanded={open}
      className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
    >
      <CircleHelp size={16} className="shrink-0 text-[#B88E2F]" aria-hidden />
      <span className="min-w-0 flex-1 text-[14px] font-semibold text-[#1A1A1A]">{q}</span>
      <ChevronDown
        size={16}
        className={`shrink-0 text-[#969696] transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        aria-hidden
      />
    </button>
    {open && <p className="px-4 pb-4 pl-[52px] text-[13px] leading-6 text-[#5B6B63]">{a}</p>}
  </div>
);

const IndexHelpPage: React.FC = () => {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  // v5.141.0 — the tab strip joins the title register (porch pages were mute).
  useEffect(() => {
    document.title = 'Help · ServePoint';
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-[#F6F5F2]">
      {/* ── Nav ── */}
      <header className="sticky top-0 z-20 border-b border-[#E3E7E0]/70 bg-[#F6F5F2]/90 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center gap-3 px-4 sm:px-6">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#F6F1E9] p-1">
            <img src={brandMark} alt="ServePoint logo" className="h-full w-full object-contain" />
          </span>
          <span className="text-[17px] font-semibold text-[#0F3D3E]">ServePoint</span>
          <span className="hidden rounded-full border border-[#B88E2F]/40 bg-[#B88E2F]/10 px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-[#7A5B18] sm:inline">
            Help
          </span>
          <nav className="ml-auto flex items-center gap-2" aria-label="Primary">
            {/* v5.285.0 — the pills wear shrink-0 whitespace-nowrap (the porch
                family's one narrow voice): the Showcase pill has hidden
                below sm since 5.2.1, and now NO width can wrap a pill's
                words into a clipped stack. */}
            <a
              href="/showcase"
              className="hidden h-9 shrink-0 items-center whitespace-nowrap rounded-full border border-[#E3E7E0] bg-white px-4 text-[13px] font-semibold text-[#0F3D3E] transition hover:border-[#C9CFC9] sm:flex"
            >
              Showcase
            </a>
            <a href="/" className="sp-cta flex h-9 shrink-0 items-center whitespace-nowrap rounded-full px-4 text-[13px]">
              Open the app
              <ArrowRight size={14} className="ml-1.5" aria-hidden />
            </a>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-16 pt-10 sm:px-6">
        {/* ── Hero ── */}
        <section aria-label="Introduction">
          <p className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.18em] text-[#B88E2F]">
            <LifeBuoy size={14} aria-hidden /> Getting started
          </p>
          <h1 className="mt-3 max-w-3xl font-serif text-[34px] italic leading-[1.1] text-[#0F3D3E] sm:text-[44px]">
            Everything you need to run your first order.
          </h1>
          <p className="mt-4 max-w-2xl text-[15px] leading-7 text-[#5B6B63]">
            ServePoint — smartPOS is a multi-tenant point of sale for India's cafes: the counter,
            the kitchen rail and the payment ledger in one tool, guarded end-to-end by the database.
          </p>
        </section>

        {/* ── Roles ── */}
        <section className="mt-12" aria-label="Who signs in">
          <h2 className="text-[18px] font-bold text-[#1A1A1A]">Who signs in</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {ROLES.map((r) => {
              const Icon = r.icon;
              return (
                <article key={r.title} className="rounded-2xl border border-[#E3E7E0] bg-white p-5">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0F3D3E] text-white">
                    <Icon size={18} aria-hidden />
                  </span>
                  <h3 className="mt-3 text-[14.5px] font-bold text-[#1A1A1A]">{r.title}</h3>
                  <p className="mt-1.5 text-[12.5px] leading-6 text-[#5B6B63]">{r.body}</p>
                </article>
              );
            })}
          </div>
        </section>

        {/* ── Golden path ── */}
        <section className="mt-12" aria-label="Your first order in six steps">
          <h2 className="text-[18px] font-bold text-[#1A1A1A]">Your first order in six steps</h2>
          <ol className="mt-4 grid gap-3 md:grid-cols-2">
            {STEPS.map((s, i) => (
              <li key={s.title} className="flex gap-3.5 rounded-2xl border border-[#E3E7E0] bg-white p-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#B88E2F] font-mono text-[13.5px] font-bold text-white">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <h3 className="text-[14px] font-bold text-[#1A1A1A]">{s.title}</h3>
                  <p className="mt-1 text-[12.5px] leading-6 text-[#5B6B63]">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* ── The guest's table ── */}
        {/* v5.264.0 — the porch learns the guest's way: the QR flow taught in
         * the porch's own card grammar, five beats, no jargon. */}
        <section className="mt-12" aria-label="The guest's table">
          <h2 className="text-[18px] font-bold text-[#1A1A1A]">The guest's table — no app, no account</h2>
          <p className="mt-2 max-w-2xl text-[13.5px] leading-7 text-[#5B6B63]">
            Dine-in guests don't sign in. A QR code on the table opens the menu page with a live
            ordering window — the ribbon counts the session down, the cart rides the session, and
            the ticket page follows the order until the bill is settled. When the window ends, the
            floor's own word closes it.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {GUEST_FLOW.map((b, i) => {
              const Icon = b.icon;
              return (
                <article key={b.title} className="rounded-2xl border border-[#E3E7E0] bg-white p-4">
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0F3D3E] text-white">
                      <Icon size={15} aria-hidden />
                    </span>
                    <span className="font-mono text-[12px] font-bold text-[#B88E2F]">{i + 1}</span>
                  </div>
                  <h3 className="mt-2.5 text-[13.5px] font-bold text-[#1A1A1A]">{b.title}</h3>
                  <p className="mt-1 text-[12px] leading-5 text-[#5B6B63]">{b.body}</p>
                </article>
              );
            })}
          </div>
        </section>

        {/* ── Owner / operator notes ── */}
        <section className="mt-12 grid gap-4 md:grid-cols-2" aria-label="For owners and operators">
          <article className="rounded-2xl border border-[#B88E2F]/30 bg-[#B88E2F]/6 p-5">
            <h2 className="flex items-center gap-2 text-[15px] font-bold text-[#1A1A1A]">
              <KeyRound size={16} className="text-[#7A5B18]" aria-hidden /> Getting your workspace
            </h2>
            <ul className="mt-3 space-y-2 text-[13px] leading-6 text-[#5B6B63]">
              <li>· Your ServePoint operator provisions the business and its owner sign-in.</li>
              <li>· You receive a temporary password in person — sign in with it once.</li>
              <li>· Change it in Settings right away; your session and data stay intact.</li>
              <li>· Add staff from Settings → Staff accounts when you're ready to go live.</li> {/* 5.140.0 — pointer healed */}
            </ul>
          </article>
          <article className="rounded-2xl border border-[#0F3D3E]/20 bg-[#0F3D3E]/4 p-5">
            <h2 className="flex items-center gap-2 text-[15px] font-bold text-[#1A1A1A]">
              <ShieldCheck size={16} className="text-[#0F3D3E]" aria-hidden /> How the platform is run
            </h2>
            <ul className="mt-3 space-y-2 text-[13px] leading-6 text-[#5B6B63]">
              <li>· Businesses are provisioned from the Platform console wizard.</li>
              <li>· Schema changes ship as idempotent migrations, applied from the CLI.</li>
              <li>· Statuses and money only move through guarded database functions.</li>
              <li>· Every hop lands in an append-only audit trail you can inspect.</li>
            </ul>
          </article>
        </section>

        {/* ── FAQ ── */}
        <section className="mt-12" aria-label="Frequently asked questions">
          <h2 className="text-[18px] font-bold text-[#1A1A1A]">Frequently asked</h2>
          <div className="mt-4 space-y-2.5">
            {FAQ.map((f, i) => (
              <FaqItem
                key={f.q}
                q={f.q}
                a={f.a}
                open={openFaq === i}
                onToggle={() => setOpenFaq(openFaq === i ? null : i)}
              />
            ))}
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="mt-12 rounded-3xl bg-[#0F3D3E] px-6 py-10 text-center" aria-label="Call to action">
          <h2 className="font-serif text-[26px] italic text-white sm:text-[30px]">
            That's the whole tour.
          </h2>
          <p className="mx-auto mt-2 max-w-md text-[13px] leading-6 text-white/70">
            Open the app, sign in with your provisioned credentials, and put a coffee through the
            loop — counter, kitchen, ledger — in under a minute.
          </p>
          <a href="/" className="sp-cta mt-6 inline-flex h-11 items-center rounded-full px-7 text-[14px]">
            Open the app
            <ArrowRight size={15} className="ml-2" aria-hidden />
          </a>
        </section>
      </main>

      {/* ── Sticky footer ── */}
      <footer className="mt-auto border-t border-[#E3E7E0]/70 bg-[#F6F5F2]">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-3 px-4 py-5 sm:px-6">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#F6F1E9] p-0.5">
            <img src={brandMark} alt="" aria-hidden className="h-full w-full object-contain" />
          </span>
          {/* 5.140.0 — the version token is gone (it read v5.2.0 for 137
              releases). 5.247.0 — the line speaks the DERIVED version (the
              battery pins all three porch footers to APP_VERSION). */}
          <p className="text-[12px] text-[#969696]">© 2026 ServePoint · smartPOS · v{APP_VERSION}</p>
          <nav className="ml-auto flex items-center gap-4 text-[12px] font-semibold text-[#0F3D3E]" aria-label="Footer">
            <a href="/" className="hover:underline hover:underline-offset-2">App</a>
            <a href="/showcase" className="hover:underline hover:underline-offset-2">Showcase</a>
            <a href="/index-help" className="hover:underline hover:underline-offset-2">Help</a>
          </nav>
        </div>
      </footer>
    </div>
  );
};

export default IndexHelpPage;
