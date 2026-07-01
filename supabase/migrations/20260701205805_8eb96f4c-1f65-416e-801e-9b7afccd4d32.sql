
-- =========================
-- Roles & profiles
-- =========================
CREATE TYPE public.app_role AS ENUM ('admin','cashier','waiter');
CREATE TYPE public.product_type AS ENUM ('raw','manufactured','ready');
CREATE TYPE public.sale_type AS ENUM ('takeaway','dinein','delivery');
CREATE TYPE public.order_status AS ENUM ('open','paid','void');
CREATE TYPE public.table_status AS ENUM ('available','occupied','reserved');
CREATE TYPE public.stock_move_reason AS ENUM ('purchase','sale','adjust','transfer_in','transfer_out','issue','receive','count');

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles readable to auth" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid()=id);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid()=id);

-- User roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid()=user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role=_role)
$$;

CREATE OR REPLACE FUNCTION public.is_admin() RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT public.has_role(auth.uid(),'admin')
$$;

-- Admin can also read/manage all roles
CREATE POLICY "admin manage roles" ON public.user_roles FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Auto-create profile + first user becomes admin
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE user_count INT;
BEGIN
  INSERT INTO public.profiles(id, full_name) VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)));
  SELECT count(*) INTO user_count FROM public.user_roles;
  IF user_count = 0 THEN
    INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, 'cashier');
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================
-- Settings (single row)
-- =========================
CREATE TABLE public.settings (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id=1),
  restaurant_name TEXT NOT NULL DEFAULT 'My Restaurant',
  currency TEXT NOT NULL DEFAULT 'USD',
  default_tax_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  business_day_start TIME NOT NULL DEFAULT '08:00',
  business_day_end TIME NOT NULL DEFAULT '05:00',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.settings TO authenticated;
GRANT ALL ON public.settings TO service_role;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings readable" ON public.settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manage settings" ON public.settings FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
INSERT INTO public.settings(id) VALUES (1);

-- Business day helper
CREATE OR REPLACE FUNCTION public.business_day_for(ts TIMESTAMPTZ)
RETURNS DATE LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE s TIME; e TIME; d DATE; t TIME;
BEGIN
  SELECT business_day_start, business_day_end INTO s, e FROM public.settings WHERE id=1;
  d := ts::date; t := ts::time;
  -- End-time before start-time means the day extends past midnight
  IF e < s THEN
    -- If before end-time, this belongs to previous day
    IF t < e THEN d := d - 1; END IF;
  END IF;
  RETURN d;
END;
$$;

-- =========================
-- Catalog
-- =========================
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.categories TO authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cat read" ON public.categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "cat admin" ON public.categories FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE,
  name TEXT NOT NULL,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  product_type product_type NOT NULL DEFAULT 'ready',
  price NUMERIC(12,2) NOT NULL DEFAULT 0,
  cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  taxable BOOLEAN NOT NULL DEFAULT true,
  tax_rate NUMERIC(5,2),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "prod read" ON public.products FOR SELECT TO authenticated USING (true);
CREATE POLICY "prod admin" ON public.products FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Recipes: ingredients per 1 unit of the parent product
CREATE TABLE public.recipe_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  ingredient_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  qty NUMERIC(12,3) NOT NULL DEFAULT 1,
  UNIQUE(product_id, ingredient_id)
);
GRANT SELECT ON public.recipe_items TO authenticated;
GRANT ALL ON public.recipe_items TO service_role;
ALTER TABLE public.recipe_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "recipe read" ON public.recipe_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "recipe admin" ON public.recipe_items FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Payment methods
CREATE TABLE public.payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  is_cash BOOLEAN NOT NULL DEFAULT false,
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0
);
GRANT SELECT ON public.payment_methods TO authenticated;
GRANT ALL ON public.payment_methods TO service_role;
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pm read" ON public.payment_methods FOR SELECT TO authenticated USING (true);
CREATE POLICY "pm admin" ON public.payment_methods FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
INSERT INTO public.payment_methods(name,is_cash,sort_order) VALUES
  ('Cash',true,1),('Card',false,2),('Bank',false,3);

-- Warehouses
CREATE TABLE public.warehouses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  is_default BOOLEAN NOT NULL DEFAULT false,
  active BOOLEAN NOT NULL DEFAULT true
);
GRANT SELECT ON public.warehouses TO authenticated;
GRANT ALL ON public.warehouses TO service_role;
ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wh read" ON public.warehouses FOR SELECT TO authenticated USING (true);
CREATE POLICY "wh admin" ON public.warehouses FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
INSERT INTO public.warehouses(name,is_default) VALUES ('Main Warehouse', true);

-- Suppliers
CREATE TABLE public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  tax_number TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.suppliers TO authenticated;
GRANT ALL ON public.suppliers TO service_role;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sup read" ON public.suppliers FOR SELECT TO authenticated USING (true);
CREATE POLICY "sup admin" ON public.suppliers FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Dining areas + tables
CREATE TABLE public.dining_areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  sort_order INT NOT NULL DEFAULT 0
);
GRANT SELECT ON public.dining_areas TO authenticated;
GRANT ALL ON public.dining_areas TO service_role;
ALTER TABLE public.dining_areas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "da read" ON public.dining_areas FOR SELECT TO authenticated USING (true);
CREATE POLICY "da admin" ON public.dining_areas FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE TABLE public.dining_tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  area_id UUID NOT NULL REFERENCES public.dining_areas(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  seats INT NOT NULL DEFAULT 4,
  status table_status NOT NULL DEFAULT 'available',
  UNIQUE(area_id,name)
);
GRANT SELECT, UPDATE ON public.dining_tables TO authenticated;
GRANT ALL ON public.dining_tables TO service_role;
ALTER TABLE public.dining_tables ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dt read" ON public.dining_tables FOR SELECT TO authenticated USING (true);
CREATE POLICY "dt update status" ON public.dining_tables FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "dt admin" ON public.dining_tables FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- =========================
-- Orders
-- =========================
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number BIGSERIAL,
  sale_type sale_type NOT NULL DEFAULT 'takeaway',
  table_id UUID REFERENCES public.dining_tables(id),
  status order_status NOT NULL DEFAULT 'open',
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  cost_total NUMERIC(12,2) NOT NULL DEFAULT 0,
  customer_name TEXT,
  notes TEXT,
  business_day DATE NOT NULL DEFAULT public.business_day_for(now()),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at TIMESTAMPTZ
);
GRANT SELECT, INSERT, UPDATE ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "orders read" ON public.orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "orders insert" ON public.orders FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "orders update" ON public.orders FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  name TEXT NOT NULL,
  qty NUMERIC(12,3) NOT NULL DEFAULT 1,
  price NUMERIC(12,2) NOT NULL DEFAULT 0,
  cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  notes TEXT
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_items TO authenticated;
GRANT ALL ON public.order_items TO service_role;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "oi all auth" ON public.order_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.order_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  payment_method_id UUID NOT NULL REFERENCES public.payment_methods(id),
  amount NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.order_payments TO authenticated;
GRANT ALL ON public.order_payments TO service_role;
ALTER TABLE public.order_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "op all auth" ON public.order_payments FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =========================
-- Inventory
-- =========================
CREATE TABLE public.stock (
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  warehouse_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE CASCADE,
  qty NUMERIC(14,3) NOT NULL DEFAULT 0,
  avg_cost NUMERIC(12,4) NOT NULL DEFAULT 0,
  min_qty NUMERIC(14,3) NOT NULL DEFAULT 0,
  PRIMARY KEY (product_id, warehouse_id)
);
GRANT SELECT ON public.stock TO authenticated;
GRANT ALL ON public.stock TO service_role;
ALTER TABLE public.stock ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stock read" ON public.stock FOR SELECT TO authenticated USING (true);
CREATE POLICY "stock admin" ON public.stock FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE TABLE public.stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id),
  warehouse_id UUID NOT NULL REFERENCES public.warehouses(id),
  qty NUMERIC(14,3) NOT NULL,           -- positive in, negative out
  cost NUMERIC(12,4) NOT NULL DEFAULT 0,
  reason stock_move_reason NOT NULL,
  ref_type TEXT,
  ref_id UUID,
  note TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.stock_movements TO authenticated;
GRANT ALL ON public.stock_movements TO service_role;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sm read" ON public.stock_movements FOR SELECT TO authenticated USING (true);
CREATE POLICY "sm admin" ON public.stock_movements FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Purchases
CREATE TABLE public.purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_number BIGSERIAL,
  supplier_id UUID REFERENCES public.suppliers(id),
  warehouse_id UUID NOT NULL REFERENCES public.warehouses(id),
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  paid BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  business_day DATE NOT NULL DEFAULT public.business_day_for(now()),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.purchases TO authenticated;
GRANT ALL ON public.purchases TO service_role;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pur read" ON public.purchases FOR SELECT TO authenticated USING (true);
CREATE POLICY "pur admin" ON public.purchases FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE TABLE public.purchase_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id UUID NOT NULL REFERENCES public.purchases(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  qty NUMERIC(14,3) NOT NULL,
  cost NUMERIC(12,4) NOT NULL,
  tax_rate NUMERIC(5,2) NOT NULL DEFAULT 0
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_items TO authenticated;
GRANT ALL ON public.purchase_items TO service_role;
ALTER TABLE public.purchase_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pi read" ON public.purchase_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "pi admin" ON public.purchase_items FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Business day closings
CREATE TABLE public.day_closings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_day DATE NOT NULL UNIQUE,
  opening_cash NUMERIC(12,2) NOT NULL DEFAULT 0,
  closing_cash NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_sales NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_cash NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_card NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_other NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_purchases NUMERIC(12,2) NOT NULL DEFAULT 0,
  difference NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes TEXT,
  closed_by UUID REFERENCES auth.users(id),
  closed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.day_closings TO authenticated;
GRANT ALL ON public.day_closings TO service_role;
ALTER TABLE public.day_closings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dc read" ON public.day_closings FOR SELECT TO authenticated USING (true);
CREATE POLICY "dc admin" ON public.day_closings FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Helper: apply a stock movement (updates avg cost & qty).
-- SECURITY DEFINER so authenticated users can call from server functions.
CREATE OR REPLACE FUNCTION public.apply_stock_movement(
  _product_id UUID, _warehouse_id UUID, _qty NUMERIC, _cost NUMERIC,
  _reason stock_move_reason, _ref_type TEXT, _ref_id UUID, _note TEXT
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE cur_qty NUMERIC; cur_cost NUMERIC; new_qty NUMERIC; new_cost NUMERIC;
BEGIN
  INSERT INTO public.stock(product_id,warehouse_id,qty,avg_cost)
  VALUES (_product_id,_warehouse_id,0,0)
  ON CONFLICT (product_id,warehouse_id) DO NOTHING;

  SELECT qty, avg_cost INTO cur_qty, cur_cost
  FROM public.stock WHERE product_id=_product_id AND warehouse_id=_warehouse_id FOR UPDATE;

  new_qty := cur_qty + _qty;

  IF _qty > 0 THEN
    -- Moving average cost on inbound
    IF new_qty > 0 THEN
      new_cost := ((cur_qty*cur_cost) + (_qty*_cost)) / new_qty;
    ELSE
      new_cost := _cost;
    END IF;
  ELSE
    new_cost := cur_cost;
  END IF;

  UPDATE public.stock SET qty=new_qty, avg_cost=new_cost
  WHERE product_id=_product_id AND warehouse_id=_warehouse_id;

  INSERT INTO public.stock_movements(product_id,warehouse_id,qty,cost,reason,ref_type,ref_id,note,created_by)
  VALUES (_product_id,_warehouse_id,_qty,COALESCE(NULLIF(_cost,0),new_cost),_reason,_ref_type,_ref_id,_note,auth.uid());
END;
$$;

-- Get default warehouse
CREATE OR REPLACE FUNCTION public.default_warehouse_id() RETURNS UUID
LANGUAGE sql STABLE SET search_path=public AS $$
  SELECT id FROM public.warehouses WHERE is_default=true LIMIT 1
$$;
