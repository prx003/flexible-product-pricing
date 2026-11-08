import { afterEach, describe, expect, it, vi } from "vitest";
import { printThermal } from "@/lib/invoice";
import type { Sale, Settings } from "@/lib/types";

const sale = {
  invoiceNo: "PRINT-1", date: "2026-11-08T12:50:00Z", customerName: "Walk-in",
  items: [], payments: [], paymentMethod: "Cash", received: 10, total: 10, change: 0,
} as unknown as Sale;
const settings = { shopName: "G.K Mart", address: "", thermalWidth: 80 } as Settings;

afterEach(() => {
  document.querySelectorAll("iframe[data-thermal-print]").forEach((frame) => frame.remove());
  vi.restoreAllMocks();
});

describe("thermal receipt printing", () => {
  it("prints without opening a popup window", () => {
    const popup = vi.spyOn(window, "open").mockReturnValue(null);
    printThermal(sale, settings);
    const frame = document.querySelector<HTMLIFrameElement>("iframe[data-thermal-print]");
    expect(frame).not.toBeNull();
    expect(popup).not.toHaveBeenCalled();
    const printWindow = frame?.contentWindow;
    if (!frame || !printWindow) throw new Error("Missing receipt print frame");
    vi.spyOn(printWindow, "focus").mockImplementation(() => {});
    const print = vi.spyOn(printWindow, "print").mockImplementation(() => {});
    frame.dispatchEvent(new Event("load"));
    expect(print).toHaveBeenCalledTimes(1);
    printWindow.dispatchEvent(new Event("afterprint"));
    expect(document.querySelector("iframe[data-thermal-print]")).toBeNull();
  });
});