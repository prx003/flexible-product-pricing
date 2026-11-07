/** Renders a "GK" circular logo to a PNG data URL (used as invoice watermark). */
export function gkLogoDataUrl(size = 600): string {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const x = c.getContext("2d")!;
  x.fillStyle = "#16803d";
  x.beginPath(); x.arc(size / 2, size / 2, size / 2 - 6, 0, Math.PI * 2); x.fill();
  x.strokeStyle = "#ffffff"; x.lineWidth = size * 0.025;
  x.beginPath(); x.arc(size / 2, size / 2, size * 0.42, 0, Math.PI * 2); x.stroke();
  x.fillStyle = "#ffffff"; x.textAlign = "center"; x.textBaseline = "middle";
  x.font = `bold ${size * 0.42}px Georgia, serif`;
  x.fillText("GK", size / 2, size * 0.47);
  x.font = `bold ${size * 0.08}px Arial, sans-serif`;
  x.fillText("MART", size / 2, size * 0.72);
  return c.toDataURL("image/png");
}
