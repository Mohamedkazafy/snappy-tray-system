import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { money } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Minus, Trash2, ArrowLeft, Search, Printer, CreditCard, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/table-order/$orderId")({
  head: () => ({ meta: [{ title: "Table order" }] }),
  component: TableOrder,
});

function TableOrder() {
  const { orderId } = Route.useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [paidRows, setPaidRows] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [methods, setMethods] = useState<any[]>([]);
  const [settings, setSettings] = useState<{ currency: string; default_tax_rate: number }>({ currency: "USD", default_tax_rate: 0 });
  const [search, setSearch] = useState("");
  const [activeCat, setActiveCat] = useState<string | "all">("all");
  const [payOpen, setPayOpen] = useState(false);
  const [payments, setPayments] = useState<Record<string, number>>({});
  const [discount, setDiscount] = useState(0);
  const [busy, setBusy] = useState(false);

  async function load() {
    const [o, i, pay, p, c, m, s] = await Promise.all([
      supabase.from("orders").select("*, dining_tables(name)").eq("id", orderId).single(),
      supabase.from("order_items").select("*").eq("order_id", orderId),
      supabase.from("order_payments").select("amount").eq("order_id", orderId),
      supabase.from("products").select("id,name,price,category_id,taxable,tax_rate,active").eq("active", true).order("name"),
      supabase.from("categories").select("id,name").eq("active", true).order("sort_order"),
      supabase.from("payment_methods").select("id,name,is_cash").eq("active", true).order("sort_order"),
      supabase.from("settings").select("currency,default_tax_rate").single(),
    ]);
    setOrder(o.data);
    setItems(i.data ?? []);
    setPaidRows(pay.data ?? []);
    setProducts(p.data ?? []);
    setCategories(c.data ?? []);
    setMethods(m.data ?? []);
    if (s.data) setSettings(s.data as any);
    if (o.data) setDiscount(Number(o.data.discount || 0));
  }
  useEffect(() => { load(); }, [orderId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) =>
      (activeCat === "all" || p.category_id === activeCat) &&
      (!q || p.name.toLowerCase().includes(q))
    );
  }, [products, activeCat, search]);

  const totals = useMemo(() => {
    const subtotal = items.reduce((s, i) => s + Number(i.qty) * Number(i.price), 0);
    const disc = Math.min(discount, subtotal);
    const taxable = items.reduce((s, i) => s + Number(i.qty) * Number(i.price) * (Number(i.tax_rate) / 100), 0);
    const tax = subtotal > 0 ? taxable * (1 - disc / subtotal) : 0;
    return { subtotal, discount: disc, tax: Math.max(0, tax), total: subtotal - disc + Math.max(0, tax) };
  }, [items, discount]);

  const paidSum = paidRows.reduce((s, r) => s + Number(r.amount), 0);
  const remaining = Math.max(0, totals.total - paidSum);
  const fullyPaid = paidSum + 0.001 >= totals.total && totals.total > 0;
  const editable = order?.status === "open";

  async function saveTotals() {
    await supabase.from("orders").update({
      subtotal: totals.subtotal, discount: totals.discount, tax: totals.tax, total: totals.total,
    }).eq("id", orderId);
  }

  async function addProduct(p: any) {
    if (!editable) return;
    const rate = p.taxable ? (p.tax_rate ?? settings.default_tax_rate ?? 0) : 0;
    const existing = items.find((i) => i.product_id === p.id);
    if (existing) {
      const { data, error } = await supabase.from("order_items").update({ qty: Number(existing.qty) + 1 }).eq("id", existing.id).select().single();
      if (error) return toast.error(error.message);
      setItems(items.map((i) => i.id === existing.id ? data : i));
    } else {
      const { data, error } = await supabase.from("order_items").insert({
        order_id: orderId, product_id: p.id, name: p.name, qty: 1, price: Number(p.price), tax_rate: Number(rate),
      }).select().single();
      if (error) return toast.error(error.message);
      setItems([...items, data]);
    }
  }

  async function changeQty(i: any, delta: number) {
    if (!editable) return;
    const q = Number(i.qty) + delta;
    if (q <= 0) {
      await supabase.from("order_items").delete().eq("id", i.id);
      setItems(items.filter((x) => x.id !== i.id));
    } else {
      const { data } = await supabase.from("order_items").update({ qty: q }).eq("id", i.id).select().single();
      setItems(items.map((x) => x.id === i.id ? data : x));
    }
  }

  function openCharge() {
    if (items.length === 0) return toast.error("Add items first");
    const first = methods[0];
    if (first) setPayments({ [first.id]: Number(remaining.toFixed(2)) });
    setPayOpen(true);
  }

  async function doCharge() {
    const sum = Object.values(payments).reduce((s, v) => s + Number(v || 0), 0);
    if (sum <= 0) return toast.error("Enter a payment amount");
    setBusy(true);
    try {
      await saveTotals();
      // record_order_payments replaces all payments; we merge with existing paidRows to preserve prior charges.
      const merged: Record<string, number> = {};
      for (const r of paidRows) {
        const key = (r as any).payment_method_id ?? "";
        // paidRows doesn't have payment_method_id since we didn't select it; refetch quickly
      }
      const { data: existing } = await supabase.from("order_payments").select("payment_method_id, amount").eq("order_id", orderId);
      (existing ?? []).forEach((r: any) => { merged[r.payment_method_id] = (merged[r.payment_method_id] ?? 0) + Number(r.amount); });
      Object.entries(payments).forEach(([k, v]) => { if (Number(v) > 0) merged[k] = (merged[k] ?? 0) + Number(v); });
      const pays = Object.entries(merged).map(([payment_method_id, amount]) => ({ payment_method_id, amount }));
      const { error } = await supabase.rpc("record_order_payments", { _order_id: orderId, _payments: pays });
      if (error) throw error;
      await load();
      setPayOpen(false);
      toast.success("Payment recorded");
    } catch (err: any) { toast.error(err.message); }
    finally { setBusy(false); }
  }

  function doPrint() {
    window.open(`/receipt/${orderId}`, "_blank");
  }

  async function doComplete() {
    setBusy(true);
    try {
      await saveTotals();
      const { error } = await supabase.rpc("complete_order", { _order_id: orderId });
      if (error) throw error;
      toast.success("Order completed");
      navigate({ to: "/tables" });
    } catch (err: any) { toast.error(err.message); }
    finally { setBusy(false); }
  }

  async function cancelOrder() {
    if (!confirm("Cancel this open order?")) return;
    await supabase.from("orders").update({ status: "void" }).eq("id", orderId);
    if (order?.table_id) await supabase.from("dining_tables").update({ status: "available" }).eq("id", order.table_id);
    navigate({ to: "/tables" });
  }

  if (!order) return <div className="p-8">Loading…</div>;

  return (
    <div className="flex h-screen">
      <div className="flex-1 flex flex-col min-w-0 p-4 gap-3">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={() => navigate({ to: "/tables" })}><ArrowLeft className="w-4 h-4" /></Button>
          <div>
            <div className="font-semibold text-lg">Table {order.dining_tables?.name}</div>
            <div className="text-xs text-muted-foreground">Order #{order.order_number} · <span className="capitalize">{order.status}</span></div>
          </div>
          <div className="flex-1 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-11 max-w-sm" />
          </div>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          <Chip active={activeCat === "all"} onClick={() => setActiveCat("all")}>All</Chip>
          {categories.map((c) => <Chip key={c.id} active={activeCat === c.id} onClick={() => setActiveCat(c.id)}>{c.name}</Chip>)}
        </div>
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {filtered.map((p) => (
              <button key={p.id} onClick={() => addProduct(p)} disabled={!editable} className={cn("text-left bg-card border border-border rounded-xl p-4 hover:border-primary hover:shadow-md transition-all", !editable && "opacity-50 pointer-events-none")}>
                <div className="font-medium leading-tight line-clamp-2 min-h-[2.5em]">{p.name}</div>
                <div className="mt-2 text-primary font-semibold">{money(p.price, settings.currency)}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="w-full lg:w-[400px] bg-card border-l border-border flex flex-col">
        <div className="p-4 border-b border-border">
          <div className="text-sm text-muted-foreground">Order items</div>
          <div className="text-lg font-semibold">{items.length} items</div>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {items.map((i) => (
            <div key={i.id} className="rounded-lg border border-border p-3">
              <div className="flex justify-between">
                <div className="font-medium">{i.name}</div>
                {editable && <button onClick={() => changeQty(i, -Number(i.qty))} className="text-muted-foreground hover:text-destructive"><Trash2 className="w-4 h-4" /></button>}
              </div>
              <div className="mt-2 flex justify-between items-center">
                <div className="flex gap-1 items-center">
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => changeQty(i, -1)} disabled={!editable}><Minus className="w-3 h-3" /></Button>
                  <div className="w-10 text-center font-semibold">{i.qty}</div>
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => changeQty(i, +1)} disabled={!editable}><Plus className="w-3 h-3" /></Button>
                </div>
                <div className="font-semibold">{money(Number(i.qty) * Number(i.price), settings.currency)}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="p-4 border-t border-border space-y-2">
          {editable && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground w-24">Discount</span>
              <Input type="number" value={discount || ""} onChange={(e) => setDiscount(Number(e.target.value || 0))} className="h-9" />
            </div>
          )}
          <div className="flex justify-between text-sm"><span>Subtotal</span><span>{money(totals.subtotal, settings.currency)}</span></div>
          <div className="flex justify-between text-sm"><span>Tax</span><span>{money(totals.tax, settings.currency)}</span></div>
          <div className="flex justify-between text-lg font-bold"><span>Total</span><span>{money(totals.total, settings.currency)}</span></div>
          <div className="flex justify-between text-sm"><span className="text-muted-foreground">Paid</span><span className={fullyPaid ? "text-success font-semibold" : ""}>{money(paidSum, settings.currency)}</span></div>
          {!fullyPaid && <div className="flex justify-between text-sm"><span className="text-muted-foreground">Balance</span><span className="text-warning-foreground font-semibold">{money(remaining, settings.currency)}</span></div>}
          {editable ? (
            <>
              <div className="grid grid-cols-3 gap-2 pt-2">
                <Button variant="outline" className="h-11" onClick={openCharge} disabled={busy || items.length === 0}>
                  <CreditCard className="w-4 h-4 mr-1" /> Charge
                </Button>
                <Button variant="outline" className="h-11" onClick={doPrint} disabled={busy}>
                  <Printer className="w-4 h-4 mr-1" /> Print
                </Button>
                <Button className="h-11" onClick={doComplete} disabled={busy || !fullyPaid} title={!fullyPaid ? "Charge full amount first" : ""}>
                  <CheckCircle2 className="w-4 h-4 mr-1" /> Complete
                </Button>
              </div>
              <Button variant="ghost" className="w-full text-destructive" onClick={cancelOrder}>Void order</Button>
            </>
          ) : (
            <Button variant="outline" className="w-full" onClick={doPrint}><Printer className="w-4 h-4 mr-1" />Print receipt</Button>
          )}
        </div>
      </div>

      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Charge payment</DialogTitle></DialogHeader>
          <Card className="p-3">
            <div className="flex justify-between"><span>Balance</span><b>{money(remaining, settings.currency)}</b></div>
            <div className="flex justify-between text-sm mt-1"><span className="text-muted-foreground">This charge</span><span>{money(Object.values(payments).reduce((s, v) => s + Number(v || 0), 0), settings.currency)}</span></div>
          </Card>
          <div className="space-y-2">
            {methods.map((m) => (
              <div key={m.id} className="flex items-center gap-2">
                <div className="w-28 text-sm">{m.name}</div>
                <Input type="number" value={payments[m.id] ?? ""} onChange={(e) => setPayments({ ...payments, [m.id]: Number(e.target.value || 0) })} />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayOpen(false)}>Cancel</Button>
            <Button onClick={doCharge} disabled={busy}><CreditCard className="w-4 h-4 mr-2" />{busy ? "…" : "Save payment"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} className={cn("px-4 h-9 rounded-full text-sm font-medium whitespace-nowrap border", active ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border")}>{children}</button>;
}
