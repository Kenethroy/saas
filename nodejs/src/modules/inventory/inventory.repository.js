import { query, transaction } from "#shared/database/mysql";

export class InventoryRepository {
  async findPaginatedTransactions({ page, perPage, productId, productVariantId, transactionType, referenceType, search, sortOrder = 'desc' }) {
    const offset = (page - 1) * perPage;

    let sql = `
      FROM inventory_transactions it
      JOIN products p ON it.product_id = p.id
      JOIN product_variants pv ON it.product_variant_id = pv.id
      WHERE 1=1
    `;
    const params = [];

    if (productId) {
      sql += " AND it.product_id = ?";
      params.push(productId);
    }

    if (productVariantId) {
      sql += " AND it.product_variant_id = ?";
      params.push(productVariantId);
    }

    if (transactionType) {
      sql += " AND it.transaction_type = ?";
      params.push(transactionType);
    }

    if (referenceType) {
      sql += " AND it.reference_type = ?";
      params.push(referenceType);
    }

    if (search) {
      sql += " AND (p.name LIKE ? OR pv.name LIKE ? OR it.reason LIKE ? OR it.reference_type LIKE ?)";
      const pattern = `%${search}%`;
      params.push(pattern, pattern, pattern, pattern);
    }

    const countSql = `SELECT COUNT(*) as total ${sql}`;
    const dataSql = `
      SELECT it.*, p.name as product_name, pv.name as variant_name
      ${sql}
      ORDER BY it.created_at ${sortOrder}, it.id ${sortOrder}
      LIMIT ? OFFSET ?
    `;
    const dataParams = [...params, perPage, offset];

    const [countRows, rows] = await Promise.all([
      query(countSql, params),
      query(dataSql, dataParams)
    ]);

    return {
      rows: rows.map(row => ({
        ...row,
        id: row.id,
        productId: row.product_id,
        productVariantId: row.product_variant_id,
        quantityBefore: row.quantity_before,
        quantityChange: row.quantity_change,
        quantityAfter: row.quantity_after,
        transactionType: row.transaction_type,
        referenceType: row.reference_type,
        referenceId: row.reference_id,
        createdBy: row.created_by,
        createdAt: row.created_at,
        product: { name: row.product_name },
        productVariant: { name: row.variant_name }
      })),
      total: countRows[0].total
    };
  }

  async applyStockAdjustment(payload, context = {}) {
    const { ipAddress, userId } = context;

    return transaction(async (tx) => {
      const [vRows] = await tx.execute("SELECT id, product_id, stock_quantity, name FROM product_variants WHERE id = ? AND delete_flg = 0", [payload.productVariantId]);
      if (vRows.length === 0) throw new Error("Product variant not found");
      const variant = vRows[0];

      const before = Number(variant.stock_quantity || 0);
      const change = Number(payload.quantityChange || 0);
      const after = before + change;

      if (!Number.isFinite(after) || after < 0) {
        throw new Error("Stock adjustment would result in negative stock.");
      }

      await tx.execute("UPDATE product_variants SET stock_quantity = ?, updated_ip = ? WHERE id = ?", [after, ipAddress, variant.id]);

      const [itResult] = await tx.execute(`
        INSERT INTO inventory_transactions (
          product_id, product_variant_id, quantity_before, quantity_change, quantity_after,
          transaction_type, reference_type, reference_id, reason, created_by, created_ip, updated_ip
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        variant.product_id, variant.id, before, change, after,
        3, "stock_adjustment", null, payload.reason || `Stock adjustment for ${variant.name}`,
        userId || null, ipAddress, ipAddress
      ]);

      const [finalRow] = await tx.execute(`
        SELECT it.*, p.name as product_name, pv.name as variant_name
        FROM inventory_transactions it
        JOIN products p ON it.product_id = p.id
        JOIN product_variants pv ON it.product_variant_id = pv.id
        WHERE it.id = ?
      `, [itResult.insertId]);

      return finalRow[0];
    });
  }
}
