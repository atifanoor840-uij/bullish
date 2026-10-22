import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { Badge, Button, Card, DataTable, ErrorNote, Field, Loading, Modal, Note, PageHeader, Pager, SearchInput, Tabs, inputCls, useAction, useApi, usePaged } from "@/components/portal/ui";
import { usePortal } from "@/components/portal/context";
import { propApi, type InventoryItem, type Order, type TradingAccount } from "@/lib/propApi";
import { describeAccount, money, signed, sizeLabel, tone } from "@/lib/portal";

export const Route = createFileRoute("/admin/accounts/")({ component: AdminAccounts });

type F = "pending" | "Active" | "Funded" | "Passed" | "Failed" | "all";

function AdminAccounts() {
  const { refreshUnread } = usePortal();
  const { data, error, loading, reload } = useApi(async () => {
    const [a, o, inv] = await Promise.all([propApi.accounts.list(), propApi.orders.list(), propApi.admin.inventory().catch(() => ({ plans: [] }))]);
    return { accounts: a.accounts, orders: o.orders, inventory: inv.plans };
  }, [], "/admin");
  const [filter, setFilter] = useState<F>("pending");
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<TradingAccount | null>(null);
  const ordersById = useMemo(() => Object.fromEntries((data?.orders ?? []).map((o) => [o.id, o])), [data]);

  const all = [...(data?.accounts ?? [])].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const rows = all.filter(
    (a) =>
      (filter === "all" || (filter === "pending" ? a.deliveryStatus === "pending" : a.status === filter && a.deliveryStatus !== "pending")) &&
      (!q || [a.id, a.login, a.userName, a.userEmail, a.orderId].some((v) => v?.toLowerCase().includes(q.toLowerCase()))),
  );
  const { slice, ...pager } = usePaged(rows);
  const cnt = (f: F) => all.filter((a) => (f === "pending" ? a.deliveryStatus === "pending" : a.status === f && a.deliveryStatus !== "pending")).length;

  return (
    <>
      <PageHeader title="Accounts" subtitle="Deliver credentials, change stages and monitor every trading account." />
      {error && <ErrorNote message={error} onRetry={reload} />}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Tabs<F> value={filter} onChange={setFilter} tabs={[
          { id: "pending", label: "To deliver", count: cnt("pending") },
          { id: "Active", label: "Evaluation", count: cnt("Active") },
          { id: "Funded", label: "Funded", count: cnt("Funded") },
          { id: "Passed", label: "Passed", count: cnt("Passed") },
          { id: "Failed", label: "Failed", count: cnt("Failed") },
          { id: "all", label: "All", count: all.length },
        ]} />
        <SearchInput value={q} onChange={setQ} placeholder="Search login, trader, order…" />
      </div>
      <Card>
        {loading && !data ? <Loading /> : (
          <>
            <DataTable
              rows={slice}
              rowKey={(a) => a.id}
              mobileTitle={(a) => `#${a.login || a.id}`}
              columns={[
                { key: "acc", label: "Account", render: (a) => <div><p className="font-mono text-xs">#{a.login || "—"}</p><p className="text-[11px] text-muted-foreground">{a.platform} · {a.server}</p></div> },
                { key: "user", label: "Trader", render: (a) => <div><p className="font-medium">{a.userName || a.userId}</p><p className="text-xs text-muted-foreground">{a.userEmail}</p></div> },
                { key: "plan", label: "Plan", render: (a) => { const i = describeAccount(a, ordersById); return <div><p>{i.model} · {sizeLabel(i.size)}</p><p className="text-[11px] text-muted-foreground">{i.phase}</p></div>; } },
                { key: "bal", label: "Balance", render: (a) => <span className="tabular-nums">{money(a.balance)}</span> },
                { key: "pl", label: "P/L", render: (a) => <span className={`tabular-nums ${tone(a.totalPl)}`}>{signed(a.totalPl)}</span> },
                { key: "status", label: "Status", render: (a) => <div className="flex flex-wrap gap-1"><Badge>{a.status}</Badge>{a.deliveryStatus === "pending" && <Badge tone="warning">To deliver</Badge>}</div> },
                {
                  key: "act", label: "", className: "text-right",
                  render: (a) => (
                    <div className="flex justify-end gap-2">
                      {a.deliveryStatus !== "pending" && <Button size="sm" variant="ghost" href={`/admin/accounts/${encodeURIComponent(a.id)}`}>View</Button>}
                      <Button size="sm" variant={a.deliveryStatus === "pending" ? "primary" : "secondary"} onClick={() => setSel(a)}>{a.deliveryStatus === "pending" ? "Deliver" : "Edit"}</Button>
                    </div>
                  ),
                },
              ]}
            />
            <Pager {...pager} />
          </>
        )}
      </Card>
      {sel && data && (
        <EditAccount account={sel} ordersById={ordersById} inventory={data.inventory} onClose={() => setSel(null)} onChanged={() => { void reload(); refreshUnread(); }} />
      )}
    </>
  );
}

function EditAccount({ account: a, ordersById, inventory, onClose, onChanged }: { account: TradingAccount; ordersById: Record<string, Order>; inventory: InventoryItem[]; onClose: () => void; onChanged: () => void }) {
  const deliver = a.deliveryStatus === "pending";
  const info = describeAccount(a, ordersById);
  const matching = inventory.filter((i) => i.status === "available" && i.platform === a.platform && Number(i.size) === info.size);
  const [form, setForm] = useState({
    platform: a.platform,
    login: deliver ? "" : a.login,
    passwordMaster: deliver ? "" : a.passwordMaster,
    passwordInvestor: deliver ? "" : a.passwordInvestor,
    server: deliver ? "" : a.server,
    status: a.status,
    phase: a.phase || "",
    balance: String(a.balance),
    equity: String(a.equity ?? a.balance),
    graphLink: a.graphLink || "",
    externalStatisticsId: a.externalStatisticsId || "",
    inventoryItemId: "",
  });
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { busy, note, run } = useAction();
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm({ ...form, [k]: e.target.value });

  const pickInventory = (id: string) => {
    const it = inventory.find((i) => i.id === id);
    setForm((f) => (it ? { ...f, inventoryItemId: id, login: it.login, passwordMaster: it.password, server: it.server, externalStatisticsId: it.externalStatisticsId || f.externalStatisticsId, graphLink: it.graphLink || f.graphLink } : { ...f, inventoryItemId: "" }));
  };

  const save = async () => {
    const { inventoryItemId, balance, equity, graphLink, externalStatisticsId, passwordInvestor, ...rest } = form;
    const ok = await run("save", () =>
      propApi.accounts.save({
        id: a.id, ...rest, status: rest.status as TradingAccount["status"], balance: Number(balance), equity: Number(equity),
        ...(passwordInvestor ? { passwordInvestor } : {}), ...(graphLink ? { graphLink } : {}), ...(externalStatisticsId ? { externalStatisticsId } : {}), ...(inventoryItemId ? { inventoryItemId } : {}),
      }), deliver ? "Credentials delivered and emailed to the trader." : "Account updated.");
    if (ok) onChanged();
  };

  return (
    <Modal
      open
      onClose={onClose}
      wide
      title={deliver ? `Deliver credentials · ${info.model} ${sizeLabel(info.size)}` : `Edit account #${a.login}`}
      footer={<><Button variant="ghost" onClick={onClose}>Close</Button><Button variant="primary" busy={busy === "save"} disabled={!form.login || !form.passwordMaster || !form.server} onClick={save}>{deliver ? "Deliver" : "Save changes"}</Button></>}
    >
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">{a.userName} · {a.userEmail} · Order {a.orderId} · {info.phase}</p>
        {deliver && (
          <Field label="Use inventory credentials" hint={matching.length ? `${matching.length} available ${a.platform} ${sizeLabel(info.size)} accounts` : "No matching inventory — enter credentials manually."}>
            <select value={form.inventoryItemId} onChange={(e) => pickInventory(e.target.value)} className={inputCls}>
              <option value="">Enter manually</option>
              {matching.map((i) => <option key={i.id} value={i.id}>#{i.login} · {i.server}</option>)}
            </select>
          </Field>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Platform"><select value={form.platform} onChange={set("platform")} className={inputCls}>{["MT5", "MT4", "cTrader"].map((p) => <option key={p}>{p}</option>)}</select></Field>
          <Field label="Server"><input value={form.server} onChange={set("server")} className={inputCls} /></Field>
          <Field label="Login"><input value={form.login} onChange={set("login")} className={inputCls} /></Field>
          <Field label="Master password"><input value={form.passwordMaster} onChange={set("passwordMaster")} className={inputCls} /></Field>
          <Field label="Investor password"><input value={form.passwordInvestor} onChange={set("passwordInvestor")} className={inputCls} /></Field>
          <Field label="Statistics ID"><input value={form.externalStatisticsId} onChange={set("externalStatisticsId")} className={inputCls} /></Field>
          <Field label="Public stats link" className="sm:col-span-2"><input value={form.graphLink} onChange={set("graphLink")} className={inputCls} placeholder="https://" /></Field>
        </div>
        {!deliver && (
          <div className="grid gap-4 border-t border-white/[0.06] pt-4 sm:grid-cols-2">
            <Field label="Status" hint="Passed creates the next stage · Failed also fails the order."><select value={form.status} onChange={set("status")} className={inputCls}>{["Active", "Passed", "Failed", "Funded"].map((s) => <option key={s}>{s}</option>)}</select></Field>
            <Field label="Phase"><select value={form.phase} onChange={set("phase")} className={inputCls}>{["Phase 1 (Evaluation)", "Phase 2 (Verification)", "Funded (Live)"].map((s) => <option key={s}>{s}</option>)}</select></Field>
            <Field label="Balance"><input type="number" value={form.balance} onChange={set("balance")} className={inputCls} /></Field>
            <Field label="Equity"><input type="number" value={form.equity} onChange={set("equity")} className={inputCls} /></Field>
          </div>
        )}
        {note && <Note tone={note.tone}>{note.text}</Note>}
        <div className="border-t border-white/[0.06] pt-4">
          {confirmDelete ? (
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="text-loss">Delete this account? Inventory credentials are released.</span>
              <Button size="sm" variant="danger" busy={busy === "del"} onClick={async () => { if (await run("del", () => propApi.accounts.remove(a.id))) { onChanged(); onClose(); } }}>Yes, delete</Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>Cancel</Button>
            </div>
          ) : (
            <Button size="sm" variant="danger" onClick={() => setConfirmDelete(true)}><Trash2 className="h-3.5 w-3.5" />Delete account</Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
