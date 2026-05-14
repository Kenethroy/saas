import { query, transaction } from "#shared/database/mysql";

function parseJsonColumn(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function extractProcedureRow(result) {
  if (!Array.isArray(result)) {
    return result && typeof result === "object" ? result : null;
  }

  for (const item of result) {
    if (Array.isArray(item) && item.length > 0) {
      const row = item[0];
      if (row && typeof row === "object" && !Array.isArray(row)) {
        return row;
      }
    }

    if (item && typeof item === "object" && !Array.isArray(item)) {
      return item;
    }
  }

  return null;
}

function mapProviderEvent(row) {
  if (!row) return null;

  return {
    id: Number(row.id),
    provider: row.provider,
    eventId: row.event_id,
    eventType: row.event_type,
    tenantId: row.tenant_id ? Number(row.tenant_id) : null,
    subscriptionId: row.subscription_id ? Number(row.subscription_id) : null,
    payload: parseJsonColumn(row.payload_json),
    processedAt: row.processed_at,
    status: row.status,
    createdAt: row.created_at
  };
}

function normalizePlan(row) {
  if (!row) return null;

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
    isActive: Boolean(row.is_active)
  };
}

function normalizePlanPrice(row) {
  if (!row || !row.plan_price_id) return null;

  return {
    id: Number(row.plan_price_id),
    code: row.plan_price_code,
    name: row.plan_price_name,
    description: row.plan_price_description,
    checkoutMode: row.checkout_mode,
    billingIntervalUnit: row.billing_interval_unit,
    billingIntervalCount: Number(row.billing_interval_count),
    price: row.plan_price_value === null ? null : Number(row.plan_price_value),
    currencyCode: row.plan_price_currency_code,
    providerPriceId: row.provider_price_id,
    isActive: Boolean(row.plan_price_is_active)
  };
}

export class BillingRepository {
  async findPlanPriceByCode(planPriceCode) {
    const rows = await query(
      `
        SELECT
          p.*,
          pp.id AS plan_price_id,
          pp.code AS plan_price_code,
          pp.name AS plan_price_name,
          pp.description AS plan_price_description,
          pp.checkout_mode,
          pp.billing_interval_unit,
          pp.billing_interval_count,
          pp.price AS plan_price_value,
          pp.currency_code AS plan_price_currency_code,
          pp.provider_price_id,
          pp.is_active AS plan_price_is_active
        FROM subscription_plan_prices pp
        JOIN subscription_plans p
          ON p.id = pp.plan_id
        WHERE pp.code = ?
          AND pp.is_active = 1
          AND p.is_active = 1
        LIMIT 1
      `,
      [planPriceCode]
    );

    const row = rows[0];
    if (!row) return null;

    return {
      plan: normalizePlan(row),
      planPrice: normalizePlanPrice(row)
    };
  }

  async createCheckoutDraft(payload) {
    await query(
      `
        INSERT INTO provider_events (
          provider,
          event_id,
          event_type,
          payload_json,
          status
        )
        VALUES (?, ?, 'checkout.initiated', ?, 'pending')
      `,
      [payload.provider, payload.eventId, JSON.stringify(payload.data)]
    );
  }

  async findCheckoutDraftByReferenceId(provider, referenceId) {
    const rows = await query(
      `
        SELECT *
        FROM provider_events
        WHERE provider = ?
          AND event_id = ?
        LIMIT 1
      `,
      [provider, `checkout:${referenceId}`]
    );

    return mapProviderEvent(rows[0]);
  }

  async findProviderEvent(provider, eventId) {
    const rows = await query(
      `
        SELECT *
        FROM provider_events
        WHERE provider = ?
          AND event_id = ?
        LIMIT 1
      `,
      [provider, eventId]
    );

    return mapProviderEvent(rows[0]);
  }

  async createProviderWebhookEvent(payload) {
    await query(
      `
        INSERT INTO provider_events (
          provider,
          event_id,
          event_type,
          payload_json,
          status
        )
        VALUES (?, ?, ?, ?, 'pending')
      `,
      [payload.provider, payload.eventId, payload.eventType, JSON.stringify(payload.data)]
    );
  }

  async markProviderEventStatus(provider, eventId, status, options = {}) {
    await query(
      `
        UPDATE provider_events
        SET
          tenant_id = COALESCE(?, tenant_id),
          subscription_id = COALESCE(?, subscription_id),
          processed_at = CASE
            WHEN ? IN ('processed', 'ignored') THEN NOW()
            ELSE processed_at
          END,
          status = ?
        WHERE provider = ?
          AND event_id = ?
      `,
      [
        options.tenantId ?? null,
        options.subscriptionId ?? null,
        status,
        status,
        provider,
        eventId
      ]
    );
  }

  async provisionTenant(payload) {
    const result = await query(
      `
        CALL sp_provision_tenant(
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        )
      `,
      [
        payload.accountId,
        payload.planCode,
        payload.provider,
        payload.providerSubscriptionId ?? null,
        payload.subscriptionStatus,
        payload.billingCycle,
        payload.businessName,
        payload.legalName ?? null,
        payload.businessType ?? null,
        payload.phone ?? null,
        payload.businessEmail ?? null,
        payload.address ?? null,
        payload.currencyCode ?? null,
        payload.timezone ?? null,
        payload.preferredSubdomain,
        payload.baseDomain ?? null,
        payload.ownerUsername,
        payload.primaryBranchName ?? null
      ]
    );

    const row = extractProcedureRow(result);
    if (!row) return null;

    return {
      tenantId: Number(row.tenant_id),
      primaryBranchId: Number(row.primary_branch_id),
      ownerUserId: Number(row.owner_user_id),
      tenantDomain: row.tenant_domain,
      tenantSubdomain: row.tenant_subdomain
    };
  }

  async findLatestTenantSubscription(tenantId) {
    const rows = await query(
      `
        SELECT *
        FROM subscriptions
        WHERE tenant_id = ?
        ORDER BY created_at DESC, id DESC
        LIMIT 1
      `,
      [tenantId]
    );

    return rows[0]
      ? {
          id: Number(rows[0].id),
          tenantId: Number(rows[0].tenant_id),
          planId: Number(rows[0].plan_id),
          planPriceId: rows[0].plan_price_id ? Number(rows[0].plan_price_id) : null,
          provider: rows[0].provider,
          providerSubscriptionId: rows[0].provider_subscription_id,
          status: rows[0].status,
          billingCycle: rows[0].billing_cycle
        }
      : null;
  }

  async listActivePlanPricesForPlan(planId) {
    const rows = await query(
      `
        SELECT
          pp.id AS plan_price_id,
          pp.code AS plan_price_code,
          pp.name AS plan_price_name,
          pp.description AS plan_price_description,
          pp.checkout_mode,
          pp.billing_interval_unit,
          pp.billing_interval_count,
          pp.price AS plan_price_value,
          pp.currency_code AS plan_price_currency_code,
          pp.provider_price_id,
          pp.is_active AS plan_price_is_active
        FROM subscription_plan_prices pp
        WHERE pp.plan_id = ?
          AND pp.is_active = 1
        ORDER BY
          CASE pp.billing_interval_unit
            WHEN 'month' THEN 0
            ELSE 1
          END,
          pp.billing_interval_count ASC,
          pp.id ASC
      `,
      [planId]
    );

    return rows.map((row) => normalizePlanPrice(row)).filter(Boolean);
  }

  async findTenantBillingContext(tenantId) {
    const rows = await query(
      `
        SELECT
          t.id AS tenant_id,
          t.uuid AS tenant_uuid,
          t.slug AS tenant_slug,
          t.name AS tenant_name,
          t.legal_name AS tenant_legal_name,
          t.business_type AS tenant_business_type,
          t.address AS tenant_address,
          t.phone AS tenant_phone,
          t.email AS tenant_email,
          t.currency_code AS tenant_currency_code,
          t.timezone AS tenant_timezone,
          t.status AS tenant_status,
          t.subscription_status AS tenant_subscription_status,
          td.domain AS tenant_domain,
          td.subdomain AS tenant_subdomain,
          td.status AS tenant_domain_status,
          s.id AS subscription_id,
          s.plan_id AS subscription_plan_id,
          s.plan_price_id AS subscription_plan_price_id,
          s.provider AS subscription_provider,
          s.provider_subscription_id,
          s.status AS subscription_status,
          s.billing_cycle,
          s.started_at,
          s.current_period_start,
          s.current_period_end,
          s.cancel_at_period_end,
          s.cancelled_at,
          s.metadata_json AS subscription_metadata_json,
          p.code AS plan_code,
          p.name AS plan_name,
          p.description AS plan_description,
          p.max_branches,
          p.max_users,
          p.max_products,
          p.max_storage_gb,
          p.allow_reports,
          p.allow_backup,
          p.allow_api_access,
          p.allow_multi_branch,
          p.is_active AS plan_is_active,
          pp.id AS plan_price_id,
          pp.code AS plan_price_code,
          pp.name AS plan_price_name,
          pp.description AS plan_price_description,
          pp.checkout_mode,
          pp.billing_interval_unit,
          pp.billing_interval_count,
          pp.price AS plan_price_value,
          pp.currency_code AS plan_price_currency_code,
          pp.provider_price_id,
          pp.is_active AS plan_price_is_active
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
        WHERE t.id = ?
        LIMIT 1
      `,
      [tenantId]
    );

    const row = rows[0];
    if (!row) {
      return null;
    }

    const latestInvoiceRows = await query(
      `
        SELECT *
        FROM billing_invoices
        WHERE tenant_id = ?
        ORDER BY created_at DESC, id DESC
        LIMIT 1
      `,
      [tenantId]
    );

    const latestPaymentRows = await query(
      `
        SELECT *
        FROM subscription_payments
        WHERE tenant_id = ?
        ORDER BY created_at DESC, id DESC
        LIMIT 1
      `,
      [tenantId]
    );

    const providerCustomerRows = row.subscription_provider
      ? await query(
          `
            SELECT *
            FROM provider_customers
            WHERE tenant_id = ?
              AND provider = ?
            LIMIT 1
          `,
          [tenantId, row.subscription_provider]
        )
      : [];

    const providerSubscriptionRows = row.subscription_id && row.subscription_provider
      ? await query(
          `
            SELECT *
            FROM provider_subscriptions
            WHERE subscription_id = ?
              AND provider = ?
            LIMIT 1
          `,
          [row.subscription_id, row.subscription_provider]
        )
      : [];

    const availablePlanPrices = row.subscription_plan_id
      ? await this.listActivePlanPricesForPlan(Number(row.subscription_plan_id))
      : [];

    const latestInvoice = latestInvoiceRows[0];
    const latestPayment = latestPaymentRows[0];
    const providerCustomer = providerCustomerRows[0];
    const providerSubscription = providerSubscriptionRows[0];
    const plan = row.subscription_id
      ? {
          id: Number(row.subscription_plan_id),
          code: row.plan_code,
          name: row.plan_name,
          description: row.plan_description,
          maxBranches: row.max_branches === null ? null : Number(row.max_branches),
          maxUsers: row.max_users === null ? null : Number(row.max_users),
          maxProducts: row.max_products === null ? null : Number(row.max_products),
          maxStorageGb: row.max_storage_gb === null ? null : Number(row.max_storage_gb),
          allowReports: Boolean(row.allow_reports),
          allowBackup: Boolean(row.allow_backup),
          allowApiAccess: Boolean(row.allow_api_access),
          allowMultiBranch: Boolean(row.allow_multi_branch),
          isActive: Boolean(row.plan_is_active)
        }
      : null;

    return {
      tenant: {
        id: Number(row.tenant_id),
        uuid: row.tenant_uuid,
        slug: row.tenant_slug,
        name: row.tenant_name,
        legalName: row.tenant_legal_name,
        businessType: row.tenant_business_type,
        address: row.tenant_address,
        phone: row.tenant_phone,
        email: row.tenant_email,
        currencyCode: row.tenant_currency_code,
        timezone: row.tenant_timezone,
        status: row.tenant_status,
        subscriptionStatus: row.tenant_subscription_status,
        domain: row.tenant_domain,
        subdomain: row.tenant_subdomain,
        domainStatus: row.tenant_domain_status
      },
      subscription: row.subscription_id
        ? {
            id: Number(row.subscription_id),
            planId: Number(row.subscription_plan_id),
            planPriceId: row.subscription_plan_price_id ? Number(row.subscription_plan_price_id) : null,
            provider: row.subscription_provider,
            providerSubscriptionId: row.provider_subscription_id,
            status: row.subscription_status,
            billingCycle: row.billing_cycle,
            startedAt: row.started_at,
            currentPeriodStart: row.current_period_start,
            currentPeriodEnd: row.current_period_end,
            cancelAtPeriodEnd: Boolean(row.cancel_at_period_end),
            cancelledAt: row.cancelled_at,
            metadata: parseJsonColumn(row.subscription_metadata_json),
            plan,
            planPrice: normalizePlanPrice(row)
          }
        : null,
      latestInvoice: latestInvoice
        ? {
            id: Number(latestInvoice.id),
            invoiceNumber: latestInvoice.invoice_number,
            amountDue: Number(latestInvoice.amount_due),
            amountPaid: Number(latestInvoice.amount_paid),
            currency: latestInvoice.currency,
            status: latestInvoice.status,
            dueAt: latestInvoice.due_at,
            paidAt: latestInvoice.paid_at,
            createdAt: latestInvoice.created_at
          }
        : null,
      latestPayment: latestPayment
        ? {
            id: Number(latestPayment.id),
            provider: latestPayment.provider,
            providerPaymentId: latestPayment.provider_payment_id,
            providerReference: latestPayment.provider_reference,
            amount: Number(latestPayment.amount),
            currency: latestPayment.currency,
            status: latestPayment.status,
            paidAt: latestPayment.paid_at,
            createdAt: latestPayment.created_at
          }
        : null,
      providerCustomer: providerCustomer
        ? {
            id: Number(providerCustomer.id),
            provider: providerCustomer.provider,
            providerCustomerId: providerCustomer.provider_customer_id,
            email: providerCustomer.email,
            metadata: parseJsonColumn(providerCustomer.metadata_json)
          }
        : null,
      providerSubscription: providerSubscription
        ? {
            id: Number(providerSubscription.id),
            provider: providerSubscription.provider,
            providerSubscriptionId: providerSubscription.provider_subscription_id,
            providerPlanId: providerSubscription.provider_plan_id,
            status: providerSubscription.status,
            payload: parseJsonColumn(providerSubscription.payload_json)
          }
        : null,
      availablePlanPrices,
      recoveryEligible: !["active", "trialing"].includes(row.subscription_status ?? row.tenant_subscription_status ?? "")
    };
  }

  async activateTenantSubscriptionState(tenantId) {
    await query(
      `
        UPDATE tenants
        SET
          status = 'active',
          subscription_status = 'active',
          updated_at = NOW()
        WHERE id = ?
      `,
      [tenantId]
    );

    await query(
      `
        UPDATE tenant_domains
        SET
          status = 'active',
          verified_at = COALESCE(verified_at, NOW()),
          updated_at = NOW()
        WHERE tenant_id = ?
          AND is_primary = 1
      `,
      [tenantId]
    );
  }

  async attachBillingArtifacts(payload) {
    return transaction(async (tx) => {
      const [existingPaymentRows] = await tx.execute(
        `
          SELECT id
          FROM subscription_payments
          WHERE provider = ?
            AND provider_payment_id = ?
          LIMIT 1
        `,
        [payload.provider, payload.providerPaymentId]
      );

      if (Array.isArray(existingPaymentRows) && existingPaymentRows.length > 0) {
        return { alreadyRecorded: true };
      }

      await tx.execute(
        `
          UPDATE subscriptions
          SET
            plan_price_id = COALESCE(?, plan_price_id),
            provider_subscription_id = COALESCE(provider_subscription_id, ?),
            current_period_start = COALESCE(current_period_start, ?),
            current_period_end = COALESCE(current_period_end, ?),
            started_at = COALESCE(started_at, NOW()),
            billing_cycle = ?,
            status = 'active'
          WHERE id = ?
        `,
        [
          payload.planPriceId ?? null,
          payload.providerSubscriptionId ?? null,
          payload.currentPeriodStart,
          payload.currentPeriodEnd,
          payload.billingCycle,
          payload.subscriptionId
        ]
      );

      if (payload.providerSubscriptionId) {
        const [providerSubscriptionRows] = await tx.execute(
          `
            SELECT id
            FROM provider_subscriptions
            WHERE subscription_id = ?
              AND provider = ?
            LIMIT 1
          `,
          [payload.subscriptionId, payload.provider]
        );

        const payloadJson = JSON.stringify({
          referenceId: payload.referenceId
        });

        if (Array.isArray(providerSubscriptionRows) && providerSubscriptionRows.length > 0) {
          await tx.execute(
            `
              UPDATE provider_subscriptions
              SET
                provider_subscription_id = ?,
                provider_plan_id = COALESCE(provider_plan_id, ?),
                status = 'active',
                payload_json = ?
              WHERE id = ?
            `,
            [
              payload.providerSubscriptionId,
              payload.providerPlanId ?? null,
              payloadJson,
              providerSubscriptionRows[0].id
            ]
          );
        } else {
          await tx.execute(
            `
              INSERT INTO provider_subscriptions (
                subscription_id,
                provider,
                provider_subscription_id,
                provider_plan_id,
                status,
                payload_json
              )
              VALUES (?, ?, ?, ?, 'active', ?)
            `,
            [
              payload.subscriptionId,
              payload.provider,
              payload.providerSubscriptionId,
              payload.providerPlanId ?? null,
              payloadJson
            ]
          );
        }
      }

      const [providerCustomerRows] = await tx.execute(
        `
          SELECT id
          FROM provider_customers
          WHERE tenant_id = ?
            AND provider = ?
          LIMIT 1
        `,
        [payload.tenantId, payload.provider]
      );

      const metadataJson = JSON.stringify({
        referenceId: payload.referenceId,
        paymentSessionId: payload.providerSubscriptionId ?? null
      });

      if (Array.isArray(providerCustomerRows) && providerCustomerRows.length > 0) {
        await tx.execute(
          `
            UPDATE provider_customers
            SET
              account_id = COALESCE(account_id, ?),
              provider_customer_id = ?,
              email = ?,
              metadata_json = ?
            WHERE id = ?
          `,
          [
            payload.accountId,
            payload.providerCustomerId,
            payload.email,
            metadataJson,
            providerCustomerRows[0].id
          ]
        );
      } else if (payload.providerCustomerId) {
        await tx.execute(
          `
            INSERT INTO provider_customers (
              tenant_id,
              account_id,
              provider,
              provider_customer_id,
              email,
              metadata_json
            )
            VALUES (?, ?, ?, ?, ?, ?)
          `,
          [
            payload.tenantId,
            payload.accountId,
            payload.provider,
            payload.providerCustomerId,
            payload.email,
            metadataJson
          ]
        );
      }

      const invoiceNumber = `BILL-${payload.tenantId}-${String(payload.referenceId).slice(-24)}`;
      const [invoiceResult] = await tx.execute(
        `
          INSERT INTO billing_invoices (
            tenant_id,
            subscription_id,
            invoice_number,
            amount_due,
            amount_paid,
            currency,
            status,
            due_at,
            paid_at
          )
          VALUES (?, ?, ?, ?, ?, ?, 'paid', NOW(), ?)
        `,
        [
          payload.tenantId,
          payload.subscriptionId,
          invoiceNumber,
          payload.amount,
          payload.amount,
          payload.currency,
          payload.paidAt
        ]
      );

      await tx.execute(
        `
          INSERT INTO subscription_payments (
            tenant_id,
            subscription_id,
            billing_invoice_id,
            provider,
            provider_payment_id,
            provider_reference,
            amount,
            currency,
            status,
            paid_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'paid', ?)
        `,
        [
          payload.tenantId,
          payload.subscriptionId,
          invoiceResult.insertId,
          payload.provider,
          payload.providerPaymentId,
          payload.referenceId,
          payload.amount,
          payload.currency,
          payload.paidAt
        ]
      );

      return {
        alreadyRecorded: false,
        invoiceNumber
      };
    });
  }
}
