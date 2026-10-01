import { UserRole, WebTab } from '../types';

/**
 * v4.0.0 Role Model (owner-mandated):
 *  - superadmin : TSOS developer — SuperAdmin Platform console ONLY (default surface).
 *                 Tab list kept permissive so the explicit "Switch to Cafe View" dev
 *                 tool still works; App.tsx always LANDS superadmin on the platform.
 *  - owner      : cafe owner — every cafe tab + business dashboards + staff-login creation.
 *  - staff      : merged Manager+Cashier — operates the WHOLE cafe POS app (all tabs).
 *                 Account creation stays owner-only (canManageStaff: false).
 */

/** Legacy role values accepted at the auth boundary, normalized to the new model. */
const LEGACY_ROLE_MAP: Record<string, UserRole> = {
  super_admin: 'superadmin',
  manager: 'staff',
  cashier: 'staff',
  kitchen: 'staff',
  barista: 'staff',
  chef: 'staff',
  server: 'staff',
  waiter: 'staff',
  cleaner: 'staff',
};

/** Normalize any stored/legacy role string into the v4.0.0 trio. */
export function normalizeRole(role: string | undefined | null): UserRole {
  if (!role) return 'staff';
  if (role === 'superadmin' || role === 'owner' || role === 'staff') return role;
  return LEGACY_ROLE_MAP[role] || 'staff';
}

export interface RolePermissions {
  accessibleTabs: WebTab[];
  canEditSettings: boolean;
  canViewReports: boolean;
  canEditInventory: boolean;
  canEditMenu: boolean;
  canManageStaff: boolean;
  isPlatformAdmin: boolean;
  roleLabel: string;
  badgeClass: string;
  badgeDarkClass: string;
}

export const ROLE_CONFIGS: Record<UserRole, RolePermissions> = {
  superadmin: {
    accessibleTabs: ['pos', 'kds', 'orders', 'menu', 'inventory', 'tables', 'customers', 'offers', 'shifts', 'reports', 'settings'],
    canEditSettings: true,
    canViewReports: true,
    canEditInventory: true,
    canEditMenu: true,
    canManageStaff: true,
    isPlatformAdmin: true,
    roleLabel: 'TSOS Developer',
    badgeClass: 'bg-purple-100 text-purple-700 border-purple-200',
    badgeDarkClass: 'bg-purple-950 text-purple-300 border-purple-800',
  },
  owner: {
    accessibleTabs: ['pos', 'kds', 'orders', 'menu', 'inventory', 'tables', 'customers', 'offers', 'shifts', 'reports', 'settings'],
    canEditSettings: true,
    canViewReports: true,
    canEditInventory: true,
    canEditMenu: true,
    canManageStaff: true,
    isPlatformAdmin: false,
    roleLabel: 'Cafe Owner',
    badgeClass: 'bg-amber-100 text-amber-800 border-amber-300',
    badgeDarkClass: 'bg-amber-950 text-amber-300 border-amber-800',
  },
  staff: {
    // Merged Manager+Cashier: operates the whole POS app — everything.
    accessibleTabs: ['pos', 'kds', 'orders', 'menu', 'inventory', 'tables', 'customers', 'offers', 'shifts', 'reports', 'settings'],
    canEditSettings: true,
    canViewReports: true,
    canEditInventory: true,
    canEditMenu: true,
    canManageStaff: false, // login/staff-account creation is owner-only
    isPlatformAdmin: false,
    roleLabel: 'Cafe Staff',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    badgeDarkClass: 'bg-emerald-950 text-emerald-300 border-emerald-800',
  },
};

/**
 * Check if a role has access to a specific tab (legacy roles normalized)
 */
export function canAccessTab(role: UserRole | string | undefined, tab: WebTab): boolean {
  if (!role) return false;
  const config = ROLE_CONFIGS[normalizeRole(role)];
  if (!config) return false;
  return config.accessibleTabs.includes(tab);
}

export type RoleAction =
  | 'edit_settings'
  | 'view_reports'
  | 'export_reports'
  | 'edit_inventory'
  | 'edit_menu'
  | 'manage_staff';

/**
 * Check if a role is authorized to perform a specific sensitive action
 */
export function canPerformAction(
  role: UserRole | string | undefined,
  action: RoleAction
): boolean {
  if (!role) return false;
  const config = ROLE_CONFIGS[normalizeRole(role)];
  if (!config) return false;

  switch (action) {
    case 'edit_settings':
      return config.canEditSettings;
    case 'view_reports':
    case 'export_reports':
      return config.canViewReports;
    case 'edit_inventory':
      return config.canEditInventory;
    case 'edit_menu':
      return config.canEditMenu;
    case 'manage_staff':
      return config.canManageStaff;
    default:
      return false;
  }
}

/**
 * Get role display metadata (legacy roles normalized)
 */
export function getRoleMeta(role: UserRole | string | undefined) {
  return ROLE_CONFIGS[normalizeRole(role)] || ROLE_CONFIGS.staff;
}
