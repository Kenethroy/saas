import { ReportsRepository } from "#modules/reports/reports.repository";

const FAST_MOVING_THRESHOLD = 21;
const DEAD_STOCK_DAYS = 90;
const TOP_LIMIT = 10;
const DAY_MS = 24 * 60 * 60 * 1000;
const LOSS_REASON_KEYWORDS = ["lost", "damage", "damaged", "expired", "expiry", "theft", "shortage", "shrinkage"];

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

function addYears(date, years) {
  const next = new Date(date);
  next.setFullYear(next.getFullYear() + years);
  return next;
}

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

function getDateRange(period, startDate, endDate) {
  const today = new Date();

  switch (period) {
    case "custom":
      return {
        start: startDate ?? formatDateOnly(new Date(today.getFullYear(), today.getMonth(), 1)),
        end: endDate ?? formatDateOnly(today)
      };
    case "quarter": {
      const quarterIndex = Math.floor(today.getMonth() / 3);
      return {
        start: formatDateOnly(new Date(today.getFullYear(), quarterIndex * 3, 1)),
        end: formatDateOnly(today)
      };
    }
    case "year":
      return {
        start: formatDateOnly(new Date(today.getFullYear(), 0, 1)),
        end: formatDateOnly(today)
      };
    case "month":
    default:
      return {
        start: formatDateOnly(new Date(today.getFullYear(), today.getMonth(), 1)),
        end: formatDateOnly(today)
      };
  }
}

function getComparisonRange(start, end, compareWith) {
  if (compareWith === "none") {
    return null;
  }

  const startDate = parseDateOnly(start);
  const endDate = parseDateOnly(end);

  if (compareWith === "year_ago") {
    return {
      start: formatDateOnly(addYears(startDate, -1)),
      end: formatDateOnly(addYears(endDate, -1))
    };
  }

  const diffMs = endDate.getTime() - startDate.getTime();
  return {
    start: formatDateOnly(new Date(startDate.getTime() - diffMs - DAY_MS)),
    end: formatDateOnly(new Date(startDate.getTime() - DAY_MS))
  };
}

function summarizeSalesOrders(orders) {
  const totalRevenue = orders.reduce((sum, order) => sum + Number(order.totalAmount ?? 0), 0);
  return {
    totalRevenue: roundCurrency(totalRevenue),
    totalOrders: orders.length,
    avgOrderValue: roundCurrency(orders.length ? totalRevenue / orders.length : 0),
    activeCustomers: new Set(orders.map((order) => Number(order.customerId))).size
  };
}

function buildTopCustomers(orders) {
  const map = new Map();

  for (const order of orders) {
    const key = Number(order.customerId);
    const revenue = Number(order.totalAmount ?? 0);
    const entry = map.get(key) ?? {
      id: key,
      name: order.customer?.name ?? "Unknown",
      orders: 0,
      revenue: 0,
      avg_order: 0,
      last_order: null
    };

    entry.orders += 1;
    entry.revenue += revenue;

    const orderDate = order.orderDate ? formatDateOnly(new Date(order.orderDate)) : null;
    if (!entry.last_order || (orderDate && orderDate > entry.last_order)) {
      entry.last_order = orderDate;
    }

    map.set(key, entry);
  }

  return Array.from(map.values())
    .map((entry) => ({
      ...entry,
      revenue: roundCurrency(entry.revenue),
      avg_order: roundCurrency(entry.orders ? entry.revenue / entry.orders : 0)
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, TOP_LIMIT);
}

function aggregateProducts(orders) {
  const map = new Map();

  for (const order of orders) {
    for (const item of order.items ?? []) {
      const productId = Number(item.product?.id);
      if (!productId) {
        continue;
      }

      const entry = map.get(productId) ?? {
        id: productId,
        name: item.product?.name ?? "Unknown",
        category: item.product?.category?.name ?? "Uncategorized",
        units: 0,
        revenue: 0
      };

      entry.units += Number(item.quantity ?? 0);
      entry.revenue += Number(item.lineTotal ?? 0);
      map.set(productId, entry);
    }
  }

  return map;
}

function aggregateCategories(orders) {
  const map = new Map();

  for (const order of orders) {
    const seenCategories = new Set();

    for (const item of order.items ?? []) {
      const categoryName = item.product?.category?.name ?? "Uncategorized";
      const entry = map.get(categoryName) ?? {
        name: categoryName,
        orders: 0,
        units: 0,
        revenue: 0
      };

      entry.units += Number(item.quantity ?? 0);
      entry.revenue += Number(item.lineTotal ?? 0);

      if (!seenCategories.has(categoryName)) {
        entry.orders += 1;
        seenCategories.add(categoryName);
      }

      map.set(categoryName, entry);
    }
  }

  return map;
}

function buildTopProducts(orders, comparisonProducts, totalRevenue) {
  return Array.from(aggregateProducts(orders).values())
    .map((entry) => ({
      id: entry.id,
      name: entry.name,
      category: entry.category,
      units_sold: entry.units,
      revenue: roundCurrency(entry.revenue),
      percentage: totalRevenue > 0 ? roundPercentage((entry.revenue / totalRevenue) * 100) : 0,
      growth: calculateChange(entry.revenue, comparisonProducts.get(entry.id)?.revenue ?? 0)
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, TOP_LIMIT);
}

function buildCategoryBreakdown(orders, comparisonCategories, totalRevenue, orderKey, amountKey) {
  return Array.from(aggregateCategories(orders).values())
    .map((entry) => ({
      name: entry.name,
      [orderKey]: entry.orders,
      units: entry.units,
      [amountKey]: roundCurrency(entry.revenue),
      percentage: totalRevenue > 0 ? roundPercentage((entry.revenue / totalRevenue) * 100) : 0,
      growth: calculateChange(entry.revenue, comparisonCategories.get(entry.name)?.revenue ?? 0)
    }))
    .sort((a, b) => b[amountKey] - a[amountKey]);
}

function summarizePurchaseOrders(orders) {
  const totalSpending = orders.reduce((sum, order) => sum + Number(order.totalAmount ?? 0), 0);
  return {
    totalSpending: roundCurrency(totalSpending),
    totalPOs: orders.length,
    avgPOValue: roundCurrency(orders.length ? totalSpending / orders.length : 0),
    activeSuppliers: new Set(orders.map((order) => Number(order.supplierId))).size
  };
}

function buildTopSuppliers(orders) {
  const map = new Map();

  for (const order of orders) {
    const key = Number(order.supplierId);
    const spending = Number(order.totalAmount ?? 0);
    const entry = map.get(key) ?? {
      id: key,
      name: order.supplier?.name ?? "Unknown",
      pos: 0,
      spending: 0,
      avg_po: 0,
      last_order: null
    };

    entry.pos += 1;
    entry.spending += spending;

    const orderDate = order.orderDate ? formatDateOnly(new Date(order.orderDate)) : null;
    if (!entry.last_order || (orderDate && orderDate > entry.last_order)) {
      entry.last_order = orderDate;
    }

    map.set(key, entry);
  }

  return Array.from(map.values())
    .map((entry) => ({
      ...entry,
      spending: roundCurrency(entry.spending),
      avg_po: roundCurrency(entry.pos ? entry.spending / entry.pos : 0)
    }))
    .sort((a, b) => b.spending - a.spending)
    .slice(0, TOP_LIMIT);
}

function buildTopPurchasedProducts(orders, comparisonProducts, totalSpending) {
  return Array.from(aggregateProducts(orders).values())
    .map((entry) => ({
      id: entry.id,
      name: entry.name,
      category: entry.category,
      units_purchased: entry.units,
      cost: roundCurrency(entry.revenue),
      percentage: totalSpending > 0 ? roundPercentage((entry.revenue / totalSpending) * 100) : 0,
      growth: calculateChange(entry.revenue, comparisonProducts.get(entry.id)?.revenue ?? 0)
    }))
    .sort((a, b) => b.cost - a.cost)
    .slice(0, TOP_LIMIT);
}

function summarizeInvoices(invoices) {
  return invoices.reduce((summary, invoice) => {
    for (const item of invoice.items ?? []) {
      summary.grossRevenue += Number(item.lineTotal ?? 0);
      summary.grossCogs += Number(item.quantity ?? 0) * Number(item.unitCost ?? 0);
    }

    return summary;
  }, { grossRevenue: 0, grossCogs: 0 });
}

function summarizeReturns(returns) {
  return returns.reduce((summary, record) => {
    summary.returnValue += Number(record.totalAmount ?? 0);

    for (const item of record.items ?? []) {
      const amount = Number(item.quantity ?? 0) * Number(item.productVariant?.unitCost ?? 0);
      if (item.restockFlag) {
        summary.restockedCost += amount;
      } else {
        summary.damagedLoss += amount;
      }
    }

    return summary;
  }, { returnValue: 0, restockedCost: 0, damagedLoss: 0 });
}

function isLossReason(reason) {
  const normalized = String(reason ?? "").toLowerCase();
  return LOSS_REASON_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

function summarizeAdjustmentLosses(adjustments) {
  const breakdown = new Map();
  let total = 0;

  for (const adjustment of adjustments) {
    if (!isLossReason(adjustment.reason)) {
      continue;
    }

    const lossValue = (adjustment.items ?? []).reduce((sum, item) => {
      if (item.adjustType !== "subtract") {
        return sum;
      }

      return sum + Math.abs(Number(item.quantityChange ?? 0)) * Number(item.productVariant?.unitCost ?? 0);
    }, 0);

    if (!lossValue) {
      continue;
    }

    total += lossValue;

    const label = `Stock Adj: ${String(adjustment.reason ?? "Other")
      .split(" ")
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ")}`;

    breakdown.set(label, (breakdown.get(label) ?? 0) + lossValue);
  }

  return { total, breakdown };
}

function groupExpenses(expenses) {
  const grouped = new Map();

  for (const expense of expenses) {
    const categoryName = expense.parent_category_name ?? expense.category_name ?? "Uncategorized";
    grouped.set(categoryName, (grouped.get(categoryName) ?? 0) + Number(expense.amount ?? 0));
  }

  return grouped;
}

function mapComparisonBreakdown(currentMap, comparisonMap) {
  const keys = new Set([...currentMap.keys(), ...comparisonMap.keys()]);
  return Array.from(keys)
    .map((name) => ({
      name,
      amount: roundCurrency(currentMap.get(name) ?? 0),
      compareAmount: roundCurrency(comparisonMap.get(name) ?? 0)
    }))
    .sort((a, b) => b.amount - a.amount || b.compareAmount - a.compareAmount);
}

function daysSince(value) {
  if (!value) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.floor((Date.now() - new Date(value).getTime()) / DAY_MS);
}

export class ReportsService {
  constructor(repository = new ReportsRepository()) {
    this.repository = repository;
  }

  async getSalesSummary(tenantId, filters, context = {}) {
    const range = getDateRange(filters.period, filters.startDate, filters.endDate);
    const comparisonRange = getComparisonRange(range.start, range.end, filters.compareWith);

    const [orders, comparisonOrders, newCustomers] = await Promise.all([
      this.repository.findSalesOrdersInRange(tenantId, range.start, range.end, { branchId: context.branchId ?? null }),
      comparisonRange ? this.repository.findSalesOrdersInRange(tenantId, comparisonRange.start, comparisonRange.end, { branchId: context.branchId ?? null }) : Promise.resolve([]),
      this.repository.countNewCustomersInRange(tenantId, range.start, range.end)
    ]);

    const summary = summarizeSalesOrders(orders);
    const comparisonSummary = summarizeSalesOrders(comparisonOrders);
    const comparisonProducts = aggregateProducts(comparisonOrders);
    const comparisonCategories = aggregateCategories(comparisonOrders);

    return {
      summary: {
        totalRevenue: summary.totalRevenue,
        totalOrders: summary.totalOrders,
        avgOrderValue: summary.avgOrderValue,
        activeCustomers: summary.activeCustomers,
        newCustomers,
        revenueChange: comparisonRange ? calculateChange(summary.totalRevenue, comparisonSummary.totalRevenue) : 0,
        ordersChange: comparisonRange ? calculateChange(summary.totalOrders, comparisonSummary.totalOrders) : 0,
        avgChange: comparisonRange ? calculateChange(summary.avgOrderValue, comparisonSummary.avgOrderValue) : 0
      },
      topCustomers: buildTopCustomers(orders),
      topProducts: buildTopProducts(orders, comparisonProducts, summary.totalRevenue),
      salesByCategory: buildCategoryBreakdown(orders, comparisonCategories, summary.totalRevenue, "orders", "revenue")
    };
  }

  async getPurchaseSummary(tenantId, filters, context = {}) {
    const range = getDateRange(filters.period, filters.startDate, filters.endDate);
    const comparisonRange = getComparisonRange(range.start, range.end, filters.compareWith);

    const [orders, comparisonOrders, newSuppliers] = await Promise.all([
      this.repository.findPurchaseOrdersInRange(tenantId, range.start, range.end, { branchId: context.branchId ?? null }),
      comparisonRange ? this.repository.findPurchaseOrdersInRange(tenantId, comparisonRange.start, comparisonRange.end, { branchId: context.branchId ?? null }) : Promise.resolve([]),
      this.repository.countNewSuppliersInRange(tenantId, range.start, range.end)
    ]);

    const summary = summarizePurchaseOrders(orders);
    const comparisonSummary = summarizePurchaseOrders(comparisonOrders);
    const comparisonProducts = aggregateProducts(comparisonOrders);
    const comparisonCategories = aggregateCategories(comparisonOrders);

    return {
      summary: {
        totalSpending: summary.totalSpending,
        totalPOs: summary.totalPOs,
        avgPOValue: summary.avgPOValue,
        activeSuppliers: summary.activeSuppliers,
        newSuppliers,
        spendingChange: comparisonRange ? calculateChange(summary.totalSpending, comparisonSummary.totalSpending) : 0,
        poChange: comparisonRange ? calculateChange(summary.totalPOs, comparisonSummary.totalPOs) : 0,
        avgChange: comparisonRange ? calculateChange(summary.avgPOValue, comparisonSummary.avgPOValue) : 0
      },
      topSuppliers: buildTopSuppliers(orders),
      topPurchasedProducts: buildTopPurchasedProducts(orders, comparisonProducts, summary.totalSpending),
      purchaseByCategory: buildCategoryBreakdown(orders, comparisonCategories, summary.totalSpending, "pos", "cost")
    };
  }

  async getProfitLoss(tenantId, filters, context = {}) {
    const range = getDateRange(filters.period, filters.startDate, filters.endDate);
    const comparisonRange = getComparisonRange(range.start, range.end, filters.compareWith);

    const [
      invoices,
      returns,
      expenses,
      adjustments,
      comparisonInvoices,
      comparisonReturns,
      comparisonExpenses,
      comparisonAdjustments
    ] = await Promise.all([
      this.repository.findInvoicesInRange(tenantId, range.start, range.end, { branchId: context.branchId ?? null }),
      this.repository.findCustomerReturnsInRange(tenantId, range.start, range.end, { branchId: context.branchId ?? null }),
      this.repository.findExpensesInRange(tenantId, range.start, range.end, { branchId: context.branchId ?? null }),
      this.repository.findLossAdjustmentsInRange(tenantId, range.start, range.end, { branchId: context.branchId ?? null }),
      comparisonRange ? this.repository.findInvoicesInRange(tenantId, comparisonRange.start, comparisonRange.end, { branchId: context.branchId ?? null }) : Promise.resolve([]),
      comparisonRange ? this.repository.findCustomerReturnsInRange(tenantId, comparisonRange.start, comparisonRange.end, { branchId: context.branchId ?? null }) : Promise.resolve([]),
      comparisonRange ? this.repository.findExpensesInRange(tenantId, comparisonRange.start, comparisonRange.end, { branchId: context.branchId ?? null }) : Promise.resolve([]),
      comparisonRange ? this.repository.findLossAdjustmentsInRange(tenantId, comparisonRange.start, comparisonRange.end, { branchId: context.branchId ?? null }) : Promise.resolve([])
    ]);

    const invoiceSummary = summarizeInvoices(invoices);
    const returnSummary = summarizeReturns(returns);
    const adjustmentSummary = summarizeAdjustmentLosses(adjustments);
    const expenseGroups = groupExpenses(expenses);

    const comparisonInvoiceSummary = summarizeInvoices(comparisonInvoices);
    const comparisonReturnSummary = summarizeReturns(comparisonReturns);
    const comparisonAdjustmentSummary = summarizeAdjustmentLosses(comparisonAdjustments);
    const comparisonExpenseGroups = groupExpenses(comparisonExpenses);

    const revenue = invoiceSummary.grossRevenue - returnSummary.returnValue;
    const comparisonRevenue = comparisonInvoiceSummary.grossRevenue - comparisonReturnSummary.returnValue;

    const cogs = invoiceSummary.grossCogs - returnSummary.restockedCost;
    const comparisonCogs = comparisonInvoiceSummary.grossCogs - comparisonReturnSummary.restockedCost;

    const totalLosses = returnSummary.damagedLoss + adjustmentSummary.total;
    const comparisonTotalLosses = comparisonReturnSummary.damagedLoss + comparisonAdjustmentSummary.total;

    const totalExpenses = Array.from(expenseGroups.values()).reduce((sum, amount) => sum + amount, 0);
    const comparisonTotalExpenses = Array.from(comparisonExpenseGroups.values()).reduce((sum, amount) => sum + amount, 0);

    const grossProfit = revenue - cogs - totalLosses;
    const comparisonGrossProfit = comparisonRevenue - comparisonCogs - comparisonTotalLosses;

    const netIncome = grossProfit - totalExpenses;
    const comparisonNetIncome = comparisonGrossProfit - comparisonTotalExpenses;

    const lossCurrentMap = new Map(adjustmentSummary.breakdown);
    if (returnSummary.damagedLoss > 0) {
      lossCurrentMap.set("Damaged Returns", returnSummary.damagedLoss);
    }

    const lossComparisonMap = new Map(comparisonAdjustmentSummary.breakdown);
    if (comparisonReturnSummary.damagedLoss > 0) {
      lossComparisonMap.set("Damaged Returns", comparisonReturnSummary.damagedLoss);
    }

    return {
      revenue: [
        {
          id: 1,
          name: "Net Sales (Invoices - Returns)",
          amount: roundCurrency(revenue),
          compareAmount: roundCurrency(comparisonRevenue)
        }
      ],
      cogs: [
        {
          id: 1,
          name: "Cost of Goods Sold",
          amount: roundCurrency(cogs),
          compareAmount: roundCurrency(comparisonCogs)
        }
      ],
      losses: mapComparisonBreakdown(lossCurrentMap, lossComparisonMap),
      expenses: mapComparisonBreakdown(expenseGroups, comparisonExpenseGroups),
      summary: {
        gross_profit: roundCurrency(grossProfit),
        compare_gross_profit: roundCurrency(comparisonGrossProfit),
        total_losses: roundCurrency(totalLosses),
        compare_total_losses: roundCurrency(comparisonTotalLosses),
        total_expenses: roundCurrency(totalExpenses),
        compare_total_expenses: roundCurrency(comparisonTotalExpenses),
        net_income: roundCurrency(netIncome),
        compare_net_income: roundCurrency(comparisonNetIncome)
      }
    };
  }

  async getInventoryVelocity(tenantId, filters, context = {}) {
    const source = await this.repository.findInventoryVelocitySource(tenantId, filters.days, {
      branchId: context.branchId ?? null
    });
    const soldMap = new Map(source.soldInPeriod.map((entry) => [entry.productId, entry]));
    const lastSaleMap = new Map(source.historicalSales.map((entry) => [entry.productId, entry.orderDate]));

    const searchNeedle = filters.search?.toLowerCase() ?? null;
    const velocityNeedle = filters.velocity?.toLowerCase() ?? null;

    const allRows = source.products.map((product) => {
      const sold = soldMap.get(product.id);
      const unitsSold = sold?.quantity ?? 0;
      const revenue = sold?.revenue ?? 0;
      const lastSaleDate = lastSaleMap.get(product.id) ?? null;

      let velocity = "Slow Moving";
      if (unitsSold >= FAST_MOVING_THRESHOLD) {
        velocity = "Fast Moving";
      } else {
        const referenceDate = lastSaleDate ?? product.createdAt;
        if (daysSince(referenceDate) > DEAD_STOCK_DAYS) {
          velocity = "Dead Stock";
        }
      }

      return {
        id: product.id,
        name: product.name,
        category: product.category,
        current_stock: product.currentStock,
        units_sold_period: unitsSold,
        revenue_period: roundCurrency(revenue),
        last_sale_date: lastSaleDate ? formatDateOnly(new Date(lastSaleDate)) : null,
        velocity
      };
    }).filter((row) => {
      if (searchNeedle) {
        const searchable = `${row.name} ${row.category}`.toLowerCase();
        if (!searchable.includes(searchNeedle)) {
          return false;
        }
      }

      if (velocityNeedle && !row.velocity.toLowerCase().includes(velocityNeedle)) {
        return false;
      }

      return true;
    });

    allRows.sort((a, b) => (
      b.units_sold_period - a.units_sold_period ||
      b.current_stock - a.current_stock ||
      a.name.localeCompare(b.name)
    ));

    const total = allRows.length;
    const startIndex = (filters.page - 1) * filters.limit;
    const data = allRows.slice(startIndex, startIndex + filters.limit);

    const fastMoving = allRows.filter((row) => row.velocity === "Fast Moving").length;
    const slowMoving = allRows.filter((row) => row.velocity === "Slow Moving").length;
    const deadStock = allRows.filter((row) => row.velocity === "Dead Stock").length;

    return {
      data,
      pagination: {
        total,
        page: filters.page,
        limit: filters.limit,
        pages: Math.ceil(total / filters.limit) || 1
      },
      summary: {
        total_products: total,
        fast_moving: fastMoving,
        slow_moving: slowMoving,
        dead_stock: deadStock,
        fast_moving_percentage: total ? Math.round((fastMoving / total) * 100) : 0,
        slow_moving_percentage: total ? Math.round((slowMoving / total) * 100) : 0,
        dead_stock_percentage: total ? Math.round((deadStock / total) * 100) : 0
      }
    };
  }
}
