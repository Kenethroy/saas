import { query, transaction } from "#shared/database/mysql";

function mapTenant(row) {
  return {
    id: Number(row.id),
    uuid: row.uuid,
    slug: row.slug,
    name: row.name,
    legalName: row.legal_name,
    businessType: row.business_type,
    email: row.email,
    phone: row.phone,
    timezone: row.timezone,
    currencyCode: row.currency_code,
    status: row.status,
    subscriptionStatus: row.subscription_status,
    primaryOwnerAccountId: row.primary_owner_account_id === null ? null : Number(row.primary_owner_account_id),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function normalizePlan(row) {
  return {
    id: Number(row.id),
    code: row.code,
    name: row.name,
    description: row.description,
    priceMonthly: row.price_monthly === null ? null : Number(row.price_monthly),
    priceYearly: row.price_yearly === null ? null : Number(row.price_yearly),
    maxBranches: row.max_branches === null ? null : Number(row.max_branches),
    maxUsers: row.max_users === null ? null : Number(row.max_users),
    maxProducts: row.max_products === null ? null : Number(row.max_products),
    maxStorageGb: row.max_storage_gb === null ? null : Number(row.max_storage_gb),
    allowReports: Boolean(row.allow_reports),
    allowBackup: Boolean(row.allow_backup),
    allowApiAccess: Boolean(row.allow_api_access),
    allowMultiBranch: Boolean(row.allow_multi_branch),
    isActive: Boolean(row.is_active),
    prices: []
  };
}

function normalizePlanPrice(row) {
  return {
    id: Number(row.plan_price_id),
    planId: Number(row.id),
    code: row.plan_price_code,
    name: row.plan_price_name,
    description: row.plan_price_description,
    checkoutMode: row.checkout_mode,
    billingIntervalUnit: row.billing_interval_unit,
    billingIntervalCount: Number(row.billing_interval_count),
    price: row.price === null ? null : Number(row.price),
    currencyCode: row.currency_code,
    providerPriceId: row.provider_price_id,
    isActive: Boolean(row.plan_price_is_active)
  };
}

function mapSubscriptionReview(row) {
  const effectiveStatus = row.subscription_status ?? row.tenant_subscription_status ?? "incomplete";

  return {
    tenant: {
      id: Number(row.tenant_id),
      uuid: row.tenant_uuid,
      slug: row.tenant_slug,
      name: row.tenant_name,
      status: row.tenant_status,
      subscriptionStatus: row.tenant_subscription_status,
      domain: row.tenant_domain,
      subdomain: row.tenant_subdomain
    },
    subscription: row.subscription_id
      ? {
          id: Number(row.subscription_id),
          status: row.subscription_status,
          effectiveStatus,
          provider: row.subscription_provider,
          providerSubscriptionId: row.provider_subscription_id,
          billingCycle: row.billing_cycle,
          startedAt: row.started_at,
          currentPeriodStart: row.current_period_start,
          currentPeriodEnd: row.current_period_end,
          cancelAtPeriodEnd: Boolean(row.cancel_at_period_end),
          cancelledAt: row.cancelled_at
        }
      : null,
    plan: row.plan_id
      ? {
          id: Number(row.plan_id),
          code: row.plan_code,
          name: row.plan_name
        }
      : null,
    planPrice: row.plan_price_id
      ? {
          id: Number(row.plan_price_id),
          code: row.plan_price_code,
          name: row.plan_price_name,
          price: row.plan_price_value === null ? null : Number(row.plan_price_value),
          currencyCode: row.plan_price_currency_code,
          billingIntervalUnit: row.billing_interval_unit,
          billingIntervalCount: row.billing_interval_count === null ? null : Number(row.billing_interval_count)
        }
      : null,
    latestInvoice: row.latest_invoice_id
      ? {
          id: Number(row.latest_invoice_id),
          invoiceNumber: row.latest_invoice_number,
          amountDue: Number(row.latest_invoice_amount_due),
          amountPaid: Number(row.latest_invoice_amount_paid),
          currency: row.latest_invoice_currency,
          status: row.latest_invoice_status,
          dueAt: row.latest_invoice_due_at,
          paidAt: row.latest_invoice_paid_at
        }
      : null,
    latestPayment: row.latest_payment_id
      ? {
          id: Number(row.latest_payment_id),
          provider: row.latest_payment_provider,
          providerPaymentId: row.latest_payment_provider_payment_id,
          providerReference: row.latest_payment_provider_reference,
          amount: Number(row.latest_payment_amount),
          currency: row.latest_payment_currency,
          status: row.latest_payment_status,
          paidAt: row.latest_payment_paid_at
        }
      : null,
    recoveryEligible: !["active", "trialing"].includes(effectiveStatus)
  };
}

function parseJsonColumn(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function mapOnboardingAudit(row) {
  return {
    onboarding: {
      id: Number(row.onboarding_id),
      accountId: Number(row.account_id),
      tenantId: row.tenant_id === null ? null : Number(row.tenant_id),
      preferredSubdomain: row.preferred_subdomain,
      currentStep: row.current_step,
      businessInfoCompletedAt: row.business_info_completed_at,
      planSelectedAt: row.plan_selected_at,
      paymentCompletedAt: row.payment_completed_at,
      webhookConfirmedAt: row.webhook_confirmed_at,
      tenantCreatedAt: row.tenant_created_at,
      adminCreatedAt: row.admin_created_at,
      completedAt: row.completed_at,
      createdAt: row.onboarding_created_at,
      updatedAt: row.onboarding_updated_at
    },
    account: {
      id: Number(row.account_id),
      email: row.account_email,
      firstName: row.account_first_name,
      lastName: row.account_last_name,
      status: row.account_status
    },
    tenant: row.tenant_id === null
      ? null
      : {
          id: Number(row.tenant_id),
          uuid: row.tenant_uuid,
          slug: row.tenant_slug,
          name: row.tenant_name,
          status: row.tenant_status,
          subscriptionStatus: row.tenant_subscription_status
        },
    primaryDomain: row.tenant_domain_id === null
      ? null
      : {
          id: Number(row.tenant_domain_id),
          domain: row.tenant_domain,
          subdomain: row.tenant_subdomain,
          type: row.tenant_domain_type,
          status: row.tenant_domain_status,
          verificationToken: row.tenant_domain_verification_token,
          verifiedAt: row.tenant_domain_verified_at
        },
    subscription: row.subscription_id === null
      ? null
      : {
          id: Number(row.subscription_id),
          provider: row.subscription_provider,
          status: row.subscription_status,
          billingCycle: row.billing_cycle,
          currentPeriodEnd: row.current_period_end,
          planCode: row.plan_code,
          planName: row.plan_name
        },
    latestProviderEvent: row.provider_event_id === null
      ? null
      : {
          id: Number(row.provider_event_id),
          provider: row.provider_event_provider,
          eventId: row.provider_event_key,
          eventType: row.provider_event_type,
          status: row.provider_event_status,
          processedAt: row.provider_event_processed_at,
          createdAt: row.provider_event_created_at
        }
  };
}

const planSelectSql = `
  SELECT
    p.*,
    pp.id AS plan_price_id,
    pp.code AS plan_price_code,
    pp.name AS plan_price_name,
    pp.description AS plan_price_description,
    pp.checkout_mode,
    pp.billing_interval_unit,
    pp.billing_interval_count,
    pp.price,
    pp.currency_code,
    pp.provider_price_id,
    pp.is_active AS plan_price_is_active
  FROM subscription_plans p
  LEFT JOIN subscription_plan_prices pp
    ON pp.plan_id = p.id
`;

function mapPlans(rows) {
  const plans = new Map();

  for (const row of rows ?? []) {
    if (!plans.has(row.id)) {
      plans.set(row.id, normalizePlan(row));
    }

    const plan = plans.get(row.id);
    if (row.plan_price_id) {
      plan.prices.push(normalizePlanPrice(row));
    }
  }

  return [...plans.values()];
}

export class PlatformAdminRepository {
  async countTenants(filters) {
    const where = [];
    const params = [];

    if (filters?.q) {
      where.push("(t.name LIKE ? OR t.slug LIKE ? OR t.uuid LIKE ?)");
      const needle = `%${filters.q}%`;
      params.push(needle, needle, needle);
    }

    if (filters?.status) {
      where.push("t.status = ?");
      params.push(filters.status);
    }

    if (filters?.subscriptionStatus) {
      where.push("t.subscription_status = ?");
      params.push(filters.subscriptionStatus);
    }

    const rows = await query(
      `
        SELECT COUNT(*) AS total
        FROM tenants t
        ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      `,
      params
    );

    return Number(rows?.[0]?.total ?? 0);
  }

  async listTenants(filters, paging) {
    const where = [];
    const params = [];

    if (filters?.q) {
      where.push("(t.name LIKE ? OR t.slug LIKE ? OR t.uuid LIKE ?)");
      const needle = `%${filters.q}%`;
      params.push(needle, needle, needle);
    }

    if (filters?.status) {
      where.push("t.status = ?");
      params.push(filters.status);
    }

    if (filters?.subscriptionStatus) {
      where.push("t.subscription_status = ?");
      params.push(filters.subscriptionStatus);
    }

    const offset = (paging.page - 1) * paging.perPage;
    params.push(paging.perPage, offset);

    const rows = await query(
      `
        SELECT
          t.id,
          t.uuid,
          t.slug,
          t.name,
          t.legal_name,
          t.business_type,
          t.email,
          t.phone,
          t.timezone,
          t.currency_code,
          t.status,
          t.subscription_status,
          t.primary_owner_account_id,
          t.created_at,
          t.updated_at
        FROM tenants t
        ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
        ORDER BY t.created_at DESC, t.id DESC
        LIMIT ?
        OFFSET ?
      `,
      params
    );

    return (rows ?? []).map(mapTenant);
  }

  async countSubscriptionReviews(filters) {
    const where = [];
    const params = [];

    if (filters?.q) {
      where.push("(t.name LIKE ? OR t.slug LIKE ? OR td.domain LIKE ? OR s.provider_subscription_id LIKE ?)");
      const needle = `%${filters.q}%`;
      params.push(needle, needle, needle, needle);
    }

    if (filters?.status) {
      where.push("COALESCE(s.status, t.subscription_status) = ?");
      params.push(filters.status);
    }

    if (filters?.tenantStatus) {
      where.push("t.status = ?");
      params.push(filters.tenantStatus);
    }

    if (filters?.provider) {
      where.push("s.provider = ?");
      params.push(filters.provider);
    }

    if (filters?.planCode) {
      where.push("p.code = ?");
      params.push(filters.planCode);
    }

    const rows = await query(
      `
        SELECT COUNT(*) AS total
        FROM tenants t
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
        ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      `,
      params
    );

    return Number(rows?.[0]?.total ?? 0);
  }

  async listSubscriptionReviews(filters, paging) {
    const where = [];
    const params = [];

    if (filters?.q) {
      where.push("(t.name LIKE ? OR t.slug LIKE ? OR td.domain LIKE ? OR s.provider_subscription_id LIKE ?)");
      const needle = `%${filters.q}%`;
      params.push(needle, needle, needle, needle);
    }

    if (filters?.status) {
      where.push("COALESCE(s.status, t.subscription_status) = ?");
      params.push(filters.status);
    }

    if (filters?.tenantStatus) {
      where.push("t.status = ?");
      params.push(filters.tenantStatus);
    }

    if (filters?.provider) {
      where.push("s.provider = ?");
      params.push(filters.provider);
    }

    if (filters?.planCode) {
      where.push("p.code = ?");
      params.push(filters.planCode);
    }

    const offset = (paging.page - 1) * paging.perPage;
    params.push(paging.perPage, offset);

    const rows = await query(
      `
        SELECT
          t.id AS tenant_id,
          t.uuid AS tenant_uuid,
          t.slug AS tenant_slug,
          t.name AS tenant_name,
          t.status AS tenant_status,
          t.subscription_status AS tenant_subscription_status,
          td.domain AS tenant_domain,
          td.subdomain AS tenant_subdomain,
          s.id AS subscription_id,
          s.plan_id,
          s.plan_price_id,
          s.provider AS subscription_provider,
          s.provider_subscription_id,
          s.status AS subscription_status,
          s.billing_cycle,
          s.started_at,
          s.current_period_start,
          s.current_period_end,
          s.cancel_at_period_end,
          s.cancelled_at,
          p.code AS plan_code,
          p.name AS plan_name,
          pp.code AS plan_price_code,
          pp.name AS plan_price_name,
          pp.price AS plan_price_value,
          pp.currency_code AS plan_price_currency_code,
          pp.billing_interval_unit,
          pp.billing_interval_count,
          bi.id AS latest_invoice_id,
          bi.invoice_number AS latest_invoice_number,
          bi.amount_due AS latest_invoice_amount_due,
          bi.amount_paid AS latest_invoice_amount_paid,
          bi.currency AS latest_invoice_currency,
          bi.status AS latest_invoice_status,
          bi.due_at AS latest_invoice_due_at,
          bi.paid_at AS latest_invoice_paid_at,
          sp.id AS latest_payment_id,
          sp.provider AS latest_payment_provider,
          sp.provider_payment_id AS latest_payment_provider_payment_id,
          sp.provider_reference AS latest_payment_provider_reference,
          sp.amount AS latest_payment_amount,
          sp.currency AS latest_payment_currency,
          sp.status AS latest_payment_status,
          sp.paid_at AS latest_payment_paid_at
        FROM tenants t
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
        LEFT JOIN subscription_plan_prices pp
          ON pp.id = s.plan_price_id
        LEFT JOIN billing_invoices bi
          ON bi.id = (
            SELECT bi2.id
            FROM billing_invoices bi2
            WHERE bi2.tenant_id = t.id
            ORDER BY bi2.created_at DESC, bi2.id DESC
            LIMIT 1
          )
        LEFT JOIN subscription_payments sp
          ON sp.id = (
            SELECT sp2.id
            FROM subscription_payments sp2
            WHERE sp2.tenant_id = t.id
            ORDER BY sp2.created_at DESC, sp2.id DESC
            LIMIT 1
          )
        ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
        ORDER BY
          COALESCE(s.current_period_end, s.created_at, t.updated_at, t.created_at) DESC,
          t.id DESC
        LIMIT ?
        OFFSET ?
      `,
      params
    );

    return (rows ?? []).map(mapSubscriptionReview);
  }

  async countOnboardingAudits(filters) {
    const where = [];
    const params = [];

    if (filters?.q) {
      where.push("(a.email LIKE ? OR o.preferred_subdomain LIKE ? OR t.name LIKE ? OR t.slug LIKE ? OR td.domain LIKE ?)");
      const needle = `%${filters.q}%`;
      params.push(needle, needle, needle, needle, needle);
    }

    if (filters?.currentStep) {
      where.push("o.current_step = ?");
      params.push(filters.currentStep);
    }

    if (filters?.tenantStatus) {
      where.push("t.status = ?");
      params.push(filters.tenantStatus);
    }

    if (filters?.domainStatus) {
      where.push("td.status = ?");
      params.push(filters.domainStatus);
    }

    const rows = await query(
      `
        SELECT COUNT(*) AS total
        FROM tenant_onboarding o
        JOIN accounts a
          ON a.id = o.account_id
        LEFT JOIN tenants t
          ON t.id = o.tenant_id
        LEFT JOIN tenant_domains td
          ON td.tenant_id = t.id
         AND td.is_primary = 1
        ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      `,
      params
    );

    return Number(rows?.[0]?.total ?? 0);
  }

  async listOnboardingAudits(filters, paging) {
    const where = [];
    const params = [];

    if (filters?.q) {
      where.push("(a.email LIKE ? OR o.preferred_subdomain LIKE ? OR t.name LIKE ? OR t.slug LIKE ? OR td.domain LIKE ?)");
      const needle = `%${filters.q}%`;
      params.push(needle, needle, needle, needle, needle);
    }

    if (filters?.currentStep) {
      where.push("o.current_step = ?");
      params.push(filters.currentStep);
    }

    if (filters?.tenantStatus) {
      where.push("t.status = ?");
      params.push(filters.tenantStatus);
    }

    if (filters?.domainStatus) {
      where.push("td.status = ?");
      params.push(filters.domainStatus);
    }

    const offset = (paging.page - 1) * paging.perPage;
    params.push(paging.perPage, offset);

    const rows = await query(
      `
        SELECT
          o.id AS onboarding_id,
          o.account_id,
          o.tenant_id,
          o.preferred_subdomain,
          o.current_step,
          o.business_info_completed_at,
          o.plan_selected_at,
          o.payment_completed_at,
          o.webhook_confirmed_at,
          o.tenant_created_at,
          o.admin_created_at,
          o.completed_at,
          o.created_at AS onboarding_created_at,
          o.updated_at AS onboarding_updated_at,
          a.email AS account_email,
          a.first_name AS account_first_name,
          a.last_name AS account_last_name,
          a.status AS account_status,
          t.uuid AS tenant_uuid,
          t.slug AS tenant_slug,
          t.name AS tenant_name,
          t.status AS tenant_status,
          t.subscription_status AS tenant_subscription_status,
          td.id AS tenant_domain_id,
          td.domain AS tenant_domain,
          td.subdomain AS tenant_subdomain,
          td.type AS tenant_domain_type,
          td.status AS tenant_domain_status,
          td.verification_token AS tenant_domain_verification_token,
          td.verified_at AS tenant_domain_verified_at,
          s.id AS subscription_id,
          s.provider AS subscription_provider,
          s.status AS subscription_status,
          s.billing_cycle,
          s.current_period_end,
          p.code AS plan_code,
          p.name AS plan_name,
          pe.id AS provider_event_id,
          pe.provider AS provider_event_provider,
          pe.event_id AS provider_event_key,
          pe.event_type AS provider_event_type,
          pe.status AS provider_event_status,
          pe.processed_at AS provider_event_processed_at,
          pe.created_at AS provider_event_created_at
        FROM tenant_onboarding o
        JOIN accounts a
          ON a.id = o.account_id
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
        LEFT JOIN provider_events pe
          ON pe.id = (
            SELECT pe2.id
            FROM provider_events pe2
            WHERE (
              (t.id IS NOT NULL AND pe2.tenant_id = t.id)
              OR JSON_UNQUOTE(JSON_EXTRACT(pe2.payload_json, '$.accountId')) = CAST(o.account_id AS CHAR)
            )
            ORDER BY pe2.created_at DESC, pe2.id DESC
            LIMIT 1
          )
        ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
        ORDER BY o.updated_at DESC, o.id DESC
        LIMIT ?
        OFFSET ?
      `,
      params
    );

    return (rows ?? []).map(mapOnboardingAudit);
  }

  async findOnboardingAuditById(onboardingId) {
    const rows = await query(
      `
        SELECT
          o.id AS onboarding_id,
          o.account_id,
          o.tenant_id,
          o.preferred_subdomain,
          o.current_step,
          o.business_info_completed_at,
          o.plan_selected_at,
          o.payment_completed_at,
          o.webhook_confirmed_at,
          o.tenant_created_at,
          o.admin_created_at,
          o.completed_at,
          o.created_at AS onboarding_created_at,
          o.updated_at AS onboarding_updated_at,
          a.email AS account_email,
          a.first_name AS account_first_name,
          a.last_name AS account_last_name,
          a.status AS account_status,
          t.uuid AS tenant_uuid,
          t.slug AS tenant_slug,
          t.name AS tenant_name,
          t.status AS tenant_status,
          t.subscription_status AS tenant_subscription_status,
          td.id AS tenant_domain_id,
          td.domain AS tenant_domain,
          td.subdomain AS tenant_subdomain,
          td.type AS tenant_domain_type,
          td.status AS tenant_domain_status,
          td.verification_token AS tenant_domain_verification_token,
          td.verified_at AS tenant_domain_verified_at,
          s.id AS subscription_id,
          s.provider AS subscription_provider,
          s.status AS subscription_status,
          s.billing_cycle,
          s.current_period_end,
          p.code AS plan_code,
          p.name AS plan_name,
          pe.id AS provider_event_id,
          pe.provider AS provider_event_provider,
          pe.event_id AS provider_event_key,
          pe.event_type AS provider_event_type,
          pe.status AS provider_event_status,
          pe.processed_at AS provider_event_processed_at,
          pe.created_at AS provider_event_created_at
        FROM tenant_onboarding o
        JOIN accounts a
          ON a.id = o.account_id
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
        LEFT JOIN provider_events pe
          ON pe.id = (
            SELECT pe2.id
            FROM provider_events pe2
            WHERE (
              (t.id IS NOT NULL AND pe2.tenant_id = t.id)
              OR JSON_UNQUOTE(JSON_EXTRACT(pe2.payload_json, '$.accountId')) = CAST(o.account_id AS CHAR)
            )
            ORDER BY pe2.created_at DESC, pe2.id DESC
            LIMIT 1
          )
        WHERE o.id = ?
        LIMIT 1
      `,
      [onboardingId]
    );

    const summary = rows?.[0] ? mapOnboardingAudit(rows[0]) : null;
    if (!summary) {
      return null;
    }

    const tenantId = summary.onboarding.tenantId;
    const accountId = summary.onboarding.accountId;

    const domains = tenantId
      ? await query(
          `
            SELECT
              id,
              domain,
              subdomain,
              type,
              is_primary,
              status,
              verification_token,
              verified_at,
              created_at,
              updated_at
            FROM tenant_domains
            WHERE tenant_id = ?
            ORDER BY is_primary DESC, id ASC
          `,
          [tenantId]
        )
      : [];

    const subdomainHistory = tenantId
      ? await query(
          `
            SELECT
              h.id,
              h.old_subdomain,
              h.new_subdomain,
              h.changed_by_account_id,
              h.changed_at,
              a.email AS changed_by_email
            FROM tenant_subdomain_history h
            LEFT JOIN accounts a
              ON a.id = h.changed_by_account_id
            WHERE h.tenant_id = ?
            ORDER BY h.changed_at DESC, h.id DESC
          `,
          [tenantId]
        )
      : [];

    const providerEvents = await query(
      `
        SELECT
          id,
          provider,
          event_id,
          event_type,
          tenant_id,
          subscription_id,
          payload_json,
          processed_at,
          status,
          created_at
        FROM provider_events
        WHERE (
          (? IS NOT NULL AND tenant_id = ?)
          OR JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.accountId')) = CAST(? AS CHAR)
        )
        ORDER BY created_at DESC, id DESC
        LIMIT 20
      `,
      [tenantId, tenantId, accountId]
    );

    return {
      ...summary,
      domains: domains.map((row) => ({
        id: Number(row.id),
        domain: row.domain,
        subdomain: row.subdomain,
        type: row.type,
        isPrimary: Boolean(row.is_primary),
        status: row.status,
        verificationToken: row.verification_token,
        verifiedAt: row.verified_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      })),
      subdomainHistory: subdomainHistory.map((row) => ({
        id: Number(row.id),
        oldSubdomain: row.old_subdomain,
        newSubdomain: row.new_subdomain,
        changedByAccountId: row.changed_by_account_id === null ? null : Number(row.changed_by_account_id),
        changedByEmail: row.changed_by_email,
        changedAt: row.changed_at
      })),
      recentProviderEvents: providerEvents.map((row) => ({
        id: Number(row.id),
        provider: row.provider,
        eventId: row.event_id,
        eventType: row.event_type,
        tenantId: row.tenant_id === null ? null : Number(row.tenant_id),
        subscriptionId: row.subscription_id === null ? null : Number(row.subscription_id),
        payload: parseJsonColumn(row.payload_json),
        processedAt: row.processed_at,
        status: row.status,
        createdAt: row.created_at
      }))
    };
  }

  async listPlans() {
    const rows = await query(
      `
        ${planSelectSql}
        ORDER BY
          CASE p.code
            WHEN 'starter' THEN 1
            WHEN 'pro' THEN 2
            WHEN 'enterprise' THEN 3
            ELSE 99
          END,
          p.id ASC,
          CASE
            WHEN pp.billing_interval_unit = 'month' THEN 1
            WHEN pp.billing_interval_unit = 'year' AND pp.billing_interval_count = 1 THEN 2
            WHEN pp.billing_interval_unit = 'year' AND pp.billing_interval_count = 2 THEN 3
            WHEN pp.billing_interval_unit = 'year' AND pp.billing_interval_count = 4 THEN 4
            ELSE 99
          END,
          pp.id ASC
      `
    );

    return mapPlans(rows);
  }

  async findPlanById(planId) {
    const rows = await query(
      `
        ${planSelectSql}
        WHERE p.id = ?
        ORDER BY
          CASE
            WHEN pp.billing_interval_unit = 'month' THEN 1
            WHEN pp.billing_interval_unit = 'year' AND pp.billing_interval_count = 1 THEN 2
            WHEN pp.billing_interval_unit = 'year' AND pp.billing_interval_count = 2 THEN 3
            WHEN pp.billing_interval_unit = 'year' AND pp.billing_interval_count = 4 THEN 4
            ELSE 99
          END,
          pp.id ASC
      `,
      [planId]
    );

    return mapPlans(rows)[0] ?? null;
  }

  async updatePlan(planId, updates) {
    const fields = [];
    const params = [];

    const mapping = new Map([
      ["name", "name"],
      ["description", "description"],
      ["priceMonthly", "price_monthly"],
      ["priceYearly", "price_yearly"],
      ["maxBranches", "max_branches"],
      ["maxUsers", "max_users"],
      ["maxProducts", "max_products"],
      ["maxStorageGb", "max_storage_gb"],
      ["allowReports", "allow_reports"],
      ["allowBackup", "allow_backup"],
      ["allowApiAccess", "allow_api_access"],
      ["allowMultiBranch", "allow_multi_branch"],
      ["isActive", "is_active"]
    ]);

    for (const [key, column] of mapping.entries()) {
      if (!(key in updates)) {
        continue;
      }

      fields.push(`${column} = ?`);
      if (["allowReports", "allowBackup", "allowApiAccess", "allowMultiBranch", "isActive"].includes(key)) {
        params.push(updates[key] ? 1 : 0);
      } else {
        params.push(updates[key]);
      }
    }

    if (!fields.length) {
      return this.findPlanById(planId);
    }

    const result = await query(
      `
        UPDATE subscription_plans
        SET ${fields.join(", ")}
        WHERE id = ?
      `,
      [...params, planId]
    );

    if (!result?.affectedRows) {
      return null;
    }

    return this.findPlanById(planId);
  }

  async findPlanPriceById(priceId) {
    const rows = await query(
      `
        SELECT
          pp.id AS plan_price_id,
          pp.plan_id,
          pp.code AS plan_price_code,
          pp.name AS plan_price_name,
          pp.description AS plan_price_description,
          pp.checkout_mode,
          pp.billing_interval_unit,
          pp.billing_interval_count,
          pp.price,
          pp.currency_code,
          pp.provider_price_id,
          pp.is_active AS plan_price_is_active
        FROM subscription_plan_prices pp
        WHERE pp.id = ?
        LIMIT 1
      `,
      [priceId]
    );

    const row = rows?.[0];
    if (!row) {
      return null;
    }

    return {
      id: Number(row.plan_price_id),
      planId: Number(row.plan_id),
      code: row.plan_price_code,
      name: row.plan_price_name,
      description: row.plan_price_description,
      checkoutMode: row.checkout_mode,
      billingIntervalUnit: row.billing_interval_unit,
      billingIntervalCount: Number(row.billing_interval_count),
      price: row.price === null ? null : Number(row.price),
      currencyCode: row.currency_code,
      providerPriceId: row.provider_price_id,
      isActive: Boolean(row.plan_price_is_active)
    };
  }

  async updatePlanPrice(priceId, updates) {
    const fields = [];
    const params = [];

    const mapping = new Map([
      ["name", "name"],
      ["description", "description"],
      ["checkoutMode", "checkout_mode"],
      ["price", "price"],
      ["providerPriceId", "provider_price_id"],
      ["isActive", "is_active"]
    ]);

    for (const [key, column] of mapping.entries()) {
      if (!(key in updates)) {
        continue;
      }

      fields.push(`${column} = ?`);
      if (key === "isActive") {
        params.push(updates[key] ? 1 : 0);
      } else {
        params.push(updates[key]);
      }
    }

    if (!fields.length) {
      return this.findPlanPriceById(priceId);
    }

    const result = await query(
      `
        UPDATE subscription_plan_prices
        SET ${fields.join(", ")}
        WHERE id = ?
      `,
      [...params, priceId]
    );

    if (!result?.affectedRows) {
      return null;
    }

    return this.findPlanPriceById(priceId);
  }

  async setTenantSubscriptionAccess(tenantId, payload) {
    return transaction(async (tx) => {
      const [tenantRows] = await tx.execute(
        `
          SELECT id
          FROM tenants
          WHERE id = ?
          LIMIT 1
        `,
        [tenantId]
      );

      if (!Array.isArray(tenantRows) || tenantRows.length === 0) {
        return null;
      }

      const [subscriptionRows] = await tx.execute(
        `
          SELECT id
          FROM subscriptions
          WHERE tenant_id = ?
          ORDER BY created_at DESC, id DESC
          LIMIT 1
        `,
        [tenantId]
      );

      if (!Array.isArray(subscriptionRows) || subscriptionRows.length === 0) {
        return {
          tenantExists: true,
          subscriptionExists: false
        };
      }

      const subscriptionId = Number(subscriptionRows[0].id);
      const isReactivate = payload.action === "reactivate";
      const tenantStatus = isReactivate ? "active" : "suspended";
      const subscriptionStatus = isReactivate ? "active" : "suspended";
      const providerStatus = isReactivate ? "active" : "suspended";
      const domainStatus = isReactivate ? "active" : null;

      await tx.execute(
        `
          UPDATE tenants
          SET
            status = ?,
            subscription_status = ?
          WHERE id = ?
        `,
        [tenantStatus, subscriptionStatus, tenantId]
      );

      await tx.execute(
        `
          UPDATE subscriptions
          SET
            status = ?,
            cancel_at_period_end = CASE
              WHEN ? = 'reactivate' THEN 0
              ELSE cancel_at_period_end
            END,
            cancelled_at = CASE
              WHEN ? = 'reactivate' THEN NULL
              ELSE cancelled_at
            END,
            metadata_json = JSON_SET(
              COALESCE(metadata_json, JSON_OBJECT()),
              '$.manualAccessOverride',
              JSON_OBJECT(
                'action', ?,
                'reason', ?,
                'platformAccountId', ?,
                'at', NOW()
              )
            )
          WHERE id = ?
        `,
        [
          subscriptionStatus,
          payload.action,
          payload.action,
          payload.action,
          payload.reason ?? null,
          payload.platformAccountId,
          subscriptionId
        ]
      );

      await tx.execute(
        `
          UPDATE provider_subscriptions
          SET status = ?
          WHERE subscription_id = ?
        `,
        [providerStatus, subscriptionId]
      );

      if (domainStatus) {
        await tx.execute(
          `
            UPDATE tenant_domains
            SET
              status = ?,
              verified_at = COALESCE(verified_at, NOW())
            WHERE tenant_id = ?
              AND is_primary = 1
          `,
          [domainStatus, tenantId]
        );
      }

      return {
        tenantExists: true,
        subscriptionExists: true,
        subscriptionId
      };
    });
  }
}
