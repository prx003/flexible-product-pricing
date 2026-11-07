import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Customer, PaymentMethod, Product, SaleItem } from "@/lib/types";
import { round2 } from "@/lib/format";
import { assertBillItemLimit, MAX_BILL_ITEMS } from "@/lib/bill-limits";

export interface CartLine extends SaleItem {
  free?: boolean;
}

interface CartState {
  items: CartLine[];
  customer: Customer | null;
  billDiscount: number;
  billDiscountType: "percent" | "fixed";
  coupon: string;
  couponValue: number;
  notes: string;
  pointsRedeemed: number;
  add: (p: Product, qty?: number) => void;
  setQty: (productId: number, qty: number) => void;
  setDiscount: (productId: number, discount: number) => void;
  remove: (productId: number) => void;
  clear: () => void;
  setCustomer: (c: Customer | null) => void;
  setBillDiscount: (v: number, type: "percent" | "fixed") => void;
  setCoupon: (code: string, value: number) => void;
  setNotes: (v: string) => void;
  setPoints: (v: number) => void;
  load: (items: CartLine[]) => void;
}

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      customer: null,
      billDiscount: 0,
      billDiscountType: "percent",
      coupon: "",
      couponValue: 0,
      notes: "",
      pointsRedeemed: 0,
      add: (p, qty = 1) =>
        set((s) => {
          if (p.id === undefined) return s;
          const existing = s.items.find((i) => i.productId === p.id);
          if (existing) {
            return {
              items: s.items.map((i) =>
                i.productId === p.id
                  ? { ...i, qty: round2(i.qty + qty), total: lineTotal(i.price, i.qty + qty, i.discount) }
                  : i,
              ),
            };
          }
          if (s.items.length >= MAX_BILL_ITEMS) return s;
          return {
            items: [
              ...s.items,
              {
                productId: p.id,
                name: p.name,
                unit: p.unit,
                qty,
                price: p.sellingPrice,
                mrp: p.mrp,
                gst: p.gst,
                hsn: p.hsn,
                discount: 0,
                purchasePrice: p.purchasePrice,
                total: lineTotal(p.sellingPrice, qty, 0),
              },
            ],
          };
        }),
      setQty: (productId, qty) =>
        set((s) => ({
          items: s.items
            .map((i) =>
              i.productId === productId
                ? { ...i, qty: round2(qty), total: lineTotal(i.price, qty, i.discount) }
                : i,
            )
            .filter((i) => i.qty > 0),
        })),
      setDiscount: (productId, discount) =>
        set((s) => ({
          items: s.items.map((i) =>
            i.productId === productId
              ? { ...i, discount, total: lineTotal(i.price, i.qty, discount) }
              : i,
          ),
        })),
      remove: (productId) =>
        set((s) => ({ items: s.items.filter((i) => i.productId !== productId) })),
      clear: () =>
        set({
          items: [],
          customer: null,
          billDiscount: 0,
          billDiscountType: "percent",
          coupon: "",
          couponValue: 0,
          notes: "",
          pointsRedeemed: 0,
        }),
      setCustomer: (customer) => set({ customer }),
      setBillDiscount: (billDiscount, billDiscountType) => set({ billDiscount, billDiscountType }),
      setCoupon: (coupon, couponValue) => set({ coupon, couponValue }),
      setNotes: (notes) => set({ notes }),
      setPoints: (pointsRedeemed) => set({ pointsRedeemed }),
      load: (items) => {
        assertBillItemLimit(items);
        set({ items });
      },
    }),
    { name: "sgpos-cart" },
  ),
);

export const lineTotal = (price: number, qty: number, discount: number) =>
  round2(Math.max(0, price * qty - discount));

export interface BillTotals {
  gross: number;
  itemDiscount: number;
  subtotal: number;
  billDiscountAmt: number;
  couponAmt: number;
  pointsAmt: number;
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
  tax: number;
  roundOff: number;
  total: number;
  profit: number;
  savings: number;
}

export function computeTotals(
  items: CartLine[],
  opts: {
    billDiscount: number;
    billDiscountType: "percent" | "fixed";
    couponValue: number;
    pointsAmt: number;
    interState: boolean;
    roundOffEnabled: boolean;
  },
): BillTotals {
  const gross = round2(items.reduce((s, i) => s + i.price * i.qty, 0));
  const itemDiscount = round2(items.reduce((s, i) => s + i.discount, 0));
  const subtotal = round2(gross - itemDiscount);
  const billDiscountAmt =
    opts.billDiscountType === "percent"
      ? round2((subtotal * opts.billDiscount) / 100)
      : round2(Math.min(opts.billDiscount, subtotal));
  const afterBill = Math.max(0, subtotal - billDiscountAmt);
  const couponAmt = round2(Math.min(opts.couponValue, afterBill));
  const afterCoupon = Math.max(0, afterBill - couponAmt);
  const pointsAmt = round2(Math.min(opts.pointsAmt, afterCoupon));
  const net = Math.max(0, afterCoupon - pointsAmt);

  const ratio = subtotal > 0 ? net / subtotal : 0;
  let taxable = 0;
  let tax = 0;
  for (const i of items) {
    const lineNet = i.total * ratio;
    const base = lineNet / (1 + i.gst / 100);
    taxable += base;
    tax += lineNet - base;
  }
  taxable = round2(taxable);
  tax = round2(tax);
  const rounded = opts.roundOffEnabled ? Math.round(net) : round2(net);
  const roundOff = round2(rounded - net);
  const profit = round2(
    items.reduce((s, i) => s + (i.price - i.purchasePrice) * i.qty, 0) -
      itemDiscount -
      billDiscountAmt -
      couponAmt,
  );
  const savings = round2(
    items.reduce((s, i) => s + Math.max(0, i.mrp - i.price) * i.qty, 0) +
      itemDiscount +
      billDiscountAmt +
      couponAmt,
  );

  return {
    gross,
    itemDiscount,
    subtotal,
    billDiscountAmt,
    couponAmt,
    pointsAmt,
    taxable,
    cgst: opts.interState ? 0 : round2(tax / 2),
    sgst: opts.interState ? 0 : round2(tax / 2),
    igst: opts.interState ? tax : 0,
    tax,
    roundOff,
    total: rounded,
    profit,
    savings,
  };
}

export type { PaymentMethod };
