import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState, type ReactNode } from "react";
import {
  LayoutDashboard,
  ScanBarcode,
  Package,
  Shapes,
  Tags,
  Boxes,
  Truck,
  Users,
  UserRound,
  ReceiptText,
  Undo2,
  Wallet,
  Settings2,
  LogOut,
  PanelLeftClose,
  PanelLeft,
  Moon,
  Sun,
  Wifi,
  WifiOff,
  ShoppingBasket,
  Bell,
  RefreshCw,
} from "lucide-react";
import { useUI } from "@/store/ui";
import { canAccess, useAuth, type PageKey } from "@/store/auth";
import { useHydrated, useOnline } from "@/hooks/use-hydrated";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader } from "@/components/common/states";
import { getDb, initDb } from "@/lib/db";
import { supabase } from "@/integrations/supabase/client";
import { loadSessionUser } from "@/lib/account";
import {
  getSyncState,
  registerSyncHooks,
  resetSyncState,
  startSyncLoop,
  subscribeSync,
  syncNow,
} from "@/lib/sync";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

export const NAV: { key: PageKey; label: string; to: string; icon: typeof Package }[] = [
  { key: "dashboard", label: "Dashboard", to: "/", icon: LayoutDashboard },
  { key: "pos", label: "POS Billing", to: "/pos", icon: ScanBarcode },
  { key: "products", label: "Products", to: "/products", icon: Package },
  { key: "categories", label: "Categories", to: "/categories", icon: Shapes },
  { key: "brands", label: "Brands", to: "/brands", icon: Tags },
  { key: "inventory", label: "Inventory", to: "/inventory", icon: Boxes },
  { key: "purchases", label: "Purchases", to: "/purchases", icon: Truck },
  { key: "suppliers", label: "Suppliers", to: "/suppliers", icon: Users },
  { key: "customers", label: "Customers", to: "/customers", icon: UserRound },
  { key: "sales", label: "Sales History", to: "/sales", icon: ReceiptText },
  { key: "returns", label: "Sales Returns", to: "/returns", icon: Undo2 },
  { key: "expenses", label: "Expenses", to: "/expenses", icon: Wallet },
  { key: "employees", label: "Employees", to: "/employees", icon: Users },
  { key: "settings", label: "Bill Settings", to: "/settings", icon: Settings2 },
];

function NavList({ onNavigate, collapsed }: { onNavigate?: () => void; collapsed?: boolean }) {
  const role = useAuth((s) => s.user?.role);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="flex flex-col gap-1 px-2 py-3">
      {NAV.filter((n) => canAccess(role, n.key)).map((item) => {
        const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            title={item.label}
            className={cn(
              "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-sidebar-primary text-sidebar-primary-foreground"
                : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            )}
          >
            <item.icon className="size-4.5 shrink-0" />
            {!collapsed && <span className="truncate">{item.label}</span>}
          </Link>
        );
      })}
    </nav>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const hydrated = useHydrated();
  const online = useOnline();
  const { theme, toggleTheme, sidebarCollapsed, toggleSidebar } = useUI();
  const { user, login, logout } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const [sync, setSync] = useState(getSyncState());
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  useEffect(() => {
    void (async () => {
      await initDb();
      registerSyncHooks(getDb());
      startSyncLoop();
    })();
    const unsubscribe = subscribeSync(() => setSync({ ...getSyncState() }));
    return () => {
      unsubscribe();
    };
  }, []);

  // Keep the local session in step with the cloud account.
  useEffect(() => {
    if (!hydrated) return;
    void (async () => {
      try {
        const session = await loadSessionUser();
        if (session) login(session);
        else logout();
      } finally {
        setChecked(true);
      }
    })();
    const client = supabase;
    if (!client) return;
    const { data } = client.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") logout();
    });
    return () => data.subscription.unsubscribe();
  }, [hydrated, login, logout]);

  useEffect(() => {
    if (hydrated && checked && !user) navigate({ to: "/login" });
  }, [hydrated, checked, user, navigate]);

  const signOut = async () => {
    const client = supabase;
    if (client) {
      await syncNow();
      await client.auth.signOut();
    }
    resetSyncState();
    logout();
    navigate({ to: "/login" });
  };

  if (!hydrated || (!checked && !user)) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <Loader label="Starting G.K Mart..." />
      </div>
    );
  }
  if (!user) return null;

  const activeNav = NAV.find((n) =>
    n.to === "/" ? pathname === "/" : pathname.startsWith(n.to),
  );
  const allowed = !activeNav || canAccess(user.role, activeNav.key);

  return (
    <div className="flex min-h-screen w-full bg-background">
      <aside
        className={cn(
          "sticky top-0 hidden h-screen shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-all duration-300 lg:flex",
          sidebarCollapsed ? "w-[72px]" : "w-64",
        )}
      >
        <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-4">
          <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground">
            <ShoppingBasket className="size-5" />
          </div>
          {!sidebarCollapsed && (
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-sidebar-foreground">G.K Mart</p>
              <p className="truncate text-[11px] text-sidebar-foreground/60">POS & Billing</p>
            </div>
          )}
        </div>
        <div className="scroll-thin flex-1 overflow-y-auto">
          <NavList collapsed={sidebarCollapsed} />
        </div>
        <div className="border-t border-sidebar-border p-2">
          <button
            onClick={() => {
              void signOut();
            }}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground/80 transition-colors hover:bg-destructive/20 hover:text-sidebar-foreground"
          >
            <LogOut className="size-4.5 shrink-0" />
            {!sidebarCollapsed && "Logout"}
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-card/90 px-3 backdrop-blur sm:px-5">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden">
                <PanelLeft className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 border-sidebar-border bg-sidebar p-0">
              <SheetTitle className="flex h-16 items-center gap-2 border-b border-sidebar-border px-4 text-sidebar-foreground">
                <ShoppingBasket className="size-5 text-sidebar-primary" /> G.K Mart
              </SheetTitle>
              <div className="scroll-thin h-[calc(100vh-4rem)] overflow-y-auto">
                <NavList />
              </div>
            </SheetContent>
          </Sheet>

          <Button
            variant="ghost"
            size="icon"
            className="hidden lg:inline-flex"
            onClick={toggleSidebar}
          >
            {sidebarCollapsed ? (
              <PanelLeft className="size-5" />
            ) : (
              <PanelLeftClose className="size-5" />
            )}
          </Button>

          <h1 className="min-w-0 flex-1 truncate text-base font-semibold sm:text-lg">
            {activeNav?.label ?? "G.K Mart"}
          </h1>

          <Badge
            variant="outline"
            className={cn(
              "hidden gap-1.5 sm:inline-flex",
              online
                ? "border-success/40 text-success"
                : "border-destructive/40 text-destructive",
            )}
          >
            {online ? <Wifi className="size-3.5" /> : <WifiOff className="size-3.5" />}
            {online ? "Online" : "Offline"}
          </Badge>

          <Badge
            variant="outline"
            title="Cloud sync"
            className="hidden gap-1.5 md:inline-flex"
            onClick={() => void syncNow()}
          >
            <RefreshCw className={cn("size-3.5", sync.status === "syncing" && "animate-spin")} />
            {sync.status === "syncing"
              ? "Syncing"
              : sync.pending > 0
                ? `${sync.pending} to sync`
                : sync.status === "error"
                  ? "Sync failed"
                  : "Synced"}
          </Badge>

          <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Toggle theme">
            {theme === "dark" ? <Sun className="size-5" /> : <Moon className="size-5" />}
          </Button>
          <Button variant="ghost" size="icon" asChild aria-label="Alerts">
            <Link to="/inventory">
              <Bell className="size-5" />
            </Link>
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="gap-2 px-2">
                <span className="grid size-8 place-items-center rounded-full bg-primary/12 text-sm font-bold text-primary">
                  {user.name.charAt(0)}
                </span>
                <span className="hidden text-left sm:block">
                  <span className="block text-xs font-semibold leading-tight">{user.name}</span>
                  <span className="block text-[11px] leading-tight text-muted-foreground">
                    {user.role}
                  </span>
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel>{user.email}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => void signOut()}>
                <LogOut className="size-4" /> Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        <main className="min-w-0 flex-1">
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              {allowed ? (
                children
              ) : (
                <div className="grid min-h-[60vh] place-items-center px-4 text-center">
                  <div>
                    <p className="text-2xl font-bold">Access denied</p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Your role ({user.role}) cannot open this page.
                    </p>
                    <Button className="mt-4" onClick={() => navigate({ to: "/" })}>
                      Back to dashboard
                    </Button>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

export function PageBody({ children }: { children: ReactNode }) {
  return <div className="space-y-5 p-4 sm:p-6">{children}</div>;
}
