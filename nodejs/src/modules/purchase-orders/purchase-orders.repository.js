import { query, transaction } from "#shared/database/mysql";

export const purchaseOrdersRepository = {
  async findPaginated({ page, limit, search, status, supplierId }) {
    const offset = (page - 1) * limit;

    let sql = `
      FROM purchase_orders po
      JOIN suppliers s ON po.supplier_id = s.id
      LEFT JOIN payment_terms pt ON po.payment_term_id = pt.id
      WHERE po.delete_flg = 0
    `;
    const params = [];

    if (search) {
      sql += " AND (po.po_number LIKE ? OR s.name LIKE ?)";
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern);
    }

    if (status) {
      sql += " AND po.status = ?";
      params.push(status);
    }

    if (supplierId) {
      sql += " AND po.supplier_id = ?";
      params.push(supplierId);
    }

    const countSql = `SELECT COUNT(*) as total ${sql}`;
    const dataSql = `
      SELECT po.*, s.name as supplier_name, pt.name as pt_name,
        (SELECT COUNT(*) FROM purchase_order_items poi WHERE poi.purchase_order_id = po.id) as items_count
      ${sql}
      ORDER BY po.id DESC
      LIMIT ? OFFSET ?
    `;
    const dataParams = [...params, limit, offset];

    const [countRows, rows] = await Promise.all([
      query(countSql, params),
      query(dataSql, dataParams)
    ]);

    const formattedRows = rows.map(row => ({
      ...row,
      id: row.id,
      poNumber: row.po_number,
      supplierId: row.supplier_id,
      paymentTermId: row.payment_term_id,
      orderDate: row.order_date,
      expectedDate: row.expected_date,
      itemsSubtotal: row.items_subtotal,
      totalAmount: row.total_amount,
      receivedTotal: row.received_total,
      receivedAt: row.received_at,
      receivedNotes: row.received_notes,
      createdIp: row.created_ip,
      updatedIp: row.updated_ip,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      supplier: { id: row.supplier_id, name: row.supplier_name },
      paymentTerm: row.payment_term_id ? { id: row.payment_term_id, name: row.pt_name } : null,
      _count: { items: row.items_count }
    }));

    return { items: formattedRows, total: countRows[0].total };
  },

  async findById(id) {
    const sql = `
      SELECT
        po.*,
        s.name as supplier_name,
        s.company_name as supplier_company_name,
        s.contact_person as supplier_contact_person,
        s.email as supplier_email,
        s.phone as supplier_phone,
        s.address as supplier_address,
        pt.name as pt_name,
        pt.days as pt_days
      FROM purchase_orders po
      JOIN suppliers s ON po.supplier_id = s.id
      LEFT JOIN payment_terms pt ON po.payment_term_id = pt.id
      WHERE po.id = ? AND po.delete_flg = 0
      LIMIT 1
    `;
    const rows = await query(sql, [id]);
    if (!rows[0]) return null;

    const row = rows[0];
    const items = await query(`
      SELECT poi.*, pv.stock_quantity
      FROM purchase_order_items poi
      JOIN product_variants pv ON poi.product_variant_id = pv.id
      WHERE poi.purchase_order_id = ?
      ORDER BY poi.id ASC
    `, [id]);

    return {
      ...row,
      id: row.id,
      poNumber: row.po_number,
      supplierId: row.supplier_id,
      paymentTermId: row.payment_term_id,
      orderDate: row.order_date,
      expectedDate: row.expected_date,
      itemsSubtotal: row.items_subtotal,
      totalAmount: row.total_amount,
      receivedTotal: row.received_total,
      receivedAt: row.received_at,
      receivedNotes: row.received_notes,
      supplier: {
        id: row.supplier_id,
        name: row.supplier_name,
        companyName: row.supplier_company_name,
        contactPerson: row.supplier_contact_person,
        email: row.supplier_email,
        phone: row.supplier_phone,
        address: row.supplier_address
      },
      paymentTerm: row.payment_term_id ? { id: row.payment_term_id, name: row.pt_name, days: row.pt_days } : null,
      items: items.map(item => ({
        ...item,
        id: item.id,
        purchaseOrderId: item.purchase_order_id,
        productId: item.product_id,
        productVariantId: item.product_variant_id,
        productName: item.product_name,
        variantName: item.variant_name,
        unitCost: item.unit_cost,
        lineTotal: item.line_total,
        receivedQuantity: item.received_quantity,
        receivedUnitCost: item.received_unit_cost,
        receivedLineTotal: item.received_line_total,
        productVariant: { stockQuantity: item.stock_quantity }
      }))
    };
  },

  async findSupplierById(supplierId) {
    const sql = `
      SELECT s.*, pt.name as pt_name, pt.days as pt_days
      FROM suppliers s
      LEFT JOIN payment_terms pt ON s.payment_term_id = pt.id
      WHERE s.id = ? AND s.delete_flg = 0 AND s.status = 1
      LIMIT 1
    `;
    const rows = await query(sql, [supplierId]);
    if (!rows[0]) return null;
    const row = rows[0];
    return {
      ...row,
      paymentTerm: row.payment_term_id ? { id: row.payment_term_id, name: row.pt_name, days: row.pt_days } : null
    };
  },

  async findProductVariantsByIds(ids) {
    if (ids.length === 0) return [];
    const sql = `
      SELECT pv.*, p.name as p_name
      FROM product_variants pv
      JOIN products p ON pv.product_id = p.id
      WHERE pv.id IN (?) AND pv.delete_flg = 0 AND pv.status = 1
    `;
    const rows = await query(sql, [ids]);
    return rows.map(row => ({
      ...row,
      id: row.id,
      productId: row.product_id,
      unitCost: row.unit_cost,
      product: { name: row.p_name }
    }));
  },

  async findLatestOrder() {
    const rows = await query("SELECT * FROM purchase_orders ORDER BY id DESC LIMIT 1");
    if (!rows[0]) return null;
    return { ...rows[0], poNumber: rows[0].po_number };
  },

  async createWithItems(poData, items) {
    return transaction(async (tx) => {
      const pSql = `
        INSERT INTO purchase_orders (
          po_number, supplier_id, order_date, expected_date, payment_term_id,
          items_subtotal, total_amount, notes, created_ip, updated_ip, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      const [pResult] = await tx.execute(pSql, [
        poData.poNumber, poData.supplierId, poData.orderDate, poData.expectedDate, poData.paymentTermId,
        poData.itemsSubtotal, poData.totalAmount, poData.notes || null,
        poData.createdIp || null, poData.updatedIp || null, poData.status || 'pending'
      ]);

      const poId = pResult.insertId;

      for (const item of items) {
        const iSql = `
          INSERT INTO purchase_order_items (
            purchase_order_id, product_id, product_variant_id, product_name, variant_name,
            quantity, unit_cost, line_total
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;
        await tx.execute(iSql, [
          poId, item.productId, item.productVariantId, item.productName, item.variantName,
          item.quantity, item.unitCost, item.lineTotal
        ]);
      }

      return poId;
    }).then(id => this.findById(id));
  },

  async updateWithItems(id, poData, items) {
    return transaction(async (tx) => {
      const pSql = `
        UPDATE purchase_orders SET
          supplier_id = ?, order_date = ?, expected_date = ?, payment_term_id = ?,
          items_subtotal = ?, total_amount = ?, notes = ?, updated_ip = ?
        WHERE id = ?
      `;
      await tx.execute(pSql, [
        poData.supplierId, poData.orderDate, poData.expectedDate, poData.paymentTermId,
        poData.itemsSubtotal, poData.totalAmount, poData.notes || null,
        poData.updatedIp || null, id
      ]);

      await tx.execute("DELETE FROM purchase_order_items WHERE purchase_order_id = ?", [id]);

      for (const item of items) {
        const iSql = `
          INSERT INTO purchase_order_items (
            purchase_order_id, product_id, product_variant_id, product_name, variant_name,
            quantity, unit_cost, line_total
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;
        await tx.execute(iSql, [
          id, item.productId, item.productVariantId, item.productName, item.variantName,
          item.quantity, item.unitCost, item.lineTotal
        ]);
      }
    }).then(() => this.findById(id));
  },

  async updateStatus(id, status, ipAddress) {
    await query("UPDATE purchase_orders SET status = ?, updated_ip = ? WHERE id = ?", [status, ipAddress, id]);
    return this.findById(id);
  },

  async softDelete(id, ipAddress) {
    await query("UPDATE purchase_orders SET delete_flg = 1, updated_ip = ? WHERE id = ?", [ipAddress, id]);
  }

  ,

  async receivePurchaseOrder(id, po, grnPayload, context = {}) {
    const { clientIp, userId } = context;
    const grnByItemId = new Map((grnPayload.items ?? []).map((g) => [Number(g.id), g]));

    return transaction(async (tx) => {
      let receivedTotal = 0;

      for (const item of po.items) {
        const grn = grnByItemId.get(Number(item.id));
        const receivedQty = grn ? Number(grn.receivedQuantity) : Number(item.quantity);
        const receivedCost = grn ? Number(grn.receivedUnitCost) : Number(item.unitCost);
        const receivedLineTotal = receivedQty * receivedCost;
        receivedTotal += receivedLineTotal;

        const variantId = item.productVariantId;

        await tx.execute(`
          UPDATE purchase_order_items SET
            received_quantity = ?, received_unit_cost = ?, received_line_total = ?
          WHERE id = ?
        `, [receivedQty, receivedCost, receivedLineTotal, item.id]);

        if (receivedQty <= 0) continue;

        await tx.execute("UPDATE product_variants SET stock_quantity = stock_quantity + ? WHERE id = ?", [receivedQty, variantId]);

        const [updatedVariantRows] = await tx.execute("SELECT stock_quantity FROM product_variants WHERE id = ?", [variantId]);
        const quantityAfter = Number(updatedVariantRows[0].stock_quantity);
        const quantityBefore = quantityAfter - receivedQty;

        await tx.execute(`
          INSERT INTO inventory_transactions (
            product_id, product_variant_id, quantity_before, quantity_change, quantity_after,
            transaction_type, reference_type, reference_id, reason, created_by, created_ip, updated_ip
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          item.productId, variantId, quantityBefore, receivedQty, quantityAfter,
          1, "purchase_order", id, `GRN: Stock received from Purchase Order ${po.poNumber}`,
          userId || null, clientIp, clientIp
        ]);
      }

      await tx.execute(`
        UPDATE purchase_orders SET
          status = 'received', received_total = ?, received_at = NOW(), received_notes = ?, updated_ip = ?
        WHERE id = ?
      `, [receivedTotal, grnPayload.notes || null, clientIp, id]);

      let dueDate = null;
      if (po.paymentTermId) {
        const [ptRows] = await tx.execute("SELECT days FROM payment_terms WHERE id = ?", [po.paymentTermId]);
        if (ptRows[0]?.days) {
          dueDate = new Date();
          dueDate.setDate(dueDate.getDate() + ptRows[0].days);
        }
      }

      const [existingAp] = await tx.execute("SELECT id FROM accounts_payable WHERE purchase_order_id = ?", [id]);
      if (existingAp.length === 0) {
        await tx.execute(`
          INSERT INTO accounts_payable (
            purchase_order_id, supplier_id, po_number, receipt_date, due_date,
            amount, paid_amount, outstanding_amount, status, notes, created_ip, updated_ip
          ) VALUES (?, ?, ?, NOW(), ?, ?, 0, ?, 'unpaid', ?, ?, ?)
        `, [
          id, po.supplierId, po.poNumber, dueDate,
          receivedTotal, receivedTotal, grnPayload.notes || null, clientIp, clientIp
        ]);
      }

      return id;
    }).then((resultId) => this.findById(resultId));
  }
};
