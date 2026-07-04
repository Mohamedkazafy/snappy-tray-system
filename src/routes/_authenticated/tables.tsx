import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { PageContainer, PageHeader } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, ArrowRightLeft } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/tables")({
  head: () => ({ meta: [{ title: "Tables" }] }),
  component: Page,
});

const STATUS_LABEL: Record<string, string> = {
  available: "Available",
  occupied: "Occupied",
  waiting_payment: "Waiting payment",
  reserved: "Reserved",
};

function Page() {
  const { isAdmin, user } = useSession();
  const navigate = useNavigate();
  const [areas, setAreas] = useState<any[]>([]);
  const [tables, setTables] = useState<any[]>([]);
  const [openArea, setOpenArea] = useState(false);
  const [newArea, setNewArea] = useState("");
  const [openTable, setOpenTable] = useState(false);
  const [newTable, setNewTable] = useState<{ area_id: string; name: string; seats: number }>({ area_id: "", name: "", seats: 4 });
  const [transferFrom, setTransferFrom] = useState<any | null>(null);
  const [transferTo, setTransferTo] = useState("");

  async function load() {
    const [a, t] = await Promise.all([
      supabase.from("dining_areas").select("*").order("sort_order"),
      supabase.from("dining_tables").select("*").order("name"),
    ]);
    setAreas(a.data ?? []);
    setTables(t.data ?? []);
  }
  useEffect(() => {
    load();
    const chan = supabase
      .channel("tables-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "dining_tables" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(chan); };
  }, []);

  async function addArea() {
    if (!newArea) return;
    const { error } = await supabase.from("dining_areas").insert({ name: newArea, sort_order: areas.length + 1 });
    if (error) return toast.error(error.message);
    setOpenArea(false); setNewArea(""); load();
  }
  async function addTable() {
    if (!newTable.area_id || !newTable.name) return;
    const { error } = await supabase.from("dining_tables").insert(newTable);
    if (error) return toast.error(error.message);
    setOpenTable(false); setNewTable({ area_id: "", name: "", seats: 4 }); load();
  }

  async function openTableForOrder(t: any) {
    if (!user) return;
    const { data: existing } = await supabase.from("orders").select("id").eq("table_id", t.id).eq("status", "open").maybeSingle();
    let orderId = existing?.id;
    if (!orderId) {
      const { data: created, error } = await supabase.from("orders").insert({ sale_type: "dinein", table_id: t.id, created_by: user.id }).select().single();
      if (error) return toast.error(error.message);
      orderId = created.id;
      await supabase.from("dining_tables").update({ status: "occupied" }).eq("id", t.id);
    }
    navigate({ to: "/table-order/$orderId", params: { orderId } });
  }

  async function doTransfer() {
    if (!transferFrom || !transferTo) return;
    const { data: srcOrder } = await supabase.from("orders").select("id").eq("table_id", transferFrom.id).eq("status", "open").maybeSingle();
    if (!srcOrder) return toast.error("No open order on this table");
    const { data: tgt } = await supabase.from("dining_tables").select("status").eq("id", transferTo).single();
    if (tgt?.status !== "available") return toast.error("Target table is not available");
    await supabase.from("orders").update({ table_id: transferTo }).eq("id", srcOrder.id);
    await supabase.from("dining_tables").update({ status: "available" }).eq("id", transferFrom.id);
    await supabase.from("dining_tables").update({ status: transferFrom.status }).eq("id", transferTo);
    toast.success("Table transferred");
    setTransferFrom(null); setTransferTo(""); load();
  }

  async function markReserved(t: any) {
    const next = t.status === "reserved" ? "available" : "reserved";
    await supabase.from("dining_tables").update({ status: next }).eq("id", t.id);
    load();
  }

  return (
    <PageContainer>
      <PageHeader title="Tables" subtitle="Tap a table to open its order"
        actions={
          isAdmin ? (
            <>
              <Button variant="outline" onClick={() => setOpenArea(true)}><Plus className="w-4 h-4 mr-1" />Area</Button>
              <Button onClick={() => setOpenTable(true)}><Plus className="w-4 h-4 mr-1" />Table</Button>
            </>
          ) : null
        }
      />

      <div className="flex flex-wrap gap-3 mb-4 text-xs">
        <LegendDot cls="bg-success/20 border-success/40" label="Available" />
        <LegendDot cls="bg-primary/15 border-primary" label="Occupied" />
        <LegendDot cls="bg-warning/20 border-warning" label="Waiting payment" />
        <LegendDot cls="bg-muted border-border" label="Reserved" />
      </div>

      <div className="space-y-6">
        {areas.map((a) => (
          <div key={a.id}>
            <h3 className="font-semibold text-lg mb-2">{a.name}</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {tables.filter((t) => t.area_id === a.id).map((t) => (
                <Card key={t.id} className={cn(
                  "p-4 cursor-pointer transition-all hover:shadow-md border-2",
                  t.status === "available" && "border-success/40 bg-success/10",
                  t.status === "occupied" && "border-primary bg-primary/10",
                  t.status === "waiting_payment" && "border-warning bg-warning/15",
                  t.status === "reserved" && "border-border bg-muted",
                )} onClick={() => openTableForOrder(t)}>
                  <div className="font-bold text-2xl">{t.name}</div>
                  <div className="text-xs text-muted-foreground mt-1">{t.seats} seats</div>
                  <div className={cn("text-xs mt-2 font-medium",
                    t.status === "occupied" && "text-primary",
                    t.status === "available" && "text-success",
                    t.status === "waiting_payment" && "text-warning-foreground",
                  )}>{STATUS_LABEL[t.status] ?? t.status}</div>
                  <div className="flex gap-1 mt-2">
                    {(t.status === "occupied" || t.status === "waiting_payment") && (
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={(e) => { e.stopPropagation(); setTransferFrom(t); }}>
                        <ArrowRightLeft className="w-3 h-3 mr-1" /> Move
                      </Button>
                    )}
                    {(t.status === "available" || t.status === "reserved") && (
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={(e) => { e.stopPropagation(); markReserved(t); }}>
                        {t.status === "reserved" ? "Free" : "Reserve"}
                      </Button>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </div>
        ))}
        {areas.length === 0 && (
          <Card className="p-12 text-center text-muted-foreground">
            No dining areas yet. {isAdmin && (<Link to="/tables" className="text-primary" onClick={() => setOpenArea(true)}>Create your first area</Link>)}
          </Card>
        )}
      </div>

      <Dialog open={openArea} onOpenChange={setOpenArea}>
        <DialogContent><DialogHeader><DialogTitle>New area</DialogTitle></DialogHeader>
          <Input placeholder="e.g. Main hall" value={newArea} onChange={(e) => setNewArea(e.target.value)} />
          <DialogFooter><Button onClick={addArea}>Create</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={openTable} onOpenChange={setOpenTable}>
        <DialogContent><DialogHeader><DialogTitle>New table</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Select value={newTable.area_id} onValueChange={(v) => setNewTable({ ...newTable, area_id: v })}>
              <SelectTrigger><SelectValue placeholder="Area" /></SelectTrigger>
              <SelectContent>{areas.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
            </Select>
            <Input placeholder="Table name / number" value={newTable.name} onChange={(e) => setNewTable({ ...newTable, name: e.target.value })} />
            <Input type="number" placeholder="Seats" value={newTable.seats} onChange={(e) => setNewTable({ ...newTable, seats: Number(e.target.value) })} />
          </div>
          <DialogFooter><Button onClick={addTable}>Create</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!transferFrom} onOpenChange={(v) => !v && setTransferFrom(null)}>
        <DialogContent><DialogHeader><DialogTitle>Transfer {transferFrom?.name} to…</DialogTitle></DialogHeader>
          <Select value={transferTo} onValueChange={setTransferTo}>
            <SelectTrigger><SelectValue placeholder="Available table" /></SelectTrigger>
            <SelectContent>
              {tables.filter((t) => t.status === "available" && t.id !== transferFrom?.id).map((t) => (
                <SelectItem key={t.id} value={t.id}>{areas.find(a => a.id === t.area_id)?.name} — {t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter><Button onClick={doTransfer}>Transfer</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}

function LegendDot({ cls, label }: { cls: string; label: string }) {
  return <div className="flex items-center gap-1.5"><span className={cn("w-3 h-3 rounded border-2", cls)} />{label}</div>;
}
