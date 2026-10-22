-- ============================================================================
-- PROP FIRM BACKEND — COMPLETE SUPABASE SCHEMA (idempotent, safe to re-run)
-- ============================================================================
-- 24 tables:
--   users, email_verification_tokens, challenge_plans, pricing_plans,
--   challenge_inventory, kyc, orders, trading_accounts, payouts,
--   affiliates, referrals, collaborators, collaborator_attributions,
--   collaborator_sales, certificates, notifications, email_logs, audit_logs,
--   pixel_events, coupons, offers, offer_redemptions,
--   newsletter_subscribers, promotion_email_templates
-- ============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- users
create table if not exists public.users (
  id                text primary key,
  name              text not null,
  email             text not null unique,
  phone             text,
  country           text,
  "passwordHash"    text not null,                  -- sha256(password) hex, no salt
  role              text not null,                  -- trader | admin | support | affiliate | collaborator
  status            text not null,                  -- active | suspended | banned
  "emailVerified"   boolean not null default true,  -- new signups are inserted with false
  "emailVerifiedAt" timestamptz,
  "referredBy"      text references public.users(id) on delete set null,  -- affiliate userId
  "createdAt"       timestamptz default now()
);
alter table public.users enable row level security;

-- ------------------------------------------------ email_verification_tokens
create table if not exists public.email_verification_tokens (
  "tokenHash" text primary key,                     -- sha256 of the 64-hex token
  "userId"    text not null references public.users(id) on delete cascade,
  "expiresAt" timestamptz not null,                 -- 24h TTL
  "createdAt" timestamptz not null default now()
);
create index if not exists email_verification_tokens_user_id_idx on public.email_verification_tokens ("userId");
alter table public.email_verification_tokens enable row level security;

-- ------------------------------------------------------- challenge_plans
create table if not exists public.challenge_plans (
  id               text primary key,
  name             text not null,                   -- "One Step" | "Two Step" | "Instant"
  size             numeric not null,
  price            numeric not null,
  "profitTargetP1" numeric not null,
  "profitTargetP2" numeric not null,
  "maxDailyLoss"   numeric not null,
  "maxTotalLoss"   numeric not null,
  "profitSplit"    numeric not null,
  platform         text,
  login            text,
  password         text,
  server           text
);
alter table public.challenge_plans enable row level security;

-- --------------------------------------------------------- pricing_plans
create table if not exists public.pricing_plans (
  id          text primary key,
  model       text not null,                        -- One Step | Two Step | Instant
  size        numeric not null,
  price       numeric not null,
  status      text not null default 'active',       -- active | inactive
  "createdAt" timestamptz default now()
);
alter table public.pricing_plans enable row level security;

-- --------------------------------------------------- challenge_inventory
create table if not exists public.challenge_inventory (
  id                     text primary key,          -- "inv-<platform>-<login>"
  platform               text not null,             -- MT4 | MT5 | cTrader
  size                   numeric not null,
  login                  text not null,
  password               text not null,
  server                 text not null,
  "externalStatisticsId" text,                      -- ShowMyTrades statistics id
  "graphLink"            text,                      -- public myfxbook/fxblue URL
  status                 text not null default 'available',  -- available | delivered
  "orderId"              text,
  "createdAt"            timestamptz default now()
);
alter table public.challenge_inventory add column if not exists "graphLink" text;
create unique index if not exists challenge_inventory_unique_credentials
  on public.challenge_inventory (lower(btrim(platform)), lower(btrim(server)), lower(btrim(login)));
alter table public.challenge_inventory enable row level security;

-- ------------------------------------------------------------------- kyc
create table if not exists public.kyc (
  "userId"       text primary key references public.users(id) on delete cascade,
  "documentType" text not null,                     -- passport | national_id | drivers_license | didit
  "frontUrl"     text,
  "backUrl"      text,
  "selfieUrl"    text,
  "addressUrl"   text,
  status         text not null,                     -- pending | approved | rejected | needs_review
  "rejectReason" text,
  "updatedAt"    timestamptz default now()
);
alter table public.kyc enable row level security;

-- ---------------------------------------------------------------- orders
create table if not exists public.orders (
  id                       text primary key,        -- "o-1234" | "ord-retry-xxx" | BOGO free orders
  "userId"                 text references public.users(id) on delete cascade,
  "planId"                 text references public.challenge_plans(id) on delete set null,
  "couponUsed"             text,
  "amountPaid"             numeric not null,
  "referralBalanceApplied" numeric default 0,
  "weekendHoldingAddon"    boolean default false,   -- +20% add-on
  "legacyRules"            boolean default false,   -- admin pin to pre-2026-09 rulebook
  "paymentMethod"          text not null,           -- "Credit Card" | "Paddle ..." | "USDT (Crypto)" | "Crypto QR" | "CodaPay" | offer_bogo | free_retry
  status                   text not null,           -- Pending | Paid | Active | Step2 Active | Live Active | Passed | Failed | Replaced | Payment Failed
  "gatewayRef"             text,                    -- "stripe:<id>" | "paddle:<txn>:<platform>" | "nowpayments:<id>:<platform>" | "codapay:<txn>:<platform>:<country>" | "manual:<wallet>:<txid>:<path>" | "offer:<offerId>[:from:<orderId>]"
  "createdAt"              timestamptz default now(),
  "updatedAt"              timestamptz default now()
);
alter table public.orders add column if not exists "referralBalanceApplied" numeric default 0;
alter table public.orders add column if not exists "weekendHoldingAddon" boolean default false;
alter table public.orders add column if not exists "legacyRules" boolean default false;
alter table public.orders enable row level security;

-- ------------------------------------------------------ trading_accounts
create table if not exists public.trading_accounts (
  id                     text primary key,          -- 6-digit string, or inventory login
  "userId"               text references public.users(id) on delete cascade,
  "orderId"              text references public.orders(id) on delete set null,
  platform               text not null,
  login                  text not null,
  "passwordMaster"       text,
  "passwordInvestor"     text,
  server                 text not null,             -- placeholder until delivery: "Range4ex-PendingServer"
  "profitTarget"         numeric not null,          -- absolute $ target for the stage
  balance                numeric not null,
  equity                 numeric not null,
  "todayPl"              numeric not null,
  "totalPl"              numeric not null,
  status                 text not null,             -- Active | Passed | Failed | Funded
  phase                  text,                      -- "Phase 1 (Evaluation)" | "Phase 2 (Verification)" | "Funded (Live)"
  "graphLink"            text,
  "weekendHoldingAddon"  boolean default false,
  "externalStatisticsId" text,
  "statisticsPayload"    jsonb,                     -- cached ShowMyTrades payload (+ stored breach reasons)
  "statisticsUpdatedAt"  timestamptz,
  "deliveryStatus"       text not null,             -- pending | delivered
  "deliveredAt"          timestamptz,
  "createdAt"            timestamptz default now()
);
alter table public.trading_accounts add column if not exists "externalStatisticsId" text;
alter table public.trading_accounts add column if not exists "statisticsPayload" jsonb;
alter table public.trading_accounts add column if not exists "statisticsUpdatedAt" timestamptz;
alter table public.trading_accounts add column if not exists "weekendHoldingAddon" boolean default false;

create unique index if not exists trading_accounts_unique_delivered_credentials
  on public.trading_accounts (lower(btrim(platform)), lower(btrim(server)), lower(btrim(login)))
  where "deliveryStatus" = 'delivered'
    and btrim(login) <> ''
    and lower(btrim(login)) not like 'generated_%'
    and lower(btrim(server)) <> 'range4ex-pendingserver';
alter table public.trading_accounts enable row level security;

-- --------------------------------------------------------------- payouts
create table if not exists public.payouts (
  id                  text primary key,             -- "pay-1234"
  "accountId"         text references public.trading_accounts(id) on delete cascade,
  "userId"            text references public.users(id) on delete cascade,
  amount              numeric not null,             -- gross withdrawal
  "profitSplitAmount" numeric not null,             -- trader share
  "firmShareAmount"   numeric not null,
  "paymentMethod"     text not null,
  "paymentDetails"    text not null,                -- JSON string (wallet address / bank details)
  status              text not null,                -- pending | approved | processing | paid | rejected
  "approvedBy"        text references public.users(id) on delete set null,
  "approvedAt"        timestamptz,
  notes               text,
  "createdAt"         timestamptz default now()
);
alter table public.payouts enable row level security;

-- ------------------------------------------------ affiliates / referrals
create table if not exists public.affiliates (
  "userId"         text primary key references public.users(id) on delete cascade,
  "referralCode"   text not null unique,
  "commissionRate" numeric not null                 -- percent
);
alter table public.affiliates enable row level security;

create table if not exists public.referrals (
  "referredUserId"   text references public.users(id) on delete cascade,
  "affiliateId"      text references public.users(id) on delete cascade,
  "orderId"          text references public.orders(id) on delete cascade,
  "commissionAmount" numeric not null,
  status             text not null,                 -- pending | approved | paid
  "createdAt"        timestamptz default now(),
  primary key ("referredUserId", "orderId")
);
alter table public.referrals enable row level security;

-- ------------------------------------------------------- collaborators
create table if not exists public.collaborators (
  "userId"         text primary key references public.users(id) on delete cascade,
  "referralCode"   text not null unique,
  "commissionRate" numeric not null default 20 check ("commissionRate" = 20),
  "createdAt"      timestamptz not null default now()
);
create table if not exists public.collaborator_attributions (
  "referredUserId" text primary key references public.users(id) on delete cascade,
  "collaboratorId" text not null references public.collaborators("userId") on delete restrict,
  "createdAt"      timestamptz not null default now()
);
create table if not exists public.collaborator_sales (
  "referredUserId"   text not null references public.users(id) on delete restrict,
  "collaboratorId"   text not null references public.collaborators("userId") on delete restrict,
  "orderId"          text not null references public.orders(id) on delete restrict,
  "saleAmount"       numeric not null check ("saleAmount" >= 0),
  "commissionAmount" numeric not null check ("commissionAmount" >= 0),
  status             text not null default 'pending' check (status in ('pending','approved','paid')),
  "createdAt"        timestamptz not null default now(),
  primary key ("referredUserId", "orderId")
);
alter table public.collaborators enable row level security;
alter table public.collaborator_attributions enable row level security;
alter table public.collaborator_sales enable row level security;

-- ---------------------------------------------------------- certificates
create table if not exists public.certificates (
  id            text primary key,
  "userId"      text references public.users(id) on delete cascade,
  "accountId"   text references public.trading_accounts(id) on delete cascade,
  "traderName"  text not null,
  "accountSize" numeric not null,                   -- for payout certs this is the payout amount
  "planName"    text not null,
  "datePassed"  timestamptz not null
);
alter table public.certificates enable row level security;

-- --------------------------------------------------------- notifications
create table if not exists public.notifications (
  id        text primary key,
  "userId"  text references public.users(id) on delete cascade,
  title     text not null,
  message   text not null,
  type      text not null,                          -- info | success | warning | error
  channel   text not null,                          -- in_app | email
  status    text not null,                          -- sent | failed
  read      boolean default false,
  "sentAt"  timestamptz default now()
);
alter table public.notifications enable row level security;

-- ------------------------------------------------------------ email_logs
create table if not exists public.email_logs (
  id         text primary key,
  "userId"   text references public.users(id) on delete cascade,
  "toEmail"  text not null,
  subject    text not null,
  content    text not null,
  status     text not null,                         -- sent | failed
  provider   text not null,
  error      text,
  "sentAt"   timestamptz default now()
);
alter table public.email_logs enable row level security;

-- ------------------------------------------------------------ audit_logs
create table if not exists public.audit_logs (
  id            text primary key,
  "userId"      text references public.users(id) on delete cascade,   -- actor
  "userName"    text not null,
  "targetId"    text not null,
  "targetType"  text not null,                      -- order | account | user
  action        text not null,                      -- order_status_update, account_delivery, user_impersonate, ...
  description   text not null,
  "createdAt"   timestamptz default now()
);
alter table public.audit_logs enable row level security;

-- ---------------------------------------------------------- pixel_events
create table if not exists public.pixel_events (
  id               text primary key,
  "eventName"      text not null,
  "eventId"        text,
  source           text not null default 'capi',    -- capi | pixel
  status           text not null default 'sent',    -- sent | failed
  "pixelId"        text,
  "orderId"        text,
  "userId"         text,
  "userEmail"      text,
  value            numeric,
  currency         text,
  "contentName"    text,
  "contentIds"     text,
  "eventSourceUrl" text,
  error            text,
  "createdAt"      timestamptz default now()
);
create index if not exists pixel_events_created_at_idx on public.pixel_events ("createdAt" desc);
create index if not exists pixel_events_order_id_idx on public.pixel_events ("orderId");
alter table public.pixel_events enable row level security;

-- --------------------------------------------------------------- coupons
create table if not exists public.coupons (
  code              text primary key,               -- stored UPPERCASE
  "discountPercent" numeric not null,
  status            text not null default 'active', -- active | inactive
  "expiresAt"       timestamptz,
  "createdAt"       timestamptz default now()
);
alter table public.coupons add column if not exists "expiresAt" timestamptz;
alter table public.coupons add column if not exists "createdAt" timestamptz default now();
alter table public.coupons enable row level security;

-- ---------------------------------------------------------------- offers
create table if not exists public.offers (
  id               text primary key,
  name             text not null,
  type             text not null default 'bogo',
  code             text,
  description      text,
  status           text not null default 'active',  -- active | paused
  "startsAt"       timestamptz,
  "expiresAt"      timestamptz,
  "accountSizes"   jsonb not null default '[]'::jsonb,
  "models"         jsonb not null default '[]'::jsonb,
  "userIds"        jsonb not null default '[]'::jsonb,
  "accountIds"     jsonb not null default '[]'::jsonb,
  "buyQuantity"    numeric not null default 1,
  "freeQuantity"   numeric not null default 1,
  "retryLimit"     numeric not null default 0,
  "maxRedemptions" numeric not null default 0,      -- 0 = unlimited
  "redeemedCount"  numeric not null default 0,
  "createdAt"      timestamptz default now(),
  "updatedAt"      timestamptz default now()
);
create index if not exists offers_status_idx on public.offers (status);
create unique index if not exists offers_code_unique_idx on public.offers (upper(code)) where code is not null and code <> '';
alter table public.offers enable row level security;

create table if not exists public.offer_redemptions (
  id                text primary key,
  "offerId"         text not null,
  "userId"          text not null,
  type              text not null default 'free_retry',
  "sourceAccountId" text,
  "newAccountId"    text,
  "orderId"         text,
  status            text not null default 'granted', -- granted | revoked
  "createdAt"       timestamptz default now()
);
create index if not exists offer_redemptions_offer_idx on public.offer_redemptions ("offerId");
create index if not exists offer_redemptions_user_idx on public.offer_redemptions ("userId");
create index if not exists offer_redemptions_source_account_idx on public.offer_redemptions ("sourceAccountId");
alter table public.offer_redemptions enable row level security;

-- ------------------------------------------------- newsletter_subscribers
create table if not exists public.newsletter_subscribers (
  id                   bigint generated always as identity primary key,
  email                text not null,
  source               text not null default 'website',
  status               text not null default 'active',
  "emailStatus"        text not null default 'pending',
  "confirmationSentAt" timestamptz,
  "createdAt"          timestamptz not null default now(),
  "updatedAt"          timestamptz not null default now(),
  constraint newsletter_subscribers_source_check check (source in ('footer','home','website')),
  constraint newsletter_subscribers_status_check check (status in ('active','unsubscribed')),
  constraint newsletter_subscribers_email_status_check check ("emailStatus" in ('pending','sent','failed')),
  constraint newsletter_subscribers_email_length_check check (char_length(email) between 3 and 320)
);
create unique index if not exists newsletter_subscribers_email_lower_uidx on public.newsletter_subscribers (lower(email));
create index if not exists newsletter_subscribers_created_at_idx on public.newsletter_subscribers ("createdAt" desc);
alter table public.newsletter_subscribers enable row level security;
alter table public.newsletter_subscribers force row level security;
revoke all on public.newsletter_subscribers from anon, authenticated;
grant select, insert, update on public.newsletter_subscribers to service_role;
grant usage, select on sequence public.newsletter_subscribers_id_seq to service_role;

-- --------------------------------------------- promotion_email_templates
create table if not exists public.promotion_email_templates (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  subject     text not null,
  html        text not null,
  "createdBy" text not null references public.users(id) on delete restrict,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  constraint promotion_email_templates_name_length_check check (char_length(name) between 1 and 100),
  constraint promotion_email_templates_subject_length_check check (char_length(subject) between 1 and 200),
  constraint promotion_email_templates_html_length_check check (char_length(html) between 1 and 200000)
);
create unique index if not exists promotion_email_templates_name_lower_uidx on public.promotion_email_templates (lower(name));
create index if not exists promotion_email_templates_updated_at_idx on public.promotion_email_templates ("updatedAt" desc);
alter table public.promotion_email_templates enable row level security;
alter table public.promotion_email_templates force row level security;
revoke all on public.promotion_email_templates from anon, authenticated;
grant select, insert, update, delete on public.promotion_email_templates to service_role;

-- ------------------------------------------------ public read-only policies
drop policy if exists "Allow public read of coupons" on public.coupons;
create policy "Allow public read of coupons" on public.coupons for select to anon, authenticated using (true);
drop policy if exists "Allow public read of offers" on public.offers;
create policy "Allow public read of offers" on public.offers for select to anon, authenticated using (true);
drop policy if exists "Allow public read of pricing_plans" on public.pricing_plans;
create policy "Allow public read of pricing_plans" on public.pricing_plans for select to anon, authenticated using (true);

-- ------------------------------------------------ seed sample pricing catalog
insert into public.pricing_plans (id, model, size, price, status) values
  ('pp-one-step-10k',  'One Step', 10000,  99,  'active'),
  ('pp-two-step-50k',  'Two Step', 50000,  299, 'active'),
  ('pp-two-step-100k', 'Two Step', 100000, 499, 'active'),
  ('pp-instant-50k',   'Instant',  50000,  749, 'active')
on conflict (id) do update set price = excluded.price, status = excluded.status;
