import { useEffect, useState } from "react";
import { Pencil, RefreshCw, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { inr } from "@/lib/format";
import { DEFAULT_UPI_ID, makeUpiQr, type UpiQrResult } from "@/lib/upi";

interface Props {
  amount: number;
  shopName: string;
  upiId?: string | undefined;
  onSaveUpiId: (v: string) => Promise<void> | void;
}

/**
 * Fixed-amount UPI QR shown at the billing screen. Customer scans it with
 * any UPI app; money goes straight to the shop's bank account. The cashier
 * confirms receipt and completes the bill as usual.
 */
export function UpiQrPanel({ amount, shopName, upiId, onSaveUpiId }: Props) {
  const [qr, setQr] = useState<UpiQrResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(upiId ?? DEFAULT_UPI_ID);
  const [savedId, setSavedId] = useState(upiId ?? DEFAULT_UPI_ID);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    void makeUpiQr({
      vpa: savedId,
      name: shopName || "Shop",
      amount,
      note: shopName || "Shop",
    })
      .then((r) => {
        if (alive) setQr(r);
      })
      .catch(() => {
        if (alive) setQr(null);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [amount, savedId, shopName]);

  if (amount < 1) return null;

  const save = async () => {
    const v = draft.trim();
    if (!v.includes("@")) {
      toast.error("UPI ID looks wrong — it should be like name@bank");
      return;
    }
    await onSaveUpiId(v);
    setSavedId(v);
    setEditing(false);
    toast.success("UPI ID saved");
  };

  return (
    <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 text-center">
      <p className="text-xs font-medium text-muted-foreground">
        Scan with any UPI app — PhonePe, Google Pay, Paytm, BHIM
      </p>
      <div className="mt-2 flex items-center justify-center">
        {loading ? (
          <RefreshCw className="size-6 animate-spin text-muted-foreground" />
        ) : qr ? (
          <img
            src={qr.qrImage}
            alt="UPI payment QR code"
            className="size-44 rounded-lg bg-background"
          />
        ) : (
          <p className="py-10 text-xs text-destructive">
            Could not generate the QR. Check the UPI ID.
          </p>
        )}
      </div>
      <p className="mt-2 text-lg font-extrabold text-primary">{inr(amount)}</p>
      {editing ? (
        <div className="mt-2 flex items-center justify-center gap-2">
          <Input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="yourshop@bank"
            className="h-8 w-44 text-center text-xs"
          />
          <Button size="sm" className="h-8" onClick={() => void save()}>
            Save
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8"
            onClick={() => {
              setDraft(savedId);
              setEditing(false);
            }}
          >
            Cancel
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <Smartphone className="size-3" /> {savedId}
          <Pencil className="size-3" />
        </button>
      )}
    </div>
  );
}
