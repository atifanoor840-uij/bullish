/**
 * propApi.ts — drop-in typed client for the prop-firm backend (/api/*).
 *
 * Copy into the frontend (e.g. src/lib/propApi.ts). Works in any
 * browser framework. Set API_BASE only if the backend is on another origin;
 * same-origin/proxy = leave "".
 */

export const API_BASE = "";

// ------------------------------------------------------------------ types
export type Role = "trader" | "admin" | "support" | "affiliate" | "collaborator";
export type User = {
  id: string; name: string; email: string; phone: string; country: string;
  role: Role; status: "active" | "suspended" | "banned";
  emailVerified?: boolean; referredBy?: string; createdAt: string;
};
export type PricingPlan = { id: string; model: "One Step" | "Two Step" | "Instant" | "Flex"; size: number; price: number; realPrice?: number; status: string };
export type Coupon = { code: string; discountPercent: number; status: string; expiresAt?: string; isExpired?: boolean };
export type Offer = {
  id: string; name: string; type: "bogo" | "free_retry"; description?: string; status: "active" | "paused";
  startsAt?: string; expiresAt?: string; accountSizes: number[]; models: string[]; userIds: string[]; accountIds: string[];
  buyQuantity: number; freeQuantity: number; retryLimit: number; maxRedemptions: number; redeemedCount: number;
  isExpired?: boolean; isScheduled?: boolean;
};
export type Order = {
  id: string; userId: string; planId: string; couponUsed: string; amountPaid: number;
  referralBalanceApplied?: number; weekendHoldingAddon?: boolean; legacyRules?: boolean;
  paymentMethod: string; status: string; gatewayRef: string; createdAt: string; updatedAt: string;
  planName?: string; userName?: string; userEmail?: string;
};
export type TradingAccount = {
  id: string; userId: string; orderId: string; platform: "MT4" | "MT5" | "cTrader"; login: string;
  passwordMaster: string; passwordInvestor: string; server: string; profitTarget: number;
  balance: number; equity: number; todayPl: number; totalPl: number;
  status: "Active" | "Passed" | "Failed" | "Funded"; phase?: string; graphLink: string;
  weekendHoldingAddon?: boolean; externalStatisticsId?: string; statisticsPayload?: any; statisticsUpdatedAt?: string;
  deliveryStatus: "pending" | "delivered"; deliveredAt?: string; createdAt: string;
  userName?: string; userEmail?: string;
  [computed: string]: unknown; // compliance fields added by the server
};
export type Payout = {
  id: string; accountId: string; userId: string; amount: number; profitSplitAmount: number; firmShareAmount: number;
  paymentMethod: string; paymentDetails: string; status: "pending" | "approved" | "processing" | "paid" | "rejected";
  approvedBy?: string; approvedAt?: string; notes?: string; createdAt: string; userName?: string; userEmail?: string;
};
export type Kyc = {
  userId: string; documentType: "passport" | "national_id" | "drivers_license" | "didit";
  frontUrl: string; backUrl: string; selfieUrl: string; addressUrl: string;
  status: "pending" | "approved" | "rejected" | "needs_review"; rejectReason?: string; updatedAt: string;
};
export type Notification = {
  id: string; userId: string; title: string; message: string; type: "info" | "success" | "warning" | "error";
  channel: "in_app" | "email"; status: "sent" | "failed"; read: boolean; sentAt: string;
};
export type Certificate = { id: string; userId: string; accountId: string; traderName: string; accountSize: number; planName: string; datePassed: string };
export type InventoryItem = {
  id: string; platform: "MT4" | "MT5" | "cTrader"; size: number; login: string; password: string; server: string;
  externalStatisticsId?: string; graphLink?: string; status: "available" | "delivered"; orderId?: string; createdAt?: string;
};

export class ApiError extends Error {
  constructor(message: string, public status: number, public data: any) { super(message); }
}

// ------------------------------------------------------------------ core
async function request<T = any>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  // Dev-only demo backend (?demo=1). The branch is dropped from production builds.
  if (import.meta.env.DEV) {
    const demo = await import("./demoApi");
    if (demo.demoEnabled()) return demo.demoRequest(path, init) as Promise<T>;
  }
  const { json, headers, body, ...rest } = init;
  const reqInit: RequestInit = {
    credentials: "include",
    ...rest,
  };
  if (json !== undefined) {
    reqInit.headers = { "Content-Type": "application/json", ...(headers as Record<string, string>) };
    reqInit.body = JSON.stringify(json);
  } else {
    if (headers !== undefined) reqInit.headers = headers;
    if (body !== undefined) reqInit.body = body;
  }
  const res = await fetch(API_BASE + path, reqInit);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.success === false) {
    throw new ApiError(data?.error || `HTTP ${res.status}`, res.status, data);
  }
  return data as T;
}
const get = <T = any>(p: string) => request<T>(p);
const post = <T = any>(p: string, json?: unknown) => request<T>(p, { method: "POST", json: json ?? {} });
const put = <T = any>(p: string, json: unknown) => request<T>(p, { method: "PUT", json });
const patch = <T = any>(p: string, json: unknown) => request<T>(p, { method: "PATCH", json });
const del = <T = any>(p: string) => request<T>(p, { method: "DELETE" });
const q = (params: Record<string, string | number | undefined>) => {
  const s = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => v !== undefined && v !== "" && s.set(k, String(v)));
  const str = s.toString();
  return str ? `?${str}` : "";
};

/** true when the error means "not logged in" → redirect to sign-in */
export const isUnauthorized = (e: unknown) => e instanceof ApiError && e.status === 401;

// ------------------------------------------------------------------ API
export const propApi = {
  auth: {
    signup: (b: { name: string; email: string; password: string; phone?: string; country?: string; referralCode?: string; collaboratorCode?: string; locale?: string }) =>
      post<{ success: true; user: User; emailSent: boolean; verificationPage: string }>("/api/auth/signup", b),
    signin: (email: string, password: string) =>
      post<{ success: true; user: User; emailVerified: boolean }>("/api/auth/signin", { email, password }),
    signout: () => post("/api/auth/signout"),
    me: () => get<{ success: true; user: User }>("/api/auth/me"),
    updateProfile: (b: { name?: string; phone?: string; country?: string }) => put<{ success: true; user: User }>("/api/auth/me", b),
    resendVerification: (email: string, locale = "en") => post("/api/auth/resend-verification", { email, locale }),
    crmSignin: (email: string, password: string) => post<{ success: true; user: User }>("/api/auth/crm/signin", { email, password }),
    crmSignup: (b: { name: string; email: string; password: string; passcode: string }) => post<{ success: true; user: User }>("/api/auth/crm/signup", b),
    impersonate: (userId: string) => post<{ success: true; user: User }>("/api/auth/crm/impersonate", { userId }),
    collaboratorSignin: (email: string, password: string) => post("/api/auth/collaborator/signin", { email, password }),
  },

  catalog: {
    pricingPlans: () => get<{ success: true; plans: PricingPlan[] }>("/api/pricing-plans"),
    savePricingPlan: (b: { model: PricingPlan["model"]; size: number; price: number; realPrice?: number; status?: string }) => post<{ plan: PricingPlan }>("/api/pricing-plans", b),
    deletePricingPlan: (id: string) => del(`/api/pricing-plans${q({ id })}`),
    legacyPlans: () => get("/api/plans"),
    coupons: () => get<{ success: true; coupons: Coupon[] }>("/api/coupons"),
    saveCoupon: (b: { code: string; discountPercent: number; status?: string; expiresAt?: string }) => post<{ coupon: Coupon }>("/api/coupons", b),
    deleteCoupon: (code: string) => del(`/api/coupons${q({ code })}`),
    offers: () => get<{ success: true; offers: Offer[] }>("/api/offers"),
    saveOffer: (b: Partial<Offer> & { name: string; type: Offer["type"] }) => post<{ offer: Offer }>("/api/offers", b),
    setOfferStatus: (id: string, status: "active" | "paused") => patch<{ offer: Offer }>("/api/offers", { id, status }),
    deleteOffer: (id: string) => del(`/api/offers${q({ id })}`),
    accountOffers: () => get<{ success: true; tags: Record<string, any[]>; offers: any[] }>("/api/offers/accounts"),
    retryEligibility: () => get<{ success: true; eligibility: any[] }>("/api/offers/retry"),
    claimRetry: (accountId: string) => post<{ success: true; account: TradingAccount; order: Order; retriesRemaining: number }>("/api/offers/retry", { accountId }),
  },

  orders: {
    list: () => get<{ success: true; orders: Order[] }>("/api/orders"),
    create: (b: { planId: string; paymentMethod: string; couponUsed?: string; useReferralBalance?: boolean; weekendHoldingAddon?: boolean; expectedAmount?: number }) =>
      post<{ success: true; order: Order }>("/api/orders", b),
    pay: (orderId: string, platform: "MT4" | "MT5" | "cTrader" = "MT5", locale = "en") =>
      post<{ success: true; provider: string; checkoutUrl: string; gatewayRef: string }>("/api/orders/pay", { orderId, platform, locale }),
    submitManualPayment: (b: { orderId: string; walletId: string; txid: string; screenshot: File }) => {
      const form = new FormData();
      form.set("orderId", b.orderId); form.set("walletId", b.walletId); form.set("txid", b.txid); form.set("screenshot", b.screenshot);
      return request<{ success: true; order: Order }>("/api/orders/manual-payment", { method: "POST", body: form });
    },
    viewPaymentProof: (orderId: string) => get<{ success: true; url: string; walletId: string; txid: string }>(`/api/orders/manual-payment${q({ orderId })}`),
    setStatus: (orderId: string, status: string) => put<{ success: true; order: Order }>("/api/orders", { orderId, status }),
    setLegacyRules: (orderId: string, legacyRules: boolean) => put<{ success: true; order: Order }>("/api/orders", { orderId, legacyRules }),
    remove: (id: string) => del<{ success: true; removedAccounts: number }>(`/api/orders${q({ id })}`),
  },

  accounts: {
    list: () => get<{ success: true; accounts: TradingAccount[] }>("/api/accounts"),
    requestNextStage: (accountId: string) => post<{ success: true; message: string; accountId: string }>("/api/accounts/request-next", { accountId }),
    save: (b: { id: string; platform: string; login: string; passwordMaster: string; server: string; passwordInvestor?: string; profitTarget?: number; graphLink?: string; balance?: number; equity?: number; status?: TradingAccount["status"]; phase?: string; externalStatisticsId?: string; inventoryItemId?: string; orderId?: string; userId?: string }) =>
      put<{ success: true; account: TradingAccount }>("/api/accounts", b),
    remove: (id: string) => del(`/api/accounts${q({ id })}`),
  },

  payouts: {
    list: () => get<{ success: true; payouts: Payout[] }>("/api/payouts"),
    request: (b: { accountId: string; amount: number; paymentMethod: string; paymentDetails: Record<string, string> | string }) =>
      post<{ success: true; payout: Payout; withdrawal: { requestedAmount: number; adjustedAmount: number; withdrawalCap: number; remainingProfit: number; wasAdjusted: boolean }; complianceReview: boolean }>("/api/payouts", b),
    review: (payoutId: string, status: Payout["status"], notes?: string) => put<{ success: true; payout: Payout }>("/api/payouts", { payoutId, status, notes }),
  },

  kyc: {
    get: (userId?: string) => get<{ success: true; kyc?: Kyc | Kyc[]; isEligible?: boolean; users?: User[] }>(`/api/kyc${q({ userId })}`),
    startDidit: () => post<{ success: true; kyc: Kyc; simulated: boolean }>("/api/kyc", { method: "didit-create" }),
    syncDidit: (userId?: string) => post<{ success: true; kyc: Kyc; simulated: boolean }>("/api/kyc", { method: "didit-sync", userId }),
    submitDocuments: (b: { documentType: Kyc["documentType"]; frontUrl: string; backUrl?: string; selfieUrl: string; addressUrl: string }) => post<{ success: true; kyc: Kyc }>("/api/kyc", b),
    review: (userId: string, status: Kyc["status"], rejectReason?: string) => put<{ success: true; kyc: Kyc }>("/api/kyc", { userId, status, rejectReason }),
  },

  affiliate: {
    get: () => get("/api/affiliate"),
    updateRate: (affiliateUserId: string, commissionRate: number) => put("/api/affiliate", { action: "update_rate", affiliateUserId, commissionRate }),
    updateReferral: (referredUserId: string, orderId: string, status: "pending" | "approved" | "paid") => put("/api/affiliate", { action: "update_referral", referredUserId, orderId, status }),
  },

  collaborators: {
    get: () => get("/api/collaborators"),
    create: (b: { name: string; email: string; password: string; referralCode?: string }) => post("/api/collaborators", b),
    setSaleStatus: (referredUserId: string, orderId: string, status: "pending" | "approved" | "paid") => put("/api/collaborators", { referredUserId, orderId, status }),
  },

  notifications: {
    list: () => get<{ success: true; notifications: Notification[] }>("/api/notifications"),
    markRead: (id: string, read = true) => put("/api/notifications", { id, read }),
    send: (b: { title: string; message: string; targetUserId?: string; type?: Notification["type"]; channel?: Notification["channel"] }) => post<{ success: true; count: number }>("/api/notifications", b),
  },

  certificates: {
    mine: () => get<{ success: true; certificates: Certificate[] }>("/api/certificates"),
    verify: (id: string) => get<{ success: true; verified: true; certificate: Certificate }>(`/api/certificates${q({ id })}`),
  },

  admin: {
    users: () => get<{ success: true; users: User[] }>("/api/users"),
    updateUser: (b: { userId: string; name?: string; email?: string; phone?: string; country?: string; role?: Role; status?: User["status"]; referredBy?: string; newPassword?: string }) => put<{ success: true; user: User }>("/api/users", b),
    auditLogs: () => get("/api/audit-logs"),
    emailLogs: (userId?: string) => get(`/api/email-logs${q({ userId })}`),
    inventory: () => get<{ success: true; plans: InventoryItem[] }>("/api/challenge-inventory"),
    addInventory: (b: { platform: string; size: number; login: string; password: string; server: string; externalStatisticsId?: string; graphLink?: string }) => post<{ plan: InventoryItem }>("/api/challenge-inventory", b),
    updateInventory: (b: Partial<InventoryItem> & { id: string }) => put<{ plan: InventoryItem }>("/api/challenge-inventory", b),
    deleteInventory: (id: string) => del(`/api/challenge-inventory${q({ id })}`),
    promotions: (accountSizes?: number[]) => get(`/api/promotions${q({ accountSizes: accountSizes?.join(",") })}`),
    savePromotionTemplate: (b: { id?: string; name: string; subject: string; html: string }) => (b.id ? put("/api/promotions", b) : post("/api/promotions", b)),
    deletePromotionTemplate: (id: string) => del(`/api/promotions${q({ id })}`),
    sendPromotion: (b: { subject: string; html: string; recipients: string[] }) => post("/api/promotions/send", b),
    newsletterSubscribers: () => get("/api/newsletter"),
    pixelEvents: () => get("/api/pixel-events"),
  },

  public: {
    subscribeNewsletter: (email: string, source: "footer" | "home" = "footer") => post("/api/newsletter", { email, source }),
    geo: () => get<{ success: true; country: string; isPakistan: boolean; cardPaymentAvailable: boolean }>("/api/geo"),
    news: () => get<{ success: true; news: { title: string; description: string; link: string; date: string; time: string }[] }>("/api/news"),
    trackPixel: (b: { eventName: string; eventId?: string; value?: number; currency?: string; contentName?: string; contentIds?: string; eventSourceUrl?: string }) => post("/api/pixel-events", b),
    conversion: (b: { eventName: string; eventId?: string; email?: string; customData?: Record<string, unknown> }) => post("/api/conversions", b),
  },
};

// ------------------------------------------------------------------ pricing mirror
export function computeCheckoutTotal(input: {
  catalogPrice: number; weekendHoldingAddon?: boolean; discountPercent?: number;
  isCrypto?: boolean; referralBalance?: number; useReferralBalance?: boolean;
}) {
  const base = input.catalogPrice * (input.weekendHoldingAddon ? 1.2 : 1);
  const pct = (input.discountPercent || 0) + (input.isCrypto ? 5 : 0);
  const final = Math.ceil(base - base * (pct / 100));
  const referral = input.useReferralBalance ? Number(Math.min(final, input.referralBalance || 0).toFixed(2)) : 0;
  return Number((final - referral).toFixed(2));
}
