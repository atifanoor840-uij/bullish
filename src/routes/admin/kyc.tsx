import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ExternalLink, RefreshCw } from "lucide-react";
import { Badge, Button, Card, DataTable, ErrorNote, Field, Loading, Modal, Note, PageHeader, SearchInput, Tabs, inputCls, useAction, useApi } from "@/components/portal/ui";
import { usePortal } from "@/components/portal/context";
import { propApi, type Kyc } from "@/lib/propApi";
import { fmtDate } from "@/lib/portal";

export const Route = createFileRoute("/admin/kyc")({ component: AdminKyc });

type Row = Kyc & { userName?: string; userEmail?: string };
type F = "review" | "approved" | "rejected" | "all";

function AdminKyc() {
  const { refreshUnread } = usePortal();
  const { data, error, loading, reload } = useApi(async () => {
    const r = await propApi.kyc.get();
    return (Array.isArray(r.kyc) ? r.kyc : []) as Row[];
  }, [], "/admin");
  const [filter, setFilter] = useState<F>("review");
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<Row | null>(null);
  const all = [...(data ?? [])].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  const rows = all.filter((k) => (filter === "all" || (filter === "review" ? ["pending", "needs_review"].includes(k.status) : k.status === filter)) && (!q || [k.userName, k.userEmail, k.userId].some((v) => v?.toLowerCase().includes(q.toLowerCase()))));

  return (
    <>
      <PageHeader title="KYC" subtitle="Approve or reject identity verifications. Approval is required for payouts." />
      {error && <ErrorNote message={error} onRetry={reload} />}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Tabs<F> value={filter} onChange={setFilter} tabs={[
          { id: "review", label: "To review", count: all.filter((k) => ["pending", "needs_review"].includes(k.status)).length },
          { id: "approved", label: "Approved" },
          { id: "rejected", label: "Rejected" },
          { id: "all", label: "All", count: all.length },
        ]} />
        <SearchInput value={q} onChange={setQ} placeholder="Search trader…" />
      </div>
      <Card>
        {loading && !data ? <Loading /> : (
          <DataTable
            rows={rows}
            rowKey={(k) => k.userId}
            mobileTitle={(k) => k.userName}
            columns={[
              { key: "user", label: "Trader", render: (k) => <div><p className="font-medium">{k.userName || k.userId}</p><p className="text-xs text-muted-foreground">{k.userEmail}</p></div> },
              { key: "type", label: "Method", render: (k) => <span className="capitalize">{k.documentType.replace("_", " ")}</span> },
              { key: "date", label: "Updated", render: (k) => <span className="text-xs text-muted-foreground">{fmtDate(k.updatedAt, true)}</span> },
              { key: "status", label: "Status", render: (k) => <Badge>{k.status === "needs_review" ? "needs review" : k.status}</Badge> },
              { key: "act", label: "", className: "text-right", render: (k) => <Button size="sm" variant={["pending", "needs_review"].includes(k.status) ? "primary" : "secondary"} onClick={() => setSel(k)}>Review</Button> },
            ]}
          />
        )}
      </Card>
      {sel && <ReviewKyc kyc={sel} onClose={() => setSel(null)} onChanged={() => { void reload(); refreshUnread(); }} />}
    </>
  );
}

function ReviewKyc({ kyc: k, onClose, onChanged }: { kyc: Row; onClose: () => void; onChanged: () => void }) {
  const [reason, setReason] = useState(k.rejectReason || "");
  const { busy, note, run } = useAction();
  const didit = k.documentType === "didit";
  const docs = didit ? [] : ([["Front", k.frontUrl], ["Back", k.backUrl], ["Selfie", k.selfieUrl], ["Proof of address", k.addressUrl]] as const).filter(([, u]) => !!u);
  const set = async (status: Kyc["status"]) => {
    if (await run(status, () => propApi.kyc.review(k.userId, status, status === "rejected" ? reason || undefined : undefined), "KYC updated and trader notified.")) onChanged();
  };
  return (
    <Modal open onClose={onClose} title={`KYC · ${k.userName ?? k.userId}`}>
      <div className="space-y-4">
        <div className="flex items-center justify-between rounded-xl bg-background p-4 text-sm">
          <span className="text-muted-foreground">{k.userEmail}</span>
          <Badge>{k.status}</Badge>
        </div>
        {didit ? (
          <div className="space-y-2 text-sm">
            <p className="text-muted-foreground">Verified through Didit. Provider status: <span className="text-foreground">{k.addressUrl || "—"}</span></p>
            <div className="flex flex-wrap gap-2">
              {k.backUrl?.startsWith("http") && <Button size="sm" href={k.backUrl}><ExternalLink className="h-3.5 w-3.5" />Open session</Button>}
              <Button size="sm" busy={busy === "sync"} onClick={async () => (await run("sync", () => propApi.kyc.syncDidit(k.userId), "Synced with Didit.")) && onChanged()}><RefreshCw className="h-3.5 w-3.5" />Sync from Didit</Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {docs.map(([label, url]) => (
              <a key={label} href={url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between rounded-xl border border-white/[0.06] px-3 py-2.5 text-sm transition hover:border-primary/40">
                {label}<ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
              </a>
            ))}
          </div>
        )}
        <Field label="Rejection reason" hint="Shown to the trader if you reject."><input value={reason} onChange={(e) => setReason(e.target.value)} className={inputCls} /></Field>
        {note && <Note tone={note.tone}>{note.text}</Note>}
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="danger" busy={busy === "rejected"} onClick={() => set("rejected")}>Reject</Button>
          <Button busy={busy === "needs_review"} onClick={() => set("needs_review")}>Needs review</Button>
          <Button variant="success" busy={busy === "approved"} onClick={() => set("approved")}>Approve</Button>
        </div>
      </div>
    </Modal>
  );
}
