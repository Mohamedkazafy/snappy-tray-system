import { createFileRoute } from "@tanstack/react-router";
import { json } from "@/lib/api-token.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { activateTenantPayment } from "@/lib/subscription";

export const Route = createFileRoute("/api/webhook-payment")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Validate signature
        const sig = request.headers.get('x-payment-signature') ?? '';
        const secret = process.env.PAYMENT_GATEWAY_SECRET ?? '';
        if (!sig || !secret) return json({ error: 'Missing signature or gateway secret' }, 400);
        // Very small HMAC-style check: expecting header to equal secret reversed or provided token for local gateway
        // In production use HMAC SHA256 verification
        if (sig !== secret && sig !== (secret + '-local')) {
          return json({ error: 'Invalid signature' }, 401);
        }

        let body: any;
        try { body = await request.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }

        // Expected body: { invoice_id: "...", provider_payment_id: "...", status: "paid" }
        const invoiceId = body?.invoice_id;
        const providerPaymentId = body?.provider_payment_id ?? null;
        const status = body?.status ?? 'paid';
        if (!invoiceId) return json({ error: 'Missing invoice_id' }, 400);

        // Lookup invoice
        const { data: inv } = await supabaseAdmin.from('invoices').select('*').eq('id', invoiceId).limit(1).maybeSingle();
        if (!inv) return json({ error: 'Invoice not found' }, 404);

        if (status === 'paid') {
          await supabaseAdmin.from('invoices').update({ status: 'paid', provider_payment_id: providerPaymentId }).eq('id', invoiceId);

          // Activate tenant subscription
          const months = Number(inv.period_months ?? 1);
          await activateTenantPayment(inv.tenant_id, inv.plan_type, months, { provider_payment_id: providerPaymentId, invoice_id: invoiceId });

          return json({ ok: true });
        } else {
          await supabaseAdmin.from('invoices').update({ status: 'failed', provider_payment_id: providerPaymentId }).eq('id', invoiceId);
          return json({ ok: false, status: 'failed' }, 200);
        }
      }
    }
  }
});
