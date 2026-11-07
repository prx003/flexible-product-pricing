import type { GroceryDB } from "./db";

const CLEAN_FLAG = "sgpos-clean-install-v2";

export const DEFAULT_SETTINGS = {
  id: 1,
  shopName: "G.K Mart",
  address: "",
  mobile: "",
  email: "",
  gstin: "",
  invoicePrefix: "INV",
  nextInvoiceNo: 1,
  currency: "₹",
  financialYear: "2026-2027",
  gstEnabled: true,
  gstInclusive: true,
  interState: false,
  roundOff: true,
  loyaltyRate: 1,
  pointValue: 0.25,
  thermalWidth: 80 as const,
  footerNote: "Thank you for shopping with us! Visit again.",
  notifications: true,
};

/** Wipes every transactional and master table. Settings + admin account are recreated. */
export async function wipeAllData(db: GroceryDB) {
  await Promise.all([
    db.products.clear(),
    db.categories.clear(),
    db.brands.clear(),
    db.suppliers.clear(),
    db.customers.clear(),
    db.sales.clear(),
    db.heldBills.clear(),
    db.purchases.clear(),
    db.supplierPayments.clear(),
    db.stockMovements.clear(),
    db.returns.clear(),
    db.expenses.clear(),
    db.offers.clear(),
    db.activity.clear(),
    db.syncQueue.clear(),
  ]);
  await db.settings.put({ ...DEFAULT_SETTINGS });
}

/**
 * No demo data. Creates only the settings row and a single admin account
 * so the shop owner can sign in and start entering real data.
 */
export async function seedDatabase(db: GroceryDB) {
  await db.open();

  // One-time purge of the old demo dataset for existing installs.
  if (typeof localStorage !== "undefined" && !localStorage.getItem(CLEAN_FLAG)) {
    await wipeAllData(db);
    const admins = await db.employees.toArray();
    if (admins.length > 1) {
      await db.employees.clear();
    }
    localStorage.setItem(CLEAN_FLAG, "1");
  }

  const settings = await db.settings.get(1);
  if (!settings) await db.settings.put({ ...DEFAULT_SETTINGS });
  else if (settings.shopName === "My Grocery Shop" || settings.shopName === "G.K Bazzar") {
    await db.settings.update(1, { shopName: "G.K Mart" });
  }

  const staff = await db.employees.count();
  if (staff === 0) {
    await db.employees.add({
      name: "Admin",
      mobile: "",
      email: "admin@shop.in",
      password: "admin123",
      role: "Admin",
      shift: "Full Day",
      salary: 0,
      joinDate: new Date().toISOString(),
      active: true,
    });
  }
}
