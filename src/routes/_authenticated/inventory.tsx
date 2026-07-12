import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer, PageHeader } from "@/components/page";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { money } from "@/lib/format";
import { toast } from "sonner";
import { Sliders, ArrowRightLeft, FileSpreadsheet } from "lucide-react";
import { useTranslation } from "react-i18next";
import * as XLSX from "xlsx";

export const Route = createFileRoute("/_authenticated/inventory")({
  head: () => ({ meta: [{ title: "Inventory" }] }),
  component: Page,
});


function Page() {
  const [stock, setStock] = useState<any[]>([]);
  const [moves, setMoves] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [adjust, setAdjust] = useState<{ product_id: string; warehouse_id: string; delta: string; note: string } | null>(null);
  const [transfer, setTransfer] = useState<{ product_id: string; from_wh: string; to_wh: string; qty: string; note: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const [s, m, p, w] = await Promise.all([
      supabase.from("stock").select("qty, avg_cost, min_qty, product_id, warehouse_id, products(name, product_type), warehouses(name)"),
      supabase.from("stock_movements").select("*, products(name), warehouses(name)").order("created_at", { ascending: false }).limit(200),
      supabase.from("products").select("id, name").eq("active", true).order("name"),
      supabase.from("warehouses").select("id, name").order("name"),
    ]);
    setStock(s.data ?? []);
    setMoves(m.data ?? []);
    setProducts(p.data ?? []);
    setWarehouses(w.data ?? []);
  }
  useEffect(() => { load(); }, []);

  const filtered = stock.filter((r: any) => !q || r.products?.name.toLowerCase().includes(q.toLowerCase()));

  async function submitAdjust() {
    if (!adjust) return;
    if (!adjust.product_id || !adjust.warehouse_id) return toast.error("Product & warehouse required");
    const delta = Number(adjust.delta);
    if (!delta) return toast.error("Enter a non-zero delta");
    setBusy(true);
    const { error } = await supabase.rpc("adjust_stock", {
      _product_id: adjust.product_id, _warehouse_id: adjust.warehouse_id,
      _delta: delta, _note: adjust.note,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Stock adjusted");
    setAdjust(null); load();
  }

  async function submitTransfer() {
    if (!transfer) return;
    const qty = Number(transfer.qty);
    if (!transfer.product_id || !transfer.from_wh || !transfer.to_wh) return toast.error("All fields required");
    if (!qty || qty <= 0) return toast.error("Qty must be positive");
    setBusy(true);
    const { error } = await supabase.rpc("transfer_stock", {
      _product_id: transfer.product_id, _from_wh: transfer.from_wh, _to_wh: transfer.to_wh,
      _qty: qty, _note: transfer.note,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Stock transferred");
    setTransfer(null); load();
  }

  return (
    <PageContainer>
      <PageHeader title="Inventory" subtitle="Live stock levels and movement history"
        actions={
          <>
            <Button variant="outline" onClick={() => setAdjust({ product_id: "", warehouse_id: warehouses[0]?.id ?? "", delta: "", note: "" })}>
              <Sliders className="w-4 h-4 mr-1" /> Adjust
            </Button>
            <Button onClick={() => setTransfer({ product_id: "", from_wh: warehouses[0]?.id ?? "", to_wh: warehouses[1]?.id ?? "", qty: "", note: "" })}>
              <ArrowRightLeft className="w-4 h-4 mr-1" /> Transfer
            </Button>
          </>
        }
      />
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
                <TableHead className="text-right">Actions</TableHead>
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
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => setAdjust({ product_id: r.product_id, warehouse_id: r.warehouse_id, delta: "", note: "" })}>Adjust</Button>
                      <Button variant="ghost" size="sm" onClick={() => setTransfer({ product_id: r.product_id, from_wh: r.warehouse_id, to_wh: warehouses.find(w => w.id !== r.warehouse_id)?.id ?? "", qty: "", note: "" })}>Transfer</Button>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No stock yet.</TableCell></TableRow>}
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

      <Dialog open={!!adjust} onOpenChange={(v) => !v && setAdjust(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Stock adjustment</DialogTitle></DialogHeader>
          {adjust && (
            <div className="space-y-3">
              <div>
                <Label>Product</Label>
                <Select value={adjust.product_id} onValueChange={(v) => setAdjust({ ...adjust, product_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                  <SelectContent>{products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Warehouse</Label>
                <Select value={adjust.warehouse_id} onValueChange={(v) => setAdjust({ ...adjust, warehouse_id: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{warehouses.map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Delta (use negative to decrease)</Label>
                <Input type="number" step="any" value={adjust.delta} onChange={(e) => setAdjust({ ...adjust, delta: e.target.value })} />
              </div>
              <div>
                <Label>Note</Label>
                <Input value={adjust.note} onChange={(e) => setAdjust({ ...adjust, note: e.target.value })} placeholder="e.g. spoilage, count fix" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjust(null)}>Cancel</Button>
            <Button onClick={submitAdjust} disabled={busy}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!transfer} onOpenChange={(v) => !v && setTransfer(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Stock transfer</DialogTitle></DialogHeader>
          {transfer && (
            <div className="space-y-3">
              <div>
                <Label>Product</Label>
                <Select value={transfer.product_id} onValueChange={(v) => setTransfer({ ...transfer, product_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                  <SelectContent>{products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>From</Label>
                  <Select value={transfer.from_wh} onValueChange={(v) => setTransfer({ ...transfer, from_wh: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{warehouses.map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>To</Label>
                  <Select value={transfer.to_wh} onValueChange={(v) => setTransfer({ ...transfer, to_wh: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{warehouses.map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Quantity</Label>
                <Input type="number" step="any" min={0} value={transfer.qty} onChange={(e) => setTransfer({ ...transfer, qty: e.target.value })} />
              </div>
              <div>
                <Label>Note</Label>
                <Input value={transfer.note} onChange={(e) => setTransfer({ ...transfer, note: e.target.value })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransfer(null)}>Cancel</Button>
            <Button onClick={submitTransfer} disabled={busy}>Transfer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
