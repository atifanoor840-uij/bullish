/**
 * UI kit for the trader dashboard and admin CRM. Minimal, card-based, token-driven:
 * cards are `rounded-2xl border bg-card`, profit/loss use the profit/loss tokens,
 * gold (primary) is the single accent.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { AlertCircle, Check, Copy, Inbox, Loader2, RefreshCw, X } from "lucide-react";
import { isUnauthorized } from "@/lib/propApi";
import { statusTone, type Tone } from "@/lib/portal";

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

/* ---------------- data ---------------- */

/**
 * Loads data with loading / error / reload. A 401 sends the visitor to `authPath`.
 */
export function useApi<T>(fn: () => Promise<T>, deps: unknown[] = [], authPath = "/login") {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await fnRef.current());
    } catch (e) {
      if (isUnauthorized(e)) {
        window.location.href = `${authPath}?next=${encodeURIComponent(window.location.pathname)}`;
        return;
      }
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [authPath]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => void reload(), deps);
  return { data, error, loading, reload, setData };
}

/** Runs an async action with a busy flag and an inline result message. */
export function useAction() {
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const run = async (key: string, fn: () => Promise<unknown>, success?: string) => {
    setBusy(key);
    setNote(null);
    try {
      await fn();
      if (success) setNote({ tone: "success", text: success });
      return true;
    } catch (e) {
      setNote({ tone: "error", text: e instanceof Error ? e.message : "Action failed" });
      return false;
    } finally {
      setBusy(null);
    }
  };
  return { busy, note, setNote, run };
}

/* ---------------- layout ---------------- */

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-[1.7rem]">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ children, className = "", highlight = false }: { children: ReactNode; className?: string; highlight?: boolean }) {
  return (
    <div
      className={cx(
        "rounded-2xl border bg-card",
        highlight
          ? "border-primary/40 bg-gradient-to-br from-primary/[0.16] via-primary/[0.04] to-card shadow-[0_18px_50px_-28px_var(--primary)]"
          : "border-white/[0.06]",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({ icon, title, meta, actions }: { icon?: ReactNode; title: string; meta?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-4">
      <div className="flex min-w-0 items-center gap-2.5">
        {icon && <span className="text-muted-foreground">{icon}</span>}
        <h2 className="truncate text-[15px] font-semibold">{title}</h2>
        {meta && <span className="text-xs text-muted-foreground">{meta}</span>}
      </div>
      {actions}
    </div>
  );
}

export function StatCard({ label, value, sub, icon, valueClass = "", highlight = false }: { label: string; value: ReactNode; sub?: ReactNode; icon?: ReactNode; valueClass?: string; highlight?: boolean }) {
  return (
    <Card highlight={highlight} className="relative overflow-hidden p-5">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{label}</p>
        {icon && <span className={cx("flex h-8 w-8 items-center justify-center rounded-full", highlight ? "bg-primary text-primary-foreground" : "bg-white/[0.05] text-muted-foreground")}>{icon}</span>}
      </div>
      <p className={cx("mt-3 truncate font-display text-[1.6rem] font-semibold leading-tight tabular-nums", valueClass)}>{value}</p>
      {sub && <div className="mt-1.5 text-xs text-muted-foreground">{sub}</div>}
    </Card>
  );
}

/* ---------------- controls ---------------- */

type BtnVariant = "primary" | "secondary" | "ghost" | "danger" | "success";
const btnCls: Record<BtnVariant, string> = {
  primary: "bg-gold text-primary-foreground shadow-gold hover:brightness-110",
  secondary: "border border-white/10 bg-white/[0.04] text-foreground hover:border-primary/40 hover:text-primary",
  ghost: "text-muted-foreground hover:bg-white/[0.05] hover:text-foreground",
  danger: "border border-loss/30 bg-loss/10 text-loss hover:bg-loss/20",
  success: "border border-profit/30 bg-profit/10 text-profit hover:bg-profit/20",
};

export function Button({
  children, variant = "secondary", size = "md", href, className = "", busy = false, ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: "sm" | "md"; href?: string; busy?: boolean }) {
  const cls = cx(
    "inline-flex items-center justify-center gap-2 rounded-lg font-semibold whitespace-nowrap transition disabled:pointer-events-none disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:outline-none",
    size === "sm" ? "px-3 py-1.5 text-xs" : "px-4 py-2.5 text-sm",
    btnCls[variant],
    className,
  );
  if (href) return <a href={href} className={cls}>{children}</a>;
  return (
    <button className={cls} disabled={busy || rest.disabled} {...rest}>
      {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
      {children}
    </button>
  );
}

const toneCls: Record<Tone, string> = {
  success: "bg-profit/15 text-profit",
  danger: "bg-loss/15 text-loss",
  warning: "bg-amber-500/15 text-amber-500",
  info: "bg-primary/15 text-primary",
  neutral: "bg-white/[0.06] text-muted-foreground",
};
const dotCls: Record<Tone, string> = { success: "bg-profit", danger: "bg-loss", warning: "bg-amber-500", info: "bg-primary", neutral: "bg-muted-foreground" };

export function Badge({ children, tone, dot = true }: { children: ReactNode; tone?: Tone; dot?: boolean }) {
  const t = tone ?? statusTone(String(children));
  return (
    <span className={cx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap", toneCls[t])}>
      {dot && <span className={cx("h-1.5 w-1.5 rounded-full", dotCls[t])} />}
      {children}
    </span>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: string; count?: number }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div role="tablist" className="no-scrollbar flex gap-1 overflow-x-auto rounded-xl border border-white/[0.06] bg-background p-1">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={t.id === value}
          onClick={() => onChange(t.id)}
          className={cx(
            "inline-flex shrink-0 items-center gap-2 rounded-lg px-3.5 py-1.5 text-sm transition",
            t.id === value ? "bg-white/[0.08] font-semibold text-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {t.label}
          {t.count !== undefined && <span className={cx("rounded-full px-1.5 text-[10px]", t.id === value ? "bg-primary text-primary-foreground" : "bg-white/[0.06]")}>{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

export const inputCls =
  "w-full rounded-lg border border-white/10 bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 transition focus:border-primary/60 focus:ring-2 focus:ring-primary/20 focus:outline-none";

export function Field({ label, hint, children, className = "" }: { label: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <label className={cx("block", className)}>
      <span className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-muted-foreground/80">{hint}</span>}
    </label>
  );
}

export function SearchInput({ value, onChange, placeholder = "Search…" }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={cx(inputCls, "sm:max-w-xs")} />;
}

/* ---------------- feedback ---------------- */

export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-20 text-sm text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin text-primary" /> {label}
    </div>
  );
}

export function ErrorNote({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-loss/25 bg-loss/10 px-4 py-3 text-sm text-loss">
      <AlertCircle className="h-4 w-4 shrink-0" />
      <span className="flex-1">{message}</span>
      {onRetry && <Button size="sm" variant="danger" onClick={onRetry}><RefreshCw className="h-3.5 w-3.5" />Retry</Button>}
    </div>
  );
}

export function Note({ tone, children }: { tone: "success" | "error" | "warning" | "info"; children: ReactNode }) {
  const cls = {
    success: "border-profit/25 bg-profit/10 text-profit",
    error: "border-loss/25 bg-loss/10 text-loss",
    warning: "border-amber-500/25 bg-amber-500/10 text-amber-500",
    info: "border-primary/25 bg-primary/10 text-primary",
  }[tone];
  return <div className={cx("rounded-xl border px-4 py-3 text-sm", cls)}>{children}</div>;
}

export function EmptyState({ title, body, action, icon }: { title: string; body?: string; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/[0.05] text-muted-foreground">{icon ?? <Inbox className="h-5 w-5" />}</span>
      <p className="mt-4 font-semibold">{title}</p>
      {body && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Progress({ label, used, limit, danger = false, format }: { label: string; used: number; limit: number; danger?: boolean; format: (n: number) => string }) {
  const w = limit > 0 ? Math.min(100, (Math.max(0, used) / limit) * 100) : 0;
  return (
    <div>
      <div className="mb-1.5 flex justify-between gap-2 text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium tabular-nums">{format(Math.max(0, used))} <span className="text-muted-foreground">/ {format(limit)}</span></span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
        <div className={cx("h-full rounded-full transition-all", danger ? (w > 70 ? "bg-loss" : "bg-amber-500") : "bg-profit")} style={{ width: `${w}%` }} />
      </div>
    </div>
  );
}

export function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      aria-label={label}
      onClick={() => {
        void navigator.clipboard?.writeText(value);
        setDone(true);
        setTimeout(() => setDone(false), 1200);
      }}
      className="rounded-md p-1 text-muted-foreground transition hover:bg-white/[0.06] hover:text-foreground"
    >
      {done ? <Check className="h-3.5 w-3.5 text-profit" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

/* ---------------- table ---------------- */

export type Column<T> = { key: string; label: string; render: (row: T) => ReactNode; className?: string };

/** Desktop table; collapses to stacked cards under md. */
export function DataTable<T>({ rows, columns, rowKey, empty, mobileTitle }: { rows: T[]; columns: Column<T>[]; rowKey: (r: T) => string; empty?: ReactNode; mobileTitle?: (r: T) => ReactNode }) {
  if (!rows.length) return <>{empty ?? <EmptyState title="Nothing here yet" />}</>;
  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-white/[0.06] text-[11px] tracking-wider text-muted-foreground uppercase">
              {columns.map((c) => <th key={c.key} className={cx("px-5 py-3 font-medium", c.className)}>{c.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={rowKey(r)} className="border-b border-white/[0.04] transition last:border-0 hover:bg-white/[0.02]">
                {columns.map((c) => <td key={c.key} className={cx("px-5 py-3.5 align-middle", c.className)}>{c.render(r)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="space-y-3 p-3 md:hidden">
        {rows.map((r) => (
          <div key={rowKey(r)} className="rounded-xl border border-white/[0.06] bg-background/40 p-4">
            {mobileTitle && <div className="mb-3 font-semibold">{mobileTitle(r)}</div>}
            <dl className="space-y-2 text-sm">
              {columns.map((c) => (
                <div key={c.key} className="flex items-center justify-between gap-4">
                  {c.label && <dt className="text-xs text-muted-foreground">{c.label}</dt>}
                  <dd className="min-w-0 text-right">{c.render(r)}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
    </>
  );
}

/** Client-side pagination for long tables. */
export function usePaged<T>(rows: T[], size = 15) {
  const [page, setPage] = useState(1);
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const cur = Math.min(page, pages);
  return { slice: rows.slice((cur - 1) * size, cur * size), page: cur, pages, setPage, total: rows.length };
}

export function Pager({ page, pages, setPage, total }: { page: number; pages: number; setPage: (p: number) => void; total: number }) {
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-between border-t border-white/[0.06] px-5 py-3 text-xs text-muted-foreground">
      <span>{total} records</span>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</Button>
        <span>{page} / {pages}</span>
        <Button size="sm" variant="ghost" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</Button>
      </div>
    </div>
  );
}

/* ---------------- modal ---------------- */

export function Modal({ open, onClose, title, children, footer, wide = false }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className={cx("flex max-h-[92vh] w-full flex-col rounded-t-2xl border border-white/10 bg-card shadow-2xl sm:rounded-2xl", wide ? "sm:max-w-2xl" : "sm:max-w-lg")}
      >
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
          <h3 className="font-semibold">{title}</h3>
          <button aria-label="Close" onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:bg-white/[0.06] hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <div className="overflow-y-auto px-5 py-5">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-white/[0.06] px-5 py-4">{footer}</div>}
      </div>
    </div>
  );
}
