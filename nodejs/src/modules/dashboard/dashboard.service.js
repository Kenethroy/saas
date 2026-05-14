import { DashboardRepository } from "./dashboard.repository.js";

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function toNumber(value) {
  return Number(value ?? 0) || 0;
}

function roundCurrency(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function formatDateOnly(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildMonthRange(year, month) {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0);

  return {
    start: formatDateOnly(start),
    end: formatDateOnly(end)
  };
}

function buildYearRange(year) {
  return {
    start: `${year}-01-01`,
    end: `${year}-12-31`
  };
}

function normalizePeriod(params = {}) {
  const now = new Date();

  return {
    year: Number(params.year ?? now.getFullYear()),
    month: Number(params.month ?? now.getMonth() + 1)
  };
}

function createAgentName(agent) {
  return [agent?.firstName, agent?.lastName].filter(Boolean).join(" ").trim() || "Unassigned";
}

function createAgentCode(agentId) {
  return agentId ? `AGT-${String(Number(agentId)).padStart(3, "0")}` : "UNASSIGNED";
}

function buildVariantLabel(productName, variantName) {
  return [productName, variantName].filter(Boolean).join(" ").trim() || "Variant";
}

function parseDateOnly(value) {
  const [year, month, day] = String(value).slice(0, 10).split("-").map(Number);
  return new Date(year, month - 1, day);
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

function sumBy(rows, selector) {
  return roundCurrency(rows.reduce((sum, row) => sum + toNumber(selector(row)), 0));
}

function isNotificationEnabled(settingsMap, key) {
  const rawValue = settingsMap.get(key);

  if (rawValue == null || rawValue === "") {
    return true;
  }

  return !["0", "false", "off", "disabled"].includes(String(rawValue).trim().toLowerCase());
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP"
  }).format(Number(value ?? 0));
}

function buildTrendRows(year, salesOrders, allocations) {
  const monthMap = new Map(
    MONTH_LABELS.map((label, index) => [
      index + 1,
      {
        key: `${year}-${String(index + 1).padStart(2, "0")}`,
        label,
        sales: 0,
        collections: 0
      }
    ])
  );

  for (const order of salesOrders) {
    const month = parseDateOnly(order.orderDate).getMonth() + 1;
    const entry = monthMap.get(month);
    if (!entry) continue;
    entry.sales += toNumber(order.totalAmount);
  }

  for (const allocation of allocations) {
    const paymentDate = allocation.payment?.paymentDate;
    if (!paymentDate) continue;
    const month = parseDateOnly(paymentDate).getMonth() + 1;
    const entry = monthMap.get(month);
    if (!entry) continue;
    entry.collections += toNumber(allocation.amountAllocated);
  }

  return Array.from(monthMap.values()).map((entry) => ({
    ...entry,
    sales: roundCurrency(entry.sales),
    collections: roundCurrency(entry.collections)
  }));
}

function buildCollectionAlert(openReceivables) {
  const today = new Date();

  const rows = openReceivables
    .map((record) => {
      const dueDate = record.dueDate ? parseDateOnly(record.dueDate) : null;
      const daysOverdue = dueDate ? Math.max(differenceInDays(dueDate, today), 0) : 0;
      const outstandingAmount = roundCurrency(record.outstandingAmount);

      return {
        id: Number(record.id),
        agentId: record.agentId ? Number(record.agentId) : null,
        agentName: createAgentName(record.agent),
        agentCode: createAgentCode(record.agentId),
        customerName: record.customer?.name ?? "Unknown",
        invoiceNumber: record.invoice?.invoiceNumber ?? (record.isOpeningBalance ? "Opening Balance" : "N/A"),
        salesOrderNumber: record.invoice?.salesOrder?.salesOrderNumber ?? null,
        dueDate: record.dueDate,
        outstandingAmount,
        daysOverdue,
        agingBucket: resolveAgingBucket(daysOverdue),
        priority: resolveQueuePriority(daysOverdue, outstandingAmount)
      };
    })
    .sort((left, right) => {
      const priorityWeight = { high: 3, medium: 2, normal: 1 };

      if (priorityWeight[right.priority] !== priorityWeight[left.priority]) {
        return priorityWeight[right.priority] - priorityWeight[left.priority];
      }

      if (right.daysOverdue !== left.daysOverdue) {
        return right.daysOverdue - left.daysOverdue;
      }

      return right.outstandingAmount - left.outstandingAmount;
    });

  const highPriorityRows = rows.filter((row) => row.priority === "high");

  return {
    totalOutstanding: roundCurrency(rows.reduce((sum, row) => sum + row.outstandingAmount, 0)),
    overdueCount: rows.filter((row) => row.daysOverdue > 0).length,
    highPriorityCount: highPriorityRows.length,
    rows: highPriorityRows
  };
}

function buildLowStockAlert(variants) {
  const rows = variants
    .map((variant) => {
      const onHand = Number(variant.stockQuantity ?? 0);
      const reorderLevel = Number(variant.reorderLevel ?? 0);
      const stockStatus = onHand <= 0 ? "out_of_stock" : onHand <= reorderLevel ? "low_stock" : "in_stock";

      return {
        id: Number(variant.id),
        productId: Number(variant.productId),
        productName: variant.product?.name ?? "Product",
        variantName: variant.name ?? "",
        label: buildVariantLabel(variant.product?.name, variant.name),
        onHand,
        reorderLevel,
        stockStatus
      };
    })
    .filter((variant) => variant.stockStatus !== "in_stock")
    .sort((left, right) => {
      const weight = { out_of_stock: 0, low_stock: 1 };

      if (weight[left.stockStatus] !== weight[right.stockStatus]) {
        return weight[left.stockStatus] - weight[right.stockStatus];
      }

      if (left.onHand !== right.onHand) {
        return left.onHand - right.onHand;
      }

      return left.label.localeCompare(right.label);
    });

  return {
    total: rows.length,
    outOfStock: rows.filter((row) => row.stockStatus === "out_of_stock").length,
    lowStock: rows.filter((row) => row.stockStatus === "low_stock").length,
    rows
  };
}

function buildNotificationsFeed({ collectionAlert, lowStockAlert, settings }) {
  const paymentAlertsEnabled = isNotificationEnabled(settings, "payment_alerts_enabled");
  const stockAlertsEnabled = isNotificationEnabled(settings, "stock_alerts_enabled");
  const items = [];

  if (paymentAlertsEnabled) {
    for (const row of collectionAlert.rows) {
      items.push({
        id: `collection-${row.id}`,
        type: "collection",
        severity: row.priority === "high" ? "critical" : "warning",
        label: "Receivable",
        title: row.customerName,
        message: `${row.invoiceNumber} is overdue by ${row.daysOverdue} day${row.daysOverdue === 1 ? "" : "s"} with ${formatCurrency(row.outstandingAmount)} still outstanding.`,
        href: "/accounts-receivable"
      });
    }
  }

  if (stockAlertsEnabled) {
    for (const row of lowStockAlert.rows) {
      items.push({
        id: `inventory-${row.id}`,
        type: "inventory",
        severity: row.stockStatus === "out_of_stock" ? "critical" : "warning",
        label: row.stockStatus === "out_of_stock" ? "Out of stock" : "Low stock",
        title: row.label,
        message: `${row.onHand} on hand against reorder level ${row.reorderLevel}.`,
        href: "/inventory"
      });
    }
  }

  const severityWeight = {
    critical: 0,
    warning: 1,
    info: 2
  };

  items.sort((left, right) => {
    const severityGap = (severityWeight[left.severity] ?? 99) - (severityWeight[right.severity] ?? 99);
    if (severityGap !== 0) {
      return severityGap;
    }

    return left.title.localeCompare(right.title);
  });

  return {
    generatedAt: new Date().toISOString(),
    totalCount: (paymentAlertsEnabled ? collectionAlert.highPriorityCount : 0) + (stockAlertsEnabled ? lowStockAlert.total : 0),
    categories: {
      collections: {
        enabled: paymentAlertsEnabled,
        count: paymentAlertsEnabled ? collectionAlert.highPriorityCount : 0
      },
      inventory: {
        enabled: stockAlertsEnabled,
        count: stockAlertsEnabled ? lowStockAlert.total : 0
      }
    },
    items
  };
}

function buildDueCalendar(year, month, openReceivables) {
  const today = new Date();
  const startsOn = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const dayMap = new Map();

  for (const receivable of openReceivables) {
    if (!receivable.dueDate) {
      continue;
    }

    const dueDate = parseDateOnly(receivable.dueDate);
    if (dueDate.getFullYear() !== year || dueDate.getMonth() + 1 !== month) {
      continue;
    }

    const day = dueDate.getDate();
    const daysOverdue = Math.max(differenceInDays(dueDate, today), 0);
    const outstandingAmount = roundCurrency(receivable.outstandingAmount);
    const item = {
      id: Number(receivable.id),
      customerName: receivable.customer?.name ?? "Unknown",
      agentName: createAgentName(receivable.agent),
      agentCode: createAgentCode(receivable.agentId),
      invoiceNumber: receivable.invoice?.invoiceNumber ?? (receivable.isOpeningBalance ? "Opening Balance" : "N/A"),
      salesOrderNumber: receivable.invoice?.salesOrder?.salesOrderNumber ?? null,
      outstandingAmount,
      daysOverdue,
      agingBucket: resolveAgingBucket(daysOverdue),
      priority: resolveQueuePriority(daysOverdue, outstandingAmount)
    };

    const entry = dayMap.get(day) ?? {
      date: formatDateOnly(dueDate),
      day,
      dueCount: 0,
      overdueCount: 0,
      totalOutstanding: 0,
      highPriorityCount: 0,
      items: []
    };

    entry.dueCount += 1;
    entry.totalOutstanding += outstandingAmount;
    if (daysOverdue > 0) {
      entry.overdueCount += 1;
    }
    if (item.priority === "high") {
      entry.highPriorityCount += 1;
    }
    entry.items.push(item);
    dayMap.set(day, entry);
  }

  const days = Array.from({ length: daysInMonth }, (_, index) => {
    const day = index + 1;
    const entry = dayMap.get(day);

    return entry
      ? {
          ...entry,
          totalOutstanding: roundCurrency(entry.totalOutstanding),
          items: entry.items.sort((left, right) => {
            const priorityWeight = { high: 3, medium: 2, normal: 1 };
            if (priorityWeight[right.priority] !== priorityWeight[left.priority]) {
              return priorityWeight[right.priority] - priorityWeight[left.priority];
            }
            if (right.daysOverdue !== left.daysOverdue) {
              return right.daysOverdue - left.daysOverdue;
            }
            return right.outstandingAmount - left.outstandingAmount;
          })
        }
      : {
          date: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
          day,
          dueCount: 0,
          overdueCount: 0,
          totalOutstanding: 0,
          highPriorityCount: 0,
          items: []
        };
  });

  return {
    startsOn,
    daysInMonth,
    summary: {
      daysWithDue: days.filter((entry) => entry.dueCount > 0).length,
      dueAccounts: days.reduce((sum, entry) => sum + entry.dueCount, 0),
      overdueAccounts: days.reduce((sum, entry) => sum + entry.overdueCount, 0),
      totalOutstanding: roundCurrency(days.reduce((sum, entry) => sum + entry.totalOutstanding, 0))
    },
    days
  };
}

function buildTopCustomers(salesOrders) {
  const map = new Map();

  for (const order of salesOrders) {
    const customerId = Number(order.customer?.id);
    const entry = map.get(customerId) ?? {
      customerId,
      customerName: order.customer?.name ?? "Unknown",
      totalSales: 0,
      orderCount: 0
    };

    entry.totalSales += toNumber(order.totalAmount);
    entry.orderCount += 1;
    map.set(customerId, entry);
  }

  return Array.from(map.values())
    .map((entry) => ({
      ...entry,
      totalSales: roundCurrency(entry.totalSales)
    }))
    .sort((left, right) => right.totalSales - left.totalSales)
    .slice(0, 5);
}

function buildTopProducts(salesOrders) {
  const map = new Map();

  for (const order of salesOrders) {
    for (const item of order.items ?? []) {
      const productId = Number(item.product?.id);
      if (!productId) continue;

      const entry = map.get(productId) ?? {
        productId,
        productName: item.product?.name ?? "Product",
        totalSales: 0,
        quantity: 0
      };

      entry.totalSales += toNumber(item.lineTotal);
      entry.quantity += toNumber(item.quantity);
      map.set(productId, entry);
    }
  }

  return Array.from(map.values())
    .map((entry) => ({
      ...entry,
      totalSales: roundCurrency(entry.totalSales)
    }))
    .sort((left, right) => right.totalSales - left.totalSales)
    .slice(0, 5);
}

function buildTopAgents(receivables) {
  const map = new Map();

  for (const record of receivables) {
    const agentId = Number(record.agentId);
    if (!agentId) continue;

    const entry = map.get(agentId) ?? {
      agentId,
      agentName: createAgentName(record.agent),
      agentCode: createAgentCode(record.agentId),
      totalSales: 0,
      totalCollected: 0,
      totalOutstanding: 0,
      customerIds: new Set()
    };

    entry.totalSales += toNumber(record.amount);
    entry.totalCollected += toNumber(record.paidAmount);
    entry.totalOutstanding += toNumber(record.outstandingAmount);
    entry.customerIds.add(Number(record.customerId));
    map.set(agentId, entry);
  }

  return Array.from(map.values())
    .map((entry) => ({
      agentId: entry.agentId,
      agentName: entry.agentName,
      agentCode: entry.agentCode,
      totalSales: roundCurrency(entry.totalSales),
      totalCollected: roundCurrency(entry.totalCollected),
      totalOutstanding: roundCurrency(entry.totalOutstanding),
      customerCount: entry.customerIds.size
    }))
    .sort((left, right) => right.totalSales - left.totalSales)
    .slice(0, 5);
}

export class DashboardService {
  constructor(repository = new DashboardRepository()) {
    this.repository = repository;
  }

  async getOverview(params = {}) {
    const { year, month } = normalizePeriod(params);

    const selectedRange = buildMonthRange(year, month);
    const trendRange = buildYearRange(year);

    const [
      salesOrders,
      purchaseOrders,
      expenses,
      paymentAllocations,
      salesOrdersForTrend,
      paymentAllocationsForTrend,
      openReceivables,
      inventoryVariants,
      agentReceivables
    ] = await Promise.all([
      this.repository.findSalesOrdersInRange(selectedRange.start, selectedRange.end),
      this.repository.findPurchaseOrdersInRange(selectedRange.start, selectedRange.end),
      this.repository.findExpensesInRange(selectedRange.start, selectedRange.end),
      this.repository.findPaymentAllocationsInRange(selectedRange.start, selectedRange.end),
      this.repository.findSalesOrdersInRange(trendRange.start, trendRange.end),
      this.repository.findPaymentAllocationsInRange(trendRange.start, trendRange.end),
      this.repository.findOpenReceivables(),
      this.repository.findInventoryVariants(),
      this.repository.findReceivablesInRange(selectedRange.start, selectedRange.end)
    ]);

    const lowStockAlert = buildLowStockAlert(inventoryVariants);
    const collectionAlert = buildCollectionAlert(openReceivables);

    return {
      period: {
        year,
        month,
        monthLabel: MONTH_LABELS[month - 1],
        range: selectedRange,
        trendRange
      },
      summary: {
        salesRevenue: sumBy(salesOrders, (row) => row.totalAmount),
        collections: sumBy(paymentAllocations, (row) => row.amountAllocated),
        outstandingReceivables: sumBy(openReceivables, (row) => row.outstandingAmount),
        purchaseSpend: sumBy(purchaseOrders, (row) => row.totalAmount),
        expenses: sumBy(expenses, (row) => row.amount),
        lowStockVariants: lowStockAlert.total
      },
      trends: {
        monthly: buildTrendRows(year, salesOrdersForTrend, paymentAllocationsForTrend)
      },
      alerts: {
        collections: collectionAlert,
        inventory: lowStockAlert
      },
      rankings: {
        topCustomers: buildTopCustomers(salesOrders),
        topProducts: buildTopProducts(salesOrders),
        topAgents: buildTopAgents(agentReceivables)
      }
    };
  }

  async getReceivablesCalendar(params = {}) {
    const { year, month } = normalizePeriod(params);
    const openReceivables = await this.repository.findOpenReceivables();

    return {
      period: {
        year,
        month,
        monthLabel: MONTH_LABELS[month - 1],
        range: buildMonthRange(year, month)
      },
      receivables: buildDueCalendar(year, month, openReceivables)
    };
  }

  async getNotifications() {
    const [openReceivables, inventoryVariants, settings] = await Promise.all([
      this.repository.findOpenReceivables(),
      this.repository.findInventoryVariants(),
      this.repository.findNotificationSettings()
    ]);

    const settingsMap = new Map(settings.map((item) => [item.key, item.value]));
    const lowStockAlert = buildLowStockAlert(inventoryVariants);
    const collectionAlert = buildCollectionAlert(openReceivables);

    return buildNotificationsFeed({
      collectionAlert,
      lowStockAlert,
      settings: settingsMap
    });
  }
}
