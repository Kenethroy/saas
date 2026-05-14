import { query } from "#shared/database/mysql";

function mapExpenseRow(row) {
  return {
    id: row.id,
    categoryId: row.category_id,
    recurringExpenseId: row.recurring_expense_id,
    amount: Number(row.amount),
    expenseDate: row.expense_date,
    description: row.description,
    payee: row.payee,
    paymentMethod: row.payment_method,
    referenceNumber: row.reference_number,
    attachmentUrl: row.attachment_url,
    status: row.status,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    category: {
      id: row.category_id,
      parentId: row.category_parent_id,
      name: row.category_name,
      parentName: row.parent_category_name
    },
    recurringExpense: row.recurring_expense_id ? {
      id: row.recurring_expense_id,
      frequency: row.recurring_frequency,
      nextRunDate: row.recurring_next_run_date,
      isActive: row.recurring_is_active === 1
    } : null
  };
}

function mapRecurringRow(row) {
  return {
    id: row.id,
    categoryId: row.category_id,
    amount: Number(row.amount),
    description: row.description,
    payee: row.payee,
    paymentMethod: row.payment_method,
    frequency: row.frequency,
    dayOfMonth: row.day_of_month,
    dayOfWeek: row.day_of_week,
    monthOfYear: row.month_of_year,
    isActive: row.is_active === 1,
    lastRunDate: row.last_run_date,
    nextRunDate: row.next_run_date,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    category: {
      id: row.category_id,
      parentId: row.category_parent_id,
      name: row.category_name,
      parentName: row.parent_category_name
    },
    generatedExpensesCount: Number(row.generated_expenses_count || 0)
  };
}

export const businessExpensesRepository = {
  async findCategories(tenantId, { includeInactive = false } = {}) {
    let sql = `
      SELECT
        ec.id,
        ec.parent_id,
        ec.name,
        ec.description,
        ec.sort_order,
        ec.status,
        ec.delete_flg
      FROM expense_categories ec
      WHERE ec.tenant_id = ?
        AND ec.delete_flg = 0
    `;
    const params = [tenantId];

    if (!includeInactive) {
      sql += " AND ec.status = 1";
    }

    sql += " ORDER BY ec.sort_order ASC, ec.name ASC";

    return query(sql, params);
  },

  async findCategoryById(tenantId, id) {
    const rows = await query(`
      SELECT *
      FROM expense_categories
      WHERE tenant_id = ? AND id = ? AND delete_flg = 0 AND status = 1
      LIMIT 1
    `, [tenantId, id]);

    return rows[0] || null;
  },

  async listExpenses(tenantId, { search, status, categoryId, paymentMethod, dateFrom, dateTo, branchId, skip, take }) {
    let sql = `
      SELECT
        be.*,
        ec.parent_id AS category_parent_id,
        ec.name AS category_name,
        parent.name AS parent_category_name,
        rbe.frequency AS recurring_frequency,
        rbe.next_run_date AS recurring_next_run_date,
        rbe.is_active AS recurring_is_active
      FROM business_expenses be
      INNER JOIN expense_categories ec ON ec.id = be.category_id AND ec.tenant_id = be.tenant_id
      LEFT JOIN expense_categories parent ON parent.id = ec.parent_id AND parent.tenant_id = ec.tenant_id
      LEFT JOIN recurring_business_expenses rbe ON rbe.id = be.recurring_expense_id AND rbe.tenant_id = be.tenant_id
      WHERE be.tenant_id = ?
        AND be.delete_flg = 0
    `;
    const params = [tenantId];

    if (branchId) {
      sql += " AND be.branch_id = ?";
      params.push(branchId);
    }

    if (search) {
      sql += `
        AND (
          be.description LIKE ?
          OR be.payee LIKE ?
          OR be.reference_number LIKE ?
          OR ec.name LIKE ?
          OR parent.name LIKE ?
        )
      `;
      const pattern = `%${search}%`;
      params.push(pattern, pattern, pattern, pattern, pattern);
    }

    if (status) {
      sql += " AND be.status = ?";
      params.push(status);
    }

    if (categoryId) {
      sql += " AND be.category_id = ?";
      params.push(categoryId);
    }

    if (paymentMethod) {
      sql += " AND be.payment_method = ?";
      params.push(paymentMethod);
    }

    if (dateFrom) {
      sql += " AND be.expense_date >= ?";
      params.push(dateFrom);
    }

    if (dateTo) {
      sql += " AND be.expense_date <= ?";
      params.push(dateTo);
    }

    const countSql = `SELECT COUNT(*) AS total FROM (${sql}) expense_count`;
    const countParams = [...params];

    sql += " ORDER BY be.expense_date DESC, be.id DESC LIMIT ? OFFSET ?";
    params.push(take, skip);

    const [rows, countRows] = await Promise.all([
      query(sql, params),
      query(countSql, countParams)
    ]);

    return {
      items: rows.map(mapExpenseRow),
      total: Number(countRows[0]?.total || 0)
    };
  },

  async findExpenseById(tenantId, id) {
    const rows = await query(`
      SELECT
        be.*,
        ec.parent_id AS category_parent_id,
        ec.name AS category_name,
        parent.name AS parent_category_name,
        rbe.frequency AS recurring_frequency,
        rbe.next_run_date AS recurring_next_run_date,
        rbe.is_active AS recurring_is_active
      FROM business_expenses be
      INNER JOIN expense_categories ec ON ec.id = be.category_id AND ec.tenant_id = be.tenant_id
      LEFT JOIN expense_categories parent ON parent.id = ec.parent_id AND parent.tenant_id = ec.tenant_id
      LEFT JOIN recurring_business_expenses rbe ON rbe.id = be.recurring_expense_id AND rbe.tenant_id = be.tenant_id
      WHERE be.tenant_id = ? AND be.id = ? AND be.delete_flg = 0
      LIMIT 1
    `, [tenantId, id]);

    return rows[0] ? mapExpenseRow(rows[0]) : null;
  },

  async createExpense(tenantId, data) {
    const result = await query(`
      INSERT INTO business_expenses (
        tenant_id,
        branch_id,
        category_id,
        recurring_expense_id,
        amount,
        expense_date,
        description,
        payee,
        payment_method,
        reference_number,
        attachment_url,
        status,
        created_by,
        created_ip,
        updated_ip
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      tenantId,
      data.branchId ?? null,
      data.categoryId,
      data.recurringExpenseId ?? null,
      data.amount,
      data.expenseDate,
      data.description ?? null,
      data.payee ?? null,
      data.paymentMethod,
      data.referenceNumber ?? null,
      data.attachmentUrl ?? null,
      data.status,
      data.createdBy ?? null,
      data.createdIp ?? null,
      data.updatedIp ?? null
    ]);

    return this.findExpenseById(tenantId, result.insertId);
  },

  async updateExpense(tenantId, id, data) {
    const fields = [];
    const params = [];
    const map = {
      branchId: "branch_id",
      categoryId: "category_id",
      recurringExpenseId: "recurring_expense_id",
      amount: "amount",
      expenseDate: "expense_date",
      description: "description",
      payee: "payee",
      paymentMethod: "payment_method",
      referenceNumber: "reference_number",
      attachmentUrl: "attachment_url",
      status: "status",
      updatedIp: "updated_ip",
      deleteFlag: "delete_flg"
    };

    for (const [key, column] of Object.entries(map)) {
      if (data[key] !== undefined) {
        fields.push(`${column} = ?`);
        params.push(key === "deleteFlag" ? (data[key] ? 1 : 0) : data[key]);
      }
    }

    if (fields.length === 0) {
      return this.findExpenseById(tenantId, id);
    }

    await query(`UPDATE business_expenses SET ${fields.join(", ")} WHERE tenant_id = ? AND id = ?`, [...params, tenantId, id]);
    return this.findExpenseById(tenantId, id);
  },

  async listRecurringExpenses(tenantId, { search, categoryId, frequency, isActive }) {
    let sql = `
      SELECT
        rbe.*,
        ec.parent_id AS category_parent_id,
        ec.name AS category_name,
        parent.name AS parent_category_name,
        COALESCE(expense_counts.generated_expenses_count, 0) AS generated_expenses_count
      FROM recurring_business_expenses rbe
      INNER JOIN expense_categories ec ON ec.id = rbe.category_id AND ec.tenant_id = rbe.tenant_id
      LEFT JOIN expense_categories parent ON parent.id = ec.parent_id AND parent.tenant_id = ec.tenant_id
      LEFT JOIN (
        SELECT recurring_expense_id, COUNT(*) AS generated_expenses_count
        FROM business_expenses
        WHERE tenant_id = ? AND delete_flg = 0 AND recurring_expense_id IS NOT NULL
        GROUP BY recurring_expense_id
      ) expense_counts ON expense_counts.recurring_expense_id = rbe.id
      WHERE rbe.tenant_id = ? AND rbe.delete_flg = 0
    `;
    const params = [tenantId, tenantId];

    if (search) {
      sql += `
        AND (
          rbe.description LIKE ?
          OR rbe.payee LIKE ?
          OR ec.name LIKE ?
          OR parent.name LIKE ?
        )
      `;
      const pattern = `%${search}%`;
      params.push(pattern, pattern, pattern, pattern);
    }

    if (categoryId) {
      sql += " AND rbe.category_id = ?";
      params.push(categoryId);
    }

    if (frequency) {
      sql += " AND rbe.frequency = ?";
      params.push(frequency);
    }

    if (isActive !== undefined) {
      sql += " AND rbe.is_active = ?";
      params.push(isActive ? 1 : 0);
    }

    sql += `
      ORDER BY
        rbe.next_run_date ASC,
        rbe.id DESC
    `;

    const rows = await query(sql, params);
    return rows.map(mapRecurringRow);
  },

  async findRecurringExpenseById(tenantId, id) {
    const rows = await query(`
      SELECT
        rbe.*,
        ec.parent_id AS category_parent_id,
        ec.name AS category_name,
        parent.name AS parent_category_name,
        COALESCE(expense_counts.generated_expenses_count, 0) AS generated_expenses_count
      FROM recurring_business_expenses rbe
      INNER JOIN expense_categories ec ON ec.id = rbe.category_id AND ec.tenant_id = rbe.tenant_id
      LEFT JOIN expense_categories parent ON parent.id = ec.parent_id AND parent.tenant_id = ec.tenant_id
      LEFT JOIN (
        SELECT recurring_expense_id, COUNT(*) AS generated_expenses_count
        FROM business_expenses
        WHERE tenant_id = ? AND delete_flg = 0 AND recurring_expense_id IS NOT NULL
        GROUP BY recurring_expense_id
      ) expense_counts ON expense_counts.recurring_expense_id = rbe.id
      WHERE rbe.tenant_id = ? AND rbe.id = ? AND rbe.delete_flg = 0
      LIMIT 1
    `, [tenantId, tenantId, id]);

    return rows[0] ? mapRecurringRow(rows[0]) : null;
  },

  async createRecurringExpense(tenantId, data) {
    const result = await query(`
      INSERT INTO recurring_business_expenses (
        tenant_id,
        category_id,
        amount,
        description,
        payee,
        payment_method,
        frequency,
        day_of_month,
        day_of_week,
        month_of_year,
        is_active,
        last_run_date,
        next_run_date,
        created_by,
        created_ip,
        updated_ip
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      tenantId,
      data.categoryId,
      data.amount,
      data.description ?? null,
      data.payee ?? null,
      data.paymentMethod,
      data.frequency,
      data.dayOfMonth ?? null,
      data.dayOfWeek ?? null,
      data.monthOfYear ?? null,
      data.isActive ? 1 : 0,
      data.lastRunDate ?? null,
      data.nextRunDate ?? null,
      data.createdBy ?? null,
      data.createdIp ?? null,
      data.updatedIp ?? null
    ]);

    return this.findRecurringExpenseById(tenantId, result.insertId);
  },

  async updateRecurringExpense(tenantId, id, data) {
    const fields = [];
    const params = [];
    const map = {
      categoryId: "category_id",
      amount: "amount",
      description: "description",
      payee: "payee",
      paymentMethod: "payment_method",
      frequency: "frequency",
      dayOfMonth: "day_of_month",
      dayOfWeek: "day_of_week",
      monthOfYear: "month_of_year",
      isActive: "is_active",
      lastRunDate: "last_run_date",
      nextRunDate: "next_run_date",
      updatedIp: "updated_ip",
      deleteFlag: "delete_flg"
    };

    for (const [key, column] of Object.entries(map)) {
      if (data[key] !== undefined) {
        fields.push(`${column} = ?`);
        if (key === "isActive" || key === "deleteFlag") {
          params.push(data[key] ? 1 : 0);
        } else {
          params.push(data[key]);
        }
      }
    }

    if (fields.length === 0) {
      return this.findRecurringExpenseById(tenantId, id);
    }

    await query(`UPDATE recurring_business_expenses SET ${fields.join(", ")} WHERE tenant_id = ? AND id = ?`, [...params, tenantId, id]);
    return this.findRecurringExpenseById(tenantId, id);
  },

  async summarizeExpenses(tenantId, { branchId, weekStart, weekEnd, monthStart, monthEnd }) {
    const branchClause = branchId ? " AND branch_id = ?" : "";
    const branchParams = branchId ? [branchId] : [];

    const [weekRows, monthRows, topRows] = await Promise.all([
      query(`
        SELECT COALESCE(SUM(amount), 0) AS total
        FROM business_expenses
        WHERE tenant_id = ?
          AND delete_flg = 0
          AND status = 'paid'
          ${branchClause}
          AND expense_date >= ?
          AND expense_date <= ?
      `, [tenantId, ...branchParams, weekStart, weekEnd]),
      query(`
        SELECT COALESCE(SUM(amount), 0) AS total
        FROM business_expenses
        WHERE tenant_id = ?
          AND delete_flg = 0
          AND status = 'paid'
          ${branchClause}
          AND expense_date >= ?
          AND expense_date <= ?
      `, [tenantId, ...branchParams, monthStart, monthEnd]),
      query(`
        SELECT
          be.category_id AS categoryId,
          ec.name AS category,
          parent.name AS parentCategory,
          SUM(be.amount) AS total
        FROM business_expenses be
        INNER JOIN expense_categories ec ON ec.id = be.category_id AND ec.tenant_id = be.tenant_id
        LEFT JOIN expense_categories parent ON parent.id = ec.parent_id AND parent.tenant_id = ec.tenant_id
        WHERE be.tenant_id = ?
          AND be.delete_flg = 0
          AND be.status = 'paid'
          ${branchId ? " AND be.branch_id = ?" : ""}
          AND be.expense_date >= ?
          AND be.expense_date <= ?
        GROUP BY be.category_id, ec.name, parent.name
        ORDER BY total DESC
        LIMIT 5
      `, branchId ? [tenantId, branchId, monthStart, monthEnd] : [tenantId, monthStart, monthEnd])
    ]);

    return {
      thisWeekTotal: Number(weekRows[0]?.total || 0),
      thisMonthTotal: Number(monthRows[0]?.total || 0),
      topCategories: topRows.map((row) => ({
        categoryId: row.categoryId,
        category: row.category,
        parentCategory: row.parentCategory,
        total: Number(row.total || 0)
      }))
    };
  }
};
