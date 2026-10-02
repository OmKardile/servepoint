import React from 'react';
import {
  ArrowRight,
  Building2,
  ChefHat,
  CircleCheck,
  LifeBuoy,
  MessageSquareText,
  Receipt,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import brandMark from '../../assets/brand/mark.png';
import brandArt from '../../assets/brand/hero-3d.jpg';

/**
 * /showcase — public product tour for ServePoint — smartPOS.
 * Unauthenticated marketing/overview surface: what the platform does, how it is
 * engineered, and where to go next (the app itself, or /index-help for a guide).
 * Brand: cream canvas, deep-teal anchors, gold actions (ADR brand rules).
 */

const FEATURES: { icon: React.ElementType; title: string; body: string; tint: string }[] = [
  {
    icon: Building2,
    title: 'Multi-tenant by design',
    body: 'Every cafe is an isolated workspace. The platform wizard provisions the business, its owner account, subscription and default team channels in one pass — row-level security keeps tenants strangers to each other.',
    tint: 'bg-[#0F3D3E]',
  },
  {
    icon: ShieldCheck,
    title: 'A guarded order engine',
    body: 'Statuses only move through a server-side RPC with a legal-transition map; every hop is stamped into an append-only audit trail. Illegal moves are rejected by Postgres, not by the UI.',
    tint: 'bg-[#B88E2F]',
  },
  {
    icon: ChefHat,
    title: 'Kitchen Display, live',
    body: 'A realtime rail for the pass — new tickets appear the instant they are placed. Per-second timers escalate green → amber → red, and completed cards mirror the money state from the counter.',
    tint: 'bg-[#C2571B]',
  },
  {
    icon: Receipt,
    title: 'Bills with a ledger',
    body: 'Charging writes an immutable payments ledger row and flips the order in one transaction. A double-charge is impossible — the database itself refuses the second payment.',
    tint: 'bg-[#2E7D32]',
  },
  {
    icon: MessageSquareText,
    title: 'Team messaging',
    body: 'Front of House and Kitchen channels ship with every workspace, so the pass and the counter stay in one tool instead of a WhatsApp group.',
    tint: 'bg-[#0F3D3E]',
  },
  {
    icon: Zap,
    title: 'Realtime everything',
    body: 'Postgres change streams push orders, items and payments to every open screen. The board refreshes itself — no pull-to-refresh, no stale rails.',
    tint: 'bg-[#B88E2F]',
  },
];

const STACK: string[] = [
  'React 19 + TypeScript',
  'Vite',
  'Supabase Postgres',
  'Row-Level Security',
  'Guarded RPCs',
  'Realtime streams',
  'Append-only audit trail',
  'Idempotent CLI migrations',
];

const ShowcasePage: React.FC = () => {
  return (
    <div className="flex min-h-screen flex-col bg-[#F6F5F2]">
      {/* ── Nav ── */}
      <header className="sticky top-0 z-20 border-b border-[#E3E7E0]/70 bg-[#F6F5F2]/90 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-3 px-4 sm:px-6">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#D9E2DD] p-1">
            <img src={brandMark} alt="ServePoint logo" className="h-full w-full object-contain" />
          </span>
          <span className="text-[17px] font-semibold text-[#0F3D3E]">ServePoint</span>
          <span className="hidden rounded-full border border-[#B88E2F]/40 bg-[#B88E2F]/10 px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-[#7A5B18] sm:inline">
            smartPOS
          </span>
          <nav className="ml-auto flex items-center gap-2" aria-label="Primary">
            <a
              href="/index-help"
              className="flex h-9 items-center rounded-full border border-[#E3E7E0] bg-white px-4 text-[13px] font-semibold text-[#0F3D3E] transition hover:border-[#C9CFC9]"
            >
              <LifeBuoy size={14} className="mr-1.5" aria-hidden />
              Help
            </a>
            <a href="/" className="sp-cta flex h-9 items-center rounded-full px-4 text-[13px]">
              Open the app
              <ArrowRight size={14} className="ml-1.5" aria-hidden />
            </a>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* ── Hero ── */}
        <section className="mx-auto w-full max-w-6xl px-4 pb-14 pt-12 sm:px-6 sm:pt-16" aria-label="Introduction">
          <p className="text-[12px] font-bold uppercase tracking-[0.18em] text-[#B88E2F]">
            The cafe operating system
          </p>
          <h1 className="mt-3 max-w-3xl font-serif text-[40px] italic leading-[1.08] text-[#0F3D3E] sm:text-[56px]">
            Run the counter, the kitchen and the books — from one screen.
          </h1>
          <p className="mt-5 max-w-2xl text-[15.5px] leading-7 text-[#5B6B63]">
            ServePoint is a multi-tenant point-of-sale for India's cafes. Owners sell in seconds,
            the kitchen watches a live rail, and every rupee lands in an immutable ledger —
            guarded by the database itself, not by promises in the UI.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <a href="/" className="sp-cta flex h-11 items-center rounded-full px-6 text-[14px]">
              Open the app
              <ArrowRight size={15} className="ml-2" aria-hidden />
            </a>
            <a
              href="/index-help"
              className="flex h-11 items-center rounded-full border border-[#0F3D3E]/25 bg-white px-6 text-[14px] font-semibold text-[#0F3D3E] transition hover:border-[#0F3D3E]/50"
            >
              How it works
            </a>
            <span className="flex items-center gap-1.5 text-[12.5px] font-medium text-[#969696]">
              <CircleCheck size={14} className="text-[#2E7D32]" aria-hidden />
              Accounts are provisioned, not self-registered
            </span>
          </div>
          <figure className="mt-10 overflow-hidden rounded-3xl border border-[#E3E7E0] shadow-[0_18px_50px_rgba(15,61,62,0.14)]">
            <img
              src={brandArt}
              alt="ServePoint 3D brand render"
              className="h-auto w-full object-cover"
              loading="eager"
            />
          </figure>
        </section>

        {/* ── Feature grid ── */}
        <section className="mx-auto w-full max-w-6xl px-4 pb-16 sm:px-6" aria-label="Features">
          <h2 className="font-serif text-[28px] italic text-[#0F3D3E] sm:text-[34px]">
            Everything a cafe needs, nothing it doesn't.
          </h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <article
                  key={f.title}
                  className="group rounded-2xl border border-[#E3E7E0] bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(15,61,62,0.10)]"
                >
                  <span className={`flex h-10 w-10 items-center justify-center rounded-xl text-white ${f.tint}`}>
                    <Icon size={18} aria-hidden />
                  </span>
                  <h3 className="mt-3.5 text-[15.5px] font-bold text-[#1A1A1A]">{f.title}</h3>
                  <p className="mt-1.5 text-[13px] leading-6 text-[#5B6B63]">{f.body}</p>
                </article>
              );
            })}
          </div>
        </section>

        {/* ── Engineering strip ── */}
        <section className="bg-[#0F3D3E]" aria-label="Engineering">
          <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
            <h2 className="font-serif text-[26px] italic text-white sm:text-[32px]">
              Serious under the hood.
            </h2>
            <p className="mt-2 max-w-2xl text-[13.5px] leading-6 text-white/70">
              Ten idempotent migrations shape the schema; every write that matters goes through a
              SECURITY DEFINER RPC with a membership check; status changes are append-only history.
            </p>
            <ul className="mt-6 flex flex-wrap gap-2">
              {STACK.map((s) => (
                <li
                  key={s}
                  className="rounded-full border border-white/15 bg-white/8 px-3.5 py-1.5 text-[12.5px] font-medium text-white/85"
                >
                  {s}
                </li>
              ))}
            </ul>
            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {[
                { k: '10', v: 'idempotent migrations applied from the CLI' },
                { k: '2', v: 'guarded engine RPCs — the only write path for status & money' },
                { k: '0', v: 'mock data paths — every screen reads the live cloud' },
              ].map((s) => (
                <div key={s.k} className="rounded-2xl border border-white/10 bg-white/6 p-4">
                  <p className="font-serif text-[30px] italic text-[#E8C97A]">{s.k}</p>
                  <p className="mt-1 text-[12.5px] leading-5 text-white/70">{s.v}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Closing CTA ── */}
        <section className="mx-auto w-full max-w-6xl px-4 py-14 text-center sm:px-6" aria-label="Get started">
          <h2 className="font-serif text-[28px] italic text-[#0F3D3E] sm:text-[34px]">
            Ready to see it run?
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-[14px] leading-6 text-[#5B6B63]">
            Sign in and put a cup of coffee through the whole loop — counter to kitchen to ledger —
            in under a minute.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <a href="/" className="sp-cta flex h-11 items-center rounded-full px-7 text-[14px]">
              Open the app
              <ArrowRight size={15} className="ml-2" aria-hidden />
            </a>
            <a
              href="/index-help"
              className="flex h-11 items-center rounded-full border border-[#0F3D3E]/25 bg-white px-7 text-[14px] font-semibold text-[#0F3D3E] transition hover:border-[#0F3D3E]/50"
            >
              Read the guide
            </a>
          </div>
        </section>
      </main>

      {/* ── Sticky footer ── */}
      <footer className="mt-auto border-t border-[#E3E7E0]/70 bg-[#F6F5F2]">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-3 px-4 py-5 sm:px-6">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#D9E2DD] p-0.5">
            <img src={brandMark} alt="" aria-hidden className="h-full w-full object-contain" />
          </span>
          <p className="text-[12px] text-[#969696]">© 2026 ServePoint · smartPOS · v5.2.0</p>
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

export default ShowcasePage;
