import { supabase } from "@/integrations/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getDb, type GroceryDB } from "./db";

/** Dexie tables mirrored to the cloud. */
export const SYNC_ENTITIES = [
  "products",
  "categories",
  "brands",
  "suppliers",
  "customers",
  "sales",
  "heldBills",
  "purchases",
  "supplierPayments",
  "stockMovements",
  "returns",
  "expenses",
  "offers",
  "employees",
  "activity",
  "settings",
] as const;

export type SyncEntity = (typeof SYNC_ENTITIES)[number];

const DIRTY_KEY = "sgpos-dirty";
const CURSOR_KEY = "sgpos-sync-cursor";

type DirtyMap = Record<string, Record<string, "u" | "d">>;

let applyingRemote = false;
let hooksReady = false;
let running = false;

const listeners = new Set<() => void>();
let state: { status: "idle" | "syncing" | "error"; last: string | null; pending: number } = {
  status: "idle",
  last: null,
  pending: 0,
};

export function getSyncState() {
  return state;
}

export function subscribeSync(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function setState(patch: Partial<typeof state>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

function readDirty(): DirtyMap {
  if (typeof localStorage === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(DIRTY_KEY) ?? "{}") as DirtyMap;
  } catch {
    return {};
  }
}

function writeDirty(map: DirtyMap) {
  localStorage.setItem(DIRTY_KEY, JSON.stringify(map));
  setState({ pending: countDirty(map) });
}

function countDirty(map: DirtyMap) {
  return Object.values(map).reduce((n, rows) => n + Object.keys(rows).length, 0);
}

let debounce: ReturnType<typeof setTimeout> | null = null;

function scheduleSync() {
  if (typeof window === "undefined") return;
  if (debounce) clearTimeout(debounce);
  debounce = setTimeout(() => {
    debounce = null;
    void syncNow();
  }, 2500);
}

function mark(entity: string, id: number | string | undefined, kind: "u" | "d") {
  if (applyingRemote || id === undefined || id === null) return;
  const map = readDirty();
  map[entity] = { ...(map[entity] ?? {}), [String(id)]: kind };
  writeDirty(map);
  scheduleSync();
}

/** Records every local create/update/delete so it can be pushed when online. */
export function registerSyncHooks(db: GroceryDB) {
  if (hooksReady) return;
  hooksReady = true;
  for (const entity of SYNC_ENTITIES) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const table = (db as any)[entity];
    if (!table?.hook) continue;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    table.hook("creating", function (this: any, _pk: unknown, obj: { id?: number }) {
      const self = this;
      self.onsuccess = (pk: number) => mark(entity, pk ?? obj.id, "u");
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    table.hook("updating", function (this: any, _mods: unknown, pk: number) {
      mark(entity, pk, "u");
    });
    table.hook("deleting", (pk: number) => mark(entity, pk, "d"));
  }
  setState({ pending: countDirty(readDirty()) });
}

async function pushDirty(db: GroceryDB, client: SupabaseClient) {
  const map = readDirty();
  const rows: {
    entity: string;
    local_id: number;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    payload: any;
    deleted: boolean;
  }[] = [];

  for (const [entity, items] of Object.entries(map)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const table = (db as any)[entity];
    if (!table) continue;
    for (const [id, kind] of Object.entries(items)) {
      const localId = Number(id);
      if (!Number.isFinite(localId)) continue;
      if (kind === "d") {
        rows.push({ entity, local_id: localId, payload: {}, deleted: true });
        continue;
      }
      const record = await table.get(localId);
      if (!record) {
        rows.push({ entity, local_id: localId, payload: {}, deleted: true });
        continue;
      }
      rows.push({ entity, local_id: localId, payload: record, deleted: false });
    }
  }

  if (!rows.length) return;
  for (let i = 0; i < rows.length; i += 200) {
    const chunk = rows.slice(i, i + 200);
    const { error } = await client
      .from("shop_records")
      .upsert(chunk, { onConflict: "entity,local_id" });
    if (error) throw error;
  }
  writeDirty({});
}

async function pullRemote(db: GroceryDB, client: SupabaseClient) {
  const since = localStorage.getItem(CURSOR_KEY) ?? "1970-01-01T00:00:00Z";
  let cursor = since;
  let page = 0;
  for (;;) {
    const { data, error } = await client
      .from("shop_records")
      .select("entity, local_id, payload, deleted, updated_at")
      .gt("updated_at", since)
      .order("updated_at", { ascending: true })
      .range(page * 500, page * 500 + 499);
    if (error) throw error;
    if (!data?.length) break;

    applyingRemote = true;
    try {
      for (const row of data) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const table = (db as any)[row.entity as string];
        if (!table) continue;
        if (row.deleted) {
          await table.delete(row.local_id);
        } else {
          await table.put({ ...(row.payload as object), id: row.local_id });
        }
        if (row.updated_at > cursor) cursor = row.updated_at as string;
      }
    } finally {
      applyingRemote = false;
    }
    if (data.length < 500) break;
    page += 1;
  }
  localStorage.setItem(CURSOR_KEY, cursor);
}

/** Pushes local changes then pulls anything new from the cloud. */
export async function syncNow(): Promise<void> {
  if (typeof window === "undefined" || running) return;
  if (!navigator.onLine) return;
  const client = supabase;
  if (!client) return;
  const { data } = await client.auth.getSession();
  if (!data.session) return;

  running = true;
  setState({ status: "syncing" });
  const db = getDb();
  try {
    registerSyncHooks(db);
    await pushDirty(db, client);
    await pullRemote(db, client);
    setState({ status: "idle", last: new Date().toISOString(), pending: countDirty(readDirty()) });
  } catch (error) {
    console.error("sync failed", error);
    setState({ status: "error" });
  } finally {
    running = false;
  }
}

/** Marks every local row for upload — used the first time a device signs in. */
export async function markEverythingDirty() {
  const db = getDb();
  const map: DirtyMap = readDirty();
  for (const entity of SYNC_ENTITIES) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const table = (db as any)[entity];
    if (!table) continue;
    const keys: number[] = await table.toCollection().primaryKeys();
    if (!keys.length) continue;
    map[entity] = { ...(map[entity] ?? {}) };
    for (const key of keys) map[entity]![String(key)] = "u";
  }
  writeDirty(map);
}

let timer: ReturnType<typeof setInterval> | null = null;

export function startSyncLoop() {
  if (typeof window === "undefined" || timer) return;
  void syncNow();
  timer = setInterval(() => void syncNow(), 30_000);
  window.addEventListener("online", () => void syncNow());
}

export function resetSyncState() {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(CURSOR_KEY);
}
