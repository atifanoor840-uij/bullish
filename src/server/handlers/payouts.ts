import { db, eq } from "../db";
import {
  PAYOUT_CAP_PERCENT, PAYOUT_MIN, PAYOUT_PERIOD_DAYS, PHASE, PROFIT_SPLIT_BY_WITHDRAWAL, audit, notify, orderPlan, withUserNames,
} from "../core";
import { HttpError, body, isAdmin, numv, randDigits, requireAdmin, requireUser, str, type Ctx } from "../http";
import { decorateAccount } from "../stats";
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

  // Eligibility gates (14 days funded, 5 Winning Days, zero violations, positions closed, minimum profit,
  // Flex consistency) — the same checks the dashboard shows, so the two can never disagree.
  const { payoutChecks } = await decorateAccount(acc, order);
  const blocker = payoutChecks.find((c) => !c.ok);
  if (blocker) throw new HttpError(400, blocker.info);

  const minWithdrawal = isFlex ? 100 : Math.max(PAYOUT_MIN, (size * 0.01));
  const remainingProfit = Math.max(0, acc.balance - size);

  // Withdrawal Cap: 6% of Initial Account Balance per 14-day cycle (cycles start when the funded account was delivered). Flex has NO cap.
  const all = await db.select<DBPayout>("payouts", { accountId: eq(acc.id) });
  const periodMs = PAYOUT_PERIOD_DAYS * 864e5;
  const created = new Date(acc.deliveredAt || acc.createdAt).getTime();
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
    if (acc) {
      // Withdrawn profit also lowers the Flex trailing high-water mark, so a payout is never counted as drawdown.
      const payload = (acc.statisticsPayload ?? {}) as Record<string, unknown>;
      const hwm = Number(payload["_highWaterMark"]);
      await db.update("trading_accounts", { id: eq(acc.id) }, {
        balance: acc.balance - payout.amount, equity: acc.equity - payout.amount,
        ...(Number.isFinite(hwm) && hwm > 0 ? { statisticsPayload: { ...payload, _highWaterMark: hwm - payout.amount } } : {}),
      });
    }
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
