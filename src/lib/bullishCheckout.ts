/**
 * Card payments go through the Bullish Academy hosted checkout
 * (https://www.bullish-academy.online/bullish-checkout.js).
 * Each product id there has a fixed price, so we pick the id whose price matches the amount.
 */
const BULLISH_ORIGIN = "https://www.bullish-academy.online";

/** Bullish checkout product id → price in USD. */
export const BULLISH_PRODUCTS: { id: string; price: number }[] = [
  { id: "101", price: 9 },
  { id: "102", price: 14 },
  { id: "103", price: 16 },
  { id: "104", price: 22 },
  { id: "105", price: 30 },
  { id: "106", price: 41 },
  { id: "107", price: 75 },
  { id: "108", price: 110 },
  { id: "109", price: 98 },
  { id: "110", price: 58 },
  { id: "111", price: 35 },
  { id: "112", price: 28 },
  { id: "113", price: 20 },
  { id: "114", price: 14 },
  { id: "115", price: 10 },
  { id: "116", price: 35 },
  { id: "117", price: 52 },
  { id: "118", price: 91 },
  { id: "119", price: 140 },
  { id: "120", price: 242 },
  { id: "121", price: 79 },
  { id: "122", price: 49 },
  { id: "123", price: 64 },
  { id: "124", price: 39 },
  { id: "125", price: 59 },
  { id: "126", price: 69 },
  { id: "127", price: 29 },
  { id: "128", price: 119 },
];

/** First Bullish product id priced at exactly `amount` (rounded to whole dollars), if any. */
export function bullishIdForPrice(...amounts: number[]): string | undefined {
  for (const a of amounts) {
    if (!Number.isFinite(a)) continue;
    const hit = BULLISH_PRODUCTS.find((p) => p.price === Math.round(a));
    if (hit) return hit.id;
  }
  return undefined;
}

/**
 * With an order id, it is sent as `orderId` and also tagged in the title ("… · Order o-123456"),
 * so the payment-success webhook can send it back and we can activate the right order.
 */
export function bullishCheckoutUrl(id: string, title: string, orderId?: string) {
  const params = new URLSearchParams({ id, title: orderId ? `${title} · Order ${orderId}` : title });
  if (orderId) params.set("orderId", orderId);
  return `${BULLISH_ORIGIN}/api/v1/checkout?${params.toString()}`;
}

type BullishWindow = Window & { BullishCheckout?: { open: (o: { id: string; title: string }) => void } };

/** Opens the Bullish card checkout (uses the loaded script when present, otherwise the same URL directly). */
export function openBullishCheckout(id: string, title: string) {
  const w = window as BullishWindow;
  if (w.BullishCheckout?.open) w.BullishCheckout.open({ id, title });
  else window.location.href = bullishCheckoutUrl(id, title);
}
