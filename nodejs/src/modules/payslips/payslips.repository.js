import { query, transaction } from "#shared/database/mysql";
import { AppError } from "#shared/utils/app-error";
import { allocateDocumentNumber } from "#shared/utils/document-sequences";

function formatShortDate(val) {
  if (!val) return "";
  const d = new Date(val);
  if (isNaN(d.getTime())) return String(val);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const y = d.getFullYear();
  return `${m}/${day}/${y}`;
}

export class PayslipsRepository {
  async findPaginated(tenantId, { page = 1, limit = 10, employeeId, dateFrom, dateTo, status } = {}) {
    const offset = (page - 1) * limit;

    let whereSql = "WHERE p.tenant_id = ? AND p.delete_flg = 0";
    const params = [tenantId];

    if (employeeId) {
      whereSql += " AND p.employee_id = ?";
      params.push(employeeId);
    }

    if (status) {
      whereSql += " AND p.status = ?";
      params.push(status);
    }

    if (dateFrom) {
      whereSql += " AND p.pay_date >= ?";
      params.push(dateFrom);
    }

    if (dateTo) {
      whereSql += " AND p.pay_date <= ?";
      params.push(dateTo);
    }

    const countSql = `
      SELECT COUNT(*) as total
      FROM payslips p
      ${whereSql}
    `;

    const dataSql = `
      SELECT
        p.*,
        e.first_name,
        e.last_name
      FROM payslips p
      LEFT JOIN employees e ON e.id = p.employee_id AND e.tenant_id = p.tenant_id
      ${whereSql}
      ORDER BY p.pay_date DESC, p.id DESC
      LIMIT ? OFFSET ?
    `;

    const [countRows, rows] = await Promise.all([
      query(countSql, params),
      query(dataSql, [...params, limit, offset])
    ]);

    return {
      data: rows.map((row) => ({
        id: Number(row.id),
        payslip_number: row.payslip_number,
        employee_id: Number(row.employee_id),
        employee_name: row.first_name ? `${row.first_name} ${row.last_name ?? ""}`.trim() : null,
        period_start: row.period_start,
        period_end: row.period_end,
        pay_date: row.pay_date,
        gross_pay: Number(row.gross_pay),
        overtime_pay: Number(row.overtime_pay ?? 0),
        total_deductions: Number(row.total_deductions),
        net_pay: Number(row.net_pay),
        notes: row.notes,
        metadata: typeof row.metadata === "string" ? JSON.parse(row.metadata) : row.metadata,
        status: row.status,
        created_at: row.created_at,
        updated_at: row.updated_at
      })),
      total: Number(countRows?.[0]?.total ?? 0)
    };
  }

  async findById(tenantId, id) {
    const rows = await query(`
      SELECT
        p.*,
        e.first_name,
        e.last_name
      FROM payslips p
      LEFT JOIN employees e ON e.id = p.employee_id AND e.tenant_id = p.tenant_id
      WHERE p.tenant_id = ? AND p.id = ? AND p.delete_flg = 0
      LIMIT 1
    `, [tenantId, id]);

    const row = rows[0];
    if (!row) return null;

    return {
      id: Number(row.id),
      payslip_number: row.payslip_number,
      employee_id: Number(row.employee_id),
      employee_name: row.first_name ? `${row.first_name} ${row.last_name ?? ""}`.trim() : null,
      period_start: row.period_start,
      period_end: row.period_end,
      pay_date: row.pay_date,
      gross_pay: Number(row.gross_pay),
      overtime_pay: Number(row.overtime_pay ?? 0),
      total_deductions: Number(row.total_deductions),
      net_pay: Number(row.net_pay),
      notes: row.notes,
      metadata: typeof row.metadata === "string" ? JSON.parse(row.metadata) : row.metadata,
      status: row.status,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }

  async create(payload, context = {}) {
    const tenantId = context.tenantId ?? null;
    const employeeId = Number(payload.employee_id);
    const basicPay = Number(payload.basic_pay ?? 0);
    const overtimePay = Number(payload.overtime_pay ?? 0);
    const allowances = Number(payload.allowances ?? 0);
    const deductions = Number(payload.deductions ?? 0);

    if (payload.period_start > payload.period_end) {
      throw new AppError("Period start cannot be after period end", 400);
    }

    const grossPay = basicPay + overtimePay + allowances;
    const netPay = grossPay - deductions;
    if (netPay < 0) {
      throw new AppError("Net pay cannot be negative", 400);
    }

    const ipAddress = context.ipAddress ?? null;

    if (!tenantId) {
      throw new AppError("Tenant context is required", 400);
    }

    return transaction(async (tx) => {
      const [employeeRows] = await tx.execute(
        "SELECT id, tenant_id, branch_id, first_name, last_name FROM employees WHERE tenant_id = ? AND id = ? AND delete_flg = 0 LIMIT 1",
        [tenantId, employeeId]
      );
      const employee = employeeRows[0];
      if (!employee) {
        throw new AppError("Employee not found", 404);
      }

      let effectiveBranchId = employee.branch_id ?? null;
      if (!effectiveBranchId) {
        const [branchRows] = await tx.execute(
          `
            SELECT id
            FROM branches
            WHERE tenant_id = ?
              AND is_primary = 1
            LIMIT 1
          `,
          [tenantId]
        );
        effectiveBranchId = branchRows[0]?.id ? Number(branchRows[0].id) : null;
      }

      const payslipNumber = await allocateDocumentNumber({
        tenantId,
        branchId: effectiveBranchId,
        documentType: "payslip",
        at: payload.pay_date,
        tx
      });

      const metadata = JSON.stringify({
        basic_pay: basicPay,
        allowances,
        deductions
      });

      const [result] = await tx.execute(`
        INSERT INTO payslips (
          tenant_id, branch_id, payslip_number, employee_id, period_start, period_end, pay_date,
          gross_pay, overtime_pay, total_deductions, net_pay, notes, metadata, status,
          created_ip, updated_ip
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        tenantId,
        effectiveBranchId,
        payslipNumber,
        employeeId,
        payload.period_start,
        payload.period_end,
        payload.pay_date,
        grossPay,
        overtimePay,
        deductions,
        netPay,
        payload.notes || null,
        metadata,
        payload.status || "draft",
        ipAddress,
        ipAddress
      ]);

      const insertId = result.insertId;

      if ((payload.status || "draft") === "released") {
        const employeeName = `${employee.first_name || ""} ${employee.last_name || ""}`.trim() || `Employee #${employeeId}`;

        const [categoryRows] = await tx.execute(
          "SELECT id FROM expense_categories WHERE tenant_id = ? AND name = 'Administrative Salaries' AND delete_flg = 0 AND status = 1 LIMIT 1",
          [tenantId]
        );
        const categoryId = categoryRows[0]?.id ?? null;

        if (categoryId) {
          await tx.execute(`
            INSERT INTO business_expenses (
              tenant_id, branch_id, category_id, payslip_id, amount, expense_date,
              description, payee, payment_method, status,
              created_by, created_ip, updated_ip
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'cash', 'paid', ?, ?, ?)
          `, [
            tenantId,
            effectiveBranchId,
            categoryId,
            insertId,
            netPay,
            payload.pay_date,
            `Salary — ${payslipNumber} (${formatShortDate(payload.period_start)} to ${formatShortDate(payload.period_end)})`,
            employeeName,
            context.userId ?? null,
            ipAddress,
            ipAddress
          ]);
        }
      }

      return insertId;
    }).then((id) => this.findById(tenantId, id));
  }

  async update(tenantId, id, payload, context = {}) {
    if (!tenantId) {
      throw new AppError("Tenant context is required", 400);
    }
    const existing = await this.findById(tenantId, id);
    if (!existing) {
      throw new AppError("Payslip not found", 404);
    }

    const next = {
      employee_id: payload.employee_id ?? existing.employee_id,
      period_start: payload.period_start ?? existing.period_start,
      period_end: payload.period_end ?? existing.period_end,
      pay_date: payload.pay_date ?? existing.pay_date,
      notes: payload.notes ?? existing.notes,
      status: payload.status ?? existing.status,
      overtime_pay: Number(payload.overtime_pay ?? existing.overtime_pay ?? 0),
      metadata: payload.basic_pay !== undefined || payload.allowances !== undefined || payload.deductions !== undefined
        ? {
          basic_pay: Number(payload.basic_pay ?? existing.metadata?.basic_pay ?? 0),
          allowances: Number(payload.allowances ?? existing.metadata?.allowances ?? 0),
          deductions: Number(payload.deductions ?? existing.metadata?.deductions ?? 0)
        }
        : (existing.metadata ?? { basic_pay: 0, allowances: 0, deductions: 0 })
    };

    if (next.period_start > next.period_end) {
      throw new AppError("Period start cannot be after period end", 400);
    }

    const grossPay = Number(next.metadata.basic_pay) + Number(next.overtime_pay ?? 0) + Number(next.metadata.allowances);
    const netPay = grossPay - Number(next.metadata.deductions);
    if (netPay < 0) {
      throw new AppError("Net pay cannot be negative", 400);
    }

    const ipAddress = context.ipAddress ?? null;
    const userId = context.userId ?? null;
    const statusChanged = existing.status !== next.status;
    const becomingReleased = statusChanged && next.status === "released";
    const becomingDraft = statusChanged && next.status === "draft";

    const employeeId = Number(next.employee_id);
    const employeeRows = await query(
      "SELECT id, branch_id FROM employees WHERE tenant_id = ? AND id = ? AND delete_flg = 0 LIMIT 1",
      [tenantId, employeeId]
    );
    const employee = employeeRows[0];
    if (!employee) {
      throw new AppError("Employee not found", 404);
    }

    await query(`
      UPDATE payslips
      SET branch_id = ?, employee_id = ?, period_start = ?, period_end = ?, pay_date = ?,
          gross_pay = ?, overtime_pay = ?, total_deductions = ?, net_pay = ?,
          notes = ?, metadata = ?, status = ?, updated_ip = ?
      WHERE tenant_id = ? AND id = ?
    `, [
      employee.branch_id ?? null,
      employeeId,
      next.period_start,
      next.period_end,
      next.pay_date,
      grossPay,
      Number(next.overtime_pay ?? 0),
      Number(next.metadata.deductions),
      netPay,
      next.notes || null,
      JSON.stringify(next.metadata),
      next.status,
      ipAddress,
      tenantId,
      id
    ]);

    // --- Expense ledger sync ---
    if (becomingReleased) {
      // Only create if no expense record is already linked to this payslip
      const existingExpense = await query(
        "SELECT id FROM business_expenses WHERE tenant_id = ? AND payslip_id = ? AND delete_flg = 0 LIMIT 1",
        [tenantId, id]
      );
      if (!existingExpense.length) {
        const categoryRows = await query(
          "SELECT id FROM expense_categories WHERE tenant_id = ? AND name = 'Administrative Salaries' AND delete_flg = 0 AND status = 1 LIMIT 1",
          [tenantId]
        );
        const categoryId = categoryRows[0]?.id ?? null;

        if (categoryId) {
          await query(`
            INSERT INTO business_expenses (
              tenant_id, branch_id, category_id, payslip_id, amount, expense_date,
              description, payee, payment_method, status,
              created_by, created_ip, updated_ip
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'cash', 'paid', ?, ?, ?)
          `, [
            tenantId,
            employee.branch_id ?? null,
            categoryId,
            id,
            netPay,
            next.pay_date,
            `Salary — ${existing.payslip_number} (${formatShortDate(next.period_start)} to ${formatShortDate(next.period_end)})`,
            existing.employee_name || `Employee #${employeeId}`,
            userId,
            ipAddress,
            ipAddress
          ]);
        }
      }
    }

    if (becomingDraft) {
      // Soft-delete any linked expense when reverting to draft
      await query(
        "UPDATE business_expenses SET delete_flg = 1, updated_ip = ? WHERE tenant_id = ? AND payslip_id = ? AND delete_flg = 0",
        [ipAddress, tenantId, id]
      );
    }

    return await this.findById(tenantId, id);
  }

  async delete(tenantId, id, context = {}) {
    if (!tenantId) {
      throw new AppError("Tenant context is required", 400);
    }

    const existing = await this.findById(tenantId, id);
    if (!existing) {
      throw new AppError("Payslip not found", 404);
    }

    const ipAddress = context.ipAddress ?? null;
    await query("UPDATE payslips SET delete_flg = 1, updated_ip = ? WHERE tenant_id = ? AND id = ?", [ipAddress, tenantId, id]);
    return true;
  }
}
