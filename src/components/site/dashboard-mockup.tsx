import {
  LayoutGrid, Wallet, Trophy, FileText, Award, GraduationCap, CalendarDays, Newspaper, Monitor, LifeBuoy,
  ChevronDown, ChevronLeft, Plus, KeyRound, Share2, TrendingUp, Check, BarChart3, Sparkles,
} from "lucide-react";

const groups = [
  { t: "Dashboard", items: [[LayoutGrid, "Accounts"], [Wallet, "Payouts"], [Trophy, "Competitions"]] },
  { t: "Documents", items: [[FileText, "Contracts"], [Award, "Certificates"]] },
  { t: "Learn & Tools", items: [[GraduationCap, "Education"], [CalendarDays, "Economic Calendar"], [Newspaper, "News Feeds"], [Monitor, "Platforms"], [LifeBuoy, "Help Center"]] },
] as const;

const rules = [
  ["Max Loss", "$10,000", true],
  ["Daily Loss", "$4,000", true],
  ["Profit Target", "$8,000", true],
  ["Min. Days", "4 / 4", true],
  ["Consistency", "38%", false],
] as const;

/** Upward balance curve for the chart. */
const curve = [0, 4, 2, 7, 6, 11, 9, 14, 13, 18, 16, 21, 24, 22, 27, 30, 28, 33, 36, 35, 40, 44];
const path = (() => {
  const w = 400, h = 110, max = 46;
  return curve.map((v, i) => `${i ? "L" : "M"}${((i / (curve.length - 1)) * w).toFixed(1)},${(h - (v / max) * h).toFixed(1)}`).join(" ");
})();

/**
 * Static trader-dashboard screen inside a tablet frame. Rendered at a fixed 880px width;
 * the parent scales / crops it.
 */
export function DashboardTablet() {
  return (
    <div className="w-[880px] rounded-[30px] border border-white/15 bg-gradient-to-b from-zinc-700 to-zinc-900 p-[10px] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.9),0_0_60px_-20px_var(--primary)]">
      <div className="flex h-[560px] overflow-hidden rounded-[22px] bg-background text-[11px]">
        {/* Icon rail */}
        <div className="flex w-12 flex-col items-center gap-4 border-r border-white/[0.06] bg-sidebar py-4">
          <img src="/logo-mark.png" alt="" className="h-7 w-auto" />
          <span className="flex flex-col items-center gap-1 text-primary"><BarChart3 className="h-4 w-4" /><span className="text-[8px]">Overview</span></span>
          <span className="flex flex-col items-center gap-1 text-muted-foreground"><TrendingUp className="h-4 w-4" /><span className="text-[8px]">Stats</span></span>
        </div>

        {/* Sidebar */}
        <div className="w-44 border-r border-white/[0.06] bg-sidebar p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-display text-sm font-semibold">Bullish4ex</p>
              <p className="text-[9px] text-muted-foreground">Welcome back</p>
            </div>
            <ChevronLeft className="h-3 w-3 text-muted-foreground" />
          </div>
          <div className="mt-4 space-y-3">
            {groups.map((g) => (
              <div key={g.t}>
                <p className="flex items-center gap-1 px-1 text-[10px] text-muted-foreground"><ChevronDown className="h-3 w-3" />{g.t}</p>
                <div className="mt-1 space-y-0.5">
                  {g.items.map(([Icon, l]) => (
                    <div key={l} className={`flex items-center gap-2 rounded-md px-2 py-1.5 ${l === "Accounts" ? "bg-primary/15 text-primary" : "text-muted-foreground"}`}>
                      <Icon className="h-3.5 w-3.5" />{l}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Main */}
        <div className="flex-1 overflow-hidden p-4">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-1.5 text-muted-foreground"><LayoutGrid className="h-3.5 w-3.5" /> › <span className="text-foreground">Account details</span></p>
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1 rounded-md border border-white/10 px-2 py-1"><Wallet className="h-3 w-3 text-primary" />$4,820</span>
              <span className="flex items-center gap-1 rounded-md bg-gold px-2.5 py-1 font-semibold text-primary-foreground"><Plus className="h-3 w-3" />New Account</span>
            </div>
          </div>

          {/* Account meta */}
          <div className="mt-3 flex items-center gap-5 rounded-lg border border-white/[0.06] bg-card px-3 py-2">
            <span className="flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 font-medium">2-Step · 100K <ChevronDown className="h-3 w-3" /></span>
            {[["Status", <span key="s" className="flex items-center gap-1 text-profit"><span className="h-1.5 w-1.5 rounded-full bg-profit" />In progress</span>], ["Start Date", "26/09/2026"], ["Platform", "MetaTrader 5"], ["Program", "2-Step · 100K"], ["Initial Balance", "$100,000"]].map(([k, v]) => (
              <div key={k as string}>
                <p className="text-[9px] text-muted-foreground">{k}</p>
                <p className="font-medium">{v}</p>
              </div>
            ))}
            <span className="ml-auto flex items-center gap-1 rounded-md border border-white/10 px-2 py-1"><KeyRound className="h-3 w-3" />Credentials</span>
            <Share2 className="h-3.5 w-3.5 text-muted-foreground" />
          </div>

          {/* Stats */}
          <div className="mt-3 grid grid-cols-3 gap-3">
            {[
              ["Balance", "$122,788.50", "+$22,788.50 · +22.8%", true],
              ["Equity", "$122,788.50", "No open position", false],
              ["PnL", "+$22,788.50", "+22.79% since funded", true],
            ].map(([k, v, sub, up], i) => (
              <div key={k as string} className={`rounded-lg border p-3 ${i === 0 ? "border-primary/40 bg-primary/[0.08]" : "border-white/[0.06] bg-card"}`}>
                <p className="text-muted-foreground">{k}</p>
                <p className={`mt-1 font-display text-xl font-semibold ${i === 2 ? "text-profit" : ""}`}>{v}</p>
                <p className={`mt-1 text-[9px] ${up ? "text-profit" : "text-muted-foreground"}`}>{sub}</p>
              </div>
            ))}
          </div>

          {/* Phase progress */}
          <div className="mt-3 rounded-lg border border-white/[0.06] bg-card p-3">
            <div className="flex justify-between">
              <p className="font-medium">Phase Progress</p>
              <p className="text-[9px] text-muted-foreground">Phase 1 · 72% to next</p>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <span className="rounded-md bg-gold px-2 py-0.5 font-semibold text-primary-foreground">Phase 1</span>
              <span className="h-px flex-1 bg-gradient-to-r from-primary to-white/10" />
              <span className="rounded-md bg-white/[0.06] px-2 py-0.5 text-muted-foreground">Phase 2</span>
              <span className="h-px flex-1 bg-white/10" />
              <span className="flex items-center gap-1 rounded-md bg-white/[0.06] px-2 py-0.5 text-muted-foreground"><Sparkles className="h-3 w-3" />Funded</span>
            </div>
          </div>

          {/* Chart + rules */}
          <div className="mt-3 grid grid-cols-[1fr_190px] gap-3">
            <div className="rounded-lg border border-white/[0.06] bg-card p-3">
              <div className="flex items-center justify-between">
                <p className="font-medium">Balance Chart</p>
                <div className="flex gap-1 text-[9px]">
                  {["7D", "30D", "90D"].map((t, i) => <span key={t} className={`rounded px-1.5 py-0.5 ${i === 0 ? "bg-white/10" : "text-muted-foreground"}`}>{t}</span>)}
                </div>
              </div>
              <svg viewBox="0 0 400 120" className="mt-2 h-[120px] w-full" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="dash-fill" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0" stopColor="var(--primary)" stopOpacity="0.35" />
                    <stop offset="1" stopColor="var(--primary)" stopOpacity="0" />
                  </linearGradient>
                </defs>
                {[0, 30, 60, 90].map((y) => <line key={y} x1="0" x2="400" y1={y + 10} y2={y + 10} stroke="white" strokeOpacity="0.05" />)}
                <line x1="0" x2="400" y1="14" y2="14" stroke="var(--profit)" strokeDasharray="4 4" strokeOpacity="0.6" />
                <path d={`${path} L400,120 L0,120 Z`} fill="url(#dash-fill)" />
                <path d={path} fill="none" stroke="var(--primary)" strokeWidth="2" />
              </svg>
            </div>
            <div className="rounded-lg border border-white/[0.06] bg-card p-3">
              <p className="font-medium">Rules</p>
              <div className="mt-2 space-y-1.5">
                {rules.map(([k, v, ok]) => (
                  <div key={k} className={`flex items-center justify-between rounded-md px-2 py-1.5 ${ok ? "bg-profit/10" : "bg-primary/10"}`}>
                    <span className="flex items-center gap-1.5">
                      <span className={`flex h-3.5 w-3.5 items-center justify-center rounded-full ${ok ? "bg-profit text-background" : "border border-primary"}`}>{ok && <Check className="h-2.5 w-2.5" />}</span>
                      {k}
                    </span>
                    <span className="text-muted-foreground">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
