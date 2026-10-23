import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { CheckCircle2, Lock, PlusCircle, RefreshCw, Wallet, TrendingUp, Layers, Banknote, AlertTriangle, Clock, Gift, ArrowRight } from "lucide-react";
import {
  Button, Card, EmptyState, ErrorNote, Loading, Note, PageHeader, StatCard, useAction, useApi, cx,
} from "@/components/portal/ui";
import { PlanBadge, SegmentedBar, Sheet, StatusChip, chipCls } from "@/components/portal/account-ui";
import { CredentialRows } from "@/components/portal/AccountDetail";
import { propApi, type Order, type TradingAccount } from "@/lib/propApi";
import { breachReason, describeAccount, fmtDate, money, num, signed, tone } from "@/lib/portal";

export const Route = createFileRoute("/dashboard/")({ component: AccountsOverview });

type Filter = "all" | "Active" | "Funded" | "Passed" | "Failed";
type OfferTag = { offerId: string; offerName: string; kind: string; label: string };
type Retry = { accountId: string; offer: { id: string; name: string; retriesRemaining: number } | null };

function AccountsOverview() {
  const { data, error, loading, reload } = useApi(async () => {
    const [accounts, orders, retry, payouts, offers] = await Promise.all([
      propApi.accounts.list(),
      propApi.orders.list(),
      propApi.catalog.retryEligibility().catch(() => ({ eligibility: [] as Retry[] })),
      propApi.payouts.list().catch(() => ({ payouts: [] })),
      propApi.catalog.accountOffers().catch(() => ({ offers: [], tags: {} })),
    ]);
    return { accounts: accounts.accounts, orders: orders.orders, retry: retry.eligibility as Retry[], payouts: payouts.payouts, offers: offers.offers as { id: string; name: string; description?: string; summary?: string }[], tags: offers.tags as Record<string, OfferTag[]> };
  });
  const [filter, setFilter] = useState<Filter>("all");
  const paymentSuccess = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("payment") === "success";

  const ordersById = useMemo(() => Object.fromEntries((data?.orders ?? []).map((o) => [o.id, o])), [data]);
  const accounts = useMemo(
    () => [...(data?.accounts ?? [])].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [data],
  );
  const unpaid = (data?.orders ?? []).filter((o) => o.status === "Pending");
  const shown = filter === "all" ? accounts : accounts.filter((a) => a.status === filter);

  const funded = accounts.filter((a) => a.status === "Funded");
  const fundedCapital = funded.reduce((s, a) => s + describeAccount(a, ordersById).size, 0);
  const totalPl = accounts.filter((a) => a.status !== "Failed").reduce((s, a) => s + num(a.totalPl), 0);
  const paidOut = (data?.payouts ?? []).filter((p) => p.status === "paid").reduce((s, p) => s + num(p.profitSplitAmount), 0);
  const count = (s: Filter) => accounts.filter((a) => a.status === s).length;

  return (
    <>
      <PageHeader
        title="Accounts"
        subtitle="Your challenges and funded accounts at a glance."
        actions={
          <>
            <Button variant="ghost" onClick={reload} aria-label="Refresh"><RefreshCw className="h-4 w-4" />Refresh</Button>
            <Button variant="primary" href="/dashboard/new-challenge"><PlusCircle className="h-4 w-4" />Start Challenge</Button>
          </>
        }
      />

      {paymentSuccess && (
        <div className="mb-5"><Note tone="success"><span className="inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4" />Payment received — your account is being prepared.</span></Note></div>
      )}
      {error && <ErrorNote message={error} onRetry={reload} />}

      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard highlight label="Total accounts" value={accounts.length} icon={<Layers className="h-4 w-4" />} sub={`${count("Active")} in evaluation · ${funded.length} funded`} />
        <StatCard label="Funded capital" value={money(fundedCapital, 0)} icon={<Banknote className="h-4 w-4" />} sub="Across all funded accounts" />
        <StatCard label="Open P/L" value={signed(totalPl)} valueClass={tone(totalPl)} icon={<TrendingUp className="h-4 w-4" />} sub="Active & funded accounts" />
        <StatCard label="Total paid out" value={money(paidOut)} icon={<Wallet className="h-4 w-4" />} sub="Your share of approved payouts" />
      </div>

      {!!data?.offers.length && (
        <Link to="/dashboard/offers" className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-primary/30 bg-gradient-to-r from-primary/[0.12] to-transparent px-4 py-3 text-sm transition hover:border-primary/60">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gold text-primary-foreground"><Gift className="h-4 w-4" /></span>
          <span className="min-w-0 flex-1">
            <span className="font-semibold">{data.offers[0]!.name}</span>
            <span className="text-muted-foreground"> · {data.offers[0]!.description || data.offers[0]!.summary}</span>
            {data.offers.length > 1 && <span className="text-muted-foreground"> · +{data.offers.length - 1} more</span>}
          </span>
          <span className="flex items-center gap-1 text-xs font-semibold text-primary">View offers<ArrowRight className="h-3.5 w-3.5" /></span>
        </Link>
      )}

      {unpaid.length > 0 && (
        <div className="mb-6 space-y-2">
          {unpaid.map((o) => (
            <div key={o.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-500/25 bg-amber-500/[0.07] px-4 py-3 text-sm">
              <Clock className="h-4 w-4 text-amber-500" />
              <span className="flex-1">
                <span className="font-semibold">{o.planName || o.planId}</span> · {money(o.amountPaid)} <span className="text-muted-foreground">· awaiting payment since {fmtDate(o.createdAt)}</span>
              </span>
              <Button size="sm" variant="primary" href={`/dashboard/orders?pay=${encodeURIComponent(o.id)}`}>Complete payment</Button>
            </div>
          ))}
        </div>
      )}

      {loading && !data ? (
        <Card><Loading label="Loading your accounts…" /></Card>
      ) : !accounts.length ? (
        <Card>
          <EmptyState
            title="You don’t have any accounts yet"
            body="Pick a challenge, prove your skills and trade our capital with up to 90% profit split."
            action={<Button variant="primary" href="/dashboard/new-challenge">Start Challenge</Button>}
          />
        </Card>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2" role="tablist">
            {([
              ["all", "All", accounts.length],
              ["Active", "Active", count("Active")],
              ["Funded", "Funded", funded.length],
              ["Passed", "Passed", count("Passed")],
              ["Failed", "Breached", count("Failed")],
            ] as [Filter, string, number][]).map(([id, label, n]) => (
              <button key={id} role="tab" aria-selected={filter === id} onClick={() => setFilter(id)} className={cx(chipCls, filter === id && "border-primary/50 bg-primary/10 text-primary")}>
                {label}<span className="text-muted-foreground">{n}</span>
              </button>
            ))}
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {shown.map((a) => (
              <AccountCard key={a.id} account={a} ordersById={ordersById} retry={data?.retry.find((r) => r.accountId === a.id)} tags={data?.tags[a.id] ?? []} onChanged={reload} />
            ))}
            {!shown.length && <Card className="md:col-span-2 xl:col-span-3"><EmptyState title="No accounts in this view" /></Card>}
          </div>
        </>
      )}
    </>
  );
}

function AccountCard({ account: a, ordersById, retry, tags, onChanged }: { account: TradingAccount; ordersById: Record<string, Order>; retry?: Retry | undefined; tags: OfferTag[]; onChanged: () => void }) {
  const info = describeAccount(a, ordersById);
  const [creds, setCreds] = useState(false);
  const { busy, note, run } = useAction();
  const pending = a.deliveryStatus === "pending";
  const hasTarget = info.target > 0;

  return (
    <div className="card-shadow flex flex-col overflow-hidden rounded-2xl border border-border bg-card">
      <div className="account-head flex gap-4 p-4">
        <PlanBadge info={info} />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <Link to="/dashboard/accounts/$id" params={{ id: a.id }} className="truncate font-sans text-base leading-5 font-semibold transition hover:text-primary">
            Login ID : {pending ? "Pending" : a.login || a.id}
          </Link>
          <div className="flex flex-wrap items-center gap-1.5">
            <StatusChip status={a.status} />
            {pending && <span className="inline-flex h-5 items-center rounded-md bg-amber-500/15 px-1.5 text-xs font-medium text-amber-500">Preparing</span>}
            <span className="text-xs text-muted-foreground">{a.platform}</span>
          </div>
          <p className="mt-auto text-xl leading-6 font-semibold tabular-nums">{money(a.balance)}</p>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-4 p-4">
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {tags.map((t) => (
              <span key={t.offerId + t.kind} title={t.offerName} className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2.5 py-0.5 text-[11px] font-semibold text-primary"><Gift className="h-3 w-3" />{t.label}</span>
            ))}
          </div>
        )}

        {pending ? (
          <Note tone="warning">Your trading account is being prepared. Credentials will appear here and in your email shortly.</Note>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2">
              <Metric label="Equity" value={money(a.equity ?? a.balance, 0)} />
              <Metric label="Today" value={signed(a.todayPl, 0)} cls={tone(a.todayPl)} />
              <Metric label="Total P/L" value={signed(info.profit, 0)} cls={tone(info.profit)} />
            </div>
            <div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{hasTarget ? "Profit target" : "Max loss used"}</span>
                <span className="font-medium text-foreground">
                  {hasTarget ? `${money(Math.max(0, info.profit), 0)} / ${money(info.target, 0)}` : `${money(info.maxUsed, 0)} / ${money(info.maxLimit, 0)}`}
                </span>
              </div>
              <SegmentedBar
                className="h-6"
                mode={hasTarget ? "profit" : "loss"}
                ratio={hasTarget ? Math.max(0, info.profit) / info.target : info.maxLimit ? info.maxUsed / info.maxLimit : 0}
              />
            </div>
          </>
        )}

        {a.status === "Failed" && (
          <div className="flex items-start gap-2 rounded-xl border border-loss/25 bg-loss/10 px-3 py-2.5 text-xs text-loss">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{breachReason(a)}
          </div>
        )}

        {(a.status === "Passed" || (a.status === "Failed" && retry?.offer)) && (
          <div className="flex flex-wrap gap-2">
            {a.status === "Passed" && (
              <Button size="sm" variant="success" busy={busy === "next"} onClick={async () => (await run("next", () => propApi.accounts.requestNextStage(a.id), "Next stage requested.")) && onChanged()}>
                {busy === "next" ? "Requesting…" : "Request next stage"}
              </Button>
            )}
            {a.status === "Failed" && retry?.offer && (
              <Button size="sm" variant="secondary" busy={busy === "retry"} onClick={async () => (await run("retry", () => propApi.catalog.claimRetry(a.id), "Free retry claimed — a new account is being prepared.")) && onChanged()}>
                {busy === "retry" ? "Claiming…" : `Free retry (${retry.offer.retriesRemaining} left)`}
              </Button>
            )}
          </div>
        )}

        {note && <Note tone={note.tone}>{note.text}</Note>}

        <div className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-3">
          <span className="truncate text-xs text-muted-foreground">{info.phase}</span>
          <div className="flex shrink-0 items-center gap-3">
            {!pending && (
              <button onClick={() => setCreds(true)} className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition hover:text-foreground"><Lock className="h-3.5 w-3.5" />Login info</button>
            )}
            <Link to="/dashboard/accounts/$id" params={{ id: a.id }} className="inline-flex items-center gap-1 text-sm font-semibold text-primary">View details<ArrowRight className="h-3.5 w-3.5" /></Link>
          </div>
        </div>
      </div>

      <Sheet open={creds} onClose={() => setCreds(false)} title="Login information">
        <CredentialRows account={a} />
      </Sheet>
    </div>
  );
}

function Metric({ label, value, cls = "" }: { label: string; value: string; cls?: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-white/[0.03] px-3 py-2">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className={cx("mt-0.5 truncate text-[13px] font-semibold tabular-nums", cls)}>{value}</p>
    </div>
  );
}
