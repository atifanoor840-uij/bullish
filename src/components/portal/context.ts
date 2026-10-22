import { createContext, useContext } from "react";
import type { User } from "@/lib/propApi";

export type PortalContext = { user: User; refreshUser: () => Promise<void>; refreshUnread: () => void };

export const PortalCtx = createContext<PortalContext | null>(null);

/** Signed-in user + refresh helpers, provided by the /dashboard and /admin layouts. */
export function usePortal(): PortalContext {
  const ctx = useContext(PortalCtx);
  if (!ctx) throw new Error("usePortal must be used inside a portal layout");
  return ctx;
}
