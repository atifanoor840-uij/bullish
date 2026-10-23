import { PROOF_BUCKET, db, eq, signedUrl, uploadObject } from "../db";
import { env } from "../env";
import {
  PHASE, WEEKEND_ADDON_PERCENT, accountsOfOrder, activateOrder, audit, createNextStage, createStageAccount, newOrderId, notify,
  orderPlan, orderStatusForPhase, releaseInventory, stagesFor, withPlanNames, withUserNames,
} from "../core";
import { HttpError, body, hmacHex, isAdmin, json, numv, query, requireAdmin, requireUser, safeEqual, str, type Ctx } from "../http";
import { couponExpired } from "./catalog";
import type { DBAccount, DBAffiliate, DBCoupon, DBOrder, DBPricingPlan, DBReferral } from "../types";

export async function listOrders(ctx: Ctx) {
  const user = await requireUser(ctx);
  const orders = isAdmin(user)
    ? await withUserNames(await db.select<DBOrder>("orders", {}, { order: "createdAt.desc" }))
    : await db.select<DBOrder>("orders", { userId: eq(user.id) }, { order: "createdAt.desc" });
  return { orders: await withPlanNames(orders) };
}

/** Approved, unspent referral commissions of this user = spendable checkout balance. */
export async function referralBalance(userId: string) {
  const rows = await db.select<DBReferral>("referrals", { affiliateId: eq(userId), status: eq("approved") });
  return +rows.reduce((s, r) => s + Number(r.commissionAmount || 0), 0).toFixed(2);
}

export async function createOrder(ctx: Ctx) {
  const user = await requireUser(ctx);
  const b = await body(ctx);
  const planId = str(b.planId), paymentMethod = str(b.paymentMethod) || "Paddle";
  const plan = await db.one<DBPricingPlan>("pricing_plans", { id: eq(planId) });
  if (!plan) throw new HttpError(404, "Plan not found.");
  if (plan.status !== "active") throw new HttpError(400, "This plan is not available in the pricing catalog.");
  if (paymentMethod.toLowerCase().includes("paddle") && (ctx.req.headers.get("cf-ipcountry") || "").toUpperCase() === "PK") {
    throw new HttpError(403, "Card payments are not available in your country. Please pay with crypto.");
  }

  const weekend = !!b.weekendHoldingAddon;
  let base = Number(plan.price) * (weekend ? 1 + WEEKEND_ADDON_PERCENT / 100 : 1);
  const code = str(b.couponUsed).toUpperCase();
  let discount = 0;
  let affiliate: DBAffiliate | null = null;
  if (code) {
    const coupon = await db.one<DBCoupon>("coupons", { code: eq(code) });
    if (coupon && coupon.status === "active" && !couponExpired(coupon)) discount = Number(coupon.discountPercent);
    else {
      affiliate = await db.one<DBAffiliate>("affiliates", { referralCode: eq(code) });
      if (affiliate && affiliate.userId !== user.id) discount = 10;
      else throw new HttpError(400, "This coupon code is invalid or expired.");
    }
  }
  const isCrypto = paymentMethod.toLowerCase().includes("crypto");
  const pct = discount + (isCrypto ? 5 : 0);
  const final = Math.ceil(base - base * (pct / 100));
  const referral = b.useReferralBalance ? Math.min(final, await referralBalance(user.id)) : 0;
  const amount = +(final - referral).toFixed(2);
  if (b.expectedAmount !== undefined && Math.abs(numv(b.expectedAmount) - amount) > 0.01) {
    throw new HttpError(409, "The price changed. Please review the new total.", { code: "PRICE_CHANGED", amount });
  }

  const now = new Date().toISOString();
  const [order] = await db.insert<DBOrder>("orders", {
    id: newOrderId(), userId: user.id, planId, couponUsed: code, amountPaid: amount, paymentMethod, status: "Pending",
    gatewayRef: "", createdAt: now, updatedAt: now, referralBalanceApplied: referral, weekendHoldingAddon: weekend, legacyRules: false,
  });
  if (!order) throw new HttpError(500, "Could not create the order.");
  if (affiliate && affiliate.userId !== user.id) {
    base = Number(plan.price) * (weekend ? 1 + WEEKEND_ADDON_PERCENT / 100 : 1);
    await db.insert("referrals", {
      referredUserId: user.id, affiliateId: affiliate.userId, orderId: order.id,
      commissionAmount: +((base * 0.9 * Number(affiliate.commissionRate || 10)) / 100).toFixed(2), status: "pending", createdAt: now,
    }).catch(() => {});
  }
  const { planName } = await orderPlan(order);
  await notify(user.id, "Order created", `Order ${order.id} for ${planName} ($${amount}) is awaiting payment.`, "info");
  return { order: { ...order, planName } };
}

export async function updateOrder(ctx: Ctx) {
  const admin = await requireAdmin(ctx);
  const b = await body(ctx);
  const order = await db.one<DBOrder>("orders", { id: eq(str(b.orderId)) });
  if (!order) throw new HttpError(404, "Order not found.");

  if (b.status === undefined && typeof b.legacyRules === "boolean") {
    const [o] = await db.update<DBOrder>("orders", { id: eq(order.id) }, { legacyRules: b.legacyRules, updatedAt: new Date().toISOString() });
    await audit(admin, "order_rulebook", order.id, "order", `Legacy rules ${b.legacyRules ? "on" : "off"}`);
    return { order: o };
  }

  const status = str(b.status);
  if (!status) throw new HttpError(400, "status is required.");
  const { model } = await orderPlan(order);
  const stages = stagesFor(model);
  const accounts = await accountsOfOrder(order.id);
  const latest = accounts.at(-1);
  const now = new Date().toISOString();
  const setStatus = async (s: string) => (await db.update<DBOrder>("orders", { id: eq(order.id) }, { status: s, updatedAt: now }))[0];

  let result: DBOrder | undefined;
  if (status === "Active" || status.toLowerCase() === "paid") {
    result = (await activateOrder(order, { status: status.toLowerCase() === "paid" ? "Paid" : "Active", actor: admin })).order;
  } else if (status === "Step2 Active" || status === "Live Active") {
    const phase = status === "Step2 Active" ? PHASE.P2 : PHASE.FUNDED;
    if (!stages.includes(phase)) throw new HttpError(400, `${model} plans have no ${phase} stage.`);
    if (!accounts.some((a) => a.phase === phase)) {
      const acc = await createStageAccount(order, phase, latest?.platform);
      await notify(order.userId, `${phase} account created`, `Your ${phase} account #${acc.id} is being prepared.`, "success");
    }
    result = await setStatus(status);
  } else if (status === "Failed") {
    if (latest) await db.update("trading_accounts", { id: eq(latest.id) }, { status: "Failed" });
    result = await setStatus("Failed");
    await notify(order.userId, "Challenge failed", `Your account${latest ? ` #${latest.id}` : ""} has been marked as failed.`, "error", "email");
  } else if (status === "Passed") {
    if (!latest) throw new HttpError(400, "This order has no account yet.");
    await db.update("trading_accounts", { id: eq(latest.id) }, { status: "Passed" });
    const next = await createNextStage({ ...latest, status: "Passed" }, order);
    result = next ? (await db.one<DBOrder>("orders", { id: eq(order.id) }))! : await setStatus("Passed");
  } else if (status === "Replaced") {
    if (latest) {
      const { size } = await orderPlan(order);
      await db.update("trading_accounts", { id: eq(latest.id) }, { status: latest.phase === PHASE.FUNDED ? "Funded" : "Active", balance: size, equity: size, todayPl: 0, totalPl: 0 });
    }
    result = await setStatus(latest ? orderStatusForPhase(latest.phase) : "Active");
  } else {
    result = await setStatus(status);
  }
  await audit(admin, "order_status", order.id, "order", `Order ${order.id}: ${order.status} → ${status}`);
  return { order: result };
}

export async function deleteOrder(ctx: Ctx) {
  const admin = await requireAdmin(ctx);
  const id = query(ctx, "id");
  const order = await db.one<DBOrder>("orders", { id: eq(id) });
  if (!order) throw new HttpError(404, "Order not found.");
  const accounts = await accountsOfOrder(id);
  for (const a of accounts) await releaseInventory(a);
  await db.remove("trading_accounts", { orderId: eq(id) });
  await db.remove("orders", { id: eq(id) });
  await audit(admin, "order_delete", id, "order", `Deleted order ${id} and ${accounts.length} account(s)`);
  return { removedAccounts: accounts.length };
}

/* ---------------- payments ---------------- */

const paddleBase = () => (env.paddle.sandbox ? "https://sandbox-api.paddle.com" : "https://api.paddle.com");

export async function payOrder(ctx: Ctx) {
  const user = await requireUser(ctx);
  const b = await body(ctx);
  const order = await db.one<DBOrder>("orders", { id: eq(str(b.orderId)) });
  if (!order || order.userId !== user.id) throw new HttpError(404, "Order not found.");
  if (order.status !== "Pending") throw new HttpError(400, "This order is not awaiting payment.");
  const platform = ["MT4", "MT5", "cTrader"].includes(str(b.platform)) ? str(b.platform) : "MT5";
  const method = order.paymentMethod.toLowerCase();
  if (method.includes("crypto qr")) throw new HttpError(400, "Submit your crypto payment proof instead.");
  if (!method.includes("paddle")) throw new HttpError(503, `${order.paymentMethod} payments are not available. Please choose card (Paddle) or Crypto QR.`);
  if (!env.paddle.apiKey) throw new HttpError(503, "Card payments are not configured yet (PADDLE_API_KEY).");

  const { planName } = await orderPlan(order);
  const res = await fetch(`${paddleBase()}/transactions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.paddle.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      items: [{
        quantity: 1,
        price: {
          description: `${planName} challenge`, name: planName,
          unit_price: { amount: String(Math.round(order.amountPaid * 100)), currency_code: "USD" },
          product: { name: `Bullish 4ex ${planName}`, tax_category: "standard" },
        },
      }],
      custom_data: { orderId: order.id, userId: user.id, platform },
    }),
  });
  const data = (await res.json().catch(() => ({}))) as { data?: { id: string; checkout?: { url?: string } }; error?: { detail?: string } };
  const url = data.data?.checkout?.url;
  if (!res.ok || !data.data || !url) throw new HttpError(502, data.error?.detail || "Could not start the card checkout. Make sure a default payment link is set in Paddle.");
  const gatewayRef = `paddle:${data.data.id}:platform=${platform}`;
  await db.update("orders", { id: eq(order.id) }, { gatewayRef, updatedAt: new Date().toISOString() });
  return { provider: "paddle", checkoutUrl: url, gatewayRef };
}

export async function paddleWebhook(ctx: Ctx) {
  const raw = await ctx.req.text();
  const secret = env.paddle.webhookSecret;
  if (!secret) return json({ error: "Webhook secret not configured." }, 503);
  const sig = Object.fromEntries((ctx.req.headers.get("paddle-signature") || "").split(";").map((p) => p.split("=") as [string, string]));
  const ts = sig["ts"], h1 = sig["h1"];
  if (!ts || !h1 || !safeEqual(h1, await hmacHex(secret, `${ts}:${raw}`))) return json({ error: "Invalid signature." }, 401);

  const event = JSON.parse(raw) as { event_type?: string; data?: { id?: string; custom_data?: { orderId?: string; platform?: string } } };
  if (event.event_type !== "transaction.completed") return json({ success: true, ignored: true });
  const orderId = event.data?.custom_data?.orderId;
  const order = orderId ? await db.one<DBOrder>("orders", { id: eq(orderId) }) : null;
  if (!order) return json({ success: true, ignored: "order not found" });
  if (order.status !== "Pending") return json({ success: true, alreadyProcessed: true });
  const platform = event.data?.custom_data?.platform || "MT5";
  await activateOrder(order, { status: "Paid", gatewayRef: `paddle:${event.data?.id}:platform=${platform}` });
  return json({ success: true });
}

/* ---------------- manual crypto (Crypto QR) ---------------- */

const TXID_RULES: Record<string, RegExp> = {
  USDT_TRC20: /^[a-fA-F0-9]{64}$/,
  BTC: /^[a-fA-F0-9]{64}$/,
  USDT_BEP20: /^0x[a-fA-F0-9]{64}$/,
  USDT_ERC20: /^0x[a-fA-F0-9]{64}$/,
  USDT_POLYGON: /^0x[a-fA-F0-9]{64}$/,
  SOL: /^[1-9A-HJ-NP-Za-km-z]{64,90}$/,
};
const IMAGE_TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

export async function submitManualPayment(ctx: Ctx) {
  const user = await requireUser(ctx);
  const form = await ctx.req.formData().catch(() => null);
  if (!form) throw new HttpError(400, "Expected multipart form data.");
  const orderId = str(form.get("orderId")), walletId = str(form.get("walletId")), txid = str(form.get("txid"));
  const file = form.get("screenshot");
  const order = await db.one<DBOrder>("orders", { id: eq(orderId) });
  if (!order || order.userId !== user.id) throw new HttpError(404, "Order not found.");
  if (order.status !== "Pending") throw new HttpError(400, "This order is not awaiting payment.");
  const rule = TXID_RULES[walletId];
  if (!rule) throw new HttpError(400, "Unknown wallet.");
  if (!rule.test(txid)) throw new HttpError(400, "This transaction ID does not look valid for the selected network.");
  if (!(file instanceof Blob) || !IMAGE_TYPES[file.type]) throw new HttpError(400, "Upload a PNG, JPG or WEBP screenshot.");
  if (file.size > 5 * 1024 * 1024) throw new HttpError(400, "Screenshot must be 5 MB or smaller.");
  const reused = await db.select<DBOrder>("orders", { gatewayRef: `like.manual:*:${txid}:*` }, { select: "id" });
  if (reused.some((o) => o.id !== order.id)) throw new HttpError(409, "This transaction ID was already used for another order.");

  const path = `${order.id}/${Date.now()}.${IMAGE_TYPES[file.type]}`;
  await uploadObject(PROOF_BUCKET, path, file, file.type);
  const [updated] = await db.update<DBOrder>("orders", { id: eq(order.id) }, { gatewayRef: `manual:${walletId}:${txid}:${path}`, updatedAt: new Date().toISOString() });
  await notify(user.id, "Payment proof received", `We received your payment proof for order ${order.id}. Your account will be activated after confirmation.`, "info");
  return { order: updated };
}

export async function viewManualPayment(ctx: Ctx) {
  await requireAdmin(ctx, true);
  const order = await db.one<DBOrder>("orders", { id: eq(query(ctx, "orderId")) });
  if (!order?.gatewayRef?.startsWith("manual:")) throw new HttpError(404, "No payment proof for this order.");
  const [, walletId = "", txid = "", ...rest] = order.gatewayRef.split(":");
  const proofPath = rest.join(":");
  return { url: await signedUrl(PROOF_BUCKET, proofPath), walletId, txid, proofPath };
}

/** Used by the account desk: delivering the first account of a still-pending order activates it. */
export async function ensureOrderActive(order: DBOrder, account: DBAccount) {
  if (order.status === "Pending" || order.status === "Paid") {
    await db.update("orders", { id: eq(order.id) }, { status: orderStatusForPhase(account.phase), updatedAt: new Date().toISOString() });
  }
}
