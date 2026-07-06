import { createFileRoute } from "@tanstack/react-router";
import { verifyApiToken, json, corsPreflight } from "@/lib/api-token.server";

type ItemInput = { product_id?: string; name?: string; qty: number; notes?: string };
type Body = {
  customer_name?: string;
  customer_phone?: string;
  notes?: string;
  items: ItemInput[];
};

export const Route = createFileRoute("/api/public/agent/orders")({
  server: {
    handlers: {
      OPTIONS: () => corsPreflight(),
      POST: async ({ request }) => {
        const auth = await verifyApiToken(request);
        if (!auth.ok) return auth.response;

        let body: Body;
        try {
          body = (await request.json()) as Body;
        } catch {
          return json({ error: "Invalid JSON body" }, 400);
        }
        if (!body || !Array.isArray(body.items) || body.items.length === 0) {
          return json({ error: "items array is required" }, 400);
        }
        if (!body.customer_name || !body.customer_name.trim()) {
          return json({ error: "customer_name is required" }, 400);
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Resolve product ids by id or by name (case-insensitive), only "ready" active products.
        const wantIds = body.items.filter((i) => i.product_id).map((i) => i.product_id!) as string[];
        const wantNames = body.items.filter((i) => !i.product_id && i.name).map((i) => i.name!.trim().toLowerCase());

        const { data: byId } = wantIds.length
          ? await supabaseAdmin
              .from("products")
              .select("id,name,price,taxable,tax_rate,active,product_type")
              .in("id", wantIds)
          : { data: [] as any[] };
        const { data: byName } = wantNames.length
          ? await supabaseAdmin
              .from("products")
              .select("id,name,price,taxable,tax_rate,active,product_type")
              .eq("active", true)
              .eq("product_type", "ready")
          : { data: [] as any[] };

        const pById = new Map((byId ?? []).map((p: any) => [p.id, p]));
        const pByName = new Map((byName ?? []).map((p: any) => [p.name.toLowerCase(), p]));

        const resolved: Array<{ product_id: string; name: string; price: number; qty: number; tax_rate: number; notes: string | null }> = [];
        const missing: string[] = [];

        for (const it of body.items) {
          const qty = Number(it.qty);
          if (!qty || qty <= 0) return json({ error: `Invalid qty for item ${it.name ?? it.product_id ?? "?"}` }, 400);
          const p: any = it.product_id ? pById.get(it.product_id) : it.name ? pByName.get(it.name.trim().toLowerCase()) : null;
          if (!p || !p.active || p.product_type !== "ready") {
            missing.push(it.name ?? it.product_id ?? "?");
            continue;
          }
          resolved.push({
            product_id: p.id,
            name: p.name,
            price: Number(p.price),
            qty,
            tax_rate: p.taxable ? Number(p.tax_rate ?? 0) : 0,
            notes: it.notes ?? null,
          });
        }
        if (missing.length) return json({ error: "Unknown or unavailable items", items: missing }, 400);

        const subtotal = resolved.reduce((s, i) => s + i.price * i.qty, 0);
        const tax = resolved.reduce((s, i) => s + (i.price * i.qty * i.tax_rate) / 100, 0);
        const total = subtotal + tax;

        const { data: order, error: oerr } = await supabaseAdmin
          .from("orders")
          .insert({
            sale_type: "special",
            status: "open",
            customer_name: body.customer_name.trim(),
            customer_phone: body.customer_phone?.trim() ?? null,
            notes: body.notes?.trim() ?? null,
            subtotal,
            discount: 0,
            tax,
            total,
            cost_total: 0,
          })
          .select("id, order_number")
          .single();
        if (oerr || !order) return json({ error: oerr?.message ?? "Failed to create order" }, 500);

        const { error: ierr } = await supabaseAdmin.from("order_items").insert(
          resolved.map((r) => ({
            order_id: order.id,
            product_id: r.product_id,
            name: r.name,
            qty: r.qty,
            price: r.price,
            cost: 0,
            tax_rate: r.tax_rate,
            notes: r.notes,
          })),
        );
        if (ierr) return json({ error: ierr.message }, 500);

        return json({
          order_id: order.id,
          order_number: order.order_number,
          status: "open",
          subtotal,
          tax,
          total,
          items: resolved.map((r) => ({ name: r.name, qty: r.qty, price: r.price, line_total: r.price * r.qty })),
        }, 201);
      },
    },
  },
});
