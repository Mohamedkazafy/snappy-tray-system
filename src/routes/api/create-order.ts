import { createFileRoute } from "@tanstack/react-router";
import { json } from "@/lib/api-token.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getUserFromAuthHeader } from "@/lib/auth-utils.server";
import { ensureTenantActiveForOwner } from "@/lib/subscription";

type ItemInput = { product_id: string; name: string; qty: number; price: number; tax_rate: number; notes?: string | null };

type Body = {
  tenant_id?: string;
  items: ItemInput[];
  sale_type?: string;
  table_id?: string | null;
  customer_name?: string | null;
  discount?: number;
};

export const Route = createFileRoute("/api/create-order")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: Body;
        try {
          body = (await request.json()) as Body;
        } catch {
          return json({ error: "Invalid JSON body" }, 400);
        }
        if (!body || !Array.isArray(body.items) || body.items.length === 0) {
          return json({ error: "items array is required" }, 400);
        }

        // Authenticate user via Authorization header (Bearer <token>)
        const auth = await getUserFromAuthHeader(request.headers.get('authorization'));
        if (!auth || !auth.userId) return json({ error: 'Unauthorized' }, 401);

        // Resolve tenant
        let tenantId = body.tenant_id ?? null;
        if (!tenantId) {
          const t = await supabaseAdmin.from('tenants').select('id').eq('owner_id', auth.userId).limit(1).maybeSingle();
          tenantId = t.data?.id ?? null;
        }

        // If tenant found, check subscription
        if (tenantId) {
          try {
            await ensureTenantActiveForOwner(auth.userId);
          } catch (err: any) {
            return json(err.body ?? { error: 'SUBSCRIPTION_EXPIRED' }, err.status ?? 402);
          }
        }

        const subtotal = body.items.reduce((s, i) => s + i.price * i.qty, 0);
        const tax = body.items.reduce((s, i) => s + (i.price * i.qty * (i.tax_rate ?? 0)) / 100, 0);
        const total = subtotal + tax - (body.discount ?? 0);

        // Insert order
        const { data: order, error: oerr } = await supabaseAdmin
          .from('orders')
          .insert({
            sale_type: body.sale_type ?? 'takeaway',
            table_id: body.table_id ?? null,
            subtotal,
            discount: body.discount ?? 0,
            tax,
            total,
            customer_name: body.customer_name ?? null,
            created_by: auth.userId,
            tenant_id: tenantId,
          })
          .select('id,order_number')
          .single();

        if (oerr || !order) return json({ error: oerr?.message ?? 'Failed to create order' }, 500);

        const itemsToInsert = body.items.map((i) => ({
          order_id: order.id,
          product_id: i.product_id,
          name: i.name,
          qty: i.qty,
          price: i.price,
          cost: 0,
          tax_rate: i.tax_rate ?? 0,
          notes: i.notes ?? null,
        }));

        const { error: ierr } = await supabaseAdmin.from('order_items').insert(itemsToInsert);
        if (ierr) {
          // Rollback order
          await supabaseAdmin.from('orders').delete().eq('id', order.id);
          return json({ error: ierr.message }, 500);
        }

        return json({ order_id: order.id, order_number: order.order_number, status: 'open', subtotal, tax, total }, 201);
      },
    },
  },
});
