import { motion, useInView, animate } from "framer-motion";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";

export const fmt = (n: number) => "$" + n.toLocaleString("en-US");

/** Fades + lifts children into view once. */
export function Reveal({ children, delay = 0, className = "" }: { children: ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.1 }}
      transition={{ duration: 0.5, delay, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}

/** Small pill label, same style as the hero badge. */
export function Pill({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1 text-xs font-medium tracking-wide text-foreground/90 backdrop-blur">
      <span className="flex h-3 w-3 items-center justify-center rounded-full bg-primary/25">
        <span className="h-1.5 w-1.5 rounded-full bg-primary" />
      </span>
      {children}
    </span>
  );
}

/** Section heading. `align="left"` puts the subtitle to the right on desktop. */
export function SectionHead({
  label, title, sub, align = "center", aside,
}: { label: string; title: ReactNode; sub?: string; align?: "center" | "left"; aside?: ReactNode }) {
  if (align === "left") {
    return (
      <Reveal className="mb-14 grid items-end gap-6 md:grid-cols-[1.3fr_1fr]">
        <div>
          <Pill>{label}</Pill>
          <h2 className="text-silver mt-5 text-4xl font-semibold leading-[1.08] tracking-tight md:text-5xl">{title}</h2>
        </div>
        <div className="md:pb-2">
          {sub && <p className="max-w-md text-base leading-relaxed text-muted-foreground">{sub}</p>}
          {aside}
        </div>
      </Reveal>
    );
  }
  return (
    <Reveal className="mx-auto mb-14 max-w-2xl text-center">
      <Pill>{label}</Pill>
      <h2 className="text-silver mt-5 text-4xl font-semibold leading-[1.08] tracking-tight md:text-5xl">{title}</h2>
      {sub && <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-muted-foreground">{sub}</p>}
      {aside}
    </Reveal>
  );
}

/** Primary CTA: gold pill with a dark circular arrow (matches hero). */
export function CtaButton({ children, href = "#challenges", className = "" }: { children: ReactNode; href?: string; className?: string }) {
  return (
    <a
      href={href}
      className={`group inline-flex items-center gap-4 rounded-full bg-gold py-1.5 pr-1.5 pl-6 text-sm font-semibold text-primary-foreground shadow-gold transition hover:scale-[1.03] ${className}`}
    >
      {children}
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-background text-primary transition group-hover:rotate-45">
        <ArrowUpRight className="h-4 w-4" />
      </span>
    </a>
  );
}

export function GhostButton({ children, href = "#", className = "" }: { children: ReactNode; href?: string; className?: string }) {
  return (
    <a
      href={href}
      className={`inline-flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-5 py-2.5 text-sm font-medium text-foreground transition hover:border-primary/50 hover:text-primary ${className}`}
    >
      {children}
    </a>
  );
}

/** Brand puzzle mark (transparent PNG in /public). */
export function LogoMark({ className = "h-9 w-auto" }: { className?: string }) {
  return <img src="/logo-mark.png" alt="" aria-hidden width={173} height={256} className={`select-none ${className}`} draggable={false} />;
}

export function Logo({ href = "/", markOnly = false }: { href?: string; markOnly?: boolean }) {
  return (
    <a href={href} className="flex items-center gap-2.5" aria-label="Bullish 4ex home">
      <LogoMark />
      {!markOnly && (
        <span className="font-display text-lg font-extrabold tracking-tight">
          BULLISH<span className="text-primary">4</span>EX
        </span>
      )}
    </a>
  );
}

/** Counts up from 0 when scrolled into view. Server HTML (and crawlers) get the final value. */
export function Counter({ value, prefix = "", suffix = "", decimals = 0 }: { value: number; prefix?: string; suffix?: string; decimals?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const [v, setV] = useState(value);
  useEffect(() => {
    if (!inView) return;
    const c = animate(0, value, { duration: 2, ease: "easeOut", onUpdate: setV });
    return () => c.stop();
  }, [inView, value]);
  return (
    <span ref={ref} className="tabular-nums">
      {prefix}{v.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}{suffix}
    </span>
  );
}

/** Gold candle image used in hero / final CTA. */
export function Candle({ className, delay = 0, drift = 16, rotate = 0 }: { className: string; delay?: number; drift?: number; rotate?: number }) {
  return (
    <motion.img
      src="/hero-candle.webp"
      alt=""
      aria-hidden
      className={`candle-glow pointer-events-none absolute select-none ${className}`}
      initial={{ opacity: 0, rotate }}
      animate={{ opacity: 1, rotate, y: [0, -drift, 0] }}
      transition={{ opacity: { duration: 0.8, delay }, y: { duration: 6 + delay * 4, repeat: Infinity, ease: "easeInOut" } }}
    />
  );
}
