import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, UserCog } from "lucide-react";
import { pageHead } from "@/lib/head";
import { PageBody } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, Loader } from "@/components/common/states";
import { createStaff, listStaff, updateStaff, STAFF_ROLES } from "@/lib/staff.functions";

export const Route = createFileRoute("/employees")({
  head: () => pageHead("Employees", "Create and manage staff accounts and their roles."),
  component: EmployeesPage,
});

type StaffRole = (typeof STAFF_ROLES)[number];
const ROLE_LABEL: Record<StaffRole, string> = {
  Admin: "Admin",
  "Shop Owner": "Shop Owner",
  Manager: "Staff (Manager)",
  Cashier: "Billing Staff",
  "Inventory Staff": "Inventory Staff",
  Accountant: "Accountant",
};

const blank = { name: "", email: "", mobile: "", password: "", role: "Cashier" as StaffRole };

function EmployeesPage() {
  const qc = useQueryClient();
  const list = useServerFn(listStaff);
  const create = useServerFn(createStaff);
  const update = useServerFn(updateStaff);
  const staff = useQuery({ queryKey: ["staff"], queryFn: () => list() });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(blank);

  const createM = useMutation({
    mutationFn: () => create({ data: form }),
    onSuccess: () => {
      toast.success("Staff account created");
      setOpen(false);
      setForm(blank);
      qc.invalidateQueries({ queryKey: ["staff"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const updateM = useMutation({
    mutationFn: (v: { id: string; role: StaffRole; active: boolean }) => update({ data: v }),
    onSuccess: () => {
      toast.success("Staff updated");
      qc.invalidateQueries({ queryKey: ["staff"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const submit = () => {
    if (!form.name.trim() || !form.email.trim()) {
      toast.error("Name and email are required");
      return;
    }
    if (form.password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    createM.mutate();
  };

  return (
    <PageBody>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Employees</h1>
          <p className="text-sm text-muted-foreground">Create staff, billing staff and inventory staff logins.</p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="size-4" /> Add staff
        </Button>
      </div>

      <Card className="overflow-hidden p-0">
        {staff.isLoading ? (
          <Loader label="Loading staff..." />
        ) : staff.error ? (
          <EmptyState title="Can't load staff" description={(staff.error as Error).message} />
        ) : !staff.data?.length ? (
          <EmptyState title="No staff yet" icon={<UserCog className="size-7" />} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Mobile</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Active</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {staff.data.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell>{s.email}</TableCell>
                  <TableCell>{s.mobile || "—"}</TableCell>
                  <TableCell>
                    <Select
                      value={s.role}
                      onValueChange={(v) => updateM.mutate({ id: s.id, role: v as StaffRole, active: s.active })}
                    >
                      <SelectTrigger className="w-44">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STAFF_ROLES.map((r) => (
                          <SelectItem key={r} value={r}>
                            {ROLE_LABEL[r]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={s.active}
                        onCheckedChange={(c) => updateM.mutate({ id: s.id, role: s.role as StaffRole, active: c })}
                      />
                      {!s.active && <Badge variant="secondary">Disabled</Badge>}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add staff</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label>Type of staff</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as StaffRole })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STAFF_ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {ROLE_LABEL[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid gap-1.5">
              <Label>Email (login)</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="grid gap-1.5">
              <Label>Mobile</Label>
              <Input value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} />
            </div>
            <div className="grid gap-1.5">
              <Label>Password</Label>
              <Input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={createM.isPending}>
              {createM.isPending ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageBody>
  );
}
