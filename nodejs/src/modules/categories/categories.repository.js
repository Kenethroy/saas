import { query } from "#shared/database/mysql";
import { getBranchInventoryQuantities } from "#shared/utils/branch-inventory";

export class CategoriesRepository {
  async findPaginated(tenantId, filters = {}, pagination = {}) {
    const page = pagination.page ?? 1;
    const perPage = pagination.perPage ?? 10;
    const offset = (page - 1) * perPage;

    let sql = "FROM categories WHERE tenant_id = ? AND delete_flg = 0";
    const params = [tenantId];

    if (filters.search) {
      sql += " AND name LIKE ?";
      params.push(`%${filters.search}%`);
    }

    if (typeof filters.status === "boolean") {
      sql += " AND status = ?";
      params.push(filters.status ? 1 : 0);
    }

    const countSql = `SELECT COUNT(*) as total ${sql}`;
    const dataSql = `
      SELECT *, 
        (SELECT COUNT(*) FROM products p WHERE p.tenant_id = categories.tenant_id AND p.category_id = categories.id AND p.delete_flg = 0) as product_count,
        (SELECT COUNT(*) FROM product_variants pv JOIN products p ON pv.product_id = p.id AND p.tenant_id = pv.tenant_id WHERE p.tenant_id = categories.tenant_id AND p.category_id = categories.id AND pv.delete_flg = 0 AND pv.status = 1 AND p.delete_flg = 0 AND p.status = 1) as variant_count
      ${sql}
      ORDER BY name ASC
      LIMIT ? OFFSET ?
    `;
    const dataParams = [...params, perPage, offset];

    const [countRows, rows] = await Promise.all([
      query(countSql, params),
      query(dataSql, dataParams)
    ]);

    return {
      data: rows.map(row => ({
        id: row.id,
        name: row.name,
        description: row.description,
        status: row.status === 1,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        productCount: row.product_count,
        variantCount: row.variant_count
      })),
      total: countRows[0].total
    };
  }

  async findById(tenantId, id) {
    const sql = `
      SELECT *, 
        (SELECT COUNT(*) FROM products p WHERE p.tenant_id = categories.tenant_id AND p.category_id = categories.id AND p.delete_flg = 0) as product_count
      FROM categories 
      WHERE tenant_id = ? AND id = ? AND delete_flg = 0 
      LIMIT 1
    `;
    const rows = await query(sql, [tenantId, id]);
    if (!rows[0]) return null;

    const row = rows[0];
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      status: row.status === 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      _count: {
        products: row.product_count
      }
    };
  }

  async findByName(tenantId, name) {
    const rows = await query("SELECT * FROM categories WHERE tenant_id = ? AND name = ? LIMIT 1", [tenantId, name]);
    if (!rows[0]) return null;
    const row = rows[0];
    return {
      ...row,
      deleteFlag: row.delete_flg === 1
    };
  }

  async findListWithVariantCounts(tenantId, options = {}) {
    const branchId = options.branchId ?? null;
    const rows = await query(
      `
        SELECT categories.*, pv.id AS product_variant_id
        FROM categories
        LEFT JOIN products p
          ON p.tenant_id = categories.tenant_id
         AND p.category_id = categories.id
         AND p.delete_flg = 0
         AND p.status = 1
        LEFT JOIN product_variants pv
          ON pv.tenant_id = categories.tenant_id
         AND pv.product_id = p.id
         AND pv.delete_flg = 0
         AND pv.status = 1
        WHERE categories.tenant_id = ?
          AND categories.delete_flg = 0
          AND categories.status = 1
        ORDER BY categories.name ASC, pv.id ASC
      `,
      [tenantId]
    );

    const variantIds = rows
      .map((row) => Number(row.product_variant_id))
      .filter((variantId) => Number.isInteger(variantId) && variantId > 0);
    const branchQuantities = branchId
      ? (await getBranchInventoryQuantities({
          tenantId,
          branchId,
          variantIds
        })).quantities
      : null;

    const categoryMap = new Map();
    for (const row of rows) {
      const categoryId = Number(row.id);
      const existing = categoryMap.get(categoryId) ?? {
        id: row.id,
        name: row.name,
        status: row.status === 1,
        variantCount: 0
      };

      const variantId = Number(row.product_variant_id);
      if (variantId > 0) {
        const hasStock = branchQuantities
          ? Number(branchQuantities.get(variantId) ?? 0) > 0
          : true;
        if (hasStock) {
          existing.variantCount += 1;
        }
      }

      categoryMap.set(categoryId, existing);
    }
    return Array.from(categoryMap.values());
  }

  async findActiveOptions(tenantId) {
    const rows = await query("SELECT id, name FROM categories WHERE tenant_id = ? AND delete_flg = 0 AND status = 1 ORDER BY name ASC", [tenantId]);
    return rows.map(row => ({
      id: row.id,
      name: row.name
    }));
  }

  async create(data) {
    const sql = "INSERT INTO categories (tenant_id, name, description, status, created_ip, updated_ip) VALUES (?, ?, ?, ?, ?, ?)";
    const result = await query(sql, [
      data.tenantId,
      data.name, data.description || null,
      data.status !== undefined ? (data.status ? 1 : 0) : 1,
      data.createdIp || null, data.updatedIp || null
    ]);
    return this.findById(data.tenantId, result.insertId);
  }

  async update(tenantId, id, data) {
    const fields = [];
    const params = [];

    const map = {
      name: 'name',
      description: 'description',
      status: 'status',
      deleteFlag: 'delete_flg',
      updatedIp: 'updated_ip'
    };

    for (const [key, column] of Object.entries(map)) {
      if (data[key] !== undefined) {
        fields.push(`${column} = ?`);
        params.push(key === 'status' || key === 'deleteFlag' ? (data[key] ? 1 : 0) : data[key]);
      }
    }

    if (fields.length > 0) {
      const sql = `UPDATE categories SET ${fields.join(', ')} WHERE tenant_id = ? AND id = ?`;
      params.push(tenantId, id);
      await query(sql, params);
    }

    return this.findById(tenantId, id);
  }
}
