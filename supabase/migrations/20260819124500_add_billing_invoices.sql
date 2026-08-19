-- Migration: add invoices/payments table for billing and helper

BEGIN;

CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  plan_type plan_type_enum NOT NULL,
  amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'EGP',
  period_months integer NOT NULL DEFAULT 1,
  status text NOT NULL CHECK (status IN ('pending','paid','failed')) DEFAULT 'pending',
  provider text NULL,
  provider_payment_id text NULL,
  metadata jsonb NULL,
  created_at timestamptz DEFAULT now()
);

COMMIT;
