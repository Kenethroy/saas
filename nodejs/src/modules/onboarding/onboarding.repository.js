import { AppError } from "#shared/utils/app-error";
import { query } from "#shared/database/mysql";

function normalizeOnboardingStatus(row) {
  if (!row) {
    return null;
  }

  return {
    id: Number(row.id),
    accountId: Number(row.account_id),
    tenantId: row.tenant_id ? Number(row.tenant_id) : null,
    preferredSubdomain: row.preferred_subdomain,
    currentStep: row.current_step,
    businessInfoCompletedAt: row.business_info_completed_at,
    planSelectedAt: row.plan_selected_at,
    paymentCompletedAt: row.payment_completed_at,
    webhookConfirmedAt: row.webhook_confirmed_at,
    tenantCreatedAt: row.tenant_created_at,
    adminCreatedAt: row.admin_created_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    tenant: row.tenant_id
      ? {
          id: Number(row.tenant_id),
          name: row.tenant_name,
          status: row.tenant_status,
          subscriptionStatus: row.tenant_subscription_status,
          domain: row.tenant_domain,
          subdomain: row.tenant_subdomain
        }
      : null,
    subscription: row.subscription_id
      ? {
          id: Number(row.subscription_id),
          status: row.subscription_status,
          billingCycle: row.billing_cycle,
          planCode: row.plan_code,
          planName: row.plan_name
        }
      : null
  };
}

export class OnboardingRepository {
  async ensureOnboardingRecord(accountId) {
    await query(
      `
        INSERT INTO tenant_onboarding (
          account_id,
          current_step
        )
        VALUES (?, 'account')
        ON DUPLICATE KEY UPDATE
          updated_at = NOW()
      `,
      [accountId]
    );
  }

  async assertSubdomainAvailable(subdomain) {
    const normalized = String(subdomain ?? "").trim().toLowerCase();

    if (!normalized) {
      throw new AppError("Preferred subdomain is required", 422);
    }

    if (!/^[a-z0-9-]{3,50}$/.test(normalized)) {
      throw new AppError("Preferred subdomain format is invalid", 422);
    }

    const reservedRows = await query(
      `
        SELECT 1
        FROM app_reserved_subdomains
        WHERE name = ?
        LIMIT 1
      `,
      [normalized]
    );

    if (reservedRows.length > 0) {
      throw new AppError("Preferred subdomain is reserved", 409);
    }

    const domainRows = await query(
      `
        SELECT 1
        FROM tenant_domains
        WHERE subdomain = ?
        LIMIT 1
      `,
      [normalized]
    );

    if (domainRows.length > 0) {
      throw new AppError("Preferred subdomain already exists", 409);
    }
  }

  async start(accountId, preferredSubdomain) {
    await this.assertSubdomainAvailable(preferredSubdomain);

    await query(
      `
        INSERT INTO tenant_onboarding (
          account_id,
          preferred_subdomain,
          current_step,
          business_info_completed_at
        )
        VALUES (?, ?, 'plan', NOW())
        ON DUPLICATE KEY UPDATE
          preferred_subdomain = VALUES(preferred_subdomain),
          current_step = CASE
            WHEN current_step = 'completed' THEN current_step
            ELSE 'plan'
          END,
          business_info_completed_at = COALESCE(business_info_completed_at, NOW()),
          updated_at = NOW()
      `,
      [accountId, String(preferredSubdomain).trim().toLowerCase()]
    );
  }

  async markPlanSelectedAndAwaitingPayment(accountId, preferredSubdomain) {
    await query(
      `
        UPDATE tenant_onboarding
        SET
          preferred_subdomain = COALESCE(?, preferred_subdomain),
          current_step = CASE
            WHEN current_step = 'completed' THEN current_step
            ELSE 'payment'
          END,
          plan_selected_at = COALESCE(plan_selected_at, NOW()),
          updated_at = NOW()
        WHERE account_id = ?
      `,
      [preferredSubdomain ? String(preferredSubdomain).trim().toLowerCase() : null, accountId]
    );
  }

  async markPaymentConfirmed(accountId) {
    await query(
      `
        UPDATE tenant_onboarding
        SET
          current_step = CASE
            WHEN current_step = 'completed' THEN current_step
            ELSE 'activation'
          END,
          payment_completed_at = COALESCE(payment_completed_at, NOW()),
          webhook_confirmed_at = COALESCE(webhook_confirmed_at, NOW()),
          updated_at = NOW()
        WHERE account_id = ?
      `,
      [accountId]
    );
  }

  async findStatusByAccountId(accountId) {
    const rows = await query(
      `
        SELECT
          o.*,
          t.name AS tenant_name,
          t.status AS tenant_status,
          t.subscription_status AS tenant_subscription_status,
          td.domain AS tenant_domain,
          td.subdomain AS tenant_subdomain,
          s.id AS subscription_id,
          s.status AS subscription_status,
          s.billing_cycle,
          p.code AS plan_code,
          p.name AS plan_name
        FROM tenant_onboarding o
        LEFT JOIN tenants t
          ON t.id = o.tenant_id
        LEFT JOIN tenant_domains td
          ON td.tenant_id = t.id
         AND td.is_primary = 1
        LEFT JOIN subscriptions s
          ON s.id = (
            SELECT s2.id
            FROM subscriptions s2
            WHERE s2.tenant_id = t.id
            ORDER BY s2.created_at DESC, s2.id DESC
            LIMIT 1
          )
        LEFT JOIN subscription_plans p
          ON p.id = s.plan_id
        WHERE o.account_id = ?
        LIMIT 1
      `,
      [accountId]
    );

    return normalizeOnboardingStatus(rows[0]);
  }

  async findStatusByIdForAccount(onboardingId, accountId) {
    const rows = await query(
      `
        SELECT
          o.*,
          t.name AS tenant_name,
          t.status AS tenant_status,
          t.subscription_status AS tenant_subscription_status,
          td.domain AS tenant_domain,
          td.subdomain AS tenant_subdomain,
          s.id AS subscription_id,
          s.status AS subscription_status,
          s.billing_cycle,
          p.code AS plan_code,
          p.name AS plan_name
        FROM tenant_onboarding o
        LEFT JOIN tenants t
          ON t.id = o.tenant_id
        LEFT JOIN tenant_domains td
          ON td.tenant_id = t.id
         AND td.is_primary = 1
        LEFT JOIN subscriptions s
          ON s.id = (
            SELECT s2.id
            FROM subscriptions s2
            WHERE s2.tenant_id = t.id
            ORDER BY s2.created_at DESC, s2.id DESC
            LIMIT 1
          )
        LEFT JOIN subscription_plans p
          ON p.id = s.plan_id
        WHERE o.id = ?
          AND o.account_id = ?
        LIMIT 1
      `,
      [onboardingId, accountId]
    );

    return normalizeOnboardingStatus(rows[0]);
  }
}
