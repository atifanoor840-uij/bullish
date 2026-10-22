import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Badge, Button, Card, CardHeader, DataTable, EmptyState, ErrorNote, Loading, PageHeader, StatCard, inputCls, useAction, useApi } from "@/components/portal/ui";
import { propApi } from "@/lib/propApi";
import { fmtDate, money, num } from "@/lib/portal";

export const Route = createFileRoute("/admin/affiliates")({ component: AdminAffiliates });

type Affiliate = { userId: string; referralCode: string; commissionRate: number; name?: string; email?: string };
type Referral = { referredUserId: string; referredName?: string; referredEmail?: string; affiliateName?: string; referralCode?: string; orderId: string; amountPaid?: number; commissionAmount: number; status: "pending" | "approved" | "paid"; createdAt: string };

function AdminAffiliates() {
  const { data, error, loading, reload } = useApi(async () => (await propApi.affiliate.get()) as { affiliates: Affiliate[]; referrals: Referral[] }, [], "/admin");
  const { busy, run } = useAction();
  const [rates, setRates] = useState<Record<string, string>>({});
  const refs = data?.referrals ?? [];
  const sum = (s: string) => refs.filter((r) => r.status === s).reduce((t, r) => t + num(r.commissionAmount), 0);

  return (
    <>
      <PageHeader title="Affiliates" subtitle="Every trader has a referral code. Manage rates and pay commissions." />
      {error && <ErrorNote message={error} onRetry={reload} />}
      {loading && !data ? <Card><Loading /></Card> : (
        <>
          <div className="mb-5 grid gap-4 sm:grid-cols-3">
            <StatCard highlight label="Commission owed" value={money(sum("approved"))} sub="Approved, not yet paid" />
            <StatCard label="Pending" value={money(sum("pending"))} sub="Waiting for order payment" />
            <StatCard label="Paid out" value={money(sum("paid"))} />
          </div>

          <Card className="mb-5">
            <CardHeader title="Referrals" meta={`${refs.length}`} />
            <DataTable
              rows={refs}
              rowKey={(r) => `${r.referredUserId}-${r.orderId}`}
              mobileTitle={(r) => r.referredName}
              empty={<EmptyState title="No referrals yet" />}
              columns={[
                { key: "aff", label: "Affiliate", render: (r) => <div><p className="font-medium">{r.affiliateName}</p><p className="font-mono text-[11px] text-muted-foreground">{r.referralCode}</p></div> },
                { key: "ref", label: "Referred trader", render: (r) => <div><p>{r.referredName}</p><p className="text-xs text-muted-foreground">{r.referredEmail}</p></div> },
                { key: "order", label: "Order", render: (r) => <span className="font-mono text-xs">{r.orderId} · {money(r.amountPaid ?? 0)}</span> },
                { key: "comm", label: "Commission", render: (r) => <span className="font-semibold text-profit">{money(r.commissionAmount)}</span> },
                { key: "date", label: "Date", render: (r) => <span className="text-xs text-muted-foreground">{fmtDate(r.createdAt)}</span> },
                { key: "status", label: "Status", render: (r) => <Badge>{r.status}</Badge> },
                {
                  key: "act", label: "", className: "text-right",
                  render: (r) => {
                    const next = r.status === "pending" ? "approved" : r.status === "approved" ? "paid" : null;
                    return next ? <Button size="sm" variant={next === "paid" ? "success" : "secondary"} busy={busy === r.orderId} onClick={async () => (await run(r.orderId, () => propApi.affiliate.updateReferral(r.referredUserId, r.orderId, next))) && reload()}>{next === "paid" ? "Mark paid" : "Approve"}</Button> : null;
                  },
                },
              ]}
            />
          </Card>

          <Card>
            <CardHeader title="Affiliate rates" meta={`${data?.affiliates.length ?? 0}`} />
            <DataTable
              rows={data?.affiliates ?? []}
              rowKey={(a) => a.userId}
              mobileTitle={(a) => a.name}
              columns={[
                { key: "name", label: "Trader", render: (a) => <div><p className="font-medium">{a.name}</p><p className="text-xs text-muted-foreground">{a.email}</p></div> },
                { key: "code", label: "Code", render: (a) => <span className="font-mono">{a.referralCode}</span> },
                { key: "earned", label: "Earned", render: (a) => money(refs.filter((r) => r.referralCode === a.referralCode && r.status !== "pending").reduce((t, r) => t + num(r.commissionAmount), 0)) },
                {
                  key: "rate", label: "Rate %",
                  render: (a) => (
                    <div className="flex items-center justify-end gap-2 md:justify-start">
                      <input type="number" value={rates[a.userId] ?? String(a.commissionRate)} onChange={(e) => setRates({ ...rates, [a.userId]: e.target.value })} className={`${inputCls} w-20 py-1.5`} />
                      {rates[a.userId] !== undefined && Number(rates[a.userId]) !== a.commissionRate && (
                        <Button size="sm" variant="primary" busy={busy === a.userId} onClick={async () => (await run(a.userId, () => propApi.affiliate.updateRate(a.userId, Number(rates[a.userId])))) && reload()}>Save</Button>
                      )}
                    </div>
                  ),
                },
              ]}
            />
          </Card>
        </>
      )}
    </>
  );
}
