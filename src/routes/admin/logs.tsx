import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Badge, Card, DataTable, EmptyState, ErrorNote, Loading, PageHeader, Pager, SearchInput, StatCard, Tabs, useApi, usePaged } from "@/components/portal/ui";
import { propApi } from "@/lib/propApi";
import { fmtDate, money } from "@/lib/portal";

export const Route = createFileRoute("/admin/logs")({ component: AdminLogs });

type Audit = { id: string; userName: string; action: string; description: string; targetType: string; targetId: string; createdAt: string };
type Email = { id: string; toEmail: string; subject: string; status: string; provider: string; error?: string; sentAt: string };
type Pixel = { id: string; eventName: string; source: string; status: string; value?: number; currency?: string; orderId?: string; error?: string; createdAt: string };
type T = "audit" | "email" | "pixel";

function AdminLogs() {
  const { data, error, loading, reload } = useApi(async () => {
    const [a, e, p] = await Promise.all([
      propApi.admin.auditLogs() as Promise<{ logs: Audit[] }>,
      propApi.admin.emailLogs() as Promise<{ emailLogs: Email[] }>,
      propApi.admin.pixelEvents().catch(() => ({ events: [], summary: null })) as Promise<{ events: Pixel[]; summary: { total: number; sent: number; failed: number; purchases: number; purchaseValue: number } | null }>,
    ]);
    return { audit: a.logs, email: e.emailLogs, pixel: p.events, summary: p.summary };
  }, [], "/admin");
  const [tab, setTab] = useState<T>("audit");
  const [q, setQ] = useState("");
  const has = (...v: (string | undefined)[]) => !q || v.some((x) => x?.toLowerCase().includes(q.toLowerCase()));

  const audit = usePaged((data?.audit ?? []).filter((l) => has(l.userName, l.action, l.description, l.targetId)), 20);
  const email = usePaged((data?.email ?? []).filter((l) => has(l.toEmail, l.subject, l.status)), 20);
  const pixel = usePaged((data?.pixel ?? []).filter((l) => has(l.eventName, l.orderId, l.status)), 20);

  return (
    <>
      <PageHeader title="Logs" subtitle="Staff actions, outgoing emails and tracking events." />
      {error && <ErrorNote message={error} onRetry={reload} />}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Tabs<T> value={tab} onChange={setTab} tabs={[
          { id: "audit", label: "Audit trail", count: data?.audit.length ?? 0 },
          { id: "email", label: "Emails", count: data?.email.length ?? 0 },
          { id: "pixel", label: "Pixel events", count: data?.pixel.length ?? 0 },
        ]} />
        <SearchInput value={q} onChange={setQ} />
      </div>
      {loading && !data ? <Card><Loading /></Card> : (
        <>
          {tab === "pixel" && data?.summary && (
            <div className="mb-5 grid gap-4 sm:grid-cols-4">
              <StatCard label="Events" value={data.summary.total} />
              <StatCard label="Delivered" value={data.summary.sent} valueClass="text-profit" />
              <StatCard label="Failed" value={data.summary.failed} valueClass={data.summary.failed ? "text-loss" : ""} />
              <StatCard label="Purchases" value={money(data.summary.purchaseValue, 0)} sub={`${data.summary.purchases} purchase events`} />
            </div>
          )}
          <Card>
            {tab === "audit" && (
              <>
                <DataTable rows={audit.slice} rowKey={(l) => l.id} mobileTitle={(l) => l.action} empty={<EmptyState title="No staff actions yet" />} columns={[
                  { key: "date", label: "When", render: (l) => <span className="text-xs text-muted-foreground">{fmtDate(l.createdAt, true)}</span> },
                  { key: "who", label: "By", render: (l) => l.userName },
                  { key: "act", label: "Action", render: (l) => <span className="font-mono text-xs">{l.action}</span> },
                  { key: "desc", label: "Details", render: (l) => <span className="text-muted-foreground">{l.description}</span> },
                  { key: "target", label: "Target", render: (l) => <span className="font-mono text-xs">{l.targetType} · {l.targetId}</span> },
                ]} />
                <Pager page={audit.page} pages={audit.pages} setPage={audit.setPage} total={audit.total} />
              </>
            )}
            {tab === "email" && (
              <>
                <DataTable rows={email.slice} rowKey={(l) => l.id} mobileTitle={(l) => l.subject} empty={<EmptyState title="No emails logged" />} columns={[
                  { key: "date", label: "Sent", render: (l) => <span className="text-xs text-muted-foreground">{fmtDate(l.sentAt, true)}</span> },
                  { key: "to", label: "To", render: (l) => l.toEmail },
                  { key: "sub", label: "Subject", render: (l) => <span className="font-medium">{l.subject}</span> },
                  { key: "err", label: "Error", render: (l) => <span className="text-xs text-loss">{l.error || ""}</span> },
                  { key: "status", label: "Status", render: (l) => <Badge>{l.status}</Badge> },
                ]} />
                <Pager page={email.page} pages={email.pages} setPage={email.setPage} total={email.total} />
              </>
            )}
            {tab === "pixel" && (
              <>
                <DataTable rows={pixel.slice} rowKey={(l) => l.id} mobileTitle={(l) => l.eventName} empty={<EmptyState title="No events logged" />} columns={[
                  { key: "date", label: "When", render: (l) => <span className="text-xs text-muted-foreground">{fmtDate(l.createdAt, true)}</span> },
                  { key: "ev", label: "Event", render: (l) => <span className="font-medium">{l.eventName}</span> },
                  { key: "src", label: "Source", render: (l) => <span className="uppercase text-xs text-muted-foreground">{l.source}</span> },
                  { key: "val", label: "Value", render: (l) => (l.value ? money(l.value) : "—") },
                  { key: "order", label: "Order", render: (l) => <span className="font-mono text-xs">{l.orderId || "—"}</span> },
                  { key: "status", label: "Status", render: (l) => <Badge>{l.status}</Badge> },
                ]} />
                <Pager page={pixel.page} pages={pixel.pages} setPage={pixel.setPage} total={pixel.total} />
              </>
            )}
          </Card>
        </>
      )}
    </>
  );
}
