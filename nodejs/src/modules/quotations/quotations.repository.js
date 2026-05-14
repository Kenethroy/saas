import { query, transaction } from "#shared/database/mysql";
import { AppError } from "#shared/utils/app-error";
import { allocateDocumentNumber } from "#shared/utils/document-sequences";

export class QuotationsRepository {
  async findCustomerById(tenantId, customerId) {
    const rows = await query(`
      SELECT c.*, pt.id as pt_id, pt.name as pt_name, pt.days as pt_days
      FROM customers c
      LEFT JOIN payment_terms pt ON c.payment_term_id = pt.id AND pt.tenant_id = c.tenant_id
      WHERE c.tenant_id = ? AND c.id = ? AND c.delete_flg = 0 AND c.status = 1
    `, [tenantId, customerId]);
    if (!rows[0]) return null;
    const row = rows[0];
    return {
      ...row,
      paymentTerm: row.pt_id ? {
        id: row.pt_id,
        name: row.pt_name,
        days: row.pt_days
      } : null
    };
  }

  async findAgentById(tenantId, agentId) {
    if (!agentId) return null;
    const rows = await query(
      "SELECT * FROM employees WHERE tenant_id = ? AND id = ? AND delete_flg = 0 AND status = 'active'",
      [tenantId, agentId]
    );
    return rows[0] || null;
  }

  async findPaymentTermById(tenantId, paymentTermId) {
    if (!paymentTermId) return null;
    const rows = await query(
      "SELECT * FROM payment_terms WHERE tenant_id = ? AND id = ? AND delete_flg = 0 AND status = 1",
      [tenantId, paymentTermId]
    );
    return rows[0] || null;
  }

  async findProductVariantsByIds(tenantId, productVariantIds) {
    if (!productVariantIds.length) return [];
    return query(`
      SELECT pv.*, p.name as product_name
      FROM product_variants pv
      JOIN products p ON pv.product_id = p.id AND p.tenant_id = pv.tenant_id
      WHERE pv.tenant_id = ? AND pv.id IN (?) AND pv.delete_flg = 0 AND pv.status = 1
    `, [tenantId, productVariantIds]);
  }

  async findLatestQuotation(tenantId) {
    const rows = await query("SELECT * FROM quotations WHERE tenant_id = ? ORDER BY id DESC LIMIT 1", [tenantId]);
    return rows[0] || null;
  }

  async findLatestSalesOrder(tenantId) {
    const rows = await query("SELECT * FROM sales_orders WHERE tenant_id = ? ORDER BY id DESC LIMIT 1", [tenantId]);
    return rows[0] || null;
  }

  async findPaginated(tenantId, { page, perPage, search, status, customerId, agentId }) {
    const offset = (page - 1) * perPage;
    let whereSql = "WHERE q.tenant_id = ? AND q.delete_flg = 0";
    const params = [tenantId];

    if (search) {
      whereSql += " AND (q.quote_number LIKE ? OR c.name LIKE ? OR q.contact_person LIKE ?)";
      const pattern = `%${search}%`;
      params.push(pattern, pattern, pattern);
    }
    if (status) {
      whereSql += " AND q.status = ?";
      params.push(status);
    }
    if (customerId) {
      whereSql += " AND q.customer_id = ?";
      params.push(customerId);
    }
    if (agentId) {
      whereSql += " AND q.agent_id = ?";
      params.push(agentId);
    }

    const countSql = `SELECT COUNT(*) as total FROM quotations q LEFT JOIN customers c ON q.customer_id = c.id ${whereSql}`;
    const dataSql = `
      SELECT 
        q.*,
        c.name as customer_name, c.company as customer_company, c.address as customer_address, c.phone as customer_phone, c.email as customer_email,
        e.first_name as agent_first_name, e.last_name as agent_last_name,
        pt.name as payment_term_name, pt.days as payment_term_days,
        so.sales_order_number, so.status as so_status
      FROM quotations q
      LEFT JOIN customers c ON q.customer_id = c.id AND c.tenant_id = q.tenant_id
      LEFT JOIN employees e ON q.agent_id = e.id AND e.tenant_id = q.tenant_id
      LEFT JOIN payment_terms pt ON q.payment_term_id = pt.id AND pt.tenant_id = q.tenant_id
      LEFT JOIN sales_orders so ON q.sales_order_id = so.id AND so.tenant_id = q.tenant_id
      ${whereSql}
      ORDER BY q.id DESC
      LIMIT ? OFFSET ?
    `;

    const [[{ total }], rows] = await Promise.all([
      query(countSql, params),
      query(dataSql, [...params, perPage, offset])
    ]);

    const formattedRows = await Promise.all(rows.map(async (row) => {
      const items = await query(`
        SELECT qi.*, pv.stock_quantity
        FROM quotation_items qi
        LEFT JOIN product_variants pv ON qi.product_variant_id = pv.id AND pv.tenant_id = qi.tenant_id
        WHERE qi.tenant_id = ? AND qi.quotation_id = ?
        ORDER BY qi.id ASC
      `, [tenantId, row.id]);

      return {
        ...row,
        id: row.id,
        tenantId: row.tenant_id,
        branchId: row.branch_id,
        customerId: row.customer_id,
        paymentTermId: row.payment_term_id,
        agentId: row.agent_id,
        salesOrderId: row.sales_order_id,
        quoteNumber: row.quote_number,
        quoteDate: row.quote_date,
        validUntil: row.valid_until,
        itemsSubtotal: row.items_subtotal,
        discountType: row.discount_type,
        discountValue: row.discount_value,
        discountAmount: row.discount_amount,
        totalAmount: row.total_amount,
        customer: row.customer_id ? {
          id: row.customer_id,
          name: row.customer_name,
          company: row.customer_company,
          address: row.customer_address,
          phone: row.customer_phone,
          email: row.customer_email
        } : null,
        agent: row.agent_id ? { id: row.agent_id, firstName: row.agent_first_name, lastName: row.agent_last_name } : null,
        paymentTerm: row.payment_term_id ? { id: row.payment_term_id, name: row.payment_term_name, days: row.payment_term_days } : null,
        salesOrder: row.sales_order_id ? { id: row.sales_order_id, salesOrderNumber: row.sales_order_number, status: row.so_status } : null,
        items: items.map(item => ({
          ...item,
          id: item.id,
          productId: item.product_id,
          productVariantId: item.product_variant_id,
          productName: item.product_name,
          variantName: item.variant_name,
          unitPrice: item.unit_price,
          unitCost: item.unit_cost,
          lineDiscount: item.line_discount,
          lineTotal: item.line_total,
          productVariant: { stockQuantity: item.stock_quantity }
        })),
        _count: { items: items.length }
      };
    }));

    return { rows: formattedRows, total };
  }

  async findById(tenantId, id) {
    const rows = await query(`
      SELECT 
        q.*,
        c.name as customer_name, c.company as customer_company, c.address as customer_address, c.phone as customer_phone, c.email as customer_email,
        e.first_name as agent_first_name, e.last_name as agent_last_name,
        pt.name as payment_term_name, pt.days as payment_term_days,
        so.sales_order_number, so.status as so_status
      FROM quotations q
      LEFT JOIN customers c ON q.customer_id = c.id AND c.tenant_id = q.tenant_id
      LEFT JOIN employees e ON q.agent_id = e.id AND e.tenant_id = q.tenant_id
      LEFT JOIN payment_terms pt ON q.payment_term_id = pt.id AND pt.tenant_id = q.tenant_id
      LEFT JOIN sales_orders so ON q.sales_order_id = so.id AND so.tenant_id = q.tenant_id
      WHERE q.tenant_id = ? AND q.id = ? AND q.delete_flg = 0
      LIMIT 1
    `, [tenantId, id]);

    const row = rows[0];
    if (!row) return null;

    const items = await query(`
      SELECT qi.*, pv.stock_quantity
      FROM quotation_items qi
      LEFT JOIN product_variants pv ON qi.product_variant_id = pv.id AND pv.tenant_id = qi.tenant_id
      WHERE qi.tenant_id = ? AND qi.quotation_id = ?
      ORDER BY qi.id ASC
    `, [tenantId, id]);

    return {
      ...row,
      id: row.id,
      tenantId: row.tenant_id,
      branchId: row.branch_id,
      customerId: row.customer_id,
      paymentTermId: row.payment_term_id,
      agentId: row.agent_id,
      salesOrderId: row.sales_order_id,
      quoteNumber: row.quote_number,
      quoteDate: row.quote_date,
      validUntil: row.valid_until,
      itemsSubtotal: row.items_subtotal,
      discountType: row.discount_type,
      discountValue: row.discount_value,
      discountAmount: row.discount_amount,
      totalAmount: row.total_amount,
      contactPerson: row.contact_person,
      sentAt: row.sent_at,
      convertedAt: row.converted_at,
      customer: row.customer_id ? {
        id: row.customer_id,
        name: row.customer_name,
        company: row.customer_company,
        address: row.customer_address,
        phone: row.customer_phone,
        email: row.customer_email
      } : null,
      agent: row.agent_id ? { id: row.agent_id, firstName: row.agent_first_name, lastName: row.agent_last_name } : null,
      paymentTerm: row.payment_term_id ? { id: row.payment_term_id, name: row.payment_term_name, days: row.payment_term_days } : null,
      salesOrder: row.sales_order_id ? { id: row.sales_order_id, salesOrderNumber: row.sales_order_number, status: row.so_status } : null,
      items: items.map(item => ({
        ...item,
        id: item.id,
        productId: item.product_id,
        productVariantId: item.product_variant_id,
        productName: item.product_name,
        variantName: item.variant_name,
        unitPrice: item.unit_price,
        unitCost: item.unit_cost,
        lineDiscount: item.line_discount,
        lineTotal: item.line_total,
        productVariant: { stockQuantity: item.stock_quantity }
      }))
    };
  }

  async createQuotation(data) {
    const { items, ...qData } = data;
    return transaction(async (tx) => {
      let effectiveBranchId = qData.branchId ? Number(qData.branchId) : null;
      if (!effectiveBranchId) {
        const [branchRows] = await tx.execute(
          `
            SELECT id
            FROM branches
            WHERE tenant_id = ?
              AND is_primary = 1
            LIMIT 1
          `,
          [Number(qData.tenantId)]
        );
        effectiveBranchId = branchRows[0]?.id ? Number(branchRows[0].id) : null;
      }

      const quoteNumber = qData.quote_number || await allocateDocumentNumber({
        tenantId: qData.tenantId,
        branchId: effectiveBranchId,
        documentType: "quotation",
        at: qData.quote_date,
        tx
      });

      const [qResult] = await tx.execute(`
        INSERT INTO quotations (
          tenant_id, branch_id, quote_number, customer_id, contact_person, quote_date, valid_until,
          payment_term_id, agent_id, status, items_subtotal, discount_type,
          discount_value, discount_amount, total_amount, notes, created_ip, updated_ip
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        qData.tenantId, effectiveBranchId, quoteNumber, qData.customer_id, qData.contact_person, qData.quote_date, qData.valid_until,
        qData.payment_term_id, qData.agent_id, qData.status, qData.items_subtotal, qData.discount_type,
        qData.discount_value, qData.discount_amount, qData.total_amount, qData.notes, qData.created_ip, qData.updated_ip
      ]);
      const quotationId = qResult.insertId;

      for (const item of items.create) {
        await tx.execute(`
          INSERT INTO quotation_items (
            tenant_id, quotation_id, product_id, product_variant_id, product_name, variant_name,
            description, quantity, unit_price, unit_cost, line_discount, line_total
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          qData.tenantId, quotationId, item.product_id, item.product_variant_id, item.product_name, item.variant_name,
          item.description, item.quantity, item.unit_price, item.unit_cost, item.line_discount, item.line_total
        ]);
      }
      return quotationId;
    }).then(id => this.findById(qData.tenantId, id));
  }

  async updateQuotation(tenantId, id, data) {
    const fields = [];
    const params = [];
    Object.entries(data).forEach(([key, value]) => {
      if (key !== 'items') {
        fields.push(`${key} = ?`);
        params.push(value);
      }
    });
    if (fields.length > 0) {
      params.push(tenantId, id);
      await query(`UPDATE quotations SET ${fields.join(', ')} WHERE tenant_id = ? AND id = ?`, params);
    }
    return this.findById(tenantId, id);
  }

  async replaceQuotationItems(tenantId, quotationId, items) {
    return transaction(async (tx) => {
      await tx.execute("DELETE FROM quotation_items WHERE tenant_id = ? AND quotation_id = ?", [tenantId, quotationId]);
      for (const item of items) {
        await tx.execute(`
          INSERT INTO quotation_items (
            tenant_id, quotation_id, product_id, product_variant_id, product_name, variant_name,
            description, quantity, unit_price, unit_cost, line_discount, line_total
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          tenantId, quotationId, item.product_id, item.product_variant_id, item.product_name, item.variant_name,
          item.description, item.quantity, item.unit_price, item.unit_cost, item.line_discount, item.line_total
        ]);
      }
    }).then(() => this.findById(tenantId, quotationId));
  }

  async deleteQuotation(tenantId, id) {
    return query("UPDATE quotations SET delete_flg = 1 WHERE tenant_id = ? AND id = ?", [tenantId, id]);
  }

  async convertToSalesOrder(tenantId, id, context = {}) {
    const ipAddress = context.ipAddress || null;

    return transaction(async (tx) => {
      const [quotationRows] = await tx.execute(`
        SELECT q.*, c.payment_term_id as customer_payment_term_id
        FROM quotations q
        LEFT JOIN customers c ON q.customer_id = c.id AND c.tenant_id = q.tenant_id
        WHERE q.tenant_id = ? AND q.id = ? AND q.delete_flg = 0
      `, [tenantId, id]);
      const quotation = quotationRows[0];

      if (!quotation) throw new AppError("Quotation not found", 404);
      if (quotation.status !== "accepted") throw new AppError("Only accepted quotations can be converted.", 422);
      if (quotation.sales_order_id) throw new AppError("Quotation has already been converted to a sales order.", 422);

      const [items] = await tx.execute("SELECT * FROM quotation_items WHERE tenant_id = ? AND quotation_id = ?", [tenantId, id]);

      for (const item of items) {
        const [variantRows] = await tx.execute(
          "SELECT name, stock_quantity FROM product_variants WHERE tenant_id = ? AND id = ?",
          [tenantId, item.product_variant_id]
        );
        const variant = variantRows[0];
        if (!variant) throw new AppError(`Variant ${item.product_variant_id} not found`, 404);
        if (Number(variant.stock_quantity) < Number(item.quantity)) {
          throw new AppError(`Insufficient stock for ${variant.name}`, 422);
        }
      }

      let effectiveBranchId = context.branchId ? Number(context.branchId) : (quotation.branch_id ? Number(quotation.branch_id) : null);
      if (!effectiveBranchId) {
        const [branchRows] = await tx.execute(
          `
            SELECT id
            FROM branches
            WHERE tenant_id = ?
              AND is_primary = 1
            LIMIT 1
          `,
          [Number(tenantId)]
        );
        effectiveBranchId = branchRows[0]?.id ? Number(branchRows[0].id) : null;
      }

      const salesOrderNumber = await allocateDocumentNumber({
        tenantId,
        branchId: effectiveBranchId,
        documentType: "sales_order",
        at: quotation.quote_date,
        tx
      });

      const [salesOrderResult] = await tx.execute(`
        INSERT INTO sales_orders (
          tenant_id, branch_id, sales_order_number, customer_id, order_date, agent_id, payment_term_id,
          status, items_subtotal, discount_type, discount_value, discount_amount,
          total_amount, notes, created_ip, updated_ip
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        tenantId,
        effectiveBranchId,
        salesOrderNumber,
        quotation.customer_id,
        quotation.quote_date,
        quotation.agent_id,
        quotation.payment_term_id || quotation.customer_payment_term_id || null,
        "pending",
        quotation.items_subtotal,
        quotation.discount_type,
        quotation.discount_value,
        quotation.discount_amount,
        quotation.total_amount,
        quotation.notes,
        ipAddress,
        ipAddress
      ]);
      const salesOrderId = salesOrderResult.insertId;

      for (const item of items) {
        await tx.execute(`
          INSERT INTO sales_order_items (
            tenant_id, sales_order_id, product_id, product_variant_id, product_name, variant_name,
            quantity, unit_price, unit_cost, line_discount, line_total
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          tenantId,
          salesOrderId,
          item.product_id,
          item.product_variant_id,
          item.product_name,
          item.variant_name,
          item.quantity,
          item.unit_price,
          item.unit_cost,
          item.line_discount,
          item.line_total
        ]);
      }

      await tx.execute(`
        UPDATE quotations
        SET status = 'converted', sales_order_id = ?, converted_at = NOW(), updated_ip = ?
        WHERE tenant_id = ? AND id = ?
      `, [salesOrderId, ipAddress, tenantId, id]);

      return { id: salesOrderId, salesOrderNumber };
    });
  }
}
