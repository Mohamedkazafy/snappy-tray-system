import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer, PageHeader } from "@/components/page";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/tenants")({
  head: () => ({ meta: [{ title: "Tenants — Admin" }] }),
  component: Page,
});

function Page() {
  const [tenants, setTenants] = useState<any[]>([]);
  const [name, setName] = useState("");

  useEffect(() => { load(); }, []);

  async function load() {
    const { data } = await supabase.from('tenants').select('*').order('created_at', { ascending: false });
    setTenants((data ?? []) as any);
  }

  async function createTenant() {
    if (!name.trim()) return toast.error('Enter tenant/restaurant name');
    const { data: user } = await supabase.auth.getUser();
    const trialEnds = new Date();
    trialEnds.setDate(trialEnds.getDate() + 30);
    const { error } = await supabase.from('tenants').insert({
      name: name.trim(), owner_id: user.user?.id, trial_ends_at: trialEnds.toISOString(), status: 'TRIAL', plan_type: 'BASIC'
    });
    if (error) return toast.error(error.message);
    toast.success('Tenant created with 30-day trial');
    setName('');
    load();
  }

  async function changePlan(id: string) {
    const newPlan = prompt('Enter new plan (BASIC, PRO, ENTERPRISE)')?.toUpperCase();
    if (!newPlan) return;
    if (!['BASIC','PRO','ENTERPRISE'].includes(newPlan)) return toast.error('Invalid plan');
    const { error } = await supabase.from('tenants').update({ plan_type: newPlan }).eq('id', id);
    if (error) return toast.error(error.message);
    toast.success('Plan updated');
    load();
  }

  async function extendTrial(id: string) {
    const days = Number(prompt('Extend by how many days?', '30'));
    if (!days || days <= 0) return;
    const { data } = await supabase.from('tenants').select('trial_ends_at').eq('id', id).limit(1).maybeSingle();
    let current = data?.trial_ends_at ? new Date(data.trial_ends_at) : new Date();
    current.setDate(current.getDate() + days);
    const { error } = await supabase.from('tenants').update({ trial_ends_at: current.toISOString(), status: 'TRIAL' }).eq('id', id);
    if (error) return toast.error(error.message);
    toast.success('Trial extended');
    load();
  }

  return (
    <PageContainer>
      <PageHeader title="Tenants" subtitle="Manage registered restaurants and subscriptions" />

      <Card className="p-4 max-w-3xl space-y-4">
        <div className="grid grid-cols-3 gap-2">
          <Input placeholder="Restaurant name" value={name} onChange={(e) => setName(e.target.value)} />
          <div />
          <Button onClick={createTenant}>Create tenant (30-day trial)</Button>
        </div>

        <div className="mt-4">
          {tenants.length === 0 && <div>No tenants</div>}
          {tenants.map((t) => (
            <div key={t.id} className="p-3 border rounded mb-2 flex justify-between items-center">
              <div>
                <div className="font-medium">{t.name}</div>
                <div className="text-sm text-muted-foreground">Plan: {t.plan_type} · Status: {t.status} · Trial ends: {t.trial_ends_at ? new Date(t.trial_ends_at).toLocaleString() : '—'}</div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => changePlan(t.id)}>Change Plan</Button>
                <Button size="sm" onClick={() => extendTrial(t.id)}>Extend Trial</Button>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </PageContainer>
  );
}
