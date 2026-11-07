import { useState } from "react";
import { ScanBarcode } from "lucide-react";
import { Input } from "@/components/ui/input";
import { CameraScanner } from "@/components/pos/camera-scanner";

/** Barcode field: hardware scanners type + Enter, phones use the camera button. */
export function ScanInput({
  onCode,
  placeholder = "Scan or type barcode / SKU",
  autoFocus,
}: {
  onCode: (code: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const [value, setValue] = useState("");
  const submit = (code: string) => {
    const c = code.trim();
    if (!c) return;
    onCode(c);
    setValue("");
  };
  return (
    <div className="flex items-center gap-2">
      <div className="relative flex-1">
        <ScanBarcode className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          autoFocus={autoFocus}
          value={value}
          placeholder={placeholder}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit(value);
            }
          }}
        />
      </div>
      <CameraScanner onScan={submit} />
    </div>
  );
}
