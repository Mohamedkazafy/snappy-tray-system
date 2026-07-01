
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.business_day_for(TIMESTAMPTZ) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.apply_stock_movement(UUID,UUID,NUMERIC,NUMERIC,stock_move_reason,TEXT,UUID,TEXT) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.default_warehouse_id() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.has_role(UUID, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.business_day_for(TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_stock_movement(UUID,UUID,NUMERIC,NUMERIC,stock_move_reason,TEXT,UUID,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.default_warehouse_id() TO authenticated;
