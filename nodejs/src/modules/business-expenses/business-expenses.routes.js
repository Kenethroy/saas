import { Router } from "express";
import { authenticate } from "#shared/middleware/auth.middleware";
import { requirePermission } from "#shared/middleware/permission.middleware";
import { validateRequest } from "#shared/middleware/validate-request.middleware";
import { businessExpensesController } from "#modules/business-expenses/business-expenses.controller";
import {
  businessExpenseParamsSchema,
  createBusinessExpenseSchema,
  createRecurringBusinessExpenseSchema,
  listBusinessExpensesSchema,
  listRecurringBusinessExpensesSchema,
  updateBusinessExpenseSchema,
  updateRecurringBusinessExpenseSchema
} from "#modules/business-expenses/business-expenses.validator";

const router = Router();

router.get(
  "/categories",
  authenticate,
  requirePermission("businessExpenses.view"),
  businessExpensesController.listCategories
);

router.get(
  "/summary",
  authenticate,
  requirePermission("businessExpenses.view"),
  businessExpensesController.summary
);

router.get(
  "/recurring",
  authenticate,
  requirePermission("businessExpenses.view"),
  validateRequest(listRecurringBusinessExpensesSchema, "query"),
  businessExpensesController.listRecurringExpenses
);

router.get(
  "/recurring/:id",
  authenticate,
  requirePermission("businessExpenses.view"),
  validateRequest(businessExpenseParamsSchema, "params"),
  businessExpensesController.getRecurringExpenseById
);

router.post(
  "/recurring/create",
  authenticate,
  requirePermission("businessExpenses.create"),
  validateRequest(createRecurringBusinessExpenseSchema, "body"),
  businessExpensesController.createRecurringExpense
);

router.patch(
  "/recurring/:id",
  authenticate,
  requirePermission("businessExpenses.update"),
  validateRequest(businessExpenseParamsSchema, "params"),
  validateRequest(updateRecurringBusinessExpenseSchema, "body"),
  businessExpensesController.updateRecurringExpense
);

router.delete(
  "/recurring/:id",
  authenticate,
  requirePermission("businessExpenses.delete"),
  validateRequest(businessExpenseParamsSchema, "params"),
  businessExpensesController.deleteRecurringExpense
);

router.get(
  "/",
  authenticate,
  requirePermission("businessExpenses.view"),
  validateRequest(listBusinessExpensesSchema, "query"),
  businessExpensesController.listExpenses
);

router.get(
  "/:id",
  authenticate,
  requirePermission("businessExpenses.view"),
  validateRequest(businessExpenseParamsSchema, "params"),
  businessExpensesController.getExpenseById
);

router.post(
  "/create",
  authenticate,
  requirePermission("businessExpenses.create"),
  validateRequest(createBusinessExpenseSchema, "body"),
  businessExpensesController.createExpense
);

router.patch(
  "/:id",
  authenticate,
  requirePermission("businessExpenses.update"),
  validateRequest(businessExpenseParamsSchema, "params"),
  validateRequest(updateBusinessExpenseSchema, "body"),
  businessExpensesController.updateExpense
);

router.delete(
  "/:id",
  authenticate,
  requirePermission("businessExpenses.delete"),
  validateRequest(businessExpenseParamsSchema, "params"),
  businessExpensesController.deleteExpense
);

export { router as businessExpensesRoutes };
