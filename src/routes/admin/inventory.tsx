import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Badge, Button, Card, DataTable, EmptyState, ErrorNote, Field, Loading, Modal, Note, PageHeader, Pager, SearchInput, StatCard, Tabs, inputCls, useAction, useApi, usePaged } from "@/components/portal/ui";
import { propApi, type InventoryItem } from "@/lib/propApi";
import { fmtDate, sizeLabel } from "@/lib/portal";

export const Route = createFileRoute("/admin/inventory")({ component: AdminInventory });

type F = "available" | "delivered" | "all";

function AdminInventory() {
  const { data, error, loading, reload } = useApi(async () => (await propApi.admin.inventory()).plans, [], "/admin");
  const [filter, setFilter] = useState<F>("available");
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<Partial<InventoryItem> | null>(null);
  const all = data ?? [];
  const rows = all.filter((i) => (filter === "all" || i.status === filter) && (!q || [i.login, i.server, i.orderId].some((v) => v?.toLowerCase().includes(q.toLowerCase()))));
  const { slice, ...pager } = usePaged(rows);
  const avail = all.filter((i) => i.status === "available");
  const bySize = [...new Set(avail.map((i) => i.size))].sort((a, b) => a - b);

  return (
    <>
      <PageHeader title="Inventory" subtitle="Pre-created platform credentials, delivered automatically when an order is paid." actions={<Button variant="primary" onClick={() => setEdit({ platform: "MT5", size: 100000 })}><Plus className="h-4 w-4" />Add credentials</Button>} />
      {error && <ErrorNote message={error} onRetry={reload} />}
      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <StatCard highlight label="Available" value={avail.length} sub={bySize.map((s) => `${sizeLabel(s)} ×${avail.filter((i) => i.size === s).length}`).join(" · ") || "Pool is empty"} />
        <StatCard label="Delivered" value={all.filter((i) => i.status === "delivered").length} />
        <StatCard label="Total" value={all.length} />
      </div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Tabs<F> value={filter} onChange={setFilter} tabs={[{ id: "available", label: "Available", count: avail.length }, { id: "delivered", label: "Delivered" }, { id: "all", label: "All", count: all.length }]} />
        <SearchInput value={q} onChange={setQ} placeholder="Search login, server, order…" />
      </div>
      <Card>
        {loading && !data ? <Loading /> : (
          <>
            <DataTable
              rows={slice}
              rowKey={(i) => i.id}
              mobileTitle={(i) => `#${i.login}`}
              empty={<EmptyState title="No credentials here" />}
              columns={[
                { key: "login", label: "Login", render: (i) => <span className="font-mono">#{i.login}</span> },
                { key: "plat", label: "Platform", render: (i) => i.platform },
                { key: "size", label: "Size", render: (i) => <span className="font-semibold">{sizeLabel(i.size)}</span> },
                { key: "server", label: "Server", render: (i) => <span className="text-muted-foreground">{i.server}</span> },
                { key: "order", label: "Order", render: (i) => <span className="font-mono text-xs">{i.orderId || "—"}</span> },
                { key: "date", label: "Added", render: (i) => <span className="text-xs text-muted-foreground">{fmtDate(i.createdAt)}</span> },
                { key: "status", label: "Status", render: (i) => <Badge>{i.status}</Badge> },
                { key: "act", label: "", className: "text-right", render: (i) => <Button size="sm" onClick={() => setEdit(i)}>Edit</Button> },
              ]}
            />
            <Pager {...pager} />
          </>
        )}
      </Card>
      {edit && <EditItem item={edit} onClose={() => setEdit(null)} onChanged={reload} />}
    </>
  );
}

function EditItem({ item, onClose, onChanged }: { item: Partial<InventoryItem>; onClose: () => void; onChanged: () => void }) {
  const [f, setF] = useState({ platform: item.platform ?? "MT5", size: String(item.size ?? ""), login: item.login ?? "", password: item.password ?? "", server: item.server ?? "", externalStatisticsId: item.externalStatisticsId ?? "", graphLink: item.graphLink ?? "" });
  const { busy, note, run } = useAction();
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const save = async () => {
    const body = { platform: f.platform, size: Number(f.size), login: f.login, password: f.password, server: f.server, ...(f.externalStatisticsId ? { externalStatisticsId: f.externalStatisticsId } : {}), ...(f.graphLink ? { graphLink: f.graphLink } : {}) };
    const ok = await run("save", () => (item.id ? propApi.admin.updateInventory({ id: item.id, ...body, platform: f.platform as InventoryItem["platform"] }) : propApi.admin.addInventory(body)), "Saved.");
    if (ok) { onChanged(); if (!item.id) onClose(); }
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={item.id ? `Edit #${item.login}` : "Add credentials"}
      footer={
        <>
          {item.id && item.status !== "delivered" && <Button variant="danger" className="mr-auto" busy={busy === "del"} onClick={async () => { if (await run("del", () => propApi.admin.deleteInventory(item.id!))) { onChanged(); onClose(); } }}><Trash2 className="h-4 w-4" />Delete</Button>}
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" busy={busy === "save"} disabled={!f.login || !f.password || !f.server || !Number(f.size)} onClick={save}>Save</Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Platform"><select value={f.platform} onChange={set("platform")} className={inputCls}>{["MT5", "MT4", "cTrader"].map((p) => <option key={p}>{p}</option>)}</select></Field>
        <Field label="Account size ($)"><input type="number" value={f.size} onChange={set("size")} className={inputCls} /></Field>
        <Field label="Login"><input value={f.login} onChange={set("login")} className={inputCls} /></Field>
        <Field label="Password"><input value={f.password} onChange={set("password")} className={inputCls} /></Field>
        <Field label="Server" className="sm:col-span-2"><input value={f.server} onChange={set("server")} className={inputCls} /></Field>
        <Field label="Statistics ID"><input value={f.externalStatisticsId} onChange={set("externalStatisticsId")} className={inputCls} /></Field>
        <Field label="Public stats link"><input value={f.graphLink} onChange={set("graphLink")} className={inputCls} placeholder="https://" /></Field>
        {item.status === "delivered" && <p className="text-[11px] text-amber-500 sm:col-span-2">Delivered to order {item.orderId}. Credential changes are blocked while assigned; the stats link still syncs to the account.</p>}
        {note && <div className="sm:col-span-2"><Note tone={note.tone}>{note.text}</Note></div>}
      </div>
    </Modal>
  );
}
