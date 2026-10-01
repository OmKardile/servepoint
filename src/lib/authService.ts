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
  /** Set when a silent cloud-link grant failed DEFINITIVELY (no cloud auth
   *  account exists for this email). Future sign-ins skip the attempt so the
   *  browser console stops collecting a 400 the user cannot act on. Cleared
   *  automatically when the account is re-provisioned (signUp rewrites the
   *  registry entry) or when a grant eventually succeeds. */
  cloudGrantFailedAt?: string;
}

const LOCAL_AUTH_KEY = 'tsos_auth_session';
const LOCAL_CREDENTIALS_KEY = 'servepoint_local_credentials';

/** Bootstrap platform operator (documented in docs/CREDENTIALS.md). */
const BOOTSTRAP_OPERATOR = {
  email: 'admin@tsos.dev',
  password: 'admin123456',
  name: 'ServePoint Developer',
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

  /** Persist (or clear) the definitive cloud-grant-failure flag for an entry. */
  setCloudGrantFailed(email: string, failed: boolean): void {
    if (typeof window === 'undefined') return;
    const target = email.trim().toLowerCase();
    const list = this.getLocalCredentials();
    const entry = list.find((c) => c.email === target);
    if (!entry) return;
    if (failed && !entry.cloudGrantFailedAt) {
      entry.cloudGrantFailedAt = new Date().toISOString();
      window.localStorage.setItem(LOCAL_CREDENTIALS_KEY, JSON.stringify(list));
    } else if (!failed && entry.cloudGrantFailedAt) {
      delete entry.cloudGrantFailedAt;
      window.localStorage.setItem(LOCAL_CREDENTIALS_KEY, JSON.stringify(list));
    }
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
  ): Promise<{ success: boolean; session?: AuthUserSession; error?: string; cloudLinked?: boolean }> {
    const email = emailInput
      .replace(/[\u200B-\u200D\u2060\uFEFF]/g, '')
      .trim()
      .toLowerCase();
    const password = passwordInput;

    // 1) Provisioned-account registry (operator-created owners, owner-created
    //    staff) — instant sign-in, ZERO cloud round-trips, no email validation,
    //    no rate limits. Then a silent background upgrade attaches a real
    //    Supabase session so row-level security authorizes data access.
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
      // Silent cloud session upgrade — but skip it when a previous grant for
      // this account failed DEFINITIVELY (no cloud auth account for the email):
      // retrying on every sign-in only adds one more console 400 the user
      // cannot act on. The flag clears automatically on re-provisioning
      // (signUp rewrites the registry entry) or when a grant succeeds.
      let cloudLinked = false;
      if (!cred.cloudGrantFailedAt) {
        const link = await this.tryLinkCloudSession(email, password);
        cloudLinked = link === 'linked';
        if (link === 'no-account') this.setCloudGrantFailed(email, true);
        else if (link === 'linked') this.setCloudGrantFailed(email, false);
      }
      return { success: true, session, cloudLinked };
    }

    // 2) Cloud auth (dashboard-created users)
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
            await this.pinOperatorMetadata();
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
          return { success: true, session, cloudLinked: true };
        }
      }
    } catch (err) {
      console.warn('Cloud auth unavailable, using provisioned-account registry.', err);
    }

    // 3) Bootstrap platform operator (see docs/CREDENTIALS.md) — used when the
    //    cloud grant in (2) failed transiently. The grant was attempted moments
    //    ago; retrying it here would only duplicate the failed request (and a
    //    second console 400). The constant keeps sign-in working registry-side;
    //    the NEXT sign-in retries the cloud link once auth is reachable.
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
      return { success: true, session, cloudLinked: false };
    }

    return {
      success: false,
      error: 'Invalid email or password. Credentials are distributed via docs/CREDENTIALS.md.',
    };
  },

  /**
   * Attach a REAL Supabase session to a registry/constant sign-in by replaying
   * the same credentials against cloud auth. If the cloud account exists with
   * the same password, the supabase-js client now holds a JWT and row-level
   * security authorizes data access. Outcomes: 'linked' (JWT attached),
   * 'no-account' (definitive auth rejection — no cloud user / wrong cloud
   * password), or 'error' (network / transient). Callers persist a skip flag
   * for 'no-account' so sign-ins stay clean while the account is cloud-less.
   */
  async tryLinkCloudSession(
    email: string,
    password: string
  ): Promise<'linked' | 'no-account' | 'error'> {
    try {
      if (!isSupabaseConfigured()) return 'error';
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error || !data.session?.user) return 'no-account';
      if (email === BOOTSTRAP_OPERATOR.email) {
        const meta = data.session.user.user_metadata || {};
        if (meta.role !== 'superadmin') {
          await this.pinOperatorMetadata();
        }
      }
      return 'linked';
    } catch {
      return 'error';
    }
  },

  /** Pin role=superadmin into the operator's user_metadata (best-effort). */
  async pinOperatorMetadata(): Promise<void> {
    try {
      await supabase.auth.updateUser({
        data: {
          role: 'superadmin',
          name: BOOTSTRAP_OPERATOR.name,
          full_name: BOOTSTRAP_OPERATOR.name,
        },
      });
      await supabase.auth.refreshSession();
    } catch {
      /* best-effort; session remains valid */
    }
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
