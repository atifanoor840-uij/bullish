import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import {
  LayoutDashboard, ShoppingBag, Layers, Wallet, ShieldCheck, Users, Share2, Handshake, Tags, TicketPercent, Gift, Boxes,
  Megaphone, Mail, ScrollText, Loader2, Lock,
} from "lucide-react";
import { Logo } from "@/components/site/primitives";
import { Shell, type NavGroup } from "@/components/portal/Shell";
import { PortalCtx } from "@/components/portal/context";
import { Button, Card, Field, Note, inputCls } from "@/components/portal/ui";
import { propApi, isUnauthorized, type Kyc, type User } from "@/lib/propApi";
import { clearImpersonation } from "@/lib/impersonation";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "CRM — Bullish 4ex" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminLayout,
});

type Counts = { orders: number; deliveries: number; payouts: number; kyc: number };

function buildNav(c: Counts): NavGroup[] {
  return [
    { items: [{ label: "Overview", to: "/admin", icon: LayoutDashboard, exact: true }] },
    {
      title: "Operations",
      items: [
        { label: "Orders", to: "/admin/orders", icon: ShoppingBag, badge: c.orders },
        { label: "Accounts", to: "/admin/accounts", icon: Layers, badge: c.deliveries },
        { label: "Payouts", to: "/admin/payouts", icon: Wallet, badge: c.payouts },
        { label: "KYC", to: "/admin/kyc", icon: ShieldCheck, badge: c.kyc },
      ],
    },
    {
      title: "Customers",
      items: [
        { label: "Users", to: "/admin/users", icon: Users },
        { label: "Affiliates", to: "/admin/affiliates", icon: Share2 },
        { label: "Collaborators", to: "/admin/collaborators", icon: Handshake },
      ],
    },
    {
      title: "Catalog",
      items: [
        { label: "Pricing", to: "/admin/pricing", icon: Tags },
        { label: "Coupons", to: "/admin/coupons", icon: TicketPercent },
        { label: "Offers", to: "/admin/offers", icon: Gift },
        { label: "Inventory", to: "/admin/inventory", icon: Boxes },
      ],
    },
    {
      title: "Marketing",
      items: [
        { label: "Notifications", to: "/admin/notifications", icon: Megaphone },
        { label: "Promotions", to: "/admin/promotions", icon: Mail },
      ],
    },
    { title: "System", items: [{ label: "Logs", to: "/admin/logs", icon: ScrollText }] },
  ];
}

function AdminLayout() {
  const [user, setUser] = useState<User | null>(null);
  const [state, setState] = useState<"loading" | "login" | "ready">("loading");
  const [counts, setCounts] = useState<Counts>({ orders: 0, deliveries: 0, payouts: 0, kyc: 0 });

  const refreshUser = useCallback(async () => {
    try {
      const { user } = await propApi.auth.me();
      if (user.role !== "admin" && user.role !== "support") {
        setState("login");
        return;
      }
      clearImpersonation();
      setUser(user);
      setState("ready");
    } catch (e) {
      setState("login");
      if (!isUnauthorized(e)) console.error(e);
    }
  }, []);

  /** Sidebar badges: work waiting on the team. */
  const refreshUnread = useCallback(() => {
    Promise.all([
      propApi.orders.list().catch(() => ({ orders: [] })),
      propApi.accounts.list().catch(() => ({ accounts: [] })),
      propApi.payouts.list().catch(() => ({ payouts: [] })),
      propApi.kyc.get().catch(() => ({ kyc: [] })),
    ]).then(([o, a, p, k]) =>
      setCounts({
        orders: o.orders.filter((x) => x.status === "Pending" && x.gatewayRef?.startsWith("manual:")).length,
        deliveries: a.accounts.filter((x) => x.deliveryStatus === "pending").length,
        payouts: p.payouts.filter((x) => x.status === "pending").length,
        kyc: (Array.isArray(k.kyc) ? (k.kyc as Kyc[]) : []).filter((x) => x.status === "pending" || x.status === "needs_review").length,
      }),
    );
  }, []);

  useEffect(() => void refreshUser(), [refreshUser]);
  useEffect(() => {
    if (state === "ready") refreshUnread();
  }, [state, refreshUnread]);

  const signOut = async () => {
    await propApi.auth.signout().catch(() => {});
    setUser(null);
    setState("login");
  };

  if (state === "loading") {
    return <div className="flex min-h-screen items-center justify-center gap-3 bg-background text-sm text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin text-primary" />Loading CRM…</div>;
  }
  if (state === "login" || !user) return <CrmLogin onDone={refreshUser} />;

  return (
    <PortalCtx.Provider value={{ user, refreshUser, refreshUnread }}>
      <Shell groups={buildNav(counts)} user={user} area="CRM" onSignOut={signOut}>
        <Outlet />
      </Shell>
    </PortalCtx.Provider>
  );
}

function CrmLogin({ onDone }: { onDone: () => Promise<void> }) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passcode, setPasscode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const signup = mode === "signup";
  const switchMode = () => {
    setMode(signup ? "signin" : "signup");
    setError("");
  };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (signup) {
        if (password.length < 8) throw new Error("Password must be at least 8 characters.");
        await propApi.auth.crmSignup({ name: name.trim(), email: email.trim().toLowerCase(), password, passcode: passcode.trim() });
      } else {
        await propApi.auth.crmSignin(email.trim().toLowerCase(), password);
      }
      await onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Access denied");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="hero-bg flex min-h-screen items-center justify-center px-5 text-foreground">
      <Card className="w-full max-w-sm p-8">
        <Logo />
        <div className="mt-6 flex items-center gap-2">
          <Lock className="h-4 w-4 text-primary" />
          <h1 className="font-display text-xl font-semibold">{signup ? "Create admin account" : "CRM sign in"}</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {signup ? "Requires the admin passcode set on the server." : "Admin and support staff only."}
        </p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          {signup && <Field label="Name"><input required autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} className={inputCls} /></Field>}
          <Field label="Email"><input type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} /></Field>
          <Field label="Password"><input type="password" required minLength={signup ? 8 : undefined} autoComplete={signup ? "new-password" : "current-password"} value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} /></Field>
          {signup && <Field label="Admin passcode"><input type="password" required autoComplete="off" value={passcode} onChange={(e) => setPasscode(e.target.value)} className={inputCls} /></Field>}
          {error && <Note tone="error">{error}</Note>}
          <Button variant="primary" className="w-full" busy={busy} type="submit">{signup ? "Create account" : "Sign in"}</Button>
        </form>
        <p className="mt-5 text-center text-xs text-muted-foreground">
          {signup ? "Already have an account?" : "New admin?"}{" "}
          <button type="button" onClick={switchMode} className="font-semibold text-primary hover:underline">
            {signup ? "Sign in" : "Create an account"}
          </button>
        </p>
      </Card>
    </div>
  );
}
