import { AppError } from "#shared/utils/app-error";
import { businessExpensesRepository } from "#modules/business-expenses/business-expenses.repository";

function formatDateLocal(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfDay(value) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return formatDateLocal(date);
}

function endOfDay(value) {
  const date = new Date(value);
  date.setHours(23, 59, 59, 999);
  return formatDateLocal(date);
}

function getCurrentWeekRange() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const day = today.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const start = new Date(today);
  start.setDate(today.getDate() + diffToMonday);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);

  return {
    start: formatDateLocal(start),
    end: formatDateLocal(end)
  };
}

function getCurrentMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  return {
    start: formatDateLocal(start),
    end: formatDateLocal(end)
  };
}

function normalizeCategory(record) {
  return {
    id: record.id,
    parentId: record.parent_id,
    name: record.name,
    description: record.description,
    sortOrder: record.sort_order,
    status: record.status === 1,
    children: []
  };
}

function computeNextRunDate(payload, baseDate = new Date()) {
  if (!payload.isActive) {
    return null;
  }

  const anchor = new Date(baseDate);
  anchor.setHours(0, 0, 0, 0);

  switch (payload.frequency) {
    case "daily":
      return formatDateLocal(anchor);
    case "weekly": {
      const targetDay = Number(payload.dayOfWeek);
      const currentDay = anchor.getDay();
      let diff = targetDay - currentDay;
      if (diff < 0) diff += 7;
      const result = new Date(anchor);
      result.setDate(anchor.getDate() + diff);
      return formatDateLocal(result);
    }
    case "monthly": {
      const targetDay = Number(payload.dayOfMonth);
      const result = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
      const lastDay = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0).getDate();
      result.setDate(Math.min(targetDay, lastDay));

      if (result < anchor) {
        const nextMonth = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1);
        const nextMonthLastDay = new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0).getDate();
        nextMonth.setDate(Math.min(targetDay, nextMonthLastDay));
        return formatDateLocal(nextMonth);
      }

      return formatDateLocal(result);
    }
    case "annually": {
      const targetMonth = Number(payload.monthOfYear) - 1;
      const targetDay = Number(payload.dayOfMonth);
      const buildDate = (year) => {
        const result = new Date(year, targetMonth, 1);
        const lastDay = new Date(year, targetMonth + 1, 0).getDate();
        result.setDate(Math.min(targetDay, lastDay));
        return result;
      };

      const currentYearDate = buildDate(anchor.getFullYear());
      return formatDateLocal(currentYearDate < anchor ? buildDate(anchor.getFullYear() + 1) : currentYearDate);
    }
    default:
      return null;
  }
}

function normalizeRecurringPayload(payload) {
  return {
    categoryId: Number(payload.categoryId),
    amount: Number(payload.amount),
    description: payload.description ?? null,
    payee: payload.payee ?? null,
    paymentMethod: payload.paymentMethod,
    frequency: payload.frequency,
    dayOfMonth: payload.dayOfMonth ?? null,
    dayOfWeek: payload.dayOfWeek ?? null,
    monthOfYear: payload.monthOfYear ?? null,
    isActive: payload.isActive ?? true
  };
}

export const businessExpensesService = {
  async listCategories(filters = {}) {
    const categories = await businessExpensesRepository.findCategories(filters);
    const byId = new Map(categories.map((record) => [record.id, normalizeCategory(record)]));
    const roots = [];

    for (const category of byId.values()) {
      if (category.parentId && byId.has(category.parentId)) {
        byId.get(category.parentId).children.push(category);
      } else {
        roots.push(category);
      }
    }

    return roots;
  },

  async listExpenses(filters) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 15;
    const skip = (page - 1) * limit;

    const result = await businessExpensesRepository.listExpenses({
      search: filters.search,
      status: filters.status,
      categoryId: filters.categoryId,
      paymentMethod: filters.paymentMethod,
      dateFrom: filters.dateFrom ? startOfDay(filters.dateFrom) : undefined,
      dateTo: filters.dateTo ? endOfDay(filters.dateTo) : undefined,
      skip,
      take: limit
    });

    return {
      data: result.items,
      meta: {
        total: result.total,
        page,
        limit,
        totalPages: Math.ceil(result.total / limit) || 1
      }
    };
  },

  async getExpenseById(id) {
    const expense = await businessExpensesRepository.findExpenseById(id);
    if (!expense) {
      throw new AppError("Business expense not found", 404);
    }

    return expense;
  },

  async createExpense(payload, context = {}) {
    const category = await businessExpensesRepository.findCategoryById(payload.categoryId);
    if (!category) {
      throw new AppError("Expense category not found", 404);
    }

    return businessExpensesRepository.createExpense({
      categoryId: Number(payload.categoryId),
      amount: Number(payload.amount),
      expenseDate: payload.expenseDate,
      description: payload.description ?? null,
      payee: payload.payee ?? null,
      paymentMethod: payload.paymentMethod,
      referenceNumber: payload.referenceNumber ?? null,
      attachmentUrl: payload.attachmentUrl ?? null,
      status: payload.status,
      createdBy: context.userId ?? null,
      createdIp: context.ipAddress ?? null,
      updatedIp: context.ipAddress ?? null
    });
  },

  async updateExpense(id, payload, context = {}) {
    const existing = await businessExpensesRepository.findExpenseById(id);
    if (!existing) {
      throw new AppError("Business expense not found", 404);
    }

    if (payload.categoryId !== undefined) {
      const category = await businessExpensesRepository.findCategoryById(payload.categoryId);
      if (!category) {
        throw new AppError("Expense category not found", 404);
      }
    }

    return businessExpensesRepository.updateExpense(id, {
      ...(payload.categoryId !== undefined ? { categoryId: Number(payload.categoryId) } : {}),
      ...(payload.amount !== undefined ? { amount: Number(payload.amount) } : {}),
      ...(payload.expenseDate !== undefined ? { expenseDate: payload.expenseDate } : {}),
      ...(payload.description !== undefined ? { description: payload.description ?? null } : {}),
      ...(payload.payee !== undefined ? { payee: payload.payee ?? null } : {}),
      ...(payload.paymentMethod !== undefined ? { paymentMethod: payload.paymentMethod } : {}),
      ...(payload.referenceNumber !== undefined ? { referenceNumber: payload.referenceNumber ?? null } : {}),
      ...(payload.attachmentUrl !== undefined ? { attachmentUrl: payload.attachmentUrl ?? null } : {}),
      ...(payload.status !== undefined ? { status: payload.status } : {}),
      updatedIp: context.ipAddress ?? null
    });
  },

  async deleteExpense(id, context = {}) {
    const existing = await businessExpensesRepository.findExpenseById(id);
    if (!existing) {
      throw new AppError("Business expense not found", 404);
    }

    await businessExpensesRepository.updateExpense(id, {
      deleteFlag: true,
      updatedIp: context.ipAddress ?? null
    });
  },

  async getSummary() {
    const weekRange = getCurrentWeekRange();
    const monthRange = getCurrentMonthRange();
    return businessExpensesRepository.summarizeExpenses({
      weekStart: weekRange.start,
      weekEnd: weekRange.end,
      monthStart: monthRange.start,
      monthEnd: monthRange.end
    });
  },

  async listRecurringExpenses(filters = {}) {
    return businessExpensesRepository.listRecurringExpenses(filters);
  },

  async getRecurringExpenseById(id) {
    const recurring = await businessExpensesRepository.findRecurringExpenseById(id);
    if (!recurring) {
      throw new AppError("Recurring expense not found", 404);
    }

    return recurring;
  },

  async createRecurringExpense(payload, context = {}) {
    const category = await businessExpensesRepository.findCategoryById(payload.categoryId);
    if (!category) {
      throw new AppError("Expense category not found", 404);
    }

    const normalizedPayload = normalizeRecurringPayload(payload);
    return businessExpensesRepository.createRecurringExpense({
      ...normalizedPayload,
      nextRunDate: computeNextRunDate(normalizedPayload),
      createdBy: context.userId ?? null,
      createdIp: context.ipAddress ?? null,
      updatedIp: context.ipAddress ?? null
    });
  },

  async updateRecurringExpense(id, payload, context = {}) {
    const existing = await businessExpensesRepository.findRecurringExpenseById(id);
    if (!existing) {
      throw new AppError("Recurring expense not found", 404);
    }

    const mergedPayload = normalizeRecurringPayload({
      categoryId: payload.categoryId ?? existing.categoryId,
      amount: payload.amount ?? existing.amount,
      description: payload.description ?? existing.description,
      payee: payload.payee ?? existing.payee,
      paymentMethod: payload.paymentMethod ?? existing.paymentMethod,
      frequency: payload.frequency ?? existing.frequency,
      dayOfMonth: payload.dayOfMonth ?? existing.dayOfMonth,
      dayOfWeek: payload.dayOfWeek ?? existing.dayOfWeek,
      monthOfYear: payload.monthOfYear ?? existing.monthOfYear,
      isActive: payload.isActive ?? existing.isActive
    });

    const category = await businessExpensesRepository.findCategoryById(mergedPayload.categoryId);
    if (!category) {
      throw new AppError("Expense category not found", 404);
    }

    return businessExpensesRepository.updateRecurringExpense(id, {
      ...mergedPayload,
      nextRunDate: computeNextRunDate(mergedPayload),
      updatedIp: context.ipAddress ?? null
    });
  },

  async deleteRecurringExpense(id, context = {}) {
    const existing = await businessExpensesRepository.findRecurringExpenseById(id);
    if (!existing) {
      throw new AppError("Recurring expense not found", 404);
    }

    await businessExpensesRepository.updateRecurringExpense(id, {
      deleteFlag: true,
      isActive: false,
      nextRunDate: null,
      updatedIp: context.ipAddress ?? null
    });
  }
};
