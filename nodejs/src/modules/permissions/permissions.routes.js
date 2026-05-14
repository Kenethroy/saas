import { Router } from "express";
import { PermissionsController } from "#modules/permissions/permissions.controller";
import {
  roleParamsSchema,
  syncPermissionsSchema
} from "#modules/permissions/permissions.validator";
import { authenticate } from "#shared/middleware/auth.middleware";
import { requirePermission } from "#shared/middleware/permission.middleware";
import { validateRequest } from "#shared/middleware/validate-request.middleware";

const router = Router();
const controller = new PermissionsController();

router.get("/permissions", authenticate, requirePermission("users.permissions.manage"), controller.listAll);
router.get("/roles", authenticate, requirePermission("users.permissions.manage"), controller.listRoles);
router.get(
  "/roles/:role/permissions",
  authenticate,
  requirePermission("users.permissions.manage"),
  validateRequest(roleParamsSchema, "params"),
  controller.getRolePermissions
);
router.post(
  "/roles/:role/permissions",
  authenticate,
  requirePermission("users.permissions.manage"),
  validateRequest(roleParamsSchema, "params"),
  validateRequest(syncPermissionsSchema),
  controller.syncRolePermissions
);
router.get("/users/:id/permissions", authenticate, requirePermission("users.permissions.manage"), controller.getUserPermissions);
router.post(
  "/users/:id/permissions",
  authenticate,
  requirePermission("users.permissions.manage"),
  validateRequest(syncPermissionsSchema),
  controller.syncUserPermissions
);

export { router as permissionsRoutes };
