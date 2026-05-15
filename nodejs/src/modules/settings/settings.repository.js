import { query, transaction } from "#shared/database/mysql";

export class SettingsRepository {
  async findAll(tenantId) {
    return query("SELECT * FROM settings WHERE tenant_id = ? ORDER BY \`key\` ASC", [tenantId]);
  }

  async findByCategory(tenantId, category) {
    return query("SELECT * FROM settings WHERE tenant_id = ? AND category = ?", [tenantId, category]);
  }

  async upsertMany(tenantId, settings) {
    return transaction(async (tx) => {
      for (const item of settings) {
        const val = item.value?.toString() ?? null;
        await tx.execute(`
          INSERT INTO settings (tenant_id, \`key\`, value, category)
          VALUES (?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE value = VALUES(value), category = VALUES(category)
        `, [tenantId, item.key, val, item.category]);
      }
    });
  }

  async findByKey(tenantId, key) {
    const rows = await query("SELECT * FROM settings WHERE tenant_id = ? AND \`key\` = ? LIMIT 1", [tenantId, key]);
    return rows[0] || null;
  }
}
