import { createFileRoute } from "@tanstack/react-router";
import { verifyApiToken, json, corsPreflight } from "@/lib/api-token.server";

export const Route = createFileRoute("/api/public/agent/menu")({
  server: {
    handlers: {
      OPTIONS: () => corsPreflight(),
      GET: async ({ request }) => {
        const auth = await verifyApiToken(request);
        if (!auth.ok) return auth.response;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const [{ data: products }, { data: cats }, { data: settings }] = await Promise.all([
          supabaseAdmin
            .from("products")
            .select("id,name,price,category_id,tax_rate,taxable")
            .eq("active", true)
            .eq("product_type", "ready")
            .order("name"),
          supabaseAdmin.from("categories").select("id,name").eq("active", true),
          supabaseAdmin.from("settings").select("currency").eq("id", 1).maybeSingle(),
        ]);
        const catMap = new Map((cats ?? []).map((c) => [c.id, c.name]));
        return json({
          currency: settings?.currency ?? "USD",
          items: (products ?? []).map((p) => ({
            id: p.id,
            name: p.name,
            price: Number(p.price),
            category: p.category_id ? catMap.get(p.category_id) ?? null : null,
            tax_rate: p.taxable ? Number(p.tax_rate ?? 0) : 0,
          })),
        });
      },
    },
  },
});
