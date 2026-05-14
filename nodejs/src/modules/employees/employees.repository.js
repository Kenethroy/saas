import { query } from "#shared/database/mysql";

export class EmployeesRepository {
  async findPaginated({ page, perPage, search, position, status, excludeUsers }) {
    const offset = (page - 1) * perPage;
    let sql = `
      SELECT e.*, u.id as user_id, u.username, u.email as user_email, u.role, u.status as user_status
      FROM employees e
      LEFT JOIN users u ON e.id = u.employee_id
      WHERE e.delete_flg = 0
        AND (u.id IS NULL OR u.role <> 'admin')
    `;
    const params = [];

    if (search) {
      sql += ` AND (
        e.first_name LIKE ? OR 
        e.last_name LIKE ? OR 
        e.phone LIKE ? OR 
        e.email LIKE ?
      )`;
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern, searchPattern);
    }

    if (position) {
      sql += " AND e.position = ?";
      params.push(position);
    }

    if (status) {
      sql += " AND e.status = ?";
      params.push(status);
    }

    if (excludeUsers) {
      sql += " AND u.id IS NULL";
    }

    const countSql = `SELECT COUNT(*) as total FROM (${sql}) as sub`;
    const countParams = [...params];

    sql += " ORDER BY e.id DESC LIMIT ? OFFSET ?";
    params.push(perPage, offset);

    const [rows, countRows] = await Promise.all([
      query(sql, params),
      query(countSql, countParams)
    ]);

    const formattedRows = rows.map(row => this._mapEmployeeWithUser(row));

    return { rows: formattedRows, total: countRows[0].total };
  }

  async findById(id) {
    const sql = `
      SELECT e.*, u.id as user_id, u.username, u.email as user_email, u.role, u.status as user_status
      FROM employees e
      LEFT JOIN users u ON e.id = u.employee_id
      WHERE e.id = ? AND e.delete_flg = 0
      LIMIT 1
    `;
    const rows = await query(sql, [id]);
    return rows[0] ? this._mapEmployeeWithUser(rows[0]) : null;
  }

  async create(data) {
    const sql = `
      INSERT INTO employees (
        first_name, last_name, position, phone, email, 
        status, address, license_number, license_expiry, 
        emergency_contact_name, emergency_contact_phone, 
        date_hired, salary_rate, rate_type, 
        sss_no, tin_no, philhealth_no, pagibig_no,
        created_ip, updated_ip
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const result = await query(sql, [
      data.firstName, data.lastName, data.position, data.phone || null, data.email || null,
      data.status || 'active', data.address || null, data.licenseNumber || null, data.licenseExpiry || null,
      data.emergencyContactName || null, data.emergencyContactPhone || null,
      data.dateHired || null, data.salaryRate || 0, data.rateType || 'Daily',
      data.sssNo || null, data.tinNo || null, data.philhealthNo || null, data.pagibigNo || null,
      data.createdIp || null, data.updatedIp || null
    ]);
    return { id: result.insertId, ...data };
  }

  async update(id, data) {
    const fields = [];
    const params = [];

    const map = {
      firstName: 'first_name',
      lastName: 'last_name',
      position: 'position',
      phone: 'phone',
      email: 'email',
      status: 'status',
      address: 'address',
      licenseNumber: 'license_number',
      licenseExpiry: 'license_expiry',
      emergencyContactName: 'emergency_contact_name',
      emergencyContactPhone: 'emergency_contact_phone',
      dateHired: 'date_hired',
      salaryRate: 'salary_rate',
      rateType: 'rate_type',
      sssNo: 'sss_no',
      tinNo: 'tin_no',
      philhealthNo: 'philhealth_no',
      pagibigNo: 'pagibig_no',
      deleteFlag: 'delete_flg',
      updatedIp: 'updated_ip'
    };

    for (const [key, column] of Object.entries(map)) {
      if (data[key] !== undefined) {
        fields.push(`${column} = ?`);
        params.push(data[key]);
      }
    }

    if (fields.length === 0) return this.findById(id);

    const sql = `UPDATE employees SET ${fields.join(', ')} WHERE id = ?`;
    params.push(id);
    await query(sql, params);

    return this.findById(id);
  }

  _mapEmployeeWithUser(row) {
    const employee = {
      id: row.id,
      firstName: row.first_name,
      lastName: row.last_name,
      position: row.position,
      phone: row.phone,
      email: row.email,
      status: row.status,
      address: row.address,
      licenseNumber: row.license_number,
      licenseExpiry: row.license_expiry,
      emergencyContactName: row.emergency_contact_name,
      emergencyContactPhone: row.emergency_contact_phone,
      dateHired: row.date_hired,
      salaryRate: row.salary_rate,
      rateType: row.rate_type,
      sssNo: row.sss_no,
      tinNo: row.tin_no,
      philhealthNo: row.philhealth_no,
      pagibigNo: row.pagibig_no,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };

    if (row.user_id) {
      employee.user = {
        id: row.user_id,
        username: row.username,
        email: row.user_email,
        role: row.role,
        status: row.user_status
      };
    } else {
      employee.user = null;
    }

    return employee;
  }
}
