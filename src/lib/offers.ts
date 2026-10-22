/** Offer helpers shared by the buy page, landing pricing and the trader offers page. */
import type { Offer } from "@/lib/propApi";
import { sizeLabel } from "@/lib/portal";

/** Active, started, not expired and not sold out — mirrors the backend's "live" rule. */
export function isLive(o: Offer, now = Date.now()) {
  if (o.status !== "active" || o.isExpired || o.isScheduled) return false;
  if (o.startsAt && new Date(o.startsAt).getTime() > now) return false;
  if (o.expiresAt && new Date(o.expiresAt).getTime() < now) return false;
  return !o.maxRedemptions || o.redeemedCount < o.maxRedemptions;
}

/** Public offers only: ones not restricted to specific users or accounts. */
export const isPublic = (o: Offer) => !(o.userIds?.length || o.accountIds?.length);

/** Does the offer cover this model + account size? Empty scope lists mean "all". */
export function covers(o: Offer, model: string, size: number) {
  const sizeOk = !o.accountSizes?.length || o.accountSizes.map(Number).includes(Number(size));
  const modelOk = !o.models?.length || o.models.some((m) => m.toLowerCase().replace(/[-\s]/g, "") === model.toLowerCase().replace(/[-\s]/g, ""));
  return sizeOk && modelOk;
}

/** Live BOGO offers that apply to a plan at checkout. */
export const bogoFor = (offers: Offer[], model: string, size: number) =>
  offers.filter((o) => o.type === "bogo" && isLive(o) && isPublic(o) && covers(o, model, size));

/** Short human summary, e.g. "Buy 1, get 1 free · $100K". */
export function offerSummary(o: Offer) {
  const scope = [o.accountSizes?.length ? o.accountSizes.map((s) => sizeLabel(Number(s))).join(", ") : "", o.models?.length ? o.models.join(", ") : ""].filter(Boolean).join(" · ");
  const what = o.type === "bogo"
    ? `Buy ${o.buyQuantity || 1}, get ${o.freeQuantity || 1} free`
    : `${o.retryLimit || 1} free ${o.retryLimit > 1 ? "retries" : "retry"} if an account fails`;
  return scope ? `${what} · ${scope}` : what;
}

/** Badge text for a size chip, e.g. "+1 free". */
export const bogoBadge = (o: Offer) => `+${o.freeQuantity || 1} free`;
