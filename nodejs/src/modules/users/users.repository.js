import { query } from "#shared/database/mysql";

export class UsersRepository {
  async findPaginated({ page, perPage, search, role, status }) {
    const offset = (page - 1) * perPage;
    let sql = `
      SELECT u.*, e.id as emp_id, e.first_name, e.last_name, e.position, e.email as emp_email
      FROM users u
      LEFT JOIN employees e ON u.employee_id = e.id
      WHERE u.delete_flg = 0
        AND u.role <> 'admin'
    `;
    const params = [];

    if (search) {
      sql += ` AND (
        u.username LIKE ? OR 
        u.email LIKE ? OR 
        e.first_name LIKE ? OR 
        e.last_name LIKE ?
      )`;
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern, searchPattern);
    }

    if (role) {
      sql += " AND u.role = ?";
      params.push(role);
    }

    if (status !== undefined) {
      sql += " AND u.status = ?";
      params.push(status);
    }

    const countSql = `SELECT COUNT(*) as total FROM (${sql}) as sub`;
    const countParams = [...params];

    sql += " ORDER BY u.id DESC LIMIT ? OFFSET ?";
    params.push(perPage, offset);

    const [rows, countRows] = await Promise.all([
      query(sql, params),
      query(countSql, countParams)
    ]);

    const formattedRows = rows.map(row => this._mapUserWithEmployee(row));

    return { rows: formattedRows, total: countRows[0].total };
  }

  async findById(id) {
    const sql = `
      SELECT u.*, e.id as emp_id, e.first_name, e.last_name, e.position, e.email as emp_email
      FROM users u
      LEFT JOIN employees e ON u.employee_id = e.id
      WHERE u.id = ? AND u.delete_flg = 0
      LIMIT 1
    `;
    const rows = await query(sql, [id]);
    return rows[0] ? this._mapUserWithEmployee(rows[0]) : null;
  }

  async findByUsername(username) {
    const sql = "SELECT * FROM users WHERE username = ? LIMIT 1";
    const rows = await query(sql, [username]);
    return rows[0] || null;
  }

  async findByEmail(email) {
    const sql = "SELECT * FROM users WHERE email = ? LIMIT 1";
    const rows = await query(sql, [email]);
    return rows[0] || null;
  }

  async findByEmployeeId(employeeId) {
    const sql = "SELECT * FROM users WHERE employee_id = ? AND delete_flg = 0 LIMIT 1";
    const rows = await query(sql, [employeeId]);
    return rows[0] || null;
  }

  async findEmployeeById(employeeId) {
    const sql = "SELECT * FROM employees WHERE id = ? AND delete_flg = 0 LIMIT 1";
    const rows = await query(sql, [employeeId]);
    return rows[0] || null;
  }

  async findAvailableEmployees(search) {
    let sql = `
      SELECT e.id, e.first_name, e.last_name, e.position, e.email, e.status
      FROM employees e
      LEFT JOIN users u ON e.id = u.employee_id
      WHERE e.delete_flg = 0 AND u.id IS NULL
    `;
    const params = [];

    if (search) {
      sql += ` AND (
        e.first_name LIKE ? OR 
        e.last_name LIKE ? OR 
        e.email LIKE ? OR 
        e.position LIKE ?
      )`;
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern, searchPattern);
    }

    sql += " ORDER BY e.first_name ASC, e.last_name ASC";
    
    const rows = await query(sql, params);
    return rows.map(row => ({
      id: row.id,
      firstName: row.first_name,
      lastName: row.last_name,
      position: row.position,
      email: row.email,
      status: row.status
    }));
  }

  async create(data) {
    const sql = `
      INSERT INTO users (employee_id, username, email, password_hash, role, status, created_ip, updated_ip)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const result = await query(sql, [
      data.employeeId, data.username, data.email, data.passwordHash,
      data.role || 'staff', data.status !== undefined ? data.status : 1,
      data.createdIp || null, data.updatedIp || null
    ]);
    return this.findById(result.insertId);
  }

  async update(id, data) {
    const fields = [];
    const params = [];

    const map = {
      username: 'username',
      email: 'email',
      passwordHash: 'password_hash',
      role: 'role',
      status: 'status',
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

    const sql = `UPDATE users SET ${fields.join(', ')} WHERE id = ?`;
    params.push(id);
    await query(sql, params);

    return this.findById(id);
  }

  _mapUserWithEmployee(row) {
    const user = {
      id: row.id,
      employeeId: row.employee_id,
      username: row.username,
      email: row.email,
      passwordHash: row.password_hash,
      role: row.role,
      status: row.status === 1,
      deleteFlag: row.delete_flg === 1,
      lastLoginAt: row.last_login_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };

    if (row.emp_id) {
      user.employee = {
        id: row.emp_id,
        firstName: row.first_name,
        lastName: row.last_name,
        position: row.position,
        email: row.emp_email
      };
    } else {
      user.employee = null;
    }

    return user;
  }
}
