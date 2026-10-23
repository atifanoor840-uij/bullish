import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import { BadgeCheck, Bell, ChevronsLeft, ChevronsRight, LogOut, Menu, X } from "lucide-react";
import { Logo } from "@/components/site/primitives";
import type { User } from "@/lib/propApi";
import { cx } from "./ui";

export type NavItem = { label: string; to: string; icon: ComponentType<{ className?: string }>; badge?: number; exact?: boolean };
export type NavGroup = { title?: string; items: NavItem[] };

/**
 * App shell shared by the trader dashboard and the admin CRM:
 * fixed top navbar, collapsible sidebar (drawer under xl), rounded content panel
 * and an optional phone bottom nav.
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
  const [collapsed, setCollapsed] = useState(false);
  const path = useRouterState({ select: (s) => s.location.pathname });
  useEffect(() => setOpen(false), [path]);

  const isActive = (item: NavItem) => (item.exact ? path === item.to || path === `${item.to}/` : path === item.to || path.startsWith(`${item.to}/`));
  const initial = (user?.name || "?").trim().charAt(0).toUpperCase();

  const sidebar = (mini: boolean, drawer: boolean) => (
    <div className="flex h-full flex-col bg-card">
      {/* User header */}
      <div className={cx("flex h-[62px] shrink-0 items-center gap-2.5 px-3.5 py-3.5", mini && "justify-center px-0")}>
        <span className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-primary/10 text-[17px] font-semibold text-primary">{initial}</span>
        {!mini && (
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1 text-sm leading-5 font-medium">
              <span className="truncate">{user?.name || "—"}</span>
              {user?.emailVerified !== false && <BadgeCheck className="size-4 shrink-0 text-primary" />}
            </p>
            <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
          </div>
        )}
        {drawer && (
          <button aria-label="Close menu" onClick={() => setOpen(false)} className="rounded-md p-2 text-muted-foreground hover:bg-white/[0.05]"><X className="size-5" /></button>
        )}
      </div>

      {!mini && (
        <div className="px-3.5 pt-1">
          <span className="block rounded-md border border-border px-2.5 py-[11px] text-center text-xs font-medium text-muted-foreground">{area} area</span>
        </div>
      )}
      {drawer && topActions && <div className="flex flex-wrap gap-2 px-3.5 pt-3">{topActions}</div>}

      <nav className="no-scrollbar min-h-0 flex-1 overflow-y-auto pb-4">
        {groups.map((g, gi) => (
          <div key={gi} className={gi > 0 ? "mt-3" : ""}>
            {!mini ? (
              <div className="flex items-center justify-between py-2.5 pr-3.5 pl-4">
                <p className="text-[11px] leading-5 font-medium tracking-wider text-muted-foreground uppercase">{g.title || "Menu"}</p>
                {gi === 0 && !drawer && (
                  <button aria-label="Collapse sidebar" onClick={() => setCollapsed(true)} className="rounded-md p-1 text-muted-foreground hover:bg-white/[0.05] hover:text-foreground"><ChevronsLeft className="size-4" /></button>
                )}
              </div>
            ) : gi === 0 ? (
              <div className="flex justify-center py-2.5">
                <button aria-label="Expand sidebar" onClick={() => setCollapsed(false)} className="rounded-md p-1 text-muted-foreground hover:bg-white/[0.05] hover:text-foreground"><ChevronsRight className="size-4" /></button>
              </div>
            ) : (
              <div className="mx-4 my-2 h-px bg-border" />
            )}
            <ul className={cx("flex flex-col gap-1.5", mini ? "items-center px-0" : "px-3.5")}>
              {g.items.map((item) => {
                const on = isActive(item);
                const Icon = item.icon;
                return (
                  <li key={item.to} className={mini ? "" : "w-full"}>
                    <Link
                      to={item.to}
                      title={mini ? item.label : undefined}
                      className={cx(
                        "relative flex items-center gap-2 rounded-md text-[13px] leading-5 font-medium transition [&_svg]:size-[18px]",
                        mini ? "size-9 justify-center" : "h-8 w-full p-2",
                        on ? "bg-primary/10 font-semibold text-primary" : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground",
                      )}
                    >
                      <Icon className="shrink-0" />
                      {!mini && <span className="flex-1 truncate">{item.label}</span>}
                      {!!item.badge && (mini
                        ? <span className="absolute top-1 right-1 size-2 rounded-full bg-primary" />
                        : <span className="rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">{item.badge}</span>)}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className={cx("border-t border-border py-3", mini ? "flex justify-center" : "px-3.5")}>
        <button
          onClick={onSignOut}
          title={mini ? "Log out" : undefined}
          className={cx("flex items-center gap-2 rounded-md text-[13px] font-medium text-muted-foreground transition hover:bg-loss/10 hover:text-loss [&_svg]:size-[18px]", mini ? "size-9 justify-center" : "h-8 w-full p-2")}
        >
          <LogOut />{!mini && "Log out"}
        </button>
      </div>
    </div>
  );

  return (
    <div className="portal-bg min-h-screen text-foreground antialiased">
      <div className="flex h-svh w-full overflow-hidden">
        {/* Navbar */}
        <nav className="portal-bg fixed inset-x-0 top-0 z-30 flex h-[62px] items-center border-b border-white/5 xl:border-b-0 xl:bg-none">
          <div className="flex flex-1 items-center justify-between px-2 xl:px-6">
            <div className="flex items-center gap-1">
              <button aria-label="Open menu" onClick={() => setOpen(true)} className="rounded-lg p-2 text-muted-foreground hover:bg-white/[0.05] xl:hidden"><Menu className="size-6" /></button>
              <Logo href="/dashboard" />
            </div>
            <div className="hidden items-center gap-2 md:flex">{topActions}</div>
            <div className="mr-3 flex items-center gap-1 md:gap-2">
              {notificationsTo && (
                <Link to={notificationsTo} aria-label="Notifications" className="relative flex size-9 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-white/[0.05] hover:text-foreground">
                  <Bell className="size-5" />
                  {unread > 0 && (
                    <span className="absolute -top-1.5 right-[2px] flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-loss px-1 text-[11px] font-semibold text-white">{unread > 99 ? "99+" : unread}</span>
                  )}
                </Link>
              )}
              <span className="flex min-h-7 items-center gap-2 rounded-[20px] bg-white/10 p-[3px] pr-3">
                <span className="flex size-[22px] items-center justify-center rounded-full bg-gold text-xs font-semibold text-primary-foreground">{initial}</span>
                <span className="hidden max-w-[9rem] truncate text-xs font-medium sm:block">{user?.name || "—"}</span>
              </span>
            </div>
          </div>
        </nav>

        {/* Desktop sidebar */}
        <aside className={cx("hidden shrink-0 pt-[62px] transition-[width] duration-200 xl:block", collapsed ? "w-16" : "w-60")}>
          <div className="h-full overflow-hidden rounded-tr-[2rem] border-t border-r border-border">{sidebar(collapsed, false)}</div>
        </aside>

        {/* Drawer (< xl) */}
        {open && (
          <div className="fixed inset-0 z-50 xl:hidden">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
            <aside className="animate-drawer-left absolute inset-y-0 left-0 w-72 max-w-[85%] border-r border-border">{sidebar(false, true)}</aside>
          </div>
        )}

        <main className="relative flex min-w-0 flex-1 flex-col pt-[62px]">
          <div className="h-full overflow-x-hidden overflow-y-auto rounded-t-[2rem] xl:ml-6 xl:mr-6">
            <div className="min-h-[calc(100vh-62px)] bg-background">
              <div className={cx("mx-auto max-w-[1440px] px-4 pt-6 lg:px-10", bottomNav ? "pb-28 lg:pb-10" : "pb-10")}>{children}</div>
            </div>
          </div>
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
