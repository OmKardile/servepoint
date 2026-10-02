-- ============================================================================
-- 016_customers_offers.sql — NOVA CRM parity: regulars + offers
--
-- Customers: identity keyed by (tenant_id, phone). The counter types a phone
-- on a ticket once and the CRM remembers the guest forever after — the
-- auto-enrich trigger upserts identity from orders. Visits/spend are NOT
-- stored counters: v_customer_stats derives them from the orders ledger
-- (truth-over-flags, same principle as the payments ledger in 007/013 —
-- nothing to drift, replay-proof by construction).
--
-- Offers: counter-applied discounts (percent or flat) with an optional
-- minimum-order floor. Redemption is a ledger (offer_redemptions) with
-- UNIQUE(order_id) — one offer per order ever, and the usage_count bump is a
-- trigger on the ledger insert, so there is exactly ONE counting path.
--
-- Realtime: customers + offers join supabase_realtime ( Guests tab + counter
-- offer picker stay live across devices).
-- ============================================================================

-- ── A. tables ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL,
  email TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, phone)
);

CREATE TABLE IF NOT EXISTS offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  discount_type TEXT NOT NULL DEFAULT 'percent'
    CHECK (discount_type IN ('percent', 'flat')),
  discount_value NUMERIC(10,2) NOT NULL CHECK (discount_value > 0),
  min_order_amount NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (min_order_amount >= 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  usage_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- a percent offer above 100 would pay the guest — structurally impossible
  CONSTRAINT offers_percent_cap CHECK (
    discount_type <> 'percent' OR discount_value <= 100
  )
);

-- One redemption per order, ever — UNIQUE is the replay guard (015 ledger pattern).
CREATE TABLE IF NOT EXISTS offer_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  offer_id UUID NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  discount_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (order_id)
);

CREATE INDEX IF NOT EXISTS idx_customers_tenant ON customers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_customers_tenant_name ON customers(tenant_id, name);
CREATE INDEX IF NOT EXISTS idx_offers_tenant ON offers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_offer_redemptions_offer ON offer_redemptions(offer_id);
CREATE INDEX IF NOT EXISTS idx_offer_redemptions_tenant_time
  ON offer_redemptions(tenant_id, created_at DESC);

-- ── B. derived guest stats — the orders ledger is the only truth ───────────
-- security_invoker: the view runs with the CALLER's RLS on orders, so a
-- tenant member sees only their own regulars. No SECURITY DEFINER shortcut.
CREATE OR REPLACE VIEW v_customer_stats WITH (security_invoker = on) AS
SELECT
  o.tenant_id,
  o.customer_phone          AS phone,
  COUNT(*) FILTER (WHERE o.status <> 'cancelled')                       AS orders_placed,
  COUNT(*) FILTER (WHERE o.status <> 'cancelled'
                     AND o.payment_status = 'completed')                AS visits,
  COALESCE(SUM(o.total) FILTER (WHERE o.status <> 'cancelled'
                     AND o.payment_status = 'completed'), 0)::NUMERIC   AS total_spent,
  MAX(o.created_at) FILTER (WHERE o.status <> 'cancelled')              AS last_visit_at
FROM orders o
WHERE o.customer_phone IS NOT NULL AND o.customer_phone <> ''
GROUP BY o.tenant_id, o.customer_phone;

-- ── C. auto-enrich: an order that names a phone puts the guest on the books ─
CREATE OR REPLACE FUNCTION sp_touch_customer_from_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.customer_phone IS NULL OR NEW.customer_phone = '' THEN
    RETURN NEW;
  END IF;
  INSERT INTO customers (tenant_id, name, phone)
  VALUES (NEW.tenant_id, COALESCE(NEW.customer_name, ''), NEW.customer_phone)
  ON CONFLICT (tenant_id, phone) DO UPDATE
    SET name = CASE
          WHEN customers.name IS NULL OR customers.name = ''
            THEN EXCLUDED.name       -- fill a blank from the newest ticket
          ELSE customers.name        -- an edited CRM name always wins
        END,
        updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_touch_customer ON orders;
CREATE TRIGGER trg_orders_touch_customer
AFTER INSERT OR UPDATE OF customer_phone, customer_name ON orders
FOR EACH ROW EXECUTE FUNCTION sp_touch_customer_from_order();

-- ── D. offer usage counter — the ledger is the ONLY counting path ──────────
-- Recompute (not increment): usage_count always equals its ledger rows, so a
-- cascade-deleted order heals the counter instead of leaving phantom uses.
CREATE OR REPLACE FUNCTION sp_sync_offer_usage()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_offer UUID := COALESCE(NEW.offer_id, OLD.offer_id);
BEGIN
  UPDATE offers o
     SET usage_count = (SELECT count(*) FROM offer_redemptions r WHERE r.offer_id = v_offer),
         updated_at  = now()
   WHERE o.id = v_offer;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_offer_redemptions_usage ON offer_redemptions;
CREATE TRIGGER trg_offer_redemptions_usage
AFTER INSERT OR DELETE OR UPDATE OF offer_id ON offer_redemptions
FOR EACH ROW EXECUTE FUNCTION sp_sync_offer_usage();

-- ── E. RLS — same two-policy shape as 012/015 ──────────────────────────────
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['customers', 'offers', 'offer_redemptions'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format($f$
      DROP POLICY IF EXISTS "Superadmin full access on %I" ON %I
    $f$, t, t);
    EXECUTE format($f$
      CREATE POLICY "Superadmin full access on %I"
      ON %I FOR ALL TO authenticated
      USING (is_superadmin())
      WITH CHECK (is_superadmin())
    $f$, t, t);
    EXECUTE format($f$
      DROP POLICY IF EXISTS "Tenant full access on own %I" ON %I
    $f$, t, t);
    EXECUTE format($f$
      CREATE POLICY "Tenant full access on own %I"
      ON %I FOR ALL TO authenticated
      USING (tenant_id = current_tenant_id())
      WITH CHECK (tenant_id = current_tenant_id())
    $f$, t, t);
  END LOOP;
END $$;

-- ── F. public offers for the guest QR menu (banner read-only) ──────────────
-- Guests never touch the offers table directly; the slug resolves the tenant
-- server-side and only active rows leave the building.
CREATE OR REPLACE FUNCTION sp_public_offers(p_slug TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant RECORD;
BEGIN
  SELECT id, name INTO v_tenant FROM tenants WHERE slug = p_slug LIMIT 1;
  IF v_tenant.id IS NULL THEN
    RETURN jsonb_build_object('is_valid', false, 'offers', '[]'::jsonb);
  END IF;
  RETURN jsonb_build_object(
    'is_valid', true,
    'offers', COALESCE((
      SELECT jsonb_agg(
               jsonb_build_object(
                 'id', o.id, 'title', o.title, 'description', o.description,
                 'discount_type', o.discount_type, 'discount_value', o.discount_value,
                 'min_order_amount', o.min_order_amount)
               ORDER BY o.created_at DESC)
      FROM offers o
      WHERE o.tenant_id = v_tenant.id AND o.is_active = true
    ), '[]'::jsonb)
  );
END;
$$;

-- ── G. realtime: customers + offers stream to every open screen ────────────
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['customers', 'offers'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND tablename = t AND schemaname = 'public'
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;
