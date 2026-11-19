import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Activity, BadgeCheck, BarChart3, Clock, CreditCard, ExternalLink, Eye, Pencil, SlidersHorizontal, Trash2, Trophy, X, XCircle, Zap } from "lucide-react";
import { Badge, Button, Card, DataTable, EmptyState, ErrorNote, Field, Loading, Modal, Note, PageHeader, Pager, RefreshButton, SearchInput, StatCard, Tabs, cx, inputCls, useAction, useApi, usePaged } from "@/components/portal/ui";
import { usePortal } from "@/components/portal/context";
import { AccountDetail } from "@/components/portal/AccountDetail";
import { EditAccount } from "@/components/portal/admin/EditAccount";
import { propApi, type InventoryItem, type Order, type TradingAccount } from "@/lib/propApi";
import { describeAccount, fmtDate, money, signed, sizeLabel, tone } from "@/lib/portal";

export const Route = createFileRoute("/admin/orders")({ component: AdminOrders });

const STATUSES = ["Pending", "Paid", "Active", "Step2 Active", "Live Active", "Passed", "Failed", "Replaced", "Payment Failed"];
const DAY = 86_400_000;
const selCls = cx(inputCls, "h-9 py-1 text-xs");

type F = "all" | "payment" | "deliver" | "live" | "Funded" | "Passed" | "Failed";
type Sort = "new" | "old" | "amt" | "bal" | "plHigh" | "plLow";

/** One order together with every trading account it created (latest first). */
type Row = { key: string; order: Order | null; accounts: TradingAccount[]; acc: TradingAccount | undefined; info: ReturnType<typeof describeAccount> | undefined; created: number };

const isPending = (a: TradingAccount) => a.deliveryStatus === "pending";
const ago = (iso: string) => {
  const m = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60_000));
  return m < 60 ? `${m}m` : m < 1440 ? `${Math.floor(m / 60)}h` : `${Math.floor(m / 1440)}d`;
};
const matchesTab = (r: Row, f: F) => {
  const a = r.acc;
  switch (f) {
    case "all": return true;
    case "payment": return r.order?.status === "Pending";
    case "deliver": return r.accounts.some(isPending);
    case "live": return !!a && !isPending(a) && (a.status === "Active" || a.status === "Funded");
    default: return !!a && !isPending(a) && a.status === f;
  }
};

function AdminOrders() {
  const { refreshUnread } = usePortal();
  const { data, error, loading, reload } = useApi(async () => {
    const [o, a, inv] = await Promise.all([propApi.orders.list(), propApi.accounts.list(), propApi.admin.inventory().catch(() => ({ plans: [] as InventoryItem[] }))]);
    return { orders: o.orders, accounts: a.accounts, inventory: inv.plans };
  }, [], "/admin");

  const [filter, setFilter] = useState<F>("all");
  const [q, setQ] = useState("");
  const [model, setModel] = useState("all");
  const [size, setSize] = useState("all");
  const [platform, setPlatform] = useState("all");
  const [result, setResult] = useState<"all" | "profit" | "loss">("all");
  const [period, setPeriod] = useState<"all" | "1" | "7" | "30" | "90">("all");
  const [sort, setSort] = useState<Sort>("new");
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [delOrder, setDelOrder] = useState<Order | null>(null);
  const [editAcc, setEditAcc] = useState<TradingAccount | null>(null);
  const [autoBusy, setAutoBusy] = useState("");
  const [autoNote, setAutoNote] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const ordersById = useMemo(() => Object.fromEntries((data?.orders ?? []).map((o) => [o.id, o])), [data]);
  const changed = () => { void reload(); refreshUnread(); };

  const rows = useMemo<Row[]>(() => {
    const byOrder = new Map<string, TradingAccount[]>();
    for (const a of data?.accounts ?? []) {
      const k = a.orderId && ordersById[a.orderId] ? a.orderId : `acc:${a.id}`;
      byOrder.set(k, [...(byOrder.get(k) ?? []), a]);
    }
    const mk = (key: string, order: Order | null, accs: TradingAccount[]): Row => {
      const accounts = [...accs].sort((x, y) => new Date(y.createdAt).getTime() - new Date(x.createdAt).getTime());
      const acc = accounts[0];
      return { key, order, accounts, acc, info: acc ? describeAccount(acc, ordersById) : undefined, created: new Date(order?.createdAt ?? acc?.createdAt ?? 0).getTime() };
    };
    const out = (data?.orders ?? []).map((o) => mk(o.id, o, byOrder.get(o.id) ?? []));
    for (const [k, accs] of byOrder) if (k.startsWith("acc:")) out.push(mk(k, null, accs));
    return out;
  }, [data, ordersById]);

  const opts = useMemo(() => ({
    models: [...new Set(rows.map((r) => r.info?.model).filter(Boolean) as string[])].sort(),
    sizes: [...new Set(rows.map((r) => r.info?.size ?? 0).filter((s) => s > 0))].sort((x, y) => x - y),
    platforms: [...new Set(rows.map((r) => r.acc?.platform).filter(Boolean) as string[])].sort(),
  }), [rows]);

  const stockFor = (a: TradingAccount) => {
    const s = describeAccount(a, ordersById).size;
    return (data?.inventory ?? []).filter((i) => i.status === "available" && i.platform === a.platform && Number(i.size) === s);
  };

  const since = period === "all" ? 0 : Date.now() - Number(period) * DAY;
  const ql = q.trim().toLowerCase();
  const shown = rows
    .filter((r) =>
      matchesTab(r, filter) &&
      (model === "all" || r.info?.model === model) &&
      (size === "all" || String(r.info?.size) === size) &&
      (platform === "all" || r.acc?.platform === platform) &&
      (result === "all" || (!!r.acc && (result === "profit" ? r.acc.totalPl > 0 : r.acc.totalPl < 0))) &&
      (!since || r.created >= since) &&
      (!ql || [r.order?.id, r.order?.userName, r.order?.userEmail, r.order?.planName, ...r.accounts.flatMap((a) => [a.login, a.id, a.userName, a.userEmail])].some((v) => v?.toLowerCase().includes(ql))),
    )
    .sort((x, y) => {
      switch (sort) {
        case "old": return x.created - y.created;
        case "amt": return (Number(y.order?.amountPaid) || 0) - (Number(x.order?.amountPaid) || 0);
        case "bal": return (y.acc?.balance ?? 0) - (x.acc?.balance ?? 0);
        case "plHigh": return (y.acc?.totalPl ?? 0) - (x.acc?.totalPl ?? 0);
        case "plLow": return (x.acc?.totalPl ?? 0) - (y.acc?.totalPl ?? 0);
        default: return y.created - x.created;
      }
    });
  const { slice, ...pager } = usePaged(shown);
  const cnt = (f: F) => rows.filter((r) => matchesTab(r, f)).length;
  const extraFilters = [model, size, platform, result, period].filter((v) => v !== "all").length;
  const clear = () => { setModel("all"); setSize("all"); setPlatform("all"); setResult("all"); setPeriod("all"); setSort("new"); setQ(""); };
  const open = openKey ? rows.find((r) => r.key === openKey) ?? null : null;
  const revenue = (data?.orders ?? []).filter((o) => !/pending|fail/i.test(o.status)).reduce((s, o) => s + (Number(o.amountPaid) || 0), 0);

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
      changed();
    } catch (e) {
      setAutoNote({ tone: "error", text: e instanceof Error ? e.message : "Auto-delivery failed." });
    } finally {
      setAutoBusy("");
    }
  }

  const stat = (f: F, label: string, icon: ReactNode, sub: string, valueClass = "") => (
    <button onClick={() => setFilter(f)} className={cx("rounded-2xl text-left transition", filter === f ? "ring-2 ring-primary/60" : "hover:opacity-90")}>
      <StatCard label={label} value={cnt(f)} icon={icon} sub={sub} valueClass={valueClass} highlight={filter === f} />
    </button>
  );

  return (
    <>
      <PageHeader
        title="Orders & Accounts"
        subtitle="Confirm payments, deliver credentials, edit accounts and watch their graphs — all in one place."
        actions={<RefreshButton onClick={() => void reload()} busy={loading} />}
      />
      {error && <ErrorNote message={error} onRetry={reload} />}

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-6">
        {stat("payment", "Awaiting payment", <CreditCard className="h-4 w-4" />, "Orders not yet paid", "text-amber-500")}
        {stat("deliver", "To deliver", <Clock className="h-4 w-4" />, "Waiting for credentials", "text-amber-500")}
        {stat("live", "Active accounts", <Activity className="h-4 w-4" />, "Evaluation + funded", "text-profit")}
        {stat("Funded", "Funded", <BadgeCheck className="h-4 w-4" />, "Live funded accounts")}
        {stat("Passed", "Passed", <Trophy className="h-4 w-4" />, "Moved to next stage")}
        {stat("Failed", "Failed", <XCircle className="h-4 w-4" />, "Breached accounts", "text-loss")}
      </div>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <Tabs<F> value={filter} onChange={setFilter} tabs={[
          { id: "all", label: "All", count: rows.length },
          { id: "payment", label: "Awaiting payment", count: cnt("payment") },
          { id: "deliver", label: "To deliver", count: cnt("deliver") },
          { id: "live", label: "Active", count: cnt("live") },
          { id: "Funded", label: "Funded", count: cnt("Funded") },
          { id: "Passed", label: "Passed", count: cnt("Passed") },
          { id: "Failed", label: "Failed", count: cnt("Failed") },
        ]} />
        <SearchInput value={q} onChange={setQ} placeholder="Search order, trader, login, plan…" />
      </div>

      <div className="mb-4 rounded-xl border border-white/[0.06] bg-card p-3">
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
          <SlidersHorizontal className="h-3.5 w-3.5" />Filters
          <span className="ml-auto font-normal">{shown.length} result{shown.length === 1 ? "" : "s"} · {money(revenue)} paid revenue</span>
          {(extraFilters > 0 || q || sort !== "new") && <Button size="sm" variant="ghost" onClick={clear}><X className="h-3.5 w-3.5" />Clear</Button>}
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
          <select value={model} onChange={(e) => setModel(e.target.value)} className={selCls} aria-label="Model">
            <option value="all">All models</option>
            {opts.models.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <select value={size} onChange={(e) => setSize(e.target.value)} className={selCls} aria-label="Size">
            <option value="all">All sizes</option>
            {opts.sizes.map((s) => <option key={s} value={String(s)}>{sizeLabel(s)}</option>)}
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
            <option value="amt">Highest amount</option>
            <option value="bal">Highest balance</option>
            <option value="plHigh">Highest P/L</option>
            <option value="plLow">Lowest P/L</option>
          </select>
        </div>
      </div>

      {autoNote && <div className="mb-4"><Note tone={autoNote.tone}>{autoNote.text}</Note></div>}

      <Card>
        {loading && !data ? <Loading /> : (
          <>
            <DataTable
              rows={slice}
              rowKey={(r) => r.key}
              mobileTitle={(r) => `${r.order?.id ?? "No order"} · ${r.order?.planName ?? r.info?.model ?? ""}`}
              columns={[
                { key: "id", label: "Order", render: (r) => <div><p className="font-mono text-xs">{r.order?.id ?? "—"}</p><p className="text-[11px] text-muted-foreground">{fmtDate(new Date(r.created).toISOString(), true)}</p></div> },
                { key: "user", label: "Trader", render: (r) => <div><p className="font-medium">{r.order?.userName || r.acc?.userName || r.order?.userId || r.acc?.userId}</p><p className="text-xs text-muted-foreground">{r.order?.userEmail || r.acc?.userEmail}</p></div> },
                { key: "plan", label: "Plan", render: (r) => <div><p>{r.order?.planName || r.order?.planId || (r.info ? `${r.info.model} · ${sizeLabel(r.info.size)}` : "—")}</p><p className="text-[11px] text-muted-foreground">{money(r.order?.amountPaid ?? 0)} · {r.order?.paymentMethod ?? "—"}</p></div> },
                { key: "acc", label: "Account", render: (r) => r.acc ? (
                    <div>
                      <p className="font-mono text-xs">{isPending(r.acc) ? <span className="text-amber-500">Pending delivery · {ago(r.acc.createdAt)}</span> : `#${r.acc.login}`}</p>
                      <p className="text-[11px] text-muted-foreground">{r.acc.platform} · {r.info?.phase}{r.accounts.length > 1 ? ` · ${r.accounts.length} accounts` : ""}</p>
                    </div>
                  ) : <span className="text-xs text-muted-foreground">No account yet</span> },
                { key: "bal", label: "Balance / P/L", render: (r) => r.acc && !isPending(r.acc) ? <div className="tabular-nums"><p>{money(r.acc.balance)}</p><p className={`text-xs ${tone(r.acc.totalPl)}`}>{signed(r.acc.totalPl)}</p></div> : <span className="text-xs text-muted-foreground">—</span> },
                { key: "status", label: "Status", render: (r) => (
                    <div className="flex flex-wrap gap-1">
                      {r.order && <Badge>{r.order.status}</Badge>}
                      {r.acc && !isPending(r.acc) && r.acc.status !== r.order?.status && <Badge tone="neutral">{r.acc.status}</Badge>}
                      {r.accounts.some(isPending) && <Badge tone="warning">To deliver</Badge>}
                      {r.order?.legacyRules && <Badge tone="neutral">Legacy</Badge>}
                    </div>
                  ) },
                { key: "act", label: "", className: "text-right", render: (r) => {
                    const pend = r.accounts.find(isPending);
                    return (
                      <div className="flex justify-end gap-2">
                        {pend && stockFor(pend).length > 0 && (
                          <Button size="sm" variant="secondary" busy={autoBusy === pend.id} disabled={!!autoBusy} onClick={() => void autoDeliver(pend)} title="Assign the next available inventory account and email the trader">
                            <Zap className="h-3.5 w-3.5" />Auto-deliver
                          </Button>
                        )}
                        {pend && <Button size="sm" variant="primary" onClick={() => setEditAcc(pend)}>Deliver</Button>}
                        <Button size="sm" variant={pend ? "secondary" : "primary"} onClick={() => setOpenKey(r.key)}>Manage</Button>
                        {r.order && <Button size="sm" variant="danger" onClick={() => setDelOrder(r.order)} aria-label={`Delete order ${r.order.id}`}><Trash2 className="h-3.5 w-3.5" /></Button>}
                      </div>
                    );
                  } },
              ]}
            />
            <Pager {...pager} />
          </>
        )}
      </Card>

      {open && data && (
        <OrderPanel
          row={open}
          ordersById={ordersById}
          stockFor={stockFor}
          autoBusy={autoBusy}
          onAutoDeliver={(a) => void autoDeliver(a)}
          onEditAccount={setEditAcc}
          onClose={() => setOpenKey(null)}
          onChanged={changed}
        />
      )}
      {editAcc && data && (
        <EditAccount account={editAcc} ordersById={ordersById} inventory={data.inventory} onClose={() => setEditAcc(null)} onChanged={changed} />
      )}
      {delOrder && <DeleteOrderDialog order={delOrder} onClose={() => setDelOrder(null)} onDeleted={() => { setOpenKey(null); changed(); }} />}
    </>
  );
}

/** Full-height side panel: order controls, its accounts, and the selected account's graph. */
function OrderPanel({ row, ordersById, stockFor, autoBusy, onAutoDeliver, onEditAccount, onClose, onChanged }: {
  row: Row; ordersById: Record<string, Order>; stockFor: (a: TradingAccount) => InventoryItem[]; autoBusy: string;
  onAutoDeliver: (a: TradingAccount) => void; onEditAccount: (a: TradingAccount) => void; onClose: () => void; onChanged: () => void;
}) {
  const delivered = row.accounts.filter((a) => !isPending(a));
  const [graphId, setGraphId] = useState<string | null>(delivered[0]?.id ?? null);
  useEffect(() => {
    if (graphId && !delivered.some((a) => a.id === graphId)) setGraphId(delivered[0]?.id ?? null);
  }, [delivered, graphId]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !document.querySelector('[role="dialog"][aria-modal="true"]') && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const title = row.order ? `Order ${row.order.id}` : `Account #${row.acc?.login || row.acc?.id}`;
  return (
    <div className="fixed inset-0 z-[60] flex justify-end bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <aside aria-label={title} onClick={(e) => e.stopPropagation()} className="flex h-full w-full max-w-6xl flex-col border-l border-white/10 bg-background shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-4">
          <div className="min-w-0">
            <h3 className="truncate font-semibold">{title}</h3>
            <p className="truncate text-xs text-muted-foreground">{row.order?.userName || row.acc?.userName} · {row.order?.userEmail || row.acc?.userEmail}</p>
          </div>
          <button aria-label="Close" onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:bg-white/[0.06] hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>
        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
            {row.order ? <OrderControls order={row.order} onChanged={onChanged} onDeleted={onClose} /> : <Card className="p-5 text-sm text-muted-foreground">This account has no matching order.</Card>}
            <Card className="p-5">
              <h4 className="mb-3 text-sm font-semibold">Accounts <span className="font-normal text-muted-foreground">({row.accounts.length})</span></h4>
              {row.accounts.length === 0 ? (
                <p className="text-sm text-muted-foreground">No trading account yet — set the order status to <strong>Active</strong> to create Phase 1.</p>
              ) : (
                <div className="space-y-2.5">
                  {row.accounts.map((a) => {
                    const info = describeAccount(a, ordersById);
                    const pend = isPending(a);
                    const stock = pend ? stockFor(a).length : 0;
                    return (
                      <div key={a.id} className={cx("rounded-xl border p-3 text-sm", graphId === a.id ? "border-primary/50 bg-primary/[0.04]" : "border-white/[0.06]")}>
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-mono text-xs">{pend ? "Pending delivery" : `#${a.login}`} <span className="text-muted-foreground">· {a.platform}{a.server ? ` · ${a.server}` : ""}</span></p>
                            <p className="text-[11px] text-muted-foreground">{info.model} {sizeLabel(info.size)} · {info.phase} · {pend ? `waiting ${ago(a.createdAt)} · ${stock ? `${stock} in inventory` : "no inventory match"}` : a.deliveredAt ? `delivered ${fmtDate(a.deliveredAt, true)}` : "delivered"}</p>
                          </div>
                          <div className="flex flex-wrap gap-1"><Badge>{a.status}</Badge>{pend && <Badge tone="warning">To deliver</Badge>}</div>
                        </div>
                        {!pend && (
                          <p className="mt-2 text-xs tabular-nums">Balance {money(a.balance)} · Equity {money(a.equity ?? a.balance)} · P/L <span className={tone(a.totalPl)}>{signed(a.totalPl)}</span></p>
                        )}
                        <div className="mt-2.5 flex flex-wrap gap-2">
                          {pend && stock > 0 && <Button size="sm" variant="secondary" busy={autoBusy === a.id} disabled={!!autoBusy} onClick={() => onAutoDeliver(a)}><Zap className="h-3.5 w-3.5" />Auto-deliver</Button>}
                          <Button size="sm" variant={pend ? "primary" : "secondary"} onClick={() => onEditAccount(a)}>{pend ? "Deliver" : <><Pencil className="h-3.5 w-3.5" />Edit</>}</Button>
                          {!pend && <Button size="sm" variant={graphId === a.id ? "primary" : "ghost"} onClick={() => setGraphId(a.id)}><BarChart3 className="h-3.5 w-3.5" />Graph</Button>}
                          {!pend && <Button size="sm" variant="ghost" href={`/admin/accounts/${encodeURIComponent(a.id)}`}><ExternalLink className="h-3.5 w-3.5" />Full page</Button>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>

          <div>
            {graphId ? (
              <AccountDetail key={graphId} accountId={graphId} admin backHref="/admin/orders" />
            ) : (
              <Card><EmptyState title="No graph yet" body="Charts and stats show here once an account is delivered." /></Card>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}

function OrderControls({ order, onChanged, onDeleted }: { order: Order; onChanged: () => void; onDeleted: () => void }) {
  const [status, setStatus] = useState(order.status);
  const [proof, setProof] = useState<{ url: string; walletId: string; txid: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { busy, note, run } = useAction();
  const manual = order.gatewayRef?.startsWith("manual:");
  useEffect(() => setStatus(order.status), [order.status]);

  return (
    <Card className="space-y-4 p-5">
      <h4 className="text-sm font-semibold">Order</h4>
      <dl className="grid gap-3 rounded-xl bg-background p-4 text-sm sm:grid-cols-2">
        {[["Plan", order.planName || order.planId], ["Amount", money(order.amountPaid)], ["Payment", order.paymentMethod], ["Coupon", order.couponUsed || "—"], ["Gateway ref", order.gatewayRef || "—"], ["Created", fmtDate(order.createdAt, true)]].map(([k, v]) => (
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
            <Button size="sm" variant="danger" busy={busy === "del"} onClick={async () => { if (await run("del", () => propApi.orders.remove(order.id))) { onChanged(); onDeleted(); } }}>Yes, delete</Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>Cancel</Button>
          </div>
        ) : (
          <Button size="sm" variant="danger" onClick={() => setConfirmDelete(true)}><Trash2 className="h-3.5 w-3.5" />Delete order</Button>
        )}
      </div>
    </Card>
  );
}

function DeleteOrderDialog({ order, onClose, onDeleted }: { order: Order; onClose: () => void; onDeleted: () => void }) {
  const { busy, note, run } = useAction();
  return (
    <Modal
      open
      onClose={onClose}
      title={`Delete order ${order.id}?`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="danger" busy={busy === "del"} onClick={async () => { if (await run("del", () => propApi.orders.remove(order.id))) { onDeleted(); onClose(); } }}>
            <Trash2 className="h-4 w-4" />Yes, delete order
          </Button>
        </>
      }
    >
      <div className="space-y-3 text-sm">
        <p className="text-muted-foreground">This will permanently delete order <strong className="font-mono text-foreground">{order.id}</strong> ({order.planName || order.planId}) and all trading accounts associated with it.</p>
        {note && <Note tone={note.tone}>{note.text}</Note>}
      </div>
    </Modal>
  );
}
