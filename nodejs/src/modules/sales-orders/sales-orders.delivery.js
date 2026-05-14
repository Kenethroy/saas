import { AppError } from "#shared/utils/app-error";

const INVENTORY_TRANSACTION_TYPE_SALE = 2;

function formatInvoiceNumber(id) {
  return `INV-${String(id).padStart(6, "0")}`;
}

function addDays(date, days) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function resolveDueDate(baseDate, termDays) {
  const normalizedDays = Number(termDays);
  if (!Number.isFinite(normalizedDays) || normalizedDays < 0) {
    return null;
  }

  return addDays(baseDate, normalizedDays);
}

function resolveAccountsReceivableStatus(paidAmount, outstandingAmount) {
  const paid = Number(paidAmount ?? 0);
  const outstanding = Number(outstandingAmount ?? 0);
  if (outstanding <= 0) return "paid";
  if (paid > 0) return "partial";
  return "unpaid";
}

export async function deliverSalesOrder(tx, salesOrderId, { tenantId = null, ipAddress = null, userId = null } = {}) {
  const [orderRows] = await tx.execute(`
    SELECT so.*, c.name as customer_name, pt.days as pt_days
    FROM sales_orders so
    JOIN customers c ON so.customer_id = c.id AND c.tenant_id = so.tenant_id
    LEFT JOIN payment_terms pt ON so.payment_term_id = pt.id AND pt.tenant_id = so.tenant_id
    WHERE so.tenant_id = ? AND so.id = ? AND so.delete_flg = 0
  `, [tenantId, salesOrderId]);

  if (orderRows.length === 0) throw new AppError("Sales order not found", 404);
  const order = orderRows[0];

  if (order.status === "delivered") return order;

  const [invTransCount] = await tx.execute(
    "SELECT COUNT(*) as count FROM inventory_transactions WHERE tenant_id = ? AND reference_type = 'sales_order_delivered' AND reference_id = ?",
    [tenantId, salesOrderId]
  );
  const alreadyLogged = invTransCount[0].count > 0;

  const [items] = await tx.execute("SELECT * FROM sales_order_items WHERE tenant_id = ? AND sales_order_id = ? ORDER BY id ASC", [tenantId, salesOrderId]);

  if (!alreadyLogged) {
    for (const item of items) {
      const quantity = Number(item.quantity || 0);
      if (quantity <= 0) continue;

      const [updateResult] = await tx.execute(`
        UPDATE product_variants SET stock_quantity = stock_quantity - ? 
        WHERE tenant_id = ? AND id = ? AND delete_flg = 0 AND stock_quantity >= ?
      `, [quantity, tenantId, item.product_variant_id, quantity]);

      if (updateResult.affectedRows === 0) {
        throw new AppError(`Insufficient stock for ${item.variant_name}`, 422);
      }

      const [vRows] = await tx.execute("SELECT stock_quantity FROM product_variants WHERE tenant_id = ? AND id = ?", [tenantId, item.product_variant_id]);
      const quantityAfter = vRows[0].stock_quantity;
      const quantityBefore = quantityAfter + quantity;

      await tx.execute(`
        INSERT INTO inventory_transactions (
          tenant_id, branch_id, product_id, product_variant_id, quantity_before, quantity_change, quantity_after,
          transaction_type, reference_type, reference_id, reason, created_by, created_ip, updated_ip
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        order.tenant_id, order.branch_id || null, item.product_id, item.product_variant_id, quantityBefore, -quantity, quantityAfter,
        INVENTORY_TRANSACTION_TYPE_SALE, "sales_order_delivered", salesOrderId, `Sales order delivered (${order.sales_order_number})`,
        userId, ipAddress, ipAddress
      ]);
    }
  }

  // Check existing invoice
  const [invoiceRows] = await tx.execute("SELECT * FROM invoices WHERE tenant_id = ? AND sales_order_id = ? AND delete_flg = 0", [tenantId, salesOrderId]);
  let invoiceId;
  if (invoiceRows.length === 0) {
    const [latestInv] = await tx.execute("SELECT id FROM invoices WHERE tenant_id = ? ORDER BY id DESC LIMIT 1", [tenantId]);
    const nextInvId = (latestInv[0]?.id || 0) + 1;
    const invoiceNumber = formatInvoiceNumber(nextInvId);
    const invoiceDate = new Date();
    
    let dueDate = null;
    if (order.payment_term_id) {
      const [ptRows] = await tx.execute("SELECT days FROM payment_terms WHERE tenant_id = ? AND id = ?", [tenantId, order.payment_term_id]);
      dueDate = resolveDueDate(invoiceDate, ptRows[0]?.days);
    }

    const [invResult] = await tx.execute(`
      INSERT INTO invoices (
        tenant_id, branch_id, invoice_number, sales_order_id, customer_id, agent_id, payment_term_id,
        invoice_date, due_date, gross_amount, item_discount_total, subtotal,
        discount_type, discount_value, order_discount, net_of_discounts,
        vatable_sales, vat_amount, grand_total, paid_amount, balance_due,
        status, remarks, created_ip, updated_ip
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, 0, ?, 'draft', ?, ?, ?)
    `, [
      tenantId, order.branch_id || null, invoiceNumber, salesOrderId, order.customer_id, order.agent_id, order.payment_term_id,
      invoiceDate, dueDate, order.items_subtotal, 0, order.items_subtotal,
      order.discount_type, order.discount_value, order.discount_amount, order.total_amount,
      order.total_amount, order.total_amount, order.notes ? String(order.notes).slice(0, 255) : null,
      ipAddress, ipAddress
    ]);
    invoiceId = invResult.insertId;

    for (const item of items) {
      await tx.execute(`
        INSERT INTO invoice_items (
          tenant_id, invoice_id, product_id, product_variant_id, product_name, variant_name,
          quantity, unit_price, unit_cost, line_discount, line_total
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        tenantId, invoiceId, item.product_id, item.product_variant_id, item.product_name, item.variant_name,
        item.quantity, item.unit_price, item.unit_cost, item.line_discount, item.line_total
      ]);
    }
  } else {
    invoiceId = invoiceRows[0].id;

    if (!invoiceRows[0].due_date && order.payment_term_id) {
      const [ptRows] = await tx.execute("SELECT days FROM payment_terms WHERE tenant_id = ? AND id = ?", [tenantId, order.payment_term_id]);
      const updatedDueDate = resolveDueDate(invoiceRows[0].invoice_date, ptRows[0]?.days);

      if (updatedDueDate) {
        await tx.execute("UPDATE invoices SET due_date = ?, updated_ip = ? WHERE tenant_id = ? AND id = ?", [updatedDueDate, ipAddress, tenantId, invoiceId]);
        invoiceRows[0].due_date = updatedDueDate;
      }
    }
  }

  // Create AR
  const [arRows] = await tx.execute("SELECT id FROM accounts_receivable WHERE tenant_id = ? AND invoice_id = ? AND delete_flg = 0", [tenantId, invoiceId]);
  if (arRows.length === 0) {
    const [invRows] = await tx.execute("SELECT * FROM invoices WHERE tenant_id = ? AND id = ?", [tenantId, invoiceId]);
    const inv = invRows[0];
    await tx.execute(`
      INSERT INTO accounts_receivable (
        tenant_id, invoice_id, customer_id, agent_id, invoice_date, due_date,
        amount, paid_amount, outstanding_amount, is_opening_balance, status,
        created_ip, updated_ip
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, 0, ?, ?, ?)
    `, [
      tenantId, invoiceId, inv.customer_id, inv.agent_id, inv.invoice_date, inv.due_date,
      inv.grand_total, inv.grand_total, resolveAccountsReceivableStatus(0, inv.grand_total),
      ipAddress, ipAddress
    ]);
  }

  await tx.execute("UPDATE sales_orders SET status = 'delivered', updated_ip = ? WHERE tenant_id = ? AND id = ?", [ipAddress, tenantId, salesOrderId]);
}
