import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import {
  LayoutGrid, PlusCircle, Receipt, Wallet, Award, Users, ShieldCheck, Bell, Settings, Loader2, MailWarning, ShieldAlert, ArrowLeft, Gift,
} from "lucide-react";
import { Shell, type NavGroup, type NavItem } from "@/components/portal/Shell";
import { PortalCtx } from "@/components/portal/context";
import { Button } from "@/components/portal/ui";
import { propApi, isUnauthorized, type User } from "@/lib/propApi";
import { clearImpersonation, exitImpersonation, getImpersonation, type Impersonation } from "@/lib/impersonation";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Bullish 4ex" },
      { name: "description", content: "Track your challenges, funded accounts, payouts and verification." },
    ],
  }),
  component: DashboardLayout,
});

const groups: NavGroup[] = [
  {
    title: "Trading",
    items: [
      { label: "Accounts", to: "/dashboard", icon: LayoutGrid, exact: true },
      { label: "New Challenge", to: "/dashboard/new-challenge", icon: PlusCircle },
      { label: "Offers", to: "/dashboard/offers", icon: Gift },
      { label: "Orders", to: "/dashboard/orders", icon: Receipt },
    ],
  },
  {
    title: "Earnings",
    items: [
      { label: "Payouts", to: "/dashboard/payouts", icon: Wallet },
      { label: "Certificates", to: "/dashboard/certificates", icon: Award },
      { label: "Referrals", to: "/dashboard/referrals", icon: Users },
    ],
  },
  {
    title: "Account",
    items: [
      { label: "Verification", to: "/dashboard/kyc", icon: ShieldCheck },
      { label: "Notifications", to: "/dashboard/notifications", icon: Bell },
      { label: "Settings", to: "/dashboard/settings", icon: Settings },
    ],
  },
];

const bottomNav: NavItem[] = [
  { label: "Accounts", to: "/dashboard", icon: LayoutGrid, exact: true },
  { label: "Payouts", to: "/dashboard/payouts", icon: Wallet },
  { label: "Buy", to: "/dashboard/new-challenge", icon: PlusCircle },
  { label: "Orders", to: "/dashboard/orders", icon: Receipt },
  { label: "Settings", to: "/dashboard/settings", icon: Settings },
];

function DashboardLayout() {
  const [user, setUser] = useState<User | null>(null);
  const [unread, setUnread] = useState(0);
  const [error, setError] = useState("");
  const [imp, setImp] = useState<Impersonation | null>(null);

  const refreshUser = useCallback(async () => {
    try {
      const { user } = await propApi.auth.me();
      if (user.role === "admin" || user.role === "support") {
        window.location.href = "/admin";
        return;
      }
      setUser(user);
      // "Log in as user" from the CRM: show the admin banner only for that user.
      const marker = getImpersonation();
      if (marker && marker.userId === user.id) setImp(marker);
      else if (marker) clearImpersonation();
    } catch (e) {
      if (isUnauthorized(e)) window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
      else setError(e instanceof Error ? e.message : "Could not reach the server");
    }
  }, []);

  const refreshUnread = useCallback(() => {
    propApi.notifications.list().then((r) => setUnread(r.notifications.filter((n) => !n.read).length)).catch(() => {});
  }, []);

  useEffect(() => {
    void refreshUser();
    refreshUnread();
  }, [refreshUser, refreshUnread]);

  const signOut = async () => {
    if (imp) return exitImpersonation();
    await propApi.auth.signout().catch(() => {});
    window.location.href = "/login";
  };

  if (!user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center text-sm text-muted-foreground">
        {error ? (
          <>
            <p className="text-loss">{error}</p>
            <Button onClick={() => { setError(""); void refreshUser(); }}>Try again</Button>
          </>
        ) : (
          <><Loader2 className="h-6 w-6 animate-spin text-primary" />Loading your dashboard…</>
        )}
      </div>
    );
  }

  const navWithBadges = groups.map((g) => ({ ...g, items: g.items.map((i) => (i.to === "/dashboard/notifications" ? { ...i, badge: unread } : i)) }));

  return (
    <PortalCtx.Provider value={{ user, refreshUser, refreshUnread }}>
      <Shell
        groups={navWithBadges}
        user={user}
        area="Trader"
        onSignOut={signOut}
        bottomNav={bottomNav}
        notificationsTo="/dashboard/notifications"
        unread={unread}
        topActions={<Button variant="primary" size="sm" href="/dashboard/new-challenge"><PlusCircle className="h-4 w-4" />Start Challenge</Button>}
      >
        {imp && (
          <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-primary/40 bg-primary/10 px-4 py-3 text-sm">
            <ShieldAlert className="h-4 w-4 shrink-0 text-primary" />
            <span className="flex-1">
              <span className="font-semibold text-primary">Admin view</span> — you are logged in as <span className="font-semibold">{user.name}</span>{" "}
              <span className="text-muted-foreground">({user.email}) · opened by {imp.admin}</span>
            </span>
            <Button size="sm" variant="primary" onClick={() => void exitImpersonation()}><ArrowLeft className="h-3.5 w-3.5" />Back to CRM</Button>
          </div>
        )}
        {user.emailVerified === false && (
          <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-500">
            <MailWarning className="h-4 w-4 shrink-0" />
            <span className="flex-1">Please verify your email address to secure your account.</span>
            <Button size="sm" variant="ghost" onClick={() => propApi.auth.resendVerification(user.email)}>Resend email</Button>
          </div>
        )}
        <Outlet />
      </Shell>
    </PortalCtx.Provider>
  );
}
