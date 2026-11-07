import { createFileRoute } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Search,
  Plus,
  Minus,
  Trash2,
  ShoppingCart,
  UserPlus,
  Pause,
  Play,
  XCircle,
  Percent,
  Printer,
  Download,
  Share2,
  Barcode,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { db } from "@/lib/db";
import { computeTotals, useCart } from "@/store/cart";
import { useAuth } from "@/store/auth";
import { completeSale, getSettings } from "@/lib/sales";
import { downloadInvoice, printThermal } from "@/lib/invoice";
import { inr, round2 } from "@/lib/format";
import type { Customer, PaymentMethod, Product, Sale, Settings } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { EmptyState, Loader } from "@/components/common/states";
import { CameraScanner } from "@/components/pos/camera-scanner";
import { UpiQrPanel } from "@/components/pos/upi-qr-panel";
import { cn } from "@/lib/utils";
import { BILL_LIMIT_MESSAGE, MAX_BILL_ITEMS } from "@/lib/bill-limits";

export const Route = createFileRoute("/pos")({
  head: () => ({
    meta: [
      { title: "POS Billing — G.K Mart" },
      {
        name: "description",
        content: "Fast touch-friendly grocery billing with barcode scanning and GST invoices.",
      },
      { property: "og:title", content: "POS Billing — G.K Mart" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      {
        property: "og:description",
        content: "Fast touch-friendly grocery billing with barcode scanning and GST invoices.",
      },
    ],
  }),
  component: PosPage,
});

const PAY_METHODS: PaymentMethod[] = ["Cash", "UPI", "Card", "Bank Transfer", "Credit"];

function PosPage() {
  const user = useAuth((s) => s.user);
  const cart = useCart();
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState("all");
  const [brandId, setBrandId] = useState("all");
  const searchRef = useRef<HTMLInputElement>(null);

  const [settings, setSettings] = useState<Settings | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [method, setMethod] = useState<PaymentMethod>("Cash");
  const [received, setReceived] = useState("");
  const [splitUpi, setSplitUpi] = useState("");
  const [lastSale, setLastSale] = useState<Sale | null>(null);
  const [coupon, setCoupon] = useState("");
  const [busy, setBusy] = useState(false);

  const data = useLiveQuery(async () => {
    const [products, categories, brands, customers, held] = await Promise.all([
      db.products.filter((p) => p.active).toArray(),
      db.categories.toArray(),
      db.brands.toArray(),
      db.customers.toArray(),
      db.heldBills.toArray(),
    ]);
    return { products, categories, brands, customers, held };
  }, []);

  useEffect(() => {
    void getSettings().then(setSettings);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "F2") {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === "F9") {
        e.preventDefault();
        setPayOpen(true);
      }
      if (e.key === "Escape") setPayOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const totals = useMemo(
    () =>
      computeTotals(cart.items, {
        billDiscount: cart.billDiscount,
        billDiscountType: cart.billDiscountType,
        couponValue: cart.couponValue,
        pointsAmt: cart.pointsRedeemed * (settings?.pointValue ?? 0.25),
        interState: settings?.interState ?? false,
        roundOffEnabled: settings?.roundOff ?? true,
      }),
    [cart.items, cart.billDiscount, cart.billDiscountType, cart.couponValue, cart.pointsRedeemed, settings],
  );

  const mrpSavings = round2(
    cart.items.reduce((s, i) => s + Math.max(0, i.mrp - i.price) * i.qty, 0),
  );

  if (!data || !settings) return <Loader label="Preparing billing screen..." />;
  const { products, categories, brands, customers, held } = data;

  const filtered = products.filter((p) => {
    const q = query.trim().toLowerCase();
    const match =
      !q ||
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      p.barcode.includes(q);
    return (
      match &&
      (categoryId === "all" || p.categoryId === Number(categoryId)) &&
      (brandId === "all" || p.brandId === Number(brandId))
    );
  });

  const addProduct = (p: Product) => {
    if (cart.items.length >= MAX_BILL_ITEMS && !cart.items.some((i) => i.productId === p.id)) {
      toast.error(BILL_LIMIT_MESSAGE);
      return false;
    }
    if (p.stock <= 0) {
      toast.error(`${p.name} is out of stock`);
      return;
    }
    const inCart = cart.items.find((i) => i.productId === p.id)?.qty ?? 0;
    if (inCart + 1 > p.stock) {
      toast.error(`Only ${p.stock} ${p.unit} available`);
      return;
    }
    cart.add(p);
    return true;
  };

  /** Quantity changes are limited to the stock the shop actually has. */
  const changeQty = (productId: number, qty: number) => {
    const p = products.find((x) => x.id === productId);
    if (p && qty > p.stock) {
      toast.error(`Stock limit — only ${p.stock} ${p.unit} of ${p.name} available`);
      qty = p.stock;
    }
    cart.setQty(productId, qty);
  };

  const handleScan = (code: string) => {
    const p = products.find((x) => x.barcode === code || x.sku === code);
    if (!p) {
      toast.error(`No product for code ${code}`);
      return;
    }
    if (addProduct(p)) toast.success(`${p.name} added`);
  };

  const applyCoupon = async () => {
    const code = coupon.trim().toUpperCase();
    if (!code) return;
    const offer = await db.offers.where("code").equals(code).first();
    const now = new Date().toISOString().slice(0, 10);
    if (!offer || !offer.active || offer.startDate > now || offer.endDate < now) {
      toast.error("Invalid or expired coupon");
      return;
    }
    if (totals.subtotal < offer.minBill) {
      toast.error(`Coupon needs a minimum bill of ${inr(offer.minBill)}`);
      return;
    }
    const value =
      offer.type === "coupon" && offer.value <= 100 && offer.name.includes("%")
        ? (totals.subtotal * offer.value) / 100
        : offer.value <= 100 && offer.value > 0 && offer.name.toLowerCase().includes("%")
          ? (totals.subtotal * offer.value) / 100
          : offer.value;
    const amount = offer.name.includes("%") ? (totals.subtotal * offer.value) / 100 : value;
    cart.setCoupon(code, Math.round(amount * 100) / 100);
    toast.success(`Coupon ${code} applied`);
  };

  const holdBill = async () => {
    if (!cart.items.length) return;
    await db.heldBills.add({
      ref: `HOLD-${Date.now().toString().slice(-6)}`,
      date: new Date().toISOString(),
      customerName: cart.customer?.name ?? "Walk-in Customer",
      items: cart.items,
      note: cart.notes,
    });
    cart.clear();
    toast.success("Bill held. Resume it anytime.");
  };

  const resumeBill = async (id: number) => {
    const bill = await db.heldBills.get(id);
    if (!bill) return;
    if (bill.items.length > MAX_BILL_ITEMS) {
      toast.error(BILL_LIMIT_MESSAGE);
      return;
    }
    cart.load(bill.items);
    await db.heldBills.delete(id);
    toast.success("Held bill resumed");
  };

  const doCheckout = async () => {
    if (!cart.items.length) return;
    if (cart.items.length > MAX_BILL_ITEMS) {
      toast.error(BILL_LIMIT_MESSAGE);
      return;
    }
    const overStock = cart.items.find((i) => {
      const p = products.find((x) => x.id === i.productId);
      return p && i.qty > p.stock;
    });
    if (overStock) {
      const p = products.find((x) => x.id === overStock.productId);
      toast.error(`Stock limit — only ${p?.stock} ${p?.unit} of ${overStock.name} available`);
      return;
    }
    setBusy(true);
    try {
      const rec = method === "Credit" ? 0 : Number(received || totals.total);
      const upi = Number(splitUpi || 0);
      const payments =
        method === "Split"
          ? [
              { method: "Cash" as PaymentMethod, amount: Math.max(0, rec - upi) },
              { method: "UPI" as PaymentMethod, amount: upi },
            ]
          : [{ method, amount: method === "Credit" ? 0 : rec }];
      const credit = method === "Credit" ? totals.total : Math.max(0, totals.total - rec);
      if (method !== "Credit" && rec < totals.total && !cart.customer) {
        toast.error("Partial payment needs a customer for credit tracking");
        setBusy(false);
        return;
      }
      const sale = await completeSale({
        items: cart.items,
        totals,
        ...(cart.customer?.id ? { customerId: cart.customer.id } : {}),
        customerName: cart.customer?.name ?? "Walk-in Customer",
        ...(cart.customer?.mobile ? { customerMobile: cart.customer.mobile } : {}),
        cashier: user?.name ?? "Cashier",
        payments,
        received: rec,
        creditAmount: credit,
        ...(cart.coupon ? { coupon: cart.coupon } : {}),
        ...(cart.notes ? { notes: cart.notes } : {}),
        pointsRedeemed: cart.pointsRedeemed,
      });
      setLastSale(sale);
      cart.clear();
      setReceived("");
      setCoupon("");
      setPayOpen(false);
      toast.success(`Sale saved · ${sale.invoiceNo}`);
    } catch (e) {
      console.error(e);
      toast.error("Could not complete the sale");
    } finally {
      setBusy(false);
    }
  };

  const balance =
    (received === "" ? totals.total : Number(received)) - totals.total;

  const saveUpiId = async (v: string) => {
    await db.settings.update(1, { upiId: v });
    setSettings((s) => (s ? { ...s, upiId: v } : s));
  };


  return (
    <div className="grid gap-4 p-3 sm:p-4 xl:grid-cols-[1.5fr_1fr_0.9fr]">
      {/* Products */}
      <div className="min-w-0 space-y-3">
        <Card className="card-elevated p-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-0 flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={searchRef}
                placeholder="Search name, barcode or SKU (F2)"
                className="pl-9"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const exact = products.find(
                      (p) => p.barcode === query.trim() || p.sku === query.trim(),
                    );
                    if (exact) {
                      addProduct(exact);
                      setQuery("");
                    } else if (filtered[0]) {
                      addProduct(filtered[0]);
                      setQuery("");
                    }
                  }
                }}
              />
            </div>
            <CameraScanner onScan={handleScan} />
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={brandId} onValueChange={setBrandId}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Brand" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All brands</SelectItem>
                {brands.map((b) => (
                  <SelectItem key={b.id} value={String(b.id)}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </Card>

        <div className="scroll-thin grid max-h-[calc(100vh-14rem)] grid-cols-2 gap-3 overflow-y-auto pr-1 sm:grid-cols-3 2xl:grid-cols-4">
          {filtered.length === 0 && (
            <div className="col-span-full">
              <EmptyState title="No products found" description="Try a different search or filter." />
            </div>
          )}
          {filtered.slice(0, 120).map((p) => (
            <motion.button
              key={p.id}
              whileTap={{ scale: 0.96 }}
              onClick={() => addProduct(p)}
              className={cn(
                "flex flex-col overflow-hidden rounded-xl border bg-card p-3 text-left transition-all hover:border-primary hover:shadow-md",
                p.stock <= 0 && "opacity-60",
              )}
            >
              <div className="mb-2 grid h-16 place-items-center rounded-lg bg-primary/8 text-2xl">
                🛒
              </div>
              <p className="line-clamp-2 min-h-9 text-xs font-semibold">{p.name}</p>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-sm font-bold text-primary">{inr(p.sellingPrice)}</span>
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px]",
                    p.stock <= 0
                      ? "border-destructive/40 text-destructive"
                      : p.stock <= p.minStock
                        ? "border-warning/50"
                        : "border-success/40 text-success",
                  )}
                >
                  {p.stock} {p.unit}
                </Badge>
              </div>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Cart */}
      <Card className="card-elevated flex max-h-[calc(100vh-7rem)] min-w-0 flex-col p-0">
        <div className="flex items-center justify-between border-b p-3">
          <div className="flex items-center gap-2 font-semibold">
            <ShoppingCart className="size-4 text-primary" /> Cart ({cart.items.length})
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => cart.clear()}
            disabled={!cart.items.length}
          >
            <Trash2 className="size-4" /> Clear
          </Button>
        </div>
        <div className="scroll-thin flex-1 overflow-y-auto p-3">
          {cart.items.length === 0 ? (
            <EmptyState
              icon={<ShoppingCart className="size-7" />}
              title="Cart is empty"
              description="Search or scan a product to start billing."
            />
          ) : (
            <div className="space-y-2">
              {cart.items.map((i) => (
                <div key={i.productId} className="rounded-lg border p-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 flex-1 truncate text-sm font-medium">{i.name}</p>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 text-destructive"
                      onClick={() => cart.remove(i.productId)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <div className="flex items-center rounded-lg border">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        onClick={() => changeQty(i.productId, i.qty - 1)}
                      >
                        <Minus className="size-3.5" />
                      </Button>
                      <Input
                        className="h-8 w-16 border-0 text-center"
                        value={i.qty}
                        onChange={(e) => changeQty(i.productId, Number(e.target.value) || 0)}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        onClick={() => changeQty(i.productId, i.qty + 1)}
                      >
                        <Plus className="size-3.5" />
                      </Button>
                    </div>
                    <span className="flex flex-col text-xs leading-tight text-muted-foreground">
                      <span>
                        MRP{" "}
                        <span className={i.mrp > i.price ? "line-through" : ""}>
                          {inr(i.mrp || i.price)}
                        </span>
                      </span>
                      <span>
                        Our {i.unit} ×{" "}
                        <span className="font-semibold text-foreground">{inr(i.price)}</span>
                      </span>
                      {i.mrp > i.price && (
                        <span className="text-xs font-medium text-emerald-600">
                          Discount {inr((i.mrp - i.price) * i.qty)}
                        </span>
                      )}
                    </span>
                    <Input
                      className="h-8 w-20"
                      placeholder="Disc ₹"
                      value={i.discount || ""}
                      onChange={(e) => cart.setDiscount(i.productId, Number(e.target.value) || 0)}
                    />
                    <span className="ml-auto text-right">
                      {Math.max(i.mrp, i.price) * i.qty > i.total && (
                        <span className="block text-xs text-muted-foreground line-through">
                          {inr(Math.max(i.mrp, i.price) * i.qty)}
                        </span>
                      )}
                      <span className="text-sm font-bold">{inr(i.total)}</span>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="grid grid-cols-3 gap-2 border-t p-3">
          <Button variant="outline" size="sm" onClick={holdBill} disabled={!cart.items.length}>
            <Pause className="size-4" /> Hold
          </Button>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Play className="size-4" /> Held ({held.length})
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Held bills</DialogTitle>
              </DialogHeader>
              {held.length === 0 ? (
                <EmptyState title="No held bills" />
              ) : (
                <div className="space-y-2">
                  {held.map((h) => (
                    <div
                      key={h.id}
                      className="flex items-center justify-between rounded-lg border p-3 text-sm"
                    >
                      <div>
                        <p className="font-medium">{h.ref}</p>
                        <p className="text-xs text-muted-foreground">
                          {h.customerName} · {h.items.length} items
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => resumeBill(h.id!)}>
                          Resume
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={async () => {
                            await db.heldBills.delete(h.id!);
                            toast.success("Held bill removed");
                          }}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </DialogContent>
          </Dialog>
          <Button
            variant="outline"
            size="sm"
            className="text-destructive"
            onClick={() => {
              cart.clear();
              toast.info("Bill cancelled");
            }}
          >
            <XCircle className="size-4" /> Cancel
          </Button>
        </div>
      </Card>

      {/* Summary */}
      <Card className="card-elevated flex max-h-[calc(100vh-7rem)] min-w-0 flex-col overflow-y-auto p-4">
        <CustomerPicker customers={customers} />

        <Separator className="my-3" />

        <div className="space-y-2">
          <Label className="text-xs">Bill discount</Label>
          <div className="flex gap-2">
            <Input
              type="number"
              value={cart.billDiscount || ""}
              placeholder="0"
              onChange={(e) =>
                cart.setBillDiscount(Number(e.target.value) || 0, cart.billDiscountType)
              }
            />
            <Select
              value={cart.billDiscountType}
              onValueChange={(v) => cart.setBillDiscount(cart.billDiscount, v as "percent" | "fixed")}
            >
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="percent">%</SelectItem>
                <SelectItem value="fixed">₹</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="Coupon code"
              value={coupon}
              onChange={(e) => setCoupon(e.target.value)}
            />
            <Button variant="outline" onClick={applyCoupon}>
              <Percent className="size-4" /> Apply
            </Button>
          </div>
          {cart.customer && cart.customer.loyaltyPoints > 0 && (
            <div className="flex items-center gap-2">
              <Input
                type="number"
                placeholder={`Redeem points (max ${cart.customer.loyaltyPoints})`}
                value={cart.pointsRedeemed || ""}
                onChange={(e) =>
                  cart.setPoints(
                    Math.min(Number(e.target.value) || 0, cart.customer!.loyaltyPoints),
                  )
                }
              />
              <span className="whitespace-nowrap text-xs text-muted-foreground">
                = {inr(cart.pointsRedeemed * settings.pointValue)}
              </span>
            </div>
          )}
          <Textarea
            placeholder="Bill notes"
            rows={2}
            value={cart.notes}
            onChange={(e) => cart.setNotes(e.target.value)}
          />
        </div>

        <Separator className="my-3" />

        <dl className="space-y-1.5 text-sm">
          <Row label="Subtotal" value={inr(totals.gross)} />
          {mrpSavings > 0 && (
            <Row label="Discount (MRP − our price)" value={"-" + inr(mrpSavings)} />
          )}
          <Row label="Item discount" value={"-" + inr(totals.itemDiscount)} />
          <Row label="Bill discount" value={"-" + inr(totals.billDiscountAmt)} />
          {totals.couponAmt > 0 && <Row label={`Coupon ${cart.coupon}`} value={"-" + inr(totals.couponAmt)} />}
          {totals.pointsAmt > 0 && <Row label="Points redeemed" value={"-" + inr(totals.pointsAmt)} />}
          <Row label="Taxable value" value={inr(totals.taxable)} />
          {settings.interState ? (
            <Row label="IGST" value={inr(totals.igst)} />
          ) : (
            <>
              <Row label="CGST" value={inr(totals.cgst)} />
              <Row label="SGST" value={inr(totals.sgst)} />
            </>
          )}
          <Row label="Round off" value={inr(totals.roundOff)} />
        </dl>

        <div className="mt-3 flex items-center justify-between rounded-xl bg-primary/10 px-4 py-3">
          <span className="font-semibold">Grand Total</span>
          <span className="text-2xl font-extrabold text-primary">{inr(totals.total)}</span>
        </div>

        <Dialog open={payOpen} onOpenChange={setPayOpen}>
          <DialogTrigger asChild>
            <Button size="lg" className="mt-4 h-14 text-base" disabled={!cart.items.length}>
              Pay & Checkout (F9)
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Payment · {inr(totals.total)}</DialogTitle>
              {mrpSavings > 0 && (
                <p className="text-xs text-success">Discount applied: −{inr(mrpSavings)} (MRP − our price)</p>
              )}
            </DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                {[...PAY_METHODS, "Split" as PaymentMethod].map((m) => (
                  <Button
                    key={m}
                    variant={method === m ? "default" : "outline"}
                    onClick={() => setMethod(m)}
                    className="h-12"
                  >
                    {m}
                  </Button>
                ))}
              </div>
              {method !== "Credit" && (
                <div className="space-y-2">
                  <Label>Amount received</Label>
                  <Input
                    autoFocus
                    type="number"
                    value={received}
                    placeholder={String(totals.total)}
                    onChange={(e) => setReceived(e.target.value)}
                  />
                  <div className="flex flex-wrap gap-2">
                    {[totals.total, 500, 1000, 2000].map((v, i) => (
                      <Button
                        key={i}
                        variant="outline"
                        size="sm"
                        onClick={() => setReceived(String(v))}
                      >
                        {inr(v)}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
              {method === "Split" && (
                <div className="space-y-2">
                  <Label>Of which paid by UPI</Label>
                  <Input
                    type="number"
                    value={splitUpi}
                    onChange={(e) => setSplitUpi(e.target.value)}
                  />
                </div>
              )}
              {(method === "UPI" || (method === "Split" && Number(splitUpi) >= 1)) && (
                <UpiQrPanel
                  amount={method === "Split" ? Number(splitUpi) : totals.total}
                  shopName={settings?.shopName ?? "Shop"}
                  upiId={settings?.upiId}
                  onSaveUpiId={saveUpiId}
                />
              )}
              <div className="rounded-lg bg-muted p-3 text-sm">
                <div className="flex justify-between">
                  <span>Total payable</span>
                  <span className="font-semibold">{inr(totals.total)}</span>
                </div>
                <div className="flex justify-between">
                  <span>{balance >= 0 ? "Change to return" : "Remaining / credit"}</span>
                  <span className="font-semibold">{inr(Math.abs(balance))}</span>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={doCheckout} disabled={busy} className="w-full h-12">
                <CheckCircle2 className="size-4" /> Confirm payment
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {lastSale && (
          <div className="mt-4 rounded-xl border border-success/40 bg-success/8 p-3">
            <p className="text-sm font-semibold text-success">
              Last bill {lastSale.invoiceNo} · {inr(lastSale.total)}
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Button size="sm" variant="outline" onClick={() => printThermal(lastSale, settings)}>
                <Printer className="size-4" /> Thermal
              </Button>
              <Button size="sm" variant="outline" onClick={() => downloadInvoice(lastSale, settings)}>
                <Download className="size-4" /> PDF
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

function CustomerPicker({ customers }: { customers: Customer[] }) {
  const cart = useCart();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", mobile: "" });

  const matches = q
    ? customers.filter(
        (c) => c.mobile.includes(q) || c.name.toLowerCase().includes(q.toLowerCase()),
      )
    : [];

  const addCustomer = async () => {
    if (!form.name.trim() || form.mobile.trim().length < 10) {
      toast.error("Enter a name and valid 10-digit mobile");
      return;
    }
    const id = await db.customers.add({
      name: form.name.trim(),
      mobile: form.mobile.trim(),
      type: "Retail",
      creditLimit: 5000,
      creditBalance: 0,
      loyaltyPoints: 0,
      wallet: 0,
      membership: "Bronze",
      createdAt: new Date().toISOString(),
    });
    const c = await db.customers.get(id as number);
    cart.setCustomer(c ?? null);
    setOpen(false);
    setForm({ name: "", mobile: "" });
    toast.success("Customer added");
  };

  return (
    <div className="space-y-2">
      <Label className="text-xs">Customer</Label>
      {cart.customer ? (
        <div className="flex items-center justify-between rounded-lg border p-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{cart.customer.name}</p>
            <p className="text-xs text-muted-foreground">
              {cart.customer.mobile} · {cart.customer.membership} ·{" "}
              {cart.customer.loyaltyPoints} pts
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => cart.setCustomer(null)}>
            Change
          </Button>
        </div>
      ) : (
        <>
          <div className="flex gap-2">
            <Input
              placeholder="Search mobile / name"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="icon">
                  <UserPlus className="size-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-sm">
                <DialogHeader>
                  <DialogTitle>New customer</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <Input
                    placeholder="Name"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                  <Input
                    placeholder="Mobile"
                    value={form.mobile}
                    onChange={(e) => setForm({ ...form, mobile: e.target.value })}
                  />
                </div>
                <DialogFooter>
                  <Button onClick={addCustomer}>Save customer</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          {matches.length > 0 && (
            <div className="max-h-36 overflow-y-auto rounded-lg border">
              {matches.slice(0, 6).map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    cart.setCustomer(c);
                    setQ("");
                  }}
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-muted"
                >
                  {c.name} · {c.mobile}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
