import { query, transaction } from "#shared/database/mysql";

const ROLE_LABELS = {
  admin: "Admin",
  staff: "Staff",
  agent: "Agent",
  driver: "Driver"
};

const ROLE_DESCRIPTIONS = {
  admin: "Full system access and control",
  staff: "General administrative staff",
  agent: "Sales agents and relationship managers",
  driver: "Logistics and delivery staff"
};

export class PermissionsRepository {
  async listPermissions() {
    return query("SELECT * FROM permissions WHERE delete_flg = 0 ORDER BY slug ASC");
  }

  async listPermissionsByIds(permissionIds) {
    if (!permissionIds.length) return [];
    return query("SELECT * FROM permissions WHERE id IN (?) AND delete_flg = 0", [permissionIds]);
  }

  async getRolePermissionLinks(role) {
    return query(`
      SELECT rp.*, p.id as p_id, p.slug as p_slug, p.name as p_name, p.description as p_description
      FROM role_permissions rp
      JOIN permissions p ON rp.permission_id = p.id
      WHERE rp.role = ?
      ORDER BY p.id ASC
    `, [role]).then(rows => rows.map(row => ({
      ...row,
      permission: {
        id: row.p_id,
        slug: row.p_slug,
        name: row.p_name,
        description: row.p_description
      }
    })));
  }

  async getUserPermissionLinks(tenantId, userId) {
    return query(`
      SELECT up.*, p.id as p_id, p.slug as p_slug, p.name as p_name, p.description as p_description
      FROM user_permissions up
      JOIN permissions p ON up.permission_id = p.id
      JOIN users u ON up.user_id = u.id
      WHERE up.user_id = ? AND u.tenant_id = ?
      ORDER BY p.id ASC
    `, [userId, tenantId]).then(rows => rows.map(row => ({
      ...row,
      permission: {
        id: row.p_id,
        slug: row.p_slug,
        name: row.p_name,
        description: row.p_description
      }
    })));
  }

  async findUserById(tenantId, userId) {
    const rows = await query("SELECT * FROM users WHERE tenant_id = ? AND id = ? AND delete_flg = 0", [tenantId, userId]);
    return rows[0] || null;
  }

  async listRoleSummaries(tenantId) {
    const [
      { total_permissions },
      roleCounts,
      userCounts
    ] = await Promise.all([
      query("SELECT COUNT(*) as total_permissions FROM permissions WHERE delete_flg = 0").then(r => r[0]),
      query("SELECT role, COUNT(permission_id) as permission_count FROM role_permissions GROUP BY role"),
      query("SELECT role, COUNT(id) as user_count FROM users WHERE tenant_id = ? AND delete_flg = 0 GROUP BY role", [tenantId])
    ]);

    return ["admin", "staff", "agent", "driver"].map((role) => {
      const roleCount = roleCounts.find((entry) => entry.role === role);
      const userCount = userCounts.find((entry) => entry.role === role);

      return {
        id: role,
        name: ROLE_LABELS[role],
        permission_count: role === "admin" ? total_permissions : Number(roleCount?.permission_count ?? 0),
        user_count: Number(userCount?.user_count ?? 0),
        description: ROLE_DESCRIPTIONS[role],
        is_system: true
      };
    });
  }

  async syncRolePermissions(role, permissionIds) {
    return transaction(async (tx) => {
      await tx.execute("DELETE FROM role_permissions WHERE role = ?", [role]);
      if (permissionIds.length > 0) {
        for (const pid of permissionIds) {
          await tx.execute("INSERT INTO role_permissions (role, permission_id) VALUES (?, ?)", [role, pid]);
        }
      }
    });
  }

  async syncUserPermissions(tenantId, userId, permissionIds) {
    return transaction(async (tx) => {
      const [userRows] = await tx.execute("SELECT id FROM users WHERE tenant_id = ? AND id = ? LIMIT 1", [tenantId, userId]);
      if (userRows.length === 0) {
        return;
      }

      await tx.execute("DELETE FROM user_permissions WHERE user_id = ?", [userId]);
      if (permissionIds.length > 0) {
        for (const pid of permissionIds) {
          await tx.execute("INSERT INTO user_permissions (user_id, permission_id) VALUES (?, ?)", [userId, pid]);
        }
      }
    });
  }
}
