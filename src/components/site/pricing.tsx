import { motion, useMotionValueEvent, useScroll, useSpring, useTransform, type MotionValue } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ShieldCheck, Info, Lock, Sparkles, UserRound, Target, Wallet, Gift, Tag } from "lucide-react";
import {
  sizes, planTypes, planMeta, getPlan, popular, planIncludes, type PlanType,
} from "@/lib/site-data";
import { CtaButton, Reveal, SectionHead, fmt } from "./primitives";
import { propApi, type Coupon, type Offer, type PricingPlan } from "@/lib/propApi";
import { bogoBadge, bogoFor, isLive, isPublic, offerSummary } from "@/lib/offers";
import { price as fmtPrice, sizeLabel } from "@/lib/portal";
import { trackPixel } from "@/lib/metaPixel";

const MODEL_OF: Record<PlanType, PricingPlan["model"]> = { "1-Step": "One Step", "2-Step": "Two Step", "Instant Funding": "Instant" };

/* ---------------- How it works ---------------- */

const steps = [
  { icon: UserRound, t: "Choose Your Account", d: "Select your evaluation model, account size and platform to begin your challenge." },
  { icon: Target, t: "Pass The Evaluation", d: "Trade on your platform and hit the objectives in your dashboard with clear, simple rules." },
  { icon: Wallet, t: "Get Funded & Paid", d: "Trade our capital and request payouts on demand — keep up to 90% via Rise or crypto." },
];

/** Glowing "staircase" line used as side decoration. */
function StairLine({ className, flip = false }: { className: string; flip?: boolean }) {
  return (
    <svg viewBox="0 0 200 120" fill="none" aria-hidden className={`pointer-events-none absolute hidden md:block ${className}`} style={flip ? { transform: "scaleX(-1)" } : undefined}>
      <defs>
        <linearGradient id={`stair-${flip ? "r" : "l"}`} x1="0" x2="1">
          <stop offset="0" stopColor="var(--primary)" stopOpacity="0" />
          <stop offset="0.5" stopColor="var(--primary)" stopOpacity="0.7" />
          <stop offset="1" stopColor="var(--primary)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d="M0 8 H48 Q56 8 56 16 V40 Q56 48 64 48 H104 Q112 48 112 56 V80 Q112 88 120 88 H200" stroke={`url(#stair-${flip ? "r" : "l"})`} strokeWidth="1.5" style={{ filter: "drop-shadow(0 0 6px var(--primary))" }} />
    </svg>
  );
}

function StepCard({ step, i, side, on }: { step: (typeof steps)[number]; i: number; side: "left" | "right"; on: boolean }) {
  const Icon = step.icon;
  return (
    <motion.div
      initial={{ opacity: 0, x: side === "left" ? -40 : 40 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, amount: 0.4 }}
      transition={{ duration: 0.7, ease: "easeOut" }}
      className={`relative rounded-2xl border p-6 transition-all duration-700 ${on ? "scale-100 border-primary/60 bg-gradient-to-b from-primary/[0.14] to-card shadow-[0_0_50px_-10px_color-mix(in_oklab,var(--primary)_55%,transparent)]" : "scale-[0.97] border-white/[0.08] bg-card/60 opacity-60"} ${side === "left" ? "md:text-right" : ""}`}
    >
      <span className={`flex h-10 w-10 items-center justify-center rounded-full transition-all duration-700 ${on ? "bg-gold text-primary-foreground shadow-gold" : "bg-white/[0.06] text-muted-foreground"} ${side === "left" ? "md:ml-auto" : ""}`}>
        <Icon className="h-4 w-4" />
      </span>
      <p className="mt-4 text-[11px] font-semibold tracking-widest text-primary uppercase md:hidden">Step 0{i + 1}</p>
      <h3 className="mt-2 text-xl font-semibold md:mt-4">{step.t}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.d}</p>
    </motion.div>
  );
}

function StepNumber({ i, side, on, progress }: { i: number; side: "left" | "right"; on: boolean; progress: MotionValue<number> }) {
  // Numbers drift slightly against the scroll for a parallax feel.
  const y = useTransform(progress, [0, 1], [40 - i * 20, -40 - i * 20]);
  return (
    <motion.span
      style={{ y }}
      className={`hidden font-display text-8xl font-extralight tracking-tighter transition-opacity duration-700 md:block lg:text-9xl ${on ? "text-gold opacity-100" : "text-silver opacity-30"} ${side === "left" ? "text-right" : ""}`}
    >
      0{i + 1}
    </motion.span>
  );
}

export function HowItWorks() {
  const last = steps[steps.length - 1]!;
  const LastIcon = last.icon;
  const track = useRef<HTMLDivElement>(null);
  const dots = useRef<(HTMLElement | null)[]>([]);
  const [lineH, setLineH] = useState(0);
  const [reached, setReached] = useState(0);

  // The gold line fills as the timeline crosses the middle of the viewport.
  const { scrollYProgress } = useScroll({ target: track, offset: ["start 60%", "end 60%"] });
  const fill = useSpring(scrollYProgress, { stiffness: 120, damping: 30 });

  /** Vertical centre of an element, measured from the top of the track. */
  const centre = (el: HTMLElement | null | undefined) => {
    if (!el || !track.current) return Infinity;
    const r = el.getBoundingClientRect();
    return r.top + r.height / 2 - track.current.getBoundingClientRect().top;
  };

  // Line runs from the top of the track to the centre of the final step's icon.
  useEffect(() => {
    const measure = () => {
      const end = centre(dots.current[steps.length - 1]);
      if (Number.isFinite(end)) setLineH(end);
    };
    const ro = new ResizeObserver(measure);
    if (track.current) ro.observe(track.current);
    return () => ro.disconnect();
  }, []);

  useMotionValueEvent(scrollYProgress, "change", (p) => {
    const tip = p * (track.current?.offsetHeight ?? 0);
    setReached(dots.current.filter((d) => centre(d) <= tip + 1).length);
  });

  return (
    <section id="how" className="relative overflow-hidden py-24 md:py-32">
      <div className="spotlight pointer-events-none absolute top-1/3 left-1/2 h-[500px] w-[700px] -translate-x-1/2 opacity-30" />
      <StairLine className="top-[30%] left-0 w-56 lg:w-72" />
      <StairLine className="top-[55%] right-0 w-56 lg:w-72" flip />

      <div className="relative mx-auto max-w-5xl px-5">
        <SectionHead
          label="How it works"
          title={<>From Evaluation to<br /><span className="text-gold">Funded Trader</span></>}
          sub="Follow these steps to join Bullish 4ex, complete your evaluation and start earning as a funded trader."
        />

        <div ref={track} className="relative">
          {/* Timeline: dim track + scroll-driven gold fill (centre on desktop, left on mobile) */}
          <div className="absolute top-0 left-5 w-0.5 rounded-full bg-white/[0.08] md:left-1/2 md:-translate-x-1/2" style={{ height: lineH }}>
            <motion.div
              className="absolute inset-0 origin-top bg-gradient-to-b from-primary/0 via-primary to-primary shadow-[0_0_14px_var(--primary)]"
              style={{ scaleY: fill }}
            />
          </div>

          <div className="space-y-10 md:space-y-20">
            {steps.slice(0, -1).map((s, i) => {
              const cardLeft = i % 2 === 1;
              const on = reached > i;
              return (
                <div key={s.t} className="relative grid items-center gap-6 pl-12 md:grid-cols-2 md:gap-16 md:pl-0">
                  <span
                    ref={(el) => { dots.current[i] = el; }}
                    className={`absolute top-8 left-5 h-3 w-3 -translate-x-1/2 rounded-full ring-4 ring-background transition-all duration-500 md:top-1/2 md:left-1/2 md:-translate-y-1/2 ${on ? "scale-125 bg-primary shadow-[0_0_16px_var(--primary)]" : "bg-white/20"}`}
                  />
                  {cardLeft ? (
                    <>
                      <StepCard step={s} i={i} side="left" on={on} />
                      <StepNumber i={i} side="right" on={on} progress={scrollYProgress} />
                    </>
                  ) : (
                    <>
                      <StepNumber i={i} side="left" on={on} progress={scrollYProgress} />
                      <StepCard step={s} i={i} side="right" on={on} />
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {/* Final step, centred at the end of the timeline */}
          <Reveal className="relative mt-16 flex flex-col items-center text-center">
            <span
              ref={(el) => { dots.current[steps.length - 1] = el; }}
              className={`relative flex h-14 w-14 items-center justify-center rounded-full border transition-all duration-700 ${reached >= steps.length ? "scale-110 border-primary bg-gold text-primary-foreground shadow-[0_0_40px_-4px_var(--primary)]" : "border-white/15 bg-card text-muted-foreground"}`}
            >
              <LastIcon className="h-5 w-5" />
            </span>
            <p className="mt-5 text-[11px] font-semibold tracking-widest text-primary uppercase">Step 0{steps.length}</p>
            <h3 className={`mt-2 text-2xl font-semibold transition-colors duration-700 ${reached >= steps.length ? "text-gold" : "text-foreground/60"}`}>{last.t}</h3>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">{last.d}</p>
            <CtaButton className="mt-8">Start Your Challenge</CtaButton>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ---------------- Pricing ---------------- */

export function Pricing() {
  const [type, setType] = useState<PlanType>("2-Step");
  const [size, setSize] = useState(100000);
  // Live catalog from the CRM; the static site-data is only a fallback when the API is unreachable.
  const [catalog, setCatalog] = useState<PricingPlan[] | null>(null);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);

  useEffect(() => {
    propApi.catalog.pricingPlans().then((r) => {
      const active = r.plans.filter((p) => p.status === "active");
      if (active.length) setCatalog(active);
    }).catch(() => {});
    propApi.catalog.offers().then((r) => setOffers(r.offers.filter((o) => isLive(o) && isPublic(o)))).catch(() => {});
    propApi.catalog.coupons().then((r) => setCoupons(r.coupons ?? [])).catch(() => {});
  }, []);

  const activeCoupons = coupons.filter((c) => c.status === "active" && !c.isExpired);
  const appliedCoupon = useMemo(() => {
    if (typeof window !== "undefined") {
      const fromUrl = new URLSearchParams(window.location.search).get("coupon")?.trim().toUpperCase();
      if (fromUrl) {
        const match = activeCoupons.find((c) => c.code === fromUrl);
        if (match) return match;
      }
    }
    return [...activeCoupons].sort((a, b) => b.discountPercent - a.discountPercent)[0] ?? null;
  }, [activeCoupons]);

  const types = catalog ? planTypes.filter((t) => catalog.some((p) => p.model === MODEL_OF[t])) : planTypes;
  const activeType = types.includes(type) ? type : (types[0] ?? type);
  const typePlans = catalog ? catalog.filter((p) => p.model === MODEL_OF[activeType]).sort((a, b) => a.size - b.size) : [];
  const sizeList = catalog ? typePlans.map((p) => p.size) : sizes;
  const activeSize = sizeList.includes(size) ? size : (sizeList[0] ?? size);
  const live = typePlans.find((p) => p.size === activeSize);
  const plan = getPlan(activeType, activeSize);
  const rawFee = live ? live.price : plan.fee;
  const discountPercent = appliedCoupon ? appliedCoupon.discountPercent : 0;
  const fee = discountPercent > 0 ? Math.round(rawFee * (1 - discountPercent / 100)) : rawFee;
  const checkoutHref = live
    ? `/dashboard/new-challenge?plan=${encodeURIComponent(live.id)}${appliedCoupon ? `&coupon=${encodeURIComponent(appliedCoupon.code)}` : ""}`
    : `/dashboard/new-challenge${appliedCoupon ? `?coupon=${encodeURIComponent(appliedCoupon.code)}` : ""}`;
  const sizeOffer = (s: number) => bogoFor(offers, MODEL_OF[activeType], s)[0];
  const planOffer = sizeOffer(activeSize);
  const isPopular = activeType === popular.type && activeSize === popular.size;

  return (
    <section id="challenges" className="relative py-24 md:py-32">
      <div className="spotlight pointer-events-none absolute top-40 left-1/2 h-[500px] w-[900px] -translate-x-1/2 opacity-60" />
      <div className="relative mx-auto max-w-7xl px-5">
        <SectionHead
          label="Pricing"
          title={<>Choose your account.<br />Pay once, trade forever.</>}
          sub="One-time fee, no subscriptions. Your fee is refunded in full with your first payout."
        />

        {/* Plan type selector */}
        <Reveal className="mx-auto grid max-w-3xl gap-2 sm:grid-cols-3">
          {types.map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`rounded-2xl border p-4 text-left transition ${activeType === t ? "border-primary/60 bg-primary/[0.08]" : "border-white/[0.07] bg-white/[0.02] hover:border-white/20"}`}
            >
              <div className="flex items-center justify-between">
                <span className="font-display text-sm font-semibold">{t}</span>
                <span className={`flex h-4 w-4 items-center justify-center rounded-full border ${activeType === t ? "border-primary bg-primary" : "border-white/20"}`}>
                  {activeType === t && <span className="h-1.5 w-1.5 rounded-full bg-background" />}
                </span>
              </div>
              <p className="mt-1.5 text-xs leading-snug text-muted-foreground">{planMeta[t].tagline}</p>
            </button>
          ))}
        </Reveal>

        {/* Account size selector */}
        <Reveal delay={0.05} className="mt-8 flex justify-center">
          <div className="no-scrollbar flex max-w-full gap-1 overflow-x-auto rounded-full border border-white/[0.07] bg-white/[0.02] p-1">
            {sizeList.map((s) => (
              <button
                key={s}
                onClick={() => setSize(s)}
                className={`relative rounded-full px-4 py-2 text-sm font-medium whitespace-nowrap transition md:px-5 ${activeSize === s ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                {activeSize === s && <motion.span layoutId="size-pill" className="absolute inset-0 rounded-full bg-gold" transition={{ type: "spring", stiffness: 400, damping: 32 }} />}
                <span className="relative">{sizeLabel(s)}</span>
                {sizeOffer(s) && <span className="relative ml-1.5 rounded-full bg-primary/20 px-1.5 text-[9px] font-bold text-primary">{bogoBadge(sizeOffer(s)!)}</span>}
              </button>
            ))}
          </div>
        </Reveal>

        {/* Plan details + checkout summary */}
        <div className="mt-10 grid gap-5 lg:grid-cols-[1.6fr_1fr]">
          <Reveal className="glass p-6 md:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs tracking-widest text-muted-foreground uppercase">{activeType} · {planMeta[activeType].phases}</p>
                <motion.p key={activeSize} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="text-silver mt-1 font-display text-4xl font-semibold tracking-tight">
                  {fmt(activeSize)} <span className="text-base font-medium text-muted-foreground">account</span>
                </motion.p>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-profit/30 bg-profit/10 px-3 py-1 text-xs font-medium text-profit">
                <ShieldCheck className="h-3.5 w-3.5" /> Refundable fee
              </span>
            </div>
            <div className="mt-8 grid gap-x-8 sm:grid-cols-2">
              {plan.rows.map(([k, v, hint]) => (
                <div key={k} className="group flex items-center justify-between border-t border-white/[0.06] py-4">
                  <div>
                    <p className="flex items-center gap-1.5 text-sm text-foreground/90">{k} <Info className="h-3 w-3 text-muted-foreground/60" /></p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>
                  </div>
                  <motion.span key={activeType + k} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="font-display text-sm font-semibold">{v}</motion.span>
                </div>
              ))}
            </div>
          </Reveal>

          <Reveal delay={0.1} className="glass-gold flex flex-col p-6 md:p-8">
            {isPopular && (
              <span className="absolute -top-3 left-6 inline-flex items-center gap-1 rounded-full bg-gold px-3 py-1 text-[11px] font-bold text-primary-foreground">
                <Sparkles className="h-3 w-3" /> Most popular
              </span>
            )}
            <p className="text-sm text-muted-foreground">One-time evaluation fee</p>
            <div className="mt-2 flex flex-wrap items-end gap-2">
              {discountPercent > 0 ? (
                <>
                  <motion.span key={fee} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="text-gold font-display text-6xl font-semibold tracking-tight">
                    {fmtPrice(fee)}
                  </motion.span>
                  <div className="mb-2 flex flex-col">
                    <span className="text-sm line-through text-muted-foreground/60">{fmtPrice(rawFee)}</span>
                    <span className="text-xs font-semibold text-profit">{appliedCoupon?.code} (-{discountPercent}%)</span>
                  </div>
                  <span className="mb-2 text-sm text-muted-foreground">USD</span>
                </>
              ) : (
                <>
                  <motion.span key={fee} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="text-gold font-display text-6xl font-semibold tracking-tight">
                    {fmtPrice(fee)}
                  </motion.span>
                  <span className="mb-2 text-sm text-muted-foreground">USD</span>
                </>
              )}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">≈ {((fee / activeSize) * 100).toFixed(2)}% of account size</p>
            {appliedCoupon && (
              <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-profit/30 bg-profit/10 px-3 py-1 text-xs font-medium text-profit">
                <Sparkles className="h-3.5 w-3.5" /> Promo auto-applied: {appliedCoupon.code} ({appliedCoupon.discountPercent}% OFF)
              </div>
            )}
            {planOffer && (
              <div className="mt-4 flex items-start gap-2 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2.5 text-xs">
                <Gift className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                <span><span className="font-semibold text-primary">{planOffer.name}</span> — {offerSummary(planOffer)}</span>
              </div>
            )}

            <ul className="mt-7 space-y-3">
              {planIncludes.map((x) => (
                <li key={x} className="flex items-start gap-3 text-sm">
                  <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/15"><Check className="h-2.5 w-2.5 text-primary" /></span>
                  {x}
                </li>
              ))}
            </ul>

            <div className="mt-auto pt-8">
              <CtaButton
                href={checkoutHref}
                onClick={() => {
                  trackPixel("InitiateCheckout", {
                    content_name: `${activeType} ${sizeLabel(activeSize)}`,
                    value: fee,
                    currency: "USD",
                  });
                }}
                className="w-full justify-between"
              >
                Start {fmt(activeSize)} challenge
              </CtaButton>
              <p className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
                <Lock className="h-3 w-3" /> Secure checkout · Card, crypto & bank transfer
              </p>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
