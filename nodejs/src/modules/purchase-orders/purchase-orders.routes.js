import { Router } from "express";
import { purchaseOrdersController } from "#modules/purchase-orders/purchase-orders.controller";
import { authenticate } from "#shared/middleware/auth.middleware";
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
  requirePermission("purchaseOrders.view"),
  validateRequest(listPurchaseOrdersSchema, "query"),
  purchaseOrdersController.getPurchaseOrders
);

router.get(
  "/:id",
  authenticate,
  requirePermission("purchaseOrders.view"),
  validateRequest(purchaseOrderParamsSchema, "params"),
  purchaseOrdersController.getPurchaseOrder
);

router.get(
  "/:id/pdf",
  authenticate,
  requirePermission("purchaseOrders.view"),
  validateRequest(purchaseOrderParamsSchema, "params"),
  purchaseOrdersController.pdf
);

router.post(
  "/",
  authenticate,
  requirePermission("purchaseOrders.create"),
  validateRequest(createPurchaseOrderSchema, "body"),
  purchaseOrdersController.createPurchaseOrder
);

router.put(
  "/:id",
  authenticate,
  requirePermission("purchaseOrders.update"),
  validateRequest(purchaseOrderParamsSchema, "params"),
  validateRequest(updatePurchaseOrderSchema, "body"),
  purchaseOrdersController.updatePurchaseOrder
);

router.patch(
  "/:id/status",
  authenticate,
  requirePermission("purchaseOrders.update"),
  validateRequest(purchaseOrderParamsSchema, "params"),
  validateRequest(updatePurchaseOrderStatusSchema, "body"),
  purchaseOrdersController.updatePurchaseOrderStatus
);

router.post(
  "/:id/receive",
  authenticate,
  requirePermission("purchaseOrders.update"),
  validateRequest(purchaseOrderParamsSchema, "params"),
  validateRequest(receivePurchaseOrderSchema, "body"),
  purchaseOrdersController.receivePurchaseOrder
);

router.delete(
  "/:id",
  authenticate,
  requirePermission("purchaseOrders.delete"),
  validateRequest(purchaseOrderParamsSchema, "params"),
  purchaseOrdersController.deletePurchaseOrder
);

export { router as purchaseOrdersRoutes };
