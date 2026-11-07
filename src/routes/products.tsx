import { createFileRoute } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import JsBarcode from "jsbarcode";
import { Plus, Pencil, Trash2, Search, FileDown, Barcode, Upload } from "lucide-react";
import { db } from "@/lib/db";
import { pageHead } from "@/lib/head";
import { PageBody } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
import { ConfirmDelete } from "@/components/common/confirm-delete";
import { CameraScanner } from "@/components/pos/camera-scanner";
import { EmptyState, Loader } from "@/components/common/states";
import { Pagination, usePagination } from "@/components/common/pagination";
import { exportExcel, importExcel } from "@/lib/excel";
import { fmtDate, inr } from "@/lib/format";
import { UNITS, type Product, type Unit } from "@/lib/types";
import { useAuth } from "@/store/auth";

export const Route = createFileRoute("/products")({
  head: () => pageHead("Products", "Manage grocery products, prices, GST, stock and barcodes."),
  component: ProductsPage,
});

const blank = (): Product => ({
  name: "",
  sku: "",
  barcode: String(Date.now()).slice(-12),
  categoryId: 0,
  brandId: 0,
  unit: "pcs",
  purchasePrice: 0,
  sellingPrice: 0,
  mrp: 0,
  gst: 5,
  hsn: "",
  stock: 0,
  minStock: 5,
  reorderLevel: 10,
  active: true,
  createdAt: new Date().toISOString(),
});

function ProductsPage() {
  const user = useAuth((s) => s.user);
  const products = useLiveQuery(() => db.products.toArray(), []);
  const categories = useLiveQuery(() => db.categories.toArray(), []);
  const brands = useLiveQuery(() => db.brands.toArray(), []);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [brand, setBrand] = useState("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Product>(blank());
  const [barcodeOf, setBarcodeOf] = useState<Product | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const rows = useMemo(() => {
    const list = products ?? [];
    const term = q.trim().toLowerCase();
    return list
      .filter((p) =>
        term
          ? p.name.toLowerCase().includes(term) ||
            p.sku.toLowerCase().includes(term) ||
            p.barcode.includes(term)
          : true,
      )
      .filter((p) => (cat === "all" ? true : p.categoryId === Number(cat)))
      .filter((p) => (brand === "all" ? true : p.brandId === Number(brand)))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [products, q, cat, brand]);

  const { page, pages, setPage, slice, total } = usePagination(rows, 10);

  if (!products || !categories || !brands) return <Loader label="Loading products..." />;

  const catName = (id: number) => categories.find((c) => c.id === id)?.name ?? "-";
  const brandName = (id: number) => brands.find((b) => b.id === id)?.name ?? "-";

  const save = async () => {
    if (!form.name.trim()) {
      toast.error("Product name is required");
      return;
    }
    if (!form.categoryId || !form.brandId) {
      toast.error("Pick a category and brand");
      return;
    }
    const payload = { ...form, name: form.name.trim() };
    if (form.id) {
      await db.products.update(form.id, payload);
      toast.success("Product updated");
    } else {
      await db.products.add(payload);
      toast.success("Product added");
    }
    await db.activity.add({
      date: new Date().toISOString(),
      user: user?.name ?? "System",
      action: form.id ? "Updated product" : "Added product",
      details: payload.name,
    });
    setOpen(false);
  };

  const onImport = async (file: File) => {
    try {
      const rowsIn = await importExcel(file);
      let added = 0;
      for (const r of rowsIn) {
        const name = String(r["name"] ?? r["Name"] ?? "").trim();
        if (!name) continue;
        await db.products.add({
          ...blank(),
          name,
          sku: String(r["sku"] ?? `SKU-${Date.now()}${added}`),
          barcode: String(r["barcode"] ?? Date.now() + added),
          categoryId: Number(r["categoryId"] ?? categories[0]?.id ?? 1),
          brandId: Number(r["brandId"] ?? brands[0]?.id ?? 1),
          unit: (String(r["unit"] ?? "pcs") as Unit) ?? "pcs",
          purchasePrice: Number(r["purchasePrice"] ?? 0),
          sellingPrice: Number(r["sellingPrice"] ?? 0),
          mrp: Number(r["mrp"] ?? 0),
          gst: Number(r["gst"] ?? 5),
          hsn: String(r["hsn"] ?? ""),
          stock: Number(r["stock"] ?? 0),
        });
        added++;
      }
      toast.success(`${added} products imported`);
    } catch {
      toast.error("Could not read that file");
    }
  };

  return (
    <PageBody>
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, SKU or barcode"
            className="pl-9"
          />
        </div>
        <Select value={cat} onValueChange={setCat}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={brand} onValueChange={setBrand}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All brands</SelectItem>
            {brands.map((b) => (
              <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onImport(f);
            e.target.value = "";
          }}
        />
        <Button variant="outline" onClick={() => fileRef.current?.click()}>
          <Upload className="size-4" /> Import
        </Button>
        <Button
          variant="outline"
          onClick={() =>
            exportExcel(
              rows.map((p) => ({
                name: p.name,
                sku: p.sku,
                barcode: p.barcode,
                category: catName(p.categoryId),
                brand: brandName(p.brandId),
                unit: p.unit,
                purchasePrice: p.purchasePrice,
                sellingPrice: p.sellingPrice,
                mrp: p.mrp,
                gst: p.gst,
                stock: p.stock,
              })),
              "products",
            )
          }
        >
          <FileDown className="size-4" /> Export
        </Button>
        <CameraScanner
          label="Scan to add"
          onScan={(code) => {
            const existing = products.find((p) => p.barcode === code || p.sku === code);
            if (existing) {
              toast.info(`"${existing.name}" already exists — opened for editing`);
              setForm(existing);
            } else {
              toast.success("Barcode captured — finish the product details");
              setForm({
                ...blank(),
                barcode: code,
                categoryId: categories[0]?.id ?? 0,
                brandId: brands[0]?.id ?? 0,
              });
            }
            setOpen(true);
          }}
        />
        <Button
          onClick={() => {
            setForm({ ...blank(), categoryId: categories[0]?.id ?? 0, brandId: brands[0]?.id ?? 0 });
            setOpen(true);
          }}
        >
          <Plus className="size-4" /> Add product
        </Button>
      </div>

      <Card className="card-elevated overflow-hidden p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Brand</TableHead>
                <TableHead className="text-right">Purchase</TableHead>
                <TableHead className="text-right">MRP</TableHead>
                <TableHead className="text-right">Our Price</TableHead>
                <TableHead className="text-right">GST</TableHead>
                <TableHead className="text-right">Stock</TableHead>
                <TableHead>Expiry</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {slice.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <div className="font-medium">{p.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {p.sku} · {p.barcode}
                    </div>
                  </TableCell>
                  <TableCell>{catName(p.categoryId)}</TableCell>
                  <TableCell>{brandName(p.brandId)}</TableCell>
                  <TableCell className="text-right">{inr(p.purchasePrice)}</TableCell>
                  <TableCell className="text-right">{inr(p.mrp)}</TableCell>
                  <TableCell className="text-right font-semibold">{inr(p.sellingPrice)}</TableCell>
                  <TableCell className="text-right">{p.gst}%</TableCell>
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
                  <TableCell className="text-sm text-muted-foreground">
                    {p.expiryDate ? fmtDate(p.expiryDate) : "-"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" onClick={() => setBarcodeOf(p)}>
                        <Barcode className="size-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          setForm(p);
                          setOpen(true);
                        }}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <ConfirmDelete
                        title={`Delete ${p.name}?`}
                        onConfirm={async () => {
                          await db.products.delete(p.id!);
                          toast.success("Product deleted");
                        }}
                        trigger={
                          <Button size="icon" variant="ghost" className="text-destructive">
                            <Trash2 className="size-4" />
                          </Button>
                        }
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {total === 0 && <EmptyState title="No products found" description="Try a different search or add a new product." />}
        <Pagination page={page} pages={pages} total={total} onChange={setPage} />
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form.id ? "Edit product" : "Add product"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name">
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="SKU">
              <Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
            </Field>
            <Field label="Barcode">
              <div className="flex items-center gap-2">
                <Input value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} />
                <CameraScanner onScan={(code) => setForm({ ...form, barcode: code })} />
              </div>
            </Field>
            <Field label="HSN">
              <Input value={form.hsn} onChange={(e) => setForm({ ...form, hsn: e.target.value })} />
            </Field>
            <Field label="Category">
              <Select value={String(form.categoryId)} onValueChange={(v) => setForm({ ...form, categoryId: Number(v) })}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Brand">
              <Select value={String(form.brandId)} onValueChange={(v) => setForm({ ...form, brandId: Number(v) })}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {brands.map((b) => (
                    <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Unit">
              <Select value={form.unit} onValueChange={(v) => setForm({ ...form, unit: v as Unit })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {UNITS.map((u) => (
                    <SelectItem key={u} value={u}>{u}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="GST %">
              <Input type="number" value={form.gst} onChange={(e) => setForm({ ...form, gst: Number(e.target.value) })} />
            </Field>
            <Field label="Purchase price (our cost)">
              <Input type="number" value={form.purchasePrice || ""} placeholder="0" onChange={(e) => setForm({ ...form, purchasePrice: Number(e.target.value) })} />
            </Field>
            <Field label="MRP (printed price)">
              <Input
                type="number"
                value={form.mrp || ""}
                placeholder="0"
                onChange={(e) => {
                  const mrp = Number(e.target.value);
                  setForm({ ...form, mrp, sellingPrice: form.sellingPrice ? form.sellingPrice : mrp });
                }}
              />
            </Field>
            <Field label="Our selling price">
              <Input type="number" value={form.sellingPrice || ""} placeholder="0" onChange={(e) => setForm({ ...form, sellingPrice: Number(e.target.value) })} />
              {form.mrp > 0 && form.sellingPrice > 0 && (
                <p className={`text-xs ${form.sellingPrice > form.mrp ? "text-destructive" : "text-muted-foreground"}`}>
                  {form.sellingPrice > form.mrp
                    ? "Selling price is above MRP"
                    : form.sellingPrice < form.mrp
                      ? `Customer saves ${inr(form.mrp - form.sellingPrice)} (${(((form.mrp - form.sellingPrice) / form.mrp) * 100).toFixed(0)}% off)`
                      : "Selling at MRP (no discount)"}
                </p>
              )}
            </Field>
            <Field label="Stock">
              <Input type="number" value={form.stock || ""} placeholder="0" onChange={(e) => setForm({ ...form, stock: Number(e.target.value) })} />
            </Field>
            <Field label="Min stock">
              <Input type="number" value={form.minStock} onChange={(e) => setForm({ ...form, minStock: Number(e.target.value) })} />
            </Field>
            <Field label="Reorder level">
              <Input type="number" value={form.reorderLevel} onChange={(e) => setForm({ ...form, reorderLevel: Number(e.target.value) })} />
            </Field>
            <Field label="Batch no.">
              <Input value={form.batchNo ?? ""} onChange={(e) => setForm({ ...form, batchNo: e.target.value })} />
            </Field>
            <Field label="Expiry date">
              <Input type="date" value={form.expiryDate?.slice(0, 10) ?? ""} onChange={(e) => setForm({ ...form, expiryDate: e.target.value })} />
            </Field>
            <Field label="Shelf / rack">
              <Input value={form.shelf ?? ""} onChange={(e) => setForm({ ...form, shelf: e.target.value })} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Description">
                <Textarea value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </Field>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save}>Save product</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BarcodeDialog product={barcodeOf} onClose={() => setBarcodeOf(null)} />
    </PageBody>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function BarcodeDialog({ product, onClose }: { product: Product | null; onClose: () => void }) {
  return (
    <Dialog open={!!product} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Barcode · {product?.name}</DialogTitle>
        </DialogHeader>
        <div className="grid place-items-center rounded-lg bg-white p-4">
          <svg
            ref={(el) => {
              if (el && product) {
                try {
                  JsBarcode(el, product.barcode || "0000000000", {
                    format: "CODE128",
                    height: 60,
                    fontSize: 14,
                  });
                } catch {
                  /* ignore invalid barcode */
                }
              }
            }}
          />
        </div>
        <p className="text-center text-sm text-muted-foreground">
          {product ? `${product.name} · ${inr(product.sellingPrice)}` : ""}
        </p>
        <DialogFooter>
          <Button onClick={() => window.print()}>Print label</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
