/*
# Module 11 — Payment, Billing & Coupons

## Summary
Adds the full payment infrastructure for Omnia Global Academy: order tracking,
multi-currency support, coupon usage history, and payment reconciliation tools.

## New Tables

### orders
Central ledger for all purchase transactions. Stores the full audit trail of every
purchase: original price, coupon discount, final amount paid, FedaPay transaction
reference, commission splits, invoice URL, and idempotency key to prevent double-
processing of webhooks.

### currency_rates
Exchange rate table with XOF as the pivot currency. Pre-seeded with 9 currencies
(XOF, EUR, USD, GNF, GHS, NGN, MAD, DZD, TND). Rates are locked at purchase time
into orders.exchange_rate_to_xof.

### coupon_usages
Audit log of coupon redemptions. Enforces one-coupon-per-user via UNIQUE constraint
on (coupon_id, user_id). Linked to both the coupon and the order that triggered it.

### payment_reconciliations
Stores results of manual Super-admin reconciliation lookups against FedaPay's API.
Tracks whether a reconciliation run triggered a webhook replay.

## Security
- RLS enabled on all new tables.
- orders: authenticated users can only read their own orders (user_id = auth.uid()).
- currency_rates: public read for anon + authenticated (needed at checkout).
- coupon_usages: authenticated users read their own rows.
- payment_reconciliations: super_admin only via service_role in edge functions (no public policy).
*/

-- ─── orders ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number            VARCHAR(50) UNIQUE NOT NULL,
  user_id                 UUID NOT NULL REFERENCES users(id),
  course_id               UUID NOT NULL REFERENCES courses(id),

  original_price_xof      INTEGER NOT NULL,
  discount_xof            INTEGER DEFAULT 0,
  final_price_xof         INTEGER NOT NULL,

  coupon_id               UUID REFERENCES coupons(id),
  coupon_code             VARCHAR(50),
  license_id              UUID,

  payment_status          VARCHAR(30) DEFAULT 'pending',
  payment_gateway         VARCHAR(30),
  fedapay_transaction_id  VARCHAR(255),
  gateway_reference       VARCHAR(255),

  professor_share_xof     INTEGER DEFAULT 0,
  platform_share_xof      INTEGER DEFAULT 0,
  professor_percent       INTEGER DEFAULT 0,
  platform_percent        INTEGER DEFAULT 0,

  currency_code           VARCHAR(10) DEFAULT 'XOF',
  exchange_rate_to_xof    DECIMAL(10,4) DEFAULT 1,

  invoice_number          VARCHAR(50),
  invoice_generated_at    TIMESTAMP WITH TIME ZONE,
  invoice_url             TEXT,

  idempotency_key         VARCHAR(255) UNIQUE,

  paid_at                 TIMESTAMP WITH TIME ZONE,
  created_at              TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_user     ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_course   ON orders(course_id);
CREATE INDEX IF NOT EXISTS idx_orders_fedapay  ON orders(fedapay_transaction_id);
CREATE INDEX IF NOT EXISTS idx_orders_number   ON orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_status   ON orders(payment_status);

-- Conditionally add FK for group_licenses if the table exists
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'group_licenses'
  ) THEN
    BEGIN
      ALTER TABLE orders ADD CONSTRAINT orders_license_id_fkey
        FOREIGN KEY (license_id) REFERENCES group_licenses(id);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;

-- ─── currency_rates ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS currency_rates (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  currency_code VARCHAR(10) UNIQUE NOT NULL,
  currency_name VARCHAR(100) NOT NULL,
  rate_to_xof   DECIMAL(10,4) NOT NULL,
  updated_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO currency_rates (currency_code, currency_name, rate_to_xof) VALUES
  ('XOF', 'Franc CFA',              1),
  ('EUR', 'Euro',                   655.957),
  ('USD', 'Dollar américain',       610.0),
  ('GNF', 'Franc guinéen',          0.071),
  ('GHS', 'Cedi ghanéen',           40.0),
  ('NGN', 'Naira nigérian',         0.40),
  ('MAD', 'Dirham marocain',        62.0),
  ('DZD', 'Dinar algérien',         4.5),
  ('TND', 'Dinar tunisien',         195.0)
ON CONFLICT (currency_code) DO UPDATE SET rate_to_xof = EXCLUDED.rate_to_xof;

-- ─── coupon_usages ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS coupon_usages (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id            UUID NOT NULL REFERENCES coupons(id),
  user_id              UUID NOT NULL REFERENCES users(id),
  order_id             UUID NOT NULL REFERENCES orders(id),
  discount_applied_xof INTEGER NOT NULL,
  used_at              TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(coupon_id, user_id)
);

-- ─── payment_reconciliations ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payment_reconciliations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id            UUID NOT NULL REFERENCES users(id),
  external_reference  VARCHAR(255) NOT NULL,
  gateway             VARCHAR(30) NOT NULL,
  order_id            UUID REFERENCES orders(id),
  verification_result JSONB,
  triggered_webhook   BOOLEAN DEFAULT FALSE,
  created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ─── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE orders                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE currency_rates           ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupon_usages            ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_reconciliations  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "orders_own_select"    ON orders;
CREATE POLICY "orders_own_select" ON orders FOR SELECT
  TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "currency_public_select" ON currency_rates;
CREATE POLICY "currency_public_select" ON currency_rates FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "coupon_usages_own_select" ON coupon_usages;
CREATE POLICY "coupon_usages_own_select" ON coupon_usages FOR SELECT
  TO authenticated USING (user_id = auth.uid());
