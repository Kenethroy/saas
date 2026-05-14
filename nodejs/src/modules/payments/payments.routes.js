import { Router } from "express";
import { PaymentsController } from "#modules/payments/payments.controller";
import { authenticate } from "#shared/middleware/auth.middleware";
import { requirePermission } from "#shared/middleware/permission.middleware";
import { uploadPaymentProof, uploadPaymentScanImage } from "#shared/middleware/upload.middleware";
import { validateRequest } from "#shared/middleware/validate-request.middleware";
import { createCustomerPaymentSchema, createSupplierPaymentSchema, listPaymentsSchema } from "#modules/payments/payments.validator";

const router = Router();
const controller = new PaymentsController();

router.get(
  "/",
  authenticate,
  requirePermission("payments.view"),
  validateRequest(listPaymentsSchema, "query"),
  controller.list
);

router.post(
  "/scan-receipt",
  authenticate,
  requirePermission("payments.create"),
  uploadPaymentScanImage,
  controller.scanReceipt
);

router.post(
  "/customer-payments/create",
  authenticate,
  requirePermission("payments.create"),
  uploadPaymentProof,
  validateRequest(createCustomerPaymentSchema),
  controller.createCustomerPayment
);

router.post(
  "/supplier-payments/create",
  authenticate,
  requirePermission("payments.create"),
  uploadPaymentProof,
  validateRequest(createSupplierPaymentSchema),
  controller.createSupplierPayment
);

router.get(
  "/accounts-payable/:id/history",
  authenticate,
  requirePermission("payments.view"),
  controller.accountsPayableHistory
);

export { router as paymentsRoutes };
