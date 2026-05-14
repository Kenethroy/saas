import { successResponse } from "#shared/utils/response";
import { getPersistedRequestIp } from "#shared/utils/request-ip";
import { businessExpensesService } from "#modules/business-expenses/business-expenses.service";

export const businessExpensesController = {
  async listCategories(req, res, next) {
    try {
      const tenantId = req.auth?.user?.tenantId ?? null;
      const data = await businessExpensesService.listCategories(tenantId);
      res.status(200).json(successResponse({
        message: "Expense categories retrieved successfully",
        data
      }));
    } catch (error) {
      next(error);
    }
  },

  async listExpenses(req, res, next) {
    try {
      const tenantId = req.auth?.user?.tenantId ?? null;
      const result = await businessExpensesService.listExpenses(tenantId, req.query, {
        branchId: req.auth?.branch?.id ?? null
      });
      res.status(200).json(successResponse({
        message: "Business expenses retrieved successfully",
        data: result.data,
        meta: result.meta
      }));
    } catch (error) {
      next(error);
    }
  },

  async getExpenseById(req, res, next) {
    try {
      const tenantId = req.auth?.user?.tenantId ?? null;
      const data = await businessExpensesService.getExpenseById(tenantId, req.params.id);
      res.status(200).json(successResponse({
        message: "Business expense retrieved successfully",
        data
      }));
    } catch (error) {
      next(error);
    }
  },

  async createExpense(req, res, next) {
    try {
      const tenantId = req.auth?.user?.tenantId ?? null;
      const data = await businessExpensesService.createExpense(req.body, {
        tenantId,
        branchId: req.auth?.branch?.id ?? null,
        ipAddress: getPersistedRequestIp(req),
        userId: req.auth?.user?.id ?? null
      });
      res.status(201).json(successResponse({
        message: "Business expense created successfully",
        data
      }));
    } catch (error) {
      next(error);
    }
  },

  async updateExpense(req, res, next) {
    try {
      const tenantId = req.auth?.user?.tenantId ?? null;
      const data = await businessExpensesService.updateExpense(tenantId, req.params.id, req.body, {
        branchId: req.auth?.branch?.id ?? null,
        ipAddress: getPersistedRequestIp(req)
      });
      res.status(200).json(successResponse({
        message: "Business expense updated successfully",
        data
      }));
    } catch (error) {
      next(error);
    }
  },

  async deleteExpense(req, res, next) {
    try {
      const tenantId = req.auth?.user?.tenantId ?? null;
      await businessExpensesService.deleteExpense(tenantId, req.params.id, {
        ipAddress: getPersistedRequestIp(req)
      });
      res.status(200).json(successResponse({
        message: "Business expense deleted successfully"
      }));
    } catch (error) {
      next(error);
    }
  },

  async summary(req, res, next) {
    try {
      const tenantId = req.auth?.user?.tenantId ?? null;
      const data = await businessExpensesService.getSummary(tenantId, {
        branchId: req.auth?.branch?.id ?? null
      });
      res.status(200).json(successResponse({
        message: "Business expense summary retrieved successfully",
        data
      }));
    } catch (error) {
      next(error);
    }
  },

  async listRecurringExpenses(req, res, next) {
    try {
      const tenantId = req.auth?.user?.tenantId ?? null;
      const data = await businessExpensesService.listRecurringExpenses(tenantId, req.query);
      res.status(200).json(successResponse({
        message: "Recurring business expenses retrieved successfully",
        data
      }));
    } catch (error) {
      next(error);
    }
  },

  async getRecurringExpenseById(req, res, next) {
    try {
      const tenantId = req.auth?.user?.tenantId ?? null;
      const data = await businessExpensesService.getRecurringExpenseById(tenantId, req.params.id);
      res.status(200).json(successResponse({
        message: "Recurring business expense retrieved successfully",
        data
      }));
    } catch (error) {
      next(error);
    }
  },

  async createRecurringExpense(req, res, next) {
    try {
      const tenantId = req.auth?.user?.tenantId ?? null;
      const data = await businessExpensesService.createRecurringExpense(req.body, {
        tenantId,
        ipAddress: getPersistedRequestIp(req),
        userId: req.auth?.user?.id ?? null
      });
      res.status(201).json(successResponse({
        message: "Recurring business expense created successfully",
        data
      }));
    } catch (error) {
      next(error);
    }
  },

  async updateRecurringExpense(req, res, next) {
    try {
      const tenantId = req.auth?.user?.tenantId ?? null;
      const data = await businessExpensesService.updateRecurringExpense(tenantId, req.params.id, req.body, {
        ipAddress: getPersistedRequestIp(req)
      });
      res.status(200).json(successResponse({
        message: "Recurring business expense updated successfully",
        data
      }));
    } catch (error) {
      next(error);
    }
  },

  async deleteRecurringExpense(req, res, next) {
    try {
      const tenantId = req.auth?.user?.tenantId ?? null;
      await businessExpensesService.deleteRecurringExpense(tenantId, req.params.id, {
        ipAddress: getPersistedRequestIp(req)
      });
      res.status(200).json(successResponse({
        message: "Recurring business expense deleted successfully"
      }));
    } catch (error) {
      next(error);
    }
  }
};
