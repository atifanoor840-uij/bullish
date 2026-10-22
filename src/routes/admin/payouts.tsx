import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Badge, Button, Card, DataTable, ErrorNote, Field, Loading, Modal, Note, PageHeader, Pager, SearchInput, Tabs, inputCls, useAction, useApi, usePaged } from "@/components/portal/ui";
import { usePortal } from "@/components/portal/context";
import { propApi, type Payout } from "@/lib/propApi";
import { fmtDate, money } from "@/lib/portal";

export const Route = createFileRoute("/admin/payouts")({ component: AdminPayouts });

type F = "pending" | "approved" | "paid" | "rejected" | "all";

const details = (raw: string) => {
  try {
    const o = JSON.parse(raw);
    return typeof o === "object" && o ? Object.entries(o as Record<string, string>) : [["Details", raw]];
  } catch {
    return [["Details", raw]];
  }
};

function AdminPayouts() {
  const { refreshUnread } = usePortal();
  const { data, error, loading, reload } = useApi(async () => (await propApi.payouts.list()).payouts, [], "/admin");
  const [filter, setFilter] = useState<F>("pending");
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<Payout | null>(null);
  const all = [...(data ?? [])].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const rows = all.filter((p) => (filter === "all" || (filter === "approved" ? ["approved", "processing"].includes(p.status) : p.status === filter)) && (!q || [p.id, p.userName, p.userEmail, p.accountId].some((v) => v?.toLowerCase().includes(q.toLowerCase()))));
  const { slice, ...pager } = usePaged(rows);

  return (
    <>
      <PageHeader title="Payouts" subtitle="Review withdrawal requests and mark them paid." />
      {error && <ErrorNote message={error} onRetry={reload} />}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Tabs<F> value={filter} onChange={setFilter} tabs={[
          { id: "pending", label: "Pending", count: all.filter((p) => p.status === "pending").length },
          { id: "approved", label: "Approved" },
          { id: "paid", label: "Paid" },
          { id: "rejected", label: "Rejected" },
          { id: "all", label: "All", count: all.length },
        ]} />
        <SearchInput value={q} onChange={setQ} placeholder="Search trader, payout, account…" />
      </div>
      <Card>
        {loading && !data ? <Loading /> : (
          <>
            <DataTable
              rows={slice}
              rowKey={(p) => p.id}
              mobileTitle={(p) => `${p.id} · ${money(p.amount)}`}
              columns={[
                { key: "id", label: "Payout", render: (p) => <span className="font-mono text-xs">{p.id}</span> },
                { key: "user", label: "Trader", render: (p) => <div><p className="font-medium">{p.userName || p.userId}</p><p className="text-xs text-muted-foreground">{p.userEmail}</p></div> },
                { key: "acc", label: "Account", render: (p) => `#${p.accountId}` },
                { key: "amt", label: "Gross", render: (p) => <span className="font-semibold tabular-nums">{money(p.amount)}</span> },
                { key: "split", label: "Trader / Firm", render: (p) => <span className="text-xs tabular-nums"><span className="text-profit">{money(p.profitSplitAmount)}</span> / {money(p.firmShareAmount)}</span> },
                { key: "method", label: "Method", render: (p) => <span className="text-muted-foreground">{p.paymentMethod}</span> },
                { key: "date", label: "Requested", render: (p) => <span className="text-xs text-muted-foreground">{fmtDate(p.createdAt, true)}</span> },
                { key: "status", label: "Status", render: (p) => <Badge>{p.status}</Badge> },
                { key: "act", label: "", className: "text-right", render: (p) => <Button size="sm" variant={p.status === "pending" ? "primary" : "secondary"} onClick={() => setSel(p)}>Review</Button> },
              ]}
            />
            <Pager {...pager} />
          </>
        )}
      </Card>
      {sel && <ReviewPayout payout={sel} onClose={() => setSel(null)} onChanged={() => { void reload(); refreshUnread(); }} />}
    </>
  );
}

function ReviewPayout({ payout: p, onClose, onChanged }: { payout: Payout; onClose: () => void; onChanged: () => void }) {
  const [notes, setNotes] = useState(p.notes || "");
  const { busy, note, run } = useAction();
  const act = async (status: Payout["status"], label: string) => {
    if (await run(status, () => propApi.payouts.review(p.id, status, notes || undefined), `Payout ${label}.`)) onChanged();
  };
  return (
    <Modal open onClose={onClose} title={`Payout ${p.id}`}>
      <div className="space-y-4">
        <div className="rounded-xl bg-background p-4">
          <p className="text-xs text-muted-foreground">{p.userName} · {p.userEmail} · Account #{p.accountId}</p>
          <p className="mt-2 font-display text-3xl font-semibold">{money(p.amount)}</p>
          <p className="text-xs text-muted-foreground">Trader receives <span className="text-profit">{money(p.profitSplitAmount)}</span> · firm keeps {money(p.firmShareAmount)}</p>
        </div>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Method</dt><dd>{p.paymentMethod}</dd></div>
          {details(p.paymentDetails).map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4"><dt className="text-muted-foreground capitalize">{k}</dt><dd className="font-mono text-xs break-all">{v}</dd></div>
          ))}
          <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Status</dt><dd><Badge>{p.status}</Badge></dd></div>
        </dl>
        <Field label="Notes" hint="Sent to the trader with a rejection."><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className={inputCls} /></Field>
        {note && <Note tone={note.tone}>{note.text}</Note>}
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="danger" busy={busy === "rejected"} disabled={p.status === "paid"} onClick={() => act("rejected", "rejected")}>Reject</Button>
          <Button busy={busy === "approved"} disabled={p.status !== "pending"} onClick={() => act("approved", "approved")}>Approve</Button>
          <Button variant="success" busy={busy === "paid"} disabled={p.status === "paid" || p.status === "rejected"} onClick={() => act("paid", "marked as paid")}>Mark paid</Button>
        </div>
      </div>
    </Modal>
  );
}
