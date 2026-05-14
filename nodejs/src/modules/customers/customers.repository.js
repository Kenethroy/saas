import { query } from "#shared/database/mysql";

export class CustomersRepository {
  async findPaginated(tenantId, filters = {}, pagination = {}) {
    const page = pagination.page ?? 1;
    const perPage = pagination.perPage ?? 10;
    const offset = (page - 1) * perPage;

    let sql = `
      SELECT c.*, pt.name as pt_name, pt.days as pt_days
      FROM customers c
      LEFT JOIN payment_terms pt ON c.payment_term_id = pt.id AND pt.tenant_id = c.tenant_id
      WHERE c.tenant_id = ? AND c.delete_flg = 0
    `;
    const params = [tenantId];

    if (filters.search) {
      sql += ` AND (
        c.name LIKE ? OR 
        c.email LIKE ? OR 
        c.phone LIKE ? OR 
        c.company LIKE ?
      )`;
      const searchPattern = `%${filters.search}%`;
      params.push(searchPattern, searchPattern, searchPattern, searchPattern);
    }

    if (typeof filters.status === "boolean") {
      sql += " AND c.status = ?";
      params.push(filters.status ? 1 : 0);
    }

    if (filters.hasReceivables) {
      sql += ` AND EXISTS (
        SELECT 1 FROM accounts_receivable ar 
        WHERE ar.customer_id = c.id 
          AND ar.tenant_id = c.tenant_id
          AND ar.delete_flg = 0 
          AND ar.status IN ('unpaid', 'partial')
      )`;
    }

    const countSql = `SELECT COUNT(*) as total FROM (${sql}) as sub`;
    const countParams = [...params];

    sql += " ORDER BY c.id DESC LIMIT ? OFFSET ?";
    params.push(perPage, offset);

    const [rows, countRows] = await Promise.all([
      query(sql, params),
      query(countSql, countParams)
    ]);

    const formattedRows = rows.map(row => this._mapCustomerWithTerm(row));

    return { data: formattedRows, total: countRows[0].total };
  }

  async findById(tenantId, id) {
    const sql = `
      SELECT c.*, pt.name as pt_name, pt.days as pt_days
      FROM customers c
      LEFT JOIN payment_terms pt ON c.payment_term_id = pt.id AND pt.tenant_id = c.tenant_id
      WHERE c.tenant_id = ? AND c.id = ? AND c.delete_flg = 0
      LIMIT 1
    `;
    const rows = await query(sql, [tenantId, id]);
    return rows[0] ? this._mapCustomerWithTerm(rows[0]) : null;
  }

  async findByEmail(tenantId, email) {
    if (!email) return null;
    const sql = "SELECT * FROM customers WHERE tenant_id = ? AND email = ? AND delete_flg = 0 LIMIT 1";
    const rows = await query(sql, [tenantId, email]);
    return rows[0] || null;
  }

  async findPaymentTermById(tenantId, id) {
    if (!id) return null;
    const sql = "SELECT * FROM payment_terms WHERE tenant_id = ? AND id = ? AND delete_flg = 0 AND status = 1 LIMIT 1";
    const rows = await query(sql, [tenantId, id]);
    return rows[0] || null;
  }

  async create(data) {
    const sql = `
      INSERT INTO customers (
        tenant_id, name, email, phone, company, address, 
        payment_term_id, status, created_ip, updated_ip
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const result = await query(sql, [
      data.tenantId,
      data.name, data.email || null, data.phone || null, 
      data.company || null, data.address || null,
      data.paymentTermId || null, 
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
      email: 'email',
      phone: 'phone',
      company: 'company',
      address: 'address',
      paymentTermId: 'payment_term_id',
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

    if (fields.length === 0) return this.findById(tenantId, id);

    const sql = `UPDATE customers SET ${fields.join(', ')} WHERE tenant_id = ? AND id = ?`;
    params.push(tenantId, id);
    await query(sql, params);

    return this.findById(tenantId, id);
  }

  async countOrders(tenantId, customerId) {
    const sql = "SELECT COUNT(*) as count FROM sales_orders WHERE tenant_id = ? AND customer_id = ? AND delete_flg = 0";
    const rows = await query(sql, [tenantId, customerId]);
    return rows[0].count;
  }

  async sumDeliveredAmount(tenantId, customerId) {
    const sql = "SELECT SUM(total_amount) as total FROM sales_orders WHERE tenant_id = ? AND customer_id = ? AND delete_flg = 0 AND status IN ('delivered', 'completed')";
    const rows = await query(sql, [tenantId, customerId]);
    return rows[0].total || 0;
  }

  async countOrdersInRange(tenantId, customerId, start, end) {
    const sql = "SELECT COUNT(*) as count FROM sales_orders WHERE tenant_id = ? AND customer_id = ? AND delete_flg = 0 AND order_date >= ? AND order_date < ?";
    const rows = await query(sql, [tenantId, customerId, start, end]);
    return rows[0].count;
  }

  async findOpenReceivables(tenantId, customerId) {
    const sql = "SELECT due_date, outstanding_amount FROM accounts_receivable WHERE tenant_id = ? AND customer_id = ? AND delete_flg = 0 AND status IN ('unpaid', 'partial')";
    const rows = await query(sql, [tenantId, customerId]);
    return rows.map(r => ({ dueDate: r.due_date, outstandingAmount: r.outstanding_amount }));
  }

  async aggregateReturns(tenantId, customerId, start, end) {
    let sql = "SELECT COUNT(*) as count, SUM(total_amount) as total FROM customer_returns WHERE tenant_id = ? AND customer_id = ? AND delete_flg = 0 AND status = 'completed'";
    const params = [tenantId, customerId];

    if (start && end) {
      sql += " AND request_date >= ? AND request_date < ?";
      params.push(start, end);
    }

    const rows = await query(sql, params);
    return { count: rows[0].count, total: rows[0].total || 0 };
  }

  async findInvoiceDebits(tenantId, customerId, start, end) {
    const sql = `
      SELECT ar.*, i.invoice_number
      FROM accounts_receivable ar
      LEFT JOIN invoices i ON ar.invoice_id = i.id AND i.tenant_id = ar.tenant_id
      WHERE ar.tenant_id = ? AND ar.customer_id = ? AND ar.delete_flg = 0 AND ar.invoice_date >= ? AND ar.invoice_date <= ?
      AND ar.is_opening_balance = 0
      ORDER BY ar.invoice_date ASC, ar.id ASC
    `;
    const rows = await query(sql, [tenantId, customerId, start, end]);
    return rows.map(r => ({
      ...r,
      invoiceDate: r.invoice_date,
      dueDate: r.due_date,
      isOpeningBalance: false,
      invoice: r.invoice_number ? { invoiceNumber: r.invoice_number } : null
    }));
  }

  async findPaymentCredits(tenantId, customerId, start, end) {
    const sql = `
      SELECT pa.amount_allocated, p.payment_date, p.payment_method, p.payment_number
      FROM payment_allocations pa
      JOIN payments p ON pa.payment_id = p.id AND pa.tenant_id = p.tenant_id
      WHERE p.tenant_id = ? AND p.customer_id = ? AND p.payment_date >= ? AND p.payment_date <= ?
      ORDER BY pa.id ASC
    `;
    const rows = await query(sql, [tenantId, customerId, start, end]);
    return rows.map(r => ({
      amountAllocated: r.amount_allocated,
      payment: {
        paymentDate: r.payment_date,
        paymentMethod: r.payment_method,
        paymentNumber: r.payment_number
      }
    }));
  }

  async findReturnCredits(tenantId, customerId, start, end) {
    const sql = `
      SELECT ra.amount_allocated, cr.updated_at, cr.request_date, cr.reason, cr.rma_number
      FROM return_allocations ra
      JOIN customer_returns cr ON ra.customer_return_id = cr.id AND ra.tenant_id = cr.tenant_id
      WHERE cr.tenant_id = ? AND cr.customer_id = ? AND cr.status = 'completed' AND cr.delete_flg = 0 
        AND (COALESCE(cr.updated_at, cr.request_date) >= ? AND COALESCE(cr.updated_at, cr.request_date) <= ?)
      ORDER BY ra.id ASC
    `;
    const rows = await query(sql, [tenantId, customerId, start, end]);
    return rows.map(r => ({
      amountAllocated: r.amount_allocated,
      customerReturn: {
        updatedAt: r.updated_at,
        requestDate: r.request_date,
        reason: r.reason,
        rmaNumber: r.rma_number
      }
    }));
  }

  async aggregateOpeningBalances(tenantId, customerId, start) {
    const [arSum, paySum, retSum] = await Promise.all([
      query(`
        SELECT SUM(amount) as total 
        FROM accounts_receivable 
        WHERE tenant_id = ? AND customer_id = ? AND delete_flg = 0 
        AND (invoice_date < ? OR is_opening_balance = 1)
      `, [tenantId, customerId, start]),
      query(`
        SELECT SUM(pa.amount_allocated) as total 
        FROM payment_allocations pa 
        JOIN payments p ON pa.payment_id = p.id AND pa.tenant_id = p.tenant_id
        WHERE p.tenant_id = ? AND p.customer_id = ? AND p.payment_date < ?
      `, [tenantId, customerId, start]),
      query(`
        SELECT SUM(ra.amount_allocated) as total 
        FROM return_allocations ra 
        JOIN customer_returns cr ON ra.customer_return_id = cr.id AND ra.tenant_id = cr.tenant_id
        WHERE cr.tenant_id = ? AND cr.customer_id = ? AND cr.status = 'completed' AND cr.delete_flg = 0 
          AND COALESCE(cr.updated_at, cr.request_date) < ?
      `, [tenantId, customerId, start])
    ]);

    return {
      arTotal: arSum[0].total || 0,
      payTotal: paySum[0].total || 0,
      retTotal: retSum[0].total || 0
    };
  }

  async findUnpaidReceivables(tenantId, customerId) {
    const sql = `
      SELECT ar.*, i.invoice_number, so.sales_order_number
      FROM accounts_receivable ar
      LEFT JOIN invoices i ON ar.invoice_id = i.id AND i.tenant_id = ar.tenant_id
      LEFT JOIN sales_orders so ON i.sales_order_id = so.id AND so.tenant_id = ar.tenant_id
      WHERE ar.tenant_id = ? AND ar.customer_id = ? AND ar.delete_flg = 0 AND ar.status IN ('unpaid', 'partial')
      ORDER BY ar.is_opening_balance DESC, ar.due_date ASC, ar.invoice_date ASC
    `;
    const rows = await query(sql, [tenantId, customerId]);
    return rows.map(r => ({
      ...r,
      invoiceDate: r.invoice_date,
      dueDate: r.due_date,
      outstandingAmount: r.outstanding_amount,
      paidAmount: r.paid_amount,
      isOpeningBalance: r.is_opening_balance === 1,
      invoice: r.invoice_id ? {
        id: r.invoice_id,
        invoiceNumber: r.invoice_number,
        salesOrder: { salesOrderNumber: r.sales_order_number }
      } : null
    }));
  }

  async findCustomerOrders(tenantId, customerId, filters = {}, pagination = {}) {
    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 10;
    const offset = (page - 1) * limit;

    let sql = `
      SELECT so.*, i.invoice_number, ar.paid_amount, ar.outstanding_amount, ar.status as ar_status, ar.due_date as ar_due_date,
             (SELECT COUNT(*) FROM sales_order_items soi WHERE soi.sales_order_id = so.id AND soi.tenant_id = so.tenant_id) as items_count
      FROM sales_orders so
      LEFT JOIN invoices i ON so.id = i.sales_order_id AND i.tenant_id = so.tenant_id
      LEFT JOIN accounts_receivable ar ON i.id = ar.invoice_id AND ar.tenant_id = so.tenant_id
      WHERE so.tenant_id = ? AND so.customer_id = ? AND so.delete_flg = 0
    `;
    const params = [tenantId, customerId];

    if (filters.status) {
      sql += " AND so.status = ?";
      params.push(filters.status);
    }

    const countSql = `SELECT COUNT(*) as total FROM (
      SELECT 1 FROM sales_orders WHERE tenant_id = ? AND customer_id = ? AND delete_flg = 0 ${filters.status ? " AND status = ?" : ""}
    ) as sub`;
    const countParams = filters.status ? [tenantId, customerId, filters.status] : [tenantId, customerId];

    sql += " ORDER BY so.order_date DESC LIMIT ? OFFSET ?";
    params.push(limit, offset);

    const [rows, countRows] = await Promise.all([
      query(sql, params),
      query(countSql, countParams)
    ]);

    const formattedRows = rows.map(r => ({
      ...r,
      salesOrderNumber: r.sales_order_number,
      orderDate: r.order_date,
      totalAmount: r.total_amount,
      _count: { items: r.items_count },
      invoice: r.invoice_number ? {
        invoiceNumber: r.invoice_number,
        accountsReceivable: {
          paidAmount: r.paid_amount,
          outstandingAmount: r.outstanding_amount,
          status: r.ar_status,
          dueDate: r.ar_due_date
        }
      } : null
    }));

    return { rows: formattedRows, total: countRows[0].total };
  }

  async findCustomerReturns(tenantId, customerId, filters = {}, pagination = {}) {
    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 10;
    const offset = (page - 1) * limit;

    let sql = "SELECT * FROM customer_returns WHERE tenant_id = ? AND customer_id = ? AND delete_flg = 0";
    const params = [tenantId, customerId];

    if (filters.status) {
      sql += " AND status = ?";
      params.push(filters.status);
    }

    if (filters.search) {
      sql += " AND (rma_number LIKE ? OR reason LIKE ?)";
      const searchPattern = `%${filters.search}%`;
      params.push(searchPattern, searchPattern);
    }

    const countSql = `SELECT COUNT(*) as total FROM (${sql}) as sub`;
    const countParams = [...params];

    sql += " ORDER BY request_date DESC LIMIT ? OFFSET ?";
    params.push(limit, offset);

    const [rows, countRows] = await Promise.all([
      query(sql, params),
      query(countSql, countParams)
    ]);

    const formattedRows = rows.map(r => ({
      ...r,
      rmaNumber: r.rma_number,
      requestDate: r.request_date,
      totalAmount: r.total_amount
    }));

    return { rows: formattedRows, total: countRows[0].total };
  }

  async createWithOpeningBalance(data, openingBalanceData) {
    const { transaction } = await import("#shared/database/mysql");
    return transaction(async (tx) => {
      const sql = `
        INSERT INTO customers (
          tenant_id, name, email, phone, company, address, 
          payment_term_id, status, created_ip, updated_ip
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      const [result] = await tx.execute(sql, [
        data.tenantId,
        data.name, data.email || null, data.phone || null, 
        data.company || null, data.address || null,
        data.paymentTermId || null, 
        data.status !== undefined ? (data.status ? 1 : 0) : 1,
        data.createdIp || null, data.updatedIp || null
      ]);
      const customerId = result.insertId;

      if (openingBalanceData) {
        const arSql = `
          INSERT INTO accounts_receivable (
            tenant_id, customer_id, amount, outstanding_amount, is_opening_balance, 
            agent_id, invoice_date, created_ip, updated_ip, status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        await tx.execute(arSql, [
          data.tenantId,
          customerId,
          openingBalanceData.amount,
          openingBalanceData.outstandingAmount,
          1,
          openingBalanceData.agentId || null,
          openingBalanceData.invoiceDate,
          openingBalanceData.createdIp || null,
          openingBalanceData.updatedIp || null,
          'unpaid'
        ]);
      }

      // Fetch final customer
      const fetchSql = `
        SELECT c.*, pt.name as pt_name, pt.days as pt_days
        FROM customers c
        LEFT JOIN payment_terms pt ON c.payment_term_id = pt.id AND pt.tenant_id = c.tenant_id
        WHERE c.tenant_id = ? AND c.id = ?
      `;
      const [rows] = await tx.execute(fetchSql, [data.tenantId, customerId]);
      return this._mapCustomerWithTerm(rows[0]);
    });
  }

  _mapCustomerWithTerm(row) {
    const customer = {
      id: row.id,
      name: row.name,
      email: row.email,
      phone: row.phone,
      company: row.company,
      address: row.address,
      paymentTermId: row.payment_term_id,
      status: row.status === 1,
      deleteFlag: row.delete_flg === 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };

    if (row.payment_term_id) {
      customer.paymentTerm = {
        id: row.payment_term_id,
        name: row.pt_name,
        days: row.pt_days
      };
    } else {
      customer.paymentTerm = null;
    }

    return customer;
  }
}
