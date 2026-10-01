import { useEffect, useState } from 'react';
import { fetchTenantBySlug } from './api';
import type { Tenant } from '../types';
import { useSession } from '../store/session';

/**
 * Resolves the signed-in user's workspace (tenant) for cloud queries.
 *  - Cloud sessions carry tenant_id in auth metadata → used directly.
 *  - Registry sessions carry tenant_slug → resolved via Supabase.
 *  - No workspace linked → error state (production-honest; no fake tenant).
 */
export interface TenantState {
  loading: boolean;
  error: string | null;
  tenant: Tenant | null;
  tenantId: string | null;
}

export function useTenant(reloadKey = 0): TenantState {
  const session = useSession((s) => s.session);
  const [state, setState] = useState<TenantState>({
    loading: true,
    error: null,
    tenant: null,
    tenantId: session?.tenantId || null,
  });

  useEffect(() => {
    let alive = true;
    if (!session) {
      setState({ loading: false, error: 'Not signed in.', tenant: null, tenantId: null });
      return;
    }
    if (session.tenantId) {
      setState({ loading: false, error: null, tenant: null, tenantId: session.tenantId });
      return;
    }
    if (!session.tenantSlug) {
      setState({
        loading: false,
        error: 'No workspace is linked to this account. Ask the platform operator to attach your login to a business.',
        tenant: null,
        tenantId: null,
      });
      return;
    }
    setState((s) => ({ ...s, loading: true, error: null }));
    fetchTenantBySlug(session.tenantSlug)
      .then((tenant) => {
        if (!alive) return;
        if (!tenant) {
          setState({
            loading: false,
            error:
              'This business isn\u2019t in the ServePoint cloud yet \u2014 it was most likely provisioned from an older app version whose cloud saves failed. Re-provision it from the Platform console (Add Business), then sign back in.',
            tenant: null,
            tenantId: null,
          });
        } else {
          setState({ loading: false, error: null, tenant, tenantId: tenant.id });
        }
      })
      .catch((err: Error) => {
        if (!alive) return;
        setState({ loading: false, error: err.message, tenant: null, tenantId: null });
      });
    return () => {
      alive = false;
    };
  }, [session, reloadKey]);

  return state;
}
