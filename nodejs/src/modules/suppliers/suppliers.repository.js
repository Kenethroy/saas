import { query } from "#shared/database/mysql";

export const suppliersRepository = {
  async findAll({ tenantId, search, status, skip, take }) {
    let sql = `
      SELECT s.*, pt.name as pt_name, pt.days as pt_days
      FROM suppliers s
      LEFT JOIN payment_terms pt ON s.payment_term_id = pt.id AND pt.tenant_id = s.tenant_id
      WHERE s.tenant_id = ? AND s.delete_flg = 0
    `;
    const params = [tenantId];

    if (status !== undefined) {
      sql += " AND s.status = ?";
      params.push(status ? 1 : 0);
    }

    if (search) {
      sql += ` AND (
        s.name LIKE ? OR 
        s.contact_person LIKE ? OR 
        s.email LIKE ? OR 
        s.phone LIKE ?
      )`;
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern, searchPattern);
    }

    const countSql = `SELECT COUNT(*) as total FROM (${sql}) as sub`;
    const countParams = [...params];

    sql += " ORDER BY s.id DESC LIMIT ? OFFSET ?";
    params.push(take, skip);

    const [rows, countRows] = await Promise.all([
      query(sql, params),
      query(countSql, countParams)
    ]);

    const formattedRows = rows.map(row => this._mapSupplierWithTerm(row));

    return { items: formattedRows, total: countRows[0].total };
  },

  async findById(tenantId, id) {
    const sql = `
      SELECT s.*, pt.name as pt_name, pt.days as pt_days
      FROM suppliers s
      LEFT JOIN payment_terms pt ON s.payment_term_id = pt.id AND pt.tenant_id = s.tenant_id
      WHERE s.tenant_id = ? AND s.id = ? AND s.delete_flg = 0
      LIMIT 1
    `;
    const rows = await query(sql, [tenantId, id]);
    return rows[0] ? this._mapSupplierWithTerm(rows[0]) : null;
  },

  async findByName(tenantId, name, excludeId = null) {
    let sql = "SELECT * FROM suppliers WHERE tenant_id = ? AND name = ? AND delete_flg = 0";
    const params = [tenantId, name];

    if (excludeId) {
      sql += " AND id != ?";
      params.push(excludeId);
    }

    sql += " LIMIT 1";
    const rows = await query(sql, params);
    return rows[0] || null;
  },

  async findPaymentTermById(tenantId, id) {
    if (!id) return null;
    const rows = await query(
      "SELECT * FROM payment_terms WHERE tenant_id = ? AND id = ? AND delete_flg = 0 AND status = 1 LIMIT 1",
      [tenantId, id]
    );
    return rows[0] || null;
  },

  async create(data) {
    const sql = `
      INSERT INTO suppliers (
        tenant_id, name, company_name, contact_person, email, phone, address, 
        payment_term_id, status, created_ip, updated_ip
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const result = await query(sql, [
      data.tenantId,
      data.name, data.companyName || null, data.contactPerson || null, data.email || null, 
      data.phone || null, data.address || null,
      data.paymentTermId || null, 
      data.status !== undefined ? (data.status ? 1 : 0) : 1,
      data.createdIp || null,
      data.updatedIp || null
    ]);
    return this.findById(data.tenantId, result.insertId);
  },

  async update(tenantId, id, data) {
    const fields = [];
    const params = [];

    const map = {
      name: 'name',
      companyName: 'company_name',
      contactPerson: 'contact_person',
      email: 'email',
      phone: 'phone',
      address: 'address',
      paymentTermId: 'payment_term_id',
      status: 'status',
      updatedIp: 'updated_ip'
    };

    for (const [key, column] of Object.entries(map)) {
      if (data[key] !== undefined) {
        fields.push(`${column} = ?`);
        params.push(key === 'status' ? (data[key] ? 1 : 0) : data[key]);
      }
    }

    if (fields.length === 0) return this.findById(tenantId, id);

    const sql = `UPDATE suppliers SET ${fields.join(', ')} WHERE tenant_id = ? AND id = ?`;
    params.push(tenantId, id);
    await query(sql, params);

    return this.findById(tenantId, id);
  },

  async softDelete(tenantId, id, updatedIp = null) {
    const sql = "UPDATE suppliers SET delete_flg = 1, status = 0, updated_ip = ? WHERE tenant_id = ? AND id = ?";
    return query(sql, [updatedIp, tenantId, id]);
  },

  async getStatistics(tenantId, id) {
    const sql = `
      SELECT
        COALESCE((
          SELECT COUNT(*)
          FROM purchase_orders po
          WHERE po.tenant_id = ? AND po.supplier_id = ? AND po.delete_flg = 0
        ), 0) AS total_orders,
        COALESCE((
          SELECT SUM(po.total_amount)
          FROM purchase_orders po
          WHERE po.tenant_id = ? AND po.supplier_id = ? AND po.delete_flg = 0
        ), 0) AS total_spent,
        COALESCE((
          SELECT SUM(po.received_total)
          FROM purchase_orders po
          WHERE po.tenant_id = ? AND po.supplier_id = ? AND po.delete_flg = 0 AND po.received_total IS NOT NULL
        ), 0) AS total_received,
        COALESCE((
          SELECT COUNT(*)
          FROM accounts_payable ap
          WHERE ap.tenant_id = ? AND ap.supplier_id = ? AND ap.delete_flg = 0 AND ap.status <> 'paid'
        ), 0) AS open_payables_count,
        COALESCE((
          SELECT COUNT(*)
          FROM accounts_payable ap
          WHERE ap.tenant_id = ? AND ap.supplier_id = ? AND ap.delete_flg = 0 AND ap.due_date < CURDATE() AND ap.status <> 'paid'
        ), 0) AS overdue_payables_count,
        COALESCE((
          SELECT SUM(ap.outstanding_amount)
          FROM accounts_payable ap
          WHERE ap.tenant_id = ? AND ap.supplier_id = ? AND ap.delete_flg = 0
        ), 0) AS total_outstanding,
        COALESCE((
          SELECT SUM(
            CASE
              WHEN ap.due_date < CURDATE() AND ap.status <> 'paid' THEN ap.outstanding_amount
              ELSE 0
            END
          )
          FROM accounts_payable ap
          WHERE ap.tenant_id = ? AND ap.supplier_id = ? AND ap.delete_flg = 0
        ), 0) AS total_overdue,
        (
          SELECT MAX(po.order_date)
          FROM purchase_orders po
          WHERE po.tenant_id = ? AND po.supplier_id = ? AND po.delete_flg = 0
        ) AS last_order_date,
        (
          SELECT MAX(ap.receipt_date)
          FROM accounts_payable ap
          WHERE ap.tenant_id = ? AND ap.supplier_id = ? AND ap.delete_flg = 0
        ) AS last_receipt_date
    `;

    const [row] = await query(sql, [
      tenantId, id,
      tenantId, id,
      tenantId, id,
      tenantId, id,
      tenantId, id,
      tenantId, id,
      tenantId, id,
      tenantId, id,
      tenantId, id
    ]);

    return {
      totalOrders: Number(row?.total_orders ?? 0),
      totalSpent: Number(row?.total_spent ?? 0),
      totalReceived: Number(row?.total_received ?? 0),
      openPayablesCount: Number(row?.open_payables_count ?? 0),
      overduePayablesCount: Number(row?.overdue_payables_count ?? 0),
      totalOutstanding: Number(row?.total_outstanding ?? 0),
      totalOverdue: Number(row?.total_overdue ?? 0),
      lastOrderDate: row?.last_order_date ?? null,
      lastReceiptDate: row?.last_receipt_date ?? null
    };
  },

  _mapSupplierWithTerm(row) {
    const supplier = {
      id: row.id,
      name: row.name,
      companyName: row.company_name,
      contactPerson: row.contact_person,
      email: row.email,
      phone: row.phone,
      address: row.address,
      paymentTermId: row.payment_term_id,
      status: row.status === 1,
      deleteFlag: row.delete_flg === 1,
      createdAt: row.created_at ?? row.created ?? null,
      updatedAt: row.updated_at ?? row.modified ?? null
    };

    if (row.payment_term_id) {
      supplier.paymentTerm = {
        id: row.payment_term_id,
        name: row.pt_name,
        days: row.pt_days
      };
    } else {
      supplier.paymentTerm = null;
    }

    return supplier;
  }
};
