-- Migration: add tenants, subscriptions, printers, tenant_id columns, and order subscription trigger

BEGIN;

-- Plan type enum
DO $$ BEGIN
    CREATE TYPE plan_type_enum AS ENUM ('BASIC', 'PRO', 'ENTERPRISE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Subscription status enum
DO $$ BEGIN
    CREATE TYPE subscription_status_enum AS ENUM ('TRIAL', 'ACTIVE', 'PAST_DUE', 'EXPIRED', 'SUSPENDED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Tenants table
CREATE TABLE IF NOT EXISTS tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  owner_id uuid NOT NULL,
  plan_type plan_type_enum DEFAULT 'BASIC' NOT NULL,
  status subscription_status_enum DEFAULT 'TRIAL' NOT NULL,
  trial_ends_at timestamptz NULL,
  subscription_ends_at timestamptz NULL,
  max_pos_terminals integer DEFAULT 1 NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Subscriptions history table
CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  plan_type plan_type_enum NOT NULL,
  status subscription_status_enum NOT NULL,
  started_at timestamptz DEFAULT now(),
  ends_at timestamptz NULL,
  metadata jsonb NULL
);

-- Printers table for tenant hardware configuration
CREATE TABLE IF NOT EXISTS printers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  location text NULL,
  type text NOT NULL CHECK (type IN ('network', 'usb', 'browser')),
  network_address text NULL,
  config jsonb NULL,
  created_at timestamptz DEFAULT now()
);

-- Add tenant_id to products and orders for multi-tenant scoping
ALTER TABLE IF EXISTS products ADD COLUMN IF NOT EXISTS tenant_id uuid NULL REFERENCES tenants(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS orders ADD COLUMN IF NOT EXISTS tenant_id uuid NULL REFERENCES tenants(id) ON DELETE SET NULL;

-- Trigger function to block writes to orders when tenant subscription expired/suspended
CREATE OR REPLACE FUNCTION public.check_tenant_subscription_on_order() RETURNS trigger AS $$
DECLARE
  t_rec tenants;
BEGIN
  IF NEW.tenant_id IS NULL THEN
    -- If tenant not set, allow (backwards compatibility)
    RETURN NEW;
  END IF;
  SELECT * INTO t_rec FROM tenants WHERE id = NEW.tenant_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tenant not found';
  END IF;

  -- If trial expired, mark as expired
  IF t_rec.status = 'TRIAL' AND t_rec.trial_ends_at IS NOT NULL AND t_rec.trial_ends_at < now() THEN
    UPDATE tenants SET status = 'EXPIRED' WHERE id = t_rec.id;
    RAISE EXCEPTION 'SUBSCRIPTION_EXPIRED: Tenant trial expired';
  END IF;

  IF t_rec.status IN ('EXPIRED', 'SUSPENDED') THEN
    RAISE EXCEPTION 'SUBSCRIPTION_EXPIRED: Tenant subscription is expired or suspended';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach trigger to orders on insert and update
DROP TRIGGER IF EXISTS trg_check_subscription_on_order ON public.orders;
CREATE TRIGGER trg_check_subscription_on_order
  BEFORE INSERT OR UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.check_tenant_subscription_on_order();

COMMIT;
