import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer, PageHeader } from "@/components/page";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/settings/subscription")({
  head: () => ({ meta: [{ title: "Subscription" }] }),
  component: Page,
});

function Page() {
  const [tenant, setTenant] = useState<any | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    const user = await supabase.auth.getUser();
    if (!user.data.user) return;
    const { data } = await supabase.from('tenants').select('*').eq('owner_id', user.data.user.id).limit(1).maybeSingle();
    setTenant(data ?? null);
  }

  if (!tenant) return (
    <PageContainer>
      <PageHeader title="Subscription" subtitle="No subscription information found" />
      <Card className="p-4">No tenant associated with this account.</Card>
    </PageContainer>
  );

  const daysRemaining = tenant.subscription_ends_at ? Math.ceil((new Date(tenant.subscription_ends_at).getTime() - Date.now()) / (1000*60*60*24)) : (tenant.trial_ends_at ? Math.ceil((new Date(tenant.trial_ends_at).getTime() - Date.now()) / (1000*60*60*24)) : null);

  return (
    <PageContainer>
      <PageHeader title="Subscription" subtitle="Manage your subscription and plan" />

      <Card className="p-6 max-w-2xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-muted-foreground">Current plan</div>
            <div className="text-lg font-semibold">{tenant.plan_type} <span className="text-sm text-muted-foreground">· {tenant.status}</span></div>
            {daysRemaining !== null && <div className="text-sm text-muted-foreground">{daysRemaining} days remaining</div>}
          </div>
          <div>
            <Button onClick={async () => {
              // Create a payment invoice and open payment URL
              const token = (await supabase.auth.getSession())?.data?.session?.access_token;
              const payload = { plan_type: tenant.plan_type, amount: tenant.plan_type === 'BASIC' ? 499 : tenant.plan_type === 'PRO' ? 799 : 1299, period_months: 1 };
              const resp = await fetch('/api/billing/create-payment', { method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(payload) });
              const data = await resp.json();
              if (!resp.ok) return alert('Could not create payment: ' + (data?.error ?? 'unknown'));
              // Open payment URL in new tab; for local gateway this may be a local page that simulates payment
              window.open(data.payment_url, '_blank');
              alert('Opened payment window. After completing payment, the webhook will activate your subscription.');
            }}>Change / Pay</Button>
          </div>
        </div>

        <div>
          <h3 className="font-medium">Pricing</h3>
          <div className="grid grid-cols-3 gap-3 mt-3">
            <div className="p-3 border rounded">
              <div className="font-semibold">Basic</div>
              <div className="text-muted-foreground">499 EGP / mo</div>
              <div className="text-sm mt-2">Single POS, Sales Management, Daily Reports</div>
            </div>
            <div className="p-3 border rounded">
              <div className="font-semibold">Pro <span className="text-sm text-muted-foreground">(Recommended)</span></div>
              <div className="text-muted-foreground">799 EGP / mo</div>
              <div className="text-sm mt-2">Unlimited POS, Inventory & Waste, Profit Reports</div>
            </div>
            <div className="p-3 border rounded">
              <div className="font-semibold">Enterprise</div>
              <div className="text-muted-foreground">1299 EGP / mo</div>
              <div className="text-sm mt-2">Multi-branch, Dedicated Support, Integrations</div>
            </div>
          </div>
        </div>
      </Card>
    </PageContainer>
  );
}
