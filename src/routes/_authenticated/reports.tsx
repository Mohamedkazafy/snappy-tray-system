import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer, PageHeader } from "@/components/page";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { money } from "@/lib/format";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({ meta: [{ title: "Reports" }] }),
  component: Reports,
});


function Reports() {
  const [from, setFrom] = useState<string>(new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10));
  const [to, setTo] = useState<string>(new Date().toISOString().slice(0, 10));
  const [orders, setOrders] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const [o, i, p] = await Promise.all([
        supabase.from("orders").select("id, business_day, sale_type, total, cost_total, created_by, profiles:created_by(full_name)").gte("business_day", from).lte("business_day", to).eq("status", "paid"),
        supabase.from("order_items").select("qty, price, name, product_id, cost, products(name, category_id, categories(name)), orders!inner(business_day, status)").gte("orders.business_day", from).lte("orders.business_day", to).eq("orders.status", "paid"),
        supabase.from("order_payments").select("amount, payment_methods(name), orders!inner(business_day, status)").gte("orders.business_day", from).lte("orders.business_day", to).eq("orders.status", "paid"),
      ]);
      setOrders(o.data ?? []);
      setItems(i.data ?? []);
      setPayments(p.data ?? []);
    })();
  }, [from, to]);

  const byDate = group(orders, (o) => o.business_day, (o) => Number(o.total));
  const bySaleType = group(orders, (o) => o.sale_type, (o) => Number(o.total));
  const byProduct = group(items, (i) => i.name, (i) => Number(i.qty) * Number(i.price));
  const byCategory = group(items, (i: any) => i.products?.categories?.name ?? "—", (i) => Number(i.qty) * Number(i.price));
  const byEmployee = group(orders, (o: any) => o.profiles?.full_name ?? "—", (o) => Number(o.total));
  const byMethod = group(payments, (p: any) => p.payment_methods?.name ?? "—", (p) => Number(p.amount));
  const revenue = orders.reduce((s, o) => s + Number(o.total), 0);
  const cost = orders.reduce((s, o) => s + Number(o.cost_total ?? 0), 0);

  return (
    <PageContainer>
      <PageHeader title="Reports" subtitle="Slice sales by any dimension" />
      <Card className="p-4 mb-4 flex gap-3 items-end flex-wrap">
        <div><Label>From</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div><Label>To</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        <div className="ml-auto text-right">
          <div className="text-xs text-muted-foreground">Revenue / Cost / Profit</div>
          <div className="text-lg font-bold">{money(revenue)} / {money(cost)} / <span className="text-success">{money(revenue - cost)}</span></div>
        </div>
      </Card>
      <Tabs defaultValue="date">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="date">By date</TabsTrigger>
          <TabsTrigger value="product">By product</TabsTrigger>
          <TabsTrigger value="category">By category</TabsTrigger>
          <TabsTrigger value="employee">By employee</TabsTrigger>
          <TabsTrigger value="method">By payment</TabsTrigger>
          <TabsTrigger value="type">By sale type</TabsTrigger>
        </TabsList>
        <TabsContent value="date"><SimpleTable title="Date" rows={byDate} /></TabsContent>
        <TabsContent value="product"><SimpleTable title="Product" rows={byProduct} /></TabsContent>
        <TabsContent value="category"><SimpleTable title="Category" rows={byCategory} /></TabsContent>
        <TabsContent value="employee"><SimpleTable title="Employee" rows={byEmployee} /></TabsContent>
        <TabsContent value="method"><SimpleTable title="Method" rows={byMethod} /></TabsContent>
        <TabsContent value="type"><SimpleTable title="Sale type" rows={bySaleType} /></TabsContent>
      </Tabs>
    </PageContainer>
  );
}

function group<T>(arr: T[], keyFn: (x: T) => string, valFn: (x: T) => number) {
  const m: Record<string, number> = {};
  arr.forEach((x) => { const k = keyFn(x) ?? "—"; m[k] = (m[k] ?? 0) + valFn(x); });
  return Object.entries(m).sort((a, b) => b[1] - a[1]).map(([label, total]) => ({ label, total }));
}
function SimpleTable({ title, rows }: { title: string; rows: { label: string; total: number }[] }) {
  const sum = rows.reduce((s, r) => s + r.total, 0);
  return (
    <Card>
      <Table>
        <TableHeader><TableRow><TableHead>{title}</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.label}><TableCell className="capitalize">{r.label}</TableCell><TableCell className="text-right font-medium">{money(r.total)}</TableCell></TableRow>
          ))}
          {rows.length === 0 && <TableRow><TableCell colSpan={2} className="text-center py-8 text-muted-foreground">No data.</TableCell></TableRow>}
          {rows.length > 0 && <TableRow><TableCell className="font-bold">Total</TableCell><TableCell className="text-right font-bold">{money(sum)}</TableCell></TableRow>}
        </TableBody>
      </Table>
    </Card>
  );
}
