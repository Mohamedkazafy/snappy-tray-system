import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer, PageHeader } from "@/components/page";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings" }] }),
  component: Page,
});

function Page() {
  const [s, setS] = useState<any>(null);

  useEffect(() => {
    supabase.from("settings").select("*").eq("id", 1).single().then(({ data }) => setS(data));
  }, []);

  async function save() {
    const { error } = await supabase.from("settings").update({
      restaurant_name: s.restaurant_name,
      currency: s.currency,
      default_tax_rate: s.default_tax_rate,
      business_day_start: s.business_day_start,
      business_day_end: s.business_day_end,
    }).eq("id", 1);
    if (error) return toast.error(error.message);
    toast.success("Settings saved");
  }

  if (!s) return <PageContainer><p>Loading…</p></PageContainer>;

  return (
    <PageContainer>
      <PageHeader title="Settings" subtitle="Restaurant info, currency, tax, and business day" />
      <Card className="p-6 max-w-2xl space-y-4">
        <div><Label>Restaurant name</Label><Input value={s.restaurant_name} onChange={(e) => setS({ ...s, restaurant_name: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Currency</Label>
            <Select value={s.currency} onValueChange={(v) => setS({ ...s, currency: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["USD","EUR","GBP","AED","SAR","EGP","JPY","INR","CAD","AUD"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Default tax rate %</Label><Input type="number" step="0.01" value={s.default_tax_rate} onChange={(e) => setS({ ...s, default_tax_rate: Number(e.target.value) })} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Business day start</Label><Input type="time" value={s.business_day_start} onChange={(e) => setS({ ...s, business_day_start: e.target.value })} /></div>
          <div><Label>Business day end</Label><Input type="time" value={s.business_day_end} onChange={(e) => setS({ ...s, business_day_end: e.target.value })} /></div>
        </div>
        <p className="text-xs text-muted-foreground">If end time is earlier than start time, the business day extends past midnight (common for restaurants).</p>
        <div className="text-right"><Button onClick={save}>Save</Button></div>
      </Card>
    </PageContainer>
  );
}
