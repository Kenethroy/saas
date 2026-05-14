import { Router } from "express";
import { CustomersController } from "#modules/customers/customers.controller";
import {
  customerOrdersSchema,
  customerParamsSchema,
  customerPaymentsSchema,
  customerReturnsSchema,
  customerStatementQuerySchema,
  createCustomerSchema,
  listCustomersSchema,
  updateCustomerSchema
} from "#modules/customers/customers.validator";
import { authenticate } from "#shared/middleware/auth.middleware";
import { requirePermission } from "#shared/middleware/permission.middleware";
import { validateRequest } from "#shared/middleware/validate-request.middleware";

const router = Router();
const controller = new CustomersController();

router.get("/", authenticate, requirePermission("customers.view"), validateRequest(listCustomersSchema, "query"), controller.list);
router.get("/:id/details", authenticate, requirePermission("customers.view"), validateRequest(customerParamsSchema, "params"), controller.getDetails);
router.get("/:id/orders", authenticate, requirePermission("customers.view"), validateRequest(customerParamsSchema, "params"), validateRequest(customerOrdersSchema, "query"), controller.getOrders);
router.get("/:id/unpaid-orders", authenticate, requirePermission("customers.view"), validateRequest(customerParamsSchema, "params"), controller.getUnpaidOrders);
router.get("/:id/payments", authenticate, requirePermission("customers.view"), validateRequest(customerParamsSchema, "params"), validateRequest(customerPaymentsSchema, "query"), controller.getPayments);
router.get("/:id/returns", authenticate, requirePermission("customers.view"), validateRequest(customerParamsSchema, "params"), validateRequest(customerReturnsSchema, "query"), controller.getReturns);
router.get("/:id/statement", authenticate, requirePermission("customers.view"), validateRequest(customerParamsSchema, "params"), validateRequest(customerStatementQuerySchema, "query"), controller.statementPdf);
router.get("/:id/performance-insight", authenticate, requirePermission("customers.view"), validateRequest(customerParamsSchema, "params"), controller.getPerformanceInsight);
router.get("/:id", authenticate, requirePermission("customers.view"), validateRequest(customerParamsSchema, "params"), controller.getById);
router.post("/create", authenticate, requirePermission("customers.create"), validateRequest(createCustomerSchema), controller.create);
router.patch("/:id", authenticate, requirePermission("customers.update"), validateRequest(customerParamsSchema, "params"), validateRequest(updateCustomerSchema), controller.update);
router.delete("/:id", authenticate, requirePermission("customers.delete"), validateRequest(customerParamsSchema, "params"), controller.delete);

export { router as customersRoutes };
