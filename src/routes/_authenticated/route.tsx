import { createFileRoute, Outlet, redirect, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import {
  LayoutDashboard, ShoppingCart, Utensils, Package, Tags, CreditCard,
  Warehouse, Truck, Boxes, ClipboardList, Wallet, BarChart3, Settings, LogOut, Users, UtensilsCrossed, Menu, X, Bot
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { setLanguage } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: Shell,
});

type NavItem = { to: string; label: string; icon: any; admin?: boolean };
const nav: NavItem[] = [
  { to: "/pos", label: "POS", icon: ShoppingCart },
  { to: "/tables", label: "Tables", icon: Utensils },
  { to: "/special-orders", label: "Special Orders", icon: Bot },
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, admin: true },
  { to: "/products", label: "Products", icon: Package, admin: true },
  { to: "/categories", label: "Categories", icon: Tags, admin: true },
  { to: "/payment-methods", label: "Payments", icon: CreditCard, admin: true },
  { to: "/warehouses", label: "Warehouses", icon: Warehouse, admin: true },
  { to: "/suppliers", label: "Suppliers", icon: Truck, admin: true },
  { to: "/purchases", label: "Purchases", icon: ClipboardList, admin: true },
  { to: "/inventory", label: "Inventory", icon: Boxes, admin: true },
  { to: "/closing", label: "Day Closing", icon: Wallet, admin: true },
  { to: "/reports", label: "Reports", icon: BarChart3, admin: true },
  { to: "/employees", label: "Employees", icon: Users, admin: true },
  { to: "/settings", label: "Settings", icon: Settings, admin: true },
];

function Shell() {
  const { user, isAdmin, isWaiter, loading } = useSession();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const visible = nav.filter((n) => {
    if (isAdmin) return true;
    if (n.admin) return false;
    if (n.to === "/tables") return isWaiter || isAdmin;
    return true;
  });

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar */}
      <aside
        className={cn(
          "no-print fixed lg:static inset-y-0 left-0 z-40 w-64 bg-sidebar text-sidebar-foreground flex flex-col transition-transform lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="h-16 flex items-center gap-3 px-5 border-b border-sidebar-border">
          <div className="w-9 h-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
            <UtensilsCrossed className="w-5 h-5" />
          </div>
          <div className="leading-tight">
            <div className="font-semibold">Restaurant POS</div>
            <div className="text-xs text-sidebar-foreground/60">{user?.email}</div>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {loading ? (
            <div className="text-sm px-3 py-2 text-sidebar-foreground/60">Loading…</div>
          ) : (
            visible.map((n) => {
              const active = pathname === n.to || pathname.startsWith(n.to + "/");
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                    active
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                  )}
                >
                  <n.icon className="w-4 h-4" />
                  {n.label}
                </Link>
              );
            })
          )}
        </nav>
        <div className="p-3 border-t border-sidebar-border">
          <Button variant="ghost" onClick={signOut} className="w-full justify-start text-sidebar-foreground/80 hover:text-sidebar-accent-foreground hover:bg-sidebar-accent">
            <LogOut className="w-4 h-4 mr-2" /> Sign out
          </Button>
        </div>
      </aside>

      {open && (
        <div
          className="no-print fixed inset-0 bg-black/40 z-30 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="no-print h-14 border-b border-border bg-card flex items-center gap-3 px-4 lg:hidden">
          <Button variant="ghost" size="icon" onClick={() => setOpen(!open)}>
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
          <div className="font-semibold">Restaurant POS</div>
        </header>
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
