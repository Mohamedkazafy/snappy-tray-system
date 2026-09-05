BEGIN;

CREATE TABLE IF NOT EXISTS public.combos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price NUMERIC(12, 2) NOT NULL CHECK (price >= 0),
  image_url TEXT,
  is_available BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.combo_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  combo_id UUID NOT NULL REFERENCES public.combos(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  UNIQUE (combo_id, product_id)
);

CREATE INDEX IF NOT EXISTS combos_tenant_id_idx ON public.combos(tenant_id);
CREATE INDEX IF NOT EXISTS combo_items_combo_id_idx ON public.combo_items(combo_id);

ALTER TABLE public.combos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.combo_items ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.combos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.combo_items TO authenticated;
GRANT ALL ON public.combos TO service_role;
GRANT ALL ON public.combo_items TO service_role;

DROP POLICY IF EXISTS "combos tenant access" ON public.combos;
CREATE POLICY "combos tenant access" ON public.combos
  FOR ALL TO authenticated
  USING (
    tenant_id IN (
      SELECT id FROM public.tenants
      WHERE owner_id = auth.uid()
    )
    OR public.is_admin()
  )
  WITH CHECK (
    tenant_id IN (
      SELECT id FROM public.tenants
      WHERE owner_id = auth.uid()
    )
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "combo items tenant access" ON public.combo_items;
CREATE POLICY "combo items tenant access" ON public.combo_items
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.combos c
      JOIN public.tenants t ON t.id = c.tenant_id
      WHERE c.id = combo_items.combo_id
        AND (t.owner_id = auth.uid() OR public.is_admin())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.combos c
      JOIN public.tenants t ON t.id = c.tenant_id
      WHERE c.id = combo_items.combo_id
        AND (t.owner_id = auth.uid() OR public.is_admin())
    )
  );

COMMIT;
