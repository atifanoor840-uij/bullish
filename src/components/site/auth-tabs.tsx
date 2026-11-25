import { Link } from "@tanstack/react-router";
import { ShoppingCart } from "lucide-react";

/**
 * Toggle between "Create account" and "Sign in" on the auth pages.
 * Keeps the `next` target, so a plan picked on the pricing page is carried
 * through to checkout whichever way the trader authenticates.
 */
export function AuthTabs({ active, next }: { active: "signup" | "login"; next: string }) {
  const search = (next !== "/dashboard" ? { next } : {}) as never;
  const ordering = next.includes("plan=");
  const tab = (on: boolean) =>
    `flex-1 rounded-lg py-2 text-center text-xs font-semibold transition ${
      on ? "bg-gold text-primary-foreground shadow-gold" : "text-muted-foreground hover:text-foreground"
    }`;

  return (
    <div className="mt-6">
      {ordering && (
        <p className="mb-3 flex items-center justify-center gap-1.5 text-center text-[11px] text-muted-foreground">
          <ShoppingCart className="h-3.5 w-3.5 text-primary" />
          New here? Create an account — or sign in to continue your order.
        </p>
      )}
      <div className="flex gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1">
        <Link to="/signup" search={search} className={tab(active === "signup")}>
          Create account
        </Link>
        <Link to="/login" search={search} className={tab(active === "login")}>
          Sign in
        </Link>
      </div>
    </div>
  );
}
