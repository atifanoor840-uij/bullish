import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Check, CreditCard, Bitcoin, Tag, ShieldCheck, Gift } from "lucide-react";
import { Button, Card, CardHeader, EmptyState, ErrorNote, Field, Loading, Note, PageHeader, cx, inputCls, useApi } from "@/components/portal/ui";
import { PayOrder } from "@/components/portal/Checkout";
import { ApiError, computeCheckoutTotal, propApi, type Order, type PricingPlan } from "@/lib/propApi";
import { money, num, price, sizeLabel } from "@/lib/portal";
import { bogoBadge, bogoFor, isLive, isPublic, offerSummary } from "@/lib/offers";
import { trackPixel } from "@/lib/metaPixel";

export const Route = createFileRoute("/dashboard/new-challenge")({ component: NewChallenge });

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
const RULES: Record<PricingPlan["model"], [string, string][]> = {
  "One Step": [["Profit target", "9%"], ["Max daily loss", "4%"], ["Max overall loss", "6% (static)"], ["Min. trading days", "3 Winning Days"], ["Profit split", "70% up to 100%"]],
  "Two Step": [["Profit target", "Phase 1: 6% / Phase 2: 5%"], ["Max daily loss", "4%"], ["Max overall loss", "6% (static)"], ["Min. trading days", "3 Winning Days / phase"], ["Profit split", "70% up to 100%"]],
  Instant: [["Profit target", "None"], ["Max daily loss", "3%"], ["Max overall loss", "6% (static)"], ["Min. trading days", "5 Winning Days"], ["Profit split", "70% up to 100%"]],
  Flex: [["Profit target", "4%"], ["Max daily loss", "4%"], ["Max overall loss", "8% trailing"], ["Min. trading days", "None (Eval) / 5 (Funded)"], ["Profit split", "85% (90% w/ add-on)"]],
};
const PLATFORMS = ["MT5", "MT4", "cTrader"] as const;

function NewChallenge() {
  const { data, error, loading, reload } = useApi(async () => {
    const [plans, coupons, geo, aff, offers] = await Promise.all([
      propApi.catalog.pricingPlans(),
      propApi.catalog.coupons().catch(() => ({ coupons: [] })),
      propApi.public.geo().catch(() => ({ cardPaymentAvailable: true })),
      propApi.affiliate.get().catch(() => null),
      propApi.catalog.offers().catch(() => ({ offers: [] })),
    ]);
    const referrals: { status: string; commissionAmount: number }[] = aff?.referrals ?? [];
    return {
      plans: plans.plans.filter((p) => p.status === "active"),
      coupons: coupons.coupons,
      offers: offers.offers.filter((o) => isLive(o) && isPublic(o)),
      cardOk: geo.cardPaymentAvailable !== false,
      referralBalance: referrals.filter((r) => r.status === "approved").reduce((s, r) => s + num(r.commissionAmount), 0),
    };
  });

  const [model, setModel] = useState<PricingPlan["model"]>("Two Step");
  const [size, setSize] = useState(100000);
  const [platform, setPlatform] = useState<(typeof PLATFORMS)[number]>("MT5");
  const [method, setMethod] = useState<"Paddle" | "Crypto QR">("Paddle");
  const [weekend, setWeekend] = useState(false);
  const [code, setCode] = useState("");
  const [useRef, setUseRef] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [order, setOrder] = useState<Order | null>(null);

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
  const payMethod = data && !data.cardOk ? "Crypto QR" : method;
  const coupon = data?.coupons.find((c) => c.code === code.trim().toUpperCase() && c.status === "active" && !c.isExpired);

  const total = plan
    ? computeCheckoutTotal({ catalogPrice: plan.price, weekendHoldingAddon: weekend, discountPercent: coupon?.discountPercent ?? 0, isCrypto: payMethod.toLowerCase().includes("crypto"), referralBalance: data?.referralBalance ?? 0, useReferralBalance: useRef })
    : 0;
  const base = plan ? plan.price * (weekend ? 1.2 : 1) : 0;
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

  return (
    <>
      <PageHeader title="New Challenge" subtitle="Choose your evaluation, account size and platform." />
      {!!data.offers.length && (
        <div className="mb-5 space-y-2">
          {data.offers.map((o) => (
            <div key={o.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-primary/30 bg-primary/[0.07] px-4 py-3 text-sm">
              <Gift className="h-4 w-4 shrink-0 text-primary" />
              <span className="flex-1"><span className="font-semibold">{o.name}</span> <span className="text-muted-foreground">· {o.description || offerSummary(o)}</span></span>
              {o.expiresAt && <span className="text-xs text-muted-foreground">Ends {new Date(o.expiresAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>}
            </div>
          ))}
        </div>
      )}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="space-y-5">
          <Card>
            <CardHeader title="1. Evaluation model" />
            <div className="grid gap-3 p-5 sm:grid-cols-3">
              {models.map((m) => (
                <button key={m} onClick={() => setModel(m)} className={cx("rounded-xl border p-4 text-left transition", m === activeModel ? "border-primary/60 bg-primary/[0.08]" : "border-white/[0.06] hover:border-white/15")}>
                  <div className="flex items-center justify-between">
                    <p className="font-semibold">{m}</p>
                    <span className={cx("flex h-4 w-4 items-center justify-center rounded-full border", m === activeModel ? "border-primary bg-primary" : "border-white/20")}>{m === activeModel && <Check className="h-2.5 w-2.5 text-primary-foreground" />}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{m === "Flex" ? "Pay $9 entry fee today. Pay remaining only when you pass." : m === "Instant" ? "Skip the evaluation, trade funded today." : m === "One Step" ? "One phase (9% target), then funded." : "Two phases (6% / 5% targets)."}</p>
                </button>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader title="2. Account size" />
            <div className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-3 lg:grid-cols-6">
              {sizes.map((p) => {
                const offer = bogoFor(data.offers, p.model, p.size)[0];
                return (
                  <button key={p.id} onClick={() => setSize(p.size)} className={cx("relative rounded-xl border px-3 py-3 text-center transition", p.size === plan?.size ? "border-primary/60 bg-primary/[0.08]" : "border-white/[0.06] hover:border-white/15")}>
                    {offer && <span className="absolute -top-2 right-2 rounded-full bg-gold px-1.5 py-0.5 text-[9px] font-bold text-primary-foreground">{bogoBadge(offer)}</span>}
                    <p className="font-display font-semibold">{sizeLabel(p.size)}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{p.model === "Flex" ? `${price(p.price)} now` : price(p.price)}</p>
                    {p.model === "Flex" && (
                      <p className="text-[10px] text-muted-foreground/70">
                        Real: {price(p.realPrice ?? DEFAULT_REAL_PRICE[p.size] ?? p.price)}
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          </Card>

          <Card>
            <CardHeader title="3. Platform & payment" />
            <div className="space-y-5 p-5">
              <div className="flex flex-wrap gap-2">
                {PLATFORMS.map((p) => (
                  <button key={p} onClick={() => setPlatform(p)} className={cx("rounded-lg border px-4 py-2 text-sm font-medium transition", p === platform ? "border-primary/60 bg-primary/[0.08] text-primary" : "border-white/[0.08] text-muted-foreground hover:text-foreground")}>{p}</button>
                ))}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {([["Paddle", "Card / Apple Pay", <CreditCard key="c" className="h-4 w-4" />, !data.cardOk], ["Crypto QR", "USDT, BTC, SOL · extra 5% off", <Bitcoin key="b" className="h-4 w-4" />, false]] as const).map(([id, sub, icon, disabled]) => (
                  <button key={id} disabled={disabled} onClick={() => setMethod(id)} className={cx("flex items-center gap-3 rounded-xl border p-4 text-left transition disabled:opacity-40", payMethod === id ? "border-primary/60 bg-primary/[0.08]" : "border-white/[0.06] hover:border-white/15")}>
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.05] text-primary">{icon}</span>
                    <div>
                      <p className="text-sm font-semibold">{id === "Paddle" ? "Card payment" : "Crypto transfer"}</p>
                      <p className="text-xs text-muted-foreground">{disabled ? "Not available in your country" : sub}</p>
                    </div>
                  </button>
                ))}
              </div>
              <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-white/[0.06] p-4">
                <div>
                  <p className="text-sm font-semibold">Weekend holding add-on</p>
                  <p className="text-xs text-muted-foreground">Hold positions over the weekend · +20%</p>
                </div>
                <input type="checkbox" checked={weekend} onChange={(e) => setWeekend(e.target.checked)} className="h-4 w-4 accent-[var(--primary)]" />
              </label>
            </div>
          </Card>
        </div>

        {/* Summary */}
        <div className="xl:sticky xl:top-24 xl:self-start">
          <Card highlight>
            <CardHeader title="Order summary" />
            <div className="space-y-4 p-5">
              <div>
                <p className="font-display text-xl font-semibold">{activeModel} · {sizeLabel(plan?.size ?? 0)}</p>
                <p className="text-xs text-muted-foreground">{platform} · {payMethod === "Paddle" ? "Card" : "Crypto"}</p>
              </div>
              <dl className="space-y-2 text-sm">
                {RULES[activeModel].map(([k, v]) => (
                  <div key={k} className="flex justify-between"><dt className="text-muted-foreground">{k}</dt><dd className="font-medium">{v}</dd></div>
                ))}
              </dl>
              <div className="h-px bg-white/[0.06]" />
              {activeModel === "Flex" && (
                <div className="rounded-xl border border-primary/30 bg-primary/[0.06] p-3 text-xs">
                  <div className="flex items-center justify-between font-semibold">
                    <span className="text-foreground">Pay Today (Entry Fee):</span>
                    <span className="font-bold text-primary">{price(plan?.price ?? 9)}</span>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between text-muted-foreground">
                    <span>Real Account Price:</span>
                    <span>{price(plan?.realPrice ?? DEFAULT_REAL_PRICE[plan?.size ?? 100000] ?? 529)}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-muted-foreground">
                    <span>Remaining On Passing:</span>
                    <span className="font-medium text-foreground">
                      {price(Math.max(0, (plan?.realPrice ?? DEFAULT_REAL_PRICE[plan?.size ?? 100000] ?? 529) - (plan?.price ?? 9)))}
                    </span>
                  </div>
                  <p className="mt-2 border-t border-white/10 pt-1.5 text-[11px] text-muted-foreground">
                    ✨ Pay only <strong>{price(plan?.price ?? 9)}</strong> to trade Phase 1. You only pay the remaining price after passing evaluation to get funded.
                  </p>
                </div>
              )}
              {planOffers.map((o) => (
                <div key={o.id} className="flex items-start gap-2 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2.5 text-xs">
                  <Gift className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                  <span><span className="font-semibold text-primary">{o.name}</span> — {offerSummary(o)}. Applied automatically after payment.</span>
                </div>
              ))}
              <Field label="Coupon or referral code">
                <div className="relative">
                  <Tag className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Enter code" className={cx(inputCls, "pl-9 uppercase")} />
                </div>
              </Field>
              {code && (coupon ? (
                <div className="flex items-center gap-1.5 text-xs font-medium text-profit">
                  <Check className="h-3.5 w-3.5" />
                  <span>Promo {coupon.code} auto-applied — {coupon.discountPercent}% off</span>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Code will be checked at checkout.</p>
              ))}
              {data.referralBalance > 0 && (
                <label className="flex items-center justify-between text-sm">
                  <span>Use referral balance <span className="text-muted-foreground">({money(data.referralBalance)})</span></span>
                  <input type="checkbox" checked={useRef} onChange={(e) => setUseRef(e.target.checked)} className="h-4 w-4 accent-[var(--primary)]" />
                </label>
              )}
              <dl className="space-y-1.5 text-sm">
                <div className="flex justify-between"><dt className="text-muted-foreground">Price</dt><dd>{price(base)}</dd></div>
                {base - total > 0 && <div className="flex justify-between text-profit"><dt>Discounts</dt><dd>-{money(base - total)}</dd></div>}
              </dl>
              <div className="flex items-end justify-between">
                <span className="text-sm text-muted-foreground">Total</span>
                <span className="font-display text-3xl font-semibold">{money(total)}</span>
              </div>
              {err && <Note tone="error">{err}</Note>}
              <Button variant="primary" className="w-full" busy={busy} onClick={() => place()}>Continue to payment</Button>
              <p className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground"><ShieldCheck className="h-3.5 w-3.5" />One-time fee · refunded with your first payout</p>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
