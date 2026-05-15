import { AgentPerformanceRepository } from "#modules/agent-performance/agent-performance.repository";
import { AppError } from "#shared/utils/app-error";

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const NON_CASH_METHODS = new Set(["cheque", "bank_transfer", "credit_card"]);

function roundCurrency(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function roundPercentage(value) {
  return Math.round((Number(value) + Number.EPSILON) * 10) / 10;
}

function calculateChange(current, previous) {
  if (!previous) {
    return current > 0 ? 100 : 0;
  }

  return roundPercentage(((current - previous) / previous) * 100);
}

function parseDateOnly(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatDateOnly(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

function getCurrentQuarter() {
  return Math.floor(new Date().getMonth() / 3) + 1;
}

function resolvePeriodInput(params = {}) {
  const now = new Date();
  const period = params.period ?? "month";
  const year = Number(params.year ?? now.getFullYear());
  const month = period === "month"
    ? Number(params.month ?? (year === now.getFullYear() ? now.getMonth() + 1 : 1))
    : null;
  const quarter = period === "quarter"
    ? Number(params.quarter ?? (year === now.getFullYear() ? getCurrentQuarter() : 1))
    : null;

  return {
    period,
    year,
    month,
    quarter,
    search: params.search?.trim() || undefined,
    compareWith: params.compareWith ?? "previous"
  };
}

function buildDateRange({ period, year, month, quarter }) {
  if (period === "year") {
    return {
      start: `${year}-01-01`,
      end: `${year}-12-31`
    };
  }

  if (period === "quarter") {
    const quarterIndex = quarter - 1;
    const startMonth = quarterIndex * 3 + 1;
    const endMonth = startMonth + 2;
    return {
      start: `${year}-${String(startMonth).padStart(2, "0")}-01`,
      end: `${year}-${String(endMonth).padStart(2, "0")}-${String(daysInMonth(year, endMonth)).padStart(2, "0")}`
    };
  }

  return {
    start: `${year}-${String(month).padStart(2, "0")}-01`,
    end: `${year}-${String(month).padStart(2, "0")}-${String(daysInMonth(year, month)).padStart(2, "0")}`
  };
}

function buildComparisonInput(input) {
  const { period, year, month, quarter, compareWith } = input;

  if (compareWith === "none") {
    return null;
  }

  if (period === "year") {
    return {
      period: "year",
      year: year - 1,
      compareWith
    };
  }

  if (period === "quarter") {
    if (compareWith === "year_ago") {
      return {
        period,
        year: year - 1,
        quarter,
        compareWith
      };
    }

    if (quarter === 1) {
      return {
        period,
        year: year - 1,
        quarter: 4,
        compareWith
      };
    }

    return {
      period,
      year,
      quarter: quarter - 1,
      compareWith
    };
  }

  if (compareWith === "year_ago") {
    return {
      period,
      year: year - 1,
      month,
      compareWith
    };
  }

  if (month === 1) {
    return {
      period,
      year: year - 1,
      month: 12,
      compareWith
    };
  }

  return {
    period,
    year,
    month: month - 1,
    compareWith
  };
}

function createAgentName(agent) {
  return [agent?.firstName, agent?.lastName].filter(Boolean).join(" ").trim() || "Unknown Agent";
}

function createAgentCode(agentId) {
  return `AGT-${String(Number(agentId)).padStart(3, "0")}`;
}

function aggregateAgents(records) {
  const map = new Map();

  for (const record of records) {
    const agentId = Number(record.agentId);

    if (!agentId) {
      continue;
    }

    const entry = map.get(agentId) ?? {
      agentId,
      agentName: createAgentName(record.agent),
      agentCode: createAgentCode(agentId),
      totalRevenue: 0,
      totalCollected: 0,
      totalOutstanding: 0,
      orderCount: 0,
      customerIds: new Set()
    };

    entry.totalRevenue += Number(record.amount ?? 0);
    entry.totalCollected += Number(record.paidAmount ?? 0);
    entry.totalOutstanding += Number(record.outstandingAmount ?? 0);
    entry.orderCount += 1;
    entry.customerIds.add(Number(record.customerId));

    map.set(agentId, entry);
  }

  return map;
}

function buildSalesRanking(currentMap, previousMap) {
  return Array.from(currentMap.values())
    .map((entry) => {
      const previousRevenue = previousMap.get(entry.agentId)?.totalRevenue ?? 0;
      return {
        agentId: entry.agentId,
        agentName: entry.agentName,
        agentCode: entry.agentCode,
        totalRevenue: roundCurrency(entry.totalRevenue),
        previousRevenue: roundCurrency(previousRevenue),
        growth: calculateChange(entry.totalRevenue, previousRevenue),
        orderCount: entry.orderCount,
        customerCount: entry.customerIds.size
      };
    })
    .sort((a, b) => b.totalRevenue - a.totalRevenue);
}

function buildCollectionRanking(currentMap) {
  return Array.from(currentMap.values())
    .map((entry) => ({
      agentId: entry.agentId,
      agentName: entry.agentName,
      agentCode: entry.agentCode,
      totalSales: roundCurrency(entry.totalRevenue),
      totalCollected: roundCurrency(entry.totalCollected),
      totalOutstanding: roundCurrency(entry.totalOutstanding),
      collectionRate: entry.totalRevenue > 0 ? roundPercentage((entry.totalCollected / entry.totalRevenue) * 100) : 0,
      transactionCount: entry.orderCount,
      customerCount: entry.customerIds.size
    }))
    .sort((a, b) => b.totalCollected - a.totalCollected);
}

function summarizeSales(currentMap, previousMap) {
  const currentAgents = Array.from(currentMap.values());
  const previousAgents = Array.from(previousMap.values());
  const totalRevenue = currentAgents.reduce((sum, entry) => sum + entry.totalRevenue, 0);
  const previousRevenue = previousAgents.reduce((sum, entry) => sum + entry.totalRevenue, 0);
  const totalOrders = currentAgents.reduce((sum, entry) => sum + entry.orderCount, 0);
  const topPerformer = currentAgents.sort((a, b) => b.totalRevenue - a.totalRevenue)[0] ?? null;

  return {
    totalRevenue: roundCurrency(totalRevenue),
    previousRevenue: roundCurrency(previousRevenue),
    revenueChange: calculateChange(totalRevenue, previousRevenue),
    totalOrders,
    activeAgents: currentAgents.length,
    topPerformerName: topPerformer?.agentName ?? "N/A",
    topPerformerRevenue: roundCurrency(topPerformer?.totalRevenue ?? 0)
  };
}

function summarizeCollections(currentMap) {
  const currentAgents = Array.from(currentMap.values());
  const totalSales = currentAgents.reduce((sum, entry) => sum + entry.totalRevenue, 0);
  const totalCollected = currentAgents.reduce((sum, entry) => sum + entry.totalCollected, 0);
  const totalOutstanding = currentAgents.reduce((sum, entry) => sum + entry.totalOutstanding, 0);

  return {
    totalSales: roundCurrency(totalSales),
    totalCollected: roundCurrency(totalCollected),
    totalOutstanding: roundCurrency(totalOutstanding),
    collectionRate: totalSales > 0 ? roundPercentage((totalCollected / totalSales) * 100) : 0,
    agentsWithCollections: currentAgents.filter((entry) => entry.totalCollected > 0).length,
    totalTransactions: currentAgents.reduce((sum, entry) => sum + entry.orderCount, 0)
  };
}

function buildTrendBuckets(input) {
  if (input.period === "year") {
    return MONTH_NAMES.map((label, index) => ({
      key: String(index + 1),
      label
    }));
  }

  if (input.period === "quarter") {
    const startMonth = (input.quarter - 1) * 3;
    return Array.from({ length: 3 }, (_, index) => ({
      key: String(startMonth + index + 1),
      label: MONTH_NAMES[startMonth + index]
    }));
  }

  const totalDays = daysInMonth(input.year, input.month);
  return Array.from({ length: totalDays }, (_, index) => ({
    key: String(index + 1),
    label: String(index + 1)
  }));
}

function resolveBucketKey(date, input) {
  const current = typeof date === "string" ? parseDateOnly(date) : new Date(date);

  if (input.period === "year") {
    return String(current.getMonth() + 1);
  }

  if (input.period === "quarter") {
    return String(current.getMonth() + 1);
  }

  return String(current.getDate());
}

function buildSalesTrend(currentRecords, previousRecords, currentInput, comparisonInput) {
  const buckets = buildTrendBuckets(currentInput);
  const currentMap = new Map(buckets.map((bucket) => [bucket.key, 0]));
  const previousMap = new Map(buckets.map((bucket) => [bucket.key, 0]));

  for (const record of currentRecords) {
    const key = resolveBucketKey(record.invoiceDate, currentInput);
    currentMap.set(key, (currentMap.get(key) ?? 0) + Number(record.amount ?? 0));
  }

  if (comparisonInput) {
    for (const record of previousRecords) {
      const key = resolveBucketKey(record.invoiceDate, comparisonInput);
      previousMap.set(key, (previousMap.get(key) ?? 0) + Number(record.amount ?? 0));
    }
  }

  return buckets.map((bucket) => ({
    label: bucket.label,
    currentRevenue: roundCurrency(currentMap.get(bucket.key) ?? 0),
    previousRevenue: roundCurrency(previousMap.get(bucket.key) ?? 0)
  }));
}

function buildCollectionTrend(currentRecords, currentInput) {
  const buckets = buildTrendBuckets(currentInput);
  const totals = new Map(buckets.map((bucket) => [bucket.key, {
    sales: 0,
    collected: 0,
    outstanding: 0
  }]));

  for (const record of currentRecords) {
    const key = resolveBucketKey(record.invoiceDate, currentInput);
    const entry = totals.get(key) ?? { sales: 0, collected: 0, outstanding: 0 };
    entry.sales += Number(record.amount ?? 0);
    entry.collected += Number(record.paidAmount ?? 0);
    entry.outstanding += Number(record.outstandingAmount ?? 0);
    totals.set(key, entry);
  }

  return buckets.map((bucket) => {
    const entry = totals.get(bucket.key) ?? { sales: 0, collected: 0, outstanding: 0 };
    return {
      label: bucket.label,
      totalSales: roundCurrency(entry.sales),
      totalCollected: roundCurrency(entry.collected),
      totalOutstanding: roundCurrency(entry.outstanding)
    };
  });
}

function paginateRows(rows, page, limit) {
  const startIndex = (page - 1) * limit;
  return rows.slice(startIndex, startIndex + limit);
}

function buildRemittanceLedger(allocations = []) {
  const paymentMap = new Map();
  const dayMap = new Map();
  let totalCollected = 0;
  let cashCollections = 0;
  let nonCashCollections = 0;

  for (const allocation of allocations) {
    const payment = allocation.payment;
    if (!payment) {
      continue;
    }

    const paymentId = Number(payment.id);
    const amount = roundCurrency(allocation.amountAllocated);
    const paymentMethod = payment.paymentMethod ?? "other";
    const isNonCash = NON_CASH_METHODS.has(paymentMethod);
    const paymentDate = payment.paymentDate ? formatDateOnly(new Date(payment.paymentDate)) : "N/A";
    const paymentEntry = paymentMap.get(paymentId) ?? {
      paymentId,
      paymentNumber: payment.paymentNumber,
      paymentDate: payment.paymentDate,
      paymentMethod,
      referenceNumber: payment.referenceNumber,
      collectedAmount: 0,
      cashAmount: 0,
      nonCashAmount: 0,
      allocationCount: 0,
      customerIds: new Set(),
      customers: new Set()
    };

    paymentEntry.collectedAmount += amount;
    paymentEntry.allocationCount += 1;

    if (isNonCash) {
      paymentEntry.nonCashAmount += amount;
      nonCashCollections += amount;
    } else {
      paymentEntry.cashAmount += amount;
      cashCollections += amount;
    }

    const customerId = Number(allocation.accountsReceivable?.customer?.id);
    const customerName = allocation.accountsReceivable?.customer?.name;
    if (customerId) {
      paymentEntry.customerIds.add(customerId);
    }
    if (customerName) {
      paymentEntry.customers.add(customerName);
    }

    paymentMap.set(paymentId, paymentEntry);

    const dayEntry = dayMap.get(paymentDate) ?? {
      accountingPeriod: paymentDate,
      collected: 0,
      nonCashRecorded: 0,
      cashPendingRemittance: 0
    };
    dayEntry.collected += amount;
    if (isNonCash) {
      dayEntry.nonCashRecorded += amount;
    } else {
      dayEntry.cashPendingRemittance += amount;
    }
    dayMap.set(paymentDate, dayEntry);

    totalCollected += amount;
  }

  const rows = Array.from(paymentMap.values())
    .map((entry) => ({
      paymentId: entry.paymentId,
      paymentNumber: entry.paymentNumber,
      paymentDate: entry.paymentDate,
      paymentMethod: entry.paymentMethod,
      referenceNumber: entry.referenceNumber,
      collectedAmount: roundCurrency(entry.collectedAmount),
      cashAmount: roundCurrency(entry.cashAmount),
      nonCashAmount: roundCurrency(entry.nonCashAmount),
      remittanceGap: roundCurrency(entry.cashAmount),
      allocationCount: entry.allocationCount,
      customerCount: entry.customerIds.size,
      customerNames: Array.from(entry.customers),
      status: entry.cashAmount > 0 ? "pending_remittance" : "recorded_non_cash"
    }))
    .sort((a, b) => {
      const left = a.paymentDate ? new Date(a.paymentDate).getTime() : 0;
      const right = b.paymentDate ? new Date(b.paymentDate).getTime() : 0;
      if (right !== left) {
        return right - left;
      }
      return b.paymentId - a.paymentId;
    });

  const variance = Array.from(dayMap.values())
    .map((entry) => ({
      ...entry,
      collected: roundCurrency(entry.collected),
      nonCashRecorded: roundCurrency(entry.nonCashRecorded),
      cashPendingRemittance: roundCurrency(entry.cashPendingRemittance),
      variance: roundCurrency(entry.cashPendingRemittance)
    }))
    .sort((a, b) => {
      const left = a.accountingPeriod ? new Date(a.accountingPeriod).getTime() : 0;
      const right = b.accountingPeriod ? new Date(b.accountingPeriod).getTime() : 0;
      return right - left;
    });

  return {
    summary: {
      totalCollected: roundCurrency(totalCollected),
      nonCashRecorded: roundCurrency(nonCashCollections),
      cashPendingRemittance: roundCurrency(cashCollections),
      remittanceGap: roundCurrency(cashCollections),
      paymentCount: rows.length,
      totalAllocations: allocations.length
    },
    rows,
    variance
  };
}

function differenceInDays(from, to) {
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime();
  const end = new Date(to.getFullYear(), to.getMonth(), to.getDate()).getTime();
  return Math.floor((end - start) / (24 * 60 * 60 * 1000));
}

function resolveAgingBucket(daysOverdue) {
  if (daysOverdue <= 0) return "current";
  if (daysOverdue <= 30) return "1_30";
  if (daysOverdue <= 60) return "31_60";
  if (daysOverdue <= 90) return "61_90";
  return "over_90";
}

function resolveQueuePriority(daysOverdue, outstandingAmount) {
  if (daysOverdue > 90 || outstandingAmount >= 10000) return "high";
  if (daysOverdue > 30 || outstandingAmount >= 5000) return "medium";
  return "normal";
}

function buildCollectionQueue(records = [], { bucket = "all", page = 1, limit = 10 } = {}) {
  const today = new Date();
  const allRows = records
    .map((record) => {
      const dueDate = record.dueDate ? new Date(record.dueDate) : null;
      const daysOverdue = dueDate ? Math.max(differenceInDays(dueDate, today), 0) : 0;
      const bucketValue = resolveAgingBucket(daysOverdue);
      const outstandingAmount = roundCurrency(record.outstandingAmount);
      return {
        id: Number(record.id),
        agentId: record.agentId ? Number(record.agentId) : null,
        agentName: createAgentName(record.agent),
        agentCode: record.agentId ? createAgentCode(record.agentId) : "N/A",
        customerId: Number(record.customerId),
        customerName: record.customer?.name ?? "Unknown",
        invoiceId: record.invoiceId ? Number(record.invoiceId) : null,
        invoiceNumber: record.invoice?.invoiceNumber ?? (record.isOpeningBalance ? "Opening Balance" : "N/A"),
        salesOrderId: record.invoice?.salesOrder?.id ? Number(record.invoice.salesOrder.id) : null,
        salesOrderNumber: record.invoice?.salesOrder?.salesOrderNumber ?? null,
        invoiceDate: record.invoiceDate,
        dueDate: record.dueDate,
        amount: roundCurrency(record.amount),
        paidAmount: roundCurrency(record.paidAmount),
        outstandingAmount,
        status: record.status,
        daysOverdue,
        agingBucket: bucketValue,
        priority: resolveQueuePriority(daysOverdue, outstandingAmount),
        lastPaymentDate: record.lastPaymentDate ?? null,
        recommendedAction: daysOverdue > 0 ? "Follow up collection" : "Monitor until due"
      };
    })
    .sort((a, b) => {
      const priorityWeight = { high: 3, medium: 2, normal: 1 };
      if (priorityWeight[b.priority] !== priorityWeight[a.priority]) {
        return priorityWeight[b.priority] - priorityWeight[a.priority];
      }
      if (b.daysOverdue !== a.daysOverdue) {
        return b.daysOverdue - a.daysOverdue;
      }
      return b.outstandingAmount - a.outstandingAmount;
    });

  const rows = allRows.filter((row) => bucket === "all" || row.agingBucket === bucket);

  const pagedRows = paginateRows(rows, page, limit);
  const summary = {
    totalOutstanding: roundCurrency(rows.reduce((sum, row) => sum + row.outstandingAmount, 0)),
    accountsDueToday: rows.filter((row) => row.daysOverdue === 0).length,
    overdueAccounts: rows.filter((row) => row.daysOverdue > 0).length,
    highPriorityAccounts: rows.filter((row) => row.priority === "high").length,
    activeAgents: new Set(rows.map((row) => row.agentId).filter(Boolean)).size
  };

  const buckets = {
    current: allRows.filter((row) => row.agingBucket === "current").length,
    "1_30": allRows.filter((row) => row.agingBucket === "1_30").length,
    "31_60": allRows.filter((row) => row.agingBucket === "31_60").length,
    "61_90": allRows.filter((row) => row.agingBucket === "61_90").length,
    over_90: allRows.filter((row) => row.agingBucket === "over_90").length
  };

  return {
    summary,
    rows: pagedRows,
    buckets,
    pagination: {
      currentPage: page,
      perPage: limit,
      total: rows.length,
      lastPage: Math.ceil(rows.length / limit) || 1
    }
  };
}

function buildRemittanceReview(allocations = [], { page = 1, limit = 10 } = {}) {
  const byAgent = new Map();

  for (const allocation of allocations) {
    const agent = allocation.accountsReceivable?.agent;
    const agentId = Number(agent?.id);
    if (!agentId) continue;
    const amount = roundCurrency(allocation.amountAllocated);
    const paymentMethod = allocation.payment?.paymentMethod ?? "other";
    const isNonCash = NON_CASH_METHODS.has(paymentMethod);
    const paymentDate = allocation.payment?.paymentDate ?? null;

    const entry = byAgent.get(agentId) ?? {
      agentId,
      agentName: createAgentName(agent),
      agentCode: createAgentCode(agentId),
      totalCollected: 0,
      nonCashRecorded: 0,
      cashPendingRemittance: 0,
      remittanceGap: 0,
      allocationCount: 0,
      paymentIds: new Set(),
      customerIds: new Set(),
      latestPaymentDate: null
    };

    entry.totalCollected += amount;
    entry.allocationCount += 1;
    entry.paymentIds.add(Number(allocation.payment?.id));
    entry.customerIds.add(Number(allocation.accountsReceivable?.customer?.id));

    if (isNonCash) {
      entry.nonCashRecorded += amount;
    } else {
      entry.cashPendingRemittance += amount;
      entry.remittanceGap += amount;
    }

    if (!entry.latestPaymentDate || (paymentDate && new Date(paymentDate) > new Date(entry.latestPaymentDate))) {
      entry.latestPaymentDate = paymentDate;
    }

    byAgent.set(agentId, entry);
  }

  const rows = Array.from(byAgent.values())
    .map((entry) => ({
      agentId: entry.agentId,
      agentName: entry.agentName,
      agentCode: entry.agentCode,
      totalCollected: roundCurrency(entry.totalCollected),
      nonCashRecorded: roundCurrency(entry.nonCashRecorded),
      cashPendingRemittance: roundCurrency(entry.cashPendingRemittance),
      remittanceGap: roundCurrency(entry.remittanceGap),
      paymentCount: entry.paymentIds.size,
      customerCount: entry.customerIds.size,
      allocationCount: entry.allocationCount,
      latestPaymentDate: entry.latestPaymentDate,
      status: entry.remittanceGap > 0 ? "needs_review" : "recorded"
    }))
    .sort((a, b) => {
      if (b.remittanceGap !== a.remittanceGap) return b.remittanceGap - a.remittanceGap;
      return b.totalCollected - a.totalCollected;
    });

  const pagedRows = paginateRows(rows, page, limit);
  return {
    summary: {
      totalCollected: roundCurrency(rows.reduce((sum, row) => sum + row.totalCollected, 0)),
      nonCashRecorded: roundCurrency(rows.reduce((sum, row) => sum + row.nonCashRecorded, 0)),
      cashPendingRemittance: roundCurrency(rows.reduce((sum, row) => sum + row.cashPendingRemittance, 0)),
      remittanceGap: roundCurrency(rows.reduce((sum, row) => sum + row.remittanceGap, 0)),
      agentsInScope: rows.length
    },
    rows: pagedRows,
    pagination: {
      currentPage: page,
      perPage: limit,
      total: rows.length,
      lastPage: Math.ceil(rows.length / limit) || 1
    }
  };
}

export class AgentPerformanceService {
  constructor(repository = new AgentPerformanceRepository()) {
    this.repository = repository;
  }

  requireTenantId(tenantId) {
    const normalized = Number(tenantId);
    if (!normalized) {
      throw new AppError("Tenant context is required", 401);
    }
    return normalized;
  }

  async getSales(tenantId, params = {}) {
    const scopedTenantId = this.requireTenantId(tenantId);
    const input = resolvePeriodInput(params);
    const range = buildDateRange(input);
    const comparisonInput = buildComparisonInput(input);
    const comparisonRange = comparisonInput ? buildDateRange(comparisonInput) : null;

    const [currentRecords, previousRecords] = await Promise.all([
      this.repository.findReceivablesInRange(scopedTenantId, { ...range, search: input.search }),
      comparisonRange
        ? this.repository.findReceivablesInRange(scopedTenantId, { ...comparisonRange, search: input.search })
        : Promise.resolve([])
    ]);

    const currentMap = aggregateAgents(currentRecords);
    const previousMap = aggregateAgents(previousRecords);

    return {
      range,
      comparisonRange,
      summary: summarizeSales(currentMap, previousMap),
      ranking: buildSalesRanking(currentMap, previousMap)
    };
  }

  async getSalesTrend(tenantId, params = {}) {
    const scopedTenantId = this.requireTenantId(tenantId);
    const input = resolvePeriodInput(params);
    const range = buildDateRange(input);
    const comparisonInput = buildComparisonInput(input);
    const comparisonRange = comparisonInput ? buildDateRange(comparisonInput) : null;

    const [currentRecords, previousRecords] = await Promise.all([
      this.repository.findReceivablesInRange(scopedTenantId, { ...range, search: input.search }),
      comparisonRange
        ? this.repository.findReceivablesInRange(scopedTenantId, { ...comparisonRange, search: input.search })
        : Promise.resolve([])
    ]);

    return {
      range,
      comparisonRange,
      points: buildSalesTrend(currentRecords, previousRecords, input, comparisonInput)
    };
  }

  async getCollections(tenantId, params = {}) {
    const scopedTenantId = this.requireTenantId(tenantId);
    const input = resolvePeriodInput(params);
    const range = buildDateRange(input);
    const currentRecords = await this.repository.findReceivablesInRange(scopedTenantId, { ...range, search: input.search });
    const currentMap = aggregateAgents(currentRecords);

    return {
      range,
      summary: summarizeCollections(currentMap),
      ranking: buildCollectionRanking(currentMap)
    };
  }

  async getCollectionsTrend(tenantId, params = {}) {
    const scopedTenantId = this.requireTenantId(tenantId);
    const input = resolvePeriodInput(params);
    const range = buildDateRange(input);
    const currentRecords = await this.repository.findReceivablesInRange(scopedTenantId, { ...range, search: input.search });

    return {
      range,
      points: buildCollectionTrend(currentRecords, input)
    };
  }

  async getAgentProfile(tenantId, agentId) {
    const agent = await this.repository.findAgentProfile(this.requireTenantId(tenantId), agentId);

    if (!agent) {
      const error = new Error("Agent not found");
      error.statusCode = 404;
      throw error;
    }

    return {
      id: Number(agent.id),
      firstName: agent.firstName,
      lastName: agent.lastName,
      fullName: createAgentName(agent),
      position: agent.position,
      phone: agent.phone,
      email: agent.email,
      status: agent.status,
      dateHired: agent.dateHired,
      agentCode: createAgentCode(agent.id)
    };
  }

  async getAgentSalesHistory(tenantId, agentId, params = {}) {
    const page = Number(params.page ?? 1);
    const limit = Number(params.limit ?? 10);
    const result = await this.repository.findAgentSalesHistory(this.requireTenantId(tenantId), agentId, {
      page,
      limit,
      search: params.search,
      status: params.status
    });

    return {
      summary: {
        ...result.summary,
        totalSales: roundCurrency(result.summary.totalSales)
      },
      rows: result.rows.map((row) => ({
        id: Number(row.id),
        salesOrderNumber: row.salesOrderNumber,
        orderDate: row.orderDate,
        status: row.status,
        totalAmount: roundCurrency(row.totalAmount),
        itemCount: row.itemCount,
        customer: row.customer,
        invoice: row.invoice
      })),
      pagination: {
        currentPage: page,
        perPage: limit,
        total: result.total,
        lastPage: Math.ceil(result.total / limit) || 1
      }
    };
  }

  async getAgentCollectionHistory(tenantId, agentId, params = {}) {
    const page = Number(params.page ?? 1);
    const limit = Number(params.limit ?? 10);
    const result = await this.repository.findAgentCollectionHistory(this.requireTenantId(tenantId), agentId, {
      page,
      limit,
      search: params.search
    });

    return {
      summary: {
        ...result.summary,
        totalCollected: roundCurrency(result.summary.totalCollected)
      },
      rows: result.rows.map((row) => ({
        id: Number(row.id),
        allocatedAmount: roundCurrency(row.allocatedAmount),
        payment: row.payment,
        customer: row.customer,
        invoice: row.invoice,
        salesOrder: row.salesOrder,
        receivable: {
          ...row.receivable,
          amount: roundCurrency(row.receivable.amount),
          paidAmount: roundCurrency(row.receivable.paidAmount),
          outstandingAmount: roundCurrency(row.receivable.outstandingAmount)
        }
      })),
      pagination: {
        currentPage: page,
        perPage: limit,
        total: result.total,
        lastPage: Math.ceil(result.total / limit) || 1
      }
    };
  }

  async getAgentRemittanceLedger(tenantId, agentId, params = {}) {
    const page = Number(params.page ?? 1);
    const limit = Number(params.limit ?? 10);
    const allocations = await this.repository.findAgentRemittanceAllocations(this.requireTenantId(tenantId), agentId, {
      search: params.search
    });
    const ledger = buildRemittanceLedger(allocations);
    const pagedRows = paginateRows(ledger.rows, page, limit);

    return {
      summary: ledger.summary,
      rows: pagedRows,
      variance: ledger.variance,
      assumptions: {
        cashPaymentsPendingRemittance: true,
        nonCashMethodsRecorded: Array.from(NON_CASH_METHODS)
      },
      pagination: {
        currentPage: page,
        perPage: limit,
        total: ledger.rows.length,
        lastPage: Math.ceil(ledger.rows.length / limit) || 1
      }
    };
  }

  async getCollectionQueue(tenantId, params = {}) {
    const page = Number(params.page ?? 1);
    const limit = Number(params.limit ?? 10);
    const records = await this.repository.findCollectionQueueRecords(this.requireTenantId(tenantId), {
      search: params.search,
      agentId: params.agentId
    });

    return buildCollectionQueue(records, {
      bucket: params.bucket ?? "all",
      page,
      limit
    });
  }

  async getRemittanceReview(tenantId, params = {}) {
    const page = Number(params.page ?? 1);
    const limit = Number(params.limit ?? 10);
    const allocations = await this.repository.findRemittanceReviewAllocations(this.requireTenantId(tenantId), {
      search: params.search
    });

    return buildRemittanceReview(allocations, { page, limit });
  }
}
