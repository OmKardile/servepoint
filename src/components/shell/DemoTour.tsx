import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSession } from '../../store/session';

/**
 * v5.311.0 — the demo tour: a minimal coach-mark walk for the demo account.
 *
 * The owner asked for the demo credentials to be shown at the gate (5.310.0,
 * done) AND for the demo account to greet its reviewer with a guided tour.
 * THE SHAPE: a welcome card (it names the demo account and the sample-data
 * honesty), seven spotlight stops down the sidebar rail — each one sentence
 * about the room it names — and a done card that points at the restart door.
 * THE GATE: the tour exists ONLY for the demo session (the CheeseBurg owner
 * email); every other sign-in never sees a byte of it. The auto-open runs
 * once per browser (localStorage), and the sidebar's "Demo tour" button
 * relaunches it on demand. House clothes only: the teal ink scrim (the rail's
 * own #0F3D3E at rest), the gold border on the spotlight, the sp-cta gold
 * ask, zero new colors. Reduced-motion users get the same tour without the
 * transitions.
 */

/** The one demo account (lowercase — Supabase stores emails lowercased). */
export const DEMO_OWNER_EMAIL = 'cheeseburg@gmail.com';

/** One auto-open per browser; the sidebar button can always relaunch. */
export const DEMO_TOUR_DONE_KEY = 'servepoint.demoTour.done.v1';

export const isDemoSession = (email: string | null | undefined): boolean =>
  (email || '').trim().toLowerCase() === DEMO_OWNER_EMAIL;

export const wasTourDone = (): boolean => {
  try {
    return window.localStorage.getItem(DEMO_TOUR_DONE_KEY) === 'done';
  } catch {
    return false;
  }
};

export const markTourDone = (): void => {
  try {
    window.localStorage.setItem(DEMO_TOUR_DONE_KEY, 'done');
  } catch {
    /* private mode — the tour just returns next visit; honest, harmless */
  }
};

/** The seven rail stops, in the order a first-time reviewer should meet them. */
const TOUR_STEPS: { label: string; body: string }[] = [
  { label: 'Dashboard', body: "Today's sales, live orders and the day's pulse at a glance." },
  { label: 'Food & Drinks', body: 'Your menu — categories, items and prices live here.' },
  { label: 'Kitchen', body: 'The live ticket rail your kitchen works from.' },
  { label: 'Bills', body: 'Every bill with its payment state, exports and history.' },
  { label: 'Reports', body: 'Sales, heatmaps and breakouts across the whole book.' },
  { label: 'Inventory', body: 'Stock levels that whisper before they run out.' },
  { label: 'Settings', body: 'Staff, GST, printers, tables and everything else.' },
];

const anchorSelector = (label: string) =>
  `aside[aria-label="Primary navigation"] button[title="${label}"]`;

interface DemoTourProps {
  open: boolean;
  onClose: () => void;
}

/** -1 = the welcome card · 0..N-1 = the rail stops · N = the done card. */
type TourFrame = number;

export const DemoTour: React.FC<DemoTourProps> = ({ open, onClose }) => {
  const session = useSession((s) => s.session);
  const [frame, setFrame] = useState<TourFrame>(-1);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const primaryRef = useRef<HTMLButtonElement | null>(null);

  /* a fresh open always starts at the welcome card */
  useEffect(() => {
    if (open) setFrame(-1);
  }, [open]);

  /* Escape closes (and marks the tour done — a skip is an answer) */
  const handleClose = useCallback(() => {
    markTourDone();
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, handleClose]);

  /* measure the current stop's rail button (again on resize + settle) */
  useEffect(() => {
    if (!open || frame < 0 || frame >= TOUR_STEPS.length) {
      setRect(null);
      return;
    }
    const measure = () => {
      const el = document.querySelector(anchorSelector(TOUR_STEPS[frame].label));
      setRect(el ? el.getBoundingClientRect() : null);
    };
    measure();
    const t = window.setTimeout(measure, 250);
    window.addEventListener('resize', measure);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('resize', measure);
    };
  }, [open, frame]);

  /* keep the primary action in focus for keyboards and ears */
  useEffect(() => {
    if (open) primaryRef.current?.focus();
  }, [open, frame]);

  if (!open || !isDemoSession(session?.email)) return null;

  const isWelcome = frame === -1;
  const isDone = frame >= TOUR_STEPS.length;
  const stop = isWelcome || isDone ? null : TOUR_STEPS[frame];

  const next = () => {
    if (isDone) {
      markTourDone();
      onClose();
      return;
    }
    setFrame((f) => f + 1);
  };
  const back = () => setFrame((f) => Math.max(-1, f - 1));

  /* the card seat: beside the spotlight, clamped to the viewport; centered
     when there is no spotlight (the welcome and done cards) */
  const cardStyle: React.CSSProperties | undefined = (() => {
    if (!rect) return undefined;
    const W = Math.min(window.innerWidth * 0.92, 320);
    let left = rect.right + 12;
    if (left + W > window.innerWidth - 8) left = Math.max(8, window.innerWidth - W - 8);
    const top = Math.min(Math.max(rect.top - 8, 8), Math.max(8, window.innerHeight - 220));
    return { left, top, width: W };
  })();

  const title = isWelcome
    ? 'Welcome to the demo'
    : isDone
      ? "You're all set"
      : TOUR_STEPS[frame].label;
  const body = isWelcome
    ? "You're signed in to CheeseBurg, the demo cafe — the data is sample data, so explore freely. Take a one-minute walk around the counter?"
    : isDone
      ? "That's the loop — menu to kitchen to bill to report. Restart the tour any time from the sidebar."
      : TOUR_STEPS[frame].body;

  return (
    <>
      {/* the click-swallower: the app underneath never hears a tap mid-tour */}
      <div className="fixed inset-0 z-[69]" aria-hidden />

      {/* the spotlight: a gold-ringed hole over the stop's rail button; the
          scrim is the rail's own teal ink — when there is no spotlight the
          scrim covers the whole stage (welcome + done) */}
      {rect ? (
        <div
          aria-hidden
          className="pointer-events-none fixed z-[71] rounded-xl border-2 border-[#B88E2F] motion-safe:transition-all motion-safe:duration-300"
          style={{
            top: rect.top - 6,
            left: rect.left - 6,
            width: rect.width + 12,
            height: rect.height + 12,
            boxShadow: '0 0 0 9999px rgba(15, 61, 62, 0.55)',
          }}
        />
      ) : (
        <div aria-hidden className="fixed inset-0 z-[70] bg-[#0F3D3E]/55" />
      )}

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Demo guided tour"
        className={
          rect
            ? 'fixed z-[72] rounded-2xl border border-[#E3E7E0] bg-white p-5 shadow-xl motion-safe:transition-all motion-safe:duration-300'
            : 'fixed left-1/2 top-1/2 z-[72] w-[min(92vw,380px)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-[#E3E7E0] bg-white p-6 shadow-xl'
        }
        style={cardStyle}
      >
        <p className="text-[15px] font-bold text-[#1A1A1A]">{title}</p>
        <p className="mt-1.5 text-[13px] leading-relaxed text-[#6B6B6B]">{body}</p>

        {/* the dots speak the walk's progress (stops only, never the cards) */}
        {!isWelcome && !isDone && (
          <div className="mt-4 flex items-center gap-1.5" role="group" aria-label="Tour progress">
            {TOUR_STEPS.map((s, i) => (
              <span
                key={s.label}
                aria-hidden
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === frame ? 'w-5 bg-[#B88E2F]' : 'bg-[#C9CFC9]'
                }`}
              />
            ))}
          </div>
        )}

        <div className="mt-5 flex items-center justify-between gap-3">
          {isWelcome || isDone ? (
            <span className="text-[11px] text-[#969696]">
              {isWelcome ? 'Demo account · sample data' : 'Restart any time · sidebar'}
            </span>
          ) : (
            <button
              type="button"
              onClick={back}
              className="rounded-lg px-2 py-2 text-[12px] font-medium text-[#6B6B6B] transition-colors hover:bg-[#F6F5F2] hover:text-[#1A1A1A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#B88E2F]"
            >
              Back
            </button>
          )}
          <button
            ref={primaryRef}
            type="button"
            onClick={next}
            className="sp-cta flex items-center justify-center rounded-lg px-5 py-2 text-[12px]"
          >
            {isWelcome ? 'Start the tour' : isDone ? 'Finish' : frame === TOUR_STEPS.length - 1 ? 'Finish' : 'Next'}
          </button>
        </div>

        {/* the honest exit: always one tap away, never a dead end */}
        {!isDone && (
          <button
            type="button"
            onClick={handleClose}
            className="mt-3 w-full rounded-lg py-1.5 text-center text-[11px] text-[#969696] transition-colors hover:bg-[#F6F5F2] hover:text-[#6B6B6B] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#B88E2F]"
          >
            Skip tour
          </button>
        )}
      </div>
    </>
  );
};
