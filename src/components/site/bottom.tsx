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
    [
      "Challenges",
      [
        { label: "1-Step Evaluation", href: "/#challenges" },
        { label: "2-Step Evaluation", href: "/#challenges" },
        { label: "Instant Funding", href: "/#challenges" },
        { label: "Flex Challenge ($9)", href: "/#challenges" },
        { label: "Scaling Plan", href: "/#scaling" },
      ],
    ],
    [
      "Company",
      [
        { label: "About Bullish 4ex", href: "/#how" },
        { label: "Payout Proof", href: "/#payouts" },
        { label: "Trading Markets", href: "/#markets" },
        { label: "Partner Platforms", href: "/#how" },
      ],
    ],
    [
      "Support",
      [
        { label: "Trading Rules", href: "/rules" },
        { label: "24/7 Live Support", href: "/contact" },
        { label: "Help Center & FAQ", href: "/#faq" },
        { label: "Trader Dashboard", href: "/dashboard" },
      ],
    ],
    [
      "Legal & Policies",
      [
        { label: "Terms of Service", href: "/rules" },
        { label: "Privacy Policy", href: "/rules" },
        { label: "Risk Disclosure", href: "/rules" },
        { label: "Refund Policy", href: "/rules" },
      ],
    ],
  ] as const;

  return (
    <footer className="border-t border-white/[0.06] bg-black/60">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-16 md:grid-cols-[1.5fr_1fr_1fr_1fr_1fr]">
        <div>
          <Logo />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">
            A premier educational and trader skill development platform empowering disciplined traders worldwide with transparent criteria, low-latency execution, and swift payouts.
          </p>
          <div className="mt-5 flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <ShieldCheck className="h-3.5 w-3.5" /> Educational Skill Evaluation
            </span>
          </div>
        </div>
        {cols.map(([t, links]) => (
          <div key={t}>
            <p className="mb-4 font-display text-sm font-semibold tracking-wide text-foreground">{t}</p>
            <ul className="space-y-2.5">
              {links.map((item) => (
                <li key={item.label}>
                  <a href={item.href} className="text-sm text-muted-foreground transition hover:text-primary">
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Detailed Regulatory, Educational & Simulated Accounts Disclaimer */}
      <div className="border-t border-white/[0.06] bg-white/[0.015] px-5 py-10">
        <div className="mx-auto max-w-7xl space-y-5 text-[11px] leading-relaxed text-muted-foreground/80">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] pb-4">
            <span className="font-display text-xs font-semibold uppercase tracking-wider text-foreground/90">
              Regulatory, Risk & Simulated Trading Disclaimer
            </span>
            <span className="rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              Skill Development Platform • Virtual Demo Accounts Only
            </span>
          </div>

          <p>
            <strong className="text-foreground/90">Educational & Skill Development Platform:</strong> Bullish 4ex is operated strictly as an educational and trader skill evaluation platform. All services, programs, challenges, and evaluations provided to users are designed exclusively to test, analyze, and nurture trading abilities. Bullish 4ex is not a broker-dealer, financial intermediary, investment manager, custodian, or commodity trading advisor (CTA). Bullish 4ex does not provide financial advice, solicit investor funds, hold client deposits, or execute retail financial transactions on behalf of users.
          </p>

          <p>
            <strong className="text-foreground/90">Simulated Trading Environment & Virtual Funds:</strong> All accounts provided by Bullish 4ex—including evaluation accounts, verification phases, and funded stage accounts—are 100% simulated demo accounts operating in a simulated market environment with fictitious, virtual balances. At no point do traders trade or interact with live retail market liquidity or manage actual client capital. All references on this website and in the trader dashboard to "funded account", "account size", "profit split", "payouts", "balance", or "trading capital" are purely hypothetical terms referring solely to performance milestones and conditional reward compensation within our simulated skill development program.
          </p>

          <p>
            <strong className="text-foreground/90">Hypothetical Performance Limitations:</strong> Simulated or hypothetical trading performance has inherent limitations. Unlike actual market performance, simulated trading does not represent real financial transactions and does not account for certain market conditions such as real-time liquidity constraints, broker slippage, or psychological stress of risking real capital. No representation is being made that any account will or is likely to achieve profits or losses similar to those shown. Past simulated performance is neither a guarantee nor a reliable indicator of future results.
          </p>

          <p>
            <strong className="text-foreground/90">High Risk Disclosure:</strong> Foreign exchange (Forex), CFD, indices, and commodities trading carry significant market risks and are not suitable for all individuals. You should carefully consider your financial situation and risk appetite. None of the materials, software, or tools provided by Bullish 4ex constitute investment, legal, financial, or tax advice.
          </p>

          <p>
            <strong className="text-foreground/90">Jurisdictional Limitations:</strong> The information and services on this site are not directed toward residents of any jurisdiction or country where such distribution, marketing, or use would violate local regulatory statutes or legal provisions (including jurisdictions subject to international sanctions or restrictions).
          </p>
        </div>
      </div>

      <div className="border-t border-white/[0.04] bg-black/40">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-5 py-6 text-xs text-muted-foreground md:flex-row">
          <p>
            Bullish 4ex Ltd. — Empowering disciplined traders through simulated skill evaluation.
          </p>
          <p>© 2026 Bullish 4ex Ltd. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
