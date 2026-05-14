import { Router } from "express";
import { purchaseOrdersController } from "#modules/purchase-orders/purchase-orders.controller";
import { authenticate } from "#shared/middleware/auth.middleware";
import { resolveBranch } from "#shared/middleware/branch-context.middleware";
import { requirePermission } from "#shared/middleware/permission.middleware";
import { validateRequest } from "#shared/middleware/validate-request.middleware";
import {
  listPurchaseOrdersSchema,
  createPurchaseOrderSchema,
  updatePurchaseOrderSchema,
  purchaseOrderParamsSchema,
  updatePurchaseOrderStatusSchema,
  receivePurchaseOrderSchema
} from "#modules/purchase-orders/purchase-orders.validator";

const router = Router();

router.get(
  "/",
  authenticate,
  resolveBranch,
  requirePermission("purchaseOrders.view"),
  validateRequest(listPurchaseOrdersSchema, "query"),
  purchaseOrdersController.getPurchaseOrders
);

router.get(
  "/:id",
  authenticate,
  resolveBranch,
  requirePermission("purchaseOrders.view"),
  validateRequest(purchaseOrderParamsSchema, "params"),
  purchaseOrdersController.getPurchaseOrder
);

router.get(
  "/:id/pdf",
  authenticate,
  resolveBranch,
  requirePermission("purchaseOrders.view"),
  validateRequest(purchaseOrderParamsSchema, "params"),
  purchaseOrdersController.pdf
);

router.post(
  "/",
  authenticate,
  resolveBranch,
  requirePermission("purchaseOrders.create"),
  validateRequest(createPurchaseOrderSchema, "body"),
  purchaseOrdersController.createPurchaseOrder
);

router.put(
  "/:id",
  authenticate,
  resolveBranch,
  requirePermission("purchaseOrders.update"),
  validateRequest(purchaseOrderParamsSchema, "params"),
  validateRequest(updatePurchaseOrderSchema, "body"),
  purchaseOrdersController.updatePurchaseOrder
);

router.patch(
  "/:id/status",
  authenticate,
  resolveBranch,
  requirePermission("purchaseOrders.update"),
  validateRequest(purchaseOrderParamsSchema, "params"),
  validateRequest(updatePurchaseOrderStatusSchema, "body"),
  purchaseOrdersController.updatePurchaseOrderStatus
);

router.post(
  "/:id/receive",
  authenticate,
  resolveBranch,
  requirePermission("purchaseOrders.update"),
  validateRequest(purchaseOrderParamsSchema, "params"),
  validateRequest(receivePurchaseOrderSchema, "body"),
  purchaseOrdersController.receivePurchaseOrder
);

router.delete(
  "/:id",
  authenticate,
  resolveBranch,
  requirePermission("purchaseOrders.delete"),
  validateRequest(purchaseOrderParamsSchema, "params"),
  purchaseOrdersController.deletePurchaseOrder
);

export { router as purchaseOrdersRoutes };
