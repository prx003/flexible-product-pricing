import { createFileRoute } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Search, FileDown, Truck } from "lucide-react";
import { db } from "@/lib/db";
import { pageHead } from "@/lib/head";
import { PageBody } from "@/components/layout/app-shell";
import { StatCard } from "@/components/common/stat-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
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
import { EmptyState, Loader } from "@/components/common/states";
import { Pagination, usePagination } from "@/components/common/pagination";
import { exportExcel } from "@/lib/excel";
import { inr } from "@/lib/format";
import type { PaymentMethod, Supplier } from "@/lib/types";

export const Route = createFileRoute("/suppliers")({
  head: () => pageHead("Suppliers", "Supplier directory, outstanding balances and payment records."),
  component: SuppliersPage,
});

const blank = (): Supplier => ({ name: "", mobile: "", openingBalance: 0, balance: 0 });

function SuppliersPage() {
  const suppliers = useLiveQuery(() => db.suppliers.toArray(), []);
  const payments = useLiveQuery(() => db.supplierPayments.toArray(), []);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Supplier>(blank());
  const [payFor, setPayFor] = useState<Supplier | null>(null);
  const [amount, setAmount] = useState(0);
  const [method, setMethod] = useState<PaymentMethod>("Cash");

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (suppliers ?? []).filter((s) =>
      term ? s.name.toLowerCase().includes(term) || s.mobile.includes(term) : true,
    );
  }, [suppliers, q]);
  const pg = usePagination(rows, 10);

  if (!suppliers || !payments) return <Loader label="Loading suppliers..." />;

  const save = async () => {
    if (!form.name.trim()) {
      toast.error("Supplier name is required");
      return;
    }
    if (form.id) await db.suppliers.update(form.id, form);
    else await db.suppliers.add({ ...form, balance: form.openingBalance });
    toast.success("Supplier saved");
    setOpen(false);
  };

  const pay = async () => {
    if (!payFor || amount <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    await db.supplierPayments.add({
      supplierId: payFor.id!,
      date: new Date().toISOString(),
      amount,
      method,
    });
    await db.suppliers.update(payFor.id!, { balance: +(payFor.balance - amount).toFixed(2) });
    toast.success(`Paid ${inr(amount)} to ${payFor.name}`);
    setPayFor(null);
    setAmount(0);
  };

  const totalDue = suppliers.reduce((s, x) => s + x.balance, 0);

  return (
    <PageBody>
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Suppliers" value={String(suppliers.length)} icon={<Truck className="size-5" />} />
        <StatCard label="Payable" value={inr(totalDue)} icon={<Truck className="size-5" />} tone="danger" />
        <StatCard
          label="Paid this month"
          value={inr(
            payments
              .filter((p) => new Date(p.date).getMonth() === new Date().getMonth())
              .reduce((s, p) => s + p.amount, 0),
          )}
          icon={<Truck className="size-5" />}
          tone="success"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search supplier" className="pl-9" />
        </div>
        <Button variant="outline" onClick={() => exportExcel(rows as unknown as Record<string, unknown>[], "suppliers")}>
          <FileDown className="size-4" /> Export
        </Button>
        <Button onClick={() => { setForm(blank()); setOpen(true); }}>
          <Plus className="size-4" /> Add supplier
        </Button>
      </div>

      <Card className="card-elevated overflow-hidden p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Supplier</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>GSTIN</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pg.slice.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <div className="font-medium">{s.name}</div>
                    <div className="text-xs text-muted-foreground">{s.mobile}</div>
                  </TableCell>
                  <TableCell>{s.company ?? "-"}</TableCell>
                  <TableCell>{s.gstin ?? "-"}</TableCell>
                  <TableCell className="text-right">
                    <span className={s.balance > 0 ? "font-semibold text-destructive" : ""}>{inr(s.balance)}</span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="outline" onClick={() => { setPayFor(s); setAmount(s.balance); }}>
                        Pay
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => { setForm(s); setOpen(true); }}>
                        <Pencil className="size-4" />
                      </Button>
                      <ConfirmDelete
                        title={`Delete ${s.name}?`}
                        onConfirm={async () => {
                          await db.suppliers.delete(s.id!);
                          toast.success("Supplier deleted");
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
        {pg.total === 0 && <EmptyState title="No suppliers found" />}
        <Pagination page={pg.page} pages={pg.pages} total={pg.total} onChange={pg.setPage} />
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{form.id ? "Edit supplier" : "Add supplier"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="space-y-2"><Label>Company</Label><Input value={form.company ?? ""} onChange={(e) => setForm({ ...form, company: e.target.value })} /></div>
            <div className="space-y-2"><Label>Mobile</Label><Input value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} /></div>
            <div className="space-y-2"><Label>Email</Label><Input value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div className="space-y-2"><Label>GSTIN</Label><Input value={form.gstin ?? ""} onChange={(e) => setForm({ ...form, gstin: e.target.value })} /></div>
            <div className="space-y-2"><Label>Opening balance</Label><Input type="number" value={form.openingBalance} onChange={(e) => setForm({ ...form, openingBalance: Number(e.target.value) })} /></div>
            <div className="space-y-2 sm:col-span-2"><Label>Address</Label><Input value={form.address ?? ""} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!payFor} onOpenChange={(o) => !o && setPayFor(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Pay {payFor?.name}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Amount (due {inr(payFor?.balance ?? 0)})</Label>
              <Input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>Method</Label>
              <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(["Cash", "UPI", "Card", "Bank Transfer"] as PaymentMethod[]).map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayFor(null)}>Cancel</Button>
            <Button onClick={pay}>Record payment</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageBody>
  );
}
