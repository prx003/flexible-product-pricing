import { createFileRoute } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Search, Trash2, FileDown } from "lucide-react";
import { db } from "@/lib/db";
import { pageHead } from "@/lib/head";
import { adjustStock } from "@/lib/sales";
import { PageBody } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, Loader } from "@/components/common/states";
import { Pagination, usePagination } from "@/components/common/pagination";
import { exportExcel } from "@/lib/excel";
import { fmtDate, inr, round2 } from "@/lib/format";
import { useAuth } from "@/store/auth";
import type { PurchaseItem } from "@/lib/types";

export const Route = createFileRoute("/purchases")({
  head: () => pageHead("Purchases", "Record supplier purchase bills and receive stock into inventory."),
  component: PurchasesPage,
});

function PurchasesPage() {
  const user = useAuth((s) => s.user);
  const purchases = useLiveQuery(() => db.purchases.orderBy("date").reverse().toArray(), []);
  const suppliers = useLiveQuery(() => db.suppliers.toArray(), []);
  const products = useLiveQuery(() => db.products.toArray(), []);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [supplierId, setSupplierId] = useState("");
  const [billNo, setBillNo] = useState("");
  const [paid, setPaid] = useState(0);
  const [items, setItems] = useState<PurchaseItem[]>([]);
  const [pick, setPick] = useState("");

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (purchases ?? []).filter((p) =>
      term ? p.billNo.toLowerCase().includes(term) || p.supplierName.toLowerCase().includes(term) : true,
    );
  }, [purchases, q]);
  const pg = usePagination(rows, 10);

  if (!purchases || !suppliers || !products) return <Loader label="Loading purchases..." />;

  const subtotal = round2(items.reduce((s, i) => s + i.cost * i.qty, 0));
  const tax = round2(items.reduce((s, i) => s + (i.cost * i.qty * i.gst) / 100, 0));
  const total = round2(subtotal + tax);

  const addItem = (id: number) => {
    const p = products.find((x) => x.id === id);
    if (!p) return;
    if (items.some((i) => i.productId === id)) return;
    setItems([
      ...items,
      { productId: id, name: p.name, qty: 1, cost: p.purchasePrice, gst: p.gst, total: p.purchasePrice },
    ]);
  };

  const update = (id: number, patch: Partial<PurchaseItem>) =>
    setItems(
      items.map((i) =>
        i.productId === id
          ? { ...i, ...patch, total: round2((patch.cost ?? i.cost) * (patch.qty ?? i.qty)) }
          : i,
      ),
    );

  const save = async (status: "ordered" | "received") => {
    const sup = suppliers.find((s) => s.id === Number(supplierId));
    if (!sup) {
      toast.error("Select a supplier");
      return;
    }
    if (items.length === 0) {
      toast.error("Add at least one item");
      return;
    }
    const ref = billNo.trim() || `PB-${Date.now().toString().slice(-6)}`;
    await db.purchases.add({
      billNo: ref,
      date: new Date().toISOString(),
      supplierId: sup.id!,
      supplierName: sup.name,
      items,
      subtotal,
      tax,
      total,
      paid,
      status,
    });
    if (status === "received") {
      for (const i of items) {
        await adjustStock(i.productId, i.qty, "purchase", user?.name ?? "System", `Purchase ${ref}`);
        await db.products.update(i.productId, { purchasePrice: i.cost });
      }
    }
    await db.suppliers.update(sup.id!, { balance: round2(sup.balance + total - paid) });
    toast.success(status === "received" ? "Purchase received & stock updated" : "Purchase order saved");
    setOpen(false);
    setItems([]);
    setBillNo("");
    setPaid(0);
  };

  return (
    <PageBody>
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search bill or supplier" className="pl-9" />
        </div>
        <Button
          variant="outline"
          onClick={() =>
            exportExcel(
              rows.map((p) => ({ billNo: p.billNo, date: p.date, supplier: p.supplierName, total: p.total, paid: p.paid, status: p.status })),
              "purchases",
            )
          }
        >
          <FileDown className="size-4" /> Export
        </Button>
        <Button onClick={() => setOpen(true)}>
          <Plus className="size-4" /> New purchase
        </Button>
      </div>

      <Card className="card-elevated overflow-hidden p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Bill</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead className="text-right">Items</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pg.slice.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.billNo}</TableCell>
                  <TableCell>{fmtDate(p.date)}</TableCell>
                  <TableCell>{p.supplierName}</TableCell>
                  <TableCell className="text-right">{p.items.length}</TableCell>
                  <TableCell className="text-right">{inr(p.total)}</TableCell>
                  <TableCell className="text-right">{inr(p.paid)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">{p.status}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {pg.total === 0 && <EmptyState title="No purchases yet" description="Create a purchase to receive stock." />}
        <Pagination page={pg.page} pages={pg.pages} total={pg.total} onChange={pg.setPage} />
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader><DialogTitle>New purchase</DialogTitle></DialogHeader>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Supplier</Label>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Bill number</Label>
              <Input value={billNo} onChange={(e) => setBillNo(e.target.value)} placeholder="Auto" />
            </div>
            <div className="space-y-2">
              <Label>Amount paid</Label>
              <Input type="number" value={paid} onChange={(e) => setPaid(Number(e.target.value))} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Add product</Label>
            <Select
              value={pick}
              onValueChange={(v) => {
                addItem(Number(v));
                setPick("");
              }}
            >
              <SelectTrigger><SelectValue placeholder="Search and add product" /></SelectTrigger>
              <SelectContent className="max-h-72">
                {products.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead className="w-24">Qty</TableHead>
                  <TableHead className="w-28">Cost</TableHead>
                  <TableHead className="w-20">GST%</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((i) => (
                  <TableRow key={i.productId}>
                    <TableCell>{i.name}</TableCell>
                    <TableCell>
                      <Input type="number" value={i.qty} onChange={(e) => update(i.productId, { qty: Number(e.target.value) })} />
                    </TableCell>
                    <TableCell>
                      <Input type="number" value={i.cost} onChange={(e) => update(i.productId, { cost: Number(e.target.value) })} />
                    </TableCell>
                    <TableCell>{i.gst}%</TableCell>
                    <TableCell className="text-right">{inr(i.total)}</TableCell>
                    <TableCell>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => setItems(items.filter((x) => x.productId !== i.productId))}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {items.length === 0 && <EmptyState title="No items added" />}
          </div>

          <div className="flex flex-col items-end gap-1 text-sm">
            <span>Subtotal: {inr(subtotal)}</span>
            <span>GST: {inr(tax)}</span>
            <span className="text-lg font-bold">Total: {inr(total)}</span>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => void save("ordered")}>Save as order</Button>
            <Button onClick={() => void save("received")}>Receive stock</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageBody>
  );
}
