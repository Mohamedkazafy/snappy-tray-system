import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/payments_checkout")({
  head: () => ({ meta: [{ title: "Payment Checkout" }] }),
  component: Page,
});

function Page() {
  const [invoiceId, setInvoiceId] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setInvoiceId(params.get('invoice_id'));
    setToken(params.get('token'));
  }, []);

  async function doPay() {
    if (!invoiceId) return alert('Missing invoice_id');
    setBusy(true);
    try {
      const secret = (window as any).__PAYMENT_SECRET_OVERRIDE || '';
      const sig = secret ? (secret + '-local') : 'local-test-signature';
      const resp = await fetch('/api/webhooks/payment', { method: 'POST', headers: { 'content-type': 'application/json', 'x-payment-signature': sig }, body: JSON.stringify({ invoice_id: invoiceId, provider_payment_id: 'local_' + Math.random().toString(36).slice(2), status: 'paid' }) });
      const data = await resp.json();
      if (resp.ok && data.ok) {
        alert('Payment simulated. Subscription should be activated.');
      } else {
        alert('Payment failed: ' + JSON.stringify(data));
      }
    } catch (e: any) { alert('Error: ' + (e.message ?? e)); }
    finally { setBusy(false); }
  }

  return (
    <div style={{ padding: 24 }}>
      <h1>Payment checkout</h1>
      <p>Invoice: {invoiceId}</p>
      <p>Token: {token}</p>
      <div style={{ marginTop: 16 }}>
        <button onClick={doPay} disabled={busy}>{busy ? 'Processing…' : 'Simulate Pay (local gateway)'}</button>
      </div>
      <p style={{ marginTop: 12, color: '#666' }}>This is a local testing checkout that triggers the webhook to mark invoice paid.</p>
    </div>
  );
}
