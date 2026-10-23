import { useEffect, type ReactNode } from "react";
import { Check, X } from "lucide-react";
import type { TradingAccount } from "@/lib/propApi";
import { sizeLabel, type AccountInfo } from "@/lib/portal";
import { cx } from "./ui";

/** Building blocks for the trader account view (header card, objectives, drawers). */

/* ---------------- plan badge ---------------- */

type BadgeKind = "challenge" | "phase2" | "funded";
const BADGE: Record<BadgeKind, { box: string; text: string; foot: string; line: string }> = {
  challenge: { box: "border-primary/60 from-[#3a2a0c] to-[#2a1f0a]", text: "text-primary", foot: "bg-[#3a2a0c]", line: "bg-primary/20" },
  phase2: { box: "border-sky-500/60 from-[#0c2238] to-[#0a1a2b]", text: "text-sky-400", foot: "bg-[#0c2238]", line: "bg-sky-400/20" },
  funded: { box: "border-profit/60 from-[#0a2d22] to-[#08221a]", text: "text-profit", foot: "bg-[#0a2d22]", line: "bg-profit/20" },
};

export const badgeKind = (info: AccountInfo): BadgeKind => (info.isFunded ? "funded" : info.phase.startsWith("Phase 2") ? "phase2" : "challenge");

export function PlanBadge({ info, className = "" }: { info: AccountInfo; className?: string }) {
  const kind = badgeKind(info);
  const c = BADGE[kind];
  const type = info.isFunded ? "Funded" : info.phase.split(" (")[0];
  return (
    <div className={cx("min-h-[90px] w-[125px] shrink-0 overflow-hidden rounded-[6px] border bg-gradient-to-b shadow-[0_15px_20px_0_rgba(0,0,0,0.3)] md:w-[140px]", c.box, className)}>
      <div className={cx("p-3 pb-2", c.text)}>
        <p className="text-xs font-medium">{type}</p>
        <p className="font-sans text-xl font-semibold tracking-[-0.8px]">{sizeLabel(info.size)}</p>
      </div>
      <div className={cx("h-px", c.line)} />
      <div className={cx("flex h-6 items-center px-3 text-[11px] font-semibold tracking-[0.66px] uppercase", c.foot, c.text)}>{info.model}</div>
    </div>
  );
}

const STATUS_CHIP: Record<TradingAccount["status"], string> = {
  Active: "bg-profit text-background",
  Funded: "bg-profit text-background",
  Passed: "bg-primary text-primary-foreground",
  Failed: "bg-loss text-white",
};

export function StatusChip({ status }: { status: TradingAccount["status"] }) {
  return <span className={cx("inline-flex h-5 items-center rounded-md px-1.5 text-xs leading-[14px] font-medium", STATUS_CHIP[status])}>{status === "Failed" ? "Breached" : status}</span>;
}

/* ---------------- objective indicators ---------------- */

const SEGMENTS = 40;

/**
 * 40-segment progress bar. `mode="profit"` fills green from the left;
 * `mode="loss"` fills amber → red and greys out the 80–100 % danger zone.
 */
export function SegmentedBar({ ratio, mode, className = "h-8" }: { ratio: number; mode: "profit" | "loss"; className?: string }) {
  const r = Math.max(0, Math.min(1, ratio));
  const filled = Math.round(r * SEGMENTS);
  const used = mode === "loss" ? (r < 0.5 ? "fill-amber-500" : "fill-loss") : "fill-profit";
  return (
    <svg className={cx("w-full", className)} viewBox="0 0 400 32" preserveAspectRatio="none" aria-hidden>
      {Array.from({ length: SEGMENTS }, (_, i) => (
        <rect
          key={i}
          x={i * 10.1}
          y={8}
          width={6.1}
          height={24}
          rx={1}
          className={i < filled ? used : mode === "loss" && i >= 32 ? "fill-white/[0.06]" : "fill-white/[0.14]"}
        />
      ))}
    </svg>
  );
}

/** One pill per required trading day; completed days turn green with a tick. */
export function DayPills({ done, total }: { done: number; total: number }) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: Math.max(1, total) }, (_, i) => (
        <span
          key={i}
          className={cx(
            "flex h-5 flex-1 items-center justify-center rounded-full border-[.5px]",
            i < done ? "border-transparent bg-profit text-background" : "border-white/15 bg-white/[0.06]",
          )}
        >
          {i < done && <Check className="size-3" strokeWidth={3} />}
        </span>
      ))}
    </div>
  );
}

/* ---------------- chips, tiles ---------------- */

export const chipCls =
  "inline-flex min-h-7 items-center gap-1.5 rounded-[4px] border border-border px-2.5 py-1.5 text-xs leading-[14px] font-medium text-foreground transition hover:bg-primary/10 hover:text-primary disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-3.5";

export function StatTile({ label, value, valueCls = "", hint }: { label: string; value: ReactNode; valueCls?: string; hint?: string }) {
  return (
    <div className="card-shadow flex h-[120px] w-[160px] shrink-0 flex-col rounded-2xl border border-border bg-card p-5 sm:w-auto">
      <p className="flex items-center gap-1.5 text-[13px] leading-5 font-medium text-muted-foreground">
        {label}
        {hint && <span title={hint} className="flex size-[13px] items-center justify-center rounded-full bg-muted-foreground text-[9px] font-bold text-background">i</span>}
      </p>
      <p className={cx("mt-auto truncate text-xl leading-6 font-semibold tabular-nums", valueCls)}>{value}</p>
    </div>
  );
}

/* ---------------- right sheet ---------------- */

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70]">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="animate-drawer-right absolute inset-y-0 right-0 mx-4 my-auto flex h-full max-h-[calc(100%-40px)] w-[calc(100vw-32px)] flex-col rounded-[10px] border border-border bg-card sm:max-w-[30rem]"
      >
        <div className="relative border-b border-border p-5">
          <h3 className="pr-10 font-sans text-lg leading-[22px] font-semibold">{title}</h3>
          <button aria-label="Close" onClick={onClose} className="absolute top-[11px] right-[11px] rounded-md p-2.5 text-muted-foreground hover:bg-foreground/5 hover:text-foreground"><X className="size-4" /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}
