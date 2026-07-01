
CREATE OR REPLACE FUNCTION public.finalize_order(
  _order_id UUID,
  _payments JSONB  -- [{ "payment_method_id": "...", "amount": 12.5 }, ...]
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  _wh UUID;
  _pay JSONB;
  _item RECORD;
  _ing RECORD;
  _cost_total NUMERIC := 0;
  _line_cost NUMERIC;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.orders WHERE id=_order_id AND status='open') THEN
    RAISE EXCEPTION 'Order not open';
  END IF;

  _wh := public.default_warehouse_id();

  -- Insert payments
  FOR _pay IN SELECT * FROM jsonb_array_elements(_payments) LOOP
    INSERT INTO public.order_payments(order_id,payment_method_id,amount)
    VALUES (_order_id, (_pay->>'payment_method_id')::uuid, (_pay->>'amount')::numeric);
  END LOOP;

  -- Deduct stock for every item
  FOR _item IN SELECT oi.*, p.product_type FROM public.order_items oi
               JOIN public.products p ON p.id=oi.product_id
               WHERE oi.order_id=_order_id LOOP
    _line_cost := 0;
    -- If recipe exists, expand to ingredients; else deduct product itself
    IF EXISTS(SELECT 1 FROM public.recipe_items WHERE product_id=_item.product_id) THEN
      FOR _ing IN SELECT ri.ingredient_id, ri.qty * _item.qty AS total_qty,
                         COALESCE(s.avg_cost, p2.cost) AS unit_cost
                  FROM public.recipe_items ri
                  JOIN public.products p2 ON p2.id=ri.ingredient_id
                  LEFT JOIN public.stock s ON s.product_id=ri.ingredient_id AND s.warehouse_id=_wh
                  WHERE ri.product_id=_item.product_id LOOP
        PERFORM public.apply_stock_movement(_ing.ingredient_id, _wh, -_ing.total_qty, _ing.unit_cost,
          'sale','order',_order_id, NULL);
        _line_cost := _line_cost + (_ing.total_qty * _ing.unit_cost);
      END LOOP;
    ELSE
      DECLARE unit_cost NUMERIC;
      BEGIN
        SELECT COALESCE(s.avg_cost, p.cost) INTO unit_cost
        FROM public.products p LEFT JOIN public.stock s ON s.product_id=p.id AND s.warehouse_id=_wh
        WHERE p.id=_item.product_id;
        PERFORM public.apply_stock_movement(_item.product_id, _wh, -_item.qty, unit_cost,
          'sale','order',_order_id, NULL);
        _line_cost := _item.qty * COALESCE(unit_cost, _item.cost);
      END;
    END IF;
    UPDATE public.order_items SET cost=_line_cost WHERE id=_item.id;
    _cost_total := _cost_total + _line_cost;
  END LOOP;

  UPDATE public.orders SET status='paid', paid_at=now(), cost_total=_cost_total
  WHERE id=_order_id;

  -- If dine-in, free the table
  UPDATE public.dining_tables SET status='available'
  WHERE id=(SELECT table_id FROM public.orders WHERE id=_order_id);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.finalize_order(UUID, JSONB) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.finalize_order(UUID, JSONB) TO authenticated;

-- Purchase receive helper
CREATE OR REPLACE FUNCTION public.receive_purchase(_purchase_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _wh UUID; _it RECORD;
BEGIN
  SELECT warehouse_id INTO _wh FROM public.purchases WHERE id=_purchase_id;
  FOR _it IN SELECT * FROM public.purchase_items WHERE purchase_id=_purchase_id LOOP
    PERFORM public.apply_stock_movement(_it.product_id,_wh,_it.qty,_it.cost,'purchase','purchase',_purchase_id,NULL);
  END LOOP;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.receive_purchase(UUID) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.receive_purchase(UUID) TO authenticated;
