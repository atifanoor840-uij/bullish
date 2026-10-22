import { useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle, ArrowLeft, BarChart3, CalendarDays, ChevronLeft, ChevronRight, ExternalLink, Eye, EyeOff, Gauge,
  List, RefreshCw, Shield, Target, TrendingDown, TrendingUp, Wallet, CalendarCheck,
} from "lucide-react";
import { Badge, Button, Card, CardHeader, CopyButton, EmptyState, ErrorNote, Loading, Note, Pager, cx, useAction, useApi, usePaged } from "./ui";
import { ScoreGauge, SignedBars, Sparkline, TrendChart } from "./charts";
import { propApi } from "@/lib/propApi";
import { breachReason, closedTrades, compactMoney, describeAccount, fmtDate, money, num, pct, signed, sizeLabel, tone, tradingDays } from "@/lib/portal";

type Status = "passed" | "pending" | "warning" | "failed";
const STATUS: Record<Status, { label: string; cls: string; dot: string }> = {
  passed: { label: "Passed", cls: "bg-profit/15 text-profit", dot: "bg-profit" },
  pending: { label: "In progress", cls: "bg-primary/15 text-primary", dot: "bg-primary" },
  warning: { label: "Warning", cls: "bg-amber-500/15 text-amber-500", dot: "bg-amber-500" },
  failed: { label: "Breached", cls: "bg-loss/15 text-loss", dot: "bg-loss" },
};
function StatusPill({ s }: { s: Status }) {
  const c = STATUS[s];
  return <span className={cx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold", c.cls)}><span className={cx("h-1.5 w-1.5 rounded-full", c.dot)} />{c.label}</span>;
}
const toStatus = (v?: string): Status | undefined =>
  v === "passed" || v === "pending" || v === "warning" || v === "failed" ? v : v === "breached" ? "failed" : undefined;

type RuleCheck = { id: string; label?: string; status?: string; info?: string };

/**
 * Account cockpit: identity → money → objectives → trend & health → statistics → trades.
 * Reused by the admin CRM with `admin` + `backHref`.
 */
export function AccountDetail({ accountId, backHref = "/dashboard", admin = false }: { accountId: string; backHref?: string; admin?: boolean }) {
  const { data, error, loading, reload } = useApi(async () => {
    const [accounts, orders] = await Promise.all([propApi.accounts.list(), propApi.orders.list()]);
    return { account: accounts.accounts.find((a) => String(a.id) === String(accountId)) || null, orders: orders.orders };
  }, [accountId], admin ? "/admin" : "/login");
  const [creds, setCreds] = useState(false);
  const [view, setView] = useState<"cumulative" | "daily">("cumulative");
  const [tab, setTab] = useState<"history" | "calendar">("history");
  const { busy, note, run } = useAction();

  const account = data?.account;
  const ordersById = useMemo(() => Object.fromEntries((data?.orders ?? []).map((o) => [o.id, o])), [data]);
  const trades = useMemo(() => (account ? closedTrades(account) : []), [account]);
  const days = useMemo(() => tradingDays(trades), [trades]);

  if (loading && !data) return <Card><Loading label="Loading account…" /></Card>;
  if (error) return <ErrorNote message={error} onRetry={reload} />;
  if (!account) {
    return (
      <Card>
        <EmptyState title="Account not found" body="It may have been removed, or it belongs to another user." action={<Button href={backHref}>Back to accounts</Button>} />
      </Card>
    );
  }

  const a = account;
  const info = describeAccount(a, ordersById);
  const pending = a.deliveryStatus === "pending";
  const checks = (a["ruleChecks"] as RuleCheck[] | undefined) ?? [];
  const alerts = (a["ruleAlerts"] as { type?: string; title?: string; message?: string }[] | undefined) ?? [];
  const checkStatus = (id: string) => toStatus(checks.find((c) => c.id === id)?.status);
  const equity = num(a.equity, num(a.balance));
  const floating = Math.min(0, equity - num(a.balance));

  // Statistics
  const winners = trades.filter((t) => t.profit > 0), losers = trades.filter((t) => t.profit < 0);
  const grossProfit = winners.reduce((s, t) => s + t.profit, 0);
  const grossLoss = losers.reduce((s, t) => s + t.profit, 0);
  const avgGain = winners.length ? grossProfit / winners.length : 0;
  const avgLoss = losers.length ? grossLoss / losers.length : 0;
  const winRate = trades.length ? (winners.length / trades.length) * 100 : 0;
  const lots = trades.reduce((s, t) => s + t.volume, 0);
  const best = trades.length ? Math.max(...trades.map((t) => t.profit)) : 0;
  const worst = trades.length ? Math.min(...trades.map((t) => t.profit)) : 0;
  const longs = trades.filter((t) => t.type === "BUY");
  const shortsPl = trades.filter((t) => t.type === "SELL").reduce((s, t) => s + t.profit, 0);
  const avgHold = trades.length ? trades.reduce((s, t) => s + (new Date(t.close_time).getTime() - new Date(t.open_time).getTime()), 0) / trades.length / 36e5 : 0;

  const tradedTotal = days.reduce((s, d) => s + d.pl, 0);
  const winDays = days.filter((d) => d.pl > 0).length, lossDays = days.filter((d) => d.pl < 0).length;
  const bestDay = Math.max(0, ...days.map((d) => d.pl));
  const consistency = tradedTotal > 0 && bestDay > 0 ? Math.max(0, 100 - (bestDay / tradedTotal) * 100) : 0;
  const consistencyLabel = tradedTotal <= 0 ? "Needs profit" : consistency >= 80 ? "Excellent" : consistency >= 60 ? "Average" : "Low";
  const profitableDays = days.filter((d) => d.pl >= info.size * 0.005).length;

  let running = 0;
  const cumulative = days.map((d) => ({ label: fmtDate(d.day), value: (running += d.pl), detail: `${signed(d.pl)} that day · ${d.won}W ${d.lost}L` }));
  const daily = days.map((d) => ({ label: fmtDate(d.day), value: d.pl, detail: `${d.trades} trades · ${d.won}W ${d.lost}L` }));

  const objectives: { icon: ReactNode; title: string; status: Status; rows: [string, ReactNode][] }[] = [
    {
      icon: <TrendingDown className="h-4 w-4" />, title: "Daily Loss Limit",
      status: checkStatus("daily-drawdown") ?? (info.dailyUsed >= info.dailyLimit ? "failed" : "passed"),
      rows: [["Max loss limit", money(info.dailyLimit)], ["Daily loss till now", <span className={info.dailyUsed > 0 ? "text-loss" : ""}>{money(info.dailyUsed)}</span>], ["Today's permitted loss", money(Math.max(0, info.dailyLimit - info.dailyUsed))]],
    },
    {
      icon: <AlertTriangle className="h-4 w-4" />, title: "Overall Loss Limit",
      status: checkStatus("overall-drawdown") ?? (info.maxUsed >= info.maxLimit ? "failed" : "passed"),
      rows: [["Max loss limit", money(info.maxLimit)], ["Loss till now", <span className={info.maxUsed > 0 ? "text-loss" : ""}>{money(info.maxUsed)}</span>], ["Max permitted loss", money(Math.max(0, info.maxLimit - info.maxUsed))]],
    },
    {
      icon: <CalendarCheck className="h-4 w-4" />, title: "Minimum Trading Days",
      status: checkStatus("minimum-profitable-trading-days") ?? (profitableDays >= info.minDays ? "passed" : "pending"),
      rows: [["Minimum", `${info.minDays} days`], ["Current result", `${profitableDays} days`]],
    },
    {
      icon: <Target className="h-4 w-4" />, title: "Profit Target",
      status: checkStatus("profit-target") ?? (info.target <= 0 || info.profit >= info.target ? "passed" : "pending"),
      rows: [["Minimum", info.target > 0 ? money(info.target) : "No target on this stage"], ["Current result", <span className={tone(info.profit)}>{money(info.profit)}</span>]],
    },
  ];

  return (
    <div className="space-y-5">
      {/* 1 — Header */}
      <Card className="p-5">
        <a href={backHref} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition hover:text-foreground"><ArrowLeft className="h-3.5 w-3.5" />Back to accounts</a>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-2xl font-semibold">{info.model} · {sizeLabel(info.size)}</h1>
              <Badge>{a.status}</Badge>
              {pending && <Badge tone="warning">Preparing credentials</Badge>}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {info.phase} · {a.platform}{!pending && ` · #${a.login} · ${a.server}`}
              {admin && a.userName && ` · ${a.userName} (${a.userEmail})`}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {a.statisticsUpdatedAt ? `Synced ${fmtDate(a.statisticsUpdatedAt, true)} · updates every 30 minutes` : "Statistics appear once the account is connected to the statistics feed."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {!pending && <Button size="sm" onClick={() => setCreds(!creds)}>{creds ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}Credentials</Button>}
            {a.graphLink && <Button size="sm" href={a.graphLink}><ExternalLink className="h-3.5 w-3.5" />Public stats</Button>}
            {!admin && a.status === "Passed" && (
              <Button size="sm" variant="primary" busy={busy === "next"} onClick={async () => (await run("next", () => propApi.accounts.requestNextStage(a.id), "Next stage requested.")) && reload()}>Request next stage</Button>
            )}
            <Button size="sm" variant="ghost" onClick={reload} aria-label="Refresh"><RefreshCw className="h-3.5 w-3.5" />Refresh</Button>
          </div>
        </div>
        {creds && !pending && (
          <div className="mt-4 grid gap-3 rounded-xl bg-background p-4 sm:grid-cols-2 lg:grid-cols-4">
            {[["Server", a.server], ["Login", a.login], ["Password", a.passwordMaster], ["Investor password", a.passwordInvestor]].map(([k, v]) => (
              <div key={k} className="min-w-0">
                <p className="text-[11px] text-muted-foreground">{k}</p>
                <p className="mt-0.5 flex items-center gap-1 font-mono text-sm break-all">{v || "—"}{v && <CopyButton value={v} />}</p>
              </div>
            ))}
          </div>
        )}
        {a.status === "Failed" && (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-loss/25 bg-loss/10 px-4 py-3 text-sm text-loss"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{breachReason(a)}</div>
        )}
        {note && <div className="mt-4"><Note tone={note.tone}>{note.text}</Note></div>}
      </Card>

      {pending ? (
        <Card><EmptyState title="Your account is still being prepared" body="Once credentials are delivered you will see balance, objectives and trading statistics here." /></Card>
      ) : (
        <>
          {/* 2 — Headline cards */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <TopCard highlight icon={<Wallet className="h-4 w-4" />} title="Balance" value={money(a.balance)} chip={pct((info.profit / (info.size || 1)) * 100, 2)} chipTone={info.profit} />
            <TopCard icon={<TrendingUp className="h-4 w-4" />} title="Profit / Loss" value={signed(info.profit)} valueCls={tone(info.profit)} chip={pct((info.profit / (info.size || 1)) * 100, 2)} chipTone={info.profit} />
            <TopCard icon={<TrendingDown className="h-4 w-4" />} title="Floating loss" value={money(Math.abs(floating))} valueCls={floating < 0 ? "text-loss" : ""} chip={pct((floating / (num(a.balance) || 1)) * 100, 2)} chipTone={floating} />
            <TopCard icon={<BarChart3 className="h-4 w-4" />} title="Total trades" value={String(trades.length)} sub={`${days.length} trading days · ${winRate.toFixed(0)}% win`} />
          </div>

          {/* 3 — Objectives */}
          <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
            {objectives.map((o) => (
              <Card key={o.title} className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="flex items-center gap-2 text-sm font-semibold"><span className="text-muted-foreground">{o.icon}</span>{o.title}</p>
                  <StatusPill s={o.status} />
                </div>
                <div className="mt-3 space-y-2">
                  {o.rows.map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between rounded-xl border border-white/[0.05] bg-background/40 px-3 py-2.5 text-xs">
                      <span className="text-muted-foreground">{k}</span>
                      <span className="font-semibold tabular-nums">{v}</span>
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>

          {/* 4 — Trend + health */}
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
            <Card className="min-w-0 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="flex items-center gap-2 text-sm font-semibold"><BarChart3 className="h-4 w-4 text-muted-foreground" />P&L Trend</p>
                  <p className={cx("mt-2 font-display text-2xl font-semibold", tone(tradedTotal))}>{compactMoney(tradedTotal)}</p>
                  <p className="text-xs text-muted-foreground">{winDays}W · {lossDays}L · {days.length ? ((winDays / days.length) * 100).toFixed(0) : 0}% winning days</p>
                </div>
                <Segment value={view} onChange={setView} options={[["cumulative", "Cumulative"], ["daily", "Daily"]]} />
              </div>
              <div className="mt-4">
                {days.length < 2 ? (
                  <p className="py-20 text-center text-sm text-muted-foreground">Your P&L trend appears after your first closed trades.</p>
                ) : view === "cumulative" ? (
                  <TrendChart points={cumulative} format={signed} />
                ) : (
                  <SignedBars bars={daily} format={signed} />
                )}
              </div>
            </Card>

            <div className="space-y-4">
              <Card className="p-5">
                <p className="flex items-center gap-2 text-sm font-semibold"><Gauge className="h-4 w-4 text-muted-foreground" />Consistency Score</p>
                <div className="mt-4"><ScoreGauge value={consistency} label={consistencyLabel} /></div>
                <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-xl bg-background/50 p-3"><p className="text-muted-foreground">Best day</p><p className="mt-1 font-semibold text-profit">{money(bestDay)}</p></div>
                  <div className="rounded-xl bg-background/50 p-3"><p className="text-muted-foreground">Total profit</p><p className={cx("mt-1 font-semibold", tone(tradedTotal))}>{signed(tradedTotal)}</p></div>
                </div>
              </Card>
              <Card className="p-5">
                <div className="flex items-center justify-between">
                  <p className="flex items-center gap-2 text-sm font-semibold"><Shield className="h-4 w-4 text-muted-foreground" />Rule Checks</p>
                  {checks.length > 0 && <span className="text-xs text-muted-foreground">{checks.filter((c) => c.status === "passed").length}/{checks.length} passed</span>}
                </div>
                {checks.length ? (
                  <div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
                    {checks.map((c) => (
                      <div key={c.id} className="rounded-xl border border-white/[0.05] bg-background/40 px-3 py-2.5" title={c.info}>
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span className="font-medium">{c.label || c.id}</span>
                          <StatusPill s={toStatus(c.status) ?? "pending"} />
                        </div>
                        {c.info && <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">{c.info}</p>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-muted-foreground">Rules are checked once statistics are available.</p>
                )}
              </Card>
            </div>
          </div>

          {/* 5 — Alerts */}
          {alerts.map((al, i) => (
            <Note key={i} tone={al.type === "error" ? "error" : al.type === "success" ? "success" : "warning"}>
              <strong>{al.title}:</strong> {al.message}
            </Note>
          ))}

          {/* 6 — Trading statistics */}
          <div>
            <p className="mb-3 flex items-center gap-2 text-sm font-semibold"><Gauge className="h-4 w-4 text-muted-foreground" />Trading Statistics <span className="font-normal text-muted-foreground">· {trades.length} trades</span></p>
            <div className="grid gap-4 lg:grid-cols-3">
              <StatColumn highlight rows={[["Equity", money(equity)], ["Balance", money(a.balance)], ["Profitability", <span className={tone(info.profit)}>{signed(info.profit)}</span>], ["Average gain", money(avgGain)], ["Average loss", <span className="text-loss">{money(avgLoss)}</span>], ["Trades", trades.length]]} />
              <StatColumn rows={[["Lots", lots.toFixed(2)], ["Average RRR", avgLoss ? (avgGain / Math.abs(avgLoss)).toFixed(2) : "—"], ["Win rate", pct(winRate)], ["Loss rate", pct(trades.length ? (losers.length / trades.length) * 100 : 0)], ["Profit factor", grossLoss ? (grossProfit / Math.abs(grossLoss)).toFixed(2) : "—"], ["Best trade", <span className="text-profit">{money(best)}</span>]]} />
              <StatColumn rows={[["Worst trade", <span className="text-loss">{money(worst)}</span>], ["Long won", pct(longs.length ? (longs.filter((t) => t.profit > 0).length / longs.length) * 100 : 0)], ["Short profit", <span className={tone(shortsPl)}>{signed(shortsPl)}</span>], ["Gross profit", money(grossProfit)], ["Gross loss", <span className="text-loss">{money(grossLoss)}</span>], ["Avg. hold time", `${avgHold.toFixed(1)}h`]]} />
            </div>
          </div>

          {/* 7 — Workspace */}
          <Card>
            <div className="flex flex-wrap gap-2 border-b border-white/[0.06] p-3">
              {([["history", "Trading History", <List key="l" className="h-4 w-4" />], ["calendar", "Daily P&L Calendar", <CalendarDays key="c" className="h-4 w-4" />]] as const).map(([id, label, icon]) => (
                <button
                  key={id}
                  role="tab"
                  aria-selected={tab === id}
                  onClick={() => setTab(id)}
                  className={cx("inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition", tab === id ? "bg-gold text-primary-foreground shadow-gold" : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground")}
                >
                  {icon}{label}
                </button>
              ))}
            </div>
            {!trades.length ? (
              <EmptyState title="No trades yet" body="Closed trades will appear here once the statistics feed syncs." />
            ) : tab === "history" ? (
              <TradeHistory trades={trades} cumulative={cumulative.map((c) => c.value)} winRate={winRate} />
            ) : (
              <PlCalendar days={days} />
            )}
          </Card>
        </>
      )}
    </div>
  );
}

function TopCard({ icon, title, value, valueCls = "", chip, chipTone = 0, sub, highlight = false }: { icon: ReactNode; title: string; value: string; valueCls?: string; chip?: string; chipTone?: number; sub?: string; highlight?: boolean }) {
  return (
    <Card highlight={highlight} className="relative overflow-hidden p-5">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <span className={cx("flex h-8 w-8 items-center justify-center rounded-full", highlight ? "bg-primary text-primary-foreground" : "bg-white/[0.05] text-muted-foreground")}>{icon}</span>
        {title}
      </p>
      <p className={cx("mt-4 truncate font-display text-[1.7rem] leading-tight font-semibold tabular-nums", valueCls)}>{value}</p>
      {chip && (
        <span className={cx("mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold", chipTone > 0 ? "bg-profit/15 text-profit" : chipTone < 0 ? "bg-loss/15 text-loss" : "bg-white/[0.06] text-muted-foreground")}>
          {chipTone >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}{chip}
        </span>
      )}
      {sub && <p className="mt-2 text-xs text-muted-foreground">{sub}</p>}
    </Card>
  );
}

function StatColumn({ rows, highlight = false }: { rows: [string, ReactNode][]; highlight?: boolean }) {
  return (
    <Card highlight={highlight} className="px-5 py-2">
      {rows.map(([k, v], i) => (
        <div key={k} className={cx("flex items-center justify-between py-3 text-sm", i > 0 && "border-t border-white/[0.06]")}>
          <span className="text-muted-foreground">{k}</span>
          <span className="font-semibold tabular-nums">{v}</span>
        </div>
      ))}
    </Card>
  );
}

function Segment<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: [T, string][] }) {
  return (
    <div role="tablist" className="flex rounded-lg border border-white/[0.08] bg-background p-0.5">
      {options.map(([id, label]) => (
        <button key={id} role="tab" aria-selected={value === id} onClick={() => onChange(id)} className={cx("rounded-md px-3 py-1 text-xs font-medium transition", value === id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
          {label}
        </button>
      ))}
    </div>
  );
}

const duration = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
};

function SymbolBadge({ symbol }: { symbol: string }) {
  const s = symbol.toUpperCase();
  const [txt, cls] = s.startsWith("XAU") ? ["Au", "bg-amber-500/20 text-amber-400"]
    : s.startsWith("BTC") ? ["₿", "bg-orange-500/20 text-orange-400"]
    : /NAS|US30|SPX|DAX|GER/.test(s) ? ["IX", "bg-sky-500/20 text-sky-400"]
    : [s.slice(0, 2), "bg-primary/15 text-primary"];
  return <span className={cx("flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold", cls)}>{txt}</span>;
}

function TradeHistory({ trades, cumulative, winRate }: { trades: ReturnType<typeof closedTrades>; cumulative: number[]; winRate: number }) {
  const [query, setQuery] = useState("");
  const rows = trades.filter((t) => !query || t.symbol.toLowerCase().includes(query.toLowerCase()) || t.ticket.includes(query));
  const { slice, ...pager } = usePaged(rows, 15);
  const total = trades.reduce((s, t) => s + t.profit, 0);
  return (
    <>
      <div className="grid gap-4 p-5 lg:grid-cols-[minmax(0,1fr)_auto]">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3 rounded-2xl bg-background/50 px-5 py-4 text-sm">
          <div><p className="text-[11px] text-muted-foreground">Profit / Loss</p><p className={cx("font-semibold", tone(total))}>{signed(total)}</p></div>
          <div><p className="text-[11px] text-muted-foreground">Win rate</p><p className="font-semibold">{pct(winRate)}</p></div>
          <div><p className="text-[11px] text-muted-foreground">Trades</p><p className="font-semibold">{trades.length}</p></div>
          <div className="ml-auto"><Sparkline values={cumulative} /></div>
        </div>
        <input value={query} onChange={(e) => { setQuery(e.target.value); pager.setPage(1); }} placeholder="Search ticket or symbol…" className="h-fit rounded-lg border border-white/10 bg-background px-3.5 py-2.5 text-sm focus:border-primary/60 focus:outline-none lg:w-64" />
      </div>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[46rem] text-left text-sm">
          <thead>
            <tr className="border-y border-white/[0.06] text-[11px] tracking-wider text-muted-foreground uppercase">
              {["Symbol", "Opened", "Closed", "Duration", "Lots", "Profit / Loss"].map((h) => <th key={h} className="px-5 py-3 font-medium">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {slice.map((t) => {
              const ms = new Date(t.close_time).getTime() - new Date(t.open_time).getTime();
              return (
                <tr key={t.ticket} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2.5">
                      <SymbolBadge symbol={t.symbol} />
                      <div>
                        <p className="flex items-center gap-2 font-semibold">{t.symbol}<span className={cx("rounded px-1.5 text-[10px] font-bold", t.type === "BUY" ? "bg-profit/15 text-profit" : "bg-loss/15 text-loss")}>{t.type}</span></p>
                        <p className="flex items-center gap-1 text-[11px] text-muted-foreground">#{t.ticket}<CopyButton value={t.ticket} label="Copy ticket" /></p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-xs text-muted-foreground">{fmtDate(t.open_time, true)}</td>
                  <td className="px-5 py-3 text-xs text-muted-foreground">{fmtDate(t.close_time, true)}</td>
                  <td className={cx("px-5 py-3 text-xs", ms < 180000 && "text-amber-500")} title={ms < 180000 ? "Trades must be held at least 3 minutes" : undefined}>{duration(ms)}</td>
                  <td className="px-5 py-3 tabular-nums">{t.volume.toFixed(2)}</td>
                  <td className="px-5 py-3"><span className={cx("rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums", t.profit >= 0 ? "bg-profit/10 text-profit" : "bg-loss/10 text-loss")}>{signed(t.profit)}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="space-y-2 px-3 pb-3 md:hidden">
        {slice.map((t) => (
          <div key={t.ticket} className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-background/40 p-3">
            <SymbolBadge symbol={t.symbol} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{t.symbol} <span className={cx("text-[10px]", t.type === "BUY" ? "text-profit" : "text-loss")}>{t.type}</span> <span className="text-xs font-normal text-muted-foreground">{t.volume.toFixed(2)} lots</span></p>
              <p className="text-[11px] text-muted-foreground">{fmtDate(t.close_time, true)}</p>
            </div>
            <span className={cx("text-sm font-semibold tabular-nums", tone(t.profit))}>{signed(t.profit)}</span>
          </div>
        ))}
      </div>
      <Pager {...pager} />
    </>
  );
}

function PlCalendar({ days }: { days: ReturnType<typeof tradingDays> }) {
  const latest = days.length ? new Date(days[days.length - 1]!.day) : new Date();
  const [month, setMonth] = useState(new Date(Date.UTC(latest.getUTCFullYear(), latest.getUTCMonth(), 1)));
  const byDay = Object.fromEntries(days.map((d) => [d.day, d]));
  const first = new Date(month);
  const start = new Date(first);
  start.setUTCDate(1 - first.getUTCDay());
  const cells = Array.from({ length: 42 }, (_, i) => new Date(start.getTime() + i * 864e5));
  const inMonth = days.filter((d) => d.day.startsWith(month.toISOString().slice(0, 7)));
  const monthPl = inMonth.reduce((s, d) => s + d.pl, 0);
  const shift = (n: number) => setMonth(new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + n, 1)));
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div className="p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm">
          Month: <span className={cx("font-semibold", tone(monthPl))}>{signed(monthPl)}</span>
          <span className="text-muted-foreground"> · {inMonth.length} trading days · {inMonth.filter((d) => d.pl > 0).length}W {inMonth.filter((d) => d.pl < 0).length}L</span>
        </p>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" aria-label="Previous month" onClick={() => shift(-1)}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="w-32 text-center text-sm font-semibold">{month.toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })}</span>
          <Button size="sm" variant="ghost" aria-label="Next month" onClick={() => shift(1)}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <div className="grid min-w-[42rem] grid-cols-7 gap-1.5">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => <p key={d} className="pb-1 text-center text-[11px] text-muted-foreground">{d}</p>)}
          {cells.map((c) => {
            const key = c.toISOString().slice(0, 10);
            const d = byDay[key];
            const out = c.getUTCMonth() !== month.getUTCMonth();
            return (
              <div
                key={key}
                className={cx(
                  "relative flex h-20 flex-col items-center justify-center rounded-xl border text-xs",
                  out && "opacity-40",
                  d ? (d.pl >= 0 ? "border-white/[0.06] border-l-[3px] border-l-profit bg-profit/[0.07]" : "border-white/[0.06] border-l-[3px] border-l-loss bg-loss/[0.07]") : "border-white/[0.04] bg-background/30",
                )}
              >
                <span className={cx("absolute top-1.5 left-2 text-[10px]", key === today ? "flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground" : "text-muted-foreground")}>{c.getUTCDate()}</span>
                {d ? (
                  <>
                    <span className={cx("font-semibold", tone(d.pl))}>{compactMoney(d.pl)}</span>
                    <span className="mt-0.5 text-[10px] text-muted-foreground">{d.won}W {d.lost}L</span>
                  </>
                ) : (
                  <span className="h-1 w-1 rounded-full bg-white/10" />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
