import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, type ReactNode } from "react";
import { Activity, BadgeCheck, Clock, SlidersHorizontal, Trash2, Trophy, X, XCircle, Zap } from "lucide-react";
import { Badge, Button, Card, DataTable, ErrorNote, Field, Loading, Modal, Note, PageHeader, Pager, SearchInput, StatCard, Tabs, cx, inputCls, useAction, useApi, usePaged } from "@/components/portal/ui";
import { usePortal } from "@/components/portal/context";
import { propApi, type InventoryItem, type Order, type TradingAccount } from "@/lib/propApi";
import { describeAccount, fmtDate, money, signed, sizeLabel, tone } from "@/lib/portal";

export const Route = createFileRoute("/admin/accounts/")({ component: AdminAccounts });

type F = "pending" | "live" | "Active" | "Funded" | "Passed" | "Failed" | "all";
type Sort = "new" | "old" | "bal" | "plHigh" | "plLow";

const isPending = (a: TradingAccount) => a.deliveryStatus === "pending";
const matchesTab = (a: TradingAccount, f: F) =>
  f === "all" ? true
  : f === "pending" ? isPending(a)
  : f === "live" ? !isPending(a) && (a.status === "Active" || a.status === "Funded")
  : a.status === f && !isPending(a);

const DAY = 86_400_000;
const ago = (iso: string) => {
  const m = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60_000));
  return m < 60 ? `${m}m` : m < 1440 ? `${Math.floor(m / 60)}h` : `${Math.floor(m / 1440)}d`;
};
const selCls = cx(inputCls, "h-9 py-1 text-xs");

function AdminAccounts() {
  const { refreshUnread } = usePortal();
  const { data, error, loading, reload } = useApi(async () => {
    const [a, o, inv] = await Promise.all([propApi.accounts.list(), propApi.orders.list(), propApi.admin.inventory().catch(() => ({ plans: [] }))]);
    return { accounts: a.accounts, orders: o.orders, inventory: inv.plans };
  }, [], "/admin");
  const [filter, setFilter] = useState<F>("pending");
  const [q, setQ] = useState("");
  const [model, setModel] = useState("all");
  const [size, setSize] = useState("all");
  const [phase, setPhase] = useState("all");
  const [platform, setPlatform] = useState("all");
  const [result, setResult] = useState<"all" | "profit" | "loss">("all");
  const [period, setPeriod] = useState<"all" | "1" | "7" | "30" | "90">("all");
  const [sort, setSort] = useState<Sort>("new");
  const [delivery, setDelivery] = useState<"all" | "pending" | "delivered" | "today" | "week" | "stock" | "nostock">("all");
  const [autoBusy, setAutoBusy] = useState("");
  const [autoNote, setAutoNote] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [sel, setSel] = useState<TradingAccount | null>(null);
  const ordersById = useMemo(() => Object.fromEntries((data?.orders ?? []).map((o) => [o.id, o])), [data]);

  const all = useMemo(() => (data?.accounts ?? []).map((a) => ({ a, info: describeAccount(a, ordersById) })), [data, ordersById]);
  const opts = useMemo(() => ({
    models: [...new Set(all.map((x) => x.info.model).filter(Boolean))].sort(),
    sizes: [...new Set(all.map((x) => x.info.size).filter((s) => s > 0))].sort((x, y) => x - y),
    phases: [...new Set(all.map((x) => x.info.phase).filter(Boolean))].sort(),
    platforms: [...new Set(all.map((x) => x.a.platform).filter(Boolean))].sort(),
  }), [all]);

  const since = period === "all" ? 0 : Date.now() - Number(period) * DAY;
  const ql = q.trim().toLowerCase();
  const rows = all
    .filter(({ a, info }) =>
      matchesTab(a, filter) &&
      (model === "all" || info.model === model) &&
      (size === "all" || String(info.size) === size) &&
      (phase === "all" || info.phase === phase) &&
      (platform === "all" || a.platform === platform) &&
      matchesDelivery(a) &&
      (result === "all" || (result === "profit" ? a.totalPl > 0 : a.totalPl < 0)) &&
      (!since || new Date(a.createdAt).getTime() >= since) &&
      (!ql || [a.id, a.login, a.userName, a.userEmail, a.orderId].some((v) => v?.toLowerCase().includes(ql))),
    )
    .sort((x, y) => {
      const t = (r: typeof x) => new Date(r.a.createdAt).getTime();
      switch (sort) {
        case "old": return t(x) - t(y);
        case "bal": return y.a.balance - x.a.balance;
        case "plHigh": return y.a.totalPl - x.a.totalPl;
        case "plLow": return x.a.totalPl - y.a.totalPl;
        default: return t(y) - t(x);
      }
    })
    .map((r) => r.a);
  const { slice, ...pager } = usePaged(rows);
  const cnt = (f: F) => all.filter((x) => matchesTab(x.a, f)).length;
  const extraFilters = [model, size, phase, platform, result, period, delivery].filter((v) => v !== "all").length;
  const clear = () => { setModel("all"); setSize("all"); setPhase("all"); setPlatform("all"); setResult("all"); setPeriod("all"); setDelivery("all"); setSort("new"); setQ(""); };

  // Delivery: inventory accounts that match a pending account (same platform + size, still available).
  function stockFor(a: TradingAccount) {
    const size = describeAccount(a, ordersById).size;
    return (data?.inventory ?? []).filter((i) => i.status === "available" && i.platform === a.platform && Number(i.size) === size);
  }
  function matchesDelivery(a: TradingAccount) {
    const at = a.deliveredAt ? new Date(a.deliveredAt).getTime() : 0;
    switch (delivery) {
      case "pending": return isPending(a);
      case "delivered": return !isPending(a);
      case "today": return !isPending(a) && at >= new Date().setHours(0, 0, 0, 0);
      case "week": return !isPending(a) && at >= Date.now() - 7 * DAY;
      case "stock": return isPending(a) && stockFor(a).length > 0;
      case "nostock": return isPending(a) && stockFor(a).length === 0;
      default: return true;
    }
  }
  // One-click delivery from inventory — same payload as the Deliver modal with the first matching inventory item.
  async function autoDeliver(a: TradingAccount) {
    const it = stockFor(a)[0];
    if (!it) return;
    setAutoBusy(a.id);
    setAutoNote(null);
    try {
      await propApi.accounts.save({
        id: a.id, platform: it.platform, login: it.login, passwordMaster: it.password, server: it.server,
        status: a.status, phase: a.phase || "", balance: Number(a.balance), equity: Number(a.equity ?? a.balance),
        inventoryItemId: it.id,
        ...(it.graphLink || a.graphLink ? { graphLink: it.graphLink || a.graphLink } : {}),
        ...(it.externalStatisticsId || a.externalStatisticsId ? { externalStatisticsId: it.externalStatisticsId || a.externalStatisticsId } : {}),
      });
      setAutoNote({ tone: "success", text: `Delivered #${it.login} to ${a.userName || a.userEmail} and emailed the credentials.` });
      void reload();
      refreshUnread();
    } catch (e) {
      setAutoNote({ tone: "error", text: e instanceof Error ? e.message : "Auto-delivery failed." });
    } finally {
      setAutoBusy("");
    }
  }
  const pendingWithStock = all.filter((x) => isPending(x.a) && stockFor(x.a).length > 0).length;

  const stat = (f: F, label: string, icon: ReactNode, sub: string, valueClass = "") => (
    <button onClick={() => setFilter(f)} className={cx("rounded-2xl text-left transition", filter === f ? "ring-2 ring-primary/60" : "hover:opacity-90")}>
      <StatCard label={label} value={cnt(f)} icon={icon} sub={sub} valueClass={valueClass} highlight={filter === f} />
    </button>
  );

  return (
    <>
      <PageHeader title="Accounts" subtitle="Deliver credentials, change stages and monitor every trading account." />
      {error && <ErrorNote message={error} onRetry={reload} />}

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
        {stat("live", "Active accounts", <Activity className="h-4 w-4" />, "Evaluation + funded", "text-profit")}
        {stat("pending", "Pending delivery", <Clock className="h-4 w-4" />, "Waiting for credentials", "text-amber-500")}
        {stat("Funded", "Funded", <BadgeCheck className="h-4 w-4" />, "Live funded accounts")}
        {stat("Passed", "Passed", <Trophy className="h-4 w-4" />, "Moved to next stage")}
        {stat("Failed", "Failed", <XCircle className="h-4 w-4" />, "Breached accounts", "text-loss")}
      </div>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <Tabs<F> value={filter} onChange={setFilter} tabs={[
          { id: "pending", label: "Pending", count: cnt("pending") },
          { id: "live", label: "Active", count: cnt("live") },
          { id: "Active", label: "Evaluation", count: cnt("Active") },
          { id: "Funded", label: "Funded", count: cnt("Funded") },
          { id: "Passed", label: "Passed", count: cnt("Passed") },
          { id: "Failed", label: "Failed", count: cnt("Failed") },
          { id: "all", label: "All", count: all.length },
        ]} />
        <SearchInput value={q} onChange={setQ} placeholder="Search login, trader, order…" />
      </div>

      <div className="mb-4 rounded-xl border border-white/[0.06] bg-card p-3">
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-muted-foreground"><SlidersHorizontal className="h-3.5 w-3.5" />Filters<span className="ml-auto font-normal">{rows.length} result{rows.length === 1 ? "" : "s"}</span>{(extraFilters > 0 || q || sort !== "new") && <Button size="sm" variant="ghost" onClick={clear}><X className="h-3.5 w-3.5" />Clear</Button>}</div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8">
        <select value={model} onChange={(e) => setModel(e.target.value)} className={selCls} aria-label="Model">
          <option value="all">All models</option>
          {opts.models.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <select value={size} onChange={(e) => setSize(e.target.value)} className={selCls} aria-label="Size">
          <option value="all">All sizes</option>
          {opts.sizes.map((s) => <option key={s} value={String(s)}>{sizeLabel(s)}</option>)}
        </select>
        <select value={phase} onChange={(e) => setPhase(e.target.value)} className={selCls} aria-label="Phase">
          <option value="all">All phases</option>
          {opts.phases.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={platform} onChange={(e) => setPlatform(e.target.value)} className={selCls} aria-label="Platform">
          <option value="all">All platforms</option>
          {opts.platforms.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={result} onChange={(e) => setResult(e.target.value as typeof result)} className={selCls} aria-label="P/L">
          <option value="all">Any P/L</option>
          <option value="profit">In profit</option>
          <option value="loss">In loss</option>
        </select>
        <select value={delivery} onChange={(e) => setDelivery(e.target.value as typeof delivery)} className={selCls} aria-label="Delivery">
          <option value="all">Any delivery</option>
          <option value="pending">Not delivered</option>
          <option value="stock">Pending · inventory ready</option>
          <option value="nostock">Pending · no inventory</option>
          <option value="delivered">Delivered</option>
          <option value="today">Delivered today</option>
          <option value="week">Delivered last 7 days</option>
        </select>
        <select value={period} onChange={(e) => setPeriod(e.target.value as typeof period)} className={selCls} aria-label="Created">
          <option value="all">Any date</option>
          <option value="1">Last 24 hours</option>
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className={selCls} aria-label="Sort">
          <option value="new">Newest first</option>
          <option value="old">Oldest first</option>
          <option value="bal">Highest balance</option>
          <option value="plHigh">Highest P/L</option>
          <option value="plLow">Lowest P/L</option>
        </select>
        </div>
      </div>

      {cnt("pending") > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-amber-500/25 bg-amber-500/[0.07] px-4 py-3 text-sm">
          <Clock className="h-4 w-4 shrink-0 text-amber-500" />
          <span className="flex-1">
            <span className="font-semibold">{cnt("pending")} account{cnt("pending") === 1 ? "" : "s"} waiting for delivery</span>
            <span className="text-muted-foreground"> · {pendingWithStock} can be auto-delivered from inventory</span>
          </span>
          {pendingWithStock > 0 && <Button size="sm" variant="secondary" onClick={() => { setFilter("pending"); setDelivery("stock"); }}><Zap className="h-3.5 w-3.5" />Show ready</Button>}
          <Button size="sm" variant="ghost" href="/admin/inventory">Inventory</Button>
        </div>
      )}
      {autoNote && <div className="mb-4"><Note tone={autoNote.tone}>{autoNote.text}</Note></div>}

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
                  key: "deliv", label: "Delivery",
                  render: (a) => isPending(a) ? (
                    <div>
                      <p className="text-xs text-amber-500">Waiting {ago(a.createdAt)}</p>
                      <p className="text-[11px] text-muted-foreground">{stockFor(a).length ? `${stockFor(a).length} in inventory` : "No inventory match"}</p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-xs">{a.deliveredAt ? fmtDate(a.deliveredAt, true) : "Delivered"}</p>
                      <p className="text-[11px] text-muted-foreground">Ordered {fmtDate(a.createdAt)}</p>
                    </div>
                  ),
                },
                {
                  key: "act", label: "", className: "text-right",
                  render: (a) => (
                    <div className="flex justify-end gap-2">
                      {a.deliveryStatus !== "pending" && <Button size="sm" variant="ghost" href={`/admin/accounts/${encodeURIComponent(a.id)}`}>View</Button>}
                      {isPending(a) && stockFor(a).length > 0 && (
                        <Button size="sm" variant="secondary" busy={autoBusy === a.id} disabled={!!autoBusy} onClick={() => void autoDeliver(a)} title="Assign the next available inventory account and email the trader">
                          <Zap className="h-3.5 w-3.5" />Auto-deliver
                        </Button>
                      )}
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
