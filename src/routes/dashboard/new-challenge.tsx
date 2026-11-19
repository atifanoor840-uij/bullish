import { createFileRoute, useRouter, useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo, useRef as useReactRef, useState, type ReactNode } from "react";
import { Check, Tag, ShieldCheck, Gift, Clock, Sparkles, ShoppingBag, Rocket, ArrowRight, ArrowLeft, Lock, Bitcoin } from "lucide-react";
import { Button, Card, EmptyState, ErrorNote, Field, Loading, Note, PageHeader, cx, inputCls, useApi } from "@/components/portal/ui";
import { PayOrder } from "@/components/portal/Checkout";
import { ApiError, computeCheckoutTotal, propApi, type Order, type PricingPlan } from "@/lib/propApi";
import { money, num, price, sizeLabel } from "@/lib/portal";
import { isPopularSize } from "@/lib/site-data";
import { bogoBadge, bogoFor, isLive, isPublic, offerSummary } from "@/lib/offers";
import { trackPixel } from "@/lib/metaPixel";

export const Route = createFileRoute("/dashboard/new-challenge")({
  head: () => ({
    meta: [
      { title: "Buy Trading Challenge — Bullish4ex Prop Firm Evaluation" },
      {
        name: "description",
        content: "Select your simulated trading challenge, choose your account size and platform, and begin your prop firm evaluation with Bullish4ex.",
      },
    ],
  }),
  component: NewChallenge,
});

const MODELS: PricingPlan["model"][] = ["One Step", "Two Step", "Instant", "Flex"];
const DEFAULT_REAL_PRICE: Record<number, number> = {
  3000: 35,
  5000: 49,
  10000: 89,
  25000: 179,
  50000: 299,
  100000: 529,
  200000: 999,
};
const PLATFORMS = ["MT5"] as const;
const FLEX_ACTIVATION_DISCOUNT = 5;

// Live countdown to a real expiry date (coupon / offer `expiresAt`). Returns null once expired.
function useCountdown(expiresAt?: string) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!expiresAt) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [expiresAt]);
  if (!expiresAt) return null;
  const ms = new Date(expiresAt).getTime() - now;
  if (!Number.isFinite(ms) || ms <= 0) return null;
  const s = Math.floor(ms / 1000);
  return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60, soon: ms < 24 * 3600 * 1000 };
}

function Countdown({ expiresAt, compact }: { expiresAt?: string | undefined; compact?: boolean }) {
  const c = useCountdown(expiresAt);
  if (!c) return null;
  const pad = (n: number) => String(n).padStart(2, "0");
  const parts: [number, string][] = [...(c.d > 0 ? [[c.d, "d"] as [number, string]] : []), [c.h, "h"], [c.m, "m"], [c.s, "s"]];
  if (compact) {
    return (
      <span className={cx("inline-flex items-center gap-1 font-mono text-xs font-semibold tabular-nums", c.soon ? "text-loss" : "text-[#60a5fa]")}>
        <Clock className="h-3.5 w-3.5" />
        {parts.map(([v, u]) => `${pad(v)}${u}`).join(" ")}
      </span>
    );
  }
  return (
    <div className="flex items-center gap-1.5">
      {parts.map(([v, u]) => (
        <div key={u} className={cx("flex min-w-[2.6rem] flex-col items-center rounded-lg border px-1.5 py-1", c.soon ? "border-loss/40 bg-loss/10" : "border-white/10 bg-black/30")}>
          <span className="font-mono text-lg font-bold leading-none tabular-nums">{pad(v)}</span>
          <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">{u === "d" ? "days" : u === "h" ? "hrs" : u === "m" ? "min" : "sec"}</span>
        </div>
      ))}
    </div>
  );
}

const MODEL_META: Record<PricingPlan["model"], { sub: string; badge?: string }> = {
  "One Step": { sub: "Single-phase evaluation" },
  "Two Step": { sub: "Two-phase evaluation" },
  Instant: { sub: "Funded from day one" },
  Flex: { sub: "Start small", badge: "NEW" },
};

// Purple promo strip with a live hh:mm:ss countdown (matches the offer bar on the landing page).
function PromoBar({ discount, offer, expiresAt }: { discount?: number | undefined; offer?: string | undefined; expiresAt?: string | undefined }) {
  const c = useCountdown(expiresAt);
  const pad = (n: number) => String(n).padStart(2, "0");
  const boxes = c ? [...(c.d > 0 ? [c.d] : []), c.h, c.m, c.s] : [];
  return (
    <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-x-4 gap-y-3 rounded-2xl border border-indigo-400/30 bg-gradient-to-r from-indigo-700/70 via-indigo-600/60 to-violet-600/60 px-5 py-4 shadow-[0_10px_40px_-15px_rgba(99,102,241,0.6)]">
      {!!discount && (
        <span className="flex items-center gap-2 font-display text-base font-bold">
          <Rocket className="h-4 w-4 text-pink-300" />Up to {discount}% OFF
        </span>
      )}
      {offer && (
        <span className="flex items-center gap-2 font-display text-base font-bold">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-indigo-600"><Gift className="h-3 w-3" /></span>
          {offer}
        </span>
      )}
      {boxes.length > 0 && (
        <span className="flex items-center gap-1">
          {boxes.map((v, i) => (
            <span key={i} className="flex items-center gap-1">
              {i > 0 && <span className="text-xs text-white/60">:</span>}
              <span className="flex h-10 min-w-[2.4rem] items-center justify-center rounded-lg border border-white/25 bg-white/10 font-display text-lg font-bold italic tabular-nums">{pad(v)}</span>
            </span>
          ))}
        </span>
      )}
    </div>
  );
}

function Stepper({ step, onBack }: { step: 1 | 2; onBack?: (() => void) | undefined }) {
  const items = ["Configure", "Payment"];
  return (
    <div className="flex items-center gap-2 text-xs font-semibold">
      {items.map((label, i) => {
        const n = (i + 1) as 1 | 2;
        const done = step > n;
        const active = step === n;
        return (
          <div key={label} className="flex items-center gap-2">
            {i > 0 && <span className={cx("h-px w-8", step >= n ? "bg-primary" : "bg-white/15")} />}
            <button type="button" disabled={!(done && onBack)} onClick={onBack} className={cx("flex items-center gap-2", done && onBack && "cursor-pointer hover:opacity-80")}>
            <span className={cx("flex h-6 w-6 items-center justify-center rounded-full border", active || done ? "border-primary bg-primary text-primary-foreground" : "border-white/20 text-muted-foreground")}>
              {done ? <Check className="h-3.5 w-3.5" /> : n}
            </span>
            <span className={active ? "text-foreground" : "text-muted-foreground"}>{label}</span>
            </button>
          </div>
        );
      })}
    </div>
  );
}

function NewChallenge() {
  const { data, error, loading, reload } = useApi(async () => {
    const [plans, coupons, aff, offers] = await Promise.all([
      propApi.catalog.pricingPlans(),
      propApi.catalog.coupons().catch(() => ({ coupons: [] })),
      propApi.affiliate.get().catch(() => null),
      propApi.catalog.offers().catch(() => ({ offers: [] })),
    ]);
    const referrals: { status: string; commissionAmount: number }[] = aff?.referrals ?? [];
    return {
      plans: plans.plans.filter((p) => p.status === "active"),
      coupons: coupons.coupons,
      offers: offers.offers.filter((o) => isLive(o) && isPublic(o)),
      referralBalance: referrals.filter((r) => r.status === "approved").reduce((s, r) => s + num(r.commissionAmount), 0),
    };
  });

  const [model, setModel] = useState<PricingPlan["model"]>("Flex");
  const [size, setSize] = useState(100000);
  const [platform, setPlatform] = useState<(typeof PLATFORMS)[number]>("MT5");
  // Only crypto payments are offered.
  const method = "Crypto";
  const [weekend, setWeekend] = useState(false);
  const [code, setCode] = useState("");
  const [useRef, setUseRef] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [order, setOrder] = useState<Order | null>(null);
  // The payment step is a real history entry (?step=payment) so the browser back button returns to step 1.
  const router = useRouter();
  const searchStr = useRouterState({ select: (s) => s.location.searchStr });
  const pushedPayment = useReactRef(false);
  const step: 1 | 2 = new URLSearchParams(searchStr).get("step") === "payment" && pushedPayment.current ? 2 : 1;
  const withStep = (on: boolean) => {
    const params = new URLSearchParams(window.location.search);
    if (on) params.set("step", "payment"); else params.delete("step");
    const qs = params.toString();
    return `${window.location.pathname}${qs ? `?${qs}` : ""}`;
  };
  const goToPayment = () => {
    pushedPayment.current = true;
    router.history.push(withStep(true));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const backToConfigure = () => {
    if (pushedPayment.current && new URLSearchParams(window.location.search).get("step") === "payment") router.history.back();
    else router.history.replace(withStep(false));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  // Opening ?step=payment directly (refresh / shared link) has no configuration yet — start at step 1.
  useEffect(() => {
    if (!pushedPayment.current && new URLSearchParams(window.location.search).get("step") === "payment") router.history.replace(withStep(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [agree, setAgree] = useState(false);

  // Only models and sizes that exist (and are active) in the CRM catalog.
  const models = MODELS.filter((m) => data?.plans.some((p) => p.model === m));
  const activeModel = models.includes(model) ? model : (models[0] ?? model);
  const sizes = useMemo(() => (data?.plans ?? []).filter((p) => p.model === activeModel).sort((a, b) => a.size - b.size), [data, activeModel]);

  // Deep link from the landing pricing: /dashboard/new-challenge?plan=<planId>&coupon=<couponCode>
  useEffect(() => {
    trackPixel("PageView");
    const params = new URLSearchParams(window.location.search);
    const id = params.get("plan");
    const p = data?.plans.find((x) => x.id === id);
    if (p) { setModel(p.model); setSize(p.size); }

    // Auto-apply coupon from URL or find best active promo coupon
    if (data?.coupons && !code) {
      const urlCoupon = params.get("coupon")?.trim().toUpperCase();
      const validUrlCoupon = urlCoupon
        ? data.coupons.find((c) => c.code === urlCoupon && c.status === "active" && !c.isExpired)
        : null;
      if (validUrlCoupon) {
        setCode(validUrlCoupon.code);
      } else {
        const bestActive = [...data.coupons]
          .filter((c) => c.status === "active" && !c.isExpired)
          .sort((a, b) => b.discountPercent - a.discountPercent)[0];
        if (bestActive) {
          setCode(bestActive.code);
        }
      }
    }
  }, [data]);

  const plan = sizes.find((p) => p.size === size) ?? sizes[0];
  const payMethod = method;
  // Coupons never apply to the Flex initial price.
  const isFlex = plan?.model === "Flex";
  // Active coupon for the size tiles (ignores the selected plan; Flex tiles skip it).
  const tileCoupon = data?.coupons.find((c) => c.code === code.trim().toUpperCase() && c.status === "active" && !c.isExpired);
  const coupon = isFlex ? undefined : data?.coupons.find((c) => c.code === code.trim().toUpperCase() && c.status === "active" && !c.isExpired);

  const total = plan
    ? computeCheckoutTotal({ catalogPrice: plan.price, weekendHoldingAddon: weekend, discountPercent: coupon?.discountPercent ?? 0, isCrypto: payMethod.toLowerCase().includes("crypto"), referralBalance: data?.referralBalance ?? 0, useReferralBalance: useRef })
    : 0;
  const base = plan ? plan.price * (weekend ? 1.2 : 1) : 0;
  const isCrypto = payMethod.toLowerCase().includes("crypto");
  // Flex activation fee (paid only after passing) carries a flat 5% discount.
  const activationFull = Math.max(0, (plan?.realPrice ?? DEFAULT_REAL_PRICE[plan?.size ?? 100000] ?? 529) - (plan?.price ?? 9));
  const activationFee = Math.ceil(activationFull * (1 - FLEX_ACTIVATION_DISCOUNT / 100));
  const planOffers = plan ? bogoFor(data?.offers ?? [], plan.model, plan.size) : [];

  useEffect(() => {
    if (plan) {
      trackPixel("ViewContent", {
        content_name: `${activeModel} ${sizeLabel(plan.size)}`,
        content_category: "Challenge Plan",
        content_ids: [plan.id],
        content_type: "product",
        value: total,
        currency: "USD",
      });
    }
  }, [plan?.id, activeModel]);

  const place = async (expected = total) => {
    if (!plan) return;
    setBusy(true);
    setErr("");
    try {
      const { order } = await propApi.orders.create({ planId: plan.id, paymentMethod: payMethod, couponUsed: coupon?.code || code.trim().toUpperCase(), weekendHoldingAddon: weekend, useReferralBalance: useRef, expectedAmount: expected });

      // Meta Pixel: Track InitiateCheckout
      trackPixel("InitiateCheckout", {
        content_name: `${activeModel} ${sizeLabel(plan.size)}`,
        content_ids: [plan.id],
        content_type: "product",
        value: order.amountPaid ?? expected,
        currency: "USD",
        num_items: 1,
      });

      if (!payMethod.toLowerCase().includes("crypto qr")) {
        try {
          const { checkoutUrl } = await propApi.orders.pay(order.id, platform);
          trackPixel("AddPaymentInfo", {
            content_name: `Order ${order.id}`,
            value: order.amountPaid,
            currency: "USD",
            payment_method: payMethod,
          });
          window.location.href = checkoutUrl;
          return;
        } catch {
          // Fall back to the payment step if redirecting immediately fails.
        }
      }

      setOrder(order);
    } catch (e) {
      if (e instanceof ApiError && e.data?.code === "PRICE_CHANGED") setErr(`The price was updated to ${money(e.data.amount)}. Please review and confirm again.`);
      else setErr(e instanceof Error ? e.message : "Could not create the order");
    } finally {
      setBusy(false);
    }
  };

  if (loading && !data) return <Card><Loading label="Loading challenges…" /></Card>;
  if (error) return <ErrorNote message={error} onRetry={reload} />;
  if (!data?.plans.length) return <Card><EmptyState title="No challenges available right now" body="Please check back soon." /></Card>;

  // Step 1 shows the price before the payment-method discount (crypto -5% is applied in step 2).
  const configTotal = plan
    ? computeCheckoutTotal({ catalogPrice: plan.price, weekendHoldingAddon: weekend, discountPercent: coupon?.discountPercent ?? 0, isCrypto: false, referralBalance: data?.referralBalance ?? 0, useReferralBalance: useRef })
    : 0;
  const promo = tileCoupon ?? undefined;
  const promoOffer = data?.offers[0];
  const promoExpires = promo?.expiresAt ?? promoOffer?.expiresAt;

  if (order) {
    return (
      <>
        <PageHeader title="Complete your payment" subtitle={`Order ${order.id} · ${activeModel} ${sizeLabel(plan?.size ?? 0)}`} />
        <Card className="max-w-xl p-6">
          <PayOrder orderId={order.id} amount={order.amountPaid} paymentMethod={order.paymentMethod} platform={platform} onDone={() => (window.location.href = "/dashboard/orders")} />
        </Card>
      </>
    );
  }

  const header = (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.06] pb-5">
      <div className="flex items-center gap-3">
        <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/[0.08] bg-primary/10 text-primary"><Sparkles className="h-5 w-5" /></span>
        <div>
          <h1 className="font-display text-xl font-bold tracking-tight sm:text-2xl">{step === 1 ? "Buy Your Challenge" : "Payment"}</h1>
          <p className="text-sm text-muted-foreground">{step === 1 ? "Configure your account and complete purchase" : "Choose how you want to pay"}</p>
        </div>
      </div>
      <div className="flex items-center gap-4">
        {step === 2 && (
          <button onClick={backToConfigure} className="flex items-center gap-2 rounded-lg border border-white/10 px-3.5 py-2 text-xs font-semibold transition hover:border-primary/50">
            <ArrowLeft className="h-3.5 w-3.5 text-primary" />Change plan
          </button>
        )}
        <Stepper step={step} onBack={step === 2 ? backToConfigure : undefined} />
        {step === 1 && (
          <button
            onClick={() => document.getElementById("challenge-summary")?.scrollIntoView({ behavior: "smooth", block: "start" })}
            className="hidden items-center gap-2 rounded-lg border border-white/10 px-3.5 py-2 text-xs font-semibold transition hover:border-primary/50 sm:flex"
          >
            <ShoppingBag className="h-3.5 w-3.5 text-primary" />Checkout
          </button>
        )}
      </div>
    </div>
  );

  // Blue "virtual capital" card shared by both steps.
  const capitalCard = (amount: number, children: ReactNode) => (
    <div id="challenge-summary" className="overflow-hidden rounded-3xl border border-white/[0.06] bg-[#0f1424] scroll-mt-24">
      <div className="bg-gradient-to-br from-[#1d5fff] to-[#3b8bff] px-6 pt-7 pb-16 sm:px-8">
        <p className="text-[11px] font-bold tracking-[0.18em] text-white/80">VIRTUAL CAPITAL</p>
        <p className="font-display text-5xl font-extrabold tracking-tight text-white sm:text-6xl">{money(plan?.size ?? 0, 0)}</p>
      </div>
      <div className="-mt-10 space-y-3 px-4 pb-6 sm:px-6">
        <div className="rounded-2xl border border-white/[0.08] bg-[#131a2c] py-6 text-center">
          {base - amount > 0.005 && <p className="text-sm text-muted-foreground line-through">{money(base)}</p>}
          <p className="font-display text-4xl font-extrabold">{money(amount)}</p>
        </div>
        {children}
      </div>
    </div>
  );

  const row = (label: ReactNode, value: ReactNode, cls = "") => (
    <div className={cx("flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-[#171e31] px-4 py-3 text-sm", cls)}>
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );

  const activationRow = activeModel === "Flex" && row(
    <span className="text-amber-400">Activation (only if you pass)</span>,
    <span className="text-amber-400"><span className="mr-1.5 text-xs font-normal text-muted-foreground line-through">{money(activationFull)}</span>{money(activationFee)}</span>,
    "border-amber-500/25 bg-amber-500/[0.06]",
  );

  if (step === 2) {
    const cryptoPrice = plan
      ? computeCheckoutTotal({ catalogPrice: plan.price, weekendHoldingAddon: weekend, discountPercent: coupon?.discountPercent ?? 0, isCrypto: true, referralBalance: data.referralBalance, useReferralBalance: useRef })
      : 0;
    const methods = [
      { id: "Crypto" as const, title: "Crypto", sub: "Bitcoin, Ethereum, USDT, TRX & USDC", icon: <Bitcoin className="h-7 w-7" />, amount: cryptoPrice, note: coupon ? `${coupon.discountPercent}% + 5% extra = ${coupon.discountPercent + 5}% OFF` : "Extra 5% OFF with crypto",
        on: "border-profit/70 bg-gradient-to-b from-profit/[0.10] to-transparent shadow-[inset_0_-2px_0_0_var(--profit)]", iconCls: "border-profit/40 bg-profit/15 text-profit", priceCls: "bg-profit/15 text-profit", noteCls: "text-profit/80" },
    ];
    const summary: [string, ReactNode, string?][] = [
      ["Program", activeModel],
      ["Account Size", money(plan?.size ?? 0, 0)],
      ["Platform", platform],
      ...(weekend ? [["Weekend Holding", "+20%"] as [string, ReactNode]] : []),
      ...(coupon ? [[`Promo ${coupon.code}`, `-${coupon.discountPercent}%`, "text-profit"] as [string, ReactNode, string]] : []),
      ["Base Price", money(base)],
      ...(activeModel === "Flex" ? [["Activation (on pass)", money(activationFee), "text-amber-400"] as [string, ReactNode, string]] : []),
    ];

    return (
      <>
        {header}
        <div className="mx-auto max-w-2xl space-y-6">
          <section className="overflow-hidden rounded-2xl border border-white/[0.06] bg-[#0f1424]">
            <h2 className="border-b border-white/[0.06] px-6 py-4 font-display text-base font-bold">Choose Payment Method</h2>
            <div className="space-y-4 p-5 sm:p-6">
              {(promo || promoOffer) && (
                <PromoBar discount={promo?.discountPercent} offer={promoOffer?.name} expiresAt={promoExpires} />
              )}
              <div className="grid gap-4">
                {methods.map((m) => {
                  const on = payMethod === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      className={cx("flex flex-col items-center rounded-2xl border px-4 py-7 text-center transition", on ? m.on : "border-white/[0.08] hover:border-white/20")}
                    >
                      <span className={cx("flex h-16 w-16 items-center justify-center rounded-2xl border", m.iconCls)}>{m.icon}</span>
                      <span className="mt-4 font-display text-lg font-bold">{m.title}</span>
                      <span className="mt-1 text-xs text-muted-foreground">{m.sub}</span>
                      <span className={cx("mt-4 rounded-lg px-4 py-1.5 font-display text-base font-bold", m.priceCls)}>{money(m.amount)}</span>
                      <span className={cx("mt-2 text-[11px]", m.noteCls)}>{m.note}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-white/[0.06] bg-[#0f1424]">
            <h2 className="border-b border-white/[0.06] px-6 py-4 font-display text-base font-bold">Order Summary</h2>
            <dl className="divide-y divide-white/[0.06] px-6 py-2 text-sm">
              {summary.map(([k, v, cls]) => (
                <div key={k} className="flex items-center justify-between py-3">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className={cx("font-semibold", cls)}>{v}</dd>
                </div>
              ))}
            </dl>
          </section>

          {err && <Note tone="error">{err}</Note>}
          <Button variant="primary" className="w-full rounded-xl py-3.5 text-base" busy={busy} onClick={() => place()}>
            <Lock className="h-4 w-4" />Pay {money(total)} with {payMethod}<ArrowRight className="h-4 w-4" />
          </Button>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <button onClick={backToConfigure} className="flex items-center gap-1.5 transition hover:text-foreground"><ArrowLeft className="h-3.5 w-3.5" />Back</button>
            <span className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" />Secure checkout</span>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {header}

      {/* Evaluation model tabs */}
      <div className="mb-6 flex justify-center">
        <div className="no-scrollbar flex max-w-full gap-1 overflow-x-auto rounded-2xl border border-white/[0.06] bg-[#121726] p-1.5">
          {models.map((m) => {
            const meta = MODEL_META[m];
            const on = m === activeModel;
            const flexFrom = m === "Flex" ? data.plans.filter((p) => p.model === "Flex").sort((a, b) => a.price - b.price)[0]?.price : undefined;
            return (
              <button
                key={m}
                onClick={() => setModel(m)}
                className={cx("shrink-0 rounded-xl px-5 py-2.5 text-center transition sm:px-8", on ? "bg-white text-[#1d5fff] shadow-lg" : "text-foreground/80 hover:bg-white/[0.04]")}
              >
                <span className="flex items-center justify-center gap-1.5 font-display text-[15px] font-bold">
                  {m}
                  {meta.badge && <span className="rounded bg-amber-400 px-1 py-px text-[8px] font-extrabold text-black">{meta.badge}</span>}
                </span>
                <span className={cx("block text-xs", on ? "text-[#1d5fff]/80" : "text-muted-foreground")}>
                  {flexFrom !== undefined ? `Start for ${price(flexFrom)}` : meta.sub}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Account sizes */}
      <div className="mb-6 flex flex-wrap justify-center gap-3">
        {sizes.map((p) => {
          const on = p.size === plan?.size;
          const offer = bogoFor(data.offers, p.model, p.size)[0];
          return (
            <button
              key={p.id}
              onClick={() => setSize(p.size)}
              className={cx("relative min-w-[7.5rem] rounded-2xl border px-6 py-4 font-display text-lg font-bold transition", on ? "border-white bg-white text-[#1d5fff] shadow-lg" : "border-white/10 bg-[#121726] hover:border-white/25")}
            >
              {isPopularSize(p.size) && <span className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-loss px-1.5 py-0.5 text-[9px] font-bold whitespace-nowrap text-white">Most popular</span>}
              {offer && <span className="absolute -top-2 right-2 rounded-full bg-gold px-1.5 py-0.5 text-[9px] font-bold text-primary-foreground">{bogoBadge(offer)}</span>}
              {money(p.size, 0)}
            </button>
          );
        })}
      </div>

      {(promo || promoOffer) && (
        <div className="mb-8">
          <PromoBar discount={promo?.discountPercent} offer={promoOffer?.name} expiresAt={promoExpires} />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,30rem)]">
        <div className="space-y-6">
          <section>
            <p className="mb-2 text-xs font-bold tracking-wider text-muted-foreground">PLATFORM</p>
            <div className="space-y-2">
              {PLATFORMS.map((p) => (
                <button
                  key={p}
                  onClick={() => setPlatform(p)}
                  className={cx("flex w-full items-center gap-3 rounded-2xl border px-4 py-4 text-left transition", p === platform ? "border-white/15 bg-[#121726]" : "border-white/[0.06] bg-[#0f1424] hover:border-white/15")}
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-sky-500 text-[11px] font-extrabold text-white">5</span>
                  <span className="font-semibold">MetaTrader 5</span>
                  {p === platform && <Check className="ml-auto h-4 w-4 text-primary" />}
                </button>
              ))}
            </div>
          </section>

          <section>
            <p className="mb-2 text-xs font-bold tracking-wider text-muted-foreground">OPTIONAL ADDONS</p>
            <label className="flex cursor-pointer items-center gap-4 rounded-2xl border border-white/[0.06] bg-[#121726] px-4 py-4">
              <input type="checkbox" checked={weekend} onChange={(e) => setWeekend(e.target.checked)} className="h-5 w-5 shrink-0 accent-[var(--primary)]" />
              <span className="flex-1 text-sm">
                <span className="font-semibold">Weekend Holding</span>{" "}
                <span className="text-muted-foreground">Hold positions over the weekend</span>
              </span>
              <span className="text-sm font-semibold text-muted-foreground">+20%</span>
            </label>
          </section>

          {!!data.offers.length && (
            <section className="space-y-2">
              {data.offers.map((o) => (
                <div key={o.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-primary/30 bg-primary/[0.07] px-4 py-3 text-sm">
                  <Gift className="h-4 w-4 shrink-0 text-primary" />
                  <span className="flex-1"><span className="font-semibold">{o.name}</span> <span className="text-muted-foreground">· {o.description || offerSummary(o)}</span></span>
                  {o.expiresAt && new Date(o.expiresAt).getTime() > Date.now() && (
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">Ends in <Countdown expiresAt={o.expiresAt} compact /></span>
                  )}
                </div>
              ))}
            </section>
          )}
        </div>

        {capitalCard(configTotal, (
          <>
            {row("Challenge", activeModel)}
            {row("Platform", "MetaTrader 5")}
            {weekend && row("Weekend holding", "+20%")}
            {activationRow}
            {coupon && row(<span className="text-profit">Promo {coupon.code}</span>, <span className="text-profit">-{coupon.discountPercent}%</span>, "border-profit/30 bg-profit/[0.07]")}
            <label className="flex cursor-pointer items-center gap-3 px-1 pt-1 text-xs text-muted-foreground">
              <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="h-5 w-5 shrink-0 accent-[var(--primary)]" />
              <span>
                I agree to the <a href="/rules" target="_blank" rel="noreferrer" className="text-primary hover:underline">Terms and Conditions</a> &{" "}
                <a href="/rules" target="_blank" rel="noreferrer" className="text-primary hover:underline">Refund Policy</a> <span className="text-loss">*</span>
              </span>
            </label>
            <Button
              variant="primary"
              className="w-full rounded-xl py-3.5 text-base"
              disabled={!agree || !plan}
              onClick={() => { setErr(""); goToPayment(); }}
            >
              Place Challenge — {money(configTotal)}<ArrowRight className="h-4 w-4" />
            </Button>
            <p className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground"><Bitcoin className="h-3.5 w-3.5" />Secure checkout · Pay with crypto on next step</p>
          </>
        ))}
      </div>
    </>
  );
}
