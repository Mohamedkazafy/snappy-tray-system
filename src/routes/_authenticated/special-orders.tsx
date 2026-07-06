import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { money } from "@/lib/format";
import { PageContainer, PageHeader } from "@/components/page";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Bot, CheckCircle2, CreditCard, Printer, Phone, User, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/_authenticated/special-orders")({
  head: () => ({ meta: [{ title: "Special Orders" }] }),
  component: Page,
});

type Order = {
  id: string;
  order_number: number;
  customer_name: string | null;
  customer_phone: string | null;
  notes: string | null;
  subtotal: number;
  tax: number;
  total: number;
  status: string;
  created_at: string;
};
type Item = { id: string; order_id: string; name: string; qty: number; price: number; notes: string | null };
type Method = { id: string; name: string; is_cash: boolean };
type Settings = { currency: string };

function Page() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [items, setItems] = useState<Record<string, Item[]>>({});
  const [methods, setMethods] = useState<Method[]>([]);
  const [settings, setSettings] = useState<Settings>({ currency: "USD" });
  const [payFor, setPayFor] = useState<Order | null>(null);
  const [pays, setPays] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);

  async function load() {
    const [{ data: o }, { data: m }, { data: s }] = await Promise.all([
      supabase
        .from("orders")
        .select("id, order_number, customer_name, customer_phone, notes, subtotal, tax, total, status, created_at")
        .eq("sale_type", "special")
        .eq("status", "open")
        .order("created_at", { ascending: false }),
      supabase.from("payment_methods").select("id,name,is_cash").eq("active", true).order("sort_order"),
      supabase.from("settings").select("currency").eq("id", 1).maybeSingle(),
    ]);
    setOrders((o ?? []) as any);
    setMethods((m ?? []) as any);
    if (s) setSettings(s as any);
    if (o && o.length) {
      const { data: it } = await supabase
        .from("order_items")
        .select("id, order_id, name, qty, price, notes")
        .in("order_id", o.map((x) => x.id));
      const grouped: Record<string, Item[]> = {};
      (it ?? []).forEach((i: any) => {
        (grouped[i.order_id] ||= []).push(i);
      });
      setItems(grouped);
    } else {
      setItems({});
    }
  }

  useEffect(() => {
    load();
    const ch = supabase
      .channel("special-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: "sale_type=eq.special" }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  const totalPaid = useMemo(() => Object.values(pays).reduce((s, n) => s + (Number(n) || 0), 0), [pays]);

  function openPay(o: Order) {
    setPayFor(o);
    const cash = methods.find((m) => m.is_cash);
    setPays(cash ? { [cash.id]: o.total } : {});
  }

  async function chargeAndComplete() {
    if (!payFor) return;
    if (totalPaid + 0.001 < payFor.total) return toast.error("Paid amount is less than total");
    setBusy(true);
    try {
      const list = Object.entries(pays)
        .filter(([, v]) => Number(v) > 0)
        .map(([payment_method_id, amount]) => ({ payment_method_id, amount: Number(amount) }));
      const { error: e1 } = await supabase.rpc("record_order_payments", { _order_id: payFor.id, _payments: list as any });
      if (e1) throw e1;
      const { error: e2 } = await supabase.rpc("complete_order", { _order_id: payFor.id });
      if (e2) throw e2;
      toast.success(`Order #${payFor.order_number} completed`);
      setPayFor(null);
      setPays({});
      load();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to complete order");
    } finally {
      setBusy(false);
    }
  }

  async function voidOrder(o: Order) {
    if (!confirm(`Void order #${o.order_number}?`)) return;
    const { error } = await supabase.from("orders").update({ status: "void" }).eq("id", o.id);
    if (error) return toast.error(error.message);
    toast.success("Order voided");
    load();
  }

  return (
    <PageContainer>
      <PageHeader
        title="Special Orders"
        subtitle="Orders received from the AI chatbot. Review, charge, and complete like a normal POS ticket."
        actions={
          <Button variant="outline" size="sm" onClick={load}>
            <RefreshCw className="w-4 h-4 mr-2" /> Refresh
          </Button>
        }
      />

      {orders.length === 0 && (
        <Card className="p-10 text-center text-muted-foreground">
          <Bot className="w-10 h-10 mx-auto mb-3 opacity-50" />
          No open special orders yet. New chatbot orders will appear here in real time.
        </Card>
      )}

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {orders.map((o) => (
          <Card key={o.id} className="p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold flex items-center gap-2">
                  <Bot className="w-4 h-4 text-primary" /> #{o.order_number}
                </div>
                <div className="text-xs text-muted-foreground">
                  {new Date(o.created_at).toLocaleString()}
                </div>
              </div>
              <Badge variant="secondary">Special</Badge>
            </div>

            <div className="text-sm space-y-1">
              {o.customer_name && (
                <div className="flex items-center gap-2"><User className="w-3.5 h-3.5" /> {o.customer_name}</div>
              )}
              {o.customer_phone && (
                <div className="flex items-center gap-2"><Phone className="w-3.5 h-3.5" /> {o.customer_phone}</div>
              )}
              {o.notes && <div className="text-muted-foreground italic">"{o.notes}"</div>}
            </div>

            <div className="border-t pt-2 space-y-1 text-sm">
              {(items[o.id] ?? []).map((it) => (
                <div key={it.id} className="flex justify-between">
                  <span>{it.qty} × {it.name}</span>
                  <span className="tabular-nums">{money(it.price * it.qty, settings.currency)}</span>
                </div>
              ))}
            </div>

            <div className="border-t pt-2 flex justify-between font-semibold">
              <span>Total</span>
              <span className="tabular-nums">{money(o.total, settings.currency)}</span>
            </div>

            <div className="flex gap-2 pt-1">
              <Button size="sm" className="flex-1" onClick={() => openPay(o)}>
                <CreditCard className="w-4 h-4 mr-2" /> Charge
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link to="/receipt/$orderId" params={{ orderId: o.id }} target="_blank">
                  <Printer className="w-4 h-4" />
                </Link>
              </Button>
              <Button size="sm" variant="ghost" onClick={() => voidOrder(o)}>Void</Button>
            </div>
          </Card>
        ))}
      </div>

      <Dialog open={!!payFor} onOpenChange={(v) => !v && setPayFor(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Charge order #{payFor?.order_number}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span>Total</span>
              <span className="font-semibold tabular-nums">{payFor && money(payFor.total, settings.currency)}</span>
            </div>
            {methods.map((m) => (
              <div key={m.id} className="flex items-center gap-3">
                <div className="w-28 text-sm">{m.name}</div>
                <Input
                  type="number"
                  step="0.01"
                  value={pays[m.id] ?? ""}
                  onChange={(e) => setPays({ ...pays, [m.id]: Number(e.target.value) })}
                />
              </div>
            ))}
            <div className="flex justify-between text-sm border-t pt-2">
              <span>Paid</span>
              <span className="tabular-nums">{payFor && money(totalPaid, settings.currency)}</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPayFor(null)}>Cancel</Button>
            <Button onClick={chargeAndComplete} disabled={busy}>
              <CheckCircle2 className="w-4 h-4 mr-2" /> Charge & Complete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
