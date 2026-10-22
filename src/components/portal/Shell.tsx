import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import { Bell, LogOut, Menu, X } from "lucide-react";
import { Logo } from "@/components/site/primitives";
import type { User } from "@/lib/propApi";
import { cx } from "./ui";

export type NavItem = { label: string; to: string; icon: ComponentType<{ className?: string }>; badge?: number; exact?: boolean };
export type NavGroup = { title?: string; items: NavItem[] };

/**
 * App shell shared by the trader dashboard and the admin CRM:
 * sticky top bar, sidebar (drawer under lg), and an optional phone bottom nav.
 */
export function Shell({
  groups, user, area, onSignOut, topActions, bottomNav, notificationsTo, unread = 0, children,
}: {
  groups: NavGroup[];
  user: User | null;
  area: string;
  onSignOut: () => void;
  topActions?: ReactNode;
  bottomNav?: NavItem[];
  notificationsTo?: string;
  unread?: number;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const path = useRouterState({ select: (s) => s.location.pathname });
  useEffect(() => setOpen(false), [path]);

  const isActive = (item: NavItem) => (item.exact ? path === item.to || path === `${item.to}/` : path === item.to || path.startsWith(`${item.to}/`));

  const nav = (
    <nav className="flex h-full flex-col gap-6 overflow-y-auto px-3 py-5 no-scrollbar">
      {groups.map((g, i) => (
        <div key={i}>
          {g.title && <p className="mb-2 px-3 text-[10px] font-semibold tracking-widest text-muted-foreground/70 uppercase">{g.title}</p>}
          <div className="space-y-0.5">
            {g.items.map((item) => {
              const on = isActive(item);
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cx(
                    "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition",
                    on ? "bg-primary/10 font-semibold text-primary" : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground",
                  )}
                >
                  <Icon className="h-[18px] w-[18px] shrink-0" />
                  <span className="flex-1 truncate">{item.label}</span>
                  {!!item.badge && <span className="rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">{item.badge}</span>}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );

  const initials = (user?.name || "?").split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="min-h-screen bg-background text-foreground antialiased">
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-background/90 backdrop-blur-xl">
        <div className="flex h-16 items-center gap-3 px-4 lg:px-6">
          <button aria-label="Open menu" onClick={() => setOpen(true)} className="rounded-lg p-2 text-muted-foreground hover:bg-white/[0.05] lg:hidden">
            <Menu className="h-5 w-5" />
          </button>
          <Logo />
          <span className="hidden rounded-full border border-white/10 px-2.5 py-0.5 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase sm:inline">{area}</span>
          <div className="ml-auto flex items-center gap-2">
            <div className="hidden items-center gap-2 md:flex">{topActions}</div>
            {notificationsTo && (
              <Link to={notificationsTo} aria-label="Notifications" className="relative rounded-lg p-2 text-muted-foreground transition hover:bg-white/[0.05] hover:text-foreground">
                <Bell className="h-5 w-5" />
                {unread > 0 && <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-primary ring-2 ring-background" />}
              </Link>
            )}
            <div className="flex items-center gap-2.5 rounded-full border border-white/[0.06] py-1 pr-1 pl-3">
              <div className="hidden text-right leading-tight sm:block">
                <p className="max-w-[10rem] truncate text-xs font-semibold">{user?.name || "—"}</p>
                <p className="text-[10px] text-muted-foreground capitalize">{user?.role}</p>
              </div>
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gold text-xs font-bold text-primary-foreground">{initials}</span>
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Desktop sidebar */}
        <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-64 shrink-0 flex-col border-r border-white/[0.06] lg:flex">
          <div className="min-h-0 flex-1">{nav}</div>
          <button onClick={onSignOut} className="m-3 flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition hover:bg-loss/10 hover:text-loss">
            <LogOut className="h-[18px] w-[18px]" /> Sign out
          </button>
        </aside>

        {/* Mobile drawer */}
        {open && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
            <aside className="absolute inset-y-0 left-0 flex w-[85%] max-w-xs flex-col border-r border-white/[0.06] bg-card">
              <div className="flex h-16 items-center justify-between border-b border-white/[0.06] px-4">
                <Logo />
                <button aria-label="Close menu" onClick={() => setOpen(false)} className="rounded-lg p-2 text-muted-foreground hover:bg-white/[0.05]"><X className="h-5 w-5" /></button>
              </div>
              {topActions && <div className="flex flex-wrap gap-2 border-b border-white/[0.06] p-3">{topActions}</div>}
              <div className="min-h-0 flex-1">{nav}</div>
              <button onClick={onSignOut} className="m-3 flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-loss/10 hover:text-loss">
                <LogOut className="h-[18px] w-[18px]" /> Sign out
              </button>
            </aside>
          </div>
        )}

        <main className={cx("min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8", bottomNav ? "pb-28 lg:pb-10" : "pb-10")}>
          <div className="mx-auto max-w-[1400px]">{children}</div>
        </main>
      </div>

      {/* Phone bottom nav */}
      {bottomNav && (
        <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-white/[0.06] bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden">
          {bottomNav.map((item) => {
            const Icon = item.icon;
            const on = isActive(item);
            return (
              <Link key={item.to} to={item.to} className={cx("flex flex-col items-center gap-1 py-2.5 text-[10px]", on ? "text-primary" : "text-muted-foreground")}>
                <Icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}
