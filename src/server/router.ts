/**
 * /api/* dispatcher. Each entry is "METHOD /path" → handler. Handlers return a plain object
 * (sent as `{ success: true, ...data }`) or a ready Response; thrown HttpErrors become `{ error }`.
 */
import { DbError } from "./db";
import { HttpError, json, makeCtx, type Ctx } from "./http";
import * as auth from "./handlers/auth";
import * as catalog from "./handlers/catalog";
import * as orders from "./handlers/orders";
import * as accounts from "./handlers/accounts";
import * as payouts from "./handlers/payouts";
import * as kyc from "./handlers/kyc";
import * as partners from "./handlers/partners";
import * as admin from "./handlers/admin";

type Handler = (ctx: Ctx) => Promise<Response | Record<string, unknown>>;

const routes: Record<string, Handler> = {
  "POST /auth/signup": auth.signup,
  "GET /auth/verify-email": auth.verifyEmail,
  "POST /auth/resend-verification": auth.resendVerification,
  "POST /auth/signin": auth.signin,
  "POST /auth/signout": auth.signout,
  "GET /auth/me": auth.me,
  "PUT /auth/me": auth.updateMe,
  "POST /auth/crm/signin": auth.crmSignin,
  "POST /auth/crm/signup": auth.crmSignup,
  "POST /auth/crm/impersonate": auth.impersonate,
  "POST /auth/collaborator/signin": auth.collaboratorSignin,

  "GET /pricing-plans": catalog.listPricingPlans,
  "POST /pricing-plans": catalog.savePricingPlan,
  "DELETE /pricing-plans": catalog.deletePricingPlan,
  "GET /plans": catalog.listPlans,
  "POST /plans": catalog.createPlan,
  "PUT /plans": catalog.updatePlan,
  "DELETE /plans": catalog.deletePlan,
  "GET /coupons": catalog.listCoupons,
  "POST /coupons": catalog.saveCoupon,
  "DELETE /coupons": catalog.deleteCoupon,
  "GET /offers": catalog.listOffers,
  "POST /offers": catalog.saveOffer,
  "PATCH /offers": catalog.setOfferStatus,
  "DELETE /offers": catalog.deleteOffer,
  "GET /offers/accounts": catalog.accountOffers,
  "GET /offers/retry": catalog.retryEligibility,
  "POST /offers/retry": catalog.claimRetry,

  "GET /orders": orders.listOrders,
  "POST /orders": orders.createOrder,
  "PUT /orders": orders.updateOrder,
  "DELETE /orders": orders.deleteOrder,
  "POST /orders/pay": orders.payOrder,
  "POST /orders/pay/paddle-webhook": orders.paddleWebhook,
  "POST /orders/pay/whop-webhook": orders.whopWebhook,
  "POST /orders/manual-payment": orders.submitManualPayment,
  "GET /orders/manual-payment": orders.viewManualPayment,

  "GET /accounts": accounts.listAccounts,
  "PUT /accounts": accounts.saveAccount,
  "DELETE /accounts": accounts.deleteAccount,
  "POST /accounts/request-next": accounts.requestNext,
  "POST /accounts/refresh-stats": accounts.refreshAccountStats,

  "GET /payouts": payouts.listPayouts,
  "POST /payouts": payouts.requestPayout,
  "PUT /payouts": payouts.reviewPayout,

  "GET /kyc": kyc.getKyc,
  "POST /kyc": kyc.postKyc,
  "PUT /kyc": kyc.reviewKyc,
  "POST /kyc/didit-webhook": kyc.diditWebhook,

  "GET /affiliate": partners.getAffiliate,
  "PUT /affiliate": partners.updateAffiliate,
  "GET /collaborators": partners.getCollaborators,
  "POST /collaborators": partners.createCollaborator,
  "PUT /collaborators": partners.setCollaboratorSale,

  "GET /notifications": admin.listNotifications,
  "POST /notifications": admin.sendNotification,
  "PUT /notifications": admin.markNotification,
  "GET /certificates": admin.certificates,
  "GET /email-logs": admin.emailLogs,
  "GET /audit-logs": admin.auditLogs,
  "GET /users": admin.listUsers,
  "PUT /users": admin.updateUser,
  "GET /challenge-inventory": admin.listInventory,
  "POST /challenge-inventory": admin.addInventory,
  "PUT /challenge-inventory": admin.updateInventory,
  "DELETE /challenge-inventory": admin.deleteInventory,
  "GET /promotions": admin.getPromotions,
  "POST /promotions": admin.savePromotion,
  "PUT /promotions": admin.savePromotion,
  "DELETE /promotions": admin.deletePromotion,
  "POST /promotions/send": admin.sendPromotion,
  "GET /newsletter": admin.listSubscribers,
  "POST /newsletter": admin.subscribeNewsletter,
  "GET /pixel-events": admin.listPixelEvents,
  "POST /pixel-events": admin.trackPixel,
  "GET /geo": admin.geo,
  "GET /news": admin.news,
  "POST /conversions": admin.conversions,
};

export async function handleApi(request: Request): Promise<Response> {
  const ctx = makeCtx(request);
  const path = ctx.url.pathname.replace(/^\/api/, "").replace(/\/+$/, "") || "/";
  const handler = routes[`${ctx.method} ${path}`];
  if (!handler) {
    const known = Object.keys(routes).some((k) => k.endsWith(` ${path}`));
    return json({ error: known ? "Method not allowed." : "Not found." }, known ? 405 : 404);
  }
  try {
    const result = await handler(ctx);
    if (result instanceof Response) {
      ctx.cookies.forEach((c) => result.headers.append("Set-Cookie", c));
      return result;
    }
    return json({ success: true, ...result }, 200, ctx.cookies);
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message, ...e.extra }, e.status, ctx.cookies);
    console.error(`[api] ${ctx.method} ${path}`, e);
    const message = e instanceof DbError ? `Database error: ${e.message}` : "Something went wrong. Please try again.";
    return json({ error: message }, 500, ctx.cookies);
  }
}
