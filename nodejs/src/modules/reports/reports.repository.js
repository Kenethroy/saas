import { query } from "#shared/database/mysql";

function toOrderMap(rows, idColumn, entityKey, entityIdColumn, entityNameColumn, amountColumn, dateColumn) {
  const map = new Map();

  for (const row of rows) {
    const id = Number(row[idColumn]);
    const existing = map.get(id) ?? {
      id,
      [entityKey]: {
        id: Number(row[entityIdColumn]),
        name: row[entityNameColumn]
      },
      [`${entityKey}Id`]: Number(row[entityIdColumn]),
      totalAmount: Number(row[amountColumn] ?? 0),
      orderDate: row[dateColumn],
      items: []
    };

    if (row.product_id != null) {
      existing.items.push({
        quantity: Number(row.item_quantity ?? 0),
        lineTotal: Number(row.item_line_total ?? 0),
        product: {
          id: Number(row.product_id),
          name: row.product_name ?? "Unknown",
          category: {
            name: row.category_name ?? "Uncategorized"
          }
        }
      });
    }

    map.set(id, existing);
  }

  return Array.from(map.values());
}

export class ReportsRepository {
  async findSalesOrdersInRange(start, end) {
    const rows = await query(`
      SELECT
        so.id,
        so.customer_id,
        so.order_date,
        so.total_amount,
        c.name AS customer_name,
        soi.quantity AS item_quantity,
        soi.line_total AS item_line_total,
        p.id AS product_id,
        p.name AS product_name,
        cat.name AS category_name
      FROM sales_orders so
      JOIN customers c ON c.id = so.customer_id
      LEFT JOIN sales_order_items soi ON soi.sales_order_id = so.id
      LEFT JOIN products p ON p.id = soi.product_id
      LEFT JOIN categories cat ON cat.id = p.category_id
      WHERE so.delete_flg = 0
        AND so.status <> 'cancelled'
        AND so.order_date BETWEEN ? AND ?
      ORDER BY so.id ASC, soi.id ASC
    `, [start, end]);

    return toOrderMap(rows, "id", "customer", "customer_id", "customer_name", "total_amount", "order_date");
  }

  async countNewCustomersInRange(start, end) {
    const rows = await query(`
      SELECT COUNT(*) AS total
      FROM customers
      WHERE delete_flg = 0
        AND DATE(created_at) BETWEEN ? AND ?
    `, [start, end]);

    return Number(rows[0]?.total ?? 0);
  }

  async findPurchaseOrdersInRange(start, end) {
    const rows = await query(`
      SELECT
        po.id,
        po.supplier_id,
        po.order_date,
        po.total_amount,
        COALESCE(s.company_name, s.name) AS supplier_name,
        poi.quantity AS item_quantity,
        poi.line_total AS item_line_total,
        p.id AS product_id,
        p.name AS product_name,
        cat.name AS category_name
      FROM purchase_orders po
      JOIN suppliers s ON s.id = po.supplier_id
      LEFT JOIN purchase_order_items poi ON poi.purchase_order_id = po.id
      LEFT JOIN products p ON p.id = poi.product_id
      LEFT JOIN categories cat ON cat.id = p.category_id
      WHERE po.delete_flg = 0
        AND po.status <> 'cancelled'
        AND po.order_date BETWEEN ? AND ?
      ORDER BY po.id ASC, poi.id ASC
    `, [start, end]);

    return toOrderMap(rows, "id", "supplier", "supplier_id", "supplier_name", "total_amount", "order_date");
  }

  async countNewSuppliersInRange(start, end) {
    const rows = await query(`
      SELECT COUNT(*) AS total
      FROM suppliers
      WHERE delete_flg = 0
        AND DATE(created) BETWEEN ? AND ?
    `, [start, end]);

    return Number(rows[0]?.total ?? 0);
  }

  async findInvoicesInRange(start, end) {
    const rows = await query(`
      SELECT
        i.id,
        i.invoice_date,
        ii.quantity,
        ii.unit_cost,
        ii.line_total
      FROM invoices i
      LEFT JOIN invoice_items ii ON ii.invoice_id = i.id
      WHERE i.delete_flg = 0
        AND i.status IN ('issued', 'partial', 'paid')
        AND i.invoice_date BETWEEN ? AND ?
      ORDER BY i.id ASC, ii.id ASC
    `, [start, end]);

    const map = new Map();

    for (const row of rows) {
      const id = Number(row.id);
      const existing = map.get(id) ?? {
        id,
        invoiceDate: row.invoice_date,
        items: []
      };

      if (row.quantity != null) {
        existing.items.push({
          quantity: Number(row.quantity),
          unitCost: Number(row.unit_cost ?? 0),
          lineTotal: Number(row.line_total ?? 0)
        });
      }

      map.set(id, existing);
    }

    return Array.from(map.values());
  }

  async findCustomerReturnsInRange(start, end) {
    const rows = await query(`
      SELECT
        cr.id,
        cr.request_date,
        cr.total_amount,
        cri.quantity,
        cri.restock_flg,
        pv.unit_cost
      FROM customer_returns cr
      LEFT JOIN customer_return_items cri ON cri.customer_return_id = cr.id
      LEFT JOIN product_variants pv ON pv.id = cri.product_variant_id
      WHERE cr.delete_flg = 0
        AND cr.status = 'completed'
        AND cr.request_date BETWEEN ? AND ?
      ORDER BY cr.id ASC, cri.id ASC
    `, [start, end]);

    const map = new Map();

    for (const row of rows) {
      const id = Number(row.id);
      const existing = map.get(id) ?? {
        id,
        requestDate: row.request_date,
        totalAmount: Number(row.total_amount ?? 0),
        items: []
      };

      if (row.quantity != null) {
        existing.items.push({
          quantity: Number(row.quantity),
          restockFlag: Boolean(row.restock_flg),
          productVariant: {
            unitCost: Number(row.unit_cost ?? 0)
          }
        });
      }

      map.set(id, existing);
    }

    return Array.from(map.values());
  }

  async findExpensesInRange(start, end) {
    return query(`
      SELECT
        be.amount,
        ec.name AS category_name,
        parent.name AS parent_category_name
      FROM business_expenses be
      JOIN expense_categories ec ON ec.id = be.category_id
      LEFT JOIN expense_categories parent ON parent.id = ec.parent_id
      WHERE be.delete_flg = 0
        AND be.status <> 'void'
        AND be.expense_date BETWEEN ? AND ?
      ORDER BY be.expense_date ASC, be.id ASC
    `, [start, end]);
  }

  async findLossAdjustmentsInRange(start, end) {
    const rows = await query(`
      SELECT
        ia.id,
        ia.reason,
        iai.quantity_change,
        iai.adjust_type,
        pv.unit_cost
      FROM inventory_adjustments ia
      LEFT JOIN inventory_adjustment_items iai ON iai.inventory_adjustment_id = ia.id
      LEFT JOIN product_variants pv ON pv.id = iai.product_variant_id
      WHERE ia.delete_flg = 0
        AND ia.status = 'approved'
        AND DATE(ia.adjustment_date) BETWEEN ? AND ?
      ORDER BY ia.id ASC, iai.id ASC
    `, [start, end]);

    const map = new Map();

    for (const row of rows) {
      const id = Number(row.id);
      const existing = map.get(id) ?? {
        id,
        reason: row.reason,
        items: []
      };

      if (row.adjust_type != null) {
        existing.items.push({
          adjustType: row.adjust_type,
          quantityChange: Number(row.quantity_change ?? 0),
          productVariant: {
            unitCost: Number(row.unit_cost ?? 0)
          }
        });
      }

      map.set(id, existing);
    }

    return Array.from(map.values());
  }

  async findInventoryVelocitySource(days) {
    const [products, soldInPeriod, historicalSales] = await Promise.all([
      query(`
        SELECT
          p.id,
          p.name,
          COALESCE(cat.name, 'Uncategorized') AS category,
          p.created_at,
          COALESCE(SUM(COALESCE(pv.stock_quantity, 0)), 0) AS current_stock
        FROM products p
        LEFT JOIN categories cat ON cat.id = p.category_id
        LEFT JOIN product_variants pv ON pv.product_id = p.id AND pv.delete_flg = 0
        WHERE p.delete_flg = 0
        GROUP BY p.id, p.name, category, p.created_at
      `),
      query(`
        SELECT
          soi.product_id,
          SUM(soi.quantity) AS quantity,
          SUM(soi.line_total) AS revenue
        FROM sales_order_items soi
        JOIN sales_orders so ON so.id = soi.sales_order_id
        WHERE so.delete_flg = 0
          AND so.status IN ('delivered', 'completed')
          AND so.order_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
        GROUP BY soi.product_id
      `, [days]),
      query(`
        SELECT
          soi.product_id,
          MAX(so.order_date) AS last_sale_date
        FROM sales_order_items soi
        JOIN sales_orders so ON so.id = soi.sales_order_id
        WHERE so.delete_flg = 0
          AND so.status IN ('delivered', 'completed')
        GROUP BY soi.product_id
      `)
    ]);

    return {
      products: products.map((row) => ({
        id: Number(row.id),
        name: row.name,
        category: row.category,
        createdAt: row.created_at,
        currentStock: Number(row.current_stock ?? 0)
      })),
      soldInPeriod: soldInPeriod.map((row) => ({
        productId: Number(row.product_id),
        quantity: Number(row.quantity ?? 0),
        revenue: Number(row.revenue ?? 0)
      })),
      historicalSales: historicalSales.map((row) => ({
        productId: Number(row.product_id),
        orderDate: row.last_sale_date
      }))
    };
  }
}
