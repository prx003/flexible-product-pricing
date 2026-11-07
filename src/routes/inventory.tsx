import { createFileRoute } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, ArrowDownUp, CalendarClock, FileDown, PackageMinus, XCircle } from "lucide-react";
import { db } from "@/lib/db";
import { pageHead } from "@/lib/head";
import { adjustStock } from "@/lib/sales";
import { PageBody } from "@/components/layout/app-shell";
import { StatCard } from "@/components/common/stat-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { CameraScanner } from "@/components/pos/camera-scanner";
import { Pagination, usePagination } from "@/components/common/pagination";
import { exportExcel } from "@/lib/excel";
import { daysBetween, fmtDate, fmtDateTime, inr } from "@/lib/format";
import { useAuth } from "@/store/auth";
import type { StockMovement } from "@/lib/types";

export const Route = createFileRoute("/inventory")({
  head: () => pageHead("Inventory", "Track stock levels, low-stock alerts, expiry and stock movements."),
  component: InventoryPage,
});

const ADJUST_TYPES: StockMovement["type"][] = [
  "stock-in",
  "stock-out",
  "adjustment",
  "damaged",
  "expired",
  "wastage",
  "audit",
];

function InventoryPage() {
  const user = useAuth((s) => s.user);
  const products = useLiveQuery(() => db.products.toArray(), []);
  const movements = useLiveQuery(
    () => db.stockMovements.orderBy("date").reverse().limit(500).toArray(),
    [],
  );
  const [open, setOpen] = useState(false);
  const [productId, setProductId] = useState("");
  const [type, setType] = useState<StockMovement["type"]>("stock-in");
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState("");

  const low = useMemo(
    () => (products ?? []).filter((p) => p.stock > 0 && p.stock <= p.minStock),
    [products],
  );
  const out = useMemo(() => (products ?? []).filter((p) => p.stock <= 0), [products]);
  const expiring = useMemo(
    () =>
      (products ?? [])
        .filter((p) => p.expiryDate && daysBetween(p.expiryDate) <= 30)
        .sort((a, b) => daysBetween(a.expiryDate!) - daysBetween(b.expiryDate!)),
    [products],
  );

  const movePage = usePagination(movements ?? [], 12);

  if (!products || !movements) return <Loader label="Loading inventory..." />;

  const stockValue = products.reduce((s, p) => s + p.stock * p.purchasePrice, 0);

  const submitAdjust = async () => {
    const id = Number(productId);
    if (!id) {
      toast.error("Select a product");
      return;
    }
    if (!qty || qty <= 0) {
      toast.error("Enter a valid quantity");
      return;
    }
    const negative = ["stock-out", "damaged", "expired", "wastage"].includes(type);
    const delta = type === "audit" ? 0 : negative ? -qty : qty;
    if (type === "audit") {
      const p = products.find((x) => x.id === id)!;
      await adjustStock(id, qty - p.stock, "audit", user?.name ?? "System", note || "Physical audit");
    } else {
      await adjustStock(id, delta, type, user?.name ?? "System", note);
    }
    toast.success("Stock updated");
    setOpen(false);
    setQty(1);
    setNote("");
  };

  return (
    <PageBody>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Stock value" value={inr(stockValue)} icon={<ArrowDownUp className="size-5" />} />
        <StatCard label="Low stock" value={String(low.length)} icon={<AlertTriangle className="size-5" />} tone="warning" />
        <StatCard label="Out of stock" value={String(out.length)} icon={<XCircle className="size-5" />} tone="danger" />
        <StatCard label="Expiring ≤30 days" value={String(expiring.length)} icon={<CalendarClock className="size-5" />} tone="accent" />

      </div>

      <div className="flex flex-wrap items-center justify-end gap-3">
        <Button
          variant="outline"
          onClick={() =>
            exportExcel(
              products.map((p) => ({
                name: p.name,
                sku: p.sku,
                stock: p.stock,
                minStock: p.minStock,
                value: p.stock * p.purchasePrice,
                expiry: p.expiryDate ?? "",
              })),
              "stock-report",
            )
          }
        >
          <FileDown className="size-4" /> Export stock
        </Button>
        <CameraScanner
          label="Scan to add stock"
          variant="default"
          onScan={(code) => {
            const p = products.find((x) => x.barcode === code || x.sku === code);
            if (p) {
              setProductId(String(p.id));
              setType("stock-in");
              setQty(1);
              setOpen(true);
              toast.success(`Scanned ${p.name} — enter quantity to add`);
            } else {
              toast.error("No product with this code", {
                description: "Add it first on the Products page.",
                action: { label: "Go to Products", onClick: () => { window.location.href = "/products"; } },
              });
            }
          }}
        />
        <Button variant="outline" onClick={() => setOpen(true)}>
          <PackageMinus className="size-4" /> Stock adjustment
        </Button>
      </div>

      <Tabs defaultValue="stock">
        <TabsList className="flex-wrap">
          <TabsTrigger value="stock">All stock</TabsTrigger>
          <TabsTrigger value="low">Low ({low.length})</TabsTrigger>
          <TabsTrigger value="out">Out ({out.length})</TabsTrigger>
          <TabsTrigger value="expiry">Expiry ({expiring.length})</TabsTrigger>
          <TabsTrigger value="moves">Movements</TabsTrigger>
        </TabsList>

        <TabsContent value="stock">
          <StockTable rows={products} />
        </TabsContent>
        <TabsContent value="low">
          <StockTable rows={low} />
        </TabsContent>
        <TabsContent value="out">
          <StockTable rows={out} />
        </TabsContent>
        <TabsContent value="expiry">
          <Card className="card-elevated overflow-hidden p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Batch</TableHead>
                  <TableHead>Expiry</TableHead>
                  <TableHead className="text-right">Days left</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expiring.map((p) => {
                  const d = daysBetween(p.expiryDate!);
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell>{p.batchNo ?? "-"}</TableCell>
                      <TableCell>{fmtDate(p.expiryDate!)}</TableCell>
                      <TableCell className="text-right">
                        <Badge
                          variant="outline"
                          className={d < 0 ? "border-destructive/40 text-destructive" : "border-warning/40 text-warning"}
                        >
                          {d < 0 ? `Expired ${-d}d ago` : `${d} days`}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{p.stock}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            {expiring.length === 0 && <EmptyState title="Nothing expiring soon" />}
          </Card>
        </TabsContent>

        <TabsContent value="moves">
          <Card className="card-elevated overflow-hidden p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Before</TableHead>
                    <TableHead className="text-right">After</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Note</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movePage.slice.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="whitespace-nowrap text-sm">{fmtDateTime(m.date)}</TableCell>
                      <TableCell className="font-medium">{m.productName}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">{m.type}</Badge>
                      </TableCell>
                      <TableCell className="text-right">{m.qty}</TableCell>
                      <TableCell className="text-right">{m.before}</TableCell>
                      <TableCell className="text-right">{m.after}</TableCell>
                      <TableCell>{m.user}</TableCell>
                      <TableCell className="text-muted-foreground">{m.note ?? "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {movePage.total === 0 && <EmptyState title="No stock movements yet" />}
            <Pagination
              page={movePage.page}
              pages={movePage.pages}
              total={movePage.total}
              onChange={movePage.setPage}
            />
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Stock adjustment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Product</Label>
              <div className="flex items-center gap-2">
                <Select value={productId} onValueChange={setProductId}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder="Select product" /></SelectTrigger>
                  <SelectContent className="max-h-72">
                    {products.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.name} ({p.stock} {p.unit})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <CameraScanner
                  onScan={(code) => {
                    const p = products.find((x) => x.barcode === code || x.sku === code);
                    if (p) {
                      setProductId(String(p.id));
                      toast.success(`Selected ${p.name}`);
                    } else {
                      toast.error("No product matches that code");
                    }
                  }}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as StockMovement["type"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ADJUST_TYPES.map((t) => (
                    <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{type === "audit" ? "Counted quantity" : "Quantity"}</Label>
              <Input type="number" value={qty} onChange={(e) => setQty(Number(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>Note</Label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={submitAdjust}>Apply</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageBody>
  );
}

function StockTable({ rows }: { rows: { id?: number | undefined; name: string; sku: string; stock: number; minStock: number; unit: string; purchasePrice: number; sellingPrice: number }[] }) {
  const pg = usePagination(rows, 12);
  return (
    <Card className="card-elevated overflow-hidden p-0">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead className="text-right">Stock</TableHead>
              <TableHead className="text-right">Min</TableHead>
              <TableHead className="text-right">Cost value</TableHead>
              <TableHead className="text-right">Retail value</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pg.slice.map((p) => (
              <TableRow key={p.id}>
                <TableCell>
                  <div className="font-medium">{p.name}</div>
                  <div className="text-xs text-muted-foreground">{p.sku}</div>
                </TableCell>
                <TableCell className="text-right">
                  <Badge
                    variant="outline"
                    className={
                      p.stock <= 0
                        ? "border-destructive/40 text-destructive"
                        : p.stock <= p.minStock
                          ? "border-warning/40 text-warning"
                          : "border-success/40 text-success"
                    }
                  >
                    {p.stock} {p.unit}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">{p.minStock}</TableCell>
                <TableCell className="text-right">{inr(p.stock * p.purchasePrice)}</TableCell>
                <TableCell className="text-right">{inr(p.stock * p.sellingPrice)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {pg.total === 0 && <EmptyState title="No products in this view" />}
      <Pagination page={pg.page} pages={pg.pages} total={pg.total} onChange={pg.setPage} />
    </Card>
  );
}
