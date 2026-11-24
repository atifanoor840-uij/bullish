import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DBAccount, DBOrder } from "@/server/types";

// In-memory stand-in for the Supabase layer: records every update and applies it to `rows`.
const rows = new Map<string, Record<string, unknown>>();
const updates: { table: string; filter: Record<string, unknown>; patch: Record<string, unknown> }[] = [];
const notifications: string[] = [];

vi.mock("@/server/db", () => ({
  eq: (v: unknown) => `eq.${v}`,
  neq: (v: unknown) => `neq.${v}`,
  inList: (vs: unknown[]) => `in.(${vs.join(",")})`,
  db: {
    one: async () => null,
    select: async () => [],
    insert: async (_t: string, row: unknown) => [row],
    remove: async () => {},
    update: async (table: string, filter: Record<string, string>, patch: Record<string, unknown>) => {
      updates.push({ table, filter, patch });
      if (table !== "trading_accounts") return [];
      const row = rows.get(filter["id"]!.slice(3));
      // Honour the optimistic `status` filter like PostgREST would.
      if (!row || (filter["status"] && `eq.${row["status"]}` !== filter["status"])) return [];
      Object.assign(row, patch);
      return [{ ...row }];
    },
  },
}));
vi.mock("@/server/core", async (orig) => ({
  ...(await orig<typeof import("@/server/core")>()),
  notify: async (_u: string, title: string) => void notifications.push(title),
  audit: async () => {},
}));

const { decorateAndEnforce } = await import("@/server/handlers/accounts");

const order: DBOrder = {
  id: "ord-1", userId: "u1", planId: "pp-two-step-100k", couponUsed: "", amountPaid: 500, paymentMethod: "card",
  status: "Live Active", gatewayRef: "ref", createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z",
};
const recent = new Date(Date.now() - 2 * 864e5);
while (recent.getUTCDay() === 0 || recent.getUTCDay() === 6) recent.setUTCDate(recent.getUTCDate() - 1);
const day = recent.toISOString().slice(0, 10);

const account = (over: Partial<DBAccount> = {}): DBAccount => {
  const a: DBAccount = {
    id: "acc-1", userId: "u1", orderId: "ord-1", platform: "MT5", login: "1", passwordMaster: "p", passwordInvestor: "i",
    server: "s", balance: 100000, equity: 100000, profitTarget: 6000, todayPl: 0, totalPl: 0, status: "Active",
    phase: "Phase 1 (Evaluation)", graphLink: "", deliveryStatus: "delivered", deliveredAt: day, createdAt: day,
    externalStatisticsId: null, statisticsUpdatedAt: day, weekendHoldingAddon: false,
    statisticsPayload: { trades: [{ ticket: "1", symbol: "EURUSD", volume: 1, open_time: `${day}T10:00:00Z`, close_time: `${day}T10:30:00Z`, net_profit: 50 }] },
    ...over,
  };
  rows.set(a.id, { ...a });
  return a;
};
const shortHold = { trades: [{ ticket: "2", symbol: "EURUSD", volume: 1, open_time: `${day}T10:00:00Z`, close_time: `${day}T10:01:00Z`, net_profit: 50 }] };

describe("auto-fail on hard rule breach", () => {
  beforeEach(() => {
    rows.clear();
    updates.length = 0;
    notifications.length = 0;
  });

  it("leaves a clean account alone", async () => {
    const res = await decorateAndEnforce(account(), order);
    expect(res.status).toBe("Active");
    expect(updates).toEqual([]);
  });

  it("fails the account, its order and emails the trader on a breach", async () => {
    const res = await decorateAndEnforce(account({ statisticsPayload: shortHold }), order);
    expect(res.status).toBe("Failed");
    expect(res.breachReason).toContain("Minimum Holding Time");
    expect(updates.find((u) => u.table === "orders")?.patch["status"]).toBe("Failed");
    expect(notifications).toEqual(["Challenge failed"]);
  });

  it("fails only once when two requests race", async () => {
    const a = account({ statisticsPayload: shortHold });
    await Promise.all([decorateAndEnforce(a, order), decorateAndEnforce(a, order)]);
    expect(notifications).toHaveLength(1);
  });

  it("does not re-fail an account the admin reinstated for that breach", async () => {
    const res = await decorateAndEnforce(account({ statisticsPayload: { ...shortHold, _waivedBreaches: ["minimum-holding-time"] } }), order);
    expect(res.status).toBe("Active");
    expect(res.ruleChecks.find((c) => c.id === "minimum-holding-time")?.status).toBe("warning");
    expect(notifications).toEqual([]);
  });

  it("never touches passed accounts", async () => {
    const res = await decorateAndEnforce(account({ status: "Passed", statisticsPayload: shortHold }), order);
    expect(res.status).toBe("Passed");
    expect(updates).toEqual([]);
  });
});
