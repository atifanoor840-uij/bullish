import { describe, expect, it } from "vitest";
import { describeAccount, isWinningDay, modelOf } from "@/lib/portal";
import { PROFIT_SPLIT_BY_WITHDRAWAL } from "@/server/core";
import { decorateAccount } from "@/server/stats";
import type { DBAccount, DBOrder } from "@/server/types";
import type { TradingAccount, Order } from "@/lib/propApi";

const makeOrder = (overrides: Partial<Order> = {}): Order => ({
  id: "ord-test",
  userId: "u1",
  planId: "pp-two-step-100k",
  planName: "Two Step 100K",
  couponUsed: "",
  amountPaid: 500,
  paymentMethod: "card",
  status: "Active",
  gatewayRef: "ref",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  ...overrides,
});

const makeTradingAccount = (overrides: Partial<TradingAccount> = {}): TradingAccount => ({
  id: "acc-test",
  userId: "u1",
  orderId: "ord-test",
  platform: "MT5",
  login: "10001",
  passwordMaster: "pass",
  passwordInvestor: "inv",
  server: "server",
  balance: 100000,
  equity: 100000,
  profitTarget: 6000,
  todayPl: 0,
  totalPl: 0,
  status: "Active",
  phase: "Phase 1 (Evaluation)",
  graphLink: "",
  deliveryStatus: "delivered",
  createdAt: "2026-01-01T00:00:00Z",
  ...overrides,
});

const makeDBOrder = (overrides: Partial<DBOrder> = {}): DBOrder => ({
  id: "ord-test",
  userId: "u1",
  planId: "pp-two-step-100k",
  couponUsed: "",
  amountPaid: 500,
  paymentMethod: "card",
  status: "Live Active",
  gatewayRef: "ref",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  ...overrides,
});

const makeDBAccount = (overrides: Partial<DBAccount> = {}): DBAccount => ({
  id: "10001",
  userId: "u1",
  orderId: "ord-test",
  platform: "MT5",
  login: "10001",
  passwordMaster: "pass",
  passwordInvestor: "inv",
  server: "Bullish4ex-Live",
  balance: 100000,
  equity: 100000,
  profitTarget: 0,
  todayPl: 0,
  totalPl: 0,
  status: "Funded",
  phase: "Funded (Live)",
  graphLink: "",
  deliveryStatus: "delivered",
  deliveredAt: "2026-01-01T00:00:00Z",
  createdAt: "2026-01-01T00:00:00Z",
  externalStatisticsId: null,
  statisticsUpdatedAt: "2026-01-15T00:00:00Z",
  weekendHoldingAddon: false,
  statisticsPayload: { trades: [] },
  ...overrides,
});

describe("Bullish4ex Rulebook Validation", () => {
  describe("Evaluation Models & Targets", () => {
    it("identifies model from plan names correctly", () => {
      expect(modelOf("One Step 100K")).toBe("One Step");
      expect(modelOf("1-Step $50,000")).toBe("One Step");
      expect(modelOf("Two Step 100K")).toBe("Two Step");
      expect(modelOf("2-Step $25,000")).toBe("Two Step");
      expect(modelOf("Instant 50K")).toBe("Instant");
      expect(modelOf("Flex 100K")).toBe("Flex");
    });

    it("verifies 1-Step rules: 9% target, 4% daily loss, 6% max loss, 3 Winning Days", () => {
      const mockOrder = makeOrder({ id: "ord-1", planId: "pp-one-step-100k", planName: "One Step 100K" });
      const mockAccount = makeTradingAccount({ id: "acc-1", orderId: "ord-1", profitTarget: 9000 });

      const info = describeAccount(mockAccount, { "ord-1": mockOrder });
      expect(info.model).toBe("One Step");
      expect(info.size).toBe(100000);
      expect(info.target).toBe(9000); // 9% of 100k
      expect(info.dailyLimit).toBe(4000); // 4% daily drawdown
      expect(info.maxLimit).toBe(6000); // 6% static max loss
      expect(info.minDays).toBe(3); // 3 Winning Days
    });

    it("verifies 2-Step rules: Phase 1 (6%), Phase 2 (5%), 4% daily, 6% max loss", () => {
      const mockOrder = makeOrder({ id: "ord-2", planId: "pp-two-step-100k", planName: "Two Step 100K" });
      const p1Account = makeTradingAccount({ id: "acc-2a", orderId: "ord-2", phase: "Phase 1 (Evaluation)", profitTarget: 6000 });
      const p2Account = makeTradingAccount({ id: "acc-2b", orderId: "ord-2", phase: "Phase 2 (Verification)", profitTarget: 5000 });

      const infoP1 = describeAccount(p1Account, { "ord-2": mockOrder });
      expect(infoP1.target).toBe(6000); // Phase 1 is 6%
      expect(infoP1.dailyLimit).toBe(4000);
      expect(infoP1.maxLimit).toBe(6000);
      expect(infoP1.minDays).toBe(3);

      const infoP2 = describeAccount(p2Account, { "ord-2": mockOrder });
      expect(infoP2.target).toBe(5000); // Phase 2 is 5%
      expect(infoP2.dailyLimit).toBe(4000);
      expect(infoP2.maxLimit).toBe(6000);
      expect(infoP2.minDays).toBe(3);
    });

    it("verifies Instant rules: no target, 3% daily drawdown, 6% max loss, 5 Winning Days", () => {
      const mockOrder = makeOrder({ id: "ord-3", planId: "pp-instant-100k", planName: "Instant 100K" });
      const instantAccount = makeTradingAccount({ id: "acc-3", orderId: "ord-3", status: "Funded", phase: "Funded (Live)", profitTarget: 0 });

      const info = describeAccount(instantAccount, { "ord-3": mockOrder });
      expect(info.target).toBe(0);
      expect(info.dailyLimit).toBe(3000); // 3% on Instant
      expect(info.maxLimit).toBe(6000); // 6% static max loss
      expect(info.minDays).toBe(5); // 5 Winning Days before payout
    });

    it("verifies Flex rules: 4% target, 4% daily drawdown, 8% trailing max loss", () => {
      const mockOrder = makeOrder({ id: "ord-4", planId: "pp-flex-100k", planName: "Flex 100K" });
      const flexAccount = makeTradingAccount({ id: "acc-4", orderId: "ord-4", profitTarget: 4000 });

      const info = describeAccount(flexAccount, { "ord-4": mockOrder });
      expect(info.target).toBe(4000); // 4% evaluation target
      expect(info.dailyLimit).toBe(4000); // 4% daily limit
      expect(info.maxLimit).toBe(8000); // 8% trailing loss
      expect(info.isTrailing).toBe(true);
      expect(info.minDays).toBe(0); // No min days in evaluation
    });
  });

  describe("Winning Days Calculator", () => {
    it("requires at least 0.5% profit on starting balance to count as a Winning Day", () => {
      const initialSize = 100000;
      // 0.5% of 100,000 = $500
      expect(isWinningDay(500, initialSize)).toBe(true);
      expect(isWinningDay(650, initialSize)).toBe(true);
      expect(isWinningDay(499.99, initialSize)).toBe(false);
      expect(isWinningDay(0, initialSize)).toBe(false);
      expect(isWinningDay(-100, initialSize)).toBe(false);
    });
  });

  describe("Profit Split Ladder", () => {
    it("follows the official 70% -> 80% -> 90% -> 100% split schedule", () => {
      expect(PROFIT_SPLIT_BY_WITHDRAWAL[0]).toBe(70);
      expect(PROFIT_SPLIT_BY_WITHDRAWAL[1]).toBe(80);
      expect(PROFIT_SPLIT_BY_WITHDRAWAL[2]).toBe(90);
      expect(PROFIT_SPLIT_BY_WITHDRAWAL[3]).toBe(100);
    });
  });

  describe("Instant and Funded Rules Engine Checks (decorateAccount)", () => {
    it("flags trades held under 3 minutes (180 seconds)", async () => {
      const dbAccount = makeDBAccount({
        statisticsPayload: {
          trades: [
            {
              ticket: "101",
              symbol: "EURUSD",
              volume: 1.0,
              open_time: "2026-01-10T10:00:00Z",
              close_time: "2026-01-10T10:01:30Z", // 90 seconds hold -> under 180s!
              net_profit: 150,
            },
          ],
        },
      });
      const dbOrder = makeDBOrder();

      const decorated = await decorateAccount(dbAccount, dbOrder);
      const minHoldCheck = decorated.ruleChecks.find((c) => c.id === "minimum-holding-time");
      expect(minHoldCheck).toBeDefined();
      expect(minHoldCheck?.status).toBe("failed");
      expect(minHoldCheck?.info).toContain("under 3 minutes");
    });

    it("evaluates Maximum Daily Drawdown and flags breaches", async () => {
      const dbAccount = makeDBAccount({
        balance: 95500,
        equity: 95500,
        todayPl: -4500, // Lost $4,500 today on $100k account (Limit is 4% = $4,000)
        totalPl: -4500,
      });
      const dbOrder = makeDBOrder();

      const decorated = await decorateAccount(dbAccount, dbOrder);
      const dailyCheck = decorated.ruleChecks.find((c) => c.id === "daily-drawdown");
      expect(dailyCheck).toBeDefined();
      expect(dailyCheck?.status).toBe("failed");
    });

    it("verifies 1% Per-Trade Risk Rule on Funded accounts", async () => {
      const dbAccount = makeDBAccount({
        balance: 98000,
        equity: 98000,
        totalPl: -2000,
        statisticsPayload: {
          trades: [
            {
              ticket: "201",
              symbol: "XAUUSD",
              volume: 1.0,
              open_time: "2026-01-10T10:00:00Z",
              close_time: "2026-01-10T10:30:00Z",
              net_profit: -1500, // Lost $1,500 on single trade (Exceeds 1% of $100k = $1,000!)
            },
          ],
        },
      });
      const dbOrder = makeDBOrder();

      const decorated = await decorateAccount(dbAccount, dbOrder);
      const riskCheck = decorated.ruleChecks.find((c) => c.id === "one-percent-risk");
      expect(riskCheck).toBeDefined();
      expect(riskCheck?.status).toBe("failed");
      expect(riskCheck?.info).toContain("exceeded the 1% floating loss limit");
    });

    it("verifies Trade Layering (10-min minimum gap between open times)", async () => {
      const dbAccount = makeDBAccount({
        statisticsPayload: {
          trades: [
            {
              ticket: "301",
              symbol: "EURUSD",
              volume: 1.0,
              open_time: "2026-01-10T10:00:00Z",
              close_time: "2026-01-10T10:15:00Z",
              net_profit: 100,
            },
            {
              ticket: "302",
              symbol: "EURUSD",
              volume: 1.0,
              open_time: "2026-01-10T10:04:00Z", // Only 4 minutes after trade 301 opened! Breach!
              close_time: "2026-01-10T10:20:00Z",
              net_profit: 100,
            },
          ],
        },
      });
      const dbOrder = makeDBOrder();

      const decorated = await decorateAccount(dbAccount, dbOrder);
      const layeringCheck = decorated.ruleChecks.find((c) => c.id === "trade-layering");
      expect(layeringCheck).toBeDefined();
      expect(layeringCheck?.status).toBe("failed");
      expect(layeringCheck?.info).toContain("violation(s)");
    });

    it("verifies Instant accounts 3rd concurrent layer hard breach", async () => {
      const dbAccount = makeDBAccount({
        id: "10006",
        statisticsPayload: {
          trades: [
            { ticket: "401", symbol: "EURUSD", volume: 1.0, open_time: "2026-01-10T10:00:00Z", close_time: "2026-01-10T11:00:00Z", net_profit: 50 },
            { ticket: "402", symbol: "GBPUSD", volume: 1.0, open_time: "2026-01-10T10:15:00Z", close_time: "2026-01-10T11:00:00Z", net_profit: 50 },
            // Trade 3 opens while 401 & 402 are still open -> 3rd concurrent layer on Instant!
            { ticket: "403", symbol: "USDJPY", volume: 1.0, open_time: "2026-01-10T10:30:00Z", close_time: "2026-01-10T11:00:00Z", net_profit: 50 },
          ],
        },
      });
      const dbOrder = makeDBOrder({ planId: "pp-instant-100k" });

      const decorated = await decorateAccount(dbAccount, dbOrder);
      const layeringCheck = decorated.ruleChecks.find((c) => c.id === "trade-layering");
      expect(layeringCheck).toBeDefined();
      expect(layeringCheck?.status).toBe("failed");
      expect(layeringCheck?.info).toContain("3 or more concurrent layers were open");
    });

    it("verifies Weekend holding check catches positions open between Friday 23:00 and Sunday 23:00 UTC", async () => {
      const dbAccount = makeDBAccount({
        weekendHoldingAddon: false, // NO addon!
        statisticsPayload: {
          trades: [
            // 2026-01-17 was Saturday!
            { ticket: "501", symbol: "BTCUSD", volume: 1.0, open_time: "2026-01-17T12:00:00Z", close_time: "2026-01-17T14:00:00Z", net_profit: 100 },
          ],
        },
      });
      const dbOrder = makeDBOrder();

      const decorated = await decorateAccount(dbAccount, dbOrder);
      const weekendCheck = decorated.ruleChecks.find((c) => c.id === "weekend-holding");
      expect(weekendCheck).toBeDefined();
      expect(weekendCheck?.status).toBe("warning");
      expect(weekendCheck?.info).toContain("without add-on");
    });

    it("verifies Inactivity rule (marks failed when no trade for 30 consecutive calendar days)", async () => {
      const thirtyFiveDaysAgo = new Date(Date.now() - 35 * 864e5).toISOString();
      const dbAccount = makeDBAccount({
        deliveredAt: thirtyFiveDaysAgo,
        createdAt: thirtyFiveDaysAgo,
        statisticsUpdatedAt: thirtyFiveDaysAgo,
        statisticsPayload: { trades: [] },
      });
      const dbOrder = makeDBOrder({ createdAt: thirtyFiveDaysAgo, updatedAt: thirtyFiveDaysAgo });

      const decorated = await decorateAccount(dbAccount, dbOrder);
      const inactivityCheck = decorated.ruleChecks.find((c) => c.id === "inactivity");
      expect(inactivityCheck).toBeDefined();
      expect(inactivityCheck?.status).toBe("failed");
      expect(inactivityCheck?.info).toContain("no trades executed in 30 consecutive calendar days");
    });
  });
});
