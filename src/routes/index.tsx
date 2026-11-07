import { createFileRoute, Link } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import {
  IndianRupee,
  TrendingUp,
  ReceiptText,
  Package,
  Users,
  AlertTriangle,
  XCircle,
  CalendarClock,
  Truck,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { db } from "@/lib/db";
import { PageBody } from "@/components/layout/app-shell";
import { StatCard } from "@/components/common/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader, EmptyState } from "@/components/common/states";
import { daysBetween, fmtDateTime, inr, inrShort, isToday } from "@/lib/format";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — G.K Mart" },
      {
        name: "description",
        content: "Live grocery shop dashboard: sales, profit, stock alerts and business charts.",
      },
      { property: "og:title", content: "Dashboard — G.K Mart" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      {
        property: "og:description",
        content: "Live grocery shop dashboard: sales, profit, stock alerts and business charts.",
      },
    ],
  }),
  component: Dashboard,
});

const COLORS = ["#16a34a", "#f97316", "#0ea5e9", "#a855f7", "#ef4444", "#64748b"];

function Dashboard() {
  const data = useLiveQuery(async () => {
    const [sales, products, customers, suppliers, movements] = await Promise.all([
      db.sales.toArray(),
      db.products.toArray(),
      db.customers.count(),
      db.suppliers.toArray(),
      db.stockMovements.orderBy("date").reverse().limit(6).toArray(),
    ]);
    return { sales, products, customers, suppliers, movements };
  }, []);

  if (!data) return <Loader label="Loading dashboard..." />;

  const { sales, products, customers, suppliers, movements } = data;
  const valid = sales.filter((s) => s.status !== "cancelled");
  const todays = valid.filter((s) => isToday(s.date));
  const todaySales = todays.reduce((s, x) => s + x.total, 0);
  const todayProfit = todays.reduce((s, x) => s + x.profit, 0);
  const lowStock = products.filter((p) => p.stock > 0 && p.stock <= p.minStock);
  const outStock = products.filter((p) => p.stock <= 0);
  const expiring = products.filter(
    (p) => p.expiryDate && daysBetween(p.expiryDate) <= 30 && daysBetween(p.expiryDate) >= 0,
  );
  const pendingSupplier = suppliers.reduce((s, x) => s + x.balance, 0);

  const dayMap = new Map<string, { sales: number; profit: number }>();
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dayMap.set(d.toISOString().slice(0, 10), { sales: 0, profit: 0 });
  }
  for (const s of valid) {
    const key = s.date.slice(0, 10);
    const e = dayMap.get(key);
    if (e) {
      e.sales += s.total;
      e.profit += s.profit;
    }
  }
  const daily = [...dayMap.entries()].map(([k, v]) => ({
    label: k.slice(8) + "/" + k.slice(5, 7),
    ...v,
  }));
  const weekly = Array.from({ length: 6 }, (_, w) => {
    const chunk = daily.slice(Math.max(0, daily.length - (6 - w) * 5), daily.length - (5 - w) * 5);
    return {
      label: `W${w + 1}`,
      sales: chunk.reduce((s, d) => s + d.sales, 0),
      profit: chunk.reduce((s, d) => s + d.profit, 0),
    };
  });
  const monthMap = new Map<string, number>();
  for (const s of valid) {
    const key = s.date.slice(0, 7);
    monthMap.set(key, (monthMap.get(key) ?? 0) + s.total);
  }
  const monthly = [...monthMap.entries()]
    .sort()
    .slice(-6)
    .map(([k, v]) => ({ label: k, sales: v }));

  const payMap = new Map<string, number>();
  for (const s of valid) payMap.set(s.paymentMethod, (payMap.get(s.paymentMethod) ?? 0) + s.total);
  const payments = [...payMap.entries()].map(([name, value]) => ({ name, value }));

  const prodMap = new Map<number, { name: string; qty: number; amount: number }>();
  for (const s of valid)
    for (const i of s.items) {
      const e = prodMap.get(i.productId) ?? { name: i.name, qty: 0, amount: 0 };
      e.qty += i.qty;
      e.amount += i.total;
      prodMap.set(i.productId, e);
    }
  const topProducts = [...prodMap.values()].sort((a, b) => b.amount - a.amount).slice(0, 6);
  const recent = [...valid].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);

  return (
    <PageBody>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        <StatCard
          index={0}
          label="Today's Sales"
          value={inr(todaySales)}
          icon={<IndianRupee className="size-5" />}
          hint={`${todays.length} bills today`}
        />
        <StatCard
          index={1}
          label="Today's Profit"
          value={inr(todayProfit)}
          tone="success"
          icon={<TrendingUp className="size-5" />}
        />
        <StatCard
          index={2}
          label="Total Bills"
          value={valid.length}
          tone="accent"
          icon={<ReceiptText className="size-5" />}
        />
        <StatCard
          index={3}
          label="Total Products"
          value={products.length}
          icon={<Package className="size-5" />}
        />
        <StatCard
          index={4}
          label="Total Customers"
          value={customers}
          icon={<Users className="size-5" />}
        />
        <StatCard
          index={5}
          label="Low Stock"
          value={lowStock.length}
          tone="warning"
          icon={<AlertTriangle className="size-5" />}
        />
        <StatCard
          index={6}
          label="Out of Stock"
          value={outStock.length}
          tone="danger"
          icon={<XCircle className="size-5" />}
        />
        <StatCard
          index={7}
          label="Expiring Soon"
          value={expiring.length}
          tone="warning"
          icon={<CalendarClock className="size-5" />}
          hint="within 30 days"
        />
        <StatCard
          index={8}
          label="Supplier Dues"
          value={inrShort(pendingSupplier)}
          tone="danger"
          icon={<Truck className="size-5" />}
        />
        <StatCard
          index={9}
          label="Avg. Bill Value"
          value={inr(valid.length ? valid.reduce((s, x) => s + x.total, 0) / valid.length : 0)}
          tone="accent"
          icon={<ReceiptText className="size-5" />}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="card-elevated xl:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Daily Sales (last 30 days)</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={daily}>
                <defs>
                  <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#16a34a" stopOpacity={0.5} />
                    <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="label" fontSize={11} interval={4} />
                <YAxis fontSize={11} tickFormatter={(v) => inrShort(Number(v))} />
                <Tooltip formatter={(v) => inr(Number(v))} />
                <Area
                  type="monotone"
                  dataKey="sales"
                  stroke="#16a34a"
                  fill="url(#g1)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="card-elevated">
          <CardHeader>
            <CardTitle className="text-base">Payment Methods</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={payments} dataKey="value" nameKey="name" outerRadius={90} label>
                  {payments.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => inr(Number(v))} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="card-elevated">
          <CardHeader>
            <CardTitle className="text-base">Weekly Sales</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weekly}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="label" fontSize={11} />
                <YAxis fontSize={11} tickFormatter={(v) => inrShort(Number(v))} />
                <Tooltip formatter={(v) => inr(Number(v))} />
                <Bar dataKey="sales" fill="#16a34a" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="card-elevated">
          <CardHeader>
            <CardTitle className="text-base">Monthly Sales</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="label" fontSize={11} />
                <YAxis fontSize={11} tickFormatter={(v) => inrShort(Number(v))} />
                <Tooltip formatter={(v) => inr(Number(v))} />
                <Bar dataKey="sales" fill="#f97316" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="card-elevated">
          <CardHeader>
            <CardTitle className="text-base">Sales vs Profit</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={daily.slice(-14)}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="label" fontSize={11} />
                <YAxis fontSize={11} tickFormatter={(v) => inrShort(Number(v))} />
                <Tooltip formatter={(v) => inr(Number(v))} />
                <Legend />
                <Line type="monotone" dataKey="sales" stroke="#16a34a" strokeWidth={2} />
                <Line type="monotone" dataKey="profit" stroke="#f97316" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <Card className="card-elevated">
          <CardHeader>
            <CardTitle className="text-base">Top Selling Products</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {topProducts.length === 0 && <EmptyState title="No sales yet" />}
            {topProducts.map((p, i) => (
              <div key={i} className="flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0 truncate">
                  <span className="mr-2 text-muted-foreground">{i + 1}.</span>
                  {p.name}
                </span>
                <span className="shrink-0 font-semibold">{inr(p.amount)}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="card-elevated">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">Low Stock Alerts</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/inventory">View</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {lowStock.length === 0 && <EmptyState title="All products well stocked" />}
            {lowStock.slice(0, 6).map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0 truncate">{p.name}</span>
                <Badge variant="outline" className="shrink-0 border-warning/50 text-warning-foreground">
                  {p.stock} {p.unit}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="card-elevated">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">Recent Sales</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/sales">All</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {recent.length === 0 && <EmptyState title="No bills yet" />}
            {recent.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0 truncate">
                  <span className="font-medium">{s.invoiceNo}</span>
                  <span className="ml-2 text-muted-foreground">{s.customerName}</span>
                </span>
                <span className="shrink-0 font-semibold">{inr(s.total)}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="card-elevated">
          <CardHeader>
            <CardTitle className="text-base">Recent Stock Activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {movements.length === 0 && <EmptyState title="No stock movement" />}
            {movements.map((m) => (
              <div key={m.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0 truncate">
                  {m.productName}
                  <span className="ml-2 text-xs text-muted-foreground">{m.type}</span>
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {fmtDateTime(m.date)}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="card-elevated lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Notifications</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {outStock.length > 0 && (
              <p className="rounded-lg bg-destructive/10 px-3 py-2 text-destructive">
                {outStock.length} products are out of stock — reorder immediately.
              </p>
            )}
            {lowStock.length > 0 && (
              <p className="rounded-lg bg-warning/20 px-3 py-2">
                {lowStock.length} products below minimum stock level.
              </p>
            )}
            {expiring.length > 0 && (
              <p className="rounded-lg bg-accent/15 px-3 py-2">
                {expiring.length} products expiring within 30 days.
              </p>
            )}
            {pendingSupplier > 0 && (
              <p className="rounded-lg bg-muted px-3 py-2">
                Supplier payments pending: {inr(pendingSupplier)}
              </p>
            )}
            {outStock.length + lowStock.length + expiring.length === 0 && (
              <EmptyState title="No alerts" description="Everything looks healthy today." />
            )}
          </CardContent>
        </Card>
      </div>
    </PageBody>
  );
}
