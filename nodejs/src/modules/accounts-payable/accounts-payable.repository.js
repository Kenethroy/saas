import { query } from "#shared/database/mysql";

export class AccountsPayableRepository {
  async findPaginated({ page, perPage, search, status, supplierId, overdue }) {
    const offset = (page - 1) * perPage;

    let sql = `
      FROM accounts_payable ap
      JOIN suppliers s ON ap.supplier_id = s.id
      JOIN purchase_orders po ON ap.purchase_order_id = po.id
      WHERE ap.delete_flg = 0
    `;
    const params = [];

    if (search) {
      sql += " AND (ap.po_number LIKE ? OR s.name LIKE ?)";
      const pattern = `%${search}%`;
      params.push(pattern, pattern);
    }

    if (status) {
      sql += " AND ap.status = ?";
      params.push(status);
    }

    if (supplierId) {
      sql += " AND ap.supplier_id = ?";
      params.push(supplierId);
    }

    if (overdue) {
      sql += " AND ap.due_date < CURDATE() AND ap.status <> 'paid'";
    }

    const countSql = `SELECT COUNT(*) as total ${sql}`;
    const dataSql = `
      SELECT ap.*, 
             s.name as supplier_name, s.company_name as supplier_company_name, 
             s.contact_person as supplier_contact_person, s.phone as supplier_phone, s.email as supplier_email,
             po.po_number as order_po_number, po.order_date as order_date, 
             po.total_amount as order_total_amount, po.received_total as order_received_total
      ${sql}
      ORDER BY ap.id DESC
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
      purchaseOrderId: row.purchase_order_id,
      supplierId: row.supplier_id,
      poNumber: row.po_number,
      receiptDate: row.receipt_date,
      dueDate: row.due_date,
      amount: Number(row.amount),
      paidAmount: Number(row.paid_amount),
      outstandingAmount: Number(row.outstanding_amount),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      supplier: {
        id: row.supplier_id,
        name: row.supplier_name,
        companyName: row.supplier_company_name,
        contactPerson: row.supplier_contact_person,
        phone: row.supplier_phone,
        email: row.supplier_email
      },
      purchaseOrder: {
        id: row.purchase_order_id,
        poNumber: row.order_po_number,
        orderDate: row.order_date,
        totalAmount: Number(row.order_total_amount),
        receivedTotal: Number(row.order_received_total)
      }
    }));

    return { data: formattedRows, total: countRows[0].total };
  }

  async findById(id) {
    const sql = `
      SELECT ap.*, 
             s.name as supplier_name, s.company_name as supplier_company_name, 
             s.contact_person as supplier_contact_person, s.phone as supplier_phone, s.email as supplier_email,
             po.po_number as order_po_number, po.order_date as order_date, 
             po.total_amount as order_total_amount, po.received_total as order_received_total
      FROM accounts_payable ap
      JOIN suppliers s ON ap.supplier_id = s.id
      JOIN purchase_orders po ON ap.purchase_order_id = po.id
      WHERE ap.id = ? AND ap.delete_flg = 0
      LIMIT 1
    `;
    const rows = await query(sql, [id]);
    if (!rows[0]) return null;

    const row = rows[0];
    return {
      ...row,
      id: row.id,
      purchaseOrderId: row.purchase_order_id,
      supplierId: row.supplier_id,
      poNumber: row.po_number,
      receiptDate: row.receipt_date,
      dueDate: row.due_date,
      amount: Number(row.amount),
      paidAmount: Number(row.paid_amount),
      outstandingAmount: Number(row.outstanding_amount),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      supplier: {
        id: row.supplier_id,
        name: row.supplier_name,
        companyName: row.supplier_company_name,
        contactPerson: row.supplier_contact_person,
        phone: row.supplier_phone,
        email: row.supplier_email
      },
      purchaseOrder: {
        id: row.purchase_order_id,
        poNumber: row.order_po_number,
        orderDate: row.order_date,
        totalAmount: Number(row.order_total_amount),
        receivedTotal: Number(row.order_received_total)
      }
    };
  }

  async findByPoId(purchaseOrderId) {
    const sql = `
      SELECT ap.*, 
             s.name as supplier_name, s.company_name as supplier_company_name, 
             s.contact_person as supplier_contact_person, s.phone as supplier_phone, s.email as supplier_email,
             po.po_number as order_po_number, po.order_date as order_date, 
             po.total_amount as order_total_amount, po.received_total as order_received_total
      FROM accounts_payable ap
      JOIN suppliers s ON ap.supplier_id = s.id
      JOIN purchase_orders po ON ap.purchase_order_id = po.id
      WHERE ap.purchase_order_id = ? AND ap.delete_flg = 0
      LIMIT 1
    `;
    const rows = await query(sql, [purchaseOrderId]);
    if (!rows[0]) return null;

    const row = rows[0];
    return {
      ...row,
      id: row.id,
      purchaseOrderId: row.purchase_order_id,
      supplierId: row.supplier_id,
      poNumber: row.po_number,
      receiptDate: row.receipt_date,
      dueDate: row.due_date,
      amount: Number(row.amount),
      paidAmount: Number(row.paid_amount),
      outstandingAmount: Number(row.outstanding_amount),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      supplier: {
        id: row.supplier_id,
        name: row.supplier_name,
        companyName: row.supplier_company_name,
        contactPerson: row.supplier_contact_person,
        phone: row.supplier_phone,
        email: row.supplier_email
      },
      purchaseOrder: {
        id: row.purchase_order_id,
        poNumber: row.order_po_number,
        orderDate: row.order_date,
        totalAmount: Number(row.order_total_amount),
        receivedTotal: Number(row.order_received_total)
      }
    };
  }

  async create(data) {
    const sql = `
      INSERT INTO accounts_payable (
        purchase_order_id, supplier_id, po_number, receipt_date, due_date,
        amount, paid_amount, outstanding_amount, status, notes,
        delete_flg, created_ip, updated_ip
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
    `;
    const result = await query(sql, [
      data.purchaseOrderId, data.supplierId, data.poNumber, data.receiptDate, data.dueDate || null,
      data.amount, data.paidAmount || 0, data.outstandingAmount, data.status || 'unpaid', data.notes || null,
      data.createdIp || null, data.updatedIp || null
    ]);
    return this.findById(result.insertId);
  }

  async update(id, data) {
    const fields = [];
    const params = [];

    if (data.dueDate !== undefined) {
      fields.push("due_date = ?");
      params.push(data.dueDate);
    }
    if (data.notes !== undefined) {
      fields.push("notes = ?");
      params.push(data.notes);
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

    if (fields.length === 0) return this.findById(id);

    const sql = `UPDATE accounts_payable SET ${fields.join(", ")} WHERE id = ?`;
    params.push(id);
    await query(sql, params);
    return this.findById(id);
  }
}
