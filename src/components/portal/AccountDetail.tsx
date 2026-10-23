import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  AlertTriangle, ArrowLeft, ArrowLeftRight, BarChart3, CalendarDays, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Clock,
  Copy, Download, ExternalLink, Eye, EyeOff, Globe, Home, Info, Laptop, Lock, Monitor, RefreshCw, Shield, SlidersHorizontal, Smartphone, Tablet,
} from "lucide-react";
import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button, Card, CopyButton, EmptyState, ErrorNote, Loading, Note, cx, useAction, useApi, usePaged } from "./ui";
import { ScoreGauge } from "./charts";
import { DayPills, PlanBadge, SegmentedBar, Sheet, StatTile, StatusChip, chipCls } from "./account-ui";
import { propApi, type TradingAccount } from "@/lib/propApi";
import {
  breachReason, closedTrades, describeAccount, fmtDate, money, num, pct, signed, tone, tradingDays,
  type AccountInfo, type DayStat, type Trade,
} from "@/lib/portal";

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

const TABS = [
  ["overview", "Overview"],
  ["calendar", "Calendar"],
  ["history", "History"],
  ["platform", "Platform"],
] as const;
type TabId = (typeof TABS)[number][0];

const REFRESH_SECONDS = 300;

/**
 * Account view: breadcrumb → header card (plan badge, login, status) with a tab bar →
 * Overview / Calendar / History / Platform. Reused by the admin CRM with `admin` + `backHref`.
 */
export function AccountDetail({ accountId, backHref = "/dashboard", admin = false }: { accountId: string; backHref?: string; admin?: boolean }) {
  const { data, error, loading, reload } = useApi(async () => {
    const [accounts, orders] = await Promise.all([propApi.accounts.list(), propApi.orders.list()]);
    return { account: accounts.accounts.find((a) => String(a.id) === String(accountId)) || null, orders: orders.orders };
  }, [accountId], admin ? "/admin" : "/login");
  const [tab, setTabState] = useState<TabId>("overview");
  const [creds, setCreds] = useState(false);
  const { busy, note, run } = useAction();

  // Deep-linkable tabs (?tab=history) without touching the route's search schema.
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("tab");
    if (TABS.some(([id]) => id === t)) setTabState(t as TabId);
  }, []);
  const setTab = (t: TabId) => {
    setTabState(t);
    const url = new URL(window.location.href);
    if (t === "overview") url.searchParams.delete("tab");
    else url.searchParams.set("tab", t);
    window.history.replaceState(window.history.state, "", url);
  };

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
  const alerts = (a["ruleAlerts"] as { type?: string; title?: string; message?: string }[] | undefined) ?? [];
  const idLabel = pending ? "Pending" : a.login || a.id;
  const cycle = `Started ${fmtDate(a.createdAt)}${a.statisticsUpdatedAt ? ` · Synced ${fmtDate(a.statisticsUpdatedAt, true)}` : ""}`;

  const actions = (
    <>
      {!admin && a.status === "Passed" && (
        <Button size="sm" variant="primary" busy={busy === "next"} onClick={async () => (await run("next", () => propApi.accounts.requestNextStage(a.id), "Next stage requested.")) && reload()}>Request next stage</Button>
      )}
      {a.graphLink && <a href={a.graphLink} target="_blank" rel="noreferrer" className={outlineAccent}><ExternalLink className="size-4" />Public stats</a>}
      {!pending && <button onClick={() => setCreds(true)} className={outlineAccent}><Lock className="size-4" />Login info</button>}
    </>
  );

  return (
    <div className="flex flex-col">
      {/* Breadcrumb */}
      <nav className="mb-4 hidden items-center gap-1.5 text-sm leading-4 font-medium md:flex" aria-label="Breadcrumb">
        <a href={backHref} aria-label="Accounts home" className="text-muted-foreground/70 hover:text-foreground"><Home className="size-4" /></a>
        <ChevronRight className="size-4 text-white/20" />
        <a href={backHref} className="text-muted-foreground transition hover:text-foreground">Accounts</a>
        <ChevronRight className="size-4 text-white/20" />
        <span className="text-foreground/80">{idLabel}</span>
      </nav>
      <a href={backHref} className="mb-4 inline-flex items-center gap-2 font-sans text-lg leading-[22px] font-semibold md:hidden"><ArrowLeft className="size-5" />Back</a>

      {/* Header card + tab bar */}
      <div className="overflow-hidden rounded-2xl border border-border">
        <div className="account-head flex flex-col px-4 py-4 md:p-6">
          <div className="flex flex-wrap items-end justify-between gap-5">
            <div className="flex items-end gap-4">
              <PlanBadge info={info} />
              <div className="flex min-w-0 flex-col gap-3 md:gap-5">
                <h2 className="font-sans text-base leading-[22px] font-semibold md:text-lg">
                  <span className="md:hidden">ID : {idLabel}</span>
                  <span className="hidden md:inline">Login ID : {idLabel}</span>
                </h2>
                <div className="flex flex-wrap items-center gap-2 md:gap-3">
                  <StatusChip status={a.status} />
                  {pending && <span className="inline-flex h-5 items-center rounded-md bg-amber-500/15 px-1.5 text-xs font-medium text-amber-500">Preparing credentials</span>}
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground"><BarChart3 className="size-3" />{a.platform}</span>
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground"><ArrowLeftRight className="size-3" />{info.phase}</span>
                  {admin && a.userName && <span className="text-xs text-muted-foreground">{a.userName} ({a.userEmail})</span>}
                </div>
                <p className="text-[10px] text-muted-foreground md:hidden">{cycle}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 md:hidden">{actions}</div>
            <div className="hidden flex-col items-end justify-between gap-5 self-stretch md:flex">
              <div className="flex flex-wrap justify-end gap-2">{actions}</div>
              <p className="flex items-center gap-1.5 text-xs leading-[15px] font-medium text-muted-foreground"><Clock className="size-4" />{cycle}</p>
            </div>
          </div>
        </div>
        <div className="no-scrollbar overflow-x-auto border-t border-border bg-card px-6 pt-1.5">
          <div role="tablist" className="flex w-max gap-5 md:gap-3">
            {TABS.map(([id, label]) => (
              <button
                key={id}
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
                className={cx("shrink-0 border-b-2 pt-0.5 pb-1.5 whitespace-nowrap", tab === id ? "border-primary" : "border-transparent")}
              >
                <span className={cx("block rounded-md px-1.5 py-1 text-sm leading-4 font-semibold transition", tab === id ? "text-primary" : "text-muted-foreground hover:text-foreground")}>{label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {(a.status === "Failed" || note || alerts.length > 0) && (
        <div className="mt-4 space-y-2">
          {a.status === "Failed" && (
            <div className="flex items-start gap-2 rounded-xl border border-loss/25 bg-loss/10 px-4 py-3 text-sm text-loss"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{breachReason(a)}</div>
          )}
          {alerts.map((al, i) => (
            <Note key={i} tone={al.type === "error" ? "error" : al.type === "success" ? "success" : "warning"}><strong>{al.title}:</strong> {al.message}</Note>
          ))}
          {note && <Note tone={note.tone}>{note.text}</Note>}
        </div>
      )}

      <div className="mt-4 xl:mt-6">
        {pending && tab !== "platform" ? (
          <Card><EmptyState title="Your account is still being prepared" body="Once credentials are delivered you will see balance, objectives and trading statistics here." /></Card>
        ) : tab === "overview" ? (
          <Overview account={a} info={info} trades={trades} days={days} onRefresh={reload} refreshing={loading} />
        ) : tab === "calendar" ? (
          <CalendarTab days={days} trades={trades} />
        ) : tab === "history" ? (
          <HistoryTab account={a} trades={trades} cycle={cycle} />
        ) : (
          <PlatformTab account={a} onLoginInfo={() => setCreds(true)} />
        )}
      </div>

      <Sheet open={creds} onClose={() => setCreds(false)} title="Login information">
        <CredentialRows account={a} />
      </Sheet>
    </div>
  );
}

const outlineAccent =
  "inline-flex h-[30px] items-center justify-center gap-1 whitespace-nowrap rounded-md border border-border px-3.5 text-sm leading-5 font-semibold text-primary transition hover:bg-white/[0.05]";
const secondaryXs =
  "inline-flex h-[26px] items-center justify-center gap-1 whitespace-nowrap rounded-md border border-border bg-white/[0.04] px-3 text-xs leading-4 font-semibold text-foreground transition hover:bg-white/[0.08] disabled:opacity-50 [&_svg]:size-3.5";
const cardCls = "card-shadow rounded-2xl border border-border bg-card";

/* ====================================================================== Overview */

function Overview({ account: a, info, trades, days, onRefresh, refreshing }: { account: TradingAccount; info: AccountInfo; trades: Trade[]; days: DayStat[]; onRefresh: () => void; refreshing: boolean }) {
  const checks = (a["ruleChecks"] as RuleCheck[] | undefined) ?? [];
  const equity = num(a.equity, num(a.balance));
  const floating = equity - num(a.balance);
  const profitableDays = days.filter((d) => d.pl >= info.size * 0.005).length;

  const tradedTotal = days.reduce((s, d) => s + d.pl, 0);
  const bestDay = Math.max(0, ...days.map((d) => d.pl));
  const consistency = tradedTotal > 0 && bestDay > 0 ? Math.max(0, 100 - (bestDay / tradedTotal) * 100) : 0;
  const consistencyLabel = tradedTotal <= 0 ? "Needs profit" : consistency >= 80 ? "Excellent" : consistency >= 60 ? "Average" : "Low";

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:gap-6">
      <div className="order-1 flex shrink-0 flex-col gap-4 lg:order-2 lg:w-[22.5rem] lg:gap-6">
        <BalanceCard rows={[
          ["Initial balance", money(info.size)],
          ["Equity", money(equity)],
          ["Profit/Loss", <span className={tone(info.profit)}>{signed(info.profit)}</span>],
          ["Floating Profit/Loss", <span className={tone(floating)}>{signed(floating)}</span>],
          ["Today", <span className={tone(a.todayPl)}>{signed(a.todayPl)}</span>],
        ]} balance={money(a.balance)} />

        <div className={cx(cardCls, "p-5")}>
          <p className="text-base leading-5 font-semibold">Consistency Score</p>
          <div className="mt-4"><ScoreGauge value={consistency} label={consistencyLabel} /></div>
          <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-xl bg-white/[0.03] p-3"><p className="text-muted-foreground">Best day</p><p className="mt-1 font-semibold text-profit">{money(bestDay)}</p></div>
            <div className="rounded-xl bg-white/[0.03] p-3"><p className="text-muted-foreground">Total profit</p><p className={cx("mt-1 font-semibold", tone(tradedTotal))}>{signed(tradedTotal)}</p></div>
          </div>
        </div>

        <div className={cx(cardCls, "p-5")}>
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-2 text-base leading-5 font-semibold"><Shield className="size-4 text-muted-foreground" />Rule Checks</p>
            {checks.length > 0 && <span className="text-xs text-muted-foreground">{checks.filter((c) => c.status === "passed").length}/{checks.length} passed</span>}
          </div>
          {checks.length ? (
            <ul className="mt-3 max-h-72 overflow-y-auto pr-1">
              {checks.map((c) => (
                <li key={c.id} className="border-b border-border py-3 last:border-0 last:pb-0" title={c.info}>
                  <div className="flex items-center justify-between gap-2 text-[13px] font-medium">
                    <span>{c.label || c.id}</span>
                    <StatusPill s={toStatus(c.status) ?? "pending"} />
                  </div>
                  {c.info && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{c.info}</p>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-xs text-muted-foreground">Rules are checked once statistics are available.</p>
          )}
        </div>
      </div>

      <div className="order-2 flex min-w-0 flex-1 flex-col gap-4 lg:order-1 lg:gap-6">
        <Objectives info={info} profitableDays={profitableDays} onRefresh={onRefresh} refreshing={refreshing} />
        <StatusChart account={a} info={info} days={days} />
        <StatisticsCard account={a} info={info} trades={trades} />
      </div>
    </div>
  );
}

function BalanceCard({ balance, rows }: { balance: string; rows: [string, ReactNode][] }) {
  const [open, setOpen] = useState(true);
  return (
    <div className={cx(cardCls, "p-4")}>
      <div className="flex flex-col items-center gap-2 rounded-xl bg-primary/10 p-5">
        <p className="text-sm leading-4 font-medium text-muted-foreground">Current balance</p>
        <p className="text-2xl leading-[29px] font-medium tabular-nums">{balance}</p>
        <button onClick={() => setOpen(!open)} className="inline-flex items-center gap-1 text-[13px] font-medium text-primary">
          {open ? "Hide details" : "Show details"}{open ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
        </button>
      </div>
      <div className={cx("grid transition-all duration-300", open ? "grid-rows-[1fr]" : "grid-rows-[0fr] opacity-0")}>
        <ul className="overflow-hidden pt-2">
          {rows.map(([k, v]) => (
            <li key={k} className="flex justify-between border-b border-border py-3 last:border-0 last:pb-0">
              <span className="text-[13px] leading-5 font-medium text-muted-foreground">{k}</span>
              <span className="text-[13px] font-semibold tabular-nums">{v}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Objectives({ info, profitableDays, onRefresh, refreshing }: { info: AccountInfo; profitableDays: number; onRefresh: () => void; refreshing: boolean }) {
  // Auto-refresh every 5 minutes; a manual refresh restarts the countdown.
  const [deadline, setDeadline] = useState(() => Date.now() + REFRESH_SECONDS * 1000);
  const [now, setNow] = useState(() => Date.now());
  const refresh = useRef(onRefresh);
  refresh.current = onRefresh;
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (now < deadline) return;
    refresh.current();
    setDeadline(now + REFRESH_SECONDS * 1000);
  }, [now, deadline]);
  const left = Math.max(0, Math.ceil((deadline - now) / 1000));
  const refreshNow = () => {
    onRefresh();
    setDeadline(Date.now() + REFRESH_SECONDS * 1000);
  };

  const pctOf = (v: number) => (info.size ? +((v / info.size) * 100).toFixed(2) : 0);
  const profitRatio = info.target > 0 ? Math.max(0, info.profit) / info.target : 0;
  const daily = info.dailyLimit ? info.dailyUsed / info.dailyLimit : 0;
  const max = info.maxLimit ? info.maxUsed / info.maxLimit : 0;

  const cells: { label: string; hint: string; value: string; body: ReactNode; foot: ReactNode }[] = [
    {
      label: "Profit target",
      hint: "Closed profit needed to pass this stage.",
      value: info.target > 0 ? `${money(info.target, 0)} (${pctOf(info.target)}%)` : "No target",
      body: (
        <div>
          <div className="relative pt-6">
            <span className="absolute top-0 left-0 rounded-full border border-profit/20 bg-profit/10 px-2 py-0.5 text-xs text-profit">{(profitRatio * 100).toFixed(0)} %</span>
            <SegmentedBar ratio={profitRatio} mode="profit" />
          </div>
          <div className="mt-1 flex justify-between text-xs text-muted-foreground/70"><span>0%</span><span>100%</span></div>
        </div>
      ),
      foot: <>Result: <span className={tone(info.profit)}>{signed(info.profit)}</span></>,
    },
    {
      label: "Min trading days",
      hint: "Days with at least 0.5% profit on the starting balance.",
      value: `${info.minDays} Days`,
      body: <DayPills done={Math.min(profitableDays, info.minDays)} total={info.minDays} />,
      foot: <>Result: {profitableDays} {profitableDays === 1 ? "day" : "days"}</>,
    },
    {
      label: "Daily loss limit",
      hint: "Maximum loss allowed within one trading day.",
      value: `-${money(info.dailyLimit, 0)} (-${pctOf(info.dailyLimit)}%)`,
      body: <LossBar ratio={daily} />,
      foot: <>Remaining: {money(Math.max(0, info.dailyLimit - info.dailyUsed))}</>,
    },
    {
      label: "Max loss limit",
      hint: "Maximum overall drawdown from the starting balance.",
      value: `-${money(info.maxLimit, 0)} (-${pctOf(info.maxLimit)}%)`,
      body: <LossBar ratio={max} />,
      foot: <>Remaining: {money(Math.max(0, info.maxLimit - info.maxUsed))}</>,
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex flex-wrap items-center gap-2 text-[13px] leading-5 font-medium text-muted-foreground">
          Trading Objectives • Refresh in
          <span className="inline-flex min-h-5 items-center gap-1 rounded-md bg-primary/15 px-1.5 py-[3px] text-xs leading-[14px] text-primary tabular-nums">
            <Clock className="size-3" />{Math.floor(left / 60)} Min : {String(left % 60).padStart(2, "0")} Sec
          </span>
        </p>
        <button onClick={refreshNow} disabled={refreshing} className={secondaryXs}><RefreshCw className={cx(refreshing && "animate-spin")} />Refresh</button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 xl:gap-0 xl:overflow-hidden xl:rounded-xl xl:border xl:border-border xl:bg-card">
        {cells.map((c, i) => (
          <div key={c.label} className={cx("flex flex-col gap-4 rounded-xl border border-border bg-card p-4 xl:min-h-[250px] xl:rounded-none xl:border-0", i > 0 && "xl:border-l xl:border-border")}>
            <p className="flex items-center gap-1 text-[13px] leading-5 font-medium text-muted-foreground">
              {c.label}<span title={c.hint}><Info className="size-3.5" /></span>
            </p>
            <p className="text-base leading-5 font-semibold">{c.value}</p>
            <div className="flex flex-col gap-4 xl:mt-auto">
              {c.body}
              <p className="text-[13px] leading-5 font-medium text-foreground/85">{c.foot}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LossBar({ ratio }: { ratio: number }) {
  return (
    <div>
      <SegmentedBar ratio={ratio} mode="loss" />
      <div className="mt-1 flex w-4/5 justify-between text-xs text-muted-foreground/70"><span>0%</span><span>{(Math.min(1, ratio) * 100).toFixed(0)}% used</span></div>
    </div>
  );
}

type Range = "7" | "30" | "all";

function StatusChart({ account: a, info, days }: { account: TradingAccount; info: AccountInfo; days: DayStat[] }) {
  const [range, setRange] = useState<Range>("30");
  const points = useMemo(() => {
    let bal = info.size;
    const all = [{ day: a.createdAt.slice(0, 10), balance: info.size, equity: info.size }];
    for (const d of days) {
      bal += d.pl;
      all.push({ day: d.day, balance: +bal.toFixed(2), equity: +bal.toFixed(2) });
    }
    const last = all[all.length - 1]!;
    last.equity = num(a.equity, last.balance);
    if (range === "all") return all;
    const from = new Date(Date.now() - Number(range) * 864e5).toISOString().slice(0, 10);
    return all.filter((p) => p.day >= from);
  }, [a, info.size, days, range]);

  const lossLevel = info.size - info.maxLimit;
  const targetLevel = info.target > 0 ? info.size + info.target : null;
  const values = points.flatMap((p) => [p.balance, p.equity]).concat(lossLevel, targetLevel ?? info.size);
  const lo = Math.min(...values), hi = Math.max(...values);
  const padY = (hi - lo) * 0.08 || info.size * 0.01 || 1;
  const axisMoney = (v: number) => (Math.abs(v) >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${v.toFixed(0)}`);

  return (
    <div className={cx(cardCls, "p-5")}>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-base leading-5 font-semibold">Account Status</p>
          <p className="mt-1 text-sm text-muted-foreground">Balance and equity against your loss limit and profit target</p>
        </div>
        <select
          value={range}
          onChange={(e) => setRange(e.target.value as Range)}
          aria-label="Range"
          className="rounded-[4px] border border-border bg-white/[0.04] px-3 py-1.5 text-[13px] font-medium text-primary focus:outline-none"
        >
          <option value="7">7 Days</option>
          <option value="30">30 Days</option>
          <option value="all">All</option>
        </select>
      </div>
      <div className="relative h-[300px]">
        {points.length < 2 ? (
          <p className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">No data available</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="acct-balance" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0" stopColor="var(--primary)" stopOpacity={0.2} />
                  <stop offset="1" stopColor="var(--primary)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis dataKey="day" tickFormatter={(d: string) => fmtDate(d).replace(/, \d{4}$/, "")} tick={{ fontSize: 12, fill: "#a1a1aa" }} axisLine={false} tickLine={false} minTickGap={24} />
              <YAxis domain={[lo - padY, hi + padY]} tickFormatter={axisMoney} tick={{ fontSize: 12, fill: "#a1a1aa" }} axisLine={false} tickLine={false} width={56} />
              <Tooltip
                contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: "#a1a1aa" }}
                labelFormatter={(d) => fmtDate(String(d))}
                formatter={(v, name) => [money(v), name === "balance" ? "Balance" : "Equity"]}
              />
              <ReferenceLine y={lossLevel} stroke="var(--loss)" strokeDasharray="5 5" label={{ value: "Max loss", position: "insideBottomRight", fill: "var(--loss)", fontSize: 11 }} />
              {targetLevel !== null && (
                <ReferenceLine y={targetLevel} stroke="var(--profit)" strokeDasharray="5 5" label={{ value: "Profit target", position: "insideTopRight", fill: "var(--profit)", fontSize: 11 }} />
              )}
              <Area type="monotone" dataKey="balance" stroke="var(--primary)" strokeWidth={2} fill="url(#acct-balance)" />
              <Line type="monotone" dataKey="equity" stroke="#a1a1aa" strokeDasharray="4 4" strokeWidth={1.5} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

function StatisticsCard({ account: a, info, trades }: { account: TradingAccount; info: AccountInfo; trades: Trade[] }) {
  const winners = trades.filter((t) => t.profit > 0), losers = trades.filter((t) => t.profit < 0);
  const grossProfit = winners.reduce((s, t) => s + t.profit, 0);
  const grossLoss = losers.reduce((s, t) => s + t.profit, 0);
  const avgGain = winners.length ? grossProfit / winners.length : 0;
  const avgLoss = losers.length ? grossLoss / losers.length : 0;
  const longs = trades.filter((t) => t.type === "BUY");
  const shortsPl = trades.filter((t) => t.type === "SELL").reduce((s, t) => s + t.profit, 0);
  const avgHold = trades.length ? trades.reduce((s, t) => s + (new Date(t.close_time).getTime() - new Date(t.open_time).getTime()), 0) / trades.length / 36e5 : 0;
  const cols: [string, ReactNode][][] = [
    [["Equity", money(num(a.equity, num(a.balance)))], ["Profitability", <span className={tone(info.profit)}>{signed(info.profit)}</span>], ["Average gain", money(avgGain)], ["Average loss", <span className="text-loss">{money(avgLoss)}</span>]],
    [["Lots", trades.reduce((s, t) => s + t.volume, 0).toFixed(2)], ["Average RRR", avgLoss ? (avgGain / Math.abs(avgLoss)).toFixed(2) : "—"], ["Best trade", <span className="text-profit">{money(trades.length ? Math.max(...trades.map((t) => t.profit)) : 0)}</span>], ["Worst trade", <span className="text-loss">{money(trades.length ? Math.min(...trades.map((t) => t.profit)) : 0)}</span>]],
    [["Long won", pct(longs.length ? (longs.filter((t) => t.profit > 0).length / longs.length) * 100 : 0)], ["Short profit", <span className={tone(shortsPl)}>{signed(shortsPl)}</span>], ["Gross profit", money(grossProfit)], ["Avg. hold time", `${avgHold.toFixed(1)}h`]],
  ];
  return (
    <div className={cx(cardCls, "p-5")}>
      <p className="text-base leading-5 font-semibold">Trading Statistics <span className="text-sm font-normal text-muted-foreground">· {trades.length} trades</span></p>
      <div className="mt-3 grid gap-x-8 md:grid-cols-3">
        {cols.map((rows, i) => (
          <ul key={i}>
            {rows.map(([k, v]) => (
              <li key={k} className="flex justify-between border-b border-border py-3">
                <span className="text-[13px] font-medium text-muted-foreground">{k}</span>
                <span className="text-[13px] font-semibold tabular-nums">{v}</span>
              </li>
            ))}
          </ul>
        ))}
      </div>
    </div>
  );
}

/* ====================================================================== Calendar */

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const dayKey = (d: Date) => d.toISOString().slice(0, 10);

function CalendarTab({ days, trades }: { days: DayStat[]; trades: Trade[] }) {
  const latest = days.length ? new Date(days[days.length - 1]!.day) : new Date();
  const [month, setMonth] = useState(() => new Date(Date.UTC(latest.getUTCFullYear(), latest.getUTCMonth(), 1)));
  const [open, setOpen] = useState<string | null>(null);
  const byDay = Object.fromEntries(days.map((d) => [d.day, d]));

  // Monday-first grid covering the whole month.
  const start = new Date(month);
  start.setUTCDate(1 - ((month.getUTCDay() + 6) % 7));
  const last = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0));
  const end = new Date(last);
  end.setUTCDate(last.getUTCDate() + (6 - ((last.getUTCDay() + 6) % 7)));
  const cells: Date[] = [];
  for (let t = start.getTime(); t <= end.getTime(); t += 864e5) cells.push(new Date(t));

  const monthKey = dayKey(month).slice(0, 7);
  const inMonth = days.filter((d) => d.day.startsWith(monthKey));
  const monthPl = inMonth.reduce((s, d) => s + d.pl, 0);
  const shift = (n: number) => setMonth(new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + n, 1)));
  const today = dayKey(new Date());
  const dayTrades = open ? trades.filter((t) => t.close_time && dayKey(new Date(t.close_time)) === open) : [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-sans text-base leading-5 font-semibold">Trading Calendar</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Month: <span className={cx("font-semibold", tone(monthPl))}>{signed(monthPl)}</span> · {inMonth.length} trading days · {inMonth.filter((d) => d.pl > 0).length}W {inMonth.filter((d) => d.pl < 0).length}L
          </p>
        </div>
        <div className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5">
          <button aria-label="Previous month" onClick={() => shift(-1)} className="text-muted-foreground hover:text-foreground"><ChevronLeft className="size-3.5" /></button>
          <span className="w-28 text-center text-xs leading-[14px] font-medium">{month.toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })}</span>
          <button aria-label="Next month" onClick={() => shift(1)} className="text-muted-foreground hover:text-foreground"><ChevronRight className="size-3.5" /></button>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card pt-2 shadow-lg">
        <div className="grid grid-cols-5 px-1 sm:grid-cols-7">
          {WEEKDAYS.map((w, i) => (
            <p key={w} className={cx("p-1 text-center text-sm leading-5 font-medium text-muted-foreground", i > 4 && "hidden sm:block")}>
              <span className="hidden lg:inline">{w}</span><span className="hidden sm:inline lg:hidden">{w.slice(0, 3)}</span><span className="sm:hidden">{w[0]}</span>
            </p>
          ))}
        </div>
        <div className="grid grid-cols-5 gap-px p-2 sm:grid-cols-7 md:gap-2">
          {cells.map((c) => {
            const key = dayKey(c);
            const d = byDay[key];
            const out = c.getUTCMonth() !== month.getUTCMonth();
            const weekend = c.getUTCDay() === 0 || c.getUTCDay() === 6;
            return (
              <button
                key={key}
                disabled={!d}
                onClick={() => setOpen(key)}
                className={cx(
                  "h-[120px] w-full flex-col border-t text-left transition sm:h-[150px] md:rounded-b-[6px]",
                  weekend ? "hidden sm:flex" : "flex",
                  d ? (d.pl >= 0 ? "border-t-profit bg-profit/10 hover:bg-profit/15" : "border-t-loss bg-loss/10 hover:bg-loss/15")
                    : out ? "border-border bg-background" : weekend ? "border-border bg-black/20" : "border-border bg-white/[0.04]",
                )}
              >
                <div className="flex h-full w-full flex-col justify-between px-1.5 py-3 md:pr-3 md:pl-2">
                  <div className="flex items-center justify-between gap-1">
                    <span className={cx("flex h-7 w-7 items-center justify-center rounded-md text-base leading-5 font-medium", out ? "text-muted-foreground/40" : key === today && "bg-white/20")}>
                      {String(c.getUTCDate()).padStart(2, "0")}
                    </span>
                    {weekend && !d && !out && <span className="hidden text-xs font-medium text-muted-foreground md:inline">Weekend</span>}
                  </div>
                  {d && (
                    <div className="min-w-0">
                      <p className={cx("truncate text-sm font-semibold md:text-base", tone(d.pl))}>{signed(d.pl)}</p>
                      <p className="text-xs text-muted-foreground">{d.trades} {d.trades === 1 ? "trade" : "trades"}</p>
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <Sheet open={!!open} onClose={() => setOpen(null)} title={open ? fmtDate(open) : ""}>
        <ul>
          {dayTrades.map((t) => (
            <li key={t.ticket} className="flex items-center justify-between gap-3 border-b border-border py-3 last:border-0">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-[13px] font-semibold">{t.symbol}<TypeChip type={t.type} /></p>
                <p className="text-xs text-muted-foreground">#{t.ticket} · {t.volume.toFixed(2)} lots · {timeOf(t.close_time)}</p>
              </div>
              <span className={cx("text-[13px] font-semibold tabular-nums", tone(t.profit))}>{signed(t.profit)}</span>
            </li>
          ))}
        </ul>
      </Sheet>
    </div>
  );
}

const timeOf = (iso: string) => new Date(iso).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

function TypeChip({ type }: { type: string }) {
  const buy = type === "BUY";
  return <span className={cx("inline-flex h-5 items-center rounded-md px-1.5 text-xs font-medium", buy ? "bg-profit/10 text-profit" : "bg-loss/10 text-loss")}>{buy ? "Buy" : "Sell"}</span>;
}

/* ====================================================================== History */

function HistoryTab({ account: a, trades, cycle }: { account: TradingAccount; trades: Trade[]; cycle: string }) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [symbol, setSymbol] = useState("");
  const [side, setSide] = useState<"" | "BUY" | "SELL">("");
  const [result, setResult] = useState<"" | "win" | "loss">("");

  const symbols = useMemo(() => [...new Set(trades.map((t) => t.symbol))].sort(), [trades]);
  const rows = trades.filter((t) => {
    const day = t.close_time ? dayKey(new Date(t.close_time)) : "";
    return (!from || day >= from) && (!to || day <= to) && (!symbol || t.symbol === symbol) && (!side || t.type === side)
      && (!result || (result === "win" ? t.profit > 0 : t.profit < 0));
  });
  const { slice, page, pages, setPage, total } = usePaged(rows, 15);
  const activeFilters = [symbol, side, result].filter(Boolean).length;

  const winners = rows.filter((t) => t.profit > 0), losers = rows.filter((t) => t.profit < 0);
  const grossProfit = winners.reduce((s, t) => s + t.profit, 0);
  const grossLoss = losers.reduce((s, t) => s + t.profit, 0);
  const avgProfit = winners.length ? grossProfit / winners.length : 0;
  const avgLoss = losers.length ? grossLoss / losers.length : 0;

  const dateInput = "w-[7.5rem] bg-transparent text-xs text-foreground [color-scheme:dark] focus:outline-none";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col justify-between gap-3 pt-3 md:flex-row md:items-center">
        <div>
          <h2 className="font-sans text-base leading-5 font-semibold">Trading History</h2>
          <p className="mt-1 text-sm text-muted-foreground">{cycle}</p>
        </div>
        <div className="relative flex flex-wrap items-center gap-2">
          <label className={chipCls}>
            <CalendarDays />
            <input type="date" value={from} max={to || undefined} onChange={(e) => { setFrom(e.target.value); setPage(1); }} aria-label="Start date" className={dateInput} />
            <span className="text-muted-foreground">-</span>
            <input type="date" value={to} min={from || undefined} onChange={(e) => { setTo(e.target.value); setPage(1); }} aria-label="End date" className={dateInput} />
          </label>
          <button onClick={() => setFiltersOpen(!filtersOpen)} className={cx(chipCls, "w-28 justify-center")}>
            <SlidersHorizontal />Filters{activeFilters > 0 && <span className="rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">{activeFilters}</span>}
          </button>
          {filtersOpen && (
            <div className="absolute top-full right-0 z-20 mt-2 w-64 rounded-xl border border-border bg-card p-4 shadow-2xl">
              <FilterSelect label="Symbol" value={symbol} onChange={(v) => { setSymbol(v); setPage(1); }} options={[["", "All symbols"], ...symbols.map((s) => [s, s] as [string, string])]} />
              <FilterSelect label="Type" value={side} onChange={(v) => { setSide(v as typeof side); setPage(1); }} options={[["", "All"], ["BUY", "Buy"], ["SELL", "Sell"]]} />
              <FilterSelect label="Result" value={result} onChange={(v) => { setResult(v as typeof result); setPage(1); }} options={[["", "All"], ["win", "Win"], ["loss", "Loss"]]} />
              <div className="mt-3 flex justify-between">
                <button className="text-xs text-muted-foreground hover:text-foreground" onClick={() => { setSymbol(""); setSide(""); setResult(""); setFrom(""); setTo(""); setPage(1); }}>Reset</button>
                <button className="text-xs font-semibold text-primary" onClick={() => setFiltersOpen(false)}>Done</button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 sm:mx-0 sm:grid sm:grid-cols-3 sm:px-0 lg:grid-cols-5">
        <StatTile label="Balance" value={money(a.balance)} hint="Current account balance" />
        <StatTile label="Profit Factor" value={grossLoss ? (grossProfit / Math.abs(grossLoss)).toFixed(2) : "—"} hint="Gross profit ÷ gross loss" />
        <StatTile label="Win Rate" value={pct(rows.length ? (winners.length / rows.length) * 100 : 0)} hint="Share of winning trades" />
        <StatTile label="Avg Profit / Avg Loss" value={<><span className="text-profit">{money(avgProfit, 0)}</span><span className="text-muted-foreground"> / </span><span className="text-loss">{money(Math.abs(avgLoss), 0)}</span></>} />
        <StatTile label="Total Trades" value={rows.length} />
      </div>

      {!rows.length ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card px-6 py-12 shadow-lg sm:p-16">
          <span className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary"><BarChart3 className="size-6" /></span>
          <p className="max-w-[450px] text-center text-xs leading-5 text-muted-foreground">
            {trades.length ? "No trades match these filters." : "No trades yet. Place your first trade to get started."}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-lg">
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-left">
              <thead className="bg-white/[0.03]">
                <tr>
                  {["Ticket", "Symbol", "Type", "Lots", "Open Time", "Open Price", "Close Time", "Close Price", "Duration", "Profit"].map((h) => (
                    <th key={h} className="px-4 py-3 text-xs leading-[14px] font-medium whitespace-nowrap text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {slice.map((t) => (
                  <tr key={t.ticket} className="text-[13px] leading-5 font-medium hover:bg-white/[0.02]">
                    <td className="border-t border-border px-4 py-3.5 whitespace-nowrap"><span className="inline-flex items-center gap-1">{t.ticket}<CopyButton value={t.ticket} label="Copy ticket" /></span></td>
                    <td className="border-t border-border px-4 py-3.5">{t.symbol}</td>
                    <td className="border-t border-border px-4 py-3.5"><TypeChip type={t.type} /></td>
                    <td className="border-t border-border px-4 py-3.5 tabular-nums">{t.volume.toFixed(2)}</td>
                    <td className="border-t border-border px-4 py-3.5 whitespace-nowrap text-muted-foreground">{fmtDate(t.open_time, true)}</td>
                    <td className="border-t border-border px-4 py-3.5 tabular-nums">{t.open_price ?? "—"}</td>
                    <td className="border-t border-border px-4 py-3.5 whitespace-nowrap text-muted-foreground">{fmtDate(t.close_time, true)}</td>
                    <td className="border-t border-border px-4 py-3.5 tabular-nums">{t.close_price ?? "—"}</td>
                    <td className="border-t border-border px-4 py-3.5 whitespace-nowrap">{duration(t)}</td>
                    <td className={cx("border-t border-border px-4 py-3.5 font-semibold tabular-nums", tone(t.profit))}>{signed(t.profit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="md:hidden">
            {slice.map((t) => (
              <li key={t.ticket} className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 last:border-0">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-[13px] font-semibold">{t.symbol}<TypeChip type={t.type} /><span className="text-xs font-normal text-muted-foreground">{t.volume.toFixed(2)} lots</span></p>
                  <p className="text-xs text-muted-foreground">#{t.ticket} · {fmtDate(t.close_time, true)}</p>
                </div>
                <span className={cx("text-[13px] font-semibold tabular-nums", tone(t.profit))}>{signed(t.profit)}</span>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between border-t border-border px-4 py-3 text-[13px] text-muted-foreground">
            <span>{total} trades · page {page} of {pages}</span>
            <div className="flex gap-2">
              <button className={chipCls} disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft />Prev</button>
              <button className={chipCls} disabled={page >= pages} onClick={() => setPage(page + 1)}>Next<ChevronRight /></button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <label className="mb-3 block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-lg border border-border bg-white/[0.03] px-3 py-2 text-[13px] focus:border-primary/60 focus:outline-none">
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}

const duration = (t: Trade) => {
  const s = Math.max(0, Math.round((new Date(t.close_time).getTime() - new Date(t.open_time).getTime()) / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
};

/* ====================================================================== Platform */

type Device = "tablet" | "desktop" | "phone";
type Links = { windows: string; mac: string; ios: string; android: string; web: string };
const DOWNLOADS: Record<TradingAccount["platform"], Links> = {
  MT5: {
    windows: "https://download.mql5.com/cdn/web/metaquotes.software.corp/mt5/mt5setup.exe",
    mac: "https://download.mql5.com/cdn/web/metaquotes.software.corp/mt5/MetaTrader5.pkg.zip",
    ios: "https://apps.apple.com/app/metatrader-5/id413251709",
    android: "https://play.google.com/store/apps/details?id=net.metaquotes.metatrader5",
    web: "https://web.metatrader.app/terminal",
  },
  MT4: {
    windows: "https://download.mql5.com/cdn/web/metaquotes.software.corp/mt4/mt4setup.exe",
    mac: "https://www.metatrader4.com/en/download",
    ios: "https://apps.apple.com/app/metatrader-4/id496212596",
    android: "https://play.google.com/store/apps/details?id=net.metaquotes.metatrader4",
    web: "https://web.metatrader.app/terminal",
  },
  cTrader: {
    windows: "https://ctrader.com/download/",
    mac: "https://ctrader.com/download/",
    ios: "https://ctrader.com/download/",
    android: "https://ctrader.com/download/",
    web: "https://app.ctrader.com/",
  },
};

function PlatformTab({ account: a, onLoginInfo }: { account: TradingAccount; onLoginInfo: () => void }) {
  const [device, setDevice] = useState<Device>("desktop");
  const links = DOWNLOADS[a.platform] ?? DOWNLOADS.MT5;
  const app = a.platform === "cTrader" ? "cTrader" : `MetaTrader ${a.platform.slice(2)}`;
  const desktop = device === "desktop";
  const steps: [string, string][] = [
    ["Download platform", `Install ${app} for your ${device} using the links on this page.`],
    ["Open & navigate", desktop ? "Launch the app and open File → Login to Trade Account." : "Open the app, go to Settings and tap New Account → Login to an existing account."],
    ["Add your account", "Enter your Login ID and master password from Login info. Use the investor password for read-only access."],
    ["Select the correct server", a.server ? `Search for and select the server “${a.server}”.` : "Select the server shown in Login info."],
    ["Verify & start trading", "Once connected your balance appears in the terminal. Trades sync to this dashboard automatically."],
  ];
  const deviceBtn = (id: Device, label: string, Icon: typeof Monitor) => (
    <button
      key={id}
      onClick={() => setDevice(id)}
      className={cx(
        "inline-flex items-center gap-1.5 rounded-[4px] border px-2.5 py-1.5 text-xs leading-[14px] font-medium transition [&_svg]:size-4",
        device === id ? "border-primary/60 bg-white/[0.02] text-foreground shadow-[inset_0_0_30px_0_rgba(229,169,60,0.25)]" : "border-border bg-card text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon />{label}
    </button>
  );
  const dlBtn = "flex w-full items-center justify-center gap-2 rounded-md bg-primary/10 px-4 py-3 text-sm font-medium text-primary transition hover:bg-primary/20";
  const panel = "rounded-[10px] bg-card shadow-[0_2px_10px_0_rgba(0,0,0,0.30)] border border-border";

  return (
    <div className="flex flex-col gap-4">
      <div className="inline-flex flex-wrap gap-1.5">
        {deviceBtn("tablet", "Tablet", Tablet)}
        {deviceBtn("desktop", "Desktop", Laptop)}
        {deviceBtn("phone", "Phone", Smartphone)}
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-6">
        <div className={cx(panel, "flex flex-1 flex-col gap-6 p-6 md:flex-row")}>
          <div className="flex flex-1 flex-col gap-7">
            <h2 className="font-sans text-base font-semibold">Step-by-Step Login Guide</h2>
            {steps.map(([title, body], i) => (
              <div key={title} className="flex gap-3">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-border bg-white/[0.03] text-xs font-bold">{i + 1}</span>
                <div>
                  <p className="text-xs leading-[15px] font-bold tracking-wide">{title}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{body}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-5 md:w-[260px]">
            <div className="rounded-xl bg-primary/10 p-4">
              <p className="text-xs font-semibold text-foreground/85">Your account</p>
              <dl className="mt-2 space-y-1.5 text-xs">
                <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Platform</dt><dd className="font-semibold">{a.platform}</dd></div>
                <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Login</dt><dd className="font-semibold">{a.login || "Pending"}</dd></div>
                <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Server</dt><dd className="truncate font-semibold">{a.server || "—"}</dd></div>
              </dl>
              {a.deliveryStatus !== "pending" && <button onClick={onLoginInfo} className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary"><Lock className="size-3.5" />Show passwords</button>}
            </div>
            <div className="flex flex-col gap-2.5">
              <p className="text-xs font-semibold text-foreground/85">Download {app}</p>
              {desktop ? (
                <>
                  <a href={links.windows} target="_blank" rel="noreferrer" className={dlBtn}><Download className="size-4" />Download for Windows</a>
                  <a href={links.mac} target="_blank" rel="noreferrer" className={dlBtn}><Download className="size-4" />Download for MacOS</a>
                </>
              ) : (
                <>
                  <a href={links.ios} target="_blank" rel="noreferrer" className={dlBtn}><Download className="size-4" />App Store</a>
                  <a href={links.android} target="_blank" rel="noreferrer" className={dlBtn}><Download className="size-4" />Google Play</a>
                </>
              )}
            </div>
          </div>
        </div>

        <div className={cx(panel, "overflow-hidden p-6 lg:w-[420px]")}>
          <h2 className="font-sans text-base font-semibold">Trade from your browser</h2>
          <p className="mt-2 text-sm text-muted-foreground">No install needed — open the web terminal and log in with the same credentials and server.</p>
          <a href={links.web} target="_blank" rel="noreferrer" className="mt-4 inline-flex h-[30px] items-center gap-1.5 rounded-md border border-border bg-white/[0.04] px-4 text-sm font-medium transition hover:bg-white/[0.08]"><Globe className="size-4" />Web Terminal</a>
          <div className="mt-6 flex aspect-[5/3] translate-y-10 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 md:translate-x-8 md:translate-y-8">
            <TerminalMock />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Decorative candle chart for the web-terminal card. */
function TerminalMock() {
  const candles = [40, 52, 46, 60, 55, 68, 62, 74, 70, 82, 76, 88];
  return (
    <svg viewBox="0 0 240 120" className="h-3/4 w-4/5" aria-hidden>
      {candles.map((v, i) => {
        const prev = candles[i - 1] ?? v - 6;
        const up = v >= prev;
        const top = 120 - Math.max(v, prev), bottom = 120 - Math.min(v, prev);
        return (
          <g key={i}>
            <line x1={10 + i * 19} x2={10 + i * 19} y1={top - 8} y2={bottom + 8} className={up ? "stroke-profit" : "stroke-loss"} strokeWidth={1.5} />
            <rect x={4 + i * 19} y={top} width={12} height={Math.max(3, bottom - top)} rx={1.5} className={up ? "fill-profit" : "fill-loss"} />
          </g>
        );
      })}
    </svg>
  );
}

/* ====================================================================== Login info */

export function CredentialRows({ account: a }: { account: TradingAccount }) {
  const [show, setShow] = useState<Record<string, boolean>>({});
  const rows: [string, string, boolean][] = [
    ["Login", a.login, false],
    ["Password", a.passwordMaster, true],
    ["Investor password", a.passwordInvestor, true],
    ["Server", a.server, false],
    ["Platform", a.platform, false],
  ];
  return (
    <div>
      <p className="mb-2 text-sm text-muted-foreground">Use these details to log in to {a.platform}. Keep your master password private.</p>
      <ul>
        {rows.map(([k, v, secret]) => (
          <li key={k} className="flex items-center justify-between gap-3 border-b border-border py-3 last:border-0">
            <span className="text-[13px] text-muted-foreground">{k}</span>
            <span className="flex min-w-0 items-center gap-1 text-[13px] font-semibold">
              <span className="truncate font-mono">{!v ? "—" : secret && !show[k] ? "••••••••" : v}</span>
              {secret && v && (
                <button aria-label={show[k] ? `Hide ${k}` : `Show ${k}`} onClick={() => setShow({ ...show, [k]: !show[k] })} className="rounded p-1 text-muted-foreground hover:text-foreground">
                  {show[k] ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                </button>
              )}
              {v && <CopyButton value={v} label={`Copy ${k}`} />}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-4 flex items-start gap-2 rounded-lg bg-primary/10 p-3 text-xs text-primary"><Copy className="mt-0.5 size-3.5 shrink-0" />Credentials were also sent to your email when the account was delivered.</p>
    </div>
  );
}
