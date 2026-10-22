import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Eye, Trash2 } from "lucide-react";
import { Badge, Button, Card, DataTable, ErrorNote, Field, Loading, Modal, Note, PageHeader, Pager, SearchInput, Tabs, inputCls, useAction, useApi, usePaged } from "@/components/portal/ui";
import { usePortal } from "@/components/portal/context";
import { propApi, type Order } from "@/lib/propApi";
import { fmtDate, money } from "@/lib/portal";

export const Route = createFileRoute("/admin/orders")({ component: AdminOrders });

const STATUSES = ["Pending", "Paid", "Active", "Step2 Active", "Live Active", "Passed", "Failed", "Replaced", "Payment Failed"];
type F = "all" | "pending" | "running" | "failed";

function AdminOrders() {
  const { refreshUnread } = usePortal();
  const { data, error, loading, reload } = useApi(async () => (await propApi.orders.list()).orders, [], "/admin");
  const [filter, setFilter] = useState<F>("all");
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<Order | null>(null);

  const all = [...(data ?? [])].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const match = (o: Order) =>
    (filter === "all" || (filter === "pending" && o.status === "Pending") || (filter === "failed" && /fail/i.test(o.status)) || (filter === "running" && /active|paid|passed/i.test(o.status))) &&
    (!q || [o.id, o.userName, o.userEmail, o.planName].some((v) => v?.toLowerCase().includes(q.toLowerCase())));
  const rows = all.filter(match);
  const { slice, ...pager } = usePaged(rows);

  return (
    <>
      <PageHeader title="Orders" subtitle="Confirm payments and drive each challenge through its stages." />
      {error && <ErrorNote message={error} onRetry={reload} />}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Tabs<F> value={filter} onChange={setFilter} tabs={[
          { id: "all", label: "All", count: all.length },
          { id: "pending", label: "Pending", count: all.filter((o) => o.status === "Pending").length },
          { id: "running", label: "Running" },
          { id: "failed", label: "Failed" },
        ]} />
        <SearchInput value={q} onChange={setQ} placeholder="Search order, trader, plan…" />
      </div>
      <Card>
        {loading && !data ? <Loading /> : (
          <>
            <DataTable
              rows={slice}
              rowKey={(o) => o.id}
              mobileTitle={(o) => `${o.id} · ${o.planName ?? ""}`}
              columns={[
                { key: "id", label: "Order", render: (o) => <span className="font-mono text-xs">{o.id}</span> },
                { key: "user", label: "Trader", render: (o) => <div><p className="font-medium">{o.userName || o.userId}</p><p className="text-xs text-muted-foreground">{o.userEmail}</p></div> },
                { key: "plan", label: "Plan", render: (o) => o.planName || o.planId },
                { key: "pay", label: "Payment", render: (o) => <div className="text-xs"><p>{o.paymentMethod}</p>{o.couponUsed && <p className="text-muted-foreground">Code {o.couponUsed}</p>}</div> },
                { key: "amt", label: "Amount", render: (o) => <span className="font-semibold tabular-nums">{money(o.amountPaid)}</span> },
                { key: "date", label: "Date", render: (o) => <span className="text-xs text-muted-foreground">{fmtDate(o.createdAt, true)}</span> },
                { key: "status", label: "Status", render: (o) => <div className="flex flex-wrap gap-1"><Badge>{o.status}</Badge>{o.legacyRules && <Badge tone="neutral">Legacy</Badge>}</div> },
                { key: "act", label: "", className: "text-right", render: (o) => <Button size="sm" onClick={() => setSel(o)}>Manage</Button> },
              ]}
            />
            <Pager {...pager} />
          </>
        )}
      </Card>
      {sel && <ManageOrder order={sel} onClose={() => setSel(null)} onChanged={() => { void reload(); refreshUnread(); }} />}
    </>
  );
}

function ManageOrder({ order, onClose, onChanged }: { order: Order; onClose: () => void; onChanged: () => void }) {
  const [status, setStatus] = useState(order.status);
  const [proof, setProof] = useState<{ url: string; walletId: string; txid: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { busy, note, run } = useAction();
  const manual = order.gatewayRef?.startsWith("manual:");

  return (
    <Modal open onClose={onClose} title={`Order ${order.id}`} wide>
      <div className="space-y-5">
        <dl className="grid gap-3 rounded-xl bg-background p-4 text-sm sm:grid-cols-2">
          {[["Trader", `${order.userName ?? order.userId} · ${order.userEmail ?? ""}`], ["Plan", order.planName || order.planId], ["Amount", money(order.amountPaid)], ["Payment", order.paymentMethod], ["Gateway ref", order.gatewayRef || "—"], ["Created", fmtDate(order.createdAt, true)]].map(([k, v]) => (
            <div key={k} className="min-w-0"><dt className="text-[11px] text-muted-foreground">{k}</dt><dd className="truncate">{v}</dd></div>
          ))}
        </dl>

        {manual && (
          <div className="space-y-3">
            <Button size="sm" busy={busy === "proof"} onClick={() => run("proof", async () => setProof(await propApi.orders.viewPaymentProof(order.id)))}><Eye className="h-3.5 w-3.5" />View payment proof</Button>
            {proof && (
              <div className="rounded-xl border border-white/[0.06] p-3 text-xs">
                <p className="text-muted-foreground">{proof.walletId} · TXID <span className="font-mono text-foreground">{proof.txid}</span></p>
                <img src={proof.url} alt="Payment proof" className="mt-3 max-h-80 rounded-lg" />
              </div>
            )}
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <Field label="Order status" hint="Active creates Phase 1 · Step2 Active creates Phase 2 · Live Active creates the funded account · Passed advances the latest account.">
            <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputCls}>
              {STATUSES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </Field>
          <Button variant="primary" disabled={status === order.status} busy={busy === "status"} onClick={async () => (await run("status", () => propApi.orders.setStatus(order.id, status), `Status changed to ${status}.`)) && onChanged()}>Update status</Button>
        </div>

        <label className="flex items-center justify-between gap-4 rounded-xl border border-white/[0.06] p-4 text-sm">
          <div><p className="font-semibold">Legacy rulebook</p><p className="text-xs text-muted-foreground">Pin this order to the pre-2026 rules.</p></div>
          <input type="checkbox" defaultChecked={!!order.legacyRules} onChange={(e) => run("legacy", () => propApi.orders.setLegacyRules(order.id, e.target.checked), "Rulebook updated.").then((ok) => ok && onChanged())} className="h-4 w-4 accent-[var(--primary)]" />
        </label>

        {note && <Note tone={note.tone}>{note.text}</Note>}

        <div className="border-t border-white/[0.06] pt-4">
          {confirmDelete ? (
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="text-loss">Delete this order and all its accounts?</span>
              <Button size="sm" variant="danger" busy={busy === "del"} onClick={async () => { if (await run("del", () => propApi.orders.remove(order.id))) { onChanged(); onClose(); } }}>Yes, delete</Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>Cancel</Button>
            </div>
          ) : (
            <Button size="sm" variant="danger" onClick={() => setConfirmDelete(true)}><Trash2 className="h-3.5 w-3.5" />Delete order</Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
