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
  | 'floor'
  | 'menu'
  | 'settings'
  | 'notifications'
  | 'support';

interface UiState {
  section: Section;
  breadcrumb: string[];
  search: string;
  profileOpen: boolean;
  goSection: (s: Section, breadcrumb?: string[]) => void;
  setBreadcrumb: (b: string[]) => void;
  setSearch: (q: string) => void;
  setProfileOpen: (v: boolean) => void;
}

export const useUi = create<UiState>((set) => ({
  section: 'dashboard',
  breadcrumb: ['Dashboard'],
  search: '',
  profileOpen: false,
  goSection: (section, breadcrumb) =>
    set({
      section,
      breadcrumb: breadcrumb || [section.charAt(0).toUpperCase() + section.slice(1)],
      search: '',
    }),
  setBreadcrumb: (breadcrumb) => set({ breadcrumb }),
  setSearch: (search) => set({ search }),
  setProfileOpen: (profileOpen) => set({ profileOpen }),
}));
