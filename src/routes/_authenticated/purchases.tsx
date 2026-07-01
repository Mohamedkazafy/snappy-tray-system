import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { PageContainer, PageHeader } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Eye } from "lucide-react";
import { toast } from "sonner";
import { money } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/purchases")({
  head: () => ({ meta: [{ title: "Purchases" }] }),
  component: Page,
});

type Line = { product_id: string; qty: number; cost: number; tax_rate: number };

function Page() {
  const { user } = useSession();
  const [rows, setRows] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [supplierId, setSupplierId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [paid, setPaid] = useState(false);
  const [lines, setLines] = useState<Line[]>([]);
  const [viewing, setViewing] = useState<any | null>(null);
  const [viewItems, setViewItems] = useState<any[]>([]);

  async function load() {
    const [p, s, w, pr] = await Promise.all([
      supabase.from("purchases").select("*, suppliers(name), warehouses(name)").order("created_at", { ascending: false }).limit(100),
      supabase.from("suppliers").select("id,name"),
      supabase.from("warehouses").select("id,name,is_default"),
      supabase.from("products").select("id,name,cost").in("product_type", ["raw", "manufactured", "ready"]).order("name"),
    ]);
    setRows(p.data ?? []);
    setSuppliers(s.data ?? []);
    setWarehouses(w.data ?? []);
    setProducts(pr.data ?? []);
    if (!warehouseId) {
      const def = (w.data ?? []).find((x: any) => x.is_default) ?? (w.data ?? [])[0];
      if (def) setWarehouseId(def.id);
    }
  }
  useEffect(() => { load(); }, []);

  const totals = useMemo(() => {
    const subtotal = lines.reduce((s, l) => s + l.qty * l.cost, 0);
    const tax = lines.reduce((s, l) => s + l.qty * l.cost * (l.tax_rate / 100), 0);
    return { subtotal, tax, total: subtotal + tax };
  }, [lines]);

  async function save() {
    if (!warehouseId || lines.length === 0 || !user) return toast.error("Add lines");
    const { data: pur, error } = await supabase.from("purchases").insert({
      supplier_id: supplierId || null,
      warehouse_id: warehouseId,
      subtotal: totals.subtotal,
      tax: totals.tax,
      total: totals.total,
      paid,
      created_by: user.id,
    }).select().single();
    if (error) return toast.error(error.message);
    const items = lines.filter((l) => l.product_id).map((l) => ({ ...l, purchase_id: pur.id }));
    const { error: ie } = await supabase.from("purchase_items").insert(items);
    if (ie) return toast.error(ie.message);
    const { error: re } = await supabase.rpc("receive_purchase", { _purchase_id: pur.id });
    if (re) return toast.error(re.message);
    toast.success(`Purchase #${pur.purchase_number} received`);
    setOpen(false); setLines([]); setSupplierId(""); setPaid(false); load();
  }

  async function view(row: any) {
    setViewing(row);
    const { data } = await supabase.from("purchase_items").select("*, products(name)").eq("purchase_id", row.id);
    setViewItems(data ?? []);
  }

  return (
    <PageContainer>
      <PageHeader title="Purchases" subtitle="Receive stock from suppliers. Purchases update inventory automatically."
        actions={<Button onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-1" />New Purchase</Button>} />
      <Card>
        <Table>
          <TableHeader><TableRow>
            <TableHead>#</TableHead><TableHead>Date</TableHead><TableHead>Supplier</TableHead>
            <TableHead>Warehouse</TableHead><TableHead>Total</TableHead><TableHead>Paid</TableHead><TableHead className="w-16" />
          </TableRow></TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>#{r.purchase_number}</TableCell>
                <TableCell>{new Date(r.created_at).toLocaleString()}</TableCell>
                <TableCell>{r.suppliers?.name ?? "—"}</TableCell>
                <TableCell>{r.warehouses?.name}</TableCell>
                <TableCell>{money(r.total)}</TableCell>
                <TableCell>{r.paid ? "Yes" : "No"}</TableCell>
                <TableCell className="text-right"><Button variant="ghost" size="icon" onClick={() => view(r)}><Eye className="w-4 h-4" /></Button></TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No purchases.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>New purchase</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Supplier</Label>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>{suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Warehouse</Label>
              <Select value={warehouseId} onValueChange={setWarehouseId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{warehouses.map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {lines.map((l, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-center">
                <Select value={l.product_id} onValueChange={(v) => setLines(lines.map((x, j) => j === i ? { ...x, product_id: v, cost: products.find(p=>p.id===v)?.cost ?? x.cost } : x))}>
                  <SelectTrigger className="col-span-5"><SelectValue placeholder="Product" /></SelectTrigger>
                  <SelectContent>{products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
                <Input className="col-span-2" type="number" placeholder="Qty" value={l.qty} onChange={(e) => setLines(lines.map((x, j) => j === i ? { ...x, qty: Number(e.target.value) } : x))} />
                <Input className="col-span-2" type="number" step="0.01" placeholder="Cost" value={l.cost} onChange={(e) => setLines(lines.map((x, j) => j === i ? { ...x, cost: Number(e.target.value) } : x))} />
                <Input className="col-span-2" type="number" step="0.01" placeholder="Tax %" value={l.tax_rate} onChange={(e) => setLines(lines.map((x, j) => j === i ? { ...x, tax_rate: Number(e.target.value) } : x))} />
                <Button variant="ghost" size="icon" className="col-span-1" onClick={() => setLines(lines.filter((_, j) => j !== i))}><Trash2 className="w-4 h-4" /></Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => setLines([...lines, { product_id: "", qty: 1, cost: 0, tax_rate: 0 }])}><Plus className="w-4 h-4 mr-1" />Add line</Button>
          </div>
          <div className="text-right space-y-1">
            <div className="text-sm">Subtotal: <b>{money(totals.subtotal)}</b></div>
            <div className="text-sm">Tax: <b>{money(totals.tax)}</b></div>
            <div>Total: <b className="text-lg">{money(totals.total)}</b></div>
            <label className="flex items-center justify-end gap-2 text-sm"><input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} /> Marked paid</label>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={save}>Receive & save</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewing} onOpenChange={(v) => !v && setViewing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Purchase #{viewing?.purchase_number}</DialogTitle></DialogHeader>
          <Table>
            <TableHeader><TableRow><TableHead>Product</TableHead><TableHead>Qty</TableHead><TableHead>Cost</TableHead></TableRow></TableHeader>
            <TableBody>{viewItems.map((i) => (
              <TableRow key={i.id}><TableCell>{i.products?.name}</TableCell><TableCell>{i.qty}</TableCell><TableCell>{money(i.cost)}</TableCell></TableRow>
            ))}</TableBody>
          </Table>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
