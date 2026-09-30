import { create } from 'zustand';
import {
  Location,
  Profile,
  MenuCategory,
  MenuItem,
  Addon,
  Ingredient,
  Recipe,
  InventoryLog,
  DineTable,
  Order,
  CartItem,
  Customer,
  Offer,
  LocationFeeConfig,
  StaffMember,
  StaffShift,
  DrawerReconciliation,
  ActiveSurface,
  WebTab,
  OrderStatus,
  PaymentMethod,
  OrderType,
  LoyaltyLedger,
  LoyaltyTier,
  CloudSyncState,
  ConnectionStatus,
  PrinterConfig,
  PrintLogEntry,
  TenantBusiness,
  BusinessSubscription,
  BusinessStatus,
  PlatformAuditLog,
  ThemeMode,
} from '../types';
import { supabase, isSupabaseConfigured } from './supabase';
import {
  SEED_LOCATION,
  SEED_PROFILES,
  SEED_CATEGORIES,
  SEED_MENU_ITEMS,
  SEED_ADDONS,
  SEED_INGREDIENTS,
  SEED_RECIPES,
  SEED_TABLES,
  SEED_CUSTOMERS,
  SEED_OFFERS,
  SEED_FEE_CONFIG,
  SEED_ORDERS,
  SEED_STAFF,
  SEED_SHIFTS,
  SEED_RECONCILIATIONS,
  SEED_LOYALTY_LEDGERS,
} from '../data/seedData';
import {
  INITIAL_TENANT_BUSINESSES,
  INITIAL_PLATFORM_AUDIT_LOGS,
} from '../data/saasSeedData';
import { realtimeService } from './realtimeService';

export const getCustomerTier = (points: number): LoyaltyTier => {
  if (points > 5000) return 'Platinum';
  if (points >= 2001) return 'Gold';
  if (points >= 501) return 'Silver';
  return 'Bronze';
};

interface TsosState {
  // Navigation & Surface
  activeSurface: ActiveSurface;
  setActiveSurface: (surface: ActiveSurface) => void;
  activeWebTab: WebTab;
  setActiveWebTab: (tab: WebTab) => void;
  
  // Theme & Appearance
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  toggleThemeMode: () => void;
  
  // Auth & Profile & Scoped Tenant
  currentProfile: Profile;
  setCurrentProfile: (profile: Partial<Profile>) => void;
  location: Location;
  setLocation: (loc: Location) => void;
  availableLocations: Location[];
  currentTenant: TenantBusiness | null;
  setCurrentTenant: (tenant: TenantBusiness | null) => void;
  impersonatedTenant: TenantBusiness | null;
  setImpersonatedTenant: (tenant: TenantBusiness | null) => void;
  switchTenantScope: (slugOrId: string) => boolean;
  
  // Menu
  categories: MenuCategory[];
  menuItems: MenuItem[];
  loadMenuFromCloud: () => Promise<void>;
  addons: Addon[];
  toggleItemAvailability: (itemId: string) => void;
  addMenuItem: (item: Omit<MenuItem, 'id'>) => void;
  updateMenuItem: (item: MenuItem) => void;
  deleteMenuItem: (itemId: string) => void;
  addCategory: (name: string) => void;

  // Inventory & Recipes
  ingredients: Ingredient[];
  recipes: Recipe[];
  inventoryLogs: InventoryLog[];
  restockIngredient: (id: string, addQty: number, reason?: string) => void;
  bulkRestockIngredients: (items: { id: string; addQty: number }[], reason?: string) => void;
  updateIngredient: (ingredient: Ingredient) => void;

  // Tables
  tables: DineTable[];
  selectedTableId: string | null;
  setSelectedTableId: (id: string | null) => void;
  updateTableStatus: (tableId: string, status: 'free' | 'occupied' | 'reserved') => void;
  addTable: (label: string, seats: number) => void;

  // POS & Cart
  cart: CartItem[];
  orderType: OrderType;
  setOrderType: (type: OrderType) => void;
  addToCart: (item: MenuItem, variantId?: string, addonIds?: string[], notes?: string) => void;
  updateCartQty: (cartItemId: string, delta: number) => void;
  removeFromCart: (cartItemId: string) => void;
  clearCart: () => void;
  
  // Customer & Offers in POS
  selectedCustomerId: string | null;
  setSelectedCustomerId: (id: string | null) => void;
  appliedOffer: Offer | null;
  applyOffer: (code: string) => { success: boolean; message: string };
  removeOffer: () => void;
  redeemedPoints: number;
  setRedeemedPoints: (points: number) => void;

  // Orders & KDS
  orders: Order[];
  createOrder: (params: {
    paymentMethod: PaymentMethod;
    customPlacedBy?: string;
    customerNotes?: string;
  }) => Order;
  advanceOrderStatus: (orderId: string) => void;
  cancelOrder: (orderId: string, reason?: string) => void;
  upsertOrderFromRealtime: (order: Order | any) => void;

  // Customers CRM & Loyalty
  customers: Customer[];
  loyaltyLedgers: LoyaltyLedger[];
  addCustomer: (name: string, phone: string, email?: string) => Customer;
  addLoyaltyAdjustment: (
    customerId: string,
    pointsDelta: number,
    reason: string
  ) => { success: boolean; message: string };

  // Cloud Sync & Connection Health
  cloudSync: CloudSyncState;
  setCloudSyncStatus: (status: ConnectionStatus) => void;
  toggleSimulatedOffline: () => void;
  triggerManualSync: () => Promise<void>;

  // Offers
  offers: Offer[];
  toggleOffer: (offerId: string) => void;
  addOffer: (offer: Omit<Offer, 'id'>) => void;

  // Staff & Shift Management
  staffMembers: StaffMember[];
  shifts: StaffShift[];
  drawerReconciliations: DrawerReconciliation[];
  clockInStaff: (staffId: string, notes?: string) => { success: boolean; message: string };
  clockOutStaff: (
    shiftId: string,
    breakMinutes?: number,
    notes?: string,
    reconciliation?: DrawerReconciliation
  ) => { success: boolean; message: string };
  addDrawerReconciliation: (rec: Omit<DrawerReconciliation, 'id'>) => DrawerReconciliation;
  recordBreak: (shiftId: string, addBreakMinutes: number) => void;
  addManualShift: (shiftData: {
    staff_id: string;
    clock_in: string;
    clock_out: string;
    break_minutes: number;
    hourly_rate?: number;
    notes?: string;
  }) => void;
  updateShift: (shiftId: string, updates: Partial<StaffShift>) => void;
  deleteShift: (shiftId: string) => void;
  addStaffMember: (staff: Omit<StaffMember, 'id' | 'joined_date'>) => void;
  updateStaffMember: (staff: StaffMember) => void;

  // Fee Config & Engine
  feeConfig: LocationFeeConfig;
  updateFeeConfig: (config: Partial<LocationFeeConfig>) => void;

  // Thermal Printer
  printerConfig: PrinterConfig;
  updatePrinterConfig: (partial: Partial<PrinterConfig>) => void;
  printLogs: PrintLogEntry[];
  addPrintLog: (log: Omit<PrintLogEntry, 'id' | 'timestamp'>) => void;
  clearPrintLogs: () => void;

  // Guidance & Onboarding Tour
  guidanceMode: boolean;
  toggleGuidanceMode: () => void;
  isTourOpen: boolean;
  currentTourStep: number;
  startTour: () => void;
  nextTourStep: () => void;
  prevTourStep: () => void;
  closeTour: () => void;

  // Order Tracking surface
  trackedOrderId: string | null;
  setTrackedOrderId: (id: string | null) => void;

  // Realtime Inbound Handlers
  handleInboundOrder: (order: Order) => void;
  handleInboundOrderStatus: (orderId: string, status: OrderStatus) => void;
  handleInboundTableStatus: (tableId: string, status: DineTable['status']) => void;

  // Sound effects
  audioEnabled: boolean;
  toggleAudio: () => void;

  // SuperAdmin & Multi-Tenant SaaS
  tenantBusinesses: TenantBusiness[];
  platformAuditLogs: PlatformAuditLog[];
  activeSuperAdminTab: 'dashboard' | 'businesses' | 'wizard' | 'subscriptions' | 'audit';
  setActiveSuperAdminTab: (tab: 'dashboard' | 'businesses' | 'wizard' | 'subscriptions' | 'audit') => void;
  selectedSuperAdminBusinessId: string | null;
  setSelectedSuperAdminBusinessId: (id: string | null) => void;
  addTenantBusiness: (business: TenantBusiness) => void;
  addTenant: (business: TenantBusiness) => void;
  updateTenantBusiness: (business: TenantBusiness) => void;
  updateBusinessSubscription: (businessId: string, subscription: Partial<BusinessSubscription>) => void;
  setBusinessStatus: (businessId: string, status: BusinessStatus) => void;
  deleteTenantBusiness: (businessId: string, hardDelete?: boolean) => void;
  addPlatformAuditLog: (entry: Omit<PlatformAuditLog, 'id' | 'timestamp'>) => void;

  // Reset
  resetToSeed: () => void;
}

const STORAGE_KEY = 'tsos_app_state_v1';

const DEFAULT_STATE = {
  activeSurface: 'web' as ActiveSurface,
  activeWebTab: 'pos' as WebTab,
  themeMode: (typeof window !== 'undefined' && (localStorage.getItem('tsos_theme_mode') as ThemeMode) ? (localStorage.getItem('tsos_theme_mode') as ThemeMode) : 'tessera') as ThemeMode,
  tenantBusinesses: INITIAL_TENANT_BUSINESSES,
  platformAuditLogs: INITIAL_PLATFORM_AUDIT_LOGS,
  activeSuperAdminTab: 'dashboard' as const,
  selectedSuperAdminBusinessId: null as string | null,
  currentProfile: SEED_PROFILES[0],
  location: SEED_LOCATION,
  currentTenant: INITIAL_TENANT_BUSINESSES[0] || null,
  impersonatedTenant: null as TenantBusiness | null,
  availableLocations: [
    SEED_LOCATION,
    {
      id: 'loc-demo-02',
      business_id: 'biz_coolkafe_99',
      name: 'CoolKafe Express Roastery (Airport Road)',
      slug: 'coolkafe-express',
      address: 'Terminal Hub, Airport Road, Bengaluru, KA 560017',
      phone: '+91 98450 54321',
      created_at: '2026-01-01T00:00:00Z',
    },
  ],
  categories: SEED_CATEGORIES,
  menuItems: SEED_MENU_ITEMS,
  addons: SEED_ADDONS,
  ingredients: SEED_INGREDIENTS,
  recipes: SEED_RECIPES,
  inventoryLogs: [
    {
      id: 'log-seed-1',
      ingredient_id: 'ing-coffee',
      ingredient_name: 'Coffee Beans (Arabica)',
      change_qty: 5000,
      reason: 'restock' as const,
      created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'log-seed-2',
      ingredient_id: 'ing-milk',
      ingredient_name: 'Fresh Whole Milk',
      change_qty: 10000,
      reason: 'restock' as const,
      created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    },
  ],
  tables: SEED_TABLES,
  selectedTableId: null as string | null,
  cart: [] as CartItem[],
  orderType: 'dine_in' as OrderType,
  selectedCustomerId: null as string | null,
  appliedOffer: null as Offer | null,
  redeemedPoints: 0,
  orders: SEED_ORDERS,
  customers: SEED_CUSTOMERS,
  loyaltyLedgers: SEED_LOYALTY_LEDGERS,
  cloudSync: {
    status: 'connected' as ConnectionStatus,
    lastSyncedAt: new Date().toISOString(),
    pendingChangesCount: 0,
    latencyMs: 24,
    endpoint: 'PostgreSQL Cloud DB Cluster (asia-southeast1)',
    simulatedOffline: false,
  } as CloudSyncState,
  offers: SEED_OFFERS,
  staffMembers: SEED_STAFF,
  shifts: SEED_SHIFTS,
  drawerReconciliations: SEED_RECONCILIATIONS,
  feeConfig: SEED_FEE_CONFIG,
  printerConfig: {
    connection_type: 'browser' as const,
    paper_width: '80mm' as const,
    ip_address: '192.168.1.200',
    port: 9100,
    bluetooth_device_name: 'POS-80 Thermal',
    auto_print_receipt: true,
    auto_print_kot: false,
    cut_paper: true,
    open_cash_drawer: true,
    print_logo: true,
    receipt_header: 'Welcome to TSOS Cafe & Roastery',
    receipt_footer: 'Thank you for dining with us! Tag us on IG @democafe',
    gstin: '29AABCT1337C1Z0',
    kot_printer_ip: '192.168.1.201:9100',
  } as PrinterConfig,
  printLogs: [
    {
      id: 'plog-seed-1',
      order_id: 'ord-1',
      order_number: 101,
      document_type: 'bill' as const,
      printer_name: 'Epson TM-m30 (Web Bluetooth)',
      interface_type: 'bluetooth' as const,
      paper_width: '80mm' as const,
      status: 'success' as const,
      bytes_sent: 524,
      operator_name: 'Arjun Mehta',
      timestamp: new Date(Date.now() - 14 * 60 * 1000).toISOString(),
    },
    {
      id: 'plog-seed-2',
      order_id: 'ord-2',
      order_number: 102,
      document_type: 'kot' as const,
      printer_name: 'Kitchen Star TSP100 (LAN)',
      interface_type: 'network' as const,
      paper_width: '80mm' as const,
      status: 'failed' as const,
      error_message: 'TCP Connection timed out on port 9100. Host 192.168.1.205 unreachable.',
      bytes_sent: 0,
      operator_name: 'Priya Sharma',
      timestamp: new Date(Date.now() - 28 * 60 * 1000).toISOString(),
    },
    {
      id: 'plog-seed-3',
      order_id: 'ord-2',
      order_number: 102,
      document_type: 'bill' as const,
      printer_name: 'Browser Print Engine',
      interface_type: 'browser' as const,
      paper_width: '80mm' as const,
      status: 'success' as const,
      bytes_sent: 412,
      operator_name: 'Arjun Mehta',
      timestamp: new Date(Date.now() - 26 * 60 * 1000).toISOString(),
    },
    {
      id: 'plog-seed-4',
      order_id: 'ord-3',
      order_number: 103,
      document_type: 'bill' as const,
      printer_name: 'MUNBYN ITPP047 (Web Bluetooth)',
      interface_type: 'bluetooth' as const,
      paper_width: '58mm' as const,
      status: 'failed' as const,
      error_message: 'GATT write error: Bluetooth peripheral disconnected during chunk transmission (buffer underrun).',
      bytes_sent: 128,
      operator_name: 'Rahul Verma',
      timestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    },
    {
      id: 'plog-seed-5',
      document_type: 'test' as const,
      printer_name: 'Sunmi V2 PRO Portable (Web Bluetooth)',
      interface_type: 'bluetooth' as const,
      paper_width: '58mm' as const,
      status: 'success' as const,
      bytes_sent: 198,
      operator_name: 'Arjun Mehta',
      timestamp: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    },
  ] as PrintLogEntry[],
  guidanceMode: true,
  isTourOpen: false,
  currentTourStep: 0,
  trackedOrderId: 'ord-102',
  audioEnabled: true,
};

const getInitialState = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        ...DEFAULT_STATE,
        ...parsed,
        cart: Array.isArray(parsed.cart) ? parsed.cart : [],
        categories: Array.isArray(parsed.categories) && parsed.categories.length > 0 ? parsed.categories : DEFAULT_STATE.categories,
        menuItems: Array.isArray(parsed.menuItems) && parsed.menuItems.length > 0 ? parsed.menuItems : DEFAULT_STATE.menuItems,
        addons: Array.isArray(parsed.addons) ? parsed.addons : DEFAULT_STATE.addons,
        ingredients: Array.isArray(parsed.ingredients) && parsed.ingredients.length > 0 ? parsed.ingredients : DEFAULT_STATE.ingredients,
        recipes: Array.isArray(parsed.recipes) && parsed.recipes.length > 0 ? parsed.recipes : DEFAULT_STATE.recipes,
        inventoryLogs: Array.isArray(parsed.inventoryLogs) ? parsed.inventoryLogs : DEFAULT_STATE.inventoryLogs,
        tables: Array.isArray(parsed.tables) && parsed.tables.length > 0 ? parsed.tables : DEFAULT_STATE.tables,
        orders: Array.isArray(parsed.orders)
          ? parsed.orders.map((o: any) => ({
              ...o,
              items: Array.isArray(o?.items) ? o.items : [],
            }))
          : DEFAULT_STATE.orders,
        customers: Array.isArray(parsed.customers) && parsed.customers.length > 0 ? parsed.customers : DEFAULT_STATE.customers,
        loyaltyLedgers: Array.isArray(parsed.loyaltyLedgers) && parsed.loyaltyLedgers.length > 0
          ? parsed.loyaltyLedgers
          : DEFAULT_STATE.loyaltyLedgers,
        offers: Array.isArray(parsed.offers) && parsed.offers.length > 0 ? parsed.offers : DEFAULT_STATE.offers,
        staffMembers: Array.isArray(parsed.staffMembers) && parsed.staffMembers.length > 0 ? parsed.staffMembers : DEFAULT_STATE.staffMembers,
        shifts: Array.isArray(parsed.shifts) && parsed.shifts.length > 0 ? parsed.shifts : DEFAULT_STATE.shifts,
        drawerReconciliations: Array.isArray(parsed.drawerReconciliations) && parsed.drawerReconciliations.length > 0
          ? parsed.drawerReconciliations
          : DEFAULT_STATE.drawerReconciliations,
        feeConfig: parsed.feeConfig || DEFAULT_STATE.feeConfig,
        tenantBusinesses: Array.isArray(parsed.tenantBusinesses) && parsed.tenantBusinesses.length > 0
          ? parsed.tenantBusinesses
          : DEFAULT_STATE.tenantBusinesses,
        platformAuditLogs: Array.isArray(parsed.platformAuditLogs) && parsed.platformAuditLogs.length > 0
          ? parsed.platformAuditLogs
          : DEFAULT_STATE.platformAuditLogs,
        activeSurface: (parsed.activeSurface || 'web') as ActiveSurface,
        activeWebTab: (parsed.activeWebTab || 'pos') as WebTab,
        activeSuperAdminTab: 'dashboard' as const,
        selectedSuperAdminBusinessId: null,
        selectedTableId: null,
        selectedCustomerId: null,
        appliedOffer: null,
        redeemedPoints: 0,
      };
    }
  } catch (e) {
    console.warn('Failed to parse cached TSOS state, loading defaults', e);
  }

  return { ...DEFAULT_STATE };
};

export const useTsosStore = create<TsosState>((set, get) => ({
  ...getInitialState(),

  setActiveSurface: (surface) => set({ activeSurface: surface }),
  setActiveWebTab: (tab) => set({ activeWebTab: tab }),

  themeMode: (typeof window !== 'undefined' && (localStorage.getItem('tsos_theme_mode') as ThemeMode) ? (localStorage.getItem('tsos_theme_mode') as ThemeMode) : 'tessera') as ThemeMode,
  setThemeMode: (mode) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('tsos_theme_mode', mode);
      document.documentElement.setAttribute('data-theme', mode);
      document.documentElement.classList.remove('dark', 'obsidian', 'tessera');
      if (mode === 'dark' || mode === 'obsidian') {
        document.documentElement.classList.add('dark', 'obsidian');
      } else if (mode === 'tessera') {
        document.documentElement.classList.add('tessera');
      }
    }
    set({ themeMode: mode });
  },
  toggleThemeMode: () => {
    // Cycle: tessera → dark → tessera (keeps the editorial dark language; warm is reachable via setThemeMode).
    const current = get().themeMode;
    const isDark = current === 'dark' || current === 'obsidian';
    get().setThemeMode(isDark ? 'tessera' : 'dark');
  },

  setCurrentProfile: (profile) =>
    set((state) => ({ currentProfile: { ...state.currentProfile, ...profile } })),

  toggleItemAvailability: (itemId) =>
    set((state) => ({
      menuItems: state.menuItems.map((item) =>
        item.id === itemId ? { ...item, is_available: !item.is_available } : item
      ),
    })),

  loadMenuFromCloud: async () => {
    if (!isSupabaseConfigured()) return;
    const tenant = get().currentTenant;
    if (!tenant) return;
    try {
      // Resolve the live tenant UUID: currentTenant.id may be a local seed id
      // (e.g. 'biz_coolkafe_99') that does not exist in the cloud tenants table.
      const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      let tenantId = tenant.id;
      if (!UUID_RE.test(tenantId)) {
        const { data: tRow, error: tErr } = await supabase
          .from('tenants')
          .select('id')
          .eq('slug', tenant.slug)
          .maybeSingle();
        if (tErr) throw tErr;
        if (!tRow) {
          console.info('[TSOS] Tenant not found in cloud — keeping local seed menu.');
          return;
        }
        tenantId = tRow.id;
      }

      const { data: cats, error: catErr } = await supabase
        .from('categories')
        .select('id, location_id, name, sort_order, icon')
        .eq('tenant_id', tenantId)
        .order('sort_order', { ascending: true });
      if (catErr) throw catErr;

      const { data: items, error: itemErr } = await supabase
        .from('menu_items')
        .select(
          'id, location_id, category_id, name, description, price, image_url, is_veg, is_available, tax_rate_pct'
        )
        .eq('tenant_id', tenantId)
        .order('name', { ascending: true });
      if (itemErr) throw itemErr;

      if (!cats || cats.length === 0 || !items || items.length === 0) {
        console.info('[TSOS] Cloud menu empty for tenant — keeping local seed menu.');
        return;
      }

      set({
        categories: cats.map((c: any) => ({
          id: c.id,
          location_id: c.location_id || '',
          name: c.name,
          sort_order: c.sort_order ?? 0,
          icon: c.icon || 'Coffee',
        })),
        menuItems: items.map((m: any) => ({
          id: m.id,
          location_id: m.location_id || '',
          category_id: m.category_id || '',
          name: m.name,
          description: m.description || '',
          price: Number(m.price),
          image_url: m.image_url || '',
          is_veg: m.is_veg ?? true,
          is_available: m.is_available ?? true,
          tax_rate_pct: Number(m.tax_rate_pct ?? 5),
        })),
      });
      console.info(
        `[TSOS] Menu loaded from Supabase cloud (${cats.length} categories, ${items.length} items).`
      );
    } catch (err: any) {
      console.warn('[TSOS] Cloud menu fetch failed — using local seed menu:', err?.message || err);
    }
  },

  addMenuItem: (newItemData) =>
    set((state) => ({
      menuItems: [
        ...state.menuItems,
        {
          ...newItemData,
          id: `item-${Date.now()}`,
        },
      ],
    })),

  updateMenuItem: (updatedItem) =>
    set((state) => ({
      menuItems: state.menuItems.map((item) =>
        item.id === updatedItem.id ? updatedItem : item
      ),
    })),

  deleteMenuItem: (itemId) =>
    set((state) => ({
      menuItems: state.menuItems.filter((i) => i.id !== itemId),
    })),

  addCategory: (name) =>
    set((state) => ({
      categories: [
        ...state.categories,
        {
          id: `cat-${Date.now()}`,
          location_id: state.location.id,
          name,
          sort_order: state.categories.length + 1,
        },
      ],
    })),

  restockIngredient: (id, addQty, reason = 'restock') =>
    set((state) => {
      const ing = state.ingredients.find((i) => i.id === id);
      if (!ing) return state;
      const newStock = ing.stock_qty + addQty;
      const newLog: InventoryLog = {
        id: `log-${Date.now()}`,
        ingredient_id: id,
        ingredient_name: ing.name,
        change_qty: addQty,
        reason: (reason as any) || 'restock',
        created_at: new Date().toISOString(),
      };
      return {
        ingredients: state.ingredients.map((i) =>
          i.id === id ? { ...i, stock_qty: newStock } : i
        ),
        inventoryLogs: [newLog, ...state.inventoryLogs],
      };
    }),

  bulkRestockIngredients: (items, reason = 'bulk restock') =>
    set((state) => {
      if (!items || items.length === 0) return state;
      const newLogs: InventoryLog[] = [];
      const stockMap = new Map<string, number>();
      items.forEach((it, idx) => {
        stockMap.set(it.id, it.addQty);
        const ing = state.ingredients.find((i) => i.id === it.id);
        if (ing) {
          newLogs.push({
            id: `log-${Date.now()}-${idx}`,
            ingredient_id: it.id,
            ingredient_name: ing.name,
            change_qty: it.addQty,
            reason: (reason as any) || 'restock',
            created_at: new Date().toISOString(),
          });
        }
      });
      return {
        ingredients: state.ingredients.map((i) => {
          const add = stockMap.get(i.id);
          return add ? { ...i, stock_qty: i.stock_qty + add } : i;
        }),
        inventoryLogs: [...newLogs, ...state.inventoryLogs],
      };
    }),

  updateIngredient: (ingredient) =>
    set((state) => ({
      ingredients: state.ingredients.map((i) =>
        i.id === ingredient.id ? ingredient : i
      ),
    })),

  setSelectedTableId: (id) => set({ selectedTableId: id }),

  updateTableStatus: (tableId, status) =>
    set((state) => ({
      tables: state.tables.map((t) => (t.id === tableId ? { ...t, status } : t)),
    })),

  addTable: (label, seats) =>
    set((state) => ({
      tables: [
        ...state.tables,
        {
          id: `tbl-${Date.now()}`,
          location_id: state.location.id,
          label,
          seats,
          qr_token: `qr-demo-${label.toLowerCase().replace(/\s+/g, '-')}`,
          status: 'free',
        },
      ],
    })),

  setOrderType: (type) => set({ orderType: type }),

  addToCart: (menuItem, variantId, addonIds = [], notes = '') => {
    set((state) => {
      const variant = menuItem.variants?.find((v) => v.id === variantId);
      const safeStateAddons = state.addons || [];
      const safeAddonIds = addonIds || [];
      const selectedAddons = safeStateAddons
        .filter((a) => safeAddonIds.includes(a.id))
        .map((a) => ({ addon_id: a.id, name: a.name, price: a.price }));

      const basePrice = menuItem.price + (variant ? variant.price_delta : 0);
      const addonsPrice = selectedAddons.reduce((acc, curr) => acc + (curr?.price || 0), 0);
      const unitPrice = basePrice + addonsPrice;

      const lineId = `${menuItem.id}-${variantId || 'base'}-${[...safeAddonIds].sort().join(',')}`;
      const safeStateCart = state.cart || [];
      const existing = safeStateCart.find((item) => item.id === lineId);

      if (existing) {
        return {
          cart: safeStateCart.map((item) =>
            item.id === lineId
              ? {
                  ...item,
                  qty: item.qty + 1,
                  item_total: (item.qty + 1) * item.unit_price,
                  notes: notes || item.notes,
                }
              : item
          ),
        };
      }

      const newCartItem: CartItem = {
        id: lineId,
        menu_item: menuItem,
        variant,
        addons: selectedAddons,
        qty: 1,
        unit_price: unitPrice,
        item_total: unitPrice,
        notes,
      };

      return { cart: [...safeStateCart, newCartItem] };
    });
  },

  updateCartQty: (cartItemId, delta) => {
    set((state) => {
      const item = state.cart.find((i) => i.id === cartItemId);
      if (!item) return state;
      const newQty = item.qty + delta;
      if (newQty <= 0) {
        return { cart: state.cart.filter((i) => i.id !== cartItemId) };
      }
      return {
        cart: state.cart.map((i) =>
          i.id === cartItemId
            ? { ...i, qty: newQty, item_total: newQty * i.unit_price }
            : i
        ),
      };
    });
  },

  removeFromCart: (cartItemId) =>
    set((state) => ({
      cart: state.cart.filter((i) => i.id !== cartItemId),
    })),

  clearCart: () =>
    set({
      cart: [],
      selectedTableId: null,
      selectedCustomerId: null,
      appliedOffer: null,
      redeemedPoints: 0,
    }),

  setSelectedCustomerId: (id) => set({ selectedCustomerId: id }),

  applyOffer: (code) => {
    const { offers, cart } = get();
    const safeCart = cart || [];
    const subtotal = safeCart.reduce((acc, i) => acc + i.item_total, 0);
    const offer = (offers || []).find(
      (o) => o.code.toUpperCase() === code.trim().toUpperCase() && o.is_active
    );

    if (!offer) {
      return { success: false, message: 'Invalid or inactive coupon code.' };
    }
    if (subtotal < offer.min_order_value) {
      return {
        success: false,
        message: `Min order value for ${offer.code} is ₹${offer.min_order_value}. Current subtotal is ₹${subtotal}.`,
      };
    }

    set({ appliedOffer: offer });
    return { success: true, message: `Offer "${offer.title}" applied!` };
  },

  removeOffer: () => set({ appliedOffer: null }),

  setRedeemedPoints: (points) => set({ redeemedPoints: points }),

  createOrder: ({ paymentMethod, customPlacedBy, customerNotes }) => {
    const state = get();
    const safeCart = state.cart || [];
    const subtotal = safeCart.reduce((acc, i) => acc + i.item_total, 0);
    const taxTotal = +(subtotal * 0.05).toFixed(2); // 5% GST standard

    let discountTotal = 0;
    if (state.appliedOffer) {
      if (state.appliedOffer.type === 'percent') {
        discountTotal = +(subtotal * (state.appliedOffer.value / 100)).toFixed(2);
      } else if (state.appliedOffer.type === 'flat') {
        discountTotal = Math.min(subtotal, state.appliedOffer.value);
      }
    }

    // Points discount (1 pt = ₹1)
    if (state.redeemedPoints > 0) {
      discountTotal += state.redeemedPoints;
    }

    const { feeConfig } = state;
    const feePayer = feeConfig.default_fee_payer;
    const platformFee = feeConfig.per_order_fee;

    // If customer pays, platform fee is added to grand total. If cafe pays, absorbed.
    const grandTotal = Math.max(
      0,
      +(subtotal + taxTotal - discountTotal + (feePayer === 'customer' ? platformFee : 0)).toFixed(2)
    );

    const nextOrderNumber =
      state.orders.length > 0 ? Math.max(...state.orders.map((o) => o.order_number)) + 1 : 101;

    const table = state.tables.find((t) => t.id === state.selectedTableId);
    const customer = state.customers.find((c) => c.id === state.selectedCustomerId);
    const pointsToEarn = Math.floor(subtotal / 10);
    const pointsToRedeem = state.redeemedPoints > 0 ? state.redeemedPoints : 0;

    const newOrder: Order = {
      id: `ord-${Date.now()}`,
      order_number: nextOrderNumber,
      location_id: state.location.id,
      table_id: table ? table.id : undefined,
      table_label: table ? table.label : undefined,
      customer_id: customer ? customer.id : undefined,
      customer_name: customer ? customer.name : (customPlacedBy?.includes('QR') ? 'Table Guest' : 'Walk-in Guest'),
      customer_phone: customer ? customer.phone : undefined,
      order_type: state.orderType,
      status: 'new',
      placed_by: customPlacedBy || `${state.currentProfile.name} (${state.currentProfile.role})`,
      subtotal,
      tax_total: taxTotal,
      discount_total: discountTotal,
      platform_fee: platformFee,
      fee_payer: feePayer,
      grand_total: grandTotal,
      payment_status: 'completed',
      payment_method: paymentMethod,
      loyalty_points_earned: pointsToEarn,
      loyalty_points_redeemed: pointsToRedeem > 0 ? pointsToRedeem : undefined,
      items: state.cart.map((ci) => ({
        id: `oi-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        order_id: `ord-${Date.now()}`,
        menu_item_id: ci.menu_item.id,
        menu_item_name: ci.menu_item.name,
        variant_id: ci.variant?.id,
        variant_name: ci.variant?.name,
        qty: ci.qty,
        unit_price: ci.unit_price,
        item_total: ci.item_total,
        notes: ci.notes,
        addons: ci.addons,
      })),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      notes: customerNotes,
    };

    // Update table status if dine_in
    let updatedTables = state.tables;
    if (table) {
      updatedTables = state.tables.map((t) =>
        t.id === table.id ? { ...t, status: 'occupied', current_order_id: newOrder.id } : t
      );
    }

    // Deduct redeemed points from customer immediately if any & log in ledger
    let updatedCustomers = state.customers;
    let updatedLoyaltyLedgers = state.loyaltyLedgers;
    if (customer && pointsToRedeem > 0) {
      const newBal = Math.max(0, customer.loyalty_points - pointsToRedeem);
      updatedCustomers = state.customers.map((c) =>
        c.id === customer.id
          ? {
              ...c,
              loyalty_points: newBal,
              tier: getCustomerTier(newBal),
            }
          : c
      );
      const redemptionLog: LoyaltyLedger = {
        id: `led-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        customer_id: customer.id,
        points_delta: -pointsToRedeem,
        reason: `Redeemed at POS for Order #${nextOrderNumber}`,
        ref_order_id: newOrder.id,
        created_at: new Date().toISOString(),
        balance_after: newBal,
      };
      updatedLoyaltyLedgers = [redemptionLog, ...updatedLoyaltyLedgers];
    }

    // Check cloud sync queue increment if offline
    const isOffline = state.cloudSync.status === 'offline' || state.cloudSync.simulatedOffline;
    const updatedCloudSync = isOffline
      ? { ...state.cloudSync, pendingChangesCount: state.cloudSync.pendingChangesCount + 1 }
      : state.cloudSync;

    // Deduct raw materials via recipes_bom immediately upon order placement/tender
    let updatedIngredients = [...state.ingredients];
    let newInventoryLogs: InventoryLog[] = [];
    for (const item of newOrder.items) {
      const itemRecipes = state.recipes.filter((r) => r.menu_item_id === item.menu_item_id);
      for (const rec of itemRecipes) {
        const deductTotal = rec.qty_consumed * item.qty;
        const ingIndex = updatedIngredients.findIndex((i) => i.id === rec.ingredient_id);
        if (ingIndex !== -1) {
          const currentIng = updatedIngredients[ingIndex];
          const newStock = Math.max(0, currentIng.stock_qty - deductTotal);
          updatedIngredients[ingIndex] = { ...currentIng, stock_qty: newStock };
          newInventoryLogs.push({
            id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
            ingredient_id: currentIng.id,
            ingredient_name: currentIng.name,
            change_qty: -deductTotal,
            reason: 'order_consumed',
            ref_order_id: newOrder.id,
            created_at: new Date().toISOString(),
          });
        }
      }
    }
    newOrder.inventory_deducted = true;

    // Clear cart and update store
    set((s) => ({
      orders: [newOrder, ...s.orders],
      tables: updatedTables,
      customers: updatedCustomers,
      loyaltyLedgers: updatedLoyaltyLedgers,
      ingredients: updatedIngredients,
      inventoryLogs: [...newInventoryLogs, ...s.inventoryLogs],
      cloudSync: updatedCloudSync,
      cart: [],
      selectedTableId: null,
      selectedCustomerId: null,
      appliedOffer: null,
      redeemedPoints: 0,
      trackedOrderId: newOrder.id,
    }));

    // Sync order to Supabase Postgres (with automatic offline fallback queue)
    const tenantId = state.currentTenant?.id || 'biz_coolkafe_99';
    const locationId = state.location.id;
    realtimeService.syncOrderToSupabase(newOrder, tenantId, locationId).then((res) => {
      if (res.queued) {
        set((s) => ({
          cloudSync: {
            ...s.cloudSync,
            pendingChangesCount: s.cloudSync.pendingChangesCount + 1,
          },
        }));
      }
    }).catch((err) => {
      console.warn('Realtime syncOrderToSupabase caught:', err);
    });

    return newOrder;
  },

  advanceOrderStatus: (orderId) => {
    const state = get();
    const order = state.orders.find((o) => o.id === orderId);
    if (!order) return;

    let nextStatus: OrderStatus = order.status;
    if (order.status === 'new') nextStatus = 'preparing';
    else if (order.status === 'preparing') nextStatus = 'ready';
    else if (order.status === 'ready') nextStatus = 'completed';
    else return;

    // Real-time synchronization to Supabase
    realtimeService.updateOrderStatus(orderId, nextStatus).catch(() => {});

    // If transitioning to COMPLETED, execute key business triggers:
    // 1. Inventory auto-deduct via recipes (if not already deducted)
    // 2. Loyalty points awarded (1 point per ₹10 spent)
    // 3. Table freed
    // 4. Fee engine counter increment & auto-flip check
    let updatedIngredients = [...state.ingredients];
    let newLogs: InventoryLog[] = [];
    let newLoyaltyLogs: LoyaltyLedger[] = [];
    let updatedCustomers = [...state.customers];
    let updatedTables = [...state.tables];
    let updatedFeeConfig = { ...state.feeConfig };

    if (nextStatus === 'completed') {
      // 1. Auto-deduct inventory if not already deducted on sale
      if (!order.inventory_deducted) {
        for (const item of order.items) {
          const itemRecipes = state.recipes.filter((r) => r.menu_item_id === item.menu_item_id);
          for (const rec of itemRecipes) {
            const deductTotal = rec.qty_consumed * item.qty;
            const ingIndex = updatedIngredients.findIndex((i) => i.id === rec.ingredient_id);
            if (ingIndex !== -1) {
              const currentIng = updatedIngredients[ingIndex];
              const newStock = Math.max(0, currentIng.stock_qty - deductTotal);
              updatedIngredients[ingIndex] = { ...currentIng, stock_qty: newStock };
              newLogs.push({
                id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
                ingredient_id: currentIng.id,
                ingredient_name: currentIng.name,
                change_qty: -deductTotal,
                reason: 'order_consumed',
                ref_order_id: order.id,
                created_at: new Date().toISOString(),
              });
            }
          }
        }
      }

      // 2. Loyalty points (1 point per ₹10 spent on subtotal)
      if (order.customer_id) {
        const pointsEarned =
          order.loyalty_points_earned !== undefined
            ? order.loyalty_points_earned
            : Math.floor(order.subtotal / 10);
        if (pointsEarned > 0) {
          const cust = state.customers.find((c) => c.id === order.customer_id);
          const currentBal = cust ? cust.loyalty_points : 0;
          const newBal = currentBal + pointsEarned;
          updatedCustomers = updatedCustomers.map((c) => {
            if (c.id === order.customer_id) {
              const updatedSpent = c.total_spent + order.grand_total;
              return {
                ...c,
                loyalty_points: newBal,
                total_orders: c.total_orders + 1,
                total_spent: updatedSpent,
                tier: getCustomerTier(newBal),
              };
            }
            return c;
          });
          newLoyaltyLogs.push({
            id: `led-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
            customer_id: order.customer_id,
            points_delta: pointsEarned,
            reason: `Earned from Order #${order.order_number} (₹${order.subtotal} value)`,
            ref_order_id: order.id,
            created_at: new Date().toISOString(),
            balance_after: newBal,
          });
        }
      }

      // 3. Free table
      if (order.table_id) {
        updatedTables = updatedTables.map((t) =>
          t.id === order.table_id ? { ...t, status: 'free', current_order_id: undefined } : t
        );
      }

      // 4. Update Fee Engine & Auto-flip
      const newCount = updatedFeeConfig.period_order_count + 1;
      let newPayer = updatedFeeConfig.default_fee_payer;

      if (
        updatedFeeConfig.auto_flip_enabled &&
        newCount >= updatedFeeConfig.customer_paid_order_limit &&
        updatedFeeConfig.default_fee_payer === 'cafe'
      ) {
        newPayer = 'customer';
      }

      updatedFeeConfig = {
        ...updatedFeeConfig,
        period_order_count: newCount,
        default_fee_payer: newPayer,
      };
    }

    set((s) => ({
      orders: s.orders.map((o) =>
        o.id === orderId
          ? { ...o, status: nextStatus, updated_at: new Date().toISOString() }
          : o
      ),
      ingredients: updatedIngredients,
      inventoryLogs: [...newLogs, ...s.inventoryLogs],
      customers: updatedCustomers,
      loyaltyLedgers: [...newLoyaltyLogs, ...s.loyaltyLedgers],
      tables: updatedTables,
      feeConfig: updatedFeeConfig,
    }));
  },

  cancelOrder: (orderId, reason = 'Customer cancelled') => {
    const state = get();
    const order = state.orders.find((o) => o.id === orderId);
    if (!order) return;

    let updatedTables = state.tables;
    if (order.table_id) {
      updatedTables = state.tables.map((t) =>
        t.id === order.table_id ? { ...t, status: 'free', current_order_id: undefined } : t
      );
    }

    // Auto-restock raw materials if order was already deducted or completed
    let updatedIngredients = [...state.ingredients];
    let newLogs: InventoryLog[] = [];
    if (order.inventory_deducted || order.status === 'completed') {
      for (const item of order.items) {
        const itemRecipes = state.recipes.filter((r) => r.menu_item_id === item.menu_item_id);
        for (const rec of itemRecipes) {
          const restockTotal = rec.qty_consumed * item.qty;
          const ingIndex = updatedIngredients.findIndex((i) => i.id === rec.ingredient_id);
          if (ingIndex !== -1) {
            const currentIng = updatedIngredients[ingIndex];
            const newStock = currentIng.stock_qty + restockTotal;
            updatedIngredients[ingIndex] = { ...currentIng, stock_qty: newStock };
            newLogs.push({
              id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
              ingredient_id: currentIng.id,
              ingredient_name: currentIng.name,
              change_qty: restockTotal,
              reason: 'restock',
              ref_order_id: order.id,
              created_at: new Date().toISOString(),
            });
          }
        }
      }
    }

    set((s) => ({
      orders: s.orders.map((o) =>
        o.id === orderId
          ? { ...o, status: 'cancelled', notes: reason, updated_at: new Date().toISOString() }
          : o
      ),
      tables: updatedTables,
      ingredients: updatedIngredients,
      inventoryLogs: [...newLogs, ...s.inventoryLogs],
    }));
  },

  handleInboundOrder: (inboundOrder) => {
    set((s) => {
      const exists = s.orders.some((o) => o.id === inboundOrder.id);
      if (exists) {
        return {
          orders: s.orders.map((o) => (o.id === inboundOrder.id ? { ...o, ...inboundOrder } : o)),
        };
      }
      return {
        orders: [inboundOrder, ...s.orders],
      };
    });
  },

  handleInboundOrderStatus: (orderId, status) => {
    set((s) => ({
      orders: s.orders.map((o) =>
        o.id === orderId ? { ...o, status, updated_at: new Date().toISOString() } : o
      ),
    }));
  },

  handleInboundTableStatus: (tableId, status) => {
    set((s) => ({
      tables: s.tables.map((t) => (t.id === tableId ? { ...t, status } : t)),
    }));
  },

  addCustomer: (name, phone, email) => {
    const newCust: Customer = {
      id: `cust-${Date.now()}`,
      business_id: get().location.business_id,
      name,
      phone,
      email,
      loyalty_points: 25, // Welcome bonus of 25 loyalty points!
      total_orders: 0,
      total_spent: 0,
      created_at: new Date().toISOString(),
      tier: 'Bronze',
    };
    const welcomeLog: LoyaltyLedger = {
      id: `led-${Date.now()}`,
      customer_id: newCust.id,
      points_delta: 25,
      reason: 'New Member Registration Bonus',
      created_at: new Date().toISOString(),
      balance_after: 25,
    };
    const isOffline = get().cloudSync.status === 'offline' || get().cloudSync.simulatedOffline;
    set((s) => ({
      customers: [newCust, ...s.customers],
      loyaltyLedgers: [welcomeLog, ...s.loyaltyLedgers],
      cloudSync: isOffline
        ? { ...s.cloudSync, pendingChangesCount: s.cloudSync.pendingChangesCount + 1 }
        : s.cloudSync,
    }));
    return newCust;
  },

  addLoyaltyAdjustment: (customerId, pointsDelta, reason) => {
    const state = get();
    const cust = state.customers.find((c) => c.id === customerId);
    if (!cust) return { success: false, message: 'Customer not found' };

    const newBalance = Math.max(0, cust.loyalty_points + pointsDelta);
    const newTier = getCustomerTier(newBalance);
    const log: LoyaltyLedger = {
      id: `led-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      customer_id: customerId,
      points_delta: pointsDelta,
      reason: reason || (pointsDelta >= 0 ? 'Staff Points Bonus' : 'Staff Points Adjustment'),
      created_at: new Date().toISOString(),
      balance_after: newBalance,
    };

    const isOffline = state.cloudSync.status === 'offline' || state.cloudSync.simulatedOffline;
    set((s) => ({
      customers: s.customers.map((c) =>
        c.id === customerId
          ? {
              ...c,
              loyalty_points: newBalance,
              tier: newTier,
            }
          : c
      ),
      loyaltyLedgers: [log, ...s.loyaltyLedgers],
      cloudSync: isOffline
        ? { ...s.cloudSync, pendingChangesCount: s.cloudSync.pendingChangesCount + 1 }
        : s.cloudSync,
    }));

    return {
      success: true,
      message: `Adjusted ${pointsDelta >= 0 ? '+' : ''}${pointsDelta} points. New balance: ${newBalance} pts (${newTier} tier).`,
    };
  },

  setCloudSyncStatus: (status) =>
    set((s) => ({
      cloudSync: {
        ...s.cloudSync,
        status,
        latencyMs: status === 'offline' ? 0 : s.cloudSync.latencyMs,
      },
    })),

  toggleSimulatedOffline: () => {
    const current = get().cloudSync;
    const nextSimulated = !current.simulatedOffline;
    const isActuallyOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    const nextStatus: ConnectionStatus = nextSimulated
      ? 'offline'
      : isActuallyOnline
      ? 'connected'
      : 'offline';

    set({
      cloudSync: {
        ...current,
        simulatedOffline: nextSimulated,
        status: nextStatus,
        latencyMs: nextStatus === 'offline' ? 0 : 26,
      },
    });
  },

  triggerManualSync: async () => {
    set((s) => ({
      cloudSync: { ...s.cloudSync, status: 'syncing' },
    }));

    try {
      const flushed = await realtimeService.flushOfflineQueue();
      set((s) => ({
        cloudSync: {
          ...s.cloudSync,
          status: 'connected',
          pendingChangesCount: Math.max(0, s.cloudSync.pendingChangesCount - flushed),
          lastSyncedAt: new Date().toISOString(),
          latencyMs: Math.floor(18 + Math.random() * 12),
        },
      }));
    } catch {
      set((s) => ({
        cloudSync: {
          ...s.cloudSync,
          status: 'connected',
          lastSyncedAt: new Date().toISOString(),
        },
      }));
    }
  },

  upsertOrderFromRealtime: (incomingOrder: any) => {
    set((state) => {
      const existingIdx = state.orders.findIndex(
        (o) => o.id === incomingOrder.id || (incomingOrder.order_number && o.order_number === incomingOrder.order_number)
      );
      if (existingIdx !== -1) {
        const updated = [...state.orders];
        updated[existingIdx] = { ...updated[existingIdx], ...incomingOrder };
        return { orders: updated };
      }
      return { orders: [incomingOrder, ...state.orders] };
    });
  },

  toggleOffer: (offerId) =>
    set((state) => ({
      offers: state.offers.map((o) =>
        o.id === offerId ? { ...o, is_active: !o.is_active } : o
      ),
    })),

  addOffer: (offerData) =>
    set((state) => ({
      offers: [
        ...state.offers,
        {
          ...offerData,
          id: `off-${Date.now()}`,
        },
      ],
    })),

  updateFeeConfig: (configUpdate) =>
    set((state) => ({
      feeConfig: {
        ...state.feeConfig,
        ...configUpdate,
      },
    })),

  // Staff & Shifts
  clockInStaff: (staffId, notes) => {
    const state = get();
    const staff = state.staffMembers.find((s) => s.id === staffId);
    if (!staff) {
      return { success: false, message: 'Staff member not found' };
    }
    const alreadyClockedIn = state.shifts.some(
      (s) => s.staff_id === staffId && s.status === 'active'
    );
    if (alreadyClockedIn) {
      return { success: false, message: `${staff.name} is already clocked in` };
    }

    const newShift: StaffShift = {
      id: `shift-${Date.now()}`,
      staff_id: staff.id,
      staff_name: staff.name,
      role: staff.role,
      clock_in: new Date().toISOString(),
      break_minutes: 0,
      hourly_rate: staff.hourly_rate,
      status: 'active',
      notes: notes || undefined,
    };

    set((s) => ({
      shifts: [newShift, ...s.shifts],
    }));

    return { success: true, message: `${staff.name} clocked in successfully` };
  },

  clockOutStaff: (shiftId, breakMinutes, notes, reconciliation) => {
    const state = get();
    const shift = state.shifts.find((s) => s.id === shiftId);
    if (!shift) {
      return { success: false, message: 'Shift not found' };
    }
    if (shift.status === 'completed') {
      return { success: false, message: 'Shift is already completed' };
    }

    const clockOutTime = new Date();
    const clockInTime = new Date(shift.clock_in);
    const diffMs = Math.max(0, clockOutTime.getTime() - clockInTime.getTime());
    const totalDurationHours = diffMs / (1000 * 60 * 60);

    const breaks = breakMinutes !== undefined ? breakMinutes : (shift.break_minutes || 0);
    const netHoursWorked = Math.max(0, totalDurationHours - breaks / 60);
    const regularHours = Math.min(8, netHoursWorked);
    const overtimeHours = Math.max(0, netHoursWorked - 8);

    // Overtime at 1.5x hourly rate
    const regPay = regularHours * shift.hourly_rate;
    const otPay = overtimeHours * (shift.hourly_rate * 1.5);
    const totalPay = Math.round((regPay + otPay) * 100) / 100;

    const updatedShift: StaffShift = {
      ...shift,
      clock_out: clockOutTime.toISOString(),
      break_minutes: breaks,
      total_hours: Math.round(netHoursWorked * 100) / 100,
      regular_hours: Math.round(regularHours * 100) / 100,
      overtime_hours: Math.round(overtimeHours * 100) / 100,
      total_pay: totalPay,
      status: 'completed',
      notes: notes !== undefined ? notes : shift.notes,
      reconciliation: reconciliation || shift.reconciliation,
    };

    set((s) => ({
      shifts: s.shifts.map((sh) => (sh.id === shiftId ? updatedShift : sh)),
      drawerReconciliations: reconciliation
        ? [reconciliation, ...s.drawerReconciliations.filter((r) => r.id !== reconciliation.id)]
        : s.drawerReconciliations,
    }));

    return {
      success: true,
      message: `${shift.staff_name} clocked out (${Math.round(netHoursWorked * 10) / 10} hrs worked • ₹${totalPay} earned)`,
    };
  },

  addDrawerReconciliation: (recData) => {
    const state = get();
    const newRec: DrawerReconciliation = {
      ...recData,
      id: `rec-${Date.now()}`,
    };
    const auditLog: PlatformAuditLog = {
      id: `pal-${Date.now()}`,
      admin_email: `${recData.staff_name.toLowerCase().replace(/\s+/g, '.')}@${state.currentTenant?.slug || 'tsos'}.cafe`,
      action: 'shift_reconciliation',
      target_business_id: state.currentTenant?.id,
      target_business_name: state.currentTenant?.name || state.location.name,
      details: `Shift Z-Report: Expected ₹${recData.expected_cash}, Counted ₹${recData.total_counted_cash}, Variance ${recData.variance >= 0 ? '+' : ''}₹${recData.variance} (${recData.status.toUpperCase()})`,
      timestamp: new Date().toISOString(),
    };
    set((s) => ({
      drawerReconciliations: [newRec, ...s.drawerReconciliations],
      platformAuditLogs: [auditLog, ...s.platformAuditLogs],
    }));
    return newRec;
  },

  recordBreak: (shiftId, addBreakMinutes) => {
    set((state) => ({
      shifts: state.shifts.map((sh) => {
        if (sh.id !== shiftId) return sh;
        const newBreak = (sh.break_minutes || 0) + addBreakMinutes;
        return {
          ...sh,
          break_minutes: newBreak,
        };
      }),
    }));
  },

  addManualShift: (shiftData) => {
    const state = get();
    const staff = state.staffMembers.find((s) => s.id === shiftData.staff_id);
    if (!staff) return;

    const clockInTime = new Date(shiftData.clock_in);
    const clockOutTime = new Date(shiftData.clock_out);
    const diffMs = Math.max(0, clockOutTime.getTime() - clockInTime.getTime());
    const grossHours = diffMs / (1000 * 60 * 60);
    const breaks = shiftData.break_minutes || 0;
    const netHours = Math.max(0, grossHours - breaks / 60);
    const regularHours = Math.min(8, netHours);
    const overtimeHours = Math.max(0, netHours - 8);
    const rate = shiftData.hourly_rate ?? staff.hourly_rate;
    const totalPay = Math.round((regularHours * rate + overtimeHours * rate * 1.5) * 100) / 100;

    const manualShift: StaffShift = {
      id: `shift-man-${Date.now()}`,
      staff_id: staff.id,
      staff_name: staff.name,
      role: staff.role,
      clock_in: shiftData.clock_in,
      clock_out: shiftData.clock_out,
      break_minutes: breaks,
      hourly_rate: rate,
      total_hours: Math.round(netHours * 100) / 100,
      regular_hours: Math.round(regularHours * 100) / 100,
      overtime_hours: Math.round(overtimeHours * 100) / 100,
      total_pay: totalPay,
      status: 'completed',
      notes: shiftData.notes || 'Manually logged shift',
    };

    set((s) => ({
      shifts: [manualShift, ...s.shifts],
    }));
  },

  updateShift: (shiftId, updates) => {
    set((state) => ({
      shifts: state.shifts.map((sh) => {
        if (sh.id !== shiftId) return sh;
        const merged = { ...sh, ...updates };
        if (merged.clock_in && merged.clock_out && merged.status === 'completed') {
          const diffMs = Math.max(
            0,
            new Date(merged.clock_out).getTime() - new Date(merged.clock_in).getTime()
          );
          const grossHours = diffMs / (1000 * 60 * 60);
          const breaks = merged.break_minutes || 0;
          const netHours = Math.max(0, grossHours - breaks / 60);
          const regularHours = Math.min(8, netHours);
          const overtimeHours = Math.max(0, netHours - 8);
          const rate = merged.hourly_rate || sh.hourly_rate;
          const totalPay = Math.round((regularHours * rate + overtimeHours * rate * 1.5) * 100) / 100;

          return {
            ...merged,
            total_hours: Math.round(netHours * 100) / 100,
            regular_hours: Math.round(regularHours * 100) / 100,
            overtime_hours: Math.round(overtimeHours * 100) / 100,
            total_pay: totalPay,
          };
        }
        return merged;
      }),
    }));
  },

  deleteShift: (shiftId) => {
    set((state) => ({
      shifts: state.shifts.filter((sh) => sh.id !== shiftId),
    }));
  },

  addStaffMember: (newStaff) => {
    set((state) => ({
      staffMembers: [
        ...state.staffMembers,
        {
          ...newStaff,
          id: `staff-${Date.now()}`,
          joined_date: new Date().toISOString().split('T')[0],
        },
      ],
    }));
  },

  updateStaffMember: (updatedStaff) => {
    set((state) => ({
      staffMembers: state.staffMembers.map((s) =>
        s.id === updatedStaff.id ? updatedStaff : s
      ),
      shifts: state.shifts.map((sh) =>
        sh.staff_id === updatedStaff.id && sh.status === 'active'
          ? {
              ...sh,
              staff_name: updatedStaff.name,
              role: updatedStaff.role,
              hourly_rate: updatedStaff.hourly_rate,
            }
          : sh
      ),
    }));
  },

  setTrackedOrderId: (id) => set({ trackedOrderId: id }),

  toggleAudio: () => set((state) => ({ audioEnabled: !state.audioEnabled })),

  // Thermal Printer
  updatePrinterConfig: (partial) =>
    set((state) => ({
      printerConfig: { ...state.printerConfig, ...partial },
    })),
  addPrintLog: (log) =>
    set((state) => {
      const newEntry: PrintLogEntry = {
        ...log,
        id: `plog-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        timestamp: new Date().toISOString(),
      };
      return { printLogs: [newEntry, ...(state.printLogs || [])].slice(0, 100) };
    }),
  clearPrintLogs: () => set({ printLogs: [] }),

  // Guidance & Onboarding Tour
  toggleGuidanceMode: () => set((state) => ({ guidanceMode: !state.guidanceMode })),
  startTour: () => set({ isTourOpen: true, currentTourStep: 0 }),
  nextTourStep: () => set((state) => ({ currentTourStep: state.currentTourStep + 1 })),
  prevTourStep: () => set((state) => ({ currentTourStep: Math.max(0, state.currentTourStep - 1) })),
  closeTour: () => set({ isTourOpen: false }),

  // SuperAdmin & Multi-Tenant SaaS
  currentTenant: DEFAULT_STATE.currentTenant,
  setCurrentTenant: (tenant) => set({ currentTenant: tenant }),
  impersonatedTenant: null,
  setImpersonatedTenant: (tenant) => set({ impersonatedTenant: tenant }),
  availableLocations: DEFAULT_STATE.availableLocations,
  setLocation: (loc) => set({ location: loc }),
  switchTenantScope: (slugOrId: string) => {
    const state = get();
    const clean = slugOrId.toLowerCase().trim();
    if (state.currentTenant && (state.currentTenant.slug.toLowerCase() === clean || state.currentTenant.id.toLowerCase() === clean)) {
      return true;
    }
    const tenant = state.tenantBusinesses.find(
      (b) => b.slug.toLowerCase() === clean || b.id.toLowerCase() === clean
    );
    if (!tenant) return false;

    const loc1: Location = {
      id: `loc_${tenant.slug}_01`,
      business_id: tenant.id,
      name: `${tenant.name} (${tenant.city})`,
      slug: tenant.slug,
      address: tenant.address,
      phone: tenant.business_phone,
      created_at: tenant.created_at,
    };

    const loc2: Location = {
      id: `loc_${tenant.slug}_02`,
      business_id: tenant.id,
      name: `${tenant.display_name || tenant.name} Express (Roastery)`,
      slug: `${tenant.slug}-express`,
      address: `Express Kiosk, Airport Road, ${tenant.city}`,
      phone: tenant.business_phone,
      created_at: tenant.created_at,
    };

    const tenantTables: DineTable[] = Array.from({ length: 8 }, (_, i) => ({
      id: `tbl_${tenant.slug}_${i + 1}`,
      location_id: loc1.id,
      label: `T-${(i + 1).toString().padStart(2, '0')}`,
      seats: i % 2 === 0 ? 4 : 2,
      qr_token: `token_${tenant.slug}_t${i + 1}`,
      status: 'free' as const,
    }));

    set({
      currentTenant: tenant,
      location: loc1,
      availableLocations: [loc1, loc2],
      tables: tenantTables,
      selectedTableId: null,
      cart: [],
    });
    return true;
  },
  setActiveSuperAdminTab: (tab) => set({ activeSuperAdminTab: tab }),
  setSelectedSuperAdminBusinessId: (id) => set({ selectedSuperAdminBusinessId: id }),

  addTenantBusiness: (business) => {
    set((state) => {
      const newLog: PlatformAuditLog = {
        id: `log_${Date.now()}`,
        admin_email: 'admin@tablesideordering.com',
        action: 'PROVISION_BUSINESS',
        target_business_id: business.id,
        target_business_name: business.name,
        details: `Created new business (${business.slug}) with ${business.subscription.plan_id.toUpperCase()} plan (₹${business.subscription.final_monthly_rate}/mo).`,
        timestamp: new Date().toISOString(),
      };
      return {
        tenantBusinesses: [business, ...state.tenantBusinesses],
        platformAuditLogs: [newLog, ...state.platformAuditLogs],
      };
    });
  },

  addTenant: (business) => {
    get().addTenantBusiness(business);
  },

  updateTenantBusiness: (business) => {
    set((state) => {
      const newLog: PlatformAuditLog = {
        id: `log_${Date.now()}`,
        admin_email: 'admin@tablesideordering.com',
        action: 'UPDATE_BUSINESS',
        target_business_id: business.id,
        target_business_name: business.name,
        details: `Updated business profile, contact, or legal info for ${business.name}.`,
        timestamp: new Date().toISOString(),
      };
      return {
        tenantBusinesses: state.tenantBusinesses.map((b) => (b.id === business.id ? business : b)),
        platformAuditLogs: [newLog, ...state.platformAuditLogs],
      };
    });
  },

  updateBusinessSubscription: (businessId, subUpdate) => {
    set((state) => {
      const biz = state.tenantBusinesses.find((b) => b.id === businessId);
      if (!biz) return state;

      const updatedSubscription = {
        ...biz.subscription,
        ...subUpdate,
      };

      const newLog: PlatformAuditLog = {
        id: `log_${Date.now()}`,
        admin_email: 'admin@tablesideordering.com',
        action: 'UPDATE_SUBSCRIPTION',
        target_business_id: biz.id,
        target_business_name: biz.name,
        details: `Modified subscription plan (${updatedSubscription.plan_id}) or deal discount (${updatedSubscription.applied_discount_pct}% off -> ₹${updatedSubscription.final_monthly_rate}/mo).`,
        timestamp: new Date().toISOString(),
      };

      return {
        tenantBusinesses: state.tenantBusinesses.map((b) =>
          b.id === businessId ? { ...b, subscription: updatedSubscription, updated_at: new Date().toISOString() } : b
        ),
        platformAuditLogs: [newLog, ...state.platformAuditLogs],
      };
    });
  },

  setBusinessStatus: (businessId, status) => {
    set((state) => {
      const biz = state.tenantBusinesses.find((b) => b.id === businessId);
      if (!biz) return state;

      const newLog: PlatformAuditLog = {
        id: `log_${Date.now()}`,
        admin_email: 'admin@tablesideordering.com',
        action: `SET_STATUS_${status.toUpperCase()}`,
        target_business_id: biz.id,
        target_business_name: biz.name,
        details: `Changed business lifecycle status from ${biz.status} to ${status}.`,
        timestamp: new Date().toISOString(),
      };

      return {
        tenantBusinesses: state.tenantBusinesses.map((b) =>
          b.id === businessId ? { ...b, status, updated_at: new Date().toISOString() } : b
        ),
        platformAuditLogs: [newLog, ...state.platformAuditLogs],
      };
    });
  },

  deleteTenantBusiness: (businessId, hardDelete) => {
    set((state) => {
      const biz = state.tenantBusinesses.find((b) => b.id === businessId);
      if (!biz) return state;

      const newLog: PlatformAuditLog = {
        id: `log_${Date.now()}`,
        admin_email: 'admin@tablesideordering.com',
        action: hardDelete ? 'PERMANENT_DELETE' : 'ARCHIVE_BUSINESS',
        target_business_id: biz.id,
        target_business_name: biz.name,
        details: hardDelete ? `Hard deleted business record from database.` : `Soft deleted / moved to archived status.`,
        timestamp: new Date().toISOString(),
      };

      return {
        tenantBusinesses: hardDelete
          ? state.tenantBusinesses.filter((b) => b.id !== businessId)
          : state.tenantBusinesses.map((b) => (b.id === businessId ? { ...b, status: 'archived', updated_at: new Date().toISOString() } : b)),
        platformAuditLogs: [newLog, ...state.platformAuditLogs],
      };
    });
  },

  addPlatformAuditLog: (entry) => {
    set((state) => ({
      platformAuditLogs: [
        {
          ...entry,
          id: `log_${Date.now()}`,
          timestamp: new Date().toISOString(),
        },
        ...state.platformAuditLogs,
      ],
    }));
  },

  resetToSeed: () => {
    localStorage.removeItem(STORAGE_KEY);
    set({
      ...getInitialState(),
      cart: [],
      selectedTableId: null,
      selectedCustomerId: null,
      appliedOffer: null,
      redeemedPoints: 0,
    });
  },
}));

// Auto-save to localStorage whenever state changes
useTsosStore.subscribe((state) => {
  try {
    const toPersist = {
      currentProfile: state.currentProfile,
      location: state.location,
      categories: state.categories,
      menuItems: state.menuItems,
      addons: state.addons,
      ingredients: state.ingredients,
      recipes: state.recipes,
      inventoryLogs: state.inventoryLogs.slice(0, 50),
      tables: state.tables,
      cart: state.cart || [],
      orders: state.orders,
      customers: state.customers,
      loyaltyLedgers: state.loyaltyLedgers.slice(0, 100),
      offers: state.offers,
      staffMembers: state.staffMembers,
      shifts: state.shifts,
      feeConfig: state.feeConfig,
      printerConfig: state.printerConfig,
      printLogs: (state.printLogs || []).slice(0, 50),
      guidanceMode: state.guidanceMode,
      tenantBusinesses: state.tenantBusinesses,
      platformAuditLogs: (state.platformAuditLogs || []).slice(0, 50),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toPersist));
  } catch (e) {
    console.error('Failed to sync TSOS state to localStorage', e);
  }
});

// Setup online / offline connection listeners
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    const store = useTsosStore.getState();
    if (!store.cloudSync.simulatedOffline) {
      store.triggerManualSync();
    }
  });

  window.addEventListener('offline', () => {
    useTsosStore.setState((s) => ({
      cloudSync: { ...s.cloudSync, status: 'offline', latencyMs: 0 },
    }));
  });
}
