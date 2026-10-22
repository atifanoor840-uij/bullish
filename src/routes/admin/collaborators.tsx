import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus } from "lucide-react";
import { Badge, Button, Card, CardHeader, CopyButton, DataTable, EmptyState, ErrorNote, Field, Loading, Modal, Note, PageHeader, inputCls, useAction, useApi } from "@/components/portal/ui";
import { propApi } from "@/lib/propApi";
import { fmtDate, money } from "@/lib/portal";

export const Route = createFileRoute("/admin/collaborators")({ component: AdminCollaborators });

type Sale = { referredUserId: string; referredName?: string; orderId: string; saleAmount: number; commissionAmount: number; status: "pending" | "approved" | "paid"; createdAt: string; collaboratorId: string };
type Collaborator = { userId: string; referralCode: string; commissionRate: number; name: string; email: string; metrics: { registrations: number; totalSales: number; commissions: number; paidCommissions: number } };

function AdminCollaborators() {
  const { data, error, loading, reload } = useApi(async () => (await propApi.collaborators.get()) as { collaborators: Collaborator[]; sales: Sale[] }, [], "/admin");
  const [adding, setAdding] = useState(false);
  const { busy, run } = useAction();
  const byId = Object.fromEntries((data?.collaborators ?? []).map((c) => [c.userId, c]));

  return (
    <>
      <PageHeader title="Collaborators" subtitle="Partner program — 20% commission on every sale from their link." actions={<Button variant="primary" onClick={() => setAdding(true)}><Plus className="h-4 w-4" />Add collaborator</Button>} />
      {error && <ErrorNote message={error} onRetry={reload} />}
      {loading && !data ? <Card><Loading /></Card> : (
        <>
          {!data?.collaborators.length ? (
            <Card className="mb-5"><EmptyState title="No collaborators yet" /></Card>
          ) : (
            <div className="mb-5 grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
              {data.collaborators.map((c) => {
                const link = `${window.location.origin}/signup?collab=${c.referralCode}`;
                return (
                  <Card key={c.userId} className="p-5">
                    <p className="font-semibold">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{c.email}</p>
                    <div className="mt-3 flex items-center gap-2 rounded-lg bg-background px-3 py-2 text-xs">
                      <span className="min-w-0 flex-1 truncate font-mono">{link}</span><CopyButton value={link} />
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                      {[["Sign-ups", c.metrics.registrations], ["Sales", money(c.metrics.totalSales, 0)], ["Commission", money(c.metrics.commissions)], ["Paid", money(c.metrics.paidCommissions)]].map(([k, v]) => (
                        <div key={k} className="rounded-lg bg-background/50 p-2.5"><p className="text-muted-foreground">{k}</p><p className="mt-0.5 font-semibold">{v}</p></div>
                      ))}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
          <Card>
            <CardHeader title="Sales" meta={`${data?.sales.length ?? 0}`} />
            <DataTable
              rows={data?.sales ?? []}
              rowKey={(s) => `${s.referredUserId}-${s.orderId}`}
              mobileTitle={(s) => s.orderId}
              empty={<EmptyState title="No sales yet" />}
              columns={[
                { key: "col", label: "Collaborator", render: (s) => byId[s.collaboratorId]?.name ?? s.collaboratorId },
                { key: "who", label: "Customer", render: (s) => s.referredName ?? s.referredUserId },
                { key: "order", label: "Order", render: (s) => <span className="font-mono text-xs">{s.orderId}</span> },
                { key: "sale", label: "Sale", render: (s) => money(s.saleAmount) },
                { key: "comm", label: "Commission", render: (s) => <span className="font-semibold text-profit">{money(s.commissionAmount)}</span> },
                { key: "date", label: "Date", render: (s) => <span className="text-xs text-muted-foreground">{fmtDate(s.createdAt)}</span> },
                { key: "status", label: "Status", render: (s) => <Badge>{s.status}</Badge> },
                {
                  key: "act", label: "", className: "text-right",
                  render: (s) => (s.status !== "paid" ? <Button size="sm" variant="success" busy={busy === s.orderId} onClick={async () => (await run(s.orderId, () => propApi.collaborators.setSaleStatus(s.referredUserId, s.orderId, "paid"))) && reload()}>Mark paid</Button> : null),
                },
              ]}
            />
          </Card>
        </>
      )}
      {adding && <AddCollaborator onClose={() => setAdding(false)} onChanged={reload} />}
    </>
  );
}

function AddCollaborator({ onClose, onChanged }: { onClose: () => void; onChanged: () => void }) {
  const [f, setF] = useState({ name: "", email: "", password: "", referralCode: "" });
  const { busy, note, run } = useAction();
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <Modal
      open
      onClose={onClose}
      title="Add collaborator"
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" busy={busy === "add"} disabled={!f.name || !f.email || f.password.length < 8} onClick={async () => { if (await run("add", () => propApi.collaborators.create({ ...f, ...(f.referralCode ? { referralCode: f.referralCode.toUpperCase() } : {}) }), "Collaborator created.")) { onChanged(); onClose(); } }}>Create</Button></>}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name"><input value={f.name} onChange={set("name")} className={inputCls} /></Field>
        <Field label="Email"><input type="email" value={f.email} onChange={set("email")} className={inputCls} /></Field>
        <Field label="Password" hint="At least 8 characters"><input type="password" autoComplete="new-password" value={f.password} onChange={set("password")} className={inputCls} /></Field>
        <Field label="Referral code" hint="Optional — generated if empty"><input value={f.referralCode} onChange={set("referralCode")} className={`${inputCls} uppercase`} /></Field>
        {note && <div className="sm:col-span-2"><Note tone={note.tone}>{note.text}</Note></div>}
      </div>
    </Modal>
  );
}
