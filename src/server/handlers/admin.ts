import { DbError, db, eq } from "../db";
import { env } from "../env";
import { audit, emailHtml, notify, releaseInventory, sendEmail, withUserNames } from "../core";
import {
  HttpError, body, hashPassword, isAdmin, isStaff, numv, publicUser, query, requireAdmin, requireUser, str, type Ctx,
} from "../http";
import type { DBAccount, DBCertificate, DBCoupon, DBInventory, DBNotification, DBPricingPlan, DBUser } from "../types";

/* ---------------- notifications ---------------- */

export async function listNotifications(ctx: Ctx) {
  const user = await requireUser(ctx);
  const notifications = isAdmin(user)
    ? await withUserNames(await db.select<DBNotification>("notifications", {}, { order: "sentAt.desc", limit: 500 }))
    : await db.select<DBNotification>("notifications", { userId: eq(user.id) }, { order: "sentAt.desc", limit: 200 });
  return { notifications };
}

export async function sendNotification(ctx: Ctx) {
  const user = await requireUser(ctx);
  const b = await body(ctx);
  const title = str(b.title), message = str(b.message);
  if (!title || !message) throw new HttpError(400, "title and message are required.");
  const type = (["info", "success", "warning", "error"].includes(str(b.type)) ? str(b.type) : "info") as DBNotification["type"];
  const target = str(b.targetUserId) || user.id;
  // Email channel is admin-only to avoid using the mail server for spam.
  const channel = isAdmin(user) && str(b.channel) === "email" ? "email" : "in_app";
  if (!isAdmin(user) && target !== user.id) throw new HttpError(403, "You can only notify yourself.");
  const targets = target === "all"
    ? (await db.select<DBUser>("users", { status: eq("active") }, { select: "id,email" }))
    : [{ id: target, email: undefined as string | undefined }];
  for (const t of targets) await notify(t.id, title, message, type, channel, t.email);
  if (isAdmin(user)) await audit(user, "notification_send", target, "user", `${title} → ${target === "all" ? `${targets.length} users` : target}`);
  return { count: targets.length };
}

export async function markNotification(ctx: Ctx) {
  const user = await requireUser(ctx);
  const b = await body(ctx);
  const n = await db.one<DBNotification>("notifications", { id: eq(str(b.id)) });
  if (!n || (n.userId !== user.id && !isAdmin(user))) throw new HttpError(404, "Notification not found.");
  const [notification] = await db.update<DBNotification>("notifications", { id: eq(n.id) }, { read: b.read !== false });
  return { notification };
}

/* ---------------- certificates & logs ---------------- */

export async function certificates(ctx: Ctx) {
  const id = query(ctx, "id");
  if (id) {
    const certificate = await db.one<DBCertificate>("certificates", { id: eq(id) });
    if (!certificate) throw new HttpError(404, "Certificate not found.");
    return { verified: true, certificate };
  }
  const user = await requireUser(ctx);
  return { certificates: await db.select<DBCertificate>("certificates", { userId: eq(user.id) }, { order: "datePassed.desc" }) };
}

export async function emailLogs(ctx: Ctx) {
  const user = await requireUser(ctx);
  const userId = isStaff(user) ? query(ctx, "userId") : user.id;
  try {
    return { emailLogs: await db.select("email_logs", userId ? { userId: eq(userId) } : {}, { order: "createdAt.desc", limit: 500 }) };
  } catch (e) {
    if (e instanceof DbError) return { emailLogs: [] }; // table not created on this project
    throw e;
  }
}

export async function auditLogs(ctx: Ctx) {
  await requireAdmin(ctx, true);
  return { logs: await db.select("audit_logs", {}, { order: "createdAt.desc", limit: 1000 }) };
}

/* ---------------- users ---------------- */

export async function listUsers(ctx: Ctx) {
  await requireAdmin(ctx, true);
  const users = await db.select<DBUser>("users", {}, { order: "createdAt.desc" });
  return { users: users.map(publicUser) };
}

export async function updateUser(ctx: Ctx) {
  const admin = await requireAdmin(ctx);
  const b = await body(ctx);
  const userId = str(b.userId);
  const patch: Partial<DBUser> = {};
  for (const k of ["name", "phone", "country", "referredBy"] as const) if (b[k] !== undefined) patch[k] = str(b[k]);
  if (b.email !== undefined) {
    const email = str(b.email).toLowerCase();
    const other = await db.one<DBUser>("users", { email: eq(email) }, { select: "id" });
    if (other && other.id !== userId) throw new HttpError(400, "Another user already has this email.");
    patch.email = email;
  }
  if (b.role !== undefined) {
    if (!["trader", "admin", "support", "affiliate", "collaborator"].includes(str(b.role))) throw new HttpError(400, "Invalid role.");
    patch.role = str(b.role) as DBUser["role"];
  }
  if (b.status !== undefined) {
    if (!["active", "suspended", "banned"].includes(str(b.status))) throw new HttpError(400, "Invalid status.");
    patch.status = str(b.status) as DBUser["status"];
  }
  if (b.newPassword !== undefined) {
    if (str(b.newPassword).length < 8) throw new HttpError(400, "Password must be at least 8 characters.");
    patch.passwordHash = await hashPassword(str(b.newPassword));
  }
  if (userId === admin.id && (patch.role && patch.role !== "admin" || patch.status && patch.status !== "active")) {
    throw new HttpError(400, "You cannot remove your own admin access.");
  }
  const [user] = await db.update<DBUser>("users", { id: eq(userId) }, patch);
  if (!user) throw new HttpError(404, "User not found.");
  await audit(admin, "user_update", userId, "user", `Updated ${Object.keys(patch).map((k) => (k === "passwordHash" ? "password" : k)).join(", ")}`);
  return { user: publicUser(user) };
}

export async function deleteUser(ctx: Ctx) {
  const admin = await requireAdmin(ctx);
  const id = query(ctx, "id");
  if (!id) throw new HttpError(400, "id is required.");
  if (id === admin.id) throw new HttpError(400, "You cannot delete your own admin account.");
  const user = await db.one<DBUser>("users", { id: eq(id) });
  if (!user) throw new HttpError(404, "User not found.");

  const accounts = await db.select<DBAccount>("trading_accounts", { userId: eq(id) });
  for (const a of accounts) await releaseInventory(a);

  const clean = (fn: () => Promise<unknown>) => fn().catch(() => {});
  await Promise.all([
    clean(() => db.remove("certificates", { userId: eq(id) })),
    clean(() => db.remove("offer_redemptions", { userId: eq(id) })),
    clean(() => db.remove("payouts", { userId: eq(id) })),
    clean(() => db.remove("notifications", { userId: eq(id) })),
    clean(() => db.remove("kyc", { userId: eq(id) })),
    clean(() => db.remove("referrals", { referredUserId: eq(id) })),
    clean(() => db.remove("referrals", { affiliateId: eq(id) })),
    clean(() => db.remove("collaborator_sales", { referredUserId: eq(id) })),
    clean(() => db.remove("collaborator_sales", { collaboratorId: eq(id) })),
    clean(() => db.remove("collaborator_attributions", { referredUserId: eq(id) })),
    clean(() => db.remove("collaborator_attributions", { collaboratorId: eq(id) })),
    clean(() => db.remove("email_logs", { userId: eq(id) })),
  ]);
  await clean(() => db.remove("trading_accounts", { userId: eq(id) }));
  await clean(() => db.remove("orders", { userId: eq(id) }));
  await clean(() => db.remove("affiliates", { userId: eq(id) }));
  await clean(() => db.remove("collaborators", { userId: eq(id) }));
  await db.remove("users", { id: eq(id) });

  await audit(admin, "user_delete", id, "user", `Deleted user ${user.email} (${id}) and ${accounts.length} account(s)`);
  return { deleted: true, removedAccounts: accounts.length };
}

/* ---------------- challenge inventory (credential pool) ---------------- */

export async function listInventory(ctx: Ctx) {
  await requireAdmin(ctx);
  return { plans: await db.select<DBInventory>("challenge_inventory", {}, { order: "createdAt.desc" }) };
}

const validLink = (v: string) => !v || /^https?:\/\//i.test(v);

export async function addInventory(ctx: Ctx) {
  const admin = await requireAdmin(ctx);
  const b = await body(ctx);
  const platform = str(b.platform), login = str(b.login), password = str(b.password), server = str(b.server), size = numv(b.size);
  if (!platform || !login || !password || !server || size <= 0) throw new HttpError(400, "platform, size, login, password and server are required.");
  if (!validLink(str(b.graphLink))) throw new HttpError(400, "graphLink must start with http(s)://");
  const id = `inv-${platform}-${login}`;
  if (await db.one("challenge_inventory", { id: eq(id) }, { select: "id" })) throw new HttpError(409, "This login is already in the inventory.");
  const [plan] = await db.insert<DBInventory>("challenge_inventory", {
    id, platform, size, login, password, server, externalStatisticsId: str(b.externalStatisticsId) || null, graphLink: str(b.graphLink) || null,
    status: "available", orderId: null, createdAt: new Date().toISOString(),
  });
  await audit(admin, "inventory_add", id, "inventory", `${platform} ${size} ${login}`);
  return { plan };
}

export async function updateInventory(ctx: Ctx) {
  const admin = await requireAdmin(ctx);
  const b = await body(ctx);
  const inv = await db.one<DBInventory>("challenge_inventory", { id: eq(str(b.id)) });
  if (!inv) throw new HttpError(404, "Inventory item not found.");
  const patch: Partial<DBInventory> = {};
  for (const k of ["platform", "login", "password", "server", "externalStatisticsId", "graphLink", "orderId"] as const) if (b[k] !== undefined) patch[k] = str(b[k]);
  if (b.size !== undefined) patch.size = numv(b.size);
  if (b.status !== undefined) patch.status = str(b.status) === "delivered" ? "delivered" : "available";
  if (!validLink(str(patch.graphLink ?? ""))) throw new HttpError(400, "graphLink must start with http(s)://");
  const assigned = inv.status === "delivered"
    ? await db.one<DBAccount>("trading_accounts", { platform: eq(inv.platform), server: eq(inv.server), login: eq(inv.login), deliveryStatus: eq("delivered") })
    : null;
  if (assigned && (patch.login || patch.password || patch.server || patch.platform || patch.status === "available")) {
    throw new HttpError(409, "This credential is delivered on an account. Remove it from the account first.");
  }
  const [plan] = await db.update<DBInventory>("challenge_inventory", { id: eq(inv.id) }, patch);
  if (assigned && (patch.graphLink !== undefined || patch.externalStatisticsId !== undefined)) {
    await db.update("trading_accounts", { id: eq(assigned.id) }, {
      ...(patch.graphLink !== undefined ? { graphLink: patch.graphLink } : {}),
      ...(patch.externalStatisticsId !== undefined ? { externalStatisticsId: patch.externalStatisticsId || null } : {}),
    });
  }
  await audit(admin, "inventory_update", inv.id, "inventory", `Updated ${Object.keys(patch).join(", ")}`);
  return { plan };
}

export async function deleteInventory(ctx: Ctx) {
  const admin = await requireAdmin(ctx);
  const inv = await db.one<DBInventory>("challenge_inventory", { id: eq(query(ctx, "id")) });
  if (!inv) throw new HttpError(404, "Inventory item not found.");
  if (inv.status === "delivered") throw new HttpError(409, "Delivered credentials cannot be deleted.");
  await db.remove("challenge_inventory", { id: eq(inv.id) });
  await audit(admin, "inventory_delete", inv.id, "inventory", `Deleted ${inv.login}`);
  return {};
}

/* ---------------- promotions & newsletter ---------------- */

type Template = { id: string; name: string; subject: string; html: string; createdAt?: string; updatedAt?: string };

async function templates(): Promise<{ templates: Template[]; warnings: string[] }> {
  try {
    return { templates: await db.select<Template>("promotion_templates", {}, { order: "createdAt.desc" }), warnings: [] };
  } catch {
    return { templates: [], warnings: ["Saved templates are unavailable: the promotion_templates table does not exist yet."] };
  }
}

export async function getPromotions(ctx: Ctx) {
  await requireAdmin(ctx);
  const sizes = query(ctx, "accountSizes").split(",").map(Number).filter(Boolean);
  const [plans, coupons, t] = await Promise.all([
    db.select<DBPricingPlan>("pricing_plans", { status: eq("active") }, { order: "size.asc" }),
    db.select<DBCoupon>("coupons", { status: eq("active") }),
    templates(),
  ]);
  const coupon = coupons.find((c) => !c.expiresAt || new Date(c.expiresAt).getTime() > Date.now());
  const shown = sizes.length ? plans.filter((p) => sizes.includes(p.size)) : plans;
  const rows = shown.map((p) => `<li>${p.model} $${(p.size / 1000).toFixed(0)}K — <b>$${p.price}</b></li>`).join("");
  const presets = [{
    id: "pricing", name: "Current pricing",
    subject: coupon ? `Save ${coupon.discountPercent}% on your next challenge` : "Start your next funded challenge",
    html: emailHtml("Get funded with Bullish 4ex", `<ul>${rows}</ul>${coupon ? `Use code <b style="color:#2563eb">${coupon.code}</b> for ${coupon.discountPercent}% off.` : "Use code ADD-CODE at checkout."}`),
  }];
  return { templates: t.templates, presets, availableAccountSizes: [...new Set(plans.map((p) => p.size))], warnings: t.warnings };
}

export async function savePromotion(ctx: Ctx) {
  await requireAdmin(ctx);
  const b = await body(ctx);
  const name = str(b.name), subject = str(b.subject), html = str(b.html);
  if (!name || !subject || !html) throw new HttpError(400, "name, subject and html are required.");
  if (html.length > 25_000) throw new HttpError(400, "Template HTML must be 25 KB or smaller.");
  const now = new Date().toISOString();
  try {
    const [template] = ctx.method === "PUT"
      ? await db.update<Template>("promotion_templates", { id: eq(str(b.id)) }, { name, subject, html, updatedAt: now })
      : await db.insert<Template>("promotion_templates", { id: crypto.randomUUID(), name, subject, html, createdAt: now, updatedAt: now });
    return { template };
  } catch (e) {
    if (e instanceof DbError) throw new HttpError(503, "Saving templates needs the promotion_templates table in Supabase.");
    throw e;
  }
}

export async function deletePromotion(ctx: Ctx) {
  await requireAdmin(ctx);
  await db.remove("promotion_templates", { id: eq(query(ctx, "id")) }).catch(() => {});
  return {};
}

export async function sendPromotion(ctx: Ctx) {
  const admin = await requireAdmin(ctx);
  const b = await body(ctx);
  const subject = str(b.subject), html = str(b.html);
  const recipients = ((Array.isArray(b.recipients) ? b.recipients : []) as unknown[]).map((r) => str(r).toLowerCase()).filter((r) => /^[^\s@]+@[^\s@]+$/.test(r));
  if (!subject || !html || !recipients.length || recipients.length > 100) throw new HttpError(400, "subject, html and 1–100 recipients are required.");
  if (html.includes("ADD-CODE")) throw new HttpError(400, "Replace the ADD-CODE placeholder with a real coupon code first.");
  if (!env.emailConfigured) throw new HttpError(503, "Email delivery is not configured (SMTP_USER / SMTP_PASS).");
  const failed: string[] = [];
  for (let i = 0; i < recipients.length; i += 5) {
    const batch = recipients.slice(i, i + 5);
    const results = await Promise.all(batch.map((to) => sendEmail(to, subject, html.replaceAll("{{email}}", to))));
    results.forEach((ok, j) => !ok && failed.push(batch[j]!));
  }
  await audit(admin, "promotion_send", "", "promotion", `${subject} → ${recipients.length - failed.length}/${recipients.length}`);
  return { sentCount: recipients.length - failed.length, failedCount: failed.length, failed };
}

export async function subscribeNewsletter(ctx: Ctx) {
  const b = await body(ctx);
  const email = str(b.email).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, "Please enter a valid email address.");
  const existing = await db.one("newsletter_subscribers", { email: eq(email) });
  if (existing) return { alreadySubscribed: true, subscriber: existing };
  const now = new Date().toISOString();
  const [subscriber] = await db.insert("newsletter_subscribers", {
    id: crypto.randomUUID(), email, source: str(b.source) === "home" ? "home" : "footer", status: "subscribed", emailStatus: "pending", createdAt: now, updatedAt: now,
  });
  return { subscriber, message: "You're subscribed." };
}

export async function listSubscribers(ctx: Ctx) {
  await requireAdmin(ctx, true);
  return { subscribers: await db.select("newsletter_subscribers", {}, { order: "createdAt.desc" }) };
}

/* ---------------- tracking & utility ---------------- */

const PIXEL_EVENTS = ["Purchase", "InitiateCheckout", "AddToCart", "AddPaymentInfo", "CompleteRegistration", "Lead", "Subscribe", "StartTrial"];

/** Meta Pixel + Conversions API credentials (hardcoded on purpose — no env setup needed). */
const META_PIXEL_ID = "29666237749727647";
const META_CAPI_TOKEN =
  "EAAhBb2ZBESXEBS4ZA9D7Sheyr1BLe6xlqYW0LCy6hJjMseGDnjj08jgwAiZApdmZCRd1I1LX1ZCKqZBKQ9C0xI9ZAObLNrit1ivRMuXsZAVsi5OZBRyIetWzaCBv3b54Fkbb9gEaqLtPX5VDAts7fASdwt9vRL3bgy8zrQ4G43FIN9AFgOMz5QAtettSZBkwTwngZDZD";
const metaPixelId = () => META_PIXEL_ID;

/**
 * Sends one event to the Meta Conversions API. The browser pixel fires the same event with the
 * same eventId, so Meta de-duplicates the pair. Returns null on success, or the error text.
 */
async function sendCapi(ctx: Ctx, e: {
  eventName: string; eventId?: string; eventSourceUrl?: string; fbp?: string; fbc?: string; customData?: Record<string, unknown>;
}): Promise<string | null> {
  const token = META_CAPI_TOKEN;
  const ip = ctx.req.headers.get("cf-connecting-ip") || ctx.req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const userData: Record<string, string> = {};
  if (ip) userData["client_ip_address"] = ip;
  const ua = ctx.req.headers.get("user-agent");
  if (ua) userData["client_user_agent"] = ua;
  if (e.fbp) userData["fbp"] = e.fbp;
  if (e.fbc) userData["fbc"] = e.fbc;
  try {
    const res = await fetch(`https://graph.facebook.com/v19.0/${metaPixelId()}/events?access_token=${encodeURIComponent(token)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        data: [{
          event_name: e.eventName, event_time: Math.floor(Date.now() / 1000), action_source: "website", user_data: userData,
          ...(e.eventId ? { event_id: e.eventId } : {}),
          ...(e.eventSourceUrl ? { event_source_url: e.eventSourceUrl } : {}),
          ...(e.customData ? { custom_data: e.customData } : {}),
        }],
      }),
    });
    if (res.ok) return null;
    return `Meta ${res.status}: ${(await res.text()).slice(0, 300)}`;
  } catch (err) {
    return err instanceof Error ? err.message : "network error";
  }
}

export async function trackPixel(ctx: Ctx) {
  const b = await body(ctx);
  const eventName = str(b.eventName);
  if (!PIXEL_EVENTS.includes(eventName) && eventName !== "PageView" && eventName !== "ViewContent") return {};
  const value = b.value === undefined || b.value === null ? undefined : numv(b.value);
  const currency = str(b.currency) || "USD";
  const contentName = str(b.contentName) || undefined;
  const contentIds = str(b.contentIds) || undefined;
  const customData: Record<string, unknown> = {};
  if (value !== undefined) { customData["value"] = value; customData["currency"] = currency; }
  if (contentName) customData["content_name"] = contentName;
  if (contentIds) { customData["content_ids"] = contentIds.split(","); customData["content_type"] = "product"; }

  const error = await sendCapi(ctx, {
    eventName,
    ...(str(b.eventId) ? { eventId: str(b.eventId) } : {}),
    ...(str(b.eventSourceUrl) ? { eventSourceUrl: str(b.eventSourceUrl) } : {}),
    ...(str(b.fbp) ? { fbp: str(b.fbp) } : {}),
    ...(str(b.fbc) ? { fbc: str(b.fbc) } : {}),
    ...(Object.keys(customData).length ? { customData } : {}),
  });

  // Only conversion events are logged (PageView/ViewContent would flood the table).
  if (PIXEL_EVENTS.includes(eventName)) {
    await db.insert("pixel_events", {
      id: crypto.randomUUID(), eventName, eventId: str(b.eventId) || null, source: "capi", status: error ? "failed" : "sent",
      pixelId: metaPixelId(), error, value: value ?? null, currency, contentName: contentName ?? null,
      contentIds: contentIds ?? null, eventSourceUrl: str(b.eventSourceUrl) || null, createdAt: new Date().toISOString(),
    }).catch(() => {});
  }
  return {};
}

export async function listPixelEvents(ctx: Ctx) {
  await requireAdmin(ctx);
  const events = await db.select<{ status: string; eventName: string; value?: number }>("pixel_events", {}, { order: "createdAt.desc", limit: 1000 });
  const purchases = events.filter((e) => e.eventName === "Purchase");
  return {
    events,
    summary: {
      total: events.length, sent: events.filter((e) => e.status === "sent").length, failed: events.filter((e) => e.status === "failed").length,
      purchases: purchases.length, purchaseValue: +purchases.reduce((s, e) => s + Number(e.value || 0), 0).toFixed(2),
    },
  };
}

export async function geo(ctx: Ctx) {
  const country = (ctx.req.headers.get("cf-ipcountry") || ctx.req.headers.get("x-vercel-ip-country") || "").toUpperCase();
  const isPakistan = country === "PK";
  return { country, isPakistan, cardPaymentAvailable: !isPakistan, source: country ? "edge-header" : "unknown" };
}

export async function news() {
  try {
    const res = await fetch("https://www.forexlive.com/feed/news", { headers: { "User-Agent": "Mozilla/5.0" } });
    const xml = await res.text();
    const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 20).map((m) => {
      const tag = (t: string) => (m[1]!.match(new RegExp(`<${t}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</${t}>`))?.[1] ?? "").trim();
      const d = new Date(tag("pubDate"));
      return {
        title: tag("title"), description: tag("description").replace(/<[^>]+>/g, "").slice(0, 240), link: tag("link"),
        date: Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10), time: Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(11, 16),
      };
    });
    return { news: items };
  } catch {
    return { news: [] };
  }
}

export async function conversions(ctx: Ctx) {
  const b = await body(ctx);
  if (!str(b.eventName)) return {};
  await sendCapi(ctx, {
    eventName: str(b.eventName),
    ...(str(b.eventId) ? { eventId: str(b.eventId) } : {}),
    ...(str(b.eventSourceUrl) ? { eventSourceUrl: str(b.eventSourceUrl) } : {}),
    ...(b.customData && typeof b.customData === "object" ? { customData: b.customData as Record<string, unknown> } : {}),
  });
  return {};
}
