Billing integration test & webhook simulation

Overview
- This repository includes a local billing flow for testing. It creates an invoice in the DB and returns a payment URL that opens a small local checkout page which simulates calling the payment gateway webhook.
- The webhook endpoint (/api/webhooks/payment) validates a simple signature and then marks invoice as paid, activates the tenant (sets status = 'ACTIVE', extends subscription_ends_at) and creates a subscriptions history row.

Environment
- Ensure these environment variables are set for server-side routes:
  - SUPABASE_URL
  - SUPABASE_PUBLISHABLE_KEY
  - SUPABASE_SERVICE_ROLE_KEY
  - PAYMENT_GATEWAY_SECRET (set to any secret string for webhook verification)
  - BILLING_BASE_URL (optional) e.g. https://your-host or leave empty to use same origin

Steps to test locally

1) Apply the migrations
- Run the SQL migrations in supabase/migrations, including:
  - 20260819121944_add_tenants_subscriptions_and_printers.sql
  - 20260819124500_add_billing_invoices.sql

2) Start the app (dev)
- Start the dev server as usual (bun run dev / your repo specific start). Ensure env vars above are present.

3) Create a tenant (admin)
- Login as admin and go to /_authenticated/admin/tenants and create a tenant (30-day trial).
- Note the tenant id.

4) Create invoice via UI
- Login as the tenant owner account and visit /_authenticated/settings/subscription.
- Click "Change / Pay". This calls POST /api/billing/create-payment which creates an invoice and returns a payment_url.
- The client will open the returned payment_url (which resolves to /payments/checkout?invoice_id=... on the same app by default).

5) Simulate payment
- On the Checkout page click "Simulate Pay (local gateway)". This triggers a POST to /api/webhooks/payment with header x-payment-signature: <SECRET>-local (our webhook code accepts that form for local testing) and payload { invoice_id, provider_payment_id, status: 'paid' }.
- If successful you will receive `ok: true` from webhook and the tenant will be activated.

6) Verify
- Check the invoices table — the invoice should show status = 'paid'.
- Check the tenants table — subscription_ends_at should be extended and status should be 'ACTIVE'.
- Check the subscriptions table — a row with status 'ACTIVE' must have been created.

Alternative manual webhook test (curl)
- Use the following curl command (replace placeholders):

  curl -X POST https://your-app.example.com/api/webhooks/payment \
    -H "Content-Type: application/json" \
    -H "x-payment-signature: ${PAYMENT_GATEWAY_SECRET}-local" \
    -d '{"invoice_id":"<INVOICE_ID>","provider_payment_id":"local_123","status":"paid"}'

- After this runs, verify DB tables as above.

Notes
- The local checkout page is only a development helper and should not be used in production.
- For production use integrate a real payment gateway (Paymob or Fawry are common in Egypt) and switch the webhook signature verification to HMAC-SHA256 or the provider's recommended method.
- The webhook handler currently accepts signature == PAYMENT_GATEWAY_SECRET || signature == PAYMENT_GATEWAY_SECRET + '-local'.

If you want, next steps:
- Integrate Paymob or Fawry skeleton with server-side token exchange and redirect flow.
- Add invoices UI (history, resend invoice, download receipt).
- Add webhooks signature verification using HMAC-SHA256 for production.
