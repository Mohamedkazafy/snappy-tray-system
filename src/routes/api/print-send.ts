import { createFileRoute } from "@tanstack/react-router";
import { json } from "@/lib/api-token.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getUserFromAuthHeader } from "@/lib/auth-utils.server";

export const Route = createFileRoute("/api/print-send")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: any;
        try { body = await request.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }
        const auth = await getUserFromAuthHeader(request.headers.get('authorization'));
        if (!auth || !auth.userId) return json({ error: 'Unauthorized' }, 401);

        // Find tenant for this owner
        const t = await supabaseAdmin.from('tenants').select('id').eq('owner_id', auth.userId).limit(1).maybeSingle();
        const tenantId = t.data?.id ?? null;
        if (!tenantId) return json({ error: 'Tenant not found' }, 404);

        // Fetch printer (either specified or pick first)
        let printer: any = null;
        if (body.printer_id) {
          const { data } = await supabaseAdmin.from('printers').select('*').eq('id', body.printer_id).limit(1).maybeSingle();
          printer = data ?? null;
        } else {
          const { data } = await supabaseAdmin.from('printers').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: true }).limit(1);
          printer = (data && data[0]) || null;
        }

        if (!printer) return json({ error: 'No printer configured' }, 400);
        const content = body.content || '';

        if (printer.type === 'browser') {
          // Browser printers cannot be reached server-side. Return print HTML for client to open.
          return json({ method: 'browser', html: content }, 200);
        }

        if (printer.type === 'network') {
          if (!printer.network_address) return json({ error: 'Printer has no network address' }, 400);
                  // If the tenant stored a raw print port or the client asked for raw, attempt raw socket (ESC/POS) to port 9100 or provided port
                  const isRaw = !!(body.raw === true || printer.raw === true || printer.raw_port);
                  if (isRaw) {
                    // Try to send raw bytes via TCP socket to port (default 9100)
                    try {
                      // Resolve host and port
                      let host = printer.network_address;
                      let port = 9100;
                      if (host.includes(':')) {
                        const parts = host.split(':');
                        host = parts[0];
                        port = Number(parts[1]) || port;
                      } else if (printer.raw_port) {
                        port = Number(printer.raw_port) || port;
                      }

                      // Support base64 payload for binary data
                      let buf: Uint8Array;
                      if (body.content_base64) {
                        const b = Buffer.from(body.content_base64, 'base64');
                        buf = Uint8Array.from(b);
                      } else {
                        // convert html/text to buffer
                        const b = Buffer.from(String(content), 'utf8');
                        buf = Uint8Array.from(b);
                      }

                      // Use Node 'net' to open socket
                      const net = await import('net');
                      await new Promise((resolve, reject) => {
                        const socket = net.createConnection({ host, port }, () => {
                          socket.write(Buffer.from(buf));
                          socket.end();
                        });
                        socket.on('error', (err: any) => reject(err));
                        socket.on('close', () => resolve(undefined));
                      });

                      return json({ success: true, method: 'raw' }, 200);
                    } catch (e: any) {
                      return json({ error: 'Raw socket error', message: e?.message ?? String(e) }, 502);
                    }
                  }

                  try {
                    const url = (printer.network_address.startsWith('http') ? printer.network_address : `http://${printer.network_address}`);
                    // Attempt simple POST; many network print adapters expose an HTTP endpoint. This is a best-effort.
                    const resp = await fetch(url, { method: 'POST', body: content, headers: { 'content-type': 'text/html' } });
                    if (!resp.ok) return json({ error: 'Printer request failed', status: resp.status }, 502);
                    return json({ success: true }, 200);
                  } catch (e: any) {
                    return json({ error: 'Network error', message: e.message ?? String(e) }, 502);
                  }
                }

        // USB/other: not supported server-side
        return json({ error: 'Printer type not supported server-side' }, 400);
      }
    }
  }
});
