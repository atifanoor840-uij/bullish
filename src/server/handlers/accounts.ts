import { db, eq, inList } from "../db";
import {
  PENDING_SERVER, PHASE, accountsOfOrder, audit, createNextStage, credentialsMessage, credentialsTaken, notify, orderPlan,
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
      ...(await decorateAccount(a, orders.get(a.orderId))),
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
    [account] = (await db.update<DBAccount>("trading_accounts", { id: eq(id) }, patch)) as [DBAccount];
    if (existing.deliveryStatus === "pending") {
      if (order) await ensureOrderActive(order, account);
      await notify(account.userId, "Account delivered", await credentialsMessage(account), "success", "email");
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
  return { success: !error, ...(error ? { error } : {}), account: { ...(await decorateAccount(account, order)), userName: u?.name ?? "", userEmail: u?.email ?? "" } };
}
