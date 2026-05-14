import { Router } from "express";
import { SalesOrdersController } from "#modules/sales-orders/sales-orders.controller";
import {
  createSalesOrderSchema,
  listSalesOrdersSchema,
  salesOrderParamsSchema,
  updateSalesOrderSchema,
  updateSalesOrderStatusSchema
} from "#modules/sales-orders/sales-orders.validator";
import { authenticate } from "#shared/middleware/auth.middleware";
import { requirePermission } from "#shared/middleware/permission.middleware";
import { validateRequest } from "#shared/middleware/validate-request.middleware";

const router = Router();
const controller = new SalesOrdersController();

router.get(
  "/for-delivery-selection",
  authenticate,
  requirePermission("salesOrders.view"),
  controller.listForDeliverySelection
);

router.get(
  "/",
  authenticate,
  requirePermission("salesOrders.view"),
  validateRequest(listSalesOrdersSchema, "query"),
  controller.list
);

router.get(
  "/:id",
  authenticate,
  requirePermission("salesOrders.view"),
  validateRequest(salesOrderParamsSchema, "params"),
  controller.getById
);

router.get(
  "/:id/invoice/pdf",
  authenticate,
  requirePermission("salesOrders.view"),
  validateRequest(salesOrderParamsSchema, "params"),
  controller.invoicePdf
);

router.patch(
  "/:id",
  authenticate,
  requirePermission("salesOrders.update"),
  validateRequest(salesOrderParamsSchema, "params"),
  validateRequest(updateSalesOrderSchema),
  controller.update
);

router.patch(
  "/:id/status",
  authenticate,
  requirePermission("salesOrders.update"),
  validateRequest(salesOrderParamsSchema, "params"),
  validateRequest(updateSalesOrderStatusSchema),
  controller.updateStatus
);

router.post(
  "/create",
  authenticate,
  requirePermission("salesOrders.create"),
  validateRequest(createSalesOrderSchema),
  controller.create
);

export { router as salesOrdersRoutes };
