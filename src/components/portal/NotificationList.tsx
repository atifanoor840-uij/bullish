import { CheckCircle2, AlertTriangle, XCircle, Info } from "lucide-react";
import { cx } from "./ui";
import type { Notification } from "@/lib/propApi";
import { fmtDate } from "@/lib/portal";

const ICON: Record<Notification["type"], [typeof Info, string]> = {
  info: [Info, "bg-primary/15 text-primary"],
  success: [CheckCircle2, "bg-profit/15 text-profit"],
  warning: [AlertTriangle, "bg-amber-500/15 text-amber-500"],
  error: [XCircle, "bg-loss/15 text-loss"],
};

export function NotificationList({ items, onRead }: { items: Notification[]; onRead?: (n: Notification) => void }) {
  return (
    <div className="divide-y divide-white/[0.05]">
      {items.map((n) => {
        const [Icon, cls] = ICON[n.type] ?? ICON.info;
        return (
          <button key={n.id} onClick={() => onRead?.(n)} className={cx("flex w-full items-start gap-4 px-5 py-4 text-left transition hover:bg-white/[0.02]", !n.read && "bg-primary/[0.03]")}>
            <span className={cx("flex h-9 w-9 shrink-0 items-center justify-center rounded-full", cls)}><Icon className="h-4 w-4" /></span>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 text-sm font-semibold">{n.title}{!n.read && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">{n.message}</p>
            </div>
            <span className="shrink-0 text-xs text-muted-foreground">{fmtDate(n.sentAt)}</span>
          </button>
        );
      })}
    </div>
  );
}
