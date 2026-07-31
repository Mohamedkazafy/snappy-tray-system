
-- =========================
-- Feature additions: BOM / recipe support, brands, modifiers, combos, waste logging
-- =========================

ALTER TYPE public.stock_move_reason ADD VALUE IF NOT EXISTS 'waste';
ALTER TYPE public.stock_move_reason ADD VALUE IF NOT EXISTS 'spoilage';
ALTER TYPE public.stock_move_reason ADD VALUE IF NOT EXISTS 'dropped';
ALTER TYPE public.stock_move_reason ADD VALUE IF NOT EXISTS 'staff_meal';
ALTER TYPE public.stock_move_reason ADD VALUE IF NOT EXISTS 'customer_replacement';

CREATE TABLE IF NOT EXISTS public.brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.brands TO authenticated;
GRANT ALL ON public.brands TO service_role;
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;
CREATE POLICY "brands read" ON public.brands FOR SELECT TO authenticated USING (true);
CREATE POLICY "brands admin" ON public.brands FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS brand_id UUID REFERENCES public.brands(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS unit TEXT CHECK (unit IN ('grams', 'ml', 'pcs')),
  ADD COLUMN IF NOT EXISTS reorder_level NUMERIC(14,3) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.modifier_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  min_selection INT NOT NULL DEFAULT 0,
  max_selection INT NOT NULL DEFAULT 1,
  required BOOLEAN NOT NULL DEFAULT false,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.modifier_groups TO authenticated;
GRANT ALL ON public.modifier_groups TO service_role;
ALTER TABLE public.modifier_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "modifier groups read" ON public.modifier_groups FOR SELECT TO authenticated USING (true);
CREATE POLICY "modifier groups admin" ON public.modifier_groups FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE TABLE IF NOT EXISTS public.modifier_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  modifier_group_id UUID NOT NULL REFERENCES public.modifier_groups(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price_delta NUMERIC(12,2) NOT NULL DEFAULT 0,
  ingredient_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  quantity_delta NUMERIC(14,3) NOT NULL DEFAULT 0,
  is_default BOOLEAN NOT NULL DEFAULT false,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.modifier_options TO authenticated;
GRANT ALL ON public.modifier_options TO service_role;
ALTER TABLE public.modifier_options ENABLE ROW LEVEL SECURITY;
CREATE POLICY "modifier options read" ON public.modifier_options FOR SELECT TO authenticated USING (true);
CREATE POLICY "modifier options admin" ON public.modifier_options FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE TABLE IF NOT EXISTS public.order_item_modifiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id UUID NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE,
  modifier_option_id UUID NOT NULL REFERENCES public.modifier_options(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  price_delta NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.order_item_modifiers TO authenticated;
GRANT ALL ON public.order_item_modifiers TO service_role;
ALTER TABLE public.order_item_modifiers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "order item modifiers read" ON public.order_item_modifiers FOR SELECT TO authenticated USING (true);
CREATE POLICY "order item modifiers write" ON public.order_item_modifiers FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.combo_defs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(product_id)
);
GRANT SELECT ON public.combo_defs TO authenticated;
GRANT ALL ON public.combo_defs TO service_role;
ALTER TABLE public.combo_defs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "combo defs read" ON public.combo_defs FOR SELECT TO authenticated USING (true);
CREATE POLICY "combo defs admin" ON public.combo_defs FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE TABLE IF NOT EXISTS public.combo_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  combo_id UUID NOT NULL REFERENCES public.combo_defs(id) ON DELETE CASCADE,
  step_number INT NOT NULL DEFAULT 1,
  title TEXT NOT NULL,
  required BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.combo_steps TO authenticated;
GRANT ALL ON public.combo_steps TO service_role;
ALTER TABLE public.combo_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "combo steps read" ON public.combo_steps FOR SELECT TO authenticated USING (true);
CREATE POLICY "combo steps admin" ON public.combo_steps FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE TABLE IF NOT EXISTS public.combo_choices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  combo_step_id UUID NOT NULL REFERENCES public.combo_steps(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  surcharge_delta NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(combo_step_id, product_id)
);
GRANT SELECT ON public.combo_choices TO authenticated;
GRANT ALL ON public.combo_choices TO service_role;
ALTER TABLE public.combo_choices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "combo choices read" ON public.combo_choices FOR SELECT TO authenticated USING (true);
CREATE POLICY "combo choices admin" ON public.combo_choices FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE TABLE IF NOT EXISTS public.inventory_waste_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  warehouse_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE RESTRICT,
  qty NUMERIC(14,3) NOT NULL,
  reason stock_move_reason NOT NULL,
  note TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.inventory_waste_logs TO authenticated;
GRANT ALL ON public.inventory_waste_logs TO service_role;
ALTER TABLE public.inventory_waste_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "waste logs read" ON public.inventory_waste_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "waste logs admin" ON public.inventory_waste_logs FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE OR REPLACE FUNCTION public.log_inventory_waste(
  _product_id UUID,
  _warehouse_id UUID,
  _qty NUMERIC,
  _reason stock_move_reason,
  _note TEXT
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _cost NUMERIC;
BEGIN
  IF _qty <= 0 THEN
    RAISE EXCEPTION 'Waste quantity must be positive';
  END IF;

  SELECT COALESCE(avg_cost, p.cost, 0) INTO _cost
  FROM public.products p
  LEFT JOIN public.stock s ON s.product_id=p.id AND s.warehouse_id=_warehouse_id
  WHERE p.id=_product_id;

  PERFORM public.apply_stock_movement(_product_id, _warehouse_id, -_qty, COALESCE(_cost,0), _reason, 'waste', NULL, _note);

  INSERT INTO public.inventory_waste_logs(product_id, warehouse_id, qty, reason, note, created_by)
  VALUES (_product_id, _warehouse_id, _qty, _reason, _note, auth.uid());
END;
$$;
REVOKE EXECUTE ON FUNCTION public.log_inventory_waste(UUID, UUID, NUMERIC, stock_move_reason, TEXT) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.log_inventory_waste(UUID, UUID, NUMERIC, stock_move_reason, TEXT) TO authenticated;

-- =========================
-- Update order completion to also consume recipe ingredients and modifier-linked inventory deltas.
-- =========================
CREATE OR REPLACE FUNCTION public.complete_order(_order_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  _wh uuid;
  _item record;
  _ing record;
  _mod record;
  _cost_total numeric := 0;
  _line_cost numeric;
  _paid numeric;
  _tot numeric;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.orders WHERE id=_order_id AND status='open') THEN
    RAISE EXCEPTION 'Order is not open';
  END IF;

  SELECT total INTO _tot FROM public.orders WHERE id=_order_id;
  SELECT COALESCE(SUM(amount),0) INTO _paid FROM public.order_payments WHERE order_id=_order_id;
  IF _paid + 0.001 < _tot THEN
    RAISE EXCEPTION 'Order is not fully paid (paid %, total %)', _paid, _tot;
  END IF;

  _wh := public.default_warehouse_id();

  FOR _item IN
    SELECT oi.*, p.product_type
    FROM public.order_items oi
    JOIN public.products p ON p.id=oi.product_id
    WHERE oi.order_id=_order_id
  LOOP
    _line_cost := 0;

    -- base product BOM deduction
    IF EXISTS(SELECT 1 FROM public.recipe_items WHERE product_id=_item.product_id) THEN
      FOR _ing IN
        SELECT ri.ingredient_id,
               ri.qty * _item.qty AS total_qty,
               COALESCE(s.avg_cost, p2.cost) AS unit_cost
        FROM public.recipe_items ri
        JOIN public.products p2 ON p2.id=ri.ingredient_id
        LEFT JOIN public.stock s ON s.product_id=ri.ingredient_id AND s.warehouse_id=_wh
        WHERE ri.product_id=_item.product_id
      LOOP
        PERFORM public.apply_stock_movement(
          _ing.ingredient_id,
          _wh,
          -_ing.total_qty,
          _ing.unit_cost,
          'sale',
          'order',
          _order_id,
          NULL
        );
        _line_cost := _line_cost + (_ing.total_qty * _ing.unit_cost);
      END LOOP;
    ELSE
      DECLARE unit_cost numeric;
      BEGIN
        SELECT COALESCE(s.avg_cost, p.cost) INTO unit_cost
        FROM public.products p
        LEFT JOIN public.stock s ON s.product_id=p.id AND s.warehouse_id=_wh
        WHERE p.id=_item.product_id;

        PERFORM public.apply_stock_movement(
          _item.product_id,
          _wh,
          -_item.qty,
          unit_cost,
          'sale',
          'order',
          _order_id,
          NULL
        );
        _line_cost := _item.qty * COALESCE(unit_cost, _item.cost);
      END;
    END IF;

    -- extra modifier inventory deltas (per-line consumption)
    FOR _mod IN
      SELECT oim.id,
             mo.ingredient_id,
             mo.quantity_delta,
             mo.price_delta,
             oi.qty AS item_qty,
             COALESCE(s.avg_cost, p2.cost) AS unit_cost,
             oi.product_id,
             oi.order_id
      FROM public.order_item_modifiers oim
      JOIN public.modifier_options mo ON mo.id=oim.modifier_option_id
      JOIN public.order_items oi ON oi.id=oim.order_item_id
      LEFT JOIN public.stock s ON s.product_id=mo.ingredient_id AND s.warehouse_id=_wh
      LEFT JOIN public.products p2 ON p2.id=mo.ingredient_id
      WHERE oim.order_item_id=_item.id AND mo.ingredient_id IS NOT NULL
    LOOP
      IF _mod.quantity_delta <> 0 THEN
        PERFORM public.apply_stock_movement(
          _mod.ingredient_id,
          _wh,
          -(_mod.quantity_delta * _mod.item_qty),
          COALESCE(_mod.unit_cost, 0),
          'sale',
          'order',
          _order_id,
          _mod.name
        );
        _line_cost := _line_cost + (COALESCE(_mod.quantity_delta,0) * _mod.item_qty * COALESCE(_mod.unit_cost,0));
      END IF;
    END LOOP;

    UPDATE public.order_items SET cost=_line_cost WHERE id=_item.id;
    _cost_total := _cost_total + _line_cost;
  END LOOP;

  UPDATE public.orders
  SET status='paid', paid_at=now(), cost_total=_cost_total
  WHERE id=_order_id;

  UPDATE public.dining_tables
  SET status='available'
  WHERE id=(SELECT table_id FROM public.orders WHERE id=_order_id);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.complete_order(UUID) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.complete_order(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.finalize_order(
  _order_id UUID,
  _payments JSONB
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  _wh UUID;
  _pay JSONB;
  _item RECORD;
  _ing RECORD;
  _mod RECORD;
  _cost_total NUMERIC := 0;
  _line_cost NUMERIC;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.orders WHERE id=_order_id AND status='open') THEN
    RAISE EXCEPTION 'Order not open';
  END IF;

  _wh := public.default_warehouse_id();

  FOR _pay IN SELECT * FROM jsonb_array_elements(_payments) LOOP
    INSERT INTO public.order_payments(order_id,payment_method_id,amount)
    VALUES (_order_id, (_pay->>'payment_method_id')::uuid, (_pay->>'amount')::numeric);
  END LOOP;

  FOR _item IN
    SELECT oi.*, p.product_type
    FROM public.order_items oi
    JOIN public.products p ON p.id=oi.product_id
    WHERE oi.order_id=_order_id
  LOOP
    _line_cost := 0;

    IF EXISTS(SELECT 1 FROM public.recipe_items WHERE product_id=_item.product_id) THEN
      FOR _ing IN
        SELECT ri.ingredient_id,
               ri.qty * _item.qty AS total_qty,
               COALESCE(s.avg_cost, p2.cost) AS unit_cost
        FROM public.recipe_items ri
        JOIN public.products p2 ON p2.id=ri.ingredient_id
        LEFT JOIN public.stock s ON s.product_id=ri.ingredient_id AND s.warehouse_id=_wh
        WHERE ri.product_id=_item.product_id
      LOOP
        PERFORM public.apply_stock_movement(
          _ing.ingredient_id,
          _wh,
          -_ing.total_qty,
          _ing.unit_cost,
          'sale',
          'order',
          _order_id,
          NULL
        );
        _line_cost := _line_cost + (_ing.total_qty * _ing.unit_cost);
      END LOOP;
    ELSE
      DECLARE unit_cost NUMERIC;
      BEGIN
        SELECT COALESCE(s.avg_cost, p.cost) INTO unit_cost
        FROM public.products p
        LEFT JOIN public.stock s ON s.product_id=p.id AND s.warehouse_id=_wh
        WHERE p.id=_item.product_id;

        PERFORM public.apply_stock_movement(
          _item.product_id,
          _wh,
          -_item.qty,
          unit_cost,
          'sale',
          'order',
          _order_id,
          NULL
        );
        _line_cost := _item.qty * COALESCE(unit_cost, _item.cost);
      END;
    END IF;

    FOR _mod IN
      SELECT oim.id,
             mo.ingredient_id,
             mo.quantity_delta,
             oi.qty AS item_qty,
             COALESCE(s.avg_cost, p2.cost) AS unit_cost,
             oim.name
      FROM public.order_item_modifiers oim
      JOIN public.modifier_options mo ON mo.id=oim.modifier_option_id
      JOIN public.order_items oi ON oi.id=oim.order_item_id
      LEFT JOIN public.stock s ON s.product_id=mo.ingredient_id AND s.warehouse_id=_wh
      LEFT JOIN public.products p2 ON p2.id=mo.ingredient_id
      WHERE oim.order_item_id=_item.id AND mo.ingredient_id IS NOT NULL
    LOOP
      IF _mod.quantity_delta <> 0 THEN
        PERFORM public.apply_stock_movement(
          _mod.ingredient_id,
          _wh,
          -(_mod.quantity_delta * _mod.item_qty),
          COALESCE(_mod.unit_cost, 0),
          'sale',
          'order',
          _order_id,
          _mod.name
        );
        _line_cost := _line_cost + (COALESCE(_mod.quantity_delta,0) * _mod.item_qty * COALESCE(_mod.unit_cost,0));
      END IF;
    END LOOP;

    UPDATE public.order_items SET cost=_line_cost WHERE id=_item.id;
    _cost_total := _cost_total + _line_cost;
  END LOOP;

  UPDATE public.orders SET status='paid', paid_at=now(), cost_total=_cost_total
  WHERE id=_order_id;

  UPDATE public.dining_tables SET status='available'
  WHERE id=(SELECT table_id FROM public.orders WHERE id=_order_id);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.finalize_order(UUID, JSONB) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.finalize_order(UUID, JSONB) TO authenticated;
