import { Router } from "express";
import { QuotationsController } from "#modules/quotations/quotations.controller";
import {
  createQuotationSchema,
  listQuotationsSchema,
  quotationParamsSchema,
  updateQuotationSchema,
  updateQuotationStatusSchema
} from "#modules/quotations/quotations.validator";
import { authenticate } from "#shared/middleware/auth.middleware";
import { requirePermission } from "#shared/middleware/permission.middleware";
import { validateRequest } from "#shared/middleware/validate-request.middleware";

const router = Router();
const controller = new QuotationsController();

router.get(
  "/",
  authenticate,
  requirePermission("quotations.view"),
  validateRequest(listQuotationsSchema, "query"),
  controller.list
);

router.get(
  "/:id",
  authenticate,
  requirePermission("quotations.view"),
  validateRequest(quotationParamsSchema, "params"),
  controller.getById
);

router.get(
  "/:id/pdf",
  authenticate,
  requirePermission("quotations.view"),
  validateRequest(quotationParamsSchema, "params"),
  controller.pdf
);

router.post(
  "/:id/pdf",
  authenticate,
  requirePermission("quotations.view"),
  validateRequest(quotationParamsSchema, "params"),
  controller.pdf
);

router.post(
  "/create",
  authenticate,
  requirePermission("quotations.create"),
  validateRequest(createQuotationSchema),
  controller.create
);

router.patch(
  "/:id",
  authenticate,
  requirePermission("quotations.update"),
  validateRequest(quotationParamsSchema, "params"),
  validateRequest(updateQuotationSchema),
  controller.update
);

router.patch(
  "/:id/status",
  authenticate,
  requirePermission("quotations.update"),
  validateRequest(quotationParamsSchema, "params"),
  validateRequest(updateQuotationStatusSchema),
  controller.updateStatus
);

router.post(
  "/:id/send",
  authenticate,
  requirePermission("quotations.update"),
  validateRequest(quotationParamsSchema, "params"),
  controller.send
);

router.post(
  "/:id/convert",
  authenticate,
  requirePermission("quotations.update"),
  validateRequest(quotationParamsSchema, "params"),
  controller.convert
);

router.delete(
  "/:id",
  authenticate,
  requirePermission("quotations.delete"),
  validateRequest(quotationParamsSchema, "params"),
  controller.delete
);

export { router as quotationsRoutes };
