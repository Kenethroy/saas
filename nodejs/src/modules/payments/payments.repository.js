import { query, transaction } from "#shared/database/mysql";
import { AppError } from "#shared/utils/app-error";
import { toPublicFileUrl } from "#shared/utils/uploads";

function formatPaymentNumber(id) {
  return `PAY-${String(id).padStart(6, "0")}`;
}

function formatSupplierPaymentNumber(id) {
  return `SUPP-PAY-${String(id).padStart(6, "0")}`;
}

function resolveAccountsReceivableStatus(paidAmount, outstandingAmount) {
  const paid = Number(paidAmount ?? 0);
  const outstanding = Number(outstandingAmount ?? 0);
  if (outstanding <= 0) return "paid";
  if (paid > 0) return "partial";
  return "unpaid";
}

function resolveInvoiceStatus(balanceDue, paidAmount, currentStatus = "draft") {
  const balance = Number(balanceDue ?? 0);
  const paid = Number(paidAmount ?? 0);
  if (balance <= 0) return "paid";
  if (paid > 0) return "partial";
  if (currentStatus === "draft") return "issued";
  return currentStatus;
}

function resolveAccountsPayableStatus(paidAmount, outstandingAmount) {
  const paid = Number(paidAmount ?? 0);
  const outstanding = Number(outstandingAmount ?? 0);
  if (outstanding <= 0) return "paid";
  if (paid > 0) return "partial";
  return "unpaid";
}

export class PaymentsRepository {
  async findPaginated({ tenantId, page, perPage, search, customerId }) {
    const offset = (page - 1) * perPage;

    let sql = `
      FROM payments p
      JOIN customers c ON p.customer_id = c.id AND c.tenant_id = p.tenant_id
      WHERE p.tenant_id = ?
    `;
    const params = [tenantId];

    if (search) {
      sql += " AND (p.payment_number LIKE ? OR p.reference_number LIKE ? OR c.name LIKE ? OR c.company LIKE ?)";
      const pattern = `%${search}%`;
      params.push(pattern, pattern, pattern, pattern);
    }

    if (customerId) {
      sql += " AND p.customer_id = ?";
      params.push(customerId);
    }

    const countSql = `SELECT COUNT(*) as total ${sql}`;
    const dataSql = `
      SELECT p.*, c.name as customer_name, c.company as customer_company
      ${sql}
      ORDER BY p.payment_date DESC, p.id DESC
      LIMIT ? OFFSET ?
    `;
    const dataParams = [...params, perPage, offset];

    const [countRows, rows] = await Promise.all([
      query(countSql, params),
      query(dataSql, dataParams)
    ]);

    const formattedRows = await Promise.all(rows.map(async row => {
      const allocations = await query(`
        SELECT pa.*, ar.invoice_id, i.invoice_number, so.sales_order_number, ar.is_opening_balance
        FROM payment_allocations pa
        JOIN accounts_receivable ar ON pa.accounts_receivable_id = ar.id AND ar.tenant_id = pa.tenant_id
        LEFT JOIN invoices i ON ar.invoice_id = i.id AND i.tenant_id = pa.tenant_id
        LEFT JOIN sales_orders so ON i.sales_order_id = so.id AND so.tenant_id = pa.tenant_id
        WHERE pa.tenant_id = ? AND pa.payment_id = ?
        ORDER BY pa.id ASC
      `, [tenantId, row.id]);

      return {
        ...row,
        id: row.id,
        paymentNumber: row.payment_number,
        paymentDate: row.payment_date,
        paymentMethod: row.payment_method,
        referenceNumber: row.reference_number,
        fileUrl: row.file_url,
        customer: {
          id: row.customer_id,
          name: row.customer_name,
          company: row.customer_company
        },
        allocations: allocations.map(a => ({
          ...a,
          id: a.id,
          invoiceId: a.invoice_id,
          invoiceNumber: a.invoice_number,
          salesOrderNumber: a.sales_order_number,
          amountAllocated: Number(a.amount_allocated)
        }))
      };
    }));

    return { data: formattedRows, total: countRows[0].total };
  }

  async findById(id, context = {}) {
    const tenantId = Number(context.tenantId);
    const sql = `
      SELECT p.*, c.name as customer_name, c.company as customer_company
      FROM payments p
      JOIN customers c ON p.customer_id = c.id AND c.tenant_id = p.tenant_id
      WHERE p.tenant_id = ? AND p.id = ?
      LIMIT 1
    `;
    const rows = await query(sql, [tenantId, id]);
    if (!rows[0]) return null;

    const row = rows[0];
    const allocations = await query(`
      SELECT pa.*, ar.invoice_id, i.invoice_number, so.sales_order_number, ar.is_opening_balance
      FROM payment_allocations pa
      JOIN accounts_receivable ar ON pa.accounts_receivable_id = ar.id AND ar.tenant_id = pa.tenant_id
      LEFT JOIN invoices i ON ar.invoice_id = i.id AND i.tenant_id = pa.tenant_id
      LEFT JOIN sales_orders so ON i.sales_order_id = so.id AND so.tenant_id = pa.tenant_id
      WHERE pa.tenant_id = ? AND pa.payment_id = ?
      ORDER BY pa.id ASC
    `, [tenantId, id]);

    return {
      ...row,
      id: row.id,
      paymentNumber: row.payment_number,
      paymentDate: row.payment_date,
      paymentMethod: row.payment_method,
      referenceNumber: row.reference_number,
      fileUrl: row.file_url,
      customer: {
        id: row.customer_id,
        name: row.customer_name,
        company: row.customer_company
      },
      allocations: allocations.map(a => ({
        ...a,
        id: a.id,
        invoiceId: a.invoice_id,
        invoiceNumber: a.invoice_number,
        salesOrderNumber: a.sales_order_number,
        amountAllocated: Number(a.amount_allocated)
      }))
    };
  }

  async findLatestPayment() {
    const rows = await query("SELECT * FROM payments ORDER BY id DESC LIMIT 1");
    return rows[0] || null;
  }

  async createCustomerPayment(payload, context = {}) {
    const tenantId = Number(context.tenantId);
    const customerId = Number(payload.customerId);
    const ipAddress = context.ipAddress ?? null;
    const fileUrl = context.fileUrl ?? null;

    const customerRows = await query(
      "SELECT id FROM customers WHERE tenant_id = ? AND id = ? AND delete_flg = 0",
      [tenantId, customerId]
    );
    if (customerRows.length === 0) {
      throw new AppError("Customer not found", 404);
    }

    const unpaidReceivables = await query(`
      SELECT ar.*, i.invoice_number, i.status as invoice_status, i.paid_amount as invoice_paid_amount, i.balance_due as invoice_balance_due,
             so.sales_order_number
      FROM accounts_receivable ar
      LEFT JOIN invoices i ON ar.invoice_id = i.id AND i.tenant_id = ar.tenant_id
      LEFT JOIN sales_orders so ON i.sales_order_id = so.id AND so.tenant_id = ar.tenant_id
      WHERE ar.tenant_id = ? AND ar.customer_id = ? AND ar.delete_flg = 0 AND ar.status IN ('unpaid', 'partial')
      ORDER BY ar.is_opening_balance DESC, ar.due_date ASC, ar.invoice_date ASC, ar.id ASC
    `, [tenantId, customerId]);

    return transaction(async (tx) => {
      const [latest] = await tx.execute("SELECT id FROM payments ORDER BY id DESC LIMIT 1");
      const nextId = (latest[0]?.id || 0) + 1;
      const paymentNumber = formatPaymentNumber(nextId);
      const paymentAmount = Number(payload.amount);

      const [paymentResult] = await tx.execute(`
        INSERT INTO payments (
          tenant_id, payment_number, customer_id, payment_date, payment_method, amount,
          reference_number, notes, file_url, created_ip, updated_ip
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        tenantId, paymentNumber, customerId, new Date(payload.paymentDate), payload.paymentMethod, paymentAmount,
        payload.referenceNumber || null, payload.notes || null, fileUrl, ipAddress, ipAddress
      ]);

      const paymentId = paymentResult.insertId;
      const allocations = [];
      let remainingAmount = paymentAmount;
      let totalAllocated = 0;

      for (const receivable of unpaidReceivables) {
        if (remainingAmount <= 0) {
          break;
        }

        const outstanding = Number(receivable.outstanding_amount);
        if (outstanding <= 0) {
          continue;
        }

        const applied = Math.min(remainingAmount, outstanding);
        const nextPaid = Number(receivable.paid_amount) + applied;
        const nextOutstanding = Math.max(0, Number(receivable.amount) - nextPaid);

        const [allocationResult] = await tx.execute(`
          INSERT INTO payment_allocations (tenant_id, payment_id, accounts_receivable_id, amount_allocated, created_ip, updated_ip)
          VALUES (?, ?, ?, ?, ?, ?)
        `, [tenantId, paymentId, receivable.id, applied, ipAddress, ipAddress]);

        await tx.execute(`
          UPDATE accounts_receivable SET paid_amount = ?, outstanding_amount = ?, status = ?, updated_ip = ?
          WHERE tenant_id = ? AND id = ?
        `, [nextPaid, nextOutstanding, resolveAccountsReceivableStatus(nextPaid, nextOutstanding), ipAddress, tenantId, receivable.id]);

        if (receivable.invoice_id) {
          const invoicePaid = Number(receivable.invoice_paid_amount) + applied;
          const invoiceBalance = Math.max(0, Number(receivable.invoice_balance_due) - applied);
          await tx.execute(`
            UPDATE invoices SET paid_amount = ?, balance_due = ?, status = ?, updated_ip = ?
            WHERE tenant_id = ? AND id = ?
          `, [invoicePaid, invoiceBalance, resolveInvoiceStatus(invoiceBalance, invoicePaid, receivable.invoice_status), ipAddress, tenantId, receivable.invoice_id]);
        }

        totalAllocated += applied;
        remainingAmount -= applied;

        allocations.push({
          id: Number(allocationResult.insertId),
          invoice_id: receivable.invoice_id ? Number(receivable.invoice_id) : null,
          invoice_number: receivable.invoice_number ?? (receivable.is_opening_balance ? "Opening Balance" : null),
          order_number: receivable.sales_order_number ?? null,
          allocated_amount: applied,
          created_at: new Date()
        });
      }

      return {
        payment_id: Number(paymentId),
        payment_number: paymentNumber,
        amount: paymentAmount,
        allocated_amount: totalAllocated,
        excess_amount: Math.max(0, paymentAmount - totalAllocated),
        proof_image_url: toPublicFileUrl(fileUrl),
        allocations
      };
    });
  }

  async createSupplierPayment(payload, context = {}) {
    const tenantId = Number(context.tenantId);
    const supplierId = Number(payload.supplierId);
    const accountsPayableId = Number(payload.accountsPayableId);
    const ipAddress = context.ipAddress ?? null;
    const fileUrl = context.fileUrl ?? null;

    const payableRows = await query(`
      SELECT ap.*, s.name as supplier_name
      FROM accounts_payable ap
      JOIN suppliers s ON s.id = ap.supplier_id AND s.tenant_id = ap.tenant_id
      WHERE ap.tenant_id = ? AND ap.id = ? AND ap.supplier_id = ? AND ap.delete_flg = 0
      LIMIT 1
    `, [tenantId, accountsPayableId, supplierId]);

    const payable = payableRows[0];

    if (!payable) {
      throw new AppError("Accounts Payable record not found", 404);
    }

    const paymentAmount = Number(payload.amount);
    const currentOutstanding = Number(payable.outstanding_amount ?? 0);

    if (currentOutstanding <= 0) {
      throw new AppError("This payable has already been fully settled", 400);
    }

    if (paymentAmount > currentOutstanding) {
      throw new AppError("Payment amount cannot exceed the outstanding payable balance", 400);
    }

    return transaction(async (tx) => {
      const [latest] = await tx.execute("SELECT id FROM supplier_payments ORDER BY id DESC LIMIT 1");
      const nextId = (latest[0]?.id || 0) + 1;
      const paymentNumber = formatSupplierPaymentNumber(nextId);

      const [paymentResult] = await tx.execute(`
        INSERT INTO supplier_payments (
          tenant_id, payment_number, supplier_id, accounts_payable_id, payment_date, payment_method, amount,
          reference_number, notes, file_url, created_ip, updated_ip
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        tenantId,
        paymentNumber,
        supplierId,
        accountsPayableId,
        new Date(payload.paymentDate),
        payload.paymentMethod,
        paymentAmount,
        payload.referenceNumber || null,
        payload.notes || null,
        fileUrl,
        ipAddress,
        ipAddress
      ]);

      const nextPaidAmount = Number(payable.paid_amount ?? 0) + paymentAmount;
      const nextOutstandingAmount = Math.max(0, currentOutstanding - paymentAmount);
      const nextStatus = resolveAccountsPayableStatus(nextPaidAmount, nextOutstandingAmount);

      await tx.execute(`
        UPDATE accounts_payable
        SET paid_amount = ?, outstanding_amount = ?, status = ?, updated_ip = ?
        WHERE tenant_id = ? AND id = ?
      `, [nextPaidAmount, nextOutstandingAmount, nextStatus, ipAddress, tenantId, accountsPayableId]);

      return {
        payment_id: Number(paymentResult.insertId),
        payment_number: paymentNumber,
        accounts_payable_id: accountsPayableId,
        supplier_id: supplierId,
        supplier_name: payable.supplier_name,
        amount: paymentAmount,
        paid_amount: nextPaidAmount,
        outstanding_amount: nextOutstandingAmount,
        payment_status: nextStatus,
        proof_image_url: toPublicFileUrl(fileUrl)
      };
    });
  }

  async getAccountsPayableHistory(accountsPayableId, context = {}) {
    const tenantId = Number(context.tenantId);
    const rows = await query(`
      SELECT
        sp.id,
        sp.payment_number,
        sp.accounts_payable_id,
        sp.supplier_id,
        sp.payment_date,
        sp.payment_method,
        sp.amount,
        sp.reference_number,
        sp.notes,
        sp.file_url,
        sp.created_at
      FROM supplier_payments sp
      WHERE sp.tenant_id = ? AND sp.accounts_payable_id = ?
      ORDER BY sp.id DESC
    `, [tenantId, accountsPayableId]);

    return rows.map((row) => ({
      id: Number(row.id),
      payment_number: row.payment_number,
      accounts_payable_id: Number(row.accounts_payable_id),
      supplier_id: Number(row.supplier_id),
      date: row.payment_date,
      amount: Number(row.amount),
      method: row.payment_method,
      reference: row.reference_number,
      notes: row.notes,
      status: "verified",
      recorded_by: null,
      proof_image_url: toPublicFileUrl(row.file_url),
      created_at: row.created_at
    }));
  }
}
