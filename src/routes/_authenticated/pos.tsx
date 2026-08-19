import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { money } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Search, Plus, Minus, Trash2, Printer, StickyNote, CreditCard, CheckCircle2, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/pos")({
  head: () => ({ meta: [{ title: "POS — Restaurant POS" }] }),
  component: POS,
});

type Product = { id: string; name: string; price: number; category_id: string | null; taxable: boolean; tax_rate: number | null; active: boolean };
type Category = { id: string; name: string };
type PaymentMethod = { id: string; name: string; is_cash: boolean };
type Settings = { currency: string; default_tax_rate: number };
type Table = { id: string; name: string; status: string; area_id: string };
type Area = { id: string; name: string };

type CartItem = { product_id: string; name: string; price: number; qty: number; tax_rate: number; notes?: string };

const saleTypes = [
  { key: "takeaway", label: "Take Away" },
  { key: "dinein", label: "Dine In" },
  { key: "delivery", label: "Delivery" },
] as const;

function POS() {
  const { user } = useSession();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [settings, setSettings] = useState<Settings>({ currency: "USD", default_tax_rate: 0 });
  const [tables, setTables] = useState<Table[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);

  const [activeCat, setActiveCat] = useState<string | "all">("all");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [saleType, setSaleType] = useState<"takeaway" | "dinein" | "delivery">("takeaway");
  const [tableId, setTableId] = useState<string>("");
  const [discount, setDiscount] = useState(0);
  const [customer, setCustomer] = useState("");
  const [noteFor, setNoteFor] = useState<number | null>(null);

  // Checkout stage
  const [stage, setStage] = useState<"building" | "checkout">("building");
  const [orderId, setOrderId] = useState<string | null>(null);
  const [orderNumber, setOrderNumber] = useState<number | null>(null);
  const [paidSum, setPaidSum] = useState(0);
  const [busy, setBusy] = useState(false);

  const [payOpen, setPayOpen] = useState(false);
  const [payments, setPayments] = useState<Record<string, number>>({});

  useEffect(() => {
    (async () => {
      const [p, c, m, s, t, a] = await Promise.all([
        supabase.from("products").select("id,name,price,category_id,taxable,tax_rate,active").eq("active", true).order("name"),
        supabase.from("categories").select("id,name").eq("active", true).order("sort_order"),
        supabase.from("payment_methods").select("id,name,is_cash").eq("active", true).order("sort_order"),
        supabase.from("settings").select("currency,default_tax_rate").single(),
        supabase.from("dining_tables").select("id,name,status,area_id").order("name"),
        supabase.from("dining_areas").select("id,name").order("sort_order"),
      ]);
      setProducts((p.data ?? []) as any);
      setCategories((c.data ?? []) as any);
      setMethods((m.data ?? []) as any);
      if (s.data) setSettings(s.data as any);
      setTables((t.data ?? []) as any);
      setAreas((a.data ?? []) as any);
    })();

    const chan = supabase
      .channel("pos-tables")
      .on("postgres_changes", { event: "*", schema: "public", table: "dining_tables" }, async () => {
        const { data } = await supabase.from("dining_tables").select("id,name,status,area_id").order("name");
        setTables((data ?? []) as any);
      })
      .subscribe();
    return () => { supabase.removeChannel(chan); };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) =>
      (activeCat === "all" || p.category_id === activeCat) &&
      (!q || p.name.toLowerCase().includes(q))
    );
  }, [products, activeCat, search]);

  const totals = useMemo(() => {
    const subtotal = cart.reduce((s, i) => s + i.qty * i.price, 0);
    const disc = Math.min(discount, subtotal);
    const taxable = cart.reduce((s, i) => s + i.qty * i.price * (i.tax_rate / 100), 0);
    const proportional = subtotal > 0 ? taxable * (1 - disc / subtotal) : 0;
    const tax = Math.max(0, proportional);
    const total = subtotal - disc + tax;
    return { subtotal, discount: disc, tax, total };
  }, [cart, discount]);

  const editable = stage === "building";

  function addProduct(p: Product) {
    if (!editable) { toast.error("Order sent to checkout. Go back to edit."); return; }
    const rate = p.taxable ? (p.tax_rate ?? settings.default_tax_rate ?? 0) : 0;
    setCart((c) => {
      const i = c.findIndex((x) => x.product_id === p.id);
      if (i >= 0) {
        const copy = [...c];
        copy[i] = { ...copy[i], qty: copy[i].qty + 1 };
        return copy;
      }
      return [...c, { product_id: p.id, name: p.name, price: Number(p.price), qty: 1, tax_rate: Number(rate) }];
    });
  }

  function changeQty(idx: number, delta: number) {
    setCart((c) => {
      const copy = [...c];
      const q = copy[idx].qty + delta;
      if (q <= 0) copy.splice(idx, 1);
      else copy[idx] = { ...copy[idx], qty: q };
      return copy;
    });
  }

  function removeItem(idx: number) {
    setCart((c) => c.filter((_, i) => i !== idx));
  }

  function resetAll() {
    setCart([]); setDiscount(0); setCustomer(""); setPayments({});
    setStage("building"); setOrderId(null); setOrderNumber(null); setPaidSum(0);
    setTableId("");
  }

  async function refreshPaid(id: string) {
    const { data } = await supabase.from("order_payments").select("amount").eq("order_id", id);
    const sum = (data ?? []).reduce((s, r: any) => s + Number(r.amount), 0);
    setPaidSum(sum);
    return sum;
  }

  async function sendToCheckout() {
    if (!user) return;
    if (cart.length === 0) return toast.error("Cart is empty");
    if (saleType === "dinein" && !tableId) return toast.error("Select a table for dine-in");

    setBusy(true);
    try {
      // Create order via server endpoint which enforces subscription checks
      const tokenResp = await supabase.auth.getUser();
      const token = (await supabase.auth.getSession())?.data?.session?.access_token ?? null;
      const payload = {
        items: cart.map((i) => ({ product_id: i.product_id, name: i.name, qty: i.qty, price: i.price, tax_rate: i.tax_rate, notes: i.notes ?? null })),
        sale_type: saleType,
        table_id: saleType === "dinein" ? tableId : null,
        customer_name: customer || null,
        discount: totals.discount,
      };

      const resp = await fetch('/api/private/create-order', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      const data = await resp.json();
      if (!resp.ok) throw new Error((data && (data.message || data.error)) || 'Could not create order');

      // Mark table occupied if dine-in
      if (saleType === 'dinein' && tableId) {
        await supabase.from('dining_tables').update({ status: 'occupied' }).eq('id', tableId);
      }

      setOrderId(data.order_id);
      setOrderNumber(data.order_number);
      setStage('checkout');
      const first = methods[0];
      if (first) setPayments({ [first.id]: Number(totals.total.toFixed(2)) });
      setPaidSum(0);
    } catch (err: any) {
      toast.error(err.message ?? 'Could not create order');
    } finally {
      setBusy(false);
    }
  }

  async function backToEdit() {
    if (!orderId) return;
    if (!confirm("Discard checkout and edit order?")) return;
    // Delete open order (payments cascade). Free table if any.
    const tid = saleType === "dinein" ? tableId : null;
    await supabase.from("orders").delete().eq("id", orderId).eq("status", "open");
    if (tid) await supabase.from("dining_tables").update({ status: "available" }).eq("id", tid);
    setOrderId(null); setOrderNumber(null); setStage("building"); setPaidSum(0);
  }

  async function doCharge() {
    if (!orderId) return;
    const paySum = Object.values(payments).reduce((s, v) => s + Number(v || 0), 0);
    if (paySum <= 0) return toast.error("Enter a payment amount");
    setBusy(true);
    try {
      const pays = Object.entries(payments)
        .filter(([, v]) => Number(v) > 0)
        .map(([payment_method_id, amount]) => ({ payment_method_id, amount: Number(amount) }));
      const { error } = await supabase.rpc("record_order_payments", { _order_id: orderId, _payments: pays });
      if (error) throw error;
      await refreshPaid(orderId);
      setPayOpen(false);
      toast.success("Payment recorded");
    } catch (err: any) {
      toast.error(err.message ?? "Could not record payment");
    } finally { setBusy(false); }
  }

  function doPrint() {
    if (!orderId) return;
    window.open(`/receipt/${orderId}`, "_blank");
  }

  async function doComplete() {
    if (!orderId) return;
    setBusy(true);
    try {
      const { error } = await supabase.rpc("complete_order", { _order_id: orderId });
      if (error) throw error;
      toast.success(`Order #${orderNumber} completed`);
      resetAll();
    } catch (err: any) {
      toast.error(err.message ?? "Could not complete");
    } finally { setBusy(false); }
  }

  const remaining = Math.max(0, totals.total - paidSum);
  const fullyPaid = paidSum + 0.001 >= totals.total && totals.total > 0;

  const areaMap = new Map(areas.map((a) => [a.id, a.name] as const));
  const openTablesForSelect = tables.filter((t) => t.status === "available");

  return (
    <div className="flex h-[calc(100vh-0px)] lg:h-screen">
      {/* Left: products */}
      <div className="flex-1 flex flex-col min-w-0 p-4 gap-3">
        <div className="flex flex-wrap gap-2 items-center">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search products…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-11" />
          </div>
          <div className="flex gap-1 bg-muted rounded-lg p-1">
            {saleTypes.map((t) => (
              <button
                key={t.key}
                onClick={() => editable && setSaleType(t.key)}
                disabled={!editable}
                className={cn(
                  "px-4 h-9 rounded-md text-sm font-medium transition-colors",
                  saleType === t.key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                  !editable && "opacity-60 cursor-not-allowed",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          <CatChip active={activeCat === "all"} onClick={() => setActiveCat("all")}>All</CatChip>
          {categories.map((c) => (
            <CatChip key={c.id} active={activeCat === c.id} onClick={() => setActiveCat(c.id)}>{c.name}</CatChip>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {filtered.map((p) => (
              <button
                key={p.id}
                onClick={() => addProduct(p)}
                className={cn(
                  "group text-left bg-card border border-border rounded-xl p-4 hover:border-primary hover:shadow-md transition-all active:scale-[.98]",
                  !editable && "opacity-50 pointer-events-none",
                )}
              >
                <div className="font-medium leading-tight line-clamp-2 min-h-[2.5em]">{p.name}</div>
                <div className="mt-2 text-primary font-semibold">{money(p.price, settings.currency)}</div>
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="col-span-full text-center text-muted-foreground py-16">No products.</div>
            )}
          </div>
        </div>
      </div>

      {/* Right: cart */}
      <div className="w-full lg:w-[400px] flex-shrink-0 bg-card border-l border-border flex flex-col">
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-muted-foreground">
                {stage === "building" ? "Current Order" : `Order #${orderNumber}`}
              </div>
              <div className="text-lg font-semibold capitalize">{saleTypes.find((s) => s.key === saleType)?.label}
                {saleType === "dinein" && tableId ? ` · Table ${tables.find(t => t.id === tableId)?.name}` : ""}
              </div>
            </div>
            {stage === "checkout" && (
              <Button variant="ghost" size="sm" onClick={backToEdit}><ArrowLeft className="w-4 h-4 mr-1" />Edit</Button>
            )}
          </div>
          {saleType === "dinein" && editable && (
            <div className="mt-2">
              <Select value={tableId} onValueChange={setTableId}>
                <SelectTrigger className="h-10"><SelectValue placeholder="Select table…" /></SelectTrigger>
                <SelectContent>
                  {openTablesForSelect.length === 0 && <div className="text-sm text-muted-foreground p-2">No available tables</div>}
                  {openTablesForSelect.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{areaMap.get(t.area_id) ?? "—"} · {t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {cart.length === 0 && (
            <div className="text-center text-muted-foreground py-12 text-sm">Tap products to add</div>
          )}
          {cart.map((i, idx) => (
            <div key={idx} className="rounded-lg border border-border p-3">
              <div className="flex justify-between items-start gap-2">
                <div className="font-medium leading-tight">{i.name}</div>
                {editable && (
                  <button onClick={() => removeItem(idx)} className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
              <div className="mt-2 flex justify-between items-center">
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => changeQty(idx, -1)} disabled={!editable}><Minus className="w-3 h-3" /></Button>
                  <div className="w-10 text-center font-semibold">{i.qty}</div>
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => changeQty(idx, +1)} disabled={!editable}><Plus className="w-3 h-3" /></Button>
                </div>
                <div className="text-right">
                  <div className="font-semibold">{money(i.qty * i.price, settings.currency)}</div>
                  {editable && (
                    <button onClick={() => setNoteFor(idx)} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                      <StickyNote className="w-3 h-3" /> {i.notes ? "Edit note" : "Add note"}
                    </button>
                  )}
                </div>
              </div>
              {i.notes && <div className="mt-1 text-xs text-muted-foreground italic">{i.notes}</div>}
            </div>
          ))}
        </div>
        <div className="p-4 border-t border-border space-y-2">
          {editable && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground w-24">Discount</span>
              <Input type="number" min={0} value={discount || ""} onChange={(e) => setDiscount(Number(e.target.value || 0))} className="h-9" />
            </div>
          )}
          <div className="flex justify-between text-sm"><span className="text-muted-foreground">Subtotal</span><span>{money(totals.subtotal, settings.currency)}</span></div>
          {totals.discount > 0 && <div className="flex justify-between text-sm"><span className="text-muted-foreground">Discount</span><span>-{money(totals.discount, settings.currency)}</span></div>}
          <div className="flex justify-between text-sm"><span className="text-muted-foreground">Tax</span><span>{money(totals.tax, settings.currency)}</span></div>
          <div className="flex justify-between text-lg font-bold pt-1"><span>Total</span><span>{money(totals.total, settings.currency)}</span></div>

          {stage === "checkout" && (
            <div className="pt-1 space-y-1">
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Paid</span><span className={fullyPaid ? "text-success font-semibold" : ""}>{money(paidSum, settings.currency)}</span></div>
              {!fullyPaid && <div className="flex justify-between text-sm"><span className="text-muted-foreground">Balance</span><span className="text-warning-foreground font-semibold">{money(remaining, settings.currency)}</span></div>}
            </div>
          )}

          {stage === "building" ? (
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1 h-11" onClick={resetAll} disabled={cart.length === 0}>Clear</Button>
              <Button className="flex-1 h-11" onClick={sendToCheckout} disabled={cart.length === 0 || busy}>
                Checkout →
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2 pt-2">
              <Button variant="outline" className="h-11" onClick={() => setPayOpen(true)} disabled={busy}>
                <CreditCard className="w-4 h-4 mr-1" /> Charge
              </Button>
              <Button variant="outline" className="h-11" onClick={doPrint} disabled={busy}>
                <Printer className="w-4 h-4 mr-1" /> Print
              </Button>
              <Button className="h-11" onClick={doComplete} disabled={busy || !fullyPaid} title={!fullyPaid ? "Charge full amount first" : ""}>
                <CheckCircle2 className="w-4 h-4 mr-1" /> Complete
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Note dialog */}
      <Dialog open={noteFor !== null} onOpenChange={(v) => !v && setNoteFor(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Item note</DialogTitle></DialogHeader>
          <Textarea
            value={noteFor !== null ? cart[noteFor]?.notes ?? "" : ""}
            onChange={(e) => {
              if (noteFor === null) return;
              const v = e.target.value;
              setCart((c) => { const copy = [...c]; copy[noteFor] = { ...copy[noteFor], notes: v }; return copy; });
            }}
            placeholder="No onions, extra spicy…"
            rows={4}
          />
          <DialogFooter><Button onClick={() => setNoteFor(null)}>Done</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment dialog */}
      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Charge payment</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Card className="p-3">
              <div className="flex justify-between"><span>Total due</span><span className="font-bold">{money(totals.total, settings.currency)}</span></div>
              <div className="flex justify-between text-sm mt-1"><span className="text-muted-foreground">Already paid</span><span>{money(paidSum, settings.currency)}</span></div>
              <div className="flex justify-between text-sm mt-1"><span className="text-muted-foreground">This charge</span><span>{money(Object.values(payments).reduce((s, v) => s + Number(v || 0), 0), settings.currency)}</span></div>
            </Card>
            <Input placeholder="Customer name (optional)" value={customer} onChange={(e) => setCustomer(e.target.value)} />
            <div className="space-y-2">
              {methods.map((m) => (
                <div key={m.id} className="flex items-center gap-2">
                  <div className="w-28 text-sm">{m.name}</div>
                  <Input
                    type="number"
                    min={0}
                    value={payments[m.id] ?? ""}
                    onChange={(e) => setPayments({ ...payments, [m.id]: Number(e.target.value || 0) })}
                    placeholder="0.00"
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button size="sm" variant="outline" onClick={() => {
                const first = methods[0]; if (first) setPayments({ [first.id]: Number(totals.total.toFixed(2)) });
              }}>Exact total</Button>
              <Button size="sm" variant="outline" onClick={() => {
                const first = methods[0]; if (first) setPayments({ [first.id]: Number(remaining.toFixed(2)) });
              }}>Remaining</Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayOpen(false)}>Cancel</Button>
            <Button onClick={doCharge} disabled={busy}>
              <CreditCard className="w-4 h-4 mr-2" /> {busy ? "Saving…" : "Save payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CatChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-4 h-9 rounded-full text-sm font-medium whitespace-nowrap border transition-colors",
        active ? "bg-primary text-primary-foreground border-primary" : "bg-card text-foreground border-border hover:border-primary/50"
      )}
    >
      {children}
    </button>
  );
}
