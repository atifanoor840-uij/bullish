import { createFileRoute, Link } from "@tanstack/react-router";
import { DollarSign, ShoppingBag, Layers, Wallet, Users, ArrowRight, RefreshCw } from "lucide-react";
import { Badge, Button, Card, CardHeader, DataTable, ErrorNote, Loading, PageHeader, StatCard, useApi } from "@/components/portal/ui";
import { SignedBars } from "@/components/portal/charts";
import { propApi, type Kyc } from "@/lib/propApi";
import { fmtDate, money, num } from "@/lib/portal";

export const Route = createFileRoute("/admin/")({ component: Overview });

const PAID = ["Paid", "Active", "Step2 Active", "Live Active", "Passed", "Failed", "Replaced"];

function Overview() {
  const { data, error, loading, reload } = useApi(async () => {
    const [users, orders, accounts, payouts, kyc] = await Promise.all([
      propApi.admin.users(),
      propApi.orders.list(),
      propApi.accounts.list(),
      propApi.payouts.list(),
      propApi.kyc.get().catch(() => ({ kyc: [] })),
    ]);
    return { users: users.users, orders: orders.orders, accounts: accounts.accounts, payouts: payouts.payouts, kyc: (Array.isArray(kyc.kyc) ? kyc.kyc : []) as Kyc[] };
  }, [], "/admin");

  if (loading && !data) return <Card><Loading label="Loading overview…" /></Card>;
  if (error || !data) return <ErrorNote message={error || "No data"} onRetry={reload} />;

  const paidOrders = data.orders.filter((o) => PAID.includes(o.status) && !["free_retry", "offer_bogo"].includes(o.paymentMethod));
  const revenue = paidOrders.reduce((s, o) => s + num(o.amountPaid), 0);
  const last30 = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(Date.now() - (29 - i) * 864e5).toISOString().slice(0, 10);
    const v = paidOrders.filter((o) => o.createdAt?.slice(0, 10) === d).reduce((s, o) => s + num(o.amountPaid), 0);
    return { label: fmtDate(d), value: v };
  });
  const rev30 = last30.reduce((s, d) => s + d.value, 0);
  const paidOut = data.payouts.filter((p) => p.status === "paid").reduce((s, p) => s + num(p.amount), 0);
  const funded = data.accounts.filter((a) => a.status === "Funded").length;
  const active = data.accounts.filter((a) => a.status === "Active").length;
  const passRate = data.accounts.length ? (data.accounts.filter((a) => a.status !== "Failed" && a.status !== "Active").length / data.accounts.length) * 100 : 0;

  const tasks = [
    { label: "Manual payments to confirm", count: data.orders.filter((o) => o.status === "Pending" && o.gatewayRef?.startsWith("manual:")).length, to: "/admin/orders" },
    { label: "Accounts awaiting credentials", count: data.accounts.filter((a) => a.deliveryStatus === "pending").length, to: "/admin/accounts" },
    { label: "Payouts to review", count: data.payouts.filter((p) => p.status === "pending").length, to: "/admin/payouts" },
    { label: "KYC to review", count: data.kyc.filter((k) => k.status === "pending" || k.status === "needs_review").length, to: "/admin/kyc" },
  ];
  const recent = [...data.orders].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 8);

  return (
    <>
      <PageHeader title="Overview" subtitle="How the firm is doing, and what needs your attention." actions={<Button variant="ghost" onClick={reload}><RefreshCw className="h-4 w-4" />Refresh</Button>} />

      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard highlight label="Total revenue" value={money(revenue, 0)} icon={<DollarSign className="h-4 w-4" />} sub={`${money(rev30, 0)} in the last 30 days`} />
        <StatCard label="Paid orders" value={paidOrders.length} icon={<ShoppingBag className="h-4 w-4" />} sub={`${data.orders.length} orders in total`} />
        <StatCard label="Accounts" value={data.accounts.length} icon={<Layers className="h-4 w-4" />} sub={`${active} in evaluation · ${funded} funded · ${passRate.toFixed(0)}% pass`} />
        <StatCard label="Paid to traders" value={money(paidOut, 0)} icon={<Wallet className="h-4 w-4" />} sub={`${data.users.length} registered users`} />
      </div>

      <div className="mb-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <Card className="min-w-0">
          <CardHeader title="Revenue · last 30 days" meta={money(rev30)} />
          <div className="p-5"><SignedBars bars={last30} format={(n) => money(n)} height={200} /></div>
        </Card>
        <Card>
          <CardHeader title="Needs attention" />
          <div className="divide-y divide-white/[0.05]">
            {tasks.map((t) => (
              <Link key={t.label} to={t.to} className="flex items-center justify-between gap-3 px-5 py-4 text-sm transition hover:bg-white/[0.02]">
                <span className="text-muted-foreground">{t.label}</span>
                <span className="flex items-center gap-2">
                  <span className={t.count ? "rounded-full bg-primary px-2 text-xs font-bold text-primary-foreground" : "text-xs text-muted-foreground"}>{t.count}</span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </span>
              </Link>
            ))}
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader title="Recent orders" actions={<Button size="sm" variant="ghost" href="/admin/orders">View all</Button>} />
        <DataTable
          rows={recent}
          rowKey={(o) => o.id}
          mobileTitle={(o) => o.planName}
          columns={[
            { key: "id", label: "Order", render: (o) => <span className="font-mono text-xs">{o.id}</span> },
            { key: "user", label: "Trader", render: (o) => <div><p className="font-medium">{o.userName || o.userId}</p><p className="text-xs text-muted-foreground">{o.userEmail}</p></div> },
            { key: "plan", label: "Plan", render: (o) => o.planName || o.planId },
            { key: "amt", label: "Amount", render: (o) => <span className="font-semibold tabular-nums">{money(o.amountPaid)}</span> },
            { key: "date", label: "Date", render: (o) => <span className="text-muted-foreground">{fmtDate(o.createdAt, true)}</span> },
            { key: "status", label: "Status", render: (o) => <Badge>{o.status}</Badge> },
          ]}
        />
      </Card>
      <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground"><Users className="h-3.5 w-3.5" />Figures are computed from live orders, accounts and payouts.</p>
    </>
  );
}
