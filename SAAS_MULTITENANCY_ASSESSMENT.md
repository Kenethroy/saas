## SaaS Multitenancy Assessment

### Current repo state

- `nodejs` is a single-tenant ERP API.
- `react` is a single admin app that starts at `/login` and then goes directly into ERP routes.
- There is no separate public `web` app for landing, registration, onboarding, plan selection, or payment.
- The current auth bootstrap allows only the very first admin registration, then disables public registration.
- The database is globally scoped today:
  - `users.email` and `users.username` are globally unique.
  - `settings` is global.
  - business tables do not carry `tenant_id` or `branch_id`.

### What this means

This codebase is not a light "add one table" SaaS conversion. It needs a platform layer above the ERP layer.

You need two levels of data:

1. Platform SaaS data
- registration
- business onboarding
- plan selection
- subscription
- payment
- tenant provisioning
- domain mapping

2. Tenant ERP data
- users
- employees
- products
- customers
- suppliers
- orders
- invoices
- reports
- settings

### Recommended app split

- `web`
  - landing page
  - register account
  - business setup
  - choose plan
  - payment
  - onboarding status
  - login entry if needed

- `api`
  - public SaaS endpoints
  - payment webhooks
  - tenant provisioning
  - domain resolution
  - existing ERP endpoints

- `react`
  - authenticated tenant admin
  - dashboard
  - ERP modules
  - branch management
  - subscription and billing management
  - tenant settings including subdomain editing

- `platform admin`
  - SaaS owner dashboard
  - tenant management
  - plan management
  - payment review
  - subscription overrides/suspension
  - system-wide settings

### Core platform tables you need

#### 1. `accounts`
Global human identity.

Suggested columns:
- `id`
- `email` unique
- `password_hash`
- `status`
- `email_verified_at`
- `last_login_at`
- `created_at`
- `updated_at`

Why:
- one person can own or belong to multiple tenants
- email uniqueness belongs here, not in tenant ERP users

#### 2. `tenants`
One business/workspace/customer account.

Suggested columns:
- `id`
- `uuid`
- `slug` unique
- `name`
- `legal_name`
- `business_type`
- `address`
- `phone`
- `email`
- `logo_path`
- `currency_code`
- `timezone`
- `status` enum(`pending`,`active`,`suspended`,`cancelled`)
- `primary_owner_account_id`
- `subscription_status`
- `created_at`
- `updated_at`

#### 3. `tenant_memberships`
Connects global account to a tenant.

Suggested columns:
- `id`
- `tenant_id`
- `account_id`
- `role` enum(`owner`,`admin`,`member`)
- `status`
- `joined_at`
- unique (`tenant_id`, `account_id`)

#### 4. `branches`
Business branches under a tenant.

Suggested columns:
- `id`
- `tenant_id`
- `code`
- `name`
- `type` enum(`main`,`branch`)
- `is_primary`
- `status`
- `phone`
- `email`
- `address`
- `created_at`
- `updated_at`
- unique (`tenant_id`, `code`)

#### 5. `subscription_plans`
Defines Starter / Pro / Enterprise.

Suggested columns:
- `id`
- `code` unique
- `name`
- `description`
- `price_monthly`
- `price_yearly`
- `max_branches` nullable
- `max_users` nullable
- `max_products` nullable
- `max_storage_gb` nullable
- `allow_reports`
- `allow_backup`
- `allow_api_access`
- `allow_multi_branch`
- `is_active`

For your rules:
- `starter` => `max_branches = 1`
- `pro` => `max_branches = 3`
- `enterprise` => `max_branches = NULL` or a high negotiated limit

#### 6. `subscriptions`
Current and historical subscription per tenant.

Suggested columns:
- `id`
- `tenant_id`
- `plan_id`
- `status` enum(`incomplete`,`trialing`,`active`,`past_due`,`cancelled`,`expired`)
- `billing_cycle` enum(`monthly`,`yearly`)
- `started_at`
- `current_period_start`
- `current_period_end`
- `cancel_at_period_end`
- `cancelled_at`
- `created_at`
- `updated_at`

#### 7. `subscription_payments`
Payment records tied to subscriptions.

Suggested columns:
- `id`
- `subscription_id`
- `tenant_id`
- `provider` enum(`manual`,`stripe`,`paymongo`,`xendit`)
- `provider_reference`
- `amount`
- `currency`
- `status` enum(`pending`,`paid`,`failed`,`refunded`)
- `paid_at`
- `created_at`

#### 8. `billing_invoices`
Optional but recommended if you want billing history and downloadable invoices.

Suggested columns:
- `id`
- `tenant_id`
- `subscription_id`
- `invoice_number`
- `amount_due`
- `amount_paid`
- `status`
- `due_at`
- `paid_at`

#### 9. `tenant_domains`
Maps domain/subdomain to tenant.

Suggested columns:
- `id`
- `tenant_id`
- `domain`
- `type` enum(`subdomain`,`custom`)
- `is_primary`
- `status` enum(`pending`,`verified`,`active`,`failed`)
- `verification_token`
- `verified_at`
- unique (`domain`)

#### 10. `tenant_onboarding`
Tracks the flow you described.

Suggested columns:
- `id`
- `tenant_id`
- `account_id`
- `current_step` enum(`account`,`business_info`,`plan`,`payment`,`activation`,`completed`)
- `business_info_completed_at`
- `plan_selected_at`
- `payment_completed_at`
- `webhook_confirmed_at`
- `tenant_created_at`
- `admin_created_at`
- `completed_at`

#### 11. `tenant_subdomain_history`
Stores subdomain changes for audit and redirect handling.

Suggested columns:
- `id`
- `tenant_id`
- `old_subdomain`
- `new_subdomain`
- `changed_by_account_id`
- `changed_at`

#### 12. `provider_events`
Stores payment webhook events for idempotency and audit.

Suggested columns:
- `id`
- `provider`
- `event_id`
- `event_type`
- `tenant_id` nullable
- `subscription_id` nullable
- `payload_json`
- `processed_at`
- `status`
- unique (`provider`, `event_id`)

### Existing tables that must be revised

Minimum rule:
- every tenant-owned table gets `tenant_id`
- every branch-sensitive table gets `branch_id`

#### Identity and administration

- `users`
  - add `tenant_id`
  - optionally add `account_id` if you want direct link to global identity
  - make uniqueness tenant-scoped:
    - unique (`tenant_id`, `username`)
    - unique (`tenant_id`, `email`) if you keep tenant-local user emails

- `employees`
  - add `tenant_id`
  - add `branch_id` if staff belong to a branch

- `user_sessions`
  - either keep via `users.user_id`
  - or move session ownership to `accounts`

- `user_permissions`
  - stays linked to `users`

- `activity_logs`
  - add `tenant_id`
  - add `branch_id` nullable

- `settings`
  - replace with tenant-aware settings
  - recommended:
    - add `tenant_id`
    - change unique key from `key` to (`tenant_id`, `key`)

#### Master data

Add `tenant_id` to:
- `categories`
- `products`
- `product_variants`
- `payment_terms`
- `customers`
- `suppliers`
- `trucks`
- `expense_categories`

Add `branch_id` too if records are branch-owned:
- `products` if inventory is branch-specific
- `trucks` if assigned to branch
- `customers` and `suppliers` only if you truly segregate them by branch

#### Transaction tables

Add `tenant_id` to all of these:
- `sales_orders`
- `sales_order_items`
- `quotations`
- `quotation_items`
- `deliveries`
- `delivery_sales_orders`
- `invoices`
- `invoice_items`
- `payments`
- `payment_allocations`
- `return_allocations`
- `accounts_receivable`
- `customer_returns`
- `customer_return_items`
- `purchase_orders`
- `purchase_order_items`
- `accounts_payable`
- `supplier_payments`
- `inventory_transactions`
- `inventory_adjustments`
- `inventory_adjustment_items`
- `business_expenses`
- `recurring_business_expenses`
- `payslips`
- `assistant_queries`
- `assistant_index_documents`
- `assistant_index_chunks`

Add `branch_id` to branch-sensitive operations:
- `sales_orders`
- `quotations`
- `deliveries`
- `invoices`
- `payments`
- `customer_returns`
- `purchase_orders`
- `supplier_payments`
- `inventory_transactions`
- `inventory_adjustments`
- `business_expenses`
- `payslips`

### Important modeling decision

You need to decide one thing early:

#### Option A: account + membership model
- `accounts` is global login identity
- `users` becomes tenant operational user profile or is replaced by `tenant_users`
- best if one person can access multiple businesses

#### Option B: tenant-scoped users only
- keep `users` and add `tenant_id`
- simpler short term
- weaker if one email needs access to multiple tenants

Recommended: Option A.

### Branch entitlement logic

Do not hardcode plan logic in many places. Put the limit in `subscription_plans.max_branches`.

Then enforce:
- Starter: block creating branch 2
- Pro: block creating branch 4
- Enterprise: allow unlimited or contract-based limit

You can validate branch creation by:
- active subscription exists
- tenant status is active
- current active branch count < plan max

Use the same pattern for other plan limits:
- `max_users`
- `max_products`
- `allow_reports`
- `allow_backup`
- `allow_api_access`
- `allow_multi_branch`

Important:
- keep limits in DB, not hardcoded in controllers
- enforce them with dedicated middleware/service checks
- return upgrade-oriented error messages when a limit is reached

### Domain strategy

Recommended:

- `web.yourdomain.com`
  - landing and onboarding

- `api.yourdomain.com`
  - API

- `app.yourdomain.com`
  - admin app (`react`)

Optional later:
- `{tenant-slug}.yourdomain.com`
- custom domains through `tenant_domains`

If your DNS already has a wildcard record like `*.domain.com`, then subdomains do not need manual DNS setup one by one. You still need application-level mapping so the API knows which tenant a subdomain belongs to.

Recommended wildcard approach:
- wildcard DNS points `*.domain.com` to the same frontend/app entry
- the app reads the host
- the API resolves the host against `tenant_domains`
- if matched, load that tenant context

Subdomain governance rules:
- unique across all tenants
- lowercase only
- allowed characters: `a-z`, `0-9`, `-`
- no spaces
- minimum length such as `3`
- maximum length such as `50`
- block reserved names

Recommended reserved names:
- `www`
- `api`
- `admin`
- `app`
- `mail`
- `root`
- `support`
- `help`
- `billing`
- `dashboard`
- `cdn`
- `assets`
- `static`

Operational notes:
- wildcard DNS is not enough by itself; production should also use wildcard SSL
- subdomain change does not require new DNS records, but does require DB validation and redirect handling

Do not bind the admin app directly to one tenant only by frontend route. Resolve tenant from:
- authenticated membership
- selected tenant in session
- subdomain or custom domain when needed

### Tenant domain vs branch domain

Recommended default:
- one subscription = one tenant/business
- one tenant uses one primary domain or subdomain
- branches stay inside that tenant
- branch selection is handled inside the app, not by separate subdomains

Recommended URL pattern:
- tenant domain:
  - `acme.domain.com`
- branch inside app:
  - `acme.domain.com/dashboard?branch=manila`
  - or `acme.domain.com/branches/manila/...`

Why this is better:
- subscription belongs to the tenant, not to each branch
- users can switch branches without switching hostnames
- simpler permissions, sessions, cookies, and billing
- simpler reporting across all branches of the same business

Use per-branch subdomains only if branches behave almost like separate companies, for example:
- separate branding per branch
- separate customer-facing portals per branch
- strong operational separation

If you ever need that later, do it with a second table such as:
- `branch_domains`
  - `id`
  - `tenant_id`
  - `branch_id`
  - `domain`
  - `is_primary`
  - `status`

But for your current SaaS model, I recommend:
- domain identifies the tenant
- branch is selected inside the tenant app

Subdomain editing flow:
- owner or tenant admin requests new subdomain
- validate format and reserved words
- check uniqueness
- update primary tenant domain
- write `tenant_subdomain_history`
- redirect user to the new subdomain

### Payment provider recommendation

Recommended starting provider: `Xendit`

Why `Xendit` is the better first fit for this repo:
- this product looks like a Philippines-first business SaaS
- your likely first customers are local businesses with branch operations
- local payment acceptance matters more than global tax automation in phase 1
- Xendit supports subscription payments and is already positioned for the Philippines market

Use `Xendit` if your near-term goal is:
- sell mainly to Philippine or Southeast Asia businesses
- accept local payment methods
- activate subscriptions for local business owners with less checkout friction

Use `Paddle` instead if your real goal becomes:
- sell globally from the start
- reduce VAT/sales-tax/compliance burden
- use a Merchant of Record for SaaS billing

Recommended decision for this project:
- phase 1: `Xendit`
- keep your own internal billing tables
- wrap payment logic behind a billing provider service
- allow adding `Paddle` later without redesigning tenant and subscription tables

Recommended internal tables even when using `Xendit`:
- `subscriptions`
- `subscription_payments`
- `billing_invoices`
- `provider_customers`
- `provider_subscriptions`
- `provider_events`

Recommended architecture:
- your system remains source of truth for tenant activation
- payment provider remains source of truth for payment execution events
- tenant activation happens only after webhook confirmation

Practical guidance:
- do not hardwire tenant activation directly to frontend redirect success
- wait for provider webhook
- mark subscription active in your DB
- then activate tenant and create default admin if not yet provisioned

Later migration path:
- if you outgrow local-first billing and need global SaaS tax handling, add `Paddle` as another provider
- do not couple business rules to Xendit-specific objects in controller code
- isolate provider logic behind a service like `BillingProvider`

### Biggest codebase blockers today

1. Auth bootstrap logic is incompatible with SaaS self-service onboarding.
2. Global settings table is incompatible with tenant branding and per-business config.
3. No tenant context is carried in auth/session/middleware.
4. No branch model exists in schema or code.
5. Existing repositories query tables globally, so every repository layer will need tenant scoping.
6. `react` is an internal admin app, not a public onboarding app.

### Middleware and access enforcement

Yes, you should add subscription enforcement in middleware, separate from role and permission checks.

Recommended middleware order:

1. `authenticate`
2. `resolveTenant`
3. `requireTenantMembership`
4. `requireActiveSubscription`
5. `requirePermission`

Why separate middleware is better:
- auth answers: who is this user
- tenant resolution answers: which business is this request for
- subscription answers: is this tenant allowed to use the app now
- permission answers: can this user perform this action

Recommended subscription rule:
- allow statuses: `active`, `trialing`
- optionally allow `grace_period` if you support grace access
- block statuses: `incomplete`, `past_due`, `cancelled`, `expired`, `suspended`

Recommended product behavior by status:
- `trialing`: full access within plan limits
- `active`: full access within plan limits
- `past_due`: warning state or limited access depending on policy
- `expired`: block write access or block all tenant access
- `cancelled`: access until period end, then follow expired policy
- `suspended`: block immediately

Recommended route usage:
- normal ERP routes:
  - `authenticate -> resolveTenant -> requireActiveSubscription -> requirePermission`
- billing routes:
  - do not fully block these, or the owner cannot renew
  - use `authenticate -> resolveTenant -> requireTenantMembership`
- subdomain availability routes:
  - public or semi-public
  - validate only format, reserved names, and uniqueness
- onboarding routes:
  - public or semi-public, no active subscription required yet
- webhook routes:
  - never use user auth middleware, validate provider signature instead

Recommended response behavior:
- `401` for unauthenticated
- `403` for tenant membership/permission denial
- `402` or `403` for inactive subscription

Practical recommendation for this repo:
- do not merge subscription checks into `requirePermission`
- create a new middleware like `requireActiveSubscription()`
- add dedicated limit checks like `requirePlanFeature()` or `checkPlanLimit()`
- later add `req.auth.tenant`, `req.auth.membership`, and `req.auth.subscription`

### Roles

Recommended separation:
- `platform_super_admin`
  - manages all tenants, plans, payments, system settings
- `tenant_owner`
  - manages business profile, subscription, subdomain, users
- `tenant_admin`
  - manages ERP operations and users
- `staff`
  - limited operational access
- `cashier`
  - sales and payment entry only
- `viewer`
  - read-only access

Important:
- platform roles should not be mixed into tenant role columns
- keep platform admin access separate from tenant membership/tenant permissions

### Recommended implementation order

1. Create platform tables
- `accounts`
- `tenants`
- `tenant_memberships`
- `branches`
- `subscription_plans`
- `subscriptions`
- `subscription_payments`
- `tenant_domains`
- `tenant_onboarding`

2. Introduce tenant context into auth
- login by account
- membership selection if multiple tenants
- inject `tenant_id` into request context

3. Retrofit ERP schema
- add `tenant_id` to all tenant-owned tables
- add `branch_id` to branch-sensitive tables
- backfill existing records into a default tenant and default primary branch

4. Build `web`
- landing
- register
- business info
- plan selection
- payment
- activation status

5. Keep `react` focused on authenticated tenant admin
- dashboard
- branch management
- billing/subscription page

6. Add provisioning flow
- create account
- create tenant
- create primary branch
- create default admin
- activate subscription
- redirect to dashboard

### Practical migration approach for this repo

Because the ERP already has many tables, do not rewrite everything at once.

Start with this compatibility migration:
- create one default tenant from current company data
- create one primary branch for that tenant
- add `tenant_id` to all tables
- set all old records to the default tenant
- add `branch_id` only to the tables you need first

Then update each repository and service module incrementally to enforce tenant filters.
