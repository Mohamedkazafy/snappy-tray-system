import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer, PageHeader } from "@/components/page";
import { Card } from "@/components/ui/card";
import { money } from "@/lib/format";
import { ShoppingCart, Utensils, DollarSign, Boxes, AlertTriangle, Receipt } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard" }] }),
  component: Dashboard,
});

function Dashboard() {
  const [today, setToday] = useState({ sales: 0, orders: 0, cash: 0, cost: 0 });
  const [openTables, setOpenTables] = useState(0);
  const [lowStock, setLowStock] = useState<any[]>([]);
  const [businessDay, setBusinessDay] = useState<string>("");
  const [recent, setRecent] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const { data: bd } = await supabase.rpc("business_day_for", { ts: new Date().toISOString() });
      const day = bd as unknown as string;
      setBusinessDay(day);
      const [orders, tables, stock, latest] = await Promise.all([
        supabase.from("orders").select("id, total, cost_total, order_payments(amount, payment_methods(is_cash))").eq("business_day", day).eq("status", "paid"),
        supabase.from("dining_tables").select("id", { count: "exact", head: true }).eq("status", "occupied"),
        supabase.from("stock").select("qty, min_qty, products(name)"),
        supabase.from("orders").select("order_number, sale_type, total, created_at, status").eq("business_day", day).order("created_at", { ascending: false }).limit(8),
      ]);
      const ords = orders.data ?? [];
      let sales = 0, cost = 0, cash = 0;
      ords.forEach((o: any) => {
        sales += Number(o.total);
        cost += Number(o.cost_total ?? 0);
        (o.order_payments ?? []).forEach((p: any) => { if (p.payment_methods?.is_cash) cash += Number(p.amount); });
      });
      setToday({ sales, orders: ords.length, cash, cost });
      setOpenTables(tables.count ?? 0);
      setLowStock((stock.data ?? []).filter((s: any) => Number(s.min_qty) > 0 && Number(s.qty) <= Number(s.min_qty)).slice(0, 8));
      setRecent(latest.data ?? []);
    })();
  }, []);

  return (
    <PageContainer>
      <PageHeader title="Dashboard" subtitle={businessDay ? `Business day: ${businessDay}` : ""} />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Stat icon={DollarSign} label="Sales" value={money(today.sales)} />
        <Stat icon={Receipt} label="Orders" value={today.orders} />
        <Stat icon={ShoppingCart} label="Cash" value={money(today.cash)} />
        <Stat icon={Utensils} label="Open tables" value={openTables} />
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <Card className="p-4">
          <h3 className="font-semibold mb-3 flex items-center gap-2"><Receipt className="w-4 h-4" />Recent orders</h3>
          {recent.length === 0 ? <p className="text-sm text-muted-foreground">No orders yet.</p> : (
            <div className="space-y-1">
              {recent.map((r: any) => (
                <div key={r.order_number} className="flex justify-between text-sm py-1 border-b border-border last:border-0">
                  <span>#{r.order_number} <span className="text-muted-foreground capitalize">· {r.sale_type}</span></span>
                  <span className="font-medium">{money(r.total)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
        <Card className="p-4">
          <h3 className="font-semibold mb-3 flex items-center gap-2"><AlertTriangle className="w-4 h-4" />Low stock</h3>
          {lowStock.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing low. <Link to="/inventory" className="text-primary">View inventory</Link></p>
          ) : (
            <div className="space-y-1">
              {lowStock.map((s: any, i: number) => (
                <div key={i} className="flex justify-between text-sm py-1"><span>{s.products?.name}</span><span className="text-warning-foreground font-medium">{Number(s.qty).toFixed(2)}</span></div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </PageContainer>
  );
}

function Stat({ icon: Icon, label, value }: { icon: any; label: string; value: any }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-muted-foreground text-sm"><Icon className="w-4 h-4" />{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </Card>
  );
}
