import { query } from "#shared/database/mysql";

export class TrucksRepository {
  async findPaginated({ page, perPage, search, status }) {
    const offset = (page - 1) * perPage;

    let sql = "FROM trucks WHERE delete_flg = 0";
    const params = [];

    if (search) {
      sql += " AND (plate_number LIKE ? OR model LIKE ? OR brand LIKE ?)";
      const pattern = `%${search}%`;
      params.push(pattern, pattern, pattern);
    }

    if (status) {
      sql += " AND status = ?";
      params.push(status);
    }

    const countSql = `SELECT COUNT(*) as total ${sql}`;
    const dataSql = `SELECT * ${sql} ORDER BY id DESC LIMIT ? OFFSET ?`;
    const dataParams = [...params, perPage, offset];

    const [countRows, rows] = await Promise.all([
      query(countSql, params),
      query(dataSql, dataParams)
    ]);

    return {
      data: rows.map(row => ({
        ...row,
        id: row.id,
        plateNumber: row.plate_number,
        capacityKg: row.capacity_kg,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      })),
      total: countRows[0].total
    };
  }

  async findById(id) {
    const rows = await query("SELECT * FROM trucks WHERE id = ? AND delete_flg = 0 LIMIT 1", [id]);
    if (!rows[0]) return null;
    return {
      ...rows[0],
      id: rows[0].id,
      plateNumber: rows[0].plate_number,
      capacityKg: rows[0].capacity_kg,
      deleteFlag: rows[0].delete_flg
    };
  }

  async findByPlateNumber(plateNumber) {
    const rows = await query("SELECT * FROM trucks WHERE plate_number = ? LIMIT 1", [plateNumber]);
    if (!rows[0]) return null;
    return {
      ...rows[0],
      id: rows[0].id,
      plateNumber: rows[0].plate_number,
      capacityKg: rows[0].capacity_kg,
      deleteFlag: rows[0].delete_flg
    };
  }

  async listForAssignment(filters = {}) {
    let sql = "SELECT id, plate_number as plateNumber, model FROM trucks WHERE delete_flg = 0 AND status = 'active'";
    const params = [];

    if (filters.search) {
      sql += " AND (plate_number LIKE ? OR model LIKE ?)";
      const pattern = `%${filters.search}%`;
      params.push(pattern, pattern);
    }

    sql += " ORDER BY plate_number ASC";
    return query(sql, params);
  }

  async create(data) {
    const sql = `
      INSERT INTO trucks (plate_number, model, brand, year, color, capacity_kg, status, notes, delete_flg, created_ip, updated_ip)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
    `;
    const result = await query(sql, [
      data.plateNumber, data.model ?? null, data.brand ?? null, data.year ?? null, data.color ?? null, data.capacityKg ?? null,
      data.status || 'active', data.notes ?? null, data.createdIp || null, data.updatedIp || null
    ]);
    return this.findById(result.insertId);
  }

  async update(id, data) {
    const fields = [];
    const params = [];

    if (data.plateNumber !== undefined) {
      fields.push("plate_number = ?");
      params.push(data.plateNumber);
    }
    if (data.model !== undefined) {
      fields.push("model = ?");
      params.push(data.model);
    }
    if (data.brand !== undefined) {
      fields.push("brand = ?");
      params.push(data.brand);
    }
    if (data.year !== undefined) {
      fields.push("year = ?");
      params.push(data.year);
    }
    if (data.color !== undefined) {
      fields.push("color = ?");
      params.push(data.color);
    }
    if (data.capacityKg !== undefined) {
      fields.push("capacity_kg = ?");
      params.push(data.capacityKg);
    }
    if (data.status !== undefined) {
      fields.push("status = ?");
      params.push(data.status);
    }
    if (data.notes !== undefined) {
      fields.push("notes = ?");
      params.push(data.notes);
    }
    if (data.deleteFlag !== undefined) {
      fields.push("delete_flg = ?");
      params.push(data.deleteFlag ? 1 : 0);
    }
    if (data.updatedIp !== undefined) {
      fields.push("updated_ip = ?");
      params.push(data.updatedIp);
    }

    if (fields.length === 0) return this.findById(id);

    const sql = `UPDATE trucks SET ${fields.join(", ")} WHERE id = ?`;
    params.push(id);
    await query(sql, params);
    return this.findById(id);
  }
}
