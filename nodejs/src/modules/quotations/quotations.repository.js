import { query, transaction } from "#shared/database/mysql";
import { AppError } from "#shared/utils/app-error";

export class QuotationsRepository {
  async findCustomerById(customerId) {
    const rows = await query(`
      SELECT c.*, pt.id as pt_id, pt.name as pt_name, pt.days as pt_days
      FROM customers c
      LEFT JOIN payment_terms pt ON c.payment_term_id = pt.id
      WHERE c.id = ? AND c.delete_flg = 0 AND c.status = 1
    `, [customerId]);
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

  async findAgentById(agentId) {
    if (!agentId) return null;
    const rows = await query("SELECT * FROM employees WHERE id = ? AND delete_flg = 0 AND status = 'active'", [agentId]);
    return rows[0] || null;
  }

  async findPaymentTermById(paymentTermId) {
    if (!paymentTermId) return null;
    const rows = await query("SELECT * FROM payment_terms WHERE id = ? AND delete_flg = 0 AND status = 1", [paymentTermId]);
    return rows[0] || null;
  }

  async findProductVariantsByIds(productVariantIds) {
    if (!productVariantIds.length) return [];
    return query(`
      SELECT pv.*, p.name as product_name
      FROM product_variants pv
      JOIN products p ON pv.product_id = p.id
      WHERE pv.id IN (?) AND pv.delete_flg = 0 AND pv.status = 1
    `, [productVariantIds]);
  }

  async findLatestQuotation() {
    const rows = await query("SELECT * FROM quotations ORDER BY id DESC LIMIT 1");
    return rows[0] || null;
  }

  async findLatestSalesOrder() {
    const rows = await query("SELECT * FROM sales_orders ORDER BY id DESC LIMIT 1");
    return rows[0] || null;
  }

  async findPaginated({ page, perPage, search, status, customerId, agentId }) {
    const offset = (page - 1) * perPage;
    let whereSql = "WHERE q.delete_flg = 0";
    const params = [];

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
      LEFT JOIN customers c ON q.customer_id = c.id
      LEFT JOIN employees e ON q.agent_id = e.id
      LEFT JOIN payment_terms pt ON q.payment_term_id = pt.id
      LEFT JOIN sales_orders so ON q.sales_order_id = so.id
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
        LEFT JOIN product_variants pv ON qi.product_variant_id = pv.id
        WHERE qi.quotation_id = ?
        ORDER BY qi.id ASC
      `, [row.id]);

      return {
        ...row,
        id: row.id,
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

  async findById(id) {
    const rows = await query(`
      SELECT 
        q.*,
        c.name as customer_name, c.company as customer_company, c.address as customer_address, c.phone as customer_phone, c.email as customer_email,
        e.first_name as agent_first_name, e.last_name as agent_last_name,
        pt.name as payment_term_name, pt.days as payment_term_days,
        so.sales_order_number, so.status as so_status
      FROM quotations q
      LEFT JOIN customers c ON q.customer_id = c.id
      LEFT JOIN employees e ON q.agent_id = e.id
      LEFT JOIN payment_terms pt ON q.payment_term_id = pt.id
      LEFT JOIN sales_orders so ON q.sales_order_id = so.id
      WHERE q.id = ? AND q.delete_flg = 0
    `, [id]);
    
    if (!rows[0]) return null;
    const row = rows[0];

    const items = await query(`
      SELECT qi.*, pv.stock_quantity
      FROM quotation_items qi
      LEFT JOIN product_variants pv ON qi.product_variant_id = pv.id
      WHERE qi.quotation_id = ?
      ORDER BY qi.id ASC
    `, [id]);

    return {
      ...row,
      id: row.id,
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
      }))
    };
  }

  async createQuotation(data) {
    const { items, ...qData } = data;
    return transaction(async (tx) => {
      const [qResult] = await tx.execute(`
        INSERT INTO quotations (
          quote_number, customer_id, contact_person, quote_date, valid_until,
          payment_term_id, agent_id, status, items_subtotal, discount_type,
          discount_value, discount_amount, total_amount, notes, created_ip
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        qData.quote_number, qData.customer_id, qData.contact_person, qData.quote_date, qData.valid_until,
        qData.payment_term_id, qData.agent_id, qData.status, qData.items_subtotal, qData.discount_type,
        qData.discount_value, qData.discount_amount, qData.total_amount, qData.notes, qData.created_ip
      ]);
      const quotationId = qResult.insertId;

      for (const item of items.create) {
        await tx.execute(`
          INSERT INTO quotation_items (
            quotation_id, product_id, product_variant_id, product_name, variant_name,
            description, quantity, unit_price, unit_cost, line_discount, line_total
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          quotationId, item.product_id, item.product_variant_id, item.product_name, item.variant_name,
          item.description, item.quantity, item.unit_price, item.unit_cost, item.line_discount, item.line_total
        ]);
      }
      return quotationId;
    }).then(id => this.findById(id));
  }

  async updateQuotation(id, data) {
    const fields = [];
    const params = [];
    Object.entries(data).forEach(([key, value]) => {
      if (key !== 'items') {
        fields.push(`${key} = ?`);
        params.push(value);
      }
    });
    if (fields.length > 0) {
      params.push(id);
      await query(`UPDATE quotations SET ${fields.join(', ')} WHERE id = ?`, params);
    }
    return this.findById(id);
  }

  async replaceQuotationItems(quotationId, items) {
    return transaction(async (tx) => {
      await tx.execute("DELETE FROM quotation_items WHERE quotation_id = ?", [quotationId]);
      for (const item of items) {
        await tx.execute(`
          INSERT INTO quotation_items (
            quotation_id, product_id, product_variant_id, product_name, variant_name,
            description, quantity, unit_price, unit_cost, line_discount, line_total
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          quotationId, item.product_id, item.product_variant_id, item.product_name, item.variant_name,
          item.description, item.quantity, item.unit_price, item.unit_cost, item.line_discount, item.line_total
        ]);
      }
    }).then(() => this.findById(quotationId));
  }

  async deleteQuotation(id) {
    return query("UPDATE quotations SET delete_flg = 1 WHERE id = ?", [id]);
  }

  async convertToSalesOrder(id, salesOrderNumber, context = {}) {
    const ipAddress = context.ipAddress || null;

    return transaction(async (tx) => {
      const [quotationRows] = await tx.execute(`
        SELECT q.*, c.payment_term_id as customer_payment_term_id
        FROM quotations q
        LEFT JOIN customers c ON q.customer_id = c.id
        WHERE q.id = ? AND q.delete_flg = 0
      `, [id]);
      const quotation = quotationRows[0];

      if (!quotation) throw new AppError("Quotation not found", 404);
      if (quotation.status !== "accepted") throw new AppError("Only accepted quotations can be converted.", 422);
      if (quotation.sales_order_id) throw new AppError("Quotation has already been converted to a sales order.", 422);

      const [items] = await tx.execute("SELECT * FROM quotation_items WHERE quotation_id = ?", [id]);

      for (const item of items) {
        const [variantRows] = await tx.execute(
          "SELECT name, stock_quantity FROM product_variants WHERE id = ?",
          [item.product_variant_id]
        );
        const variant = variantRows[0];
        if (!variant) throw new AppError(`Variant ${item.product_variant_id} not found`, 404);
        if (Number(variant.stock_quantity) < Number(item.quantity)) {
          throw new AppError(`Insufficient stock for ${variant.name}`, 422);
        }
      }

      const [salesOrderResult] = await tx.execute(`
        INSERT INTO sales_orders (
          sales_order_number, customer_id, order_date, agent_id, payment_term_id,
          status, items_subtotal, discount_type, discount_value, discount_amount,
          total_amount, notes, created_ip, updated_ip
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
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
            sales_order_id, product_id, product_variant_id, product_name, variant_name,
            quantity, unit_price, unit_cost, line_discount, line_total
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
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
        WHERE id = ?
      `, [salesOrderId, ipAddress, id]);

      return { id: salesOrderId, salesOrderNumber };
    });
  }
}
