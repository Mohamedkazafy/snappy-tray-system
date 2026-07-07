
-- Helper: is the caller a staff member (has any role)
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = auth.uid())
$$;

-- Lock down SECURITY DEFINER functions: revoke from anon/public, grant only where needed
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_staff() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.business_day_for(timestamptz) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.apply_stock_movement(uuid, uuid, numeric, numeric, stock_move_reason, text, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.receive_purchase(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.transfer_stock(uuid, uuid, uuid, numeric, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.adjust_stock(uuid, uuid, numeric, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.complete_order(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_order_payments(uuid, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.finalize_order(uuid, jsonb) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_staff() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.business_day_for(timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.receive_purchase(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.transfer_stock(uuid, uuid, uuid, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.adjust_stock(uuid, uuid, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_order(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_order_payments(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_order(uuid, jsonb) TO authenticated;

-- dining_tables: replace permissive UPDATE with staff-only
DROP POLICY IF EXISTS "dt update status" ON public.dining_tables;
CREATE POLICY "dt update staff" ON public.dining_tables
  FOR UPDATE TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

-- order_items: replace permissive ALL with staff-scoped policies
DROP POLICY IF EXISTS "oi all auth" ON public.order_items;
CREATE POLICY "oi read staff" ON public.order_items
  FOR SELECT TO authenticated USING (public.is_staff());
CREATE POLICY "oi write staff" ON public.order_items
  FOR INSERT TO authenticated WITH CHECK (public.is_staff());
CREATE POLICY "oi update staff" ON public.order_items
  FOR UPDATE TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());
CREATE POLICY "oi delete staff" ON public.order_items
  FOR DELETE TO authenticated USING (public.is_staff());

-- order_payments: same
DROP POLICY IF EXISTS "op all auth" ON public.order_payments;
CREATE POLICY "op read staff" ON public.order_payments
  FOR SELECT TO authenticated USING (public.is_staff());
CREATE POLICY "op insert staff" ON public.order_payments
  FOR INSERT TO authenticated WITH CHECK (public.is_staff());
CREATE POLICY "op update staff" ON public.order_payments
  FOR UPDATE TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());
CREATE POLICY "op delete staff" ON public.order_payments
  FOR DELETE TO authenticated USING (public.is_staff());

-- orders: restrict SELECT and UPDATE to staff
DROP POLICY IF EXISTS "orders read" ON public.orders;
DROP POLICY IF EXISTS "orders update" ON public.orders;
CREATE POLICY "orders read staff" ON public.orders
  FOR SELECT TO authenticated USING (public.is_staff());
CREATE POLICY "orders update staff" ON public.orders
  FOR UPDATE TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());
CREATE POLICY "orders delete admin" ON public.orders
  FOR DELETE TO authenticated USING (public.is_admin());

-- profiles: restrict SELECT to self or admin
DROP POLICY IF EXISTS "profiles readable to auth" ON public.profiles;
CREATE POLICY "profiles read self or admin" ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id OR public.is_admin());
