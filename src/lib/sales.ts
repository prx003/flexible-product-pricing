import { db } from "./db";
import type { PaymentMethod, Sale, SaleItem, Settings } from "./types";
import type { BillTotals } from "@/store/cart";
import { assertBillItemLimit } from "./bill-limits";

export async function getSettings(): Promise<Settings> {
  const s = await db.settings.get(1);
  if (!s) throw new Error("Shop settings are unavailable");
  return s;
}

export async function nextInvoiceNumber(): Promise<string> {
  const s = await getSettings();
  const no = `${s.invoicePrefix}-${s.nextInvoiceNo}`;
  await db.settings.update(1, { nextInvoiceNo: s.nextInvoiceNo + 1 });
  return no;
}

export async function adjustStock(
  productId: number,
  delta: number,
  type: Parameters<typeof logMovement>[0]["type"],
  user: string,
  note?: string,
) {
  const p = await db.products.get(productId);
  if (!p) return;
  const before = p.stock;
  const after = Math.round((before + delta) * 1000) / 1000;
  await db.products.update(productId, { stock: after });
  await logMovement({
    productId,
    productName: p.name,
    date: new Date().toISOString(),
    type,
    qty: Math.abs(delta),
    before,
    after,
    user,
    ...(note ? { note } : {}),
  });
}

export async function logMovement(m: {
  productId: number;
  productName: string;
  date: string;
  type:
    | "stock-in"
    | "stock-out"
    | "sale"
    | "purchase"
    | "adjustment"
    | "damaged"
    | "expired"
    | "wastage"
    | "return"
    | "transfer"
    | "audit";
  qty: number;
  before: number;
  after: number;
  user: string;
  note?: string;
}) {
  await db.stockMovements.add(m);
}

export interface CheckoutInput {
  items: SaleItem[];
  totals: BillTotals;
  customerId?: number;
  customerName: string;
  customerMobile?: string;
  cashier: string;
  payments: { method: PaymentMethod; amount: number }[];
  received: number;
  creditAmount: number;
  coupon?: string;
  notes?: string;
  pointsRedeemed: number;
}

export async function completeSale(input: CheckoutInput): Promise<Sale> {
  assertBillItemLimit(input.items);
  const settings = await getSettings();
  const invoiceNo = await nextInvoiceNumber();
  const t = input.totals;
  const primary =
    input.payments.length > 1 ? "Split" : (input.payments[0]?.method ?? "Cash");
  const pointsEarned = Math.floor((t.total * settings.loyaltyRate) / 100);

  const sale: Sale = {
    invoiceNo,
    date: new Date().toISOString(),
    ...(input.customerId ? { customerId: input.customerId } : {}),
    customerName: input.customerName,
    ...(input.customerMobile ? { customerMobile: input.customerMobile } : {}),
    cashier: input.cashier,
    items: input.items,
    subtotal: t.subtotal,
    itemDiscount: t.itemDiscount,
    billDiscount: t.billDiscountAmt + t.couponAmt,
    ...(input.coupon ? { couponCode: input.coupon } : {}),
    taxable: t.taxable,
    cgst: t.cgst,
    sgst: t.sgst,
    igst: t.igst,
    roundOff: t.roundOff,
    total: t.total,
    profit: t.profit,
    paymentMethod: primary as PaymentMethod,
    payments: input.payments,
    received: input.received,
    change: Math.max(0, +(input.received - t.total + input.creditAmount).toFixed(2)),
    creditAmount: input.creditAmount,
    pointsEarned,
    pointsRedeemed: input.pointsRedeemed,
    ...(input.notes ? { notes: input.notes } : {}),
    status: "completed",
  };

  const id = await db.sales.add(sale);
  sale.id = id as number;

  for (const item of input.items) {
    await adjustStock(item.productId, -item.qty, "sale", input.cashier, `Invoice ${invoiceNo}`);
  }

  if (input.customerId) {
    const c = await db.customers.get(input.customerId);
    if (c) {
      const points = c.loyaltyPoints - input.pointsRedeemed + pointsEarned;
      const membership =
        points >= 5000
          ? "Platinum"
          : points >= 2000
            ? "Gold"
            : points >= 500
              ? "Silver"
              : "Bronze";
      await db.customers.update(input.customerId, {
        loyaltyPoints: Math.max(0, points),
        creditBalance: +(c.creditBalance + input.creditAmount).toFixed(2),
        membership,
      });
    }
  }

  await db.syncQueue.add({
    date: new Date().toISOString(),
    entity: "sale",
    action: "create",
    payload: JSON.stringify({ invoiceNo, total: sale.total }),
    synced: navigator.onLine,
  });

  await db.activity.add({
    date: new Date().toISOString(),
    user: input.cashier,
    action: "Completed sale",
    details: `${invoiceNo} · ${sale.total}`,
  });

  return sale;
}
