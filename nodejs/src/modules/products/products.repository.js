import { query, transaction } from "#shared/database/mysql";
import { getBranchInventoryQuantities } from "#shared/utils/branch-inventory";

export class ProductsRepository {
  async findPaginated(tenantId, filters = {}, pagination = {}, options = {}) {
    const page = pagination.page ?? 1;
    const perPage = pagination.perPage ?? 10;
    const offset = (page - 1) * perPage;

    let sql = `
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id AND c.tenant_id = p.tenant_id
      WHERE p.tenant_id = ? AND p.delete_flg = 0
    `;
    const params = [tenantId];

    if (filters.search) {
      sql += ` AND (
        p.name LIKE ? OR 
        EXISTS (
          SELECT 1 FROM product_variants pv 
          WHERE pv.product_id = p.id 
            AND pv.tenant_id = p.tenant_id
            AND pv.delete_flg = 0 
            AND pv.name LIKE ?
        )
      )`;
      const searchPattern = `%${filters.search}%`;
      params.push(searchPattern, searchPattern);
    }

    if (typeof filters.categoryId === "number") {
      sql += " AND p.category_id = ?";
      params.push(filters.categoryId);
    }

    if (typeof filters.status === "boolean") {
      sql += " AND p.status = ?";
      params.push(filters.status ? 1 : 0);
    }

    const countSql = `SELECT COUNT(*) as total ${sql}`;
    const dataSql = `
      SELECT p.*, c.name as cat_name, c.status as cat_status
      ${sql}
      ORDER BY p.id DESC
      LIMIT ? OFFSET ?
    `;
    const dataParams = [...params, perPage, offset];

    const [countRows, products] = await Promise.all([
      query(countSql, params),
      query(dataSql, dataParams)
    ]);

    if (products.length === 0) {
      return { data: [], total: countRows[0].total };
    }

    // Fetch variants for these products
    const productIds = products.map(p => p.id);
    const variants = await query(
      "SELECT * FROM product_variants WHERE tenant_id = ? AND product_id IN (?) AND delete_flg = 0 ORDER BY id ASC",
      [tenantId, productIds]
    );

    const branchAwareVariants = await this._applyBranchStockQuantities(tenantId, variants, options.branchId ?? null);
    const formattedData = products.map(p => this._mapProduct(p, branchAwareVariants.filter(v => v.product_id === p.id)));

    return { data: formattedData, total: countRows[0].total };
  }

  async findById(tenantId, id, options = {}) {
    const sql = `
      SELECT p.*, c.name as cat_name, c.status as cat_status
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id AND c.tenant_id = p.tenant_id
      WHERE p.tenant_id = ? AND p.id = ? AND p.delete_flg = 0
      LIMIT 1
    `;
    const rows = await query(sql, [tenantId, id]);
    if (!rows[0]) return null;

    const variants = await query(
      "SELECT * FROM product_variants WHERE tenant_id = ? AND product_id = ? AND delete_flg = 0 ORDER BY id ASC",
      [tenantId, id]
    );

    const branchAwareVariants = await this._applyBranchStockQuantities(tenantId, variants, options.branchId ?? null);
    return this._mapProduct(rows[0], branchAwareVariants);
  }

  async findCategoryById(tenantId, id) {
    const rows = await query("SELECT * FROM categories WHERE tenant_id = ? AND id = ? AND delete_flg = 0 LIMIT 1", [tenantId, id]);
    return rows[0] || null;
  }

  async createWithVariants(productData, variantsData) {
    return transaction(async (tx) => {
      const pSql = `
        INSERT INTO products (
          tenant_id, name, description, category_id, file_url, status, created_ip, updated_ip
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;
      const [pResult] = await tx.execute(pSql, [
        productData.tenantId,
        productData.name, productData.description || null, productData.categoryId || null,
        productData.fileUrl || null, productData.status !== undefined ? (productData.status ? 1 : 0) : 1,
        productData.createdIp || null, productData.updatedIp || null
      ]);

      const productId = pResult.insertId;

      for (const variant of variantsData) {
        const vSql = `
          INSERT INTO product_variants (
            tenant_id, product_id, name, unit_cost, unit_price, stock_quantity, reorder_level, status, created_ip, updated_ip
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        await tx.execute(vSql, [
          productData.tenantId, productId, variant.name, variant.unitCost || 0,
          variant.unitPrice || 0, variant.stockQuantity || 0, variant.reorderLevel || 0,
          variant.status !== undefined ? (variant.status ? 1 : 0) : 1,
          variant.createdIp || null, variant.updatedIp || null
        ]);
      }

      return productId;
    }).then(id => this.findById(productData.tenantId, id));
  }

  async updateProduct(tenantId, id, data) {
    const fields = [];
    const params = [];

    const map = {
      name: 'name',
      description: 'description',
      categoryId: 'category_id',
      fileUrl: 'file_url',
      status: 'status',
      updatedIp: 'updated_ip'
    };

    for (const [key, column] of Object.entries(map)) {
      if (data[key] !== undefined) {
        fields.push(`${column} = ?`);
        params.push(key === 'status' ? (data[key] ? 1 : 0) : data[key]);
      }
    }

    if (fields.length > 0) {
      const sql = `UPDATE products SET ${fields.join(', ')} WHERE tenant_id = ? AND id = ?`;
      params.push(tenantId, id);
      await query(sql, params);
    }

    return this.findById(tenantId, id);
  }

  async countProductsByFileUrl(tenantId, fileUrl) {
    const rows = await query("SELECT COUNT(*) as count FROM products WHERE tenant_id = ? AND file_url = ? AND delete_flg = 0", [tenantId, fileUrl]);
    return rows[0].count;
  }

  async countProductVariants(tenantId, productId) {
    const rows = await query(
      "SELECT COUNT(*) as count FROM product_variants WHERE tenant_id = ? AND product_id = ? AND delete_flg = 0",
      [tenantId, productId]
    );
    return rows[0].count;
  }

  async findVariantById(tenantId, id, options = {}) {
    const sql = `
      SELECT pv.*, p.name as p_name, p.category_id, c.name as cat_name
      FROM product_variants pv
      JOIN products p ON pv.product_id = p.id AND p.tenant_id = pv.tenant_id
      LEFT JOIN categories c ON p.category_id = c.id AND c.tenant_id = pv.tenant_id
      WHERE pv.tenant_id = ? AND pv.id = ? AND pv.delete_flg = 0
      LIMIT 1
    `;
    const rows = await query(sql, [tenantId, id]);
    if (!rows[0]) return null;

    const [row] = await this._applyBranchStockQuantities(tenantId, [rows[0]], options.branchId ?? null);
    return {
      ...row,
      productId: row.product_id,
      unitCost: row.unit_cost,
      unitPrice: row.unit_price,
      stockQuantity: row.stock_quantity,
      reorderLevel: row.reorder_level,
      status: row.status === 1,
      product: {
        id: row.product_id,
        name: row.p_name,
        categoryId: row.category_id,
        category: row.category_id ? { id: row.category_id, name: row.cat_name } : null
      }
    };
  }

  async listOrderableVariants(tenantId, filters = {}) {
    const includeOutOfStock = filters.context === "purchase_order";
    const sql = `
      SELECT pv.*, p.name as p_name, p.category_id, c.name as cat_name
      FROM product_variants pv
      JOIN products p ON pv.product_id = p.id AND p.tenant_id = pv.tenant_id
      LEFT JOIN categories c ON p.category_id = c.id AND c.tenant_id = pv.tenant_id
      WHERE pv.tenant_id = ? AND pv.delete_flg = 0 AND pv.status = 1
        AND p.delete_flg = 0 AND p.status = 1
    `;
    const params = [tenantId];
    let nextSql = sql;

    if (typeof filters.categoryId === "number") {
      nextSql += " AND p.category_id = ?";
      params.push(filters.categoryId);
    }

    if (filters.search) {
      nextSql += " AND (pv.name LIKE ? OR p.name LIKE ?)";
      const searchPattern = `%${filters.search}%`;
      params.push(searchPattern, searchPattern);
    }

    nextSql += " ORDER BY p.name ASC, pv.name ASC";

    const rows = await query(nextSql, params);
    const branchAwareRows = await this._applyBranchStockQuantities(tenantId, rows, filters.branchId ?? null);
    const filteredRows = includeOutOfStock
      ? branchAwareRows
      : branchAwareRows.filter((row) => Number(row.stock_quantity ?? 0) > 0);

    return filteredRows.map(row => ({
      ...row,
      unitCost: row.unit_cost,
      unitPrice: row.unit_price,
      stockQuantity: row.stock_quantity,
      reorderLevel: row.reorder_level,
      status: row.status === 1,
      product: {
        id: row.product_id,
        name: row.p_name,
        categoryId: row.category_id,
        category: row.category_id ? { id: row.category_id, name: row.cat_name } : null
      }
    }));
  }

  async findInventoryOverviewVariants(tenantId, filters = {}) {
    let sql = `
      SELECT pv.*, p.name as p_name, p.category_id, c.name as cat_name
      FROM product_variants pv
      JOIN products p ON pv.product_id = p.id AND p.tenant_id = pv.tenant_id
      LEFT JOIN categories c ON p.category_id = c.id AND c.tenant_id = pv.tenant_id
      WHERE pv.tenant_id = ? AND pv.delete_flg = 0 AND pv.status = 1
        AND p.delete_flg = 0 AND p.status = 1
    `;
    const params = [tenantId];

    if (typeof filters.categoryId === "number") {
      sql += " AND p.category_id = ?";
      params.push(filters.categoryId);
    }

    if (filters.search) {
      sql += " AND (pv.name LIKE ? OR p.name LIKE ? OR c.name LIKE ?)";
      const searchPattern = `%${filters.search}%`;
      params.push(searchPattern, searchPattern, searchPattern);
    }

    sql += " ORDER BY p.name ASC, pv.name ASC";

    const rows = await query(sql, params);
    const branchAwareRows = await this._applyBranchStockQuantities(tenantId, rows, filters.branchId ?? null);
    return branchAwareRows.map(row => ({
      ...row,
      unitCost: row.unit_cost,
      unitPrice: row.unit_price,
      stockQuantity: row.stock_quantity,
      reorderLevel: row.reorder_level,
      status: row.status === 1,
      product: {
        id: row.product_id,
        name: row.p_name,
        categoryId: row.category_id,
        category: row.category_id ? { id: row.category_id, name: row.cat_name } : null
      }
    }));
  }

  async sumReservedQuantitiesByVariantIds(tenantId, variantIds = [], options = {}) {
    if (variantIds.length === 0) return [];

    const params = [tenantId, tenantId, variantIds];

    let sql = `
      SELECT soi.product_variant_id as productVariantId, SUM(soi.quantity) as _sum_quantity
      FROM sales_order_items soi
      JOIN sales_orders so ON soi.sales_order_id = so.id AND so.tenant_id = soi.tenant_id
      WHERE soi.tenant_id = ?
        AND so.tenant_id = ?
        AND soi.product_variant_id IN (?)
        AND so.delete_flg = 0
        AND so.status = 'processing'
    `;

    if (options.branchId) {
      sql += " AND so.branch_id = ?";
      params.push(Number(options.branchId));
    }

    if (options.excludeSalesOrderId) {
      sql += " AND soi.sales_order_id <> ?";
      params.push(Number(options.excludeSalesOrderId));
    }

    sql += " GROUP BY soi.product_variant_id";

    const rows = await query(sql, params);
    return rows.map(r => ({
      productVariantId: r.productVariantId,
      _sum: { quantity: r._sum_quantity }
    }));
  }

  async listBrochureByCategory(tenantId) {
    const categories = await query("SELECT * FROM categories WHERE tenant_id = ? AND delete_flg = 0 AND status = 1 ORDER BY name ASC", [tenantId]);
    if (categories.length === 0) return [];

    const catIds = categories.map(c => c.id);
    const products = await query(`
      SELECT * FROM products 
      WHERE tenant_id = ? AND category_id IN (?) AND delete_flg = 0 AND status = 1 
      ORDER BY name ASC
    `, [tenantId, catIds]);

    if (products.length === 0) {
      return categories.map(c => ({ ...c, products: [] }));
    }

    const productIds = products.map(p => p.id);
    const variants = await query(`
      SELECT id, product_id, name, unit_price 
      FROM product_variants 
      WHERE tenant_id = ? AND product_id IN (?) AND delete_flg = 0 AND status = 1 
      ORDER BY name ASC
    `, [tenantId, productIds]);

    return categories.map(c => {
      const catProducts = products
        .filter(p => Number(p.category_id) === Number(c.id))
        .map(p => {
          const pVariants = variants
            .filter(v => Number(v.product_id) === Number(p.id))
            .map(v => ({
              id: v.id,
              name: v.name,
              unitPrice: v.unit_price
            }));
          
          return {
            id: p.id,
            name: p.name,
            fileUrl: p.file_url,
            variants: pVariants
          };
        });
      
      return {
        id: c.id,
        name: c.name,
        products: catProducts
      };
    });
  }

  async createVariant(data) {
    const sql = `
      INSERT INTO product_variants (
        tenant_id, product_id, name, unit_cost, unit_price, stock_quantity, reorder_level, status, created_ip, updated_ip
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const result = await query(sql, [
      data.tenantId, data.productId, data.name, data.unitCost || 0,
      data.unitPrice || 0, data.stockQuantity || 0, data.reorderLevel || 0,
      data.status !== undefined ? (data.status ? 1 : 0) : 1,
      data.createdIp || null, data.updatedIp || null
    ]);
    return this.findVariantById(data.tenantId, result.insertId);
  }

  async updateVariant(tenantId, id, data) {
    const fields = [];
    const params = [];

    const map = {
      name: 'name',
      unitCost: 'unit_cost',
      unitPrice: 'unit_price',
      stockQuantity: 'stock_quantity',
      reorderLevel: 'reorder_level',
      status: 'status',
      updatedIp: 'updated_ip',
      deleteFlag: 'delete_flg'
    };

    for (const [key, column] of Object.entries(map)) {
      if (data[key] !== undefined) {
        fields.push(`${column} = ?`);
        params.push(key === 'status' || key === 'deleteFlag' ? (data[key] ? 1 : 0) : data[key]);
      }
    }

    if (fields.length > 0) {
      const sql = `UPDATE product_variants SET ${fields.join(', ')} WHERE tenant_id = ? AND id = ?`;
      params.push(tenantId, id);
      await query(sql, params);
    }

    return this.findVariantById(tenantId, id);
  }

  async softDeleteProduct(tenantId, id, ipAddress = null) {
    return transaction(async (tx) => {
      await tx.execute(
        "UPDATE product_variants SET delete_flg = 1, status = 0, updated_ip = ? WHERE tenant_id = ? AND product_id = ? AND delete_flg = 0",
        [ipAddress, tenantId, id]
      );
      await tx.execute(
        "UPDATE products SET delete_flg = 1, status = 0, updated_ip = ? WHERE tenant_id = ? AND id = ?",
        [ipAddress, tenantId, id]
      );
    });
  }

  _mapProduct(p, variants) {
    return {
      id: p.id,
      name: p.name,
      description: p.description,
      categoryId: p.category_id,
      fileUrl: p.file_url,
      status: p.status === 1,
      createdAt: p.created_at,
      updatedAt: p.updated_at,
      category: p.category_id ? { id: p.category_id, name: p.cat_name, status: p.cat_status === 1 } : null,
      variants: variants.map(v => ({
        id: v.id,
        productId: v.product_id,
        name: v.name,
        unitCost: v.unit_cost,
        unitPrice: v.unit_price,
        stockQuantity: v.stock_quantity,
        reorderLevel: v.reorder_level,
        status: v.status === 1,
        createdAt: v.created_at,
        updatedAt: v.updated_at
      }))
    };
  }

  async _applyBranchStockQuantities(tenantId, variants = [], branchId = null) {
    if (!branchId || variants.length === 0) {
      return variants;
    }

    const { quantities } = await getBranchInventoryQuantities({
      tenantId,
      branchId,
      variantIds: variants.map((variant) => Number(variant.id))
    });

    return variants.map((variant) => ({
      ...variant,
      stock_quantity: quantities.has(Number(variant.id))
        ? Number(quantities.get(Number(variant.id)))
        : 0
    }));
  }
}
