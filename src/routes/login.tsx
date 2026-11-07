import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { ShoppingBasket, LogIn, Loader2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { initDb } from "@/lib/db";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { loadSessionUser } from "@/lib/account";
import { markEverythingDirty, syncNow } from "@/lib/sync";
import { useAuth } from "@/store/auth";
import { useHydrated } from "@/hooks/use-hydrated";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — G.K Mart" },
      { name: "description", content: "Sign in to G.K Mart billing software." },
      { property: "og:title", content: "Sign in — G.K Mart" },
      { property: "og:description", content: "Sign in to G.K Mart billing software." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const hydrated = useHydrated();
  const login = useAuth((s) => s.login);
  const user = useAuth((s) => s.user);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [backendMissing, setBackendMissing] = useState(false);

  useEffect(() => {
    void initDb();
  }, []);
  useEffect(() => {
    setBackendMissing(!supabase);
  }, []);
  useEffect(() => {
    if (hydrated && user) navigate({ to: "/" });
  }, [hydrated, user, navigate]);

  const finishSignIn = async () => {
    const session = await loadSessionUser();
    if (!session) {
      toast.error("This account is disabled. Ask the shop owner for access.");
      return;
    }
    login(session);
    await initDb();
    await markEverythingDirty();
    void syncNow();
    toast.success(`Welcome, ${session.name}`);
    navigate({ to: "/" });
  };

  // Finish sign-in after returning from Google
  useEffect(() => {
    if (!hydrated || user) return;
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) void finishSignIn();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  const googleSignIn = async () => {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: `${window.location.origin}/login`,
    });
    if (result.error) {
      toast.error("Google sign-in failed. Please retry.");
      return;
    }
    if (result.redirected) return;
    await finishSignIn();
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const client = supabase;
    if (!client) {
      toast.error("Online accounts aren't connected yet. Connect your Supabase project in project Settings, then try again.");
      return;
    }
    setLoading(true);
    try {
      if (mode === "signup") {
        const { data, error } = await client.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { name: name.trim() || email.split("@")[0] },
          },
        });
        if (error) {
          toast.error(error.message);
          return;
        }
        if (!data.session) {
          toast.success("Account created. Check your email to confirm, then sign in.");
          setMode("signin");
          return;
        }
        await finishSignIn();
        return;
      }

      const { error } = await client.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      await finishSignIn();
    } catch {
      toast.error("Could not sign in. Please retry.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between bg-sidebar p-10 text-sidebar-foreground lg:flex">
        <div className="flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground">
            <ShoppingBasket className="size-6" />
          </div>
          <div>
            <p className="text-lg font-bold">G.K Mart</p>
            <p className="text-xs text-sidebar-foreground/60">Billing • Inventory • GST</p>
          </div>
        </div>
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <h2 className="max-w-md text-4xl font-extrabold leading-tight">
            Bill faster. Track every rupee.
          </h2>
          <p className="mt-4 max-w-md text-sm text-sidebar-foreground/70">
            Offline-first grocery billing with GST invoices, barcode scanning, batch-wise
            inventory, loyalty points and business reports — now synced to your online account.
          </p>
        </motion.div>
        <p className="text-xs text-sidebar-foreground/50">
          Works offline · Syncs to your shop account when online
        </p>
      </div>

      <div className="flex items-center justify-center p-6">
        <Card className="card-elevated w-full max-w-md p-6">
          <h1 className="text-2xl font-bold">{mode === "signin" ? "Sign in" : "Create account"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "signin"
              ? "Use your shop account email and password."
              : ""}
          </p>
          {backendMissing && (
            <p className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              Offline mode: the online account service isn't connected yet. Connect your Supabase
              project in project Settings → External Supabase. Local billing data still works.
            </p>
          )}
          <form onSubmit={submit} className="mt-6 space-y-4">
            {mode === "signup" && (
              <div className="space-y-2">
                <Label htmlFor="name">Your name</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                required
                minLength={6}
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : mode === "signin" ? (
                <LogIn className="size-4" />
              ) : (
                <UserPlus className="size-4" />
              )}
              {mode === "signin" ? "Sign in" : "Create account"}
            </Button>
          </form>

          <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
          </div>
          <Button type="button" variant="outline" className="w-full" onClick={googleSignIn}>
            <svg aria-hidden="true" width="18" height="18" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.730-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"/><path fill="#34A853" d="M12 24c3.24 0 5.950-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"/><path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"/><path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.240 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"/></svg>
            Continue with Google
          </Button>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            {mode === "signin" ? "New here? " : "Already have an account? "}
            <button
              type="button"
              className="font-medium text-primary underline-offset-4 hover:underline"
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            >
              {mode === "signin" ? "Create account" : "Sign in"}
            </button>
          </p>
        </Card>
      </div>
    </div>
  );
}
