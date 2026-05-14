import { query, transaction } from "#shared/database/mysql";
import { AppError } from "#shared/utils/app-error";

let restockFlagColumnAvailablePromise;

function pad4(value) {
  return String(value).padStart(4, "0");
}

function normalizeQuantityChange(rawChange, restockFlag) {
  const numeric = Number(rawChange);
  if (!Number.isFinite(numeric) || numeric === 0) {
    return numeric;
  }

  const magnitude = Math.abs(Math.trunc(numeric));
  return restockFlag ? magnitude : -magnitude;
}

function yyyymm(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}${month}`;
}

async function generateAdjustmentNumber(tx, adjustmentDate) {
  const period = yyyymm(adjustmentDate);
  const prefix = `AJD-${period}-`;

  const [rows] = await tx.execute(`
    SELECT adjustment_number AS adjustmentNumber
    FROM inventory_adjustments
    WHERE adjustment_number LIKE ?
    ORDER BY id DESC
    LIMIT 1
  `, [`${prefix}%`]);

  const latest = rows[0]?.adjustmentNumber ?? null;
  const latestSeq = typeof latest === "string" ? Number(latest.slice(prefix.length)) : 0;
  const nextSeq = Number.isFinite(latestSeq) && latestSeq > 0 ? latestSeq + 1 : 1;
  return `${prefix}${pad4(nextSeq)}`;
}

async function hasRestockFlagColumn(connection = null) {
  if (!connection) {
    if (!restockFlagColumnAvailablePromise) {
      restockFlagColumnAvailablePromise = query("SHOW COLUMNS FROM inventory_adjustment_items LIKE 'restock_flag'")
        .then((rows) => rows.length > 0)
        .catch(() => false);
    }

    return restockFlagColumnAvailablePromise;
  }

  const [rows] = await connection.execute("SHOW COLUMNS FROM inventory_adjustment_items LIKE 'restock_flag'");
  return rows.length > 0;
}

export class StockAdjustmentsRepository {
  async findPaginated({ page, perPage, search, status, reason, sortOrder = 'DESC' }) {
    const offset = (page - 1) * perPage;

    let sql = "FROM inventory_adjustments ia WHERE ia.delete_flg = 0";
    const params = [];

    if (status) {
      sql += " AND ia.status = ?";
      params.push(status);
    }

    if (search) {
      sql += " AND (ia.adjustment_number LIKE ? OR ia.reason LIKE ? OR ia.remarks LIKE ?)";
      const like = `%${search}%`;
      params.push(like, like, like);
    }

    if (reason) {
      sql += " AND ia.reason = ?";
      params.push(reason);
    }

    const countSql = `SELECT COUNT(*) as total ${sql}`;
    const dataSql = `
      SELECT
        ia.id,
        ia.adjustment_number AS adjustmentNumber,
        ia.adjustment_date AS adjustmentDate,
        ia.reason,
        ia.remarks,
        ia.status,
        ia.reject_reason AS rejectReason,
        ia.created_by AS createdBy,
        ia.created_at AS createdAt,
        ia.updated_at AS updatedAt,
        (SELECT COUNT(*) FROM inventory_adjustment_items i WHERE i.inventory_adjustment_id = ia.id) AS itemCount
      ${sql}
      ORDER BY ia.adjustment_date ${sortOrder}, ia.id ${sortOrder}
      LIMIT ? OFFSET ?
    `;
    const dataParams = [...params, perPage, offset];

    const [countRows, rows] = await Promise.all([
      query(countSql, params),
      query(dataSql, dataParams)
    ]);

    return {
      rows,
      total: countRows[0].total
    };
  }

  async findById(id) {
    const restockFlagAvailable = await hasRestockFlagColumn();
    const sql = `
      SELECT
        ia.id,
        ia.adjustment_number AS adjustmentNumber,
        ia.adjustment_date AS adjustmentDate,
        ia.reason,
        ia.remarks,
        ia.status,
        ia.reject_reason AS rejectReason,
        ia.created_by AS createdBy,
        ia.created_at AS createdAt,
        ia.updated_at AS updatedAt,
        (SELECT COUNT(*) FROM inventory_adjustment_items i WHERE i.inventory_adjustment_id = ia.id) AS itemCount
      FROM inventory_adjustments ia
      WHERE ia.id = ? AND ia.delete_flg = 0
      LIMIT 1
    `;
    const rows = await query(sql, [id]);
    if (!rows[0]) return null;

    const header = rows[0];
    const items = await query(`
      SELECT
        id,
        product_id AS productId,
        product_variant_id AS productVariantId,
        ${restockFlagAvailable ? "restock_flag" : "1"} AS restockFlag,
        adjust_type AS adjustType,
        quantity_change AS quantityChange,
        quantity_before AS quantityBefore,
        quantity_after AS quantityAfter,
        notes
      FROM inventory_adjustment_items
      WHERE inventory_adjustment_id = ?
      ORDER BY id ASC
    `, [id]);

    return { ...header, items };
  }

  async findProductVariantsByIds(ids) {
    if (ids.length === 0) return [];
    const sql = `
      SELECT pv.*, p.name as p_name
      FROM product_variants pv
      JOIN products p ON pv.product_id = p.id
      WHERE pv.id IN (?) AND pv.delete_flg = 0
    `;
    const rows = await query(sql, [ids]);
    return rows.map(row => ({
      ...row,
      id: row.id,
      product: { name: row.p_name }
    }));
  }

  async updateStatus(id, status, ipAddress, rejectReason = null) {
    await query("UPDATE inventory_adjustments SET status = ?, updated_ip = ?, reject_reason = ? WHERE id = ?", [status, ipAddress, rejectReason, id]);
  }

  async softDelete(id, ipAddress) {
    await query("UPDATE inventory_adjustments SET delete_flg = 1, updated_ip = ? WHERE id = ?", [ipAddress, id]);
  }

  async create(payload, context = {}) {
    const ipAddress = context.ipAddress ?? null;
    const userId = context.userId ?? null;
    const adjustmentDate = payload.adjustmentDate ? new Date(payload.adjustmentDate) : new Date();
    const forceNonRestockable = payload.reason === "damaged" || payload.reason === "lost";

    const resultId = await transaction(async (tx) => {
      const restockFlagAvailable = await hasRestockFlagColumn(tx);
      const adjustmentNumber = await generateAdjustmentNumber(tx, adjustmentDate);

      const [adjustmentResult] = await tx.execute(`
        INSERT INTO inventory_adjustments
          (adjustment_number, adjustment_date, remarks, reason, created_by, status, reject_reason, delete_flg, created_ip, updated_ip)
        VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
      `, [
        adjustmentNumber, adjustmentDate, payload.remarks ?? null, payload.reason ?? null,
        userId || null, "draft", null, ipAddress, ipAddress
      ]);

      const adjustmentId = adjustmentResult.insertId;

      const variantIds = payload.items.map((item) => item.productVariantId);
      const [variants] = await tx.execute("SELECT id, product_id FROM product_variants WHERE id IN (?) AND delete_flg = 0", [variantIds]);
      if (variants.length !== variantIds.length) {
        throw new AppError("One or more variants were not found.", 404);
      }

      const variantMap = new Map(variants.map((variant) => [variant.id, variant]));

      for (const item of payload.items) {
        const variant = variantMap.get(item.productVariantId);
        const restockFlag = forceNonRestockable ? false : (item.restockFlag ?? true);
        const change = normalizeQuantityChange(item.quantityChange, restockFlag);
        const adjustType = change >= 0 ? "add" : "subtract";

        if (restockFlagAvailable) {
          await tx.execute(`
            INSERT INTO inventory_adjustment_items
              (inventory_adjustment_id, product_id, product_variant_id, adjust_type, quantity_change, restock_flag,
               quantity_before, quantity_after, notes, created_ip, updated_ip)
            VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?)
          `, [
            adjustmentId, variant.product_id, variant.id, adjustType, change, restockFlag ? 1 : 0,
            item.notes || null, ipAddress, ipAddress
          ]);
        } else {
          await tx.execute(`
            INSERT INTO inventory_adjustment_items
              (inventory_adjustment_id, product_id, product_variant_id, adjust_type, quantity_change,
               quantity_before, quantity_after, notes, created_ip, updated_ip)
            VALUES (?, ?, ?, ?, ?, 0, 0, ?, ?, ?)
          `, [
            adjustmentId, variant.product_id, variant.id, adjustType, change,
            item.notes || null, ipAddress, ipAddress
          ]);
        }
      }

      return adjustmentId;
    });

    return this.findById(resultId);
  }

  async update(id, payload, context = {}) {
    const ipAddress = context.ipAddress ?? null;
    const userId = context.userId ?? null;
    const adjustmentDate = payload.adjustmentDate ? new Date(payload.adjustmentDate) : null;
    const forceNonRestockable = payload.reason === "damaged" || payload.reason === "lost";

    await transaction(async (tx) => {
      const restockFlagAvailable = await hasRestockFlagColumn(tx);
      const [existingRows] = await tx.execute("SELECT status FROM inventory_adjustments WHERE id = ? AND delete_flg = 0", [id]);
      if (existingRows.length === 0) {
        throw new AppError("Stock adjustment not found", 404);
      }
      if (existingRows[0].status !== "draft") {
        throw new AppError("Only draft adjustments can be edited.", 422);
      }

      await tx.execute(`
        UPDATE inventory_adjustments
        SET
          adjustment_date = COALESCE(?, adjustment_date),
          remarks = ?,
          reason = ?,
          created_by = COALESCE(created_by, ?),
          updated_ip = ?
        WHERE id = ?
      `, [adjustmentDate, payload.remarks || null, payload.reason || null, userId || null, ipAddress, id]);

      await tx.execute("DELETE FROM inventory_adjustment_items WHERE inventory_adjustment_id = ?", [id]);

      const variantIds = payload.items.map((item) => item.productVariantId);
      const [variants] = await tx.execute("SELECT id, product_id FROM product_variants WHERE id IN (?) AND delete_flg = 0", [variantIds]);
      if (variants.length !== variantIds.length) {
        throw new AppError("One or more variants were not found.", 404);
      }

      const variantMap = new Map(variants.map((variant) => [variant.id, variant]));

      for (const item of payload.items) {
        const variant = variantMap.get(item.productVariantId);
        const restockFlag = forceNonRestockable ? false : (item.restockFlag ?? true);
        const change = normalizeQuantityChange(item.quantityChange, restockFlag);
        const adjustType = change >= 0 ? "add" : "subtract";

        if (restockFlagAvailable) {
          await tx.execute(`
            INSERT INTO inventory_adjustment_items
              (inventory_adjustment_id, product_id, product_variant_id, adjust_type, quantity_change, restock_flag,
               quantity_before, quantity_after, notes, created_ip, updated_ip)
            VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?)
          `, [
            id, variant.product_id, variant.id, adjustType, change, restockFlag ? 1 : 0,
            item.notes || null, ipAddress, ipAddress
          ]);
        } else {
          await tx.execute(`
            INSERT INTO inventory_adjustment_items
              (inventory_adjustment_id, product_id, product_variant_id, adjust_type, quantity_change,
               quantity_before, quantity_after, notes, created_ip, updated_ip)
            VALUES (?, ?, ?, ?, ?, 0, 0, ?, ?, ?)
          `, [
            id, variant.product_id, variant.id, adjustType, change,
            item.notes || null, ipAddress, ipAddress
          ]);
        }
      }
    });

    return this.findById(id);
  }

  async submit(id, context = {}) {
    const ipAddress = context.ipAddress ?? null;
    const header = await this.findById(id);
    if (!header) {
      throw new AppError("Stock adjustment not found", 404);
    }
    if (header.status !== "draft") {
      throw new AppError("Only draft adjustments can be submitted.", 422);
    }

    await this.updateStatus(id, "pending", ipAddress);
    return this.findById(id);
  }

  async approve(id, context = {}) {
    const ipAddress = context.ipAddress ?? null;
    const userId = context.userId ?? null;

    await transaction(async (tx) => {
      const restockFlagAvailable = await hasRestockFlagColumn(tx);
      const [headerRows] = await tx.execute("SELECT id, adjustment_number, reason, status FROM inventory_adjustments WHERE id = ? AND delete_flg = 0", [id]);
      const header = headerRows[0];
      if (!header) {
        throw new AppError("Stock adjustment not found", 404);
      }
      if (header.status !== "pending") {
        throw new AppError("Only pending adjustments can be approved.", 422);
      }

      const [items] = await tx.execute("SELECT * FROM inventory_adjustment_items WHERE inventory_adjustment_id = ?", [id]);

      for (const item of items) {
        const variantId = item.product_variant_id;
        const forceNonRestockable = header.reason === "damaged" || header.reason === "lost";
        const restockFlag = restockFlagAvailable ? Boolean(item.restock_flag) : !forceNonRestockable;
        const change = normalizeQuantityChange(item.quantity_change ?? 0, restockFlag);
        const adjustType = change >= 0 ? "add" : "subtract";

        if (change === 0) {
          continue;
        }
        if (forceNonRestockable && restockFlag) {
          throw new AppError("Damaged/Lost adjustments cannot be marked as restockable.", 422);
        }

        if (Number(item.quantity_change ?? 0) !== change || String(item.adjust_type ?? "") !== adjustType) {
          const updateFields = ["quantity_change = ?", "adjust_type = ?", "updated_ip = ?"];
          const updateParams = [change, adjustType, ipAddress, item.id];

          if (restockFlagAvailable) {
            updateFields.unshift("restock_flag = ?");
            updateParams.unshift(restockFlag ? 1 : 0);
          }

          await tx.execute(`UPDATE inventory_adjustment_items SET ${updateFields.join(", ")} WHERE id = ?`, updateParams);
        }

        if (change < 0) {
          const [updateResult] = await tx.execute(`
            UPDATE product_variants SET stock_quantity = stock_quantity - ? 
            WHERE id = ? AND delete_flg = 0 AND stock_quantity >= ?
          `, [Math.abs(change), variantId, Math.abs(change)]);
          if (updateResult.affectedRows === 0) {
            throw new AppError("Insufficient stock for one or more items.", 422);
          }
        } else {
          await tx.execute("UPDATE product_variants SET stock_quantity = stock_quantity + ? WHERE id = ? AND delete_flg = 0", [change, variantId]);
        }

        const [variantRows] = await tx.execute("SELECT stock_quantity, product_id FROM product_variants WHERE id = ?", [variantId]);
        const quantityAfter = Number(variantRows[0].stock_quantity);
        const quantityBefore = quantityAfter - change;

        await tx.execute("UPDATE inventory_adjustment_items SET quantity_before = ?, quantity_after = ? WHERE id = ?", [quantityBefore, quantityAfter, item.id]);

        await tx.execute(`
          INSERT INTO inventory_transactions (
            product_id, product_variant_id, quantity_before, quantity_change, quantity_after,
            transaction_type, reference_type, reference_id, reason, created_by, created_ip, updated_ip
          ) VALUES (?, ?, ?, ?, ?, 3, 'inventory_adjustment', ?, ?, ?, ?, ?)
        `, [
          variantRows[0].product_id, variantId, quantityBefore, change, quantityAfter,
          id, `Inventory adjustment approved - ${header.adjustment_number}${restockFlag ? "" : " (non-restockable)"}`,
          userId || null, ipAddress, ipAddress
        ]);
      }

      await tx.execute("UPDATE inventory_adjustments SET status = 'approved', reject_reason = NULL, updated_ip = ? WHERE id = ?", [ipAddress, id]);
    });

    return this.findById(id);
  }

  async reject(id, reason, context = {}) {
    const ipAddress = context.ipAddress ?? null;
    const header = await this.findById(id);
    if (!header) {
      throw new AppError("Stock adjustment not found", 404);
    }
    if (header.status !== "pending") {
      throw new AppError("Only pending adjustments can be rejected.", 422);
    }

    await this.updateStatus(id, "rejected", ipAddress, reason);
    return this.findById(id);
  }

  async delete(id, context = {}) {
    const ipAddress = context.ipAddress ?? null;
    const header = await this.findById(id);
    if (!header) {
      throw new AppError("Stock adjustment not found", 404);
    }
    if (header.status !== "draft") {
      throw new AppError("Only draft adjustments can be deleted.", 422);
    }

    await this.softDelete(id, ipAddress);
  }
}
