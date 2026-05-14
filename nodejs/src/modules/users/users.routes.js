import { Router } from "express";
import { UsersController } from "#modules/users/users.controller";
import {
  createUserSchema,
  listUserEmployeeOptionsSchema,
  listUsersSchema,
  updateUserSchema
} from "#modules/users/users.validator";
import { authenticate } from "#shared/middleware/auth.middleware";
import { requirePermission } from "#shared/middleware/permission.middleware";
import { validateRequest } from "#shared/middleware/validate-request.middleware";

const router = Router();
const controller = new UsersController();

router.get("/", authenticate, requirePermission("users.view"), validateRequest(listUsersSchema, "query"), controller.list);
router.get(
  "/employee-options",
  authenticate,
  requirePermission("users.view"),
  validateRequest(listUserEmployeeOptionsSchema, "query"),
  controller.employeeOptions
);
router.get("/:id", authenticate, requirePermission("users.view"), controller.show);
router.post("/create", authenticate, requirePermission("users.create"), validateRequest(createUserSchema), controller.create);
router.patch("/:id", authenticate, requirePermission("users.update"), validateRequest(updateUserSchema), controller.update);
router.delete("/:id", authenticate, requirePermission("users.delete"), controller.delete);

export { router as usersRoutes };
