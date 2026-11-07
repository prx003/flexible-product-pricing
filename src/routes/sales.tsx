import { createFileRoute } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Search, FileDown, Printer, Download, MessageCircle, Eye, Ban } from "lucide-react";
import { db } from "@/lib/db";
import { pageHead } from "@/lib/head";
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
import { downloadInvoice, printA4, printThermal, whatsappShare } from "@/lib/invoice";
import { fmtDateTime, inr, toInputDate } from "@/lib/format";
import type { Sale } from "@/lib/types";
import { ReceiptText, IndianRupee, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/sales")({
  head: () => pageHead("Sales History", "Browse invoices, reprint receipts and review daily sales."),
  component: SalesPage,
});

function SalesPage() {
  const sales = useLiveQuery(() => db.sales.orderBy("date").reverse().toArray(), []);
  const settings = useLiveQuery(() => db.settings.get(1), []);
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [method, setMethod] = useState("all");
  const [view, setView] = useState<Sale | null>(null);

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (sales ?? []).filter((s) => {
      if (term && !s.invoiceNo.toLowerCase().includes(term) && !s.customerName.toLowerCase().includes(term))
        return false;
      if (from && toInputDate(s.date) < from) return false;
      if (to && toInputDate(s.date) > to) return false;
      if (method !== "all" && s.paymentMethod !== method) return false;
      return true;
    });
  }, [sales, q, from, to, method]);
  const pg = usePagination(rows, 10);

  if (!sales || !settings) return <Loader label="Loading sales..." />;

  const total = rows.reduce((s, x) => s + x.total, 0);
  const profit = rows.reduce((s, x) => s + x.profit, 0);

  return (
    <PageBody>
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Invoices" value={String(rows.length)} icon={<ReceiptText className="size-5" />} />
        <StatCard label="Sales value" value={inr(total)} icon={<IndianRupee className="size-5" />} tone="success" />
        <StatCard label="Profit" value={inr(profit)} icon={<TrendingUp className="size-5" />} tone="accent" />
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Invoice or customer" className="pl-9" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">From</Label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">To</Label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <Select value={method} onValueChange={setMethod}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All payments</SelectItem>
            {["Cash", "UPI", "Card", "Bank Transfer", "Credit", "Split"].map((m) => (
              <SelectItem key={m} value={m}>{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          onClick={() =>
            exportExcel(
              rows.map((s) => ({
                invoice: s.invoiceNo,
                date: s.date,
                customer: s.customerName,
                items: s.items.length,
                total: s.total,
                profit: s.profit,
                payment: s.paymentMethod,
                status: s.status,
              })),
              "sales",
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
                <TableHead>Invoice</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Cashier</TableHead>
                <TableHead className="text-right">Items</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pg.slice.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.invoiceNo}</TableCell>
                  <TableCell className="whitespace-nowrap text-sm">{fmtDateTime(s.date)}</TableCell>
                  <TableCell>{s.customerName}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{s.cashier}</TableCell>
                  <TableCell className="text-right">{s.items.length}</TableCell>
                  <TableCell className="text-right font-semibold">{inr(s.total)}</TableCell>
                  <TableCell><Badge variant="outline">{s.paymentMethod}</Badge></TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        s.status === "completed"
                          ? "border-success/40 text-success"
                          : s.status === "cancelled"
                            ? "border-destructive/40 text-destructive"
                            : "border-warning/40 text-warning"
                      }
                    >
                      {s.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" onClick={() => setView(s)}>
                        <Eye className="size-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => printThermal(s, settings)}>
                        <Printer className="size-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => downloadInvoice(s, settings)}>
                        <Download className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {pg.total === 0 && <EmptyState title="No invoices found" />}
        <Pagination page={pg.page} pages={pg.pages} total={pg.total} onChange={pg.setPage} />
      </Card>

      <Dialog open={!!view} onOpenChange={(o) => !o && setView(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader><DialogTitle>Invoice {view?.invoiceNo}</DialogTitle></DialogHeader>
          {view && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <span className="text-muted-foreground">Date</span><span>{fmtDateTime(view.date)}</span>
                <span className="text-muted-foreground">Customer</span><span>{view.customerName}</span>
                <span className="text-muted-foreground">Cashier</span><span>{view.cashier}</span>
                <span className="text-muted-foreground">Payment</span><span>{view.paymentMethod}</span>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Rate</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {view.items.map((i) => (
                    <TableRow key={i.productId}>
                      <TableCell>{i.name}</TableCell>
                      <TableCell className="text-right">{i.qty} {i.unit}</TableCell>
                      <TableCell className="text-right">{inr(i.price)}</TableCell>
                      <TableCell className="text-right">{inr(i.total)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="flex flex-col items-end gap-1 text-sm">
                <span>Subtotal {inr(view.subtotal)}</span>
                <span>Discount -{inr(view.itemDiscount + view.billDiscount)}</span>
                <span>GST {inr(view.cgst + view.sgst + view.igst)}</span>
                <span className="text-lg font-bold">Total {inr(view.total)}</span>
              </div>
            </div>
          )}
          <DialogFooter className="flex-wrap gap-2">
            <Button variant="outline" onClick={() => view && printA4(view, settings)}>
              <Printer className="size-4" /> A4
            </Button>
            <Button variant="outline" onClick={() => view && printThermal(view, settings)}>
              <Printer className="size-4" /> Thermal
            </Button>
            <Button variant="outline" onClick={() => view && whatsappShare(view, settings)}>
              <MessageCircle className="size-4" /> WhatsApp
            </Button>
            <Button variant="outline" onClick={() => view && downloadInvoice(view, settings)}>
              <Download className="size-4" /> PDF
            </Button>
            {view?.status === "completed" && (
              <Button
                variant="destructive"
                onClick={async () => {
                  await db.sales.update(view.id!, { status: "cancelled" });
                  toast.success("Invoice cancelled");
                  setView(null);
                }}
              >
                <Ban className="size-4" /> Cancel bill
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageBody>
  );
}
