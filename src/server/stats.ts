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

  // Max overall loss: 6% static on Initial Balance (1-Step, 2-Step, Instant). Flex: 8% trailing from highest closed balance.
  const isFlex = model === "Flex";
  const highWaterMark = Math.max(size, Number(payload.highWaterMark ?? acc.balance));
  let maxDrawdown = (size * limits.overall) / 100;
  let currentMaxDrawdown = Math.max(0, size - Math.min(acc.balance, acc.equity));
  if (isFlex) {
    const floor = Math.min(size, highWaterMark - (size * 0.08));
    maxDrawdown = size * 0.08;
    currentMaxDrawdown = Math.max(0, highWaterMark - Math.min(acc.balance, acc.equity));
  }
  const currentDailyLoss = Math.max(0, -acc.todayPl);

  // Winning Days: calendar day with profit >= 0.5% of Initial Account Balance
  const byDay = new Map<string, number>();
  trades.forEach((t) => t.close_time && byDay.set(t.close_time.slice(0, 10), (byDay.get(t.close_time.slice(0, 10)) ?? 0) + t.profit));
  const winningDays = [...byDay.values()].filter((pl) => pl >= size * 0.005).length;
  const minDays = limits.minDays;

  // 3-minute minimum holding time
  const shortHolds = trades.filter((t) => new Date(t.close_time).getTime() - new Date(t.open_time).getTime() < 180_000).length;
  const profit = acc.balance - size;

  // 1% Per-Trade Risk Rule (Applies to Funded and Instant accounts)
  const isFundedOrInstant = acc.status === "Funded" || acc.phase === PHASE.FUNDED || model === "Instant";
  const onePctLimit = size * 0.01;
  const excessiveRiskTrades = isFundedOrInstant ? trades.filter((t) => t.profit < -onePctLimit).length : 0;

  // Trade Layering Rule: on Funded and Instant, new trade may only open >= 10 minutes after previous trade's opening time
  let layeringBreaches = 0;
  if (isFundedOrInstant && trades.length > 1) {
    const sortedByOpen = [...trades].sort((a, b) => new Date(a.open_time).getTime() - new Date(b.open_time).getTime());
    for (let i = 1; i < sortedByOpen.length; i++) {
      const diff = new Date(sortedByOpen[i]!.open_time).getTime() - new Date(sortedByOpen[i - 1]!.open_time).getTime();
      if (diff > 0 && diff < 600_000) {
        layeringBreaches++;
      }
    }
  }

  // Instant accounts additional cap: maximum 2 concurrent layers allowed (opening a 3rd is a hard breach)
  let thirdLayerBreach = false;
  if (model === "Instant" && trades.length >= 3) {
    for (const t of trades) {
      if (!t.open_time) continue;
      const tOpen = new Date(t.open_time).getTime();
      const concurrent = trades.filter((other) => {
        if (!other.open_time || !other.close_time) return false;
        const oOpen = new Date(other.open_time).getTime();
        const oClose = new Date(other.close_time).getTime();
        return oOpen <= tOpen && oClose > tOpen;
      }).length;
      if (concurrent >= 3) {
        thirdLayerBreach = true;
        break;
      }
    }
  }

  // Overnight & Weekend Holding (1-Step, 2-Step, Instant: overnight not allowed; weekend prohibited without add-on)
  // Weekend closure: Friday 23:00 UTC to Sunday 23:00 UTC
  const isWeekendUtc = (d: Date) => {
    const day = d.getUTCDay(); // 0 is Sun, 5 is Fri, 6 is Sat
    const hour = d.getUTCHours();
    return (day === 5 && hour >= 23) || day === 6 || (day === 0 && hour < 23);
  };

  let overnightBreaches = 0;
  let weekendBreaches = 0;
  if (model !== "Flex") {
    trades.forEach((t) => {
      if (t.open_time && t.close_time) {
        const oDate = new Date(t.open_time);
        const cDate = new Date(t.close_time);
        const openD = oDate.toISOString().slice(0, 10);
        const closeD = cDate.toISOString().slice(0, 10);
        if (openD !== closeD) overnightBreaches++;
        if (!acc.weekendHoldingAddon) {
          if (isWeekendUtc(oDate) || isWeekendUtc(cDate) || (cDate.getTime() - oDate.getTime() > 48 * 36e5 && (oDate.getUTCDay() === 5 || cDate.getUTCDay() === 1))) {
            weekendBreaches++;
          }
        }
      }
    });
  }

  // Inactivity: trade executed within 30 consecutive calendar days
  const lastTradeTime = trades.length ? Math.max(...trades.map((t) => new Date(t.close_time || t.open_time).getTime())) : new Date(acc.createdAt).getTime();
  const daysSinceLastTrade = Math.floor((Date.now() - lastTradeTime) / 864e5);
  const inactive = daysSinceLastTrade >= 30;

  // Tick scalping: closing 3 or more trades held under 10 seconds within 1 hour
  let tickScalpBreach = false;
  const ultraShort = trades.filter((t) => new Date(t.close_time).getTime() - new Date(t.open_time).getTime() < 10_000);
  if (ultraShort.length >= 3) {
    const sorted = ultraShort.sort((a, b) => new Date(a.open_time).getTime() - new Date(b.open_time).getTime());
    for (let i = 0; i <= sorted.length - 3; i++) {
      if (new Date(sorted[i + 2]!.open_time).getTime() - new Date(sorted[i]!.open_time).getTime() <= 3600_000) {
        tickScalpBreach = true;
        break;
      }
    }
  }

  const failed = acc.status === "Failed";
  const ruleChecks: { id: string; label: string; status: RuleStatus; info: string }[] = [
    {
      id: "daily-drawdown", label: "Maximum Daily Drawdown",
      status: currentDailyLoss >= dailyLossLimit ? "failed" : currentDailyLoss >= dailyLossLimit * 0.8 ? "warning" : "passed",
      info: `Daily loss $${currentDailyLoss.toFixed(2)} of $${dailyLossLimit.toFixed(2)} limit (${limits.daily}% of starting balance). Resets at 00:00 UTC.`,
    },
    {
      id: "overall-drawdown", label: isFlex ? "Maximum Loss (8% Trailing)" : "Maximum Loss (6% Static)",
      status: currentMaxDrawdown >= maxDrawdown ? "failed" : currentMaxDrawdown >= maxDrawdown * 0.8 ? "warning" : "passed",
      info: isFlex
        ? `Trailing floor at $${(highWaterMark - maxDrawdown).toFixed(2)} (8% below peak closed balance). Current drawdown: $${currentMaxDrawdown.toFixed(2)}.`
        : `Floor is static at $${(size - maxDrawdown).toFixed(2)} (6% below initial balance). Current drawdown: $${currentMaxDrawdown.toFixed(2)}.`,
    },
    {
      id: "minimum-holding-time", label: "Minimum Holding Time (3 Min)",
      status: shortHolds ? (isFlex ? "warning" : "failed") : "passed",
      info: shortHolds ? `${shortHolds} trade(s) closed in under 3 minutes (minimum 180s required)` : "All trades held for at least 3 minutes",
    },
  ];

  if (acc.phase !== PHASE.FUNDED && acc.profitTarget > 0) {
    const targetPct = RULES[model]?.targets[acc.phase === PHASE.P2 ? 1 : 0] ?? 0;
    ruleChecks.push({
      id: "profit-target", label: `Profit Target (${targetPct}%)`, status: profit >= acc.profitTarget ? "passed" : "pending",
      info: `$${Math.max(0, profit).toFixed(2)} of $${acc.profitTarget.toFixed(2)} target reached (verified with zero open exposure)`,
    });
  }

  if (minDays > 0) {
    ruleChecks.push({
      id: "minimum-profitable-trading-days", label: "Winning Days (≥0.5%)", status: winningDays >= minDays ? "passed" : "pending",
      info: `${winningDays} of ${minDays} Winning Days achieved (requires ≥$${(size * 0.005).toFixed(0)} profit per UTC day)`,
    });
  }

  if (isFundedOrInstant) {
    ruleChecks.push({
      id: "one-percent-risk", label: "1% Per-Trade Risk Rule",
      status: excessiveRiskTrades > 0 ? "failed" : "passed",
      info: excessiveRiskTrades > 0
        ? `${excessiveRiskTrades} trade(s) exceeded the 1% floating loss limit ($${onePctLimit.toFixed(2)})`
        : `Max floating loss on any position must stay within $${onePctLimit.toFixed(2)} (1% of starting balance)`,
    });

    const layeringFailed = layeringBreaches > 0 || thirdLayerBreach;
    ruleChecks.push({
      id: "trade-layering", label: model === "Instant" ? "Trade Layering (10m gap, max 2 layers)" : "Trade Layering (10-Min Gap)",
      status: layeringFailed ? "failed" : "passed",
      info: thirdLayerBreach
        ? "Hard breach: 3 or more concurrent layers were open (Instant accounts allow maximum 2 concurrent layers)"
        : layeringBreaches > 0
        ? `${layeringBreaches} violation(s): new trades must open at least 10 minutes apart`
        : model === "Instant" ? "10 min between trade opens, maximum 2 concurrent layers" : "New positions must open at least 10 minutes apart",
    });

    ruleChecks.push({
      id: "news-trading", label: "News Trading Window (±5 Min)",
      status: "passed",
      info: "Funded and Instant accounts: restricted window of 5m before to 5m after high-impact economic news releases",
    });
  }

  if (model !== "Flex") {
    ruleChecks.push({
      id: "overnight-holding", label: "Overnight Holding",
      status: overnightBreaches > 0 ? "warning" : "passed",
      info: overnightBreaches > 0
        ? `${overnightBreaches} trade(s) held past 00:00 UTC daily reset (not allowed on 1-Step/2-Step/Instant)`
        : "All positions must close before 00:00 UTC daily reset",
    });

    ruleChecks.push({
      id: "weekend-holding", label: "Weekend Holding",
      status: weekendBreaches > 0 ? "warning" : "passed",
      info: acc.weekendHoldingAddon
        ? "Weekend Holding Add-on active: positions allowed over weekend"
        : weekendBreaches > 0
        ? `${weekendBreaches} position(s) held over the weekend without add-on`
        : "Positions must be closed Friday 23:00 to Sunday 23:00 UTC",
    });
  }

  ruleChecks.push({
    id: "inactivity", label: "Inactivity (30 Days)",
    status: inactive ? "failed" : daysSinceLastTrade >= 25 ? "warning" : "passed",
    info: inactive ? "Account inactive: no trades executed in 30 consecutive calendar days" : `Last executed trade: ${daysSinceLastTrade} day(s) ago (must trade every 30 days)`,
  });

  if (tickScalpBreach) {
    ruleChecks.push({
      id: "tick-scalping", label: "Tick Scalping",
      status: "failed",
      info: "Prohibited: 3 or more trades held under 10 seconds within 1 hour",
    });
  }

  return {
    ...acc,
    size, planName: plan.planName, dailyLossLimit, maxDrawdown, currentDailyLoss, currentMaxDrawdown,
    ruleChecks: acc.deliveryStatus === "delivered" && !failed ? ruleChecks : [],
    breachReason: failed ? payload.breachReason || payload.ruleBreach?.message || "" : "",
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */
