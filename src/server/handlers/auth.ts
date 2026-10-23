import { db, eq } from "../db";
import { env } from "../env";
import { audit, emailHtml, notify, sendEmail } from "../core";
import {
  HttpError, body, clearSession, clientIp, currentUser, hashPassword, origin, publicUser, query, rand, randDigits, redirect,
  requireAdmin, requireUser, setSession, sha256Hex, str, type Ctx,
} from "../http";
import type { DBAffiliate, DBCollaborator, DBUser } from "../types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VERIFY_TTL_MS = 24 * 3600_000;

async function findByEmail(email: string) {
  return db.one<DBUser>("users", { email: eq(email.toLowerCase()) });
}

async function checkPassword(email: string, password: string) {
  if (!email || !password) throw new HttpError(400, "Email and password are required fields.");
  const user = await findByEmail(email);
  if (!user || user.passwordHash !== (await hashPassword(password))) throw new HttpError(400, "Invalid email or password.");
  return user;
}

async function sendVerification(ctx: Ctx, user: DBUser, locale = "en") {
  const token = `${rand(24)}${rand(24)}`;
  await db.insert("email_verification_tokens", {
    tokenHash: await sha256Hex(token), userId: user.id,
    expiresAt: new Date(Date.now() + VERIFY_TTL_MS).toISOString(), createdAt: new Date().toISOString(),
  });
  const link = `${origin(ctx)}/api/auth/verify-email?token=${token}&locale=${locale}&email=${encodeURIComponent(user.email)}`;
  return sendEmail(
    user.email,
    "Verify your Bullish 4ex email address",
    emailHtml("Verify your email", `Hi ${user.name},\nconfirm your email address to secure your account:\n<a href="${link}" style="color:#e5a93c">${link}</a>\nThe link expires in 24 hours.`),
  );
}

export async function signup(ctx: Ctx) {
  const b = await body(ctx);
  const name = str(b.name), email = str(b.email).toLowerCase(), password = str(b.password);
  if (!name || !email || !password) throw new HttpError(400, "Name, email and password are required.");
  if (!EMAIL_RE.test(email)) throw new HttpError(400, "Please enter a valid email address.");
  if (password.length < 8) throw new HttpError(400, "Password must be at least 8 characters.");
  if (await findByEmail(email)) throw new HttpError(400, "An account with this email already exists.");

  const referralCode = str(b.referralCode).toUpperCase();
  const collaboratorCode = str(b.collaboratorCode).toUpperCase();
  let referredBy: string | null = null;
  if (referralCode) {
    const aff = await db.one<DBAffiliate>("affiliates", { referralCode: eq(referralCode) });
    if (!aff) throw new HttpError(400, "Invalid referral code.");
    referredBy = aff.referralCode;
  }
  const collab = collaboratorCode ? await db.one<DBCollaborator>("collaborators", { referralCode: eq(collaboratorCode) }) : null;
  if (collaboratorCode && !collab) throw new HttpError(400, "Invalid partner code.");

  const [user] = await db.insert<DBUser>("users", {
    id: `u-${rand(9)}`, name, email, phone: str(b.phone), country: str(b.country), passwordHash: await hashPassword(password),
    role: "trader", status: "active", createdAt: new Date().toISOString(), referredBy, emailVerified: false,
  });
  if (!user) throw new HttpError(500, "Could not create the account.");
  if (collab) await db.insert("collaborator_attributions", { referredUserId: user.id, collaboratorId: collab.userId, createdAt: new Date().toISOString() }).catch(() => {});
  const code = `${name.replace(/[^a-z]/gi, "").slice(0, 7).toUpperCase() || "TRADER"}${randDigits(3)}`;
  await db.insert("affiliates", { userId: user.id, referralCode: code, commissionRate: 10 }).catch(() => {});
  await notify(user.id, "Welcome to Bullish 4ex", "Your trader account is ready. Pick a challenge to get started.", "success");

  const locale = str(b.locale) || "en";
  const emailSent = await sendVerification(ctx, user, locale);
  return {
    user: publicUser(user), emailSent,
    verificationPage: `/login?email=${encodeURIComponent(email)}${emailSent ? "" : "&status=email-failed"}`,
  };
}

export async function verifyEmail(ctx: Ctx) {
  const token = query(ctx, "token");
  const email = query(ctx, "email");
  const to = (status: string) => redirect(`/dashboard?verified=${status}&email=${encodeURIComponent(email)}`, ctx.cookies);
  if (!token) return to("invalid");
  const row = await db.one<{ userId: string; expiresAt: string }>("email_verification_tokens", { tokenHash: eq(await sha256Hex(token)) });
  if (!row) return to("invalid");
  await db.remove("email_verification_tokens", { tokenHash: eq(await sha256Hex(token)) });
  if (new Date(row.expiresAt).getTime() < Date.now()) return to("expired");
  await db.update("users", { id: eq(row.userId) }, { emailVerified: true, emailVerifiedAt: new Date().toISOString() });
  await setSession(ctx, row.userId);
  await notify(row.userId, "Email verified", "Thanks for confirming your email address.", "success");
  return to("success");
}

export async function resendVerification(ctx: Ctx) {
  const b = await body(ctx);
  const user = await findByEmail(str(b.email));
  if (user && !user.emailVerified) {
    const sent = await sendVerification(ctx, user, str(b.locale) || "en");
    if (!sent) throw new HttpError(503, "Email delivery is not configured yet. Please try again later.");
  }
  return {};
}

export async function signin(ctx: Ctx) {
  const b = await body(ctx);
  const user = await checkPassword(str(b.email), str(b.password));
  if (user.role === "collaborator") throw new HttpError(403, "Partner accounts sign in from the partner portal.");
  if (user.status !== "active") throw new HttpError(403, "This account is not active. Contact support.");
  await setSession(ctx, user.id);
  const ip = clientIp(ctx);
  await notify(user.id, "New login to your account", `A new sign-in was detected${ip ? ` from IP ${ip}` : ""}.`, "info");
  return { user: publicUser(user), emailVerified: !!user.emailVerified };
}

export async function signout(ctx: Ctx) {
  clearSession(ctx);
  return {};
}

export async function me(ctx: Ctx) {
  const user = await currentUser(ctx);
  if (!user) throw new HttpError(401, "Not signed in.");
  return { user: publicUser(user) };
}

/** Profile update: only name / phone / country — role and status are admin-only (PUT /api/users). */
export async function updateMe(ctx: Ctx) {
  const user = await requireUser(ctx);
  const b = await body(ctx);
  const patch: Partial<DBUser> = {};
  if (b.name !== undefined) patch.name = str(b.name);
  if (b.phone !== undefined) patch.phone = str(b.phone);
  if (b.country !== undefined) patch.country = str(b.country);
  if (patch.name === "") throw new HttpError(400, "Name cannot be empty.");
  const [updated] = await db.update<DBUser>("users", { id: eq(user.id) }, patch);
  return { user: publicUser(updated ?? user) };
}

export async function crmSignin(ctx: Ctx) {
  const b = await body(ctx);
  const user = await checkPassword(str(b.email), str(b.password));
  if (!(user.role === "admin" || user.role === "support") || user.status !== "active") throw new HttpError(403, "Access denied. This login is for staff only.");
  await setSession(ctx, user.id);
  await audit(user, "crm_signin", user.id, "user", `${user.email} signed in to the CRM`);
  return { user: publicUser(user) };
}

export async function crmSignup(ctx: Ctx) {
  const b = await body(ctx);
  if (!env.crmPasscode) throw new HttpError(503, "Admin signup is disabled. Set CRM_ADMIN_PASSCODE on the server to enable it.");
  if (str(b.passcode) !== env.crmPasscode) throw new HttpError(403, "Invalid passcode.");
  const name = str(b.name), email = str(b.email).toLowerCase(), password = str(b.password);
  if (!name || !EMAIL_RE.test(email) || password.length < 8) throw new HttpError(400, "Name, a valid email and an 8+ character password are required.");
  if (await findByEmail(email)) throw new HttpError(400, "An account with this email already exists.");
  const [user] = await db.insert<DBUser>("users", {
    id: `u-admin-${rand(6)}`, name, email, phone: "", country: "", passwordHash: await hashPassword(password),
    role: "admin", status: "active", createdAt: new Date().toISOString(), emailVerified: true,
  });
  await setSession(ctx, user!.id);
  await audit(user!, "crm_signup", user!.id, "user", `Admin ${email} created`);
  return { user: publicUser(user!) };
}

export async function impersonate(ctx: Ctx) {
  const admin = await requireAdmin(ctx, true);
  const b = await body(ctx);
  const target = await db.one<DBUser>("users", { id: eq(str(b.userId)) });
  if (!target) throw new HttpError(404, "User not found.");
  if (target.role === "admin" && admin.role !== "admin") throw new HttpError(403, "Support staff cannot log in as an admin.");
  await setSession(ctx, target.id);
  await audit(admin, "user_impersonate", target.id, "user", `${admin.email} logged in as ${target.email}`);
  return { user: publicUser(target) };
}

export async function collaboratorSignin(ctx: Ctx) {
  const b = await body(ctx);
  const user = await checkPassword(str(b.email), str(b.password));
  if (user.role !== "collaborator" || user.status !== "active") throw new HttpError(403, "This login is for partners only.");
  if (!(await db.one("collaborators", { userId: eq(user.id) }, { select: "userId" }))) throw new HttpError(403, "Partner profile not found.");
  await setSession(ctx, user.id);
  return {};
}
