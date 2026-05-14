import { query } from "#shared/database/mysql";

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

export class SubscriptionsRepository {
  async listActivePlans() {
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
          pp.price,
          pp.currency_code,
          pp.provider_price_id,
          pp.is_active AS plan_price_is_active
        FROM subscription_plans p
        LEFT JOIN subscription_plan_prices pp
          ON pp.plan_id = p.id
         AND pp.is_active = 1
        WHERE p.is_active = 1
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

    const plans = new Map();

    for (const row of rows) {
      if (!plans.has(row.id)) {
        plans.set(row.id, normalizePlan(row));
      }

      const plan = plans.get(row.id);
      if (row.plan_price_id) {
        plan.prices.push({
          id: Number(row.plan_price_id),
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
        });
      }
    }

    return [...plans.values()];
  }
}
