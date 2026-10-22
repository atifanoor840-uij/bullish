/**
 * "Log in as user" for the CRM. The backend switches the session cookie to the target
 * user, so the admin session ends; this marker only lets the trader dashboard show an
 * "admin view" banner with a way back to the CRM.
 */
import { propApi, type User } from "@/lib/propApi";

const KEY = "b4x-impersonation";

export type Impersonation = { userId: string; name: string; email: string; admin: string };

export function getImpersonation(): Impersonation | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Impersonation) : null;
  } catch {
    return null;
  }
}

export function clearImpersonation() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable */
  }
}

/** Signs in as `user` and opens their dashboard. */
export async function loginAsUser(user: User, adminName: string) {
  await propApi.auth.impersonate(user.id);
  try {
    localStorage.setItem(KEY, JSON.stringify({ userId: user.id, name: user.name, email: user.email, admin: adminName }));
  } catch {
    /* banner is optional */
  }
  window.location.href = "/dashboard";
}

/** Ends the user session and returns to the CRM sign-in. */
export async function exitImpersonation() {
  clearImpersonation();
  await propApi.auth.signout().catch(() => {});
  window.location.href = "/admin";
}
