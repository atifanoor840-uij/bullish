import { beforeEach, describe, expect, it, vi } from "vitest";

const store = vi.hoisted(() => ({ order: null as Record<string, unknown> | null, activated: [] as unknown[] }));

vi.mock("@/server/db", () => ({
  PROOF_BUCKET: "proofs",
  eq: (v: string) => v,
  signedUrl: vi.fn(),
  uploadObject: vi.fn(),
  db: { one: vi.fn(async (_t: string, f: { id: string }) => (store.order && store.order["id"] === f.id ? store.order : null)) },
}));
vi.mock("@/server/core", async (orig) => ({
  ...(await orig<typeof import("@/server/core")>()),
  activateOrder: vi.fn(async (o: unknown, patch: unknown) => { store.activated.push({ o, patch }); }),
}));

import { bullishWebhook } from "@/server/handlers/orders";
import { hmacHex } from "@/server/http";

const SECRET = "test_bullish_secret";
const call = (body: unknown, headers: Record<string, string>) => {
  const req = new Request("http://x/api/orders/pay/bullish-webhook", { method: "POST", body: JSON.stringify(body), headers });
  return bullishWebhook({ req, url: new URL(req.url), method: "POST" } as never) as Promise<Response>;
};

describe("Bullish payment-success webhook", () => {
  beforeEach(() => {
    process.env["BULLISH_WEBHOOK_SECRET"] = SECRET;
    store.activated = [];
    store.order = { id: "o-123456", status: "Pending", paymentMethod: "Card", amountPaid: 9, gatewayRef: "bullish:101:platform=MT5" };
  });

  it("rejects a wrong secret", async () => {
    const r = await call({ event: "payment.succeeded", orderId: "o-123456" }, { authorization: "Bearer nope" });
    expect(r.status).toBe(401);
    expect(store.activated).toHaveLength(0);
  });

  it("activates the order with a bearer secret", async () => {
    const r = await call({ event: "payment.succeeded", orderId: "o-123456", amount: 9, paymentId: "pay_1" }, { authorization: `Bearer ${SECRET}` });
    expect(r.status).toBe(200);
    expect(store.activated).toHaveLength(1);
    expect(store.activated[0]).toMatchObject({ patch: { status: "Paid", gatewayRef: "bullish:101:pay_1:platform=MT5" } });
  });

  it("accepts an HMAC signature and finds the order from the title", async () => {
    const body = { type: "payment.succeeded", data: { title: "Flex $100K · Order o-123456", amount: 9 } };
    const sig = await hmacHex(SECRET, JSON.stringify(body));
    const r = await call(body, { "x-bullish-signature": sig });
    expect(r.status).toBe(200);
    expect(store.activated).toHaveLength(1);
  });

  it("refuses an underpayment", async () => {
    const r = await call({ event: "payment.succeeded", orderId: "o-123456", amount: 5 }, { authorization: `Bearer ${SECRET}` });
    expect(r.status).toBe(400);
    expect(store.activated).toHaveLength(0);
  });
});
