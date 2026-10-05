import React, { useEffect } from 'react';
import { ArrowLeft, ArrowRight, LifeBuoy, MapPin } from 'lucide-react';
import brandMark from '../../assets/brand/mark.png';
import { APP_VERSION } from '../../version';

/**
 * NotFoundPage (v5.141.0) — the honest 404.
 *
 * Until this page existed, every unknown address silently fell through to the
 * login screen (or, signed in, straight into the staff app) — the URL was
 * swallowed with zero acknowledgment. A visitor who followed a mistyped or
 * rotted link could not tell whether the product was broken or whether they
 * merely needed to sign in. Now any path that isn't the staff root, a porch
 * page or a guest surface lands here: the porch's own register (cream canvas,
 * serif-italic headline, gold actions), the exact address echoed back, and
 * three real doors out. No demo content, no fake apology — just the truth:
 * this address leads nowhere, the house is fine, here is where it lives.
 */

const NotFoundPage: React.FC<{ path?: string }> = ({ path }) => {
  // The tab strip joins the title register (App.tsx 5.105, AuthScreen 5.32.0):
  // a lost tab reads "Not found · ServePoint", never a screen it isn't showing.
  useEffect(() => {
    document.title = 'Not found · ServePoint';
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-[#F6F5F2]">
      {/* ── Nav — the porch's own header voice ── */}
      <header className="sticky top-0 z-20 border-b border-[#E3E7E0]/70 bg-[#F6F5F2]/90 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-3 px-4 sm:px-6">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#F6F1E9] p-1">
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

      <main className="flex flex-1 items-center justify-center px-4 py-16 sm:px-6">
        <section
          className="w-full max-w-2xl text-center"
          aria-labelledby="notfound-heading"
        >
          <p className="text-[12px] font-bold uppercase tracking-[0.18em] text-[#B88E2F]">
            This address leads nowhere
          </p>
          <p
            className="mt-4 font-serif text-[56px] italic leading-none text-[#0F3D3E]/15 sm:text-[72px]"
            aria-hidden
          >
            404
          </p>
          <h1
            id="notfound-heading"
            className="mt-2 font-serif text-[34px] italic leading-[1.12] text-[#0F3D3E] sm:text-[44px]"
          >
            No such room in this house.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-[15.5px] leading-7 text-[#5B6B63]">
            The page you asked for doesn't exist at ServePoint — nothing is broken,
            and nothing was lost. If you followed a link from a QR sticker or a
            message, it may have been mistyped or retired. The real doors are below.
          </p>

          {/* The exact address, echoed back — a lost visitor (or the person they
              call for help) sees precisely what was asked, not a vague shrug. */}
          {path && path !== '/' && (
            <p className="mt-6 inline-flex max-w-full items-center gap-2 rounded-full border border-[#E3E7E0] bg-white px-4 py-2 text-[12.5px] text-[#5B6B63]">
              <MapPin size={14} className="shrink-0 text-[#969696]" aria-hidden />
              <span className="truncate">
                You followed <span className="font-mono text-[#0F3D3E]">{path}</span>
              </span>
            </p>
          )}

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <a href="/" className="sp-cta flex h-11 items-center rounded-full px-6 text-[14px]">
              Open the app
              <ArrowRight size={15} className="ml-2" aria-hidden />
            </a>
            <a
              href="/showcase"
              className="flex h-11 items-center rounded-full border border-[#0F3D3E]/25 bg-white px-6 text-[14px] font-semibold text-[#0F3D3E] transition hover:border-[#0F3D3E]/50"
            >
              Take the product tour
            </a>
            <a
              href="/index-help"
              className="flex h-11 items-center rounded-full border border-[#0F3D3E]/25 bg-white px-6 text-[14px] font-semibold text-[#0F3D3E] transition hover:border-[#0F3D3E]/50"
            >
              Read the how-to
            </a>
          </div>

          <button
            type="button"
            onClick={() => window.history.back()}
            className="mt-7 inline-flex items-center gap-1.5 text-[13px] font-medium text-[#969696] underline underline-offset-4 transition hover:text-[#5B6B63]"
          >
            <ArrowLeft size={14} aria-hidden />
            Back to the previous page
          </button>
        </section>
      </main>

      {/* ── Footer — the sidebar's voice, same line the porch pages carry ── */}
      <footer className="mt-auto border-t border-[#E3E7E0]/70 bg-[#F6F5F2]">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-3 px-4 py-5 sm:px-6">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#F6F1E9] p-0.5">
            <img src={brandMark} alt="" aria-hidden className="h-full w-full object-contain" />
          </span>
          {/* 5.247.0 — the DERIVED version joins the line (the battery pins
              all three porch footers to APP_VERSION — it cannot rot). */}
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

export default NotFoundPage;
