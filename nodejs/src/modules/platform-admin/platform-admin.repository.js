import { query } from "#shared/database/mysql";

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
}

