import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Role } from "@/lib/types";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export const PAGES = [
  "dashboard",
  "pos",
  "products",
  "categories",
  "brands",
  "inventory",
  "purchases",
  "suppliers",
  "customers",
  "sales",
  "returns",
  "expenses",
  "offers",
  "employees",
  "reports",
  "settings",
] as const;

export type PageKey = (typeof PAGES)[number];

export const ROLE_ACCESS: Record<Role, PageKey[]> = {
  Admin: [...PAGES],
  "Shop Owner": [...PAGES],
  Manager: [
    "dashboard",
    "pos",
    "products",
    "categories",
    "brands",
    "inventory",
    "purchases",
    "suppliers",
    "customers",
    "sales",
    "returns",
    "expenses",
    "offers",
    "reports",
  ],
  Cashier: ["dashboard", "pos", "products", "customers", "sales", "returns"],
  "Inventory Staff": [
    "dashboard",
    "products",
    "categories",
    "brands",
    "inventory",
    "purchases",
    "suppliers",
    "reports",
  ],
  Accountant: [
    "dashboard",
    "sales",
    "returns",
    "expenses",
    "purchases",
    "suppliers",
    "customers",
    "reports",
  ],
};

interface AuthState {
  user: SessionUser | null;
  login: (user: SessionUser) => void;
  logout: () => void;
}

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      login: (user) => set({ user }),
      logout: () => set({ user: null }),
    }),
    { name: "sgpos-auth" },
  ),
);

export const canAccess = (role: Role | undefined, page: PageKey) =>
  !!role && ROLE_ACCESS[role].includes(page);
