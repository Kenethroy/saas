import { query, transaction } from "#shared/database/mysql";

export class SettingsRepository {
  async findAll() {
    return query("SELECT * FROM settings ORDER BY \`key\` ASC");
  }

  async findByCategory(category) {
    return query("SELECT * FROM settings WHERE category = ?", [category]);
  }

  async upsertMany(settings) {
    return transaction(async (tx) => {
      for (const item of settings) {
        const val = item.value?.toString() ?? null;
        await tx.execute(`
          INSERT INTO settings (\`key\`, value, category)
          VALUES (?, ?, ?)
          ON DUPLICATE KEY UPDATE value = VALUES(value), category = VALUES(category)
        `, [item.key, val, item.category]);
      }
    });
  }

  async findByKey(key) {
    const rows = await query("SELECT * FROM settings WHERE \`key\` = ? LIMIT 1", [key]);
    return rows[0] || null;
  }
}
