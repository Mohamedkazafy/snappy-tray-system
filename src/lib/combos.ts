import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Combo = Tables<"combos">;
export type ComboItem = Tables<"combo_items">;

export type ComboWithItems = Combo & {
  combo_items: Array<ComboItem & { product: Pick<Tables<"products">, "id" | "name" | "price"> | null }>;
};

export type ComboItemInput = Pick<ComboItem, "product_id" | "quantity">;

export async function fetchTenantCombos(tenantId: string): Promise<ComboWithItems[]> {
  const { data, error } = await supabase
    .from("combos")
    .select("*, combo_items(*, product:products(id,name,price))")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as ComboWithItems[];
}

export async function fetchTenantIdForCurrentUser(): Promise<string> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) throw new Error("You must be signed in to manage combos.");

  const { data, error } = await supabase
    .from("tenants")
    .select("id")
    .eq("owner_id", userData.user.id)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("No tenant is associated with this account.");
  return data.id;
}

export async function saveCombo(
  tenantId: string,
  combo: Pick<Combo, "name" | "description" | "price" | "image_url" | "is_available">,
  items: ComboItemInput[],
  comboId?: string,
): Promise<void> {
  if (items.length < 2) throw new Error("A combo must contain at least two products.");
  if (!Number.isFinite(combo.price) || combo.price < 0) throw new Error("Combo price must be a valid non-negative number.");

  const payload = { ...combo, tenant_id: tenantId };
  const { data, error } = comboId
    ? await supabase.from("combos").update(payload).eq("id", comboId).select("id").single()
    : await supabase.from("combos").insert(payload).select("id").single();
  if (error) throw error;

  await supabase.from("combo_items").delete().eq("combo_id", comboId ?? data.id);
  const { error: itemError } = await supabase.from("combo_items").insert(
    items.map((item) => ({ combo_id: comboId ?? data.id, ...item })),
  );
  if (itemError) throw itemError;
}
