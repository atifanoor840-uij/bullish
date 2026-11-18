/**
 * Rulebook + shared business logic: plans, stages, account creation and delivery,
 * order activation, referrals, collaborator sales, offers, notifications, audit log.
 */
import { db, eq, inList } from "./db";
import { env } from "./env";
import { rand, randDigits } from "./http";
import { smtpSend } from "./smtp";
import type {
  DBAccount, DBAffiliate, DBChallengePlan, DBCollaboratorSale, DBInventory, DBOffer, DBOrder, DBPricingPlan, DBReferral, DBUser,
} from "./types";

/* ====================================================================== rulebook */

export type Model = "Two Step" | "One Step" | "Instant" | "Flex";

export const RULES: Record<Model, { targets: number[]; daily: number; overall: number; minDays: number; isTrailing?: boolean }> = {
  "Two Step": { targets: [6, 5], daily: 4, overall: 6, minDays: 3 },
  "One Step": { targets: [9], daily: 4, overall: 6, minDays: 3 },
  Instant: { targets: [], daily: 3, overall: 6, minDays: 5 },
  Flex: { targets: [4], daily: 4, overall: 8, minDays: 0, isTrailing: true },
};
export const FUNDED_LIMITS: Record<Model, { daily: number; overall: number; minDays: number; isTrailing?: boolean }> = {
  "Two Step": { daily: 4, overall: 6, minDays: 5 },
  "One Step": { daily: 4, overall: 6, minDays: 5 },
  Instant: { daily: 3, overall: 6, minDays: 5 },
  Flex: { daily: 4, overall: 8, minDays: 5, isTrailing: true },
};
export const WEEKEND_ADDON_PERCENT = 20;
export const PROFIT_SPLIT_BY_WITHDRAWAL = [70, 80, 90, 100];
export const PAYOUT_CAP_PERCENT = 6;
export const PAYOUT_PERIOD_DAYS = 14;
export const PAYOUT_MIN = 100;

export const PHASE = { P1: "Phase 1 (Evaluation)", P2: "Phase 2 (Verification)", FUNDED: "Funded (Live)" } as const;
/** Placeholder server for not-yet-delivered accounts. The DB credential-uniqueness index excludes this exact value. */
export const PENDING_SERVER = "Range4ex-PendingServer";
export const PENDING_PASSWORD = "GENERATED_MASTER_PASS";

export function stagesFor(model: Model): string[] {
  if (model === "Instant") return [PHASE.FUNDED];
  if (model === "One Step" || model === "Flex") return [PHASE.P1, PHASE.FUNDED];
  return [PHASE.P1, PHASE.P2, PHASE.FUNDED];
}

export const orderStatusForPhase = (phase: string) =>
  phase === PHASE.FUNDED ? "Live Active" : phase === PHASE.P2 ? "Step2 Active" : "Active";

export function modelOf(text = ""): Model {
  const t = text.toLowerCase();
  if (t.includes("flex")) return "Flex";
  if (t.includes("instant")) return "Instant";
  if (t.includes("one") || t.includes("1-step") || t.includes("1 step")) return "One Step";
  return "Two Step";
}

export const sizeLabel = (size: number) => (size >= 1000 ? `$${+(size / 1000).toFixed(1)}K` : `$${size}`);

export function targetPercent(model: Model, phase: string) {
  if (phase === PHASE.FUNDED) return 0;
  return RULES[model].targets[phase === PHASE.P2 ? 1 : 0] ?? 0;
}

export function limitsFor(model: Model, phase: string) {
  return phase === PHASE.FUNDED ? (FUNDED_LIMITS[model] ?? FUNDED_LIMITS["Two Step"]) : (RULES[model] ?? RULES["Two Step"]);
}

/* ====================================================================== plans & orders */

const planCache = new Map<string, DBPricingPlan | null>();

export async function getPlan(planId: string): Promise<DBPricingPlan | null> {
  if (planCache.has(planId)) return planCache.get(planId)!;
  try {
    const plan = await db.one<DBPricingPlan>("pricing_plans", { id: eq(planId) });
    planCache.set(planId, plan);
    setTimeout(() => planCache.delete(planId), 60_000);
    return plan;
  } catch {
    return null;
  }
}

/**
 * orders."planId" has a legacy FK to challenge_plans(id), but the catalog lives in
 * pricing_plans. Mirror the pricing plan into challenge_plans (only if missing, so admin
 * edits there are never overwritten) before an order references it.
 */
export async function ensureLegacyPlan(plan: DBPricingPlan) {
  if (await db.one("challenge_plans", { id: eq(plan.id) }, { select: "id" })) return;
  const model = (plan.model in RULES ? plan.model : "Two Step") as Model;
  const r = RULES[model];
  try {
    await db.insert<DBChallengePlan>("challenge_plans", {
      id: plan.id, name: model, size: Number(plan.size), price: Number(plan.price),
      profitTargetP1: r.targets[0] ?? 0, profitTargetP2: r.targets[1] ?? 0,
      maxDailyLoss: r.daily, maxTotalLoss: r.overall, profitSplit: PROFIT_SPLIT_BY_WITHDRAWAL[0] ?? 70,
    });
  } catch (e) {
    // A concurrent order may have inserted it first — that's fine.
    if (!(await db.one("challenge_plans", { id: eq(plan.id) }, { select: "id" }))) throw e;
  }
}

export async function orderPlan(order: Pick<DBOrder, "planId">) {
  const plan = await getPlan(order.planId);
  const model = plan?.model ?? modelOf(order.planId);
  const size = plan?.size ?? Number(order.planId.match(/(\d+(?:\.\d+)?)k$/i)?.[1] ?? 0) * 1000;
  return { model, size, planName: `${model} ${sizeLabel(size)}` };
}

export async function withPlanNames<T extends DBOrder>(orders: T[]) {
  return Promise.all(orders.map(async (o) => ({ ...o, planName: (await orderPlan(o)).planName })));
}

/** Platform chosen at checkout is stored in gatewayRef for gateways that pass it through; default MT5. */
export function orderPlatform(order: DBOrder): string {
  const m = order.gatewayRef?.match(/platform=(MT4|MT5|cTrader)/);
  return m?.[1] ?? "MT5";
}

export const newOrderId = () => `o-${randDigits(6)}`;

export async function userMap(ids: string[]) {
  const unique = [...new Set(ids.filter(Boolean))];
  const map = new Map<string, DBUser>();
  for (let i = 0; i < unique.length; i += 150) {
    const rows = await db.select<DBUser>("users", { id: inList(unique.slice(i, i + 150)) }, { select: "id,name,email" });
    rows.forEach((u) => map.set(u.id, u));
  }
  return map;
}

/** Adds userName / userEmail to admin listings. */
export async function withUserNames<T extends { userId: string }>(rows: T[]) {
  const users = await userMap(rows.map((r) => r.userId));
  return rows.map((r) => ({ ...r, userName: users.get(r.userId)?.name ?? "", userEmail: users.get(r.userId)?.email ?? "" }));
}

/* ====================================================================== notifications & audit */

/** Sends via Resend when RESEND_API_KEY is set, otherwise (or if Resend fails) via SMTP. */
export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  if (!to) return false;
  const { apiKey, from } = env.resend;
  if (apiKey) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from, to, subject, html }),
      });
      if (res.ok) return true;
      console.error("[email] Resend send failed:", res.status, await res.text().catch(() => ""));
    } catch (e) {
      console.error("[email] Resend send failed:", e instanceof Error ? e.message : e);
    }
  }
  const smtp = env.smtp;
  if (smtp.user && smtp.pass) {
    try {
      await smtpSend(smtp, { from: smtp.from, to, subject, html });
      return true;
    } catch (e) {
      console.error("[email] SMTP send failed:", e instanceof Error ? e.message : e);
    }
  }
  return false;
}

export type EmailOptions = {
  /** Primary button under the message. */
  cta?: { label: string; url: string };
  /** Label/value rows shown in a summary box (e.g. order details). */
  details?: [string, string][];
};

/** Branded HTML email in the site's dark theme (table layout for broad email-client support). */
export function emailHtml(title: string, message: string, opts: EmailOptions = {}) {
  const site = (env.appUrl || "https://www.bullish4ex.site").replace(/\/$/, "");
  const siteLabel = site.replace(/^https?:\/\/(www\.)?/, "");
  const font = "Inter,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
  const details = opts.details?.length
    ? `<tr><td style="padding:0 32px 8px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#09090b;border:1px solid #27272a;border-radius:10px">
          ${opts.details
            .map(([k, v], i) => `<tr><td style="padding:12px 16px;${i ? "border-top:1px solid #27272a;" : ""}color:#a1a1aa;font:13px ${font}">${k}</td>
              <td align="right" style="padding:12px 16px;${i ? "border-top:1px solid #27272a;" : ""}color:#f4f4f5;font:600 13px ${font}">${v}</td></tr>`)
            .join("")}
        </table></td></tr>`
    : "";
  const cta = opts.cta
    ? `<tr><td style="padding:16px 32px 8px">
        <a href="${opts.cta.url}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font:600 14px ${font};padding:13px 26px;border-radius:8px">${opts.cta.label}</a>
      </td></tr>
      <tr><td style="padding:8px 32px 0;color:#71717a;font:12px/1.6 ${font}">If the button doesn't work, open this link:<br><a href="${opts.cta.url}" style="color:#2563eb;word-break:break-all">${opts.cta.url}</a></td></tr>`
    : "";
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><title>${title}</title></head>
<body style="margin:0;padding:0;background:#09090b">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#09090b">
  <tr><td align="center" style="padding:32px 16px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">
      <tr><td style="padding:0 4px 20px">
        <a href="${site}" style="text-decoration:none;color:#f4f4f5;font:800 18px ${font};letter-spacing:-.02em">
          <img src="${site}/email-logo.png" width="17" height="25" alt="" style="vertical-align:middle;border:0;margin-right:8px">BULLISH<span style="color:#2563eb">4</span>EX
        </a>
      </td></tr>
      <tr><td style="background:#121215;border:1px solid #27272a;border-radius:14px;overflow:hidden">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr><td style="height:4px;background:#2563eb;line-height:4px;font-size:0">&nbsp;</td></tr>
          <tr><td style="padding:28px 32px 8px;color:#f4f4f5;font:700 22px/1.3 ${font};letter-spacing:-.01em">${title}</td></tr>
          <tr><td style="padding:4px 32px 16px;color:#a1a1aa;font:14px/1.7 ${font};white-space:pre-line">${message}</td></tr>
          ${details}
          ${cta}
          <tr><td style="padding:28px 32px 0"><div style="border-top:1px solid #27272a"></div></td></tr>
          <tr><td style="padding:16px 32px 28px;color:#71717a;font:12px/1.6 ${font}">Need help? Just reply to this email or contact <a href="mailto:support@bullish4ex.site" style="color:#2563eb;text-decoration:none">support@bullish4ex.site</a>.</td></tr>
        </table>
      </td></tr>
      <tr><td align="center" style="padding:20px 8px 0;color:#52525b;font:11px/1.6 ${font}">© ${new Date().getFullYear()} Bullish 4ex · <a href="${site}" style="color:#52525b">${siteLabel}</a></td></tr>
    </table>
  </td></tr>
</table></body></html>`;
}

export async function notify(
  userId: string,
  title: string,
  message: string,
  type: "info" | "success" | "warning" | "error" = "info",
  channel: "in_app" | "email" = "in_app",
  email?: string,
  emailOptions?: EmailOptions,
) {
  let status: "sent" | "failed" = "sent";
  if (channel === "email") {
    const to = email ?? (await db.one<DBUser>("users", { id: eq(userId) }, { select: "email" }))?.email ?? "";
    status = (await sendEmail(to, title, emailHtml(title, message, emailOptions))) ? "sent" : "failed";
  }
  await db
    .insert("notifications", { id: `notif-${rand(9)}`, userId, title, message, type, channel, status, read: false, sentAt: new Date().toISOString() })
    .catch(() => {});
  return status;
}

export async function audit(actor: Pick<DBUser, "id" | "name"> | null, action: string, targetId: string, targetType: string, description: string) {
  await db
    .insert("audit_logs", {
      id: `log-${rand(9)}`, userId: actor?.id ?? "system", userName: actor?.name ?? "System",
      targetId, targetType, action, description, createdAt: new Date().toISOString(),
    })
    .catch(() => {});
}

/* ====================================================================== accounts */

async function newAccountId() {
  for (let i = 0; i < 8; i++) {
    const id = String(100000 + (Number(randDigits(6)) % 900000));
    if (!(await db.one("trading_accounts", { id: eq(id) }, { select: "id" }))) return id;
  }
  return `${Date.now()}`.slice(-8);
}

/** True when these real credentials already sit on another delivered account. */
export async function credentialsTaken(platform: string, server: string, login: string, exceptId?: string) {
  const rows = await db.select<DBAccount>(
    "trading_accounts",
    { platform: eq(platform), server: eq(server), login: eq(login), deliveryStatus: eq("delivered") },
    { select: "id" },
  );
  return rows.some((r) => r.id !== exceptId);
}

/** Claims the oldest available inventory credential of this platform + size (atomic per row). */
async function reserveInventory(platform: string, size: number, orderId: string): Promise<DBInventory | null> {
  const candidates = await db.select<DBInventory>(
    "challenge_inventory",
    { platform: eq(platform), size: eq(size), status: eq("available") },
    { order: "createdAt.asc", limit: 10 },
  );
  for (const inv of candidates) {
    if (await credentialsTaken(inv.platform, inv.server, inv.login)) continue;
    const [claimed] = await db.update<DBInventory>("challenge_inventory", { id: eq(inv.id), status: eq("available") }, { status: "delivered", orderId });
    if (claimed) return claimed;
  }
  return null;
}

export async function releaseInventory(account: Pick<DBAccount, "platform" | "server" | "login">) {
  if (!account.login || account.server === PENDING_SERVER) return;
  await db
    .update("challenge_inventory", { platform: eq(account.platform), server: eq(account.server), login: eq(account.login) }, { status: "available", orderId: null })
    .catch(() => {});
}

/**
 * Creates the account for one stage of an order. Delivered instantly from inventory when a matching
 * credential is available, otherwise saved as pending for the admin delivery desk.
 */
export async function createStageAccount(order: DBOrder, phase: string, platform = orderPlatform(order)): Promise<DBAccount> {
  const { model, size } = await orderPlan(order);
  const now = new Date().toISOString();
  const inv = await reserveInventory(platform, size, order.id);
  const base: DBAccount = {
    id: await newAccountId(), userId: order.userId, orderId: order.id, platform,
    login: "", passwordMaster: PENDING_PASSWORD, passwordInvestor: "", server: PENDING_SERVER,
    profitTarget: (size * targetPercent(model, phase)) / 100, balance: size, equity: size, todayPl: 0, totalPl: 0,
    status: phase === PHASE.FUNDED ? "Funded" : "Active", phase, graphLink: "", deliveryStatus: "pending", deliveredAt: null,
    createdAt: now, externalStatisticsId: null, statisticsPayload: null, statisticsUpdatedAt: null,
    weekendHoldingAddon: !!order.weekendHoldingAddon,
  };
  if (inv) {
    const delivered = {
      ...base, login: inv.login, passwordMaster: inv.password, server: inv.server, graphLink: inv.graphLink ?? "",
      externalStatisticsId: inv.externalStatisticsId ?? null, deliveryStatus: "delivered" as const, deliveredAt: now,
    };
    try {
      const [acc] = await db.insert<DBAccount>("trading_accounts", delivered);
      return acc!;
    } catch {
      await db.update("challenge_inventory", { id: eq(inv.id) }, { status: "available", orderId: null }).catch(() => {});
    }
  }
  const [acc] = await db.insert<DBAccount>("trading_accounts", base);
  return acc!;
}

export async function accountsOfOrder(orderId: string) {
  return db.select<DBAccount>("trading_accounts", { orderId: eq(orderId) }, { order: "createdAt.asc" });
}

export async function credentialsMessage(acc: DBAccount) {
  return acc.deliveryStatus === "delivered"
    ? `Your ${acc.phase} account is ready.\nPlatform: ${acc.platform}\nLogin: ${acc.login}\nPassword: ${acc.passwordMaster}\nServer: ${acc.server}`
    : `Your ${acc.phase} account is being prepared. Credentials will be emailed to you shortly.`;
}

/** Creates the next stage after `account` passed. Returns null when the order is already at its last stage. */
export async function createNextStage(account: DBAccount, order: DBOrder) {
  const { model } = await orderPlan(order);
  const stages = stagesFor(model);
  const next = stages[stages.indexOf(account.phase) + 1];
  if (!next) return null;
  const existing = (await accountsOfOrder(order.id)).find((a) => a.phase === next);
  if (existing) return existing;
  const acc = await createStageAccount(order, next, account.platform);
  await db.update("orders", { id: eq(order.id) }, { status: orderStatusForPhase(next), updatedAt: new Date().toISOString() });
  await notify(order.userId, `${next} account created`, await credentialsMessage(acc), "success", "email");
  return acc;
}

/* ====================================================================== payments & activation */

/**
 * Runs after money is confirmed (gateway webhook) or an admin activates an order.
 * Idempotent: never creates a second first-stage account.
 */
export async function activateOrder(order: DBOrder, opts: { status: string; gatewayRef?: string; actor?: DBUser | null }) {
  const { model, planName } = await orderPlan(order);
  const firstPhase = stagesFor(model)[0]!;
  const accounts = await accountsOfOrder(order.id);
  const patch: Partial<DBOrder> = { status: opts.status, updatedAt: new Date().toISOString() };
  if (opts.gatewayRef) patch.gatewayRef = opts.gatewayRef;
  const [updated] = await db.update<DBOrder>("orders", { id: eq(order.id) }, patch);
  const current = updated ?? { ...order, ...patch };

  let account = accounts.find((a) => a.phase === firstPhase) ?? null;
  if (!account) {
    account = await createStageAccount(current, firstPhase);
    await notify(order.userId, account.deliveryStatus === "delivered" ? "Account delivered" : "Payment received", await credentialsMessage(account), "success", "email");
    await grantBogo(current, planName);
    await recordCollaboratorSale(current);
    await settleReferrals(current);
  }
  await audit(opts.actor ?? null, "order_activate", order.id, "order", `Order ${order.id} → ${opts.status}`);
  return { order: current, account };
}

async function recordCollaboratorSale(order: DBOrder) {
  const attr = await db.one<{ collaboratorId: string }>("collaborator_attributions", { referredUserId: eq(order.userId) });
  if (!attr || !(order.amountPaid > 0)) return;
  const exists = await db.one("collaborator_sales", { orderId: eq(order.id) }, { select: "orderId" });
  if (exists) return;
  const collab = await db.one<{ commissionRate: number }>("collaborators", { userId: eq(attr.collaboratorId) });
  const rate = collab?.commissionRate ?? 20;
  await db
    .insert<DBCollaboratorSale>("collaborator_sales", {
      referredUserId: order.userId, collaboratorId: attr.collaboratorId, orderId: order.id, saleAmount: order.amountPaid,
      commissionAmount: +((order.amountPaid * rate) / 100).toFixed(2), status: "approved", createdAt: new Date().toISOString(),
    })
    .catch(() => {});
}

async function settleReferrals(order: DBOrder) {
  // Spend the buyer's own approved commissions used as checkout balance.
  let toSpend = Number(order.referralBalanceApplied || 0);
  if (toSpend > 0) {
    const own = await db.select<DBReferral>("referrals", { affiliateId: eq(order.userId), status: eq("approved") }, { order: "createdAt.asc" });
    for (const r of own) {
      if (toSpend <= 0) break;
      await db.update("referrals", { referredUserId: eq(r.referredUserId), orderId: eq(r.orderId) }, { status: "paid" });
      toSpend -= r.commissionAmount;
    }
  }
  // Commission for whoever referred this buyer.
  const pending = await db.one<DBReferral>("referrals", { orderId: eq(order.id) });
  if (pending) {
    if (pending.status === "pending") await db.update("referrals", { orderId: eq(order.id) }, { status: "approved" });
    return;
  }
  const buyer = await db.one<DBUser>("users", { id: eq(order.userId) }, { select: "id,referredBy" });
  if (!buyer?.referredBy || !(order.amountPaid > 0)) return;
  const aff = await db.one<DBAffiliate>("affiliates", { referralCode: eq(buyer.referredBy) });
  const affiliateId = aff?.userId ?? buyer.referredBy;
  if (affiliateId === order.userId) return;
  await db
    .insert<DBReferral>("referrals", {
      referredUserId: order.userId, affiliateId, orderId: order.id, commissionAmount: +(order.amountPaid * 0.05).toFixed(2),
      status: "approved", createdAt: new Date().toISOString(),
    })
    .catch(() => {});
  await notify(affiliateId, "Referral commission earned", `You earned a commission from order ${order.id}.`, "success");
}

/* ====================================================================== offers */

export function offerLive(o: DBOffer, now = Date.now()) {
  if (o.status !== "active") return false;
  if (o.startsAt && new Date(o.startsAt).getTime() > now) return false;
  if (o.expiresAt && new Date(o.expiresAt).getTime() < now) return false;
  return !o.maxRedemptions || o.redeemedCount < o.maxRedemptions;
}

export function offerCovers(o: DBOffer, scope: { userId: string; accountId?: string; size: number; model: string }) {
  const arr = (a: unknown) => (Array.isArray(a) ? a : []);
  return (
    (!arr(o.userIds).length || arr(o.userIds).includes(scope.userId)) &&
    (!arr(o.accountIds).length || (!!scope.accountId && arr(o.accountIds).includes(scope.accountId))) &&
    (!arr(o.accountSizes).length || arr(o.accountSizes).map(Number).includes(scope.size)) &&
    (!arr(o.models).length || arr(o.models).includes(scope.model))
  );
}

export function decorateOffer(o: DBOffer) {
  const now = Date.now();
  return {
    ...o,
    accountSizes: o.accountSizes ?? [], models: o.models ?? [], userIds: o.userIds ?? [], accountIds: o.accountIds ?? [],
    isExpired: !!o.expiresAt && new Date(o.expiresAt).getTime() < now,
    isScheduled: !!o.startsAt && new Date(o.startsAt).getTime() > now,
  };
}

async function grantBogo(order: DBOrder, planName: string) {
  if (order.paymentMethod === "offer_bogo" || order.paymentMethod === "free_retry") return;
  const { model, size } = await orderPlan(order);
  const offers = (await db.select<DBOffer>("offers", { type: eq("bogo"), status: eq("active") })).filter(
    (o) => offerLive(o) && offerCovers(o, { userId: order.userId, size, model }),
  );
  for (const offer of offers) {
    for (let i = 0; i < Math.max(1, offer.freeQuantity || 1); i++) {
      const now = new Date().toISOString();
      const [free] = await db.insert<DBOrder>("orders", {
        id: `ord-bogo-${rand(6)}`, userId: order.userId, planId: order.planId, couponUsed: "", amountPaid: 0,
        paymentMethod: "offer_bogo", status: "Active", gatewayRef: `offer:${offer.id}:from:${order.id}`, createdAt: now, updatedAt: now,
      });
      if (!free) continue;
      const acc = await createStageAccount(free, stagesFor(model)[0]!, orderPlatform(order));
      await db.insert("offer_redemptions", {
        id: `red-${rand(9)}`, offerId: offer.id, userId: order.userId, type: "bogo", sourceAccountId: null,
        newAccountId: acc.id, orderId: free.id, status: "granted", createdAt: now,
      }).catch(() => {});
    }
    await db.update("offers", { id: eq(offer.id) }, { redeemedCount: (offer.redeemedCount || 0) + 1 });
    await notify(order.userId, `${offer.name} unlocked`, `You received a free ${planName} account with your order.`, "success");
  }
}
