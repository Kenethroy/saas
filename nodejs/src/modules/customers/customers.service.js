import { AppError } from "#shared/utils/app-error";
import { CustomersRepository } from "#modules/customers/customers.repository";
import { createCustomerStatementPdf } from "#modules/customers/customer-statement-pdf";
import { PaymentsService } from "#modules/payments/payments.service";
import { ActivityLogsService } from "#modules/activity-logs/activity-logs.service";
import { logger } from "#shared/logger/index";
import { generatePdfFromTemplate, isPdfGeneratorConfigured } from "#shared/pdf/pdf-generator-client";
import { buildCustomerStatementPdfPayload } from "#shared/pdf/pdf-payload";

const SALES_ORDER_STATUS_CODES = {
  pending: 0,
  processing: 1,
  for_delivery: 2,
  delivered: 3,
  completed: 4,
  cancelled: 5
};

const SALES_ORDER_STATUS_LABELS = {
  pending: "Pending",
  processing: "Processing",
  for_delivery: "For Delivery",
  delivered: "Delivered",
  completed: "Completed",
  cancelled: "Cancelled"
};

function toNumber(value) {
  if (typeof value === "number") return value;
  if (typeof value?.toNumber === "function") return value.toNumber();
  return Number(value ?? 0);
}

function normalizeCustomer(record) {
  return {
    id: Number(record.id),
    name: record.name,
    email: record.email,
    phone: record.phone,
    company: record.company,
    address: record.address,
    paymentTermId: record.paymentTermId,
    paymentTerm: record.paymentTerm
      ? {
          id: record.paymentTerm.id,
          name: record.paymentTerm.name,
          days: record.paymentTerm.days
        }
      : null,
    status: record.status,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt
  };
}

function getMonthRange(monthOffset = 0) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const end = new Date(now.getFullYear(), now.getMonth() + monthOffset + 1, 1);
  return { start, end };
}

function getDateOnlyStart(value) {
  const date = value instanceof Date ? value : new Date(`${value}T00:00:00`);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function getDateOnlyEnd(value) {
  const date = value instanceof Date ? value : new Date(`${value}T23:59:59.999`);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function getDaysOverdue(dueDate, referenceDate = new Date()) {
  if (!dueDate) return 0;
  const due = new Date(dueDate);
  const today = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
  const target = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  return Math.max(0, Math.floor((today.getTime() - target.getTime()) / 86400000));
}

function buildAgingSummary(entries, referenceDate = new Date()) {
  return entries.reduce((summary, entry) => {
    const amount = toNumber(entry.outstandingAmount);
    const dueDate = entry.dueDate ? new Date(entry.dueDate) : null;

    if (!dueDate || dueDate >= referenceDate) {
      summary.current += amount;
      return summary;
    }

    const days = getDaysOverdue(dueDate, referenceDate);

    if (days <= 30) {
      summary.days_1_30 += amount;
    } else if (days <= 60) {
      summary.days_31_60 += amount;
    } else if (days <= 90) {
      summary.days_61_90 += amount;
    } else {
      summary.over_90 += amount;
    }

    return summary;
  }, {
    current: 0,
    days_1_30: 0,
    days_31_60: 0,
    days_61_90: 0,
    over_90: 0
  });
}

function buildStatementAging(entries, referenceDate = new Date()) {
  return entries.reduce((summary, entry) => {
    const amount = toNumber(entry.outstandingAmount);
    const dueDate = entry.dueDate ? new Date(entry.dueDate) : null;

    if (!dueDate || dueDate >= referenceDate) {
      summary.current += amount;
      summary.total += amount;
      return summary;
    }

    const days = getDaysOverdue(dueDate, referenceDate);

    if (days <= 30) {
      summary.days_1_30 += amount;
    } else if (days <= 60) {
      summary.days_31_60 += amount;
    } else if (days <= 90) {
      summary.days_61_90 += amount;
    } else {
      summary.over_90 += amount;
    }

    summary.total += amount;
    return summary;
  }, {
    current: 0,
    days_1_30: 0,
    days_31_60: 0,
    days_61_90: 0,
    over_90: 0,
    total: 0
  });
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2
  }).format(Number(value ?? 0));
}

function sanitizeFileNamePart(value) {
  return String(value ?? "customer")
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "customer";
}

function requireTenantId(tenantId) {
  const normalized = Number(tenantId);
  if (!normalized) {
    throw new AppError("Tenant context is required", 401);
  }
  return normalized;
}

function normalizeCustomerDetails(customer, statistics) {
  return {
    customer: {
      id: Number(customer.id),
      name: customer.name,
      company_name: customer.company,
      email: customer.email,
      phone: customer.phone,
      address: customer.address,
      status: customer.status ? 1 : 0,
      payment_terms: customer.paymentTerm?.name ?? null,
      credit_limit: null,
      created_at: customer.createdAt
    },
    statistics
  };
}

function normalizeCustomerOrder(order) {
  const receivable = order.invoice?.accountsReceivable ?? null;
  const daysOverdue = receivable?.dueDate ? getDaysOverdue(receivable.dueDate) : 0;

  return {
    id: Number(order.id),
    order_number: order.salesOrderNumber,
    date: order.orderDate,
    items_count: order._count?.items ?? 0,
    status: SALES_ORDER_STATUS_CODES[order.status] ?? null,
    status_label: SALES_ORDER_STATUS_LABELS[order.status] ?? order.status,
    total_amount: toNumber(order.totalAmount),
    invoice_number: order.invoice?.invoiceNumber ?? null,
    paid_amount: receivable ? toNumber(receivable.paidAmount) : null,
    balance: receivable ? toNumber(receivable.outstandingAmount) : null,
    payment_status: receivable?.status ?? null,
    due_date: receivable?.dueDate ?? null,
    is_overdue: daysOverdue > 0 && receivable?.status !== "paid",
    days_overdue: daysOverdue > 0 && receivable?.status !== "paid" ? daysOverdue : 0
  };
}

function normalizeUnpaidOrder(entry) {
  const daysOverdue = entry.dueDate ? getDaysOverdue(entry.dueDate) : 0;

  return {
    id: Number(entry.id),
    invoice_id: entry.invoiceId ? Number(entry.invoiceId) : null,
    invoice_number: entry.invoice?.invoiceNumber ?? null,
    order_number: entry.invoice?.salesOrder?.salesOrderNumber ?? null,
    invoice_date: entry.invoiceDate,
    due_date: entry.dueDate,
    amount: toNumber(entry.amount),
    outstanding_amount: toNumber(entry.outstandingAmount),
    paid_amount: toNumber(entry.paidAmount),
    is_opening_balance: Boolean(entry.isOpeningBalance),
    is_overdue: daysOverdue > 0 && entry.status !== "paid",
    days_overdue: daysOverdue > 0 && entry.status !== "paid" ? daysOverdue : 0,
    status: entry.status
  };
}

function normalizeCustomerReturn(record) {
  return {
    id: Number(record.id),
    return_number: record.rmaNumber,
    return_date: record.requestDate,
    reason: record.reason,
    total_amount: toNumber(record.totalAmount),
    status: record.status
  };
}

function buildPerformanceInsight(customer, statistics) {
  const lines = [];
  const companyOrName = customer.company_name || customer.company || customer.name;

  if (statistics.total_orders === 0) {
    return `${companyOrName} has no completed customer activity yet. The account is active, but there are no orders, receivables, or returns to analyze.`;
  }

  lines.push(
    `${companyOrName} has placed ${statistics.total_orders} order${statistics.total_orders === 1 ? "" : "s"} worth ${formatCurrency(statistics.total_spent)} in total.`
  );

  if (statistics.total_outstanding > 0) {
    lines.push(
      `Outstanding receivables are ${formatCurrency(statistics.total_outstanding)}, with ${statistics.overdue_orders_count} overdue item${statistics.overdue_orders_count === 1 ? "" : "s"} totaling ${formatCurrency(statistics.total_overdue)}.`
    );
  } else {
    lines.push("The account currently has no outstanding receivables.");
  }

  if (statistics.total_returns > 0) {
    lines.push(
      `Returns are at ${statistics.total_returns} transaction${statistics.total_returns === 1 ? "" : "s"} worth ${formatCurrency(statistics.total_return_amount)}, which is a ${statistics.return_rate_percent}% return rate against total orders.`
    );
  } else {
    lines.push("No completed customer returns have been recorded so far.");
  }

  if (statistics.orders_growth_percent > 0) {
    lines.push(`Order activity is up ${statistics.orders_growth_percent}% versus last month.`);
  } else if (statistics.orders_growth_percent < 0) {
    lines.push(`Order activity is down ${Math.abs(statistics.orders_growth_percent)}% versus last month.`);
  } else {
    lines.push("Order activity is flat versus last month.");
  }

  return lines.join(" ");
}

export class CustomersService {
  constructor(repository = new CustomersRepository(), paymentsService = new PaymentsService()) {
    this.repository = repository;
    this.paymentsService = paymentsService;
    this.activityLogs = new ActivityLogsService();
  }

  async requireCustomer(tenantId, id) {
    const customer = await this.repository.findById(requireTenantId(tenantId), id);
    if (!customer) throw new AppError("Customer not found", 404);
    return customer;
  }

  async list(tenantId, filters) {
    const scopedTenantId = requireTenantId(tenantId);
    const page = filters.page ?? 1;
    const perPage = filters.perPage ?? 10;

    const result = await this.repository.findPaginated(
      scopedTenantId,
      { search: filters.search, status: filters.status, hasReceivables: filters.hasReceivables },
      { page, perPage }
    );

    return {
      data: result.data.map(normalizeCustomer),
      meta: {
        currentPage: page,
        perPage,
        total: result.total,
        lastPage: Math.ceil(result.total / perPage) || 1
      }
    };
  }

  async getById(tenantId, id) {
    const customer = await this.requireCustomer(tenantId, id);
    return normalizeCustomer(customer);
  }

  async getDetails(tenantId, id) {
    const scopedTenantId = requireTenantId(tenantId);
    const customer = await this.requireCustomer(scopedTenantId, id);
    const now = new Date();
    const thisMonth = getMonthRange(0);
    const lastMonth = getMonthRange(-1);

    const [
      totalOrders,
      totalSpent,
      ordersThisMonth,
      ordersLastMonth,
      openReceivables,
      completedReturns,
      returnsThisMonth,
      returnsLastMonth
    ] = await Promise.all([
      this.repository.countOrders(scopedTenantId, id),
      this.repository.sumDeliveredAmount(scopedTenantId, id),
      this.repository.countOrdersInRange(scopedTenantId, id, thisMonth.start, thisMonth.end),
      this.repository.countOrdersInRange(scopedTenantId, id, lastMonth.start, lastMonth.end),
      this.repository.findOpenReceivables(scopedTenantId, id),
      this.repository.aggregateReturns(scopedTenantId, id),
      this.repository.aggregateReturns(scopedTenantId, id, thisMonth.start, thisMonth.end),
      this.repository.aggregateReturns(scopedTenantId, id, lastMonth.start, lastMonth.end)
    ]);

    const totalOutstanding = openReceivables.reduce((sum, entry) => sum + toNumber(entry.outstandingAmount), 0);
    const overdueEntries = openReceivables.filter((entry) => entry.dueDate && getDaysOverdue(entry.dueDate, now) > 0);
    const totalOverdue = overdueEntries.reduce((sum, entry) => sum + toNumber(entry.outstandingAmount), 0);
    const aging = buildAgingSummary(openReceivables, now);

    const ordersGrowthPercent = ordersLastMonth > 0 ? ((ordersThisMonth - ordersLastMonth) / ordersLastMonth) * 100 : 0;
    const returnsGrowthPercent = returnsLastMonth > 0 ? ((returnsThisMonth.count - returnsLastMonth.count) / returnsLastMonth.count) * 100 : 0;

    const customerCreatedAt = customer.createdAt ? new Date(customer.createdAt) : now;
    const memberSinceYear = customerCreatedAt.getFullYear();
    const memberYears = Math.max(0, now.getFullYear() - memberSinceYear);

    return normalizeCustomerDetails(customer, {
      total_orders: totalOrders,
      total_spent: toNumber(totalSpent),
      total_outstanding: totalOutstanding,
      total_overdue: totalOverdue,
      overdue_orders_count: overdueEntries.length,
      total_returns: completedReturns.count,
      total_return_amount: toNumber(completedReturns.total),
      returns_this_month: returnsThisMonth.count,
      returns_growth_percent: Number(returnsGrowthPercent.toFixed(2)),
      return_rate_percent: totalOrders > 0 ? Number(((completedReturns.count / totalOrders) * 100).toFixed(2)) : 0,
      member_since_year: memberSinceYear,
      member_years: memberYears,
      orders_this_month: ordersThisMonth,
      orders_growth_percent: Number(ordersGrowthPercent.toFixed(2)),
      aging: {
        current: aging.current,
        days_1_30: aging.days_1_30,
        days_31_60: aging.days_31_60,
        days_61_90: aging.days_61_90,
        over_90: aging.over_90
      }
    });
  }

  async getOrders(tenantId, id, filters = {}) {
    const scopedTenantId = requireTenantId(tenantId);
    await this.requireCustomer(scopedTenantId, id);
    const result = await this.repository.findCustomerOrders(scopedTenantId, id, filters, {
      page: filters.page ?? 1,
      limit: filters.limit ?? 10
    });

    return {
      orders: result.rows.map(normalizeCustomerOrder),
      pagination: {
        current_page: filters.page ?? 1,
        per_page: filters.limit ?? 10,
        total: result.total,
        total_pages: Math.ceil(result.total / (filters.limit ?? 10)) || 1
      }
    };
  }

  async getUnpaidOrders(tenantId, id) {
    const scopedTenantId = requireTenantId(tenantId);
    await this.requireCustomer(scopedTenantId, id);
    const rows = await this.repository.findUnpaidReceivables(scopedTenantId, id);
    const unpaidOrders = rows.map(normalizeUnpaidOrder);

    return {
      unpaid_orders: unpaidOrders,
      summary: {
        total_outstanding: unpaidOrders.reduce((sum, entry) => sum + entry.outstanding_amount, 0),
        total_overdue: unpaidOrders.filter((entry) => entry.is_overdue).reduce((sum, entry) => sum + entry.outstanding_amount, 0),
        overdue_orders_count: unpaidOrders.filter((entry) => entry.is_overdue).length
      }
    };
  }

  async getPayments(tenantId, id, filters = {}) {
    const scopedTenantId = requireTenantId(tenantId);
    await this.requireCustomer(scopedTenantId, id);
    if (!this.paymentsService) throw new AppError("Payments service not initialized", 500);
    return this.paymentsService.listCustomerPayments(id, {
      page: filters.page ?? 1,
      limit: filters.limit ?? 10
    }, {
      tenantId: scopedTenantId
    });
  }

  async getReturns(tenantId, id, filters = {}) {
    const scopedTenantId = requireTenantId(tenantId);
    await this.requireCustomer(scopedTenantId, id);
    const result = await this.repository.findCustomerReturns(scopedTenantId, id, filters, {
      page: filters.page ?? 1,
      limit: filters.limit ?? 10
    });

    return {
      returns: result.rows.map(normalizeCustomerReturn),
      pagination: {
        current_page: filters.page ?? 1,
        per_page: filters.limit ?? 10,
        total: result.total,
        total_pages: Math.ceil(result.total / (filters.limit ?? 10)) || 1
      }
    };
  }

  async getStatement(tenantId, id, filters = {}) {
    const scopedTenantId = requireTenantId(tenantId);
    const customer = await this.requireCustomer(scopedTenantId, id);
    const fromDate = filters.from ? getDateOnlyStart(filters.from) : getDateOnlyStart(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
    const toDate = filters.to ? getDateOnlyEnd(filters.to) : getDateOnlyEnd(new Date());

    if (fromDate > toDate) throw new AppError("The 'from' date must be earlier than or equal to the 'to' date", 422);

    const [
      invoiceDebits,
      paymentCredits,
      returnCredits,
      openingBalances,
      agingEntries
    ] = await Promise.all([
      this.repository.findInvoiceDebits(scopedTenantId, id, fromDate, toDate),
      this.repository.findPaymentCredits(scopedTenantId, id, fromDate, toDate),
      this.repository.findReturnCredits(scopedTenantId, id, fromDate, toDate),
      this.repository.aggregateOpeningBalances(scopedTenantId, id, fromDate),
      this.repository.findOpenReceivables(scopedTenantId, id)
    ]);

    const transactions = [
      ...invoiceDebits.map((entry) => ({
        date: entry.invoiceDate,
        dueDate: entry.dueDate,
        description: entry.isOpeningBalance ? "Opening Balance" : `Invoice #${entry.invoice?.invoiceNumber ?? entry.id}`,
        reference: entry.invoice?.invoiceNumber ?? (entry.isOpeningBalance ? "OPENING-BALANCE" : `AR-${entry.id}`),
        debit: toNumber(entry.amount),
        credit: 0,
        sortWeight: 1
      })),
      ...paymentCredits.map((entry) => ({
        date: entry.payment.paymentDate,
        dueDate: null,
        description: `Payment - ${entry.payment.paymentMethod.replaceAll("_", " ")}`,
        reference: entry.payment.paymentNumber,
        debit: 0,
        credit: toNumber(entry.amountAllocated),
        sortWeight: 2
      })),
      ...returnCredits.map((entry) => ({
        date: entry.customerReturn.updatedAt ?? entry.customerReturn.requestDate,
        dueDate: null,
        description: `Return - ${entry.customerReturn.reason}`,
        reference: entry.customerReturn.rmaNumber,
        debit: 0,
        credit: toNumber(entry.amountAllocated),
        sortWeight: 3
      }))
    ].sort((left, right) => {
      const timeDiff = new Date(left.date).getTime() - new Date(right.date).getTime();
      if (timeDiff !== 0) return timeDiff;
      return left.sortWeight - right.sortWeight;
    });

    let runningBalance = openingBalances.arTotal - openingBalances.payTotal - openingBalances.retTotal;

    const statementTransactions = transactions.map((entry) => {
      runningBalance += entry.debit - entry.credit;
      return { ...entry, balance: runningBalance };
    });

    return {
      customer: normalizeCustomer(customer),
      fromDate,
      toDate,
      openingBalance: openingBalances.arTotal - openingBalances.payTotal - openingBalances.retTotal,
      closingBalance: runningBalance,
      transactions: statementTransactions,
      aging: buildStatementAging(agingEntries, toDate)
    };
  }

  async createStatementPdfDocument(tenantId, id, filters = {}) {
    const statement = await this.getStatement(tenantId, id, filters);
    const safeName = sanitizeFileNamePart(statement.customer.company || statement.customer.name);
    const period = statement.toDate.toISOString().slice(0, 10);
    const fileName = `SOA-${safeName}-${period}.pdf`;

    if (isPdfGeneratorConfigured()) {
      const payload = buildCustomerStatementPdfPayload(statement.customer, statement);

      logger.info({ customerId: id, template: "customer.statement" }, "Generating customer statement PDF via PHP PDF API");

      return {
        fileName,
        document: await generatePdfFromTemplate({
          template: "customer.statement",
          filename: fileName,
          data: payload
        })
      };
    }

    logger.info({ customerId: id }, "Generating customer statement PDF via local PDFKit fallback");

    return {
      fileName,
      document: await createCustomerStatementPdf(statement.customer, statement)
    };
  }

  async getPerformanceInsight(tenantId, id) {
    const details = await this.getDetails(tenantId, id);
    return buildPerformanceInsight(details.customer, details.statistics);
  }

  async create(tenantId, payload, context = {}) {
    const scopedTenantId = requireTenantId(tenantId);
    const existingEmail = await this.repository.findByEmail(scopedTenantId, payload.email);
    if (existingEmail && !existingEmail.deleteFlag) throw new AppError("Customer email already exists", 409);

    if (payload.paymentTermId) {
      const paymentTerm = await this.repository.findPaymentTermById(scopedTenantId, payload.paymentTermId);
      if (!paymentTerm) throw new AppError("Payment term not found", 404);
    }

    const customerData = {
      tenantId: scopedTenantId,
      name: payload.name,
      email: payload.email ?? null,
      phone: payload.phone ?? null,
      company: payload.company ?? null,
      address: payload.address ?? null,
      paymentTermId: payload.paymentTermId ?? null,
      status: payload.status ?? true,
      createdIp: context.ipAddress ?? null,
      updatedIp: context.ipAddress ?? null
    };

    let openingBalanceData = null;
    if (payload.openingBalance > 0) {
      openingBalanceData = {
        amount: payload.openingBalance,
        outstandingAmount: payload.openingBalance,
        agentId: payload.agentId ? Number(payload.agentId) : null,
        invoiceDate: new Date(),
        createdIp: context.ipAddress ?? null,
        updatedIp: context.ipAddress ?? null
      };
    }

    const customer = await this.repository.createWithOpeningBalance(customerData, openingBalanceData);

    await this.activityLogs.log({
      userId: context.userId,
      action: 'CREATE',
      module: 'CUSTOMERS',
      description: `Created customer: ${customer.name}`,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: { entity_id: customer.id.toString(), entity_name: customer.name }
    });

    return normalizeCustomer(customer);
  }

  async update(tenantId, id, payload, context = {}) {
    const scopedTenantId = requireTenantId(tenantId);
    const existing = await this.requireCustomer(scopedTenantId, id);

    if (payload.email !== undefined) {
      const duplicateEmail = await this.repository.findByEmail(scopedTenantId, payload.email);
      if (duplicateEmail && Number(duplicateEmail.id) !== Number(id) && !duplicateEmail.deleteFlag) {
        throw new AppError("Customer email already exists", 409);
      }
    }

    if (payload.paymentTermId !== undefined && payload.paymentTermId !== null) {
      const paymentTerm = await this.repository.findPaymentTermById(scopedTenantId, payload.paymentTermId);
      if (!paymentTerm) throw new AppError("Payment term not found", 404);
    }

    const customer = await this.repository.update(scopedTenantId, id, {
      name: payload.name ?? existing.name,
      email: payload.email !== undefined ? payload.email : existing.email,
      phone: payload.phone !== undefined ? payload.phone : existing.phone,
      company: payload.company !== undefined ? payload.company : existing.company,
      address: payload.address !== undefined ? payload.address : existing.address,
      paymentTermId: payload.paymentTermId !== undefined ? payload.paymentTermId : existing.paymentTermId,
      status: payload.status ?? existing.status,
      updatedIp: context.ipAddress ?? null
    });

    await this.activityLogs.log({
      userId: context.userId,
      action: 'UPDATE',
      module: 'CUSTOMERS',
      description: `Updated customer profile: ${customer.name}`,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: { entity_id: id.toString(), entity_name: customer.name }
    });

    return normalizeCustomer(customer);
  }

  async delete(tenantId, id, context = {}) {
    const scopedTenantId = requireTenantId(tenantId);
    const existing = await this.requireCustomer(scopedTenantId, id);
    await this.repository.update(scopedTenantId, id, { deleteFlag: true, status: false, updatedIp: context.ipAddress ?? null });

    await this.activityLogs.log({
      userId: context.userId,
      action: 'DELETE',
      module: 'CUSTOMERS',
      description: `Archived customer: ${existing.name}`,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: { entity_id: id.toString(), entity_name: existing.name }
    });
  }
}
