import { query } from "#shared/database/mysql";

export class SearchRepository {
  async searchCustomers(search, limit) {
    return query(`
      SELECT
        c.id,
        c.name,
        c.company,
        c.email,
        c.phone
      FROM customers c
      WHERE c.delete_flg = 0
        AND (
          c.name LIKE ?
          OR c.company LIKE ?
          OR c.email LIKE ?
          OR c.phone LIKE ?
        )
      ORDER BY c.id DESC
      LIMIT ?
    `, [search, search, search, search, limit]);
  }

  async searchProducts(search, limit) {
    return query(`
      SELECT
        p.id,
        p.name,
        p.status,
        c.name AS category_name,
        (
          SELECT GROUP_CONCAT(pv.name ORDER BY pv.id ASC SEPARATOR ', ')
          FROM product_variants pv
          WHERE pv.product_id = p.id
            AND pv.delete_flg = 0
            AND pv.name LIKE ?
          LIMIT 2
        ) AS matching_variants
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE p.delete_flg = 0
        AND (
          p.name LIKE ?
          OR EXISTS (
            SELECT 1
            FROM product_variants pv
            WHERE pv.product_id = p.id
              AND pv.delete_flg = 0
              AND pv.name LIKE ?
          )
        )
      ORDER BY p.id DESC
      LIMIT ?
    `, [search, search, search, limit]);
  }

  async searchSuppliers(search, limit) {
    return query(`
      SELECT
        s.id,
        s.name,
        s.company_name,
        s.contact_person,
        s.email,
        s.phone
      FROM suppliers s
      WHERE s.delete_flg = 0
        AND (
          s.name LIKE ?
          OR s.company_name LIKE ?
          OR s.contact_person LIKE ?
          OR s.email LIKE ?
          OR s.phone LIKE ?
        )
      ORDER BY s.id DESC
      LIMIT ?
    `, [search, search, search, search, search, limit]);
  }

  async searchSalesOrders(search, limit) {
    return query(`
      SELECT
        so.id,
        so.sales_order_number,
        so.total_amount,
        c.name AS customer_name
      FROM sales_orders so
      JOIN customers c ON c.id = so.customer_id
      WHERE so.delete_flg = 0
        AND (
          so.sales_order_number LIKE ?
          OR c.name LIKE ?
        )
      ORDER BY so.id DESC
      LIMIT ?
    `, [search, search, limit]);
  }

  async searchQuotations(search, limit) {
    return query(`
      SELECT
        q.id,
        q.quote_number,
        q.total_amount,
        q.contact_person,
        c.name AS customer_name
      FROM quotations q
      JOIN customers c ON c.id = q.customer_id
      WHERE q.delete_flg = 0
        AND (
          q.quote_number LIKE ?
          OR q.contact_person LIKE ?
          OR c.name LIKE ?
        )
      ORDER BY q.id DESC
      LIMIT ?
    `, [search, search, search, limit]);
  }

  async searchPurchaseOrders(search, limit) {
    return query(`
      SELECT
        po.id,
        po.po_number,
        po.total_amount,
        s.name AS supplier_name
      FROM purchase_orders po
      JOIN suppliers s ON s.id = po.supplier_id
      WHERE po.delete_flg = 0
        AND (
          po.po_number LIKE ?
          OR s.name LIKE ?
        )
      ORDER BY po.id DESC
      LIMIT ?
    `, [search, search, limit]);
  }

  async searchDeliveries(search, limit) {
    return query(`
      SELECT
        d.id,
        d.delivery_number,
        d.delivery_date,
        CONCAT_WS(' ', e.first_name, e.last_name) AS driver_name,
        t.plate_number
      FROM deliveries d
      LEFT JOIN employees e ON e.id = d.driver_id
      LEFT JOIN trucks t ON t.id = d.truck_id
      WHERE d.delete_flg = 0
        AND (
          d.delivery_number LIKE ?
          OR CONCAT_WS(' ', e.first_name, e.last_name) LIKE ?
          OR t.plate_number LIKE ?
        )
      ORDER BY d.id DESC
      LIMIT ?
    `, [search, search, search, limit]);
  }

  async searchAccountsReceivable(search, limit) {
    return query(`
      SELECT
        ar.id,
        ar.status,
        ar.outstanding_amount,
        ar.is_opening_balance,
        c.name AS customer_name,
        c.company AS customer_company,
        i.invoice_number
      FROM accounts_receivable ar
      JOIN customers c ON c.id = ar.customer_id
      LEFT JOIN invoices i ON i.id = ar.invoice_id
      WHERE ar.delete_flg = 0
        AND (
          c.name LIKE ?
          OR c.company LIKE ?
          OR i.invoice_number LIKE ?
        )
      ORDER BY ar.id DESC
      LIMIT ?
    `, [search, search, search, limit]);
  }

  async searchPayments(search, limit) {
    return query(`
      SELECT
        p.id,
        p.payment_number,
        p.payment_date,
        p.amount,
        p.reference_number,
        c.name AS customer_name,
        c.company AS customer_company,
        (
          SELECT COALESCE(i.invoice_number, CASE WHEN ar.is_opening_balance = 1 THEN 'Opening Balance' ELSE NULL END)
          FROM payment_allocations pa
          JOIN accounts_receivable ar ON ar.id = pa.accounts_receivable_id
          LEFT JOIN invoices i ON i.id = ar.invoice_id
          WHERE pa.payment_id = p.id
          ORDER BY pa.id ASC
          LIMIT 1
        ) AS invoice_number,
        (
          SELECT so.sales_order_number
          FROM payment_allocations pa
          JOIN accounts_receivable ar ON ar.id = pa.accounts_receivable_id
          LEFT JOIN invoices i ON i.id = ar.invoice_id
          LEFT JOIN sales_orders so ON so.id = i.sales_order_id
          WHERE pa.payment_id = p.id
          ORDER BY pa.id ASC
          LIMIT 1
        ) AS sales_order_number
      FROM payments p
      JOIN customers c ON c.id = p.customer_id
      WHERE
        p.payment_number LIKE ?
        OR p.reference_number LIKE ?
        OR c.name LIKE ?
        OR c.company LIKE ?
        OR EXISTS (
          SELECT 1
          FROM payment_allocations pa
          JOIN accounts_receivable ar ON ar.id = pa.accounts_receivable_id
          LEFT JOIN invoices i ON i.id = ar.invoice_id
          LEFT JOIN sales_orders so ON so.id = i.sales_order_id
          WHERE pa.payment_id = p.id
            AND (
              i.invoice_number LIKE ?
              OR so.sales_order_number LIKE ?
            )
        )
      ORDER BY p.payment_date DESC, p.id DESC
      LIMIT ?
    `, [search, search, search, search, search, search, limit]);
  }

  async searchCustomerReturns(search, limit) {
    return query(`
      SELECT
        cr.id,
        cr.rma_number,
        cr.reason,
        cr.status,
        cr.total_amount,
        c.name AS customer_name,
        c.company AS customer_company,
        i.invoice_number
      FROM customer_returns cr
      JOIN customers c ON c.id = cr.customer_id
      LEFT JOIN invoices i ON i.id = cr.invoice_id
      WHERE cr.delete_flg = 0
        AND (
          cr.rma_number LIKE ?
          OR c.name LIKE ?
          OR c.company LIKE ?
          OR i.invoice_number LIKE ?
        )
      ORDER BY cr.id DESC
      LIMIT ?
    `, [search, search, search, search, limit]);
  }

  async searchUsers(search, limit) {
    return query(`
      SELECT
        u.id,
        u.username,
        u.email,
        u.role,
        u.status,
        e.first_name,
        e.last_name
      FROM users u
      LEFT JOIN employees e ON e.id = u.employee_id
      WHERE u.delete_flg = 0
        AND u.role <> 'admin'
        AND (
          u.username LIKE ?
          OR u.email LIKE ?
          OR e.first_name LIKE ?
          OR e.last_name LIKE ?
        )
      ORDER BY u.id DESC
      LIMIT ?
    `, [search, search, search, search, limit]);
  }
}
