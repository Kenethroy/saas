import { query } from "#shared/database/mysql";

function mapSalesOrders(rows) {
  const map = new Map();

  for (const row of rows) {
    const id = Number(row.id);
    const existing = map.get(id) ?? {
      id,
      orderDate: row.order_date,
      totalAmount: Number(row.total_amount ?? 0),
      customer: {
        id: Number(row.customer_id),
        name: row.customer_name ?? "Unknown"
      },
      items: []
    };

    if (row.product_id != null) {
      existing.items.push({
        quantity: Number(row.item_quantity ?? 0),
        lineTotal: Number(row.item_line_total ?? 0),
        product: {
          id: Number(row.product_id),
          name: row.product_name ?? "Product"
        }
      });
    }

    map.set(id, existing);
  }

  return Array.from(map.values());
}

export class DashboardRepository {
  async findNotificationSettings() {
    const rows = await query(`
      SELECT \`key\`, value
      FROM settings
      WHERE \`key\` IN ('stock_alerts_enabled', 'payment_alerts_enabled')
      ORDER BY \`key\` ASC
    `);

    return rows.map((row) => ({
      key: row.key,
      value: row.value
    }));
  }

  async findSalesOrdersInRange(start, end) {
    const rows = await query(`
      SELECT
        so.id,
        DATE_FORMAT(so.order_date, '%Y-%m-%d') AS order_date,
        so.total_amount,
        c.id AS customer_id,
        c.name AS customer_name,
        soi.quantity AS item_quantity,
        soi.line_total AS item_line_total,
        p.id AS product_id,
        p.name AS product_name
      FROM sales_orders so
      JOIN customers c ON c.id = so.customer_id
      LEFT JOIN sales_order_items soi ON soi.sales_order_id = so.id
      LEFT JOIN products p ON p.id = soi.product_id
      WHERE so.delete_flg = 0
        AND so.status <> 'cancelled'
        AND so.order_date BETWEEN ? AND ?
      ORDER BY so.order_date ASC, so.id ASC, soi.id ASC
    `, [start, end]);

    return mapSalesOrders(rows);
  }

  async findPurchaseOrdersInRange(start, end) {
    const rows = await query(`
      SELECT id, total_amount
      FROM purchase_orders
      WHERE delete_flg = 0
        AND status <> 'cancelled'
        AND order_date BETWEEN ? AND ?
      ORDER BY order_date ASC, id ASC
    `, [start, end]);

    return rows.map((row) => ({
      id: Number(row.id),
      totalAmount: Number(row.total_amount ?? 0)
    }));
  }

  async findExpensesInRange(start, end) {
    const rows = await query(`
      SELECT id, amount
      FROM business_expenses
      WHERE delete_flg = 0
        AND status <> 'void'
        AND expense_date BETWEEN ? AND ?
      ORDER BY expense_date ASC, id ASC
    `, [start, end]);

    return rows.map((row) => ({
      id: Number(row.id),
      amount: Number(row.amount ?? 0)
    }));
  }

  async findPaymentAllocationsInRange(start, end) {
    const rows = await query(`
      SELECT
        pa.id,
        pa.amount_allocated,
        DATE_FORMAT(p.payment_date, '%Y-%m-%d') AS payment_date,
        p.payment_method,
        c.id AS customer_id,
        c.name AS customer_name,
        e.id AS agent_id,
        e.first_name AS agent_first_name,
        e.last_name AS agent_last_name
      FROM payment_allocations pa
      JOIN payments p ON p.id = pa.payment_id
      JOIN accounts_receivable ar ON ar.id = pa.accounts_receivable_id
      LEFT JOIN customers c ON c.id = ar.customer_id
      LEFT JOIN employees e ON e.id = ar.agent_id
      WHERE p.payment_date BETWEEN ? AND ?
      ORDER BY p.payment_date ASC, pa.id ASC
    `, [start, end]);

    return rows.map((row) => ({
      id: Number(row.id),
      amountAllocated: Number(row.amount_allocated ?? 0),
      payment: {
        paymentDate: row.payment_date,
        paymentMethod: row.payment_method
      },
      accountsReceivable: {
        customer: {
          id: row.customer_id ? Number(row.customer_id) : null,
          name: row.customer_name ?? "Unknown"
        },
        agent: row.agent_id
          ? {
              id: Number(row.agent_id),
              firstName: row.agent_first_name,
              lastName: row.agent_last_name
            }
          : null
      }
    }));
  }

  async findOpenReceivables() {
    const rows = await query(`
      SELECT
        ar.id,
        ar.customer_id,
        ar.agent_id,
        ar.invoice_id,
        DATE_FORMAT(ar.invoice_date, '%Y-%m-%d') AS invoice_date,
        DATE_FORMAT(ar.due_date, '%Y-%m-%d') AS due_date,
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
        so.sales_order_number
      FROM accounts_receivable ar
      JOIN customers c ON c.id = ar.customer_id
      LEFT JOIN employees e ON e.id = ar.agent_id
      LEFT JOIN invoices i ON i.id = ar.invoice_id
      LEFT JOIN sales_orders so ON so.id = i.sales_order_id
      WHERE ar.delete_flg = 0
        AND ar.status IN ('unpaid', 'partial')
        AND ar.outstanding_amount > 0
      ORDER BY ar.due_date ASC, ar.invoice_date ASC, ar.id ASC
    `);

    return rows.map((row) => ({
      id: Number(row.id),
      customerId: Number(row.customer_id),
      agentId: row.agent_id ? Number(row.agent_id) : null,
      invoiceId: row.invoice_id ? Number(row.invoice_id) : null,
      invoiceDate: row.invoice_date,
      dueDate: row.due_date,
      amount: Number(row.amount ?? 0),
      paidAmount: Number(row.paid_amount ?? 0),
      outstandingAmount: Number(row.outstanding_amount ?? 0),
      isOpeningBalance: Boolean(row.is_opening_balance),
      status: row.status,
      customer: {
        id: Number(row.customer_id),
        name: row.customer_name ?? "Unknown"
      },
      agent: row.agent_id
        ? {
            id: Number(row.agent_id),
            firstName: row.agent_first_name,
            lastName: row.agent_last_name
          }
        : null,
      invoice: row.invoice_id
        ? {
            id: Number(row.invoice_id),
            invoiceNumber: row.invoice_number,
            salesOrder: row.sales_order_id
              ? {
                  id: Number(row.sales_order_id),
                  salesOrderNumber: row.sales_order_number
                }
              : null
          }
        : null
    }));
  }

  async findInventoryVariants() {
    const rows = await query(`
      SELECT
        pv.id,
        pv.product_id,
        pv.name,
        pv.stock_quantity,
        pv.reorder_level,
        p.name AS product_name,
        c.id AS category_id,
        c.name AS category_name
      FROM product_variants pv
      JOIN products p ON p.id = pv.product_id
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE pv.delete_flg = 0
        AND pv.status = 1
        AND p.delete_flg = 0
        AND p.status = 1
      ORDER BY p.name ASC, pv.name ASC
    `);

    return rows.map((row) => ({
      id: Number(row.id),
      productId: Number(row.product_id),
      name: row.name,
      stockQuantity: Number(row.stock_quantity ?? 0),
      reorderLevel: Number(row.reorder_level ?? 0),
      product: {
        id: Number(row.product_id),
        name: row.product_name ?? "Product",
        category: row.category_id
          ? {
              id: Number(row.category_id),
              name: row.category_name
            }
          : null
      }
    }));
  }

  async findReceivablesInRange(start, end) {
    const rows = await query(`
      SELECT
        ar.id,
        ar.agent_id,
        ar.customer_id,
        ar.amount,
        ar.paid_amount,
        ar.outstanding_amount,
        DATE_FORMAT(ar.invoice_date, '%Y-%m-%d') AS invoice_date,
        e.first_name AS agent_first_name,
        e.last_name AS agent_last_name
      FROM accounts_receivable ar
      JOIN invoices i ON i.id = ar.invoice_id
      JOIN employees e ON e.id = ar.agent_id
      WHERE ar.delete_flg = 0
        AND ar.is_opening_balance = 0
        AND ar.agent_id IS NOT NULL
        AND i.delete_flg = 0
        AND i.status <> 'cancelled'
        AND ar.invoice_date BETWEEN ? AND ?
      ORDER BY ar.invoice_date ASC, ar.id ASC
    `, [start, end]);

    return rows.map((row) => ({
      id: Number(row.id),
      agentId: Number(row.agent_id),
      customerId: Number(row.customer_id),
      amount: Number(row.amount ?? 0),
      paidAmount: Number(row.paid_amount ?? 0),
      outstandingAmount: Number(row.outstanding_amount ?? 0),
      invoiceDate: row.invoice_date,
      agent: {
        id: Number(row.agent_id),
        firstName: row.agent_first_name,
        lastName: row.agent_last_name
      }
    }));
  }
}
