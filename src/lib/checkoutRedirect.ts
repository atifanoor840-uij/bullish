import { propApi } from "@/lib/propApi";
import { trackPixel } from "@/lib/metaPixel";

/** Only allow internal dashboard paths as a post-auth target. */
export function safeNext(n: string | null | undefined): string {
  return n && n.startsWith("/dashboard") ? n : "/dashboard";
}

/**
 * After sign-in/sign-up: if the target carries a `plan` (picked on the pricing page),
 * create the order and jump straight to the payment checkout. Otherwise go to the target.
 */
export async function redirectToCheckoutOrNext(targetNext: string): Promise<void> {
  const nextUrl = new URL(targetNext, window.location.origin);
  const planId = nextUrl.searchParams.get("plan");
  const couponCode = nextUrl.searchParams.get("coupon")?.trim().toUpperCase();
  if (planId) {
    try {
      const { order } = await propApi.orders.create({
        planId,
        paymentMethod: "Crypto",
        ...(couponCode ? { couponUsed: couponCode } : {}),
      });
      trackPixel("InitiateCheckout", {
        content_name: order.planName || planId,
        content_ids: [planId],
        content_type: "product",
        value: order.amountPaid,
        currency: "USD",
        num_items: 1,
      });
      const { checkoutUrl } = await propApi.orders.pay(order.id, "MT5");
      trackPixel("AddPaymentInfo", {
        content_name: `Order ${order.id}`,
        value: order.amountPaid,
        currency: "USD",
        payment_method: "Crypto",
      });
      window.location.href = checkoutUrl;
      return;
    } catch {
      // Fall back to the plan page if direct checkout cannot be initiated (e.g. crypto gateway unavailable).
    }
  }
  window.location.href = targetNext;
}
