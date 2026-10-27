import { motion } from "framer-motion";
import { Check, X, Minus, Shield, ArrowUpRight } from "lucide-react";
import { comparison, scaling } from "@/lib/site-data";
import { Reveal, SectionHead, CtaButton } from "./primitives";

export function Comparison() {
  return (
    <section className="relative py-24 md:py-32">
      <div className="mx-auto max-w-7xl px-5">
        <SectionHead
          label="Why Bullish4ex"
          title={<>Trader-focused rules.<br />Transparent evaluations.</>}
          sub="Compare our skill-based evaluation parameters and simulated trading conditions with industry alternatives."
        />

        <Reveal className="glass mx-auto max-w-4xl overflow-hidden p-2 sm:p-6">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[500px] text-left text-sm">
              <thead>
                <tr className="border-b border-white/[0.08]">
                  <th className="p-4 font-medium text-muted-foreground">Key Feature</th>
                  <th className="p-4 font-display font-semibold text-primary">Bullish 4ex</th>
                  <th className="p-4 font-medium text-muted-foreground">Other Prop Firms</th>
                </tr>
              </thead>
              <tbody>
                {comparison.map((c, i) => (
                  <tr key={c.label} className="border-b border-white/[0.04] transition hover:bg-white/[0.02]">
                    <td className="p-4 font-medium text-foreground/90">{c.label}</td>
                    <td className="p-4">
                      {typeof c.us === "boolean" ? (
                        c.us ? (
                          <span className="inline-flex items-center gap-1.5 font-medium text-primary">
                            <Check className="h-4 w-4" /> Allowed
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                            <Minus className="h-4 w-4" /> No
                          </span>
                        )
                      ) : (
                        <span className="font-display font-bold text-foreground">{c.us}</span>
                      )}
                    </td>
                    <td className="p-4 text-muted-foreground">
                      {typeof c.them === "boolean" ? (
                        c.them ? (
                          <span className="inline-flex items-center gap-1.5 text-foreground/80">
                            <Check className="h-4 w-4" /> Allowed
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-loss/80">
                            <X className="h-4 w-4" /> Restricted
                          </span>
                        )
                      ) : (
                        <span>{c.them}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export function ScalingPlan() {
  return (
    <section id="scaling" className="relative py-24 md:py-32">
      <div className="spotlight pointer-events-none absolute top-1/2 left-1/2 h-[450px] w-[800px] -translate-x-1/2 -translate-y-1/2 opacity-40" />
      <div className="mx-auto max-w-7xl px-5">
        <SectionHead
          align="left"
          label="Scaling roadmap"
          title={<>Scale your simulated balance up to $2,000,000.</>}
          sub="Consistent disciplined trading unlocks exponential account scaling and up to a 90% profit share."
        />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {scaling.map((s, idx) => (
            <Reveal
              key={s.step}
              delay={idx * 0.1}
              className={`glass flex flex-col justify-between p-6 ${
                idx === scaling.length - 1 ? "glass-gold border-primary/40" : "glass-hover"
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                    {s.step}
                  </span>
                  <span className="text-[11px] text-muted-foreground">Tier 0{idx + 1}</span>
                </div>
                <p className="mt-4 font-display text-3xl font-bold tracking-tight text-foreground">
                  {s.size}
                </p>
                <p className="mt-1 text-sm font-semibold text-primary">{s.split} Profit Split</p>
              </div>
              <div className="mt-8 border-t border-white/[0.06] pt-4">
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Requirement</p>
                <p className="mt-1 text-xs text-foreground/80 font-medium">{s.req}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
