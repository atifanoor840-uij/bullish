/**
 * Trading statistics feed (ShowMyTrades-compatible) and the read-only rule evaluation
 * shown on the dashboard. Rules are reported, never auto-enforced here: failing an account
 * stays an admin decision (PUT /api/accounts).
 */
import { db, eq } from "./db";
import { env } from "./env";
import { PHASE, limitsFor, modelOf, orderPlan, RULES } from "./core";
import type { DBAccount, DBOrder } from "./types";

const STALE_MS = 30 * 60_000;
const RETRY_MS = 2 * 60_000;

type Trade = { ticket: string; symbol: string; volume: number; open_time: string; close_time: string; profit: number };

/* eslint-disable @typescript-eslint/no-explicit-any -- external feed is untyped */
export function tradesOf(payload: any): Trade[] {
  const raw: any[] = payload?.statistics?.advanced_statistics?.charts?.recent_trades_duration || payload?.trades || [];
  return raw.map((t) => ({
    ticket: String(t.ticket ?? ""), symbol: String(t.symbol ?? ""), volume: Number(t.volume ?? 0),
    open_time: t.open_time, close_time: t.close_time, profit: Number(t.net_profit ?? t.profit ?? 0),
  }));
}

/** Pulls fresh statistics when stale (or forced) and stores balance/equity/P&L on the account. */
export async function refreshStats(acc: DBAccount, force = false): Promise<{ account: DBAccount; error?: string }> {
  const statsId = acc.externalStatisticsId || acc.statisticsApiId;
  if (!statsId || acc.deliveryStatus !== "delivered") return { account: acc };
  const prev = (acc.statisticsPayload ?? {}) as any;
  const lastAttempt = new Date(prev?._statsSync?.lastAttemptAt ?? 0).getTime();
  const lastOk = new Date(acc.statisticsUpdatedAt ?? 0).getTime();
  if (!force && (Date.now() - lastOk < STALE_MS || Date.now() - lastAttempt < RETRY_MS)) return { account: acc };

  const now = new Date().toISOString();
  try {
    const res = await fetch(`${env.statisticsBase.replace(/\/$/, "")}/${encodeURIComponent(statsId)}`, { headers: { Accept: "application/json" } });
    const data: any = await res.json();
    if (!res.ok || data?.success === false || !data?.statistics) throw new Error(data?.error || `Statistics feed returned ${res.status}`);
    const kept = Object.fromEntries(Object.entries(prev).filter(([k]) => k.startsWith("_")));
    const s = data.statistics.account_stats ?? {};
    const balance = Number.isFinite(Number(s.balance)) ? Number(s.balance) : acc.balance;
    const equity = Number.isFinite(Number(s.equity)) ? Number(s.equity) : balance;
    const today = now.slice(0, 10);
    const todayPl = tradesOf(data).filter((t) => t.close_time?.slice(0, 10) === today).reduce((x, t) => x + t.profit, 0) + (equity - balance);
    const patch: Partial<DBAccount> = {
      statisticsPayload: { ...data, ...kept, _statsSync: { lastAttemptAt: now, lastSuccessAt: now } },
      statisticsUpdatedAt: now, balance, equity,
      totalPl: Number.isFinite(Number(s.profit)) ? Number(s.profit) : acc.totalPl,
      todayPl: +todayPl.toFixed(2),
    };
    const [updated] = await db.update<DBAccount>("trading_accounts", { id: eq(acc.id) }, patch);
    return { account: updated ?? { ...acc, ...patch } };
  } catch (e) {
    const payload = { ...prev, _statsSync: { ...(prev?._statsSync ?? {}), lastAttemptAt: now, lastError: String((e as Error).message).slice(0, 200) } };
    await db.update("trading_accounts", { id: eq(acc.id) }, { statisticsPayload: payload }).catch(() => {});
    return { account: { ...acc, statisticsPayload: payload }, error: (e as Error).message };
  }
}

type RuleStatus = "passed" | "pending" | "warning" | "failed";

/** Adds plan size, limits, usage and rule checks used by the dashboard objective cards. */
export async function decorateAccount(acc: DBAccount, order?: DBOrder | null) {
  const plan = order ? await orderPlan(order) : { model: modelOf(""), size: 0, planName: "" };
  const size = plan.size || Math.max(0, acc.balance - acc.totalPl);
  const model = plan.model;
  const limits = limitsFor(model, acc.phase);
  const payload = (acc.statisticsPayload ?? {}) as any;
  const trades = tradesOf(payload);
  const dailyLossLimit = (size * limits.daily) / 100;
  const maxDrawdown = (size * limits.overall) / 100;
  const currentMaxDrawdown = Math.max(0, size - Math.min(acc.balance, acc.equity));
  const currentDailyLoss = Math.max(0, -acc.todayPl);

  const byDay = new Map<string, number>();
  trades.forEach((t) => t.close_time && byDay.set(t.close_time.slice(0, 10), (byDay.get(t.close_time.slice(0, 10)) ?? 0) + t.profit));
  const profitableDays = [...byDay.values()].filter((pl) => pl >= size * 0.005).length;
  const minDays = RULES[model].minDays;
  const shortHolds = trades.filter((t) => new Date(t.close_time).getTime() - new Date(t.open_time).getTime() < 180_000).length;
  const profit = acc.balance - size;

  const failed = acc.status === "Failed";
  const ruleChecks: { id: string; label: string; status: RuleStatus; info: string }[] = [
    {
      id: "daily-drawdown", label: "Daily loss limit",
      status: currentDailyLoss >= dailyLossLimit ? "failed" : currentDailyLoss >= dailyLossLimit * 0.8 ? "warning" : "passed",
      info: `Today's loss $${currentDailyLoss.toFixed(2)} of $${dailyLossLimit.toFixed(2)} allowed`,
    },
    {
      id: "overall-drawdown", label: "Max loss limit",
      status: currentMaxDrawdown >= maxDrawdown ? "failed" : currentMaxDrawdown >= maxDrawdown * 0.8 ? "warning" : "passed",
      info: `Equity must stay above $${(size - maxDrawdown).toFixed(2)}`,
    },
    {
      id: "minimum-holding-time", label: "Minimum holding time", status: shortHolds ? "warning" : "passed",
      info: shortHolds ? `${shortHolds} trade(s) held under 3 minutes` : "All trades held at least 3 minutes",
    },
  ];
  if (acc.phase !== PHASE.FUNDED && acc.profitTarget > 0) {
    ruleChecks.push({
      id: "profit-target", label: "Profit target", status: profit >= acc.profitTarget ? "passed" : "pending",
      info: `$${Math.max(0, profit).toFixed(2)} of $${acc.profitTarget.toFixed(2)}`,
    });
  }
  ruleChecks.push({
    id: "minimum-profitable-trading-days", label: "Minimum trading days", status: profitableDays >= minDays ? "passed" : "pending",
    info: `${profitableDays} of ${minDays} profitable days (≥0.5%)`,
  });

  return {
    ...acc,
    size, planName: plan.planName, dailyLossLimit, maxDrawdown, currentDailyLoss, currentMaxDrawdown,
    ruleChecks: acc.deliveryStatus === "delivered" && !failed ? ruleChecks : [],
    breachReason: failed ? payload.breachReason || payload.ruleBreach?.message || "" : "",
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */
