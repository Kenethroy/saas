import { query } from "#shared/database/mysql";

export class PaymentTermsRepository {
  async findAll({ tenantId, search, status }) {
    let sql = "SELECT * FROM payment_terms WHERE tenant_id = ? AND delete_flg = 0";
    const params = [tenantId];

    if (search) {
      sql += " AND name LIKE ?";
      params.push(`%${search}%`);
    }

    if (status !== undefined) {
      sql += " AND status = ?";
      params.push(status ? 1 : 0);
    }

    sql += " ORDER BY days ASC, name ASC";
    return query(sql, params);
  }

  async findById(tenantId, id) {
    const rows = await query("SELECT * FROM payment_terms WHERE tenant_id = ? AND id = ? AND delete_flg = 0 LIMIT 1", [tenantId, id]);
    return rows[0] || null;
  }

  async findByName(tenantId, name) {
    const rows = await query("SELECT * FROM payment_terms WHERE tenant_id = ? AND name = ? LIMIT 1", [tenantId, name]);
    return rows[0] || null;
  }

  async create(data) {
    const sql = `
      INSERT INTO payment_terms (tenant_id, name, description, days, status, delete_flg, created_ip, updated_ip)
      VALUES (?, ?, ?, ?, ?, 0, ?, ?)
    `;
    const result = await query(sql, [
      data.tenantId,
      data.name, data.description || null, data.days, data.status !== undefined ? (data.status ? 1 : 0) : 1,
      data.createdIp || null, data.updatedIp || null
    ]);
    return this.findById(data.tenantId, result.insertId);
  }

  async update(tenantId, id, data) {
    const fields = [];
    const params = [];

    if (data.name !== undefined) { fields.push("name = ?"); params.push(data.name); }
    if (data.description !== undefined) { fields.push("description = ?"); params.push(data.description); }
    if (data.days !== undefined) { fields.push("days = ?"); params.push(data.days); }
    if (data.status !== undefined) { fields.push("status = ?"); params.push(data.status ? 1 : 0); }
    if (data.deleteFlag !== undefined) { fields.push("delete_flg = ?"); params.push(data.deleteFlag ? 1 : 0); }
    if (data.updatedIp !== undefined) { fields.push("updated_ip = ?"); params.push(data.updatedIp); }

    if (fields.length === 0) return this.findById(tenantId, id);

    const sql = `UPDATE payment_terms SET ${fields.join(", ")} WHERE tenant_id = ? AND id = ?`;
    params.push(tenantId, id);
    await query(sql, params);
    return this.findById(tenantId, id);
  }
}
