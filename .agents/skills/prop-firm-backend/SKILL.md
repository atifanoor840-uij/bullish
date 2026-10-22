---
name: prop-firm-backend
description: Complete prop-firm backend (trader dashboard + admin CRM + collaborator portal) built on Supabase + Next.js API routes — 44 endpoints, full schema, auth/session model, order→account→payout lifecycle, payments (Stripe/Paddle/NOWPayments/CodaPay/manual crypto), KYC (Didit), affiliates, offers, coupons, emails. Use this whenever the user wants to set up, connect, port, clone, rebrand or debug this backend for ANY prop firm / funded-trader frontend — e.g. "new prop firm ka backend connect karo", "ye Supabase credentials hain, sab connect kar do", "dashboard/admin panel ke endpoints kya hain", "naya frontend is backend se jodo", "schema bana do", or any question about how orders, accounts, phases, payouts, KYC, referrals or the CRM work.
---

# Prop Firm Backend — Supabase + Next.js API

> **Ek hi file mein sab kuch:** Part 1 Overview & Workflow · Part 2 API Endpoints · Part 3 Business Logic · Part 4 Frontend Integration · Part 5 Database Schema (SQL) · Part 6 Typed API client (`propApi.ts`).

---

# PART 1 — Overview & Setup Workflow

Yeh skill ek **ready-made prop firm backend** describe karti hai jo pehle se ek live website (range4ex) par chal raha hai. Iska goal simple hai:

> **User sirf Supabase credentials dega → tum schema lagao, backend files copy karo, env set karo, admin seed karo, frontend ke har button ko sahi endpoint se jodo.**

Reply hamesha **Roman Urdu + English technical terms** mein karo (user ki preference).

## Reference implementation (source of truth)

Canonical code yahan hai — jab bhi doubt ho, yahan se exact code padho / copy karo:

```
D:\Lunar Studio\New Firm\frontend\Nextjs-landing-page-template-2\
  src/app/api/**          → 44 API endpoints (Next.js Route Handlers)
  src/lib/*.ts            → business logic + Supabase data layer (db.ts)
  src/config/*.ts         → payments / manual wallets / didit config
  src/lib/*.sql           → original schema + migrations
```

Agar yeh folder available na ho to is file ke Parts 2–6 itni detailed hain ke backend unse dobara banaya ja sake.

## Is file ke parts — kab kya padhna hai

| Part | Kab padho |
|---|---|
| **Part 5 — Database Schema (SQL)** | Naye Supabase project par schema lagate waqt. Ek hi idempotent file, saari tables + indexes + RLS. |
| **Part 2 — API Endpoints** | Kisi bhi endpoint ka request body / response / auth / side-effects chahiye. Frontend wiring ke liye yahi main contract hai. |
| **Part 3 — Business Logic** | Order lifecycle, phases, pricing formula, payout rules, trading rules, referral/collaborator commission, offers, KYC flow. |
| **Part 4 — Frontend Integration** | Naye frontend (Next.js ya koi aur) ko connect karna; dashboard tab → endpoint mapping; typed API client. |
| **Part 6 — propApi.ts client** | Drop-in typed fetch client jo har endpoint wrap karta hai — naye frontend mein copy karo. |

## Architecture — 60-second version

```
Browser (any frontend)
   │  fetch("/api/...", { credentials: "include" })   ← cookie `prop_session`
   ▼
Next.js Route Handlers  (src/app/api/**/route.ts)
   │  getSessionUser() → cookie se userId → users table se role check
   ▼
src/lib/db.ts  ──►  Supabase (service-role key, server-only, RLS bypass)
                     + Storage bucket `payment-proofs` (private)
External: Stripe · Paddle · NOWPayments · CodaPay · Didit KYC · SMTP (Hostinger) · ShowMyTrades stats API · Meta CAPI
```

Key facts jo har kaam mein yaad rakhne hain:

1. **Supabase Auth use NAHI hota.** Users `public.users` table mein hain, password = `sha256(password)` hex (no salt). Login ke baad server `prop_session` httpOnly cookie set karta hai jiski value **user id** hai (7 din).
2. **Browser kabhi Supabase se direct baat nahi karta.** Saara data `/api/*` se jaata hai; server `SUPABASE_SERVICE_ROLE_KEY` use karta hai. RLS sab tables par ON hai with (almost) no policies — anon key se kuch nahi dikhta, aur yehi sahi hai.
3. **Roles:** `trader` · `admin` · `support` · `affiliate` · `collaborator`. Ek hi endpoint role ke hisaab se alag data deta hai (admin ko sab + joined names, trader ko sirf apna).
4. **Admin CRM = same users table** with `role='admin'` (ya `support`). CRM login `/api/auth/crm/signin`.
5. Response shape har jagah: success → `{ success: true, ...data }`, error → `{ error: "message" }` + HTTP status (400/401/403/404/409/500/503).

## Workflow: "Yeh Supabase credentials hain, sab connect kar do"

Is order mein kaam karo. Har step ke baad verify karo, assume mat karo.

### Step 1 — Credentials lo aur env set karo
User se yeh 3 cheezein chahiye (Supabase Dashboard → Project Settings → API):
```
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service_role key>   # server-only, kabhi client bundle mein nahi
```
`.env.local` mein likhne se pehle dekho ke existing `.env.local` kisi **doosre live project** ko point to nahi kar raha — agar kar raha ho to user se confirm karo. Baaki env vars ki full list **Part 4 — Frontend Integration** → "Environment variables" mein hai; sirf wahi maango jo firm actually use karegi (payments, SMTP, KYC optional hain — un ke bina endpoints 503 ya simulation mode dete hain).

### Step 2 — Schema lagao
**Part 5 — Database Schema (SQL)** ko Supabase SQL Editor mein run karo (ya `psql`). File idempotent hai — dobara chalana safe hai. Phir verify:
```sql
select table_name from information_schema.tables where table_schema='public' order by 1;
-- 24 tables expected (list SQL file ke top par hai)
```
Storage bucket `payment-proofs` pehli manual-crypto payment par khud ban jaata hai; chaho to pehle se private bucket bana do.

### Step 3 — Backend code target frontend mein lao
- **Target Next.js (App Router) hai** → reference repo se copy karo: `src/app/api/**`, `src/lib/` ki backend files (list **Part 4 — Frontend Integration** mein), `src/config/{payments,manualWallets,didit}.ts`. Deps: `npm i @supabase/supabase-js nodemailer zod` (+ `@types/nodemailer`). `tsconfig` mein `"@/*": ["./src/*"]` alias hona chahiye.
- **Target Next.js nahi hai** (Vite/React, Vue, plain HTML, mobile) → backend ko alag Next.js app ki tarah deploy karo aur frontend ko same-domain reverse proxy (`/api/*` → backend) se jodo, taake cookie first-party rahe. Cross-origin cookie ke liye details **Part 4 — Frontend Integration** mein.

### Step 4 — Rebrand (hard-coded "Range4ex" hatao)
Yeh strings code mein hard-coded hain — naye firm ke naam/domain se replace karo:
- `src/lib/emailVerification.ts` → `getVerificationUrl` mein `https://www.range4ex.com` (naye domain ya `NEXT_PUBLIC_APP_URL` use karo).
- `src/config/payments.ts` → `nowPayments.ipnCallbackUrl` = `https://range4ex.com/api/orders/pay/nowpayments-ipn`.
- `src/config/manualWallets.ts` → fallback wallet addresses (range4ex ke wallets hain!) — naye firm ke `NEXT_PUBLIC_WALLET_*` env set karo ya fallback hatao.
- Placeholder server naam `"Range4ex-PendingServer"` (orders, accounts, fulfillment, offers, request-next routes + `account_credential_uniqueness_migration` index). Agar badlo to **SQL unique index ki condition bhi saath badlo.**
- Notification/email titles: "Welcome to Range4ex", "New login to your Range4ex account", "Verify your Range4ex email address", newsletter texts, `emailTemplates.ts` branding, `supabaseClient.ts` fallback URL.
- `grep -rni "range4ex" src/app/api src/lib src/config` chala ke sab pakdo.

### Step 5 — Pehla admin seed karo
Fresh DB mein koi admin nahi hota → CRM login "Access Denied" dega. User se admin email + password maango (khud production credentials invent mat karo), phir:
```sql
create extension if not exists pgcrypto;
insert into public.users (id, name, email, phone, country, "passwordHash", role, status, "emailVerified")
values ('u-admin-' || substr(gen_random_uuid()::text,1,8), 'Admin', lower('<admin-email>'), '', '',
        encode(digest('<password>', 'sha256'), 'hex'), 'admin', 'active', true);
```
Alternative: `/api/auth/crm/signup` with `passcode = CRM_ADMIN_PASSCODE` (env). **Default passcode `ADMIN123` hai — production mein env zaroor set karo.**

### Step 6 — Catalog seed karo (warna Buy page khaali)
Orders sirf `pricing_plans` ke **active** rows par bante hain. Admin login karke `POST /api/pricing-plans` se plans banao (`model` = `One Step` | `Two Step` | `Instant`, `size`, `price`), ya SQL insert karo (example SQL file ke end par). Coupons `POST /api/coupons`.

### Step 7 — Frontend wiring
**Part 6 — propApi.ts client** copy karo aur har screen ko **Part 4 — Frontend Integration** ki "Screen → endpoint map" ke hisaab se jodo. Har `fetch` mein `credentials: "include"` aur `401` par sign-in redirect.
Do cheezein jo aksar miss hoti hain:
- Live site ke payment methods exactly `"Paddle"` (card) aur `"Crypto QR"` (manual wallet, auto +5% discount) hain — string server par gateway decide karti hai.
- Signup page ko URL se `?ref=` → `referralCode` aur `?collab=` → `collaboratorCode` khud padh kar bhejna hai (reference frontend yeh nahi karta, isliye referral/collaborator attribution tab tak record nahi hoti).

### Step 8 — End-to-end verify (sab karo, skip mat karo)
1. Trader signup → verification email link → auto-login → `/api/auth/me` 200.
2. Buy page: `/api/pricing-plans` plans dikhaye; `POST /api/orders` → order `Pending`.
3. Admin CRM login → `/api/orders` mein woh order dikhe → `PUT /api/orders {status:"Active"}` → trader ko pending Phase-1 account mile → admin `PUT /api/accounts` se credentials deliver kare → trader dashboard mein account `delivered`.
4. Doosra test trader banao aur confirm karo ke pehle trader ka data usko **nahi** dikhta.
5. Payment gateway jo use ho raha hai uska sandbox/test flow (webhook URL gateway dashboard mein set).

## Known security gaps (naye firm ko batana zaroori)

Backend jaisa hai waisa kaam karta hai, lekin yeh gaps real hain — production launch se pehle user ko batao aur fix offer karo:

1. **Session cookie unsigned hai** — `prop_session` ki value raw user id hai. Koi bhi cookie mein kisi aur (admin ka) id daal de to wohi ban jaata hai. Fix: signed/encrypted session (e.g. `iron-session`, JWT with secret) ya random session token table.
2. **`PUT /api/auth/me` role escalation** — trader body mein `role: "admin"` bhej kar khud ko admin bana sakta hai (testing convenience code). Fix: is endpoint se `role`/`status` update hata do.
3. **Password hashing** unsalted SHA-256 hai. Fix: bcrypt/argon2 (migration: login par re-hash).
4. **`CRM_ADMIN_PASSCODE` default `ADMIN123`** — env set na ho to koi bhi admin account bana sakta hai.
5. `POST /api/notifications` koi bhi logged-in user apne liye email notification bana sakta hai (SMTP spam risk) — low severity.
6. Order/payout ids `Math.random()` 4-digit hain (`o-1234`, `pay-1234`) → collisions possible at scale; upsert overwrite kar dega. Fix: uuid.

Yeh fixes user ki permission ke baghair mat karo — pehle batao, phir poochho.

## Common failure → cause (debug cheat-sheet)

| Symptom | Asal wajah |
|---|---|
| Har API 500, log mein "SUPABASE_SERVICE_ROLE_KEY is not defined" | `.env.local` missing / server restart nahi hua |
| CRM login "Access Denied" | `users` mein `role='admin'` + `status='active'` row nahi |
| Buy page khaali / "not available in the admin pricing catalog" | `pricing_plans` mein active row nahi |
| `PGRST205` / "schema cache" / "table does not exist" | schema SQL poora nahi chala — dobara run karo |
| `23505` on account deliver | same platform+server+login pehle se kisi delivered account par hai (intentional uniqueness) |
| Order create 409 `PRICE_CHANGED` | frontend ka `expectedAmount` server total se match nahi (coupon/price badla) |
| Payout 403 | KYC `approved` nahi |
| KYC 403 | user ke paas koi delivered Funded/Instant account nahi |
| Payment 503 | us gateway ki env keys set nahi (Stripe sirf `sk_live_` accept karta hai) |
| Email nahi jaati | `HOSTINGER_SMTP_*` env; har attempt `email_logs` mein status ke saath log hota hai |

---

# PART 2 — API Endpoints

**Base:** same origin as the frontend, path `/api/...`. JSON in/out unless noted.
**Auth:** httpOnly cookie `prop_session=<userId>` (7 days). Frontend must send `credentials: "include"`.
**Auth levels used below:**
- `public` — no cookie needed
- `user` — any logged-in user (401 if no cookie)
- `admin` — `role === "admin"` (403 otherwise)
- `admin|support` — either role
- `collaborator` — `role === "collaborator"`
- `webhook` — called by a payment/KYC provider, verified by signature

**Response convention:** success `{ success: true, ... }`; failure `{ error: string }` + status.
Password hashes are always stripped from user objects in responses.

---

### Contents
1. Auth (trader, CRM, collaborator)
2. Catalog: pricing-plans, plans, coupons, offers
3. Orders & payments (+ webhooks)
4. Trading accounts
5. Payouts
6. KYC (+ Didit webhook)
7. Affiliate / referrals / collaborators
8. Notifications, certificates, logs
9. Admin: users, challenge inventory, promotions, newsletter, pixel events
10. Utility: geo, news, conversions

---

### 1. Auth

#### POST `/api/auth/signup` — public
Body: `{ name*, email*, password*, phone?, country?, referralCode?, collaboratorCode?, locale? ("en"|"ar"|"el"|"es") }`
- Email lowercased; duplicate → 400.
- `referralCode` must match an `affiliates.referralCode` → sets `users.referredBy` (400 if invalid).
- `collaboratorCode` must match `collaborators.referralCode` → inserts `collaborator_attributions` (400 if invalid).
- Creates user `role:"trader", status:"active", emailVerified:false`, id `u-<9 chars>`.
- Auto-creates `affiliates` row (code = first 7 chars of name uppercased + 3 digits, rate 10%).
- Creates verification token (24h) and emails link `/api/auth/verify-email?token=..&locale=..&email=..`.
- **Does NOT log the user in.**
Response: `{ success, user, emailSent: boolean, verificationPage: "/<locale>/auth/verify-email?email=..[&status=email-failed]" }`

#### GET `/api/auth/verify-email?token=&locale=&email=` — public (link in email)
Consumes token (one-time). On success sets `prop_session` cookie and **redirects** to `/<locale>/auth/verify-email?status=success|invalid|expired|error&email=..`.

#### POST `/api/auth/resend-verification` — public
Body: `{ email*, locale? }` → always `{ success:true }` for unknown/already-verified emails (no enumeration). 503 if SMTP failed.

#### POST `/api/auth/signin` — public (trader login)
Body: `{ email*, password* }`
- 400 invalid creds; 403 if `role==="collaborator"` (must use collaborator portal) or `status!=="active"`.
- Unverified email does NOT block login.
- Sets cookie; sends "new login" email notification with IP + user agent.
Response: `{ success, user, emailVerified: boolean }`

#### POST `/api/auth/signout` — any
Deletes cookie → `{ success:true }`.

#### GET `/api/auth/me` — user
→ `{ success, user }`. 401 (and cookie cleared) if the id no longer exists. **Use this on every dashboard load to know who is logged in + role.**

#### PUT `/api/auth/me` — user (profile update)
Body: `{ name?, phone?, country?, role?, status? }` → `{ success, user }`.
⚠️ Current code lets a user set `role` to `admin|trader|affiliate` (testing leftover) — see Part 1 → Known security gaps. Frontend should only send name/phone/country.

#### POST `/api/auth/crm/signin` — public (admin CRM login)
Body `{ email*, password* }`. 403 unless `role` is `admin` or `support` and `status==="active"`. Sets cookie. → `{ success, user }`

#### POST `/api/auth/crm/signup` — public, passcode-gated
Body `{ name*, email*, password*, passcode* }`; `passcode` must equal env `CRM_ADMIN_PASSCODE` (default `"ADMIN123"`!). Creates `role:"admin"` user id `u-admin-xxx`, sets cookie. → `{ success, user }`

#### POST `/api/auth/crm/impersonate` — admin|support
Body `{ userId* }` → switches the **caller's** cookie to the target user (login-as) and writes audit log `user_impersonate`. → `{ success, user }`. To return, the admin must sign in again.

#### POST `/api/auth/collaborator/signin` — public
Body `{ email*, password* }`; requires `role==="collaborator"`, active, and a `collaborators` row. Sets cookie (sameSite lax). → `{ success:true }`

---

### 2. Catalog

#### GET `/api/pricing-plans` — public (Buy page / landing pricing)
→ `{ success, plans: [{ id, model: "One Step"|"Two Step"|"Instant", size, price, status, createdAt }] }` (60s server cache). Frontend should show only `status==="active"`.

#### POST `/api/pricing-plans` — admin (create/update)
Body `{ model* (One Step|Two Step|Instant), size*, price*, status? }`. Id is derived `pp-<model-slug>-<size>k` so re-posting same model+size **updates** it. → `{ success, plan }`

#### DELETE `/api/pricing-plans?id=` — admin → `{ success }`

#### GET `/api/plans` — public
Legacy `challenge_plans` list → `{ success, plans }` (has rule numbers: profitTargetP1/P2, maxDailyLoss, maxTotalLoss, profitSplit).
#### POST `/api/plans` — admin. Body `{ name*, size*, price*, profitTargetP1?, profitTargetP2?, maxDailyLoss?(5), maxTotalLoss?(10), profitSplit?(80), platform?, login?, password?, server? }` → id `plan-<name>-<size>k`.
#### PUT `/api/plans` — admin. Body `{ id*, ...fields }`.
#### DELETE `/api/plans?id=` — admin.

#### GET `/api/coupons` — public
→ `{ success, coupons: [{ code, discountPercent, status: "active"|"inactive"|"expired", expiresAt?, isExpired, createdAt }] }` (30s cache).
#### POST `/api/coupons` — admin (create/update). Body `{ code*, discountPercent*, status?, expiresAt? (ISO) }` → code uppercased.
#### DELETE `/api/coupons?code=` — admin.

#### GET `/api/offers` — public
→ `{ success, offers: DBOffer[] }` each with derived `isExpired`, `isScheduled`. Shape:
`{ id, name, type: "bogo"|"free_retry", description, status: "active"|"paused", startsAt?, expiresAt?, accountSizes: number[], models: string[], userIds: string[], accountIds: string[], buyQuantity, freeQuantity, retryLimit, maxRedemptions, redeemedCount }`
#### POST `/api/offers` — admin (create, or update if `id` given)
Body: `{ id?, name*, type, description?, status?, startsAt?, expiresAt?, accountSizes?, models?, userIds?, accountIds?, buyQuantity?, freeQuantity? (bogo ≥1), retryLimit? (free_retry ≥1), maxRedemptions? }`
#### PATCH `/api/offers` — admin. Body `{ id*, status: "active"|"paused" }` (pause/resume).
#### DELETE `/api/offers?id=` — admin.

#### GET `/api/offers/accounts` — user
Offer badges per account + live offers the trader is in scope for.
→ `{ success, tags: { [accountId]: [{ offerId, offerName, offerType, kind: "active"|"granted"|"applied", label, detail }] }, offers: [{ id, name, type, description, summary, startsAt, expiresAt, accountSizes, models, targeted, accounts: [{ accountId, login, platform, kind }] }] }`

#### GET `/api/offers/retry` — user
Failed accounts that can claim a free retry → `{ success, eligibility: [{ accountId, accountSize, planName, claimedCount, newAccountId, offer: { id, name, retriesRemaining } | null }] }`
#### POST `/api/offers/retry` — user (owner) or admin
Body `{ accountId* }` (must be `Failed`). Creates $0 order (`paymentMethod:"free_retry"`, status `Active`, `gatewayRef:"offer:<id>"`) + new Phase-1 account `deliveryStatus:"pending"` + `offer_redemptions` row; increments `redeemedCount`.
→ `{ success, account, order, offer:{id,name}, retriesRemaining }`

---

### 3. Orders & payments

#### GET `/api/orders` — user
- admin → all orders + `userName`, `userEmail`, `planName` ("Two Step $100K").
- others → own orders + `planName`.
→ `{ success, orders: DBOrder[] }`
`DBOrder = { id, userId, planId, couponUsed, amountPaid, referralBalanceApplied, weekendHoldingAddon, legacyRules, paymentMethod, status, gatewayRef, createdAt, updatedAt }`

#### POST `/api/orders` — user (create checkout order)
Body: `{ planId* (pricing_plans.id), paymentMethod, couponUsed?, useReferralBalance?: boolean, weekendHoldingAddon?: boolean, expectedAmount?: number }`
Server pricing (see Part 3 — Business Logic): catalog price → +20% weekend add-on → coupon % (or affiliate code 10%) → +5% extra if paymentMethod contains "crypto" → `Math.ceil` → minus referral balance.
- 404 plan missing; 400 plan not active in catalog; 403 Paddle from Pakistan.
- **409 `{ error, code:"PRICE_CHANGED", amount }`** if `expectedAmount` ≠ server total (±0.01). Show new amount & ask to retry.
- Creates order `status:"Pending"`, id `o-NNNN`; saves pending affiliate referral if an affiliate code was used; fires Meta CAPI Purchase; 2 notifications.
→ `{ success, order }` → then call `/api/orders/pay` (or manual-payment for "Crypto QR").

#### PUT `/api/orders` — admin (status change = drives the whole lifecycle)
Body A (status): `{ orderId*, status* }`
- `"Active"` / `"paid"` → creates Phase-1 account (pending delivery) if none, grants BOGO offers, records collaborator sale, settles referral commissions, notifies.
- `"Step2 Active"` → creates Phase-2 account (400 for One Step/Instant plans).
- `"Live Active"` → creates Funded account.
- `"Failed"` → latest account of the order → `Failed`.
- `"Passed"` → latest account → `Passed` and auto-creates next stage account + moves order status.
- `"Replaced"` → latest account reset to `Active`, P/L zeroed.
Body B (rulebook pin): `{ orderId*, legacyRules: boolean }` (no status) → toggles legacy rules.
Audit log written. → `{ success, order }`

#### DELETE `/api/orders?id=` — admin
Deletes order + all its trading accounts, releases their inventory credentials back to `available`. → `{ success, removedAccounts }`

#### POST `/api/orders/pay` — user (owner, order must be `Pending`)
Body `{ orderId*, platform? ("MT5"|"MT4"|"cTrader"), locale? }`. Picks gateway from `order.paymentMethod` (case-insensitive substring):
| paymentMethod contains | Gateway | Needs env |
|---|---|---|
| `codapay` | CodaPay hosted page | CODAPAY_API_KEY, CODAPAY_PROJECT_ID |
| `crypto` | NOWPayments invoice | NOWPAYMENTS_API_KEY |
| `paddle` | Paddle checkout (blocked for Pakistan) | PADDLE_API_KEY, PADDLE_WEBHOOK_SECRET |
| anything else | Stripe Checkout | STRIPE_SECRET_KEY (must start `sk_live_`) |
| `Crypto QR` (manual) | → 400, use manual-payment | — |
→ `{ success, provider, checkoutUrl, gatewayRef }` → **frontend: `window.location = checkoutUrl`**. 503 if gateway not configured.

#### POST `/api/orders/manual-payment` — user (owner) — **multipart/form-data**
Fields: `orderId`, `walletId` (`USDT_BEP20|USDT_TRC20|USDT_POLYGON|USDT_ERC20|BTC|SOL`), `txid`, `screenshot` (PNG/JPG/WEBP ≤5MB).
Validates TXID format per chain, rejects reused TXID (409), uploads to private bucket `payment-proofs/<orderId>/<ts>.<ext>`, sets `gatewayRef="manual:<wallet>:<txid>:<path>"`. Order stays `Pending` until admin sets `Active`. → `{ success, order }`
#### GET `/api/orders/manual-payment?orderId=` — admin
→ `{ success, url (signed, 10 min), walletId, txid, proofPath }` to view the screenshot.

#### Payment webhooks / returns (configure these URLs in each provider dashboard)
All call `fulfillPaidOrder()` → order `Paid`, reserves inventory credential (instant delivery) or creates pending account, BOGO, collaborator sale, referrals, emails. Idempotent (skips if Phase-1 account exists or order not Pending).
| Route | Method | Verification |
|---|---|---|
| `/api/orders/pay/stripe-webhook` | POST | `stripe-signature` + STRIPE_WEBHOOK_SECRET; events `checkout.session.completed`, `checkout.session.async_payment_succeeded` |
| `/api/orders/pay/stripe-return?session_id=&locale=&platform=` | GET | Stripe success_url; re-fetches session, then redirects to `/<locale>/dashboard?payment=success&orderId=` |
| `/api/orders/pay/paddle-webhook` | POST | `paddle-signature` + PADDLE_WEBHOOK_SECRET; `transaction.completed`; `custom_data.{orderId,userId,platform}` |
| `/api/orders/pay/nowpayments-ipn` | POST | `x-nowpayments-sig` + NOWPAYMENTS_IPN_SECRET; `finished` → fulfil; `failed/refunded/expired` → order `Payment Failed` |
| `/api/orders/pay/codapay-notify?OrderId=&TxnId=` | GET/POST | re-queries CodaPay API; responds `ResultCode=0` text |

---

### 4. Trading accounts

#### GET `/api/accounts` — user
- admin → all accounts + `userName`, `userEmail`; others → own accounts.
- Side effects: refreshes stale ShowMyTrades statistics (30 min cache) and runs the **rule-compliance engine** which can auto-fail accounts (drawdown, holding time, layering, etc.) and returns rule evaluations.
→ `{ success, accounts: DBTradingAccount[] }` (plus computed compliance fields from `applyAccountRuleCompliance`).
`DBTradingAccount = { id, userId, orderId, platform, login, passwordMaster, passwordInvestor, server, profitTarget, balance, equity, todayPl, totalPl, status: "Active"|"Passed"|"Failed"|"Funded", phase, graphLink, weekendHoldingAddon, externalStatisticsId, statisticsPayload, statisticsUpdatedAt, deliveryStatus: "pending"|"delivered", deliveredAt, createdAt }`
UI rule: while `deliveryStatus==="pending"` show "credentials being prepared", hide login/passwords.

#### PUT `/api/accounts` — admin (deliver credentials / edit / change status)
Body: `{ id*, platform*, login*, passwordMaster*, server*, passwordInvestor?, profitTarget?, graphLink?, balance?, equity?, status?, phase?, externalStatisticsId? | statisticsApiId?, inventoryItemId?, orderId?, userId?, simulateObjectivePassed? }`
- Account doesn't exist → creates it delivered (and moves a `Pending` order to `Active`).
- Pending → sets `deliveryStatus:"delivered"` + emails credentials.
- `inventoryItemId` → marks that inventory row delivered (must be available & match credentials).
- 409 if the same platform/server/login is already on another delivered account.
- `status:"Failed"` → order also `Failed` + stored breach reason; `Failed→Active` restores order status; `status:"Passed"` → next stage account auto-created.
→ `{ success, account }`

#### DELETE `/api/accounts?id=` — admin
Releases inventory credential, deletes, rolls order status back to newest remaining stage (or `Pending`), notifies trader. → `{ success }`

#### POST `/api/accounts/request-next` — user (owner)
Body `{ accountId* }` — account must be `Passed`. Creates next stage (Phase 2 or Funded) — from inventory if available (instantly delivered) else pending. 400 if already requested.
→ `{ success, message, accountId }`

---

### 5. Payouts

#### GET `/api/payouts` — user
admin → all + `userName`,`userEmail`; others → own. → `{ success, payouts }`
`DBPayout = { id, accountId, userId, amount, profitSplitAmount, firmShareAmount, paymentMethod, paymentDetails (JSON string), status: pending|approved|processing|paid|rejected, approvedBy, approvedAt, notes, createdAt }`

#### POST `/api/payouts` — user (request withdrawal)
Body `{ accountId*, amount* (>0), paymentMethod*, paymentDetails* (object or string) }`
Gates (in order): KYC approved (403) → account owned & Funded/Instant & not Failed → 3 profitable days (≥0.5% each) → Instant/Funded: 5 qualifying days → rule breaches (tick scalping, inactivity, layering, concurrent layering, min holding) = 409 + may auto-fail → 6%-of-initial-balance cap per 14-day period → min $100.
Amount auto-adjusted down to the cap. Split 80% → 85% → 90% by count of previous paid payouts on that account (legacy: flat).
→ `{ success, payout, withdrawal: { requestedAmount, adjustedAmount, withdrawalCap, remainingProfit, wasAdjusted }, complianceReview: boolean }`

#### PUT `/api/payouts` — admin
Body `{ payoutId*, status*, notes? }`. `paid` → deducts amount from account balance/equity, issues payout certificate, emails trader. `rejected` → emails reason. → `{ success, payout }`

---

### 6. KYC

#### GET `/api/kyc` — user
- admin: `?userId=` → `{ success, kyc }`; no param → `{ success, kyc: [...+userName,userEmail], users }`.
- trader → `{ success, kyc | undefined, isEligible }` (eligible = has a delivered, non-failed Funded/Instant account).

#### POST `/api/kyc` — user. `method` switch:
- `{ method:"didit-create" }` → creates Didit session (or mock session if DIDIT env missing). 403 if not eligible. → `{ success, kyc, simulated }`. Frontend opens `kyc.backUrl` (Didit URL).
- `{ method:"didit-sync", userId?, simulateStatus?, rejectReason? }` → pulls decision from Didit and maps status. Admin may sync anyone. → `{ success, kyc, simulated }`
- no method (manual upload) `{ documentType*, frontUrl*, backUrl?, selfieUrl*, addressUrl* }` → status `pending`. (URLs must already be uploaded somewhere — there is no upload endpoint for KYC files.)

#### PUT `/api/kyc` — admin
Body `{ userId*, status* (approved|rejected|needs_review|pending), rejectReason? }` → emails trader. → `{ success, kyc }`

#### POST `/api/kyc/didit-webhook` — webhook
Signature via DIDIT_WEBHOOK_SECRET; handles `status.updated`/`data.updated`; matches `vendor_data` (userId) + `session_id`. Didit status → local: `Approved`→approved; `Declined|Expired|Abandoned|KYC Expired`→rejected; everything else (`Not Started|In Progress|In Review|Awaiting User|Resubmitted`)→pending. (`needs_review` is only set manually by an admin.)

---

### 7. Affiliate / referrals / collaborators

#### GET `/api/affiliate` — user
- admin → `{ success, affiliates: [+name,email], referrals: [+referredName, referredEmail, affiliateName, referralCode, amountPaid] }`
- trader → `{ success, affiliate: { userId, referralCode, commissionRate }, metrics: { totalReferrals, totalEarned, pendingEarned, paidEarned }, referrals: [+referredName, referredEmail, amountPaid, planName] }` (auto-creates affiliate row with 5% if missing).
Referral link format used by the dashboard: `/auth/signup?ref=<referralCode>`. The signup page must read `ref` from the URL and send it as `referralCode` in `POST /api/auth/signup` (the reference frontend does not do this automatically — wire it in a new frontend).
"Available referral balance" = sum of own referrals with status `approved` (spendable at checkout via `useReferralBalance`).

#### PUT `/api/affiliate` — admin
- `{ action:"update_rate", affiliateUserId*, commissionRate* }`
- `{ action:"update_referral", referredUserId*, orderId*, status* (pending|approved|paid) }` (paid → emails affiliate)

#### GET `/api/collaborators` — admin or collaborator
- admin → `{ success, collaborators: [{ userId, referralCode, commissionRate, name, email, metrics, sales }], sales }`
- collaborator → `{ success, collaborator, metrics: { registrations, totalSales, commissions, paidCommissions }, sales }`
Collaborator signup link (shown in collaborator portal): `/<locale>/auth/signup?collab=<code>`. The signup page must read `collab` and send it as `collaboratorCode` — the reference signup form does NOT currently do this, so wire it in any new frontend or attributions will never be recorded.
#### POST `/api/collaborators` — admin. Body `{ name*, email*, password*, referralCode? }` → creates `role:"collaborator"` user + collaborators row (20%).
#### PUT `/api/collaborators` — admin. Body `{ referredUserId*, orderId*, status: pending|approved|paid }` → `{ success: boolean }`

---

### 8. Notifications, certificates, logs

#### GET `/api/notifications` — user
admin → all (+userName,userEmail) newest first; others → own newest first. → `{ success, notifications }`
`{ id, userId, title, message, type: info|success|warning|error, channel: in_app|email, status, read, sentAt }`
#### POST `/api/notifications` — user / admin
Body `{ title*, message*, targetUserId? ("all" = broadcast, admin only), type?, channel? }`. Non-admin can only target self. `channel:"email"` also sends SMTP. → `{ success, count }`
#### PUT `/api/notifications` — owner or admin. Body `{ id*, read: boolean }` → `{ success, notification }`

#### GET `/api/certificates` — user, or public with `?id=`
- `?id=<certId>` (public verification page) → `{ success, verified:true, certificate }` / 404.
- no id → own `{ success, certificates }`.
`{ id, userId, accountId, traderName, accountSize, planName, datePassed }`

#### GET `/api/email-logs?userId=` — admin|support (all or filtered) / user (own) → `{ success, emailLogs }`
#### GET `/api/audit-logs` — admin → `{ success, logs }` newest first.

---

### 9. Admin tools

#### GET `/api/users` — admin → `{ success, users }` (newest first, no passwordHash)
#### PUT `/api/users` — admin
Body `{ userId*, name?, email?, phone?, country?, role?, status? (active|suspended|banned), referredBy?, newPassword? (≥8 chars) }` → `{ success, user }`

#### Challenge inventory (credential pool) — admin
Note: response key is `plans`/`plan` (historical naming).
- GET `/api/challenge-inventory` → `{ success, plans: DBChallengeInventoryItem[] }`
- POST body `{ platform*, size*, login*, password*, server*, externalStatisticsId?, graphLink? (http/https) }` → id `inv-<platform>-<login>`, status `available`. 409 duplicate.
- PUT body `{ id*, platform?, size?, login?, password?, server?, externalStatisticsId?, graphLink?, status?, orderId? }` — 409 if changing credentials/reopening while assigned to a delivered account. Graph link / stats id changes propagate to the assigned account.
- DELETE `?id=` — 409 if `delivered`.

#### Promotions (bulk marketing email) — admin
- GET `/api/promotions?accountSizes=10000,50000` → `{ success, templates, presets, availableAccountSizes, warnings }` (presets built from active pricing + first active coupon).
- POST `{ name*, subject*, html* (≤25KB) }` → 201 `{ template }`; PUT `{ id* (uuid), name, subject, html }`; DELETE `?id=<uuid>`.
- POST `/api/promotions/send` `{ subject*, html*, recipients*: string[] (1–100 emails) }` — refuses if html contains `ADD-CODE`; `{{email}}` placeholder supported; sends in batches of 5. → `{ success, sentCount, failedCount, failed }`

#### Newsletter
- POST `/api/newsletter` — public. Body `{ email*, source?: "footer"|"home" }` → `{ success, subscriber, message }` or `{ success, alreadySubscribed:true }`.
- GET `/api/newsletter` — admin|support → `{ success, subscribers }`

#### Pixel events (Meta tracking log)
- POST `/api/pixel-events` — public. Body `{ eventName (Purchase|InitiateCheckout|AddToCart|AddPaymentInfo|CompleteRegistration|Lead|Subscribe|StartTrial), eventId?, value?, currency?, contentName?, contentIds?, eventSourceUrl? }` → always `{ success:true }`.
- GET `/api/pixel-events` — admin → `{ success, events, summary: { total, sent, failed, purchases, purchaseValue } }`

---

### 10. Utility

- GET `/api/geo` — public → `{ success, country, isPakistan, cardPaymentAvailable, source }` (hide card/Paddle option when `cardPaymentAvailable===false`).
- GET `/api/news` — public → `{ success, news: [{ title, description, link, date, time }] }` (ForexLive RSS, falls back to mock).
- POST `/api/conversions` — public. Body `{ eventName*, eventId?, eventSourceUrl?, email?, phone?, firstName?, lastName?, customData? }` → Meta Conversions API. `{ success }`

---

# PART 3 — Business Logic

Source files: `src/lib/rulebook.ts`, `challengeStages.ts`, `orderFulfillment.ts`, `payoutRules.ts`, `accountTradingRules.ts`, `accountCompliance.ts`, `offerGrants.ts`, `offerEligibility.ts`, `collaborators.ts`, `kycEligibility.ts`.
Numbers below are the **current** values — a new firm will usually want to change them in `rulebook.ts` (single place).

### Contents
1. Challenge models & rulebook
2. Order statuses & lifecycle
3. Account stages & delivery
4. Pricing formula at checkout
5. Payment fulfilment (what happens after money arrives)
6. Payout rules
7. Trading-rule compliance engine
8. KYC flow
9. Referral (affiliate) program
10. Collaborator program
11. Offers (BOGO & free retry)
12. Notifications & emails
13. IDs & string conventions

---

### 1. Challenge models (`CHALLENGE_RULES` in rulebook.ts)

| Key | Buy label | Stages | P1 target | P2 target | Daily DD | Overall DD | Split |
|---|---|---|---|---|---|---|---|
| `two_step_standard` | Two Step | Phase 1 → Phase 2 → Funded | 8% | 5% | 4% | 10% | 80% |
| `one_step_pro` | One Step | Phase 1 → Funded | 10% | – | 4% | 10% | 80% |
| `instant_funding` | Instant | Funded only | – | – | 3% | 5% | 80% |

- Funded stage (any model) uses **3% daily / 5% overall** static drawdown from initial balance.
- Drawdown model: static. Leverage limit 1:100.
- Plan name → rule is resolved by `getChallengeRule(name)` using aliases ("2-STEP", "ONE STEP", "INSTANT FUNDING"...). Unknown names fall back to Two Step.
- **Legacy rulebook** (`LEGACY_CHALLENGE_RULES`, pre-2026-09): Two Step 10%/5%, 5% daily; funded 4%/10%; no tick-scalping/inactivity/5-day gate/news window; 30% profit-consistency rule instead. Applied only when admin sets `orders.legacyRules = true`.
- Other constants: `WEEKEND_HOLDING_ADDON_PERCENT = 20`, `CRYPTO_PAYMENT_DISCOUNT_PERCENT = 5`, `PROFIT_SPLIT_BY_WITHDRAWAL = [80, 85, 90]`, `INACTIVITY_LIMIT_DAYS = 30`, `SINGLE_TRADE_LOSS_LIMIT_PERCENT = 1`, `NEWS_RESTRICTED_MINUTES_EACH_SIDE = 5`, tick scalping = 3+ trades held <10s within 1 hour, minimum holding time 180s.

### 2. Order statuses

| Status | Meaning | Set by |
|---|---|---|
| `Pending` | created, awaiting payment | POST /api/orders |
| `Paid` | gateway confirmed payment (auto) | fulfillPaidOrder (webhooks) |
| `Active` | Phase 1 (or first stage) running | admin PUT /api/orders, or first account delivery |
| `Step2 Active` | Phase 2 running (Two Step only) | admin / auto on pass |
| `Live Active` | Funded stage running | admin / auto on pass |
| `Passed` | admin shortcut → marks latest account Passed & advances | admin |
| `Failed` | challenge breached | admin / account marked Failed / rule engine |
| `Replaced` | latest account reset (P/L zeroed) | admin |
| `Payment Failed` | crypto payment failed/expired/refunded | NOWPayments IPN |

Lifecycle (Two Step):
```
POST /api/orders ─► Pending ─(pay: gateway webhook)─► Paid + Phase-1 account
                                   │                      (delivered if inventory match, else pending)
          (manual crypto: admin sets Active)
Phase-1 account Passed ─► order "Step2 Active" + Phase-2 account (pending)
Phase-2 account Passed ─► order "Live Active"  + Funded account (pending)
Any account Failed ─► order "Failed"
```
One Step skips Phase 2; Instant starts directly at `Funded (Live)` with account status `Funded`.

"Passed" can be reached three ways: admin `PUT /api/accounts {status:"Passed"}`, admin `PUT /api/orders {status:"Passed"}`, or trader clicks "request next stage" (`POST /api/accounts/request-next`) on an already-Passed account.

### 3. Account stages & delivery

Phases (exact strings, stored in `trading_accounts.phase`):
- `Phase 1 (Evaluation)` → status `Active`
- `Phase 2 (Verification)` → status `Active`
- `Funded (Live)` → status `Funded`

`profitTarget` = size × stage target % (0 for funded).

**Delivery model:** a new stage account is created with placeholder creds (`GENERATED_MASTER_PASS`, server `Range4ex-PendingServer`, `deliveryStatus:"pending"`). Two ways to deliver:
1. **Automatic** — `challenge_inventory` has an `available` row with same platform + size → reserved (status `delivered`, `orderId` set) and copied into the account instantly.
2. **Manual** — admin opens Delivery desk → `PUT /api/accounts` with real login/password/server (optionally `inventoryItemId`). Trader gets an email with credentials.

Uniqueness: one real (platform, server, login) can only be on one delivered account (DB unique index + API 409).
Deleting an account/order releases its inventory row back to `available`.

### 4. Pricing formula (POST /api/orders)

```
base      = pricing_plans.price (live catalog, must be active)
base      = base × 1.20                          if weekendHoldingAddon
discount% = coupon.discountPercent               if active & not expired coupon
          | 10                                   if code is an affiliate referralCode (affiliate gets commission)
          | 10                                   legacy fallback codes LUNAR10 / SARAH10 if no coupon row
discount% += 5                                   if paymentMethod contains "crypto"
final     = ceil(base − base × discount%/100)
referral  = min(final, sum of caller's own APPROVED referral commissions)   if useReferralBalance
amount    = final − referral
```
If the frontend passes `expectedAmount` and it differs by >0.01 → 409 `PRICE_CHANGED` with the correct `amount`. **Always compute the same formula on the Buy page and send `expectedAmount`.**

Affiliate code commission at checkout: `(base × 0.9) × affiliate.commissionRate%`, saved as a `pending` referral; approved when the order is paid/activated.

### 5. Payment fulfilment (`fulfillPaidOrder`)

Runs from every gateway confirmation; idempotent.
1. Order `Pending` → `Paid`, gatewayRef saved, audit log `order_payment`.
2. Create first-stage account (reserve inventory if possible).
3. Grant BOGO offers (extra free orders/accounts).
4. Record collaborator sale (20%) if the buyer was attributed to a collaborator.
5. Spend referral balance: mark the buyer's own approved referrals `paid` up to `referralBalanceApplied`.
6. Referral commission: if an affiliate-code referral exists for this order → `approved`; else if buyer has `referredBy` → create approved referral at **5%** of amountPaid.
7. Emails: "Payment Received" (+ credentials if delivered) and in-app "Account Delivered/Provisioning Queued".

Admin `PUT /api/orders {status:"Active"}` does steps 2–7 too (used for manual crypto / bank payments), without creating a duplicate Phase-1 account.

Manual crypto ("Crypto QR"): trader uploads TXID + screenshot → admin views via `GET /api/orders/manual-payment?orderId=` → sets order `Active`.

### 6. Payout rules (POST /api/payouts)

1. KYC must be `approved`.
2. Account must be Funded / Instant (`status==="Funded"` or phase `Funded (Live)`) and not Failed.
3. **3 profitable days**, each ≥ 0.5% of initial balance.
4. Instant & funded (current rules): **5 qualifying days** total (3 profitable + 2 trading).
5. No breach: tick scalping, 30-day inactivity, trade layering (any trade opened within 5 min of previous open), Instant: ≥3 concurrent same-symbol same-direction positions, minimum holding time (<180s) → 409 and may auto-fail the account.
6. Legacy only: best day ≤ 30% of total profit.
7. Cap: withdrawable = min(balance − initialBalance, **6% of initial balance** − already requested in the current **14-day period** anchored at account creation). Request auto-reduced to cap.
8. Minimum gross **$100**.
9. Split: 80% first paid payout, 85% second, 90% third+ (per account). Legacy: flat rule split.
10. Weekend-holding violations (without add-on) don't block — they add a compliance note for admin review.

Admin marks `paid` → balance & equity reduced by gross amount, payout certificate generated.

### 7. Compliance engine (`applyAccountRuleCompliance`, runs on GET /api/accounts)

For each account with statistics it evaluates rule ids: `daily-drawdown`, `overall-drawdown`, `profit-target`, `minimum-profitable-trading-days`, `minimum-holding-time`, `tick-scalping`, `inactivity`, `leverage`, `news-trading`, `weekend-holding`, `trade-layering`, `concurrent-layering`, `single-trade-loss`, `profit-consistency` (legacy). A hard breach sets account `Failed`, order `Failed`, stores the reason inside `statisticsPayload` (so the dashboard banner shows it), writes audit log + in-app notification.

Statistics come from `STATISTICS_API_BASE_URL/<externalStatisticsId>` (default ShowMyTrades), cached in `statisticsPayload`, refreshed every 30 min (2 min retry on failure), rate-limited 150 ms/request. Without `externalStatisticsId` the account just shows stored balance/equity.

### 8. KYC

- Eligibility: user has ≥1 **delivered, non-failed** Funded/Instant account. Otherwise POST /api/kyc returns 403 (frontend should show "KYC unlocks after you get funded").
- Primary flow: Didit (`method:"didit-create"` → open returned URL → Didit webhook or `didit-sync` updates status). Without Didit env it runs in **simulation mode** (mock session, `simulateStatus` accepted).
- Fallback: manual document URLs + admin approve/reject via PUT /api/kyc.
- KYC `approved` is required only for payouts.

### 9. Affiliate program (built-in for every trader)

- Every trader gets an `affiliates` row at signup (rate 10%) or on first GET /api/affiliate (rate 5%).
- Two ways to earn:
  - Referred user signed up with `?ref=CODE` (`users.referredBy`) → **5%** of each paid order, auto-approved.
  - Buyer typed the affiliate's code as a coupon → buyer gets 10% off, affiliate earns `commissionRate%` of discounted base (pending → approved on payment).
- Approved commissions = spendable **referral balance** at checkout, or admin pays out (`update_referral` → `paid`).

### 10. Collaborator program (separate, admin-created partners)

- Admin creates collaborator (`role:"collaborator"`, fixed 20%). They log in at `/collaborator/signin` only (trader login refuses them).
- Signups via `?collab=CODE` (sent as `collaboratorCode`) → `collaborator_attributions`.
- Every paid order of an attributed user → `collaborator_sales` row, 20% of `amountPaid`, status `approved`; admin marks `paid`.

### 11. Offers

- **BOGO** (`type:"bogo"`): when a covered order is paid/activated, the system auto-creates `freeQuantity` free orders (`paymentMethod:"offer_bogo"`, `gatewayRef:"offer:<offerId>:from:<orderId>"`) + pending accounts of the same size. No code needed.
- **Free retry** (`type:"free_retry"`): a covered account that becomes `Failed` can claim up to `retryLimit` free replacements (POST /api/offers/retry) → $0 order (`paymentMethod:"free_retry"`) + new pending Phase-1 account + `offer_redemptions` row.
- Scope: `accountSizes`, `models`, `userIds`, `accountIds` — empty array = all. Live = status active, within startsAt/expiresAt, and `redeemedCount < maxRedemptions` (0 = unlimited).

### 12. Notifications & emails

- `db.saveNotification()` inserts a row; if `channel === "email"` it ALSO sends SMTP via `sendUserEmail` (Hostinger SMTP env) and logs to `email_logs`.
- Events that notify: signup welcome, login, email verified, order created/confirmed, payment received, credentials delivered, stage passed/failed, account removed, payout requested/paid/rejected, KYC updates, referral commission earned/paid, free retry approved, admin broadcast.
- Email HTML wrapper lives in `src/lib/emailTemplates.ts` — rebrand it.

### 13. IDs & string conventions

| Entity | ID format |
|---|---|
| user | `u-<9 base36>` / `u-admin-…` / `u-col-…` |
| order | `o-<4 digits>` / `ord-retry-…` / `ord-bogo-…` |
| account | 6-digit number string (or inventory login) |
| payout | `pay-<4 digits>` |
| notification | `notif-<9>`; rule notifications `rule-<accountId>-<ruleId>` |
| audit log | `log-<9>` |
| certificate | `cert-…` / `cert-pay-…` |
| inventory | `inv-<platform>-<login>` |
| pricing plan | `pp-<model-slug>-<size>k` |
| offer | `offer-<type>-<timestamp>` |

gatewayRef prefixes: `stripe:` `paddle:` `nowpayments:` `codapay:` `manual:` `offer:` `gway_` (not yet paid).

---

# PART 4 — Frontend Integration

### Contents
1. Two integration modes (Next.js vs any other frontend)
2. Files to copy (backend closure)
3. Environment variables (full list)
4. Session & auth handling in the frontend
5. Screen → endpoint map (trader dashboard, admin CRM, collaborator, public pages)
6. Key UI flows step by step
7. Provider dashboard URLs to configure

---

### 1. Two integration modes

**Mode A — target is a Next.js App Router project (recommended).**
Backend lives inside the same app → same origin → cookie just works. Copy files (section 2), install deps, set env, done.

**Mode B — target is Vite/CRA/Vue/Svelte/Webflow/mobile.**
Deploy the backend as its own small Next.js app (copy only `src/app/api`, backend `src/lib`, `src/config`, plus a minimal `package.json`/`next.config`). Then either:
- *Preferred:* serve both under one domain with a reverse proxy (`/api/*` → backend). Vite dev: `server.proxy = { "/api": "http://localhost:3001" }`. Vercel: `rewrites` in `vercel.json`. Cookie stays first-party, zero code changes.
- *Cross-origin (last resort):* backend on `api.firm.com`, frontend on `firm.com`. Then you must: (1) add CORS headers with the exact frontend origin + `Access-Control-Allow-Credentials: true` (Next middleware), handle `OPTIONS`; (2) change every `cookieStore.set("prop_session", …)` to `{ sameSite: "none", secure: true, domain: ".firm.com" }`; (3) frontend fetch with `credentials: "include"`. Browsers block third-party cookies increasingly — prefer the proxy.
- Mobile apps: cookie jar works with most HTTP clients; send the cookie back on each request.

### 2. Files to copy (exact backend dependency closure)

```
src/app/api/**                       (all 44 route.ts files)
src/config/didit.ts
src/config/manualWallets.ts
src/config/payments.ts
src/lib/accountCompliance.ts   src/lib/accountStatistics.ts   src/lib/accountTradingRules.ts
src/lib/challengeStages.ts     src/lib/collaborators.ts       src/lib/db.ts
src/lib/didit.ts               src/lib/drawdown.ts            src/lib/email.ts
src/lib/emailTemplates.ts      src/lib/emailVerification.ts   src/lib/geo.ts
src/lib/kycEligibility.ts      src/lib/metaConversionsApi.ts  src/lib/offerEligibility.ts
src/lib/offerGrants.ts         src/lib/orderFulfillment.ts    src/lib/payments.ts
src/lib/payoutRules.ts         src/lib/promotionTemplatePresets.ts
src/lib/routeCache.ts          src/lib/rulebook.ts            src/lib/statisticsSync.ts
src/lib/statisticsTime.ts      src/lib/supabaseClient.ts      src/lib/tradeLayering.ts
src/lib/tradingStatistics.ts
```
Dependencies: `npm i @supabase/supabase-js nodemailer zod && npm i -D @types/nodemailer`.
tsconfig: `"paths": { "@/*": ["./src/*"] }`. Next.js 15/16 (uses async `cookies()`).
Frontend-only helpers you may also want: `src/lib/metaPixel.ts` (browser pixel), `src/lib/drawdown.ts` + `rulebook.ts` (to render rules/limits in UI — safe to import client-side, no secrets).

### 3. Environment variables

| Var | Required? | Used for |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | **yes** | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | **yes** (server only) | all DB + storage access |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | optional | not used by API routes; keep for future client features |
| `NEXT_PUBLIC_APP_URL` / `NEXT_PUBLIC_SITE_URL` / `APP_URL` | yes | redirects, emails, gateway return URLs |
| `SUPPORT_EMAIL` | recommended | email footer |
| `CRM_ADMIN_PASSCODE` | **set it** (default `ADMIN123`) | CRM signup gate |
| `HOSTINGER_SMTP_HOST` `_PORT` `_USER` `_PASS`, `HOSTINGER_EMAIL_FROM` | for emails | nodemailer SMTP (any SMTP works, names are just historical) |
| `STATISTICS_API_BASE_URL` | optional (default showmytrades.com/api/statistics) | live account stats |
| `DIDIT_API_KEY` `DIDIT_WORKFLOW_ID` `DIDIT_WEBHOOK_SECRET` `DIDIT_CALLBACK_URL` | optional (else simulation) | KYC |
| `STRIPE_SECRET_KEY` (sk_live_) `STRIPE_WEBHOOK_SECRET` `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | if Stripe | card checkout |
| `PADDLE_API_KEY` `PADDLE_WEBHOOK_SECRET` `PADDLE_ENVIRONMENT` (sandbox/production) `PADDLE_CHECKOUT_URL` `PADDLE_TWO_STEP_PRICE_ID` `PADDLE_ONE_STEP_PRICE_ID` `PADDLE_INSTANT_PRICE_ID` | if Paddle | card/wallet checkout |
| `NOWPAYMENTS_API_KEY` `NOWPAYMENTS_IPN_SECRET` | if NOWPayments | crypto invoices |
| `CODAPAY_API_KEY` `CODAPAY_PROJECT_ID` `CODAPAY_ENVIRONMENT` | if CodaPay | local payments |
| `NEXT_PUBLIC_WALLET_USDT_BEP20` `_USDT_TRC20` `_USDT_POLYGON` `_USDT_ERC20` `_BTC` `_SOL` | if manual crypto | **firm's own wallets — the code falls back to range4ex wallets if unset!** |
| `NEXT_PUBLIC_META_PIXEL_ID` `META_CONVERSIONS_API_ACCESS_TOKEN` | optional | Meta tracking |
| `WEEKEND_MARKET_CLOSE_UTC_HOUR` | optional (23) | weekend holding rule |

### 4. Session & auth in the frontend

- Login/signup/logout = plain `fetch` to the auth endpoints; the server sets/deletes the httpOnly cookie. Frontend never stores tokens.
- On every protected page load call `GET /api/auth/me`:
  - 401 → redirect to `/auth/signin` (trader) or `/crm-portal/signin` (admin).
  - `user.role` decides the UI: `admin`/`support` → CRM, `collaborator` → collaborator portal, else trader dashboard.
- The reference frontend also caches `userId` in `localStorage.prop_session_userId` — not needed; `/api/auth/me` is the source of truth.
- Show "verify your email" banner when `emailVerified === false` (returned by signin).
- Same endpoints serve admin + trader; the server filters by role. Admin UI = same fetch calls, richer responses (`userName`, `userEmail` joined).

### 5. Screen → endpoint map

#### Public site
| Screen | Calls |
|---|---|
| Pricing / plans section | `GET /api/pricing-plans` (filter active), `GET /api/offers` (promo banners) |
| Header promo banner / BOGO popup | `GET /api/offers`, `GET /api/coupons` |
| Newsletter form (footer/home) | `POST /api/newsletter` |
| Sign up | `POST /api/auth/signup` (read `?ref=` → `referralCode`, `?collab=` → `collaboratorCode`) → go to `verificationPage` |
| Verify email page | reads `?status=` set by `/api/auth/verify-email` redirect; "resend" → `POST /api/auth/resend-verification` |
| Sign in | `POST /api/auth/signin` |
| Certificate verify page | `GET /api/certificates?id=` |
| Meta pixel | `POST /api/pixel-events`, `POST /api/conversions` |

#### Trader dashboard (`/dashboard/<tab>`)
| Tab | Calls |
|---|---|
| overview | `GET /api/auth/me`, `/api/accounts`, `/api/orders`, `/api/notifications`, `/api/affiliate`, `/api/offers/accounts` |
| accounts ("My accounts") | `GET /api/accounts`, `GET /api/offers/accounts`, `GET /api/offers/retry`, `POST /api/offers/retry`, `POST /api/accounts/request-next` |
| buy ("Buy challenge") | `GET /api/pricing-plans`, `/api/coupons`, `/api/offers`, `/api/affiliate` (referral balance), `/api/geo` → `POST /api/orders` → `POST /api/orders/pay` (redirect) or manual crypto `POST /api/orders/manual-payment` |
| offers | `GET /api/offers/accounts` |
| performance / history / rules / achievements | data from `GET /api/accounts` (`statisticsPayload`) + `GET /api/certificates` |
| kyc | `GET /api/kyc`, `POST /api/kyc` (`didit-create`, `didit-sync`) |
| payouts ("Withdraw") | `GET /api/payouts`, `GET /api/accounts`, `GET /api/kyc`, `POST /api/payouts` |
| referrals | `GET /api/affiliate` |
| settings | `GET/PUT /api/auth/me` (name, phone, country only) |
| notifications | `GET /api/notifications`, `PUT /api/notifications` (mark read) |
| news | `GET /api/news` |
| header / sidebar | `GET /api/auth/me`, `POST /api/auth/signout`, `GET /api/notifications` |
| `/pay?orderId=&platform=&locale=` page | `POST /api/orders/pay` |

#### Admin CRM (`/crm-portal/<tab>`; login `/crm-portal/signin`)
| Tab | Calls |
|---|---|
| admin-telemetry (Control Dashboard) | `GET /api/users`, `/api/orders`, `/api/accounts`, `/api/payouts`, `/api/kyc` (aggregate client-side) |
| admin-users (User Manager) | `GET/PUT /api/users`, `POST /api/auth/crm/impersonate`, `GET /api/email-logs?userId=` |
| admin-kyc | `GET /api/kyc`, `PUT /api/kyc`, `POST /api/kyc {method:"didit-sync", userId}` |
| admin-accounts (Accounts Desk / Delivery) | `GET /api/accounts`, `PUT /api/accounts` (deliver/edit/status), `DELETE /api/accounts?id=`, `GET /api/challenge-inventory` (pick credentials) |
| admin-orders (Orders Desk) | `GET /api/orders`, `PUT /api/orders` (status / legacyRules), `DELETE /api/orders?id=`, `GET /api/orders/manual-payment?orderId=` |
| admin-plans (Challenge Inventory) | `GET/POST/PUT/DELETE /api/challenge-inventory` |
| admin-pricing | `GET/POST/DELETE /api/pricing-plans` |
| admin-coupons | `GET/POST/DELETE /api/coupons` |
| admin-offers | `GET/POST/PATCH/DELETE /api/offers` |
| admin-payouts | `GET /api/payouts`, `PUT /api/payouts` |
| admin-collaborators | `GET/POST/PUT /api/collaborators` |
| admin-affiliates | `GET /api/affiliate`, `PUT /api/affiliate` |
| admin-promotions | `GET/POST/PUT/DELETE /api/promotions`, `POST /api/promotions/send`, `GET /api/newsletter` (recipients) |
| admin-notifications (Broadcast) | `GET /api/notifications`, `POST /api/notifications { targetUserId:"all"|id }` |
| admin-pixel-events | `GET /api/pixel-events` |
| admin-audit | `GET /api/audit-logs` |
| CRM signup | `POST /api/auth/crm/signup` |

#### Collaborator portal (`/collaborator`, login `/collaborator/signin`)
`POST /api/auth/collaborator/signin` → `GET /api/collaborators` (own metrics + sales) → share link `/<locale>/auth/signup?collab=<code>`.

### 6. Key UI flows

**Buy challenge**
1. Load plans/coupons/offers/geo/affiliate in parallel.
2. User picks model + size + platform + payment method (+ weekend add-on, coupon, use referral balance). Compute price with the exact formula in Part 3 §4 → show total.
3. `POST /api/orders { planId, paymentMethod, couponUsed, weekendHoldingAddon, useReferralBalance, expectedAmount }`.
   - 409 `PRICE_CHANGED` → show `amount`, let user confirm again.
4. If `paymentMethod === "Crypto QR"` → show wallet QR (from `MANUAL_WALLETS` in `src/config/manualWallets.ts`) → form-data `POST /api/orders/manual-payment`.
   Else → `POST /api/orders/pay { orderId, platform, locale }` → `window.location.href = checkoutUrl`.
5. Gateway returns to `/<locale>/dashboard?payment=success&orderId=…` → refetch accounts/orders, show toast.

**Delivery (admin)**
Orders Desk shows paid/active orders → Accounts Desk lists `deliveryStatus:"pending"` accounts → pick inventory row → `PUT /api/accounts { id, platform, login, passwordMaster, passwordInvestor, server, inventoryItemId, externalStatisticsId, graphLink }`.

**Stage progression**
Admin marks account `Passed` (PUT /api/accounts) → next-stage account auto-created pending → deliver. Or trader presses "Request Phase 2 / Funded" (`POST /api/accounts/request-next`).

**Withdraw**
Only Funded/Instant accounts, KYC approved. `POST /api/payouts { accountId, amount, paymentMethod, paymentDetails: { address } | { accountName, bankName, iban } }`. Show `withdrawal.wasAdjusted` message if capped. Admin `PUT /api/payouts { payoutId, status:"paid" | "rejected", notes }`.

**Error handling pattern**
```ts
const res = await fetch(url, { credentials: "include", ...init });
const data = await res.json().catch(() => ({}));
if (res.status === 401) redirectToSignin();
if (!res.ok || data.success === false) throw new Error(data.error || `HTTP ${res.status}`);
```
Use **Part 6 — propApi.ts client** which already does this.

### 7. Provider dashboards — URLs to register (replace domain)

| Provider | URL |
|---|---|
| Stripe webhook | `https://<domain>/api/orders/pay/stripe-webhook` (events: checkout.session.completed, checkout.session.async_payment_succeeded) |
| Paddle notification | `https://<domain>/api/orders/pay/paddle-webhook` (transaction.completed) |
| NOWPayments IPN | `https://<domain>/api/orders/pay/nowpayments-ipn` (also hard-coded in `src/config/payments.ts` → update!) |
| CodaPay Notify URL | `https://<domain>/api/orders/pay/codapay-notify` |
| Didit webhook / callback | `https://<domain>/api/kyc/didit-webhook` (+ `DIDIT_CALLBACK_URL`) |

---

# PART 5 — Database Schema (SQL)

Poora block copy karke Supabase SQL Editor mein run karo (idempotent — dobara chalana safe).

```sql
-- ============================================================================
-- PROP FIRM BACKEND — COMPLETE SUPABASE SCHEMA (idempotent, safe to re-run)
-- ============================================================================
-- Consolidates src/lib/supabase_schema.sql + every *_migration.sql +
-- collaborator_schema.sql from the reference repo, WITHOUT demo seed data.
--
-- 24 tables:
--   users, email_verification_tokens, challenge_plans, pricing_plans,
--   challenge_inventory, kyc, orders, trading_accounts, payouts,
--   affiliates, referrals, collaborators, collaborator_attributions,
--   collaborator_sales, certificates, notifications, email_logs, audit_logs,
--   pixel_events, coupons, offers, offer_redemptions,
--   newsletter_subscribers, promotion_email_templates
--
-- Conventions (the app depends on these — do not "fix" them):
--   * Column names are camelCase and MUST stay double-quoted ("userId").
--   * Primary keys are TEXT ids generated by the app ("u-xxxx", "o-1234"),
--     except newsletter_subscribers (identity) and promotion_email_templates (uuid).
--   * RLS is ENABLED on every table. The server uses the service-role key, which
--     bypasses RLS. Only the 3 public catalog tables get a read-only policy.
--     No write policy exists for anon/authenticated on purpose.
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
-- Legacy plan table. orders."planId" has an FK to it, so on the first order of a
-- pricing_plans row the API copies that row here automatically.
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
-- The LIVE buy catalog. Orders are only accepted for status='active' rows.
-- id format created by the API: "pp-<model-slug>-<size>k", e.g. pp-two-step-100k
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
-- Pool of pre-created platform credentials. On payment, an 'available' row with
-- matching platform+size is auto-reserved and delivered instantly.
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
-- One row per user. For Didit KYC the URL columns are REUSED:
--   frontUrl = didit session_id, backUrl = session url,
--   selfieUrl = session token,  addressUrl = didit status text ("In Progress", "Approved"...)
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
  status                   text not null,           -- see business-logic.md → Order statuses
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
-- One real credential set can belong to only one delivered account.
-- NOTE: if you rebrand the placeholder server name in code, change it here too.
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
-- Every trader gets an affiliates row (auto code) at signup.
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
-- Separate admin-managed partner program (fixed 20% commission).
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
-- Public verification via GET /api/certificates?id=<id>
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
-- channel='email' rows are ALSO sent via SMTP when saved (db.saveNotification).
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
  status            text not null default 'active', -- active | inactive  (read side derives "expired")
  "expiresAt"       timestamptz,
  "createdAt"       timestamptz default now()
);
alter table public.coupons add column if not exists "expiresAt" timestamptz;
alter table public.coupons add column if not exists "createdAt" timestamptz default now();
alter table public.coupons enable row level security;

-- ---------------------------------------------------------------- offers
-- type 'bogo'       → buy N get M same-size free (auto-applied on paid order)
-- type 'free_retry' → failed account can claim a free replacement
-- Empty jsonb scope arrays mean "applies to everything".
create table if not exists public.offers (
  id               text primary key,
  name             text not null,
  type             text not null default 'bogo',
  code             text,                            -- legacy, always blank
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
-- Catalog tables only. (The original repo also had "FOR ALL USING (true)" on
-- pricing_plans and pixel_events — that lets the anon key WRITE. Intentionally
-- not reproduced here.)
drop policy if exists "Allow public read of coupons" on public.coupons;
create policy "Allow public read of coupons" on public.coupons for select to anon, authenticated using (true);
drop policy if exists "Allow public read of offers" on public.offers;
create policy "Allow public read of offers" on public.offers for select to anon, authenticated using (true);
drop policy if exists "Allow public read of pricing_plans" on public.pricing_plans;
create policy "Allow public read of pricing_plans" on public.pricing_plans for select to anon, authenticated using (true);

-- ============================================================================
-- OPTIONAL SEEDS (edit values, then run separately)
-- ============================================================================
-- First admin (ask the user for email/password — never invent production creds):
-- insert into public.users (id, name, email, phone, country, "passwordHash", role, status, "emailVerified")
-- values ('u-admin-001', 'Admin', lower('admin@newfirm.com'), '', '',
--         encode(digest('CHANGE_ME', 'sha256'), 'hex'), 'admin', 'active', true)
-- on conflict (id) do nothing;
--
-- Example buy catalog (ids must follow pp-<model-slug>-<size>k):
-- insert into public.pricing_plans (id, model, size, price, status) values
--   ('pp-one-step-10k',  'One Step', 10000,  99,  'active'),
--   ('pp-two-step-50k',  'Two Step', 50000,  299, 'active'),
--   ('pp-two-step-100k', 'Two Step', 100000, 499, 'active'),
--   ('pp-instant-50k',   'Instant',  50000,  749, 'active')
-- on conflict (id) do update set price = excluded.price, status = excluded.status;
```

---

# PART 6 — Typed API client (`propApi.ts`)

Naye frontend mein `src/lib/propApi.ts` bana kar yeh code paste karo.

```ts
/**
 * propApi.ts — drop-in typed client for the prop-firm backend (/api/*).
 *
 * Copy into the new frontend (e.g. src/lib/propApi.ts). Works in any
 * browser framework. Set API_BASE only if the backend is on another origin
 * (see Part 4 → Mode B); same-origin/proxy = leave "".
 *
 * Payment methods used by the live site: "Paddle" (card) and "Crypto QR"
 * (manual wallet transfer, gets the automatic +5% crypto discount).
 * Others the backend understands: "USDT (Crypto)" → NOWPayments,
 * "CodaPay", anything else → Stripe.
 */

export const API_BASE = "";

// ------------------------------------------------------------------ types
export type Role = "trader" | "admin" | "support" | "affiliate" | "collaborator";
export type User = {
  id: string; name: string; email: string; phone: string; country: string;
  role: Role; status: "active" | "suspended" | "banned";
  emailVerified?: boolean; referredBy?: string; createdAt: string;
};
export type PricingPlan = { id: string; model: "One Step" | "Two Step" | "Instant"; size: number; price: number; status: string };
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
  const { json, headers, ...rest } = init;
  const res = await fetch(API_BASE + path, {
    credentials: "include",
    ...rest,
    headers: json !== undefined ? { "Content-Type": "application/json", ...headers } : headers,
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
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
    savePricingPlan: (b: { model: PricingPlan["model"]; size: number; price: number; status?: string }) => post<{ plan: PricingPlan }>("/api/pricing-plans", b),
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
    /** Throws ApiError with data.code === "PRICE_CHANGED" and data.amount on price mismatch (409). */
    create: (b: { planId: string; paymentMethod: string; couponUsed?: string; useReferralBalance?: boolean; weekendHoldingAddon?: boolean; expectedAmount?: number }) =>
      post<{ success: true; order: Order }>("/api/orders", b),
    /** Returns checkoutUrl → window.location.href = checkoutUrl */
    pay: (orderId: string, platform: "MT4" | "MT5" | "cTrader" = "MT5", locale = "en") =>
      post<{ success: true; provider: string; checkoutUrl: string; gatewayRef: string }>("/api/orders/pay", { orderId, platform, locale }),
    submitManualPayment: (b: { orderId: string; walletId: string; txid: string; screenshot: File }) => {
      const form = new FormData();
      form.set("orderId", b.orderId); form.set("walletId", b.walletId); form.set("txid", b.txid); form.set("screenshot", b.screenshot);
      return request<{ success: true; order: Order }>("/api/orders/manual-payment", { method: "POST", body: form });
    },
    // admin
    viewPaymentProof: (orderId: string) => get<{ success: true; url: string; walletId: string; txid: string }>(`/api/orders/manual-payment${q({ orderId })}`),
    setStatus: (orderId: string, status: string) => put<{ success: true; order: Order }>("/api/orders", { orderId, status }),
    setLegacyRules: (orderId: string, legacyRules: boolean) => put<{ success: true; order: Order }>("/api/orders", { orderId, legacyRules }),
    remove: (id: string) => del<{ success: true; removedAccounts: number }>(`/api/orders${q({ id })}`),
  },

  accounts: {
    list: () => get<{ success: true; accounts: TradingAccount[] }>("/api/accounts"),
    requestNextStage: (accountId: string) => post<{ success: true; message: string; accountId: string }>("/api/accounts/request-next", { accountId }),
    // admin: deliver credentials / edit / change status
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
    startDidit: () => post<{ success: true; kyc: Kyc; simulated: boolean }>("/api/kyc", { method: "didit-create" }), // open kyc.backUrl
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
    /** admin: targetUserId "all" = broadcast */
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
/** Mirrors the server formula so the Buy page can send an exact expectedAmount. */
export function computeCheckoutTotal(input: {
  catalogPrice: number; weekendHoldingAddon?: boolean; discountPercent?: number; // coupon or 10 for affiliate code
  isCrypto?: boolean; referralBalance?: number; useReferralBalance?: boolean;
}) {
  const base = input.catalogPrice * (input.weekendHoldingAddon ? 1.2 : 1);
  const pct = (input.discountPercent || 0) + (input.isCrypto ? 5 : 0);
  const final = Math.ceil(base - base * (pct / 100));
  const referral = input.useReferralBalance ? Number(Math.min(final, input.referralBalance || 0).toFixed(2)) : 0;
  return Number((final - referral).toFixed(2));
}
```
