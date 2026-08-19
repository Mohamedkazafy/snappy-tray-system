import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
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

type Product = { id: string; code: string | null; name: string; category_id: string | null; brand_id: string | null; product_type: "raw"|"manufactured"|"ready"; price: number; cost: number; taxable: boolean; tax_rate: number | null; unit: string | null; reorder_level: number | null; active: boolean };
type Cat = { id: string; name: string };
type Brand = { id: string; name: string };
type Recipe = { id?: string; ingredient_id: string; qty: number };

function Page() {
  const [rows, setRows] = useState<Product[]>([]);
  const [cats, setCats] = useState<Cat[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Product> | null>(null);
  const [recipeFor, setRecipeFor] = useState<Product | null>(null);
  const [recipe, setRecipe] = useState<Recipe[]>([]);
  const [recipeCounts, setRecipeCounts] = useState<Record<string, number>>({});

  async function load() {
    const [p, c, b] = await Promise.all([
      supabase.from("products").select("*").order("name"),
      supabase.from("categories").select("id,name").order("name"),
      supabase.from("brands").select("id,name").order("name"),
    ]);
    const products = (p.data ?? []) as any;
    setRows(products);
    setCats((c.data ?? []) as any);
    setBrands((b.data ?? []) as any);

    // Load recipe counts
    const ids = products.map((x: any) => x.id).filter(Boolean);
    if (ids.length) {
      const { data: ri } = await supabase.from('recipe_items').select('product_id');
      const counts: Record<string, number> = {};
      (ri ?? []).forEach((r: any) => { counts[r.product_id] = (counts[r.product_id] || 0) + 1; });
      setRecipeCounts(counts);
    } else {
      setRecipeCounts({});
    }
  }
  useEffect(() => { load(); }, []);

  async function save() {
    if (!editing?.name) return toast.error("Name required");
    const payload: any = {
      code: editing.code || null,
      name: editing.name,
      category_id: editing.category_id || null,
      brand_id: editing.brand_id || null,
      product_type: editing.product_type ?? "ready",
      price: editing.price ?? 0,
      cost: editing.cost ?? 0,
      taxable: editing.taxable ?? true,
      tax_rate: editing.tax_rate ?? null,
      unit: editing.unit || null,
      reorder_level: editing.reorder_level ?? 0,
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
  const importInputRef = useRef<HTMLInputElement | null>(null);

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewFileName, setPreviewFileName] = useState<string | null>(null);
  const [previewHeaders, setPreviewHeaders] = useState<string[]>([]);
  const [previewRows, setPreviewRows] = useState<string[][]>([]);
  const [colMapping, setColMapping] = useState<{ category?: number; name?: number; price?: number; cost?: number }>({ category: 0, name: 1, price: 2, cost: 3 });

  async function handleFileSelect(f: File | null) {
    if (!f) return;
    const name = f.name.toLowerCase();
    setPreviewFileName(f.name);

    if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
      // Try to dynamically import xlsx; if not available, show instructions.
      try {
        const XLSX = await import('xlsx');
        const ab = await f.arrayBuffer();
        const wb = XLSX.read(ab, { type: 'array' });
        const sheetName = wb.SheetNames[0];
        const ws = wb.Sheets[sheetName];
        const data: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
        if (!data || data.length < 2) { toast.error('Empty or invalid spreadsheet'); return; }
        setPreviewHeaders((data[0] as string[]).map((h) => String(h ?? '')));
        setPreviewRows(data.slice(1).map((r) => (r as any[]).map((c) => String(c ?? ''))));
        setPreviewOpen(true);
        return;
      } catch (e: any) {
        console.warn('xlsx not available', e);
        toast.error('XLSX support requires the xlsx package. Run `npm i xlsx` and restart the dev server. Falling back to CSV parser if possible.');
        // fallthrough to CSV
      }
    }

    // CSV fallback - robust parse (handle quoted fields, different delimiter)
    try {
      const txt = await f.text();
      if (!txt || txt.trim().length === 0) { toast.error('Empty or invalid CSV'); return; }

      function detectDelimiter(sample: string) {
        const candidates = [',',';','\t','|'];
        let best = ','; let bestCount = 0;
        for (const d of candidates) {
          const count = sample.split('\n').slice(0,5).map(l => l.split(d).length).reduce((a,b)=>a+b,0);
          if (count > bestCount) { bestCount = count; best = d; }
        }
        return best;
      }

      function parseCsvText(text: string, delimiter: string) {
        const rows: string[][] = [];
        const re = new RegExp(`\\s*(?:\\"([^"]*(?:\\"\\"[^"]*)*)\\"|([^\\"${delimiter}]*))\\s*(?:${delimiter}|$)`, 'g');
        // simpler parser: split lines then parse quoted cells
        const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
        for (const line of lines) {
          const cells: string[] = [];
          let cur = '';
          let inQuotes = false;
          for (let i=0;i<line.length;i++) {
            const ch = line[i];
            if (ch === '"') {
              if (inQuotes && line[i+1] === '"') { cur += '"'; i++; }
              else { inQuotes = !inQuotes; }
            } else if (!inQuotes && ch === delimiter) {
              cells.push(cur); cur = '';
            } else { cur += ch; }
          }
          cells.push(cur);
          rows.push(cells.map(c => c.trim()));
        }
        return rows;
      }

      const sample = txt.split('\n').slice(0,5).join('\n');
      const delimiter = detectDelimiter(sample);
      const parsed = parseCsvText(txt, delimiter);
      if (parsed.length < 2) { toast.error('Empty or invalid CSV'); return; }
      const hdr = parsed[0].map(h => h || '');
      const dataRows = parsed.slice(1).filter(r => r.some(cell => cell !== ''));

      // Auto-detect columns if headers are not reliable (Arabic headers etc.)
      const lower = hdr.map(h => (h||'').toLowerCase());
      function findHeaderIndex(keys: string[]) {
        for (const k of keys) {
          const i = lower.findIndex(h => h.includes(k));
          if (i >= 0) return i;
        }
        return -1;
      }

      // heuristics
      const nameHints = ['name','item','product','product name','item name','الصنف','اسم'];
      const priceHints = ['price','sale price','price e','السعر','price (egp)','egp','cost price'];
      const costHints = ['cost','cost price','تكلفة'];
      const categoryHints = ['category','type','group','قسم','مجموعة'];
      const ingredientHints = ['ingredient','ingredients','components','مكون'];
      const measureHints = ['measure','qty','quantity','amount','كمية'];

      let detectedName = findHeaderIndex(nameHints);
      let detectedPrice = findHeaderIndex(priceHints);
      let detectedCost = findHeaderIndex(costHints);
      let detectedCategory = findHeaderIndex(categoryHints);
      let detectedIngredient = findHeaderIndex(ingredientHints);
      let detectedMeasure = findHeaderIndex(measureHints);

      // fallback: if name not found, pick first non-empty column that contains non-numeric in first row
      if (detectedName === -1) {
        for (let ci=0; ci<hdr.length; ci++) {
          const sampleVals = dataRows.slice(0,5).map(r => r[ci] ?? '').filter(Boolean);
          const numericCount = sampleVals.filter(v => /^[0-9,.\s\$EGPegp\-]+$/.test(v)).length;
          if (numericCount < sampleVals.length) { detectedName = ci; break; }
        }
        if (detectedName === -1) detectedName = 0;
      }

      // If price not found, find a numeric column with many numeric-like values
      if (detectedPrice === -1) {
        let bestIdx = -1; let bestScore = 0;
        for (let ci=0; ci<hdr.length; ci++) {
          const sampleVals = dataRows.slice(0,8).map(r => r[ci] ?? '').filter(Boolean);
          if (sampleVals.length === 0) continue;
          const score = sampleVals.reduce((s,v) => s + (/[0-9]/.test(v) ? 1 : 0), 0);
          if (score > bestScore) { bestScore = score; bestIdx = ci; }
        }
        if (bestIdx >= 0) detectedPrice = bestIdx;
      }

      // cost fallback similar
      if (detectedCost === -1) {
        for (let ci=0; ci<hdr.length; ci++) {
          if (ci === detectedPrice || ci === detectedName) continue;
          const sampleVals = dataRows.slice(0,8).map(r => r[ci] ?? '').filter(Boolean);
          const score = sampleVals.reduce((s,v) => s + (/[0-9]/.test(v) ? 1 : 0), 0);
          if (score > 0) { detectedCost = ci; break; }
        }
      }

      setPreviewHeaders(hdr);
      setPreviewRows(dataRows);
      // set default mapping
      setColMapping({ category: detectedCategory >= 0 ? detectedCategory : 0, name: detectedName, price: detectedPrice >= 0 ? detectedPrice : 2, cost: detectedCost >=0 ? detectedCost : 3 });
      setPreviewOpen(true);
    } catch (e: any) {
      toast.error('Failed to read file: ' + (e.message ?? e));
    }
  }

  function parseMoneyCell(v: any) {
    if (v == null) return 0;
    let s = String(v).trim();
    if (!s) return 0;
    // remove currency symbols and spaces, keep digits, dot, comma, minus
    s = s.replace(/[^0-9.,\-]/g, '');
    // If both comma and dot present, assume comma is thousands and remove commas
    if (s.indexOf(',') !== -1 && s.indexOf('.') !== -1) {
      s = s.replace(/,/g, '');
    } else {
      // remove commas (thousands) and keep dot as decimal
      s = s.replace(/,/g, '');
    }
    const n = parseFloat(s);
    return isNaN(n) ? 0 : n;
  }

  function splitIngredientParts(cell: string) {
    if (!cell) return [];
    // split on ; or |, fallback to comma
    let parts = cell.split(/;|\||\n/).map(p => p.trim()).filter(Boolean);
    if (parts.length <= 1) {
      parts = cell.split(',').map(p => p.trim()).filter(Boolean);
    }
    return parts;
  }

  function parseIngredientPart(part: string, measureCell?: string) {
    // Try to extract name and quantity+unit
    // Patterns: "Beef 150g", "Beef:150 g", "Beef|150g", "Beef - 150 g"
    const res: { name: string; qty: number; unit: string | null } = { name: part, qty: 0, unit: null };
    // If measureCell provided (separate column), try to parse numeric
    if (measureCell) {
      const num = parseFloat((measureCell + '').replace(/[^0-9.\-]/g, '')) || 0;
      res.qty = num;
      res.unit = (measureCell + '').replace(/[0-9.,\s]/g, '') || null;
    }

    // Try regex on part
    // capture name then number and optional unit
    const m = part.match(/^(.*?)[:\-\(\[]?\s*([0-9.,]+)\s*([a-zA-Z%µgmlkGLpcs]+)?\)?$/i);
    if (m) {
      res.name = (m[1] || '').trim() || res.name;
      const numStr = (m[2] || '').replace(/,/g, '');
      res.qty = parseFloat(numStr) || res.qty || 0;
      res.unit = (m[3] || res.unit || null);
      return res;
    }

    // alternate: '150g Beef' or '150 g Beef'
    const m2 = part.match(/^\s*([0-9.,]+)\s*([a-zA-Z%µgmlkGLpcs]+)?\s+(.*)$/i);
    if (m2) {
      const numStr = (m2[1] || '').replace(/,/g, '');
      res.qty = parseFloat(numStr) || res.qty || 0;
      res.unit = m2[2] || res.unit || null;
      res.name = (m2[3] || '').trim() || res.name;
      return res;
    }

    // If nothing matched, return name only
    res.name = (part || '').trim();
    return res;
  }

  async function ensureRawProductByName(name: string, unit: string | null) {
    const nm = (name || '').trim();
    if (!nm) return null;
    // Try find existing raw product (case-insensitive)
    const { data: found } = await supabase.from('products').select('id,unit').ilike('name', nm).eq('product_type', 'raw').limit(1).maybeSingle();
    if (found && found.id) {
      // update unit if missing
      if ((!found.unit || found.unit === '') && unit) {
        await supabase.from('products').update({ unit }).eq('id', found.id);
      }
      return found.id;
    }
    const { data } = await supabase.from('products').insert({ name: nm, product_type: 'raw', price: 0, cost: 0, unit: unit || null, taxable: false, active: true }).select('id').single();
    return data?.id ?? null;
  }

  async function confirmImport() {
    const cIdx = colMapping.category ?? 0;
    const nIdx = colMapping.name ?? 1;
    const pIdx = colMapping.price ?? 2;
    const costIdx = colMapping.cost ?? 3;

    const catNames = Array.from(new Set(previewRows.map((r) => (r[cIdx] || 'Uncategorized'))));
    const { data: existing } = await supabase.from('categories').select('id,name').in('name', catNames);
    const catMap: Record<string, string> = {};
    (existing ?? []).forEach((c: any) => (catMap[c.name] = c.id));

    for (const cname of catNames) {
      if (!catMap[cname]) {
        const { data, error } = await supabase.from('categories').insert({ name: cname }).select('id').single();
        if (error) { toast.error('Error creating category: ' + error.message); return; }
        catMap[cname] = data.id;
      }
    }

    // Detect ingredient columns
    const lowerHeaders = previewHeaders.map(h => (h||'').toLowerCase());
    const ingredientColIdx = lowerHeaders.findIndex(h => h.includes('ingredient'));
    const measureColIdx = lowerHeaders.findIndex(h => h.includes('measure') || h.includes('qty') || h.includes('quantity') || h.includes('amount'));

    for (const r of previewRows) {
      const name = (r[nIdx] || 'Unnamed').trim();
      const priceRaw = r[pIdx] ?? '';
      const costRaw = r[costIdx] ?? '';
      const price = parseMoneyCell(priceRaw);
      const cost = parseMoneyCell(costRaw);

      const { data: newProd, error: prodErr } = await supabase.from('products').insert({ name, category_id: catMap[r[cIdx] || 'Uncategorized'], price, cost, product_type: 'ready', taxable: true, active: true }).select('id').single();
      if (prodErr || !newProd) { toast.error('Error inserting product ' + name + ': ' + (prodErr?.message ?? 'unknown')); continue; }
      const productId = newProd.id;

      // If ingredient column exists, parse and create recipe_items
      const ingredientCell = ingredientColIdx >= 0 ? (r[ingredientColIdx] || '') : '';
      const measureCell = measureColIdx >= 0 ? (r[measureColIdx] || '') : '';
      if (ingredientCell && String(ingredientCell).trim()) {
        const parts = splitIngredientParts(String(ingredientCell));
        for (const part of parts) {
          const parsed = parseIngredientPart(part, measureCell);
          const ingName = parsed.name;
          const qty = parsed.qty || 0;
          const unit = parsed.unit || null;
          const rawId = await ensureRawProductByName(ingName, unit);
          if (!rawId) continue;
          // Insert recipe item
          await supabase.from('recipe_items').insert({ product_id: productId, ingredient_id: rawId, qty: qty });
        }
      }
    }

    toast.success('Import complete');
    setPreviewOpen(false);
    setPreviewRows([]);
    setPreviewHeaders([]);
    if (importInputRef.current) importInputRef.current.value = '';
    load();
  }

  return (
    <PageContainer>
      <PageHeader title="Products" subtitle="Raw materials, manufactured items, and items sold at the POS"
        actions={<div className="flex gap-2 items-center"><input ref={importInputRef} id="import-menu-file" type="file" accept="text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" style={{ display: 'none' }} onChange={async (e) => { const f = e.target.files?.[0]; await handleFileSelect(f); }} /><Button variant="ghost" onClick={() => importInputRef.current?.click()}><BookOpen className="w-4 h-4 mr-1" />Import Menu</Button><Button onClick={() => { setEditing({ product_type: "ready", taxable: true, active: true, price: 0, cost: 0 }); setOpen(true); }}><Plus className="w-4 h-4 mr-1" />New</Button></div>} />
      <Card>
        <Table>
          <TableHeader><TableRow>
            <TableHead>Name</TableHead><TableHead>Code</TableHead><TableHead>Type</TableHead>
            <TableHead>Brand</TableHead><TableHead>Category</TableHead><TableHead>Price</TableHead><TableHead>Cost</TableHead>
            <TableHead className="w-32" />
          </TableRow></TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id} className={!r.active ? "opacity-50" : ""}>
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell className="text-muted-foreground">{r.code}</TableCell>
                <TableCell><span className="text-xs bg-secondary px-2 py-0.5 rounded">{r.product_type}</span></TableCell>
                <TableCell>{brands.find((b) => b.id === r.brand_id)?.name ?? "—"}</TableCell>
                <TableCell>{cats.find((c) => c.id === r.category_id)?.name ?? "—"}</TableCell>
                <TableCell>{money(r.price)}</TableCell>
                <TableCell>{money(r.cost)}</TableCell>
                <TableCell className="text-right">
                  {(r.product_type === "manufactured" || r.product_type === "ready") && (
                    <div className="inline-flex items-center">
                      <Button variant="ghost" size="icon" title="Recipe" onClick={() => openRecipe(r)}><BookOpen className="w-4 h-4" /></Button>
                      {recipeCounts[r.id] ? <span className="text-xs ml-1 px-2 py-0.5 rounded bg-muted text-muted-foreground">{recipeCounts[r.id]}</span> : null}
                    </div>
                  )}
                  <Button variant="ghost" size="icon" onClick={() => { setEditing(r); setOpen(true); }}><Pencil className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => del(r.id)}><Trash2 className="w-4 h-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No products.</TableCell></TableRow>}
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
            <div>
              <Label>Brand</Label>
              <Select value={editing?.brand_id ?? ""} onValueChange={(v) => setEditing({ ...editing, brand_id: v || null })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>{brands.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
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
            <div><Label>Unit</Label><Select value={editing?.unit ?? ""} onValueChange={(v) => setEditing({ ...editing, unit: v || null })}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="grams">grams</SelectItem>
                <SelectItem value="ml">ml</SelectItem>
                <SelectItem value="pcs">pcs</SelectItem>
              </SelectContent>
            </Select></div>
            <div><Label>Reorder level</Label><Input type="number" step="0.001" value={editing?.reorder_level ?? 0} onChange={(e) => setEditing({ ...editing, reorder_level: Number(e.target.value) })} /></div>
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

      {/* Import preview dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>Import preview: {previewFileName}</DialogTitle></DialogHeader>
          <div className="text-sm text-muted-foreground">Map columns and preview the first rows before confirming import.</div>
          <div className="grid grid-cols-4 gap-2 mt-3">
            <div>
              <label className="text-xs">Category column</label>
              <select value={colMapping.category ?? 0} onChange={(e) => setColMapping({ ...colMapping, category: Number(e.target.value) })} className="w-full">
                {previewHeaders.map((h, i) => <option value={i} key={i}>{h || `Column ${i+1}`}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs">Name column</label>
              <select value={colMapping.name ?? 1} onChange={(e) => setColMapping({ ...colMapping, name: Number(e.target.value) })} className="w-full">
                {previewHeaders.map((h, i) => <option value={i} key={i}>{h || `Column ${i+1}`}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs">Price column</label>
              <select value={colMapping.price ?? 2} onChange={(e) => setColMapping({ ...colMapping, price: Number(e.target.value) })} className="w-full">
                {previewHeaders.map((h, i) => <option value={i} key={i}>{h || `Column ${i+1}`}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs">Cost column</label>
              <select value={colMapping.cost ?? 3} onChange={(e) => setColMapping({ ...colMapping, cost: Number(e.target.value) })} className="w-full">
                {previewHeaders.map((h, i) => <option value={i} key={i}>{h || `Column ${i+1}`}</option>)}
              </select>
            </div>
          </div>

          <div className="mt-4 max-h-60 overflow-auto border rounded">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  {previewHeaders.map((h, i) => <th key={i} className="p-2 text-left">{h || `Column ${i+1}`}</th>)}
                </tr>
              </thead>
              <tbody>
                {previewRows.slice(0, 10).map((r, ri) => (
                  <tr key={ri} className={ri%2? 'bg-muted/5':''}>
                    {previewHeaders.map((_, ci) => <td key={ci} className="p-2">{(r[ci] ?? '')}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setPreviewOpen(false); setPreviewRows([]); setPreviewHeaders([]); }}>Cancel</Button>
            <Button onClick={confirmImport}>Confirm import</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
