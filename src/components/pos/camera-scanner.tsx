import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Camera } from "lucide-react";
import { toast } from "sonner";

export function CameraScanner({
  onScan,
  label,
  variant = "outline",
  className,
}: {
  onScan: (code: string) => void;
  label?: string;
  variant?: "default" | "outline" | "secondary" | "ghost";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const elementId = `camera-scanner-${uid}`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scannerRef = useRef<any>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (cancelled || !document.getElementById(elementId)) return;
        const scanner = new Html5Qrcode(elementId);
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 260, height: 160 } },
          (text: string) => {
            onScan(text.trim());
            setOpen(false);
          },
          () => {},
        );
      } catch {
        toast.error("Camera not available on this device");
        setOpen(false);
      }
    })();
    return () => {
      cancelled = true;
      const s = scannerRef.current;
      if (s) {
        s.stop()
          .then(() => s.clear())
          .catch(() => {});
        scannerRef.current = null;
      }
    };
  }, [open, onScan, elementId]);

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={label ? "default" : "icon"}
        className={className}
        onClick={() => setOpen(true)}
        title="Scan with camera"
      >
        <Camera className="size-4" />
        {label}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Scan barcode</DialogTitle>
          </DialogHeader>
          <div id={elementId} className="min-h-64 w-full rounded-lg bg-muted" />
          <p className="text-center text-xs text-muted-foreground">
            Point the camera at the product barcode or QR code.
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}
