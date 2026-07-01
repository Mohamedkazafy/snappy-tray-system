import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer, PageHeader } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/suppliers")({
  head: () => ({ meta: [{ title: "Suppliers" }] }),
  component: Page,
});

type S = { id: string; name: string; phone: string | null; address: string | null; tax_number: string | null; notes: string | null };

function Page() {
  const [rows, setRows] = useState<S[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<S> | null>(null);

  async function load() {
    const { data } = await supabase.from("suppliers").select("*").order("name");
    setRows((data ?? []) as any);
  }
  useEffect(() => { load(); }, []);

  async function save() {
    if (!editing?.name) return;
    const payload = { name: editing.name, phone: editing.phone || null, address: editing.address || null, tax_number: editing.tax_number || null, notes: editing.notes || null };
    const { error } = editing.id
      ? await supabase.from("suppliers").update(payload).eq("id", editing.id)
      : await supabase.from("suppliers").insert(payload);
    if (error) return toast.error(error.message);
    setOpen(false); setEditing(null); load();
  }

  async function del(id: string) {
    if (!confirm("Delete?")) return;
    const { error } = await supabase.from("suppliers").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  }

  return (
    <PageContainer>
      <PageHeader title="Suppliers"
        actions={<Button onClick={() => { setEditing({}); setOpen(true); }}><Plus className="w-4 h-4 mr-1" />New</Button>} />
      <Card>
        <Table>
          <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Phone</TableHead><TableHead>Tax #</TableHead><TableHead className="w-24" /></TableRow></TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell>{r.phone}</TableCell>
                <TableCell>{r.tax_number}</TableCell>
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
          <DialogHeader><DialogTitle>{editing?.id ? "Edit" : "New"} supplier</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name</Label><Input value={editing?.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
            <div><Label>Phone</Label><Input value={editing?.phone ?? ""} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} /></div>
            <div><Label>Address</Label><Input value={editing?.address ?? ""} onChange={(e) => setEditing({ ...editing, address: e.target.value })} /></div>
            <div><Label>Tax number</Label><Input value={editing?.tax_number ?? ""} onChange={(e) => setEditing({ ...editing, tax_number: e.target.value })} /></div>
            <div><Label>Notes</Label><Textarea value={editing?.notes ?? ""} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={save}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
