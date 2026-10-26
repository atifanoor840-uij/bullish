import { db, eq } from "../db";
import {
  PAYOUT_CAP_PERCENT, PAYOUT_MIN, PAYOUT_PERIOD_DAYS, PHASE, PROFIT_SPLIT_BY_WITHDRAWAL, audit, notify, orderPlan, withUserNames,
} from "../core";
import { HttpError, body, isAdmin, numv, randDigits, requireAdmin, requireUser, str, type Ctx } from "../http";
import { tradesOf } from "../stats";
import type { DBAccount, DBCertificate, DBKyc, DBOrder, DBPayout, DBUser } from "../types";

export async function listPayouts(ctx: Ctx) {
  const user = await requireUser(ctx);
  const payouts = isAdmin(user) || user.role === "support"
    ? await withUserNames(await db.select<DBPayout>("payouts", {}, { order: "createdAt.desc" }))
    : await db.select<DBPayout>("payouts", { userId: eq(user.id) }, { order: "createdAt.desc" });
  return { payouts };
}

export async function requestPayout(ctx: Ctx) {
  const user = await requireUser(ctx);
  const b = await body(ctx);
  const requested = numv(b.amount);
  const paymentMethod = str(b.paymentMethod);
  if (!(requested > 0) || !paymentMethod || !b.paymentDetails) throw new HttpError(400, "accountId, amount, paymentMethod and paymentDetails are required.");

  const kyc = await db.one<DBKyc>("kyc", { userId: eq(user.id) });
  if (kyc?.status !== "approved") throw new HttpError(403, "Complete identity verification (KYC) before requesting a payout.");
  const acc = await db.one<DBAccount>("trading_accounts", { id: eq(str(b.accountId)) });
  if (!acc || acc.userId !== user.id) throw new HttpError(404, "Account not found.");
  if (acc.status === "Failed" || !(acc.status === "Funded" || acc.phase === PHASE.FUNDED)) throw new HttpError(400, "Payouts are available on active funded accounts only.");

  const order = await db.one<DBOrder>("orders", { id: eq(acc.orderId) });
  const { size, model } = order ? await orderPlan(order) : { size: Math.max(0, acc.balance - acc.totalPl), model: "Two Step" };
  const isFlex = model === "Flex";

  // 14 days must have passed since funded account was received
  const fundedAgeMs = Date.now() - new Date(acc.deliveredAt || acc.createdAt).getTime();
  if (fundedAgeMs < 14 * 864e5) {
    const daysLeft = Math.ceil((14 * 864e5 - fundedAgeMs) / 864e5);
    throw new HttpError(400, `Payouts unlock 14 days after receiving your funded account. ${daysLeft} day(s) remaining.`);
  }

  // Winning Days gate: 5 Winning Days (each >=0.5% of Initial Balance) required before payout
  const byDay = new Map<string, number>();
  tradesOf(acc.statisticsPayload).forEach((t) => t.close_time && byDay.set(t.close_time.slice(0, 10), (byDay.get(t.close_time.slice(0, 10)) ?? 0) + t.profit));
  const winningDays = [...byDay.values()].filter((pl) => pl >= size * 0.005).length;
  if (winningDays < 5) {
    throw new HttpError(400, `You need 5 Winning Days (at least 0.5% / $${(size * 0.005).toFixed(0)} profit each) before requesting a payout. Current: ${winningDays}.`);
  }

  // Flex Consistency: No single day may account for >20% of total profit
  if (isFlex) {
    const totalProfit = Math.max(0, acc.balance - size);
    const bestDay = Math.max(0, ...byDay.values());
    if (totalProfit > 0 && bestDay > totalProfit * 0.20) {
      throw new HttpError(400, `Flex Consistency Rule: No single day may exceed 20% of total profit. Best day: $${bestDay.toFixed(2)} (${((bestDay / totalProfit) * 100).toFixed(1)}% of total profit).`);
    }
  }

  // Minimum withdrawal: 1% of Initial Account Balance ($100 minimum for Flex)
  const minWithdrawal = isFlex ? 100 : Math.max(100, (size * 0.01));
  const remainingProfit = Math.max(0, acc.balance - size);
  if (remainingProfit < minWithdrawal) {
    throw new HttpError(400, `Minimum realized profit required to withdraw is $${minWithdrawal.toFixed(0)} (1% of starting balance). Current profit: $${remainingProfit.toFixed(2)}.`);
  }

  // Withdrawal Cap: 6% of Initial Account Balance per 14-day cycle. Flex accounts have NO withdrawal cap.
  const all = await db.select<DBPayout>("payouts", { accountId: eq(acc.id) });
  const periodMs = PAYOUT_PERIOD_DAYS * 864e5;
  const created = new Date(acc.createdAt).getTime();
  const periodStart = created + Math.floor((Date.now() - created) / periodMs) * periodMs;
  const requestedThisPeriod = all
    .filter((p) => p.status !== "rejected" && new Date(p.createdAt).getTime() >= periodStart)
    .reduce((s, p) => s + Number(p.amount), 0);

  const withdrawalCap = isFlex
    ? remainingProfit
    : Math.max(0, Math.min(remainingProfit, (size * PAYOUT_CAP_PERCENT) / 100 - requestedThisPeriod));

  const amount = +Math.min(requested, withdrawalCap).toFixed(2);
  if (amount < minWithdrawal) {
    throw new HttpError(400, `The minimum payout is $${minWithdrawal.toFixed(0)}. Available this period: $${withdrawalCap.toFixed(2)}.`);
  }
  if (all.some((p) => p.status === "pending" || p.status === "approved" || p.status === "processing")) {
    throw new HttpError(400, "You already have a payout in progress on this account.");
  }

  // Profit Split schedule: 1st: 70%, 2nd: 80%, 3rd: 90%, 4th+: up to 100%. Flex is 85% (or 90% with add-on).
  const paidCount = all.filter((p) => p.status === "paid").length;
  const split = isFlex
    ? (order?.gatewayRef?.includes("split90") ? 90 : 85)
    : PROFIT_SPLIT_BY_WITHDRAWAL[Math.min(paidCount, PROFIT_SPLIT_BY_WITHDRAWAL.length - 1)]!;
  const [payout] = await db.insert<DBPayout>("payouts", {
    id: `pay-${randDigits(6)}`, accountId: acc.id, userId: user.id, amount,
    profitSplitAmount: +((amount * split) / 100).toFixed(2), firmShareAmount: +((amount * (100 - split)) / 100).toFixed(2),
    paymentMethod, paymentDetails: typeof b.paymentDetails === "string" ? b.paymentDetails : JSON.stringify(b.paymentDetails),
    status: "pending", createdAt: new Date().toISOString(),
  });
  await notify(user.id, "Payout requested", `Your payout request of $${amount} (${split}% split) is under review.`, "info", "email");
  await audit(user, "payout_request", payout!.id, "payout", `$${amount} from account ${acc.id}`);
  return {
    payout,
    withdrawal: { requestedAmount: requested, adjustedAmount: amount, withdrawalCap: +withdrawalCap.toFixed(2), remainingProfit: +remainingProfit.toFixed(2), wasAdjusted: amount < requested },
    complianceReview: false,
  };
}

export async function reviewPayout(ctx: Ctx) {
  const admin = await requireAdmin(ctx);
  const b = await body(ctx);
  const status = str(b.status) as DBPayout["status"];
  if (!["pending", "approved", "processing", "paid", "rejected"].includes(status)) throw new HttpError(400, "Invalid status.");
  const payout = await db.one<DBPayout>("payouts", { id: eq(str(b.payoutId)) });
  if (!payout) throw new HttpError(404, "Payout not found.");
  const [updated] = await db.update<DBPayout>("payouts", { id: eq(payout.id) }, {
    status, notes: str(b.notes) || payout.notes || null, approvedBy: admin.name, approvedAt: new Date().toISOString(),
  });
  if (status === "paid" && payout.status !== "paid") {
    const acc = await db.one<DBAccount>("trading_accounts", { id: eq(payout.accountId) });
    if (acc) await db.update("trading_accounts", { id: eq(acc.id) }, { balance: acc.balance - payout.amount, equity: acc.equity - payout.amount });
    const user = await db.one<DBUser>("users", { id: eq(payout.userId) }, { select: "id,name" });
    await db.insert<DBCertificate>("certificates", {
      id: `cert-pay-${payout.id}`, userId: payout.userId, accountId: payout.accountId, traderName: user?.name ?? "",
      accountSize: payout.profitSplitAmount, planName: "Payout", datePassed: new Date().toISOString(),
    }).catch(() => {});
    await notify(payout.userId, "Payout paid", `Your payout of $${payout.profitSplitAmount} has been sent.`, "success", "email");
  } else if (status === "rejected") {
    await notify(payout.userId, "Payout rejected", str(b.notes) || "Your payout request was rejected. Contact support for details.", "error", "email");
  }
  await audit(admin, "payout_review", payout.id, "payout", `${payout.status} → ${status}`);
  return { payout: updated };
}
