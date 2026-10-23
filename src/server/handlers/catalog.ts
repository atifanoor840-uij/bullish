import { db, eq } from "../db";
import {
  PHASE, audit, createStageAccount, decorateOffer, notify, offerCovers, offerLive, orderPlan, stagesFor,
} from "../core";
import { HttpError, body, isAdmin, numv, query, rand, requireAdmin, requireUser, str, type Ctx } from "../http";
import type { DBAccount, DBChallengePlan, DBCoupon, DBOffer, DBOfferRedemption, DBOrder, DBPricingPlan } from "../types";

const MODELS = ["One Step", "Two Step", "Instant"] as const;

/* ---------------- pricing plans ---------------- */

export async function listPricingPlans() {
  const plans = await db.select<DBPricingPlan>("pricing_plans", {}, { order: "size.asc" });
  return { plans };
}

export async function savePricingPlan(ctx: Ctx) {
  const admin = await requireAdmin(ctx);
  const b = await body(ctx);
  const model = str(b.model) as DBPricingPlan["model"];
  const size = numv(b.size), price = numv(b.price);
  if (!MODELS.includes(model) || size <= 0 || price < 0) throw new HttpError(400, "model (One Step | Two Step | Instant), size and price are required.");
  const id = `pp-${model.toLowerCase().replace(/\s+/g, "-")}-${size / 1000}k`;
  const [plan] = await db.upsert<DBPricingPlan>(
    "pricing_plans",
    { id, model, size, price, status: str(b.status) || "active", createdAt: new Date().toISOString() },
    "id",
  );
  await audit(admin, "pricing_plan_save", id, "pricing_plan", `${model} ${size} → $${price}`);
  return { plan };
}

export async function deletePricingPlan(ctx: Ctx) {
  const admin = await requireAdmin(ctx);
  const id = query(ctx, "id");
  if (!id) throw new HttpError(400, "id is required.");
  await db.remove("pricing_plans", { id: eq(id) });
  await audit(admin, "pricing_plan_delete", id, "pricing_plan", `Deleted ${id}`);
  return {};
}

/* ---------------- legacy challenge plans ---------------- */

export async function listPlans() {
  return { plans: await db.select<DBChallengePlan>("challenge_plans", {}, { order: "size.asc" }) };
}

export async function createPlan(ctx: Ctx) {
  await requireAdmin(ctx);
  const b = await body(ctx);
  const name = str(b.name), size = numv(b.size), price = numv(b.price);
  if (!name || size <= 0) throw new HttpError(400, "name, size and price are required.");
  const [plan] = await db.upsert<DBChallengePlan>("challenge_plans", {
    id: `plan-${name.toLowerCase().replace(/\s+/g, "-")}-${size / 1000}k`, name, size, price,
    profitTargetP1: numv(b.profitTargetP1, 8), profitTargetP2: numv(b.profitTargetP2, 5), maxDailyLoss: numv(b.maxDailyLoss, 5),
    maxTotalLoss: numv(b.maxTotalLoss, 10), profitSplit: numv(b.profitSplit, 80),
    platform: str(b.platform), login: str(b.login), password: str(b.password), server: str(b.server),
  }, "id");
  return { plan };
}

export async function updatePlan(ctx: Ctx) {
  await requireAdmin(ctx);
  const { id, ...rest } = await body(ctx);
  if (!str(id)) throw new HttpError(400, "id is required.");
  const [plan] = await db.update<DBChallengePlan>("challenge_plans", { id: eq(str(id)) }, rest as Partial<DBChallengePlan>);
  if (!plan) throw new HttpError(404, "Plan not found.");
  return { plan };
}

export async function deletePlan(ctx: Ctx) {
  await requireAdmin(ctx);
  await db.remove("challenge_plans", { id: eq(query(ctx, "id")) });
  return {};
}

/* ---------------- coupons ---------------- */

export const couponExpired = (c: DBCoupon) => !!c.expiresAt && new Date(c.expiresAt).getTime() < Date.now();

export async function listCoupons() {
  const coupons = await db.select<DBCoupon>("coupons", {}, { order: "createdAt.desc" });
  return { coupons: coupons.map((c) => ({ ...c, isExpired: couponExpired(c), status: couponExpired(c) ? "expired" : c.status })) };
}

export async function saveCoupon(ctx: Ctx) {
  const admin = await requireAdmin(ctx);
  const b = await body(ctx);
  const code = str(b.code).toUpperCase(), pct = numv(b.discountPercent);
  if (!code || pct <= 0 || pct > 100) throw new HttpError(400, "code and a discountPercent between 1 and 100 are required.");
  const [coupon] = await db.upsert<DBCoupon>("coupons", {
    code, discountPercent: pct, status: str(b.status) || "active", expiresAt: str(b.expiresAt) || null, createdAt: new Date().toISOString(),
  }, "code");
  await audit(admin, "coupon_save", code, "coupon", `${code} ${pct}%`);
  return { coupon };
}

export async function deleteCoupon(ctx: Ctx) {
  await requireAdmin(ctx);
  await db.remove("coupons", { code: eq(query(ctx, "code").toUpperCase()) });
  return {};
}

/* ---------------- offers ---------------- */

export async function listOffers() {
  const offers = await db.select<DBOffer>("offers", {}, { order: "createdAt.desc" });
  return { offers: offers.map(decorateOffer) };
}

export async function saveOffer(ctx: Ctx) {
  const admin = await requireAdmin(ctx);
  const b = await body(ctx);
  const name = str(b.name), type = str(b.type) as DBOffer["type"];
  if (!name || !["bogo", "free_retry"].includes(type)) throw new HttpError(400, "name and type (bogo | free_retry) are required.");
  const arr = (v: unknown) => (Array.isArray(v) ? v : []);
  const now = new Date().toISOString();
  const row: Partial<DBOffer> = {
    name, type, description: str(b.description), status: str(b.status) === "paused" ? "paused" : "active",
    startsAt: str(b.startsAt) || null, expiresAt: str(b.expiresAt) || null,
    accountSizes: arr(b.accountSizes).map(Number), models: arr(b.models).map(String), userIds: arr(b.userIds).map(String),
    accountIds: arr(b.accountIds).map(String), buyQuantity: Math.max(1, numv(b.buyQuantity, 1)),
    freeQuantity: type === "bogo" ? Math.max(1, numv(b.freeQuantity, 1)) : 0,
    retryLimit: type === "free_retry" ? Math.max(1, numv(b.retryLimit, 1)) : 0, maxRedemptions: Math.max(0, numv(b.maxRedemptions)), updatedAt: now,
  };
  const id = str(b.id);
  const [offer] = id
    ? await db.update<DBOffer>("offers", { id: eq(id) }, row)
    : await db.insert<DBOffer>("offers", { ...row, id: `offer-${type}-${Date.now()}`, redeemedCount: 0, createdAt: now });
  if (!offer) throw new HttpError(404, "Offer not found.");
  await audit(admin, "offer_save", offer.id, "offer", `${offer.name} saved`);
  return { offer: decorateOffer(offer) };
}

export async function setOfferStatus(ctx: Ctx) {
  await requireAdmin(ctx);
  const b = await body(ctx);
  const status = str(b.status);
  if (!["active", "paused"].includes(status)) throw new HttpError(400, "status must be active or paused.");
  const [offer] = await db.update<DBOffer>("offers", { id: eq(str(b.id)) }, { status: status as DBOffer["status"], updatedAt: new Date().toISOString() });
  if (!offer) throw new HttpError(404, "Offer not found.");
  return { offer: decorateOffer(offer) };
}

export async function deleteOffer(ctx: Ctx) {
  await requireAdmin(ctx);
  await db.remove("offers", { id: eq(query(ctx, "id")) });
  return {};
}

const summary = (o: DBOffer) =>
  o.type === "bogo" ? `Buy ${o.buyQuantity || 1}, get ${o.freeQuantity || 1} free` : `${o.retryLimit || 1} free retr${(o.retryLimit || 1) > 1 ? "ies" : "y"} if an account fails`;

/** Offer badges per account + live offers the trader is in scope for. */
export async function accountOffers(ctx: Ctx) {
  const user = await requireUser(ctx);
  const [offers, accounts, orders, redemptions] = await Promise.all([
    db.select<DBOffer>("offers", { status: eq("active") }),
    db.select<DBAccount>("trading_accounts", { userId: eq(user.id) }),
    db.select<DBOrder>("orders", { userId: eq(user.id) }),
    db.select<DBOfferRedemption>("offer_redemptions", { userId: eq(user.id) }),
  ]);
  const live = offers.filter((o) => offerLive(o));
  const ordersById = new Map(orders.map((o) => [o.id, o]));
  const tags: Record<string, { offerId: string; offerName: string; offerType: string; kind: string; label: string; detail: string }[]> = {};
  const scoped: Record<string, { accountId: string; login: string; platform: string; kind: string }[]> = {};

  for (const acc of accounts) {
    const order = ordersById.get(acc.orderId);
    const plan = order ? await orderPlan(order) : { size: 0, model: "" };
    const push = (o: DBOffer, kind: string, label: string, detail: string) => {
      (tags[acc.id] ??= []).push({ offerId: o.id, offerName: o.name, offerType: o.type, kind, label, detail });
      (scoped[o.id] ??= []).push({ accountId: acc.id, login: acc.login, platform: acc.platform, kind });
    };
    for (const r of redemptions.filter((r) => r.newAccountId === acc.id)) {
      const o = offers.find((x) => x.id === r.offerId);
      if (o) push(o, "granted", o.type === "bogo" ? "Free (BOGO)" : "Free retry", `Granted by ${o.name}`);
    }
    for (const o of live) {
      if (!offerCovers(o, { userId: user.id, accountId: acc.id, size: plan.size, model: plan.model })) continue;
      if (o.type === "free_retry") push(o, acc.status === "Failed" ? "applied" : "active", "Free retry", summary(o));
    }
  }
  const visible = live.filter((o) => !o.userIds?.length || o.userIds.includes(user.id));
  return {
    tags,
    offers: visible.map((o) => ({
      id: o.id, name: o.name, type: o.type, description: o.description, summary: summary(o), startsAt: o.startsAt, expiresAt: o.expiresAt,
      accountSizes: o.accountSizes ?? [], models: o.models ?? [], targeted: !!(o.userIds?.length || o.accountIds?.length), accounts: scoped[o.id] ?? [],
    })),
  };
}

async function retryOfferFor(acc: DBAccount, order: DBOrder | null, userId: string) {
  const plan = order ? await orderPlan(order) : { size: 0, model: "" };
  const offers = (await db.select<DBOffer>("offers", { type: eq("free_retry"), status: eq("active") })).filter(
    (o) => offerLive(o) && offerCovers(o, { userId, accountId: acc.id, size: plan.size, model: plan.model }),
  );
  const claimed = await db.select<DBOfferRedemption>("offer_redemptions", { sourceAccountId: eq(acc.id), type: eq("free_retry") });
  for (const o of offers) {
    const used = claimed.filter((c) => c.offerId === o.id).length;
    if (used < (o.retryLimit || 1)) return { offer: o, remaining: (o.retryLimit || 1) - used, claimed };
  }
  return { offer: null, remaining: 0, claimed };
}

export async function retryEligibility(ctx: Ctx) {
  const user = await requireUser(ctx);
  const failed = await db.select<DBAccount>("trading_accounts", { userId: eq(user.id), status: eq("Failed") });
  const eligibility = [];
  for (const acc of failed) {
    const order = await db.one<DBOrder>("orders", { id: eq(acc.orderId) });
    const plan = order ? await orderPlan(order) : { size: 0, planName: "" };
    const { offer, remaining, claimed } = await retryOfferFor(acc, order, user.id);
    eligibility.push({
      accountId: acc.id, accountSize: plan.size, planName: plan.planName, claimedCount: claimed.length,
      newAccountId: claimed.at(-1)?.newAccountId ?? null, offer: offer ? { id: offer.id, name: offer.name, retriesRemaining: remaining } : null,
    });
  }
  return { eligibility };
}

export async function claimRetry(ctx: Ctx) {
  const user = await requireUser(ctx);
  const b = await body(ctx);
  const acc = await db.one<DBAccount>("trading_accounts", { id: eq(str(b.accountId)) });
  if (!acc || (acc.userId !== user.id && !isAdmin(user))) throw new HttpError(404, "Account not found.");
  if (acc.status !== "Failed") throw new HttpError(400, "Only failed accounts can claim a free retry.");
  const order = await db.one<DBOrder>("orders", { id: eq(acc.orderId) });
  if (!order) throw new HttpError(404, "Order not found.");
  const { offer, remaining } = await retryOfferFor(acc, order, acc.userId);
  if (!offer) throw new HttpError(400, "No free retry is available for this account.");

  const now = new Date().toISOString();
  const [newOrder] = await db.insert<DBOrder>("orders", {
    id: `ord-retry-${rand(6)}`, userId: acc.userId, planId: order.planId, couponUsed: "", amountPaid: 0,
    paymentMethod: "free_retry", status: "Active", gatewayRef: `offer:${offer.id}`, createdAt: now, updatedAt: now,
  });
  const { model } = await orderPlan(order);
  const account = await createStageAccount(newOrder!, stagesFor(model)[0] ?? PHASE.P1, acc.platform);
  await db.insert("offer_redemptions", {
    id: `red-${rand(9)}`, offerId: offer.id, userId: acc.userId, type: "free_retry", sourceAccountId: acc.id,
    newAccountId: account.id, orderId: newOrder!.id, status: "granted", createdAt: now,
  });
  await db.update("offers", { id: eq(offer.id) }, { redeemedCount: (offer.redeemedCount || 0) + 1 });
  await notify(acc.userId, "Free retry approved", `A new account (#${account.id}) is being prepared for your retry.`, "success");
  await audit(user, "offer_retry", account.id, "account", `Free retry for ${acc.id} via ${offer.name}`);
  return { account, order: newOrder, offer: { id: offer.id, name: offer.name }, retriesRemaining: remaining - 1 };
}
