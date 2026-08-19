import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type TenantRow = {
  id: string;
  name: string;
  owner_id: string;
  plan_type: 'BASIC'|'PRO'|'ENTERPRISE';
  status: 'TRIAL'|'ACTIVE'|'PAST_DUE'|'EXPIRED'|'SUSPENDED';
  trial_ends_at: string | null;
  subscription_ends_at: string | null;
  max_pos_terminals: number;
};

export async function getTenantForOwner(ownerId: string): Promise<TenantRow | null> {
  const { data } = await supabaseAdmin.from('tenants').select('*').eq('owner_id', ownerId).limit(1).maybeSingle();
  return (data as any) ?? null;
}

export async function getTenantById(tenantId: string): Promise<TenantRow | null> {
  const { data } = await supabaseAdmin.from('tenants').select('*').eq('id', tenantId).limit(1).maybeSingle();
  return (data as any) ?? null;
}

export async function checkSubscriptionStatusForTenant(tenant: TenantRow) {
  const now = new Date();
  // If trial expired, update status to EXPIRED
  if (tenant.status === 'TRIAL' && tenant.trial_ends_at) {
    const trialEnds = new Date(tenant.trial_ends_at);
    if (trialEnds.getTime() < now.getTime()) {
      await supabaseAdmin.from('tenants').update({ status: 'EXPIRED' }).eq('id', tenant.id);
      throw {
        status: 402,
        body: { error: 'SUBSCRIPTION_EXPIRED', message: 'Your trial or subscription has ended.' },
      };
    }
  }

  if (tenant.status === 'EXPIRED' || tenant.status === 'SUSPENDED') {
    throw {
      status: 402,
      body: { error: 'SUBSCRIPTION_EXPIRED', message: 'Your trial or subscription has ended.' },
    };
  }

  // Allowed otherwise
  return true;
}

export async function ensureTenantActiveForOwner(ownerId: string) {
  const t = await getTenantForOwner(ownerId);
  if (!t) return null;
  await checkSubscriptionStatusForTenant(t);
  return t;
}

export async function activateTenantPayment(tenantId: string, plan: TenantRow['plan_type'], periodMonths = 1, metadata: any = null) {
  // Activate tenant, extend subscription_ends_at by periodMonths and insert into subscriptions
  const now = new Date();
  const { data: current } = await supabaseAdmin.from('tenants').select('subscription_ends_at,max_pos_terminals').eq('id', tenantId).limit(1).maybeSingle();
  let currentEnds = current?.subscription_ends_at ? new Date(current.subscription_ends_at) : now;
  if (currentEnds.getTime() < now.getTime()) currentEnds = now;
  // extend
  const newEnds = new Date(currentEnds);
  newEnds.setMonth(newEnds.getMonth() + periodMonths);

  // Update max_pos_terminals for plan default (can be overridden later)
  const planMaxMap: Record<TenantRow['plan_type'], number> = { BASIC: 1, PRO: 9999, ENTERPRISE: 9999 };

  const updates: any = { status: 'ACTIVE', subscription_ends_at: newEnds.toISOString(), plan_type: plan, max_pos_terminals: planMaxMap[plan] };
  await supabaseAdmin.from('tenants').update(updates).eq('id', tenantId);

  await supabaseAdmin.from('subscriptions').insert({ tenant_id: tenantId, plan_type: plan, status: 'ACTIVE', started_at: now.toISOString(), ends_at: newEnds.toISOString(), metadata });

  return { subscription_ends_at: newEnds.toISOString() };
}
