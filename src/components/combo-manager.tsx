import { useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Trash2, Package } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { money } from "@/lib/format";
import { fetchTenantCombos, fetchTenantIdForCurrentUser, saveCombo, type ComboWithItems } from "@/lib/combos";
import { supabase } from "@/integrations/supabase/client";

type ProductOption = { id: string; name: string; price: number };
type DraftItem = { product_id: string; quantity: number };

type ComboManagerProps = { products: ProductOption[] };

export function ComboManager({ products }: ComboManagerProps) {
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [combos, setCombos] = useState<ComboWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<ComboWithItems | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [items, setItems] = useState<DraftItem[]>([]);

  async function load() {
    setLoading(true);
    try {
      const id = tenantId ?? await fetchTenantIdForCurrentUser();
      setTenantId(id);
      setCombos(await fetchTenantCombos(id));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load combos.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const availableProducts = useMemo(
    () => products.filter((product) => !items.some((item) => item.product_id === product.id)),
    [items, products],
  );

  function openCreate() {
    setEditing(null);
    setName("");
    setDescription("");
    setPrice("");
    setImageUrl("");
    setItems([]);
    setOpen(true);
  }

  function openEdit(combo: ComboWithItems) {
    setEditing(combo);
    setName(combo.name);
    setDescription(combo.description);
    setPrice(String(combo.price));
    setImageUrl(combo.image_url ?? "");
    setItems(combo.combo_items.map((item) => ({ product_id: item.product_id, quantity: item.quantity })));
    setOpen(true);
  }

  async function submit() {
    if (!tenantId) return toast.error("No tenant is associated with this account.");
    if (!name.trim()) return toast.error("Combo name is required.");
    if (items.length < 2) return toast.error("Select at least two products.");
    const numericPrice = Number(price);
    if (!Number.isFinite(numericPrice) || numericPrice < 0) return toast.error("Enter a valid non-negative price.");

    setSaving(true);
    try {
      await saveCombo(tenantId, {
        name: name.trim(),
        description: description.trim(),
        price: numericPrice,
        image_url: imageUrl.trim() || null,
        is_available: editing?.is_available ?? true,
      }, items);
      toast.success(editing ? "Combo updated." : "Combo created.");
      setOpen(false);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save combo.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleAvailability(combo: ComboWithItems) {
    const { error } = await supabase.from("combos").update({ is_available: !combo.is_available }).eq("id", combo.id);
    if (error) return toast.error(error.message);
    await load();
  }

  async function remove(combo: ComboWithItems) {
    if (!confirm(`Delete "${combo.name}"?`)) return;
    const { error } = await supabase.from("combos").delete().eq("id", combo.id);
    if (error) return toast.error(error.message);
    await load();
  }

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Combos</h2>
          <p className="text-sm text-muted-foreground">Bundle products and sell them as one POS item.</p>
        </div>
        <Button onClick={openCreate}><Plus className="mr-1 h-4 w-4" />Create Combo</Button>
      </div>
      {loading ? <Card className="p-8 text-center text-muted-foreground">Loading combos...</Card> : combos.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">No combos yet. Create your first bundle.</Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {combos.map((combo) => (
            <Card key={combo.id} className="overflow-hidden">
              {combo.image_url ? <img src={combo.image_url} alt="" className="h-36 w-full object-cover" /> : <div className="flex h-36 items-center justify-center bg-muted"><Package className="h-10 w-10 text-muted-foreground" /></div>}
              <div className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-2"><div><h3 className="font-semibold">{combo.name}</h3><p className="text-lg font-bold">{money(combo.price)}</p></div><span className={`rounded px-2 py-1 text-xs ${combo.is_available ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"}`}>{combo.is_available ? "Available" : "Unavailable"}</span></div>
                {combo.description && <p className="text-sm text-muted-foreground">{combo.description}</p>}
                <ul className="text-sm text-muted-foreground">{combo.combo_items.map((item) => <li key={item.id}>{item.quantity}x {item.product?.name ?? "Product"}</li>)}</ul>
                <div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => void toggleAvailability(combo)}>{combo.is_available ? "Disable" : "Enable"}</Button><Button variant="ghost" size="icon" onClick={() => openEdit(combo)}><Pencil className="h-4 w-4" /></Button><Button variant="ghost" size="icon" onClick={() => void remove(combo)}><Trash2 className="h-4 w-4" /></Button></div>
              </div>
            </Card>
          ))}
        </div>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>{editing ? "Edit combo" : "Create combo"}</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div><Label>Name</Label><Input value={name} onChange={(event) => setName(event.target.value)} /></div>
            <div><Label>Price</Label><Input type="number" min="0" step="0.01" value={price} onChange={(event) => setPrice(event.target.value)} /></div>
            <div><Label>Description</Label><Textarea value={description} onChange={(event) => setDescription(event.target.value)} /></div>
            <div><Label>Image URL (optional)</Label><Input value={imageUrl} onChange={(event) => setImageUrl(event.target.value)} placeholder="https://..." /></div>
            <div className="space-y-2"><Label>Included products</Label>{items.map((item, index) => <div key={item.product_id} className="flex gap-2"><select className="h-10 flex-1 rounded-md border bg-background px-3 text-sm" value={item.product_id} onChange={(event) => setItems(items.map((current, itemIndex) => itemIndex === index ? { ...current, product_id: event.target.value } : current))}><option value="">Select product</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select><Input className="w-24" type="number" min="1" step="1" value={item.quantity} onChange={(event) => setItems(items.map((current, itemIndex) => itemIndex === index ? { ...current, quantity: Math.max(1, Number(event.target.value)) } : current))} /><Button variant="ghost" size="icon" onClick={() => setItems(items.filter((_, itemIndex) => itemIndex !== index))}><Trash2 className="h-4 w-4" /></Button></div>)}<div className="flex gap-2"><select className="h-10 flex-1 rounded-md border bg-background px-3 text-sm" value="" onChange={(event) => event.target.value && setItems([...items, { product_id: event.target.value, quantity: 1 }])}><option value="">Add product...</option>{availableProducts.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></div></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button disabled={saving} onClick={() => void submit()}>{saving ? "Saving..." : "Save combo"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
