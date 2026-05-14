import { Router } from "express";
import { InventoryController } from "#modules/inventory/inventory.controller";
import { authenticate } from "#shared/middleware/auth.middleware";
import { requirePermission } from "#shared/middleware/permission.middleware";
import { validateRequest } from "#shared/middleware/validate-request.middleware";
import {
  applyStockAdjustmentSchema,
  listInventoryTransactionsSchema
} from "#modules/inventory/inventory.validator";

const router = Router();
const controller = new InventoryController();

router.get(
  "/transactions",
  authenticate,
  requirePermission("inventory.viewLogs"),
  validateRequest(listInventoryTransactionsSchema, "query"),
  controller.listTransactions
);

router.post(
  "/stock-adjustments/apply",
  authenticate,
  requirePermission("inventory.adjust"),
  validateRequest(applyStockAdjustmentSchema),
  controller.applyStockAdjustment
);

export { router as inventoryRoutes };
