import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  ChevronDown,
  CircleHelp,
  KeyRound,
  LifeBuoy,
  MonitorSmartphone,
  ShieldCheck,
  UserCog,
  Users,
} from 'lucide-react';
import brandMark from '../../assets/brand/mark.png';

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
    a: 'Yes. Orders and their items stream over a realtime connection the moment they change, and a 30-second safety poll backs it up if the stream ever drops — the chip in the header tells you which mode you\'re in.',
  },
  {
    q: 'I forgot my password. What now?',
    a: 'Your workspace owner can reset staff passwords from Settings → Staff accounts. If you are the owner, contact your ServePoint operator — they can issue you a fresh temporary sign-in.', // 5.140.0 — pointer healed,
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
            <a
              href="/showcase"
              className="hidden h-9 items-center rounded-full border border-[#E3E7E0] bg-white px-4 text-[13px] font-semibold text-[#0F3D3E] transition hover:border-[#C9CFC9] sm:flex"
            >
              Showcase
            </a>
            <a href="/" className="sp-cta flex h-9 items-center rounded-full px-4 text-[13px]">
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
              releases); the sidebar's footer line is the voice. */}
          <p className="text-[12px] text-[#969696]">© 2026 ServePoint · smartPOS</p>
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
