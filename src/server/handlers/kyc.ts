import { db, eq } from "../db";
import { env } from "../env";
import { PHASE, audit, notify, withUserNames } from "../core";
import { HttpError, body, hmacHex, isStaff, json, publicUser, query, rand, requireAdmin, requireUser, safeEqual, str, type Ctx } from "../http";
import type { DBAccount, DBKyc, DBUser } from "../types";

const DIDIT_BASE = "https://verification.didit.me/v2";

/** KYC unlocks once the user holds a delivered, non-failed funded account. */
async function isEligible(userId: string) {
  const accounts = await db.select<DBAccount>("trading_accounts", { userId: eq(userId), deliveryStatus: eq("delivered") }, { select: "status,phase" });
  return accounts.some((a) => a.status !== "Failed" && (a.status === "Funded" || a.phase === PHASE.FUNDED));
}

const mapDidit = (s = ""): DBKyc["status"] =>
  s === "Approved" ? "approved" : ["Declined", "Expired", "Abandoned", "KYC Expired"].includes(s) ? "rejected" : "pending";

async function saveKyc(userId: string, patch: Partial<DBKyc>) {
  const [kyc] = await db.upsert<DBKyc>("kyc", {
    userId, documentType: "didit", frontUrl: "", backUrl: "", selfieUrl: "", addressUrl: "", status: "pending",
    ...((await db.one<DBKyc>("kyc", { userId: eq(userId) })) ?? {}), ...patch, updatedAt: new Date().toISOString(),
  }, "userId");
  return kyc!;
}

export async function getKyc(ctx: Ctx) {
  const user = await requireUser(ctx);
  if (isStaff(user)) {
    const userId = query(ctx, "userId");
    if (userId) return { kyc: await db.one<DBKyc>("kyc", { userId: eq(userId) }) };
    const kyc = await withUserNames(await db.select<DBKyc>("kyc", {}, { order: "updatedAt.desc" }));
    const users = await db.select<DBUser>("users", { id: `in.(${kyc.map((k) => `"${k.userId}"`).join(",") || '""'})` });
    return { kyc, users: users.map(publicUser) };
  }
  return { kyc: (await db.one<DBKyc>("kyc", { userId: eq(user.id) })) ?? undefined, isEligible: await isEligible(user.id) };
}

export async function postKyc(ctx: Ctx) {
  const user = await requireUser(ctx);
  const b = await body(ctx);
  const method = str(b.method);
  const { apiKey, workflowId, callbackUrl } = env.didit;
  const simulated = !apiKey || !workflowId;

  if (method === "didit-create") {
    if (!(await isEligible(user.id))) throw new HttpError(403, "Identity verification unlocks after you receive a funded account.");
    if (simulated) {
      const kyc = await saveKyc(user.id, { documentType: "didit", frontUrl: `didit:sim-${rand(10)}`, backUrl: "", status: "pending" });
      return { kyc, simulated };
    }
    const res = await fetch(`${DIDIT_BASE}/session/`, {
      method: "POST",
      headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ workflow_id: workflowId, vendor_data: user.id, ...(callbackUrl ? { callback: callbackUrl } : {}) }),
    });
    const data = (await res.json().catch(() => ({}))) as { session_id?: string; url?: string; detail?: string };
    if (!res.ok || !data.session_id || !data.url) throw new HttpError(502, data.detail || "Could not start identity verification.");
    const kyc = await saveKyc(user.id, { documentType: "didit", frontUrl: `didit:${data.session_id}`, backUrl: data.url, status: "pending", rejectReason: null });
    return { kyc, simulated };
  }

  if (method === "didit-sync") {
    const target = isStaff(user) && str(b.userId) ? str(b.userId) : user.id;
    const current = await db.one<DBKyc>("kyc", { userId: eq(target) });
    if (!current) throw new HttpError(404, "No verification session found.");
    if (simulated) {
      const sim = str(b.simulateStatus);
      const kyc = sim && isStaff(user) ? await saveKyc(target, { status: mapDidit(sim), rejectReason: str(b.rejectReason) || null }) : current;
      return { kyc, simulated };
    }
    const sessionId = current.frontUrl.replace(/^didit:/, "");
    const res = await fetch(`${DIDIT_BASE}/session/${sessionId}/decision/`, { headers: { "x-api-key": apiKey } });
    const data = (await res.json().catch(() => ({}))) as { status?: string };
    if (!res.ok) throw new HttpError(502, "Could not fetch the verification result.");
    const kyc = await saveKyc(target, { status: current.status === "needs_review" && mapDidit(data.status) === "pending" ? "needs_review" : mapDidit(data.status) });
    return { kyc, simulated };
  }

  // Manual document submission (URLs already uploaded elsewhere).
  const documentType = str(b.documentType);
  if (!documentType || !str(b.frontUrl) || !str(b.selfieUrl) || !str(b.addressUrl)) throw new HttpError(400, "documentType, frontUrl, selfieUrl and addressUrl are required.");
  if (!(await isEligible(user.id))) throw new HttpError(403, "Identity verification unlocks after you receive a funded account.");
  const kyc = await saveKyc(user.id, {
    documentType, frontUrl: str(b.frontUrl), backUrl: str(b.backUrl), selfieUrl: str(b.selfieUrl), addressUrl: str(b.addressUrl), status: "pending", rejectReason: null,
  });
  return { kyc };
}

export async function reviewKyc(ctx: Ctx) {
  const admin = await requireAdmin(ctx, true);
  const b = await body(ctx);
  const status = str(b.status) as DBKyc["status"];
  if (!["approved", "rejected", "needs_review", "pending"].includes(status)) throw new HttpError(400, "Invalid status.");
  const userId = str(b.userId);
  if (!(await db.one("kyc", { userId: eq(userId) }, { select: "userId" }))) throw new HttpError(404, "KYC record not found.");
  const kyc = await saveKyc(userId, { status, rejectReason: status === "rejected" ? str(b.rejectReason) || "Documents could not be verified." : null });
  const msg = status === "approved" ? "Your identity is verified. You can now request payouts." : status === "rejected" ? `Verification rejected: ${kyc.rejectReason}` : `Verification status: ${status}.`;
  await notify(userId, "Identity verification update", msg, status === "approved" ? "success" : status === "rejected" ? "error" : "info", "email");
  await audit(admin, "kyc_review", userId, "kyc", `KYC → ${status}`);
  return { kyc };
}

export async function diditWebhook(ctx: Ctx) {
  const raw = await ctx.req.text();
  const secret = env.didit.webhookSecret;
  if (!secret) return json({ error: "Webhook secret not configured." }, 503);
  const sig = ctx.req.headers.get("x-signature") || "";
  if (!sig || !safeEqual(sig, await hmacHex(secret, raw))) return json({ error: "Invalid signature." }, 401);
  const event = JSON.parse(raw) as { session_id?: string; status?: string; vendor_data?: string; webhook_type?: string };
  const userId = event.vendor_data;
  const current = userId ? await db.one<DBKyc>("kyc", { userId: eq(userId) }) : null;
  if (!current || current.frontUrl !== `didit:${event.session_id}`) return json({ success: true, ignored: true });
  const status = mapDidit(event.status);
  await saveKyc(userId!, { status: current.status === "needs_review" && status === "pending" ? "needs_review" : status });
  if (status !== "pending") await notify(userId!, "Identity verification update", status === "approved" ? "Your identity is verified." : "Your verification was not approved.", status === "approved" ? "success" : "error");
  return json({ success: true });
}
