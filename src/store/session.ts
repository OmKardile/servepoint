import { create } from 'zustand';
import type { AuthUserSession } from '../lib/authService';

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
  goSection: (section, breadcrumb, hint) =>
    set({
      section,
      breadcrumb: breadcrumb || [section.charAt(0).toUpperCase() + section.slice(1)],
      search: '',
      // A door without a hint must not leak the previous door's context.
      sectionHint: hint ?? null,
    }),
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
