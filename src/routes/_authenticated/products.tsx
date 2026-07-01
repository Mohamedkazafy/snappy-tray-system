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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { money } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/products")({
  head: () => ({ meta: [{ title: "Products" }] }),
  component: Page,
});

type Product = { id: string; code: string | null; name: string; category_id: string | null; product_type: "raw"|"manufactured"|"ready"; price: number; cost: number; taxable: boolean; tax_rate: number | null; active: boolean };
type Cat = { id: string; name: string };
type Recipe = { id?: string; ingredient_id: string; qty: number };

function Page() {
  const [rows, setRows] = useState<Product[]>([]);
  const [cats, setCats] = useState<Cat[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Product> | null>(null);
  const [recipeFor, setRecipeFor] = useState<Product | null>(null);
  const [recipe, setRecipe] = useState<Recipe[]>([]);

  async function load() {
    const [p, c] = await Promise.all([
      supabase.from("products").select("*").order("name"),
      supabase.from("categories").select("id,name").order("name"),
    ]);
    setRows((p.data ?? []) as any);
    setCats((c.data ?? []) as any);
  }
  useEffect(() => { load(); }, []);

  async function save() {
    if (!editing?.name) return toast.error("Name required");
    const payload: any = {
      code: editing.code || null,
      name: editing.name,
      category_id: editing.category_id || null,
      product_type: editing.product_type ?? "ready",
      price: editing.price ?? 0,
      cost: editing.cost ?? 0,
      taxable: editing.taxable ?? true,
      tax_rate: editing.tax_rate ?? null,
      active: editing.active ?? true,
    };
    const { error } = editing.id
      ? await supabase.from("products").update(payload).eq("id", editing.id)
      : await supabase.from("products").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Saved"); setOpen(false); setEditing(null); load();
  }

  async function del(id: string) {
    if (!confirm("Delete product?")) return;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  }

  async function openRecipe(p: Product) {
    setRecipeFor(p);
    const { data } = await supabase.from("recipe_items").select("*").eq("product_id", p.id);
    setRecipe((data ?? []) as any);
  }

  async function saveRecipe() {
    if (!recipeFor) return;
    await supabase.from("recipe_items").delete().eq("product_id", recipeFor.id);
    const items = recipe.filter((r) => r.ingredient_id && r.qty > 0).map((r) => ({ product_id: recipeFor.id, ingredient_id: r.ingredient_id, qty: r.qty }));
    if (items.length) {
      const { error } = await supabase.from("recipe_items").insert(items);
      if (error) return toast.error(error.message);
    }
    toast.success("Recipe saved");
    setRecipeFor(null);
  }

  const ingredients = rows.filter((p) => p.product_type === "raw" || p.product_type === "manufactured");

  return (
    <PageContainer>
      <PageHeader title="Products" subtitle="Raw materials, manufactured items, and items sold at the POS"
        actions={<Button onClick={() => { setEditing({ product_type: "ready", taxable: true, active: true, price: 0, cost: 0 }); setOpen(true); }}><Plus className="w-4 h-4 mr-1" />New</Button>} />
      <Card>
        <Table>
          <TableHeader><TableRow>
            <TableHead>Name</TableHead><TableHead>Code</TableHead><TableHead>Type</TableHead>
            <TableHead>Category</TableHead><TableHead>Price</TableHead><TableHead>Cost</TableHead>
            <TableHead className="w-32" />
          </TableRow></TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id} className={!r.active ? "opacity-50" : ""}>
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell className="text-muted-foreground">{r.code}</TableCell>
                <TableCell><span className="text-xs bg-secondary px-2 py-0.5 rounded">{r.product_type}</span></TableCell>
                <TableCell>{cats.find((c) => c.id === r.category_id)?.name ?? "—"}</TableCell>
                <TableCell>{money(r.price)}</TableCell>
                <TableCell>{money(r.cost)}</TableCell>
                <TableCell className="text-right">
                  {(r.product_type === "manufactured" || r.product_type === "ready") && (
                    <Button variant="ghost" size="icon" title="Recipe" onClick={() => openRecipe(r)}><BookOpen className="w-4 h-4" /></Button>
                  )}
                  <Button variant="ghost" size="icon" onClick={() => { setEditing(r); setOpen(true); }}><Pencil className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => del(r.id)}><Trash2 className="w-4 h-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No products.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing?.id ? "Edit" : "New"} product</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Label>Name</Label><Input value={editing?.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
            <div><Label>Code</Label><Input value={editing?.code ?? ""} onChange={(e) => setEditing({ ...editing, code: e.target.value })} /></div>
            <div>
              <Label>Type</Label>
              <Select value={editing?.product_type ?? "ready"} onValueChange={(v) => setEditing({ ...editing, product_type: v as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ready">Ready for sale</SelectItem>
                  <SelectItem value="manufactured">Manufactured</SelectItem>
                  <SelectItem value="raw">Raw material</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>Category</Label>
              <Select value={editing?.category_id ?? ""} onValueChange={(v) => setEditing({ ...editing, category_id: v || null })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>{cats.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Price</Label><Input type="number" step="0.01" value={editing?.price ?? 0} onChange={(e) => setEditing({ ...editing, price: Number(e.target.value) })} /></div>
            <div><Label>Cost</Label><Input type="number" step="0.01" value={editing?.cost ?? 0} onChange={(e) => setEditing({ ...editing, cost: Number(e.target.value) })} /></div>
            <div><Label>Tax rate %</Label><Input type="number" step="0.01" value={editing?.tax_rate ?? ""} onChange={(e) => setEditing({ ...editing, tax_rate: e.target.value ? Number(e.target.value) : null })} placeholder="Use default" /></div>
            <div className="flex items-end gap-4">
              <label className="flex items-center gap-2"><input type="checkbox" checked={editing?.taxable ?? true} onChange={(e) => setEditing({ ...editing, taxable: e.target.checked })} /> Taxable</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={editing?.active ?? true} onChange={(e) => setEditing({ ...editing, active: e.target.checked })} /> Active</label>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={save}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!recipeFor} onOpenChange={(v) => !v && setRecipeFor(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Recipe: {recipeFor?.name}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Ingredients consumed per 1 unit sold.</p>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {recipe.map((r, idx) => (
              <div key={idx} className="flex gap-2 items-center">
                <Select value={r.ingredient_id} onValueChange={(v) => setRecipe(recipe.map((x, i) => i === idx ? { ...x, ingredient_id: v } : x))}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder="Ingredient" /></SelectTrigger>
                  <SelectContent>{ingredients.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
                <Input type="number" step="0.001" className="w-28" value={r.qty} onChange={(e) => setRecipe(recipe.map((x, i) => i === idx ? { ...x, qty: Number(e.target.value) } : x))} />
                <Button variant="ghost" size="icon" onClick={() => setRecipe(recipe.filter((_, i) => i !== idx))}><Trash2 className="w-4 h-4" /></Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => setRecipe([...recipe, { ingredient_id: "", qty: 1 }])}><Plus className="w-4 h-4 mr-1" /> Add ingredient</Button>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setRecipeFor(null)}>Cancel</Button><Button onClick={saveRecipe}>Save recipe</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
