import { Router } from "express";
import { PlatformAdminController } from "#modules/platform-admin/platform-admin.controller";
import {
  platformAdminIdParamsSchema,
  platformAdminLoginSchema,
  platformAdminOnboardingAuditListQuerySchema,
  platformAdminPlanPriceUpdateSchema,
  platformAdminPlanUpdateSchema,
  platformAdminSubscriptionActionSchema,
  platformAdminSubscriptionsListQuerySchema,
  platformAdminTenantsListQuerySchema
} from "#modules/platform-admin/platform-admin.validator";
import { authenticatePlatformAccount } from "#shared/middleware/platform-auth.middleware";
import { requirePlatformRole } from "#shared/middleware/platform-roles.middleware";
import { validateRequest } from "#shared/middleware/validate-request.middleware";

const router = Router();
const controller = new PlatformAdminController();

router.post("/auth/login", validateRequest(platformAdminLoginSchema), controller.login);
router.get(
  "/auth/me",
  authenticatePlatformAccount,
  requirePlatformRole(["platform_super_admin", "platform_support", "billing_admin"]),
  controller.currentAccount
);

router.get(
  "/tenants",
  authenticatePlatformAccount,
  requirePlatformRole(["platform_super_admin", "platform_support"]),
  validateRequest(platformAdminTenantsListQuerySchema, "query"),
  controller.listTenants
);

router.get(
  "/subscriptions",
  authenticatePlatformAccount,
  requirePlatformRole(["platform_super_admin", "platform_support", "billing_admin"]),
  validateRequest(platformAdminSubscriptionsListQuerySchema, "query"),
  controller.listSubscriptions
);

router.get(
  "/onboarding-audit",
  authenticatePlatformAccount,
  requirePlatformRole(["platform_super_admin", "platform_support", "billing_admin"]),
  validateRequest(platformAdminOnboardingAuditListQuerySchema, "query"),
  controller.listOnboardingAudits
);

router.get(
  "/onboarding-audit/:id",
  authenticatePlatformAccount,
  requirePlatformRole(["platform_super_admin", "platform_support", "billing_admin"]),
  validateRequest(platformAdminIdParamsSchema, "params"),
  controller.onboardingAudit
);

router.get(
  "/tenants/:id/billing",
  authenticatePlatformAccount,
  requirePlatformRole(["platform_super_admin", "platform_support", "billing_admin"]),
  validateRequest(platformAdminIdParamsSchema, "params"),
  controller.tenantBilling
);

router.post(
  "/tenants/:id/subscription-action",
  authenticatePlatformAccount,
  requirePlatformRole(["platform_super_admin", "billing_admin"]),
  validateRequest(platformAdminIdParamsSchema, "params"),
  validateRequest(platformAdminSubscriptionActionSchema),
  controller.applySubscriptionAction
);

router.get(
  "/plans",
  authenticatePlatformAccount,
  requirePlatformRole(["platform_super_admin", "platform_support", "billing_admin"]),
  controller.listPlans
);

router.patch(
  "/plans/:id",
  authenticatePlatformAccount,
  requirePlatformRole(["platform_super_admin", "billing_admin"]),
  validateRequest(platformAdminIdParamsSchema, "params"),
  validateRequest(platformAdminPlanUpdateSchema),
  controller.updatePlan
);

router.patch(
  "/plan-prices/:id",
  authenticatePlatformAccount,
  requirePlatformRole(["platform_super_admin", "billing_admin"]),
  validateRequest(platformAdminIdParamsSchema, "params"),
  validateRequest(platformAdminPlanPriceUpdateSchema),
  controller.updatePlanPrice
);

export { router as platformAdminRoutes };
