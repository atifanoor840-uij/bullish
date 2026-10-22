/**
 * Shared helpers for the trader dashboard and the admin CRM:
 * number formatting, status tones, and the account → plan/limits join.
 */
import type { Order, TradingAccount } from "@/lib/propApi";

export const num = (v: unknown, f = 0) => (Number.isFinite(Number(v)) ? Number(v) : f);

export const money = (n: unknown, d = 2) =>
  "$" + num(n).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });

export const signed = (v: unknown, d = 2) => `${num(v) < 0 ? "-" : num(v) > 0 ? "+" : ""}${money(Math.abs(num(v)), d)}`;

export const pct = (v: unknown, d = 1) => `${num(v).toFixed(d)}%`;

export const compactMoney = (v: unknown) => {
  const n = num(v);
  const a = Math.abs(n);
  const s = n < 0 ? "-" : n > 0 ? "+" : "";
  if (a >= 1e6) return `${s}$${(a / 1e6).toFixed(2)}M`;
  if (a >= 1e3) return `${s}$${(a / 1e3).toFixed(1)}k`;
  return `${s}$${a.toFixed(0)}`;
};

/** Text colour for a signed value: profit / loss / neutral. */
export const tone = (v: unknown) => (num(v) > 0 ? "text-profit" : num(v) < 0 ? "text-loss" : "text-foreground");

export const sizeLabel = (size: number) => (size >= 1000 ? `$${+(size / 1000).toFixed(1)}K` : money(size, 0));

/** Catalog price exactly as set in the CRM: cents only when the price has them. */
export const price = (n: unknown) => money(n, num(n) % 1 ? 2 : 0);

export const fmtDate = (d?: string, withTime = false) => {
  if (!d) return "—";
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
};

export type Tone = "success" | "danger" | "warning" | "info" | "neutral";

/** Maps any backend status string (account, order, payout, KYC…) to a badge tone. */
export function statusTone(status?: string): Tone {
  const s = (status || "").toLowerCase();
  if (["active", "funded", "passed", "paid", "approved", "delivered", "available", "sent", "live active", "step2 active"].includes(s)) return "success";
  if (["failed", "rejected", "banned", "payment failed", "inactive", "expired"].includes(s)) return "danger";
  if (["pending", "processing", "needs_review", "suspended", "paused", "replaced"].includes(s)) return "warning";
  return "info";
}

/* ---------------- challenge rules (mirror of the backend rulebook) ---------------- */

type Rule = { targets: number[]; daily: number; overall: number; minDays: number };
const RULES: Record<string, Rule> = {
  "Two Step": { targets: [8, 5], daily: 4, overall: 10, minDays: 3 },
  "One Step": { targets: [10], daily: 4, overall: 10, minDays: 3 },
  Instant: { targets: [], daily: 3, overall: 5, minDays: 5 },
};
const FUNDED = { daily: 3, overall: 5 };

export const modelOf = (planName = "") => {
  const p = planName.toLowerCase();
  if (p.includes("instant")) return "Instant";
  if (p.includes("one") || p.includes("1-step") || p.includes("1 step")) return "One Step";
  return "Two Step";
};

const sizeFrom = (planName = "", planId = "") => {
  const m = `${planName} ${planId}`.match(/(\d+(?:\.\d+)?)\s*k/i);
  return m ? Number(m[1]) * 1000 : 0;
};

export type AccountInfo = {
  planName: string;
  model: string;
  size: number;
  phase: string;
  isFunded: boolean;
  target: number;
  dailyLimit: number;
  maxLimit: number;
  dailyUsed: number;
  maxUsed: number;
  minDays: number;
  profit: number;
};

/** Joins an account with its order to resolve plan, size and risk limits. */
export function describeAccount(a: TradingAccount, ordersById: Record<string, Order> = {}): AccountInfo {
  const order = ordersById[a.orderId];
  const planName = order?.planName || "";
  const model = modelOf(planName);
  const rule = RULES[model]!;
  const size = num(a["size"]) || sizeFrom(planName, order?.planId) || Math.max(0, num(a.balance) - num(a.totalPl));
  const phase = a.phase || (a.status === "Funded" ? "Funded (Live)" : "Phase 1 (Evaluation)");
  const isFunded = a.status === "Funded" || phase.startsWith("Funded");
  const stage = phase.startsWith("Phase 2") ? 1 : 0;
  const targetPct = isFunded ? 0 : (rule.targets[stage] ?? 0);
  const limits = isFunded ? FUNDED : rule;
  const equity = num(a.equity, num(a.balance));
  return {
    planName: planName || `${model} ${sizeLabel(size)}`,
    model,
    size,
    phase,
    isFunded,
    target: num(a.profitTarget) || (size * targetPct) / 100,
    dailyLimit: num(a["dailyLossLimit"]) || (size * limits.daily) / 100,
    maxLimit: num(a["maxDrawdown"]) || (size * limits.overall) / 100,
    dailyUsed: num(a["currentDailyLoss"], Math.max(0, -num(a.todayPl))),
    maxUsed: num(a["currentMaxDrawdown"], Math.max(0, size - Math.min(num(a.balance), equity))),
    minDays: rule.minDays,
    profit: num(a.totalPl, num(a.balance) - size),
  };
}

/** Stored breach reason for a failed account, if the rules engine left one. */
export function breachReason(a: TradingAccount): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p: any = a.statisticsPayload || {};
  return (
    (a["breachReason"] as string) ||
    p.breachReason ||
    p.ruleBreach?.message ||
    "This account breached a trading rule and has been closed."
  );
}

export type Trade = {
  ticket: string;
  symbol: string;
  type: string;
  volume: number;
  open_time: string;
  close_time: string;
  open_price?: number;
  close_price?: number;
  profit: number;
};

/** Closed trades from the synced statistics feed (newest first). */
export function closedTrades(a: TradingAccount): Trade[] {
  /* eslint-disable @typescript-eslint/no-explicit-any -- external statistics feed is untyped */
  const p: any = a.statisticsPayload || {};
  const raw: any[] = p.statistics?.advanced_statistics?.charts?.recent_trades_duration || p.trades || [];
  /* eslint-enable @typescript-eslint/no-explicit-any */
  return raw
    .map((t) => ({
      ticket: String(t.ticket ?? t.id ?? ""),
      symbol: String(t.symbol ?? ""),
      type: String(t.type ?? t.side ?? "").toUpperCase(),
      volume: num(t.volume ?? t.lots),
      open_time: t.open_time,
      close_time: t.close_time,
      open_price: t.open_price,
      close_price: t.close_price,
      profit: num(t.net_profit ?? t.profit ?? t.pnl),
    }))
    .sort((x, y) => new Date(y.close_time).getTime() - new Date(x.close_time).getTime());
}

export type DayStat = { day: string; pl: number; trades: number; won: number; lost: number };

/** Groups trades into UTC trading days, oldest first. */
export function tradingDays(trades: Trade[]): DayStat[] {
  const days: Record<string, DayStat> = {};
  for (const t of trades) {
    if (!t.close_time) continue;
    const key = new Date(t.close_time).toISOString().slice(0, 10);
    const d = (days[key] ??= { day: key, pl: 0, trades: 0, won: 0, lost: 0 });
    d.pl += t.profit;
    d.trades += 1;
    if (t.profit > 0) d.won += 1;
    else if (t.profit < 0) d.lost += 1;
  }
  return Object.values(days).sort((a, b) => a.day.localeCompare(b.day));
}
