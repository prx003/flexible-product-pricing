import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";
import type { Sale, Settings } from "./types";
import { fmtDateTime, inr } from "./format";
import { gkLogoDataUrl } from "./gk-logo";

export const mrpTotal = (sale: Sale) =>
  sale.items.reduce((s, i) => s + Math.max(i.mrp || 0, i.price) * i.qty, 0);

export const savedAmt = (sale: Sale) =>
  Math.max(0, Math.round((mrpTotal(sale) - sale.total) * 100) / 100);

export const mrpDiscount = (sale: Sale) =>
  Math.round(sale.items.reduce((s, i) => s + Math.max(0, (i.mrp || 0) - i.price) * i.qty, 0) * 100) / 100;

export function buildInvoicePdf(sale: Sale, s: Settings) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210;
  const L = 12;
  const R = W - 12;
  const RED: [number, number, number] = [200, 16, 26];
  const BLACK: [number, number, number] = [0, 0, 0];
  doc.setTextColor(...BLACK);

  // Header: TAX INVOICE left, logo + shop details right
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("TAX INVOICE", 16, 28);
  const logo = s.logo || gkLogoDataUrl();
  try { doc.addImage(logo, "PNG", R - 22, 8, 22, 22); } catch { /* ignore */ }
  doc.setFontSize(16);
  doc.text(s.shopName.toUpperCase(), R, 37, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  if (s.address) doc.text(s.address, R, 43, { align: "right" });
  doc.setFont("helvetica", "bold");
  const contact = [s.mobile && `Ph: ${s.mobile}`, s.email, s.gstin && `GSTIN: ${s.gstin}`].filter(Boolean).join("    ");
  doc.text(contact, R, 49, { align: "right" });
  doc.setDrawColor(...RED);
  doc.setLineWidth(1.2);
  doc.line(L, 53, R, 53);

  // Bill to (left) | invoice meta (right)
  doc.setLineWidth(0.3);
  doc.setDrawColor(...BLACK);
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text("To:", 14, 61);
  doc.setFont("helvetica", "bold");
  doc.text(sale.customerName || "Walk-in Customer", 22, 61);
  doc.setFont("helvetica", "normal");
  if (sale.customerMobile) doc.text(`Mobile: ${sale.customerMobile}`, 22, 67);
  doc.line(124, 57, 124, 86);
  const meta: [string, string][] = [
    ["Invoice Number:", sale.invoiceNo],
    ["Date:", fmtDateTime(sale.date)],
    ["Payment:", sale.paymentMethod],
    ["Cashier:", sale.cashier],
  ];
  meta.forEach(([k, v], i) => {
    doc.setFont("helvetica", "normal");
    doc.text(k, 127, 62 + i * 7);
    doc.setFont("helvetica", "bold");
    doc.text(v, 160, 62 + i * 7);
  });
  doc.line(L, 90, R, 90);

  // Paginate instead of dropping rows that do not fit on the first page.
  let tableBottom = 92;
  const amountColumn = 168;
  autoTable(doc, {
    startY: 92,
    margin: { left: L, right: L, top: 12, bottom: 15 },
    theme: "grid",
    head: [["S.No", "DESCRIPTION", "HSN", "QTY", "MRP", "RATE", "AMOUNT"]],
    body: sale.items.map((it, idx) => [
      String(idx + 1), `${it.name}${it.gst ? ` (GST ${it.gst}%)` : ""}`,
      it.hsn || "", String(it.qty), (it.mrp || it.price).toFixed(2),
      it.price.toFixed(2), it.total.toFixed(2),
    ]),
    styles: { font: "helvetica", fontSize: 9, cellPadding: 1.5, textColor: BLACK, lineColor: BLACK, lineWidth: 0.2 },
    headStyles: { fillColor: [255, 255, 255], textColor: BLACK, fontStyle: "bold", halign: "center", fontSize: 8 },
    columnStyles: {
      0: { cellWidth: 12, halign: "center" },
      1: { cellWidth: 80 },
      2: { cellWidth: 16, halign: "center" },
      3: { cellWidth: 16, halign: "center" },
      4: { cellWidth: 16, halign: "right" },
      5: { cellWidth: 16, halign: "right" },
      6: { cellWidth: 30, halign: "right" },
    },
    rowPageBreak: "avoid",
    didDrawPage: ({ cursor }) => { tableBottom = cursor?.y ?? tableBottom; },
  });

  // Totals
  const rows: [string, string, boolean][] = [
    ["Total MRP", mrpTotal(sale).toFixed(2), false],
    ["Discount", "-" + (mrpDiscount(sale) + sale.itemDiscount + sale.billDiscount).toFixed(2), false],
    ["Taxable Value", sale.taxable.toFixed(2), false],
    ["CGST", sale.cgst.toFixed(2), false],
    ["SGST", sale.sgst.toFixed(2), false],
    ...(sale.igst ? [["IGST", sale.igst.toFixed(2), false] as [string, string, boolean]] : []),
    ["Round Off", sale.roundOff.toFixed(2), false],
  ];
  const tH = rows.length * 5.5 + 12;
  const terms = [
    "Goods once sold will not be taken back.",
    ...(savedAmt(sale) > 0 ? [`You saved Rs ${savedAmt(sale).toFixed(2)} on this bill.`] : []),
    ...(s.footerNote ? [s.footerNote] : []),
  ];
  const termLines = terms.flatMap((t) => doc.splitTextToSize(`* ${t}`, R - L - 4) as string[]);
  const termH = 9 + termLines.length * 4.5;
  let tTop = tableBottom;
  if (tTop + tH + 9 + termH + 28 > 282) {
    doc.addPage();
    tTop = 12;
  }
  doc.rect(L, tTop, R - L, tH);
  doc.line(amountColumn, tTop, amountColumn, tTop + tH);
  doc.line(amountColumn, tTop + tH - 8, R, tTop + tH - 8);
  let ty = tTop + 5;
  doc.setFontSize(10);
  rows.forEach(([k, v]) => {
    doc.setFont("helvetica", "normal");
    doc.text(k, amountColumn - 3, ty, { align: "right" });
    doc.text(v, R - 3, ty, { align: "right" });
    ty += 5.5;
  });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Invoice Amount", amountColumn - 3, tTop + tH - 2.5, { align: "right" });
  doc.text(sale.total.toFixed(2), R - 3, tTop + tH - 2.5, { align: "right" });

  // Words
  let by = tTop + tH;
  doc.rect(L, by, R - L, 9);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(`Rupees ${numberToIndianWords(Math.round(sale.total))} Only.`, 14, by + 6);
  by += 9;

  // Terms
  doc.rect(L, by, R - L, termH);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("TERMS AND CONDITIONS:", 14, by + 5.5);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  termLines.forEach((t, i) => doc.text(t, 14, by + 10 + i * 4.5));
  by += termH;

  // Wishes | signatory
  const sH = 28;
  doc.rect(L, by, R - L, sH);
  doc.line(110, by, 110, by + sH);
  if (s.wishes) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(doc.splitTextToSize(s.wishes, 90) as string[], 14, by + 7);
  }
  if (s.upiId) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`UPI: ${s.upiId}`, 14, by + sH - 4);
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(`For ${s.shopName.toUpperCase()}`, R - 3, by + 7, { align: "right" });
  doc.setFontSize(9);
  doc.text("Authorised Signatory", R - 3, by + sH - 4, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text("This is a computer generated invoice.", W / 2, 290, { align: "center" });
  return doc;
}

function numberToIndianWords(n: number): string {
  const ones = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
    "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen",
  ];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  const two = (x: number): string =>
    x < 20 ? (ones[x] ?? "") : `${tens[Math.floor(x / 10)]}${x % 10 ? " " + ones[x % 10] : ""}`;
  const three = (x: number): string =>
    (x >= 100 ? `${ones[Math.floor(x / 100)]} Hundred${x % 100 ? " " : ""}` : "") + (x % 100 ? two(x % 100) : "");
  if (n === 0) return "Zero";
  const crore = Math.floor(n / 10000000);
  const lakh = Math.floor((n % 10000000) / 100000);
  const thousand = Math.floor((n % 100000) / 1000);
  const rest = n % 1000;
  const parts: string[] = [];
  if (crore) parts.push(`${three(crore)} Crore`);
  if (lakh) parts.push(`${three(lakh)} Lakh`);
  if (thousand) parts.push(`${three(thousand)} Thousand`);
  if (rest) parts.push(three(rest));
  return parts.join(" ");
}

export function downloadInvoice(sale: Sale, s: Settings) {
  buildInvoicePdf(sale, s).save(`${sale.invoiceNo}.pdf`);
}

export function printA4(sale: Sale, s: Settings) {
  const doc = buildInvoicePdf(sale, s);
  doc.autoPrint();
  const url = doc.output("bloburl");
  window.open(url as unknown as string, "_blank");
}

export function thermalHtml(sale: Sale, s: Settings) {
  const paperWidth = s.thermalWidth === 58 ? 58 : 80;
  // Thermal heads print ~72mm on 80mm rolls (~48mm on 58mm) — keep content inside it.
  const printWidth = paperWidth === 58 ? 48 : 72;
  const dash = `<div class="d"></div>`;
  const totalQty = sale.items.reduce((a, i) => a + i.qty, 0);
  // GST slab summary
  const slabs = new Map<number, { base: number; tax: number }>();
  for (const i of sale.items) {
    const g = i.gst || 0;
    const base = s.gstInclusive ? i.total / (1 + g / 100) : i.total;
    const cur = slabs.get(g) ?? { base: 0, tax: 0 };
    cur.base += base;
    cur.tax += base * (g / 100);
    slabs.set(g, cur);
  }
  const d = new Date(sale.date);
  const p = (n: number) => String(n).padStart(2, "0");
  const dateStr = `${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()}`;
  const timeStr = `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  const pays = sale.payments?.length ? sale.payments : [{ method: sale.paymentMethod, amount: sale.received }];
  const kv = (k: string, v: string, cls = "") =>
    `<tr class="${cls}"><td>${k}</td><td class="c" style="width:12px">:</td><td class="r">${v}</td></tr>`;
  return `<html><head><title>${sale.invoiceNo}</title><style>
  @page{size:${paperWidth}mm auto;margin:0}
  html,body{margin:0;padding:0}
  body{font-family:Arial,Helvetica,sans-serif;font-size:12px;box-sizing:border-box;width:${printWidth}mm;max-width:100%;margin:0 auto;padding:1mm 0;color:#000}
  td{overflow-wrap:anywhere}
  .c{text-align:center}.r{text-align:right}.b{font-weight:700}
  .d{border-top:1px dashed #000;margin:4px 0}.s{border-top:1.5px solid #000;margin:3px 0}
  table{width:100%;border-collapse:collapse}td,th{font-size:11px;padding:1px 0;vertical-align:top}
  th{text-align:right;font-size:12px}th:first-child{text-align:left}
  .big td{font-size:17px;font-weight:700;padding:3px 0}
  </style></head><body>
  ${dash}
  <div class="c b" style="font-size:17px">${s.shopName.toUpperCase()}</div>
  <div class="c b">${s.address}</div>
  ${s.mobile ? `<div class="c b">Ph:${s.mobile}</div>` : ""}
  ${s.gstin ? `<div class="c b">GSTIN: ${s.gstin}</div>` : ""}
  <div class="c b" style="text-decoration:underline;margin:4px 0;font-size:13px">BILL</div>
  <table><tr><td class="b">Bill No: ${sale.invoiceNo}</td><td class="r b">Date : ${dateStr} ${timeStr}</td></tr></table>
  <div class="b" style="font-size:13px;margin:3px 0">Name : &nbsp; ${sale.customerName || "Walk-in Cash"}</div>
  <div class="s"></div>
  <table>
    <tr><th>S.No</th><th>Item</th><th>MRP</th><th>Qty</th><th>Rate</th><th>Amount</th></tr>
    <tr><td colspan="6"><div class="s"></div></td></tr>
    ${sale.items
      .map((i, idx) => `<tr><td>${idx + 1}</td><td colspan="5">${i.name.toUpperCase()}</td></tr><tr><td></td><td></td><td class="r">${Math.round(i.mrp || i.price)}</td><td class="r">${i.qty.toFixed(3)}</td><td class="r">${i.price.toFixed(2)}</td><td class="r">${i.total.toFixed(2)}</td></tr>`)
      .join("")}
  </table>
  ${dash}
  <table>
    ${kv("Bill Amount", sale.total.toFixed(2), "b")}
  </table>
  ${dash}
  <table class="big">${kv("G.Total", sale.total.toFixed(2))}</table>
  ${dash}
  <table>
    ${kv("Total Item", sale.items.length.toFixed(2), "b")}
    ${kv("Total Qty", totalQty.toFixed(2), "b")}
    ${savedAmt(sale) > 0 ? kv("You Have Saved", savedAmt(sale).toFixed(2), "b") : ""}
    ${kv("Payment Mode", "", "b")}
  </table>
  ${dash}
  <table>
    ${pays.map((x) => `<tr><td>${x.method}</td><td class="r">${x.amount.toFixed(2)}</td></tr>`).join("")}
    ${sale.change > 0 ? `<tr><td>Change Due</td><td class="r">${sale.change.toFixed(2)}</td></tr>` : ""}
  </table>
  <table style="margin-top:4px">
    <tr class="b"><td>CGST</td><td class="r">SGST</td><td class="r">CESS</td><td class="r">Base Amt</td><td class="r">Tax Amt</td></tr>
    <tr><td colspan="5"><div class="d" style="margin:1px 0"></div></td></tr>
    ${[...slabs.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([g, v]) => `<tr><td>${(g / 2).toFixed(2)}</td><td class="r">${(g / 2).toFixed(2)}</td><td class="r">0.00</td><td class="r">${v.base.toFixed(2)}</td><td class="r">${v.tax.toFixed(2)}</td></tr>`)
      .join("")}
  </table>
  <div class="c b" style="font-size:13px;margin-top:8px">*** ${s.wishes || "THANK YOU &nbsp;VISIT AGAIN"} ***</div>
  ${s.footerNote ? `<div class="c" style="font-size:10px">${s.footerNote}</div>` : ""}
  ${dash}
  </body></html>`;
}

function isEmbedded() {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

/** Opens the 80mm receipt in its own window and shows the Windows print dialog. */
export function printWindows(sale: Sale, s: Settings) {
  const w = window.open("", "_blank", "width=420,height=700");
  if (!w) {
    toast.error("Please allow popups to use Windows Print.");
    return;
  }
  w.document.open();
  w.document.write(
    thermalHtml(sale, s).replace(
      "</body>",
      `<script>window.onload=function(){window.focus();window.print();};window.onafterprint=function(){window.close();};</script></body>`,
    ),
  );
  w.document.close();
}

export function printThermal(sale: Sale, s: Settings) {
  // Embedded previews (e.g. the editor) often block print() inside frames,
  // so print from a small receipt window there instead.
  if (isEmbedded()) {
    const w = window.open("", "_blank", "width=420,height=700");
    if (w) {
      w.document.open();
      w.document.write(
        thermalHtml(sale, s).replace(
          "</body>",
          `<script>window.onload=function(){window.focus();window.print();};window.onafterprint=function(){window.close();};</script></body>`,
        ),
      );
      w.document.close();
      return;
    }
  }
  // A same-origin frame avoids popup blockers and keeps the bill screen open.
  const frame = document.createElement("iframe");
  frame.setAttribute("data-thermal-print", "true");
  frame.title = `Print receipt ${sale.invoiceNo}`;
  frame.setAttribute("aria-hidden", "true");
  frame.className = "thermal-print-frame";
  frame.onload = () => {
    const win = frame.contentWindow;
    if (!win) {
      frame.remove();
      toast.error("Unable to open receipt printing. Please try again.");
      return;
    }
    win.addEventListener("afterprint", () => frame.remove(), { once: true });
    try {
      win.focus();
      win.print();
    } catch {
      frame.remove();
      toast.error("Printing is unavailable in this browser. Please try Chrome or Edge.");
    }
  };
  frame.srcdoc = thermalHtml(sale, s);
  document.body.appendChild(frame);
}

export function whatsappShare(sale: Sale, s: Settings) {
  const text = [
    `*${s.shopName}*`,
    `Invoice: ${sale.invoiceNo}`,
    `Date: ${fmtDateTime(sale.date)}`,
    "",
    ...sale.items.map((i) => `${i.name} x${i.qty} = ${inr(i.total)}`),
    "",
    `Total: ${inr(sale.total)}`,
    `Paid via ${sale.paymentMethod}`,
    "",
    ...(s.wishes ? [s.wishes] : []),
    s.footerNote,
  ].join("\n");
  const phone = (sale.customerMobile ?? "").replace(/\D/g, "");
  const url = `https://wa.me/${phone ? "91" + phone.slice(-10) : ""}?text=${encodeURIComponent(text)}`;
  window.open(url, "_blank");
}
