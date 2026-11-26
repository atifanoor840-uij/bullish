import { db, eq, inList } from "../db";
import {
  PENDING_SERVER, PHASE, accountsOfOrder, activationOrderId, audit, createNextStage, credentialsMessage, credentialsTaken, flexActivationFee, notify, orderPlan,
  orderStatusForPhase, releaseInventory, stagesFor, userMap,
} from "../core";
import { HttpError, body, isAdmin, numv, query, requireAdmin, requireUser, str, type Ctx } from "../http";
import { decorateAccount, refreshStats } from "../stats";
import { ensureOrderActive } from "./orders";
import type { DBAccount, DBCertificate, DBInventory, DBOrder, DBUser } from "../types";

async function ordersFor(accounts: DBAccount[]) {
  const ids = [...new Set(accounts.map((a) => a.orderId).filter(Boolean))];
  const map = new Map<string, DBOrder>();
  for (let i = 0; i < ids.length; i += 150) {
    (await db.select<DBOrder>("orders", { id: inList(ids.slice(i, i + 150)) })).forEach((o) => map.set(o.id, o));
  }
  return map;
}

/**
 * A hard rule breach fails the account automatically, with the same side effects as an admin
 * marking it Failed (order failed, breach reason stored, trader emailed). Returns the decorated account.
 */
export async function decorateAndEnforce(acc: DBAccount, order?: DBOrder | null) {
  const decorated = await decorateAccount(acc, order);
  if (acc.status !== "Active" && acc.status !== "Funded") return decorated;
  const waived = ((acc.statisticsPayload as Record<string, unknown> | null)?.["_waivedBreaches"] as string[] | undefined) ?? [];
  const breached = decorated.ruleChecks.filter((c) => c.status === "failed" && !waived.includes(c.id));
  if (!breached.length) return decorated;

  const now = new Date().toISOString();
  const reason = `Account failed — hard breach of ${breached.map((c) => `${c.label}: ${c.info}`).join("; ")}`;
  const payload = {
    ...((acc.statisticsPayload as Record<string, unknown>) ?? {}),
    breachReason: reason,
    // Trades are kept with the breach: the statistics feed only lists recent trades, so they may drop out later.
    ruleBreach: { message: reason, rules: breached.map((c) => c.id), at: now, trades: breached.flatMap((c) => (c.trades ?? []).map((t) => ({ ...t, rule: c.label }))) },
  };
  // Only the request that flips the status sends the email, even when several load the dashboard at once.
  const [failed] = await db.update<DBAccount>("trading_accounts", { id: eq(acc.id), status: eq(acc.status) }, { status: "Failed", statisticsPayload: payload });
  if (!failed) return decorated;
  if (order) await db.update("orders", { id: eq(order.id) }, { status: "Failed", updatedAt: now });
  await notify(acc.userId, "Challenge failed", `Account #${acc.id}: ${reason}`, "error", "email");
  await audit(null, "account_auto_fail", acc.id, "account", reason);
  return decorateAccount(failed, order);
}

export async function listAccounts(ctx: Ctx) {
  const user = await requireUser(ctx);
  const admin = isAdmin(user) || user.role === "support";
  let accounts = admin
    ? await db.select<DBAccount>("trading_accounts", {}, { order: "createdAt.desc" })
    : await db.select<DBAccount>("trading_accounts", { userId: eq(user.id) }, { order: "createdAt.desc" });
  // Traders get fresh numbers on load; admins refresh one account at a time (refresh-stats).
  if (!admin) accounts = await Promise.all(accounts.map(async (a) => (await refreshStats(a)).account));
  const orders = await ordersFor(accounts);
  const users = admin ? await userMap(accounts.map((a) => a.userId)) : new Map<string, DBUser>();
  const decorated = await Promise.all(
    accounts.map(async (a) => ({
      ...(await decorateAndEnforce(a, orders.get(a.orderId))),
      ...(admin ? { userName: users.get(a.userId)?.name ?? "", userEmail: users.get(a.userId)?.email ?? "" } : {}),
    })),
  );
  return { accounts: decorated };
}

/** Admin delivery desk: create / deliver / edit an account and change its status. */
export async function saveAccount(ctx: Ctx) {
  const admin = await requireAdmin(ctx);
  const b = await body(ctx);
  const id = str(b.id), platform = str(b.platform), login = str(b.login), passwordMaster = str(b.passwordMaster), server = str(b.server);
  if (!id || !platform || !login || !passwordMaster || !server) throw new HttpError(400, "id, platform, login, passwordMaster and server are required.");
  if (server !== PENDING_SERVER && (await credentialsTaken(platform, server, login, id))) {
    throw new HttpError(409, "These credentials are already delivered on another account.");
  }

  const existing = await db.one<DBAccount>("trading_accounts", { id: eq(id) });
  const orderId = str(b.orderId) || existing?.orderId || "";
  const order = orderId ? await db.one<DBOrder>("orders", { id: eq(orderId) }) : null;
  const now = new Date().toISOString();

  const inventoryId = str(b.inventoryItemId);
  if (inventoryId) {
    const inv = await db.one<DBInventory>("challenge_inventory", { id: eq(inventoryId) });
    if (!inv || inv.status !== "available") throw new HttpError(409, "That inventory account is no longer available.");
    if (inv.login !== login || inv.server !== server || inv.platform !== platform) throw new HttpError(400, "Inventory credentials do not match.");
    await db.update("challenge_inventory", { id: eq(inventoryId) }, { status: "delivered", orderId: orderId || null });
  }

  const statsId = str(b.externalStatisticsId) || str(b.statisticsApiId);
  const patch: Partial<DBAccount> = {
    platform, login, passwordMaster, server, passwordInvestor: str(b.passwordInvestor) || existing?.passwordInvestor || "",
    deliveryStatus: "delivered", deliveredAt: existing?.deliveredAt || now,
  };
  if (b.profitTarget !== undefined) patch.profitTarget = numv(b.profitTarget);
  if (b.graphLink !== undefined) patch.graphLink = str(b.graphLink);
  if (b.balance !== undefined) patch.balance = numv(b.balance);
  if (b.equity !== undefined) patch.equity = numv(b.equity);
  if (b.phase !== undefined) patch.phase = str(b.phase);
  if (statsId) patch.externalStatisticsId = statsId;
  const status = str(b.status) as DBAccount["status"] | "";
  if (status) patch.status = status;

  let account: DBAccount;
  if (!existing) {
    if (!order) throw new HttpError(400, "orderId is required to create an account.");
    const { model, size } = await orderPlan(order);
    const phase = str(b.phase) || stagesFor(model)[0]!;
    [account] = (await db.insert<DBAccount>("trading_accounts", {
      id, userId: str(b.userId) || order.userId, orderId: order.id, profitTarget: 0, balance: size, equity: size, todayPl: 0, totalPl: 0,
      status: phase === PHASE.FUNDED ? "Funded" : "Active", phase, graphLink: "", createdAt: now, weekendHoldingAddon: !!order.weekendHoldingAddon,
      ...patch,
    })) as [DBAccount];
    await ensureOrderActive(order, account);
    await notify(account.userId, "Account delivered", await credentialsMessage(account), "success", "email");
  } else {
    const credsChanged = existing.platform !== platform || existing.server !== server || existing.login !== login;
    [account] = (await db.update<DBAccount>("trading_accounts", { id: eq(id) }, patch)) as [DBAccount];
    if (existing.deliveryStatus === "pending") {
      if (order) await ensureOrderActive(order, account);
      await notify(account.userId, "Account delivered", await credentialsMessage(account), "success", "email");
    } else {
      // Editing an already-delivered account: optionally free the old credentials and re-send the new ones.
      if (credsChanged && b.releaseOld === true) await releaseInventory(existing);
      if (b.notifyTrader === true) await notify(account.userId, "Account credentials updated", await credentialsMessage(account), "info", "email");
    }
  }

  if (status && existing && status !== existing.status && order) {
    if (status === "Failed") {
      const reason = str(b.breachReason) || "Marked as failed by the risk team.";
      const payload = { ...((account.statisticsPayload as Record<string, unknown>) ?? {}), breachReason: reason };
      await db.update("trading_accounts", { id: eq(id) }, { statisticsPayload: payload });
      await db.update("orders", { id: eq(order.id) }, { status: "Failed", updatedAt: now });
      await notify(account.userId, "Challenge failed", `Account #${id}: ${reason}`, "error", "email");
    } else if (existing.status === "Failed") {
      // Admin reinstated the account: the breaches it had so far are waived and won't auto-fail it again.
      const prev = (account.statisticsPayload as Record<string, unknown>) ?? {};
      const waived = [...new Set([...((prev["_waivedBreaches"] as string[] | undefined) ?? []), ...(((prev["ruleBreach"] as { rules?: string[] } | undefined)?.rules) ?? [])])];
      const { breachReason: _r, ruleBreach: _b, ...rest } = prev;
      await db.update("trading_accounts", { id: eq(id) }, { statisticsPayload: { ...rest, _waivedBreaches: waived } });
      await db.update("orders", { id: eq(order.id) }, { status: orderStatusForPhase(account.phase), updatedAt: now });
    }
    if (status === "Passed") {
      await createNextStage(account, order);
      await issuePassCertificate(account, order);
    }
  }
  await audit(admin, "account_save", id, "account", `Account ${id} saved${status ? ` (${status})` : ""}`);
  return { account };
}

async function issuePassCertificate(account: DBAccount, order: DBOrder) {
  const user = await db.one<DBUser>("users", { id: eq(account.userId) }, { select: "id,name" });
  const { size, planName } = await orderPlan(order);
  await db.insert<DBCertificate>("certificates", {
    id: `cert-${account.id}-${Date.now().toString(36)}`, userId: account.userId, accountId: account.id, traderName: user?.name ?? "",
    accountSize: size, planName: `${planName} · ${account.phase}`, datePassed: new Date().toISOString(),
  }).catch(() => {});
}

export async function deleteAccount(ctx: Ctx) {
  const admin = await requireAdmin(ctx);
  const id = query(ctx, "id");
  const acc = await db.one<DBAccount>("trading_accounts", { id: eq(id) });
  if (!acc) throw new HttpError(404, "Account not found.");
  await releaseInventory(acc);
  await db.remove("trading_accounts", { id: eq(id) });
  const remaining = acc.orderId ? await accountsOfOrder(acc.orderId) : [];
  if (acc.orderId) {
    const last = remaining.at(-1);
    await db.update("orders", { id: eq(acc.orderId) }, { status: last ? orderStatusForPhase(last.phase) : "Pending", updatedAt: new Date().toISOString() });
  }
  await notify(acc.userId, "Account removed", `Trading account #${id} was removed by the support team.`, "warning");
  await audit(admin, "account_delete", id, "account", `Deleted account ${id}`);
  return {};
}

export async function requestNext(ctx: Ctx) {
  const user = await requireUser(ctx);
  const b = await body(ctx);
  const acc = await db.one<DBAccount>("trading_accounts", { id: eq(str(b.accountId)) });
  if (!acc || acc.userId !== user.id) throw new HttpError(404, "Account not found.");
  if (acc.status !== "Passed") throw new HttpError(400, "Only passed accounts can move to the next stage.");
  const order = await db.one<DBOrder>("orders", { id: eq(acc.orderId) });
  if (!order) throw new HttpError(404, "Order not found.");
  const { model } = await orderPlan(order);
  const stages = stagesFor(model);
  const nextPhase = stages[stages.indexOf(acc.phase) + 1];
  if (!nextPhase) throw new HttpError(400, "This account is already at its final stage.");
  if ((await accountsOfOrder(order.id)).some((a) => a.phase === nextPhase)) throw new HttpError(400, "The next stage was already requested.");
  if (model === "Flex" && nextPhase === PHASE.FUNDED) {
    // Each passed Flex account pays its own activation fee (a BOGO pair = two separate payments).
    const fee = await flexActivationFee(order);
    const open = await db.select<DBOrder>("orders", { id: `like.ord-act-${acc.id}-*`, status: eq("Pending") }, { order: "createdAt.desc" });
    let activation = open[0];
    if (!activation) {
      const now = new Date().toISOString();
      [activation] = await db.insert<DBOrder>("orders", {
        id: activationOrderId(acc.id), userId: user.id, planId: order.planId, couponUsed: "", amountPaid: fee, paymentMethod: "Crypto",
        status: "Pending", gatewayRef: `platform=${acc.platform || "MT5"}`, createdAt: now, updatedAt: now, referralBalanceApplied: 0,
        weekendHoldingAddon: !!order.weekendHoldingAddon, legacyRules: !!order.legacyRules,
      });
      if (!activation) throw new HttpError(500, "Could not create the activation payment.");
    }
    return {
      message: `Pay the $${activation.amountPaid} activation fee for account #${acc.id} to receive your funded account.`,
      accountId: acc.id, activationOrderId: activation.id, amount: activation.amountPaid, requiresPayment: true,
    };
  }
  const next = await createNextStage(acc, order);
  return {
    message: next?.deliveryStatus === "delivered" ? "Your next stage account is ready." : "Your next stage account is being prepared.",
    accountId: next?.id ?? "",
  };
}

export async function refreshAccountStats(ctx: Ctx) {
  await requireAdmin(ctx, true);
  const b = await body(ctx);
  const acc = await db.one<DBAccount>("trading_accounts", { id: eq(str(b.accountId)) });
  if (!acc) throw new HttpError(404, "Account not found.");
  if (!acc.externalStatisticsId && !acc.statisticsApiId) throw new HttpError(400, "This account has no statistics (Graph) ID.");
  const { account, error } = await refreshStats(acc, true);
  const order = await db.one<DBOrder>("orders", { id: eq(acc.orderId) });
  const u = (await userMap([acc.userId])).get(acc.userId);
  return { success: !error, ...(error ? { error } : {}), account: { ...(await decorateAndEnforce(account, order)), userName: u?.name ?? "", userEmail: u?.email ?? "" } };
}

/**
 * Admin "Recheck": pulls fresh statistics and re-runs every rule on a failed account as if it
 * were still trading. If no rule fails now (e.g. it was failed by a feed glitch) the account and
 * its order are reactivated; otherwise it stays failed and the breaching rules/trades are returned.
 */
export async function recheckAccount(ctx: Ctx) {
  const admin = await requireAdmin(ctx);
  const b = await body(ctx);
  const acc = await db.one<DBAccount>("trading_accounts", { id: eq(str(b.accountId)) });
  if (!acc) throw new HttpError(404, "Account not found.");
  if (acc.status !== "Failed") throw new HttpError(400, `Only failed accounts can be rechecked (this one is ${acc.status}).`);
  const order = acc.orderId ? await db.one<DBOrder>("orders", { id: eq(acc.orderId) }) : null;

  let fresh = acc;
  if (acc.externalStatisticsId || acc.statisticsApiId) {
    const { account, error } = await refreshStats(acc, true);
    if (error) throw new HttpError(502, `Could not pull fresh statistics, nothing changed: ${error}`);
    fresh = account;
  }

  // Evaluate as a live account; the old breach record is set aside so it can't influence the result.
  const restored: DBAccount["status"] = fresh.phase === PHASE.FUNDED ? "Funded" : "Active";
  const prev = (fresh.statisticsPayload as Record<string, unknown>) ?? {};
  const { breachReason: oldReason, ruleBreach: oldBreach, ...cleanPayload } = prev;
  const decorated = await decorateAccount({ ...fresh, status: restored, statisticsPayload: cleanPayload }, order);
  const failing = decorated.ruleChecks.filter((c) => c.status === "failed");

  if (failing.length) {
    await audit(admin, "account_recheck", acc.id, "account", `Recheck kept account ${acc.id} failed: ${failing.map((c) => c.label).join(", ")}`);
    return {
      reactivated: false,
      message: `Still breached: ${failing.map((c) => `${c.label} — ${c.info}`).join("; ")}`,
      failedRules: failing,
    };
  }

  const now = new Date().toISOString();
  const payload = { ...cleanPayload, _previousBreach: { reason: oldReason ?? null, ruleBreach: oldBreach ?? null, clearedAt: now, clearedBy: admin.id } };
  const [updated] = await db.update<DBAccount>("trading_accounts", { id: eq(acc.id), status: eq("Failed") }, { status: restored, statisticsPayload: payload });
  if (!updated) throw new HttpError(409, "The account changed while rechecking. Reload and try again.");
  if (order) await db.update("orders", { id: eq(order.id) }, { status: orderStatusForPhase(updated.phase), updatedAt: now });
  await notify(acc.userId, "Account reactivated", `Account #${acc.id} was rechecked by the risk team and no rule breach was found. It is active again.`, "success", "email");
  await audit(admin, "account_recheck", acc.id, "account", `Recheck found no breach — account ${acc.id} reactivated (${restored})`);
  return { reactivated: true, message: `No rule breach found — account reactivated as ${restored}.`, failedRules: [] };
}
