import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer, PageHeader } from "@/components/page";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Copy, Key, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings" }] }),
  component: Page,
});

type ApiToken = { id: string; name: string; token_prefix: string; created_at: string; last_used_at: string | null; revoked_at: string | null };

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function randomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
  return `sk_live_${hex}`;
}

function Page() {
  const [s, setS] = useState<any>(null);
  const [tokens, setTokens] = useState<ApiToken[]>([]);
  const [newName, setNewName] = useState("");
  const [justCreated, setJustCreated] = useState<string | null>(null);
  const [baseUrl, setBaseUrl] = useState("");

  useEffect(() => {
    supabase.from("settings").select("*").eq("id", 1).single().then(({ data }) => setS(data));
    loadTokens();
    if (typeof window !== "undefined") setBaseUrl(window.location.origin);
  }, []);

  async function loadTokens() {
    const { data } = await supabase
      .from("api_tokens")
      .select("id,name,token_prefix,created_at,last_used_at,revoked_at")
      .order("created_at", { ascending: false });
    setTokens((data ?? []) as any);
  }

  async function save() {
    const { error } = await supabase.from("settings").update({
      restaurant_name: s.restaurant_name,
      currency: s.currency,
      default_tax_rate: s.default_tax_rate,
      business_day_start: s.business_day_start,
      business_day_end: s.business_day_end,
    }).eq("id", 1);
    if (error) return toast.error(error.message);
    toast.success("Settings saved");
  }

  async function createToken() {
    if (!newName.trim()) return toast.error("Give the token a name (e.g. \"WhatsApp bot\")");
    const token = randomToken();
    const hash = await sha256Hex(token);
    const { data: user } = await supabase.auth.getUser();
    const { error } = await supabase.from("api_tokens").insert({
      name: newName.trim(),
      token_hash: hash,
      token_prefix: token.slice(0, 12),
      created_by: user.user?.id,
    });
    if (error) return toast.error(error.message);
    setJustCreated(token);
    setNewName("");
    loadTokens();
  }

  async function revoke(id: string) {
    if (!confirm("Revoke this token? Any integration using it will stop working.")) return;
    const { error } = await supabase.from("api_tokens").update({ revoked_at: new Date().toISOString() }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Token revoked");
    loadTokens();
  }

  function copy(text: string) {
    navigator.clipboard.writeText(text);
    toast.success("Copied");
  }

  if (!s) return <PageContainer><p>Loading…</p></PageContainer>;

  return (
    <PageContainer>
      <PageHeader title="Settings" subtitle="Restaurant info, currency, tax, business day, and integrations" />

      <Card className="p-6 max-w-2xl space-y-4">
        <div><Label>Restaurant name</Label><Input value={s.restaurant_name} onChange={(e) => setS({ ...s, restaurant_name: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Currency</Label>
            <Select value={s.currency} onValueChange={(v) => setS({ ...s, currency: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["USD","EUR","GBP","AED","SAR","EGP","JPY","INR","CAD","AUD"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Default tax rate %</Label><Input type="number" step="0.01" value={s.default_tax_rate} onChange={(e) => setS({ ...s, default_tax_rate: Number(e.target.value) })} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Business day start</Label><Input type="time" value={s.business_day_start} onChange={(e) => setS({ ...s, business_day_start: e.target.value })} /></div>
          <div><Label>Business day end</Label><Input type="time" value={s.business_day_end} onChange={(e) => setS({ ...s, business_day_end: e.target.value })} /></div>
        </div>
        <div className="text-right"><Button onClick={save}>Save</Button></div>
      </Card>

      <Card className="p-6 max-w-3xl mt-6 space-y-4">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2"><Key className="w-4 h-4" /> AI Chatbot API Tokens</h2>
          <p className="text-sm text-muted-foreground">
            Create a secret token to let your AI chatbot securely read the menu and create Special Orders.
            The token is shown only once — copy it now and store it in the chatbot as <code>Bearer</code> auth.
          </p>
        </div>

        <div className="flex gap-2">
          <Input placeholder="Token name (e.g. WhatsApp bot)" value={newName} onChange={(e) => setNewName(e.target.value)} />
          <Button onClick={createToken}>Generate token</Button>
        </div>

        {justCreated && (
          <div className="rounded-md border border-primary/40 bg-primary/5 p-3 text-sm space-y-2">
            <div className="font-medium">New token — copy it now, it won't be shown again:</div>
            <div className="flex gap-2 items-center">
              <code className="flex-1 break-all bg-background rounded px-2 py-1 text-xs">{justCreated}</code>
              <Button size="sm" variant="outline" onClick={() => copy(justCreated)}><Copy className="w-3.5 h-3.5" /></Button>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setJustCreated(null)}>Dismiss</Button>
          </div>
        )}

        <div className="border rounded-md divide-y">
          {tokens.length === 0 && <div className="p-3 text-sm text-muted-foreground">No tokens yet.</div>}
          {tokens.map((t) => (
            <div key={t.id} className="p-3 flex items-center gap-3 text-sm">
              <div className="flex-1">
                <div className="font-medium">{t.name}</div>
                <div className="text-xs text-muted-foreground">
                  <code>{t.token_prefix}…</code> · created {new Date(t.created_at).toLocaleDateString()}
                  {t.last_used_at && ` · last used ${new Date(t.last_used_at).toLocaleDateString()}`}
                  {t.revoked_at && " · revoked"}
                </div>
              </div>
              {!t.revoked_at && (
                <Button size="sm" variant="ghost" onClick={() => revoke(t.id)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>
          ))}
        </div>

        <div className="text-xs text-muted-foreground space-y-2 border-t pt-3">
          <div className="font-medium text-foreground">API endpoints (base URL: <code>{baseUrl}</code>)</div>
          <div><code>GET  /api/public/agent/menu</code> — list ready-for-sale products with prices.</div>
          <div><code>POST /api/public/agent/orders</code> — create a Special Order for the customer.</div>
          <div>Send the token in the <code>Authorization: Bearer &lt;token&gt;</code> header.</div>
        </div>
      </Card>
    </PageContainer>
  );
}
