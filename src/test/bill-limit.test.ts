import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCart } from "@/store/cart";
import type { Product } from "@/lib/types";
import { assertBillItemLimit } from "@/lib/bill-limits";

vi.mock("@/lib/db", () => ({ db: { settings: { get: vi.fn() } } }));
import { db } from "@/lib/db";
import { completeSale } from "@/lib/sales";

const product = (id: number): Product => ({
  id, name: `Item ${id}`, sku: `${id}`, barcode: `${id}`, categoryId: 1,
  brandId: 1, unit: "pcs", purchasePrice: 5, sellingPrice: 10, mrp: 12,
  gst: 0, hsn: "", stock: 100, minStock: 1, reorderLevel: 1,
  active: true, createdAt: "2026-11-06",
});

beforeEach(() => { useCart.getState().clear(); vi.clearAllMocks(); });

describe("20 item lines per bill", () => {
  it("allows 20 lines and rejects the 21st without changing the bill", () => {
    for (let id = 1; id <= 20; id++) useCart.getState().add(product(id));
    expect(useCart.getState().items).toHaveLength(20);
    useCart.getState().add(product(21));
    expect(useCart.getState().items.map((i) => i.productId)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
  });
  it("permits more quantity of an existing line at the limit", () => {
    for (let id = 1; id <= 20; id++) useCart.getState().add(product(id));
    useCart.getState().add(product(1), 2);
    expect(useCart.getState().items).toHaveLength(20);
    expect(useCart.getState().items[0]?.qty).toBe(3);
  });
  it("permits a replacement after removing a line", () => {
    for (let id = 1; id <= 20; id++) useCart.getState().add(product(id));
    useCart.getState().remove(1);
    useCart.getState().add(product(21));
    expect(useCart.getState().items).toHaveLength(20);
    expect(useCart.getState().items.at(-1)?.productId).toBe(21);
  });
  it("rejects oversized held bills without losing the current cart", () => {
    for (let id = 1; id <= 20; id++) useCart.getState().add(product(id));
    const items = useCart.getState().items;
    expect(() => useCart.getState().load([...items, { ...items[0], productId: 21 } as typeof items[number]])).toThrow("only 20 items");
    expect(useCart.getState().items).toEqual(items);
    expect(() => assertBillItemLimit(items)).not.toThrow();
  });
  it("rejects a 21-line checkout before issuing an invoice or writing data", async () => {
    const items = Array.from({ length: 21 }, (_, id) => ({ productId: id }));
    await expect(completeSale({ items } as Parameters<typeof completeSale>[0])).rejects.toThrow("only 20 items");
    expect(db.settings.get).not.toHaveBeenCalled();
  });
});