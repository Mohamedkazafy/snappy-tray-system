BEGIN;

CREATE TABLE IF NOT EXISTS public.inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  unit TEXT NOT NULL CHECK (unit IN ('piece', 'kg', 'liter', 'gm', 'ml')),
  quantity NUMERIC(14, 3) NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.product_recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  inventory_item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  quantity_required NUMERIC(14, 3) NOT NULL CHECK (quantity_required > 0),
  UNIQUE (product_id, inventory_item_id)
);

ALTER TABLE public.inventory_items
  DROP CONSTRAINT IF EXISTS inventory_items_unit_check;
UPDATE public.inventory_items
SET unit = 'l'
WHERE unit = 'liter';
ALTER TABLE public.inventory_items
  ADD CONSTRAINT inventory_items_unit_check
  CHECK (unit IN ('gm', 'kg', 'ml', 'l', 'piece'));
ALTER TABLE public.inventory_items
  ALTER COLUMN quantity TYPE NUMERIC(14, 3)
  USING round(quantity::numeric, 3);

ALTER TABLE public.product_recipes
  ALTER COLUMN quantity_required TYPE NUMERIC(14, 3)
  USING round(quantity_required::numeric, 3);

CREATE TABLE IF NOT EXISTS public.inventory_deductions (
  order_id UUID PRIMARY KEY REFERENCES public.orders(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS combo_id UUID REFERENCES public.combos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS combo_items JSONB;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS direct_inventory_item_id UUID REFERENCES public.inventory_items(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS inventory_items_tenant_id_idx ON public.inventory_items(tenant_id);
CREATE INDEX IF NOT EXISTS product_recipes_product_id_idx ON public.product_recipes(product_id);

ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_recipes ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_recipes TO authenticated;
GRANT ALL ON public.inventory_items TO service_role;
GRANT ALL ON public.product_recipes TO service_role;

DROP POLICY IF EXISTS "inventory items tenant access" ON public.inventory_items;
CREATE POLICY "inventory items tenant access" ON public.inventory_items
  FOR ALL TO authenticated
  USING (tenant_id IN (SELECT id FROM public.tenants WHERE owner_id = auth.uid()) OR public.is_admin())
  WITH CHECK (tenant_id IN (SELECT id FROM public.tenants WHERE owner_id = auth.uid()) OR public.is_admin());

DROP POLICY IF EXISTS "product recipes tenant access" ON public.product_recipes;
CREATE POLICY "product recipes tenant access" ON public.product_recipes
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.products p
      JOIN public.tenants t ON t.id = p.tenant_id
      WHERE p.id = product_recipes.product_id
        AND (t.owner_id = auth.uid() OR public.is_admin())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.products p
      JOIN public.tenants t ON t.id = p.tenant_id
      WHERE p.id = product_recipes.product_id
        AND (t.owner_id = auth.uid() OR public.is_admin())
    )
  );

CREATE OR REPLACE FUNCTION public.deduct_inventory_for_order(_order_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  order_tenant UUID;
  line RECORD;
BEGIN
  SELECT tenant_id INTO order_tenant FROM public.orders WHERE id = _order_id FOR UPDATE;

  IF EXISTS (
    SELECT 1 FROM public.inventory_deductions
    WHERE order_id = _order_id
  ) THEN
    RETURN;
  END IF;

  FOR line IN
    SELECT product_id, qty, combo_items
    FROM public.order_items
    WHERE order_id = _order_id
  LOOP
    PERFORM public.deduct_inventory_for_product(line.product_id, line.qty, order_tenant);
    IF line.combo_items IS NOT NULL AND jsonb_typeof(line.combo_items) = 'array' THEN
      PERFORM public.deduct_inventory_for_combo_items(line.combo_items, line.qty, order_tenant);
    END IF;
  END LOOP;

  INSERT INTO public.inventory_deductions(order_id) VALUES (_order_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.deduct_inventory_for_product(
  _product_id UUID,
  _quantity NUMERIC,
  _tenant_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  product_record RECORD;
  recipe RECORD;
  deduction NUMERIC;
BEGIN
  SELECT product_type, direct_inventory_item_id
  INTO product_record
  FROM public.products
  WHERE id = _product_id;

  IF product_record.direct_inventory_item_id IS NOT NULL THEN
    UPDATE public.inventory_items
    SET quantity = quantity - _quantity
    WHERE id = product_record.direct_inventory_item_id
      AND tenant_id = _tenant_id
      AND quantity >= _quantity;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Insufficient inventory for product %', _product_id;
    END IF;
    RETURN;
  END IF;

  FOR recipe IN
    SELECT inventory_item_id, quantity_required
    FROM public.product_recipes
    WHERE product_id = _product_id
  LOOP
    deduction := recipe.quantity_required * _quantity;
    UPDATE public.inventory_items
    SET quantity = quantity - deduction
    WHERE id = recipe.inventory_item_id
      AND tenant_id = _tenant_id
      AND quantity >= deduction;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Insufficient inventory for item %', recipe.inventory_item_id;
    END IF;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.deduct_inventory_for_combo_items(
  _items JSONB,
  _parent_quantity NUMERIC,
  _tenant_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  combo_line JSONB;
  combo_product_id UUID;
BEGIN
  FOR combo_line IN SELECT value FROM jsonb_array_elements(_items)
  LOOP
    combo_product_id := NULLIF(combo_line->>'product_id', '')::UUID;
    PERFORM public.deduct_inventory_for_product(
      combo_product_id,
      COALESCE((combo_line->>'quantity')::NUMERIC, 1) * _parent_quantity,
      _tenant_id
    );
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.deduct_inventory_when_order_paid()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'paid' THEN
    IF TG_OP = 'INSERT' THEN
      PERFORM public.deduct_inventory_for_order(NEW.id);
    ELSIF OLD.status IS DISTINCT FROM NEW.status THEN
      PERFORM public.deduct_inventory_for_order(NEW.id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_deduct_inventory_when_order_paid ON public.orders;
CREATE TRIGGER trg_deduct_inventory_when_order_paid
AFTER INSERT OR UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.deduct_inventory_when_order_paid();

GRANT EXECUTE ON FUNCTION public.deduct_inventory_for_order(UUID) TO service_role;
REVOKE EXECUTE ON FUNCTION public.deduct_inventory_for_order(UUID) FROM PUBLIC, anon, authenticated;

COMMIT;
