import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer, PageHeader } from "@/components/page";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/employees")({
  head: () => ({ meta: [{ title: "Employees" }] }),
  component: Page,
});

const ROLES = ["admin", "cashier", "waiter"] as const;

function Page() {
  const [rows, setRows] = useState<any[]>([]);

  async function load() {
    const [profiles, roles] = await Promise.all([
      supabase.from("profiles").select("id, full_name, created_at"),
      supabase.from("user_roles").select("user_id, role, id"),
    ]);
    const byUser = new Map<string, string[]>();
    const idByRole = new Map<string, string>();
    (roles.data ?? []).forEach((r) => {
      byUser.set(r.user_id, [...(byUser.get(r.user_id) ?? []), r.role]);
      idByRole.set(`${r.user_id}:${r.role}`, r.id);
    });
    setRows((profiles.data ?? []).map((p) => ({ ...p, roles: byUser.get(p.id) ?? [] })));
  }
  useEffect(() => { load(); }, []);

  async function setRole(userId: string, currentRoles: string[], newRole: string) {
    // Remove existing roles then add the new one (single role model)
    if (currentRoles.length) {
      await supabase.from("user_roles").delete().eq("user_id", userId);
    }
    const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: newRole as "admin" | "cashier" | "waiter" });
    if (error) return toast.error(error.message);
    toast.success("Role updated");
    load();
  }

  return (
    <PageContainer>
      <PageHeader title="Employees" subtitle="Users who have signed in. Assign a role: admin, cashier, or waiter." />
      <Card>
        <Table>
          <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Since</TableHead><TableHead>Role</TableHead><TableHead className="w-40" /></TableRow></TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.full_name}</TableCell>
                <TableCell>{new Date(r.created_at).toLocaleDateString()}</TableCell>
                <TableCell><span className="text-xs bg-secondary px-2 py-0.5 rounded">{r.roles[0] ?? "—"}</span></TableCell>
                <TableCell>
                  <Select onValueChange={(v) => setRole(r.id, r.roles, v)}>
                    <SelectTrigger className="h-8"><SelectValue placeholder="Set role" /></SelectTrigger>
                    <SelectContent>{ROLES.map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent>
                  </Select>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
      <p className="text-xs text-muted-foreground mt-3">To add a new employee, ask them to sign up at the sign-in page, then assign their role here.</p>
    </PageContainer>
  );
}
