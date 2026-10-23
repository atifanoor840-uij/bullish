/**
 * Minimal Supabase data layer over PostgREST + Storage, using the service-role key.
 * Server-only: never import this from browser code.
 */
import { env } from "./env";
import { HttpError } from "./errors";

type Filter = Record<string, string | number | boolean | null | undefined>;

/** PostgREST filter value helpers: `{ userId: eq(id) }`. */
export const eq = (v: string | number | boolean) => `eq.${v}`;
export const neq = (v: string | number | boolean) => `neq.${v}`;
export const inList = (vs: (string | number)[]) => `in.(${vs.map((v) => `"${String(v).replace(/"/g, '\\"')}"`).join(",")})`;

function headers(extra: Record<string, string> = {}) {
  const key = env.serviceKey;
  if (!env.supabaseUrl || !key) throw new HttpError(503, "Database is not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).");
  return { apikey: key, Authorization: `Bearer ${key}`, ...extra };
}

function buildQuery(filter: Filter = {}, opts: { select?: string; order?: string; limit?: number } = {}) {
  const p = new URLSearchParams();
  p.set("select", opts.select ?? "*");
  for (const [k, v] of Object.entries(filter)) if (v !== undefined && v !== null) p.append(k, String(v));
  if (opts.order) p.set("order", opts.order);
  if (opts.limit) p.set("limit", String(opts.limit));
  return p.toString();
}

async function rest<T>(method: string, table: string, query: string, body?: unknown, prefer?: string): Promise<T> {
  const res = await fetch(`${env.supabaseUrl}/rest/v1/${table}?${query}`, {
    method,
    headers: headers({
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(prefer ? { Prefer: prefer } : {}),
    }),
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const err = data as { message?: string; code?: string } | null;
    throw new DbError(err?.message || `Database error ${res.status}`, err?.code || String(res.status));
  }
  return data as T;
}

export class DbError extends Error {
  constructor(message: string, public code: string) {
    super(message);
  }
}

export const db = {
  /** Without a limit, pages through the whole table (PostgREST caps one response at 1000 rows). */
  async select<T>(table: string, filter?: Filter, opts?: { select?: string; order?: string; limit?: number }) {
    if (opts?.limit) return rest<T[]>("GET", table, buildQuery(filter, opts));
    const page = 1000;
    const all: T[] = [];
    for (let offset = 0; ; offset += page) {
      const rows = await rest<T[]>("GET", table, `${buildQuery(filter, { ...opts, limit: page })}&offset=${offset}`);
      all.push(...rows);
      if (rows.length < page) return all;
    }
  },
  async one<T>(table: string, filter: Filter, opts?: { select?: string; order?: string }) {
    const rows = await rest<T[]>("GET", table, buildQuery(filter, { ...opts, limit: 1 }));
    return rows[0] ?? null;
  },
  async insert<T>(table: string, row: Partial<T> | Partial<T>[]) {
    return rest<T[]>("POST", table, "select=*", row, "return=representation");
  },
  async upsert<T>(table: string, row: Partial<T> | Partial<T>[], onConflict: string) {
    return rest<T[]>("POST", table, `select=*&on_conflict=${encodeURIComponent(onConflict)}`, row, "return=representation,resolution=merge-duplicates");
  },
  async update<T>(table: string, filter: Filter, patch: Partial<T>) {
    return rest<T[]>("PATCH", table, buildQuery(filter), patch, "return=representation");
  },
  async remove(table: string, filter: Filter) {
    await rest("DELETE", table, buildQuery(filter, { select: "*" }));
  },
};

/* ---------------- storage (private bucket for payment proofs) ---------------- */

export const PROOF_BUCKET = "payment-proofs";

export async function uploadObject(bucket: string, path: string, file: Blob, contentType: string) {
  const put = () =>
    fetch(`${env.supabaseUrl}/storage/v1/object/${bucket}/${path}`, {
      method: "POST",
      headers: headers({ "Content-Type": contentType, "x-upsert": "false" }),
      body: file,
    });
  let res = await put();
  if (res.status === 404 || res.status === 400) {
    // Bucket missing on a fresh project → create it private and retry once.
    await fetch(`${env.supabaseUrl}/storage/v1/bucket`, {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ id: bucket, name: bucket, public: false }),
    });
    res = await put();
  }
  if (!res.ok) throw new HttpError(500, `Upload failed: ${(await res.text()).slice(0, 200)}`);
}

export async function signedUrl(bucket: string, path: string, expiresIn = 600) {
  const res = await fetch(`${env.supabaseUrl}/storage/v1/object/sign/${bucket}/${path}`, {
    method: "POST",
    headers: headers({ "Content-Type": "application/json" }),
    body: JSON.stringify({ expiresIn }),
  });
  const data = (await res.json().catch(() => ({}))) as { signedURL?: string };
  if (!res.ok || !data.signedURL) throw new HttpError(404, "Payment proof not found.");
  return `${env.supabaseUrl}/storage/v1${data.signedURL}`;
}
