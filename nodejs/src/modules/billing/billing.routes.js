import { Router } from "express";
import { BillingController } from "#modules/billing/billing.controller";
import {
  confirmCheckoutBillingSchema,
  checkoutBillingSchema,
  stripeWebhookSchema,
  xenditWebhookSchema
} from "#modules/billing/billing.validator";
import { authenticatePlatformAccount } from "#shared/middleware/platform-auth.middleware";
import { validateRequest } from "#shared/middleware/validate-request.middleware";

const router = Router();
const controller = new BillingController();

router.post("/subscriptions/checkout", authenticatePlatformAccount, validateRequest(checkoutBillingSchema), controller.checkout);
router.post("/subscriptions/checkout/confirm", authenticatePlatformAccount, validateRequest(confirmCheckoutBillingSchema), controller.confirmCheckout);
router.post("/webhooks/stripe", validateRequest(stripeWebhookSchema), controller.stripeWebhook);
router.post("/webhooks/xendit", validateRequest(xenditWebhookSchema), controller.xenditWebhook);

export { router as billingRoutes };
