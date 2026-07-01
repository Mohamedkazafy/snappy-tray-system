import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer, PageHeader } from "@/components/page";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { money } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/inventory")({
  head: () => ({ meta: [{ title: "Inventory" }] }),
  component: Page,
});

function Page() {
  const [stock, setStock] = useState<any[]>([]);
  const [moves, setMoves] = useState<any[]>([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    (async () => {
      const [s, m] = await Promise.all([
        supabase.from("stock").select("qty, avg_cost, min_qty, products(name, product_type), warehouses(name)"),
        supabase.from("stock_movements").select("*, products(name), warehouses(name)").order("created_at", { ascending: false }).limit(200),
      ]);
      setStock(s.data ?? []);
      setMoves(m.data ?? []);
    })();
  }, []);

  const filtered = stock.filter((r: any) => !q || r.products?.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <PageContainer>
      <PageHeader title="Inventory" subtitle="Live stock levels and movement history" />
      <Tabs defaultValue="stock">
        <TabsList>
          <TabsTrigger value="stock">Current stock</TabsTrigger>
          <TabsTrigger value="moves">Movements</TabsTrigger>
        </TabsList>
        <TabsContent value="stock">
          <div className="mb-3"><Input placeholder="Search product…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" /></div>
          <Card>
            <Table>
              <TableHeader><TableRow>
                <TableHead>Product</TableHead><TableHead>Type</TableHead><TableHead>Warehouse</TableHead>
                <TableHead className="text-right">Qty</TableHead><TableHead className="text-right">Avg cost</TableHead><TableHead className="text-right">Value</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {filtered.map((r: any, i: number) => (
                  <TableRow key={i} className={Number(r.qty) <= Number(r.min_qty) && r.min_qty > 0 ? "bg-warning/10" : ""}>
                    <TableCell className="font-medium">{r.products?.name}</TableCell>
                    <TableCell><span className="text-xs bg-secondary px-2 py-0.5 rounded">{r.products?.product_type}</span></TableCell>
                    <TableCell>{r.warehouses?.name}</TableCell>
                    <TableCell className="text-right">{Number(r.qty).toFixed(3)}</TableCell>
                    <TableCell className="text-right">{money(r.avg_cost)}</TableCell>
                    <TableCell className="text-right">{money(Number(r.qty) * Number(r.avg_cost))}</TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No stock yet.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
        <TabsContent value="moves">
          <Card>
            <Table>
              <TableHeader><TableRow>
                <TableHead>Date</TableHead><TableHead>Product</TableHead><TableHead>Warehouse</TableHead>
                <TableHead>Reason</TableHead><TableHead className="text-right">Qty</TableHead><TableHead className="text-right">Cost</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {moves.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell>{new Date(r.created_at).toLocaleString()}</TableCell>
                    <TableCell>{r.products?.name}</TableCell>
                    <TableCell>{r.warehouses?.name}</TableCell>
                    <TableCell><span className="text-xs bg-secondary px-2 py-0.5 rounded">{r.reason}</span></TableCell>
                    <TableCell className={"text-right " + (Number(r.qty) < 0 ? "text-destructive" : "text-success")}>{Number(r.qty).toFixed(3)}</TableCell>
                    <TableCell className="text-right">{money(r.cost)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}
