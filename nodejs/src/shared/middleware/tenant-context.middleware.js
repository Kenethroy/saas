import { env } from "#config/env";
import { query } from "#shared/database/mysql";
import { AppError } from "#shared/utils/app-error";

function normalizeHost(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, "");
}

function isIpAddress(hostname) {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname);
}

function extractTenantLookup(req) {
  const explicitDomain = String(req.headers["x-tenant-domain"] ?? "").trim().toLowerCase();
  if (explicitDomain) {
    return { type: "domain", value: explicitDomain };
  }

  const explicitSubdomain = String(req.headers["x-tenant-subdomain"] ?? "").trim().toLowerCase();
  if (explicitSubdomain) {
    return { type: "subdomain", value: explicitSubdomain };
  }

  const hostname = normalizeHost(req.headers["x-forwarded-host"] ?? req.headers.host ?? req.hostname);
  if (!hostname || hostname === "localhost" || isIpAddress(hostname)) {
    return null;
  }

  if (env.PLATFORM_BASE_DOMAIN && hostname.endsWith(`.${env.PLATFORM_BASE_DOMAIN}`)) {
    const subdomain = hostname.slice(0, -(`.${env.PLATFORM_BASE_DOMAIN}`.length));
    if (subdomain) {
      return { type: "subdomain", value: subdomain };
    }
  }

  return { type: "domain", value: hostname };
}

async function findTenantContext(lookup) {
  if (!lookup?.value) {
    return null;
  }

  const [field, value] = lookup.type === "subdomain"
    ? ["td.subdomain", lookup.value]
    : ["td.domain", lookup.value];

  const rows = await query(
    `
      SELECT
        t.id AS tenant_id,
        t.uuid AS tenant_uuid,
        t.slug AS tenant_slug,
        t.name AS tenant_name,
        t.status AS tenant_status,
        t.subscription_status AS tenant_subscription_status,
        td.id AS tenant_domain_id,
        td.domain AS tenant_domain,
        td.subdomain AS tenant_subdomain,
        td.status AS tenant_domain_status,
        s.id AS subscription_id,
        s.status AS subscription_status,
        s.billing_cycle,
        p.code AS plan_code,
        p.name AS plan_name
      FROM tenant_domains td
      JOIN tenants t
        ON t.id = td.tenant_id
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
      WHERE ${field} = ?
        AND td.is_primary = 1
      LIMIT 1
    `,
    [value]
  );

  const row = rows[0];
  if (!row) {
    return null;
  }

  return {
    tenant: {
      id: Number(row.tenant_id),
      uuid: row.tenant_uuid,
      slug: row.tenant_slug,
      name: row.tenant_name,
      status: row.tenant_status,
      subscriptionStatus: row.tenant_subscription_status,
      domain: row.tenant_domain,
      subdomain: row.tenant_subdomain,
      domainStatus: row.tenant_domain_status
    },
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

async function findTenantContextByTenantId(tenantId) {
  if (!tenantId) {
    return null;
  }

  const rows = await query(
    `
      SELECT
        t.id AS tenant_id,
        t.uuid AS tenant_uuid,
        t.slug AS tenant_slug,
        t.name AS tenant_name,
        t.status AS tenant_status,
        t.subscription_status AS tenant_subscription_status,
        td.id AS tenant_domain_id,
        td.domain AS tenant_domain,
        td.subdomain AS tenant_subdomain,
        td.status AS tenant_domain_status,
        s.id AS subscription_id,
        s.status AS subscription_status,
        s.billing_cycle,
        p.code AS plan_code,
        p.name AS plan_name
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
      WHERE t.id = ?
      LIMIT 1
    `,
    [tenantId]
  );

  const row = rows[0];
  if (!row) {
    return null;
  }

  return {
    tenant: {
      id: Number(row.tenant_id),
      uuid: row.tenant_uuid,
      slug: row.tenant_slug,
      name: row.tenant_name,
      status: row.tenant_status,
      subscriptionStatus: row.tenant_subscription_status,
      domain: row.tenant_domain,
      subdomain: row.tenant_subdomain,
      domainStatus: row.tenant_domain_status
    },
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

export async function resolveTenant(req, _res, next) {
  try {
    const lookup = extractTenantLookup(req);
    if (!lookup && req.auth?.user?.tenantId) {
      const context = await findTenantContextByTenantId(req.auth.user.tenantId);
      if (!context) {
        return next(new AppError("Tenant not found", 404));
      }

      req.auth = {
        ...(req.auth ?? {}),
        tenant: context.tenant,
        subscription: context.subscription
      };
      return next();
    }

    if (!lookup) {
      return next(new AppError("Tenant context could not be resolved", 404));
    }

    const context = await findTenantContext(lookup);
    if (!context) {
      return next(new AppError("Tenant not found", 404));
    }

    req.auth = {
      ...(req.auth ?? {}),
      tenant: context.tenant,
      subscription: context.subscription
    };

    next();
  } catch (error) {
    next(error);
  }
}

export async function requireTenantMembership(req, _res, next) {
  try {
    const tenantId = req.auth?.tenant?.id;
    const accountId = req.auth?.account?.id ?? req.auth?.user?.accountId ?? null;

    if (!tenantId) {
      throw new AppError("Tenant context is required", 400);
    }

    if (!accountId) {
      throw new AppError("Tenant membership is required", 403);
    }

    const rows = await query(
      `
        SELECT *
        FROM tenant_memberships
        WHERE tenant_id = ?
          AND account_id = ?
          AND status = 'active'
        LIMIT 1
      `,
      [tenantId, accountId]
    );

    const membership = rows[0];
    if (!membership) {
      throw new AppError("Tenant membership is required", 403);
    }

    req.auth = {
      ...(req.auth ?? {}),
      membership: {
        id: Number(membership.id),
        tenantId: Number(membership.tenant_id),
        accountId: Number(membership.account_id),
        role: membership.role,
        status: membership.status,
        joinedAt: membership.joined_at
      }
    };

    next();
  } catch (error) {
    next(error);
  }
}

export function requireActiveSubscription(req, _res, next) {
  const allowedStatuses = new Set(["active", "trialing"]);
  const status = req.auth?.subscription?.status ?? req.auth?.tenant?.subscriptionStatus ?? null;

  if (!status || !allowedStatuses.has(status)) {
    return next(new AppError("Active subscription required", 402));
  }

  return next();
}
