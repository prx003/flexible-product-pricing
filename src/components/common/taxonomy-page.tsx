import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { db } from "@/lib/db";
import { PageBody } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfirmDelete } from "@/components/common/confirm-delete";
import { EmptyState, Loader } from "@/components/common/states";

interface Taxonomy {
  id?: number | undefined;
  name: string;
  description?: string | undefined;
  active: boolean;
}

export function TaxonomyPage({ kind }: { kind: "categories" | "brands" }) {
  const label = kind === "categories" ? "Category" : "Brand";
  const rows = useLiveQuery(() => db[kind].toArray(), [kind]);
  const products = useLiveQuery(() => db.products.toArray(), []);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Taxonomy>({ name: "", active: true });

  if (!rows || !products) return <Loader label={`Loading ${kind}...`} />;

  const count = (id?: number) =>
    products.filter((p) => (kind === "categories" ? p.categoryId : p.brandId) === id).length;

  const save = async () => {
    if (!form.name.trim()) {
      toast.error(`${label} name is required`);
      return;
    }
    const payload = { name: form.name.trim(), description: form.description, active: form.active };
    if (form.id) await db[kind].update(form.id, payload);
    else await db[kind].add(payload);
    toast.success(`${label} saved`);
    setOpen(false);
  };

  return (
    <PageBody>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{rows.length} {kind}</p>
        <Button
          onClick={() => {
            setForm({ name: "", active: true });
            setOpen(true);
          }}
        >
          <Plus className="size-4" /> Add {label.toLowerCase()}
        </Button>
      </div>

      <Card className="card-elevated overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Products</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell className="text-muted-foreground">{r.description ?? "-"}</TableCell>
                <TableCell className="text-right">{count(r.id)}</TableCell>
                <TableCell>
                  <Badge variant={r.active ? "default" : "outline"}>
                    {r.active ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        setForm(r);
                        setOpen(true);
                      }}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <ConfirmDelete
                      title={`Delete ${r.name}?`}
                      onConfirm={async () => {
                        if (count(r.id) > 0) {
                          toast.error("Move or delete its products first");
                          return;
                        }
                        await db[kind].delete(r.id!);
                        toast.success("Deleted");
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
        {rows.length === 0 && <EmptyState title={`No ${kind} yet`} />}
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{form.id ? `Edit ${label}` : `Add ${label}`}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={form.description ?? ""}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
              <Label>Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageBody>
  );
}
