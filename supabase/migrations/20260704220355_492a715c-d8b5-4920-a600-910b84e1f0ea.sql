
-- Add waiting_payment table status
ALTER TYPE public.table_status ADD VALUE IF NOT EXISTS 'waiting_payment';

-- Record payments on an open order (idempotent: replaces existing rows)
-- Updates dine-in table status to waiting_payment when fully paid but not completed.
CREATE OR REPLACE FUNCTION public.record_order_payments(_order_id uuid, _payments jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _pay jsonb; _tbl uuid; _paid numeric; _tot numeric;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.orders WHERE id=_order_id AND status='open') THEN
    RAISE EXCEPTION 'Order is not open';
  END IF;
  DELETE FROM public.order_payments WHERE order_id=_order_id;
  FOR _pay IN SELECT * FROM jsonb_array_elements(_payments) LOOP
    IF (_pay->>'amount')::numeric > 0 THEN
      INSERT INTO public.order_payments(order_id, payment_method_id, amount)
      VALUES (_order_id, (_pay->>'payment_method_id')::uuid, (_pay->>'amount')::numeric);
    END IF;
  END LOOP;
  SELECT table_id, total INTO _tbl, _tot FROM public.orders WHERE id=_order_id;
  SELECT COALESCE(SUM(amount),0) INTO _paid FROM public.order_payments WHERE order_id=_order_id;
  IF _tbl IS NOT NULL THEN
    IF _paid + 0.001 >= _tot AND _tot > 0 THEN
      UPDATE public.dining_tables SET status='waiting_payment' WHERE id=_tbl;
    ELSE
      UPDATE public.dining_tables SET status='occupied' WHERE id=_tbl;
    END IF;
  END IF;
END;
$$;

-- Complete an order: requires full payment; deducts stock; frees table
CREATE OR REPLACE FUNCTION public.complete_order(_order_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _wh uuid; _item record; _ing record; _cost_total numeric := 0; _line_cost numeric;
        _paid numeric; _tot numeric;
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
  FOR _item IN SELECT oi.*, p.product_type FROM public.order_items oi
               JOIN public.products p ON p.id=oi.product_id WHERE oi.order_id=_order_id LOOP
    _line_cost := 0;
    IF EXISTS(SELECT 1 FROM public.recipe_items WHERE product_id=_item.product_id) THEN
      FOR _ing IN SELECT ri.ingredient_id, ri.qty * _item.qty AS total_qty,
                         COALESCE(s.avg_cost, p2.cost) AS unit_cost
                  FROM public.recipe_items ri
                  JOIN public.products p2 ON p2.id=ri.ingredient_id
                  LEFT JOIN public.stock s ON s.product_id=ri.ingredient_id AND s.warehouse_id=_wh
                  WHERE ri.product_id=_item.product_id LOOP
        PERFORM public.apply_stock_movement(_ing.ingredient_id, _wh, -_ing.total_qty, _ing.unit_cost, 'sale','order',_order_id,NULL);
        _line_cost := _line_cost + (_ing.total_qty * _ing.unit_cost);
      END LOOP;
    ELSE
      DECLARE unit_cost numeric;
      BEGIN
        SELECT COALESCE(s.avg_cost, p.cost) INTO unit_cost
        FROM public.products p LEFT JOIN public.stock s ON s.product_id=p.id AND s.warehouse_id=_wh
        WHERE p.id=_item.product_id;
        PERFORM public.apply_stock_movement(_item.product_id, _wh, -_item.qty, unit_cost, 'sale','order',_order_id,NULL);
        _line_cost := _item.qty * COALESCE(unit_cost, _item.cost);
      END;
    END IF;
    UPDATE public.order_items SET cost=_line_cost WHERE id=_item.id;
    _cost_total := _cost_total + _line_cost;
  END LOOP;
  UPDATE public.orders SET status='paid', paid_at=now(), cost_total=_cost_total WHERE id=_order_id;
  UPDATE public.dining_tables SET status='available'
   WHERE id=(SELECT table_id FROM public.orders WHERE id=_order_id);
END;
$$;

-- Warehouse-to-warehouse transfer (no total change)
CREATE OR REPLACE FUNCTION public.transfer_stock(_product_id uuid, _from_wh uuid, _to_wh uuid, _qty numeric, _note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _cost numeric;
BEGIN
  IF _from_wh = _to_wh THEN RAISE EXCEPTION 'Source and target warehouses must differ'; END IF;
  IF _qty <= 0 THEN RAISE EXCEPTION 'Quantity must be positive'; END IF;
  SELECT avg_cost INTO _cost FROM public.stock WHERE product_id=_product_id AND warehouse_id=_from_wh;
  _cost := COALESCE(_cost, 0);
  PERFORM public.apply_stock_movement(_product_id, _from_wh, -_qty, _cost, 'transfer_out','transfer',NULL,_note);
  PERFORM public.apply_stock_movement(_product_id, _to_wh, _qty, _cost, 'transfer_in','transfer',NULL,_note);
END;
$$;

-- Manual stock adjustment (positive or negative)
CREATE OR REPLACE FUNCTION public.adjust_stock(_product_id uuid, _warehouse_id uuid, _delta numeric, _note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _cost numeric;
BEGIN
  IF _delta = 0 THEN RETURN; END IF;
  SELECT avg_cost INTO _cost FROM public.stock WHERE product_id=_product_id AND warehouse_id=_warehouse_id;
  IF _cost IS NULL OR _cost = 0 THEN
    SELECT cost INTO _cost FROM public.products WHERE id=_product_id;
  END IF;
  PERFORM public.apply_stock_movement(_product_id, _warehouse_id, _delta, COALESCE(_cost,0), 'adjust','adjustment',NULL,_note);
END;
$$;
