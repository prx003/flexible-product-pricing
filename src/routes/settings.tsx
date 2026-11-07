import { createFileRoute } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { db } from "@/lib/db";
import { pageHead } from "@/lib/head";
import { PageBody } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/store/auth";
import { gkLogoDataUrl } from "@/lib/gk-logo";
import type { Settings } from "@/lib/types";

export const Route = createFileRoute("/settings")({
  head: () => pageHead("Bill Settings", "Edit shop details, GST number, logo and wishes printed on bills."),
  component: SettingsPage,
});

function SettingsPage() {
  const role = useAuth((s) => s.user?.role);
  const saved = useLiveQuery(() => db.settings.get(1), []);
  const [f, setF] = useState<Settings | null>(null);
  const [preview, setPreview] = useState("");
  useEffect(() => { if (saved && !f) setF(saved); }, [saved, f]);
  useEffect(() => { setPreview(f?.logo || gkLogoDataUrl(200)); }, [f?.logo]);

  if (role !== "Admin" && role !== "Shop Owner")
    return <PageBody><Card className="p-6">Only the admin can edit bill settings.</Card></PageBody>;
  if (!f) return <PageBody><Card className="p-6">Loading…</Card></PageBody>;

  const set = (k: keyof Settings, v: unknown) => setF({ ...f, [k]: v });
  const save = async () => {
    await db.settings.update(1, f);
    toast.success("Bill settings saved");
  };
  const onLogo = (file?: File) => {
    if (!file) return;
    const r = new FileReader();
    r.onload = () => set("logo", r.result as string);
    r.readAsDataURL(file);
  };

  return (
    <PageBody>
      <Card className="card-elevated grid gap-4 p-5 sm:grid-cols-2">
        <div className="space-y-2"><Label>Shop name</Label><Input value={f.shopName} onChange={(e) => set("shopName", e.target.value)} /></div>
        <div className="space-y-2"><Label>GST number (GSTIN)</Label><Input value={f.gstin} onChange={(e) => set("gstin", e.target.value.toUpperCase())} placeholder="e.g. 36ABCDE1234F1Z5" /></div>
        <div className="space-y-2"><Label>Phone</Label><Input value={f.mobile} onChange={(e) => set("mobile", e.target.value)} /></div>
        <div className="space-y-2"><Label>Invoice prefix</Label><Input value={f.invoicePrefix} onChange={(e) => set("invoicePrefix", e.target.value)} /></div>
        <div className="space-y-2 sm:col-span-2"><Label>Address</Label><Textarea value={f.address} onChange={(e) => set("address", e.target.value)} /></div>
        <div className="space-y-2 sm:col-span-2"><Label>Wishes on bill</Label><Input value={f.wishes ?? ""} onChange={(e) => set("wishes", e.target.value)} placeholder="e.g. Happy Diwali!" /></div>
        <div className="space-y-2 sm:col-span-2"><Label>Footer note</Label><Input value={f.footerNote} onChange={(e) => set("footerNote", e.target.value)} /></div>
        <div className="flex items-center gap-4 sm:col-span-2">
          <img src={preview} alt="Bill logo" className="size-20 rounded-full border" />
          <div className="space-y-2">
            <div className="flex items-center gap-2"><Switch checked={f.showWatermark !== false} onCheckedChange={(v) => set("showWatermark", v)} /><Label>Show GK logo on bills and till receipts</Label></div>
            <div className="flex gap-2">
              <Input type="file" accept="image/png,image/jpeg" onChange={(e) => onLogo(e.target.files?.[0])} />
              {f.logo && <Button variant="outline" onClick={() => set("logo", undefined)}>Use GK logo</Button>}
            </div>
          </div>
        </div>
        <div className="sm:col-span-2"><Button onClick={save}>Save</Button></div>
      </Card>
    </PageBody>
  );
}
