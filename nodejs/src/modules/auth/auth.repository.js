import { query, transaction } from "#shared/database/mysql";

export class AuthRepository {
  async countUsers() {
    const sql = "SELECT COUNT(*) as count FROM users WHERE delete_flg = 0";
    const rows = await query(sql);
    return rows[0].count;
  }

  async findUserByCredential(credential) {
    const sql = `
      SELECT u.*, e.id as emp_id, e.first_name, e.last_name, e.position, e.email as emp_email
      FROM users u
      LEFT JOIN employees e ON u.employee_id = e.id
      WHERE u.delete_flg = 0 
        AND (u.username = ? OR u.email = ?)
      LIMIT 1
    `;
    const rows = await query(sql, [credential, credential]);
    const user = rows[0] || null;

    if (user) {
      return this._mapUserWithEmployee(user);
    }
    return null;
  }

  async findUserById(userId) {
    const sql = `
      SELECT u.*, e.id as emp_id, e.first_name, e.last_name, e.position, e.email as emp_email
      FROM users u
      LEFT JOIN employees e ON u.employee_id = e.id
      WHERE u.id = ? AND u.delete_flg = 0
      LIMIT 1
    `;
    const rows = await query(sql, [userId]);
    const user = rows[0] || null;

    if (user) {
      return this._mapUserWithEmployee(user);
    }
    return null;
  }

  async findUserByUsername(username) {
    const sql = "SELECT * FROM users WHERE username = ? LIMIT 1";
    const rows = await query(sql, [username]);
    return rows[0] || null;
  }

  async findUserByEmail(email) {
    const sql = "SELECT * FROM users WHERE email = ? LIMIT 1";
    const rows = await query(sql, [email]);
    return rows[0] || null;
  }

  async registerInitialUser(payload) {
    return transaction(async (tx) => {
      const empSql = `
        INSERT INTO employees (first_name, last_name, position, email, status, created_ip, updated_ip)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `;
      const [empResult] = await tx.execute(empSql, [
        payload.firstName,
        payload.lastName,
        "staff",
        payload.email,
        "active",
        payload.ipAddress ?? null,
        payload.ipAddress ?? null
      ]);
      const employeeId = empResult.insertId;

      const userSql = `
        INSERT INTO users (employee_id, username, email, password_hash, role, status, created_ip, updated_ip)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;
      const [userResult] = await tx.execute(userSql, [
        employeeId,
        payload.username,
        payload.email,
        payload.passwordHash,
        "admin",
        1,
        payload.ipAddress ?? null,
        payload.ipAddress ?? null
      ]);
      const userId = userResult.insertId;

      // Fetch the created user with employee to match Prisma's 'include'
      const fetchSql = `
        SELECT u.*, e.id as emp_id, e.first_name, e.last_name, e.position, e.email as emp_email
        FROM users u
        JOIN employees e ON u.employee_id = e.id
        WHERE u.id = ?
      `;
      const [rows] = await tx.execute(fetchSql, [userId]);
      return this._mapUserWithEmployee(rows[0]);
    });
  }

  async findWorkspaceContextByTenantId(tenantId) {
    if (!tenantId) {
      return null;
    }

    const tenantRows = await query(
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
          p.code AS plan_code,
          p.name AS plan_name,
          p.max_branches,
          p.allow_multi_branch,
          pp.code AS plan_price_code,
          pp.name AS plan_price_name,
          pp.billing_interval_unit,
          pp.billing_interval_count,
          pp.price AS plan_price_value,
          pp.currency_code AS plan_price_currency_code
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

    const tenantRow = tenantRows[0];
    if (!tenantRow) {
      return null;
    }

    const branchRows = await query(
      `
        SELECT
          id,
          tenant_id,
          code,
          name,
          type,
          is_primary,
          status,
          phone,
          email,
          address
        FROM branches
        WHERE tenant_id = ?
        ORDER BY is_primary DESC, id ASC
      `,
      [tenantId]
    );

    const branches = branchRows.map((row) => ({
      id: Number(row.id),
      tenantId: Number(row.tenant_id),
      code: row.code,
      name: row.name,
      type: row.type,
      isPrimary: Boolean(row.is_primary),
      status: row.status,
      phone: row.phone,
      email: row.email,
      address: row.address
    }));

    const currentBranch = branches.find((branch) => branch.isPrimary) ?? branches[0] ?? null;
    const subscriptionStatus = tenantRow.subscription_status ?? tenantRow.tenant_subscription_status ?? null;

    return {
      tenant: {
        id: Number(tenantRow.tenant_id),
        uuid: tenantRow.tenant_uuid,
        slug: tenantRow.tenant_slug,
        name: tenantRow.tenant_name,
        legalName: tenantRow.tenant_legal_name,
        businessType: tenantRow.tenant_business_type,
        address: tenantRow.tenant_address,
        phone: tenantRow.tenant_phone,
        email: tenantRow.tenant_email,
        currencyCode: tenantRow.tenant_currency_code,
        timezone: tenantRow.tenant_timezone,
        status: tenantRow.tenant_status,
        subscriptionStatus: tenantRow.tenant_subscription_status,
        domain: tenantRow.tenant_domain,
        subdomain: tenantRow.tenant_subdomain,
        domainStatus: tenantRow.tenant_domain_status
      },
      subscription: tenantRow.subscription_id
        ? {
            id: Number(tenantRow.subscription_id),
            planId: Number(tenantRow.subscription_plan_id),
            planPriceId: tenantRow.subscription_plan_price_id ? Number(tenantRow.subscription_plan_price_id) : null,
            provider: tenantRow.subscription_provider,
            providerSubscriptionId: tenantRow.provider_subscription_id,
            status: tenantRow.subscription_status,
            billingCycle: tenantRow.billing_cycle,
            startedAt: tenantRow.started_at,
            currentPeriodStart: tenantRow.current_period_start,
            currentPeriodEnd: tenantRow.current_period_end,
            cancelAtPeriodEnd: Boolean(tenantRow.cancel_at_period_end),
            cancelledAt: tenantRow.cancelled_at,
            planCode: tenantRow.plan_code,
            planName: tenantRow.plan_name,
            maxBranches: tenantRow.max_branches === null ? null : Number(tenantRow.max_branches),
            allowMultiBranch: Boolean(tenantRow.allow_multi_branch),
            planPriceCode: tenantRow.plan_price_code,
            planPriceName: tenantRow.plan_price_name,
            billingIntervalUnit: tenantRow.billing_interval_unit,
            billingIntervalCount: tenantRow.billing_interval_count === null ? null : Number(tenantRow.billing_interval_count),
            price: tenantRow.plan_price_value === null ? null : Number(tenantRow.plan_price_value),
            currencyCode: tenantRow.plan_price_currency_code
          }
        : null,
      currentBranch,
      branches,
      subscriptionAccess: {
        status: subscriptionStatus,
        isActive: ["active", "trialing"].includes(String(subscriptionStatus ?? "").toLowerCase())
      }
    };
  }

  _mapUserWithEmployee(row) {
      const user = {
      id: row.id,
      tenantId: row.tenant_id,
      accountId: row.account_id,
      employeeId: row.employee_id,
      username: row.username,
      email: row.email,
      passwordHash: row.password_hash,
      role: row.role,
      status: row.status,
      deleteFlag: row.delete_flg,
      lastLoginAt: row.last_login_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      createdIp: row.created_ip,
      updatedIp: row.updated_ip
    };

    if (row.emp_id) {
      user.employee = {
        id: row.emp_id,
        firstName: row.first_name,
        lastName: row.last_name,
        position: row.position,
        email: row.emp_email
      };
    } else {
      user.employee = null;
    }

    return user;
  }
}
