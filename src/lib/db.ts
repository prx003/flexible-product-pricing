import Dexie, { type EntityTable } from "dexie";
import type {
  ActivityLog,
  Brand,
  Category,
  Customer,
  Employee,
  Expense,
  HeldBill,
  Offer,
  Product,
  Purchase,
  Sale,
  SalesReturn,
  Settings,
  StockMovement,
  Supplier,
  SupplierPayment,
  SyncItem,
} from "./types";
import { seedDatabase } from "./seed";

export class GroceryDB extends Dexie {
  products!: EntityTable<Product, "id">;
  categories!: EntityTable<Category, "id">;
  brands!: EntityTable<Brand, "id">;
  suppliers!: EntityTable<Supplier, "id">;
  customers!: EntityTable<Customer, "id">;
  sales!: EntityTable<Sale, "id">;
  heldBills!: EntityTable<HeldBill, "id">;
  purchases!: EntityTable<Purchase, "id">;
  supplierPayments!: EntityTable<SupplierPayment, "id">;
  stockMovements!: EntityTable<StockMovement, "id">;
  returns!: EntityTable<SalesReturn, "id">;
  expenses!: EntityTable<Expense, "id">;
  offers!: EntityTable<Offer, "id">;
  employees!: EntityTable<Employee, "id">;
  activity!: EntityTable<ActivityLog, "id">;
  settings!: EntityTable<Settings, "id">;
  syncQueue!: EntityTable<SyncItem, "id">;

  constructor() {
    super("smart-grocery-pos");
    this.version(1).stores({
      products: "++id, name, sku, barcode, categoryId, brandId, stock, expiryDate, active",
      categories: "++id, name",
      brands: "++id, name",
      suppliers: "++id, name, mobile",
      customers: "++id, name, mobile, membership",
      sales: "++id, invoiceNo, date, customerId, cashier, paymentMethod, status",
      heldBills: "++id, ref, date",
      purchases: "++id, billNo, date, supplierId, status",
      supplierPayments: "++id, supplierId, date",
      stockMovements: "++id, productId, date, type",
      returns: "++id, refNo, saleId, date",
      expenses: "++id, date, category",
      offers: "++id, name, code, active",
      employees: "++id, email, role",
      activity: "++id, date, user",
      settings: "++id",
      syncQueue: "++id, synced",
    });
  }
}

let _db: GroceryDB | null = null;

export function getDb(): GroceryDB {
  if (!_db) _db = new GroceryDB();
  return _db;
}

/** Only safe in the browser. */
export const db = new Proxy({} as GroceryDB, {
  get(_t, prop) {
    const instance = getDb();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const value = (instance as any)[prop];
    return typeof value === "function" ? value.bind(instance) : value;
  },
});

let initPromise: Promise<void> | null = null;

export function initDb(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (!initPromise) initPromise = seedDatabase(getDb());
  return initPromise!;
}
