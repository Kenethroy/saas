import { query } from "#shared/database/mysql";

export class AccountsReceivableRepository {
  async findPaginated(tenantId, { page, perPage, search, status, customerId }) {
    const offset = (page - 1) * perPage;

    let sql = `
      FROM accounts_receivable ar
      JOIN customers c ON ar.customer_id = c.id AND c.tenant_id = ar.tenant_id
      LEFT JOIN invoices i ON ar.invoice_id = i.id AND i.tenant_id = ar.tenant_id
      LEFT JOIN employees e ON ar.agent_id = e.id AND e.tenant_id = ar.tenant_id
      WHERE ar.tenant_id = ? AND ar.delete_flg = 0
    `;
    const params = [tenantId];

    if (search) {
      sql += " AND (c.name LIKE ? OR c.company LIKE ? OR i.invoice_number LIKE ?)";
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (status) {
      sql += " AND ar.status = ?";
      params.push(status);
    }

    if (customerId) {
      sql += " AND ar.customer_id = ?";
      params.push(customerId);
    }

    const countSql = `SELECT COUNT(*) as total ${sql}`;
    const dataSql = `
      SELECT ar.*, 
             c.name as customer_name, c.company as customer_company, c.email as customer_email,
             i.invoice_number as invoice_number,
             e.first_name as agent_first_name, e.last_name as agent_last_name
      ${sql}
      ORDER BY
        CASE ar.status
          WHEN 'unpaid' THEN 1
          WHEN 'partial' THEN 2
          WHEN 'paid' THEN 3
          ELSE 4
        END ASC,
        CASE
          WHEN ar.status IN ('unpaid', 'partial')
            AND ar.due_date IS NOT NULL
            AND ar.due_date < CURDATE()
          THEN 0
          ELSE 1
        END ASC,
        CASE WHEN ar.due_date IS NULL THEN 1 ELSE 0 END ASC,
        ar.due_date ASC,
        ar.invoice_date ASC,
        ar.id DESC
      LIMIT ? OFFSET ?
    `;
    const dataParams = [...params, perPage, offset];

    const [countRows, rows] = await Promise.all([
      query(countSql, params),
      query(dataSql, dataParams)
    ]);

    const formattedRows = rows.map(row => ({
      ...row,
      id: row.id,
      invoiceId: row.invoice_id,
      customerId: row.customer_id,
      agentId: row.agent_id,
      invoiceDate: row.invoice_date,
      dueDate: row.due_date,
      amount: Number(row.amount),
      paidAmount: Number(row.paid_amount),
      outstandingAmount: Number(row.outstanding_amount),
      isOpeningBalance: Boolean(row.is_opening_balance),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      customer: {
        id: row.customer_id,
        name: row.customer_name,
        company: row.customer_company,
        email: row.customer_email
      },
      invoice: row.invoice_id ? {
        id: row.invoice_id,
        invoiceNumber: row.invoice_number
      } : null,
      agent: row.agent_id ? {
        id: row.agent_id,
        firstName: row.agent_first_name,
        lastName: row.agent_last_name
      } : null
    }));

    return { data: formattedRows, total: countRows[0].total };
  }

  async findById(tenantId, id) {
    const sql = `
      SELECT ar.*, 
             c.name as customer_name, c.company as customer_company, c.email as customer_email,
             i.invoice_number as invoice_number,
             e.first_name as agent_first_name, e.last_name as agent_last_name
      FROM accounts_receivable ar
      JOIN customers c ON ar.customer_id = c.id AND c.tenant_id = ar.tenant_id
      LEFT JOIN invoices i ON ar.invoice_id = i.id AND i.tenant_id = ar.tenant_id
      LEFT JOIN employees e ON ar.agent_id = e.id AND e.tenant_id = ar.tenant_id
      WHERE ar.tenant_id = ? AND ar.id = ? AND ar.delete_flg = 0
      LIMIT 1
    `;
    const rows = await query(sql, [tenantId, id]);
    if (!rows[0]) return null;

    const row = rows[0];
    return {
      ...row,
      id: row.id,
      invoiceId: row.invoice_id,
      customerId: row.customer_id,
      agentId: row.agent_id,
      invoiceDate: row.invoice_date,
      dueDate: row.due_date,
      amount: Number(row.amount),
      paidAmount: Number(row.paid_amount),
      outstandingAmount: Number(row.outstanding_amount),
      isOpeningBalance: Boolean(row.is_opening_balance),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      customer: {
        id: row.customer_id,
        name: row.customer_name,
        company: row.customer_company,
        email: row.customer_email
      },
      invoice: row.invoice_id ? {
        id: row.invoice_id,
        invoiceNumber: row.invoice_number
      } : null,
      agent: row.agent_id ? {
        id: row.agent_id,
        firstName: row.agent_first_name,
        lastName: row.agent_last_name
      } : null
    };
  }

  async update(tenantId, id, data) {
    const fields = [];
    const params = [];

    if (data.dueDate !== undefined) {
      fields.push("due_date = ?");
      params.push(data.dueDate);
    }
    if (data.status !== undefined) {
      fields.push("status = ?");
      params.push(data.status);
    }
    if (data.paidAmount !== undefined) {
      fields.push("paid_amount = ?");
      params.push(data.paidAmount);
    }
    if (data.outstandingAmount !== undefined) {
      fields.push("outstanding_amount = ?");
      params.push(data.outstandingAmount);
    }
    if (data.updatedIp !== undefined) {
      fields.push("updated_ip = ?");
      params.push(data.updatedIp);
    }

    if (fields.length === 0) return this.findById(tenantId, id);

    const sql = `UPDATE accounts_receivable SET ${fields.join(", ")} WHERE tenant_id = ? AND id = ?`;
    params.push(tenantId, id);
    await query(sql, params);
    return this.findById(tenantId, id);
  }
}
