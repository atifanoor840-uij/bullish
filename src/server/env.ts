/**
 * Server-only environment access. In development vite.config.ts copies
 * .env/.env.local into process.env; in production set them on the host.
 */
const read = (key: string) => (typeof process !== "undefined" ? process.env[key] : undefined)?.trim() || "";

export const env = {
  get supabaseUrl() {
    return read("SUPABASE_URL") || read("NEXT_PUBLIC_SUPABASE_URL");
  },
  get serviceKey() {
    return read("SUPABASE_SERVICE_ROLE_KEY");
  },
  /** Signs the session cookie. Falls back to a key derived from the service role key. */
  get sessionSecret() {
    return read("SESSION_SECRET") || `session:${read("SUPABASE_SERVICE_ROLE_KEY")}`;
  },
  get appUrl() {
    return read("NEXT_PUBLIC_APP_URL") || read("APP_URL");
  },
  get crmPasscode() {
    return read("CRM_ADMIN_PASSCODE");
  },
  get statisticsBase() {
    return read("STATISTICS_API_BASE_URL") || "https://www.showmytrades.com/api/statistics";
  },
  get paddle() {
    return {
      apiKey: read("PADDLE_API_KEY"),
      webhookSecret: read("PADDLE_WEBHOOK_SECRET"),
      sandbox: (read("PADDLE_ENVIRONMENT") || "sandbox") !== "production",
    };
  },
  get whop() {
    return {
      apiKey: read("WHOP_API_KEY"),
      appId: read("NEXT_PUBLIC_WHOP_APP_ID") || read("WHOP_APP_ID") || "app_7buyTjZWrgIEwl",
      productId: read("WHOP_PRODUCT_ID") || "prod_lZuuCJlAqAwo8",
      companyId: read("WHOP_COMPANY_ID") || read("WHOP_BIZ_ID") || "biz_D8AC4pUxTJ5rvh",
      webhookSecret: read("WHOP_WEBHOOK_SECRET"),
      checkoutUrl: read("WHOP_CHECKOUT_URL"),
      variantId: read("WHOP_VARIANT_ID") || read("WHOP_PLAN_ID") || "plan_EE7OocLy4ExcR",
    };
  },
  get didit() {
    return {
      apiKey: read("DIDIT_API_KEY"),
      workflowId: read("DIDIT_WORKFLOW_ID"),
      webhookSecret: read("DIDIT_WEBHOOK_SECRET"),
      callbackUrl: read("DIDIT_CALLBACK_URL"),
    };
  },
  get resend() {
    return { apiKey: read("RESEND_API_KEY"), from: read("EMAIL_FROM") || "Bullish 4ex <no-reply@bullish4ex.com>" };
  },
};
