import { createFileRoute } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Search, FileDown, Wallet } from "lucide-react";
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
import { ConfirmDelete } from "@/components/common/confirm-delete";
import { EmptyState, Loader } from "@/components/common/states";
import { Pagination, usePagination } from "@/components/common/pagination";
import { exportExcel } from "@/lib/excel";
import { fmtDate, inr } from "@/lib/format";
import type { Customer } from "@/lib/types";

export const Route = createFileRoute("/customers")({
  head: () => pageHead("Customers", "Customer directory with credit balance, loyalty points and membership."),
  component: CustomersPage,
});

const blank = (): Customer => ({
  name: "",
  mobile: "",
  type: "Retail",
  creditLimit: 0,
  creditBalance: 0,
  loyaltyPoints: 0,
  wallet: 0,
  membership: "Bronze",
  createdAt: new Date().toISOString(),
});

function CustomersPage() {
  const customers = useLiveQuery(() => db.customers.toArray(), []);
  const sales = useLiveQuery(() => db.sales.toArray(), []);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Customer>(blank());
  const [payFor, setPayFor] = useState<Customer | null>(null);
  const [payAmount, setPayAmount] = useState(0);

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (customers ?? []).filter((c) =>
      term ? c.name.toLowerCase().includes(term) || c.mobile.includes(term) : true,
    );
  }, [customers, q]);
  const pg = usePagination(rows, 10);

  if (!customers || !sales) return <Loader label="Loading customers..." />;

  const spend = (id?: number) =>
    sales.filter((s) => s.customerId === id).reduce((sum, s) => sum + s.total, 0);
  const totalCredit = customers.reduce((s, c) => s + c.creditBalance, 0);

  const save = async () => {
    if (!form.name.trim() || !form.mobile.trim()) {
      toast.error("Name and mobile are required");
      return;
    }
    if (form.id) await db.customers.update(form.id, form);
    else await db.customers.add(form);
    toast.success("Customer saved");
    setOpen(false);
  };

  const collect = async () => {
    if (!payFor) return;
    const amt = Math.min(payAmount, payFor.creditBalance);
    if (amt <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    await db.customers.update(payFor.id!, {
      creditBalance: +(payFor.creditBalance - amt).toFixed(2),
    });
    await db.activity.add({
      date: new Date().toISOString(),
      user: "System",
      action: "Credit collected",
      details: `${payFor.name} · ${inr(amt)}`,
    });
    toast.success(`Collected ${inr(amt)}`);
    setPayFor(null);
    setPayAmount(0);
  };

  return (
    <PageBody>
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Customers" value={String(customers.length)} icon={<Wallet className="size-5" />} />
        <StatCard label="Credit outstanding" value={inr(totalCredit)} icon={<Wallet className="size-5" />} tone="danger" />
        <StatCard
          label="Loyalty points issued"
          value={String(customers.reduce((s, c) => s + c.loyaltyPoints, 0))}
          icon={<Wallet className="size-5" />}
          tone="accent"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or mobile" className="pl-9" />
        </div>
        <Button
          variant="outline"
          onClick={() =>
            exportExcel(
              rows.map((c) => ({
                name: c.name,
                mobile: c.mobile,
                type: c.type,
                membership: c.membership,
                creditBalance: c.creditBalance,
                loyaltyPoints: c.loyaltyPoints,
                totalSpend: spend(c.id),
              })),
              "customers",
            )
          }
        >
          <FileDown className="size-4" /> Export
        </Button>
        <Button
          onClick={() => {
            setForm(blank());
            setOpen(true);
          }}
        >
          <Plus className="size-4" /> Add customer
        </Button>
      </div>

      <Card className="card-elevated overflow-hidden p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Membership</TableHead>
                <TableHead className="text-right">Points</TableHead>
                <TableHead className="text-right">Credit</TableHead>
                <TableHead className="text-right">Total spend</TableHead>
                <TableHead>Since</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pg.slice.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <div className="font-medium">{c.name}</div>
                    <div className="text-xs text-muted-foreground">{c.mobile}</div>
                  </TableCell>
                  <TableCell>{c.type}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{c.membership}</Badge>
                  </TableCell>
                  <TableCell className="text-right">{c.loyaltyPoints}</TableCell>
                  <TableCell className="text-right">
                    <span className={c.creditBalance > 0 ? "font-semibold text-destructive" : ""}>
                      {inr(c.creditBalance)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">{inr(spend(c.id))}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{fmtDate(c.createdAt)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {c.creditBalance > 0 && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setPayFor(c);
                            setPayAmount(c.creditBalance);
                          }}
                        >
                          Collect
                        </Button>
                      )}
                      <Button size="icon" variant="ghost" onClick={() => { setForm(c); setOpen(true); }}>
                        <Pencil className="size-4" />
                      </Button>
                      <ConfirmDelete
                        title={`Delete ${c.name}?`}
                        onConfirm={async () => {
                          await db.customers.delete(c.id!);
                          toast.success("Customer deleted");
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
        {pg.total === 0 && <EmptyState title="No customers found" />}
        <Pagination page={pg.page} pages={pg.pages} total={pg.total} onChange={pg.setPage} />
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{form.id ? "Edit customer" : "Add customer"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Mobile</Label>
              <Input value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>GSTIN</Label>
              <Input value={form.gstin ?? ""} onChange={(e) => setForm({ ...form, gstin: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as Customer["type"] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Retail">Retail</SelectItem>
                  <SelectItem value="Wholesale">Wholesale</SelectItem>
                  <SelectItem value="Staff">Staff</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Credit limit</Label>
              <Input type="number" value={form.creditLimit} onChange={(e) => setForm({ ...form, creditLimit: Number(e.target.value) })} />
            </div>
            <div className="space-y-2">
              <Label>Birthday</Label>
              <Input type="date" value={form.birthday?.slice(0, 10) ?? ""} onChange={(e) => setForm({ ...form, birthday: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Address</Label>
              <Input value={form.address ?? ""} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!payFor} onOpenChange={(o) => !o && setPayFor(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Collect credit · {payFor?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Amount (due {inr(payFor?.creditBalance ?? 0)})</Label>
            <Input type="number" value={payAmount} onChange={(e) => setPayAmount(Number(e.target.value))} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayFor(null)}>Cancel</Button>
            <Button onClick={collect}>Collect</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageBody>
  );
}
