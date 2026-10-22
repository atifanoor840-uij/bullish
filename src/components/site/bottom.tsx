import { motion } from "framer-motion";
import { useState } from "react";
import { Award, ChevronDown, Check, ArrowRight, ShieldCheck, Headphones, Zap, TrendingUp, DollarSign } from "lucide-react";
import { faqs } from "@/lib/site-data";
import { DashboardTablet } from "./dashboard-mockup";
import { Reveal, SectionHead, CtaButton, GhostButton, Logo, fmt } from "./primitives";

export function FaqSection() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" className="relative py-24 md:py-32">
      <div className="mx-auto max-w-4xl px-5">
        <SectionHead
          label="Frequently Asked Questions"
          title={<>Everything you need to know.</>}
          sub="Transparent answers to all your questions about evaluation rules, scaling, and payout terms."
        />

        <div className="space-y-3">
          {faqs.map(([q, a], i) => (
            <Reveal key={q} delay={i * 0.05} className="glass overflow-hidden">
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="flex w-full items-center justify-between p-6 text-left text-base font-semibold text-foreground transition hover:text-primary"
              >
                <span>{q}</span>
                <ChevronDown
                  className={`h-5 w-5 shrink-0 text-primary transition-transform duration-300 ${
                    open === i ? "rotate-180" : ""
                  }`}
                />
              </button>
              <motion.div
                initial={false}
                animate={{ height: open === i ? "auto" : 0 }}
                className="overflow-hidden"
              >
                <p className="px-6 pb-6 text-sm leading-relaxed text-muted-foreground border-t border-white/[0.04] pt-4">
                  {a}
                </p>
              </motion.div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

export function FinalCta() {
  return (
    <section className="relative pt-24 pb-24 md:pb-32 lg:pt-48">
      <div className="mx-auto max-w-7xl px-5">
        <Reveal className="relative rounded-3xl border border-primary/30 bg-gradient-to-br from-card via-card to-primary/[0.06] shadow-[0_0_60px_-25px_var(--primary)] lg:h-[340px]">
          <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl">
            <div className="hero-beams absolute inset-0 opacity-30" />
            <div className="spotlight absolute -bottom-20 left-1/4 h-[300px] w-[500px] -translate-x-1/2 opacity-40" />
          </div>

          <div className="relative grid h-full lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
            {/* Copy */}
            <div className="relative z-10 flex flex-col justify-center p-8 text-center md:p-10 lg:pr-0 lg:text-left">
              <span className="mx-auto inline-flex w-fit items-center rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-primary lg:mx-0">
                Take the next step
              </span>
              <h2 className="text-silver mt-4 text-3xl font-bold tracking-tight md:text-4xl">
                Ready to trade with <span className="text-gold">our capital?</span>
              </h2>
              <p className="mx-auto mt-3 max-w-sm text-sm text-muted-foreground lg:mx-0">
                Join 12,500+ traders earning up to 90% profit splits — with zero risk to your savings.
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
                <CtaButton href="#challenges">Get Started Today</CtaButton>
                <GhostButton href="#faq">Have Questions?</GhostButton>
              </div>
            </div>

            {/* Dashboard tablet: rises above the card's top edge and fades out at its bottom */}
            <div
              className="relative h-[220px] overflow-hidden sm:h-[330px] lg:absolute lg:-top-32 lg:right-8 lg:bottom-0 lg:h-auto lg:w-[56%]"
              style={{ maskImage: "linear-gradient(to bottom, black 55%, transparent 100%)", WebkitMaskImage: "linear-gradient(to bottom, black 55%, transparent 100%)" }}
            >
              <motion.div
                className="absolute top-0 left-1/2 w-[880px] origin-top -translate-x-1/2 scale-[0.36] sm:scale-[0.6] lg:right-0 lg:left-auto lg:origin-top-right lg:translate-x-0 lg:scale-[0.72] xl:scale-[0.8]"
                initial={{ opacity: 0, y: 70 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.9, ease: "easeOut", delay: 0.15 }}
              >
                <DashboardTablet />
              </motion.div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export function Footer() {
  const cols = [
    ["Challenges", ["1-Step Evaluation", "2-Step Evaluation", "Instant Funding", "Scaling Plan"]],
    ["Company", ["About Us", "Payout Proof", "Affiliate Program", "Careers"]],
    ["Support", ["Help Center", "Trading Rules", "Contact Us", "Discord Community"]],
    ["Legal", ["Terms of Service", "Privacy Policy", "Risk Disclosure", "Refund Policy"]],
  ] as const;

  return (
    <footer className="border-t border-white/[0.06] bg-black/40">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-16 md:grid-cols-[1.5fr_1fr_1fr_1fr_1fr]">
        <div>
          <Logo />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">
            Empowering disciplined forex traders globally with transparent criteria, low-latency execution, and fast payouts.
          </p>
        </div>
        {cols.map(([t, links]) => (
          <div key={t}>
            <p className="mb-4 font-display text-sm font-semibold tracking-wide text-foreground">{t}</p>
            <ul className="space-y-2.5">
              {links.map((l) => (
                <li key={l}>
                  <a href="#" className="text-sm text-muted-foreground transition hover:text-primary">
                    {l}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-white/[0.04]">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-5 py-6 text-xs text-muted-foreground md:flex-row">
          <p>
            Bullish 4ex offers simulated trading accounts for educational and skill evaluation purposes only.
          </p>
          <p>© 2026 Bullish 4ex Ltd. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
