import { createFileRoute } from "@tanstack/react-router";
import { json } from "@/lib/api-token.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getUserFromAuthHeader } from "@/lib/auth-utils.server";

export const Route = createFileRoute("/api/create-payment")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: any;
        try { body = await request.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }
        const auth = await getUserFromAuthHeader(request.headers.get('authorization'));
        if (!auth || !auth.userId) return json({ error: 'Unauthorized' }, 401);

        const tenantId = body.tenant_id ?? (await supabaseAdmin.from('tenants').select('id').eq('owner_id', auth.userId).limit(1).maybeSingle()).data?.id;
        if (!tenantId) return json({ error: 'Tenant not found' }, 404);

        const plan: string = (body.plan_type ?? 'BASIC').toUpperCase();
        const amount: number = Number(body.amount ?? (plan === 'BASIC' ? 499 : plan === 'PRO' ? 799 : 1299));
        const months: number = Number(body.period_months ?? 1);

        const { data: invoice, error } = await supabaseAdmin.from('invoices').insert({ tenant_id: tenantId, plan_type: plan, amount, currency: 'EGP', period_months: months, status: 'pending', provider: 'local' }).select('*').single();
        if (error || !invoice) return json({ error: error?.message ?? 'Could not create invoice' }, 500);

        const token = encodeURIComponent(invoice.id + '::' + (Math.random().toString(36).slice(2)));
        const paymentUrl = `${process.env.BILLING_BASE_URL ?? ''}/payments/checkout?invoice_id=${invoice.id}&token=${token}`;

        return json({ invoice_id: invoice.id, payment_url: paymentUrl }, 201);
      }
    }
  }
});
