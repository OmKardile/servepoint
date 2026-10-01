/**
 * v5.0.0 RBAC (ADR-0013 trio, ADR-0014 production).
 * superadmin = platform operator (ServePoint developer) — platform console only.
 * owner      = runs the business — whole app + staff-account creation.
 * staff      = merged manager+cashier — operates the whole app, no account creation.
 */

export type UserRole = 'superadmin' | 'owner' | 'staff';

const LEGACY_ROLE_MAP: Record<string, UserRole> = {
  manager: 'staff',
  cashier: 'staff',
  kitchen: 'staff',
  barista: 'staff',
  chef: 'staff',
  server: 'staff',
  waiter: 'staff',
  cleaner: 'staff',
};

export function normalizeRole(role: string | undefined | null): UserRole {
  if (!role) return 'staff';
  if (role === 'superadmin' || role === 'owner' || role === 'staff') return role;
  return LEGACY_ROLE_MAP[role] || 'staff';
}

export interface RolePermissions {
  canManageStaff: boolean; // create staff logins (Settings → Staff Accounts)
  canProvision: boolean; // SuperAdmin platform: businesses + owners
  canViewPlatform: boolean;
}

export const ROLE_CONFIGS: Record<UserRole, RolePermissions> = {
  superadmin: { canManageStaff: false, canProvision: true, canViewPlatform: true },
  owner: { canManageStaff: true, canProvision: false, canViewPlatform: false },
  staff: { canManageStaff: false, canProvision: false, canViewPlatform: false },
};

export type RoleAction = 'manage_staff' | 'provision';

export function canPerformAction(role: UserRole | string | undefined, action: RoleAction): boolean {
  const perms = ROLE_CONFIGS[normalizeRole(role)];
  if (action === 'manage_staff') return perms.canManageStaff;
  if (action === 'provision') return perms.canProvision;
  return false;
}

export function getRoleMeta(role: UserRole | string | undefined): {
  label: string;
  className: string;
} {
  switch (normalizeRole(role)) {
    case 'superadmin':
      return { label: 'Platform Operator', className: 'bg-[#0F3D3E] text-white' };
    case 'owner':
      return { label: 'Owner', className: 'bg-[#B88E2F] text-white' };
    default:
      return { label: 'Cafe Staff', className: 'bg-[#D9E2DD] text-[#0F3D3E]' };
  }
}
