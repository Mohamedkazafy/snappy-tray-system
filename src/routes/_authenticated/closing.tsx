import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { PageContainer, PageHeader } from "@/components/page";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { money } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/closing")({
  head: () => ({ meta: [{ title: "Day Closing" }] }),
  component: Closing,
});

function Closing() {
  const { user } = useSession();
  const [day, setDay] = useState<string>("");
  const [totals, setTotals] = useState({ sales: 0, cash: 0, card: 0, other: 0, purchases: 0, orderCount: 0 });
  const [opening, setOpening] = useState(0);
  const [closing, setClosing] = useState(0);
  const [notes, setNotes] = useState("");
  const [existing, setExisting] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);

  async function loadDay(d: string) {
    setDay(d);
    const [ords, purch, dc] = await Promise.all([
      supabase.from("orders").select("total, cost_total, order_payments(amount, payment_methods(is_cash, name))").eq("business_day", d).eq("status", "paid"),
      supabase.from("purchases").select("total").eq("business_day", d),
      supabase.from("day_closings").select("*").eq("business_day", d).maybeSingle(),
    ]);
    let sales = 0, cash = 0, card = 0, other = 0;
    (ords.data ?? []).forEach((o: any) => {
      sales += Number(o.total);
      (o.order_payments ?? []).forEach((p: any) => {
        const amt = Number(p.amount);
        if (p.payment_methods?.is_cash) cash += amt;
        else if ((p.payment_methods?.name ?? "").toLowerCase().includes("card")) card += amt;
        else other += amt;
      });
    });
    const purchases = (purch.data ?? []).reduce((s: number, p: any) => s + Number(p.total), 0);
    setTotals({ sales, cash, card, other, purchases, orderCount: (ords.data ?? []).length });
    setExisting(dc.data);
    if (dc.data) {
      setOpening(Number(dc.data.opening_cash));
      setClosing(Number(dc.data.closing_cash));
      setNotes(dc.data.notes ?? "");
    } else {
      setOpening(0); setClosing(0); setNotes("");
    }
  }

  useEffect(() => {
    (async () => {
      const { data } = await supabase.rpc("business_day_for", { ts: new Date().toISOString() });
      const today = data as unknown as string;
      await loadDay(today);
      const { data: hist } = await supabase.from("day_closings").select("*").order("business_day", { ascending: false }).limit(20);
      setHistory(hist ?? []);
    })();
  }, []);

  const expected = opening + totals.cash - totals.purchases;
  const difference = closing - expected;

  async function close() {
    if (!user) return;
    const payload = {
      business_day: day,
      opening_cash: opening,
      closing_cash: closing,
      total_sales: totals.sales,
      total_cash: totals.cash,
      total_card: totals.card,
      total_other: totals.other,
      total_purchases: totals.purchases,
      difference,
      notes,
      closed_by: user.id,
    };
    const { error } = existing
      ? await supabase.from("day_closings").update(payload).eq("id", existing.id)
      : await supabase.from("day_closings").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Day closed");
    loadDay(day);
  }

  return (
    <PageContainer>
      <PageHeader title="Day Closing" subtitle="Reconcile cash and finalize the business day" />
      <div className="grid md:grid-cols-3 gap-4 mb-6">
        <Card className="p-4 md:col-span-2">
          <div className="flex items-center gap-3 mb-4">
            <Label>Business day</Label>
            <Input type="date" value={day} onChange={(e) => loadDay(e.target.value)} className="max-w-xs" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Line label="Orders" value={totals.orderCount} />
            <Line label="Total sales" value={money(totals.sales)} />
            <Line label="Cash payments" value={money(totals.cash)} />
            <Line label="Card payments" value={money(totals.card)} />
            <Line label="Other payments" value={money(totals.other)} />
            <Line label="Purchases" value={money(totals.purchases)} />
          </div>
          <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t">
            <div><Label>Opening cash</Label><Input type="number" value={opening} onChange={(e) => setOpening(Number(e.target.value))} /></div>
            <div><Label>Closing cash (counted)</Label><Input type="number" value={closing} onChange={(e) => setClosing(Number(e.target.value))} /></div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Line label="Expected cash" value={money(expected)} />
            <Line label="Difference" value={money(difference)} accent={difference === 0 ? "success" : difference < 0 ? "destructive" : "warning"} />
          </div>
          <div className="mt-3"><Label>Notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} /></div>
          <div className="mt-4 text-right"><Button onClick={close}>{existing ? "Update closing" : "Close day"}</Button></div>
        </Card>

        <Card className="p-4">
          <h3 className="font-semibold mb-3">Recent closings</h3>
          <div className="space-y-2 text-sm">
            {history.map((h) => (
              <button key={h.id} className="block w-full text-left py-2 border-b border-border last:border-0 hover:bg-muted/50 rounded px-2" onClick={() => loadDay(h.business_day)}>
                <div className="flex justify-between"><span className="font-medium">{h.business_day}</span><span>{money(h.total_sales)}</span></div>
                <div className="text-xs text-muted-foreground">Diff: {money(h.difference)}</div>
              </button>
            ))}
            {history.length === 0 && <p className="text-muted-foreground">No closings yet.</p>}
          </div>
        </Card>
      </div>
    </PageContainer>
  );
}

function Line({ label, value, accent }: { label: string; value: any; accent?: "success" | "destructive" | "warning" }) {
  const c = accent === "success" ? "text-success" : accent === "destructive" ? "text-destructive" : accent === "warning" ? "text-warning-foreground" : "";
  return <div className="flex justify-between py-1"><span className="text-muted-foreground text-sm">{label}</span><span className={"font-semibold " + c}>{value}</span></div>;
}
