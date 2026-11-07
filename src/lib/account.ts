import { supabase } from "@/integrations/supabase/client";
import type { Role } from "./types";
import type { SessionUser } from "@/store/auth";

/** Loads the signed-in staff member's name and role from the cloud. */
export async function loadSessionUser(): Promise<SessionUser | null> {
  const client = supabase;
  if (!client) return null;
  const { data: auth } = await client.auth.getUser();
  const authUser = auth.user;
  if (!authUser) return null;

  const [{ data: profile }, { data: roles }] = await Promise.all([
    client.from("profiles").select("name, email, active").eq("id", authUser.id).maybeSingle(),
    client.from("user_roles").select("role").eq("user_id", authUser.id),
  ]);

  if (profile && profile.active === false) {
    await client.auth.signOut();
    return null;
  }

  const role = (roles?.[0]?.role ?? "Cashier") as Role;
  return {
    id: authUser.id,
    name: profile?.name || authUser.email?.split("@")[0] || "Staff",
    email: profile?.email || authUser.email || "",
    role,
  };
}
