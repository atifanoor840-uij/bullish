/* eslint-disable @typescript-eslint/no-explicit-any -- loose mock data for the dev-only demo backend */
/**
 * Dev-only demo backend. Lets the dashboard and CRM be previewed without the real
 * /api server: open any page with `?demo=1` (turn off with `?demo=0`).
 * Only ever active when `import.meta.env.DEV` is true, so production builds never use it.
 */

const KEY = "b4x-demo";

export function demoEnabled(): boolean {
  if (!import.meta.env.DEV || typeof window === "undefined") return false;
  try {
    const q = new URLSearchParams(window.location.search).get("demo");
    if (q === "1") localStorage.setItem(KEY, "1");
    if (q === "0") localStorage.removeItem(KEY);
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

/* ---------------- seeded data ---------------- */

let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const daysAgo = (d: number, h = 10) => new Date(Date.now() - d * 864e5 - h * 36e5).toISOString();

const symbols = ["XAUUSD", "EURUSD", "GBPUSD", "NAS100", "US30", "USDJPY", "BTCUSD"];
function makeTrades(n: number, bias: number, days: number) {
  return Array.from({ length: n }, (_, i) => {
    const open = Date.now() - (days - (i * days) / n) * 864e5 - rnd() * 6e7;
    const hold = 300 + rnd() * 14000;
    const profit = Math.round((rnd() - 0.5 + bias) * 900 * 100) / 100;
    return {
      ticket: String(48210000 + i * 7),
      symbol: symbols[Math.floor(rnd() * symbols.length)],
      type: rnd() > 0.45 ? "BUY" : "SELL",
      volume: Math.round((0.5 + rnd() * 2.5) * 100) / 100,
      open_time: new Date(open).toISOString(),
      close_time: new Date(open + hold * 1000).toISOString(),
      profit,
    };
  });
}
const stats = (trades: ReturnType<typeof makeTrades>) => ({ statistics: { advanced_statistics: { charts: { recent_trades_duration: trades } } } });

const users = [
  { id: "u-trader01", name: "Hamza Raza", email: "hamza@example.com", phone: "+92 300 0000000", country: "PK", role: "trader", status: "active", emailVerified: true, createdAt: daysAgo(60) },
  { id: "u-trader02", name: "Elena Vidal", email: "elena@example.com", phone: "", country: "ES", role: "trader", status: "active", emailVerified: true, createdAt: daysAgo(40) },
  { id: "u-trader03", name: "Marcus Tate", email: "marcus@example.com", phone: "", country: "GB", role: "trader", status: "suspended", emailVerified: false, createdAt: daysAgo(22) },
  { id: "u-trader04", name: "Yuki Sato", email: "yuki@example.com", phone: "", country: "JP", role: "trader", status: "active", emailVerified: true, createdAt: daysAgo(9) },
  { id: "u-col-001", name: "Ali Partners", email: "ali@partner.com", phone: "", country: "AE", role: "collaborator", status: "active", emailVerified: true, createdAt: daysAgo(80) },
  { id: "u-admin-01", name: "Admin", email: "admin@bullish4ex.com", phone: "", country: "PK", role: "admin", status: "active", emailVerified: true, createdAt: daysAgo(120) },
];

const sizes = [5000, 10000, 25000, 50000, 100000, 200000];
const base: Record<number, number> = { 5000: 49, 10000: 89, 25000: 179, 50000: 299, 100000: 529, 200000: 999 };
const plans = (["One Step", "Two Step", "Instant"] as const).flatMap((model) =>
  sizes.map((size) => ({
    id: `pp-${model.toLowerCase().replace(" ", "-")}-${size / 1000}k`,
    model,
    size,
    price: Math.round(base[size]! * (model === "One Step" ? 1.1 : model === "Instant" ? 2.6 : 1)),
    status: size === 200000 && model === "Instant" ? "inactive" : "active",
    createdAt: daysAgo(100),
  })),
);

const coupons = [
  { code: "WELCOME10", discountPercent: 10, status: "active", expiresAt: daysAgo(-30), isExpired: false, createdAt: daysAgo(20) },
  { code: "BULL25", discountPercent: 25, status: "active", isExpired: false, createdAt: daysAgo(10) },
  { code: "SUMMER15", discountPercent: 15, status: "expired", expiresAt: daysAgo(5), isExpired: true, createdAt: daysAgo(90) },
];

const offers = [
  { id: "offer-bogo-1", name: "Buy 1 Get 1 — 100K", type: "bogo", description: "Buy a $100K challenge and get a second one free.", status: "active", accountSizes: [100000], models: [], userIds: [], accountIds: [], buyQuantity: 1, freeQuantity: 1, retryLimit: 0, maxRedemptions: 100, redeemedCount: 23, expiresAt: daysAgo(-12) },
  { id: "offer-retry-1", name: "Free Retry", type: "free_retry", description: "One free retry on any failed Two Step account.", status: "active", accountSizes: [], models: ["Two Step"], userIds: [], accountIds: [], buyQuantity: 1, freeQuantity: 1, retryLimit: 1, maxRedemptions: 0, redeemedCount: 41 },
];

const orders = [
  { id: "o-4821", userId: "u-trader01", planId: "pp-two-step-100k", planName: "Two Step $100K", couponUsed: "WELCOME10", amountPaid: 477, paymentMethod: "Paddle", status: "Live Active", gatewayRef: "paddle:txn_1", createdAt: daysAgo(45), updatedAt: daysAgo(10) },
  { id: "o-5530", userId: "u-trader01", planId: "pp-one-step-50k", planName: "One Step $50K", couponUsed: "", amountPaid: 329, paymentMethod: "Crypto QR", status: "Active", gatewayRef: "manual:USDT_TRC20:abc:proof", createdAt: daysAgo(14), updatedAt: daysAgo(13) },
  { id: "o-6102", userId: "u-trader01", planId: "pp-two-step-25k", planName: "Two Step $25K", couponUsed: "", amountPaid: 179, paymentMethod: "Paddle", status: "Failed", gatewayRef: "paddle:txn_2", createdAt: daysAgo(30), updatedAt: daysAgo(6) },
  { id: "o-7015", userId: "u-trader01", planId: "pp-instant-10k", planName: "Instant $10K", couponUsed: "", amountPaid: 231, paymentMethod: "Crypto QR", status: "Pending", gatewayRef: "gway_1", createdAt: daysAgo(1), updatedAt: daysAgo(1) },
  { id: "o-7120", userId: "u-trader02", planId: "pp-two-step-50k", planName: "Two Step $50K", couponUsed: "BULL25", amountPaid: 225, paymentMethod: "Paddle", status: "Paid", gatewayRef: "paddle:txn_3", createdAt: daysAgo(0, 4), updatedAt: daysAgo(0, 4) },
  { id: "o-7133", userId: "u-trader04", planId: "pp-one-step-10k", planName: "One Step $10K", couponUsed: "", amountPaid: 98, paymentMethod: "Crypto QR", status: "Pending", gatewayRef: "manual:USDT_BEP20:0xabc:proof", createdAt: daysAgo(0, 2), updatedAt: daysAgo(0, 2) },
];

const funded = makeTrades(46, 0.12, 24);
const phase1 = makeTrades(18, 0.08, 10);
const failed = makeTrades(22, -0.18, 12);
const sum = (t: { profit: number }[]) => Math.round(t.reduce((s, x) => s + x.profit, 0) * 100) / 100;

const accounts = [
  { id: "731204", userId: "u-trader01", orderId: "o-4821", platform: "MT5", login: "731204", passwordMaster: "Fx!9kLm2", passwordInvestor: "Inv#44a", server: "Bullish4ex-Live", profitTarget: 0, balance: 100000 + sum(funded), equity: 100000 + sum(funded) - 120, todayPl: 342.5, totalPl: sum(funded), status: "Funded", phase: "Funded (Live)", graphLink: "https://example.com/stats/731204", deliveryStatus: "delivered", statisticsPayload: stats(funded), statisticsUpdatedAt: daysAgo(0, 1), createdAt: daysAgo(25), userName: "Hamza Raza", userEmail: "hamza@example.com", ruleChecks: [
    { id: "daily-drawdown", label: "Daily drawdown", status: "passed", info: "Max daily loss used 18%" },
    { id: "overall-drawdown", label: "Overall drawdown", status: "passed", info: "Equity stays above $95,000" },
    { id: "minimum-holding-time", label: "Minimum holding time", status: "passed", info: "All trades held ≥ 3 minutes" },
    { id: "news-trading", label: "News trading", status: "warning", info: "1 trade opened 4 minutes before CPI" },
    { id: "weekend-holding", label: "Weekend holding", status: "passed", info: "No positions held over the weekend" },
  ] },
  { id: "731877", userId: "u-trader01", orderId: "o-5530", platform: "MT5", login: "731877", passwordMaster: "Pq7!zR4s", passwordInvestor: "Inv#91b", server: "Bullish4ex-Demo", profitTarget: 5000, balance: 50000 + sum(phase1), equity: 50000 + sum(phase1), todayPl: -86.2, totalPl: sum(phase1), status: "Active", phase: "Phase 1 (Evaluation)", graphLink: "", deliveryStatus: "delivered", statisticsPayload: stats(phase1), statisticsUpdatedAt: daysAgo(0, 1), createdAt: daysAgo(13), userName: "Hamza Raza", userEmail: "hamza@example.com" },
  { id: "729955", userId: "u-trader01", orderId: "o-6102", platform: "MT5", login: "729955", passwordMaster: "Zx3!pp0", passwordInvestor: "Inv#12c", server: "Bullish4ex-Demo", profitTarget: 2000, balance: 25000 + sum(failed), equity: 25000 + sum(failed), todayPl: 0, totalPl: sum(failed), status: "Failed", phase: "Phase 1 (Evaluation)", graphLink: "", deliveryStatus: "delivered", statisticsPayload: { ...stats(failed), breachReason: "Daily drawdown limit of $1,000 was exceeded on Oct 16." }, createdAt: daysAgo(29), userName: "Hamza Raza", userEmail: "hamza@example.com" },
  { id: "pending-7120", userId: "u-trader02", orderId: "o-7120", platform: "MT5", login: "", passwordMaster: "", passwordInvestor: "", server: "Bullish4ex-PendingServer", profitTarget: 4000, balance: 50000, equity: 50000, todayPl: 0, totalPl: 0, status: "Active", phase: "Phase 1 (Evaluation)", graphLink: "", deliveryStatus: "pending", createdAt: daysAgo(0, 4), userName: "Elena Vidal", userEmail: "elena@example.com" },
];

const payouts = [
  { id: "pay-2201", accountId: "731204", userId: "u-trader01", amount: 4200, profitSplitAmount: 3360, firmShareAmount: 840, paymentMethod: "USDT (TRC20)", paymentDetails: JSON.stringify({ address: "TQ7v…9xK" }), status: "paid", approvedAt: daysAgo(8), createdAt: daysAgo(9), userName: "Hamza Raza", userEmail: "hamza@example.com" },
  { id: "pay-2390", accountId: "731204", userId: "u-trader01", amount: 2800, profitSplitAmount: 2380, firmShareAmount: 420, paymentMethod: "Rise", paymentDetails: JSON.stringify({ email: "hamza@example.com" }), status: "pending", createdAt: daysAgo(0, 6), userName: "Hamza Raza", userEmail: "hamza@example.com" },
];

const kyc: any[] = [
  { userId: "u-trader01", documentType: "didit", frontUrl: "", backUrl: "", selfieUrl: "", addressUrl: "Approved", status: "approved", updatedAt: daysAgo(12), userName: "Hamza Raza", userEmail: "hamza@example.com" },
  { userId: "u-trader02", documentType: "passport", frontUrl: "https://example.com/front.jpg", backUrl: "", selfieUrl: "https://example.com/selfie.jpg", addressUrl: "https://example.com/address.pdf", status: "pending", updatedAt: daysAgo(1), userName: "Elena Vidal", userEmail: "elena@example.com" },
];

const notifications = [
  { id: "n1", userId: "u-trader01", title: "Payout requested", message: "Your payout of $2,800 is being reviewed.", type: "info", channel: "in_app", status: "sent", read: false, sentAt: daysAgo(0, 6) },
  { id: "n2", userId: "u-trader01", title: "Account funded", message: "Congratulations! Your $100K account is now funded.", type: "success", channel: "in_app", status: "sent", read: false, sentAt: daysAgo(10) },
  { id: "n3", userId: "u-trader01", title: "Account breached", message: "Account #729955 breached the daily drawdown rule.", type: "error", channel: "email", status: "sent", read: true, sentAt: daysAgo(6) },
];

const certificates = [
  { id: "cert-731204", userId: "u-trader01", accountId: "731204", traderName: "Hamza Raza", accountSize: 100000, planName: "Two Step $100K — Funded", datePassed: daysAgo(10) },
  { id: "cert-pay-2201", userId: "u-trader01", accountId: "731204", traderName: "Hamza Raza", accountSize: 3360, planName: "Payout certificate", datePassed: daysAgo(8) },
];

const inventory = [
  { id: "inv-MT5-880101", platform: "MT5", size: 50000, login: "880101", password: "Tm#1x", server: "Bullish4ex-Demo", status: "available", createdAt: daysAgo(3) },
  { id: "inv-MT5-880102", platform: "MT5", size: 100000, login: "880102", password: "Tm#2y", server: "Bullish4ex-Demo", status: "available", createdAt: daysAgo(3) },
  { id: "inv-MT5-731204", platform: "MT5", size: 100000, login: "731204", password: "Fx!9kLm2", server: "Bullish4ex-Live", status: "delivered", orderId: "o-4821", createdAt: daysAgo(40) },
];

const templates = [
  { id: "7d1f6a0e-0000-4000-8000-000000000001", name: "Weekend sale", subject: "25% off every challenge this weekend", html: "<h1>Weekend sale</h1><p>Use code BULL25.</p>", updatedAt: daysAgo(4) },
];

const log = (i: number, action: string, description: string) => ({ id: `log-${i}`, userId: "u-admin-01", userName: "Admin", targetId: "o-4821", targetType: "order", action, description, createdAt: daysAgo(i, i) });


const db: any = {
  users, plans, coupons, offers, orders, accounts, payouts, notifications, certificates, inventory, templates,
  audit: [log(1, "order_status_update", "Order o-4821 → Live Active"), log(2, "account_delivery", "Delivered MT5 #731877"), log(3, "user_impersonate", "Logged in as Hamza Raza")],
  emails: [
    { id: "e1", userId: "u-trader01", toEmail: "hamza@example.com", subject: "Your payout was sent", status: "sent", provider: "smtp", sentAt: daysAgo(8) },
    { id: "e2", userId: "u-trader02", toEmail: "elena@example.com", subject: "Verify your email", status: "failed", provider: "smtp", error: "Mailbox unavailable", sentAt: daysAgo(2) },
  ],
  pixel: [
    { id: "px1", eventName: "Purchase", status: "sent", source: "capi", value: 477, currency: "USD", orderId: "o-4821", createdAt: daysAgo(45) },
    { id: "px2", eventName: "InitiateCheckout", status: "sent", source: "pixel", createdAt: daysAgo(1) },
    { id: "px3", eventName: "Purchase", status: "failed", source: "capi", value: 225, currency: "USD", orderId: "o-7120", error: "Invalid token", createdAt: daysAgo(0, 4) },
  ],
  newsletter: [
    { id: 1, email: "lead1@example.com", source: "footer", status: "active", createdAt: daysAgo(3) },
    { id: 2, email: "lead2@example.com", source: "home", status: "active", createdAt: daysAgo(1) },
  ],
};

/* ---------------- router ---------------- */

const me = () => {
  const admin = window.location.pathname.startsWith("/admin");
  let as = "";
  try { as = localStorage.getItem("b4x-demo-as") || ""; } catch { /* ignore */ }
  return db.users.find((u: any) => u.id === (admin ? "u-admin-01" : as || "u-trader01"));
};
const isAdmin = () => me().role === "admin";
const mine = (rows: any[]) => (isAdmin() ? rows : rows.filter((r) => r.userId === me().id));

export async function demoRequest(path: string, init: RequestInit & { json?: unknown }): Promise<any> {
  await new Promise((r) => setTimeout(r, 250));
  const url = new URL(path, "http://demo");
  const p = url.pathname;
  const m = (init.method || "GET").toUpperCase();
  const body = (init.json ?? {}) as any;
  const ok = (data: object = {}) => ({ success: true, ...data });

  if (p === "/api/auth/me") return m === "PUT" ? ok({ user: Object.assign(me(), body) }) : ok({ user: me() });
  if (p === "/api/auth/crm/impersonate") {
    localStorage.setItem("b4x-demo-as", body.userId);
    return ok({ user: db.users.find((u: any) => u.id === body.userId) });
  }
  if (p === "/api/auth/signout") localStorage.removeItem("b4x-demo-as");
  if (p.startsWith("/api/auth/")) return ok({ user: me(), emailVerified: true });

  if (p === "/api/pricing-plans") {
    if (m === "POST") {
      const id = `pp-${String(body.model).toLowerCase().replace(" ", "-")}-${body.size / 1000}k`;
      const plan = { id, status: "active", ...body };
      db.plans = [...db.plans.filter((x: any) => x.id !== id), plan];
      return ok({ plan });
    }
    if (m === "DELETE") { db.plans = db.plans.filter((x: any) => x.id !== url.searchParams.get("id")); return ok(); }
    return ok({ plans: db.plans });
  }
  if (p === "/api/coupons") {
    if (m === "POST") { const c = { status: "active", ...body, code: String(body.code).toUpperCase() }; db.coupons = [...db.coupons.filter((x: any) => x.code !== c.code), c]; return ok({ coupon: c }); }
    if (m === "DELETE") { db.coupons = db.coupons.filter((x: any) => x.code !== url.searchParams.get("code")); return ok(); }
    return ok({ coupons: db.coupons });
  }
  if (p === "/api/offers") {
    if (m === "POST") { const o = { id: body.id || `offer-${body.type}-${Date.now()}`, redeemedCount: 0, accountSizes: [], models: [], userIds: [], accountIds: [], ...body }; db.offers = [...db.offers.filter((x: any) => x.id !== o.id), o]; return ok({ offer: o }); }
    if (m === "PATCH") { const o = db.offers.find((x: any) => x.id === body.id); Object.assign(o, { status: body.status }); return ok({ offer: o }); }
    if (m === "DELETE") { db.offers = db.offers.filter((x: any) => x.id !== url.searchParams.get("id")); return ok(); }
    return ok({ offers: db.offers });
  }
  if (p === "/api/offers/accounts") return ok({ tags: { "731877": [{ offerId: "offer-retry-1", offerName: "Free Retry", offerType: "free_retry", kind: "active", label: "Free retry available", detail: "" }] }, offers: db.offers });
  if (p === "/api/offers/retry") {
    if (m === "POST") return ok({ account: db.accounts[0], order: db.orders[0], retriesRemaining: 0 });
    return ok({ eligibility: [{ accountId: "729955", accountSize: 25000, planName: "Two Step $25K", claimedCount: 0, offer: { id: "offer-retry-1", name: "Free Retry", retriesRemaining: 1 } }] });
  }

  if (p === "/api/orders") {
    if (m === "POST") {
      const plan = db.plans.find((x: any) => x.id === body.planId);
      const o = { id: `o-${Math.floor(rnd() * 9000 + 1000)}`, userId: me().id, planId: body.planId, planName: `${plan?.model} $${(plan?.size ?? 0) / 1000}K`, couponUsed: body.couponUsed || "", amountPaid: body.expectedAmount ?? plan?.price, paymentMethod: body.paymentMethod, status: "Pending", gatewayRef: "gway_demo", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      db.orders = [o, ...db.orders];
      return ok({ order: o });
    }
    if (m === "PUT") { const o = db.orders.find((x: any) => x.id === body.orderId); Object.assign(o, body.status ? { status: body.status } : { legacyRules: body.legacyRules }); return ok({ order: o }); }
    if (m === "DELETE") { db.orders = db.orders.filter((x: any) => x.id !== url.searchParams.get("id")); return ok({ removedAccounts: 0 }); }
    return ok({ orders: mine(db.orders).map((o: any) => ({ ...o, ...(isAdmin() ? { userName: db.users.find((u: any) => u.id === o.userId)?.name, userEmail: db.users.find((u: any) => u.id === o.userId)?.email } : {}) })) });
  }
  if (p === "/api/orders/pay") return ok({ provider: "demo", checkoutUrl: "/dashboard?payment=success", gatewayRef: "demo" });
  if (p === "/api/orders/manual-payment") return m === "GET" ? ok({ url: "https://placehold.co/600x900/png?text=Payment+proof", walletId: "USDT_TRC20", txid: "a1b2c3d4e5f6…" }) : ok({ order: db.orders[0] });

  if (p === "/api/accounts") {
    if (m === "PUT") { const a = db.accounts.find((x: any) => x.id === body.id); Object.assign(a, body, { deliveryStatus: "delivered" }); return ok({ account: a }); }
    if (m === "DELETE") { db.accounts = db.accounts.filter((x: any) => x.id !== url.searchParams.get("id")); return ok(); }
    return ok({ accounts: mine(db.accounts) });
  }
  if (p === "/api/accounts/request-next") return ok({ message: "Next stage requested", accountId: body.accountId });

  if (p === "/api/payouts") {
    if (m === "POST") {
      const po = { id: `pay-${Math.floor(rnd() * 9000 + 1000)}`, userId: me().id, accountId: body.accountId, amount: body.amount, profitSplitAmount: body.amount * 0.8, firmShareAmount: body.amount * 0.2, paymentMethod: body.paymentMethod, paymentDetails: JSON.stringify(body.paymentDetails), status: "pending", createdAt: new Date().toISOString() };
      db.payouts = [po, ...db.payouts];
      return ok({ payout: po, withdrawal: { requestedAmount: body.amount, adjustedAmount: body.amount, withdrawalCap: 6000, remainingProfit: 2000, wasAdjusted: false }, complianceReview: false });
    }
    if (m === "PUT") { const po = db.payouts.find((x: any) => x.id === body.payoutId); Object.assign(po, { status: body.status, notes: body.notes }); return ok({ payout: po }); }
    return ok({ payouts: mine(db.payouts) });
  }

  if (p === "/api/kyc") {
    if (m === "PUT") { const k = kyc.find((x) => x.userId === body.userId); Object.assign(k, { status: body.status, rejectReason: body.rejectReason }); return ok({ kyc: k }); }
    if (m === "POST") return ok({ kyc: kyc[0], simulated: true });
    if (isAdmin()) return ok({ kyc, users: db.users });
    return ok({ kyc: kyc.find((x) => x.userId === me().id), isEligible: true });
  }

  if (p === "/api/affiliate") {
    if (m === "PUT") return ok();
    const referrals = [
      { referredUserId: "u-trader04", referredName: "Yuki Sato", referredEmail: "yuki@example.com", orderId: "o-7133", planName: "One Step $10K", amountPaid: 98, commissionAmount: 4.9, status: "pending", createdAt: daysAgo(0, 2), affiliateName: "Hamza Raza", referralCode: "HAMZARA123" },
      { referredUserId: "u-trader02", referredName: "Elena Vidal", referredEmail: "elena@example.com", orderId: "o-7120", planName: "Two Step $50K", amountPaid: 225, commissionAmount: 11.25, status: "approved", createdAt: daysAgo(0, 4), affiliateName: "Hamza Raza", referralCode: "HAMZARA123" },
    ];
    if (isAdmin()) return ok({ affiliates: [{ userId: "u-trader01", referralCode: "HAMZARA123", commissionRate: 10, name: "Hamza Raza", email: "hamza@example.com" }, { userId: "u-trader02", referralCode: "ELENAVI482", commissionRate: 10, name: "Elena Vidal", email: "elena@example.com" }], referrals });
    return ok({ affiliate: { userId: "u-trader01", referralCode: "HAMZARA123", commissionRate: 10 }, metrics: { totalReferrals: 2, totalEarned: 16.15, pendingEarned: 4.9, paidEarned: 0 }, referrals });
  }
  if (p === "/api/collaborators") {
    if (m !== "GET") return ok();
    const sales = [{ referredUserId: "u-trader04", referredName: "Yuki Sato", orderId: "o-7133", saleAmount: 98, commissionAmount: 19.6, status: "approved", createdAt: daysAgo(0, 2), collaboratorId: "u-col-001" }];
    return ok({ collaborators: [{ userId: "u-col-001", referralCode: "ALIPART", commissionRate: 20, name: "Ali Partners", email: "ali@partner.com", metrics: { registrations: 14, totalSales: 2210, commissions: 442, paidCommissions: 300 }, sales }], sales });
  }

  if (p === "/api/notifications") {
    if (m === "PUT") { const n = db.notifications.find((x: any) => x.id === body.id); if (n) n.read = body.read; return ok({ notification: n }); }
    if (m === "POST") return ok({ count: body.targetUserId === "all" ? db.users.length : 1 });
    return ok({ notifications: mine(db.notifications) });
  }
  if (p === "/api/certificates") {
    const id = url.searchParams.get("id");
    if (id) { const c = db.certificates.find((x: any) => x.id === id); if (!c) throw new Error("Certificate not found"); return ok({ verified: true, certificate: c }); }
    return ok({ certificates: mine(db.certificates) });
  }

  if (p === "/api/users") {
    if (m === "PUT") { const u = db.users.find((x: any) => x.id === body.userId); Object.assign(u, body); return ok({ user: u }); }
    return ok({ users: db.users });
  }
  if (p === "/api/challenge-inventory") {
    if (m === "POST") { const it = { id: `inv-${body.platform}-${body.login}`, status: "available", createdAt: new Date().toISOString(), ...body }; db.inventory = [it, ...db.inventory]; return ok({ plan: it }); }
    if (m === "PUT") { const it = db.inventory.find((x: any) => x.id === body.id); Object.assign(it, body); return ok({ plan: it }); }
    if (m === "DELETE") { db.inventory = db.inventory.filter((x: any) => x.id !== url.searchParams.get("id")); return ok(); }
    return ok({ plans: db.inventory });
  }
  if (p === "/api/promotions") {
    if (m === "POST" || m === "PUT") { const t = { id: body.id || crypto.randomUUID(), updatedAt: new Date().toISOString(), ...body }; db.templates = [t, ...db.templates.filter((x: any) => x.id !== t.id)]; return ok({ template: t }); }
    if (m === "DELETE") { db.templates = db.templates.filter((x: any) => x.id !== url.searchParams.get("id")); return ok(); }
    return ok({ templates: db.templates, presets: [], availableAccountSizes: sizes, warnings: [] });
  }
  if (p === "/api/promotions/send") return ok({ sentCount: body.recipients?.length ?? 0, failedCount: 0, failed: [] });
  if (p === "/api/newsletter") return ok({ subscribers: db.newsletter });
  if (p === "/api/audit-logs") return ok({ logs: db.audit });
  if (p === "/api/email-logs") return ok({ emailLogs: db.emails.filter((e: any) => !url.searchParams.get("userId") || e.userId === url.searchParams.get("userId")) });
  if (p === "/api/pixel-events") return ok({ events: db.pixel, summary: { total: 3, sent: 2, failed: 1, purchases: 2, purchaseValue: 702 } });
  if (p === "/api/geo") return ok({ country: "PK", isPakistan: true, cardPaymentAvailable: false });
  if (p === "/api/news") return ok({ news: [] });

  return ok();
}
