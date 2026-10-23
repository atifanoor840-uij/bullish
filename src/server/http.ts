/**
 * Request context, JSON responses, signed session cookie and role guards.
 */
import { db, eq } from "./db";
import { env } from "./env";
import { HttpError } from "./errors";
import type { DBUser } from "./types";

export { HttpError };

export const SESSION_COOKIE = "prop_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

export type Ctx = {
  req: Request;
  url: URL;
  method: string;
  /** Set-Cookie headers to attach to the response. */
  cookies: string[];
  user?: DBUser | null;
};

export function makeCtx(req: Request): Ctx {
  return { req, url: new URL(req.url), method: req.method.toUpperCase(), cookies: [] };
}

export const query = (ctx: Ctx, key: string) => ctx.url.searchParams.get(key)?.trim() || "";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- request bodies are validated field by field
export async function body<T = any>(ctx: Ctx): Promise<T> {
  try {
    return ((await ctx.req.json()) ?? {}) as T;
  } catch {
    return {} as T;
  }
}

export const str = (v: unknown) => (typeof v === "string" ? v.trim() : v === undefined || v === null ? "" : String(v).trim());
export const numv = (v: unknown, f = 0) => (Number.isFinite(Number(v)) ? Number(v) : f);

export function json(data: unknown, status = 200, cookies: string[] = []) {
  const h = new Headers({ "Content-Type": "application/json", "Cache-Control": "no-store" });
  cookies.forEach((c) => h.append("Set-Cookie", c));
  return new Response(JSON.stringify(data), { status, headers: h });
}

export function redirect(location: string, cookies: string[] = []) {
  const h = new Headers({ Location: location });
  cookies.forEach((c) => h.append("Set-Cookie", c));
  return new Response(null, { status: 302, headers: h });
}

/* ---------------- crypto helpers (Web Crypto: works on Node and edge) ---------------- */

const enc = new TextEncoder();
const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

export async function sha256Hex(text: string) {
  return hex(await crypto.subtle.digest("SHA-256", enc.encode(text)));
}

export async function hmacHex(secret: string, text: string, hash: "SHA-256" | "SHA-512" = "SHA-256") {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", key, enc.encode(text)));
}

export function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

/** Random lowercase base36 id fragment. */
export function rand(len = 9) {
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  return [...bytes].map((b) => (b % 36).toString(36)).join("");
}

export const randDigits = (len: number) => [...crypto.getRandomValues(new Uint8Array(len))].map((b) => String(b % 10)).join("");

/** Existing users were created with unsalted SHA-256 hex hashes; keep the same scheme so they can sign in. */
export const hashPassword = (password: string) => sha256Hex(password);

/* ---------------- session ---------------- */

async function signSession(userId: string) {
  const sig = await hmacHex(env.sessionSecret, userId);
  return `${userId}.${sig}`;
}

async function verifySession(value: string) {
  const i = value.lastIndexOf(".");
  if (i <= 0) return null;
  const id = value.slice(0, i);
  return safeEqual(value.slice(i + 1), await hmacHex(env.sessionSecret, id)) ? id : null;
}

function cookieAttrs(ctx: Ctx) {
  return `Path=/; HttpOnly; SameSite=Lax${ctx.url.protocol === "https:" ? "; Secure" : ""}`;
}

export async function setSession(ctx: Ctx, userId: string) {
  ctx.cookies.push(`${SESSION_COOKIE}=${encodeURIComponent(await signSession(userId))}; Max-Age=${SESSION_MAX_AGE}; ${cookieAttrs(ctx)}`);
}

export function clearSession(ctx: Ctx) {
  ctx.cookies.push(`${SESSION_COOKIE}=; Max-Age=0; ${cookieAttrs(ctx)}`);
}

function readCookie(req: Request, name: string) {
  const raw = req.headers.get("cookie") || "";
  for (const part of raw.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return "";
}

export async function currentUser(ctx: Ctx): Promise<DBUser | null> {
  if (ctx.user !== undefined) return ctx.user;
  const value = readCookie(ctx.req, SESSION_COOKIE);
  const id = value ? await verifySession(value) : null;
  ctx.user = id ? await db.one<DBUser>("users", { id: eq(id) }) : null;
  if (value && !ctx.user) clearSession(ctx);
  return ctx.user;
}

export async function requireUser(ctx: Ctx) {
  const user = await currentUser(ctx);
  if (!user) throw new HttpError(401, "Not signed in.");
  if (user.status !== "active") throw new HttpError(403, "Your account is not active.");
  return user;
}

export const isAdmin = (u: DBUser | null | undefined) => u?.role === "admin";
export const isStaff = (u: DBUser | null | undefined) => u?.role === "admin" || u?.role === "support";

export async function requireAdmin(ctx: Ctx, allowSupport = false) {
  const user = await requireUser(ctx);
  if (!(allowSupport ? isStaff(user) : isAdmin(user))) throw new HttpError(403, "Admin access required.");
  return user;
}

/** Strips the password hash before a user leaves the server. */
export function publicUser(u: DBUser) {
  const { passwordHash: _omit, ...rest } = u;
  return rest;
}

export function clientIp(ctx: Ctx) {
  return (
    ctx.req.headers.get("cf-connecting-ip") ||
    ctx.req.headers.get("x-real-ip") ||
    ctx.req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    ""
  );
}

export function origin(ctx: Ctx) {
  return env.appUrl || ctx.url.origin;
}
