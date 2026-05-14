import { query, transaction } from "#shared/database/mysql";
import { deliverSalesOrder } from "#modules/sales-orders/sales-orders.delivery";

export class SalesOrdersRepository {
  async findPaginated(tenantId, { page, perPage, search, status }) {
    const offset = (page - 1) * perPage;

    let sql = `
      FROM sales_orders so
      JOIN customers c ON so.customer_id = c.id AND c.tenant_id = so.tenant_id
      LEFT JOIN employees e ON so.agent_id = e.id AND e.tenant_id = so.tenant_id
      LEFT JOIN payment_terms pt ON so.payment_term_id = pt.id AND pt.tenant_id = so.tenant_id
      LEFT JOIN invoices si ON so.id = si.sales_order_id AND si.tenant_id = so.tenant_id
      WHERE so.tenant_id = ? AND so.delete_flg = 0
    `;
    const params = [tenantId];

    if (search) {
      sql += " AND (so.sales_order_number LIKE ? OR c.name LIKE ?)";
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern);
    }

    if (status) {
      sql += " AND so.status = ?";
      params.push(status);
    }

    const countSql = `SELECT COUNT(*) as total ${sql}`;
    const dataSql = `
      SELECT so.*, c.name as customer_name, e.first_name as agent_first_name, e.last_name as agent_last_name, 
        pt.name as pt_name, si.id as invoice_id, si.invoice_number, si.status as invoice_status,
        (SELECT COUNT(*) FROM sales_order_items soi WHERE soi.tenant_id = so.tenant_id AND soi.sales_order_id = so.id) as items_count
      ${sql}
      ORDER BY so.id DESC
      LIMIT ? OFFSET ?
    `;
    const dataParams = [...params, perPage, offset];

    const [countRows, rows] = await Promise.all([
      query(countSql, params),
      query(dataSql, dataParams)
    ]);

    const salesOrderIds = rows.map((row) => Number(row.id));
    const items = salesOrderIds.length
      ? await query(`
          SELECT soi.id, soi.sales_order_id, soi.product_id, soi.product_variant_id, soi.product_name, soi.variant_name,
            soi.quantity, soi.unit_price, soi.unit_cost, soi.line_discount, soi.line_total, pv.stock_quantity
          FROM sales_order_items soi
          JOIN product_variants pv ON soi.product_variant_id = pv.id AND pv.tenant_id = soi.tenant_id
          WHERE soi.tenant_id = ? AND soi.sales_order_id IN (?)
          ORDER BY soi.sales_order_id ASC, soi.id ASC
        `, [tenantId, salesOrderIds])
      : [];

    const itemsBySalesOrderId = items.reduce((acc, item) => {
      const salesOrderId = Number(item.sales_order_id);
      if (!acc.has(salesOrderId)) {
        acc.set(salesOrderId, []);
      }

      acc.get(salesOrderId).push({
        id: item.id,
        salesOrderId,
        productId: item.product_id,
        productVariantId: item.product_variant_id,
        productName: item.product_name,
        variantName: item.variant_name,
        quantity: item.quantity,
        unitPrice: item.unit_price,
        unitCost: item.unit_cost,
        lineDiscount: item.line_discount,
        lineTotal: item.line_total,
        availableStock: item.stock_quantity,
        productVariant: { stockQuantity: item.stock_quantity }
      });
      return acc;
    }, new Map());

    const formattedRows = rows.map(row => ({
      ...row,
      id: row.id,
      salesOrderNumber: row.sales_order_number,
      customerId: row.customer_id,
      agentId: row.agent_id,
      paymentTermId: row.payment_term_id,
      orderDate: row.order_date,
      itemsSubtotal: row.items_subtotal,
      discountType: row.discount_type,
      discountValue: row.discount_value,
      discountAmount: row.discount_amount,
      totalAmount: row.total_amount,
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      status: row.status,
      customer: { id: row.customer_id, name: row.customer_name },
      agent: row.agent_id ? { id: row.agent_id, firstName: row.agent_first_name, lastName: row.agent_last_name } : null,
      paymentTerm: row.payment_term_id ? { id: row.payment_term_id, name: row.pt_name } : null,
      invoice: row.invoice_id ? { id: row.invoice_id, invoiceNumber: row.invoice_number, status: row.invoice_status } : null,
      _count: { items: row.items_count },
      itemCount: row.items_count,
      items: itemsBySalesOrderId.get(Number(row.id)) ?? []
    }));

    return { rows: formattedRows, total: countRows[0].total };
  }

  async findById(tenantId, id) {
    const sql = `
      SELECT so.*, c.name as customer_name, e.first_name as agent_first_name, e.last_name as agent_last_name, 
        pt.name as pt_name, i.id as invoice_id, i.invoice_number, i.status as invoice_status
      FROM sales_orders so
      JOIN customers c ON so.customer_id = c.id AND c.tenant_id = so.tenant_id
      LEFT JOIN employees e ON so.agent_id = e.id AND e.tenant_id = so.tenant_id
      LEFT JOIN payment_terms pt ON so.payment_term_id = pt.id AND pt.tenant_id = so.tenant_id
      LEFT JOIN invoices i ON so.id = i.sales_order_id AND i.tenant_id = so.tenant_id
      WHERE so.tenant_id = ? AND so.id = ? AND so.delete_flg = 0
      LIMIT 1
    `;
    const rows = await query(sql, [tenantId, id]);
    if (!rows[0]) return null;

    const row = rows[0];
    const items = await query(`
      SELECT soi.*, pv.stock_quantity
      FROM sales_order_items soi
      JOIN product_variants pv ON soi.product_variant_id = pv.id AND pv.tenant_id = soi.tenant_id
      WHERE soi.tenant_id = ? AND soi.sales_order_id = ?
      ORDER BY soi.id ASC
    `, [tenantId, id]);

    return {
      ...row,
      id: row.id,
      salesOrderNumber: row.sales_order_number,
      customerId: row.customer_id,
      agentId: row.agent_id,
      paymentTermId: row.payment_term_id,
      orderDate: row.order_date,
      itemsSubtotal: row.items_subtotal,
      discountType: row.discount_type,
      discountValue: row.discount_value,
      discountAmount: row.discount_amount,
      totalAmount: row.total_amount,
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      status: row.status,
      customer: { id: row.customer_id, name: row.customer_name },
      agent: row.agent_id ? { id: row.agent_id, firstName: row.agent_first_name, lastName: row.agent_last_name } : null,
      paymentTerm: row.payment_term_id ? { id: row.payment_term_id, name: row.pt_name } : null,
      invoice: row.invoice_id ? { id: row.invoice_id, invoiceNumber: row.invoice_number, status: row.invoice_status } : null,
      itemCount: items.length,
      items: items.map(item => ({
        ...item,
        id: item.id,
        salesOrderId: item.sales_order_id,
        productId: item.product_id,
        productVariantId: item.product_variant_id,
        productName: item.product_name,
        variantName: item.variant_name,
        quantity: item.quantity,
        unitPrice: item.unit_price,
        unitCost: item.unit_cost,
        lineDiscount: item.line_discount,
        lineTotal: item.line_total,
        availableStock: item.stock_quantity,
        productVariant: { stockQuantity: item.stock_quantity }
      }))
    };
  }

  async findCustomerById(tenantId, customerId) {
    const sql = `
      SELECT c.*, pt.name as pt_name, pt.days as pt_days
      FROM customers c
      LEFT JOIN payment_terms pt ON c.payment_term_id = pt.id AND pt.tenant_id = c.tenant_id
      WHERE c.tenant_id = ? AND c.id = ? AND c.delete_flg = 0 AND c.status = 1
      LIMIT 1
    `;
    const rows = await query(sql, [tenantId, customerId]);
    if (!rows[0]) return null;
    const row = rows[0];
    return {
      ...row,
      paymentTerm: row.payment_term_id ? { id: row.payment_term_id, name: row.pt_name, days: row.pt_days } : null
    };
  }

  async findAgentById(tenantId, agentId) {
    if (!agentId) return null;
    const rows = await query(
      "SELECT * FROM employees WHERE tenant_id = ? AND id = ? AND delete_flg = 0 AND status = 'active' LIMIT 1",
      [tenantId, agentId]
    );
    return rows[0] || null;
  }

  async findPaymentTermById(tenantId, id) {
    if (!id) return null;
    const rows = await query(
      "SELECT * FROM payment_terms WHERE tenant_id = ? AND id = ? AND delete_flg = 0 AND status = 1 LIMIT 1",
      [tenantId, id]
    );
    return rows[0] || null;
  }

  async findProductVariantsByIds(tenantId, ids) {
    if (ids.length === 0) return [];
    const sql = `
      SELECT pv.*, p.name as p_name
      FROM product_variants pv
      JOIN products p ON pv.product_id = p.id AND p.tenant_id = pv.tenant_id
      WHERE pv.tenant_id = ? AND pv.id IN (?) AND pv.delete_flg = 0 AND pv.status = 1
    `;
    const rows = await query(sql, [tenantId, ids]);
    return rows.map(row => ({
      ...row,
      id: row.id,
      productId: row.product_id,
      unitPrice: row.unit_price,
      unitCost: row.unit_cost,
      stockQuantity: row.stock_quantity,
      product: { name: row.p_name }
    }));
  }

  async sumReservedQuantitiesByVariantIds(tenantId, variantIds = [], options = {}) {
    if (variantIds.length === 0) return [];

    const params = [tenantId, variantIds];
    let sql = `
      SELECT soi.product_variant_id as productVariantId, SUM(soi.quantity) as _sum_quantity
      FROM sales_order_items soi
      JOIN sales_orders so ON soi.sales_order_id = so.id AND so.tenant_id = soi.tenant_id
      WHERE soi.tenant_id = ?
        AND soi.product_variant_id IN (?)
        AND so.delete_flg = 0
        AND so.status = 'processing'
    `;

    if (options.excludeSalesOrderId) {
      sql += " AND soi.sales_order_id <> ?";
      params.push(Number(options.excludeSalesOrderId));
    }

    sql += " GROUP BY soi.product_variant_id";

    const rows = await query(sql, params);
    return rows.map((row) => ({
      productVariantId: row.productVariantId,
      _sum: { quantity: row._sum_quantity }
    }));
  }

  async findLatestOrder(tenantId) {
    const rows = await query("SELECT * FROM sales_orders WHERE tenant_id = ? ORDER BY id DESC LIMIT 1", [tenantId]);
    if (!rows[0]) return null;
    return { ...rows[0], salesOrderNumber: rows[0].sales_order_number };
  }

  async findForDeliverySelection(tenantId) {
    const sql = `
      SELECT so.*, c.name as customer_name, c.address as customer_address, c.phone as customer_phone, c.email as customer_email
      FROM sales_orders so
      JOIN customers c ON so.customer_id = c.id AND c.tenant_id = so.tenant_id
      WHERE so.tenant_id = ? AND so.delete_flg = 0 AND so.status = 'processing'
        AND NOT EXISTS (
          SELECT 1 FROM delivery_sales_orders dl
          JOIN deliveries d ON dl.delivery_id = d.id AND d.tenant_id = dl.tenant_id
          WHERE dl.tenant_id = so.tenant_id AND dl.sales_order_id = so.id AND d.delete_flg = 0 AND d.status <> 'cancelled'
        )
      ORDER BY so.order_date DESC, so.id DESC
    `;
    const rows = await query(sql, [tenantId]);
    return rows.map(row => ({
      ...row,
      id: row.id,
      salesOrderNumber: row.sales_order_number,
      customerId: row.customer_id,
      customerName: row.customer_name ?? "N/A",
      customerAddress: row.customer_address,
      customerPhone: row.customer_phone,
      customerEmail: row.customer_email,
      orderDate: row.order_date,
      totalAmount: row.total_amount,
      status: row.status,
      customer: { id: row.customer_id, name: row.customer_name }
    }));
  }

  async createWithItems(soData, items) {
    return transaction(async (tx) => {
      const pSql = `
    INSERT INTO sales_orders (
      tenant_id, branch_id, sales_order_number, customer_id, agent_id, order_date, payment_term_id,
      items_subtotal, discount_type, discount_value, discount_amount, total_amount, notes, created_ip, updated_ip, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
      const [pResult] = await tx.execute(pSql, [
        soData.tenantId, soData.branchId || null, soData.salesOrderNumber, soData.customerId, soData.agentId || null,
        soData.orderDate, soData.paymentTermId || null,
        soData.itemsSubtotal, soData.discountType || 'none', soData.discountValue || 0,
        soData.discountAmount || 0, soData.totalAmount, soData.notes || null,
        soData.createdIp || null, soData.updatedIp || null, soData.status || 'pending'
      ]);

      const soId = pResult.insertId;

      for (const item of items) {
        const iSql = `
          INSERT INTO sales_order_items (
            tenant_id, sales_order_id, product_id, product_variant_id, product_name, variant_name,
            quantity, unit_price, unit_cost, line_discount, line_total
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        await tx.execute(iSql, [
          soData.tenantId, soId, item.productId, item.productVariantId, item.productName, item.variantName,
          item.quantity, item.unitPrice, item.unitCost || 0, item.lineDiscount || 0, item.lineTotal
        ]);
      }

      return soId;
    }).then(id => this.findById(soData.tenantId, id));
  }

  async updateWithItems(tenantId, id, soData, items) {
    return transaction(async (tx) => {
      await tx.execute("DELETE FROM sales_order_items WHERE tenant_id = ? AND sales_order_id = ?", [tenantId, id]);
      await tx.execute(`
        UPDATE sales_orders SET
          customer_id = ?, agent_id = ?, order_date = ?, payment_term_id = ?,
          items_subtotal = ?, discount_type = ?, discount_value = ?, discount_amount = ?,
          total_amount = ?, notes = ?, updated_ip = ?
        WHERE tenant_id = ? AND id = ?
      `, [
        soData.customerId, soData.agentId || null, soData.orderDate, soData.paymentTermId || null,
        soData.itemsSubtotal, soData.discountType, soData.discountValue || 0, soData.discountAmount,
        soData.totalAmount, soData.notes || null, soData.updatedIp || null, tenantId, id
      ]);

      for (const item of items) {
        await tx.execute(`
          INSERT INTO sales_order_items (
            tenant_id, sales_order_id, product_id, product_variant_id, product_name, variant_name,
            quantity, unit_price, unit_cost, line_discount, line_total
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          tenantId, id, item.productId, item.productVariantId, item.productName, item.variantName,
          item.quantity, item.unitPrice, item.unitCost || 0, item.lineDiscount || 0, item.lineTotal
        ]);
      }
      return id;
    }).then((soId) => this.findById(tenantId, soId));
  }

  async updateStatus(tenantId, id, status, ipAddress) {
    await query("UPDATE sales_orders SET status = ?, updated_ip = ? WHERE tenant_id = ? AND id = ?", [status, ipAddress, tenantId, id]);
    return this.findById(tenantId, id);
  }

  async deliverAndUpdateStatus(tenantId, id, context = {}) {
    const ipAddress = context.ipAddress ?? null;
    const userId = context.userId ?? null;
    await transaction(async (tx) => {
      await deliverSalesOrder(tx, id, { tenantId, ipAddress, userId });
    });
    return this.findById(tenantId, id);
  }

  async findInvoiceForPdf(tenantId, salesOrderId) {
    const sql = `
      SELECT i.*, so.sales_order_number as so_number,
        c.name as c_name, c.company as c_company, c.address as c_address, c.phone as c_phone, c.email as c_email,
        pt.name as pt_name, pt.days as pt_days
      FROM invoices i
      JOIN sales_orders so ON i.sales_order_id = so.id AND so.tenant_id = i.tenant_id
      JOIN customers c ON i.customer_id = c.id AND c.tenant_id = i.tenant_id
      LEFT JOIN payment_terms pt ON i.payment_term_id = pt.id AND pt.tenant_id = i.tenant_id
      WHERE i.tenant_id = ? AND i.sales_order_id = ? AND i.delete_flg = 0
      LIMIT 1
    `;
    const rows = await query(sql, [tenantId, salesOrderId]);
    if (!rows[0]) return null;

    const row = rows[0];
    const items = await query(`
      SELECT ii.*
      FROM invoice_items ii
      WHERE ii.tenant_id = ? AND ii.invoice_id = ?
      ORDER BY ii.id ASC
    `, [tenantId, row.id]);

    return {
      ...row,
      invoiceNumber: row.invoice_number,
      invoiceDate: row.invoice_date,
      dueDate: row.due_date,
      grossAmount: row.gross_amount,
      itemDiscountTotal: row.item_discount_total,
      subtotal: row.subtotal,
      orderDiscount: row.order_discount,
      grandTotal: row.grand_total,
      salesOrder: {
        salesOrderNumber: row.so_number
      },
      customer: {
        name: row.c_name,
        company: row.c_company,
        address: row.c_address,
        phone: row.c_phone,
        email: row.c_email
      },
      paymentTerm: row.payment_term_id ? {
        name: row.pt_name,
        days: row.pt_days
      } : null,
      items: items.map(item => ({
        ...item,
        productName: item.product_name,
        variantName: item.variant_name,
        quantity: item.quantity,
        unitPrice: item.unit_price,
        lineDiscount: item.line_discount,
        lineTotal: item.line_total
      }))
    };
  }
}
