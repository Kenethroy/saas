import { Router } from "express";
import { PaymentTermsController } from "#modules/payment-terms/payment-terms.controller";
import {
  createPaymentTermSchema,
  listPaymentTermsSchema,
  updatePaymentTermSchema
} from "#modules/payment-terms/payment-terms.validator";
import { authenticate } from "#shared/middleware/auth.middleware";
import { requirePermission } from "#shared/middleware/permission.middleware";
import { validateRequest } from "#shared/middleware/validate-request.middleware";

const router = Router();
const controller = new PaymentTermsController();

router.get("/", authenticate, requirePermission("paymentTerms.view"), validateRequest(listPaymentTermsSchema, "query"), controller.list);
router.get("/:id", authenticate, requirePermission("paymentTerms.view"), controller.getById);
router.post("/create", authenticate, requirePermission("paymentTerms.create"), validateRequest(createPaymentTermSchema), controller.create);
router.patch("/:id", authenticate, requirePermission("paymentTerms.update"), validateRequest(updatePaymentTermSchema), controller.update);
router.delete("/:id", authenticate, requirePermission("paymentTerms.delete"), controller.delete);

export { router as paymentTermsRoutes };
