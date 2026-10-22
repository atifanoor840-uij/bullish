import { createFileRoute } from "@tanstack/react-router";
import { Users, DollarSign, Clock, CheckCircle2 } from "lucide-react";
import { Badge, Card, CardHeader, CopyButton, DataTable, EmptyState, ErrorNote, Loading, PageHeader, StatCard, useApi } from "@/components/portal/ui";
import { propApi } from "@/lib/propApi";
import { fmtDate, money, num } from "@/lib/portal";

export const Route = createFileRoute("/dashboard/referrals")({ component: Referrals });

type Referral = { referredUserId: string; referredName?: string; referredEmail?: string; orderId: string; planName?: string; amountPaid?: number; commissionAmount: number; status: string; createdAt: string };
type AffiliateData = {
  affiliate: { referralCode: string; commissionRate: number };
  metrics: { totalReferrals: number; totalEarned: number; pendingEarned: number; paidEarned: number };
  referrals: Referral[];
};

function Referrals() {
  const { data, error, loading, reload } = useApi(async () => (await propApi.affiliate.get()) as AffiliateData);
  const link = data ? `${window.location.origin}/signup?ref=${data.affiliate.referralCode}` : "";
  const available = (data?.referrals ?? []).filter((r) => r.status === "approved").reduce((s, r) => s + num(r.commissionAmount), 0);

  return (
    <>
      <PageHeader title="Referrals" subtitle="Invite traders and earn commission on every challenge they buy." />
      {error && <ErrorNote message={error} onRetry={reload} />}
      {loading && !data ? (
        <Card><Loading /></Card>
      ) : data && (
        <>
          <Card highlight className="mb-6 p-6">
            <div className="grid gap-6 lg:grid-cols-2 lg:items-center">
              <div>
                <p className="text-sm text-muted-foreground">Your referral link</p>
                <div className="mt-2 flex items-center gap-2 rounded-xl bg-background px-4 py-3">
                  <span className="min-w-0 flex-1 truncate font-mono text-sm">{link}</span>
                  <CopyButton value={link} label="Copy link" />
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  Code <span className="font-semibold text-foreground">{data.affiliate.referralCode}</span> <CopyButton value={data.affiliate.referralCode} label="Copy code" /> · Friends get 10% off, you earn {data.affiliate.commissionRate}%.
                </p>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                {[["1", "Share your link"], ["2", "Friend buys a challenge"], ["3", "You earn commission"]].map(([n, t]) => (
                  <div key={n} className="rounded-xl bg-background/60 p-3">
                    <span className="mx-auto flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{n}</span>
                    <p className="mt-2 text-xs text-muted-foreground">{t}</p>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Referrals" value={data.metrics.totalReferrals} icon={<Users className="h-4 w-4" />} />
            <StatCard label="Total earned" value={money(data.metrics.totalEarned)} icon={<DollarSign className="h-4 w-4" />} />
            <StatCard label="Pending" value={money(data.metrics.pendingEarned)} icon={<Clock className="h-4 w-4" />} sub="Approved after the order is paid" />
            <StatCard label="Available balance" value={money(available)} valueClass="text-profit" icon={<CheckCircle2 className="h-4 w-4" />} sub="Spend it on your next challenge" />
          </div>

          <Card>
            <CardHeader title="Referral activity" />
            <DataTable
              rows={data.referrals}
              rowKey={(r) => `${r.referredUserId}-${r.orderId}`}
              mobileTitle={(r) => r.referredName}
              empty={<EmptyState title="No referrals yet" body="Share your link to start earning." />}
              columns={[
                { key: "who", label: "Trader", render: (r) => <div><p className="font-medium">{r.referredName || "—"}</p><p className="text-xs text-muted-foreground">{r.referredEmail}</p></div> },
                { key: "plan", label: "Challenge", render: (r) => r.planName || r.orderId },
                { key: "date", label: "Date", render: (r) => <span className="text-muted-foreground">{fmtDate(r.createdAt)}</span> },
                { key: "amount", label: "Order", render: (r) => money(r.amountPaid ?? 0) },
                { key: "comm", label: "Commission", render: (r) => <span className="font-semibold text-profit">{money(r.commissionAmount)}</span> },
                { key: "status", label: "Status", render: (r) => <Badge>{r.status}</Badge> },
              ]}
            />
          </Card>
        </>
      )}
    </>
  );
}
