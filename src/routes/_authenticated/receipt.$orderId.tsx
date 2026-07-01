import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { money } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/receipt/$orderId")({
  head: () => ({ meta: [{ title: "Receipt" }] }),
  component: Receipt,
});

function Receipt() {
  const { orderId } = Route.useParams();
  const [order, setOrder] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [settings, setSettings] = useState<{ currency: string; restaurant_name: string }>({ currency: "USD", restaurant_name: "" });

  useEffect(() => {
    (async () => {
      const [o, i, p, s] = await Promise.all([
        supabase.from("orders").select("*").eq("id", orderId).single(),
        supabase.from("order_items").select("*").eq("order_id", orderId),
        supabase.from("order_payments").select("amount, payment_methods(name)").eq("order_id", orderId),
        supabase.from("settings").select("currency,restaurant_name").single(),
      ]);
      setOrder(o.data);
      setItems(i.data ?? []);
      setPayments(p.data ?? []);
      if (s.data) setSettings(s.data as any);
      setTimeout(() => window.print(), 400);
    })();
  }, [orderId]);

  if (!order) return <div className="p-8">Loading…</div>;
  const c = settings.currency;

  return (
    <div className="min-h-screen bg-muted p-6 flex justify-center">
      <div className="printable bg-card border border-border p-6 w-[320px] font-mono text-sm">
        <div className="text-center mb-3">
          <div className="font-bold text-base">{settings.restaurant_name || "Restaurant"}</div>
          <div className="text-xs">Order #{order.order_number}</div>
          <div className="text-xs">{new Date(order.created_at).toLocaleString()}</div>
          <div className="text-xs uppercase mt-1">{order.sale_type.replace("dinein", "dine in")}</div>
          {order.customer_name && <div className="text-xs">Customer: {order.customer_name}</div>}
        </div>
        <div className="border-t border-b border-dashed border-border py-2 my-2">
          {items.map((i) => (
            <div key={i.id} className="mb-1">
              <div className="flex justify-between">
                <span>{i.qty} × {i.name}</span>
                <span>{money(i.qty * i.price, c)}</span>
              </div>
              {i.notes && <div className="text-xs italic pl-2">— {i.notes}</div>}
            </div>
          ))}
        </div>
        <div className="space-y-1">
          <Row label="Subtotal" value={money(order.subtotal, c)} />
          {order.discount > 0 && <Row label="Discount" value={`-${money(order.discount, c)}`} />}
          <Row label="Tax" value={money(order.tax, c)} />
          <div className="border-t border-dashed border-border pt-1">
            <Row label={<b>Total</b>} value={<b>{money(order.total, c)}</b>} />
          </div>
        </div>
        <div className="mt-3 space-y-0.5">
          {payments.map((p, i) => (
            <Row key={i} label={p.payment_methods?.name ?? "Payment"} value={money(p.amount, c)} />
          ))}
        </div>
        <div className="text-center mt-4 text-xs">Thank you!</div>
        <div className="mt-4 no-print flex gap-2">
          <Button className="flex-1" onClick={() => window.print()}>Print</Button>
          <Button variant="outline" className="flex-1" onClick={() => window.close()}>Close</Button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: React.ReactNode; value: React.ReactNode }) {
  return <div className="flex justify-between"><span>{label}</span><span>{value}</span></div>;
}
