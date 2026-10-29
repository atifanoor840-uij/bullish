import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { ArrowRight, Menu, X } from "lucide-react";
import { navLinks, partners, stats } from "@/lib/site-data";
import { Counter, Logo, Reveal } from "./primitives";

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
    <section className="hero-bg relative overflow-hidden pt-36 pb-24 md:pt-44 md:pb-32">
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
            Skill-Based Trading Evaluations · Up to 90% Profit Split
          </span>
        </Reveal>
        <Reveal delay={0.1}>
          <h1 className="text-silver mt-8 text-5xl font-semibold leading-[1.05] tracking-tight md:text-7xl">
            Prove Your Skills.<br />
            Earn Funded Account Access.
          </h1>
        </Reveal>
        <Reveal delay={0.2}>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground md:text-xl">
            Pass our skill-based prop firm evaluation on simulated accounts designed for educational purposes. Gain access to a funded account upon successful evaluation and earn up to 90% performance rewards.
          </p>
        </Reveal>
        <Reveal delay={0.3} className="mt-10 flex flex-wrap items-center justify-center gap-6">
          <a href="#challenges" className="group inline-flex items-center gap-4 rounded-full bg-gold py-2 pr-2 pl-7 font-semibold text-primary-foreground shadow-gold transition hover:scale-[1.03]">
            Start Trading Challenge
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-background text-primary transition group-hover:rotate-45">
              <ArrowRight className="h-4 w-4 -rotate-45" />
            </span>
          </a>
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

export function Stats() {
  return (
    <section className="relative py-20">
      <div className="mx-auto max-w-7xl px-5">
        <Reveal className="glass grid grid-cols-2 overflow-hidden md:grid-cols-4">
          {stats.map((s, i) => (
            <div key={s.label} className={`relative p-7 md:p-9 ${i % 2 === 1 ? "border-l border-white/[0.06]" : ""} ${i > 1 ? "border-t border-white/[0.06] md:border-t-0" : ""} ${i === 2 ? "md:border-l" : ""}`}>
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{s.label}</p>
              <p className="text-silver mt-4 font-display text-4xl font-semibold tracking-tight md:text-5xl">
                <Counter value={s.value} prefix={s.prefix ?? ""} suffix={s.suffix} decimals={s.decimals} />
              </p>
              <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                <span className="h-1 w-1 rounded-full bg-primary" />{s.note}
              </p>
            </div>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
