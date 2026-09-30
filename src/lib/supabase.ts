import { createClient } from '@supabase/supabase-js';
import {
  TenantBusiness,
  BusinessSubscription,
  SubscriptionPlanId,
  BillingCycle,
  MenuItem,
  MenuCategory,
  DineTable,
  PlatformAuditLog,
} from '../types';
import { SEED_CATEGORIES, SEED_MENU_ITEMS } from '../data/seedData';

// Live Supabase credentials — intentionally HARDCODED (product decision).
// The anon key is a PUBLIC client key protected by Row Level Security, so
// embedding it keeps every environment (Render, Vercel, local dev, offline
// builds) connected to the live project with zero env configuration.
const HARDCODED_SUPABASE_URL = 'https://vbufsuzzmehsidshopku.supabase.co';
const HARDCODED_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZidWZzdXp6bWVoc2lkc2hvcGt1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAyOTE0MjMsImV4cCI6MjEwNTg2NzQyM30.kymgulEpO3R7FRhrfFO-lpmYrAcOqBF82sSW4unZHBE';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || HARDCODED_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || HARDCODED_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = (): boolean => {
  return Boolean(
    supabaseUrl &&
    supabaseAnonKey &&
    !supabaseUrl.includes('demo-tsos-project')
  );
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

// Local session key for tenant context
const TENANT_SESSION_KEY = 'tsos_active_tenant_id';

export const getActiveTenantId = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TENANT_SESSION_KEY) || 'biz_coolkafe_99';
};

export const setActiveTenantId = (tenantId: string): void => {
  if (typeof window !== 'undefined') {
    localStorage.setItem(TENANT_SESSION_KEY, tenantId);
  }
};

export interface ProvisionTenantPayload {
  business: {
    name: string;
    legal_name: string;
    display_name: string;
    slug: string;
    business_type: string;
    owner_name: string;
    owner_email: string;
    owner_phone: string;
    owner_pin: string;
    gst_number?: string;
    pan_number?: string;
    fssai_number?: string;
    upi_id?: string;
    address: string;
    city: string;
    state: string;
    postal_code: string;
    country: string;
  };
  subscription: {
    plan_id: SubscriptionPlanId;
    billing_cycle: BillingCycle;
    monthly_price: number;
    discount_pct: number;
    final_monthly_rate: number;
    trial_days: number;
    deal_notes?: string;
  };
  config: {
    initial_tables_count: number;
    menu_template: 'coffee_bakery' | 'casual_dining' | 'empty';
    enable_table_qr: boolean;
    enable_anti_tamper: boolean;
  };
  actorEmail?: string;
}

export interface ProvisionResult {
  success: boolean;
  mode: 'supabase' | 'offline_fallback';
  tenantId: string;
  tenantBusiness: TenantBusiness;
  generatedTables: DineTable[];
  error?: string;
}

/**
 * Generate a random 16-hex character anti-tamper table token
 */
export const generateSecureTableToken = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, '').slice(0, 16);
  }
  return Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);
};

/**
 * Provisions a new Tenant across all entities:
 * 1. tenants
 * 2. subscriptions
 * 3. tenant_users (owner account)
 * 4. locations (primary outlet)
 * 5. dining_tables (with cryptographic tokens)
 * 6. categories & menu_items (starter seed)
 * 7. platform_audit_logs
 * 
 * Falls back seamlessly to offline / in-memory local state if Supabase is unconfigured or unreachable.
 */
export async function provisionTenant(payload: ProvisionTenantPayload): Promise<ProvisionResult> {
  const { business, subscription, config, actorEmail = 'superadmin@tablesideordering.com' } = payload;
  
  const tenantId = `biz_${business.slug}_${Date.now().toString().slice(-4)}`;
  const locationId = `loc_${business.slug}_01`;
  const subscriptionId = `sub_${business.slug}_${Date.now().toString().slice(-4)}`;
  const now = new Date().toISOString();
  
  const trialStart = now;
  const trialEnd = subscription.trial_days > 0 
    ? new Date(Date.now() + subscription.trial_days * 24 * 60 * 60 * 1000).toISOString() 
    : undefined;
  const nextBilling = trialEnd || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  // Construct structured TenantBusiness model
  const subRecord: BusinessSubscription = {
    id: subscriptionId,
    business_id: tenantId,
    plan_id: subscription.plan_id,
    status: subscription.trial_days > 0 ? 'trialing' : 'active',
    billing_cycle: subscription.billing_cycle,
    monthly_price: subscription.monthly_price,
    applied_discount_pct: subscription.discount_pct,
    final_monthly_rate: subscription.final_monthly_rate,
    deal_notes: subscription.deal_notes,
    trial_start: subscription.trial_days > 0 ? trialStart : undefined,
    trial_end: trialEnd,
    current_period_start: trialStart,
    current_period_end: nextBilling,
    cancel_at_period_end: false,
    last_payment_status: subscription.trial_days > 0 ? 'pending' : 'paid',
    next_billing_at: nextBilling,
    payment_method_summary: subscription.trial_days > 0
      ? `${subscription.trial_days}-Day Trial Active`
      : 'Auto-Debit Mandate Configured',
  };

  const tenantBusiness: TenantBusiness = {
    id: tenantId,
    name: business.name,
    legal_name: business.legal_name || business.name,
    display_name: business.display_name || business.name,
    slug: business.slug,
    gst_number: business.gst_number,
    pan_number: business.pan_number,
    fssai_number: business.fssai_number,
    upi_id: business.upi_id || `${business.slug}@upi`,
    business_email: business.owner_email,
    business_phone: business.owner_phone,
    address: business.address,
    city: business.city,
    state: business.state,
    country: business.country,
    postal_code: business.postal_code,
    business_type: business.business_type as any,
    contact_person: business.owner_name,
    owner_name: business.owner_name,
    owner_email: business.owner_email,
    owner_phone: business.owner_phone,
    status: subscription.trial_days > 0 ? 'trial' : 'active',
    locations_count: 1,
    subscription: subRecord,
    total_orders_count: 0,
    lifetime_revenue: 0,
    created_at: now,
    updated_at: now,
    notes: `Provisioned via SuperAdmin Wizard. Tables: ${config.initial_tables_count}. Template: ${config.menu_template}.`,
  };

  // Generate Default Dining Tables
  const generatedTables: DineTable[] = Array.from({ length: config.initial_tables_count }, (_, i) => {
    const tableNum = i + 1;
    const label = `T-${tableNum.toString().padStart(2, '0')}`;
    return {
      id: `tbl_${business.slug}_${tableNum}`,
      location_id: locationId,
      label,
      seats: tableNum % 3 === 0 ? 6 : 4,
      qr_token: generateSecureTableToken(),
      status: 'free',
    };
  });

  // Check if live Supabase is configured
  if (!isSupabaseConfigured()) {
    console.info('ℹ️ TSOS: Supabase unconfigured or offline mode. Provisioning tenant to local reactive store.');
    return {
      success: true,
      mode: 'offline_fallback',
      tenantId,
      tenantBusiness,
      generatedTables,
    };
  }

  // Live Supabase Provisioning
  try {
    // 1. Insert Tenant Row
    const { error: tenantErr } = await supabase.from('tenants').insert({
      id: tenantId,
      name: business.name,
      legal_name: business.legal_name,
      slug: business.slug,
      business_type: business.business_type,
      status: subscription.trial_days > 0 ? 'trial' : 'active',
      owner_email: business.owner_email,
      owner_phone: business.owner_phone,
      upi_id: business.upi_id,
      gst_number: business.gst_number,
      pan_number: business.pan_number,
      fssai_number: business.fssai_number,
      address: business.address,
      city: business.city,
      state: business.state,
      postal_code: business.postal_code,
      country: business.country,
      created_at: now,
      updated_at: now,
    });
    if (tenantErr) throw new Error(`Tenants insert failed: ${tenantErr.message}`);

    // 2. Insert Subscription Row
    const { error: subErr } = await supabase.from('subscriptions').insert({
      id: subscriptionId,
      tenant_id: tenantId,
      plan_id: subscription.plan_id,
      billing_cycle: subscription.billing_cycle,
      monthly_price: subscription.monthly_price,
      applied_discount_pct: subscription.discount_pct,
      final_monthly_rate: subscription.final_monthly_rate,
      deal_notes: subscription.deal_notes,
      status: subscription.trial_days > 0 ? 'trialing' : 'active',
      trial_start: trialStart,
      trial_end: trialEnd,
      current_period_start: trialStart,
      current_period_end: nextBilling,
      next_billing_at: nextBilling,
    });
    if (subErr) console.warn('Subscriptions insert warning:', subErr.message);

    // 3. Insert Primary Location
    const { error: locErr } = await supabase.from('locations').insert({
      id: locationId,
      tenant_id: tenantId,
      name: `${business.name} (Main Outlet)`,
      slug: `${business.slug}-main`,
      address: business.address,
      city: business.city,
      state: business.state,
      postal_code: business.postal_code,
      phone: business.owner_phone,
      is_primary: true,
    });
    if (locErr) console.warn('Locations insert warning:', locErr.message);

    // 4. Insert Dining Tables
    const dbTables = generatedTables.map((t) => ({
      id: t.id,
      tenant_id: tenantId,
      location_id: locationId,
      table_number: t.label,
      capacity: t.seats,
      section: 'Main Floor',
      qr_token: t.qr_token,
      status: 'available',
    }));
    const { error: tblErr } = await supabase.from('dining_tables').insert(dbTables);
    if (tblErr) console.warn('Dining tables insert warning:', tblErr.message);

    // 5. Seed Starter Menu Items & Categories if requested
    if (config.menu_template !== 'empty') {
      // The live schema uses UUID primary keys — map local seed ids to fresh
      // UUIDs so category → menu_item references stay consistent.
      const categoryIdMap = new Map<string, string>(
        SEED_CATEGORIES.map((c) => [c.id, crypto.randomUUID()])
      );

      const starterCategories = SEED_CATEGORIES.map((c) => ({
        id: categoryIdMap.get(c.id)!,
        tenant_id: tenantId,
        location_id: locationId,
        name: c.name,
        sort_order: c.sort_order,
        icon: c.icon,
      }));
      const { error: catSeedErr } = await supabase.from('categories').insert(starterCategories);
      if (catSeedErr) console.warn('Categories seed warning:', catSeedErr.message);

      const starterItems = SEED_MENU_ITEMS.slice(0, config.menu_template === 'casual_dining' ? 20 : 12).map((item) => ({
        id: crypto.randomUUID(),
        tenant_id: tenantId,
        location_id: locationId,
        category_id: categoryIdMap.get(item.category_id) ?? null,
        name: item.name,
        description: item.description,
        price: item.price,
        image_url: item.image_url,
        is_veg: item.is_veg,
        is_available: true,
        tax_rate_pct: item.tax_rate_pct,
      }));
      const { error: itemSeedErr } = await supabase.from('menu_items').insert(starterItems);
      if (itemSeedErr) console.warn('Menu items seed warning:', itemSeedErr.message);
    }

    // 6. Record Platform Audit Log
    await supabase.from('platform_audit_logs').insert({
      tenant_id: tenantId,
      actor_email: actorEmail,
      action: 'PROVISION_TENANT',
      details: `Successfully provisioned ${business.name} with ${subscription.plan_id.toUpperCase()} plan (Rate: ₹${subscription.final_monthly_rate}/mo, Tables: ${config.initial_tables_count}).`,
      metadata: {
        slug: business.slug,
        plan_id: subscription.plan_id,
        tables_count: config.initial_tables_count,
        template: config.menu_template,
      },
    });

    return {
      success: true,
      mode: 'supabase',
      tenantId,
      tenantBusiness,
      generatedTables,
    };
  } catch (err: any) {
    console.error('⚠️ Supabase tenant provisioning encountered error, falling back to local store:', err);
    return {
      success: true,
      mode: 'offline_fallback',
      tenantId,
      tenantBusiness,
      generatedTables,
      error: err.message,
    };
  }
}

/**
 * Validates a table's cryptographic QR token against Supabase RPC
 */
export async function verifyTableSessionToken(slug: string, tableNumber: string, token: string) {
  if (!isSupabaseConfigured()) {
    return {
      isValid: true,
      mode: 'offline_demo',
      tableNumber,
      slug,
    };
  }

  try {
    const { data, error } = await supabase.rpc('verify_table_session', {
      p_tenant_slug: slug,
      p_table_number: tableNumber,
      p_token: token,
    });

    if (error) {
      console.error('verify_table_session RPC error:', error);
      return { isValid: false, error: error.message };
    }

    return {
      isValid: Boolean(data?.is_valid),
      tenant: data?.tenant,
      table: data?.table,
      error: data?.error,
      message: data?.message,
    };
  } catch (err: any) {
    console.error('Table session verification failed:', err);
    return { isValid: false, error: err.message };
  }
}
