export const inr = (n: number) =>
  "₹" +
  (Number.isFinite(n) ? n : 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export const inrShort = (n: number) => {
  if (Math.abs(n) >= 10000000) return "₹" + (n / 10000000).toFixed(2) + " Cr";
  if (Math.abs(n) >= 100000) return "₹" + (n / 100000).toFixed(2) + " L";
  if (Math.abs(n) >= 1000) return "₹" + (n / 1000).toFixed(1) + "K";
  return "₹" + n.toFixed(0);
};

const pad = (n: number) => String(n).padStart(2, "0");

export const fmtDate = (d: string | Date) => {
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "-";
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
};

export const fmtDateTime = (d: string | Date) => {
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "-";
  return `${fmtDate(date)} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

export const toInputDate = (d: string | Date) => {
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

export const startOfDay = (d: Date = new Date()) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

export const isToday = (d: string | Date) => {
  const date = typeof d === "string" ? new Date(d) : d;
  return startOfDay(date).getTime() === startOfDay().getTime();
};

export const daysBetween = (a: string | Date, b: string | Date = new Date()) =>
  Math.round((new Date(a).getTime() - new Date(b).getTime()) / 86400000);

export const round2 = (n: number) => Math.round(n * 100) / 100;
