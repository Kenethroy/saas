import { query, transaction } from "#shared/database/mysql";
import { AppError } from "#shared/utils/app-error";
import { applyBranchInventoryDelta } from "#shared/utils/branch-inventory";

async function validateReturnQuantities(tx, tenantId, returnId, invoiceId, items) {
  if (!invoiceId) return [];

  const [invoiceItems] = await tx.execute(`
    SELECT ii.*, pv.name as variant_name
    FROM invoice_items ii
    JOIN product_variants pv ON ii.product_variant_id = pv.id AND pv.tenant_id = ii.tenant_id
    WHERE ii.tenant_id = ? AND ii.invoice_id = ?
  `, [tenantId, invoiceId]);

  const invoiceQtyMap = new Map();
  const variantNamesMap = new Map();
  for (const ii of invoiceItems) {
    const vId = ii.product_variant_id.toString();
    invoiceQtyMap.set(vId, Number(ii.quantity));
    variantNamesMap.set(vId, ii.variant_name);
  }

  let sql = `
    SELECT cri.*
    FROM customer_return_items cri
    JOIN customer_returns cr ON cri.customer_return_id = cr.id AND cr.tenant_id = cri.tenant_id
    WHERE cr.tenant_id = ? AND cr.invoice_id = ? AND cr.delete_flg = 0 AND cr.status <> 'rejected'
  `;
  const params = [tenantId, invoiceId];
  if (returnId) {
    sql += " AND cr.id <> ?";
    params.push(returnId);
  }

  const [existingItems] = await tx.execute(sql, params);
  const returnedQtyMap = new Map();
  for (const item of existingItems) {
    const vId = item.product_variant_id.toString();
    returnedQtyMap.set(vId, (returnedQtyMap.get(vId) || 0) + Number(item.quantity));
  }

  const requestedQtyMap = new Map();
  for (const item of items) {
    const vId = item.productVariantId.toString();
    requestedQtyMap.set(vId, (requestedQtyMap.get(vId) || 0) + Number(item.quantity));
  }

  for (const [vId, reqQty] of requestedQtyMap.entries()) {
    const invoicedQty = invoiceQtyMap.get(vId) || 0;
    const previouslyReturnedQty = returnedQtyMap.get(vId) || 0;
    const availableToReturn = invoicedQty - previouslyReturnedQty;
    const variantName = variantNamesMap.get(vId) || `Variant ${vId}`;

    if (invoicedQty === 0) {
      throw new AppError(`${variantName} is not part of the selected invoice.`, 422);
    }

    if (reqQty > availableToReturn) {
      if (availableToReturn <= 0) {
        throw new AppError(`${variantName} has already been fully returned for this invoice.`, 422);
      }

      throw new AppError(`Cannot return ${reqQty} of ${variantName}. Only ${availableToReturn} left to return.`, 422);
    }
  }

  return invoiceItems;
}

export class CustomerReturnsRepository {
  async findAll(tenantId, {
    page = 1,
    perPage = 10,
    search = "",
    status = "",
    reason = "",
    sortField = "created_at",
    sortOrder = "desc",
    branchId = null
  }) {
    const offset = (page - 1) * perPage;
    let sql = `
      FROM customer_returns cr
      JOIN customers c ON cr.customer_id = c.id AND c.tenant_id = cr.tenant_id
      LEFT JOIN invoices i ON cr.invoice_id = i.id AND i.tenant_id = cr.tenant_id
      WHERE cr.tenant_id = ? AND cr.delete_flg = 0
    `;
    const params = [tenantId];

    if (branchId) {
      sql += " AND cr.branch_id = ?";
      params.push(branchId);
    }

    if (search) {
      sql += " AND (cr.rma_number LIKE ? OR c.name LIKE ? OR i.invoice_number LIKE ?)";
      const pattern = `%${search}%`;
      params.push(pattern, pattern, pattern);
    }

    if (status) {
      sql += " AND cr.status = ?";
      params.push(status);
    }

    if (reason) {
      sql += " AND cr.reason LIKE ?";
      params.push(`%${reason}%`);
    }

    const countSql = `SELECT COUNT(*) as total ${sql}`;
    const dataSql = `
      SELECT cr.*, c.name as customer_name, i.invoice_number,
             (SELECT COUNT(*) FROM customer_return_items cri WHERE cri.tenant_id = cr.tenant_id AND cri.customer_return_id = cr.id) as items_count
      ${sql}
      ORDER BY cr.${sortField} ${sortOrder}
      LIMIT ? OFFSET ?
    `;
    const dataParams = [...params, perPage, offset];

    const [countRows, rows] = await Promise.all([
      query(countSql, params),
      query(dataSql, dataParams)
    ]);

    return {
      items: rows.map((row) => ({
        ...row,
        id: row.id,
        rmaNumber: row.rma_number,
        customerId: row.customer_id,
        invoiceId: row.invoice_id,
        requestDate: row.request_date,
        totalAmount: Number(row.total_amount),
        customer: { name: row.customer_name },
        invoice: row.invoice_id ? { invoiceNumber: row.invoice_number } : null,
        _count: { items: row.items_count }
      })),
      total: countRows[0].total,
      page,
      perPage,
      lastPage: Math.ceil(countRows[0].total / perPage)
    };
  }

  async findById(tenantId, id) {
    const rows = await query(`
      SELECT cr.*, c.name as customer_name, i.invoice_number
      FROM customer_returns cr
      JOIN customers c ON cr.customer_id = c.id AND c.tenant_id = cr.tenant_id
      LEFT JOIN invoices i ON cr.invoice_id = i.id AND i.tenant_id = cr.tenant_id
      WHERE cr.tenant_id = ? AND cr.id = ? AND cr.delete_flg = 0
      LIMIT 1
    `, [tenantId, id]);
    if (!rows[0]) return null;

    const row = rows[0];
    const items = await query(`
      SELECT cri.*, p.name as product_name, pv.name as variant_name
      FROM customer_return_items cri
      JOIN products p ON cri.product_id = p.id AND p.tenant_id = cri.tenant_id
      JOIN product_variants pv ON cri.product_variant_id = pv.id AND pv.tenant_id = cri.tenant_id
      WHERE cri.tenant_id = ? AND cri.customer_return_id = ?
    `, [tenantId, id]);

    return {
      ...row,
      id: row.id,
      rmaNumber: row.rma_number,
      customerId: row.customer_id,
      invoiceId: row.invoice_id,
      requestDate: row.request_date,
      totalAmount: Number(row.total_amount),
      customer: { name: row.customer_name },
      invoice: row.invoice_id ? { invoiceNumber: row.invoice_number } : null,
      items: items.map((item) => ({
        ...item,
        id: item.id,
        unitPrice: Number(item.unit_price),
        lineTotal: Number(item.line_total),
        restockFlag: Boolean(item.restock_flg)
      }))
    };
  }

  async countAll(tenantId, branchId = null) {
    let sql = "SELECT COUNT(*) as count FROM customer_returns WHERE tenant_id = ?";
    const params = [tenantId];

    if (branchId) {
      sql += " AND branch_id = ?";
      params.push(branchId);
    }

    const rows = await query(sql, params);
    return rows[0].count;
  }

  async resolveValidatedItems(tenantId, returnId, invoiceId, items) {
    return transaction(async (tx) => {
      const invoiceItems = await validateReturnQuantities(tx, tenantId, returnId, invoiceId, items);
      const invoiceItemsMap = new Map(
        invoiceItems.map((item) => [item.product_variant_id.toString(), Number(item.unit_price)])
      );
      const variantIds = items.map((item) => item.productVariantId);
      const variants = variantIds.length
        ? await tx.execute(`
            SELECT pv.*, p.name as product_name
            FROM product_variants pv
            JOIN products p ON pv.product_id = p.id AND p.tenant_id = pv.tenant_id
            WHERE pv.tenant_id = ? AND pv.id IN (?)
          `, [tenantId, variantIds]).then(([rows]) => rows)
        : [];
      const variantMap = new Map(variants.map((variant) => [variant.id.toString(), variant]));

      const resolvedItems = items.map((item) => {
        const variantId = item.productVariantId.toString();
        const variant = variantMap.get(variantId);
        if (!variant) {
          throw new AppError(`Variant ${item.productVariantId} not found`, 404);
        }

        const unitPrice = invoiceItemsMap.has(variantId)
          ? invoiceItemsMap.get(variantId)
          : Number(variant.unit_price);

        return {
          productId: variant.product_id,
          productVariantId: variant.id,
          productName: variant.product_name,
          variantName: variant.name,
          quantity: Number(item.quantity),
          unitPrice,
          lineTotal: unitPrice * Number(item.quantity),
          restockFlag: item.restockFlag ?? false
        };
      });

      return {
        resolvedItems,
        totalAmount: resolvedItems.reduce((sum, item) => sum + item.lineTotal, 0)
      };
    });
  }

  async createResolvedReturn(data) {
    const { items, ...returnData } = data;
    return transaction(async (tx) => {
      const [result] = await tx.execute(`
        INSERT INTO customer_returns (
          tenant_id, branch_id, rma_number, customer_id, invoice_id, request_date, reason, disposition,
          status, total_amount, notes, created_ip, updated_ip
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?)
      `, [
        returnData.tenantId,
        returnData.branchId ?? null,
        returnData.rmaNumber,
        returnData.customerId,
        returnData.invoiceId || null,
        returnData.requestDate,
        returnData.reason,
        returnData.disposition,
        returnData.totalAmount,
        returnData.notes || null,
        returnData.ipAddress,
        returnData.ipAddress
      ]);

      const returnId = result.insertId;
      for (const item of items) {
        await tx.execute(`
          INSERT INTO customer_return_items (
            tenant_id, customer_return_id, product_id, product_variant_id, product_name, variant_name,
            quantity, unit_price, line_total, restock_flg
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          returnData.tenantId,
          returnId,
          item.productId,
          item.productVariantId,
          item.productName,
          item.variantName,
          item.quantity,
          item.unitPrice,
          item.lineTotal,
          item.restockFlag ? 1 : 0
        ]);
      }

      return returnId;
    }).then((id) => this.findById(returnData.tenantId, id));
  }

  async updateResolvedReturn(tenantId, id, data) {
    const { items, ...returnData } = data;
    return transaction(async (tx) => {
      if (items) {
        await tx.execute("DELETE FROM customer_return_items WHERE tenant_id = ? AND customer_return_id = ?", [tenantId, id]);
        for (const item of items) {
          await tx.execute(`
            INSERT INTO customer_return_items (
              tenant_id, customer_return_id, product_id, product_variant_id, product_name, variant_name,
              quantity, unit_price, line_total, restock_flg
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            tenantId,
            id,
            item.productId,
            item.productVariantId,
            item.productName,
            item.variantName,
            item.quantity,
            item.unitPrice,
            item.lineTotal,
            item.restockFlag ? 1 : 0
          ]);
        }
      }

      await tx.execute(`
        UPDATE customer_returns SET
          branch_id = ?, customer_id = ?, invoice_id = ?, request_date = ?, reason = ?, disposition = ?,
          total_amount = ?, notes = ?, updated_ip = ?
        WHERE tenant_id = ? AND id = ?
      `, [
        returnData.branchId ?? null,
        returnData.customerId,
        returnData.invoiceId || null,
        returnData.requestDate,
        returnData.reason,
        returnData.disposition,
        returnData.totalAmount ?? null,
        returnData.notes || null,
        returnData.ipAddress,
        tenantId,
        id
      ]);

      return id;
    }).then((resultId) => this.findById(tenantId, resultId));
  }

  async approveReturn(tenantId, id, context = {}) {
    const ipAddress = context.ipAddress || null;
    const userId = context.userId || null;

    return transaction(async (tx) => {
      const [returns] = await tx.execute("SELECT * FROM customer_returns WHERE tenant_id = ? AND id = ? AND delete_flg = 0", [tenantId, id]);
      if (returns.length === 0) throw new AppError("Return record not found.", 404);
      const returnRecord = returns[0];
      if (returnRecord.status !== "pending") throw new AppError("Only pending returns can be approved.", 422);

      const [items] = await tx.execute("SELECT * FROM customer_return_items WHERE tenant_id = ? AND customer_return_id = ?", [tenantId, id]);
      const effectiveBranchId = returnRecord.branch_id ? Number(returnRecord.branch_id) : (context.branchId ? Number(context.branchId) : null);

      for (const item of items) {
        if (!item.restock_flg) continue;

        const movement = await applyBranchInventoryDelta(tx, {
          tenantId,
          branchId: effectiveBranchId,
          productVariantId: item.product_variant_id,
          quantityChange: Number(item.quantity ?? 0)
        });

        await tx.execute(`
          INSERT INTO inventory_transactions (
            tenant_id, branch_id, product_id, product_variant_id, quantity_before, quantity_change, quantity_after,
            transaction_type, reference_type, reference_id, reason, created_by, created_ip, updated_ip
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 4, 'customer_return', ?, ?, ?, ?, ?)
        `, [
          tenantId,
          movement.branchId,
          movement.productId,
          item.product_variant_id,
          movement.quantityBefore,
          item.quantity,
          movement.quantityAfter,
          id,
          `Return ${returnRecord.rma_number} approved - Restocked`,
          userId,
          ipAddress,
          ipAddress
        ]);
      }

      let remainingCredit = Number(returnRecord.total_amount);
      const customerId = returnRecord.customer_id;

      if (remainingCredit > 0 && returnRecord.invoice_id) {
        const [receivableRows] = await tx.execute(
          "SELECT * FROM accounts_receivable WHERE tenant_id = ? AND invoice_id = ? AND delete_flg = 0",
          [tenantId, returnRecord.invoice_id]
        );
        if (receivableRows.length > 0) {
          const receivable = receivableRows[0];
          if (receivable.status !== "paid") {
            const toApply = Math.min(remainingCredit, Number(receivable.outstanding_amount));
            const newPaidAmount = Number(receivable.paid_amount) + toApply;
            const newOutstandingAmount = Number(receivable.amount) - newPaidAmount;

            await tx.execute(`
              INSERT INTO return_allocations (
                tenant_id, customer_return_id, accounts_receivable_id, amount_allocated, created_ip, updated_ip
              ) VALUES (?, ?, ?, ?, ?, ?)
            `, [tenantId, id, receivable.id, toApply, ipAddress, ipAddress]);

            await tx.execute(`
              UPDATE accounts_receivable
              SET paid_amount = ?, outstanding_amount = ?, status = ?
              WHERE tenant_id = ? AND id = ?
            `, [
              newPaidAmount,
              newOutstandingAmount,
              newOutstandingAmount <= 0 ? "paid" : "partial",
              tenantId,
              receivable.id
            ]);

            remainingCredit -= toApply;
          }
        }
      }

      if (remainingCredit > 0) {
        const [unpaidReceivables] = await tx.execute(`
          SELECT * FROM accounts_receivable
          WHERE tenant_id = ? AND customer_id = ? AND delete_flg = 0 AND status IN ('unpaid', 'partial')
          ORDER BY invoice_date ASC
        `, [tenantId, customerId]);

        for (const receivable of unpaidReceivables) {
          if (remainingCredit <= 0) break;

          const toApply = Math.min(remainingCredit, Number(receivable.outstanding_amount));
          const newPaidAmount = Number(receivable.paid_amount) + toApply;
          const newOutstandingAmount = Number(receivable.amount) - newPaidAmount;

          await tx.execute(`
            INSERT INTO return_allocations (
              tenant_id, customer_return_id, accounts_receivable_id, amount_allocated, created_ip, updated_ip
            ) VALUES (?, ?, ?, ?, ?, ?)
          `, [tenantId, id, receivable.id, toApply, ipAddress, ipAddress]);

          await tx.execute(`
            UPDATE accounts_receivable
            SET paid_amount = ?, outstanding_amount = ?, status = ?
            WHERE tenant_id = ? AND id = ?
          `, [
            newPaidAmount,
            newOutstandingAmount,
            newOutstandingAmount <= 0 ? "paid" : "partial",
            tenantId,
            receivable.id
          ]);

          remainingCredit -= toApply;
        }
      }

      let notes = returnRecord.notes || "";
      if (remainingCredit > 0) {
        notes += `\n[SYSTEM] Excess credit of ${remainingCredit.toFixed(2)} remains.`;
      }

      await tx.execute(
        "UPDATE customer_returns SET status = 'completed', notes = ?, updated_ip = ? WHERE tenant_id = ? AND id = ?",
        [notes, ipAddress, tenantId, id]
      );

      return { success: true, remainingCredit };
    });
  }

  async rejectReturn(tenantId, id, reason, context = {}) {
    const ipAddress = context.ipAddress || null;
    const returns = await query("SELECT * FROM customer_returns WHERE tenant_id = ? AND id = ?", [tenantId, id]);
    if (returns.length === 0 || returns[0].status !== "pending") {
      throw new AppError("Return not found or cannot be rejected.", 422);
    }

    const notes = (returns[0].notes || "") + `\n[REJECTED] Reason: ${reason}`;
    await query(
      "UPDATE customer_returns SET status = 'rejected', notes = ?, updated_ip = ? WHERE tenant_id = ? AND id = ?",
      [notes, ipAddress, tenantId, id]
    );
    return { success: true };
  }

  async softDelete(tenantId, id) {
    await query("UPDATE customer_returns SET delete_flg = 1 WHERE tenant_id = ? AND id = ?", [tenantId, id]);
  }

  async findCustomerInvoices(tenantId, customerId, branchId = null) {
    let sql = `
      SELECT i.*
      FROM invoices i
      WHERE i.tenant_id = ? AND i.customer_id = ? AND i.delete_flg = 0
    `;
    const params = [tenantId, customerId];

    if (branchId) {
      sql += " AND i.branch_id = ?";
      params.push(branchId);
    }

    sql += " ORDER BY i.invoice_date DESC";

    const invoices = await query(sql, params);

    return Promise.all(invoices.map(async (invoice) => {
      const items = await query("SELECT * FROM invoice_items WHERE tenant_id = ? AND invoice_id = ?", [tenantId, invoice.id]);
      return { ...invoice, items };
    }));
  }
}
