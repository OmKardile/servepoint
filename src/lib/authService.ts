import { supabase, isSupabaseConfigured } from './supabase';
import { normalizeRole } from './rbac';

/**
 * v5.0.0 Production Auth (ADR-0013 role model + ADR-0014 demo purge):
 *  - Sign-in = real email + real password (docs/CREDENTIALS.md is the credential source).
 *  - Accounts come from: Supabase Auth (cloud), or the local credential registry
 *    populated by the SuperAdmin Provisioning Wizard (owners) and Settings →
 *    Staff Accounts (staff). No aliases, no hardcoded demo accounts, no magic link.
 *  - One bootstrap platform-operator constant exists (documented in CREDENTIALS.md)
 *    so the platform can be entered before any business is provisioned.
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
const LOCAL_CREDENTIALS_KEY = 'servepoint_local_credentials';

/** Bootstrap platform operator (documented in docs/CREDENTIALS.md). */
const BOOTSTRAP_OPERATOR = {
  email: 'admin@tsos.dev',
  password: 'admin123456',
  name: 'TSOS Developer',
};

export const authService = {
  /** Local credential registry (accounts provisioned in-app). */
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
    const entry: LocalCredential = {
      ...cred,
      email: cred.email.toLowerCase(),
      created_at: new Date().toISOString(),
    };
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

  async getSession(): Promise<AuthUserSession | null> {
    try {
      if (isSupabaseConfigured()) {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session?.user) {
          const meta = session.user.user_metadata || {};
          const emailLower = (session.user.email || '').toLowerCase();
          // The bootstrap platform operator is ALWAYS superadmin (its cloud
          // metadata may be stale); everyone else resolves from metadata.
          const resolvedRole =
            emailLower === BOOTSTRAP_OPERATOR.email
              ? 'superadmin'
              : normalizeRole(meta.role || 'owner');
          return {
            id: session.user.id,
            email: session.user.email || '',
            name: meta.name || meta.full_name || session.user.email?.split('@')[0] || 'Cafe Staff',
            role: resolvedRole,
            tenantId: meta.tenant_id,
            tenantSlug: meta.tenant_slug,
            tenantName: meta.tenant_name,
          };
        }
      }
    } catch {
      /* cloud unavailable — fall through to local session */
    }

    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(LOCAL_AUTH_KEY);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          return { ...parsed, role: normalizeRole(parsed.role) };
        } catch {
          /* corrupt entry — ignore */
        }
      }
    }
    return null;
  },

  async signIn(
    emailInput: string,
    passwordInput: string
  ): Promise<{ success: boolean; session?: AuthUserSession; error?: string }> {
    const email = emailInput.trim().toLowerCase();
    const password = passwordInput;

    // 1) Cloud auth
    try {
      if (isSupabaseConfigured()) {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (!error && data.session?.user) {
          const meta = data.session.user.user_metadata || {};
          const emailLower = (data.session.user.email || email).toLowerCase();
          const resolvedRole =
            emailLower === BOOTSTRAP_OPERATOR.email
              ? 'superadmin'
              : normalizeRole(meta.role || 'owner');

          // Platform operator bootstrap: pin role=superadmin into user_metadata
          // so the RLS helper is_superadmin() (which reads JWT user_metadata)
          // authorizes Platform tables (tenants / subscriptions / audit logs).
          // Best-effort — migration 005 seeds this server-side too.
          if (emailLower === BOOTSTRAP_OPERATOR.email && meta.role !== 'superadmin') {
            try {
              await supabase.auth.updateUser({
                data: { role: 'superadmin', name: BOOTSTRAP_OPERATOR.name, full_name: BOOTSTRAP_OPERATOR.name },
              });
              await supabase.auth.refreshSession();
            } catch {
              /* metadata pinning is best-effort; session still valid */
            }
          }

          const session: AuthUserSession = {
            id: data.session.user.id,
            email: data.session.user.email || email,
            name: meta.name || meta.full_name || email.split('@')[0],
            role: resolvedRole,
            tenantId: meta.tenant_id,
            tenantSlug: meta.tenant_slug,
            tenantName: meta.tenant_name,
          };
          if (typeof window !== 'undefined') {
            localStorage.setItem(LOCAL_AUTH_KEY, JSON.stringify(session));
          }
          return { success: true, session };
        }
      }
    } catch (err) {
      console.warn('Cloud auth unavailable, using provisioned-account registry.', err);
    }

    // 2) Local credential registry (wizard-created owners, owner-created staff)
    const cred = this.findLocalCredential(email, password);
    if (cred) {
      const session: AuthUserSession = {
        id: `usr_${Date.now()}`,
        email: cred.email,
        name: cred.name || cred.email.split('@')[0],
        role: normalizeRole(cred.role),
        tenantSlug: cred.tenantSlug,
        tenantName: cred.tenantName,
      };
      if (typeof window !== 'undefined') {
        localStorage.setItem(LOCAL_AUTH_KEY, JSON.stringify(session));
      }
      return { success: true, session };
    }

    // 3) Bootstrap platform operator (see docs/CREDENTIALS.md)
    if (email === BOOTSTRAP_OPERATOR.email && password === BOOTSTRAP_OPERATOR.password) {
      const session: AuthUserSession = {
        id: 'usr_platform_operator',
        email: BOOTSTRAP_OPERATOR.email,
        name: BOOTSTRAP_OPERATOR.name,
        role: 'superadmin',
      };
      if (typeof window !== 'undefined') {
        localStorage.setItem(LOCAL_AUTH_KEY, JSON.stringify(session));
      }
      return { success: true, session };
    }

    return {
      success: false,
      error: 'Invalid email or password. Credentials are distributed via docs/CREDENTIALS.md.',
    };
  },

  /**
   * Create an account — used ONLY by: SuperAdmin wizard → owner,
   * Owner Settings → Staff Accounts. Registers locally first (so the account
   * can sign in immediately), then pushes to Supabase Auth best-effort.
   */
  async signUp(
    emailInput: string,
    password: string,
    name: string,
    role: 'owner' | 'staff' = 'staff',
    tenant?: { slug?: string; name?: string }
  ): Promise<{ success: boolean; error?: string }> {
    // Sanitize: Supabase's enhanced email validation is strict — invisible
    // characters (zero-width, NBSP) or stray whitespace cause real rejections.
    const cleanEmail = emailInput
      .replace(/[\u200B-\u200D\u2060\uFEFF]/g, '')
      .trim()
      .toLowerCase();

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
        const attempt = () =>
          supabase.auth.signUp({
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

        let { error } = await attempt();
        // GoTrue's email validation does DNS-level checks that can fail
        // transiently (observed: a valid address rejected once, accepted on
        // retry) — retry once before surfacing the error.
        if (error && /email.*(invalid|not valid)/i.test(error.message)) {
          await new Promise((resolve) => setTimeout(resolve, 800));
          ({ error } = await attempt());
        }
        if (error) {
          if (/rate.?limit|too many/i.test(error.message)) {
            return {
              success: true,
              error:
                'Cloud auth notice: confirmation-email rate limit reached (free tier ≈ 2/hour). ' +
                'For instant provisioning, turn OFF "Confirm email" in Supabase → Authentication → Sign In / Providers → Email ' +
                '(docs/CREDENTIALS.md). The account is registered locally and ready to sign in on this device.',
            };
          }
          return {
            success: true,
            error: `Cloud auth notice: ${error.message}. Account is registered locally and ready to sign in on this device.`,
          };
        }
      }
    } catch (err: any) {
      return {
        success: true,
        error: `Cloud auth unavailable (${err?.message || 'offline'}). Account is registered locally and ready to sign in on this device.`,
      };
    }
    return { success: true };
  },

  async signOut(): Promise<void> {
    try {
      if (isSupabaseConfigured()) {
        await supabase.auth.signOut();
      }
    } catch {
      /* offline — clear local state regardless */
    }
    if (typeof window !== 'undefined') {
      localStorage.removeItem(LOCAL_AUTH_KEY);
    }
  },
};
