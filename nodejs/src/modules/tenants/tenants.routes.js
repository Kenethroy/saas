import { Router } from "express";
import { TenantsController } from "#modules/tenants/tenants.controller";
import { tenantRenewSchema } from "#modules/tenants/tenants.validator";
import { authenticatePlatformAccount } from "#shared/middleware/platform-auth.middleware";
import {
  requireActiveSubscription,
  requireTenantMembership,
  resolveTenant
} from "#shared/middleware/tenant-context.middleware";
import { validateRequest } from "#shared/middleware/validate-request.middleware";

const router = Router();
const controller = new TenantsController();

router.get("/current", authenticatePlatformAccount, resolveTenant, requireTenantMembership, controller.current);
router.get("/current/subscription", authenticatePlatformAccount, resolveTenant, requireTenantMembership, controller.currentSubscription);
router.get("/current/billing", authenticatePlatformAccount, resolveTenant, requireTenantMembership, controller.currentBilling);
router.post(
  "/current/renew",
  authenticatePlatformAccount,
  resolveTenant,
  requireTenantMembership,
  validateRequest(tenantRenewSchema),
  controller.renew
);
router.get(
  "/current/access",
  authenticatePlatformAccount,
  resolveTenant,
  requireTenantMembership,
  requireActiveSubscription,
  controller.currentAccess
);

export { router as tenantsRoutes };
