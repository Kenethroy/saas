import { Router } from "express";
import { StockAdjustmentsController } from "#modules/stock-adjustments/stock-adjustments.controller";
import {
  createStockAdjustmentSchema,
  listStockAdjustmentsSchema,
  rejectStockAdjustmentSchema,
  stockAdjustmentParamsSchema,
  updateStockAdjustmentSchema
} from "#modules/stock-adjustments/stock-adjustments.validator";
import { authenticate } from "#shared/middleware/auth.middleware";
import { resolveBranch } from "#shared/middleware/branch-context.middleware";
import { requireAnyPermission, requirePermission } from "#shared/middleware/permission.middleware";
import { validateRequest } from "#shared/middleware/validate-request.middleware";

const router = Router();
const controller = new StockAdjustmentsController();

router.get(
  "/",
  authenticate,
  resolveBranch,
  requireAnyPermission(["view_stock_adjustments", "inventory.viewLogs"]),
  validateRequest(listStockAdjustmentsSchema, "query"),
  controller.list
);

router.get(
  "/:id",
  authenticate,
  resolveBranch,
  requireAnyPermission(["view_stock_adjustments", "inventory.viewLogs"]),
  validateRequest(stockAdjustmentParamsSchema, "params"),
  controller.getById
);

router.post(
  "/create",
  authenticate,
  resolveBranch,
  requireAnyPermission(["create_stock_adjustments", "inventory.adjust"]),
  validateRequest(createStockAdjustmentSchema),
  controller.create
);

router.patch(
  "/:id",
  authenticate,
  resolveBranch,
  requireAnyPermission(["edit_stock_adjustments", "inventory.adjust"]),
  validateRequest(stockAdjustmentParamsSchema, "params"),
  validateRequest(updateStockAdjustmentSchema),
  controller.update
);

router.patch(
  "/:id/submit",
  authenticate,
  resolveBranch,
  requireAnyPermission(["create_stock_adjustments", "inventory.adjust"]),
  validateRequest(stockAdjustmentParamsSchema, "params"),
  controller.submit
);

router.patch(
  "/:id/approve",
  authenticate,
  resolveBranch,
  requireAnyPermission(["approve_stock_adjustments", "inventory.adjust"]),
  validateRequest(stockAdjustmentParamsSchema, "params"),
  controller.approve
);

router.patch(
  "/:id/reject",
  authenticate,
  resolveBranch,
  requireAnyPermission(["approve_stock_adjustments", "inventory.adjust"]),
  validateRequest(stockAdjustmentParamsSchema, "params"),
  validateRequest(rejectStockAdjustmentSchema),
  controller.reject
);

router.delete(
  "/:id",
  authenticate,
  resolveBranch,
  requirePermission("delete_stock_adjustments"),
  validateRequest(stockAdjustmentParamsSchema, "params"),
  controller.delete
);

export { router as stockAdjustmentsRoutes };
