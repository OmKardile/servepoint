import { supabase, isSupabaseConfigured } from './supabase';
import { StaffMember } from '../types';
import { normalizeRole } from './rbac';

/**
 * v4.0.0 Auth Model (owner-mandated):
 *  - Roles: superadmin | owner | staff (legacy manager/cashier/kitchen/barista/chef/server
 *    normalize to 'staff' via normalizeRole).
 *  - No self-serve signup, no magic link. Accounts come from:
 *      (a) the SuperAdmin Provisioning Wizard (creates the business OWNER),
 *      (b) the Owner's Settings → Staff Accounts (creates STAFF logins),
 *      (c) Supabase Auth (cloud) — or the local credential registry (offline/demo).
 *  - The local registry (`tsos_local_credentials`) makes provisioned/created accounts
 *    sign-in-able instantly even when Supabase Auth does not yet hold the user.
 */

export interface AuthUserSession {
  id: string;
  email: string;
  name: string;
  role: 'superadmin' | 'owner' | 'staff';
  tenantId?: string;
  tenantSlug?: string;
  tenantName?: string;
}

export interface LocalCredential {
  email: string;
  password: string;
  name: string;
  role: 'superadmin' | 'owner' | 'staff';
  tenantSlug?: string;
  tenantName?: string;
  created_at: string;
}

const LOCAL_AUTH_KEY = 'tsos_auth_session';
const ACTIVE_STAFF_KEY = 'tsos_active_staff';
const LOCAL_CREDENTIALS_KEY = 'tsos_local_credentials';

/** Friendly alias → real account (typed into the email field). */
const EMAIL_ALIASES: Record<string, { email: string; password: string }> = {
  admin: { email: 'admin@tsos.dev', password: 'admin123456' },
  superadmin: { email: 'admin@tsos.dev', password: 'admin123456' },
  super_admin: { email: 'admin@tsos.dev', password: 'admin123456' },
  developer: { email: 'admin@tsos.dev', password: 'admin123456' },
  owner: { email: 'owner@coolkafe.com', password: 'demo123456' },
  staff: { email: 'staff@coolkafe.com', password: 'demo123456' },
  manager: { email: 'manager@coolkafe.com', password: 'demo123456' },
  cashier: { email: 'cashier@coolkafe.com', password: 'demo123456' },
};

export const authService = {
  /**
   * Local credential registry (offline-first account store for provisioned accounts)
   */
  getLocalCredentials(): LocalCredential[] {
    if (typeof window === 'undefined') return [];
    try {
      return JSON.parse(localStorage.getItem(LOCAL_CREDENTIALS_KEY) || '[]');
    } catch {
      return [];
    }
  },

  registerLocalCredential(cred: Omit<LocalCredential, 'created_at'>): LocalCredential {
    const list = this.getLocalCredentials().filter((c) => c.email !== cred.email.toLowerCase());
    const entry: LocalCredential = { ...cred, email: cred.email.toLowerCase(), created_at: new Date().toISOString() };
    list.push(entry);
    if (typeof window !== 'undefined') {
      localStorage.setItem(LOCAL_CREDENTIALS_KEY, JSON.stringify(list));
    }
    return entry;
  },

  findLocalCredential(email: string, password?: string): LocalCredential | undefined {
    const target = email.trim().toLowerCase();
    return this.getLocalCredentials().find(
      (c) => c.email === target && (!password || c.password === password)
    );
  },

  /**
   * Get current authenticated user session
   */
  async getSession(): Promise<AuthUserSession | null> {
    try {
      if (isSupabaseConfigured()) {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (session?.user) {
          const userMeta = session.user.user_metadata || {};
          const emailLower = (session.user.email || '').toLowerCase();
          const resolvedRole = normalizeRole(userMeta.role || (
            emailLower.includes('admin') ? 'superadmin' : 'owner'
          ));
          return {
            id: session.user.id,
            email: session.user.email || '',
            name: userMeta.name || userMeta.full_name || session.user.email?.split('@')[0] || 'Cafe Staff',
            role: resolvedRole,
            tenantId: userMeta.tenant_id,
            tenantSlug: userMeta.tenant_slug,
            tenantName: userMeta.tenant_name,
          };
        }
      }
    } catch (err) {
      console.warn('Error reading Supabase session:', err);
    }

    // Fallback to local storage session
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(LOCAL_AUTH_KEY);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          return { ...parsed, role: normalizeRole(parsed.role) };
        } catch {}
      }
    }

    return null;
  },

  /**
   * Sign In with Email & Password
   */
  async signIn(emailInput: string, passwordInput: string): Promise<{ success: boolean; session?: AuthUserSession; error?: string }> {
    let email = emailInput.trim().toLowerCase();
    let password = passwordInput;

    // Friendly alias normalization (typed "admin" / "owner" / "staff" etc.)
    const alias = EMAIL_ALIASES[email];
    if (alias) {
      email = alias.email;
      if (!password || password === '1234' || password === email.split('@')[0]) password = alias.password;
    }

    try {
      if (isSupabaseConfigured()) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (!error && data.session?.user) {
          const userMeta = data.session.user.user_metadata || {};
          const emailLower = (data.session.user.email || email).toLowerCase();
          const resolvedRole = normalizeRole(userMeta.role || (
            emailLower.includes('admin') ? 'superadmin' : 'owner'
          ));
          const userSession: AuthUserSession = {
            id: data.session.user.id,
            email: data.session.user.email || email,
            name: userMeta.name || userMeta.full_name || email.split('@')[0],
            role: resolvedRole,
            tenantId: userMeta.tenant_id,
            tenantSlug: userMeta.tenant_slug,
            tenantName: userMeta.tenant_name,
          };

          if (typeof window !== 'undefined') {
            localStorage.setItem(LOCAL_AUTH_KEY, JSON.stringify(userSession));
          }
          return { success: true, session: userSession };
        }
        console.warn('Supabase signIn notice:', error?.message);
      }
    } catch (err: any) {
      console.warn('Supabase signIn failed, falling back to local session:', err);
    }

    // Local credential registry (provisioned owners / owner-created staff logins)
    const cred = this.findLocalCredential(email, password);
    if (cred) {
      const session: AuthUserSession = {
        id: `usr_${Date.now()}`,
        email: cred.email,
        name: cred.name || cred.email.split('@')[0],
        role: normalizeRole(cred.role),
        tenantSlug: cred.tenantSlug || 'coolkafe',
        tenantName: cred.tenantName || 'CoolKafe Indiranagar',
      };
      if (typeof window !== 'undefined') {
        localStorage.setItem(LOCAL_AUTH_KEY, JSON.stringify(session));
      }
      return { success: true, session };
    }

    // Known-account fallback (demo seed accounts — see docs/CREDENTIALS.md)
    const knownAccounts: Record<string, { password: string; role: 'superadmin' | 'owner' | 'staff'; name: string }> = {
      'admin@tsos.dev': { password: 'admin123456', role: 'superadmin', name: 'TSOS Developer' },
      'owner@coolkafe.com': { password: 'demo123456', role: 'owner', name: 'Devraj Sen' },
      'staff@coolkafe.com': { password: 'demo123456', role: 'staff', name: 'Ananya Sharma' },
      // Legacy merged accounts — still valid, resolve to 'staff'
      'manager@coolkafe.com': { password: 'demo123456', role: 'staff', name: 'Rahul Verma (Staff)' },
      'cashier@coolkafe.com': { password: 'demo123456', role: 'staff', name: 'Ananya Sharma (Staff)' },
    };

    const known = knownAccounts[email];
    if (known && known.password === password) {
      const fallbackSession: AuthUserSession = {
        id: `usr_${Date.now()}`,
        email,
        name: known.name,
        role: known.role,
        tenantSlug: 'coolkafe',
        tenantName: 'CoolKafe Indiranagar',
      };
      if (typeof window !== 'undefined') {
        localStorage.setItem(LOCAL_AUTH_KEY, JSON.stringify(fallbackSession));
      }
      return { success: true, session: fallbackSession };
    }

    return { success: false, error: 'Invalid email or password. Credentials live in docs/CREDENTIALS.md.' };
  },

  /**
   * Create an account (used ONLY by: SuperAdmin wizard → owner, Owner Settings → staff).
   * Registers into Supabase Auth when configured; ALWAYS registers into the local
   * credential registry so the account can sign in immediately (offline/demo path).
   */
  async signUp(email: string, password: string, name: string, role: 'owner' | 'staff' = 'staff', tenant?: { slug?: string; name?: string }): Promise<{ success: boolean; session?: AuthUserSession; error?: string }> {
    const cleanEmail = email.trim().toLowerCase();

    // Register locally first so the account works regardless of cloud state
    this.registerLocalCredential({
      email: cleanEmail,
      password,
      name,
      role,
      tenantSlug: tenant?.slug,
      tenantName: tenant?.name,
    });

    try {
      if (isSupabaseConfigured()) {
        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            data: {
              name,
              full_name: name,
              role,
              tenant_slug: tenant?.slug,
              tenant_name: tenant?.name,
            },
          },
        });

        if (error) {
          // Local registry entry still stands; surface the cloud notice
          return { success: true, error: `Cloud auth notice: ${error.message}. Account registered locally and ready to sign in.` };
        }

        if (data.user) {
          return { success: true };
        }
      }
    } catch (err: any) {
      console.warn('Supabase signUp error:', err);
      return { success: true, error: `Cloud auth unavailable (${err?.message || 'offline'}). Account registered locally and ready to sign in.` };
    }

    return { success: true };
  },

  /**
   * Sign Out
   */
  async signOut(): Promise<void> {
    try {
      if (isSupabaseConfigured()) {
        await supabase.auth.signOut();
      }
    } catch (err) {
      console.warn('Supabase signOut error:', err);
    }

    if (typeof window !== 'undefined') {
      localStorage.removeItem(LOCAL_AUTH_KEY);
      localStorage.removeItem(ACTIVE_STAFF_KEY);
    }
  },

  /**
   * Staff 4-Digit Fast PIN Pad Validation
   */
  verifyStaffPin(pin: string, staffList: StaffMember[]): StaffMember | null {
    const cleanPin = pin.trim();
    const match = staffList.find((s) => s.pin_code === cleanPin || s.pin === cleanPin);
    if (match) {
      if (typeof window !== 'undefined') {
        localStorage.setItem(ACTIVE_STAFF_KEY, JSON.stringify(match));
      }
      return match;
    }
    return null;
  },

  getActiveStaff(): StaffMember | null {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(ACTIVE_STAFF_KEY);
      if (stored) {
        try {
          return JSON.parse(stored);
        } catch {}
      }
    }
    return null;
  },

  setActiveStaff(staff: StaffMember | null) {
    if (typeof window !== 'undefined') {
      if (staff) {
        localStorage.setItem(ACTIVE_STAFF_KEY, JSON.stringify(staff));
      } else {
        localStorage.removeItem(ACTIVE_STAFF_KEY);
      }
    }
  },
};
