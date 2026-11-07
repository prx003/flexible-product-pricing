import { createFileRoute } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Search, Undo2, FileDown } from "lucide-react";
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
import { fmtDateTime, inr } from "@/lib/format";
import { useAuth } from "@/store/auth";
import type { PaymentMethod, Sale } from "@/lib/types";

export const Route = createFileRoute("/returns")({
  head: () => pageHead("Sales Returns", "Process customer returns, refunds and restock returned items."),
  component: ReturnsPage,
});

const REFUND_METHODS: PaymentMethod[] = ["Cash", "UPI", "Card", "Bank Transfer", "Credit"];

function ReturnsPage() {
  const user = useAuth((s) => s.user);
  const returns = useLiveQuery(() => db.returns.orderBy("date").reverse().toArray(), []);
  const [q, setQ] = useState("");
  const [sale, setSale] = useState<Sale | null>(null);
  const [qty, setQty] = useState<Record<number, number>>({});
  const [reason, setReason] = useState("Damaged / defective");
  const [refund, setRefund] = useState<PaymentMethod>("Cash");
  const [saving, setSaving] = useState(false);

  const pg = usePagination(returns ?? [], 12);
  const totalRefunded = useMemo(
    () => (returns ?? []).reduce((s, r) => s + r.amount, 0),
    [returns],
  );

  const findSale = async () => {
    const term = q.trim().toLowerCase();
    if (!term) return;
    const all = await db.sales.toArray();
    const found = all.find(
      (s) =>
        s.invoiceNo.toLowerCase() === term ||
        s.invoiceNo.toLowerCase().includes(term) ||
        (s.customerMobile ?? "") === term,
    );
    if (!found) {
      toast.error("No invoice found");
      return;
    }
    if (found.status === "cancelled") {
      toast.error("This bill was cancelled");
      return;
    }
    setSale(found);
    setQty({});
  };

  const amount = useMemo(() => {
    if (!sale) return 0;
    return +sale.items
      .reduce((s, it) => s + (qty[it.productId] ?? 0) * it.price, 0)
      .toFixed(2);
  }, [sale, qty]);

  const submit = async () => {
    if (!sale) return;
    const picked = sale.items.filter((it) => (qty[it.productId] ?? 0) > 0);
    if (picked.length === 0) {
      toast.error("Enter return quantity for at least one item");
      return;
    }
    setSaving(true);
    try {
      const refNo = `RET-${Date.now().toString().slice(-8)}`;
      await db.returns.add({
        refNo,
        saleId: sale.id!,
        invoiceNo: sale.invoiceNo,
        date: new Date().toISOString(),
        customerName: sale.customerName,
        items: picked.map((it) => ({
          productId: it.productId,
          name: it.name,
          qty: qty[it.productId]!,
          price: it.price,
          total: +(qty[it.productId]! * it.price).toFixed(2),
        })),
        amount,
        reason,
        type: picked.length === sale.items.length ? "full" : "partial",
        refundMethod: refund,
      });

      for (const it of picked) {
        await adjustStock(
          it.productId,
          qty[it.productId]!,
          "return",
          user?.name ?? "System",
          `Return ${refNo} · ${sale.invoiceNo}`,
        );
      }

      const items = sale.items.map((it) => ({
        ...it,
        returnedQty: (it.returnedQty ?? 0) + (qty[it.productId] ?? 0),
      }));
      const fullyReturned = items.every((it) => (it.returnedQty ?? 0) >= it.qty);
      await db.sales.update(sale.id!, {
        items,
        status: fullyReturned ? "returned" : "partially-returned",
      });

      if (refund === "Credit" && sale.customerId) {
        const c = await db.customers.get(sale.customerId);
        if (c) {
          await db.customers.update(sale.customerId, {
            creditBalance: +Math.max(0, c.creditBalance - amount).toFixed(2),
          });
        }
      }

      await db.activity.add({
        date: new Date().toISOString(),
        user: user?.name ?? "System",
        action: "Sales return",
        details: `${refNo} · ${inr(amount)}`,
      });

      toast.success(`Return ${refNo} recorded · ${inr(amount)} refunded`);
      setSale(null);
      setQty({});
      setQ("");
    } finally {
      setSaving(false);
    }
  };

  if (!returns) return <Loader label="Loading returns..." />;

  return (
    <PageBody>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Total returns" value={String(returns.length)} icon={<Undo2 className="size-5" />} />
        <StatCard label="Refunded amount" value={inr(totalRefunded)} icon={<Undo2 className="size-5" />} tone="danger" index={1} />
        <StatCard
          label="This month"
          value={String(
            returns.filter((r) => new Date(r.date).getMonth() === new Date().getMonth()).length,
          )}
          icon={<Undo2 className="size-5" />}
          tone="warning"
          index={2}
        />
      </div>

      <Card className="card-elevated space-y-4 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-56 flex-1 space-y-2">
            <Label>Invoice number or customer mobile</Label>
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void findSale()}
              placeholder="INV-1001"
            />
          </div>
          <Button onClick={() => void findSale()}>
            <Search className="size-4" /> Find bill
          </Button>
        </div>

        {sale && (
          <div className="space-y-4 rounded-xl border p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-semibold">{sale.invoiceNo}</p>
                <p className="text-sm text-muted-foreground">
                  {sale.customerName} · {fmtDateTime(sale.date)} · {inr(sale.total)}
                </p>
              </div>
              <Badge variant="outline" className="capitalize">{sale.status}</Badge>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead className="text-right">Sold</TableHead>
                    <TableHead className="text-right">Already returned</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="w-32 text-right">Return qty</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sale.items.map((it) => {
                    const max = it.qty - (it.returnedQty ?? 0);
                    return (
                      <TableRow key={it.productId}>
                        <TableCell className="font-medium">{it.name}</TableCell>
                        <TableCell className="text-right">{it.qty}</TableCell>
                        <TableCell className="text-right">{it.returnedQty ?? 0}</TableCell>
                        <TableCell className="text-right">{inr(it.price)}</TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            min={0}
                            max={max}
                            disabled={max <= 0}
                            value={qty[it.productId] ?? 0}
                            onChange={(e) =>
                              setQty((s) => ({
                                ...s,
                                [it.productId]: Math.max(0, Math.min(max, Number(e.target.value))),
                              }))
                            }
                            className="h-9 text-right"
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>Reason</Label>
                <Input value={reason} onChange={(e) => setReason(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Refund method</Label>
                <Select value={refund} onValueChange={(v) => setRefund(v as PaymentMethod)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {REFUND_METHODS.map((m) => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Refund amount</Label>
                <div className="flex h-9 items-center rounded-md border px-3 font-bold">{inr(amount)}</div>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setSale(null)}>Cancel</Button>
              <Button disabled={saving || amount <= 0} onClick={() => void submit()}>
                <Undo2 className="size-4" /> Process return
              </Button>
            </div>
          </div>
        )}
      </Card>

      <div className="flex justify-end">
        <Button
          variant="outline"
          onClick={() =>
            exportExcel(
              returns.map((r) => ({
                ref: r.refNo,
                invoice: r.invoiceNo,
                date: r.date,
                customer: r.customerName,
                amount: r.amount,
                reason: r.reason,
                refund: r.refundMethod,
              })),
              "sales-returns",
            )
          }
        >
          <FileDown className="size-4" /> Export
        </Button>
      </div>

      <Card className="card-elevated overflow-hidden p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ref</TableHead>
                <TableHead>Invoice</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Refund</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pg.slice.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.refNo}</TableCell>
                  <TableCell>{r.invoiceNo}</TableCell>
                  <TableCell className="whitespace-nowrap text-sm">{fmtDateTime(r.date)}</TableCell>
                  <TableCell>{r.customerName}</TableCell>
                  <TableCell className="max-w-56 truncate text-sm text-muted-foreground">
                    {r.items.map((i) => `${i.name} ×${i.qty}`).join(", ")}
                  </TableCell>
                  <TableCell className="text-sm">{r.reason}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{r.refundMethod}</Badge>
                  </TableCell>
                  <TableCell className="text-right font-semibold">{inr(r.amount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {pg.total === 0 && (
          <EmptyState title="No returns yet" description="Find a bill above to process a return." />
        )}
        <Pagination page={pg.page} pages={pg.pages} total={pg.total} onChange={pg.setPage} />
      </Card>
    </PageBody>
  );
}
