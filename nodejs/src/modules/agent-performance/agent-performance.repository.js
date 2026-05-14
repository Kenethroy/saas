import { query } from "#shared/database/mysql";

export class AgentPerformanceRepository {
  async findAgentProfile(agentId) {
    const rows = await query(`
      SELECT id, first_name, last_name, position, phone, email, status, date_hired
      FROM employees
      WHERE id = ? AND delete_flg = 0
      LIMIT 1
    `, [agentId]);

    if (!rows[0]) {
      return null;
    }

    const row = rows[0];
    return {
      id: row.id,
      firstName: row.first_name,
      lastName: row.last_name,
      position: row.position,
      phone: row.phone,
      email: row.email,
      status: row.status,
      dateHired: row.date_hired
    };
  }

  async findReceivablesInRange({ start, end, search }) {
    let sql = `
      SELECT
        ar.id,
        ar.customer_id,
        ar.agent_id,
        ar.invoice_id,
        ar.invoice_date,
        ar.amount,
        ar.paid_amount,
        ar.outstanding_amount,
        e.first_name AS agent_first_name,
        e.last_name AS agent_last_name,
        c.name AS customer_name,
        i.invoice_number
      FROM accounts_receivable ar
      JOIN employees e ON ar.agent_id = e.id
      JOIN customers c ON ar.customer_id = c.id
      LEFT JOIN invoices i ON ar.invoice_id = i.id
      WHERE ar.delete_flg = 0
        AND ar.is_opening_balance = 0
        AND ar.agent_id IS NOT NULL
        AND DATE(ar.invoice_date) BETWEEN ? AND ?
        AND (i.id IS NULL OR (i.delete_flg = 0 AND i.status <> 'cancelled'))
    `;
    const params = [start, end];

    if (search) {
      sql += " AND (e.first_name LIKE ? OR e.last_name LIKE ? OR CONCAT(e.first_name, ' ', e.last_name) LIKE ?)";
      const pattern = `%${search}%`;
      params.push(pattern, pattern, pattern);
    }

    sql += " ORDER BY ar.invoice_date ASC, ar.id ASC";

    const rows = await query(sql, params);

    return rows.map((row) => ({
      id: row.id,
      customerId: row.customer_id,
      agentId: row.agent_id,
      invoiceId: row.invoice_id,
      invoiceDate: row.invoice_date,
      amount: Number(row.amount ?? 0),
      paidAmount: Number(row.paid_amount ?? 0),
      outstandingAmount: Number(row.outstanding_amount ?? 0),
      agent: row.agent_id ? {
        id: row.agent_id,
        firstName: row.agent_first_name,
        lastName: row.agent_last_name
      } : null,
      customer: {
        id: row.customer_id,
        name: row.customer_name
      },
      invoice: row.invoice_id ? {
        id: row.invoice_id,
        invoiceNumber: row.invoice_number
      } : null
    }));
  }

  async findAgentSalesHistory(agentId, { page, limit, search, status }) {
    const offset = (page - 1) * limit;
    let baseSql = `
      FROM sales_orders so
      JOIN customers c ON so.customer_id = c.id
      LEFT JOIN invoices i ON so.id = i.sales_order_id
      WHERE so.delete_flg = 0
        AND so.agent_id = ?
    `;
    const params = [agentId];

    if (search) {
      baseSql += " AND (so.sales_order_number LIKE ? OR c.name LIKE ?)";
      const pattern = `%${search}%`;
      params.push(pattern, pattern);
    }

    if (status) {
      baseSql += " AND so.status = ?";
      params.push(status);
    }

    const [rows, totalRows, sumRows, pendingRows, completedRows, invoicedRows] = await Promise.all([
      query(`
        SELECT so.id, so.sales_order_number, so.order_date, so.status, so.total_amount,
               c.id AS customer_id, c.name AS customer_name,
               i.id AS invoice_id, i.invoice_number, i.status AS invoice_status,
               (SELECT COUNT(*) FROM sales_order_items soi WHERE soi.sales_order_id = so.id) AS item_count
        ${baseSql}
        ORDER BY so.order_date DESC, so.id DESC
        LIMIT ? OFFSET ?
      `, [...params, limit, offset]),
      query(`SELECT COUNT(*) AS total ${baseSql}`, params),
      query(`SELECT COALESCE(SUM(so.total_amount), 0) AS total_sales ${baseSql}`, params),
      query(`
        SELECT COUNT(*) AS total
        ${baseSql}
        AND so.status IN ('pending', 'processing', 'for_delivery')
      `, params),
      query(`
        SELECT COUNT(*) AS total
        ${baseSql}
        AND so.status IN ('delivered', 'completed')
      `, params),
      query(`
        SELECT COUNT(*) AS total
        ${baseSql}
        AND i.id IS NOT NULL
      `, params)
    ]);

    return {
      rows: rows.map((row) => ({
        id: row.id,
        salesOrderNumber: row.sales_order_number,
        orderDate: row.order_date,
        status: row.status,
        totalAmount: Number(row.total_amount ?? 0),
        itemCount: Number(row.item_count ?? 0),
        customer: {
          id: row.customer_id,
          name: row.customer_name
        },
        invoice: row.invoice_id ? {
          id: row.invoice_id,
          invoiceNumber: row.invoice_number,
          status: row.invoice_status
        } : null
      })),
      total: Number(totalRows[0]?.total ?? 0),
      summary: {
        totalSales: Number(sumRows[0]?.total_sales ?? 0),
        totalOrders: Number(totalRows[0]?.total ?? 0),
        pendingOrders: Number(pendingRows[0]?.total ?? 0),
        completedOrders: Number(completedRows[0]?.total ?? 0),
        invoicedOrders: Number(invoicedRows[0]?.total ?? 0)
      }
    };
  }

  async findAgentCollectionHistory(agentId, { page, limit, search }) {
    const offset = (page - 1) * limit;
    let baseSql = `
      FROM payment_allocations pa
      JOIN payments p ON pa.payment_id = p.id
      JOIN accounts_receivable ar ON pa.accounts_receivable_id = ar.id
      JOIN customers c ON ar.customer_id = c.id
      LEFT JOIN invoices i ON ar.invoice_id = i.id
      LEFT JOIN sales_orders so ON i.sales_order_id = so.id
      WHERE ar.agent_id = ?
        AND ar.delete_flg = 0
    `;
    const params = [agentId];

    if (search) {
      baseSql += " AND (p.payment_number LIKE ? OR p.reference_number LIKE ? OR c.name LIKE ? OR i.invoice_number LIKE ? OR so.sales_order_number LIKE ?)";
      const pattern = `%${search}%`;
      params.push(pattern, pattern, pattern, pattern, pattern);
    }

    const [rows, totalRows, sumRows, paymentCountRows, customerCountRows] = await Promise.all([
      query(`
        SELECT pa.id, pa.amount_allocated,
               p.id AS payment_id, p.payment_number, p.payment_date, p.payment_method, p.reference_number,
               c.id AS customer_id, c.name AS customer_name,
               i.id AS invoice_id, i.invoice_number,
               so.id AS sales_order_id, so.sales_order_number,
               ar.id AS receivable_id, ar.invoice_date, ar.amount, ar.paid_amount, ar.outstanding_amount
        ${baseSql}
        ORDER BY p.payment_date DESC, pa.id DESC
        LIMIT ? OFFSET ?
      `, [...params, limit, offset]),
      query(`SELECT COUNT(*) AS total ${baseSql}`, params),
      query(`SELECT COALESCE(SUM(pa.amount_allocated), 0) AS total_collected ${baseSql}`, params),
      query(`SELECT COUNT(DISTINCT p.id) AS total ${baseSql}`, params),
      query(`SELECT COUNT(DISTINCT c.id) AS total ${baseSql}`, params)
    ]);

    return {
      rows: rows.map((row) => ({
        id: row.id,
        allocatedAmount: Number(row.amount_allocated ?? 0),
        payment: {
          id: row.payment_id,
          paymentNumber: row.payment_number,
          paymentDate: row.payment_date,
          paymentMethod: row.payment_method,
          referenceNumber: row.reference_number
        },
        customer: {
          id: row.customer_id,
          name: row.customer_name
        },
        invoice: row.invoice_id ? {
          id: row.invoice_id,
          invoiceNumber: row.invoice_number
        } : null,
        salesOrder: row.sales_order_id ? {
          id: row.sales_order_id,
          salesOrderNumber: row.sales_order_number
        } : null,
        receivable: {
          id: row.receivable_id,
          invoiceDate: row.invoice_date,
          amount: Number(row.amount ?? 0),
          paidAmount: Number(row.paid_amount ?? 0),
          outstandingAmount: Number(row.outstanding_amount ?? 0)
        }
      })),
      total: Number(totalRows[0]?.total ?? 0),
      summary: {
        totalCollected: Number(sumRows[0]?.total_collected ?? 0),
        totalAllocations: Number(totalRows[0]?.total ?? 0),
        paymentCount: Number(paymentCountRows[0]?.total ?? 0),
        customerCount: Number(customerCountRows[0]?.total ?? 0)
      }
    };
  }

  async findAgentRemittanceAllocations(agentId, { search }) {
    let baseSql = `
      FROM payment_allocations pa
      JOIN payments p ON pa.payment_id = p.id
      JOIN accounts_receivable ar ON pa.accounts_receivable_id = ar.id
      JOIN customers c ON ar.customer_id = c.id
      WHERE ar.agent_id = ?
        AND ar.delete_flg = 0
    `;
    const params = [agentId];

    if (search) {
      baseSql += " AND (p.payment_number LIKE ? OR p.reference_number LIKE ? OR c.name LIKE ?)";
      const pattern = `%${search}%`;
      params.push(pattern, pattern, pattern);
    }

    const rows = await query(`
      SELECT pa.id, pa.amount_allocated,
             p.id AS payment_id, p.payment_number, p.payment_date, p.payment_method, p.reference_number,
             c.id AS customer_id, c.name AS customer_name
      ${baseSql}
      ORDER BY p.payment_date DESC, pa.id DESC
    `, params);

    return rows.map((row) => ({
      id: row.id,
      amountAllocated: Number(row.amount_allocated ?? 0),
      payment: {
        id: row.payment_id,
        paymentNumber: row.payment_number,
        paymentDate: row.payment_date,
        paymentMethod: row.payment_method,
        referenceNumber: row.reference_number
      },
      accountsReceivable: {
        customer: {
          id: row.customer_id,
          name: row.customer_name
        }
      }
    }));
  }

  async findCollectionQueueRecords({ search, agentId }) {
    let sql = `
      SELECT
        ar.id,
        ar.customer_id,
        ar.agent_id,
        ar.invoice_id,
        ar.invoice_date,
        ar.due_date,
        ar.amount,
        ar.paid_amount,
        ar.outstanding_amount,
        ar.is_opening_balance,
        ar.status,
        c.name AS customer_name,
        e.first_name AS agent_first_name,
        e.last_name AS agent_last_name,
        i.invoice_number,
        so.id AS sales_order_id,
        so.sales_order_number,
        (
          SELECT MAX(p.payment_date)
          FROM payment_allocations pa
          JOIN payments p ON pa.payment_id = p.id
          WHERE pa.accounts_receivable_id = ar.id
        ) AS last_payment_date
      FROM accounts_receivable ar
      JOIN customers c ON ar.customer_id = c.id
      JOIN employees e ON ar.agent_id = e.id
      LEFT JOIN invoices i ON ar.invoice_id = i.id
      LEFT JOIN sales_orders so ON i.sales_order_id = so.id
      WHERE ar.delete_flg = 0
        AND ar.status IN ('unpaid', 'partial')
        AND ar.outstanding_amount > 0
        AND ar.agent_id IS NOT NULL
    `;
    const params = [];

    if (agentId) {
      sql += " AND ar.agent_id = ?";
      params.push(agentId);
    }

    if (search) {
      sql += " AND (c.name LIKE ? OR i.invoice_number LIKE ? OR e.first_name LIKE ? OR e.last_name LIKE ?)";
      const pattern = `%${search}%`;
      params.push(pattern, pattern, pattern, pattern);
    }

    sql += " ORDER BY ar.due_date ASC, ar.invoice_date ASC, ar.id ASC";

    const rows = await query(sql, params);
    return rows.map((row) => ({
      id: row.id,
      customerId: row.customer_id,
      agentId: row.agent_id,
      invoiceId: row.invoice_id,
      invoiceDate: row.invoice_date,
      dueDate: row.due_date,
      amount: Number(row.amount ?? 0),
      paidAmount: Number(row.paid_amount ?? 0),
      outstandingAmount: Number(row.outstanding_amount ?? 0),
      isOpeningBalance: Boolean(row.is_opening_balance),
      status: row.status,
      lastPaymentDate: row.last_payment_date,
      customer: {
        id: row.customer_id,
        name: row.customer_name
      },
      agent: {
        id: row.agent_id,
        firstName: row.agent_first_name,
        lastName: row.agent_last_name
      },
      invoice: row.invoice_id ? {
        id: row.invoice_id,
        invoiceNumber: row.invoice_number,
        salesOrder: row.sales_order_id ? {
          id: row.sales_order_id,
          salesOrderNumber: row.sales_order_number
        } : null
      } : null
    }));
  }

  async findRemittanceReviewAllocations({ search }) {
    let baseSql = `
      FROM payment_allocations pa
      JOIN payments p ON pa.payment_id = p.id
      JOIN accounts_receivable ar ON pa.accounts_receivable_id = ar.id
      JOIN customers c ON ar.customer_id = c.id
      JOIN employees e ON ar.agent_id = e.id
      WHERE ar.agent_id IS NOT NULL
        AND ar.delete_flg = 0
    `;
    const params = [];

    if (search) {
      baseSql += " AND (e.first_name LIKE ? OR e.last_name LIKE ? OR p.payment_number LIKE ? OR c.name LIKE ?)";
      const pattern = `%${search}%`;
      params.push(pattern, pattern, pattern, pattern);
    }

    const rows = await query(`
      SELECT pa.id, pa.amount_allocated,
             p.id AS payment_id, p.payment_number, p.payment_date, p.payment_method, p.reference_number,
             c.id AS customer_id, c.name AS customer_name,
             e.id AS agent_id, e.first_name AS agent_first_name, e.last_name AS agent_last_name
      ${baseSql}
      ORDER BY p.payment_date DESC, pa.id DESC
    `, params);

    return rows.map((row) => ({
      id: row.id,
      amountAllocated: Number(row.amount_allocated ?? 0),
      payment: {
        id: row.payment_id,
        paymentNumber: row.payment_number,
        paymentDate: row.payment_date,
        paymentMethod: row.payment_method,
        referenceNumber: row.reference_number
      },
      accountsReceivable: {
        customer: {
          id: row.customer_id,
          name: row.customer_name
        },
        agent: {
          id: row.agent_id,
          firstName: row.agent_first_name,
          lastName: row.agent_last_name
        }
      }
    }));
  }
}
