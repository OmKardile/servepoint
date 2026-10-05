import { create } from 'zustand';
import type { AuthUserSession } from '../lib/authService';
import { SECTION_SLUGS, sectionFromPath } from '../lib/sectionPath';

/** Signed-in identity (hydrated by App from authService). */
interface SessionState {
  session: AuthUserSession | null;
  ready: boolean;
  setSession: (s: AuthUserSession | null) => void;
  setReady: (v: boolean) => void;
}

export const useSession = create<SessionState>((set) => ({
  session: null,
  ready: false,
  setSession: (session) => set({ session }),
  setReady: (ready) => set({ ready }),
}));

export type Section =
  | 'dashboard'
  | 'food'
  | 'kitchen'
  | 'bills'
  | 'eod'
  | 'reports'
  | 'inventory'
  | 'customers'
  | 'floor'
  | 'menu'
  | 'settings'
  | 'notifications'
  | 'messages'
  | 'support';

interface UiState {
  section: Section;
  breadcrumb: string[];
  search: string;
  /** v5.116.0 — the shell search's per-screen contract: a screen that
   *  honors the header's search box registers its own vocabulary on mount
   *  and clears it on unmount; the header renders the box ONLY while a
   *  registration stands (a control that cannot act must not solicit
   *  input) and speaks the registering screen's placeholder. */
  searchMeta: { placeholder: string } | null;
  profileOpen: boolean;
  /** One-shot context a door can carry into the section it opens (v5.44.0:
   *  'unpaid' → Bills lands pre-filtered to money still out). Consumed once
   *  on arrival; never persists, never rides the URL. */
  sectionHint: string | null;
  goSection: (s: Section, breadcrumb?: string[], hint?: string) => void;
  consumeSectionHint: () => string | null;
  setBreadcrumb: (b: string[]) => void;
  setSearch: (q: string) => void;
  setSearchMeta: (meta: { placeholder: string } | null) => void;
  setProfileOpen: (v: boolean) => void;
}

export const useUi = create<UiState>((set, get) => ({
  section: 'dashboard',
  breadcrumb: ['Dashboard'],
  search: '',
  searchMeta: null,
  profileOpen: false,
  sectionHint: null,
  goSection: (section, breadcrumb, hint) => {
    set({
      section,
      breadcrumb: breadcrumb || [section.charAt(0).toUpperCase() + section.slice(1)],
      search: '',
      // A door without a hint must not leak the previous door's context.
      sectionHint: hint ?? null,
    });
    /* v5.235.0 — the address follows you: the navigation act claims the
     * URL (replaceState — the address tells where you ARE; no history
     * pile, no popstate choreography, the POS's Back keeps its
     * device-level meaning), so a mid-shift refresh lands the operator
     * where they were — the v5.32.0 deep-link reader restores the room
     * on boot, and write + read share ONE path grammar
     * (lib/sectionPath). The writer runs only when a room is CHOSEN —
     * the boot's own address is never rewritten, because a plain boot
     * calls no goSection at all: the bare root keeps its throne ("/")
     * until a choice names a room. And a path that already names the
     * running room keeps its own word (a spoken alias /close-out, a
     * pinned-wall /cafe/bills — v5.93's law). goSection is an action,
     * not an effect — React's StrictMode echo cannot double-write. */
    if (typeof window !== 'undefined' && typeof history !== 'undefined') {
      const path = window.location.pathname;
      if (sectionFromPath(SECTION_SLUGS, path) !== section) {
        history.replaceState(null, '', `/${section}`);
      }
    }
  },
  consumeSectionHint: () => {
    const hint = get().sectionHint;
    if (hint !== null) set({ sectionHint: null });
    return hint;
  },
  setBreadcrumb: (breadcrumb) => set({ breadcrumb }),
  setSearch: (search) => set({ search }),
  setSearchMeta: (searchMeta) => set({ searchMeta }),
  setProfileOpen: (profileOpen) => set({ profileOpen }),
}));
