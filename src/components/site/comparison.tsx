import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { ArrowUpRight, Zap, Clock, ListChecks, MonitorSmartphone, ShieldCheck } from "lucide-react";
import { Pill, Reveal } from "./primitives";

const features = [
  { icon: Zap, t: "Fast Account Delivery", d: "Get your simulated account details soon after checkout." },
  { icon: Clock, t: "No Time Limits", d: "Take as long as you need to complete your evaluation." },
  { icon: ListChecks, t: "Clear Trading Rules", d: "Simple targets and drawdown limits, tracked live on your dashboard." },
  { icon: MonitorSmartphone, t: "Simulated Environment", d: "Practice on demo accounts only. No live market execution." },
  { icon: ShieldCheck, t: "Secure Platform", d: "Secure checkout with card, crypto and bank transfer." },
];

/** "Why Bullish4ex" — numbered feature list (auto-advancing) with a visual for the active item. */
export function Comparison() {
  const [active, setActive] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setActive((a) => (a + 1) % features.length), 5000);
    return () => clearInterval(id);
  }, [active]);
  const cur = features[active]!;
  const CurIcon = cur.icon;

  return (
    <section id="why" className="relative py-24 md:py-32">
      <div className="mx-auto max-w-7xl px-5">
        <Reveal>
          <Pill>Why Bullish4ex</Pill>
          <h2 className="text-silver mt-5 text-4xl font-semibold leading-[1.08] tracking-tight md:text-6xl">Built For Traders</h2>
        </Reveal>

        <div className="mt-12 grid gap-8 lg:grid-cols-[1fr_1fr] lg:items-center">
          <Reveal className="border-t border-white/[0.08]">
            {features.map((f, i) => {
              const on = i === active;
              return (
                <button
                  key={f.t}
                  onClick={() => setActive(i)}
                  className="flex w-full items-center gap-5 border-b border-white/[0.08] py-6 text-left"
                >
                  <span className={`w-6 shrink-0 font-mono text-xs ${on ? "text-foreground" : "text-muted-foreground"}`}>0{i + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className={`block font-display font-semibold tracking-tight transition-all ${on ? "text-2xl text-foreground md:text-3xl" : "text-xl text-muted-foreground md:text-2xl"}`}>{f.t}</span>
                    <AnimatePresence initial={false}>
                      {on && (
                        <motion.span initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="block overflow-hidden">
                          <span className="block pt-1.5 text-sm text-muted-foreground md:text-base">{f.d}</span>
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </span>
                  {on && (
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gold text-primary-foreground shadow-gold">
                      <ArrowUpRight className="h-5 w-5" />
                    </span>
                  )}
                </button>
              );
            })}
          </Reveal>

          <Reveal delay={0.1} className="rounded-3xl border border-primary/20 bg-white/[0.02] p-3">
            <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-b from-primary/[0.12] to-transparent">
              {/* Concentric rings */}
              {[90, 65, 40].map((s) => (
                <span key={s} className="absolute rounded-full border border-primary/15" style={{ width: `${s}%`, aspectRatio: "1" }} />
              ))}
              <AnimatePresence mode="wait">
                <motion.span
                  key={active}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.35 }}
                  className="relative flex h-28 w-28 items-center justify-center rounded-full bg-gold text-primary-foreground shadow-gold md:h-36 md:w-36"
                >
                  <CurIcon className="h-12 w-12 md:h-16 md:w-16" />
                </motion.span>
              </AnimatePresence>
            </div>
            <div className="flex items-center gap-4 px-3 pt-5 pb-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gold text-primary-foreground"><CurIcon className="h-5 w-5" /></span>
              <div>
                <p className="font-display text-lg font-semibold">{cur.t}</p>
                <p className="text-sm text-muted-foreground">{cur.d}</p>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
