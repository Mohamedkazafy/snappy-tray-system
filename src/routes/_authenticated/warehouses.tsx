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

export const Route = createFileRoute("/_authenticated/warehouses")({
  head: () => ({ meta: [{ title: "Warehouses" }] }),
  component: Page,
});

type W = { id: string; name: string; is_default: boolean; active: boolean };

function Page() {
  const [rows, setRows] = useState<W[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<W> | null>(null);

  async function load() {
    const { data } = await supabase.from("warehouses").select("*").order("name");
    setRows((data ?? []) as any);
  }
  useEffect(() => { load(); }, []);

  async function save() {
    if (!editing?.name) return;
    if (editing.is_default) await supabase.from("warehouses").update({ is_default: false }).neq("id", editing.id ?? "00000000-0000-0000-0000-000000000000");
    const payload = { name: editing.name, is_default: editing.is_default ?? false, active: editing.active ?? true };
    const { error } = editing.id
      ? await supabase.from("warehouses").update(payload).eq("id", editing.id)
      : await supabase.from("warehouses").insert(payload);
    if (error) return toast.error(error.message);
    setOpen(false); setEditing(null); load();
  }

  async function del(id: string) {
    if (!confirm("Delete?")) return;
    const { error } = await supabase.from("warehouses").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  }

  return (
    <PageContainer>
      <PageHeader title="Warehouses" subtitle="Stock lives in warehouses. Sales deduct from the default warehouse."
        actions={<Button onClick={() => { setEditing({ active: true }); setOpen(true); }}><Plus className="w-4 h-4 mr-1" />New</Button>} />
      <Card>
        <Table>
          <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Default</TableHead><TableHead>Active</TableHead><TableHead className="w-24" /></TableRow></TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell>{r.is_default ? "★" : ""}</TableCell>
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
          <DialogHeader><DialogTitle>{editing?.id ? "Edit" : "New"} warehouse</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name</Label><Input value={editing?.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
            <label className="flex items-center gap-2"><input type="checkbox" checked={editing?.is_default ?? false} onChange={(e) => setEditing({ ...editing, is_default: e.target.checked })} /> Default</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={editing?.active ?? true} onChange={(e) => setEditing({ ...editing, active: e.target.checked })} /> Active</label>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={save}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
