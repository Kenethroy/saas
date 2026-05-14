import { Router } from "express";
import { DeliveriesController } from "#modules/deliveries/deliveries.controller";
import {
  createDeliverySchema,
  deliveryParamsSchema,
  listDeliveriesSchema,
  updateDeliverySchema,
  updateDeliveryStatusSchema
} from "#modules/deliveries/deliveries.validator";
import { authenticate } from "#shared/middleware/auth.middleware";
import { resolveBranch } from "#shared/middleware/branch-context.middleware";
import { requirePermission } from "#shared/middleware/permission.middleware";
import { validateRequest } from "#shared/middleware/validate-request.middleware";

const router = Router();
const controller = new DeliveriesController();

router.get(
  "/selection-options",
  authenticate,
  resolveBranch,
  requirePermission("deliveries.view"),
  controller.selectionOptions
);

router.get(
  "/",
  authenticate,
  resolveBranch,
  requirePermission("deliveries.view"),
  validateRequest(listDeliveriesSchema, "query"),
  controller.list
);

router.get(
  "/:id",
  authenticate,
  resolveBranch,
  requirePermission("deliveries.view"),
  validateRequest(deliveryParamsSchema, "params"),
  controller.getById
);

router.get(
  "/:id/receipt/pdf",
  authenticate,
  resolveBranch,
  requirePermission("deliveries.view"),
  validateRequest(deliveryParamsSchema, "params"),
  controller.receiptPdf
);

router.post(
  "/create",
  authenticate,
  resolveBranch,
  requirePermission("deliveries.create"),
  validateRequest(createDeliverySchema),
  controller.create
);

router.patch(
  "/:id",
  authenticate,
  resolveBranch,
  requirePermission("deliveries.update"),
  validateRequest(deliveryParamsSchema, "params"),
  validateRequest(updateDeliverySchema),
  controller.update
);

router.patch(
  "/:id/status",
  authenticate,
  resolveBranch,
  requirePermission("deliveries.update"),
  validateRequest(deliveryParamsSchema, "params"),
  validateRequest(updateDeliveryStatusSchema),
  controller.updateStatus
);

export { router as deliveriesRoutes };
