import { db, eq } from "../db";
import { audit, notify, orderPlan, userMap } from "../core";
import { HttpError, body, hashPassword, isAdmin, numv, publicUser, rand, randDigits, requireAdmin, requireUser, str, type Ctx } from "../http";
import type { DBAffiliate, DBCollaborator, DBCollaboratorSale, DBOrder, DBReferral, DBUser } from "../types";

/* ---------------- affiliate (every trader) ---------------- */

export async function getAffiliate(ctx: Ctx) {
  const user = await requireUser(ctx);
  if (isAdmin(user)) {
    const [affiliates, referrals] = await Promise.all([
      db.select<DBAffiliate>("affiliates"),
      db.select<DBReferral>("referrals", {}, { order: "createdAt.desc" }),
    ]);
    const users = await userMap([...affiliates.map((a) => a.userId), ...referrals.flatMap((r) => [r.referredUserId, r.affiliateId])]);
    const codes = new Map(affiliates.map((a) => [a.userId, a.referralCode]));
    const orderIds = [...new Set(referrals.map((r) => r.orderId))];
    const orders = orderIds.length ? await db.select<DBOrder>("orders", { id: `in.(${orderIds.map((i) => `"${i}"`).join(",")})` }, { select: "id,amountPaid" }) : [];
    const paid = new Map(orders.map((o) => [o.id, o.amountPaid]));
    return {
      affiliates: affiliates.map((a) => ({ ...a, name: users.get(a.userId)?.name ?? "", email: users.get(a.userId)?.email ?? "" })),
      referrals: referrals.map((r) => ({
        ...r, referredName: users.get(r.referredUserId)?.name ?? "", referredEmail: users.get(r.referredUserId)?.email ?? "",
        affiliateName: users.get(r.affiliateId)?.name ?? "", referralCode: codes.get(r.affiliateId) ?? "", amountPaid: paid.get(r.orderId) ?? 0,
      })),
    };
  }

  let affiliate = await db.one<DBAffiliate>("affiliates", { userId: eq(user.id) });
  if (!affiliate) {
    const code = `${user.name.replace(/[^a-z]/gi, "").slice(0, 7).toUpperCase() || "TRADER"}${randDigits(3)}`;
    [affiliate] = (await db.insert<DBAffiliate>("affiliates", { userId: user.id, referralCode: code, commissionRate: 5 })) as [DBAffiliate];
  }
  const referrals = await db.select<DBReferral>("referrals", { affiliateId: eq(user.id) }, { order: "createdAt.desc" });
  const users = await userMap(referrals.map((r) => r.referredUserId));
  const rows = await Promise.all(referrals.map(async (r) => {
    const order = await db.one<DBOrder>("orders", { id: eq(r.orderId) });
    return {
      ...r, referredName: users.get(r.referredUserId)?.name ?? "", referredEmail: users.get(r.referredUserId)?.email ?? "",
      amountPaid: order?.amountPaid ?? 0, planName: order ? (await orderPlan(order)).planName : "",
    };
  }));
  const sum = (s?: string) => +referrals.filter((r) => !s || r.status === s).reduce((t, r) => t + Number(r.commissionAmount || 0), 0).toFixed(2);
  return {
    affiliate,
    metrics: { totalReferrals: new Set(referrals.map((r) => r.referredUserId)).size, totalEarned: sum(), pendingEarned: sum("pending"), paidEarned: sum("paid"), availableBalance: sum("approved") },
    referrals: rows,
  };
}

export async function updateAffiliate(ctx: Ctx) {
  const admin = await requireAdmin(ctx);
  const b = await body(ctx);
  if (b.action === "update_rate") {
    const rate = numv(b.commissionRate);
    if (rate < 0 || rate > 100) throw new HttpError(400, "commissionRate must be between 0 and 100.");
    const [affiliate] = await db.update<DBAffiliate>("affiliates", { userId: eq(str(b.affiliateUserId)) }, { commissionRate: rate });
    if (!affiliate) throw new HttpError(404, "Affiliate not found.");
    await audit(admin, "affiliate_rate", affiliate.userId, "affiliate", `Rate → ${rate}%`);
    return { affiliate };
  }
  if (b.action === "update_referral") {
    const status = str(b.status) as DBReferral["status"];
    if (!["pending", "approved", "paid"].includes(status)) throw new HttpError(400, "Invalid status.");
    const [referral] = await db.update<DBReferral>("referrals", { referredUserId: eq(str(b.referredUserId)), orderId: eq(str(b.orderId)) }, { status });
    if (!referral) throw new HttpError(404, "Referral not found.");
    if (status === "paid") await notify(referral.affiliateId, "Referral commission paid", `Your commission of $${referral.commissionAmount} has been paid.`, "success", "email");
    await audit(admin, "referral_status", referral.orderId, "referral", `Referral → ${status}`);
    return { referral };
  }
  throw new HttpError(400, "Unknown action.");
}

/* ---------------- collaborators (admin-created partners) ---------------- */

async function collaboratorStats(c: DBCollaborator) {
  const [sales, attributions] = await Promise.all([
    db.select<DBCollaboratorSale>("collaborator_sales", { collaboratorId: eq(c.userId) }, { order: "createdAt.desc" }),
    db.select("collaborator_attributions", { collaboratorId: eq(c.userId) }, { select: "referredUserId" }),
  ]);
  const total = (s?: string) => +sales.filter((x) => !s || x.status === s).reduce((t, x) => t + Number(x.commissionAmount || 0), 0).toFixed(2);
  return {
    sales,
    metrics: { registrations: attributions.length, totalSales: +sales.reduce((t, x) => t + Number(x.saleAmount || 0), 0).toFixed(2), commissions: total(), paidCommissions: total("paid") },
  };
}

export async function getCollaborators(ctx: Ctx) {
  const user = await requireUser(ctx);
  if (isAdmin(user)) {
    const collabs = await db.select<DBCollaborator>("collaborators");
    const users = await userMap(collabs.map((c) => c.userId));
    const rows = await Promise.all(collabs.map(async (c) => ({ ...c, name: users.get(c.userId)?.name ?? "", email: users.get(c.userId)?.email ?? "", ...(await collaboratorStats(c)) })));
    const buyers = await userMap(rows.flatMap((r) => r.sales.map((s) => s.referredUserId)));
    const sales = rows.flatMap((r) => r.sales.map((s) => ({ ...s, collaboratorName: r.name, referredName: buyers.get(s.referredUserId)?.name ?? "", referredEmail: buyers.get(s.referredUserId)?.email ?? "" })));
    return { collaborators: rows, sales };
  }
  if (user.role !== "collaborator") throw new HttpError(403, "Partner access only.");
  const collab = await db.one<DBCollaborator>("collaborators", { userId: eq(user.id) });
  if (!collab) throw new HttpError(404, "Partner profile not found.");
  return { collaborator: { ...collab, name: user.name, email: user.email }, ...(await collaboratorStats(collab)) };
}

export async function createCollaborator(ctx: Ctx) {
  const admin = await requireAdmin(ctx);
  const b = await body(ctx);
  const name = str(b.name), email = str(b.email).toLowerCase(), password = str(b.password);
  if (!name || !email || password.length < 8) throw new HttpError(400, "name, email and an 8+ character password are required.");
  if (await db.one("users", { email: eq(email) }, { select: "id" })) throw new HttpError(400, "A user with this email already exists.");
  const code = (str(b.referralCode) || `${name.replace(/[^a-z]/gi, "").slice(0, 6)}${randDigits(3)}`).toUpperCase();
  if (await db.one("collaborators", { referralCode: eq(code) }, { select: "userId" })) throw new HttpError(400, "This partner code is taken.");
  const [user] = await db.insert<DBUser>("users", {
    id: `u-col-${rand(6)}`, name, email, phone: "", country: "", passwordHash: await hashPassword(password),
    role: "collaborator", status: "active", createdAt: new Date().toISOString(), emailVerified: true,
  });
  const [collaborator] = await db.insert<DBCollaborator>("collaborators", { userId: user!.id, referralCode: code, commissionRate: 20, createdAt: new Date().toISOString() });
  await audit(admin, "collaborator_create", user!.id, "user", `Partner ${email} (${code})`);
  return { user: publicUser(user!), collaborator };
}

export async function setCollaboratorSale(ctx: Ctx) {
  const admin = await requireAdmin(ctx);
  const b = await body(ctx);
  const status = str(b.status);
  if (!["pending", "approved", "paid"].includes(status)) throw new HttpError(400, "Invalid status.");
  const rows = await db.update("collaborator_sales", { referredUserId: eq(str(b.referredUserId)), orderId: eq(str(b.orderId)) }, { status: status as DBCollaboratorSale["status"] });
  await audit(admin, "collaborator_sale", str(b.orderId), "order", `Partner sale → ${status}`);
  return { success: rows.length > 0 };
}
