/**
 * Follow-up emails: admin picks an audience segment (unpaid orders, unverified
 * sign-ups, no purchase yet, failed challenge, all traders), edits a branded
 * message and sends it to the selected users. Recipients are always recomputed
 * on the server from the segment, so only real matching users can be emailed.
 */
import { db, eq } from "../db";
import { env } from "../env";
import { audit, emailHtml, orderPlan, sendEmail } from "../core";
import { HttpError, body, origin, requireAdmin, str, type Ctx } from "../http";
import type { DBCoupon, DBOrder, DBUser } from "../types";

export type SegmentId = "unpaid_orders" | "unverified" | "no_orders" | "failed_challenge" | "all_traders" | "crypto_extra_5";

type Recipient = {
  userId: string; name: string; email: string; createdAt: string;
  orderId?: string; plan?: string; amount?: number; orderDate?: string;
  lastFollowUpAt?: string | null;
};

const UNPAID = new Set(["Pending", "Payment Failed"]);
const FAILED = new Set(["Failed"]);
const HOUR = 36e5;

export const SEGMENTS: Record<SegmentId, { label: string; description: string }> = {
  unpaid_orders: { label: "Unpaid orders", description: "Created an order but never paid (older than 1 hour, no paid order since)." },
  unverified: { label: "Unverified sign-ups", description: "Signed up but haven't confirmed their email address." },
  no_orders: { label: "No purchase yet", description: "Active traders who never created an order." },
  failed_challenge: { label: "Failed challenge", description: "Latest challenge failed and no new paid order since — offer a retry." },
  all_traders: { label: "All active traders", description: "Promotions and announcements for every active trader." },
  crypto_extra_5: { label: "5% extra off (crypto)", description: "Promote the extra 5% OFF on crypto payments for an account size you choose — every active trader." },
};

/** Default copy per segment. Placeholders: {{name}} {{plan}} {{amount}} {{orderId}} {{coupon}}. */
export const PRESETS: Record<SegmentId, { subject: string; title: string; message: string; ctaLabel: string; ctaPath: string }> = {
  unpaid_orders: {
    subject: "Your {{plan}} challenge is waiting for you",
    title: "Complete your order",
    message: "Hi {{name}},\nyou started an order for the {{plan}} challenge ({{amount}}) but the payment wasn't completed.\nYour spot is still reserved — finish checkout and start trading today.",
    ctaLabel: "Complete payment",
    ctaPath: "/dashboard/orders",
  },
  unverified: {
    subject: "Confirm your Bullish 4ex email",
    title: "One step left",
    message: "Hi {{name}},\nyou're almost there! Confirm your email address to unlock your dashboard and start your first funded challenge.",
    ctaLabel: "Sign in & verify",
    ctaPath: "/login",
  },
  no_orders: {
    subject: "Ready to get funded, {{name}}?",
    title: "Start your funded journey",
    message: "Hi {{name}},\nthanks for joining Bullish 4ex. Pick a challenge, prove your strategy and trade our capital with up to 90% profit split.",
    ctaLabel: "Choose a challenge",
    ctaPath: "/dashboard/new-challenge",
  },
  failed_challenge: {
    subject: "Every great trader has a comeback",
    title: "Ready for another shot?",
    message: "Hi {{name}},\nyour last challenge didn't go to plan — that's part of trading. Take what you learned and start a new challenge today.",
    ctaLabel: "Start a new challenge",
    ctaPath: "/dashboard/new-challenge",
  },
  all_traders: {
    subject: "A special offer for Bullish 4ex traders",
    title: "Limited-time offer",
    message: "Hi {{name}},\nfor a limited time get a discount on any challenge. Don't miss it!",
    ctaLabel: "Claim offer",
    ctaPath: "/pricing",
  },
  crypto_extra_5: {
    subject: "Extra 5% OFF on your {{account}} challenge",
    title: "Extra 5% OFF with crypto",
    message: "Hi {{name}},\nget an extra 5% OFF on the {{account}} account when you pay with crypto at checkout.\nThe extra discount stacks with your promo code — pick your {{account}} challenge and start trading today.",
    ctaLabel: "Claim 5% OFF",
    ctaPath: "/dashboard/new-challenge",
  },
};

const isSegment = (s: string): s is SegmentId => s in SEGMENTS;
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const time = (s?: string | null) => (s ? new Date(s).getTime() : 0);

async function lastFollowUps(): Promise<Map<string, string>> {
  try {
    const rows = await db.select<{ userId: string; sentAt: string }>("email_logs", { provider: eq("follow-up") }, { select: "userId,sentAt", order: "sentAt.desc", limit: 5000 });
    const map = new Map<string, string>();
    for (const r of rows) if (r.userId && !map.has(r.userId)) map.set(r.userId, r.sentAt);
    return map;
  } catch {
    return new Map(); // email_logs table not created on this project
  }
}

/** Computes every segment's recipients from users + orders. */
async function computeSegments(): Promise<Record<SegmentId, Recipient[]>> {
  const [users, orders, last] = await Promise.all([
    db.select<DBUser>("users", { role: eq("trader"), status: eq("active") }, { order: "createdAt.desc" }),
    db.select<DBOrder>("orders", {}, { select: "id,userId,planId,amountPaid,status,createdAt", order: "createdAt.desc" }),
    lastFollowUps(),
  ]);
  const byUser = new Map<string, DBOrder[]>();
  for (const o of orders) byUser.set(o.userId, [...(byUser.get(o.userId) ?? []), o]); // newest first
  const base = (u: DBUser): Recipient => ({ userId: u.id, name: u.name, email: u.email, createdAt: u.createdAt, lastFollowUpAt: last.get(u.id) ?? null });
  const withOrder = async (r: Recipient, o: DBOrder): Promise<Recipient> => ({
    ...r, orderId: o.id, plan: (await orderPlan(o)).planName, amount: Number(o.amountPaid), orderDate: o.createdAt,
  });

  const out: Record<SegmentId, Recipient[]> = { unpaid_orders: [], unverified: [], no_orders: [], failed_challenge: [], all_traders: [], crypto_extra_5: [] };
  for (const u of users) {
    const list = byUser.get(u.id) ?? [];
    const r = base(u);
    out.all_traders.push(r);
    out.crypto_extra_5.push(r);
    if (u.emailVerified === false) out.unverified.push(r);
    if (!list.length) out.no_orders.push(r);

    const paid = list.filter((o) => !UNPAID.has(o.status));
    const lastPaid = Math.max(0, ...paid.map((o) => time(o.createdAt)));
    const unpaid = list.find((o) => UNPAID.has(o.status) && Date.now() - time(o.createdAt) > HOUR && time(o.createdAt) > lastPaid);
    if (unpaid) out.unpaid_orders.push(await withOrder(r, unpaid));

    const newest = paid[0];
    if (newest && FAILED.has(newest.status)) out.failed_challenge.push(await withOrder(r, newest));
  }
  return out;
}

export async function listFollowUps(ctx: Ctx) {
  await requireAdmin(ctx);
  const [segments, coupons] = await Promise.all([
    computeSegments(),
    db.select<DBCoupon>("coupons", { status: eq("active") }).catch(() => [] as DBCoupon[]),
  ]);
  return {
    segments: (Object.keys(SEGMENTS) as SegmentId[]).map((id) => ({ id, ...SEGMENTS[id], recipients: segments[id] })),
    presets: PRESETS,
    coupons: coupons.filter((c) => !c.expiresAt || time(c.expiresAt) > Date.now()).map((c) => ({ code: c.code, discountPercent: Number(c.discountPercent) })),
    siteUrl: origin(ctx),
    emailConfigured: env.emailConfigured,
  };
}

function fill(text: string, r: Recipient, coupon: string, html: boolean, account = "") {
  const v = (s: string) => (html ? esc(s) : s);
  return text
    .replaceAll("{{account}}", v(account || "challenge"))
    .replaceAll("{{name}}", v(r.name.split(" ")[0] || r.name || "there"))
    .replaceAll("{{plan}}", v(r.plan ?? "challenge"))
    .replaceAll("{{amount}}", r.amount !== undefined ? `$${r.amount.toFixed(2)}` : "")
    .replaceAll("{{orderId}}", v(r.orderId ?? ""))
    .replaceAll("{{coupon}}", v(coupon));
}

/** Renders the email for one recipient (also used by the admin preview). */
export function renderFollowUp(r: Recipient, input: { title: string; message: string; ctaLabel: string; ctaUrl: string; coupon: string; couponPercent?: number | undefined; account?: string }) {
  const couponLine = input.coupon
    ? `\n\nUse code <b style="color:#2563eb;letter-spacing:.04em">${esc(input.coupon)}</b>${input.couponPercent ? ` for ${input.couponPercent}% off` : ""} at checkout.`
    : "";
  const account = input.account ?? "";
  return emailHtml(fill(input.title, r, input.coupon, true, account), fill(input.message, r, input.coupon, true, account) + couponLine, {
    ...(r.orderId ? { details: [["Order ID", esc(r.orderId)], ["Plan", esc(r.plan ?? "")], ["Amount", `$${(r.amount ?? 0).toFixed(2)}`]] as [string, string][] } : {}),
    ...(input.ctaLabel && input.ctaUrl ? { cta: { label: esc(input.ctaLabel), url: input.ctaUrl } } : {}),
  });
}

async function logEmail(r: Recipient, subject: string, html: string, ok: boolean) {
  await db
    .insert("email_logs", { id: `mail-${crypto.randomUUID()}`, userId: r.userId, toEmail: r.email, subject, content: html, status: ok ? "sent" : "failed", provider: "follow-up", sentAt: new Date().toISOString() })
    .catch(() => {});
}

export async function sendFollowUps(ctx: Ctx) {
  const admin = await requireAdmin(ctx);
  const b = await body(ctx);
  const segment = str(b.segment);
  if (!isSegment(segment)) throw new HttpError(400, "Unknown audience segment.");
  const subject = str(b.subject), title = str(b.title), message = str(b.message);
  const ctaLabel = str(b.ctaLabel), coupon = str(b.coupon).toUpperCase(), account = str(b.account);
  let ctaUrl = str(b.ctaUrl);
  if (!subject || !title || !message) throw new HttpError(400, "Subject, heading and message are required.");
  if (ctaUrl && !/^https?:\/\//.test(ctaUrl)) ctaUrl = `${origin(ctx)}${ctaUrl.startsWith("/") ? "" : "/"}${ctaUrl}`;
  if (!env.emailConfigured) throw new HttpError(503, "Email delivery is not configured (SMTP_PASS is missing on the server).");

  let couponPercent: number | undefined;
  if (coupon) {
    const c = await db.one<DBCoupon>("coupons", { code: eq(coupon) });
    if (!c || c.status !== "active" || (c.expiresAt && time(c.expiresAt) < Date.now())) throw new HttpError(400, `Coupon ${coupon} is not active.`);
    couponPercent = Number(c.discountPercent);
  }

  const ids = new Set((Array.isArray(b.userIds) ? (b.userIds as unknown[]) : []).map((x) => str(x)));
  const recipients = (await computeSegments())[segment].filter((r) => ids.has(r.userId));
  if (!recipients.length) throw new HttpError(400, "Select at least one recipient from this audience.");
  if (recipients.length > 200) throw new HttpError(400, "Send at most 200 emails per batch.");

  const failed: string[] = [];
  for (let i = 0; i < recipients.length; i += 5) {
    await Promise.all(recipients.slice(i, i + 5).map(async (r) => {
      const html = renderFollowUp(r, { title, message, ctaLabel, ctaUrl, coupon, couponPercent, account });
      const subj = fill(subject, r, coupon, false, account);
      const ok = await sendEmail(r.email, subj, html);
      if (!ok) failed.push(r.email);
      await logEmail(r, subj, html, ok);
    }));
  }
  await audit(admin, "follow_up_send", segment, "email", `${SEGMENTS[segment].label}: "${subject}" → ${recipients.length - failed.length}/${recipients.length}`);
  return { sentCount: recipients.length - failed.length, failedCount: failed.length, failed };
}

/** Server-rendered preview so the admin sees the exact branded email. */
export async function previewFollowUp(ctx: Ctx) {
  await requireAdmin(ctx);
  const b = await body(ctx);
  const sample: Recipient = {
    userId: "preview", name: str(b.name) || "Ali Khan", email: "trader@example.com", createdAt: new Date().toISOString(),
    ...(b.withOrder ? { orderId: str(b.orderId) || "ORD-10234", plan: str(b.plan) || "Two Step $10K", amount: Number(b.amount) || 89 } : {}),
  };
  let ctaUrl = str(b.ctaUrl);
  if (ctaUrl && !/^https?:\/\//.test(ctaUrl)) ctaUrl = `${origin(ctx)}${ctaUrl.startsWith("/") ? "" : "/"}${ctaUrl}`;
  return {
    subject: fill(str(b.subject), sample, str(b.coupon).toUpperCase(), false, str(b.account)),
    html: renderFollowUp(sample, {
      title: str(b.title), message: str(b.message), ctaLabel: str(b.ctaLabel), ctaUrl, account: str(b.account),
      coupon: str(b.coupon).toUpperCase(), couponPercent: Number(b.couponPercent) || undefined,
    }),
  };
}
