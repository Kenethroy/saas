import { Router } from "express";
import { PlatformAdminController } from "#modules/platform-admin/platform-admin.controller";
import {
  platformAdminLoginSchema,
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

export { router as platformAdminRoutes };

