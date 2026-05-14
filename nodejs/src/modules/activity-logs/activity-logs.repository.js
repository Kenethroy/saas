import { query } from "#shared/database/mysql";

export class ActivityLogsRepository {
  async resolveUserTenantContext(userId) {
    if (!userId) {
      return null;
    }

    const rows = await query(
      `
        SELECT tenant_id
        FROM users
        WHERE id = ?
        LIMIT 1
      `,
      [userId]
    );

    const row = rows[0];
    return row
      ? {
          tenantId: Number(row.tenant_id)
        }
      : null;
  }

  async findAll({ search, action, dateFrom, limit = 100, page = 1 }) {
    const offset = (page - 1) * limit;
    let sql = `
      SELECT 
        l.*, 
        u.username, 
        u.role, 
        e.first_name as firstName, 
        e.last_name as lastName
      FROM activity_logs l
      LEFT JOIN users u ON l.user_id = u.id
      LEFT JOIN employees e ON u.employee_id = e.id
      WHERE 1=1
    `;
    const params = [];

    if (search) {
      sql += ` AND (
        l.description LIKE ? OR 
        l.module LIKE ? OR 
        l.action LIKE ? OR 
        u.username LIKE ? OR 
        e.first_name LIKE ? OR 
        e.last_name LIKE ?
      )`;
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
    }

    if (action) {
      sql += " AND l.action = ?";
      params.push(action);
    }

    if (dateFrom) {
      sql += " AND l.created_at >= ?";
      params.push(new Date(dateFrom));
    }

    const countSql = `SELECT COUNT(*) as total FROM (${sql}) as sub`;
    const countParams = [...params];

    sql += " ORDER BY l.created_at DESC LIMIT ? OFFSET ?";
    params.push(limit, offset);

    const [dataRows, countRows] = await Promise.all([
      query(sql, params),
      query(countSql, countParams)
    ]);

    const data = dataRows.map(row => ({
      id: row.id,
      userId: row.user_id,
      action: row.action,
      module: row.module,
      description: row.description,
      metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      createdAt: row.created_at,
      user: row.id ? {
        username: row.username,
        role: row.role,
        employee: row.firstName ? {
          firstName: row.firstName,
          lastName: row.lastName
        } : null
      } : null
    }));

    return { data, total: countRows[0].total };
  }

  async create(data) {
    const userContext = data.tenantId ? null : await this.resolveUserTenantContext(data.userId ?? null);
    const tenantId = data.tenantId ?? userContext?.tenantId ?? null;

    if (!tenantId) {
      throw new Error("Activity log tenant context is required");
    }

    const sql = `
      INSERT INTO activity_logs (tenant_id, branch_id, user_id, action, module, description, metadata, ip_address, user_agent)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const metadata = data.metadata ? JSON.stringify(data.metadata) : JSON.stringify({});
    return query(sql, [
      tenantId,
      data.branchId ?? null,
      data.userId,
      data.action,
      data.module,
      data.description,
      metadata,
      data.ipAddress,
      data.userAgent
    ]);
  }
}
