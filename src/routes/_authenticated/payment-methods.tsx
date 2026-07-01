import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer, PageHeader } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/payment-methods")({
  head: () => ({ meta: [{ title: "Payment Methods" }] }),
  component: Page,
});

type PM = { id: string; name: string; is_cash: boolean; active: boolean; sort_order: number };

function Page() {
  const [rows, setRows] = useState<PM[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<PM> | null>(null);

  async function load() {
    const { data } = await supabase.from("payment_methods").select("*").order("sort_order");
    setRows((data ?? []) as any);
  }
  useEffect(() => { load(); }, []);

  async function save() {
    if (!editing?.name) return;
    const payload = { name: editing.name, is_cash: editing.is_cash ?? false, active: editing.active ?? true, sort_order: editing.sort_order ?? 0 };
    const { error } = editing.id
      ? await supabase.from("payment_methods").update(payload).eq("id", editing.id)
      : await supabase.from("payment_methods").insert(payload);
    if (error) return toast.error(error.message);
    setOpen(false); setEditing(null); load();
  }

  async function del(id: string) {
    if (!confirm("Delete?")) return;
    const { error } = await supabase.from("payment_methods").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  }

  return (
    <PageContainer>
      <PageHeader title="Payment Methods" subtitle="Cash, cards, bank, wallets — configure any method"
        actions={<Button onClick={() => { setEditing({ active: true, is_cash: false, sort_order: rows.length + 1 }); setOpen(true); }}><Plus className="w-4 h-4 mr-1" />New</Button>} />
      <Card>
        <Table>
          <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Cash?</TableHead><TableHead>Order</TableHead><TableHead>Active</TableHead><TableHead className="w-24" /></TableRow></TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell>{r.is_cash ? "Yes" : "No"}</TableCell>
                <TableCell>{r.sort_order}</TableCell>
                <TableCell>{r.active ? "Yes" : "No"}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => { setEditing(r); setOpen(true); }}><Pencil className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => del(r.id)}><Trash2 className="w-4 h-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing?.id ? "Edit" : "New"} payment method</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name</Label><Input value={editing?.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
            <div><Label>Sort order</Label><Input type="number" value={editing?.sort_order ?? 0} onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })} /></div>
            <label className="flex items-center gap-2"><input type="checkbox" checked={editing?.is_cash ?? false} onChange={(e) => setEditing({ ...editing, is_cash: e.target.checked })} /> Cash (counts in day closing)</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={editing?.active ?? true} onChange={(e) => setEditing({ ...editing, active: e.target.checked })} /> Active</label>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={save}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
