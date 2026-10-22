import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "framer-motion";
import { useRef, useState, type ReactNode } from "react";
import {
  Wallet, CalendarClock, ShieldCheck, TrendingUp, X, ChevronDown, LayoutGrid, Trophy, FileText,
  BarChart3, Check, Clock, Plus, Bitcoin, ArrowUpRight, Zap,
} from "lucide-react";
import { SectionHead } from "./primitives";

const features = [
  { icon: Wallet, t: "Flexible Payout", d: "Secure payouts via Rise or crypto. Your capital, your way." },
  { icon: CalendarClock, t: "Rapid Liquidity", d: "Request a payout every 14 days, up to 6% of your balance per cycle." },
  { icon: ShieldCheck, t: "Fast Payouts", d: "Approved payouts are processed in 1 hour on average." },
  { icon: TrendingUp, t: "Maximised Edge", d: "Start at 80% and grow to 90% from your third payout." },
];

/* ---------------- Mock dashboard pieces ---------------- */

function Modal({ title, sub, children }: { title: string; sub: string; children: ReactNode }) {
  return (
    <div className="w-full max-w-md rounded-xl border border-white/10 bg-card/95 p-5 shadow-2xl shadow-black/60 backdrop-blur">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-display text-base font-semibold">{title}</p>
          <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
        </div>
        <X className="h-4 w-4 text-primary" />
      </div>
      <div className="mt-5">{children}</div>
    </div>
  );
}

const Field = ({ label, value, muted = false }: { label: string; value: string; muted?: boolean }) => (
  <div>
    <p className="mb-1.5 text-[11px] text-muted-foreground">{label}</p>
    <div className={`flex items-center justify-between rounded-lg border border-white/10 px-3 py-2 text-xs ${muted ? "text-muted-foreground" : ""}`}>
      {value}<ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
    </div>
  </div>
);

function PayoutMethodScreen() {
  const methods = [
    { n: "Crypto", i: <Bitcoin className="h-3.5 w-3.5" />, c: "bg-orange-500" },
    { n: "Rise", i: <ArrowUpRight className="h-3.5 w-3.5" />, c: "bg-indigo-500" },
    { n: "Wise", i: <Zap className="h-3.5 w-3.5" />, c: "bg-lime-500" },
  ];
  return (
    <Modal title="Add Payout Method" sub="Save a destination once, then pick it on any withdrawal.">
      <p className="mb-2 text-[11px] text-muted-foreground">Method type</p>
      <div className="grid grid-cols-3 gap-2">
        {methods.map((m, i) => (
          <div key={m.n} className={`flex flex-col items-center gap-2 rounded-lg border py-3 text-xs ${i === 0 ? "border-primary bg-primary/10 shadow-gold" : "border-white/10"}`}>
            <span className={`flex h-6 w-6 items-center justify-center rounded-full text-white ${m.c}`}>{m.i}</span>
            {m.n}
          </div>
        ))}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <Field label="Currency" value="Bitcoin (BTC)" />
        <Field label="Network type" value="Select network" muted />
      </div>
      <p className="mt-4 mb-1.5 text-[11px] text-muted-foreground">Wallet address</p>
      <div className="rounded-lg border border-white/10 px-3 py-2 text-xs text-muted-foreground">Enter your wallet address</div>
    </Modal>
  );
}

function LiquidityScreen() {
  const opts = [
    { t: "Every 14 days", d: "All funded accounts · up to 6% of balance", tag: "Cycle" },
    { t: "Minimum $100", d: "Smaller amounts roll into the next cycle", tag: "" },
    { t: "3 profitable days", d: "Each closing at least +0.5% · 5 days on Instant", tag: "Required" },
  ];
  return (
    <Modal title="Payout Schedule" sub="How and when your profits are released.">
      <div className="space-y-2">
        {opts.map((o, i) => (
          <div key={o.t} className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 ${i === 0 ? "border-primary bg-primary/10" : "border-white/10"}`}>
            <span className={`flex h-4 w-4 items-center justify-center rounded-full border ${i === 0 ? "border-primary bg-primary" : "border-white/25"}`}>
              {i === 0 && <Check className="h-2.5 w-2.5 text-background" />}
            </span>
            <div className="flex-1">
              <p className="text-xs font-semibold">{o.t}</p>
              <p className="text-[11px] text-muted-foreground">{o.d}</p>
            </div>
            {o.tag && <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] text-muted-foreground">{o.tag}</span>}
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center justify-between rounded-lg bg-white/[0.04] px-3 py-2.5 text-xs">
        <span className="text-muted-foreground">Next eligible payout</span>
        <span className="font-semibold text-primary">Available now</span>
      </div>
    </Modal>
  );
}

function FastPayoutScreen() {
  const rows = [
    ["#PX-20931", "$7,420.00", "47m"],
    ["#PX-20874", "$3,180.50", "1h 12m"],
    ["#PX-20811", "$12,965.00", "38m"],
  ];
  return (
    <Modal title="Payout Approved" sub="Funds sent to your USDT · TRC20 wallet.">
      <div className="flex items-center gap-3 rounded-lg border border-profit/30 bg-profit/10 p-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-profit/20 text-profit"><Check className="h-4 w-4" /></span>
        <div className="flex-1">
          <p className="text-xs font-semibold">$7,420.00 processed</p>
          <p className="text-[11px] text-muted-foreground">Requested 10:02 · Paid 10:49</p>
        </div>
        <span className="font-display text-sm font-semibold text-profit">47m</span>
      </div>
      <div className="mt-4 divide-y divide-white/[0.06] rounded-lg border border-white/10 text-xs">
        {rows.map(([id, amt, t]) => (
          <div key={id} className="flex items-center justify-between px-3 py-2.5">
            <span className="text-muted-foreground">{id}</span>
            <span className="font-medium">{amt}</span>
            <span className="flex items-center gap-1 text-profit"><Clock className="h-3 w-3" />{t}</span>
          </div>
        ))}
      </div>
    </Modal>
  );
}

function EdgeScreen() {
  const bars = [
    { l: "1st payout", v: 80 },
    { l: "2nd payout", v: 85 },
    { l: "3rd payout onwards", v: 90 },
  ];
  return (
    <Modal title="Profit Split" sub="Keep more of what you make as you scale.">
      <div className="space-y-4">
        {bars.map((b, i) => (
          <div key={b.l}>
            <div className="mb-1.5 flex justify-between text-xs">
              <span className="text-muted-foreground">{b.l}</span>
              <span className={`font-semibold ${i === 2 ? "text-primary" : ""}`}>{b.v}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
              <motion.div className={`h-full rounded-full ${i === 2 ? "bg-gold" : "bg-white/30"}`} initial={{ width: 0 }} animate={{ width: `${b.v}%` }} transition={{ duration: 0.9, delay: i * 0.12, ease: "easeOut" }} />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-5 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-lg bg-white/[0.04] p-3"><p className="text-muted-foreground">Your profit</p><p className="mt-1 font-display text-base font-semibold">$10,000</p></div>
        <div className="rounded-lg bg-primary/10 p-3"><p className="text-muted-foreground">You receive</p><p className="mt-1 font-display text-base font-semibold text-primary">$9,000</p></div>
      </div>
    </Modal>
  );
}

const screens = [PayoutMethodScreen, LiquidityScreen, FastPayoutScreen, EdgeScreen];

/** Blurred dashboard shell that sits behind each modal. */
function DashboardShell() {
  const nav = [[LayoutGrid, "Accounts"], [Wallet, "Payouts"], [Trophy, "Competitions"], [FileText, "Certificates"], [BarChart3, "Analytics"]] as const;
  return (
    <div className="pointer-events-none absolute inset-0 flex opacity-50 blur-[2px]" aria-hidden>
      <div className="hidden w-48 shrink-0 border-r border-white/[0.06] bg-sidebar p-4 sm:block">
        <p className="flex items-center gap-2 font-display text-sm font-bold"><img src="/logo-mark.png" alt="" className="h-6 w-auto" /><span>BULLISH<span className="text-primary">4</span>EX</span></p>
        <p className="text-[10px] text-muted-foreground">Welcome, trader</p>
        <div className="mt-6 space-y-1">
          {nav.map(([Icon, l]) => (
            <div key={l} className={`flex items-center gap-2 rounded-md px-2 py-2 text-xs ${l === "Payouts" ? "bg-primary/10 text-primary" : "text-muted-foreground"}`}>
              <Icon className="h-3.5 w-3.5" />{l}
            </div>
          ))}
        </div>
      </div>
      <div className="flex-1 p-5">
        <div className="flex items-center justify-between">
          <p className="font-display text-lg font-semibold">Payouts</p>
          <span className="flex items-center gap-1 rounded-full bg-gold px-3 py-1.5 text-[11px] font-semibold text-primary-foreground"><Plus className="h-3 w-3" />New Account</span>
        </div>
        <div className="mt-5 flex gap-4 border-b border-white/[0.06] pb-2 text-xs text-muted-foreground">
          <span>Request Payout</span><span>Payout History</span><span className="text-foreground">Payout Methods</span>
        </div>
        <div className="mt-5 space-y-3">
          {["Rise · Default", "Bitcoin · BTC", "USDT · TRC20"].map((m) => (
            <div key={m} className="flex items-center gap-3 rounded-lg border border-white/[0.06] bg-card/60 p-3 text-xs">
              <span className="h-6 w-9 rounded bg-white/10" />{m}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------------- Section ---------------- */

/**
 * Sticky, scroll-driven showcase: as the user scrolls through the section the active
 * feature advances and the dashboard screen swaps to match it.
 */
export function PayoutShowcase() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const [progress, setProgress] = useState(0);
  useMotionValueEvent(scrollYProgress, "change", setProgress);
  const n = features.length;
  const active = Math.min(n - 1, Math.floor(progress * n));
  const Screen = screens[active]!;

  const jump = (i: number) => {
    const el = ref.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top: top + ((el.offsetHeight - window.innerHeight) * (i + 0.05)) / n, behavior: "smooth" });
  };

  return (
    <section id="payouts" className="relative">
      <div className="mx-auto max-w-7xl px-5 pt-24 md:pt-32">
        <SectionHead
          label="Payouts"
          title={<>Your profits,<br /><span className="text-gold">on your terms.</span></>}
          sub="Flexible methods, rapid schedules and some of the fastest processing times in the industry."
        />
      </div>

      <div ref={ref} className="relative" style={{ height: `${n * 75}vh` }}>
        <div className="sticky top-0 flex h-screen flex-col justify-center overflow-hidden">
          <div className="mx-auto w-full max-w-6xl px-5">
            {/* Screen */}
            <div className="relative rounded-2xl border border-primary/25 bg-gradient-to-b from-white/[0.04] to-transparent p-2 shadow-[0_0_60px_-20px_var(--primary)] md:p-3">
              <div className="relative h-[330px] overflow-hidden rounded-xl border border-white/[0.06] bg-background sm:h-[380px] md:h-[440px]">
                <DashboardShell />
                <div className="absolute inset-0 bg-gradient-to-b from-background/20 via-background/40 to-background/80" />
                <div className="absolute inset-0 flex items-center justify-center p-4">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={active}
                      className="flex w-full justify-center"
                      initial={{ opacity: 0, y: 24, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -16, scale: 0.98 }}
                      transition={{ duration: 0.4, ease: "easeOut" }}
                    >
                      <Screen />
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>
            </div>

            {/* Feature tabs with progress */}
            <div className="mt-8 grid grid-cols-2 gap-x-6 gap-y-6 md:mt-10 md:grid-cols-4">
              {features.map((f, i) => {
                const Icon = f.icon;
                const on = i === active;
                const fill = Math.max(0, Math.min(1, progress * n - i));
                return (
                  <button key={f.t} onClick={() => jump(i)} className="group text-left">
                    <div className="h-px w-full bg-white/[0.08]">
                      <div className="h-px bg-primary shadow-[0_0_8px_var(--primary)]" style={{ width: `${fill * 100}%` }} />
                    </div>
                    <div className={`pt-5 transition-opacity duration-300 ${on ? "opacity-100" : "opacity-40 group-hover:opacity-70"}`}>
                      <Icon className={`h-5 w-5 ${on ? "text-primary" : ""}`} />
                      <p className="mt-3 font-display text-base font-semibold md:text-lg">{f.t}</p>
                      <p className={`mt-1.5 hidden text-sm leading-relaxed sm:block ${on ? "text-primary/90" : "text-muted-foreground"}`}>{f.d}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
