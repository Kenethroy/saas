import { Router } from "express";
import { CustomerReturnsController } from "#modules/customer-returns/customer-returns.controller";
import {
  createCustomerReturnSchema,
  customerReturnCustomerParamsSchema,
  customerReturnParamsSchema,
  listCustomerReturnsSchema,
  rejectCustomerReturnSchema,
  updateCustomerReturnSchema
} from "#modules/customer-returns/customer-returns.validator";
import { authenticate } from "#shared/middleware/auth.middleware";
import { resolveBranch } from "#shared/middleware/branch-context.middleware";
import { requirePermission } from "#shared/middleware/permission.middleware";
import { validateRequest } from "#shared/middleware/validate-request.middleware";

const router = Router();
const controller = new CustomerReturnsController();

router.get(
  "/invoices/:customerId",
  authenticate,
  resolveBranch,
  requirePermission("customerReturns.view"),
  validateRequest(customerReturnCustomerParamsSchema, "params"),
  controller.listInvoices
);

router.get(
  "/",
  authenticate,
  resolveBranch,
  requirePermission("customerReturns.view"),
  validateRequest(listCustomerReturnsSchema, "query"),
  controller.list
);

router.get(
  "/:id",
  authenticate,
  resolveBranch,
  requirePermission("customerReturns.view"),
  validateRequest(customerReturnParamsSchema, "params"),
  controller.getById
);

router.post(
  "/create",
  authenticate,
  resolveBranch,
  requirePermission("customerReturns.create"),
  validateRequest(createCustomerReturnSchema),
  controller.create
);

router.patch(
  "/:id",
  authenticate,
  resolveBranch,
  requirePermission("customerReturns.update"),
  validateRequest(customerReturnParamsSchema, "params"),
  validateRequest(updateCustomerReturnSchema),
  controller.update
);

router.patch(
  "/:id/approve",
  authenticate,
  resolveBranch,
  requirePermission("customerReturns.approve"),
  validateRequest(customerReturnParamsSchema, "params"),
  controller.approve
);

router.patch(
  "/:id/reject",
  authenticate,
  resolveBranch,
  requirePermission("customerReturns.approve"),
  validateRequest(customerReturnParamsSchema, "params"),
  validateRequest(rejectCustomerReturnSchema),
  controller.reject
);

router.delete(
  "/:id",
  authenticate,
  resolveBranch,
  requirePermission("customerReturns.delete"),
  validateRequest(customerReturnParamsSchema, "params"),
  controller.delete
);

// Legacy aliases
router.post(
  "/",
  authenticate,
  resolveBranch,
  requirePermission("customerReturns.create"),
  validateRequest(createCustomerReturnSchema),
  controller.create
);

router.put(
  "/:id",
  authenticate,
  resolveBranch,
  requirePermission("customerReturns.update"),
  validateRequest(customerReturnParamsSchema, "params"),
  validateRequest(updateCustomerReturnSchema),
  controller.update
);

router.post(
  "/:id/approve",
  authenticate,
  resolveBranch,
  requirePermission("customerReturns.approve"),
  validateRequest(customerReturnParamsSchema, "params"),
  controller.approve
);

router.post(
  "/:id/reject",
  authenticate,
  resolveBranch,
  requirePermission("customerReturns.approve"),
  validateRequest(customerReturnParamsSchema, "params"),
  validateRequest(rejectCustomerReturnSchema),
  controller.reject
);

export { router as customerReturnsRoutes };
