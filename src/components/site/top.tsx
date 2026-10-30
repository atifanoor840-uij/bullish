import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { ArrowRight, ArrowUpRight, Menu, X, Users, CircleDollarSign, Globe, MapPin } from "lucide-react";
import { navLinks, partners, stats } from "@/lib/site-data";
import { Counter, CtaButton, Logo, Pill, Reveal } from "./primitives";
import { propApi } from "@/lib/propApi";
import { isLive, isPublic } from "@/lib/offers";

/** Promo strip above the navbar, built from live CRM offers/coupons; hidden when there are none. */
function OfferBar() {
  const [promo, setPromo] = useState<{ bogo: string | undefined; off: number | undefined } | null>(null);
  useEffect(() => {
    Promise.all([
      propApi.catalog.offers().then((r) => r.offers).catch(() => []),
      propApi.catalog.coupons().then((r) => r.coupons ?? []).catch(() => []),
    ]).then(([offers, coupons]) => {
      const bogo = offers.find((o) => o.type === "bogo" && isLive(o) && isPublic(o));
      const off = Math.max(0, ...coupons.filter((c) => c.status === "active" && !c.isExpired).map((c) => c.discountPercent));
      if (!bogo && !off) return;
      const buy = bogo ? bogo.buyQuantity || 1 : 0;
      setPromo({ bogo: bogo ? `Buy ${buy}, Get ${buy + (bogo.freeQuantity || 1)} Accounts` : undefined, off: off || undefined });
    });
  }, []);
  if (!promo) return null;
  return (
    <div className="bg-gradient-to-r from-primary/90 via-primary to-primary/90 text-primary-foreground">
      <div className="mx-auto flex h-9 max-w-7xl items-center justify-center gap-3 px-5 text-xs font-semibold sm:text-sm">
        {promo.bogo && (
          <>
            <span className="rounded-full bg-background px-2.5 py-0.5 text-[10px] font-bold tracking-wider text-primary">BOGO</span>
            <span className="hidden sm:inline">{promo.bogo}</span>
          </>
        )}
        {promo.off && <span className="rounded-full bg-loss px-2.5 py-0.5 text-[10px] font-bold tracking-wider text-white">UP TO {promo.off}% OFF</span>}
        <span className="h-4 w-px bg-primary-foreground/30" />
        <a href="/#challenges" className="inline-flex items-center gap-1 hover:underline">See plans <ArrowUpRight className="h-3.5 w-3.5" /></a>
      </div>
    </div>
  );
}

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 10);
    on();
    window.addEventListener("scroll", on);
    return () => window.removeEventListener("scroll", on);
  }, []);
  return (
    <header className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${scrolled ? "border-b border-white/5 bg-background/70 backdrop-blur-xl" : ""}`}>
      <OfferBar />
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5">
        <Logo />
        <nav className="hidden items-center gap-1 rounded-full border border-white/[0.06] bg-white/[0.02] p-1 lg:flex">
          {navLinks.map((l) => (
            <a key={l.href} href={l.href} className="rounded-full px-4 py-1.5 text-sm text-muted-foreground transition hover:bg-white/[0.05] hover:text-foreground">{l.label}</a>
          ))}
        </nav>
        <div className="hidden items-center gap-2 lg:flex">
          <a href="/login" className="rounded-full px-4 py-2 text-sm font-medium text-foreground/90 hover:text-primary">Login</a>
          <a href="/signup" className="inline-flex items-center gap-2 rounded-full bg-gold px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-gold transition hover:brightness-110">
            Start Evaluation
          </a>
        </div>
        <button className="lg:hidden" onClick={() => setOpen(!open)} aria-label="Menu">
          {open ? <X /> : <Menu />}
        </button>
      </div>
      {open && (
        <div className="border-t border-white/5 bg-background/95 px-5 pb-6 backdrop-blur-xl lg:hidden">
          {navLinks.map((l) => (
            <a key={l.href} href={l.href} onClick={() => setOpen(false)} className="block border-b border-white/5 py-3 text-muted-foreground">{l.label}</a>
          ))}
          <div className="mt-4 flex gap-2">
            <a href="/login" className="flex-1 rounded-full border border-white/10 py-2.5 text-center text-sm font-medium">Login</a>
            <a href="/signup" onClick={() => setOpen(false)} className="flex-1 rounded-full bg-gold py-2.5 text-center text-sm font-semibold text-primary-foreground">Start Evaluation</a>
          </div>
        </div>
      )}
    </header>
  );
}

export function Hero() {
  return (
    <section className="hero-bg relative overflow-hidden pt-44 pb-24 md:pt-52 md:pb-32">
      {/* Diagonal light beams (top-right) */}
      <div className="hero-beams pointer-events-none absolute inset-0" />
      {/* Dotted world-map style backdrop */}
      <div className="dot-map pointer-events-none absolute inset-x-0 top-1/3 bottom-0" />
      <div className="gold-glow pointer-events-none absolute top-0 left-1/2 h-[420px] w-[800px] -translate-x-1/2 opacity-20" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-b from-transparent to-background" />

      {/* Floating crystal candles on the sides */}
      <motion.img
        src="/hero-candle.webp"
        alt=""
        aria-hidden
        className="candle-glow pointer-events-none absolute top-20 -left-10 w-32 select-none opacity-60 sm:w-40 md:top-24 md:left-0 md:w-52 md:opacity-100 lg:left-6 lg:w-64"
        initial={{ opacity: 0, x: -40, rotate: -8 }}
        animate={{ opacity: 1, x: 0, rotate: -8, y: [0, -18, 0] }}
        transition={{ opacity: { duration: 0.8 }, x: { duration: 0.8 }, y: { duration: 6, repeat: Infinity, ease: "easeInOut" } }}
      />
      <motion.img
        src="/hero-candle.webp"
        alt=""
        aria-hidden
        className="candle-glow pointer-events-none absolute -right-8 bottom-10 w-24 select-none opacity-60 sm:w-32 md:right-4 md:bottom-16 md:w-40 md:opacity-100 lg:right-10 lg:w-48"
        initial={{ opacity: 0, x: 40, rotate: 6 }}
        animate={{ opacity: 1, x: 0, rotate: 6, y: [0, 14, 0] }}
        transition={{ opacity: { duration: 0.8, delay: 0.2 }, x: { duration: 0.8, delay: 0.2 }, y: { duration: 7, repeat: Infinity, ease: "easeInOut" } }}
      />

      <div className="relative mx-auto max-w-5xl px-5 text-center">
        <Reveal>
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5 text-sm text-foreground backdrop-blur">
            <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary/25">
              <span className="h-1.5 w-1.5 rounded-full bg-primary shadow-gold" />
            </span>
            Educational Trading Program · Simulated Accounts
          </span>
        </Reveal>
        <Reveal delay={0.1}>
          <h1 className="text-silver mt-8 text-5xl font-semibold leading-[1.05] tracking-tight md:text-7xl">
            Prove Your Skills.<br />
            Trade with Clear Rules.
          </h1>
        </Reveal>
        <Reveal delay={0.2}>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground md:text-xl">
            Improve your trading skills on our simulated platform. No time limits. Up to $200K virtual capital.
          </p>
        </Reveal>
        <Reveal delay={0.3} className="mt-10 flex flex-wrap items-center justify-center gap-6">
          <a href="#challenges" className="group inline-flex items-center gap-4 rounded-full bg-gold py-2 pr-2 pl-7 font-semibold text-primary-foreground shadow-gold transition hover:scale-[1.03]">
            Start Evaluation
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-background text-primary transition group-hover:rotate-45">
              <ArrowRight className="h-4 w-4 -rotate-45" />
            </span>
          </a>
          <p className="text-sm text-muted-foreground"><span className="font-bold text-foreground">10K+</span> Active Users</p>
        </Reveal>
      </div>
    </section>
  );
}

/** Scrolling strip of platforms / payment partners. */
export function TrustBar() {
  const list = [...partners, ...partners];
  return (
    <section className="relative border-y border-white/[0.05] bg-white/[0.01]">
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-6 px-5 py-6 md:flex-row">
        <div className="mask-fade-x w-full overflow-hidden">
          <div className="marquee gap-12" style={{ ["--marquee-duration" as string]: "35s" }}>
            {list.map((p, i) => (
              <span key={i} className="font-display text-sm font-semibold tracking-wide whitespace-nowrap text-foreground/40 transition hover:text-foreground/80">
                {p}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

const statIcons = [Users, CircleDollarSign, Globe, MapPin];

/** "What do we offer?" — intro statement + key numbers. */
export function Stats() {
  return (
    <section id="about" className="relative py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-5">
        <Reveal><Pill>What do we offer?</Pill></Reveal>
        <div className="mt-6 grid gap-10 lg:grid-cols-[1.4fr_1fr] lg:items-start">
          <Reveal>
            <p className="text-silver text-3xl font-semibold leading-tight tracking-tight md:text-4xl">
              At Bullish4ex, traders develop skills on demo accounts in a simulated trading environment, for education and evaluation only, not live market execution.
            </p>
          </Reveal>
          <Reveal delay={0.1} className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>Performance simulated rewards may apply when program rules are met; simulated rewards are discretionary and not guaranteed.</p>
            <p>We also offer a referral program (terms apply) so you can share Bullish4ex with others who want structured simulated evaluations. Program fees are service fees only; they are not deposits or investments.</p>
            <div className="pt-2">
              <CtaButton href="#challenges">Start Evaluation</CtaButton>
            </div>
          </Reveal>
        </div>

        <Reveal className="glass mt-14 grid grid-cols-2 overflow-hidden md:grid-cols-4">
          {stats.map((s, i) => {
            const Icon = statIcons[i] ?? Users;
            return (
              <div key={s.label} className={`flex flex-col items-center p-7 text-center md:p-9 ${i % 2 === 1 ? "border-l border-white/[0.06]" : ""} ${i > 1 ? "border-t border-white/[0.06] md:border-t-0" : ""} ${i === 2 ? "md:border-l" : ""}`}>
                <span className="flex h-11 w-11 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-primary"><Icon className="h-5 w-5" /></span>
                <p className="text-silver mt-4 font-display text-3xl font-semibold tracking-tight md:text-4xl">
                  <Counter value={s.value} prefix={s.prefix ?? ""} suffix={s.suffix} decimals={s.decimals} />
                </p>
                <p className="mt-2 max-w-[12rem] text-sm text-muted-foreground">{s.label}</p>
              </div>
            );
          })}
        </Reveal>
      </div>
    </section>
  );
}
