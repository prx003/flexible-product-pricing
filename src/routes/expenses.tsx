import { createFileRoute } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, FileDown, Wallet } from "lucide-react";
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
import { fmtDate, inr, isToday, toInputDate } from "@/lib/format";
import type { Expense, PaymentMethod } from "@/lib/types";

export const Route = createFileRoute("/expenses")({
  head: () => pageHead("Expenses", "Record and track daily shop expenses like rent, salary and utilities."),
  component: ExpensesPage,
});

const CATEGORIES: Expense["category"][] = [
  "Rent",
  "Electricity",
  "Salary",
  "Transport",
  "Maintenance",
  "Other",
];
const METHODS: PaymentMethod[] = ["Cash", "UPI", "Card", "Bank Transfer"];

const blank = (): Expense => ({
  date: new Date().toISOString(),
  category: "Other",
  amount: 0,
  paidTo: "",
  method: "Cash",
  note: "",
});

function ExpensesPage() {
  const expenses = useLiveQuery(() => db.expenses.orderBy("date").reverse().toArray(), []);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Expense>(blank());
  const [cat, setCat] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const rows = useMemo(
    () =>
      (expenses ?? []).filter((e) => {
        if (cat !== "all" && e.category !== cat) return false;
        if (from && toInputDate(e.date) < from) return false;
        if (to && toInputDate(e.date) > to) return false;
        return true;
      }),
    [expenses, cat, from, to],
  );
  const pg = usePagination(rows, 12);

  if (!expenses) return <Loader label="Loading expenses..." />;

  const total = rows.reduce((s, e) => s + e.amount, 0);
  const today = expenses.filter((e) => isToday(e.date)).reduce((s, e) => s + e.amount, 0);
  const month = expenses
    .filter((e) => new Date(e.date).getMonth() === new Date().getMonth())
    .reduce((s, e) => s + e.amount, 0);

  const save = async () => {
    if (!draft.amount || draft.amount <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    if (draft.id) await db.expenses.update(draft.id, draft);
    else await db.expenses.add(draft);
    toast.success("Expense saved");
    setOpen(false);
  };

  return (
    <PageBody>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Today" value={inr(today)} icon={<Wallet className="size-5" />} />
        <StatCard label="This month" value={inr(month)} icon={<Wallet className="size-5" />} tone="warning" index={1} />
        <StatCard label="Filtered total" value={inr(total)} icon={<Wallet className="size-5" />} tone="danger" index={2} />
      </div>

      <Card className="card-elevated flex flex-wrap items-end gap-3 p-4">
        <div className="space-y-2">
          <Label>Category</Label>
          <Select value={cat} onValueChange={setCat}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>From</Label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>To</Label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div className="ml-auto flex gap-2">
          <Button
            variant="outline"
            onClick={() =>
              exportExcel(
                rows.map((e) => ({
                  date: fmtDate(e.date),
                  category: e.category,
                  amount: e.amount,
                  paidTo: e.paidTo ?? "",
                  method: e.method,
                  note: e.note ?? "",
                })),
                "expenses",
              )
            }
          >
            <FileDown className="size-4" /> Export
          </Button>
          <Button
            onClick={() => {
              setDraft(blank());
              setOpen(true);
            }}
          >
            <Plus className="size-4" /> Add expense
          </Button>
        </div>
      </Card>

      <Card className="card-elevated overflow-hidden p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Paid to</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Note</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {pg.slice.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="whitespace-nowrap">{fmtDate(e.date)}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{e.category}</Badge>
                  </TableCell>
                  <TableCell>{e.paidTo || "-"}</TableCell>
                  <TableCell>{e.method}</TableCell>
                  <TableCell className="max-w-56 truncate text-muted-foreground">{e.note || "-"}</TableCell>
                  <TableCell className="text-right font-semibold">{inr(e.amount)}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setDraft(e);
                          setOpen(true);
                        }}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <ConfirmDelete
                        trigger={
                          <Button variant="ghost" size="icon">
                            <Trash2 className="size-4 text-destructive" />
                          </Button>
                        }
                        onConfirm={async () => {
                          await db.expenses.delete(e.id!);
                          toast.success("Expense deleted");
                        }}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {pg.total === 0 && <EmptyState title="No expenses recorded" description="Add your first shop expense." />}
        <Pagination page={pg.page} pages={pg.pages} total={pg.total} onChange={pg.setPage} />
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{draft.id ? "Edit expense" : "Add expense"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Date</Label>
              <Input
                type="date"
                value={toInputDate(draft.date)}
                onChange={(e) =>
                  setDraft({ ...draft, date: new Date(e.target.value).toISOString() })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={draft.category}
                onValueChange={(v) => setDraft({ ...draft, category: v as Expense["category"] })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Amount</Label>
              <Input
                type="number"
                value={draft.amount}
                onChange={(e) => setDraft({ ...draft, amount: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label>Paid to</Label>
              <Input
                value={draft.paidTo ?? ""}
                onChange={(e) => setDraft({ ...draft, paidTo: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Payment method</Label>
              <Select
                value={draft.method}
                onValueChange={(v) => setDraft({ ...draft, method: v as PaymentMethod })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {METHODS.map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Note</Label>
              <Input
                value={draft.note ?? ""}
                onChange={(e) => setDraft({ ...draft, note: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => void save()}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageBody>
  );
}
