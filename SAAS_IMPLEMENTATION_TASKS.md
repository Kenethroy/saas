# SaaS Implementation Tasks

## Goal

Convert this monorepo from single-tenant ERP into a SaaS platform with:

- public landing and signup flow
- tenant/business provisioning
- plan-based subscriptions
- payment activation
- multi-branch support per tenant
- tenant-scoped ERP access

Target flow:

1. Landing page
2. Register account
3. Business information setup
4. Choose subscription plan
5. Payment
6. Subscription activated
7. Tenant/business created
8. Default admin created
9. Redirect to dashboard

## Current status

Done already:

- SaaS assessment written in [SAAS_MULTITENANCY_ASSESSMENT.md](/Users/fdc-kennethroy-nc-web/saas/SAAS_MULTITENANCY_ASSESSMENT.md)
- fresh `v2` schema created under [nodejs/sql/v2](/Users/fdc-kennethroy-nc-web/saas/nodejs/sql/v2)
- `migrate-v2.js` added in [nodejs/scripts/migrate-v2.js](/Users/fdc-kennethroy-nc-web/saas/nodejs/scripts/migrate-v2.js)
- tenant bootstrap and provisioning stored procedures added

Still not finished:

- ERP query and module scoping is not tenant-safe yet

## Start here

Start in `api` and database first.

Reason:

- everything else depends on the tenant and subscription model being stable
- `web` cannot submit onboarding if provisioning contracts are not defined
- `react` cannot enforce tenant access if auth/session context is still single-tenant

Immediate first work:

1. make `npm run migrate:v2` pass cleanly
2. validate `sp_seed_tenant_bootstrap_defaults`
3. validate `sp_provision_tenant`
4. create API endpoints for account signup, onboarding, plan selection, and tenant provisioning

## Phase 1: Database foundation

- [x] Fix any remaining `v2` migration issues until a clean fresh run succeeds
- [x] Confirm the database can be recreated from zero with:
  - `DROP DATABASE IF EXISTS saas;`
  - `npm run migrate:v2`
- [x] Validate the following procedures with test data:
  - `sp_seed_tenant_bootstrap_defaults`
  - `sp_provision_tenant`
- [x] Add a small SQL validation checklist for:
  - one starter tenant
  - one pro tenant
  - branch limit behavior
  - default admin creation
  - default branch creation

Primary files:

- [001_create_database.sql](/Users/fdc-kennethroy-nc-web/saas/nodejs/sql/v2/001_create_database.sql)
- [002_create_platform_schema.sql](/Users/fdc-kennethroy-nc-web/saas/nodejs/sql/v2/002_create_platform_schema.sql)
- [003_create_access_and_master_data.sql](/Users/fdc-kennethroy-nc-web/saas/nodejs/sql/v2/003_create_access_and_master_data.sql)
- [004_create_operations_and_finance.sql](/Users/fdc-kennethroy-nc-web/saas/nodejs/sql/v2/004_create_operations_and_finance.sql)
- [006_seed_tenant_bootstrap_defaults.sql](/Users/fdc-kennethroy-nc-web/saas/nodejs/sql/v2/006_seed_tenant_bootstrap_defaults.sql)
- [007_create_tenant_provisioning_procedure.sql](/Users/fdc-kennethroy-nc-web/saas/nodejs/sql/v2/007_create_tenant_provisioning_procedure.sql)
- [migrate-v2.js](/Users/fdc-kennethroy-nc-web/saas/nodejs/scripts/migrate-v2.js)

## Phase 2: API platform layer

- [x] Add global account registration
- [x] Add account login for SaaS onboarding
- [x] Add tenant onboarding endpoints
- [x] Add plan listing endpoint
- [x] Add subscription creation endpoint
- [x] Add payment session/initiation endpoint
- [x] Add webhook endpoint for payment provider
- [x] Add tenant provisioning service that calls `sp_provision_tenant`
- [x] Add tenant domain resolution middleware
- [x] Add tenant membership guard
- [x] Add active subscription guard

Suggested backend modules:

- `src/modules/accounts`
- `src/modules/tenants`
- `src/modules/subscriptions`
- `src/modules/billing`
- `src/modules/domains`
- `src/modules/platform-auth`
- `src/modules/onboarding`

Critical middleware order:

1. `authenticate`
2. `resolveTenant`
3. `requireTenantMembership`
4. `requireActiveSubscription`
5. `requirePermission`

Deliverables:

- [x] `req.auth.account`
- [x] `req.auth.tenant`
- [x] `req.auth.membership`
- [x] `req.auth.subscription`
- [x] billing-safe route exemptions for renewal and webhook routes

## Phase 3: Public `web` app

This repo does not currently have a public `web` app. Create it after the API contracts are stable.

- [x] scaffold new `web` app
- [x] landing page
- [x] register account page
- [x] business info setup page
- [x] plan selection page
- [x] payment page
- [x] onboarding status page
- [x] login redirect page

Required API contracts before starting:

- `POST /platform/accounts/register`
- `POST /platform/auth/login`
- `POST /platform/onboarding/start`
- `GET /platform/plans`
- `POST /platform/subscriptions/checkout`
- `POST /platform/webhooks/stripe`
- `GET /platform/onboarding/:id/status`

## Phase 4: Payment integration

Recommended first provider: `Stripe` (`Xendit` optional later)

- [x] create billing provider abstraction
- [x] add `subscription_plan_prices` catalog and wire checkout to it
- [x] add Stripe customer mapping
- [x] add Stripe subscription creation
- [x] store provider ids in platform billing tables
- [x] implement webhook idempotency using `provider_events`
- [x] activate subscription on successful webhook
- [x] trigger tenant provisioning only after verified payment state

Required tables already present:

- `subscriptions`
- `subscription_payments`
- `billing_invoices`
- `provider_customers`
- `provider_subscriptions`
- `provider_events`

## Phase 5: React tenant app changes

- [x] update auth/session shape to include tenant context
- [x] add current tenant and current branch state
- [x] add branch switcher
- [x] add subscription status UX
- [x] block restricted pages if subscription is inactive
- [x] add tenant settings page
- [x] add billing/subscription page
- [x] add branch management page

Important rule:

- subdomain identifies tenant
- branch is selected inside the app
- do not create one subdomain per branch by default

## Phase 6: ERP query refactor

- [ ] audit every repository/service query for tenant scoping
- [ ] add `tenant_id` filters everywhere required
- [ ] add `branch_id` filters to branch-sensitive modules
- [ ] move stock handling to branch-aware balances
- [ ] make document numbering use `document_sequences`
- [x] tenant-scope master data modules: customers, suppliers, products, categories, payment terms
- [x] tenant-scope customer and supplier payment lookups/writes used by those modules
- [x] tenant-scope sales orders, deliveries, delivery selection, invoice PDF, and fulfillment transaction writes

Highest-risk modules:

- products and inventory
- sales orders
- deliveries
- invoices
- accounts receivable
- purchase orders
- accounts payable
- payments
- expenses
- payslips

## Phase 7: Platform admin

- [ ] create platform admin auth path
- [ ] tenant search/list page
- [ ] plan management page
- [ ] subscription review page
- [ ] manual suspend/reactivate controls
- [ ] domain and onboarding audit view

## Acceptance checklist

- [ ] a new account can register
- [ ] a new business can choose `starter`, `pro`, or `enterprise`
- [ ] payment success activates subscription
- [ ] tenant is provisioned automatically
- [ ] primary branch is created
- [ ] default admin user is created
- [ ] wildcard subdomain resolves to tenant
- [ ] user is redirected into the tenant dashboard
- [ ] starter tenant cannot exceed 1 branch
- [ ] pro tenant cannot exceed 3 branches
- [ ] enterprise tenant can have negotiated branch limits
- [ ] inactive subscription blocks protected ERP routes but still allows billing recovery

## Recommended execution order

1. Finish database migration stability.
2. Build API provisioning and middleware.
3. Build payment webhook flow.
4. Build public `web` onboarding app.
5. Update `react` for tenant-aware auth and branch context.
6. Refactor ERP modules for tenant and branch scoping.
7. Add platform admin tooling.

## If you want the fastest safe start

Work on these in order:

1. [migrate-v2.js](/Users/fdc-kennethroy-nc-web/saas/nodejs/scripts/migrate-v2.js)
2. [006_seed_tenant_bootstrap_defaults.sql](/Users/fdc-kennethroy-nc-web/saas/nodejs/sql/v2/006_seed_tenant_bootstrap_defaults.sql)
3. [007_create_tenant_provisioning_procedure.sql](/Users/fdc-kennethroy-nc-web/saas/nodejs/sql/v2/007_create_tenant_provisioning_procedure.sql)
4. create `platform-auth`, `tenants`, `subscriptions`, and `billing` API modules
5. create the public `web` app
