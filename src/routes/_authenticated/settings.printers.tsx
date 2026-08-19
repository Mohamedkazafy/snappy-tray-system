import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer, PageHeader } from "@/components/page";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings/printers")({
  head: () => ({ meta: [{ title: "Printers" }] }),
  component: Page,
});

function Page() {
  const [printers, setPrinters] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [type, setType] = useState<'network'|'usb'|'browser'>('network');
  const [networkAddress, setNetworkAddress] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    const user = await supabase.auth.getUser();
    const { data } = await supabase.from('tenants').select('id').eq('owner_id', user.data.user?.id).limit(1).maybeSingle();
    const tenantId = data?.id ?? null;
    if (!tenantId) return;
    const { data: ps } = await supabase.from('printers').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false });
    setPrinters(ps ?? []);
  }

  async function addPrinter() {
    const user = await supabase.auth.getUser();
    const { data } = await supabase.from('tenants').select('id').eq('owner_id', user.data.user?.id).limit(1).maybeSingle();
    const tenantId = data?.id ?? null;
    if (!tenantId) return toast.error('Tenant not found');
    const payload: any = { tenant_id: tenantId, name: name || 'Printer', type };
    if (type === 'network') payload.network_address = networkAddress || null;
    const { error } = await supabase.from('printers').insert(payload);
    if (error) return toast.error(error.message);
    toast.success('Printer added');
    setName(''); setNetworkAddress(''); setType('network');
    load();
  }

  async function testPrint(p: any) {
    // This is a client-side test print — real network printing will require a backend or local bridge.
    // For now we simply attempt an IP/Network probe for network printers (no real print), and show a sample KOT for browser printers.
    if (p.type === 'browser') {
      // Open a new window with a sample KOT
      const w = window.open('', '_blank');
      if (!w) return toast.error('Could not open new window');
      w.document.title = 'Test KOT';
      w.document.body.innerHTML = `<pre style="font-family: monospace; padding: 16px;">KITCHEN ORDER TICKET\n\nItem x2  Burger\nItem x1  Fries\n\nTable: 3\n</pre>`;
      return;
    }

    if (p.type === 'network') {
      // crude network check: attempt fetch to http(s)://address/ (needs CORS/public endpoint on printer adapter)
      try {
        const resp = await fetch((p.network_address?.startsWith('http') ? p.network_address : `http://${p.network_address}`) + '/', { method: 'GET' });
        if (resp.ok) toast.success('Printer reachable'); else toast.error('Printer not reachable: ' + resp.status);
      } catch (e: any) { toast.error('Network error: ' + (e.message ?? e)); }
      return;
    }

    toast.info('Test print not supported for this printer type yet');
  }

  return (
    <PageContainer>
      <PageHeader title="Printers" subtitle="Configure kitchen, bar, and cashier printers" />

      <Card className="p-4 max-w-3xl space-y-4">
        <div className="grid grid-cols-3 gap-2">
          <Input placeholder="Printer name (Kitchen, Bar)" value={name} onChange={(e) => setName(e.target.value)} />
          <Select value={type} onValueChange={(v) => setType(v as any)}>
            <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="network">Network (IP)</SelectItem>
              <SelectItem value="usb">USB / Browser</SelectItem>
              <SelectItem value="browser">Browser Direct Print</SelectItem>
            </SelectContent>
          </Select>
          <Input placeholder="IP / Address" value={networkAddress} onChange={(e) => setNetworkAddress(e.target.value)} />
        </div>
        <div className="text-right"><Button onClick={addPrinter}>Add printer</Button></div>

        <div>
          {printers.length === 0 && <div>No printers configured.</div>}
          {printers.map((p) => (
            <div key={p.id} className="p-3 border rounded mb-2 flex items-center justify-between">
              <div>
                <div className="font-medium">{p.name}</div>
                <div className="text-sm text-muted-foreground">{p.type} {p.network_address ? `· ${p.network_address}` : ''}</div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => testPrint(p)}>Test Print</Button>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </PageContainer>
  );
}
