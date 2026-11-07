import { generateUPIQR } from "upipay/qr";

/**
 * Shop's default UPI ID (VPA) — money lands directly in this bank account.
 * Editable from the billing screen's UPI panel; stored in the settings table.
 */
export const DEFAULT_UPI_ID = "9483445699@ybl";

export interface UpiQrResult {
  upiUri: string;
  qrImage: string;
}

/**
 * Build an NPCI-compliant fixed-amount UPI QR (via upipay) that works with
 * every UPI app — PhonePe, Google Pay, Paytm, BHIM. Returns null when the
 * amount or VPA is unusable.
 */
export async function makeUpiQr(opts: {
  vpa: string;
  name: string;
  amount: number;
  ref?: string;
  note?: string;
}): Promise<UpiQrResult | null> {
  const vpa = (opts.vpa || "").trim();
  if (!vpa.includes("@")) return null;
  const amount = Math.round(opts.amount * 100) / 100;
  if (!(amount >= 1)) return null;
  const ref =
    (opts.ref ?? "").replace(/[^a-zA-Z0-9_.-]/g, "").slice(0, 40) ||
    `TXN-${Date.now()}`;
  const res = await generateUPIQR({
    vpa,
    name: (opts.name || "Shop").slice(0, 40),
    amount,
    orderId: ref,
    ...(opts.note ? { note: opts.note.slice(0, 40) } : {}),
  });
  return { upiUri: res.upiUri, qrImage: res.qrImage };
}
