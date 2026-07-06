
-- Add 'special' sale type for AI-agent orders
ALTER TYPE public.sale_type ADD VALUE IF NOT EXISTS 'special';

-- Add customer phone to orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_phone text;

-- API tokens for external AI-agent integration
CREATE TABLE IF NOT EXISTS public.api_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  token_prefix text NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.api_tokens TO authenticated;
GRANT ALL ON public.api_tokens TO service_role;

ALTER TABLE public.api_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage api tokens" ON public.api_tokens
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
