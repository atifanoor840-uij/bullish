/** Row shapes of the Supabase tables (camelCase columns, as stored). */

export type Role = "trader" | "admin" | "support" | "affiliate" | "collaborator";

export type DBUser = {
  id: string; name: string; email: string; phone: string; country: string; passwordHash: string;
  role: Role; status: "active" | "suspended" | "banned"; createdAt: string;
  referredBy?: string | null; emailVerified?: boolean | null; emailVerifiedAt?: string | null;
};

export type DBPricingPlan = { id: string; model: "One Step" | "Two Step" | "Instant" | "Flex"; size: number; price: number; realPrice?: number; status: string; createdAt?: string };

export type DBChallengePlan = {
  id: string; name: string; size: number; price: number; profitTargetP1: number; profitTargetP2: number;
  maxDailyLoss: number; maxTotalLoss: number; profitSplit: number; platform?: string; login?: string; password?: string; server?: string;
};

export type DBCoupon = { code: string; discountPercent: number; status: string; createdAt?: string; expiresAt?: string | null };

export type DBOrder = {
  id: string; userId: string; planId: string; couponUsed: string; amountPaid: number; paymentMethod: string; status: string;
  gatewayRef: string; createdAt: string; updatedAt: string; referralBalanceApplied?: number | null; weekendHoldingAddon?: boolean | null;
  legacyRules?: boolean | null;
};

export type AccountStatus = "Active" | "Passed" | "Failed" | "Funded";

export type DBAccount = {
  id: string; userId: string; orderId: string; platform: string; login: string; passwordMaster: string; passwordInvestor: string;
  server: string; profitTarget: number; balance: number; equity: number; todayPl: number; totalPl: number; status: AccountStatus;
  phase: string; graphLink: string; deliveryStatus: "pending" | "delivered"; deliveredAt?: string | null; createdAt: string;
  externalStatisticsId?: string | null; statisticsPayload?: Record<string, unknown> | null; statisticsUpdatedAt?: string | null;
  statisticsApiId?: string | null; weekendHoldingAddon?: boolean | null;
};

export type DBPayout = {
  id: string; accountId: string; userId: string; amount: number; profitSplitAmount: number; firmShareAmount: number;
  paymentMethod: string; paymentDetails: string; status: "pending" | "approved" | "processing" | "paid" | "rejected";
  approvedBy?: string | null; approvedAt?: string | null; notes?: string | null; createdAt: string;
};

export type DBKyc = {
  userId: string; documentType: string; frontUrl: string; backUrl: string; selfieUrl: string; addressUrl: string;
  status: "pending" | "approved" | "rejected" | "needs_review"; rejectReason?: string | null; updatedAt: string;
};

export type DBNotification = {
  id: string; userId: string; title: string; message: string; type: "info" | "success" | "warning" | "error";
  channel: "in_app" | "email"; status: "sent" | "failed"; read: boolean; sentAt: string;
};

export type DBInventory = {
  id: string; platform: string; size: number; login: string; password: string; server: string;
  externalStatisticsId?: string | null; graphLink?: string | null; status: "available" | "delivered"; orderId?: string | null; createdAt?: string;
};

export type DBOffer = {
  id: string; name: string; type: "bogo" | "free_retry"; code?: string | null; description?: string | null; status: "active" | "paused";
  startsAt?: string | null; expiresAt?: string | null; accountSizes: number[]; models: string[]; userIds: string[]; accountIds: string[];
  buyQuantity: number; freeQuantity: number; retryLimit: number; maxRedemptions: number; redeemedCount: number;
  createdAt?: string; updatedAt?: string;
};

export type DBOfferRedemption = {
  id: string; offerId: string; userId: string; type: string; sourceAccountId?: string | null; newAccountId?: string | null;
  orderId?: string | null; status: string; createdAt: string;
};

export type DBAffiliate = { userId: string; referralCode: string; commissionRate: number };
export type DBReferral = { referredUserId: string; affiliateId: string; orderId: string; commissionAmount: number; status: "pending" | "approved" | "paid"; createdAt: string };
export type DBCollaborator = { userId: string; referralCode: string; commissionRate: number; createdAt?: string };
export type DBCollaboratorSale = {
  referredUserId: string; collaboratorId: string; orderId: string; saleAmount: number; commissionAmount: number;
  status: "pending" | "approved" | "paid"; createdAt: string;
};
export type DBCertificate = { id: string; userId: string; accountId: string; traderName: string; accountSize: number; planName: string; datePassed: string };
